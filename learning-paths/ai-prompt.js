// The generator's prompt and options, shared by the server (ai.js) and the in-browser demo.
// Pure: no Node or DOM APIs.

export const GRADES = ['גן', 'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳', 'י׳', 'י״א', 'י״ב'];

// Task types the generator may use. 'link' is left out on purpose: the model
// would have to invent URLs, and a dead link is worse than no link. 'hotspot' needs
// the teacher's own picture.
export const AI_TASK_TYPES = ['read', 'question', 'choice', 'checklist', 'timer', 'memory', 'wordsearch', 'matching', 'order', 'blanks', 'truefalse', 'lines', 'sort', 'voice', 'dictation', 'flashcards', 'highlight', 'photo', 'draw', 'numberline'];

export const ICONS = ['🚀', '🌈', '🦄', '🐢', '🦁', '⚽', '🎨', '📚', '🧩', '🌟', '🌱', '🏝️', '🐙', '🎵', '🔬', '🏰'];
export const COLORS = ['#6c5ce7', '#0984e3', '#00a884', '#e17055', '#d63384', '#2d3436'];

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
- lines: the student draws a line from each item to its partner. 3–5 "pairs"; keep both sides short (under 20 characters); all "b" values different.
- sort: the student sorts items into groups. 2–3 "groups", each with a short "name" and 2–5 "items"; every item belongs to exactly one group and appears only once.
- voice: the student records a spoken answer instead of writing. "text" is an open question or a "tell in your own words" prompt that takes under a minute to answer.
- dictation: the student hears each word and types it. 3–8 "words" (single words or very short phrases) from the topic, in plain Hebrew spelling without nikud.
- highlight: the student taps words in a text. "passage" is a short text (1–4 sentences) where each word to tap is wrapped in square brackets, e.g. "הילד [רץ] ו[קפץ] בחצר"; "text" says what to tap (for example "סמנו את כל הפעלים"). 2–8 words to tap.
- photo: the student does work on paper (in the notebook) and photographs it. "text" says exactly what to write, draw or solve on paper.
- draw: the student draws on the screen. "text" says what to draw (for example a picture of the story's hero, or a diagram).
- numberline: the student puts numbers on a number line. "min", "max" and "step" are strings (whole numbers, decimals or fractions like "1/4"); (max − min) / step must be a whole number of at most 20. "labels" is "whole" (only whole numbers are written under the line), "ends" (only min and max) or "all". "targets" are 1–4 numbers to place, each exactly on a tick (min + k × step), written like "3/4", "1 ו-1/2" or "7". Great for fractions, decimals, negative numbers and rounding.
- flashcards: cards the student flips to practice and memorize. 4–12 "cards": "a" is the front (a word, question or exercise) and "b" the back (meaning, answer or result).
- Every task: a short "title" (2–5 words), one fitting "emoji", and a realistic "estMinutes".
- Visual aids (optional, any task): add "visual" when a picture helps understanding, especially in math for young grades or fractions. The app draws it exactly:
  {"kind": "fraction", "n": 3, "d": 4, "shape": "pie"} (or "bar"; n ≤ 3·d, d ≤ 12) — a fraction as a pie or a bar;
  {"kind": "objects", "groups": [{"emoji": "🍎", "count": 5}, {"emoji": "🍎", "count": 3}], "op": "+"} (1–3 groups, up to 20 each; op "+", "−" or "") — objects to count.
  The visual must match the task's content exactly and must not give away an answer the student is asked to find. Use it in about a third of the tasks where it fits; never more than once per task.
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


// The server enforces the output shape with a JSON schema. Where no schema can be
// sent (the in-browser demo), this spells the same shape out in the prompt.
const EXAMPLES = {
  read: { text: '...' },
  question: { text: '...' },
  choice: { text: '...', options: ['...', '...', '...'], correct: 0, explanation: '...' },
  checklist: { text: '...', items: ['...', '...'] },
  timer: { text: '...', minutes: 8 },
  memory: { text: '...', pairs: [{ a: '...', b: '...' }] },
  wordsearch: { text: '...', words: ['...', '...'] },
  matching: { text: '...', pairs: [{ a: '...', b: '...' }] },
  order: { text: '...', items: ['...', '...', '...'] },
  blanks: { text: '...', passage: '... [...] ...', distractors: ['...'] },
  truefalse: { text: '...', statements: [{ s: '...', t: true }] },
  lines: { text: '...', pairs: [{ a: '...', b: '...' }] },
  sort: { text: '...', groups: [{ name: '...', items: ['...', '...'] }] },
  voice: { text: '...' },
  dictation: { text: '...', words: ['...', '...'] },
  flashcards: { text: '...', cards: [{ a: '...', b: '...' }] },
  highlight: { text: '...', passage: '... [...] ...' },
  photo: { text: '...' },
  draw: { text: '...' },
  numberline: { text: '...', min: '0', max: '2', step: '1/4', labels: 'whole', targets: ['3/4', '1 ו-1/2'] },
};

export function jsonFormatInstructions(types) {
  const lines = types.map((t) => `  ${JSON.stringify({ type: t, title: '...', emoji: '...', estMinutes: 3, ...EXAMPLES[t] })}`);
  return [
    'Reply with only one JSON object, no other text, in this shape:',
    '{"title": string, "description": string, "icon": one of ' + JSON.stringify(ICONS) + ', "color": one of ' + JSON.stringify(COLORS) + ', "tasks": [task, ...]}',
    'Each task is one of these shapes (all fields required, exactly these fields):',
    ...lines,
  ].join('\n');
}

// ---------- automatic nikud ----------

export const NIKUD_SYSTEM = `You add nikud (Hebrew vowel points) to Hebrew text for an Israeli teacher's materials for children.
Rules:
- Add full, grammatically correct nikud to every Hebrew word, including dagesh and the shin/sin dot, as in children's books.
- Change nothing else: keep every letter, word, space, line break, punctuation mark, number, emoji, English word and symbol exactly as it is, in the same order. Keep square brackets such as [מילה] exactly where they are.
- If a word already has nikud, keep it unless it is wrong.
- Reply with the text only: no explanations, no quotes, no Markdown.`;

// ---------- improve one task ----------

export const IMPROVE_REQUESTS = {
  simpler: 'Rewrite all student-facing text in simpler, shorter Hebrew that a younger student or a weak reader understands. Keep the same content and the same correct answers.',
  shorter: 'Make the instructions shorter and clearer: one action, as few words as possible. Keep the content and the correct answers.',
  nikud: 'Add full, correct nikud to all student-facing Hebrew text (wordsearch words stay without nikud). Change nothing else.',
  more: 'Add more items (options, pairs, cards, groups items, steps, statements, words or blanks, as fits the task type) on the same topic, staying within the limits for this task type.',
  easier: 'Make the task easier for students who are struggling, while keeping the same learning goal.',
  harder: 'Make the task more challenging for students who finish quickly, while keeping the same learning goal.',
};

// The task in the shape the model returns it, plus what to change.
export function improvePrompt(task, request) {
  const { image, audio, imageUrl, ...content } = task.content || {};
  if (task.type === 'dictation') content.words = content.words.map((x) => x.w);
  if (task.type === 'voice') delete content.maxSeconds;
  const flat = { type: task.type, title: task.title, emoji: task.emoji, estMinutes: task.estMinutes, ...content };
  const ask = IMPROVE_REQUESTS[request.kind] || `The teacher asks (in her own words): ${request.custom}`;
  return [
    'Here is one task from a learning path, as JSON:',
    JSON.stringify(flat),
    `Change it as follows: ${ask}`,
    'Return the whole task as JSON in the same shape and with the same type. Keep anything the request does not ask to change.',
  ].join('\n\n');
}
