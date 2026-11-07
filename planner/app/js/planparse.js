// Reads Noa's weekly-plan PDF (overview page, "what to prepare" page,
// one page per day) into a plain JSON week object.
import { pageItems, linesFrom, joinParts, pageLinks, buildLine } from './pdftext.js';

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
const TIME_RANGE = /(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/;
const LEAD_EMOJI = /^[\p{Extended_Pictographic}️‍\s]+/u;

export async function parsePlanPdf(pdfjsLib, data, onProgress) {
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const week = { title: '', number: null, cls: '', range: '', year: null, days: [], prep: {}, notes: [], importedAt: new Date().toISOString() };
  let curDay = null;

  for (let pn = 1; pn <= doc.numPages; pn++) {
    if (onProgress) onProgress(pn, doc.numPages);
    const page = await doc.getPage(pn);
    const { items, width, height } = await pageItems(page);
    const links = await pageLinks(page);
    const lines = linesFrom(items).filter(l => l.size > 6);
    const first = (lines[0] && lines[0].text) || '';
    const head = lines.slice(0, 3).map(l => l.text).join(' ');
    const dayHead = first.match(/^יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי)/);

    if (/^מה להכין/.test(first)) {
      parsePrepPage(items, week);
    } else if (width > height) {
      if (/תכנון/.test(head)) parseOverview(lines, items, week);
    } else if (dayHead) {
      curDay = { dow: DAY_NAMES.indexOf(dayHead[1]), name: dayHead[1], date: (first.match(/(\d{1,2}\.\d{1,2})/) || [])[1] || '', periods: [] };
      const prev = week.days.find(d => d.dow === curDay.dow);
      if (prev) curDay = prev; else week.days.push(curDay);
      const wk = head.match(/שבוע\s*(\d+)/);
      if (wk && !week.number) week.number = +wk[1];
      const cl = first.match(/·\s*([א-ת]['׳]?\d+)\s*$/) || first.match(/·\s*([א-ת]['׳]\d+)/);
      if (cl && !week.cls) week.cls = cl[1];
      parseDayPage(lines.slice(1), links, curDay, width);
    } else if (/תזכורות|עבר לשבוע|שיעורי בית|מילים להכתבה/.test(first)) {
      parseNotesPage(items, week);
    } else if (curDay) {
      parseDayPage(lines, links, curDay, width);
    }
  }
  week.days.sort((a, b) => a.dow - b.dow);
  week.days.forEach(d => d.periods.sort((a, b) => (a.start || '99').localeCompare(b.start || '99')));
  if (!week.year) week.year = guessYear(week);
  if (week.days.length) week.range = `${week.days[0].date}–${week.days[week.days.length - 1].date}`;
  week.id = weekId(week);
  if (!week.title) week.title = week.number ? `שבוע ${week.number}` : 'השבוע';
  return week;
}

function guessYear() {
  return new Date().getFullYear();
}

export function weekId(week) {
  const d = week.days[0];
  if (!d || !d.date) return 'w' + (week.number || Date.now());
  const [dd, mm] = d.date.split('.').map(Number);
  return `${week.year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

// ---------- overview page: title, range, notes boxes ----------
function parseOverview(lines, items, week) {
  for (const l of lines.slice(0, 3)) {
    const t = l.text;
    const r = t.match(/(\d{1,2}\.\d{1,2})\s*[–-]\s*(\d{1,2}\.\d{1,2})\.(\d{4})/) || t.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*[–-]\s*(\d{1,2}\.\d{1,2})/);
    if (r && !week.range) {
      week.range = r[0];
      const y = t.match(/(\d{4})/);
      if (y) week.year = +y[1];
    }
    const tt = t.match(/תכנון שבוע[^]*?\d+/);
    if (tt) {
      week.title = tt[0].trim();
      const n = tt[0].match(/שבוע\s*(\d+)/);
      if (n) week.number = +n[1];
      const c = tt[0].match(/([א-ת]['׳]?\d+)/);
      if (c) week.cls = c[1];
    }
  }
  // notes: bold "label:" parts near the bottom of the page
  const maxY = Math.max(...items.map(i => i.y));
  const bottom = items.filter(i => i.y > maxY - 70);
  const bl = linesFrom(bottom);
  const labels = [];
  for (const l of bl) for (const p of l.parts) if (p.bold && /:\s*$/.test(p.text)) labels.push({ x1: p.x1, y: l.y, label: p.text.replace(/:\s*$/, '').trim() });
  if (!labels.length) return;
  labels.sort((a, b) => b.x1 - a.x1);
  const top = Math.min(...labels.map(l => l.y)) - 3;
  labels.forEach((lab, i) => {
    const right = lab.x1 + 4;
    const left = i + 1 < labels.length ? labels[i + 1].x1 + 6 : -1;
    const its = bottom.filter(it => it.y >= top && it.x1 <= right && it.x1 > left && it.y < maxY - 1);
    const text = linesFrom(its).map(l => l.text).join(' ').replace(new RegExp('^' + escapeRe(lab.label) + '\\s*:?\\s*'), '').trim();
    if (text) week.notes.push({ label: lab.label, text });
  });
}

// ---------- columns helper: items grouped under the header above them, per column ----------
function columnGroups(items, headers) {
  const cols = [];
  for (const h of headers.slice().sort((a, b) => b.x1 - a.x1)) {
    let c = cols.find(c => Math.abs(c.x1 - h.x1) < 40);
    if (!c) { c = { x1: h.x1, hs: [] }; cols.push(c); }
    c.hs.push(h);
  }
  cols.sort((a, b) => b.x1 - a.x1);
  const footY = Math.max(...items.map(i => i.y)) - 1;
  const groups = new Map(headers.map(h => [h, []]));
  const isHeaderItem = it => headers.some(h => Math.abs(it.y - h.y) < 2.5 && it.x >= h.x0 - 1 && it.x1 <= h.x1 + 1);
  for (const it of items) {
    if (it.y >= footY || /^©/.test(it.t) || it.size <= 6 || isHeaderItem(it)) continue;
    const ci = cols.findIndex((c, i) => it.x1 <= c.x1 + 12 && (i + 1 >= cols.length || it.x1 > cols[i + 1].x1 + 12));
    if (ci < 0) continue;
    const h = cols[ci].hs.filter(h => h.y < it.y - 2).sort((a, b) => b.y - a.y)[0];
    if (h) groups.get(h).push(it);
  }
  return [...groups].map(([h, its]) => ({ h, lines: linesFrom(its) }));
}
const DAY_WORD = { 'א': 0, 'ב': 1, 'ג': 2, 'ד': 3, 'ה': 4, 'ו': 5, 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5 };

// ---------- "what to prepare" page ----------
function parsePrepPage(items, week) {
  const headers = linesFrom(items).flatMap(l => l.parts.filter(p => /^יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|[א-ו]['׳]?)(\s|$|·)/.test(p.text)).map(p => ({ ...p, y: l.y })));
  if (!headers.length) return;
  for (const { h, lines } of columnGroups(items, headers)) {
    const w = h.text.match(/^יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|[א-ו])/)[1];
    const dow = DAY_WORD[w];
    const boxes = lines.some(l => /^☐/.test(l.text.trim()));
    const sections = [];
    let sec = null, lastItem = null, lastY = -99;
    for (const l of lines) {
      const txt = l.text.trim();
      if (!txt) continue;
      const isHeader = !boxes && l.parts.some(p => p.bold) && l.parts.every(p => p.bold || LEAD_EMOJI.test(p.text) && !p.text.replace(LEAD_EMOJI, ''));
      if (isHeader) {
        sec = { title: txt.replace(LEAD_EMOJI, '').trim(), icon: (txt.match(LEAD_EMOJI) || [''])[0].trim(), items: [] };
        sections.push(sec); lastItem = null;
      } else {
        const isNew = boxes ? /^☐/.test(txt) : !(lastItem && l.y - lastY < 12.5);
        if (!isNew && lastItem) lastItem.text = (lastItem.text + (/-$/.test(lastItem.text) ? '' : ' ') + txt).trim();
        else {
          if (!sec) { sec = { title: 'להכין / להביא', icon: '', items: [] }; sections.push(sec); }
          lastItem = { text: txt.replace(/^☐\s*/, '') };
          sec.items.push(lastItem);
        }
      }
      lastY = l.y;
    }
    for (const sc of sections) for (const it of sc.items) {
      const m = it.text.match(/(?:\(\s*שעה\s*(\d+)\s*\)|·\s*שעה\s*(\d+))\s*$/);
      if (m) { it.period = m[1] || m[2]; it.text = it.text.replace(m[0], '').trim(); }
    }
    // a flat list (newer layout): split "להדפיס:" items into their own section
    if (sections.length === 1 && sections[0].title === 'להכין / להביא') {
      const pr = sections[0].items.filter(i => /^להדפיס\s*:/.test(i.text));
      if (pr.length) {
        sections[0].items = sections[0].items.filter(i => !pr.includes(i));
        pr.forEach(i => { i.text = i.text.replace(/^להדפיס\s*:\s*/, ''); });
        sections.unshift({ title: 'בערב לפני – הדפסה', icon: '', items: pr });
      }
    }
    if (dow != null) week.prep[dow] = (week.prep[dow] || []).concat(sections);
  }
}

// ---------- notes page (newer layout): boxes with bullet lists ----------
function parseNotesPage(items, week) {
  const lines = linesFrom(items);
  const headers = lines.flatMap(l => l.parts.filter(p => p.size >= 12 && p.text.trim() && !/^[•·]/.test(p.text)).map(p => ({ ...p, y: l.y })));
  if (!headers.length) return;
  for (const { h, lines: ls } of columnGroups(items, headers)) {
    const its = [];
    for (const l of ls) {
      const txt = l.text.trim(); if (!txt) continue;
      if (/^[•·]/.test(txt) || !its.length) its.push(txt.replace(/^[•·]\s*/, ''));
      else its[its.length - 1] += ' ' + txt;
    }
    if (its.length) week.notes.push({ label: h.text.trim(), text: its.join(' · ') });
  }
}

// ---------- day page: one card per period ----------
const SIDE_LABEL = /^(בוקר|שעה\s*\d{1,2}|\d{1,2})$/;
const TIME_ONE = /^(\d{1,2}:\d{2})\s*[–-]?$/;
const SEC_LABEL = /^([^\s–:·☐📎🔗][^–:·☐]{0,28}?)\s+[–:]\s+(.+)$/;
function parseDayPage(lines, links, day, width = 595) {
  const sideX = width * 0.84;
  const body = lines.filter(l => l.size > 6);
  // right edge of the lesson cards: measured only on lines inside a lesson (not the day header)
  const firstSide = body.findIndex(l => l.parts.some(p => p.x0 >= sideX && SIDE_LABEL.test(p.text.trim())));
  const inCards = day.periods.length ? body : body.slice(Math.max(0, firstSide));
  const contentRight = Math.max(...inCards.flatMap(l => l.parts.filter(p => p.x0 < sideX).map(p => p.x1)), 0);
  let per = day.periods[day.periods.length - 1] || null;
  let lastSection = null;

  for (const l of body) {
    const side = l.parts.filter(p => p.x0 >= sideX);
    const main = l.parts.filter(p => p.x0 < sideX);
    for (const p of side) {
      const txt = p.text.trim();
      const tr = txt.match(TIME_RANGE), t1 = txt.match(TIME_ONE);
      if (tr && per) {
        const [a, b] = [tr[1], tr[2]].map(normTime).sort();
        per.start = a; per.end = b;
      } else if (t1 && per) {
        const t = normTime(t1[1]);
        if (!per.start) per.start = t; else if (!per.end) { per.end = t; if (per.end < per.start) [per.start, per.end] = [per.end, per.start]; }
      } else if (SIDE_LABEL.test(txt)) {
        per = { label: txt.replace(/^שעה\s*/, ''), start: '', end: '', title: '', subtitle: '', subject: '', badges: [], sections: [], materials: [], homework: [], links: [] };
        day.periods.push(per);
        lastSection = null;
      }
    }
    if (!per || !main.length || /^©/.test(main[0].text)) continue;

    const chunks = splitChunks(main);
    const firstText = joinParts(chunks[0]).trim();

    if (!per.title) {
      if (main[0].bold && main[0].size >= 10) {
        per.title = main[0].text.trim();
        per.subtitle = joinParts(chunks[0].slice(1)).trim();
        per.subject = per.subtitle.split('·')[0].trim();
      } else {
        per.title = firstText;
        per._needSub = true;
      }
      for (const c of chunks.slice(1)) per.badges.push(joinParts(c).trim());
      continue;
    }

    if (/^(🔗|📎)/u.test(firstText)) {
      per._linkLines = per._linkLines || [];
      per._linkLines.push(l);
      continue;
    }

    // homework line ("שיעורי בית:" / "📝 שיעורי בית –")
    const hw = joinParts(main).trim().replace(LEAD_EMOJI, '').match(/^שיעורי בית\s*[:–-]\s*(.*)$/);
    if (hw) {
      if (hw[1]) per.homework.push(hw[1].replace(/\s*☐.*$/, '').trim());
      for (const c of chunks.slice(1)) { const t = joinParts(c).trim().replace(/^☐\s*/, ''); if (t) per.materials.push({ text: t }); }
      lastSection = { hw: true }; per._needSub = false;
      continue;
    }

    // checklist line(s): "☐ item   ☐ item"
    if (/^☐/.test(firstText)) {
      for (const c of chunks) { const t = joinParts(c).trim().replace(/^☐\s*/, ''); if (t) per.materials.push({ text: t }); }
      per._needSub = false; lastSection = null;
      continue;
    }

    // older layout: bold "label:" sections
    const labelIdx = chunks[0].findIndex(p => p.bold);
    const labelPart = labelIdx >= 0 ? chunks[0][labelIdx] : null;
    if (labelPart && /:\s*$/.test(labelPart.text) && chunks[0].slice(0, labelIdx).every(p => !p.text.replace(LEAD_EMOJI, ''))) {
      const label = labelPart.text.replace(/:\s*$/, '').trim();
      const text = joinParts(chunks[0].slice(labelIdx + 1)).trim();
      lastSection = { label, text };
      per.sections.push(lastSection);
      for (const c of chunks.slice(1)) per.materials.push({ text: joinParts(c).trim() });
      per._needSub = false;
      continue;
    }

    // newer layout: "label – text" sections (labels are coloured, not bold)
    const sl = firstText.match(SEC_LABEL);
    if (sl && sl[1].trim().split(/\s+/).length <= 4 && !/\d/.test(sl[1])) {
      lastSection = { label: sl[1].trim(), text: sl[2].trim() };
      per.sections.push(lastSection);
      per._needSub = false;
      continue;
    }

    if (per._needSub) {
      per.subtitle = firstText; per.subject = firstText.split('·')[0].trim(); per._needSub = false;
      continue;
    }

    const indented = l.x1 < contentRight - 8;
    if (indented) {
      for (const c of chunks) { const t = joinParts(c).trim(); if (t) per.materials.push({ text: t }); }
    } else if (lastSection && !lastSection.hw) {
      lastSection.text += ' ' + firstText;
    } else if (lastSection && lastSection.hw) {
      per.homework[per.homework.length - 1] += ' ' + firstText;
    } else {
      per.sections.push(lastSection = { label: '', text: firstText });
    }
  }

  // attach link annotations
  for (const p of day.periods) {
    const ll = p._linkLines || [];
    delete p._linkLines;
    const seen = new Map();
    for (const l of ll) {
      // split the line into "·"-separated name segments, right to left
      const its = l.items.slice().sort((a, b) => b.x1 - a.x1);
      const segs = [[]];
      for (const i of its) {
        if (/^(🔗|📎)$/u.test(i.t.trim())) continue;
        if (/^[·•]$/.test(i.t.trim())) { segs.push([]); continue; }
        segs[segs.length - 1].push(i);
      }
      for (const seg of segs) {
        if (!seg.length) continue;
        const text = buildLine(l.y, seg).text.replace(/^(🔗|📎)\s*/u, '').trim();
        if (!text) continue;
        const x0 = Math.min(...seg.map(i => i.x)), x1 = Math.max(...seg.map(i => i.x1));
        const ann = links.find(a => a.y0 <= l.y + 2 && a.y1 >= l.y - 9 && a.x1 > x0 + 1 && a.x0 < x1 - 1);
        p.links.push({ url: ann ? ann.url : '', text });
      }
    }
    // keep link order as in the text
    p.links = dedupeLinks(p.links);
    delete p._needSub;
  }
}

function dedupeLinks(links) {
  const out = [];
  for (const l of links) {
    const same = out.find(o => o.url && o.url === l.url);
    if (same) continue;
    if (!l.url && out.some(o => norm(o.text) === norm(l.text))) continue;
    out.push(l);
  }
  return out;
}

function splitChunks(parts) {
  const chunks = [[]];
  parts.forEach((p, i) => {
    chunks[chunks.length - 1].push(p);
    if (p.gapAfter && i < parts.length - 1) chunks.push([]);
  });
  return chunks;
}

function normTime(t) {
  const [h, m] = t.split(':');
  return h.padStart(2, '0') + ':' + m;
}
const norm = s => (s || '').replace(/[\s"'״׳–\-·]/g, '');
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
