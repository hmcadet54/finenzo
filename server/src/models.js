import mongoose from 'mongoose';

const { Schema } = mongoose;
const dateStr = { type: String, match: /^\d{4}-\d{2}-\d{2}$/ };
const userRef = { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true };

const opts = {
  timestamps: true,
  toJSON: {
    versionKey: false,
    transform(_doc, ret) {
      ret.id = String(ret._id);
      delete ret._id;
      return ret;
    },
  },
};

const mk = (name, def, indexes = []) => {
  const schema = new Schema(def, opts);
  indexes.forEach((args) => schema.index(...args));
  return mongoose.models[name] ?? mongoose.model(name, schema);
};

export const User = mk(
  'User',
  {
    googleId: { type: String, required: true, unique: true },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    picture: { type: String, default: '' },
    settings: {
      accent: { type: String, default: '#D97757' },
      currency: { type: String, default: 'PKR' },
      compactNumbers: { type: Boolean, default: true },
      cycleStartDay: { type: Number, default: 1, min: 1, max: 31 },
      autoPostSubscriptions: { type: Boolean, default: false },
      timezone: { type: String, default: 'Asia/Karachi' },
    },
  },
  [],
);

export const Cycle = mk(
  'Cycle',
  {
    userId: userRef,
    startDate: { ...dateStr, required: true },
    endDate: { ...dateStr, required: true },
    startingBalance: { type: Number, default: 0 },
    startingExpression: { type: String, default: '' },
    carriedOver: { type: Boolean, default: false },
    closed: { type: Boolean, default: false },
  },
  [[{ userId: 1, startDate: 1 }]],
);

export const Category = mk('Category', {
  userId: userRef,
  name: { type: String, required: true, trim: true, maxlength: 40 },
  icon: { type: String, default: '📦' },
  color: { type: String, default: '#8A8782' },
});

export const Expense = mk(
  'Expense',
  {
    userId: userRef,
    cycleId: { type: Schema.Types.ObjectId, ref: 'Cycle', required: true },
    amount: { type: Number, required: true },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    date: { ...dateStr, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    note: { type: String, default: '', maxlength: 500 },
    source: { type: String, enum: ['manual', 'subscription', 'loan', 'import'], default: 'manual' },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null },
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', default: null },
    repaymentId: { type: Schema.Types.ObjectId, default: null },
  },
  [[{ userId: 1, cycleId: 1, date: -1 }]],
);

export const Income = mk(
  'Income',
  {
    userId: userRef,
    cycleId: { type: Schema.Types.ObjectId, ref: 'Cycle', required: true },
    amount: { type: Number, required: true },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    date: { ...dateStr, required: true },
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', default: null },
    repaymentId: { type: Schema.Types.ObjectId, default: null },
  },
  [[{ userId: 1, cycleId: 1, date: -1 }]],
);

export const Subscription = mk(
  'Subscription',
  {
    userId: userRef,
    name: { type: String, required: true, trim: true, maxlength: 80 },
    lineItems: [{ _id: false, label: { type: String, default: '' }, amount: Number }],
    amount: { type: Number, required: true },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly', 'custom', 'manual'],
      required: true,
    },
    intervalMonths: { type: Number, default: 1 },
    anchorDay: { type: Number, default: 1 },
    anchorMonth: { type: Number, default: 1 },
    anchorYear: { type: Number, required: true },
    nextRenewal: { ...dateStr, default: null },
    status: { type: String, enum: ['active', 'paused', 'cancelled'], default: 'active' },
    isManual: { type: Boolean, default: false },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    note: { type: String, default: '', maxlength: 500 },
    color: { type: String, default: '' },
    icon: { type: String, default: '' },
    priceHistory: [{ _id: false, amount: Number, date: dateStr }],
  },
  [[{ userId: 1, nextRenewal: 1 }], [{ nextRenewal: 1 }]],
);

export const SubscriptionCharge = mk(
  'SubscriptionCharge',
  {
    userId: userRef,
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
    dueDate: { ...dateStr, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['due', 'paid', 'skipped'], default: 'due' },
    expenseId: { type: Schema.Types.ObjectId, ref: 'Expense', default: null },
  },
  [[{ subscriptionId: 1, dueDate: 1 }]],
);

export const Friend = mk('Friend', {
  userId: userRef,
  name: { type: String, required: true, trim: true, maxlength: 80 },
  phone: { type: String, default: '', maxlength: 30 },
  note: { type: String, default: '', maxlength: 500 },
});

export const Loan = mk('Loan', {
  userId: userRef,
  friendId: { type: Schema.Types.ObjectId, ref: 'Friend', required: true, index: true },
  direction: { type: String, enum: ['lent', 'borrowed'], default: 'lent' },
  amount: { type: Number, required: true, min: 1 },
  dateLent: { ...dateStr, required: true },
  expectedReturnDate: { ...dateStr, default: null },
  note: { type: String, default: '', maxlength: 500 },
  repayments: [
    {
      amount: { type: Number, required: true, min: 1 },
      date: { ...dateStr, required: true },
      note: { type: String, default: '' },
    },
  ],
});

export const DATA_MODELS = { Cycle, Category, Expense, Income, Subscription, SubscriptionCharge, Friend, Loan };
