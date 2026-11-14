// Classes on the teacher's side: one code and one roster for several paths.
import { api } from './api.js';
import { h, mount, toast, modal, confirmDialog, field, busy, formatDate } from './ui.js';
import { go } from './app.js';

export async function classesSection(el) {
  let classes;
  try {
    classes = (await api('GET', '/api/classes')).classes;
  } catch (err) {
    return mount(el, h('p', { class: 'error' }, err.message));
  }
  mount(el,
    h('div', { class: 'page-head' },
      h('h2', {}, 'הכיתות שלי'),
      h('button', { class: 'btn', onclick: newClassDialog }, '+ כיתה חדשה')),
    classes.length
      ? h('div', { class: 'class-grid' }, classes.map((c) => h('a', { class: 'class-card', href: `#/class/${c.id}` },
        h('span', { class: 'class-card-icon', 'aria-hidden': 'true' }, '🏫'),
        h('span', {}, h('strong', {}, c.name),
          h('span', { class: 'muted small block' }, `${c.memberCount} תלמידים · ${c.pathCount} מסלולים · קוד ${c.code}`)))))
      : h('p', { class: 'muted' }, 'כיתה נותנת לתלמידים קוד אחד וכניסה אחת לכל המסלולים שתבחרו, ולכם רשימת תלמידים קבועה עם ההתקדמות של כל אחד.'));
}

function newClassDialog() {
  const name = h('input', { type: 'text', required: true, maxlength: 80, placeholder: 'למשל: ג׳2, קבוצת קריאה, שעת שילוב' });
  const submit = h('button', { class: 'btn primary', type: 'submit' }, 'יצירה');
  const m = modal('כיתה חדשה', h('form', {
    onsubmit: (e) => {
      e.preventDefault();
      busy(submit, api('POST', '/api/classes', { name: name.value })
        .then((r) => { m.close(); go(`#/class/${r.class.id}`); })
        .catch((err) => toast(err.message, 'error')));
    },
  }, field('שם הכיתה', name), h('div', { class: 'row end' }, submit)));
}

export async function classAdminPage(app, id, topbar) {
  mount(app, topbar(), h('main', { class: 'page' }, h('p', { class: 'muted' }, 'טוען…')));
  let data;
  let paths;
  try {
    [data, { paths }] = await Promise.all([api('GET', `/api/classes/${id}`), api('GET', '/api/paths')]);
  } catch (err) {
    if (err.status === 401) return go('#/login');
    return mount(app, topbar(), h('main', { class: 'page' }, h('p', { class: 'error' }, err.message),
      h('a', { class: 'btn', href: '#/dashboard' }, 'חזרה')));
  }
  const reload = () => classAdminPage(app, id, topbar);
  const c = data.class;
  const assigned = data.pathIds.map((pid) => paths.find((p) => p.id === pid)).filter(Boolean);

  const nameInput = h('input', {
    class: 'title-input', value: c.name, maxlength: 80, 'aria-label': 'שם הכיתה',
    onchange: () => api('PUT', `/api/classes/${c.id}`, { name: nameInput.value }).then(() => toast('נשמר', 'ok')).catch((err) => toast(err.message, 'error')),
  });

  const setPaths = (ids) => api('PUT', `/api/classes/${c.id}`, { pathIds: ids }).then(reload).catch((err) => toast(err.message, 'error'));
  const pathPicker = h('ul', { class: 'class-path-picker' }, paths.map((p) => {
    const on = data.pathIds.includes(p.id);
    return h('li', {}, h('label', { class: 'toggle' },
      h('input', {
        type: 'checkbox', checked: on,
        onchange: (e) => setPaths(e.target.checked ? [...data.pathIds, p.id] : data.pathIds.filter((x) => x !== p.id)),
      }),
      h('span', { class: 'toggle-ui', 'aria-hidden': 'true' }),
      h('span', {}, `${p.theme.icon} ${p.title}`, !p.published && h('span', { class: 'chip', style: { marginInlineStart: '.4rem' } }, 'טיוטה – התלמידים לא יראו'))));
  }));

  const copy = () => navigator.clipboard?.writeText(c.code).then(() => toast('הקוד הועתק', 'ok')).catch(() => {});
  const roster = data.members.length
    ? h('div', { class: 'table-wrap' }, h('table', { class: 'progress-table' },
      h('thead', {}, h('tr', {},
        h('th', { class: 'sticky' }, 'תלמידים'),
        assigned.map((p) => h('th', { title: p.title }, `${p.theme.icon} ${p.title}`)),
        h('th', {}, 'פעילות אחרונה'), h('th', {}, ''))),
      h('tbody', {}, data.members.map((m) => h('tr', {},
        h('th', { class: 'sticky', scope: 'row' }, m.avatar && h('span', { class: 'row-avatar', 'aria-hidden': 'true' }, m.avatar), m.name),
        assigned.map((p) => {
          const total = data.taskCounts[p.id] || 0;
          const done = m.done[p.id] || 0;
          const pct = total ? Math.round((done / total) * 100) : 0;
          return h('td', {},
            h('a', { href: `#/path/${p.id}/progress`, class: 'class-cell', title: 'להתקדמות במסלול' },
              h('span', { class: 'mini-progress' }, h('span', { style: { width: `${pct}%` } })),
              h('span', { class: 'small muted' }, `${done}/${total}`)));
        }),
        h('td', { class: 'small muted' }, formatDate(m.lastActive)),
        h('td', { class: 'row-actions' },
          h('button', {
            class: 'icon-btn', title: 'איפוס הסיסמה הסודית', 'aria-label': `איפוס הסיסמה של ${m.name}`, disabled: !m.hasSecret,
            onclick: async () => {
              if (!(await confirmDialog(`לאפס את הסיסמה הסודית של ${m.name}? בכניסה הבאה תיבחר סיסמה חדשה.`, { okText: 'איפוס' }))) return;
              api('POST', `/api/class-members/${m.id}/reset-secret`).then(() => { toast('הסיסמה אופסה', 'ok'); reload(); }).catch((err) => toast(err.message, 'error'));
            },
          }, '🔑'),
          h('button', {
            class: 'icon-btn', title: 'הסרה מהכיתה', 'aria-label': `הסרת ${m.name}`,
            onclick: async () => {
              if (!(await confirmDialog(`להסיר את ${m.name} מהכיתה? ההתקדמות במסלולים נשמרת.`, { okText: 'הסרה', danger: true }))) return;
              api('DELETE', `/api/class-members/${m.id}`).then(reload).catch((err) => toast(err.message, 'error'));
            },
          }, '🗑️')))))))
    : h('div', { class: 'empty card' }, h('div', { class: 'empty-icon', 'aria-hidden': 'true' }, '👋'),
      h('p', {}, 'עוד אין תלמידים בכיתה. הם מצטרפים בעצמם עם קוד הכיתה.'));

  mount(app, topbar(), h('main', { class: 'page' },
    h('a', { class: 'back-link', href: '#/dashboard' }, '→ חזרה'),
    h('div', { class: 'editor-head' },
      h('span', { class: 'editor-icon', 'aria-hidden': 'true' }, '🏫'), nameInput,
      h('button', {
        class: 'icon-btn', title: 'מחיקת הכיתה', 'aria-label': 'מחיקת הכיתה',
        onclick: async () => {
          if (!(await confirmDialog(`למחוק את הכיתה "${c.name}"? המסלולים וההתקדמות בהם נשמרים.`, { okText: 'מחיקה', danger: true }))) return;
          api('DELETE', `/api/classes/${c.id}`).then(() => go('#/dashboard')).catch((err) => toast(err.message, 'error'));
        },
      }, '🗑️')),
    h('div', { class: 'class-admin-grid' },
      h('section', { class: 'card center' },
        h('h3', {}, 'קוד הכיתה'),
        h('div', { class: 'big-code', dir: 'ltr' }, c.code),
        h('p', { class: 'muted' }, 'התלמידים מקלידים את הקוד במסך "יש לי קוד", בוחרים שם וסיסמה מתמונות, ורואים את כל המסלולים שבחרתם.'),
        h('button', { class: 'btn', onclick: copy }, '📋 העתקת הקוד')),
      h('section', { class: 'card' },
        h('h3', {}, 'המסלולים של הכיתה'),
        paths.length ? pathPicker : h('p', { class: 'muted' }, 'עוד אין לכם מסלולים.'))),
    h('h2', { class: 'section-title' }, `תלמידים (${data.members.length})`),
    roster));
}
