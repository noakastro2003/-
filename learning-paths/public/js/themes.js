import { DEMO } from './env.js';

// Design options shared by the teacher's design editor and the student view.

export const COLORS = [
  { value: '#6c5ce7', name: 'סגול' },
  { value: '#0984e3', name: 'כחול' },
  { value: '#00a884', name: 'ירוק' },
  { value: '#e17055', name: 'כתום' },
  { value: '#d63384', name: 'ורוד' },
  { value: '#2d3436', name: 'כהה' },
  { value: '#0aa5c0', name: 'טורקיז' },
  { value: '#2f9e44', name: 'ירוק יער' },
  { value: '#f08c00', name: 'צהוב חם' },
  { value: '#e64980', name: 'ורוד ממתק' },
  { value: '#f76707', name: 'כתום שקיעה' },
  { value: '#5c7cfa', name: 'כחול לילה' },
];

export const BACKGROUNDS = [
  { value: 'plain', name: 'חלק' },
  { value: 'dots', name: 'נקודות' },
  { value: 'grid', name: 'משבצות' },
  { value: 'waves', name: 'גלים' },
  { value: 'stars', name: 'כוכבים' },
  { value: 'notebook', name: 'מחברת' },
  { value: 'confetti', name: 'קונפטי' },
  { value: 'sunset', name: 'שקיעה' },
  { value: 'bubbles', name: 'בועות' },
];

export const FONTS = [
  { value: 'rounded', name: 'עגול וידידותי', family: "'Varela Round'" },
  { value: 'handwriting', name: 'כתב יד', family: "'Playpen Sans Hebrew'" },
  { value: 'bold', name: 'כותרות בולטות', family: "'Secular One'" },
  { value: 'festive', name: 'חגיגי', family: "'Suez One'" },
  { value: 'clean', name: 'דפוס ברור', family: "'Rubik'" },
];

export const MAPS = [
  { value: 'road', name: 'דרך מתפתלת', icon: '〰️' },
  { value: 'cards', name: 'כרטיסים', icon: '🗂️' },
  { value: 'timeline', name: 'קו ישר', icon: '📍' },
];

export const MODES = [
  { value: 'light', name: 'יום', icon: '☀️' },
  { value: 'dark', name: 'לילה', icon: '🌙' },
];

export const STATIONS = [
  { value: 'circle', name: 'עיגול' },
  { value: 'rounded', name: 'ריבוע רך' },
  { value: 'hex', name: 'משושה' },
];

export const CARDS = [
  { value: 'soft', name: 'רך' },
  { value: 'bold', name: 'מסגרת עבה' },
  { value: 'glass', name: 'זכוכית' },
];

export const CELEBRATIONS = [
  { value: 'confetti', name: 'קונפטי', icon: '🎊' },
  { value: 'stars', name: 'כוכבים', icon: '⭐' },
  { value: 'balloons', name: 'בלונים', icon: '🎈' },
  { value: 'hearts', name: 'לבבות', icon: '💖' },
  { value: 'bubbles', name: 'בועות', icon: '🫧' },
];

// A companion who stands next to the student on the map and cheers after each task.
export const BUDDIES = ['', '🦉', '🐶', '🐱', '🤖', '🦄', '🐢', '🦊', '🐼', '🐸', '🐙', '🦖', '🐝'];

// Ready-made looks: one click sets everything below.
export const PRESETS = [
  { name: 'קלאסי', icon: '🚀', theme: { color: '#6c5ce7', background: 'dots', font: 'rounded', map: 'road', mode: 'light', stations: 'circle', card: 'soft', celebration: 'confetti', buddy: '', icon: '🚀' } },
  { name: 'חלל', icon: '🪐', theme: { color: '#7c5cff', background: 'stars', font: 'bold', map: 'road', mode: 'dark', stations: 'hex', card: 'glass', celebration: 'stars', buddy: '🤖', icon: '🪐' } },
  { name: 'מתחת לים', icon: '🐙', theme: { color: '#0aa5c0', background: 'bubbles', font: 'rounded', map: 'road', mode: 'light', stations: 'circle', card: 'soft', celebration: 'bubbles', buddy: '🐙', icon: '🐙' } },
  { name: 'יער', icon: '🌳', theme: { color: '#2f9e44', background: 'dots', font: 'handwriting', map: 'timeline', mode: 'light', stations: 'rounded', card: 'bold', celebration: 'confetti', buddy: '🦉', icon: '🌱' } },
  { name: 'ממתקים', icon: '🍭', theme: { color: '#e64980', background: 'confetti', font: 'festive', map: 'cards', mode: 'light', stations: 'circle', card: 'bold', celebration: 'hearts', buddy: '🦄', icon: '🦄' } },
  { name: 'מחברת', icon: '✏️', theme: { color: '#1c7ed6', background: 'notebook', font: 'handwriting', map: 'timeline', mode: 'light', stations: 'rounded', card: 'soft', celebration: 'stars', buddy: '', icon: '📚' } },
  { name: 'שקיעה', icon: '🌅', theme: { color: '#f76707', background: 'sunset', font: 'bold', map: 'road', mode: 'light', stations: 'hex', card: 'glass', celebration: 'balloons', buddy: '🦊', icon: '🏝️' } },
  { name: 'לילה רגוע', icon: '🌙', theme: { color: '#5c7cfa', background: 'plain', font: 'rounded', map: 'timeline', mode: 'dark', stations: 'circle', card: 'soft', celebration: 'stars', buddy: '🐢', icon: '🌟' } },
];

export const ICONS = [
  '🚀', '🌈', '🦄', '🐢', '🦁', '⚽', '🎨', '📚', '🧩', '🌟', '🌱', '🏝️', '🐙', '🎵', '🔬', '🏰',
  '🪐', '🦖', '🐝', '🦋', '🍎', '🚂', '🎈', '🧪', '🌍', '🐬', '🌻', '🏆', '🎮', '🧸', '🍕', '🔢',
];
export const TASK_EMOJIS = ['📖', '✏️', '🎧', '🎬', '🤔', '💬', '✅', '⏱️', '🧮', '🎨', '🔍', '🧠', '🎒', '🌟', '🏃', '🧩'];

export const TASK_TYPES = {
  read: { group: 'basic', name: 'קריאה / הסבר', icon: '📖', desc: 'טקסט הסבר או הוראות, עם תמונה אופציונלית' },
  link: { group: 'basic', name: 'סרטון / קישור', icon: '🎬', desc: 'סרטון יוטיוב (מוטמע) או קישור לאתר' },
  question: { group: 'basic', name: 'שאלה פתוחה', icon: '💬', desc: 'התלמיד/ה כותב/ת תשובה שתגיע אלייך' },
  choice: { group: 'basic', name: 'שאלה אמריקאית', icon: '🤔', desc: 'בחירה מכמה תשובות, עם משוב מיידי' },
  checklist: { group: 'basic', name: 'רשימת צעדים', icon: '✅', desc: 'פירוק משימה לצעדים קטנים לסימון' },
  timer: { group: 'basic', name: 'זמן עבודה מרוכז', icon: '⏱️', desc: 'שעון עצר לעבודה ממוקדת לזמן קצוב' },
  memory: { group: 'game', name: 'משחק זיכרון', icon: '🃏', desc: 'הופכים קלפים ומחפשים זוגות תואמים' },
  wordsearch: { group: 'game', name: 'תפזורת', icon: '🔍', desc: 'מוצאים מילים מוסתרות בטבלת אותיות' },
  matching: { group: 'game', name: 'התאמה', icon: '🔗', desc: 'מחברים כל פריט לבן הזוג שלו' },
  order: { group: 'game', name: 'סידור לפי הסדר', icon: '🔢', desc: 'מסדרים שלבים, מילים במשפט או אירועים' },
  blanks: { group: 'game', name: 'השלמת מילים', icon: '🧩', desc: 'משלימים מילים חסרות מתוך מחסן מילים' },
  truefalse: { group: 'game', name: 'נכון / לא נכון', icon: '⚖️', desc: 'מחליטים על כל משפט אם הוא נכון' },
};

export const TASK_GROUPS = [
  ['basic', 'משימות'],
  ['game', 'משחקים ותרגול'],
];

// Hebrew vowel points for the nikud keyboard. "insert" is what a button adds after the letter.
export const NIKUD = [
  { insert: '\u05B8', name: 'קָמָץ' },
  { insert: '\u05B7', name: 'פַּתָח' },
  { insert: '\u05B5', name: 'צֵירֵה' },
  { insert: '\u05B6', name: 'סֶגּוֹל' },
  { insert: '\u05B4', name: 'חִירִיק' },
  { insert: '\u05B9', name: 'חוֹלָם' },
  { insert: '\u05BB', name: 'קֻבּוּץ' },
  { insert: '\u05BC', name: 'דָּגֵשׁ / שׁוּרוּק' },
  { insert: '\u05B0', name: 'שְׁוָא' },
  { insert: '\u05B2', name: 'חֲטַף פַּתָח' },
  { insert: '\u05B1', name: 'חֲטַף סֶגּוֹל' },
  { insert: '\u05B3', name: 'חֲטַף קָמָץ' },
  { insert: '\u05C1', name: 'שִׁי"ן יְמָנִית' },
  { insert: '\u05C2', name: 'שִׂי"ן שְׂמָאלִית' },
  { insert: 'וֹ', name: 'חוֹלָם מָלֵא', letter: true },
  { insert: 'וּ', name: 'שׁוּרוּק', letter: true },
];

export const stripNikud = (s) => String(s).replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, '');

export const BREAK_IDEAS = [
  { icon: '🙆', text: 'מתיחה גדולה – ידיים למעלה!' },
  { icon: '💧', text: 'לשתות כמה לגימות מים' },
  { icon: '🌬️', text: '5 נשימות עמוקות ואיטיות' },
  { icon: '🦘', text: '10 קפיצות במקום' },
  { icon: '👀', text: 'להסתכל מהחלון על משהו רחוק' },
  { icon: '🤸', text: 'לסובב כתפיים 5 פעמים' },
];

export function fontFamily(font) {
  return (FONTS.find((f) => f.value === font) || FONTS[0]).family;
}

// Applies a path theme to a container as CSS variables + classes.
// Applies a path theme to a container as CSS variables + classes. `surfaces: false` keeps
// the container light (dashboard cards sit on the teacher's page, not in the student's world).
export function applyTheme(el, theme, { surfaces = true } = {}) {
  const dark = surfaces && theme.mode === 'dark';
  el.style.setProperty('--accent', theme.color);
  // Derived shades must be recomputed here, otherwise they inherit :root's default accent.
  el.style.setProperty('--accent-soft', dark ? `color-mix(in srgb, ${theme.color} 28%, #14122a)` : `color-mix(in srgb, ${theme.color} 14%, white)`);
  el.style.setProperty('--accent-strong', dark ? `color-mix(in srgb, ${theme.color} 55%, white)` : `color-mix(in srgb, ${theme.color} 80%, black)`);
  el.style.setProperty('--path-font', `${fontFamily(theme.font)}, system-ui, sans-serif`);
  const prefixes = ['bg-', 'mode-', 'stations-', 'card-'];
  for (const c of [...el.classList]) if (prefixes.some((p) => c.startsWith(p))) el.classList.remove(c);
  el.classList.add(`bg-${theme.background}`);
  if (surfaces) el.classList.add(`mode-${theme.mode || 'light'}`, `stations-${theme.stations || 'circle'}`, `card-${theme.card || 'soft'}`);
}

// Turns a YouTube URL into an embeddable privacy-friendly URL, or null.
export function youtubeEmbed(url) {
  if (DEMO) return null; // the demo's frame cannot embed other sites; it shows a link instead
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
    else if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/) || [])[1];
    }
    return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}
