// Interactive task types for students. Each renderer returns:
//   el       – the game's DOM
//   answer() – what to send to the server
//   ready()  – null when the answer can be submitted, else a short hint to show
//   wrong(i) – optional: mark the items the server said are wrong
//   label    – optional text for the finish button
// and calls ctx.complete() itself when a game finishes on its own (memory, word search).
import { h, mount } from './ui.js';
import { stripNikud } from './themes.js';
import { shrinkImage } from './media.js';

// Stands in for an upload in the teacher's preview, where nothing is saved.
const PREVIEW_FILE = '/api/media/preview-only';

const PAIR_COLORS = ['#ffd166', '#06d6a0', '#74b9ff', '#ff8fab', '#b39cd0', '#ffb347', '#9be7c4', '#f6a6ff'];

function shuffle(list, rnd = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Small seeded PRNG so a word search grid stays the same across reloads.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- memory ----------

const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Component}\u200d\ufe0f\s]{1,12}$/u;

function memory(t, ctx) {
  const pairs = t.content.pairs;
  const cards = shuffle(pairs.flatMap((p, id) => [{ id, label: p.a }, { id, label: p.b || p.a }]));
  let first = null;
  let lock = false;
  let matched = 0;
  let moves = 0;
  const counter = h('p', { class: 'game-counter' });
  const drawCounter = () => { counter.textContent = `זוגות שנמצאו: ${matched} מתוך ${pairs.length} · ניסיונות: ${moves}`; };

  const buttons = cards.map((card, i) => {
    const btn = h('button', {
      class: 'mem-card', 'aria-label': `קלף ${i + 1}`,
      onclick: () => {
        if (lock || card.matched || card === first) return;
        flip(btn, card, true);
        if (!first) { first = card; first.btn = btn; return; }
        moves++;
        const a = first;
        first = null;
        if (a.id === card.id) {
          a.matched = card.matched = true;
          a.btn.classList.add('matched');
          btn.classList.add('matched');
          matched++;
          drawCounter();
          if (matched === pairs.length) setTimeout(ctx.complete, 600);
        } else {
          lock = true;
          drawCounter();
          setTimeout(() => { flip(a.btn, a, false); flip(btn, card, false); lock = false; }, 1000);
        }
      },
    }, h('span', { class: 'mem-back', 'aria-hidden': 'true' }, '?'),
      h('span', { class: `mem-front path-font${EMOJI_ONLY.test(card.label) ? ' emoji-only' : ''}` }, card.label));
    return btn;
  });

  function flip(btn, card, up) {
    btn.classList.toggle('up', up);
    btn.setAttribute('aria-label', up ? card.label : 'קלף הפוך');
  }

  drawCounter();
  return {
    el: h('div', { class: 'game' }, counter, h('div', { class: `mem-grid${cards.length > 12 ? ' many' : ''}` }, buttons)),
    answer: () => null,
    ready: () => (matched === pairs.length ? null : `נשארו עוד ${pairs.length - matched} זוגות 🃏`),
  };
}

// ---------- word search ----------

const FILL = 'אבגדהוזחטיכלמנסעפצקרשת';
const DIRS = [[0, 1], [1, 0], [1, 1]];

function buildGrid(words, seed) {
  const clean = words.map((w) => Array.from(stripNikud(w).replace(/\s+/g, '')));
  const total = clean.reduce((s, w) => s + w.length, 0);
  let size = Math.min(12, Math.max(7, ...clean.map((w) => w.length), Math.ceil(Math.sqrt(total * 2))));
  for (let attempt = 0; attempt < 60; attempt++) {
    const rnd = seeded(seed + attempt);
    const grid = Array.from({ length: size }, () => Array(size).fill(null));
    const order = clean.map((w, i) => i).sort((a, b) => clean[b].length - clean[a].length);
    const ok = order.every((wi) => {
      const w = clean[wi];
      for (let tries = 0; tries < 300; tries++) {
        const [dr, dc] = DIRS[Math.floor(rnd() * DIRS.length)];
        const r0 = Math.floor(rnd() * (size - dr * (w.length - 1)));
        const c0 = Math.floor(rnd() * (size - dc * (w.length - 1)));
        if (w.every((ch, k) => [null, ch].includes(grid[r0 + dr * k][c0 + dc * k]))) {
          w.forEach((ch, k) => { grid[r0 + dr * k][c0 + dc * k] = ch; });
          return true;
        }
      }
      return false;
    });
    if (ok) {
      const rnd2 = seeded(seed * 7 + 1);
      return grid.map((row) => row.map((ch) => ch || FILL[Math.floor(rnd2() * FILL.length)]));
    }
    if (attempt % 10 === 9 && size < 12) size++;
  }
  throw new Error('grid');
}

function wordsearch(t, ctx) {
  const words = t.content.words;
  const targets = words.map((w) => stripNikud(w).replace(/\s+/g, ''));
  const grid = buildGrid(words, t.id * 9973);
  const size = grid.length;
  const found = new Set();
  const cells = [];
  const wordEls = words.map((w) => h('li', {}, stripNikud(w)));
  const gridEl = h('div', { class: 'ws-grid', style: { gridTemplateColumns: `repeat(${size}, 1fr)` }, role: 'grid', 'aria-label': 'טבלת אותיות' });
  grid.forEach((row, r) => row.forEach((ch, c) => {
    const cell = h('div', { class: 'ws-cell', dataset: { r, c } }, ch);
    cells.push(cell);
    gridEl.append(cell);
  }));
  const cellAt = (r, c) => cells[r * size + c];
  const counter = h('p', { class: 'game-counter' });
  const drawCounter = () => { counter.textContent = `מצאת ${found.size} מתוך ${words.length} מילים`; };

  const line = (a, b) => {
    const dr = Math.sign(b.r - a.r);
    const dc = Math.sign(b.c - a.c);
    const len = Math.max(Math.abs(b.r - a.r), Math.abs(b.c - a.c));
    if (!(a.r === b.r || a.c === b.c || Math.abs(b.r - a.r) === Math.abs(b.c - a.c))) return null;
    return Array.from({ length: len + 1 }, (_, k) => ({ r: a.r + dr * k, c: a.c + dc * k }));
  };
  const posOf = (el) => (el?.classList?.contains('ws-cell') ? { r: Number(el.dataset.r), c: Number(el.dataset.c) } : null);
  const clearSel = () => cells.forEach((c) => c.classList.remove('sel'));
  const showSel = (pts) => { clearSel(); pts?.forEach((p) => cellAt(p.r, p.c).classList.add('sel')); };

  const trySelect = (pts) => {
    clearSel();
    if (!pts || pts.length < 2) return;
    const s = pts.map((p) => grid[p.r][p.c]).join('');
    const rev = [...s].reverse().join('');
    const i = targets.findIndex((w, idx) => !found.has(idx) && (w === s || w === rev));
    if (i < 0) {
      pts.forEach((p) => cellAt(p.r, p.c).classList.add('miss'));
      setTimeout(() => cells.forEach((c) => c.classList.remove('miss')), 400);
      return;
    }
    found.add(i);
    const color = PAIR_COLORS[i % PAIR_COLORS.length];
    pts.forEach((p) => { const el = cellAt(p.r, p.c); el.classList.add('found'); el.style.setProperty('--found', color); });
    wordEls[i].classList.add('found');
    wordEls[i].style.setProperty('--found', color);
    drawCounter();
    if (found.size === words.length) setTimeout(ctx.complete, 600);
  };

  // Drag from first to last letter, or tap the first letter and then the last.
  let start = null;
  let anchor = null;
  gridEl.addEventListener('pointerdown', (e) => {
    const p = posOf(e.target);
    if (!p) return;
    e.preventDefault();
    start = p;
    showSel(anchor ? line(anchor, p) : [p]);
  });
  gridEl.addEventListener('pointermove', (e) => {
    if (!start) return;
    const p = posOf(document.elementFromPoint(e.clientX, e.clientY));
    if (p) showSel(line(anchor || start, p));
  });
  const end = (e) => {
    if (!start) return;
    const p = posOf(document.elementFromPoint(e.clientX, e.clientY)) || start;
    const s = start;
    start = null;
    if (p.r === s.r && p.c === s.c) {
      if (anchor && !(anchor.r === p.r && anchor.c === p.c)) { trySelect(line(anchor, p)); anchor = null; }
      else if (anchor) { anchor = null; clearSel(); }
      else { anchor = p; showSel([p]); }
    } else {
      anchor = null;
      trySelect(line(s, p));
    }
  };
  gridEl.addEventListener('pointerup', end);
  gridEl.addEventListener('pointercancel', () => { start = null; clearSel(); });

  drawCounter();
  return {
    el: h('div', { class: 'game' }, counter, h('div', { class: 'ws-wrap' }, gridEl, h('ul', { class: 'ws-words path-font' }, wordEls))),
    answer: () => null,
    ready: () => (found.size === words.length ? null : `נשארו עוד ${words.length - found.size} מילים 🔍`),
  };
}

// ---------- matching ----------

function matching(t) {
  const { left, right } = t.content;
  const assign = left.map(() => null); // left index -> right index
  let selLeft = null;
  let selRight = null;
  let wrongSet = new Set();
  const wrap = h('div', { class: 'match-cols' });

  const pairUp = (li, ri) => {
    const prev = assign.indexOf(ri);
    if (prev >= 0) assign[prev] = null;
    assign[li] = ri;
    wrongSet.delete(li);
    selLeft = selRight = null;
  };

  const render = () => {
    const colorOf = (li) => PAIR_COLORS[li % PAIR_COLORS.length];
    mount(wrap,
      h('div', { class: 'match-col' }, left.map((txt, li) => h('button', {
        class: `match-item path-font${selLeft === li ? ' selected' : ''}${wrongSet.has(li) ? ' wrong' : ''}`,
        style: assign[li] !== null ? { '--pair': colorOf(li) } : null,
        dataset: { paired: assign[li] !== null ? '1' : '' },
        onclick: () => {
          if (selRight !== null) pairUp(li, selRight);
          else if (assign[li] !== null && selLeft === null) { assign[li] = null; selLeft = li; }
          else selLeft = selLeft === li ? null : li;
          render();
        },
      }, txt))),
      h('div', { class: 'match-col' }, right.map((txt, ri) => {
        const li = assign.indexOf(ri);
        return h('button', {
          class: `match-item path-font${selRight === ri ? ' selected' : ''}`,
          style: li >= 0 ? { '--pair': colorOf(li) } : null,
          dataset: { paired: li >= 0 ? '1' : '' },
          onclick: () => {
            if (selLeft !== null) pairUp(selLeft, ri);
            else if (li >= 0) { assign[li] = null; selRight = ri; }
            else selRight = selRight === ri ? null : ri;
            render();
          },
        }, txt);
      })));
  };
  render();
  return {
    el: h('div', { class: 'game' }, h('p', { class: 'game-counter' }, 'לחצו על פריט, ואז על בן הזוג שלו'), wrap),
    answer: () => assign.map((ri) => right[ri]),
    ready: () => {
      const left_ = assign.filter((x) => x === null).length;
      return left_ ? `נשארו עוד ${left_} זוגות לחבר 🔗` : null;
    },
    wrong: (idx) => {
      wrongSet = new Set(idx);
      idx.forEach((i) => { assign[i] = null; });
      render();
    },
    label: 'בדיקה ✓',
  };
}

// ---------- order ----------

function order(t) {
  let items = [...t.content.items];
  let wrongSet = new Set();
  const list = h('ol', { class: 'order-list' });
  let dragFrom = null;
  const move = (i, j) => {
    if (j < 0 || j >= items.length) return;
    const [x] = items.splice(i, 1);
    items.splice(j, 0, x);
    wrongSet = new Set();
    render();
    list.children[j]?.querySelector(j > i ? '.down' : '.up')?.focus();
  };
  const render = () => mount(list, items.map((txt, i) => h('li', {
    class: `order-item${wrongSet.has(i) ? ' wrong' : ''}`, draggable: 'true',
    ondragstart: () => { dragFrom = i; },
    ondragover: (e) => e.preventDefault(),
    ondrop: (e) => { e.preventDefault(); if (dragFrom !== null) move(dragFrom, i); dragFrom = null; },
  },
    h('span', { class: 'order-num' }, i + 1),
    h('span', { class: 'order-text path-font' }, txt),
    h('span', { class: 'order-btns' },
      h('button', { class: 'icon-btn up', 'aria-label': `להזיז למעלה: ${txt}`, disabled: i === 0, onclick: () => move(i, i - 1) }, '▲'),
      h('button', { class: 'icon-btn down', 'aria-label': `להזיז למטה: ${txt}`, disabled: i === items.length - 1, onclick: () => move(i, i + 1) }, '▼')))));
  render();
  return {
    el: h('div', { class: 'game' }, h('p', { class: 'game-counter' }, 'הזיזו עם החצים (או גררו) עד שהסדר נכון'), list),
    answer: () => items,
    ready: () => null,
    wrong: (idx) => { wrongSet = new Set(idx); render(); },
    label: 'בדיקה ✓',
  };
}

// ---------- fill in the blanks ----------

function blanks(t) {
  const { segments, bank } = t.content;
  const slots = Array(segments.length - 1).fill(null); // slot -> bank index
  let active = null;
  let wrongSet = new Set();
  const passage = h('p', { class: 'blanks-text path-font' });
  const bankEl = h('div', { class: 'word-bank' });

  const place = (bi) => {
    const target = active ?? slots.indexOf(null);
    if (target < 0) return;
    slots[target] = bi;
    wrongSet.delete(target);
    active = null;
    render();
  };

  const render = () => {
    const nodes = [];
    segments.forEach((seg, i) => {
      nodes.push(seg);
      if (i < slots.length) {
        const bi = slots[i];
        nodes.push(h('button', {
          class: `blank${bi !== null ? ' filled' : ''}${active === i ? ' active' : ''}${wrongSet.has(i) ? ' wrong' : ''}`,
          'aria-label': bi !== null ? `מילה ${i + 1}: ${bank[bi]} (לחצו להסרה)` : `מקום ריק ${i + 1}`,
          onclick: () => {
            if (slots[i] !== null) { slots[i] = null; wrongSet.delete(i); active = i; }
            else active = active === i ? null : i;
            render();
          },
        }, bi !== null ? bank[bi] : ' '));
      }
    });
    mount(passage, nodes);
    mount(bankEl, bank.map((w, bi) => h('button', {
      class: 'chip-word path-font', disabled: slots.includes(bi), onclick: () => place(bi),
    }, w)));
  };
  render();
  return {
    el: h('div', { class: 'game' }, passage, h('p', { class: 'game-counter' }, 'מחסן המילים – לחצו על מילה כדי להכניס אותה'), bankEl),
    answer: () => slots.map((bi) => bank[bi]),
    ready: () => {
      const n = slots.filter((x) => x === null).length;
      return n ? `נשארו עוד ${n} מקומות ריקים ✏️` : null;
    },
    wrong: (idx) => {
      wrongSet = new Set(idx);
      render();
      setTimeout(() => { idx.forEach((i) => { slots[i] = null; }); render(); }, 1200);
    },
    label: 'בדיקה ✓',
  };
}

// ---------- true / false ----------

function truefalse(t) {
  const { statements } = t.content;
  const answers = statements.map(() => null);
  let wrongSet = new Set();
  const list = h('ul', { class: 'tf-list' });
  const render = () => mount(list, statements.map((s, i) => h('li', { class: `tf-item${wrongSet.has(i) ? ' wrong' : ''}` },
    h('span', { class: 'tf-text path-font' }, s),
    h('span', { class: 'tf-btns', role: 'radiogroup', 'aria-label': s },
      [[true, '✓ נכון', 'yes'], [false, '✗ לא נכון', 'no']].map(([val, label, cls]) => h('button', {
        class: `tf-btn ${cls}${answers[i] === val ? ' on' : ''}`, role: 'radio', 'aria-checked': String(answers[i] === val),
        onclick: () => { answers[i] = val; wrongSet.delete(i); render(); },
      }, label))))));
  render();
  return {
    el: h('div', { class: 'game' }, list),
    answer: () => answers,
    ready: () => {
      const n = answers.filter((x) => x === null).length;
      return n ? `נשארו עוד ${n} משפטים ⚖️` : null;
    },
    wrong: (idx) => { wrongSet = new Set(idx); idx.forEach((i) => { answers[i] = null; }); render(); },
    label: 'בדיקה ✓',
  };
}

// ---------- dragging with a finger or a mouse ----------

// Calls onDrop(elementUnderPointer) when the element is dragged and released. A short tap
// is left to the element's own click handler; a drag swallows the click that follows it.
function dragSource(el, { onStart, onMove, onDrop, ghost = false }) {
  let start = null;
  let dragging = false;
  let clone = null;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    start = { x: e.clientX, y: e.clientY };
    el.setPointerCapture?.(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!start) return;
    if (!dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) {
      dragging = true;
      el.classList.add('dragging');
      if (ghost) {
        const r = el.getBoundingClientRect();
        clone = el.cloneNode(true);
        clone.classList.add('drag-ghost');
        clone.style.width = `${r.width}px`;
        document.body.append(clone);
      }
      onStart?.();
    }
    if (!dragging) return;
    if (clone) {
      clone.style.left = `${e.clientX - clone.offsetWidth / 2}px`;
      clone.style.top = `${e.clientY - clone.offsetHeight / 2}px`;
    }
    onMove?.(e);
  });
  const end = (e, cancelled) => {
    if (!start) return;
    start = null;
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    clone?.remove();
    clone = null;
    el.dataset.dragged = '1';
    setTimeout(() => { delete el.dataset.dragged; }, 60);
    onDrop(cancelled ? null : document.elementFromPoint(e.clientX, e.clientY));
  };
  el.addEventListener('pointerup', (e) => end(e, false));
  el.addEventListener('pointercancel', (e) => end(e, true));
}
const wasDragged = (el) => el.dataset.dragged === '1';

const SVG = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, val] of Object.entries(attrs)) el.setAttribute(k, val);
  return el;
};

// ---------- draw a line between partners ----------

function lines(t) {
  const { left, right } = t.content;
  const assign = left.map(() => null); // left index -> right index
  let sel = null; // { side: 'a' | 'b', i }
  let wrongSet = new Set();
  const svg = svgEl('svg', { class: 'lines-svg', 'aria-hidden': 'true' });
  const temp = svgEl('line', { class: 'lines-temp' });
  const colA = h('div', { class: 'lines-col' });
  const colB = h('div', { class: 'lines-col' });
  const board = h('div', { class: 'lines-board' }, colA, colB, svg);
  const btnsA = [];
  const btnsB = [];

  const dotOf = (side, i) => {
    const dot = (side === 'a' ? btnsA : btnsB)[i]?.querySelector('.lines-dot');
    if (!dot) return null;
    const r = dot.getBoundingClientRect();
    const b = board.getBoundingClientRect();
    return { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top };
  };
  const connect = (li, ri) => {
    const prev = assign.indexOf(ri);
    if (prev >= 0) assign[prev] = null;
    assign[li] = ri;
    wrongSet.delete(li);
    sel = null;
    render();
  };
  const pick = (side, i) => {
    if (sel && sel.side !== side) {
      const [li, ri] = side === 'a' ? [i, sel.i] : [sel.i, i];
      return connect(li, ri);
    }
    // Tapping a connected item lifts its line so it can go elsewhere.
    const li = side === 'a' ? i : assign.indexOf(i);
    if (li >= 0 && assign[li] !== null && !(sel && sel.side === side && sel.i === i)) assign[li] = null;
    sel = sel && sel.side === side && sel.i === i ? null : { side, i };
    render();
  };

  const draw = () => {
    while (svg.firstChild) svg.firstChild.remove();
    assign.forEach((ri, li) => {
      if (ri === null) return;
      const p = dotOf('a', li);
      const q = dotOf('b', ri);
      if (!p || !q) return;
      svg.append(svgEl('line', {
        x1: p.x, y1: p.y, x2: q.x, y2: q.y,
        class: `lines-line${wrongSet.has(li) ? ' wrong' : ''}`,
        stroke: PAIR_COLORS[li % PAIR_COLORS.length],
      }));
    });
    svg.append(temp);
  };

  const item = (side, i, txt) => {
    const li = side === 'a' ? i : assign.indexOf(i);
    const linked = side === 'a' ? assign[i] !== null : li >= 0;
    const btn = h('button', {
      class: `lines-item path-font${sel?.side === side && sel.i === i ? ' selected' : ''}${side === 'a' && wrongSet.has(i) ? ' wrong' : ''}`,
      style: linked ? { '--pair': PAIR_COLORS[li % PAIR_COLORS.length] } : null,
      dataset: { side, i: String(i), linked: linked ? '1' : '' },
      onclick: () => { if (!wasDragged(btn)) pick(side, i); },
    }, h('span', { class: 'lines-text' }, txt), h('span', { class: 'lines-dot', 'aria-hidden': 'true' }));
    dragSource(btn, {
      onStart: () => {
        if (side === 'a') assign[i] = null;
        else if (assign.indexOf(i) >= 0) assign[assign.indexOf(i)] = null;
        sel = { side, i };
        draw();
      },
      onMove: (e) => {
        const p = dotOf(side, i);
        const b = board.getBoundingClientRect();
        Object.entries({ x1: p.x, y1: p.y, x2: e.clientX - b.left, y2: e.clientY - b.top }).forEach(([k, val]) => temp.setAttribute(k, val));
        temp.style.display = 'block';
      },
      onDrop: (target) => {
        temp.style.display = 'none';
        const other = target?.closest?.('.lines-item');
        if (other && board.contains(other) && other.dataset.side !== side) {
          const j = Number(other.dataset.i);
          return side === 'a' ? connect(i, j) : connect(j, i);
        }
        sel = null;
        render();
      },
    });
    return btn;
  };

  const render = () => {
    btnsA.length = 0;
    btnsB.length = 0;
    mount(colA, left.map((txt, i) => { const b = item('a', i, txt); btnsA.push(b); return b; }));
    mount(colB, right.map((txt, i) => { const b = item('b', i, txt); btnsB.push(b); return b; }));
    requestAnimationFrame(draw);
  };
  render();
  if (window.ResizeObserver) new ResizeObserver(() => draw()).observe(board);
  return {
    el: h('div', { class: 'game' }, h('p', { class: 'game-counter' }, 'גררו קו מפריט לבן הזוג שלו (או לחצו על שניהם)'), board),
    answer: () => assign.map((ri) => right[ri]),
    ready: () => {
      const n = assign.filter((x) => x === null).length;
      return n ? `נשארו עוד ${n} קווים למתוח ✏️` : null;
    },
    wrong: (idx) => {
      wrongSet = new Set(idx);
      render();
      setTimeout(() => { idx.forEach((i) => { assign[i] = null; }); render(); }, 1200);
    },
    label: 'בדיקה ✓',
  };
}

// ---------- sort into groups ----------

function sort(t) {
  const { groups, items } = t.content;
  const place = items.map(() => null); // item index -> group index (null = still in the pile)
  let sel = null;
  let wrongSet = new Set();
  const wrap = h('div', { class: 'sort-game' });

  const moveTo = (i, gi) => {
    place[i] = gi;
    wrongSet.delete(i);
    sel = null;
    render();
  };
  const chip = (i) => {
    const btn = h('button', {
      class: `sort-item path-font${sel === i ? ' selected' : ''}${wrongSet.has(i) ? ' wrong' : ''}`,
      onclick: () => {
        if (wasDragged(btn)) return;
        sel = sel === i ? null : i;
        render();
      },
    }, items[i]);
    dragSource(btn, {
      ghost: true,
      onDrop: (target) => {
        const box = target?.closest?.('[data-group]');
        if (box && wrap.contains(box)) moveTo(i, box.dataset.group === 'pile' ? null : Number(box.dataset.group));
      },
    });
    return btn;
  };
  const boxClick = (gi) => () => { if (sel !== null) moveTo(sel, gi); };

  const render = () => {
    const pile = items.map((_, i) => i).filter((i) => place[i] === null);
    mount(wrap,
      h('div', { class: `sort-pile${pile.length ? '' : ' empty'}`, dataset: { group: 'pile' }, onclick: (e) => { if (e.target === e.currentTarget) boxClick(null)(); } },
        pile.length ? pile.map(chip) : h('span', { class: 'muted small' }, 'כל הפריטים מוינו 👏')),
      h('div', { class: 'sort-boxes', style: { '--cols': String(Math.min(groups.length, 2)) } }, groups.map((name, gi) => h('div', {
        class: `sort-box${sel !== null ? ' targetable' : ''}`, dataset: { group: String(gi) },
        style: { '--pair': PAIR_COLORS[gi % PAIR_COLORS.length] },
        onclick: (e) => { if (!e.target.closest('.sort-item')) boxClick(gi)(); },
      },
        h('button', { class: 'sort-box-title path-font', onclick: boxClick(gi), 'aria-label': `להכניס לקופסה: ${name}` }, name),
        h('div', { class: 'sort-box-items' }, items.map((_, i) => i).filter((i) => place[i] === gi).map(chip))))));
  };
  render();
  return {
    el: h('div', { class: 'game' }, h('p', { class: 'game-counter' }, 'גררו כל פריט לקופסה, או לחצו על פריט ואז על הקופסה'), wrap),
    answer: () => groups.map((_, gi) => items.filter((_, i) => place[i] === gi)),
    ready: () => {
      const n = place.filter((x) => x === null).length;
      return n ? `נשארו עוד ${n} פריטים למיין 🗂️` : null;
    },
    wrong: (words) => {
      wrongSet = new Set(items.map((x, i) => (words.includes(x) ? i : -1)).filter((i) => i >= 0));
      render();
      setTimeout(() => { wrongSet.forEach((i) => { place[i] = null; }); render(); }, 1300);
    },
    label: 'בדיקה ✓',
  };
}

// ---------- spoken answer ----------

function voice(t, ctx) {
  const max = t.content.maxSeconds || 60;
  let url = '';      // the saved recording
  let local = '';    // what plays back here
  let state = 'idle';
  let seconds = 0;
  let recorder = null;
  let timer = null;
  let typing = !(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  const area = h('textarea', { class: 'answer-input', rows: 4, maxlength: 5000, placeholder: 'כתבו כאן את התשובה…', 'aria-label': 'התשובה שלי' });
  const wrap = h('div', { class: 'voice-game' });

  async function start() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      typing = true;
      state = 'nomic';
      return render();
    }
    const chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop());
      clearInterval(timer);
      recorder = null;
      const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
      if (local) URL.revokeObjectURL(local);
      local = URL.createObjectURL(blob);
      state = 'saving';
      render();
      try {
        url = (await ctx.upload?.(blob)) || '(הקלטה בתצוגה מקדימה)';
        state = 'saved';
      } catch (err) {
        state = 'failed';
        wrap.dataset.error = err.message;
      }
      render();
    };
    recorder.start();
    seconds = 0;
    state = 'recording';
    timer = setInterval(() => {
      seconds++;
      if (!wrap.isConnected || seconds >= max) recorder?.stop();
      else { const st = wrap.querySelector('.voice-status'); if (st) st.textContent = statusText(); }
    }, 1000);
    render();
  }

  const clock = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  const statusText = () => (state === 'recording' ? `מקליטים… ${clock(seconds)} (עד ${clock(max)})`
    : state === 'saving' ? 'שומרים את ההקלטה…'
      : state === 'saved' ? 'ההקלטה נשמרה! אפשר להקשיב, או להקליט שוב.'
        : state === 'failed' ? `לא הצלחנו לשמור: ${wrap.dataset.error || ''}. נסו שוב.`
          : 'לחצו על המיקרופון ודברו');
  function render() {
    if (typing) {
      return mount(wrap,
        state === 'nomic' && h('p', { class: 'muted small' }, 'אין גישה למיקרופון, אז כותבים במקום 🙂'),
        area,
        navigator.mediaDevices?.getUserMedia && window.MediaRecorder && h('button', { class: 'btn ghost small', onclick: () => { typing = false; state = 'idle'; render(); } }, '🎤 בעצם, אני רוצה להקליט'));
    }
    mount(wrap,
      state === 'recording'
        ? h('button', { class: 'mic-btn recording', onclick: () => recorder?.stop(), 'aria-label': 'עצירת ההקלטה' }, '⏹')
        : h('button', { class: 'mic-btn', disabled: state === 'saving', onclick: start, 'aria-label': url ? 'הקלטה מחדש' : 'התחלת הקלטה' }, '🎤'),
      h('p', { class: 'voice-status', role: 'status' }, statusText()),
      local && state !== 'recording' && h('audio', { class: 'media-audio', src: local, controls: true }),
      state !== 'recording' && h('button', { class: 'btn ghost small', onclick: () => { typing = true; render(); } }, '⌨️ אני מעדיף לכתוב'));
  }
  render();
  return {
    el: h('div', { class: 'game' }, wrap),
    answer: () => (typing ? area.value : url),
    ready: () => {
      if (typing) return area.value.trim() ? null : 'כתבו תשובה קצרה לפני שמסיימים ✏️';
      if (state === 'recording') return 'קודם עוצרים את ההקלטה ⏹';
      if (state === 'saving') return 'רגע, שומרים את ההקלטה…';
      return url ? null : 'הקליטו תשובה 🎤';
    },
    label: 'שליחה ✓',
  };
}

// ---------- dictation ----------

const decodeSay = (code) => {
  const bin = atob(String(code).split('').reverse().join(''));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
};

function sayWord(word) {
  if (word.audio) {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    return new Audio(word.audio).play().catch(() => {});
  }
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const text = decodeSay(word.say);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = /[a-z]/i.test(text) && !/[\u0590-\u05FF]/.test(text) ? 'en-US' : 'he-IL'; // English words get an English voice
  u.rate = 0.75;
  speechSynthesis.speak(u);
}

function dictation(t) {
  const { words } = t.content;
  let wrongSet = new Set();
  const inputs = words.map((_, i) => h('input', {
    type: 'text', class: 'dict-input path-font', maxlength: 80, autocomplete: 'off', autocapitalize: 'off', spellcheck: false,
    'aria-label': `מילה ${i + 1}`,
    oninput: () => { wrongSet.delete(i); rows[i].classList.remove('wrong'); },
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); inputs[i + 1]?.focus(); if (inputs[i + 1]) sayWord(words[i + 1]); } },
  }));
  const rows = words.map((w, i) => h('li', { class: 'dict-row' },
    h('span', { class: 'order-num' }, i + 1),
    h('button', { class: 'icon-btn dict-play', 'aria-label': `השמעת מילה ${i + 1}`, onclick: () => { sayWord(w); inputs[i].focus(); } }, '🔊'),
    inputs[i]));
  return {
    el: h('div', { class: 'game' }, h('p', { class: 'game-counter' }, 'לחצו על 🔊, הקשיבו, וכתבו את המילה. אפשר לשמוע שוב ושוב.'), h('ol', { class: 'dict-list' }, rows)),
    answer: () => inputs.map((x) => x.value),
    ready: () => {
      const n = inputs.filter((x) => !x.value.trim()).length;
      return n ? `נשארו עוד ${n} מילים לכתוב ✍️` : null;
    },
    wrong: (idx) => {
      wrongSet = new Set(idx);
      rows.forEach((r, i) => r.classList.toggle('wrong', wrongSet.has(i)));
      inputs[idx[0]]?.focus();
      inputs[idx[0]]?.select();
    },
    label: 'בדיקה ✓',
  };
}

// ---------- flashcards ----------

function flashcards(t, ctx) {
  const { cards } = t.content;
  let queue = shuffle(cards.map((_, i) => i));
  let flipped = false;
  let again = 0;
  let finished = false;
  const known = new Set();
  const wrap = h('div', { class: 'flash-game' });

  const next = (knew) => {
    const i = queue.shift();
    if (knew) known.add(i);
    else { queue.push(i); again++; }
    flipped = false;
    if (!queue.length) {
      finished = true;
      render();
      return setTimeout(() => ctx.complete(), 900);
    }
    render();
  };

  function render() {
    if (finished) {
      return mount(wrap, h('div', { class: 'flash-done' }, h('span', { class: 'big-emoji' }, '🎉'), h('p', {}, 'עברתם על כל הכרטיסיות!')));
    }
    const c = cards[queue[0]];
    const card = h('button', {
      class: `flash-card${flipped ? ' flipped' : ''}`, 'aria-label': flipped ? `הצד השני: ${c.b}` : `${c.a}. לחצו כדי להפוך`,
      onclick: () => { flipped = !flipped; render(); wrap.querySelector('.flash-card')?.focus(); },
    },
      h('span', { class: 'flash-inner' },
        h('span', { class: 'flash-face front path-font' }, c.a),
        h('span', { class: 'flash-face back path-font' }, c.b)));
    mount(wrap,
      h('p', { class: 'game-counter' }, `ידעתי: ${known.size} מתוך ${cards.length}`),
      h('div', { class: 'mini-progress flash-progress' }, h('span', { style: { width: `${(known.size / cards.length) * 100}%` } })),
      card,
      flipped
        ? h('div', { class: 'flash-btns' },
          h('button', { class: 'btn big flash-yes', onclick: () => next(true) }, '✓ ידעתי'),
          h('button', { class: 'btn big ghost flash-again', onclick: () => next(false) }, '↺ עוד פעם'))
        : h('p', { class: 'muted small center' }, 'חשבו על התשובה, ואז לחצו על הכרטיס כדי להפוך אותו'));
  }
  render();
  return {
    el: h('div', { class: 'game' }, wrap),
    answer: () => again,
    ready: () => (finished ? null : `נשארו עוד ${queue.length} כרטיסיות 🎴`),
    label: 'סיימתי ✓',
  };
}

// ---------- photo of work on paper ----------

function photo(t, ctx) {
  let url = '';
  let shown = '';
  let state = 'idle';
  const wrap = h('div', { class: 'photo-game' });
  const pick = (capture) => h('input', {
    type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true, ...(capture ? { capture: 'environment' } : {}),
    onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      state = 'saving';
      render();
      try {
        const small = await shrinkImage(file);
        if (shown) URL.revokeObjectURL(shown);
        shown = URL.createObjectURL(small);
        url = (await ctx.upload?.(small)) || PREVIEW_FILE;
        state = 'saved';
      } catch (err) {
        state = 'failed';
        wrap.dataset.error = err.message;
      }
      render();
    },
  });
  const camera = pick(true);
  const gallery = pick(false);
  function render() {
    mount(wrap, camera, gallery,
      shown ? h('img', { class: 'photo-preview', src: shown, alt: 'הצילום שלי' }) : h('div', { class: 'photo-empty', 'aria-hidden': 'true' }, '📄'),
      h('p', { class: 'voice-status', role: 'status' },
        state === 'saving' ? 'שולחים את התמונה…'
          : state === 'saved' ? 'התמונה נשמרה! אפשר לצלם שוב אם משהו לא ברור.'
            : state === 'failed' ? `לא הצלחנו לשלוח: ${wrap.dataset.error || ''}`
              : 'כשסיימתם במחברת, צלמו את הדף'),
      h('div', { class: 'row wrap center-row' },
        h('button', { class: 'btn primary', disabled: state === 'saving', onclick: () => camera.click() }, url ? '📷 צילום מחדש' : '📷 צילום'),
        h('button', { class: 'btn ghost', disabled: state === 'saving', onclick: () => gallery.click() }, '🖼️ בחירת תמונה')));
  }
  render();
  return {
    el: h('div', { class: 'game' }, wrap),
    answer: () => url,
    ready: () => (state === 'saving' ? 'רגע, התמונה עוד נשלחת…' : url ? null : 'צלמו את העבודה לפני ששולחים 📷'),
    label: 'שליחה ✓',
  };
}

// ---------- drawing board ----------

const INKS = ['#24233a', '#e03131', '#1971c2', '#2f9e44', '#f08c00', '#ae3ec9'];

function draw(t, ctx) {
  const W = 900;
  const H = 640;
  const canvas = h('canvas', { class: 'draw-canvas', width: W, height: H, 'aria-label': 'לוח ציור' });
  const g = canvas.getContext('2d');
  g.lineCap = g.lineJoin = 'round';
  let color = INKS[0];
  let width = 6;
  let eraser = false;
  let drawing = false;
  let dirty = false;
  let empty = true;
  let url = '';
  const undo = [];
  const bg = t.content.image ? h('img', { class: 'draw-bg', src: t.content.image, alt: '', referrerpolicy: 'no-referrer' }) : null;

  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    canvas.setPointerCapture?.(e.pointerId);
    undo.push(g.getImageData(0, 0, W, H));
    if (undo.length > 20) undo.shift();
    g.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
    g.strokeStyle = color;
    g.lineWidth = eraser ? width * 4 : width;
    const [x, y] = at(e);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 0.01, y);
    g.stroke();
    dirty = true;
    empty = false;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const [x, y] = at(e);
    g.lineTo(x, y);
    g.stroke();
  });
  const stop = () => { drawing = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  const tools = h('div', { class: 'draw-tools' });
  const renderTools = () => mount(tools,
    INKS.map((c) => h('button', {
      class: `ink${!eraser && color === c ? ' on' : ''}`, style: { background: c }, 'aria-label': 'צבע', 'aria-pressed': String(!eraser && color === c),
      onclick: () => { color = c; eraser = false; renderTools(); },
    })),
    [[3, 'דק'], [6, 'בינוני'], [14, 'עבה']].map(([n, label]) => h('button', {
      class: `pen-size${width === n ? ' on' : ''}`, 'aria-label': label, 'aria-pressed': String(width === n),
      onclick: () => { width = n; renderTools(); },
    }, h('span', { style: { width: `${n + 4}px`, height: `${n + 4}px` } }))),
    h('button', { class: `icon-btn tool${eraser ? ' on' : ''}`, 'aria-label': 'מחק', title: 'מחק', onclick: () => { eraser = !eraser; renderTools(); } }, '🧽'),
    h('button', { class: 'icon-btn tool', 'aria-label': 'ביטול', title: 'ביטול', onclick: () => { const d = undo.pop(); if (d) { g.putImageData(d, 0, 0); dirty = true; } } }, '↩️'),
    h('button', { class: 'icon-btn tool', 'aria-label': 'ניקוי הלוח', title: 'ניקוי הלוח', onclick: () => { undo.push(g.getImageData(0, 0, W, H)); g.clearRect(0, 0, W, H); dirty = true; empty = true; } }, '🗑️'));
  renderTools();

  // The picture sent to the teacher: the background (when the browser allows it) and the drawing.
  async function exportPng() {
    const out = h('canvas', { width: W, height: H });
    const o = out.getContext('2d');
    o.fillStyle = '#fff';
    o.fillRect(0, 0, W, H);
    if (bg?.complete && bg.naturalWidth) {
      const scale = Math.min(W / bg.naturalWidth, H / bg.naturalHeight);
      const w = bg.naturalWidth * scale;
      const hh = bg.naturalHeight * scale;
      o.drawImage(bg, (W - w) / 2, (H - hh) / 2, w, hh);
    }
    o.drawImage(canvas, 0, 0);
    try {
      return await new Promise((r, j) => out.toBlob((b) => (b ? r(b) : j(new Error('blob'))), 'image/png'));
    } catch {
      return new Promise((r) => canvas.toBlob(r, 'image/png')); // a web picture blocked the export
    }
  }

  return {
    el: h('div', { class: 'game' }, tools, h('div', { class: 'draw-board' }, bg, canvas)),
    answer: () => url,
    ready: () => (empty && !url ? 'ציירו משהו לפני ששולחים 🎨' : null),
    // Called just before sending: saves the drawing if it changed.
    prepare: async () => {
      if (!dirty && url) return;
      url = (await ctx.upload?.(await exportPng())) || PREVIEW_FILE;
      dirty = false;
    },
    label: 'שליחה ✓',
  };
}

// ---------- tap the right places on a picture ----------

function hotspot(t) {
  const { count, image } = t.content;
  let points = [];
  let wrongSet = new Set();
  const board = h('div', { class: 'spot-board on-task' });
  const counter = h('p', { class: 'game-counter' });
  const render = () => {
    counter.textContent = `סמנו ${count} ${count === 1 ? 'מקום' : 'מקומות'} · סימנתם ${points.length}`;
    mount(board,
      h('img', { src: image, alt: '', draggable: 'false', referrerpolicy: 'no-referrer' }),
      points.map((p, i) => h('button', {
        class: `marker${wrongSet.has(i) ? ' wrong' : ''}`, style: { left: `${p.x}%`, top: `${p.y}%` },
        'aria-label': `הסרת סימון ${i + 1}`,
        onclick: (e) => { e.stopPropagation(); points.splice(i, 1); wrongSet = new Set(); render(); },
      }, '📍')));
  };
  board.addEventListener('click', (e) => {
    if (e.target.closest('.marker')) return;
    if (points.length >= count) return;
    const r = board.getBoundingClientRect();
    points.push({ x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10 });
    wrongSet = new Set();
    render();
  });
  render();
  return {
    el: h('div', { class: 'game' }, counter, board, h('p', { class: 'muted small center' }, 'לחצו על סימון כדי להסיר אותו')),
    answer: () => points,
    ready: () => (points.length < count ? `נשארו עוד ${count - points.length} מקומות לסמן 🎯` : null),
    wrong: (idx) => {
      wrongSet = new Set(idx);
      render();
      setTimeout(() => { points = points.filter((_, i) => !wrongSet.has(i)); wrongSet = new Set(); render(); }, 1300);
    },
    label: 'בדיקה ✓',
  };
}

// ---------- tap words in a text ----------

function highlight(t) {
  const { tokens, count } = t.content;
  const tight = new Set(t.content.tight || []);
  const picked = new Set();
  let wrongSet = new Set();
  const text = h('p', { class: 'hl-text path-font' });
  const counter = h('p', { class: 'game-counter' });
  const render = () => {
    counter.textContent = `סמנו ${count} מילים · סימנתם ${picked.size}`;
    const nodes = [];
    tokens.forEach((w, i) => {
      if (i && !tight.has(i)) nodes.push(' ');
      nodes.push(h('button', {
        class: `hl-word${tight.has(i) ? ' glued' : ''}${tight.has(i + 1) ? ' glued-next' : ''}${picked.has(i) ? ' on' : ''}${wrongSet.has(i) ? ' wrong' : ''}`, 'aria-pressed': String(picked.has(i)),
        onclick: () => { if (picked.has(i)) picked.delete(i); else picked.add(i); wrongSet = new Set(); render(); },
      }, w));
    });
    mount(text, nodes);
  };
  render();
  return {
    el: h('div', { class: 'game' }, counter, text),
    answer: () => [...picked].sort((a, b) => a - b),
    ready: () => (picked.size < count ? `צריך לסמן עוד ${count - picked.size} מילים 🖍️`
      : picked.size > count ? `סימנתם ${picked.size - count} מילים יותר מדי. לחצו על מילה כדי לבטל.` : null),
    wrong: (idx) => {
      wrongSet = new Set(idx);
      render();
      setTimeout(() => { idx.forEach((i) => picked.delete(i)); wrongSet = new Set(); render(); }, 1300);
    },
    label: 'בדיקה ✓',
  };
}

export const GAMES = { memory, wordsearch, matching, order, blanks, truefalse, lines, sort, voice, dictation, flashcards, photo, draw, hotspot, highlight };

// Text for the read-aloud button.
export function gameSpeech(t) {
  const c = t.content;
  switch (t.type) {
    case 'truefalse': return c.statements.join('. ');
    case 'order': return c.items.join('. ');
    case 'matching':
    case 'lines': return c.left.join('. ');
    case 'highlight': return c.tokens.join(' ');
    case 'sort': return `${c.groups.join(', ')}. ${c.items.join(', ')}`;
    case 'blanks': return c.segments.join(' ... ');
    case 'wordsearch': return c.words.join(', ');
    default: return '';
  }
}
