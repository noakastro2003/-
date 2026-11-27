import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openDb } from '../db.js';
import { createApp } from '../server.js';
import * as v from '../validate.js';
import { studentContent, gradeAnswer, decodeSay, taskFromAi, keepTeacherParts } from '../logic.js';

const SECRET = ['🍎', '🐶', '🚗'];
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(40, 2)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);
const REC = '/api/media/0123456789abcdef0123456789abcdef';

test('draw a line: like matching, answers hidden and shuffled', () => {
  const t = v.task({ type: 'lines', title: 'קו', content: { pairs: [{ a: '1', b: 'אחת' }, { a: '2', b: 'שתיים' }, { a: '3', b: 'שלוש' }] } });
  const sc = studentContent('lines', t.content);
  assert.deepEqual(sc.left, ['1', '2', '3']);
  assert.notDeepEqual(sc.right, ['אחת', 'שתיים', 'שלוש']);
  assert.equal(JSON.stringify(sc).includes('pairs'), false);
  assert.equal(gradeAnswer('lines', t.content, { answer: ['אחת', 'שלוש', 'שתיים'] }).wrong.join(), '1,2');
  assert.equal(gradeAnswer('lines', t.content, { answer: ['אחת', 'שתיים', 'שלוש'] }).correct, true);
  assert.throws(() => v.task({ type: 'lines', title: 'x', content: { pairs: Array(7).fill(0).map((_, i) => ({ a: `${i}`, b: `b${i}` })) } }), /עד 6/);
});

test('sort into groups', () => {
  const content = { groups: [{ name: 'ים', items: ['דג', 'כריש'] }, { name: 'יבשה', items: ['כלב'] }] };
  const t = v.task({ type: 'sort', title: 'מיון', content });
  const sc = studentContent('sort', t.content);
  assert.deepEqual(sc.groups, ['ים', 'יבשה']);
  assert.deepEqual([...sc.items].sort(), ['דג', 'כלב', 'כריש'].sort());
  const ok = gradeAnswer('sort', t.content, { answer: [['כריש', 'דָּג'], ['כלב']] });
  assert.equal(ok.correct, true);
  const bad = gradeAnswer('sort', t.content, { answer: [['כריש'], ['כלב', 'דג']] });
  assert.deepEqual(bad.wrong, ['דג']);
  assert.throws(() => gradeAnswer('sort', t.content, { answer: [['כריש'], ['כלב']] }), /למיין/);
  assert.throws(() => v.task({ type: 'sort', title: 'x', content: { groups: [{ name: 'א', items: ['x'] }] } }), /2 קבוצות/);
  assert.throws(() => v.task({ type: 'sort', title: 'x', content: { groups: [{ name: 'א', items: ['x'] }, { name: 'ב', items: ['x'] }] } }), /פעם אחת/);
});

test('dictation: words stay off screen, spelling ignores nikud and punctuation', () => {
  const t = v.task({ type: 'dictation', title: 'הכתבה', content: { words: ['שָׁלוֹם', { w: 'בית', audio: REC }, ''] } });
  assert.equal(t.content.words.length, 2);
  const sc = studentContent('dictation', t.content);
  assert.equal(JSON.stringify(sc).includes('שלום'), false);
  assert.equal(JSON.stringify(sc).includes('בית'), false);
  assert.equal(decodeSay(sc.words[0].say), 'שָׁלוֹם');
  assert.deepEqual(sc.words[1], { audio: REC });
  assert.equal(gradeAnswer('dictation', t.content, { answer: ['שלום.', ' בית '] }).correct, true);
  assert.deepEqual(gradeAnswer('dictation', t.content, { answer: ['סלום', 'בית'] }).wrong, [0]);
  assert.throws(() => v.task({ type: 'dictation', title: 'x', content: { words: [{ w: 'a', audio: 'javascript:1' }] } }));
});

test('flashcards and spoken answers', () => {
  const f = v.task({ type: 'flashcards', title: 'כרטיסיות', content: { cards: [{ a: 'dog', b: 'כלב' }, { a: 'cat', b: 'חתול' }] } });
  assert.deepEqual(gradeAnswer('flashcards', f.content, { answer: 3 }), { correct: true, answer: { again: 3 } });
  assert.throws(() => v.task({ type: 'flashcards', title: 'x', content: { cards: [{ a: 'dog', b: '' }, { a: 'cat', b: 'חתול' }] } }), /שני הצדדים/);
  const voice = v.task({ type: 'voice', title: 'ספרו', content: { text: 'מה למדתם?' } });
  assert.equal(voice.content.maxSeconds, 60);
  assert.deepEqual(gradeAnswer('voice', voice.content, { answer: REC }).answer, { audio: REC });
  assert.equal(gradeAnswer('voice', voice.content, { answer: 'כתבתי' }).answer, 'כתבתי');
  assert.throws(() => gradeAnswer('voice', voice.content, { answer: '' }));
});

test('AI output for the new types, and an AI rewrite keeps the teacher\'s recordings', () => {
  assert.equal(taskFromAi({ type: 'sort', title: 'x', emoji: '', estMinutes: 3, text: '', groups: [{ name: 'א', items: ['1'] }, { name: 'ב', items: ['2'] }] }).type, 'sort');
  const original = v.task({ type: 'dictation', title: 'x', needsApproval: true, content: { words: [{ w: 'בית', audio: REC }, { w: 'גן' }] } });
  const improved = taskFromAi({ type: 'dictation', title: 'x', emoji: '', estMinutes: 3, text: '', words: ['בַּיִת', 'גן', 'ים'] });
  keepTeacherParts(original, improved);
  assert.deepEqual(improved.content.words, [{ w: 'בַּיִת', audio: REC }, { w: 'גן' }, { w: 'ים' }]);
  assert.equal(improved.needsApproval, true);
});

// ---- server: a student records an answer ----

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
    return { status: res.status, body: (res.headers.get('content-type') || '').includes('json') ? await res.json() : null };
  };
}

test('a student records a spoken answer and the teacher gets it', async () => {
  const t = client();
  await t('POST', '/api/auth/register', { name: 'מורה', email: `v${Math.random()}@x.org`, password: 'password123' });
  const { body: { path } } = await t('POST', '/api/paths', { title: 'קול' });
  const task = (await t('POST', `/api/paths/${path.id}/tasks`, { type: 'voice', title: 'ספרו', content: { text: 'מה למדתם?' } })).body.task;
  await t('PUT', `/api/paths/${path.id}`, { published: true });

  const kid = client();
  assert.equal((await kid('POST', `/api/s/${path.code}/media`, { data: WEBM.toString('base64') })).status, 401);
  const { body: { token, student } } = await kid('POST', `/api/s/${path.code}/join`, { name: 'נועם', secret: SECRET });
  const auth = { 'X-Student-Token': token };
  assert.equal((await kid('POST', `/api/s/${path.code}/media`, { data: Buffer.from('<svg onload=alert(1)></svg>').toString('base64') }, auth)).status, 400, 'no scripts');
  const up = await kid('POST', `/api/s/${path.code}/media`, { data: WEBM.toString('base64') }, auth);
  assert.equal(up.status, 201);
  const done = await kid('POST', `/api/s/${path.code}/tasks/${task.id}/complete`, { answer: up.body.url }, auth);
  assert.equal(done.body.correct, true);
  const prog = (await t('GET', `/api/paths/${path.id}/progress`)).body;
  assert.deepEqual(prog.students.find((s) => s.id === student.id).done[task.id].answer, { audio: up.body.url });
});

test('hotspot: needs a picture; each right place counts once', () => {
  assert.throws(() => v.task({ type: 'hotspot', title: 'x', content: { spots: [{ x: 10, y: 10, r: 5 }] } }), /תמונה/);
  const t = v.task({ type: 'hotspot', title: 'מפה', content: { image: REC, spots: [{ x: 20, y: 20, r: 10 }, { x: 80, y: 50, r: 10 }] } });
  const sc = studentContent('hotspot', t.content);
  assert.deepEqual(sc, { text: '', count: 2, image: REC });
  assert.equal(gradeAnswer('hotspot', t.content, { answer: [{ x: 78, y: 55 }, { x: 25, y: 18 }] }).correct, true);
  assert.deepEqual(gradeAnswer('hotspot', t.content, { answer: [{ x: 21, y: 21 }, { x: 22, y: 22 }] }).wrong, [1], 'same place twice');
  assert.throws(() => gradeAnswer('hotspot', t.content, { answer: [{ x: 1, y: 1 }] }));
});

test('highlight words: targets hidden, exact count required', () => {
  const t = v.task({ type: 'highlight', title: 'פעלים', content: { passage: 'הילד [רץ] לגן ו[שיחק] [עם חברים].' } });
  const sc = studentContent('highlight', t.content);
  assert.deepEqual(sc.tokens, ['הילד', 'רץ', 'לגן', 'ו', 'שיחק', 'עם', 'חברים', '.']);
  assert.deepEqual(sc.tight, [4, 7]);
  assert.equal(sc.count, 4);
  assert.equal('passage' in sc, false);
  const targets = [1, 4, 5, 6];
  assert.equal(gradeAnswer('highlight', t.content, { answer: targets }).correct, true);
  assert.deepEqual(gradeAnswer('highlight', t.content, { answer: [0, 1, 4, 5] }).wrong, [0]);
  assert.throws(() => gradeAnswer('highlight', t.content, { answer: [1] }), /בדיוק 4/);
});

test('photo and drawing answers must be uploaded pictures', () => {
  const p = v.task({ type: 'photo', title: 'צלמו', content: {} });
  assert.deepEqual(gradeAnswer('photo', p.content, { answer: REC }).answer, { image: REC });
  assert.throws(() => gradeAnswer('draw', p.content, { answer: 'https://evil.example/x.png' }));
});

test('the browser\'s mood list matches the server\'s', async () => {
  const { MOODS } = await import('../logic.js');
  const src = (await import('node:fs')).readFileSync(new URL('../public/js/themes.js', import.meta.url), 'utf8');
  for (const m of MOODS) assert.ok(src.includes(`{ e: '${m.e}', name: '${m.name}'${m.worry ? ', worry: true' : ''} }`), m.name);
});

test('a student\'s mood reaches the teacher', async () => {
  const t = client();
  await t('POST', '/api/auth/register', { name: 'מורה', email: `m${Math.random()}@x.org`, password: 'password123' });
  const { body: { path } } = await t('POST', '/api/paths', { title: 'מצב רוח' });
  await t('PUT', `/api/paths/${path.id}`, { published: true });
  const kid = client();
  const { body: { token, moods } } = await kid('POST', `/api/s/${path.code}/join`, { name: 'רון', secret: SECRET });
  assert.deepEqual(moods, {});
  const auth = { 'X-Student-Token': token };
  assert.equal((await kid('POST', `/api/s/${path.code}/mood`, { kind: 'start', mood: '🤡' }, auth)).status, 400);
  await kid('POST', `/api/s/${path.code}/mood`, { kind: 'start', mood: '😢' }, auth);
  const r = await kid('POST', `/api/s/${path.code}/mood`, { kind: 'end', mood: '😄' }, auth);
  assert.deepEqual([r.body.moods.start.mood, r.body.moods.end.mood], ['😢', '😄']);
  const prog = (await t('GET', `/api/paths/${path.id}/progress`)).body;
  assert.equal(prog.students[0].moods.start.mood, '😢');
});

test('number line: fractions and mixed numbers on ticks', async () => {
  const { parseNumber } = await import('../validate.js');
  assert.equal(parseNumber('1 ו-1/2'), 1.5);
  assert.equal(parseNumber('-3'), -3);
  assert.ok(Number.isNaN(parseNumber('שלוש')));
  const t = v.task({ type: 'numberline', title: 'ישר', content: { min: '0', max: '2', step: '1/4', targets: ['3/4', '1 ו-1/2'] } });
  assert.equal(t.content.labels, 'whole');
  assert.deepEqual(gradeAnswer('numberline', t.content, { answer: [3, 6] }), { correct: true, answer: [3, 6], wrong: [] });
  assert.deepEqual(gradeAnswer('numberline', t.content, { answer: [3, 5] }).wrong, [1]);
  assert.throws(() => gradeAnswer('numberline', t.content, { answer: [3, null] }), /כל המספרים/);
  assert.throws(() => gradeAnswer('numberline', t.content, { answer: [3, 99] }));
  assert.throws(() => v.task({ type: 'numberline', title: 'x', content: { min: '0', max: '1', step: '1/4', targets: ['1/3'] } }), /סימונים/);
  assert.throws(() => v.task({ type: 'numberline', title: 'x', content: { min: '0', max: '1', step: '0.3', targets: ['0'] } }), /להתחלק/);
  assert.throws(() => v.task({ type: 'numberline', title: 'x', content: { min: '0', max: '100', step: '1', targets: ['5'] } }), /40/);
  assert.equal(taskFromAi({ type: 'numberline', title: 'x', emoji: '', estMinutes: 3, text: '', min: '0', max: '10', step: '1', labels: 'ends', targets: ['7'] }).content.labels, 'ends');
});
