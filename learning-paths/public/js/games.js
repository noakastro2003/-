// Interactive task types for students. Each renderer returns:
//   el       – the game's DOM
//   answer() – what to send to the server
//   ready()  – null when the answer can be submitted, else a short hint to show
//   wrong(i) – optional: mark the items the server said are wrong
//   label    – optional text for the finish button
// and calls ctx.complete() itself when a game finishes on its own (memory, word search).
import { h, mount } from './ui.js';
import { stripNikud } from './themes.js';

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

export const GAMES = { memory, wordsearch, matching, order, blanks, truefalse };

// Text for the read-aloud button.
export function gameSpeech(t) {
  const c = t.content;
  switch (t.type) {
    case 'truefalse': return c.statements.join('. ');
    case 'order': return c.items.join('. ');
    case 'matching': return c.left.join('. ');
    case 'blanks': return c.segments.join(' ... ');
    case 'wordsearch': return c.words.join(', ');
    default: return '';
  }
}
