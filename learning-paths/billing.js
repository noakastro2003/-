// Credits and the monthly subscription, as pure rules over one account object.
// Shared by the server (which stores the account in the teachers table) and the demo.
//
// account = {
//   credits,          // one-off credits: the free sign-up gift and manual grants; never expire
//   subStatus,        // null | 'active' | 'canceled' (still usable until the period ends) | 'expired'
//   subPeriodEnd,     // ISO time the current paid period ends
//   subCreditsLeft,   // what is left of this period's monthly credits; they expire with the period
// }
import { HttpError } from './validate.js';

export const BILLING_DEFAULTS = Object.freeze({
  freeCredits: 20,
  monthlyCredits: 200,
  periodDays: 30,
  priceLabel: '₪39 לחודש',
  costs: Object.freeze({
    createPath: 1, // a new path built by hand, from the example, or as a copy
    aiGenerate: 5, // a path built by the AI generator
  }),
});

export const ACTION_LABELS = {
  signup: 'קרדיטים חינמיים בהרשמה',
  createPath: 'מסלול חדש',
  aiGenerate: 'מסלול מהמחולל',
  refund: 'החזר (הפעולה לא הושלמה)',
  grant: 'קרדיטים שנוספו ידנית',
  subscribe: 'הצטרפות למנוי',
  cancel: 'ביטול חידוש המנוי',
};

export function newAccount(cfg = BILLING_DEFAULTS) {
  return { credits: cfg.freeCredits, subStatus: null, subPeriodEnd: null, subCreditsLeft: 0 };
}

// Ends a paid period whose time is up. Mutates and returns the account.
export function refresh(acc, now = Date.now()) {
  if ((acc.subStatus === 'active' || acc.subStatus === 'canceled') && now >= Date.parse(acc.subPeriodEnd)) {
    acc.subStatus = 'expired';
    acc.subCreditsLeft = 0;
  }
  return acc;
}

export const subscribed = (acc) => acc.subStatus === 'active' || acc.subStatus === 'canceled';

export const available = (acc) => acc.credits + (subscribed(acc) ? acc.subCreditsLeft : 0);

// Takes the action's cost, monthly credits first (they expire), then one-off credits.
// Returns what was taken, for a refund if the action then fails. Throws 402 when short.
export function spend(acc, action, cfg = BILLING_DEFAULTS, now = Date.now()) {
  refresh(acc, now);
  const cost = cfg.costs[action];
  if (cost === undefined) throw new Error(`unknown billable action: ${action}`);
  if (available(acc) < cost) {
    throw Object.assign(new HttpError(402, `נגמרו הקרדיטים: הפעולה הזו עולה ${cost} ויש לך ${available(acc)}.`), { code: 'no_credits' });
  }
  const fromSub = subscribed(acc) ? Math.min(cost, acc.subCreditsLeft) : 0;
  acc.subCreditsLeft -= fromSub;
  acc.credits -= cost - fromSub;
  return { cost, fromSub, fromCredits: cost - fromSub };
}

export function refund(acc, taken) {
  if (subscribed(acc)) acc.subCreditsLeft += taken.fromSub;
  acc.credits += taken.fromCredits;
}

// A paid period starts (first payment, or a renewal reported by the payment provider).
export function activate(acc, cfg = BILLING_DEFAULTS, now = Date.now()) {
  acc.subStatus = 'active';
  acc.subPeriodEnd = new Date(now + cfg.periodDays * 86400000).toISOString();
  acc.subCreditsLeft = cfg.monthlyCredits;
  return acc;
}

// Stops renewal; what was paid for stays usable until the period ends.
export function cancel(acc) {
  if (acc.subStatus === 'active') acc.subStatus = 'canceled';
  return acc;
}

// What the teacher's billing page shows.
export function summary(acc, cfg = BILLING_DEFAULTS, now = Date.now()) {
  refresh(acc, now);
  return {
    available: available(acc),
    credits: acc.credits,
    subscription: {
      status: acc.subStatus,
      periodEnd: acc.subPeriodEnd,
      creditsLeft: subscribed(acc) ? acc.subCreditsLeft : 0,
    },
    plan: { priceLabel: cfg.priceLabel, monthlyCredits: cfg.monthlyCredits, periodDays: cfg.periodDays },
    costs: { ...cfg.costs },
    freeCredits: cfg.freeCredits,
  };
}
