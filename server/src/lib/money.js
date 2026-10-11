/**
 * Smart amount parser. Money is handled as integers (whole rupees).
 * Supports: `500`, `1,500`, `5k`, `1.5k`, `2K`, `1.2m`, `Rs 3k`, sums/differences like `3k + 500`.
 * Returns an integer, or `null` if the input is not a valid amount expression.
 */
const MULT = { k: 1_000, m: 1_000_000 };
const TERM = String.raw`(?:\d+(?:\.\d+)?|\.\d+)[kKmM]?`;
const EXPR_RE = new RegExp(`^[+-]?${TERM}(?:[+-]${TERM})*$`);

export function parseAmount(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input) : null;
  if (typeof input !== 'string') return null;
  const s = input
    .replace(/^\s*(?:rs\.?|pkr)/i, '')
    .replace(/[\s,]/g, '');
  if (!s || !EXPR_RE.test(s)) return null;
  const parts = s.match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)[kKmM]?/g);
  let total = 0;
  for (const part of parts) {
    const sign = part.startsWith('-') ? -1 : 1;
    const body = part.replace(/^[+-]/, '');
    const suffix = body.slice(-1).toLowerCase();
    const mult = MULT[suffix];
    const num = parseFloat(mult ? body.slice(0, -1) : body);
    total += sign * num * (mult ?? 1);
  }
  const rounded = Math.round(total);
  return Number.isSafeInteger(rounded) ? rounded : null;
}

/** Regex source matching an amount expression at the start of a note line. */
export const AMOUNT_EXPR_SRC = String.raw`\d[\d,]*(?:\.\d+)?(?:[kKmM](?![a-zA-Z]))?(?:\s*\+\s*\d[\d,]*(?:\.\d+)?(?:[kKmM](?![a-zA-Z]))?)*`;
