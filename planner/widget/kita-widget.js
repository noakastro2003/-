// "הכיתה שלי" – ווידג'ט לאייפון (לאפליקציית Scriptable)
//
// התקנה (פעם אחת):
// 1. מתקינים את Scriptable מה-App Store (חינם).
// 2. ב-Scriptable: + (סקריפט חדש) ← מדביקים את כל הקובץ הזה ← קוראים לסקריפט: הכיתה שלי
// 3. במסך הבית: לחיצה ארוכה ← + ← Scriptable ← בוחרים גודל ← עריכת הווידג'ט ← Script: הכיתה שלי
//
// עדכון כל שבוע: באפליקציה "הכיתה שלי" ← עוד ← "עדכון הווידג'ט". זהו.

const APP_URL = 'https://noa-hakita.netlify.app/';
const FILE = 'kita-week.json';

// ---------------------------------------------------------------- data
const fm = FileManager.local();
const path = fm.joinPath(fm.documentsDirectory(), FILE);

function loadWeek() {
  if (!fm.fileExists(path)) return null;
  try { return JSON.parse(fm.readString(path)); } catch (e) { return null; }
}

async function importFromClipboard() {
  const txt = Pasteboard.paste() || '';
  let ok = false;
  try {
    const w = JSON.parse(txt);
    if (w && w.kita === 1 && Array.isArray(w.days)) {
      fm.writeString(path, txt);
      ok = w;
    }
  } catch (e) { /* not ours */ }
  const a = new Alert();
  if (ok) {
    a.title = 'הווידג׳ט עודכן 🎉';
    a.message = `${ok.title || 'השבוע'} – ${ok.days.length} ימים`;
  } else {
    a.title = 'לא מצאתי תכנון 🤔';
    a.message = 'פותחים את "הכיתה שלי" ← עוד ← "עדכון הווידג׳ט", ומשם זה יגיע לכאן לבד.';
  }
  a.addAction('אחלה');
  await a.present();
}

// ---------------------------------------------------------------- time logic
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const sameDate = (d, s) => { const [dd, mm] = s.split('.').map(Number); return d.getDate() === dd && d.getMonth() + 1 === mm; };

function findDay(w, d) { return w.days.find(x => x.date && sameDate(d, x.date) && (!w.year || d.getFullYear() === w.year)); }

function nextDay(w, d) {
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  return w.days.find(x => {
    const [dd, mm] = x.date.split('.').map(Number);
    return new Date(w.year || t.getFullYear(), mm - 1, dd) > t;
  });
}

function status(w, d) {
  const day = findDay(w, d);
  const m = d.getHours() * 60 + d.getMinutes();
  if (!day || !day.periods.length) return { kind: 'free', next: nextDay(w, d) };
  const ps = day.periods;
  if (m < mins(ps[0].start)) return { kind: 'before', day, nextP: ps[0], inMin: mins(ps[0].start) - m, refresh: ps[0].start };
  const last = ps[ps.length - 1];
  if (m >= mins(last.end)) return { kind: 'after', day, next: nextDay(w, d) };
  const cur = ps.find(p => m >= mins(p.start) && m < mins(p.end));
  const i = cur ? ps.indexOf(cur) : -1;
  const nextP = cur ? ps[i + 1] : ps.find(p => mins(p.start) > m);
  if (cur) return { kind: 'lesson', day, cur, nextP, left: mins(cur.end) - m, after: ps.slice(i + 2), refresh: cur.end };
  return { kind: 'break', day, nextP, inMin: mins(nextP.start) - m, after: ps.slice(ps.indexOf(nextP) + 1), refresh: nextP.start };
}

const inTxt = n => n < 60 ? `${n} דק׳` : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')} שע׳`;

// ---------------------------------------------------------------- drawing
const INK = new Color('#3B3341'), SOFT = new Color('#8A8090'), PAPER = new Color('#FBF6EE');

function row(st, text, font, color, lines = 1) {
  const r = st.addStack();
  r.layoutHorizontally();
  r.addSpacer();
  const t = r.addText(text);
  t.font = font; t.textColor = color; t.lineLimit = lines; t.rightAlignText();
  return r;
}

function lessonBox(st, p, big, sub) {
  const box = st.addStack();
  box.layoutHorizontally();
  box.backgroundColor = new Color(p.bg || '#F6ECF6');
  box.cornerRadius = 14;
  box.setPadding(big ? 9 : 6, 10, big ? 9 : 6, 8);
  const txt = box.addStack();
  txt.layoutVertically();
  row(txt, `${p.e || ''} ${p.title}`, Font.boldRoundedSystemFont(big ? 15 : 13), INK, big ? 2 : 1);
  if (sub) row(txt, sub, Font.systemFont(big ? 12 : 11), SOFT, 1);
  box.addSpacer(8);
  const stripe = box.addStack();
  stripe.size = new Size(4, big ? 36 : 26);
  stripe.backgroundColor = new Color(p.c || '#B48FB8');
  stripe.cornerRadius = 2;
  return box;
}

const plabel = p => (p.label === 'בוקר' ? 'מפגש בוקר' : 'שעה ' + p.label);

function build(w, fam) {
  const W = new ListWidget();
  W.backgroundColor = PAPER;
  W.url = APP_URL;
  W.setPadding(12, 12, 12, 12);
  const now = new Date();

  if (!w) {
    row(W, 'הכיתה שלי', Font.boldRoundedSystemFont(16), INK);
    W.addSpacer(6);
    row(W, 'עוד אין תכנון.\nבאפליקציה: עוד ← עדכון הווידג׳ט', Font.systemFont(12), SOFT, 4);
    return W;
  }

  const s = status(w, now);
  const small = fam === 'small';
  const head = (a, b) => {
    const h = W.addStack(); h.layoutHorizontally();
    if (b) { const t = h.addText(b); t.font = Font.systemFont(11); t.textColor = SOFT; }
    h.addSpacer();
    const t2 = h.addText(a); t2.font = Font.boldRoundedSystemFont(small ? 13 : 14); t2.textColor = INK;
    W.addSpacer(small ? 6 : 8);
  };

  if (s.kind === 'lesson') {
    head(`עכשיו · ${plabel(s.cur)}`, small ? '' : `עוד ${inTxt(s.left)}`);
    lessonBox(W, s.cur, true, small ? `עוד ${inTxt(s.left)}` : s.cur.sub);
    if (s.nextP) { W.addSpacer(6); lessonBox(W, s.nextP, false, `${s.nextP.start} · הבא`); }
    if (fam === 'large') for (const p of s.after.slice(0, 4)) { W.addSpacer(5); lessonBox(W, p, false, p.start); }
  } else if (s.kind === 'break') {
    head('הפסקה ☕', small ? '' : `עוד ${inTxt(s.inMin)}`);
    lessonBox(W, s.nextP, true, `${s.nextP.start} · ${small ? 'עוד ' + inTxt(s.inMin) : plabel(s.nextP)}`);
    if (fam === 'large') for (const p of s.after.slice(0, 4)) { W.addSpacer(5); lessonBox(W, p, false, p.start); }
  } else if (s.kind === 'before') {
    head(`יום ${s.day.name}`, small ? '' : `מתחילים ב־${s.nextP.start}`);
    lessonBox(W, s.nextP, true, small ? s.nextP.start : s.nextP.sub);
    const pr = s.day.print || [];
    if (pr.length) { W.addSpacer(6); row(W, `🖨 להדפיס הבוקר: ${pr.length}`, Font.mediumSystemFont(12), INK); }
    if (fam === 'large') { W.addSpacer(4); for (const p of s.day.periods.slice(1, 5)) { W.addSpacer(5); lessonBox(W, p, false, p.start); } }
  } else {
    const nd = s.next;
    head(s.kind === 'after' ? 'סיימת להיום 🎉' : 'יום חופשי 🌿');
    if (nd && nd.periods.length) {
      row(W, `${small ? '' : 'למחר · '}יום ${nd.name} ${nd.date}`, Font.systemFont(12), SOFT);
      W.addSpacer(5);
      lessonBox(W, nd.periods[0], !small, `${nd.periods[0].start} · ${plabel(nd.periods[0])}`);
      if (!small && (nd.print || []).length) { W.addSpacer(5); row(W, `🖨 מחר בבוקר להדפיס: ${nd.print.length}`, Font.systemFont(11), SOFT); }
    }
  }
  W.addSpacer();
  if (s.refresh) {
    const [h, m] = s.refresh.split(':').map(Number);
    const r = new Date(); r.setHours(h, m, 0, 0);
    W.refreshAfterDate = r;
  } else {
    W.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  }
  return W;
}

// ---------------------------------------------------------------- run
if (config.runsInWidget) {
  Script.setWidget(build(loadWeek(), config.widgetFamily));
} else {
  // opened from the app (or by hand): take the week from the clipboard
  if (args.queryParameters && args.queryParameters.update) await importFromClipboard();
  else {
    const a = new Alert();
    a.title = 'הכיתה שלי';
    a.addAction('לעדכן מהלוח (אחרי "עדכון הווידג׳ט")');
    a.addAction('תצוגה מקדימה');
    a.addCancelAction('סגירה');
    const c = await a.present();
    if (c === 0) await importFromClipboard();
    if (c === 1) await build(loadWeek(), 'medium').presentMedium();
  }
}
Script.complete();
