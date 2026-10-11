import { useEffect, useMemo, useState } from 'react';
import { FileText, Filter, Plus, Receipt, Search, Wallet } from 'lucide-react';
import { useCycle } from '../context/CycleContext.jsx';
import { api, useCategories, useExpenses, useIncome } from '../lib/queries.js';
import { dayHeading } from '../lib/dates.js';
import { useUndoDelete, useHiddenIds } from '../lib/undo.js';
import { CategoryDot, EmptyState, ErrorState, ListSkeleton, Money, PageHeader, Segmented } from '../components/ui.jsx';
import SwipeRow from '../components/SwipeRow.jsx';
import { useQuickAdd } from '../components/Layout.jsx';
import ExpenseSheet from '../forms/ExpenseSheet.jsx';
import QuickAddBar from '../forms/QuickAddBar.jsx';
import BulkImportSheet from '../forms/BulkImportSheet.jsx';
import { CycleSwitcher, IncomeSheet } from '../forms/CycleForms.jsx';

function groupByDay(items) {
  const groups = [];
  for (const it of items) {
    const g = groups[groups.length - 1];
    if (g && g.date === it.date) g.items.push(it);
    else groups.push({ date: it.date, items: [it] });
  }
  return groups;
}

export default function Expenses() {
  const { selectedId } = useCycle();
  const { openAdd } = useQuickAdd();
  const undo = useUndoDelete();
  const hidden = useHiddenIds();
  const { data: cats = [] } = useCategories();
  const [tab, setTab] = useState('expenses');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editing, setEditing] = useState(null);
  const [editingIncome, setEditingIncome] = useState(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const dateRange = from || to;
  const params = useMemo(
    () => ({ cycleId: dateRange ? undefined : selectedId ?? undefined, q: debouncedQ || undefined, categoryId: categoryId || undefined, from: from || undefined, to: to || undefined }),
    [selectedId, debouncedQ, categoryId, from, to, dateRange],
  );
  const expenses = useExpenses(params);
  const income = useIncome(selectedId ?? undefined);

  const items = (expenses.data ?? []).filter((e) => !hidden.has(e.id));
  const incomeItems = (income.data ?? []).filter((e) => !hidden.has(e.id));
  const groups = useMemo(() => groupByDay(items), [items]);
  const total = items.reduce((s, e) => s + e.amount, 0);
  const activeFilters = [categoryId, from, to].filter(Boolean).length;
  const catOf = (id) => cats.find((c) => c.id === id);

  const del = (e) => undo(e.id, `Deleted “${e.label}”`, () => api.del(`/expenses/${e.id}`));

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="Expenses"
        right={
          <div className="flex gap-2">
            <button className="btn btn-ghost !px-3" onClick={() => setBulkOpen(true)} aria-label="Paste and import">
              <FileText size={18} /> <span className="hidden sm:inline">Paste</span>
            </button>
            <button className="btn btn-primary !px-3 lg:hidden" onClick={openAdd} aria-label="Add expense">
              <Plus size={20} />
            </button>
          </div>
        }
      />
      <CycleSwitcher />
      <Segmented label="Type" value={tab} onChange={setTab} options={[{ value: 'expenses', label: 'Expenses' }, { value: 'income', label: 'Income & top-ups' }]} />

      {tab === 'expenses' && (
        <>
          <QuickAddBar />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input className="field pl-10" type="search" placeholder="Search expenses" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search expenses" />
            </div>
            <button className="btn btn-ghost relative" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} aria-label="Filters">
              <Filter size={18} />
              {activeFilters > 0 && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-on-accent">{activeFilters}</span>}
            </button>
          </div>
          {showFilters && (
            <div className="card space-y-3 p-4">
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 no-scrollbar" role="group" aria-label="Filter by category">
                <button className="chip" aria-pressed={!categoryId} onClick={() => setCategoryId('')}>All</button>
                {cats.map((c) => (
                  <button key={c.id} className="chip" aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                    <span aria-hidden>{c.icon}</span> {c.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label><span className="label">From</span><input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
                <label><span className="label">To</span><input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} /></label>
              </div>
              {activeFilters > 0 && (
                <button className="btn btn-ghost w-full" onClick={() => { setCategoryId(''); setFrom(''); setTo(''); }}>Clear filters</button>
              )}
            </div>
          )}

          {expenses.isLoading && <ListSkeleton />}
          {expenses.error && <ErrorState error={expenses.error} onRetry={expenses.refetch} />}
          {expenses.data && items.length === 0 && (
            <EmptyState
              icon={Receipt}
              title={debouncedQ || activeFilters ? 'No matches' : 'No expenses yet'}
              text={debouncedQ || activeFilters ? 'Try a different search or clear the filters.' : 'Type something like “5k : lunch” above, tap + , or paste your notes.'}
              action={!debouncedQ && !activeFilters && <button className="btn btn-primary" onClick={() => setBulkOpen(true)}>Paste notes</button>}
            />
          )}
          {items.length > 0 && (
            <p className="num px-1 text-sm text-muted">{items.length} expense{items.length === 1 ? '' : 's'} · <strong className="text-ink"><Money value={total} /></strong></p>
          )}
          {groups.map((g) => (
            <section key={g.date} aria-label={dayHeading(g.date)}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h2 className="text-lg font-medium">{dayHeading(g.date)}</h2>
                <span className="num text-sm text-muted"><Money value={g.items.reduce((s, e) => s + e.amount, 0)} /></span>
              </div>
              <ul className="card divide-y divide-line overflow-hidden">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <SwipeRow onTap={() => !String(e.id).startsWith('tmp-') && setEditing(e)} onEdit={() => setEditing(e)} onDelete={() => del(e)}>
                      <div className="flex min-h-[64px] items-center gap-3 px-4 py-3 lg:pr-14">
                        <CategoryDot category={catOf(e.categoryId)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{e.label}</p>
                          <p className="truncate text-sm text-muted">
                            {catOf(e.categoryId)?.name ?? 'Uncategorised'}
                            {e.source !== 'manual' && <span className="badge ml-2 bg-surface-2 text-muted">{e.source}</span>}
                            {e.note ? ` · ${e.note}` : ''}
                          </p>
                        </div>
                        <Money value={e.amount} className="serif-num text-lg font-medium" />
                      </div>
                    </SwipeRow>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {items.length > 0 && <p className="px-1 text-center text-xs text-muted">Swipe right to edit, left to delete</p>}
        </>
      )}

      {tab === 'income' && (
        <>
          <button className="btn btn-primary w-full" onClick={() => { setEditingIncome(null); setIncomeOpen(true); }}>
            <Plus size={18} /> Add income / top-up
          </button>
          {income.isLoading && <ListSkeleton rows={3} />}
          {income.error && <ErrorState error={income.error} onRetry={income.refetch} />}
          {income.data && incomeItems.length === 0 && <EmptyState icon={Wallet} title="No top-ups this cycle" text="Add extra income mid-month and it increases your balance." />}
          {incomeItems.length > 0 && (
            <ul className="card divide-y divide-line overflow-hidden">
              {incomeItems.map((i) => (
                <li key={i.id}>
                  <SwipeRow
                    onTap={() => { setEditingIncome(i); setIncomeOpen(true); }}
                    onEdit={() => { setEditingIncome(i); setIncomeOpen(true); }}
                    onDelete={() => undo(i.id, `Deleted “${i.label}”`, () => api.del(`/income/${i.id}`))}
                  >
                    <div className="flex min-h-[64px] items-center gap-3 px-4 py-3 lg:pr-14">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-success-soft text-success"><Wallet size={18} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{i.label}</p>
                        <p className="text-sm text-muted">{dayHeading(i.date)}</p>
                      </div>
                      <Money value={i.amount} sign className="serif-num text-lg font-medium text-success" />
                    </div>
                  </SwipeRow>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ExpenseSheet open={!!editing} onClose={() => setEditing(null)} expense={editing} />
      <IncomeSheet open={incomeOpen} onClose={() => setIncomeOpen(false)} income={editingIncome} />
      <BulkImportSheet open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </div>
  );
}
