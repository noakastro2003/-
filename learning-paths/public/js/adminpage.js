// The site owner's page: promo codes (free months, credits, discounts).
import { api } from './api.js';
import { h, mount, toast, field, busy, formatDate } from './ui.js';
import { go, session } from './app.js';

const KIND_TEXT = {
  free_months: (n) => (n === 1 ? 'חודש מנוי חינם' : `${n} חודשי מנוי חינם`),
  credits: (n) => `${n} קרדיטים`,
  discount: (n) => `${n}% הנחה על התשלום הראשון`,
};
const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

export async function adminPage(app, topbar) {
  if (!session.teacher?.isAdmin) return go('#/dashboard');
  mount(app, topbar(), h('main', { class: 'page narrow-page' }, h('p', { class: 'muted' }, 'טוען…')));
  let data;
  try {
    data = await api('GET', '/api/admin/promo');
  } catch (err) {
    return mount(app, topbar(), h('main', { class: 'page' }, h('p', { class: 'error' }, err.message)));
  }
  const list = h('div');
  const drawList = () => mount(list, data.codes.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'promo-table' },
    h('thead', {}, h('tr', {}, ['קוד', 'הטבה', 'שימושים', 'תוקף', 'הערה', ''].map((x) => h('th', {}, x)))),
    h('tbody', {}, data.codes.map((c) => h('tr', { class: c.active ? '' : 'off' },
      h('td', { dir: 'ltr' }, h('code', {}, c.code), ' ',
        h('button', { class: 'icon-btn', title: 'העתקת קישור הרשמה עם הקוד', 'aria-label': `העתקת קישור עם ${c.code}`, onclick: () => copyLink(c.code) }, '🔗')),
      h('td', {}, KIND_TEXT[c.kind](c.amount)),
      h('td', {}, c.maxUses ? `${c.uses} / ${c.maxUses}` : `${c.uses} (ללא הגבלה)`),
      h('td', { class: 'small' }, c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('he-IL') : 'ללא'),
      h('td', { class: 'small muted' }, c.note),
      h('td', {}, h('button', {
        class: `btn small ${c.active ? 'ghost' : 'secondary'}`,
        onclick: (e) => busy(e.currentTarget, api('PUT', `/api/admin/promo/${encodeURIComponent(c.code)}`, { active: !c.active })
          .then((r) => { Object.assign(c, r.code); drawList(); toast(c.active ? 'הקוד הופעל' : 'הקוד הושבת', 'ok'); })
          .catch((err) => toast(err.message, 'error'))),
      }, c.active ? 'השבתה' : 'הפעלה'))))))) : h('p', { class: 'muted' }, 'עוד אין קודים.'));

  const copyLink = (code) => {
    const link = `${location.origin}/#/register?code=${encodeURIComponent(code)}`;
    navigator.clipboard?.writeText(link).then(() => toast('קישור ההרשמה הועתק. מי שנרשם דרכו מקבל את ההטבה.', 'ok'))
      .catch(() => toast(link, 'info'));
  };

  const code = h('input', { type: 'text', dir: 'ltr', required: true, maxlength: 24, value: randomCode() });
  const kind = h('select', {}, Object.entries(data.kinds).map(([k, x]) => h('option', { value: k }, x.label)));
  const amount = h('input', { type: 'number', required: true, min: 1, value: 1 });
  const unit = h('span', { class: 'muted small' });
  const maxUses = h('input', { type: 'number', min: 1, placeholder: 'ללא הגבלה' });
  const expires = h('input', { type: 'date' });
  const note = h('input', { type: 'text', maxlength: 200, placeholder: 'למשל: לכנס מורות, למורות בית ספר X' });
  const syncUnit = () => {
    const k = data.kinds[kind.value];
    unit.textContent = k.unit;
    amount.min = k.min;
    amount.max = k.max;
    if (Number(amount.value) > k.max) amount.value = k.max;
  };
  kind.addEventListener('change', syncUnit);
  syncUnit();
  const submit = h('button', { class: 'btn primary', type: 'submit' }, 'יצירת הקוד');
  const form = h('form', {
    class: 'card stack',
    onsubmit: (e) => {
      e.preventDefault();
      const body = {
        code: code.value, kind: kind.value, amount: Number(amount.value), maxUses: maxUses.value,
        expiresAt: expires.value ? new Date(`${expires.value}T23:59:59`).getTime() : '', note: note.value,
      };
      busy(submit, api('POST', '/api/admin/promo', body).then((r) => {
        data.codes.unshift(r.code);
        drawList();
        toast(`הקוד ${r.code.code} נוצר`, 'ok');
        code.value = randomCode();
        note.value = '';
      }).catch((err) => toast(err.message, 'error')));
    },
  },
    h('h2', {}, 'קוד חדש'),
    h('div', { class: 'row wrap' },
      field('הקוד', h('div', { class: 'row' }, code, h('button', { type: 'button', class: 'btn small ghost', onclick: () => { code.value = randomCode(); } }, '🎲'))),
      field('סוג ההטבה', kind),
      field('כמה', h('div', { class: 'row' }, amount, unit))),
    h('div', { class: 'row wrap' },
      field('מספר שימושים מקסימלי', maxUses, 'כל מורה יכולה להשתמש בקוד פעם אחת'),
      field('בתוקף עד (לא חובה)', expires)),
    field('הערה לעצמך (לא חובה)', note),
    h('div', { class: 'row end' }, submit));

  mount(app, topbar(), h('main', { class: 'page narrow-page' },
    h('a', { class: 'back-link', href: '#/dashboard' }, '→ כל המסלולים'),
    h('h1', {}, '🛠️ ניהול האתר: קודי הטבה'),
    h('p', { class: 'muted' }, 'מורות מזינות את הקוד בהרשמה או בדף "הקרדיטים שלי". אפשר גם לשלוח קישור הרשמה שהקוד כבר בתוכו (🔗).'),
    form,
    h('section', { class: 'card' }, h('h2', {}, 'הקודים'), list)));
  drawList();
}
