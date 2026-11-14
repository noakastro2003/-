import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openDb } from '../db.js';
import { createApp, sniffMedia } from '../server.js';

const SECRET = ['🍎', '🐶', '🚗'];
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(40, 2)]);

let nikudReply = 'שָׁלוֹם';
let improveReply;
let failNext = false;
const ai = {
  enabled: true,
  generatePath: async () => { throw new Error('unused'); },
  nikud: async () => nikudReply,
  improveTask: async (task, request) => {
    if (failNext) { failNext = false; throw new Error('boom'); }
    improveReply.request = request;
    return structuredClone(improveReply.out);
  },
};

let server;
let base;
before(async () => {
  server = http.createServer(createApp(openDb(':memory:'), { ai }));
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

function client() {
  let cookie = '';
  return async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const type = res.headers.get('content-type') || '';
    return { status: res.status, type, body: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
  };
}
async function teacher() {
  const c = client();
  await c('POST', '/api/auth/register', { name: 'מורה', email: `t${Math.random()}@x.org`, password: 'password123' });
  return c;
}

test('file type comes from the bytes, not the name', () => {
  assert.equal(sniffMedia(PNG), 'image/png');
  assert.equal(sniffMedia(WEBM), 'audio/webm');
  assert.equal(sniffMedia(Buffer.from('<html><script>alert(1)</script></html>')), null);
});

test('uploading and serving pictures and recordings', async () => {
  const t = await teacher();
  assert.equal((await client()('POST', '/api/media', { data: PNG.toString('base64') })).status, 401);
  assert.equal((await t('POST', '/api/media', { data: Buffer.from('<svg onload=alert(1)></svg>').toString('base64') })).status, 400);
  const img = await t('POST', '/api/media', { data: PNG.toString('base64') });
  assert.equal(img.status, 201);
  assert.match(img.body.url, /^\/api\/media\/[0-9a-f]{32}$/);
  const got = await client()('GET', img.body.url);
  assert.equal(got.status, 200);
  assert.equal(got.type, 'image/png');
  assert.deepEqual(got.body, PNG);
  const rec = await t('POST', '/api/media', { data: WEBM.toString('base64') });

  // Tasks can carry them; a student sees them too.
  const { body: { path } } = await t('POST', '/api/paths', { title: 'מדיה' });
  const task = await t('POST', `/api/paths/${path.id}/tasks`, { type: 'question', title: 'q', content: { text: 'מה?', image: img.body.url, audio: rec.body.url } });
  assert.equal(task.status, 201);
  assert.equal((await t('POST', `/api/paths/${path.id}/tasks`, { type: 'read', title: 'x', content: { audio: 'javascript:alert(1)' } })).status, 400);
  await t('PUT', `/api/paths/${path.id}`, { published: true });
  const view = await client()('GET', `/api/s/${path.code}`);
  assert.deepEqual([view.body.tasks[0].content.image, view.body.tasks[0].content.audio], [img.body.url, rec.body.url]);
});

test('automatic nikud costs a credit and flags changed words', async () => {
  const t = await teacher();
  nikudReply = 'שָׁלוֹם יְלָדִים';
  let r = await t('POST', '/api/ai/nikud', { text: 'שלום ילדים' });
  assert.deepEqual([r.body.text, r.body.changed, r.body.credits], ['שָׁלוֹם יְלָדִים', false, 19]);
  nikudReply = 'שָׁלוֹם חֲבֵרִים';
  r = await t('POST', '/api/ai/nikud', { text: 'שלום ילדים' });
  assert.equal(r.body.changed, true);
});

test('improve a task: validated, keeps the teacher\'s media, refunds on failure', async () => {
  const t = await teacher();
  const task = {
    type: 'choice', title: 'בדיקה', emoji: '🤔', estMinutes: 3, needsApproval: true,
    content: { text: 'כמה רגליים לעכביש?', options: ['6', '8'], correct: 1, explanation: '', image: '/api/media/0123456789abcdef0123456789abcdef' },
  };
  improveReply = { out: { type: 'choice', title: 'רגליים', emoji: '🕷️', estMinutes: 2, text: 'לעכביש יש…', options: ['6', '8', '10'], correct: 1, explanation: 'נכון!' } };
  const r = await t('POST', '/api/ai/improve-task', { task, kind: 'more' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.task.content.options, ['6', '8', '10']);
  assert.equal(r.body.task.content.image, task.content.image);
  assert.equal(r.body.task.needsApproval, true);
  assert.equal(r.body.credits, 18);
  assert.deepEqual(improveReply.request, { kind: 'more', custom: '' });

  assert.equal((await t('POST', '/api/ai/improve-task', { task, kind: 'custom' })).status, 400, 'custom needs words');
  improveReply = { out: { type: 'read', title: 'x', emoji: '', estMinutes: 2, text: 'y' } };
  assert.equal((await t('POST', '/api/ai/improve-task', { task, kind: 'simpler' })).status, 502, 'must keep the type');
  failNext = true;
  assert.equal((await t('POST', '/api/ai/improve-task', { task, kind: 'simpler' })).status, 500);
  const b = (await t('GET', '/api/billing')).body;
  assert.equal(b.available, 18, 'failed attempts are refunded');
});

test('stuck data: wrong attempts and time on task', async () => {
  const t = await teacher();
  const { body: { path } } = await t('POST', '/api/paths', { title: 'נתונים' });
  const q = (await t('POST', `/api/paths/${path.id}/tasks`, {
    type: 'truefalse', title: 'נ/לנ', content: { statements: [{ s: 'א', t: true }] },
  })).body.task;
  await t('PUT', `/api/paths/${path.id}`, { published: true });
  const kid = client();
  const { body: { token, student } } = await kid('POST', `/api/s/${path.code}/join`, { name: 'עדי', secret: SECRET });
  const auth = { 'X-Student-Token': token };
  await kid('POST', `/api/s/${path.code}/tasks/${q.id}/open`, {}, auth);
  for (let i = 0; i < 3; i++) await kid('POST', `/api/s/${path.code}/tasks/${q.id}/complete`, { answer: [false] }, auth);
  await kid('POST', `/api/s/${path.code}/tasks/${q.id}/complete`, { answer: [true] }, auth);
  const prog = (await t('GET', `/api/paths/${path.id}/progress`)).body;
  assert.equal(prog.wrong[student.id][q.id], 3);
  assert.equal(typeof prog.students[0].done[q.id].durationSec, 'number');
});
