// Design options shared by the teacher's design editor and the student view.

export const COLORS = [
  { value: '#6c5ce7', name: 'סגול' },
  { value: '#0984e3', name: 'כחול' },
  { value: '#00a884', name: 'ירוק' },
  { value: '#e17055', name: 'כתום' },
  { value: '#d63384', name: 'ורוד' },
  { value: '#2d3436', name: 'כהה' },
];

export const BACKGROUNDS = [
  { value: 'plain', name: 'חלק' },
  { value: 'dots', name: 'נקודות' },
  { value: 'grid', name: 'משבצות' },
  { value: 'waves', name: 'גלים' },
  { value: 'stars', name: 'כוכבים' },
];

export const FONTS = [
  { value: 'rounded', name: 'עגול וידידותי', family: "'Varela Round'" },
  { value: 'handwriting', name: 'כתב יד', family: "'Playpen Sans Hebrew'" },
  { value: 'bold', name: 'כותרות בולטות', family: "'Secular One'" },
  { value: 'clean', name: 'דפוס ברור', family: "'Rubik'" },
];

export const MAPS = [
  { value: 'road', name: 'דרך מתפתלת', icon: '〰️' },
  { value: 'cards', name: 'כרטיסים', icon: '🗂️' },
];

export const ICONS = ['🚀', '🌈', '🦄', '🐢', '🦁', '⚽', '🎨', '📚', '🧩', '🌟', '🌱', '🏝️', '🐙', '🎵', '🔬', '🏰'];
export const TASK_EMOJIS = ['📖', '✏️', '🎧', '🎬', '🤔', '💬', '✅', '⏱️', '🧮', '🎨', '🔍', '🧠', '🎒', '🌟', '🏃', '🧩'];

export const TASK_TYPES = {
  read: { name: 'קריאה / הסבר', icon: '📖', desc: 'טקסט הסבר או הוראות, עם תמונה אופציונלית' },
  link: { name: 'סרטון / קישור', icon: '🎬', desc: 'סרטון יוטיוב (מוטמע) או קישור לאתר' },
  question: { name: 'שאלה פתוחה', icon: '💬', desc: 'התלמיד/ה כותב/ת תשובה שתגיע אלייך' },
  choice: { name: 'שאלה אמריקאית', icon: '🤔', desc: 'בחירה מכמה תשובות, עם משוב מיידי' },
  checklist: { name: 'רשימת צעדים', icon: '✅', desc: 'פירוק משימה לצעדים קטנים לסימון' },
  timer: { name: 'זמן עבודה מרוכז', icon: '⏱️', desc: 'שעון עצר לעבודה ממוקדת לזמן קצוב' },
};

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
export function applyTheme(el, theme) {
  el.style.setProperty('--accent', theme.color);
  // Derived shades must be recomputed here, otherwise they inherit :root's default accent.
  el.style.setProperty('--accent-soft', `color-mix(in srgb, ${theme.color} 14%, white)`);
  el.style.setProperty('--accent-strong', `color-mix(in srgb, ${theme.color} 80%, black)`);
  el.style.setProperty('--path-font', `${fontFamily(theme.font)}, system-ui, sans-serif`);
  for (const c of [...el.classList]) if (c.startsWith('bg-')) el.classList.remove(c);
  el.classList.add(`bg-${theme.background}`);
}

// Turns a YouTube URL into an embeddable privacy-friendly URL, or null.
export function youtubeEmbed(url) {
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
