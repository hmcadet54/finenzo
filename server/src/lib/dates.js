/** Date helpers. All dates are date-only strings `YYYY-MM-DD` (no time-zone shifting). */

const pad = (n) => String(n).padStart(2, '0');

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toStr(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseYMD(str) {
  const [y, m, d] = str.split('-').map(Number);
  return { y, m, d };
}

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isValidDateStr(str) {
  if (typeof str !== 'string' || !DATE_RE.test(str)) return false;
  const { y, m, d } = parseYMD(str);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function addDays(str, n) {
  const { y, m, d } = parseYMD(str);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return toStr(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Whole days from a to b (b - a). */
export function diffDays(a, b) {
  const pa = parseYMD(a);
  const pb = parseYMD(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}

/** Build a date, clamping the day to the month length (31st in a 30-day month, Feb 29). */
export function clampDate(y, m, d) {
  return toStr(y, m, Math.min(d, daysInMonth(y, m)));
}

/** Month index → date with clamped day. `idx = year*12 + (month-1)`. */
export function dateFromMonthIndex(idx, day) {
  const y = Math.floor(idx / 12);
  const m = (((idx % 12) + 12) % 12) + 1;
  return clampDate(y, m, day);
}

/** Today's date string in a given IANA timezone. */
export function todayIn(tz = 'Asia/Karachi', now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * Cycle bounds containing `dateStr` for a given cycle start day.
 * The start day is clamped for short months (e.g. day 31 → Feb 28).
 */
export function cycleBounds(dateStr, startDay = 1) {
  const { y, m, d } = parseYMD(dateStr);
  const idx = y * 12 + (m - 1);
  const startThisMonth = dateFromMonthIndex(idx, startDay);
  const startIdx = dateStr >= startThisMonth ? idx : idx - 1;
  const startDate = dateFromMonthIndex(startIdx, startDay);
  const nextStart = dateFromMonthIndex(startIdx + 1, startDay);
  void d;
  return { startDate, endDate: addDays(nextStart, -1) };
}
