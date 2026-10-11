import { Router } from 'express';
import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { DATA_MODELS, Category, Expense, Income, User } from '../models.js';
import { parse } from '../http.js';
import { schemas } from '../schemas.js';
import { seedCategories } from '../services/cycles.js';

export const meRouter = Router();
export const dataRouter = Router();

meRouter.patch('/', async (req, res) => {
  const b = parse(schemas.settingsPatch, req.body);
  if (b.name !== undefined) req.user.name = b.name;
  for (const [k, v] of Object.entries(b.settings ?? {})) req.user.settings[k] = v;
  await req.user.save();
  res.json({ user: req.user });
});

async function wipe(userId) {
  await Promise.all(Object.values(DATA_MODELS).map((M) => M.deleteMany({ userId })));
}

meRouter.delete('/data', async (req, res) => {
  await wipe(req.userId);
  await seedCategories(req.userId);
  res.json({ ok: true });
});

meRouter.delete('/', async (req, res) => {
  await wipe(req.userId);
  await User.deleteOne({ _id: req.userId });
  res.json({ ok: true });
});

/* ---------- export / import ---------- */

const csvCell = (v) => {
  const s = String(v ?? '');
  // Prefix formula-looking cells so spreadsheets don't execute them.
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

dataRouter.get('/export', async (req, res) => {
  const userId = req.userId;
  if (req.query.format === 'csv') {
    const [expenses, income, cats] = await Promise.all([
      Expense.find({ userId }).sort({ date: 1 }),
      Income.find({ userId }).sort({ date: 1 }),
      Category.find({ userId }),
    ]);
    const catName = Object.fromEntries(cats.map((c) => [String(c._id), c.name]));
    const rows = [
      ['type', 'date', 'label', 'amount', 'category', 'source', 'note'],
      ...expenses.map((e) => ['expense', e.date, e.label, e.amount, catName[String(e.categoryId)] ?? '', e.source, e.note]),
      ...income.map((i) => ['income', i.date, i.label, i.amount, '', '', '']),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="finenzo-export.csv"');
    return res.send(rows.map((r) => r.map(csvCell).join(',')).join('\r\n'));
  }
  const data = {};
  for (const [name, M] of Object.entries(DATA_MODELS)) data[name] = await M.find({ userId });
  res.setHeader('Content-Disposition', 'attachment; filename="finenzo-backup.json"');
  res.json({ app: 'finenzo', version: 1, exportedAt: new Date().toISOString(), settings: req.user.settings, data });
});

const REFS = ['cycleId', 'categoryId', 'subscriptionId', 'loanId', 'friendId', 'expenseId', 'repaymentId'];
const importSchema = z.object({
  app: z.literal('finenzo'),
  version: z.number(),
  data: z.record(z.array(z.record(z.any())).max(50_000)),
});

dataRouter.post('/import', express.json({ limit: '10mb' }), async (req, res) => {
  const { data } = parse(importSchema, req.body);
  const idMap = new Map();
  const newId = (old) => {
    if (!old) return null;
    const k = String(old);
    if (!idMap.has(k)) idMap.set(k, new mongoose.Types.ObjectId());
    return idMap.get(k);
  };
  const remap = (doc) => {
    // eslint-disable-next-line no-unused-vars
    const { id, _id, userId, createdAt, updatedAt, __v, ...rest } = doc;
    const out = { ...rest, _id: newId(id ?? _id), userId: req.userId };
    for (const k of REFS) if (k in out) out[k] = newId(out[k]);
    if (Array.isArray(out.repayments)) {
      out.repayments = out.repayments.map(({ id: rid, _id: r_id, ...r }) => ({ ...r, _id: newId(rid ?? r_id) }));
    }
    return out;
  };

  const oldIds = {};
  for (const [name, M] of Object.entries(DATA_MODELS)) oldIds[name] = await M.distinct('_id', { userId: req.userId });
  const inserted = [];
  try {
    // Insert order matters little (refs are plain ids), but keep parents first.
    for (const name of ['Category', 'Cycle', 'Friend', 'Loan', 'Subscription', 'Expense', 'Income', 'SubscriptionCharge']) {
      const docs = (data[name] ?? []).map(remap);
      if (!docs.length) continue;
      await DATA_MODELS[name].insertMany(docs);
      inserted.push([name, docs.map((d) => d._id)]);
    }
  } catch (err) {
    for (const [name, ids] of inserted) await DATA_MODELS[name].deleteMany({ _id: { $in: ids } });
    throw Object.assign(err, { status: 400 });
  }
  await Promise.all(
    Object.entries(DATA_MODELS).map(([name, M]) => M.deleteMany({ _id: { $in: oldIds[name] } })),
  );
  if (!(data.Category ?? []).length) await seedCategories(req.userId);
  res.json({ ok: true, imported: Object.fromEntries(inserted.map(([n, ids]) => [n, ids.length])) });
});
