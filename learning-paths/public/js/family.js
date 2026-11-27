// Parents: the private link a teacher gives them, and the page it opens (one child's
// progress, read-only, no answers).
import { api } from './api.js';
import { h, mount, toast, modal, confirmDialog, copyText, formatDate } from './ui.js';
import { brandMark } from './teacher.js';

// A private link for a student's parents: read-only progress of their child only.
export async function parentLinkDialog(endpoint, name) {
  const body = h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'רגע…'));
  const m = modal(`👪 קישור להורים של ${name}`, body);
  const show = (r) => {
    const url = `${location.origin}/#/p/${r.token}`;
    body.replaceChildren(
      h('p', {}, 'ההורים יראו רק את ההתקדמות של ', h('strong', {}, name), ': אילו משימות הושלמו ומתי. הם לא יראו תשובות, הקלטות או תלמידים אחרים.'),
      h('input', { type: 'text', readonly: true, dir: 'ltr', value: url, onfocus: (e) => e.target.select() }),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn primary', onclick: () => copyText(url, 'הקישור הועתק ✓') }, '📋 העתקת הקישור'),
        h('a', { class: 'btn secondary', href: `https://wa.me/?text=${encodeURIComponent(`ההתקדמות של ${name} ב-Questopia: ${url}`)}`, target: '_blank', rel: 'noopener' }, 'שליחה בוואטסאפ'),
        h('button', {
          class: 'btn ghost', onclick: async () => {
            if (!(await confirmDialog('לבטל את הקישור? הקישור הישן יפסיק לעבוד, ואפשר ליצור חדש.', { okText: 'ביטול הקישור', danger: true }))) return;
            api('DELETE', endpoint).then(() => { toast('הקישור בוטל', 'ok'); m.close(); }).catch((err) => toast(err.message, 'error'));
          },
        }, 'ביטול הקישור')),
      h('p', { class: 'muted small' }, 'מי שיש לו את הקישור יכול לצפות בהתקדמות. שתפו אותו רק עם ההורים.'));
  };
  api('POST', endpoint).then(show).catch((err) => { m.close(); toast(err.message, 'error'); });
}

const dayName = (text) => {
  if (!text) return '';
  const d = new Date(`${String(text).replace(' ', 'T')}Z`);
  return d.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'long' });
};

export async function parentPage(app, token) {
  document.body.className = 'parent-body';
  mount(app, h('main', { class: 'parent' }, h('p', { class: 'muted center' }, 'טוען…')));
  let data;
  try {
    data = await api('GET', `/api/parent/${token}`);
  } catch (err) {
    return mount(app, h('main', { class: 'parent' }, h('div', { class: 'card center' },
      h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, '🔗'),
      h('h1', {}, 'הקישור לא עובד'),
      h('p', {}, err.status === 404 ? 'ייתכן שהמורה ביטלה אותו. אפשר לבקש ממנה קישור חדש.' : err.message))));
  }
  const allTasks = data.paths.flatMap((p) => p.tasks);
  const doneCount = allTasks.filter((t) => t.completedAt).length;
  const weekAgo = Date.now() - 7 * 86400000;
  const thisWeek = allTasks.filter((t) => t.completedAt && new Date(`${t.completedAt.replace(' ', 'T')}Z`).getTime() > weekAgo).length;
  mount(app, h('main', { class: 'parent' },
    h('header', { class: 'parent-head' },
      h('span', { class: 'brand' }, brandMark(), h('span', { class: 'brand-word' }, 'Questopia')),
      h('h1', {}, `${data.child.avatar || '🌟'} ההתקדמות של ${data.child.name}`),
      h('p', { class: 'muted' }, [data.className && `כיתה: ${data.className}`, data.teacherName && `המורה: ${data.teacherName}`].filter(Boolean).join(' · '))),
    h('section', { class: 'parent-stats' },
      h('div', { class: 'stat' }, h('strong', {}, String(doneCount)), h('span', {}, 'משימות הושלמו')),
      h('div', { class: 'stat' }, h('strong', {}, String(thisWeek)), h('span', {}, 'בשבוע האחרון')),
      h('div', { class: 'stat' }, h('strong', {}, String(data.paths.length)), h('span', {}, data.paths.length === 1 ? 'מסלול' : 'מסלולים'))),
    data.paths.map((p) => {
      const done = p.tasks.filter((t) => t.completedAt).length;
      const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
      return h('section', { class: 'card parent-path', style: { '--accent': p.color } },
        h('h2', {}, `${p.icon} ${p.title}`),
        h('div', { class: 'parent-bar', role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': `${pct}% מהמסלול` },
          h('span', { style: { width: `${pct}%` } })),
        h('p', { class: 'muted small' }, p.lastActive ? `${done} מתוך ${p.tasks.length} משימות · פעילות אחרונה: ${formatDate(p.lastActive)}` : 'עוד לא התחיל/ה את המסלול'),
        h('ol', { class: 'parent-tasks' }, p.tasks.map((t) => h('li', { class: t.completedAt ? 'done' : '' },
          h('span', { class: 'parent-check', 'aria-hidden': 'true' }, t.completedAt ? '✓' : ''),
          h('span', {}, `${t.emoji || ''} ${t.title}`.trim()),
          h('span', { class: 'muted small' }, t.completedAt ? dayName(t.completedAt) : 'עוד לא')))));
    }),
    h('p', { class: 'muted small center' }, 'הדף מציג רק אילו משימות הושלמו. התשובות עצמן נשארות בין התלמיד/ה למורה. בכל שאלה – פנו למורה.')));
}
