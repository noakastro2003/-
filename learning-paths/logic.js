// Pure path logic shared by the Node server and the in-browser demo:
// what students may see, how answers are graded, and how AI output becomes tasks.
// No Node or DOM APIs here.
import * as v from './validate.js';
import { HttpError } from './validate.js';
import { GRADES, AI_TASK_TYPES } from './ai-prompt.js';

function randomInt(n) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % n;
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
  switch (type) {
    case 'choice': {
      const { correct, explanation, ...rest } = c;
      return rest;
    }
    case 'matching':
      return { text: c.text, left: c.pairs.map((p) => p.a), right: shuffle(c.pairs.map((p) => p.b)) };
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
      return graded(list(content.pairs.length), content.pairs.map((p) => p.b), sameWord);
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
function aiTask(t) {
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

// Raw generator JSON -> { title, description, theme, tasks, skipped }. Throws if nothing usable.
export function pathFromAi(raw, input) {
  const tasks = [];
  let skipped = 0;
  for (const t of Array.isArray(raw?.tasks) ? raw.tasks : []) {
    try {
      if (!input.types.includes(t?.type)) throw new Error('type');
      tasks.push(aiTask(t));
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
