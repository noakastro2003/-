import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb, tx } from './db.js';
import * as v from './validate.js';
import { HttpError } from './validate.js';
import { TEMPLATES } from './templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_MS = 30 * 24 * 3600 * 1000;
const MAX_BODY = 256 * 1024;
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

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffles, but never hands back the original order (when that is possible).
function shuffleChanged(list) {
  const unique = new Set(list).size > 1;
  let a;
  do a = shuffle(list); while (unique && a.every((x, i) => x === list[i]));
  return a;
}

// Turns a task's content into what a student may see: answers stay on the server.
function studentContent(type, c) {
  switch (type) {
    case 'choice': {
      const { correct, explanation, ...rest } = c;
      return rest;
    }
    case 'matching':
      return { text: c.text, left: c.pairs.map((p) => p.a), right: shuffle(c.pairs.map((p) => p.b)) };
    case 'order':
      return { text: c.text, items: shuffleChanged(c.items) };
    case 'blanks': {
      const { segments, answers } = v.parseBlanks(c.passage);
      return { text: c.text, segments, bank: shuffle([...answers, ...c.distractors]) };
    }
    case 'truefalse':
      return { text: c.text, statements: c.statements.map((x) => x.s) };
    default:
      return c;
  }
}

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

async function readJson(req) {
  if (req.method === 'GET' || req.method === 'DELETE') return {};
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'הבקשה גדולה מדי');
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

export function createApp(db) {
  const loginLimit = rateLimiter(10, 15 * 60 * 1000);
  const joinLimit = rateLimiter(60, 15 * 60 * 1000);

  const q = {
    teacherByEmail: db.prepare('SELECT * FROM teachers WHERE email = ?'),
    insertTeacher: db.prepare('INSERT INTO teachers (name, email, password_hash) VALUES (?, ?, ?)'),
    session: db.prepare(`SELECT t.id, t.name, t.email FROM sessions s JOIN teachers t ON t.id = s.teacher_id
                         WHERE s.token = ? AND s.expires_at > ?`),
    insertSession: db.prepare('INSERT INTO sessions (token, teacher_id, expires_at) VALUES (?, ?, ?)'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),

    listPaths: db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM tasks WHERE path_id = p.id) AS task_count,
                             (SELECT COUNT(*) FROM students WHERE path_id = p.id) AS student_count,
                             (SELECT COUNT(*) FROM help_requests h JOIN students s ON s.id = h.student_id
                               WHERE s.path_id = p.id AND h.resolved = 0) AS open_help
                           FROM paths p WHERE teacher_id = ? ORDER BY updated_at DESC, id DESC`),
    pathById: db.prepare('SELECT * FROM paths WHERE id = ?'),
    pathByCode: db.prepare('SELECT * FROM paths WHERE code = ?'),
    codeExists: db.prepare('SELECT 1 FROM paths WHERE code = ?'),
    insertPath: db.prepare('INSERT INTO paths (teacher_id, title, description, code, theme) VALUES (?, ?, ?, ?, ?)'),
    updatePath: db.prepare(`UPDATE paths SET title = ?, description = ?, theme = ?, published = ?,
                            updated_at = datetime('now') WHERE id = ?`),
    touchPath: db.prepare("UPDATE paths SET updated_at = datetime('now') WHERE id = ?"),
    deletePath: db.prepare('DELETE FROM paths WHERE id = ?'),

    tasks: db.prepare('SELECT * FROM tasks WHERE path_id = ? ORDER BY position, id'),
    taskById: db.prepare('SELECT * FROM tasks WHERE id = ?'),
    maxPos: db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM tasks WHERE path_id = ?'),
    insertTask: db.prepare(`INSERT INTO tasks (path_id, position, type, title, emoji, est_minutes, content)
                            VALUES (?, ?, ?, ?, ?, ?, ?)`),
    updateTask: db.prepare('UPDATE tasks SET type = ?, title = ?, emoji = ?, est_minutes = ?, content = ? WHERE id = ?'),
    setPos: db.prepare('UPDATE tasks SET position = ? WHERE id = ?'),
    deleteTask: db.prepare('DELETE FROM tasks WHERE id = ?'),

    studentByToken: db.prepare('SELECT * FROM students WHERE token = ?'),
    studentByName: db.prepare('SELECT * FROM students WHERE path_id = ? AND name = ?'),
    studentById: db.prepare('SELECT * FROM students WHERE id = ?'),
    insertStudent: db.prepare('INSERT INTO students (path_id, name, token) VALUES (?, ?, ?)'),
    touchStudent: db.prepare("UPDATE students SET last_active = datetime('now') WHERE id = ?"),
    deleteStudent: db.prepare('DELETE FROM students WHERE id = ?'),
    studentsOfPath: db.prepare('SELECT id, name, created_at, last_active FROM students WHERE path_id = ? ORDER BY name'),

    progressOfStudent: db.prepare('SELECT task_id, answer, completed_at FROM progress WHERE student_id = ?'),
    progressOfPath: db.prepare(`SELECT p.student_id, p.task_id, p.answer, p.completed_at FROM progress p
                                JOIN students s ON s.id = p.student_id WHERE s.path_id = ?`),
    upsertProgress: db.prepare(`INSERT INTO progress (student_id, task_id, answer) VALUES (?, ?, ?)
                                ON CONFLICT (student_id, task_id) DO UPDATE SET answer = excluded.answer,
                                completed_at = datetime('now')`),
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
    return { id: t.id, type: t.type, title: t.title, emoji: t.emoji, estMinutes: t.est_minutes, content };
  };

  const pathOut = (p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    code: p.code,
    theme: v.theme(JSON.parse(p.theme)),
    published: Boolean(p.published),
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

  function insertTask(pathId, t) {
    const pos = q.maxPos.get(pathId).m + 1;
    const r = q.insertTask.run(pathId, pos, t.type, t.title, t.emoji, t.estMinutes, JSON.stringify(t.content));
    return q.taskById.get(Number(r.lastInsertRowid));
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

  // Validates a student's answer for a task. Returns { correct, answer, wrong? } where
  // answer is what gets stored and wrong lists the indices to fix; throws when incomplete.
  function gradeAnswer(t, body) {
    const content = JSON.parse(t.content);
    const list = (n) => {
      if (!Array.isArray(body.answer) || body.answer.length !== n) throw new HttpError(400, 'צריך להשלים את כל החלקים');
      return body.answer;
    };
    const graded = (answer, expected, same = (a, b) => a === b) => {
      const wrong = expected.map((e, i) => (same(answer[i], e) ? -1 : i)).filter((i) => i >= 0);
      return { correct: wrong.length === 0, answer, wrong };
    };
    const sameWord = (a, b) => typeof a === 'string' && v.normalizeWord(a) === v.normalizeWord(b);
    switch (t.type) {
      case 'matching':
        return graded(list(content.pairs.length), content.pairs.map((p) => p.b), sameWord);
      case 'order':
        return graded(list(content.items.length), content.items, sameWord);
      case 'blanks': {
        const { answers } = v.parseBlanks(content.passage);
        return graded(list(answers.length), answers, sameWord);
      }
      case 'truefalse':
        return graded(list(content.statements.length), content.statements.map((x) => x.t));
      case 'choice': {
        const choice = v.int(body.answer, { min: 0, max: content.options.length - 1, def: -1 });
        if (choice < 0) throw new HttpError(400, 'צריך לבחור תשובה');
        return { correct: choice === content.correct, answer: choice, explanation: content.explanation };
      }
      case 'question': {
        const text = v.str(body.answer, { max: 5000, required: true, field: 'תשובה' });
        return { correct: true, answer: text };
      }
      case 'checklist': {
        const ticked = Array.isArray(body.answer) ? body.answer : [];
        if (ticked.length < content.items.length || !content.items.every((_, i) => ticked[i] === true)) {
          throw new HttpError(400, 'צריך לסמן את כל השלבים');
        }
        return { correct: true, answer: null };
      }
      default:
        return { correct: true, answer: null };
    }
  }

  function studentState(s) {
    const done = {};
    for (const r of q.progressOfStudent.all(s.id)) {
      done[r.task_id] = { answer: r.answer == null ? null : JSON.parse(r.answer), completedAt: r.completed_at };
    }
    const help = q.openHelpForStudent.all(s.id).map((r) => r.task_id);
    return { student: { id: s.id, name: s.name }, done, help };
  }

  // ----- routes -----

  const routes = [];
  const route = (method, pattern, handler) => {
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
    routes.push({ method, re, handler });
  };

  route('POST', '/api/auth/register', (ctx) => {
    const name = v.str(ctx.body.name, { max: 80, required: true, field: 'שם' });
    const mail = v.email(ctx.body.email);
    const pw = v.password(ctx.body.password);
    if (q.teacherByEmail.get(mail)) throw new HttpError(409, 'כבר קיים חשבון עם האימייל הזה');
    const r = q.insertTeacher.run(name, mail, hashPassword(pw));
    const id = Number(r.lastInsertRowid);
    return [201, { teacher: { id, name, email: mail } }, { 'Set-Cookie': startSession(ctx.req, id) }];
  });

  route('POST', '/api/auth/login', (ctx) => {
    const mail = v.email(ctx.body.email);
    loginLimit(mail);
    const pw = typeof ctx.body.password === 'string' ? ctx.body.password : '';
    const t = q.teacherByEmail.get(mail);
    const ok = checkPassword(pw, t ? t.password_hash : DUMMY_HASH) && t;
    if (!ok) throw new HttpError(401, 'אימייל או סיסמה שגויים');
    return [200, { teacher: { id: t.id, name: t.name, email: t.email } }, { 'Set-Cookie': startSession(ctx.req, t.id) }];
  });

  route('POST', '/api/auth/logout', (ctx) => {
    const token = parseCookies(ctx.req.headers.cookie).sid;
    if (token) q.deleteSession.run(token);
    return [200, { ok: true }, { 'Set-Cookie': sessionCookie(ctx.req, '', 0) }];
  });

  route('GET', '/api/auth/me', (ctx) => ({ teacher: ctx.teacher }));

  route('GET', '/api/paths', (ctx) => {
    const teacher = requireTeacher(ctx);
    return {
      paths: q.listPaths.all(teacher.id).map((p) => ({
        ...pathOut(p), taskCount: p.task_count, studentCount: p.student_count, openHelp: p.open_help,
      })),
    };
  });

  route('POST', '/api/paths', (ctx) => {
    const teacher = requireTeacher(ctx);
    const title = v.str(ctx.body.title, { max: 120, required: true, field: 'שם המסלול' });
    const template = TEMPLATES[ctx.body.template] || TEMPLATES.empty;
    const id = tx(db, () => {
      const r = q.insertPath.run(teacher.id, title, template.description, newCode(), JSON.stringify(v.THEME_DEFAULTS));
      const pathId = Number(r.lastInsertRowid);
      for (const t of template.tasks) insertTask(pathId, v.task(t));
      return pathId;
    });
    return [201, { path: pathOut(q.pathById.get(id)) }];
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
    const id = tx(db, () => {
      const r = q.insertPath.run(p.teacher_id, `${p.title} (עותק)`.slice(0, 120), p.description, newCode(), p.theme);
      const newId = Number(r.lastInsertRowid);
      for (const t of q.tasks.all(p.id)) {
        insertTask(newId, { type: t.type, title: t.title, emoji: t.emoji, estMinutes: t.est_minutes, content: JSON.parse(t.content) });
      }
      return newId;
    });
    return [201, { path: pathOut(q.pathById.get(id)) }];
  });

  route('POST', '/api/paths/:id/tasks', (ctx) => {
    const p = ownPath(ctx, ctx.params.id);
    const t = v.task(ctx.body);
    const row = insertTask(p.id, t);
    q.touchPath.run(p.id);
    return [201, { task: taskOut(row) }];
  });

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
    q.updateTask.run(t.type, t.title, t.emoji, t.estMinutes, JSON.stringify(t.content), existing.id);
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
      id: s.id, name: s.name, joinedAt: s.created_at, lastActive: s.last_active, done: {},
    }));
    const byId = new Map(students.map((s) => [s.id, s]));
    for (const r of q.progressOfPath.all(p.id)) {
      byId.get(r.student_id).done[r.task_id] = {
        answer: r.answer == null ? null : JSON.parse(r.answer), completedAt: r.completed_at,
      };
    }
    const help = q.helpOfPath.all(p.id).map((h) => ({
      id: h.id, studentId: h.student_id, taskId: h.task_id, createdAt: h.created_at,
    }));
    return { tasks: q.tasks.all(p.id).map((t) => taskOut(t)), students, help };
  });

  route('DELETE', '/api/students/:id', (ctx) => {
    const s = q.studentById.get(Number(ctx.params.id));
    if (!s) throw new HttpError(404, 'התלמיד/ה לא נמצא/ה');
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
    };
  });

  route('POST', '/api/s/:code/join', (ctx) => {
    const p = publicPath(ctx, ctx.params.code);
    joinLimit(ctx.ip);
    const name = v.str(ctx.body.name, { max: 40, required: true, field: 'שם' });
    let s = q.studentByName.get(p.id, name);
    if (!s) {
      q.insertStudent.run(p.id, name, crypto.randomBytes(24).toString('hex'));
      s = q.studentByName.get(p.id, name);
    }
    q.touchStudent.run(s.id);
    return { token: s.token, ...studentState(s) };
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
    if (!correct) return { correct: false, wrong: wrong || [] };
    q.upsertProgress.run(s.id, t.id, answer == null ? null : JSON.stringify(answer));
    q.resolveHelpForTask.run(s.id, t.id);
    return { correct: true, explanation: explanation || '', ...studentState(s) };
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
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(pathname);
        if (!m) continue;
        const ctx = {
          req,
          params: m.groups || {},
          body: await readJson(req),
          teacher: currentTeacher(req),
          ip: req.socket.remoteAddress,
        };
        const out = await r.handler(ctx);
        if (Array.isArray(out)) return send(res, out[0], out[1], out[2]);
        return send(res, 200, out);
      }
      throw new HttpError(404, 'לא נמצא');
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
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
  http.createServer(createApp(db)).listen(port, () => {
    console.log(`מסלולי למידה פועל: http://localhost:${port}`);
  });
}
