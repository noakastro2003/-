// Classes on the teacher's side: one code and one roster for several paths.
import { api } from './api.js';
import { h, mount, toast, modal, confirmDialog, field, busy, formatDate, copyText } from './ui.js';
import { go } from './app.js';
import { parentLinkDialog } from './family.js';

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
          h('span', { class: 'muted small block' }, `${c.memberCount} תלמידים · ${c.pathCount} מסלולים · קוד ${c.code}`),
          !c.mine && h('span', { class: 'chip chip-shared' }, `👭 משותפת עם ${c.ownerName}`)))))
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

  const copy = () => copyText(c.code, 'הקוד הועתק');
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
            class: 'icon-btn', title: 'קישור להורים', 'aria-label': `קישור להורים של ${m.name}`,
            onclick: () => parentLinkDialog(`/api/class-members/${m.id}/parent-link`, m.name),
          }, '👪'),
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
      data.isOwner && h('button', {
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
        paths.length ? pathPicker : h('p', { class: 'muted' }, 'עוד אין לכם מסלולים.')),
      teachersCard(data, reload)),
    h('h2', { class: 'section-title' }, `תלמידים (${data.members.length})`),
    roster,
    data.members.length > 0 && activitySection(c.id)));
}

// Who teaches the class: the owner adds teachers who have an account; they see the roster
// and progress, and edit the class's paths.
function teachersCard(data, reload) {
  const c = data.class;
  const email = h('input', { type: 'email', required: true, dir: 'ltr', placeholder: 'האימייל של המורה', 'aria-label': 'האימייל של המורה' });
  const add = h('button', { class: 'btn small', type: 'submit' }, 'הוספה');
  const leave = (t) => async () => {
    const self = !data.isOwner;
    if (!(await confirmDialog(self ? 'לצאת מהכיתה? היא והמסלולים שלה לא יופיעו יותר אצלך.' : `להסיר את ${t.name} מהכיתה?`, { okText: self ? 'יציאה' : 'הסרה', danger: true }))) return;
    api('DELETE', `/api/classes/${c.id}/teachers/${t.id}`).then(() => (self ? go('#/dashboard') : reload())).catch((err) => toast(err.message, 'error'));
  };
  return h('section', { class: 'card' },
    h('h3', {}, '👭 מורות בכיתה'),
    h('ul', { class: 'teacher-list' },
      h('li', {}, h('strong', {}, data.owner.name), h('span', { class: 'muted small' }, ' · פתחה את הכיתה')),
      data.coTeachers.map((t) => h('li', {}, t.name, h('span', { class: 'muted small', dir: 'ltr' }, ` ${t.email}`),
        (data.isOwner || t.id === data.me) && h('button', { class: 'icon-btn', 'aria-label': `הסרת ${t.name}`, title: 'הסרה', onclick: leave(t) }, '✕')))),
    data.isOwner
      ? h('form', {
        class: 'row', onsubmit: (e) => {
          e.preventDefault();
          busy(add, api('POST', `/api/classes/${c.id}/teachers`, { email: email.value })
            .then(() => { toast('המורה נוספה ✓', 'ok'); reload(); }).catch((err) => toast(err.message, 'error')));
        },
      }, email, add)
      : null,
    h('p', { class: 'muted small' }, data.isOwner
      ? 'מורה שותפה (למשל מורת שילוב) רואה את התלמידים וההתקדמות ויכולה לערוך את מסלולי הכיתה. היא צריכה חשבון באתר.'
      : 'את מורה שותפה בכיתה הזו: אפשר לראות את התלמידים ולערוך את המסלולים. מחיקה נשארת אצל המורה שפתחה את הכיתה.'));
}

// Progress over time: last 14 days per student, who hasn't come in, who is stuck.
function activitySection(classId) {
  const box = h('section', { class: 'activity' }, h('h2', { class: 'section-title' }, '📈 תמונת מצב'), h('p', { class: 'muted' }, 'טוען…'));
  api('GET', `/api/classes/${classId}/activity`).then(({ days, members }) => {
    const week = days.slice(-7);
    const weekCount = (m) => week.reduce((n, d) => n + (m.perDay[d] || 0), 0);
    const daysAway = (m) => {
      const t = new Date(`${String(m.lastActive).replace(' ', 'T')}Z`).getTime();
      return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : null;
    };
    const progressed = members.filter((m) => weekCount(m) > 0);
    const away = members.filter((m) => (daysAway(m) ?? 99) >= 7);
    const stuck = members.filter((m) => m.stuck.length);
    const max = Math.max(1, ...members.flatMap((m) => days.map((d) => m.perDay[d] || 0)));
    const dayLabel = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('he-IL', { weekday: 'narrow', day: 'numeric' });
    box.replaceChildren(
      h('h2', { class: 'section-title' }, '📈 תמונת מצב'),
      members.length ? [
        h('div', { class: 'activity-summary' },
          h('div', { class: 'stat' }, h('strong', {}, `${progressed.length}/${members.length}`), h('span', {}, 'התקדמו השבוע')),
          h('div', { class: 'stat' }, h('strong', {}, String(away.length)), h('span', {}, 'לא נכנסו שבוע')),
          h('div', { class: 'stat' }, h('strong', {}, String(stuck.length)), h('span', {}, 'נתקעו / ביקשו עזרה'))),
        h('div', { class: 'table-wrap' }, h('table', { class: 'progress-table activity-table' },
          h('thead', {}, h('tr', {},
            h('th', { class: 'sticky' }, 'תלמידים'),
            h('th', {}, '14 הימים האחרונים'),
            h('th', {}, 'השבוע'),
            h('th', {}, 'נכנס/ה לאחרונה'),
            h('th', {}, 'צריך תשומת לב'))),
          h('tbody', {}, members.map((m) => {
            const away = daysAway(m);
            return h('tr', {},
              h('th', { class: 'sticky', scope: 'row' }, m.avatar && h('span', { class: 'row-avatar', 'aria-hidden': 'true' }, m.avatar), m.name),
              h('td', {}, h('div', { class: 'spark', 'aria-label': `${m.total} משימות בסך הכול` }, days.map((d) => {
                const n = m.perDay[d] || 0;
                return h('span', { class: `spark-bar${n ? ' on' : ''}`, style: { height: `${n ? 20 + (80 * n) / max : 8}%` }, title: `${dayLabel(d)}: ${n} משימות` });
              }))),
              h('td', {}, String(weekCount(m))),
              h('td', { class: `small${away !== null && away >= 7 ? ' warn-text' : ' muted'}` }, away === null ? '—' : away === 0 ? 'היום' : away === 1 ? 'אתמול' : `לפני ${away} ימים`),
              h('td', {}, m.stuck.length
                ? m.stuck.slice(0, 3).map((x) => h('span', { class: 'chip chip-warn', title: x.help ? 'ביקש/ה עזרה' : `${x.wrong} ניסיונות שגויים` }, `${x.help ? '✋' : `✗${x.wrong}`} ${x.title}`))
                : h('span', { class: 'muted small' }, '—')));
          })))),
        h('p', { class: 'muted small' }, 'כל עמודה היא יום. "צריך תשומת לב": בקשות עזרה פתוחות ומשימות עם 3 ניסיונות שגויים ומעלה.'),
      ] : h('p', { class: 'muted' }, 'כשיצטרפו תלמידים, תופיע כאן ההתקדמות שלהם לאורך זמן.'));
  }).catch((err) => box.replaceChildren(h('p', { class: 'error' }, err.message)));
  return box;
}
