// Sign-up consent and sample path, reading settings, natural read-aloud, parent links,
// co-teachers and class activity.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openDb } from '../db.js';
import { createApp } from '../server.js';
import { wav } from '../tts.js';
import { reading } from '../validate.js';

const SECRET = ['🍎', '🐶', '🚗'];
let server;
let base;
let db;
const spoken = [];
before(async () => {
  db = openDb(':memory:');
  const tts = {
    enabled: true, voiceId: 'fake/voice',
    async speak(text) { spoken.push(text); return { data: Buffer.from('RIFFfake'), mime: 'audio/wav', voiceId: 'fake/voice' }; },
  };
  server = http.createServer(createApp(db, { ai: { enabled: false }, tts }));
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
async function teacher(email = `t${Math.random()}@x.org`) {
  const c = client();
  await c('POST', '/api/auth/register', { name: 'מורה', email, password: 'password123', acceptTerms: true });
  c.email = email;
  return c;
}
async function pathWith(t, titles) {
  const { body: { path } } = await t('POST', '/api/paths', { title: 'מסלול' });
  const tasks = [];
  for (const title of titles) tasks.push((await t('POST', `/api/paths/${path.id}/tasks`, { type: 'read', title, content: { text: 'x' } })).body.task);
  await t('PUT', `/api/paths/${path.id}`, { published: true });
  return { path, tasks };
}

test('sign-up records consent and adds a free sample path', async () => {
  const t = await teacher();
  const row = await db.prepare('SELECT terms_accepted_at, credits FROM teachers WHERE email = ?').get(t.email);
  assert.ok(row.terms_accepted_at > 0);
  const { paths } = (await t('GET', '/api/paths')).body;
  assert.equal(paths.length, 1);
  assert.match(paths[0].title, /מסלול לדוגמה/);
  assert.ok(paths[0].taskCount >= 4);
  assert.equal((await t('GET', '/api/auth/me')).body.teacher.credits, 20, 'the sample is free');
  assert.deepEqual(Object.keys((await t('GET', '/api/site')).body).sort(), ['contactEmail', 'owner']);
});

test('reading settings: validated, set by the teacher or the student, follow a class member', async () => {
  assert.deepEqual(reading({ font: 'clear', size: '3', calm: 'yes', voice: 'x', extra: 1 }),
    { font: 'clear', size: 3, spacing: false, contrast: false, calm: false, readAloud: false, voice: 'natural' });
  const t = await teacher();
  const { path } = await pathWith(t, ['א', 'ב']);
  const kid = client();
  const { token } = (await kid('POST', `/api/s/${path.code}/join`, { name: 'נועה', secret: SECRET })).body;
  const auth = { 'X-Student-Token': token };
  assert.equal((await kid('GET', `/api/s/${path.code}/me`, undefined, auth)).body.reading.size, 1);
  assert.equal((await kid('PUT', `/api/s/${path.code}/reading`, { size: 2, contrast: true }, auth)).body.reading.size, 2);
  const [st] = (await t('GET', `/api/paths/${path.id}/progress`)).body.students;
  assert.equal(st.reading.contrast, true);
  await t('PUT', `/api/students/${st.id}/adapt`, { hidden: [], breakEvery: null, reading: { font: 'clear' } });
  const me = (await kid('GET', `/api/s/${path.code}/me`, undefined, auth)).body;
  assert.equal(me.reading.font, 'clear');
  assert.equal(me.reading.contrast, false, 'the teacher\'s save replaces the settings');

  // Through a class: the settings live on the member and apply in every path.
  const { path: p2 } = await pathWith(t, ['ג']);
  const cls = (await t('POST', '/api/classes', { name: 'ד׳1' })).body.class;
  await t('PUT', `/api/classes/${cls.id}`, { pathIds: [path.id, p2.id] });
  const ckid = client();
  const cauth = { 'X-Class-Token': (await ckid('POST', `/api/c/${cls.code}/join`, { name: 'עומר', secret: SECRET })).body.token };
  const e1 = (await ckid('POST', `/api/c/${cls.code}/paths/${path.id}/enter`, {}, cauth)).body;
  await ckid('PUT', `/api/s/${e1.code}/reading`, { calm: true }, { 'X-Student-Token': e1.token });
  const e2 = (await ckid('POST', `/api/c/${cls.code}/paths/${p2.id}/enter`, {}, cauth)).body;
  assert.equal((await ckid('GET', `/api/s/${e2.code}/me`, undefined, { 'X-Student-Token': e2.token })).body.reading.calm, true);
});

test('natural read-aloud: cached per text, students and the teacher only, limited length', async () => {
  const t = await teacher();
  const { path } = await pathWith(t, ['א']);
  assert.equal((await client()('GET', `/api/s/${path.code}`)).body.naturalVoice, true);
  const kid = client();
  const { token } = (await kid('POST', `/api/s/${path.code}/join`, { name: 'דן', secret: SECRET })).body;
  const auth = { 'X-Student-Token': token };
  assert.equal((await client()('POST', `/api/s/${path.code}/tts`, { text: 'שלום' })).status, 401);
  const before = spoken.length;
  const a = await kid('POST', `/api/s/${path.code}/tts`, { text: 'שלום  כיתה' }, auth);
  const b = await kid('POST', `/api/s/${path.code}/tts`, { text: 'שלום כיתה' }, auth);
  const c = await t('POST', `/api/s/${path.code}/tts`, { text: 'שלום כיתה' });
  assert.equal(a.status, 200);
  assert.equal(a.body.url, b.body.url);
  assert.equal(c.body.url, a.body.url, 'the teacher\'s preview uses the same recording');
  assert.equal(spoken.length - before, 1, 'synthesized once');
  const audio = await fetch(base + a.body.url);
  assert.equal(audio.headers.get('content-type'), 'audio/wav');
  assert.equal((await kid('POST', `/api/s/${path.code}/tts`, { text: 'א'.repeat(701) }, auth)).status, 400);
  assert.equal((await t('GET', '/api/billing')).status, 200);

  const w = wav(Buffer.alloc(48000), 24000);
  assert.equal(w.toString('ascii', 0, 4), 'RIFF');
  assert.equal(w.readUInt32LE(24), 24000);
  assert.equal(w.length, 48044);
});

test('parent link: one child, no answers, can be revoked', async () => {
  const t = await teacher();
  const { path, tasks } = await pathWith(t, ['א', 'ב']);
  const kid = client();
  const { token } = (await kid('POST', `/api/s/${path.code}/join`, { name: 'מיה', secret: SECRET })).body;
  await kid('POST', `/api/s/${path.code}/join`, { name: 'אחר', secret: SECRET });
  await kid('POST', `/api/s/${path.code}/tasks/${tasks[0].id}/complete`, { answer: 'סוד' }, { 'X-Student-Token': token });
  const st = (await t('GET', `/api/paths/${path.id}/progress`)).body.students.find((s) => s.name === 'מיה');
  assert.equal((await client()('POST', `/api/students/${st.id}/parent-link`)).status, 401);
  assert.equal((await (await teacher())('POST', `/api/students/${st.id}/parent-link`)).status, 404, 'not another teacher');
  const link = (await t('POST', `/api/students/${st.id}/parent-link`)).body.token;
  assert.equal((await t('POST', `/api/students/${st.id}/parent-link`)).body.token, link, 'the same link again');
  const parent = client();
  const view = (await parent('GET', `/api/parent/${link}`)).body;
  assert.equal(view.child.name, 'מיה');
  assert.equal(view.paths.length, 1);
  assert.deepEqual(view.paths[0].tasks.map((x) => Boolean(x.completedAt)), [true, false]);
  assert.ok(!JSON.stringify(view).includes('סוד'), 'no answers');
  assert.ok(!JSON.stringify(view).includes('אחר'), 'no other students');
  await t('DELETE', `/api/students/${st.id}/parent-link`);
  assert.equal((await parent('GET', `/api/parent/${link}`)).status, 404);
});

test('co-teachers share a class and its paths; only the owner deletes or manages', async () => {
  const owner = await teacher();
  const co = await teacher();
  const stranger = await teacher();
  const { path } = await pathWith(owner, ['א']);
  const cls = (await owner('POST', '/api/classes', { name: 'ה׳2' })).body.class;
  await owner('PUT', `/api/classes/${cls.id}`, { pathIds: [path.id] });
  assert.equal((await co('GET', `/api/classes/${cls.id}`)).status, 404);
  assert.equal((await owner('POST', `/api/classes/${cls.id}/teachers`, { email: 'nobody@x.org' })).status, 404);
  assert.equal((await owner('POST', `/api/classes/${cls.id}/teachers`, { email: co.email })).status, 201);

  const view = (await co('GET', `/api/classes/${cls.id}`)).body;
  assert.equal(view.isOwner, false);
  assert.equal(view.coTeachers.length, 1);
  const shared = (await co('GET', '/api/classes')).body.classes.find((c) => c.id === cls.id);
  assert.equal(shared.mine, false);
  const sharedPath = (await co('GET', '/api/paths')).body.paths.find((p) => p.id === path.id);
  assert.equal(sharedPath.mine, false);
  assert.equal((await co('GET', `/api/paths/${path.id}/progress`)).status, 200);
  assert.equal((await co('PUT', `/api/paths/${path.id}`, { title: 'שם חדש' })).status, 200, 'co-teachers edit');
  assert.equal((await co('DELETE', `/api/paths/${path.id}`)).status, 403);
  assert.equal((await co('DELETE', `/api/classes/${cls.id}`)).status, 403);
  assert.equal((await co('POST', `/api/classes/${cls.id}/teachers`, { email: stranger.email })).status, 403);
  assert.equal((await stranger('GET', `/api/paths/${path.id}`)).status, 404);

  // A co-teacher can leave; then the class and its paths are gone from their account.
  const me = (await co('GET', '/api/auth/me')).body.teacher;
  await co('DELETE', `/api/classes/${cls.id}/teachers/${me.id}`);
  assert.equal((await co('GET', `/api/paths/${path.id}`)).status, 404);
});

test('class activity: finished tasks per day and where students are stuck', async () => {
  const t = await teacher();
  const { path, tasks } = await pathWith(t, ['א', 'ב']);
  const cls = (await t('POST', '/api/classes', { name: 'ו׳3' })).body.class;
  await t('PUT', `/api/classes/${cls.id}`, { pathIds: [path.id] });
  const kid = client();
  const cauth = { 'X-Class-Token': (await kid('POST', `/api/c/${cls.code}/join`, { name: 'שי', secret: SECRET })).body.token };
  await kid('POST', `/api/c/${cls.code}/join`, { name: 'רז', secret: SECRET });
  const e = (await kid('POST', `/api/c/${cls.code}/paths/${path.id}/enter`, {}, cauth)).body;
  const auth = { 'X-Student-Token': e.token };
  await kid('POST', `/api/s/${e.code}/tasks/${tasks[0].id}/complete`, {}, auth);
  await kid('POST', `/api/s/${e.code}/tasks/${tasks[1].id}/help`, {}, auth);
  const act = (await t('GET', `/api/classes/${cls.id}/activity`)).body;
  assert.equal(act.days.length, 14);
  const shai = act.members.find((m) => m.name === 'שי');
  const raz = act.members.find((m) => m.name === 'רז');
  assert.equal(shai.total, 1);
  assert.equal(shai.perDay[act.days.at(-1)], 1, 'today');
  assert.equal(shai.stuck[0].help, true);
  assert.equal(raz.total, 0);
});
