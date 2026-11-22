// Finding dictation words in a week plan, wherever and however they were written:
// "הכתבה – ריבוי זוגי" + a section of words, "הכתבה: חָבֵר, חֲבֵרָה…", "מחלקים מילים לשבוע הבא – ש.מ.ח: שָׂמֵחַ, …",
// words with or without niqqud, separated by commas or only by spaces, in a lesson or in the week's notes.
const HEB = /[א-ת]/;
const NIQ = /[֑-ׇ]/;
const KW = /הכתב[הת]|להכתבה|מילים\s+ל?שבוע|מילות\s+ה?הכתבה/;
const NEXT = /ל?שבוע\s+הבא|לשבוע\s+שאחרי|ההכתבה\s+הבאה|להכתבה\s+הבאה|מחלקים\s+(?:את\s+)?(?:ה)?מילים|מילים\s+חדשות/;

const clean = x => x.replace(/^[\s"״'׳(☐•·]+|[\s"״'׳).…,:;]+$/g, '').trim();
const isWord = x => HEB.test(x) && !/\d/.test(x) && x.split(/\s+/).length <= 3 && x.length <= 26;

// "ש.מ.ח: שָׂמֵחַ" -> topic + first word; "מחלקים מילים לשבוע הבא – ש.מ.ח" -> topic "ש.מ.ח"
function splitTopic(s) {
  const m = s.match(/^(.*?)[:：]\s*(\S.*)$/);
  if (m) return [m[1], m[2]];
  const d = s.match(/^(.*\S)\s+[–—-]\s+(\S.*)$/);
  if (d && (!isWord(s) || (NIQ.test(d[2]) && !NIQ.test(d[1])))) return [d[1], d[2]];
  return ['', s];
}
const goodTopic = t => (t && t.split(/\s+/).length <= 4 && !KW.test(t) && !/ביום|שבועית|של השבוע|^ל?שבוע/.test(t) ? t : '');
const topicOf = t => clean(String(t || '').replace(/^.*?(?:הכתב[הת]|מילים(?:\s+ל?שבוע\s+הבא)?|מילות\s+ה?הכתבה)\s*[–—:-]?\s*/, '').replace(/^(?:על|של|ב)\s+/, '')).slice(0, 30);

// every word list in a piece of text
export function listsIn(text) {
  const out = [];
  for (const raw of String(text || '').split(/\s[·•|]\s|\n|;\s|\.\s+(?=[א-ת])/)) {
    let seg = raw.trim(); if (!seg) continue;
    let topic = '';
    const parts = seg.split(/[,،]/);
    let items;
    if (parts.length >= 3) {
      const [t, first] = splitTopic(parts[0].trim()); topic = t;
      items = [first, ...parts.slice(1)];
      // the last item may carry the rest of the sentence: "יָדַיִם – בודקים בזוגות", "יָדַיִם (8 מילים)"
      items[items.length - 1] = items[items.length - 1].replace(/\s+[–—-]\s.*$/, '').replace(/\s*\(.*$/, '');
    } else {
      // no commas: only a run of pointed words counts ("הכתבה: חָבֵר חֲבֵרָה חֲבֵרִים חֲבֵרוֹת")
      const [t, rest] = splitTopic(seg); topic = t;
      const toks = rest.split(/\s+/).map(clean).filter(Boolean);
      if (toks.length < 4 || toks.filter(x => NIQ.test(x)).length < toks.length * .8) continue;
      items = toks;
    }
    items = items.map(clean).filter(Boolean);
    const good = items.filter(isWord);
    if (good.length >= 3 && good.length >= items.length * .75) out.push({ topic: clean(topic), words: [...new Set(good)], niq: good.filter(x => NIQ.test(x)).length / good.length, lead: topic });
  }
  return out;
}

// all dictation word lists of one week: [{ key, name, when, kind: 'this'|'next', words, dow, label, score }]
export function findDictation(w) {
  const out = [];
  if (!w) return out;
  const add = (o, it, l, ctx) => {
    if (out.some(x => x.words.join('|') === l.words.join('|'))) return;
    const next = NEXT.test(`${it.label} ${l.lead} ${ctx}`);
    out.push({ ...o, kind: next ? 'next' : 'this', words: l.words, topic: goodTopic(topicOf(l.lead)) || goodTopic(l.topic) || goodTopic(o.topic) || '', score: (KW.test(`${it.label} ${it.text}`) ? 3 : 1) + l.niq * 2 + (/הכתב/.test(it.label) ? 2 : 0) });
  };
  for (const d of w.days || []) for (const p of d.periods || []) {
    const head = `${p.title || ''} ${p.subtitle || ''}`, titleKw = KW.test(head);
    const entries = [
      { label: '', text: p.title || '' },
      ...(p.sections || []).map(s => ({ label: s.label || '', text: s.text || '' })),
      ...(p.materials || []).map(m => ({ label: '', text: m.text || '', mat: true })),
      ...(p.homework || []).map(h => ({ label: 'שיעורי בית', text: h || '' })),
    ];
    for (const it of entries) {
      const kw = KW.test(`${it.label} ${it.text}`);
      for (const l of listsIn(it.text)) {
        // where the list sits decides if it is a dictation: next to the word itself, inside a dictation lesson, or fully pointed
        const ok = (kw && (l.niq >= .3 || KW.test(it.label) || KW.test(l.lead) || /הכתב/.test(it.text.slice(0, it.text.indexOf(l.words[0]) + 1))))
          || (titleKw && !it.mat && (l.niq >= .5 || /מילים|הכתב/.test(it.label)))
          || (titleKw && it.mat && l.niq >= .8)
          || (l.niq >= .9 && l.words.length >= 5);
        if (ok) add({ key: `${w.id}:${d.dow}:${p.label}`, dow: d.dow, label: p.label, day: d.name, topic: topicOf(/הכתב/.test(head) ? head.split(/[:,]/)[0] : '') }, it, l, it.text.slice(0, Math.max(0, it.text.indexOf(l.words[0]))));
      }
    }
  }
  (w.notes || []).forEach((n, i) => {
    const it = { label: n.label || '', text: n.text || '' }, kw = KW.test(`${it.label} ${it.text}`);
    for (const l of listsIn(it.text)) if ((kw && l.niq >= .3) || KW.test(it.label) || (l.niq >= .9 && l.words.length >= 5)) add({ key: `${w.id}:note:${i}`, dow: -1, label: '', day: '', topic: topicOf(it.label) }, it, l, it.text.slice(0, Math.max(0, it.text.indexOf(l.words[0]))));
  });
  // lesson lists are keyed by lesson; a second list in the same lesson gets its own key
  const seen = {}; for (const o of out) { seen[o.key] = (seen[o.key] || 0) + 1; if (seen[o.key] > 1) o.key += ':' + seen[o.key]; }
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'this' ? -1 : 1));
}
