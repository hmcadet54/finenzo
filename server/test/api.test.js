import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.GOOGLE_CLIENT_ID = 'test-client';

vi.mock('../src/lib/google.js', () => ({
  verifyGoogleIdToken: async (token) => {
    if (!token.startsWith('good-')) {
      const { ApiError } = await import('../src/http.js');
      throw new ApiError(401, 'INVALID_GOOGLE_TOKEN', 'Google sign-in could not be verified');
    }
    const n = token.split('-')[1];
    return { googleId: `g-${n}`, name: `User ${n}`, email: `${n}@example.com`, picture: '' };
  },
}));

const { createApp } = await import('../src/app.js');
const models = await import('../src/models.js');

const app = createApp();
const uri = process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27017/finenzo_test';

async function login(name = 'alice') {
  const res = await request(app).post('/api/auth/google').send({ idToken: `good-${name}-xxxxxxxx` });
  return { token: res.body.token, res };
}
const auth = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  await mongoose.connect(uri);
});
beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).map((m) => m.syncIndexes?.()));
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('auth', () => {
  it('rejects an invalid Google token', async () => {
    const res = await request(app).post('/api/auth/google').send({ idToken: 'bad-token-xxxxxxxx' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_GOOGLE_TOKEN');
  });

  it('creates the user on first sign-in and logs in afterwards (no duplicates)', async () => {
    const a = await login();
    expect(a.res.status).toBe(200);
    expect(a.res.body.user).toMatchObject({ name: 'User alice', email: 'alice@example.com' });
    await login();
    expect(await models.User.countDocuments()).toBe(1);
    expect(await models.Category.countDocuments()).toBe(7);
  });

  it('/auth/me works with a token, 401 without or with a bad one', async () => {
    const { token } = await login();
    expect((await request(app).get('/api/auth/me').set(auth(token))).status).toBe(200);
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const bad = await request(app).get('/api/auth/me').set(auth('nope'));
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('UNAUTHORIZED');
  });

  it('protects data routes', async () => {
    for (const p of ['/api/expenses', '/api/dashboard', '/api/subscriptions', '/api/friends']) {
      expect((await request(app).get(p)).status).toBe(401);
    }
  });
});

describe('expenses', () => {
  it('creates with expression amounts and lists grouped by cycle', async () => {
    const { token } = await login();
    const res = await request(app)
      .post('/api/expenses')
      .set(auth(token))
      .send({ amount: '1.5k + 500', label: 'Movie', date: '2026-10-04' });
    expect(res.status).toBe(201);
    expect(res.body.item.amount).toBe(2000);
    const list = await request(app).get('/api/expenses').query({ from: '2026-10-01', to: '2026-10-31' }).set(auth(token));
    expect(list.body.items).toHaveLength(1);
  });

  it('validates input with the standard error shape', async () => {
    const { token } = await login();
    const res = await request(app).post('/api/expenses').set(auth(token)).send({ amount: 'abc', label: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('never exposes another user’s data', async () => {
    const a = await login('alice');
    const b = await login('bob');
    const created = await request(app).post('/api/expenses').set(auth(a.token)).send({ amount: 100, label: 'secret', date: '2026-10-04' });
    const id = created.body.item.id;
    const q = { from: '2026-01-01', to: '2026-12-31' };
    expect((await request(app).get('/api/expenses').query(q).set(auth(b.token))).body.items).toHaveLength(0);
    expect((await request(app).patch(`/api/expenses/${id}`).set(auth(b.token)).send({ label: 'x' })).status).toBe(404);
    expect((await request(app).delete(`/api/expenses/${id}`).set(auth(b.token))).status).toBe(404);
    expect((await request(app).delete(`/api/expenses/${id}`).set(auth(a.token))).status).toBe(200);
  });

  it('parses a pasted block and bulk-imports it', async () => {
    const { token } = await login();
    const text = '5k : Qari faiz 4oct\n1.5k movie box\n-----\nTotal : 6.5k';
    const parsed = await request(app).post('/api/expenses/parse').set(auth(token)).send({ text });
    expect(parsed.body.sum).toBe(6500);
    expect(parsed.body.totalMismatch).toBe(false);
    const bulk = await request(app).post('/api/expenses/bulk').set(auth(token)).send({
      rows: parsed.body.rows.map(({ amount, label, date }) => ({ amount, label, date })),
    });
    expect(bulk.status).toBe(201);
    expect(bulk.body.items).toHaveLength(2);
  });
});

describe('dashboard & cycles', () => {
  it('balance = starting + income − expenses; carry-over on close', async () => {
    const { token } = await login();
    const cur = await request(app).get('/api/cycles/current').set(auth(token));
    const id = cur.body.item.id;
    await request(app).patch(`/api/cycles/${id}`).set(auth(token)).send({ startingBalance: '122K + 30k + 30k', startingExpression: '122K + 30k + 30k' });
    const today = (await request(app).get('/api/auth/me').set(auth(token))).body.today;
    await request(app).post('/api/expenses').set(auth(token)).send({ amount: '5k', label: 'a', date: today });
    await request(app).post('/api/income').set(auth(token)).send({ amount: '10k', label: 'bonus', date: today });
    const dash = await request(app).get('/api/dashboard').set(auth(token));
    expect(dash.body.balance).toMatchObject({ starting: 182_000, spent: 5000, income: 10_000, remaining: 187_000 });
    expect(dash.body.stats.todaySpent).toBe(5000);
    const close = await request(app).post(`/api/cycles/${id}/close`).set(auth(token)).send({ carryOver: true });
    expect(close.body.next.startingBalance).toBe(187_000);
    expect(close.body.next.carriedOver).toBe(true);
  });
});

describe('subscriptions', () => {
  it('mark paid creates exactly one linked expense and advances the schedule', async () => {
    const { token } = await login();
    const sub = await request(app).post('/api/subscriptions').set(auth(token)).send({
      name: 'Apple Cloud',
      lineItems: [{ label: 'a', amount: 300 }, { label: 'b', amount: 300 }],
      billingCycle: 'monthly',
      anchorDay: 11,
    });
    expect(sub.status).toBe(201);
    expect(sub.body.item.amount).toBe(600);
    const before = sub.body.item.nextRenewal;
    const paid = await request(app).post(`/api/subscriptions/${sub.body.item.id}/charge`).set(auth(token)).send({});
    expect(paid.status).toBe(200);
    expect(paid.body.expense.amount).toBe(600);
    const list = await request(app).get('/api/subscriptions').set(auth(token));
    expect(list.body.items[0].nextRenewal > before).toBe(true);
    expect(await models.Expense.countDocuments({ source: 'subscription' })).toBe(1);
    // deleting the expense puts the renewal back to due
    await request(app).delete(`/api/expenses/${paid.body.expense.id}`).set(auth(token));
    expect((await models.SubscriptionCharge.findOne()).status).toBe('due');
  });

  it('manual subscriptions only charge on demand', async () => {
    const { token } = await login();
    const sub = await request(app).post('/api/subscriptions').set(auth(token)).send({
      name: 'Movie', lineItems: [{ amount: 600 }], billingCycle: 'manual',
    });
    expect(sub.body.item.nextRenewal).toBeNull();
    const r = await request(app).post(`/api/subscriptions/${sub.body.item.id}/charge`).set(auth(token)).send({});
    expect(r.status).toBe(200);
  });
});

describe('loans', () => {
  it('tracks partial repayments and linked cash movement', async () => {
    const { token } = await login();
    const friend = await request(app).post('/api/friends').set(auth(token)).send({ name: 'Ali' });
    const loan = await request(app).post('/api/loans').set(auth(token)).send({
      friendId: friend.body.item.id, amount: '10k', expectedReturnDate: '2020-01-01', createLinked: true,
    });
    expect(loan.body.item.status).toBe('overdue');
    expect(await models.Expense.countDocuments({ source: 'loan' })).toBe(1);
    const rep = await request(app).post(`/api/loans/${loan.body.item.id}/repayments`).set(auth(token)).send({ amount: '4k', createLinked: true });
    expect(rep.body.item.outstanding).toBe(6000);
    expect(await models.Income.countDocuments()).toBe(1);
    const over = await request(app).post(`/api/loans/${loan.body.item.id}/repayments`).set(auth(token)).send({ amount: '99k' });
    expect(over.status).toBe(400);
    const overview = await request(app).get('/api/loans/overview').set(auth(token));
    expect(overview.body).toMatchObject({ lentOut: 6000, overdue: 6000 });
  });
});

describe('data', () => {
  it('exports, wipes and re-imports a backup', async () => {
    const { token } = await login();
    await request(app).post('/api/expenses').set(auth(token)).send({ amount: 700, label: 'tea', date: '2026-10-04' });
    const backup = (await request(app).get('/api/export').set(auth(token))).body;
    expect(backup.data.Expense).toHaveLength(1);
    const csv = await request(app).get('/api/export').query({ format: 'csv' }).set(auth(token));
    expect(csv.text).toContain('tea');
    await request(app).delete('/api/me/data').set(auth(token));
    expect(await models.Expense.countDocuments()).toBe(0);
    const imp = await request(app).post('/api/import').set(auth(token)).send(backup);
    expect(imp.status).toBe(200);
    expect(await models.Expense.countDocuments()).toBe(1);
    expect((await request(app).delete('/api/me').set(auth(token))).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(auth(token))).status).toBe(401);
  });
});
