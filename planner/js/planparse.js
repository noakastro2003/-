// Reads Noa's weekly-plan PDF (overview page, "what to prepare" page,
// one page per day) into a plain JSON week object.
import { pageItems, linesFrom, joinParts, pageLinks, buildLine } from './pdftext.js';

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
const TIME_RANGE = /(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/;
const LEAD_EMOJI = /^[\p{Extended_Pictographic}️‍\s]+/u;

export async function parsePlanPdf(pdfjsLib, data) {
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const week = { title: '', number: null, cls: '', range: '', year: null, days: [], prep: {}, notes: [], importedAt: new Date().toISOString() };
  let curDay = null;

  for (let pn = 1; pn <= doc.numPages; pn++) {
    const page = await doc.getPage(pn);
    const { items, width, height } = await pageItems(page);
    const links = await pageLinks(page);
    const lines = linesFrom(items);
    const head = lines.slice(0, 3).map(l => l.text).join(' ');

    if (/^מה להכין/.test(lines[0]?.text || '')) {
      parsePrepPage(items, week);
    } else if (/תכנון שבועי/.test(head) && width > height) {
      parseOverview(lines, items, week);
    } else {
      const m = head.match(/יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי)/);
      if (m) {
        curDay = { dow: DAY_NAMES.indexOf(m[1]), name: m[1], date: (head.match(/(\d{1,2}\.\d{1,2})/) || [])[1] || '', periods: [] };
        week.days.push(curDay);
        const wk = head.match(/שבוע\s*(\d+)/);
        if (wk && !week.number) week.number = +wk[1];
        const cl = head.match(/·\s*([א-ת]['׳]?\d+)/);
        if (cl && !week.cls) week.cls = cl[1];
      }
      if (curDay) parseDayPage(lines, links, curDay, !!m);
    }
  }
  week.days.sort((a, b) => a.dow - b.dow);
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
    const tt = t.match(/תכנון שבועי[^]*?שבוע\s*\d+/);
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

// ---------- "what to prepare" page: one column per day ----------
function parsePrepPage(items, week) {
  const headers = linesFrom(items).flatMap(l => l.parts.filter(p => /^יום\s+[א-ו]['׳]?/.test(p.text)).map(p => ({ ...p, y: l.y })));
  if (!headers.length) return;
  headers.sort((a, b) => b.x1 - a.x1);
  const top = Math.min(...headers.map(h => h.y)) + 4;
  headers.forEach((h, i) => {
    const letter = h.text.match(/יום\s+([א-ו])/)[1];
    const dow = DAY_LETTERS.indexOf(letter);
    const right = h.x1 + 8;
    const left = i + 1 < headers.length ? headers[i + 1].x1 + 8 : -1;
    const footY = Math.max(...items.map(i => i.y)) - 1;
    const col = items.filter(it => it.y > top && it.y < footY && it.x1 <= right && it.x1 > left && !/^©/.test(it.t));
    const lines = linesFrom(col);
    const sections = [];
    let sec = null, lastItem = null, lastY = -99;
    for (const l of lines) {
      const txt = l.text.trim();
      if (!txt) continue;
      const isHeader = l.parts.every(p => p.bold || LEAD_EMOJI.test(p.text) && !p.text.replace(LEAD_EMOJI, '')) && l.parts.some(p => p.bold);
      if (isHeader) {
        sec = { title: txt.replace(LEAD_EMOJI, '').trim(), icon: (txt.match(LEAD_EMOJI) || [''])[0].trim(), items: [] };
        sections.push(sec);
        lastItem = null;
      } else if (sec) {
        if (lastItem && l.y - lastY < 12.5) {
          lastItem.text = (lastItem.text + (/-$/.test(lastItem.text) ? '' : ' ') + txt).trim();
        } else {
          lastItem = { text: txt };
          sec.items.push(lastItem);
        }
      }
      lastY = l.y;
    }
    for (const s of sections) for (const it of s.items) {
      const m = it.text.match(/\(שעה\s*(\d+)\)\s*$/);
      if (m) { it.period = m[1]; it.text = it.text.replace(m[0], '').trim(); }
    }
    week.prep[dow] = sections;
  });
}

// ---------- day page: one card per period ----------
function parseDayPage(lines, links, day, hasHeader) {
  const body = hasHeader ? lines.slice(1) : lines;
  const contentRight = Math.max(...body.flatMap(l => l.parts.filter(p => p.x0 < 500).map(p => p.x1)), 0);
  let per = null;
  let lastSection = null;

  for (const l of body) {
    const side = l.parts.filter(p => p.x0 >= 500);
    const main = l.parts.filter(p => p.x0 < 500);
    for (const p of side) {
      const tr = p.text.match(TIME_RANGE);
      if (tr && per) {
        const [a, b] = [tr[1], tr[2]].map(normTime).sort();
        per.start = a; per.end = b;
      } else if (p.size >= 13) {
        per = { label: p.text.trim(), start: '', end: '', title: '', subtitle: '', subject: '', badges: [], sections: [], materials: [], homework: [], links: [], y0: l.y - 14, y1: 1e9 };
        if (day.periods.length) day.periods[day.periods.length - 1].y1 = per.y0;
        day.periods.push(per);
        lastSection = null;
      }
    }
    if (!per || !main.length || /^©/.test(main[0].text)) continue;

    const chunks = splitChunks(main);
    const firstText = joinParts(chunks[0]).trim();

    if (!per.title && main[0].bold && main[0].size >= 10) {
      per.title = main[0].text.trim();
      const rest = chunks[0].slice(1);
      per.subtitle = joinParts(rest).trim();
      per.subject = per.subtitle.split('·')[0].trim();
      for (const c of chunks.slice(1)) per.badges.push(joinParts(c).trim());
      continue;
    }

    if (/^🔗/.test(firstText)) {
      // link names are matched against the PDF link annotations below
      per._linkLines = per._linkLines || [];
      per._linkLines.push(l);
      continue;
    }

    const labelIdx = chunks[0].findIndex(p => p.bold);
    const labelPart = labelIdx >= 0 ? chunks[0][labelIdx] : null;
    if (labelPart && /:\s*$/.test(labelPart.text) && chunks[0].slice(0, labelIdx).every(p => !p.text.replace(LEAD_EMOJI, ''))) {
      const label = labelPart.text.replace(/:\s*$/, '').trim();
      const text = joinParts(chunks[0].slice(labelIdx + 1)).trim();
      if (/שיעורי בית/.test(label)) {
        if (text) per.homework.push(text);
        lastSection = { hw: true };
      } else {
        lastSection = { label, text };
        per.sections.push(lastSection);
      }
      for (const c of chunks.slice(1)) per.materials.push({ text: joinParts(c).trim() });
      continue;
    }

    const indented = l.x1 < contentRight - 8;
    if (indented) {
      for (const c of chunks) {
        const t = joinParts(c).trim();
        if (t) per.materials.push({ text: t });
      }
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
        if (/^🔗$/u.test(i.t.trim())) continue;
        if (/^[·•]$/.test(i.t.trim())) { segs.push([]); continue; }
        segs[segs.length - 1].push(i);
      }
      for (const seg of segs) {
        if (!seg.length) continue;
        const text = buildLine(l.y, seg).text.replace(/^🔗\s*/u, '').trim();
        if (!text) continue;
        const x0 = Math.min(...seg.map(i => i.x)), x1 = Math.max(...seg.map(i => i.x1));
        const ann = links.find(a => a.y0 <= l.y + 2 && a.y1 >= l.y - 9 && a.x1 > x0 + 1 && a.x0 < x1 - 1);
        p.links.push({ url: ann ? ann.url : '', text });
      }
    }
    // keep link order as in the text
    p.links = dedupeLinks(p.links);
    delete p.y0; delete p.y1;
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
