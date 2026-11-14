import { api } from './api.js';
import { h, mount, toast, storage } from './ui.js';
import { go } from './app.js';
import { TASK_TYPES, BREAK_IDEAS, applyTheme, youtubeEmbed } from './themes.js';
import { GAMES, gameSpeech } from './games.js';
import { DEMO } from './env.js';
import { play, setPathSound, muted, setMuted } from './sound.js';

// ---------- code entry ----------

export function joinCodePage(app) {
  const input = h('input', {
    class: 'code-input', type: 'text', maxlength: 8, autocomplete: 'off', autocapitalize: 'characters',
    dir: 'ltr', placeholder: 'ABC123', 'aria-label': 'קוד המסלול',
  });
  mount(app, h('main', { class: 'center-page kid' },
    h('form', {
      class: 'card narrow center', onsubmit: (e) => {
        e.preventDefault();
        const code = input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!code) return;
        // One box for both: a class code opens the class, anything else is tried as a path code.
        api('GET', `/api/c/${code}`)
          .then(() => go(`#/c/${code}`))
          .catch(() => { storage(FROM_CLASS_KEY, null); go(`#/s/${code}`); });
      },
    },
      h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, '🗺️'),
      h('h1', {}, 'מה הקוד של המסלול?'),
      h('p', { class: 'muted' }, 'את הקוד קיבלת מהמורה'),
      input,
      h('button', { class: 'btn primary big block', type: 'submit' }, 'יאללה!'),
      h('a', { class: 'muted small', href: '#/' }, 'חזרה'))));
  input.focus();
}

// ---------- path player ----------

const tokenKey = (code) => `lp-student-${code}`;

export async function studentPage(app, code) {
  document.body.className = 'student-body';
  app.className = 'student';
  mount(app, h('div', { class: 'center-page' }, h('div', { class: 'loader', 'aria-label': 'טוען' })));

  let data;
  try {
    data = await api('GET', `/api/s/${code}`);
  } catch (err) {
    return mount(app, h('main', { class: 'center-page kid' }, h('div', { class: 'card narrow center' },
      h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, '🤷'),
      h('h1', {}, err.status === 404 ? 'לא מצאנו את המסלול' : 'אופס!'),
      h('p', {}, err.status === 404 ? 'בדקו שהקוד נכון, או בקשו אותו שוב מהמורה.' : err.message),
      h('a', { class: 'btn primary', href: '#/join' }, 'לנסות קוד אחר'))));
  }

  applyTheme(app, data.path.theme);
  document.body.classList.toggle('student-dark', data.path.theme.mode === 'dark');
  setPathSound(data.path.theme.sound);
  const s = {
    app, code,
    path: data.path,
    tasks: data.tasks,
    theme: data.path.theme,
    preview: data.preview,
    token: data.preview ? null : storage(tokenKey(code)),
    name: '',
    done: {},
    help: [],
    pending: [],
    sinceBreak: 0,
    join: data.join || { secretEmojis: [], avatars: [] },
    firstTry: 0,
    badgesShown: null, // badges already celebrated, so each pops up only once
    avatar: '',
  };

  if (s.preview) {
    s.name = 'תצוגה מקדימה';
    return showMap(s);
  }
  if (s.token) {
    try {
      applyState(s, await api('GET', `/api/s/${code}/me`, undefined, auth(s)));
      return showMap(s);
    } catch (err) {
      if (err.status !== 401) toast(err.message, 'error');
      storage(tokenKey(code), null);
      s.token = null;
    }
  }
  showJoin(s);
}

const auth = (s) => ({ 'X-Student-Token': s.token });

function applyState(s, st) {
  s.name = st.student.name;
  s.avatar = st.student.avatar || '';
  s.done = st.done;
  s.help = st.help;
  s.pending = st.pending || [];
  s.firstTry = st.firstTry || 0;
  s.badgesShown ||= new Set(earnedBadges(s)); // a returning student isn't re-congratulated
}

// ----- badges -----

const BADGES = [
  { id: 'first', icon: '🌱', name: 'צעד ראשון', test: (s) => doneCount(s) >= 1 },
  { id: 'three', icon: '🔥', name: 'שלוש משימות', test: (s) => doneCount(s) >= 3 },
  { id: 'half', icon: '⭐', name: 'חצי דרך', test: (s) => s.tasks.length >= 4 && doneCount(s) >= Math.ceil(s.tasks.length / 2) },
  { id: 'target', icon: '🎯', name: 'בול בפעם הראשונה', test: (s) => s.firstTry >= 3 },
  { id: 'finish', icon: '🏆', name: 'סיימתי את המסלול', test: (s) => s.tasks.length > 0 && doneCount(s) === s.tasks.length },
];

const earnedBadges = (s) => BADGES.filter((b) => b.test(s)).map((b) => b.id);

// Badges earned since the last celebration; marks them as shown.
function newBadges(s) {
  s.badgesShown ||= new Set();
  const fresh = BADGES.filter((b) => b.test(s) && !s.badgesShown.has(b.id));
  for (const b of fresh) s.badgesShown.add(b.id);
  return fresh;
}

function badgeRow(s) {
  return h('ul', { class: 'badge-row', 'aria-label': 'התגים שלי' }, BADGES.map((b) => {
    const on = b.test(s);
    return h('li', { class: `badge${on ? ' on' : ''}`, title: on ? b.name : `${b.name} (עוד לא)` },
      h('span', { 'aria-hidden': 'true' }, b.icon), h('span', { class: 'badge-name' }, b.name));
  }));
}

export const FROM_CLASS_KEY = 'lp-from-class';

export function frame(s, ...children) {
  const fromClass = !s.isClass && storage(FROM_CLASS_KEY);
  return mount(s.app,
    fromClass && h('a', { class: 'class-back', href: `#/c/${fromClass}` }, '→ כל המסלולים שלי'),
    DEMO && h('div', { class: 'demo-bar' }, 'גרסת הדגמה · ', h('a', { href: '#/dashboard' }, 'חזרה למסך המורה')),
    s.preview && h('div', { class: 'preview-banner' }, '👀 תצוגה מקדימה – כך התלמידים יראו את המסלול. ההתקדמות לא נשמרת.'),
    children);
}

// Joining works the same for one path (/api/s/CODE) and for a class (/api/c/CODE).
const joinBase = (s) => s.joinBase || `/api/s/${s.code}`;

export function showJoin(s) {
  const name = h('input', { type: 'text', maxlength: 40, required: true, autocomplete: 'given-name', 'aria-label': 'השם שלי', placeholder: 'השם שלי' });
  const submit = h('button', { class: 'btn primary big block', type: 'submit' }, 'המשך ←');
  frame(s, h('main', { class: 'center-page kid' },
    h('form', {
      class: 'card narrow center join-card', onsubmit: async (e) => {
        e.preventDefault();
        submit.disabled = true;
        try {
          const r = await api('POST', `${joinBase(s)}/name`, { name: name.value });
          showSecret(s, name.value.trim(), r.hasSecret ? 'enter' : 'create');
        } catch (err) {
          toast(err.message, 'error');
          submit.disabled = false;
        }
      },
    },
      h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, s.theme.icon),
      s.theme.buddy && buddySays(s, 'היי! אני אלווה אתכם לאורך כל המסלול 👋'),
      h('h1', { class: 'path-font' }, s.path.title),
      s.path.description && h('p', { class: 'path-font desc' }, s.path.description),
      h('p', {}, s.joinIntro || `${s.tasks.length} משימות קטנות מחכות לכם`),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'איך קוראים לכם?'), name),
      submit)));
  name.focus();
}

// Step 2 of joining. New students pick an animal and a secret of three pictures;
// returning students tap their secret to continue where they stopped.
function showSecret(s, name, mode) {
  const { secretEmojis, avatars } = s.join;
  const create = mode === 'create';
  let picks = [];
  let avatar = '';
  const slots = h('div', { class: 'secret-slots', 'aria-live': 'polite' });
  const message = h('p', { class: 'pin-message', role: 'status' });
  const submit = h('button', { class: 'btn primary big block', disabled: true }, create ? 'יוצאים לדרך! 🚀' : 'כניסה ←');
  const avatarRow = create && h('div', { class: 'avatar-grid', role: 'radiogroup', 'aria-label': 'הדמות שלי' });
  const drawAvatars = () => avatarRow && mount(avatarRow, avatars.map((a) => h('button', {
    type: 'button', class: `avatar-btn${a === avatar ? ' selected' : ''}`, role: 'radio', 'aria-checked': String(a === avatar),
    onclick: () => { avatar = a; drawAvatars(); draw(); },
  }, a)));
  const draw = () => {
    mount(slots, Array.from({ length: 3 }, (_, k) => h('span', { class: `secret-slot${picks[k] ? ' on' : ''}` }, picks[k] || '')));
    slots.setAttribute('aria-label', `נבחרו ${picks.length} מתוך 3`);
    submit.disabled = picks.length < 3 || (create && !avatar);
  };
  const grid = h('div', { class: 'secret-grid' }, secretEmojis.map((em) => h('button', {
    type: 'button', class: 'secret-btn', 'aria-label': em,
    onclick: () => { if (picks.length < 3) { picks.push(em); message.textContent = ''; draw(); } },
  }, em)));

  submit.onclick = async () => {
    submit.disabled = true;
    try {
      const r = await api('POST', `${joinBase(s)}/join`, { name, secret: picks, avatar });
      if (s.onJoined) return s.onJoined(r);
      s.token = r.token;
      storage(tokenKey(s.code), r.token);
      applyState(s, r);
      showMap(s);
    } catch (err) {
      picks = [];
      draw();
      message.className = 'pin-message wrong';
      message.textContent = err.message;
    }
  };

  frame(s, h('main', { class: 'center-page kid' },
    h('div', { class: 'card narrow center join-card secret-card' },
      h('h1', { class: 'path-font' }, create ? `נעים מאוד, ${name}!` : `שמחים שחזרתם, ${name}!`),
      create && [h('p', { class: 'field-label' }, '1. בחרו דמות'), avatarRow],
      h('p', { class: 'field-label' }, create ? '2. בחרו סיסמה סודית: 3 תמונות' : 'מה הסיסמה הסודית שלכם?'),
      create && h('p', { class: 'muted small' }, 'תזכרו אותן! בפעם הבאה תלחצו על אותן 3 תמונות כדי להמשיך.'),
      slots, message, grid,
      h('div', { class: 'row center' },
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => { picks.pop(); draw(); } }, '⌫ מחיקה'),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => showJoin(s) }, 'זה לא השם שלי')),
      submit,
      !create && h('p', { class: 'muted small' }, 'שכחתם? בקשו מהמורה לאפס את הסיסמה.'))));
  drawAvatars();
  draw();
}

// ----- helpers about progress -----

const isDone = (s, t) => Boolean(s.done[t.id]);
const doneCount = (s) => s.tasks.filter((t) => isDone(s, t)).length;
const nextIndex = (s) => s.tasks.findIndex((t) => !isDone(s, t));
const isOpen = (s, i) => s.theme.order === 'free' || isDone(s, s.tasks[i]) || i === nextIndex(s);
const isPending = (s, t) => s.pending.includes(t.id);
// A finished task that waits for the teacher opens the approval screen, not the task again.
const openTask = (s, i) => (isPending(s, s.tasks[i]) ? showApproval(s, i) : showTask(s, i));

function progressBar(s) {
  const n = doneCount(s);
  const pct = s.tasks.length ? Math.round((n / s.tasks.length) * 100) : 0;
  return h('div', { class: 'kid-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': s.tasks.length, 'aria-valuenow': n, 'aria-label': 'התקדמות' },
    h('div', { class: 'kid-progress-fill', style: { width: `${pct}%` } }),
    h('span', { class: 'kid-progress-text' }, `${n} מתוך ${s.tasks.length}`));
}

function kidHeader(s, extra) {
  return h('header', { class: 'kid-header' },
    h('div', { class: 'kid-hello path-font' }, `${s.avatar || s.theme.icon} היי ${s.name}!`),
    h('div', { class: 'row' },
      s.theme.sound !== false && h('button', {
        class: 'icon-btn mute-btn', 'aria-label': muted() ? 'הפעלת צלילים' : 'השתקת צלילים', title: muted() ? 'הפעלת צלילים' : 'השתקה',
        onclick: (e) => { setMuted(!muted()); e.currentTarget.textContent = muted() ? '🔇' : '🔊'; },
      }, muted() ? '🔇' : '🔊'),
      h('div', { class: 'stars', 'aria-label': `${doneCount(s)} כוכבים` }, '⭐ ', doneCount(s))),
    extra);
}

// ----- map -----

function showMap(s) {
  window.scrollTo(0, 0);
  if (!s.tasks.length) {
    return frame(s, h('main', { class: 'center-page kid' }, h('div', { class: 'card narrow center' },
      h('div', { class: 'big-emoji' }, '🛠️'), h('h1', {}, 'המסלול עוד בבנייה'), h('p', {}, 'המורה עוד לא הוסיפה משימות. נסו שוב מאוחר יותר!'))));
  }
  const next = nextIndex(s);
  const allDone = next === -1;
  const stations = s.tasks.map((t, i) => {
    const done = isDone(s, t);
    const open = isOpen(s, i);
    const current = i === next;
    const needsHelp = s.help.includes(t.id);
    const pending = isPending(s, t);
    return h('li', { class: `station ${done ? 'done' : current ? 'current' : open ? 'open' : 'locked'}${pending ? ' pending' : ''}` },
      h('button', {
        class: 'station-btn', disabled: !open, onclick: () => openTask(s, i),
        'aria-label': `משימה ${i + 1}: ${t.title}${done ? ' – הושלמה' : pending ? ' – מחכה לאישור המורה' : open ? '' : ' – נעולה'}`,
      },
        h('span', { class: 'station-dot', 'aria-hidden': 'true' }, done ? '✓' : pending ? '⏳' : open ? (t.emoji || TASK_TYPES[t.type].icon) : '🔒'),
        h('span', { class: 'station-label' },
          h('span', { class: 'station-title path-font' }, t.title),
          h('span', { class: 'station-meta' }, `${t.estMinutes} דק׳`,
            pending ? ' · 🧑‍🏫 מחכה לאישור המורה' : needsHelp ? ' · ✋ ביקשתי עזרה' : ''))),
      current && (s.theme.buddy
        ? h('span', { class: 'buddy-here', 'aria-hidden': 'true', title: 'אתם כאן!' }, s.theme.buddy)
        : h('span', { class: 'you-are-here', 'aria-hidden': 'true' }, 'אתם כאן!')));
  });

  frame(s,
    kidHeader(s),
    h('main', { class: 'kid-main' },
      h('h1', { class: 'path-title path-font' }, s.path.title),
      progressBar(s),
      !s.preview && badgeRow(s),
      allDone
        ? h('div', { class: 'card center finish-mini' }, h('span', { class: 'big-emoji' }, '🏆'), h('p', {}, 'סיימת את כל המסלול! איזה כיף!'))
        : h('button', { class: 'btn primary big go-btn', onclick: () => openTask(s, next) },
          isPending(s, s.tasks[next]) ? '🧑‍🏫 מחכים לאישור המורה' : doneCount(s) ? 'ממשיכים למשימה הבאה ←' : 'מתחילים! ←'),
      h('ol', { class: `map map-${s.theme.map}` }, stations,
        h('li', { class: `station goal ${allDone ? 'done' : ''}`, 'aria-hidden': 'true' },
          h('span', { class: 'station-dot' }, '🏁')))));
  document.querySelector('.station.current')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// ----- task screen -----

// Plays the teacher's own recording of the instructions; a second tap stops it.
function teacherVoiceButton(src) {
  const audio = new Audio(src);
  const btn = h('button', { class: 'icon-btn read-btn teacher-voice', 'aria-label': 'ההוראות בקול של המורה', title: 'ההוראות בקול של המורה' }, '🔊');
  audio.onended = audio.onpause = () => btn.classList.remove('playing');
  btn.onclick = () => {
    if (!audio.paused) return audio.pause();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    audio.currentTime = 0;
    audio.play().then(() => btn.classList.add('playing')).catch(() => toast('לא הצלחנו להשמיע את ההקלטה', 'error'));
  };
  return btn;
}

function speak(text) {
  if (!('speechSynthesis' in window)) return toast('ההקראה לא נתמכת בדפדפן הזה', 'error');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'he-IL';
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

function showTask(s, i) {
  window.scrollTo(0, 0);
  // Tells the teacher's "where students get stuck" how long this took.
  if (!s.preview && !isDone(s, s.tasks[i])) api('POST', `/api/s/${s.code}/tasks/${s.tasks[i].id}/open`, {}, auth(s)).catch(() => {});
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  const t = s.tasks[i];
  const c = t.content;
  const done = isDone(s, t);
  const finishBtn = h('button', { class: 'btn primary big finish-btn' }, done ? 'סיימתי (שוב) ✓' : 'סיימתי! ✓');
  const feedback = h('div', { class: 'feedback', role: 'status', 'aria-live': 'polite' });
  let getAnswer = () => ({});
  let canFinish = () => true;
  let onWrong = null;

  const parts = [];
  if (c.text) parts.push(h('p', { class: 'task-text path-font' }, c.text));

  if (c.image || c.imageUrl) {
    parts.push(h('img', { class: 'task-image', src: c.image || c.imageUrl, alt: '', referrerpolicy: 'no-referrer' }));
  }
  if (t.type === 'link') {
    const embed = youtubeEmbed(c.url);
    parts.push(embed
      ? h('div', { class: 'video' }, h('iframe', { src: embed, title: t.title, allow: 'encrypted-media; picture-in-picture', allowfullscreen: true, loading: 'lazy' }))
      : h('a', { class: 'btn secondary big', href: c.url, target: '_blank', rel: 'noopener noreferrer' }, '🔗 פתיחת הקישור'));
  }
  if (t.type === 'question') {
    const prev = s.done[t.id]?.answer || '';
    const area = h('textarea', { class: 'answer-input', rows: 5, maxlength: 5000, value: prev, placeholder: 'כתבו כאן את התשובה…', 'aria-label': 'התשובה שלי' });
    parts.push(area);
    getAnswer = () => ({ answer: area.value });
    canFinish = () => {
      if (area.value.trim()) return true;
      feedback.textContent = 'כתבו תשובה קצרה לפני שמסיימים ✏️';
      area.focus();
      return false;
    };
  }
  if (t.type === 'choice') {
    let picked = done ? s.done[t.id].answer : null;
    const opts = h('div', { class: 'options', role: 'radiogroup', 'aria-label': 'תשובות' });
    const renderOpts = () => mount(opts, c.options.map((o, idx) => h('button', {
      class: `option${picked === idx ? ' selected' : ''}`, role: 'radio', 'aria-checked': String(picked === idx),
      onclick: () => { picked = idx; feedback.textContent = ''; feedback.className = 'feedback'; renderOpts(); },
    }, h('span', { class: 'option-letter' }, 'אבגדהו'[idx]), h('span', { class: 'path-font' }, o))));
    renderOpts();
    parts.push(opts);
    finishBtn.textContent = 'בדיקה ✓';
    getAnswer = () => ({ answer: picked });
    canFinish = () => {
      if (picked !== null) return true;
      feedback.textContent = 'בחרו תשובה 👆';
      return false;
    };
  }
  if (t.type === 'checklist') {
    const ticks = c.items.map(() => done);
    const list = h('ul', { class: 'checklist' }, c.items.map((item, idx) => {
      const box = h('input', { type: 'checkbox', checked: done, onchange: (e) => { ticks[idx] = e.target.checked; li.classList.toggle('checked', e.target.checked); } });
      const li = h('li', { class: done ? 'checked' : '' }, h('label', {}, box, h('span', { class: 'check-ui', 'aria-hidden': 'true' }), h('span', { class: 'path-font' }, item)));
      return li;
    }));
    parts.push(list);
    getAnswer = () => ({ answer: ticks });
    canFinish = () => {
      if (ticks.every(Boolean)) return true;
      feedback.textContent = `נשארו עוד ${ticks.filter((x) => !x).length} צעדים לסמן 💪`;
      return false;
    };
  }
  if (t.type === 'timer') parts.push(focusTimer(c.minutes));
  if (GAMES[t.type]) {
    const game = GAMES[t.type](t, { complete: () => finishBtn.click() });
    parts.push(game.el);
    if (game.label) finishBtn.textContent = game.label;
    getAnswer = () => ({ answer: game.answer() });
    canFinish = () => {
      const hint = game.ready();
      if (!hint) return true;
      feedback.className = 'feedback';
      feedback.textContent = hint;
      return false;
    };
    onWrong = game.wrong;
  }

  const helpBtn = h('button', {
    class: 'btn ghost help-btn', disabled: s.help.includes(t.id),
    onclick: async () => {
      if (s.preview) return toast('בתצוגה מקדימה הבקשה לא נשלחת', 'info');
      try {
        applyState(s, await api('POST', `/api/s/${s.code}/tasks/${t.id}/help`, {}, auth(s)));
        helpBtn.disabled = true;
        helpBtn.textContent = '✋ המורה קיבלה את הבקשה';
      } catch (err) {
        toast(err.message, 'error');
      }
    },
  }, s.help.includes(t.id) ? '✋ המורה קיבלה את הבקשה' : '✋ צריכים עזרה');

  finishBtn.onclick = async () => {
    if (!canFinish()) return;
    finishBtn.disabled = true;
    try {
      const body = getAnswer();
      let r;
      if (s.preview) {
        r = await api('POST', `/api/s/${s.code}/tasks/${t.id}/check`, body);
        if (r.correct && t.needsApproval && !done) s.pending = [...new Set([...s.pending, t.id])];
        else if (r.correct) s.done[t.id] = { answer: body.answer ?? null };
      } else {
        r = await api('POST', `/api/s/${s.code}/tasks/${t.id}/complete`, body, auth(s));
        if (r.correct) applyState(s, r);
      }
      if (!r.correct) {
        feedback.className = 'feedback try-again';
        play('wrong');
        feedback.textContent = r.wrong?.length ? 'כמעט! תקנו את מה שמסומן באדום 🙂' : 'כמעט! נסו תשובה אחרת 🙂';
        onWrong?.(r.wrong || []);
        finishBtn.disabled = false;
        return;
      }
      if (done) return showMap(s);
      if (isPending(s, t)) return showApproval(s, i, r.explanation);
      s.sinceBreak++;
      showWellDone(s, i, r.explanation);
    } catch (err) {
      toast(err.message, 'error');
      finishBtn.disabled = false;
    }
  };

  const readText = [t.title, c.text, t.type === 'choice' ? c.options.join('. ') : '', t.type === 'checklist' ? c.items.join('. ') : '', GAMES[t.type] ? gameSpeech(t) : ''].filter(Boolean).join('. ');

  frame(s,
    h('header', { class: 'kid-header' },
      h('button', { class: 'btn ghost small', onclick: () => showMap(s) }, '→ למפה'),
      h('span', { class: 'step-count' }, `משימה ${i + 1} מתוך ${s.tasks.length}`),
      h('div', { class: 'stars' }, '⭐ ', doneCount(s))),
    h('main', { class: 'kid-main' },
      h('article', { class: 'task-card' },
        h('div', { class: 'task-top' },
          h('span', { class: 'task-big-emoji', 'aria-hidden': 'true' }, t.emoji || TASK_TYPES[t.type].icon),
          h('div', {},
            h('h1', { class: 'path-font' }, t.title),
            h('span', { class: 'chip' }, `⏳ בערך ${t.estMinutes} דקות`),
            t.needsApproval && h('span', { class: 'chip chip-approval' }, '🧑‍🏫 בסוף המורה מאשרת')),
          c.audio
            ? teacherVoiceButton(c.audio)
            : s.theme.readAloud && h('button', { class: 'icon-btn read-btn', 'aria-label': 'הקראה', title: 'הקראה בקול', onclick: () => speak(readText) }, '🔊')),
        parts,
        feedback,
        h('div', { class: 'task-buttons' }, finishBtn, helpBtn))));
}

function focusTimer(minutes) {
  const total = minutes * 60;
  let left = total;
  let interval = null;
  const R = 54;
  const C = 2 * Math.PI * R;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('class', 'timer-ring');
  svg.setAttribute('aria-hidden', 'true');
  const mk = (cls) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', 60); c.setAttribute('cy', 60); c.setAttribute('r', R); c.setAttribute('class', cls);
    return c;
  };
  svg.append(mk('ring-bg'));
  const fg = mk('ring-fg');
  fg.style.strokeDasharray = C;
  svg.append(fg);

  const label = h('div', { class: 'timer-label', role: 'timer', 'aria-live': 'off' });
  const btn = h('button', { class: 'btn secondary' });
  const reset = h('button', { class: 'btn ghost small' }, '↺ מההתחלה');
  const wrap = h('div', { class: 'timer' }, h('div', { class: 'timer-face' }, svg, label), h('div', { class: 'row center' }, btn, reset));

  const draw = () => {
    const m = Math.floor(left / 60);
    const sec = String(left % 60).padStart(2, '0');
    label.textContent = left > 0 ? `${m}:${sec}` : 'הזמן נגמר! 🎉';
    fg.style.strokeDashoffset = C * (1 - left / total);
    btn.textContent = interval ? '⏸ הפסקה' : left === total ? '▶ מתחילים' : left > 0 ? '▶ ממשיכים' : '✓ הזמן נגמר';
    btn.disabled = left === 0;
  };
  const stop = () => { clearInterval(interval); interval = null; };
  btn.onclick = () => {
    if (interval) { stop(); return draw(); }
    interval = setInterval(() => {
      if (!wrap.isConnected) return stop();
      left = Math.max(0, left - 1);
      if (left === 0) { stop(); play('chime'); }
      draw();
    }, 1000);
    draw();
  };
  reset.onclick = () => { stop(); left = total; draw(); };
  draw();
  return wrap;
}


// ----- teacher approval -----

// The student finished a task that needs the teacher's OK. The teacher comes over and
// types the path's code on this screen: approve (continue) or send it back to fix.
function showApproval(s, i, explanation) {
  window.scrollTo(0, 0);
  const t = s.tasks[i];
  let pin = '';
  const dots = h('div', { class: 'pin-dots', 'aria-live': 'polite' });
  const message = h('p', { class: 'pin-message', role: 'status' });
  const approveBtn = h('button', { class: 'btn primary big', disabled: true, onclick: () => decide('approve') }, '✓ אישור – אפשר להמשיך');
  const redoBtn = h('button', { class: 'btn ghost', disabled: true, onclick: () => decide('redo') }, '↺ צריך לתקן');
  const draw = () => {
    mount(dots, Array.from({ length: Math.max(4, pin.length) }, (_, k) => h('span', { class: `pin-dot${k < pin.length ? ' on' : ''}` })));
    dots.setAttribute('aria-label', `הוקלדו ${pin.length} ספרות`);
    approveBtn.disabled = redoBtn.disabled = pin.length < 4;
  };
  const press = (key) => {
    message.textContent = '';
    message.className = 'pin-message';
    if (key === 'del') pin = pin.slice(0, -1);
    else if (pin.length < 6) pin += key;
    draw();
  };

  async function decide(decision) {
    approveBtn.disabled = redoBtn.disabled = true;
    try {
      applyState(s, await api('POST', `/api/s/${s.code}/tasks/${t.id}/approve`, { pin, decision }, auth(s)));
      document.removeEventListener('keydown', onKey);
      if (decision === 'redo') {
        toast('המורה ביקשה לתקן – אפשר לנסות שוב 💪', 'info');
        return showTask(s, i);
      }
      s.sinceBreak++;
      showWellDone(s, i, explanation);
    } catch (err) {
      pin = '';
      draw();
      message.className = 'pin-message wrong';
      message.textContent = err.status === 403 ? 'הקוד לא נכון. אפשר לנסות שוב.' : err.message;
    }
  }

  const onKey = (e) => {
    if (!dots.isConnected) return document.removeEventListener('keydown', onKey);
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter' && pin.length >= 4) decide('approve');
  };
  document.addEventListener('keydown', onKey);

  const callBtn = h('button', {
    class: 'btn secondary', disabled: s.help.includes(t.id) || s.preview,
    onclick: async () => {
      try {
        applyState(s, await api('POST', `/api/s/${s.code}/tasks/${t.id}/help`, {}, auth(s)));
        callBtn.disabled = true;
        callBtn.textContent = '✋ המורה קיבלה הודעה';
      } catch (err) {
        toast(err.message, 'error');
      }
    },
  }, s.help.includes(t.id) ? '✋ המורה קיבלה הודעה' : '✋ לקרוא למורה');

  const keypad = h('div', { class: 'pin-pad', role: 'group', 'aria-label': 'מקלדת קוד' },
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0'].map((k) => h('button', {
      class: `pin-key${k === 'del' ? ' del' : ''}`, 'aria-label': k === 'del' ? 'מחיקה' : k, onclick: () => press(k),
    }, k === 'del' ? '⌫' : k)));

  frame(s,
    kidHeader(s),
    h('main', { class: 'center-page kid' },
      h('div', { class: 'card narrow center approval-card' },
        h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, '🧑‍🏫'),
        h('h1', { class: 'path-font' }, 'כל הכבוד! עכשיו המורה מאשרת'),
        h('p', {}, 'סיימת את ', h('strong', {}, t.title), '. קראו למורה – היא תקליד את הקוד שלה כדי שתוכלו להמשיך.'),
        s.preview
          ? [h('p', { class: 'muted small' }, 'בתצוגה מקדימה אין צורך בקוד.'),
            h('button', { class: 'btn primary big', onclick: () => { s.pending = s.pending.filter((x) => x !== t.id); s.done[t.id] = { answer: null }; s.sinceBreak++; showWellDone(s, i, explanation); } }, 'המשך ←')]
          : [callBtn,
            h('div', { class: 'pin-box' },
              h('p', { class: 'pin-label' }, 'למורה: להקליד כאן את קוד האישור'),
              dots, message, keypad,
              h('div', { class: 'stack' }, approveBtn, redoBtn))],
        h('button', { class: 'btn ghost small', onclick: () => { document.removeEventListener('keydown', onKey); showMap(s); } }, 'חזרה למפה'))));
  draw();
}

// ----- rewards & breaks -----

const CHEERS = ['איזה יופי! ממשיכים יחד?', 'ידעתי שתצליחו!', 'עוד צעד קדימה במסלול!', 'אני גאה בך!', 'וואו, איזו עבודה!'];

function buddySays(s, text) {
  return h('div', { class: 'buddy-say' },
    h('span', { class: 'buddy-face', 'aria-hidden': 'true' }, s.theme.buddy),
    h('span', { class: 'bubble path-font' }, text));
}

const PRAISE = ['כל הכבוד!', 'מעולה!', 'יופי של עבודה!', 'אלופים!', 'וואו, איזה יופי!', 'עוד צעד קדימה!'];

const PARTICLES = {
  stars: { chars: ['⭐', '🌟', '✨'] },
  hearts: { chars: ['💖', '💜', '💛', '💙', '💚'] },
  balloons: { chars: ['🎈', '🎈', '🎈', '🎉'], rise: true },
  bubbles: { chars: ['🫧'], rise: true },
};

// A short burst over the page. style: 'confetti' or one of PARTICLES.
export function celebrate(container, style = 'confetti') {
  const emoji = PARTICLES[style];
  if (emoji) {
    const layer = h('div', { class: `confetti emoji${emoji.rise ? ' rise' : ''}`, 'aria-hidden': 'true' });
    for (let i = 0; i < 34; i++) {
      layer.append(h('i', {
        style: {
          left: `${Math.random() * 96}%`,
          animationDelay: `${Math.random() * 0.8}s`,
          animationDuration: `${2.2 + Math.random() * 1.6}s`,
          fontSize: `${1.4 + Math.random() * 1.2}rem`,
        },
      }, emoji.chars[i % emoji.chars.length]));
    }
    container.append(layer);
    setTimeout(() => layer.remove(), 4800);
    return;
  }
  const colors = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', 'var(--accent)'];
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < 60; i++) {
    layer.append(h('i', {
      style: {
        left: `${Math.random() * 100}%`,
        background: colors[i % colors.length],
        animationDelay: `${Math.random() * 0.6}s`,
        animationDuration: `${1.8 + Math.random() * 1.4}s`,
        transform: `rotate(${Math.random() * 360}deg)`,
      },
    }));
  }
  container.append(layer);
  setTimeout(() => layer.remove(), 3800);
}

function showWellDone(s, i, explanation) {
  window.scrollTo(0, 0);
  const t = s.tasks[i];
  const next = nextIndex(s);
  if (next === -1) return showFinish(s);
  const breakDue = s.theme.breakEvery > 0 && s.sinceBreak >= s.theme.breakEvery;
  const goNext = () => (breakDue ? showBreak(s, next) : openTask(s, next));
  const nextBtn = h('button', { class: 'btn primary big', onclick: goNext }, breakDue ? 'זמן להפסקה קטנה 🙆' : 'למשימה הבאה ←');
  const fresh = s.preview ? [] : newBadges(s);

  frame(s,
    kidHeader(s),
    h('main', { class: 'center-page kid' },
      h('div', { class: 'card narrow center well-done' },
        h('div', { class: 'reward pop', 'aria-hidden': 'true' }, '⭐'),
        h('h1', { class: 'path-font' }, PRAISE[Math.floor(Math.random() * PRAISE.length)]),
        h('p', {}, 'סיימת את ', h('strong', {}, t.title)),
        explanation && h('p', { class: 'explanation path-font' }, explanation),
        s.theme.buddy && buddySays(s, CHEERS[Math.floor(Math.random() * CHEERS.length)]),
        fresh.length > 0 && h('div', { class: 'new-badge pop' },
          h('span', { class: 'new-badge-icon', 'aria-hidden': 'true' }, fresh.map((b) => b.icon).join(' ')),
          h('span', {}, h('strong', {}, fresh.length > 1 ? 'תגים חדשים!' : 'תג חדש!'), ' ', fresh.map((b) => b.name).join(', '))),
        progressBar(s),
        h('div', { class: 'stack' }, nextBtn, h('button', { class: 'btn ghost', onclick: () => showMap(s) }, 'למפה')))));
  play(fresh.length ? 'badge' : 'success');
  if (s.theme.celebrate) celebrate(s.app, s.theme.celebration);
  nextBtn.focus();
}

function showBreak(s, next) {
  s.sinceBreak = 0;
  const idea = BREAK_IDEAS[Math.floor(Math.random() * BREAK_IDEAS.length)];
  let left = s.theme.breakMinutes * 60;
  const label = h('div', { class: 'break-time', role: 'timer' });
  const draw = () => { label.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; };
  const timer = setInterval(() => {
    if (!label.isConnected) return clearInterval(timer);
    left = Math.max(0, left - 1);
    draw();
    if (left === 0) { clearInterval(timer); play('chime'); label.textContent = 'נגמרה ההפסקה!'; }
  }, 1000);
  draw();
  frame(s, h('main', { class: 'center-page kid' },
    h('div', { class: 'card narrow center break-card' },
      h('h1', { class: 'path-font' }, 'הפסקה קטנה'),
      h('div', { class: 'big-emoji breathe', 'aria-hidden': 'true' }, idea.icon),
      s.theme.buddy ? buddySays(s, idea.text) : h('p', { class: 'break-idea path-font' }, idea.text),
      label,
      h('button', { class: 'btn primary big', onclick: () => { clearInterval(timer); openTask(s, next); } }, 'מוכנים להמשיך ←'))));
}

function showFinish(s) {
  frame(s,
    kidHeader(s),
    h('main', { class: 'center-page kid' },
      h('div', { class: 'card narrow center finish' },
        h('div', { class: 'trophy pop', 'aria-hidden': 'true' }, '🏆'),
        h('h1', { class: 'path-font' }, `סיימת את כל המסלול, ${s.name}!`),
        h('p', {}, `השלמת ${s.tasks.length} משימות וצברת ${doneCount(s)} כוכבים.`),
        h('p', { class: 'big-stars', 'aria-hidden': 'true' }, '⭐'.repeat(Math.min(doneCount(s), 12))),
        !s.preview && badgeRow(s),
        h('button', { class: 'btn primary', onclick: () => showMap(s) }, 'לראות את המפה'))));
  if (!s.preview) newBadges(s);
  play('fanfare');
  celebrate(s.app, s.theme.celebrate ? s.theme.celebration : 'confetti');
  setTimeout(() => s.app.isConnected && celebrate(s.app, 'confetti'), 1200);
}
