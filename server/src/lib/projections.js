import { diffDays } from './dates.js';

/**
 * Projection math.
 *  - remaining           balance right now
 *  - variableSpent       spend so far in the cycle excluding subscription charges
 *                        (renewals are projected separately, so they're not double counted)
 *  - daysLeft            days from today to cycle end, inclusive of today
 *  - upcoming            sum of unpaid renewals falling in the rest of the cycle
 */
export function computeProjections({ remaining, variableSpent, daysElapsed, daysLeft, upcoming }) {
  const avgDaily = daysElapsed > 0 ? Math.round(variableSpent / daysElapsed) : 0;
  const futureDays = Math.max(daysLeft - 1, 0);
  const safePerDay = daysLeft > 0 ? Math.floor((remaining - upcoming) / daysLeft) : 0;
  const projectedEnd = remaining - avgDaily * futureDays;
  const projectedAfterRenewals = projectedEnd - upcoming;
  return {
    avgDaily,
    safePerDay,
    projectedEnd,
    projectedAfterRenewals,
    upcoming,
    warning: projectedAfterRenewals < 0 || remaining - upcoming < 0,
  };
}

/** Day counters for a cycle relative to today. */
export function cycleDays(cycle, today) {
  const totalDays = diffDays(cycle.startDate, cycle.endDate) + 1;
  const isCurrent = today >= cycle.startDate && today <= cycle.endDate;
  const isPast = today > cycle.endDate;
  const daysElapsed = isPast ? totalDays : isCurrent ? diffDays(cycle.startDate, today) + 1 : 0;
  const daysLeft = isCurrent ? diffDays(today, cycle.endDate) + 1 : 0;
  return { totalDays, isCurrent, isPast, daysElapsed, daysLeft };
}
