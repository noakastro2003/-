// The class home page for students: one login, then every path the teacher assigned.
import { api } from './api.js';
import { h, mount, toast, storage } from './ui.js';
import { go } from './app.js';
import { applyTheme } from './themes.js';
import { showJoin, frame, FROM_CLASS_KEY } from './student.js';

const CLASS_THEME = {
  color: '#6c5ce7', background: 'dots', font: 'rounded', mode: 'light', stations: 'circle', card: 'soft', icon: '🏫', buddy: '',
};
const tokenKey = (code) => `lp-class-${code}`;

export async function classPage(app, code) {
  document.body.className = 'student-body';
  app.className = 'student';
  applyTheme(app, CLASS_THEME);
  mount(app, h('div', { class: 'center-page' }, h('div', { class: 'loader', 'aria-label': 'טוען' })));

  let data;
  try {
    data = await api('GET', `/api/c/${code}`);
  } catch (err) {
    return mount(app, h('main', { class: 'center-page kid' }, h('div', { class: 'card narrow center' },
      h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, '🤷'),
      h('h1', {}, err.status === 404 ? 'לא מצאנו את הכיתה' : 'אופס!'),
      h('p', {}, err.status === 404 ? 'בדקו שהקוד נכון, או בקשו אותו שוב מהמורה.' : err.message),
      h('a', { class: 'btn primary', href: '#/join' }, 'לנסות קוד אחר'))));
  }

  // A stand-in for the path state that the shared join screens expect.
  const s = {
    app, code, isClass: true, theme: CLASS_THEME, preview: false, tasks: [],
    path: { title: data.class.name, description: 'כל המסלולים של הכיתה במקום אחד' },
    joinIntro: `${data.paths.length} ${data.paths.length === 1 ? 'מסלול מחכה' : 'מסלולים מחכים'} לכם`,
    joinBase: `/api/c/${code}`,
    join: data.join,
    onJoined: (r) => { storage(tokenKey(code), r.token); home(s, data, r); },
  };

  const token = storage(tokenKey(code));
  if (token) {
    try {
      return home(s, data, await api('GET', `/api/c/${code}/me`, undefined, { 'X-Class-Token': token }));
    } catch (err) {
      if (err.status !== 401) toast(err.message, 'error');
      storage(tokenKey(code), null);
    }
  }
  showJoin(s);
}

function home(s, data, me) {
  const token = storage(tokenKey(s.code));
  const open = async (p, btn) => {
    btn.disabled = true;
    try {
      const r = await api('POST', `/api/c/${s.code}/paths/${p.id}/enter`, {}, { 'X-Class-Token': token });
      storage(`lp-student-${r.code}`, r.token);
      storage(FROM_CLASS_KEY, s.code);
      go(`#/s/${r.code}`);
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  };
  const card = (p) => {
    const done = me.done[p.id] || 0;
    const pct = p.taskCount ? Math.round((done / p.taskCount) * 100) : 0;
    const finished = p.taskCount > 0 && done >= p.taskCount;
    const btn = h('button', { class: 'class-path', style: { '--accent': p.color }, onclick: (e) => open(p, e.currentTarget) },
      h('span', { class: 'class-path-icon', 'aria-hidden': 'true' }, p.icon),
      h('span', { class: 'class-path-body' },
        h('strong', { class: 'path-font' }, p.title),
        h('span', { class: 'class-path-bar', 'aria-hidden': 'true' }, h('span', { style: { width: `${pct}%` } })),
        h('span', { class: 'small' }, finished ? '🏆 סיימתם!' : done ? `${done} מתוך ${p.taskCount} · ממשיכים ←` : `${p.taskCount} משימות · מתחילים ←`)));
    return h('li', {}, btn);
  };
  frame(s,
    h('header', { class: 'kid-header' },
      h('div', { class: 'kid-hello path-font' }, `${me.member.avatar || '🏫'} היי ${me.member.name}!`),
      h('button', {
        class: 'btn ghost small', onclick: () => { storage(tokenKey(s.code), null); showJoin(s); },
      }, 'זה לא אני')),
    h('main', { class: 'kid-main' },
      h('h1', { class: 'path-title path-font' }, data.class.name),
      h('p', { class: 'center muted' }, 'בחרו מסלול:'),
      data.paths.length
        ? h('ul', { class: 'class-paths' }, data.paths.map(card))
        : h('div', { class: 'card center' }, h('p', {}, 'עוד אין מסלולים בכיתה. נסו שוב מאוחר יותר!'))));
}
