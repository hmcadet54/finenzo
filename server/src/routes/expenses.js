import { Router } from 'express';
import { Category, Cycle, Expense, Income, Subscription, SubscriptionCharge } from '../models.js';
import { ApiError, notFound, parse } from '../http.js';
import { objectId, schemas } from '../schemas.js';
import { parseNoteBlock } from '../lib/noteParser.js';
import { parseAmount } from '../lib/money.js';
import { ensureCycleForDate } from '../services/cycles.js';

const router = Router();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function resolveCategory(userId, categoryId) {
  if (!categoryId) return null;
  const cat = await Category.exists({ _id: categoryId, userId });
  if (!cat) throw new ApiError(400, 'BAD_CATEGORY', 'Unknown category');
  return categoryId;
}

async function resolveSubscription(userId, subscriptionId) {
  if (!subscriptionId) return null;
  const sub = await Subscription.exists({ _id: subscriptionId, userId });
  if (!sub) throw new ApiError(400, 'BAD_SUBSCRIPTION', 'Unknown subscription');
  return subscriptionId;
}

router.get('/', async (req, res) => {
  const q = parse(schemas.expenseQuery, req.query);
  const filter = { userId: req.userId };
  if (q.from || q.to) {
    filter.date = {};
    if (q.from) filter.date.$gte = q.from;
    if (q.to) filter.date.$lte = q.to;
    if (q.cycleId) filter.cycleId = q.cycleId;
  } else {
    filter.cycleId = q.cycleId ?? (await ensureCycleForDate(req.user, req.today))._id;
  }
  if (q.categoryId) filter.categoryId = q.categoryId;
  if (q.q) filter.$or = [{ label: new RegExp(escapeRe(q.q), 'i') }, { note: new RegExp(escapeRe(q.q), 'i') }];
  const items = await Expense.find(filter).sort({ date: -1, createdAt: -1 }).limit(q.limit);
  res.json({ items });
});

router.post('/parse', (req, res) => {
  const { text } = parse(schemas.parseBody, req.body);
  res.json(parseNoteBlock(text, { today: req.today }));
});

router.post('/bulk', async (req, res) => {
  const body = parse(schemas.bulk, req.body);
  const rows = [];
  for (const r of body.rows) {
    const date = r.date ?? req.today;
    const cycle = await ensureCycleForDate(req.user, date);
    rows.push({
      userId: req.userId,
      cycleId: cycle._id,
      amount: r.amount,
      label: r.label,
      date,
      categoryId: await resolveCategory(req.userId, r.categoryId),
      note: r.note ?? '',
      source: 'import',
    });
  }
  const items = await Expense.insertMany(rows);
  let cycle = null;
  if (body.startingBalance) {
    const value = parseAmount(body.startingBalance.expression);
    if (value == null) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid starting balance');
    cycle = await ensureCycleForDate(req.user, req.today);
    cycle.startingBalance = value;
    cycle.startingExpression = body.startingBalance.expression;
    await cycle.save();
  }
  res.status(201).json({ items, cycle });
});

router.post('/', async (req, res) => {
  const b = parse(schemas.expenseCreate, req.body);
  const date = b.date ?? req.today;
  const cycle = await ensureCycleForDate(req.user, date);
  const subscriptionId = b.subscriptionId ? await resolveSubscription(req.userId, b.subscriptionId) : null;
  const source = subscriptionId ? 'subscription' : (b.source ?? 'manual');
  const expense = await Expense.create({
    userId: req.userId,
    cycleId: cycle._id,
    amount: b.amount,
    label: b.label,
    date,
    categoryId: await resolveCategory(req.userId, b.categoryId),
    subscriptionId,
    source,
    note: b.note ?? '',
  });
  res.status(201).json({ item: expense });
});

router.patch('/:id', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const b = parse(schemas.expensePatch, req.body);
  const expense = await Expense.findOne({ _id: id, userId: req.userId });
  if (!expense) throw notFound('Expense');
  if (b.categoryId !== undefined) b.categoryId = await resolveCategory(req.userId, b.categoryId);
  if (b.subscriptionId !== undefined) {
    b.subscriptionId = b.subscriptionId ? await resolveSubscription(req.userId, b.subscriptionId) : null;
    if (b.subscriptionId) {
      b.source = 'subscription';
    } else if (expense.source === 'subscription') {
      b.source = 'manual';
    }
  }
  Object.assign(expense, b);
  if (b.date) expense.cycleId = (await ensureCycleForDate(req.user, b.date))._id;
  await expense.save();
  res.json({ item: expense });
});

router.delete('/:id', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const expense = await Expense.findOneAndDelete({ _id: id, userId: req.userId });
  if (!expense) throw notFound('Expense');
  if (expense.source === 'subscription') {
    // Deleting a paid-renewal expense puts the renewal back to "due".
    await SubscriptionCharge.updateOne(
      { userId: req.userId, expenseId: expense._id },
      { status: 'due', expenseId: null },
    );
  }
  res.json({ ok: true });
});

export default router;

export const incomeRouter = Router();

incomeRouter.get('/', async (req, res) => {
  const q = parse(schemas.expenseQuery.pick({ cycleId: true }), req.query);
  const cycleId = q.cycleId ?? (await ensureCycleForDate(req.user, req.today))._id;
  const items = await Income.find({ userId: req.userId, cycleId }).sort({ date: -1, createdAt: -1 });
  res.json({ items });
});

incomeRouter.post('/', async (req, res) => {
  const b = parse(schemas.incomeCreate, req.body);
  const date = b.date ?? req.today;
  const cycle = await ensureCycleForDate(req.user, date);
  const item = await Income.create({ userId: req.userId, cycleId: cycle._id, ...b, date });
  res.status(201).json({ item });
});

incomeRouter.patch('/:id', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const b = parse(schemas.incomePatch, req.body);
  const item = await Income.findOne({ _id: id, userId: req.userId });
  if (!item) throw notFound('Income');
  Object.assign(item, b);
  if (b.date) item.cycleId = (await ensureCycleForDate(req.user, b.date))._id;
  await item.save();
  res.json({ item });
});

incomeRouter.delete('/:id', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const item = await Income.findOneAndDelete({ _id: id, userId: req.userId });
  if (!item) throw notFound('Income');
  res.json({ ok: true });
});

export { Cycle };
