import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openDb } from '../db.js';
import { createApp } from '../server.js';
import { dictaToText } from '../dicta.js';

// A real answer from Dicta's Nakdan for "שלום ילדים, הכלב רץ." (options trimmed).
const SAMPLE = [
  { word: 'שלום', sep: false, options: ['שָׁלוֹם', 'שְׁלוֹם'] },
  { word: ' ', sep: true, options: [] },
  { word: 'ילדים', sep: false, options: ['יְלָדִים', 'יַלְדִּים'] },
  { word: ', ', sep: true, options: [] },
  { word: 'הכלב', sep: false, options: ['הַ|כֶּלֶב', 'הַכְלֵב'] },
  { word: ' ', sep: true, options: [] },
  { word: 'רץ', sep: false, options: ['רָץ', 'רַץ'] },
  { word: '.', sep: true, options: [] },
];

test('rebuilds the text from the most likely options', () => {
  assert.equal(dictaToText(SAMPLE), 'שָׁלוֹם יְלָדִים, הַכֶּלֶב רָץ.');
  assert.equal(dictaToText([{ word: 'ABC', sep: false, options: [] }]), 'ABC', 'words without options stay as they are');
  assert.throws(() => dictaToText({ error: 'x' }));
});

test('the Dicta endpoint: teachers only, free, and a clear error when Dicta is down', async () => {
  let down = false;
  const sent = [];
  const dicta = async (text) => { sent.push(text); if (down) throw new Error('timeout'); return SAMPLE; };
  const server = http.createServer(createApp(openDb(':memory:'), { ai: { enabled: false }, dicta }));
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  let cookie = '';
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json() };
  };
  assert.equal((await call('POST', '/api/nikud/dicta', { text: 'שלום' })).status, 401);
  await call('POST', '/api/auth/register', { name: 'מורה', email: 'd@x.org', password: 'password123' });
  const r = await call('POST', '/api/nikud/dicta', { text: 'שלום ילדים, הכלב רץ.' });
  assert.equal(r.body.text, 'שָׁלוֹם יְלָדִים, הַכֶּלֶב רָץ.');
  assert.deepEqual(sent, ['שלום ילדים, הכלב רץ.']);
  assert.equal((await call('GET', '/api/billing')).body.available, 20, 'no credits taken');
  down = true;
  assert.equal((await call('POST', '/api/nikud/dicta', { text: 'שלום' })).status, 502);
  server.close();
});
