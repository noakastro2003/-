import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openDb } from '../db.js';
import { createApp } from '../server.js';

const sent = [];
let server;
let base;
let db;

before(async () => {
  db = openDb(':memory:');
  const mailer = { send: async (m) => { sent.push(m); } };
  server = http.createServer(createApp(db, { ai: { enabled: false }, mailer }));
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

function client() {
  let cookie = '';
  return async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json() };
  };
}

test('password reset by email link', async () => {
  const a = client();
  await a('POST', '/api/auth/register', { name: 'רותם', email: 'rotem@x.org', password: 'oldpassword' });
  const otherDevice = client();
  await otherDevice('POST', '/api/auth/login', { email: 'rotem@x.org', password: 'oldpassword' });

  // Unknown addresses get the same answer and no email.
  assert.deepEqual((await client()('POST', '/api/auth/forgot', { email: 'nobody@x.org' })).body, { ok: true });
  assert.equal(sent.length, 0);

  assert.equal((await client()('POST', '/api/auth/forgot', { email: 'ROTEM@x.org' })).status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'rotem@x.org');
  const token = sent[0].text.match(/#\/reset\/([0-9a-f]{64})/)[1];

  const c = client();
  assert.equal((await c('POST', '/api/auth/reset', { token: 'f'.repeat(64), password: 'newpassword1' })).status, 400);
  assert.equal((await c('POST', '/api/auth/reset', { token, password: 'short' })).status, 400);
  const ok = await c('POST', '/api/auth/reset', { token, password: 'newpassword1' });
  assert.equal(ok.status, 200);
  assert.equal((await c('GET', '/api/auth/me')).body.teacher.email, 'rotem@x.org', 'signed in after the reset');
  assert.equal((await otherDevice('GET', '/api/auth/me')).body.teacher, null, 'other devices are signed out');
  assert.equal((await c('POST', '/api/auth/reset', { token, password: 'another-one' })).status, 400, 'one use only');

  assert.equal((await client()('POST', '/api/auth/login', { email: 'rotem@x.org', password: 'oldpassword' })).status, 401);
  assert.equal((await client()('POST', '/api/auth/login', { email: 'rotem@x.org', password: 'newpassword1' })).status, 200);
});

test('expired reset links are refused', async () => {
  const a = client();
  await a('POST', '/api/auth/register', { name: 'גל', email: 'gal@x.org', password: 'password123' });
  await client()('POST', '/api/auth/forgot', { email: 'gal@x.org' });
  const token = sent.at(-1).text.match(/#\/reset\/([0-9a-f]{64})/)[1];
  db.exec('UPDATE password_resets SET expires_at = 0');
  assert.equal((await client()('POST', '/api/auth/reset', { token, password: 'newpassword1' })).status, 400);
});

test('admin tool makes a reset link', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-reset-'));
  const dbFile = path.join(dir, 'app.db');
  const d = openDb(dbFile);
  d.prepare("INSERT INTO teachers (name, email, password_hash, credits) VALUES ('דנה', 'dana@x.org', 'x', 20)").run();
  d.close();
  const out = execFileSync(process.execPath, ['--no-warnings', 'admin.js', 'reset-link', 'dana@x.org'], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, DB_FILE: dbFile, APP_URL: 'https://paths.example' }, encoding: 'utf8',
  });
  assert.match(out, /https:\/\/paths\.example\/#\/reset\/[0-9a-f]{64}/);
  fs.rmSync(dir, { recursive: true, force: true });
});
