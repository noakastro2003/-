// Messages to the parents' WhatsApp group, written in Noa's own style
// (openings, bold headings with emoji, bullet lists and closings taken from her messages).

const SKIP = /מפגש בוקר|^צוות|ישיבה|השתלמות|^פרטני|^א['׳]1$/;
export const PM_TYPES = [
  ['today', 'book', 'סיכום היום'],
  ['week', 'calendar', 'עדכון שבועי'],
  ['dict', 'text', 'מילים להכתבה'],
  ['gear', 'backpack', 'ציוד למחר'],
  ['test', 'target', 'תזכורת למבדק'],
  ['bday', 'cake', 'ימי הולדת'],
];

const greet = d => { const h = d.getHours(); return h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : 'ערב טוב'; };
export const opener = d => `הורים יקרים, ${greet(d)} 🌷`;
export function closing(d) {
  const dow = d.getDay(), h = d.getHours();
  if (dow === 5) return 'שבת שלום, רגועה ושקטה לכולנו! 🌸';
  if (dow === 6) return '*שיהיה לכולנו שבוע נפלא! ❤️*';
  return h < 17 ? 'המשך יום נפלא❤️' : 'המשך ערב נעים 🌷';
}
const subj = (p, look) => { const n = look(p).n; return n === 'מתמטיקה' ? 'חשבון' : n; };
const topicOf = t => String(t || '').replace(/["״]/g, '').replace(/\(\d+\)/g, '').split(/[:–-]/)[0].trim();

// homework lines grouped by subject: "* חשבון: חוברת שבילים 6, עמודים 72–75."
function hwLines(periods, look) {
  const by = new Map();
  for (const p of periods) for (const h of p.homework) { const s = subj(p, look); by.set(s, [...(by.get(s) || []), h]); }
  return [...by].map(([s, hs]) => `* ${s}: ${hs.join(', ')}`);
}

export function buildToday({ day, look, at, opts }) {
  const ps = day.periods.filter(p => !SKIP.test(p.title) && !SKIP.test(look(p).n));
  const out = [opener(at), ''];
  if (opts.learned !== false && ps.length) {
    out.push('*📝 מה למדנו היום?*');
    const by = new Map();
    for (const p of ps) { const s = subj(p, look); const t = topicOf(p.title); if (t && !(by.get(s) || []).includes(t)) by.set(s, [...(by.get(s) || []), t]); }
    for (const [s, ts] of by) out.push(`* ${s}: ${ts.join(', ')}`);
    out.push('');
  }
  if (opts.hw !== false) {
    const hw = hwLines(day.periods, look);
    out.push('*📚 שיעורי בית:*', ...(hw.length ? hw : ['היום לא ניתנו שיעורי בית.']), '');
  }
  if (opts.help !== false) out.push('כמובן כאן לעזרה ושאלות אם עולה צורך', '');
  out.push(closing(at));
  return out;
}

export function buildWeek({ w, look, at, kids, opts }) {
  const out = ['*הורים יקרים, שבוע טוב! ❤️🌷*', '', 'כמה עדכונים לקראת השבוע הקרוב:', ''];
  const all = w.days.flatMap(d => d.periods.map(p => ({ d, p })));
  if (opts.learn !== false) {
    const by = new Map();
    for (const { p } of all) {
      if (SKIP.test(p.title) || SKIP.test(look(p).n)) continue;
      const s = subj(p, look), t = topicOf(p.title);
      if (!t) continue;
      const m = by.get(s) || new Map(); m.set(t, (m.get(t) || 0) + 1); by.set(s, m);
    }
    if (by.size) {
      out.push('*📝 מה נלמד השבוע?*');
      for (const [s, m] of by) out.push(`* ${s}: ${[...m].sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]).join(', ')}`);
      out.push('');
    }
  }
  if (opts.hw !== false) {
    const hw = w.days.flatMap(d => d.periods.filter(p => p.homework.length).map(p => `* ${subj(p, look)} (יום ${d.name}): ${p.homework.join(', ')}`));
    if (hw.length) out.push('*📚 שיעורי בית:*', ...hw, '');
  }
  if (opts.events !== false) {
    const ev = [];
    for (const { d, p } of all) {
      const txt = `${p.title} ${p.subtitle}`;
      if (/הכתבה/.test(txt)) ev.push(`* ביום ${d.name} – הכתבה ✍️`);
      else if (/מבדק|משימת הערכה|מבחן/.test(txt)) ev.push(`* ביום ${d.name} – ${topicOf(p.title)} 📝`);
      else if (/מסיב|טיול|יום הליכה|טקס(?!ט)|שובר שגרה|חגיג/.test(txt)) ev.push(`* ביום ${d.name} – ${topicOf(p.title)} 🎉`);
    }
    const bdays = [];
    for (const d of w.days) {
      if (!d.date) continue;
      const ks = kids.filter(k => k.bd === d.date.split('.').map(Number).join('.'));
      if (ks.length) bdays.push(`* ביום ${d.name} – יום הולדת ל${ks.map(k => k.name).join(' ול')} 🎂`);
    }
    if (ev.length || bdays.length) out.push('*📌 חשוב לזכור:*', ...[...new Set(ev)], ...bdays, '');
  }
  if (opts.gear && opts.gear.length) out.push('לצורך הפעילויות, אבקש לצייד את הילדים ב:', ...opts.gear.map(g => `* ${g}`), 'במידה וישנה בעייה בהשגת הציוד עדכנו אותי🙏🏻', '');
  out.push(closing(at));
  return out;
}

export function buildDict({ opts }) {
  const words = opts.words || [];
  return ['מצרפת את מילות ההכתבה לשבוע הבא:', 'כבר נמצא גם במחברות של הילדים', '',
    ...(opts.topic ? [`הנושא: ${opts.topic}`, ''] : []),
    ...words, '',
    'יש להתאמן עם הילדים על המילים על ידי כתיבה של המילים, הקראה שלהן בקול ולאחר מכן כתיבה חוזרת בעזרת השמיעה. מומלץ לעשות את זה כמה פעמים❤️'];
}

export function buildGear({ day, at, opts }) {
  const g = opts.gear || [];
  return [opener(at), '', `לקראת מחר${day ? ` (יום ${day.name})` : ''}, לצורך הפעילויות, אבקש לצייד את הילדים ב:`, ...(g.length ? g.map(x => `* ${x}`) : ['* ']), '',
    'במידה וישנה בעייה בהשגת הציוד לקראת מחר עדכנו אותי🙏🏻', '', closing(at)];
}

export function buildTest({ opts }) {
  const topics = (opts.topics || []).filter(Boolean);
  return ['*הורים יקרים* 🌸', `מזכירה ש${opts.when ? opts.when + ' ' : ''}יתקיים ${opts.what || 'מבדק'}.`,
    ...(topics.length ? ['', 'בשבוע זה נבדוק את הנושאים הבאים. חשוב מאוד לתרגל ולחזור עליהם גם בבית:', ...topics.map(t => `📌${t}`)] : []),
    '', 'מומלץ להקדיש מעט זמן לחזרה ותרגול לקראתו.', 'נא לא לאחר ❤️🙏🏻', '', 'בהצלחה לכולם! ❤️📖'];
}

export function buildBday({ opts }) {
  const n = opts.names || [];
  return ['הורים יקרים 🌸', '',
    `*🎂 חגיגת ימי הולדת${opts.when ? ' – ' + opts.when : ''}*`,
    `${opts.when ? opts.when.replace(/^יום/, 'ביום') : 'בקרוב'} נחגוג יחד את יום ההולדת ${opts.month ? `לילידי חודש ${opts.month}` : ''}: *${n.length ? (n.length > 1 ? n.slice(0, -1).join(', ') + ' ו' + n[n.length - 1] : n[0]) : '…'}!*🥳🎈`, '',
    '*איך נערכים ומה מביאים?*', 'הורי הילדים החוגגים יחלקו ביניהם את הכיבוד:', '',
    '* עוגה *פרווה* 🎂', '* טרופיות 🧃', '* סוכריות טופי / מרשמלו 🍬', '* מפיות', '* חבילת מגבונים', '',
    'אם תרצו להביא דבר מה נוסף, אבקש לעדכן אותי בפרטי מראש, כדי שאוכל לוודא שהוא מתאים להנחיות האלרגיה בבית הספר.', '',
    '*הורי הילדים החוגגים – אנא אשרו את ההודעה בפרטי. ❤️*', '', 'תודה רבה על שיתוף הפעולה וההיענות!'];
}
