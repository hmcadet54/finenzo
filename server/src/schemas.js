import { z } from 'zod';
import { parseAmount } from './lib/money.js';
import { isValidDateStr } from './lib/dates.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const dateStr = z.string().refine(isValidDateStr, 'Expected a valid YYYY-MM-DD date');

const amountBase = z
  .union([z.number(), z.string().max(80)])
  .transform((v) => (typeof v === 'number' ? Math.round(v) : parseAmount(v)))
  .refine((v) => v !== null && Number.isSafeInteger(v), 'Invalid amount');

/** Accepts a number or an expression like `3k + 500`. Always yields a positive integer. */
export const amount = amountBase.refine((v) => v > 0, 'Amount must be greater than zero');
/** Same, but zero/negative allowed (starting balances). */
export const signedAmount = amountBase;

const text = (max) => z.string().trim().max(max);
const optionalId = objectId.nullable().optional();

export const schemas = {
  googleLogin: z.object({ idToken: z.string().min(10).max(5000) }),

  settingsPatch: z
    .object({
      name: text(80).optional(),
      settings: z
        .object({
          accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          currency: text(8),
          compactNumbers: z.boolean(),
          cycleStartDay: z.number().int().min(1).max(31),
          autoPostSubscriptions: z.boolean(),
          timezone: text(64).refine((tz) => {
            try {
              new Intl.DateTimeFormat('en', { timeZone: tz });
              return true;
            } catch {
              return false;
            }
          }, 'Unknown timezone'),
          themeMode: z.enum(['light', 'dark', 'system']).optional(),
          bg: z.string().regex(/^#[0-9a-fA-F]{6}$/).or(z.literal('')).optional(),
        })
        .partial()
        .optional(),
    })
    .strict(),

  cycleCreate: z.object({
    startDate: dateStr,
    startingBalance: signedAmount.optional(),
    startingExpression: text(200).optional(),
  }),
  cyclePatch: z.object({
    startingBalance: signedAmount.optional(),
    startingExpression: text(200).optional(),
  }),
  cycleClose: z.object({ carryOver: z.boolean().default(true) }),

  expenseCreate: z.object({
    amount,
    label: text(120).min(1),
    date: dateStr.optional(),
    categoryId: optionalId,
    subscriptionId: optionalId,
    source: z.enum(['manual', 'subscription', 'loan', 'import']).optional(),
    note: text(500).optional(),
  }),
  expensePatch: z.object({
    amount: amount.optional(),
    label: text(120).min(1).optional(),
    date: dateStr.optional(),
    categoryId: optionalId,
    subscriptionId: optionalId,
    source: z.enum(['manual', 'subscription', 'loan', 'import']).optional(),
    note: text(500).optional(),
  }),
  expenseQuery: z.object({
    cycleId: objectId.optional(),
    from: dateStr.optional(),
    to: dateStr.optional(),
    categoryId: objectId.optional(),
    q: text(100).optional(),
    limit: z.coerce.number().int().min(1).max(2000).default(1000),
  }),
  parseBody: z.object({ text: z.string().max(100_000) }),
  bulk: z.object({
    rows: z
      .array(
        z.object({
          amount,
          label: text(120).min(1),
          date: dateStr.optional(),
          categoryId: optionalId,
          note: text(500).optional(),
        }),
      )
      .min(1)
      .max(500),
    startingBalance: z.object({ expression: text(200) }).optional(),
  }),

  incomeCreate: z.object({ amount, label: text(120).min(1), date: dateStr.optional() }),
  incomePatch: z.object({
    amount: amount.optional(),
    label: text(120).min(1).optional(),
    date: dateStr.optional(),
  }),

  categoryCreate: z.object({
    name: text(40).min(1),
    icon: text(8).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  }),
  categoryPatch: z.object({
    name: text(40).min(1).optional(),
    icon: text(8).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  }),

  subscriptionCreate: z.object({
    name: text(80).min(1),
    lineItems: z.array(z.object({ label: text(60).optional(), amount })).min(1).max(10),
    billingCycle: z.enum(['monthly', 'quarterly', 'yearly', 'custom', 'manual']),
    intervalMonths: z.number().int().min(1).max(60).optional(),
    anchorDay: z.number().int().min(1).max(31).optional(),
    anchorMonth: z.number().int().min(1).max(12).optional(),
    anchorYear: z.number().int().min(2000).max(2200).optional(),
    categoryId: optionalId,
    note: text(500).optional(),
    color: text(20).optional(),
    icon: text(8).optional(),
  }),
  subscriptionPatch: z.object({
    name: text(80).min(1).optional(),
    lineItems: z.array(z.object({ label: text(60).optional(), amount })).min(1).max(10).optional(),
    billingCycle: z.enum(['monthly', 'quarterly', 'yearly', 'custom', 'manual']).optional(),
    intervalMonths: z.number().int().min(1).max(60).optional(),
    anchorDay: z.number().int().min(1).max(31).optional(),
    anchorMonth: z.number().int().min(1).max(12).optional(),
    anchorYear: z.number().int().min(2000).max(2200).optional(),
    status: z.enum(['active', 'paused', 'cancelled']).optional(),
    categoryId: optionalId,
    note: text(500).optional(),
    color: text(20).optional(),
    icon: text(8).optional(),
  }),
  subscriptionAction: z.object({ chargeId: objectId.optional(), date: dateStr.optional() }),

  friendCreate: z.object({ name: text(80).min(1), phone: text(30).optional(), note: text(500).optional() }),
  friendPatch: z.object({
    name: text(80).min(1).optional(),
    phone: text(30).optional(),
    note: text(500).optional(),
  }),
  loanCreate: z.object({
    friendId: objectId,
    direction: z.enum(['lent', 'borrowed']).default('lent'),
    amount,
    dateLent: dateStr.optional(),
    expectedReturnDate: dateStr.nullable().optional(),
    note: text(500).optional(),
    createLinked: z.boolean().default(false),
  }),
  loanPatch: z.object({
    direction: z.enum(['lent', 'borrowed']).optional(),
    amount: amount.optional(),
    dateLent: dateStr.optional(),
    expectedReturnDate: dateStr.nullable().optional(),
    note: text(500).optional(),
  }),
  repayment: z.object({
    amount,
    date: dateStr.optional(),
    note: text(300).optional(),
    createLinked: z.boolean().default(false),
  }),
};
