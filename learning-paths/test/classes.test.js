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
async function teacher() {
  const c = client();
  await c('POST', '/api/auth/register', { name: 'מורה', email: `t${Math.random()}@x.org`, password: 'password123' });
  return c;
}

test('a class: one code and one login for several paths', async () => {
  const t = await teacher();
  const a = (await t('POST', '/api/paths', { title: 'אחד', template: 'sample' })).body.path;
  const b = (await t('POST', '/api/paths', { title: 'שניים', template: 'sample' })).body.path;
  const draft = (await t('POST', '/api/paths', { title: 'טיוטה' })).body.path;
  await t('PUT', `/api/paths/${a.id}`, { published: true });
  await t('PUT', `/api/paths/${b.id}`, { published: true });

  const cls = (await t('POST', '/api/classes', { name: 'ג׳2' })).body.class;
  assert.match(cls.code, /^[A-Z0-9]{6}$/);
  assert.notEqual(cls.code, a.code);
  assert.equal((await t('PUT', `/api/classes/${cls.id}`, { pathIds: [b.id, a.id, draft.id] })).status, 200);

  // Another teacher can neither see the class nor add their own paths to it.
  const other = await teacher();
  assert.equal((await other('GET', `/api/classes/${cls.id}`)).status, 404);
  const theirs = (await other('POST', '/api/paths', { title: 'שלי' })).body.path;
  assert.equal((await t('PUT', `/api/classes/${cls.id}`, { pathIds: [theirs.id] })).status, 404);

  const kid = client();
  const view = (await kid('GET', `/api/c/${cls.code.toLowerCase()}`)).body;
  assert.equal(view.class.name, 'ג׳2');
  assert.deepEqual(view.paths.map((p) => p.title), ['שניים', 'אחד'], 'published paths, in the teacher\'s order');

  const joined = (await kid('POST', `/api/c/${cls.code}/join`, { name: 'רון', secret: SECRET, avatar: '🦁' })).body;
  const auth = { 'X-Class-Token': joined.token };
  assert.equal((await client()('POST', `/api/c/${cls.code}/join`, { name: 'רון', secret: ['⭐', '⭐', '⭐'] })).status, 403);

  // Entering a path makes (once) a linked student record with the same name and avatar.
  const enter = (await kid('POST', `/api/c/${cls.code}/paths/${a.id}/enter`, {}, auth)).body;
  assert.equal(enter.code, a.code);
  const again = (await kid('POST', `/api/c/${cls.code}/paths/${a.id}/enter`, {}, auth)).body;
  assert.equal(again.token, enter.token);
  assert.equal((await kid('POST', `/api/c/${cls.code}/paths/${draft.id}/enter`, {}, auth)).status, 404, 'drafts stay closed');
  const st = (await kid('GET', `/api/s/${a.code}/me`, undefined, { 'X-Student-Token': enter.token })).body;
  assert.deepEqual([st.student.name, st.student.avatar], ['רון', '🦁']);

  const task = (await t('GET', `/api/paths/${a.id}`)).body.tasks[1];
  await kid('POST', `/api/s/${a.code}/tasks/${task.id}/complete`, {}, { 'X-Student-Token': enter.token });
  const me = (await kid('GET', `/api/c/${cls.code}/me`, undefined, auth)).body;
  assert.equal(me.done[a.id], 1);

  const roster = (await t('GET', `/api/classes/${cls.id}`)).body;
  assert.deepEqual(roster.pathIds, [b.id, a.id, draft.id]);
  assert.equal(roster.members[0].done[a.id], 1);
  assert.equal(roster.taskCounts[a.id], 6);

  // Resetting a member's secret lets them set a new one; removing them ends the class login.
  await t('POST', `/api/class-members/${roster.members[0].id}/reset-secret`);
  assert.deepEqual((await client()('POST', `/api/c/${cls.code}/name`, { name: 'רון' })).body, { exists: true, hasSecret: false });
  await t('DELETE', `/api/class-members/${roster.members[0].id}`);
  assert.equal((await kid('GET', `/api/c/${cls.code}/me`, undefined, auth)).status, 401);
  assert.equal((await t('GET', '/api/classes')).body.classes[0].memberCount, 0);
});

test('a student who joined a path by itself is linked, not duplicated', async () => {
  const t = await teacher();
  const p = (await t('POST', '/api/paths', { title: 'מסלול', template: 'sample' })).body.path;
  await t('PUT', `/api/paths/${p.id}`, { published: true });
  const solo = (await client()('POST', `/api/s/${p.code}/join`, { name: 'מיה', secret: SECRET })).body;
  const cls = (await t('POST', '/api/classes', { name: 'ד׳1' })).body.class;
  await t('PUT', `/api/classes/${cls.id}`, { pathIds: [p.id] });
  const kid = client();
  const { token } = (await kid('POST', `/api/c/${cls.code}/join`, { name: 'מיה', secret: SECRET })).body;
  const enter = (await kid('POST', `/api/c/${cls.code}/paths/${p.id}/enter`, {}, { 'X-Class-Token': token })).body;
  assert.equal(enter.token, solo.token);
  assert.equal((await t('GET', `/api/paths/${p.id}/progress`)).body.students.length, 1);

  // Someone else using the same name with a different secret does not get that record.
  const cls2 = (await t('POST', '/api/classes', { name: 'ד׳2' })).body.class;
  await t('PUT', `/api/classes/${cls2.id}`, { pathIds: [p.id] });
  const intruder = client();
  const j = (await intruder('POST', `/api/c/${cls2.code}/join`, { name: 'מיה', secret: ['⭐', '⭐', '⭐'] })).body;
  const theirs = (await intruder('POST', `/api/c/${cls2.code}/paths/${p.id}/enter`, {}, { 'X-Class-Token': j.token })).body;
  assert.notEqual(theirs.token, solo.token);
  const names = (await t('GET', `/api/paths/${p.id}/progress`)).body.students.map((x) => x.name).sort();
  assert.deepEqual(names, ['מיה', 'מיה (ד׳2)']);
});
