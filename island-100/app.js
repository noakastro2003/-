document.documentElement.lang = "he";
document.documentElement.dir = "rtl";

/* ---------- skills (what the journey practises: place value up to 100) ---------- */
const SKILLS = {
  count:   { name: "קיבוץ לעשרות", kid: "אוֹרְזִים עֲשָׂרוֹת",
    what: "לקבץ פריטים בודדים לקבוצות של 10, ולהבין ש-10 יחידות הן עשרת אחת.",
    home: "לספור יחד חפצים (מקלות, כפתורים, פסטה) ולארוז כל 10 בגומייה או בכוס. אחר כך לשאול: \"כמה כוסות מלאות? כמה נשארו בחוץ? כמה יש בסך הכול?\"",
    ask: "כמה קבוצות של 10 יש פה? וכמה נשארו לבד?" },
  read:    { name: "קריאת כמות", kid: "כַּמָּה יֵשׁ?",
    what: "לראות כמות שמסודרת בעשרות ויחידות ולדעת כמה זה, בלי לספור אחד-אחד.",
    home: "להניח כמה \"עשרות\" (כוסות של 10) וכמה בודדים, ולבקש מהילד לומר כמה יש: קודם סופרים בעשרות (עשר, עשרים, שלושים...) ואז ממשיכים באחד.",
    ask: "כמה עשרות? ואז כמה יחידות?" },
  write:   { name: "כתיבה בטבלת עשרות ויחידות", kid: "עֲשָׂרוֹת וִיחִידוֹת",
    what: "לכתוב מספר דו-ספרתי: ספרת העשרות משמאל, ספרת היחידות מימין, ו-0 כשאין יחידות.",
    home: "לצייר טבלה עם שתי עמודות \"עשרות | יחידות\" ולכתוב בה מספרים שרואים ברחוב: מספרי בתים, אוטובוסים, מחירים.",
    ask: "איזו ספרה במקום העשרות? ואיזו במקום היחידות?" },
  value:   { name: "ערך הספרה לפי מקומה", kid: "כַּמָּה שָׁוָה הַסִּפְרָה?",
    what: "להבין שאותה ספרה שווה דברים שונים לפי המקום שלה: ב-74 הספרה 7 שווה 70, וב-47 היא שווה 7.",
    home: "לכתוב שני מספרים עם אותן ספרות (36 ו-63) ולשאול: \"באיזה מספר ה-3 שווה יותר? למה?\"",
    ask: "באיזה מקום עומדת הספרה? אז כמה היא שווה?" },
  compose: { name: "הרכבה ופירוק", kid: "מַרְכִּיבִים וּמְפָרְקִים",
    what: "לפרק מספר לעשרות ויחידות (47 = 40 + 7) ולהרכיב בחזרה, גם כשהיחידות רבות מ-10.",
    home: "משחק \"קופה\": מטבעות של 10 ושל 1. לבקש לשלם 36 בדיוק, ואז לשאול: \"אפשר לשלם גם רק בשקלים?\"",
    ask: "כמה עשרות? כמה יחידות? איך כותבים את זה כתרגיל?" },
  line:    { name: "10 יותר, 10 פחות", kid: "קְפִיצוֹת שֶׁל 10",
    what: "להוסיף או להוריד 10 בלי לספור אחד-אחד: רק ספרת העשרות משתנה. וגם 1 יותר ו-1 פחות, כולל מעבר עשרת (39 ← 40).",
    home: "\"מעלית מספרים\": אומרים מספר, והילד אומר מה יוצא כשעולים קומה (10 יותר) או יורדים קומה (10 פחות).",
    ask: "איזו ספרה משתנה כשמוסיפים 10? ואיזו נשארת?" },
  seq:     { name: "סדרות ומניה בקפיצות", kid: "סְדָרוֹת",
    what: "להשלים סדרה שעולה או יורדת ב-1 או ב-10, ולמצוא את הכלל של הסדרה.",
    home: "בטיול או במדרגות: סופרים בקפיצות של 10 מ-3 (3, 13, 23...) או אחורה מ-100.",
    ask: "בכמה הסדרה גדלה בכל צעד?" },
  compare: { name: "השוואה וסידור", kid: "מִי גָּדוֹל יוֹתֵר?",
    what: "להשוות מספרים דו-ספרתיים (קודם העשרות, אחר כך היחידות) ולסדר אותם מהקטן לגדול.",
    home: "משחק קלפים: כל אחד שולף שני קלפים (0-9) ובונה מהם את המספר הכי גדול. מי בנה מספר גדול יותר?",
    ask: "למי יש יותר עשרות?" },
  hundred: { name: "מגיעים למאה", kid: "עַד 100",
    what: "להבין ש-10 עשרות הן מאה, ש-99 ועוד 1 הוא 100, ולספור בעשרות עד 100.",
    home: "לבנות יחד 100: עשר ערימות של 10 (קוביות, מטבעות). לספור את הערימות בעשרות: עשר, עשרים... מאה!",
    ask: "כמה עשרות יש במאה?" },
};
const SKILL_ORDER = ["count", "read", "write", "value", "compose", "line", "seq", "compare", "hundred"];

/* ---------- number helpers used by the question generators ---------- */
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const TENS = n => Math.floor(n / 10), ONES = n => n % 10;
const ISO = s => "⁦" + s + "⁩";                          // keeps "40 + 7" left-to-right inside Hebrew text
const swapD = n => ONES(n) * 10 + TENS(n);
function nearNums(n, k = 2, extra = []) {
  // distractors that show the typical mistakes: swapped digits, off by 10, off by 1
  const pool = [...extra, n + 10, n - 10, n + 1, n - 1, n + 11, n - 9].filter(x => x >= 0 && x <= 100 && x !== n);
  const first = ONES(n) && swapD(n) !== n ? [swapD(n)] : [];
  const out = [];
  [...first, ...pool.sort(() => Math.random() - .5)].forEach(x => { if (!out.includes(x) && out.length < k) out.push(x); });
  return out;
}
// no answer twice; numbers missing after that are filled with neighbours of the right answer
function fixOpts(q) {
  if (!q.opts) return q;
  const out = [...new Set(q.opts)];
  for (let d = 2; out.length < Math.min(3, q.opts.length) && /^\d+$/.test(out[0]) && d < 30; d++) { const v = String(+out[0] + (d % 2 ? -1 : 1) * Math.ceil(d / 2) * 10); if (+v >= 0 && +v <= 100 && !out.includes(v)) out.push(v); }
  return { ...q, opts: out };
}
const opts3 = (n, extra) => [String(n), ...nearNums(n, 2, extra).map(String)];
const opts4 = (n, extra) => [String(n), ...nearNums(n, 3, extra).map(String)];
const tensWord = t => ["", "עֶשֶׂר אַחַת", "שְׁתֵּי עֶשְׂרוֹת", "שָׁלוֹשׁ עֶשְׂרוֹת", "אַרְבַּע עֶשְׂרוֹת", "חָמֵשׁ עֶשְׂרוֹת", "שֵׁשׁ עֶשְׂרוֹת", "שֶׁבַע עֶשְׂרוֹת", "שְׁמוֹנֶה עֶשְׂרוֹת", "תֵּשַׁע עֶשְׂרוֹת", "עֶשֶׂר עֶשְׂרוֹת"][t];

/* ---------- question makers: each returns a fresh question, so a station is a little different every time ---------- */
const Q = {
  // pack loose coconuts into crates of 10, then say how many there are
  pack: (lo, hi) => () => { const n = rint(lo, hi);
    return { n, opts: opts3(n), q: `יֵשׁ עַל הַחוֹף ${n} קוֹקוֹסִים. אִרְזוּ אוֹתָם בְּאַרְגָּזִים שֶׁל 10. כַּמָּה קוֹקוֹסִים יֵשׁ?`,
      after: `אָרַזְנוּ ${TENS(n) === 1 ? "אַרְגָּז אֶחָד" : TENS(n) + " אַרְגָּזִים"} וְנִשְׁאֲרוּ ${ONES(n) === 1 ? "קוֹקוֹס אֶחָד" : ONES(n) + " קוֹקוֹסִים"}. כַּמָּה יֵשׁ בְּסַךְ הַכֹּל?`,
      why: `${TENS(n) === 1 ? "אַרְגָּז אֶחָד שֶׁל 10 הוּא 10" : TENS(n) + " אַרְגָּזִים שֶׁל 10 הֵם " + TENS(n) * 10}, וְעוֹד ${ONES(n)} בּוֹדְדִים: ${n}.` }; },
  // how many: tens shown as crates / jars, ones as single coconuts / fireflies
  qty: (kind, tLo, tHi, oLo = 1, oHi = 9) => () => { const t = rint(tLo, tHi), o = rint(oLo, oHi), n = t * 10 + o;
    const what = kind === "firefly" ? "גַּחְלִילִיּוֹת" : kind === "coin" ? "מַטְבְּעוֹת" : "קוֹקוֹסִים";
    const box = kind === "firefly" ? "צִנְצָנוֹת" : kind === "coin" ? "עֲרֵמוֹת" : "אַרְגָּזִים";
    return { n, pic: { qty: [t, o, kind] }, opts: opts4(n), q: `כַּמָּה ${what} יֵשׁ?`,
      why: `${t} ${box} שֶׁל 10 הֵם ${t * 10}${o ? `, וְעוֹד ${o} בּוֹדְדִים: ${n}` : ""}.` }; },
  // more loose ones than ten: they still make another ten
  messy: () => { const t = rint(2, 6), o = rint(11, 16), n = t * 10 + o;
    return { n, pic: { qty: [t, o, "coconut"] }, opts: opts4(n, [n - 10, n + 10]), q: "שִׂימוּ לֵב: יֵשׁ פֹּה הַרְבֵּה קוֹקוֹסִים בּוֹדְדִים! כַּמָּה קוֹקוֹסִים יֵשׁ בְּסַךְ הַכֹּל?",
      why: `מִ-${o} בּוֹדְדִים אֶפְשָׁר לֶאֱרֹז עוֹד אַרְגָּז: ${t + 1} אַרְגָּזִים וְ-${o - 10} בּוֹדְדִים, כְּלוֹמַר ${n}.` }; },
  // load the train: crates in the tens wagon, coconuts in the ones wagon
  load: (kind = "any", preset = null) => () => {
    const n = kind === "round" ? rint(2, 9) * 10 : rint(21, 89);
    const pre = preset === "trade" ? { t: TENS(n) - 1, o: ONES(n) + 10 } : null;
    return { n, pre, q: pre ? `בַּקָּרוֹן כְּבָר יֵשׁ ${pre.o} קוֹקוֹסִים בּוֹדְדִים. הָרַכֶּבֶת צְרִיכָה ${n}. סַדְּרוּ אוֹתָהּ נָכוֹן!` : `הָרַכֶּבֶת צְרִיכָה לְהוֹבִיל ${n} קוֹקוֹסִים. הַעֲמִיסוּ אַרְגָּזִים וְקוֹקוֹסִים.`,
      why: `${n} = ${tensWord(TENS(n))} וְ-${ONES(n)} יְחִידוֹת: ${TENS(n)} אַרְגָּזִים וְ-${ONES(n)} קוֹקוֹסִים.` }; },
  // write the digits in the caves: tens cave, ones cave
  chart: (zero = false) => () => { const t = rint(1, 9), o = zero ? 0 : rint(1, 9), n = t * 10 + o;
    return { n, cells: 2, pic: { qty: [t, o, "coconut"] }, q: "כַּמָּה קוֹקוֹסִים יֵשׁ? כִּתְבוּ אֶת הַסְּפָרוֹת בַּמְּעָרוֹת.",
      why: `${t} אַרְגָּזִים = ${t} בִּמְעָרַת הָעֲשָׂרוֹת. ${o} קוֹקוֹסִים = ${o} בִּמְעָרַת הַיְּחִידוֹת${o ? "" : " (אֵין קוֹקוֹסִים בּוֹדְדִים, לָכֵן כּוֹתְבִים 0)"}. בְּיַחַד: ${n}.` }; },
  chartWords: () => { const t = rint(1, 9), o = rint(0, 9), n = t * 10 + o;
    return { n, cells: 2, q: `כִּתְבוּ בַּמְּעָרוֹת אֶת הַמִּסְפָּר: ${tensWord(t)} וְ-${o} יְחִידוֹת.`,
      why: `${tensWord(t)} = ${t} בִּמְעָרַת הָעֲשָׂרוֹת, ${o} יְחִידוֹת = ${o} בִּמְעָרַת הַיְּחִידוֹת: ${n}.` }; },
  // the value of a digit by its place
  digitValue: () => { const t = rint(2, 9); let o = rint(1, 9); if (o === t) o = (o % 9) + 1; const n = t * 10 + o;
    return { n: t * 10, pic: { digits: String(n), mark: 0 }, opts: [String(t * 10), String(t), String(n), String(o)], q: `כַּמָּה שָׁוָה הַסִּפְרָה ${t} בַּמִּסְפָּר ${n}?`,
      why: `הַסִּפְרָה ${t} עוֹמֶדֶת בְּמָקוֹם הָעֲשָׂרוֹת, לָכֵן הִיא שָׁוָה ${t} עֶשְׂרוֹת = ${t * 10}.` }; },
  onesValue: () => { const t = rint(2, 9); let o = rint(1, 9); if (o === t) o = (o % 9) + 1; const n = t * 10 + o;
    return { n: o, pic: { digits: String(n), mark: 1 }, opts: [String(o), String(o * 10), String(n), String(t)], q: `כַּמָּה שָׁוָה הַסִּפְרָה ${o} בַּמִּסְפָּר ${n}?`,
      why: `הַסִּפְרָה ${o} עוֹמֶדֶת בְּמָקוֹם הַיְּחִידוֹת, לָכֵן הִיא שָׁוָה ${o}.` }; },
  whichTens: () => { const d = rint(2, 9), others = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(v => v !== d).sort(() => Math.random() - .5), x = others[0];
    const right = d * 10 + x, wrongs = [x * 10 + d, others[1] * 10 + d];   // the digit in the ones place is worth only itself
    return { n: right, opts: [String(right), ...wrongs.slice(0, 2).map(String)], q: `בְּאֵיזֶה מִסְפָּר הַסִּפְרָה ${d} שָׁוָה ${d * 10}?`,
      why: `כְּדֵי שֶׁהַסִּפְרָה ${d} תִּהְיֶה שָׁוָה ${d * 10}, הִיא צְרִיכָה לַעֲמֹד בְּמָקוֹם הָעֲשָׂרוֹת: ${right}.` }; },
  riddle: () => { const t = rint(2, 9), o = rint(1, 9), n = t * 10 + o;
    return { n, opts: opts3(n), q: `יֵשׁ לִי ${tensWord(t)} וְ-${o} יְחִידוֹת. מִי אֲנִי?`, why: `${tensWord(t)} הֵן ${t * 10}, וְעוֹד ${o}: ${n}. הָעֲשָׂרוֹת נִכְתָּבוֹת רִאשׁוֹנוֹת.` }; },
  riddleSwap: () => { const t = rint(2, 9), o = rint(1, 9), n = t * 10 + o;
    return { n, opts: opts3(n), q: `יֵשׁ לִי ${o} יְחִידוֹת וְ${tensWord(t)}. מִי אֲנִי?`, why: `גַּם כְּשֶׁהַיְּחִידוֹת נֶאֱמָרוֹת קֹדֶם, הָעֲשָׂרוֹת נִכְתָּבוֹת בְּמָקוֹם הָעֲשָׂרוֹת: ${n}.` }; },
  between: () => { const t = rint(2, 8), o = rint(1, 9), n = t * 10 + o;
    return { n, opts: opts3(n, [(t + 1) * 10 + o]), q: `אֲנִי בֵּין ${t * 10} לְ-${t * 10 + 10}, וְסִפְרַת הַיְּחִידוֹת שֶׁלִּי הִיא ${o}. מִי אֲנִי?`,
      why: `כָּל מִסְפָּר בֵּין ${t * 10} לְ-${t * 10 + 10} מַתְחִיל בַּסִּפְרָה ${t}. עִם ${o} יְחִידוֹת: ${n}.` }; },
  // composing and decomposing
  expand: () => { const t = rint(2, 9), o = rint(1, 9), n = t * 10 + o;
    return { n, pic: { expr: `${t * 10} + ${o} = ?` }, opts: opts3(n, [t + o]), q: `כַּמָּה זֶה ${ISO(`${t * 10} + ${o}`)}?`, why: `${t * 10} הֵן ${tensWord(t)}, וְעוֹד ${o} יְחִידוֹת: ${n}.` }; },
  split: () => { const t = rint(2, 9); let o = rint(1, 9); if (o === t) o = (o % 9) + 1; const n = t * 10 + o;
    const right = ISO(`${t * 10} + ${o}`);
    return { n, opts: [right, ISO(`${o * 10} + ${t}`), ISO(`${t} + ${o}`), ISO(`${t * 10} + ${o * 10}`)], q: `אֵיךְ מְפָרְקִים אֶת ${n} לַעֲשָׂרוֹת וִיחִידוֹת?`, why: `בְּ-${n} יֵשׁ ${tensWord(t)} (${t * 10}) וְ-${o} יְחִידוֹת: ${right}.` }; },
  missingPart: () => { const t = rint(2, 9), o = rint(1, 9), n = t * 10 + o;
    return { n: t * 10, pic: { expr: `? + ${o} = ${n}` }, opts: [String(t * 10), String(t), String(n - 1), String(o * 10)], q: `אֵיזֶה מִסְפָּר חָסֵר? ${ISO(`? + ${o} = ${n}`)}`, why: `בְּ-${n} יֵשׁ ${t * 10} וְעוֹד ${o}. לָכֵן חָסֵר ${t * 10}.` }; },
  // jumps on the stones
  jump: step => () => { let a = step > 0 ? rint(11, 99 - step) : rint(-step + 1, 89); if (Math.abs(step) === 1) a = rint(2, 8) * 10 + (step > 0 ? 9 : 0);
    const n = a + step, word = { 10: "10 קָדִימָה", "-10": "10 אֲחוֹרָה", 1: "1 קָדִימָה", "-1": "1 אֲחוֹרָה", 20: "20 קָדִימָה" }[step];
    return { n, pic: { jump: [a, step] }, opts: opts3(n, [a - step, a + (Math.abs(step) === 1 ? 10 : 1)]), q: `הַסַּרְטָן עַל הָאֶבֶן ${a}. הוּא קוֹפֵץ ${word}. עַל אֵיזוֹ אֶבֶן הוּא נוֹחֵת?`,
      why: Math.abs(step) >= 10 ? `בִּקְפִיצָה שֶׁל ${Math.abs(step)} רַק סִפְרַת הָעֲשָׂרוֹת מִשְׁתַּנָּה. סִפְרַת הַיְּחִידוֹת נִשְׁאֶרֶת ${ONES(a)}: ${n}.` : step > 0 ? `אַחֲרֵי ${a} בָּא ${n}: 9 יְחִידוֹת וְעוֹד 1 הֵן עוֹד עֶשֶׂר שְׁלֵמָה.` : `לִפְנֵי ${a} בָּא ${n}.` }; },
  tenMore: () => { const n0 = rint(12, 88), up = Math.random() < .5, n = up ? n0 + 10 : n0 - 10;
    return { n, opts: opts3(n, [up ? n0 + 1 : n0 - 1]), q: up ? `מָה הַמִּסְפָּר שֶׁגָּדוֹל בְּ-10 מִ-${n0}?` : `מָה הַמִּסְפָּר שֶׁקָּטָן בְּ-10 מִ-${n0}?`, why: `${up ? "מוֹסִיפִים" : "מוֹרִידִים"} עֶשֶׂר אַחַת: סִפְרַת הָעֲשָׂרוֹת ${up ? "גְּדֵלָה" : "קְטֵנָה"} בְּ-1, וְהַיְּחִידוֹת נִשְׁאָרוֹת: ${n}.` }; },
  // sequences on the snake
  seq: rule => () => {
    let s;
    if (rule === "up10") { const a = rint(1, 9); s = [0, 1, 2, 3, 4].map(i => a + i * 10); }
    else if (rule === "down10") { const a = rint(6, 9) * 10 + rint(1, 9); s = [0, 1, 2, 3, 4].map(i => a - i * 10); }
    else if (rule === "up1") { const a = rint(2, 8) * 10 - 3; s = [0, 1, 2, 3, 4].map(i => a + i); }
    else if (rule === "down1") { const a = rint(3, 9) * 10 + 2; s = [0, 1, 2, 3, 4].map(i => a - i); }
    else if (rule === "tens") { const a = rint(1, 5) * 10; s = [0, 1, 2, 3, 4].map(i => a + i * 10); }
    else s = [60, 70, 80, 90, 100];
    const gap = rule === "to100" ? 4 : rint(1, 3), n = s[gap], step = s[1] - s[0];
    return { n, pic: { snake: s, gap }, opts: opts3(n), q: "אֵיזֶה מִסְפָּר חָסֵר עַל הַנָּחָשׁ?",
      why: Math.abs(step) === 10 ? `בְּכָל צַעַד ${step > 0 ? "מוֹסִיפִים" : "מוֹרִידִים"} 10. סִפְרַת הַיְּחִידוֹת לֹא מִשְׁתַּנָּה: ${n}.` : `בְּכָל צַעַד ${step > 0 ? "מוֹסִיפִים" : "מוֹרִידִים"} 1: ${n}.` }; },
  // comparing
  compare: kind => () => {
    let a, b;
    if (kind === "swap") { a = rint(1, 8); b = rint(a + 1, 9); [a, b] = Math.random() < .5 ? [a * 10 + b, b * 10 + a] : [b * 10 + a, a * 10 + b]; }
    else if (kind === "sameTens") { const t = rint(2, 9), x = rint(0, 8); a = t * 10 + x; b = t * 10 + rint(x + 1, 9); if (Math.random() < .5) [a, b] = [b, a]; }
    else if (kind === "equal") { a = b = rint(21, 98); }
    else { a = rint(12, 95); b = rint(12, 95); if (a === b) b++; }
    const sign = a > b ? ">" : a < b ? "<" : "=";
    return { n: sign, pic: { cmp: [a, b] }, opts: [sign, ...[">", "<", "="].filter(x => x !== sign)], q: "אֵיזֶה סִימָן מַתְאִים בֵּין הַמִּסְפָּרִים?",
      why: sign === "=" ? "הַמִּסְפָּרִים שָׁוִים, לָכֵן כּוֹתְבִים =." : TENS(a) !== TENS(b) ? `מַשְׁוִים קֹדֶם עֲשָׂרוֹת: לְ-${Math.max(a, b)} יֵשׁ יוֹתֵר עֲשָׂרוֹת. הַפֶּה שֶׁל הַסִּימָן פָּתוּחַ לַמִּסְפָּר הַגָּדוֹל.` : `לְשְׁנֵיהֶם אוֹתָן עֲשָׂרוֹת, אָז מַשְׁוִים יְחִידוֹת: ${Math.max(a, b)} גָּדוֹל יוֹתֵר.` }; },
  bigger: () => { let a = rint(1, 8), b = rint(a + 1, 9); const big = b * 10 + a, small = a * 10 + b;
    return { n: big, opts: [String(big), String(small)], q: "מִי גָּדוֹל יוֹתֵר?", why: `מַשְׁוִים קֹדֶם אֶת סִפְרוֹת הָעֲשָׂרוֹת: ${b} עֶשְׂרוֹת זֶה יוֹתֵר מִ-${a} עֶשְׂרוֹת, לָכֵן ${big} גָּדוֹל יוֹתֵר.` }; },
  order: () => { const set = new Set(); while (set.size < 4) set.add(rint(11, 98)); const items = [...set].sort((x, y) => x - y);
    if (Math.random() < .6) { const t = rint(2, 8), o = rint(1, 8); if (o !== t && !items.includes(t * 10 + o) && !items.includes(o * 10 + t)) { items.splice(0, 2, Math.min(t * 10 + o, o * 10 + t), Math.max(t * 10 + o, o * 10 + t)); items.sort((x, y) => x - y); } }
    return { n: items.join(" "), items: items.map(String), q: "סַדְּרוּ אֶת הַמִּסְפָּרִים מֵהַקָּטָן לַגָּדוֹל.", why: `מֵהַקָּטָן לַגָּדוֹל: ${ISO(items.join(", "))}. מַשְׁוִים קֹדֶם עֲשָׂרוֹת.` }; },
  sortHalf: () => { const pool = new Set(); while (pool.size < 5) { const x = rint(12, 89); if (x !== 50) pool.add(x); }
    const items = [...pool].map(x => ({ t: String(x), a: x > 50 ? "big" : "small" }));
    return { n: "sort", items, bins: { small: "קָטָן מִ-50", big: "גָּדוֹל מִ-50" }, q: "מִיְּנוּ: כָּל מִסְפָּר קָטָן מִ-50 אוֹ גָּדוֹל מִ-50?", why: "מִסְפָּר עִם 4 עֲשָׂרוֹת אוֹ פָּחוֹת קָטָן מִ-50. מִסְפָּר עִם 5 עֲשָׂרוֹת וּמַעְלָה (חוּץ מִ-50 עַצְמוֹ) גָּדוֹל מִ-50." }; },
  // reaching a hundred
  tensCount: () => { const t = rint(3, 10), n = t * 10;
    return { n, pic: { qty: [t, 0, "coconut"] }, opts: opts3(n, [t, n + 1]), q: `סִפְרוּ בַּעֲשָׂרוֹת: כַּמָּה קוֹקוֹסִים יֵשׁ בְּ-${t} אַרְגָּזִים?`, why: `עֶשֶׂר, עֶשְׂרִים, שְׁלוֹשִׁים... ${t} עֲשָׂרוֹת הֵן ${n}.` }; },
  plusOne99: () => ({ n: 100, pic: { qty: [9, 9, "coconut"] }, opts: ["100", "910", "99", "109"], q: `יֵשׁ פֹּה 99 קוֹקוֹסִים. מוֹסִיפִים עוֹד קוֹקוֹס אֶחָד. כַּמָּה יֵשׁ עַכְשָׁו?`, why: "9 יְחִידוֹת וְעוֹד 1 הֵן עוֹד עֶשֶׂר. עַכְשָׁו יֵשׁ 10 עֲשָׂרוֹת: מֵאָה!" }),
  tensIn100: () => ({ n: 10, opts: ["10", "100", "1", "20"], q: "כַּמָּה אַרְגָּזִים שֶׁל 10 צָרִיךְ כְּדֵי שֶׁיִּהְיוּ 100 קוֹקוֹסִים?", why: "עֶשֶׂר, עֶשְׂרִים... תִּשְׁעִים, מֵאָה: 10 עֲשָׂרוֹת הֵן 100." }),
  ninetyPlus: () => { const o = rint(1, 9); return { n: 100, pic: { expr: `${90 + o} + ${10 - o} = ?` }, opts: ["100", String(90 + o + 1), "910", String(90 - o)], q: `כַּמָּה זֶה ${ISO(`${90 + o} + ${10 - o}`)}?`, why: `${o} וְעוֹד ${10 - o} הֵם עֶשֶׂר. 9 עֲשָׂרוֹת וְעוֹד עֶשֶׂר הֵן 100.` }; },
  lock100: () => ({ n: 100, cells: 3, q: "הַתֵּבָה נְעוּלָה. כִּתְבוּ אֶת הַקּוֹד: הַמִּסְפָּר מֵאָה.", why: "מֵאָה כּוֹתְבִים בְּשָׁלוֹשׁ סְפָרוֹת: 1 בִּמְקוֹם הַמֵּאוֹת, 0 עֲשָׂרוֹת וְ-0 יְחִידוֹת." }),
};
// a question template: the fixed part (type, skill, a sample text for the teacher's view) plus its maker
const MK = (type, skill, sample, make) => ({ type, skill, q: sample, make });

/* ---------- the three tracks ---------- */
const T1 = [
  { id: "t1", title: "אִי הַקּוֹקוֹסִים", sub: "אוֹרְזִים 10 בְּאַרְגָּז", skill: "count", art: "island-coconuts",
    owl: ["אַהוֹי! אֲנִי קַפְּטֶן תֻּכִּי, וַאֲנִי מְלַוֶּה אוֹתְךָ בַּמַּסָּע לָאִי שֶׁל הַמֵּאָה.", "בָּאִי הַזֶּה אוֹרְזִים קוֹקוֹסִים. בְּכָל אַרְגָּז נִכְנָסִים בְּדִיּוּק 10."],
    tools: ["גּוֹעִים בְּקוֹקוֹס כְּדֵי לְהַכְנִיס אוֹתוֹ לָאַרְגָּז.", "כְּשֶׁיֵּשׁ 10, הָאַרְגָּז נִסְגָּר.", "סוֹפְרִים: כַּמָּה אַרְגָּזִים? כַּמָּה נִשְׁאֲרוּ בַּחוּץ?"],
    parent: "פתיחה: אריזה של 10 יחידות לעשרת אחת. הילד אורז בעצמו קוקוסים בארגזים, ורואה שהכמות נשארת אותה כמות, רק מסודרת אחרת. זה היסוד של כל המבנה העשרוני.",
    questions: [
      MK("pack", "count", "אורזים 12 עד 19 קוקוסים", Q.pack(12, 19)),
      { type: "mc", skill: "count", q: "כַּמָּה קוֹקוֹסִים יֵשׁ בְּאַרְגָּז מָלֵא?", pic: { qty: [1, 0, "coconut"] }, opts: ["10", "1", "100", "5"], why: "בְּכָל אַרְגָּז מָלֵא יֵשׁ בְּדִיּוּק 10 קוֹקוֹסִים." },
      MK("pack", "count", "אורזים 21 עד 29 קוקוסים", Q.pack(21, 29)),
      MK("mc", "count", "כמה קוקוסים ב-3 ארגזים?", () => { const t = rint(2, 5); return { n: t * 10, pic: { qty: [t, 0, "coconut"] }, opts: [String(t * 10), String(t), String(t + 10)], q: `כַּמָּה קוֹקוֹסִים יֵשׁ בְּ-${t} אַרְגָּזִים מְלֵאִים?`, why: `סוֹפְרִים בַּעֲשָׂרוֹת: ${["", "עֶשֶׂר", "עֶשֶׂר, עֶשְׂרִים", "עֶשֶׂר, עֶשְׂרִים, שְׁלוֹשִׁים", "עֶשֶׂר, עֶשְׂרִים, שְׁלוֹשִׁים, אַרְבָּעִים", "עֶשֶׂר, עֶשְׂרִים, שְׁלוֹשִׁים, אַרְבָּעִים, חֲמִשִּׁים"][t]}.` }; }),
      MK("pack", "count", "אורזים 31 עד 38 קוקוסים", Q.pack(31, 38)),
      MK("mc", "count", "כמה ארגזים אפשר לארוז?", () => { const n = rint(13, 47); return { n: TENS(n), pic: { loose: n }, opts: [String(TENS(n)), String(TENS(n) + 1), String(n), String(ONES(n))], q: `יֵשׁ ${n} קוֹקוֹסִים. כַּמָּה אַרְגָּזִים מְלֵאִים אֶפְשָׁר לֶאֱרֹז?`, why: `בְּ-${n} יֵשׁ ${TENS(n)} עֲשָׂרוֹת: ${TENS(n)} אַרְגָּזִים מְלֵאִים, וְעוֹד ${ONES(n)} קוֹקוֹסִים שֶׁלֹּא מַסְפִּיקִים לְאַרְגָּז.` }; }),
    ] },
  { id: "t2", title: "אִי הַגַּחְלִילִיּוֹת", sub: "כַּמָּה יֵשׁ? צִנְצָנוֹת וּבוֹדְדוֹת", skill: "read", art: "island-fireflies",
    owl: ["בַּלַּיְלָה הַגַּחְלִילִיּוֹת מְאִירוֹת אֶת הָאִי.", "בְּכָל צִנְצָנָת מְלֵאָה יֵשׁ 10 גַּחְלִילִיּוֹת. לֹא צָרִיךְ לִסְפֹּר אוֹתָן אַחַת-אַחַת!"],
    tools: ["סוֹפְרִים אֶת הַצִּנְצָנוֹת בַּעֲשָׂרוֹת: עֶשֶׂר, עֶשְׂרִים, שְׁלוֹשִׁים...", "מַמְשִׁיכִים לִסְפֹּר אֶת הַגַּחְלִילִיּוֹת הַבּוֹדְדוֹת: אַחַת, שְׁתַּיִם...", "הַצִּנְצָנוֹת הֵן הָעֲשָׂרוֹת, וְהֵן נִכְתָּבוֹת רִאשׁוֹנוֹת."],
    parent: "קריאת כמות: צנצנות (עשרות) ובודדות (יחידות). הטעות הנפוצה היא להפוך את הספרות (לכתוב 74 במקום 47). כשזה קורה, המשחק מסביר שהעשרות נכתבות ראשונות.",
    questions: [
      MK("mc", "read", "כמה גחליליות? (עשרות ויחידות)", Q.qty("firefly", 1, 4)),
      MK("mc", "read", "כמה גחליליות? (עשרות ויחידות)", Q.qty("firefly", 2, 6)),
      MK("mc", "read", "כמה גחליליות? (עשרות בלבד)", Q.qty("firefly", 2, 8, 0, 0)),
      MK("mc", "read", "כמה גחליליות? (עשרות ויחידות)", Q.qty("firefly", 4, 9)),
      MK("mc", "read", "כמה גחליליות? (יחידות בלבד)", Q.qty("firefly", 0, 0, 3, 9)),
      MK("mc", "read", "כמה גחליליות? (עשרות ויחידות)", Q.qty("firefly", 1, 9)),
      MK("mc", "read", "כמה גחליליות? (עשרות ויחידות)", Q.qty("firefly", 5, 9)),
    ] },
  { id: "t3", title: "אִי הָרַכֶּבֶת", sub: "מַעֲמִיסִים עֲשָׂרוֹת וִיחִידוֹת", skill: "compose", art: "island-train",
    owl: ["הָרַכֶּבֶת שֶׁל הָאִי מוֹבִילָה קוֹקוֹסִים.", "אַרְגָּזִים עוֹלִים לִקְרוֹן הָעֲשָׂרוֹת, קוֹקוֹסִים בּוֹדְדִים לִקְרוֹן הַיְּחִידוֹת."],
    tools: ["קוֹרְאִים אֶת הַמִּסְפָּר שֶׁעַל הַקַּטָּר.", "סִפְרַת הָעֲשָׂרוֹת: כַּמָּה אַרְגָּזִים. סִפְרַת הַיְּחִידוֹת: כַּמָּה קוֹקוֹסִים.", "יֵשׁ 10 קוֹקוֹסִים בּוֹדְדִים? אוֹרְזִים אוֹתָם בְּאַרְגָּז!"],
    parent: "בניית מספר: הילד מעמיס בעצמו עשרות ויחידות לפי מספר כתוב. בשאלה אחת כבר יש בקרון יותר מ-10 יחידות, והילד צריך להחליף 10 יחידות בעשרת (פריטה הפוכה). זו הבנה עמוקה של המבנה העשרוני.",
    questions: [
      MK("load", "compose", "מעמיסים מספר דו-ספרתי", Q.load()),
      MK("load", "compose", "מעמיסים מספר דו-ספרתי", Q.load()),
      MK("load", "compose", "מעמיסים עשרות שלמות", Q.load("round")),
      MK("load", "compose", "מעמיסים מספר דו-ספרתי", Q.load()),
      MK("load", "compose", "מחליפים 10 יחידות בעשרת", Q.load("any", "trade")),
      MK("load", "compose", "מעמיסים מספר דו-ספרתי", Q.load()),
    ] },
  { id: "t4", title: "מְעָרוֹת הַסַּרְטָנִים", sub: "כָּל סִפְרָה לַמְּעָרָה שֶׁלָּהּ", skill: "write", art: "island-crabs",
    owl: ["לַסַּרְטָנִים יֵשׁ שְׁתֵּי מְעָרוֹת: מְעָרַת הָעֲשָׂרוֹת וּמְעָרַת הַיְּחִידוֹת.", "כָּל סִפְרָה נִכְנֶסֶת לַמְּעָרָה שֶׁלָּהּ. אִם אֵין יְחִידוֹת, כּוֹתְבִים 0."],
    tools: ["סוֹפְרִים אֶת הָאַרְגָּזִים, וְכוֹתְבִים בִּמְעָרַת הָעֲשָׂרוֹת.", "סוֹפְרִים אֶת הַקּוֹקוֹסִים הַבּוֹדְדִים, וְכוֹתְבִים בִּמְעָרַת הַיְּחִידוֹת.", "בּוֹדְקִים: מְעָרַת הָעֲשָׂרוֹת מִשְּׂמֹאל, כְּמוֹ בַּמִּסְפָּר."],
    parent: "טבלת עשרות ויחידות: הילד כותב בעצמו ספרה בכל עמודה. שימו לב לשאלה עם 0 ביחידות (למשל 60): ילדים רבים כותבים רק 6. המשחק מסביר למה צריך את ה-0.",
    questions: [
      MK("chart", "write", "כותבים בטבלה כמות שבתמונה", Q.chart()),
      MK("chart", "write", "כותבים בטבלה כמות שבתמונה", Q.chart()),
      MK("chart", "write", "כותבים בטבלה עשרות בלי יחידות", Q.chart(true)),
      MK("chart", "write", "כותבים בטבלה מספר מתואר במילים", Q.chartWords),
      MK("chart", "write", "כותבים בטבלה כמות שבתמונה", Q.chart()),
      MK("chart", "write", "כותבים בטבלה מספר מתואר במילים", Q.chartWords),
    ] },
  { id: "t5", title: "אִי הַבַּקְבּוּקִים", sub: "כַּמָּה שָׁוָה הַסִּפְרָה?", skill: "value", art: "island-bottles",
    owl: ["בְּכָל בַּקְבּוּק שֶׁצָּף לַחוֹף יֵשׁ חִידָה.", "סוֹד: אוֹתָהּ סִפְרָה שָׁוָה דְּבָרִים שׁוֹנִים לְפִי הַמָּקוֹם שֶׁלָּהּ!"],
    tools: ["מוֹצְאִים אֶת הַסִּפְרָה בַּמִּסְפָּר.", "בּוֹדְקִים: הִיא בְּמָקוֹם הָעֲשָׂרוֹת אוֹ הַיְּחִידוֹת?", "בְּמָקוֹם הָעֲשָׂרוֹת: הִיא שָׁוָה עֶשְׂרוֹת. בְּמָקוֹם הַיְּחִידוֹת: הִיא שָׁוָה יְחִידוֹת."],
    parent: "ערך הספרה לפי מקומה: ב-74 הספרה 7 שווה 70, וב-47 היא שווה 7. אם הילד מתבלבל, אפשר לחזור לתמונה של ארגזים וקוקוסים.",
    questions: [
      MK("mc", "value", "כמה שווה ספרת העשרות?", Q.digitValue),
      MK("mc", "value", "חידה: עשרות ויחידות", Q.riddle),
      MK("mc", "value", "כמה שווה ספרת היחידות?", Q.onesValue),
      MK("mc", "value", "באיזה מספר הספרה שווה עשרות?", Q.whichTens),
      MK("mc", "value", "כמה שווה ספרת העשרות?", Q.digitValue),
      MK("mc", "value", "חידה: בין שתי עשרות", Q.between),
      MK("mc", "value", "חידה: היחידות נאמרות קודם", Q.riddleSwap),
    ] },
  { id: "t6", title: "מִבְדַּק הָעֲשָׂרוֹת", sub: "מִבְדָּק לְדֻגְמָה, בְּלִי רְמָזִים", skill: "read", art: "island-treasure", test: true,
    owl: ["זֶה מִבְדָּק לְדֻגְמָה, כְּמוֹ בַּכִּתָּה.", "אֵין רְמָזִים. עוֹנִים לְבַד, וּבַסּוֹף רוֹאִים אֶת כָּל הַתְּשׁוּבוֹת."],
    tools: ["קוֹרְאִים כָּל שְׁאֵלָה עַד הַסּוֹף.", "עֲשָׂרוֹת קֹדֶם, אַחַר כָּךְ יְחִידוֹת.", "לֹא מְמַהֲרִים. בּוֹדְקִים לִפְנֵי שֶׁמַּמְשִׁיכִים."],
    parent: "מבדק דמה לכל מסלול העשרות: קריאת כמות, כתיבה בטבלה, בנייה וערך הספרה. אין רמזים ואין מטבעות על כל תשובה, ובסוף מוצג סיכום של כל התשובות.",
    questions: [
      MK("mc", "read", "כמה קוקוסים?", Q.qty("coconut", 2, 9)),
      MK("chart", "write", "כותבים בטבלה", Q.chart()),
      MK("mc", "value", "כמה שווה ספרת העשרות?", Q.digitValue),
      MK("load", "compose", "מעמיסים מספר", Q.load()),
      MK("mc", "read", "כמה גחליליות?", Q.qty("firefly", 1, 9)),
      MK("chart", "write", "כותבים בטבלה עשרות בלי יחידות", Q.chart(true)),
      MK("mc", "value", "חידה: עשרות ויחידות", Q.riddle),
      MK("mc", "count", "כמה ארגזים אפשר לארוז?", T1Q6()),
    ] },
];
function T1Q6() { return () => { const n = rint(23, 68); return { n: TENS(n), pic: { loose: n }, opts: [String(TENS(n)), String(TENS(n) + 1), String(n), String(ONES(n))], q: `יֵשׁ ${n} קוֹקוֹסִים. כַּמָּה אַרְגָּזִים מְלֵאִים אֶפְשָׁר לֶאֱרֹז?`, why: `בְּ-${n} יֵשׁ ${TENS(n)} עֲשָׂרוֹת.` }; }; }

const T2 = [
  { id: "r1", title: "הַר הַגַּעַשׁ", sub: "10 יוֹתֵר, 10 פָּחוֹת", skill: "line", art: "island-volcano",
    owl: ["הַסַּרְטָן עוֹלֶה לְהַר הַגַּעַשׁ בִּשְׁבִיל הָאֲבָנִים.", "קְפִיצָה גְּדוֹלָה הִיא 10, קְפִיצָה קְטַנָּה הִיא 1."],
    tools: ["קְפִיצָה שֶׁל 10 קָדִימָה: סִפְרַת הָעֲשָׂרוֹת גְּדֵלָה בְּ-1.", "קְפִיצָה שֶׁל 10 אֲחוֹרָה: סִפְרַת הָעֲשָׂרוֹת קְטֵנָה בְּ-1.", "סִפְרַת הַיְּחִידוֹת לֹא זָזָה!"],
    parent: "10 יותר ו-10 פחות, בלי לספור אחד-אחד. גם 1 יותר ו-1 פחות במעבר עשרת (39 ← 40, 60 ← 59), שם ילדים רבים טועים.",
    questions: [
      MK("mc", "line", "קפיצה של 10 קדימה", Q.jump(10)),
      MK("mc", "line", "קפיצה של 10 קדימה", Q.jump(10)),
      MK("mc", "line", "קפיצה של 10 אחורה", Q.jump(-10)),
      MK("mc", "line", "קפיצה של 1 קדימה (מעבר עשרת)", Q.jump(1)),
      MK("mc", "line", "קפיצה של 10 אחורה", Q.jump(-10)),
      MK("mc", "line", "קפיצה של 1 אחורה (מעבר עשרת)", Q.jump(-1)),
      MK("mc", "line", "10 יותר או 10 פחות", Q.tenMore),
      MK("mc", "line", "קפיצה של 20 קדימה", Q.jump(20)),
    ] },
  { id: "r2", title: "אִי הַנָּחָשׁ", sub: "מָה חָסֵר בַּסִּדְרָה?", skill: "seq", art: "island-snake",
    owl: ["עַל הַנָּחָשׁ הָאָרֹךְ כְּתוּבִים מִסְפָּרִים לְפִי הַסֵּדֶר.", "אֶחָד מֵהֶם הִתְחַבֵּא. נִמְצָא אוֹתוֹ!"],
    tools: ["מִסְתַּכְּלִים עַל שְׁנֵי מִסְפָּרִים שֶׁל נָחָשׁ: בְּכַמָּה הֵם גְּדֵלִים?", "אוֹ אוּלַי הֵם קְטֵנִים?", "מַמְשִׁיכִים אֶת אוֹתוֹ כְּלָל עַד הַמִּסְפָּר הֶחָסֵר."],
    parent: "סדרות שעולות ויורדות ב-1 וב-10. הילד מחפש את הכלל של הסדרה. בסדרות של 10 רק ספרת העשרות משתנה, וזו הזדמנות לראות את המבנה העשרוני.",
    questions: [
      MK("mc", "seq", "סדרה עולה ב-10", Q.seq("up10")),
      MK("mc", "seq", "סדרה עולה ב-1", Q.seq("up1")),
      MK("mc", "seq", "סדרה יורדת ב-10", Q.seq("down10")),
      MK("mc", "seq", "סדרה של עשרות שלמות", Q.seq("tens")),
      MK("mc", "seq", "סדרה יורדת ב-1", Q.seq("down1")),
      MK("mc", "seq", "סדרה עולה ב-10", Q.seq("up10")),
      MK("mc", "seq", "90 ועוד 10", Q.seq("to100")),
    ] },
  { id: "r3", title: "אִי הַתֻּכִּים", sub: "מִי גָּדוֹל יוֹתֵר?", skill: "compare", art: "island-parrots",
    owl: ["שְׁנֵי תֻּכִּים מִתְוַכְּחִים: לְמִי יֵשׁ יוֹתֵר קוֹקוֹסִים?", "בּוֹאוּ נַעֲזֹר לָהֶם לְהַשְׁווֹת."],
    tools: ["מַשְׁוִים קֹדֶם אֶת סִפְרוֹת הָעֲשָׂרוֹת.", "אִם הָעֲשָׂרוֹת שָׁווֹת, מַשְׁוִים אֶת הַיְּחִידוֹת.", "הַפֶּה שֶׁל הַסִּימָן < פָּתוּחַ תָּמִיד לַמִּסְפָּר הַגָּדוֹל."],
    parent: "השוואת מספרים דו-ספרתיים. המלכודת: 39 מול 41 (9 גדול מ-1, אבל 39 קטן מ-41). הכלל: קודם משווים עשרות. הסימנים < ו-> מוצגים בתוך תרגיל משמאל לימין, כמו במחברת.",
    questions: [
      MK("mc", "compare", "מי גדול יותר? (ספרות הפוכות)", Q.bigger),
      MK("mc", "compare", "סימן השוואה", Q.compare("any")),
      MK("mc", "compare", "סימן השוואה (אותן עשרות)", Q.compare("sameTens")),
      MK("mc", "compare", "סימן השוואה (ספרות הפוכות)", Q.compare("swap")),
      MK("mc", "compare", "סימן השוואה (שווים)", Q.compare("equal")),
      MK("mc", "compare", "מי גדול יותר? (ספרות הפוכות)", Q.bigger),
      MK("mc", "compare", "סימן השוואה", Q.compare("any")),
    ] },
  { id: "r4", title: "נְמַל הַסִּדּוּר", sub: "מְסַדְּרִים וּמְמַיְּנִים", skill: "compare", art: "island-coconuts",
    owl: ["בַּנָּמָל מַגִּיעוֹת סְפִינוֹת עִם מִסְפָּרִים.", "צָרִיךְ לְסַדֵּר אוֹתָן בַּתּוֹר, מֵהַקְּטַנָּה לַגְּדוֹלָה."],
    tools: ["מְחַפְּשִׂים אֶת הַמִּסְפָּר עִם הֲכִי מְעַט עֲשָׂרוֹת.", "אִם יֵשׁ שְׁנַיִם עִם אוֹתָן עֲשָׂרוֹת, בּוֹדְקִים יְחִידוֹת.", "גּוֹעִים בַּכַּרְטִיסִים לְפִי הַסֵּדֶר."],
    parent: "סידור מספרים מהקטן לגדול ומיון לפי \"קטן מ-50 / גדול מ-50\". בשאלות הסידור יש בכוונה זוג מספרים עם ספרות הפוכות (למשל 36 ו-63).",
    questions: [
      MK("order", "compare", "מסדרים 4 מספרים מהקטן לגדול", Q.order),
      MK("sort", "compare", "ממיינים: קטן או גדול מ-50", Q.sortHalf),
      MK("order", "compare", "מסדרים 4 מספרים מהקטן לגדול", Q.order),
      MK("mc", "compare", "סימן השוואה", Q.compare("swap")),
      MK("order", "compare", "מסדרים 4 מספרים מהקטן לגדול", Q.order),
      MK("sort", "compare", "ממיינים: קטן או גדול מ-50", Q.sortHalf),
    ] },
  { id: "r5", title: "חִידוֹת הַקַּפְּטֶן", sub: "מְפָרְקִים וּמַרְכִּיבִים", skill: "compose", art: "island-bottles",
    owl: ["קַפְּטֶן תֻּכִּי אוֹהֵב חִידוֹת מִסְפָּרִים.", "כָּל מִסְפָּר אֶפְשָׁר לְפָרֵק לַעֲשָׂרוֹת וִיחִידוֹת, וּלְהַרְכִּיב בַּחֲזָרָה."],
    tools: ["מוֹצְאִים כַּמָּה עֲשָׂרוֹת יֵשׁ בַּמִּסְפָּר.", "מוֹצְאִים כַּמָּה יְחִידוֹת.", "עֲשָׂרוֹת + יְחִידוֹת = הַמִּסְפָּר."],
    parent: "הרכבה ופירוק: 47 = 40 + 7. התרגילים מוצגים משמאל לימין, כמו בחשבון. בשאלה \"איזה מספר חסר\" הילד משלים את העשרות.",
    questions: [
      MK("mc", "compose", "כמה זה עשרות + יחידות?", Q.expand),
      MK("mc", "compose", "מפרקים לעשרות ויחידות", Q.split),
      MK("mc", "compose", "איזה מספר חסר בתרגיל?", Q.missingPart),
      MK("mc", "compose", "כמה זה עשרות + יחידות?", Q.expand),
      MK("mc", "compose", "מפרקים לעשרות ויחידות", Q.split),
      MK("mc", "compose", "איזה מספר חסר בתרגיל?", Q.missingPart),
    ] },
  { id: "r6", title: "מִבְדַּק הַמִּסְפָּרִים", sub: "מִבְדָּק לְדֻגְמָה, בְּלִי רְמָזִים", skill: "compare", art: "island-treasure", test: true,
    owl: ["זֶה מִבְדָּק לְדֻגְמָה שֶׁל מַסְלוּל הַמִּסְפָּרִים.", "אֵין רְמָזִים. בַּסּוֹף רוֹאִים אֶת כָּל הַתְּשׁוּבוֹת."],
    tools: ["קוֹרְאִים כָּל שְׁאֵלָה עַד הַסּוֹף.", "בְּקְפִיצָה שֶׁל 10 רַק הָעֲשָׂרוֹת מִשְׁתַּנּוֹת.", "בְּהַשְׁוָאָה: קֹדֶם עֲשָׂרוֹת."],
    parent: "מבדק דמה למסלול המספרים: 10 יותר ופחות, סדרות, השוואה, סידור ופירוק. בלי רמזים.",
    questions: [
      MK("mc", "line", "קפיצה של 10 קדימה", Q.jump(10)),
      MK("mc", "seq", "סדרה עולה ב-10", Q.seq("up10")),
      MK("mc", "compare", "סימן השוואה", Q.compare("swap")),
      MK("order", "compare", "מסדרים מהקטן לגדול", Q.order),
      MK("mc", "line", "קפיצה של 1 קדימה (מעבר עשרת)", Q.jump(1)),
      MK("mc", "compose", "מפרקים לעשרות ויחידות", Q.split),
      MK("mc", "seq", "סדרה יורדת ב-10", Q.seq("down10")),
      MK("mc", "line", "10 יותר או 10 פחות", Q.tenMore),
    ] },
];

const T3 = [
  { id: "c1", title: "קוֹקוֹסִים בְּלִי סֵדֶר", sub: "יוֹתֵר מִ-10 בּוֹדְדִים", skill: "compose", art: "island-coconuts",
    owl: ["מִישֶׁהוּ שָׁכַח לֶאֱרֹז אֶת כָּל הַקּוֹקוֹסִים!", "כְּשֶׁיֵּשׁ 10 בּוֹדְדִים אוֹ יוֹתֵר, אֶפְשָׁר לֶאֱרֹז מֵהֶם עוֹד אַרְגָּז."],
    tools: ["סוֹפְרִים אֶת הָאַרְגָּזִים.", "סוֹפְרִים אֶת הַבּוֹדְדִים. יֵשׁ 10 אוֹ יוֹתֵר?", "מִכָּל 10 בּוֹדְדִים יוֹצֵא עוֹד אַרְגָּז."],
    parent: "כמויות לא מסודרות: יותר מ-10 יחידות בודדות (למשל 3 עשרות ו-14 יחידות = 44). כאן בודקים אם הילד מבין ש-10 יחידות הן עשרת, ולא רק \"קורא ספרות\".",
    questions: [
      MK("mc", "compose", "עשרות ויותר מ-10 יחידות", Q.messy),
      MK("load", "compose", "מחליפים 10 יחידות בעשרת", Q.load("any", "trade")),
      MK("mc", "compose", "עשרות ויותר מ-10 יחידות", Q.messy),
      MK("load", "compose", "מחליפים 10 יחידות בעשרת", Q.load("any", "trade")),
      MK("mc", "compose", "עשרות ויותר מ-10 יחידות", Q.messy),
    ] },
  { id: "c2", title: "חִידוֹת לַאֲלוּפִים", sub: "חוֹשְׁבִים עַל הַמָּקוֹם", skill: "value", art: "island-snake",
    owl: ["חִידוֹת קָשׁוֹת יוֹתֵר, רַק לַאֲלוּפִים!", "צָרִיךְ לַחְשֹׁב טוֹב עַל הַמָּקוֹם שֶׁל כָּל סִפְרָה."],
    tools: ["קוֹרְאִים אֶת הַחִידָה פַּעֲמַיִם.", "מוֹצְאִים מָה יָדוּעַ: כַּמָּה עֲשָׂרוֹת? כַּמָּה יְחִידוֹת?", "בּוֹדְקִים אֶת הַתְּשׁוּבָה מוּל הַחִידָה."],
    parent: "חידות שדורשות לחשוב על מקום הספרה, וגם סדר הפוך (\"7 יחידות ו-5 עשרות\").",
    questions: [
      MK("mc", "value", "חידה: היחידות נאמרות קודם", Q.riddleSwap),
      MK("mc", "value", "באיזה מספר הספרה שווה עשרות?", Q.whichTens),
      MK("mc", "compose", "איזה מספר חסר בתרגיל?", Q.missingPart),
      MK("mc", "value", "חידה: בין שתי עשרות", Q.between),
      MK("mc", "value", "כמה שווה ספרת היחידות?", Q.onesValue),
      MK("mc", "compose", "מפרקים לעשרות ויחידות", Q.split),
    ] },
  { id: "c3", title: "בַּדֶּרֶךְ לַמֵּאָה", sub: "10 עֲשָׂרוֹת הֵן מֵאָה", skill: "hundred", art: "island-volcano",
    owl: ["אֲנַחְנוּ מִתְקָרְבִים לָאִי שֶׁל הַמֵּאָה!", "מָה קוֹרֶה כְּשֶׁיֵּשׁ 9 אַרְגָּזִים וְעוֹד 9 קוֹקוֹסִים, וּמוֹסִיפִים אֶחָד?"],
    tools: ["סוֹפְרִים בַּעֲשָׂרוֹת: עֶשֶׂר, עֶשְׂרִים... תִּשְׁעִים, מֵאָה.", "10 יְחִידוֹת הֵן עֶשֶׂר. 10 עֲשָׂרוֹת הֵן מֵאָה.", "מֵאָה כּוֹתְבִים בְּשָׁלוֹשׁ סְפָרוֹת: 100."],
    parent: "המעבר ל-100: מניה בעשרות, 99 ועוד 1, ו-10 עשרות שהן מאה. זו הכנה לאי המאה, התחנה האחרונה במסע.",
    questions: [
      MK("mc", "hundred", "סופרים בעשרות", Q.tensCount),
      MK("mc", "hundred", "99 ועוד 1", Q.plusOne99),
      MK("mc", "seq", "90 ועוד 10", Q.seq("to100")),
      MK("mc", "hundred", "כמה עשרות במאה?", Q.tensIn100),
      MK("mc", "hundred", "משלימים למאה", Q.ninetyPlus),
      MK("mc", "hundred", "סופרים בעשרות", Q.tensCount),
    ] },
  { id: "c4", title: "אִי הַמֵּאָה", sub: "פּוֹתְחִים אֶת תֵּבַת הָאוֹצָר", skill: "hundred", art: "island-lock", test: true,
    owl: ["הִגַּעְנוּ לָאִי שֶׁל הַמֵּאָה!", "תֵּבַת הָאוֹצָר נְעוּלָה. רַק מִי שֶׁמֵּבִין עֲשָׂרוֹת וִיחִידוֹת יָכוֹל לִפְתֹּחַ אוֹתָהּ."],
    tools: ["עוֹנִים עַל כָּל הַשְּׁאֵלוֹת לְבַד.", "זוֹכְרִים: 10 יְחִידוֹת הֵן עֶשֶׂר, 10 עֲשָׂרוֹת הֵן מֵאָה.", "בַּסּוֹף: הַקּוֹד שֶׁל הַתֵּבָה!"],
    parent: "התחנה האחרונה: מבדק מסכם לכל המסע, שנגמר בפתיחת תיבת האוצר עם הקוד 100.",
    questions: [
      MK("mc", "compose", "עשרות ויותר מ-10 יחידות", Q.messy),
      MK("mc", "value", "כמה שווה ספרת העשרות?", Q.digitValue),
      MK("mc", "compare", "סימן השוואה", Q.compare("swap")),
      MK("mc", "line", "קפיצה של 10 אחורה", Q.jump(-10)),
      MK("mc", "hundred", "99 ועוד 1", Q.plusOne99),
      MK("chart", "hundred", "הקוד של התיבה: 100", Q.lock100),
    ] },
];

const TRACKS = [
  { id: "h", name: "מַסְלוּל הָעֲשָׂרוֹת", sub: "אוֹרְזִים עֲשָׂרוֹת, סוֹפְרִים וְכוֹתְבִים", badge: "מַתְחִילִים כָּאן", icon: "crate-full", stations: T1 },
  { id: "r", name: "מַסְלוּל הַמִּסְפָּרִים", sub: "קְפִיצוֹת, סְדָרוֹת וְהַשְׁוָאוֹת", icon: "stone", stations: T2 },
  { id: "c", name: "אִיֵּי הָאֶתְגָּר", sub: "לַאֲלוּפִים, עַד הַמֵּאָה", badge: "לְמִתְקַדְּמִים", icon: "chest", stations: T3 },
];
const ALL = TRACKS.flatMap(t => t.stations);
const TABLE_SKILLS = ["count", "read", "write", "value", "compose", "line", "compare"];

/* ---------- the teacher's settings: written into the page itself, so every child's device gets them ---------- */
const CFG_DEFAULT = { teacher: "", school: "", classes: [], testDate: "2026-11-02", message: "", stations: {}, ordered: true, challenge: true };
let CFG = { ...CFG_DEFAULT };
try { const el = document.getElementById("teacher-config"); if (el) CFG = { ...CFG_DEFAULT, ...JSON.parse(el.textContent || "{}") }; } catch (e) {}
// the same game runs on claude.ai (artifact storage) or on the teacher's own Netlify site (its /api)
const ON_SITE = window.GM_HOST === "netlify";
const TPASS = "gm-teacher-pass";
const tpass = () => { try { return sessionStorage.getItem(TPASS) || ""; } catch (e) { return ""; } };
async function api(path, opts = {}) {
  const headers = { "content-type": "application/json", ...(opts.teacher ? { "x-teacher-pass": opts.pass ?? tpass() } : {}) };
  const res = await fetch("/api/" + path, { method: opts.method || "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { code: data.error || "http_" + res.status, status: res.status };
  return data;
}
const stCfg = s => (CFG.stations && CFG.stations[s.id]) || {};
const opensOn = s => stCfg(s).from || "";
function stationClosed(s) {
  const c = stCfg(s);
  if (c.open === false) return true;
  return !!(c.from && ymd(today0()) < c.from);
}
const featured = s => !!stCfg(s).featured && !stationClosed(s);
const trackVisible = t => TRACKS[t].id !== "c" || CFG.challenge !== false;
const fmtDate = d => { const x = parseYmd(d); return x ? `${x.getDate()}/${x.getMonth() + 1}` : ""; };

/* the page's own source, used when the teacher saves: the platform skeleton plus this small shell with the settings inside */
const SHELL_HEAD = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n';
function shellBody(cfg) {
  const json = JSON.stringify(cfg).replace(/</g, "\\u003c");
  return `<title>מסע לאי המאה</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Noto+Sans+Hebrew:wght@400;600;800&family=Rubik:wght@400;500;700&display=swap">
<link rel="stylesheet" href="app.css">
<div class="app" dir="rtl" lang="he">
  <div id="root"></div>
</div>
<div class="toast" id="toast" hidden></div>
<script id="teacher-config" type="application/json">${json}</script>
<script src="app.js"></script>
`;
}
const shellDoc = cfg => SHELL_HEAD + shellBody(cfg) + "\n</body></html>";

/* ---------- sorting and live-checked writing ---------- */
const bare = t => plain(t).replace(/[^א-ת\s]/g, " ");
function writeChecks(q, text) {
  const words = bare(text).split(/\s+/).filter(Boolean);
  const keys = (q.keywords || []).map(k => bare(k).trim()).filter(Boolean);
  // a question word counts with or without the little prefixes (ה, ו, ב, ל, מ, ש, כ)
  const strip = w => w.replace(/^[והבלמשכ]{1,2}(?=[א-ת]{2})/, "");
  const usesQ = words.some(w => keys.some(k => strip(w) === strip(k) || (w.length > 2 && (w.includes(strip(k)) || strip(k).includes(strip(w))))));
  const out = [{ k: "q", ok: usesQ, label: "הִשְׁתַּמַּשְׁתִּי בְּמִלִּים מֵהַשְּׁאֵלָה" }];
  if (q.reason) out.push({ k: "why", ok: words.some(w => /^ו?(כי|מפני|בגלל)$/.test(w) || /^ו?מפני/.test(w)), label: "הוֹסַפְתִּי סִבָּה עִם \"כִּי\"" });
  out.push({ k: "len", ok: words.length >= (q.minWords || 5), label: `מִשְׁפָּט שָׁלֵם: לְפָחוֹת ${q.minWords || 5} מִלִּים` });
  out.push({ k: "dot", ok: /[.!]\s*$/.test(text.trim()), label: "נְקֻדָּה בַּסּוֹף" });
  return out;
}
const checksHTML = list => list.map(c => `<li class="${c.ok ? "ok" : ""}"><span class="ck">${c.ok ? "✓" : ""}</span>${tx(c.label)}</li>`).join("");

function renderSort(s, q, st, nextBtn) {
  const rows = q.items.map((it, k) => {
    const pick = st.sort[k], mark = st.smarks ? (st.smarks[k] ? " right" : " wrong") : "";
    return `<div class="sort-row${mark}"><span class="sort-t">${tx(it.t)}</span><span class="sort-btns">
      ${Object.entries(q.bins).map(([b, lab]) => `<button class="sort-b ${pick === b ? "on" : ""} b-${b}" data-sort="${k}:${b}" ${st.locked ? "disabled" : ""}>${tx(lab)}</button>`).join("")}</span></div>`;
  }).join("");
  const full = q.items.every((_, k) => st.sort[k]);
  return `<div class="sort-list">${rows}</div>
    ${st.locked ? "" : `<div class="row"><button class="btn" data-act="checksort" ${full ? "" : "disabled"}>${tx("בְּדִיקָה")}</button></div>`}
    ${feedback(q, st)}${st.locked ? `<div class="row">${nextBtn}</div>` : ""}`;
}
function checkSort() {
  const q = ST().questions[run.qi], st = run.q;
  st.tries++;
  st.smarks = q.items.map((it, k) => st.sort[k] === it.a);
  if (st.smarks.every(Boolean)) { st.locked = true; settle(st.tries === 1); chime(true); }
  else {
    chime(false);
    const wrong = st.smarks.filter(x => !x).length;
    st.fbMsg = `${wrong === 1 ? "מִסְפָּר אֶחָד לֹא בַּמָּקוֹם" : wrong + " מִסְפָּרִים לֹא בַּמָּקוֹם"}. ${HINTS[q.skill] || ""}`;
    if (st.tries >= 2) { q.items.forEach((it, k) => st.sort[k] = it.a); st.smarks = q.items.map(() => true); st.locked = true; settle(false); }
  }
  draw();
}
function renderWrite(s, q, st, nextBtn) {
  const id = `w-${s.id}-${run.qi}`;
  const checks = writeChecks(q, st.text);
  const done = st.showModel;
  return `<label for="${id}" style="color:var(--ink-soft)">${tx("הַתְּשׁוּבָה הַמְּלֵאָה שֶׁלִּי:")}</label>
    <textarea id="${id}" data-input="write" ${done ? "readonly" : ""} placeholder="${esc(plain("מַתְחִילִים בְּמִלִּים מֵהַשְּׁאֵלָה..."))}">${esc(st.text)}</textarea>
    <ul class="wchecks" id="wchecks">${checksHTML(checks)}</ul>
    ${done ? `<div class="feedback ${st.allOk ? "good" : "info"}"><b>${tx(st.allOk ? "תְּשׁוּבָה מְלֵאָה! כָּל הַכָּבוֹד!" : "כִּמְעַט! כָּךְ אֶפְשָׁר לְשַׁפֵּר:")}</b>
        <div class="model" style="margin-top:6px">${tx(q.model)}</div><div style="margin-top:6px" class="r">${tx(q.why)}</div></div>
        <div class="row">${nextBtn}</div>`
      : `<div class="row"><button class="btn" data-act="writeDone" ${st.text.trim().length < 3 ? "disabled" : ""}>${tx("סִיַּמְתִּי לִכְתֹּב")}</button></div>`}`;
}
function writeDone() {
  const q = ST().questions[run.qi], st = run.q;
  st.allOk = writeChecks(q, st.text).every(c => c.ok);
  st.showModel = true; st.locked = true; st.tries = 1;
  run.open[q.q] = st.text.trim();
  settle(st.allOk); chime(st.allOk);
  draw();
}

/* ---------- welcome: student or teacher ---------- */
function renderWelcome() {
  return `<div class="panel welcome" style="margin-top:12px">
    <div class="brand big">מסע לאי המאה</div>
    <h2>${tx("בָּרוּךְ הַבָּא! מִי אַתֶּם?")}</h2>
    ${Object.keys(loadProfiles()).length ? `<div class="who-plays"><b>${tx("מִי מְשַׂחֵק עַכְשָׁו?")}</b><div class="roles">${Object.entries(loadProfiles()).map(([id, st]) =>
      `<button class="role small" data-login="${esc(id)}"><span class="role-av">${avatarSVG(st.av || {})}</span><b>${esc(st.name || "שַׂחְקָן")}</b><span>${esc(st.klass || "")}</span></button>`).join("")}</div></div>` : ""}
    <div class="roles">
      <button class="role" data-role="student"><span class="role-av">${avatarSVG({ type: "girl", color: "#FFFFFF" })}</span><b>${tx(Object.keys(loadProfiles()).length ? "תַּלְמִיד חָדָשׁ / תַּלְמִידָה חֲדָשָׁה" : "אֲנִי תַּלְמִיד / תַּלְמִידָה")}</b><span>${tx("נִכְנָסִים לַמִּשְׂחָק")}</span></button>
      <button class="role" data-role="teacher"><span class="role-av"><img src="img/ui-chest.webp" alt=""></span><b>מורה</b><span>הגדרת מה לומדים ומתי</span></button>
    </div>
    ${CREDIT()}
  </div>`;
}

/* ---------- teacher area ---------- */
function teacherDraft() { if (!ui.draft) ui.draft = JSON.parse(JSON.stringify(CFG)); return ui.draft; }
async function checkTeacher() {
  if (ui.canEdit !== undefined) return;
  if (ON_SITE) {
    ui.canEdit = null;
    if (!tpass()) { ui.canEdit = false; return draw(); }
    try { await api("login", { method: "POST", teacher: true }); ui.canEdit = true; } catch (e) { ui.canEdit = false; }
    if (view.name === "teacher") draw(); return;
  }
  ui.canEdit = null;
  let ok = false;
  try { const u = await claude.use("user"); ok = u ? await u.canEdit() : false; } catch (e) { ok = false; }
  ui.canEdit = ok; if (view.name === "teacher") draw();
}
function renderTeacher() {
  if (ui.canEdit === undefined) checkTeacher();
  if (ui.canEdit === undefined || ui.canEdit === null) return bar() + `<div class="panel teacher"><h2>אזור המורה</h2><p>בודקים הרשאות...</p></div>`;
  if (!ui.canEdit && ON_SITE) return bar() + `<div class="panel teacher">
      <h2>אזור המורה</h2>
      <form class="tlogin" id="tloginForm">
        <label for="tpass">סיסמת המורה</label>
        <input id="tpass" type="password" autocomplete="current-password" required>
        <button class="btn" type="submit">כניסה</button>
      </form>
      ${ui.loginMsg ? `<p class="feedback try">${esc(ui.loginMsg)}</p>` : ""}
      <div class="row"><button class="btn ghost" data-go="home">חזרה למשחק</button></div>
    </div>`;
  if (!ui.canEdit) return bar() + `<div class="panel teacher">
      <h2>אזור המורה</h2>
      <p>אזור זה פתוח רק למורה שיצרה את המשחק, או למי שקיבלה ממנה הרשאת עריכה. כאן מגדירים מה הכיתה לומדת ומתי, וההגדרות מגיעות לכל התלמידים.</p>
      <p>מורה שרוצה גרסה משלה לכיתה שלה יכולה לבקש מנועה קסטרו עותק של המשחק.</p>
      <div class="row"><button class="btn" data-go="home">חזרה למשחק</button></div>
    </div>`;
  return bar() + `<div class="panel teacher">
    <h2>אזור המורה</h2>
    <p class="how">ההגדרות נשמרות בתוך המשחק עצמו: אחרי "שמירה ופרסום" כל תלמיד שפותח את הקישור מקבל אותן. ההתקדמות של כל ילד נשמרת במכשיר שלו.</p>
    ${classDashboardHTML()}
${'${renderTeacherSettings()}'}
  </div>`;
}
function renderTeacherSettings() {
  const d = teacherDraft();
  const rows = (tr, t) => tr.stations.map((s, i) => {
    const c = d.stations[s.id] || {};
    return `<tr><td class="tn">${i + 1}. ${plain(s.title)}</td>
      <td><label class="sw-t"><input type="checkbox" data-cfgst="${s.id}:open" ${c.open === false ? "" : "checked"}> פתוח</label></td>
      <td><input type="date" data-cfgst="${s.id}:from" value="${esc(c.from || "")}" aria-label="פתיחה מתאריך"></td>
      <td><label class="sw-t"><input type="checkbox" data-cfgst="${s.id}:featured" ${c.featured ? "checked" : ""}> ⭐</label></td></tr>`;
  }).join("");
  return `    <section class="tsec"><h3>פרטי המורה והכיתה</h3>
      <div class="tgrid">
        <label>שם המורה<input id="cfg-teacher" data-cfg="teacher" value="${esc(d.teacher)}" placeholder="נועה קסטרו"></label>
        <label>בית הספר<input id="cfg-school" data-cfg="school" value="${esc(d.school)}"></label>
        <label>כיתות (מופרדות בפסיק)<input id="cfg-classes" data-cfg="classes" value="${esc(Array.isArray(d.classes) ? d.classes.join(", ") : d.classes || "")}" placeholder="ב'1, ב'2"></label>
        <label>תאריך המבדק (יום האוצר)<input id="cfg-test" type="date" data-cfg="testDate" value="${esc(d.testDate || "")}"></label>
      </div></section>
    <section class="tsec"><h3>הודעה לתלמידים</h3>
      <p class="how">מופיעה במסך הבית של כל ילד. אפשר להשאיר ריק.</p>
      <textarea id="cfg-message" data-cfg="message" rows="3" placeholder="למשל: השבוע אנחנו מתרגלים ביצוע הוראות. בהצלחה!">${esc(d.message || "")}</textarea></section>
    <section class="tsec"><h3>מה לומדים ומתי</h3>
      <p class="how"><b>פתוח</b>: התחנה זמינה. <b>תאריך</b>: התחנה נפתחת רק מהיום הזה. <b>⭐</b>: "משימת השבוע", מודגשת במפה ובמסך הבית.</p>
      <label class="sw-t"><input type="checkbox" data-cfg="ordered" ${d.ordered === false ? "" : "checked"}> תחנות נפתחות לפי הסדר (כל תחנה אחרי שסיימו את הקודמת)</label>
      <label class="sw-t"><input type="checkbox" data-cfg="challenge" ${d.challenge === false ? "" : "checked"}> להציג את איי האתגר לילדים מתקדמים</label>
      ${TRACKS.map((tr, t) => `<h4>${plain(tr.name)}</h4><div class="ttable"><table><thead><tr><th>תחנה</th><th>זמינות</th><th>פתיחה מתאריך</th><th>השבוע</th></tr></thead><tbody>${rows(tr, t)}</tbody></table></div>`).join("")}
    </section>
    <div class="row tsave">
      <button class="btn go" data-act="saveCfg" ${ui.saving ? "disabled" : ""}>${ui.saving ? "שומרים..." : ON_SITE ? "שמירה" : "שמירה ופרסום לכל התלמידים"}</button>
      <button class="btn ghost" data-act="resetDraft">ביטול השינויים</button>
      <button class="btn ghost" data-go="home">לצפייה במשחק</button>
      ${ON_SITE ? "" : `<button class="btn ghost" data-act="logout">יציאה מאזור המורה</button>`}
    </div>
    ${ui.saveMsg ? `<p class="feedback ${ui.saveOk ? "good" : "try"}">${esc(ui.saveMsg)}</p>` : ""}`;
}
async function saveConfig() {
  const d = teacherDraft();
  d.classes = (typeof d.classes === "string" ? d.classes.split(",") : d.classes || []).map(x => x.trim()).filter(Boolean);
  ui.saving = true; ui.saveMsg = ""; draw();
  if (ON_SITE) {
    try { TEACHER = (await tapi("teachers/config", { method: "PUT", body: { cfg: d } })).teacher; ui.saveOk = true; ui.saveMsg = "נשמר! התלמידים שבמעקב שלך יקבלו את ההגדרות החדשות."; }
    catch (e) { ui.saveOk = false; ui.saveMsg = e.status === 401 ? "צריך להתחבר מחדש." : "השמירה לא הצליחה. בדקו את החיבור לאינטרנט ונסו שוב."; }
    ui.saving = false; return draw();
  }
  let art = null;
  try { art = await claude.use("artifact"); } catch (e) { art = null; }
  if (!art) { ui.saving = false; ui.saveOk = false; ui.saveMsg = "אין אפשרות לשמור מכאן. פתחו את המשחק דרך הקישור של claude.ai, כשאתן מחוברות לחשבון."; return draw(); }
  try { sessionStorage.setItem("teacher-saved", "1"); } catch (e) {}
  try {
    await art.publish(shellDoc(d));
    ui.saving = false; ui.saveOk = true; ui.saveMsg = "נשמר! כל התלמידים יקבלו את ההגדרות החדשות."; draw();
  } catch (e) {
    ui.saving = false; ui.saveOk = false;
    const code = e && e.code;
    ui.saveMsg = code === "conflict" ? "בינתיים נשמרה גרסה חדשה יותר של המשחק. הדף נטען מחדש. שמרו שוב אחרי הטעינה."
      : code === "not_writer" || code === "not_granted" ? "לחשבון הזה אין הרשאת עריכה, ולכן אי אפשר לשמור."
      : code === "rate_limited" ? "שמרתם הרבה פעמים ברצף. נסו שוב בעוד דקה."
      : "השמירה לא הצליחה. נסו שוב בעוד רגע.";
    draw();
  }
}

/* ---------- class progress: a shared database the teacher reads ----------
   progress/<viewer id>  written automatically by a signed-in student who may write (own record only)
   roster/<key>          written by the teacher from a progress code a parent sends (works without any account) */
function skillStatsFor(st) {
  const out = {};
  Object.keys(SKILLS).forEach(k => out[k] = { right: 0, n: 0 });
  ALL.forEach(s => {
    const r = st[s.id]; if (!r || !r.first) return;
    s.questions.forEach((q, i) => {
      if (q.type === "open") return;
      if (r.first[i] === true || r.first[i] === false) { out[q.skill].n++; if (r.first[i] === true) out[q.skill].right++; }
    });
  });
  return out;
}
// a compact record of this child's progress: per station "stars:answers", answers as 1 (right first time), 0, o (open answer), - (none)
function myRecord() {
  const st = {};
  ALL.forEach(s => {
    const r = S.st[s.id]; if (!r || !r.done) return;
    st[s.id] = (r.stars || 0) + ":" + s.questions.map((q, i) => { const v = r.first && r.first[i]; return v === true ? "1" : v === false ? "0" : v === "open" ? "o" : "-"; }).join("");
  });
  return { v: 1, n: S.name || "", k: S.klass || "", a: S.av.type || "crab", t: Date.now(), d: S.days.length, st, log: (S.log || []).slice(-40) };
}
function recordToSt(rec) {
  const st = {};
  Object.entries(rec.st || {}).forEach(([id, val]) => {
    const [stars, ans = ""] = String(val).split(":");
    st[id] = { done: true, stars: +stars || 0, first: Object.fromEntries([...ans].map((c, i) => [i, c === "1" ? true : c === "0" ? false : c === "o" ? "open" : null])) };
  });
  return st;
}
const b64e = str => btoa(String.fromCharCode(...new TextEncoder().encode(str)));
const b64d = str => new TextDecoder().decode(Uint8Array.from(atob(str), c => c.charCodeAt(0)));
const progressCode = () => "GM1-" + b64e(JSON.stringify(myRecord()));
function parseCode(code) {
  const m = String(code).trim().match(/GM1-([A-Za-z0-9+/=]+)/);
  if (!m) return null;
  try { const r = JSON.parse(b64d(m[1])); return r && r.v === 1 && r.st ? r : null; } catch (e) { return null; }
}
const rosterKey = rec => ("s-" + b64e((rec.k || "") + "|" + (rec.n || "")).replace(/[^A-Za-z0-9]/g, "")).slice(0, 120);

let DB = null, MY_ID = null;
const dbReady = (async () => {
  try {
    const [db, user] = await Promise.all([claude.use("db"), claude.use("user")]);
    if (!db || !user) return;
    MY_ID = await user.id(); DB = db;
  } catch (e) { DB = null; }
})();
// after a station: save this child's own record, if this account may write it
function deviceId() {
  try { let d = localStorage.getItem("gm-device"); if (!d) { d = "d" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem("gm-device", d); } return d; } catch (e) { return ""; }
}
async function syncMyProgress() {
  if (ON_SITE && !S.code) await registerStudent();
  if (ON_SITE && S.code) {
    try { await api("progress", { method: "POST", body: { code: S.code, rec: myRecord(), state: S } }); ui.synced = Date.now(); } catch (e) {}
    return;
  }
  if (ON_SITE) {
    const dev = deviceId(); if (!dev) return;
    const id = (dev + "-" + b64e(profileId(S)).replace(/[^A-Za-z0-9]/g, "")).slice(0, 120);
    try { await api("progress", { method: "POST", body: { id, rec: myRecord() } }); ui.synced = Date.now(); } catch (e) {}
    return;
  }
  await dbReady;
  if (!DB || !MY_ID || ui.syncOff) return;
  try { await DB.doc("progress/" + MY_ID).set(myRecord()); ui.synced = Date.now(); }
  catch (e) { ui.syncOff = true; }
}

/* parents' corner: the code to send to the teacher */
function progressCodeHTML() {
  return `<section>
    <h3>שליחת ההתקדמות למורה</h3>
    <p>${ON_SITE ? "ההתקדמות נשלחת למורה אוטומטית אחרי כל תחנה. אם הילד משחק גם במכשיר אחר, או שאין חיבור לאינטרנט, אפשר להעתיק את הקוד ולשלוח למורה." : "ההתקדמות נשמרת במכשיר הזה. כדי שהמורה תראה אותה, העתיקו את הקוד ושלחו לה (למשל בוואטסאפ). הקוד מתעדכן אחרי כל תחנה, אז אפשר לשלוח שוב בכל פעם."}</p>
    ${S.name ? "" : `<p class="feedback try">כדאי קודם לכתוב את שם הילד (בהגדרת הדמות), כדי שהמורה תדע של מי הקוד.</p>`}
    <textarea id="pcode" class="pcode" readonly rows="3">${esc(progressCode())}</textarea>
    <div class="row"><button class="btn" data-act="copyCode">העתקת הקוד</button>${ui.synced ? `<span class="how">✓ ההתקדמות נשלחה גם אוטומטית לחשבון</span>` : ""}</div>
  </section>`;
}
async function copyCode() {
  const t = $("#pcode"); if (!t) return;
  try { await navigator.clipboard.writeText(t.value); toast("הקוד הועתק. אפשר להדביק ולשלוח למורה."); }
  catch (e) { t.focus(); t.select(); toast("סמנו את הקוד והעתיקו אותו (Ctrl+C או לחיצה ארוכה)."); }
}

/* teacher: live class table */
const CLS = { progress: [], roster: [], students: [], loaded: false, err: "" };
let clsUnsubs = null;
async function watchClass() {
  if (clsUnsubs) return;
  clsUnsubs = [];
  if (ON_SITE) {
    const pull = async () => {
      try { const [d, st] = await Promise.all([api("progress", { teacher: true }), api("students", { teacher: true })]); CLS.students = st.students; CLS.progress = d.progress.map(r => ({ ...r, src: "progress" })); CLS.roster = d.roster.map(r => ({ ...r, src: "roster" })); CLS.err = ""; }
      catch (e) { CLS.err = e.code; }
      CLS.loaded = true; if (view.name === "teacher" && !ui.typing) draw();
    };
    pull(); const h = setInterval(() => { if (view.name === "teacher") pull(); }, 20000);
    clsUnsubs.push(() => clearInterval(h)); return;
  }
  await dbReady;
  if (!DB) { CLS.err = "nodb"; CLS.loaded = true; if (view.name === "teacher") draw(); return; }
  const on = (name) => DB.collection(name).onSnapshot(snap => {
    CLS[name] = snap.docs.filter(d => d.exists).map(d => ({ id: d.id, src: name, ...d.data() }));
    CLS.loaded = true; if (view.name === "teacher" && !ui.typing) draw();
  }, err => { CLS.err = err.code; CLS.loaded = true; if (view.name === "teacher") draw(); });
  clsUnsubs.push(on("progress"), on("roster"));
}
function classRows() {
  // one row per child; a roster code and an automatic record for the same name and class: keep the newer
  const byKey = {}, studs = Object.fromEntries((CLS.students || []).map(x => [x.code, x]));
  (CLS.students || []).forEach(x => { byKey["c:" + x.code] = { ...x, st: {}, empty: true, src: "student" }; });
  [...CLS.roster, ...CLS.progress].forEach(r => {
    if (r.code && studs[r.code]) r = { ...r, n: studs[r.code].n, k: studs[r.code].k };
    const key = r.code ? "c:" + r.code : (r.k || "") + "|" + (r.n || r.id);
    if (byKey[key] && byKey[key].empty) delete byKey[key];
    if (!byKey[key] || (r.t || 0) > (byKey[key].t || 0)) byKey[key] = r;
  });
  return Object.values(byKey).map(r => {
    const st = recordToSt(r), stats = skillStatsFor(st);
    const doneN = Object.keys(st).length, stars = Object.values(st).reduce((n, x) => n + x.stars, 0);
    const pct = k => stats[k] && stats[k].n ? Math.round(100 * stats[k].right / stats[k].n) : null;
    const weak = SKILL_ORDER.filter(k => k !== "opinion" && stats[k] && stats[k].n >= 3).sort((a, b) => pct(a) - pct(b))[0];
    return { r, doneN, stars, pct, weak: weak && pct(weak) < 70 ? weak : null };
  }).sort((a, b) => (a.r.k || "").localeCompare(b.r.k || "", "he") || (a.r.n || "").localeCompare(b.r.n || "", "he"));
}
function pctCell(p) { return p === null ? `<td class="pc na">–</td>` : `<td class="pc ${p >= 80 ? "hi" : p >= 60 ? "mid" : "lo"}">${p}%</td>`; }
function classDashboardHTML() {
  watchClass();
  const rows = classRows(), klass = ui.klassFilter || "";
  const classes = [...new Set(rows.map(x => x.r.k).filter(Boolean))];
  const shown = rows.filter(x => !klass || x.r.k === klass);
  const avg = k => { const v = shown.map(x => x.pct(k)).filter(p => p !== null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const table = shown.length ? `<div class="ttable"><table class="cls">
      <thead><tr><th>תלמיד</th><th>כיתה</th><th>תחנות</th><th>⭐</th>${TABLE_SKILLS.map(k => `<th>${SKILLS[k].name}</th>`).join("")}<th>כדאי לחזק</th><th>עודכן</th><th></th></tr></thead>
      <tbody>${shown.map(x => `<tr><td class="tn">${esc(x.r.n || "ללא שם")}${x.r.code ? ` <span class="kcode">${esc(x.r.code)}</span>` : ""}${x.r.empty ? ` <span class="how">עוד לא שיחק</span>` : x.r.src === "progress" ? ` <span class="src" title="נשלח אוטומטית">●</span>` : ""}</td><td>${esc(x.r.k || "")}</td>
        <td>${x.doneN}/${ALL.length}</td><td title="מתוך ${x.doneN * 3} אפשריים (עד 3 בכל תחנה)">${x.stars}<span class="of">/${x.doneN * 3}</span></td>${TABLE_SKILLS.map(k => pctCell(x.pct(k))).join("")}
        <td>${x.weak ? SKILLS[x.weak].name : "–"}</td><td>${x.r.t ? fmtDate(ymd(new Date(x.r.t))) : ""}</td>
        <td>${x.r.src === "roster" ? `<button class="mini" data-delrow="${esc(x.r.id)}" aria-label="מחיקה">✕</button>` : ""}</td></tr>`).join("")}
      </tbody>
      <tfoot><tr><th colspan="4">ממוצע${klass ? " " + esc(klass) : " הכיתה"}</th>${TABLE_SKILLS.map(k => pctCell(avg(k))).join("")}<th colspan="3"></th></tr></tfoot>
    </table></div>`
    : `<p class="empty-note" style="text-align:start">${CLS.loaded ? "עוד אין תלמידים. הדביקו למטה קוד התקדמות שהורה שלח, והתלמיד יופיע כאן." : "טוענים..."}</p>`;
  return `<section class="tsec cls-sec"><h3>התקדמות הכיתה</h3>
    ${CLS.err === "nodb" ? `<p class="feedback try">מסד הנתונים זמין רק כשהמשחק פתוח דרך claude.ai בחשבון המחובר.</p>` : CLS.err ? `<p class="feedback try">לא הצלחנו לטעון את ההתקדמות. בדקו את החיבור לאינטרנט.</p>` : ""}
    <p class="how">אחוז התשובות הנכונות בניסיון הראשון, לפי מיומנות. ירוק 80% ומעלה, צהוב 60% עד 79%, אדום מתחת ל־60%.</p>
    ${classes.length > 1 ? `<div class="row">${["", ...classes].map(c => `<button class="chip klass ${klass === c ? "on" : ""}" data-kf="${esc(c)}">${c ? esc(c) : "כל הכיתות"}</button>`).join("")}</div>` : ""}
    ${table}
    <div class="paste">
      <label for="codeIn"><b>הוספה או עדכון של תלמיד מקוד:</b> ההורה מעתיק את הקוד מ"פינת ההורים" ושולח לך. אפשר להדביק כמה קודים יחד.</label>
      <textarea id="codeIn" rows="3" placeholder="GM1-..."></textarea>
      <div class="row"><button class="btn" data-act="addCodes">הוספה לטבלה</button>${ui.codeMsg ? `<span class="how">${esc(ui.codeMsg)}</span>` : ""}</div>
    </div>
  </section>`;
}
async function addCodes() {
  const t = $("#codeIn"); if (!t) return;
  const recs = (t.value.match(/GM1-[A-Za-z0-9+/=]+/g) || []).map(parseCode).filter(Boolean);
  if (!recs.length) { ui.codeMsg = "לא נמצא קוד תקין. בדקו שהעתקתם את כל הקוד, מ־GM1 ועד הסוף."; return draw(); }
  if (ON_SITE) {
    try { const r = await api("roster", { method: "POST", teacher: true, body: { items: recs.map(rec => ({ key: rosterKey(rec), rec })) } }); ui.codeMsg = r.saved === 1 ? `נוסף: ${recs[0].n || "תלמיד"}` : `נוספו ${r.saved} תלמידים`; t.value = ""; clsUnsubs && clsUnsubs.forEach(f => f()); clsUnsubs = null; }
    catch (e) { ui.codeMsg = "השמירה לא הצליחה. נסו שוב."; }
    return draw();
  }
  await dbReady;
  if (!DB) { ui.codeMsg = "אין חיבור למסד הנתונים. פתחו את המשחק דרך claude.ai."; return draw(); }
  let ok = 0;
  for (const r of recs) { try { await DB.doc("roster/" + rosterKey(r)).set(r); ok++; } catch (e) { ui.codeMsg = e && e.code === "quota_exceeded" ? "מסד הנתונים מלא." : "השמירה לא הצליחה. נסו שוב."; } }
  if (ok) { ui.codeMsg = ok === 1 ? `נוסף: ${recs[0].n || "תלמיד"}` : `נוספו ${ok} תלמידים`; t.value = ""; }
  draw();
}
async function delRow(id) {
  if (ui.confirmDel !== id) { ui.confirmDel = id; toast("לחצו שוב על ✕ כדי למחוק את התלמיד מהטבלה"); return; }
  ui.confirmDel = null;
  if (ON_SITE) {
    try { await api("roster?id=" + encodeURIComponent(id), { method: "DELETE", teacher: true }); CLS.roster = CLS.roster.filter(r => r.id !== id); draw(); } catch (e) { toast("המחיקה לא הצליחה"); }
    return;
  }
  try { await DB.doc("roster/" + id).delete(); } catch (e) { toast("המחיקה לא הצליחה"); }
}


/* ---------- state (kept in this browser only) ---------- */
const KEY = "island100-journey-v1";
const blank = () => ({ name: "", nikud: true, size: 1, sound: true, unlockAll: false, track: 0, st: {},
  av: { type: "crab", color: "#FFFFFF", chosen: false }, owned: [], coins: 0, days: [], photos: [], testDate: "" });
let S = blank();
try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(blank(), JSON.parse(raw)); } catch (e) {}
function save() { S.saved = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
// several children can share one device: logging out parks the current child's progress, the welcome screen lists them
const PKEY = "island100-profiles";
function loadProfiles() { try { return JSON.parse(localStorage.getItem(PKEY) || "{}") || {}; } catch (e) { return {}; } }
function saveProfiles(p) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) {} }
const profileId = st => (st.klass || "") + "|" + (st.name || "");
function logout() {
  const prefs = { nikud: S.nikud, size: S.size, sound: S.sound };
  if (S.av.chosen && (S.name || Object.keys(S.st).length)) { const p = loadProfiles(); p[profileId(S)] = S; saveProfiles(p); }
  S = Object.assign(blank(), prefs); save();
  try { sessionStorage.removeItem(TPASS); } catch (e) {}
  if (clsUnsubs) { clsUnsubs.forEach(f => f()); clsUnsubs = null; }
  ui.settings = false; ui.canEdit = undefined; run = null; view = { name: "welcome" }; draw(); scrollTop();
}
function login(id) {
  const p = loadProfiles(), st = p[id]; if (!st) return;
  delete p[id]; saveProfiles(p);
  S = Object.assign(blank(), st); save(); view = { name: "home" }; ui.scrollMe = true; draw(); toast(`שָׁלוֹם ${S.name || ""}!`);
}

let view = { name: "home" };   // home | intro | play | summary | parents
let run = null;                // current station run: { t, i, qi, res, ans, open, q, coins }
let ui = { settings: false, shopCat: "char", fly: null, scrollMe: true, pendingCoins: 0 };
const ST = () => run.s || TRACKS[run.t].stations[run.i];

/* ---------- helpers ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const MARKS = /[֑-ׇֽֿׁׂׅׄ]/g;
const plain = s => String(s).replace(MARKS, "");
const tx = s => esc(S.nikud && !ui.plain ? s : plain(s));
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const LETTERS = ["א", "ב", "ג", "ד"];
const starsFor = r => r >= .9 ? 3 : r >= .6 ? 2 : 1;
const done = s => !!(S.st[s.id] && S.st[s.id].done);
const unlocked = (t, i) => {
  const ss = TRACKS[t].stations;
  if (stationClosed(ss[i])) return false;
  if (S.unlockAll || CFG.ordered === false) return true;
  for (let j = i - 1; j >= 0; j--) if (!stationClosed(ss[j])) return done(ss[j]);
  return true;
};
const totalStars = () => ALL.reduce((n, s) => n + ((S.st[s.id] && S.st[s.id].stars) || 0), 0);
const isTask = q => ["mark", "build", "fill", "punct", ...MATH_TYPES].includes(q.type) || !!q.board || !!q.pic;
const isChoice = q => q.type === "mc" || q.type === "fill" || q.type === "pack";
const pick = a => a[Math.floor(Math.random() * a.length)];
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2600); }

const SPEAK = `<img src="img/ui-speaker.webp" alt="">`;

/* speech + sound, both only after a tap */
let actx = null;
function speak(text) {
  if (!("speechSynthesis" in window)) { toast("אין הקראה במכשיר הזה"); return; }
  const voices = speechSynthesis.getVoices();
  const he = voices.find(v => /^he|^iw/i.test(v.lang));
  if (voices.length && !he) { toast("אין קול בעברית במכשיר הזה"); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = "he-IL"; u.rate = .85; if (he) u.voice = he;
  speechSynthesis.speak(u);
}

/* ---------- the child's character ---------- */
const SUITS = ["#FFFFFF", "#FF6B6B", "#FFA928", "#FFD43B", "#2FCB8A", "#4D8CFF", "#A66BFF", "#FF6FC8"];
// the child's character: a drawing img/char-<id>.webp (and, for a shirt colour, a mask of the white clothes img/mask-<id>.webp).
// Only characters whose drawing is in AV_ART are offered, so a new character is added by listing its file here.
const CHAR_LIST = [
  { id: "pirateboy", name: "פִּירָאט" },
  { id: "pirategirl", name: "פִּירָאטִית" },
  { id: "crab", name: "סַרְטָן" },
  { id: "dolphin", name: "דּוֹלְפִין" },
  { id: "firefly", name: "גַּחְלִילִית" },
  { id: "monkey", name: "קוֹף" },
  { id: "turtle", name: "צָב" },
  { id: "tiger", name: "נָמֵר" },
  { id: "octopus", name: "תְּמָנוּן" },
];
const AV_ART = { crab: "img/char-crab.webp", dolphin: "img/char-dolphin.webp", firefly: "img/char-firefly.webp" };
const AV_MASK = {};
const CHARS = CHAR_LIST.filter(c => AV_ART[c.id]);
const SLOTS = [
  { id: "hat", name: "עַל הָרֹאשׁ" },
  { id: "face", name: "עַל הַפָּנִים" },
  { id: "hand", name: "בַּיָּד" },
  { id: "pet", name: "חַיַּת מַחְמָד" },
  { id: "back", name: "עַל הַגַּב" },
];
const SHOP = [
  { slot: "hat", id: "flower", name: "פֶּרַח", price: 10, fit: [2, .62] },
  { slot: "hat", id: "bandana", name: "בַּנְדָנָה", price: 15, fit: [4, .95] },
  { slot: "hat", id: "cap", name: "כּוֹבַע", price: 15 },
  { slot: "hat", id: "bow", name: "סֶרֶט", price: 15 },
  { slot: "hat", id: "partyhat", file: "party", name: "כּוֹבַע מְסִבָּה", price: 20, fit: [-5, .7] },
  { slot: "hat", id: "catears", name: "אָזְנֵי חָתוּל", price: 20, fit: [4, 1.1] },
  { slot: "hat", id: "bunnyears", name: "אָזְנֵי אַרְנָב", price: 25, fit: [-3, 1] },
  { slot: "hat", id: "flowercrown", name: "זֵר פְּרָחִים", price: 25, fit: [5, 1.15] },
  { slot: "hat", id: "tophat", name: "מִגְבַּעַת", price: 25 },
  { slot: "hat", id: "chef", name: "כּוֹבַע שֶׁף", price: 25, fit: [-3, .9] },
  { slot: "hat", id: "captain", name: "כּוֹבַע קַפְּטֶן", price: 30, fit: [3, 1.15] },
  { slot: "hat", id: "cowboy", name: "כּוֹבַע בּוֹקֵרִים", price: 30, fit: [1, 1.25] },
  { slot: "hat", id: "headphones", name: "אוֹזְנִיּוֹת", price: 30, fit: [22, 1.7] },
  { slot: "hat", id: "grad", name: "כּוֹבַע חָכָם", price: 30 },
  { slot: "hat", id: "pirate", name: "כּוֹבַע פִּירָאטִים", price: 35, fit: [2, 1.25] },
  { slot: "hat", id: "tiara", name: "נֵזֶר", price: 40, fit: [3, .85] },
  { slot: "hat", id: "crown", name: "כֶּתֶר", price: 45, fit: [2, .85] },
  { slot: "face", id: "glasses", name: "מִשְׁקָפַיִם", price: 15 },
  { slot: "face", id: "eyepatch", name: "רְטִיַּת פִּירָאט", price: 20, fit: [3, 1.05] },
  { slot: "face", id: "shades", name: "מִשְׁקְפֵי שֶׁמֶשׁ", price: 25 },
  { slot: "face", id: "sunnies", name: "מִשְׁקָפַיִם עֲגֻלִּים", price: 25 },
  { slot: "hand", id: "balloon", name: "בָּלוֹן", price: 15 },
  { slot: "hand", id: "wand", name: "שַׁרְבִיט קֶסֶם", price: 30 },
  { slot: "pet", id: "fish", name: "דַּג זָהָב", price: 15 },
  { slot: "pet", id: "seagull", name: "שַׁחַף", price: 20 },
  { slot: "pet", id: "turtle", name: "צָב", price: 25 },
  { slot: "pet", id: "bunny", name: "אַרְנָב", price: 25 },
  { slot: "pet", id: "dog", name: "כֶּלֶב", price: 30 },
  { slot: "pet", id: "kitten", name: "חָתוּל", price: 30 },
  { slot: "pet", id: "penguin", name: "פִּינְגְּוִין", price: 30 },
  { slot: "pet", id: "fox", name: "שׁוּעָל", price: 30 },
  { slot: "pet", id: "flamingo", name: "פְלָמִינְגוֹ", price: 35 },
  { slot: "pet", id: "octopus", name: "תְּמָנוּן", price: 35 },
  { slot: "pet", id: "panda", name: "פַּנְדָּה", price: 35 },
  { slot: "pet", id: "owl", name: "יַנְשׁוּף", price: 35 },
  { slot: "pet", id: "dolphin", name: "דּוֹלְפִין", price: 40 },
  { slot: "pet", id: "dino", name: "דִּינוֹזָאוּר", price: 40 },
  { slot: "pet", id: "unicorn", name: "חַד־קֶרֶן", price: 50 },
  { slot: "pet", id: "dragon", name: "דְּרָקוֹן", price: 50 },
  { slot: "back", id: "cape", name: "גְּלִימַת גִּבּוֹר", price: 35, fit: [8, 1] },
  { slot: "back", id: "rainbowcape", name: "גְּלִימַת קֶשֶׁת", price: 40, fit: [8, 1] },
  { slot: "back", id: "butterfly", name: "כַּנְפֵי פַּרְפַּר", price: 45, fit: [-4, 1.25] },
  { slot: "back", id: "angel", name: "כַּנְפֵי מַלְאָךְ", price: 50, fit: [-6, 1.3] },
  { slot: "back", id: "dragonwings", name: "כַּנְפֵי דְּרָקוֹן", price: 55, fit: [-8, 1.3] },
].map(it => ({ ...it, img: `img/${it.slot === "pet" ? "pet" : it.slot === "back" ? "back" : "acc"}-${it.file || it.id}.webp` }));
// a sticker for every island: its picture, with an emoji as the fallback
const STICKERS = { t1: "🥥", t2: "✨", t3: "🚂", t4: "🦀", t5: "🍾", t6: "🏆", r1: "🌋", r2: "🐍", r3: "🦜", r4: "⚓", r5: "📜", r6: "🥇", c1: "📦", c2: "🧩", c3: "💯", c4: "👑" };
const STICKER_SRC = { t1: "crate-full", t2: "firefly", t3: "locomotive", t4: "crab", t5: "bottle", t6: "chest", r1: "stone", r3: "parrot", r4: "wagon", r5: "scroll", r6: "ui-coin", c1: "coconut", c2: "jar", c3: "crate", c4: "chest-open" };
const PLANETS = [["#FF8A65", "#C2361A"], ["#FFD54F", "#E07B00"], ["#4DD0E1", "#00727F"], ["#C77DFF", "#6A1B9A"],
  ["#7EDC8A", "#1E7A36"], ["#FF8FC0", "#B0175C"], ["#8FC3FF", "#1B54B8"], ["#FFC15E", "#B85A00"]];
const COIN_RIGHT = 3, COIN_STAR = 5;

// where each accessory sits on each character: [centre x %, centre y %, width %]; ratio = the drawing's width / height
const ANCHORS = {
  crab: { ratio: 1.144, hat: [50, 21, 36], face: [50, 37, 40], hand: [87, 24, 22], pet: [10, 90, 30], back: [50, 58, 84] },
  dolphin: { ratio: .765, hat: [47, 6, 46], face: [47, 25, 42], hand: [88, 44, 22], pet: [10, 92, 34], back: [50, 50, 86] },
  firefly: { ratio: .897, hat: [58, 23, 34], face: [58, 41, 34], hand: [88, 64, 22], pet: [12, 90, 32], back: [40, 40, 80] },
  pirateboy: { ratio: 1, hat: [50, 5, 42], face: [50, 26, 30], hand: [86, 58, 20], pet: [13, 88, 30], back: [50, 52, 80] },
  pirategirl: { ratio: 1, hat: [50, 5, 42], face: [50, 26, 30], hand: [86, 58, 20], pet: [13, 88, 30], back: [50, 52, 80] },
};
function baseSVG(type, c) {
  const ink = 'stroke="#1B2147" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  const body = `
    <rect x="40" y="112" width="16" height="26" rx="7" fill="${c}" ${ink}/><rect x="64" y="112" width="16" height="26" rx="7" fill="${c}" ${ink}/>
    <rect x="37" y="132" width="21" height="11" rx="5.5" fill="#1B2147"/><rect x="62" y="132" width="21" height="11" rx="5.5" fill="#1B2147"/>
    <rect x="20" y="78" width="16" height="34" rx="8" fill="${c}" ${ink} transform="rotate(16 28 82)"/><rect x="84" y="78" width="16" height="34" rx="8" fill="${c}" ${ink} transform="rotate(-16 92 82)"/>
    <rect x="31" y="70" width="58" height="50" rx="19" fill="${c}" ${ink}/>
    <rect x="46" y="82" width="28" height="16" rx="5" fill="#FFFFFF" stroke="#1B2147" stroke-width="2"/>
    <circle cx="53" cy="90" r="2.7" fill="#FF5A5A"/><circle cx="60" cy="90" r="2.7" fill="#FFC531"/><circle cx="67" cy="90" r="2.7" fill="#2FCB8A"/>`;
  let head = "";
  if (type === "astro") head = `<path d="M60 14V5" ${ink}/><circle cx="60" cy="4" r="4.5" fill="#FFC531" stroke="#1B2147" stroke-width="2"/>
    <circle cx="60" cy="44" r="32" fill="#F4F6FF" ${ink}/>
    <rect x="33" y="27" width="54" height="36" rx="18" fill="#28337E" stroke="#1B2147" stroke-width="2.5"/>
    <ellipse cx="50" cy="44" rx="5.5" ry="6.5" fill="#FFFFFF"/><ellipse cx="70" cy="44" rx="5.5" ry="6.5" fill="#FFFFFF"/>
    <circle cx="51" cy="45.5" r="3" fill="#1B2147"/><circle cx="71" cy="45.5" r="3" fill="#1B2147"/>
    <path d="M53 54 Q60 59 67 54" stroke="#FFFFFF" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <circle cx="42" cy="53" r="3" fill="#FF8FB1" opacity=".8"/><circle cx="78" cy="53" r="3" fill="#FF8FB1" opacity=".8"/>
    <path d="M39 34 Q43 30 49 30" stroke="#FFFFFF" stroke-width="3" opacity=".55" fill="none" stroke-linecap="round"/>`;
  if (type === "robot") head = `<path d="M60 14V5" ${ink}/><circle cx="60" cy="4" r="4.5" fill="#FF5A5A" stroke="#1B2147" stroke-width="2"/>
    <rect x="20" y="34" width="10" height="18" rx="4" fill="#AEB8D6" stroke="#1B2147" stroke-width="2.5"/><rect x="90" y="34" width="10" height="18" rx="4" fill="#AEB8D6" stroke="#1B2147" stroke-width="2.5"/>
    <rect x="27" y="13" width="66" height="58" rx="15" fill="#DCE3F5" ${ink}/>
    <rect x="36" y="23" width="48" height="36" rx="10" fill="#1E2A5A"/>
    <circle cx="50" cy="40" r="6.5" fill="#5CE1FF"/><circle cx="70" cy="40" r="6.5" fill="#5CE1FF"/>
    <circle cx="52" cy="38" r="2" fill="#FFFFFF"/><circle cx="72" cy="38" r="2" fill="#FFFFFF"/>
    <path d="M51 51 Q60 56 69 51" stroke="#5CE1FF" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  if (type === "alien") head = `<path d="M47 18 L39 4 M73 18 L81 4" ${ink}/><circle cx="39" cy="4" r="4.5" fill="#FF6FC8" stroke="#1B2147" stroke-width="2"/><circle cx="81" cy="4" r="4.5" fill="#FF6FC8" stroke="#1B2147" stroke-width="2"/>
    <ellipse cx="60" cy="42" rx="35" ry="30" fill="#7BE07B" ${ink}/>
    <circle cx="45" cy="40" r="7" fill="#FFFFFF" stroke="#1B2147" stroke-width="2"/><circle cx="60" cy="31" r="7" fill="#FFFFFF" stroke="#1B2147" stroke-width="2"/><circle cx="75" cy="40" r="7" fill="#FFFFFF" stroke="#1B2147" stroke-width="2"/>
    <circle cx="46" cy="41" r="3.4" fill="#1B2147"/><circle cx="61" cy="32" r="3.4" fill="#1B2147"/><circle cx="76" cy="41" r="3.4" fill="#1B2147"/>
    <path d="M49 54 Q60 62 71 54" ${ink} fill="none"/>`;
  if (type === "cat") head = `<path d="M33 30 L37 8 L53 20 Z" fill="#F6A85B" ${ink}/><path d="M87 30 L83 8 L67 20 Z" fill="#F6A85B" ${ink}/>
    <path d="M38 24 L39 14 L47 20 Z" fill="#FF9EB5"/><path d="M82 24 L81 14 L73 20 Z" fill="#FF9EB5"/>
    <circle cx="60" cy="44" r="28" fill="#F6A85B" ${ink}/>
    <ellipse cx="50" cy="42" rx="4" ry="5.5" fill="#1B2147"/><ellipse cx="70" cy="42" rx="4" ry="5.5" fill="#1B2147"/>
    <circle cx="51.5" cy="40" r="1.5" fill="#FFFFFF"/><circle cx="71.5" cy="40" r="1.5" fill="#FFFFFF"/>
    <path d="M57 50 L63 50 L60 54 Z" fill="#FF7A9A"/><path d="M60 54 Q56 59 52 56 M60 54 Q64 59 68 56" stroke="#1B2147" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M44 52 L30 50 M44 55 L31 57 M76 52 L90 50 M76 55 L89 57" stroke="#1B2147" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="60" cy="40" r="38" fill="#BDE7FF" fill-opacity=".18" stroke="#BDE7FF" stroke-width="3"/>
    <path d="M34 26 Q40 14 54 10" stroke="#FFFFFF" stroke-width="3" opacity=".6" fill="none" stroke-linecap="round"/>`;
  return `<svg class="av-base" viewBox="-14 -18 148 170">${body}${head}</svg>`;
}
function avatarSVG(av = S.av, cls = "") {
  const type = ANCHORS[av.type] && AV_ART[av.type] ? av.type : (CHARS[0] || { id: "crab" }).id, A = ANCHORS[type], c = av.color || SUITS[3];
  const tint = AV_MASK[type] && c.toUpperCase() !== "#FFFFFF" ? `<span class="av-tint" style="background:${c};-webkit-mask-image:url(${AV_MASK[type]});mask-image:url(${AV_MASK[type]})"></span>` : "";
  const base = AV_ART[type] ? `<img class="av-base" src="${AV_ART[type]}" alt="">${tint}` : baseSVG(type, c === "#FFFFFF" ? "#E8ECF8" : c);
  const acc = slot => { const it = SHOP.find(x => x.id === av[slot]); if (!it) return ""; const [x, y, w] = A[slot], [dy, k] = it.fit || [0, 1];
    return `<img class="av-acc av-${slot}" src="${it.img}" alt="" style="left:${x}%;top:${y + dy}%;width:${w * k}%">`; };
  return `<div class="avatar ${cls}" style="aspect-ratio:${A.ratio};--halo:${c}" aria-hidden="true"><span class="av-halo"></span>${acc("back")}${base}${acc("pet")}${acc("hat")}${acc("face")}${acc("hand")}</div>`;
}

/* ---------- dates: countdown to the assessment ("launch day") ---------- */
const pad2 = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = String(s || "").split("-").map(Number); return y ? new Date(y, m - 1, d) : null; };
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const testDateNow = () => CFG.testDate || S.testDate;
function daysLeft() { const t = parseYmd(testDateNow()); return t ? Math.round((t - today0()) / 864e5) : null; }
function countdownHTML() {
  const left = daysLeft();
  if (left === null || left < 0) return "";
  const msg = left === 0 ? "הַיּוֹם יוֹם הָאוֹצָר! בְּהַצְלָחָה בַּמִּבְדָּק!" : left === 1 ? "מָחָר יוֹם הָאוֹצָר!" : `עוֹד ${left} יָמִים לְיוֹם הָאוֹצָר`;
  const test = parseYmd(testDateNow()), start = today0();
  start.setDate(start.getDate() - Math.min(4, Math.max(0, 13 - left)));
  const cells = [];
  for (const d = new Date(start); d <= test && cells.length < 14; d.setDate(d.getDate() + 1)) {
    const k = ymd(d), isTest = k === testDateNow(), did = S.days.includes(k), isToday = k === ymd(today0());
    cells.push(`<span class="day${did ? " did" : ""}${isToday ? " today" : ""}${isTest ? " launch" : ""}" title="${d.getDate()}/${d.getMonth() + 1}">${isTest ? "💎" : did ? "⭐" : d.getDate()}</span>`);
  }
  return `<div class="countdown"><div class="cd-num">${left}</div><div class="cd-txt"><b>${tx(msg)}</b>
    <span class="cd-sub">${tx("יוֹם הָאוֹצָר הוּא יוֹם הַמִּבְדָּק. כָּל יוֹם שֶׁל אִמּוּן מְקַבֵּל כּוֹכָב.")}</span><div class="days">${cells.join("")}</div></div></div>`;
}

/* ---------- effects: sparks, flying coins, confetti, sounds ---------- */
const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let lastRect = null, fxQueue = [];
function fxLayer() { let l = $("#fx"); if (!l) { l = document.createElement("div"); l.id = "fx"; document.body.appendChild(l); } return l; }
function sparks(rect, n = 12) {
  if (!rect || reduced()) return;
  const L = fxLayer(), cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span"); s.className = "spark";
    s.textContent = pick(["★", "✦", "✧", "●"]); s.style.color = pick(["#FFC531", "#FF6FC8", "#5CE1FF", "#7BE07B", "#A66BFF"]);
    s.style.left = cx + "px"; s.style.top = cy + "px"; L.appendChild(s);
    const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 70;
    s.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.3)`, opacity: 0 }],
      { duration: 650 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.3,1)" }).onfinish = () => s.remove();
  }
}
function flyCoins(rect, amount) {
  const tgt = $("#coinChip");
  if (!rect || !tgt || reduced()) { if (tgt) tgt.classList.add("bump"); return; }
  const L = fxLayer(), tr = tgt.getBoundingClientRect();
  const n = Math.min(amount, 5);
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span"); s.className = "spark coin"; s.innerHTML = `<img src="img/ui-coin.webp" alt="">`;
    s.style.left = rect.left + rect.width / 2 + "px"; s.style.top = rect.top + rect.height / 2 + "px"; L.appendChild(s);
    const dx = tr.left + tr.width / 2 - (rect.left + rect.width / 2), dy = tr.top + tr.height / 2 - (rect.top + rect.height / 2);
    s.animate([{ transform: "translate(-50%,-50%) scale(.6)", opacity: 0 }, { transform: `translate(calc(-50% + ${(Math.random() - .5) * 60}px), calc(-50% - 50px)) scale(1.1)`, opacity: 1, offset: .3 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: 1 }],
      { duration: 900, delay: i * 90, easing: "cubic-bezier(.5,0,.4,1)", fill: "backwards" }).onfinish = () => { s.remove(); tgt.classList.remove("bump"); void tgt.offsetWidth; tgt.classList.add("bump"); };
  }
  setTimeout(() => sfx("coin"), 800);
}
function confetti() {
  if (reduced()) return;
  const L = fxLayer(), cv = document.createElement("canvas"); L.appendChild(cv);
  const W = cv.width = innerWidth, H = cv.height = innerHeight, ctx = cv.getContext("2d");
  const cols = ["#FFC531", "#FF6FC8", "#5CE1FF", "#7BE07B", "#A66BFF", "#FF6B6B"];
  const P = Array.from({ length: 140 }, () => ({ x: W / 2 + (Math.random() - .5) * 120, y: H * .35, vx: (Math.random() - .5) * 14, vy: -6 - Math.random() * 10,
    r: 4 + Math.random() * 6, c: pick(cols), a: Math.random() * 6, va: (Math.random() - .5) * .4, star: Math.random() < .3 }));
  const t0 = performance.now();
  (function step(t) {
    ctx.clearRect(0, 0, W, H);
    P.forEach(p => { p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
      if (p.star) { ctx.font = `${p.r * 3}px sans-serif`; ctx.fillText("★", -p.r, p.r); } else ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      ctx.restore(); });
    if (t - t0 < 2600) requestAnimationFrame(step); else cv.remove();
  })(t0);
}
function tone(f, t0, dur, type = "sine", vol = .16) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); o.connect(g); g.connect(actx.destination);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + .015); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.start(t0); o.stop(t0 + dur + .02);
}
function sfx(name) {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime;
    if (name === "win") [784, 988, 1175, 1568].forEach((f, i) => { tone(f, t + i * .07, .28, "triangle", .14); tone(f * 2, t + i * .07, .12, "sine", .04); });
    if (name === "oops") { tone(330, t, .18, "sine", .12); tone(262, t + .14, .26, "sine", .12); }
    if (name === "coin") { tone(988, t, .08, "square", .05); tone(1319, t + .08, .25, "square", .05); }
    if (name === "tap") tone(660, t, .06, "sine", .06);
    if (name === "snap") { tone(1800, t, .03, "square", .05); tone(900, t + .05, .05, "square", .04); }
    if (name === "page") {
      const len = actx.sampleRate * .35, buf = actx.createBuffer(1, len, actx.sampleRate), data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len) * .6;
      const src = actx.createBufferSource(), flt = actx.createBiquadFilter(), g = actx.createGain();
      src.buffer = buf; flt.type = "highpass"; flt.frequency.value = 1200; g.gain.value = .25;
      src.connect(flt); flt.connect(g); g.connect(actx.destination); src.start(t);
    }
    if (name === "fanfare") [[523, 0], [659, .12], [784, .24], [1047, .4], [784, .58], [1047, .7]].forEach(([f, d]) => { tone(f, t + d, .35, "triangle", .15); tone(f / 2, t + d, .35, "sine", .06); });
    if (name === "whoosh") {
      const len = actx.sampleRate * 1.2, buf = actx.createBuffer(1, len, actx.sampleRate), data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = actx.createBufferSource(), flt = actx.createBiquadFilter(), g = actx.createGain();
      src.buffer = buf; flt.type = "bandpass"; flt.frequency.setValueAtTime(300, t); flt.frequency.exponentialRampToValueAtTime(2400, t + 1.1);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.25, t + .2); g.gain.exponentialRampToValueAtTime(.0001, t + 1.2);
      src.connect(flt); flt.connect(g); g.connect(actx.destination); src.start(t);
    }
  } catch (e) {}
}
function chime(good) { sfx(good ? "win" : "oops"); fxQueue.push({ k: good ? "win" : "oops", coins: good ? ui.pendingCoins : 0 }); ui.pendingCoins = 0; }
function runFx() {
  const q = fxQueue; fxQueue = [];
  q.forEach(f => {
    if (f.k === "win") { sparks(lastRect, 14); if (f.coins) flyCoins(lastRect, f.coins); }
    if (f.k === "oops") { const c = $(".qcard"); if (c && !reduced()) { c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); } }
    if (f.k === "party") { confetti(); sfx("fanfare"); }
  });
}
function makeSky() {
  const space = document.createElement("div"); space.id = "space";
  space.innerHTML = `<div class="par"><div class="bg"></div><div class="bg2"></div><i class="cloud"></i><i class="cloud c2"></i></div><div class="floaters">
    <img class="fl swim" src="img/pet-fish.webp" alt="" style="width:44px;top:34%;left:0;--dur:70s;--delay:-20s">
    <img class="fl swim" src="img/pet-turtle.webp" alt="" style="width:52px;top:70%;left:0;--dur:115s;--delay:-64s"></div>`;
  document.body.prepend(space);
  // sun glints on the water
  const sky = document.createElement("div"); sky.id = "sky";
  for (let i = 0; i < 26; i++) {
    const s = document.createElement("i"); if (Math.random() < .3) s.className = "big";
    s.style.left = Math.random() * 100 + "%"; s.style.top = Math.random() * 100 + "%";
    s.style.animationDelay = (Math.random() * 4).toFixed(2) + "s"; s.style.animationDuration = (2.6 + Math.random() * 3).toFixed(2) + "s";
    sky.appendChild(s);
  }
  document.body.prepend(sky);
  if (reduced()) return;
  // depth: the water moves slower than the page, the swimmers a bit faster
  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { const y = scrollY; space.style.setProperty("--py", (-y * .04).toFixed(1) + "px"); space.style.setProperty("--py2", (-y * .12).toFixed(1) + "px"); ticking = false; });
  }, { passive: true });
  addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    space.style.setProperty("--mx", (e.clientX / innerWidth - .5).toFixed(3)); space.style.setProperty("--my", (e.clientY / innerHeight - .5).toFixed(3));
  }, { passive: true });
}

/* ---------- galaxy map ---------- */
const planetArt = (t, i, s) => `img/${s.art || "island-treasure"}.webp`;
const planetPos = i => ({ x: 50 + 24 * Math.sin(i * 1.35 + .5), y: 100 + i * 180 });
function galaxyHTML(t) {
  const T = TRACKS[t], n = T.stations.length, H = 100 + (n - 1) * 180 + 150;
  const nextIdx = T.stations.findIndex((s, i) => unlocked(t, i) && !done(s));
  const pts = T.stations.map((_, i) => planetPos(i));
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < n; i++) d += ` C${pts[i - 1].x} ${pts[i - 1].y + 75} ${pts[i].x} ${pts[i].y - 75} ${pts[i].x} ${pts[i].y}`;
  const planets = T.stations.map((s, i) => {
    const r = S.st[s.id] || {}, open = unlocked(t, i), stars = r.stars || 0, p = pts[i];
    const art = planetArt(t, i, s);
    const cls = ["planet", r.done ? "done" : "", i === nextIdx ? "next" : "", open ? "" : "locked", s.test ? "test" : "", featured(s) ? "featured" : ""].join(" ");
    const note = stationClosed(s) ? `<span class="closed-note">${stCfg(s).open === false ? tx("סָגוּר כָּרֶגַע") : tx("נִפְתָּח בְּ־") + fmtDate(opensOn(s))}</span>` : featured(s) ? `<span class="feat">⭐ ${tx("מְשִׂימַת הַשָּׁבוּעַ")}</span>` : "";
    return `<button class="${cls}" style="left:${p.x}%;top:${p.y}px" data-station="${i}" ${open ? "" : 'aria-disabled="true"'} aria-label="${esc(plain(s.title))}">
      <span class="orb"><img class="pimg" src="${art}" alt="">${r.done ? `<img class="flag" src="img/ui-flag.webp" alt="">` : ""}${s.test && open ? "" : `<span class="pn">${open ? i + 1 : `<img src="img/ui-lock.webp" alt="נעול">`}</span>`}</span>
      <span class="plabel"><b>${tx(s.title)}</b>${note}<span class="pstars">${[1, 2, 3].map(k => `<span class="${k <= stars ? "on" : ""}">★</span>`).join("")}</span></span>
    </button>`;
  }).join("");
  const at = nextIdx === -1 ? n - 1 : nextIdx;
  const fly = ui.fly && ui.fly.t === t ? ui.fly : null;
  const from = planetPos(fly ? fly.from : at), dest = planetPos(at);
  const side = p => p.x > 50 ? p.x - 24 : p.x + 24;
  return `<div class="galaxy" style="height:${H}px">
    <svg class="route" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
    ${planets}
    <div class="map-me" id="mapMe" style="left:${side(from)}%;top:${from.y}px" data-to-left="${side(dest)}" data-to-top="${dest.y}">${avatarSVG(S.av, "float")}</div>
  </div>`;
}

/* ---------- top bar ---------- */
function bar() {
  const home = view.name === "home";
  return `<div class="bar">
    <button class="brand" data-go="home" aria-label="מסע לאי המאה: למפה">מסע לאי המאה</button>
    <span class="chip hud" title="כוכבים"><img class="ic" src="img/ui-star.webp" alt="">${totalStars()}</span>
    <span class="chip hud" id="coinChip" title="מטבעות"><img class="ic" src="img/ui-coin.webp" alt="">${S.coins}</span>
    ${home ? `<button class="chip" data-go="album"><img class="ic" src="img/ui-chest.webp" alt="">${tx("אַלְבּוֹם")}</button><button class="chip" data-go="shop"><img class="ic" src="img/ui-gift.webp" alt="">${tx("חֲדַר הַלְבָּשָׁה")}</button>` : ""}
    ${view.name !== "parents" ? `<button class="chip" data-go="parents">להורים</button>` : ""}
    <button class="chip icon" data-act="settings" aria-pressed="${ui.settings}" aria-label="הגדרות"><img class="ic" src="img/ui-gear.webp" alt=""></button>
  </div>
  ${ui.settings ? `<div class="settings">
    <button class="chip" data-act="nikud" aria-pressed="${S.nikud}">${S.nikud ? "נִקּוּד: כֵּן" : "ניקוד: לא"}</button>
    <button class="chip" data-act="size">אותיות ${["רגילות", "גדולות", "ענקיות"][S.size - 1] || "רגילות"}</button>
    <button class="chip" data-act="sound" aria-pressed="${S.sound}">${S.sound ? "🔊 צלילים: כן" : "🔇 צלילים: לא"}</button>
    ${ON_SITE && S.code ? `<button class="chip" data-act="copyMyCode">🔑 ${tx("הַקּוֹד שֶׁלִּי:")} <b dir="ltr">${esc(S.code)}</b></button>` : ""}
    <button class="chip out" data-act="logout">🚪 ${S.name ? "יציאה (" + esc(S.name) + ")" : "יציאה"}</button>
  </div>` : ""}`;
}

/* ---------- first visit: pick a character ---------- */
function renderHello() {
  return `<div class="panel" style="margin-top:12px">
    <h2>${tx("בָּרוּךְ הַבָּא לַמַּסָּע לָאִי שֶׁל הַמֵּאָה!")}</h2>
    <p style="margin:0;font-family:var(--f-read);font-size:1.1rem;line-height:1.8">${tx("בְּכָל אִי מְחַכָּה מְשִׂימָה שֶׁל מִסְפָּרִים. עַל כָּל תְּשׁוּבָה נְכוֹנָה מְקַבְּלִים מַטְבְּעוֹת, וּבָהֶם קוֹנִים בְּגָדִים וְחַיּוֹת לַדְּמוּת שֶׁלְּךָ.")}</p>
    <form class="name-field" id="nameForm">
      <label for="kidName" style="font-family:var(--f-read);font-weight:600">${tx("אֵיךְ קוֹרְאִים לְךָ?")}</label>
      <input id="kidName" maxlength="20" autocomplete="off" value="${esc(S.name)}" placeholder="השם שלי">
    </form>
    ${ON_SITE ? `<label class="name-field"><span style="font-family:var(--f-read);font-weight:600">${tx("כִּתָּה:")}</span><input id="kidKlass" maxlength="20" autocomplete="off" value="${esc(S.klass || "")}" placeholder="ב'2" style="width:7em"></label>` : (CFG.classes || []).length ? `<div><b style="font-family:var(--f-read)">${tx("בְּאֵיזוֹ כִּתָּה אַתָּה?")}</b>
      <div class="row" style="margin-top:8px">${CFG.classes.map(c => `<button class="chip klass ${S.klass === c ? "on" : ""}" data-klass="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>` : ""}
    <div><b style="font-family:var(--f-read)">${tx("בַּחֲרוּ דְּמוּת:")}</b>
      <div class="hello-chars" style="margin-top:8px">${CHARS.map(ch => `<button class="shop-item ${S.av.type === ch.id ? "on" : ""}" data-char="${ch.id}">${avatarSVG({ ...S.av, type: ch.id })}<span class="nm">${tx(ch.name)}</span></button>`).join("")}</div></div>
    ${AV_MASK[S.av.type] ? "" : "<!--"}<div><b style="font-family:var(--f-read)">${tx("בַּחֲרוּ צֶבַע לַבְּגָדִים:")}</b>
      <div class="row" style="margin-top:8px">${SUITS.map(c => `<button class="swatch-big ${S.av.color === c ? "on" : ""}" data-suit="${c}" style="background:${c}" aria-label="צבע"></button>`).join("")}</div></div>${AV_MASK[S.av.type] ? "" : "-->"}
    <div class="row"><button class="btn go" data-act="helloDone">⛵ ${tx("יוֹצְאִים לַמַּסָּע!")}</button></div>
  </div>`;
}

/* ---------- home: mission header + galaxy map ---------- */
function renderHome() {
  let t = Math.min(S.track || 0, TRACKS.length - 1); if (!trackVisible(t)) t = 0;
  const T = TRACKS[t];
  const nextIdx = T.stations.findIndex((s, i) => unlocked(t, i) && !done(s));
  const allDone = ALL.filter(s => !stationClosed(s)).every(done);
  const feats = TRACKS.flatMap((tr, tt) => trackVisible(tt) ? tr.stations.map((s, i) => [tt, i, s]).filter(x => featured(x[2])) : []);
  const hello = S.name ? `שָׁלוֹם ${S.name}!` : "שָׁלוֹם!";
  const line = nextIdx === -1 ? "סִיַּמְתָּ אֶת הַמַּסְלוּל הַזֶּה! אֶפְשָׁר לַעֲבֹר לַמַּסְלוּל הַבָּא." : `הַמְּשִׂימָה הַבָּאָה: ${T.stations[nextIdx].title}`;
  return bar() + `
  <div class="mission">
    <button class="me" data-go="shop" aria-label="חדר ההלבשה">${avatarSVG(S.av, "float")}<span class="edit">${tx("לְהַחְלִיף")}</span></button>
    <div style="min-width:0">
      <h1>${tx(hello)}</h1>
      <p>${tx(line)}</p>
      ${countdownHTML()}
    </div>
  </div>
  ${CFG.message ? `<div class="tmsg"><img src="img/ui-gift.webp" alt=""><div><b>${tx("הוֹדָעָה מֵהַמּוֹרָה")}${CFG.teacher ? " " + esc(CFG.teacher) : ""}:</b><p>${esc(CFG.message)}</p></div></div>` : ""}
  ${feats.length ? `<div class="feat-bar"><b>⭐ ${tx("מְשִׂימוֹת הַשָּׁבוּעַ:")}</b>${feats.map(([tt, i, s]) => `<button class="chip" data-feat="${tt}:${i}">${tx(s.title)}</button>`).join("")}</div>` : ""}
  <div class="tabs" role="tablist">
    ${TRACKS.map((tr, k) => {
      if (!trackVisible(k)) return "";
      const d = tr.stations.filter(done).length;
      return `<button class="tab ${k === t ? "on" : ""}" role="tab" aria-selected="${k === t}" data-track="${k}">
        <span class="gx"><img src="img/${tr.icon || "ui-star"}.webp" alt=""></span>
        <span class="tt"><span class="tn">${tx(tr.name)}${tr.badge ? `<span class="badge">${tx(tr.badge)}</span>` : ""}</span>
        <span class="ts">${tx(tr.sub)}</span><span class="ts"><img class="tic" src="img/ui-flag.webp" alt=""> ${d} / ${tr.stations.length}</span></span></button>`;
    }).join("")}
  </div>
  ${galaxyHTML(t)}
  ${allDone ? `<div class="cert"><div class="hand">${tx("כָּל הַכָּבוֹד")}${S.name ? " " + esc(S.name) : ""}!</div><p style="font-family:var(--f-read)">${tx("עָבַרְתָּ אֶת כָּל הָאִיִּים וְאָסַפְתָּ")} ${totalStars()} ${tx("כּוֹכָבִים. אַתָּה מוּכָן לְיוֹם הָאוֹצָר!")}</p></div>` : ""}
  <div class="home-foot">
    <span>כל אי לוקח 10 עד 15 דקות. מומלץ אחד ביום.</span>
    <span class="row"><button class="btn ghost" data-go="parents">להורים: איך לעזור בבית</button><button class="btn ghost" data-go="teacher">למורים</button></span>
  </div>
  ${CREDIT()}`;
}

/* ---------- dressing room: a drawn room; each piece of furniture opens its drawer ---------- */
const ROOM_SPOTS = [
  { cat: "hat", img: "sign", name: "כּוֹבָעִים", style: "left:3%;top:13%;width:23%" },
  { cat: "face", img: "bottle", name: "לַפָּנִים", style: "right:3%;top:14%;width:19%" },
  { cat: "char", img: "mirror", name: "מַרְאָה", style: "left:9%;top:43%;width:11%" },
  { cat: "back", img: "rack", name: "עַל הַגַּב", style: "right:10%;top:38%;width:9%" },
  { cat: "pet", img: "crate", name: "חַיּוֹת", style: "left:4%;bottom:12%;width:24%" },
  { cat: "hand", img: "chest", name: "בַּיָּד", style: "right:3%;bottom:12%;width:24%" },
];
const CREDIT = () => `<p class="credit">${tx("נוֹצַר בְּאַהֲבָה עַל יְדֵי")} <span class="who">${tx("נוֹעָה קַסְטְרוֹ")} <span class="heart">♥</span></span></p>`;
const coinTag = n => `<img class="tic" src="img/ui-coin.webp" alt=""> ${n}`;
function drawerItems(cat) {
  if (cat === "char") return `<div class="items">${CHARS.map(ch => `<button class="shop-item ${S.av.type === ch.id ? "on" : ""}" data-char="${ch.id}">${avatarSVG({ ...S.av, type: ch.id })}<span class="nm">${tx(ch.name)}</span></button>`).join("")}</div>
    ${AV_MASK[S.av.type] ? "" : "<!--"}<span class="lbl-s" style="margin-top:12px">${tx("צֶבַע הַבְּגָדִים:")}</span>
    <div class="row">${SUITS.map(c => `<button class="swatch-big ${S.av.color === c ? "on" : ""}" data-suit="${c}" style="background:${c}" aria-label="צבע"></button>`).join("")}</div>${AV_MASK[S.av.type] ? "" : "-->"}`;
  return `<div class="items"><button class="shop-item ${!S.av[cat] ? "on" : ""}" data-wear="" data-slot="${cat}"><span class="e" style="font-size:2.2rem;line-height:64px">🚫</span><span class="nm">${tx("בְּלִי")}</span></button>` +
    SHOP.filter(it => it.slot === cat).map(it => {
      const own = S.owned.includes(it.id), on = S.av[cat] === it.id, trying = ui.tryOn === it.id;
      return `<button class="shop-item ${on || trying ? "on" : ""}" data-item="${it.id}"><img class="e" src="${it.img}" alt=""><span class="nm">${tx(it.name)}</span>
        <span class="pr ${own ? "own" : ""}">${on ? tx("לוֹבֵשׁ ✓") : trying ? tx("מוֹדְדִים 👀") : own ? tx("שֶׁלִּי") : coinTag(it.price)}</span></button>`;
    }).join("") + `</div>`;
}
function renderShop() {
  const cat = ui.shopCat || "char", spot = ROOM_SPOTS.find(s => s.cat === cat);
  const hop = ui.hop; ui.hop = false;
  const tr = ui.tryOn && SHOP.find(x => x.id === ui.tryOn);
  const stageAv = tr ? { ...S.av, [tr.slot]: tr.id } : S.av;
  return bar() + `<div class="dress">
    <div class="room">
      ${ROOM_SPOTS.map(s => `<button class="spot ${s.cat === cat ? "on" : ""}" data-cat="${s.cat}" style="${s.style}" aria-label="${plain(s.name)}">
        <img src="img/furn-${s.img}.webp" alt=""><span class="spot-l">${tx(s.name)}</span></button>`).join("")}
      <div class="on-stage ${hop ? "hop" : ""}">${avatarSVG(stageAv, "float")}</div>
      ${tr ? `<div class="try-bar"><span class="try-l">${tx("מוֹדְדִים:")} <b>${tx(tr.name)}</b></span>
        <button class="buy-btn" data-act="buyTry"><span>${tx("לִקְנוֹת")}</span><span class="price"><img src="img/ui-coin.webp" alt="מטבעות"><bdi>${tr.price}</bdi></span></button>
        <button class="btn ghost" data-act="cancelTry" aria-label="להוריד">✕</button></div>` : ""}
      <span class="wallet-tag">${coinTag(S.coins)}</span>
      <button class="snap" data-act="photo" aria-label="צילום לאלבום">📸 ${tx("צִלּוּם")}</button>
      <div class="flash" id="flash"></div>
    </div>
    <div class="panel drawer">
      <h2><img class="h-ic" src="img/furn-${spot.img}.webp" alt=""> ${tx(spot.cat === "char" ? "דְּמוּת וְצֶבַע" : spot.name)}</h2>
      ${drawerItems(cat)}
      <p class="how">${tx("גְּעוּ בָּרָהִיטִים בַּחֶדֶר כְּדֵי לִפְתֹּחַ אוֹתָם.")} ${tx("כָּל תְּשׁוּבָה נְכוֹנָה בַּפַּעַם הָרִאשׁוֹנָה")} = ${coinTag(COIN_RIGHT)}. ${tx("כָּל כּוֹכָב בְּסוֹף מְשִׂימָה")} = ${coinTag(COIN_STAR)}.</p>
      <div class="row"><button class="btn" data-go="home">⛵ ${tx("חֲזָרָה לַמַּפָּה")}</button><button class="btn ghost" data-go="album">${tx("לָאַלְבּוֹם")}</button></div>
    </div>
  </div>`;
}
function takePhoto() {
  S.photos = [{ ...S.av, when: Date.now() }, ...(S.photos || [])].slice(0, 24); save();
  const f = $("#flash"); if (f) { f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); }
  sfx("snap"); toast("הַתְּמוּנָה נִשְׁמְרָה בָּאַלְבּוֹם!");
}

/* ---------- album: a real book. Pages turn in 3D over the spine (Hebrew order), by button, tap or drag ---------- */
function albumPages() {
  const pages = [{ kind: "cover" }, { kind: "inside" }];
  TRACKS.forEach((tr, t) => pages.push({ kind: "stickers", t }));
  const ph = S.photos || [];
  for (let i = 0; i < Math.max(1, ph.length); i += 4) pages.push({ kind: "photos", list: ph.slice(i, i + 4) });
  if (pages.length % 2) pages.push({ kind: "blank" });
  pages.push({ kind: "blank" }, { kind: "back" });
  return pages;
}
const dmy = ts => { const d = new Date(ts); return `${d.getDate()}/${d.getMonth() + 1}`; };
function pageHTML(p, n) {
  if (!p) return `<div class="page none"></div>`;
  if (p.kind === "cover") return `<div class="page cover"><div class="cover-in">
      <span class="cover-top">${tx("הָאַלְבּוֹם שֶׁל")}</span>
      <h2>${esc(S.name || "הַפִּירָאט")}</h2>
      <div class="cover-av">${avatarSVG(S.av)}</div>
      <span class="cover-count"><img class="tic" src="img/ui-star.webp" alt=""> ${ALL.filter(done).length} / ${ALL.length} ${tx("מַדְבֵּקוֹת")}</span>
    </div></div>`;
  if (p.kind === "back") return `<div class="page cover back"><div class="cover-in"><img src="img/chest-open.webp" alt="" style="width:110px"><span class="cover-top">${tx("הַמַּסָּע נִמְשָׁךְ...")}</span>${CREDIT()}</div></div>`;
  if (p.kind === "inside") return `<div class="page paper inside"><div class="plate"><span>${tx("הַסֵּפֶר הַזֶּה שַׁיָּךְ לְ:")}</span><b>${esc(S.name || "")}</b>
      <img src="img/parrot.webp" alt="" style="width:70px"></div><span class="pnum">${n}</span></div>`;
  if (p.kind === "blank") return `<div class="page paper"><span class="pnum">${n}</span></div>`;
  if (p.kind === "stickers") {
    const tr = TRACKS[p.t];
    return `<div class="page paper"><h3>${tx(tr.name)}</h3><div class="sgrid">
      ${tr.stations.map((s, i) => {
        const r = S.st[s.id], tilt = ((i * 37) % 13) - 6;
        return `<div class="sticker-slot">${r && r.done ? stickerHTML(s, r, tilt) : `<span class="sticker empty">?</span>`}<span class="nm">${tx(s.title)}</span></div>`;
      }).join("")}</div><span class="pnum">${n}</span></div>`;
  }
  return `<div class="page paper"><h3>${tx("הַתְּמוּנוֹת שֶׁלִּי")}</h3>
    ${p.list.length ? `<div class="pgrid">${p.list.map((ph, i) => `<figure class="polaroid" style="--tilt:${(i % 2 ? 3 : -3)}deg"><div class="ph-in">${avatarSVG(ph)}</div><figcaption>${dmy(ph.when)}</figcaption></figure>`).join("")}</div>`
      : `<p class="empty-note">${tx("עוֹד אֵין תְּמוּנוֹת. בַּחֲדַר הַהַלְבָּשָׁה יֵשׁ כַּפְתּוֹר 📸, וְכָל תְּמוּנָה תַּגִּיעַ לְכָאן!")}</p>`}
    <span class="pnum">${n}</span></div>`;
}
const isSpread = () => innerWidth >= 760;
// in a spread the right page is the earlier one (Hebrew); spread k shows pages 2k-1 (right) and 2k (left), so the cover stands alone on the right
const spreadOf = page => Math.ceil(page / 2);
const spreadPages = k => [k * 2 - 1, k * 2];
function renderAlbum() {
  const pages = albumPages(), spread = isSpread();
  ui.page = Math.max(0, Math.min(ui.page || 0, pages.length - 1));
  let slots, first, last;
  if (spread) {
    const k = spreadOf(ui.page), [r, l] = spreadPages(k);
    slots = `<div class="bslot right">${pageHTML(pages[r], r)}</div><div class="bslot left">${pageHTML(pages[l], l)}</div>`;
    first = k === 0; last = l >= pages.length - 1;
  } else {
    slots = `<div class="bslot one">${pageHTML(pages[ui.page], ui.page)}</div>`;
    first = ui.page === 0; last = ui.page >= pages.length - 1;
  }
  return bar() + `<div class="album-wrap">
    <div class="book3d ${spread ? "spread" : "single"}" id="book">
      ${spread ? `<div class="spine"></div>` : ""}${slots}
      <div class="leaf" id="leaf" hidden><div class="face front"></div><div class="face back"></div></div>
      <div class="under-shade" id="ushade"></div>
    </div>
    <div class="book-nav">
      <button class="btn ghost" data-act="pagePrev" ${first ? "disabled" : ""}>→ ${tx("הַקּוֹדֵם")}</button>
      <span class="pdots">${pages.map((_, i) => `<i class="${(spread ? spreadOf(i) === spreadOf(ui.page) : i === ui.page) ? "on" : ""}"></i>`).join("")}</span>
      <button class="btn" data-act="pageNext" ${last ? "disabled" : ""}>${tx("הַבָּא")} ←</button>
    </div>
    <p class="how" style="text-align:center;color:var(--on-space-soft)">${tx("אֶפְשָׁר גַּם לִתְפֹּס אֶת הַדַּף בָּאֶצְבַּע וּלְדַפְדֵּף.")}</p>
    <div class="row" style="justify-content:center"><button class="btn ghost" data-go="home">⛵ ${tx("חֲזָרָה לַמַּפָּה")}</button><button class="btn ghost" data-go="shop">${tx("לַחֲדַר הַהַלְבָּשָׁה")}</button></div>
  </div>`;
}

/* flip engine: one leaf with a front and a back face rotates around the spine; angle 0..180 */
let flip = null;
function flipSetup(dir) {
  if (flip) return null;
  const pages = albumPages(), book = $("#book"), leaf = $("#leaf");
  if (!book || !leaf) return null;
  const spread = isSpread();
  let target, frontIdx, backIdx, underIdx, underSlot, side;
  if (spread) {
    const k = spreadOf(ui.page), [r, l] = spreadPages(k);
    if (dir > 0) { if (l >= pages.length - 1) return null; target = l + 1; frontIdx = l; backIdx = l + 1; underIdx = l + 2; underSlot = ".bslot.left"; side = "left"; }
    else { if (k === 0) return null; target = r - 1; frontIdx = r; backIdx = r - 1; underIdx = r - 2; underSlot = ".bslot.right"; side = "right"; }
  } else {
    if (dir > 0) { if (ui.page >= pages.length - 1) return null; target = ui.page + 1; frontIdx = ui.page; backIdx = null; underIdx = ui.page + 1; underSlot = ".bslot.one"; side = "one"; }
    else { if (ui.page === 0) return null; target = ui.page - 1; frontIdx = ui.page - 1; backIdx = null; underIdx = null; underSlot = null; side = "one-in"; }
  }
  leaf.className = "leaf " + side;
  leaf.querySelector(".front").innerHTML = pageHTML(pages[frontIdx], frontIdx);
  leaf.querySelector(".back").innerHTML = backIdx === null ? `<div class="page paper backside"></div>` : pageHTML(pages[backIdx], backIdx);
  if (underSlot) { const u = book.querySelector(underSlot); u.innerHTML = underIdx >= 0 && underIdx < pages.length ? pageHTML(pages[underIdx], underIdx) : `<div class="page none"></div>`; }
  leaf.hidden = false;
  flip = { dir, target, leaf, book, side, angle: side === "one-in" ? 180 : 0, ush: $("#ushade") };
  flip.ush.className = "under-shade " + side;
  flipPaint(flip.angle);
  return flip;
}
function flipPaint(a) {
  const f = flip; if (!f) return;
  f.angle = a;
  // positive angle lifts the left page towards the viewer and over to the right (forward in a Hebrew book)
  const deg = f.side === "right" ? -a : a;
  f.leaf.style.transform = `rotateY(${deg}deg)`;
  const lift = Math.sin(a * Math.PI / 180);
  f.leaf.style.setProperty("--lift", lift.toFixed(3));
  f.leaf.style.setProperty("--fside", a > 90 ? 1 : 0);
  f.ush.style.opacity = (lift * .55).toFixed(3);
}
function flipAnimate(to, done) {
  const f = flip, from = f.angle, t0 = performance.now(), dur = reduced() ? 1 : 520 + Math.abs(to - from) * 2.2;
  (function step(t) {
    const k = Math.min(1, (t - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    flipPaint(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step); else done();
  })(t0);
}
function flipFinish(complete) {
  const f = flip;
  const end = f.side === "one-in" ? (complete ? 0 : 180) : (complete ? 180 : 0);
  flipAnimate(end, () => { flip = null; if (complete) ui.page = f.target; draw(); });
}
function turnPage(dir) {
  if (!flipSetup(dir)) return;
  sfx("page"); flipFinish(true);
}
// drag a page with a finger or the mouse
let drag = null;
document.addEventListener("pointerdown", e => {
  if (view.name !== "album" || flip || !e.target.closest("#book")) return;
  const r = $("#book").getBoundingClientRect();
  drag = { x: e.clientX, w: isSpread() ? r.width / 2 : r.width, started: false, onLeft: e.clientX < r.left + r.width / 2 };
});
document.addEventListener("pointermove", e => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  if (!drag.started) {
    if (Math.abs(dx) < 12) return;
    // drag towards the right = forward (Hebrew); towards the left = back
    if (!flipSetup(dx > 0 ? 1 : -1)) { drag = null; return; }
    drag.started = true; sfx("page");
  }
  const p = Math.max(0, Math.min(1, Math.abs(dx) / (drag.w * 1.1)));
  flipPaint(flip.side === "one-in" ? 180 - p * 180 : p * 180);
}, { passive: true });
document.addEventListener("pointerup", e => {
  if (!drag) return;
  const d = drag; drag = null;
  if (!d.started) {
    // a tap on the left page goes forward, on the right page goes back
    if (e.target.closest("#book") && !e.target.closest("button")) turnPage(isSpread() ? (d.onLeft ? 1 : -1) : 1);
    return;
  }
  const a = flip.side === "one-in" ? 180 - flip.angle : flip.angle;
  flipFinish(a > 60);
});
addEventListener("resize", () => { if (view.name === "album" && !flip) draw(); });

// a sticker in the album: the drawing when it exists, otherwise the emoji
const STICKER_IMG = Object.fromEntries(Object.entries(STICKER_SRC).map(([k, v]) => [k, `img/${v}.webp`]));
const stickerHTML = (s, r, tilt) => `<span class="sticker ${r.stars === 3 ? "gold" : ""}" style="--tilt:${tilt}deg">${STICKER_IMG[s.id] ? `<img src="${STICKER_IMG[s.id]}" alt="">` : STICKERS[s.id]}</span>`;

/* ---------- station intro ---------- */
function renderIntro() {
  const s = ST();
  return bar() + `<div class="panel intro">
    <div class="intro-head"><img class="mini-planet" src="${planetArt(run.t, run.i, s)}" alt="">
      <div><span class="qtag">${tx(TRACKS[run.t].name)}</span><h2>${esc(plain(s.title))}</h2></div></div>
    <div class="guide"><img class="parrot" src="img/parrot.webp" alt="קפטן תוכי"><div class="bubble">${s.owl.map(l => `<p style="font-family:var(--f-read);font-size:calc(var(--read-size)*.95);line-height:1.9">${tx(l)}</p>`).join("")}</div>
      <button class="speak" data-say="${esc(s.owl.join(" "))}" aria-label="הקראה">${SPEAK}</button></div>
    <div class="toolbox"><h3>🧰 ${tx("אַרְגַּז הַכֵּלִים שֶׁלִּי")}</h3><ol>${s.tools.map(t => `<li>${tx(t)}</li>`).join("")}</ol></div>
    <div class="row"><button class="btn go" data-act="start">⛵ ${tx("מַפְלִיגִים!")}</button><button class="btn ghost" data-go="home">${tx("חֲזָרָה לַמַּפָּה")}</button></div>
  </div>`;
}

/* ---------- reading text (comprehension track) ---------- */
function textFor(s, q) { return q.text ? { kind: "", title: "", paras: [q.text] } : s.text; }
function evMatch(sentence, ev) { return (ev || []).some(f => sentence.includes(f)); }

function renderText(s, q, st) {
  const T = textFor(s, q);
  let k = 0;
  const paras = T.paras.map(p => `<p>${p.map(sen => {
    const idx = k++;
    const hl = st.hint && evMatch(sen, q.ev) ? " hl" : "";
    const picked = st.picked === idx ? " picked" : "";
    const tap = q.type === "find" && !st.locked ? ' role="button" tabindex="0"' : "";
    return `<span class="sen${hl}${picked}" data-sen="${idx}"${tap}>${tx(sen)}</span>`;
  }).join(" ")}</p>`).join("");
  return `<article class="reading" id="reading">
    ${T.kind ? `<span class="kind">${tx(T.kind)}</span>` : ""}
    ${T.title ? `<h3>${tx(T.title)}</h3>` : ""}
    <div class="txt ${q.type === "find" && !st.locked ? "findable" : ""}">${paras}</div>
  </article>`;
}

/* ---------- per-question state ---------- */
function qStateNew(q, s) {
  const sc = (s && s.scaffold) || 0;
  return { tries: 0, locked: false, hint: false, sel: null, wrongs: [], picked: null,
    order: [], pool: q.type === "order" ? shuffle(q.items.map((_, i) => i)) : [], marks: [],
    opts: isChoice(q) ? shuffle(q.opts.map((_, i) => i)) : [], text: "", checked: [], showModel: false,
    // instruction tasks
    stage: sc >= 1 && q.verb ? "verb" : "do", needNum: sc >= 2 && !!q.num, foundV: [], foundN: null, stageMsg: null,
    tool: null, color: null, pending: null, bad: null, reveal: false, fbMsg: null, msg: null,
    bank: q.type === "build" ? shuffle(q.bank.map((_, i) => i)) : [], slots: [],
    p: q.type === "punct" ? q.lines.map(() => "") : [], pmarks: null, sort: {}, smarks: null, allOk: false,
    // island tasks
    pk: { pile: q.type === "pack" ? q.n : 0, in: 0, packed: 0 }, ld: q.pre ? { ...q.pre } : { t: 0, o: 0 }, cd: { d: Array(q.cells || 2).fill(null), act: 0 }, leave: false };
}

/* ---------- play ---------- */
function renderPlay() {
  const s = ST(), q = s.questions[run.qi], st = run.q;
  const dots = s.questions.map((qq, i) => {
    const r = run.res[i];
    return `<i class="${i === run.qi ? "cur" : r === true ? "ok" : r === false ? (s.test ? "ok" : "miss") : r === "open" ? "ok" : ""}"></i>`;
  }).join("") + `<img class="rk" src="img/crab-jump.webp" alt="" style="inset-inline-start:${((run.qi + .5) / s.questions.length * 100).toFixed(1)}%">`;
  const head = `<div class="crumbs"><h2>${tx(s.title)}</h2><span class="chip">${tx("שְׁאֵלָה")} ${run.qi + 1} ${tx("מִתּוֹךְ")} ${s.questions.length}</span><div class="prog" aria-hidden="true">${dots}</div></div>`;
  const card = `<section class="qcard" aria-live="polite">
      <span class="qtag">${tx(SKILLS[q.skill].kid)}</span>
      <div class="qhead"><p class="qtext">${tx(q.q)}</p><button class="speak" data-say="${esc(q.q + (q.type === "mc" ? " " + st.opts.map(o => q.opts[o]).join(". ") : ""))}" aria-label="הקראת השאלה">${SPEAK}</button></div>
      ${renderAnswer(s, q, st)}
    </section>`;
  // sorting and writing have no task form: without a text they still need the question card
  if (!(q.text || s.text) && (q.type === "sort" || q.type === "write" || q.type === "order")) return bar() + head + `<div class="task">${card}</div>`;
  if (isTask(q) || !(q.text || s.text)) return bar() + head + `<div class="task"><section class="qcard" aria-live="polite">${renderTask(s, q, st)}</section></div>`;
  return bar() + head + `
  <div class="play">
    ${renderText(s, q, st)}
    ${card}
  </div>`;
}

const nextLabel = s => run.qi + 1 < s.questions.length ? tx("לַשְּׁאֵלָה הַבָּאָה") : tx("לְסִיּוּם הַתַּחֲנָה");

function renderAnswer(s, q, st) {
  const nextBtn = `<button class="btn" data-act="next">${nextLabel(s)}</button>`;
  if (q.type === "sort") return renderSort(s, q, st, nextBtn);
  if (q.type === "write") return renderWrite(s, q, st, nextBtn);
  if (q.type === "mc") {
    const opts = st.opts.map((oi, k) => {
      let c = "opt";
      if (s.test) { if (st.sel === oi) c += " sel"; }
      else if (st.locked && oi === 0) c += " right";
      else if (st.wrongs.includes(oi)) c += " wrong";
      return `<button class="${c}" data-opt="${oi}" ${st.locked || st.wrongs.includes(oi) ? "disabled" : ""}><span class="k">${LETTERS[k]}</span><span>${tx(q.opts[oi])}</span></button>`;
    }).join("");
    if (s.test) return `<div class="opts">${opts}</div><div class="row"><button class="btn" data-act="testnext" ${st.sel === null ? "disabled" : ""}>${tx("הַמְשֵׁךְ")}</button></div>`;
    return `<div class="opts">${opts}</div>${feedback(q, st)}${st.locked ? `<div class="row">${nextBtn}</div>` : ""}`;
  }
  if (q.type === "find") {
    const picked = st.picked !== null ? textFor(s, q).paras.flat()[st.picked] : null;
    return `<div class="feedback info">${tx("גְּעוּ בַּמִּשְׁפָּט בַּטֶּקְסְט.")} ${picked ? `<br>${tx("בְּחַרְתֶּם:")} <span class="r">${tx(picked)}</span>` : ""}</div>
      ${st.locked ? "" : `<div class="row"><button class="btn" data-act="checkfind" ${st.picked === null ? "disabled" : ""}>${tx("בְּדִיקָה")}</button></div>`}
      ${feedback(q, st)}${st.locked ? `<div class="row">${nextBtn}</div>` : ""}`;
  }
  if (q.type === "order") {
    const slots = q.items.map((_, k) => {
      const it = st.order[k];
      const mark = st.marks && st.marks[k] !== undefined ? (st.marks[k] ? " right" : " wrong") : "";
      return `<div class="slot${it !== undefined ? " filled" : ""}${mark}"><span class="n">${k + 1}</span>${it !== undefined ? `<button data-unorder="${k}" ${st.locked ? "disabled" : ""}>${tx(q.items[it])}</button>` : ""}</div>`;
    }).join("");
    const pool = st.pool.map(i => `<button data-order="${i}">${tx(q.items[i])}</button>`).join("");
    const full = st.order.filter(x => x !== undefined).length === q.items.length;
    return `<div class="order-zone"><span class="lbl">${tx("גְּעוּ בַּכַּרְטִיסִים לְפִי הַסֵּדֶר:")}</span>${pool ? `<div class="pool">${pool}</div>` : ""}${slots}</div>
      ${st.locked ? "" : `<div class="row"><button class="btn" data-act="${s.test ? "testnext" : "checkorder"}" ${full ? "" : "disabled"}>${s.test ? tx("הַמְשֵׁךְ") : tx("בְּדִיקָה")}</button></div>`}
      ${s.test ? "" : feedback(q, st)}${st.locked && !s.test ? `<div class="row">${nextBtn}</div>` : ""}`;
  }
  if (q.type === "open") {
    const ta = `<label for="ans-${s.id}-${run.qi}" style="color:var(--ink-soft)">${tx("הַתְּשׁוּבָה שֶׁלִּי:")}</label><textarea id="ans-${s.id}-${run.qi}" data-input="open" ${st.showModel ? "readonly" : ""}>${esc(st.text)}</textarea>`;
    if (s.test) return `${ta}<div class="row"><button class="btn" data-act="testnext" ${st.text.trim().length < 3 ? "disabled" : ""}>${tx("הַמְשֵׁךְ")}</button></div>`;
    if (!st.showModel) return `${ta}<div class="row"><button class="btn" data-act="openDone" ${st.text.trim().length < 3 ? "disabled" : ""}>${tx("סִיַּמְתִּי לִכְתֹּב")}</button></div>`;
    return `${ta}<div class="feedback info"><b>${tx("בּוֹדְקִים יַחַד (עִם אַבָּא אוֹ אִמָּא):")}</b>
      <div class="checklist" style="margin-top:8px">${q.check.map((c, k) => `<label><input type="checkbox" data-check="${k}" ${st.checked.includes(k) ? "checked" : ""}>${tx(c)}</label>`).join("")}</div></div>
      <div class="feedback good"><b>${tx("תְּשׁוּבָה לְדֻגְמָה:")}</b><div class="model" style="margin-top:6px">${tx(q.model)}</div>
      <div style="margin-top:6px;font-size:.95rem">${tx("יֵשׁ עוֹד הַרְבֵּה תְּשׁוּבוֹת נְכוֹנוֹת! הָעִקָּר: מִשְׁפָּט שָׁלֵם וְהֶסְבֵּר.")}</div></div>
      <div class="row">${nextBtn}</div>`;
  }
  return "";
}

function feedback(q, st) {
  if (st.locked && st.tries === 1) return `<div class="feedback good"><b>${tx(pick(["מְצֻיָּן!", "נָכוֹן!", "כָּל הַכָּבוֹד!", "יָפֶה מְאוֹד!"]))}</b> <span class="r">${tx(q.why)}</span></div>`;
  if (st.locked) return `<div class="feedback info"><b>${tx(isTask(q) && q.type !== "fill" && q.type !== "mc" ? "כָּךְ עוֹשִׂים אֶת זֶה:" : "הַתְּשׁוּבָה הַנְּכוֹנָה מְסֻמֶּנֶת.")}</b> <span class="r">${tx(q.why)}</span></div>`;
  if (st.tries === 1) {
    if (st.fbMsg) return `<div class="feedback try"><b>${tx("כִּמְעַט!")}</b> ${tx(st.fbMsg)}</div>`;
    const where = q.hint || HINTS[q.skill] || "קִרְאוּ שׁוּב אֶת הַשְּׁאֵלָה וְנַסּוּ שׁוּב.";
    const extra = q.type === "order" ? " הַכַּרְטִיסִים בַּיָּרֹק כְּבָר בַּמָּקוֹם." : "";
    return `<div class="feedback try"><b>${tx("כִּמְעַט!")}</b> ${tx(where + extra)}</div>`;
  }
  return "";
}

/* ---------- instruction tasks ---------- */
const TOOLS = {
  circle: { label: "עִגּוּל מִסָּבִיב", meaning: "עִגּוּל מִסָּבִיב (\"הַקִּיפוּ\")", icon: `<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9" ry="7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>` },
  under: { label: "קַו מִתַּחַת", meaning: "קַו מִתַּחַת (\"מִתְחוּ קַו מִתַּחַת\")", icon: `<svg viewBox="0 0 24 24"><path d="M7 6v6M12 6v6M17 6v6" stroke="currentColor" stroke-width="1.6" opacity=".45"/><path d="M3 18h18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>` },
  x: { label: "סִימוּן X", meaning: "סִימוּן X (\"סַמְּנוּ X\")", icon: `<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>` },
  line: { label: "קַו מְחַבֵּר", meaning: "קַו מְחַבֵּר (\"מִתְחוּ קַו מִ... אֶל...\")", icon: `<svg viewBox="0 0 24 24"><circle cx="5" cy="17" r="2.5" fill="currentColor"/><circle cx="19" cy="7" r="2.5" fill="currentColor"/><path d="M5 17L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>` },
  color: { label: "צֶבַע", meaning: "צְבִיעָה (\"צִבְעוּ\")", icon: `<svg viewBox="0 0 24 24"><path d="M14 3l7 7-9 9H5v-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M5 19l4-4" stroke="currentColor" stroke-width="2"/></svg>` },
};
const TOOL_ORDER = ["circle", "under", "x", "line", "color"];
const COLORS = { red: { name: "אָדֹם", v: "#E5484D" }, yellow: { name: "צָהֹב", v: "#F5C518" }, blue: { name: "כָּחֹל", v: "#3B82F6" }, green: { name: "יָרֹק", v: "#22A55B" } };
const mkey = m => m.t === "line" ? "line:" + [m.id, m.id2].sort().join("|") : m.t === "color" ? "color:" + m.id + ":" + m.c : m.t + ":" + m.id;
const markOk = (q, marks) => { const exp = new Set(q.expect.map(mkey)); const got = marks.map(mkey); return got.length === exp.size && got.every(k => exp.has(k)); };

function diagnose(q, marks) {
  const exp = q.expect, expKeys = new Set(exp.map(mkey)), expTools = new Set(exp.map(m => m.t));
  if (!marks.length) return "עוֹד לֹא סִמַּנְתֶּם כְּלוּם.";
  if (marks.some(m => !expTools.has(m.t))) return `בַּהוֹרָאָה בִּקְּשׁוּ: ${[...expTools].map(t => TOOLS[t].meaning).join(" וְגַם ")}. בִּדְקוּ שׁוּב אֶת מִלַּת הַפְּעֻלָּה.`;
  if (marks.some(m => m.t === "color" && exp.some(e => e.t === "color" && e.id === m.id && e.c !== m.c))) return "שִׂימוּ לֵב לַצֶּבַע שֶׁבִּקְּשׁוּ בַּהוֹרָאָה.";
  if (expTools.size > 1) {
    const did = new Set(marks.filter(m => expKeys.has(mkey(m))).map(m => m.t));
    if (did.size < expTools.size) return "עֲשִׂיתֶם רַק חֵלֶק. בַּהוֹרָאָה יֵשׁ שְׁנֵי דְּבָרִים לַעֲשׂוֹת.";
  }
  if (exp.length > 1 && marks.length !== exp.length) return `בַּהוֹרָאָה בִּקְּשׁוּ ${exp.length}, וְסִמַּנְתֶּם ${marks.length}. לֹא יוֹתֵר וְלֹא פָּחוֹת!`;
  if (exp.length === 1 && marks.length > 1) return "בִּקְּשׁוּ לְסַמֵּן רַק דָּבָר אֶחָד.";
  return q.hint || "יֵשׁ סִימוּן שֶׁלֹּא בַּמָּקוֹם הַנָּכוֹן. קִרְאוּ שׁוּב אֶת הַהוֹרָאָה.";
}

function renderInstr(q, st) {
  const words = q.q.split(" ");
  const tapping = st.stage === "verb" || st.stage === "num";
  const body = words.map((w, k) => {
    const c = ["iw", tapping ? "tap" : "", st.foundV.includes(k) ? "v" : "", st.foundN === k ? "n" : ""].join(" ");
    return `<span class="${c}" data-iw="${k}"${tapping ? ' role="button" tabindex="0"' : ""}>${tx(w)}</span>`;
  }).join(" ");
  return `<div class="instr"><div style="flex:1;min-width:0"><span class="lbl">${tx("הוֹרָאָה")}</span><p class="itext">${body}</p></div>
    <button class="speak" data-say="${esc(q.q)}" aria-label="הקראת ההוראה">${SPEAK}</button></div>`;
}

function stageHint(q, st) {
  if (st.stage === "verb") {
    const ask = q.verb.length > 1 ? `מָה צָרִיךְ לַעֲשׂוֹת? בַּהוֹרָאָה הַזֹּאת יֵשׁ ${q.verb.length} מִלּוֹת פְּעֻלָּה. גְּעוּ בְּכֻלָּן.` : "מָה צָרִיךְ לַעֲשׂוֹת? גְּעוּ בְּמִלַּת הַפְּעֻלָּה בַּהוֹרָאָה.";
    const bad = st.stageMsg === "bad" ? `<br>${tx("לֹא זוֹ. מִלַּת הַפְּעֻלָּה אוֹמֶרֶת מָה לַעֲשׂוֹת, כְּמוֹ: הַקִּיפוּ, סַמְּנוּ, כִּתְבוּ.")}` : "";
    const more = st.foundV.length ? `<br>${tx("יָפֶה! יֵשׁ עוֹד אַחַת.")}` : "";
    return `<div class="feedback ${st.stageMsg === "bad" ? "try" : "info"}"><b>${tx("שָׁלָב 1:")}</b> ${tx(ask)}${bad}${more}</div>`;
  }
  if (st.stage === "num") return `<div class="feedback ${st.stageMsg === "bad" ? "try" : "info"}"><b>${tx("שָׁלָב 2:")}</b> ${tx("יָפֶה! וְעַכְשָׁו: כַּמָּה? גְּעוּ בַּמִּלָּה שֶׁאוֹמֶרֶת כַּמָּה.")}${st.stageMsg === "bad" ? `<br>${tx("לֹא זוֹ. חַפְּשׂוּ מִלָּה שֶׁל מִסְפָּר.")}` : ""}</div>`;
  return "";
}

function tapInstrWord(k) {
  const q = ST().questions[run.qi], st = run.q, w = q.q.split(" ")[k];
  if (st.stage === "verb") {
    const hit = q.verb.some(v => w.includes(v)) && !st.foundV.includes(k);
    if (hit) { st.foundV.push(k); st.stageMsg = null; chime(true);
      if (st.foundV.length >= q.verb.length) st.stage = st.needNum ? "num" : "do"; }
    else if (!st.foundV.includes(k)) { st.stageMsg = "bad"; chime(false); }
  } else if (st.stage === "num") {
    if (w.includes(q.num)) { st.foundN = k; st.stage = "do"; st.stageMsg = null; chime(true); }
    else { st.stageMsg = "bad"; chime(false); }
  }
  draw();
}

function renderTask(s, q, st) {
  if (MATH_TYPES.includes(q.type)) return renderMath(s, q, st);
  const tag = `<span class="qtag">${tx(SKILLS[q.skill].kid)}</span>`;
  const wait = st.stage !== "do" ? " wait" : "";
  const nextBtn = `<button class="btn" data-act="next">${nextLabel(s)}</button>`;
  const after = s.test ? "" : `${feedback(q, st)}${st.locked ? `<div class="row">${nextBtn}</div>` : ""}`;
  let body = "";
  if (q.type === "mc" || q.type === "fill") {
    const board = q.board ? renderBoard(q, st, false) : picHTML(q.pic);
    let sentence = "";
    if (q.type === "fill") {
      const [a, b] = q.sentence.split("___");
      const shown = s.test ? (st.sel !== null ? q.opts[st.sel] : "") : st.locked ? q.opts[0] : "";
      sentence = `<p class="fill-sent">${tx(a)}<span class="blank${!s.test && st.locked ? " ok" : ""}">${shown ? tx(shown) : "&nbsp;"}</span>${tx(b)}</p>`;
    }
    const opts = st.opts.map((oi, k) => {
      let c = q.type === "fill" ? "chip-o" : "opt";
      if (s.test) { if (st.sel === oi) c += " sel"; }
      else if (st.locked && oi === 0) c += " right";
      else if (st.wrongs.includes(oi)) c += " wrong";
      const inner = q.type === "fill" ? tx(q.opts[oi]) : `<span class="k">${LETTERS[k]}</span><span>${tx(q.opts[oi])}</span>`;
      return `<button class="${c}" data-opt="${oi}" ${st.locked || st.wrongs.includes(oi) ? "disabled" : ""}>${inner}</button>`;
    }).join("");
    body = `${board}${sentence}${q.type === "fill" ? `<span class="lbl-s">${tx("מַחְסַן מִלִּים:")}</span><div class="chips">${opts}</div>` : `<div class="opts">${opts}</div>`}
      ${s.test ? `<div class="row"><button class="btn" data-act="testnext" ${st.sel === null ? "disabled" : ""}>${tx("הַמְשֵׁךְ")}</button></div>` : after}`;
    return tag + (q.type === "fill" ? renderInstr(q, st) : `<div class="qhead"><p class="qtext">${tx(q.q)}</p><button class="speak" data-say="${esc(q.q)}" aria-label="הקראת השאלה">${SPEAK}</button></div>`) + body;
  }
  if (q.type === "mark") {
    const tools = TOOL_ORDER.map(t => `<button class="tool ${st.tool === t ? "on" : ""}" data-tool="${t}" ${st.locked ? "disabled" : ""}>${TOOLS[t].icon}<span>${tx(TOOLS[t].label)}</span></button>`).join("");
    const sw = st.tool === "color" ? `<div class="swatches">${Object.entries(COLORS).map(([k, c]) => `<button class="sw ${st.color === k ? "on" : ""}" data-color="${k}" style="background:${c.v}" aria-label="${c.name}" title="${c.name}"></button><span class="swl">${tx(c.name)}</span>`).join("")}</div>` : "";
    const pickMsg = st.msg === "pick" ? `<div class="feedback try">${tx("קֹדֶם בּוֹחֲרִים כְּלִי: מָה הַהוֹרָאָה מְבַקֶּשֶׁת לַעֲשׂוֹת?")}</div>`
      : st.msg === "pickColor" ? `<div class="feedback try">${tx("בַּחֲרוּ צֶבַע.")}</div>` : "";
    const canGo = st.marks.length > 0;
    body = `<div class="${wait.trim()}">
        <span class="lbl-s">${tx("בַּחֲרוּ כְּלִי:")}</span>
        <div class="tools" role="toolbar">${tools}${st.locked ? "" : `<button class="tool clear" data-act="clearMarks">${tx("מְחִיקָה")}</button>`}</div>${sw}
        ${pickMsg}
        ${renderBoard(q, st, !st.locked)}
      </div>
      ${st.locked || st.stage !== "do" ? "" : `<div class="row"><button class="btn" data-act="${s.test ? "testnext" : "checkmark"}" ${canGo ? "" : "disabled"}>${s.test ? tx("הַמְשֵׁךְ") : tx("בְּדִיקָה")}</button></div>`}
      ${after}`;
    return tag + renderInstr(q, st) + stageHint(q, st) + body;
  }
  if (q.type === "build") {
    const sent = q.sentence ? `<p class="fill-sent">${q.sentence.split(" ").map(w => `<span class="${st.hint && q.hintWord && w.includes(q.hintWord) ? "sen hl" : ""}">${tx(w)}</span>`).join(" ")}</p>` : "";
    const used = new Set(st.slots);
    const bank = st.bank.map(i => `<button data-bk="${i}" ${used.has(i) || st.locked ? "disabled" : ""}>${esc(q.bank[i])}</button>`).join("");
    const slots = q.word.split("").map((_, k) => {
      const i = st.slots[k];
      return `<button class="sl" data-bs="${k}" ${i === undefined || st.locked ? "disabled" : ""}>${i !== undefined ? esc(q.bank[i]) : ""}</button>`;
    }).join("");
    const full = st.slots.filter(x => x !== undefined).length === q.word.length;
    body = `<div class="${wait.trim()}">${sent}
        <span class="lbl-s">${tx(q.sentence ? "מַחְסַן אוֹתִיּוֹת. גְּעוּ בָּאוֹתִיּוֹת לְפִי הַסֵּדֶר:" : "מַחְסַן הָאוֹתִיּוֹת. גְּעוּ בָּאוֹתִיּוֹת לְפִי הַסֵּדֶר:")}</span>
        <div class="bank">${bank}</div>
        <span class="lbl-s">${tx("הַמִּלָּה שֶׁלִּי:")}</span>
        <div class="slots" dir="rtl">${slots}</div>
      </div>
      ${st.locked || st.stage !== "do" ? "" : `<div class="row"><button class="btn" data-act="${s.test ? "testnext" : "checkbuild"}" ${full ? "" : "disabled"}>${s.test ? tx("הַמְשֵׁךְ") : tx("בְּדִיקָה")}</button></div>`}
      ${after}`;
    return tag + renderInstr(q, st) + stageHint(q, st) + body;
  }
  if (q.type === "punct") {
    const lines = q.lines.map((l, k) => {
      const m = st.pmarks ? (st.pmarks[k] ? " right" : " wrong") : "";
      return `<div class="pline"><span>${tx(l.t)}</span><button class="pslot${m}" data-pu="${k}" ${st.locked ? "disabled" : ""} aria-label="סימן פיסוק">${st.p[k] || ""}</button></div>`;
    }).join("");
    const full = st.p.every(Boolean);
    body = `<div class="${wait.trim()}"><span class="lbl-s">${tx("גְּעוּ בַּמִּשְׁבֶּצֶת כְּדֵי לְהַחְלִיף בֵּין . לְ־?")}</span><div class="plines">${lines}</div></div>
      ${st.locked || st.stage !== "do" ? "" : `<div class="row"><button class="btn" data-act="${s.test ? "testnext" : "checkpunct"}" ${full ? "" : "disabled"}>${s.test ? tx("הַמְשֵׁךְ") : tx("בְּדִיקָה")}</button></div>`}
      ${after}`;
    return tag + renderInstr(q, st) + stageHint(q, st) + body;
  }
  return "";
}

/* boards: words, letters, sentence, columns, scene. Marks are drawn on an SVG overlay. */
const colorOf = (st, id) => { const m = st && st.marks.find(m => m.t === "color" && m.id === id); return m ? COLORS[m.c].v : null; };
function clusters(word) { return word.match(/[א-ת][֑-ׇ]*|[^א-ת]+/g) || []; }
function renderBoard(q, st, live) {
  const b = q.board, marks = st.reveal ? q.expect : st.marks;
  const vm = { marks };
  const bg = id => { const c = colorOf(vm, id); return c ? ` style="background:${c}66;box-shadow:inset 0 0 0 2px ${c}"` : ""; };
  const tgt = (id, inner, cls = "tile") => `<span class="${cls}${st.pending === id ? " pend" : ""}" data-tgt="${id}"${live ? ' role="button" tabindex="0"' : ""}${bg(id)}>${inner}</span>`;
  let inner = "";
  if (b.kind === "words" || b.kind === "letters") inner = `<div class="tiles ${b.kind === "letters" ? "letters" : ""}">${b.items.map((w, k) => tgt("i" + k, b.kind === "letters" ? esc(w) : tx(w))).join("")}</div>`;
  else if (b.kind === "columns") inner = `<div class="cols"><div class="col">${b.a.map((w, k) => tgt("a" + k, tx(w))).join("")}</div><div class="col">${b.b.map((w, k) => tgt("b" + k, tx(w))).join("")}</div></div>`;
  else if (b.kind === "sentence") {
    const words = b.text.split(" ");
    inner = `<p class="sent">${words.map((w, wi) => {
      if (b.unit === "word") return tgt("w" + wi, tx(w));
      let li = 0;
      return `<span class="wd">${clusters(w).map(c => /^[א-ת]/.test(c) ? tgt(`w${wi}l${li++}`, tx(c), "lt") : esc(c)).join("")}</span>`;
    }).join(" ")}</p>`;
  }
  else if (b.kind === "scene") inner = sceneSVG(vm);
  return `<div class="board ${b.kind}${live ? "" : " still"}" id="board">${inner}<svg class="ov" id="ov" aria-hidden="true"></svg></div>`;
}

function sceneSVG(view) {
  const f = (id, def = "#FFFFFF") => colorOf(view, id) || def;
  const K = "#1E2440";
  const ink = `stroke="${K}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
  const thin = `stroke="${K}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
  const P = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  const rays = Array.from({ length: 12 }, (_, k) => { const a = k * Math.PI / 6; return `M${P(530 + 46 * Math.cos(a), 66 + 46 * Math.sin(a))}L${P(530 + 60 * Math.cos(a), 66 + 60 * Math.sin(a))}`; }).join("");
  const cloud = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 0 A20 20 0 0 1 16 -30 A28 28 0 0 1 66 -40 A22 22 0 0 1 102 -18 A18 18 0 0 1 100 0 Z" fill="#FFFFFF" ${ink}/>`;
  const petals = Array.from({ length: 6 }, (_, k) => { const a = k * Math.PI / 3; return `<circle cx="${(566 + 13 * Math.cos(a)).toFixed(1)}" cy="${(258 + 13 * Math.sin(a)).toFixed(1)}" r="9.5" fill="${f("flower")}" ${ink}/>`; }).join("");
  const tufts = [30, 150, 250, 330, 470, 590].map(x => `<path d="M${x - 8} 326 l4 -10 l4 8 l4 -12 l4 14" fill="none" ${thin}/>`).join("");
  return `<svg class="scene-svg" viewBox="0 0 600 345" role="img" aria-label="תמונה: שמש, שני עננים, עץ ועליו ציפור, בית, כלב, ילדה, כדור, ילד ופרח">
    <rect x="0" y="0" width="600" height="400" fill="#FFFFFF"/>
    <path d="M0 324 Q150 314 300 322 T600 320" fill="none" ${ink}/>${tufts}
    ${cloud(196, 92, 1)}${cloud(338, 124, .82)}

    <g data-tgt="sun"><circle cx="530" cy="66" r="64" fill="transparent"/>
      <path d="${rays}" fill="none" ${ink}/><circle cx="530" cy="66" r="38" fill="${f("sun")}" ${ink}/>
      <circle cx="517" cy="60" r="3.5" fill="${K}"/><circle cx="543" cy="60" r="3.5" fill="${K}"/>
      <path d="M516 74 Q530 86 544 74" fill="none" ${thin}/></g>

    <g data-tgt="tree" transform="translate(-6 0)">
      <path d="M78 324 L84 214 L104 214 L110 324 Z" fill="${f("tree")}" ${ink}/>
      <path d="M94 250 L118 230" fill="none" ${ink}/>
      <path d="M40 206 A34 34 0 0 1 30 146 A42 42 0 0 1 72 92 A46 46 0 0 1 144 98 A40 40 0 0 1 166 166 A34 34 0 0 1 130 214 Z" fill="${f("tree")}" ${ink}/>
      <path d="M62 150 q8 -8 16 0 M112 132 q8 -8 16 0 M100 184 q8 -8 16 0" fill="none" ${thin}/></g>

    <g data-tgt="bird" transform="translate(-6 0)"><rect x="60" y="44" width="78" height="54" fill="transparent"/>
      <path d="M84 70 L66 58 L70 76 Z" fill="${f("bird")}" ${ink}/>
      <ellipse cx="96" cy="74" rx="20" ry="14" fill="${f("bird")}" ${ink}/>
      <circle cx="116" cy="60" r="11" fill="${f("bird")}" ${ink}/>
      <path d="M126 57 L137 61 L126 65 Z" fill="#FFB020" ${thin}/>
      <circle cx="119" cy="58" r="2.6" fill="${K}"/>
      <path d="M88 70 Q98 62 106 74" fill="none" ${thin}/>
      <path d="M92 88 v8 M102 88 v8" fill="none" ${thin}/></g>

    <g data-tgt="house">
      <rect x="296" y="154" width="20" height="40" fill="${f("house")}" ${ink}/>
      <rect x="220" y="216" width="130" height="108" fill="${f("house")}" ${ink}/>
      <path d="M204 220 L285 150 L366 220 Z" fill="${f("house")}" ${ink}/>
      <path d="M268 324 V274 A17 17 0 0 1 302 274 V324" fill="#FFFFFF" ${ink}/><circle cx="295" cy="298" r="2.8" fill="${K}"/>
      <rect x="232" y="236" width="30" height="28" fill="#FFFFFF" ${ink}/><path d="M247 236 V264 M232 250 H262" fill="none" ${thin}/>
      <rect x="308" y="236" width="30" height="28" fill="#FFFFFF" ${ink}/><path d="M323 236 V264 M308 250 H338" fill="none" ${thin}/></g>

    <g data-tgt="dog" transform="translate(-6 0)"><rect x="110" y="250" width="110" height="80" fill="transparent"/>
      <path d="M126 290 Q112 282 116 264" fill="none" ${ink}/>
      <rect x="132" y="296" width="10" height="26" rx="4" fill="${f("dog")}" ${ink}/><rect x="168" y="296" width="10" height="26" rx="4" fill="${f("dog")}" ${ink}/>
      <rect x="148" y="298" width="10" height="24" rx="4" fill="${f("dog")}" ${ink}/><rect x="180" y="296" width="10" height="26" rx="4" fill="${f("dog")}" ${ink}/>
      <ellipse cx="156" cy="292" rx="34" ry="16" fill="${f("dog")}" ${ink}/>
      <circle cx="194" cy="270" r="16" fill="${f("dog")}" ${ink}/>
      <ellipse cx="208" cy="277" rx="10" ry="7" fill="${f("dog")}" ${ink}/>
      <circle cx="216" cy="275" r="3.5" fill="${K}"/>
      <circle cx="196" cy="265" r="2.8" fill="${K}"/>
      <ellipse cx="183" cy="270" rx="6" ry="13" fill="${f("dog")}" ${ink} transform="rotate(15 183 270)"/>
      <path d="M180 284 Q190 290 200 286" fill="none" stroke="#E5484D" stroke-width="4" stroke-linecap="round"/></g>

    <g data-tgt="girl"><rect x="370" y="182" width="72" height="146" fill="transparent"/>
      <path d="M396 290 V318 M412 290 V318" fill="none" ${ink}/>
      <ellipse cx="394" cy="320" rx="8" ry="4.5" fill="${K}"/><ellipse cx="414" cy="320" rx="8" ry="4.5" fill="${K}"/>
      <path d="M396 244 L376 272 M412 244 L432 272" fill="none" ${ink}/>
      <path d="M404 236 L374 292 L434 292 Z" fill="${f("girl")}" ${ink}/>
      <circle cx="384" cy="208" r="8" fill="#FFFFFF" ${ink}/><circle cx="424" cy="208" r="8" fill="#FFFFFF" ${ink}/>
      <circle cx="404" cy="214" r="20" fill="#FFFFFF" ${ink}/>
      <path d="M385 208 Q392 190 404 194 Q416 190 423 208 Q412 200 404 202 Q394 200 385 208 Z" fill="${K}"/>
      <circle cx="397" cy="214" r="2.6" fill="${K}"/><circle cx="411" cy="214" r="2.6" fill="${K}"/>
      <path d="M397 223 Q404 229 411 223" fill="none" ${thin}/></g>

    <g data-tgt="ball"><rect x="438" y="288" width="40" height="40" fill="transparent"/>
      <circle cx="458" cy="306" r="17" fill="${f("ball")}" ${ink}/>
      <path d="M458 289 Q448 306 458 323 M458 289 Q468 306 458 323 M441 306 H475" fill="none" ${thin}/></g>

    <g data-tgt="boy"><rect x="484" y="180" width="68" height="148" fill="transparent"/>
      <path d="M509 286 V318 M527 286 V318" fill="none" ${ink}/>
      <ellipse cx="507" cy="320" rx="8" ry="4.5" fill="${K}"/><ellipse cx="529" cy="320" rx="8" ry="4.5" fill="${K}"/>
      <path d="M502 240 L488 270 M534 240 L548 270" fill="none" ${ink}/>
      <rect x="500" y="232" width="36" height="40" rx="8" fill="${f("boy")}" ${ink}/>
      <rect x="502" y="268" width="32" height="20" rx="3" fill="#FFFFFF" ${ink}/><path d="M518 272 V288" fill="none" ${thin}/>
      <circle cx="518" cy="212" r="20" fill="#FFFFFF" ${ink}/>
      <path d="M498 210 Q500 190 518 190 Q536 190 538 210 Q528 200 518 203 Q506 200 498 210 Z" fill="${K}"/>
      <circle cx="511" cy="213" r="2.6" fill="${K}"/><circle cx="525" cy="213" r="2.6" fill="${K}"/>
      <path d="M511 222 Q518 228 525 222" fill="none" ${thin}/></g>

    <g data-tgt="flower"><rect x="544" y="236" width="46" height="90" fill="transparent"/>
      <path d="M566 324 V272" fill="none" ${ink}/>
      <path d="M566 304 Q550 292 546 302 Q554 312 566 306 Z" fill="#FFFFFF" ${ink}/>
      ${petals}<circle cx="566" cy="258" r="8" fill="#FFFFFF" ${ink}/></g>
  </svg>`;
}

/* overlay painter: hand-drawn circle, underline, X and connecting line */
function paintOverlay() {
  const b = $("#board"), ov = $("#ov");
  if (!b || !ov || !run || !run.q) return;
  const q = ST().questions[run.qi], st = run.q;
  const br = b.getBoundingClientRect();
  ov.setAttribute("viewBox", `0 0 ${br.width} ${br.height}`);
  const R = id => { const el = b.querySelector(`[data-tgt="${id}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left - br.left, y: r.top - br.top, w: r.width, h: r.height }; };
  const marks = st.reveal ? q.expect : st.marks;
  let out = "";
  const seed = s => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
  const path = (d, col, extra = "") => `<path d="${d}" fill="none" stroke="${col}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const ellipse = (r, sd, col, extra) => {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rx = r.w / 2 + 8, ry = r.h / 2 + 6, st0 = -0.5 + (sd % 7) * 0.05;
    let d = "";
    for (let a = 0; a <= Math.PI * 2 + 0.45; a += 0.15) {
      const k = 1 + 0.045 * Math.sin(3 * a + sd) + (a > Math.PI * 2 ? 0.06 : 0);
      d += (d ? "L" : "M") + (cx + rx * k * Math.cos(a + st0)).toFixed(1) + " " + (cy + ry * k * Math.sin(a + st0)).toFixed(1);
    }
    return path(d, col, extra);
  };
  const edge = (r, tx_, ty_) => {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, dx = tx_ - cx, dy = ty_ - cy;
    const s = Math.min((r.w / 2 + 4) / Math.abs(dx || 1e-6), (r.h / 2 + 4) / Math.abs(dy || 1e-6));
    return [cx + dx * s, cy + dy * s];
  };
  marks.forEach(m => {
    if (m.t === "color") return;
    const r = R(m.id); if (!r) return;
    const bad = !st.reveal && st.bad && st.bad.includes(mkey(m));
    const col = st.reveal ? "var(--good)" : bad ? "var(--oops)" : "var(--pen)";
    const sd = seed(m.id);
    if (m.t === "circle") out += ellipse(r, sd, col);
    if (m.t === "under") { const y = r.y + r.h + 2; out += path(`M${r.x + r.w + 2} ${y} Q${r.x + r.w / 2} ${y + 4} ${r.x - 2} ${y + 1}`, col); }
    if (m.t === "x") { const i = Math.min(r.w, r.h) * 0.12; out += path(`M${r.x + i} ${r.y + i}L${r.x + r.w - i} ${r.y + r.h - i}M${r.x + r.w - i} ${r.y + i}L${r.x + i} ${r.y + r.h - i}`, col); }
    if (m.t === "line") {
      const r2 = R(m.id2); if (!r2) return;
      const [x1, y1] = edge(r, r2.x + r2.w / 2, r2.y + r2.h / 2), [x2, y2] = edge(r2, r.x + r.w / 2, r.y + r.h / 2);
      out += path(`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`, col) + `<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="4" fill="${col}"/><circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="4" fill="${col}"/>`;
    }
  });
  if (st.pending && !st.reveal) { const r = R(st.pending); if (r) out += ellipse(r, 3, "var(--pen)", 'stroke-dasharray="6 6" opacity=".7"'); }
  ov.innerHTML = out;
}
window.addEventListener("resize", () => requestAnimationFrame(paintOverlay));

function tapTarget(id) {
  const s = ST(), q = s.questions[run.qi], st = run.q;
  if (q.type !== "mark" || st.locked || st.stage !== "do") return;
  st.bad = null; st.msg = null;
  if (!st.tool) { st.msg = "pick"; return draw(); }
  const toggle = m => { const k = mkey(m), i = st.marks.findIndex(x => mkey(x) === k); if (i >= 0) st.marks.splice(i, 1); else st.marks.push(m); };
  if (st.tool === "line") {
    if (!st.pending) st.pending = id;
    else if (st.pending === id) st.pending = null;
    else { toggle({ t: "line", id: st.pending, id2: id }); st.pending = null; }
  } else if (st.tool === "color") {
    if (!st.color) { st.msg = "pickColor"; return draw(); }
    const i = st.marks.findIndex(m => m.t === "color" && m.id === id);
    const same = i >= 0 && st.marks[i].c === st.color;
    if (i >= 0) st.marks.splice(i, 1);
    if (!same) st.marks.push({ t: "color", id, c: st.color });
  } else toggle({ t: st.tool, id });
  draw();
}

function checkMark() {
  const q = ST().questions[run.qi], st = run.q;
  st.tries++; st.pending = null;
  if (markOk(q, st.marks)) { st.locked = true; settle(st.tries === 1); chime(true); }
  else {
    chime(false);
    const exp = new Set(q.expect.map(mkey));
    st.bad = st.marks.map(mkey).filter(k => !exp.has(k));
    st.fbMsg = diagnose(q, st.marks);
    if (st.tries >= 2) { st.locked = true; st.reveal = true; settle(false); }
  }
  draw();
}
function buildWord(q, st) { return st.slots.map(i => q.bank[i]).join(""); }
function checkBuild() {
  const q = ST().questions[run.qi], st = run.q;
  st.tries++;
  if (buildWord(q, st) === q.word) { st.locked = true; settle(st.tries === 1); chime(true); }
  else {
    chime(false); st.hint = true;
    st.fbMsg = q.sentence ? "חַפְּשׂוּ אֶת הַמִּלָּה שֶׁמּוֹפִיעָה שָׁלוֹשׁ פְּעָמִים (סִמַּנְתִּי אוֹתָהּ בַּצָּהֹב), וְהַעְתִּיקוּ אוֹת אַחַר אוֹת." : `רֶמֶז: הָאוֹת הָרִאשׁוֹנָה הִיא ${q.word[0]}.`;
    st.slots = [];
    if (st.tries >= 2) { // show the right word
      const left = st.bank.slice(); st.slots = q.word.split("").map(ch => { const k = left.findIndex(i => q.bank[i] === ch); return left.splice(k, 1)[0]; });
      st.locked = true; settle(false);
    }
  }
  draw();
}
function checkPunct() {
  const q = ST().questions[run.qi], st = run.q;
  st.tries++;
  st.pmarks = q.lines.map((l, k) => st.p[k] === l.a);
  if (st.pmarks.every(Boolean)) { st.locked = true; settle(st.tries === 1); chime(true); }
  else {
    chime(false); st.fbMsg = "מִשְׁפָּט שֶׁשּׁוֹאֵל, נִגְמָר בְּ־?. מִשְׁפָּט שֶׁמְּסַפֵּר, נִגְמָר בְּ־.";
    if (st.tries >= 2) { st.p = q.lines.map(l => l.a); st.pmarks = q.lines.map(() => true); st.locked = true; settle(false); }
  }
  draw();
}

/* ---------- island tasks: pictures of quantities and hands-on number work ---------- */
// every run of a station gets fresh numbers: a template with a maker becomes a concrete question
function liveStation(s) { return { ...s, questions: s.questions.map(q => fixOpts(q.make ? { ...q, ...q.make() } : q)) }; }
const MATH_TYPES = ["pack", "load", "chart"];
const IMGP = n => `img/${n}.webp`;
const HINTS = {
  count: "זִכְרוּ: בְּכָל אַרְגָּז יֵשׁ 10. סִפְרוּ שׁוּב בַּעֲשָׂרוֹת.",
  read: "סִפְרוּ קֹדֶם בַּעֲשָׂרוֹת: עֶשֶׂר, עֶשְׂרִים, שְׁלוֹשִׁים... וְאָז הוֹסִיפוּ אֶת הַבּוֹדְדִים.",
  write: "סִפְרַת הָעֲשָׂרוֹת הִיא מִסְפַּר הָאַרְגָּזִים. סִפְרַת הַיְּחִידוֹת הִיא מִסְפַּר הַבּוֹדְדִים.",
  value: "בִּדְקוּ בְּאֵיזֶה מָקוֹם עוֹמֶדֶת הַסִּפְרָה: עֲשָׂרוֹת אוֹ יְחִידוֹת?",
  compose: "כַּמָּה עֲשָׂרוֹת? כַּמָּה יְחִידוֹת? חַבְּרוּ אוֹתָם.",
  line: "בִּקְפִיצָה שֶׁל 10 רַק סִפְרַת הָעֲשָׂרוֹת מִשְׁתַּנָּה.",
  seq: "בְּכַמָּה גָּדֵל אוֹ קָטֵן כָּל מִסְפָּר עַל הַנָּחָשׁ?",
  compare: "מַשְׁוִים קֹדֶם אֶת סִפְרוֹת הָעֲשָׂרוֹת.",
  hundred: "10 עֲשָׂרוֹת הֵן מֵאָה.",
};

// a full jar of ten fireflies: the drawing when it exists, otherwise an empty jar with ten fireflies inside
const jarHTML = () => `<span class="jarf"><img class="jarb" src="${IMGP("jar")}" alt=""><span class="flies">${`<img src="${IMGP("firefly")}" alt="">`.repeat(10)}</span></span>`;
const coinStack = () => `<span class="cstack">${Array.from({ length: 10 }, (_, i) => `<img src="${IMGP("ui-coin")}" alt="" style="bottom:${i * 3}px">`).join("")}<b>10</b></span>`;
const tenHTML = kind => kind === "firefly" ? jarHTML() : kind === "coin" ? coinStack() : `<img class="crate" src="${IMGP("crate-full")}" alt="">`;
const oneHTML = kind => `<img class="one" src="${IMGP(kind === "coin" ? "ui-coin" : kind)}" alt="">`;

function picHTML(p) {
  if (!p) return "";
  if (p.qty) {
    const [t, o, kind] = p.qty;
    return `<div class="qty" aria-label="תמונה">${t ? `<div class="qty-tens">${Array.from({ length: t }, () => tenHTML(kind)).join("")}</div>` : ""}
      ${o ? `<div class="qty-ones">${Array.from({ length: o }, () => oneHTML(kind)).join("")}</div>` : ""}</div>`;
  }
  if (p.loose) return `<div class="loose">${Array.from({ length: p.loose }, (_, i) => `<img src="${IMGP("coconut")}" alt="" style="--r:${(i * 47) % 30 - 15}deg">`).join("")}</div>`;
  if (p.digits) return `<div class="bignum" dir="ltr">${[...p.digits].map((d, i) => `<span class="${i === p.mark ? "mk" : ""}">${d}</span>`).join("")}</div>`;
  if (p.expr) return `<div class="expr" dir="ltr">${esc(p.expr).replace("?", '<span class="qm">?</span>')}</div>`;
  if (p.cmp) return `<div class="expr cmp" dir="ltr"><span>${p.cmp[0]}</span><span class="qm">?</span><span>${p.cmp[1]}</span></div>`;
  if (p.jump) {
    const [a, step] = p.jump;
    return `<div class="river" dir="ltr"><span class="stone from"><img src="${IMGP("stone")}" alt=""><b>${a}</b><img class="crab" src="${IMGP("crab")}" alt=""></span>
      <span class="hop ${step < 0 ? "back" : ""}">${step > 0 ? "+" : "−"}${Math.abs(step)}</span>
      <span class="stone to"><img src="${IMGP("stone")}" alt=""><b>?</b></span></div>`;
  }
  if (p.snake) {
    const segs = p.snake.map((v, i) => `<span class="seg ${i === p.gap ? "gap" : ""}">${i === p.gap ? "?" : v}</span>`).join("");
    return `<div class="snake" dir="ltr"><span class="seg head" aria-hidden="true"></span>${segs}</div>`;
  }
  return "";
}

/* packing: tap a coconut to put it in the open crate; ten close the crate */
function packHTML(q, st) {
  const pk = st.pk, done = pk.pile + pk.in < 10 && pk.in === 0;
  const shelf = Array.from({ length: pk.packed }, () => `<img src="${IMGP("crate-full")}" alt="">`).join("");
  const inCrate = Array.from({ length: pk.in }, () => `<img src="${IMGP("coconut")}" alt="">`).join("");
  const pile = Array.from({ length: pk.pile }, (_, i) => `<button class="nut" data-pk="1" ${done ? "disabled" : ""} aria-label="קוקוס" style="--r:${(i * 53) % 30 - 15}deg"><img src="${IMGP("coconut")}" alt=""></button>`).join("");
  return `<div class="pack">
    <div class="shelf" aria-label="ארגזים מלאים">${shelf || `<span class="how">${tx("כָּאן יַעַמְדוּ הָאַרְגָּזִים הַמְּלֵאִים")}</span>`}</div>
    ${done ? "" : `<div class="opencrate"><img src="${IMGP("crate")}" alt=""><span class="in">${inCrate}</span><span class="cnt" dir="ltr">${pk.in}/10</span></div>`}
    <div class="pile">${pile}</div>
  </div>`;
}
function packOne() {
  const st = run.q; if (!st || st.locked) return;
  const pk = st.pk;
  if (pk.pile + pk.in < 10 && pk.in === 0) return;
  pk.pile--; pk.in++; sfx("tap");
  if (pk.in === 10) { pk.in = 0; pk.packed++; sfx("coin"); const c = $(".opencrate"); if (c) sparks(c.getBoundingClientRect(), 12); }
  draw();
}

/* the train: crates in the tens wagon, single coconuts in the ones wagon */
function loadHTML(s, q, st) {
  const { t, o } = st.ld;
  const crates = Array.from({ length: t }, () => `<img class="c" src="${IMGP("crate-full")}" alt="">`).join("");
  const nuts = Array.from({ length: o }, () => `<img class="o" src="${IMGP("coconut")}" alt="">`).join("");
  const step = (k, icon) => `<div class="stepper"><button data-ld="${k}-" aria-label="פחות" ${st.locked ? "disabled" : ""}>−</button><img src="${IMGP(icon)}" alt=""><button data-ld="${k}+" aria-label="יותר" ${st.locked ? "disabled" : ""}>+</button></div>`;
  return `<div class="train ${st.leave ? "leave" : ""}" dir="ltr">
      <span class="loco"><img src="${IMGP("locomotive")}" alt=""><b class="sign">${q.n}</b></span>
      <span class="wagon"><span class="load">${crates}</span><img class="w" src="${IMGP("wagon")}" alt=""><span class="plate">${tx("עֲשָׂרוֹת")}</span></span>
      <span class="wagon"><span class="load">${nuts}</span><img class="w" src="${IMGP("wagon")}" alt=""><span class="plate">${tx("יְחִידוֹת")}</span></span>
    </div>
    ${st.locked ? "" : `<div class="steppers" dir="ltr">${step("t", "crate-full")}${step("o", "coconut")}</div>
      ${o >= 10 ? `<div class="row" style="justify-content:center"><button class="btn trade" data-act="trade">${tx("אוֹרְזִים 10 קוֹקוֹסִים בְּאַרְגָּז")}</button></div>` : ""}
      <div class="row"><button class="btn" data-act="${s.test ? "testnext" : "checkload"}">${s.test ? tx("הַמְשֵׁךְ") : tx("יוֹצְאִים לַדֶּרֶךְ!")}</button></div>`}`;
}
function loadStep(k) {
  const st = run.q; if (!st || st.locked) return;
  const v = st.ld, key = k[0], up = k[1] === "+";
  if (key === "t") v.t = Math.max(0, Math.min(9, v.t + (up ? 1 : -1)));
  else v.o = Math.max(0, Math.min(19, v.o + (up ? 1 : -1)));
  st.fbMsg = null; sfx("tap"); draw();
}
function tradeTen() { const v = run.q.ld; if (v.o >= 10 && v.t < 9) { v.o -= 10; v.t++; sfx("coin"); draw(); } }
function checkLoad() {
  const q = ST().questions[run.qi], st = run.q, { t, o } = st.ld, sum = t * 10 + o;
  if (sum === q.n && o < 10) { st.tries++; st.locked = true; st.leave = true; settle(st.tries === 1); chime(true); return draw(); }
  if (sum === q.n) { st.fbMsg = "נָכוֹן בְּסַךְ הַכֹּל! אֲבָל יֵשׁ 10 קוֹקוֹסִים בּוֹדְדִים אוֹ יוֹתֵר. אִרְזוּ אוֹתָם בְּאַרְגָּז."; st.tries = Math.max(st.tries, 1); chime(false); return draw(); }
  st.tries++; chime(false);
  st.fbMsg = `הֶעֱמַסְתֶּם ${sum}. הָרַכֶּבֶת צְרִיכָה ${q.n}: כַּמָּה אַרְגָּזִים? כַּמָּה קוֹקוֹסִים?`;
  if (st.tries >= 2) { st.ld = { t: TENS(q.n), o: ONES(q.n) }; st.locked = true; settle(false); }
  draw();
}

/* the caves: one digit in each place (hundreds, tens, ones) */
const CAVES = ["מֵאוֹת", "עֲשָׂרוֹת", "יְחִידוֹת"];
const chartDigits = q => q.cells === 3 ? [Math.floor(q.n / 100), TENS(q.n % 100), ONES(q.n)] : [TENS(q.n), ONES(q.n)];
const chartOk = (q, d) => chartDigits(q).every((x, i) => d[i] === x);
function chartHTML(s, q, st) {
  const names = CAVES.slice(3 - (q.cells || 2));
  const shown = st.locked && !s.test ? chartDigits(q) : st.cd.d;
  const caves = names.map((nm, i) => `<button class="cave ${!st.locked && st.cd.act === i ? "on" : ""}" data-cv="${i}" ${st.locked ? "disabled" : ""}>
      <span class="door">${shown[i] ?? ""}</span><span class="nm">${tx(nm)}</span></button>`).join("");
  const full = st.cd.d.every(x => x !== null);
  return `${picHTML(q.pic)}<div class="caves" dir="ltr">${caves}</div>
    ${st.locked ? "" : `<div class="pad" dir="ltr">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => `<button data-pd="${d}">${d}</button>`).join("")}</div>
      <div class="row"><button class="btn ghost" data-act="chartDel">${tx("מְחִיקָה")}</button><button class="btn" data-act="${s.test ? "testnext" : "checkchart"}" ${full ? "" : "disabled"}>${s.test ? tx("הַמְשֵׁךְ") : tx("בְּדִיקָה")}</button></div>`}`;
}
function chartDigit(d) {
  const st = run.q; if (!st || st.locked) return;
  const c = st.cd; c.d[c.act] = d; if (c.act < c.d.length - 1) c.act++;
  st.fbMsg = null; sfx("tap"); draw();
}
function chartDel() { const c = run.q.cd; c.d = c.d.map(() => null); c.act = 0; run.q.fbMsg = null; draw(); }
function checkChart() {
  const q = ST().questions[run.qi], st = run.q, d = st.cd.d, want = chartDigits(q);
  st.tries++;
  if (chartOk(q, d)) { st.locked = true; settle(st.tries === 1); chime(true); return draw(); }
  chime(false);
  const cells = want.length;
  st.fbMsg = cells === 2 && d[0] === want[1] && d[1] === want[0] ? "הַסְּפָרוֹת בַּמְּעָרָה הַלֹּא נְכוֹנָה. הָאַרְגָּזִים הֵם הָעֲשָׂרוֹת, וְהֵם בַּמְּעָרָה הַשְּׂמָאלִית."
    : cells === 3 ? "מֵאָה הִיא 10 עֲשָׂרוֹת: 1 בִּמְקוֹם הַמֵּאוֹת, וְאֶפֶס עֲשָׂרוֹת וְאֶפֶס יְחִידוֹת שֶׁנִּשְׁאֲרוּ."
    : d[0] !== want[0] ? "סִפְרוּ שׁוּב אֶת הָעֲשָׂרוֹת: זוֹ הַסִּפְרָה בִּמְעָרַת הָעֲשָׂרוֹת."
    : want[1] === 0 ? "אֵין יְחִידוֹת בּוֹדְדוֹת. אֵיזוֹ סִפְרָה אוֹמֶרֶת \"אֵין\"?" : "סִפְרוּ שׁוּב אֶת הַיְּחִידוֹת הַבּוֹדְדוֹת.";
  if (st.tries >= 2) { st.cd.d = want.slice(); st.locked = true; settle(false); }
  draw();
}

/* the card for the hands-on tasks */
function renderMath(s, q, st) {
  const tag = `<span class="qtag">${tx(SKILLS[q.skill].kid)}</span>`;
  const head = text => `<div class="qhead"><p class="qtext">${tx(text)}</p><button class="speak" data-say="${esc(text)}" aria-label="הקראת השאלה">${SPEAK}</button></div>`;
  const nextBtn = `<button class="btn" data-act="next">${nextLabel(s)}</button>`;
  const after = s.test ? "" : `${feedback(q, st)}${st.locked ? `<div class="row">${nextBtn}</div>` : ""}`;
  if (q.type === "pack") {
    const done = st.pk.pile + st.pk.in < 10 && st.pk.in === 0;
    if (!done) return tag + head(q.q) + packHTML(q, st);
    const opts = st.opts.map((oi, k) => {
      let c = "opt";
      if (st.locked && oi === 0) c += " right"; else if (st.wrongs.includes(oi)) c += " wrong";
      return `<button class="${c}" data-opt="${oi}" ${st.locked || st.wrongs.includes(oi) ? "disabled" : ""}><span class="k">${LETTERS[k]}</span><span>${tx(q.opts[oi])}</span></button>`;
    }).join("");
    return tag + head(q.after) + packHTML(q, st) + `<div class="opts">${opts}</div>` + after;
  }
  if (q.type === "load") return tag + head(q.q) + loadHTML(s, q, st) + after;
  if (q.type === "chart") return tag + head(q.q) + chartHTML(s, q, st) + after;
  return "";
}

/* ---------- comprehension answers ---------- */
function settle(correctFirst) {
  run.res[run.qi] = correctFirst;
  if (correctFirst && !ST().test) { S.coins += COIN_RIGHT; run.coins += COIN_RIGHT; ui.pendingCoins = COIN_RIGHT; save(); }
}

function answerMC(oi) {
  const s = ST(), st = run.q;
  if (s.test) { st.sel = oi; return draw(); }
  st.tries++;
  if (oi === 0) { st.locked = true; settle(st.tries === 1); chime(true); }
  else { st.wrongs.push(oi); st.hint = true; chime(false);
    const q = s.questions[run.qi], v = q.opts[oi];
    st.fbMsg = /^\d+$/.test(v) && q.n !== undefined && ONES(+q.n) && String(swapD(+q.n)) === v ? "הַסְּפָרוֹת הִתְחַלְּפוּ. הָעֲשָׂרוֹת נִכְתָּבוֹת רִאשׁוֹנוֹת, מִשְּׂמֹאל." : null;
    if (st.tries >= 2) { st.locked = true; settle(false); } }
  draw(); revealHint();
}
function checkFind() {
  const s = ST(), q = s.questions[run.qi], st = run.q;
  const sen = textFor(s, q).paras.flat()[st.picked];
  st.tries++;
  if (evMatch(sen, q.ev)) { st.locked = true; st.hint = true; st.picked = null; settle(st.tries === 1); chime(true); }
  else { chime(false); st.picked = null; if (st.tries >= 2) { st.locked = true; st.hint = true; settle(false); } }
  draw();
}
function checkOrder() {
  const q = ST().questions[run.qi], st = run.q;
  st.tries++;
  const marks = st.order.map((it, k) => it === k);
  if (marks.every(Boolean)) { st.locked = true; st.marks = marks; settle(st.tries === 1); chime(true); }
  else if (st.tries >= 2) { st.order = q.items.map((_, k) => k); st.pool = []; st.marks = st.order.map(() => true); st.locked = true; st.hint = true; settle(false); chime(false); }
  else {
    chime(false); st.hint = true;
    // keep the cards that are in place, send the others back to the pool
    const keep = []; st.marks = {};
    st.order.forEach((it, k) => { if (it === k) { keep[k] = it; st.marks[k] = true; } });
    st.pool = shuffle(st.order.filter((it, k) => it !== k));
    st.order = keep;
  }
  draw();
}

function nextQ() {
  const s = ST(), q = s.questions[run.qi], st = run.q;
  if (s.test) {   // store the test answer, score at the end
    if (q.type === "pack") run.ans[run.qi] = st.sel, run.res[run.qi] = st.sel === 0;
    if (isChoice(q)) run.ans[run.qi] = st.sel, run.res[run.qi] = st.sel === 0;
    if (q.type === "order") run.ans[run.qi] = st.order.slice(), run.res[run.qi] = st.order.every((it, k) => it === k);
    if (q.type === "mark") run.res[run.qi] = markOk(q, st.marks);
    if (q.type === "build") run.ans[run.qi] = buildWord(q, st), run.res[run.qi] = buildWord(q, st) === q.word;
    if (q.type === "punct") run.ans[run.qi] = st.p.slice(), run.res[run.qi] = q.lines.every((l, k) => st.p[k] === l.a);
    if (q.type === "load") { const v = st.ld; run.ans[run.qi] = String(v.t * 10 + v.o); run.res[run.qi] = v.t * 10 + v.o === q.n && v.o < 10; }
    if (q.type === "chart") { run.ans[run.qi] = st.cd.d.map(x => x ?? "_").join(""); run.res[run.qi] = chartOk(q, st.cd.d); }
  }
  if (q.type === "open") { run.res[run.qi] = "open"; run.open[q.q] = st.text.trim(); }
  if (run.qi + 1 < s.questions.length) { run.qi++; logReach(); run.q = qStateNew(s.questions[run.qi], s); view = { name: "play" }; draw(); scrollTop(); }
  else finish();
}

/* the child's journey: each time a station is started, how far they got, and whether they finished it (last 40) */
function logStart() {
  if (!Array.isArray(S.log)) S.log = [];
  const prev = S.log[S.log.length - 1], unsent = prev && !prev.d;
  S.log.push({ s: ST().id, t: Date.now(), q: 0, n: ST().questions.length, d: 0 });
  if (S.log.length > 40) S.log = S.log.slice(-40);
  save();
  if (unsent) syncMyProgress();   // the last try was left in the middle: let the teacher see it
}
function curLog() { const e = Array.isArray(S.log) && S.log[S.log.length - 1]; return e && !e.d && e.s === ST().id ? e : null; }
function logReach() { const e = curLog(); if (e) { e.q = Math.max(e.q, run.qi); e.u = Date.now(); save(); } }
function logDone(stars) { const e = curLog(); if (e) { e.q = e.n - 1; e.d = 1; e.st = stars; e.u = Date.now(); } }

function finish() {
  const s = ST();
  const scored = s.questions.map((q, i) => [q, run.res[i]]).filter(([q]) => q.type !== "open");
  const right = scored.filter(([, r]) => r === true).length;
  const stars = starsFor(scored.length ? right / scored.length : 1);
  const prev = S.st[s.id] || {};
  const bonus = COIN_STAR * stars + (s.test ? COIN_RIGHT * right : 0);
  S.coins += bonus; run.coins += bonus;
  run.newSticker = !prev.done; run.goldUp = !!prev.done && (prev.stars || 0) < 3 && stars === 3;
  const day = ymd(today0()); if (!S.days.includes(day)) S.days.push(day);
  ui.fly = { t: run.t, from: run.i }; ui.scrollMe = true;
  S.st[s.id] = {
    done: true, stars: Math.max(stars, prev.stars || 0), last: stars, when: Date.now(),
    first: Object.fromEntries(s.questions.map((q, i) => [i, run.res[i]])),
    open: Object.assign({}, prev.open || {}, run.open),
  };
  logDone(stars); save(); syncMyProgress();
  run.stars = stars; run.right = right; run.scored = scored.length;
  fxQueue.push({ k: "party" });
  view = { name: "summary" }; draw(); scrollTop();
}

function renderSummary() {
  const s = ST(), stars = run.stars, T = TRACKS[run.t];
  const msg = stars === 3 ? "וָואוּ! עֲבוֹדָה מְצֻיֶּנֶת!" : stars === 2 ? "יָפֶה מְאוֹד! עוֹד קְצָת תִּרְגּוּל וְזֶה מֻשְׁלָם." : "הִתְחָלָה טוֹבָה! כְּדַאי לְנַסּוֹת אֶת הַמְּשִׂימָה שׁוּב.";
  const stamp = stars === 3 ? "כָּל הַכָּבוֹד!" : stars === 2 ? "יָפֶה מְאוֹד!" : "מַמְשִׁיכִים!";
  const hasNext = run.i + 1 < T.stations.length;
  let review = "";
  if (s.test) {
    review = `<div class="review">${s.questions.map((q, i) => {
      const r = run.res[i];
      if (q.type === "open") return `<div class="it open"><span class="q">${tx(q.q)}</span><span class="a">${tx("כָּתַבְתָּ:")} ${esc(run.open[q.q] || "")}</span><span class="a">${tx("לְדֻגְמָה:")} ${tx(q.model)}</span></div>`;
      let right = "", mine = "";
      if (isChoice(q)) { right = q.opts[0]; mine = run.ans[i] != null ? q.opts[run.ans[i]] : ""; }
      else if (q.type === "order") { right = q.items.join(" ← "); mine = (run.ans[i] || []).map(k => q.items[k]).join(" ← "); }
      else if (q.type === "build") { right = q.word; mine = run.ans[i] || ""; }
      else if (q.type === "load" || q.type === "chart") { right = String(q.n); mine = run.ans[i] || ""; }
      else if (q.type === "punct") { right = q.lines.map(l => l.t + l.a).join("  "); mine = q.lines.map((l, k) => l.t + ((run.ans[i] || [])[k] || "")).join("  "); }
      const detail = right ? (r ? `<span class="a">✓ ${tx(right)}</span>` : `<span class="a">${tx("עָנִיתָ:")} ${tx(mine)}</span><span class="a"><b>${tx("נָכוֹן:")}</b> ${tx(right)}</span>`)
        : `<span class="a">${r ? "✓ " + tx("בִּצַּעְתָּ בְּדִיּוּק!") : tx("לֹא בְּדִיּוּק. כָּךְ הָיָה צָרִיךְ:")}</span>`;
      return `<div class="it ${r ? "ok" : "miss"}"><span class="q">${i + 1}. ${tx(q.q)}</span>${detail}<span class="a">${tx(q.why)}</span></div>`;
    }).join("")}</div>`;
  }
  return bar() + `<div class="panel summary">
    <h2>${esc(plain(s.title))}</h2>
    <div class="big-stars" aria-label="${stars} כוכבים">${[1, 2, 3].map(k => `<span class="${k <= stars ? "on" : ""}">★</span>`).join("")}</div>
    <div class="earned"><span><img class="ic" src="img/ui-coin.webp" alt=""> +${run.coins}</span></div>
    ${run.newSticker || run.goldUp ? `<div class="new-sticker"><span class="lbl">${tx(run.newSticker ? "מַדְבֵּקָה חֲדָשָׁה לָאַלְבּוֹם!" : "הַמַּדְבֵּקָה שֶׁלְּךָ נַעֲשְׂתָה זְהֻבָּה!")}</span>${stickerHTML(s, { stars }, 0).replace('class="sticker ', 'class="sticker reveal ')}</div>` : ""}
    <div class="stamp">${tx(stamp)}</div>
    <div class="guide" style="text-align:start;max-width:520px"><img class="parrot" src="img/${stars === 3 ? "parrot" : "parrot-think"}.webp" alt="קפטן תוכי"><div class="bubble"><p style="font-family:var(--f-read);font-size:1.15rem;line-height:1.9">${tx(msg)}</p>
      <p>${tx(s.test ? "בִּצַּעְתָּ נָכוֹן" : "עֲנִיתָ נָכוֹן בַּפַּעַם הָרִאשׁוֹנָה עַל")} ${run.right} ${tx("מִתּוֹךְ")} ${run.scored}${tx(s.test ? "." : " שְׁאֵלוֹת.")}</p></div></div>
    ${review}
    <div class="row" style="justify-content:center">
      ${hasNext ? `<button class="btn go" data-act="nextStation">⛵ ${tx("לָאִי הַבָּא")}</button>` : ""}
      <button class="btn ghost" data-act="again">${tx("לְנַסּוֹת שׁוּב")}</button>
      <button class="btn ghost" data-go="home">${tx("לַמַּפָּה")}</button>
    </div>
  </div>`;
}

/* ---------- parents ---------- */
function skillStats() {
  const out = {};
  Object.keys(SKILLS).forEach(k => out[k] = { right: 0, n: 0 });
  ALL.forEach(s => {
    const r = S.st[s.id]; if (!r || !r.first) return;
    s.questions.forEach((q, i) => {
      if (q.type === "open") return;
      if (r.first[i] === true || r.first[i] === false) { out[q.skill].n++; if (r.first[i] === true) out[q.skill].right++; }
    });
  });
  return out;
}

function renderParents() {
  const stats = skillStats();
  const any = Object.values(stats).some(v => v.n);
  const rows = SKILL_ORDER.map(k => {
    const sk = SKILLS[k], v = stats[k];
    const p = v.n ? Math.round(100 * v.right / v.n) : null;
    return `<div class="skill-row"><span>${sk.name}</span><div class="track"><i class="${p === null ? "" : p >= 80 ? "" : p >= 60 ? "mid" : "low"}" style="width:${p || 0}%"></i></div><span class="pct ${p === null ? "na" : ""}">${p === null ? "עוד לא" : p + "%"}</span></div>`;
  }).join("");
  const weakest = Object.entries(stats).filter(([, v]) => v.n >= 3).sort((a, b) => a[1].right / a[1].n - b[1].right / b[1].n)[0];
  return bar() + `<div class="parents">
    <div><h2>פינת ההורים</h2><p style="color:var(--ink-soft)">מה המסע מתרגל, איך לעקוב אחרי ההתקדמות ואיך לעזור בבית ב-10 דקות ביום.</p></div>

    <section>
      <h3>ההתקדמות${S.name ? " של " + esc(S.name) : ""}</h3>
      <p style="color:var(--ink-soft)">אחוז התשובות הנכונות <b>בניסיון הראשון</b>, לפי מיומנות.</p>
      ${rows}
      ${any && weakest && weakest[1].right / weakest[1].n < .8 ? `<p style="margin-top:10px"><b>כדאי לחזק:</b> ${SKILLS[weakest[0]].name}. ${SKILLS[weakest[0]].home}</p>` : ""}
      ${!any ? `<p style="margin-top:10px">עוד אין נתונים. אחרי האי הראשון יופיעו כאן התוצאות.</p>` : ""}
    </section>

    ${ON_SITE ? myCodeParentsHTML() : progressCodeHTML()}

    <section>
      <h3>מה זה המבנה העשרוני, ולמה הוא כל כך חשוב</h3>
      <p>המספרים שלנו בנויים מעשרות ויחידות: <b>10 יחידות הן עשרת אחת</b>, ו-<b>10 עשרות הן מאה</b>. כשילד מבין את זה, 47 הוא לא סתם "ארבע ושבע", אלא 4 עשרות ו-7 יחידות. על ההבנה הזו נשען כל החשבון שאחריה: חיבור וחיסור עם המרה ("פריטה"), מספרים גדולים, כסף ומדידה.</p>
      <p>במסע הילד <b>אורז</b> קוקוסים בארגזים של 10, <b>קורא</b> כמויות של צנצנות ובודדות, <b>בונה</b> מספרים ברכבת, <b>כותב</b> אותם בטבלת עשרות ויחידות, ורק אחר כך עובר לעבודה עם המספר עצמו: ערך הספרה, 10 יותר ו-10 פחות, סדרות, השוואה ופירוק.</p>
    </section>

    <section>
      <h3>הטעויות הנפוצות</h3>
      <ul>
        <li><b>היפוך ספרות:</b> כותבים 74 במקום 47 ("שבע ועוד ארבעים"). העשרות נכתבות ראשונות, משמאל.</li>
        <li><b>שוכחים את האפס:</b> כותבים 6 במקום 60, כי "אין יחידות". ה-0 שומר על המקום של העשרות.</li>
        <li><b>סופרים אחד-אחד:</b> במקום לספור ארגזים בעשרות (עשר, עשרים, שלושים). זה איטי ומוביל לטעויות.</li>
        <li><b>מעבר עשרת:</b> מה בא אחרי 39? ילדים רבים אומרים "30-10". במסלול המספרים יש לזה קפיצות מיוחדות.</li>
        <li><b>השוואה לפי היחידות:</b> "39 גדול מ-41 כי 9 גדול מ-1". הכלל: קודם משווים עשרות.</li>
        <li><b>יותר מ-10 יחידות:</b> 3 עשרות ו-14 יחידות הן 44, ולא 314. מכל 10 יחידות יוצאת עוד עשרת.</li>
      </ul>
    </section>

    ${CFG.message || ALL.some(featured) ? `<section class="week">
      <h3>השבוע בכיתה${CFG.teacher ? " של " + esc(CFG.teacher) : ""}</h3>
      ${CFG.message ? `<p>${esc(CFG.message)}</p>` : ""}
      ${ALL.some(featured) ? `<p><b>משימות השבוע:</b> ${ALL.filter(featured).map(s => plain(s.title)).join(", ")}</p>` : ""}
      ${testDateNow() ? `<p><b>תאריך המבדק:</b> ${fmtDate(testDateNow())}</p>` : ""}
    </section>` : ""}

    <section>
      <h3>משחקים לבית</h3>
      <ul>
        <li><b>אורזים עשרות:</b> 30 עד 60 חפצים קטנים (פסטה, כפתורים, מקלות ארטיק). אורזים כל 10 בכוס או בגומייה, ושואלים: "כמה כוסות? כמה בחוץ? כמה בסך הכול?"</li>
        <li><b>הקופה:</b> מטבעות של 10 ושל 1. "תשלם לי 36 בדיוק." ואחר כך: "אפשר לשלם 36 רק במטבעות של 1? כמה מטבעות זה?"</li>
        <li><b>מעלית מספרים:</b> אומרים מספר, והילד אומר מה יוצא כשעולים קומה (10 יותר) או יורדים קומה (10 פחות).</li>
        <li><b>המספר הגדול:</b> כל אחד שולף שני קלפים (0-9) ובונה את המספר הכי גדול שאפשר. מי ניצח? למה?</li>
        <li><b>ציד מספרים ברחוב:</b> מספרי בתים, קווי אוטובוס, מחירים. "כמה עשרות יש בזה? וכמה יחידות?"</li>
      </ul>
    </section>

    <section>
      <h3>שגרה שבועית מומלצת</h3>
      <p>10 עד 15 דקות ביום מספיקות. עדיף קצר וקבוע מאשר ארוך ופעם בשבוע.</p>
      <div class="ttable"><table class="routine"><tbody>
        <tr><th>ראשון</th><td>אי אחד במסלול העשרות + 5 דקות "אורזים עשרות" עם חפצים</td></tr>
        <tr><th>שני</th><td>אי אחד במסלול המספרים</td></tr>
        <tr><th>שלישי</th><td>משחק "הקופה" עם מטבעות</td></tr>
        <tr><th>רביעי</th><td>חזרה על אי שהיה בו קשה (ראו "כדאי לחזק" למעלה)</td></tr>
        <tr><th>חמישי</th><td>"מעלית מספרים" או "המספר הגדול" בזמן נסיעה</td></tr>
        <tr><th>שישי־שבת</th><td>בלי משימות. ביקור באי של הילד והלבשת הדמות מותרים :)</td></tr>
      </tbody></table></div>
    </section>

    <section>
      <h3>כשקשה או מתסכל</h3>
      <ul><li>לחזור לחפצים אמיתיים: לארוז יחד 10 ולספור את הקבוצות. הידיים עוזרות לראש.</li>
        <li>לעצור אחרי אי אחד, גם אם לא הושלם. אפשר להמשיך מחר.</li>
        <li>לבחור אי שכבר הצליח ולחזור עליו. הצלחה מחזירה ביטחון, והמספרים מתחלפים בכל פעם.</li>
        <li>להקריא את השאלה יחד (כפתור הרמקול), ולבקש מהילד להסביר במילים שלו מה צריך לעשות.</li>
        <li>לשבח את הדרך ולא רק את התוצאה: "ראיתי שספרת את הארגזים בעשרות!"</li></ul>
    </section>

    ${TRACKS.map(tr => `<section>
      <h3>${plain(tr.name)}: מה לומדים בכל אי</h3>
      ${tr.stations.map((s, i) => `<details><summary>אי ${i + 1}: ${plain(s.title)}${done(s) ? " ✓" : ""}</summary><p>${s.parent}</p></details>`).join("")}
    </section>`).join("")}

    <section>
      <h3>המיומנויות ואיך מתרגלים אותן בבית</h3>
      ${SKILL_ORDER.map(k => SKILLS[k]).map(sk => `<details><summary>${sk.name}</summary><p><b>מה זה:</b> ${sk.what}</p><p><b>בבית:</b> ${sk.home}</p><div class="ask">שאלה לשאול: "${sk.ask}"</div></details>`).join("")}
    </section>

    <section>
      <h3>טיפים לעבודה משותפת</h3>
      <ul>
        <li><b>לא לתת תשובות:</b> במקום "זה 47", לשאול "כמה ארגזים יש? וכמה בודדים?"</li>
        <li><b>טעות היא רמז:</b> אחרי טעות המשחק אומר מה בדיוק לא התאים (הספרות התחלפו, חסר 0, צריך לארוז 10). תנו לילד לנסות שוב לבד.</li>
        <li><b>הקראה:</b> כפתור הרמקול מקריא את השאלה. הוא עוזר לילדים שעוד לא קוראים בשטף.</li>
        <li><b>הפרסים במשחק:</b> כל תשובה נכונה בניסיון הראשון נותנת מטבעות, ובהם הילד קונה אביזרים וחיות לדמות שלו. כל אי שמסיימים נותן מדבקה לאלבום. כדאי להתעניין: "מה קנית היום?"</li>
        <li><b>לחזור על איים:</b> אפשר לשחק כל אי שוב. המספרים מתחלפים בכל פעם.</li>
      </ul>
    </section>

    <section>
      <h3>הגדרות</h3>
      <p><label for="testDate"><b>תאריך המבדק</b> (במשחק זה "יום האוצר", עם ספירה לאחור):</label>
        <input type="date" id="testDate" value="${esc(S.testDate)}" style="margin-inline-start:8px;padding:6px 10px;border:2px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink)"></p>
      <div class="danger-zone">
        <button class="btn ghost" data-act="unlockAll">${S.unlockAll ? "נעילת האיים לפי הסדר" : "פתיחת כל האיים"}</button>
        <button class="btn ghost" data-act="askReset">איפוס ההתקדמות</button>
      </div>
      <div id="confirmZone"></div>
    </section>
    <div class="row"><button class="btn" data-go="home">חזרה למסע</button></div>
    ${CREDIT()}
  </div>`;
}

/* ---------- draw + events ---------- */
/* ---------- on the teacher's own site: sign-in screen, student codes, teacher accounts, guide ---------- */
const TTOKEN = "i100-teacher-token";
const ttoken = () => { try { return localStorage.getItem(TTOKEN) || ""; } catch (e) { return ""; } };
async function tapi(path, opts = {}) {
  const res = await fetch("/api/" + path, { method: opts.method || "GET", headers: { "content-type": "application/json", "x-teacher-token": ttoken() }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "teachers/login") { try { localStorage.removeItem(TTOKEN); } catch (e) {} TEACHER = null; }
  if (!res.ok) throw { code: data.error || "http_" + res.status, status: res.status };
  return data;
}
let TEACHER = null, MYSTUDENTS = null;
// a class sign-up link (?join=ABCDE): remembered for this visit, the teacher's name shown on the sign-in screen
const JOIN = (() => { try { const q = new URLSearchParams(location.search).get("join"); if (q) sessionStorage.setItem("gm-join", q.toUpperCase()); return sessionStorage.getItem("gm-join") || ""; } catch (e) { return ""; } })();
let JOIN_TEACHER = null;
if (ON_SITE && /^[A-Z0-9]{5}$/.test(JOIN)) api("class?code=" + JOIN).then(t => { JOIN_TEACHER = t; if (view.name === "welcome") draw(); }).catch(() => {});
function applyStudentInfo(me) {
  if (me && me.cfg) CFG = { ...CFG_DEFAULT, ...me.cfg };
  if (me && me.teacher) S.teacherName = me.teacher.name;
}

/* sign-in screen */
function renderSiteWelcome() {
  const profiles = Object.entries(loadProfiles());
  const pane = ui.wpane || "";
  return `<div class="panel welcome" style="margin-top:12px">
    <div class="brand big">מסע לאי המאה</div>
    <p class="w-sub">${tx("מַסָּע שֶׁל עֲשָׂרוֹת וִיחִידוֹת, עַד 100")}</p>
    ${JOIN_TEACHER ? `<div class="join-banner">${tx("הַהַרְשָׁמָה הִיא לַכִּתָּה שֶׁל")} <b>${esc(JOIN_TEACHER.name)}</b>${JOIN_TEACHER.school ? " · " + esc(JOIN_TEACHER.school) : ""}</div>` : ""}
    ${profiles.length ? `<div class="who-plays"><b>${tx("מִי מְשַׂחֵק עַכְשָׁו?")}</b><div class="roles">${profiles.map(([id, st]) =>
      `<button class="role small" data-login="${esc(id)}"><span class="role-av">${avatarSVG(st.av || {})}</span><b>${esc(st.name || "שַׂחְקָן")}</b><span>${st.code ? "קוד " + esc(st.code) : esc(st.klass || "")}</span></button>`).join("")}</div></div>` : ""}
    <div class="signin">
      <button class="sbtn new" data-role="student"><span class="s-ic">${avatarSVG({ type: "girl", color: "#FFFFFF" })}</span><span><b>${tx("תַּלְמִיד חָדָשׁ")}</b><small>${tx("נִרְשָׁמִים וּמְקַבְּלִים קוֹד")}</small></span></button>
      <button class="sbtn" data-wpane="code"><span class="s-ic big">🔑</span><span><b>${tx("יֵשׁ לִי קוֹד")}</b><small>${tx("מַמְשִׁיכִים מֵאֵיפֹה שֶׁעָצַרְתִּי")}</small></span></button>
      ${pane === "code" ? `<form class="codebox" id="codeForm">
        <label for="kidCode"><b>${tx("הַקּוֹד שֶׁלִּי:")}</b></label>
        <div class="row"><input id="kidCode" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="123456" dir="ltr" autofocus><button class="btn" type="submit">${tx("כְּנִיסָה")}</button></div>
        ${ui.codeErr ? `<p class="feedback try">${tx(ui.codeErr)}</p>` : ""}
      </form>` : ""}
      <button class="sbtn teacher" data-role="teacher"><span class="s-ic big"><img src="img/ui-chest.webp" alt=""></span><span><b>כניסת מורים</b><small>הרשמה, כניסה ומעקב אחרי התלמידים</small></span></button>
    </div>
    <button class="linkbtn" data-go="guide">למורות: איך משתמשים במשחק?</button>
    ${CREDIT()}
  </div>`;
}
// a new student: sign up and get a code (if the site can't be reached, play now and get the code later)
async function registerStudent() {
  if (S.code) return S.code;
  try {
    const r = await api("students/register", { method: "POST", body: { n: S.name || "תַּלְמִיד", k: S.klass || "", join: JOIN } });
    S.code = r.code; if (r.teacher) { S.teacherName = r.teacher.name; S.joined = true; } save(); return r.code;
  }
  catch (e) { return null; }
}
async function siteHelloDone() {
  const n = $("#kidName"), k = $("#kidKlass");
  if (n) S.name = n.value.trim().slice(0, 20);
  if (k) S.klass = k.value.trim().slice(0, 20);
  if (!S.name) { toast("כִּתְבוּ אֶת הַשֵּׁם שֶׁלָּכֶם"); if (n) n.focus(); return; }
  S.av.chosen = true; save();
  const hadCode = !!S.code;
  await registerStudent();
  fxQueue.push({ k: "party" });
  if (hadCode || !S.code) return go("home");
  go("mycode");
}
function renderMyCode() {
  return `<div class="panel mycode">
    <h2>${tx("הַקּוֹד שֶׁלְּךָ")}</h2>
    <div class="bigcode" dir="ltr">${esc(S.code || "")}</div>
    <p>${S.joined ? tx("כְּבָר הִצְטָרַפְתֶּם לַכִּתָּה שֶׁל") + " " + esc(S.teacherName || "") + tx(". הִיא רוֹאָה אֶת הַהִתְקַדְּמוּת שֶׁלָּכֶם, וְאֵין צֹרֶךְ לִשְׁלֹחַ לָהּ אֶת הַקּוֹד.") : tx("שִׁלְחוּ אֶת הַקּוֹד לַמּוֹרָה, כְּדֵי שֶׁהִיא תִּרְאֶה אֶת הַהִתְקַדְּמוּת שֶׁלְּךָ.")}</p>
    <p>${tx("שִׁמְרוּ אוֹתוֹ: בְּמַחְשֵׁב אוֹ בְּטַאבְּלֶט אַחֵר נִכְנָסִים עִם הַקּוֹד, וְהַכֹּל מְחַכֶּה לָכֶם שָׁם.")}</p>
    <div class="row" style="justify-content:center"><button class="btn" data-act="copyMyCode">${tx("הַעְתָּקַת הַקּוֹד")}</button><button class="btn go" data-go="home">⛵ ${tx("לַמַּסָּע!")}</button></div>
    <p class="how">${tx("אֶת הַקּוֹד אֶפְשָׁר לִמְצֹא גַּם אַחַר כָּךְ, בְּגַלְגַּל הַשִּׁנַּיִם לְמַעְלָה וּבְפִנַּת הַהוֹרִים.")}</p>
  </div>`;
}
async function copyText(t, msg) { try { await navigator.clipboard.writeText(t); toast(msg); } catch (e) { toast("סַמְּנוּ אֶת הַקּוֹד וְהַעְתִּיקוּ אוֹתוֹ"); } }
function myCodeParentsHTML() {
  return `<section>
    <h3>הקוד של ${esc(S.name || "הילד")}</h3>
    ${S.code ? `<div class="bigcode small" dir="ltr">${esc(S.code)}</div>
      <p>שלחו את הקוד למורה (למשל בוואטסאפ). אחרי שהיא מוסיפה אותו, היא רואה את ההתקדמות של הילד, וההתקדמות מתעדכנת לבד אחרי כל תחנה.</p>
      <p>הקוד שומר גם את כל המשחק: במכשיר אחר בוחרים "יש לי קוד" במסך הכניסה, וממשיכים מאותה נקודה.</p>
      ${S.teacherName ? `<p><b>המורה שעוקבת:</b> ${esc(S.teacherName)}</p>` : ""}
      <div class="row"><button class="btn" data-act="copyMyCode">העתקת הקוד</button></div>`
      : `<p>עוד אין קוד, כי לא היה חיבור לאינטרנט בהרשמה. הקוד יתקבל לבד בפעם הבאה שיהיה חיבור.</p>`}
  </section>`;
}

/* teacher area */
async function loadTeacher() {
  if (TEACHER || !ttoken() || ui.tLoading) return;
  ui.tLoading = true;
  try { TEACHER = (await tapi("teachers/me")).teacher; } catch (e) { TEACHER = null; }
  ui.tLoading = false; if (view.name === "teacher") draw();
}
async function loadMyStudents() {
  try { MYSTUDENTS = (await tapi("teachers/students")).students; } catch (e) { MYSTUDENTS = MYSTUDENTS || []; ui.tErr = "לא הצלחנו לטעון את התלמידים. בדקו את החיבור."; }
  if (view.name === "teacher" && !ui.typing) draw();
}
// "on the site now" if the game pinged in the last 2 minutes, otherwise the last time the child played, to the minute
function lastSeenHTML(r) {
  const t = Math.max(r.seen || 0, r.t || 0);
  if (!t) return "–";
  const ago = Date.now() - t;
  if (r.seen && Date.now() - r.seen < 150000) return `<span class="online">🟢 באתר עכשיו</span>${r.doing ? ` · ${esc(r.doing)}` : ""}`;
  return fmtWhen(t);
}
function fmtWhen(t) {
  const ago = Date.now() - t, d = new Date(t), hm = `בשעה <bdi>${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}</bdi>`;
  const day = new Date(); day.setHours(0, 0, 0, 0);
  return ago < 3600000 ? `לפני ${Math.max(1, Math.round(ago / 60000))} דק׳` : t >= day.getTime() ? `היום ${hm}` : t >= day.getTime() - 864e5 ? `אתמול ${hm}` : `<bdi>${d.getDate()}/${d.getMonth() + 1}</bdi> ${hm}`;
}

/* one child's journey, opened by tapping the name in the class table */
const STATION_BY_ID = Object.fromEntries(ALL.map(s => [s.id, s]));
const qText = q => String(q.q || q.prompt || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const starsTxt = n => "★".repeat(n) + "☆".repeat(3 - n);
function journeyHTML(r) {
  const st = recordToSt(r), log = Array.isArray(r.log) ? r.log.filter(e => STATION_BY_ID[e.s]) : [];
  const name = esc(r.n || "התלמיד");
  // stations started and not finished: where the child stopped
  const online = r.seen && Date.now() - r.seen < 150000, last = log[log.length - 1];
  const now = online && last && !last.d ? last.s : null;   // the station the child is playing right now isn't "stuck"
  const stuck = [];
  ALL.forEach(s => {
    if (st[s.id] || s.id === now) return;
    const tries = log.filter(e => e.s === s.id);
    if (tries.length) stuck.push({ s, tries: tries.length, far: Math.max(...tries.map(e => e.q || 0)) + 1, last: Math.max(...tries.map(e => e.u || e.t)) });
  });
  const weakSt = ALL.filter(s => st[s.id] && st[s.id].stars === 1);
  const misses = ALL.filter(s => st[s.id]).map(s => ({ s, qs: s.questions.map((q, i) => [q, i]).filter(([q, i]) => st[s.id].first[i] === false) })).filter(x => x.qs.length);
  const tracks = TRACKS.map(T => {
    const nextI = T.stations.findIndex(s => !st[s.id]);
    return `<div class="jtrack"><b>${esc(T.name)}</b><div class="jchips">${T.stations.map((s, i) => {
      const done = st[s.id], stk = stuck.find(x => x.s === s);
      const cls = done ? (done.stars === 3 ? "ok" : done.stars === 2 ? "mid" : "lo") : s.id === now ? "next" : stk ? "stuck" : i === nextI ? "next" : "";
      const tag = done ? starsTxt(done.stars) : s.id === now ? "🟢 משחק עכשיו" : stk ? `⏸ נעצר בשאלה ${stk.far}/${s.questions.length}` : i === nextI ? "▶ הבא בתור" : "";
      return `<span class="jchip ${cls}" title="${esc(s.title)}"><span class="jn">${i + 1}. ${esc(s.title)}</span>${tag ? `<span class="jt">${tag}</span>` : ""}</span>`;
    }).join("")}</div></div>`;
  }).join("");
  const timeline = log.slice(-10).reverse().map(e => {
    const s = STATION_BY_ID[e.s];
    return `<li><span class="how">${fmtWhen(e.u || e.t)}</span> · ${esc(s.title)} · ${e.d ? `סיים ${starsTxt(e.st || 0)}` : e === last && now ? "🟢 משחק עכשיו" : `הפסיק בשאלה ${(e.q || 0) + 1} מתוך ${e.n}`}</li>`;
  }).join("");
  return `<section class="journey" id="journey">
    <div class="jhead"><h3>המסלול של ${name} <span class="kcode">${esc(r.code)}</span></h3><button class="btn ghost mini-btn" data-kid="${esc(r.code)}">סגירה</button></div>
    <p class="how">${r.seen || r.t ? lastSeenHTML(r) : "עוד לא שיחק"}</p>
    ${stuck.length || weakSt.length ? `<div class="jalert"><b>איפה כדאי לעזור:</b><ul>
      ${stuck.map(x => `<li>התחיל את <b>${esc(x.s.title)}</b> ${x.tries === 1 ? "פעם אחת" : x.tries + " פעמים"} ולא סיים. הגיע עד שאלה ${x.far} מתוך ${x.s.questions.length} (${fmtWhen(x.last)}).</li>`).join("")}
      ${weakSt.map(s => `<li>סיים את <b>${esc(s.title)}</b> עם כוכב אחד. כדאי לחזור על התחנה (${SKILLS[s.skill] ? SKILLS[s.skill].name : ""}).</li>`).join("")}
    </ul></div>` : (Object.keys(st).length ? `<p class="feedback good">אין תחנה שנתקע בה. כל הכבוד!</p>` : "")}
    ${tracks}
    ${misses.length ? `<details class="jmiss"><summary>שאלות שטעה בהן בניסיון הראשון (${misses.reduce((n, x) => n + x.qs.length, 0)})</summary>
      ${misses.map(x => `<p><b>${esc(x.s.title)}</b></p><ul>${x.qs.map(([q, i]) => `<li>שאלה ${i + 1}: ${esc(qText(q).slice(0, 110))}${SKILLS[q.skill] ? ` <span class="how">(${SKILLS[q.skill].name})</span>` : ""}</li>`).join("")}</ul>`).join("")}
    </details>` : ""}
    ${timeline ? `<details class="jlog" open><summary>מה עשה לאחרונה</summary><ul>${timeline}</ul></details>` : `<p class="how">יומן הפעילות מתחיל להתמלא מעכשיו, בפעם הבאה שהילד ישחק.</p>`}
  </section>`;
}
// keep the class table fresh while the teacher looks at it
setInterval(() => { if (ON_SITE && view.name === "teacher" && TEACHER && (ui.ttab || "students") === "students" && !ui.typing && !document.hidden) loadMyStudents(); }, 30000);
function renderSiteTeacher() {
  if (ttoken() && !TEACHER) { loadTeacher(); return bar() + `<div class="panel teacher"><h2>אזור המורה</h2><p>מתחברים...</p></div>`; }
  if (!TEACHER) return bar() + teacherAuthHTML();
  if (MYSTUDENTS === null) { MYSTUDENTS = []; loadMyStudents(); }
  const tab = ui.ttab || "students";
  const tabs = [["students", "התלמידים שלי"], ["settings", "הגדרות לכיתה"], ["account", "החשבון שלי"], ["guide", "מדריך"], ...(TEACHER.admin ? [["admin", "ניהול וחיפוש תלמידים"]] : [])];
  return bar() + `<div class="panel teacher">
    <div class="t-head"><h2>שלום ${esc(TEACHER.name)}</h2><span class="how">${esc(TEACHER.school || "")} · שם משתמש: ${esc(TEACHER.user)}</span>
      <button class="btn ghost" data-act="teacherLogout">יציאה</button></div>
    ${ui.recovery ? `<div class="recovery"><b>קוד השחזור שלך: <span dir="ltr" class="kcode big">${esc(ui.recovery)}</span></b>
      <p>אם תשכחי את הסיסמה, בעזרת הקוד הזה תוכלי לבחור סיסמה חדשה. רשמי אותו במקום בטוח. הוא מוצג רק עכשיו.</p>
      <div class="row"><button class="btn ghost" data-act="copyRecovery">העתקה</button><button class="btn" data-act="hideRecovery">שמרתי את הקוד</button></div></div>` : ""}
    <div class="cats ttabs">${tabs.map(([id, nm]) => `<button class="${tab === id ? "on" : ""}" data-ttab="${id}">${nm}</button>`).join("")}</div>
    ${tab === "students" ? myStudentsHTML() : tab === "settings" ? teacherSettingsHTML() : tab === "account" ? accountHTML() : tab === "admin" ? adminHTML() : guideHTML()}
  </div>`;
}
function teacherAuthHTML() {
  if (ui.tmode === "forgot") return `<div class="panel teacher auth">
    <h2>שכחתי סיסמה</h2>
    <p class="how">מזינים את שם המשתמש ואת <b>קוד השחזור</b> שקיבלת בהרשמה (נראה כך: ABCD-EFGH), ובוחרים סיסמה חדשה. אין לך קוד שחזור? פני לנועה קסטרו, והיא תאפס לך את הסיסמה.</p>
    <form id="tResetForm" class="tform">
      <label>שם משתמש<input id="rUser" required maxlength="60" dir="ltr" autocomplete="username"></label>
      <label>קוד שחזור<input id="rCode" required maxlength="12" dir="ltr" autocomplete="off" placeholder="ABCD-EFGH"></label>
      <label>סיסמה חדשה (לפחות 6 תווים)<input id="rPass" type="password" required minlength="6" dir="ltr" autocomplete="new-password"></label>
      <button class="btn go" type="submit">איפוס וכניסה</button>
    </form>
    <p id="authMsg" class="feedback try" ${ui.tAuthMsg ? "" : "hidden"}>${esc(ui.tAuthMsg || "")}</p>
    <p><button class="linkbtn" data-tmode="login">חזרה לכניסה</button></p>
  </div>`;
  const reg = ui.tmode === "register";
  return `<div class="panel teacher auth">
    <h2>${reg ? "הרשמת מורה" : "כניסת מורים"}</h2>
    <p class="how">${reg ? "ההרשמה חינמית. אחרי ההרשמה מוסיפים את הקודים של התלמידים, ורואים רק אותם." : "נכנסים עם שם המשתמש והסיסמה שבחרתן בהרשמה."}</p>
    <form id="tAuthForm" class="tform">
      ${reg ? `<label>שם מלא<input id="tName" required maxlength="60" autocomplete="name"></label>
      <label>בית הספר<input id="tSchool" maxlength="80"></label>` : ""}
      <label>שם משתמש או אימייל<input id="tUser" required maxlength="60" autocomplete="username" dir="ltr"></label>
      <label>סיסמה${reg ? " (לפחות 6 תווים)" : ""}<input id="tPass" type="password" required minlength="${reg ? 6 : 1}" autocomplete="${reg ? "new-password" : "current-password"}" dir="ltr"></label>
      <button class="btn go" type="submit">${reg ? "הרשמה" : "כניסה"}</button>
    </form>
    <p id="authMsg" class="feedback try" ${ui.tAuthMsg ? "" : "hidden"}>${esc(ui.tAuthMsg || "")}</p>
    <p>${reg ? `כבר רשומה? <button class="linkbtn" data-tmode="login">כניסה</button>` : `פעם ראשונה כאן? <button class="linkbtn" data-tmode="register">הרשמת מורה חדשה</button> · <button class="linkbtn" data-tmode="forgot">שכחתי סיסמה</button>`}</p>
    <div class="row"><button class="btn ghost" data-go="guide">איך זה עובד?</button><button class="btn ghost" data-act="toWelcome">חזרה למסך הכניסה</button></div>
  </div>`;
}
async function teacherAuth() {
  const reg = ui.tmode === "register", v = id => ($("#" + id) || {}).value || "";
  const body = { user: v("tUser").trim().toLowerCase(), pass: v("tPass"), ...(reg ? { name: v("tName"), school: v("tSchool") } : {}) };
  if (!/^[a-z0-9._@-]{3,60}$/.test(body.user)) return authMsg("שם המשתמש יכול לכלול אותיות באנגלית, ספרות, נקודה, מקף, קו תחתון ו-@ (לפחות 3 תווים).");
  try {
    const r = await tapi(reg ? "teachers/register" : "teachers/login", { method: "POST", body });
    try { localStorage.setItem(TTOKEN, r.token); } catch (e) {}
    TEACHER = r.teacher; MYSTUDENTS = null; ui.tAuthMsg = ""; ui.draft = null; ui.ttab = reg ? "guide" : "students"; ui.recovery = r.recovery || null;
    if (reg) toast("נרשמת בהצלחה! הנה המדריך הקצר.");
    draw();
  } catch (e) {
    authMsg(e.code === "user_taken" ? "שם המשתמש הזה כבר תפוס. בחרי שם אחר." : e.code === "wrong_login" ? "שם המשתמש או הסיסמה לא נכונים." : e.code === "bad_request" ? "חסרים פרטים. בדקי שמילאת שם וסיסמה של 6 תווים לפחות." : "אין חיבור לשרת. נסי שוב.");
  }
}
// a sign-in error updates only the message, so what the teacher typed stays in the fields
function authMsg(msg) { ui.tAuthMsg = msg; const el = $("#authMsg"); if (el) { el.textContent = msg; el.hidden = false; } else draw(); }
async function teacherReset() {
  const v = id => ($("#" + id) || {}).value || "";
  try {
    const r = await tapi("teachers/reset", { method: "POST", body: { user: v("rUser").trim().toLowerCase(), recovery: v("rCode"), pass: v("rPass") } });
    try { localStorage.setItem(TTOKEN, r.token); } catch (e) {}
    TEACHER = r.teacher; MYSTUDENTS = null; ui.recovery = r.recovery; ui.tmode = "login"; ui.tAuthMsg = ""; ui.ttab = "students";
    toast("הסיסמה עודכנה ונכנסת לחשבון"); draw();
  } catch (e) { authMsg(e.code === "wrong_recovery" ? "שם המשתמש או קוד השחזור לא נכונים." : e.code === "bad_request" ? "הסיסמה החדשה צריכה להיות לפחות 6 תווים." : "אין חיבור לשרת. נסי שוב."); }
}
async function teacherLogout() {
  try { await tapi("teachers/logout", { method: "POST" }); } catch (e) {}
  try { localStorage.removeItem(TTOKEN); } catch (e) {}
  TEACHER = null; MYSTUDENTS = null; ui.draft = null; ui.tmode = "login"; ui.tAuthMsg = ""; view = { name: "welcome" }; draw();
}
function myStudentsHTML() {
  const rows = (MYSTUDENTS || []).map(r => {
    const st = recordToSt(r), stats = skillStatsFor(st);
    const pct = k => stats[k] && stats[k].n ? Math.round(100 * stats[k].right / stats[k].n) : null;
    const weak = SKILL_ORDER.filter(k => k !== "opinion" && stats[k] && stats[k].n >= 3).sort((a, b) => pct(a) - pct(b))[0];
    return { r, doneN: Object.keys(st).length, stars: Object.values(st).reduce((n, x) => n + x.stars, 0), pct, weak: weak && pct(weak) < 70 ? weak : null };
  }).sort((a, b) => (a.r.k || "").localeCompare(b.r.k || "", "he") || (a.r.n || "").localeCompare(b.r.n || "", "he"));
  const classes = [...new Set(rows.map(x => x.r.k).filter(Boolean))], klass = ui.klassFilter || "";
  const shown = rows.filter(x => !klass || x.r.k === klass);
  const avg = k => { const v = shown.map(x => x.pct(k)).filter(p => p !== null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const link = location.origin + "/?join=" + (TEACHER.classCode || "");
  return `<section class="tsec">
    ${TEACHER.classCode ? `<div class="classlink">
      <b>קישור ההרשמה לכיתה שלך</b>
      <p class="how">שלחי את הקישור להורים. ילד שנרשם דרכו מצטרף לרשימה שלך לבד, בלי לשלוח קוד.</p>
      <div class="row"><input id="classLink" readonly value="${esc(link)}" dir="ltr"><button class="btn" data-act="copyClassLink">העתקת הקישור</button></div>
    </div>` : ""}
    <form class="add-code manual" id="createForm">
      <label><b>הוספת תלמיד בלי קוד:</b> כותבים שם וכיתה, והתלמיד מקבל קוד שאת מוסרת לו. הוא נכנס עם "יש לי קוד".</label>
      <div class="row"><input id="newName" maxlength="40" placeholder="שם התלמיד" required><input id="newKlass" maxlength="20" placeholder="כיתה" style="width:7em"><button class="btn" type="submit">יצירת תלמיד</button></div>
      ${ui.createMsg ? `<p class="feedback good">${ui.createMsg}</p>` : ""}
    </form>
    <form class="add-code" id="addCodeForm">
      <label for="addCode"><b>הוספת תלמיד:</b> הקלידי את הקוד שהתלמיד שלח לך (6 ספרות)</label>
      <div class="row"><input id="addCode" inputmode="numeric" maxlength="80" placeholder="123456" dir="ltr" autocomplete="off"><button class="btn" type="submit">הוספה למעקב</button></div>
      ${ui.addMsg ? `<p class="how">${esc(ui.addMsg)}</p>` : ""}
    </form>
    ${ui.tErr ? `<p class="feedback try">${esc(ui.tErr)}</p>` : ""}
    ${classes.length > 1 ? `<div class="row">${["", ...classes].map(c => `<button class="chip klass ${klass === c ? "on" : ""}" data-kf="${esc(c)}">${c ? esc(c) : "כל הכיתות"}</button>`).join("")}</div>` : ""}
    ${(() => { const k = ui.kid && (MYSTUDENTS || []).find(x => x.code === ui.kid); return k ? journeyHTML(k) : ""; })()}
    ${shown.length ? `<p class="how">לחצי על שם של תלמיד כדי לראות את המסלול שלו ואיפה נתקע. אחוז התשובות הנכונות בניסיון הראשון. ירוק 80% ומעלה, צהוב 60% עד 79%, אדום מתחת ל־60%. <button class="linkbtn" data-act="reloadStudents">רענון</button></p>
      <div class="ttable"><table class="cls">
      <thead><tr><th>תלמיד</th><th>כיתה</th><th>תחנות</th><th>⭐</th>${TABLE_SKILLS.map(k => `<th>${SKILLS[k].name}</th>`).join("")}<th>כדאי לחזק</th><th></th></tr></thead>
      <tbody>${shown.map(x => `<tr class="${ui.kid === x.r.code ? "sel" : ""}"><td class="tn"><button class="kidname" data-kid="${esc(x.r.code)}">${esc(x.r.n)}</button> <span class="kcode">${esc(x.r.code)}</span>${x.r.empty && !x.r.seen ? ` <span class="how">עוד לא שיחק</span>` : `<div class="seenline">${lastSeenHTML(x.r)}</div>`}</td><td>${esc(x.r.k || "")}</td>
        <td>${x.doneN}/${ALL.length}</td><td title="מתוך ${x.doneN * 3} אפשריים (עד 3 בכל תחנה)">${x.stars}<span class="of">/${x.doneN * 3}</span></td>${TABLE_SKILLS.map(k => pctCell(x.pct(k))).join("")}
        <td>${x.weak ? SKILLS[x.weak].name : "–"}</td>
        <td><button class="mini" data-untrack="${esc(x.r.code)}" aria-label="הסרה מהמעקב">✕</button></td></tr>`).join("")}</tbody>
      <tfoot><tr><th colspan="4">ממוצע${klass ? " " + esc(klass) : ""}</th>${TABLE_SKILLS.map(k => pctCell(avg(k))).join("")}<th colspan="2"></th></tr></tfoot>
      </table></div>`
      : `<p class="empty-note" style="text-align:start">עוד אין תלמידים במעקב. כשתלמיד נרשם למשחק הוא מקבל קוד של 6 ספרות. בקשי מההורים לשלוח לך אותו, והקלידי אותו כאן.</p>`}
  </section>`;
}
async function createStudent() {
  const n = (($("#newName") || {}).value || "").trim(), k = (($("#newKlass") || {}).value || "").trim();
  if (!n) return;
  try { const r = await tapi("teachers/students/create", { method: "POST", body: { n, k } }); ui.createMsg = `נוצר: <b>${esc(n)}</b>, הקוד שלו <span class="kcode big" dir="ltr">${esc(r.code)}</span>`; await loadMyStudents(); const f = $("#newName"); if (f) f.focus(); }
  catch (e) { ui.createMsg = ""; toast(e.status === 401 ? "צריך להתחבר מחדש" : "היצירה לא הצליחה. נסי שוב."); draw(); }
}
function accountHTML() {
  return `<section class="tsec">
    <h3>החלפת סיסמה</h3>
    <form id="pwForm" class="tform">
      <label>הסיסמה הנוכחית<input id="pwOld" type="password" required dir="ltr" autocomplete="current-password"></label>
      <label>סיסמה חדשה (לפחות 6 תווים)<input id="pwNew" type="password" required minlength="6" dir="ltr" autocomplete="new-password"></label>
      <button class="btn" type="submit">החלפה</button>
    </form>
    ${ui.pwMsg ? `<p class="how">${esc(ui.pwMsg)}</p>` : ""}
    <h3>קוד שחזור</h3>
    <p class="how">קוד השחזור מאפשר לבחור סיסמה חדשה אם שוכחים אותה. יצירת קוד חדש מבטלת את הקוד הקודם.</p>
    <div class="row"><button class="btn ghost" data-act="newRecovery">יצירת קוד שחזור חדש</button></div>
  </section>`;
}
async function changePassword() {
  try { await tapi("teachers/password", { method: "POST", body: { old: $("#pwOld").value, pass: $("#pwNew").value } }); ui.pwMsg = "הסיסמה הוחלפה."; }
  catch (e) { ui.pwMsg = e.code === "wrong_login" ? "הסיסמה הנוכחית לא נכונה." : "ההחלפה לא הצליחה. הסיסמה החדשה צריכה להיות לפחות 6 תווים."; }
  draw();
}
let ADMIN_LIST = null;
function adminHTML() {
  if (ADMIN_LIST === null) { ADMIN_LIST = []; tapi("admin/teachers").then(r => { ADMIN_LIST = r.teachers.sort((a, b) => (b.created || 0) - (a.created || 0)); draw(); }).catch(() => {}); }
  return `<section class="tsec">
    <p class="how">המורות שרשומות באתר. "איפוס סיסמה" יוצר סיסמה זמנית שאת מוסרת למורה. אחרי שהיא נכנסת, היא מחליפה אותה בלשונית "החשבון שלי".</p>
    ${ui.tempPass ? `<p class="feedback good">${ui.tempPass}</p>` : ""}
    <div class="ttable"><table><thead><tr><th>שם</th><th>בית ספר</th><th>שם משתמש</th><th>תלמידים</th><th>נרשמה</th><th></th></tr></thead><tbody>
      ${ADMIN_LIST.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.school)}</td><td dir="ltr">${esc(x.user)}</td><td>${x.students}</td><td>${x.created ? fmtDate(ymd(new Date(x.created))) : ""}</td>
        <td><button class="btn ghost mini-btn" data-reset="${esc(x.user)}">איפוס סיסמה</button></td></tr>`).join("")}
    </tbody></table></div>
  </section>
  <section class="tsec">
    <h3>חיפוש תלמיד</h3>
    <p class="how">כל התלמידים שנרשמו באתר, מכל המורות. אפשר לחפש לפי שם, כיתה או חלק מהקוד, למשל כשמורה לא מצליחה להוסיף קוד.</p>
    <form class="add-code" id="adminFindForm"><div class="row"><input id="adminFind" placeholder="שם התלמיד" autocomplete="off" value="${esc(ui.adminQ || "")}"><button class="btn" type="submit">חיפוש</button></div></form>
    ${ADMIN_KIDS ? (ADMIN_KIDS.students.length ? `<div class="ttable"><table><thead><tr><th>שם</th><th>כיתה</th><th>קוד</th><th>מורה</th><th>נרשם</th><th></th></tr></thead><tbody>
      ${ADMIN_KIDS.students.map(x => `<tr><td>${esc(x.n)}</td><td>${esc(x.k)}</td><td dir="ltr"><b>${esc(x.code)}</b></td><td dir="ltr">${esc(x.teacher || "–")}</td><td>${x.created ? fmtDate(ymd(new Date(x.created))) : ""}</td>
        <td>${(TEACHER.codes || []).includes(x.code) ? `<span class="how">✓ במעקב שלך</span>` : `<button class="btn mini-btn" data-claim="${esc(x.code)}">שיוך אליי</button>`}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="how">לא נמצאו תלמידים${ui.adminQ ? ` בשם "${esc(ui.adminQ)}"` : ""}. רשומים באתר ${ADMIN_KIDS.total} תלמידים.</p>`) : ""}
  </section>`;
}
let ADMIN_KIDS = null;
// admin: add a student found in the search to my own list
async function claimKid(code) {
  try {
    const r = await tapi("teachers/students", { method: "POST", body: { code } });
    TEACHER.codes = [...(TEACHER.codes || []), code];
    (ADMIN_KIDS && ADMIN_KIDS.students || []).forEach(x => { if (x.code === code) x.teacher = TEACHER.user; }); toast(`${r.n} נוסף לתלמידים שלך`);
    loadMyStudents(); draw();
  } catch (e) { toast(e.status === 404 ? "התלמיד לא נמצא" : "השיוך לא הצליח. נסי שוב."); }
}
async function adminFind() {
  ui.adminQ = (($("#adminFind") || {}).value || "").trim();
  try { ADMIN_KIDS = await tapi("admin/students?q=" + encodeURIComponent(ui.adminQ)); } catch (e) { toast("החיפוש לא הצליח"); }
  draw();
}
async function adminReset(user) {
  if (ui.confirmDel !== "reset:" + user) { ui.confirmDel = "reset:" + user; return toast("לחצי שוב כדי לאפס את הסיסמה של " + user); }
  ui.confirmDel = null;
  try { const r = await tapi("admin/reset", { method: "POST", body: { user } }); ui.tempPass = `הסיסמה הזמנית של <b dir="ltr">${esc(user)}</b>: <span class="kcode big" dir="ltr">${esc(r.temp)}</span>`; draw(); }
  catch (e) { toast("האיפוס לא הצליח"); }
}
// a code pasted from a message: "הקוד של דני: 482 913" → "482913"
function codeFrom(raw) {
  const t = String(raw).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) & 15));
  const digits = t.replace(/\D/g, "");
  if (digits.length === 6) return digits;
  const m = t.match(/(?:^|\D)(\d{3}[\s.-]?\d{3})(?!\d)/);
  return m ? m[1].replace(/\D/g, "") : null;
}
async function addTracked() {
  const raw = ($("#addCode") || {}).value || "";
  if (/GM1-/.test(raw)) { ui.addMsg = "זה קוד מהגרסה הישנה של המשחק (שנפתחה דרך claude.ai), לא מהאתר. בקשי מההורים לפתוח את המשחק בכתובת של האתר: שם הילד יקבל קוד של 6 ספרות."; return draw(); }
  const code = codeFrom(raw);
  if (!code) { ui.addMsg = "הקוד הוא 6 ספרות. בדקי שהעתקת את כולו."; return draw(); }
  try { const r = await tapi("teachers/students", { method: "POST", body: { code } }); ui.addMsg = `נוסף: ${r.n}${r.k ? " (" + r.k + ")" : ""}`; const f = $("#addCode"); if (f) f.value = ""; await loadMyStudents(); if (f) f.focus(); }
  catch (e) { ui.addMsg = e.status === 404 ? `לא נמצא תלמיד עם הקוד ${code}. כדאי לבדוק עם ההורים את הספרות, ושהילד משחק באתר עצמו (ולא בקישור אחר). את הקוד הנכון רואים ב"פינת ההורים" במכשיר שבו הילד משחק.` : e.status === 401 ? "צריך להתחבר מחדש." : "ההוספה לא הצליחה. נסי שוב."; draw(); }
}
async function untrack(code) {
  if (ui.confirmDel !== code) { ui.confirmDel = code; return toast("לחצי שוב על ✕ כדי להסיר את התלמיד מהמעקב"); }
  ui.confirmDel = null;
  try { await tapi("teachers/students?code=" + code, { method: "DELETE" }); MYSTUDENTS = MYSTUDENTS.filter(x => x.code !== code); draw(); } catch (e) { toast("ההסרה לא הצליחה"); }
}
function teacherSettingsHTML() {
  if (!ui.draft) ui.draft = { ...CFG_DEFAULT, ...JSON.parse(JSON.stringify(TEACHER.cfg || {})), teacher: TEACHER.name, school: TEACHER.school };
  // the settings form is shared with the claude.ai version; only its save button talks to this site
  const html = renderTeacherSettings();
  return `<p class="how">ההגדרות חלות על כל התלמידים שבמעקב שלך: מה פתוח, מה נפתח באיזה תאריך, משימות השבוע, הודעה ותאריך המבדק.</p>${html}`;
}

/* guide for teachers */
function guideHTML() {
  return `<div class="guide-doc">
    <h3>מה זה המשחק?</h3>
    <p>"מסע לאי המאה" מלמד את המבנה העשרוני עד 100: עשרות ויחידות, ערך הספרה, 10 יותר ו-10 פחות, השוואה וסדרות. יש בו שלושה מסלולים:</p>
    <ul><li><b>מסלול העשרות</b>, מתחילים כאן: אורזים 10 בארגז, קוראים כמויות, בונים מספר ברכבת, כותבים בטבלת עשרות ויחידות, וערך הספרה.</li>
      <li><b>מסלול המספרים</b>: 10 יותר ו-10 פחות, מעבר עשרת, סדרות, השוואה (&lt; &gt; =), סידור ופירוק (47 = 40 + 7).</li>
      <li><b>איי האתגר</b> לתלמידים מתקדמים: יותר מ-10 יחידות, חידות, והדרך למאה.</li></ul>
    <p>כל מסלול בנוי בהדרגה ומסתיים במבדק דמה בלי רמזים. המספרים בכל שאלה מתחלפים בכל משחק, כך שאפשר לחזור על אי בלי לזכור תשובות. על תשובות נכונות התלמידים מקבלים מטבעות, ובהם מלבישים דמות. על כל אי הם מקבלים מדבקה לאלבום.</p>

    <h3>מתחילים: 4 צעדים</h3>
    <ol>
      <li><b>נרשמים כמורה:</b> במסך הכניסה לוחצים "כניסת מורים" ← "הרשמת מורה חדשה", ובוחרים שם משתמש וסיסמה.</li>
      <li><b>שומרים את קוד השחזור</b> שמופיע אחרי ההרשמה. בעזרתו בוחרים סיסמה חדשה אם שוכחים.</li>
      <li><b>מצרפים תלמידים</b>, בדרך שנוחה לכן (בלשונית "התלמידים שלי"):
        <ul><li><b>קישור הכיתה (הכי פשוט):</b> מעתיקים את "קישור ההרשמה לכיתה שלך" ושולחים להורים. ילד שנרשם דרכו מצטרף אליכן לבד.</li>
          <li><b>יצירת תלמיד:</b> כותבים שם וכיתה ומקבלים קוד. מוסרים אותו לילד, והוא נכנס עם "יש לי קוד".</li>
          <li><b>קוד מתלמיד:</b> ילד שנרשם בלי הקישור מקבל קוד ושולח לכן. מקלידים אותו ב"הוספה למעקב".</li></ul></li>
      <li><b>מגדירים מה לומדים:</b> בלשונית "הגדרות לכיתה" קובעים אילו איים פתוחים, מתי נפתחים, מה משימת השבוע, ואת תאריך המבדק. לוחצים "שמירה".</li>
    </ol>

    <h3>מה רואים בטבלה</h3>
    <ul><li><b>איים וכוכבים:</b> כמה איים התלמיד סיים, וכמה כוכבים צבר.</li>
      <li><b>אחוזים לפי מיומנות:</b> אחוז התשובות הנכונות <b>בניסיון הראשון</b>. ירוק 80% ומעלה, צהוב 60% עד 79%, אדום מתחת ל־60%.</li>
      <li><b>כדאי לחזק:</b> המיומנות החלשה ביותר של התלמיד, לעבודה ממוקדת בכיתה או בבית.</li>
      <li><b>שורת הממוצע:</b> מראה איפה הכיתה כולה צריכה חיזוק. אפשר לסנן לפי כיתה.</li>
      <li>לחיצה על שם התלמיד פותחת את המסלול שלו: איפה נעצר, איפה קיבל כוכב אחד, ובאילו שאלות טעה בניסיון הראשון.</li>
      <li>ההתקדמות מתעדכנת לבד אחרי כל אי שהתלמיד מסיים, מכל מכשיר.</li></ul>

    <h3>הגדרות לכיתה</h3>
    <ul><li><b>אי סגור</b> לא מופיע לתלמידים כזמין. כך אפשר לפתוח איים בהדרגה, לפי מה שלמדתן בכיתה.</li>
      <li><b>פתיחה מתאריך:</b> האי נפתח לבד בתאריך שבחרתן.</li>
      <li><b>⭐ משימת השבוע</b> מודגשת במפה ובמסך הבית של התלמיד.</li>
      <li><b>הודעה לתלמידים</b> מופיעה בראש מסך הבית ובפינת ההורים.</li>
      <li><b>תאריך המבדק</b> מופיע לתלמידים כספירה לאחור ל"יום האוצר".</li>
      <li>ההגדרות חלות על כל התלמידים שבמעקב שלך, ורק עליהם.</li></ul>

    <h3>שאלות נפוצות</h3>
    <details><summary>תלמיד שכח את הקוד</summary><p>הקוד מופיע אצלך בטבלה, ליד שם התלמיד. במכשיר של התלמיד הוא מופיע גם בגלגל השיניים ובפינת ההורים.</p></details>
    <details><summary>תלמיד משחק גם בבית וגם בבית הספר</summary><p>במכשיר השני בוחרים "יש לי קוד" במסך הכניסה ומקלידים את הקוד. כל ההתקדמות, הדמות והמטבעות עוברים איתו.</p></details>
    <details><summary>כמה ילדים משחקים באותו מחשב או טאבלט</summary><p>כל ילד לוחץ "יציאה" בגלגל השיניים בסוף המשחק. במסך הכניסה מופיעות הדמויות של כל הילדים שכבר שיחקו במכשיר, ולוחצים על הדמות כדי להמשיך.</p></details>
    <details><summary>אפשר לעקוב אחרי תלמיד עם מורה נוספת?</summary><p>כן. כל מורה מוסיפה את הקוד אצלה ורואה את ההתקדמות. הגדרות הכיתה של התלמיד נקבעות לפי המורה האחרונה שהוסיפה אותו.</p></details>
    <details><summary>מי רואה את הנתונים?</summary><p>רק מורה שיש לה את הקוד של התלמיד והוסיפה אותו. בטבלה מופיעים השם שהתלמיד כתב בהרשמה, הכיתה וההתקדמות במשחק. לא נאסף שום מידע אחר.</p></details>
    <details><summary>שכחתי את הסיסמה</summary><p>בכניסת המורים לוחצים "שכחתי סיסמה", ומזינים את שם המשתמש ואת קוד השחזור. אין קוד שחזור? פנו לנועה קסטרו, והיא תאפס את הסיסמה.</p></details>

    <h3>רעיונות לשימוש בכיתה</h3>
    <ul><li><b>פתיחת שיעור:</b> אי אחד יחד על הלוח החכם. אי הקוקוסים ואי הרכבת מצוינים להדגמה מול הכיתה.</li>
      <li><b>עם חומרים מוחשיים:</b> לפני המשחק, לארוז עם הכיתה מקלות או קוביות בקבוצות של 10. המשחק ממשיך בדיוק את אותה פעולה.</li>
      <li><b>תחנות עבודה:</b> קבוצה קטנה על הטאבלטים בזמן שאת עובדת עם קבוצה אחרת.</li>
      <li><b>שיעורי בית:</b> משימת השבוע (⭐) כמשימה קבועה לבית, 10 עד 15 דקות.</li>
      <li><b>לפני מבחן:</b> לפתוח את המבדקים לדוגמה, ולבדוק בטבלה מי צריך חיזוק ובמה.</li></ul>
  </div>`;
}
function renderGuidePage() {
  return bar() + `<div class="panel teacher"><h2>מדריך למורות</h2>${guideHTML()}
    <div class="row"><button class="btn" data-role="teacher">לכניסת מורים</button><button class="btn ghost" data-act="toWelcome">למסך הכניסה</button></div></div>`;
}

function draw() {
  document.documentElement.style.setProperty("--read-size", [1.35, 1.6, 1.9][S.size - 1] + "rem");
  const R = $("#root"), v = view.name;
  ui.plain = !!(v === "play" && run && ST().noNikud);
  R.innerHTML = v === "welcome" ? (ON_SITE ? renderSiteWelcome() : renderWelcome()) : v === "teacher" ? (ON_SITE ? renderSiteTeacher() : renderTeacher())
    : v === "mycode" ? renderMyCode() : v === "guide" ? renderGuidePage() : v === "hello" ? renderHello() : v === "home" ? renderHome() : v === "intro" ? renderIntro() : v === "play" ? renderPlay()
    : v === "summary" ? renderSummary() : v === "shop" ? renderShop() : v === "album" ? renderAlbum() : renderParents();
  if (v === "play") requestAnimationFrame(paintOverlay);
  if (v === "home") {
    const me = $("#mapMe");
    if (me && ui.fly) {
      ui.fly = null;
      requestAnimationFrame(() => requestAnimationFrame(() => { me.style.left = me.dataset.toLeft + "%"; me.style.top = me.dataset.toTop + "px"; sfx("whoosh"); }));
    }
    if (me && ui.scrollMe) { ui.scrollMe = false; setTimeout(() => { try { me.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" }); } catch (e) {} }, 60); }
  }
  if (fxQueue.length) requestAnimationFrame(runFx);
}
function scrollTop() { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { window.scrollTo(0, 0); } }
function revealHint() {
  const el = document.querySelector(".sen.hl");
  if (el && window.matchMedia("(max-width: 860px)").matches) el.scrollIntoView({ behavior: "smooth", block: "center" });
}
function go(name) { if (name === "album" && view.name !== "album") ui.page = 0; ui.tryOn = null; view = { name }; draw(); scrollTop(); }
function startStation(t, i) { run = { t, i, s: liveStation(TRACKS[t].stations[i]), qi: 0, res: {}, ans: {}, open: {}, q: null, coins: 0 }; view = { name: "intro" }; draw(); scrollTop(); }

document.addEventListener("click", e => {
  const t = e.target.closest("button, [data-sen], [data-tgt], [data-iw]"); if (!t) return;
  const d = t.dataset;
  lastRect = t.getBoundingClientRect();
  if (d.char) { S.av.type = d.char; save(); ui.hop = true; sfx("tap"); sparks(lastRect, 8); return draw(); }
  if (d.suit) { S.av.color = d.suit; save(); ui.hop = true; sfx("tap"); return draw(); }
  if (d.cat) { ui.shopCat = d.cat; sfx("tap"); return draw(); }
  if (d.wear !== undefined) { S.av[d.slot] = null; save(); ui.hop = true; return draw(); }
  if (d.item) {
    const it = SHOP.find(x => x.id === d.item);
    if (S.owned.includes(it.id)) { ui.tryOn = null; S.av[it.slot] = S.av[it.slot] === it.id ? null : it.id; save(); ui.hop = true; sfx("tap"); return draw(); }
    // not bought yet: just try it on
    ui.tryOn = ui.tryOn === it.id ? null : it.id; ui.hop = true; sfx("tap"); return draw();
  }
  if (d.go) return go(d.go);
  if (d.say) return speak(d.say);
  if (d.track !== undefined) { S.track = +d.track; save(); return draw(); }
  if (d.login) return login(d.login);
  if (d.kf !== undefined) { ui.klassFilter = d.kf; return draw(); }
  if (d.delrow) return delRow(d.delrow);
  if (d.untrack) return untrack(d.untrack);
  if (d.kid !== undefined) { ui.kid = ui.kid === d.kid ? "" : d.kid; draw(); const j = $("#journey"); if (j) j.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (d.reset) return adminReset(d.reset);
  if (d.claim) return claimKid(d.claim);
  if (d.wpane) { ui.wpane = ui.wpane === d.wpane ? "" : d.wpane; ui.codeErr = ""; draw(); const f = $("#kidCode"); if (f) f.focus(); return; }
  if (d.tmode) { ui.tmode = d.tmode; ui.tAuthMsg = ""; return draw(); }
  if (d.ttab) { ui.ttab = d.ttab; return draw(); }
  if (d.role) { if (d.role === "teacher") return go("teacher"); view = { name: "hello" }; return draw(); }
  if (d.klass !== undefined) { S.klass = d.klass; save(); sfx("tap"); return draw(); }
  if (d.feat) { const [tt, i] = d.feat.split(":").map(Number); S.track = tt; save(); if (!unlocked(tt, i)) { draw(); return toast("קֹדֶם מְסַיְּמִים אֶת הַתַּחֲנוֹת שֶׁלִּפְנֵי"); } return startStation(tt, i); }
  if (d.station !== undefined) {
    const i = +d.station, tr = S.track || 0;
    if (!unlocked(tr, i)) return toast("קודם מסיימים את התחנה הקודמת");
    return startStation(tr, i);
  }
  if (view.name !== "play" && d.act === undefined) return;
  if (d.pk !== undefined) return packOne();
  if (d.ld) return loadStep(d.ld);
  if (d.pd !== undefined) return chartDigit(+d.pd);
  if (d.cv !== undefined) { run.q.cd.act = +d.cv; return draw(); }
  if (d.sort) { const [k, b] = d.sort.split(":"); run.q.sort[+k] = b; run.q.smarks = null; run.q.fbMsg = null; sfx("tap"); return draw(); }
  if (d.iw !== undefined) return tapInstrWord(+d.iw);
  if (d.tgt !== undefined) return tapTarget(d.tgt);
  if (d.tool) { const st = run.q; st.tool = st.tool === d.tool ? null : d.tool; st.pending = null; st.msg = null; return draw(); }
  if (d.color) { run.q.color = d.color; run.q.msg = null; return draw(); }
  if (d.bk !== undefined) { const st = run.q, q = ST().questions[run.qi]; if (st.slots.length < q.word.length) st.slots.push(+d.bk); st.fbMsg = null; return draw(); }
  if (d.bs !== undefined) { run.q.slots.splice(+d.bs, 1); return draw(); }
  if (d.pu !== undefined) { const st = run.q, k = +d.pu; st.p[k] = st.p[k] === "." ? "?" : "."; if (st.pmarks) st.pmarks = null; return draw(); }
  if (d.opt !== undefined) return answerMC(+d.opt);
  if (d.sen !== undefined) {
    const q = ST().questions[run.qi];
    if (q.type === "find" && !run.q.locked) { run.q.picked = +d.sen; draw(); }
    return;
  }
  if (d.order !== undefined) { const st = run.q, i = +d.order; st.pool = st.pool.filter(x => x !== i); const k = firstEmpty(st.order); st.order[k] = i; if (st.marks) delete st.marks[k]; return draw(); }
  if (d.unorder !== undefined) { const st = run.q, k = +d.unorder; if (st.marks && st.marks[k]) return; st.pool.push(st.order[k]); delete st.order[k]; st.order = compact(st.order, st.marks); return draw(); }
  switch (d.act) {
    case "settings": ui.settings = !ui.settings; return draw();
    case "photo": return takePhoto();
    case "checksort": return checkSort();
    case "writeDone": return writeDone();
    case "saveCfg": return saveConfig();
    case "logout": return logout();
    case "copyMyCode": return copyText(S.code || "", "הַקּוֹד הוֹעְתַּק. אֶפְשָׁר לְהַדְבִּיק וְלִשְׁלֹחַ לַמּוֹרָה.");
    case "teacherLogout": return teacherLogout();
    case "copyClassLink": return copyText(($("#classLink") || {}).value || "", "הקישור הועתק. אפשר להדביק בהודעה להורים.");
    case "copyRecovery": return copyText(ui.recovery || "", "קוד השחזור הועתק");
    case "hideRecovery": ui.recovery = null; return draw();
    case "newRecovery": return tapi("teachers/recovery", { method: "POST" }).then(r => { ui.recovery = r.recovery; draw(); }).catch(() => toast("לא הצליח, נסי שוב"));
    case "reloadStudents": return loadMyStudents();
    case "toWelcome": ui.wpane = ""; view = { name: "welcome" }; return draw();
    case "copyCode": return copyCode();
    case "addCodes": return addCodes();
    case "resetDraft": ui.draft = null; ui.saveMsg = ""; return draw();
    case "cancelTry": ui.tryOn = null; return draw();
    case "buyTry": {
      const it = SHOP.find(x => x.id === ui.tryOn); if (!it) return;
      if (S.coins < it.price) { sfx("oops"); return toast(`חֲסֵרִים עוֹד ${it.price - S.coins} מַטְבְּעוֹת. קָדִימָה לַמְּשִׂימָה הַבָּאָה!`); }
      S.coins -= it.price; S.owned.push(it.id); S.av[it.slot] = it.id; ui.tryOn = null; save(); ui.hop = true; sfx("coin"); draw();
      const st = $(".on-stage"); if (st) sparks(st.getBoundingClientRect(), 22); return toast("קָנִיתָ! זֶה שֶׁלְּךָ.");
    }
    case "pageNext": return turnPage(1);
    case "pagePrev": return turnPage(-1);
    case "helloDone": if (ON_SITE) return siteHelloDone();
    { const n = $("#kidName"); if (n) S.name = n.value.trim().slice(0, 20); S.av.chosen = true; save(); fxQueue.push({ k: "party" }); return go("home"); }
    case "nikud": S.nikud = !S.nikud; save(); return draw();
    case "size": S.size = S.size % 3 + 1; save(); return draw();
    case "sound": S.sound = !S.sound; save(); return draw();
    case "start": run.qi = 0; run.q = qStateNew(ST().questions[0], ST()); logStart(); view = { name: "play" }; draw(); return scrollTop();
    case "next": case "testnext": return nextQ();
    case "checkfind": return checkFind();
    case "trade": return tradeTen();
    case "checkload": return checkLoad();
    case "checkchart": return checkChart();
    case "chartDel": return chartDel();
    case "checkorder": return checkOrder();
    case "checkmark": return checkMark();
    case "checkbuild": return checkBuild();
    case "checkpunct": return checkPunct();
    case "clearMarks": run.q.marks = []; run.q.pending = null; run.q.bad = null; return draw();
    case "openDone": run.q.showModel = true; chime(true); return draw();
    case "nextStation": return startStation(run.t, run.i + 1);
    case "again": return startStation(run.t, run.i);
    case "unlockAll": S.unlockAll = !S.unlockAll; save(); toast(S.unlockAll ? "כל התחנות פתוחות" : "התחנות נפתחות לפי הסדר"); return draw();
    case "askReset":
      $("#confirmZone").innerHTML = `<div class="confirm" style="margin-top:10px"><span>למחוק את כל הכוכבים והתשובות בדפדפן הזה?</span><button class="btn" style="background:var(--oops)" data-act="doReset">כן, למחוק</button><button class="btn ghost" data-act="noReset">ביטול</button></div>`; return;
    case "noReset": $("#confirmZone").innerHTML = ""; return;
    case "doReset": { const keep = { nikud: S.nikud, size: S.size, sound: S.sound, av: { type: S.av.type, color: S.av.color, chosen: true }, name: S.name, testDate: S.testDate }; S = Object.assign(blank(), keep); save(); toast("ההתקדמות אופסה"); return draw(); }
  }
});
// order slots: fill the first empty position; when a card is removed, keep confirmed (green) cards in place
function firstEmpty(arr) { let k = 0; while (arr[k] !== undefined) k++; return k; }
function compact(order, marks) {
  const out = []; const loose = [];
  order.forEach((it, k) => { if (it === undefined) return; if (marks && marks[k]) out[k] = it; else loose.push(it); });
  let k = 0; loose.forEach(it => { while (out[k] !== undefined) k++; out[k] = it; });
  return out;
}
document.addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('[role="button"]:not(button)')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener("change", e => {
  const c = e.target.closest("[data-check]"); if (!c) return;
  const k = +c.dataset.check, st = run.q;
  st.checked = c.checked ? [...st.checked, k] : st.checked.filter(x => x !== k);
});
async function codeLogin(code) {
  code = String(code || "").replace(/\D/g, "");
  if (code.length !== 6) { ui.codeErr = "הַקּוֹד הוּא 6 סְפָרוֹת."; return draw(); }
  try {
    const me = await api("me?code=" + code);
    const prefs = { nikud: S.nikud, size: S.size, sound: S.sound };
    if (me.state && me.state.av && me.state.av.chosen) S = Object.assign(blank(), me.state, prefs, { code });
    else { S = Object.assign(blank(), prefs, { code, name: me.n || "", klass: me.k || "" }); }
    applyStudentInfo(me); save(); ui.codeErr = ""; ui.wpane = "";
    if (S.av.chosen) { view = { name: "home" }; ui.scrollMe = true; draw(); return toast(`בָּרוּךְ שׁוּבְךָ, ${S.name || ""}!`); }
    view = { name: "hello" }; draw(); toast(`שָׁלוֹם ${S.name}! עַכְשָׁו בַּחֲרוּ דְּמוּת.`);
  } catch (e) { ui.codeErr = e.status === 404 ? "הַקּוֹד לֹא נִמְצָא. בִּדְקוּ שֶׁהִקְלַדְתֶּם נָכוֹן." : "אֵין חִבּוּר לָאִינְטֶרְנֶט. נַסּוּ שׁוּב."; draw(); }
}
// tell the site the child is playing (for the teacher's "on the site now"), about once a minute while the game is in view
function heartbeat() {
  if (!ON_SITE || !S.code || document.hidden || view.name === "teacher") return;
  const s = (view.name === "play" || view.name === "intro" || view.name === "summary") && run ? ST() : null;
  const a = s ? s.title + (view.name === "play" ? ` · שאלה ${run.qi + 1} מתוך ${s.questions.length}` : "") : { shop: "חדר ההלבשה", album: "האלבום", parents: "פינת ההורים" }[view.name] || "המפה";
  fetch("/api/seen", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: S.code, a }) }).catch(() => {});
}
if (ON_SITE) { setInterval(heartbeat, 60000); setTimeout(heartbeat, 3000); document.addEventListener("visibilitychange", () => { if (!document.hidden) heartbeat(); else if (S.code && run && curLogSafe()) syncMyProgress(); }); }
function curLogSafe() { try { return view.name === "play" && curLog(); } catch (e) { return null; } }

// a child with a code who played on another device since: take the newer saved game
if (ON_SITE && S.code) api("me?code=" + S.code).then(me => {
  applyStudentInfo(me);
  if (me.state && (me.state.saved || 0) > (S.saved || 0) + 1000) { S = Object.assign(blank(), me.state, { nikud: S.nikud, size: S.size, sound: S.sound, code: S.code }); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  if (view.name !== "play") draw();
}).catch(() => {});

// teacher form fields update the draft settings; nothing is saved until "save and publish"
function cfgInput(e) {
  const el = e.target, val = el.type === "checkbox" ? el.checked : el.value;
  if (el.dataset && el.dataset.cfg) { teacherDraft()[el.dataset.cfg] = val; return true; }
  if (el.dataset && el.dataset.cfgst) { const d = teacherDraft(), [id, k] = el.dataset.cfgst.split(":"); (d.stations[id] = d.stations[id] || {})[k] = val; return true; }
  return false;
}
document.addEventListener("change", cfgInput);
document.addEventListener("focusin", e => { ui.typing = view.name === "teacher" && e.target.matches("input, textarea"); });
document.addEventListener("focusout", () => { ui.typing = false; });
document.addEventListener("input", e => {
  if (cfgInput(e)) return;
  if (e.target.dataset.input === "write") {
    run.q.text = e.target.value;
    const ul = $("#wchecks"); if (ul) ul.innerHTML = checksHTML(writeChecks(ST().questions[run.qi], run.q.text));
    const b = document.querySelector('[data-act="writeDone"]'); if (b) b.disabled = run.q.text.trim().length < 3;
    return;
  }
  if (e.target.id === "kidName") { S.name = e.target.value.trim().slice(0, 20); save(); return; }
  if (e.target.id === "kidKlass") { S.klass = e.target.value.trim().slice(0, 20); save(); return; }
  if (e.target.dataset.input !== "open") return;
  run.q.text = e.target.value;
  const btn = document.querySelector('[data-act="openDone"], [data-act="testnext"]');
  if (btn) btn.disabled = run.q.text.trim().length < 3;
});
document.addEventListener("submit", async e => {
  if (e.target.id === "codeForm") { e.preventDefault(); return codeLogin(($("#kidCode") || {}).value); }
  if (e.target.id === "tAuthForm") { e.preventDefault(); return teacherAuth(); }
  if (e.target.id === "addCodeForm") { e.preventDefault(); return addTracked(); }
  if (e.target.id === "adminFindForm") { e.preventDefault(); return adminFind(); }
  if (e.target.id === "createForm") { e.preventDefault(); return createStudent(); }
  if (e.target.id === "tResetForm") { e.preventDefault(); return teacherReset(); }
  if (e.target.id === "pwForm") { e.preventDefault(); return changePassword(); }
  if (e.target.id === "tloginForm") {
    e.preventDefault();
    const pass = $("#tpass").value;
    try { await api("login", { method: "POST", teacher: true, pass }); try { sessionStorage.setItem(TPASS, pass); } catch (x) {} ui.canEdit = true; ui.loginMsg = ""; }
    catch (x) { ui.loginMsg = x.status === 401 ? "הסיסמה לא נכונה." : x.code === "no_password_set" ? "עוד לא הוגדרה סיסמת מורה באתר." : "אין חיבור לשרת. נסו שוב."; }
    return draw();
  }
}, true);
document.addEventListener("submit", e => {
  if (e.target.id !== "nameForm") return;
  e.preventDefault();
  S.name = $("#kidName").value.trim().slice(0, 20); save(); toast(S.name ? "נעים מאוד, " + S.name + "!" : "השם נמחק");
});
if ("speechSynthesis" in window) { try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => {}; } catch (e) {} }

document.addEventListener("change", e => {
  if (e.target.id !== "testDate") return;
  S.testDate = e.target.value; save(); toast("תאריך המבדק נשמר");
});
makeSky();
if (!S.av.chosen) view = { name: "welcome" };
if (location.hash === "#parents") view = { name: "parents" };
if (location.hash === "#teacher") view = { name: "teacher" };
draw();
