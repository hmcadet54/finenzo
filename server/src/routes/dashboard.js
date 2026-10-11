import { Router } from 'express';
import { Cycle, Expense, Subscription, SubscriptionCharge } from '../models.js';
import { notFound, parse } from '../http.js';
import { objectId } from '../schemas.js';
import { addDays } from '../lib/dates.js';
import { occurrencesBetween } from '../lib/renewal.js';
import { computeProjections, cycleDays } from '../lib/projections.js';
import { cycleBalance, ensureCycleForDate } from '../services/cycles.js';
import { syncSubscriptions } from '../services/subscriptions.js';

const router = Router();

/** Single call for the home screen. */
router.get('/', async (req, res) => {
  const rawCycleId = typeof req.query.cycleId === 'string' ? req.query.cycleId.trim() : null;
  const cycleId = rawCycleId && rawCycleId !== 'null' && rawCycleId !== 'undefined' ? parse(objectId, rawCycleId) : null;
  const { userId, today } = req;
  await syncSubscriptions(req.user, today);

  const cycle = cycleId
    ? await Cycle.findOne({ _id: cycleId, userId })
    : await ensureCycleForDate(req.user, today);
  if (!cycle) throw notFound('Cycle');

  const days = cycleDays(cycle, today);
  const match = { userId, cycleId: cycle._id };
  const [balance, subSpend, todaySpend, daily, byCategory, subs, dueCharges] = await Promise.all([
    cycleBalance(userId, cycle),
    Expense.aggregate([
      { $match: { ...match, source: 'subscription' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      { $match: { ...match, date: today } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: '$date', amount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: '$categoryId', amount: { $sum: '$amount' } } },
      { $sort: { amount: -1 } },
    ]),
    Subscription.find({ userId, status: 'active', isManual: false }),
    SubscriptionCharge.find({ userId, status: 'due' }).populate('subscriptionId', 'name color icon'),
  ]);

  // Upcoming renewals (never-paid occurrences only: nextRenewal already advances on pay/skip).
  const horizon = (n) => addDays(today, n);
  const upcomingItems = (to) =>
    subs
      .flatMap((s) =>
        occurrencesBetween(s, today, to).map((date) => ({
          subscriptionId: String(s._id),
          name: s.name,
          amount: s.amount,
          date,
          color: s.color,
          icon: s.icon,
        })),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  const items30 = upcomingItems(horizon(30));
  const items7 = items30.filter((i) => i.date <= horizon(7));
  const due = dueCharges
    .filter((c) => c.subscriptionId)
    .map((c) => ({
      chargeId: String(c._id),
      subscriptionId: String(c.subscriptionId._id),
      name: c.subscriptionId.name,
      amount: c.amount,
      date: c.dueDate,
    }));
  const dueTotal = due.reduce((s, c) => s + c.amount, 0);
  const total = (list) => list.reduce((s, i) => s + i.amount, 0);

  const inCycle = days.isCurrent ? upcomingItems(cycle.endDate) : [];
  const upcomingInCycle = days.isCurrent ? total(inCycle) + dueTotal : 0;

  const spentOnSubs = subSpend[0]?.total ?? 0;
  const projections = days.isCurrent
    ? computeProjections({
        remaining: balance.remaining,
        variableSpent: balance.spent - spentOnSubs,
        daysElapsed: days.daysElapsed,
        daysLeft: days.daysLeft,
        upcoming: upcomingInCycle,
      })
    : null;

  res.json({
    cycle,
    today,
    isCurrent: days.isCurrent,
    balance,
    stats: {
      todaySpent: todaySpend[0]?.total ?? 0,
      avgDaily: projections?.avgDaily ?? (days.daysElapsed ? Math.round(balance.spent / days.daysElapsed) : 0),
      daysLeft: days.daysLeft,
      daysElapsed: days.daysElapsed,
      totalDays: days.totalDays,
    },
    projections,
    upcoming: {
      due,
      dueTotal,
      next7: { total: total(items7) + dueTotal, items: items7 },
      next30: { total: total(items30) + dueTotal, items: items30 },
    },
    daily: daily.map((d) => ({ date: d._id, amount: d.amount })),
    byCategory: byCategory.map((c) => ({ categoryId: c._id ? String(c._id) : null, amount: c.amount })),
  });
});

export default router;
