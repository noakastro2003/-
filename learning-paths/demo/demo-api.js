// The demo's "server": the same API as server.js, answered inside the browser.
// Validation, grading and AI-output handling come from the same modules the real server uses.
import * as v from '../validate.js';
import { HttpError } from '../validate.js';
import { TEMPLATES } from '../templates.js';
import READY_PATHS from '../content/library-data.js';
import { studentContent, gradeAnswer, parseAiInput, pathFromAi, taskFromAi, randomPin, secretString, SECRET_EMOJIS, AVATARS, GRADED_TYPES, keepTeacherParts, moodInput } from '../logic.js';
import { SYSTEM_PROMPT, GRADES, AI_TASK_TYPES, buildRequestText, jsonFormatInstructions, NIKUD_SYSTEM, improvePrompt } from '../ai-prompt.js';
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
  const used = new Set([...paths.values()].map((p) => p.code).concat((meta.classes || []).map((c) => c.code)));
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
  store = await openStore(() => toast('השמירה נכשלה. בדקו את החיבור לאינטרנט.', 'error'));
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

function charge(action, note, amount) {
  const taken = billing.spend(meta.account, action, BILLING, Date.now(), amount);
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
  opensAt: p.opensAt ?? null, closesAt: p.closesAt ?? null,
  shared: Boolean(p.shared), sharedGrade: p.sharedGrade || '', sharedSubject: p.sharedSubject || '',
});

const isClosed = (p) => Boolean(p.closesAt && Date.now() >= p.closesAt);
function assertOpen(p) {
  if (isClosed(p)) throw new HttpError(403, 'המסלול נסגר, אי אפשר להמשיך בו. אפשר לשאול את המורה.');
}
// Students only: a path with an opening time in the future is not shown yet.
function assertStarted(p) {
  if (p.published && p.opensAt && Date.now() < p.opensAt) {
    const when = new Date(p.opensAt).toLocaleString('he-IL', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    throw new HttpError(403, `המסלול ייפתח ב-${when}. מחכים לכם!`);
  }
}
function latestMoods(s) {
  const out = {};
  for (const m of [...(s.moods || [])].reverse()) out[m.kind] ||= { mood: m.mood, at: m.at };
  return out;
}
const adaptOf = (s) => ({ hidden: s.hidden || [], breakEvery: s.breakEvery ?? null });

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
  const firstTry = p.tasks.filter((t) => GRADED_TYPES.includes(t.type) && done[t.id] && !p.attempts?.[s.id]?.[t.id]?.wrong).length;
  return {
    student: { id: s.id, name: s.name, avatar: s.avatar || '' }, done, pending, firstTry,
    help: p.help.filter((h) => h.studentId === s.id && !h.resolved).map((h) => h.taskId),
    moods: latestMoods(s), adapt: adaptOf(s),
  };
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
  rate_limited: [429, 'הגעתם למגבלת השימוש ב-Claude כרגע. נסו שוב מאוחר יותר.'],
  refused: [422, 'המחולל לא יכול ליצור מסלול לבקשה הזו. נסו לנסח את הנושא אחרת.'],
  invalid_json: [502, 'המחולל החזיר תשובה לא תקינה. נסו שוב.'],
  prompt_too_large: [400, 'החומרים ארוכים מדי. נסו קבצים קצרים יותר.'],
  images_unavailable: [400, 'בתצוגה הזו אי אפשר לשלוח תמונות. נסו בלי תמונות.'],
  image_rejected: [400, 'אחת התמונות לא נקראה. נסו תמונה אחרת.'],
  session_expired: [401, 'צריך להתחבר שוב ל-claude.ai.'],
};

async function generate(body) {
  const sample = await getSample();
  if (!sample) throw new HttpError(503, 'המחולל זמין כשפותחים את ההדגמה ב-claude.ai עם חשבון מחובר.');
  const input = parseAiInput(body);
  const taken = charge('aiGenerate', input.topic, billing.generateCost(BILLING.costs, input.taskCount));
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
    const [status, message] = SAMPLE_ERRORS[e?.code] || [502, 'המחולל לא זמין כרגע. נסו שוב בעוד כמה דקות.'];
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
  const time = (x, cur) => (x === undefined ? cur ?? null : x === null || x === '' ? null : Math.round(Number(x)));
  next.opensAt = time(body.opensAt, p.opensAt);
  next.closesAt = time(body.closesAt, p.closesAt);
  if ([next.opensAt, next.closesAt].some((x) => x !== null && !Number.isFinite(x))) throw new HttpError(400, 'תאריך לא תקין');
  if (next.opensAt && next.closesAt && next.closesAt <= next.opensAt) throw new HttpError(400, 'מועד הסגירה צריך להיות אחרי מועד הפתיחה');
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
  charge('copyPath', title);
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
      id: s.id, name: s.name, avatar: s.avatar || '', hasSecret: Boolean(s.secret), joinedAt: s.createdAt, lastActive: s.lastActive,
      done: Object.fromEntries(Object.entries(p.progress[s.id] || {}).map(([k, d]) => [k, { ...d, approved: d.approved !== false }])),
      moods: latestMoods(s), adapt: adaptOf(s),
    })).sort((a, b) => a.name.localeCompare(b.name, 'he')),
    help: p.help.filter((h) => !h.resolved).map(({ id, studentId, taskId, createdAt }) => ({ id, studentId, taskId, createdAt })),
    wrong: Object.fromEntries(Object.entries(p.attempts || {}).map(([sid, byTask]) => [sid,
      Object.fromEntries(Object.entries(byTask).filter(([, a]) => a.wrong).map(([tid, a]) => [tid, a.wrong]))])),
  };
});

route('POST', '/api/s/:code/tasks/:taskId/open', ({ params, headers }) => {
  const p = byCode(params.code);
  const s = student(p, headers);
  const t = studentTask(p, params.taskId);
  ((p.attempts ||= {})[s.id] ||= {})[t.id] ||= { openedAt: Date.now(), wrong: 0 };
  save(p, { touch: false });
  return { ok: true };
});

route('POST', '/api/students/:id/reset-secret', ({ params }) => {
  for (const p of paths.values()) {
    const s = p.students.find((x) => x.id === Number(params.id));
    if (!s) continue;
    s.secret = null;
    save(p, { touch: false });
    return { ok: true };
  }
  throw new HttpError(404, 'התלמיד לא נמצא');
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
  throw new HttpError(404, 'התלמיד לא נמצא');
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

route('GET', '/api/ai/status', async () => ({ enabled: Boolean(await getSample()), grades: GRADES, types: AI_TASK_TYPES, costs: BILLING.costs }));

// A paid AI action through the viewer's own Claude account: credits back if it fails.
async function withCredits(action, note, fn) {
  const sample = await getSample();
  if (!sample) throw new HttpError(503, 'הבינה המלאכותית זמינה כשפותחים את ההדגמה ב-claude.ai עם חשבון מחובר.');
  const taken = charge(action, note);
  try {
    return await fn(sample);
  } catch (err) {
    billing.refund(meta.account, taken);
    record(taken.cost, 'refund', note);
    if (err instanceof HttpError) throw err;
    const [status, message] = SAMPLE_ERRORS[err?.code] || [502, 'השירות לא זמין כרגע. נסו שוב בעוד כמה דקות.'];
    throw new HttpError(status, message);
  }
}

// The demo page may not contact other sites, so Dicta's Nakdan is reached through its website.
route('POST', '/api/nikud/dicta', () => { throw new HttpError(503, 'אין חיבור ישיר לדיקטה בגרסת ההדגמה.'); });

route('POST', '/api/ai/nikud', async ({ body }) => {
  const text = v.str(body.text, { max: 3000, required: true, field: 'טקסט' });
  const out = await withCredits('aiNikud', text.slice(0, 40), async (sample) =>
    (await sample(`${NIKUD_SYSTEM}\n\nThe text:\n${text}`, { modelTier: 'complex', cache: false })).text.trim());
  const letters = (x) => v.stripNikud(x).replace(/\s+/g, '');
  return { text: out, changed: letters(out) !== letters(text), credits: credits() };
});

route('POST', '/api/ai/improve-task', async ({ body }) => {
  const original = v.task(body.task || {});
  const kind = String(body.kind || '');
  const custom = v.str(body.custom, { max: 300, field: 'הבקשה' });
  if (!['simpler', 'shorter', 'nikud', 'more', 'easier', 'harder', 'custom'].includes(kind) || (kind === 'custom' && !custom)) {
    throw new HttpError(400, 'בחרו מה לשפר');
  }
  const improved = await withCredits('aiImprove', original.title, async (sample) => {
    const raw = await sample.json([
      SYSTEM_PROMPT, jsonFormatInstructions([original.type]).replace('Reply with only one JSON object, no other text, in this shape:', 'For reference, a whole path looks like this:'),
      improvePrompt(original, { kind, custom }), 'Reply with only the one task as a JSON object.',
    ].join('\n\n'), { modelTier: 'complex', cache: false });
    const t = taskFromAi(raw);
    if (t.type !== original.type) throw new HttpError(502, 'התקבלה משימה מסוג אחר. נסו שוב.');
    return t;
  });
  keepTeacherParts(original, improved);
  return { task: improved, credits: credits() };
});

// Uploads go to the artifact's own file store; the demo has no server to keep them.
let assetsPromise;
async function uploadMedia(body) {
  const assets = await (assetsPromise ||= (window.claude?.use ? window.claude.use('assets') : Promise.resolve(null)).catch(() => null));
  if (!assets) throw new HttpError(503, 'העלאת קבצים זמינה כשפותחים את ההדגמה ב-claude.ai.');
  const bytes = Uint8Array.from(atob(String(body.data || '')), (c) => c.charCodeAt(0));
  if (!bytes.length) throw new HttpError(400, 'הקובץ ריק');
  if (bytes.length > 5 * 1024 * 1024) throw new HttpError(413, 'הקובץ גדול מדי (עד 5MB)');
  // The artifact store takes images and WebM (a browser recording); it needs the exact type.
  const head = String.fromCharCode(...bytes.slice(0, 12));
  const type = bytes[0] === 0x89 && head.slice(1, 4) === 'PNG' ? 'image/png'
    : bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg'
      : head.startsWith('GIF8') ? 'image/gif'
        : head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP' ? 'image/webp'
          : bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3 ? 'video/webm' : null;
  if (!type) throw new HttpError(400, 'בגרסת ההדגמה אפשר להעלות תמונות (PNG, JPG, GIF, WebP) והקלטות WebM.');
  try {
    const up = await assets.upload(new Blob([bytes], { type }), { type });
    return { url: `/_blob/${up.id}`, mime: up.contentType };
  } catch (err) {
    throw new HttpError(400, err?.message || 'ההעלאה נכשלה');
  }
}
route('POST', '/api/media', ({ body }) => uploadMedia(body));
// A student's spoken answer (in the demo, the student is on the teacher's own browser).
route('POST', '/api/s/:code/media', ({ params, headers, body }) => {
  const p = byCode(params.code);
  assertOpen(p);
  student(p, headers);
  return uploadMedia(body);
});
route('POST', '/api/ai/generate', ({ body }) => generate(body));

// --- student side ---

route('GET', '/api/s/:code', ({ params }) => {
  const p = byCode(params.code);
  assertStarted(p);
  return {
    path: {
      title: p.title, description: p.description, code: p.code, theme: v.theme(p.theme), published: p.published,
      closed: isClosed(p), closesAt: p.closesAt ?? null,
    },
    tasks: p.tasks.map((t) => taskOut(t, true)),
    // The demo's teacher plays the student on published paths; drafts open as a preview.
    preview: !p.published,
    join: { secretEmojis: SECRET_EMOJIS, avatars: AVATARS },
  };
});

const findStudent = (p, name) => p.students.find((x) => x.name.toLowerCase() === name.toLowerCase());

route('POST', '/api/s/:code/name', ({ params, body }) => {
  const p = byCode(params.code);
  const s = findStudent(p, v.str(body.name, { max: 40, required: true, field: 'שם' }));
  return { exists: Boolean(s), hasSecret: Boolean(s?.secret) };
});

// The demo keeps the secret as-is: it lives only in the viewer's own private data.
route('POST', '/api/s/:code/join', ({ params, body }) => {
  const p = byCode(params.code);
  assertOpen(p);
  const name = v.str(body.name, { max: 40, required: true, field: 'שם' });
  const secret = secretString(body.secret);
  const avatar = AVATARS.includes(body.avatar) ? body.avatar : '';
  let s = findStudent(p, name);
  if (!s) {
    s = { id: newId(), name, token: token(), createdAt: now(), lastActive: now(), secret, avatar };
    p.students.push(s);
  } else if (!s.secret) {
    s.secret = secret;
    if (avatar) s.avatar = avatar;
  } else if (s.secret !== secret) {
    throw Object.assign(new HttpError(403, 'הסיסמה הסודית לא נכונה. נסו שוב, או בקשו מהמורה לאפס אותה.'), { code: 'wrong_secret' });
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
  assertOpen(p);
  const s = student(p, headers);
  const t = studentTask(p, params.taskId);
  const { correct, answer, explanation, wrong } = gradeAnswer(t.type, t.content, body);
  const tries = ((p.attempts ||= {})[s.id] ||= {})[t.id] ||= { openedAt: Date.now(), wrong: 0 };
  if (!correct) {
    tries.wrong++;
    save(p, { touch: false });
    return { correct: false, wrong: wrong || [] };
  }
  const before = p.progress[s.id]?.[t.id];
  // Redoing an approved task keeps it approved.
  const approved = !t.needsApproval || Boolean(before && before.approved !== false);
  const durationSec = before?.durationSec ?? Math.min(3 * 3600, Math.round((Date.now() - tries.openedAt) / 1000));
  (p.progress[s.id] ||= {})[t.id] = { answer: answer ?? null, completedAt: now(), approved, durationSec };
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
  throw new HttpError(404, 'התלמיד לא נמצא');
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
  assertOpen(p);
  const s = student(p, headers);
  const t = studentTask(p, params.taskId);
  if (!p.help.some((h) => h.studentId === s.id && h.taskId === t.id && !h.resolved)) {
    p.help.push({ id: newId(), studentId: s.id, taskId: t.id, createdAt: now(), resolved: false });
  }
  save(p, { touch: false });
  return studentState(p, s);
});

// ---------- classes (kept in the meta document: a handful of small records) ----------

const classes = () => (meta.classes ||= []);
const saveMeta = () => store.save('meta', meta);
const classOut = (c) => ({ id: c.id, name: c.name, code: c.code, createdAt: c.createdAt });
const getClass = (id) => {
  const c = classes().find((x) => x.id === Number(id));
  if (!c) throw new HttpError(404, 'הכיתה לא נמצאה');
  return c;
};
const classByCode = (code) => {
  const c = classes().find((x) => x.code === String(code).toUpperCase());
  if (!c) throw new HttpError(404, 'לא מצאנו כיתה עם הקוד הזה');
  return c;
};
const approvedDone = (p, s) => Object.values(p.progress[s.id] || {}).filter((d) => d.approved !== false).length;
const memberProgress = (m) => {
  const out = {};
  for (const p of paths.values()) {
    const s = p.students.find((x) => x.classMemberId === m.id);
    if (s) out[p.id] = approvedDone(p, s);
  }
  return out;
};
const classPaths = (c) => c.pathIds.map((id) => paths.get(id)).filter((p) => p && p.published).map((p) => {
  const th = v.theme(p.theme);
  return { id: p.id, code: p.code, title: p.title, icon: th.icon, color: th.color, taskCount: p.tasks.length };
});
const currentMember = (c, headers) => {
  const m = c.members.find((x) => x.token === headers['X-Class-Token']);
  if (!m) throw new HttpError(401, 'צריך להיכנס לכיתה מחדש');
  m.lastActive = now();
  return m;
};
const memberState = (m) => ({ member: { id: m.id, name: m.name, avatar: m.avatar }, done: memberProgress(m) });

route('GET', '/api/classes', () => ({
  classes: classes().map((c) => ({ ...classOut(c), memberCount: c.members.length, pathCount: c.pathIds.length })),
}));
route('POST', '/api/classes', ({ body }) => {
  const c = { id: newId(), name: v.str(body.name, { max: 80, required: true, field: 'שם הכיתה' }), code: newCode(), createdAt: now(), pathIds: [], members: [] };
  classes().unshift(c);
  saveMeta();
  return { class: classOut(c) };
});
route('GET', '/api/classes/:id', ({ params }) => {
  const c = getClass(params.id);
  return {
    class: classOut(c),
    pathIds: c.pathIds,
    taskCounts: Object.fromEntries(c.pathIds.map((id) => [id, paths.get(id)?.tasks.length || 0])),
    members: [...c.members].sort((a, b) => a.name.localeCompare(b.name, 'he')).map((m) => ({
      id: m.id, name: m.name, avatar: m.avatar, hasSecret: Boolean(m.secret), lastActive: m.lastActive, done: memberProgress(m),
    })),
  };
});
route('PUT', '/api/classes/:id', ({ params, body }) => {
  const c = getClass(params.id);
  if (body.name !== undefined) c.name = v.str(body.name, { max: 80, required: true, field: 'שם הכיתה' });
  if (body.pathIds !== undefined) c.pathIds = [...new Set((body.pathIds || []).map(Number))].filter((id) => paths.has(id));
  saveMeta();
  return { class: classOut(c) };
});
route('DELETE', '/api/classes/:id', ({ params }) => {
  const c = getClass(params.id);
  meta.classes = classes().filter((x) => x !== c);
  saveMeta();
  return { ok: true };
});
const findMember = (id) => {
  for (const c of classes()) {
    const m = c.members.find((x) => x.id === Number(id));
    if (m) return { c, m };
  }
  throw new HttpError(404, 'התלמיד לא נמצא');
};
route('POST', '/api/class-members/:id/reset-secret', ({ params }) => {
  findMember(params.id).m.secret = null;
  saveMeta();
  return { ok: true };
});
route('DELETE', '/api/class-members/:id', ({ params }) => {
  const { c, m } = findMember(params.id);
  c.members = c.members.filter((x) => x !== m);
  for (const p of paths.values()) for (const st of p.students) if (st.classMemberId === m.id) { st.classMemberId = null; save(p, { touch: false }); }
  saveMeta();
  return { ok: true };
});

route('GET', '/api/c/:code', ({ params }) => {
  const c = classByCode(params.code);
  return { class: { name: c.name, code: c.code }, paths: classPaths(c), join: { secretEmojis: SECRET_EMOJIS, avatars: AVATARS } };
});
route('POST', '/api/c/:code/name', ({ params, body }) => {
  const c = classByCode(params.code);
  const name = v.str(body.name, { max: 40, required: true, field: 'שם' });
  const m = c.members.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return { exists: Boolean(m), hasSecret: Boolean(m?.secret) };
});
route('POST', '/api/c/:code/join', ({ params, body }) => {
  const c = classByCode(params.code);
  const name = v.str(body.name, { max: 40, required: true, field: 'שם' });
  const secret = secretString(body.secret);
  const avatar = AVATARS.includes(body.avatar) ? body.avatar : '';
  let m = c.members.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!m) {
    m = { id: newId(), name, avatar, secret, token: token(), createdAt: now(), lastActive: now() };
    c.members.push(m);
  } else if (!m.secret) {
    m.secret = secret;
    if (avatar) m.avatar = avatar;
  } else if (m.secret !== secret) {
    throw Object.assign(new HttpError(403, 'הסיסמה הסודית לא נכונה. נסו שוב, או בקשו מהמורה לאפס אותה.'), { code: 'wrong_secret' });
  }
  // Same-name students who joined a path alone continue there only if the secret matches.
  for (const id of c.pathIds) {
    const p = paths.get(id);
    if (!p || p.students.some((st) => st.classMemberId === m.id)) continue;
    const solo = p.students.find((st) => st.name.toLowerCase() === m.name.toLowerCase() && !st.classMemberId);
    if (solo && solo.secret === secret) { solo.classMemberId = m.id; save(p, { touch: false }); }
  }
  m.lastActive = now();
  saveMeta();
  return { token: m.token, ...memberState(m) };
});
route('GET', '/api/c/:code/me', ({ params, headers }) => memberState(currentMember(classByCode(params.code), headers)));
route('POST', '/api/c/:code/paths/:pathId/enter', ({ params, headers }) => {
  const c = classByCode(params.code);
  const m = currentMember(c, headers);
  const p = classPaths(c).find((x) => x.id === Number(params.pathId)) && paths.get(Number(params.pathId));
  if (!p) throw new HttpError(404, 'המסלול לא נמצא בכיתה');
  let st = p.students.find((x) => x.classMemberId === m.id);
  if (!st) {
    const taken = p.students.some((x) => x.name.toLowerCase() === m.name.toLowerCase());
    st = { id: newId(), name: taken ? `${m.name} (${c.name})`.slice(0, 40) : m.name, token: token(), createdAt: now(), lastActive: now(), secret: m.secret, avatar: m.avatar, classMemberId: m.id };
    p.students.push(st);
    save(p, { touch: false });
  }
  saveMeta();
  return { code: p.code, token: st.token };
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

// ---------- moods, adaptation, library ----------

route('POST', '/api/s/:code/mood', ({ params, headers, body }) => {
  const p = byCode(params.code);
  assertOpen(p);
  const s = student(p, headers);
  const { kind, mood } = moodInput(body);
  (s.moods ||= []).push({ kind, mood, at: Date.now() });
  s.moods = s.moods.slice(-20);
  save(p, { touch: false });
  return { moods: latestMoods(s) };
});

route('PUT', '/api/students/:id/adapt', ({ params, body }) => {
  for (const p of paths.values()) {
    const s = p.students.find((x) => x.id === Number(params.id));
    if (!s) continue;
    const ids = new Set(p.tasks.map((t) => t.id));
    const hidden = [...new Set(Array.isArray(body.hidden) ? body.hidden.map(Number) : [])].filter((id) => ids.has(id));
    if (hidden.length && hidden.length >= ids.size) throw new HttpError(400, 'צריך להשאיר לפחות משימה אחת');
    const be = body.breakEvery;
    s.hidden = hidden;
    s.breakEvery = be === null || be === undefined || be === '' ? null : v.int(be, { min: 0, max: 20, def: 0 });
    save(p, { touch: false });
    return { adapt: adaptOf(s) };
  }
  throw new HttpError(404, 'התלמיד לא נמצא');
});

// The demo has no other teachers: its library holds the paths this viewer shared.
route('PUT', '/api/paths/:id/share', ({ params, body }) => {
  const p = getPath(params.id);
  const shared = Boolean(body.shared);
  if (shared && !p.tasks.length) throw new HttpError(400, 'אי אפשר לשתף מסלול בלי משימות');
  p.shared = shared;
  p.sharedGrade = GRADES.includes(body.grade) ? body.grade : '';
  p.sharedSubject = v.str(body.subject, { max: 40, field: 'מקצוע' });
  save(p, { touch: false });
  return { path: pathOut(p) };
});

route('GET', '/api/library', () => ({
  items: [...READY_PATHS.map((x) => ({
    id: `site-${x.slug}`, title: x.title, description: x.description, theme: x.theme, grade: x.grade, subject: x.subject,
    curriculum: x.curriculum, order: x.order, taskCount: x.tasks.length, types: [...new Set(x.tasks.map((t) => t.type))],
    author: '', copies: 0, mine: false, ready: true,
  })), ...[...paths.values()].filter((p) => p.shared).map((p) => ({
    id: p.id, title: p.title, description: p.description, theme: v.theme(p.theme), grade: p.sharedGrade || '', subject: p.sharedSubject || '',
    taskCount: p.tasks.length, types: [...new Set(p.tasks.map((t) => t.type))], author: teacher().name, copies: p.copies || 0, mine: true,
  }))],
}));

const sharedPath = (id) => {
  const ready = READY_PATHS.find((x) => `site-${x.slug}` === id);
  if (ready) return { title: ready.title, description: ready.description, theme: ready.theme, tasks: ready.tasks };
  const p = paths.get(Number(id));
  if (!p || !p.shared) throw new HttpError(404, 'המסלול לא נמצא בספרייה');
  return p;
};
route('GET', '/api/library/:id', ({ params }) => {
  const p = sharedPath(params.id);
  return { title: p.title, description: p.description, theme: v.theme(p.theme), tasks: p.tasks.map((t, i) => ({ id: t.id ?? i + 1, ...clone(t) })) };
});
route('POST', '/api/library/:id/copy', ({ params }) => {
  const p = sharedPath(params.id);
  charge('copyPath', p.title);
  const copy = createPath({ title: p.title, description: p.description, theme: p.theme, tasks: p.tasks.map(({ id, ...t }) => clone(t)) });
  return { path: pathOut(copy), credits: credits() };
});
