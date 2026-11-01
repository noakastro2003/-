import * as pdfjsLib from '../vendor/pdf.min.mjs';
import { parsePlanPdf, DAY_NAMES } from './planparse.js';
import { ic, art, spark, squiggle, miniArt, fileBadge } from './icons.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

// ================================================================ state
const KEY = 'noa-planner-v1';
const SAVED = ['weeks', 'activeId', 'checks', 'pins', 'name', 'logs', 'kids', 'todos', 'prefs', 'picked', 'groups'];
const state = Object.assign({
  weeks: {}, activeId: null, checks: {}, pins: {}, name: 'נועה', logs: {}, kids: [], todos: [],
  prefs: {}, picked: [], groups: 5,
  q: '', fsub: '', tab: 'now', dayDow: null, prepDow: null, open: {}, sec: {}, prepEdit: false,
}, load());
state.prefs = Object.assign({ size: 1, theme: 'auto', notify: true, notifyTime: '07:00' }, state.prefs);
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function save() {
  const o = {};
  for (const k of SAVED) o[k] = state[k];
  localStorage.setItem(KEY, JSON.stringify(o));
}

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

function pickWeek() {
  const ws = Object.values(state.weeks);
  if (!ws.length) return null;
  const t = now(); t.setHours(0, 0, 0, 0);
  for (const w of ws) {
    const ds = weekDates(w).filter(Boolean);
    if (!ds.length) continue;
    const sun = addDays(ds[0], -ds[0].getDay()), sat = addDays(sun, 6);
    if (t >= sun && t <= sat) return w;
  }
  if (state.activeId && state.weeks[state.activeId]) return state.weeks[state.activeId];
  return ws.sort((a, b) => (a.id < b.id ? 1 : -1))[0];
}
const todayInWeek = w => w.days[weekDates(w).findIndex(d => sameDay(d, now()))] || null;
const nextSchoolDay = (w, afterDow) => w.days.find(d => d.dow > afterDow) || null;
const upcomingDay = w => w.days.find(d => dayDate(w, d) > now()) || null;

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
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/(\d{1,2})\s*[./\-]\s*(\d{1,2})(?:\s*[./\-]\s*\d{2,4})?/);
    const name = l.replace(m ? m[0] : '', '').replace(/[–\-:,|]+\s*$/, '').replace(/^\s*[–\-:,|]+/, '').trim();
    return name ? { name, bd: m ? `${+m[1]}.${+m[2]}` : '' } : null;
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
const LINES = [
  'את עושה עבודה מדהימה', 'יום של דברים קטנים וטובים', 'הכיתה שלך בידיים טובות',
  'נושמים, מחייכים, מתחילים', 'בזכותך כל ילד מרגיש שרואים אותו', 'קפה, תוכנית, וזהו – את מוכנה',
  'גם יום עמוס נגמר בחיוך', 'הילדים שלך בני מזל שיש להם אותך', 'צעד אחד בכל פעם', 'את מתוכננת. הכל בפנים.',
];
const greet = () => { const h = now().getHours(); return h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 16 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב'; };
const line = () => { const d = now(); return LINES[(d.getDate() + d.getMonth() * 31) % LINES.length]; };

function top(title, sub, illus, opts = {}) {
  const dot = state.todos.some(todoDue) || bdOn(now()).length;
  return `<header class="top">
    <div class="brandrow">
      <div class="brand">${opts.back ? `<button class="back" data-go="${opts.back}" aria-label="חזרה">${ic('chevR')}</button>` : ''}<span>הכיתה שלי${spark('b')}${squiggle('s')}</span></div>
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
  return `<div class="ring" style="--p:${p}"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="rt"/><circle cx="50" cy="50" r="44" class="rv" pathLength="100"/></svg>
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
function fileRow(f, compact) {
  const pin = !!state.pins[f.url];
  const u = f.uses && f.uses[0];
  const meta = u ? `${ic('folder')}${esc(look(u.p).n)} · ${f.uses.length > 2 ? `${f.uses.length} פעמים השבוע` : [...new Set(f.uses.map(x => 'יום ' + DAY_SHORT[x.d.dow]))].join(', ')}` : '';
  return `<div class="file ${compact ? 'compact' : ''}">
    <a href="${esc(f.url)}" target="_blank" rel="noopener">${fileBadge(fileKind(f))}<span class="fx"><b>${esc(f.text)}</b>${meta && !compact ? `<small>${meta}</small>` : ''}</span>${compact ? ic('chevL', 'chev') : ''}</a>
    ${compact ? '' : `<button class="star ${pin ? 'on' : ''}" data-pin="${esc(f.url)}" data-pintext="${esc(f.text)}" aria-label="נעיצה">${ic(pin ? 'starFill' : 'star')}</button>`}
  </div>`;
}

// ================================================================ NOW
function viewNow(w) {
  const day = todayInWeek(w);
  const t = now();
  const ph = day ? phase(day) : { kind: 'free' };
  const teaser = (t.getDay() === 5 && ph.kind === 'after') || t.getDay() === 6
    ? `<button class="card teaser" data-go="summary">${art('medal')}<span class="grow"><b>סיכום השבוע מוכן</b><small>מה הספקנו, מה עובר הלאה</small></span>${ic('chevL', 'chev')}</button>` : '';
  let h = '';

  if (ph.kind === 'lesson') {
    h += top('עכשיו', `${greet()}, ${esc(state.name)} · ${line()}`, 'books');
    h += birthdayBanner();
    h += nowCard(w, day, ph.cur, ph) + quickTools();
    if (ph.next) h += nextCard(day, ph.next, ph.inMin);
  } else if (ph.kind === 'break') {
    h += top('הפסקה', `${inText(ph.inMin)} · נושמים רגע ☕`, 'books');
    h += birthdayBanner();
    h += nowCard(w, day, ph.next, { kind: 'preview', inMin: ph.inMin }) + quickTools();
  } else if (ph.kind === 'before') {
    h += top(`${greet()}, ${esc(state.name)}`, `יום ${day.name} · מתחילים ב־${ph.next.start}`, 'books');
    h += birthdayBanner();
    h += prepCards(w, day, 'today');
    h += nextCard(day, ph.next, ph.inMin, 'השיעור הראשון');
  } else if (ph.kind === 'after') {
    h += top('סיימת את היום 🎉', `${line()} 💜`, 'books');
    h += birthdayBanner() + teaser;
    const S = dayStats(w, day);
    h += `<div class="card bravo"><div class="grow"><b>כל הכבוד,</b><span>סיימת ${day.periods.length} שיעורים${S.total ? ` ו־${S.done} מתוך ${S.total} משימות` : ''}</span></div>${art('medal', 'wiggle')}</div>`;
    const nd = nextSchoolDay(w, day.dow);
    if (nd) h += tomorrowCard(w, nd);
    h += howWasCard(w, day);
    h += `<div class="card rest"><div class="grow"><b>מנוחה נעימה!</b><span>${ic('heart', 'h')} תתחדשי מחר ליום חדש ומוצלח</span></div>${art('moon', 'bob')}</div>`;
  } else {
    h += top(t.getDay() === 6 ? 'שבת שלום' : 'יום חופשי', 'אין שיעורים היום. תנוחי, מגיע לך 💜', 'books');
    h += birthdayBanner() + teaser;
    const nd = upcomingDay(w);
    if (nd) h += tomorrowCard(w, nd);
    h += `<div class="card rest"><div class="grow"><b>יום של מנוחה</b><span>${ic('heart', 'h')} קפה, ספר, ושקט</span></div>${art('moon', 'bob')}</div>`;
  }

  if (day && ['lesson', 'break', 'before'].includes(ph.kind)) {
    const ref = ph.kind === 'lesson' ? ph.next : ph.next;
    const rest = ref ? day.periods.filter(p => mins(p.start) > mins(ref.start)) : [];
    if (rest.length) h += `<div class="card">${cardHead('calendar', 'ובהמשך היום')}${rest.map(p => miniRow(w, day, p)).join('')}</div>`;
  }
  h += remindersCard(w);
  return h;
}

function quickTools() {
  return `<div class="quick">
    <button data-act="timer">${ic('timer')}טיימר</button>
    <button data-act="picker">${ic('dice')}מי עונה?</button>
    <button data-act="wake" class="${wakeLock ? 'on' : ''}">${ic('sun')}מסך דלוק</button>
  </div>`;
}

function nowCard(w, day, p, ph) {
  const id = `${day.dow}:${p.label}`;
  const secs = p.sections;
  const si = Math.min(secs.length - 1, state.sec[id] ?? Math.max(0, Math.min(secs.length - 1, Math.floor((ph.pct || 0) * secs.length))));
  const needs = p.materials.map((m, i) => chk(`m:${id}:${i}`, ck(w, `m:${id}:${i}`), esc(m.text))).join('');
  const files = p.links.filter(l => l.url).map(l => fileRow({ url: l.url, text: l.text }, true)).join('');
  const sub = p.subtitle.split('·').slice(1).join('·').trim();
  return `<article class="card nowc" style="--c:${look(p).c}">
    <div class="nc-top">
      <div class="nc-t">${pill(p)}<h2>${logIcon(w, id)}${esc(p.title)}</h2>${sub ? `<small>${esc(sub)}</small>` : ''}</div>
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
    ${timerHint(p)}
    ${ph.kind === 'lesson' ? `<div class="tline">${ic('clock')}<span>${ph.left} דק׳ מתוך ${ph.len} דק׳</span><div class="bar"><span style="--w:${Math.round(ph.pct * 100)}%"></span></div></div>${logRow(w, id, false)}` : ''}
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
    ${first ? row(ic('alarm'), `<span class="tpill">${esc(first.start)}</span>`, esc(first.title), `data-goto="${nd.dow}|${esc(first.label)}"`) : ''}
    ${pr && pr.items.length ? row(ic('printer'), '<b>להדפיס בבוקר:</b>', `${pr.items.length} פריטים`, `data-pday="${nd.dow}"`) : ''}
    ${br && br.items.length ? row(ic('backpack'), '<b>להביא:</b>', esc(br.items.slice(0, 2).map(i => i.text.split('–')[0].trim()).join(', ')) + (br.items.length > 2 ? ` ועוד ${br.items.length - 2}` : ''), `data-pday="${nd.dow}"`) : ''}
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
  let h = top('השבוע', `${esc(w.number ? 'שבוע ' + w.number : 'השבוע')}${w.cls ? ' · ' + esc(w.cls) : ''} · <bdi dir="ltr">${esc(w.range || '')}</bdi>`, 'heart');
  if (sel === 'all') {
    h += `<div class="card daypick">${dayChips(w, sel)}</div>`;
    h += `<div class="card gridcard">${gridView(w)}</div><p class="hint">לוחצים על שיעור כדי לפתוח אותו</p>` + bdCard(7, 'ימי הולדת בשבוע הקרוב');
    return h;
  }
  const day = w.days.find(d => d.dow === sel);
  const isToday = todayInWeek(w) === day;
  const ph = isToday ? phase(day) : null;
  const left = isToday && ph.kind !== 'after' ? day.periods.filter(p => mins(p.end) > nowMin()).length : null;
  const load = day.periods.length <= 6 ? 'היום נראה רגוע' : day.periods.length <= 8 ? 'היום נראה טוב' : 'יום עמוס – יש לך את זה';
  h += `<div class="card daypick">
    <div class="dp-pills"><span class="spill">${ic('sun')}${isToday ? load : `יום ${day.name} · ${day.date}`}</span><span class="spill">${ic('calendar')}${left != null ? `עוד ${left} שיעורים` : `${day.periods.length} שיעורים`}</span></div>
    ${dayChips(w, sel)}
  </div>`;
  const bd = state.kids.length ? bdOn(dayDate(w, day)) : [];
  if (bd.length) h += `<div class="card bday small">${art('cake', 'bob')}<div><b>יום הולדת ל${esc(names(bd))} 🎉</b></div></div>`;
  h += `<div class="lessons" data-swipe>${day.periods.map(p => lessonRow(w, day, p, ph)).join('')}</div>`;
  h += `<button class="addbtn" data-edit="${day.dow}|">${ic('plus')} הוספת שיעור ליום ${esc(day.name)}</button>`;
  const hw = day.periods.filter(p => p.homework.length);
  if (hw.length) h += `<div class="card">${cardHead('homework', 'שיעורי בית היום')}${hw.map(p => `<div class="note"><b>${esc(p.title)}</b><span>${esc(p.homework.join(' · '))}</span></div>`).join('')}</div>`;
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
      <span class="lr-t"><b>${logIcon(w, id)}${esc(p.title)}</b>${isNow ? '<i class="live">עכשיו</i>' : ''}</span>
      <span class="lr-time">${esc(p.start)}–${esc(p.end)}</span>
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
      ${p.links.length ? `<div class="sub">${cardHead('folder', 'קבצים')}${p.links.map(l => l.url ? fileRow({ url: l.url, text: l.text }, true) : `<div class="file compact off"><span class="a">${fileBadge('doc')}<span class="fx"><b>${esc(l.text)}</b><small>בלי קישור</small></span></span></div>`).join('')}</div>` : ''}
      ${timerHint(p)}
      ${logRow(w, id, false)}
      <button class="editbtn" data-edit="${esc(day.dow + '|' + p.label)}">${ic('pencil')} עריכת השיעור</button>
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
      ? `<div class="erow1"><span class="grow">${esc(it.text)}</span><button class="iconbtn" data-delprep="${day.dow}|${si}|${i}" aria-label="מחיקה">${ic('trash')}</button></div>`
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
  let h = top('להכין', 'הכנה מסודרת ליום הלימודים – כדי שהכל יהיה מוכן ובזמן', 'notepad');
  h += `<div class="card daypick">${dayChips(w, day.dow, 'data-pday', false)}</div>`;
  if (!w.prep[day.dow] || !w.prep[day.dow].length) {
    w.prep[day.dow] = [{ title: 'להכין / להביא', icon: '', items: day.periods.flatMap(p => p.materials.map(m => ({ text: m.text, period: p.label }))) }];
  }
  const S = dayStats(w, day);
  h += `<div class="card progress">
    <div class="pg-h"><span class="spill">${ic('target')}התקדמות יום ${esc(day.name)}</span><b><span class="num">${S.done}</span> מתוך ${S.total} הושלמו</b></div>
    <div class="bar big"><span style="--w:${S.total ? S.done / S.total * 100 : 0}%"></span></div>
  </div>`;
  h += prepCards(w, day, 'all');
  h += `<button class="addbtn" data-act="prepedit">${ic(state.prepEdit ? 'check' : 'pencil')} ${state.prepEdit ? 'סיימתי לערוך' : 'עריכת הרשימות'}</button>`;
  const left = S.total - S.done;
  h += left
    ? `<div class="card almost"><div class="grow"><b>${left <= 3 ? 'כמעט שם!' : 'יאללה, מתקדמות!'}</b><span>עוד ${left} משימות להשלמת היום</span></div>${art('mountain')}</div>`
    : `<div class="card almost done"><div class="grow"><b>הכל מוכן! 🎉</b><span>את מוכנה ליום ${esc(day.name)}</span></div>${art('star', 'wiggle')}</div>`;
  return h;
}

// ================================================================ FILES
function viewFiles(w) {
  const files = collectFiles(w);
  const q = state.q.trim(), fs = state.fsub;
  const subjOf = f => look(f.uses[0].p).n;
  const kindWord = f => ({ ppt: 'מצגת', folder: 'תיקייה', sheet: 'טבלה', pdf: 'pdf' }[fileKind(f)] || 'דף מסמך');
  const match = f => (!q || (f.text + ' ' + f.uses.map(u => u.p.title).join(' ') + ' ' + kindWord(f)).includes(q)) && (!fs || subjOf(f) === fs);
  const subs = [...new Set(files.map(subjOf))];
  let h = top('קבצים', 'כל הקבצים של הכיתה במקום אחד, נגישים ומהירים', 'folder');
  h += `<label class="search">${ic('search')}<input id="fq" type="search" placeholder="חיפוש קובץ" value="${esc(state.q)}"></label>`;
  h += `<div class="fchips"><button class="fc ${!fs ? 'on' : ''}" data-fsub="">${ic('layers')}הכל</button>${subs.map(s => `<button class="fc ${fs === s ? 'on' : ''}" data-fsub="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
  const pinned = Object.entries(state.pins).map(([url, text]) => files.find(f => f.url === url) || { url, text, uses: [] }).filter(f => !f.uses.length ? !q && !fs : match(f));
  if (pinned.length) h += `<div class="card pinned">${cardHead('starFill', 'תמיד בשלוף', spark())}${pinned.map(f => fileRow(f)).join('')}</div>`;
  else if (!q && !fs) h += `<p class="hint">טיפ: לוחצים על ☆ ליד קובץ – והוא יישאר כאן למעלה, בכל שבוע.</p>`;
  const rest = files.filter(f => !state.pins[f.url] && match(f));
  if (rest.length) h += `<h4 class="sect">כל הקבצים</h4>${rest.map(f => `<div class="card fcard">${fileRow(f)}</div>`).join('')}`;
  if (!files.length) h += `<p class="hint">אין קישורים לדרייב בתכנון של השבוע.</p>`;
  else if (!pinned.length && !rest.length) h += `<p class="hint">לא מצאתי "${esc(q)}" 🤔</p>`;
  return h;
}

// ================================================================ MORE + sub screens
function viewMore(w) {
  const weeks = Object.values(state.weeks).sort((a, b) => (a.id < b.id ? 1 : -1));
  return top('עוד', 'כלים קטנים שעושים את היום קל יותר', 'star') + `
  <div class="toolgrid">
    ${[['timer', 'טיימר', 'data-act="timer"'], ['dice', 'מי עונה?', 'data-act="picker"'], ['grid', 'מערכת', 'data-day="all"'],
      ['chart', 'סיכום שבוע', `data-go="summary" ${w ? '' : 'disabled'}`], ['cake', 'הכיתה שלי', 'data-go="kids"'], ['pin', 'תזכורות', 'data-go="todos"']]
      .map(([i, t, a]) => `<button ${a}><span class="ti">${ic(i)}</span>${t}</button>`).join('')}
  </div>
  <button class="card setlink" data-go="settings"><span class="chi">${ic('settings')}</span><span class="grow"><b>הגדרות</b><small>תצוגה, התראות בוקר, ווידג׳ט, גיבוי</small></span>${ic('chevL', 'chev')}</button>
  ${bdCard(14, 'ימי הולדת בשבועיים הקרובים')}
  <div class="card">
    ${cardHead('upload', 'תכנון שבועי')}
    <button class="cta" data-act="upload">${ic('upload')} להעלות תכנון של שבוע חדש</button>
    <p class="hint">מעלים את ה־PDF של התכנון. שבוע עם אותם תאריכים יוחלף.</p>
    ${weeks.map(x => `<div class="wrow ${w && x.id === w.id ? 'on' : ''}">
      <button class="wsel" data-week="${esc(x.id)}"><b>${esc(x.number ? 'שבוע ' + x.number : x.title)}</b><small dir="ltr">${esc(x.range || '')}</small></button>
      <button class="iconbtn" data-delweek="${esc(x.id)}" aria-label="מחיקה">${ic('trash')}</button>
    </div>`).join('')}
  </div>
  <p class="foot">${ic('heart', 'h')} נבנה באהבה בשביל ${esc(state.name)}</p>`;
}

function viewSettings(w) {
  const P = state.prefs;
  const toggle = (key, on) => `<button class="switch ${on ? 'on' : ''}" data-toggle-pref="${key}" role="switch" aria-checked="${on}"><i></i></button>`;
  return top('הגדרות', 'שהכל יעבוד בדיוק כמו שנוח לך', 'star', { back: 'more' }) + `
  <div class="card">
    ${cardHead('user', 'פרטים')}
    <label class="field">איך לקרוא לך?<input id="nameIn" value="${esc(state.name)}"></label>
  </div>
  <div class="card">
    ${cardHead('sparkle', 'תצוגה')}
    <div class="setrow"><span>גודל טקסט</span><div class="seg">${[0.9, 1, 1.15, 1.3].map((v, i) => `<button class="${P.size === v ? 'on' : ''}" data-size="${v}" style="font-size:${13 + i * 3}px">א</button>`).join('')}</div></div>
    <div class="setrow"><span>מצב</span><div class="seg">${[['light', 'sun', 'יום'], ['dark', 'moon', 'לילה'], ['auto', 'sparkle', 'אוטו׳']].map(([v, i, l]) => `<button class="${P.theme === v ? 'on' : ''}" data-theme="${v}">${ic(i)}${l}</button>`).join('')}</div></div>
  </div>
  <div class="card">
    ${cardHead('bell', 'התראת בוקר')}
    <div class="setrow"><span>התראה כל בוקר עם מה להכין להיום</span>${toggle('notify', P.notify)}</div>
    <div class="setrow ${P.notify ? '' : 'off'}"><span>באיזו שעה?</span><input type="time" id="notifyTime" value="${esc(P.notifyTime)}"></div>
    <p class="hint">באייפון ההתראות מגיעות דרך Scriptable (אותה אפליקציה של הווידג׳ט). אחרי כל שינוי או תכנון חדש – לוחצים "עדכון הווידג׳ט וההתראות".</p>
  </div>
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
  <button class="danger" data-act="wipe">${ic('trash')} מחיקת כל המידע מהטלפון</button>`;
}

function viewTodos(w) {
  return top('תזכורות', 'הדברים הקטנים שלא רוצים לשכוח', 'notepad', { back: 'more' }) + remindersCard(w, true) +
    `<p class="hint">תזכורת עם תאריך תופיע ב"עכשיו" מהיום הזה. בלי תאריך – תמיד.</p>` +
    (state.todos.some(t => t.done) ? `<button class="cta soft" data-act="cleartodos">לנקות את מה שסימנתי ✓</button>` : '');
}

function viewKids() {
  const txt = state.kids.map(k => `${k.name}${k.bd ? ' ' + k.bd : ''}`).join('\n');
  const t = now(); t.setHours(0, 0, 0, 0);
  const up = state.kids.filter(k => k.bd).map(k => {
    const [d, m] = k.bd.split('.').map(Number);
    let x = new Date(t.getFullYear(), m - 1, d); if (x < t) x = new Date(t.getFullYear() + 1, m - 1, d);
    return { k, x, days: Math.round((x - t) / 864e5) };
  }).sort((a, b) => a.days - b.days);
  return top('הכיתה שלי', 'שמות וימי הולדת – כדי שאף אחד לא יישכח', 'cake', { back: 'more' }) + `
  <div class="card">
    ${cardHead('users', 'הילדים', `<span class="cnt">${state.kids.length}</span>`)}
    <p class="dim">שורה לכל ילד: שם ואז תאריך לידה (יום.חודש). אפשר להדביק רשימה שלמה.</p>
    <textarea id="kidsIn" rows="10" placeholder="דנה 12.3&#10;יואב 4.11&#10;מיה 28.6">${esc(txt)}</textarea>
    <button class="cta" data-act="savekids">שמירה</button>
    <p class="hint">נשמר רק בטלפון. משמש גם ל"מי עונה?" 🎲</p>
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
  const warm = ['שבוע שלם של נתינה. מגיע לך סופ״ש שקט', 'עוד שבוע מאחורייך – והילדים קיבלו ממך המון', 'כל הכבוד. באמת.', 'עשית שבוע מדהים. עכשיו – מנוחה'];
  const bds = w.days.flatMap(d => bdOn(dayDate(w, d)));
  const tile = (n, l) => `<div class="tile"><b class="num">${n}</b><span>${l}</span></div>`;
  const unmarked = S.all.length - S.done - S.part - S.skip;
  return top(`סיכום ${w.number ? 'שבוע ' + w.number : 'השבוע'}`, warm[(w.number || 0) % warm.length] + ' 💜', 'medal', { back: 'more' }) + `
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
  return top(`שלום ${esc(state.name)}`, 'כאן הכיתה שלך תהיה תמיד בכיס', 'books') + `
  <div class="card empty">
    ${art('books', 'bob')}
    <p>מעלים את קובץ התכנון השבועי (PDF) – ואני מסדרת: מה עכשיו, מה הבא, מה להכין.</p>
    <button class="cta" data-act="upload">${ic('upload')} להעלות את התכנון של השבוע</button>
    <p class="hint">הכל נשמר רק בטלפון שלך.</p>
  </div>`;
}

// ================================================================ overlays (sheet)
function openOverlay(html) {
  let o = $('#overlay');
  if (!o) { o = document.createElement('div'); o.id = 'overlay'; document.body.appendChild(o); }
  const already = o.classList.contains('show') && $('#overlay .ov');
  if (already) { $('#overlay .ov').outerHTML = html; return; }
  o.innerHTML = `<div class="ovbg" data-act="close"></div>${html}`;
  void o.offsetWidth; o.classList.add('show');
  document.body.classList.add('noscroll');
  renderTimerPill();
}
function closeOverlay() {
  const o = $('#overlay'); if (o) o.classList.remove('show');
  document.body.classList.remove('noscroll');
  setTimeout(renderTimerPill, 50);
}

// ---------------------------------------------------------------- lesson editor
const LABELS = ['בוקר', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
function editor(w, dow, label) {
  const day = w.days.find(d => d.dow === dow);
  const p = label ? day.periods.find(x => x.label === label) : null;
  const e = p || { label: '', start: '', end: '', title: '', subtitle: '', subject: '', sections: [{ label: 'פתיחה', text: '' }, { label: 'גוף השיעור', text: '' }, { label: 'סיום', text: '' }], materials: [], homework: [], links: [], badges: [] };
  const L = look(e);
  const used = day.periods.map(x => x.label);
  const row = (type, a = '', b = '') => {
    if (type === 'sections') return `<div class="erow"><input class="ea" value="${esc(a)}" placeholder="כותרת (פתיחה…)"><textarea class="eb" rows="2" placeholder="מה עושים">${esc(b)}</textarea><button type="button" class="iconbtn" data-delrow>${ic('x')}</button></div>`;
    if (type === 'links') return `<div class="erow two"><input class="ea" value="${esc(a)}" placeholder="שם הקובץ"><input class="eb" value="${esc(b)}" placeholder="קישור (https://…)" dir="ltr"><button type="button" class="iconbtn" data-delrow>${ic('x')}</button></div>`;
    return `<div class="erow one"><input class="ea" value="${esc(a)}" placeholder="${type === 'materials' ? 'למשל: דף עבודה – שכפול 26' : 'למשל: עמ׳ 12'}"><button type="button" class="iconbtn" data-delrow>${ic('x')}</button></div>`;
  };
  editor.row = row;
  openOverlay(`<form class="ov sheet editor" data-editor="${dow}|${esc(label || '')}">
    <button type="button" class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('pencil')}<h2>${p ? 'עריכת שיעור' : 'שיעור חדש'} · יום ${esc(day.name)}</h2></div>
    <label class="field">שם השיעור<input name="title" value="${esc(e.title)}" required placeholder="למשל: הקיוסק של בולי"></label>
    <div class="frow">
      <label class="field">מקצוע<select name="subject">${SUBJ.map(s => s[1]).concat(['אחר']).map(n => `<option ${L.n === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field">שעה<select name="label">${LABELS.map(l => `<option value="${l}" ${e.label === l ? 'selected' : ''} ${used.includes(l) && l !== e.label ? 'disabled' : ''}>${l === 'בוקר' ? 'בוקר' : 'שעה ' + l}</option>`).join('')}</select></label>
    </div>
    <div class="frow">
      <label class="field">התחלה<input type="time" name="start" value="${esc(e.start)}" required></label>
      <label class="field">סיום<input type="time" name="end" value="${esc(e.end)}" required></label>
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
  const p = Object.assign(old || {}, {
    label: f.label.value, start: f.start.value, end: f.end.value, title: f.title.value.trim(),
    subject: subj === 'אחר' ? '' : subj, subtitle: (subj === 'אחר' ? '' : subj) + (sub ? ' · ' + sub : ''),
    sections: get('sections').filter(([a, b]) => a || b).map(([label, text]) => ({ label, text })),
    materials: get('materials').filter(([a]) => a).map(([text]) => ({ text })),
    homework: get('homework').filter(([a]) => a).map(([a]) => a),
    links: get('links').filter(([a, b]) => a || b).map(([text, url]) => ({ text: text || url, url: /^https?:/.test(url) ? url : '' })),
    badges: old ? old.badges : [], edited: true,
  });
  if (!old) day.periods.push(p);
  day.periods.sort((a, b) => mins(a.start) - mins(b.start));
  if (old && oldLabel !== p.label) moveKeys(w, `${dow}:${oldLabel}`, `${dow}:${p.label}`);
  save(); closeOverlay(); state.open[`${dow}:${p.label}`] = true; rerender(); toast('נשמר 💜');
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
    <button class="cta" data-act="tstart">${ic('play')} יאללה, מתחילים</button>
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
    else { bell(3); T.running = false; clearInterval(tInt); wakeOff(); msg('הזמן נגמר! 🎉'); confetti(); }
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
function pickerScreen() {
  const kids = state.kids.map(k => k.name);
  const mode = state.pickMode || (kids.length ? 'kids' : 'groups');
  state.pickMode = mode;
  const left = kids.filter(k => !state.picked.includes(k)).length;
  openOverlay(`<div class="ov picker">
    <button class="ovx" data-act="close" aria-label="סגירה">${ic('x')}</button>
    <div class="ovh">${ic('dice')}<h2>מי עונה?</h2></div>
    <div class="seg wide"><button class="${mode === 'kids' ? 'on' : ''}" data-pmode="kids">${ic('user')}ילדים</button><button class="${mode === 'groups' ? 'on' : ''}" data-pmode="groups">${ic('users')}קבוצות</button></div>
    ${mode === 'groups' ? `<div class="stepper"><button data-pg="-1">−</button><div><b>${state.groups}</b><span>קבוצות</span></div><button data-pg="1">＋</button></div>` : ''}
    ${mode === 'kids' && !kids.length ? `<p class="dim">עוד אין רשימת ילדים.</p><button class="cta soft" data-go="kids">להוסיף את הילדים</button>` : `
    <div class="pname" id="pName">${art('star', 'bob')}</div>
    <button class="cta" data-act="pick">${ic('dice')} הגרלה!</button>
    ${mode === 'kids' ? `<p class="hint" id="pLeft">בלי חזרות: נשארו ${left} מתוך ${kids.length} · <button class="linkbtn" data-act="preset">להתחיל מחדש</button></p>` : ''}`}
  </div>`);
}
function doPick() {
  const kids = state.kids.map(k => k.name);
  let pool;
  if (state.pickMode === 'books') { pool = kids.filter(k => !state.picked.includes(k)); if (!pool.length) { state.picked = []; pool = kids.slice(); } }
  else pool = Array.from({ length: state.groups }, (_, i) => `קבוצה ${i + 1}`);
  const win = pool[Math.floor(Math.random() * pool.length)];
  const el = $('#pName'); let n = 0;
  el.classList.remove('win'); el.classList.add('spin');
  const step = () => {
    el.textContent = pool[Math.floor(Math.random() * pool.length)];
    if (++n < 18) setTimeout(step, 40 + n * n * 1.2);
    else {
      el.classList.remove('spin'); el.textContent = win; el.classList.add('win'); bell(1); miniBurst(el);
      if (state.pickMode === 'books') { state.picked.push(win); save(); const pl = $('#pLeft'); if (pl) pl.firstChild.textContent = `בלי חזרות: נשארו ${kids.length - state.picked.length} מתוך ${kids.length} · `; }
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
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#1C1924' : '#FAF7F4';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyPrefs);
let wakeLock = null;
async function wakeOn() { try { if (!wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch { /* unsupported */ } }
function wakeOff() { try { wakeLock && wakeLock.release(); } catch { /* fine */ } wakeLock = null; }

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
      if (!confirm('לשחזר מהגיבוי? המידע הנוכחי בטלפון יוחלף.')) return;
      Object.assign(state, j.data); save(); applyPrefs(); go('now'); toast('שוחזר! 💜');
    } catch { toast('זה לא קובץ גיבוי של האפליקציה 😕'); }
  };
  inp.click();
}

// ================================================================ render
const TABS = ['now', 'day', 'prep', 'files', 'more'];
const SUB = { kids: 'more', todos: 'more', summary: 'more', settings: 'more' };
const VIEWS = { now: viewNow, day: viewDay, prep: viewPrep, files: viewFiles, more: viewMore, kids: viewKids, todos: viewTodos, summary: viewSummary, settings: viewSettings };
let lastTab = null;
function render(animate) {
  const w = pickWeek();
  const tab = SUB[state.tab] || state.tab;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  moveTabInd();
  const v = $('#view');
  const needWeek = !['more', 'kids', 'todos', 'settings'].includes(state.tab);
  v.innerHTML = !w && needWeek ? viewEmpty() : VIEWS[state.tab](w);
  if (animate) {
    const a = TABS.indexOf(SUB[state.tab] || state.tab), b = TABS.indexOf(SUB[lastTab] || lastTab);
    const dir = lastTab == null ? 0 : a !== b ? Math.sign(a - b) : SUB[state.tab] ? 1 : -1;
    v.classList.remove('enter', 'from-l', 'from-r'); void v.offsetWidth;
    v.classList.add('enter', dir >= 0 ? 'from-l' : 'from-r');
    v.querySelectorAll('.card, .lrow, .toolgrid > button, .tile, .quick, .addbtn').forEach((el, i) => el.style.setProperty('--i', Math.min(i, 12)));
    countUp(v);
  } else v.classList.remove('enter');
  lastTab = state.tab;
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
document.addEventListener('click', e => {
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
  if (D.day != null && !t.disabled) { state.dayDow = D.day === 'all' ? 'all' : +D.day; if (state.tab !== 'day') go('day'); else rerender(); return; }
  if (D.pday != null) { state.prepDow = +D.pday; if (state.tab !== 'prep') go('prep'); else rerender(); return; }
  if (D.goto) {
    const [dow, lb] = D.goto.split('|');
    state.dayDow = +dow; state.open[`${dow}:${lb}`] = true; go('day');
    const el = document.querySelector(`.lrow[data-id="${CSS.escape(dow + ':' + lb)}"]`);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    return;
  }
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
  if (D.delweek) { if (confirm('למחוק את השבוע הזה מהטלפון?')) { delete state.weeks[D.delweek]; delete state.checks[D.delweek]; delete state.logs[D.delweek]; save(); rerender(); } return; }
  if (D.pin) { if (state.pins[D.pin]) delete state.pins[D.pin]; else { state.pins[D.pin] = D.pintext; miniBurst(t); } save(); setTimeout(rerender, 200); return; }
  if (D.fsub != null) { state.fsub = D.fsub; rerender(); return; }
  if (D.timer) { timerSetup(+D.timer, +(D.rounds || 1)); return; }
  if (D.tset) { timerSetup(+D.tset, T.setRounds); return; }
  if (D.tmin) { timerSetup(Math.max(1, Math.min(90, T.setMin + +D.tmin)), T.setRounds); return; }
  if (D.trnd) { timerSetup(T.setMin, Math.max(1, Math.min(12, T.setRounds + +D.trnd))); return; }
  if (D.pmode) { state.pickMode = D.pmode; pickerScreen(); return; }
  if (D.pg) { state.groups = Math.max(2, Math.min(12, state.groups + +D.pg)); save(); pickerScreen(); return; }
  if (D.size) { state.prefs.size = +D.size; save(); applyPrefs(); rerender(); return; }
  if (D.theme) { state.prefs.theme = D.theme; save(); applyPrefs(); rerender(); return; }
  if (D.deltodo) { state.todos = state.todos.filter(x => x.id !== D.deltodo); save(); rerender(); return; }
  switch (D.act) {
    case 'upload': $('#file').click(); break;
    case 'widget': sendToWidget(w); break;
    case 'widgetcode': copyWidgetCode(); break;
    case 'wake': if (wakeLock) { wakeOff(); toast('המסך יכבה כרגיל'); } else wakeOn().then(() => toast(wakeLock ? 'המסך יישאר דלוק 🔆' : 'הטלפון הזה לא מאפשר להשאיר מסך דלוק')); setTimeout(rerender, 300); break;
    case 'timer': if (T.running || (T.left > 0 && T.total)) timerScreen(); else timerSetup(state.lastMin || 5, 1); break;
    case 'tstart': state.lastMin = T.setMin; timerStart(); break;
    case 'tpause':
      if (T.running) { T.running = false; T.left = Math.max(0, (T.endAt - Date.now()) / 1000); }
      else if (T.left > 0) { T.running = true; T.endAt = Date.now() + T.left * 1000; clearInterval(tInt); tInt = setInterval(tick, 250); }
      tick(); break;
    case 'tplus': T.total += 60; if (T.running) T.endAt += 60000; else T.left += 60; tick(); break;
    case 'tstop': T.running = false; T.left = 0; T.total = 0; clearInterval(tInt); wakeOff(); closeOverlay(); break;
    case 'close': closeOverlay(); break;
    case 'topen': timerScreen(); break;
    case 'picker': pickerScreen(); break;
    case 'pick': doPick(); break;
    case 'preset': state.picked = []; save(); pickerScreen(); break;
    case 'savekids': state.kids = parseKids($('#kidsIn').value); save(); toast(`נשמר! ${state.kids.length} ילדים 💜`); rerender(); break;
    case 'cleartodos': state.todos = state.todos.filter(x => !x.done); save(); rerender(); break;
    case 'copycarry': navigator.clipboard.writeText(carryText(w, summary(w))).then(() => toast('הועתק 📋 אפשר להדביק בתכנון של השבוע הבא')).catch(() => toast('לא הצלחתי להעתיק 😕')); break;
    case 'prepedit': state.prepEdit = !state.prepEdit; rerender(); break;
    case 'dellesson': {
      const f = t.closest('form'); const [dow, lb] = f.dataset.editor.split('|');
      if (!confirm('למחוק את השיעור?')) return;
      const day = w.days.find(d => d.dow === +dow); day.periods = day.periods.filter(p => p.label !== lb);
      save(); closeOverlay(); rerender(); toast('השיעור נמחק'); break;
    }
    case 'export': exportBackup(); break;
    case 'import': importBackup(); break;
    case 'wipe': if (confirm('למחוק את כל המידע מהטלפון? אי אפשר לבטל.')) { localStorage.removeItem(KEY); location.reload(); } break;
  }
});
function findPeriod(w, id) { const [dow, lb] = id.split(':'); return w.days.find(d => d.dow === +dow).periods.find(p => p.label === lb); }

document.addEventListener('change', e => {
  const i = e.target;
  if (i.dataset.ck) {
    const w = pickWeek();
    setCk(w, i.dataset.ck, i.checked);
    const row = i.closest('.chk'); row.classList.toggle('on', i.checked);
    if (i.checked) { if (navigator.vibrate) navigator.vibrate(8); row.classList.remove('pop'); void row.offsetWidth; row.classList.add('pop'); }
    const card = i.closest('.card, .sub');
    const all = card && [...card.querySelectorAll('input[type=checkbox]')].every(x => x.checked);
    if (i.checked && all) confetti(); else if (i.checked) miniBurst(row.querySelector('.box'));
    if (state.tab === 'prep') setTimeout(rerender, 450);
    return;
  }
  if (i.dataset.todo) {
    const td = state.todos.find(x => x.id === i.dataset.todo);
    if (td) { td.done = i.checked; save(); i.closest('.chk').classList.toggle('on', i.checked); if (i.checked) miniBurst(i.closest('.chk').querySelector('.box')); }
    return;
  }
  if (i.dataset.lognote) { const w = pickWeek(), cur = getLog(w, i.dataset.lognote); if (cur) { cur.note = i.value; save(); toast('נשמר ✓', 1200); } return; }
  if (i.id === 'nameIn') { state.name = i.value.trim() || 'נועה'; save(); toast('נשמר ✓', 1200); }
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
  state.todos.push({ id: uid(), text, date: f.d && f.d.value ? f.d.value : null, done: false });
  save(); rerender(); toast('נוסף 📌', 1200);
});

$('#file').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  toast('קוראת את התכנון… 📖', 0);
  try {
    const wk = await parsePlanPdf(pdfjsLib, new Uint8Array(await f.arrayBuffer()));
    if (!wk.days.length) throw new Error('no days');
    state.weeks[wk.id] = wk; state.activeId = wk.id; save();
    const n = wk.days.reduce((a, d) => a + d.periods.length, 0);
    go('now');
    toast(`${wk.number ? 'שבוע ' + wk.number : 'השבוע'} נטען! ${wk.days.length} ימים, ${n} שיעורים 🎉`);
    confetti();
  } catch (err) {
    console.error(err);
    toast('לא הצלחתי לקרוא את הקובץ 😕 זה ה־PDF של התכנון?');
  }
});

// swipe between days
let sx = null, sy = null;
document.addEventListener('touchstart', e => { if (e.target.closest('[data-swipe]')) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
document.addEventListener('touchend', e => {
  if (sx == null) return;
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
  sx = null;
  if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
  const w = pickWeek(), sel = currentSelDay(w);
  const i = w.days.findIndex(d => d.dow === sel), j = dx > 0 ? i + 1 : i - 1;
  if (w.days[j]) {
    state.dayDow = w.days[j].dow; render(false);
    const v = $('#view'); v.classList.remove('enter', 'from-l', 'from-r'); void v.offsetWidth; v.classList.add('enter', dx > 0 ? 'from-l' : 'from-r');
  }
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
function toast(msg, ms = 2800) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); if (ms) toastT = setTimeout(() => t.classList.remove('show'), ms);
}
const COLORS = ['#A67AF3', '#F6D38A', '#F6B7CF', '#9DD6F9', '#B8D88E', '#F6C28B'];
function confetti() {
  const box = $('#confetti');
  for (let i = 0; i < 60; i++) {
    const s = document.createElement('i');
    s.style.left = Math.random() * 100 + 'vw';
    s.style.background = COLORS[i % COLORS.length];
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
    s.style.background = COLORS[i % COLORS.length];
    s.style.setProperty('--x', Math.cos(a) * 34 + 'px'); s.style.setProperty('--y', Math.sin(a) * 34 + 'px');
    box.appendChild(s); setTimeout(() => s.remove(), 700);
  }
}

// keep "now" fresh
setInterval(() => { if (state.tab === 'now' && !document.hidden && !document.activeElement.matches('input, textarea') && !$('#overlay.show')) rerender(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#overlay.show')) rerender(); });
addEventListener('resize', moveTabInd);

applyPrefs();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
render(true);
