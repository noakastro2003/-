import { api } from './api.js';
import { h, mount, toast, modal, confirmDialog, field, busy, formatDate, debounce } from './ui.js';
import { session, go } from './app.js';
import { COLORS, BACKGROUNDS, FONTS, MAPS, ICONS, TASK_EMOJIS, TASK_TYPES, TASK_GROUPS, applyTheme, fontFamily } from './themes.js';
import { nikudBar } from './nikud.js';

// ---------- shared chrome ----------

export function topbar(...extra) {
  return h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: session.teacher ? '#/dashboard' : '#/' },
      h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, '〰️'), 'מסלולי למידה'),
    h('div', { class: 'topbar-actions' },
      extra,
      session.teacher && h('span', { class: 'muted hide-sm' }, `שלום, ${session.teacher.name}`),
      session.teacher && h('button', { class: 'btn ghost small', onclick: logout }, 'יציאה')));
}

async function logout() {
  await api('POST', '/api/auth/logout').catch(() => {});
  session.teacher = null;
  go('#/');
}

// ---------- home ----------

export function homePage(app) {
  const features = [
    ['🧩', 'משימות קטנות וברורות', 'מפרקים את הלמידה לצעדים קצרים, עם זמן משוער לכל משימה.'],
    ['🎯', 'משימה אחת בכל פעם', 'מסך ממוקד בלי הסחות, עם התקדמות שרואים על המפה.'],
    ['⏱️', 'שעון והפסקות', 'זמני עבודה מרוכזים והפסקות תנועה מובנות.'],
    ['🎉', 'חיזוקים מיידיים', 'כוכבים וחגיגה קטנה בסיום כל משימה.'],
    ['🎨', 'עיצוב אישי', 'צבעים, רקעים ופונטים בכתב יד – כולל ניקוד.'],
    ['✋', 'כפתור "צריך עזרה"', 'רואים מיד מי נתקע ובאיזו משימה.'],
    ['✨', 'מחולל מסלולים חכם', 'כותבים נושא, שכבת גיל ומטרות, מצרפים חומרים – ומקבלים מסלול מוכן לעריכה.'],
    ['🃏', 'משחקים ותרגולים', 'משחק זיכרון, תפזורת, התאמה, סידור, השלמת מילים ונכון/לא נכון.'],
  ];
  mount(app,
    topbar(h('a', { class: 'btn ghost small', href: '#/login' }, 'כניסה')),
    h('main', { class: 'home' },
      h('section', { class: 'hero' },
        h('h1', {}, 'מסלולי למידה עצמאיים', h('br'), h('span', { class: 'accent' }, 'לתלמידים עם קשיי קשב')),
        h('p', { class: 'lead' }, 'בונים מסלול, מוסיפים משימות, מעצבים – ומשתפים קוד עם הכיתה. התלמידים מתקדמים בקצב שלהם, ואת רואה בדיוק איפה כל אחד נמצא.'),
        h('div', { class: 'row center wrap' },
          h('a', { class: 'btn primary big', href: '#/register' }, 'הרשמה למורות – חינם'),
          h('a', { class: 'btn secondary big', href: '#/join' }, 'אני תלמיד/ה – יש לי קוד'))),
      h('section', { class: 'features' },
        features.map(([icon, title, text]) => h('div', { class: 'feature' },
          h('div', { class: 'feature-icon', 'aria-hidden': 'true' }, icon), h('h3', {}, title), h('p', {}, text))))));
}

// ---------- auth ----------

export function authPage(app, mode) {
  if (session.teacher) return go('#/dashboard');
  const isReg = mode === 'register';
  const name = h('input', { type: 'text', required: true, autocomplete: 'name', maxlength: 80 });
  const email = h('input', { type: 'email', required: true, autocomplete: 'email', dir: 'ltr' });
  const pw = h('input', { type: 'password', required: true, minlength: isReg ? 8 : null, autocomplete: isReg ? 'new-password' : 'current-password', dir: 'ltr' });
  const error = h('p', { class: 'error', role: 'alert' });
  const submit = h('button', { class: 'btn primary block', type: 'submit' }, isReg ? 'יצירת חשבון' : 'כניסה');

  const onSubmit = (e) => {
    e.preventDefault();
    error.textContent = '';
    const body = { email: email.value, password: pw.value };
    if (isReg) body.name = name.value;
    busy(submit, api('POST', `/api/auth/${isReg ? 'register' : 'login'}`, body)
      .then((r) => { session.teacher = r.teacher; go('#/dashboard'); })
      .catch((err) => { error.textContent = err.message; }));
  };

  mount(app, topbar(), h('main', { class: 'center-page' },
    h('form', { class: 'card narrow', onsubmit: onSubmit },
      h('h1', {}, isReg ? 'הרשמה למורות' : 'כניסה למורות'),
      isReg && field('שם מלא', name),
      field('אימייל', email),
      field('סיסמה', pw, isReg ? 'לפחות 8 תווים' : null),
      error, submit,
      h('p', { class: 'muted center' },
        isReg ? 'כבר יש לך חשבון? ' : 'עוד אין לך חשבון? ',
        h('a', { href: isReg ? '#/login' : '#/register' }, isReg ? 'כניסה' : 'הרשמה')))));
}

// ---------- dashboard ----------

export async function dashboardPage(app) {
  const list = h('div', { class: 'path-grid' }, h('p', { class: 'muted' }, 'טוען…'));
  mount(app, topbar(), h('main', { class: 'page' },
    h('div', { class: 'page-head' },
      h('h1', {}, 'המסלולים שלי'),
      h('div', { class: 'row wrap' },
        h('a', { class: 'btn secondary', href: '#/generate' }, '✨ מחולל מסלולים'),
        h('button', { class: 'btn primary', onclick: newPathDialog }, '+ מסלול חדש'))),
    list));

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
      h('p', {}, 'צרי את המסלול הראשון שלך – בעצמך, ממסלול לדוגמה, או עם מחולל המסלולים שבונה מסלול שלם מנושא ומטרות.'),
      h('div', { class: 'row center wrap' },
        h('a', { class: 'btn secondary', href: '#/generate' }, '✨ מחולל מסלולים'),
        h('button', { class: 'btn primary', onclick: newPathDialog }, 'יצירת מסלול בעצמי'))));
  }
  mount(list, paths.map((p) => {
    const card = h('a', { class: 'path-card', href: `#/path/${p.id}` },
      h('div', { class: 'path-card-banner' }, h('span', { class: 'path-card-icon' }, p.theme.icon)),
      h('div', { class: 'path-card-body' },
        h('h3', {}, p.title),
        h('div', { class: 'chips' },
          h('span', { class: `chip ${p.published ? 'chip-ok' : ''}` }, p.published ? 'פורסם' : 'טיוטה'),
          h('span', { class: 'chip' }, `${p.taskCount} משימות`),
          h('span', { class: 'chip' }, `${p.studentCount} תלמידים`),
          p.openHelp > 0 && h('span', { class: 'chip chip-warn' }, `✋ ${p.openHelp} בקשות עזרה`))));
    applyTheme(card, p.theme);
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
  const m = modal('מסלול חדש', h('form', {
    onsubmit: (e) => {
      e.preventDefault();
      busy(submit, api('POST', '/api/paths', { title: title.value, template })
        .then((r) => { m.close(); go(`#/path/${r.path.id}`); })
        .catch((err) => toast(err.message, 'error')));
    },
  }, field('שם המסלול', title), h('div', { class: 'choice-row' }, options), h('div', { class: 'row end' }, submit)));
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
      h('div', { class: 'row' },
        h('a', { class: 'btn small secondary', href: `#/s/${state.path.code}`, target: '_blank', rel: 'noopener' }, '👀 תצוגה מקדימה'),
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
        .then((r) => { m.close(); toast('נוצר עותק', 'ok'); go(`#/path/${r.path.id}`); })
        .catch((err) => toast(err.message, 'error')),
    }, '📄 שכפול המסלול'),
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
      h('span', { class: 'drag-handle', 'aria-hidden': 'true', title: 'גררי כדי לשנות סדר' }, '⠿'),
      h('span', { class: 'task-num' }, i + 1),
      h('span', { class: 'task-emoji', 'aria-hidden': 'true' }, t.emoji || type.icon),
      h('div', { class: 'task-info' },
        h('strong', {}, t.title),
        h('span', { class: 'muted small' }, `${type.name} · ${t.estMinutes} דק׳`)),
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
};

const TEXT_LABEL = { choice: 'שאלה', question: 'שאלה' };
const TEXT_PLACEHOLDER = {
  choice: 'השאלה', question: 'השאלה שהתלמיד/ה יענה/תענה עליה',
};

function taskForm(state, type, existing, onDone) {
  const meta = TASK_TYPES[type];
  const c = existing?.content || {};
  const title = h('input', { type: 'text', required: true, maxlength: 120, value: existing?.title || '', placeholder: 'שם קצר וברור למשימה' });
  const text = h('textarea', {
    rows: 3, maxlength: 5000, value: existing ? c.text || '' : DEFAULT_TEXT[type] || '',
    placeholder: TEXT_PLACEHOLDER[type] || 'הוראות קצרות ופשוטות',
  });
  const est = h('input', { type: 'number', min: 1, max: 120, value: existing?.estMinutes ?? (type === 'timer' ? 10 : 5) });
  const emoji = emojiPicker(existing?.emoji ?? meta.icon, TASK_EMOJIS.includes(meta.icon) ? TASK_EMOJIS : [meta.icon, ...TASK_EMOJIS]);

  const extra = [];
  let collect = () => ({});
  if (type === 'read') {
    const img = h('input', { type: 'url', dir: 'ltr', value: c.imageUrl || '', placeholder: 'https://…' });
    extra.push(field('קישור לתמונה (לא חובה)', img));
    collect = () => ({ imageUrl: img.value });
  } else if (type === 'link') {
    const url = h('input', { type: 'url', dir: 'ltr', required: true, value: c.url || '', placeholder: 'https://www.youtube.com/watch?v=…' });
    extra.push(field('קישור', url, 'סרטוני יוטיוב יוטמעו ישירות במסך המשימה'));
    collect = () => ({ url: url.value });
  } else if (type === 'choice') {
    const opts = listEditor(c.options || [], { placeholder: 'תשובה', min: 2, max: 6, correct: { index: c.correct ?? 0 } });
    const explanation = h('input', { type: 'text', maxlength: 1000, value: c.explanation || '', placeholder: 'למשל: נכון! כי…' });
    extra.push(field('תשובות – סמני את הנכונה', opts), field('הסבר אחרי תשובה נכונה (לא חובה)', explanation));
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
  }

  const submit = h('button', { class: 'btn primary', type: 'submit' }, existing ? 'שמירה' : 'הוספה');
  const form = h('form', {
    class: 'task-form',
    onsubmit: (e) => {
      e.preventDefault();
      const payload = {
        type, title: title.value, emoji: emoji.getValue(), estMinutes: Number(est.value),
        content: { text: text.value, ...collect() },
      };
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
    extra,
    h('div', { class: 'row wrap' }, field('זמן משוער (דקות)', est)),
    field('סמל', emoji),
    h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => m.close() }, 'ביטול'), submit));
  form.prepend(nikudBar(form));
  const m = modal(`${meta.icon} ${existing ? 'עריכת' : 'הוספת'} משימה: ${meta.name}`, form, { wide: true });
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

  const set = (key, value) => {
    theme[key] = value;
    if (key === 'icon') document.querySelector('.editor-icon').textContent = value;
    renderControls();
    renderPreview();
    save();
  };

  const swatches = (key, options, renderItem) => h('div', { class: 'swatches', role: 'radiogroup' },
    options.map((o) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(theme[key] === o.value), 'aria-label': o.name, title: o.name,
      class: `swatch${theme[key] === o.value ? ' selected' : ''}`, onclick: () => set(key, o.value),
    }, renderItem(o))));

  const controls = h('div', { class: 'design-controls' });
  const renderControls = () => {
    const custom = h('input', { type: 'color', value: theme.color, 'aria-label': 'צבע מותאם', onchange: (e) => set('color', e.target.value) });
    const breakEvery = h('select', { onchange: (e) => set('breakEvery', Number(e.target.value)) },
      [0, 2, 3, 4, 5].map((n) => h('option', { value: n, selected: theme.breakEvery === n }, n ? `אחרי כל ${n} משימות` : 'בלי הפסקות')));
    const breakMinutes = h('select', { disabled: !theme.breakEvery, onchange: (e) => set('breakMinutes', Number(e.target.value)) },
      [1, 2, 3, 5].map((n) => h('option', { value: n, selected: theme.breakMinutes === n }, `${n} דק׳`)));
    const toggle = (key, label, hint) => h('label', { class: 'toggle' },
      h('input', { type: 'checkbox', checked: theme[key], onchange: (e) => set(key, e.target.checked) }),
      h('span', { class: 'toggle-ui', 'aria-hidden': 'true' }),
      h('span', {}, h('strong', {}, label), hint && h('span', { class: 'muted small block' }, hint)));

    mount(controls,
      h('fieldset', {}, h('legend', {}, 'צבע'),
        h('div', { class: 'row wrap' },
          swatches('color', COLORS, (o) => h('span', { class: 'color-dot', style: { background: o.value } })),
          h('label', { class: 'custom-color' }, custom, h('span', { class: 'small' }, 'אחר')))),
      h('fieldset', {}, h('legend', {}, 'סמל המסלול'),
        swatches('icon', ICONS.map((i) => ({ value: i, name: i })), (o) => h('span', { class: 'swatch-emoji' }, o.value))),
      h('fieldset', {}, h('legend', {}, 'רקע'),
        swatches('background', BACKGROUNDS, (o) => [h('span', { class: `bg-sample bg-${o.value}` }), h('span', { class: 'small' }, o.name)])),
      h('fieldset', {}, h('legend', {}, 'פונט'),
        swatches('font', FONTS, (o) => [h('span', { class: 'font-sample', style: { fontFamily: `${o.family}, system-ui` } }, 'אבג'), h('span', { class: 'small' }, o.name)])),
      h('fieldset', {}, h('legend', {}, 'צורת המסלול'),
        swatches('map', MAPS, (o) => [h('span', { class: 'swatch-emoji' }, o.icon), h('span', { class: 'small' }, o.name)])),
      h('fieldset', {}, h('legend', {}, 'התקדמות והפסקות'),
        h('div', { class: 'stack' },
          h('label', { class: 'toggle' },
            h('input', { type: 'checkbox', checked: theme.order === 'sequential', onchange: (e) => set('order', e.target.checked ? 'sequential' : 'free') }),
            h('span', { class: 'toggle-ui', 'aria-hidden': 'true' }),
            h('span', {}, h('strong', {}, 'משימה אחרי משימה'), h('span', { class: 'muted small block' }, 'המשימה הבאה נפתחת רק אחרי שמסיימים את הקודמת – פחות החלטות, יותר מיקוד'))),
          h('div', { class: 'row wrap' }, field('הפסקת תנועה', breakEvery), field('אורך ההפסקה', breakMinutes)),
          toggle('celebrate', 'חגיגה בסיום משימה', 'קונפטי וכוכב על כל משימה שהושלמה'),
          toggle('readAloud', 'כפתור הקראה', 'התלמיד/ה יכול/ה לשמוע את ההוראות בקול'))));
  };

  const renderPreview = () => {
    applyTheme(preview, theme);
    const sample = state.tasks.slice(0, 4);
    const stations = sample.length ? sample : [{ title: 'משימה ראשונה', emoji: '📖' }, { title: 'משימה שנייה', emoji: '✏️' }, { title: 'משימה שלישית', emoji: '🤔' }];
    mount(preview,
      h('div', { class: 'preview-label muted small' }, 'כך זה ייראה לתלמידים'),
      h('div', { class: 'preview-screen' },
        h('div', { class: 'preview-title', style: { fontFamily: `${fontFamily(theme.font)}, system-ui` } }, `${theme.icon} ${state.path.title}`),
        h('div', { class: `mini-map map-${theme.map}` },
          stations.map((s, i) => h('div', { class: `mini-station ${i === 0 ? 'done' : i === 1 ? 'current' : 'locked'}` },
            h('span', { class: 'mini-dot' }, i === 0 ? '✓' : s.emoji || '•'),
            h('span', { class: 'mini-title', style: { fontFamily: `${fontFamily(theme.font)}, system-ui` } }, s.title))))));
  };

  mount(body, h('div', { class: 'design-layout' },
    h('div', {}, h('div', { class: 'page-head' }, h('h2', {}, 'עיצוב המסלול'), status), controls),
    preview));
  renderControls();
  renderPreview();
}

// ----- share tab -----

function shareTab(body, state) {
  const link = `${location.origin}/#/s/${state.path.code}`;
  const copy = (text, what) => navigator.clipboard?.writeText(text)
    .then(() => toast(`${what} הועתק`, 'ok'))
    .catch(() => toast('לא הצלחנו להעתיק – סמני והעתיקי ידנית', 'error'));

  mount(body,
    !state.path.published && h('div', { class: 'notice warn' },
      '⚠️ המסלול עדיין בטיוטה – התלמידים לא יוכלו להיכנס עד שתפרסמי אותו (כפתור "פרסום לתלמידים" למעלה).'),
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
    renderProgress(content, data, load);
  };
  load();
  // Auto-refresh while this tab is on screen.
  const timer = setInterval(() => (body.isConnected ? load() : clearInterval(timer)), 20000);
}

function renderProgress(el, { tasks, students, help }, reload) {
  if (!students.length) {
    return mount(el, h('div', { class: 'empty card' },
      h('div', { class: 'empty-icon', 'aria-hidden': 'true' }, '👋'),
      h('p', {}, 'עוד אף תלמיד/ה לא הצטרפ/ה. שתפי את קוד המסלול בלשונית "שיתוף".')));
  }
  const studentName = (id) => students.find((s) => s.id === id)?.name || '';
  const task = (id) => tasks.find((t) => t.id === id);
  const helpByCell = new Set(help.map((x) => `${x.studentId}:${x.taskId}`));

  const showAnswer = (s, t) => {
    const d = s.done[t.id];
    let answer = null;
    if (t.type === 'question') answer = h('blockquote', { class: 'answer' }, d.answer);
    if (t.type === 'choice') answer = h('p', {}, 'ענה/תה: ', h('strong', {}, t.content.options[d.answer] ?? '—'));
    modal(`${s.name} · ${t.title}`, [
      h('p', { class: 'muted' }, `הושלם ${formatDate(d.completedAt)}`),
      answer || h('p', {}, 'המשימה סומנה כהושלמה ✓'),
    ]);
  };

  const done = (s) => tasks.filter((t) => s.done[t.id]).length;
  mount(el,
    help.length > 0 && h('div', { class: 'help-box' },
      h('h3', {}, `✋ בקשות עזרה (${help.length})`),
      h('ul', {}, help.map((x) => h('li', {},
        h('span', {}, h('strong', {}, studentName(x.studentId)), ' צריך/ה עזרה ב', h('strong', {}, `"${task(x.taskId)?.title}"`),
          h('span', { class: 'muted small' }, ` · ${formatDate(x.createdAt)}`)),
        h('button', {
          class: 'btn small', onclick: () => api('POST', `/api/help/${x.id}/resolve`).then(reload).catch((err) => toast(err.message, 'error')),
        }, 'טופל ✓'))))),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('strong', {}, students.length), h('span', {}, 'תלמידים')),
      h('div', { class: 'stat' }, h('strong', {}, students.filter((s) => tasks.length && done(s) === tasks.length).length), h('span', {}, 'סיימו את המסלול')),
      h('div', { class: 'stat' }, h('strong', {}, tasks.length ? `${Math.round(students.reduce((a, s) => a + done(s), 0) / (students.length * tasks.length) * 100)}%` : '—'), h('span', {}, 'השלמה ממוצעת'))),
    h('div', { class: 'table-wrap' },
      h('table', { class: 'progress-table' },
        h('thead', {}, h('tr', {},
          h('th', { class: 'sticky' }, 'תלמיד/ה'),
          h('th', {}, 'התקדמות'),
          tasks.map((t, i) => h('th', { title: t.title }, h('span', { class: 'th-task' }, `${i + 1}. ${t.emoji || TASK_TYPES[t.type].icon}`))),
          h('th', {}, 'פעילות אחרונה'),
          h('th', {}, ''))),
        h('tbody', {}, students.map((s) => {
          const pct = tasks.length ? Math.round((done(s) / tasks.length) * 100) : 0;
          return h('tr', {},
            h('th', { class: 'sticky', scope: 'row' }, s.name),
            h('td', {}, h('div', { class: 'mini-progress', title: `${pct}%` }, h('span', { style: { width: `${pct}%` } })), h('span', { class: 'small muted' }, `${done(s)}/${tasks.length}`)),
            tasks.map((t) => {
              const d = s.done[t.id];
              const needsHelp = helpByCell.has(`${s.id}:${t.id}`);
              if (d) {
                const hasAnswer = t.type === 'question' || t.type === 'choice';
                return h('td', { class: 'cell done' }, h('button', {
                  class: 'cell-btn', title: hasAnswer ? 'הצגת התשובה' : 'הושלם', 'aria-label': `${t.title}: הושלם`, onclick: () => showAnswer(s, t),
                }, hasAnswer ? '💬' : '✓'));
              }
              return h('td', { class: `cell${needsHelp ? ' help' : ''}`, title: needsHelp ? 'מבקש/ת עזרה' : 'עוד לא' }, needsHelp ? '✋' : '');
            }),
            h('td', { class: 'small muted' }, formatDate(s.lastActive)),
            h('td', {}, h('button', {
              class: 'icon-btn', 'aria-label': `הסרת ${s.name}`, title: 'הסרה מהמסלול', onclick: async () => {
                if (!(await confirmDialog(`להסיר את ${s.name} מהמסלול? ההתקדמות שלו/ה תימחק.`, { okText: 'הסרה', danger: true }))) return;
                api('DELETE', `/api/students/${s.id}`).then(reload).catch((err) => toast(err.message, 'error'));
              },
            }, '🗑️')));
        })))),
    h('p', { class: 'muted small' }, '✓ הושלם · 💬 יש תשובה (לחצי לצפייה) · ✋ ביקש/ה עזרה'));
}
