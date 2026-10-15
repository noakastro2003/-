import { api } from './api.js';
import { h, mount, toast, field } from './ui.js';
import { go } from './app.js';
import { TASK_TYPES } from './themes.js';

const YOUNG = ['גן', 'א׳', 'ב׳'];
const ACCEPT = '.pdf,.docx,.txt,.md,.csv,image/png,image/jpeg,image/gif,image/webp';
const MAX_FILES = 5;
const MAX_FILE_MB = 10;
const MAX_TOTAL_MB = 20;

const LOADING_STEPS = [
  ['📚', 'קוראים את הנושא והחומרים…'],
  ['🧩', 'מפרקים את הלמידה לצעדים קטנים…'],
  ['🃏', 'בונים משחקים ותרגולים…'],
  ['⏱️', 'מתזמנים זמני עבודה והפסקות…'],
  ['🎨', 'בוחרים צבעים וסמלים…'],
  ['✅', 'בודקים שהכול מדויק…'],
];

const readAsBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(new Error(`לא הצלחנו לקרוא את "${file.name}"`));
  r.readAsDataURL(file);
});

const sizeLabel = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`);

export async function generatorPage(app, topbar) {
  let status;
  try {
    status = await api('GET', '/api/ai/status');
  } catch (err) {
    if (err.status === 401) return go('#/login');
    return mount(app, topbar(), h('main', { class: 'page' }, h('p', { class: 'error' }, err.message)));
  }

  const files = [];
  let grade = 'ג׳';
  let nikudTouched = false;
  const selectedTypes = new Set(status.types);

  const topic = h('input', { type: 'text', required: true, maxlength: 200, placeholder: 'למשל: מחזור המים, שברים פשוטים, האות מ׳, מלחמת העצמאות' });
  const goals = h('textarea', { rows: 3, maxlength: 2000, placeholder: 'מה התלמידים צריכים לדעת או לעשות בסוף? למשל: להכיר את שלבי מחזור המים ולהסביר כל שלב במילים שלהם' });
  const notes = h('textarea', { rows: 2, maxlength: 2000, placeholder: 'למשל: חלק מהתלמידים מתקשים בקריאה, הם אוהבים כדורגל, יש להם 30 דקות' });
  const count = h('input', { type: 'range', min: 3, max: 12, value: 7, 'aria-label': 'מספר משימות' });
  const countLabel = h('strong', { class: 'range-value' }, '7');
  count.addEventListener('input', () => { countLabel.textContent = count.value; });
  const nikud = h('input', { type: 'checkbox', onchange: () => { nikudTouched = true; } });

  const gradeRow = h('div', { class: 'grade-chips', role: 'radiogroup', 'aria-label': 'שכבת גיל' });
  const renderGrades = () => mount(gradeRow, status.grades.map((g) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(g === grade), class: `grade-chip${g === grade ? ' selected' : ''}`,
    onclick: () => {
      grade = g;
      if (!nikudTouched) nikud.checked = YOUNG.includes(g);
      renderGrades();
    },
  }, g)));
  renderGrades();
  nikud.checked = YOUNG.includes(grade);

  const typeRow = h('div', { class: 'type-chips' });
  const renderTypes = () => mount(typeRow, status.types.map((t) => {
    const on = selectedTypes.has(t);
    return h('button', {
      type: 'button', class: `type-chip${on ? ' selected' : ''}`, 'aria-pressed': String(on),
      onclick: () => { if (on) selectedTypes.delete(t); else selectedTypes.add(t); renderTypes(); },
    }, h('span', { 'aria-hidden': 'true' }, TASK_TYPES[t].icon), ' ', TASK_TYPES[t].name);
  }));
  renderTypes();

  // ----- files -----
  const fileInput = h('input', { type: 'file', multiple: true, accept: ACCEPT, hidden: true, onchange: (e) => { addFiles(e.target.files); e.target.value = ''; } });
  const fileList = h('ul', { class: 'file-list' });
  const renderFiles = () => mount(fileList, files.map((f, i) => h('li', {},
    h('span', { 'aria-hidden': 'true' }, f.type.startsWith('image/') ? '🖼️' : /pdf/.test(f.type) || /\.pdf$/i.test(f.name) ? '📕' : '📄'),
    h('span', { class: 'file-name' }, f.name),
    h('span', { class: 'muted small' }, sizeLabel(f.size)),
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': `הסרת ${f.name}`, onclick: () => { files.splice(i, 1); renderFiles(); } }, '✕'))));
  const addFiles = (list) => {
    for (const f of list) {
      if (files.length >= MAX_FILES) { toast(`אפשר לצרף עד ${MAX_FILES} קבצים`, 'error'); break; }
      if (f.size > MAX_FILE_MB * 1024 * 1024) { toast(`"${f.name}" גדול מ-${MAX_FILE_MB}MB`, 'error'); continue; }
      if (files.reduce((s, x) => s + x.size, 0) + f.size > MAX_TOTAL_MB * 1024 * 1024) { toast(`כל הקבצים יחד עד ${MAX_TOTAL_MB}MB`, 'error'); break; }
      files.push(f);
    }
    renderFiles();
  };
  const drop = h('div', {
    class: 'dropzone', role: 'button', tabindex: 0,
    onclick: () => fileInput.click(),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } },
    ondragover: (e) => { e.preventDefault(); drop.classList.add('over'); },
    ondragleave: () => drop.classList.remove('over'),
    ondrop: (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); },
  },
    h('div', { class: 'dropzone-icon', 'aria-hidden': 'true' }, '📎'),
    h('strong', {}, 'גררו לכאן קבצים או לחצו לבחירה'),
    h('span', { class: 'muted small' }, `דפי עבודה, סיכומים, פרק מהספר · PDF, Word, תמונות או טקסט · עד ${MAX_FILES} קבצים`));

  const submit = h('button', { class: 'btn primary big', type: 'submit', disabled: !status.enabled }, '✨ צרו לי מסלול');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!topic.value.trim()) return topic.focus();
    if (selectedTypes.size < 2) return toast('בחרו לפחות שני סוגי משימות', 'error');
    const overlay = loadingOverlay();
    try {
      const payload = {
        topic: topic.value, grade, goals: goals.value, notes: notes.value,
        taskCount: Number(count.value), types: [...selectedTypes], nikud: nikud.checked,
        files: await Promise.all(files.map(async (f) => ({ name: f.name, type: f.type, data: await readAsBase64(f) }))),
      };
      const r = await api('POST', '/api/ai/generate', payload);
      overlay.done();
      toast(`המסלול מוכן – ${r.taskCount} משימות! עברו עליו לפני הפרסום 🎉`, 'ok');
      if (r.skipped) setTimeout(() => toast(`${r.skipped} משימות לא עברו בדיקה ולא נוספו`, 'info'), 1200);
      go(`#/path/${r.path.id}`);
    } catch (err) {
      overlay.done();
      toast(err.message, 'error');
    }
  };

  mount(app, topbar(), h('main', { class: 'page narrow-page' },
    h('a', { class: 'back-link', href: '#/dashboard' }, '→ כל המסלולים'),
    h('div', { class: 'gen-hero' },
      h('span', { class: 'gen-hero-icon', 'aria-hidden': 'true' }, '✨'),
      h('div', {},
        h('h1', {}, 'מחולל מסלולים'),
        h('p', { class: 'muted' }, 'מספרים על השיעור – והבינה המלאכותית בונה מסלול מלא: הסברים קצרים, משחקים, שאלות, זמני עבודה והפסקות. המסלול נשמר כטיוטה, ואת עוברת עליו ומתקנת לפני שהתלמידים רואים אותו.'))),
    !status.enabled && h('div', { class: 'notice warn' },
      '⚠️ המחולל עוד לא הופעל בשרת הזה. כדי להפעיל אותו, מנהל/ת המערכת צריך/ה להגדיר מפתח API של Anthropic במשתנה הסביבה ANTHROPIC_API_KEY ולהפעיל מחדש את השרת.'),
    h('form', { class: 'card gen-form', onsubmit: onSubmit },
      field('על מה המסלול?', topic),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'שכבת גיל'), gradeRow),
      field('מטרות הלמידה', goals, 'לא חובה, אבל עוזר מאוד לדייק'),
      h('div', { class: 'field' },
        h('span', { class: 'field-label' }, 'כמה משימות? ', countLabel),
        count,
        h('span', { class: 'hint' }, 'כל משימה 2–8 דקות. ל-30 דקות מתאימות בערך 6–7 משימות.')),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'אילו סוגי משימות?'), typeRow),
      h('label', { class: 'toggle gen-toggle' }, nikud, h('span', { class: 'toggle-ui', 'aria-hidden': 'true' }),
        h('span', {}, h('strong', {}, 'ניקוד מלא'), h('span', { class: 'muted small block' }, 'כל הטקסט לתלמידים יהיה מנוקד (מומלץ לגן–ב׳)'))),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'חומרי לימוד (לא חובה)'), drop, fileInput, fileList),
      field('עוד משהו שכדאי לדעת?', notes),
      h('p', { class: 'muted small privacy' }, '🔒 הנושא והקבצים נשלחים לעיבוד אצל Anthropic (Claude). אל תצרפי מידע אישי על תלמידים.'),
      h('div', { class: 'row center' }, submit))));
  topic.focus();
}

function loadingOverlay() {
  let i = 0;
  const icon = h('div', { class: 'gen-loading-icon', 'aria-hidden': 'true' }, LOADING_STEPS[0][0]);
  const text = h('p', { class: 'gen-loading-text' }, LOADING_STEPS[0][1]);
  const overlay = h('div', { class: 'overlay gen-loading', role: 'alertdialog', 'aria-live': 'polite', 'aria-label': 'יוצרים את המסלול' },
    h('div', { class: 'card center' },
      icon,
      h('h2', {}, 'בונים לך מסלול…'),
      text,
      h('div', { class: 'gen-progress' }, h('span')),
      h('p', { class: 'muted small' }, 'זה לוקח בדרך כלל דקה או שתיים. אפשר להשאיר את החלון פתוח.')));
  document.body.append(overlay);
  const timer = setInterval(() => {
    i = (i + 1) % LOADING_STEPS.length;
    [icon.textContent, text.textContent] = LOADING_STEPS[i];
  }, 5000);
  return { done: () => { clearInterval(timer); overlay.remove(); } };
}
