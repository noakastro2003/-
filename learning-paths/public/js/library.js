// Teacher tools around a path: opening hours, the shared library, and printable reports.
import { api } from './api.js';
import { h, mount, toast, modal, field, busy, formatDate } from './ui.js';
import { go } from './app.js';
import { TASK_TYPES, MOODS } from './themes.js';
import { setCredits, showError, cost, creditWord } from './credits.js';
import { DEMO } from './env.js';

// Same list as GRADES in ai-prompt.js.
const GRADES = ['גן', 'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳', 'י׳', 'י״א', 'י״ב'];
const SUBJECTS = ['עברית', 'חשבון', 'אנגלית', 'מדעים', 'היסטוריה', 'גאוגרפיה', 'תנ״ך', 'אזרחות', 'כישורי חיים', 'אחר'];

const minutes = (sec) => (sec < 60 ? 'פחות מדקה' : `${Math.round(sec / 60)} דק׳`);
const when = (ms) => new Date(ms).toLocaleString('he-IL', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
// <input type="datetime-local"> works in local time: "2026-11-15T08:00".
const toLocalInput = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const fromLocalInput = (value) => (value ? new Date(value).getTime() : null);

// ---------- opening hours ----------

export function scheduleCard(state) {
  const opens = h('input', { type: 'datetime-local', value: toLocalInput(state.path.opensAt) });
  const closes = h('input', { type: 'datetime-local', value: toLocalInput(state.path.closesAt) });
  const save = h('button', { class: 'btn small primary', type: 'submit' }, 'שמירה');
  const status = () => {
    const now = Date.now();
    const { opensAt, closesAt } = state.path;
    if (opensAt && now < opensAt) return `⏳ ייפתח לתלמידים ב${when(opensAt)}`;
    if (closesAt && now >= closesAt) return '🔒 סגור: התלמידים רואים את המפה אבל לא יכולים להמשיך';
    if (closesAt) return `✅ פתוח עד ${when(closesAt)}`;
    return '✅ פתוח תמיד';
  };
  const statusEl = h('p', { class: 'small' }, status());
  return h('form', {
    class: 'card schedule-card',
    onsubmit: (e) => {
      e.preventDefault();
      busy(save, api('PUT', `/api/paths/${state.path.id}`, { opensAt: fromLocalInput(opens.value), closesAt: fromLocalInput(closes.value) })
        .then((r) => { state.path = r.path; statusEl.textContent = status(); toast('המועדים נשמרו', 'ok'); })
        .catch((err) => toast(err.message, 'error')));
    },
  },
    h('h3', {}, '🗓️ מתי המסלול פתוח'),
    h('p', { class: 'muted small' }, 'למשל: שיעורי בית לשבוע, או מסלול שנפתח רק בתחילת השיעור. אפשר להשאיר ריק.'),
    h('div', { class: 'row wrap' }, field('נפתח ב־', opens), field('נסגר ב־', closes)),
    statusEl,
    h('div', { class: 'row' }, save,
      h('button', { type: 'button', class: 'btn small ghost', onclick: () => { opens.value = ''; closes.value = ''; } }, 'ניקוי')));
}

// ---------- sharing with other teachers ----------

export function libraryShareCard(state) {
  const on = h('input', { type: 'checkbox', checked: state.path.shared });
  const grade = h('select', {}, h('option', { value: '' }, 'כל הגילים'),
    GRADES.map((g) => h('option', { value: g, selected: state.path.sharedGrade === g }, `כיתה ${g}`.replace('כיתה גן', 'גן'))));
  const subject = h('select', {}, h('option', { value: '' }, 'בלי מקצוע'),
    SUBJECTS.map((x) => h('option', { value: x, selected: state.path.sharedSubject === x }, x)));
  const save = h('button', { class: 'btn small primary', type: 'submit' }, 'שמירה');
  return h('form', {
    class: 'card share-lib-card',
    onsubmit: (e) => {
      e.preventDefault();
      busy(save, api('PUT', `/api/paths/${state.path.id}/share`, { shared: on.checked, grade: grade.value, subject: subject.value })
        .then((r) => { state.path = r.path; toast(on.checked ? 'המסלול בספרייה. תודה ששיתפת! 💜' : 'המסלול הוסר מהספרייה', 'ok'); })
        .catch((err) => { on.checked = state.path.shared; toast(err.message, 'error'); }));
    },
  },
    h('h3', {}, '📚 שיתוף בספריית המסלולים'),
    h('label', { class: 'toggle' }, on, h('span', { class: 'toggle-ui', 'aria-hidden': 'true' }),
      h('span', {}, h('strong', {}, 'לשתף עם מורות ומורים אחרים'),
        h('span', { class: 'muted small block' }, 'הם יוכלו לראות את המשימות ולהעתיק עותק משלהם. התלמידים שלכם, ההתקדמות וקוד האישור לא משותפים. בספרייה יופיע רק השם הפרטי שלכם.'))),
    h('div', { class: 'row wrap' }, field('שכבת גיל', grade), field('מקצוע', subject)),
    h('div', { class: 'row' }, save, h('a', { class: 'btn small ghost', href: '#/library' }, 'לספרייה ←')));
}

// ---------- the library ----------

export async function libraryPage(app, topbar) {
  mount(app, topbar(), h('main', { class: 'page' }, h('p', { class: 'muted' }, 'טוען…')));
  let items;
  try {
    items = (await api('GET', '/api/library')).items;
  } catch (err) {
    if (err.status === 401) return go('#/login');
    return mount(app, topbar(), h('main', { class: 'page' }, h('p', { class: 'error' }, err.message)));
  }
  const search = h('input', { type: 'search', placeholder: 'חיפוש: שברים, חגים, אותיות…', 'aria-label': 'חיפוש' });
  const grade = h('select', { 'aria-label': 'שכבת גיל' }, h('option', { value: '' }, 'כל הגילים'), GRADES.map((g) => h('option', { value: g }, g)));
  const subject = h('select', { 'aria-label': 'מקצוע' }, h('option', { value: '' }, 'כל המקצועות'), SUBJECTS.map((x) => h('option', { value: x }, x)));
  const source = h('select', { 'aria-label': 'מקור' },
    [['', 'כל המסלולים'], ['ready', '⭐ מסלולים מוכנים'], ['shared', '👩‍🏫 ששיתפו מורים']].map(([val, label]) => h('option', { value: val }, label)));
  const list = h('div', { class: 'lib-grid' });
  const draw = () => {
    const q = search.value.trim();
    const shown = items.filter((x) => (!q || `${x.title} ${x.description} ${x.subject} ${x.curriculum || ''}`.includes(q))
      && (!grade.value || x.grade === grade.value) && (!subject.value || x.subject === subject.value)
      && (!source.value || (source.value === 'ready') === Boolean(x.ready)));
    mount(list, shown.length ? shown.map((x) => libCard(x)) : h('p', { class: 'muted' },
      items.length ? 'לא נמצאו מסלולים. נסו חיפוש אחר.' : 'הספרייה עוד ריקה. אפשר להיות הראשונים לשתף: בלשונית "שיתוף" של מסלול.'));
  };
  [search, grade, subject, source].forEach((el) => el.addEventListener('input', draw));
  mount(app, topbar(), h('main', { class: 'page' },
    h('a', { class: 'back', href: '#/dashboard' }, '→ המסלולים שלי'),
    h('div', { class: 'page-head' }, h('h1', {}, '📚 ספריית המסלולים'),
      h('p', { class: 'muted' }, 'מסלולים מוכנים לפי תוכנית הלימודים, ומסלולים שמורות ומורים שיתפו. מוצאים, מציצים, ומעתיקים עותק משלכם לעריכה.')),
    DEMO && h('p', { class: 'notice' }, 'בגרסת ההדגמה רואים כאן את המסלולים המוכנים ואת מה ששיתפתם בעצמכם.'),
    h('div', { class: 'row wrap lib-filters' }, search, source, subject, grade),
    list));
  draw();
}

function libCard(x) {
  const types = x.types.slice(0, 6).map((t) => TASK_TYPES[t]?.icon).filter(Boolean).join(' ');
  return h('article', { class: 'lib-card', style: { '--accent': x.theme.color } },
    h('div', { class: 'lib-top' }, h('span', { class: 'lib-icon', 'aria-hidden': 'true' }, x.theme.icon),
      h('div', {}, h('h3', {}, x.title), h('p', { class: 'small muted' }, [x.grade && `כיתה ${x.grade}`.replace('כיתה גן', 'גן'), x.subject, `${x.taskCount} משימות`].filter(Boolean).join(' · ')))),
    x.description && h('p', { class: 'lib-desc' }, x.description),
    h('p', { class: 'small', 'aria-label': 'סוגי משימות' }, types),
    x.curriculum && h('p', { class: 'small lib-curriculum' }, `📘 ${x.curriculum}`),
    h('p', { class: 'small muted' }, x.ready ? h('span', { class: 'chip chip-ready' }, '⭐ מסלול מוכן של האתר')
      : [x.mine ? 'שלכם' : `שיתף/ה: ${x.author || 'מורה'}`, x.copies ? ` · הועתק ${x.copies} פעמים` : '']),
    h('div', { class: 'row' },
      h('button', { class: 'btn small secondary', onclick: () => previewLib(x) }, '👀 הצצה'),
      h('button', { class: 'btn small primary', onclick: (e) => copyLib(x, e.currentTarget) }, `📥 העתקה אליי${cost('copyPath') ? ` (${creditWord(cost('copyPath'))})` : ''}`)));
}

async function previewLib(x) {
  let d;
  try {
    d = await api('GET', `/api/library/${x.id}`);
  } catch (err) {
    return toast(err.message, 'error');
  }
  const m = modal(`${x.theme.icon} ${d.title}`, [
    d.description && h('p', {}, d.description),
    x.curriculum && h('p', { class: 'small muted' }, `📘 בתוכנית הלימודים: ${x.curriculum}${x.grade ? ` · כיתה ${x.grade}` : ''}`),
    x.ready && h('p', { class: 'notice small' }, 'אחרי ההעתקה המסלול שלכם: אפשר לערוך, להוסיף ניקוד, תמונות והקלטות, ולהתאים לכיתה.'),
    h('ol', { class: 'lib-tasks' }, d.tasks.map((t) => h('li', {},
      h('span', { 'aria-hidden': 'true' }, t.emoji || TASK_TYPES[t.type].icon), ' ', h('strong', {}, t.title),
      h('span', { class: 'small muted' }, ` · ${TASK_TYPES[t.type].name} · ${t.estMinutes} דק׳`),
      t.content.text && h('div', { class: 'small' }, t.content.text.slice(0, 160))))),
    h('div', { class: 'row end' },
      h('button', { class: 'btn ghost', onclick: () => m.close() }, 'סגירה'),
      h('button', { class: 'btn primary', onclick: (e) => copyLib(x, e.currentTarget, () => m.close()) }, `📥 העתקה אליי${cost('copyPath') ? ` (${creditWord(cost('copyPath'))})` : ''}`)),
  ], { wide: true });
}

function copyLib(x, btn, after = () => {}) {
  busy(btn, api('POST', `/api/library/${x.id}/copy`)
    .then((r) => {
      setCredits(r.credits);
      after();
      toast('המסלול הועתק אליכם. אפשר לערוך אותו כרצונכם ✓', 'ok');
      go(`#/path/${r.path.id}/tasks`);
    })
    .catch(showError));
}

// ---------- printable report ----------

function answerOf(t, d) {
  const a = d?.answer;
  if (a == null) return '';
  if (t.type === 'question') return String(a);
  if (t.type === 'choice') return t.content.options?.[a] ?? '';
  if (t.type === 'voice') return a.audio ? '🎤 תשובה מוקלטת (אפשר להאזין באתר)' : String(a);
  if (t.type === 'flashcards') return a.again ? `"עוד פעם" ${a.again} פעמים` : 'ידע הכול בסיבוב הראשון';
  if ((t.type === 'photo' || t.type === 'draw') && a.image) return h('img', { class: 'report-img', src: a.image, alt: '' });
  return '';
}

function studentReport(path, tasks, s, wrong) {
  const hidden = new Set(s.adapt?.hidden || []);
  const mine = tasks.filter((t) => !hidden.has(t.id));
  const done = mine.filter((t) => s.done[t.id] && s.done[t.id].approved !== false);
  const total = mine.reduce((n, t) => n + (s.done[t.id]?.durationSec || 0), 0);
  const misses = mine.reduce((n, t) => n + (wrong[s.id]?.[t.id] || 0), 0);
  const mood = (k) => s.moods?.[k] && `${s.moods[k].mood} ${MOODS.find((m) => m.e === s.moods[k].mood)?.name || ''}`;
  return h('section', { class: 'report' },
    h('header', { class: 'report-head' },
      h('div', {}, h('h1', {}, `${s.avatar || ''} ${s.name}`), h('p', {}, `${path.theme.icon} ${path.title}`)),
      h('p', { class: 'small muted' }, `הופק ב־${new Date().toLocaleDateString('he-IL')}`)),
    h('div', { class: 'report-stats' },
      h('div', {}, h('strong', {}, `${done.length}/${mine.length}`), h('span', {}, 'משימות הושלמו')),
      h('div', {}, h('strong', {}, total ? minutes(total) : '—'), h('span', {}, 'זמן עבודה')),
      h('div', {}, h('strong', {}, String(misses)), h('span', {}, 'ניסיונות שגויים')),
      (s.moods?.start || s.moods?.end) && h('div', {}, h('strong', {}, [mood('start'), mood('end')].filter(Boolean).join(' ← ')), h('span', {}, 'הרגשה (התחלה ← סוף)'))),
    h('table', { class: 'report-table' },
      h('thead', {}, h('tr', {}, ['#', 'משימה', 'מצב', 'תאריך', 'זמן', 'טעויות', 'תשובה'].map((x) => h('th', {}, x)))),
      h('tbody', {}, mine.map((t, i) => {
        const d = s.done[t.id];
        const state = !d ? 'עוד לא' : d.approved === false ? 'מחכה לאישור' : '✓ הושלם';
        return h('tr', {},
          h('td', {}, i + 1), h('td', {}, `${t.emoji || TASK_TYPES[t.type].icon} ${t.title}`), h('td', {}, state),
          h('td', {}, d ? formatDate(d.completedAt) : ''), h('td', {}, d?.durationSec ? minutes(d.durationSec) : ''),
          h('td', {}, wrong[s.id]?.[t.id] || ''), h('td', { class: 'report-answer' }, answerOf(t, d)));
      }))),
    hidden.size > 0 && h('p', { class: 'small muted' }, `${hidden.size} משימות הוסתרו לתלמיד/ה הזה/זו בהתאמה אישית.`),
    h('div', { class: 'report-notes' }, h('strong', {}, 'הערות המורה:'),
      h('textarea', { rows: 4, 'aria-label': 'הערות המורה', placeholder: 'אפשר לכתוב כאן לפני ההדפסה (לא נשמר)' })));
}

export async function reportPage(app, topbar, pathId, studentId) {
  mount(app, topbar(), h('main', { class: 'page' }, h('p', { class: 'muted' }, 'טוען…')));
  let p;
  let prog;
  try {
    [p, prog] = await Promise.all([api('GET', `/api/paths/${pathId}`), api('GET', `/api/paths/${pathId}/progress`)]);
  } catch (err) {
    if (err.status === 401) return go('#/login');
    return mount(app, topbar(), h('main', { class: 'page' }, h('p', { class: 'error' }, err.message)));
  }
  const students = studentId ? prog.students.filter((s) => s.id === studentId) : prog.students;
  mount(app, topbar(), h('main', { class: 'page report-page' },
    h('div', { class: 'row no-print' },
      h('a', { class: 'back', href: `#/path/${pathId}/progress` }, '→ חזרה להתקדמות'),
      h('button', { class: 'btn primary', onclick: () => window.print() }, '🖨️ הדפסה / שמירה כ-PDF')),
    students.length ? students.map((s) => studentReport(p.path, prog.tasks, s, prog.wrong || {}))
      : h('p', { class: 'muted' }, 'אין עדיין תלמידים במסלול.')));
}
