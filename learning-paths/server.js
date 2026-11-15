import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb, tx } from './db.js';
import * as v from './validate.js';
import { HttpError } from './validate.js';
import { TEMPLATES } from './templates.js';
import { createAiTools, aiConfigured, GRADES, AI_TASK_TYPES } from './ai.js';
import { stripNikud } from './validate.js';
import {
  studentContent, gradeAnswer as grade, parseAiInput, pathFromAi, taskFromAi, randomPin, secretString, SECRET_EMOJIS, AVATARS, GRADED_TYPES, keepTeacherParts,
} from './logic.js';
import * as billing from './billing.js';
import { createMailer } from './mailer.js';
import { DICTA_URL, dictaRequest, dictaToText } from './dicta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_MS = 30 * 24 * 3600 * 1000;
const MAX_BODY = 256 * 1024;
const MAX_UPLOAD_BODY = 30 * 1024 * 1024; // AI generator: files arrive base64-encoded
// Billing settings; every one can be overridden from the environment.
export function billingConfig(env = process.env) {
  const d = billing.BILLING_DEFAULTS;
  const num = (v, def) => (v !== undefined && v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : def);
  return {
    freeCredits: num(env.FREE_CREDITS, d.freeCredits),
    monthlyCredits: num(env.MONTHLY_CREDITS, d.monthlyCredits),
    periodDays: d.periodDays,
    priceLabel: env.PRICE_LABEL || d.priceLabel,
    costs: {
      createPath: num(env.COST_CREATE_PATH, d.costs.createPath),
      aiGenerate: num(env.COST_AI_GENERATE, d.costs.aiGenerate),
      aiImprove: num(env.COST_AI_IMPROVE, d.costs.aiImprove),
      aiNikud: num(env.COST_AI_NIKUD, d.costs.aiNikud),
    },
    // 'test': the subscribe button activates a subscription without charging anyone.
    // Unset: online payment is off (subscriptions can still be granted with admin.js).
    paymentsMode: env.PAYMENTS_MODE === 'test' ? 'test' : 'off',
  };
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  'img-src * data:',
  "media-src 'self' blob:",
  'frame-src https://www.youtube-nocookie.com',
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

// ---------- helpers ----------

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

function checkPassword(pw, stored) {
  const [saltHex, keyHex] = stored.split(':');
  const key = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64);
  return crypto.timingSafeEqual(key, Buffer.from(keyHex, 'hex'));
}

const DUMMY_HASH = hashPassword('timing-equalizer');

// The address links in emails point to. Set APP_URL in production: the Host header
// alone could be spoofed into a reset email.
function appUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${proto}://${req.headers.host}`;
}

// What an uploaded file really is, from its first bytes (the browser's claim is not trusted).
export function sniffMedia(buf) {
  const ascii = (a, b) => buf.toString('latin1', a, b);
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (ascii(0, 4) === 'GIF8') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'audio/wav';
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'audio/webm';
  if (ascii(0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(4, 8) === 'ftyp') return 'audio/mp4';
  if (ascii(0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  return null;
}

const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const MEDIA_QUOTA_BYTES = 200 * 1024 * 1024; // per teacher

function randomCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function send(res, status, body, headers = {}) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(data);
}

async function readJson(req, maxBody = MAX_BODY) {
  if (req.method === 'GET' || req.method === 'DELETE') return {};
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBody) throw new HttpError(413, 'הבקשה גדולה מדי');
    chunks.push(chunk);
  }
  if (!size) return {};
  // Requiring JSON also blocks cross-site form posts (they can't send this content type).
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'נדרש JSON');
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new HttpError(400, 'JSON לא תקין');
  }
}

// Simple fixed-window limiter for login/join attempts.
function rateLimiter(limit, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      if (hits.size > 10_000) for (const [k, e] of hits) if (e.reset < now) hits.delete(k);
      return;
    }
    if (++entry.count > limit) throw new HttpError(429, 'יותר מדי ניסיונות, נסו שוב בעוד כמה דקות');
  };
}

// ---------- app ----------

// ai: { enabled, generatePath } – injectable so tests don't call the real API.
// billingCfg: see billingConfig().
// Calls Dicta's Nakdan; returns its token list. Injectable for tests.
async function callDicta(text) {
  const res = await fetch(process.env.DICTA_URL || DICTA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dictaRequest(text)),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Dicta answered ${res.status}`);
  return res.json();
}

// mailer: { send({to, subject, text}) } – injectable for tests.
export function createApp(db, { ai, billingCfg = billingConfig(), mailer = createMailer(), dicta = callDicta } = {}) {
  const loginLimit = rateLimiter(10, 15 * 60 * 1000);
  const joinLimit = rateLimiter(60, 15 * 60 * 1000);
  const aiLimit = rateLimiter(20, 60 * 60 * 1000);
  const pinLimit = rateLimiter(8, 10 * 60 * 1000); // per student: stops guessing the 4-digit code
  const secretLimit = rateLimiter(8, 10 * 60 * 1000); // per student: stops guessing a classmate's secret
  const forgotLimit = rateLimiter(5, 60 * 60 * 1000);
  const dictaLimit = rateLimiter(120, 60 * 60 * 1000);
  const recordLimit = rateLimiter(30, 60 * 60 * 1000); // per student: spoken answers
  // Tests pass their own tools; otherwise the real ones are made on first use.
  let tools = ai && (ai.generatePath || ai.nikud || ai.improveTask) ? ai : null;
  const aiTools = () => (tools ||= createAiTools());
  const aiEnabled = ai ? ai.enabled !== false : aiConfigured();

  const q = {
    teacherByEmail: db.prepare('SELECT * FROM teachers WHERE email = ?'),
    insertTeacher: db.prepare('INSERT INTO teachers (name, email, password_hash, credits) VALUES (?, ?, ?, ?)'),
    teacherById: db.prepare('SELECT * FROM teachers WHERE id = ?'),
    saveAccount: db.prepare('UPDATE teachers SET credits = ?, sub_status = ?, sub_period_end = ?, sub_credits_left = ? WHERE id = ?'),
    ledgerInsert: db.prepare('INSERT INTO credit_ledger (teacher_id, delta, action, note) VALUES (?, ?, ?, ?)'),
    ledger: db.prepare('SELECT delta, action, note, created_at FROM credit_ledger WHERE teacher_id = ? ORDER BY id DESC LIMIT 30'),
    session: db.prepare(`SELECT t.id, t.name, t.email FROM sessions s JOIN teachers t ON t.id = s.teacher_id
                         WHERE s.token = ? AND s.expires_at > ?`),
    insertSession: db.prepare('INSERT INTO sessions (token, teacher_id, expires_at) VALUES (?, ?, ?)'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
    deleteTeacherSessions: db.prepare('DELETE FROM sessions WHERE teacher_id = ?'),
    insertMedia: db.prepare('INSERT INTO media (id, teacher_id, mime, size, data) VALUES (?, ?, ?, ?, ?)'),
    mediaById: db.prepare('SELECT mime, data FROM media WHERE id = ?'),
    mediaUsage: db.prepare('SELECT COALESCE(SUM(size), 0) AS total FROM media WHERE teacher_id = ?'),
    insertReset: db.prepare('INSERT INTO password_resets (token_hash, teacher_id, expires_at) VALUES (?, ?, ?)'),
    resetByHash: db.prepare('SELECT * FROM password_resets WHERE token_hash = ?'),
    useReset: db.prepare('UPDATE password_resets SET used = 1 WHERE token_hash = ?'),
    setPassword: db.prepare('UPDATE teachers SET password_hash = ? WHERE id = ?'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),

    listPaths: db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM tasks WHERE path_id = p.id) AS task_count,
                             (SELECT COUNT(*) FROM students WHERE path_id = p.id) AS student_count,
                             (SELECT COUNT(*) FROM help_requests h JOIN students s ON s.id = h.student_id
                               WHERE s.path_id = p.id AND h.resolved = 0) AS open_help,
                             (SELECT COUNT(*) FROM progress pr JOIN students s ON s.id = pr.student_id
                               WHERE s.path_id = p.id AND pr.approved = 0) AS pending_approval
                           FROM paths p WHERE teacher_id = ? ORDER BY updated_at DESC, id DESC`),
    pathById: db.prepare('SELECT * FROM paths WHERE id = ?'),
    pathByCode: db.prepare('SELECT * FROM paths WHERE code = ?'),
    // Path and class codes share one namespace: a student types either.
    codeExists: db.prepare('SELECT 1 FROM paths WHERE code = ?1 UNION SELECT 1 FROM classes WHERE code = ?1'),

    classesOf: db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM class_members WHERE class_id = c.id) AS member_count,
                             (SELECT COUNT(*) FROM class_paths WHERE class_id = c.id) AS path_count
                           FROM classes c WHERE teacher_id = ? ORDER BY c.created_at DESC, c.id DESC`),
    classById: db.prepare('SELECT * FROM classes WHERE id = ?'),
    classByCode: db.prepare('SELECT * FROM classes WHERE code = ?'),
    insertClass: db.prepare('INSERT INTO classes (teacher_id, name, code) VALUES (?, ?, ?)'),
    renameClass: db.prepare('UPDATE classes SET name = ? WHERE id = ?'),
    deleteClass: db.prepare('DELETE FROM classes WHERE id = ?'),
    classPathIds: db.prepare('SELECT path_id FROM class_paths WHERE class_id = ? ORDER BY position, path_id'),
    clearClassPaths: db.prepare('DELETE FROM class_paths WHERE class_id = ?'),
    addClassPath: db.prepare('INSERT INTO class_paths (class_id, path_id, position) VALUES (?, ?, ?)'),
    membersOf: db.prepare('SELECT * FROM class_members WHERE class_id = ? ORDER BY name'),
    memberById: db.prepare('SELECT * FROM class_members WHERE id = ?'),
    memberByToken: db.prepare('SELECT * FROM class_members WHERE token = ?'),
    memberByName: db.prepare('SELECT * FROM class_members WHERE class_id = ? AND name = ?'),
    insertMember: db.prepare('INSERT INTO class_members (class_id, name, token, secret_hash, avatar) VALUES (?, ?, ?, ?, ?)'),
    setMemberSecret: db.prepare('UPDATE class_members SET secret_hash = ? WHERE id = ?'),
    setMemberAvatar: db.prepare('UPDATE class_members SET avatar = ? WHERE id = ?'),
    touchMember: db.prepare("UPDATE class_members SET last_active = datetime('now') WHERE id = ?"),
    deleteMember: db.prepare('DELETE FROM class_members WHERE id = ?'),
    studentOfMember: db.prepare('SELECT * FROM students WHERE path_id = ? AND class_member_id = ?'),
    linkStudent: db.prepare('UPDATE students SET class_member_id = ?, secret_hash = ?, avatar = ? WHERE id = ?'),
    insertLinkedStudent: db.prepare('INSERT INTO students (path_id, name, token, secret_hash, avatar, class_member_id) VALUES (?, ?, ?, ?, ?, ?)'),
    // Finished (and approved) tasks per path for one class member.
    memberDone: db.prepare(`SELECT s.path_id, COUNT(p.task_id) AS done FROM students s
                            LEFT JOIN progress p ON p.student_id = s.id AND p.approved = 1
                            WHERE s.class_member_id = ? GROUP BY s.path_id`),
    taskCount: db.prepare('SELECT COUNT(*) AS n FROM tasks WHERE path_id = ?'),
    insertPathRow: db.prepare('INSERT INTO paths (teacher_id, title, description, code, theme, approval_pin) VALUES (?, ?, ?, ?, ?, ?)'),
    setPin: db.prepare('UPDATE paths SET approval_pin = ? WHERE id = ?'),
    updatePath: db.prepare(`UPDATE paths SET title = ?, description = ?, theme = ?, published = ?,
                            updated_at = datetime('now') WHERE id = ?`),
    touchPath: db.prepare("UPDATE paths SET updated_at = datetime('now') WHERE id = ?"),
    deletePath: db.prepare('DELETE FROM paths WHERE id = ?'),

    tasks: db.prepare('SELECT * FROM tasks WHERE path_id = ? ORDER BY position, id'),
    taskById: db.prepare('SELECT * FROM tasks WHERE id = ?'),
    maxPos: db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM tasks WHERE path_id = ?'),
    insertTask: db.prepare(`INSERT INTO tasks (path_id, position, type, title, emoji, est_minutes, content, needs_approval)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
    updateTask: db.prepare(`UPDATE tasks SET type = ?, title = ?, emoji = ?, est_minutes = ?, content = ?, needs_approval = ?
                            WHERE id = ?`),
    setPos: db.prepare('UPDATE tasks SET position = ? WHERE id = ?'),
    deleteTask: db.prepare('DELETE FROM tasks WHERE id = ?'),

    studentByToken: db.prepare('SELECT * FROM students WHERE token = ?'),
    studentByName: db.prepare('SELECT * FROM students WHERE path_id = ? AND name = ?'),
    studentById: db.prepare('SELECT * FROM students WHERE id = ?'),
    insertStudent: db.prepare('INSERT INTO students (path_id, name, token, secret_hash, avatar) VALUES (?, ?, ?, ?, ?)'),
    setSecret: db.prepare('UPDATE students SET secret_hash = ? WHERE id = ?'),
    setAvatar: db.prepare('UPDATE students SET avatar = ? WHERE id = ?'),
    touchStudent: db.prepare("UPDATE students SET last_active = datetime('now') WHERE id = ?"),
    deleteStudent: db.prepare('DELETE FROM students WHERE id = ?'),
    studentsOfPath: db.prepare(`SELECT id, name, avatar, secret_hash IS NOT NULL AS has_secret, created_at, last_active
                                FROM students WHERE path_id = ? ORDER BY name`),

    progressOfStudent: db.prepare('SELECT task_id, answer, completed_at, approved FROM progress WHERE student_id = ?'),
    progressOfPath: db.prepare(`SELECT p.student_id, p.task_id, p.answer, p.completed_at, p.approved, p.duration_sec FROM progress p
                                JOIN students s ON s.id = p.student_id WHERE s.path_id = ?`),
    // Redoing an approved task keeps it approved.
    upsertProgress: db.prepare(`INSERT INTO progress (student_id, task_id, answer, approved) VALUES (?, ?, ?, ?)
                                ON CONFLICT (student_id, task_id) DO UPDATE SET answer = excluded.answer,
                                completed_at = datetime('now'), approved = max(progress.approved, excluded.approved)`),
    openTask: db.prepare('INSERT OR IGNORE INTO task_attempts (student_id, task_id, opened_at) VALUES (?, ?, ?)'),
    wrongAttempt: db.prepare(`INSERT INTO task_attempts (student_id, task_id, opened_at, wrong) VALUES (?, ?, ?, 1)
                              ON CONFLICT (student_id, task_id) DO UPDATE SET wrong = wrong + 1`),
    attempt: db.prepare('SELECT * FROM task_attempts WHERE student_id = ? AND task_id = ?'),
    // Graded tasks the student finished without a single wrong answer.
    firstTry: db.prepare(`SELECT COUNT(*) AS n FROM progress p JOIN tasks t ON t.id = p.task_id
                          LEFT JOIN task_attempts a ON a.student_id = p.student_id AND a.task_id = p.task_id
                          WHERE p.student_id = ? AND p.approved = 1 AND COALESCE(a.wrong, 0) = 0
                          AND t.type IN (${GRADED_TYPES.map((t) => `'${t}'`).join(', ')})`),
    attemptsOfPath: db.prepare(`SELECT a.student_id, a.task_id, a.wrong FROM task_attempts a
                                JOIN students s ON s.id = a.student_id WHERE s.path_id = ?`),
    setDuration: db.prepare('UPDATE progress SET duration_sec = ? WHERE student_id = ? AND task_id = ? AND duration_sec IS NULL'),
    approveProgress: db.prepare('UPDATE progress SET approved = 1 WHERE student_id = ? AND task_id = ? AND approved = 0'),
    progressRow: db.prepare('SELECT * FROM progress WHERE student_id = ? AND task_id = ?'),
    deleteProgress: db.prepare('DELETE FROM progress WHERE student_id = ? AND task_id = ?'),

    insertHelp: db.prepare('INSERT INTO help_requests (student_id, task_id) VALUES (?, ?)'),
    openHelpForStudent: db.prepare('SELECT task_id FROM help_requests WHERE student_id = ? AND resolved = 0'),
    helpOfPath: db.prepare(`SELECT h.id, h.student_id, h.task_id, h.created_at FROM help_requests h
                            JOIN students s ON s.id = h.student_id WHERE s.path_id = ? AND h.resolved = 0
                            ORDER BY h.created_at`),
    helpById: db.prepare(`SELECT h.*, s.path_id FROM help_requests h JOIN students s ON s.id = h.student_id
                          WHERE h.id = ?`),
    resolveHelp: db.prepare('UPDATE help_requests SET resolved = 1 WHERE id = ?'),
    resolveHelpForTask: db.prepare('UPDATE help_requests SET resolved = 1 WHERE student_id = ? AND task_id = ?'),
  };

  // ----- serializers -----

  const taskOut = (t, { forStudent = false } = {}) => {
    let content = JSON.parse(t.content);
    if (forStudent) content = studentContent(t.type, content);
    return {
      id: t.id, type: t.type, title: t.title, emoji: t.emoji, estMinutes: t.est_minutes,
      needsApproval: Boolean(t.needs_approval), content,
    };
  };

  const pathOut = (p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    code: p.code,
    theme: v.theme(JSON.parse(p.theme)),
    published: Boolean(p.published),
    approvalPin: p.approval_pin,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  });

  // ----- auth -----

  function currentTeacher(req) {
    const token = parseCookies(req.headers.cookie).sid;
    if (!token) return null;
    return q.session.get(token, Date.now()) || null;
  }

  function requireTeacher(ctx) {
    if (!ctx.teacher) throw new HttpError(401, 'יש להתחבר');
    return ctx.teacher;
  }

  function sessionCookie(req, token, maxAgeSec) {
    const secure = process.env.COOKIE_SECURE === '1' || req.headers['x-forwarded-proto'] === 'https';
    return `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
  }

  function startSession(req, teacherId) {
    q.purgeSessions.run(Date.now());
    const token = crypto.randomBytes(32).toString('hex');
    q.insertSession.run(token, teacherId, Date.now() + SESSION_MS);
    return sessionCookie(req, token, SESSION_MS / 1000);
  }

  function ownPath(ctx, id) {
    const teacher = requireTeacher(ctx);
    const p = q.pathById.get(Number(id));
    if (!p || p.teacher_id !== teacher.id) throw new HttpError(404, 'המסלול לא נמצא');
    return p;
  }

  function ownTask(ctx, id) {
    const t = q.taskById.get(Number(id));
    if (!t) throw new HttpError(404, 'המשימה לא נמצאה');
    ownPath(ctx, t.path_id);
    return t;
  }

  function newCode() {
    for (let i = 0; i < 20; i++) {
      const code = randomCode();
      if (!q.codeExists.get(code)) return code;
    }
    throw new Error('could not allocate path code');
  }

  // A one-hour, one-use link. Only the token's hash is stored.
  function createResetLink(teacherId, origin) {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    q.insertReset.run(hash, teacherId, Date.now() + 60 * 60 * 1000);
    return `${origin}/#/reset/${token}`;
  }

  const insertPath = (teacherId, title, description, code, theme) =>
    q.insertPathRow.run(teacherId, title, description, code, theme, randomPin());

  function insertTask(pathId, t) {
    const pos = q.maxPos.get(pathId).m + 1;
    const r = q.insertTask.run(pathId, pos, t.type, t.title, t.emoji, t.estMinutes, JSON.stringify(t.content), t.needsApproval ? 1 : 0);
    return q.taskById.get(Number(r.lastInsertRowid));
  }

  // ----- credits -----

  const accountOf = (row) => ({
    credits: row.credits, subStatus: row.sub_status, subPeriodEnd: row.sub_period_end, subCreditsLeft: row.sub_credits_left,
  });

  // Loads a teacher's account, lets fn change it, and saves it. Call inside tx().
  function changeAccount(teacherId, fn) {
    const acc = accountOf(q.teacherById.get(teacherId));
    const out = fn(acc);
    q.saveAccount.run(acc.credits, acc.subStatus, acc.subPeriodEnd, acc.subCreditsLeft, teacherId);
    return out;
  }

  // Takes the cost of `action` (inside the caller's transaction) and records it.
  function charge(teacherId, action, note) {
    return changeAccount(teacherId, (acc) => {
      const taken = billing.spend(acc, action, billingCfg);
      q.ledgerInsert.run(teacherId, -taken.cost, action, note.slice(0, 200));
      return taken;
    });
  }

  function refundCharge(teacherId, taken, note) {
    tx(db, () => changeAccount(teacherId, (acc) => {
      billing.refund(acc, taken);
      q.ledgerInsert.run(teacherId, taken.cost, 'refund', note.slice(0, 200));
    }));
  }

  const availableCredits = (teacherId) => billing.available(billing.refresh(accountOf(q.teacherById.get(teacherId))));

  function billingOut(teacherId) {
    const acc = accountOf(q.teacherById.get(teacherId));
    return {
      ...billing.summary(acc, billingCfg),
      paymentsMode: billingCfg.paymentsMode,
      history: q.ledger.all(teacherId).map((r) => ({
        delta: r.delta, action: r.action, label: billing.ACTION_LABELS[r.action] || r.action, note: r.note, at: r.created_at,
      })),
    };
  }

  // ----- student side -----

  // A path is visible to students when published; its owner can always preview it.
  function publicPath(ctx, code) {
    const p = q.pathByCode.get(String(code).toUpperCase());
    if (!p || (!p.published && p.teacher_id !== ctx.teacher?.id)) {
      throw new HttpError(404, 'לא מצאנו מסלול עם הקוד הזה');
    }
    return p;
  }

  function currentStudent(req, p) {
    const token = req.headers['x-student-token'];
    const s = token && q.studentByToken.get(String(token));
    if (!s || s.path_id !== p.id) throw new HttpError(401, 'צריך להצטרף למסלול מחדש');
    return s;
  }

  function studentTask(p, taskId) {
    const t = q.taskById.get(Number(taskId));
    if (!t || t.path_id !== p.id) throw new HttpError(404, 'המשימה לא נמצאה');
    return t;
  }

  const gradeAnswer = (t, body) => grade(t.type, JSON.parse(t.content), body);

  // done: approved (or never needed approval); pending: finished, waiting for the teacher.
  function studentState(s) {
    const done = {};
    const pending = [];
    for (const r of q.progressOfStudent.all(s.id)) {
      if (!r.approved) { pending.push(r.task_id); continue; }
      done[r.task_id] = { answer: r.answer == null ? null : JSON.parse(r.answer), completedAt: r.completed_at };
    }
    const help = q.openHelpForStudent.all(s.id).map((r) => r.task_id);
    return { student: { id: s.id, name: s.name, avatar: s.avatar || '' }, done, pending, help, firstTry: q.firstTry.get(s.id).n };
  }

  // The teacher's decision on a pending task: approve, or send it back to redo.
  function decide(studentId, taskId, decision) {
    if (decision === 'redo') q.deleteProgress.run(studentId, taskId);
    else if (decision === 'approve') q.approveProgress.run(studentId, taskId);
    else throw new HttpError(400, 'החלטה לא תקינה');
    q.resolveHelpForTask.run(studentId, taskId);
  }

  // ----- routes -----

  const routes = [];
  const route = (method, pattern, handler, opts = {}) => {
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
    routes.push({ method, re, handler, maxBody: opts.maxBody });
  };

  // Used by the hosting platform to know the server is up and the database answers.
  route('GET', '/api/health', () => {
    db.prepare('SELECT 1').get();
    return { ok: true };
  });

  route('POST', '/api/auth/register', (ctx) => {
    const name = v.str(ctx.body.name, { max: 80, required: true, field: 'שם' });
    const mail = v.email(ctx.body.email);
    const pw = v.password(ctx.body.password);
    if (q.teacherByEmail.get(mail)) throw new HttpError(409, 'כבר קיים חשבון עם האימייל הזה');
    const id = tx(db, () => {
      const r = q.insertTeacher.run(name, mail, hashPassword(pw), billingCfg.freeCredits);
      const tid = Number(r.lastInsertRowid);
      q.ledgerInsert.run(tid, billingCfg.freeCredits, 'signup', '');
      return tid;
    });
    return [201, { teacher: { id, name, email: mail, credits: billingCfg.freeCredits } }, { 'Set-Cookie': startSession(ctx.req, id) }];
  });

  route('POST', '/api/auth/login', (ctx) => {
    const mail = v.email(ctx.body.email);
    loginLimit(mail);
    const pw = typeof ctx.body.password === 'string' ? ctx.body.password : '';
    const t = q.teacherByEmail.get(mail);
    const ok = checkPassword(pw, t ? t.password_hash : DUMMY_HASH) && t;
    if (!ok) throw new HttpError(401, 'אימייל או סיסמה שגויים');
    return [200, { teacher: { id: t.id, name: t.name, email: t.email, credits: availableCredits(t.id) } }, { 'Set-Cookie': startSession(ctx.req, t.id) }];
  });

  // Always answers the same way, so it does not reveal which emails have accounts.
  route('POST', '/api/auth/forgot', async (ctx) => {
    const mail = v.email(ctx.body.email);
    forgotLimit(mail);
    forgotLimit(`ip:${ctx.ip}`);
    const t = q.teacherByEmail.get(mail);
    if (t) {
      const link = createResetLink(t.id, appUrl(ctx.req));
      try {
        await mailer.send({
          to: t.email,
          subject: 'איפוס סיסמה – מסלולי למידה',
          text: `שלום ${t.name},\n\nכדי לבחור סיסמה חדשה, פתחו את הקישור (תקף לשעה אחת):\n${link}\n\nאם לא ביקשתם לאפס סיסמה, אפשר להתעלם מההודעה.`,
        });
      } catch (err) {
        console.error(err);
      }
    }
    return { ok: true };
  });

  route('POST', '/api/auth/reset', (ctx) => {
    const token = typeof ctx.body.token === 'string' ? ctx.body.token : '';
    const pw = v.password(ctx.body.password);
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const r = q.resetByHash.get(hash);
    if (!r || r.used || r.expires_at < Date.now()) {
      throw new HttpError(400, 'הקישור לא תקף או שפג תוקפו. בקשו קישור חדש.');
    }
    tx(db, () => {
      q.useReset.run(hash);
      q.setPassword.run(hashPassword(pw), r.teacher_id);
      q.deleteTeacherSessions.run(r.teacher_id); // signs out every other device
    });
    const t = q.teacherById.get(r.teacher_id);
    return [200, { teacher: { id: t.id, name: t.name, email: t.email } }, { 'Set-Cookie': startSession(ctx.req, t.id) }];
  });

  route('POST', '/api/auth/logout', (ctx) => {
    const token = parseCookies(ctx.req.headers.cookie).sid;
    if (token) q.deleteSession.run(token);
    return [200, { ok: true }, { 'Set-Cookie': sessionCookie(ctx.req, '', 0) }];
  });

  route('GET', '/api/auth/me', (ctx) => ({
    teacher: ctx.teacher && { ...ctx.teacher, credits: availableCredits(ctx.teacher.id) },
    costs: billingCfg.costs,
  }));

  route('GET', '/api/billing', (ctx) => billingOut(requireTeacher(ctx).id));

  route('POST', '/api/billing/checkout', (ctx) => {
    const teacher = requireTeacher(ctx);
    if (billingCfg.paymentsMode !== 'test') {
      throw new HttpError(503, 'התשלום המקוון עוד לא הופעל. כדי להצטרף למנוי, פנו להנהלת המערכת.');
    }
    tx(db, () => changeAccount(teacher.id, (acc) => {
      billing.activate(acc, billingCfg);
      q.ledgerInsert.run(teacher.id, billingCfg.monthlyCredits, 'subscribe', 'מצב בדיקה – ללא חיוב');
    }));
    return billingOut(teacher.id);
  });

  route('POST', '/api/billing/cancel', (ctx) => {
    const teacher = requireTeacher(ctx);
    tx(db, () => changeAccount(teacher.id, (acc) => {
      if (acc.subStatus !== 'active') throw new HttpError(400, 'אין מנוי פעיל לביטול');
      billing.cancel(acc);
      q.ledgerInsert.run(teacher.id, 0, 'cancel', '');
    }));
    return billingOut(teacher.id);
  });

  route('GET', '/api/paths', (ctx) => {
    const teacher = requireTeacher(ctx);
    return {
      paths: q.listPaths.all(teacher.id).map((p) => ({
        ...pathOut(p), taskCount: p.task_count, studentCount: p.student_count, openHelp: p.open_help,
        pendingApproval: p.pending_approval,
      })),
    };
  });

  route('POST', '/api/paths', (ctx) => {
    const teacher = requireTeacher(ctx);
    const title = v.str(ctx.body.title, { max: 120, required: true, field: 'שם המסלול' });
    const template = TEMPLATES[ctx.body.template] || TEMPLATES.empty;
    const id = tx(db, () => {
      charge(teacher.id, 'createPath', title);
      const r = insertPath(teacher.id, title, template.description, newCode(), JSON.stringify(v.THEME_DEFAULTS));
      const pathId = Number(r.lastInsertRowid);
      for (const t of template.tasks) insertTask(pathId, v.task(t));
      return pathId;
    });
    return [201, { path: pathOut(q.pathById.get(id)), credits: availableCredits(teacher.id) }];
  });

  route('GET', '/api/paths/:id', (ctx) => {
    const p = ownPath(ctx, ctx.params.id);
    return { path: pathOut(p), tasks: q.tasks.all(p.id).map((t) => taskOut(t)) };
  });

  route('PUT', '/api/paths/:id', (ctx) => {
    const p = ownPath(ctx, ctx.params.id);
    const b = ctx.body;
    const title = b.title !== undefined ? v.str(b.title, { max: 120, required: true, field: 'שם המסלול' }) : p.title;
    const description = b.description !== undefined ? v.str(b.description, { max: 1000, field: 'תיאור' }) : p.description;
    const theme = b.theme !== undefined ? v.theme(b.theme, JSON.parse(p.theme)) : v.theme(JSON.parse(p.theme));
    const published = b.published !== undefined ? (b.published ? 1 : 0) : p.published;
    q.updatePath.run(title, description, JSON.stringify(theme), published, p.id);
    return { path: pathOut(q.pathById.get(p.id)) };
  });

  route('DELETE', '/api/paths/:id', (ctx) => {
    const p = ownPath(ctx, ctx.params.id);
    q.deletePath.run(p.id);
    return { ok: true };
  });

  route('POST', '/api/paths/:id/duplicate', (ctx) => {
    const p = ownPath(ctx, ctx.params.id);
    const title = `${p.title} (עותק)`.slice(0, 120);
    const id = tx(db, () => {
      charge(p.teacher_id, 'createPath', title);
      const r = insertPath(p.teacher_id, title, p.description, newCode(), p.theme);
      const newId = Number(r.lastInsertRowid);
      for (const t of q.tasks.all(p.id)) {
        insertTask(newId, {
          type: t.type, title: t.title, emoji: t.emoji, estMinutes: t.est_minutes,
          needsApproval: Boolean(t.needs_approval), content: JSON.parse(t.content),
        });
      }
      return newId;
    });
    return [201, { path: pathOut(q.pathById.get(id)), credits: availableCredits(p.teacher_id) }];
  });

  route('POST', '/api/paths/:id/tasks', (ctx) => {
    const p = ownPath(ctx, ctx.params.id);
    const t = v.task(ctx.body);
    const row = insertTask(p.id, t);
    q.touchPath.run(p.id);
    return [201, { task: taskOut(row) }];
  });

  // Runs a paid AI action: takes the credits first, gives them back if it fails.
  async function withCredits(teacherId, action, note, fn) {
    if (!aiEnabled) throw new HttpError(503, 'הבינה המלאכותית עוד לא הופעלה בשרת הזה (חסר מפתח API).');
    aiLimit(teacherId);
    const taken = tx(db, () => charge(teacherId, action, note));
    try {
      return await fn();
    } catch (err) {
      refundCharge(teacherId, taken, note);
      throw err;
    }
  }

  // Nikud by Dicta's Nakdan: free for the teacher, no credits.
  route('POST', '/api/nikud/dicta', async (ctx) => {
    const teacher = requireTeacher(ctx);
    if (process.env.DICTA_ENABLED === '0') throw new HttpError(503, 'הניקוד של דיקטה כבוי בשרת הזה.');
    const text = v.str(ctx.body.text, { max: 3000, required: true, field: 'טקסט' });
    dictaLimit(teacher.id);
    let tokens;
    try {
      tokens = await dicta(text);
    } catch (err) {
      console.error('Dicta:', err.message);
      throw new HttpError(502, 'דיקטה לא זמינה כרגע. נסו שוב בעוד רגע, או נקדו עם AI.');
    }
    return { text: dictaToText(tokens) };
  });

  route('POST', '/api/ai/nikud', async (ctx) => {
    const teacher = requireTeacher(ctx);
    const text = v.str(ctx.body.text, { max: 3000, required: true, field: 'טקסט' });
    const out = await withCredits(teacher.id, 'aiNikud', text.slice(0, 40), () => aiTools().nikud(text));
    // Nikud only adds marks; if the letters changed, tell the teacher to check.
    const letters = (s) => stripNikud(s).replace(/\s+/g, '');
    return { text: out, changed: letters(out) !== letters(text), credits: availableCredits(teacher.id) };
  });

  route('POST', '/api/ai/improve-task', async (ctx) => {
    const teacher = requireTeacher(ctx);
    const original = v.task(ctx.body.task || {});
    const kind = typeof ctx.body.kind === 'string' ? ctx.body.kind : '';
    const custom = v.str(ctx.body.custom, { max: 300, field: 'הבקשה' });
    if (!['simpler', 'shorter', 'nikud', 'more', 'easier', 'harder', 'custom'].includes(kind) || (kind === 'custom' && !custom)) {
      throw new HttpError(400, 'בחרו מה לשפר');
    }
    const improved = await withCredits(teacher.id, 'aiImprove', original.title, async () => {
      const t = taskFromAi(await aiTools().improveTask(original, { kind, custom }));
      if (t.type !== original.type) throw new HttpError(502, 'התקבלה משימה מסוג אחר. נסו שוב.');
      return t;
    });
    keepTeacherParts(original, improved);
    return { task: improved, credits: availableCredits(teacher.id) };
  });

  // --- uploaded pictures and recordings ---

  route('POST', '/api/media', (ctx) => {
    const teacher = requireTeacher(ctx);
    const buf = Buffer.from(typeof ctx.body.data === 'string' ? ctx.body.data : '', 'base64');
    if (!buf.length) throw new HttpError(400, 'הקובץ ריק');
    if (buf.length > MEDIA_MAX_BYTES) throw new HttpError(413, 'הקובץ גדול מדי (עד 5MB)');
    const mime = sniffMedia(buf);
    if (!mime) throw new HttpError(400, 'אפשר להעלות תמונה (PNG, JPG, GIF, WebP) או הקלטה (WebM, OGG, MP3, M4A, WAV)');
    if (q.mediaUsage.get(teacher.id).total + buf.length > MEDIA_QUOTA_BYTES) {
      throw new HttpError(413, 'נגמר המקום לקבצים בחשבון (200MB)');
    }
    const id = crypto.randomBytes(16).toString('hex');
    q.insertMedia.run(id, teacher.id, mime, buf.length, buf);
    return [201, { url: `/api/media/${id}`, mime }];
  }, { maxBody: 8 * 1024 * 1024 });

  // --- AI generator ---

  route('GET', '/api/ai/status', (ctx) => {
    requireTeacher(ctx);
    return { enabled: aiEnabled, grades: GRADES, types: AI_TASK_TYPES, costs: billingCfg.costs };
  });

  route('POST', '/api/ai/generate', async (ctx) => {
    const teacher = requireTeacher(ctx);
    if (!aiEnabled) throw new HttpError(503, 'מחולל המסלולים עוד לא הופעל בשרת הזה (חסר מפתח API).');
    const input = parseAiInput(ctx.body);
    aiLimit(teacher.id);

    // Credits are taken before the (slow) generation so two requests can't both spend
    // the last ones, and handed back if no path comes out of it.
    const taken = tx(db, () => charge(teacher.id, 'aiGenerate', input.topic));
    let result;
    try {
      result = pathFromAi(await aiTools().generatePath(input), input);
    } catch (err) {
      refundCharge(teacher.id, taken, input.topic);
      throw err;
    }
    const { title, description, theme, tasks, skipped } = result;
    const id = tx(db, () => {
      const r = insertPath(teacher.id, title, description, newCode(), JSON.stringify(theme));
      const pathId = Number(r.lastInsertRowid);
      for (const t of tasks) insertTask(pathId, t);
      return pathId;
    });
    return [201, { path: pathOut(q.pathById.get(id)), taskCount: tasks.length, skipped, credits: availableCredits(teacher.id) }];
  }, { maxBody: MAX_UPLOAD_BODY });

  route('PUT', '/api/paths/:id/order', (ctx) => {
    const p = ownPath(ctx, ctx.params.id);
    const ids = Array.isArray(ctx.body.taskIds) ? ctx.body.taskIds.map(Number) : [];
    const current = q.tasks.all(p.id).map((t) => t.id);
    if (ids.length !== current.length || new Set(ids).size !== ids.length || !ids.every((id) => current.includes(id))) {
      throw new HttpError(400, 'סדר משימות לא תקין');
    }
    tx(db, () => ids.forEach((id, i) => q.setPos.run(i, id)));
    q.touchPath.run(p.id);
    return { tasks: q.tasks.all(p.id).map((t) => taskOut(t)) };
  });

  route('PUT', '/api/tasks/:id', (ctx) => {
    const existing = ownTask(ctx, ctx.params.id);
    const t = v.task(ctx.body);
    q.updateTask.run(t.type, t.title, t.emoji, t.estMinutes, JSON.stringify(t.content), t.needsApproval ? 1 : 0, existing.id);
    q.touchPath.run(existing.path_id);
    return { task: taskOut(q.taskById.get(existing.id)) };
  });

  route('DELETE', '/api/tasks/:id', (ctx) => {
    const t = ownTask(ctx, ctx.params.id);
    q.deleteTask.run(t.id);
    q.touchPath.run(t.path_id);
    return { ok: true };
  });

  route('GET', '/api/paths/:id/progress', (ctx) => {
    const p = ownPath(ctx, ctx.params.id);
    const students = q.studentsOfPath.all(p.id).map((s) => ({
      id: s.id, name: s.name, avatar: s.avatar, hasSecret: Boolean(s.has_secret),
      joinedAt: s.created_at, lastActive: s.last_active, done: {},
    }));
    const byId = new Map(students.map((s) => [s.id, s]));
    for (const r of q.progressOfPath.all(p.id)) {
      byId.get(r.student_id).done[r.task_id] = {
        answer: r.answer == null ? null : JSON.parse(r.answer), completedAt: r.completed_at, approved: Boolean(r.approved),
        durationSec: r.duration_sec,
      };
    }
    // Wrong attempts per student and task, finished or not: where students get stuck.
    const wrong = {};
    for (const a of q.attemptsOfPath.all(p.id)) if (a.wrong) (wrong[a.student_id] ||= {})[a.task_id] = a.wrong;
    const help = q.helpOfPath.all(p.id).map((h) => ({
      id: h.id, studentId: h.student_id, taskId: h.task_id, createdAt: h.created_at,
    }));
    return { tasks: q.tasks.all(p.id).map((t) => taskOut(t)), students, help, wrong };
  });

  // Approving from the progress table, without the student's screen.
  route('POST', '/api/students/:id/tasks/:taskId/decision', (ctx) => {
    const s = q.studentById.get(Number(ctx.params.id));
    if (!s) throw new HttpError(404, 'התלמיד לא נמצא');
    const p = ownPath(ctx, s.path_id);
    const t = studentTask(p, ctx.params.taskId);
    if (!q.progressRow.get(s.id, t.id)) throw new HttpError(400, 'המשימה עוד לא הושלמה');
    decide(s.id, t.id, ctx.body.decision);
    return { ok: true };
  });

  route('PUT', '/api/paths/:id/pin', (ctx) => {
    const p = ownPath(ctx, ctx.params.id);
    const pin = ctx.body.pin === undefined ? randomPin() : v.pin(ctx.body.pin);
    q.setPin.run(pin, p.id);
    return { path: pathOut(q.pathById.get(p.id)) };
  });

  // --- classes: one code and one login for several paths ---

  function ownClass(ctx, id) {
    const teacher = requireTeacher(ctx);
    const c = q.classById.get(Number(id));
    if (!c || c.teacher_id !== teacher.id) throw new HttpError(404, 'הכיתה לא נמצאה');
    return c;
  }

  const classOut = (c) => ({ id: c.id, name: c.name, code: c.code, createdAt: c.created_at });

  // { pathId: done } for one member, from the students rows linked to them.
  const memberProgress = (memberId) => Object.fromEntries(q.memberDone.all(memberId).map((r) => [r.path_id, r.done]));

  route('GET', '/api/classes', (ctx) => {
    const teacher = requireTeacher(ctx);
    return {
      classes: q.classesOf.all(teacher.id).map((c) => ({ ...classOut(c), memberCount: c.member_count, pathCount: c.path_count })),
    };
  });

  route('POST', '/api/classes', (ctx) => {
    const teacher = requireTeacher(ctx);
    const name = v.str(ctx.body.name, { max: 80, required: true, field: 'שם הכיתה' });
    const r = q.insertClass.run(teacher.id, name, newCode());
    return [201, { class: classOut(q.classById.get(Number(r.lastInsertRowid))) }];
  });

  route('GET', '/api/classes/:id', (ctx) => {
    const c = ownClass(ctx, ctx.params.id);
    const pathIds = q.classPathIds.all(c.id).map((r) => r.path_id);
    return {
      class: classOut(c),
      pathIds,
      taskCounts: Object.fromEntries(pathIds.map((id) => [id, q.taskCount.get(id).n])),
      members: q.membersOf.all(c.id).map((m) => ({
        id: m.id, name: m.name, avatar: m.avatar, hasSecret: Boolean(m.secret_hash), lastActive: m.last_active,
        done: memberProgress(m.id),
      })),
    };
  });

  route('PUT', '/api/classes/:id', (ctx) => {
    const c = ownClass(ctx, ctx.params.id);
    if (ctx.body.name !== undefined) q.renameClass.run(v.str(ctx.body.name, { max: 80, required: true, field: 'שם הכיתה' }), c.id);
    if (ctx.body.pathIds !== undefined) {
      const ids = Array.isArray(ctx.body.pathIds) ? [...new Set(ctx.body.pathIds.map(Number))] : [];
      for (const id of ids) ownPath(ctx, id);
      tx(db, () => {
        q.clearClassPaths.run(c.id);
        ids.forEach((id, i) => q.addClassPath.run(c.id, id, i));
      });
    }
    return { class: classOut(q.classById.get(c.id)) };
  });

  route('DELETE', '/api/classes/:id', (ctx) => {
    q.deleteClass.run(ownClass(ctx, ctx.params.id).id);
    return { ok: true };
  });

  const ownMember = (ctx, id) => {
    const m = q.memberById.get(Number(id));
    if (!m) throw new HttpError(404, 'התלמיד לא נמצא');
    ownClass(ctx, m.class_id);
    return m;
  };

  route('POST', '/api/class-members/:id/reset-secret', (ctx) => {
    q.setMemberSecret.run(null, ownMember(ctx, ctx.params.id).id);
    return { ok: true };
  });

  route('DELETE', '/api/class-members/:id', (ctx) => {
    q.deleteMember.run(ownMember(ctx, ctx.params.id).id);
    return { ok: true };
  });

  // --- the class, from the student's side ---

  const classByCode = (code) => {
    const c = q.classByCode.get(String(code).toUpperCase());
    if (!c) throw new HttpError(404, 'לא מצאנו כיתה עם הקוד הזה');
    return c;
  };

  // The class's published paths, as the student's home page lists them.
  const classPaths = (c) => q.classPathIds.all(c.id)
    .map((r) => q.pathById.get(r.path_id))
    .filter((p) => p && p.published)
    .map((p) => {
      const theme = v.theme(JSON.parse(p.theme));
      return { id: p.id, code: p.code, title: p.title, icon: theme.icon, color: theme.color, taskCount: q.taskCount.get(p.id).n };
    });

  const currentMember = (req, c) => {
    const token = req.headers['x-class-token'];
    const m = token && q.memberByToken.get(String(token));
    if (!m || m.class_id !== c.id) throw new HttpError(401, 'צריך להיכנס לכיתה מחדש');
    q.touchMember.run(m.id);
    return m;
  };

  const memberState = (m) => ({ member: { id: m.id, name: m.name, avatar: m.avatar }, done: memberProgress(m.id) });

  route('GET', '/api/c/:code', (ctx) => {
    const c = classByCode(ctx.params.code);
    return { class: { name: c.name, code: c.code }, paths: classPaths(c), join: { secretEmojis: SECRET_EMOJIS, avatars: AVATARS } };
  });

  route('POST', '/api/c/:code/name', (ctx) => {
    const c = classByCode(ctx.params.code);
    joinLimit(ctx.ip);
    const m = q.memberByName.get(c.id, v.str(ctx.body.name, { max: 40, required: true, field: 'שם' }));
    return { exists: Boolean(m), hasSecret: Boolean(m?.secret_hash) };
  });

  route('POST', '/api/c/:code/join', (ctx) => {
    const c = classByCode(ctx.params.code);
    joinLimit(ctx.ip);
    const name = v.str(ctx.body.name, { max: 40, required: true, field: 'שם' });
    const secret = secretString(ctx.body.secret);
    const avatar = AVATARS.includes(ctx.body.avatar) ? ctx.body.avatar : '';
    let m = q.memberByName.get(c.id, name);
    if (!m) {
      q.insertMember.run(c.id, name, crypto.randomBytes(24).toString('hex'), hashPassword(secret), avatar);
      m = q.memberByName.get(c.id, name);
    } else if (!m.secret_hash) {
      q.setMemberSecret.run(hashPassword(secret), m.id);
      if (avatar) q.setMemberAvatar.run(avatar, m.id);
    } else {
      secretLimit(`c${c.id}:${m.id}`);
      if (!checkPassword(secret, m.secret_hash)) {
        throw Object.assign(new HttpError(403, 'הסיסמה הסודית לא נכונה. נסו שוב, או בקשו מהמורה לאפס אותה.'), { code: 'wrong_secret' });
      }
    }
    q.touchMember.run(m.id);
    m = q.memberById.get(m.id);
    // A student who already joined one of the class's paths on their own, with this same name
    // and secret, continues there. The secret must match: a name alone proves nothing.
    for (const { path_id: pathId } of q.classPathIds.all(c.id)) {
      if (q.studentOfMember.get(pathId, m.id)) continue;
      const solo = q.studentByName.get(pathId, m.name);
      if (solo && !solo.class_member_id && solo.secret_hash && checkPassword(secret, solo.secret_hash)) {
        q.linkStudent.run(m.id, solo.secret_hash, solo.avatar || m.avatar, solo.id);
      }
    }
    return { token: m.token, ...memberState(m) };
  });

  route('GET', '/api/c/:code/me', (ctx) => {
    const c = classByCode(ctx.params.code);
    return memberState(currentMember(ctx.req, c));
  });

  // Opening a path from the class: the member's student record in that path, made on first use.
  route('POST', '/api/c/:code/paths/:pathId/enter', (ctx) => {
    const c = classByCode(ctx.params.code);
    const m = currentMember(ctx.req, c);
    const p = classPaths(c).find((x) => x.id === Number(ctx.params.pathId));
    if (!p) throw new HttpError(404, 'המסלול לא נמצא בכיתה');
    let s = q.studentOfMember.get(p.id, m.id);
    if (!s) {
      // Same-name records were linked at join time when the secret matched; any other
      // same-name record belongs to someone else, so this member gets their own.
      const sameName = q.studentByName.get(p.id, m.name);
      {
        const name = sameName ? `${m.name} (${c.name})`.slice(0, 40) : m.name;
        q.insertLinkedStudent.run(p.id, name, crypto.randomBytes(24).toString('hex'), m.secret_hash, m.avatar, m.id);
      }
      s = q.studentOfMember.get(p.id, m.id);
    }
    return { code: p.code, token: s.token };
  });

  route('DELETE', '/api/students/:id', (ctx) => {
    const s = q.studentById.get(Number(ctx.params.id));
    if (!s) throw new HttpError(404, 'התלמיד לא נמצא');
    ownPath(ctx, s.path_id);
    q.deleteStudent.run(s.id);
    return { ok: true };
  });

  route('POST', '/api/help/:id/resolve', (ctx) => {
    const h = q.helpById.get(Number(ctx.params.id));
    if (!h) throw new HttpError(404, 'הבקשה לא נמצאה');
    ownPath(ctx, h.path_id);
    q.resolveHelp.run(h.id);
    return { ok: true };
  });

  // --- student API ---

  route('GET', '/api/s/:code', (ctx) => {
    const p = publicPath(ctx, ctx.params.code);
    const out = pathOut(p);
    return {
      path: { title: out.title, description: out.description, code: out.code, theme: out.theme, published: out.published },
      tasks: q.tasks.all(p.id).map((t) => taskOut(t, { forStudent: true })),
      preview: !p.published || ctx.teacher?.id === p.teacher_id,
      join: { secretEmojis: SECRET_EMOJIS, avatars: AVATARS },
    };
  });

  // Step 1 of joining: is this name new (pick a secret) or returning (enter it)?
  route('POST', '/api/s/:code/name', (ctx) => {
    const p = publicPath(ctx, ctx.params.code);
    joinLimit(ctx.ip);
    const name = v.str(ctx.body.name, { max: 40, required: true, field: 'שם' });
    const s = q.studentByName.get(p.id, name);
    return { exists: Boolean(s), hasSecret: Boolean(s?.secret_hash) };
  });

  // Step 2: a new student (or one whose secret the teacher reset) sets a secret;
  // a returning student must give the same one.
  route('POST', '/api/s/:code/join', (ctx) => {
    const p = publicPath(ctx, ctx.params.code);
    joinLimit(ctx.ip);
    const name = v.str(ctx.body.name, { max: 40, required: true, field: 'שם' });
    const secret = secretString(ctx.body.secret);
    const avatar = AVATARS.includes(ctx.body.avatar) ? ctx.body.avatar : '';
    let s = q.studentByName.get(p.id, name);
    if (!s) {
      q.insertStudent.run(p.id, name, crypto.randomBytes(24).toString('hex'), hashPassword(secret), avatar);
      s = q.studentByName.get(p.id, name);
    } else if (!s.secret_hash) {
      q.setSecret.run(hashPassword(secret), s.id);
      if (avatar) q.setAvatar.run(avatar, s.id);
    } else {
      secretLimit(`${p.id}:${s.id}`);
      if (!checkPassword(secret, s.secret_hash)) {
        throw Object.assign(new HttpError(403, 'הסיסמה הסודית לא נכונה. נסו שוב, או בקשו מהמורה לאפס אותה.'), { code: 'wrong_secret' });
      }
    }
    q.touchStudent.run(s.id);
    return { token: s.token, ...studentState(q.studentById.get(s.id)) };
  });

  route('POST', '/api/students/:id/reset-secret', (ctx) => {
    const s = q.studentById.get(Number(ctx.params.id));
    if (!s) throw new HttpError(404, 'התלמיד לא נמצא');
    ownPath(ctx, s.path_id);
    q.setSecret.run(null, s.id);
    return { ok: true };
  });

  route('GET', '/api/s/:code/me', (ctx) => {
    const p = publicPath(ctx, ctx.params.code);
    const s = currentStudent(ctx.req, p);
    q.touchStudent.run(s.id);
    return studentState(s);
  });

  // Grade without saving (used by teacher preview).
  route('POST', '/api/s/:code/tasks/:taskId/check', (ctx) => {
    const p = publicPath(ctx, ctx.params.code);
    const { correct, explanation, wrong } = gradeAnswer(studentTask(p, ctx.params.taskId), ctx.body);
    return correct ? { correct, explanation: explanation || '' } : { correct, wrong: wrong || [] };
  });

  route('POST', '/api/s/:code/tasks/:taskId/complete', (ctx) => {
    const p = publicPath(ctx, ctx.params.code);
    const s = currentStudent(ctx.req, p);
    const t = studentTask(p, ctx.params.taskId);
    const { correct, answer, explanation, wrong } = gradeAnswer(t, ctx.body);
    q.touchStudent.run(s.id);
    if (!correct) {
      q.wrongAttempt.run(s.id, t.id, Date.now());
      return { correct: false, wrong: wrong || [] };
    }
    q.upsertProgress.run(s.id, t.id, answer == null ? null : JSON.stringify(answer), t.needs_approval ? 0 : 1);
    const opened = q.attempt.get(s.id, t.id);
    // Time on task, from first opening it; capped so a tab left open overnight doesn't count.
    if (opened) q.setDuration.run(Math.min(3 * 3600, Math.round((Date.now() - opened.opened_at) / 1000)), s.id, t.id);
    q.resolveHelpForTask.run(s.id, t.id);
    return { correct: true, explanation: explanation || '', ...studentState(s) };
  });

  // A student's spoken answer. Audio only; counts toward the teacher's storage.
  route('POST', '/api/s/:code/media', (ctx) => {
    const p = publicPath(ctx, ctx.params.code);
    const s = currentStudent(ctx.req, p);
    recordLimit(`${s.id}`);
    const buf = Buffer.from(typeof ctx.body.data === 'string' ? ctx.body.data : '', 'base64');
    if (!buf.length) throw new HttpError(400, 'ההקלטה ריקה');
    if (buf.length > 4 * 1024 * 1024) throw new HttpError(413, 'ההקלטה ארוכה מדי');
    const mime = sniffMedia(buf);
    if (!mime?.startsWith('audio/')) throw new HttpError(400, 'אפשר לשלוח רק הקלטה');
    if (q.mediaUsage.get(p.teacher_id).total + buf.length > MEDIA_QUOTA_BYTES) {
      throw new HttpError(413, 'אין מקום להקלטות כרגע. ספרו למורה.');
    }
    const id = crypto.randomBytes(16).toString('hex');
    q.insertMedia.run(id, p.teacher_id, mime, buf.length, buf);
    return [201, { url: `/api/media/${id}` }];
  }, { maxBody: 6 * 1024 * 1024 });

  route('POST', '/api/s/:code/tasks/:taskId/open', (ctx) => {
    const p = publicPath(ctx, ctx.params.code);
    const s = currentStudent(ctx.req, p);
    q.openTask.run(s.id, studentTask(p, ctx.params.taskId).id, Date.now());
    return { ok: true };
  });

  // The teacher types the path's approval code on the student's screen.
  route('POST', '/api/s/:code/tasks/:taskId/approve', (ctx) => {
    const p = publicPath(ctx, ctx.params.code);
    const s = currentStudent(ctx.req, p);
    const t = studentTask(p, ctx.params.taskId);
    pinLimit(`${s.id}`);
    const given = typeof ctx.body.pin === 'string' ? ctx.body.pin : '';
    if (given !== p.approval_pin) throw new HttpError(403, 'הקוד לא נכון');
    if (!q.progressRow.get(s.id, t.id)) throw new HttpError(400, 'המשימה עוד לא הושלמה');
    decide(s.id, t.id, ctx.body.decision);
    return studentState(s);
  });

  route('POST', '/api/s/:code/tasks/:taskId/undo', (ctx) => {
    const p = publicPath(ctx, ctx.params.code);
    const s = currentStudent(ctx.req, p);
    const t = studentTask(p, ctx.params.taskId);
    q.deleteProgress.run(s.id, t.id);
    return studentState(s);
  });

  route('POST', '/api/s/:code/tasks/:taskId/help', (ctx) => {
    const p = publicPath(ctx, ctx.params.code);
    const s = currentStudent(ctx.req, p);
    const t = studentTask(p, ctx.params.taskId);
    if (!q.openHelpForStudent.all(s.id).some((r) => r.task_id === t.id)) q.insertHelp.run(s.id, t.id);
    return studentState(s);
  });

  // ----- static files -----

  function serveStatic(req, res, pathname) {
    const rel = pathname === '/' || !path.extname(pathname) ? '/index.html' : pathname;
    let file;
    try {
      file = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(rel)));
    } catch {
      return send(res, 400, { error: 'כתובת לא תקינה' });
    }
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, { error: 'לא נמצא' });
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, { error: 'לא נמצא' });
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  }

  // ----- dispatcher -----

  return async function handler(req, res) {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    const { pathname } = new URL(req.url, 'http://localhost');
    try {
      if (!pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'שיטה לא נתמכת');
        return serveStatic(req, res, pathname);
      }
      const media = /^\/api\/media\/([0-9a-f]{32})$/.exec(pathname);
      if (media && req.method === 'GET') {
        const m = q.mediaById.get(media[1]);
        if (!m) throw new HttpError(404, 'הקובץ לא נמצא');
        res.writeHead(200, {
          'Content-Type': m.mime,
          'Content-Length': m.data.length,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Disposition': 'inline',
        });
        return res.end(Buffer.from(m.data));
      }
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(pathname);
        if (!m) continue;
        const ctx = {
          req,
          params: m.groups || {},
          body: await readJson(req, r.maxBody),
          teacher: currentTeacher(req),
          ip: req.socket.remoteAddress,
        };
        const out = await r.handler(ctx);
        if (Array.isArray(out)) return send(res, out[0], out[1], out[2]);
        return send(res, 200, out);
      }
      throw new HttpError(404, 'לא נמצא');
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message, ...(err.code ? { code: err.code } : {}) });
      if (err?.code === 'ERR_SQLITE_ERROR' && /UNIQUE/.test(err.message)) return send(res, 409, { error: 'הערך כבר קיים' });
      console.error(err);
      send(res, 500, { error: 'שגיאת שרת' });
    }
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dbFile = process.env.DB_FILE || path.join(__dirname, 'data', 'app.db');
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const db = openDb(dbFile);
  const port = Number(process.env.PORT) || 3000;
  const server = http.createServer(createApp(db));
  server.requestTimeout = 15 * 60 * 1000; // AI generation can take a few minutes
  server.listen(port, () => {
    console.log(`מסלולי למידה פועל: http://localhost:${port}`);
  });
}
