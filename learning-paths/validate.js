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
  mode: 'light',          // 'dark' = night mode for the student screens
  stations: 'circle',     // shape of the stations on the map
  card: 'soft',           // style of the task cards
  celebration: 'confetti',
  buddy: '',              // a companion emoji that cheers the student on ('' = none)
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
  for (const key of ['celebrate', 'readAloud']) {
    if (input[key] !== undefined) t[key] = Boolean(input[key]);
  }
  return t;
}

// ---- Tasks ----

export const TASK_TYPES = [
  'read', 'link', 'question', 'choice', 'checklist', 'timer',
  'memory', 'wordsearch', 'matching', 'order', 'blanks', 'truefalse',
];

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
  const text = str(c.text, { max: 5000, field: 'הוראות' });
  switch (type) {
    case 'read':
      return { text, imageUrl: url(c.imageUrl, 'תמונה') };
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
    case 'matching': {
      const pairs = pairList(c.pairs, { min: 2, max: 8 });
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
