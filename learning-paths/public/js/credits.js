// Credits on the teacher's side of the app: the topbar badge, cost labels and the
// "out of credits" dialog. The server is the authority; this only shows what it reports.
import { h, modal, toast } from './ui.js';
import { session, go } from './app.js';

export const creditWord = (n) => (n === 1 ? 'קרדיט אחד' : `${n} קרדיטים`);

export const cost = (action) => session.costs?.[action] ?? 0;

export function creditBadge() {
  if (!session.teacher || session.teacher.credits === undefined) return null;
  return h('a', { class: 'credit-badge', href: '#/billing', title: 'הקרדיטים והמנוי שלי', dataset: { creditBadge: '' } },
    `✨ ${session.teacher.credits}`);
}

// After an action the server reports the new balance; keep the badge in step.
export function setCredits(n) {
  if (!session.teacher || !Number.isFinite(n)) return;
  session.teacher.credits = n;
  for (const el of document.querySelectorAll('[data-credit-badge]')) el.textContent = `✨ ${n}`;
}

// A 402 from the server means the action needs more credits than the teacher has.
export function showError(err) {
  if (err.status !== 402) return toast(err.message, 'error');
  const m = modal('נגמרו הקרדיטים', [
    h('p', {}, err.message),
    h('p', { class: 'muted' }, 'במנוי החודשי מקבלים קרדיטים חדשים כל חודש. עריכה של מסלולים קיימים, תלמידים ומעקב נשארים חינם.'),
    h('div', { class: 'row end' },
      h('button', { class: 'btn ghost', onclick: () => m.close() }, 'לא עכשיו'),
      h('button', { class: 'btn primary', onclick: () => { m.close(); go('#/billing'); } }, 'למנוי')),
  ]);
}
