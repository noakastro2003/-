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
});

const ONE_OF = {
  background: ['plain', 'dots', 'waves', 'stars', 'grid'],
  font: ['rounded', 'handwriting', 'bold', 'clean'],
  map: ['road', 'cards'],
  order: ['sequential', 'free'],
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
  if (input.breakEvery !== undefined) t.breakEvery = int(input.breakEvery, { min: 0, max: 20, def: t.breakEvery });
  if (input.breakMinutes !== undefined) t.breakMinutes = int(input.breakMinutes, { min: 1, max: 15, def: t.breakMinutes });
  for (const key of ['celebrate', 'readAloud']) {
    if (input[key] !== undefined) t[key] = Boolean(input[key]);
  }
  return t;
}

// ---- Tasks ----

export const TASK_TYPES = ['read', 'link', 'question', 'choice', 'checklist', 'timer'];

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
    content: taskContent(input.type, input.content),
  };
}
