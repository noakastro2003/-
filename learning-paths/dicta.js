// Dicta's Nakdan (automatic nikud). Pure helpers: the server does the request.
// The API answers with one entry per word or separator; each word lists its possible
// vocalizations, most likely first, with '|' marking a prefix boundary.

export const DICTA_URL = 'https://nakdan-2-0.loadbalancer.dicta.org.il/api';

export const dictaRequest = (text) => ({ task: 'nakdan', data: text, genre: 'modern' });

// Rebuilds the text with the first (most likely) option for every word.
export function dictaToText(tokens) {
  if (!Array.isArray(tokens)) throw new Error('unexpected Dicta response');
  return tokens.map((t) => {
    if (t.sep || !Array.isArray(t.options) || !t.options.length) return String(t.word ?? '');
    return String(t.options[0]).replaceAll('|', '');
  }).join('');
}
