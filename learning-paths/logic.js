// Pure path logic shared by the Node server and the in-browser demo:
// what students may see, how answers are graded, and how AI output becomes tasks.
// No Node or DOM APIs here.
import * as v from './validate.js';
import { HttpError } from './validate.js';
import { GRADES, AI_TASK_TYPES } from './ai-prompt.js';

function randomInt(n) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % n;
}

// Task types with right and wrong answers: a "first try" badge counts these.
export const GRADED_TYPES = ['choice', 'matching', 'order', 'blanks', 'truefalse', 'lines', 'sort', 'dictation', 'hotspot', 'highlight'];

// A student's "secret password": 3 picks (repeats allowed) from these pictures. Easy for
// young children and weak readers; the server rate-limits guessing.
export const SECRET_EMOJIS = ['🍎', '🐶', '🚗', '⭐', '🌈', '🐱', '🍕', '⚽', '🎈', '🌻', '🐠', '🚀'];
export const AVATARS = ['🦁', '🐯', '🐼', '🐨', '🦊', '🐸', '🐵', '🦄', '🐙', '🐧', '🦖', '🐢'];
export const SECRET_LENGTH = 3;

// Validates a picked secret; returns it as one string, or throws.
export function secretString(picks) {
  if (!Array.isArray(picks) || picks.length !== SECRET_LENGTH || !picks.every((x) => SECRET_EMOJIS.includes(x))) {
    throw new HttpError(400, `בחרו ${SECRET_LENGTH} תמונות לסיסמה הסודית`);
  }
  return picks.join('|');
}

// "How do I feel?" at the start and end of a session. worry: worth a word from the teacher.
export const MOODS = [
  { e: '😄', name: 'שמח' }, { e: '🙂', name: 'בסדר' }, { e: '😐', name: 'ככה ככה' }, { e: '😴', name: 'עייף' },
  { e: '😟', name: 'מודאג', worry: true }, { e: '😢', name: 'עצוב', worry: true }, { e: '😠', name: 'כועס', worry: true },
];
export function moodInput(body) {
  if (!['start', 'end'].includes(body?.kind)) throw new HttpError(400, 'סוג לא תקין');
  if (!MOODS.some((m) => m.e === body.mood)) throw new HttpError(400, 'בחרו איך אתם מרגישים');
  return { kind: body.kind, mood: body.mood };
}

// The 4-digit code a teacher types on a student's screen to approve their work.
export const randomPin = () => String(randomInt(10000)).padStart(4, '0');

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffles, but never hands back the original order (when that is possible).
export function shuffleChanged(list) {
  const unique = new Set(list).size > 1;
  let a;
  do a = shuffle(list); while (unique && a.every((x, i) => x === list[i]));
  return a;
}

// Turns a task's content into what a student may see: answers stay on the server.
export function studentContent(type, c) {
  const media = {};
  if (c.image) media.image = c.image;
  if (c.audio) media.audio = c.audio;
  return { ...studentTypeContent(type, c), ...media };
}

function studentTypeContent(type, c) {
  switch (type) {
    case 'choice': {
      const { correct, explanation, ...rest } = c;
      return rest;
    }
    case 'matching':
    case 'lines':
      return { text: c.text, left: c.pairs.map((p) => p.a), right: shuffleChanged(c.pairs.map((p) => p.b)) };
    case 'sort':
      return { text: c.text, groups: c.groups.map((g) => g.name), items: shuffle(c.groups.flatMap((g) => g.items)) };
    case 'hotspot':
      return { text: c.text, count: c.spots.length };
    case 'highlight': {
      const { tokens, targets, tight } = v.highlightTokens(c.passage);
      return { text: c.text, tokens, tight, count: targets.length };
    }
    case 'dictation':
      // The browser needs each word to read it aloud. It is sent encoded, so it is not on
      // screen or readable at a glance; this keeps honest students honest, nothing more.
      return { text: c.text, words: c.words.map((x) => (x.audio ? { audio: x.audio } : { say: encodeSay(x.w) })) };
    case 'order':
      return { text: c.text, items: shuffleChanged(c.items) };
    case 'blanks': {
      const { segments, answers } = v.parseBlanks(c.passage);
      return { text: c.text, segments, bank: shuffle([...answers, ...c.distractors]) };
    }
    case 'truefalse':
      return { text: c.text, statements: c.statements.map((x) => x.s) };
    default:
      return c;
  }
}

export function encodeSay(word) {
  const bytes = new TextEncoder().encode(word);
  return btoa(String.fromCharCode(...bytes)).split('').reverse().join('');
}
export function decodeSay(code) {
  const bin = atob(String(code).split('').reverse().join(''));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

// Dictation: no nikud, case, spaces or punctuation.
const spelling = (s) => v.normalizeWord(String(s)).replace(/[.,!?;:"'׳״()־-]/g, '').replace(/\s+/g, ' ').trim();

// Validates a student's answer for a task. Returns { correct, answer, wrong?, explanation? }
// where answer is what gets stored and wrong lists the indices to fix; throws when incomplete.
export function gradeAnswer(type, content, body) {
  const list = (n) => {
    if (!Array.isArray(body.answer) || body.answer.length !== n) throw new HttpError(400, 'צריך להשלים את כל החלקים');
    return body.answer;
  };
  const graded = (answer, expected, same = (a, b) => a === b) => {
    const wrong = expected.map((e, i) => (same(answer[i], e) ? -1 : i)).filter((i) => i >= 0);
    return { correct: wrong.length === 0, answer, wrong };
  };
  const sameWord = (a, b) => typeof a === 'string' && v.normalizeWord(a) === v.normalizeWord(b);
  switch (type) {
    case 'matching':
    case 'lines':
      return graded(list(content.pairs.length), content.pairs.map((p) => p.b), sameWord);
    case 'dictation':
      return graded(list(content.words.length), content.words.map((x) => x.w),
        (a, b) => typeof a === 'string' && spelling(a) === spelling(b));
    case 'sort': {
      // answer: one list of item texts per group, in the teacher's group order.
      const placed = list(content.groups.length);
      const where = new Map();
      placed.forEach((items, gi) => {
        if (!Array.isArray(items)) throw new HttpError(400, 'צריך למיין את כל הפריטים');
        for (const it of items) if (typeof it === 'string') where.set(v.normalizeWord(it), gi);
      });
      const wrong = [];
      content.groups.forEach((g, gi) => g.items.forEach((it) => {
        const at = where.get(v.normalizeWord(it));
        if (at === undefined) throw new HttpError(400, 'צריך למיין את כל הפריטים');
        if (at !== gi) wrong.push(it);
      }));
      return { correct: wrong.length === 0, answer: placed, wrong };
    }
    case 'voice': {
      // A recording of the student, or typed words when there is no microphone.
      const a = v.str(body.answer, { max: 5000, required: true, field: 'תשובה' });
      return { correct: true, answer: v.MEDIA_PATH.test(a) ? { audio: a } : a };
    }
    case 'photo':
    case 'draw': {
      const a = v.str(body.answer, { max: 200, field: 'תמונה' });
      if (!v.MEDIA_PATH.test(a)) throw new HttpError(400, type === 'photo' ? 'צלמו את העבודה לפני ששולחים 📷' : 'ציירו משהו לפני ששולחים 🎨');
      return { correct: true, answer: { image: a } };
    }
    case 'hotspot': {
      const points = list(content.spots.length).map((p) => ({ x: Number(p?.x), y: Number(p?.y) }));
      if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new HttpError(400, 'נקודה לא תקינה');
      // Each spot can be claimed by one point; a point outside every free spot is wrong.
      const free = content.spots.map(() => true);
      const wrong = [];
      points.forEach((p, i) => {
        const k = content.spots.findIndex((s, j) => free[j] && ((p.x - s.x) ** 2 + (p.y - s.y) ** 2) <= s.r ** 2);
        if (k < 0) wrong.push(i);
        else free[k] = false;
      });
      return { correct: wrong.length === 0, answer: points, wrong };
    }
    case 'highlight': {
      const { tokens, targets } = v.highlightTokens(content.passage);
      const picked = Array.isArray(body.answer) ? [...new Set(body.answer.map(Number))] : [];
      if (picked.some((i) => !Number.isInteger(i) || i < 0 || i >= tokens.length)) throw new HttpError(400, 'סימון לא תקין');
      if (picked.length !== targets.length) throw new HttpError(400, `צריך לסמן בדיוק ${targets.length} מילים`);
      const wrong = picked.filter((i) => !targets.includes(i));
      return { correct: wrong.length === 0, answer: picked, wrong };
    }
    case 'flashcards':
      return { correct: true, answer: { again: v.int(body.answer, { min: 0, max: 999, def: 0 }) } };
    case 'order':
      return graded(list(content.items.length), content.items, sameWord);
    case 'blanks': {
      const { answers } = v.parseBlanks(content.passage);
      return graded(list(answers.length), answers, sameWord);
    }
    case 'truefalse':
      return graded(list(content.statements.length), content.statements.map((x) => x.t));
    case 'choice': {
      const choice = v.int(body.answer, { min: 0, max: content.options.length - 1, def: -1 });
      if (choice < 0) throw new HttpError(400, 'צריך לבחור תשובה');
      return { correct: choice === content.correct, answer: choice, explanation: content.explanation };
    }
    case 'question': {
      const text = v.str(body.answer, { max: 5000, required: true, field: 'תשובה' });
      return { correct: true, answer: text };
    }
    case 'checklist': {
      const ticked = Array.isArray(body.answer) ? body.answer : [];
      if (ticked.length < content.items.length || !content.items.every((_, i) => ticked[i] === true)) {
        throw new HttpError(400, 'צריך לסמן את כל השלבים');
      }
      return { correct: true, answer: null };
    }
    default:
      return { correct: true, answer: null };
  }
}

// ---------- AI generator ----------

// The teacher's request, validated. Files are passed through for the caller to handle.
export function parseAiInput(b) {
  const input = {
    topic: v.str(b.topic, { max: 200, required: true, field: 'נושא' }),
    grade: GRADES.includes(b.grade) ? b.grade : null,
    goals: v.str(b.goals, { max: 2000, field: 'מטרות' }),
    notes: v.str(b.notes, { max: 2000, field: 'הערות' }),
    taskCount: v.int(b.taskCount, { min: 3, max: 12, def: 7 }),
    types: Array.isArray(b.types) ? AI_TASK_TYPES.filter((t) => b.types.includes(t)) : [...AI_TASK_TYPES],
    nikud: Boolean(b.nikud),
    files: Array.isArray(b.files) ? b.files : [],
  };
  if (!input.grade) throw new HttpError(400, 'בחרו שכבת גיל');
  if (input.types.length < 2) throw new HttpError(400, 'בחרו לפחות שני סוגי משימות');
  return input;
}

// Model output is untrusted: each task goes through the same validation as a teacher's edits.
export function taskFromAi(t) {
  if (typeof t !== 'object' || t === null) throw new HttpError(400, 'משימה לא תקינה');
  const { type, title, emoji, estMinutes, ...content } = t;
  const clamp = (n, lo, hi, def) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : def);
  if (type === 'timer') content.minutes = clamp(content.minutes, 1, 60, 10);
  return v.task({
    type,
    title: String(title || '').slice(0, 120),
    emoji: String(emoji || '').slice(0, 16),
    estMinutes: clamp(estMinutes, 1, 120, 5),
    content,
  });
}

// After an AI rewrite: the pictures, recordings and approval stop belong to the teacher.
export function keepTeacherParts(original, improved) {
  const o = original.content;
  const c = improved.content;
  if (o.image) c.image = o.image;
  if (o.audio) c.audio = o.audio;
  if (improved.type === 'dictation') {
    const rec = new Map(o.words.filter((x) => x.audio).map((x) => [v.normalizeWord(x.w), x.audio]));
    for (const x of c.words) if (rec.has(v.normalizeWord(x.w))) x.audio = rec.get(v.normalizeWord(x.w));
  }
  if (improved.type === 'voice') c.maxSeconds = o.maxSeconds;
  improved.needsApproval = original.needsApproval;
  return improved;
}

// Raw generator JSON -> { title, description, theme, tasks, skipped }. Throws if nothing usable.
export function pathFromAi(raw, input) {
  const tasks = [];
  let skipped = 0;
  for (const t of Array.isArray(raw?.tasks) ? raw.tasks : []) {
    try {
      if (!input.types.includes(t?.type)) throw new Error('type');
      tasks.push(taskFromAi(t));
    } catch {
      skipped++;
    }
  }
  if (!tasks.length) throw new HttpError(502, 'המחולל לא הצליח ליצור משימות תקינות. נסו שוב.');
  let theme;
  try {
    theme = v.theme({ icon: raw.icon, color: raw.color });
  } catch {
    theme = v.theme({});
  }
  const title = (typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : input.topic).slice(0, 120);
  const description = (typeof raw.description === 'string' ? raw.description.trim() : '').slice(0, 1000);
  return { title, description, theme, tasks, skipped };
}
