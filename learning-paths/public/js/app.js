import { api } from './api.js';
import { h, mount } from './ui.js';
import { homePage, authPage, dashboardPage, editorPage } from './teacher.js';
import { studentPage, joinCodePage } from './student.js';

const app = document.getElementById('app');
export const session = { teacher: null, loaded: false };

export function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

async function loadSession() {
  if (session.loaded) return;
  try {
    session.teacher = (await api('GET', '/api/auth/me')).teacher;
  } catch {
    session.teacher = null;
  }
  session.loaded = true;
}

const routes = [
  [/^#?\/?$/, () => (session.teacher ? go('#/dashboard') : homePage(app))],
  [/^#\/login$/, () => authPage(app, 'login')],
  [/^#\/register$/, () => authPage(app, 'register')],
  [/^#\/join$/, () => joinCodePage(app)],
  [/^#\/s\/([A-Za-z0-9]+)$/, (m) => studentPage(app, m[1].toUpperCase())],
  [/^#\/dashboard$/, () => needTeacher(() => dashboardPage(app))],
  [/^#\/path\/(\d+)(?:\/(tasks|design|share|progress))?$/, (m) => needTeacher(() => editorPage(app, Number(m[1]), m[2] || 'tasks'))],
];

function needTeacher(fn) {
  if (!session.teacher) return go('#/login');
  return fn();
}

let renderSeq = 0;
export async function render() {
  const seq = ++renderSeq;
  await loadSession();
  if (seq !== renderSeq) return;
  window.scrollTo(0, 0);
  document.body.className = '';
  app.removeAttribute('style');
  app.className = '';
  for (const [re, fn] of routes) {
    const m = location.hash.match(re);
    if (m) return fn(m);
  }
  mount(app, h('div', { class: 'center-page' },
    h('div', { class: 'card narrow' },
      h('h1', {}, 'העמוד לא נמצא 🧭'),
      h('a', { class: 'btn primary', href: '#/' }, 'לדף הבית'))));
}

window.addEventListener('hashchange', render);
render();
