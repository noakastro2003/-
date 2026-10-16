import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openDb } from '../db.js';
import { createApp, billingConfig } from '../server.js';
import * as billing from '../billing.js';

const CFG = {
  freeCredits: 7, monthlyCredits: 12, periodDays: 30, priceLabel: '₪1',
  costs: { createPath: 1, aiGenerate: 5 }, paymentsMode: 'test',
};

const AI_PATH = {
  title: 'x', description: '', icon: '🚀', color: '#6c5ce7',
  tasks: [{ type: 'read', title: 'קריאה', emoji: '📖', estMinutes: 3, text: 'טקסט' }],
};

// ---------- the rules ----------

test('spend takes monthly credits first and refuses when short', () => {
  const acc = billing.newAccount(CFG);
  billing.activate(acc, CFG, Date.parse('2026-01-01'));
  acc.subCreditsLeft = 3;
  const now = Date.parse('2026-01-10');
  const taken = billing.spend(acc, 'aiGenerate', CFG, now);
  assert.deepEqual([taken.fromSub, taken.fromCredits, acc.subCreditsLeft, acc.credits], [3, 2, 0, 5]);
  billing.refund(acc, taken);
  assert.deepEqual([acc.subCreditsLeft, acc.credits], [3, 7]);
  acc.credits = 0;
  assert.throws(() => billing.spend(acc, 'aiGenerate', CFG, now), (e) => e.status === 402 && e.code === 'no_credits');
});

test('a period ends on time, canceled or not', () => {
  const acc = billing.newAccount(CFG);
  billing.activate(acc, CFG, Date.parse('2026-01-01'));
  billing.cancel(acc);
  assert.equal(billing.available(billing.refresh(acc, Date.parse('2026-01-20'))), 7 + 12, 'canceled stays usable until the end');
  billing.refresh(acc, Date.parse('2026-02-01'));
  assert.equal(acc.subStatus, 'expired');
  assert.equal(billing.available(acc), 7, 'monthly credits expire, one-off credits stay');
});

test('billing settings come from the environment', () => {
  const cfg = billingConfig({ FREE_CREDITS: '3', COST_AI_GENERATE: '8', PAYMENTS_MODE: 'test', MONTHLY_CREDITS: 'lots' });
  assert.equal(cfg.freeCredits, 3);
  assert.equal(cfg.costs.aiGenerate, 8);
  assert.equal(cfg.costs.createPath, 1);
  assert.equal(cfg.monthlyCredits, billing.BILLING_DEFAULTS.monthlyCredits, 'invalid values fall back to defaults');
  assert.equal(billingConfig({}).paymentsMode, 'off');
});

// ---------- the API ----------

let base;
let server;
let failNext = false;

before(async () => {
  const ai = {
    enabled: true,
    generatePath: async () => {
      if (failNext) { failNext = false; throw new Error('boom'); }
      return structuredClone(AI_PATH);
    },
  };
  server = http.createServer(createApp(openDb(':memory:'), { ai, billingCfg: CFG }));
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

async function teacher() {
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
  await c('POST', '/api/auth/register', { name: 'מורה', email: `b${Math.random()}@x.org`, password: 'password123' });
  return c;
}

const GEN = { topic: 'נושא', grade: 'ג׳', types: ['read', 'question'] };

test('new teachers get free credits; creating paths spends them', async () => {
  const c = await teacher();
  const me = await c('GET', '/api/auth/me');
  assert.equal(me.body.teacher.credits, 7);
  assert.deepEqual(me.body.costs, CFG.costs);

  const p = await c('POST', '/api/paths', { title: 'ידני' });
  assert.equal(p.body.credits, 6);
  const dup = await c('POST', `/api/paths/${p.body.path.id}/duplicate`);
  assert.equal(dup.body.credits, 5);
  const gen = await c('POST', '/api/ai/generate', GEN);
  assert.equal(gen.status, 201);
  assert.equal(gen.body.credits, 0);

  // Out of credits: nothing is created and the reason is explicit.
  const before = (await c('GET', '/api/paths')).body.paths.length;
  const no = await c('POST', '/api/paths', { title: 'עוד אחד' });
  assert.equal(no.status, 402);
  assert.equal(no.body.code, 'no_credits');
  assert.equal((await c('GET', '/api/paths')).body.paths.length, before);

  // Editing what exists stays free.
  assert.equal((await c('PUT', `/api/paths/${p.body.path.id}`, { title: 'שם חדש' })).status, 200);
  assert.equal((await c('POST', `/api/paths/${p.body.path.id}/tasks`, { type: 'read', title: 't' })).status, 201);

  const b = (await c('GET', '/api/billing')).body;
  assert.equal(b.available, 0);
  assert.deepEqual(b.history.map((x) => [x.action, x.delta]), [['aiGenerate', -5], ['createPath', -1], ['createPath', -1], ['signup', 7]]);
  assert.equal(b.history[3].label, billing.ACTION_LABELS.signup);
});

test('a failed generation gives the credits back', async () => {
  const c = await teacher();
  failNext = true;
  const r = await c('POST', '/api/ai/generate', GEN);
  assert.equal(r.status, 500);
  const b = (await c('GET', '/api/billing')).body;
  assert.equal(b.available, 7);
  assert.deepEqual(b.history.slice(0, 2).map((x) => [x.action, x.delta]), [['refund', 5], ['aiGenerate', -5]]);
});

test('subscribing (test mode) adds monthly credits; cancel keeps them until the period ends', async () => {
  const c = await teacher();
  const sub = await c('POST', '/api/billing/checkout');
  assert.equal(sub.status, 200);
  assert.equal(sub.body.subscription.status, 'active');
  assert.equal(sub.body.available, 7 + 12);
  await c('POST', '/api/ai/generate', GEN);
  const after = (await c('GET', '/api/billing')).body;
  assert.deepEqual([after.subscription.creditsLeft, after.credits], [7, 7], 'monthly credits are used first');
  const can = await c('POST', '/api/billing/cancel');
  assert.equal(can.body.subscription.status, 'canceled');
  assert.equal(can.body.available, 14);
  assert.equal((await c('POST', '/api/billing/cancel')).status, 400);
});

test('without a payment provider, checkout is refused', async () => {
  const s = http.createServer(createApp(openDb(':memory:'), { ai: { enabled: false }, billingCfg: { ...CFG, paymentsMode: 'off' } }));
  await new Promise((r) => s.listen(0, r));
  const url = `http://localhost:${s.address().port}`;
  const reg = await fetch(`${url}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'm', email: 'off@x.org', password: 'password123' }),
  });
  const cookie = reg.headers.get('set-cookie').split(';')[0];
  const r = await fetch(`${url}/api/billing/checkout`, { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(r.status, 503);
  s.close();
});

test('admin tool grants credits and subscriptions', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-admin-'));
  const dbFile = path.join(dir, 'app.db');
  const db = openDb(dbFile);
  db.prepare("INSERT INTO teachers (name, email, password_hash, credits) VALUES ('דנה', 'dana@x.org', 'x', 20)").run();
  db.close();
  const run = (...args) => execFileSync(process.execPath, ['--no-warnings', 'admin.js', ...args], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, DB_FILE: dbFile }, encoding: 'utf8',
  });
  assert.match(run('grant', 'dana@x.org', '10'), /קרדיטים זמינים: 30/);
  assert.match(run('subscribe', 'dana@x.org', '3'), /קרדיטים זמינים: 630 \(חד-פעמיים 30, מהמנוי 600\)/);
  assert.match(run('show', 'DANA@x.org'), /מנוי: active/);
  fs.rmSync(dir, { recursive: true, force: true });
});
