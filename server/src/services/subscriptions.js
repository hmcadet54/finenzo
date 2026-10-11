import { Expense, Subscription, SubscriptionCharge } from '../models.js';
import { addDays } from '../lib/dates.js';
import { nextOccurrence } from '../lib/renewal.js';
import { ensureCycleForDate } from './cycles.js';
import { ApiError } from '../http.js';

/** Create the linked expense for a charge and mark it paid. No double counting: one expense per charge. */
export async function payCharge(user, sub, charge, date) {
  if (charge.status === 'paid') throw new ApiError(409, 'ALREADY_PAID', 'Charge already paid');
  const cycle = await ensureCycleForDate(user, date);
  const expense = await Expense.create({
    userId: user._id,
    cycleId: cycle._id,
    amount: charge.amount,
    label: sub.name,
    date,
    categoryId: sub.categoryId,
    note: '',
    source: 'subscription',
    subscriptionId: sub._id,
  });
  charge.status = 'paid';
  charge.expenseId = expense._id;
  await charge.save();
  return expense;
}

/**
 * Lazily materialise renewals that have arrived: every active, non-manual subscription whose
 * nextRenewal <= today gets a `due` charge (or is auto-posted) and its nextRenewal advances.
 */
const locks = new Map();

export async function syncSubscriptions(user, today) {
  const key = String(user._id);
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(() => doSync(user, today));
  locks.set(key, run);
  try {
    await run;
  } finally {
    if (locks.get(key) === run) locks.delete(key);
  }
}

async function doSync(user, today) {
  const subs = await Subscription.find({
    userId: user._id,
    status: 'active',
    isManual: false,
    nextRenewal: { $lte: today },
  });
  for (const sub of subs) {
    let guard = 0;
    while (sub.nextRenewal && sub.nextRenewal <= today && guard++ < 36) {
      const dueDate = sub.nextRenewal;
      let charge = await SubscriptionCharge.findOne({ subscriptionId: sub._id, dueDate });
      if (!charge) {
        charge = await SubscriptionCharge.create({
          userId: user._id,
          subscriptionId: sub._id,
          dueDate,
          amount: sub.amount,
        });
        if (user.settings?.autoPostSubscriptions) await payCharge(user, sub, charge, dueDate);
      }
      sub.nextRenewal = nextOccurrence(sub, addDays(dueDate, 1));
    }
    await sub.save();
  }
}
