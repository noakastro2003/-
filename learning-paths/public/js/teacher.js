import { api } from './api.js';
import { h, mount, toast, modal, confirmDialog, field, busy, formatDate, debounce } from './ui.js';
import { session, go } from './app.js';
import {
  COLORS, BACKGROUNDS, FONTS, MAPS, ICONS, TASK_EMOJIS, TASK_TYPES, TASK_GROUPS, MODES, STATIONS, CARDS, CELEBRATIONS,
  BUDDIES, PRESETS, applyTheme, fontFamily,
  MOODS,
} from './themes.js';
import { celebrate } from './student.js';

// Theme values a preset swatch needs that presets don't set themselves.
const THEME_FALLBACK = { color: '#6c5ce7', background: 'plain', font: 'rounded', mode: 'light' };
import { nikudBar } from './nikud.js';
import { imageField, audioField } from './media.js';
import { classesSection } from './classes.js';
import { scheduleCard, libraryShareCard } from './library.js';
import { DEMO } from './env.js';
import { creditBadge, creditWord, cost, setCredits, showError } from './credits.js';

// ---------- shared chrome ----------

export function topbar(...extra) {
  return h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: session.teacher ? '#/dashboard' : '#/' },
      brandMark(), 'מסלולי למידה'),
    h('div', { class: 'topbar-actions' },
      extra,
      creditBadge(),
      DEMO && h('span', { class: 'chip chip-warn', title: 'הנתונים נשמרים רק אצלך' }, 'גרסת הדגמה'),
      session.teacher?.isAdmin && !DEMO && h('a', { class: 'btn ghost small', href: '#/admin', title: 'ניהול', 'aria-label': 'ניהול' }, '🛠️', h('span', { class: 'hide-sm' }, ' ניהול')),
      session.teacher && h('a', { class: 'btn ghost small', href: '#/settings', title: 'הגדרות וקוד הטבה', 'aria-label': 'הגדרות' }, '⚙️', h('span', { class: 'hide-sm' }, ' הגדרות')),
      session.teacher && !DEMO && h('span', { class: 'muted hide-sm' }, `שלום, ${session.teacher.name}`),
      session.teacher && !DEMO && h('button', { class: 'btn ghost small', onclick: logout }, 'יציאה')));
}

async function logout() {
  await api('POST', '/api/auth/logout').catch(() => {});
  session.teacher = null;
  go('#/');
}

// ---------- home ----------

// The logo: a winding path with stations.
export function brandMark() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('class', 'brand-mark');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<rect width="40" height="40" rx="11" fill="currentColor"/>'
    + '<path d="M9 30c7 0 6-9 12-9s5-9 11-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-dasharray="0.5 5.5"/>'
    + '<circle cx="9" cy="30" r="3.4" fill="#ffd166"/><circle cx="21" cy="21" r="3.4" fill="#fff"/><circle cx="32" cy="12" r="3.4" fill="#06d6a0"/>';
  return svg;
}

// A small, non-interactive picture of the student's map, for the home page.
function mapMockup() {
  const station = (cls, dot, title, meta) => h('li', { class: `mock-station ${cls}` },
    h('span', { class: 'mock-dot' }, dot), h('span', { class: 'mock-label' }, h('strong', {}, title), h('span', {}, meta)));
  return h('div', { class: 'mock-phone', 'aria-hidden': 'true' },
    h('div', { class: 'mock-head' }, h('span', {}, '🦊 היי נועם!'), h('span', { class: 'mock-stars' }, '⭐ 2')),
    h('div', { class: 'mock-title' }, 'מחזור המים'),
    h('div', { class: 'mock-progress' }, h('span', { style: { width: '40%' } })),
    h('ol', { class: 'mock-map' },
      station('done', '✓', 'מתכוננים', '2 דק׳'),
      station('done', '✓', 'מה זה אידוי?', '3 דק׳'),
      station('current', '🃏', 'משחק זיכרון', '4 דק׳ · 🦉'),
      station('locked', '🔒', 'זמן עבודה', '8 דק׳'),
      station('locked', '🔒', 'נכון או לא?', '3 דק׳')));
}

export function homePage(app) {
  const forStudents = [
    ['🎯', 'משימה אחת על המסך', 'בלי הסחות: משימה קצרה, ברורה, עם זמן משוער ומפה שמראה כמה נשאר.'],
    ['🃏', 'משחקים ותרגול', 'משחק זיכרון, תפזורת, התאמה, סידור, השלמת מילים, נכון או לא נכון.'],
    ['🙆', 'הפסקות תנועה', 'הפסקה קצרה עם הצעה לתנועה כל כמה משימות, עם שעון.'],
    ['🏅', 'חיזוקים', 'כוכבים, תגים, חגיגה קטנה ודמות מלווה שמעודדת.'],
    ['🔊', 'הקראה בקול המורה', 'ההוראות בקול שלכם, וניקוד מלא לקוראים מתחילים.'],
  ];
  const forTeachers = [
    ['✨', 'מחולל מסלולים', 'נושא, שכבת גיל ומטרות, אפשר לצרף דף עבודה – ומקבלים מסלול שלם לעריכה.'],
    ['אָ', 'ניקוד אוטומטי', 'מנקדים כל שדה בלחיצה, או במקלדת הניקוד.'],
    ['🧑‍🏫', 'אישור מורה', 'תחנות שבהן התלמיד ממתין עד שתקלידו את הקוד שלכם על המסך שלו.'],
    ['🔎', 'איפה נתקעים', 'מי צריך עזרה, כמה ניסיונות, כמה זמן – ומה כדאי לפשט.'],
    ['🎨', 'עיצוב בלחיצה', 'ערכות מוכנות: חלל, ים, יער, מחברת, מצב לילה ועוד.'],
  ];
  const card = ([icon, title, text]) => h('li', { class: 'home-feature' },
    h('span', { class: 'home-feature-icon', 'aria-hidden': 'true' }, icon),
    h('div', {}, h('h3', {}, title), h('p', {}, text)));

  mount(app,
    topbar(h('a', { class: 'btn ghost small', href: '#/login' }, 'כניסה למורים')),
    h('main', { class: 'home' },
      h('section', { class: 'home-hero' },
        h('div', { class: 'home-hero-text' },
          h('p', { class: 'eyebrow' }, 'למידה עצמאית לתלמידים עם קשיי קשב'),
          h('h1', {}, 'כל תלמיד מתקדם ', h('span', { class: 'accent' }, 'במסלול משלו')),
          h('p', { class: 'lead' }, 'בונים מסלול של משימות קטנות, משחקים והפסקות, ומשתפים קוד עם הכיתה. התלמידים מתקדמים בקצב שלהם, ואתם רואים בדיוק מי מתקדם ומי צריך עזרה.'),
          h('div', { class: 'row wrap' },
            h('a', { class: 'btn primary big', href: '#/register' }, 'פתיחת חשבון למורים'),
            h('a', { class: 'btn secondary big', href: '#/join' }, '🎒 אני תלמיד – יש לי קוד')),
          h('p', { class: 'muted small' }, '20 קרדיטים חינם בהרשמה · בלי כרטיס אשראי')),
        mapMockup()),

      h('section', { class: 'home-steps' },
        h('h2', {}, 'איך זה עובד'),
        h('ol', {},
          h('li', {}, h('strong', {}, 'בונים מסלול'), h('span', {}, 'לבד, ממסלול לדוגמה, או עם המחולל. מוסיפים תמונות, הקלטות וניקוד.')),
          h('li', {}, h('strong', {}, 'משתפים קוד'), h('span', {}, 'התלמידים נכנסים עם הקוד, שם וסיסמה מתמונות – בלי אימייל.')),
          h('li', {}, h('strong', {}, 'עוקבים ומאשרים'), h('span', {}, 'טבלת התקדמות, בקשות עזרה, אישור מורה ונתונים על איפה נתקעים.')))),

      h('section', { class: 'home-columns' },
        h('div', {}, h('h2', {}, 'לתלמידים'), h('ul', { class: 'home-features' }, forStudents.map(card))),
        h('div', {}, h('h2', {}, 'למורים'), h('ul', { class: 'home-features' }, forTeachers.map(card)))),

      h('section', { class: 'home-cta' },
        h('h2', {}, 'נסו עם הכיתה שלכם'),
        h('p', {}, 'פתיחת חשבון לוקחת דקה. מקבלים 20 קרדיטים חינם – מספיק לכמה מסלולים מלאים.'),
        h('a', { class: 'btn big home-cta-btn', href: '#/register' }, 'פתיחת חשבון חינם'))));
}

// ---------- auth ----------

export function authPage(app, mode) {
  if (session.teacher) return go('#/dashboard');
  const isReg = mode === 'register';
  const name = h('input', { type: 'text', required: true, autocomplete: 'name', maxlength: 80 });
  const email = h('input', { type: 'email', required: true, autocomplete: 'email', dir: 'ltr' });
  const pw = h('input', { type: 'password', required: true, minlength: isReg ? 8 : null, autocomplete: isReg ? 'new-password' : 'current-password', dir: 'ltr' });
  const promo = h('input', { type: 'text', dir: 'ltr', maxlength: 30, autocapitalize: 'characters', value: new URLSearchParams(location.hash.split('?')[1] || '').get('code') || '' });
  const error = h('p', { class: 'error', role: 'alert' });
  const submit = h('button', { class: 'btn primary block', type: 'submit' }, isReg ? 'יצירת חשבון' : 'כניסה');

  const onSubmit = (e) => {
    e.preventDefault();
    error.textContent = '';
    const body = { email: email.value, password: pw.value };
    if (isReg) { body.name = name.value; body.promo = promo.value; }
    busy(submit, api('POST', `/api/auth/${isReg ? 'register' : 'login'}`, body)
      .then((r) => {
        if (r.promo) toast(r.promo.message, r.promo.ok ? 'ok' : 'error');
        session.loaded = false;
        go('#/dashboard');
      })
      .catch((err) => { error.textContent = err.message; }));
  };

  mount(app, topbar(), h('main', { class: 'center-page' },
    h('form', { class: 'card narrow', onsubmit: onSubmit },
      h('h1', {}, isReg ? 'הרשמה למורות' : 'כניסה למורות'),
      isReg && field('שם מלא', name),
      field('אימייל', email),
      field('סיסמה', pw, isReg ? 'לפחות 8 תווים' : null),
      isReg && !DEMO && field('קוד הטבה (לא חובה)', promo),
      error, submit,
      !isReg && h('p', { class: 'center small' }, h('a', { href: '#/forgot' }, 'שכחתי סיסמה')),
      h('p', { class: 'muted center' },
        isReg ? 'כבר יש לך חשבון? ' : 'עוד אין לך חשבון? ',
        h('a', { href: isReg ? '#/login' : '#/register' }, isReg ? 'כניסה' : 'הרשמה')))));
}

export function forgotPage(app) {
  const email = h('input', { type: 'email', required: true, autocomplete: 'email', dir: 'ltr' });
  const submit = h('button', { class: 'btn primary block', type: 'submit' }, 'שליחת קישור לאיפוס');
  const form = h('form', {
    class: 'card narrow',
    onsubmit: (e) => {
      e.preventDefault();
      busy(submit, api('POST', '/api/auth/forgot', { email: email.value })
        .then(() => mount(form,
          h('h1', {}, 'בדקו את תיבת הדואר 📬'),
          h('p', {}, `אם קיים חשבון עם הכתובת ${email.value}, שלחנו אליה קישור לבחירת סיסמה חדשה. הקישור תקף לשעה.`),
          h('p', { class: 'muted small' }, 'לא הגיע? בדקו בתיקיית הספאם, או פנו להנהלת המערכת.'),
          h('a', { class: 'btn block', href: '#/login' }, 'חזרה לכניסה')))
        .catch((err) => toast(err.message, 'error')));
    },
  },
    h('h1', {}, 'שכחתי סיסמה'),
    h('p', { class: 'muted' }, 'כתבו את האימייל שאיתו נרשמתם, ונשלח קישור לבחירת סיסמה חדשה.'),
    field('אימייל', email), submit,
    h('p', { class: 'muted center' }, h('a', { href: '#/login' }, 'חזרה לכניסה')));
  mount(app, topbar(), h('main', { class: 'center-page' }, form));
  email.focus();
}

export function resetPage(app, token) {
  const pw = h('input', { type: 'password', required: true, minlength: 8, autocomplete: 'new-password', dir: 'ltr' });
  const pw2 = h('input', { type: 'password', required: true, minlength: 8, autocomplete: 'new-password', dir: 'ltr' });
  const error = h('p', { class: 'error', role: 'alert' });
  const submit = h('button', { class: 'btn primary block', type: 'submit' }, 'שמירת הסיסמה החדשה');
  mount(app, topbar(), h('main', { class: 'center-page' }, h('form', {
    class: 'card narrow',
    onsubmit: (e) => {
      e.preventDefault();
      error.textContent = '';
      if (pw.value !== pw2.value) { error.textContent = 'הסיסמאות לא זהות'; return; }
      busy(submit, api('POST', '/api/auth/reset', { token, password: pw.value })
        .then(() => { toast('הסיסמה עודכנה', 'ok'); session.loaded = false; go('#/dashboard'); })
        .catch((err) => { error.textContent = err.message; }));
    },
  },
    h('h1', {}, 'בחירת סיסמה חדשה'),
    field('סיסמה חדשה', pw, 'לפחות 8 תווים'),
    field('שוב, לאימות', pw2),
    error, submit)));
  pw.focus();
}

// ---------- dashboard ----------

export async function dashboardPage(app) {
  const list = h('div', { class: 'path-grid' }, h('p', { class: 'muted' }, 'טוען…'));
  const summary = h('div', { class: 'dash-summary' });
  const classesBox = h('section', { class: 'classes-box' });
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב';
  mount(app, topbar(), h('main', { class: 'page' },
    h('p', { class: 'dash-hello' }, DEMO ? `${hello}!` : `${hello}, ${session.teacher.name}!`),
    summary,
    h('div', { class: 'page-head' },
      h('h1', {}, 'המסלולים שלי'),
      h('div', { class: 'row wrap' },
        h('a', { class: 'btn ghost', href: '#/library' }, '📚 ספרייה'),
        h('a', { class: 'btn secondary', href: '#/generate' }, '✨ מחולל מסלולים'),
        h('button', { class: 'btn primary', onclick: newPathDialog }, '+ מסלול חדש'))),
    list,
    classesBox));
  classesSection(classesBox);

  let paths;
  try {
    paths = (await api('GET', '/api/paths')).paths;
  } catch (err) {
    return mount(list, h('p', { class: 'error' }, err.message));
  }
  if (!paths.length) {
    return mount(list, h('div', { class: 'empty card' },
      h('div', { class: 'empty-icon', 'aria-hidden': 'true' }, '🗺️'),
      h('h2', {}, 'עוד אין מסלולים'),
      h('p', {}, 'צרו את המסלול הראשון – בעצמכם, ממסלול לדוגמה, או עם מחולל המסלולים שבונה מסלול שלם מנושא ומטרות.'),
      h('div', { class: 'row center wrap' },
        h('a', { class: 'btn secondary', href: '#/generate' }, '✨ מחולל מסלולים'),
        h('a', { class: 'btn ghost', href: '#/library' }, '📚 העתקה מהספרייה'),
        h('button', { class: 'btn primary', onclick: newPathDialog }, 'יצירת מסלול בעצמי'))));
  }
  // What needs attention first: approvals and help requests, then the totals.
  const total = (k) => paths.reduce((n, p) => n + (p[k] || 0), 0);
  const waiting = total('pendingApproval');
  const helpNow = total('openHelp');
  const firstWith = (k) => paths.find((p) => p[k] > 0);
  mount(summary,
    waiting > 0 && h('a', { class: 'dash-stat alert', href: `#/path/${firstWith('pendingApproval').id}/progress` },
      h('strong', {}, waiting), h('span', {}, '🧑‍🏫 ממתינים לאישור')),
    helpNow > 0 && h('a', { class: 'dash-stat alert', href: `#/path/${firstWith('openHelp').id}/progress` },
      h('strong', {}, helpNow), h('span', {}, '✋ בקשות עזרה')),
    h('div', { class: 'dash-stat' }, h('strong', {}, paths.length), h('span', {}, 'מסלולים')),
    h('div', { class: 'dash-stat' }, h('strong', {}, paths.filter((p) => p.published).length), h('span', {}, 'פורסמו')),
    h('div', { class: 'dash-stat' }, h('strong', {}, total('studentCount')), h('span', {}, 'תלמידים במסלולים')));
  mount(list, paths.map((p) => {
    const card = h('a', { class: 'path-card', href: `#/path/${p.id}` },
      h('div', { class: 'path-card-banner' }, h('span', { class: 'path-card-icon' }, p.theme.icon)),
      h('div', { class: 'path-card-body' },
        h('h3', {}, p.title),
        h('div', { class: 'chips' },
          h('span', { class: `chip ${p.published ? 'chip-ok' : ''}` }, p.published ? 'פורסם' : 'טיוטה'),
          h('span', { class: 'chip' }, `${p.taskCount} משימות`),
          h('span', { class: 'chip' }, `${p.studentCount} תלמידים`),
          p.openHelp > 0 && h('span', { class: 'chip chip-warn' }, `✋ ${p.openHelp} בקשות עזרה`),
          p.pendingApproval > 0 && h('span', { class: 'chip chip-warn' }, `🧑‍🏫 ${p.pendingApproval} ממתינים לאישור`))));
    applyTheme(card, p.theme, { surfaces: false });
    return card;
  }));
}

function newPathDialog() {
  const title = h('input', { type: 'text', required: true, maxlength: 120, placeholder: 'למשל: הבנת הנקרא – יחידה 3' });
  let template = 'sample';
  const options = [
    ['sample', '✨ מסלול לדוגמה', 'מתחילים עם 5 משימות מוכנות לעריכה'],
    ['empty', '📄 מסלול ריק', 'בונים הכול מאפס'],
  ].map(([val, name, desc]) => h('button', {
    type: 'button', class: `choice-card${val === template ? ' selected' : ''}`, 'aria-pressed': String(val === template),
    onclick: (e) => {
      template = val;
      for (const b of e.currentTarget.parentElement.children) {
        b.classList.toggle('selected', b === e.currentTarget);
        b.setAttribute('aria-pressed', String(b === e.currentTarget));
      }
    },
  }, h('strong', {}, name), h('span', { class: 'muted' }, desc)));
  const submit = h('button', { class: 'btn primary', type: 'submit' }, 'יצירה');
  const price = cost('createPath');
  const m = modal('מסלול חדש', h('form', {
    onsubmit: (e) => {
      e.preventDefault();
      busy(submit, api('POST', '/api/paths', { title: title.value, template })
        .then((r) => { setCredits(r.credits); m.close(); go(`#/path/${r.path.id}`); })
        .catch((err) => { if (err.status === 402) m.close(); showError(err); }));
    },
  }, field('שם המסלול', title), h('div', { class: 'choice-row' }, options),
    h('div', { class: 'row end wrap' },
      price > 0 && h('span', { class: 'muted small cost-note' }, `עולה ${creditWord(price)} · יש לך ${session.teacher.credits}`),
      submit)));
}

// ---------- editor ----------

const TABS = [
  ['tasks', '🧩 משימות'],
  ['design', '🎨 עיצוב'],
  ['share', '🔗 שיתוף'],
  ['progress', '📊 התקדמות'],
];

export async function editorPage(app, id, tab) {
  mount(app, topbar(), h('main', { class: 'page' }, h('p', { class: 'muted' }, 'טוען…')));
  let data;
  try {
    data = await api('GET', `/api/paths/${id}`);
  } catch (err) {
    if (err.status === 401) { session.teacher = null; return go('#/login'); }
    return mount(app, topbar(), h('main', { class: 'page' }, h('p', { class: 'error' }, err.message),
      h('a', { class: 'btn', href: '#/dashboard' }, 'חזרה למסלולים')));
  }
  const state = { path: data.path, tasks: data.tasks };

  const titleInput = h('input', {
    class: 'title-input', value: state.path.title, maxlength: 120, 'aria-label': 'שם המסלול',
    onchange: () => savePath(state, { title: titleInput.value }).catch(() => { titleInput.value = state.path.title; }),
  });
  const publishBtn = h('button', { class: 'btn small' });
  const statusChip = h('span', { class: 'chip' });
  const syncPublish = () => {
    statusChip.textContent = state.path.published ? 'פורסם' : 'טיוטה';
    statusChip.className = `chip ${state.path.published ? 'chip-ok' : ''}`;
    publishBtn.textContent = state.path.published ? 'הסתרה מהתלמידים' : 'פרסום לתלמידים';
    publishBtn.className = `btn small ${state.path.published ? 'ghost' : 'primary'}`;
  };
  publishBtn.onclick = () => busy(publishBtn, savePath(state, { published: !state.path.published }).then(() => {
    syncPublish();
    toast(state.path.published ? 'המסלול פורסם 🎉' : 'המסלול הוסתר', 'ok');
    if (tab === 'share') render();
  }));
  syncPublish();

  const body = h('section', { class: 'tab-body' });
  const render = () => ({ tasks: tasksTab, design: designTab, share: shareTab, progress: progressTab })[tab](body, state);

  mount(app, topbar(), h('main', { class: 'page' },
    h('a', { class: 'back-link', href: '#/dashboard' }, '→ כל המסלולים'),
    h('div', { class: 'editor-head' },
      h('span', { class: 'editor-icon', 'aria-hidden': 'true' }, state.path.theme.icon),
      titleInput, statusChip,
      h('div', { class: 'row wrap editor-actions' },
        h('a', { class: 'btn small secondary', href: `#/s/${state.path.code}`, target: DEMO ? null : '_blank', rel: 'noopener' }, '👀 תצוגה מקדימה'),
        publishBtn,
        h('button', { class: 'icon-btn', title: 'אפשרויות נוספות', 'aria-label': 'אפשרויות נוספות', onclick: () => moreMenu(state) }, '⋯'))),
    h('nav', { class: 'tabs', role: 'tablist' },
      TABS.map(([key, label]) => h('a', {
        class: `tab${key === tab ? ' active' : ''}`, href: `#/path/${id}/${key}`, role: 'tab', 'aria-selected': String(key === tab),
      }, label))),
    body));
  render();
}

async function savePath(state, patch) {
  try {
    const r = await api('PUT', `/api/paths/${state.path.id}`, patch);
    state.path = r.path;
    return r.path;
  } catch (err) {
    toast(err.message, 'error');
    throw err;
  }
}

function moreMenu(state) {
  const m = modal('אפשרויות', h('div', { class: 'stack' },
    h('button', {
      class: 'btn block', onclick: () => api('POST', `/api/paths/${state.path.id}/duplicate`)
        .then((r) => { setCredits(r.credits); m.close(); toast('נוצר עותק', 'ok'); go(`#/path/${r.path.id}`); })
        .catch((err) => { m.close(); showError(err); }),
    }, `📄 שכפול המסלול${cost('createPath') ? ` (${creditWord(cost('createPath'))})` : ''}`),
    h('button', {
      class: 'btn danger block', onclick: async () => {
        m.close();
        if (!(await confirmDialog(`למחוק את "${state.path.title}"? כל המשימות וההתקדמות של התלמידים יימחקו.`, { okText: 'מחיקה', danger: true }))) return;
        api('DELETE', `/api/paths/${state.path.id}`)
          .then(() => { toast('המסלול נמחק'); go('#/dashboard'); })
          .catch((err) => toast(err.message, 'error'));
      },
    }, '🗑️ מחיקת המסלול')));
}

// ----- tasks tab -----

function tasksTab(body, state) {
  const descInput = h('textarea', {
    rows: 2, maxlength: 1000, value: state.path.description, placeholder: 'כמה מילים שהתלמידים יראו בפתיחת המסלול (לא חובה)',
    onchange: () => savePath(state, { description: descInput.value }).then(() => toast('נשמר', 'ok')).catch(() => {}),
  });
  const list = h('ol', { class: 'task-list' });
  const total = h('span', { class: 'muted' });

  const renderList = () => {
    const mins = state.tasks.reduce((s, t) => s + t.estMinutes, 0);
    total.textContent = state.tasks.length ? `${state.tasks.length} משימות · כ-${mins} דקות` : '';
    if (!state.tasks.length) {
      return mount(list, h('li', { class: 'empty card' },
        h('div', { class: 'empty-icon', 'aria-hidden': 'true' }, '🧩'),
        h('p', {}, 'עוד אין משימות במסלול. כדאי להתחיל במשימות קצרות – 2 עד 10 דקות כל אחת.')));
    }
    mount(list, state.tasks.map((t, i) => taskRow(t, i)));
  };

  const saveOrder = async (ids) => {
    try {
      state.tasks = (await api('PUT', `/api/paths/${state.path.id}/order`, { taskIds: ids })).tasks;
    } catch (err) {
      toast(err.message, 'error');
    }
    renderList();
  };

  const move = (i, delta) => {
    const ids = state.tasks.map((t) => t.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    saveOrder(ids);
  };

  let dragIndex = null;
  const taskRow = (t, i) => {
    const type = TASK_TYPES[t.type];
    const row = h('li', {
      class: 'task-row', draggable: 'true',
      ondragstart: (e) => { dragIndex = i; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; },
      ondragend: () => row.classList.remove('dragging'),
      ondragover: (e) => { e.preventDefault(); row.classList.add('drop-target'); },
      ondragleave: () => row.classList.remove('drop-target'),
      ondrop: (e) => {
        e.preventDefault();
        row.classList.remove('drop-target');
        if (dragIndex === null || dragIndex === i) return;
        const ids = state.tasks.map((x) => x.id);
        const [moved] = ids.splice(dragIndex, 1);
        ids.splice(i, 0, moved);
        dragIndex = null;
        saveOrder(ids);
      },
    },
      h('span', { class: 'drag-handle', 'aria-hidden': 'true', title: 'גוררים כדי לשנות סדר' }, '⠿'),
      h('span', { class: 'task-num' }, i + 1),
      h('span', { class: 'task-emoji', 'aria-hidden': 'true' }, t.emoji || type.icon),
      h('div', { class: 'task-info' },
        h('strong', {}, t.title),
        h('span', { class: 'muted small' }, `${type.name} · ${t.estMinutes} דק׳`, t.needsApproval ? ' · 🧑‍🏫 אישור מורה' : '')),
      h('div', { class: 'task-actions' },
        h('button', { class: 'icon-btn', 'aria-label': 'הזזה למעלה', title: 'למעלה', disabled: i === 0, onclick: () => move(i, -1) }, '▲'),
        h('button', { class: 'icon-btn', 'aria-label': 'הזזה למטה', title: 'למטה', disabled: i === state.tasks.length - 1, onclick: () => move(i, 1) }, '▼'),
        h('button', { class: 'icon-btn', 'aria-label': 'עריכה', title: 'עריכה', onclick: () => taskForm(state, t.type, t, renderList) }, '✏️'),
        h('button', {
          class: 'icon-btn', 'aria-label': 'שכפול', title: 'שכפול', onclick: () => api('POST', `/api/paths/${state.path.id}/tasks`, { ...t, title: `${t.title} (עותק)`.slice(0, 120) })
            .then((r) => { state.tasks.push(r.task); renderList(); toast('המשימה שוכפלה', 'ok'); })
            .catch((err) => toast(err.message, 'error')),
        }, '📄'),
        h('button', {
          class: 'icon-btn', 'aria-label': 'מחיקה', title: 'מחיקה', onclick: async () => {
            if (!(await confirmDialog(`למחוק את המשימה "${t.title}"?`, { okText: 'מחיקה', danger: true }))) return;
            api('DELETE', `/api/tasks/${t.id}`)
              .then(() => { state.tasks = state.tasks.filter((x) => x.id !== t.id); renderList(); })
              .catch((err) => toast(err.message, 'error'));
          },
        }, '🗑️')));
    return row;
  };

  mount(body,
    nikudBar(body.closest('main') || body),
    field('תיאור המסלול', descInput),
    h('div', { class: 'page-head' }, h('h2', {}, 'משימות'), total),
    list,
    h('button', { class: 'btn primary add-task', onclick: () => chooseTaskType(state, renderList) }, '+ הוספת משימה'),
    h('aside', { class: 'tip' }, '💡 טיפ: משימה טובה לתלמידי קשב היא קצרה, עם פעולה אחת ברורה. שלבו משימות תנועה או זמן עבודה מרוכז לסירוגין עם קריאה.'));
  renderList();
}

function chooseTaskType(state, onDone) {
  const m = modal('איזו משימה להוסיף?', TASK_GROUPS.map(([group, label]) => [
    h('h3', { class: 'type-group' }, label),
    h('div', { class: 'type-grid' },
      Object.entries(TASK_TYPES).filter(([, t]) => t.group === group).map(([key, t]) => h('button', {
        class: 'type-card', onclick: () => { m.close(); taskForm(state, key, null, onDone); },
      }, h('span', { class: 'type-icon', 'aria-hidden': 'true' }, t.icon), h('strong', {}, t.name), h('span', { class: 'muted small' }, t.desc)))),
  ]), { wide: true });
}

// Editable list of rows. makeRow(value) returns { el, get }; values() reads all rows.
function rowsEditor(initial, { min, max, makeRow, addLabel = '+ הוספה' }) {
  const rows = h('div', { class: 'stack' });
  const entries = [];
  const addBtn = h('button', { type: 'button', class: 'btn ghost small' }, addLabel);
  const live = () => entries.filter((e) => e.row.isConnected);
  const sync = () => { addBtn.disabled = live().length >= max; };
  const add = (value) => {
    const r = makeRow(value);
    const row = h('div', { class: 'list-row' }, r.el, h('button', {
      type: 'button', class: 'icon-btn', 'aria-label': 'הסרה', title: 'הסרה',
      onclick: () => { if (live().length > min) { row.remove(); sync(); } },
    }, '✕'));
    entries.push({ row, ...r });
    rows.append(row);
    sync();
    return row;
  };
  addBtn.onclick = () => add(undefined).querySelector('input')?.focus();
  const start = initial.length ? initial : Array(min).fill(undefined);
  start.forEach((v, i) => add(v, i));
  const wrap = h('div', { class: 'list-editor' }, rows, addBtn);
  wrap.values = () => live().map((e) => e.get());
  wrap.entries = live;
  return wrap;
}

// List of short strings (answers / steps / words), optionally with a "correct" radio.
function listEditor(items, { placeholder, min, max, correct }) {
  const name = `correct-${Math.random().toString(36).slice(2)}`;
  let i = 0;
  const editor = rowsEditor(items, {
    min, max,
    makeRow: (value = '') => {
      const input = h('input', { type: 'text', value, maxlength: 200, placeholder });
      const radio = correct && h('input', { type: 'radio', name, checked: i++ === (correct.index ?? 0), 'aria-label': 'התשובה הנכונה', title: 'התשובה הנכונה' });
      return {
        el: [radio && h('label', { class: 'correct-pick' }, radio, h('span', { class: 'small' }, 'נכונה')), input],
        get: () => input.value,
        isCorrect: () => radio?.checked,
      };
    },
  });
  editor.getValues = () => editor.values();
  editor.getCorrect = () => {
    const filled = editor.entries().filter((e) => e.get().trim());
    return Math.max(0, filled.findIndex((e) => e.isCorrect()));
  };
  return editor;
}

function pairEditor(pairs, { min, max, placeholderA, placeholderB }) {
  return rowsEditor(pairs, {
    min, max, addLabel: '+ הוספת זוג',
    makeRow: (p = { a: '', b: '' }) => {
      const a = h('input', { type: 'text', value: p.a, maxlength: 120, placeholder: placeholderA });
      const b = h('input', { type: 'text', value: p.b, maxlength: 120, placeholder: placeholderB });
      return { el: [a, h('span', { class: 'pair-sep', 'aria-hidden': 'true' }, '↔'), b], get: () => ({ a: a.value, b: b.value }) };
    },
  });
}

function statementEditor(statements) {
  return rowsEditor(statements, {
    min: 1, max: 10, addLabel: '+ הוספת משפט',
    makeRow: (x = { s: '', t: true }) => {
      let truth = x.t;
      const input = h('input', { type: 'text', value: x.s, maxlength: 300, placeholder: 'משפט' });
      const seg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'האם המשפט נכון?' });
      const render = () => mount(seg, [[true, '✓ נכון'], [false, '✗ לא נכון']].map(([val, label]) => h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(truth === val), class: truth === val ? `on ${val ? 'yes' : 'no'}` : '',
        onclick: () => { truth = val; render(); },
      }, label)));
      render();
      return { el: [input, seg], get: () => ({ s: input.value, t: truth }) };
    },
  });
}

// Sorting task: each group is a name and its items (one per line).
function groupEditor(groups) {
  return rowsEditor(groups, {
    min: 2, max: 4, addLabel: '+ הוספת קבוצה',
    makeRow: (g = { name: '', items: [] }) => {
      const name = h('input', { type: 'text', value: g.name, maxlength: 60, placeholder: 'שם הקבוצה, למשל: חיות ים' });
      const items = h('textarea', { rows: 3, maxlength: 1200, value: g.items.join('\n'), placeholder: 'פריט בכל שורה' });
      return {
        el: h('div', { class: 'group-row' }, name, items),
        get: () => ({ name: name.value, items: items.value.split('\n').map((x) => x.trim()).filter(Boolean) }),
      };
    },
  });
}

// Dictation: each word, with the teacher's own recording of it if she wants.
function dictationEditor(words) {
  return rowsEditor(words, {
    min: 1, max: 12, addLabel: '+ הוספת מילה',
    makeRow: (x = { w: '' }) => {
      const w = h('input', { type: 'text', value: x.w, maxlength: 60, placeholder: 'מילה' });
      const rec = audioField(x.audio || '', { compact: true });
      return { el: [w, rec], get: () => ({ w: w.value, audio: rec.getValue() }) };
    },
  });
}

// Hotspot task: the teacher taps the right places on her picture.
function spotEditor(spots, imageF) {
  let list = spots.map((x) => ({ ...x }));
  let size = list[0]?.r ?? 8;
  const wrap = h('div', { class: 'spot-editor' });
  const render = () => {
    const src = imageF.getValue();
    if (!src) return mount(wrap, h('p', { class: 'notice' }, '👆 קודם מעלים תמונה (למעלה), ואז מסמנים עליה את המקומות הנכונים.'));
    const board = h('div', { class: 'spot-board' },
      h('img', { src, alt: '', draggable: 'false' }),
      list.map((p, i) => h('button', {
        type: 'button', class: 'spot', 'aria-label': `מחיקת מקום ${i + 1}`, title: 'לחיצה מוחקת',
        style: { left: `${p.x}%`, top: `${p.y}%`, width: `${p.r * 2}%`, height: `${p.r * 2}%` },
        onclick: (e) => { e.stopPropagation(); list.splice(i, 1); render(); },
      }, i + 1)));
    board.addEventListener('click', (e) => {
      if (list.length >= 8) return toast('עד 8 מקומות', 'error');
      const r = board.getBoundingClientRect();
      list.push({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100, r: size });
      render();
    });
    const slider = h('input', {
      type: 'range', min: 3, max: 25, value: size, 'aria-label': 'גודל האזור',
      oninput: (e) => { size = Number(e.target.value); list = list.map((p) => ({ ...p, r: size })); board.querySelectorAll('.spot').forEach((el) => { el.style.width = el.style.height = `${size * 2}%`; }); },
    });
    mount(wrap, board, h('div', { class: 'row wrap' }, h('label', { class: 'small' }, 'גודל האזור: ', slider),
      h('span', { class: 'small muted' }, list.length ? `${list.length} מקומות נכונים` : 'לחצו על התמונה כדי לסמן מקום נכון')));
  };
  imageF.addEventListener('media-change', render);
  render();
  wrap.values = () => list;
  return wrap;
}

// Highlight task: the text, and a preview of the words students will need to tap.
function highlightEditor(passageText) {
  const passage = h('textarea', { rows: 4, maxlength: 3000, required: true, value: passageText, placeholder: 'הַיֶּלֶד [רָץ] לַגַּן וְ[שִׂחֵק] בַּנַּדְנֵדָה.' });
  const preview = h('p', { class: 'hl-preview path-font' });
  const draw = () => {
    const nodes = [];
    for (const m of passage.value.matchAll(/\[([^\[\]]+)\]|([^\[\]]+)/g)) nodes.push(m[1] ? h('mark', {}, m[1]) : m[2]);
    mount(preview, nodes.length ? nodes : h('span', { class: 'muted' }, 'כאן תופיע תצוגה מקדימה'));
  };
  passage.addEventListener('input', draw);
  draw();
  const wrap = h('div', {}, passage, preview);
  wrap.getValue = () => passage.value;
  return wrap;
}

function emojiPicker(current, options) {
  let value = current;
  const wrap = h('div', { class: 'emoji-picker', role: 'radiogroup' });
  const render = () => mount(wrap, options.map((e) => h('button', {
    type: 'button', class: `emoji-btn${e === value ? ' selected' : ''}`, role: 'radio', 'aria-checked': String(e === value),
    onclick: () => { value = e === value ? '' : e; render(); wrap.dispatchEvent(new Event('change')); },
  }, e)));
  render();
  wrap.getValue = () => value;
  return wrap;
}

const DEFAULT_TEXT = {
  memory: 'הפכו שני קלפים בכל פעם ומצאו את כל הזוגות.',
  wordsearch: 'מצאו את כל המילים בטבלה. גררו מהאות הראשונה עד האחרונה, או לחצו על האות הראשונה ואז על האחרונה.',
  matching: 'חברו כל פריט לבן הזוג שלו.',
  order: 'סדרו את הפריטים לפי הסדר הנכון.',
  blanks: 'השלימו את המילים החסרות.',
  truefalse: 'קראו כל משפט והחליטו: נכון או לא נכון?',
  lines: 'גררו קו מכל פריט אל בן הזוג שלו.',
  sort: 'גררו כל פריט לקופסה המתאימה (או לחצו על פריט ואז על קופסה).',
  voice: 'לחצו על המיקרופון וספרו במילים שלכם.',
  dictation: 'הקשיבו לכל מילה וכתבו אותה. אפשר לשמוע שוב כמה פעמים שרוצים.',
  photo: 'פתרו במחברת, ואז צלמו את הדף ושלחו.',
  draw: 'ציירו על הלוח. אפשר לבחור צבע ועובי.',
  hotspot: 'לחצו על המקום הנכון בתמונה.',
  highlight: 'סמנו בטקסט את המילים המתאימות.',
  flashcards: 'לחצו על הכרטיס כדי להפוך אותו. ידעתם? מעולה! לא? הוא יחזור עוד פעם.',
};

const TEXT_LABEL = { choice: 'שאלה', question: 'שאלה', voice: 'שאלה' };
const TEXT_PLACEHOLDER = {
  choice: 'השאלה', question: 'השאלה שהתלמידים יענו עליה', voice: 'על מה התלמידים ידברו? למשל: ספרו מה הכי אהבתם בסיפור',
};

// existing: the saved task being edited (or null for a new one). draft: values to show
// instead of the saved ones, e.g. the AI's suggested version, not yet saved.
function taskForm(state, type, existing, onDone, draft = null) {
  const meta = TASK_TYPES[type];
  const src = draft || existing;
  const c = src?.content || {};
  const title = h('input', { type: 'text', required: true, maxlength: 120, value: src?.title || '', placeholder: 'שם קצר וברור למשימה' });
  const text = h('textarea', {
    rows: 3, maxlength: 5000, value: src ? c.text || '' : DEFAULT_TEXT[type] || '',
    placeholder: TEXT_PLACEHOLDER[type] || 'הוראות קצרות ופשוטות',
  });
  const est = h('input', { type: 'number', min: 1, max: 120, value: src?.estMinutes ?? (type === 'timer' ? 10 : 5) });
  const emoji = emojiPicker(src?.emoji ?? meta.icon, TASK_EMOJIS.includes(meta.icon) ? TASK_EMOJIS : [meta.icon, ...TASK_EMOJIS]);

  const extra = [];
  let collect = () => ({});
  if (type === 'link') {
    const url = h('input', { type: 'url', dir: 'ltr', required: true, value: c.url || '', placeholder: 'https://www.youtube.com/watch?v=…' });
    extra.push(field('קישור', url, 'סרטוני יוטיוב יוטמעו ישירות במסך המשימה'));
    collect = () => ({ url: url.value });
  } else if (type === 'choice') {
    const opts = listEditor(c.options || [], { placeholder: 'תשובה', min: 2, max: 6, correct: { index: c.correct ?? 0 } });
    const explanation = h('input', { type: 'text', maxlength: 1000, value: c.explanation || '', placeholder: 'למשל: נכון! כי…' });
    extra.push(field('תשובות – סמנו את הנכונה', opts), field('הסבר אחרי תשובה נכונה (לא חובה)', explanation));
    collect = () => ({ options: opts.getValues().filter((s) => s.trim()), correct: opts.getCorrect(), explanation: explanation.value });
  } else if (type === 'checklist') {
    const items = listEditor(c.items || [], { placeholder: 'צעד קטן', min: 1, max: 15 });
    extra.push(field('הצעדים', items));
    collect = () => ({ items: items.getValues().filter((s) => s.trim()) });
  } else if (type === 'timer') {
    const minutes = h('input', { type: 'number', min: 1, max: 60, value: c.minutes ?? 10 });
    minutes.addEventListener('input', () => { est.value = minutes.value; });
    extra.push(field('אורך זמן העבודה (דקות)', minutes));
    collect = () => ({ minutes: Number(minutes.value) });
  } else if (type === 'memory') {
    const pairs = pairEditor(c.pairs || [], { min: 2, max: 10, placeholderA: 'קלף', placeholderB: 'הקלף התואם (לא חובה)' });
    extra.push(field('זוגות קלפים', pairs, 'כל זוג = שני קלפים. למשל: 🐶 ↔ כלב, 3+4 ↔ 7, cat ↔ חתול. השאירו את הצד השני ריק לקבלת שני קלפים זהים.'));
    collect = () => ({ pairs: pairs.values() });
  } else if (type === 'matching') {
    const pairs = pairEditor(c.pairs || [], { min: 2, max: 8, placeholderA: 'פריט', placeholderB: 'בן הזוג שלו' });
    extra.push(field('זוגות להתאמה', pairs, 'התלמידים יקבלו את הצד השני מעורבב.'));
    collect = () => ({ pairs: pairs.values() });
  } else if (type === 'wordsearch') {
    const words = listEditor(c.words || [], { placeholder: 'מילה', min: 3, max: 10 });
    extra.push(field('מילים להסתרה', words, 'בין 2 ל-10 אותיות למילה. הטבלה נבנית אוטומטית, בלי ניקוד.'));
    collect = () => ({ words: words.getValues().filter((s) => s.trim()) });
  } else if (type === 'order') {
    const items = listEditor(c.items || [], { placeholder: 'פריט', min: 3, max: 10 });
    extra.push(field('הפריטים – בסדר הנכון', items, 'התלמידים יקבלו אותם מעורבבים ויצטרכו לסדר.'));
    collect = () => ({ items: items.getValues().filter((s) => s.trim()) });
  } else if (type === 'blanks') {
    const passage = h('textarea', { rows: 4, maxlength: 3000, required: true, value: c.passage || '', placeholder: 'הַכֶּלֶב [רָץ] בַּגִּנָּה וְ[שִׂחֵק] עִם הַכַּדּוּר.' });
    const distractors = listEditor(c.distractors || [], { placeholder: 'מילה מסיחה', min: 0, max: 8 });
    extra.push(
      field('הטקסט', passage, 'שימו את המילים שהתלמידים צריכים להשלים בסוגריים מרובעים [ ]. המילים יופיעו במחסן מילים מעורבב.'),
      field('מילים מסיחות (לא חובה)', distractors, 'מילים נוספות למחסן, כדי שיהיה מאתגר יותר.'));
    collect = () => ({ passage: passage.value, distractors: distractors.getValues().filter((s) => s.trim()) });
  } else if (type === 'truefalse') {
    const statements = statementEditor(c.statements || []);
    extra.push(field('משפטים', statements));
    collect = () => ({ statements: statements.values() });
  } else if (type === 'lines') {
    const pairs = pairEditor(c.pairs || [], { min: 2, max: 6, placeholderA: 'פריט', placeholderB: 'בן הזוג שלו' });
    extra.push(field('זוגות לחיבור בקו', pairs, 'הפריטים יופיעו בשני טורים, והצד השני מעורבב. התלמידים גוררים קו בין בני הזוג.'));
    collect = () => ({ pairs: pairs.values() });
  } else if (type === 'sort') {
    const groups = groupEditor(c.groups || []);
    extra.push(field('הקבוצות והפריטים שלהן', groups, 'בין 2 ל-4 קבוצות, עד 16 פריטים בסך הכול. התלמידים יקבלו את כל הפריטים מעורבבים.'));
    collect = () => ({ groups: groups.values() });
  } else if (type === 'voice') {
    const secs = h('select', {}, [30, 60, 90, 120, 180].map((n) => h('option', { value: n, selected: n === (c.maxSeconds ?? 60) }, n < 60 ? `${n} שניות` : n === 60 ? 'דקה' : `${n / 60} דקות`)));
    extra.push(field('אורך הקלטה מקסימלי', secs, 'התשובות יופיעו אצלכם בטבלת ההתקדמות, ושם אפשר להקשיב להן. מי שאין לו מיקרופון יוכל לכתוב.'));
    collect = () => ({ maxSeconds: Number(secs.value) });
  } else if (type === 'dictation') {
    const words = dictationEditor(c.words || []);
    extra.push(field('המילים להכתבה', words, 'בלי הקלטה, המחשב יקריא את המילה. הקלטה שלכם ברורה יותר (מומלץ). הבדיקה מתעלמת מניקוד.'));
    collect = () => ({ words: words.values() });
  } else if (type === 'hotspot') {
    // Uses the task's picture field (created below); the editor follows it.
    collect = () => ({ spots: spotsEd.values() });
  } else if (type === 'highlight') {
    const hl = highlightEditor(c.passage || '');
    extra.push(field('הטקסט', hl, 'שימו בסוגריים מרובעים [ ] את המילים שהתלמידים צריכים לסמן. הן לא יופיעו מסומנות אצל התלמידים.'));
    collect = () => ({ passage: hl.getValue() });
  } else if (type === 'photo') {
    extra.push(h('p', { class: 'notice' }, '📷 התלמידים יצלמו את הדף בטלפון או במחשב, ואת התמונה תראו בטבלת ההתקדמות.'));
  } else if (type === 'draw') {
    extra.push(h('p', { class: 'notice' }, '🎨 אם תעלו תמונה, היא תהיה הרקע של לוח הציור (למשל דף צביעה, מפה ריקה או שרטוט להשלמה). את הציורים תראו בטבלת ההתקדמות.'));
  } else if (type === 'flashcards') {
    const cards = pairEditor(c.cards || [], { min: 2, max: 20, placeholderA: 'צד קדמי (מילה, שאלה, תרגיל)', placeholderB: 'צד אחורי (פירוש, תשובה)' });
    extra.push(field('כרטיסיות', cards, 'כרטיסייה שהתלמידים לא ידעו חוזרת בסוף, עד שיודעים את כולן.'));
    collect = () => ({ cards: cards.values() });
  }

  const approval = h('input', { type: 'checkbox', checked: Boolean(src?.needsApproval) });
  const imageF = imageField(c.image || c.imageUrl || '');
  const spotsEd = type === 'hotspot' ? spotEditor(c.spots || [], imageF) : null;
  // A <div>, not field()'s <label>: a click inside a label is passed on to the first button in it.
  if (spotsEd) {
    extra.push(h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'המקומות הנכונים בתמונה'), spotsEd,
      h('span', { class: 'hint' }, 'לחצו על התמונה לסימון מקום נכון, ולחצו על עיגול כדי למחוק אותו. התלמידים יצטרכו למצוא את כולם.')));
  }
  const audioF = audioField(c.audio || '');
  const submit = h('button', { class: 'btn primary', type: 'submit' }, existing ? 'שמירה' : 'הוספה');
  const payloadNow = () => ({
    type, title: title.value, emoji: emoji.getValue(), estMinutes: Number(est.value),
    needsApproval: approval.checked,
    content: { text: text.value, image: imageF.getValue(), audio: audioF.getValue(), ...collect() },
  });
  const improveBtn = h('button', {
    type: 'button', class: 'btn small secondary',
    onclick: () => improveMenu(payloadNow(), (improved) => { m.close(); taskForm(state, type, existing, onDone, improved); }),
  }, '✨ שיפור עם AI');
  const form = h('form', {
    class: 'task-form',
    onsubmit: (e) => {
      e.preventDefault();
      const payload = payloadNow();
      const req = existing
        ? api('PUT', `/api/tasks/${existing.id}`, payload)
        : api('POST', `/api/paths/${state.path.id}/tasks`, payload);
      busy(submit, req.then((r) => {
        if (existing) state.tasks = state.tasks.map((t) => (t.id === r.task.id ? r.task : t));
        else state.tasks.push(r.task);
        m.close();
        onDone();
        toast(existing ? 'המשימה עודכנה' : 'המשימה נוספה', 'ok');
      }).catch((err) => toast(err.message, 'error')));
    },
  },
    field('כותרת', title),
    field(TEXT_LABEL[type] || 'הוראות', text),
    h('div', { class: 'media-row' },
      field(type === 'hotspot' ? 'התמונה' : type === 'draw' ? 'תמונת רקע לציור (לא חובה)' : 'תמונה (לא חובה)', imageF),
      field('ההוראות בקול שלך (לא חובה)', audioF, 'התלמידים ישמעו אותך במקום הקראה ממוחשבת')),
    extra,
    h('div', { class: 'row wrap' }, field('זמן משוער (דקות)', est)),
    h('label', { class: 'toggle approval-toggle' }, approval, h('span', { class: 'toggle-ui', 'aria-hidden': 'true' }),
      h('span', {}, h('strong', {}, '🧑‍🏫 עצירה לאישור המורה'),
        h('span', { class: 'muted small block' }, 'בסוף המשימה התלמידים ממתינים עד שתקלידו את קוד האישור שלכם על המסך שלהם (או תאשרו מטבלת ההתקדמות).'))),
    field('סמל', emoji),
    h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => m.close() }, 'ביטול'), submit));
  form.prepend(h('div', { class: 'form-tools' }, nikudBar(form), improveBtn));
  if (draft) form.prepend(h('div', { class: 'notice ai-draft' }, '✨ זו הגרסה שהציעה הבינה המלאכותית. עברו עליה ושמרו, או סגרו כדי לוותר.'));
  const m = modal(`${meta.icon} ${existing ? 'עריכת' : 'הוספת'} משימה: ${meta.name}`, form, { wide: true });
}

// "Improve with AI": pick what to change; the suggested version opens in the form, unsaved.
const IMPROVE_OPTIONS = [
  ['simpler', '🧒 שפה פשוטה יותר'],
  ['shorter', '✂️ קצר וברור יותר'],
  ['nikud', 'אָ להוסיף ניקוד'],
  ['more', '➕ עוד פריטים'],
  ['easier', '🌱 קל יותר'],
  ['harder', '🚀 מאתגר יותר'],
];

function improveMenu(task, onImproved) {
  const price = cost('aiImprove');
  const custom = h('input', { type: 'text', maxlength: 300, placeholder: 'או כתבו בקשה משלכם, למשל: "להתאים לתלמיד שאוהב כדורגל"' });
  const run = async (kind, btn) => {
    for (const b of m.el.querySelectorAll('button')) b.disabled = true;
    btn.textContent = 'רגע…';
    try {
      const r = await api('POST', '/api/ai/improve-task', { task, kind, custom: kind === 'custom' ? custom.value : '' });
      setCredits(r.credits);
      m.close();
      onImproved(r.task);
    } catch (err) {
      m.close();
      showError(err);
    }
  };
  const m = modal('✨ שיפור המשימה עם AI', [
    h('p', { class: 'muted' }, `מה לשפר? ${price ? `כל שיפור עולה ${creditWord(price)}. ` : ''}התוצאה תיפתח לעריכה, ותישמר רק אם תאשרו.`),
    h('div', { class: 'improve-grid' }, IMPROVE_OPTIONS.map(([kind, label]) => h('button', {
      type: 'button', class: 'btn', onclick: (e) => run(kind, e.currentTarget),
    }, label))),
    h('div', { class: 'row' }, custom, h('button', {
      type: 'button', class: 'btn primary', onclick: (e) => { if (custom.value.trim()) run('custom', e.currentTarget); else custom.focus(); },
    }, 'שיפור')),
  ]);
}

// ----- design tab -----

function designTab(body, state) {
  const theme = { ...state.path.theme };
  const status = h('span', { class: 'save-status muted', 'aria-live': 'polite' });
  const preview = h('div', { class: 'design-preview' });

  const save = debounce(() => {
    status.textContent = 'שומר…';
    savePath(state, { theme })
      .then(() => { status.textContent = 'נשמר ✓'; })
      .catch(() => { status.textContent = 'השמירה נכשלה'; });
  }, 500);

  const changed = () => {
    document.querySelector('.editor-icon').textContent = theme.icon;
    renderControls();
    renderPreview();
    save();
  };
  const set = (key, value) => { theme[key] = value; changed(); };
  const applyPreset = (p) => { Object.assign(theme, p.theme); changed(); toast(`הוחלה ערכת "${p.name}"`, 'ok'); };
  const presetOn = (p) => Object.entries(p.theme).every(([k, val]) => theme[k] === val);

  const swatches = (key, options, renderItem) => h('div', { class: 'swatches', role: 'radiogroup' },
    options.map((o) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(theme[key] === o.value), 'aria-label': o.name, title: o.name,
      class: `swatch${theme[key] === o.value ? ' selected' : ''}`, onclick: () => set(key, o.value),
    }, renderItem(o))));

  const presetSwatch = (p) => {
    const sw = h('span', { class: 'preset-swatch', 'aria-hidden': 'true' }, p.icon);
    applyTheme(sw, { ...THEME_FALLBACK, ...p.theme });
    return sw;
  };

  const controls = h('div', { class: 'design-controls' });
  const renderControls = () => {
    const custom = h('input', { type: 'color', value: theme.color, 'aria-label': 'צבע מותאם', onchange: (e) => set('color', e.target.value) });
    const breakEvery = h('select', { onchange: (e) => set('breakEvery', Number(e.target.value)) },
      [0, 2, 3, 4, 5].map((n) => h('option', { value: n, selected: theme.breakEvery === n }, n ? `אחרי כל ${n} משימות` : 'בלי הפסקות')));
    const breakMinutes = h('select', { disabled: !theme.breakEvery || theme.breakStyle !== 'simple', title: 'בהפסקה מסוג "רעיון ושעון"', onchange: (e) => set('breakMinutes', Number(e.target.value)) },
      [1, 2, 3, 5].map((n) => h('option', { value: n, selected: theme.breakMinutes === n }, `${n} דק׳`)));
    const toggle = (key, label, hint) => h('label', { class: 'toggle' },
      h('input', { type: 'checkbox', checked: theme[key], onchange: (e) => set(key, e.target.checked) }),
      h('span', { class: 'toggle-ui', 'aria-hidden': 'true' }),
      h('span', {}, h('strong', {}, label), hint && h('span', { class: 'muted small block' }, hint)));

    mount(controls,
      h('fieldset', {}, h('legend', {}, 'ערכות עיצוב מוכנות'),
        h('div', { class: 'preset-grid' }, PRESETS.map((p) => h('button', {
          type: 'button', class: `preset${presetOn(p) ? ' selected' : ''}`, 'aria-pressed': String(presetOn(p)), onclick: () => applyPreset(p),
        }, presetSwatch(p), h('span', { class: 'preset-name' }, p.name)))),
        h('p', { class: 'muted small' }, 'ערכה משנה את כל ההגדרות שלמטה בבת אחת. אחר כך אפשר לשנות כל פרט.')),
      h('fieldset', {}, h('legend', {}, 'צבע'),
        h('div', { class: 'row wrap' },
          swatches('color', COLORS, (o) => h('span', { class: 'color-dot', style: { background: o.value } })),
          h('label', { class: 'custom-color' }, custom, h('span', { class: 'small' }, 'אחר')))),
      h('fieldset', {}, h('legend', {}, 'יום או לילה'),
        swatches('mode', MODES, (o) => [h('span', { class: `mode-sample ${o.value}` }, o.icon), h('span', { class: 'small' }, o.name)])),
      h('fieldset', {}, h('legend', {}, 'רקע'),
        swatches('background', BACKGROUNDS, (o) => [h('span', { class: `bg-sample bg-${o.value}` }), h('span', { class: 'small' }, o.name)])),
      h('fieldset', {}, h('legend', {}, 'סמל המסלול'),
        swatches('icon', ICONS.map((i) => ({ value: i, name: i })), (o) => h('span', { class: 'swatch-emoji' }, o.value))),
      h('fieldset', {}, h('legend', {}, 'פונט'),
        swatches('font', FONTS, (o) => [h('span', { class: 'font-sample', style: { fontFamily: `${o.family}, system-ui` } }, 'אבג'), h('span', { class: 'small' }, o.name)])),
      h('fieldset', {}, h('legend', {}, 'צורת המסלול'),
        swatches('map', MAPS, (o) => [h('span', { class: 'swatch-emoji' }, o.icon), h('span', { class: 'small' }, o.name)])),
      h('fieldset', {}, h('legend', {}, 'צורת התחנות'),
        swatches('stations', STATIONS, (o) => [h('span', { class: `shape-sample ${o.value}` }), h('span', { class: 'small' }, o.name)])),
      h('fieldset', {}, h('legend', {}, 'סגנון הכרטיסים'),
        swatches('card', CARDS, (o) => [h('span', { class: `card-sample ${o.value}` }), h('span', { class: 'small' }, o.name)])),
      h('fieldset', {}, h('legend', {}, 'דמות מלווה'),
        swatches('buddy', BUDDIES.map((b) => ({ value: b, name: b || 'בלי דמות' })), (o) => h('span', { class: 'swatch-emoji' }, o.value || '🚫')),
        h('p', { class: 'muted small' }, 'הדמות מלווה את התלמידים במפה ומעודדת אחרי כל משימה.')),
      h('fieldset', {}, h('legend', {}, 'התקדמות, חגיגות והפסקות'),
        h('div', { class: 'stack' },
          h('label', { class: 'toggle' },
            h('input', { type: 'checkbox', checked: theme.order === 'sequential', onchange: (e) => set('order', e.target.checked ? 'sequential' : 'free') }),
            h('span', { class: 'toggle-ui', 'aria-hidden': 'true' }),
            h('span', {}, h('strong', {}, 'משימה אחרי משימה'), h('span', { class: 'muted small block' }, 'המשימה הבאה נפתחת רק אחרי שמסיימים את הקודמת – פחות החלטות, יותר מיקוד'))),
          h('div', { class: 'row wrap' }, field('הפסקת תנועה', breakEvery), field('אורך ההפסקה', breakMinutes),
            field('סוג ההפסקה', h('select', { disabled: !theme.breakEvery, onchange: (e) => set('breakStyle', e.target.value) },
              [['move', '🤸 תנועה מודרכת'], ['calm', '🎈 נשימות והרגעה'], ['simple', '⏱️ רעיון ושעון']].map(([val, label]) => h('option', { value: val, selected: theme.breakStyle === val }, label))))),
          toggle('moods', 'איך אני מרגיש?', 'בתחילת המסלול ובסופו התלמידים בוחרים פרצוף, ואתם רואים את זה בטבלת ההתקדמות'),
          toggle('stickers', 'אלבום מדבקות', 'על כל משימה התלמידים מקבלים מדבקה לאלבום שלהם'),
          toggle('celebrate', 'חגיגה בסיום משימה', 'אנימציה קצרה וכוכב על כל משימה שהושלמה'),
          h('fieldset', { disabled: !theme.celebrate },
            swatches('celebration', CELEBRATIONS, (o) => [h('span', { class: 'swatch-emoji' }, o.icon), h('span', { class: 'small' }, o.name)])),
          toggle('readAloud', 'כפתור הקראה', 'התלמידים יכולים לשמוע את ההוראות בקול'),
          toggle('sound', 'צלילים', 'צליל קצר בהצלחה, בטעות, בתג חדש ובסיום. אפשר להשתיק בכל מכשיר.'))));
  };

  const renderPreview = () => {
    applyTheme(preview, theme);
    const sample = state.tasks.slice(0, 4);
    const stations = sample.length ? sample : [{ title: 'משימה ראשונה', emoji: '📖' }, { title: 'משימה שנייה', emoji: '✏️' }, { title: 'משימה שלישית', emoji: '🤔' }];
    const font = { fontFamily: `${fontFamily(theme.font)}, system-ui` };
    mount(preview,
      h('div', { class: 'preview-label muted small' }, 'כך זה ייראה לתלמידים'),
      h('div', { class: 'preview-screen' },
        h('div', { class: 'preview-title', style: font }, `${theme.icon} ${state.path.title}`),
        h('div', { class: `mini-map map-${theme.map}` },
          stations.map((s, i) => h('div', { class: `mini-station ${i === 0 ? 'done' : i === 1 ? 'current' : 'locked'}` },
            h('span', { class: 'mini-dot' }, i === 0 ? '✓' : s.emoji || '•'),
            h('span', { class: 'mini-title', style: font }, s.title),
            i === 1 && theme.buddy && h('span', { class: 'mini-buddy', 'aria-hidden': 'true' }, theme.buddy))))),
      theme.celebrate && h('div', { class: 'preview-actions' },
        h('button', { type: 'button', class: 'btn small secondary', onclick: () => celebrate(document.body, theme.celebration) }, '🎉 לראות את החגיגה')));
  };

  mount(body, h('div', { class: 'design-layout' },
    h('div', {}, h('div', { class: 'page-head' }, h('h2', {}, 'עיצוב המסלול'), status), controls),
    preview));
  renderControls();
  renderPreview();
}

// ----- share tab -----

// The code the teacher types on a student's screen to approve a task. Hidden until asked
// for, since a teacher's screen is often projected in class.
function pinCard(state, { compact = false } = {}) {
  let shown = false;
  const code = h('div', { class: 'pin-code', dir: 'ltr', 'aria-live': 'polite' });
  const showBtn = h('button', { class: 'btn small ghost' });
  const draw = () => {
    code.textContent = shown ? state.path.approvalPin : '•'.repeat(state.path.approvalPin.length);
    showBtn.textContent = shown ? '🙈 הסתרה' : '👁️ הצגת הקוד';
  };
  showBtn.onclick = () => { shown = !shown; draw(); };
  const custom = h('input', { type: 'text', inputmode: 'numeric', maxlength: 6, placeholder: 'קוד משלך', dir: 'ltr', class: 'pin-input', 'aria-label': 'קוד משלך (4-6 ספרות)' });
  const set = (body) => api('PUT', `/api/paths/${state.path.id}/pin`, body)
    .then((r) => { state.path = r.path; shown = true; custom.value = ''; draw(); toast('קוד האישור עודכן', 'ok'); })
    .catch((err) => toast(err.message, 'error'));
  draw();
  return h('div', { class: `card pin-card${compact ? ' compact' : ''}` },
    h('h3', {}, '🧑‍🏫 קוד אישור המורה'),
    !compact && h('p', { class: 'muted' }, 'במשימות שסימנתם "עצירה לאישור המורה", התלמידים ממתינים עד שתקלידו את הקוד הזה על המסך שלהם. לא לגלות אותו לתלמידים!'),
    h('div', { class: 'row center wrap' }, code, showBtn),
    !compact && h('div', { class: 'row center wrap pin-actions' },
      h('button', { class: 'btn small', onclick: () => set({}) }, '🔄 קוד חדש'),
      custom,
      h('button', { class: 'btn small', onclick: () => set({ pin: custom.value.trim() }) }, 'שמירת הקוד שלי')));
}

function demoShareTab(body, state) {
  mount(body,
    !state.path.published && h('div', { class: 'notice warn' },
      '⚠️ המסלול עדיין בטיוטה. כדי לנסות אותו כמו תלמידים, לחצו קודם על "פרסום לתלמידים" למעלה.'),
    h('div', { class: 'card center demo-share' },
      h('h3', {}, 'קוד המסלול'),
      h('div', { class: 'big-code', dir: 'ltr' }, state.path.code),
      h('p', {}, 'בגרסה המלאה, תלמידים נכנסים מהמחשב או מהטלפון שלהם עם הקוד הזה. בגרסת ההדגמה אפשר לשחק את התלמיד בעצמכם: ההתקדמות תופיע בלשונית "התקדמות".'),
      h('a', { class: 'btn primary big', href: `#/s/${state.path.code}` }, '🎒 כניסה כתלמיד')),
    pinCard(state),
    h('div', { class: 'share-grid' }, scheduleCard(state), libraryShareCard(state)));
}

function shareTab(body, state) {
  if (DEMO) return demoShareTab(body, state);
  const link = `${location.origin}/#/s/${state.path.code}`;
  const copy = (text, what) => navigator.clipboard?.writeText(text)
    .then(() => toast(`${what} הועתק`, 'ok'))
    .catch(() => toast('לא הצלחנו להעתיק – אפשר לסמן ולהעתיק ידנית', 'error'));

  mount(body,
    !state.path.published && h('div', { class: 'notice warn' },
      '⚠️ המסלול עדיין בטיוטה – התלמידים לא יוכלו להיכנס עד שתפרסמו אותו (כפתור "פרסום לתלמידים" למעלה).'),
    h('div', { class: 'share-grid' },
      h('div', { class: 'card center' },
        h('h3', {}, 'קוד המסלול'),
        h('div', { class: 'big-code', dir: 'ltr' }, state.path.code),
        h('p', { class: 'muted' }, `התלמידים נכנסים ל-${location.host} ולוחצים "יש לי קוד"`),
        h('button', { class: 'btn', onclick: () => copy(state.path.code, 'הקוד') }, '📋 העתקת הקוד')),
      h('div', { class: 'card center' },
        h('h3', {}, 'קישור ישיר'),
        h('input', { class: 'link-box', readonly: true, value: link, dir: 'ltr', onfocus: (e) => e.target.select() }),
        h('p', { class: 'muted' }, 'אפשר לשלוח בווטסאפ, במייל או בכיתה הווירטואלית'),
        h('button', { class: 'btn', onclick: () => copy(link, 'הקישור') }, '📋 העתקת הקישור'))),
    pinCard(state),
    h('div', { class: 'share-grid' }, scheduleCard(state), libraryShareCard(state)),
    h('div', { class: 'card print-card' },
      h('div', { class: 'print-icon' }, state.path.theme.icon),
      h('h2', {}, state.path.title),
      h('p', {}, 'נכנסים לאתר ומקלידים את הקוד:'),
      h('div', { class: 'big-code', dir: 'ltr' }, state.path.code),
      h('p', { class: 'muted', dir: 'ltr' }, link)),
    h('div', { class: 'row center' }, h('button', { class: 'btn secondary', onclick: () => window.print() }, '🖨️ הדפסת כרטיס לתלמידים')));
}

// ----- progress tab -----

function progressTab(body, state) {
  const content = h('div', {}, h('p', { class: 'muted' }, 'טוען…'));
  const updated = h('span', { class: 'muted small' });
  const refreshBtn = h('button', { class: 'btn small ghost', onclick: () => load() }, '🔄 רענון');
  mount(body, h('div', { class: 'page-head' }, h('h2', {}, 'התקדמות התלמידים'), h('div', { class: 'row' }, updated, refreshBtn)), content);

  const load = async () => {
    let data;
    try {
      data = await api('GET', `/api/paths/${state.path.id}/progress`);
    } catch (err) {
      return mount(content, h('p', { class: 'error' }, err.message));
    }
    updated.textContent = `עודכן ${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
    renderProgress(content, data, load, state);
  };
  load();
  // Auto-refresh while this tab is on screen.
  const timer = setInterval(() => (body.isConnected ? load() : clearInterval(timer)), 20000);
}

// Tasks where students struggle: many wrong attempts, or much longer than planned.
function stuckTasks(tasks, students, wrong) {
  const out = [];
  for (const t of tasks) {
    const tries = students.map((s) => wrong[s.id]?.[t.id] || 0).filter((n) => n > 0);
    const times = students.map((s) => s.done[t.id]?.durationSec).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
    const median = times.length ? times[Math.floor(times.length / 2)] : null;
    const reasons = [];
    const avg = tries.length ? tries.reduce((a, b) => a + b, 0) / tries.length : 0;
    if (avg >= 2) {
      const n = Number.isInteger(avg) ? avg : avg.toFixed(1);
      reasons.push(`בממוצע ${n} ניסיונות שגויים (אצל ${tries.length} ${tries.length === 1 ? 'מהתלמידים' : 'תלמידים'})`);
    }
    if (median !== null && times.length >= 2 && median > t.estMinutes * 60 * 2) {
      reasons.push(`לוקח בערך ${Math.round(median / 60)} דק׳ במקום ${t.estMinutes}`);
    }
    if (reasons.length) out.push({ t, reasons });
  }
  return out;
}

const minutesLabel = (sec) => (sec < 60 ? 'פחות מדקה' : `${Math.round(sec / 60)} דק׳`);

function renderProgress(el, { tasks, students, help, wrong = {} }, reload, state) {
  if (!students.length) {
    return mount(el, h('div', { class: 'empty card' },
      h('div', { class: 'empty-icon', 'aria-hidden': 'true' }, '👋'),
      h('p', {}, 'עוד אין תלמידים במסלול. שתפו את קוד המסלול בלשונית "שיתוף".')));
  }
  const studentName = (id) => students.find((s) => s.id === id)?.name || '';
  const task = (id) => tasks.find((t) => t.id === id);
  const helpByCell = new Set(help.map((x) => `${x.studentId}:${x.taskId}`));

  const decide = (s, t, decision) => api('POST', `/api/students/${s.id}/tasks/${t.id}/decision`, { decision })
    .then(() => { toast(decision === 'approve' ? `אושר ל${s.name} ✓` : `הוחזר ל${s.name} לתיקון`, 'ok'); reload(); })
    .catch((err) => toast(err.message, 'error'));
  const decisionButtons = (s, t, after = () => {}) => [
    h('button', { class: 'btn small primary', onclick: () => { after(); decide(s, t, 'approve'); } }, 'אישור ✓'),
    h('button', { class: 'btn small ghost', onclick: () => { after(); decide(s, t, 'redo'); } }, 'להחזיר לתיקון'),
  ];

  const showAnswer = (s, t) => {
    const d = s.done[t.id];
    let answer = null;
    if (t.type === 'question') answer = h('blockquote', { class: 'answer' }, d.answer);
    if (t.type === 'choice') answer = h('p', {}, 'התשובה: ', h('strong', {}, t.content.options[d.answer] ?? '—'));
    if (t.type === 'voice') {
      answer = d.answer?.audio
        ? h('div', {}, h('p', {}, 'התשובה בקול:'), h('audio', { class: 'media-audio', src: d.answer.audio, controls: true, preload: 'none' }))
        : h('div', {}, h('p', { class: 'small muted' }, 'לא היה מיקרופון, אז התשובה נכתבה:'), h('blockquote', { class: 'answer' }, d.answer ?? ''));
    }
    if ((t.type === 'photo' || t.type === 'draw') && d.answer?.image) {
      answer = h('a', { href: d.answer.image, target: '_blank', rel: 'noopener' }, h('img', { class: 'answer-image', src: d.answer.image, alt: t.type === 'photo' ? 'הצילום של התלמיד' : 'הציור של התלמיד' }));
    }
    if (t.type === 'flashcards' && d.answer) {
      answer = h('p', {}, d.answer.again
        ? `עבר על כל הכרטיסיות. ${d.answer.again} פעמים לחץ "עוד פעם".`
        : 'ידע את כל הכרטיסיות כבר בסיבוב הראשון 🌟');
    }
    const m = modal(`${s.name} · ${t.title}`, [
      h('p', { class: 'muted' }, `${d.approved === false ? 'הסתיים, מחכה לאישור' : 'הושלם'} · ${formatDate(d.completedAt)}`),
      answer || h('p', {}, d.approved === false ? 'המשימה הושלמה ומחכה לאישור שלך.' : 'המשימה סומנה כהושלמה ✓'),
      d.approved === false && h('div', { class: 'row end' }, decisionButtons(s, t, () => m.close())),
    ]);
  };

  const hiddenFor = (s) => new Set(s.adapt?.hidden || []);
  const tasksFor = (s) => tasks.filter((t) => !hiddenFor(s).has(t.id));
  const done = (s) => tasksFor(s).filter((t) => s.done[t.id] && s.done[t.id].approved !== false).length;
  const pathId = state?.path?.id;
  const pending = students.flatMap((s) => tasks.filter((t) => s.done[t.id]?.approved === false).map((t) => ({ s, t })));
  const stuck = stuckTasks(tasks, students, wrong);
  // Students who said today that they feel worried, sad or angry.
  const today = (ms) => ms && new Date(ms).toDateString() === new Date().toDateString();
  const worried = students.flatMap((s) => ['end', 'start']
    .map((k) => s.moods?.[k]).filter((m) => m && today(m.at) && MOODS.find((x) => x.e === m.mood)?.worry)
    .slice(0, 1).map((m) => ({ s, m })));
  mount(el,
    worried.length > 0 && h('div', { class: 'help-box mood-box' },
      h('h3', {}, '💛 כדאי לבדוק מה שלומם'),
      h('ul', {}, worried.map(({ s, m }) => h('li', {}, h('span', {}, h('strong', {}, s.name), ` · היום: ${m.mood} ${MOODS.find((x) => x.e === m.mood).name}`))))),
    tasks.some((t) => t.needsApproval) && state && pinCard(state, { compact: true }),
    stuck.length > 0 && h('div', { class: 'help-box stuck-box' },
      h('h3', {}, '🔎 איפה נתקעים'),
      h('ul', {}, stuck.map(({ t, reasons }) => h('li', {},
        h('span', {}, h('strong', {}, `${t.emoji || ''} ${t.title}`), ' · ', reasons.join(' · ')),
        h('span', { class: 'muted small' }, 'אולי כדאי לפשט אותה, לפרק לשתיים או להוסיף הקלטה'))))),
    pending.length > 0 && h('div', { class: 'help-box approval-box' },
      h('h3', {}, `🧑‍🏫 ממתינים לאישור (${pending.length})`),
      h('ul', {}, pending.map(({ s, t }) => h('li', {},
        h('span', {}, h('strong', {}, s.name), ' סיימו את ', h('strong', {}, `"${t.title}"`),
          h('span', { class: 'muted small' }, ` · ${formatDate(s.done[t.id].completedAt)}`)),
        h('span', { class: 'row' }, decisionButtons(s, t)))))),
    help.length > 0 && h('div', { class: 'help-box' },
      h('h3', {}, `✋ בקשות עזרה (${help.length})`),
      h('ul', {}, help.map((x) => h('li', {},
        h('span', {}, h('strong', {}, studentName(x.studentId)), ' מבקשים עזרה ב', h('strong', {}, `"${task(x.taskId)?.title}"`),
          h('span', { class: 'muted small' }, ` · ${formatDate(x.createdAt)}`)),
        h('button', {
          class: 'btn small', onclick: () => api('POST', `/api/help/${x.id}/resolve`).then(reload).catch((err) => toast(err.message, 'error')),
        }, 'טופל ✓'))))),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('strong', {}, students.length), h('span', {}, 'תלמידים')),
      h('div', { class: 'stat' }, h('strong', {}, students.filter((s) => tasksFor(s).length && done(s) === tasksFor(s).length).length), h('span', {}, 'סיימו את המסלול')),
      h('div', { class: 'stat' }, h('strong', {}, tasks.length && students.length
        ? `${Math.round((students.reduce((a, s) => a + done(s) / (tasksFor(s).length || 1), 0) / students.length) * 100)}%` : '—'), h('span', {}, 'השלמה ממוצעת'))),
    h('div', { class: 'table-wrap' },
      h('table', { class: 'progress-table' },
        h('thead', {}, h('tr', {},
          h('th', { class: 'sticky' }, 'תלמידים'),
          h('th', {}, 'התקדמות'),
          tasks.map((t, i) => h('th', { title: t.title }, h('span', { class: 'th-task' }, `${i + 1}. ${t.emoji || TASK_TYPES[t.type].icon}`))),
          h('th', {}, 'פעילות אחרונה'),
          h('th', {}, ''))),
        h('tbody', {}, students.map((s) => {
          const mine = tasksFor(s).length;
          const pct = mine ? Math.round((done(s) / mine) * 100) : 0;
          const adapted = hiddenFor(s).size > 0 || (s.adapt?.breakEvery ?? null) !== null;
          return h('tr', {},
            h('th', { class: 'sticky', scope: 'row' }, s.avatar && h('span', { class: 'row-avatar', 'aria-hidden': 'true' }, s.avatar), s.name,
              (s.moods?.start || s.moods?.end) && h('span', {
                class: 'row-mood', title: `איך הרגיש/ה: ${[s.moods.start && `בהתחלה ${s.moods.start.mood}`, s.moods.end && `בסוף ${s.moods.end.mood}`].filter(Boolean).join(', ')}`,
              }, [s.moods.start?.mood, s.moods.end?.mood].filter(Boolean).join('→')),
              adapted && h('span', { class: 'adapted-tag', title: 'מסלול מותאם אישית' }, '⚙️')),
            h('td', {}, h('div', { class: 'mini-progress', title: `${pct}%` }, h('span', { style: { width: `${pct}%` } })), h('span', { class: 'small muted' }, `${done(s)}/${mine}`)),
            tasks.map((t) => {
              if (hiddenFor(s).has(t.id)) return h('td', { class: 'cell hidden-cell', title: 'מוסתרת לתלמיד הזה' }, '—');
              const d = s.done[t.id];
              const needsHelp = helpByCell.has(`${s.id}:${t.id}`);
              const misses = wrong[s.id]?.[t.id] || 0;
              const missBadge = misses > 0 && h('span', { class: `miss-badge${misses >= 3 ? ' many' : ''}`, title: `${misses} ניסיונות שגויים`, dir: 'ltr' }, `✗${misses}`);
              if (d && d.approved === false) {
                return h('td', { class: 'cell pending' }, h('button', {
                  class: 'cell-btn', title: 'מחכה לאישור שלך', 'aria-label': `${t.title}: מחכה לאישור`, onclick: () => showAnswer(s, t),
                }, '⏳'));
              }
              if (d) {
                const hasAnswer = ['question', 'choice', 'voice', 'flashcards', 'photo', 'draw'].includes(t.type);
                const time = Number.isFinite(d.durationSec) ? ` · ${minutesLabel(d.durationSec)}` : '';
                return h('td', { class: 'cell done' }, h('button', {
                  class: 'cell-btn', title: `${hasAnswer ? 'הצגת התשובה' : 'הושלם'}${time}`, 'aria-label': `${t.title}: הושלם${time}`, onclick: () => showAnswer(s, t),
                }, { voice: '🎤', photo: '📷', draw: '🎨' }[t.type] || (hasAnswer ? '💬' : '✓')), missBadge);
              }
              return h('td', { class: `cell${needsHelp ? ' help' : ''}`, title: needsHelp ? 'ביקשו עזרה' : 'עוד לא' }, needsHelp ? '✋' : '', missBadge);
            }),
            h('td', { class: 'small muted' }, formatDate(s.lastActive)),
            h('td', { class: 'row-actions' }, h('button', {
              class: 'icon-btn', 'aria-label': `התאמה אישית ל${s.name}`, title: 'התאמה אישית', onclick: () => adaptDialog(s, tasks, reload),
            }, '⚙️'), pathId && h('a', {
              class: 'icon-btn', href: `#/path/${pathId}/report/${s.id}`, 'aria-label': `דוח של ${s.name}`, title: 'דוח להדפסה',
            }, '🖨️'), h('button', {
              class: 'icon-btn', 'aria-label': `איפוס הסיסמה הסודית של ${s.name}`, title: 'איפוס הסיסמה הסודית', disabled: !s.hasSecret,
              onclick: async () => {
                if (!(await confirmDialog(`לאפס את הסיסמה הסודית של ${s.name}? בכניסה הבאה תיבחר סיסמה חדשה. ההתקדמות נשמרת.`, { okText: 'איפוס' }))) return;
                api('POST', `/api/students/${s.id}/reset-secret`).then(() => { toast('הסיסמה אופסה', 'ok'); reload(); }).catch((err) => toast(err.message, 'error'));
              },
            }, '🔑'), h('button', {
              class: 'icon-btn', 'aria-label': `הסרת ${s.name}`, title: 'הסרה מהמסלול', onclick: async () => {
                if (!(await confirmDialog(`להסיר את ${s.name} מהמסלול? כל ההתקדמות במסלול תימחק.`, { okText: 'הסרה', danger: true }))) return;
                api('DELETE', `/api/students/${s.id}`).then(reload).catch((err) => toast(err.message, 'error'));
              },
            }, '🗑️')));
        })))),
    h('p', { class: 'muted small' }, '✓ הושלם · 💬 יש תשובה (לחיצה לצפייה) · ⏳ מחכה לאישור שלכם · ✋ ביקשו עזרה · ✗ מספר ניסיונות שגויים · — מוסתרת לתלמיד · ⚙️ התאמה אישית'),
    pathId && students.length > 0 && h('div', { class: 'row' }, h('a', { class: 'btn secondary small', href: `#/path/${pathId}/report` }, '🖨️ דוח לכל הכיתה')));
}

// Per-student adaptation: which tasks this student sees, and how often they get a break.
function adaptDialog(s, tasks, reload) {
  const hidden = new Set(s.adapt?.hidden || []);
  const boxes = tasks.map((t) => h('input', { type: 'checkbox', checked: !hidden.has(t.id), value: t.id }));
  const brk = h('select', {},
    [['', 'כמו בכל המסלול'], ['0', 'בלי הפסקות'], ['1', 'אחרי כל משימה'], ['2', 'אחרי כל 2 משימות'], ['3', 'אחרי כל 3 משימות'], ['4', 'אחרי כל 4 משימות']]
      .map(([val, label]) => h('option', { value: val, selected: String(s.adapt?.breakEvery ?? '') === val }, label)));
  const save = h('button', { class: 'btn primary', type: 'submit' }, 'שמירה');
  const m = modal(`⚙️ התאמה אישית ל${s.name}`, h('form', {
    class: 'stack',
    onsubmit: (e) => {
      e.preventDefault();
      const body = { hidden: boxes.filter((b) => !b.checked).map((b) => Number(b.value)), breakEvery: brk.value === '' ? null : Number(brk.value) };
      busy(save, api('PUT', `/api/students/${s.id}/adapt`, body).then(() => { m.close(); toast('נשמר ✓', 'ok'); reload(); })
        .catch((err) => toast(err.message, 'error')));
    },
  },
    h('p', { class: 'muted small' }, 'למשל: פחות משימות למי שמתקשה, או הפסקות לעתים קרובות יותר. השאר רואים את המסלול כרגיל.'),
    h('fieldset', {}, h('legend', {}, 'המשימות שהתלמיד/ה רואה'),
      h('div', { class: 'adapt-list' }, tasks.map((t, i) => h('label', { class: 'check-row' }, boxes[i],
        h('span', {}, `${i + 1}. ${t.emoji || TASK_TYPES[t.type].icon} ${t.title}`)))),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn small ghost', onclick: () => boxes.forEach((b) => { b.checked = true; }) }, 'הכול'))),
    field('הפסקות', brk),
    h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => m.close() }, 'ביטול'), save)));
}
