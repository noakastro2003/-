# Ready-made paths (content/paths)

The site ships a library of ready-made learning paths that every teacher can browse and copy
(“ספריית המסלולים” → “מסלולי האתר”). Each file in `content/paths/` is a JSON **array of paths**.
`node scripts/content.mjs` checks them all and writes `content/library-data.js` (generated, do not edit).
`node scripts/content.mjs content/paths/<file>.json` checks one file only.

## Who the paths are for

Israeli state-school students (ממלכתי) with attention difficulties (ADHD) working on their own:
small steps, 2–8 minutes per task, short friendly instructions addressed to the student,
variety and movement, a gentle start and a good ending. Teachers copy and adapt them.

## A path

```json
{
  "slug": "genesis-01",
  "title": "בראשית פרק א׳: בריאת העולם",
  "description": "שבעה ימים, ובכל יום משהו חדש בעולם.",
  "subject": "תנ״ך",
  "grade": "ב׳",
  "curriculum": "בראשית א׳ – סיפור הבריאה",
  "order": 1,
  "theme": { "icon": "🌍", "color": "#0984e3", "background": "stars", "font": "rounded", "map": "road", "buddy": "🦉" },
  "tasks": [ ... 6–8 tasks ... ]
}
```

- `slug`: lowercase latin, digits, dashes, unique (`genesis-01`, `fractions-intro-3`).
- `subject`: one of עברית, חשבון, אנגלית, מדעים, היסטוריה, גאוגרפיה, תנ״ך, אזרחות, כישורי חיים, אחר.
- `grade`: one of גן, א׳, ב׳, ג׳, ד׳, ה׳, ו׳, ז׳, ח׳, ט׳, י׳, י״א, י״ב (Hebrew geresh ׳ U+05F3, gershayim ״ U+05F4).
- `curriculum`: the topic as it appears in the Ministry of Education curriculum for that grade (short Hebrew).
- `order`: position within its subject/series (Genesis: the chapter number).
- `theme` (all optional): `icon` (one emoji), `color` (#rrggbb), `background` (plain, dots, waves, stars, grid,
  notebook, confetti, sunset, bubbles), `font` (rounded, handwriting, bold, festive, clean), `map` (road, cards,
  timeline), `buddy` (an emoji or ""), `breakEvery` (0–5), `breakStyle` (move, calm, simple).
- 6–8 tasks (allowed 4–10), at least 4 different types, never the same type twice in a row.

## A task

`{ "type": "...", "title": "2–5 words", "emoji": "one emoji", "estMinutes": 3, "content": { ... } }`

`content.text` is the instruction line the student sees (for `read` it is the explanation itself).
Content per type (limits are enforced):

| type | content |
|---|---|
| `read` | `text` – a short explanation (one idea, 2–6 short sentences) |
| `question` | `text` – an open question answered in 1–2 sentences |
| `choice` | `text` question, `options` (3–4), `correct` (0-based index), `explanation` (one encouraging sentence) |
| `checklist` | `text`, `items` (2–6 tiny concrete steps) |
| `timer` | `text` (what to produce), `minutes` (3–15) |
| `memory` | `text`, `pairs` 3–8 of `{a, b}` – two cards that match, each under 25 chars |
| `matching` | `text`, `pairs` 3–6 `{a, b}`, all `b` different |
| `lines` | `text`, `pairs` 3–5 `{a, b}` (draw a line), short sides, all `b` different |
| `wordsearch` | `text`, `words` 4–8 single words, 2–10 Hebrew letters, **no nikud, no spaces** |
| `order` | `text`, `items` 3–7 in the **correct** order (the app shuffles) |
| `blanks` | `text`, `passage` with each missing word in `[brackets]` (2–6 blanks), `distractors` 0–3 |
| `truefalse` | `text`, `statements` 3–6 of `{s, t}` with `t` true/false, mixed |
| `sort` | `text`, `groups` 2–3 of `{name, items}`, 2–5 items each, ≤16 items total, every item unique |
| `highlight` | `text` (what to tap), `passage` with the words to tap in `[brackets]` (2–8) |
| `dictation` | `text`, `words` 3–8 (read aloud by the computer, typed by the student; plain spelling) |
| `flashcards` | `text`, `cards` 4–12 of `{a, b}` (front / back) |
| `voice` | `text` – a “tell in your own words” prompt (the student records an answer) |
| `draw` | `text` – what to draw on the screen |
| `photo` | `text` – what to do on paper and photograph |

Do not use `link` or `hotspot` (they need a URL or the teacher's own picture).

## Writing rules

- **Accuracy above everything.** Every fact, answer, pair and order must be correct. For the Bible: follow the
  text of the chapter; quote a verse only when you are certain of the exact wording, and then cite it
  (בראשית א, ג). Otherwise retell in simple modern Hebrew. Stay with the plain meaning of the text (פשט) as taught
  in ממלכתי schools; no commentary presented as fact.
- Hebrew, without nikud (teachers can add nikud in one click), except where nikud is the topic.
  For grades א׳–ב׳ use very short sentences and simple words.
- Mix: take in (read) → practise (games) → reflect (question / voice / draw). Open with something easy;
  end with a short reflection or a fun review game.
- Instructions address the student in plural or neutral form ("קראו", "חברו", "סמנו").
- Math: use digits and the symbols + − × : = and fractions written like 1/2. Check every calculation.
