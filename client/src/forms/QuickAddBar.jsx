import { useEffect, useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { api, useAddExpense } from '../lib/queries.js';
import { niceDate } from '../lib/dates.js';
import { useFmt } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

/** One-line quick add using the note format: `5k : Qari faiz 4oct`, `1.5k movie box`. */
export default function QuickAddBar() {
  const fmt = useFmt();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const add = useAddExpense();

  useEffect(() => {
    if (!text.trim()) {
      setPreview(null);
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.post('/expenses/parse', { text });
        setPreview(res.rows[0] ?? null);
      } catch {
        setPreview(null);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [text]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const res = await api.post('/expenses/parse', { text });
      const row = res.rows[0];
      if (!row?.ok) return toast(row?.error ?? 'Could not understand that line', { tone: 'error' });
      add.mutate(
        { amount: row.amount, label: row.label, date: row.date, amountValue: row.amount },
        { onError: (er) => toast(er.message, { tone: 'error' }) },
      );
      toast(`Added ${fmt(row.amount)} · ${row.label} · ${niceDate(row.date)}`);
      setText('');
    } catch (er) {
      toast(er.message, { tone: 'error' });
    }
  };

  return (
    <form onSubmit={submit} className="card p-2.5" aria-label="Quick add">
      <div className="flex items-center gap-2">
        <input
          className="field border-transparent bg-surface-2"
          placeholder="5k : Lunch 4oct   ·   1.5k movie box"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Quick add expense in one line"
          autoComplete="off"
          autoCapitalize="off"
          enterKeyHint="done"
          id="quick-add-input"
        />
        <button className="btn btn-primary !px-3" aria-label="Add" disabled={!text.trim()}>
          <CornerDownLeft size={20} />
        </button>
      </div>
      {preview && (
        <p className={`num mt-2 px-1 text-sm ${preview.ok ? 'text-muted' : 'text-danger'}`}>
          {preview.ok ? (
            <>
              <strong className="text-ink">{fmt(preview.amount)}</strong> · {preview.label} · {niceDate(preview.date)}
              {preview.dateGuessed ? ' (today)' : ''}
            </>
          ) : (
            preview.error
          )}
        </p>
      )}
    </form>
  );
}
