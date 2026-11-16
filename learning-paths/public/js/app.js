import { api } from './api.js';
import { h, mount } from './ui.js';
import { homePage, authPage, forgotPage, resetPage, dashboardPage, editorPage, topbar } from './teacher.js';
import { generatorPage } from './generator.js';
import { billingPage } from './plan.js';
import { studentPage, joinCodePage } from './student.js';
import { classPage } from './classroom.js';
import { classAdminPage } from './classes.js';
import { libraryPage, reportPage } from './library.js';
import { adminPage } from './adminpage.js';
import { settingsPage } from './settings.js';
import { legalPage } from './legal.js';
import { parentPage } from './family.js';

const app = document.getElementById('app');
export const session = { teacher: null, loaded: false };

export function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

async function loadSession() {
  if (session.loaded) return;
  try {
    const me = await api('GET', '/api/auth/me');
    session.teacher = me.teacher;
    session.costs = me.costs || {};
  } catch {
    session.teacher = null;
  }
  session.loaded = true;
}

const routes = [
  [/^#?\/?$/, () => (session.teacher ? go('#/dashboard') : homePage(app))],
  [/^#\/login$/, () => authPage(app, 'login')],
  [/^#\/register(?:\?.*)?$/, () => authPage(app, 'register')],
  [/^#\/settings$/, () => needTeacher(() => settingsPage(app, topbar))],
  [/^#\/admin$/, () => needTeacher(() => adminPage(app, topbar))],
  [/^#\/legal\/(privacy|terms|accessibility)$/, (m) => legalPage(app, m[1])],
  [/^#\/p\/([A-Za-z0-9_-]{20,40})$/, (m) => parentPage(app, m[1])],
  [/^#\/forgot$/, () => forgotPage(app)],
  [/^#\/reset\/([0-9a-f]{64})$/, (m) => resetPage(app, m[1])],
  [/^#\/join$/, () => joinCodePage(app)],
  [/^#\/s\/([A-Za-z0-9]+)$/, (m) => studentPage(app, m[1].toUpperCase())],
  [/^#\/c\/([A-Za-z0-9]+)$/, (m) => classPage(app, m[1].toUpperCase())],
  [/^#\/class\/(\d+)$/, (m) => needTeacher(() => classAdminPage(app, Number(m[1]), topbar))],
  [/^#\/dashboard$/, () => needTeacher(() => dashboardPage(app))],
  [/^#\/generate$/, () => needTeacher(() => generatorPage(app, topbar))],
  [/^#\/billing$/, () => needTeacher(() => billingPage(app, topbar))],
  [/^#\/library$/, () => needTeacher(() => libraryPage(app, topbar))],
  [/^#\/path\/(\d+)\/report(?:\/(\d+))?$/, (m) => needTeacher(() => reportPage(app, topbar, Number(m[1]), m[2] ? Number(m[2]) : null))],
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
  document.documentElement.classList.remove('rd-calm-on'); // a student's reading settings end with the student screen
  document.documentElement.style.fontSize = '';
  // Student screens fill the page; everywhere else the legal links sit at the bottom.
  document.getElementById('site-footer').hidden = /^#\/(s|c)\//.test(location.hash);
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
