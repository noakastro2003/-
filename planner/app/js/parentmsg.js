// Messages to the parents' WhatsApp group, written in Noa's own style
// (openings, bold headings with emoji, bullet lists and closings taken from her messages).

const SKIP = /מפגש בוקר|^צוות|ישיבה|השתלמות|^פרטני|^א['׳]1$/;
export const PM_TYPES = [
  ['all', 'sparkle', 'הכל בהודעה אחת'],
  ['today', 'book', 'סיכום היום'],
  ['week', 'calendar', 'עדכון שבועי'],
  ['dict', 'text', 'מילים להכתבה'],
  ['gear', 'backpack', 'ציוד למחר'],
  ['test', 'target', 'תזכורת למבדק'],
  ['bday', 'cake', 'ימי הולדת'],
  ['personal', 'user', 'הודעה אישית'],
  ['forms', 'check', 'מי לא החזיר?'],
  ['change', 'grid', 'שינוי במערכת'],
  ['holiday', 'star', 'ברכה לחג'],
  ['mine', 'heart', 'התבניות שלי'],
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

// ---- everything in one message: learned, homework, dictation, tests, birthdays, gear, events
export function autoTests(w) {
  return w.days.flatMap(d => d.periods.filter(p => /מבדק|משימת הערכה|מבחן/.test(`${p.title} ${p.subtitle}`)).map(p => `ביום ${d.name}${d.date ? ' ' + d.date : ''} – ${topicOf(p.title)}`));
}
export function autoEvents(w) {
  const ev = [];
  for (const d of w.days) for (const p of d.periods) {
    const txt = `${p.title} ${p.subtitle}`;
    if (/הכתבה/.test(txt)) ev.push(`ביום ${d.name} – הכתבה ✍️`);
    else if (/מסיב|טיול|יום הליכה|טקס(?!ט)|שובר שגרה|חגיג/.test(txt)) ev.push(`ביום ${d.name} – ${topicOf(p.title)} 🎉`);
  }
  return [...new Set(ev)];
}
export function weekBdays(w, kids) {
  const out = [];
  for (const d of w.days) {
    if (!d.date) continue;
    const key = d.date.split('.').map(Number).join('.');
    for (const k of kids) if (k.bd === key) out.push(k.name);
  }
  return out;
}
const andJoin = n => (n.length > 1 ? n.slice(0, -1).join(', ') + ' ו' + n[n.length - 1] : n[0] || '');

export function buildAll({ w, day, look, at, opts }) {
  const on = k => opts[k] !== false;
  const isDay = opts.scope === 'day' && day;
  const days = isDay ? [day] : w.days;
  const out = [isDay ? opener(at) : '*הורים יקרים, שבוע טוב! ❤️🌷*', '', isDay ? 'מצרפת את סיכום היום והודעות חשובות להמשך:' : 'כמה עדכונים לקראת השבוע הקרוב:', ''];
  const short = opts.len === 'short';
  if (on('learn') && !short) {
    const by = new Map();
    for (const d of days) for (const p of d.periods) {
      if (SKIP.test(p.title) || SKIP.test(look(p).n)) continue;
      const s = subj(p, look), t = topicOf(p.title); if (!t) continue;
      const m = by.get(s) || new Map(); m.set(t, (m.get(t) || 0) + 1); by.set(s, m);
    }
    if (by.size) {
      out.push(isDay ? '*📝 מה למדנו היום?*' : '*📝 מה נלמד השבוע?*');
      for (const [s, m] of by) out.push(`* ${s}: ${[...m].sort((a, b) => b[1] - a[1]).slice(0, isDay ? 3 : 2).map(x => x[0]).join(', ')}`);
      out.push('');
    }
  }
  if (on('hw')) {
    const hw = days.flatMap(d => d.periods.filter(p => p.homework.length).map(p => `* ${subj(p, look)}${isDay ? '' : ` (יום ${d.name})`}: ${p.homework.join(', ')}`));
    out.push('*📚 שיעורי בית:*', ...(hw.length ? hw : [isDay ? 'היום לא ניתנו שיעורי בית.' : 'יפורסמו במהלך השבוע.']), '');
  }
  if (on('dict') && (opts.words || []).length) {
    if (short) out.push('*✍️ מילים להכתבה' + (opts.dictWhen ? ` – ${opts.dictWhen}` : '') + ':*', opts.words.join(', '), '');
    else out.push('*✍️ מילים להכתבה*' + (opts.dictWhen ? ` – ${opts.dictWhen}` : ''), ...(opts.topic ? [`הנושא: ${opts.topic}`] : []), '', ...opts.words, '',
      'מומלץ להתאמן על ידי כתיבה של המילים, הקראה שלהן בקול ולאחר מכן כתיבה חוזרת בעזרת השמיעה❤️', '');
  }
  if (on('tests') && (opts.tests || []).length) {
    out.push('*📝 מבדקים:*', ...opts.tests.map(t => `* ${t}`), ...(short ? [] : ['מומלץ להקדיש מעט זמן לחזרה ותרגול לקראתם.']), '');
  }
  if (on('events') && (opts.events || []).length) out.push('*📌 חשוב לזכור:*', ...opts.events.map(t => `* ${t}`), '');
  if (on('bday') && (opts.names || []).length) {
    out.push('*🎂 חגיגת ימי הולדת*', `${opts.bdayWhen ? opts.bdayWhen.replace(/^יום/, 'ביום') + ' ' : ''}נחגוג יחד את יום ההולדת של *${andJoin(opts.names)}!*🥳🎈`);
    if (on('treats') && !short) out.push('הורי הילדים החוגגים יחלקו ביניהם את הכיבוד:', '* עוגה *פרווה* 🎂', '* טרופיות 🧃', '* סוכריות טופי / מרשמלו 🍬', '* מפיות', '* חבילת מגבונים',
      '*הורי הילדים החוגגים – אנא אשרו את ההודעה בפרטי. ❤️*');
    out.push('');
  }
  if (on('gear') && (opts.gear || []).length) out.push('*🎒 ציוד:*', 'לצורך הפעילויות, אבקש לצייד את הילדים ב:', ...opts.gear.map(g => `* ${g}`), 'במידה וישנה בעייה בהשגת הציוד עדכנו אותי🙏🏻', '');
  if (opts.len === 'long') out.push('כמובן כאן לעזרה ושאלות אם עולה צורך', '');
  out.push('תודה על שיתוף הפעולה!', closing(at));
  return out;
}

// ---- personal message to one parent, from the class journal
export function buildPersonal({ at, opts }) {
  const name = opts.kid || '…', notes = (opts.notes || []).filter(Boolean), extra = (opts.extra || '').trim();
  const body = [...notes, ...(extra ? [extra] : [])];
  if (opts.kind === 'star') return [`היי, ${greet(at)} 🌸`, '', `רציתי לשתף ש${name}${body.length ? ' ' + body.join(', ') : ' …'}.`, '', `כל הכבוד ל${name}! אני גאה מאוד 💛`, '', closing(at)];
  return [`היי, ${greet(at)} 🌸`, '', `רציתי לעדכן ש${body.length ? body.join(', ') : '…'}.`, '', 'אשמח שנדבר, אני זמינה בין השעות 18:00–20:00 📱', 'כמובן כאן לעזרה ושאלות אם עולה צורך', '', closing(at)];
}

// ---- forms / approvals that were not returned yet
export function buildForms({ opts }) {
  const t = opts.title || 'אישור ההורים';
  return ['הורים יקרים 🌷', 'מזכירה 🙏🏻', `נותרו מספר ילדים שלא החזירו את ${t}. בבקשה להחזיר אותו חתום מחר עם הילדים.`, '', 'תודה רבה על שיתוף הפעולה 🌸'];
}
export const formPersonal = (title, kid) => `היי 🌸\nמזכירה להחזיר את ${title || 'אישור ההורים'} חתום מחר עם ${kid} 🙏🏻\nתודה רבה!`;

// ---- schedule changes
export function buildChange({ at, opts }) {
  const ch = opts.lines || [];
  return ['הורים יקרים 🌸', 'מעדכנת על שינוי במערכת השעות, שימו לב:', '', ...(ch.length ? ch.map(x => `* ${x}`) : ['* ']), '', 'המערכת תעודכן גם בגדול בכיתה.', closing(at)];
}

// ---- holidays (found with the Hebrew calendar built into the phone)
const HOLIDAYS = [['Tishri', 1, 'ראש השנה'], ['Tishri', 10, 'יום כיפור'], ['Tishri', 15, 'סוכות'], ['Tishri', 22, 'שמחת תורה'], ['Kislev', 25, 'חנוכה'], ['Shevat', 15, 'ט״ו בשבט'],
  ['Adar', 14, 'פורים'], ['Adar II', 14, 'פורים'], ['Nisan', 15, 'פסח'], ['Iyar', 5, 'יום העצמאות'], ['Iyar', 18, 'ל״ג בעומר'], ['Sivan', 6, 'שבועות']];
export const HOLIDAY_NAMES = ['ראש השנה', 'יום כיפור', 'סוכות', 'שמחת תורה', 'חנוכה', 'ט״ו בשבט', 'פורים', 'פסח', 'יום העצמאות', 'ל״ג בעומר', 'שבועות', 'שבת'];
export function nextHoliday(from, within = 25) {
  let f; try { f = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long' }); } catch { return null; }
  for (let i = 0; i <= within; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
    const h = HOLIDAYS.find(([m, dd]) => m === p.month && dd === +p.day);
    if (h) return { name: h[2], date: d, inDays: i };
  }
  return null;
}
const WISH = {
  'ראש השנה': ['שנה טובה ומתוקה! 🍎🍯', 'חג שמח! 🎊'], 'יום כיפור': ['גמר חתימה טובה וצום קל ומועיל למי שצם 🤍', 'שנה טובה וחתימה טובה,'],
  'סוכות': ['חג סוכות שמח! 🌿🍋', 'חג שמח!'], 'שמחת תורה': ['חג שמח! 📜✨', 'חג שמח!'], 'חנוכה': ['חנוכה שמח ומואר! 🕎✨', 'חג אורים שמח!'],
  'ט״ו בשבט': ['ט״ו בשבט שמח! 🌳', 'חג שמח!'], 'פורים': ['פורים שמח! 🎭', 'חג שמח!'], 'פסח': ['חג פסח כשר ושמח! 🍷', 'חג שמח!'],
  'יום העצמאות': ['יום עצמאות שמח! 🇮🇱', 'חג שמח!'], 'ל״ג בעומר': ['ל״ג בעומר שמח! 🔥', 'חג שמח!'], 'שבועות': ['חג שבועות שמח! 🌾🧀', 'חג שמח!'],
};
export function buildHoliday({ opts }) {
  const h = opts.holiday || 'שבת';
  if (h === 'שבת') return ['הורים יקרים 🌸', '', opts.extra || 'תודה על שבוע מלא בעשייה ושיתוף פעולה.', '', 'שבת שלום, רגועה ושקטה לכולנו! 🌸'];
  const [wish, end] = WISH[h] || ['חג שמח!', 'חג שמח!'];
  return ['הורים יקרים,', '', `לקראת ${h}, אני רוצה לאחל לכם ולמשפחותיכם ${wish}`, ...(opts.extra ? ['', opts.extra] : []), '',
    'תודה על האמון והשותפות שלכם. אני כאן עבורכם תמיד לכל דבר שצריך!', end];
}

// ---- style helpers: openings/closings taken from Noa's messages, length, emoji
export const OPENERS = ['הורים יקרים 🌷', 'הורים יקרים 🌸', 'צהריים טובים לכולם❤️', 'ערב טוב לכולם❤️', 'הורים יקרים, אחר הצהריים טובים 🌷', '*הורים יקרים, שבוע טוב! ❤️🌷*'];
export const CLOSERS = ['המשך יום נפלא❤️', 'המשך ערב נעים 🌷', 'המשך יום טוב❤️', 'תודה רבה על שיתוף הפעולה 🌸', 'שבת שלום, רגועה ושקטה לכולנו! 🌸', '*שיהיה לכולנו שבוע נפלא! ❤️*'];
export const stripEmoji = s => s.replace(/(\p{Extended_Pictographic}|\p{Emoji_Modifier}|️|‍|[\u{1F1E6}-\u{1F1FF}]|[0-9]️?⃣)/gu, '').replace(/ +\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\* +\*/g, '').replace(/^\*\s+([^*\n]+\*)/gm, '*$1');
export function waHtml(t) {
  const e = t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return e.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,!?:)]|$)/gm, '$1<b>$2</b>').replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,!?:)]|$)/gm, '$1<i>$2</i>')
    .replace(/(^|[\s(])~([^~\n]+)~(?=[\s.,!?:)]|$)/gm, '$1<s>$2</s>').replace(/\n/g, '<br>');
}
