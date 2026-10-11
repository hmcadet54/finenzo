import { describe, expect, it } from 'vitest';
import { nextOccurrence, normalizeSchedule, occurrencesBetween } from '../src/lib/renewal.js';
import { computeProjections, cycleDays } from '../src/lib/projections.js';
import { decorateLoan, loanStatus, outstanding } from '../src/lib/loans.js';
import { addDays, cycleBounds, diffDays, isValidDateStr } from '../src/lib/dates.js';

const sched = (input, today) => normalizeSchedule(input, today);

describe('next renewal', () => {
  it('monthly on the 19th', () => {
    const s = sched({ billingCycle: 'monthly', anchorDay: 19 }, '2026-10-12');
    expect(nextOccurrence(s, '2026-10-12')).toBe('2026-10-19');
    expect(nextOccurrence(s, '2026-10-19')).toBe('2026-10-19');
    expect(nextOccurrence(s, '2026-10-20')).toBe('2026-11-19');
  });
  it('month-end: 31st clamps in short months', () => {
    const s = sched({ billingCycle: 'monthly', anchorDay: 31 }, '2026-01-01');
    expect(nextOccurrence(s, '2026-02-01')).toBe('2026-02-28');
    expect(nextOccurrence(s, '2028-02-01')).toBe('2028-02-29');
    expect(nextOccurrence(s, '2026-04-01')).toBe('2026-04-30');
    expect(nextOccurrence(s, '2026-05-01')).toBe('2026-05-31');
  });
  it('yearly: 31 July and Feb 29', () => {
    const jul = sched({ billingCycle: 'yearly', anchorDay: 31, anchorMonth: 7 }, '2026-10-12');
    expect(nextOccurrence(jul, '2026-10-12')).toBe('2027-07-31');
    const leap = sched({ billingCycle: 'yearly', anchorDay: 29, anchorMonth: 2, anchorYear: 2028 }, '2026-10-12');
    expect(nextOccurrence(leap, '2026-10-12')).toBe('2027-02-28');
    expect(nextOccurrence(leap, '2028-01-01')).toBe('2028-02-29');
  });
  it('quarterly steps by 3 months from the anchor', () => {
    const s = sched({ billingCycle: 'quarterly', anchorDay: 15, anchorMonth: 1, anchorYear: 2026 }, '2026-10-12');
    expect(nextOccurrence(s, '2026-10-12')).toBe('2026-10-15');
    expect(nextOccurrence(s, '2026-10-16')).toBe('2027-01-15');
  });
  it('custom N months not dividing 12 stays anchored', () => {
    const s = sched({ billingCycle: 'custom', intervalMonths: 5, anchorDay: 10, anchorMonth: 1, anchorYear: 2026 }, '2026-01-01');
    expect(nextOccurrence(s, '2026-02-01')).toBe('2026-06-10');
    expect(nextOccurrence(s, '2026-07-01')).toBe('2026-11-10');
    expect(nextOccurrence(s, '2026-12-01')).toBe('2027-04-10');
  });
  it('manual has no schedule', () => {
    expect(sched({ billingCycle: 'manual' }, '2026-10-12').isManual).toBe(true);
  });
  it('lists occurrences in a window', () => {
    const s = sched({ billingCycle: 'monthly', anchorDay: 11 }, '2026-10-01');
    expect(occurrencesBetween(s, '2026-10-12', '2026-12-31')).toEqual(['2026-11-11', '2026-12-11']);
  });
});

describe('dates & cycles', () => {
  it('validates and does arithmetic', () => {
    expect(isValidDateStr('2026-02-29')).toBe(false);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-10-01', '2026-10-31')).toBe(30);
  });
  it('cycle bounds with default and custom start day', () => {
    expect(cycleBounds('2026-10-12', 1)).toEqual({ startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(cycleBounds('2026-10-12', 25)).toEqual({ startDate: '2026-09-25', endDate: '2026-10-24' });
    expect(cycleBounds('2026-02-10', 31)).toEqual({ startDate: '2026-01-31', endDate: '2026-02-27' });
  });
});

describe('projections', () => {
  const cycle = { startDate: '2026-10-01', endDate: '2026-10-31' };
  it('computes day counters', () => {
    expect(cycleDays(cycle, '2026-10-12')).toMatchObject({ totalDays: 31, daysElapsed: 12, daysLeft: 20, isCurrent: true });
    expect(cycleDays(cycle, '2026-11-02')).toMatchObject({ isPast: true, daysLeft: 0, daysElapsed: 31 });
  });
  it('computes safe-to-spend and projections', () => {
    const p = computeProjections({ remaining: 100_000, variableSpent: 24_000, daysElapsed: 12, daysLeft: 20, upcoming: 10_000 });
    expect(p.avgDaily).toBe(2000);
    expect(p.safePerDay).toBe(4500);
    expect(p.projectedEnd).toBe(100_000 - 2000 * 19);
    expect(p.projectedAfterRenewals).toBe(p.projectedEnd - 10_000);
    expect(p.warning).toBe(false);
  });
  it('warns when the projection goes negative', () => {
    const p = computeProjections({ remaining: 20_000, variableSpent: 60_000, daysElapsed: 10, daysLeft: 20, upcoming: 5000 });
    expect(p.warning).toBe(true);
    expect(p.projectedAfterRenewals).toBeLessThan(0);
  });
});

describe('loan status', () => {
  const loan = (extra = {}) => ({ amount: 10_000, repayments: [], expectedReturnDate: '2026-11-01', ...extra });
  const today = '2026-10-12';
  it('pending → partial → returned', () => {
    expect(loanStatus(loan(), today)).toBe('pending');
    const part = loan({ repayments: [{ amount: 4000 }] });
    expect(loanStatus(part, today)).toBe('partial');
    expect(outstanding(part)).toBe(6000);
    expect(loanStatus(loan({ repayments: [{ amount: 4000 }, { amount: 6000 }] }), today)).toBe('returned');
  });
  it('overdue is computed from the date', () => {
    expect(loanStatus(loan({ expectedReturnDate: '2026-10-01' }), today)).toBe('overdue');
    expect(loanStatus(loan({ expectedReturnDate: '2026-10-01', repayments: [{ amount: 10_000 }] }), today)).toBe('returned');
    expect(loanStatus(loan({ expectedReturnDate: null }), today)).toBe('pending');
    expect(decorateLoan(loan(), today).outstanding).toBe(10_000);
  });
});
