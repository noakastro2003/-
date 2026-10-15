import { h, toast, storage } from './ui.js';
import { NIKUD, stripNikud } from './themes.js';

const TEXT_FIELDS = 'input[type=text], textarea, input.title-input';
const DICTA_URL = 'https://nakdan.dicta.org.il/';

// A nikud keyboard for every text field inside `scope`: it works on whichever field was
// focused last and inserts the mark at the cursor (right after the letter typed before it).
export function nikudBar(scope) {
  let target = null;
  let open = storage('lp-nikud-open') === '1';

  const status = h('span', { class: 'nikud-status small muted' });
  const showStatus = () => {
    status.textContent = target ? 'מנקדים את השדה המסומן · הקלידו אות ואז בחרו ניקוד' : 'לחצו על שדה טקסט, הקלידו אות ובחרו ניקוד';
  };

  const setTarget = (el) => {
    target?.classList.remove('nikud-target');
    target = el;
    target?.classList.add('nikud-target');
    showStatus();
  };

  const ensureTarget = () => {
    if (target?.isConnected) return true;
    toast('קודם לחצו על שדה הטקסט שרוצים לנקד', 'error');
    return false;
  };

  const changed = () => {
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.focus();
  };

  const insert = (text) => {
    if (!ensureTarget()) return;
    const { selectionStart: start, selectionEnd: end } = target;
    target.setRangeText(text, start ?? target.value.length, end ?? target.value.length, 'end');
    changed();
  };

  const keepFocus = (e) => e.preventDefault();
  const keys = NIKUD.map((n) => {
    const base = n.insert === 'ׁ' || n.insert === 'ׂ' ? 'ש' : 'ב';
    return h('button', {
      type: 'button', class: 'nikud-key', title: n.name, 'aria-label': n.name, onmousedown: keepFocus,
      onclick: () => insert(n.insert),
    }, h('span', { class: 'nikud-glyph' }, n.letter ? n.insert : base + n.insert), h('span', { class: 'nikud-name' }, n.name));
  });

  const tools = h('div', { class: 'nikud-tools' },
    h('button', {
      type: 'button', class: 'btn small ghost', onmousedown: keepFocus,
      onclick: () => {
        if (!ensureTarget()) return;
        target.value = stripNikud(target.value);
        changed();
      },
    }, '🧽 הסרת ניקוד מהשדה'),
    h('button', {
      type: 'button', class: 'btn small secondary', onmousedown: keepFocus,
      title: 'מעתיק את הטקסט ופותח את המנקד האוטומטי של דיקטה',
      onclick: async () => {
        if (target?.isConnected && target.value.trim()) {
          await navigator.clipboard?.writeText(stripNikud(target.value)).catch(() => {});
          toast('הטקסט הועתק – הדביקו אותו בדיקטה, ואז העתיקו את הטקסט המנוקד בחזרה לשדה', 'ok');
        }
        window.open(DICTA_URL, '_blank', 'noopener');
      },
    }, '✨ ניקוד אוטומטי (דיקטה)'));

  const panel = h('div', { class: 'nikud-panel', hidden: !open },
    status, h('div', { class: 'nikud-keys' }, keys), tools);
  const toggle = h('button', {
    type: 'button', class: 'btn small nikud-toggle', 'aria-expanded': String(open), onmousedown: keepFocus,
    onclick: () => {
      open = !open;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      storage('lp-nikud-open', open ? '1' : '0');
    },
  }, 'אָ ניקוד');

  scope.addEventListener('focusin', (e) => {
    if (e.target.matches?.(TEXT_FIELDS) && !bar.contains(e.target)) setTarget(e.target);
  });
  showStatus();
  const bar = h('div', { class: 'nikud-bar' }, toggle, panel);
  return bar;
}
