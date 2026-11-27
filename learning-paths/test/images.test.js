import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.js';
import { createApp } from '../server.js';
import { webHandler } from '../netlify-app.js';
import { createImageTool, imagePrompt } from '../images.js';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(60, 3)]);
const RAW = {
  title: 'שברים', description: 'מסלול', icon: '🍕', color: '#0984e3',
  tasks: [
    { type: 'read', title: 'פיצה', emoji: '🍕', estMinutes: 3, text: 'חצי פיצה', imagePrompt: 'a pizza cut in half', visual: { kind: 'fraction', n: 1, d: 2 } },
    { type: 'truefalse', title: 'נכון?', emoji: '⚖️', estMinutes: 3, text: '', statements: [{ s: '1/2 > 1/3', t: true }], visual: { kind: 'nonsense' } },
    { type: 'question', title: 'ציירו', emoji: '✏️', estMinutes: 3, text: 'מה ראית?', imagePrompt: 'a cake cut in 4' },
  ],
};

function setup({ fail = false } = {}) {
  const asked = [];
  const app = createApp(openDb(':memory:'), {
    ai: { enabled: true, generatePath: async () => structuredClone(RAW) },
    images: { enabled: true, generate: async (s) => { asked.push(s); if (fail) throw new Error('down'); return { data: PNG, mime: 'image/png' }; } },
  });
  const call = webHandler(() => app);
  let cookie = '';
  const req = async (method, path, body) => {
    const res = await call(new Request(`http://x${path}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body && JSON.stringify(body) }), {});
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: (res.headers.get('content-type') || '').includes('json') ? await res.json() : null };
  };
  return { req, asked };
}

test('the editor\'s AI picture: credits, saved as media, refunded on failure', async () => {
  const { req, asked } = setup();
  await req('POST', '/api/auth/register', { name: 'מורה', email: 'i@x.org', password: 'password123' });
  assert.equal((await req('GET', '/api/ai/status')).body.imagesEnabled, true);
  const r = await req('POST', '/api/ai/image', { prompt: 'חתול על גג' });
  assert.equal(r.status, 200);
  assert.match(r.body.url, /^\/api\/media\/[0-9a-f]{32}$/);
  assert.equal(r.body.credits, 18);
  assert.deepEqual(asked, ['חתול על גג']);
  assert.equal((await req('GET', r.body.url)).status, 200);
  assert.equal((await req('POST', '/api/ai/image', { prompt: '' })).status, 400);

  const bad = setup({ fail: true });
  await bad.req('POST', '/api/auth/register', { name: 'מורה', email: 'j@x.org', password: 'password123' });
  assert.equal((await bad.req('POST', '/api/ai/image', { prompt: 'כלב' })).status, 500);
  assert.equal((await bad.req('GET', '/api/billing')).body.available, 20, 'refunded');
});

test('the generator adds pictures and drawings when asked', async () => {
  const { req, asked } = setup();
  await req('POST', '/api/auth/register', { name: 'מורה', email: 'g@x.org', password: 'password123' });
  const r = await req('POST', '/api/ai/generate', { topic: 'שברים', grade: 'ד׳', types: ['read', 'truefalse', 'question'], images: true });
  assert.equal(r.status, 201);
  assert.equal(r.body.pictures, 2);
  assert.deepEqual(asked, ['a pizza cut in half', 'a cake cut in 4']);
  assert.equal(r.body.credits, 20 - (5 + 3) - 2 * 2, '5 + 1 per task that came out, and 2 per picture');
  const tasks = (await req('GET', `/api/paths/${r.body.path.id}`)).body.tasks;
  assert.match(tasks[0].content.image, /^\/api\/media\//);
  assert.deepEqual(tasks[0].content.visual, { kind: 'fraction', n: 1, d: 2, shape: 'pie' });
  assert.equal(tasks[1].type, 'truefalse', 'a broken drawing only drops the drawing');
  assert.equal(tasks[1].content.visual, undefined);
  assert.equal(tasks[0].imagePrompt, undefined);

  const plain = setup();
  await plain.req('POST', '/api/auth/register', { name: 'מורה', email: 'h@x.org', password: 'password123' });
  const p = await plain.req('POST', '/api/ai/generate', { topic: 'שברים', grade: 'ד׳', types: ['read', 'truefalse', 'question'] });
  assert.equal(p.body.pictures, 0);
  assert.equal(plain.asked.length, 0, 'no pictures unless asked');
});

test('image tool: tries the next model when one is unknown, keeps text out of pictures', async () => {
  process.env.GEMINI_API_KEY = 'test';
  const tried = [];
  const gen = createImageTool(async () => ({
    models: {
      generateContent: async ({ model }) => {
        tried.push(model);
        if (tried.length === 1) throw Object.assign(new Error('model not found'), { status: 404 });
        return { candidates: [{ content: { parts: [{ inlineData: { data: PNG.toString('base64'), mimeType: 'image/png' } }] } }] };
      },
    },
  }));
  const out = await gen('כלב');
  assert.deepEqual(out.data, PNG);
  assert.equal(tried.length, 2);
  assert.match(imagePrompt('x'), /no text/i);
  delete process.env.GEMINI_API_KEY;
});
