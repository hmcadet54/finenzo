import { describe, expect, it } from 'vitest';
import { parseAmount } from '../src/lib/money.js';
import { parseNoteBlock, parseNoteLine } from '../src/lib/noteParser.js';

const today = '2026-10-12';

describe('parseAmount', () => {
  it.each([
    ['500', 500],
    ['5k', 5000],
    ['5K', 5000],
    ['1.5k', 1500],
    ['2K', 2000],
    ['1.2m', 1_200_000],
    ['1,500', 1500],
    ['3k + 500', 3500],
    ['122K + 30k + 30k', 182_000],
    ['Rs 2k', 2000],
    ['10k - 2.5k', 7500],
    ['  1 000 ', 1000],
  ])('%s → %i', (input, expected) => expect(parseAmount(input)).toBe(expected));

  it.each(['', 'abc', '5kk', 'k5', '1..5', '3k +', null, undefined])('rejects %s', (v) =>
    expect(parseAmount(v)).toBeNull(),
  );
});

describe('parseNoteLine', () => {
  it('parses amount : label date', () => {
    expect(parseNoteLine('5k : Qari faiz 4oct', { today })).toMatchObject({
      kind: 'expense', amount: 5000, label: 'Qari faiz', date: '2026-10-04',
    });
  });
  it('accepts no colon', () => {
    expect(parseNoteLine('1.5k movie box', { today })).toMatchObject({
      amount: 1500, label: 'movie box', date: today, dateGuessed: true,
    });
  });
  it.each([
    ['2k : lunch 3 oct', '2026-10-03'],
    ['2k lunch 3oct', '2026-10-03'],
    ['2k lunch Oct 3', '2026-10-03'],
    ['2k lunch 4/10', '2026-10-04'],
    ['2k lunch today', today],
    ['2k lunch yesterday', '2026-10-11'],
    ['2k : lunch 1 January 2025', '2025-01-01'],
  ])('date forms: %s', (line, date) => expect(parseNoteLine(line, { today }).date).toBe(date));

  it('tolerates typos / odd labels', () => {
    expect(parseNoteLine('3k : optp', { today })).toMatchObject({ label: 'optp', amount: 3000 });
    expect(parseNoteLine('5k : withdrwl', { today }).kind).toBe('expense');
    expect(parseNoteLine('1,500 :   weird---label!!', { today }).amount).toBe(1500);
  });
  it('supports sums as the amount', () => {
    expect(parseNoteLine('3k + 500 : snacks', { today })).toMatchObject({ amount: 3500, label: 'snacks' });
  });
  it('does not treat a unit-like word as a suffix', () => {
    expect(parseNoteLine('5 mangoes', { today })).toMatchObject({ amount: 5, label: 'mangoes' });
  });
  it('flags invalid dates and missing amounts instead of dropping', () => {
    expect(parseNoteLine('2k lunch 31 feb', { today }).kind).toBe('error');
    expect(parseNoteLine('lunch with friends', { today }).kind).toBe('error');
  });
  it('skips separators and blanks, reads totals', () => {
    expect(parseNoteLine('-----------------', { today }).kind).toBe('skip');
    expect(parseNoteLine('', { today }).kind).toBe('skip');
    expect(parseNoteLine('Total : 44.5k', { today })).toMatchObject({ kind: 'total', amount: 44500 });
  });
});

const SAMPLE = `STARTING BALANCE : 122K + 30k + 30k : 182k

5k : Qari faiz 4oct
2k : Shayan 3oct
2k : cheat meal 3oct
5k : withdrawl
7k : etsy shop
3k : sabra cameti
3k : withdrwl
1.5k : Google Ai pro

3k : optp
500 : up front

11k : hafiz Group

1.5k movie box
-----------------
Total : 44.5k`;

describe('parseNoteBlock', () => {
  it('sums the sample to 44,500 and matches its declared total', () => {
    const r = parseNoteBlock(SAMPLE, { today });
    expect(r.rows).toHaveLength(12);
    expect(r.needsReview).toHaveLength(0);
    expect(r.sum).toBe(44_500);
    expect(r.declaredTotal).toBe(44_500);
    expect(r.totalMismatch).toBe(false);
    expect(r.startingBalance).toMatchObject({ expression: '122K + 30k + 30k', amount: 182_000, declared: 182_000 });
  });
  it('flags a mismatching total and keeps unparseable lines for review', () => {
    const r = parseNoteBlock('1k : a\n???\nTotal : 5k', { today });
    expect(r.totalMismatch).toBe(true);
    expect(r.needsReview).toHaveLength(1);
    expect(r.needsReview[0].raw).toBe('???');
  });
});
