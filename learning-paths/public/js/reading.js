// A student's reading settings (set by the teacher or by the student) and read-aloud in a
// natural voice, with the device's voice as a fallback.
import { h, modal, toast } from './ui.js';
import { api } from './api.js';
import { speakableMath } from './math.js';

export const READING_DEFAULTS = { font: 'default', size: 1, spacing: false, contrast: false, calm: false, readAloud: false, voice: 'natural' };
const CLASSES = ['rd-clear', 'rd-size-2', 'rd-size-3', 'rd-spacing', 'rd-contrast', 'rd-calm'];

export const isCalm = () => document.documentElement.classList.contains('rd-calm-on');

export function applyReading(app, r = READING_DEFAULTS) {
  app.classList.remove(...CLASSES);
  if (r.font === 'clear') app.classList.add('rd-clear');
  if (r.size > 1) app.classList.add(`rd-size-${r.size}`);
  if (r.spacing) app.classList.add('rd-spacing');
  if (r.contrast) app.classList.add('rd-contrast');
  if (r.calm) app.classList.add('rd-calm');
  // Calm mode also stops sounds and animations outside the app box (confetti, toasts).
  document.documentElement.classList.toggle('rd-calm-on', Boolean(r.calm));
  // Bigger text scales the whole screen, like the browser's own text size.
  document.documentElement.style.fontSize = r.size > 1 ? `${[100, 115, 130][r.size - 1]}%` : '';
}

// The controls, shared by the student's panel and the teacher's adaptation dialog.
export function readingControls(r, onChange) {
  const set = (k, val) => { r[k] = val; onChange(r); render(); };
  const box = h('div', { class: 'reading-controls' });
  const choice = (label, k, options) => h('div', { class: 'rd-row' },
    h('span', { class: 'rd-label' }, label),
    h('div', { class: 'seg', role: 'group', 'aria-label': label }, options.map(([val, text]) => h('button', {
      type: 'button', class: `seg-btn${r[k] === val ? ' on' : ''}`, 'aria-pressed': String(r[k] === val), onclick: () => set(k, val),
    }, text))));
  const toggle = (label, k, hint) => h('label', { class: 'rd-row rd-toggle' },
    h('input', { type: 'checkbox', checked: r[k], onchange: (e) => set(k, e.target.checked) }),
    h('span', {}, h('span', { class: 'rd-label' }, label), hint && h('span', { class: 'muted small' }, ` · ${hint}`)));
  const render = () => box.replaceChildren(
    choice('גופן', 'font', [['default', 'רגיל'], ['clear', 'ברור']]),
    choice('גודל טקסט', 'size', [[1, 'א'], [2, 'א+'], [3, 'א++']]),
    toggle('ריווח גדול', 'spacing', 'בין שורות, מילים ואותיות'),
    toggle('ניגודיות גבוהה', 'contrast', 'שחור על לבן'),
    toggle('מצב שקט', 'calm', 'בלי אנימציות וצלילים'),
    toggle('כפתור הקראה בכל משימה', 'readAloud', '🔊 שומעים את ההוראות'),
    choice('קול ההקראה', 'voice', [['natural', 'קול טבעי'], ['device', 'קול המכשיר']]));
  render();
  return box;
}

// The student's "Aa" panel.
export function readingButton(s) {
  return h('button', {
    class: 'icon-btn reading-btn', 'aria-label': 'הגדרות קריאה ונגישות', title: 'הגדרות קריאה',
    onclick: () => {
      const r = { ...READING_DEFAULTS, ...s.reading };
      let timer;
      modal('הגדרות קריאה', [
        h('p', { class: 'muted' }, 'בחרו מה הכי נוח לכם לקרוא. ההגדרות נשמרות.'),
        readingControls(r, (next) => {
          s.reading = { ...next };
          applyReading(s.app, s.reading);
          if (s.preview || !s.token) return;
          clearTimeout(timer);
          timer = setTimeout(() => api('PUT', `/api/s/${s.code}/reading`, s.reading, { 'X-Student-Token': s.token })
            .catch(() => toast('לא הצלחנו לשמור את ההגדרות', 'error')), 400);
        }),
        h('p', { class: 'small' }, h('a', { href: '#/legal/accessibility', target: '_blank' }, 'הצהרת הנגישות של האתר')),
      ]);
    },
  }, 'Aa');
}

// ---------- read-aloud ----------

let current = null; // { audio, url, btn }
const cache = new Map(); // text → object URL

export function stopSpeaking() {
  if (current?.audio) current.audio.pause();
  current?.btn?.classList.remove('playing', 'loading');
  current = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function deviceSpeak(text) {
  if (!('speechSynthesis' in window)) return toast('ההקראה לא נתמכת בדפדפן הזה', 'error');
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'he-IL';
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

// Reads text aloud. A second tap on the same button stops it.
export async function speakText(s, text, btn) {
  const wasMine = current?.btn === btn && btn;
  stopSpeaking();
  if (wasMine) return;
  const words = speakableMath(text).replace(/\s+/g, ' ').trim().slice(0, 700);
  if (!words) return;
  const natural = s.naturalVoice && (s.reading?.voice || 'natural') === 'natural';
  if (!natural) return deviceSpeak(words);
  const mine = { btn };
  current = mine;
  btn?.classList.add('loading');
  try {
    let url = cache.get(words);
    if (!url) {
      const headers = s.token ? { 'X-Student-Token': s.token } : {};
      const r = await api('POST', `/api/s/${s.code}/tts`, { text: words }, headers);
      // Played from a blob: some browsers won't play audio from a server without range requests.
      const res = await fetch(r.url);
      if (!res.ok) throw new Error('audio');
      url = URL.createObjectURL(await res.blob());
      cache.set(words, url);
    }
    if (current !== mine) return;
    const audio = new Audio(url);
    mine.audio = audio;
    btn?.classList.replace('loading', 'playing');
    audio.onended = () => { if (current === mine) stopSpeaking(); };
    await audio.play();
  } catch {
    if (current !== mine) return;
    btn?.classList.remove('loading', 'playing');
    current = null;
    deviceSpeak(words); // the natural voice is unavailable: the device's voice instead
  }
}
