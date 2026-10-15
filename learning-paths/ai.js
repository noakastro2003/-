// AI path generator: turns a teacher's topic, grade, goals and files into a draft path.
import Anthropic from '@anthropic-ai/sdk';
import { HttpError } from './validate.js';
import { docxToText } from './docx.js';

const MODEL = 'claude-opus-5-5';

export const GRADES = ['גן', 'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳', 'י׳', 'י״א', 'י״ב'];

// Task types the generator may use. 'link' is left out on purpose: the model
// would have to invent URLs, and a dead link is worse than no link.
export const AI_TASK_TYPES = ['read', 'question', 'choice', 'checklist', 'timer', 'memory', 'wordsearch', 'matching', 'order', 'blanks', 'truefalse'];

const ICONS = ['🚀', '🌈', '🦄', '🐢', '🦁', '⚽', '🎨', '📚', '🧩', '🌟', '🌱', '🏝️', '🐙', '🎵', '🔬', '🏰'];
const COLORS = ['#6c5ce7', '#0984e3', '#00a884', '#e17055', '#d63384', '#2d3436'];

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const TEXT_EXT = /\.(txt|md|csv)$/i;
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ---------- output schema: one variant per task type ----------

const s = { type: 'string' };
const strings = { type: 'array', items: s };
const pairs = {
  type: 'array',
  items: { type: 'object', additionalProperties: false, required: ['a', 'b'], properties: { a: s, b: s } },
};

const VARIANT_FIELDS = {
  read: {},
  question: {},
  choice: { options: strings, correct: { type: 'integer' }, explanation: s },
  checklist: { items: strings },
  timer: { minutes: { type: 'integer' } },
  memory: { pairs },
  wordsearch: { words: strings },
  matching: { pairs },
  order: { items: strings },
  blanks: { passage: s, distractors: strings },
  truefalse: {
    statements: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['s', 't'], properties: { s, t: { type: 'boolean' } } },
    },
  },
};

export function pathSchema(types = AI_TASK_TYPES) {
  const variants = types.map((type) => {
    const properties = {
      type: { type: 'string', const: type },
      title: s,
      emoji: s,
      estMinutes: { type: 'integer' },
      text: s,
      ...VARIANT_FIELDS[type],
    };
    return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
  });
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'description', 'icon', 'color', 'tasks'],
    properties: {
      title: s,
      description: s,
      icon: { type: 'string', enum: ICONS },
      color: { type: 'string', enum: COLORS },
      tasks: { type: 'array', items: { anyOf: variants } },
    },
  };
}

// ---------- prompt ----------

export const SYSTEM_PROMPT = `You design self-paced learning paths for Israeli school students who have attention difficulties (ADHD). A teacher gives you a topic, a grade, learning goals and sometimes source material; you return one complete path as JSON matching the schema. The teacher will review and edit it before students see it.

Write everything the student sees in Hebrew, unless the subject itself is another language (for an English lesson, the English words stay in English and the instructions stay in Hebrew).

What makes a path work for these students:
- Small steps. Each task is one clear action that takes 2–8 minutes. Instructions are one to three short sentences, concrete and friendly, addressed to the student. No walls of text: a "read" task explains one idea in a short paragraph, not a chapter.
- Variety and movement. Alternate between taking in content (read), active practice (games and questions) and focused work (timer). Put a game or interactive task at least every two or three tasks. Do not use the same type twice in a row.
- A gentle start and a good ending. Open with something easy that builds confidence (for example a short checklist to get ready, or an easy warm-up game). End with a short reflection question or a fun review game.
- Language and difficulty that fit the grade. For young grades use simple words and very short sentences.
- Accuracy matters more than anything: every fact, answer and pair must be correct. When source material is provided, build the path from it and keep its terminology.

Rules per task type (the JSON schema enforces the shape, these rules cover the rest):
- read: "text" is the explanation itself (short). Never invent image or video links.
- question: an open question in "text"; answerable in one or two sentences.
- choice: "text" is the question; 3–4 "options"; "correct" is the 0-based index of the right option; "explanation" is one encouraging sentence shown after a correct answer.
- checklist: 2–6 "items", each a tiny concrete step.
- timer: "minutes" between 3 and 15 (equal to estMinutes); "text" says exactly what to produce during the timer.
- memory: 4–8 "pairs". "a" and "b" are the two cards that match (word ↔ emoji, term ↔ meaning, exercise ↔ result). Keep each card under 25 characters. Emoji cards are great for young students.
- matching: 3–6 "pairs" of item ↔ partner; all "b" values must be different from each other.
- wordsearch: 4–8 "words" from the topic, each 2–10 Hebrew letters, single words, no nikud, no spaces.
- order: 3–7 "items" listed in the CORRECT order (the app shuffles them).
- blanks: "passage" is a short text (1–4 sentences) where each word the student must fill in is wrapped in square brackets, e.g. "השמש [זורחת] במזרח". 2–6 blanks. Put 0–3 wrong-but-plausible words in "distractors".
- truefalse: 3–6 "statements", each with "t" true or false; mix true and false.
- Every task: a short "title" (2–5 words), one fitting "emoji", and a realistic "estMinutes".
- "text" for games is the instruction line, for example "מצאו את כל הזוגות".

Path fields: "title" is short and inviting, "description" is one sentence the student sees at the start, and pick an "icon" and "color" that fit the topic.`;

function nikudInstruction(withNikud) {
  return withNikud
    ? 'Write all student-facing Hebrew text with full nikud (vowel points), except the words of a wordsearch task, which stay without nikud.'
    : 'Write Hebrew without nikud.';
}

export function buildRequestText(input) {
  const lines = [
    `Topic: ${input.topic}`,
    `Grade: ${input.grade}`,
    `Number of tasks: about ${input.taskCount}`,
    input.goals && `Learning goals:\n${input.goals}`,
    input.notes && `Notes from the teacher about the students or the lesson:\n${input.notes}`,
    `Allowed task types: ${input.types.join(', ')}`,
    nikudInstruction(input.nikud),
    input.fileNames.length
      ? `The teacher attached source material (above): ${input.fileNames.join(', ')}. Base the content on it.`
      : 'No source material was attached; use accurate, curriculum-appropriate content for this grade.',
  ];
  return lines.filter(Boolean).join('\n\n');
}

// Converts uploaded files into Claude content blocks.
export function fileBlocks(files) {
  if (!Array.isArray(files)) return { blocks: [], names: [] };
  if (files.length > MAX_FILES) throw new HttpError(400, `אפשר לצרף עד ${MAX_FILES} קבצים`);
  let total = 0;
  const blocks = [];
  const names = [];
  for (const f of files) {
    const name = String(f?.name || 'קובץ').slice(0, 120);
    const type = String(f?.type || '');
    const data = typeof f?.data === 'string' ? f.data : '';
    const buf = Buffer.from(data, 'base64');
    if (!buf.length) throw new HttpError(400, `הקובץ "${name}" ריק או לא נקרא`);
    if (buf.length > MAX_FILE_BYTES) throw new HttpError(400, `הקובץ "${name}" גדול מדי (עד 10MB)`);
    total += buf.length;
    if (total > MAX_TOTAL_BYTES) throw new HttpError(400, 'הקבצים גדולים מדי יחד (עד 20MB)');

    if (type === 'application/pdf' || /\.pdf$/i.test(name)) {
      blocks.push({ type: 'document', title: name, source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } });
    } else if (IMAGE_TYPES.includes(type)) {
      blocks.push({ type: 'image', source: { type: 'base64', media_type: type, data: buf.toString('base64') } });
    } else if (type === DOCX_TYPE || /\.docx$/i.test(name)) {
      let text;
      try {
        text = docxToText(buf);
      } catch {
        throw new HttpError(400, `לא הצלחנו לקרוא את הקובץ "${name}"`);
      }
      blocks.push({ type: 'document', title: name, source: { type: 'text', media_type: 'text/plain', data: text || '(empty)' } });
    } else if (type.startsWith('text/') || TEXT_EXT.test(name)) {
      blocks.push({ type: 'document', title: name, source: { type: 'text', media_type: 'text/plain', data: buf.toString('utf8') } });
    } else {
      throw new HttpError(400, `סוג הקובץ "${name}" לא נתמך. אפשר PDF, Word‏ (docx), תמונה או טקסט.`);
    }
    names.push(name);
  }
  return { blocks, names };
}

// ---------- the call ----------

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
}

// Returns generatePath(input) -> raw path object (validated later by the caller).
export function createGenerator(client = new Anthropic({ timeout: 10 * 60 * 1000 })) {
  return async function generatePath(input) {
    const { blocks, names } = fileBlocks(input.files);
    let message;
    try {
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'high', format: { type: 'json_schema', schema: pathSchema(input.types) } },
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [...blocks, { type: 'text', text: buildRequestText({ ...input, fileNames: names }) }],
        }],
      });
      message = await stream.finalMessage();
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        throw new HttpError(503, 'מחולל המסלולים לא מוגדר כראוי (מפתח API שגוי). פנו למנהל/ת המערכת.');
      }
      if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, 'המחולל עמוס כרגע. נסו שוב בעוד דקה.');
      if (err instanceof Anthropic.BadRequestError) {
        console.error('AI bad request:', err.message);
        throw new HttpError(400, 'המחולל לא הצליח לעבד את הבקשה. אם צירפתם קבצים, נסו קבצים קטנים יותר.');
      }
      if (err instanceof Anthropic.APIError) {
        console.error('AI API error:', err.status, err.message);
        throw new HttpError(502, 'המחולל לא זמין כרגע. נסו שוב בעוד כמה דקות.');
      }
      throw err;
    }

    if (message.stop_reason === 'refusal') {
      throw new HttpError(422, 'המחולל לא יכול ליצור מסלול לבקשה הזו. נסו לנסח את הנושא אחרת.');
    }
    if (message.stop_reason === 'max_tokens') {
      throw new HttpError(422, 'המסלול יצא ארוך מדי. נסו פחות משימות או קבצים קצרים יותר.');
    }
    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    try {
      return JSON.parse(text);
    } catch {
      throw new HttpError(502, 'המחולל החזיר תשובה לא תקינה. נסו שוב.');
    }
  };
}
