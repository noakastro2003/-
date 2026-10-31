// Turns a pdf.js page into logical (right-to-left) Hebrew text lines.
// Works for PDFs printed from Chrome: items come in visual order,
// each Hebrew item is already logical, digits/punctuation are visual.

const HEB = /[א-ת]/;
const MARK = /^[֑-ׇ]+$/; // niqqud / cantillation only
const LTR_RUN = /[0-9A-Za-z][0-9A-Za-z.:,\/+%=×x_@#&-]*[0-9A-Za-z%]|[0-9A-Za-z]/g;
const MIRROR = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', '«': '»', '»': '«' };

function fixNeutral(s) {
  return Array.from(s).reverse().map(c => MIRROR[c] || c).join('');
}

// visual-order non-Hebrew item -> logical (as it would appear in RTL text)
export function visualToLogical(s) {
  if (HEB.test(s)) return s;
  const runs = [];
  let last = 0;
  for (const m of s.matchAll(LTR_RUN)) {
    if (m.index > last) runs.push(fixNeutral(s.slice(last, m.index)));
    runs.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < s.length) runs.push(fixNeutral(s.slice(last)));
  return runs.reverse().join('');
}

export async function pageLines(page) {
  const { items } = await pageItems(page);
  return linesFrom(items);
}

export function linesFrom(items) {
  items = items.slice().sort((a, b) => a.y - b.y);
  const lines = [];
  for (const it of items) {
    let line = lines.find(l => Math.abs(l.y - it.y) <= 2.5);
    if (!line) { line = { y: it.y, items: [] }; lines.push(line); }
    line.items.push(it);
  }
  return lines.map(l => buildLine(l.y, l.items)).sort((a, b) => a.y - b.y);
}

export async function pageItems(page) {
  await page.getOperatorList(); // makes fonts available in commonObjs
  const tc = await page.getTextContent();
  const vp = page.getViewport({ scale: 1 });
  const boldCache = {};
  const isBold = (fn) => {
    if (!(fn in boldCache)) {
      let name = '';
      try { name = page.commonObjs.get(fn).name || ''; } catch (e) { /* ignore */ }
      boldCache[fn] = /bold|black|heavy/i.test(name);
    }
    return boldCache[fn];
  };

  let items = [];
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4];
    const yb = vp.height - it.transform[5];
    const size = Math.round(Math.abs(it.transform[3]) || it.height);
    items.push({ s: it.str, x, w: it.width, x1: x + it.width, y: yb, size, bold: isBold(it.fontName) });
  }

  // attach niqqud marks to the letter they sit over
  const marks = items.filter(i => MARK.test(i.s));
  items = items.filter(i => !MARK.test(i.s));
  for (const m of marks) {
    let best = null, bd = 1e9;
    for (const b of items) {
      if (Math.abs(b.y - m.y) > 3 || !HEB.test(b.s)) continue;
      const d = m.x < b.x ? b.x - m.x : m.x > b.x1 ? m.x - b.x1 : 0;
      if (d < bd) { bd = d; best = b; }
    }
    if (!best || bd > 3) continue;
    const chars = Array.from(best.s);
    // Hebrew item is logical: first char is the rightmost
    let idx = Math.floor((best.x1 - m.x) / (best.w || 1) * chars.length);
    idx = Math.max(0, Math.min(chars.length - 1, idx));
    chars[idx] = chars[idx] + m.s;
    best.s = chars.join('');
  }

  for (const it of items) it.t = visualToLogical(it.s);
  return { items, width: vp.width, height: vp.height };
}

export function buildLine(y, items) {
  items = items.slice().sort((a, b) => b.x1 - a.x1); // right to left
  const parts = [];
  let cur = null, prev = null;
  for (const it of items) {
    const gap = prev ? prev.x - it.x1 : 0;
    const txt = it.t ?? visualToLogical(it.s);
    if (!cur || gap > 9 || cur.bold !== it.bold) {
      if (cur && gap > 9) cur.gapAfter = true;
      const space = cur && gap > 1.2 && gap <= 9;
      cur = { text: '', bold: it.bold, size: it.size, x0: it.x, x1: it.x1, spaceBefore: space };
      parts.push(cur);
      cur.text = txt;
    } else {
      cur.text += (gap > 1.2 ? ' ' : '') + txt;
      cur.x0 = Math.min(cur.x0, it.x);
      cur.size = Math.max(cur.size, it.size);
    }
    prev = it;
  }
  return {
    y,
    x0: Math.min(...items.map(i => i.x)),
    x1: Math.max(...items.map(i => i.x1)),
    size: Math.max(...items.map(i => i.size)),
    parts,
    items,
    get text() { return joinParts(this.parts); },
  };
}

export function joinParts(parts) {
  let s = '';
  parts.forEach((p, i) => {
    if (i > 0) s += (parts[i - 1].gapAfter ? '  ' : (p.spaceBefore ? ' ' : ''));
    s += p.text;
  });
  return s.replace(/\b(pptx|docx|xlsx|pdf|png|jpe?g|mp4)\.([^\s.]+)/gi, '$2.$1').replace(/\s+$/, '');
}

export async function pageLinks(page) {
  const vp = page.getViewport({ scale: 1 });
  const ann = await page.getAnnotations();
  return ann.filter(a => a.subtype === 'Link' && a.url).map(a => ({
    url: a.url,
    x0: a.rect[0], x1: a.rect[2],
    y0: vp.height - a.rect[3], y1: vp.height - a.rect[1],
  }));
}
