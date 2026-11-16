import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openDb } from '../db.js';
import { createApp } from '../server.js';

const CFG = {
  freeCredits: 20, monthlyCredits: 200, periodDays: 30, priceLabel: '₪39 לחודש', paymentsMode: 'test',
  costs: { createPath: 1, aiGenerate: 5, aiImprove: 2, aiNikud: 1 },
};
let server;
let base;
before(async () => {
  server = http.createServer(createApp(openDb(':memory:'), { ai: { enabled: false }, billingCfg: CFG, adminEmails: ['boss@x.org'] }));
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
const login = async (email) => {
  const c = client();
  await c('POST', '/api/auth/login', { email, password: 'password123' });
  return c;
};
const teacher = async (email = `t${Math.random()}@x.org`, extra = {}) => {
  const c = client();
  const r = await c('POST', '/api/auth/register', { name: 'מורה', email, password: 'password123', ...extra });
  c.reg = r.body;
  return c;
};

test('only admins manage codes', async () => {
  const t = await teacher();
  assert.equal((await t('GET', '/api/auth/me')).body.teacher.isAdmin, false);
  assert.equal((await t('GET', '/api/admin/promo')).status, 403);
  assert.equal((await t('POST', '/api/admin/promo', { code: 'HACK1', kind: 'credits', amount: 999 })).status, 403);
  const boss = await teacher('BOSS@x.org');
  assert.equal((await boss('GET', '/api/auth/me')).body.teacher.isAdmin, true);
  assert.equal((await boss('POST', '/api/admin/promo', { code: 'x', kind: 'credits', amount: 5 })).status, 400);
  assert.equal((await boss('POST', '/api/admin/promo', { code: 'OK-1', kind: 'nope', amount: 5 })).status, 400);
  assert.equal((await boss('POST', '/api/admin/promo', { code: 'OK-1', kind: 'discount', amount: 150 })).status, 400);
});

test('credits, free months and discount codes', async () => {
  const boss = await login('boss@x.org');
  const made = await boss('POST', '/api/admin/promo', { code: 'more50', kind: 'credits', amount: 50, maxUses: 2, note: 'כנס' });
  assert.equal(made.status, 201);
  assert.equal(made.body.code.code, 'MORE50');
  assert.equal((await boss('POST', '/api/admin/promo', { code: 'MORE50', kind: 'credits', amount: 1 })).status, 409);
  await boss('POST', '/api/admin/promo', { code: 'FREE3', kind: 'free_months', amount: 3 });
  await boss('POST', '/api/admin/promo', { code: 'HALF', kind: 'discount', amount: 50 });

  const a = await teacher();
  let r = await a('POST', '/api/billing/redeem', { code: ' more50 ' });
  assert.equal(r.status, 200);
  assert.equal(r.body.available, 70);
  assert.match(r.body.message, /50 קרדיטים/);
  assert.equal((await a('POST', '/api/billing/redeem', { code: 'MORE50' })).status, 409, 'once per teacher');
  assert.equal((await a('POST', '/api/billing/redeem', { code: 'NOPE99' })).status, 400);

  r = await a('POST', '/api/billing/redeem', { code: 'FREE3' });
  assert.equal(r.body.subscription.status, 'active');
  assert.equal(r.body.available, 70 + 600);
  const days = (Date.parse(r.body.subscription.periodEnd) - Date.now()) / 86400000;
  assert.ok(days > 89 && days <= 90, `about 90 days, got ${days}`);

  const b = await teacher(undefined, { promo: 'more50' });
  assert.deepEqual(b.reg.promo.ok, true);
  assert.equal(b.reg.teacher.credits, 70);
  const c = await teacher(undefined, { promo: 'more50' });
  assert.equal(c.reg.promo.ok, false, 'max uses reached');
  assert.match(c.reg.promo.message, /נוצל/);
  assert.equal(c.reg.teacher.credits, 20, 'the account is created anyway');

  r = await c('POST', '/api/billing/redeem', { code: 'HALF' });
  assert.deepEqual(r.body.discount, { percent: 50, code: 'HALF' });
  r = await c('POST', '/api/billing/checkout');
  assert.equal(r.body.discount, null, 'used on the first payment');
  assert.match(r.body.history[0].note, /50%/);

  // deactivate
  await boss('PUT', '/api/admin/promo/FREE3', { active: false });
  assert.match((await c('POST', '/api/billing/redeem', { code: 'FREE3' })).body.error, /אינו פעיל/);
  const list = (await boss('GET', '/api/admin/promo')).body.codes;
  assert.deepEqual(list.find((x) => x.code === 'MORE50').uses, 2);
});

test('expired codes are refused', async () => {
  const b2 = await login('boss@x.org');
  assert.equal((await b2('POST', '/api/admin/promo', { code: 'OLD1', kind: 'credits', amount: 5, expiresAt: Date.now() - 1000 })).status, 400);
});

test('account settings: name and password', async () => {
  const t = await teacher('settings@x.org');
  assert.equal((await t('PUT', '/api/auth/me', { name: 'רונית' })).body.teacher.name, 'רונית');
  assert.equal((await t('GET', '/api/auth/me')).body.teacher.name, 'רונית');
  assert.equal((await t('POST', '/api/auth/password', { current: 'wrong', password: 'newpassword1' })).status, 403);
  assert.equal((await t('POST', '/api/auth/password', { current: 'password123', password: 'short' })).status, 400);
  assert.equal((await t('POST', '/api/auth/password', { current: 'password123', password: 'newpassword1' })).status, 200);
  assert.equal((await t('GET', '/api/auth/me')).body.teacher.name, 'רונית', 'still signed in here');
  const again = client();
  assert.equal((await again('POST', '/api/auth/login', { email: 'settings@x.org', password: 'newpassword1' })).status, 200);
});
