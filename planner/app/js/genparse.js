// Reads a weekly plan in (almost) any shape: Word/Excel tables, day-by-day lists,
// PDFs of any layout, plain text. Produces the same week object as planparse.js.
import { unzip } from './files.js';
import { pageLines } from './pdftext.js';

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const DW = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'א': 0, 'ב': 1, 'ג': 2, 'ד': 3, 'ה': 4, 'ו': 5 };
const TR = /^\s*(\d{1,2}[:.]\d{2})\s*[-–—]\s*(\d{1,2}[:.]\d{2})\s*/;
const T1 = /^\s*(\d{1,2}:\d{2})\s*/;
const URL_RE = /https?:\/\/[^\s)"'<>]+/g;
const normT = t => { const [h, m] = t.replace('.', ':').split(':'); return h.padStart(2, '0') + ':' + m; };

// "יום ראשון", "ראשון", "יום א'", "א'" at the start of a short text
export function dayOf(text) {
  const t = (text || '').trim();
  let m = t.match(/^(?:יום\s+)?(ראשון|שני|שלישי|רביעי|חמישי|שישי)(?=$|[\s:,.·\-–'׳)(\d])/);
  if (m) return DW[m[1]];
  m = t.match(/^יום\s+([א-ו])(?:['׳]|(?=$|[\s:,.·\-–]))/) || t.match(/^([א-ו])['׳](?=$|[\s:,.·\-–\d])/);
  return m ? DW[m[1]] : null;
}
const dateIn = t => { const m = (t || '').match(/(?<![\d.])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?![\d])/); return m && +m[2] >= 1 && +m[2] <= 12 && +m[1] <= 31 ? { d: +m[1], m: +m[2], y: m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : null } : null; };

function newLesson(label, title) {
  return { label: String(label || ''), start: '', end: '', title: (title || '').trim(), subtitle: '', subject: '', badges: [], sections: [], materials: [], homework: [], links: [] };
}
function addDetail(per, raw) {
  let t = raw.trim(); if (!t) return;
  for (const u of t.match(URL_RE) || []) per.links.push({ url: u.replace(/[.,]+$/, ''), text: t.replace(URL_RE, '').replace(/[:\-–]\s*$/, '').trim().slice(0, 60) || 'קישור' });
  t = t.replace(URL_RE, '').trim(); if (!t) return;
  if (/^[☐□▢◻✓✔]\s*/.test(t) || /^(?:להביא|להכין|חומרים|ציוד|צריך)\s*[:–-]\s*/.test(t)) {
    t.replace(/^[☐□▢◻✓✔]\s*/, '').replace(/^(?:להביא|להכין|חומרים|ציוד|צריך)\s*[:–-]\s*/, '').split(/\s*[☐□▢◻]\s*|\s*[,;]\s+(?=\S)/).filter(Boolean).forEach(x => per.materials.push({ text: x.trim() }));
    return;
  }
  const hw = t.match(/^(?:📝\s*)?(?:שיעורי בית|ש"ב|ש״ב)\s*[:–-]\s*(.+)$/);
  if (hw) { per.homework.push(hw[1]); return; }
  const sl = t.replace(/^[•·\-*]\s+/, '').match(/^([^\s:–·][^:–·]{0,26}?)\s*[:–]\s+(.+)$/);
  if (sl && sl[1].split(/\s+/).length <= 4 && !/\d/.test(sl[1])) { per.sections.push({ label: sl[1].trim(), text: sl[2].trim() }); return; }
  const last = per.sections[per.sections.length - 1];
  if (last && !last.label && last.text.length < 400) last.text += ' · ' + t.replace(/^[•·\-*]\s+/, '');
  else per.sections.push({ label: '', text: t.replace(/^[•·\-*]\s+/, '') });
}
// first line of a cell / list item → lesson head (label, times, title)
function lessonHead(t) {
  let s = t.trim(), label = '', start = '', end = '';
  let m = s.match(TR); if (m) { start = normT(m[1]); end = normT(m[2]); s = s.slice(m[0].length); }
  else if ((m = s.match(T1))) { start = normT(m[1]); s = s.slice(m[0].length); }
  const lm = s.match(/^(?:שעה|שיעור)\s*(\d{1,2})\s*[:\-–·.)|]?\s*/) || s.match(/^(\d{1,2})[.)]\s+/);
  if (lm) { label = lm[1]; s = s.slice(lm[0].length); }
  if (/^(?:מפגש\s+)?בוקר\b/.test(s) && !label) label = 'בוקר';
  if (!start && (m = s.match(TR))) { start = normT(m[1]); end = normT(m[2]); s = s.slice(m[0].length); }
  s = s.replace(/^[\s:\-–·|]+/, '');
  return { label, start, end, title: s };
}
const isLessonStart = t => TR.test(t) || T1.test(t) || /^(?:שעה|שיעור)\s*\d{1,2}\b/.test(t.trim()) || /^\d{1,2}[.)]\s+\S/.test(t.trim());

// ---------------------------------------------------------------- list / free text
export function parseLines(lines) {
  const days = new Map(); let cur = null, per = null, structured = false;
  const getDay = (dow, text) => { if (!days.has(dow)) days.set(dow, { dow, name: DAY_NAMES[dow], date: '', periods: [] }); const d = days.get(dow); const dt = dateIn(text); if (dt && !d.date) d.date = `${dt.d}.${dt.m}`; return d; };
  for (const raw of lines) {
    const t = (raw || '').replace(/\s+/g, ' ').trim(); if (!t) continue;
    const dw = dayOf(t);
    if (dw != null && t.length <= 48) {
      cur = getDay(dw, t); per = null;
      const rest = t.replace(/^(?:יום\s+)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|[א-ו]['׳]?)\s*/, '').replace(/^[\s,·\-–:]*(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)?[\s:,·\-–]*/, '');
      if (rest && isLessonStart(rest)) { const h = lessonHead(rest); per = Object.assign(newLesson(h.label, h.title), { start: h.start, end: h.end }); cur.periods.push(per); structured = true; }
      continue;
    }
    if (!cur) continue;
    if (isLessonStart(t)) { const h = lessonHead(t); per = Object.assign(newLesson(h.label, h.title || 'שיעור'), { start: h.start, end: h.end }); cur.periods.push(per); structured = true; continue; }
    if (per && structured) { addDetail(per, t); continue; }
    // a day with plain lines and no times: each line is a lesson
    if (!structured && t.length < 90) { per = newLesson(String(cur.periods.length + 1), t.replace(/^[•·\-*]\s+/, '')); cur.periods.push(per); continue; }
    if (per) addDetail(per, t);
  }
  return [...days.values()].sort((a, b) => a.dow - b.dow);
}

// ---------------------------------------------------------------- tables (Word / Excel / CSV)
export function parseGrid(rows) {
  rows = rows.map(r => r.map(c => (c || '').trim()));
  const nCols = Math.max(...rows.map(r => r.length));
  // days as columns
  for (let h = 0; h < Math.min(rows.length, 6); h++) {
    const cols = rows[h].map((c, i) => [i, dayOf(c)]).filter(([, d]) => d != null);
    if (cols.length < 2) continue;
    const days = new Map(cols.map(([i, d]) => [i, { dow: d, name: DAY_NAMES[d], date: (dt => dt ? `${dt.d}.${dt.m}` : '')(dateIn(rows[h][i])), periods: [] }]));
    const labelCol = [...Array(nCols).keys()].find(i => !days.has(i));
    rows.slice(h + 1).forEach((r, ri) => {
      const head = labelCol != null ? lessonHead(r[labelCol] || '') : { label: '', start: '', end: '' };
      const label = head.label || (/בוקר/.test(r[labelCol] || '') ? 'בוקר' : String(ri + 1));
      for (const [i, d] of days) {
        const cell = r[i]; if (!cell) continue;
        const ls = cell.split(/\n+/).map(x => x.trim()).filter(Boolean);
        const own = lessonHead(ls[0]);
        const per = Object.assign(newLesson(own.label || label, own.title || ls[0]), { start: own.start || head.start, end: own.end || head.end });
        ls.slice(1).forEach(x => addDetail(per, x));
        d.periods.push(per);
      }
    });
    return [...days.values()].sort((a, b) => a.dow - b.dow);
  }
  // days as rows
  const dayRows = rows.map((r, i) => [i, dayOf(r[0])]).filter(([, d]) => d != null);
  if (dayRows.length >= 2) {
    const header = rows[0];
    return dayRows.map(([ri, d]) => {
      const day = { dow: d, name: DAY_NAMES[d], date: (dt => dt ? `${dt.d}.${dt.m}` : '')(dateIn(rows[ri][0])), periods: [] };
      rows[ri].slice(1).forEach((cell, ci) => {
        if (!cell) return;
        const head = lessonHead(header[ci + 1] || '');
        const ls = cell.split(/\n+/).map(x => x.trim()).filter(Boolean);
        const own = lessonHead(ls[0]);
        const per = Object.assign(newLesson(own.label || head.label || String(ci + 1), own.title || ls[0]), { start: own.start || head.start, end: own.end || head.end });
        ls.slice(1).forEach(x => addDetail(per, x));
        day.periods.push(per);
      });
      return day;
    }).sort((a, b) => a.dow - b.dow);
  }
  return [];
}

// ---------------------------------------------------------------- file → blocks
const X = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
async function docxBlocks(buf) {
  const parts = await unzip(buf, n => /^word\/document\.xml$|^word\/_rels\/document\.xml\.rels$/.test(n));
  const doc = parts.find(p => /document\.xml$/.test(p.name)); if (!doc) return [];
  const rels = {}; const rx = parts.find(p => /rels$/.test(p.name));
  if (rx) for (const m of rx.text.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) rels[m[1]] = X(m[2]);
  const dom = new DOMParser().parseFromString(doc.text, 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const pText = p => {
    let s = '';
    for (const n of p.getElementsByTagNameNS(W, '*')) {
      if (n.localName === 't') s += n.textContent;
      else if (n.localName === 'tab') s += ' ';
      else if (n.localName === 'br') s += '\n';
    }
    for (const h of p.getElementsByTagNameNS(W, 'hyperlink')) { const id = h.getAttributeNS(R, 'id'); if (id && rels[id] && /^https?:/.test(rels[id])) s += ' ' + rels[id]; }
    return s;
  };
  const body = dom.getElementsByTagNameNS(W, 'body')[0]; const out = [];
  for (const el of body ? body.children : []) {
    if (el.localName === 'p') out.push({ type: 'p', text: pText(el) });
    else if (el.localName === 'tbl') {
      const rows = [];
      for (const tr of el.children) if (tr.localName === 'tr') {
        const row = [];
        for (const tc of tr.children) if (tc.localName === 'tc') row.push([...tc.getElementsByTagNameNS(W, 'p')].map(pText).join('\n'));
        rows.push(row);
      }
      out.push({ type: 'table', rows });
    }
  }
  return out;
}
async function xlsxBlocks(buf) {
  const parts = await unzip(buf, n => /^xl\/sharedStrings\.xml$|^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const ss = parts.find(p => /sharedStrings/.test(p.name));
  const strings = ss ? [...ss.text.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => X([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''))) : [];
  const out = [];
  for (const sh of parts.filter(p => /worksheets/.test(p.name)).sort((a, b) => a.name.localeCompare(b.name))) {
    const rows = [];
    for (const c of sh.text.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const col = c[1].split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1, row = +c[2] - 1;
      const v = (c[4] || '').match(/<v>([\s\S]*?)<\/v>/), is = (c[4] || '').match(/<t[^>]*>([\s\S]*?)<\/t>/);
      let val = /t="s"/.test(c[3]) && v ? strings[+v[1]] : is ? X(is[1]) : v ? v[1] : '';
      (rows[row] = rows[row] || [])[col] = val;
    }
    out.push({ type: 'table', rows: rows.filter(Boolean).map(r => Array.from(r, x => x || '')) });
  }
  return out;
}
function textBlocks(text) {
  const lines = text.split(/\r?\n/);
  const delim = ['\t', ',', ';'].find(d => lines.filter(l => l.includes(d)).length > lines.length * .6 && lines.length > 2);
  if (delim) return [{ type: 'table', rows: lines.map(l => l.split(delim).map(c => c.replace(/^"|"$/g, ''))) }];
  return lines.map(text => ({ type: 'p', text }));
}
async function pdfBlocks(pdfjs, data) {
  const doc = await pdfjs.getDocument({ data }).promise; const out = [];
  for (let i = 1; i <= doc.numPages; i++) for (const l of await pageLines(await doc.getPage(i))) out.push({ type: 'p', text: l.text });
  return out;
}

export async function readAnyPlan(file, pdfjs) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const buf = await file.arrayBuffer();
  let blocks = [];
  if (ext === 'docx') blocks = await docxBlocks(buf);
  else if (ext === 'xlsx') blocks = await xlsxBlocks(buf);
  else if (ext === 'pdf' || file.type === 'application/pdf') blocks = await pdfBlocks(pdfjs, new Uint8Array(buf));
  else if (/^(txt|csv|tsv|md)$/.test(ext) || /^text\//.test(file.type)) blocks = textBlocks(new TextDecoder().decode(buf));
  else if (ext === 'pptx') { const ps = await unzip(buf, n => /^ppt\/slides\/slide\d+\.xml$/.test(n)); blocks = ps.flatMap(p => [...p.text.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map(m => ({ type: 'p', text: X([...m[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(x => x[1]).join('')) }))); }
  else return { days: [], unsupported: true };
  let best = [];
  for (const b of blocks.filter(b => b.type === 'table')) { const d = parseGrid(b.rows); if (count(d) > count(best)) best = d; }
  const lines = blocks.flatMap(b => b.type === 'p' ? b.text.split('\n') : b.rows.flatMap(r => r.join('\n').split('\n')));
  const lin = parseLines(lines);
  if (count(lin) > count(best) * 1.2) best = lin;
  const title = (blocks.find(b => b.type === 'p' && b.text.trim()) || {}).text || '';
  const dates = best.map(d => d.date).filter(Boolean);
  const yr = (blocks.map(b => b.text || '').join(' ').match(/20\d\d/) || [])[0];
  return { days: best, title: title.trim().slice(0, 60), number: +((title.match(/שבוע\s*(\d+)/) || [])[1]) || null, year: yr ? +yr : null, hasDates: dates.length > 0 };
}
const count = days => days.reduce((a, d) => a + d.periods.length, 0);
