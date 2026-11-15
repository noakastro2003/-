import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb, tx } from './db.js';
import * as v from './validate.js';
import { HttpError } from './validate.js';
import { PROMO_KINDS, normalizeCode, promoInput, promoProblem, promoMessage, promoOut } from './promo.js';
import { TEMPLATES } from './templates.js';
import { createAiTools, aiConfigured, GRADES, AI_TASK_TYPES } from './ai.js';
import READY_PATHS from './content/library-data.js';
import { stripNikud } from './validate.js';
import {
  studentContent, gradeAnswer as grade, parseAiInput, pathFromAi, taskFromAi, randomPin, secretString, SECRET_EMOJIS, AVATARS, GRADED_TYPES, keepTeacherParts, moodInput,
} from './logic.js';
import * as billing from './billing.js';
import { createMailer } from './mailer.js';
import { DICTA_URL, dictaRequest, dictaToText } from './dicta.js';

const APP_DIR = path.dirname(fileURLToPath(import.meta.url)); // not __dirname: bundlers define that name themselves
const PUBLIC_DIR = path.join(APP_DIR, 'public');
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
  'img-src * data: blob:',
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
// Counts recent hits per key in the database, so the limit holds across all server
// instances (on Netlify every request may land on a different one).
function rateLimiter(db, name, limit, windowMs) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM rate_hits WHERE bucket = ? AND at > ?');
  const add = db.prepare('INSERT INTO rate_hits (bucket, at) VALUES (?, ?)');
  const purge = db.prepare('DELETE FROM rate_hits WHERE at < ?');
  return async (key) => {
    const now = Date.now();
    const bucket = `${name}:${key}`;
    if (Math.random() < 0.02) await purge.run(now - 24 * 60 * 60 * 1000);
    if ((await count.get(bucket, now - windowMs)).n >= limit) {
      throw new HttpError(429, 'יותר מדי ניסיונות, נסו שוב בעוד כמה דקות');
    }
    await add.run(bucket, now);
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
// "יום ב׳, 12 בנובמבר, 08:00" in Israel time.
export function whenText(ms) {
  return new Date(ms).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

export function createApp(db, {
  ai, billingCfg = billingConfig(), mailer = createMailer(), dicta = callDicta,
  // startJob(id): runs a generation job elsewhere (Netlify: a background function). When
  // unset, generation runs inside the request.
  startJob = null,
  // mediaStore: { put(id, buffer, mime), get(id) → Buffer | null } for uploaded files.
  // When unset, the bytes are kept in the database.
  mediaStore = null,
  mediaMaxBytes = MEDIA_MAX_BYTES,
  // Teachers whose email is listed here manage promo codes (comma-separated ADMIN_EMAILS).
  adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
} = {}) {
  const isAdmin = (teacher) => Boolean(teacher && adminEmails.includes(String(teacher.email).toLowerCase()));
  const loginLimit = rateLimiter(db, 'login', 10, 15 * 60 * 1000);
  const joinLimit = rateLimiter(db, 'join', 60, 15 * 60 * 1000);
  const aiLimit = rateLimiter(db, 'ai', 20, 60 * 60 * 1000);
  const pinLimit = rateLimiter(db, 'pin', 8, 10 * 60 * 1000); // per student: stops guessing the 4-digit code
  const secretLimit = rateLimiter(db, 'secret', 8, 10 * 60 * 1000); // per student: stops guessing a classmate's secret
  const forgotLimit = rateLimiter(db, 'forgot', 5, 60 * 60 * 1000);
  const dictaLimit = rateLimiter(db, 'dicta', 120, 60 * 60 * 1000);
  const promoLimit = rateLimiter(db, 'promo', 10, 60 * 60 * 1000); // stops guessing codes
  const uploadLimit = rateLimiter(db, 'upload', 40, 60 * 60 * 1000); // per student: recordings, photos, drawings
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
    mediaUsage: db.prepare('SELECT COALESCE(SUM(size), 0)::bigint AS total FROM media WHERE teacher_id = ?'),
    insertReset: db.prepare('INSERT INTO password_resets (token_hash, teacher_id, expires_at) VALUES (?, ?, ?)'),
    resetByHash: db.prepare('SELECT * FROM password_resets WHERE token_hash = ?'),
    useReset: db.prepare('UPDATE password_resets SET used = 1 WHERE token_hash = ?'),
    setTeacherName: db.prepare('UPDATE teachers SET name = ? WHERE id = ?'),
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
    memberByName: db.prepare('SELECT * FROM class_members WHERE class_id = ? AND lower(name) = lower(?)'),
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
    studentByName: db.prepare('SELECT * FROM students WHERE path_id = ? AND lower(name) = lower(?)'),
    studentById: db.prepare('SELECT * FROM students WHERE id = ?'),
    insertStudent: db.prepare('INSERT INTO students (path_id, name, token, secret_hash, avatar) VALUES (?, ?, ?, ?, ?)'),
    setSecret: db.prepare('UPDATE students SET secret_hash = ? WHERE id = ?'),
    setAvatar: db.prepare('UPDATE students SET avatar = ? WHERE id = ?'),
    touchStudent: db.prepare("UPDATE students SET last_active = datetime('now') WHERE id = ?"),
    deleteStudent: db.prepare('DELETE FROM students WHERE id = ?'),
    studentsOfPath: db.prepare(`SELECT id, name, avatar, secret_hash IS NOT NULL AS has_secret, created_at, last_active,
                                hidden_tasks, break_every FROM students WHERE path_id = ? ORDER BY name`),
    setSchedule: db.prepare('UPDATE paths SET opens_at = ?, closes_at = ? WHERE id = ?'),
    setAdapt: db.prepare('UPDATE students SET hidden_tasks = ?, break_every = ? WHERE id = ?'),
    setShared: db.prepare('UPDATE paths SET shared = ?, shared_grade = ?, shared_subject = ?, shared_at = ? WHERE id = ?'),
    library: db.prepare(`SELECT p.*, t.name AS author, (SELECT COUNT(*) FROM tasks k WHERE k.path_id = p.id) AS task_count,
                         (SELECT string_agg(type, ',') FROM tasks k WHERE k.path_id = p.id) AS types
                         FROM paths p JOIN teachers t ON t.id = p.teacher_id WHERE p.shared = 1 ORDER BY p.copies DESC, p.shared_at DESC LIMIT 300`),
    addCopy: db.prepare('UPDATE paths SET copies = copies + 1 WHERE id = ?'),
    addMood: db.prepare('INSERT INTO moods (student_id, kind, mood, at) VALUES (?, ?, ?, ?)'),
    recentMoods: db.prepare('SELECT kind, mood, at FROM moods WHERE student_id = ? ORDER BY at DESC, id DESC LIMIT 20'),

    progressOfStudent: db.prepare('SELECT task_id, answer, completed_at, approved FROM progress WHERE student_id = ?'),
    progressOfPath: db.prepare(`SELECT p.student_id, p.task_id, p.answer, p.completed_at, p.approved, p.duration_sec FROM progress p
                                JOIN students s ON s.id = p.student_id WHERE s.path_id = ?`),
    // Redoing an approved task keeps it approved.
    upsertProgress: db.prepare(`INSERT INTO progress (student_id, task_id, answer, approved) VALUES (?, ?, ?, ?)
                                ON CONFLICT (student_id, task_id) DO UPDATE SET answer = excluded.answer,
                                completed_at = datetime('now'), approved = GREATEST(progress.approved, excluded.approved)`),
    openTask: db.prepare('INSERT INTO task_attempts (student_id, task_id, opened_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'),
    wrongAttempt: db.prepare(`INSERT INTO task_attempts (student_id, task_id, opened_at, wrong) VALUES (?, ?, ?, 1)
                              ON CONFLICT (student_id, task_id) DO UPDATE SET wrong = task_attempts.wrong + 1`),
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

    promoForUpdate: db.prepare('SELECT * FROM promo_codes WHERE code = ? FOR UPDATE'),
    promoByCode: db.prepare('SELECT * FROM promo_codes WHERE code = ?'),
    promoList: db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC, code'),
    insertPromo: db.prepare(`INSERT INTO promo_codes (code, kind, amount, max_uses, expires_at, note) VALUES (?, ?, ?, ?, ?, ?)
                             ON CONFLICT (code) DO NOTHING`),
    setPromoActive: db.prepare('UPDATE promo_codes SET active = ? WHERE code = ?'),
    usePromo: db.prepare('UPDATE promo_codes SET uses = uses + 1 WHERE code = ?'),
    redeemOnce: db.prepare('INSERT INTO promo_redemptions (code, teacher_id) VALUES (?, ?) ON CONFLICT DO NOTHING'),
    insertJob: db.prepare(`INSERT INTO ai_jobs (id, teacher_id, input, taken, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`),
    jobById: db.prepare('SELECT * FROM ai_jobs WHERE id = ?'),
    claimJob: db.prepare("UPDATE ai_jobs SET status = 'running', updated_at = ? WHERE id = ? AND status = 'queued' RETURNING *"),
    finishJob: db.prepare('UPDATE ai_jobs SET status = ?, result = ?, error = ?, error_status = ?, updated_at = ?, input = \'{}\' WHERE id = ?'),
    claimStale: db.prepare("UPDATE ai_jobs SET status = 'failed', error = 'timeout', updated_at = ? WHERE id = ? AND status = ?"),
    setDiscount: db.prepare('UPDATE teachers SET discount_percent = ?, discount_code = ? WHERE id = ?'),
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
    opensAt: p.opens_at ?? null,
    closesAt: p.closes_at ?? null,
    shared: Boolean(p.shared),
    sharedGrade: p.shared_grade || '',
    sharedSubject: p.shared_subject || '',
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  });

  // ----- auth -----

  async function currentTeacher(req) {
    const token = parseCookies(req.headers.cookie).sid;
    if (!token) return null;
    return await q.session.get(token, Date.now()) || null;
  }

  function requireTeacher(ctx) {
    if (!ctx.teacher) throw new HttpError(401, 'יש להתחבר');
    return ctx.teacher;
  }

  function sessionCookie(req, token, maxAgeSec) {
    const secure = process.env.COOKIE_SECURE === '1' || req.headers['x-forwarded-proto'] === 'https';
    return `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
  }

  async function startSession(req, teacherId) {
    await q.purgeSessions.run(Date.now());
    const token = crypto.randomBytes(32).toString('hex');
    await q.insertSession.run(token, teacherId, Date.now() + SESSION_MS);
    return sessionCookie(req, token, SESSION_MS / 1000);
  }

  async function ownPath(ctx, id) {
    const teacher = requireTeacher(ctx);
    const p = await q.pathById.get(Number(id));
    if (!p || p.teacher_id !== teacher.id) throw new HttpError(404, 'המסלול לא נמצא');
    return p;
  }

  async function ownTask(ctx, id) {
    const t = await q.taskById.get(Number(id));
    if (!t) throw new HttpError(404, 'המשימה לא נמצאה');
    await ownPath(ctx, t.path_id);
    return t;
  }

  async function newCode() {
    for (let i = 0; i < 20; i++) {
      const code = randomCode();
      if (!await q.codeExists.get(code)) return code;
    }
    throw new Error('could not allocate path code');
  }

  // A one-hour, one-use link. Only the token's hash is stored.
  async function createResetLink(teacherId, origin) {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await q.insertReset.run(hash, teacherId, Date.now() + 60 * 60 * 1000);
    return `${origin}/#/reset/${token}`;
  }

  const insertPath = async (teacherId, title, description, code, theme) =>
    await q.insertPathRow.run(teacherId, title, description, code, theme, randomPin());

  async function insertTask(pathId, t) {
    const pos = (await q.maxPos.get(pathId)).m + 1;
    const r = await q.insertTask.run(pathId, pos, t.type, t.title, t.emoji, t.estMinutes, JSON.stringify(t.content), t.needsApproval ? 1 : 0);
    return await q.taskById.get(Number(r.lastInsertRowid));
  }

  // ----- credits -----

  const accountOf = (row) => ({
    credits: row.credits, subStatus: row.sub_status, subPeriodEnd: row.sub_period_end, subCreditsLeft: row.sub_credits_left,
  });

  // Loads a teacher's account, lets fn change it, and saves it. Call inside tx().
  async function changeAccount(teacherId, fn) {
    const acc = accountOf(await q.teacherById.get(teacherId));
    const out = await fn(acc);
    await q.saveAccount.run(acc.credits, acc.subStatus, acc.subPeriodEnd, acc.subCreditsLeft, teacherId);
    return out;
  }

  // Takes the cost of `action` (inside the caller's transaction) and records it.
  async function charge(teacherId, action, note) {
    return await changeAccount(teacherId, async (acc) => {
      const taken = billing.spend(acc, action, billingCfg);
      await q.ledgerInsert.run(teacherId, -taken.cost, action, note.slice(0, 200));
      return taken;
    });
  }

  async function refundCharge(teacherId, taken, note) {
    await tx(db, async () => await changeAccount(teacherId, async (acc) => {
      billing.refund(acc, taken);
      await q.ledgerInsert.run(teacherId, taken.cost, 'refund', note.slice(0, 200));
    }));
  }

  const availableCredits = async (teacherId) => billing.available(billing.refresh(accountOf(await q.teacherById.get(teacherId))));

  async function billingOut(teacherId) {
    const row = await q.teacherById.get(teacherId);
    const acc = accountOf(row);
    return {
      ...billing.summary(acc, billingCfg),
      paymentsMode: billingCfg.paymentsMode,
      discount: row.discount_percent ? { percent: row.discount_percent, code: row.discount_code } : null,
      history: (await q.ledger.all(teacherId)).map((r) => ({
        delta: r.delta, action: r.action, label: billing.ACTION_LABELS[r.action] || r.action, note: r.note, at: r.created_at,
      })),
    };
  }

  // ----- student side -----

  // A path is visible to students when published; its owner can always preview it.
  async function publicPath(ctx, code) {
    const p = await q.pathByCode.get(String(code).toUpperCase());
    if (!p || (!p.published && p.teacher_id !== ctx.teacher?.id)) {
      throw new HttpError(404, 'לא מצאנו מסלול עם הקוד הזה');
    }
    if (p.opens_at && Date.now() < p.opens_at && p.teacher_id !== ctx.teacher?.id) {
      throw new HttpError(403, `המסלול ייפתח ב-${whenText(p.opens_at)}. מחכים לכם!`);
    }
    return p;
  }
  const isClosed = (p) => Boolean(p.closes_at && Date.now() >= p.closes_at);
  // After the closing time students can look at their map but not add work.
  function assertOpen(p) {
    if (isClosed(p)) throw new HttpError(403, 'המסלול נסגר, אי אפשר להמשיך בו. אפשר לשאול את המורה.');
  }

  async function currentStudent(req, p) {
    const token = req.headers['x-student-token'];
    const s = token && await q.studentByToken.get(String(token));
    if (!s || s.path_id !== p.id) throw new HttpError(401, 'צריך להצטרף למסלול מחדש');
    return s;
  }

  async function studentTask(p, taskId) {
    const t = await q.taskById.get(Number(taskId));
    if (!t || t.path_id !== p.id) throw new HttpError(404, 'המשימה לא נמצאה');
    return t;
  }

  const gradeAnswer = (t, body) => grade(t.type, JSON.parse(t.content), body);

  // done: approved (or never needed approval); pending: finished, waiting for the teacher.
  async function studentState(s) {
    const done = {};
    const pending = [];
    for (const r of await q.progressOfStudent.all(s.id)) {
      if (!r.approved) { pending.push(r.task_id); continue; }
      done[r.task_id] = { answer: r.answer == null ? null : JSON.parse(r.answer), completedAt: r.completed_at };
    }
    const help = (await q.openHelpForStudent.all(s.id)).map((r) => r.task_id);
    return {
      student: { id: s.id, name: s.name, avatar: s.avatar || '' }, done, pending, help, firstTry: (await q.firstTry.get(s.id)).n,
      moods: await latestMoods(s.id), adapt: adaptOf(s),
    };
  }

  // The latest "how do I feel" at the start and at the end of a session.
  async function latestMoods(studentId) {
    const out = {};
    for (const m of await q.recentMoods.all(studentId)) out[m.kind] ||= { mood: m.mood, at: m.at };
    return out;
  }
  const adaptOf = (s) => ({ hidden: JSON.parse(s.hidden_tasks || '[]'), breakEvery: s.break_every ?? null });

  // The teacher's decision on a pending task: approve, or send it back to redo.
  async function decide(studentId, taskId, decision) {
    if (decision === 'redo') await q.deleteProgress.run(studentId, taskId);
    else if (decision === 'approve') await q.approveProgress.run(studentId, taskId);
    else throw new HttpError(400, 'החלטה לא תקינה');
    await q.resolveHelpForTask.run(studentId, taskId);
  }

  // ----- uploaded files -----

  // The row (owner, type, size for the quota) is always in the database; the bytes go to
  // the media store when there is one (Netlify Blobs), else into the row.
  async function saveMedia(id, teacherId, mime, buf) {
    if (mediaStore) await mediaStore.put(id, buf, mime);
    await q.insertMedia.run(id, teacherId, mime, buf.length, mediaStore ? null : buf);
  }

  // ----- promo codes -----

  // Applies a code to a teacher's account in one transaction. Returns the message to show.
  async function redeemPromo(teacherId, input) {
    const code = normalizeCode(input);
    if (!code) throw new HttpError(400, 'כתבו את הקוד');
    return tx(db, async () => {
      const row = await q.promoForUpdate.get(code);
      const problem = promoProblem(row);
      if (problem) throw new HttpError(400, problem);
      if (!(await q.redeemOnce.run(code, teacherId)).changes) throw new HttpError(409, 'כבר השתמשת בקוד הזה');
      await q.usePromo.run(code);
      if (row.kind === 'discount') {
        await q.setDiscount.run(row.amount, code, teacherId);
        await q.ledgerInsert.run(teacherId, 0, 'promo', `${code}: ${row.amount}% הנחה`);
      } else {
        await changeAccount(teacherId, async (acc) => {
          if (row.kind === 'credits') acc.credits += row.amount;
          else billing.grantMonths(acc, billingCfg, row.amount);
        });
        const delta = row.kind === 'credits' ? row.amount : billingCfg.monthlyCredits * row.amount;
        await q.ledgerInsert.run(teacherId, delta, 'promo', row.kind === 'credits' ? code : `${code}: ${row.amount} חודשי מנוי`);
      }
      return promoMessage(row);
    });
  }

  function requireAdmin(ctx) {
    const t = requireTeacher(ctx);
    if (!isAdmin(t)) throw new HttpError(403, 'הדף הזה למנהלי האתר בלבד');
    return t;
  }

  // ----- routes -----

  const routes = [];
  const route = (method, pattern, handler, opts = {}) => {
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
    routes.push({ method, re, handler, maxBody: opts.maxBody });
  };

  // Used by the hosting platform to know the server is up and the database answers.
  route('GET', '/api/health', async () => {
    await db.prepare('SELECT 1').get();
    return { ok: true };
  });

  route('POST', '/api/auth/register', async (ctx) => {
    const name = v.str(ctx.body.name, { max: 80, required: true, field: 'שם' });
    const mail = v.email(ctx.body.email);
    const pw = v.password(ctx.body.password);
    if (await q.teacherByEmail.get(mail)) throw new HttpError(409, 'כבר קיים חשבון עם האימייל הזה');
    const id = await tx(db, async () => {
      const r = await q.insertTeacher.run(name, mail, hashPassword(pw), billingCfg.freeCredits);
      const tid = Number(r.lastInsertRowid);
      await q.ledgerInsert.run(tid, billingCfg.freeCredits, 'signup', '');
      return tid;
    });
    // A promo code given at sign-up. The account exists either way; a bad code is reported.
    let promo = null;
    if (typeof ctx.body.promo === 'string' && ctx.body.promo.trim()) {
      try {
        await promoLimit(ctx.ip);
        promo = { ok: true, message: await redeemPromo(id, ctx.body.promo) };
      } catch (err) {
        if (!(err instanceof HttpError)) throw err;
        promo = { ok: false, message: err.message };
      }
    }
    return [201, { teacher: { id, name, email: mail, credits: await availableCredits(id) }, promo }, { 'Set-Cookie': await startSession(ctx.req, id) }];
  });

  route('POST', '/api/auth/login', async (ctx) => {
    const mail = v.email(ctx.body.email);
    await loginLimit(mail);
    const pw = typeof ctx.body.password === 'string' ? ctx.body.password : '';
    const t = await q.teacherByEmail.get(mail);
    const ok = checkPassword(pw, t ? t.password_hash : DUMMY_HASH) && t;
    if (!ok) throw new HttpError(401, 'אימייל או סיסמה שגויים');
    return [200, { teacher: { id: t.id, name: t.name, email: t.email, credits: await availableCredits(t.id) } }, { 'Set-Cookie': await startSession(ctx.req, t.id) }];
  });

  // Always answers the same way, so it does not reveal which emails have accounts.
  route('POST', '/api/auth/forgot', async (ctx) => {
    const mail = v.email(ctx.body.email);
    await forgotLimit(mail);
    await forgotLimit(`ip:${ctx.ip}`);
    const t = await q.teacherByEmail.get(mail);
    if (t) {
      const link = await createResetLink(t.id, appUrl(ctx.req));
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

  route('POST', '/api/auth/reset', async (ctx) => {
    const token = typeof ctx.body.token === 'string' ? ctx.body.token : '';
    const pw = v.password(ctx.body.password);
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const r = await q.resetByHash.get(hash);
    if (!r || r.used || r.expires_at < Date.now()) {
      throw new HttpError(400, 'הקישור לא תקף או שפג תוקפו. בקשו קישור חדש.');
    }
    await tx(db, async () => {
      await q.useReset.run(hash);
      await q.setPassword.run(hashPassword(pw), r.teacher_id);
      await q.deleteTeacherSessions.run(r.teacher_id); // signs out every other device
    });
    const t = await q.teacherById.get(r.teacher_id);
    return [200, { teacher: { id: t.id, name: t.name, email: t.email } }, { 'Set-Cookie': await startSession(ctx.req, t.id) }];
  });

  // Account settings: change the display name.
  route('PUT', '/api/auth/me', async (ctx) => {
    const teacher = requireTeacher(ctx);
    const name = v.str(ctx.body.name, { max: 80, required: true, field: 'שם' });
    await q.setTeacherName.run(name, teacher.id);
    return { teacher: { ...teacher, name } };
  });

  // Change the password: needs the current one; other devices are signed out.
  route('POST', '/api/auth/password', async (ctx) => {
    const teacher = requireTeacher(ctx);
    await loginLimit(teacher.email);
    const row = await q.teacherById.get(teacher.id);
    if (!checkPassword(typeof ctx.body.current === 'string' ? ctx.body.current : '', row.password_hash)) {
      throw new HttpError(403, 'הסיסמה הנוכחית לא נכונה');
    }
    const pw = v.password(ctx.body.password);
    await tx(db, async () => {
      await q.setPassword.run(hashPassword(pw), teacher.id);
      await q.deleteTeacherSessions.run(teacher.id);
    });
    return [200, { ok: true }, { 'Set-Cookie': await startSession(ctx.req, teacher.id) }];
  });

  route('POST', '/api/auth/logout', async (ctx) => {
    const token = parseCookies(ctx.req.headers.cookie).sid;
    if (token) await q.deleteSession.run(token);
    return [200, { ok: true }, { 'Set-Cookie': sessionCookie(ctx.req, '', 0) }];
  });

  route('GET', '/api/auth/me', async (ctx) => ({
    teacher: ctx.teacher && { ...ctx.teacher, credits: await availableCredits(ctx.teacher.id), isAdmin: isAdmin(ctx.teacher) },
    costs: billingCfg.costs,
  }));

  route('GET', '/api/billing', async (ctx) => billingOut(requireTeacher(ctx).id));

  route('POST', '/api/billing/redeem', async (ctx) => {
    const teacher = requireTeacher(ctx);
    await promoLimit(teacher.id);
    const message = await redeemPromo(teacher.id, ctx.body.code);
    return { message, ...(await billingOut(teacher.id)) };
  });

  // --- site admin: promo codes ---

  route('GET', '/api/admin/promo', async (ctx) => {
    requireAdmin(ctx);
    return { codes: (await q.promoList.all()).map(promoOut), kinds: PROMO_KINDS };
  });

  route('POST', '/api/admin/promo', async (ctx) => {
    requireAdmin(ctx);
    const p = promoInput(ctx.body);
    const r = await q.insertPromo.run(p.code, p.kind, p.amount, p.maxUses, p.expiresAt, p.note);
    if (!r.changes) throw new HttpError(409, 'כבר יש קוד כזה');
    return [201, { code: promoOut(await q.promoByCode.get(p.code)) }];
  });

  route('PUT', '/api/admin/promo/:code', async (ctx) => {
    requireAdmin(ctx);
    const code = normalizeCode(decodeURIComponent(ctx.params.code));
    if (!(await q.setPromoActive.run(ctx.body.active ? 1 : 0, code)).changes) throw new HttpError(404, 'הקוד לא נמצא');
    return { code: promoOut(await q.promoByCode.get(code)) };
  });

  route('POST', '/api/billing/checkout', async (ctx) => {
    const teacher = requireTeacher(ctx);
    if (billingCfg.paymentsMode !== 'test') {
      throw new HttpError(503, 'התשלום המקוון עוד לא הופעל. כדי להצטרף למנוי, פנו להנהלת המערכת.');
    }
    const row = await q.teacherById.get(teacher.id);
    await tx(db, async () => {
      await changeAccount(teacher.id, async (acc) => {
        billing.activate(acc, billingCfg);
        const note = row.discount_percent ? `מצב בדיקה – ללא חיוב (הנחה ${row.discount_percent}% נוצלה)` : 'מצב בדיקה – ללא חיוב';
        await q.ledgerInsert.run(teacher.id, billingCfg.monthlyCredits, 'subscribe', note);
      });
      // The discount is for the first payment; it is used up here.
      if (row.discount_percent) await q.setDiscount.run(0, null, teacher.id);
    });
    return await billingOut(teacher.id);
  });

  route('POST', '/api/billing/cancel', async (ctx) => {
    const teacher = requireTeacher(ctx);
    await tx(db, async () => await changeAccount(teacher.id, async (acc) => {
      if (acc.subStatus !== 'active') throw new HttpError(400, 'אין מנוי פעיל לביטול');
      billing.cancel(acc);
      await q.ledgerInsert.run(teacher.id, 0, 'cancel', '');
    }));
    return await billingOut(teacher.id);
  });

  route('GET', '/api/paths', async (ctx) => {
    const teacher = requireTeacher(ctx);
    return {
      paths: (await q.listPaths.all(teacher.id)).map((p) => ({
        ...pathOut(p), taskCount: p.task_count, studentCount: p.student_count, openHelp: p.open_help,
        pendingApproval: p.pending_approval,
      })),
    };
  });

  route('POST', '/api/paths', async (ctx) => {
    const teacher = requireTeacher(ctx);
    const title = v.str(ctx.body.title, { max: 120, required: true, field: 'שם המסלול' });
    const template = TEMPLATES[ctx.body.template] || TEMPLATES.empty;
    const id = await tx(db, async () => {
      await charge(teacher.id, 'createPath', title);
      const r = await insertPath(teacher.id, title, template.description, await newCode(), JSON.stringify(v.THEME_DEFAULTS));
      const pathId = Number(r.lastInsertRowid);
      for (const t of template.tasks) await insertTask(pathId, v.task(t));
      return pathId;
    });
    return [201, { path: pathOut(await q.pathById.get(id)), credits: await availableCredits(teacher.id) }];
  });

  route('GET', '/api/paths/:id', async (ctx) => {
    const p = await ownPath(ctx, ctx.params.id);
    return { path: pathOut(p), tasks: (await q.tasks.all(p.id)).map((t) => taskOut(t)) };
  });

  route('PUT', '/api/paths/:id', async (ctx) => {
    const p = await ownPath(ctx, ctx.params.id);
    const b = ctx.body;
    const title = b.title !== undefined ? v.str(b.title, { max: 120, required: true, field: 'שם המסלול' }) : p.title;
    const description = b.description !== undefined ? v.str(b.description, { max: 1000, field: 'תיאור' }) : p.description;
    const theme = b.theme !== undefined ? v.theme(b.theme, JSON.parse(p.theme)) : v.theme(JSON.parse(p.theme));
    const published = b.published !== undefined ? (b.published ? 1 : 0) : p.published;
    const time = (x, cur) => {
      if (x === undefined) return cur ?? null;
      if (x === null || x === '') return null;
      const n = Number(x);
      if (!Number.isFinite(n) || n < 0) throw new HttpError(400, 'תאריך לא תקין');
      return Math.round(n);
    };
    const opensAt = time(b.opensAt, p.opens_at);
    const closesAt = time(b.closesAt, p.closes_at);
    if (opensAt && closesAt && closesAt <= opensAt) throw new HttpError(400, 'מועד הסגירה צריך להיות אחרי מועד הפתיחה');
    await q.updatePath.run(title, description, JSON.stringify(theme), published, p.id);
    await q.setSchedule.run(opensAt, closesAt, p.id);
    return { path: pathOut(await q.pathById.get(p.id)) };
  });

  route('DELETE', '/api/paths/:id', async (ctx) => {
    const p = await ownPath(ctx, ctx.params.id);
    await q.deletePath.run(p.id);
    return { ok: true };
  });

  route('POST', '/api/paths/:id/duplicate', async (ctx) => {
    const p = await ownPath(ctx, ctx.params.id);
    const title = `${p.title} (עותק)`.slice(0, 120);
    const id = await tx(db, async () => {
      await charge(p.teacher_id, 'createPath', title);
      const r = await insertPath(p.teacher_id, title, p.description, await newCode(), p.theme);
      const newId = Number(r.lastInsertRowid);
      for (const t of await q.tasks.all(p.id)) {
        await insertTask(newId, {
          type: t.type, title: t.title, emoji: t.emoji, estMinutes: t.est_minutes,
          needsApproval: Boolean(t.needs_approval), content: JSON.parse(t.content),
        });
      }
      return newId;
    });
    return [201, { path: pathOut(await q.pathById.get(id)), credits: await availableCredits(p.teacher_id) }];
  });

  route('POST', '/api/paths/:id/tasks', async (ctx) => {
    const p = await ownPath(ctx, ctx.params.id);
    const t = v.task(ctx.body);
    const row = await insertTask(p.id, t);
    await q.touchPath.run(p.id);
    return [201, { task: taskOut(row) }];
  });

  // Runs a paid AI action: takes the credits first, gives them back if it fails.
  async function withCredits(teacherId, action, note, fn) {
    if (!aiEnabled) throw new HttpError(503, 'הבינה המלאכותית עוד לא הופעלה בשרת הזה (חסר מפתח API).');
    await aiLimit(teacherId);
    const taken = await tx(db, async () => await charge(teacherId, action, note));
    try {
      return await fn();
    } catch (err) {
      await refundCharge(teacherId, taken, note);
      throw err;
    }
  }

  // Nikud by Dicta's Nakdan: free for the teacher, no credits.
  route('POST', '/api/nikud/dicta', async (ctx) => {
    const teacher = requireTeacher(ctx);
    if (process.env.DICTA_ENABLED === '0') throw new HttpError(503, 'הניקוד של דיקטה כבוי בשרת הזה.');
    const text = v.str(ctx.body.text, { max: 3000, required: true, field: 'טקסט' });
    await dictaLimit(teacher.id);
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
    return { text: out, changed: letters(out) !== letters(text), credits: await availableCredits(teacher.id) };
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
    return { task: improved, credits: await availableCredits(teacher.id) };
  });

  // --- uploaded pictures and recordings ---

  route('POST', '/api/media', async (ctx) => {
    const teacher = requireTeacher(ctx);
    const buf = Buffer.from(typeof ctx.body.data === 'string' ? ctx.body.data : '', 'base64');
    if (!buf.length) throw new HttpError(400, 'הקובץ ריק');
    if (buf.length > mediaMaxBytes) throw new HttpError(413, `הקובץ גדול מדי (עד ${Math.floor(mediaMaxBytes / 1048576)}MB)`);
    const mime = sniffMedia(buf);
    if (!mime) throw new HttpError(400, 'אפשר להעלות תמונה (PNG, JPG, GIF, WebP) או הקלטה (WebM, OGG, MP3, M4A, WAV)');
    if ((await q.mediaUsage.get(teacher.id)).total + buf.length > MEDIA_QUOTA_BYTES) {
      throw new HttpError(413, 'נגמר המקום לקבצים בחשבון (200MB)');
    }
    const id = crypto.randomBytes(16).toString('hex');
    await saveMedia(id, teacher.id, mime, buf);
    return [201, { url: `/api/media/${id}`, mime }];
  }, { maxBody: 8 * 1024 * 1024 });

  // --- AI generator ---

  route('GET', '/api/ai/status', async (ctx) => {
    requireTeacher(ctx);
    return { enabled: aiEnabled, grades: GRADES, types: AI_TASK_TYPES, costs: billingCfg.costs };
  });

  // The slow part of generating a path: the model, then saving the path. Refunds on failure.
  async function generateInto(teacherId, input, taken) {
    let result;
    try {
      result = pathFromAi(await aiTools().generatePath(input), input);
    } catch (err) {
      await refundCharge(teacherId, taken, input.topic);
      throw err;
    }
    const { title, description, theme, tasks, skipped } = result;
    const id = await tx(db, async () => {
      const r = await insertPath(teacherId, title, description, await newCode(), JSON.stringify(theme));
      const pathId = Number(r.lastInsertRowid);
      for (const t of tasks) await insertTask(pathId, t);
      return pathId;
    });
    return { path: pathOut(await q.pathById.get(id)), taskCount: tasks.length, skipped, credits: await availableCredits(teacherId) };
  }

  route('POST', '/api/ai/generate', async (ctx) => {
    const teacher = requireTeacher(ctx);
    if (!aiEnabled) throw new HttpError(503, 'מחולל המסלולים עוד לא הופעל בשרת הזה (חסר מפתח API).');
    const input = parseAiInput(ctx.body);
    await aiLimit(teacher.id);

    // Credits are taken before the (slow) generation so two requests can't both spend
    // the last ones, and handed back if no path comes out of it.
    const taken = await tx(db, async () => await charge(teacher.id, 'aiGenerate', input.topic));
    if (!startJob) return [201, await generateInto(teacher.id, input, taken)];

    // Hosted on Netlify: requests may not run long, so a background function does the work.
    const id = crypto.randomBytes(16).toString('hex');
    await q.insertJob.run(id, teacher.id, JSON.stringify(input), JSON.stringify(taken), Date.now(), Date.now());
    try {
      await startJob(id);
    } catch (err) {
      await q.finishJob.run('failed', null, 'לא הצלחנו להתחיל את היצירה. נסו שוב.', 500, Date.now(), id);
      await refundCharge(teacher.id, taken, input.topic);
      throw err;
    }
    return [202, { jobId: id }];
  }, { maxBody: MAX_UPLOAD_BODY });

  route('GET', '/api/ai/jobs/:id', async (ctx) => {
    const teacher = requireTeacher(ctx);
    const job = await q.jobById.get(String(ctx.params.id));
    if (!job || job.teacher_id !== teacher.id) throw new HttpError(404, 'לא מצאנו את היצירה');
    // A job that never finished (the background run died) counts as failed after 15 minutes.
    if ((job.status === 'queued' || job.status === 'running') && Date.now() - job.updated_at > 15 * 60 * 1000) {
      if ((await q.claimStale.run(Date.now(), job.id, job.status)).changes) {
        await refundCharge(teacher.id, JSON.parse(job.taken), 'יצירה שלא הסתיימה');
      }
      return { status: 'failed', error: 'היצירה לקחה יותר מדי זמן. הקרדיטים הוחזרו, נסו שוב.' };
    }
    if (job.status === 'done') return { status: 'done', result: JSON.parse(job.result) };
    if (job.status === 'failed') return { status: 'failed', error: job.error, errorStatus: job.error_status };
    return { status: job.status };
  });

  route('PUT', '/api/paths/:id/order', async (ctx) => {
    const p = await ownPath(ctx, ctx.params.id);
    const ids = Array.isArray(ctx.body.taskIds) ? ctx.body.taskIds.map(Number) : [];
    const current = (await q.tasks.all(p.id)).map((t) => t.id);
    if (ids.length !== current.length || new Set(ids).size !== ids.length || !ids.every((id) => current.includes(id))) {
      throw new HttpError(400, 'סדר משימות לא תקין');
    }
    await tx(db, async () => { for (const [i, id] of ids.entries()) await q.setPos.run(i, id); });
    await q.touchPath.run(p.id);
    return { tasks: (await q.tasks.all(p.id)).map((t) => taskOut(t)) };
  });

  route('PUT', '/api/tasks/:id', async (ctx) => {
    const existing = await ownTask(ctx, ctx.params.id);
    const t = v.task(ctx.body);
    await q.updateTask.run(t.type, t.title, t.emoji, t.estMinutes, JSON.stringify(t.content), t.needsApproval ? 1 : 0, existing.id);
    await q.touchPath.run(existing.path_id);
    return { task: taskOut(await q.taskById.get(existing.id)) };
  });

  route('DELETE', '/api/tasks/:id', async (ctx) => {
    const t = await ownTask(ctx, ctx.params.id);
    await q.deleteTask.run(t.id);
    await q.touchPath.run(t.path_id);
    return { ok: true };
  });

  route('GET', '/api/paths/:id/progress', async (ctx) => {
    const p = await ownPath(ctx, ctx.params.id);
    const students = await Promise.all((await q.studentsOfPath.all(p.id)).map(async (s) => ({
      id: s.id, name: s.name, avatar: s.avatar, hasSecret: Boolean(s.has_secret),
      joinedAt: s.created_at, lastActive: s.last_active, done: {},
      moods: await latestMoods(s.id), adapt: adaptOf(s),
    })));
    const byId = new Map(students.map((s) => [s.id, s]));
    for (const r of await q.progressOfPath.all(p.id)) {
      byId.get(r.student_id).done[r.task_id] = {
        answer: r.answer == null ? null : JSON.parse(r.answer), completedAt: r.completed_at, approved: Boolean(r.approved),
        durationSec: r.duration_sec,
      };
    }
    // Wrong attempts per student and task, finished or not: where students get stuck.
    const wrong = {};
    for (const a of await q.attemptsOfPath.all(p.id)) if (a.wrong) (wrong[a.student_id] ||= {})[a.task_id] = a.wrong;
    const help = (await q.helpOfPath.all(p.id)).map((h) => ({
      id: h.id, studentId: h.student_id, taskId: h.task_id, createdAt: h.created_at,
    }));
    return { tasks: (await q.tasks.all(p.id)).map((t) => taskOut(t)), students, help, wrong };
  });

  // Approving from the progress table, without the student's screen.
  route('POST', '/api/students/:id/tasks/:taskId/decision', async (ctx) => {
    const s = await q.studentById.get(Number(ctx.params.id));
    if (!s) throw new HttpError(404, 'התלמיד לא נמצא');
    const p = await ownPath(ctx, s.path_id);
    const t = await studentTask(p, ctx.params.taskId);
    if (!await q.progressRow.get(s.id, t.id)) throw new HttpError(400, 'המשימה עוד לא הושלמה');
    await decide(s.id, t.id, ctx.body.decision);
    return { ok: true };
  });

  route('PUT', '/api/paths/:id/pin', async (ctx) => {
    const p = await ownPath(ctx, ctx.params.id);
    const pin = ctx.body.pin === undefined ? randomPin() : v.pin(ctx.body.pin);
    await q.setPin.run(pin, p.id);
    return { path: pathOut(await q.pathById.get(p.id)) };
  });

  // --- classes: one code and one login for several paths ---

  async function ownClass(ctx, id) {
    const teacher = requireTeacher(ctx);
    const c = await q.classById.get(Number(id));
    if (!c || c.teacher_id !== teacher.id) throw new HttpError(404, 'הכיתה לא נמצאה');
    return c;
  }

  const classOut = (c) => ({ id: c.id, name: c.name, code: c.code, createdAt: c.created_at });

  // { pathId: done } for one member, from the students rows linked to them.
  const memberProgress = async (memberId) => Object.fromEntries((await q.memberDone.all(memberId)).map((r) => [r.path_id, r.done]));

  route('GET', '/api/classes', async (ctx) => {
    const teacher = requireTeacher(ctx);
    return {
      classes: (await q.classesOf.all(teacher.id)).map((c) => ({ ...classOut(c), memberCount: c.member_count, pathCount: c.path_count })),
    };
  });

  route('POST', '/api/classes', async (ctx) => {
    const teacher = requireTeacher(ctx);
    const name = v.str(ctx.body.name, { max: 80, required: true, field: 'שם הכיתה' });
    const r = await q.insertClass.run(teacher.id, name, await newCode());
    return [201, { class: classOut(await q.classById.get(Number(r.lastInsertRowid))) }];
  });

  route('GET', '/api/classes/:id', async (ctx) => {
    const c = await ownClass(ctx, ctx.params.id);
    const pathIds = (await q.classPathIds.all(c.id)).map((r) => r.path_id);
    return {
      class: classOut(c),
      pathIds,
      taskCounts: Object.fromEntries(await Promise.all(pathIds.map(async (id) => [id, (await q.taskCount.get(id)).n]))),
      members: await Promise.all((await q.membersOf.all(c.id)).map(async (m) => ({
        id: m.id, name: m.name, avatar: m.avatar, hasSecret: Boolean(m.secret_hash), lastActive: m.last_active,
        done: await memberProgress(m.id),
      }))),
    };
  });

  route('PUT', '/api/classes/:id', async (ctx) => {
    const c = await ownClass(ctx, ctx.params.id);
    if (ctx.body.name !== undefined) await q.renameClass.run(v.str(ctx.body.name, { max: 80, required: true, field: 'שם הכיתה' }), c.id);
    if (ctx.body.pathIds !== undefined) {
      const ids = Array.isArray(ctx.body.pathIds) ? [...new Set(ctx.body.pathIds.map(Number))] : [];
      for (const id of ids) await ownPath(ctx, id);
      await tx(db, async () => {
        await q.clearClassPaths.run(c.id);
        for (const [i, id] of ids.entries()) await q.addClassPath.run(c.id, id, i);
      });
    }
    return { class: classOut(await q.classById.get(c.id)) };
  });

  route('DELETE', '/api/classes/:id', async (ctx) => {
    await q.deleteClass.run((await ownClass(ctx, ctx.params.id)).id);
    return { ok: true };
  });

  const ownMember = async (ctx, id) => {
    const m = await q.memberById.get(Number(id));
    if (!m) throw new HttpError(404, 'התלמיד לא נמצא');
    await ownClass(ctx, m.class_id);
    return m;
  };

  route('POST', '/api/class-members/:id/reset-secret', async (ctx) => {
    await q.setMemberSecret.run(null, (await ownMember(ctx, ctx.params.id)).id);
    return { ok: true };
  });

  route('DELETE', '/api/class-members/:id', async (ctx) => {
    await q.deleteMember.run((await ownMember(ctx, ctx.params.id)).id);
    return { ok: true };
  });

  // --- the class, from the student's side ---

  const classByCode = async (code) => {
    const c = await q.classByCode.get(String(code).toUpperCase());
    if (!c) throw new HttpError(404, 'לא מצאנו כיתה עם הקוד הזה');
    return c;
  };

  // The class's published paths, as the student's home page lists them.
  const classPaths = async (c) => {
    const out = [];
    for (const r of await q.classPathIds.all(c.id)) {
      const p = await q.pathById.get(r.path_id);
      if (!p || !p.published) continue;
      const theme = v.theme(JSON.parse(p.theme));
      out.push({ id: p.id, code: p.code, title: p.title, icon: theme.icon, color: theme.color, taskCount: (await q.taskCount.get(p.id)).n });
    }
    return out;
  };

  const currentMember = async (req, c) => {
    const token = req.headers['x-class-token'];
    const m = token && await q.memberByToken.get(String(token));
    if (!m || m.class_id !== c.id) throw new HttpError(401, 'צריך להיכנס לכיתה מחדש');
    await q.touchMember.run(m.id);
    return m;
  };

  const memberState = async (m) => ({ member: { id: m.id, name: m.name, avatar: m.avatar }, done: await memberProgress(m.id) });

  route('GET', '/api/c/:code', async (ctx) => {
    const c = await classByCode(ctx.params.code);
    return { class: { name: c.name, code: c.code }, paths: await classPaths(c), join: { secretEmojis: SECRET_EMOJIS, avatars: AVATARS } };
  });

  route('POST', '/api/c/:code/name', async (ctx) => {
    const c = await classByCode(ctx.params.code);
    await joinLimit(ctx.ip);
    const m = await q.memberByName.get(c.id, v.str(ctx.body.name, { max: 40, required: true, field: 'שם' }));
    return { exists: Boolean(m), hasSecret: Boolean(m?.secret_hash) };
  });

  route('POST', '/api/c/:code/join', async (ctx) => {
    const c = await classByCode(ctx.params.code);
    await joinLimit(ctx.ip);
    const name = v.str(ctx.body.name, { max: 40, required: true, field: 'שם' });
    const secret = secretString(ctx.body.secret);
    const avatar = AVATARS.includes(ctx.body.avatar) ? ctx.body.avatar : '';
    let m = await q.memberByName.get(c.id, name);
    if (!m) {
      await q.insertMember.run(c.id, name, crypto.randomBytes(24).toString('hex'), hashPassword(secret), avatar);
      m = await q.memberByName.get(c.id, name);
    } else if (!m.secret_hash) {
      await q.setMemberSecret.run(hashPassword(secret), m.id);
      if (avatar) await q.setMemberAvatar.run(avatar, m.id);
    } else {
      await secretLimit(`c${c.id}:${m.id}`);
      if (!checkPassword(secret, m.secret_hash)) {
        throw Object.assign(new HttpError(403, 'הסיסמה הסודית לא נכונה. נסו שוב, או בקשו מהמורה לאפס אותה.'), { code: 'wrong_secret' });
      }
    }
    await q.touchMember.run(m.id);
    m = await q.memberById.get(m.id);
    // A student who already joined one of the class's paths on their own, with this same name
    // and secret, continues there. The secret must match: a name alone proves nothing.
    for (const { path_id: pathId } of await q.classPathIds.all(c.id)) {
      if (await q.studentOfMember.get(pathId, m.id)) continue;
      const solo = await q.studentByName.get(pathId, m.name);
      if (solo && !solo.class_member_id && solo.secret_hash && checkPassword(secret, solo.secret_hash)) {
        await q.linkStudent.run(m.id, solo.secret_hash, solo.avatar || m.avatar, solo.id);
      }
    }
    return { token: m.token, ...(await memberState(m)) };
  });

  route('GET', '/api/c/:code/me', async (ctx) => {
    const c = await classByCode(ctx.params.code);
    return await memberState(await currentMember(ctx.req, c));
  });

  // Opening a path from the class: the member's student record in that path, made on first use.
  route('POST', '/api/c/:code/paths/:pathId/enter', async (ctx) => {
    const c = await classByCode(ctx.params.code);
    const m = await currentMember(ctx.req, c);
    const p = (await classPaths(c)).find((x) => x.id === Number(ctx.params.pathId));
    if (!p) throw new HttpError(404, 'המסלול לא נמצא בכיתה');
    let s = await q.studentOfMember.get(p.id, m.id);
    if (!s) {
      // Same-name records were linked at join time when the secret matched; any other
      // same-name record belongs to someone else, so this member gets their own.
      const sameName = await q.studentByName.get(p.id, m.name);
      {
        const name = sameName ? `${m.name} (${c.name})`.slice(0, 40) : m.name;
        await q.insertLinkedStudent.run(p.id, name, crypto.randomBytes(24).toString('hex'), m.secret_hash, m.avatar, m.id);
      }
      s = await q.studentOfMember.get(p.id, m.id);
    }
    return { code: p.code, token: s.token };
  });

  route('DELETE', '/api/students/:id', async (ctx) => {
    const s = await q.studentById.get(Number(ctx.params.id));
    if (!s) throw new HttpError(404, 'התלמיד לא נמצא');
    await ownPath(ctx, s.path_id);
    await q.deleteStudent.run(s.id);
    return { ok: true };
  });

  route('POST', '/api/help/:id/resolve', async (ctx) => {
    const h = await q.helpById.get(Number(ctx.params.id));
    if (!h) throw new HttpError(404, 'הבקשה לא נמצאה');
    await ownPath(ctx, h.path_id);
    await q.resolveHelp.run(h.id);
    return { ok: true };
  });

  // --- student API ---

  route('GET', '/api/s/:code', async (ctx) => {
    const p = await publicPath(ctx, ctx.params.code);
    const out = pathOut(p);
    return {
      path: {
        title: out.title, description: out.description, code: out.code, theme: out.theme, published: out.published,
        closed: isClosed(p), closesAt: out.closesAt,
      },
      tasks: (await q.tasks.all(p.id)).map((t) => taskOut(t, { forStudent: true })),
      preview: !p.published || ctx.teacher?.id === p.teacher_id,
      join: { secretEmojis: SECRET_EMOJIS, avatars: AVATARS },
    };
  });

  // Step 1 of joining: is this name new (pick a secret) or returning (enter it)?
  route('POST', '/api/s/:code/name', async (ctx) => {
    const p = await publicPath(ctx, ctx.params.code);
    await joinLimit(ctx.ip);
    const name = v.str(ctx.body.name, { max: 40, required: true, field: 'שם' });
    const s = await q.studentByName.get(p.id, name);
    return { exists: Boolean(s), hasSecret: Boolean(s?.secret_hash) };
  });

  // Step 2: a new student (or one whose secret the teacher reset) sets a secret;
  // a returning student must give the same one.
  route('POST', '/api/s/:code/join', async (ctx) => {
    const p = await publicPath(ctx, ctx.params.code);
    assertOpen(p);
    await joinLimit(ctx.ip);
    const name = v.str(ctx.body.name, { max: 40, required: true, field: 'שם' });
    const secret = secretString(ctx.body.secret);
    const avatar = AVATARS.includes(ctx.body.avatar) ? ctx.body.avatar : '';
    let s = await q.studentByName.get(p.id, name);
    if (!s) {
      await q.insertStudent.run(p.id, name, crypto.randomBytes(24).toString('hex'), hashPassword(secret), avatar);
      s = await q.studentByName.get(p.id, name);
    } else if (!s.secret_hash) {
      await q.setSecret.run(hashPassword(secret), s.id);
      if (avatar) await q.setAvatar.run(avatar, s.id);
    } else {
      await secretLimit(`${p.id}:${s.id}`);
      if (!checkPassword(secret, s.secret_hash)) {
        throw Object.assign(new HttpError(403, 'הסיסמה הסודית לא נכונה. נסו שוב, או בקשו מהמורה לאפס אותה.'), { code: 'wrong_secret' });
      }
    }
    await q.touchStudent.run(s.id);
    return { token: s.token, ...(await studentState(await q.studentById.get(s.id))) };
  });

  // Per-student adaptation: hide tasks from one student, or give them their own break rhythm.
  route('PUT', '/api/students/:id/adapt', async (ctx) => {
    const s = await q.studentById.get(Number(ctx.params.id));
    if (!s) throw new HttpError(404, 'התלמיד לא נמצא');
    const p = await ownPath(ctx, s.path_id);
    const ids = new Set((await q.tasks.all(p.id)).map((t) => t.id));
    const hidden = [...new Set(Array.isArray(ctx.body.hidden) ? ctx.body.hidden.map(Number) : [])].filter((id) => ids.has(id));
    if (hidden.length && hidden.length >= ids.size) throw new HttpError(400, 'צריך להשאיר לפחות משימה אחת');
    const be = ctx.body.breakEvery;
    const breakEvery = be === null || be === undefined || be === '' ? null : v.int(be, { min: 0, max: 20, def: 0 });
    await q.setAdapt.run(JSON.stringify(hidden), breakEvery, s.id);
    return { adapt: { hidden, breakEvery } };
  });

  // --- shared library: teachers share paths and copy each other's ---

  route('PUT', '/api/paths/:id/share', async (ctx) => {
    const p = await ownPath(ctx, ctx.params.id);
    const shared = Boolean(ctx.body.shared);
    if (shared && !(await q.tasks.all(p.id)).length) throw new HttpError(400, 'אי אפשר לשתף מסלול בלי משימות');
    const grade = GRADES.includes(ctx.body.grade) ? ctx.body.grade : '';
    const subject = v.str(ctx.body.subject, { max: 40, field: 'מקצוע' });
    await q.setShared.run(shared ? 1 : 0, grade, subject, shared ? (p.shared_at || Date.now()) : null, p.id);
    return { path: pathOut(await q.pathById.get(p.id)) };
  });

  const readyItem = (x) => ({
    id: `site-${x.slug}`, title: x.title, description: x.description, theme: x.theme, grade: x.grade, subject: x.subject,
    curriculum: x.curriculum, order: x.order, taskCount: x.tasks.length, types: [...new Set(x.tasks.map((t) => t.type))],
    author: '', copies: 0, mine: false, ready: true,
  });
  const libraryItem = (p, teacherId) => ({
    id: p.id, title: p.title, description: p.description, theme: v.theme(JSON.parse(p.theme)),
    grade: p.shared_grade, subject: p.shared_subject, taskCount: p.task_count,
    types: [...new Set(String(p.types || '').split(',').filter(Boolean))],
    author: String(p.author || '').split(/\s+/)[0], copies: p.copies, mine: p.teacher_id === teacherId,
  });

  route('GET', '/api/library', async (ctx) => {
    const teacher = requireTeacher(ctx);
    return { items: [...READY_PATHS.map(readyItem), ...(await q.library.all()).map((p) => libraryItem(p, teacher.id))] };
  });

  // A library entry: a ready-made path of the site ("site-<slug>") or a path a teacher shared (its id).
  // Returns { title, description, theme (object), tasks (validated task objects), row? }.
  async function libraryEntry(id) {
    const ready = READY_PATHS.find((x) => `site-${x.slug}` === id);
    if (ready) return { ...ready, tasks: ready.tasks };
    const p = /^\d+$/.test(id) ? await q.pathById.get(Number(id)) : null;
    if (!p || !p.shared) throw new HttpError(404, 'המסלול לא נמצא בספרייה');
    return {
      title: p.title, description: p.description, theme: v.theme(JSON.parse(p.theme)), row: p,
      tasks: (await q.tasks.all(p.id)).map((t) => ({
        type: t.type, title: t.title, emoji: t.emoji, estMinutes: t.est_minutes,
        needsApproval: Boolean(t.needs_approval), content: JSON.parse(t.content),
      })),
    };
  }

  route('GET', '/api/library/:id', async (ctx) => {
    requireTeacher(ctx);
    const e = await libraryEntry(ctx.params.id);
    return { title: e.title, description: e.description, theme: e.theme, tasks: e.tasks.map((t, i) => ({ id: i + 1, ...t })) };
  });

  route('POST', '/api/library/:id/copy', async (ctx) => {
    const teacher = requireTeacher(ctx);
    const e = await libraryEntry(ctx.params.id);
    const id = await tx(db, async () => {
      await charge(teacher.id, 'createPath', e.title);
      const r = await insertPath(teacher.id, e.title, e.description, await newCode(), JSON.stringify(e.theme));
      const newId = Number(r.lastInsertRowid);
      for (const t of e.tasks) await insertTask(newId, structuredClone(t));
      if (e.row && e.row.teacher_id !== teacher.id) await q.addCopy.run(e.row.id);
      return newId;
    });
    return [201, { path: pathOut(await q.pathById.get(id)), credits: await availableCredits(teacher.id) }];
  });

  route('POST', '/api/students/:id/reset-secret', async (ctx) => {
    const s = await q.studentById.get(Number(ctx.params.id));
    if (!s) throw new HttpError(404, 'התלמיד לא נמצא');
    await ownPath(ctx, s.path_id);
    await q.setSecret.run(null, s.id);
    return { ok: true };
  });

  route('GET', '/api/s/:code/me', async (ctx) => {
    const p = await publicPath(ctx, ctx.params.code);
    const s = await currentStudent(ctx.req, p);
    await q.touchStudent.run(s.id);
    return await studentState(s);
  });

  route('POST', '/api/s/:code/mood', async (ctx) => {
    const p = await publicPath(ctx, ctx.params.code);
    assertOpen(p);
    const s = await currentStudent(ctx.req, p);
    const { kind, mood } = moodInput(ctx.body);
    await q.addMood.run(s.id, kind, mood, Date.now());
    return { moods: await latestMoods(s.id) };
  });

  // Grade without saving (used by teacher preview).
  route('POST', '/api/s/:code/tasks/:taskId/check', async (ctx) => {
    const p = await publicPath(ctx, ctx.params.code);
    const { correct, explanation, wrong } = gradeAnswer(await studentTask(p, ctx.params.taskId), ctx.body);
    return correct ? { correct, explanation: explanation || '' } : { correct, wrong: wrong || [] };
  });

  route('POST', '/api/s/:code/tasks/:taskId/complete', async (ctx) => {
    const p = await publicPath(ctx, ctx.params.code);
    assertOpen(p);
    const s = await currentStudent(ctx.req, p);
    const t = await studentTask(p, ctx.params.taskId);
    const { correct, answer, explanation, wrong } = gradeAnswer(t, ctx.body);
    await q.touchStudent.run(s.id);
    if (!correct) {
      await q.wrongAttempt.run(s.id, t.id, Date.now());
      return { correct: false, wrong: wrong || [] };
    }
    await q.upsertProgress.run(s.id, t.id, answer == null ? null : JSON.stringify(answer), t.needs_approval ? 0 : 1);
    const opened = await q.attempt.get(s.id, t.id);
    // Time on task, from first opening it; capped so a tab left open overnight doesn't count.
    if (opened) await q.setDuration.run(Math.min(3 * 3600, Math.round((Date.now() - opened.opened_at) / 1000)), s.id, t.id);
    await q.resolveHelpForTask.run(s.id, t.id);
    return { correct: true, explanation: explanation || '', ...(await studentState(s)) };
  });

  // A student's spoken answer, photo of their work or drawing. Counts toward the teacher's storage.
  route('POST', '/api/s/:code/media', async (ctx) => {
    const p = await publicPath(ctx, ctx.params.code);
    assertOpen(p);
    const s = await currentStudent(ctx.req, p);
    await uploadLimit(`${s.id}`);
    const buf = Buffer.from(typeof ctx.body.data === 'string' ? ctx.body.data : '', 'base64');
    if (!buf.length) throw new HttpError(400, 'הקובץ ריק');
    if (buf.length > 4 * 1024 * 1024) throw new HttpError(413, 'הקובץ גדול מדי');
    const mime = sniffMedia(buf);
    if (!mime || mime === 'image/gif') throw new HttpError(400, 'אפשר לשלוח הקלטה או תמונה');
    if ((await q.mediaUsage.get(p.teacher_id)).total + buf.length > MEDIA_QUOTA_BYTES) {
      throw new HttpError(413, 'אין מקום להקלטות כרגע. ספרו למורה.');
    }
    const id = crypto.randomBytes(16).toString('hex');
    await saveMedia(id, p.teacher_id, mime, buf);
    return [201, { url: `/api/media/${id}` }];
  }, { maxBody: 6 * 1024 * 1024 });

  route('POST', '/api/s/:code/tasks/:taskId/open', async (ctx) => {
    const p = await publicPath(ctx, ctx.params.code);
    const s = await currentStudent(ctx.req, p);
    await q.openTask.run(s.id, (await studentTask(p, ctx.params.taskId)).id, Date.now());
    return { ok: true };
  });

  // The teacher types the path's approval code on the student's screen.
  route('POST', '/api/s/:code/tasks/:taskId/approve', async (ctx) => {
    const p = await publicPath(ctx, ctx.params.code);
    const s = await currentStudent(ctx.req, p);
    const t = await studentTask(p, ctx.params.taskId);
    await pinLimit(`${s.id}`);
    const given = typeof ctx.body.pin === 'string' ? ctx.body.pin : '';
    if (given !== p.approval_pin) throw new HttpError(403, 'הקוד לא נכון');
    if (!await q.progressRow.get(s.id, t.id)) throw new HttpError(400, 'המשימה עוד לא הושלמה');
    await decide(s.id, t.id, ctx.body.decision);
    return await studentState(s);
  });

  route('POST', '/api/s/:code/tasks/:taskId/undo', async (ctx) => {
    const p = await publicPath(ctx, ctx.params.code);
    const s = await currentStudent(ctx.req, p);
    const t = await studentTask(p, ctx.params.taskId);
    await q.deleteProgress.run(s.id, t.id);
    return await studentState(s);
  });

  route('POST', '/api/s/:code/tasks/:taskId/help', async (ctx) => {
    const p = await publicPath(ctx, ctx.params.code);
    assertOpen(p);
    const s = await currentStudent(ctx.req, p);
    const t = await studentTask(p, ctx.params.taskId);
    if (!(await q.openHelpForStudent.all(s.id)).some((r) => r.task_id === t.id)) await q.insertHelp.run(s.id, t.id);
    return await studentState(s);
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

  // Runs a queued generation job (from the background function). Safe to call twice.
  async function runJob(id) {
    const job = await q.claimJob.get(Date.now(), String(id));
    if (!job) return;
    const taken = JSON.parse(job.taken);
    try {
      const result = await generateInto(job.teacher_id, JSON.parse(job.input), taken);
      await q.finishJob.run('done', JSON.stringify(result), null, null, Date.now(), job.id);
    } catch (err) {
      // generateInto already refunded the credits.
      const known = err instanceof HttpError;
      if (!known) console.error(err);
      await q.finishJob.run('failed', null, known ? err.message : 'שגיאה ביצירת המסלול. הקרדיטים הוחזרו, נסו שוב.', known ? err.status : 500, Date.now(), job.id);
    }
  }

  const handler = async function handler(req, res) {
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
        const m = await q.mediaById.get(media[1]);
        if (m && !m.data && mediaStore) m.data = await mediaStore.get(media[1]);
        if (!m?.data) throw new HttpError(404, 'הקובץ לא נמצא');
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
          teacher: await currentTeacher(req),
          ip: req.socket.remoteAddress,
        };
        const out = await r.handler(ctx);
        if (Array.isArray(out)) return send(res, out[0], out[1], out[2]);
        return send(res, 200, out);
      }
      throw new HttpError(404, 'לא נמצא');
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message, ...(err.code ? { code: err.code } : {}) });
      if (err?.code === '23505') return send(res, 409, { error: 'הערך כבר קיים' }); // Postgres: unique violation
      console.error(err);
      send(res, 500, { error: 'שגיאת שרת' });
    }
  };
  handler.runJob = runJob;
  return handler;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  // DATABASE_URL: a Postgres server. Otherwise a local Postgres (PGlite) kept in data/pg.
  const dbDir = process.env.DB_FILE || path.join(APP_DIR, 'data', 'pg');
  if (!process.env.DATABASE_URL) fs.mkdirSync(dbDir, { recursive: true });
  const db = openDb(process.env.DATABASE_URL ? { url: process.env.DATABASE_URL } : dbDir);
  const port = Number(process.env.PORT) || 3000;
  const server = http.createServer(createApp(db));
  server.requestTimeout = 15 * 60 * 1000; // AI generation can take a few minutes
  server.listen(port, () => {
    console.log(`מסלולי למידה פועל: http://localhost:${port}`);
  });
}
