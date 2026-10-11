import { Category, Cycle, Expense, Income } from '../models.js';
import { addDays, cycleBounds } from '../lib/dates.js';

export const DEFAULT_CATEGORIES = [
  { name: 'Food', icon: '🍔', color: '#E0894B' },
  { name: 'Transport', icon: '🚌', color: '#5B8DEF' },
  { name: 'Withdrawal', icon: '🏧', color: '#8E7CC3' },
  { name: 'Shop/Business', icon: '🛍️', color: '#3FA796' },
  { name: 'Subscription', icon: '🔁', color: '#D97757' },
  { name: 'Friends/Family', icon: '🤝', color: '#D96C9B' },
  { name: 'Other', icon: '📦', color: '#8A8782' },
];

export async function seedCategories(userId) {
  await Category.insertMany(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })));
}

/** Find the cycle containing `date`, creating it (clipped to neighbours) if needed. */
export async function ensureCycleForDate(user, date) {
  const userId = user._id;
  const existing = await Cycle.findOne({ userId, startDate: { $lte: date }, endDate: { $gte: date } });
  if (existing) return existing;
  let { startDate, endDate } = cycleBounds(date, user.settings?.cycleStartDay ?? 1);
  const prev = await Cycle.findOne({ userId, endDate: { $lt: date } }).sort({ endDate: -1 });
  if (prev && prev.endDate >= startDate) startDate = addDays(prev.endDate, 1);
  const next = await Cycle.findOne({ userId, startDate: { $gt: date } }).sort({ startDate: 1 });
  if (next && next.startDate <= endDate) endDate = addDays(next.startDate, -1);
  return Cycle.create({ userId, startDate, endDate });
}

export const getCurrentCycle = (user, today) => ensureCycleForDate(user, today);

/** Remaining balance for a cycle = starting + income − expenses. */
export async function cycleBalance(userId, cycle) {
  const [[exp], [inc]] = await Promise.all([
    Expense.aggregate([
      { $match: { userId, cycleId: cycle._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Income.aggregate([
      { $match: { userId, cycleId: cycle._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);
  const spent = exp?.total ?? 0;
  const income = inc?.total ?? 0;
  return { starting: cycle.startingBalance, income, spent, remaining: cycle.startingBalance + income - spent };
}
