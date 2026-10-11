import { Router } from 'express';
import { Expense, Friend, Income, Loan } from '../models.js';
import { ApiError, notFound, parse } from '../http.js';
import { objectId, schemas } from '../schemas.js';
import { decorateLoan } from '../lib/loans.js';
import { ensureCycleForDate } from '../services/cycles.js';

export const friendsRouter = Router();
export const loansRouter = Router();

const byDate = (a, b) => (a.expectedReturnDate ?? '9').localeCompare(b.expectedReturnDate ?? '9');

function summarize(loans) {
  const s = { lentOut: 0, borrowed: 0, overdue: 0, overdueBorrowed: 0, dueSoon: 0 };
  for (const l of loans) {
    if (l.outstanding === 0) continue;
    if (l.direction === 'lent') s.lentOut += l.outstanding;
    else s.borrowed += l.outstanding;
    if (l.status === 'overdue') {
      if (l.direction === 'lent') s.overdue += l.outstanding;
      else s.overdueBorrowed += l.outstanding;
    }
  }
  return s;
}

async function friendOf(req, id) {
  const f = await Friend.findOne({ _id: id, userId: req.userId });
  if (!f) throw notFound('Friend');
  return f;
}

friendsRouter.get('/', async (req, res) => {
  const [friends, loans] = await Promise.all([
    Friend.find({ userId: req.userId }).sort({ name: 1 }),
    Loan.find({ userId: req.userId }),
  ]);
  const decorated = loans.map((l) => decorateLoan(l, req.today));
  const items = friends.map((f) => {
    const mine = decorated.filter((l) => String(l.friendId) === String(f._id));
    const nextReturn = mine
      .filter((l) => l.outstanding > 0 && l.expectedReturnDate)
      .sort(byDate)[0]?.expectedReturnDate;
    return { ...f.toJSON(), ...summarize(mine), loanCount: mine.length, nextReturn: nextReturn ?? null };
  });
  res.json({ items, overview: { ...summarize(decorated) } });
});

friendsRouter.get('/:id', async (req, res) => {
  const friend = await friendOf(req, parse(objectId, req.params.id));
  const loans = (await Loan.find({ userId: req.userId, friendId: friend._id }).sort({ dateLent: -1 })).map(
    (l) => decorateLoan(l, req.today),
  );
  res.json({ item: { ...friend.toJSON(), ...summarize(loans) }, loans });
});

friendsRouter.post('/', async (req, res) => {
  const b = parse(schemas.friendCreate, req.body);
  res.status(201).json({ item: await Friend.create({ ...b, userId: req.userId }) });
});

friendsRouter.patch('/:id', async (req, res) => {
  const b = parse(schemas.friendPatch, req.body);
  const friend = await friendOf(req, parse(objectId, req.params.id));
  Object.assign(friend, b);
  await friend.save();
  res.json({ item: friend });
});

friendsRouter.delete('/:id', async (req, res) => {
  const friend = await friendOf(req, parse(objectId, req.params.id));
  const loans = await Loan.find({ userId: req.userId, friendId: friend._id }, '_id');
  const ids = loans.map((l) => l._id);
  await Promise.all([
    Expense.deleteMany({ userId: req.userId, loanId: { $in: ids } }),
    Income.deleteMany({ userId: req.userId, loanId: { $in: ids } }),
    Loan.deleteMany({ userId: req.userId, friendId: friend._id }),
    friend.deleteOne(),
  ]);
  res.json({ ok: true });
});

/* ---------- Loans ---------- */

async function loanOf(req, id) {
  const l = await Loan.findOne({ _id: id, userId: req.userId });
  if (!l) throw notFound('Loan');
  return l;
}

/**
 * Linked cash movement. Lending out / repaying a borrowed loan = money leaves (expense);
 * borrowing / being repaid = money arrives (income).
 */
async function postLinked(req, { loan, friend, kind, amount, date, repaymentId = null }) {
  const cycle = await ensureCycleForDate(req.user, date);
  const outgoing = (loan.direction === 'lent') === (kind === 'principal');
  const base = { userId: req.userId, cycleId: cycle._id, amount, date, loanId: loan._id, repaymentId };
  if (outgoing) {
    await Expense.create({
      ...base,
      label: kind === 'principal' ? `Lent to ${friend.name}` : `Repaid ${friend.name}`,
      source: 'loan',
    });
  } else {
    await Income.create({
      ...base,
      label: kind === 'principal' ? `Borrowed from ${friend.name}` : `${friend.name} repaid`,
    });
  }
}

loansRouter.get('/overview', async (req, res) => {
  const loans = (await Loan.find({ userId: req.userId })).map((l) => decorateLoan(l, req.today));
  const friends = await Friend.find({ userId: req.userId }, 'name');
  const names = Object.fromEntries(friends.map((f) => [String(f._id), f.name]));
  const upcoming = loans
    .filter((l) => l.outstanding > 0 && l.expectedReturnDate)
    .sort(byDate)
    .slice(0, 5)
    .map((l) => ({ ...l, friendName: names[String(l.friendId)] }));
  res.json({ ...summarize(loans), upcoming });
});

loansRouter.get('/', async (req, res) => {
  const filter = { userId: req.userId };
  if (req.query.friendId) filter.friendId = parse(objectId, req.query.friendId);
  const items = (await Loan.find(filter).sort({ dateLent: -1 })).map((l) => decorateLoan(l, req.today));
  res.json({ items });
});

loansRouter.post('/', async (req, res) => {
  const b = parse(schemas.loanCreate, req.body);
  const friend = await friendOf(req, b.friendId);
  const dateLent = b.dateLent ?? req.today;
  const loan = await Loan.create({
    userId: req.userId,
    friendId: friend._id,
    direction: b.direction,
    amount: b.amount,
    dateLent,
    expectedReturnDate: b.expectedReturnDate ?? null,
    note: b.note ?? '',
  });
  if (b.createLinked) {
    await postLinked(req, { loan, friend, kind: 'principal', amount: b.amount, date: dateLent });
  }
  res.status(201).json({ item: decorateLoan(loan, req.today) });
});

loansRouter.patch('/:id', async (req, res) => {
  const b = parse(schemas.loanPatch, req.body);
  const loan = await loanOf(req, parse(objectId, req.params.id));
  Object.assign(loan, b);
  await loan.save();
  res.json({ item: decorateLoan(loan, req.today) });
});

loansRouter.delete('/:id', async (req, res) => {
  const loan = await loanOf(req, parse(objectId, req.params.id));
  await Promise.all([
    Expense.deleteMany({ userId: req.userId, loanId: loan._id }),
    Income.deleteMany({ userId: req.userId, loanId: loan._id }),
    loan.deleteOne(),
  ]);
  res.json({ ok: true });
});

loansRouter.post('/:id/repayments', async (req, res) => {
  const b = parse(schemas.repayment, req.body);
  const loan = await loanOf(req, parse(objectId, req.params.id));
  const outstandingNow = decorateLoan(loan, req.today).outstanding;
  if (b.amount > outstandingNow) {
    throw new ApiError(400, 'OVERPAYMENT', `Only ${outstandingNow} is outstanding on this loan`);
  }
  const date = b.date ?? req.today;
  loan.repayments.push({ amount: b.amount, date, note: b.note ?? '' });
  await loan.save();
  const repayment = loan.repayments[loan.repayments.length - 1];
  if (b.createLinked) {
    const friend = await friendOf(req, loan.friendId);
    await postLinked(req, { loan, friend, kind: 'repayment', amount: b.amount, date, repaymentId: repayment._id });
  }
  res.status(201).json({ item: decorateLoan(loan, req.today) });
});

loansRouter.delete('/:id/repayments/:rid', async (req, res) => {
  const loan = await loanOf(req, parse(objectId, req.params.id));
  const rid = parse(objectId, req.params.rid);
  const rep = loan.repayments.id(rid);
  if (!rep) throw notFound('Repayment');
  rep.deleteOne();
  await loan.save();
  await Promise.all([
    Expense.deleteMany({ userId: req.userId, repaymentId: rid }),
    Income.deleteMany({ userId: req.userId, repaymentId: rid }),
  ]);
  res.json({ item: decorateLoan(loan, req.today) });
});
