import { addDays, differenceInCalendarDays, format, isSameYear, parseISO } from 'date-fns';

export const toDateStr = (d) => format(d, 'yyyy-MM-dd');
export const todayStr = () => toDateStr(new Date());
export const parseDate = (s) => parseISO(s);

export function niceDate(s) {
  if (!s) return '';
  const d = parseISO(s);
  return format(d, isSameYear(d, new Date()) ? 'd MMM' : 'd MMM yyyy');
}

export function dayHeading(s) {
  const diff = differenceInCalendarDays(parseISO(s), new Date());
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  return format(parseISO(s), 'EEE, d MMM');
}

export function cycleLabel(c) {
  if (!c) return '';
  const a = parseISO(c.startDate);
  const b = parseISO(c.endDate);
  return `${format(a, 'd MMM')} – ${format(b, 'd MMM yyyy')}`;
}

export function inDays(n) {
  if (n == null) return '';
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 0) return `${-n}d ago`;
  return `in ${n} days`;
}

export const daysUntil = (s) => differenceInCalendarDays(parseISO(s), new Date());
export { addDays };
