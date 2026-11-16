import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openDb } from '../db.js';
import { createApp } from '../server.js';

const SECRET = ['🍎', '🐶', '🚗'];
let server;
let base;
before(async () => {
  server = http.createServer(createApp(openDb(':memory:'), { ai: { enabled: false } }));
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
    return { status: res.status, body: await res.json() };
  };
}
async function teacher(name = 'מורה טובה') {
  const c = client();
  await c('POST', '/api/auth/register', { name, email: `t${Math.random()}@x.org`, password: 'password123' });
  return c;
}
async function pathWith(t, titles) {
  const { body: { path } } = await t('POST', '/api/paths', { title: 'מסלול' });
  const tasks = [];
  for (const title of titles) tasks.push((await t('POST', `/api/paths/${path.id}/tasks`, { type: 'read', title, content: { text: 'x' } })).body.task);
  await t('PUT', `/api/paths/${path.id}`, { published: true });
  return { path, tasks };
}

test('opening and closing times', async () => {
  const t = await teacher();
  const { path, tasks } = await pathWith(t, ['א']);
  const hour = 3600e3;
  assert.equal((await t('PUT', `/api/paths/${path.id}`, { opensAt: Date.now() + hour, closesAt: Date.now() })).status, 400);
  await t('PUT', `/api/paths/${path.id}`, { opensAt: Date.now() + hour });
  const kid = client();
  const early = await kid('GET', `/api/s/${path.code}`);
  assert.equal(early.status, 403);
  assert.match(early.body.error, /ייפתח/);
  assert.equal((await t('GET', `/api/s/${path.code}`)).status, 200, 'the teacher can still preview');

  await t('PUT', `/api/paths/${path.id}`, { opensAt: null });
  const { body: { token } } = await kid('POST', `/api/s/${path.code}/join`, { name: 'גל', secret: SECRET });
  await t('PUT', `/api/paths/${path.id}`, { closesAt: Date.now() - 1000 });
  const view = await kid('GET', `/api/s/${path.code}`);
  assert.equal(view.body.path.closed, true);
  const done = await kid('POST', `/api/s/${path.code}/tasks/${tasks[0].id}/complete`, {}, { 'X-Student-Token': token });
  assert.equal(done.status, 403);
  assert.match(done.body.error, /נסגר/);
});

test('hiding tasks from one student and their own breaks', async () => {
  const t = await teacher();
  const { path, tasks } = await pathWith(t, ['א', 'ב', 'ג']);
  const kid = client();
  const { body: { token, student } } = await kid('POST', `/api/s/${path.code}/join`, { name: 'נוי', secret: SECRET });
  assert.equal((await t('PUT', `/api/students/${student.id}/adapt`, { hidden: tasks.map((x) => x.id) })).status, 400, 'not all of them');
  const r = await t('PUT', `/api/students/${student.id}/adapt`, { hidden: [tasks[1].id, 99999], breakEvery: 1 });
  assert.deepEqual(r.body.adapt, { hidden: [tasks[1].id], breakEvery: 1 });
  const me = await kid('GET', `/api/s/${path.code}/me`, undefined, { 'X-Student-Token': token });
  assert.deepEqual(me.body.adapt, { hidden: [tasks[1].id], breakEvery: 1 });
  assert.equal((await (await teacher())('PUT', `/api/students/${student.id}/adapt`, { hidden: [] })).status, 404, 'only the path\'s teacher');
  const prog = (await t('GET', `/api/paths/${path.id}/progress`)).body;
  assert.deepEqual(prog.students[0].adapt.hidden, [tasks[1].id]);
});

test('shared library: share, browse, preview, copy', async () => {
  const a = await teacher('רינה כהן');
  const { path } = await pathWith(a, ['שבר', 'עשרוני']);
  const empty = (await a('POST', '/api/paths', { title: 'ריק' })).body.path;
  assert.equal((await a('PUT', `/api/paths/${empty.id}/share`, { shared: true })).status, 400);
  await a('PUT', `/api/paths/${path.id}/share`, { shared: true, grade: 'ה׳', subject: 'חשבון' });

  const b = await teacher('דנה');
  const lib = (await b('GET', '/api/library')).body.items;
  const item = lib.find((x) => x.id === path.id);
  assert.deepEqual([item.author, item.grade, item.subject, item.taskCount, item.mine], ['רינה', 'ה׳', 'חשבון', 2, false]);
  assert.equal(JSON.stringify(item).includes('approval'), false);
  assert.equal((await b('GET', `/api/library/${path.id}`)).body.tasks.length, 2);
  assert.equal((await b('GET', `/api/library/${empty.id}`)).status, 404, 'unshared paths stay private');
  const copy = await b('POST', `/api/library/${path.id}/copy`);
  assert.equal(copy.status, 201);
  assert.equal(copy.body.credits, 19);
  assert.notEqual(copy.body.path.code, path.code);
  assert.equal(copy.body.path.published, false);
  assert.equal((await b('GET', '/api/library')).body.items.find((x) => x.id === path.id).copies, 1);
  await a('PUT', `/api/paths/${path.id}/share`, { shared: false });
  assert.equal((await b('GET', '/api/library')).body.items.some((x) => x.id === path.id), false);
});
