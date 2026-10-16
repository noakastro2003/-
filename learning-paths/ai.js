// AI path generator: turns a teacher's topic, grade, goals and files into a draft path.
import zlib from 'node:zlib';
import Anthropic from '@anthropic-ai/sdk';
import { HttpError } from './validate.js';
import { docxToText } from './docx.js';
import { SYSTEM_PROMPT, AI_TASK_TYPES, ICONS, COLORS, buildRequestText } from './ai-prompt.js';

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

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
}

// Returns generatePath(input) -> raw path object (validated later by the caller).
export function createGenerator(client = new Anthropic({ timeout: 10 * 60 * 1000 })) {
  return async function generatePath(input) {
    const { blocks, names } = await fileBlocks(input.files);
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
