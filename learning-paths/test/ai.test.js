import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { openDb } from '../db.js';
import { createApp } from '../server.js';
import { createGenerator, pathSchema } from '../ai.js';
import { docxToText } from '../docx.js';

const docx = fs.readFileSync(new URL('./fixtures/sample.docx', import.meta.url));

const SAMPLE_PATH = {
  title: 'מחזור המים',
  description: 'נלמד איך המים מסתובבים בטבע.',
  icon: '🌈',
  color: '#0984e3',
  tasks: [
    { type: 'checklist', title: 'מתכוננים', emoji: '🎒', estMinutes: 2, text: 'לפני שמתחילים:', items: ['שולחן נקי', 'עיפרון'] },
    { type: 'read', title: 'מה זה אידוי?', emoji: '☀️', estMinutes: 3, text: 'כשהשמש מחממת את המים, הם הופכים לאדים.' },
    { type: 'memory', title: 'זוגות', emoji: '🃏', estMinutes: 4, text: 'מצאו זוגות', pairs: [{ a: '☀️', b: 'אידוי' }, { a: '☁️', b: 'עיבוי' }, { a: '🌧️', b: 'משקעים' }] },
    { type: 'choice', title: 'בדיקה', emoji: '🤔', estMinutes: 2, text: 'מה יוצר עננים?', options: ['עיבוי', 'המסה'], correct: 0, explanation: 'נכון!' },
    { type: 'timer', title: 'ציור', emoji: '⏱️', estMinutes: 500, text: 'ציירו את המחזור', minutes: 500 },
    // invalid: a choice with a single option is dropped, not saved
    { type: 'choice', title: 'שבורה', emoji: '❌', estMinutes: 2, text: '?', options: ['רק אחת'], correct: 0, explanation: '' },
    // not in the allowed types for the request below
    { type: 'wordsearch', title: 'תפזורת', emoji: '🔍', estMinutes: 4, text: 'מצאו', words: ['מים', 'ענן', 'גשם'] },
  ],
};

// ---------- route tests with a fake generator ----------

let server;
let base;
let lastInput;
let nextResult = SAMPLE_PATH;

before(async () => {
  const ai = { enabled: true, generatePath: async (input) => { lastInput = input; return structuredClone(nextResult); } };
  server = http.createServer(createApp(openDb(':memory:'), { ai }));
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

async function teacherClient() {
  let cookie = '';
  const c = async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json() };
  };
  await c('POST', '/api/auth/register', { name: 'מורה', email: `ai${Math.random()}@x.org`, password: 'password123' });
  return c;
}

test('generate route validates input and saves only valid tasks as a draft', async () => {
  const c = await teacherClient();
  assert.equal((await c('GET', '/api/ai/status')).body.enabled, true);
  assert.equal((await c('POST', '/api/ai/generate', { topic: '', grade: 'ג׳' })).status, 400);
  assert.equal((await c('POST', '/api/ai/generate', { topic: 'מים', grade: 'כיתה מוזרה' })).status, 400);

  const types = ['checklist', 'read', 'memory', 'choice', 'timer'];
  const r = await c('POST', '/api/ai/generate', { topic: 'מחזור המים', grade: 'ג׳', goals: 'להכיר את השלבים', taskCount: 6, types, nikud: true });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.taskCount, 5);
  assert.equal(r.body.skipped, 2);
  assert.deepEqual([...lastInput.types].sort(), [...types].sort());
  assert.equal(lastInput.nikud, true);

  const { body } = await c('GET', `/api/paths/${r.body.path.id}`);
  assert.equal(body.path.published, false, 'AI paths start as drafts');
  assert.equal(body.path.theme.icon, '🌈');
  assert.equal(body.path.theme.color, '#0984e3');
  assert.deepEqual(body.tasks.map((t) => t.type), ['checklist', 'read', 'memory', 'choice', 'timer']);
  const timer = body.tasks.find((t) => t.type === 'timer');
  assert.equal(timer.content.minutes, 60, 'out-of-range numbers are clamped');
  assert.equal(timer.estMinutes, 120);
});

test('generate route rejects output with no usable tasks', async () => {
  const c = await teacherClient();
  nextResult = { title: 'x', description: '', icon: '🚀', color: '#6c5ce7', tasks: [{ type: 'choice', title: 'x', options: [] }] };
  const r = await c('POST', '/api/ai/generate', { topic: 'x', grade: 'א׳' });
  assert.equal(r.status, 502);
  nextResult = SAMPLE_PATH;
});

test('generate route is unavailable when AI is not configured', async () => {
  const s = http.createServer(createApp(openDb(':memory:'), { ai: { enabled: false } }));
  await new Promise((r) => s.listen(0, r));
  const url = `http://localhost:${s.address().port}`;
  const reg = await fetch(`${url}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'm', email: 'off@x.org', password: 'password123' }),
  });
  const cookie = reg.headers.get('set-cookie').split(';')[0];
  const r = await fetch(`${url}/api/ai/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ topic: 'x', grade: 'א׳' }),
  });
  assert.equal(r.status, 503);
  s.close();
});

// ---------- the real SDK call, against a local mock of the Messages API ----------

function sse(events) {
  return events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
}

function mockAnthropic(reply) {
  const seen = [];
  const srv = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    seen.push({ url: req.url, headers: req.headers, body: JSON.parse(raw) });
    const { text, stopReason = 'end_turn' } = reply;
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end(sse([
      ['message_start', { type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } }],
      ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
      ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text.slice(0, 20) } }],
      ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text.slice(20) } }],
      ['content_block_stop', { type: 'content_block_stop', index: 0 }],
      ['message_delta', { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 50 } }],
      ['message_stop', { type: 'message_stop' }],
    ]));
  });
  return { srv, seen };
}

const INPUT = {
  topic: 'מחזור המים', grade: 'ג׳', goals: 'להכיר את השלבים', notes: '', taskCount: 6,
  types: ['read', 'memory', 'choice'], nikud: true,
  files: [
    { name: 'דף עבודה.pdf', type: 'application/pdf', data: Buffer.from('%PDF-1.4 test').toString('base64') },
    { name: 'סיכום.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: docx.toString('base64') },
    { name: 'הערות.txt', type: 'text/plain', data: Buffer.from('מים הם חיים').toString('base64') },
    { name: 'תמונה.png', type: 'image/png', data: Buffer.from('fakepng').toString('base64') },
  ],
};

test('generator sends a well-formed streaming request and parses the result', async () => {
  const { srv, seen } = mockAnthropic({ text: JSON.stringify(SAMPLE_PATH) });
  await new Promise((r) => srv.listen(0, r));
  const client = new Anthropic({ apiKey: 'test-key', baseURL: `http://localhost:${srv.address().port}`, maxRetries: 0 });
  const out = await createGenerator(client)(INPUT);
  srv.close();

  assert.deepEqual(out, SAMPLE_PATH);
  const req = seen[0];
  assert.match(req.url, /\/v1\/messages/);
  assert.match(req.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.equal(req.body.model, 'claude-opus-5-5');
  assert.equal(req.body.stream, true);
  assert.equal(req.body.fallbacks, 'default');
  assert.equal(req.body.output_config.format.type, 'json_schema');
  assert.equal(req.body.thinking, undefined, 'Opus 5.5 always thinks; no thinking param');
  const variants = req.body.output_config.format.schema.properties.tasks.items.anyOf;
  assert.deepEqual(variants.map((x) => x.properties.type.const), ['read', 'memory', 'choice']);

  const content = req.body.messages[0].content;
  assert.deepEqual(content.map((b) => b.type), ['document', 'document', 'document', 'image', 'text']);
  assert.equal(content[0].source.media_type, 'application/pdf');
  assert.match(content[1].source.data, /המים מתאדים\t& עולים לשמיים\./);
  assert.equal(content[2].source.data, 'מים הם חיים');
  assert.match(content[4].text, /Topic: מחזור המים/);
  assert.match(content[4].text, /full nikud/);
});

test('generator turns a refusal into a friendly error', async () => {
  const { srv } = mockAnthropic({ text: '', stopReason: 'refusal' });
  await new Promise((r) => srv.listen(0, r));
  const client = new Anthropic({ apiKey: 'test-key', baseURL: `http://localhost:${srv.address().port}`, maxRetries: 0 });
  await assert.rejects(createGenerator(client)({ ...INPUT, files: [] }), (e) => e.status === 422);
  srv.close();
});

test('generator rejects unsupported files before calling the API', async () => {
  const client = new Anthropic({ apiKey: 'test-key', baseURL: 'http://localhost:9', maxRetries: 0 });
  const bad = { ...INPUT, files: [{ name: 'x.exe', type: 'application/octet-stream', data: 'AAAA' }] };
  await assert.rejects(createGenerator(client)(bad), (e) => e.status === 400);
});

test('schema: every object forbids extra properties and lists all fields as required', () => {
  const walk = (node) => {
    if (node?.type === 'object') {
      assert.equal(node.additionalProperties, false);
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort());
      Object.values(node.properties).forEach(walk);
    }
    if (node?.items) walk(node.items);
    node?.anyOf?.forEach(walk);
  };
  walk(pathSchema());
});

test('docx text extraction', () => {
  assert.equal(docxToText(docx), 'מחזור המים\nהמים מתאדים\t& עולים לשמיים.');
});
