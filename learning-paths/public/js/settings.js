// The teacher's account settings: name, a promo code, password.
import { api } from './api.js';
import { h, mount, toast, field, busy } from './ui.js';
import { go, session } from './app.js';
import { setCredits, creditWord } from './credits.js';
import { DEMO } from './env.js';

export async function settingsPage(app, topbar) {
  let billing = null;
  try {
    billing = await api('GET', '/api/billing');
  } catch (err) {
    if (err.status === 401) return go('#/login');
  }
  const t = session.teacher;

  // --- promo code ---
  const code = h('input', {
    type: 'text', dir: 'ltr', maxlength: 30, autocapitalize: 'characters', autocomplete: 'off',
    placeholder: 'למשל WELCOME2026', 'aria-label': 'קוד הטבה',
  });
  const codeBtn = h('button', { class: 'btn primary', type: 'submit' }, 'הפעלת הקוד');
  const codeStatus = h('div', { class: 'settings-status' });
  const drawStatus = (b) => {
    if (!b) return mount(codeStatus);
    const sub = b.subscription;
    const subscribed = sub.status === 'active' || sub.status === 'canceled';
    mount(codeStatus,
      h('p', {}, `יש לך עכשיו ${creditWord(b.available)}.`),
      subscribed && h('p', {}, `מנוי פעיל עד ${new Date(sub.periodEnd).toLocaleDateString('he-IL')}.`),
      b.discount && h('p', {}, `🎁 ${b.discount.percent}% הנחה על התשלום הראשון במנוי (קוד ${b.discount.code}).`));
  };
  drawStatus(billing);
  const promoForm = h('form', {
    class: 'row wrap promo-form',
    onsubmit: (e) => {
      e.preventDefault();
      if (DEMO) return toast('בגרסת ההדגמה אין קודי הטבה. הם יעבדו באתר עצמו.', 'info');
      busy(codeBtn, api('POST', '/api/billing/redeem', { code: code.value }).then((b) => {
        setCredits(b.available);
        toast(b.message, 'ok');
        code.value = '';
        drawStatus(b);
      }).catch((err) => toast(err.message, 'error')));
    },
  }, code, codeBtn);

  // --- name ---
  const name = h('input', { type: 'text', required: true, maxlength: 80, value: t?.name || '' });
  const nameBtn = h('button', { class: 'btn secondary', type: 'submit' }, 'שמירה');
  const nameForm = h('form', {
    class: 'row wrap',
    onsubmit: (e) => {
      e.preventDefault();
      busy(nameBtn, api('PUT', '/api/auth/me', { name: name.value }).then((r) => {
        session.teacher = { ...session.teacher, name: r.teacher.name };
        toast('השם נשמר', 'ok');
      }).catch((err) => toast(err.message, 'error')));
    },
  }, name, nameBtn);

  // --- password ---
  const current = h('input', { type: 'password', required: true, autocomplete: 'current-password', dir: 'ltr' });
  const next = h('input', { type: 'password', required: true, minlength: 8, autocomplete: 'new-password', dir: 'ltr' });
  const pwBtn = h('button', { class: 'btn secondary', type: 'submit' }, 'החלפת סיסמה');
  const pwForm = h('form', {
    class: 'stack',
    onsubmit: (e) => {
      e.preventDefault();
      busy(pwBtn, api('POST', '/api/auth/password', { current: current.value, password: next.value }).then(() => {
        current.value = '';
        next.value = '';
        toast('הסיסמה הוחלפה. במכשירים אחרים צריך להתחבר מחדש.', 'ok');
      }).catch((err) => toast(err.message, 'error')));
    },
  }, field('הסיסמה הנוכחית', current), field('סיסמה חדשה', next, 'לפחות 8 תווים'), h('div', {}, pwBtn));

  mount(app, topbar(), h('main', { class: 'page narrow-page' },
    h('a', { class: 'back-link', href: '#/dashboard' }, '→ כל המסלולים'),
    h('h1', {}, '⚙️ הגדרות'),
    h('section', { class: 'card', id: 'promo' },
      h('h2', {}, '🎁 קוד הטבה'),
      h('p', { class: 'muted' }, 'קיבלת קוד? כאן מפעילים אותו: חודשי מנוי חינם, קרדיטים נוספים או הנחה.'),
      promoForm,
      codeStatus),
    !DEMO && h('section', { class: 'card' },
      h('h2', {}, 'הפרטים שלי'),
      h('p', { class: 'muted small' }, `אימייל: ${t?.email || ''}`),
      field('שם', nameForm)),
    !DEMO && h('section', { class: 'card' }, h('h2', {}, 'סיסמה'), pwForm),
    h('section', { class: 'card' },
      h('h2', {}, 'קרדיטים ומנוי'),
      h('a', { class: 'btn ghost', href: '#/billing' }, 'לדף הקרדיטים והמנוי ←'))));
  code.focus();
}
