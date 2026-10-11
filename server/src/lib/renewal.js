import { addDays, dateFromMonthIndex, parseYMD } from './dates.js';

/**
 * Renewal calculator.
 * A subscription is anchored by (anchorYear, anchorMonth, anchorDay) and repeats every
 * `intervalMonths` months. The day is clamped to the month length, so the 31st becomes
 * the 30th/28th/29th in short months and Feb 29 becomes Feb 28 in non-leap years.
 */
export function occurrence(sub, k, n = sub.intervalMonths) {
  const base = sub.anchorYear * 12 + (sub.anchorMonth - 1);
  return dateFromMonthIndex(base + k * n, sub.anchorDay);
}

/** First occurrence on or after `from` (inclusive). Works with plain objects and Mongoose docs. */
export function nextOccurrence(sub, from) {
  const n = Math.max(1, sub.intervalMonths || 1);
  const { y, m } = parseYMD(from);
  const base = sub.anchorYear * 12 + (sub.anchorMonth - 1);
  let k = Math.floor((y * 12 + (m - 1) - base) / n) - 1;
  while (occurrence(sub, k, n) < from) k++;
  return occurrence(sub, k, n);
}

/** All occurrences within [from, to] inclusive. */
export function occurrencesBetween(sub, from, to, limit = 400) {
  const out = [];
  let cursor = from;
  while (out.length < limit) {
    const next = nextOccurrence(sub, cursor);
    if (next > to) break;
    out.push(next);
    cursor = addDays(next, 1);
  }
  return out;
}

export const INTERVALS = { monthly: 1, quarterly: 3, yearly: 12 };

/** Fill in interval + anchor fields from user input. `today` is `YYYY-MM-DD`. */
export function normalizeSchedule(input, today) {
  const { y, m } = parseYMD(today);
  const billingCycle = input.billingCycle;
  if (billingCycle === 'manual') {
    return { billingCycle, isManual: true, intervalMonths: 1, anchorDay: 1, anchorMonth: 1, anchorYear: y };
  }
  const intervalMonths = INTERVALS[billingCycle] ?? Math.max(1, input.intervalMonths || 1);
  const anchorDay = input.anchorDay ?? 1;
  const anchorMonth = billingCycle === 'monthly' ? 1 : (input.anchorMonth ?? m);
  const anchorYear = input.anchorYear ?? (anchorMonth < m ? y + 1 : y);
  return { billingCycle, isManual: false, intervalMonths, anchorDay, anchorMonth, anchorYear };
}
