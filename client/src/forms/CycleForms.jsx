import { useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import Sheet from '../components/Sheet.jsx';
import AmountInput from '../components/AmountInput.jsx';
import { Field } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { useCycle } from '../context/CycleContext.jsx';
import { api, useApi } from '../lib/queries.js';
import { cycleLabel, todayStr } from '../lib/dates.js';
import { parseAmount } from '../lib/money.js';
import { useUndoDelete } from '../lib/undo.js';

/** ‹ 1 Oct – 31 Oct 2026 › — switches between current and past cycles. */
export function CycleSwitcher({ className = '' }) {
  const { cycles, selectedId, setSelectedId } = useCycle();
  if (!cycles.length) return null;
  // cycles are newest-first; index 0 is the latest (current)
  const idx = Math.max(0, selectedId ? cycles.findIndex((c) => c.id === selectedId) : 0);
  const go = (delta) => {
    const next = cycles[idx + delta];
    if (next) setSelectedId(idx + delta === 0 ? null : next.id);
  };
  const cur = cycles[idx];
  return (
    <div className={`flex items-center justify-between rounded-xl bg-surface-2 p-1 ${className}`}>
      <button className="grid h-11 w-11 place-items-center rounded-lg text-muted disabled:opacity-30" onClick={() => go(1)} disabled={idx >= cycles.length - 1} aria-label="Previous cycle">
        <ChevronLeft size={20} />
      </button>
      <div className="text-center leading-tight">
        <p className="text-sm font-semibold">{cycleLabel(cur)}</p>
        <p className="text-xs text-muted">{idx === 0 ? 'Current cycle' : 'Past cycle'}</p>
      </div>
      <button className="grid h-11 w-11 place-items-center rounded-lg text-muted disabled:opacity-30" onClick={() => go(-1)} disabled={idx === 0} aria-label="Next cycle">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function StartingForm({ cycle, onClose }) {
  const { toast } = useToast();
  const [expr, setExpr] = useState(cycle.startingExpression || (cycle.startingBalance ? String(cycle.startingBalance) : ''));
  const save = useApi((body) => api.patch(`/cycles/${cycle.id}`, body), {
    onSuccess: () => {
      toast('Starting balance updated');
      onClose();
    },
    onError: (e) => toast(e.message, { tone: 'error' }),
  });
  const ok = parseAmount(expr) != null;
  return (
    <form
      className="space-y-4 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) save.mutate({ startingBalance: expr, startingExpression: expr.trim() });
      }}
    >
      <p className="text-sm text-muted">Add up several sources if you like — e.g. <code className="rounded bg-surface-2 px-1">122K + 30k + 30k</code>. We’ll keep the breakdown visible.</p>
      <AmountInput label="Starting balance" value={expr} onChange={setExpr} allowNegative autoFocus />
      <button className="btn btn-primary w-full" disabled={!ok || save.isPending}>
        Save
      </button>
    </form>
  );
}

export function StartingBalanceSheet({ open, onClose, cycle }) {
  return (
    <Sheet open={open && !!cycle} onClose={onClose} title="Starting balance">
      {cycle && <StartingForm cycle={cycle} onClose={onClose} />}
    </Sheet>
  );
}

function IncomeForm({ income, onClose }) {
  const { toast } = useToast();
  const undo = useUndoDelete();
  const [amount, setAmount] = useState(income ? String(income.amount) : '');
  const [label, setLabel] = useState(income?.label ?? '');
  const [date, setDate] = useState(income?.date ?? todayStr());
  const save = useApi((body) => (income ? api.patch(`/income/${income.id}`, body) : api.post('/income', body)), {
    onSuccess: () => {
      toast(income ? 'Income updated' : 'Top-up added');
      onClose();
    },
    onError: (e) => toast(e.message, { tone: 'error' }),
  });
  const ok = parseAmount(amount) > 0 && label.trim();
  return (
    <form
      className="space-y-4 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) save.mutate({ amount, label: label.trim(), date });
      }}
    >
      <AmountInput value={amount} onChange={setAmount} autoFocus />
      <Field label="Label">
        <input className="field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Salary bonus, refund, top-up…" maxLength={120} />
      </Field>
      <Field label="Date">
        <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        {income && (
          <button
            type="button"
            className="btn btn-danger"
            aria-label="Delete income"
            onClick={() => {
              onClose();
              undo(income.id, `Deleted “${income.label}”`, () => api.del(`/income/${income.id}`));
            }}
          >
            <Trash2 size={18} />
          </button>
        )}
        <button className="btn btn-primary flex-1" disabled={!ok || save.isPending}>
          {income ? 'Save changes' : 'Add income'}
        </button>
      </div>
    </form>
  );
}

export function IncomeSheet({ open, onClose, income }) {
  return (
    <Sheet open={open} onClose={onClose} title={income ? 'Edit income' : 'Add income / top-up'}>
      <IncomeForm income={income} onClose={onClose} />
    </Sheet>
  );
}

function CloseForm({ cycle, remaining, onClose }) {
  const { toast } = useToast();
  const { setSelectedId } = useCycle();
  const [carry, setCarry] = useState(true);
  const close = useApi((body) => api.post(`/cycles/${cycle.id}/close`, body), {
    onSuccess: () => {
      setSelectedId(null);
      toast('New cycle started');
      onClose();
    },
    onError: (e) => toast(e.message, { tone: 'error' }),
  });
  return (
    <div className="space-y-4 pb-2">
      <p className="text-sm text-muted">This closes <strong>{cycleLabel(cycle)}</strong> and opens the next cycle. Past cycles stay available to view and edit.</p>
      <label className="card flex min-h-[56px] items-center gap-3 p-3">
        <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--accent))]" checked={carry} onChange={(e) => setCarry(e.target.checked)} />
        <span>
          Carry over remaining balance
          <span className="block text-sm text-muted">{remaining} becomes the next starting balance</span>
        </span>
      </label>
      <button className="btn btn-primary w-full" disabled={close.isPending} onClick={() => close.mutate({ carryOver: carry })}>
        Close cycle &amp; start next
      </button>
    </div>
  );
}

export function CloseCycleSheet({ open, onClose, cycle, remaining }) {
  return (
    <Sheet open={open && !!cycle} onClose={onClose} title="Start next cycle">
      {cycle && <CloseForm cycle={cycle} remaining={remaining} onClose={onClose} />}
    </Sheet>
  );
}
