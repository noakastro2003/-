import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadAll } from '../scripts/content.mjs';
import READY from '../content/library-data.js';
import { openDb } from '../db.js';
import { createApp } from '../server.js';
import { studentContent } from '../logic.js';

test('every ready-made path passes the checks, and library-data.js is up to date', () => {
  const { errors, paths } = loadAll();
  assert.deepEqual(errors, []);
  assert.deepEqual(READY.map((p) => p.slug).sort(), paths.map((p) => p.slug).sort(), 'run: node scripts/content.mjs');
  for (const p of READY) for (const t of p.tasks) studentContent(t.type, t.content); // students can open every task
});

test('teachers can preview and copy a ready-made path', { skip: !READY.length }, async () => {
  const server = http.createServer(createApp(openDb(':memory:'), { ai: { enabled: false } }));
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  let cookie = '';
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body && JSON.stringify(body) });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json() };
  };
  try {
    await call('POST', '/api/auth/register', { name: 'מורה', email: `c${Math.random()}@x.org`, password: 'password123' });
    const items = (await call('GET', '/api/library')).body.items;
    const first = READY[0];
    const item = items.find((x) => x.id === `site-${first.slug}`);
    assert.equal(item.ready, true);
    assert.equal(item.taskCount, first.tasks.length);
    assert.equal((await call('GET', `/api/library/${item.id}`)).body.tasks.length, first.tasks.length);
    const copy = await call('POST', `/api/library/${item.id}/copy`);
    assert.equal(copy.status, 201);
    const mine = (await call('GET', `/api/paths/${copy.body.path.id}`)).body;
    assert.deepEqual(mine.tasks.map((t) => t.title), first.tasks.map((t) => t.title));
    assert.equal((await call('GET', '/api/library/site-nope')).status, 404);
  } finally {
    server.close();
  }
});
