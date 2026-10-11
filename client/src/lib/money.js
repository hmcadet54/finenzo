/**
 * Amount helpers. `parseAmount` mirrors server/src/lib/money.js (kept tiny on purpose: the client
 * only uses it for live previews; the server always re-parses and is the source of truth).
 */
const MULT = { k: 1_000, m: 1_000_000 };
const TERM = String.raw`(?:\d+(?:\.\d+)?|\.\d+)[kKmM]?`;
const EXPR_RE = new RegExp(`^[+-]?${TERM}(?:[+-]${TERM})*$`);

export function parseAmount(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input) : null;
  if (typeof input !== 'string') return null;
  const s = input.replace(/^\s*(?:rs\.?|pkr)/i, '').replace(/[\s,]/g, '');
  if (!s || !EXPR_RE.test(s)) return null;
  let total = 0;
  for (const part of s.match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)[kKmM]?/g)) {
    const sign = part.startsWith('-') ? -1 : 1;
    const body = part.replace(/^[+-]/, '');
    const mult = MULT[body.slice(-1).toLowerCase()];
    total += sign * parseFloat(mult ? body.slice(0, -1) : body) * (mult ?? 1);
  }
  const r = Math.round(total);
  return Number.isSafeInteger(r) ? r : null;
}

const trim = (n, d) => String(parseFloat(n.toFixed(d)));

/** Display symbols. Amounts are stored as plain integers, so this is presentation only (v1 is single-currency). */
export const CURRENCIES = { PKR: 'Rs', USD: '$', EUR: '€', GBP: '£', INR: '₹', AED: 'AED' };
export const currencySymbol = (code) => CURRENCIES[code] ?? code ?? 'Rs';

export function formatCompact(n) {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1_000_000) return `${sign}${trim(a / 1_000_000, 2)}m`;
  if (a >= 10_000) return `${sign}${trim(a / 1000, 1)}k`;
  if (a >= 1000) return `${sign}${trim(a / 1000, 2)}k`;
  return `${sign}${a}`;
}

export const formatFull = (n) => new Intl.NumberFormat('en-US').format(n);

export function formatMoney(n, { compact = true, prefix = 'Rs' } = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  const body = compact ? formatCompact(n) : formatFull(n);
  return body.startsWith('-') ? `-${prefix} ${body.slice(1)}` : `${prefix} ${body}`;
}

/** "122K + 30k + 30k" → "122K + 30k + 30k = 182k" when it's an actual expression. */
export function describeExpression(expr, { compact = true } = {}) {
  const value = parseAmount(expr);
  if (value == null) return null;
  const isPlain = /^[\d,.\s]+$/.test(expr.trim());
  const shown = compact ? formatCompact(value) : formatFull(value);
  return isPlain ? shown : `${expr.trim()} = ${shown}`;
}
