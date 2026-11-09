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

// ---------------------------------------------------------------- drawing – same look as the app: plum night / champagne day, gold lines
const DARK = Device.isUsingDarkAppearance();
const C = DARK
  ? { bg1: '#2B2236', bg2: '#15111C', ink: '#F7F0E4', soft: '#BDB3C9', gold: '#DDBE82', line: '#FFFFFF', lineA: 0.10, track: '#FFFFFF', trackA: 0.12 }
  : { bg1: '#FCF8F2', bg2: '#F0E5D4', ink: '#2A2332', soft: '#635C6E', gold: '#B38B4D', line: '#2A2332', lineA: 0.10, track: '#2A2332', trackA: 0.10 };
const col = (h, a = 1) => new Color(h, a);
const INK = col(C.ink), SOFT = col(C.soft), GOLD = col(C.gold);
const F = {
  brand: Font.mediumRoundedSystemFont(11), title: s => Font.lightRoundedSystemFont(s), label: Font.semiboldRoundedSystemFont(11),
  body: Font.regularRoundedSystemFont(13), small: Font.mediumRoundedSystemFont(11.5), num: s => Font.lightRoundedSystemFont(s),
};
function text(st, t, font, color, { lines = 1, align = 'right', min = 0.7 } = {}) {
  const r = st.addStack(); r.layoutHorizontally();
  if (align === 'right') r.addSpacer();
  const x = r.addText(t); x.font = font; x.textColor = color; x.lineLimit = lines; x.minimumScaleFactor = min;
  if (align === 'right') x.rightAlignText();
  if (align === 'left') r.addSpacer();
  return r;
}
function icon(st, name, size = 12, color = GOLD) {
  const sym = SFSymbol.named(name); if (!sym) return;
  sym.applyFont(Font.mediumSystemFont(size));
  const im = st.addImage(sym.image); im.imageSize = new Size(size + 2, size + 2); im.tintColor = color;
}
function iconRow(st, name, t, color = INK) {
  const r = st.addStack(); r.layoutHorizontally(); r.centerAlignContent(); r.addSpacer();
  const x = r.addText(t); x.font = F.body; x.textColor = color; x.lineLimit = 1; x.minimumScaleFactor = .75;
  r.addSpacer(6); icon(r, name, 12);
  return r;
}
function hairline(st) { const l = st.addStack(); l.size = new Size(0, 0.6); l.backgroundColor = col(C.line, C.lineA); l.addSpacer(); }
// gold progress ring with the minutes in the middle
function ring(pct, label, sub, size = 64) {
  const d = new DrawContext(); d.size = new Size(size * 2, size * 2); d.opaque = false; d.respectScreenScale = true;
  const c = size, r = size - 7, w = 7;
  d.setStrokeColor(col(C.track, C.trackA)); d.setLineWidth(w);
  d.strokeEllipse(new Rect(c - r, c - r, r * 2, r * 2));
  const pts = [], n = Math.max(2, Math.round(80 * pct));
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 - (i / 80) * Math.PI * 2; pts.push(new Point(c + r * Math.cos(a), c + r * Math.sin(a))); }
  const pa = new Path(); pa.addLines(pts); d.addPath(pa); d.setStrokeColor(GOLD); d.setLineWidth(w); d.strokePath();
  d.setTextAlignedCenter(); d.setTextColor(INK); d.setFont(Font.lightRoundedSystemFont(size * 0.62));
  d.drawTextInRect(label, new Rect(0, c - size * 0.46, size * 2, size * 0.8));
  if (sub) { d.setTextColor(SOFT); d.setFont(Font.mediumRoundedSystemFont(size * 0.24)); d.drawTextInRect(sub, new Rect(0, c + size * 0.3, size * 2, size * 0.4)); }
  return d.getImage();
}
function brand(st, right) {
  const h = st.addStack(); h.layoutHorizontally(); h.centerAlignContent();
  if (right) { const x = h.addText(right); x.font = F.small; x.textColor = SOFT; }
  h.addSpacer();
  const b = h.addText('הכיתה שלי'); b.font = F.brand; b.textColor = GOLD;
  h.addSpacer(5);
  const dot = h.addStack(); dot.size = new Size(5, 5); dot.cornerRadius = 2.5; dot.backgroundColor = GOLD;
  return h;
}
const subj = p => (p.subj || '').trim();
function lessonBlock(st, p, size, lines = 2) {
  if (subj(p) || p.label) text(st, [plabel(p), subj(p)].filter(Boolean).join(' · '), F.label, GOLD);
  st.addSpacer(2);
  text(st, p.title, F.title(size), INK, { lines });
}
function restList(st, list, max) {
  for (const p of list.slice(0, max)) {
    st.addSpacer(7); hairline(st); st.addSpacer(7);
    const r = st.addStack(); r.layoutHorizontally(); r.centerAlignContent(); r.addSpacer();
    const t = r.addText(p.title); t.font = F.body; t.textColor = INK; t.lineLimit = 1; t.minimumScaleFactor = .8; t.rightAlignText();
    r.addSpacer(10);
    const tm = r.addText(p.start || ''); tm.font = F.small; tm.textColor = SOFT;
  }
}

function build(w, fam) {
  const W = new ListWidget();
  const g = new LinearGradient(); g.colors = [col(C.bg1), col(C.bg2)]; g.locations = [0, 1]; g.startPoint = new Point(1, 0); g.endPoint = new Point(0, 1);
  W.backgroundGradient = g; W.url = APP_URL;
  const small = fam === 'small', large = fam === 'large', now = new Date();
  W.setPadding(small ? 14 : 16, 16, small ? 14 : 16, 16);
  if (!w) {
    brand(W); W.addSpacer();
    text(W, 'עוד אין תכנון', F.title(18), INK); W.addSpacer(4);
    text(W, 'באפליקציה: עוד ← הגדרות ← עדכון הווידג׳ט', F.small, SOFT, { lines: 3 });
    return W;
  }
  const bd = bdays(w, now), s = status(w, now);
  const lessonLike = s.kind === 'lesson' || s.kind === 'break';
  brand(W, small ? '' : (s.day ? `יום ${s.day.name} ${s.day.date}` : ''));
  W.addSpacer(small ? 8 : 10);

  if (lessonLike) {
    const p = s.kind === 'lesson' ? s.cur : s.nextP;
    const pct = s.kind === 'lesson' ? 1 - s.left / s.len : 0;
    const mins2 = s.kind === 'lesson' ? s.left : s.inMin;
    const sub = s.kind === 'lesson' ? 'דק׳' : 'בעוד';
    if (small) {
      const top = W.addStack(); top.layoutHorizontally(); top.addSpacer();
      const im = top.addImage(ring(pct, String(mins2), sub, 30)); im.imageSize = new Size(52, 52);
      W.addSpacer(6); text(W, p.title, F.title(15), INK, { lines: 2 });
    } else {
      const row = W.addStack(); row.layoutHorizontally(); row.centerAlignContent();
      const col2 = row.addStack(); col2.layoutVertically();
      row.addSpacer(14);
      const im = row.addImage(ring(pct, String(mins2), sub, 34)); im.imageSize = new Size(64, 64);
      if (s.kind === 'break') { text(col2, 'הפסקה · הבא בתור', F.label, GOLD); col2.addSpacer(2); text(col2, p.title, F.title(19), INK, { lines: 2 }); }
      else lessonBlock(col2, p, 19);
      const nxt = s.kind === 'lesson' ? s.nextP : null;
      W.addSpacer(10);
      if (nxt) { const r = W.addStack(); r.layoutHorizontally(); r.addSpacer(); const t2 = r.addText(`אחר כך · ${nxt.title}`); t2.font = F.body; t2.textColor = SOFT; t2.lineLimit = 1; t2.minimumScaleFactor = .8; }
      const need = (s.kind === 'lesson' ? s.nextP : p) || {};
      if (need.need) { W.addSpacer(4); iconRow(W, 'checklist', need.need, SOFT); }
      if (large) restList(W, s.after, 5);
    }
  } else if (s.kind === 'before') {
    if (small) { text(W, `מתחילים ב־${s.nextP.start}`, F.label, GOLD); W.addSpacer(3); text(W, s.nextP.title, F.title(16), INK, { lines: 3 }); }
    else {
      text(W, `השיעור הראשון · ${s.nextP.start}`, F.label, GOLD); W.addSpacer(2);
      text(W, s.nextP.title, F.title(20), INK, { lines: 2 }); W.addSpacer(10);
      if ((s.day.print || []).length) { iconRow(W, 'printer', `להדפיס · ${s.day.print.length}`); W.addSpacer(4); }
      if ((s.day.bring || []).length) iconRow(W, 'bag', `להביא · ${s.day.bring.length}`);
      if (large) restList(W, s.day.periods.slice(1), 6);
    }
  } else {
    const nd = s.next;
    text(W, s.kind === 'after' ? 'היום הסתיים' : 'יום חופשי', F.title(small ? 17 : 21), INK); W.addSpacer(6);
    if (nd && nd.periods.length) {
      text(W, `מחר · יום ${nd.name}`, F.label, GOLD); W.addSpacer(2);
      text(W, `${nd.periods[0].start} · ${nd.periods[0].title}`, F.body, INK, { lines: small ? 2 : 1 });
      if (!small && (nd.print || []).length) { W.addSpacer(8); iconRow(W, 'printer', `בבוקר להדפיס · ${nd.print.length}`, SOFT); }
      if (large) restList(W, nd.periods.slice(1), 6);
    }
  }
  W.addSpacer();
  if (bd.length && !small) { hairline(W); W.addSpacer(7); iconRow(W, 'gift', `יום הולדת היום · ${bd.join(', ')}`, GOLD); }
  if (s.refresh) { const [h, m] = s.refresh.split(':').map(Number); const r = new Date(); r.setHours(h, m, 0, 0); W.refreshAfterDate = r; }
  else W.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
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
  if (c === 1) { const pick = new Alert(); pick.title = 'איזה גודל?'; ['קטן', 'בינוני', 'גדול'].forEach(x => pick.addAction(x)); const z = await pick.present(); const fam = ['small', 'medium', 'large'][z] || 'medium'; const wd = build(loadWeek(), fam); if (fam === 'small') await wd.presentSmall(); else if (fam === 'large') await wd.presentLarge(); else await wd.presentMedium(); }
}
Script.complete();
