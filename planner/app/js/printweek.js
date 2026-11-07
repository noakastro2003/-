// Builds a printable weekly plan in the same layout as Noa's own PDF:
// a landscape overview grid, a "what to prepare" page, one page per day, and a notes page.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ORDER = ['בוקר', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const lab = l => (l === 'בוקר' ? 'בוקר' : 'שעה ' + l);
const tint = c => `color-mix(in srgb, ${c} 24%, #fff)`;

export function weekPrintHtml(w, { look, dayFull, classSize, name }) {
  const days = w.days.slice().sort((a, b) => a.dow - b.dow);
  const labels = ORDER.filter(l => days.some(d => d.periods.some(p => p.label === l)))
    .concat([...new Set(days.flatMap(d => d.periods.map(p => p.label)))].filter(l => !ORDER.includes(l)));
  const timeOf = l => { for (const d of days) { const p = d.periods.find(x => x.label === l && x.start); if (p) return [p.start, p.end]; } return ['', '']; };
  const subOf = p => p.subtitle.split('·').slice(1).join('·').trim();
  const title = `תכנון ${w.number ? 'שבוע ' + w.number : esc(w.title || 'שבועי')}${w.cls ? ' · ' + esc(w.cls) : ''}`;
  const range = w.range || (days.length ? `${days[0].date || ''}–${days[days.length - 1].date || ''}` : '');
  const used = new Map();
  for (const d of days) for (const p of d.periods) { const L = look(p); used.set(L.n, L.c); }

  // ---- overview grid
  let h = `<section class="pw-pg pw-land">
    <header><h1>${title} · <bdi dir="ltr">${esc(range)}</bdi></h1>${w.title && !/^תכנון|^שבוע/.test(w.title) ? `<p>${esc(w.title)}</p>` : ''}</header>
    <div class="pw-grid" style="--n:${days.length}">
      <div></div>${days.map(d => `<div class="pw-dh">יום ${esc(d.name)}${d.date ? ' · ' + esc(d.date) : ''}</div>`).join('')}
      ${labels.map(l => { const [s, e] = timeOf(l); return `<div class="pw-lh"><b>${lab(l)}</b>${s ? `<small>${esc(s)}–<br>${esc(e)}</small>` : ''}</div>` + days.map(d => {
        const p = d.periods.find(x => x.label === l);
        if (!p) return '<div class="pw-cell pw-empty"></div>';
        const L = look(p);
        return `<div class="pw-cell" style="--c:${L.c};--t:${tint(L.c)}"><b>${esc(p.title)}</b>${subOf(p) ? `<small>${esc(subOf(p))}</small>` : ''}</div>`;
      }).join(''); }).join('')}
    </div>
    <footer class="pw-legend">${[...used].map(([n, c]) => `<span><i style="--c:${c};--t:${tint(c)}"></i>${esc(n)}</span>`).join('')}</footer>
  </section>`;

  // ---- what to prepare
  const prepDays = days.filter(d => (w.prep[d.dow] || []).some(s => s.items.length));
  if (prepDays.length) {
    h += `<section class="pw-pg"><header><h1>מה להכין השבוע</h1><p>${classSize} תלמידים</p></header><div class="pw-cols">
      ${prepDays.map(d => `<div class="pw-box"><h3>יום ${esc(d.name)}${d.date ? ' ' + esc(d.date) : ''}</h3>
        ${(w.prep[d.dow] || []).map(s => `${s.title && s.title !== 'להכין / להביא' ? `<h4>${esc(s.title)}</h4>` : ''}${s.items.map(it => `<div class="pw-ck"><span class="pw-bx"></span><span class="pw-grow ${it.url ? 'pw-lnk' : ''}">${esc(it.text)}</span>${it.period ? `<small>${esc(lab(it.period))}</small>` : ''}</div>`).join('')}`).join('')}
      </div>`).join('')}
    </div></section>`;
  }

  // ---- one page per day
  for (const d of days) {
    if (!d.periods.length) continue;
    const toPrint = (w.prep[d.dow] || []).flatMap(s => s.items).filter(it => /הדפס|מדפסת|שכפול/.test(it.text)).map(it => it.text);
    h += `<section class="pw-pg"><header><h1>יום ${esc(dayFull[d.dow])}${d.date ? ' · ' + esc(d.date) : ''}</h1>${toPrint.length ? `<p class="pw-lnk">להדפיס: ${toPrint.map(esc).join(' · ')}</p>` : ''}</header>
      ${d.periods.map(p => {
        const L = look(p);
        return `<article class="pw-ls" style="--c:${L.c};--t:${tint(L.c)}">
          <div class="pw-tab"><b>${lab(p.label)}</b><small>${esc(p.start)}</small><small>${esc(p.end)}</small></div>
          <div class="pw-body">
            <h2>${esc(p.title)}</h2>
            ${p.subtitle ? `<p class="pw-sub">${esc(p.subtitle)}</p>` : ''}
            ${p.sections.filter(s => s.text || s.label).map(s => `<p class="pw-sec">${s.label ? `<span class="pw-sl">${esc(s.label)}</span> – ` : ''}${esc(s.text)}</p>`).join('')}
            ${p.homework.length ? `<p class="pw-sec"><span class="pw-sl">שיעורי בית</span> – ${p.homework.map(esc).join(' · ')}</p>` : ''}
            ${p.materials.length ? `<div class="pw-mats">${p.materials.map(m => `<span>☐ ${esc(m.text)}</span>`).join('')}</div>` : ''}
            ${p.links.length ? `<p class="pw-links">📎 ${p.links.map(l => esc(l.text)).join(' · ')}</p>` : ''}
          </div>
        </article>`;
      }).join('')}
    </section>`;
  }

  // ---- notes
  if (w.notes && w.notes.length) {
    h += `<section class="pw-pg"><div class="pw-cols">${w.notes.map(n => `<div class="pw-box"><h3>${esc(n.label)}</h3><ul>${String(n.text).split(/\s·\s/).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}</div></section>`;
  }
  return `<div class="pw-pfoot">${name ? esc(name) + ' · ' : ''}${title}</div>${h}`;
}
