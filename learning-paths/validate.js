// Input validation and normalization for everything the API accepts.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const bad = (msg) => new HttpError(400, msg);

export function str(value, { max = 200, required = false, field = 'שדה' } = {}) {
  if (value == null) value = '';
  if (typeof value !== 'string') throw bad(`${field}: ערך לא תקין`);
  const s = value.trim();
  if (required && !s) throw bad(`${field}: שדה חובה`);
  if (s.length > max) throw bad(`${field}: ארוך מדי (עד ${max} תווים)`);
  return s;
}

export function int(value, { min, max, def }) {
  if (value == null || value === '') return def;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`מספר לא תקין (${min}-${max})`);
  return n;
}

function url(value, field) {
  const s = str(value, { max: 1000, field });
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) throw bad(`${field}: הקישור חייב להתחיל ב-http:// או https://`);
  return s;
}

// A file the teacher uploaded (served by the app itself), or for images also a web address.
export const MEDIA_PATH = /^\/(api\/media|_blob)\/[A-Za-z0-9_-]{8,80}$/;
function mediaRef(value, field, { web = false } = {}) {
  const s = str(value, { max: 1000, field });
  if (!s || MEDIA_PATH.test(s)) return s;
  if (web && /^https?:\/\//i.test(s)) return s;
  throw bad(`${field}: קובץ לא תקין`);
}

function strList(value, { field, min = 0, maxItems = 20, maxLen = 200 }) {
  if (!Array.isArray(value)) value = [];
  const items = value.map((v) => str(v, { max: maxLen, field })).filter(Boolean);
  if (items.length < min) throw bad(`${field}: צריך לפחות ${min} פריטים`);
  if (items.length > maxItems) throw bad(`${field}: עד ${maxItems} פריטים`);
  return items;
}

export function email(value) {
  const s = str(value, { max: 200, required: true, field: 'אימייל' }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad('כתובת אימייל לא תקינה');
  return s;
}

export function pin(value) {
  if (typeof value !== 'string' || !/^\d{4,6}$/.test(value)) throw bad('קוד האישור צריך להיות 4 עד 6 ספרות');
  return value;
}

export function password(value) {
  if (typeof value !== 'string' || value.length < 8) throw bad('הסיסמה חייבת להכיל לפחות 8 תווים');
  if (value.length > 200) throw bad('הסיסמה ארוכה מדי');
  return value;
}

// ---- Path design (theme) ----

export const THEME_DEFAULTS = Object.freeze({
  color: '#6c5ce7',
  background: 'dots',
  icon: '🚀',
  font: 'rounded',
  map: 'road',
  order: 'sequential',
  breakEvery: 3,
  breakMinutes: 2,
  celebrate: true,
  readAloud: true,
  sound: true,
  mode: 'light',          // 'dark' = night mode for the student screens
  stations: 'circle',     // shape of the stations on the map
  card: 'soft',           // style of the task cards
  celebration: 'confetti',
  buddy: '',              // a companion emoji that cheers the student on ('' = none)
  breakStyle: 'move',     // 'move' = guided movement, 'calm' = breathing, 'simple' = a tip and a clock
  moods: true,            // "how do I feel?" at the start and the end
  stickers: true,         // a sticker for every finished task, collected in an album
});

const ONE_OF = {
  background: ['plain', 'dots', 'waves', 'stars', 'grid', 'notebook', 'confetti', 'sunset', 'bubbles'],
  font: ['rounded', 'handwriting', 'bold', 'festive', 'clean'],
  map: ['road', 'cards', 'timeline'],
  order: ['sequential', 'free'],
  mode: ['light', 'dark'],
  stations: ['circle', 'rounded', 'hex'],
  card: ['soft', 'bold', 'glass'],
  celebration: ['confetti', 'stars', 'balloons', 'hearts', 'bubbles'],
  breakStyle: ['move', 'calm', 'simple'],
};

export function theme(input = {}, base = THEME_DEFAULTS) {
  if (typeof input !== 'object' || input === null) throw bad('עיצוב לא תקין');
  const t = { ...THEME_DEFAULTS, ...base };
  if (input.color !== undefined) {
    if (!/^#[0-9a-f]{6}$/i.test(input.color)) throw bad('צבע לא תקין');
    t.color = input.color.toLowerCase();
  }
  for (const [key, options] of Object.entries(ONE_OF)) {
    if (input[key] !== undefined) {
      if (!options.includes(input[key])) throw bad(`ערך לא תקין: ${key}`);
      t[key] = input[key];
    }
  }
  if (input.icon !== undefined) t.icon = str(input.icon, { max: 16, field: 'סמל' }) || THEME_DEFAULTS.icon;
  if (input.buddy !== undefined) t.buddy = str(input.buddy, { max: 16, field: 'דמות מלווה' });
  if (input.breakEvery !== undefined) t.breakEvery = int(input.breakEvery, { min: 0, max: 20, def: t.breakEvery });
  if (input.breakMinutes !== undefined) t.breakMinutes = int(input.breakMinutes, { min: 1, max: 15, def: t.breakMinutes });
  for (const key of ['celebrate', 'readAloud', 'sound', 'moods', 'stickers']) {
    if (input[key] !== undefined) t[key] = Boolean(input[key]);
  }
  return t;
}

// ---- Tasks ----

export const TASK_TYPES = [
  'read', 'link', 'question', 'choice', 'checklist', 'timer',
  'memory', 'wordsearch', 'matching', 'order', 'blanks', 'truefalse',
  'lines', 'sort', 'voice', 'dictation', 'flashcards',
  'photo', 'hotspot', 'draw', 'highlight', 'numberline',
];

// A number as teachers write it: "3", "-2", "2.5", "3/4", "1 ו-1/2" (mixed). NaN if not one.
export function parseNumber(value) {
  const s = String(value ?? '').trim().replace(/[−–]/g, '-');
  let m = s.match(/^(-?\d+)\s+ו-?\s*(\d+)\s*\/\s*(\d+)$/);
  if (m && Number(m[3])) return Number(m[1]) + Math.sign(Number(m[1]) || 1) * (Number(m[2]) / Number(m[3]));
  m = s.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (m && Number(m[2])) return Number(m[1]) / Number(m[2]);
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}
const sameNumber = (a, b) => Math.abs(a - b) < 1e-9;

// A number line: ticks from min to max every step. Returns the tick count, or throws.
export function numberLineTicks(c) {
  const [min, max, step] = [c.min, c.max, c.step].map(parseNumber);
  if ([min, max, step].some(Number.isNaN)) throw bad('ישר מספרים: התחלה, סוף וקפיצה צריכים להיות מספרים (אפשר שברים כמו 1/4)');
  if (max <= min) throw bad('ישר מספרים: הסוף צריך להיות גדול מההתחלה');
  if (step <= 0) throw bad('ישר מספרים: הקפיצה צריכה להיות גדולה מאפס');
  const n = (max - min) / step;
  if (!sameNumber(n, Math.round(n))) throw bad('ישר מספרים: הקפיצה צריכה להתחלק בדיוק בטווח (למשל 0 עד 1 בקפיצות של 1/4)');
  if (Math.round(n) > 40) throw bad('ישר מספרים: עד 40 קפיצות על הישר');
  return Math.round(n);
}

// Removes Hebrew nikud and cantillation marks (keeps maqaf and punctuation).
export function stripNikud(s) {
  return String(s).replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, '');
}

// Loose comparison for typed/picked words: no nikud, case or extra spaces.
export function normalizeWord(s) {
  return stripNikud(s).trim().replace(/\s+/g, ' ').toLowerCase();
}

// Splits "הכלב [רץ] בגינה" into text segments and the hidden answers.
export function parseBlanks(passage) {
  const answers = [];
  const segments = [];
  let last = 0;
  for (const m of passage.matchAll(/\[([^\[\]]+)\]/g)) {
    segments.push(passage.slice(last, m.index));
    answers.push(m[1].trim());
    last = m.index + m[0].length;
  }
  segments.push(passage.slice(last));
  return { segments, answers };
}

// "הכלב [רץ] [וקפץ גבוה]" -> words to tap, and which of them are the right ones.
// tight lists the tokens written with no space before them ("ו[שיחק]", "[חברים].").
export function highlightTokens(passage) {
  const text = String(passage);
  const tokens = [];
  const targets = [];
  const tight = [];
  for (const m of text.matchAll(/\[([^\[\]]+)\]|([^\s\[\]]+)/g)) {
    const glued = m.index > 0 && !/\s/.test(text[m.index - 1]);
    if (m[2]) {
      if (glued && tokens.length) tight.push(tokens.length);
      tokens.push(m[2]);
      continue;
    }
    m[1].trim().split(/\s+/).filter(Boolean).forEach((w, k) => {
      if (k === 0 && glued && tokens.length) tight.push(tokens.length);
      targets.push(tokens.length);
      tokens.push(w);
    });
  }
  return { tokens, targets, tight };
}

// A visual aid the app draws exactly: a fraction as a pie or a bar, or groups of objects
// to count ("🍎 ×3 + 🍎 ×2"). Returns null when there is none.
export function visual(x) {
  if (!x || typeof x !== 'object' || !x.kind) return null;
  if (x.kind === 'fraction') {
    const d = int(x.d, { min: 1, max: 12, def: 0 });
    const n = int(x.n, { min: 0, max: 36, def: -1 });
    if (!d || n < 0) throw bad('המחשה: מונה ומכנה צריכים להיות מספרים (מכנה עד 12)');
    if (n > d * 3) throw bad('המחשה: עד 3 שלמים');
    return { kind: 'fraction', n, d, shape: x.shape === 'bar' ? 'bar' : 'pie' };
  }
  if (x.kind === 'objects') {
    const groups = (Array.isArray(x.groups) ? x.groups : [])
      .map((g) => ({ emoji: str(g?.emoji, { max: 16, field: 'סמל' }), count: int(g?.count, { min: 0, max: 20, def: 0 }) }))
      .filter((g) => g.emoji && g.count);
    if (!groups.length) throw bad('המחשה: צריך לפחות קבוצה אחת עם סמל ומספר');
    if (groups.length > 3) throw bad('המחשה: עד 3 קבוצות');
    return { kind: 'objects', groups, op: ['+', '−', ''].includes(x.op) ? x.op : '' };
  }
  throw bad('סוג המחשה לא מוכר');
}

function pairList(value, { min, max }) {
  if (!Array.isArray(value)) value = [];
  const pairs = value
    .map((p) => ({
      a: str(p?.a, { max: 120, field: 'זוג' }),
      b: str(p?.b, { max: 120, field: 'זוג' }),
    }))
    .filter((p) => p.a || p.b);
  if (pairs.some((p) => !p.a)) throw bad('בכל זוג צריך למלא לפחות את הצד הראשון');
  if (pairs.length < min) throw bad(`צריך לפחות ${min} זוגות`);
  if (pairs.length > max) throw bad(`עד ${max} זוגות`);
  return pairs;
}

function taskContent(type, c = {}) {
  if (typeof c !== 'object' || c === null) c = {};
  // Every task may have a picture and the teacher's recorded instructions.
  const media = {};
  const image = mediaRef(c.image || c.imageUrl, 'תמונה', { web: true });
  const audio = mediaRef(c.audio, 'הקלטה');
  if (image) media.image = image;
  if (audio) media.audio = audio;
  if (type === 'hotspot' && !image) throw bad('במשימת סימון על תמונה צריך להעלות תמונה');
  const vis = visual(c.visual);
  if (vis) media.visual = vis;
  return { ...typeContent(type, c), ...media };
}

function typeContent(type, c) {
  const text = str(c.text, { max: 5000, field: 'הוראות' });
  switch (type) {
    case 'read':
      return { text };
    case 'link': {
      const u = url(c.url, 'קישור');
      if (!u) throw bad('קישור: שדה חובה');
      return { text, url: u };
    }
    case 'question':
      return { text };
    case 'choice': {
      const options = strList(c.options, { field: 'תשובות', min: 2, maxItems: 6 });
      const correct = int(c.correct, { min: 0, max: options.length - 1, def: 0 });
      return { text, options, correct, explanation: str(c.explanation, { max: 1000, field: 'הסבר' }) };
    }
    case 'checklist':
      return { text, items: strList(c.items, { field: 'שלבים', min: 1, maxItems: 15 }) };
    case 'timer':
      return { text, minutes: int(c.minutes, { min: 1, max: 60, def: 10 }) };
    case 'memory':
      // b is optional: an empty b means two identical cards.
      return { text, pairs: pairList(c.pairs, { min: 2, max: 10 }) };
    case 'matching':
    case 'lines': {
      const pairs = pairList(c.pairs, { min: 2, max: type === 'lines' ? 6 : 8 });
      if (pairs.some((p) => !p.b)) throw bad('בכל זוג צריך למלא את שני הצדדים');
      if (new Set(pairs.map((p) => normalizeWord(p.b))).size !== pairs.length) throw bad('הצד השני של כל זוג צריך להיות שונה');
      return { text, pairs };
    }
    case 'wordsearch': {
      const words = strList(c.words, { field: 'מילים', min: 2, maxItems: 10, maxLen: 30 });
      for (const w of words) {
        const letters = stripNikud(w).replace(/\s+/g, '');
        if (letters.length < 2 || letters.length > 10) throw bad(`המילה "${w}" צריכה להיות באורך 2 עד 10 אותיות`);
      }
      return { text, words };
    }
    case 'order':
      return { text, items: strList(c.items, { field: 'פריטים', min: 2, maxItems: 10 }) };
    case 'blanks': {
      const passage = str(c.passage, { max: 3000, required: true, field: 'טקסט להשלמה' });
      const { answers } = parseBlanks(passage);
      if (!answers.length) throw bad('סמנו לפחות מילה אחת להשלמה בסוגריים מרובעים, למשל: הכלב [רץ] בגינה');
      if (answers.length > 15) throw bad('עד 15 מילים להשלמה');
      return { text, passage, distractors: strList(c.distractors, { field: 'מילים מסיחות', maxItems: 8, maxLen: 60 }) };
    }
    case 'truefalse': {
      const list = Array.isArray(c.statements) ? c.statements : [];
      const statements = list
        .map((x) => ({ s: str(x?.s, { max: 300, field: 'משפט' }), t: Boolean(x?.t) }))
        .filter((x) => x.s);
      if (!statements.length) throw bad('צריך לפחות משפט אחד');
      if (statements.length > 10) throw bad('עד 10 משפטים');
      return { text, statements };
    }
    case 'sort': {
      const list = Array.isArray(c.groups) ? c.groups : [];
      const groups = list
        .map((g) => ({
          name: str(g?.name, { max: 60, field: 'שם קבוצה' }),
          items: strList(g?.items, { field: 'פריטים', maxItems: 10, maxLen: 80 }),
        }))
        .filter((g) => g.name || g.items.length);
      if (groups.some((g) => !g.name)) throw bad('לכל קבוצה צריך שם');
      if (groups.length < 2) throw bad('צריך לפחות 2 קבוצות');
      if (groups.length > 4) throw bad('עד 4 קבוצות');
      if (groups.some((g) => !g.items.length)) throw bad('בכל קבוצה צריך לפחות פריט אחד');
      const all = groups.flatMap((g) => g.items.map(normalizeWord));
      if (all.length > 16) throw bad('עד 16 פריטים בסך הכול');
      if (new Set(all).size !== all.length) throw bad('כל פריט יכול להופיע רק פעם אחת');
      return { text, groups };
    }
    case 'voice':
      return { text, maxSeconds: int(c.maxSeconds, { min: 10, max: 180, def: 60 }) };
    case 'dictation': {
      const list = Array.isArray(c.words) ? c.words : [];
      const words = list
        .map((x) => (typeof x === 'string' ? { w: x } : x))
        .map((x) => {
          const item = { w: str(x?.w, { max: 60, field: 'מילה' }) };
          const audio = mediaRef(x?.audio, 'הקלטת מילה');
          if (audio) item.audio = audio;
          return item;
        })
        .filter((x) => x.w);
      if (!words.length) throw bad('צריך לפחות מילה אחת להכתבה');
      if (words.length > 12) throw bad('עד 12 מילים בהכתבה');
      return { text, words };
    }
    case 'photo':
    case 'draw':
      return { text };
    case 'hotspot': {
      const list = Array.isArray(c.spots) ? c.spots : [];
      const num = (x, lo, hi) => {
        const n = Number(x);
        if (!Number.isFinite(n)) throw bad('נקודה לא תקינה');
        return Math.round(Math.min(hi, Math.max(lo, n)) * 10) / 10;
      };
      const spots = list.map((p) => ({ x: num(p?.x, 0, 100), y: num(p?.y, 0, 100), r: num(p?.r ?? 8, 3, 30) }));
      if (!spots.length) throw bad('סמנו על התמונה לפחות מקום נכון אחד');
      if (spots.length > 8) throw bad('עד 8 מקומות לסימון');
      return { text, spots };
    }
    case 'highlight': {
      const passage = str(c.passage, { max: 3000, required: true, field: 'טקסט' });
      const { tokens, targets } = highlightTokens(passage);
      if (!targets.length) throw bad('שימו בסוגריים מרובעים את המילים שצריך לסמן, למשל: הכלב [רץ] בגינה');
      if (targets.length > 30) throw bad('עד 30 מילים לסימון');
      if (tokens.length > 400) throw bad('הטקסט ארוך מדי לסימון');
      return { text, passage };
    }
    case 'numberline': {
      const nl = {
        min: str(c.min, { max: 20, required: true, field: 'התחלה' }),
        max: str(c.max, { max: 20, required: true, field: 'סוף' }),
        step: str(c.step, { max: 20, required: true, field: 'קפיצה' }),
      };
      const ticks = numberLineTicks(nl);
      const labels = ['ends', 'whole', 'all'].includes(c.labels) ? c.labels : 'whole';
      const targets = strList(c.targets, { field: 'מספרים לסימון', min: 1, maxItems: 5, maxLen: 20 });
      const lo = parseNumber(nl.min);
      const st = parseNumber(nl.step);
      for (const t of targets) {
        const v = parseNumber(t);
        if (Number.isNaN(v)) throw bad(`"${t}" הוא לא מספר`);
        const k = (v - lo) / st;
        if (k < -1e-9 || k > ticks + 1e-9 || !sameNumber(k, Math.round(k))) throw bad(`המספר ${t} לא נמצא על אחד הסימונים של הישר`);
      }
      return { text, ...nl, labels, targets };
    }
    case 'flashcards': {
      const cards = pairList(c.cards, { min: 2, max: 20 });
      if (cards.some((p) => !p.b)) throw bad('בכל כרטיסייה צריך למלא את שני הצדדים');
      return { text, cards };
    }
  }
  throw bad('סוג משימה לא מוכר');
}

export function task(input = {}) {
  if (!TASK_TYPES.includes(input.type)) throw bad('סוג משימה לא מוכר');
  return {
    type: input.type,
    title: str(input.title, { max: 120, required: true, field: 'כותרת' }),
    emoji: str(input.emoji, { max: 16, field: 'סמל' }),
    estMinutes: int(input.estMinutes, { min: 1, max: 120, def: 5 }),
    // The student stops after this task until the teacher approves it.
    needsApproval: Boolean(input.needsApproval),
    content: taskContent(input.type, input.content),
  };
}

// A student's reading settings: easier-to-read font, bigger text, wider spacing, high
// contrast, calm mode (no animations or sounds), and whether read-aloud uses the natural voice.
export const READING_DEFAULTS = { font: 'default', size: 1, spacing: false, contrast: false, calm: false, readAloud: false, voice: 'natural' };
export function reading(input = {}) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw bad('הגדרות קריאה לא תקינות');
  const r = { ...READING_DEFAULTS };
  if (input.font !== undefined) r.font = input.font === 'clear' ? 'clear' : 'default';
  if (input.size !== undefined) r.size = [1, 2, 3].includes(Number(input.size)) ? Number(input.size) : 1;
  for (const k of ['spacing', 'contrast', 'calm', 'readAloud']) if (input[k] !== undefined) r[k] = input[k] === true;
  if (input.voice !== undefined) r.voice = input.voice === 'device' ? 'device' : 'natural';
  return r;
}
export const readingFrom = (json) => {
  try { return reading(JSON.parse(json || '{}')); } catch { return { ...READING_DEFAULTS }; }
};
