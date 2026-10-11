import { describe, expect, it } from 'vitest';
import { describeExpression, formatCompact, formatMoney, parseAmount } from '../src/lib/money.js';
import { contrast, deriveTheme, hexToRgb } from '../src/lib/theme.js';

describe('client amount helpers', () => {
  it('parses shorthand', () => {
    expect(parseAmount('122K + 30k + 30k')).toBe(182_000);
    expect(parseAmount('1.2m')).toBe(1_200_000);
    expect(parseAmount('nope')).toBeNull();
  });
  it('formats compact and full', () => {
    expect(formatCompact(182_000)).toBe('182k');
    expect(formatCompact(1500)).toBe('1.5k');
    expect(formatCompact(950)).toBe('950');
    expect(formatMoney(182_000, { compact: false })).toBe('Rs 182,000');
    expect(formatMoney(-2500)).toBe('-Rs 2.5k');
  });
  it('shows the expression with its result', () => {
    expect(describeExpression('122K + 30k + 30k')).toBe('122K + 30k + 30k = 182k');
    expect(describeExpression('5000')).toBe('5k');
  });
});

describe('accent theme', () => {
  it('picks accessible on-accent text for every palette colour', () => {
    for (const hex of ['#D97757', '#4F7DF0', '#3C9A6B', '#8B6FD6', '#D9609A', '#2A9D9A', '#E0A12B', '#000000', '#FFFFFF']) {
      const t = deriveTheme(hex);
      expect(contrast(t.accent, t.onAccent)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.text, [250, 249, 245])).toBeGreaterThanOrEqual(4.5);
    }
    expect(hexToRgb('#D97757')).toEqual([217, 119, 87]);
  });
});
