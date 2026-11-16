// Fractions as children see them in the notebook: "3/5" → ³⁄₅ drawn as a numerator over a
// line over a denominator, "1 ו-3/5" → a whole number beside a fraction. A math expression
// ("3/4 + 1/4 = 1") is kept left-to-right inside Hebrew text, like in a math book.
// Also: the words to read a fraction aloud ("שלוש חמישיות").

const NUM = String.raw`\d{1,4}`;
const FRAC = String.raw`${NUM}\s*\/\s*${NUM}(?![\d/])`;
const MIXED = String.raw`${NUM}\s+ו-?\s*${FRAC}`; // "1 ו-3/5", "2 ו 1/4"
const TERM = String.raw`(?:${MIXED}|${FRAC}|${NUM}|\?|_{2,})`;
// ":" and "x" count as signs only with spaces around them ("6 : 2"); otherwise they are punctuation/letters.
const OP = String.raw`(?:\s*[+\-−–×*÷=<>≤≥]\s*|\s+[:x]\s+)`;
// A run of terms and operators that contains at least one fraction.
const RUN = new RegExp(String.raw`(?<![\d/])${TERM}(?:${OP}${TERM})*`, 'g');
const HAS_FRAC = new RegExp(FRAC);
const PART = new RegExp(String.raw`(${MIXED})|(${FRAC})`, 'g');

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

function fractionEl(n, d) {
  const f = el('span', 'frac');
  f.setAttribute('role', 'img');
  f.setAttribute('aria-label', fractionWords(n, d));
  f.append(el('span', 'frac-n', n), el('span', 'frac-d', d));
  return f;
}

// One math run → nodes (left-to-right).
function renderRun(text) {
  const box = el('span', 'math');
  box.dir = 'ltr';
  let last = 0;
  for (const m of text.matchAll(PART)) {
    if (m.index > last) box.append(text.slice(last, m.index).replace(/\s+/g, ' '));
    if (m[1]) {
      const [, whole, n, d] = m[1].match(new RegExp(String.raw`(${NUM})\s+ו-?\s*(${NUM})\s*\/\s*(${NUM})`));
      const mixed = el('span', 'mixed');
      mixed.setAttribute('aria-label', `${whole} ו${fractionWords(n, d)}`);
      mixed.append(el('span', 'whole', whole), fractionEl(n, d));
      box.append(mixed);
    } else {
      const [n, d] = m[2].split('/').map((x) => x.trim());
      box.append(fractionEl(n, d));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) box.append(text.slice(last));
  return box;
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE']);

// Replaces fractions in every text node under root (once; already drawn ones are skipped).
export function drawFractions(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      for (let p = node.parentElement; p && p !== root.parentElement; p = p.parentElement) {
        if (SKIP.has(p.tagName) || p.classList.contains('math') || p.classList.contains('no-math')) return NodeFilter.FILTER_REJECT;
      }
      return HAS_FRAC.test(node.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.data;
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of text.matchAll(RUN)) {
      if (!HAS_FRAC.test(m[0])) continue;
      // Keep the spaces around the run outside it.
      const lead = m[0].length - m[0].trimStart().length;
      const run = m[0].trim();
      const start = m.index + lead;
      if (start > last) frag.append(text.slice(last, start));
      frag.append(renderRun(run));
      last = start + run.length;
    }
    if (last === 0) continue;
    if (last < text.length) frag.append(text.slice(last));
    node.replaceWith(frag);
  }
}

// Keeps drawing fractions as the content under root changes (games re-render often).
export function watchFractions(root) {
  drawFractions(root);
  let pending = false;
  const obs = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => { pending = false; obs.disconnect(); drawFractions(root); obs.observe(root, OPTS); });
  });
  const OPTS = { childList: true, subtree: true, characterData: true };
  obs.observe(root, OPTS);
  return obs;
}

// ---------- reading aloud ----------

const ONES_F = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר'];
const ONES_M = ['', 'אחד', 'שניים', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה', 'עשרה'];
// [singular, plural, gender of the plural]
const PARTS = {
  2: ['חצי', 'חצאים', 'm'], 3: ['שליש', 'שלישים', 'm'], 4: ['רבע', 'רבעים', 'm'], 5: ['חמישית', 'חמישיות', 'f'],
  6: ['שישית', 'שישיות', 'f'], 7: ['שביעית', 'שביעיות', 'f'], 8: ['שמינית', 'שמיניות', 'f'], 9: ['תשיעית', 'תשיעיות', 'f'],
  10: ['עשירית', 'עשיריות', 'f'], 100: ['מאית', 'מאיות', 'f'], 1000: ['אלפית', 'אלפיות', 'f'],
};

export function fractionWords(n, d) {
  const num = Number(n);
  const den = Number(d);
  const part = PARTS[den];
  if (!part) return `${n} חלקי ${d}`;
  if (num === 1) return part[0];
  const count = num <= 10 ? (part[2] === 'f' ? ONES_F : ONES_M)[num] : String(num);
  // Hebrew construct for 2 masculine: "שני שלישים"
  const word = num === 2 && part[2] === 'm' ? 'שני' : num === 2 ? 'שתי' : count;
  return `${word} ${part[1]}`;
}

// Text for speech synthesis: fractions and math symbols in words.
export function speakableMath(text) {
  // Signs between numbers first (while the digits are still there), then the fractions.
  const between = (sign, word) => (s) => s.replace(new RegExp(String.raw`(\d)\s*${sign}\s*(?=[\d?])`, 'g'), `$1 ${word} `);
  let s = String(text);
  for (const f of [between('=', 'שווה'), between('\\+', 'ועוד'), between('[−–]', 'פחות'), between('\\s-', 'פחות'),
    between('[×*]', 'כפול'), between('÷', 'חלקי'), between(':(?=\\s)', 'חלקי')]) s = f(s);
  return s
    .replace(new RegExp(String.raw`(${NUM})\s+ו-?\s*(${NUM})\s*\/\s*(${NUM})(?![\d/])`, 'g'), (_, w, n, d) => `${w} ו${fractionWords(n, d)}`)
    .replace(new RegExp(String.raw`(?<![\d/])(${NUM})\s*\/\s*(${NUM})(?![\d/])`, 'g'), (_, n, d) => fractionWords(n, d));
}
