import * as pdfjsLib from '../vendor/pdf.min.mjs';
import { parsePlanPdf, DAY_NAMES } from './planparse.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

// ---------------------------------------------------------------- state
const KEY = 'noa-planner-v1';
const state = Object.assign({ weeks: {}, activeId: null, checks: {}, pins: {}, q: '', name: 'נועה', tab: 'now', dayDow: null, open: {} }, load());
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function save() {
  const { weeks, activeId, checks, pins, name } = state;
  localStorage.setItem(KEY, JSON.stringify({ weeks, activeId, checks, pins, name }));
}

// ?now=2026-11-01T10:30 lets me preview any moment
const fakeNow = new URLSearchParams(location.search).get('now');
const offset = fakeNow ? new Date(fakeNow) - Date.now() : 0;
const now = () => new Date(Date.now() + offset);

// ---------------------------------------------------------------- helpers
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mins = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const DAY_FULL = [...DAY_NAMES, 'שבת'];

const SUBJECTS = [
  [/מפגש בוקר/, '#E9B730', '#FFF5D4', '☀️'],
  [/פרטני/, '#D9798A', '#FCE7EB', '🤝'],
  [/מתמטיקה|חשבון/, '#E5874F', '#FDEADF', '🔢'],
  [/תנ"?ך|תנ״ך/, '#8D76C2', '#EFEAF8', '📜'],
  [/מעבדה|חינוך/, '#6AA357', '#E8F3E2', '🌱'],
  [/א['׳]?1|כותבים/, '#A67A55', '#F4EADF', '✏️'],
  [/צוות|ישיבה|השתלמות/, '#8E8E8E', '#F0EFEE', '☕'],
  [/אורחים|הורים/, '#3EA59E', '#DFF4F1', '🎈'],
  [/שפה|קריאה|כתיבה|הכתבה/, '#5A8ED2', '#E4EEFB', '📖'],
];
function look(p) {
  const hay = (p.subject || '') + ' ' + (p.label === 'בוקר' ? 'מפגש בוקר' : '');
  for (const [re, c, bg, e] of SUBJECTS) if (re.test(hay)) return { c, bg, e };
  for (const [re, c, bg, e] of SUBJECTS) if (re.test(p.title || '')) return { c, bg, e };
  return { c: '#B48FB8', bg: '#F6ECF6', e: '🌷' };
}

function weekDates(w) {
  return w.days.map(d => {
    const [dd, mm] = (d.date || '').split('.').map(Number);
    return dd ? new Date(w.year, mm - 1, dd) : null;
  });
}
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function pickWeek() {
  const ws = Object.values(state.weeks);
  if (!ws.length) return null;
  const t = now(); t.setHours(0, 0, 0, 0);
  // the week that contains today (Sunday..Saturday)
  for (const w of ws) {
    const ds = weekDates(w).filter(Boolean);
    if (!ds.length) continue;
    const sun = new Date(ds[0]); sun.setDate(sun.getDate() - sun.getDay());
    const sat = new Date(sun); sat.setDate(sat.getDate() + 6);
    if (t >= sun && t <= sat) return w;
  }
  if (state.activeId && state.weeks[state.activeId]) return state.weeks[state.activeId];
  return ws.sort((a, b) => (a.id < b.id ? 1 : -1))[0];
}

function todayInWeek(w) {
  const t = now();
  const ds = weekDates(w);
  const i = ds.findIndex(d => sameDay(d, t));
  return i >= 0 ? w.days[i] : null;
}

function nextSchoolDay(w, afterDow) {
  return w.days.find(d => d.dow > afterDow) || null;
}

function phase(day) {
  const t = now();
  const m = t.getHours() * 60 + t.getMinutes() + t.getSeconds() / 60;
  const ps = day.periods.filter(p => p.start);
  if (!ps.length) return { kind: 'free' };
  const first = ps[0], last = ps[ps.length - 1];
  if (m < mins(first.start)) return { kind: 'before', next: first, inMin: Math.ceil(mins(first.start) - m) };
  if (m >= mins(last.end)) return { kind: 'after' };
  const cur = ps.find(p => m >= mins(p.start) && m < mins(p.end));
  const next = ps.find(p => mins(p.start) > m);
  if (cur) {
    const len = mins(cur.end) - mins(cur.start);
    return { kind: 'lesson', cur, next, left: Math.ceil(mins(cur.end) - m), pct: (m - mins(cur.start)) / len, inMin: next ? Math.ceil(mins(next.start) - m) : null };
  }
  return { kind: 'break', next, inMin: Math.ceil(mins(next.start) - m) };
}

function dayProgress(day) {
  const ps = day.periods.filter(p => p.start);
  if (!ps.length) return 0;
  const t = now(); const m = t.getHours() * 60 + t.getMinutes();
  const a = mins(ps[0].start), b = mins(ps[ps.length - 1].end);
  return Math.max(0, Math.min(1, (m - a) / (b - a)));
}

const inText = n => n <= 1 ? 'עוד דקה' : n < 60 ? `עוד ${n} דק׳` : `עוד ${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')} שע׳`;

// ---------------------------------------------------------------- checks
const ck = (w, k) => !!(state.checks[w.id] && state.checks[w.id][k]);
function setCk(w, k, v) {
  state.checks[w.id] = state.checks[w.id] || {};
  if (v) state.checks[w.id][k] = 1; else delete state.checks[w.id][k];
  save();
}

// ---------------------------------------------------------------- header
const LINES = [
  'את עושה עבודה מדהימה 💛', 'יום של דברים קטנים וטובים', 'הכיתה שלך בידיים טובות',
  'נושמים, מחייכים, מתחילים ✨', 'בזכותך כל ילד מרגיש שרואים אותו', 'קפה, תוכנית, וזהו – את מוכנה ☕',
  'גם יום עמוס נגמר בחיוך', 'הילדים שלך בני מזל שיש להם אותך', 'צעד אחד בכל פעם 🌿', 'את מתוכננת. הכל בפנים.',
];
function renderHeader(w) {
  const h = now().getHours();
  const g = h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 16 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
  $('#hello').textContent = `${g}, ${state.name}`;
  const d = now();
  $('#subhello').textContent = LINES[(d.getDate() + d.getMonth() * 31) % LINES.length];
  $('#weekPill').innerHTML = w ? `<b>${esc(w.number ? 'שבוע ' + w.number : 'השבוע')}</b><span>${esc(w.cls || '')}${w.range ? ' · <bdi dir="ltr">' + esc(w.range) + '</bdi>' : ''}</span>` : '';
}

// ---------------------------------------------------------------- lesson card
function lessonCard(w, day, p, opts = {}) {
  const L = look(p);
  const id = `${day.dow}:${p.label}`;
  const open = opts.open ?? state.open[id];
  const label = p.label === 'בוקר' ? '☀︎' : p.label;
  const mats = p.materials.map((m, i) => {
    const k = `m:${id}:${i}`;
    return `<label class="chk ${ck(w, k) ? 'on' : ''}"><input type="checkbox" data-ck="${esc(k)}" ${ck(w, k) ? 'checked' : ''}><span class="box"></span><span>${esc(m.text)}</span></label>`;
  }).join('');
  const links = p.links.map(l => l.url
    ? `<a class="lnk" href="${esc(l.url)}" target="_blank" rel="noopener">🔗 ${esc(l.text)}</a>`
    : `<span class="lnk off">📎 ${esc(l.text)}</span>`).join('');
  return `
  <article class="lesson ${open ? 'open' : ''} ${opts.now ? 'is-now' : ''}" style="--c:${L.c};--bg:${L.bg}" data-id="${esc(id)}">
    <button class="lhead" data-toggle="${esc(id)}" aria-expanded="${open ? 'true' : 'false'}">
      <span class="when"><b>${esc(label)}</b><small>${esc(p.start)}${p.end ? '–' + esc(p.end) : ''}</small></span>
      <span class="ttl">
        <span class="t1">${esc(p.title)}</span>
        <span class="t2">${L.e} ${esc(p.subtitle)}</span>
        ${p.badges.length || p.materials.length || p.homework.length ? `<span class="chips">
          ${p.badges.map(b => `<i class="chip hot">${esc(b)}</i>`).join('')}
          ${p.materials.length ? `<i class="chip">✂️ ${p.materials.length}</i>` : ''}
          ${p.homework.length ? `<i class="chip">📝 ש״ב</i>` : ''}
        </span>` : ''}
      </span>
      <span class="chev">⌄</span>
    </button>
    ${opts.now ? `<div class="bar"><span style="width:${Math.round((opts.pct || 0) * 100)}%"></span></div>` : ''}
    <div class="lbody">
      ${p.sections.map(s => `<p class="sec">${s.label ? `<b>${esc(s.label)}</b>` : ''}${esc(s.text)}</p>`).join('')}
      ${mats ? `<div class="mats"><div class="mh">מה צריך</div>${mats}</div>` : ''}
      ${p.homework.length ? `<div class="hw"><b>📝 שיעורי בית</b>${p.homework.map(h => `<div>${esc(h)}</div>`).join('')}</div>` : ''}
      ${links ? `<div class="links">${links}</div>` : ''}
    </div>
  </article>`;
}

function miniRow(p, extra = '') {
  const L = look(p);
  return `<div class="mini" style="--c:${L.c};--bg:${L.bg}"><span class="mt">${esc(p.start)}</span><span class="md"></span><span class="mx">${L.e} ${esc(p.title)}</span>${extra}</div>`;
}

// ---------------------------------------------------------------- views
function viewEmpty() {
  return `
  <section class="empty">
    <div class="hand big">שלום ${esc(state.name)} 👋</div>
    <p>כאן הכיתה שלך תהיה תמיד בכיס.<br>מעלים את קובץ התכנון השבועי (PDF) – ואני מסדרת: מה עכשיו, מה הבא, מה להכין.</p>
    <button class="cta" data-act="upload">📄 להעלות את התכנון של השבוע</button>
    <p class="hint">הכל נשמר רק בטלפון שלך.</p>
  </section>`;
}

function prepBlock(w, day, which, title) {
  const secs = (w.prep[day.dow] || []).filter(s => which.test(s.title));
  if (!secs.length) return '';
  return secs.map(s => prepSection(w, day, s, title)).join('');
}

function prepSection(w, day, s, title) {
  const items = s.items.map((it, i) => {
    const k = `p:${day.dow}:${s.title}:${i}`;
    return `<label class="chk ${ck(w, k) ? 'on' : ''}"><input type="checkbox" data-ck="${esc(k)}" ${ck(w, k) ? 'checked' : ''}><span class="box"></span><span>${esc(it.text)}${it.period ? ` <small class="per">שעה ${esc(it.period)}</small>` : ''}</span></label>`;
  }).join('');
  const done = s.items.filter((_, i) => ck(w, `p:${day.dow}:${s.title}:${i}`)).length;
  return `<div class="card prep" data-sec>
    <div class="ph"><span>${esc(s.icon || '•')} ${esc(title || (/ערב|הדפסה/.test(s.title) ? 'להדפיס בבוקר' : s.title))}</span><span class="cnt ${done === s.items.length ? 'all' : ''}">${done}/${s.items.length}</span></div>
    ${items}
  </div>`;
}

function notesBlock(w) {
  if (!w.notes.length) return '';
  return `<div class="card notes"><div class="ph"><span>📌 לא לשכוח השבוע</span></div>
    ${w.notes.map(n => `<div class="note"><b>${esc(n.label)}</b><span>${esc(n.text)}</span></div>`).join('')}</div>`;
}

function viewNow(w) {
  const day = todayInWeek(w);
  let html = '';
  if (!day) {
    const t = now();
    const dows = w.days.map(d => d.dow);
    const nd = w.days.find(d => weekDates(w)[w.days.indexOf(d)] > t) || null;
    html += `<section class="hero calm"><div class="hand">${t.getDay() === 6 ? 'שבת שלום 🕯️' : 'יום חופשי 🌿'}</div><p>אין שיעורים היום. תנוחי, מגיע לך.</p></section>`;
    if (nd) html += nextDayBlock(w, nd);
    else if (!dows.length) html += '';
    html += notesBlock(w);
    return html;
  }
  const ph = phase(day);
  const prog = dayProgress(day);
  const ring = `<div class="ring" style="--p:${prog}"><span>${Math.round(prog * 100)}%</span></div>`;

  if (ph.kind === 'lesson') {
    html += `<section class="hero">
      ${ring}
      <div><div class="k">עכשיו · יום ${esc(day.name)}</div>
      <div class="big">${ph.cur.label === 'בוקר' ? 'מפגש בוקר' : 'שעה ' + esc(ph.cur.label)}</div>
      <div class="k">${inText(ph.left)} לסוף השיעור</div></div>
      <button class="wake" data-act="wake" title="להשאיר את המסך דלוק">🔆</button>
    </section>`;
    html += lessonCard(w, day, ph.cur, { open: true, now: true, pct: ph.pct });
    if (ph.next) html += `<div class="next-h">הבא בתור · ${inText(ph.inMin)}</div>` + lessonCard(w, day, ph.next, {});
  } else if (ph.kind === 'break') {
    html += `<section class="hero">${ring}<div><div class="k">הפסקה ☕</div><div class="big">${inText(ph.inMin)}</div><div class="k">ואז: ${esc(ph.next.title)}</div></div></section>`;
    html += lessonCard(w, day, ph.next, { open: true });
  } else if (ph.kind === 'before') {
    html += `<section class="hero">${ring}<div><div class="k">יום ${esc(day.name)} · ${esc(day.date)}</div><div class="big">היום מחכה לך</div><div class="k">מתחילים ב־${esc(ph.next.start)} · ${inText(ph.inMin)}</div></div></section>`;
    html += prepBlock(w, day, /ערב|הדפסה/, 'להדפיס הבוקר');
    html += prepBlock(w, day, /להכין|להביא/, 'לקחת היום');
    html += lessonCard(w, day, ph.next, { open: true });
  } else {
    html += `<section class="hero done"><div class="hand">סיימת את היום 🎉</div><p>${day.periods.length} שיעורים, אפס ויכוחים עם המדפסת (כמעט).</p></section>`;
    const nd = nextSchoolDay(w, day.dow);
    if (nd) html += nextDayBlock(w, nd);
  }

  const rest = day.periods.filter(p => ph.kind === 'after' ? false : (ph.cur ? mins(p.start) > mins(ph.cur.start) : ph.next ? mins(p.start) > mins(ph.next.start) : false));
  const restRows = rest.filter(p => p !== ph.next);
  if (restRows.length) html += `<div class="card"><div class="ph"><span>ובהמשך היום</span></div>${restRows.map(p => miniRow(p)).join('')}</div>`;
  html += notesBlock(w);
  return html;
}

function nextDayBlock(w, nd) {
  let h = `<div class="next-h">למחר · יום ${esc(nd.name)} ${esc(nd.date)}</div>`;
  const pr = (w.prep[nd.dow] || []).find(s => /ערב|הדפסה/.test(s.title));
  if (pr && pr.items.length) h += `<p class="dim tip">🖨 ${pr.items.length} דברים להדפיס מחר בבוקר – הרשימה תחכה לך כאן.</p>`;
  h += prepBlock(w, nd, /להכין|להביא/, 'להכין למחר');
  if (nd.periods[0]) h += `<div class="card"><div class="ph"><span>המערכת של מחר</span></div>${nd.periods.map(p => miniRow(p)).join('')}</div>`;
  return h;
}

function dayChips(w, sel, withOverview) {
  const today = todayInWeek(w);
  const all = [0, 1, 2, 3, 4, 5];
  return `<div class="daychips">${withOverview ? `<button class="dc ${sel === 'all' ? 'sel' : ''}" data-day="all">הכל</button>` : ''}${all.map(dow => {
    const d = w.days.find(x => x.dow === dow);
    return `<button class="dc ${sel === dow ? 'sel' : ''} ${!d ? 'off' : ''} ${today && today.dow === dow ? 'today' : ''}" data-day="${dow}" ${!d ? 'disabled' : ''}>${DAY_SHORT[dow]}<small>${d ? esc(d.date) : 'חופש'}</small></button>`;
  }).join('')}</div>`;
}

function currentSelDay(w) {
  if (state.dayDow === 'all') return 'all';
  if (state.dayDow != null && w.days.some(d => d.dow === state.dayDow)) return state.dayDow;
  const t = todayInWeek(w);
  if (t) return t.dow;
  const nd = w.days.find((d, i) => weekDates(w)[i] > now());
  return (nd || w.days[0]).dow;
}

function viewDay(w) {
  const sel = currentSelDay(w);
  let html = dayChips(w, sel, true);
  if (sel === 'all') {
    html += w.days.map(d => `<div class="card wk" data-day="${d.dow}"><div class="ph"><span>יום ${esc(d.name)}</span><span class="dim">${esc(d.date)}</span></div>${d.periods.map(p => miniRow(p)).join('')}</div>`).join('');
    return html;
  }
  const day = w.days.find(d => d.dow === sel);
  const ph = todayInWeek(w) === day ? phase(day) : null;
  html += `<div class="swipe" data-swipe>`;
  html += day.periods.map(p => lessonCard(w, day, p, { now: ph && ph.cur === p, pct: ph && ph.pct, open: state.open[`${day.dow}:${p.label}`] ?? (ph && ph.cur === p) })).join('');
  html += `</div>`;
  const hw = day.periods.filter(p => p.homework.length);
  if (hw.length) html += `<div class="card"><div class="ph"><span>📝 שיעורי בית היום</span></div>${hw.map(p => `<div class="note"><b>${esc(p.title)}</b><span>${esc(p.homework.join(' · '))}</span></div>`).join('')}</div>`;
  return html;
}

function viewPrep(w) {
  const sel0 = currentSelDay(w);
  let sel = sel0 === 'all' ? w.days[0].dow : sel0;
  if (state.prepDow != null && w.days.some(d => d.dow === state.prepDow)) sel = state.prepDow;
  else {
    // evening → show tomorrow
    const t = todayInWeek(w);
    if (t && phase(t).kind === 'after') { const nd = nextSchoolDay(w, t.dow); if (nd) sel = nd.dow; }
  }
  const day = w.days.find(d => d.dow === sel);
  let html = dayChips(w, sel, false).replace(/data-day=/g, 'data-pday=');
  const secs = w.prep[sel] || [];
  if (!secs.length) {
    // fall back to lesson materials
    const items = day.periods.flatMap(p => p.materials.map((m, i) => ({ text: m.text, period: p.label, k: `m:${day.dow}:${p.label}:${i}` })));
    html += `<div class="card prep"><div class="ph"><span>✂️ להכין / להביא</span></div>${items.map(it => `<label class="chk ${ck(w, it.k) ? 'on' : ''}"><input type="checkbox" data-ck="${esc(it.k)}" ${ck(w, it.k) ? 'checked' : ''}><span class="box"></span><span>${esc(it.text)} <small class="per">שעה ${esc(it.period)}</small></span></label>`).join('') || '<p class="dim">אין כלום להכין 🎈</p>'}</div>`;
    return html;
  }
  const total = secs.reduce((a, s) => a + s.items.length, 0);
  const done = secs.reduce((a, s) => a + s.items.filter((_, i) => ck(w, `p:${sel}:${s.title}:${i}`)).length, 0);
  html += `<div class="prepbar"><div class="pbt">${done === total ? 'הכל מוכן ליום ' + esc(day.name) + '! 🎉' : `מוכן ${done} מתוך ${total}`}</div><div class="bar"><span style="width:${total ? done / total * 100 : 0}%"></span></div></div>`;
  html += secs.map(s => prepSection(w, day, s)).join('');
  return html;
}

function viewMore(w) {
  const weeks = Object.values(state.weeks).sort((a, b) => (a.id < b.id ? 1 : -1));
  return `
  <div class="card">
    <button class="cta" data-act="upload">📄 להעלות תכנון של שבוע חדש</button>
    <p class="hint">מעלים את ה־PDF של התכנון. שבוע עם אותם תאריכים יוחלף.</p>
  </div>
  ${w ? notesBlock(w) : ''}
  ${weeks.length ? `<div class="card"><div class="ph"><span>השבועות שלי</span></div>
    ${weeks.map(x => `<div class="wrow ${w && x.id === w.id ? 'sel' : ''}">
      <button class="wsel" data-week="${esc(x.id)}"><b>${esc(x.number ? 'שבוע ' + x.number : x.title)}</b><small dir="ltr">${esc(x.range || '')}</small></button>
      <button class="wdel" data-delweek="${esc(x.id)}" aria-label="מחיקה">🗑</button>
    </div>`).join('')}</div>` : ''}
  <div class="card">
    <div class="ph"><span>קצת עלייך</span></div>
    <label class="field">איך לקרוא לך?<input id="nameIn" value="${esc(state.name)}"></label>
  </div>
  <div class="card install">
    <div class="ph"><span>📱 להוסיף למסך הבית</span></div>
    <p><b>אייפון:</b> בספארי ← כפתור השיתוף ← "הוספה למסך הבית".<br><b>אנדרואיד:</b> בכרום ← ⋮ ← "הוספה למסך הבית".</p>
    <p class="hint">אחרי זה האפליקציה נפתחת במסך מלא ועובדת גם בלי אינטרנט.</p>
  </div>
  <p class="foot hand">נבנה באהבה בשביל ${esc(state.name)} 💛</p>`;
}

// ---------------------------------------------------------------- files
function fileIcon(l) {
  if (/\/folders\//.test(l.url)) return '📁';
  if (/pptx?|מצגת|presentation/i.test(l.text + l.url)) return '🖥';
  if (/docs\.google\.com\/spreadsheets|גאנט/.test(l.url + l.text)) return '📊';
  return '📄';
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

function fileRow(f, sub) {
  const pin = !!state.pins[f.url];
  return `<div class="file">
    <a href="${esc(f.url)}" target="_blank" rel="noopener"><span class="fi">${fileIcon(f)}</span><span class="fx"><b>${esc(f.text)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></a>
    <button class="pin ${pin ? 'on' : ''}" data-pin="${esc(f.url)}" data-pintext="${esc(f.text)}" aria-label="נעיצה">${pin ? '★' : '☆'}</button>
  </div>`;
}

function viewFiles(w) {
  const files = collectFiles(w);
  const q = state.q.trim();
  const match = f => !q || (f.text + ' ' + f.uses.map(u => u.p.title).join(' ') + ' ' + ({ '🖥': 'מצגת', '📁': 'תיקייה', '📊': 'טבלה' }[fileIcon(f)] || 'דף מסמך')).includes(q);
  const where = f => f.uses.length > 2 ? `בשימוש ${f.uses.length} פעמים השבוע` : f.uses.map(u => `${DAY_SHORT[u.d.dow]} · ${u.p.title}`).join(' | ');
  let html = `<div class="search"><input id="fq" type="search" placeholder="🔍 חיפוש קובץ…" value="${esc(state.q)}"></div>`;
  const pinned = Object.entries(state.pins).map(([url, text]) => files.find(f => f.url === url) || { url, text, uses: [] }).filter(match);
  if (pinned.length) html += `<div class="card"><div class="ph"><span>⭐ תמיד בשלוף</span></div>${pinned.map(f => fileRow(f)).join('')}</div>`;
  else if (!q) html += `<p class="dim tip">טיפ: לוחצים על ☆ ליד קובץ – והוא יישאר כאן למעלה, בכל שבוע.</p>`;
  const rest = files.filter(f => !state.pins[f.url] && match(f));
  const recurring = rest.filter(f => new Set(f.uses.map(u => u.d.dow)).size > 1);
  if (recurring.length) html += `<div class="card"><div class="ph"><span>🔁 חוזרים השבוע</span></div>${recurring.map(f => fileRow(f, where(f))).join('')}</div>`;
  const once = rest.filter(f => !recurring.includes(f));
  for (const d of w.days) {
    const fs = once.filter(f => f.uses[0].d === d);
    if (fs.length) html += `<div class="card"><div class="ph"><span>יום ${esc(d.name)}</span><span class="dim">${esc(d.date)}</span></div>${fs.map(f => fileRow(f, f.uses.map(u => u.p.title).join(' | '))).join('')}</div>`;
  }
  if (!files.length) html += `<p class="dim tip">אין קישורים לדרייב בתכנון של השבוע.</p>`;
  else if (q && !pinned.length && !rest.length) html += `<p class="dim tip">לא מצאתי "${esc(q)}" 🤔</p>`;
  return html;
}

// ---------------------------------------------------------------- render
function render() {
  const w = pickWeek();
  renderHeader(w);
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('sel', b.dataset.tab === state.tab));
  const v = $('#view');
  if (!w && state.tab !== 'more') v.innerHTML = viewEmpty();
  else v.innerHTML = ({ now: viewNow, day: viewDay, prep: viewPrep, files: viewFiles, more: viewMore })[state.tab](w);
  v.dataset.tab = state.tab;
}

// ---------------------------------------------------------------- events
document.addEventListener('click', e => {
  const t = e.target.closest('button, [data-day]');
  if (!t) return;
  if (t.dataset.tab) {
    state.tab = t.dataset.tab; if (t.dataset.tab !== 'prep') state.prepDow = null;
    render(); window.scrollTo({ top: 0 });
    const cur = state.tab === 'day' && $('#view .lesson.is-now');
    if (cur) cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (t.dataset.toggle) {
    const id = t.dataset.toggle;
    const card = t.closest('.lesson');
    const open = !card.classList.contains('open');
    card.classList.toggle('open', open);
    t.setAttribute('aria-expanded', open);
    state.open[id] = open;
    return;
  }
  if (t.dataset.day != null) {
    state.dayDow = t.dataset.day === 'all' ? 'all' : +t.dataset.day;
    if (state.tab !== 'day') state.tab = 'day';
    render(); window.scrollTo({ top: 0 }); return;
  }
  if (t.dataset.pday != null) { state.prepDow = +t.dataset.pday; render(); return; }
  if (t.dataset.week) { state.activeId = t.dataset.week; save(); state.tab = 'day'; render(); return; }
  if (t.dataset.delweek) {
    if (confirm('למחוק את השבוע הזה מהטלפון?')) { delete state.weeks[t.dataset.delweek]; delete state.checks[t.dataset.delweek]; save(); render(); }
    return;
  }
  if (t.dataset.pin) {
    if (state.pins[t.dataset.pin]) delete state.pins[t.dataset.pin]; else state.pins[t.dataset.pin] = t.dataset.pintext;
    save(); render(); return;
  }
  if (t.dataset.act === 'upload') { $('#file').click(); return; }
  if (t.dataset.act === 'wake') { toggleWake(t); return; }
});

document.addEventListener('change', e => {
  const i = e.target;
  if (i.dataset && i.dataset.ck) {
    const w = pickWeek();
    setCk(w, i.dataset.ck, i.checked);
    i.closest('.chk').classList.toggle('on', i.checked);
    if (navigator.vibrate) navigator.vibrate(8);
    const card = i.closest('.card, .mats');
    if (i.checked && card && [...card.querySelectorAll('input[type=checkbox]')].every(x => x.checked)) confetti();
    if (state.tab === 'prep' || card?.matches('.prep')) setTimeout(render, 350);
  }
  if (i.id === 'fq') return;
  if (i.id === 'nameIn') { state.name = i.value.trim() || 'נועה'; save(); renderHeader(pickWeek()); }
});

$('#file').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  toast('קוראת את התכנון… 📖', 0);
  try {
    const wk = await parsePlanPdf(pdfjsLib, new Uint8Array(await f.arrayBuffer()));
    if (!wk.days.length) throw new Error('no days');
    state.weeks[wk.id] = wk;
    state.activeId = wk.id;
    save();
    const n = wk.days.reduce((a, d) => a + d.periods.length, 0);
    state.tab = 'now';
    render();
    toast(`${wk.number ? 'שבוע ' + wk.number : 'השבוע'} נטען! ${wk.days.length} ימים, ${n} שיעורים 🎉`);
    confetti();
  } catch (err) {
    console.error(err);
    toast('לא הצלחתי לקרוא את הקובץ 😕 זה ה־PDF של התכנון?');
  }
});

document.addEventListener('input', e => {
  if (e.target.id !== 'fq') return;
  state.q = e.target.value;
  const pos = e.target.selectionStart;
  render();
  const n = $('#fq'); n.focus(); n.setSelectionRange(pos, pos);
});

// swipe between days
let sx = null, sy = null;
document.addEventListener('touchstart', e => { if (e.target.closest('[data-swipe]')) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
document.addEventListener('touchend', e => {
  if (sx == null) return;
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
  sx = null;
  if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
  const w = pickWeek(); const sel = currentSelDay(w);
  const i = w.days.findIndex(d => d.dow === sel);
  const j = dx > 0 ? i + 1 : i - 1; // RTL: swipe right → next day
  if (w.days[j]) { state.dayDow = w.days[j].dow; render(); }
}, { passive: true });

// ---------------------------------------------------------------- toys
let toastT;
function toast(msg, ms = 2800) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); if (ms) toastT = setTimeout(() => t.classList.remove('show'), ms);
}

function confetti() {
  const box = $('#confetti');
  const colors = ['#E9B730', '#5A8ED2', '#E5874F', '#8D76C2', '#6AA357', '#D9798A'];
  for (let i = 0; i < 46; i++) {
    const s = document.createElement('i');
    s.style.left = Math.random() * 100 + 'vw';
    s.style.background = colors[i % colors.length];
    s.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
    s.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
    s.style.animationDelay = Math.random() * 0.25 + 's';
    s.style.animationDuration = 1.3 + Math.random() * 0.9 + 's';
    if (Math.random() > 0.5) s.style.borderRadius = '50%';
    box.appendChild(s);
    setTimeout(() => s.remove(), 2600);
  }
}

let wakeLock = null;
async function toggleWake(btn) {
  try {
    if (wakeLock) { await wakeLock.release(); wakeLock = null; btn.classList.remove('on'); toast('המסך יכבה כרגיל'); return; }
    wakeLock = await navigator.wakeLock.request('screen');
    btn.classList.add('on'); toast('המסך יישאר דלוק בזמן השיעור 🔆');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { toast('הטלפון הזה לא מאפשר להשאיר מסך דלוק'); }
}

// keep "now" fresh
setInterval(() => { if (state.tab === 'now' && !document.hidden) render(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

render();
