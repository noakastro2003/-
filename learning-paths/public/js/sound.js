// Short sound effects, synthesized (no files to load). Off when the teacher turned sounds
// off for the path, or the student muted them on this device.
import { storage } from './ui.js';

let ctx = null;
let pathAllows = true;

export const setPathSound = (on) => { pathAllows = on !== false; };
export const muted = () => storage('lp-muted') === '1';
export const setMuted = (on) => storage('lp-muted', on ? '1' : null);
const on = () => pathAllows && !muted();

// notes: [frequency Hz, start s, length s, type?]
function tones(notes, volume = 0.16) {
  if (!on()) return;
  try {
    ctx ||= new AudioContext();
    const t0 = ctx.currentTime + 0.01;
    for (const [freq, at, len, type = 'sine'] of notes) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(volume, t0 + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + at);
      o.stop(t0 + at + len + 0.05);
    }
  } catch { /* audio unavailable */ }
}

const SOUNDS = {
  success: () => tones([[523, 0, 0.18], [659, 0.1, 0.18], [784, 0.2, 0.35]]),
  wrong: () => tones([[330, 0, 0.18, 'triangle'], [294, 0.14, 0.28, 'triangle']], 0.12),
  badge: () => tones([[784, 0, 0.15], [988, 0.1, 0.15], [1175, 0.2, 0.15], [1568, 0.3, 0.4]], 0.13),
  fanfare: () => tones([[523, 0, 0.2], [523, 0.18, 0.12], [659, 0.3, 0.2], [784, 0.48, 0.2], [1047, 0.66, 0.6]]),
  chime: () => tones([[660, 0, 0.4], [880, 0.18, 0.4], [990, 0.36, 0.5]], 0.2),
};

export const play = (name) => SOUNDS[name]?.();
