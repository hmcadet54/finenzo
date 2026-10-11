import { useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import Sheet from '../components/Sheet.jsx';
import { useToast } from '../components/Toast.jsx';
import { api, useApi } from '../lib/queries.js';
import { describeExpression, formatMoney, parseAmount } from '../lib/money.js';
import { useFmt } from '../context/AuthContext.jsx';

const PLACEHOLDER = `STARTING BALANCE : 122K + 30k + 30k : 182k

5k : Qari faiz 4oct
2k : Shayan 3oct
1.5k movie box
-----------------
Total : 8.5k`;

const rowValid = (r) => parseAmount(r.amount) > 0 && r.label.trim() && /^\d{4}-\d{2}-\d{2}$/.test(r.date);

function BulkForm({ onClose }) {
  const fmt = useFmt();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [rows, setRows] = useState([]);
  const [applyStart, setApplyStart] = useState(true);
  const [busy, setBusy] = useState(false);

  const preview = async () => {
    setBusy(true);
    try {
      const res = await api.post('/expenses/parse', { text });
      setResult(res);
      setRows(
        res.rows.map((r, i) => ({
          key: i,
          needsReview: !r.ok,
          amount: r.amount ? String(r.amount) : '',
          label: r.ok ? r.label : r.raw.trim(),
          date: r.date ?? new Date().toLocaleDateString('en-CA'),
          error: r.error,
        })),
      );
    } catch (e) {
      toast(e.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const importAll = useApi((body) => api.post('/expenses/bulk', body), {
    onSuccess: (res) => {
      toast(`Imported ${res.items.length} expenses`);
      onClose();
    },
    onError: (e) => toast(e.message, { tone: 'error' }),
  });

  const edit = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, needsReview: patch.amount !== undefined ? false : r.needsReview } : r)));
  const valid = rows.filter(rowValid);
  const sum = valid.reduce((s, r) => s + parseAmount(r.amount), 0);
  const unresolved = rows.length - valid.length;
  const mismatch = result?.declaredTotal != null && result.declaredTotal !== sum;

  if (!result) {
    return (
      <div className="space-y-3 pb-2">
        <p className="text-sm text-muted">Paste your notes. One expense per line: <code className="rounded bg-surface-2 px-1">amount : label date</code>. Dashed lines and “Total :” lines are handled for you.</p>
        <textarea className="field font-mono text-[15px]" rows={10} placeholder={PLACEHOLDER} value={text} onChange={(e) => setText(e.target.value)} aria-label="Pasted notes" spellCheck={false} />
        <button className="btn btn-primary w-full" disabled={!text.trim() || busy} onClick={preview}>
          {busy ? 'Reading…' : 'Preview'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-2">
      <div className="card flex items-center justify-between p-3">
        <div>
          <p className="text-xs text-muted">Parsed total</p>
          <p className="serif-num text-xl font-medium">{formatMoney(sum, { compact: false })}</p>
        </div>
        <div className="text-right text-sm">
          {result.declaredTotal != null && (
            <p className={mismatch ? 'font-semibold text-danger' : 'font-medium text-success'}>
              {mismatch ? <AlertTriangle className="mr-1 inline" size={15} /> : <CheckCircle2 className="mr-1 inline" size={15} />}
              Note says {formatMoney(result.declaredTotal, { compact: false })}
            </p>
          )}
          <p className="text-muted">{valid.length} of {rows.length} lines ready</p>
        </div>
      </div>
      {mismatch && (
        <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger" role="alert">
          The “Total” in your note ({fmt(result.declaredTotal)}) differs from the parsed sum ({fmt(sum)}) by {fmt(Math.abs(result.declaredTotal - sum))}. Check the rows below.
        </p>
      )}
      {result.startingBalance && (
        <label className="card flex min-h-[44px] items-center gap-3 p-3 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--accent))]" checked={applyStart} onChange={(e) => setApplyStart(e.target.checked)} />
          <span>
            Set starting balance to <strong>{describeExpression(result.startingBalance.expression, { compact: false })}</strong>
          </span>
        </label>
      )}
      <ul className="space-y-2">
        {rows.map((r) => {
          const ok = rowValid(r);
          return (
            <li key={r.key} className={`rounded-xl border p-2.5 ${ok ? 'border-line bg-surface' : 'border-danger/50 bg-danger-soft'}`}>
              {r.needsReview && (
                <p className="mb-1.5 px-1 text-xs font-semibold text-danger">Needs review: {r.error}</p>
              )}
              <div className="flex items-center gap-2">
                <input className="field !h-11 w-24 serif-num" value={r.amount} onChange={(e) => edit(r.key, { amount: e.target.value })} aria-label="Amount" inputMode="text" placeholder="amount" />
                <input className="field !h-11 min-w-0 flex-1" value={r.label} onChange={(e) => edit(r.key, { label: e.target.value })} aria-label="Label" />
                <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Remove row">
                  <X size={18} />
                </button>
              </div>
              <input type="date" className="field !h-10 mt-2 text-sm" value={r.date} onChange={(e) => edit(r.key, { date: e.target.value })} aria-label="Date" />
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-0 -mx-5 flex gap-2 bg-bg px-5 pb-1 pt-3">
        <button className="btn btn-ghost" onClick={() => setResult(null)}>
          Back
        </button>
        <button
          className="btn btn-primary flex-1"
          disabled={!valid.length || unresolved > 0 || importAll.isPending}
          onClick={() =>
            importAll.mutate({
              rows: valid.map((r) => ({ amount: r.amount, label: r.label.trim(), date: r.date })),
              ...(result.startingBalance && applyStart ? { startingBalance: { expression: result.startingBalance.expression } } : {}),
            })
          }
        >
          {unresolved > 0 ? `Fix ${unresolved} line${unresolved > 1 ? 's' : ''} or remove` : `Import ${valid.length} expenses`}
        </button>
      </div>
    </div>
  );
}

export default function BulkImportSheet({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="Paste & import">
      <BulkForm onClose={onClose} />
    </Sheet>
  );
}
