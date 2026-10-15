// DOM helpers. Every string child becomes a text node, so user content is never parsed as HTML.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, val] of Object.entries(attrs || {})) {
    if (val == null || val === false) continue;
    if (k.startsWith('on') && typeof val === 'function') el.addEventListener(k.slice(2), val);
    else if (k === 'class') el.className = val;
    else if (k === 'value') el.value = val;
    else if (k === 'style' && typeof val === 'object') {
      for (const [prop, v] of Object.entries(val)) {
        if (prop.startsWith('--')) el.style.setProperty(prop, v);
        else el.style[prop] = v;
      }
    }
    else if (k === 'dataset') Object.assign(el.dataset, val);
    else if (k in el && typeof val !== 'string') el[k] = val;
    else el.setAttribute(k, val === true ? '' : val);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function mount(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

export function toast(message, kind = 'info') {
  const box = document.getElementById('toasts');
  const t = h('div', { class: `toast toast-${kind}` }, message);
  box.append(t);
  setTimeout(() => t.classList.add('out'), 2800);
  setTimeout(() => t.remove(), 3300);
}

// Modal dialog. content: node or array; returns { close, el }.
export function modal(title, content, { wide = false, onClose } = {}) {
  const prevFocus = document.activeElement;
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    prevFocus?.focus?.();
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const dialog = h('div', { class: `modal${wide ? ' modal-wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'modal-head' },
      h('h2', {}, title),
      h('button', { class: 'icon-btn', 'aria-label': 'סגירה', onclick: close }, '✕')),
    h('div', { class: 'modal-body' }, content));
  const overlay = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) close(); } }, dialog);
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  setTimeout(() => dialog.querySelector('input, textarea, select, button:not(.icon-btn)')?.focus(), 0);
  return { close, el: dialog };
}

export function confirmDialog(message, { okText = 'אישור', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const m = modal('רגע לפני…', [
      h('p', {}, message),
      h('div', { class: 'row end' },
        h('button', { class: 'btn ghost', onclick: () => m.close() }, 'ביטול'),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => { answered = true; m.close(); } }, okText)),
    ], { onClose: () => resolve(answered) });
  });
}

export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint && h('span', { class: 'hint' }, hint));
}

export function busy(button, promise) {
  button.disabled = true;
  return promise.finally(() => { button.disabled = false; });
}

export function formatDate(sqlDate) {
  if (!sqlDate) return '';
  const d = new Date(sqlDate.replace(' ', 'T') + 'Z');
  return d.toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.flush = (...args) => { clearTimeout(t); fn(...args); };
  return wrapped;
}

export function storage(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* storage unavailable */ }
  return null;
}
