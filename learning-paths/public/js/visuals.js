// Visual aids drawn exactly from the task's data: a fraction as pies or bars, and groups of
// objects to count. Used on the student's screen and in the editor's preview.
import { h } from './ui.js';
import { fractionWords } from './math.js';

const SVG = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
};

// One whole: `filled` of its `d` parts coloured.
function pie(d, filled) {
  const g = svg('svg', { viewBox: '-52 -52 104 104', class: 'vis-pie', 'aria-hidden': 'true' });
  if (d === 1) {
    g.append(svg('circle', { r: 48, class: filled ? 'on' : 'off' }));
    return g;
  }
  for (let i = 0; i < d; i++) {
    const a0 = (i / d) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((i + 1) / d) * 2 * Math.PI - Math.PI / 2;
    const p = (a) => `${(48 * Math.cos(a)).toFixed(2)} ${(48 * Math.sin(a)).toFixed(2)}`;
    g.append(svg('path', { d: `M0 0 L${p(a0)} A48 48 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} Z`, class: i < filled ? 'on' : 'off' }));
  }
  return g;
}

function bar(d, filled) {
  const w = 200;
  const g = svg('svg', { viewBox: `-2 -2 ${w + 4} 44`, class: 'vis-bar', 'aria-hidden': 'true' });
  for (let i = 0; i < d; i++) {
    g.append(svg('rect', { x: (i * w) / d, y: 0, width: w / d, height: 40, class: i < filled ? 'on' : 'off' }));
  }
  return g;
}

export function visualEl(v) {
  if (!v) return null;
  if (v.kind === 'fraction') {
    const wholes = Math.max(1, Math.ceil(v.n / v.d));
    const shapes = [];
    for (let w = 0; w < wholes; w++) {
      const filled = Math.max(0, Math.min(v.d, v.n - w * v.d));
      shapes.push(v.shape === 'bar' ? bar(v.d, filled) : pie(v.d, filled));
    }
    return h('figure', { class: `visual vis-fraction ${v.shape}`, role: 'img', 'aria-label': `ציור של ${fractionWords(v.n, v.d)}` }, shapes);
  }
  if (v.kind === 'objects') {
    const parts = [];
    v.groups.forEach((g, i) => {
      if (i && v.op) parts.push(h('span', { class: 'vis-op', 'aria-hidden': 'true' }, v.op));
      // Rows of 5, like a ten-frame, so children can count at a glance.
      const rows = [];
      for (let k = 0; k < g.count; k += 5) rows.push(h('span', { class: 'vis-row' }, Array.from({ length: Math.min(5, g.count - k) }, () => g.emoji).join('')));
      parts.push(h('span', { class: 'vis-group' }, rows));
    });
    const label = v.groups.map((g) => `${g.count} ${g.emoji}`).join(v.op === '+' ? ' ועוד ' : v.op === '−' ? ' פחות ' : ', ');
    return h('figure', { class: 'visual vis-objects', role: 'img', 'aria-label': label, dir: 'ltr' }, parts);
  }
  return null;
}
