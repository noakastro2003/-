// The teacher's credits and subscription page.
import { api } from './api.js';
import { h, mount, toast, confirmDialog, busy, formatDate } from './ui.js';
import { go } from './app.js';
import { creditWord, setCredits } from './credits.js';

const dateLabel = (iso) => new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

export async function billingPage(app, topbar) {
  mount(app, topbar(), h('main', { class: 'page narrow-page' }, h('p', { class: 'muted' }, 'טוען…')));
  let b;
  try {
    b = await api('GET', '/api/billing');
  } catch (err) {
    if (err.status === 401) return go('#/login');
    return mount(app, topbar(), h('main', { class: 'page' }, h('p', { class: 'error' }, err.message)));
  }
  setCredits(b.available);
  render(app, topbar, b);
}

function render(app, topbar, b) {
  const sub = b.subscription;
  const active = sub.status === 'active';
  const canceled = sub.status === 'canceled';
  const subscribed = active || canceled;

  const subscribe = async (btn) => {
    try {
      const next = await busy(btn, api('POST', '/api/billing/checkout'));
      setCredits(next.available);
      toast(`המנוי הופעל – נוספו ${creditWord(next.plan.monthlyCredits)} 🎉`, 'ok');
      render(app, topbar, next);
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const cancel = async (btn) => {
    if (!(await confirmDialog(`לבטל את חידוש המנוי? הקרדיטים של החודש הנוכחי יישארו זמינים עד ${dateLabel(sub.periodEnd)}.`, { okText: 'ביטול החידוש', danger: true }))) return;
    try {
      render(app, topbar, await busy(btn, api('POST', '/api/billing/cancel')));
      toast('החידוש בוטל', 'ok');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const subscribeBtn = h('button', { class: 'btn primary big', onclick: (e) => subscribe(e.currentTarget) },
    canceled ? 'חידוש המנוי' : 'הצטרפות למנוי');

  mount(app, topbar(), h('main', { class: 'page narrow-page' },
    h('a', { class: 'back-link', href: '#/dashboard' }, '→ כל המסלולים'),
    h('h1', {}, 'הקרדיטים שלי'),

    h('section', { class: 'card balance' },
      h('div', { class: 'balance-main' },
        h('span', { class: 'balance-number' }, b.available),
        h('span', { class: 'balance-label' }, 'קרדיטים זמינים')),
      h('dl', { class: 'balance-split' },
        h('div', {}, h('dt', {}, 'קרדיטים קבועים'), h('dd', {}, b.credits), h('span', { class: 'muted small' }, 'לא פגים')),
        subscribed && h('div', {}, h('dt', {}, 'מהמנוי החודש'), h('dd', {}, sub.creditsLeft),
          h('span', { class: 'muted small' }, `עד ${dateLabel(sub.periodEnd)}`)))),

    h('section', { class: 'card' },
      h('h2', {}, 'כמה זה עולה'),
      h('table', { class: 'cost-table' },
        h('tbody', {},
          h('tr', {}, h('td', {}, '📄 מסלול חדש (בנייה עצמאית, ממסלול לדוגמה או שכפול)'), h('td', {}, creditWord(b.costs.createPath))),
          h('tr', {}, h('td', {}, '✨ מסלול מהמחולל'), h('td', {}, creditWord(b.costs.aiGenerate))),
          h('tr', {}, h('td', {}, '✏️ עריכת מסלולים, תלמידים ומעקב התקדמות'), h('td', {}, 'חינם'))))),

    h('section', { class: `card plan${subscribed ? ' plan-on' : ''}` },
      h('div', { class: 'plan-head' },
        h('div', {},
          h('h2', {}, 'מנוי חודשי'),
          h('p', { class: 'plan-price' }, b.plan.priceLabel)),
        subscribed && h('span', { class: `chip ${active ? 'chip-ok' : 'chip-warn'}` }, active ? 'פעיל' : 'החידוש בוטל')),
      h('ul', { class: 'plan-features' },
        h('li', {}, `${creditWord(b.plan.monthlyCredits)} חדשים כל חודש`),
        h('li', {}, `למשל ${Math.floor(b.plan.monthlyCredits / Math.max(1, b.costs.aiGenerate))} מסלולים מהמחולל, או ${Math.floor(b.plan.monthlyCredits / Math.max(1, b.costs.createPath))} מסלולים שבונים לבד`),
        h('li', {}, 'הקרדיטים הקבועים שלך נשמרים ומשמשים אחרי קרדיטי המנוי'),
        h('li', {}, 'אפשר לבטל בכל רגע')),
      active && h('p', {}, `המנוי מתחדש ב-${dateLabel(sub.periodEnd)}.`),
      canceled && h('p', {}, `המנוי לא יתחדש. הקרדיטים של החודש זמינים עד ${dateLabel(sub.periodEnd)}.`),
      sub.status === 'expired' && h('p', { class: 'muted' }, 'המנוי הקודם הסתיים.'),
      h('div', { class: 'row wrap' },
        !active && (b.paymentsMode === 'test' ? subscribeBtn : h('p', { class: 'notice warn' }, 'התשלום המקוון עוד לא הופעל. כדי להצטרף למנוי, פני למנהל/ת המערכת.')),
        active && h('button', { class: 'btn ghost', onclick: (e) => cancel(e.currentTarget) }, 'ביטול חידוש המנוי')),
      b.paymentsMode === 'test' && !active && h('p', { class: 'muted small' }, '🧪 מצב בדיקה: ההצטרפות מפעילה מנוי בלי לחייב כרטיס אשראי.')),

    b.history.length > 0 && h('section', { class: 'card' },
      h('h2', {}, 'היסטוריית שימוש'),
      h('ul', { class: 'ledger' }, b.history.map((x) => h('li', {},
        h('span', { class: 'ledger-what' }, x.label, x.note && h('span', { class: 'muted' }, ` · ${x.note}`)),
        h('span', { class: 'muted small' }, formatDate(x.at)),
        h('span', { class: `ledger-delta ${x.delta > 0 ? 'plus' : x.delta < 0 ? 'minus' : ''}`, dir: 'ltr' },
          x.delta > 0 ? `+${x.delta}` : x.delta || '—')))))));
}
