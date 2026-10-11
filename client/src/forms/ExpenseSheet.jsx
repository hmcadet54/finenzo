import { useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import Sheet from '../components/Sheet.jsx';
import AmountInput from '../components/AmountInput.jsx';
import { Field } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { api, useAddExpense, useApi, useCategories } from '../lib/queries.js';
import { parseAmount } from '../lib/money.js';
import { todayStr } from '../lib/dates.js';
import { useUndoDelete } from '../lib/undo.js';

export function CategoryPicker({ value, onChange }) {
  const { data: cats = [] } = useCategories();
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar" role="group" aria-label="Category">
      <button type="button" className="chip" aria-pressed={!value} onClick={() => onChange(null)}>
        None
      </button>
      {cats.map((c) => (
        <button key={c.id} type="button" className="chip" aria-pressed={value === c.id} onClick={() => onChange(c.id)}>
          <span aria-hidden>{c.icon}</span> {c.name}
        </button>
      ))}
    </div>
  );
}

function ExpenseForm({ expense, onClose }) {
  const { toast } = useToast();
  const undo = useUndoDelete();
  const editing = !!expense;
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [label, setLabel] = useState(expense?.label ?? '');
  const [date, setDate] = useState(expense?.date ?? todayStr());
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? null);
  const [note, setNote] = useState(expense?.note ?? '');
  const [error, setError] = useState('');

  const add = useAddExpense();
  const update = useApi((body) => api.patch(`/expenses/${expense.id}`, body));
  const value = parseAmount(amount);
  const valid = value > 0 && label.trim();

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return setError('Enter an amount and a label');
    const body = { amount, label: label.trim(), date, categoryId, note };
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
    add.mutate({ amount: expense.amount, label: expense.label, date: todayStr(), categoryId: expense.categoryId, note: expense.note, amountValue: expense.amount });
    toast('Duplicated for today');
    onClose();
  };

  const remove = () => {
    onClose();
    undo(expense.id, `Deleted “${expense.label}”`, () => api.del(`/expenses/${expense.id}`));
  };

  return (
    <form onSubmit={submit} className="space-y-4 pb-2" noValidate>
      <AmountInput value={amount} onChange={setAmount} autoFocus={!editing} />
      <Field label="Label">
        <input className="field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What was it for?" maxLength={120} enterKeyHint="next" />
      </Field>
      <Field label="Date">
        <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <div>
        <span className="label">Category</span>
        <CategoryPicker value={categoryId} onChange={setCategoryId} />
      </div>
      <Field label="Note (optional)">
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="sticky bottom-0 -mx-5 flex gap-2 bg-bg px-5 pb-1 pt-3">
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
    <Sheet open={open} onClose={onClose} title={expense ? 'Edit expense' : 'Add expense'}>
      <ExpenseForm expense={expense} onClose={onClose} />
    </Sheet>
  );
}
