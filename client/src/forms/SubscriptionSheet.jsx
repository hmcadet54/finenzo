import { useState } from 'react';
import { Ban, Pause, Play, Plus, SkipForward, Trash2, X, CheckCircle2 } from 'lucide-react';
import { getDate, getMonth, getYear, parseISO } from 'date-fns';
import Sheet from '../components/Sheet.jsx';
import AmountInput from '../components/AmountInput.jsx';
import { Field, Money } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { CategoryPicker } from './ExpenseSheet.jsx';
import { api, useApi } from '../lib/queries.js';
import { parseAmount } from '../lib/money.js';
import { niceDate, todayStr } from '../lib/dates.js';
import { useUndoDelete } from '../lib/undo.js';

const CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
  { value: 'manual', label: 'Manual' },
];
const COLORS = ['#D97757', '#4F7DF0', '#3C9A6B', '#8B6FD6', '#D9609A', '#2A9D9A', '#E0A12B', '#8A8782'];

function SubForm({ sub, onClose }) {
  const { toast } = useToast();
  const undo = useUndoDelete();
  const editing = !!sub;
  const [name, setName] = useState(sub?.name ?? '');
  const [lines, setLines] = useState(sub ? sub.lineItems.map((l) => ({ label: l.label ?? '', amount: String(l.amount) })) : [{ label: '', amount: '' }]);
  const [billingCycle, setBillingCycle] = useState(sub?.billingCycle ?? 'monthly');
  const [interval, setIntervalMonths] = useState(String(sub?.intervalMonths ?? 2));
  const [day, setDay] = useState(String(sub?.anchorDay ?? getDate(new Date())));
  const [date, setDate] = useState(sub?.nextRenewal ?? todayStr());
  const [categoryId, setCategoryId] = useState(sub?.categoryId ?? null);
  const [note, setNote] = useState(sub?.note ?? '');
  const [color, setColor] = useState(sub?.color || COLORS[0]);

  const done = (msg) => ({
    onSuccess: () => {
      toast(msg);
      onClose();
    },
    onError: (e) => toast(e.message, { tone: 'error' }),
  });
  const save = useApi((body) => (editing ? api.patch(`/subscriptions/${sub.id}`, body) : api.post('/subscriptions', body)), done(editing ? 'Subscription updated' : 'Subscription added'));
  const act = useApi(({ path, body }) => api.post(`/subscriptions/${sub.id}/${path}`, body ?? {}), {
    onError: (e) => toast(e.message, { tone: 'error' }),
  });
  const setStatus = useApi((status) => api.patch(`/subscriptions/${sub.id}`, { status }), done('Updated'));

  const items = lines.map((l) => ({ label: l.label.trim() || undefined, amount: parseAmount(l.amount) }));
  const total = items.reduce((s, i) => s + (i.amount > 0 ? i.amount : 0), 0);
  const linesOk = items.every((i) => i.amount > 0);
  const ok = name.trim() && linesOk && total > 0 && (billingCycle !== 'custom' || +interval >= 1) && (billingCycle !== 'monthly' || (+day >= 1 && +day <= 31));

  const submit = (e) => {
    e.preventDefault();
    if (!ok) return;
    const body = { name: name.trim(), lineItems: lines.map((l, i) => ({ label: l.label.trim() || undefined, amount: items[i].amount })), billingCycle, categoryId, note, color };
    if (billingCycle === 'custom') body.intervalMonths = +interval;
    const scheduleInput = {};
    if (billingCycle === 'monthly') scheduleInput.anchorDay = +day;
    else if (billingCycle !== 'manual') {
      const d = parseISO(date);
      Object.assign(scheduleInput, { anchorDay: getDate(d), anchorMonth: getMonth(d) + 1, anchorYear: getYear(d) });
    }
    const changed = !editing || billingCycle !== sub.billingCycle || (billingCycle === 'custom' && +interval !== sub.intervalMonths) || (billingCycle === 'monthly' && +day !== sub.anchorDay) || (!['monthly', 'manual'].includes(billingCycle) && date !== sub.nextRenewal);
    save.mutate(changed ? { ...body, ...scheduleInput } : body);
  };

  const setLine = (i, patch) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <form onSubmit={submit} className="space-y-4 pb-2" noValidate>
      <Field label="Name">
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Netflix, Rent, Gym…" maxLength={80} autoFocus={!editing} />
      </Field>

      <div className="space-y-3">
        <span className="label !mb-0">Amount{lines.length > 1 ? ` · total ${total.toLocaleString()}` : ''}</span>
        {lines.map((l, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <AmountInput label={lines.length > 1 ? `Charge ${i + 1}` : 'Per charge'} value={l.amount} onChange={(v) => setLine(i, { amount: v })} placeholder="300" />
            </div>
            {lines.length > 1 && (
              <button type="button" className="mt-7 grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Remove charge" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                <X size={18} />
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-ghost w-full" onClick={() => setLines((ls) => [...ls, { label: '', amount: '' }])}>
          <Plus size={16} /> Add another charge on the same day
        </button>
      </div>

      <div>
        <span className="label">Billing cycle</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Billing cycle">
          {CYCLES.map((c) => (
            <button type="button" key={c.value} className="chip" aria-pressed={billingCycle === c.value} onClick={() => setBillingCycle(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
        {billingCycle === 'manual' && <p className="mt-2 text-sm text-muted">No automatic date. It only shows up when you tap “Charge now”.</p>}
      </div>

      {billingCycle === 'custom' && (
        <Field label="Every how many months?">
          <input className="field" type="number" min={1} max={60} inputMode="numeric" value={interval} onChange={(e) => setIntervalMonths(e.target.value)} />
        </Field>
      )}
      {billingCycle === 'monthly' && (
        <Field label="Day of month" hint="If a month is shorter (e.g. the 31st), it renews on the last day.">
          <input className="field" type="number" min={1} max={31} inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
      )}
      {['quarterly', 'yearly', 'custom'].includes(billingCycle) && (
        <Field label="Next charge date">
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      )}

      <div>
        <span className="label">Category</span>
        <CategoryPicker value={categoryId} onChange={setCategoryId} />
      </div>
      <div>
        <span className="label">Colour</span>
        <div className="flex flex-wrap gap-2.5" role="group" aria-label="Colour">
          {COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setColor(c)} aria-label={`Colour ${c}`} aria-pressed={color === c} className={`grid h-11 w-11 place-items-center rounded-full ring-offset-2 ring-offset-bg ${color === c ? 'ring-2 ring-ink' : ''}`} style={{ background: c }}>
              {color === c && <CheckCircle2 size={18} className="text-white mix-blend-difference" />}
            </button>
          ))}
        </div>
      </div>
      <Field label="Note (optional)">
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>

      {editing && sub.priceHistory?.length > 1 && (
        <div className="card p-3 text-sm">
          <p className="mb-1 font-semibold">Price history</p>
          <ul className="space-y-0.5 text-muted">
            {[...sub.priceHistory].reverse().map((p, i) => (
              <li key={i} className="flex justify-between"><span>{niceDate(p.date)}</span><Money value={p.amount} /></li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Change the amount above and save to record a price change.</p>
        </div>
      )}

      {editing && (
        <div className="grid grid-cols-2 gap-2">
          {sub.status === 'active' && !sub.isManual && (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => act.mutate({ path: 'charge' }, { onSuccess: () => { toast('Paid early · expense added'); onClose(); } })}>
                <CheckCircle2 size={17} /> Mark paid
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => act.mutate({ path: 'skip' }, { onSuccess: () => { toast('Skipped this renewal'); onClose(); } })}>
                <SkipForward size={17} /> Skip next
              </button>
            </>
          )}
          {sub.status === 'active' ? (
            <button type="button" className="btn btn-ghost" onClick={() => setStatus.mutate('paused')}><Pause size={17} /> Pause</button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setStatus.mutate('active')}><Play size={17} /> Resume</button>
          )}
          {sub.status !== 'cancelled' && (
            <button type="button" className="btn btn-ghost" onClick={() => setStatus.mutate('cancelled')}><Ban size={17} /> Cancel</button>
          )}
        </div>
      )}

      <div className="sticky bottom-0 -mx-5 flex gap-2 bg-bg px-5 pb-1 pt-3">
        {editing && (
          <button
            type="button"
            className="btn btn-danger"
            aria-label="Delete subscription"
            onClick={() => {
              onClose();
              undo(sub.id, `Deleted ${sub.name}`, () => api.del(`/subscriptions/${sub.id}`));
            }}
          >
            <Trash2 size={18} />
          </button>
        )}
        <button className="btn btn-primary flex-1" disabled={!ok || save.isPending}>
          {editing ? 'Save changes' : 'Add subscription'}
        </button>
      </div>
    </form>
  );
}

export default function SubscriptionSheet({ open, onClose, sub }) {
  return (
    <Sheet open={open} onClose={onClose} title={sub ? 'Edit subscription' : 'New subscription'}>
      <SubForm sub={sub} onClose={onClose} />
    </Sheet>
  );
}
