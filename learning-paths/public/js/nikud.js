import { h, toast, storage, copyText } from './ui.js';
import { NIKUD, stripNikud } from './themes.js';
import { api } from './api.js';
import { cost, creditWord, setCredits, showError } from './credits.js';

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

  // Whole-field nikud: Dicta's Nakdan (free) or Claude (costs a credit). The result replaces
  // the field's text in place, and the teacher can undo it.
  const autoNikud = (btn, label, endpoint, onFail) => async () => {
    if (!ensureTarget()) return;
    const field = target;
    const before = field.value;
    if (!before.trim()) return toast('השדה ריק', 'error');
    btn.disabled = true;
    btn.textContent = 'מנקד…';
    try {
      const r = await api('POST', endpoint, { text: before });
      if (r.credits !== undefined) setCredits(r.credits);
      setField(field, r.text);
      undoBtn.hidden = false;
      undoBtn.onclick = () => { setField(field, before); undoBtn.hidden = true; };
      toast(r.changed ? 'נוקד – שימו לב: נראה שמילה השתנתה, כדאי לבדוק' : 'נוקד ✓', r.changed ? 'info' : 'ok');
    } catch (err) {
      onFail(err, field);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  };
  const setField = (field, value) => {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const dictaBtn = h('button', { type: 'button', class: 'btn small primary', onmousedown: keepFocus, title: 'הנקדן של דיקטה – חינם' }, '✨ ניקוד אוטומטי');
  dictaBtn.onclick = autoNikud(dictaBtn, '✨ ניקוד אוטומטי', '/api/nikud/dicta', (err, field) => {
    // Where the app can't reach Dicta itself (the demo), the teacher can still use Dicta's site.
    if (err.status === 503 || err.status === 404) {
      copyText(stripNikud(field.value), 'אין כאן חיבור ישיר לדיקטה. הטקסט הועתק – פתחו את "אתר דיקטה", הדביקו, והעתיקו את התוצאה בחזרה.');
    } else showError(err);
  });

  const aiBtn = h('button', {
    type: 'button', class: 'btn small ghost', onmousedown: keepFocus,
    title: cost('aiNikud') ? `ניקוד עם Claude – עולה ${creditWord(cost('aiNikud'))}` : 'ניקוד עם Claude',
  }, '🤖 ניקוד עם AI');
  aiBtn.onclick = autoNikud(aiBtn, '🤖 ניקוד עם AI', '/api/ai/nikud', (err) => {
    if (err.status === 503) toast('הניקוד עם AI לא הופעל בשרת. אפשר להשתמש בניקוד האוטומטי של דיקטה.', 'error');
    else showError(err);
  });
  const undoBtn = h('button', { type: 'button', class: 'btn small ghost', hidden: true, onmousedown: keepFocus }, '↩ ביטול הניקוד');

  const tools = h('div', { class: 'nikud-tools' },
    dictaBtn, aiBtn, undoBtn,
    h('button', {
      type: 'button', class: 'btn small ghost', onmousedown: keepFocus,
      onclick: () => {
        if (!ensureTarget()) return;
        target.value = stripNikud(target.value);
        changed();
      },
    }, '🧽 הסרת ניקוד מהשדה'),
    // A real link (not window.open) so it also works where pop-ups are blocked.
    h('a', {
      class: 'btn small ghost', href: DICTA_URL, target: '_blank', rel: 'noopener noreferrer', onmousedown: keepFocus,
      title: 'מעתיק את הטקסט ופותח את המנקד האוטומטי של דיקטה',
      onclick: () => {
        if (!target?.isConnected || !target.value.trim()) return;
        copyText(stripNikud(target.value), 'הטקסט הועתק – הדביקו אותו בדיקטה, ואז העתיקו את הטקסט המנוקד בחזרה לשדה');
      },
    }, '↗ אתר דיקטה'));

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
