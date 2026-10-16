// The demo's "server": the same API as server.js, answered inside the browser.
// Validation, grading and AI-output handling come from the same modules the real server uses.
import * as v from '../validate.js';
import { HttpError } from '../validate.js';
import { TEMPLATES } from '../templates.js';
import { studentContent, gradeAnswer, parseAiInput, pathFromAi, randomPin } from '../logic.js';
import { SYSTEM_PROMPT, GRADES, AI_TASK_TYPES, buildRequestText, jsonFormatInstructions } from '../ai-prompt.js';
import { docxToText } from '../docx.js';
import * as billing from '../billing.js';
import { openStore } from './store.js';
import { toast } from './ui.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_SOURCE_CHARS = 120_000; // keeps the whole prompt well under the 256 KiB sample limit

// The demo has no real payments: subscribing is the same test mode the server offers.
const BILLING = { ...billing.BILLING_DEFAULTS, paymentsMode: 'test' };

let store;
let meta;
const paths = new Map(); // id -> path record (with tasks, students, progress, help)

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const randomIndex = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
const clone = (x) => JSON.parse(JSON.stringify(x));

function newId() {
  const id = meta.nextId++;
  store.save('meta', meta);
  return id;
}

function newCode() {
  const used = new Set([...paths.values()].map((p) => p.code));
  let code;
  do code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomIndex(CODE_ALPHABET.length)]).join('');
  while (used.has(code));
  return code;
}

function save(p, { touch = true } = {}) {
  if (touch) p.updatedAt = now();
  store.save(`path-${p.id}`, p);
}

function createPath({ title, description = '', theme = v.THEME_DEFAULTS, tasks = [], published = false }) {
  const p = {
    id: newId(), title, description, code: newCode(), theme: clone(theme), published, approvalPin: randomPin(),
    createdAt: now(), updatedAt: now(), tasks: [], students: [], progress: {}, help: [],
  };
  for (const t of tasks) p.tasks.push({ id: newId(), ...clone(t) });
  paths.set(p.id, p);
  save(p);
  return p;
}

const ready = (async () => {
  store = await openStore(() => toast('השמירה נכשלה. בדקי את החיבור לאינטרנט.', 'error'));
  meta = store.docs.meta || { nextId: 1 };
  for (const [id, body] of Object.entries(store.docs)) {
    if (id.startsWith('path-')) paths.set(body.id, { approvalPin: randomPin(), ...body });
  }
  // Visitors from before credits existed start with the same free credits as new ones.
  if (!meta.account) {
    meta.account = billing.newAccount(BILLING);
    meta.ledger = [{ delta: BILLING.freeCredits, action: 'signup', note: '', at: now() }];
    store.save('meta', meta);
  }
  // First visit: open on a ready-made example instead of an empty screen (free).
  if (!meta.seeded) {
    const t = TEMPLATES.sample;
    createPath({ title: 'דוגמה: הצב והארנב', description: t.description, tasks: t.tasks.map((x) => v.task(x)), published: true });
    meta.seeded = true;
    store.save('meta', meta);
  }
})();

// ---------- credits ----------

function record(delta, action, note = '') {
  meta.ledger = [{ delta, action, note: note.slice(0, 200), at: now() }, ...(meta.ledger || [])].slice(0, 30);
  store.save('meta', meta);
}

function charge(action, note) {
  const taken = billing.spend(meta.account, action, BILLING);
  record(-taken.cost, action, note);
  return taken;
}

const credits = () => billing.available(billing.refresh(meta.account));

const billingOut = () => ({
  ...billing.summary(meta.account, BILLING),
  paymentsMode: BILLING.paymentsMode,
  history: (meta.ledger || []).map((x) => ({ ...x, label: billing.ACTION_LABELS[x.action] || x.action })),
});

// ---------- serializers ----------

const teacher = () => ({ id: 1, name: meta.teacherName || 'מורה', email: '' });

const pathOut = (p) => ({
  id: p.id, title: p.title, description: p.description, code: p.code,
  theme: v.theme(p.theme), published: p.published, approvalPin: p.approvalPin, createdAt: p.createdAt, updatedAt: p.updatedAt,
});

const taskOut = (t, forStudent = false) => ({
  id: t.id, type: t.type, title: t.title, emoji: t.emoji, estMinutes: t.estMinutes, needsApproval: Boolean(t.needsApproval),
  content: forStudent ? studentContent(t.type, clone(t.content)) : clone(t.content),
});

function getPath(id) {
  const p = paths.get(Number(id));
  if (!p) throw new HttpError(404, 'המסלול לא נמצא');
  return p;
}

function findTask(id) {
  for (const p of paths.values()) {
    const t = p.tasks.find((x) => x.id === Number(id));
    if (t) return { p, t };
  }
  throw new HttpError(404, 'המשימה לא נמצאה');
}

function byCode(code) {
  const p = [...paths.values()].find((x) => x.code === String(code).toUpperCase());
  if (!p) throw new HttpError(404, 'לא מצאנו מסלול עם הקוד הזה');
  return p;
}

function student(p, headers) {
  const s = p.students.find((x) => x.token === headers['X-Student-Token']);
  if (!s) throw new HttpError(401, 'צריך להצטרף למסלול מחדש');
  s.lastActive = now();
  return s;
}

function studentTask(p, id) {
  const t = p.tasks.find((x) => x.id === Number(id));
  if (!t) throw new HttpError(404, 'המשימה לא נמצאה');
  return t;
}

// done: approved (or never needed approval); pending: finished, waiting for the teacher.
function studentState(p, s) {
  const done = {};
  const pending = [];
  for (const [taskId, d] of Object.entries(p.progress[s.id] || {})) {
    if (d.approved === false) pending.push(Number(taskId));
    else done[taskId] = { answer: d.answer, completedAt: d.completedAt };
  }
  return { student: { id: s.id, name: s.name }, done, pending, help: p.help.filter((h) => h.studentId === s.id && !h.resolved).map((h) => h.taskId) };
}

// The teacher's decision on a pending task: approve, or send it back to redo.
function decide(p, s, t, decision) {
  const d = p.progress[s.id]?.[t.id];
  if (!d) throw new HttpError(400, 'המשימה עוד לא הושלמה');
  if (decision === 'redo') delete p.progress[s.id][t.id];
  else if (decision === 'approve') d.approved = true;
  else throw new HttpError(400, 'החלטה לא תקינה');
  for (const h of p.help) if (h.studentId === s.id && h.taskId === t.id) h.resolved = true;
  save(p, { touch: false });
}

// ---------- AI generator (through the viewer's own Claude account) ----------

let samplePromise;
const getSample = () => (samplePromise ||= (async () => {
  try {
    return window.claude?.use ? await window.claude.use('sample') : null;
  } catch {
    return null;
  }
})());

const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readFiles(files) {
  const texts = [];
  const images = [];
  for (const f of files.slice(0, 5)) {
    const name = String(f?.name || 'קובץ');
    const type = String(f?.type || '');
    const bytes = b64ToBytes(String(f?.data || ''));
    if (type === 'application/pdf' || /\.pdf$/i.test(name)) {
      throw new HttpError(400, `בגרסת ההדגמה אי אפשר לצרף PDF ("${name}"). אפשר לצרף Word, תמונה או טקסט.`);
    } else if (IMAGE_TYPES.includes(type)) {
      images.push(new Blob([bytes], { type }));
    } else if (type === DOCX_TYPE || /\.docx$/i.test(name)) {
      try {
        texts.push({ name, text: await docxToText(bytes, inflateRaw) });
      } catch {
        throw new HttpError(400, `לא הצלחנו לקרוא את הקובץ "${name}"`);
      }
    } else if (type.startsWith('text/') || /\.(txt|md|csv)$/i.test(name)) {
      texts.push({ name, text: new TextDecoder().decode(bytes) });
    } else {
      throw new HttpError(400, `סוג הקובץ "${name}" לא נתמך.`);
    }
  }
  return { texts, images, names: files.map((f) => String(f?.name || 'קובץ')) };
}

const SAMPLE_ERRORS = {
  not_granted: [403, 'כדי להשתמש במחולל צריך לאשר ל-claude.ai להשתמש ב-Claude בעמוד הזה.'],
  sampling_disabled: [403, 'Claude לא זמין בחשבון הזה.'],
  rate_limited: [429, 'הגעת למגבלת השימוש ב-Claude כרגע. נסי שוב מאוחר יותר.'],
  refused: [422, 'המחולל לא יכול ליצור מסלול לבקשה הזו. נסי לנסח את הנושא אחרת.'],
  invalid_json: [502, 'המחולל החזיר תשובה לא תקינה. נסי שוב.'],
  prompt_too_large: [400, 'החומרים ארוכים מדי. נסי קבצים קצרים יותר.'],
  images_unavailable: [400, 'בתצוגה הזו אי אפשר לשלוח תמונות. נסי בלי תמונות.'],
  image_rejected: [400, 'אחת התמונות לא נקראה. נסי תמונה אחרת.'],
  session_expired: [401, 'צריך להתחבר שוב ל-claude.ai.'],
};

async function generate(body) {
  const sample = await getSample();
  if (!sample) throw new HttpError(503, 'המחולל זמין כשפותחים את ההדגמה ב-claude.ai כשאת מחוברת לחשבון.');
  const input = parseAiInput(body);
  const taken = charge('aiGenerate', input.topic);
  try {
    return await generateWith(sample, input);
  } catch (err) {
    billing.refund(meta.account, taken);
    record(taken.cost, 'refund', input.topic);
    throw err;
  }
}

async function generateWith(sample, input) {
  const { texts, images, names } = await readFiles(input.files);
  let budget = MAX_SOURCE_CHARS;
  const sources = texts.map((f) => {
    const text = f.text.slice(0, Math.max(0, budget));
    budget -= text.length;
    return `<document name="${f.name.replace(/"/g, '')}">\n${text}\n</document>`;
  });
  const prompt = [
    SYSTEM_PROMPT,
    jsonFormatInstructions(input.types),
    ...sources,
    images.length ? `${images.length} image(s) from the teacher's material are attached.` : '',
    buildRequestText({ ...input, fileNames: names }),
  ].filter(Boolean).join('\n\n');

  let raw;
  try {
    raw = await sample.json(prompt, { modelTier: 'complex', cache: false, ...(images.length ? { images } : {}) });
  } catch (e) {
    const [status, message] = SAMPLE_ERRORS[e?.code] || [502, 'המחולל לא זמין כרגע. נסי שוב בעוד כמה דקות.'];
    throw new HttpError(status, message);
  }
  const { title, description, theme, tasks, skipped } = pathFromAi(raw, input);
  const p = createPath({ title, description, theme, tasks });
  return { path: pathOut(p), taskCount: tasks.length, skipped, credits: credits() };
}

// ---------- routes ----------

const routes = [];
const route = (method, pattern, handler) => {
  routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler });
};

route('GET', '/api/health', () => ({ ok: true }));
route('GET', '/api/auth/me', () => ({ teacher: { ...teacher(), credits: credits() }, costs: BILLING.costs }));

route('GET', '/api/billing', () => billingOut());
route('POST', '/api/billing/checkout', () => {
  billing.activate(meta.account, BILLING);
  record(BILLING.monthlyCredits, 'subscribe', 'מצב בדיקה – ללא חיוב');
  return billingOut();
});
route('POST', '/api/billing/cancel', () => {
  if (meta.account.subStatus !== 'active') throw new HttpError(400, 'אין מנוי פעיל לביטול');
  billing.cancel(meta.account);
  record(0, 'cancel');
  return billingOut();
});
const signIn = ({ body }) => {
  if (typeof body.name === 'string' && body.name.trim()) {
    meta.teacherName = body.name.trim().slice(0, 80);
    store.save('meta', meta);
  }
  return { teacher: teacher() };
};
route('POST', '/api/auth/login', signIn);
route('POST', '/api/auth/register', signIn);
route('POST', '/api/auth/logout', () => ({ ok: true }));

route('GET', '/api/paths', () => ({
  paths: [...paths.values()]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id)
    .map((p) => ({
      ...pathOut(p), taskCount: p.tasks.length, studentCount: p.students.length,
      openHelp: p.help.filter((h) => !h.resolved).length,
      pendingApproval: Object.values(p.progress).reduce((n, byTask) => n + Object.values(byTask).filter((d) => d.approved === false).length, 0),
    })),
}));

route('POST', '/api/paths', ({ body }) => {
  const title = v.str(body.title, { max: 120, required: true, field: 'שם המסלול' });
  const t = TEMPLATES[body.template] || TEMPLATES.empty;
  const tasks = t.tasks.map((x) => v.task(x));
  charge('createPath', title);
  return { path: pathOut(createPath({ title, description: t.description, tasks })), credits: credits() };
});

route('GET', '/api/paths/:id', ({ params }) => {
  const p = getPath(params.id);
  return { path: pathOut(p), tasks: p.tasks.map((t) => taskOut(t)) };
});

route('PUT', '/api/paths/:id', ({ params, body }) => {
  const p = getPath(params.id);
  const next = { ...p };
  if (body.title !== undefined) next.title = v.str(body.title, { max: 120, required: true, field: 'שם המסלול' });
  if (body.description !== undefined) next.description = v.str(body.description, { max: 1000, field: 'תיאור' });
  if (body.theme !== undefined) next.theme = v.theme(body.theme, p.theme);
  if (body.published !== undefined) next.published = Boolean(body.published);
  Object.assign(p, next);
  save(p);
  return { path: pathOut(p) };
});

route('DELETE', '/api/paths/:id', ({ params }) => {
  const p = getPath(params.id);
  paths.delete(p.id);
  store.remove(`path-${p.id}`);
  return { ok: true };
});

route('POST', '/api/paths/:id/duplicate', ({ params }) => {
  const p = getPath(params.id);
  const title = `${p.title} (עותק)`.slice(0, 120);
  charge('createPath', title);
  const copy = createPath({ title, description: p.description, theme: p.theme, tasks: p.tasks.map(({ id, ...t }) => t) });
  return { path: pathOut(copy), credits: credits() };
});

route('POST', '/api/paths/:id/tasks', ({ params, body }) => {
  const p = getPath(params.id);
  const t = { id: newId(), ...v.task(body) };
  p.tasks.push(t);
  save(p);
  return { task: taskOut(t) };
});

route('PUT', '/api/paths/:id/order', ({ params, body }) => {
  const p = getPath(params.id);
  const ids = Array.isArray(body.taskIds) ? body.taskIds.map(Number) : [];
  const current = p.tasks.map((t) => t.id);
  if (ids.length !== current.length || new Set(ids).size !== ids.length || !ids.every((id) => current.includes(id))) {
    throw new HttpError(400, 'סדר משימות לא תקין');
  }
  p.tasks = ids.map((id) => p.tasks.find((t) => t.id === id));
  save(p);
  return { tasks: p.tasks.map((t) => taskOut(t)) };
});

route('PUT', '/api/tasks/:id', ({ params, body }) => {
  const { p, t } = findTask(params.id);
  Object.assign(t, v.task(body));
  save(p);
  return { task: taskOut(t) };
});

route('DELETE', '/api/tasks/:id', ({ params }) => {
  const { p, t } = findTask(params.id);
  p.tasks = p.tasks.filter((x) => x !== t);
  for (const done of Object.values(p.progress)) delete done[t.id];
  p.help = p.help.filter((h) => h.taskId !== t.id);
  save(p);
  return { ok: true };
});

route('GET', '/api/paths/:id/progress', ({ params }) => {
  const p = getPath(params.id);
  return {
    tasks: p.tasks.map((t) => taskOut(t)),
    students: p.students.map((s) => ({
      id: s.id, name: s.name, joinedAt: s.createdAt, lastActive: s.lastActive,
      done: Object.fromEntries(Object.entries(p.progress[s.id] || {}).map(([k, d]) => [k, { ...d, approved: d.approved !== false }])),
    })).sort((a, b) => a.name.localeCompare(b.name, 'he')),
    help: p.help.filter((h) => !h.resolved).map(({ id, studentId, taskId, createdAt }) => ({ id, studentId, taskId, createdAt })),
  };
});

route('DELETE', '/api/students/:id', ({ params }) => {
  for (const p of paths.values()) {
    const s = p.students.find((x) => x.id === Number(params.id));
    if (!s) continue;
    p.students = p.students.filter((x) => x !== s);
    delete p.progress[s.id];
    p.help = p.help.filter((h) => h.studentId !== s.id);
    save(p);
    return { ok: true };
  }
  throw new HttpError(404, 'התלמיד/ה לא נמצא/ה');
});

route('POST', '/api/help/:id/resolve', ({ params }) => {
  for (const p of paths.values()) {
    const h = p.help.find((x) => x.id === Number(params.id));
    if (!h) continue;
    h.resolved = true;
    save(p, { touch: false });
    return { ok: true };
  }
  throw new HttpError(404, 'הבקשה לא נמצאה');
});

route('GET', '/api/ai/status', async () => ({ enabled: Boolean(await getSample()), grades: GRADES, types: AI_TASK_TYPES }));
route('POST', '/api/ai/generate', ({ body }) => generate(body));

// --- student side ---

route('GET', '/api/s/:code', ({ params }) => {
  const p = byCode(params.code);
  return {
    path: { title: p.title, description: p.description, code: p.code, theme: v.theme(p.theme), published: p.published },
    tasks: p.tasks.map((t) => taskOut(t, true)),
    // The demo's teacher plays the student on published paths; drafts open as a preview.
    preview: !p.published,
  };
});

route('POST', '/api/s/:code/join', ({ params, body }) => {
  const p = byCode(params.code);
  const name = v.str(body.name, { max: 40, required: true, field: 'שם' });
  let s = p.students.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!s) {
    s = { id: newId(), name, token: token(), createdAt: now(), lastActive: now() };
    p.students.push(s);
  }
  s.lastActive = now();
  save(p, { touch: false });
  return { token: s.token, ...studentState(p, s) };
});

route('GET', '/api/s/:code/me', ({ params, headers }) => {
  const p = byCode(params.code);
  return studentState(p, student(p, headers));
});

route('POST', '/api/s/:code/tasks/:taskId/check', ({ params, body }) => {
  const t = studentTask(byCode(params.code), params.taskId);
  const { correct, explanation, wrong } = gradeAnswer(t.type, t.content, body);
  return correct ? { correct, explanation: explanation || '' } : { correct, wrong: wrong || [] };
});

route('POST', '/api/s/:code/tasks/:taskId/complete', ({ params, body, headers }) => {
  const p = byCode(params.code);
  const s = student(p, headers);
  const t = studentTask(p, params.taskId);
  const { correct, answer, explanation, wrong } = gradeAnswer(t.type, t.content, body);
  if (!correct) {
    save(p, { touch: false });
    return { correct: false, wrong: wrong || [] };
  }
  const before = p.progress[s.id]?.[t.id];
  // Redoing an approved task keeps it approved.
  const approved = !t.needsApproval || Boolean(before && before.approved !== false);
  (p.progress[s.id] ||= {})[t.id] = { answer: answer ?? null, completedAt: now(), approved };
  for (const h of p.help) if (h.studentId === s.id && h.taskId === t.id) h.resolved = true;
  save(p, { touch: false });
  return { correct: true, explanation: explanation || '', ...studentState(p, s) };
});

const pinTries = new Map(); // student id -> recent attempt times
route('POST', '/api/s/:code/tasks/:taskId/approve', ({ params, body, headers }) => {
  const p = byCode(params.code);
  const s = student(p, headers);
  const t = studentTask(p, params.taskId);
  const tries = (pinTries.get(s.id) || []).filter((x) => Date.now() - x < 10 * 60 * 1000);
  tries.push(Date.now());
  pinTries.set(s.id, tries);
  if (tries.length > 8) throw new HttpError(429, 'יותר מדי ניסיונות, נסו שוב בעוד כמה דקות');
  if (body.pin !== p.approvalPin) throw new HttpError(403, 'הקוד לא נכון');
  decide(p, s, t, body.decision);
  return studentState(p, s);
});

route('POST', '/api/students/:id/tasks/:taskId/decision', ({ params, body }) => {
  for (const p of paths.values()) {
    const s = p.students.find((x) => x.id === Number(params.id));
    if (!s) continue;
    decide(p, s, studentTask(p, params.taskId), body.decision);
    return { ok: true };
  }
  throw new HttpError(404, 'התלמיד/ה לא נמצא/ה');
});

route('PUT', '/api/paths/:id/pin', ({ params, body }) => {
  const p = getPath(params.id);
  p.approvalPin = body.pin === undefined ? randomPin() : v.pin(body.pin);
  save(p, { touch: false });
  return { path: pathOut(p) };
});

route('POST', '/api/s/:code/tasks/:taskId/undo', ({ params, headers }) => {
  const p = byCode(params.code);
  const s = student(p, headers);
  delete p.progress[s.id]?.[studentTask(p, params.taskId).id];
  save(p, { touch: false });
  return studentState(p, s);
});

route('POST', '/api/s/:code/tasks/:taskId/help', ({ params, headers }) => {
  const p = byCode(params.code);
  const s = student(p, headers);
  const t = studentTask(p, params.taskId);
  if (!p.help.some((h) => h.studentId === s.id && h.taskId === t.id && !h.resolved)) {
    p.help.push({ id: newId(), studentId: s.id, taskId: t.id, createdAt: now(), resolved: false });
  }
  save(p, { touch: false });
  return studentState(p, s);
});

// ---------- the fetch stand-in ----------

export async function api(method, url, body, headers = {}) {
  await ready;
  const pathname = url.split('?')[0];
  try {
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(pathname);
      if (!m) continue;
      const out = await r.handler({ params: m.groups || {}, body: body ? clone(body) : {}, headers });
      return clone(out);
    }
    throw new HttpError(404, 'לא נמצא');
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(err);
    throw Object.assign(new Error(err instanceof HttpError ? err.message : 'משהו השתבש'), { status: err.status || 500, code: err.code });
  }
}
