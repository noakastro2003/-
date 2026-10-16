// Manage teachers' credits from the command line (for example, a school that pays by invoice).
//
//   npm run admin -- show <email>
//   npm run admin -- grant <email> <credits>        add one-off credits (negative to remove)
//   npm run admin -- subscribe <email> [months]     start or extend a subscription (default 1 month)
//   npm run admin -- cancel <email>                 stop renewal; usable until the period ends
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, tx } from './db.js';
import * as billing from './billing.js';
import { billingConfig } from './server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const db = openDb(process.env.DB_FILE || path.join(here, 'data', 'app.db'));
const cfg = billingConfig();
const [cmd, email, arg] = process.argv.slice(2);

const fail = (msg) => { console.error(msg); process.exit(1); };
const usage = 'שימוש: show <email> | grant <email> <credits> | subscribe <email> [months] | cancel <email>';
if (!cmd || !email) fail(usage);

const row = db.prepare('SELECT * FROM teachers WHERE email = ?').get(email.toLowerCase());
if (!row) fail(`לא נמצאה מורה עם האימייל ${email}`);

const acc = { credits: row.credits, subStatus: row.sub_status, subPeriodEnd: row.sub_period_end, subCreditsLeft: row.sub_credits_left };
const save = (delta, action, note) => tx(db, () => {
  db.prepare('UPDATE teachers SET credits = ?, sub_status = ?, sub_period_end = ?, sub_credits_left = ? WHERE id = ?')
    .run(acc.credits, acc.subStatus, acc.subPeriodEnd, acc.subCreditsLeft, row.id);
  db.prepare('INSERT INTO credit_ledger (teacher_id, delta, action, note) VALUES (?, ?, ?, ?)').run(row.id, delta, action, note);
});

if (cmd === 'grant') {
  const n = Number(arg);
  if (!Number.isInteger(n) || n === 0) fail('צריך מספר שלם של קרדיטים');
  acc.credits = Math.max(0, acc.credits + n);
  save(n, 'grant', 'admin');
} else if (cmd === 'subscribe') {
  const months = arg === undefined ? 1 : Number(arg);
  if (!Number.isInteger(months) || months < 1 || months > 36) fail('מספר חודשים בין 1 ל-36');
  billing.refresh(acc);
  // Extending an active subscription adds time after its current end.
  const start = billing.subscribed(acc) ? Date.parse(acc.subPeriodEnd) : Date.now();
  // A manual multi-month subscription gets all its months' credits for the whole period.
  const carry = billing.subscribed(acc) ? acc.subCreditsLeft : 0;
  billing.activate(acc, { ...cfg, periodDays: cfg.periodDays * months, monthlyCredits: cfg.monthlyCredits * months }, start);
  acc.subCreditsLeft += carry;
  save(cfg.monthlyCredits * months, 'subscribe', `admin, ${months} חודשים`);
} else if (cmd === 'cancel') {
  billing.cancel(acc);
  save(0, 'cancel', 'admin');
} else if (cmd !== 'show') {
  fail(usage);
}

const s = billing.summary(acc, cfg);
console.log(`${row.name} <${row.email}>`);
console.log(`קרדיטים זמינים: ${s.available} (חד-פעמיים ${s.credits}, מהמנוי ${s.subscription.creditsLeft})`);
console.log(`מנוי: ${s.subscription.status || 'אין'}${s.subscription.periodEnd ? ` עד ${s.subscription.periodEnd.slice(0, 10)}` : ''}`);
