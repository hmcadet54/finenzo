import { Router } from 'express';
import { Category, Cycle, Expense, Income } from '../models.js';
import { ApiError, notFound, parse } from '../http.js';
import { objectId, schemas } from '../schemas.js';
import { addDays } from '../lib/dates.js';
import { cycleBalance, ensureCycleForDate } from '../services/cycles.js';

export const cyclesRouter = Router();

cyclesRouter.get('/', async (req, res) => {
  await ensureCycleForDate(req.user, req.today);
  const items = await Cycle.find({ userId: req.userId }).sort({ startDate: -1 });
  res.json({ items });
});

cyclesRouter.get('/current', async (req, res) => {
  const cycle = await ensureCycleForDate(req.user, req.today);
  res.json({ item: cycle, balance: await cycleBalance(req.userId, cycle) });
});

cyclesRouter.post('/', async (req, res) => {
  const b = parse(schemas.cycleCreate, req.body);
  const cycle = await ensureCycleForDate(req.user, b.startDate);
  if (b.startingBalance !== undefined) cycle.startingBalance = b.startingBalance;
  if (b.startingExpression !== undefined) cycle.startingExpression = b.startingExpression;
  await cycle.save();
  res.status(201).json({ item: cycle });
});

cyclesRouter.patch('/:id', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const b = parse(schemas.cyclePatch, req.body);
  const cycle = await Cycle.findOne({ _id: id, userId: req.userId });
  if (!cycle) throw notFound('Cycle');
  Object.assign(cycle, b);
  await cycle.save();
  res.json({ item: cycle });
});

/** Close a cycle and open the next one, optionally carrying the remaining balance over. */
cyclesRouter.post('/:id/close', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const { carryOver } = parse(schemas.cycleClose, req.body ?? {});
  const cycle = await Cycle.findOne({ _id: id, userId: req.userId });
  if (!cycle) throw notFound('Cycle');
  const { remaining } = await cycleBalance(req.userId, cycle);
  cycle.closed = true;
  await cycle.save();
  const next = await ensureCycleForDate(req.user, addDays(cycle.endDate, 1));
  if (carryOver && !next.carriedOver) {
    next.startingBalance = remaining;
    next.startingExpression = `${remaining}`;
    next.carriedOver = true;
    await next.save();
  }
  res.json({ closed: cycle, next });
});

export const categoriesRouter = Router();

categoriesRouter.get('/', async (req, res) => {
  res.json({ items: await Category.find({ userId: req.userId }).sort({ createdAt: 1 }) });
});

categoriesRouter.post('/', async (req, res) => {
  const b = parse(schemas.categoryCreate, req.body);
  res.status(201).json({ item: await Category.create({ ...b, userId: req.userId }) });
});

categoriesRouter.patch('/:id', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const b = parse(schemas.categoryPatch, req.body);
  const item = await Category.findOneAndUpdate({ _id: id, userId: req.userId }, b, { new: true });
  if (!item) throw notFound('Category');
  res.json({ item });
});

categoriesRouter.delete('/:id', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const item = await Category.findOneAndDelete({ _id: id, userId: req.userId });
  if (!item) throw notFound('Category');
  await Promise.all([
    Expense.updateMany({ userId: req.userId, categoryId: id }, { categoryId: null }),
  ]);
  res.json({ ok: true });
});

export { ApiError, Income };
