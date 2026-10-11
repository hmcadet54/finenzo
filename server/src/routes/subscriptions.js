import { Router } from 'express';
import { Category, Expense, Subscription, SubscriptionCharge } from '../models.js';
import { ApiError, notFound, parse } from '../http.js';
import { objectId, schemas } from '../schemas.js';
import { addDays, diffDays } from '../lib/dates.js';
import { nextOccurrence, normalizeSchedule, occurrencesBetween } from '../lib/renewal.js';
import { payCharge, syncSubscriptions } from '../services/subscriptions.js';

const router = Router();
const sum = (items) => items.reduce((s, i) => s + i.amount, 0);

async function categoryOk(userId, categoryId) {
  if (categoryId && !(await Category.exists({ _id: categoryId, userId }))) {
    throw new ApiError(400, 'BAD_CATEGORY', 'Unknown category');
  }
}

/** Monthly-equivalent cost of a subscription (yearly items are amortised). */
export const monthlyEquivalent = (s) => (s.amount / (s.intervalMonths || 1));

async function load(req, id) {
  const sub = await Subscription.findOne({ _id: id, userId: req.userId });
  if (!sub) throw notFound('Subscription');
  return sub;
}

router.get('/', async (req, res) => {
  await syncSubscriptions(req.user, req.today);
  const subs = await Subscription.find({ userId: req.userId });
  const due = await SubscriptionCharge.find({ userId: req.userId, status: 'due' }).sort({ dueDate: 1 });
  const end30 = addDays(req.today, 30);
  const items = subs.map((s) => {
    const o = s.toJSON();
    o.dueCharges = due.filter((c) => String(c.subscriptionId) === String(s._id)).map((c) => c.toJSON());
    o.daysUntil = s.nextRenewal ? diffDays(req.today, s.nextRenewal) : null;
    return o;
  });
  const rank = (s) => (s.status === 'active' ? (s.isManual ? 1 : 0) : 2);
  items.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.dueCharges.length ? 0 : 1) - (b.dueCharges.length ? 0 : 1) ||
      (a.nextRenewal ?? '9').localeCompare(b.nextRenewal ?? '9') ||
      a.name.localeCompare(b.name),
  );
  const active = subs.filter((s) => s.status === 'active' && !s.isManual);
  const monthly = Math.round(active.reduce((t, s) => t + monthlyEquivalent(s), 0));
  const next30 = active.flatMap((s) =>
    occurrencesBetween(s, req.today, end30).map(() => ({ amount: s.amount })),
  );
  const dueTotal = sum(due.map((c) => ({ amount: c.amount })));
  res.json({
    items,
    totals: { monthly, yearly: monthly * 12, next30Days: sum(next30) + dueTotal, dueNow: dueTotal },
  });
});

router.post('/', async (req, res) => {
  const b = parse(schemas.subscriptionCreate, req.body);
  await categoryOk(req.userId, b.categoryId);
  const schedule = normalizeSchedule(b, req.today);
  const amount = b.lineItems.reduce((s, i) => s + i.amount, 0);
  const sub = new Subscription({
    userId: req.userId,
    name: b.name,
    lineItems: b.lineItems,
    amount,
    ...schedule,
    categoryId: b.categoryId ?? null,
    note: b.note ?? '',
    color: b.color ?? '',
    icon: b.icon ?? '',
    priceHistory: [{ amount, date: req.today }],
  });
  sub.nextRenewal = sub.isManual ? null : nextOccurrence(sub, req.today);
  await sub.save();
  res.status(201).json({ item: sub });
});

router.patch('/:id', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const b = parse(schemas.subscriptionPatch, req.body);
  const sub = await load(req, id);
  await categoryOk(req.userId, b.categoryId);
  const { lineItems, status, ...rest } = b;
  const scheduleChanged = ['billingCycle', 'intervalMonths', 'anchorDay', 'anchorMonth', 'anchorYear'].some(
    (k) => rest[k] !== undefined,
  );
  Object.assign(sub, rest);
  if (lineItems) {
    const amount = lineItems.reduce((s, i) => s + i.amount, 0);
    if (amount !== sub.amount) sub.priceHistory.push({ amount, date: req.today }); // "price changed"
    sub.lineItems = lineItems;
    sub.amount = amount;
  }
  if (scheduleChanged) {
    Object.assign(
      sub,
      normalizeSchedule(
        {
          billingCycle: sub.billingCycle,
          intervalMonths: sub.intervalMonths,
          anchorDay: sub.anchorDay,
          anchorMonth: sub.anchorMonth,
          anchorYear: rest.anchorYear,
        },
        req.today,
      ),
    );
  }
  if (status) sub.status = status;
  const resume = status === 'active' || scheduleChanged;
  if (sub.isManual) sub.nextRenewal = null;
  else if (resume || !sub.nextRenewal) sub.nextRenewal = nextOccurrence(sub, req.today);
  await sub.save();
  res.json({ item: sub });
});

router.delete('/:id', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const sub = await load(req, id);
  await Promise.all([
    sub.deleteOne(),
    SubscriptionCharge.deleteMany({ userId: req.userId, subscriptionId: id }),
    // Keep expense history, just detach it.
    Expense.updateMany({ userId: req.userId, subscriptionId: id }, { subscriptionId: null }),
  ]);
  res.json({ ok: true });
});

/**
 * Mark paid / "Charge now".
 *  - chargeId given: pays that due charge.
 *  - manual subscription: charges today.
 *  - otherwise pays the next upcoming renewal early and advances the schedule.
 */
async function resolveCharge(req, sub, chargeId) {
  if (chargeId) {
    const c = await SubscriptionCharge.findOne({ _id: chargeId, userId: req.userId, subscriptionId: sub._id });
    if (!c) throw notFound('Charge');
    if (c.status !== 'due') throw new ApiError(409, 'NOT_DUE', 'Charge is not due');
    return c;
  }
  const dueDate = sub.isManual ? req.today : sub.nextRenewal;
  if (!dueDate) throw new ApiError(400, 'NO_RENEWAL', 'Nothing to charge');
  if (sub.status === 'cancelled') throw new ApiError(400, 'CANCELLED', 'Subscription is cancelled');
  // Manual subscriptions may be charged any number of times, so they always get a fresh record.
  const existing = sub.isManual
    ? null
    : await SubscriptionCharge.findOne({ subscriptionId: sub._id, dueDate });
  const charge =
    existing ??
    (await SubscriptionCharge.create({
      userId: req.userId,
      subscriptionId: sub._id,
      dueDate,
      amount: sub.amount,
    }));
  if (!sub.isManual) {
    sub.nextRenewal = nextOccurrence(sub, addDays(dueDate, 1));
    await sub.save();
  }
  return charge;
}

router.post('/:id/charge', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const b = parse(schemas.subscriptionAction, req.body ?? {});
  const sub = await load(req, id);
  const charge = await resolveCharge(req, sub, b.chargeId);
  const expense = await payCharge(req.user, sub, charge, b.date ?? req.today);
  res.json({ expense, charge });
});

router.post('/:id/skip', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const b = parse(schemas.subscriptionAction, req.body ?? {});
  const sub = await load(req, id);
  if (sub.isManual && !b.chargeId) throw new ApiError(400, 'MANUAL', 'Manual subscriptions have nothing to skip');
  const charge = await resolveCharge(req, sub, b.chargeId);
  charge.status = 'skipped';
  await charge.save();
  res.json({ charge });
});

export default router;
