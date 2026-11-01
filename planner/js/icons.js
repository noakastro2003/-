// Line icons (24×24, stroke = currentColor) + small colourful illustrations.
const P = {
  home: '<path d="M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M12 13.2l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z" stroke-width="1.3"/>',
  check: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M8 12.3l2.8 2.8L16.2 9"/>',
  folder: '<path d="M3.5 7.2A2.2 2.2 0 0 1 5.7 5h3.6l2.2 2.5h6.8a2.2 2.2 0 0 1 2.2 2.2v8.1a2.2 2.2 0 0 1-2.2 2.2H5.7a2.2 2.2 0 0 1-2.2-2.2z"/>',
  dots: '<circle cx="5.5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor"/>',
  bell: '<path d="M6.2 10a5.8 5.8 0 0 1 11.6 0c0 4.8 2 6.5 2 6.5H4.2s2-1.7 2-6.5z"/><path d="M10 19.5a2.1 2.1 0 0 0 4 0"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  alarm: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5M4 5.5 6.5 3M20 5.5 17.5 3"/>',
  printer: '<path d="M7 8.5V3.5h10v5"/><rect x="3.5" y="8.5" width="17" height="8.5" rx="2.5"/><rect x="7" y="13.5" width="10" height="7" rx="1.2"/><path d="M17 11.3h.01"/>',
  backpack: '<path d="M6 10a6 6 0 0 1 12 0v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9.5 4.5V3.5h5v1M9 14.5h6v3H9z"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.8l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z"/>',
  starFill: '<path d="M12 3.5l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.8l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z" fill="currentColor"/>',
  book: '<path d="M12 6.8C10 5.2 7 4.6 3.5 5v13.2c3.5-.4 6.5.2 8.5 1.8 2-1.6 5-2.2 8.5-1.8V5C17 4.6 14 5.2 12 6.8z"/><path d="M12 6.8V20"/>',
  calc: '<rect x="4.5" y="3" width="15" height="18" rx="3.2"/><rect x="7.8" y="6.3" width="8.4" height="3.4" rx="1"/><path d="M8.5 13.2h.01M12 13.2h.01M15.5 13.2h.01M8.5 16.8h.01M12 16.8h.01M15.5 16.8h.01" stroke-width="2.4"/>',
  flask: '<path d="M9 3.5h6M10 3.5v5.8L4.8 18.2A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.8L14 9.3V3.5"/><path d="M7.3 15h9.4"/>',
  user: '<circle cx="12" cy="8.2" r="3.8"/><path d="M4.8 20.5c.9-3.8 3.7-5.8 7.2-5.8s6.3 2 7.2 5.8"/>',
  users: '<circle cx="9" cy="8.5" r="3.3"/><path d="M2.8 20c.8-3.4 3.2-5.3 6.2-5.3s5.4 1.9 6.2 5.3"/><circle cx="17" cy="9.3" r="2.6"/><path d="M16.6 14.6c2.4 0 4 1.6 4.6 4.4"/>',
  pencil: '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M13.5 7l3 3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/>',
  moon: '<path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1z"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.6 1.6M9.5 2.8h5"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/>',
  cake: '<path d="M4.5 20.5h15v-6.8a2.2 2.2 0 0 0-2.2-2.2H6.7a2.2 2.2 0 0 0-2.2 2.2z"/><path d="M4.5 15.6c1.8 1.3 3.6 1.3 5 0 1.4 1.3 3.6 1.3 5 0 1.4 1.3 3.2 1.3 5 0M12 11.5V8.5"/><path d="M12 6.2c.9-.8.9-1.8 0-2.7-.9.9-.9 1.9 0 2.7z"/>',
  pin: '<path d="M12 20.8s-6.3-5.6-6.3-10.6a6.3 6.3 0 0 1 12.6 0c0 5-6.3 10.6-6.3 10.6z"/><circle cx="12" cy="10.2" r="2.3"/>',
  chart: '<path d="M4 20.5h16M7 17v-5M12 17V6.5M17 17v-8"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  layers: '<path d="M12 3.5 20.5 8 12 12.5 3.5 8z"/><path d="M3.5 12.2 12 16.7l8.5-4.5M3.5 16.2 12 20.7l8.5-4.5"/>',
  flag: '<path d="M5.5 21V4M5.5 4.5c4-2 7 2 13 0v8c-6 2-9-2-13 0"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  chevL: '<path d="M14.5 6 8.5 12l6 6"/>',
  chevR: '<path d="M9.5 6l6 6-6 6"/>',
  chevD: '<path d="M6 9.5l6 6 6-6"/>',
  ff: '<path d="M12.5 6 5 12l7.5 6zM20 6l-7.5 6L20 18z" fill="currentColor"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>',
  upload: '<path d="M12 15.5V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="3"/><path d="M10.5 18.3h3"/>',
  sparkle: '<path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z"/>',
  link: '<path d="M10 14a4.4 4.4 0 0 0 6.3 0l3-3A4.4 4.4 0 0 0 13 4.7l-1 1"/><path d="M14 10a4.4 4.4 0 0 0-6.3 0l-3 3A4.4 4.4 0 0 0 11 19.3l1-1"/>',
  file: '<path d="M6.5 3h7.5l5 5v11.3a1.7 1.7 0 0 1-1.7 1.7H6.5a1.7 1.7 0 0 1-1.7-1.7V4.7A1.7 1.7 0 0 1 6.5 3z"/><path d="M14 3v5h5M8.5 13h7M8.5 16.5h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pause: '<path d="M8 5.5v13M16 5.5v13" stroke-width="3"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.3A1.8 1.8 0 0 0 9.2 21h5.6a1.8 1.8 0 0 0 1.8-1.7L17.5 7"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  text: '<path d="M5 6.5V5h14v1.5M12 5v14M9.5 19h5"/>',
  homework: '<path d="M6.5 3h11A1.5 1.5 0 0 1 19 4.5v15A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3z"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4"/>',
};

export function ic(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.sparkle}</svg>`;
}

// ---------------------------------------------------------------- illustrations
const O = '#4A3A66';
const S = `stroke="${O}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;

const ART = {
  books: `<svg viewBox="0 0 120 96">
    <rect x="12" y="62" width="96" height="22" rx="6" fill="#F6B7CF" ${S}/><path d="M22 68h76" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>
    <rect x="20" y="40" width="84" height="22" rx="6" fill="#9DB4F2" ${S}/><path d="M30 46h64" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>
    <rect x="16" y="18" width="80" height="22" rx="6" fill="#B8D88E" ${S}/><path d="M26 24h60" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/></svg>`,
  star: `<svg viewBox="0 0 100 100"><path d="M50 8l12 25 27 4-20 19 5 27-24-13-24 13 5-27-20-19 27-4z" fill="#FFD66B" ${S}/>
    <path d="M40 50q3-3 6 0M54 50q3-3 6 0M43 60q7 6 14 0" fill="none" ${S}/><ellipse cx="36" cy="58" rx="4" ry="2.5" fill="#F7A6B9"/><ellipse cx="64" cy="58" rx="4" ry="2.5" fill="#F7A6B9"/></svg>`,
  heart: `<svg viewBox="0 0 100 100"><path d="M50 86S12 64 12 36a19 19 0 0 1 38-6 19 19 0 0 1 38 6c0 28-38 50-38 50z" fill="#F6B7CF" ${S}/><path d="M28 34a9 9 0 0 1 9-8" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`,
  notepad: `<svg viewBox="0 0 120 120"><rect x="18" y="20" width="72" height="88" rx="10" fill="#FFF8E6" ${S}/>
    ${[30, 42, 54, 66, 78].map(x => `<path d="M${x} 12v16" ${S} fill="none"/>`).join('')}
    ${[44, 62, 80].map(y => `<path d="M30 ${y}l5 5 9-10" fill="none" stroke="#7BC67E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M52 ${y + 2}h26" stroke="#C9BCE0" stroke-width="4" stroke-linecap="round"/>`).join('')}
    <path d="M96 40l12 8-30 46-14 6 2-15z" fill="#C3A6F5" ${S}/><path d="M66 85l12 8" ${S}/></svg>`,
  folder: `<svg viewBox="0 0 130 110"><rect x="30" y="14" width="56" height="64" rx="6" fill="#FFF3C9" ${S} transform="rotate(-8 58 46)"/><rect x="40" y="10" width="56" height="64" rx="6" fill="#fff" ${S}/>
    <path d="M50 26h36M50 36h36M50 46h24" stroke="#C9BCE0" stroke-width="4" stroke-linecap="round"/>
    <path d="M12 44a8 8 0 0 1 8-8h26l8 8h52a8 8 0 0 1 8 8v40a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8z" fill="#C3A6F5" ${S}/>
    <path d="M58 62l8-14h12l8 14z" fill="#FFD66B"/><path d="M58 62h28l-6 10H64z" fill="#7BB6F2"/><path d="M66 48l-8 14 6 10 8-14z" fill="#7BC67E"/></svg>`,
  medal: `<svg viewBox="0 0 100 110"><path d="M30 60 20 98l14-6 8 12 8-30M70 60l10 38-14-6-8 12-8-30" fill="#B79AF7" ${S}/>
    <circle cx="50" cy="46" r="30" fill="#F6D38A" ${S}/><circle cx="50" cy="46" r="20" fill="#FBE3A6" stroke="${O}" stroke-width="2"/>
    <path d="M50 33l4 9 10 1-7.5 7 2 10-8.5-5-8.5 5 2-10-7.5-7 10-1z" fill="#F2B84B" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  sunrise: `<svg viewBox="0 0 360 90" preserveAspectRatio="none"><circle cx="180" cy="80" r="34" fill="#FBCB7A"/>
    ${[-60, -35, -12, 12, 35, 60].map(a => `<path d="M${180 + Math.sin(a * Math.PI / 180) * 44} ${80 - Math.cos(a * Math.PI / 180) * 44}L${180 + Math.sin(a * Math.PI / 180) * 54} ${80 - Math.cos(a * Math.PI / 180) * 54}" stroke="#F6B84B" stroke-width="4" stroke-linecap="round"/>`).join('')}
    <path d="M0 70c60-30 110-30 170 0s120 20 190-10v30H0z" fill="#D9C6F7"/><path d="M0 80c80-20 140-10 200 4s110 6 160-14v20H0z" fill="#C3A6F5"/>
    <ellipse cx="70" cy="26" rx="26" ry="8" fill="#EDE3FA"/><ellipse cx="290" cy="22" rx="30" ry="8" fill="#EDE3FA"/></svg>`,
  moon: `<svg viewBox="0 0 110 90"><path d="M68 76A34 34 0 1 1 46 12a26 26 0 0 0 22 64z" fill="#F6D38A" ${S}/>
    <path d="M84 18l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" fill="#FFD66B" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="96" cy="50" r="3" fill="#FFD66B"/><circle cx="20" cy="74" r="2.5" fill="#FFD66B"/></svg>`,
  mountain: `<svg viewBox="0 0 140 90"><path d="M4 86 46 34l20 22 18-24 52 54z" fill="#C3A6F5" ${S}/><path d="M46 34l-8 10 8-2 6 6zM84 32l-6 9 6-1 6 5z" fill="#fff"/>
    <path d="M84 32V6" ${S}/><path d="M84 6l20 6-20 7z" fill="#F48FB1" ${S}/></svg>`,
  cake: `<svg viewBox="0 0 100 100"><rect x="18" y="50" width="64" height="36" rx="8" fill="#F6B7CF" ${S}/><path d="M18 62c8 6 16 6 21 0 6 6 15 6 22 0 6 6 14 6 21 0" fill="none" ${S}/>
    <rect x="47" y="28" width="6" height="22" rx="2" fill="#9DD6F9" ${S}/><path d="M50 14c5 5 5 10 0 13-5-3-5-8 0-13z" fill="#FFD66B" ${S}/></svg>`,
};
export const art = (name, cls = '') => `<span class="art ${cls}">${ART[name] || ''}</span>`;

// little "///" sparkle mark and the squiggle under titles
export const spark = (cls = '') => `<svg class="spark ${cls}" viewBox="0 0 30 30" aria-hidden="true"><path d="M6 14l-5-3M10 8 8 2M17 6l3-5" stroke="#F6C14B" stroke-width="2.6" stroke-linecap="round"/></svg>`;
export const squiggle = (cls = '') => `<svg class="squig ${cls}" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 7c10-6 18 6 28 0s18-6 28 0 18 6 28 0 18-6 28 0" fill="none" stroke="#B79AF7" stroke-width="3" stroke-linecap="round"/></svg>`;

// small item icons for prep lists
const MINI = {
  doc: `<svg viewBox="0 0 40 40"><rect x="9" y="5" width="22" height="30" rx="4" fill="#EDE3FA" ${S}/><path d="M14 14h12M14 20h12M14 26h8" stroke="${O}" stroke-width="2" stroke-linecap="round"/></svg>`,
  cards: `<svg viewBox="0 0 40 40"><rect x="5" y="10" width="18" height="24" rx="3" fill="#D9C6F7" ${S} transform="rotate(-12 14 22)"/><rect x="16" y="8" width="18" height="24" rx="3" fill="#F6B7CF" ${S} transform="rotate(10 25 20)"/></svg>`,
  marker: `<svg viewBox="0 0 40 40"><path d="M6 30 26 10l6 6-20 20z" fill="#C3A6F5" ${S}/><path d="M9 22l15-15 5 5-15 15z" fill="#F6B7CF" ${S} transform="translate(2 -4)"/></svg>`,
  blocks: `<svg viewBox="0 0 40 40"><rect x="6" y="20" width="14" height="14" rx="2" fill="#7BB6F2" ${S}/><rect x="20" y="20" width="14" height="14" rx="2" fill="#F6B7CF" ${S}/><rect x="13" y="6" width="14" height="14" rx="2" fill="#FFD66B" ${S}/></svg>`,
  star: `<svg viewBox="0 0 40 40"><path d="M20 5l4.5 9.5 10 1.4-7.3 7 1.8 10L20 28.2l-9 4.7 1.8-10-7.3-7 10-1.4z" fill="#FFD66B" ${S}/></svg>`,
  screen: `<svg viewBox="0 0 40 40"><rect x="5" y="8" width="30" height="20" rx="3" fill="#9DD6F9" ${S}/><path d="M20 28v6M13 34h14" ${S}/></svg>`,
  book: `<svg viewBox="0 0 40 40"><rect x="8" y="6" width="24" height="28" rx="3" fill="#7BA0E8" ${S}/><path d="M20 13l2 3.5h-4zM20 21l2-3.5h-4z" fill="#fff"/></svg>`,
  scissors: `<svg viewBox="0 0 40 40"><circle cx="11" cy="28" r="5" fill="#F6B7CF" ${S}/><circle cx="23" cy="31" r="5" fill="#F6B7CF" ${S}/><path d="M14 24 31 6M20 27l-4-20" ${S}/></svg>`,
};
export function miniArt(text) {
  const t = text || '';
  let k = 'star';
  if (/מדפסת|שכפול|דף|קובץ|כרטיס עבודה|דפים|חוברת/.test(t)) k = 'doc';
  if (/כרטיס/.test(t) && !/עבודה/.test(t)) k = 'cards';
  if (/טוש|צבע|עפרונות|מחק/.test(t)) k = 'marker';
  if (/בדידים|קוביות|בלוק|לוח המאה/.test(t)) k = 'blocks';
  if (/מקרן|מצגת/.test(t)) k = 'screen';
  if (/ספר|תנ"?ך/.test(t)) k = 'book';
  if (/לגזור|גזור/.test(t)) k = 'scissors';
  return `<span class="mini-art">${MINI[k]}</span>`;
}

// file-type badges for the files screen
export function fileBadge(kind) {
  const B = {
    ppt: ['#F28B4B', 'P'], pdf: ['#E9574F', 'PDF'], doc: ['#4F8EF0', ''], sheet: ['#3FAF6C', ''], folder: ['#A67AF3', ''], slides: ['#F6C14B', ''],
  };
  const [c, t] = B[kind] || B.doc;
  const inner = kind === 'folder'
    ? `<path d="M7 15a3 3 0 0 1 3-3h7l3 3h11a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3z" fill="${c}"/>`
    : `<path d="M10 4h15l8 8v24a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" fill="${c}"/><path d="M25 4v8h8" fill="#fff" opacity=".45"/>
       ${t ? `<text x="20" y="${t.length > 1 ? 30 : 31}" font-size="${t.length > 1 ? 9 : 14}" font-weight="700" text-anchor="middle" fill="#fff" font-family="Heebo, Arial">${t}</text>` : kind === 'slides' ? '<rect x="13" y="20" width="14" height="10" rx="1.5" fill="none" stroke="#fff" stroke-width="2.4"/>' : '<path d="M13 21h14M13 26h14M13 31h9" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>'}`;
  return `<svg class="fbadge" viewBox="0 0 40 42" aria-hidden="true">${inner}</svg>`;
}
