import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openDb } from '../db.js';
import { createApp } from '../server.js';

let server;
let base;

before(async () => {
  server = http.createServer(createApp(openDb(':memory:')));
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

// Tiny client that keeps its own cookie jar.
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
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

async function teacher(email = `t${Math.random()}@school.org`) {
  const c = client();
  const r = await c('POST', '/api/auth/register', { name: 'מורה', email, password: 'password123' });
  assert.equal(r.status, 201);
  return c;
}

test('register, login, logout', async () => {
  const c = client();
  assert.equal((await c('POST', '/api/auth/register', { name: 'דנה', email: 'dana@x.org', password: 'short' })).status, 400);
  assert.equal((await c('POST', '/api/auth/register', { name: 'דנה', email: 'dana@x.org', password: 'password123' })).status, 201);
  assert.equal((await c('POST', '/api/auth/register', { name: 'דנה', email: 'DANA@x.org', password: 'password123' })).status, 409);
  assert.equal((await c('GET', '/api/auth/me')).body.teacher.name, 'דנה');
  await c('POST', '/api/auth/logout');
  assert.equal((await c('GET', '/api/auth/me')).body.teacher, null);
  assert.equal((await c('POST', '/api/auth/login', { email: 'dana@x.org', password: 'wrong-pass' })).status, 401);
  assert.equal((await c('POST', '/api/auth/login', { email: 'dana@x.org', password: 'password123' })).status, 200);
  assert.equal((await c('GET', '/api/paths')).status, 200);
});

test('paths require auth and are private to their teacher', async () => {
  const anon = client();
  assert.equal((await anon('GET', '/api/paths')).status, 401);
  const a = await teacher();
  const b = await teacher();
  const { body } = await a('POST', '/api/paths', { title: 'מסלול א' });
  assert.equal((await b('GET', `/api/paths/${body.path.id}`)).status, 404);
  assert.equal((await b('PUT', `/api/paths/${body.path.id}`, { title: 'x' })).status, 404);
  assert.equal((await b('DELETE', `/api/paths/${body.path.id}`)).status, 404);
  assert.equal((await b('POST', `/api/paths/${body.path.id}/tasks`, { type: 'read', title: 'x' })).status, 404);
});

test('task CRUD, ordering and theme validation', async () => {
  const c = await teacher();
  const { body: { path } } = await c('POST', '/api/paths', { title: 'שברים', template: 'sample' });
  let { body } = await c('GET', `/api/paths/${path.id}`);
  assert.equal(body.tasks.length, 5);

  const bad = await c('POST', `/api/paths/${path.id}/tasks`, { type: 'choice', title: 'q', content: { options: ['רק אחת'] } });
  assert.equal(bad.status, 400);
  const badUrl = await c('POST', `/api/paths/${path.id}/tasks`, { type: 'link', title: 'q', content: { url: 'javascript:alert(1)' } });
  assert.equal(badUrl.status, 400);

  const add = await c('POST', `/api/paths/${path.id}/tasks`, { type: 'timer', title: 'עבודה', estMinutes: 7, content: { minutes: 7 } });
  assert.equal(add.status, 201);
  assert.equal(add.body.task.content.minutes, 7);

  const ids = (await c('GET', `/api/paths/${path.id}`)).body.tasks.map((t) => t.id);
  const reversed = [...ids].reverse();
  const order = await c('PUT', `/api/paths/${path.id}/order`, { taskIds: reversed });
  assert.deepEqual(order.body.tasks.map((t) => t.id), reversed);
  assert.equal((await c('PUT', `/api/paths/${path.id}/order`, { taskIds: ids.slice(1) })).status, 400);

  const edit = await c('PUT', `/api/tasks/${add.body.task.id}`, { type: 'read', title: 'קריאה', content: { text: 'שלום' } });
  assert.equal(edit.body.task.type, 'read');
  assert.equal((await c('DELETE', `/api/tasks/${add.body.task.id}`)).status, 200);

  assert.equal((await c('PUT', `/api/paths/${path.id}`, { theme: { color: 'red' } })).status, 400);
  assert.equal((await c('PUT', `/api/paths/${path.id}`, { theme: { font: 'comic' } })).status, 400);
  const themed = await c('PUT', `/api/paths/${path.id}`, { theme: { color: '#00A884', map: 'cards', breakEvery: 0 } });
  assert.equal(themed.body.path.theme.color, '#00a884');
  assert.equal(themed.body.path.theme.map, 'cards');
  assert.equal(themed.body.path.theme.icon, '🚀');

  const dup = await c('POST', `/api/paths/${path.id}/duplicate`);
  assert.equal((await c('GET', `/api/paths/${dup.body.path.id}`)).body.tasks.length, 5);
  assert.notEqual(dup.body.path.code, path.code);
});

test('student flow: join, complete, help, teacher progress', async () => {
  const t = await teacher();
  const { body: { path } } = await t('POST', '/api/paths', { title: 'מסלול', template: 'sample' });
  const kid = client();

  // Draft paths are hidden from students but visible to their owner as a preview.
  assert.equal((await kid('GET', `/api/s/${path.code}`)).status, 404);
  assert.equal((await t('GET', `/api/s/${path.code}`)).body.preview, true);
  await t('PUT', `/api/paths/${path.id}`, { published: true });

  const view = await kid('GET', `/api/s/${path.code.toLowerCase()}`);
  assert.equal(view.status, 200);
  const choice = view.body.tasks.find((x) => x.type === 'choice');
  assert.equal(choice.content.correct, undefined, 'correct answer must not leak to students');

  const join = await kid('POST', `/api/s/${path.code}/join`, { name: 'יואב' });
  const auth = { 'X-Student-Token': join.body.token };
  const [checklist, read, , , question] = view.body.tasks;

  assert.equal((await kid('POST', `/api/s/${path.code}/tasks/${read.id}/complete`, {})).status, 401);
  assert.equal((await kid('POST', `/api/s/${path.code}/tasks/${checklist.id}/complete`, { answer: [true, false, true] }, auth)).status, 400);
  assert.equal((await kid('POST', `/api/s/${path.code}/tasks/${checklist.id}/complete`, { answer: [true, true, true] }, auth)).body.correct, true);

  const wrong = await kid('POST', `/api/s/${path.code}/tasks/${choice.id}/complete`, { answer: 0 }, auth);
  assert.equal(wrong.body.correct, false);
  await kid('POST', `/api/s/${path.code}/tasks/${question.id}/help`, {}, auth);
  const right = await kid('POST', `/api/s/${path.code}/tasks/${choice.id}/complete`, { answer: 1 }, auth);
  assert.equal(right.body.correct, true);
  assert.match(right.body.explanation, /צב/);
  assert.equal((await kid('POST', `/api/s/${path.code}/tasks/${question.id}/complete`, { answer: '  ' }, auth)).status, 400);

  // Re-joining with the same name resumes the same student.
  const again = await client()('POST', `/api/s/${path.code}/join`, { name: 'יואב' });
  assert.equal(again.body.token, join.body.token);
  assert.equal(Object.keys(again.body.done).length, 2);

  const prog = await t('GET', `/api/paths/${path.id}/progress`);
  assert.equal(prog.body.students.length, 1);
  assert.equal(prog.body.students[0].done[choice.id].answer, 1);
  assert.equal(prog.body.help.length, 1);
  assert.equal((await t('POST', `/api/help/${prog.body.help[0].id}/resolve`)).status, 200);
  assert.equal((await t('GET', `/api/paths/${path.id}/progress`)).body.help.length, 0);

  // Another teacher cannot see or act on this path's students.
  const other = await teacher();
  assert.equal((await other('GET', `/api/paths/${path.id}/progress`)).status, 404);
  assert.equal((await other('DELETE', `/api/students/${prog.body.students[0].id}`)).status, 404);
  assert.equal((await t('DELETE', `/api/students/${prog.body.students[0].id}`)).status, 200);
  assert.equal((await kid('GET', `/api/s/${path.code}/me`, undefined, auth)).status, 401);
});

test('static files and security headers', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(await res.text(), /<html lang="he" dir="rtl">/);
  assert.equal((await fetch(`${base}/js/app.js`)).headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal((await fetch(`${base}/..%2fserver.js`)).status, 404);
  assert.equal((await fetch(`${base}/api/paths`, { method: 'POST', body: 'x', headers: { 'Content-Type': 'text/plain' } })).status, 415);
});
