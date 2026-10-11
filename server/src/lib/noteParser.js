import { AMOUNT_EXPR_SRC, parseAmount } from './money.js';
import { addDays, daysInMonth, isValidDateStr, parseYMD, toStr } from './dates.js';

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH_SRC = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

const DAY_MONTH_RE = new RegExp(
  String.raw`(?:^|\s|:)(\d{1,2})(?:st|nd|rd|th)?\s*(${MONTH_SRC})\.?(?:\s*,?\s*(\d{4}))?\s*$`,
  'i',
);
const MONTH_DAY_RE = new RegExp(
  String.raw`(?:^|\s|:)(${MONTH_SRC})\.?\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\s*$`,
  'i',
);
const SLASH_RE = /(?:^|\s|:)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*$/;
const REL_RE = /(?:^|\s|:)(today|yesterday)\s*$/i;
const LINE_RE = new RegExp(String.raw`^(${AMOUNT_EXPR_SRC})(?=\s|:|$)\s*:?\s*(.*)$`);
const SEPARATOR_RE = /^[\s\-=_*~.]{3,}$/;
const TOTAL_RE = /^total\s*[:=-]?\s*(.*)$/i;
const START_RE = /^starting\s*balance\s*[:=-]?\s*(.*)$/i;

function buildDate(y, m, d) {
  const year = y < 100 ? 2000 + y : y;
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(year, m)) return null;
  return toStr(year, m, d);
}

/** Pull a trailing date off free text. Returns `{ text, date, invalid }`. */
export function extractDate(text, today) {
  const { y: curYear } = parseYMD(today);
  let m = text.match(REL_RE);
  if (m) {
    const date = m[1].toLowerCase() === 'today' ? today : addDays(today, -1);
    return { text: text.slice(0, m.index).trim(), date };
  }
  m = text.match(DAY_MONTH_RE);
  if (m) {
    const date = buildDate(m[3] ? +m[3] : curYear, MONTHS[m[2].toLowerCase()], +m[1]);
    return { text: text.slice(0, m.index).trim(), date, invalid: !date };
  }
  m = text.match(MONTH_DAY_RE);
  if (m) {
    const date = buildDate(m[3] ? +m[3] : curYear, MONTHS[m[1].toLowerCase()], +m[2]);
    return { text: text.slice(0, m.index).trim(), date, invalid: !date };
  }
  m = text.match(SLASH_RE);
  if (m) {
    const date = buildDate(m[3] ? +m[3] : curYear, +m[2], +m[1]); // d/m
    return { text: text.slice(0, m.index).trim(), date, invalid: !date };
  }
  return { text: text.trim(), date: null };
}

/**
 * Parse one line of the note format: `5k : Qari faiz 4oct`, `1.5k movie box`.
 * Returns `{ kind: 'expense'|'total'|'starting'|'skip'|'error', ... }`.
 */
export function parseNoteLine(rawLine, { today }) {
  const raw = rawLine ?? '';
  const line = raw.trim();
  if (!line || SEPARATOR_RE.test(line)) return { kind: 'skip', raw };

  const start = line.match(START_RE);
  if (start) {
    const parts = start[1].split(':').map((p) => p.trim()).filter(Boolean);
    const expression = parts[0] ?? '';
    const amount = parseAmount(expression);
    const declared = parts.length > 1 ? parseAmount(parts[parts.length - 1]) : null;
    if (amount == null) return { kind: 'error', raw, error: 'Could not read starting balance' };
    return { kind: 'starting', raw, expression, amount, declared };
  }

  const total = line.match(TOTAL_RE);
  if (total) {
    const amount = parseAmount(total[1].replace(/^[:=-]\s*/, ''));
    return amount == null
      ? { kind: 'error', raw, error: 'Could not read total' }
      : { kind: 'total', raw, amount };
  }

  const m = line.match(LINE_RE);
  if (!m) return { kind: 'error', raw, error: 'Could not find an amount at the start of the line' };
  const amount = parseAmount(m[1]);
  if (amount == null || amount <= 0) return { kind: 'error', raw, error: 'Invalid amount' };

  const { text, date, invalid } = extractDate(m[2], today);
  if (invalid) return { kind: 'error', raw, amount, error: 'Invalid date' };
  const label = text.replace(/^[\s:\-–]+|[\s:\-–,]+$/g, '').replace(/\s+/g, ' ');
  return {
    kind: 'expense',
    raw,
    amount,
    label: label || 'Expense',
    date: date ?? today,
    dateGuessed: !date,
  };
}

/**
 * Parse a pasted block. Lines that cannot be parsed go to `needsReview`, never dropped.
 */
export function parseNoteBlock(text, { today }) {
  const rows = [];
  const needsReview = [];
  let declaredTotal = null;
  let startingBalance = null;
  const lines = String(text ?? '').split(/\r?\n/);
  lines.forEach((line, i) => {
    const r = parseNoteLine(line, { today });
    if (r.kind === 'expense') {
      rows.push({ line: i + 1, ok: true, ...strip(r) });
    } else if (r.kind === 'error') {
      const row = { line: i + 1, ok: false, raw: r.raw, error: r.error, amount: r.amount ?? null };
      rows.push(row);
      needsReview.push(row);
    } else if (r.kind === 'total') declaredTotal = r.amount;
    else if (r.kind === 'starting') startingBalance = strip(r);
  });
  const sum = rows.reduce((s, r) => (r.ok ? s + r.amount : s), 0);
  return {
    rows,
    needsReview,
    sum,
    declaredTotal,
    totalMismatch: declaredTotal != null && declaredTotal !== sum,
    startingBalance,
  };
}

const strip = ({ kind: _kind, ...rest }) => rest;

export { isValidDateStr };
