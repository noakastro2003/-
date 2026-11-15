// Pictures and voice recordings in the task editor.
import { api } from './api.js';
import { h, mount, toast } from './ui.js';

const MAX_SIDE = 1600;

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(new Error('לא הצלחנו לקרוא את הקובץ'));
  r.readAsDataURL(blob);
});

export async function uploadMedia(blob) {
  return api('POST', '/api/media', { data: await blobToBase64(blob) });
}

// Phone photos are often several MB: scale big pictures down before uploading.
export async function shrinkImage(file) {
  if (file.type === 'image/gif' || file.size < 600 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = Object.assign(document.createElement('canvas'), {
      width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale),
    });
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const out = await new Promise((r) => canvas.toBlob(r, type, 0.86));
    return out && out.size < file.size ? out : file;
  } catch {
    return file;
  }
}

// A picture for the task: upload from the computer or phone, or paste a web address.
export function imageField(current = '') {
  let value = current;
  const wrap = h('div', { class: 'media-field' });
  const input = h('input', {
    type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true,
    onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      render('uploading');
      try {
        value = (await uploadMedia(await shrinkImage(file))).url;
      } catch (err) {
        toast(err.message, 'error');
      }
      render();
    },
  });
  const urlInput = h('input', { type: 'url', dir: 'ltr', placeholder: 'או הדביקו קישור לתמונה: https://…', class: 'media-url' });
  urlInput.addEventListener('change', () => { value = urlInput.value.trim(); render(); });

  function render(state) {
    mount(wrap,
      input,
      value && h('img', { class: 'media-thumb', src: value, alt: 'התמונה של המשימה' }),
      h('div', { class: 'row wrap' },
        h('button', { type: 'button', class: 'btn small', disabled: state === 'uploading', onclick: () => input.click() },
          state === 'uploading' ? 'מעלה…' : value ? '🔄 החלפת תמונה' : '📷 העלאת תמונה'),
        value && h('button', { type: 'button', class: 'btn small ghost', onclick: () => { value = ''; urlInput.value = ''; render(); } }, '🗑️ הסרה')),
      !value && urlInput);
    if (state !== 'uploading') wrap.dispatchEvent(new CustomEvent('media-change'));
  }
  render();
  wrap.getValue = () => value;
  return wrap;
}

// The teacher's voice reading the instructions. Recorded in the browser, or uploaded as a file.
export function audioField(current = '', { compact = false } = {}) {
  let value = current;
  let recorder = null;
  let timer = null;
  let seconds = 0;
  const wrap = h('div', { class: `media-field${compact ? ' compact' : ''}` });
  const fileInput = h('input', {
    type: 'file', accept: 'audio/*', hidden: true,
    onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (file) await save(file);
    },
  });

  async function save(blob) {
    render('uploading');
    try {
      value = (await uploadMedia(blob)).url;
    } catch (err) {
      toast(err.message, 'error');
    }
    render();
  }

  async function start() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return toast('אין גישה למיקרופון. אפשר לאשר גישה בדפדפן, או להעלות קובץ קול.', 'error');
    }
    const chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(timer);
      recorder = null;
      save(new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' }));
    };
    recorder.start();
    seconds = 0;
    timer = setInterval(() => {
      seconds++;
      if (!wrap.isConnected || seconds >= 120) recorder?.stop(); // two minutes is plenty for instructions
      else { const stop = wrap.querySelector('.stop-rec'); if (stop) stop.textContent = `⏹ עצירה (${clock()})`; }
    }, 1000);
    render('recording');
  }

  const clock = () => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  function render(state) {
    mount(wrap,
      fileInput,
      value && state !== 'recording' && (compact
        ? h('button', { type: 'button', class: 'btn small ghost', 'aria-label': 'השמעה', onclick: () => new Audio(value).play().catch(() => {}) }, '▶')
        : h('audio', { class: 'media-audio', src: value, controls: true, preload: 'none' })),
      h('div', { class: 'row wrap' },
        state === 'recording'
          ? h('button', { type: 'button', class: 'btn small danger stop-rec', onclick: () => recorder?.stop() }, `⏹ עצירה (${clock()})`)
          : h('button', { type: 'button', class: 'btn small', disabled: state === 'uploading' || !window.MediaRecorder, onclick: start },
            state === 'uploading' ? 'שומר…' : compact ? (value ? '🎙️ שוב' : '🎙️ הקלטה') : value ? '🎙️ הקלטה מחדש' : '🎙️ הקלטת ההוראות'),
        state !== 'recording' && !compact && h('button', { type: 'button', class: 'btn small ghost', onclick: () => fileInput.click() }, '📁 העלאת קובץ קול'),
        value && state !== 'recording' && h('button', { type: 'button', class: 'btn small ghost', 'aria-label': 'מחיקת ההקלטה', onclick: () => { value = ''; render(); } }, compact ? '🗑️' : '🗑️ מחיקה')),
      state === 'recording' && !compact && h('p', { class: 'recording-dot small' }, 'מקליטים… דברו ברור ולאט'));
  }
  render();
  wrap.getValue = () => value;
  return wrap;
}
