// Uploaded files: local storage (IndexedDB), text extraction, and matching a
// file to the lesson it most likely belongs to.

// ---------------------------------------------------------------- IndexedDB
let dbp;
function db() {
  return dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('hakita-files', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('blobs');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
const tx = (mode, fn) => db().then(d => new Promise((res, rej) => {
  const t = d.transaction('blobs', mode); const out = fn(t.objectStore('blobs'));
  t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error);
}));
export const putBlob = (id, blob) => tx('readwrite', s => s.put(blob, id));
export const getBlob = id => tx('readonly', s => s.get(id));
export const delBlob = id => tx('readwrite', s => s.delete(id));

// ---------------------------------------------------------------- text extraction
async function unzip(buf, want) {
  const dv = new DataView(buf), dec = new TextDecoder();
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return [];
  const n = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const out = [];
  for (let i = 0; i < n; i++) {
    const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true);
    const nlen = dv.getUint16(off + 28, true), elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = dec.decode(new Uint8Array(buf, off + 46, nlen));
    off += 46 + nlen + elen + clen;
    if (!want(name)) continue;
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    const data = new Uint8Array(buf, start, csize);
    let bytes = null;
    if (method === 0) bytes = data;
    else if (method === 8 && typeof DecompressionStream !== 'undefined') {
      bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    }
    if (bytes) out.push({ name, text: dec.decode(bytes) });
  }
  return out;
}
const xmlText = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'g'))].map(m => m[1]).join(' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

export async function extractText(file, pdfjs) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  try {
    if (ext === 'pdf' || file.type === 'application/pdf') {
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      let t = '';
      for (let i = 1; i <= Math.min(3, doc.numPages); i++) t += ' ' + (await (await doc.getPage(i)).getTextContent()).items.map(x => x.str).join(' ');
      return t.slice(0, 5000);
    }
    if (ext === 'pptx' || ext === 'docx' || ext === 'xlsx') {
      const re = ext === 'pptx' ? /^ppt\/slides\/slide\d+\.xml$|^docProps\/core\.xml$/ : ext === 'docx' ? /^word\/document\.xml$|^docProps\/core\.xml$/ : /^xl\/sharedStrings\.xml$/;
      const parts = await unzip(await file.arrayBuffer(), n => re.test(n));
      parts.sort((a, b) => (parseInt(a.name.replace(/\D/g, '')) || 0) - (parseInt(b.name.replace(/\D/g, '')) || 0));
      const tag = ext === 'pptx' ? 'a:t' : ext === 'docx' ? 'w:t' : 't';
      return parts.map(p => /core\.xml$/.test(p.name) ? xmlText(p.text, 'dc:title') : xmlText(p.text, tag)).join(' ').slice(0, 5000);
    }
    if (/^text\//.test(file.type) || ext === 'txt') return (await file.text()).slice(0, 5000);
  } catch (e) { console.warn('extract', e); }
  return '';
}

// ---------------------------------------------------------------- matching
const NIQ = /[֑-ׇ]/g;
export const norm = s => (s || '').replace(NIQ, '').replace(/[״"׳'`]/g, '')
  .replace(/[_\-–—.,:;!?()[\]{}/\\|+·•○△☆×=<>%@#&*~^]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const STOP = new Set(['של', 'את', 'עם', 'על', 'אל', 'זה', 'זו', 'גם', 'או', 'כי', 'לא', 'יש', 'הוא', 'היא', 'מה', 'מי', 'דף', 'מורה', 'שבוע',
  'יום', 'שעה', 'קובץ', 'pdf', 'pptx', 'ppt', 'docx', 'doc', 'xlsx', 'copy', 'עותק', 'כל', 'אחד', 'אחת', 'עמ', 'שלי', 'שלנו', 'img', 'image', 'scan', 'final', 'new']);
const stem = t => { let x = t; for (let i = 0; i < 2 && x.length > 3 && 'והבלמשכ'.includes(x[0]); i++) x = x.slice(1); return x; };
export const toks = s => norm(s).split(' ').filter(t => t.length >= 2 || /^\d$/.test(t)).filter(t => !STOP.has(t)).map(stem);

// weeks: [{id, days:[{dow, name, periods:[...]}]}]; returns best lessons for a file
export function matchLessons(name, text, weeks, activeId) {
  const base = name.replace(/\.[^.]+$/, '');
  const lessons = [];
  for (const w of weeks) for (const d of w.days) for (const p of d.periods) {
    const fields = [
      [p.title, 3], [p.subtitle, 2], ...p.links.map(l => [l.text, 4]), ...p.materials.map(m => [m.text, 1.5]),
      ...p.homework.map(h => [h, 1]), ...p.sections.map(s => [s.text, 0.6]),
    ];
    const tw = new Map();
    for (const [txt, wt] of fields) for (const t of toks(txt)) tw.set(t, Math.max(tw.get(t) || 0, wt));
    lessons.push({ w, d, p, tw });
  }
  if (!lessons.length) return [];
  const df = new Map();
  for (const L of lessons) for (const t of L.tw.keys()) df.set(t, (df.get(t) || 0) + 1);
  const N = lessons.length;
  const idf = t => Math.log(1 + N / (df.get(t) || N));
  const nameT = [...new Set(toks(base))], textT = [...new Set(toks(text))];
  const nb = norm(base);
  const res = lessons.map(L => {
    let score = 0; const hits = [];
    for (const t of nameT) if (L.tw.has(t)) { score += 2 * L.tw.get(t) * idf(t); hits.push(t); }
    for (const t of textT) if (L.tw.has(t)) { score += 0.5 * L.tw.get(t) * idf(t); if (hits.length < 6 && !hits.includes(t)) hits.push(t); }
    let linkIdx = -1;
    L.p.links.forEach((l, i) => {
      const nl = norm(l.text).replace(/\b(pptx|pdf|docx)\b/g, '').trim();
      if (nl && nb && (nl === nb || (nb.length > 4 && nl.includes(nb)) || (nl.length > 4 && nb.includes(nl)))) { score += 40; linkIdx = i; }
    });
    if (L.w.id === activeId) score *= 1.15;
    return { weekId: L.w.id, dow: L.d.dow, dayName: L.d.name, label: L.p.label, title: L.p.title, score, linkIdx, hits };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
  if (res.length) {
    const [a, b] = res;
    res[0].conf = a.score >= 40 || (a.score >= 6 && (!b || a.score >= b.score * 1.35)) ? 'high' : a.score >= 3 ? 'mid' : 'low';
  }
  return res.slice(0, 5);
}

export const fmtSize = n => n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
export function kindOf(name, type) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (/pptx?|key|odp/.test(ext)) return 'ppt';
  if (ext === 'pdf' || type === 'application/pdf') return 'pdf';
  if (/xlsx?|csv|numbers/.test(ext)) return 'sheet';
  if (/^image\//.test(type) || /png|jpe?g|heic|gif|webp/.test(ext)) return 'img';
  return 'doc';
}
