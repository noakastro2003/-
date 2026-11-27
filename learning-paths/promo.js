// Promo codes: a free subscription for some months, extra credits, or a discount on the
// subscription's first payment. Pure rules; the server keeps the codes in promo_codes.
import { HttpError, str, int } from './validate.js';

export const PROMO_KINDS = {
  free_months: { label: 'מנוי חינם', unit: 'חודשים', min: 1, max: 24 },
  credits: { label: 'קרדיטים', unit: 'קרדיטים', min: 1, max: 5000 },
  discount: { label: 'הנחה על המנוי', unit: '%', min: 1, max: 100 },
};

const CODE_RE = /^[A-Z0-9-]{4,24}$/;
export const normalizeCode = (s) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, '');

// The admin's "new code" form → a row for promo_codes. Throws 400 on bad input.
export function promoInput(b) {
  const code = normalizeCode(b.code);
  if (!CODE_RE.test(code)) throw new HttpError(400, 'הקוד: 4 עד 24 אותיות באנגלית, ספרות או מקף');
  const kind = PROMO_KINDS[b.kind] ? b.kind : null;
  if (!kind) throw new HttpError(400, 'בחרו סוג הטבה');
  const k = PROMO_KINDS[kind];
  const amount = int(b.amount, { min: k.min, max: k.max, def: -1 });
  if (amount < k.min) throw new HttpError(400, `כמות: בין ${k.min} ל-${k.max} ${k.unit}`);
  const maxUses = b.maxUses === '' || b.maxUses == null ? null : int(b.maxUses, { min: 1, max: 1_000_000, def: 1 });
  let expiresAt = null;
  if (b.expiresAt !== '' && b.expiresAt != null) {
    expiresAt = Number(b.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new HttpError(400, 'תאריך התפוגה צריך להיות בעתיד');
  }
  return { code, kind, amount, maxUses, expiresAt, note: str(b.note, { max: 200, field: 'הערה' }) };
}

// Why a stored code can't be used now, or null if it can.
export function promoProblem(row, now = Date.now()) {
  if (!row || !row.active) return 'הקוד לא קיים או שאינו פעיל';
  if (row.expires_at && now >= row.expires_at) return 'תוקף הקוד הסתיים';
  if (row.max_uses != null && row.uses >= row.max_uses) return 'הקוד כבר נוצל עד הסוף';
  return null;
}

// What the teacher sees after redeeming.
export function promoMessage(row) {
  if (row.kind === 'free_months') return row.amount === 1 ? 'קיבלת חודש מנוי חינם 🎉' : `קיבלת ${row.amount} חודשי מנוי חינם 🎉`;
  if (row.kind === 'credits') return `נוספו לך ${row.amount} קרדיטים 🎉`;
  return `קיבלת ${row.amount}% הנחה על התשלום הראשון במנוי 🎉`;
}

export function promoOut(row) {
  return {
    code: row.code, kind: row.kind, amount: row.amount, maxUses: row.max_uses, uses: row.uses,
    expiresAt: row.expires_at, note: row.note, active: Boolean(row.active), createdAt: row.created_at,
  };
}
