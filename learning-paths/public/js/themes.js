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
  question: { group: 'basic', name: 'שאלה פתוחה', icon: '💬', desc: 'התלמידים כותבים תשובה, והיא מגיעה אליכם' },
  photo: { group: 'basic', name: 'צילום עבודה', icon: '📷', desc: 'עובדים במחברת, מצלמים ושולחים אליכם' },
  draw: { group: 'basic', name: 'לוח ציור', icon: '🎨', desc: 'מציירים או כותבים ביד על המסך' },
  voice: { group: 'basic', name: 'תשובה בקול', icon: '🎤', desc: 'התלמידים מקליטים תשובה במקום לכתוב, ואתם מקשיבים' },
  choice: { group: 'basic', name: 'שאלה אמריקאית', icon: '🤔', desc: 'בחירה מכמה תשובות, עם משוב מיידי' },
  checklist: { group: 'basic', name: 'רשימת צעדים', icon: '✅', desc: 'פירוק משימה לצעדים קטנים לסימון' },
  timer: { group: 'basic', name: 'זמן עבודה מרוכז', icon: '⏱️', desc: 'שעון עצר לעבודה ממוקדת לזמן קצוב' },
  memory: { group: 'game', name: 'משחק זיכרון', icon: '🃏', desc: 'הופכים קלפים ומחפשים זוגות תואמים' },
  wordsearch: { group: 'game', name: 'תפזורת', icon: '🔍', desc: 'מוצאים מילים מוסתרות בטבלת אותיות' },
  matching: { group: 'game', name: 'התאמה', icon: '🔗', desc: 'מחברים כל פריט לבן הזוג שלו' },
  order: { group: 'game', name: 'סידור לפי הסדר', icon: '🔢', desc: 'מסדרים שלבים, מילים במשפט או אירועים' },
  blanks: { group: 'game', name: 'השלמת מילים', icon: '🧩', desc: 'משלימים מילים חסרות מתוך מחסן מילים' },
  truefalse: { group: 'game', name: 'נכון / לא נכון', icon: '⚖️', desc: 'מחליטים על כל משפט אם הוא נכון' },
  lines: { group: 'game', name: 'מתיחת קו', icon: '〰️', desc: 'גוררים קו מכל פריט לבן הזוג שלו' },
  sort: { group: 'game', name: 'מיון לקבוצות', icon: '🗂️', desc: 'מכניסים כל פריט לקופסה הנכונה' },
  dictation: { group: 'game', name: 'הכתבה', icon: '✍️', desc: 'שומעים מילה ומקלידים אותה. בלי לחשוש מניקוד' },
  numberline: { group: 'game', name: 'ישר מספרים', icon: '📏', desc: 'שמים מספרים או שברים במקום הנכון על הישר' },
  hotspot: { group: 'game', name: 'סימון על תמונה', icon: '🎯', desc: 'לוחצים על המקום הנכון במפה, בגוף או בתמונה' },
  highlight: { group: 'game', name: 'סימון מילים בטקסט', icon: '🖍️', desc: 'מסמנים בטקסט, למשל את כל הפעלים' },
  flashcards: { group: 'game', name: 'כרטיסיות', icon: '🎴', desc: 'הופכים כרטיס: מילה ופירוש, תרגיל ותשובה' },
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

// Keep in step with MOODS in logic.js (a test checks it).
export const MOODS = [
  { e: '😄', name: 'שמח' }, { e: '🙂', name: 'בסדר' }, { e: '😐', name: 'ככה ככה' }, { e: '😴', name: 'עייף' },
  { e: '😟', name: 'מודאג', worry: true }, { e: '😢', name: 'עצוב', worry: true }, { e: '😠', name: 'כועס', worry: true },
];

// Guided breaks. A step either counts up to `count` (one a second) or runs for `secs`.
// anim: how the big emoji moves (bounce, grow, shrink, spin, sway, inflate, deflate).
export const MOVE_BREAKS = [
  { icon: '🦘', title: 'קפיצות קנגורו', steps: [{ text: 'קופצים במקום!', count: 10, anim: 'bounce' }] },
  { icon: '🙆', title: 'מתיחה גדולה', steps: [
    { text: 'ידיים למעלה, הכי גבוה שאפשר', secs: 5, anim: 'grow' },
    { text: 'עכשיו מתכופפים ונוגעים בבהונות', secs: 5, anim: 'shrink' },
    { text: 'ושוב ידיים למעלה!', secs: 5, anim: 'grow' }] },
  { icon: '🤸', title: 'סיבובי כתפיים', steps: [
    { text: 'מסובבים כתפיים קדימה', count: 5, anim: 'spin' },
    { text: 'ועכשיו אחורה', count: 5, anim: 'spin' }] },
  { icon: '🦩', title: 'פלמינגו', steps: [
    { text: 'עומדים על רגל אחת', secs: 10, anim: 'sway' },
    { text: 'ועכשיו על הרגל השנייה', secs: 10, anim: 'sway' }] },
  { icon: '🤖', title: 'הרובוט אומר', steps: [
    { text: 'יד על הראש', secs: 3, anim: 'bounce' }, { text: 'יד על האף', secs: 3, anim: 'bounce' },
    { text: 'ידיים על הכתפיים', secs: 3, anim: 'bounce' }, { text: 'ידיים על הברכיים', secs: 3, anim: 'bounce' },
    { text: 'מוחאים כפיים!', count: 5, anim: 'bounce' }] },
  { icon: '🏃', title: 'ריצה במקום', steps: [{ text: 'רצים במקום, ברכיים גבוה!', secs: 15, anim: 'bounce' }] },
];
const BREATH = [
  { text: 'שואפים לאט… הבלון מתנפח', secs: 4, anim: 'inflate' },
  { text: 'נושפים לאט… הבלון מתרוקן', secs: 4, anim: 'deflate' },
];
export const CALM_BREAKS = [
  { icon: '🎈', title: 'נשימת בלון', steps: [...BREATH, ...BREATH, ...BREATH, ...BREATH] },
  { icon: '👀', title: '5 דברים', steps: [
    { text: 'מצאו 5 דברים שאתם רואים', secs: 10 }, { text: 'מצאו 4 דברים שאפשר לגעת בהם', secs: 8 },
    { text: 'הקשיבו ל-3 צלילים', secs: 8 }, { text: 'נשימה עמוקה אחת', secs: 4, anim: 'inflate' }] },
  { icon: '💧', title: 'שתיית מים', steps: [{ text: 'שותים כמה לגימות מים', secs: 15 }] },
  { icon: '🐢', title: 'צב רגוע', steps: [
    { text: 'עוצמים עיניים ומכווצים את כל הגוף כמו צב בשריון', secs: 5, anim: 'shrink' },
    { text: 'משחררים לאט', secs: 5, anim: 'grow' },
    { text: 'עוד פעם: מכווצים…', secs: 5, anim: 'shrink' },
    { text: 'ומשחררים', secs: 5, anim: 'grow' }] },
];

// Stickers for the album: one per task, in an order that depends on the path.
export const STICKERS = ['🦄', '🐉', '🦋', '🐬', '🦊', '🐼', '🦁', '🐸', '🐙', '🦕', '🐝', '🦜', '🌈', '🌵', '🍉', '🍩',
  '🧁', '🍭', '🚀', '🛸', '🎸', '🎨', '⚽', '🏀', '🎯', '🧩', '🪁', '🎠', '🏰', '🌋', '🌻', '🍄', '🐳', '🦒', '🦔', '🐧',
  '🦉', '🐞', '🍓', '🥨', '🎪', '🚂', '⛵', '🪐', '⭐', '💎', '👑', '🎁'];
export function stickerFor(code, index) {
  let seed = [...String(code)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const list = [...STICKERS];
  for (let i = list.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const j = seed % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list[index % list.length];
}

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
