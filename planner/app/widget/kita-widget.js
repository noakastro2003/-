// "הכיתה שלי" – ווידג'ט + התראת בוקר לאייפון (לאפליקציית Scriptable)
//
// התקנה (פעם אחת):
// 1. מתקינים את Scriptable מה-App Store (חינם).
// 2. ב-Scriptable: + (סקריפט חדש) ← מדביקים את כל הקובץ הזה ← קוראים לסקריפט: הכיתה שלי
// 3. במסך הבית: לחיצה ארוכה ← + ← Scriptable ← בוחרים גודל ← עריכת הווידג'ט ← Script: הכיתה שלי
//
// עדכון כל שבוע: באפליקציה "הכיתה שלי" ← עוד ← הגדרות ← "עדכון הווידג'ט וההתראות".

const APP_URL = 'https://noa-hakita.netlify.app/';
const FILE = 'kita-week.json';

// ---------------------------------------------------------------- data
const fm = FileManager.local();
const path = fm.joinPath(fm.documentsDirectory(), FILE);
function loadWeek() {
  if (!fm.fileExists(path)) return null;
  try { return JSON.parse(fm.readString(path)); } catch (e) { return null; }
}

// ---------------------------------------------------------------- dates & time
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
function dayDate(w, d) { const [dd, mm] = d.date.split('.').map(Number); return new Date(w.year || new Date().getFullYear(), mm - 1, dd); }
const same = (a, b) => a.toDateString() === b.toDateString();
const findDay = (w, d) => w.days.find(x => x.date && same(dayDate(w, x), d));
function nextDay(w, d) { const t = new Date(d); t.setHours(23, 59, 0, 0); return w.days.find(x => dayDate(w, x) > t); }
const bdays = (w, d) => (w.bdays || []).filter(b => b.d === `${d.getDate()}.${d.getMonth() + 1}`).map(b => b.n);

function status(w, d) {
  const day = findDay(w, d);
  const m = d.getHours() * 60 + d.getMinutes();
  if (!day || !day.periods.length) return { kind: 'free', next: nextDay(w, d) };
  const ps = day.periods;
  if (m < mins(ps[0].start)) return { kind: 'before', day, nextP: ps[0], inMin: mins(ps[0].start) - m, refresh: ps[0].start };
  if (m >= mins(ps[ps.length - 1].end)) return { kind: 'after', day, next: nextDay(w, d) };
  const cur = ps.find(p => m >= mins(p.start) && m < mins(p.end));
  if (cur) {
    const i = ps.indexOf(cur);
    return { kind: 'lesson', day, cur, nextP: ps[i + 1], left: mins(cur.end) - m, len: mins(cur.end) - mins(cur.start), after: ps.slice(i + 2), refresh: cur.end };
  }
  const nextP = ps.find(p => mins(p.start) > m);
  return { kind: 'break', day, nextP, inMin: mins(nextP.start) - m, after: ps.slice(ps.indexOf(nextP) + 1), refresh: nextP.start };
}
const plabel = p => (p.label === 'בוקר' ? 'מפגש בוקר' : 'שעה ' + p.label);

// ---------------------------------------------------------------- morning notifications
async function scheduleMorning(w) {
  try { await Notification.removeAllPending(); } catch (e) { /* first run */ }
  if (!w.notify) return 0;
  const [hh, mm] = w.notify.split(':').map(Number);
  let n = 0;
  for (const d of w.days) {
    const at = dayDate(w, d); at.setHours(hh, mm, 0, 0);
    if (at < new Date() || !d.periods.length) continue;
    const lines = [];
    const bd = bdays(w, at);
    if (bd.length) lines.push(`🎂 יום הולדת ל${bd.join(' ול')}!`);
    lines.push(`📅 מתחילים ב־${d.periods[0].start} · ${d.periods[0].title}`);
    if (d.print && d.print.length) lines.push(`🖨 להדפיס: ${d.print.join(' · ')}`);
    if (d.bring && d.bring.length) lines.push(`🎒 להביא: ${d.bring.slice(0, 4).map(t => t.split('–')[0].trim()).join(' · ')}${d.bring.length > 4 ? ` ועוד ${d.bring.length - 4}` : ''}`);
    const note = new Notification();
    note.title = `בוקר טוב ${w.name || ''} ☀️ יום ${d.name}`;
    note.body = lines.join('\n');
    note.openURL = APP_URL;
    note.threadIdentifier = 'hakita-morning';
    note.setTriggerDate(at);
    await note.schedule();
    n++;
  }
  return n;
}

async function importFromClipboard() {
  const txt = Pasteboard.paste() || '';
  let w = null;
  try { const j = JSON.parse(txt); if (j && j.kita && Array.isArray(j.days)) w = j; } catch (e) { /* not ours */ }
  const a = new Alert();
  if (w) {
    fm.writeString(path, txt);
    const n = await scheduleMorning(w);
    a.title = 'הכל מעודכן 💜';
    a.message = `${w.title || 'השבוע'} נכנס לווידג׳ט.` + (w.notify ? `\nהתראות בוקר: ${n} ימים, בשעה ${w.notify}.` : '\nהתראות בוקר כבויות.');
  } else {
    a.title = 'לא מצאתי תכנון 🤔';
    a.message = 'פותחים את "הכיתה שלי" ← עוד ← הגדרות ← "עדכון הווידג׳ט וההתראות", ומשם זה יגיע לכאן לבד.';
  }
  a.addAction('אחלה');
  await a.present();
}

// ---------------------------------------------------------------- drawing (style guide colours)
const INK = new Color('#23212A'), SOFT = new Color('#7D7689'), ACC = new Color('#7B4FD6');
const tint = hex => new Color(hex, 0.32);

function rtlRow(st, text, font, color, lines = 1) {
  const r = st.addStack(); r.layoutHorizontally(); r.addSpacer();
  const t = r.addText(text); t.font = font; t.textColor = color; t.lineLimit = lines; t.rightAlignText();
  return r;
}
function chip(st, p, big) {
  const box = st.addStack(); box.layoutHorizontally(); box.centerAlignContent();
  box.backgroundColor = tint(p.c || '#D4B7F5'); box.cornerRadius = 14;
  box.setPadding(big ? 8 : 6, 12, big ? 8 : 6, 12);
  box.addSpacer();
  const t = box.addText(big ? `${plabel(p)} – ${p.title}` : p.title);
  t.font = Font.boldRoundedSystemFont(big ? 15 : 13); t.textColor = INK; t.lineLimit = big ? 2 : 1; t.rightAlignText();
  return box;
}
function bar(st, pct, width) {
  const b = st.addStack(); b.size = new Size(width, 6); b.cornerRadius = 3; b.backgroundColor = new Color('#F1EAFD');
  b.layoutHorizontally();
  const f = b.addStack(); f.size = new Size(Math.max(4, width * pct), 6); f.cornerRadius = 3; f.backgroundColor = new Color('#A67AF3');
  b.addSpacer();
}

function build(w, fam) {
  const W = new ListWidget();
  const g = new LinearGradient(); g.colors = [new Color('#FFFFFF'), new Color('#F4EEFD')]; g.locations = [0, 1];
  W.backgroundGradient = g; W.url = APP_URL; W.setPadding(14, 14, 14, 14);
  const small = fam === 'small', now = new Date();
  const head = (title, sub) => {
    const h = W.addStack(); h.layoutHorizontally(); h.centerAlignContent();
    if (sub) { const s = h.addText(sub); s.font = Font.mediumSystemFont(12); s.textColor = SOFT; }
    h.addSpacer();
    const t = h.addText(title); t.font = Font.heavyRoundedSystemFont(small ? 15 : 17); t.textColor = INK;
    W.addSpacer(small ? 6 : 8);
  };
  if (!w) {
    head('הכיתה שלי');
    rtlRow(W, 'עוד אין תכנון.\nבאפליקציה: עוד ← הגדרות ← עדכון הווידג׳ט', Font.systemFont(12), SOFT, 4);
    return W;
  }
  const bd = bdays(w, now);
  const s = status(w, now);
  if (bd.length && !small) { rtlRow(W, `🎂 היום יום הולדת ל${bd.join(' ול')}!`, Font.boldSystemFont(12), new Color('#D3546A')); W.addSpacer(4); }

  if (s.kind === 'lesson') {
    head('עכשיו:', small ? '' : `⏱ עוד ${s.left} דק׳`);
    chip(W, s.cur, true);
    W.addSpacer(6); bar(W, 1 - s.left / s.len, small ? 120 : 290);
    if (small) { W.addSpacer(4); rtlRow(W, `עוד ${s.left} דק׳`, Font.mediumSystemFont(12), ACC); }
    if (s.nextP) { W.addSpacer(8); rtlRow(W, `הבא: ${s.nextP.title}`, Font.mediumSystemFont(13), INK); }
    if (!small && s.nextP && s.nextP.need) { W.addSpacer(3); rtlRow(W, `להכין: ${s.nextP.need}`, Font.systemFont(12), SOFT); }
    if (fam === 'large') for (const p of s.after.slice(0, 4)) { W.addSpacer(6); chip(W, p, false); }
  } else if (s.kind === 'break') {
    head('הפסקה ☕', small ? '' : `עוד ${s.inMin} דק׳`);
    chip(W, s.nextP, true);
    if (small) { W.addSpacer(4); rtlRow(W, `בעוד ${s.inMin} דק׳`, Font.mediumSystemFont(12), ACC); }
    if (!small && s.nextP.need) { W.addSpacer(6); rtlRow(W, `להכין: ${s.nextP.need}`, Font.systemFont(12), SOFT); }
    if (fam === 'large') for (const p of s.after.slice(0, 4)) { W.addSpacer(6); chip(W, p, false); }
  } else if (s.kind === 'before') {
    head(`יום ${s.day.name}`, small ? '' : `מתחילים ב־${s.nextP.start}`);
    chip(W, s.nextP, true);
    if ((s.day.print || []).length) { W.addSpacer(6); rtlRow(W, `🖨 להדפיס: ${s.day.print.length}`, Font.mediumSystemFont(12), INK); }
    if (!small && (s.day.bring || []).length) { W.addSpacer(3); rtlRow(W, `🎒 להביא: ${s.day.bring.length}`, Font.mediumSystemFont(12), INK); }
  } else {
    head(s.kind === 'after' ? 'סיימת להיום 🎉' : 'יום חופשי 🌿');
    const nd = s.next;
    if (nd && nd.periods.length) {
      rtlRow(W, `${small ? '' : 'מחכה לך · '}יום ${nd.name} ${nd.date}`, Font.systemFont(12), SOFT);
      W.addSpacer(5); chip(W, nd.periods[0], !small);
      if (!small && (nd.print || []).length) { W.addSpacer(5); rtlRow(W, `🖨 בבוקר להדפיס: ${nd.print.length}`, Font.systemFont(12), SOFT); }
    }
  }
  W.addSpacer();
  if (s.refresh) { const [h, m] = s.refresh.split(':').map(Number); const r = new Date(); r.setHours(h, m, 0, 0); W.refreshAfterDate = r; }
  else W.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  return W;
}

// ---------------------------------------------------------------- run
if (config.runsInWidget) {
  Script.setWidget(build(loadWeek(), config.widgetFamily));
} else if (args.queryParameters && args.queryParameters.update) {
  await importFromClipboard();
} else {
  const a = new Alert();
  a.title = 'הכיתה שלי';
  a.addAction('לעדכן מהלוח');
  a.addAction('תצוגה מקדימה');
  a.addCancelAction('סגירה');
  const c = await a.present();
  if (c === 0) await importFromClipboard();
  if (c === 1) await build(loadWeek(), 'medium').presentMedium();
}
Script.complete();
