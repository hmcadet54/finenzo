import { useMemo, useState } from 'react';
import { Copy, Search, Trash2 } from 'lucide-react';
import Sheet from '../components/Sheet.jsx';
import AmountInput from '../components/AmountInput.jsx';
import { DatePicker, Field, SubscriptionTag, ThemedSelect } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { api, useAddExpense, useApi, useCategories, useSubscriptions } from '../lib/queries.js';
import { parseAmount } from '../lib/money.js';
import { todayStr } from '../lib/dates.js';
import { useUndoDelete } from '../lib/undo.js';

export function CategoryPicker({ value, onChange }) {
  const { data: cats = [] } = useCategories();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (!q.trim()) return cats;
    const query = q.toLowerCase().trim();
    return cats.filter((c) => c.name.toLowerCase().includes(query));
  }, [cats, q]);

  return (
    <div className="space-y-2">
      {cats.length > 5 && (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            className="field !h-9 pl-9 pr-7 text-xs"
            placeholder="Search categories…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-ink font-semibold"
              aria-label="Clear category search"
            >
              ✕
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pr-1" role="group" aria-label="Category">
        <button
          type="button"
          className="chip !min-h-[38px] !px-3 text-xs"
          aria-pressed={!value}
          onClick={() => onChange(null)}
        >
          None
        </button>
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            className="chip !min-h-[38px] !px-3 text-xs"
            aria-pressed={value === c.id}
            onClick={() => onChange(c.id)}
          >
            <span aria-hidden>{c.icon}</span> {c.name}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-muted py-1">No matching categories</p>
        )}
      </div>
    </div>
  );
}

function ExpenseForm({ expense, onClose }) {
  const { toast } = useToast();
  const undo = useUndoDelete();
  const editing = !!expense;
  const { data: subsData } = useSubscriptions();
  const subs = subsData?.items ?? [];

  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [label, setLabel] = useState(expense?.label ?? '');
  const [date, setDate] = useState(expense?.date ?? todayStr());
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? null);
  const [subscriptionId, setSubscriptionId] = useState(expense?.subscriptionId ?? null);
  const [note, setNote] = useState(expense?.note ?? '');
  const [error, setError] = useState('');

  const add = useAddExpense();
  const update = useApi((body) => api.patch(`/expenses/${expense.id}`, body));
  const value = parseAmount(amount);
  const valid = value > 0 && label.trim();

  const selectedSub = subs.find((s) => s.id === subscriptionId);

  const handleSubChange = (e) => {
    const val = e.target.value || null;
    setSubscriptionId(val);
    if (val) {
      const found = subs.find((s) => s.id === val);
      if (found) {
        if (!label.trim()) setLabel(found.name);
        if (!categoryId && found.categoryId) setCategoryId(found.categoryId);
        if (!amount && found.amount) setAmount(String(found.amount));
      }
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return setError('Enter an amount and a label');
    const body = {
      amount,
      label: label.trim(),
      date,
      categoryId,
      subscriptionId: subscriptionId || null,
      note,
    };
    if (editing) {
      update.mutate(body, { onError: (er) => toast(er.message, { tone: 'error' }) });
      toast('Expense updated');
    } else {
      add.mutate({ ...body, amountValue: value }, { onError: (er) => toast(er.message, { tone: 'error' }) });
      toast(`Added ${label.trim()}`);
    }
    onClose();
  };

  const duplicate = () => {
    add.mutate({
      amount: expense.amount,
      label: expense.label,
      date: todayStr(),
      categoryId: expense.categoryId,
      subscriptionId: expense.subscriptionId || null,
      note: expense.note,
      amountValue: expense.amount,
    });
    toast('Duplicated for today');
    onClose();
  };

  const remove = () => {
    onClose();
    undo(expense.id, `Deleted “${expense.label}”`, () => api.del(`/expenses/${expense.id}`));
  };

  return (
    <form onSubmit={submit} className="space-y-4 pb-2" noValidate>
      <AmountInput value={amount} onChange={setAmount} autoFocus={false} />
      <Field label="Label">
        <input
          className="field"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="What was it for?"
          maxLength={120}
          enterKeyHint="next"
        />
      </Field>
      <Field label="Date">
        <DatePicker value={date} onChange={setDate} required />
      </Field>

      <div>
        <span className="label">Category</span>
        <CategoryPicker value={categoryId} onChange={setCategoryId} />
      </div>

      <div>
        <span className="label">Attach to subscription (optional)</span>
        <ThemedSelect
          value={subscriptionId || ''}
          onChange={(val) => {
            const chosen = val || null;
            setSubscriptionId(chosen);
            if (chosen) {
              const found = subs.find((s) => s.id === chosen);
              if (found) {
                if (!label.trim()) setLabel(found.name);
                if (!categoryId && found.categoryId) setCategoryId(found.categoryId);
                if (!amount && found.amount) setAmount(String(found.amount));
              }
            }
          }}
          placeholder="None (Standard expense)"
          options={[
            { value: '', label: 'None (Standard expense)' },
            ...subs.map((s) => ({
              value: s.id,
              label: s.name,
              subLabel: `${s.billingCycle === 'manual' ? 'Manual' : s.billingCycle} · Rs ${s.amount}`,
              icon: (
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: s.color || '#D97757' }}
                />
              ),
              badge: s.dueCharges?.length > 0 ? 'Due now' : s.isManual ? 'Manual' : undefined,
            })),
          ]}
          ariaLabel="Attach to subscription"
        />
        {selectedSub && (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-xs text-muted">Attached tag preview:</span>
            <SubscriptionTag subscription={selectedSub} isPaid={true} />
          </div>
        )}
      </div>

      <Field label="Note (optional)">
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div
        className="sticky bottom-0 -mx-5 flex gap-2 bg-bg px-5 pt-3"
        style={{ paddingBottom: 'max(18px, calc(10px + env(safe-area-inset-bottom)))' }}
      >
        {editing && (
          <>
            <button type="button" className="btn btn-danger" onClick={remove} aria-label="Delete expense">
              <Trash2 size={18} />
            </button>
            <button type="button" className="btn btn-ghost" onClick={duplicate} aria-label="Duplicate expense">
              <Copy size={18} />
            </button>
          </>
        )}
        <button type="submit" className="btn btn-primary flex-1" disabled={!valid}>
          {editing ? 'Save changes' : 'Add expense'}
        </button>
      </div>
    </form>
  );
}

export default function ExpenseSheet({ open, onClose, expense }) {
  return (
    <Sheet open={open} onClose={onClose} title={expense ? 'Edit expense' : 'Add expense'} autoFocus={false}>
      <ExpenseForm expense={expense} onClose={onClose} />
    </Sheet>
  );
}
