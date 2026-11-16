// AI path generator: turns a teacher's topic, grade, goals and files into a draft path.
import zlib from 'node:zlib';
import Anthropic from '@anthropic-ai/sdk';
import { HttpError } from './validate.js';
import { docxToText } from './docx.js';
import { SYSTEM_PROMPT, AI_TASK_TYPES, ICONS, COLORS, buildRequestText, NIKUD_SYSTEM, improvePrompt, jsonFormatInstructions } from './ai-prompt.js';

export { GRADES, AI_TASK_TYPES, SYSTEM_PROMPT, buildRequestText } from './ai-prompt.js';

const MODEL = 'claude-opus-5-5';

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
  lines: { pairs },
  sort: {
    groups: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['name', 'items'], properties: { name: s, items: strings } },
    },
  },
  voice: {},
  dictation: { words: strings },
  flashcards: { cards: pairs },
  highlight: { passage: s },
  photo: {},
  draw: {},
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

// Converts uploaded files into Claude content blocks.
export async function fileBlocks(files) {
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
        text = await docxToText(buf, (d) => zlib.inflateRawSync(d, { maxOutputLength: 50 * 1024 * 1024 }));
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

// Environment variables: Netlify Functions offer Netlify.env (which also sees variables the
// platform injects, like the AI Gateway's); elsewhere process.env.
export const envVar = (k) => globalThis.Netlify?.env?.get?.(k) ?? process.env[k];

// Checked on every request: on Netlify the AI Gateway may inject the key after start-up.
export function aiConfigured() {
  return Boolean(envVar('ANTHROPIC_API_KEY') || envVar('ANTHROPIC_AUTH_TOKEN') || envVar('ANTHROPIC_PROFILE'));
}

// Which AI settings exist (never their values), for the admin to diagnose a disabled generator.
export const aiEnvReport = () => Object.fromEntries(
  ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'NETLIFY_AI_GATEWAY_KEY', 'NETLIFY_AI_GATEWAY_URL'].map((k) => [k, Boolean(envVar(k))]),
);

const ERRORS = {
  generate: { refusal: 'המחולל לא יכול ליצור מסלול לבקשה הזו. נסו לנסח את הנושא אחרת.', long: 'המסלול יצא ארוך מדי. נסו פחות משימות או קבצים קצרים יותר.' },
  nikud: { refusal: 'לא הצלחנו לנקד את הטקסט הזה.', long: 'הטקסט ארוך מדי לניקוד בבת אחת. נסו חלק קצר יותר.' },
  improve: { refusal: 'לא הצלחנו לשפר את המשימה לפי הבקשה הזו. נסו לנסח אחרת.', long: 'המשימה יצאה ארוכה מדי. נסו בקשה אחרת.' },
};

// One streamed call to Claude with the app's error handling. Returns the reply text.
async function callClaude(client, params, kind) {
  let message;
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      ...params,
    });
    message = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new HttpError(503, 'הבינה המלאכותית לא מוגדרת כראוי (מפתח API שגוי). פנו להנהלת המערכת.');
    }
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, 'השירות עמוס כרגע. נסו שוב בעוד דקה.');
    if (err instanceof Anthropic.BadRequestError) {
      console.error('AI bad request:', err.message);
      throw new HttpError(400, 'לא הצלחנו לעבד את הבקשה. אם צירפתם קבצים, נסו קבצים קטנים יותר.');
    }
    if (err instanceof Anthropic.APIError) {
      console.error('AI API error:', err.status, err.message);
      throw new HttpError(502, 'השירות לא זמין כרגע. נסו שוב בעוד כמה דקות.');
    }
    throw err;
  }
  if (message.stop_reason === 'refusal') throw new HttpError(422, ERRORS[kind].refusal);
  if (message.stop_reason === 'max_tokens') throw new HttpError(422, ERRORS[kind].long);
  return message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

// The model's JSON, also when it wraps it in a code fence or adds a sentence around it.
export const parseJson = (text) => {
  const t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  for (const candidate of [t, t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)]) {
    try {
      return JSON.parse(candidate);
    } catch { /* try the next */ }
  }
  throw new HttpError(502, 'התקבלה תשובה לא תקינה. נסו שוב.');
};

// The schema of one task type, for "improve this task".
export function taskSchema(type) {
  return pathSchema([type]).properties.tasks.items.anyOf[0];
}

// Returns { generatePath, nikud, improveTask }, each validated by the caller.
export function createAiTools(client = new Anthropic({
  timeout: 10 * 60 * 1000,
  apiKey: envVar('ANTHROPIC_API_KEY') || null,
  baseURL: envVar('ANTHROPIC_BASE_URL') || undefined,
})) {
  return {
    async generatePath(input) {
      const { blocks, names } = await fileBlocks(input.files);
      // The shape goes in the prompt, not as a JSON schema: a schema covering every task
      // type is too large for structured outputs ("compiled grammar is too large").
      // pathFromAi() validates every task that comes back, and drops broken ones.
      const ask = () => callClaude(client, {
        max_tokens: 32000,
        output_config: { effort: 'high' },
        system: `${SYSTEM_PROMPT}\n\n${jsonFormatInstructions(input.types)}`,
        messages: [{
          role: 'user',
          content: [...blocks, { type: 'text', text: buildRequestText({ ...input, fileNames: names }) }],
        }],
      }, 'generate');
      try {
        return parseJson(await ask());
      } catch (err) {
        if (!(err instanceof HttpError) || err.status !== 502) throw err;
        return parseJson(await ask()); // one more try on unreadable output
      }
    },

    async nikud(text) {
      return (await callClaude(client, {
        max_tokens: 16000,
        system: NIKUD_SYSTEM,
        messages: [{ role: 'user', content: text }],
      }, 'nikud')).trim();
    },

    async improveTask(task, request) {
      const text = await callClaude(client, {
        max_tokens: 16000,
        output_config: { format: { type: 'json_schema', schema: taskSchema(task.type) } },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: improvePrompt(task, request) }],
      }, 'improve');
      return parseJson(text);
    },
  };
}

// Kept for callers and tests that only need the path generator.
export function createGenerator(client) {
  return createAiTools(client).generatePath;
}
