// The Netlify adapter: web Request/Response around the app, Blobs-style media, and the
// AI generator as a background job.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.js';
import { createApp } from '../server.js';
import { webHandler } from '../netlify-app.js';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);
const RAW = {
  title: 'שברים', description: 'מסלול', icon: '🍕', color: '#0984e3',
  tasks: [{ type: 'read', title: 'מה זה שבר', emoji: '📖', estMinutes: 3, text: 'שבר הוא חלק' },
    { type: 'truefalse', title: 'נכון?', emoji: '⚖️', estMinutes: 3, text: '', statements: [{ s: '1/2 > 1/3', t: true }] }],
};

test('the API through web Requests, with a media store and background jobs', async () => {
  const blobs = new Map();
  let app;
  let jobRun;
  let fail = false;
  app = createApp(openDb(':memory:'), {
    ai: { enabled: true, generatePath: async () => { if (fail) throw new Error('model down'); return structuredClone(RAW); } },
    mediaStore: { put: async (id, buf) => { blobs.set(id, buf); }, get: async (id) => blobs.get(id) || null },
    startJob: async (id) => { jobRun = app.runJob(id); },
  });
  const fetchApp = webHandler(() => app);
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetchApp(new Request(`https://site.example${path}`, {
      method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }), { ip: '1.2.3.4' });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, res, body: (res.headers.get('content-type') || '').includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
  };

  const reg = await call('POST', '/api/auth/register', { name: 'מורה', email: 'n@x.org', password: 'password123' });
  assert.equal(reg.status, 201);
  assert.match(reg.res.headers.get('set-cookie'), /Secure/, 'https → secure cookie');
  assert.equal((await call('GET', '/api/auth/me')).body.teacher.email, 'n@x.org');

  const up = await call('POST', '/api/media', { data: PNG.toString('base64') });
  assert.equal(up.status, 201);
  assert.equal(blobs.size, 1, 'bytes went to the store');
  const got = await call('GET', up.body.url);
  assert.equal(got.res.headers.get('content-type'), 'image/png');
  assert.deepEqual(got.body, PNG);

  const gen = await call('POST', '/api/ai/generate', { topic: 'שברים', grade: 'ד׳', types: ['read', 'truefalse'] });
  assert.equal(gen.status, 202);
  assert.equal((await call('GET', '/api/billing')).body.available, 15, 'charged when queued');
  await jobRun;
  const job = await call('GET', `/api/ai/jobs/${gen.body.jobId}`);
  assert.equal(job.body.status, 'done');
  assert.equal(job.body.result.taskCount, 2);
  assert.equal((await call('GET', `/api/paths/${job.body.result.path.id}`)).body.tasks.length, 2);

  fail = true;
  const bad = await call('POST', '/api/ai/generate', { topic: 'שברים', grade: 'ד׳', types: ['read', 'truefalse'] });
  await jobRun;
  const failed = await call('GET', `/api/ai/jobs/${bad.body.jobId}`);
  assert.equal(failed.body.status, 'failed');
  assert.equal((await call('GET', '/api/billing')).body.available, 15, 'refunded');
  await app.runJob(bad.body.jobId); // a second call does nothing

  const other = webHandler(() => app);
  const stranger = await other(new Request(`https://site.example/api/ai/jobs/${gen.body.jobId}`), {});
  assert.equal(stranger.status, 401);
});
