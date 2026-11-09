import * as pdfjsLib from '../vendor/pdf.min.mjs';
import { parsePlanPdf, DAY_NAMES } from './planparse.js';
import { ic, art, spark, squiggle, miniArt, fileBadge, logo } from './icons.js';
import * as ID from '../vendor/identity.mjs';
import { putBlob, getBlob, delBlob, extractText, matchLessons, fmtSize, kindOf } from './files.js';
import { readAnyPlan } from './genparse.js';
import { QUOTES, BANK, CATS, EV } from './toolkit.js';
import { weekPrintHtml } from './printweek.js';
import { PM_TYPES, buildToday, buildWeek as buildWeekMsg, buildDict, buildGear, buildTest, buildBday, buildAll, autoTests, autoEvents, weekBdays, buildPersonal, buildForms, formPersonal, buildChange, buildHoliday, nextHoliday, HOLIDAY_NAMES, OPENERS, CLOSERS, stripEmoji, waHtml } from './parentmsg.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

// ================================================================ state
const KEY = 'noa-planner-v1';
const APP_V = 42; // keep in step with CACHE in sw.js
const SAVED = ['weeks', 'activeId', 'checks', 'pins', 'name', 'logs', 'kids', 'todos', 'prefs', 'picked', 'groups', 'files', 'absent', 'cnotes', 'lists', 'autos', 'notifQueue', 'ready', 'onboarded', 'tsaved', 'dict', 'pmlog', 'forms', 'pmtpl', 'changes', 'grades', 'bank', 'events', 'points', 'kings', 'guided', 'classes', 'curClass'];
const state = Object.assign({
  weeks: {}, activeId: null, checks: {}, pins: {}, name: '', logs: {}, kids: [], todos: [], files: [], ready: {}, cnotes: [], lists: [], autos: [], notifQueue: [], tsaved: [], tcat: '', dict: {}, pmlog: [], forms: [], pmtpl: [], changes: [], grades: [], bank: [], events: [], points: [], kings: {}, classes: [], curClass: null,
  prefs: {}, picked: [], groups: 5,
  q: '', fsub: '', tab: 'now', dayDow: null, prepDow: null, open: {}, sec: {}, prepEdit: false,
}, load());
if (state.onboarded == null && (Object.keys(state.weeks).length || state.name)) state.onboarded = true;
state.prefs = Object.assign({ size: 1, theme: 'auto', skin: 'luxe', notify: true, notifyTime: '07:00' }, state.prefs);
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function saveLocal() {
  const o = { syncV: state.syncV || 0 };
  for (const k of SAVED) o[k] = state[k];
  localStorage.setItem(KEY, JSON.stringify(o));
}
function save() { if (state.classes && state.classes.length) syncCls(); if (sync.user) state.notifQueue = buildQueue(); saveLocal(); schedulePush(); }

// ?now=2026-11-01T10:30 previews any moment
const fakeNow = new URLSearchParams(location.search).get('now');
const offset = fakeNow ? new Date(fakeNow) - Date.now() : 0;
const now = () => new Date(Date.now() + offset);

// ================================================================ helpers
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mins = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const DAY_FULL = [...DAY_NAMES, 'שבת'];
const nowMin = () => { const t = now(); return t.getHours() * 60 + t.getMinutes() + t.getSeconds() / 60; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const uid = () => Math.random().toString(36).slice(2, 9);

const SUBJ = [
  [/מפגש בוקר/, 'מפגש בוקר', '#F6D38A', 'sun'],
  [/פרטני/, 'פרטני', '#F6C28B', 'user'],
  [/מתמטיקה|חשבון/, 'מתמטיקה', '#B79AF7', 'calc'],
  [/תנ"?ך|תנ״ך/, 'תנ״ך', '#B8D88E', 'book'],
  [/מעבדה|חינוך/, 'חינוך', '#9DD6F9', 'flask'],
  [/א['׳]?1|כותבים/, 'א׳1', '#EDC3A0', 'pencil'],
  [/צוות|ישיבה|השתלמות/, 'צוות', '#D4B7F5', 'users'],
  [/שפה|קריאה|כתיבה|הכתבה/, 'שפה', '#F6B7CF', 'book'],
];
function look(p) {
  const hay = (p.subject || '') + (p.label === 'בוקר' ? ' מפגש בוקר' : '');
  for (const [re, n, c, i] of SUBJ) if (re.test(hay)) return { n, c, i };
  for (const [re, n, c, i] of SUBJ) if (re.test(p.title || '')) return { n, c, i };
  return { n: (p.subject || '').split('/')[0].trim() || 'שיעור', c: '#D4B7F5', i: 'sparkle' };
}
const pill = p => { const L = look(p); return `<span class="pill" style="--c:${L.c}">${ic(L.i)}${esc(L.n)}</span>`; };

function dayDate(w, d) {
  if (!d || !d.date) return null;
  const [dd, mm] = d.date.split('.').map(Number);
  return new Date(w.year, mm - 1, dd);
}
const weekDates = w => w.days.map(d => dayDate(w, d));
const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString();

const sortedWeeks = () => Object.values(state.weeks).sort((a, b) => (a.id < b.id ? -1 : 1));
// the week being looked at: the one picked with the arrows, otherwise the real current week
function pickWeek() {
  if (state.viewWeekId && state.tab !== 'now' && state.weeks[state.viewWeekId]) return state.weeks[state.viewWeekId];
  return realWeek();
}
function realWeek() {
  const ws = Object.values(state.weeks);
  if (!ws.length) return null;
  const t = now(); t.setHours(0, 0, 0, 0);
  // on Saturday the coming week is the interesting one
  if (t.getDay() === 6) {
    const next = ws.find(w => { const d = weekDates(w).filter(Boolean)[0]; return d && d > t && d - t < 3 * 864e5; });
    if (next) return next;
  }
  for (const w of ws) {
    const ds = weekDates(w).filter(Boolean);
    if (!ds.length) continue;
    const sun = addDays(ds[0], -ds[0].getDay()), sat = addDays(sun, 6);
    if (t >= sun && t <= sat) return w;
  }
  const t2 = now();
  const upcoming = sortedWeeks().find(w => { const d = weekDates(w).filter(Boolean)[0]; return d && d > t2; });
  if (upcoming) return upcoming;
  if (state.activeId && state.weeks[state.activeId]) return state.weeks[state.activeId];
  return ws.sort((a, b) => (a.id < b.id ? 1 : -1))[0];
}
const todayInWeek = w => w.days[weekDates(w).findIndex(d => sameDay(d, now()))] || null;
const nextSchoolDay = (w, afterDow) => w.days.find(d => d.dow > afterDow) || null;
const upcomingDay = w => w.days.find(d => dayDate(w, d) > now()) || null;
// next school day after today, looking into later weeks too
function nextDayGlobal() {
  const t = now(); t.setHours(23, 59, 59, 0);
  for (const w of sortedWeeks()) for (const d of w.days) { const dd = dayDate(w, d); if (dd && dd > t && d.periods.length) return { w, d }; }
  return null;
}
function weekNav(w) {
  const ws = sortedWeeks(), i = ws.indexOf(w), real = realWeek();
  if (ws.length < 2 && w === real) return '';
  return `<div class="wknav" data-swipe>
    <button data-wk="prev" ${i <= 0 ? 'disabled' : ''} aria-label="שבוע קודם">${ic('chevR')}</button>
    <div class="wk-t"><b>${esc(w.number ? 'שבוע ' + w.number : w.title)}</b><small dir="ltr">${esc(w.range || '')}</small></div>
    <button data-wk="next" ${i >= ws.length - 1 ? 'disabled' : ''} aria-label="שבוע הבא">${ic('chevL')}</button>
    ${w !== real ? `<button class="wk-now" data-wk="now">חזרה להשבוע</button>` : ''}
  </div>`;
}

function phase(day) {
  const m = nowMin();
  const ps = day.periods.filter(p => p.start);
  if (!ps.length) return { kind: 'free' };
  const first = ps[0], last = ps[ps.length - 1];
  if (m < mins(first.start)) return { kind: 'before', next: first, inMin: Math.ceil(mins(first.start) - m) };
  if (m >= mins(last.end)) return { kind: 'after' };
  const cur = ps.find(p => m >= mins(p.start) && m < mins(p.end));
  const next = ps.find(p => mins(p.start) > m);
  if (cur) {
    const len = mins(cur.end) - mins(cur.start);
    return { kind: 'lesson', cur, next, left: Math.ceil(mins(cur.end) - m), len, pct: (m - mins(cur.start)) / len, inMin: next ? Math.ceil(mins(next.start) - m) : null };
  }
  return { kind: 'break', next, inMin: Math.ceil(mins(next.start) - m) };
}
const inText = n => n <= 1 ? 'עוד דקה' : n < 60 ? `עוד ${n} דק׳` : `עוד ${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')} שע׳`;
const inMinTxt = n => n < 60 ? `בעוד ${n} דק׳` : `בעוד ${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')} שע׳`;

// ================================================================ checks & logs
const ck = (w, k) => !!(state.checks[w.id] && state.checks[w.id][k]);
function setCk(w, k, v) {
  state.checks[w.id] = state.checks[w.id] || {};
  if (v) state.checks[w.id][k] = 1; else delete state.checks[w.id][k];
  save();
}
const LOG = { done: ['✅', 'הספקנו'], part: ['🌗', 'חלקית'], skip: ['⏭', 'לא הספקנו'] };
const getLog = (w, id) => (state.logs[w.id] || {})[id];
function setLog(w, id, v) {
  state.logs[w.id] = state.logs[w.id] || {};
  if (v) state.logs[w.id][id] = v; else delete state.logs[w.id][id];
  save();
}
const logIcon = (w, id) => { const l = getLog(w, id); return l ? `<span class="lg">${LOG[l.s][0]}</span>` : ''; };
function logRow(w, id, compact) {
  const l = getLog(w, id) || {};
  return `<div class="logrow ${compact ? 'compact' : ''}">
    ${compact ? '' : `<div class="mh">${ic('flag')} איך היה?</div>`}
    <div class="seg">${Object.entries(LOG).map(([k, [e, t]]) => `<button class="${l.s === k ? 'on' : ''}" data-log="${esc(id)}" data-s="${k}">${e}${compact ? '' : ' ' + t}</button>`).join('')}</div>
    ${!compact && (l.s === 'part' || l.s === 'skip') ? `<textarea class="lognote" data-lognote="${esc(id)}" rows="2" placeholder="מה נשאר? (יופיע בסיכום השבוע)">${esc(l.note || '')}</textarea>` : ''}
  </div>`;
}
const chk = (key, on, body, extra = '') => `<label class="chk ${on ? 'on' : ''}"><input type="checkbox" data-ck="${esc(key)}" ${on ? 'checked' : ''}><span class="box">${ic('check')}</span><span class="ct">${body}</span>${extra}</label>`;

// ================================================================ birthdays
function parseKids(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l0 => {
    const ph = l0.match(/(?:\+?972[-\s]?|0)5\d[-\s]?\d{3}[-\s]?\d{4}/);
    const l = ph ? l0.replace(ph[0], ' ').replace(/\s{2,}/g, ' ').trim() : l0;
    const m = l.match(/(\d{1,2})\s*[./\-]\s*(\d{1,2})(?:\s*[./\-]\s*\d{2,4})?/);
    const name = l.replace(m ? m[0] : '', '').replace(/[–\-:,|]+\s*$/, '').replace(/^\s*[–\-:,|]+/, '').trim();
    return name ? { name, bd: m ? `${+m[1]}.${+m[2]}` : '', phone: ph ? ph[0].replace(/\D/g, '').replace(/^972/, '0') : '' } : null;
  }).filter(Boolean);
}
const bdOn = d => d ? state.kids.filter(k => k.bd && k.bd === `${d.getDate()}.${d.getMonth() + 1}`) : [];
const names = ks => ks.map(k => k.name).join(' ול');
function birthdayBanner() {
  const t = now(), today = bdOn(t), lines = [];
  if (today.length) lines.push(`היום יום הולדת ל${names(today)}!`);
  if (t.getDay() === 5) { const s = bdOn(addDays(t, 1)); if (s.length) lines.push(`מחר, בשבת, יום הולדת ל${names(s)} – חוגגים היום?`); }
  if (t.getDay() === 0) { const s = bdOn(addDays(t, -1)); if (s.length) lines.push(`בשבת היה יום הולדת ל${names(s)} 🎈`); }
  if (!lines.length) return '';
  if (today.length && state._bd !== t.toDateString()) { state._bd = t.toDateString(); setTimeout(confetti, 500); }
  return `<div class="card bday">${art('cake', 'bob')}<div><b>מזל טוב! 🎉</b>${lines.map(l => `<div>${esc(l)}</div>`).join('')}</div></div>`;
}
function upcomingBirthdays(days) {
  const out = [];
  for (let i = 0; i < days; i++) { const d = addDays(now(), i); for (const k of bdOn(d)) out.push({ k, d, i }); }
  return out;
}
function bdCard(days, title) {
  const up = upcomingBirthdays(days);
  if (!up.length) return '';
  return `<div class="card">${cardHead('cake', title)}${up.map(({ k, d, i }) =>
    `<div class="row"><span class="tpill">${d.getDate()}.${d.getMonth() + 1}</span><span class="grow">${esc(k.name)}</span><span class="dim">${i === 0 ? 'היום! 🎉' : i === 1 ? 'מחר' : 'יום ' + DAY_FULL[d.getDay()]}</span></div>`).join('')}</div>`;
}

// ================================================================ reminders
const todoDue = t => !t.done && (!t.date || new Date(t.date + 'T00:00') <= now());
const fmtDate = iso => { const [, m, d] = iso.split('-'); return `${+d}.${+m}`; };
function remindersCard(w, full) {
  const list = state.todos.filter(t => full || todoDue(t));
  const pdf = w && !full ? w.notes : [];
  return `<div class="card notes">
    ${cardHead('pin', 'לא לשכוח', !full ? `<button class="linkbtn" data-go="todos">הכל</button>` : '')}
    ${list.map(t => `<div class="todo">
      <label class="chk ${t.done ? 'on' : ''}"><input type="checkbox" data-todo="${t.id}" ${t.done ? 'checked' : ''}><span class="box">${ic('check')}</span><span class="ct">${esc(t.text)}${t.date ? ` <small class="tpill">${esc(fmtDate(t.date))}</small>` : ''}</span></label>
      ${full ? `<button class="iconbtn" data-deltodo="${t.id}" aria-label="מחיקה">${ic('trash')}</button>` : ''}
    </div>`).join('')}
    <form class="addtodo" data-addtodo>
      <input name="t" placeholder="תזכורת חדשה…" autocomplete="off">
      ${full ? '<input name="d" type="date" title="מתי להזכיר (לא חובה)">' : ''}
      <button aria-label="הוספה">${ic('plus')}</button>
    </form>
    ${pdf.map(n => `<div class="note"><b>${esc(n.label)}</b><span>${esc(n.text)}</span></div>`).join('')}
  </div>`;
}

// ================================================================ shared bits
const line = () => { const d = now(); return `יום ${DAY_FULL[d.getDay()]}, ${d.getDate()} ${HE_MONTHS[d.getMonth()]}`; };
const hello = () => `${greet()}${state.name ? ', ' + esc(state.name) : ''}`;
const greet = () => { const h = now().getHours(); return h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 16 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב'; };

function top(title, sub, illus, opts = {}) {
  const dot = state.todos.some(todoDue) || bdOn(now()).length;
  return `<header class="top">
    <div class="brandrow">
      <div class="brand">${opts.back ? `<button class="back" data-go="${opts.back}" aria-label="חזרה">${ic('chevR')}</button>` : ''}${logo('blogo')}<span>הכיתה שלי${spark('b')}${squiggle('s')}</span>${syncDot()}</div>
      <div class="hbtns">
        <button class="hb" data-day="all" aria-label="מערכת">${ic('calendar')}</button>
        <button class="hb" data-go="todos" aria-label="תזכורות">${ic('bell')}${dot ? '<i class="dot"></i>' : ''}</button>
      </div>
    </div>
    <div class="titlerow">
      <div class="tt"><h1>${title}</h1>${squiggle('t')}<p>${ic('heart', 'h')}<span>${sub}</span></p></div>
      ${illus ? `<div class="illus">${art(illus, 'bob')}${spark('i')}</div>` : ''}
    </div>
  </header>`;
}
const cardHead = (icon, title, right = '') => `<div class="ch"><span class="chi">${ic(icon)}</span><h3>${title}</h3>${right ? `<span class="chr">${right}</span>` : ''}</div>`;

function ring(left, total, label = 'נשארו') {
  const p = total ? Math.max(0, Math.min(1, 1 - left / total)) : 0;
  return `<div class="ring ${label === 'נשארו' && left <= 5 ? 'soon' : ''}" style="--p:${p}"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="rt"/><circle cx="50" cy="50" r="44" class="rv" pathLength="100"/></svg>
    <div class="rin"><small>${label}</small><b>${left}</b><small>דק׳</small></div></div>`;
}

// ================================================================ files
function fileKind(l) {
  const s = (l.text || '') + ' ' + (l.url || '');
  if (/\/folders\/|תיקיי/.test(s)) return 'folder';
  if (/pptx?|מצגת|presentation/i.test(s)) return 'ppt';
  if (/pdf/i.test(l.text || '')) return 'pdf';
  if (/spreadsheets|גאנט|xlsx/.test(s)) return 'sheet';
  return 'doc';
}
function collectFiles(w) {
  const map = new Map();
  for (const d of w.days) for (const p of d.periods) for (const l of p.links) {
    if (!l.url) continue;
    const f = map.get(l.url) || { url: l.url, text: l.text, uses: [] };
    if (l.text.length > f.text.length) f.text = l.text;
    f.uses.push({ d, p });
    map.set(l.url, f);
  }
  return [...map.values()];
}
function fileRow(f, compact, metaOver) {
  const pin = !!state.pins[f.url];
  const u = f.uses && f.uses[0];
  const meta = metaOver != null ? metaOver : u ? `${ic('folder')}${esc(look(u.p).n)} · ${f.uses.length > 2 ? `${f.uses.length} פעמים השבוע` : [...new Set(f.uses.map(x => 'יום ' + DAY_SHORT[x.d.dow]))].join(', ')}` : '';
  return `<div class="file ${compact ? 'compact' : ''}">
    <a href="${esc(f.url)}" target="_blank" rel="noopener">${fileBadge(fileKind(f))}<span class="fx"><b>${esc(f.text)}</b>${meta && !compact ? `<small>${meta}</small>` : ''}</span>${compact ? ic('chevL', 'chev') : ''}</a>
    ${compact ? '' : `<button class="star ${pin ? 'on' : ''}" data-pin="${esc(f.url)}" data-pintext="${esc(f.text)}" aria-label="נעיצה">${ic(pin ? 'starFill' : 'star')}</button>`}
  </div>`;
}

// ---------------------------------------------------------------- uploaded files
const filesFor = (w, dow, label) => state.files.filter(f => f.ref && f.ref.w === w.id && f.ref.dow === dow && f.ref.label === label);
function upRow(f, compact, metaOver) {
  const ref = f.ref && state.weeks[f.ref.w] ? findPeriodIn(state.weeks[f.ref.w], f.ref.dow, f.ref.label) : null;
  const meta = metaOver != null ? metaOver : compact ? `${fmtSize(f.size)}${f.cloud ? ' · ☁️' : ''}` : `${ref ? esc(ref.title) + ' · יום ' + DAY_SHORT[f.ref.dow] : 'כללי'} · ${fmtSize(f.size)}${f.cloud ? ' · ☁️' : ''}`;
  return `<div class="file ${compact ? 'compact' : ''} up">
    <button class="a" data-openfile="${f.id}">${fileBadge(kindOf(f.name, f.type))}<span class="fx"><b>${esc(f.name.replace(/\.[^.]+$/, ''))}</b><small>${meta}</small></span>${compact ? ic('chevL', 'chev') : ''}</button>
    ${compact ? '' : `<button class="iconbtn" data-filemenu="${f.id}" aria-label="אפשרויות">${ic('dots')}</button>`}
  </div>`;
}
function lessonFiles(w, day, p, onlyOpenable) {
  const ups = filesFor(w, day.dow, p.label);
  const linked = new Map(ups.filter(f => f.linkIdx >= 0).map(f => [f.linkIdx, f]));
  const rows = p.links.map((l, i) => {
    if (l.url) return fileRow({ url: l.url, text: l.text }, true);
    if (linked.has(i)) return upRow(linked.get(i), true);
    return onlyOpenable ? '' : `<div class="file compact off"><span class="a">${fileBadge('doc')}<span class="fx"><b>${esc(l.text)}</b><small>בלי קישור – אפשר להעלות</small></span></span></div>`;
  });
  for (const f of ups) if (!(f.linkIdx >= 0 && p.links[f.linkIdx] && !p.links[f.linkIdx].url)) rows.push(upRow(f, true));
  return rows.join('');
}
function findPeriodIn(w, dow, label) { const d = w.days.find(x => x.dow === dow); return d && d.periods.find(x => x.label === label); }

// ================================================================ NOW
function viewNow(w) {
  const day = todayInWeek(w);
  const t = now();
  const ph = day ? phase(day) : { kind: 'free' };
  const teaser = (t.getDay() === 5 && ph.kind === 'after') || t.getDay() === 6
    ? `<button class="card teaser" data-go="summary">${art('medal')}<span class="grow"><b>סיכום השבוע מוכן</b><small>מה הספקנו, מה עובר הלאה</small></span>${ic('chevL', 'chev')}</button>` : '';
  let h = '';

  if (ph.kind === 'lesson') {
    h += top('עכשיו', `${hello()} · ${line()}`, 'books') + firstSteps();
    h += birthdayBanner();
    h += nowCard(w, day, ph.cur, ph) + quickTools();
    if (ph.next) h += nextCard(day, ph.next, ph.inMin);
  } else if (ph.kind === 'break') {
    h += top('הפסקה', `השיעור הבא ${inText(ph.inMin)}`, 'books');
    h += birthdayBanner();
    h += nowCard(w, day, ph.next, { kind: 'preview', inMin: ph.inMin }) + quickTools();
  } else if (ph.kind === 'before') {
    h += top(hello(), `יום ${day.name} · מתחילים ב־${ph.next.start}`, 'books') + firstSteps();
    h += birthdayBanner();
    h += prepCards(w, day, 'today');
    h += nextCard(day, ph.next, ph.inMin, 'השיעור הראשון') + tipCard();
  } else if (ph.kind === 'after') {
    h += top('סיימת את היום 🎉', line(), 'books');
    h += birthdayBanner() + teaser;
    const S = dayStats(w, day);
    h += `<div class="card bravo"><div class="grow"><b>היום הסתיים</b><span>סיימת ${day.periods.length} שיעורים${S.total ? ` ו־${S.done} מתוך ${S.total} משימות` : ''}</span></div>${art('medal', 'wiggle')}</div>`;
    const ng = nextDayGlobal();
    if (ng) h += tomorrowCard(ng.w, ng.d);
    h += howWasCard(w, day);
  } else {
    h += top(t.getDay() === 6 ? 'שבת שלום' : 'יום חופשי', 'אין שיעורים היום', 'books') + firstSteps();
    h += birthdayBanner() + teaser;
    const ng = nextDayGlobal();
    if (ng) h += tomorrowCard(ng.w, ng.d);
  }

  const busy = ['lesson', 'break'].includes(ph.kind);
  if (day && ['lesson', 'break', 'before'].includes(ph.kind)) {
    const ref = ph.next;
    const rest = ref ? day.periods.filter(p => mins(p.start) > mins(ref.start)) : [];
    if (rest.length) h += busy
      ? `<div class="card fold1 ${state._restOpen ? 'open' : ''}"><button class="pnh" data-act="restopen"><b>${ic('calendar')} ובהמשך היום</b><span class="cnt">${rest.length}</span>${ic('chevD', 'chev')}</button>${state._restOpen ? rest.map(p => miniRow(w, day, p)).join('') : ''}</div>`
      : `<div class="card">${cardHead('calendar', 'ובהמשך היום')}${rest.map(p => miniRow(w, day, p)).join('')}</div>`;
  }
  h += todayList(busy) + (busy ? '' : planNotes(w));
  return h;
}

function quickTools() {
  return `<div class="quick q4">
    <button data-act="classmode">${ic('screen')}מצב בכיתה</button>
    <button data-act="timer">${ic('timer')}טיימר</button>
    <button data-act="picker">${ic('dice')}מי עונה?</button>
    <button data-act="wake" class="${wantAwake ? 'on' : ''}">${ic('sun')}${wantAwake ? 'מסך דלוק ✓' : 'מסך דלוק'}</button>
  </div>`;
}

function nowCard(w, day, p, ph) {
  const id = `${day.dow}:${p.label}`;
  const secs = p.sections;
  const si = Math.min(secs.length - 1, state.sec[id] ?? Math.max(0, Math.min(secs.length - 1, Math.floor((ph.pct || 0) * secs.length))));
  const needs = p.materials.map((m, i) => chk(`m:${id}:${i}`, ck(w, `m:${id}:${i}`), esc(m.text))).join('');
  const files = lessonFiles(w, day, p, true);
  const sub = p.subtitle.split('·').slice(1).join('·').trim();
  return `<article class="card nowc" style="--c:${look(p).c}">
    <div class="nc-top">
      <div class="nc-t">${pill(p)}${p.cls && multiCls() ? `<span class="pill clsp">${esc(p.cls)}</span>` : ''}<h2>${logIcon(w, id)}${esc(p.title)}</h2>${sub ? `<small>${esc(sub)}</small>` : ''}</div>
      ${ph.kind === 'lesson' ? ring(ph.left, ph.len) : ring(ph.inMin, Math.max(ph.inMin, 20), 'בעוד')}
    </div>
    ${p.badges.map(b => `<div class="badge">${esc(b)}</div>`).join('')}
    ${secs.length ? `<div class="segtabs" style="--n:${secs.length};--i:${si}"><span class="segind"></span>
      ${secs.map((s, i) => `<button class="${i === si ? 'on' : ''}" data-sec="${esc(id)}|${i}">${esc(s.label || 'פרטים')}</button>`).join('')}
    </div>
    <div class="secpanel">${esc(secs[si].text)}</div>` : ''}
    ${needs || files ? `<div class="nc-cols ${needs && files ? 'two' : ''}">
      ${needs ? `<div class="sub">${cardHead('check', 'מה צריך?', spark())}${needs}</div>` : ''}
      ${files ? `<div class="sub">${cardHead('folder', 'קבצים')}${files}</div>` : ''}
    </div>` : ''}
    ${p.homework.length ? `<div class="hw">${ic('homework')}<div><b>שיעורי בית</b>${p.homework.map(x => `<div>${esc(x)}</div>`).join('')}</div></div>` : ''}
    ${isDict(p) ? dictBtn(day, p) : ''}
    ${timerHint(p)}
    ${ph.kind === 'lesson' ? lessonNotes(w, day, p) : ''}
    ${ph.kind === 'lesson' ? `<div class="tline">${ic('clock')}<span>${ph.left} דק׳ מתוך ${ph.len} דק׳</span><div class="bar"><span style="--w:${Math.round(ph.pct * 100)}%"></span></div></div>` : ''}
  </article>`;
}

function nextCard(day, p, inMin, title = 'הבא בתור') {
  return `<button class="card nextc" data-goto="${day.dow}|${esc(p.label)}">
    <div class="nx-t"><div class="nx-h">${ic('ff')}<b>${title}</b></div>${pill(p)}<h3>${esc(p.title)}</h3><small>${ic('clock')}${inMin != null ? inMinTxt(inMin) : esc(p.start)}</small></div>
    ${art('books', 'nx-art')}
    <span class="circ">${ic('chevL')}</span>
  </button>`;
}

const miniRow = (w, day, p) => `<button class="mrow" data-goto="${day.dow}|${esc(p.label)}"><span class="tpill">${esc(p.start)}</span><span class="grow">${logIcon(w, `${day.dow}:${p.label}`)}${esc(p.title)}</span>${pill(p)}${ic('chevL', 'chev')}</button>`;

function dayStats(w, day) {
  let total = 0, done = 0;
  for (const s of w.prep[day.dow] || []) if (!/שיעורי בית/.test(s.title)) s.items.forEach((_, i) => { total++; if (ck(w, `p:${day.dow}:${s.title}:${i}`)) done++; });
  return { total, done };
}

function tomorrowCard(w, nd) {
  const first = nd.periods[0];
  const pr = (w.prep[nd.dow] || []).find(s => /ערב|הדפסה/.test(s.title));
  const br = (w.prep[nd.dow] || []).find(s => /להכין|להביא/.test(s.title));
  const links = nd.periods.flatMap(p => p.links).filter(l => l.url);
  const file = links.find(l => fileKind(l) === 'ppt') || links[0];
  const isTomorrow = sameDay(dayDate(w, nd), addDays(now(), 1));
  const row = (icon, label, val, attrs) => `<button class="trow" ${attrs}><span class="tri">${icon}</span><span class="grow">${label} ${val}</span>${ic('chevL', 'chev')}</button>`;
  return `<div class="card tmrw">
    ${cardHead('calendar', isTomorrow ? 'מחר מחכה לך' : `יום ${nd.name} מחכה לך`, spark())}
    ${first ? row(ic('alarm'), `<span class="tpill">${esc(first.start)}</span>`, esc(first.title), `data-goto="${nd.dow}|${esc(first.label)}" data-gowk="${w.id}"`) : ''}
    ${pr && pr.items.length ? row(ic('printer'), '<b>להדפיס בבוקר:</b>', `${pr.items.length} פריטים`, `data-pday="${nd.dow}" data-gowk="${w.id}"`) : ''}
    ${br && br.items.length ? row(ic('backpack'), '<b>להביא:</b>', esc(br.items.slice(0, 2).map(i => i.text.split('–')[0].trim()).join(', ')) + (br.items.length > 2 ? ` ועוד ${br.items.length - 2}` : ''), `data-pday="${nd.dow}" data-gowk="${w.id}"`) : ''}
    ${file ? `<a class="trow" href="${esc(file.url)}" target="_blank" rel="noopener"><span class="tri">${fileBadge(fileKind(file))}</span><span class="grow"><b>קובץ חשוב:</b> ${esc(file.text)}</span>${ic('chevL', 'chev')}</a>` : ''}
    ${art('sunrise', 'sunrise')}
  </div>`;
}

function howWasCard(w, day) {
  const n = day.periods.filter(p => getLog(w, `${day.dow}:${p.label}`)).length;
  return `<div class="card">${cardHead('flag', 'איך היה היום?', `<span class="cnt ${n === day.periods.length ? 'all' : ''}">${n}/${day.periods.length}</span>`)}
    ${day.periods.map(p => `<div class="logline"><span class="grow">${esc(p.title)}</span>${logRow(w, `${day.dow}:${p.label}`, true)}</div>`).join('')}
    <p class="hint">חלקית / לא הספקנו? פותחים את השיעור ב"השבוע" ומוסיפים מה נשאר.</p></div>`;
}

// ================================================================ WEEK
function currentSelDay(w) {
  if (state.dayDow === 'all') return 'all';
  if (state.dayDow != null && w.days.some(d => d.dow === state.dayDow)) return state.dayDow;
  const t = todayInWeek(w);
  if (t) return t.dow;
  return (upcomingDay(w) || w.days[0]).dow;
}

function dayChips(w, sel, attr = 'data-day', withGrid = true) {
  const today = todayInWeek(w);
  return `<div class="dchips">${[0, 1, 2, 3, 4, 5].map(dow => {
    const d = w.days.find(x => x.dow === dow);
    const cake = d && state.kids.length && bdOn(dayDate(w, d)).length ? '<i class="dcake">🎂</i>' : '';
    return `<button class="dc ${sel === dow ? 'on' : ''} ${today && today.dow === dow ? 'today' : ''}" ${attr}="${dow}" ${!d ? 'disabled' : ''}>${cake}${DAY_SHORT[dow]}<small>${d ? esc(d.date) : 'חופש'}</small></button>`;
  }).join('')}${withGrid ? `<button class="dc grid ${sel === 'all' ? 'on' : ''}" data-day="all" aria-label="מערכת">${ic('grid')}<small>מערכת</small></button>` : ''}</div>`;
}

function viewDay(w) {
  const sel = currentSelDay(w);
  let h = top('השבוע', `${esc(w.number ? 'שבוע ' + w.number : 'השבוע')}${w.cls ? ' · ' + esc(w.cls) : ''} · <bdi dir="ltr">${esc(w.range || '')}</bdi>`, 'heart') + weekNav(w);
  if (sel === 'all') {
    h += `<div class="card daypick">${dayChips(w, sel)}</div>`;
    h += `<div class="card gridcard">${gridView(w)}</div><p class="hint">לוחצים על שיעור כדי לפתוח אותו</p>` + bdCard(7, 'ימי הולדת בשבוע הקרוב');
    h += `<button class="addbtn" data-printweek="${esc(w.id)}">${ic('printer')} הדפסת התכנון השבועי</button>`;
    return h;
  }
  const day = w.days.find(d => d.dow === sel);
  const isToday = todayInWeek(w) === day;
  const ph = isToday ? phase(day) : null;
  const left = isToday && ph.kind !== 'after' ? day.periods.filter(p => mins(p.end) > nowMin()).length : null;
  h += `<div class="card daypick">
    <div class="dp-pills">${isToday ? `<button class="spill wk ${wantAwake ? 'on' : ''}" data-act="wake">${ic('sun')}${wantAwake ? 'מסך דלוק ✓' : 'מסך דלוק'}</button>` : ''}<span class="spill">${ic('sun')}יום ${day.name} · ${day.date}</span><span class="spill">${ic('calendar')}${left != null ? `עוד ${left} שיעורים` : `${day.periods.length} שיעורים`}</span></div>
    ${dayChips(w, sel)}
  </div>`;
  const bd = state.kids.length ? bdOn(dayDate(w, day)) : [];
  if (bd.length) h += `<div class="card bday small">${art('cake', 'bob')}<div><b>יום הולדת ל${esc(names(bd))} 🎉</b></div></div>`;
  if (multiCls()) h += `<div class="fchips clsfilter"><button class="fc ${!state.clsFilter ? 'on' : ''}" data-clsf="">כל הכיתות</button>${state.classes.map(c => `<button class="fc ${state.clsFilter === c.name ? 'on' : ''}" data-clsf="${esc(c.name)}">${esc(c.name)}</button>`).join('')}</div>`;
  h += `<div class="lessons" data-swipe>${day.periods.filter(p => !state.clsFilter || !p.cls || p.cls === state.clsFilter).map(p => lessonRow(w, day, p, ph)).join('') || `<div class="card empty"><p>אין שיעורים ביום הזה בתכנון.</p><p class="hint">אם זו טעות – מעלים שוב את ה־PDF של השבוע (עוד ← להעלות תכנון)</p></div>`}</div>`;
  h += `<button class="addbtn" data-edit="${day.dow}|">${ic('plus')} הוספת שיעור ליום ${esc(day.name)}</button>`;
  const hw = day.periods.filter(p => p.homework.length);
  if (hw.length) h += `<div class="card">${cardHead('homework', 'שיעורי בית היום')}${hw.map(p => `<div class="note"><b>${esc(p.title)}</b><span>${esc(p.homework.join(' · '))}</span></div>`).join('')}</div>`;
  h += `<button class="addbtn" data-printweek="${esc(w.id)}">${ic('printer')} הדפסת התכנון השבועי</button>`;
  return h;
}

const SEC_ICON = l => /פתיחה/.test(l) ? 'target' : /גוף/.test(l) ? 'layers' : /סיום/.test(l) ? 'flag' : /תזכורת/.test(l) ? 'bell' : /מפגש/.test(l) ? 'users' : /מתמטיקה|אני עושה/.test(l) ? 'calc' : /הכתבה|מילים/.test(l) ? 'pencil' : 'sparkle';

function lessonRow(w, day, p, ph) {
  const id = `${day.dow}:${p.label}`;
  const isNow = ph && ph.cur === p;
  const open = state.open[id] ?? isNow;
  const sub = p.subtitle.split('·').slice(1).join('·').trim();
  return `<article class="lrow ${open ? 'open' : ''} ${isNow ? 'now' : ''}" style="--c:${look(p).c}" data-id="${esc(id)}">
    <button class="lr-h" data-toggle="${esc(id)}" aria-expanded="${open}">
      ${pill(p)}
      <span class="lr-t"><b>${logIcon(w, id)}${p.cls && multiCls() ? `<i class="clsb">${esc(p.cls)}</i>` : ''}${esc(p.title)}</b><small class="lr-time">${esc(p.start)}–${esc(p.end)}${isNow ? ' <i class="live">עכשיו</i>' : ''}</small></span>
      <span class="circ">${ic('chevD')}</span>
    </button>
    <div class="lr-b"><div class="lr-in">
      ${sub || p.sections.length ? `<div class="inner">
        ${sub ? `<div class="srow"><span class="si">${ic('sparkle')}</span><span>${esc(sub)}</span></div>` : ''}
        ${p.sections.map(s => `<div class="srow"><span class="si">${ic(SEC_ICON(s.label))}</span><span>${s.label ? `<b>${esc(s.label)}:</b> ` : ''}${esc(s.text)}</span></div>`).join('')}
      </div>` : ''}
      ${p.badges.map(b => `<div class="badge">${esc(b)}</div>`).join('')}
      ${p.materials.length ? `<div class="sub">${cardHead('check', 'מה צריך?')}${p.materials.map((m, i) => chk(`m:${id}:${i}`, ck(w, `m:${id}:${i}`), esc(m.text))).join('')}</div>` : ''}
      ${p.homework.length ? `<div class="hw">${ic('homework')}<div><b>שיעורי בית</b>${p.homework.map(x => `<div>${esc(x)}</div>`).join('')}</div></div>` : ''}
      <div class="sub">${cardHead('folder', 'קבצים')}${lessonFiles(w, day, p)}
        <button class="addrow" data-attach="${esc(day.dow + '|' + p.label)}">${ic('plus')} הוספת קובץ לשיעור</button></div>
      ${isDict(p) ? dictBtn(day, p) : ''}
      ${lessonNotes(w, day, p)}
      ${timerHint(p)}
      ${logRow(w, id, false)}
      <div class="btnrow lrow-acts"><button class="editbtn" data-edit="${esc(day.dow + '|' + p.label)}">${ic('pencil')} עריכת השיעור</button><button class="editbtn" data-banksave="${esc(day.dow + '|' + p.label)}">${ic('star')} למאגר</button><button class="editbtn" data-sharelesson="${esc(day.dow + '|' + p.label)}">${ic('upload')} שיתוף</button></div>
    </div></div>
  </article>`;
}

function gridView(w) {
  const labels = [];
  for (const d of w.days) for (const p of d.periods) if (!labels.includes(p.label)) labels.push(p.label);
  labels.sort((a, b) => (a === 'בוקר' ? -1 : b === 'בוקר' ? 1 : (parseFloat(a) || 99) - (parseFloat(b) || 99)));
  const days = [0, 1, 2, 3, 4, 5].map(dow => w.days.find(d => d.dow === dow) || { dow, off: true, periods: [] });
  const today = todayInWeek(w);
  let h = `<div class="grid" style="--cols:${days.length}"><div class="gh"></div>`;
  h += days.map(d => `<div class="gh ${today && today.dow === d.dow ? 'today' : ''} ${d.off ? 'off' : ''}">${DAY_SHORT[d.dow]}${!d.off && bdOn(dayDate(w, d)).length ? '🎂' : ''}<small>${esc(d.date || 'חופש')}</small></div>`).join('');
  for (const lb of labels) {
    h += `<div class="gl">${lb === 'בוקר' ? ic('sun') : esc(lb)}</div>`;
    for (const d of days) {
      const p = d.periods.find(x => x.label === lb);
      h += p ? `<button class="gc" style="--c:${look(p).c}" data-goto="${d.dow}|${esc(lb)}">${logIcon(w, `${d.dow}:${lb}`)}<span>${esc(p.title)}</span></button>` : `<div class="gc empty"></div>`;
    }
  }
  return h + '</div>';
}

// ================================================================ PREP
function prepDay(w) {
  if (state.prepDow != null && w.days.some(d => d.dow === state.prepDow)) return w.days.find(d => d.dow === state.prepDow);
  const t = todayInWeek(w);
  if (t && phase(t).kind === 'after') return nextSchoolDay(w, t.dow) || t;
  return t || upcomingDay(w) || w.days[0];
}
const SEC_LOOK = t => /ערב|הדפסה/.test(t) ? ['printer', 'להדפיס בבוקר'] : /להכין|להביא/.test(t) ? ['backpack', 'להכין / להביא'] : /שיעורי בית/.test(t) ? ['homework', 'שיעורי בית שניתנים'] : ['check', t];

function prepSectionCard(w, day, s, si) {
  const [icon, title] = SEC_LOOK(s.title);
  const hwSec = /שיעורי בית/.test(s.title);
  const edit = state.prepEdit && state.tab === 'prep';
  const items = s.items.map((it, i) => {
    const k = `p:${day.dow}:${s.title}:${i}`;
    return edit
      ? `<div class="erow1"><input class="litem" data-prepitem="${day.dow}|${si}|${i}" value="${esc(it.text)}"><button class="iconbtn" data-delprep="${day.dow}|${si}|${i}" aria-label="מחיקה">${ic('trash')}</button></div>`
      : it.url
        ? chk(k, ck(w, k), `<button class="pfile" data-printitem="${day.dow}|${si}|${i}">${ic(/שכפול/.test(it.text) ? 'layers' : 'printer')}<span>${esc(it.text)}</span>${ic('chevL', 'chev')}</button>`, '')
        : chk(k, ck(w, k), `${esc(it.text)}${it.period ? ` <small class="tpill">שעה ${esc(it.period)}</small>` : ''}`, hwSec ? '' : miniArt(it.text));
  }).join('');
  return `<div class="card prep">${cardHead(icon, title, `<span class="cnt">${s.items.length} ${hwSec ? 'פריטים' : 'משימות'}</span>`)}${items}
    ${edit ? `<form class="addtodo" data-addprep="${day.dow}|${si}"><input name="t" placeholder="פריט חדש…" autocomplete="off"><button aria-label="הוספה">${ic('plus')}</button></form>` : ''}
  </div>`;
}
function prepCards(w, day, mode) {
  return (w.prep[day.dow] || []).map((s, i) => [s, i]).filter(([s]) => mode !== 'today' || !/שיעורי בית/.test(s.title))
    .map(([s, i]) => prepSectionCard(w, day, s, i)).join('');
}

function viewPrep(w) {
  const day = prepDay(w);
  let h = top('להכין', 'הכנה מסודרת ליום הלימודים – כדי שהכל יהיה מוכן ובזמן', 'notepad') + weekNav(w);
  h += `<div class="card daypick">${dayChips(w, day.dow, 'data-pday', false)}</div>`;
  if (!w.prep[day.dow] || !w.prep[day.dow].length) {
    w.prep[day.dow] = [{ title: 'להכין / להביא', icon: '', items: day.periods.flatMap(p => p.materials.map(m => ({ text: m.text, period: p.label }))) }];
  }
  const S = dayStats(w, day);
  h += `<div class="card progress">
    <div class="pg-h"><span class="spill">${ic('target')}התקדמות יום ${esc(day.name)}</span><b><span class="num">${S.done}</span> מתוך ${S.total} הושלמו</b></div>
    ${streak() > 1 ? `<div class="streak">🔥 ${streak()} ימים ברצף שהכל היה מוכן</div>` : ''}
    <div class="bar big"><span style="--w:${S.total ? S.done / S.total * 100 : 0}%"></span></div>
  </div>`;
  h += prepCards(w, day, 'all');
  if (state.prepEdit) h += `<div class="card">${cardHead('plus', 'רשימה חדשה ליום ' + esc(day.name))}<form class="addtodo" data-prepnew="${day.dow}"><input name="t" placeholder="למשל: לבדוק לפני היציאה" autocomplete="off"><button aria-label="הוספה">${ic('plus')}</button></form></div>`;
  h += `<button class="addbtn" data-act="prepedit">${ic(state.prepEdit ? 'check' : 'pencil')} ${state.prepEdit ? 'סיימתי לערוך' : 'עריכת הרשימות'}</button>`;
  const left = S.total - S.done;
  h += left
    ? `<div class="card almost"><div class="grow"><b>נשארו ${left} משימות</b><span>להכנת יום ${esc(day.name)}</span></div>${art('mountain')}</div>`
    : `<div class="card almost done"><div class="grow"><b>הכל מוכן! 🎉</b><span>${g('את מוכנה', 'אתה מוכן')} ליום ${esc(day.name)}</span></div>${art('star', 'wiggle')}</div>`;
  return h;
}

// ================================================================ FILES
function viewFiles(w) {
  const files = collectFiles(w);
  const q = state.q.trim(), mode = state.fgroup || 'day';
  const kindWord = f => ({ ppt: 'מצגת', folder: 'תיקייה', sheet: 'טבלה', pdf: 'pdf' }[fileKind(f)] || 'דף מסמך');
  const refP = f => f.ref && state.weeks[f.ref.w] ? findPeriodIn(state.weeks[f.ref.w], f.ref.dow, f.ref.label) : null;
  let h = top('קבצים', 'כל הקבצים של הכיתה במקום אחד, נגישים ומהירים', 'folder');
  h += `<button class="cta upl" data-act="uploadfiles">${ic('upload')} העלאת קבצים</button><p class="hint">אני אזהה לבד לאיזה שיעור כל קובץ שייך ✨<br>מהדרייב: "עיון" ← Google Drive</p>`;
  h += `<label class="search">${ic('search')}<input id="fq" type="search" placeholder="חיפוש קובץ" value="${esc(state.q)}"></label>`;
  // ---- search: one flat list
  if (q) {
    const hit = files.filter(f => (f.text + ' ' + f.uses.map(u => u.p.title + ' ' + look(u.p).n).join(' ') + ' ' + kindWord(f)).includes(q));
    const ups = state.files.filter(f => (f.name + ' ' + ((refP(f) || {}).title || '')).includes(q));
    h += hit.length + ups.length
      ? `<div class="card fgrp open">${cardHead('search', `תוצאות ל"${esc(q)}"`, `<span class="cnt">${hit.length + ups.length}</span>`)}${hit.map(f => fileRow(f)).join('')}${ups.map(f => upRow(f)).join('')}</div>`
      : `<p class="hint">לא מצאתי "${esc(q)}" 🤔</p>`;
    return h;
  }
  // ---- pinned
  const pinned = Object.entries(state.pins).map(([url, text]) => files.find(f => f.url === url) || { url, text, uses: [] });
  if (pinned.length) h += `<div class="card pinned">${cardHead('starFill', 'תמיד בשלוף', spark())}${pinned.map(f => fileRow(f)).join('')}</div>`;
  // ---- groups
  h += `<div class="seg fseg">${[['day', 'calendar', 'לפי יום'], ['subj', 'books', 'לפי מקצוע'], ['print', 'printer', 'להדפסה']].map(([v, i, l]) => `<button class="${mode === v ? 'on' : ''}" data-fgroup="${v}">${ic(i)}${l}</button>`).join('')}</div>`;
  const groups = []; // {key, title, sub, rows:[html]}
  const grp = (key, title, sub) => { let g = groups.find(x => x.key === key); if (!g) groups.push(g = { key, title, sub, rows: [] }); return g; };
  const weekUps = state.files.filter(f => f.ref && f.ref.w === w.id);
  const otherUps = state.files.filter(f => !(f.ref && f.ref.w === w.id)).sort((a, b) => (a.added < b.added ? 1 : -1));
  const today = todayInWeek(w) || upcomingDay(w);
  if (mode === 'day') {
    for (const d of w.days) {
      const g = grp('d' + d.dow, `יום ${d.name}`, d === today ? (todayInWeek(w) ? 'היום' : 'הבא') : '');
      const seen = new Set();
      for (const p of d.periods) {
        for (const l of p.links) if (l.url && !seen.has(l.url)) { seen.add(l.url); const f = files.find(x => x.url === l.url); if (f) g.rows.push(fileRow(f, false, `${esc(p.title)}${p.start ? ' · ' + p.start : ''}`)); }
        for (const f of weekUps.filter(x => x.ref.dow === d.dow && x.ref.label === p.label)) g.rows.push(upRow(f, false, `${esc(p.title)} · ${fmtSize(f.size)}`));
      }
    }
  } else if (mode === 'subj') {
    for (const f of files) grp('s' + look(f.uses[0].p).n, look(f.uses[0].p).n).rows.push(fileRow(f, false, [...new Set(f.uses.map(x => 'יום ' + DAY_SHORT[x.d.dow]))].join(', ')));
    for (const f of weekUps) { const p = refP(f); grp('s' + (p ? look(p).n : 'כללי'), p ? look(p).n : 'כללי').rows.push(upRow(f, false, `יום ${DAY_SHORT[f.ref.dow]} · ${fmtSize(f.size)}`)); }
    groups.sort((a, b) => b.rows.length - a.rows.length);
  } else {
    for (const d of w.days) {
      const g = grp('p' + d.dow, `יום ${d.name}`, d === today ? (todayInWeek(w) ? 'היום' : 'הבא') : '');
      (w.prep[d.dow] || []).forEach((sc, si) => sc.items.forEach((it, i) => {
        if (!it.url) return;
        const k = `p:${d.dow}:${sc.title}:${i}`, done = ck(w, k);
        g.rows.push(`<button class="pfile prow ${done ? 'done' : ''}" data-printitem="${d.dow}|${si}|${i}">${ic(/שכפול/.test(it.text) ? 'layers' : 'printer')}<span class="grow"><b>${esc(it.text)}</b><small>${esc(sc.title)}${done ? ' · הודפס ✓' : ''}</small></span>${ic('chevL', 'chev')}</button>`);
      }));
    }
  }
  if (mode !== 'print' && otherUps.length) grp('other', 'קבצים כלליים ומשבועות אחרים').rows.push(...otherUps.map(f => upRow(f)));
  const shown = groups.filter(g => g.rows.length);
  const firstOpen = (shown.find(g => g.sub) || shown[0] || {}).key;
  for (const g of shown) {
    const open = state.fopen && g.key in state.fopen ? state.fopen[g.key] : g.key === firstOpen;
    h += `<div class="card fgrp ${open ? 'open' : ''}">
      <button class="fgh" data-fopen="${esc(g.key)}"><b>${esc(g.title)}</b>${g.sub ? `<em class="today">${g.sub}</em>` : ''}<span class="cnt">${g.rows.length}</span>${ic('chevD', 'chev')}</button>
      ${open ? `<div class="fgb">${g.rows.join('')}</div>` : ''}
    </div>`;
  }
  if (!shown.length) h += `<p class="hint">${mode === 'print' ? 'אין קבצי הדפסה עם קישור בשבוע הזה.' : 'אין עדיין קבצים לשבוע הזה.'}</p>`;
  if (!pinned.length) h += `<p class="hint">טיפ: לוחצים על ☆ ליד קובץ – והוא יישאר תמיד למעלה.</p>`;
  return h;
}


// why a file could not be read – so the message says what to do, and a report carries the details
async function fileDiag(f, isPdf) {
  const d = { name: f.name, type: f.type || '?', size: f.size, err: f._err || '' };
  if (!isPdf || !f.size) return d;
  try {
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
    d.pages = doc.numPages; let txt = '';
    for (let i = 1; i <= Math.min(2, doc.numPages); i++) txt += (await (await doc.getPage(i)).getTextContent()).items.map(x => x.str).join(' ');
    d.chars = txt.replace(/\s+/g, '').length; d.start = txt.replace(/\s+/g, ' ').trim().slice(0, 80);
  } catch (x) { d.err = d.err || String(x && (x.name || x.message) || x); }
  return d;
}
function diagReason(d) {
  if (!d) return '';
  if (!d.size) return 'הקובץ הגיע ריק (0KB). זה קורה כשהקובץ עוד לא ירד לטלפון מווטסאפ או מ־iCloud – פותחים אותו פעם אחת, שומרים שוב ב"קבצים" ומעלים מחדש.';
  if (/Password/i.test(d.err)) return 'הקובץ מוגן בסיסמה. צריך לשמור אותו מחדש בלי סיסמה.';
  if (/Invalid|Missing|Corrupt|FormatError/i.test(d.err)) return 'הקובץ פגום או שלא ירד עד הסוף. כדאי לשמור אותו שוב ולנסות.';
  if (d.pages && d.chars != null && d.chars < 40) return 'זה PDF של תמונה – צילום מסך, סריקה או "הדפסה כתמונה" – ואין בו טקסט שאפשר לקרוא. צריך את הקובץ המקורי (למשל זה שיוצא מ־Word, Google Docs או Canva כ־PDF רגיל).';
  return 'הקובץ נקרא, אבל המבנה שלו שונה מהתכנונים שאני מכירה.';
}
const diagText = d => d ? `קובץ: ${d.name} · ${d.type} · ${Math.round(d.size / 1024)}KB${d.pages != null ? ` · ${d.pages} עמודים · ${d.chars} תווים` : ''}${d.err ? ` · שגיאה: ${d.err}` : ''}${d.start ? `\nתחילת הטקסט: ${d.start}` : ''}` : '';

// ================================================================ dictation: shuffle the word order
const isDict = p => /הכתבה/.test(`${p.title} ${p.subtitle} ${p.sections.map(s => s.label + ' ' + s.text).join(' ')}`);
const splitWords = t => String(t || '').split(/[,،·\n]+|\s[–-]\s/).map(x => x.trim().replace(/^["״']|["״']$/g, '')).filter(x => x && x.length < 40);
const dictBtn = (day, p) => `<button class="cta soft dictbtn" data-dict="${esc(day.dow + '|' + p.label)}">🎲 הגרלת סדר המילים להכתבה</button>`;
function dictSource(w, dow, label) {
  const k = `${w.id}:${dow}:${label}`;
  if (state.dict[k]) return state.dict[k];
  const p = findPeriodIn(w, dow, label);
  const sec = p && p.sections.find(s => /הכתבה|מילים/.test(s.label) && s.text);
  if (sec) return splitWords(sec.text);
  const prev = sortedWeeks().filter(x => x.id < w.id).pop();
  const n = [...(prev ? prev.notes || [] : []), ...(w.notes || [])].find(x => /הכתבה/.test(x.label));
  return n ? splitWords(n.text) : [];
}
function shuffled(a, not) {
  for (let t = 0; t < 6; t++) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    if (b.length < 2 || b.join() !== (not || a).join()) return b;
  }
  return a.slice().reverse();
}
function dictSheet(k, words, order) {
  state._dict = { k, order: order || [] };
  openOverlay(`<div class="ov sheet dict">
    <button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('text')}<h2>סדר המילים להכתבה</h2></div>
    ${order && order.length ? `<ol class="dlist" style="grid-template-rows:repeat(${Math.ceil(order.length / 2)},auto);grid-auto-flow:column">${order.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : `<p class="dim">${words.length ? `${words.length} מילים מוכנות להגרלה` : 'כותבים את המילים כאן (פסיק או שורה חדשה בין מילה למילה)'}</p>`}
    <button class="cta" data-act="dictshuffle">🎲 ${order && order.length ? 'הגרלה חדשה' : 'להגריל סדר'}</button>
    ${order && order.length ? `<button class="cta soft" data-act="projdict">${ic('screen')} הקרנה ללוח</button>` : ''}
    <label class="field">המילים<textarea id="dictIn" rows="4" placeholder="חבר, חברה, חברים…">${esc(words.join(', '))}</textarea></label>
  </div>`);
}

// ================================================================ print the week (same layout as the PDF plan)
function printWeek(w) {
  if (!w) return;
  let r = $('#printroot');
  if (!r) { r = document.createElement('div'); r.id = 'printroot'; document.body.appendChild(r); }
  r.innerHTML = weekPrintHtml(w, { look, dayFull: DAY_FULL, classSize: classSize(w), name: state.name });
  document.body.classList.add('printing');
  setTimeout(() => window.print(), 60);
}
window.addEventListener('afterprint', () => document.body.classList.remove('printing'));


// ================================================================ messages to parents (in Noa's style)
const HE_MONTH = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const toLines = v => String(v || '').split('\n').map(x => x.trim()).filter(Boolean);
function pmDefaults(w, type) {
  const t = now();
  const today = todayInWeek(w), next = w.days.find(d => dayDate(w, d) > t) || w.days[w.days.length - 1];
  const past = w.days.filter(d => dayDate(w, d) && dayDate(w, d) <= t).pop() || w.days[0];
  if (type === 'all') {
    const n = (w.notes || []).find(x => /הכתבה/.test(x.label));
    const g = (next ? next.periods : []).flatMap(p => [...p.materials.map(m => m.text), ...p.sections.map(x => x.text)]).filter(x => /להביא|לצייד|להגיע עם/.test(x));
    return { scope: t.getDay() === 6 || t.getDay() === 5 ? 'week' : 'day', dow: (today || past).dow, topic: n ? (n.label.split('·')[1] || '').trim() : '', words: n ? splitWords(n.text) : [], dictWhen: '',
      tests: autoTests(w), events: autoEvents(w), names: weekBdays(w, state.kids), bdayWhen: '', gear: g, treats: false };
  }
  if (type === 'today') return { dow: (today || past).dow, learned: true, hw: true, help: true };
  if (type === 'personal') return { kid: '', kind: 'star', notes: [], noteIds: [], extra: '' };
  if (type === 'forms') { const f = state.forms[state.forms.length - 1]; return { form: f ? f.id : '' }; }
  if (type === 'change') { const ch = recentChanges(); return { picked: ch.filter(c => Date.now() - c.at < 3 * 864e5).map(c => c.id), lines: [] }; }
  if (type === 'holiday') { const h = nextHoliday(t); return { holiday: h ? h.name : (t.getDay() >= 4 ? 'שבת' : 'שבת'), extra: '' }; }
  if (type === 'mine') return {};
  if (type === 'week') return { learn: true, hw: true, events: true, gear: [] };
  if (type === 'gear') {
    const d = next;
    const g = d ? d.periods.flatMap(p => [...p.materials.map(m => m.text), ...p.sections.map(x => x.text)]).filter(x => /להביא|לצייד|להגיע עם/.test(x)) : [];
    return { dow: d && d.dow, gear: g };
  }
  if (type === 'dict') {
    const n = (w.notes || []).find(x => /הכתבה/.test(x.label));
    return { topic: n ? (n.label.split('·')[1] || '').trim() : '', words: n ? splitWords(n.text) : [] };
  }
  if (type === 'test') {
    const hit = w.days.flatMap(d => d.periods.filter(p => /מבדק|משימת הערכה|מבחן/.test(p.title)).map(p => ({ d, p })))[0];
    return { what: hit ? hit.p.title : 'מבדק', when: hit ? `ביום ${hit.d.name}${hit.d.date ? ' ' + hit.d.date : ''}` : '', topics: [] };
  }
  if (type === 'bday') {
    const m = t.getMonth() + 1;
    return { month: HE_MONTH[m - 1], names: state.kids.filter(k => k.bd && +k.bd.split('.')[1] === m).map(k => k.name), when: '' };
  }
  return {};
}
function pmText(w) {
  const P = state.pm, o = P.opts, at = now();
  const day = o.dow != null ? w.days.find(d => d.dow === +o.dow) : null;
  if (P.type === 'mine') return P.text || '';
  if (P.type === 'change') o.lines = [...recentChanges().filter(c => (o.picked || []).includes(c.id)).map(changeLine), ...(o.more || [])];
  if (P.type === 'forms') { const fm = state.forms.find(x => x.id === o.form); o.title = fm ? fm.title : ''; }
  const f = { all: buildAll, personal: buildPersonal, forms: buildForms, change: buildChange, holiday: buildHoliday, today: buildToday, week: buildWeekMsg, dict: buildDict, gear: buildGear, test: buildTest, bday: buildBday }[P.type];
  o.len = P.len || 'normal';
  const out = f({ w, day, look, at, kids: state.kids, opts: o });
  const fixedStart = ['dict', 'bday', 'test', 'forms'].includes(P.type);
  if (P.opener && !fixedStart) out[0] = P.opener;
  if (P.closer && !['dict', 'bday'].includes(P.type)) { let i = out.length - 1; while (i > 0 && !out[i].trim()) i--; out[i] = P.closer; }
  let txt = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (P.noemoji) txt = stripEmoji(txt);
  if (P.sign && state.name) txt += `\n${state.name} 🌻`;
  return txt;
}
function viewMsgs(w) {
  let h = top('הודעה להורים', 'הודעה מוכנה לקבוצת ההורים, בסגנון שלך – בודקים, מתקנים ושולחים', 'heart', { back: 'cls' });
  if (!w) return h + `<p class="hint">צריך קודם תכנון שבועי.</p>`;
  state.pm = state.pm || { type: 'all', sign: false };
  const P = state.pm;
  if (!P.opts || P.optsFor !== P.type + w.id) { P.opts = pmDefaults(w, P.type); P.optsFor = P.type + w.id; P.text = null; }
  const o = P.opts;
  const MAIN = ['all', 'today', 'week', 'personal'];
  const showMore = state.pmMore || !MAIN.includes(P.type);
  const tbtn = ([id, i, l]) => `<button class="${P.type === id ? 'on' : ''}" data-pmtype="${id}">${ic(i)}<span>${l}</span></button>`;
  h += `<div class="pmtypes main4">${PM_TYPES.filter(x => MAIN.includes(x[0])).map(tbtn).join('')}</div>
    <button class="linkbtn pmmore" data-act="pmmore">${showMore ? 'פחות סוגים ▴' : `סוגים נוספים (${PM_TYPES.length - MAIN.length}) ▾`}</button>
    ${showMore ? `<div class="pmtypes">${PM_TYPES.filter(x => !MAIN.includes(x[0])).map(tbtn).join('')}</div>` : ''}`;
  const tog = (k, l) => `<button class="fc ${o[k] !== false ? 'on' : ''}" data-pmtog="${k}">${o[k] !== false ? '✓ ' : ''}${l}</button>`;
  const dayPick = () => `<div class="fchips">${w.days.map(d => `<button class="fc ${+o.dow === d.dow ? 'on' : ''}" data-pmday="${d.dow}">יום ${esc(d.name)}</button>`).join('')}</div>`;
  const ta = (k, l, ph) => `<label class="field">${l}<textarea rows="4" data-pmopt="${k}" data-lines="1" placeholder="${ph}">${esc((o[k] || []).join('\n'))}</textarea></label>`;
  const inp = (k, l, ph) => `<label class="field">${l}<input data-pmopt="${k}" value="${esc(o[k] || '')}" placeholder="${ph}"></label>`;
  let f = '';
  if (P.type === 'all') {
    f = `<div class="seg pmscope"><button class="${o.scope !== 'day' ? 'on' : ''}" data-pmscope="week">${ic('calendar')}על השבוע</button><button class="${o.scope === 'day' ? 'on' : ''}" data-pmscope="day">${ic('sun')}על יום אחד</button></div>`
      + (o.scope === 'day' ? dayPick() : '')
      + `<p class="pmlbl">מה להכניס:</p><div class="fchips">${tog('learn', 'מה למדנו')}${tog('hw', 'שיעורי בית')}${tog('dict', 'הכתבה')}${tog('tests', 'מבדקים')}${tog('events', 'אירועים')}${tog('bday', 'ימי הולדת')}${tog('gear', 'ציוד')}</div>`
      + (o.dict !== false ? `<details class="pmsec" open><summary>✍️ הכתבה</summary>${inp('topic', 'הנושא', 'שם המספר בלשון זכר')}${inp('dictWhen', 'מתי ההכתבה (לא חובה)', 'ביום ראשון')}${ta('words', 'המילים (שורה לכל מילה)', 'אֶחָד\nשְׁנַיִם')}</details>` : '')
      + (o.tests !== false ? `<details class="pmsec" open><summary>📝 מבדקים</summary>${ta('tests', 'שורה לכל מבדק', 'ביום שלישי 24/11 – מבדק בתורה')}</details>` : '')
      + (o.events !== false ? `<details class="pmsec"><summary>📌 אירועים ותזכורות</summary>${ta('events', 'שורה לכל דבר', 'ביום שישי – מסיבת פיג׳מות')}</details>` : '')
      + (o.bday !== false ? `<details class="pmsec" open><summary>🎂 ימי הולדת</summary>${ta('names', 'החוגגים (שורה לכל ילד)', 'בר\nנועה')}${inp('bdayWhen', 'מתי חוגגים (לא חובה)', 'יום שישי, 27.11')}<div class="fchips">${`<button class="fc ${o.treats ? 'on' : ''}" data-pmtog2="treats">${o.treats ? '✓ ' : ''}רשימת כיבוד להורי החוגגים</button>`}</div></details>` : '')
      + (o.gear !== false ? `<details class="pmsec"><summary>🎒 ציוד</summary>${ta('gear', 'שורה לכל פריט', 'דבק סטיק')}</details>` : '');
  }
  if (P.type === 'personal') {
    const kids = state.kids;
    f = kids.length ? `<p class="pmlbl">לאיזה הורה?</p><div class="fchips">${kids.map(k => `<button class="fc ${o.kid === k.name ? 'on' : ''}" data-pmkid="${esc(k.name)}">${esc(k.name)}${k.phone ? ' 📞' : ''}</button>`).join('')}</div>`
      : `<p class="hint">צריך קודם רשימת ילדים (עוד ← הכיתה שלי). עם טלפון של הורה – ההודעה תישלח ישר אליו.</p>`;
    f += `<div class="seg pmscope"><button class="${o.kind === 'star' ? 'on' : ''}" data-pmkind="star">🌟 מילה טובה</button><button class="${o.kind !== 'star' ? 'on' : ''}" data-pmkind="update">${ic('phone2')} עדכון</button></div>`;
    if (o.kid) {
      const ns = state.cnotes.filter(n => (n.kids || []).includes(o.kid)).slice(-8).reverse();
      if (ns.length) f += `<p class="pmlbl">מתוך יומן הכיתה:</p><div class="pmnotes">${ns.map(n => `<button class="${(o.noteIds || []).includes(n.id) ? 'on' : ''}" data-pmnote="${n.id}"><span>${(TAGS[n.tag] || TAGS.note)[0]}</span><span class="grow">${esc(n.text || TAGS[n.tag][1])}</span><small>${new Date(n.at).getDate()}.${new Date(n.at).getMonth() + 1}</small></button>`).join('')}</div>`;
    }
    f += `<label class="field">מה לכתוב (במילים שלך)<input data-pmopt="extra" value="${esc(o.extra || '')}" placeholder="${o.kind === 'star' ? 'עזר לחבר בשיעור חשבון' : 'היום היה לו קשה להתרכז'}"></label>`;
  }
  if (P.type === 'forms') {
    const fm = state.forms.find(x => x.id === o.form);
    f = `<p class="pmlbl">איזה טופס?</p><div class="fchips">${state.forms.map(x => `<button class="fc ${x.id === o.form ? 'on' : ''}" data-pmform="${x.id}">${esc(x.title)}</button>`).join('')}</div>
      <form class="addtodo" data-formnew><input name="t" placeholder="טופס חדש: אישור יום ההליכה" autocomplete="off"><button aria-label="הוספה">${ic('plus')}</button></form>`;
    if (fm) {
      const miss = state.kids.filter(k => !fm.done.includes(k.name));
      f += state.kids.length ? `<p class="pmlbl">מי כבר החזיר? (לוחצים לסימון) · נשארו ${miss.length}</p><div class="fchips">${state.kids.map(k => `<button class="fc ${fm.done.includes(k.name) ? 'on' : ''}" data-formkid="${esc(k.name)}">${fm.done.includes(k.name) ? '✓ ' : ''}${esc(k.name)}</button>`).join('')}</div>` : `<p class="hint">צריך רשימת ילדים (עוד ← הכיתה שלי).</p>`;
      if (miss.length) f += `<details class="pmsec"><summary>📞 תזכורת אישית להורים שלא החזירו (${miss.length})</summary>${miss.map(k => `<button class="pmkidsend" data-wakid="${esc(k.name)}">${ic('phone2')} ${esc(k.name)}${k.phone ? '' : ' <small>(אין טלפון)</small>'}</button>`).join('')}</details>`;
      f += `<button class="linkbtn" data-formdel="${fm.id}">מחיקת הטופס</button>`;
    }
  }
  if (P.type === 'change') {
    const ch = recentChanges();
    f = ch.length ? `<p class="pmlbl">שינויים שעשית במערכת (לוחצים לבחירה):</p><div class="pmnotes">${ch.map(c => `<button class="${(o.picked || []).includes(c.id) ? 'on' : ''}" data-pmch="${c.id}"><span>🔁</span><span class="grow">${esc(changeLine(c))}</span></button>`).join('')}</div>`
      : `<p class="hint">כשמזיזים, מוסיפים או מוחקים שיעור באפליקציה – השינוי יופיע כאן.</p>`;
    f += ta('more', 'שינויים נוספים (שורה לכל שינוי)', 'תנ״ך מעכשיו רק ביום שלישי');
  }
  if (P.type === 'holiday') {
    const nh = nextHoliday(now());
    f = `${nh ? `<p class="pmlbl">החג הבא: <b>${nh.name}</b> ${nh.inDays === 0 ? '(היום)' : `בעוד ${nh.inDays} ימים`}</p>` : ''}<div class="fchips">${HOLIDAY_NAMES.map(n => `<button class="fc ${o.holiday === n ? 'on' : ''}" data-pmhol="${esc(n)}">${esc(n)}</button>`).join('')}</div>`
      + `<label class="field">משפט אישי (לא חובה)<input data-pmopt="extra" value="${esc(o.extra || '')}" placeholder="אני נהנית ללוות את הילדים…"></label>`;
  }
  if (P.type === 'mine') {
    f = state.pmtpl.length ? `<div class="pmnotes">${state.pmtpl.map(x => `<div class="pmtpl"><button data-pmtpl="${x.id}"><span>⭐</span><span class="grow">${esc(x.name)}</span></button><button class="iconbtn" data-pmtpldel="${x.id}" aria-label="מחיקה">${ic('trash')}</button></div>`).join('')}</div>`
      : `<p class="hint">עוד אין תבניות. כותבים הודעה בכל סוג אחר ולוחצים "⭐ שמירה כתבנית".</p>`;
  }
  if (P.type === 'today') f = dayPick() + `<div class="fchips">${tog('learned', 'מה למדנו')}${tog('hw', 'שיעורי בית')}${tog('help', '"כאן לעזרה"')}</div>`;
  if (P.type === 'week') f = `<div class="fchips">${tog('learn', 'מה נלמד')}${tog('hw', 'שיעורי בית')}${tog('events', 'אירועים וימי הולדת')}</div>` + ta('gear', 'ציוד להביא השבוע (שורה לכל פריט, לא חובה)', 'מרקרים בארבעה צבעים');
  if (P.type === 'gear') f = dayPick() + ta('gear', 'מה להביא (שורה לכל פריט)', 'דבק סטיק\nמספריים');
  if (P.type === 'dict') f = inp('topic', 'הנושא', 'שם המספר בלשון זכר') + ta('words', 'המילים (שורה לכל מילה)', 'אֶחָד\nשְׁנַיִם');
  if (P.type === 'test') f = inp('what', 'איזה מבדק', 'המבדק במתמטיקה') + inp('when', 'מתי', 'ביום שלישי 24/11') + ta('topics', 'נושאים (לא חובה)', 'חיבור וחיסור עד 20');
  if (P.type === 'bday') f = inp('month', 'ילידי חודש', 'נובמבר') + ta('names', 'החוגגים', 'שם בכל שורה') + inp('when', 'מתי חוגגים', 'יום שישי, 27.11');
  if (P.type !== 'mine') f += `<details class="pmsec pmstyle"><summary>🎨 סגנון ואורך</summary>
    <div class="seg pmscope">${[['short', 'קצרה'], ['normal', 'רגילה'], ['long', 'מפורטת']].map(([v, l]) => `<button class="${(P.len || 'normal') === v ? 'on' : ''}" data-pmlen="${v}">${l}</button>`).join('')}</div>
    <label class="field">פתיחה<select data-pmsel="opener"><option value="">לפי השעה</option>${OPENERS.map(x => `<option ${P.opener === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
    <label class="field">סיום<select data-pmsel="closer"><option value="">לפי היום והשעה</option>${CLOSERS.map(x => `<option ${P.closer === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
    <div class="fchips"><button class="fc ${P.noemoji ? 'on' : ''}" data-pmemoji="1">${P.noemoji ? '✓ ' : ''}בלי אימוג׳ים</button></div>
  </details>`;
  f += `<div class="fchips"><button class="fc ${P.sign ? 'on' : ''}" data-pmsign="1">${P.sign ? '✓ ' : ''}חתימה: ${esc(state.name || 'השם שלך')} 🌻</button></div>`;
  const quick = ['all', 'today', 'week'].includes(P.type);
  const optsHtml = quick ? `<details class="card pmopts pmfold" ${state.pmOptsOpen ? 'open' : ''}><summary>✎ התאמה – מה להכניס, סגנון ואורך</summary>${f}</details>` : `<div class="card pmopts">${f}</div>`;
  if (!quick) h += optsHtml;
  const txt = P.text != null ? P.text : pmText(w);
  h += `<div class="card pmprev">${cardHead('phone2', 'ההודעה', P.text != null ? '<button class="linkbtn" data-act="pmreset">לבנות מחדש</button>' : '')}
    <div class="wachat"><div class="wabub" id="pmBub">${waHtml(txt)}<span class="wat">${String(now().getHours()).padStart(2, '0')}:${String(now().getMinutes()).padStart(2, '0')} ✓✓</span></div></div>
    <details class="pmsec pmedit" ${P.text != null ? 'open' : ''}><summary>✎ עריכת הטקסט</summary><textarea id="pmText" rows="12" dir="rtl">${esc(txt)}</textarea>
    <p class="hint">*כוכביות* = מודגש · _קו תחתון_ = נטוי</p></details>
    ${pmAttachUI(w)}
    ${P.type === 'personal' && o.kid ? (() => { const k = state.kids.find(x => x.name === o.kid); return `<button class="cta wa" data-wakid="${esc(o.kid)}">${ic('phone2')} שליחה להורה של ${esc(o.kid)}${k && k.phone ? '' : ' (בלי טלפון – בוחרים בווטסאפ)'}</button>`; })() : `<button class="cta wa" data-act="pmwa">${ic('phone2')} ${P.file ? 'שליחה בווטסאפ עם הקובץ' : 'שליחה בווטסאפ'}</button>`}
    <div class="btnrow"><button class="cta soft" data-act="pmcopy">${ic('file')} העתקה</button><button class="cta soft" data-act="pmshare">${ic('upload')} שיתוף</button></div>
    <button class="linkbtn pmsave" data-act="pmsavetpl">⭐ שמירה כתבנית</button>
  </div>`;
  if (quick) h += optsHtml;
  const wk = state.pmlog.filter(x => Date.now() - x.at < 7 * 864e5);
  if (state.pmlog.length) h += `<div class="card">${cardHead('clock', 'נשלחו לאחרונה', wk.length ? `<span class="cnt">${wk.length} השבוע</span>` : '')}${state.pmlog.slice(0, 8).map(x => `<button class="pmhist" data-pmlog="${x.id}"><span class="tpill">${new Date(x.at).getDate()}.${new Date(x.at).getMonth() + 1}</span><span class="grow"><b>${esc((PM_TYPES.find(t => t[0] === x.type) || [0, 0, 'הודעה'])[2])}${x.to ? ' · ' + esc(x.to) : ''}</b><small>${esc(x.text.split('\n').find(l => l.trim() && !/^הורים יקרים|^היי|טובים/.test(l)) || x.text.split('\n')[0])}</small></span>${ic('chevL', 'chev')}</button>`).join('')}<p class="hint">לוחצים על הודעה כדי להשתמש בה שוב כבסיס</p></div>`;
  return h;
}
function pmRefresh() {
  const w = pickWeek(), t = $('#pmText'); if (!w || !t) return;
  const txt = state.pm.text != null ? state.pm.text : pmText(w);
  if (state.pm.text == null) t.value = txt;
  pmBubble(txt);
}
function pmBubble(txt) { const b = $('#pmBub'); if (b) b.innerHTML = waHtml(txt) + `<span class="wat">${b.querySelector('.wat') ? b.querySelector('.wat').textContent : ''}</span>`; }
// schedule changes the teacher made in the app
function logChange(w, day, title, from, to) {
  state.changes.unshift({ id: uid(), at: Date.now(), w: w.id, dow: day.dow, day: day.name, title, from, to });
  state.changes = state.changes.slice(0, 30);
}
const recentChanges = () => state.changes.filter(c => Date.now() - c.at < 14 * 864e5);
const labTxt = l => (l === 'בוקר' ? 'בבוקר' : `בשעה ${l}`);
function changeLine(c) {
  if (!c.from) return `ביום ${c.day}: נוסף שיעור – ${c.title} (${labTxt(c.to.label)}${c.to.start ? ', ' + c.to.start : ''})`;
  if (!c.to) return `ביום ${c.day}: השיעור ${c.title} (${labTxt(c.from.label)}) לא יתקיים`;
  return `ביום ${c.day}: ${c.title} עבר ${labTxt(c.from.label)} ${labTxt(c.to.label).replace(/^ב/, 'ל')}${c.to.start ? ` (${c.to.start})` : ''}`;
}
// attach a file (uploaded or a Drive print file) to the message
function pmAttachChoices(w) {
  const out = state.files.filter(f => !f.ref || f.ref.w === w.id).slice(-12).reverse().map(f => ({ key: 'u:' + f.id, name: f.name.replace(/\.[^.]+$/, '') }));
  for (const d of w.days) (w.prep[d.dow] || []).forEach(sc => sc.items.forEach(it => { if (it.url && driveId(it.url)) out.push({ key: 'd:' + it.url, name: it.text, it }); }));
  return out;
}
function pmAttachUI(w) {
  const ch = pmAttachChoices(w); if (!ch.length) return '';
  const P = state.pm;
  return `<label class="field pmattach">📎 לצרף קובץ להודעה<select data-pmsel="attach"><option value="">בלי קובץ</option>${ch.map(c => `<option value="${esc(c.key)}" ${P.attach === c.key ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>${P.attach && !P.file ? '<p class="hint">מכינה את הקובץ…</p>' : ''}`;
}
async function pmLoadAttach(w, key) {
  const P = state.pm; P.file = null;
  if (!key) return;
  if (key.startsWith('u:')) {
    const f = state.files.find(x => x.id === key.slice(2));
    const b = f && await getBlob(f.id).catch(() => null);
    if (b) P.file = new File([b], f.name, { type: f.type || b.type });
  } else {
    const url = key.slice(2), id = driveId(url);
    P.file = await printFile({ url, text: (pmAttachChoices(w).find(c => c.key === key) || {}).name || 'קובץ' }, id);
  }
  if (!P.file) toast('לא הצלחתי להכין את הקובץ 😕');
}
function pmLog(type, text, to) {
  state.pmlog.unshift({ id: uid(), at: Date.now(), type, text, to: to || '' });
  state.pmlog = state.pmlog.slice(0, 40); save();
  if (state.tab === 'msgs') setTimeout(rerender, 400);
}
function kidPhone(name) { const k = state.kids.find(x => x.name === name); return k && k.phone ? '972' + k.phone.replace(/^0/, '') : ''; }
// open WhatsApp itself (the wa.me web link stays stuck in a browser view inside the home-screen app);
// if WhatsApp did not open, fall back to the phone's share sheet, which lists WhatsApp too
function sendWhatsApp(text, phone, file) {
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    // with a file WhatsApp is reached through the share sheet; the text is copied too, in case it drops it
    navigator.share({ files: [file], text }).catch(() => {});
    return;
  }
  let left = false;
  const away = () => { if (document.hidden) left = true; };
  document.addEventListener('visibilitychange', away);
  location.href = 'whatsapp://send?' + (phone ? 'phone=' + phone + '&' : '') + 'text=' + encodeURIComponent(text);
  setTimeout(() => {
    document.removeEventListener('visibilitychange', away);
    if (left) return;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else window.open('https://wa.me/' + (phone || '') + '?text=' + encodeURIComponent(text), '_blank');
  }, 1600);
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset && el.dataset.pmopt && state.pm) { state.pm.opts[el.dataset.pmopt] = el.dataset.lines ? toLines(el.value) : el.value; state.pm.text = null; pmRefresh(); }
  if (el.dataset && el.dataset.score != null) { const g = state.grades.find(x => x.id === state.gOpen); if (g) { if (el.value === '') delete g.scores[el.dataset.score]; else g.scores[el.dataset.score] = +el.value; saveLocal(); clearTimeout(window._gs); window._gs = setTimeout(save, 800); } }
  if (el.dataset && el.dataset.noisesens != null) noise.sens = +el.value;
  if (el.id === 'bankq') { state.bankQ = el.value; const pos = el.selectionStart; rerender(); const n = $('#bankq'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
  if (el.id === 'pmText' && state.pm) { state.pm.text = el.value; pmBubble(el.value); }
});


// ================================================================ IN CLASS: class mode, projector, class management
function curLesson() {
  const w = realWeek(); const day = w && todayInWeek(w); if (!day) return null;
  const ph = phase(day);
  const p = ph.cur || ph.next; if (!p) return null;
  return { w, day, p, ph };
}
function classMode() {
  const c = curLesson();
  let el = $('#classmode'); if (!el) { el = document.createElement('div'); el.id = 'classmode'; document.body.appendChild(el); }
  const id = c ? `${c.day.dow}:${c.p.label}` : '';
  const secs = c ? c.p.sections.filter(s => s.text || s.label) : [];
  const si = c ? Math.min(Math.max(0, secs.length - 1), state.sec[id] ?? Math.floor((c.ph.pct || 0) * secs.length)) : 0;
  el.innerHTML = `<div class="cm-in">
    <div class="cm-top"><button class="ovx" data-act="cmclose" aria-label="יציאה">${ic('x')}</button><span class="cm-clock">${String(now().getHours()).padStart(2, '0')}:${String(now().getMinutes()).padStart(2, '0')}</span></div>
    ${c ? `<div class="cm-lesson" style="--c:${look(c.p).c}">
      ${pill(c.p)}
      <h1>${esc(c.p.title)}</h1>
      <p class="cm-time">${c.ph.kind === 'lesson' ? `נשארו <b>${c.ph.left}</b> דק׳ · עד ${esc(c.p.end)}` : `מתחיל ${inText(c.ph.inMin)} · ${esc(c.p.start)}`}</p>
      ${c.ph.kind === 'lesson' ? `<div class="bar big"><span style="--w:${Math.round(c.ph.pct * 100)}%"></span></div>` : ''}
      ${secs.length ? `<div class="cm-secs">${secs.map((s, i) => `<button class="${i === si ? 'on' : ''}" data-cmsec="${esc(id)}|${i}">${esc(s.label || 'שלב ' + (i + 1))}</button>`).join('')}</div>
      <div class="cm-panel">${esc(secs[si].text)}</div>` : ''}
      ${c.p.materials.length ? `<p class="cm-need">${ic('check')} ${c.p.materials.map(m => esc(m.text)).join(' · ')}</p>` : ''}
    </div>` : `<div class="cm-lesson"><h1>אין שיעור עכשיו</h1><p class="cm-time">מצב בכיתה פועל בזמן יום הלימודים</p></div>`}
    <div class="cm-tools">
      <button data-act="timer">${ic('timer')}<span>טיימר</span></button>
      <button data-act="picker">${ic('dice')}<span>מי עונה?</span></button>
      ${c ? `<button data-cnote="${esc(id)}" data-tag="note">${ic('pencil')}<span>פתק ליומן</span></button>` : ''}
      <button data-act="projtext">${ic('screen')}<span>הקרנה</span></button>
      <button data-go2="class">${ic('medal')}<span>ניקוד</span></button>
    </div>
  </div>`;
  el.classList.add('show'); document.body.classList.add('incm');
  if (!wantAwake) { wantAwake = true; wakeOn(); }
  clearTimeout(classMode.t); classMode.t = setTimeout(() => { if ($('#classmode.show')) classMode(); }, 30000);
}
function closeClassMode() { const el = $('#classmode'); if (el) el.classList.remove('show'); document.body.classList.remove('incm'); clearTimeout(classMode.t); }

// projector: huge, simple, dark – for the classroom screen
function projector(kind, data) {
  let el = $('#proj'); if (!el) { el = document.createElement('div'); el.id = 'proj'; document.body.appendChild(el); }
  let body = '';
  if (kind === 'text') body = `<div class="pj-text" contenteditable="true" spellcheck="false">${esc(data || state.projText || 'המשימה עכשיו:')}</div><p class="pj-hint">אפשר לכתוב ישר על המסך</p>`;
  if (kind === 'dict') body = `<ol class="pj-list">${(data || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>`;
  if (kind === 'groups') body = `<div class="pj-groups">${(data || []).map((g, i) => `<div><b>קבוצה ${i + 1}</b>${g.map(n => `<span>${esc(n)}</span>`).join('')}</div>`).join('')}</div>`;
  if (kind === 'points') body = `<div class="pj-points">${state.points.map(t => `<div><b>${esc(t.name)}</b><span>${t.pts}</span></div>`).join('')}</div>`;
  if (kind === 'timer') body = `<div class="pj-timer" id="pjTimer">${fmtT(T.running ? Math.max(0, Math.round((T.endAt - Date.now()) / 1000)) : T.left || T.total)}</div>`;
  el.innerHTML = `<button class="pj-x" data-act="projclose" aria-label="סגירה">${ic('x')}</button>${body}
    <div class="pj-bar">${[['text', 'טקסט'], ['timer', 'טיימר'], ['groups', 'קבוצות'], ['points', 'ניקוד'], ['dict', 'הכתבה']].map(([k, l]) => `<button class="${k === kind ? 'on' : ''}" data-projmode="${k}">${l}</button>`).join('')}</div>`;
  el.dataset.kind = kind; el.classList.add('show');
  try { (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); } catch { /* iPhone: stays as a full-page overlay */ }
  if (kind === 'timer') { clearInterval(projector.t); projector.t = setInterval(() => { const t = $('#pjTimer'); if (!t) return clearInterval(projector.t); t.textContent = fmtT(T.running ? Math.max(0, Math.round((T.endAt - Date.now()) / 1000)) : T.left); }, 500); }
}
const fmtT = s => `${Math.floor((s || 0) / 60)}:${String((s || 0) % 60).padStart(2, '0')}`;
function closeProjector() {
  const el = $('#proj'); if (!el) return;
  const t = el.querySelector('.pj-text'); if (t) state.projText = t.innerText;
  el.classList.remove('show'); clearInterval(projector.t);
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* fine */ }
}

// class management: team points, noise light, "מלך שיעור"
const noise = { on: false, ctx: null, raf: 0, level: 0, sens: 5 };
function viewClass() {
  let h = top('ניקוד ורמזור', 'ניקוד לקבוצות, רמזור רעש ומלך שיעור', 'star', { back: 'cls' });
  h += `<div class="card">${cardHead('medal', 'ניקוד לקבוצות', `<button class="linkbtn" data-act="projpoints">${ic('screen')} הקרנה</button>`)}
    ${state.points.length ? state.points.map((t, i) => `<div class="ptrow"><b class="grow">${esc(t.name)}</b><button class="iconbtn" data-pt="${i}|-1">−</button><span class="ptn">${t.pts}</span><button class="iconbtn plus" data-pt="${i}|1">+</button></div>`).join('') : '<p class="dim">אין עדיין קבוצות. מוסיפים קבוצה או שולחן:</p>'}
    <form class="addtodo" data-ptnew><input name="t" placeholder="${state.points.length ? 'עוד קבוצה' : 'שולחן 1 / הכחולים'}" autocomplete="off"><button aria-label="הוספה">${ic('plus')}</button></form>
    ${state.points.length ? `<div class="btnrow"><button class="cta soft" data-act="ptzero">איפוס הנקודות</button><button class="cta soft" data-act="ptclear">מחיקת הקבוצות</button></div>` : ''}
  </div>`;
  h += `<div class="card noise">${cardHead('sparkle', 'רמזור רעש')}
    <div class="nl ${noise.on ? 'live' : ''}" id="noiseLight"><i class="r"></i><i class="y"></i><i class="g"></i></div>
    <label class="field">רגישות<input type="range" min="1" max="10" value="${noise.sens}" data-noisesens></label>
    <button class="cta ${noise.on ? 'soft' : ''}" data-act="noise">${noise.on ? 'עצירה' : 'הפעלה'}</button>
    <p class="hint">משתמש במיקרופון רק כדי למדוד עוצמה – שום דבר לא מוקלט או נשמר.</p>
  </div>`;
  const wk = weekKey();
  const kings = Object.entries(state.kings || {}).map(([n, v]) => [n, v[wk] || 0, Object.values(v).reduce((a, b) => a + b, 0)]);
  h += `<div class="card">${cardHead('star', 'מלך שיעור 👑', `<span class="cnt">השבוע</span>`)}
    ${state.kids.length ? `<div class="fchips wrap">${state.kids.map(k => { const r = kings.find(x => x[0] === k.name); return `<button class="fc ${r && r[1] ? 'on' : ''}" data-king="${esc(k.name)}">${esc(k.name)}${r && r[1] ? ` 👑${r[1] > 1 ? r[1] : ''}` : ''}</button>`; }).join('')}</div><p class="hint">לחיצה = עוד כתר השבוע · לחיצה ארוכה = ביטול כתר</p>${state._lastKing ? `<button class="linkbtn" data-unking="${esc(state._lastKing)}">↩︎ ביטול הכתר האחרון (${esc(state._lastKing)})</button>` : ''}` : '<p class="hint">צריך רשימת ילדים (עוד ← הכיתה שלי).</p>'}
  </div>`;
  return h;
}
function weekKey() { const t = now(); const s = addDays(new Date(t.getFullYear(), t.getMonth(), t.getDate()), -t.getDay()); return isoDay(s); }
async function noiseToggle() {
  if (noise.on) { noise.on = false; cancelAnimationFrame(noise.raf); try { noise.stream.getTracks().forEach(t => t.stop()); noise.ctx.close(); } catch { /* fine */ } rerender(); return; }
  try {
    noise.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    noise.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const an = noise.ctx.createAnalyser(); an.fftSize = 512;
    noise.ctx.createMediaStreamSource(noise.stream).connect(an);
    const buf = new Uint8Array(an.fftSize); noise.on = true; rerender();
    const tick = () => {
      if (!noise.on) return;
      an.getByteTimeDomainData(buf);
      let sum = 0; for (const v of buf) sum += (v - 128) * (v - 128);
      const rms = Math.sqrt(sum / buf.length) * noise.sens / 5;
      const el = $('#noiseLight'); if (el) el.dataset.l = rms > 22 ? 'r' : rms > 10 ? 'y' : 'g';
      noise.raf = requestAnimationFrame(tick);
    };
    tick();
  } catch { toast('צריך לאשר גישה למיקרופון 🎤'); }
}

// ================================================================ STUDENTS: kid card, grades, attention
const kidNotes = n => state.cnotes.filter(x => (x.kids || []).includes(n));
const kidMsgs = n => state.pmlog.filter(x => x.to === n);
const kidGrades = n => state.grades.filter(g => g.scores[n] != null).map(g => ({ g, v: +g.scores[n] }));
const pct = (v, max) => Math.round(v / (max || 100) * 100);
function lastTouch(n) {
  const ts = [...kidNotes(n).map(x => +new Date(x.at)), ...kidMsgs(n).map(x => x.at)];
  return ts.length ? Math.max(...ts) : 0;
}
function quietKids(days = 7) { return state.kids.filter(k => Date.now() - lastTouch(k.name) > days * 864e5); }
function kidSheet(name) {
  const k = state.kids.find(x => x.name === name) || { name };
  const ns = kidNotes(name).slice().reverse(), ms = kidMsgs(name), gs = kidGrades(name);
  const avg = gs.length ? Math.round(gs.reduce((a, x) => a + pct(x.v, x.g.max), 0) / gs.length) : null;
  const lt = lastTouch(name);
  openOverlay(`<div class="ov sheet kidsheet">
    <button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('user')}<h2>${esc(name)}</h2></div>
    <div class="kstats">
      <div><b>${k.bd || '—'}</b><small>יום הולדת</small></div>
      <div><b>${avg != null ? avg + '%' : '—'}</b><small>ממוצע</small></div>
      <div><b>${lt ? Math.floor((Date.now() - lt) / 864e5) : '—'}</b><small>ימים מאז שנרשם משהו</small></div>
    </div>
    <div class="btnrow"><button class="cta" data-kidmsg="${esc(name)}">${ic('phone2')} הודעה להורה</button><button class="cta soft" data-kidnote="${esc(name)}">${ic('pencil')} פתק</button></div>
    ${k.phone ? `<p class="hint">📞 <bdi dir="ltr">${esc(k.phone)}</bdi></p>` : '<p class="hint">אין טלפון של הורה – מוסיפים ב"הכיתה שלי"</p>'}
    ${gs.length ? `<h4>ציונים</h4>${gs.slice().reverse().map(({ g, v }) => `<div class="row"><span class="tpill">${esc(g.kind)}</span><span class="grow">${esc(g.title)}</span><b class="${pct(v, g.max) < 60 ? 'low' : ''}">${v}${g.max && g.max !== 100 ? '/' + g.max : ''}</b></div>`).join('')}` : ''}
    <h4>מהיומן</h4>${ns.length ? ns.slice(0, 12).map(n => `<div class="row"><span>${(TAGS[n.tag] || TAGS.note)[0]}</span><span class="grow">${esc(n.text || TAGS[n.tag][1])}</span><small class="dim">${new Date(n.at).getDate()}.${new Date(n.at).getMonth() + 1}</small></div>`).join('') : '<p class="dim">עוד לא נרשם כלום</p>'}
    ${ms.length ? `<h4>הודעות להורים</h4>${ms.slice(0, 6).map(m => `<div class="row"><span class="tpill">${new Date(m.at).getDate()}.${new Date(m.at).getMonth() + 1}</span><span class="grow">${esc(m.text.split('\n').find(l => l.trim() && !/^היי|טובים/.test(l)) || '')}</span></div>`).join('')}` : ''}
  </div>`);
}
function viewGrades() {
  let h = top('ציונים', 'הכתבות ומבדקים – מזינים מהר, רואים מי צריך עזרה', 'star', { back: 'cls' });
  const open = state.grades.find(g => g.id === state.gOpen);
  if (open) {
    const vals = state.kids.map(k => open.scores[k.name]).filter(v => v !== '' && v != null).map(Number);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    const low = state.kids.filter(k => open.scores[k.name] != null && open.scores[k.name] !== '' && pct(+open.scores[k.name], open.max) < 60);
    h += `<div class="card">${cardHead('target', esc(open.title), `<button class="linkbtn" data-gopen="">כל המבדקים</button>`)}
      <p class="dim">${esc(open.kind)}${open.date ? ' · ' + esc(open.date.split('-').reverse().slice(0, 2).join('.')) : ''} · מתוך ${open.max || 100}${avg != null ? ` · ממוצע <b>${avg}</b>` : ''} · הוזנו ${vals.length}/${state.kids.length}</p>
      ${state.kids.length ? state.kids.map(k => `<label class="grow-row"><span class="grow">${esc(k.name)}</span><input type="number" inputmode="numeric" min="0" max="${open.max || 100}" data-score="${esc(k.name)}" value="${esc(open.scores[k.name] ?? '')}"></label>`).join('') : '<p class="hint">צריך רשימת ילדים (עוד ← הכיתה שלי).</p>'}
      ${low.length ? `<div class="lowbox"><b>צריכים חיזוק (מתחת ל־60%):</b> ${low.map(k => `<button class="linkbtn" data-kid="${esc(k.name)}">${esc(k.name)}</button>`).join(', ')}</div>` : ''}
      <button class="linkbtn danger-l" data-gdel="${open.id}">מחיקת המבדק</button>
    </div>`;
    return h;
  }
  h += `<div class="card">${cardHead('plus', 'מבדק / הכתבה חדשה')}
    <form data-gnew class="gnew"><input name="title" placeholder="למשל: הכתבה ח.ב.ר" required><div class="an-grid"><label class="field">סוג<select name="kind"><option>הכתבה</option><option>מבדק</option><option>משימה</option></select></label><label class="field">ציון מקסימלי<input name="max" type="number" value="100"></label></div><button class="cta">${ic('plus')} יצירה והזנת ציונים</button></form></div>`;
  if (state.grades.length) h += `<div class="card">${cardHead('chart', 'כל המבדקים', `<span class="cnt">${state.grades.length}</span>`)}${state.grades.slice().reverse().map(g => { const v = Object.values(g.scores).filter(x => x !== '' && x != null).map(Number); return `<button class="pmhist" data-gopen="${g.id}"><span class="tpill">${esc(g.kind)}</span><span class="grow"><b>${esc(g.title)}</b><small>${v.length ? `ממוצע ${Math.round(v.reduce((a, b) => a + b, 0) / v.length)} · ${v.length} ציונים` : 'עוד לא הוזנו ציונים'}</small></span>${ic('chevL', 'chev')}</button>`; }).join('')}</div>`;
  const strug = state.kids.map(k => ({ k, gs: kidGrades(k.name) })).filter(x => x.gs.length).map(x => ({ ...x, a: Math.round(x.gs.reduce((s, y) => s + pct(y.v, y.g.max), 0) / x.gs.length) })).filter(x => x.a < 70).sort((a, b) => a.a - b.a);
  if (strug.length) h += `<div class="card">${cardHead('users', 'כדאי לחזק', `<span class="cnt">${strug.length}</span>`)}<p class="dim">ממוצע מתחת ל־70% – מתאים לקבוצת פרטני</p>${strug.map(x => `<button class="pmhist" data-kid="${esc(x.k.name)}"><span class="grow"><b>${esc(x.k.name)}</b></span><b class="low">${x.a}%</b></button>`).join('')}</div>`;
  return h;
}

// ================================================================ PLANNING: next week from this one, lesson bank, events calendar
function nextWeekFrom(w) {
  const logs = state.logs[w.id] || {};
  const d0 = w.days.find(x => x.date); const [dd0, mm0] = d0.date.split('.').map(Number);
  const start = addDays(new Date(w.year, mm0 - 1, dd0), 7 - d0.dow);
  const carried = [];
  const days = w.days.map(d => ({ dow: d.dow, periods: d.periods.map(p => {
    const l = logs[`${d.dow}:${p.label}`];
    const keep = l && (l.s === 'skip' || l.s === 'part');
    if (keep) carried.push(`יום ${d.name}: ${p.title}${l.s === 'part' ? ' (חלקית)' : ''}`);
    const c = JSON.parse(JSON.stringify(p));
    return keep ? { ...c, homework: [], badges: [l.s === 'part' ? 'המשך מהשבוע הקודם' : 'עבר מהשבוע הקודם'] }
      : { ...c, title: look(p).n === 'שיעור' ? p.title : (/מפגש בוקר|צוות|פרטני/.test(p.title) ? p.title : look(p).n), sections: [], materials: [], homework: [], links: [], badges: [] };
  }) }));
  const wk = buildWeek(days, isoDay(start), { title: w.number ? `שבוע ${w.number + 1}` : '', number: w.number ? w.number + 1 : null });
  const dict = (w.notes || []).find(n => /הכתבה/.test(n.label));
  wk.notes = [...(carried.length ? [{ label: 'עבר מהשבוע הקודם', text: carried.join(' · ') }] : []), ...(dict ? [{ label: 'מילים להכתבה (מהשבוע הקודם)', text: dict.text }] : [])];
  return { wk, carried };
}
function viewBank() {
  let h = top('מאגר שיעורים', 'שיעורים ששמרת – לשימוש חוזר בכל שבוע ובכל שנה', 'star', { back: 'more' });
  const q = (state.bankQ || '').trim();
  h += `<label class="search">${ic('search')}<input id="bankq" type="search" placeholder="חיפוש שיעור" value="${esc(q)}"></label>`;
  const list = state.bank.filter(b => !q || (b.p.title + ' ' + look(b.p).n + ' ' + b.p.sections.map(s => s.text).join(' ')).includes(q));
  if (!state.bank.length) return h + `<p class="hint">שומרים שיעור בלחיצה על "⭐ שמירה במאגר" בתוך כל שיעור במסך השבוע.</p>`;
  const by = new Map(); for (const b of list) { const n = look(b.p).n; by.set(n, [...(by.get(n) || []), b]); }
  for (const [n, bs] of by) h += `<div class="card">${cardHead('book', esc(n), `<span class="cnt">${bs.length}</span>`)}${bs.map(b => `<button class="pmhist" data-bank="${b.id}"><span class="grow"><b>${esc(b.p.title)}</b><small>${esc(b.p.sections.map(s => s.label).filter(Boolean).join(' · ') || b.p.subtitle || '')}</small></span>${ic('chevL', 'chev')}</button>`).join('')}</div>`;
  return h;
}
function bankSheet(id) {
  const b = state.bank.find(x => x.id === id); if (!b) return;
  const w = pickWeek();
  openOverlay(`<div class="ov sheet">
    <button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('star')}<h2>${esc(b.p.title)}</h2></div>
    ${b.p.sections.filter(s => s.text).map(s => `<p class="sec"><b>${esc(s.label)}</b> – ${esc(s.text)}</p>`).join('')}
    ${b.p.materials.length ? `<p class="dim">☐ ${b.p.materials.map(m => esc(m.text)).join(' · ')}</p>` : ''}
    ${w ? `<p class="pmlbl">להוסיף לשבוע ${esc(w.number || '')} ביום:</p><div class="fchips">${w.days.map(d => `<button class="fc" data-bankto="${id}|${d.dow}">יום ${esc(d.name)}</button>`).join('')}</div>` : ''}
    <button class="linkbtn danger-l" data-bankdel="${id}">מחיקה מהמאגר</button>
  </div>`);
}
function addFromBank(id, dow) {
  const b = state.bank.find(x => x.id === id), w = pickWeek(), d = w.days.find(x => x.dow === +dow);
  const free = LABELS.find(l => !d.periods.some(p => p.label === l)) || '9';
  const [s, e] = bellFor(free);
  const p = { ...JSON.parse(JSON.stringify(b.p)), label: free, start: s || b.p.start, end: e || b.p.end, homework: [], edited: true };
  d.periods.push(p); d.periods.sort((a, c) => mins(a.start) - mins(c.start));
  logChange(w, d, p.title, null, { label: p.label, start: p.start });
  save(); closeOverlay(); state.dayDow = d.dow; go('day'); toast(`נוסף ליום ${d.name} (${free === 'בוקר' ? 'בוקר' : 'שעה ' + free}) – אפשר לערוך`);
}
function allEvents(daysAhead = 60) {
  const t0 = new Date(now().toDateString()), end = addDays(t0, daysAhead), out = [];
  const push = (d, icon, text, kind) => { if (d >= t0 && d <= end) out.push({ d, icon, text, kind }); };
  for (const w of sortedWeeks()) for (const d of w.days) {
    const dd = dayDate(w, d); if (!dd) continue;
    for (const p of d.periods) {
      const tx = `${p.title} ${p.subtitle}`;
      if (/מבדק|משימת הערכה|מבחן/.test(tx)) push(dd, '📝', p.title, 'test');
      else if (/הכתבה/.test(tx)) push(dd, '✍️', 'הכתבה', 'dict');
      else if (/מסיב|טיול|יום הליכה|טקס(?!ט)|שובר שגרה|חגיג/.test(tx)) push(dd, '🎉', p.title, 'event');
    }
  }
  for (const k of state.kids) if (k.bd) { const [dd, mm] = k.bd.split('.').map(Number); for (const y of [t0.getFullYear(), t0.getFullYear() + 1]) push(new Date(y, mm - 1, dd), '🎂', `יום הולדת ל${k.name}`, 'bday'); }
  for (const x of state.todos) if (!x.done && x.date) push(new Date(x.date + 'T00:00'), '📌', x.text, 'todo');
  for (const e of state.events) push(new Date(e.date + 'T00:00'), e.icon || '⭐', e.text, 'mine');
  let from = t0; for (let i = 0; i < 6; i++) { const h = nextHoliday(from, daysAhead); if (!h || h.date > end) break; push(h.date, '🕎', h.name, 'holiday'); from = addDays(h.date, 1); }
  return out.sort((a, b) => a.d - b.d);
}
function viewCalendar() {
  let h = top('לוח אירועים', 'מבדקים, הכתבות, חגים, ימי הולדת ותזכורות – הכל על ציר אחד', 'calendar', { back: 'cls' });
  h += `<div class="card">${cardHead('plus', 'אירוע חדש')}<form data-evnew class="an-grid evnew"><input name="text" placeholder="טיול שנתי" required><input name="date" type="date" value="${isoDay(now())}" required><button class="cta" style="grid-column:1/-1">${ic('plus')} הוספה</button></form></div>`;
  const ev = allEvents(60); let last = '';
  if (!ev.length) return h + '<p class="hint">אין אירועים בחודשיים הקרובים.</p>';
  h += '<div class="card evlist">';
  for (const e of ev) {
    const key = e.d.toDateString();
    if (key !== last) { const diff = Math.round((e.d - new Date(now().toDateString())) / 864e5); h += `<h4 class="evday">${diff === 0 ? 'היום' : diff === 1 ? 'מחר' : `יום ${DAY_FULL[e.d.getDay()]}`} · ${e.d.getDate()}.${e.d.getMonth() + 1}</h4>`; last = key; }
    h += `<div class="row"><span>${e.icon}</span><span class="grow">${esc(e.text)}</span>${e.kind === 'mine' ? `<button class="iconbtn" data-evdel="${esc(e.text)}|${isoDay(e.d)}" aria-label="מחיקה">${ic('trash')}</button>` : ''}</div>`;
  }
  return h + '</div><p class="hint">האירועים נאספים לבד מהתכנון, מימי ההולדת, מהתזכורות ומלוח השנה העברי. ערב לפני כל אירוע תגיע התראה.</p>';
}

// ================================================================ SHARING a week with another teacher (file, no server)
async function shareWeek(w) {
  const data = JSON.stringify({ app: 'hakita-week', v: 1, from: state.name, week: { ...w, importedAt: new Date().toISOString() } });
  const file = new File([data], `תכנון ${w.number ? 'שבוע ' + w.number : w.title || 'שבועי'}.kita.json`, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], text: `תכנון ${w.number ? 'שבוע ' + w.number : 'שבועי'} מ${state.name || 'הכיתה שלי'} – פותחים באפליקציה "הכיתה שלי" ← עוד ← להעלות תכנון` }).catch(() => {}); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
}
async function tryImportWeek(file) {
  if (!/\.json$/i.test(file.name) && file.type !== 'application/json') return false;
  try {
    const j = JSON.parse(await file.text());
    if (j.app !== 'hakita-week' || !j.week) return false;
    const wk = j.week;
    if (state.weeks[wk.id] && !await ask('כבר יש שבוע עם אותם תאריכים. להחליף אותו?')) return true;
    state.logs[wk.id] = {}; saveGenericWeek(wk); toast(`התכנון${j.from ? ' של ' + j.from : ''} נוסף ✨`); return true;
  } catch { return false; }
}

// ================================================================ HELP: report a problem, short guide, local backups
function reportSheet() {
  openOverlay(`<form class="ov sheet" data-report>
    <button type="button" class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('warn')}<h2>משהו לא עובד?</h2></div>
    <label class="field">מה קרה?<textarea name="what" rows="4" placeholder="לחצתי על… ואז…" required></textarea></label>
    <label class="filepick">${ic('upload')} <span id="shotName">צירוף צילום מסך (לא חובה)</span><input type="file" name="shot" accept="image/*" hidden></label>
    <p class="hint">יחד עם התיאור נשלחים גרסה ${APP_V}, סוג המכשיר והמסך שהיית בו – בלי שום מידע על התלמידים.</p>
    <button class="cta">${ic('upload')} שליחה</button>
  </form>`);
}
const GUIDE = [
  ['home', 'עכשיו', 'מה מתנהל ברגע זה: השיעור, השלבים, מה צריך והקבצים. "מצב בכיתה" פותח הכל בגדול עם טיימר ו"מי עונה?".', 0],
  ['calendar', 'השבוע', 'כל השבוע, יום אחרי יום. לוחצים על שיעור כדי לפתוח, לערוך, לשמור במאגר או לשתף עם חברה.', 1],
  ['check', 'להכין', 'מה להדפיס, לשכפל ולהביא לכל יום – עם כמויות לפי מספר התלמידים. מסמנים וי, והיום מוכן.', 2],
  ['users', 'הכיתה', 'הילדים, כרטיס לכל ילד, ציונים, יומן, ימי הולדת והודעות להורים. מורה עם כמה כיתות עוברת ביניהן כאן.', 3],
  ['dots', 'עוד', 'תכנון שבוע חדש, מאגר שיעורים, כלים לשיעור, קבצים, מורות חברות והגדרות.', 4],
];
function guideSheet(i = 0) {
  const [icn, t, d] = GUIDE[i];
  openOverlay(`<div class="ov sheet guide">
    <button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="gd-tabs">${['home', 'calendar', 'check', 'users', 'dots'].map((x, j) => `<span class="${GUIDE[i][3] === j ? 'on' : ''}">${ic(x)}</span>`).join('')}</div>
    <div class="gd-ic">${ic(icn)}</div><h2>${t}</h2><p>${d}</p>
    <div class="gd-dots">${GUIDE.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
    <button class="cta" data-guide="${i + 1 < GUIDE.length ? i + 1 : 'end'}">${i + 1 < GUIDE.length ? 'הבא' : 'מתחילים ✨'}</button>
  </div>`);
}
// a daily snapshot kept on the phone (last 10), in addition to the account sync
async function dailySnap() {
  try {
    const list = (await getBlob('snaps').catch(() => null)) || [];
    const today = isoDay(new Date());
    if (list[0] && list[0].day === today) list.shift();
    const o = {}; for (const k of SAVED) o[k] = state[k];
    list.unshift({ day: today, at: Date.now(), data: JSON.stringify(o) });
    await putBlob('snaps', list.slice(0, 10));
    localStorage.setItem('hk-snap', String(Date.now()));
  } catch { /* storage full or private mode */ }
}
async function snapsSheet() {
  const list = (await getBlob('snaps').catch(() => null)) || [];
  openOverlay(`<div class="ov sheet">
    <button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('clock')}<h2>שחזור לגרסה קודמת</h2></div>
    <p class="dim">כל יום נשמר לבד עותק של כל המידע בטלפון (10 הימים האחרונים).</p>
    ${list.length ? list.map((s, i) => `<button class="pmhist" data-snap="${i}"><span class="tpill">${s.day.split('-').reverse().slice(0, 2).join('.')}</span><span class="grow"><b>${new Date(s.at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</b></span>${ic('chevL', 'chev')}</button>`).join('') : '<p class="hint">עוד אין עותקים – הראשון יישמר היום.</p>'}
  </div>`);
}


// ================================================================ ROLES & CLASSES
// role: 'home' = homeroom teacher, 'both' = homeroom + subject teacher, 'subject' = subject teacher only.
// Each class keeps its own children; state.kids always holds the children of the class in view.
const ROLES = {
  home: ['מחנכת', 'כיתה אחת שלי – ילדים, הורים, ימי הולדת'],
  both: ['מחנכת וגם מורה מקצועית', 'הכיתה שלי + כיתות נוספות שאני מלמדת בהן מקצוע'],
  subject: ['מורה מקצועית', 'מלמדת מקצוע בכמה כיתות'],
};
// two checkboxes – homeroom and/or subject teacher – stored as one role
const roleSet = r => new Set(r === 'both' ? ['home', 'subject'] : r ? [r] : []);
const roleOf = set => set.has('home') && set.has('subject') ? 'both' : set.has('subject') ? 'subject' : set.has('home') ? 'home' : '';
const ROLE_BOX = { get home() { return [g('מחנכת', 'מחנך'), g('יש לי כיתה שאני מחנכת – ילדים, הורים, ימי הולדת', 'יש לי כיתה שאני מחנך – ילדים, הורים, ימי הולדת')]; }, get subject() { return [g('מורה מקצועית', 'מורה מקצועי'), g('אני מלמדת מקצוע, בכיתה אחת או בכמה כיתות', 'אני מלמד מקצוע, בכיתה אחת או בכמה כיתות')]; } };
const rolePick = (role, attr) => { const st = roleSet(role); return `<div class="rolepick">${Object.entries(ROLE_BOX).map(([k, [t, d]]) => `<button class="${st.has(k) ? 'on' : ''}" ${attr}="${k}" role="checkbox" aria-checked="${st.has(k)}"><span class="rbox">${st.has(k) ? '✓' : ''}</span><span class="rtx"><b>${t}</b><small>${d}</small></span></button>`).join('')}</div><p class="hint">אפשר לסמן אחת מהן או את שתיהן</p>`; };
const curCls = () => state.classes.find(c => c.id === state.curClass) || state.classes[0] || null;
function ensureClasses() {
  if (!state.classes.length) {
    const id = 'c' + uid();
    state.classes.push({ id, name: state.prefs.cls || 'הכיתה שלי', size: +state.prefs.classSize || state.kids.length || 0, kids: state.kids, home: true, subject: '' });
    state.curClass = id;
  }
  if (!state.prefs.role) state.prefs.role = 'home';
  if (!curCls()) state.curClass = state.classes[0].id;
}
function syncCls() { const c = curCls(); if (c) { c.kids = state.kids; if (+state.prefs.classSize) c.size = +state.prefs.classSize; } }
function switchClass(id) {
  syncCls();
  const c = state.classes.find(x => x.id === id); if (!c) return;
  state.curClass = id; state.kids = c.kids || (c.kids = []); state.prefs.classSize = c.size || ''; state.prefs.cls = c.name;
  save(); rerender(); toast(`עברת ל${c.name}`);
}
const multiCls = () => state.classes.length > 1;
const clsSizeFor = name => { const c = state.classes.find(x => x.name === name); return c && +c.size ? +c.size : 0; };
// find a class name written inside an imported lesson ("ג׳2 – חשבון")
function tagClasses(wk) {
  if (!multiCls()) return;
  const norm = s => String(s || '').replace(/["'״׳`]/g, '').replace(/\s/g, '');
  for (const d of wk.days) for (const p of d.periods) {
    if (p.cls) continue;
    const hay = norm(p.title + ' ' + p.subtitle);
    const c = state.classes.find(x => norm(x.name) && hay.includes(norm(x.name)));
    if (c) p.cls = c.name;
  }
}
const clsChips = (sel, attr = 'data-cls') => `<div class="fchips clschips">${state.classes.map(c => `<button class="fc ${c.id === sel ? 'on' : ''}" ${attr}="${c.id}">${c.home ? '🏠 ' : ''}${esc(c.name)}</button>`).join('')}</div>`;
function classesSheet() {
  syncCls();
  openOverlay(`<div class="ov sheet">
    <button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('users')}<h2>הכיתות שלי</h2></div>
    <p class="pmlbl">התפקיד שלי</p>
    ${rolePick(state.prefs.role, 'data-role')}
    <p class="pmlbl">כיתות</p>
    ${state.classes.map(c => `<div class="clsrow"><span class="grow"><b>${c.home ? '🏠 ' : ''}${esc(c.name)}</b><small>${c.subject ? esc(c.subject) + ' · ' : ''}${(c.kids || []).length} ילדים${c.size ? ` · ${c.size} תלמידים` : ''}</small></span>
      <button class="iconbtn" data-clsedit="${c.id}" aria-label="עריכה">${ic('pencil')}</button>${state.classes.length > 1 ? `<button class="iconbtn" data-clsdel="${c.id}" aria-label="מחיקה">${ic('trash')}</button>` : ''}</div>`).join('')}
    <form class="clsnew" data-clsnew>
      <div class="an-grid"><input name="name" placeholder="שם הכיתה, למשל ג׳1" required><input name="size" type="number" inputmode="numeric" placeholder="מס׳ תלמידים"></div>
      <input name="subject" placeholder="${g('מה אני מלמדת שם?', 'מה אני מלמד שם?')} (למשל אנגלית)">
      <button class="cta soft">${ic('plus')} הוספת כיתה</button>
    </form>
  </div>`);
}

// ================================================================ "הכיתה" – everything about the children in one place
function viewHub() {
  ensureClasses();
  const c = curCls();
  let h = top(c ? esc(c.name) : 'הכיתה', multiCls() ? 'בוחרים כיתה – והכל מתעדכן לפיה' : 'הילדים, ההורים והמעקב – במקום אחד', 'users');
  h += `<div class="hubcls">${multiCls() ? clsChips(state.curClass) : ''}<button class="linkbtn" data-act="classes">${ic('settings')} ${multiCls() ? 'ניהול כיתות' : 'יש לי עוד כיתות'}</button></div>`;
  const tiles = [['phone2', 'הודעה להורים', 'data-go="msgs"', ''], ['star', 'ציונים', 'data-go="grades"', state.grades.filter(g => !g.cls || g.cls === state.curClass).length || ''],
    ['pencil', 'יומן כיתה', 'data-go="journal"', openActions().length || ''], ['medal', 'ניקוד ורמזור', 'data-go="class"', ''], ['users', 'עריכת הרשימה', 'data-go="kids"', state.kids.length || ''], ['calendar', 'לוח אירועים', 'data-go="calendar"', '']];
  h += `<div class="hubgrid">${tiles.map(([i, l, a, n]) => `<button ${a}><span class="ti">${ic(i)}</span><b>${l}</b>${n ? `<em>${n}</em>` : ''}</button>`).join('')}</div>`;
  if (!state.kids.length) h += `<div class="card">${cardHead('users', 'עוד אין ילדים בכיתה')}<p class="dim">מדביקים רשימת שמות (ואם רוצים גם יום הולדת וטלפון של הורה) – ואז יש כרטיס לכל ילד, "מי עונה?", ימי הולדת והודעות אישיות.</p><button class="cta" data-go="kids">${ic('plus')} הוספת הילדים</button></div>`;
  else {
    const q = quietKids(7);
    if (q.length && state.kids.length - q.length >= state.kids.length / 3) h += `<div class="card quiet">${cardHead('heart', 'השבוע עוד לא נרשם כלום על', `<span class="cnt">${q.length}</span>`)}<div class="fchips wrap">${q.slice(0, 6).map(k => `<button class="fc" data-kid="${esc(k.name)}">${esc(k.name)}</button>`).join('')}${q.length > 6 ? `<span class="dim">ועוד ${q.length - 6}</span>` : ''}</div></div>`;
    h += `<div class="card">${cardHead('user', 'הילדים', `<span class="cnt">${state.kids.length}</span>`)}<div class="kidgrid">${state.kids.map(k => { const n = kidNotes(k.name).length; return `<button data-kid="${esc(k.name)}"><span class="av">${esc(k.name[0] || '?')}</span><b>${esc(k.name.split(' ')[0])}</b>${n ? `<em>${n}</em>` : ''}</button>`; }).join('')}</div></div>`;
  }
  h += bdCard(14, 'ימי הולדת בשבועיים הקרובים');
  return h;
}

// ================================================================ ONBOARDING: a short setup, then a tour
function viewOnboard() {
  const st = state.onb || (state.onb = { step: 0, name: state.name || '', role: '', home: '', size: '', classes: [], subject: '' });
  const steps = 4, dots = `<div class="gd-dots">${Array.from({ length: steps }, (_, i) => `<i class="${i === st.step ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if (st.step === 0) body = `<div class="onb-logo">${logo('wlogo')}</div><h1>${g('ברוכה הבאה', 'ברוך הבא')} ל״הכיתה שלי״</h1>
    <p class="onb-sub">התכנון השבועי, הכיתה וההורים – מסודרים במקום אחד. ארבעה צעדים קצרים ומתחילים.</p>
    <form class="card onb-form" data-onbstep="0"><label class="field">איך קוראים לך?<input name="name" required value="${esc(st.name)}" placeholder="השם שלך" autocomplete="given-name"></label>
      <p class="pmlbl">איך לפנות אלייך?</p><div class="seg"><button type="button" class="${!state.prefs.male ? 'on' : ''}" data-addr="f">את</button><button type="button" class="${state.prefs.male ? 'on' : ''}" data-addr="m">אתה</button></div>
      <button class="cta">הבא</button></form>
    <p class="hint">יש לך כבר חשבון? <button class="linkbtn" data-act="onblogin">התחברות</button></p>`;
  if (st.step === 1) body = `<h1>${esc(st.name)}, מה התפקיד שלך?</h1><p class="onb-sub">אפשר לשנות בכל רגע (הכיתה ← ניהול כיתות)</p>
    <div class="big">${rolePick(st.role, 'data-onbrole')}</div>
    <button class="cta" data-onbnext="2" ${st.role ? '' : 'disabled'}>הבא</button>
    <button class="linkbtn" data-onbback="1">חזרה</button>`;
  if (st.step === 2) body = `<h1>הכיתות שלך</h1>
    <form class="card onb-form" data-onbstep="2">
      ${st.role !== 'subject' ? `<p class="pmlbl">🏠 הכיתה שאני מחנכת</p><div class="an-grid"><input name="home" value="${esc(st.home)}" placeholder="למשל ב׳2" ${st.role !== 'subject' ? 'required' : ''}><input name="size" type="number" inputmode="numeric" value="${esc(st.size)}" placeholder="מס׳ תלמידים"></div>` : ''}
      ${st.role !== 'home' ? `<p class="pmlbl">📚 ${st.role === 'both' ? 'כיתות נוספות שאני מלמדת' : 'הכיתות שאני מלמדת'}</p>
        <input name="more" value="${esc(st.classes.join(', '))}" placeholder="למשל ג׳1, ג׳2, ד׳3" ${st.role === 'subject' ? 'required' : ''}>
        <input name="subject" value="${esc(st.subject)}" placeholder="מה אני מלמדת? (למשל אנגלית)">` : ''}
      <button class="cta">הבא</button>
    </form><button class="linkbtn" data-onbback="1">חזרה</button>`;
  if (st.step === 3) body = `<h1>איך מתחילים?</h1><p class="onb-sub">התכנון השבועי הוא הלב של האפליקציה – ממנו נבנים "עכשיו", "להכין" וההודעות להורים.</p>
    <div class="onb-start">
      <button data-onbgo="upload">${ic('upload')}<b>יש לי תכנון</b><small>PDF, Word, Excel או טקסט – בכל מבנה</small></button>
      <button data-onbgo="manual">${ic('pencil')}<b>אבנה שבוע כאן</b><small>מוסיפים שיעורים יום אחרי יום</small></button>
      <button data-onbgo="later">${ic('sparkle')}<b>אחר כך</b><small>קודם להסתובב באפליקציה</small></button>
    </div><button class="linkbtn" data-onbback="2">חזרה</button>`;
  return `<section class="onb">${dots}${body}</section>`;
}
function finishOnboard(go2) {
  const st = state.onb;
  state.name = st.name; state.prefs.role = st.role || 'home';
  const mk = (name, extra) => ({ id: 'c' + uid(), name, size: 0, kids: [], home: false, subject: st.subject || '', ...extra });
  state.classes = [];
  if (st.role !== 'subject' && st.home) state.classes.push(mk(st.home, { home: true, size: +st.size || 0, kids: state.kids, subject: '' }));
  for (const n of st.classes) if (n && !state.classes.some(c => c.name === n)) state.classes.push(mk(n));
  if (!state.classes.length) state.classes.push(mk(st.home || 'הכיתה שלי', { home: st.role !== 'subject' }));
  const c0 = state.classes[0];
  state.curClass = c0.id; state.kids = c0.kids; state.prefs.cls = c0.name; state.prefs.classSize = c0.size || '';
  state.onboarded = true; state.onb = null; state.guided = true; save();
  go('now'); confetti();
  setTimeout(() => { if (go2 === 'upload') $('#file').click(); if (go2 === 'manual') manualSheet(); }, 500);
}
// first steps – shown on "עכשיו" until done or dismissed
function firstSteps() {
  if (state.prefs.stepsDone) return '';
  { const w0 = realWeek(), d0 = w0 && todayInWeek(w0), ph0 = d0 && phase(d0); if (ph0 && (ph0.kind === 'lesson' || ph0.kind === 'break')) return ''; }
  const items = [
    ['upload', 'להעלות או לבנות תכנון שבועי', !!Object.keys(state.weeks).length, 'data-act="upload"'],
    ['users', 'להוסיף את הילדים בכיתה', state.kids.length > 0, 'data-go="kids"'],
    ['clock', 'להגדיר את לוח הצלצולים של בית הספר', !!state.prefs.bell, 'data-go="bells"'],
    ['cloud', 'להתחבר לחשבון (שמירה בכל המכשירים)', !!sync.user, 'data-go="settings"'],
    ['phone2', 'לשלוח הודעה ראשונה להורים', state.pmlog.length > 0, 'data-go="msgs"'],
    ['heart', 'להוסיף מורה חברה', !!(soc.data && soc.data.friends.length), 'data-go="friends"'],
  ];
  const done = items.filter(x => x[2]).length;
  if (done === items.length) return '';
  if (!state._stepsOpen) { const nx = items.find(x => !x[2]); return `<div class="card steps fold"><button class="stepline" data-act="stepsopen"><span class="sc">${ic('flag')}</span><span class="grow"><b>צעדים ראשונים · ${done}/${items.length}</b><small>הבא: ${nx[1]}</small></span>${ic('chevD', 'chev')}</button><button class="iconbtn stepsx" data-act="stepsdone" aria-label="סגירת הצעדים הראשונים">${ic('x')}</button></div>`; }
  return `<div class="card steps">${cardHead('flag', 'צעדים ראשונים', `<span class="cnt">${done}/${items.length}</span><button class="iconbtn stepsx" data-act="stepsdone" aria-label="סגירת הצעדים הראשונים">${ic('x')}</button>`)}
    <div class="bar"><span style="--w:${done / items.length * 100}%"></span></div>
    ${items.map(([i, t, ok, a]) => `<button class="steprow ${ok ? 'done' : ''}" ${ok ? 'disabled' : a}><span class="sc">${ok ? '✓' : ic(i)}</span><span class="grow">${t}</span>${ok ? '' : ic('chevL', 'chev')}</button>`).join('')}
    </div>`;
}

// ================================================================ FRIEND TEACHERS (server: /api/social)
const soc = { data: null, busy: false, err: '' };
async function socApi(op, body, q = '') {
  try { await ID.refreshSession(); } catch { /* fine */ }
  const r = await fetch(`/api/social?op=${op}${q}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'http ' + r.status), { code: j.error, status: r.status });
  return j;
}
async function socLoad(force) {
  if (!sync.user || soc.busy || (soc.data && !force)) return;
  soc.busy = true;
  try { soc.data = await socApi('me'); soc.err = ''; if (!soc.data.me.name && state.name) socApi('profile', { name: state.name }).catch(() => {}); } catch (e) { soc.err = e.message; }
  soc.busy = false; if (['friends', 'now'].includes(state.tab)) rerender();
}
function viewFriends() {
  let h = top('מורות חברות', 'משתפות שיעורים ושבועות שלמים – ומקבלות שיעורים מחברות', 'heart', { back: 'more' });
  if (!sync.user) return h + `<div class="card">${cardHead('cloud', 'צריך חשבון')}<p class="dim">כדי לשתף שיעורים עם מורות אחרות, כל אחת צריכה להיות מחוברת לחשבון באפליקציה.</p><button class="cta" data-go="settings">${ic('user')} התחברות / יצירת חשבון</button></div>`;
  if (!soc.data) { socLoad(); return h + `<p class="hint">${soc.err ? 'לא הצלחתי להתחבר 😕 ' + esc(soc.err) : 'טוענת…'}</p>`; }
  const D2 = soc.data;
  h += `<div class="card mycode">${cardHead('user', 'הקוד שלי')}
    <div class="code">${esc(D2.me.code)}</div>
    <p class="dim">שולחים את הקוד לחברה. היא מוסיפה אותו אצלה, ואת מאשרת את הבקשה – ומרגע זה אתן חברות.</p>
    <div class="btnrow"><button class="cta soft" data-act="sharecode">${ic('upload')} שליחת הקוד</button></div>
  </div>`;
  h += `<div class="card">${cardHead('plus', 'הוספת חברה')}<form class="addtodo" data-friendadd><input name="code" placeholder="הקוד של החברה (6 תווים)" autocomplete="off" dir="ltr" maxlength="8"><button aria-label="הוספה">${ic('plus')}</button></form></div>`;
  if ((D2.requests || []).length) h += `<div class="card">${cardHead('heart', 'בקשות חברות', `<span class="cnt">${D2.requests.length}</span>`)}${D2.requests.map(r => `<div class="clsrow"><span class="av">${esc((r.name || '?')[0])}</span><span class="grow"><b>${esc(r.name || 'מורה')}</b><small>${esc(r.school || '')}</small></span><button class="cta sm" data-freq="accept|${r.id}">אישור</button><button class="iconbtn" data-freq="decline|${r.id}" aria-label="דחייה">${ic('x')}</button></div>`).join('')}</div>`;
  if (D2.inbox.length) h += `<div class="card">${cardHead('bell', g('נשלח אלייך', 'נשלח אליך'), `<span class="cnt">${D2.inbox.length}</span>`)}${D2.inbox.map(x => `<button class="pmhist" data-inbox="${x.id}"><span class="tpill">${x.kind === 'week' ? 'שבוע' : 'שיעור'}</span><span class="grow"><b>${esc(x.title)}</b><small>מ${esc(x.fromName || 'חברה')} · ${new Date(x.at).getDate()}.${new Date(x.at).getMonth() + 1}</small></span>${ic('chevL', 'chev')}</button>`).join('')}</div>`;
  h += `<div class="card">${cardHead('users', 'החברות שלי', `<span class="cnt">${D2.friends.length}</span>`)}${D2.friends.length ? D2.friends.map(f => `<div class="clsrow"><span class="av">${esc((f.name || '?')[0])}</span><span class="grow"><b>${esc(f.name || 'מורה')}</b><small>${esc([f.subjects, f.school].filter(Boolean).join(' · '))}</small></span><button class="cta soft sm" data-flib="${f.id}">השיעורים שלה</button><button class="iconbtn" data-funfriend="${f.id}" aria-label="הסרה">${ic('x')}</button></div>`).join('') : '<p class="dim">עוד אין חברות. שולחים את הקוד, או מוסיפים קוד של חברה.</p>'}</div>`;
  h += `<div class="card">${cardHead('star', 'שיעורים ששיתפתי עם כל החברות')}<button class="cta soft" data-flib="${D2.me.id}">צפייה ועריכה</button><p class="hint">משתפים שיעור מתוך מסך "השבוע": פותחים שיעור ← "שיתוף".</p></div>`;
  h += `<div class="card">${cardHead('pencil', 'הפרופיל שלי')}<form data-profile><label class="field">שם<input name="name" value="${esc(D2.me.name || state.name)}"></label><label class="field">בית ספר<input name="school" value="${esc(D2.me.school || '')}"></label><label class="field">מה אני מלמדת<input name="subjects" value="${esc(D2.me.subjects || '')}" placeholder="מחנכת ב׳ · שפה וחשבון"></label><button class="cta soft">שמירה</button></form></div>`;
  return h;
}
function shareLessonSheet(dow, label) {
  const w = pickWeek(), p = findPeriodIn(w, +dow, label);
  if (!sync.user) { toast('צריך להתחבר לחשבון כדי לשתף'); go('friends'); return; }
  if (!soc.data) { socLoad(true).then(() => shareLessonSheet(dow, label)); return; }
  state._share = { kind: 'lesson', title: p.title, data: { ...JSON.parse(JSON.stringify(p)), homework: [] }, to: [] };
  shareSheet();
}
function shareWeekSheet(id) {
  const w = state.weeks[id];
  if (!sync.user || !soc.data || !soc.data.friends.length) { shareWeek(w); return; }
  state._share = { kind: 'week', title: w.number ? `שבוע ${w.number}` : (w.title || 'תכנון שבועי'), data: w, to: [] };
  shareSheet();
}
function shareSheet() {
  const S2 = state._share, fr = soc.data ? soc.data.friends : [];
  openOverlay(`<div class="ov sheet">
    <button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('upload')}<h2>שיתוף ${S2.kind === 'week' ? 'שבוע' : 'שיעור'}</h2></div>
    <p class="dim">${esc(S2.title)}</p>
    ${fr.length ? `<p class="pmlbl">למי לשלוח?</p><div class="fchips wrap">${fr.map(f => `<button class="fc ${S2.to.includes(f.id) ? 'on' : ''}" data-shto="${f.id}">${S2.to.includes(f.id) ? '✓ ' : ''}${esc(f.name || 'מורה')}</button>`).join('')}</div>
      <button class="cta" data-act="shsend" ${S2.to.length ? '' : 'disabled'}>${ic('upload')} שליחה${S2.to.length ? ` ל־${S2.to.length}` : ''}</button>` : '<p class="hint">עוד אין חברות – מוסיפים ב"עוד ← מורות חברות".</p>'}
    ${S2.kind === 'lesson' ? `<button class="cta soft" data-act="shpub">${ic('star')} שיתוף עם כל החברות (בספרייה שלי)</button>` : `<button class="cta soft" data-act="shfile">${ic('file')} שליחה כקובץ (בווטסאפ / מייל)</button>`}
  </div>`);
}
async function libSheet(id) {
  const mine = soc.data && id === soc.data.me.id;
  const f = soc.data && soc.data.friends.find(x => x.id === id);
  openOverlay(`<div class="ov sheet"><button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button><div class="ovh">${ic('book')}<h2>${mine ? 'השיעורים ששיתפתי' : 'השיעורים של ' + esc(f ? f.name : 'חברה')}</h2></div><p class="hint">טוענת…</p></div>`);
  try {
    const { items } = await socApi('library', null, `&id=${encodeURIComponent(id)}`);
    state._lib = items;
    const by = new Map(); for (const it of items) { const n = look(it.data || {}).n; by.set(n, [...(by.get(n) || []), it]); }
    openOverlay(`<div class="ov sheet"><button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button><div class="ovh">${ic('book')}<h2>${mine ? 'השיעורים ששיתפתי' : 'השיעורים של ' + esc(f ? f.name : 'חברה')}</h2></div>
      ${items.length ? [...by].map(([n, its]) => `<h4 class="pmlbl">${esc(n)}</h4>${its.map(it => `<div class="clsrow"><span class="grow"><b>${esc(it.title)}</b><small>${esc((it.data.sections || []).map(s => s.label).filter(Boolean).join(' · '))}</small></span>${mine ? `<button class="iconbtn" data-unpub="${it.id}" aria-label="הסרה">${ic('trash')}</button>` : `<button class="cta soft sm" data-libtake="${it.id}">${ic('plus')} לקחת</button>`}</div>`).join('')}`).join('') : `<p class="dim">${mine ? 'עוד לא שיתפת שיעורים.' : 'היא עוד לא שיתפה שיעורים.'}</p>`}
    </div>`);
  } catch (e) { toast('לא הצלחתי לטעון 😕'); }
}
function takeLesson(p, from) {
  state.bank.push({ id: uid(), at: Date.now(), p: { ...p, from: from || '' } }); save();
  toast('נוסף למאגר השיעורים שלך ⭐ – משם מוסיפים לכל יום');
}
async function openInbox(id) {
  try {
    const { item } = await socApi('inbox-get', null, `&id=${encodeURIComponent(id)}`);
    if (!item) { toast('הפריט כבר לא קיים'); return; }
    state._inbox = item;
    const isW = item.kind === 'week';
    openOverlay(`<div class="ov sheet"><button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
      <div class="ovh">${ic(isW ? 'calendar' : 'book')}<h2>${esc(item.title)}</h2></div>
      <p class="dim">${isW ? 'שבוע שלם' : 'שיעור'} מ${esc(item.fromName || 'חברה')}</p>
      ${isW ? `<p class="dim">${item.data.days.map(d => `יום ${d.name}: ${d.periods.length} שיעורים`).join(' · ')}</p>` : (item.data.sections || []).filter(s => s.text).map(s => `<p class="sec"><b>${esc(s.label)}</b> – ${esc(s.text)}</p>`).join('')}
      <button class="cta" data-act="${isW ? 'intakeweek' : 'intakelesson'}">${ic('plus')} ${isW ? 'הוספת השבוע אצלי' : 'הוספה למאגר השיעורים'}</button>
      <button class="linkbtn danger-l" data-act="indel">מחיקה</button>
    </div>`);
  } catch { toast('לא הצלחתי לפתוח 😕'); }
}


// ================================================================ BELL SCHEDULE – when each period starts and ends (differs by school)
const BELL_ORDER = ['בוקר', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
function bellRows() {
  const b = state.prefs.bell;
  if (b && Object.keys(b).length) return BELL_ORDER.filter(l => b[l]).map(l => [l, ...b[l]]).concat(Object.keys(b).filter(l => !BELL_ORDER.includes(l)).map(l => [l, ...b[l]]));
  return BELL_ORDER.slice(0, 9).map(l => [l, ...bellFor(l)]);
}
function viewBells() {
  const rows = state._bellDraft || bellRows();
  let h = top('לוח צלצולים', 'מתי כל שיעור מתחיל ונגמר – לפי בית הספר שלך', 'clock', { back: 'more' });
  h += `<div class="card">${cardHead('clock', 'השעות', state.prefs.bell ? '<span class="cnt">נשמר ✓</span>' : '')}
    <div class="bellhead"><span>שיעור</span><span>התחלה</span><span>סיום</span><span></span></div>
    ${rows.map(([l, s, e], i) => `<div class="bellrow"><select data-bell="${i}|0">${BELL_ORDER.map(x => `<option value="${x}" ${x === l ? 'selected' : ''}>${x === 'בוקר' ? 'בוקר' : 'שעה ' + x}</option>`).join('')}</select><input type="time" data-bell="${i}|1" value="${esc(s || '')}"><input type="time" data-bell="${i}|2" value="${esc(e || '')}"><button class="iconbtn" data-belldel="${i}" aria-label="מחיקה">${ic('x')}</button></div>`).join('')}
    <button class="addrow" data-act="belladd">${ic('plus')} הוספת שיעור</button>
    <button class="cta" data-act="bellsave">${ic('check')} שמירת הלוח</button>
  </div>
  <div class="card">${cardHead('upload', 'יש לך את לוח הצלצולים בקובץ?')}
    <p class="dim">PDF, Word, Excel, טקסט – או צילום של הלוח. אני מוצאת את השעות וממלאת את הטבלה, ואת רק בודקת ושומרת.</p>
    <button class="cta soft" data-act="bellfile">${ic('upload')} העלאת קובץ או תמונה</button>
    <input type="file" id="bellfile" accept="image/*,.pdf,.docx,.xlsx,.csv,.txt" hidden>
  </div>
  <div class="card">${cardHead('layers', 'להחיל על התכנונים')}
    <p class="dim">השעות של כל שיעור בתכנונים יתעדכנו לפי הלוח.</p>
    <button class="cta soft" data-act="bellapply">${ic('check')} עדכון השבוע הנוכחי והבאים</button>
    <div class="setrow"><span>תכנון חדש שאעלה – לפי הלוח</span><button class="switch ${state.prefs.bellAuto ? 'on' : ''}" data-act="bellauto" role="switch" aria-checked="${!!state.prefs.bellAuto}"><i></i></button></div>
  </div>`;
  return h;
}
function bellSave(rows) {
  const b = {};
  for (const [l, s, e] of rows) if (l && s) b[l] = [s, e || s];
  state.prefs.bell = b; state._bellDraft = null; save();
}
function applyBell(wk) {
  const b = state.prefs.bell; if (!b) return 0;
  let n = 0;
  for (const d of wk.days) { for (const p of d.periods) if (b[p.label]) { const [s, e] = b[p.label]; if (p.start !== s || p.end !== e) { p.start = s; p.end = e; n++; } } d.periods.sort((a, c) => mins(a.start) - mins(c.start)); }
  return n;
}
// read times out of any text: "שעה 1  08:00–08:45", "1. 8:00-8:45", "בוקר 7:50 8:10" …
function parseBellText(text) {
  const lines = String(text).split(/\n|\r/).map(x => x.trim()).filter(Boolean);
  const T = /(?:^|[^\d])([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)(?!\d)/g;
  const tm = (h, m) => `${String(+h).padStart(2, '0')}:${m}`;
  let rows = [], next = 1;
  for (const ln of lines) {
    if (/הפסק|ארוחה|break|recess/i.test(ln)) continue;
    const ts = [...ln.matchAll(T)].map(m => tm(m[1], m[2]));
    if (ts.length < 2) continue;
    const lab = /בוקר|מפגש/.test(ln) ? 'בוקר' : ((ln.match(/שעה\s*(\d{1,2})/) || ln.match(/^\D{0,3}(\d{1,2})(?![\d:：])/) || [])[1]);
    const label = lab === 'בוקר' ? 'בוקר' : lab && +lab >= 1 && +lab <= 10 && !rows.some(r => r[0] === String(+lab)) ? String(+lab) : String(next);
    if (label !== 'בוקר') next = +label + 1;
    rows.push([label, ts[0], ts[1]]);
  }
  if (!rows.length) {
    // no line had two times: pair all times in order
    const all = [...String(text).matchAll(T)].map(m => tm(m[1], m[2]));
    for (let i = 0; i + 1 < all.length; i += 2) rows.push([String(i / 2 + 1), all[i], all[i + 1]]);
  }
  return rows.slice(0, 11);
}
async function readBellFile(f) {
  loader(true, .2, 'קוראת את הלוח…');
  try {
    let text = '';
    if (/^image\//.test(f.type) || /\.(png|jpe?g|heic|webp)$/i.test(f.name)) {
      if (!window.Tesseract) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
      const r = await window.Tesseract.recognize(f, 'eng', { logger: m => { if (m.status === 'recognizing text') loader(true, .2 + m.progress * .75, 'מזהה את השעות בתמונה…'); } });
      text = r.data.text;
    } else text = await extractText(f, pdfjsLib);
    const rows = parseBellText(text);
    loader(false);
    if (!rows.length) { toast('לא מצאתי שעות בקובץ 😕 אפשר למלא ידנית'); return; }
    state._bellDraft = rows; rerender();
    toast(`מצאתי ${rows.length} שיעורים – בודקים ושומרים ✓`, 3500);
  } catch (e) { loader(false); toast('לא הצלחתי לקרוא את הקובץ 😕'); }
}


// ================================================================ CONSISTENT DIALOGS: confirm sheet + undo
// ask() replaces the phone's grey await ask() box with the app's own sheet; resolves true/false
function ask(text, { ok = 'אישור', danger = false, title = '' } = {}) {
  return new Promise(res => {
    let el = $('#ask'); if (!el) { el = document.createElement('div'); el.id = 'ask'; document.body.appendChild(el); }
    el.innerHTML = `<div class="askbg" data-askno></div><div class="askbox" role="alertdialog" aria-modal="true">
      ${title ? `<h3>${esc(title)}</h3>` : ''}<p>${esc(text).replace(/\n/g, '<br>')}</p>
      <div class="askbtns"><button class="cta soft" data-askno>ביטול</button><button class="cta ${danger ? 'dangerbtn' : ''}" data-askyes>${esc(ok)}</button></div></div>`;
    el.classList.add('show');
    const done = v => { el.classList.remove('show'); el.onclick = null; res(v); };
    el.onclick = e => { if (e.target.closest('[data-askyes]')) done(true); else if (e.target.closest('[data-askno]')) done(false); };
  });
}
// delete now, offer "ביטול" for a few seconds – restores the listed parts of the state
function withUndo(keys, label, fn) {
  const snap = JSON.stringify(keys.map(k => state[k]));
  fn(); save(); rerender();
  state._undo = () => { const v = JSON.parse(snap); keys.forEach((k, i) => { state[k] = v[i]; }); if (keys.includes('classes')) { const c = curCls(); if (c) state.kids = c.kids; } save(); rerender(); toast('שוחזר ✓'); };
  toast(label, 6000, 'ביטול');
}

// ================================================================ APP LOCK (4-digit code, kept as a hash on the phone)
async function pinHash(pin) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hakita:' + pin)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function lockCheck(awayMs) { if (state.prefs.pinHash && (awayMs == null || awayMs > (state.prefs.lockMin || 5) * 60000)) showLock(); }
function showLock(mode = 'unlock') {
  let el = $('#lock'); if (!el) { el = document.createElement('div'); el.id = 'lock'; document.body.appendChild(el); }
  el.dataset.mode = mode; el.dataset.pin = '';
  const title = mode === 'set' ? 'בחירת קוד של 4 ספרות' : mode === 'confirm' ? 'שוב, לאישור' : 'הכיתה שלי נעולה';
  el.innerHTML = `<div class="lk-in">${logo('wlogo')}<h2>${title}</h2><div class="lk-dots">${'<i></i>'.repeat(4)}</div>
    <div class="lk-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => k === '' ? '<span></span>' : `<button data-lk="${k}">${k}</button>`).join('')}</div>
    ${mode !== 'unlock' ? '<button class="linkbtn" data-lk="cancel">ביטול</button>' : '<p class="hint">שכחת? אפשר להתחבר לחשבון ולשחזר – הקוד שמור רק בטלפון</p>'}</div>`;
  el.classList.add('show');
}
async function lockKey(k) {
  const el = $('#lock'); if (!el) return;
  if (k === 'cancel') { el.classList.remove('show'); return; }
  let pin = el.dataset.pin || '';
  pin = k === '⌫' ? pin.slice(0, -1) : (pin + k).slice(0, 4);
  el.dataset.pin = pin;
  el.querySelectorAll('.lk-dots i').forEach((d, i) => d.classList.toggle('on', i < pin.length));
  if (pin.length < 4) return;
  const h = await pinHash(pin), mode = el.dataset.mode;
  if (mode === 'set') { state._pin1 = h; showLock('confirm'); return; }
  if (mode === 'confirm') { if (h === state._pin1) { state.prefs.pinHash = h; save(); el.classList.remove('show'); toast('הנעילה הופעלה 🔒'); rerender(); } else { toast('הקודים לא תואמים – מנסים שוב'); showLock('set'); } return; }
  if (h === state.prefs.pinHash) el.classList.remove('show');
  else { el.classList.add('shake'); if (navigator.vibrate) navigator.vibrate(60); setTimeout(() => { el.classList.remove('shake'); el.dataset.pin = ''; el.querySelectorAll('.lk-dots i').forEach(d => d.classList.remove('on')); }, 450); }
}

// ================================================================ SYNC DOT – is everything saved to the account?
function syncDot() {
  if (!sync.user) return '';
  const st = sync.err ? 'err' : sync.pending || sync.busy ? 'wait' : 'ok';
  return `<button class="syncdot ${st}" data-go="settings" aria-label="${st === 'ok' ? 'הכל נשמר בחשבון' : st === 'wait' ? 'שומרת…' : 'לא נשמר – בודקים בהגדרות'}"></button>`;
}

// ================================================================ ONE-TIME TIPS – a short line the first time each screen opens
const TIPS = {
  now: 'כאן רואים מה קורה ברגע זה – השיעור, השלבים ומה צריך. "מצב בכיתה" פותח הכל בגדול.',
  day: 'כל השבוע, יום אחרי יום. מחליקים ימינה ושמאלה בין ימים ושבועות, ולוחצים על שיעור כדי לפתוח אותו.',
  prep: 'מה להדפיס, לשכפל ולהביא – לכל יום. מסמנים וי, ולוחצים על קובץ כדי להדפיס או לשתף.',
  cls: 'הילדים, ההורים והמעקב. לוחצים על ילד כדי לראות את כל מה שנרשם עליו.',
  more: 'תכנון שבוע חדש, לוח צלצולים, מאגר שיעורים, חברות והגדרות.',
};
function tipOnce(tab) {
  const seen = state.prefs.tips || {};
  if (!TIPS[tab] || seen[tab] || !state.onboarded) return '';
  return `<div class="card tip1"><span class="grow">${TIPS[tab]}</span><button class="linkbtn" data-tipok="${tab}">הבנתי</button></div>`;
}

// ================================================================ ADDRESS – את / אתה
const g = (f, m) => (state.prefs.male ? m : f);

// ================================================================ TOOLKIT: research-based methods & tips
const tipOfDay = () => { const t = now(); return BANK[(t.getFullYear() * 400 + t.getMonth() * 31 + t.getDate()) % BANK.length]; };
function tipCard() {
  const b = tipOfDay();
  return `<button class="card tipday" data-tip="${b.id}"><span class="tem">${b.em}</span><span class="grow"><small>${ic('sparkle')} רעיון להיום · ${CATS[b.cat][0]}</small><b>${esc(b.t)}</b><span>${esc(b.what)}</span></span>${ic('chevL', 'chev')}</button>`;
}
function tipRow(b) {
  const saved = state.tsaved.includes(b.id);
  return `<button class="tkrow" data-tip="${b.id}"><span class="tem">${b.em}</span><span class="grow"><b>${esc(b.t)}${saved ? ' <i class="hs">♥</i>' : ''}</b><small>${esc(b.what)}</small><span class="tkm"><em class="ev ev${b.ev}">${EV[b.ev]}</em><em>${esc(b.min)}</em></span></span>${ic('chevL', 'chev')}</button>`;
}
function viewTools() {
  const c = state.tcat;
  const list = BANK.filter(b => !c || (c === 'saved' ? state.tsaved.includes(b.id) : b.cat === c));
  let h = top('שיטות וטיפים', 'מה באמת עובד בכיתה – כל רעיון כאן נשען על מחקר, עם מקור', 'star', { back: 'more' });
  h += `<button class="cta tkrand" data-act="tiprand">🎲 ${g('תני', 'תן')} לי רעיון לשיעור הבא</button>`;
  h += `<div class="fchips tkchips"><button class="fc ${!c ? 'on' : ''}" data-tcat="">${ic('layers')}הכל</button>${Object.entries(CATS).map(([k, [n, i]]) => `<button class="fc ${c === k ? 'on' : ''}" data-tcat="${k}">${ic(i)}${n}</button>`).join('')}<button class="fc ${c === 'saved' ? 'on' : ''}" data-tcat="saved">${ic('heart')}שמרתי</button></div>`;
  const groups = c ? [[c, list]] : Object.keys(CATS).map(k => [k, list.filter(b => b.cat === k)]);
  for (const [k, items] of groups) {
    if (!items.length) continue;
    h += `<div class="card tkcard">${cardHead(k === 'saved' ? 'heart' : CATS[k][1], k === 'saved' ? 'מה ששמרתי' : CATS[k][0], `<span class="cnt">${items.length}</span>`)}${items.map(tipRow).join('')}</div>`;
  }
  if (!list.length) h += `<p class="hint">עוד לא שמרת רעיונות. לוחצים על ♡ בתוך רעיון שאהבת.</p>`;
  h += `<p class="hint">המקורות: מחקרים שפורסמו בכתבי עת, סקירות של קרן EEF הבריטית ועקרונות ההוראה של רוזנשיין. ליד כל רעיון – קישור למקור.</p>`;
  return h;
}
function tipSheet(id) {
  const b = BANK.find(x => x.id === id); if (!b) return;
  const saved = state.tsaved.includes(b.id);
  openOverlay(`<div class="ov sheet tksheet">
    <button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="tkh"><span class="tem big">${b.em}</span><div><small>${CATS[b.cat][0]} · ${esc(b.min)}</small><h2>${esc(b.t)}</h2></div></div>
    <p class="tkwhat">${esc(b.what)}</p>
    <h4>איך עושים</h4>
    <ol class="tksteps">${b.how.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    ${b.tip ? `<p class="tktip">💡 ${esc(b.tip)}</p>` : ''}
    <div class="tkwhy"><h4>${ic('target')} למה זה עובד <em class="ev ev${b.ev}">${EV[b.ev]}</em></h4><p>${esc(b.why)}</p>
      <p class="tksrc">${ic('book')} ${b.src[1] ? `<a href="${esc(b.src[1])}" target="_blank" rel="noopener">${esc(b.src[0])}</a>` : esc(b.src[0])}</p></div>
    <div class="btnrow">
      <button class="cta soft" data-tsave="${b.id}">${ic(saved ? 'heart' : 'heart')} ${saved ? 'שמור ♥' : 'לשמור'}</button>
      ${b.act ? `<button class="cta" data-act="${b.act}">${ic('dice')} מי עונה?</button>` : `<button class="cta" data-act="tiprand">🎲 עוד רעיון</button>`}
    </div>
  </div>`);
}

// ================================================================ MORE + sub screens
function viewMore(w) {
  const weeks = Object.values(state.weeks).sort((a, b) => (a.id < b.id ? 1 : -1));
  return top('עוד', streak() > 1 ? `🔥 ${streak()} ימים ברצף שהכל מוכן` : 'כלים, הגדרות ותכנונים', 'star') + `
  ${[
    ['תכנון', [['upload', 'תכנון חדש', 'data-act="upload"'], ['layers', 'השבוע הבא', w ? 'data-act="nextweek"' : 'disabled'], ['grid', 'מערכת', 'data-day="all"'], ['clock', 'לוח צלצולים', 'data-go="bells"'], ['book', 'מאגר שיעורים', 'data-go="bank"'], ['printer', 'הדפסת השבוע', w ? `data-printweek="${esc(w.id)}"` : 'disabled'], ['chart', 'סיכום שבוע', `data-go="summary" ${w ? '' : 'disabled'}`]]],
    ['חומרים ורעיונות', [['folder', 'קבצים', 'data-go="files"'], ['sparkle', 'שיטות וטיפים', 'data-go="tools"'], ['text', 'הגרלת הכתבה', 'data-act="dictfree"']]],
    ['תזכורות ושיתוף', [['pin', 'תזכורות', 'data-go="todos"'], ['check', 'הרשימות שלי', 'data-go="lists"'], ['bell', 'אוטומציות', 'data-go="autos"'], ['heart', 'מורות חברות', 'data-go="friends"']]],
  ].map(([t, items]) => `<h4 class="sect msect">${t}</h4><div class="toolgrid">${items.map(([i, l, a]) => `<button ${a}><span class="ti">${ic(i)}</span>${l}</button>`).join('')}</div>`).join('')}
  <h4 class="sect msect">עזרה והגדרות</h4>
  <button class="card setlink" data-go="settings"><span class="chi">${ic('settings')}</span><span class="grow"><b>הגדרות</b><small>${sync.user ? '☁️ מחוברת · ' : ''}חשבון, תצוגה, התראות, ווידג׳ט</small></span>${ic('chevL', 'chev')}</button>
  <div class="helprow"><button data-act="guide">${ic('book')} איך זה עובד</button><button data-act="report">${ic('warn')} משהו לא עובד?</button></div>
  <div class="card">
    ${cardHead('upload', 'התכנונים שלי')}
    <button class="cta" data-act="upload">${ic('upload')} להעלות תכנון של שבוע חדש</button>
    <p class="hint">PDF, Word, Excel או טקסט – בכל מבנה, או תכנון שמורה אחרת שיתפה. שבוע עם אותם תאריכים יוחלף. ${ic('upload')} ליד שבוע = שיתוף למורה אחרת.</p>
    <div class="btnrow"><button class="cta soft" data-act="manualweek">${ic('pencil')} שבוע ידני</button><button class="cta soft" data-act="templateweek" ${weeks.length ? '' : 'disabled'}>${ic('layers')} משבוע קודם</button></div>
    ${weeks.map(x => `<div class="wrow ${w && x.id === w.id ? 'on' : ''}">
      <button class="wsel" data-week="${esc(x.id)}"><b>${esc(x.number ? 'שבוע ' + x.number : x.title)}</b><small dir="ltr">${esc(x.range || '')}</small></button>
      <button class="iconbtn" data-shareweek="${esc(x.id)}" aria-label="שיתוף למורה אחרת">${ic('upload')}</button>
      <button class="iconbtn" data-printweek="${esc(x.id)}" aria-label="הדפסה">${ic('printer')}</button>
      <button class="iconbtn" data-delweek="${esc(x.id)}" aria-label="מחיקה">${ic('trash')}</button>
    </div>`).join('')}
  </div>
  ${sync.user ? `<button class="logoutbtn" data-act="logout">${ic('user')} התנתקות · <bdi dir="ltr">${esc(sync.user.email || '')}</bdi></button>` : ''}
  `;
}

function viewSettings(w) {
  const P = state.prefs;
  const toggle = (key, on) => `<button class="switch ${on ? 'on' : ''}" data-toggle-pref="${key}" role="switch" aria-checked="${on}"><i></i></button>`;
  return top('הגדרות', 'שהכל יעבוד בדיוק כמו שנוח לך', 'star', { back: 'more' }) + accountCard() + `
  <div class="card">
    ${cardHead('user', 'פרטים')}
    <label class="field">איך לקרוא לך?<input id="nameIn" value="${esc(state.name)}"></label>
    <label class="field">כמה תלמידים בכיתה?<input id="classSizeIn" type="number" inputmode="numeric" min="1" max="60" value="${esc(state.prefs.classSize || state.kids.length || (w && w.classSize) || 26)}"></label>
    <p class="hint">המספר הזה קובע כמה לשכפל מכל דף (במקום מה שכתוב בתכנון)</p>
  </div>
  <div class="card">
    ${cardHead('sparkle', 'תצוגה')}
    <div class="setrow"><span>גודל טקסט</span><div class="seg">${[0.9, 1, 1.15, 1.3].map((v, i) => `<button class="${P.size === v ? 'on' : ''}" data-size="${v}" style="font-size:${13 + i * 3}px">א</button>`).join('')}</div></div>
    <div class="setrow"><span>סגנון</span><div class="seg">${[['luxe', 'sparkle', 'יוקרתי'], ['colorful', 'heart', 'צבעוני']].map(([v, i, l]) => `<button class="${(P.skin || 'luxe') === v ? 'on' : ''}" data-skin="${v}">${ic(i)}${l}</button>`).join('')}</div></div>
    <div class="setrow"><span>מצב</span><div class="seg">${[['light', 'sun', 'יום'], ['dark', 'moon', 'לילה'], ['auto', 'sparkle', 'אוטו׳']].map(([v, i, l]) => `<button class="${P.theme === v ? 'on' : ''}" data-theme="${v}">${ic(i)}${l}</button>`).join('')}</div></div>
  </div>
  <div class="card">
    ${cardHead('user', 'פרטיות')}
    <div class="setrow"><span>שמות ילדים בהתראות<small class="dim"> (על מסך הנעילה)</small></span>${toggle('notifNames', !!P.notifNames)}</div>
    <div class="setrow"><span>נעילה בקוד${P.pinHash ? ' · פעילה 🔒' : ''}<small class="dim"> – לפני שרואים את האפליקציה</small></span><button class="cta soft sm" data-act="${P.pinHash ? 'pinoff' : 'pinset'}">${P.pinHash ? 'ביטול' : 'הפעלה'}</button></div>
    ${P.pinHash ? `<div class="setrow"><span>לנעול אחרי</span><div class="seg">${[1, 5, 15].map(m => `<button class="${(P.lockMin || 5) === m ? 'on' : ''}" data-lockmin="${m}">${m} דק׳</button>`).join('')}</div></div>` : ''}
    <p class="hint">המידע על התלמידים נשמר בטלפון ובחשבון שלך בלבד. קוד הנעילה לא נשלח לשום מקום.</p>
  </div>
  <button class="card setlink" data-go="autos"><span class="chi">${ic('bell')}</span><span class="grow"><b>התראות ואוטומציות</b><small>מתי ועל מה לקבל התראה</small></span>${ic('chevL', 'chev')}</button>
  ${w ? `<div class="card">
    ${cardHead('phone', 'ווידג׳ט והתראות לאייפון')}
    <button class="cta" data-act="widget">${ic('phone')} עדכון הווידג׳ט וההתראות</button>
    <details class="howto"><summary>איך מתקינים? (פעם אחת)</summary>
      <ol>
        <li>מתקינים מה־App Store את <b>Scriptable</b> (חינם).</li>
        <li><button class="linkbtn" data-act="widgetcode">העתקת קוד הווידג׳ט 📋</button></li>
        <li>ב־Scriptable: ＋ ← מדביקים ← קוראים לסקריפט <b>הכיתה שלי</b>.</li>
        <li>במסך הבית: לחיצה ארוכה ← ＋ ← Scriptable ← בוחרים גודל ← עורכים את הווידג׳ט ← Script: <b>הכיתה שלי</b>.</li>
        <li>חוזרים לכאן ולוחצים "עדכון הווידג׳ט וההתראות". בפעם הראשונה האייפון ישאל אם לאשר התראות – מאשרים.</li>
      </ol>
    </details>
  </div>` : ''}
  <div class="card">
    ${cardHead('layers', 'גיבוי')}
    <p class="dim">כל המידע נשמר רק בטלפון. כדאי לשמור גיבוי מדי פעם (למשל בדרייב).</p>
    <div class="btnrow"><button class="cta soft" data-act="export">${ic('upload')} שמירת גיבוי</button><button class="cta soft" data-act="import">${ic('folder')} שחזור מגיבוי</button></div>
  </div>
  <div class="card">
    ${cardHead('home', 'להוסיף למסך הבית')}
    <p><b>אייפון:</b> בספארי ← כפתור השיתוף ← "הוספה למסך הבית".</p>
    <p class="hint">האפליקציה תיפתח במסך מלא ותעבוד גם בלי אינטרנט.</p>
  </div>
  <button class="danger" data-act="wipe">${ic('trash')} מחיקת כל המידע מהטלפון</button>
  ${state.prefs.stepsDone ? `<button class="linkbtn" data-act="stepsback">להחזיר את "צעדים ראשונים" למסך "עכשיו"</button>` : ''}
  <div class="helprow"><button data-act="snaps">${ic('clock')} שחזור לגרסה קודמת</button><button data-act="report">${ic('warn')} משהו לא עובד?</button></div>
  <p class="hint">גרסה ${APP_V}</p>`;
}

function viewTodos(w) {
  return top('תזכורות', 'הדברים הקטנים שלא רוצים לשכוח', 'notepad', { back: 'more' }) + remindersCard(w, true) +
    `<p class="hint">תזכורת עם תאריך תופיע ב"עכשיו" מהיום הזה. בלי תאריך – תמיד.</p>` +
    (state.todos.some(t => t.done) ? `<button class="cta soft" data-act="cleartodos">לנקות את מה שסימנתי ✓</button>` : '');
}

function viewKids() {
  const txt = state.kids.map(k => `${k.name}${k.bd ? ' ' + k.bd : ''}${k.phone ? ' ' + k.phone : ''}`).join('\n');
  const t = now(); t.setHours(0, 0, 0, 0);
  const up = state.kids.filter(k => k.bd).map(k => {
    const [d, m] = k.bd.split('.').map(Number);
    let x = new Date(t.getFullYear(), m - 1, d); if (x < t) x = new Date(t.getFullYear() + 1, m - 1, d);
    return { k, x, days: Math.round((x - t) / 864e5) };
  }).sort((a, b) => a.days - b.days);
  return top('הכיתה שלי', 'שמות וימי הולדת – כדי שאף אחד לא יישכח', 'cake', { back: 'cls' }) + `
  <div class="card">
    ${cardHead('users', 'הילדים', `<span class="cnt">${state.kids.length}</span>`)}
    <p class="dim">שורה לכל ילד: שם, תאריך לידה (יום.חודש) וטלפון של הורה – לא חובה. אפשר להדביק רשימה שלמה.</p>
    <textarea id="kidsIn" rows="10" placeholder="דנה 12.3 050-1234567&#10;יואב 4.11&#10;מיה 28.6 052-7654321">${esc(txt)}</textarea>
    <button class="cta" data-act="savekids">שמירה</button>
    <p class="hint">משמש ל"מי עונה?" 🎲, לימי הולדת ולהודעה אישית להורה בווטסאפ 📞</p>
  </div>
  ${up.length ? `<div class="card">${cardHead('cake', 'הבאים בתור')}${up.slice(0, 8).map(({ k, x, days }) =>
    `<div class="row"><span class="tpill">${x.getDate()}.${x.getMonth() + 1}</span><span class="grow">${esc(k.name)}</span><span class="dim">${days === 0 ? 'היום! 🎉' : days === 1 ? 'מחר' : `בעוד ${days} ימים`}</span></div>`).join('')}</div>` : ''}`;
}

function summary(w) {
  const logs = state.logs[w.id] || {};
  const all = w.days.flatMap(d => d.periods.map(p => ({ d, p, id: `${d.dow}:${p.label}` })));
  const cnt = s => all.filter(x => logs[x.id] && logs[x.id].s === s).length;
  let pt = 0, pd = 0;
  for (const d of w.days) { const S = dayStats(w, d); pt += S.total; pd += S.done; }
  return { all, done: cnt('done'), part: cnt('part'), skip: cnt('skip'), pt, pd, carry: all.filter(x => logs[x.id] && logs[x.id].s !== 'done'), logs };
}
const carryText = (w, S) => `עובר מ${w.number ? 'שבוע ' + w.number : 'השבוע'}:\n` + S.carry.map(x => `• ${x.p.title} (יום ${x.d.name}) – ${S.logs[x.id].s === 'part' ? 'חלקית' : 'לא הספקנו'}${S.logs[x.id].note ? ': ' + S.logs[x.id].note : ''}`).join('\n');

function viewSummary(w) {
  const S = summary(w);
  const bds = w.days.flatMap(d => bdOn(dayDate(w, d)));
  const tile = (n, l) => `<div class="tile"><b class="num">${n}</b><span>${l}</span></div>`;
  const unmarked = S.all.length - S.done - S.part - S.skip;
  return top(`סיכום ${w.number ? 'שבוע ' + w.number : 'השבוע'}`, esc(w.range || ''), 'medal', { back: 'more' }) + `
  <div class="tiles">
    ${tile(S.all.length, 'שיעורים')}${tile(S.done, '✅ הספקנו')}${tile(S.part, '🌗 חלקית')}
    ${tile(S.skip, '⏭ לא הספקנו')}${tile(`${S.pd}/${S.pt}`, '✂️ הכנות')}${tile(bds.length, '🎂 ימי הולדת')}
  </div>
  ${unmarked > 0 ? `<p class="hint">${unmarked} שיעורים עוד בלי סימון – אפשר לסמן ב"השבוע" או ב"מערכת".</p>` : ''}
  <div class="card">${cardHead('arrowR', 'עובר לשבוע הבא', S.carry.length ? '<button class="linkbtn" data-act="copycarry">העתקה 📋</button>' : '')}
    ${S.carry.length ? S.carry.map(x => `<div class="note"><b>${LOG[S.logs[x.id].s][0]} ${esc(x.p.title)} · יום ${esc(x.d.name)}</b><span>${esc(S.logs[x.id].note || '')}</span></div>`).join('') : '<p class="dim">כלום! הכל הספקתם 🎉</p>'}
  </div>
  ${bds.length ? `<div class="card">${cardHead('cake', 'חגגנו השבוע')}<p>${esc(names(bds))}</p></div>` : ''}`;
}

function viewEmpty() {
  if (!state.onboarded) return `<section class="onb">
    <div class="onb-logo">${logo('wlogo')}</div>
    <h1>${g('ברוכה הבאה', 'ברוך הבא')} ל״הכיתה שלי״</h1>
    <p class="onb-sub">כמה פרטים כדי להתחיל:</p>
    <form class="card onb-form" data-onboard>
      <label class="field">איך קוראים לך?<input name="name" required placeholder="השם שלך" autocomplete="given-name"></label>
      <div class="frow"><label class="field">איזו כיתה?<input name="cls" placeholder="למשל ב׳2"></label>
        <label class="field">כמה תלמידים?<input name="size" type="number" inputmode="numeric" min="1" max="60" placeholder="27"></label></div>
      <button class="cta">${ic('sparkle')} מתחילים</button>
    </form>
    <p class="hint">יש לך כבר חשבון? <button class="linkbtn" data-act="onblogin">התחברות</button></p>
  </section>`;
  return top(state.name ? `שלום ${esc(state.name)}` : 'שלום', 'מעלים את התכנון השבועי ומתחילים', 'books') + firstSteps() + `
  <div class="card empty">
    <p>מעלים את התכנון השבועי – <b>בכל צורה</b>: PDF, Word, Excel או טקסט – ואני מסדרת: מה עכשיו, מה הבא, מה להכין.</p>
    <button class="cta" data-act="upload">${ic('upload')} להעלות את התכנון של השבוע</button>
    <button class="cta soft" data-act="manualweek">${ic('pencil')} לבנות שבוע ידנית</button>
    <p class="hint">יש לך כבר חשבון? <button class="linkbtn" data-go="settings">התחברות</button></p>
  </div>`;
}

// ================================================================ generic plans: review, manual week, template
const DEFAULT_BELL = { 'בוקר': ['08:00', '08:20'], 1: ['08:20', '09:00'], 2: ['09:00', '09:45'], 3: ['10:05', '10:50'], 4: ['10:50', '11:35'], 5: ['11:55', '12:40'], 6: ['12:40', '13:25'], 7: ['13:30', '14:15'], 8: ['14:15', '15:00'] };
function bellFor(label) {
  if (state.prefs.bell && state.prefs.bell[label]) return state.prefs.bell[label];
  for (const w of sortedWeeks().reverse()) for (const d of w.days) { const p = d.periods.find(x => x.label === label && x.start); if (p) return [p.start, p.end]; }
  return DEFAULT_BELL[label] || ['', ''];
}
function nextSunday() { const t = now(); t.setHours(0, 0, 0, 0); const d = addDays(t, t.getDay() >= 5 ? 7 - t.getDay() : -t.getDay()); return d; }
const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function buildWeek(days, startIso, meta = {}) {
  const sun = new Date(startIso + 'T00:00');
  const wk = { title: meta.title || '', number: meta.number || null, cls: state.prefs.cls || '', range: '', year: sun.getFullYear(), days: [], prep: {}, notes: [], importedAt: new Date().toISOString(), generic: true };
  for (const d0 of days) {
    const dd = addDays(sun, d0.dow);
    const d = { dow: d0.dow, name: DAY_NAMES[d0.dow], date: `${dd.getDate()}.${dd.getMonth() + 1}`, periods: [] };
    const used = new Set();
    d0.periods.forEach((p, i) => {
      let label = p.label || String(i + 1);
      while (used.has(label)) label += '׳';
      used.add(label);
      const [bs, be] = bellFor(label.replace(/׳+$/, ''));
      d.periods.push({ ...p, label, start: p.start || bs, end: p.end || be });
    });
    d.periods.sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
    const mats = d.periods.flatMap(p => p.materials.map(m => ({ text: m.text, period: p.label })));
    if (mats.length) wk.prep[d.dow] = [{ title: 'להכין / להביא', icon: '', items: mats }];
    wk.days.push(d);
  }
  wk.days.sort((a, b) => a.dow - b.dow);
  if (wk.days.length) wk.range = `${wk.days[0].date}–${wk.days[wk.days.length - 1].date}`;
  wk.id = isoDay(sun);
  if (!wk.title) wk.title = 'השבוע של ' + wk.range;
  return wk;
}
function reviewSheet(res) {
  state._review = res;
  const n = res.days.reduce((a, d) => a + d.periods.length, 0);
  let start = isoDay(nextSunday());
  const withDate = res.days.find(d => d.date);
  if (withDate) { const [dd, mm] = withDate.date.split('.').map(Number); const y = res.year || now().getFullYear(); start = isoDay(addDays(new Date(y, mm - 1, dd), -withDate.dow)); }
  openOverlay(`<form class="ov sheet review" data-review>
    <button type="button" class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('sparkle')}<h2>${n ? `מצאתי ${n} שיעורים ✨` : 'בואי נסדר יחד'}</h2></div>
    ${n ? `<div class="card">${res.days.map(d => `<div class="row"><b style="white-space:nowrap">יום ${d.name}</b><span class="dim grow">${d.periods.slice(0, 3).map(p => esc(p.title)).join(' · ')}${d.periods.length > 3 ? ' …' : ''}</span><span class="cnt">${d.periods.length}</span></div>`).join('')}</div>
      <label class="field">השבוע מתחיל ביום ראשון:<input type="date" name="start" value="${start}" required></label>
      <label class="field">שם לשבוע (לא חובה)<input name="title" value="${esc(res.number ? 'שבוע ' + res.number : '')}" placeholder="למשל שבוע 9"></label>
      <p class="hint">אחרי השמירה אפשר לערוך כל שיעור, ולהוסיף שעות, חומרים וקבצים.</p>
      <div class="btnrow"><button class="cta">${ic('check')} שמירה</button></div>`
    : `<p class="dim">${res.unsupported ? 'את סוג הקובץ הזה אני עוד לא יודעת לקרוא. אפשר PDF, Word, Excel או טקסט.' : diagReason(res.diag) || 'לא הצלחתי לזהות בקובץ ימים ושיעורים.'}</p>
      ${res.diag ? `<button type="button" class="linkbtn" data-act="diagreport">שליחת פרטי הקובץ לבדיקה</button>` : ''}
      <p class="dim">בינתיים אפשר לבנות את השבוע בכמה נגיעות:</p>
      <div class="menu">
        <button type="button" data-act="manualweek">${ic('pencil')} לבנות את השבוע ידנית</button>
        ${Object.keys(state.weeks).length ? `<button type="button" data-act="templateweek">${ic('layers')} לשכפל את השבוע הקודם כתבנית</button>` : ''}
      </div>`}
  </form>`);
}
function manualSheet(template) {
  openOverlay(`<form class="ov sheet" data-manual="${template ? 1 : ''}">
    <button type="button" class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic(template ? 'layers' : 'pencil')}<h2>${template ? 'שבוע חדש מהשבוע הקודם' : 'שבוע חדש'}</h2></div>
    <label class="field">השבוע מתחיל ביום ראשון:<input type="date" name="start" value="${isoDay(nextSunday())}" required></label>
    <label class="field">שם לשבוע (לא חובה)<input name="title" placeholder="למשל שבוע 10"></label>
    <p class="dim">${template ? 'אותם שיעורים ושעות כמו בשבוע האחרון – ואז רק מעדכנים מה משתנה.' : 'נוצר שבוע ריק, ובכל יום מוסיפים שיעורים בכפתור "הוספת שיעור".'}</p>
    <div class="btnrow"><button class="cta">${ic('check')} יצירה</button></div>
  </form>`);
}
function saveGenericWeek(wk) {
  tagClasses(wk); if (state.prefs.bellAuto) applyBell(wk);
  state.weeks[wk.id] = wk; state.activeId = wk.id; state.viewWeekId = wk.id === (realWeek() || {}).id ? null : wk.id; save();
  closeOverlay(); state.dayDow = null; go('day'); confetti();
}

// ================================================================ overlays (sheet)
let lockY = null;
function lockScroll(on) {
  const b = document.body;
  if (on && lockY == null) { lockY = window.scrollY; b.style.top = `-${lockY}px`; b.classList.add('noscroll'); }
  else if (!on && lockY != null) { b.classList.remove('noscroll'); b.style.top = ''; window.scrollTo(0, lockY); lockY = null; }
}
function openOverlay(html) {
  let o = $('#overlay');
  if (!o) { o = document.createElement('div'); o.id = 'overlay'; document.body.appendChild(o); }
  const already = o.classList.contains('show') && $('#overlay .ov');
  if (already) { $('#overlay .ov').outerHTML = html; return; }
  o.innerHTML = `<div class="ovbg" data-act="close"></div>${html}`;
  void o.offsetWidth; o.classList.add('show');
  lockScroll(true);
  renderTimerPill();
}
function closeOverlay() {
  const o = $('#overlay'); if (o) o.classList.remove('show');
  lockScroll(false);
  setTimeout(renderTimerPill, 50);
}

// ---------------------------------------------------------------- lesson editor
const LABELS = ['בוקר', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
function editor(w, dow, label) {
  const day = w.days.find(d => d.dow === dow);
  const p = label ? day.periods.find(x => x.label === label) : null;
  const freeL = LABELS.find(l => !day.periods.some(x => x.label === l)) || '1';
  const e = p || { label: freeL, start: bellFor(freeL)[0], end: bellFor(freeL)[1], title: '', subtitle: '', subject: '', sections: [{ label: 'פתיחה', text: '' }, { label: 'גוף השיעור', text: '' }, { label: 'סיום', text: '' }], materials: [], homework: [], links: [], badges: [] };
  const L = look(e);
  const used = day.periods.map(x => x.label);
  const row = (type, a = '', b = '') => {
    if (type === 'sections') return `<div class="erow"><input class="ea" value="${esc(a)}" placeholder="כותרת (פתיחה…)"><textarea class="eb" rows="2" placeholder="מה עושים">${esc(b)}</textarea><button type="button" class="iconbtn" data-delrow>${ic('x')}</button></div>`;
    if (type === 'links') return `<div class="erow two"><input class="ea" value="${esc(a)}" placeholder="שם הקובץ"><input class="eb" value="${esc(b)}" placeholder="קישור (https://…)" dir="ltr"><button type="button" class="iconbtn" data-delrow>${ic('x')}</button></div>`;
    return `<div class="erow one"><input class="ea" value="${esc(a)}" placeholder="${type === 'materials' ? 'למשל: דף עבודה – שכפול 26' : 'למשל: עמ׳ 12'}"><button type="button" class="iconbtn" data-delrow>${ic('x')}</button></div>`;
  };
  editor.row = row;
  openOverlay(`<form class="ov sheet editor" novalidate data-editor="${dow}|${esc(label || '')}">
    <button type="button" class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('pencil')}<h2>${p ? 'עריכת שיעור' : 'שיעור חדש'}</h2></div>
    <p class="dim">יום ${esc(day.name)}</p>
    <label class="field">שם השיעור<input name="title" value="${esc(e.title)}" placeholder="למשל: הקיוסק של בולי"></label>
    <div class="frow">
      ${multiCls() ? `<label class="field">כיתה<select name="cls"><option value="">—</option>${state.classes.map(c => `<option ${e.cls === c.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : ''}
      <label class="field">מקצוע<select name="subject">${SUBJ.map(s => s[1]).concat(['אחר']).map(n => `<option ${L.n === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field">שעה<select name="label">${LABELS.map(l => `<option value="${l}" ${e.label === l ? 'selected' : ''} ${used.includes(l) && l !== e.label ? 'disabled' : ''}>${l === 'בוקר' ? 'בוקר' : 'שעה ' + l}</option>`).join('')}</select></label>
    </div>
    <div class="frow">
      <label class="field">התחלה<input type="time" name="start" value="${esc(e.start)}"></label>
      <label class="field">סיום<input type="time" name="end" value="${esc(e.end)}"></label>
    </div>
    <label class="field">תיאור קצר<input name="subtitle" value="${esc(e.subtitle.split('·').slice(1).join('·').trim())}" placeholder="למשל: עמ׳ 72 + משחק"></label>
    ${['sections', 'materials', 'homework', 'links'].map(type => {
      const title = { sections: 'מהלך השיעור', materials: 'מה צריך?', homework: 'שיעורי בית', links: 'קבצים וקישורים' }[type];
      const items = type === 'sections' ? e.sections.map(s => row(type, s.label, s.text)) : type === 'materials' ? e.materials.map(m => row(type, m.text)) : type === 'homework' ? e.homework.map(h => row(type, h)) : e.links.map(l => row(type, l.text, l.url));
      return `<fieldset data-list="${type}"><legend>${title}</legend>${items.join('')}<button type="button" class="addrow" data-addrow="${type}">${ic('plus')} הוספה</button></fieldset>`;
    }).join('')}
    <div class="btnrow">
      <button class="cta" type="submit">${ic('check')} שמירה</button>
      ${p ? `<button type="button" class="danger" data-act="dellesson">${ic('trash')} מחיקה</button>` : ''}
    </div>
  </form>`);
}
function saveEditor(f) {
  const w = pickWeek();
  const [dow, oldLabel] = f.dataset.editor.split('|');
  const day = w.days.find(d => d.dow === +dow);
  const get = type => [...f.querySelectorAll(`[data-list="${type}"] .erow`)].map(r => [r.querySelector('.ea')?.value.trim() || '', r.querySelector('.eb')?.value.trim() || '']);
  const subj = f.subject.value;
  const old = oldLabel ? day.periods.find(x => x.label === oldLabel) : null;
  const sub = f.subtitle.value.trim();
  if (!f.title.value.trim()) { toast('חסר שם לשיעור'); f.title.focus(); return; }
  const bell = bellFor(f.label.value);
  if (!f.start.value) f.start.value = bell[0] || '08:00';
  if (!f.end.value) f.end.value = bell[1] || f.start.value;
  const p = Object.assign(old || {}, {
    label: f.label.value, start: f.start.value, end: f.end.value, title: f.title.value.trim(),
    cls: f.cls ? f.cls.value : (old ? old.cls || '' : ''), subject: subj === 'אחר' ? '' : subj, subtitle: (subj === 'אחר' ? '' : subj) + (sub ? ' · ' + sub : ''),
    sections: get('sections').filter(([a, b]) => a || b).map(([label, text]) => ({ label, text })),
    materials: get('materials').filter(([a]) => a).map(([text]) => ({ text })),
    homework: get('homework').filter(([a]) => a).map(([a]) => a),
    links: get('links').filter(([a, b]) => a || b).map(([text, url]) => ({ text: text || url, url: /^https?:/.test(url) ? url : '' })),
    badges: old ? old.badges : [], edited: true,
  });
  const was = old ? { label: oldLabel, start: old.start } : null;
  if (!old) day.periods.push(p);
  day.periods.sort((a, b) => mins(a.start) - mins(b.start));
  if (!old || was.label !== p.label || was.start !== p.start) logChange(w, day, p.title, was, { label: p.label, start: p.start });
  if (old && oldLabel !== p.label) moveKeys(w, `${dow}:${oldLabel}`, `${dow}:${p.label}`);
  save(); closeOverlay(); state.open[`${dow}:${p.label}`] = true; rerender(); toast('נשמר ✓');
}
function moveKeys(w, from, to) {
  const c = state.checks[w.id] || {};
  for (const k of Object.keys(c)) if (k.startsWith(`m:${from}:`)) { c[k.replace(`m:${from}:`, `m:${to}:`)] = c[k]; delete c[k]; }
  const l = state.logs[w.id] || {}; if (l[from]) { l[to] = l[from]; delete l[from]; }
}

// ---------------------------------------------------------------- timer
const T = { total: 0, endAt: 0, left: 0, running: false, rounds: 1, round: 1, between: false, setMin: 5, setRounds: 1 };
let tInt = null;
function timerHint(p) {
  const txt = p.sections.map(s => s.text).join(' ') + ' ' + p.title + ' ' + p.subtitle;
  const st = txt.match(/(\d+)\s*תחנות/), mn = txt.match(/(\d+)\s*דקות/);
  return st && mn ? `<button class="tbtn" data-timer="${+mn[1]}" data-rounds="${+st[1]}">${ic('timer')} טיימר תחנות: ${+st[1]} × ${+mn[1]} דק׳</button>` : '';
}
function timerSetup(min, rounds) {
  T.setMin = min; T.setRounds = rounds;
  openOverlay(`<div class="ov">
    <button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('timer')}<h2>טיימר</h2></div>
    <div class="presets">${[1, 2, 3, 4, 5, 7, 10, 15, 20].map(m => `<button class="${m === min ? 'on' : ''}" data-tset="${m}">${m}</button>`).join('')}</div>
    <div class="stepper"><button data-tmin="-1">−</button><div><b>${min}</b><span>דקות</span></div><button data-tmin="1">＋</button></div>
    <div class="stepper"><button data-trnd="-1">−</button><div><b>${rounds}</b><span>${rounds > 1 ? 'תחנות / סבבים' : 'סבב אחד'}</span></div><button data-trnd="1">＋</button></div>
    <button class="cta" data-act="tstart">${ic('play')} מתחילים</button>
  </div>`);
}
function timerStart() {
  T.total = T.setMin * 60; T.rounds = T.setRounds; T.round = 1; T.between = false;
  T.left = T.total; T.endAt = Date.now() + T.total * 1000; T.running = true;
  wakeOn(); timerScreen();
  clearInterval(tInt); tInt = setInterval(tick, 250);
}
function timerScreen() {
  openOverlay(`<div class="ov timer">
    <button class="ovx" data-act="close" aria-label="מזעור">${ic('chevD')}</button>
    <div class="tround" id="tRound"></div>
    <div class="tring" id="tRing"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" class="rt"/><circle cx="50" cy="50" r="45" class="rv" pathLength="100"/></svg><div class="tdigits" id="tDig"></div></div>
    <div class="tmsg" id="tMsg"></div>
    <div class="tctl">
      <button data-act="tplus">+1 דק׳</button>
      <button data-act="tpause" class="main" id="tPause"></button>
      <button data-act="tstop" aria-label="עצירה">${ic('stop')}</button>
    </div>
  </div>`);
  tick();
}
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function tick() {
  if (T.running) T.left = Math.max(0, (T.endAt - Date.now()) / 1000);
  const dig = $('#tDig');
  if (dig) {
    dig.textContent = fmt(Math.ceil(T.left));
    $('#tRing').style.setProperty('--p', T.total ? 1 - T.left / T.total : 0);
    $('#tRound').textContent = T.rounds > 1 ? `${T.between ? 'מחליפים תחנה' : 'תחנה'} ${T.round} מתוך ${T.rounds}` : '';
    $('#tPause').innerHTML = T.running ? ic('pause') : ic('play');
    $('#tRing').classList.toggle('low', T.left <= 30 && T.left > 0 && !T.between);
  }
  renderTimerPill();
  if (T.running && T.left <= 0) {
    const msg = t => { const m = $('#tMsg'); if (m) { m.textContent = t; m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop'); } };
    if (T.between) { T.between = false; T.round++; T.total = T.setMin * 60; T.endAt = Date.now() + T.total * 1000; bell(1); msg(''); }
    else if (T.round < T.rounds) { bell(3); T.between = true; T.total = 15; T.endAt = Date.now() + 15000; msg('עוברים תחנה! 🔔'); }
    else { bell(3); T.running = false; clearInterval(tInt); if (!wantAwake) wakeOff(); msg('הזמן נגמר! 🎉'); confetti(); }
  }
}
function renderTimerPill() {
  let el = $('#tpill');
  const show = (T.running || (T.left > 0 && T.total)) && !$('#overlay.show');
  if (!show) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('button'); el.id = 'tpill'; el.dataset.act = 'topen'; document.body.appendChild(el); }
  el.innerHTML = `${ic('timer')}<b>${fmt(Math.ceil(T.left))}</b>`;
}
let actx;
function bell(n) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < n; i++) {
      const t0 = actx.currentTime + i * 0.55;
      for (const [f, g] of [[880, .45], [1320, .18], [1760, .08]]) {
        const o = actx.createOscillator(), v = actx.createGain();
        o.frequency.value = f; v.gain.setValueAtTime(0, t0); v.gain.linearRampToValueAtTime(g, t0 + 0.01); v.gain.exponentialRampToValueAtTime(0.001, t0 + 1.4);
        o.connect(v).connect(actx.destination); o.start(t0); o.stop(t0 + 1.5);
      }
    }
  } catch { /* no audio */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

// ---------------------------------------------------------------- picker
function todayKey() { const d = now(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function absentToday() { return state.absent && state.absent.d === todayKey() ? state.absent.names : []; }
const presentKids = () => { const ab = absentToday(); return state.kids.map(k => k.name).filter(n => !ab.includes(n)); };
const GCOL = ['#F6B7CF', '#B79AF7', '#F6D38A', '#9DD6F9', '#B8D88E', '#F6C28B', '#D4B7F5', '#EDC3A0'];

function pickerScreen() {
  const kids = state.kids.map(k => k.name);
  const mode = state.pickMode === 'groups' ? 'groups' : 'one';
  const here = presentKids(), ab = absentToday();
  const left = here.filter(k => !state.picked.includes(k)).length;
  let body;
  if (!kids.length) {
    body = `<div class="kidsquick">
      <p><b>כדי להגריל צריך את שמות הילדים 🙂</b><br><span class="dim">שורה לכל ילד/ה. אפשר להוסיף גם תאריך לידה (יום.חודש) – בשביל ימי ההולדת.</span></p>
      <textarea id="kidsQuick" rows="7" placeholder="דנה&#10;יואב 4.11&#10;מיה"></textarea>
      <button class="cta" data-act="savekidsquick">${ic('check')} שמירה</button>
    </div>`;
  } else if (mode === 'one') {
    body = `<div class="pname" id="pName">${state._lastPick ? esc(state._lastPick) : art('star', 'bob')}</div>
      <button class="cta big" data-act="pick">${ic('dice')} מי עונה?</button>
      <p class="hint" id="pLeft">בלי חזרות: נשארו ${left} מתוך ${here.length} · <button class="linkbtn" data-act="preset">להתחיל מחדש</button></p>`;
  } else {
    const per = here.length ? Math.ceil(here.length / state.groups) : 0;
    body = `<div class="stepper"><button data-pg="-1">−</button><div><b>${state.groups}</b><span>קבוצות · כ־${per} בכל אחת</span></div><button data-pg="1">＋</button></div>
      <div class="gteams" id="gTeams">${state._teams ? teamsHtml(state._teams) : ''}</div>
      <button class="cta big" data-act="split">${ic('users')} ${state._teams ? 'ערבוב מחדש' : 'חלוקה לקבוצות!'}</button>`;
  }
  openOverlay(`<div class="ov picker">
    <button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('dice')}<h2>הגרלות</h2></div>
    ${kids.length ? `<div class="seg wide"><button class="${mode === 'one' ? 'on' : ''}" data-pmode="one">${ic('user')}ילד/ה אחד/ת</button><button class="${mode === 'groups' ? 'on' : ''}" data-pmode="groups">${ic('users')}חלוקה לקבוצות</button></div>` : ''}
    ${body}
    ${kids.length ? `<details class="absent" ${state._absOpen ? 'open' : ''}><summary>מי חסר/ה היום? ${ab.length ? `<span class="cnt">${ab.length}</span>` : ''}</summary>
      <div class="kchips">${kids.map(n => `<button class="kc ${ab.includes(n) ? 'off' : ''}" data-absent="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      <p class="hint">מי שמסומן/ת כחסר/ה לא ייכנס/תיכנס להגרלות היום.</p></details>` : ''}
  </div>`);
}
function teamsHtml(teams) {
  return teams.map((t, i) => `<div class="team" style="--c:${GCOL[i % GCOL.length]};--i:${i}"><b>קבוצה ${i + 1}</b>${t.map(n => `<span>${esc(n)}</span>`).join('')}</div>`).join('');
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function doSplit() {
  const here = shuffle(presentKids());
  if (!here.length) { toast('אין ילדים נוכחים 🙂'); return; }
  const n = Math.min(state.groups, here.length);
  const teams = Array.from({ length: n }, () => []);
  here.forEach((k, i) => teams[i % n].push(k));
  state._teams = teams;
  pickerScreen(); bell(1);
  const el = $('#gTeams'); if (el) miniBurst(el);
}
function doPick() {
  const here = presentKids();
  let pool = here.filter(k => !state.picked.includes(k));
  if (!pool.length) { state.picked = []; pool = here.slice(); }
  if (!pool.length) { toast('אין ילדים נוכחים 🙂'); return; }
  const win = pool[Math.floor(Math.random() * pool.length)];
  const el = $('#pName'); let n = 0;
  const btn = $('[data-act=pick]'); if (btn) btn.disabled = true;
  el.classList.remove('win'); el.classList.add('spin');
  const step = () => {
    el.textContent = here[Math.floor(Math.random() * here.length)];
    if (++n < 18) setTimeout(step, 40 + n * n * 1.2);
    else {
      el.classList.remove('spin'); el.textContent = win; el.classList.add('win'); bell(1); miniBurst(el);
      state.picked.push(win); state._lastPick = win; save();
      const pl = $('#pLeft'); if (pl) pl.firstChild.textContent = `בלי חזרות: נשארו ${here.filter(k => !state.picked.includes(k)).length} מתוך ${here.length} · `;
      if (btn) btn.disabled = false;
    }
  };
  step();
}

// ================================================================ prefs, wake lock, backup
function applyPrefs() {
  const p = state.prefs;
  document.documentElement.style.setProperty('--z', p.size || 1);
  if ((p.size || 1) !== 1) document.documentElement.dataset.zoom = '1'; else delete document.documentElement.dataset.zoom;
  const dark = p.theme === 'dark' || (p.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.skin = p.skin || 'luxe';
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#1C1924' : '#FAF7F4';
  const sb = $('#sbar'); if (sb) sb.content = dark ? 'black-translucent' : 'default';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyPrefs);
// keep the screen on: Screen Wake Lock, with a silent looping video as fallback for older iPhones
let wakeLock = null, wakeVideo = null, wantAwake = false;
async function wakeOn() {
  try {
    if (!wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
      return true;
    }
    if (wakeLock) return true;
  } catch { /* fall through */ }
  try {
    if (!wakeVideo) {
      wakeVideo = document.createElement('video');
      wakeVideo.src = 'vendor/keepawake.mp4'; wakeVideo.loop = true; wakeVideo.muted = true;
      wakeVideo.setAttribute('playsinline', ''); wakeVideo.setAttribute('muted', '');
      wakeVideo.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;bottom:0;left:0';
      document.body.appendChild(wakeVideo);
    }
    await wakeVideo.play();
    wakeLock = { video: true, release() { wakeVideo.pause(); } };
    return true;
  } catch { return false; }
}
function wakeOff() { try { wakeLock && wakeLock.release(); } catch { /* fine */ } wakeLock = null; }
async function toggleAwake() {
  if (wantAwake) { wantAwake = false; wakeOff(); toast('המסך יכבה כרגיל 🌙'); }
  else { wantAwake = true; toast(await wakeOn() ? 'המסך יישאר דלוק עד שתכבי 🔆' : 'הטלפון הזה לא מאפשר להשאיר מסך דלוק 😕'); }
  document.querySelectorAll('[data-act=wake]').forEach(b => { b.classList.toggle('on', wantAwake); b.lastChild.textContent = wantAwake ? 'מסך דלוק ✓' : 'מסך דלוק'; });
}

function exportBackup() {
  const o = {}; for (const k of SAVED) o[k] = state[k];
  const blob = new Blob([JSON.stringify({ app: 'hakita-sheli', v: 1, at: new Date().toISOString(), data: o })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `גיבוי-הכיתה-שלי-${now().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  toast('הגיבוי נשמר 💾');
}
function importBackup() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    try {
      const j = JSON.parse(await inp.files[0].text());
      if (j.app !== 'hakita-sheli') throw new Error('not ours');
      if (!await ask('לשחזר מהגיבוי? המידע הנוכחי בטלפון יוחלף.')) return;
      Object.assign(state, j.data); save(); applyPrefs(); go('now'); toast('שוחזר! 💜');
    } catch { toast('זה לא קובץ גיבוי של האפליקציה 😕'); }
  };
  inp.click();
}

// ================================================================ file upload & matching
let attachTo = null;
function lessonOptions(selected, extraWeekIds = []) {
  const w = pickWeek();
  const weeks = [w, ...extraWeekIds.filter(id => id !== w.id && state.weeks[id]).map(id => state.weeks[id])];
  return `<option value="">בלי שיוך (קובץ כללי)</option>` + weeks.map(wk => wk.days.map(d => `<optgroup label="${esc(wk !== w ? (wk.number ? 'שבוע ' + wk.number + ' · ' : '') : '')}יום ${esc(d.name)} ${esc(d.date)}">${d.periods.map(p => {
    const v = `${wk.id}|${d.dow}|${p.label}`;
    return `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(p.start)} · ${esc(p.title)}</option>`;
  }).join('')}</optgroup>`).join('')).join('');
}
async function handleUploads(list) {
  const w = pickWeek();
  if (!w) { toast('קודם מעלים תכנון שבועי 🙂'); return; }
  toast(`קוראת ${list.length > 1 ? list.length + ' קבצים' : 'את הקובץ'}… ✨`, 0);
  const pending = [];
  for (const file of list) {
    const id = (uid() + uid()).slice(0, 14);
    await putBlob(id, file);
    let m = [];
    if (attachTo) m = [{ weekId: w.id, dow: attachTo.dow, label: attachTo.label, conf: 'high', score: 1, linkIdx: -1, hits: [] }];
    else { const text = await extractText(file, pdfjsLib); m = matchLessons(file.name, text, Object.values(state.weeks), w.id); }
    pending.push({ id, name: file.name, type: file.type, size: file.size, m });
  }
  attachTo = null;
  $('#toast').classList.remove('show');
  assignSheet(pending, false);
}
function assignSheet(pending, existing) {
  state._pending = pending;
  openOverlay(`<form class="ov sheet assign" data-assign="${existing ? 1 : ''}">
    <button type="button" class="ovx" data-act="cancelupload" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('sparkle')}<h2>${existing ? 'שיוך לשיעור' : pending.length > 1 ? `שיוך ${pending.length} קבצים` : 'לאיזה שיעור?'}</h2></div>
    ${pending.map((f, i) => {
      const top = f.m && f.m[0];
      const sel = f.cur || (top && top.conf !== 'low' ? `${top.weekId}|${top.dow}|${top.label}` : '');
      const why = top && !existing ? (top.conf === 'high' ? `✨ זיהיתי: ${esc(top.title)}${top.hits.length ? ` <i>(${esc(top.hits.slice(0, 3).join(', '))})</i>` : ''}` : top.conf === 'mid' ? `🤔 אולי: ${esc(top.title)} – כדאי לוודא` : 'לא זיהיתי – בחרי שיעור') : (!existing ? 'לא זיהיתי – בחרי שיעור' : '');
      return `<div class="arow" style="--i:${i}">
        <div class="arow-h">${fileBadge(kindOf(f.name, f.type))}<span class="fx"><b>${esc(f.name)}</b><small>${fmtSize(f.size)}</small></span></div>
        ${why ? `<div class="why ${top ? top.conf : ''}">${why}</div>` : ''}
        <select name="ref${i}">${lessonOptions(sel, f.m ? f.m.map(x => x.weekId) : [])}</select>
      </div>`;
    }).join('')}
    <div class="btnrow"><button class="cta">${ic('check')} שמירה</button></div>
  </form>`);
}
async function saveAssign(form) {
  const pending = state._pending || [];
  const existing = !!form.dataset.assign;
  pending.forEach((f, i) => {
    const v = form[`ref${i}`].value;
    const ref = v ? (([w, dow, label]) => ({ w, dow: +dow, label }))(v.split('|')) : null;
    const top = f.m && f.m.find(x => ref && x.weekId === ref.w && x.dow === ref.dow && x.label === ref.label);
    const linkIdx = top ? top.linkIdx : -1;
    if (existing) { const cur = state.files.find(x => x.id === f.id); if (cur) { cur.ref = ref; cur.linkIdx = linkIdx; } }
    else state.files.push({ id: f.id, name: f.name, type: f.type, size: f.size, added: new Date().toISOString(), ref, linkIdx, cloud: false });
  });
  state._pending = null;
  save(); closeOverlay(); rerender();
  if (!existing) { toast(pending.length > 1 ? `${pending.length} קבצים נשמרו 📎` : 'הקובץ נשמר 📎'); confetti(); state.files.filter(f => !f.cloud).forEach(f => uploadCloud(f)); }
  else toast('עודכן ✓');
}
async function cancelUpload() {
  if (state._pending && !$('[data-assign="1"]')) for (const f of state._pending) await delBlob(f.id).catch(() => {});
  state._pending = null; closeOverlay();
}
async function openFile(id) {
  const f = state.files.find(x => x.id === id); if (!f) return;
  let blob = await getBlob(id).catch(() => null);
  if (!blob && f.cloud && sync.user) { toast('מורידה מהענן… ☁️', 0); blob = await downloadCloud(f).catch(() => null); if (blob) await putBlob(id, blob); }
  if (!blob) { toast(sync.user ? 'לא הצלחתי להוריד את הקובץ 😕' : 'הקובץ נמצא במכשיר אחר – התחברי כדי להוריד אותו ☁️', 3500); return; }
  $('#toast').classList.remove('show');
  const url = URL.createObjectURL(new File([blob], f.name, { type: f.type || blob.type }));
  const a = document.createElement('a'); a.href = url; a.rel = 'noopener';
  if (/pdf|img/.test(kindOf(f.name, f.type))) a.target = '_blank'; else a.download = f.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function fileMenu(id) {
  const f = state.files.find(x => x.id === id); if (!f) return;
  openOverlay(`<div class="ov">
    <button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${fileBadge(kindOf(f.name, f.type))}<h2>${esc(f.name)}</h2></div>
    <div class="menu">
      <button data-openfile="${f.id}">${ic('file')} פתיחה</button>
      <button data-reassign="${f.id}">${ic('link')} שיוך לשיעור אחר</button>
      <button data-delfile="${f.id}" class="red">${ic('trash')} מחיקה</button>
    </div>
  </div>`);
}
const PART = 4 * 1024 * 1024;
async function uploadCloud(f) {
  if (!sync.user || f.cloud || f._up) return;
  f._up = true;
  try {
    const blob = await getBlob(f.id); if (!blob) return;
    try { await ID.refreshSession(); } catch { /* fine */ }
    const parts = Math.max(1, Math.ceil(blob.size / PART));
    for (let n = 0; n < parts; n++) {
      const r = await fetch(`/api/file?id=${f.id}&part=${n}`, { method: 'PUT', credentials: 'same-origin', body: blob.slice(n * PART, (n + 1) * PART) });
      if (!r.ok) throw new Error('upload ' + r.status);
    }
    f.parts = parts; f.cloud = true; save();
  } catch (e) { console.warn(e); } finally { delete f._up; }
}
async function downloadCloud(f) {
  try { await ID.refreshSession(); } catch { /* fine */ }
  const bufs = [];
  for (let n = 0; n < (f.parts || 1); n++) {
    const r = await fetch(`/api/file?id=${f.id}&part=${n}`, { credentials: 'same-origin' });
    if (!r.ok) throw new Error('download ' + r.status);
    bufs.push(await r.arrayBuffer());
  }
  return new Blob(bufs, { type: f.type || '' });
}
async function deleteFile(id) {
  const f = state.files.find(x => x.id === id); if (!f) return;
  state.files = state.files.filter(x => x.id !== id); save();
  await delBlob(id).catch(() => {});
  if (f.cloud && sync.user) fetch(`/api/file?id=${id}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
}

// ================================================================ print & copy files
const driveId = url => (url.match(/\/d\/([\w-]{10,})/) || url.match(/[?&]id=([\w-]{10,})/) || [])[1];
// the class size is what's set in the app; the plan's number is only a fallback
function classSize(w) { return +state.prefs.classSize || state.kids.length || (w && w.classSize) || 26; }
function copyQty(text, n, planSize) {
  const multi = [...text.matchAll(/(\d+)\s*×\s*([○△☆□◇●])/g)].map(m => `${m[2]} ${m[1]}`);
  if (multi.length) return { label: multi.join(' · '), n: null };
  const m = text.match(/×\s*(\d+)|(\d+)\s*×|שכפול\s+(?:דו-?צדדי\s+)?(\d+)|\((\d+)\)/);
  if (m) { const v = +(m[1] || m[2] || m[3] || m[4]); return { n: planSize && v === planSize ? n : v }; }
  if (/לכל זוג/.test(text)) return { n: Math.ceil(n / 2) };
  if (/לכל קבוצה/.test(text)) return { n: state.groups || 5 };
  if (/לכל ילד|משוכפל|לכל תלמיד/.test(text)) return { n };
  return { n, guess: true };
}
function copyList(w, dow) {
  const day = w.days.find(d => d.dow === dow); if (!day) return [];
  const n = classSize(w), seen = new Set(), out = [];
  const add = (text, where) => {
    if (!/שכפול|משוכפל|לשכפל|×\s*\d|\d+\s*×|\(\d{2}\)/.test(text) || /^[א-ו]\s*[–-]\s*שכפול/.test(text)) return;
    const name = text.replace(/\s*[–-]\s*(שכפול|משוכפל).*$/, '').replace(/\s*\(\d+\)\s*$/, '').replace(/\s*×\s*\d+.*$/, '').trim();
    const key = name.replace(/["'״׳\s]/g, ''); if (!key || seen.has(key)) return; seen.add(key);
    out.push({ name, where, ...copyQty(text, n, w.classSize), two: /דו-?צדדי/.test(text) });
  };
  for (const p of day.periods) for (const m of p.materials) add(m.text, p.title);
  for (const sc of w.prep[dow] || []) for (const it of sc.items) add(it.text, it.period ? 'שעה ' + it.period : '');
  return out;
}
function printSheet(w, dow, si, i) {
  const it = w.prep[dow][si].items[i];
  const day = w.days.find(d => d.dow === dow);
  const copy = /שכפול/.test(it.text);
  const id = driveId(it.url);
  const direct = id ? `https://drive.google.com/uc?export=download&id=${id}` : it.url;
  const list = copy ? copyList(w, dow) : [];
  const k = `p:${dow}:${w.prep[dow][si].title}:${i}`;
  state._print = { title: it.text, url: it.url, k };
  openOverlay(`<div class="ov printsheet">
    <button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic(copy ? 'layers' : 'printer')}<h2>${esc(it.text)}</h2></div>
    <p class="dim">${copy ? 'קובץ למכונת השכפול' : 'קובץ למדפסת'} · יום ${esc(day ? day.name : '')}</p>
    ${copy ? `<div class="card copies">
      ${cardHead('layers', 'כמה לשכפל', `<button class="cnt" data-go="settings">${classSize(w)} תלמידים ✎</button>`)}
      ${list.length ? list.map(c => `<div class="crow"><span class="grow"><b>${esc(c.name)}</b><small>${esc(c.where || '')}${c.two ? ' · דו־צדדי' : ''}</small></span><span class="qty ${c.guess ? 'guess' : ''}">${c.label ? esc(c.label) : '×' + c.n}</span></div>`).join('')
        : `<div class="crow"><span class="grow"><b>כל הדפים בקובץ</b><small>לפי הכיתה</small></span><span class="qty">×${classSize(w)}</span></div>`}
      <p class="hint">לפי ${classSize(w)} תלמידים שהגדרת באפליקציה${list.some(c => c.guess) ? ' · כמות באפור = לא צוינה בתכנון' : ''}</p>
    </div>` : ''}
    <div class="menu">
      <a class="mbtn" href="${esc(direct)}" target="_blank" rel="noopener">${ic('printer')} פתיחה להדפסה</a>
      <button data-act="pshare" id="pshareBtn" class="${id ? 'loading' : ''}">${ic('upload')} ${id ? 'מכינה את הקובץ לשיתוף…' : 'שיתוף קישור'}</button>
      <a class="mbtn" href="${esc(it.url)}" target="_blank" rel="noopener">${ic('folder')} פתיחה בדרייב</a>
      <button data-act="pcopylink">${ic('link')} העתקת קישור</button>
      <button data-act="pdone">${ic('check')} ${ck(w, k) ? 'בוטל הסימון' : 'סימון שהודפס'}</button>
    </div>
    <p class="hint">בחלון שנפתח: כפתור השיתוף ← "הדפסה"</p>
  </div>`);
  if (copy && navigator.vibrate) navigator.vibrate(10);
  if (id) {
    state._print.loading = true;
    printFile(it, id).then(f => {
      const P = state._print; if (!P || P.k !== k) return;
      P.loading = false; P.file = f;
      const b = $('#pshareBtn'); if (!b) return;
      b.classList.remove('loading');
      b.innerHTML = f ? `${ic('upload')} שיתוף הקובץ עצמו (${(f.name.split('.').pop() || 'pdf').toUpperCase()})` : `${ic('link')} שיתוף קישור`;
      if (!f) b.insertAdjacentHTML('afterend', '<p class="hint">כדי לשתף את הקובץ עצמו: בדרייב ← שיתוף ← "כל מי שיש לו את הקישור"</p>');
    });
  }
}
// download a Drive/Docs file through /api/drive (cached on the phone) so it can be shared as a real file
async function printFile(it, id) {
  const key = 'drv:' + id;
  try {
    let rec = await getBlob(key).catch(() => null);
    if (!rec) {
      const r = await fetch('/api/drive?u=' + encodeURIComponent(it.url));
      if (!r.ok) return null;
      const blob = await r.blob();
      let name = decodeURIComponent(r.headers.get('x-file-name') || '') || it.text.replace(/[\\/:*?"<>|]/g, '').trim();
      if (!/\.[a-z0-9]{2,5}$/i.test(name)) name += blob.type === 'application/pdf' ? '.pdf' : '';
      rec = { blob, name };
      putBlob(key, rec).catch(() => {});
    }
    return new File([rec.blob], rec.name, { type: rec.blob.type || 'application/pdf' });
  } catch { return null; }
}

// ================================================================ account & sync (Netlify Identity + Blobs)
const sync = { user: null, ready: false, pulled: false, pending: false, busy: false, last: null, err: '', t: null };
const snapshot = () => { const o = {}; for (const k of SAVED) o[k] = state[k]; return o; };
async function api(method, body) {
  try { await ID.refreshSession(); } catch { /* token still fine or offline */ }
  const r = await fetch('/api/sync', { method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) throw new Error('auth');
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}
function schedulePush() {
  if (!sync.user) return;
  sync.pending = true; clearTimeout(sync.t);
  if (sync.pulled) sync.t = setTimeout(push, 1500);
}
async function push() {
  if (!sync.user || sync.busy) return;
  sync.busy = true; sync.pending = false;
  try { const r = await api('PUT', { patch: snapshot() }); state.syncV = r.v; saveLocal(); sync.last = new Date(); sync.err = ''; }
  catch (e) { sync.pending = true; sync.err = e.message; }
  sync.busy = false; syncBadge();
}
async function pull(first) {
  if (!sync.user) return;
  try {
    const rec = await api('GET');
    if (!rec.v) { sync.pulled = true; await push(); return; }
    if (first && !state.syncV) {
      // first login on this device: keep what's here and add what's in the cloud
      for (const k of ['weeks', 'checks', 'logs', 'pins']) state[k] = Object.assign({}, state[k], rec.data[k] || {});
      for (const k of ['kids', 'todos']) if (rec.data[k] && rec.data[k].length) state[k] = rec.data[k];
      const ids = new Set(state.files.map(f => f.id)); state.files = state.files.concat((rec.data.files || []).filter(f => !ids.has(f.id)));
      for (const k of ['name', 'prefs', 'groups', 'picked']) if (rec.data[k] != null) state[k] = rec.data[k];
      state.syncV = rec.v; saveLocal(); sync.pulled = true; await push(); return;
    }
    if (rec.v > (state.syncV || 0) && !sync.pending) {
      for (const k of SAVED) if (rec.data[k] !== undefined) state[k] = rec.data[k];
      state.syncV = rec.v; saveLocal(); applyPrefs();
    }
    sync.pulled = true; sync.last = new Date(); sync.err = '';
    if (sync.pending) push();
    state.files.filter(f => !f.cloud).forEach(f => uploadCloud(f));
  } catch (e) { sync.err = e.message; }
  syncBadge();
}
function syncBadge() {
  const el = $('#syncState'); if (!el) return;
  el.innerHTML = syncText();
}
function syncText() {
  if (!sync.user) return '';
  if (sync.busy) return `${ic('upload')} מסנכרנת…`;
  if (sync.err === 'auth') return `${ic('x')} צריך להתחבר מחדש`;
  if (sync.err) return `${ic('clock')} אין חיבור – אסנכרן כשיחזור`;
  if (sync.pending) return `${ic('clock')} ממתין לסנכרון`;
  return `${ic('check')} מסונכרן${sync.last ? ' · ' + sync.last.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : ''}`;
}
function authError(e) {
  const m = String(e && (e.message || e));
  if (/MissingIdentity|404|not enabled|identity/i.test(m) && !/password|credentials/i.test(m)) return 'החשבונות עוד לא מופעלים באתר (צריך להפעיל Identity בנטליפיי)';
  if (/invalid_grant|credentials|password/i.test(m)) return 'המייל או הסיסמה לא נכונים';
  if (/confirm/i.test(m)) return 'צריך קודם לאשר את המייל – חפשי מייל מ־Netlify';
  if (/401|denied|signup/i.test(m)) return 'כבר יש חשבון באפליקציה הזו – רק הבעלים יכולה להיכנס';
  if (/already/i.test(m)) return 'כבר יש חשבון עם המייל הזה – אפשר להתחבר';
  if (/fetch|network/i.test(m)) return 'אין אינטרנט כרגע';
  return 'משהו השתבש: ' + m;
}
async function initAuth() {
  try {
    const cb = await ID.handleAuthCallback();
    if (cb && cb.type === 'recovery') setTimeout(recoveryScreen, 300);
    if (cb && cb.type === 'confirmation') toast('המייל אושר – את מחוברת 💜');
  } catch (e) { toast('הקישור לא תקין או שפג תוקפו 😕'); }
  try { sync.user = await ID.getUser(); } catch { sync.user = null; }
  sync.ready = true;
  pushState().then(() => { if (state.tab === 'autos') rerender(); });
  if (sync.user) { await pull(true); rerender(); } else if (state.tab === 'settings') rerender();
}
function accountCard() {
  if (!sync.ready) return `<div class="card">${cardHead('cloud', 'חשבון וסנכרון')}<p class="dim">בודקת…</p></div>`;
  if (sync.user) return `<div class="card acct">
    ${cardHead('cloud', 'חשבון וסנכרון')}
    <div class="acct-u"><span class="av">${esc((sync.user.email || '?')[0].toUpperCase())}</span><span class="grow"><b dir="ltr">${esc(sync.user.email || '')}</b><small id="syncState">${syncText()}</small></span></div>
    <p class="dim">כל מה שאת עושה נשמר בחשבון ומופיע בכל מכשיר שתתחברי ממנו.</p>
    <button class="cta soft" data-act="syncnow">${ic('upload')} סנכרון עכשיו</button>
    <button class="logoutbtn" data-act="logout">${ic('user')} התנתקות מהחשבון</button>
  </div>`;
  return `<div class="card acct">
    ${cardHead('cloud', 'חשבון וסנכרון')}
    <p class="dim">מתחברים עם מייל וסיסמה – והתכנון, הסימונים והתזכורות יופיעו בכל המכשירים.</p>
    <form data-auth>
      <label class="field">מייל<input name="email" type="email" autocomplete="email" dir="ltr" required></label>
      <label class="field">סיסמה<input name="password" type="password" autocomplete="current-password" dir="ltr" minlength="6" required></label>
      <p class="autherr" id="authErr"></p>
      <div class="btnrow"><button class="cta" name="go" value="login">התחברות</button><button class="cta soft" name="go" value="signup">יצירת חשבון</button></div>
      <button type="button" class="linkbtn forgot" data-act="forgot">שכחתי סיסמה</button>
    </form>
  </div>`;
}
function recoveryScreen() {
  openOverlay(`<form class="ov" data-newpass>
    <button type="button" class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('cloud')}<h2>סיסמה חדשה</h2></div>
    <label class="field">סיסמה חדשה<input name="password" type="password" minlength="6" autocomplete="new-password" dir="ltr" required></label>
    <button class="cta">${ic('check')} שמירה</button>
  </form>`);
}

// ================================================================ class journal (notes during lessons)
const TAGS = {
  care: ['👤', 'לטיפול', '#F6C28B'], parent: ['📞', 'להתקשר להורה', '#9DD6F9'], star: ['⭐', 'הצטיינות', '#F6D38A'],
  disrupt: ['⚠️', 'הפרעה', '#F6B7CF'], note: ['📝', 'הערה', '#D4B7F5'],
};
const ACTION = ['care', 'parent'];
const TAG_IC = { care: 'user', parent: 'phone2', star: 'star', disrupt: 'warn', note: 'pencil' };
const tagMark = k => `<span class="qe">${(TAGS[k] || TAGS.note)[0]}</span>${ic(TAG_IC[k] || 'pencil', 'qi')}`;
const notesFor = (w, dow, label) => state.cnotes.filter(n => n.w === w.id && n.dow === dow && n.label === label);
const openActions = () => state.cnotes.filter(n => ACTION.includes(n.tag) && !n.done);
function noteRow(n, withLesson) {
  const [e, t, c] = TAGS[n.tag] || TAGS.note;
  const L = withLesson && n.w && state.weeks[n.w] ? findPeriodIn(state.weeks[n.w], n.dow, n.label) : null;
  const when = new Date(n.at);
  return `<div class="nrow ${n.done ? 'done' : ''}" style="--c:${c}">
    ${ACTION.includes(n.tag) ? `<button class="nchk ${n.done ? 'on' : ''}" data-cdone="${n.id}" aria-label="טופל">${ic('check')}</button>` : `<span class="nemo">${tagMark(n.tag)}</span>`}
    <span class="grow"><b>${ACTION.includes(n.tag) ? e + ' ' : ''}${esc(n.kids.join(', ') || t)}</b>${n.text ? `<span>${esc(n.text)}</span>` : ''}
      <small>${t}${L ? ' · ' + esc(L.title) : ''} · ${when.getDate()}.${when.getMonth() + 1} ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}</small></span>
    ${withLesson ? `<button class="iconbtn" data-cdel="${n.id}" aria-label="מחיקה">${ic('trash')}</button>` : ''}
  </div>`;
}
function lessonNotes(w, day, p) {
  const ns = notesFor(w, day.dow, p.label);
  return `<div class="sub lnotes">${cardHead('pencil', 'הערות בשיעור', ns.length ? `<span class="cnt">${ns.length}</span>` : '')}
    ${ns.map(n => noteRow(n)).join('')}
    <div class="qtags">${Object.entries(TAGS).map(([k, [e, t]]) => `<button data-cnote="${esc(day.dow + '|' + p.label)}" data-tag="${k}" title="${t}">${tagMark(k)}<small>${t}</small></button>`).join('')}</div>
  </div>`;
}
function noteSheet(ref, tag) {
  const kids = state.kids.map(k => k.name);
  state._note = { ref, tag, kids: [] };
  openOverlay(`<form class="ov sheet notesheet" data-noteform>
    <button type="button" class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('pencil')}<h2>הערה מהירה</h2></div>
    <div class="tagpick">${Object.entries(TAGS).map(([k, [e, t, c]]) => `<button type="button" class="tp ${k === tag ? 'on' : ''}" style="--c:${c}" data-picktag="${k}">${tagMark(k)}<small>${t}</small></button>`).join('')}</div>
    ${kids.length ? `<div class="mh">על מי? (אפשר כמה)</div><div class="kchips">${kids.map(n => `<button type="button" class="kc pick" data-pickkid="${esc(n)}">${esc(n)}</button>`).join('')}</div>`
      : `<label class="field">על מי?<input name="who" placeholder="שם הילד/ה (לא חובה)"></label>`}
    <label class="field">מה קרה? (לא חובה)<textarea name="text" rows="2" placeholder="למשל: עזר לחבר בלי שביקשו ממנו"></textarea></label>
    <div class="btnrow"><button class="cta">${ic('check')} שמירה</button></div>
  </form>`);
}
function saveNote(f) {
  const N = state._note; if (!N) return;
  const kids = N.kids.length ? N.kids : (f.who && f.who.value.trim() ? [f.who.value.trim()] : []);
  const text = f.text.value.trim();
  if (!kids.length && !text) { toast('כתבי על מי או מה קרה 🙂'); return; }
  const w = pickWeek();
  const [dow, label] = N.ref ? N.ref.split('|') : [null, null];
  state.cnotes.push({ id: uid(), w: N.ref ? w.id : null, dow: N.ref ? +dow : null, label: label || null, tag: N.tag, kids, text, at: new Date().toISOString(), done: false });
  save(); closeOverlay(); rerender();
  toast(N.tag === 'star' ? 'נשמר ⭐ איזה כיף!' : 'נשמר ✓');
  if (N.tag === 'star') confetti();
}
function viewJournal() {
  const f = state.jfilter || '';
  const list = state.cnotes.filter(n => !f || (f === 'open' ? ACTION.includes(n.tag) && !n.done : n.tag === f)).sort((a, b) => (a.at < b.at ? 1 : -1));
  const byKid = {};
  for (const n of state.cnotes) for (const k of n.kids) { byKid[k] = byKid[k] || { star: 0, disrupt: 0 }; if (n.tag === 'star') byKid[k].star++; if (n.tag === 'disrupt') byKid[k].disrupt++; }
  const kidsRows = Object.entries(byKid).filter(([, v]) => v.star || v.disrupt).sort((a, b) => b[1].star - a[1].star);
  return top('יומן כיתה', 'כל מה שרשמת בשיעורים – במקום אחד', 'notepad', { back: 'cls' }) + `
  <button class="cta" data-cnote="" data-tag="note">${ic('plus')} הערה חדשה</button>
  <div class="fchips">${[['', 'הכל'], ['open', `לטיפול (${openActions().length})`], ...Object.entries(TAGS).map(([k, [e, t]]) => [k, e + ' ' + t])].map(([k, t]) => `<button class="fc ${f === k ? 'on' : ''}" data-jf="${k}">${t}</button>`).join('')}</div>
  <div class="card">${list.length ? list.map(n => noteRow(n, true)).join('') : '<p class="dim">עוד אין הערות. בכל שיעור יש כפתורים מהירים: 👤 📞 ⭐ ⚠️ 📝</p>'}</div>
  ${kidsRows.length ? `<div class="card">${cardHead('users', 'לפי ילד/ה')}${kidsRows.map(([k, v]) => `<div class="row"><span class="grow">${esc(k)}</span>${v.star ? `<span class="tpill">⭐ ${v.star}</span>` : ''}${v.disrupt ? `<span class="tpill warn">⚠️ ${v.disrupt}</span>` : ''}</div>`).join('')}</div>` : ''}`;
}
// "עכשיו": one tidy list – parents to call, children to follow up, my reminders – short, with a "more" link
function todayList(folded) {
  const acts = openActions(), todos = state.todos.filter(t => todoDue(t) && !t.done);
  if (folded && !state._tlOpen) { const n = acts.length + todos.length; return n ? `<div class="card fold1"><button class="pnh" data-act="tlopen"><b>${ic('pin')} לא לשכוח</b><span class="cnt">${n}</span>${ic('chevD', 'chev')}</button></div>` : ''; }
  const rows = [
    ...acts.map(n => { const [e, t] = TAGS[n.tag] || TAGS.note; return `<div class="tlrow"><button class="tlchk" data-cdone="${n.id}" aria-label="טופל">${ic('check')}</button><span class="grow"><b>${e} ${esc(n.kids.join(', ') || t)}</b>${n.text ? ` <span>– ${esc(n.text)}</span>` : ''}</span></div>`; }),
    ...todos.map(t => `<div class="tlrow"><label class="tlchk"><input type="checkbox" data-todo="${t.id}"><span>${ic('check')}</span></label><span class="grow"><b>📌 ${esc(t.text)}</b>${t.date ? ` <small class="tpill">${esc(fmtDate(t.date))}</small>` : ''}</span></div>`),
  ];
  const more = rows.length - 5;
  const add = state._addTodo
    ? `<form class="addtodo" data-addtodo><input name="t" placeholder="מה לא לשכוח?" autocomplete="off" autofocus><button aria-label="הוספה">${ic('plus')}</button></form>`
    : `<button class="tladd" data-act="addtodo">${ic('plus')} תזכורת</button>`;
  if (!rows.length) return `<div class="card tlist empty">${cardHead('pin', 'לא לשכוח', add)}<p class="dim">אין כרגע משהו פתוח ✓</p>${state._addTodo ? '' : ''}</div>`;
  return `<div class="card tlist">${cardHead('pin', 'לא לשכוח', `<span class="cnt">${rows.length}</span>`)}
    ${rows.slice(0, 5).join('')}
    ${more > 0 ? `<button class="linkbtn tlmore" data-go="todos">ועוד ${more} ←</button>` : ''}
    <div class="tlfoot">${add}${acts.length ? `<button class="linkbtn" data-go="journal">יומן כיתה</button>` : ''}</div>
  </div>`;
}
// notes that came with the weekly plan – folded, one line each, open on tap
function planNotes(w) {
  const ns = (w && w.notes || []).filter(n => n.text);
  if (!ns.length) return '';
  state.noteOpen = state.noteOpen || {};
  return `<div class="card pnotes">${cardHead('book', 'מהתכנון השבועי')}${ns.map((n, i) => {
    const items = String(n.text).split(/\s·\s/).map(x => x.trim()).filter(Boolean), open = state.noteOpen[i];
    return `<div class="pn ${open ? 'open' : ''}"><button class="pnh" data-pnote="${i}"><b>${esc(n.label)}</b><span class="cnt">${items.length}</span>${ic('chevD', 'chev')}</button>${open ? `<ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
  }).join('')}</div>`;
}
function actionsCard() {
  const a = openActions();
  if (!a.length) return '';
  return `<div class="card acts">${cardHead('bell', 'לטיפול', `<button class="linkbtn" data-go="journal">יומן כיתה</button>`)}${a.slice(0, 6).map(n => noteRow(n)).join('')}</div>`;
}

// ================================================================ my checklists
const LIST_TEMPLATES = [
  ['🚌', 'טיול שנתי', ['אישורי הורים', 'רשימת טלפונים', 'ערכת עזרה ראשונה', 'מים לכל ילד', 'כובעים', 'שקיות זבל', 'תיק מורה']],
  ['👨‍👩‍👧', 'אסיפת הורים', ['לוח זמנים לכל הורה', 'תיקי עבודות', 'דפי משוב', 'כיבוד', 'רשימת נושאים לכל ילד']],
  ['🎂', 'יום הולדת בכיתה', ['כתר', 'כיסא מקושט', 'ברכה מהכיתה', 'שיר', 'תמונה']],
  ['📅', 'סוף שבוע', ['לעדכן את התכנון לשבוע הבא', 'לבדוק מחברות', 'להעלות ציונים', 'לשלוח הודעה להורים']],
];
function viewLists() {
  const edit = state.listEdit;
  return top('הרשימות שלי', 'צ׳ק ליסטים לכל מה שצריך', 'notepad', { back: 'more' }) + `
  ${state.lists.map(L => {
    const done = L.items.filter(i => i.done).length;
    return `<div class="card clist">
      <div class="ch"><span class="chi">${esc(L.emoji || '✅')}</span><h3>${edit === L.id ? `<input class="ltitle" data-ltitle="${L.id}" value="${esc(L.title)}">` : esc(L.title)}</h3>
        <span class="chr"><span class="cnt ${done === L.items.length && done ? 'all' : ''}">${done}/${L.items.length}</span><button class="iconbtn" data-ledit="${L.id}" aria-label="עריכה">${ic(edit === L.id ? 'check' : 'pencil')}</button></span></div>
      ${L.items.map(it => edit === L.id
        ? `<div class="erow1"><input class="litem" data-litem="${L.id}|${it.id}" value="${esc(it.text)}"><button class="iconbtn" data-ldelitem="${L.id}|${it.id}" aria-label="מחיקה">${ic('trash')}</button></div>`
        : `<label class="chk ${it.done ? 'on' : ''}"><input type="checkbox" data-lcheck="${L.id}|${it.id}" ${it.done ? 'checked' : ''}><span class="box">${ic('check')}</span><span class="ct">${esc(it.text)}</span></label>`).join('')}
      <form class="addtodo" data-ladd="${L.id}"><input name="t" placeholder="פריט חדש…" autocomplete="off"><button aria-label="הוספה">${ic('plus')}</button></form>
      ${edit === L.id ? `<div class="btnrow"><button class="cta soft" data-lreset="${L.id}">איפוס הסימונים</button><button class="danger" data-ldel="${L.id}">${ic('trash')} מחיקת הרשימה</button></div>` : ''}
    </div>`;
  }).join('')}
  <div class="card">${cardHead('plus', 'רשימה חדשה')}
    <form class="addtodo" data-lnew><input name="t" placeholder="שם הרשימה…" autocomplete="off"><button aria-label="יצירה">${ic('plus')}</button></form>
    <div class="mh">או להתחיל מתבנית:</div>
    <div class="kchips">${LIST_TEMPLATES.map(([e, t], i) => `<button class="kc" data-ltpl="${i}">${e} ${t}</button>`).join('')}</div>
  </div>`;
}

// ================================================================ automations & push notifications
const VAPID_PUBLIC = 'BBJadMQeMGYyIh3XJ08YUWx3zMzFaOtJ5jtLhYfxqLY0NoQQzlnhNooUzoEwK4sLnMa-FaFfYbdFTZrKuOQwgqo';
const AUTO_DEFAULTS = [
  { id: 'morning', kind: 'morning', on: true, time: '07:00' },
  { id: 'evening', kind: 'evening', on: false, time: '20:00' },
  { id: 'before', kind: 'before', on: false, mins: 10 },
  { id: 'actions', kind: 'actions', on: true, time: '15:00' },
  { id: 'upload', kind: 'weekly', on: true, day: 4, time: '19:00', text: 'להעלות את התכנון של השבוע הבא 📄' },
  { id: 'pmweek', kind: 'pmweek', on: true, day: 5, time: '12:00' },
  { id: 'events', kind: 'events', on: true, time: '19:30' },
];
const AUTO_INFO = {
  morning: ['sun', 'בוקר טוב', 'כל בוקר לימודים: מה להדפיס, מה להביא, השיעור הראשון וימי הולדת'],
  evening: ['moon', 'סיכום ערב', 'בערב שלפני יום לימודים: מה מחכה מחר'],
  before: ['timer', 'לפני שיעור', 'לפני כל שיעור שצריך בו משהו – מה להכין'],
  actions: ['bell', 'לטיפול', 'בסוף היום: הורים להתקשר אליהם ותלמידים לטיפול'],
  weekly: ['calendar', 'תזכורת שבועית', ''],
  events: ['calendar', 'אירועים מחר', 'ערב לפני מבדק, טיול, חג או אירוע שהוספת ללוח'],
  pmweek: ['phone2', 'עדכון להורים', 'תזכורת לשלוח את העדכון השבועי – לוחצים וההודעה מוכנה'],
  once: ['pin', 'תזכורת חד־פעמית', ''],
};
function autos() {
  if (!state.autos || !state.autos.length) state.autos = AUTO_DEFAULTS.map(a => ({ ...a }));
  if (!state.autos.some(a => a.kind === 'events')) state.autos.push({ ...AUTO_DEFAULTS.find(a => a.kind === 'events') });
  if (!state.autos.some(a => a.kind === 'pmweek')) state.autos.push({ ...AUTO_DEFAULTS.find(a => a.kind === 'pmweek') });
  return state.autos;
}
function atTime(date, hhmm) { const [h, m] = hhmm.split(':').map(Number); const d = new Date(date); d.setHours(h, m, 0, 0); return d; }
function buildQueue() {
  const out = [], t0 = Date.now(), end = t0 + 8 * 864e5;
  const days = [];
  for (const w of sortedWeeks()) for (const d of w.days) { const dd = dayDate(w, d); if (dd && d.periods.length) days.push({ w, d, dd }); }
  const add = (at, title, body, tag, url) => { if (at.getTime() > t0 && at.getTime() < end) out.push({ at: at.getTime(), title, body, tag, ...(url ? { url } : {}) }); };
  const sec = (w, d, re) => ((w.prep[d.dow] || []).find(s => re.test(s.title)) || { items: [] }).items.map(i => i.text.split('–')[0].trim());
  for (const a of autos()) {
    if (!a.on) continue;
    if (a.kind === 'morning') for (const { w, d, dd } of days) {
      const lines = [];
      const bd = bdOn(dd); if (bd.length) lines.push(state.prefs.notifNames ? `🎂 יום הולדת ל${names(bd)}!` : `🎂 ${bd.length > 1 ? bd.length + ' ימי הולדת' : 'יום הולדת'} בכיתה היום`);
      lines.push(`📅 ${d.periods[0].start} · ${d.periods[0].title}`);
      const pr = sec(w, d, /ערב|הדפסה/), br = sec(w, d, /להכין|להביא/);
      if (pr.length) lines.push(`🖨 להדפיס: ${pr.join(' · ')}`);
      if (br.length) lines.push(`🎒 להביא: ${br.slice(0, 4).join(' · ')}${br.length > 4 ? ` ועוד ${br.length - 4}` : ''}`);
      const td = state.todos.filter(x => !x.done && x.date && sameDay(new Date(x.date + 'T00:00'), dd)); if (td.length) lines.push(`📌 ${td.map(x => x.text).join(' · ')}`);
      add(atTime(dd, a.time), `בוקר טוב ${state.name} ☀️ יום ${d.name}`, lines.join('\n'), 'morning');
    }
    if (a.kind === 'evening') for (const { w, d, dd } of days) {
      const br = sec(w, d, /להכין|להביא/);
      add(atTime(addDays(dd, -1), a.time), `מחר יום ${d.name} 🌙`, `${d.periods.length} שיעורים, מתחילים ב־${d.periods[0].start} (${d.periods[0].title})${br.length ? `\n🎒 להביא: ${br.slice(0, 3).join(' · ')}` : ''}`, 'evening');
    }
    if (a.kind === 'before') for (const { d, dd } of days) for (const p of d.periods) {
      if (!p.materials.length || !p.start) continue;
      add(new Date(atTime(dd, p.start).getTime() - (a.mins || 10) * 60000), `בעוד ${a.mins} דק׳: ${p.title}`, `להכין: ${p.materials.map(m => m.text.split('–')[0].trim()).slice(0, 4).join(' · ')}`, 'before');
    }
    if (a.kind === 'actions') for (const { dd } of days) {
      if (dd < new Date(new Date().toDateString())) continue;
      const o = openActions(); if (!o.length) continue;
      const par = o.filter(n => n.tag === 'parent'), care = o.filter(n => n.tag === 'care');
      const nm = !!state.prefs.notifNames;
      add(atTime(dd, a.time), 'לטיפול היום 📞', [par.length ? `📞 להתקשר: ${nm ? par.map(n => n.kids.join(', ') || n.text).join(' · ') : par.length + ' הורים'}` : '', care.length ? `👤 לטיפול: ${nm ? care.map(n => n.kids.join(', ') || n.text).join(' · ') : care.length + ' תלמידים'}` : ''].filter(Boolean).join('\n'), 'actions');
    }
    if (a.kind === 'weekly') for (let i = 0; i < 8; i++) { const d = addDays(new Date(), i); if (d.getDay() === +a.day) add(atTime(d, a.time), 'תזכורת 💜', a.text || '', 'weekly-' + a.id); }
    if (a.kind === 'events') { const by = new Map(); for (const ev of allEvents(9)) if (ev.kind !== 'bday' && ev.kind !== 'todo') { const k = ev.d.toDateString(); by.set(k, [...(by.get(k) || []), ev]); } for (const [, evs] of by) add(atTime(addDays(evs[0].d, -1), a.time), 'מחר 📅', evs.map(x => `${x.icon} ${x.text}`).join('\n'), 'events'); }
    if (a.kind === 'pmweek') for (let i = 0; i < 8; i++) { const d = addDays(new Date(), i); if (d.getDay() === +a.day) add(atTime(d, a.time), 'הודעה להורים 💌', 'העדכון השבועי מוכן – לוחצים, בודקים ושולחים', 'pmweek', './?go=msgs'); }
    if (a.kind === 'once' && a.date) add(atTime(new Date(a.date + 'T00:00'), a.time || '08:00'), 'תזכורת 💜', a.text || '', 'once-' + a.id);
  }
  return out.sort((x, y) => x.at - y.at).slice(0, 300);
}
const wpush = { supported: 'serviceWorker' in navigator && 'PushManager' in window, sub: null, checked: false };
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
async function pushState() {
  if (!wpush.supported) return;
  try { const reg = await navigator.serviceWorker.ready; wpush.sub = await reg.pushManager.getSubscription(); } catch { wpush.sub = null; }
  wpush.checked = true;
}
function b64u(s) { const p = '='.repeat((4 - s.length % 4) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); }
async function pushApi(body) {
  try { await ID.refreshSession(); } catch { /* fine */ }
  const r = await fetch('/api/push', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('push ' + r.status);
  return r.json();
}
async function enablePush() {
  if (!sync.user) { toast('קודם מתחברים לחשבון (בהגדרות) ☁️', 3500); go('settings'); return; }
  if (!wpush.supported) { toast(standalone() ? 'הטלפון הזה לא תומך בהתראות 😕' : 'כדי לקבל התראות צריך לפתוח את האפליקציה ממסך הבית 📱', 4000); return; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('ההתראות לא אושרו. אפשר לאשר בהגדרות הטלפון ← הכיתה שלי ← עדכונים', 4500); return; }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(VAPID_PUBLIC) });
    await pushApi({ action: 'subscribe', sub: sub.toJSON() });
    wpush.sub = sub; state.notifQueue = buildQueue(); save();
    toast('ההתראות הופעלו 🔔'); rerender();
  } catch (e) { console.error(e); toast('לא הצלחתי להפעיל התראות 😕'); }
}
async function disablePush() {
  try { if (wpush.sub) { await pushApi({ action: 'unsubscribe', endpoint: wpush.sub.endpoint }).catch(() => {}); await wpush.sub.unsubscribe(); } } catch { /* fine */ }
  wpush.sub = null; toast('ההתראות כובו בטלפון הזה'); rerender();
}
function viewAutos() {
  const A = autos();
  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const status = !wpush.checked ? '' : wpush.sub
    ? `<div class="pstat on">${ic('bell')}<span class="grow"><b>ההתראות פעילות בטלפון הזה</b><small>${buildQueue().length} תזכורות מתוזמנות ל־8 הימים הקרובים</small></span></div>
       <div class="btnrow"><button class="cta soft" data-act="pushtest">שליחת התראת בדיקה</button><button class="cta soft" data-act="pushoff">כיבוי</button></div>`
    : `<div class="pstat">${ic('bell')}<span class="grow"><b>ההתראות עוד לא מופעלות בטלפון הזה</b><small>${!sync.user ? 'צריך קודם להתחבר לחשבון' : !standalone() ? 'צריך לפתוח את האפליקציה ממסך הבית' : 'לחיצה אחת – והאייפון ישאל אם לאשר'}</small></span></div>
       <button class="cta" data-act="pushon">${ic('bell')} הפעלת התראות</button>`;
  const row = a => {
    const [icon, title, desc] = AUTO_INFO[a.kind];
    const ctl = a.kind === 'before'
      ? `<select data-auto="${a.id}" data-f="mins">${[5, 10, 15, 20, 30].map(m => `<option ${a.mins === m ? 'selected' : ''} value="${m}">${m} דק׳ לפני</option>`).join('')}</select>`
      : a.kind === 'events' ? `<input type="time" data-auto="${a.id}" data-f="time" value="${esc(a.time)}">`
      : a.kind === 'weekly' || a.kind === 'pmweek' ? `<select data-auto="${a.id}" data-f="day">${DAYS.map((d, i) => `<option value="${i}" ${+a.day === i ? 'selected' : ''}>יום ${d}</option>`).join('')}</select><input type="time" data-auto="${a.id}" data-f="time" value="${esc(a.time)}">`
      : a.kind === 'once' ? `<input type="date" data-auto="${a.id}" data-f="date" value="${esc(a.date || '')}"><input type="time" data-auto="${a.id}" data-f="time" value="${esc(a.time || '08:00')}">`
      : `<input type="time" data-auto="${a.id}" data-f="time" value="${esc(a.time)}">`;
    return `<div class="card auto ${a.on ? '' : 'off'}">
      <div class="ch"><span class="chi">${ic(icon)}</span><h3>${a.text && (a.kind === 'weekly' || a.kind === 'once') ? esc(a.text) : title}</h3>
        <button class="switch ${a.on ? 'on' : ''}" data-autoon="${a.id}" role="switch" aria-checked="${a.on}"><i></i></button></div>
      ${desc ? `<p class="dim">${desc}</p>` : `<p class="dim">${title}</p>`}
      <div class="actl">${ctl}${a.kind === 'weekly' || a.kind === 'once' ? `<button class="iconbtn" data-autodel="${a.id}" aria-label="מחיקה">${ic('trash')}</button>` : ''}</div>
    </div>`;
  };
  return top('אוטומציות', 'מתי ועל מה לקבל התראה', 'star', { back: 'more' }) + `
  <div class="card">${status}</div>
  ${A.map(row).join('')}
  <div class="card">${cardHead('plus', 'תזכורת חדשה')}
    <form data-autonew class="autonew" data-kind="weekly">
      <label class="field">מה להזכיר?<input name="text" required placeholder="למשל: לבדוק מחברות חשבון"></label>
      <div class="seg kindseg"><label><input type="radio" name="kind" value="weekly" checked><span>${ic('calendar')}כל שבוע</span></label><label><input type="radio" name="kind" value="once"><span>${ic('pin')}פעם אחת</span></label></div>
      <div class="an-grid">
        <label class="field an-week">באיזה יום<select name="day">${DAYS.map((d, i) => `<option value="${i}">יום ${d}</option>`).join('')}</select></label>
        <label class="field an-once">תאריך<input type="date" name="date" value="${isoDay(now())}"></label>
        <label class="field">שעה<input type="time" name="time" value="16:00"></label>
      </div>
      <button class="cta">${ic('plus')} הוספת תזכורת</button>
    </form>
  </div>
  <p class="hint">ההתראות נשלחות גם כשהאפליקציה סגורה. כל טלפון צריך להפעיל אותן פעם אחת.</p>`;
}

// ================================================================ joy: morning welcome, ready moment, streak
const HE_MONTHS = ['בינואר', 'בפברואר', 'במרץ', 'באפריל', 'במאי', 'ביוני', 'ביולי', 'באוגוסט', 'בספטמבר', 'באוקטובר', 'בנובמבר', 'בדצמבר'];
const dateKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
let lastHidden = 0;
const ALL_QUOTES = () => QUOTES;
function pickQuote() {
  const all = ALL_QUOTES();
  let last = -1; try { last = +localStorage.getItem('hk-q'); } catch { /* fine */ }
  let i = Math.floor(Math.random() * all.length);
  if (i === last) i = (i + 1 + Math.floor(Math.random() * (all.length - 1))) % all.length;
  try { localStorage.setItem('hk-q', i); } catch { /* fine */ }
  return all[i];
}
function welcome(force) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches && $('#welcome')) return;
  const tk = dateKey(now());
  if (!force && !new URLSearchParams(location.search).has('welcome')) {
    let seen = ''; try { seen = localStorage.getItem('hk-wl') || ''; } catch { /* fine */ }
    const w0 = realWeek(), d0 = w0 && todayInWeek(w0), ph0 = d0 && phase(d0);
    const inSchool = ph0 && (ph0.kind === 'lesson' || ph0.kind === 'break');
    if (seen === tk || inSchool || !state.onboarded) return;
  }
  try { localStorage.setItem('hk-wl', tk); } catch { /* fine */ }
  const old = $('#welcome'); if (old) old.remove();
  const t = now();
  const w = realWeek(), day = w && todayInWeek(w);
  const info = day && day.periods.length ? `${day.periods.length} שיעורים · מתחילים ב־${day.periods[0].start}` : (t.getDay() === 6 ? 'שבת שלום 🕯️' : '');
  const bd = bdOn(t);
  const el = document.createElement('div'); el.id = 'welcome';
  el.innerHTML = `<div class="wl-in">
    <div class="wl-logo">${logo('wlogo')}</div>
    <small>יום ${DAY_FULL[t.getDay()]}, ${t.getDate()} ${HE_MONTHS[t.getMonth()]}</small>
    <h1>${hello()}</h1>
    ${(([q, by]) => `<p class="wl-q">${esc(q)}</p>${by ? `<p class="wl-by">— ${esc(by)}</p>` : ''}`)(pickQuote())}
    <p class="wl-i">${esc(info)}${bd.length ? `${info ? '<br>' : ''}🎂 יום הולדת ל${esc(names(bd))}` : ''}</p>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  let gone = false;
  const bye = () => { if (gone) return; gone = true; el.classList.remove('show'); el.classList.add('bye'); setTimeout(() => el.remove(), 600); };
  el.addEventListener('click', bye); setTimeout(bye, 1600);
}
// coming back to the app after a while also counts as "opening" it
document.addEventListener('visibilitychange', () => {
  if (document.hidden) lastHidden = Date.now();
  else if (lastHidden && Date.now() - lastHidden > 3 * 60 * 1000) { welcome(); lockCheck(Date.now() - lastHidden); }
});
function streak() {
  // consecutive school days (looking back from the latest one) that were fully prepared
  const days = [];
  for (const w of sortedWeeks()) for (const d of w.days) { const dd = dayDate(w, d); if (dd && d.periods.length && dd <= addDays(now(), 1)) days.push(dateKey(dd)); }
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) { if (state.ready[days[i]]) n++; else if (i < days.length - 1 || n) break; }
  return n;
}
function checkReady(w, dow) {
  const day = w.days.find(d => d.dow === dow); if (!day) return;
  const S = dayStats(w, day), k = dateKey(dayDate(w, day));
  const was = !!state.ready[k], is = S.total > 0 && S.done === S.total;
  if (is === was) return;
  if (is) state.ready[k] = 1; else delete state.ready[k];
  save();
  if (is) readyMoment(day);
}
function readyMoment(day) {
  const n = streak();
  const el = document.createElement('div'); el.id = 'readyMoment';
  el.innerHTML = `<div class="rm-card"><div class="rm-glow"></div><b>${g('את מוכנה', 'אתה מוכן')} ליום ${esc(day.name)} ✨</b><span>${n > 1 ? `🔥 ${n} ימים ברצף שהכל מוכן` : 'כל המשימות סומנו'}</span></div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  confetti(); if (navigator.vibrate) navigator.vibrate([12, 60, 12]);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 700); }, 2600);
}

// ================================================================ render
const TABS = ['now', 'day', 'prep', 'cls', 'more'];
const SUB = { files: 'more', friends: 'more', bells: 'more', kids: 'cls', grades: 'cls', journal: 'cls', class: 'cls', msgs: 'cls', calendar: 'cls', todos: 'more', summary: 'more', settings: 'more',  lists: 'more', autos: 'more', tools: 'more',   bank: 'more',  };
const VIEWS = { now: viewNow, day: viewDay, prep: viewPrep, files: viewFiles, more: viewMore, kids: viewKids, todos: viewTodos, summary: viewSummary, settings: viewSettings, journal: viewJournal, lists: viewLists, autos: viewAutos, tools: viewTools, msgs: viewMsgs, cls: viewHub, friends: viewFriends, bells: viewBells, class: viewClass, grades: viewGrades, bank: viewBank, calendar: viewCalendar };
let lastTab = null;
function render(animate) {
  let w = pickWeek();
  // after the last school day of the week, "to prepare" jumps to the next uploaded week
  if (w && state.tab === 'prep' && !state.viewWeekId && state.prepDow == null) {
    const t = todayInWeek(w);
    const doneHere = t ? phase(t).kind === 'after' && !nextSchoolDay(w, t.dow) : !upcomingDay(w);
    const ng = doneHere && nextDayGlobal();
    if (ng && ng.w !== w) { state.viewWeekId = ng.w.id; w = ng.w; }
  }
  const tab = SUB[state.tab] || state.tab;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  moveTabInd();
  const v = $('#view');
  const needWeek = !['more', 'kids', 'todos', 'settings', 'journal', 'lists', 'autos', 'tools', 'msgs', 'class', 'grades', 'bank', 'calendar', 'cls', 'friends', 'bells'].includes(state.tab);
  document.body.classList.toggle('onboarding', !state.onboarded);
  let html = !state.onboarded ? viewOnboard() : !w && needWeek ? viewEmpty() : VIEWS[state.tab](w);
  const busyNow = (() => { const w0 = realWeek(), d0 = w0 && todayInWeek(w0), ph0 = d0 && phase(d0); return ph0 && (ph0.kind === 'lesson' || ph0.kind === 'break'); })();
  const tp = state.onboarded && TABS.includes(state.tab) && !(state.tab === 'now' && busyNow) ? tipOnce(state.tab) : '';
  if (tp) html = html.replace('</header>', '</header>' + tp);
  v.innerHTML = html;
  if (animate) {
    const a = TABS.indexOf(SUB[state.tab] || state.tab), b = TABS.indexOf(SUB[lastTab] || lastTab);
    const dir = lastTab == null ? 0 : a !== b ? Math.sign(a - b) : SUB[state.tab] ? 1 : -1;
    v.classList.remove('enter', 'from-l', 'from-r'); void v.offsetWidth;
    v.classList.add('enter', dir >= 0 ? 'from-l' : 'from-r');
    v.querySelectorAll('.card, .lrow, .toolgrid > button, .tile, .quick, .addbtn').forEach((el, i) => el.style.setProperty('--i', Math.min(i, 12)));
    countUp(v);
  } else v.classList.remove('enter');
  lastTab = state.tab;
  afterRender(v, animate);
}

// ================================================================ depth & motion
let revealObs = null;
function afterRender(v, animate) {
  // compact header title follows the page title
  const h1 = v.querySelector('.tt h1'); const mt = $('#miniTitle');
  if (mt) mt.textContent = h1 ? h1.textContent : 'הכיתה שלי';
  // cards below the fold slide in when they reach the screen
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (revealObs) revealObs.disconnect();
  revealObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); } }), { rootMargin: '0px 0px -30px 0px' });
  const H = innerHeight;
  v.querySelectorAll(':scope > .card, :scope > .lessons > .lrow, :scope > .tiles, :scope > .toolgrid, :scope > .sect, :scope > .addbtn').forEach(el => {
    if (el.getBoundingClientRect().top > H - 20) { el.classList.add('rv'); revealObs.observe(el); }
  });
  onScroll();
}
let ticking = false;
function onScroll() {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    const y = scrollY;
    document.documentElement.style.setProperty('--sy', Math.min(y, 400));
    document.body.classList.toggle('scrolled', y > 120);
    ticking = false;
  });
}
addEventListener('scroll', onScroll, { passive: true });

// ripple from the finger on buttons
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.cta, .toolgrid > button, .quick button, button.card, .trow, .mrow, .presets button, .tagpick .tp, .qtags button, .menu button, .seg button, .fc, .kc');
  if (!b || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
  const s2 = document.createElement('span'); s2.className = 'ripple';
  s2.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  b.classList.add('rp'); b.appendChild(s2); setTimeout(() => s2.remove(), 650);
}, { passive: true });

// loading sheet while a plan PDF is read
function loader(show, pct = 0, label = '') {
  let el = $('#loader');
  if (!show) { if (el) { el.classList.remove('show'); setTimeout(() => el.remove(), 400); } return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'loader';
    el.innerHTML = `<div class="ld-card"><div class="ld-book"><i></i><i></i><i></i></div><b>קוראת את התכנון…</b><small id="ldLabel"></small><div class="bar big"><span id="ldBar" style="--w:0%"></span></div></div>`;
    document.body.appendChild(el); void el.offsetWidth; el.classList.add('show');
  }
  $('#ldBar').style.setProperty('--w', Math.round(pct * 100) + '%'); $('#ldBar').style.width = Math.round(pct * 100) + '%';
  $('#ldLabel').textContent = label;
}
function moveTabInd() {
  const on = $('.tabs button.on'), ind = $('.tabs .tab-ind');
  if (!on || !ind) return;
  ind.style.width = on.offsetWidth + 'px';
  ind.style.left = on.offsetLeft + 'px';
}
function countUp(root) {
  root.querySelectorAll('.num').forEach(el => {
    const m = el.textContent.match(/^(\d+)(.*)$/); if (!m || !+m[1]) return;
    const end = +m[1], t0 = performance.now();
    const f = t => { const k = Math.min(1, (t - t0) / 700); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))) + m[2]; if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
}
function go(tab) { state.tab = tab; render(true); window.scrollTo({ top: 0, behavior: 'instant' }); }
function rerender() { const y = window.scrollY; render(false); window.scrollTo({ top: y, behavior: 'instant' }); }

// ================================================================ events
document.addEventListener('click', async e => {
  const t = e.target.closest('button, a.trow, [data-day]');
  if (!t) return;
  const D = t.dataset, w = pickWeek();
  if (D.tab) {
    if (D.tab !== 'prep') state.prepDow = null;
    if (D.tab === 'day' && state.dayDow === 'all') state.dayDow = null;
    state.prepEdit = false; go(D.tab);
    const cur = state.tab === 'day' && $('#view .lrow.now'); if (cur) setTimeout(() => cur.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
    return;
  }
  if (D.go) { if ($('#overlay.show')) closeOverlay(); go(D.go); return; }
  if (D.toggle) {
    const card = t.closest('.lrow'), open = !card.classList.contains('open');
    card.classList.toggle('open', open); t.setAttribute('aria-expanded', open); state.open[D.toggle] = open;
    if (open) setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 320);
    return;
  }
  if (D.togglePref) { state.prefs[D.togglePref] = !state.prefs[D.togglePref]; save(); rerender(); return; }
  if (D.sec) {
    const [id, i] = D.sec.split('|'); state.sec[id] = +i;
    const tabs = t.closest('.segtabs'); tabs.style.setProperty('--i', i);
    tabs.querySelectorAll('button').forEach((b, j) => b.classList.toggle('on', j === +i));
    const panel = tabs.nextElementSibling;
    panel.classList.remove('swap'); void panel.offsetWidth; panel.textContent = findPeriod(w, id).sections[+i].text; panel.classList.add('swap');
    return;
  }
  if (D.wk) {
    const ws = sortedWeeks(), cur = pickWeek(), i = ws.indexOf(cur);
    const nw = D.wk === 'now' ? null : ws[i + (D.wk === 'next' ? 1 : -1)];
    state.viewWeekId = nw ? nw.id : null; state.dayDow = null; state.prepDow = null; state.open = {};
    render(false); const v = $('#view'); v.classList.remove('enter', 'from-l', 'from-r'); void v.offsetWidth; v.classList.add('enter', D.wk === 'next' ? 'from-l' : 'from-r');
    return;
  }
  if (D.gowk) state.viewWeekId = D.gowk === (realWeek() || {}).id ? null : D.gowk;
  if (D.day != null && !t.disabled) { state.dayDow = D.day === 'all' ? 'all' : +D.day; if (state.tab !== 'day') go('day'); else rerender(); return; }
  if (D.pday != null) { state.prepDow = +D.pday; if (state.tab !== 'prep') go('prep'); else rerender(); return; }
  if (D.goto) {
    const [dow, lb] = D.goto.split('|');
    state.dayDow = +dow; state.open[`${dow}:${lb}`] = true; go('day');
    const el = document.querySelector(`.lrow[data-id="${CSS.escape(dow + ':' + lb)}"]`);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    return;
  }
  if (D.cnote != null && D.tag) { noteSheet(D.cnote || null, D.tag); return; }
  if (D.picktag) { state._note.tag = D.picktag; document.querySelectorAll('.tp').forEach(b => b.classList.toggle('on', b.dataset.picktag === D.picktag)); return; }
  if (D.pickkid) { const k = state._note.kids, i = k.indexOf(D.pickkid); if (i >= 0) k.splice(i, 1); else k.push(D.pickkid); t.classList.toggle('on', i < 0); return; }
  if (D.cdone) { const n = state.cnotes.find(x => x.id === D.cdone); if (n) { n.done = !n.done; save(); if (n.done) miniBurst(t); setTimeout(rerender, 250); } return; }
  if (D.cdel) { { withUndo(['cnotes'], 'ההערה נמחקה', () => { state.cnotes = state.cnotes.filter(x => x.id !== D.cdel); }); } return; }
  if (D.jf != null) { state.jfilter = D.jf; rerender(); return; }
  if (D.ledit) { state.listEdit = state.listEdit === D.ledit ? null : D.ledit; rerender(); return; }
  if (D.ldelitem) { const [l, i] = D.ldelitem.split('|'); const L = state.lists.find(x => x.id === l); L.items = L.items.filter(x => x.id !== i); save(); rerender(); return; }
  if (D.lreset) { const L = state.lists.find(x => x.id === D.lreset); L.items.forEach(i => { i.done = false; }); save(); rerender(); return; }
  if (D.ldel) { if (true) { withUndo(['lists'], 'הרשימה נמחקה', () => { state.lists = state.lists.filter(x => x.id !== D.ldel); }); state.listEdit = null; save(); rerender(); } return; }
  if (D.ltpl != null) { const [e, title, items] = LIST_TEMPLATES[+D.ltpl]; state.lists.push({ id: uid(), emoji: e, title, items: items.map(x => ({ id: uid(), text: x, done: false })) }); save(); rerender(); toast('הרשימה נוצרה ✓'); return; }
  if (D.autoon) { const a = autos().find(x => x.id === D.autoon); a.on = !a.on; save(); rerender(); return; }
  if (D.autodel) { state.autos = autos().filter(x => x.id !== D.autodel); save(); rerender(); return; }
  if (D.printitem) { e.preventDefault(); const [dow, si, i] = D.printitem.split('|').map(Number); printSheet(w, dow, si, i); return; }
  if (D.openfile) { closeOverlay(); openFile(D.openfile); return; }
  if (D.filemenu) { fileMenu(D.filemenu); return; }
  if (D.reassign) { const f = state.files.find(x => x.id === D.reassign); assignSheet([{ ...f, cur: f.ref ? `${f.ref.w}|${f.ref.dow}|${f.ref.label}` : '', m: null }], true); return; }
  if (D.delfile) { if (await ask('למחוק את הקובץ?', { ok: 'מחיקה', danger: true })) { deleteFile(D.delfile).then(() => { closeOverlay(); rerender(); toast('הקובץ נמחק'); }); } return; }
  if (D.attach) { const [dow, label] = D.attach.split('|'); attachTo = { dow: +dow, label }; $('#upfile').click(); return; }
  if (D.edit != null) { const [dow, lb] = D.edit.split('|'); editor(w, +dow, lb || null); return; }
  if (D.addrow) { t.insertAdjacentHTML('beforebegin', editor.row(D.addrow)); const n = t.previousElementSibling.querySelector('input,textarea'); if (n) n.focus(); return; }
  if (D.delrow != null) { const r = t.closest('.erow'); r.classList.add('bye'); setTimeout(() => r.remove(), 200); return; }
  if (D.delprep) {
    const [dow, si, i] = D.delprep.split('|').map(Number);
    w.prep[dow][si].items.splice(i, 1); save(); rerender(); return;
  }
  if (D.log) {
    const cur = getLog(w, D.log);
    if (cur && cur.s === D.s) setLog(w, D.log, null);
    else { setLog(w, D.log, { s: D.s, note: cur ? cur.note || '' : '' }); if (navigator.vibrate) navigator.vibrate(8); if (D.s === 'done') miniBurst(t); }
    state.open[D.log] = true; setTimeout(rerender, D.s === 'done' ? 350 : 0); return;
  }
  if (D.week) { state.activeId = D.week; save(); go('day'); return; }
  if (D.delweek) { const id = D.delweek; withUndo(['weeks', 'checks', 'logs'], 'השבוע נמחק', () => { delete state.weeks[id]; delete state.checks[id]; delete state.logs[id]; if (state.viewWeekId === id) state.viewWeekId = null; }); return; }
  if (D.pin) { if (state.pins[D.pin]) delete state.pins[D.pin]; else { state.pins[D.pin] = D.pintext; miniBurst(t); } save(); setTimeout(rerender, 200); return; }
  if (D.fsub != null) { state.fsub = D.fsub; rerender(); return; }
  if (D.fgroup) { state.fgroup = D.fgroup; rerender(); return; }
  if (D.fopen) { state.fopen = state.fopen || {}; const el = t.closest('.fgrp'); state.fopen[D.fopen] = !el.classList.contains('open'); rerender(); return; }
  if (D.printweek) { printWeek(state.weeks[D.printweek]); return; }
  if (D.dict) { const [dow, label] = D.dict.split('|'); const key = `${w.id}:${dow}:${label}`; dictSheet(key, dictSource(w, +dow, label)); return; }
  if (D.pmtype) { state.pm.type = D.pmtype; rerender(); return; }
  if (D.pmtog) { state.pm.opts[D.pmtog] = state.pm.opts[D.pmtog] === false; state.pm.text = null; rerender(); return; }
  if (D.pmday) { const P = state.pm; P.opts.dow = +D.pmday; if (P.type === 'gear') { const d = w.days.find(x => x.dow === +D.pmday); P.opts.gear = d.periods.flatMap(p => [...p.materials.map(m => m.text), ...p.sections.map(x => x.text)]).filter(x => /להביא|לצייד|להגיע עם/.test(x)); } P.text = null; rerender(); return; }
  if (D.pmscope) { state.pm.opts.scope = D.pmscope; state.pm.text = null; rerender(); return; }
  if (D.pmtog2) { state.pm.opts[D.pmtog2] = !state.pm.opts[D.pmtog2]; state.pm.text = null; rerender(); return; }
  if (D.belldel != null) { const r = state._bellDraft || bellRows(); r.splice(+D.belldel, 1); state._bellDraft = r; rerender(); return; }
  if (D.pnote != null) { state.noteOpen = state.noteOpen || {}; state.noteOpen[D.pnote] = !state.noteOpen[D.pnote]; rerender(); return; }
  if (D.addr) { state.prefs.male = D.addr === 'm'; const n = document.querySelector('[data-onbstep="0"] [name=name]'); if (state.onb && n) state.onb.name = n.value; save(); rerender(); return; }
  if (D.lockmin) { state.prefs.lockMin = +D.lockmin; save(); rerender(); return; }
  if (D.tipok) { state.prefs.tips = { ...(state.prefs.tips || {}), [D.tipok]: 1 }; save(); rerender(); return; }
  if (D.lk != null) { lockKey(D.lk); return; }
  if (D.cls) { switchClass(D.cls); return; }
  if (D.clsf != null) { state.clsFilter = D.clsf; rerender(); return; }
  if (D.role) { const st = roleSet(state.prefs.role); if (st.has(D.role)) { if (st.size > 1) st.delete(D.role); else { toast('צריך לסמן לפחות אחת'); return; } } else st.add(D.role); state.prefs.role = roleOf(st); save(); classesSheet(); return; }
  if (D.clsedit) { const c = state.classes.find(x => x.id === D.clsedit); openOverlay(`<form class="ov sheet" data-clsform="${c.id}"><button type="button" class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button><div class="ovh">${ic('pencil')}<h2>עריכת כיתה</h2></div>
    <label class="field">שם הכיתה<input name="name" value="${esc(c.name)}" required></label><label class="field">כמה תלמידים<input name="size" type="number" inputmode="numeric" value="${esc(c.size || '')}"></label>
    <label class="field">${g('מה אני מלמדת שם (ריק = הכיתה שאני מחנכת)', 'מה אני מלמד שם (ריק = הכיתה שאני מחנך)')}<input name="subject" value="${esc(c.subject || '')}"></label><button class="cta">${ic('check')} שמירה</button></form>`); return; }
  if (D.clsdel) { const c = state.classes.find(x => x.id === D.clsdel); syncCls(); closeOverlay(); withUndo(['classes', 'curClass'], `${c.name} נמחקה`, () => { state.classes = state.classes.filter(x => x.id !== c.id); if (state.curClass === c.id) { state.curClass = state.classes[0].id; state.kids = state.classes[0].kids; } }); return; }
  if (D.onbrole) { const st = roleSet(state.onb.role); if (st.has(D.onbrole)) st.delete(D.onbrole); else st.add(D.onbrole); state.onb.role = roleOf(st); rerender(); return; }
  if (D.onbnext) { if (!state.onb.role) return; state.onb.step = +D.onbnext; rerender(); window.scrollTo({ top: 0 }); return; }
  if (D.onbback) { state.onb.step = +D.onbback - 1; rerender(); return; }
  if (D.onbgo) { finishOnboard(D.onbgo); return; }
  if (D.sharelesson) { const [dow, lb] = D.sharelesson.split('|'); shareLessonSheet(dow, lb); return; }
  if (D.shto) { const S2 = state._share, i = S2.to.indexOf(D.shto); if (i >= 0) S2.to.splice(i, 1); else S2.to.push(D.shto); shareSheet(); return; }
  if (D.freq) { const [op, id] = D.freq.split('|'); socApi(op, { id }).then(() => { toast(op === 'accept' ? 'אתן חברות עכשיו ✓' : 'הבקשה נדחתה'); socLoad(true); }).catch(() => toast('לא הצלחתי 😕')); return; }
  if (D.flib) { libSheet(D.flib); return; }
  if (D.funfriend) { if (!await ask('להסיר את החברה? אפשר להוסיף שוב עם הקוד.', { ok: 'הסרה', danger: true })) return; socApi('remove', { id: D.funfriend }).then(() => socLoad(true)); return; }
  if (D.inbox) { openInbox(D.inbox); return; }
  if (D.unpub) { socApi('unpublish', { id: D.unpub }).then(() => { toast('הוסר מהספרייה'); libSheet(soc.data.me.id); }); return; }
  if (D.libtake) { const it = (state._lib || []).find(x => x.id === D.libtake); if (it) { takeLesson(it.data, it.fromName); miniBurst(t); } return; }
  if (D.go2) { closeClassMode(); go(D.go2); return; }
  if (D.cmsec) { const [id, i] = D.cmsec.split('|'); state.sec[id] = +i; classMode(); return; }
  if (D.pt) { const [i, d] = D.pt.split('|').map(Number); state.points[i].pts = Math.max(0, state.points[i].pts + d); save(); if (d > 0) miniBurst(t); rerender(); if ($('#proj.show')) projector('points'); return; }
  if (D.projmode) { const m = D.projmode; projector(m, m === 'dict' ? (state._dict && state._dict.order) : m === 'groups' ? state._teams : null); return; }
  if (D.king) { if (kingHeld) { kingHeld = false; return; } state.kings[D.king] = state.kings[D.king] || {}; const k = weekKey(); state.kings[D.king][k] = (state.kings[D.king][k] || 0) + 1; state._lastKing = D.king; save(); miniBurst(t); rerender(); return; }
  if (D.unking) { unKing(D.unking); state._lastKing = null; rerender(); return; }
  if (D.kid) { kidSheet(D.kid); return; }
  if (D.kidmsg) { closeOverlay(); state.pm = { type: 'personal', sign: false }; go('msgs'); state.pm.opts.kid = D.kidmsg; rerender(); return; }
  if (D.kidnote) { noteSheet(null, 'note'); state._note.kids = [D.kidnote]; const b = document.querySelector(`[data-pickkid="${CSS.escape(D.kidnote)}"]`); if (b) b.classList.add('on'); return; }
  if (D.gopen != null) { state.gOpen = D.gopen; rerender(); window.scrollTo({ top: 0 }); return; }
  if (D.gdel) { if (true) { withUndo(['grades'], 'המבדק נמחק', () => { state.grades = state.grades.filter(g => g.id !== D.gdel); }); state.gOpen = ''; save(); rerender(); } return; }
  if (D.banksave) { const [dow, lb] = D.banksave.split('|'); const p = findPeriodIn(w, +dow, lb); if (p) { state.bank.push({ id: uid(), at: Date.now(), p: JSON.parse(JSON.stringify({ ...p, homework: [] })) }); save(); miniBurst(t); toast('נשמר במאגר השיעורים ⭐'); } return; }
  if (D.bank) { bankSheet(D.bank); return; }
  if (D.bankto) { const [id, dow] = D.bankto.split('|'); addFromBank(id, dow); return; }
  if (D.bankdel) { if (true) { withUndo(['bank'], 'נמחק מהמאגר', () => { state.bank = state.bank.filter(b => b.id !== D.bankdel); }); save(); closeOverlay(); rerender(); } return; }
  if (D.evdel) { const [tx, dt] = D.evdel.split('|'); state.events = state.events.filter(e => !(e.text === tx && e.date === dt)); save(); rerender(); return; }
  if (D.shareweek) { shareWeekSheet(D.shareweek); return; }
  if (D.guide) { if (D.guide === 'end') { closeOverlay(); const a = state._afterGuide; state._afterGuide = null; if (a === 'upload') $('#file').click(); if (a === 'manual') manualSheet(); } else guideSheet(+D.guide); return; }
  if (D.snap != null) { getBlob('snaps').then(async list => { const sn = list && list[+D.snap]; if (!sn || !await ask(`לשחזר את המצב מ־${sn.day.split('-').reverse().slice(0, 2).join('.')}? המידע הנוכחי יוחלף.`)) return; Object.assign(state, JSON.parse(sn.data)); save(); applyPrefs(); closeOverlay(); go('now'); toast('שוחזר ✓'); }); return; }
  if (D.pmkid) { const o = state.pm.opts; o.kid = D.pmkid; o.noteIds = []; o.notes = []; state.pm.text = null; rerender(); return; }
  if (D.pmkind) { state.pm.opts.kind = D.pmkind; state.pm.text = null; rerender(); return; }
  if (D.pmnote) { const o = state.pm.opts; const i = o.noteIds.indexOf(D.pmnote); if (i >= 0) o.noteIds.splice(i, 1); else o.noteIds.push(D.pmnote); o.notes = o.noteIds.map(id => (state.cnotes.find(n => n.id === id) || {}).text).filter(Boolean); state.pm.text = null; rerender(); return; }
  if (D.pmform) { state.pm.opts.form = D.pmform; state.pm.text = null; rerender(); return; }
  if (D.formkid) { const fm = state.forms.find(x => x.id === state.pm.opts.form); if (fm) { const i = fm.done.indexOf(D.formkid); if (i >= 0) fm.done.splice(i, 1); else fm.done.push(D.formkid); save(); rerender(); } return; }
  if (D.formdel) { if (true) { withUndo(['forms'], 'הטופס נמחק', () => { state.forms = state.forms.filter(x => x.id !== D.formdel); }); state.pm.opts.form = ''; save(); rerender(); } return; }
  if (D.wakid) {
    const P = state.pm, fm = P.type === 'forms' && state.forms.find(x => x.id === P.opts.form);
    const v = fm ? formPersonal(fm.title, D.wakid) : $('#pmText').value;
    navigator.clipboard && navigator.clipboard.writeText(v).catch(() => {});
    sendWhatsApp(v, kidPhone(D.wakid)); pmLog(P.type, v, D.wakid); return;
  }
  if (D.pmch) { const o = state.pm.opts; const i = o.picked.indexOf(D.pmch); if (i >= 0) o.picked.splice(i, 1); else o.picked.push(D.pmch); state.pm.text = null; rerender(); return; }
  if (D.pmhol) { state.pm.opts.holiday = D.pmhol; state.pm.text = null; rerender(); return; }
  if (D.pmtpl) { const x = state.pmtpl.find(y => y.id === D.pmtpl); if (x) { state.pm.text = x.text; rerender(); } return; }
  if (D.pmtpldel) { if (true) { withUndo(['pmtpl'], 'התבנית נמחקה', () => { state.pmtpl = state.pmtpl.filter(y => y.id !== D.pmtpldel); }); save(); rerender(); } return; }
  if (D.pmlog) { const x = state.pmlog.find(y => y.id === D.pmlog); if (x) { state.pm.type = x.type === 'mine' ? 'mine' : x.type; state.pm.optsFor = null; viewMsgs(pickWeek()); state.pm.text = x.text; rerender(); window.scrollTo({ top: 0, behavior: 'smooth' }); toast('ההודעה נטענה – אפשר לערוך ולשלוח'); } return; }
  if (D.pmlen) { state.pm.len = D.pmlen; state.pm.text = null; rerender(); return; }
  if (D.pmemoji) { state.pm.noemoji = !state.pm.noemoji; state.pm.text = null; rerender(); return; }
  if (D.pmsign) { state.pm.sign = !state.pm.sign; state.pm.text = null; rerender(); return; }
  if (D.tcat != null) { state.tcat = D.tcat; rerender(); return; }
  if (D.tip) { tipSheet(D.tip); return; }
  if (D.tsave) { const i = state.tsaved.indexOf(D.tsave); if (i >= 0) state.tsaved.splice(i, 1); else { state.tsaved.push(D.tsave); miniBurst(t); toast('נשמר ♥'); } save(); tipSheet(D.tsave); if (state.tab === 'tools') rerender(); return; }
  if (D.timer) { timerSetup(+D.timer, +(D.rounds || 1)); return; }
  if (D.tset) { timerSetup(+D.tset, T.setRounds); return; }
  if (D.tmin) { timerSetup(Math.max(1, Math.min(90, T.setMin + +D.tmin)), T.setRounds); return; }
  if (D.trnd) { timerSetup(T.setMin, Math.max(1, Math.min(12, T.setRounds + +D.trnd))); return; }
  if (D.pmode) { state.pickMode = D.pmode; pickerScreen(); return; }
  if (D.pg) { state.groups = Math.max(2, Math.min(12, state.groups + +D.pg)); state._teams = null; save(); pickerScreen(); return; }
  if (D.absent) {
    const ab = absentToday().slice(); const i = ab.indexOf(D.absent);
    if (i >= 0) ab.splice(i, 1); else ab.push(D.absent);
    state.absent = { d: todayKey(), names: ab }; state._absOpen = true; state._teams = null; save(); pickerScreen(); return;
  }
  if (D.size) { state.prefs.size = +D.size; save(); applyPrefs(); rerender(); return; }
  if (D.skin) { state.prefs.skin = D.skin; save(); applyPrefs(); rerender(); return; }
  if (D.theme) { state.prefs.theme = D.theme; save(); applyPrefs(); rerender(); return; }
  if (D.deltodo) { state.todos = state.todos.filter(x => x.id !== D.deltodo); save(); rerender(); return; }
  switch (D.act) {
    case 'upload': $('#file').click(); break;
    case 'widget': sendToWidget(w); break;
    case 'widgetcode': copyWidgetCode(); break;
    case 'wake': toggleAwake(); break;
    case 'timer': if (T.running || (T.left > 0 && T.total)) timerScreen(); else timerSetup(state.lastMin || 5, 1); break;
    case 'tstart': state.lastMin = T.setMin; timerStart(); break;
    case 'tpause':
      if (T.running) { T.running = false; T.left = Math.max(0, (T.endAt - Date.now()) / 1000); }
      else if (T.left > 0) { T.running = true; T.endAt = Date.now() + T.left * 1000; clearInterval(tInt); tInt = setInterval(tick, 250); }
      tick(); break;
    case 'tplus': T.total += 60; if (T.running) T.endAt += 60000; else T.left += 60; tick(); break;
    case 'tstop': T.running = false; T.left = 0; T.total = 0; clearInterval(tInt); if (!wantAwake) wakeOff(); closeOverlay(); break;
    case 'close': closeOverlay(); break;
    case 'topen': timerScreen(); break;
    case 'picker': pickerScreen(); break;
    case 'dictfree': { const k = 'free'; dictSheet(k, state.dict[k] || (w ? dictSource(w, -1, '') : [])); break; }
    case 'dictshuffle': {
      const words = splitWords($('#dictIn').value);
      if (!words.length) { toast('צריך לכתוב קודם את המילים'); break; }
      const D2 = state._dict; state.dict[D2.k] = words; save();
      if (navigator.vibrate) navigator.vibrate(12);
      dictSheet(D2.k, words, shuffled(words, D2.order.length ? D2.order : null)); break;
    }
    case 'pmwa': { const v = $('#pmText').value; navigator.clipboard && navigator.clipboard.writeText(v).catch(() => {}); sendWhatsApp(v, '', state.pm.file); pmLog(state.pm.type, v); break; }
    case 'pmsavetpl': { const v = $('#pmText').value.trim(); if (!v) break; state._tplText = v; openOverlay(`<form class="ov sheet" data-tplname><button type="button" class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button><div class="ovh">${ic('star')}<h2>שמירה כתבנית</h2></div><label class="field">שם לתבנית<input name="n" value="${esc((PM_TYPES.find(x => x[0] === state.pm.type) || [0, 0, ''])[2])}" required></label><button class="cta">${ic('check')} שמירה</button></form>`); break; }
    case 'classmode': classMode(); break;
    case 'belladd': { const r = state._bellDraft || bellRows(); const last = r[r.length - 1]; const nl = BELL_ORDER[Math.min(BELL_ORDER.length - 1, BELL_ORDER.indexOf(last ? last[0] : 'בוקר') + 1)]; r.push([nl, last ? last[2] : '08:00', '']); state._bellDraft = r; rerender(); break; }
    case 'bellsave': bellSave(state._bellDraft || bellRows()); toast('לוח הצלצולים נשמר ⏰'); rerender(); break;
    case 'bellfile': $('#bellfile').click(); break;
    case 'bellauto': state.prefs.bellAuto = !state.prefs.bellAuto; save(); rerender(); break;
    case 'bellapply': { if (state._bellDraft) bellSave(state._bellDraft); if (!state.prefs.bell) { toast('קודם שומרים את הלוח'); break; } const cur = (realWeek() || {}).id || ''; let n = 0; for (const wk of sortedWeeks()) if (wk.id >= cur) n += applyBell(wk); save(); toast(n ? `עודכנו השעות של ${n} שיעורים ✓` : 'הכל כבר לפי הלוח ✓'); break; }
    case 'classes': classesSheet(); break;
    case 'addtodo': state._addTodo = true; rerender(); setTimeout(() => { const n = document.querySelector('[data-addtodo] input'); if (n) n.focus(); }, 30); break;
    case 'stepsdone': state.prefs.stepsDone = true; save(); rerender(); toast('הצעדים הראשונים נסגרו · אפשר להחזיר בהגדרות'); break;
    case 'undo': { const f = state._undo; state._undo = null; $('#toast').classList.remove('show'); if (f) f(); break; }
    case 'pmmore': state.pmMore = !state.pmMore; rerender(); break;
    case 'pinset': showLock('set'); break;
    case 'pinoff': if (await ask('לבטל את הנעילה בקוד?', { ok: 'ביטול הנעילה' })) { state.prefs.pinHash = ''; save(); rerender(); toast('הנעילה בוטלה'); } break;
    case 'restopen': state._restOpen = !state._restOpen; rerender(); break;
    case 'tlopen': state._tlOpen = !state._tlOpen; rerender(); break;
    case 'stepsopen': state._stepsOpen = !state._stepsOpen; rerender(); break;
    case 'stepsback': state.prefs.stepsDone = false; save(); go('now'); break;
    case 'sharecode': { const c = soc.data && soc.data.me.code; if (!c) break; const tx = `היי! אני משתמשת באפליקציה "הכיתה שלי" לתכנון השבועי 💜\nבואי נהיה חברות שם ונשתף שיעורים – הקוד שלי: ${c}\nhttps://noa-hakita.netlify.app`; if (navigator.share) navigator.share({ text: tx }).catch(() => {}); else navigator.clipboard.writeText(tx).then(() => toast('הועתק 📋')); break; }
    case 'shsend': { const S2 = state._share; socApi('send', { to: S2.to, kind: S2.kind, title: S2.title, data: S2.data }).then(r => { closeOverlay(); toast(`נשלח ל־${r.sent} ✓`); confetti(); }).catch(e => toast(e.code === 'too-big' ? 'השבוע גדול מדי לשליחה – שולחים כקובץ' : 'לא הצלחתי לשלוח 😕')); break; }
    case 'shpub': { const S2 = state._share; socApi('publish', { title: S2.title, data: S2.data }).then(() => { closeOverlay(); toast('השיעור בספרייה שלך – כל החברות רואות אותו ⭐'); }).catch(() => toast('לא הצלחתי לשתף 😕')); break; }
    case 'shfile': closeOverlay(); shareWeek(state._share.data); break;
    case 'intakelesson': { const it = state._inbox; takeLesson(it.data, it.fromName); socApi('inbox-del', { id: it.id }).then(() => socLoad(true)); closeOverlay(); break; }
    case 'intakeweek': { const it = state._inbox, wk = it.data; if (state.weeks[wk.id] && !await ask('כבר יש לך שבוע בתאריכים האלה. להחליף אותו?')) break; socApi('inbox-del', { id: it.id }).then(() => socLoad(true)); state.logs[wk.id] = {}; saveGenericWeek(wk); toast(`השבוע של ${it.fromName || 'החברה'} נוסף ✨`); break; }
    case 'indel': socApi('inbox-del', { id: state._inbox.id }).then(() => { closeOverlay(); socLoad(true); }); break;
    case 'cmclose': closeClassMode(); break;
    case 'projtext': projector('text'); break;
    case 'projpoints': projector('points'); break;
    case 'projdict': projector('dict', state._dict && state._dict.order); break;
    case 'projclose': closeProjector(); break;
    case 'ptzero': state.points.forEach(p => { p.pts = 0; }); save(); rerender(); break;
    case 'ptclear': withUndo(['points'], 'הקבוצות נמחקו', () => { state.points = []; }); break;
    case 'noise': noiseToggle(); break;
    case 'nextweek': {
      const cur = pickWeek(); if (!cur) break;
      const { wk, carried } = nextWeekFrom(cur);
      if (state.weeks[wk.id] && !await ask('כבר יש תכנון לשבוע הבא. להחליף אותו?')) break;
      if (!state.weeks[wk.id] && !await ask(`לבנות את השבוע הבא מתוך השבוע הזה?\nאותם שיעורים ושעות${carried.length ? `, ו־${carried.length} שיעורים שלא הספקת יעברו לשבוע הבא` : ''}.`)) break;
      saveGenericWeek(wk); toast(carried.length ? `${carried.length} שיעורים עברו לשבוע הבא ✓` : 'השבוע הבא מוכן לעריכה ✓'); break;
    }
    case 'guide': guideSheet(0); break;
    case 'report': reportSheet(); break;
    case 'diagreport': { const t2 = `קובץ תכנון שלא נקרא · גרסה ${APP_V}\n${diagText(state._review && state._review.diag)}\n${navigator.userAgent}`; if (navigator.share) navigator.share({ text: t2 }).catch(() => {}); else navigator.clipboard.writeText(t2).then(() => toast('הפרטים הועתקו 📋')); break; }
    case 'snaps': snapsSheet(); break;
    case 'pmreset': state.pm.text = null; rerender(); break;
    case 'pmcopy': navigator.clipboard.writeText($('#pmText').value).then(() => { toast('ההודעה הועתקה 📋'); pmLog(state.pm.type, $('#pmText').value); }).catch(() => toast('לא הצלחתי להעתיק 😕')); break;
    case 'pmshare': { const v = $('#pmText').value; const fl = state.pm.file; pmLog(state.pm.type, v); if (navigator.share) navigator.share(fl && navigator.canShare && navigator.canShare({ files: [fl] }) ? { files: [fl], text: v } : { text: v }).catch(() => {}); else navigator.clipboard.writeText(v).then(() => toast('ההודעה הועתקה 📋')); break; }
    case 'tiprand': { const cur = state._tip; let b; do b = BANK[Math.floor(Math.random() * BANK.length)]; while (b.id === cur && BANK.length > 1); state._tip = b.id; tipSheet(b.id); break; }
    case 'pick': doPick(); break;
    case 'split': doSplit(); break;
    case 'savekidsquick': { const k = parseKids($('#kidsQuick').value); if (!k.length) { toast('לא מצאתי שמות 🤔'); break; } state.kids = k; save(); state.pickMode = 'one'; pickerScreen(); toast(`נשמרו ${k.length} ילדים 💜`); break; }
    case 'preset': state.picked = []; state._lastPick = null; save(); pickerScreen(); break;
    case 'savekids': state.kids = parseKids($('#kidsIn').value); save(); toast(`נשמר! ${state.kids.length} ילדים 💜`); rerender(); break;
    case 'cleartodos': state.todos = state.todos.filter(x => !x.done); save(); rerender(); break;
    case 'copycarry': navigator.clipboard.writeText(carryText(w, summary(w))).then(() => toast('הועתק 📋 אפשר להדביק בתכנון של השבוע הבא')).catch(() => toast('לא הצלחתי להעתיק 😕')); break;
    case 'prepedit': state.prepEdit = !state.prepEdit; rerender(); break;
    case 'dellesson': {
      const f = t.closest('form'); const [dow, lb] = f.dataset.editor.split('|');
      closeOverlay();
      withUndo(['weeks'], 'השיעור נמחק', () => {
        const day = w.days.find(d => d.dow === +dow); const gone = day.periods.find(p => p.label === lb); day.periods = day.periods.filter(p => p.label !== lb);
        if (gone) logChange(w, day, gone.title, { label: lb, start: gone.start }, null);
      }); break;
    }
    case 'export': exportBackup(); break;
    case 'uploadfiles': attachTo = null; $('#upfile').click(); break;
    case 'manualweek': manualSheet(false); break;
    case 'templateweek': manualSheet(true); break;
    case 'onblogin': state.onboarded = true; save(); go('settings'); break;
    case 'pshare': {
      const P2 = state._print;
      if (P2.loading) { toast('רגע, מורידה את הקובץ… ⏳'); break; }
      if (P2.file && navigator.canShare && navigator.canShare({ files: [P2.file] })) { navigator.share({ files: [P2.file], title: P2.title }).catch(() => {}); break; }
      if (navigator.share) navigator.share({ title: P2.title, text: P2.title, url: P2.url }).catch(() => {});
      else navigator.clipboard.writeText(P2.url).then(() => toast('הקישור הועתק 📋'));
      break;
    }
    case 'pcopylink': navigator.clipboard.writeText(state._print.url).then(() => toast('הקישור הועתק 📋')).catch(() => toast('לא הצלחתי להעתיק 😕')); break;
    case 'pdone': { const k = state._print.k; setCk(w, k, !ck(w, k)); closeOverlay(); rerender(); if (ck(w, k)) toast('סומן ✓'); checkReady(w, +k.split(':')[1]); break; }
    case 'pushon': enablePush(); break;
    case 'pushoff': disablePush(); break;
    case 'pushtest': pushApi({ action: 'test' }).then(r => toast(r.ok ? 'נשלחה התראת בדיקה 🔔' : 'לא הצלחתי לשלוח 😕')).catch(() => toast('לא הצלחתי לשלוח 😕')); break;
    case 'cancelupload': cancelUpload(); break;
    case 'syncnow': push().then(() => pull()).then(() => { rerender(); toast(sync.err ? 'לא הצלחתי לסנכרן 😕' : 'מסונכרן ✓'); }); break;
    case 'logout': if (await ask('להתנתק? המידע יישאר בטלפון הזה.', { ok: 'התנתקות' })) ID.logout().catch(() => {}).finally(() => { sync.user = null; sync.pulled = false; state.syncV = 0; saveLocal(); rerender(); toast('התנתקת'); }); break;
    case 'forgot': {
      const em = $('[data-auth] [name=email]').value.trim();
      if (!em) { $('#authErr').textContent = 'כתבי קודם את המייל 🙂'; break; }
      ID.requestPasswordRecovery(em).then(() => toast('שלחתי מייל לאיפוס סיסמה 📧')).catch(e => { $('#authErr').textContent = authError(e); });
      break;
    }
    case 'import': importBackup(); break;
    case 'wipe': if (await ask('למחוק את כל המידע מהטלפון? אי אפשר לבטל.', { ok: 'מחיקת הכל', danger: true })) { localStorage.removeItem(KEY); location.reload(); } break;
  }
});
function findPeriod(w, id) { const [dow, lb] = id.split(':'); return w.days.find(d => d.dow === +dow).periods.find(p => p.label === lb); }

document.addEventListener('change', e => {
  if (e.target.id === 'bellfile' && e.target.files[0]) { readBellFile(e.target.files[0]); e.target.value = ''; return; }
  if (e.target.dataset && e.target.dataset.bell) { const [i, k] = e.target.dataset.bell.split('|').map(Number); const r = state._bellDraft || bellRows(); r[i][k] = e.target.value; state._bellDraft = r; return; }
  if (e.target.name === 'shot' && e.target.files[0]) { const n = $('#shotName'); if (n) n.textContent = '✓ ' + e.target.files[0].name; }
  const sel = e.target.dataset && e.target.dataset.pmsel;
  if (sel && state.pm) {
    if (sel === 'attach') { state.pm.attach = e.target.value; state.pm.file = null; rerender(); pmLoadAttach(pickWeek(), e.target.value).then(() => rerender()); return; }
    state.pm[sel] = e.target.value; state.pm.text = null; rerender(); return;
  }
  if (e.target.name === 'kind' && e.target.closest('form.autonew')) e.target.closest('form').dataset.kind = e.target.value;
  const i = e.target;
  if (i.dataset.ck) {
    const w = pickWeek();
    setCk(w, i.dataset.ck, i.checked);
    const row = i.closest('.chk'); row.classList.toggle('on', i.checked);
    if (i.checked) { if (navigator.vibrate) navigator.vibrate(8); row.classList.remove('pop'); void row.offsetWidth; row.classList.add('pop'); }
    const card = i.closest('.card, .sub');
    const all = card && [...card.querySelectorAll('input[type=checkbox]')].every(x => x.checked);
    if (i.checked && all) confetti(); else if (i.checked) miniBurst(row.querySelector('.box'));
    const pk = i.dataset.ck.match(/^p:(\d+):/);
    if (pk) checkReady(pickWeek(), +pk[1]);
    if (state.tab === 'prep') setTimeout(rerender, 450);
    return;
  }
  if (i.dataset.lcheck) {
    const [l, id] = i.dataset.lcheck.split('|'); const L = state.lists.find(x => x.id === l); const it = L.items.find(x => x.id === id);
    it.done = i.checked; save(); i.closest('.chk').classList.toggle('on', i.checked);
    if (i.checked) { if (L.items.every(x => x.done)) confetti(); else miniBurst(i.closest('.chk').querySelector('.box')); }
    return;
  }
  if (i.dataset.litem) { const [l, id] = i.dataset.litem.split('|'); const it = state.lists.find(x => x.id === l).items.find(x => x.id === id); it.text = i.value.trim() || it.text; save(); return; }
  if (i.dataset.ltitle) { const L = state.lists.find(x => x.id === i.dataset.ltitle); L.title = i.value.trim() || L.title; save(); return; }
  if (i.dataset.auto) { const a = autos().find(x => x.id === i.dataset.auto); const f = i.dataset.f; a[f] = f === 'mins' || f === 'day' ? +i.value : i.value; save(); toast('נשמר ✓', 1000); return; }
  if (i.dataset.prepitem) { const [dow, si, ii] = i.dataset.prepitem.split('|').map(Number); pickWeek().prep[dow][si].items[ii].text = i.value.trim(); save(); return; }
  if (i.dataset.todo) {
    const td = state.todos.find(x => x.id === i.dataset.todo);
    if (td) { td.done = i.checked; save(); i.closest('.chk').classList.toggle('on', i.checked); if (i.checked) miniBurst(i.closest('.chk').querySelector('.box')); }
    return;
  }
  if (i.dataset.lognote) { const w = pickWeek(), cur = getLog(w, i.dataset.lognote); if (cur) { cur.note = i.value; save(); toast('נשמר ✓', 1200); } return; }
  if (i.id === 'classSizeIn') { const v = Math.max(1, Math.min(60, +i.value || 0)); if (v) { state.prefs.classSize = v; save(); toast(`נשמר: ${v} תלמידים ✓`, 1500); } return; }
  if (i.id === 'nameIn') { state.name = i.value.trim(); save(); toast('נשמר ✓', 1200); }
  if (i.id === 'notifyTime') { state.prefs.notifyTime = i.value || '07:00'; save(); toast('נשמר – לא לשכוח לעדכן את הווידג׳ט 📲', 2400); }
});

document.addEventListener('input', e => {
  if (e.target.id !== 'fq') return;
  state.q = e.target.value;
  const pos = e.target.selectionStart;
  rerender();
  const n = $('#fq'); n.focus(); n.setSelectionRange(pos, pos);
});

document.addEventListener('submit', e => {
  const f = e.target;
  if (f.matches('[data-editor]')) { e.preventDefault(); saveEditor(f); return; }
  if (f.matches('[data-assign]')) { e.preventDefault(); saveAssign(f); return; }
  if (f.matches('[data-onboard]')) {
    e.preventDefault();
    state.name = f.name.value.trim(); if (f.cls.value.trim()) state.prefs.cls = f.cls.value.trim(); if (+f.size.value) state.prefs.classSize = +f.size.value;
    state.onboarded = true; save(); rerender(); toast('נשמר ✓'); confetti(); if (!state.guided) { state.guided = true; save(); setTimeout(() => guideSheet(0), 900); } return;
  }
  if (f.matches('[data-review]')) { e.preventDefault(); const r = state._review; saveGenericWeek(buildWeek(r.days, f.start.value, { title: f.title.value.trim(), number: r.number })); return; }
  if (f.matches('[data-manual]')) {
    e.preventDefault();
    let days;
    if (f.dataset.manual) {
      const last = sortedWeeks()[sortedWeeks().length - 1];
      days = last.days.map(d => ({ dow: d.dow, periods: d.periods.map(p => ({ ...JSON.parse(JSON.stringify(p)), sections: [], materials: [], homework: [], links: [], badges: [] })) }));
    } else days = [0, 1, 2, 3, 4, 5].map(dow => ({ dow, periods: [] }));
    saveGenericWeek(buildWeek(days, f.start.value, { title: f.title.value.trim() }));
    return;
  }
  if (f.matches('[data-noteform]')) { e.preventDefault(); saveNote(f); return; }
  if (f.matches('[data-ladd]')) { e.preventDefault(); const t = f.t.value.trim(); if (!t) return; state.lists.find(x => x.id === f.dataset.ladd).items.push({ id: uid(), text: t, done: false }); save(); rerender(); setTimeout(() => { const n = document.querySelector(`[data-ladd="${f.dataset.ladd}"] input`); if (n) n.focus(); }, 30); return; }
  if (f.matches('[data-lnew]')) { e.preventDefault(); const t = f.t.value.trim(); if (!t) return; const id = uid(); state.lists.push({ id, emoji: '✅', title: t, items: [] }); save(); rerender(); setTimeout(() => { const n = document.querySelector(`[data-ladd="${id}"] input`); if (n) n.focus(); }, 30); return; }
  if (f.matches('[data-onbstep]')) {
    e.preventDefault(); const st = state.onb;
    if (f.dataset.onbstep === '0') { st.name = f.name.value.trim(); st.step = 1; }
    else { if (f.home) { st.home = f.home.value.trim(); st.size = f.size.value; } if (f.more) { st.classes = f.more.value.split(/[,،\n]+/).map(x => x.trim()).filter(Boolean); st.subject = f.subject.value.trim(); } st.step = 3; }
    rerender(); window.scrollTo({ top: 0 }); return;
  }
  if (f.matches('[data-clsform]')) { e.preventDefault(); const c = state.classes.find(x => x.id === f.dataset.clsform); c.name = f.name.value.trim() || c.name; c.size = +f.size.value || 0; c.subject = f.subject.value.trim(); c.home = !c.subject; if (c.id === state.curClass) { state.prefs.cls = c.name; state.prefs.classSize = c.size || ''; } save(); classesSheet(); rerender(); toast('נשמר ✓'); return; }
  if (f.matches('[data-tplname]')) { e.preventDefault(); state.pmtpl.push({ id: uid(), name: f.n.value.trim() || 'תבנית', text: state._tplText }); save(); closeOverlay(); toast('נשמר בתבניות שלי ⭐'); return; }
  if (f.matches('[data-clsnew]')) { e.preventDefault(); syncCls(); state.classes.push({ id: 'c' + uid(), name: f.name.value.trim(), size: +f.size.value || 0, kids: [], home: false, subject: f.subject.value.trim() }); if (state.prefs.role === 'home') state.prefs.role = 'both'; save(); classesSheet(); rerender(); return; }
  if (f.matches('[data-friendadd]')) { e.preventDefault(); const c = f.code.value.trim(); if (!c) return; socApi('add', { code: c }).then(r => { if (r.pending) toast(`נשלחה בקשה ל${r.friend.name || 'חברה'} – כשהיא תאשר, תהיו חברות`, 4000); else { toast(`${r.friend.name || 'החברה'} נוספה ✓`); confetti(); } f.code.value = ''; socLoad(true); }).catch(x => toast(x.code === 'no-such-code' ? 'לא מצאתי את הקוד – כדאי לבדוק שוב' : x.code === 'self' ? 'זה הקוד שלך 🙂' : 'לא הצלחתי להוסיף 😕')); return; }
  if (f.matches('[data-profile]')) { e.preventDefault(); socApi('profile', { name: f.name.value, school: f.school.value, subjects: f.subjects.value }).then(() => { toast('נשמר ✓'); socLoad(true); }); return; }
  if (f.matches('[data-ptnew]')) { e.preventDefault(); const t = f.t.value.trim(); if (!t) return; state.points.push({ name: t, pts: 0 }); save(); rerender(); return; }
  if (f.matches('[data-gnew]')) { e.preventDefault(); const id = uid(); state.grades.push({ id, title: f.title.value.trim(), kind: f.kind.value, max: +f.max.value || 100, date: isoDay(now()), scores: {} }); state.gOpen = id; save(); rerender(); return; }
  if (f.matches('[data-evnew]')) { e.preventDefault(); state.events.push({ text: f.text.value.trim(), date: f.date.value, icon: '⭐' }); save(); rerender(); toast('נוסף ללוח ✓'); return; }
  if (f.matches('[data-report]')) {
    e.preventDefault();
    const txt = `דיווח מ"הכיתה שלי" · גרסה ${APP_V}\nמסך: ${state.tab} · ${innerWidth}×${innerHeight} · ${standalone() ? 'מסך הבית' : 'דפדפן'}\n${navigator.userAgent}\n\nמה קרה:\n${f.what.value.trim()}`;
    const shot = f.shot.files && f.shot.files[0];
    if (navigator.share) navigator.share(shot && navigator.canShare && navigator.canShare({ files: [shot] }) ? { text: txt, files: [shot] } : { text: txt }).then(() => closeOverlay()).catch(() => {});
    else navigator.clipboard.writeText(txt).then(() => toast('הדיווח הועתק – אפשר להדביק לי בצ׳אט 📋'));
    return;
  }
  if (f.matches('[data-formnew]')) { e.preventDefault(); const t = f.t.value.trim(); if (!t) return; const id = uid(); state.forms.push({ id, title: t, done: [] }); state.pm.opts.form = id; save(); rerender(); return; }
  if (f.matches('[data-autonew]')) { e.preventDefault(); autos().push({ id: uid(), kind: f.kind.value, on: true, text: f.text.value.trim(), day: +f.day.value, date: f.date.value, time: f.time.value || '16:00' }); save(); rerender(); toast('התזכורת נוספה 🔔'); return; }
  if (f.matches('[data-prepnew]')) { e.preventDefault(); const t = f.t.value.trim(); if (!t) return; const dow = +f.dataset.prepnew; const w = pickWeek(); (w.prep[dow] = w.prep[dow] || []).push({ title: t, icon: '', items: [] }); save(); rerender(); return; }
  if (f.matches('[data-auth]')) {
    e.preventDefault();
    const mode = e.submitter && e.submitter.value === 'signup' ? 'signup' : 'login';
    const em = f.email.value.trim(), pw = f.password.value, err = $('#authErr');
    err.textContent = ''; f.classList.add('busy');
    (mode === 'signup' ? ID.signup(em, pw, { full_name: state.name }) : ID.login(em, pw))
      .then(async u => {
        if (mode === 'signup' && !u.confirmedAt) { err.textContent = ''; toast('שלחתי לך מייל אישור 📧 לוחצים על הקישור – ואת בפנים', 5000); f.classList.remove('busy'); return; }
        sync.user = u; toast('התחברת 💜 מסנכרנת…'); await pull(true); rerender(); confetti();
      })
      .catch(x => { err.textContent = authError(x); f.classList.remove('busy'); });
    return;
  }
  if (f.matches('[data-newpass]')) {
    e.preventDefault();
    ID.updateUser({ password: f.password.value }).then(async () => { closeOverlay(); toast('הסיסמה עודכנה 💜'); sync.user = await ID.getUser(); await pull(true); rerender(); })
      .catch(x => toast(authError(x)));
    return;
  }
  if (f.matches('[data-addprep]')) {
    e.preventDefault();
    const text = f.t.value.trim(); if (!text) return;
    const [dow, si] = f.dataset.addprep.split('|').map(Number);
    pickWeek().prep[dow][si].items.push({ text }); save(); rerender();
    setTimeout(() => { const n = document.querySelector(`[data-addprep="${dow}|${si}"] input`); if (n) n.focus(); }, 30);
    return;
  }
  if (!f.matches('[data-addtodo]')) return;
  e.preventDefault();
  const text = f.t.value.trim();
  if (!text) return;
  state.todos.push({ id: uid(), text, date: f.d && f.d.value ? f.d.value : null, done: false }); state._addTodo = false;
  save(); rerender(); toast('נוסף 📌', 1200);
});

$('#upfile').addEventListener('change', e => {
  const list = [...e.target.files]; e.target.value = '';
  if (list.length) handleUploads(list).catch(err => { console.error(err); toast('לא הצלחתי לשמור את הקובץ 😕'); });
});

$('#file').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (await tryImportWeek(f)) return;
  loader(true, 0, 'פותחת את הקובץ');
  try {
    const isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
    let wk = null;
    if (isPdf) {
      try { wk = await parsePlanPdf(pdfjsLib, new Uint8Array(await f.arrayBuffer()), (i, n) => loader(true, i / n, `עמוד ${i} מתוך ${n}`)); } catch (e2) { console.warn(e2); wk = null; f._err = String(e2 && (e2.name || e2.message) || e2); }
    }
    const nn = wk ? wk.days.reduce((a, d) => a + d.periods.length, 0) : 0;
    if (!nn) {
      loader(true, .7, 'מחפשת ימים ושיעורים…');
      const res = await readAnyPlan(f, pdfjsLib).catch(x => ({ days: [], err: String(x && x.message || x) }));
      if (!res.days.reduce((a, d) => a + d.periods.length, 0)) res.diag = await fileDiag(f, isPdf);
      loader(true, 1, 'כמעט מוכן ✨'); await new Promise(r => setTimeout(r, 350)); loader(false);
      reviewSheet(res);
      return;
    }
    loader(true, 1, 'מסדרת את השבוע ✨'); await new Promise(r => setTimeout(r, 450)); loader(false);
    const n = nn;
    const empty = wk.days.filter(d => !d.periods.length).map(d => d.name);
    tagClasses(wk); if (state.prefs.bellAuto) applyBell(wk);
    state.weeks[wk.id] = wk; state.activeId = wk.id; state.viewWeekId = null; save();
    go('now');
    toast(`${wk.number ? 'שבוע ' + wk.number : 'השבוע'} נטען! ${wk.days.length} ימים, ${n} שיעורים 🎉${empty.length ? ` (בלי שיעורים: ${empty.join(', ')})` : ''}`, 4000);
    confetti();
  } catch (err) {
    console.error(err); loader(false);
    reviewSheet({ days: [], diag: await fileDiag(f, /\.pdf$/i.test(f.name) || f.type === 'application/pdf').catch(() => ({ size: f.size, err: String(err) })) });
  }
});

// swipe between days – the lessons follow the finger and spring back
let sx = null, sy = null, sdx = 0, swiping = false;
document.addEventListener('change', e => {
  const f = e.target.closest('form[data-editor]');
  if (f && e.target.name === 'label') { const [a, b] = bellFor(e.target.value); if (a) { f.start.value = a; f.end.value = b; } }
});
// long press on a name removes one crown (iPhone has no contextmenu, so time the touch ourselves)
let kingHeld = false, kingTimer = 0;
function unKing(n) { const k = weekKey(); if (state.kings[n] && state.kings[n][k]) { state.kings[n][k]--; save(); rerender(); toast(`כתר אחד של ${n} בוטל`); if (navigator.vibrate) navigator.vibrate(15); } else toast(`ל${n} אין כתרים השבוע`); }
document.addEventListener('touchstart', e => { const b = e.target.closest('[data-king]'); if (!b) return; kingHeld = false; clearTimeout(kingTimer); kingTimer = setTimeout(() => { kingHeld = true; unKing(b.dataset.king); }, 550); }, { passive: true });
['touchend', 'touchmove', 'touchcancel'].forEach(ev => document.addEventListener(ev, () => clearTimeout(kingTimer), { passive: true }));
document.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('pmfold')) state.pmOptsOpen = e.target.open; }, true);
document.addEventListener('contextmenu', e => { if (e.target.closest('[data-king]')) { e.preventDefault(); if (!('ontouchstart' in window)) unKing(e.target.closest('[data-king]').dataset.king); } });
document.addEventListener('touchstart', e => { if (e.target.closest('[data-swipe]')) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; sdx = 0; swiping = false; } }, { passive: true });
document.addEventListener('touchmove', e => {
  if (sx == null) return;
  const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
  if (!swiping && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) swiping = true;
  if (!swiping) return;
  sdx = dx;
  const el = $('#view .lessons'); if (el) { el.style.transition = 'none'; el.style.transform = `translateX(${dx * 0.45}px) rotate(${dx * 0.004}deg)`; el.style.opacity = String(1 - Math.min(Math.abs(dx) / 600, 0.35)); }
}, { passive: true });
document.addEventListener('touchend', () => {
  if (sx == null) return;
  sx = null;
  const el = $('#view .lessons');
  const back = () => { if (el) { el.style.transition = 'transform .45s var(--spring), opacity .3s'; el.style.transform = ''; el.style.opacity = ''; } };
  if (!swiping || Math.abs(sdx) < 70) { back(); return; }
  const w = pickWeek(), sel = currentSelDay(w);
  const i = w.days.findIndex(d => d.dow === sel), j = sdx > 0 ? i + 1 : i - 1;
  if (!w.days[j]) {
    // past the last (or before the first) day: move to the next / previous week
    const ws = sortedWeeks(), nw = ws[ws.indexOf(w) + (sdx > 0 ? 1 : -1)];
    if (!nw) { back(); toast(sdx > 0 ? 'זה השבוע האחרון שהועלה' : 'זה השבוע הראשון'); return; }
    if (navigator.vibrate) navigator.vibrate(10);
    state.viewWeekId = nw === realWeek() ? null : nw.id; state.dayDow = (sdx > 0 ? nw.days[0] : nw.days[nw.days.length - 1]).dow; state.open = {};
    rerender(); toast(nw.number ? `שבוע ${nw.number}` : 'שבוע ' + (nw.range || ''));
    const nl2 = $('#view .lessons'); if (nl2) { nl2.classList.remove('slide-l', 'slide-r'); void nl2.offsetWidth; nl2.classList.add(sdx > 0 ? 'slide-l' : 'slide-r'); }
    return;
  }
  if (navigator.vibrate) navigator.vibrate(6);
  state.dayDow = w.days[j].dow; rerender();
  const nl = $('#view .lessons');
  if (nl) { nl.classList.remove('slide-l', 'slide-r'); void nl.offsetWidth; nl.classList.add(sdx > 0 ? 'slide-l' : 'slide-r'); }
}, { passive: true });

// ================================================================ iPhone widget + notifications (Scriptable)
function widgetData(w) {
  const sec = (d, re) => ((w.prep[d.dow] || []).find(s => re.test(s.title)) || { items: [] }).items.map(i => i.text);
  return {
    kita: 2, title: w.number ? 'שבוע ' + w.number : w.title, year: w.year, name: state.name,
    notify: state.prefs.notify ? state.prefs.notifyTime : null,
    bdays: state.kids.filter(k => k.bd).map(k => ({ n: k.name, d: k.bd })),
    days: w.days.map(d => ({
      name: d.name, date: d.date, dow: d.dow,
      print: sec(d, /ערב|הדפסה/), bring: sec(d, /להכין|להביא/),
      periods: d.periods.filter(p => p.start).map(p => {
        const L = look(p);
        return { label: p.label, start: p.start, end: p.end, title: p.title, subj: L.n, c: L.c, need: (p.materials[0] || {}).text || '' };
      }),
    })),
  };
}
async function sendToWidget(w) {
  try { await navigator.clipboard.writeText(JSON.stringify(widgetData(w))); } catch { toast('לא הצלחתי להעתיק 😕'); return; }
  toast('מעבירה לווידג׳ט… 📲');
  setTimeout(() => { location.href = 'scriptable:///run/' + encodeURIComponent('הכיתה שלי') + '?update=1'; }, 400);
}
async function copyWidgetCode() {
  try { await navigator.clipboard.writeText(await (await fetch('widget/kita-widget.js')).text()); toast('הקוד הועתק – עכשיו מדביקים ב־Scriptable 📋'); }
  catch { toast('לא הצלחתי להעתיק 😕'); }
}

// ================================================================ toys
let toastT;
function toast(msg, ms = 2800, action) {
  const t = $('#toast'); t.innerHTML = esc(msg) + (action ? ` <button class="tact" data-act="undo">${esc(action)}</button>` : ''); t.classList.toggle('hasact', !!action); t.classList.add('show');
  if (!action) state._undo = null;
  clearTimeout(toastT); if (ms) toastT = setTimeout(() => t.classList.remove('show'), ms);
}
const COLORS_FUN = ['#A67AF3', '#F6D38A', '#F6B7CF', '#9DD6F9', '#B8D88E', '#F6C28B'];
const COLORS_LUXE = ['#C9A86A', '#E8D5A8', '#B8935A', '#F4EBDD', '#A894D0', '#DCC59A'];
const palette = () => document.documentElement.dataset.skin === 'colorful' ? COLORS_FUN : COLORS_LUXE;
function confetti() {
  const box = $('#confetti');
  for (let i = 0; i < 60; i++) {
    const s = document.createElement('i');
    s.style.left = Math.random() * 100 + 'vw';
    s.style.background = palette()[i % 6];
    s.style.setProperty('--dx', (Math.random() * 180 - 90) + 'px');
    s.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
    s.style.animationDelay = Math.random() * 0.25 + 's';
    s.style.animationDuration = 1.4 + Math.random() * 0.9 + 's';
    if (i % 3 === 0) s.style.borderRadius = '50%';
    box.appendChild(s);
    setTimeout(() => s.remove(), 2700);
  }
}
function miniBurst(el) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = el.getBoundingClientRect(), box = $('#confetti');
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('b'), a = (i / 10) * Math.PI * 2;
    s.style.left = r.left + r.width / 2 + 'px'; s.style.top = r.top + r.height / 2 + 'px';
    s.style.background = palette()[i % 6];
    s.style.setProperty('--x', Math.cos(a) * 34 + 'px'); s.style.setProperty('--y', Math.sin(a) * 34 + 'px');
    box.appendChild(s); setTimeout(() => s.remove(), 700);
  }
}

// keep "now" fresh
setInterval(() => { if (state.tab === 'now' && !document.hidden && !document.activeElement.matches('input, textarea') && !$('#overlay.show')) rerender(); }, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (sync.pending) push(); return; }
  if (wantAwake || T.running) wakeOn();
  if (sync.user) pull().then(() => { if (!$('#overlay.show') && !document.activeElement.matches('input, textarea')) rerender(); });
  else if (!$('#overlay.show')) rerender();
});
addEventListener('resize', moveTabInd);

applyPrefs();
{ const mb = $('.minibar .mb-logo'); if (mb) mb.outerHTML = logo('mlogo'); }
// updates: check whenever the app comes back to the screen, and switch to the new version by itself
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadSW = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
  let swap = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadSW || swap) return; swap = true;
    const go = () => location.reload();
    if (!$('#overlay.show')) go(); else document.addEventListener('visibilitychange', () => { if (document.hidden) go(); }, { once: true });
  });
}
ensureClasses();
if (state.prefs.pinHash) showLock();
{ const g = new URLSearchParams(location.search).get('go'); if (g && VIEWS[g]) state.tab = g; }
setTimeout(() => { const l = +localStorage.getItem('hk-snap') || 0; if (Date.now() - l > 20 * 3600e3) dailySnap(); }, 5000);
render(true);
initAuth();
welcome();
