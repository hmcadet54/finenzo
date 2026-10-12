import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, LayoutGrid, List, Plus, Repeat, Search } from 'lucide-react';
import { api, useApi, useCategories, useSubscriptions } from '../lib/queries.js';
import { useHiddenIds } from '../lib/undo.js';
import { inDays, niceDate } from '../lib/dates.js';
import { EmptyState, ErrorState, ListSkeleton, Money, PageHeader, Skeleton } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import SubscriptionSheet from '../forms/SubscriptionSheet.jsx';
import SwipeRow from '../components/SwipeRow.jsx';

const CYCLE_LABEL = { monthly: '/mo', quarterly: '/qtr', yearly: '/yr', manual: ' · manual' };
const cycleText = (s) => (s.billingCycle === 'custom' ? ` / ${s.intervalMonths} mo` : CYCLE_LABEL[s.billingCycle]);

function Tile({ label, value, sub }) {
  return (
    <div className="card p-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="serif-num text-xl font-medium"><Money value={value} /></p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

export default function Subscriptions() {
  const { toast } = useToast();
  const hidden = useHiddenIds();
  const { data, isLoading, error, refetch } = useSubscriptions();
  const { data: cats = [] } = useCategories();
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('finenzo.subsViewMode') || 'compact');
  const [showStats, setShowStats] = useState(false);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const toggleViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('finenzo.subsViewMode', mode);
  };

  const act = useApi(({ id, path, body }) => api.post(`/subscriptions/${id}/${path}`, body ?? {}), {
    onError: (e) => toast(e.message, { tone: 'error' }),
  });
  const run = (id, path, body, msg) => act.mutate({ id, path, body }, { onSuccess: () => toast(msg) });

  const rawItems = (data?.items ?? []).filter((s) => !hidden.has(s.id));
  const totals = data?.totals;

  const items = useMemo(() => {
    return rawItems.filter((s) => {
      if (filter === 'due' && !s.dueCharges?.length) return false;
      if (filter === 'active' && (s.status !== 'active' || s.isManual)) return false;
      if (filter === 'manual' && !s.isManual) return false;
      if (filter === 'paused' && s.status !== 'paused') return false;
      if (filter === 'cancelled' && s.status !== 'cancelled') return false;

      if (q.trim()) {
        const query = q.toLowerCase().trim();
        const cat = cats.find((c) => c.id === s.categoryId);
        const matchName = s.name.toLowerCase().includes(query);
        const matchCat = cat?.name?.toLowerCase().includes(query);
        return matchName || matchCat;
      }
      return true;
    });
  }, [rawItems, filter, q, cats]);

  const dueCount = rawItems.filter((s) => s.dueCharges?.length > 0).length;

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="Subscriptions"
        right={
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-surface-2 p-0.5 border border-line/60" role="group" aria-label="View mode">
              <button
                type="button"
                onClick={() => toggleViewMode('compact')}
                aria-pressed={viewMode === 'compact'}
                className={`grid h-8 w-8 place-items-center rounded-lg transition ${
                  viewMode === 'compact' ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink'
                }`}
                title="All at a glance (Compact view)"
                aria-label="Compact overview"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                onClick={() => toggleViewMode('detailed')}
                aria-pressed={viewMode === 'detailed'}
                className={`grid h-8 w-8 place-items-center rounded-lg transition ${
                  viewMode === 'detailed' ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink'
                }`}
                title="Detailed list view"
                aria-label="Detailed list"
              >
                <List size={16} />
              </button>
            </div>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={18} /> Add
            </button>
          </div>
        }
      />

      {isLoading && (
        <>
          <div className="grid grid-cols-3 gap-2.5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 !rounded-2xl" />)}</div>
          <ListSkeleton />
        </>
      )}
      {error && !data && <ErrorState error={error} onRetry={refetch} />}

      {/* Overview Stats (collapsible in compact mode to fit all subscriptions on screen) */}
      {totals && (
        viewMode === 'compact' ? (
          <div className="card overflow-hidden">
            <button
              type="button"
              onClick={() => setShowStats((s) => !s)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs text-muted hover:bg-surface-2 transition select-none"
            >
              <div className="flex items-center gap-3">
                <span>
                  Monthly: <strong className="font-semibold text-ink"><Money value={totals.monthly} /></strong>
                </span>
                <span>·</span>
                <span>
                  Yearly: <strong className="font-semibold text-ink"><Money value={totals.yearly} /></strong>
                </span>
                {totals.dueNow > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-warn font-semibold">
                      Due: <Money value={totals.dueNow} />
                    </span>
                  </>
                )}
              </div>
              <span className="flex items-center gap-1 text-[11px] text-muted">
                {showStats ? 'Hide' : 'Details'} {showStats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>
            {showStats && (
              <div className="grid grid-cols-3 gap-2 border-t border-line p-3">
                <Tile label="Per month" value={totals.monthly} sub="yearly amortised" />
                <Tile label="Per year" value={totals.yearly} />
                <Tile label="Next 30 days" value={totals.next30Days} sub={totals.dueNow ? 'incl. due now' : undefined} />
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            <Tile label="Per month" value={totals.monthly} sub="yearly amortised" />
            <Tile label="Per year" value={totals.yearly} />
            <Tile label="Next 30 days" value={totals.next30Days} sub={totals.dueNow ? 'incl. due now' : undefined} />
          </div>
        )
      )}

      {/* Filter and Search Bar */}
      {rawItems.length > 0 && (
        <div className="space-y-2">
          {rawItems.length > 5 && (
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                className="field !h-9 pl-9 pr-7 text-xs"
                placeholder="Search subscriptions…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-ink font-semibold"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 no-scrollbar" role="group" aria-label="Filter status">
            <button
              type="button"
              className="chip !min-h-[32px] !px-2.5 !py-1 text-xs"
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              All ({rawItems.length})
            </button>
            {dueCount > 0 && (
              <button
                type="button"
                className="chip !min-h-[32px] !px-2.5 !py-1 text-xs !text-warn !border-warn/40"
                aria-pressed={filter === 'due'}
                onClick={() => setFilter('due')}
              >
                Due now ({dueCount})
              </button>
            )}
            <button
              type="button"
              className="chip !min-h-[32px] !px-2.5 !py-1 text-xs"
              aria-pressed={filter === 'active'}
              onClick={() => setFilter('active')}
            >
              Active
            </button>
            <button
              type="button"
              className="chip !min-h-[32px] !px-2.5 !py-1 text-xs"
              aria-pressed={filter === 'manual'}
              onClick={() => setFilter('manual')}
            >
              Manual
            </button>
            <button
              type="button"
              className="chip !min-h-[32px] !px-2.5 !py-1 text-xs"
              aria-pressed={filter === 'paused'}
              onClick={() => setFilter('paused')}
            >
              Paused
            </button>
          </div>
        </div>
      )}

      {data && rawItems.length === 0 && (
        <EmptyState
          icon={Repeat}
          title="No subscriptions yet"
          text="Add recurring bills and subscriptions. Finenzo reminds you when they’re due and factors them into your safe-to-spend."
          action={
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={18} /> Add subscription
            </button>
          }
        />
      )}

      {/* COMPACT "ALL ON SCREEN" GRID VIEW */}
      {viewMode === 'compact' && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((s) => {
            const inactive = s.status !== 'active';
            const due = s.dueCharges?.[0];
            const cat = cats.find((c) => c.id === s.categoryId);
            return (
              <div
                key={s.id}
                onClick={() => setEditing(s)}
                className={`card p-2.5 flex items-center justify-between gap-2.5 transition active:scale-[0.99] cursor-pointer hover:bg-surface-2 select-none ${
                  inactive ? 'opacity-70' : ''
                } ${due ? 'border-warn/50 bg-warn-soft/20' : ''}`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className="h-8 w-1.5 shrink-0 rounded-full"
                    style={{ background: s.color || '#D97757' }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold flex items-center gap-1.5">
                      <span className="truncate">{s.name}</span>
                      {due && (
                        <span className="clay-tag !px-1.5 !py-0 bg-warn-soft text-warn border border-warn/40 text-[10px] font-bold shrink-0">
                          Due
                        </span>
                      )}
                      {s.isManual && (
                        <span className="clay-tag !px-1.5 !py-0 bg-surface-2 text-muted border border-line text-[10px] shrink-0">
                          Manual
                        </span>
                      )}
                      {s.status === 'paused' && (
                        <span className="clay-tag !px-1.5 !py-0 bg-warn-soft text-warn border border-warn/30 text-[10px] shrink-0">
                          Paused
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {cat?.name ? `${cat.name} · ` : ''}
                      {!s.isManual && s.nextRenewal ? (
                        <span className={due ? 'font-semibold text-warn' : ''}>
                          {due ? niceDate(due.dueDate) : `${niceDate(s.nextRenewal)} (${inDays(s.daysUntil)})`}
                        </span>
                      ) : (
                        'On demand'
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="serif-num text-sm font-bold text-ink leading-tight">
                    <Money value={s.amount} />
                  </p>
                  <p className="text-[11px] text-muted">{cycleText(s)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAILED VIEW */}
      {viewMode === 'detailed' && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((s) => {
            const inactive = s.status !== 'active';
            const due = s.dueCharges?.[0];
            const cat = cats.find((c) => c.id === s.categoryId);
            return (
              <li key={s.id} className={`card overflow-hidden ${inactive ? 'opacity-70' : ''}`}>
                <SwipeRow onTap={() => setEditing(s)} onEdit={() => setEditing(s)}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: s.color || '#D97757' }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{s.name}</p>
                        {s.status === 'paused' && (
                          <span className="clay-tag bg-warn-soft text-warn border border-warn/30">Paused</span>
                        )}
                        {s.status === 'cancelled' && (
                          <span className="clay-tag bg-surface-2 text-muted border border-line">Cancelled</span>
                        )}
                        {s.isManual && (
                          <span className="clay-tag bg-accent-soft text-accent-text border border-accent/25">Manual</span>
                        )}
                        {s.status === 'active' && !s.isManual && !due && (
                          <span className="clay-tag bg-success-soft text-success border border-success/25">Active</span>
                        )}
                        {due && (
                          <span className="clay-tag bg-warn-soft text-warn border border-warn/40 font-bold">Due</span>
                        )}
                      </div>
                      <p className="truncate text-sm text-muted">
                        {s.lineItems.length > 1 && <span className="num">{s.lineItems.map((l) => l.amount).join(' + ')} · </span>}
                        {cat?.name ?? ''}
                        {!s.isManual && !inactive && s.nextRenewal && (
                          <span className={due ? 'font-semibold text-warn' : ''}>
                            {cat ? ' · ' : ''}
                            {due ? `Due ${niceDate(due.dueDate)}` : `${niceDate(s.nextRenewal)} · ${inDays(s.daysUntil)}`}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="serif-num text-lg font-medium"><Money value={s.amount} /></p>
                      <p className="text-xs text-muted">{cycleText(s)}</p>
                    </div>
                  </div>
                </SwipeRow>
                {s.status === 'active' && due && (
                  <div className="flex gap-2 border-t border-line bg-warn-soft/50 p-2.5">
                    {s.dueCharges.length > 1 && <span className="self-center px-2 text-xs font-semibold text-warn">{s.dueCharges.length} due</span>}
                    <button className="btn btn-primary flex-1 !min-h-[44px]" disabled={act.isPending} onClick={() => run(s.id, 'charge', { chargeId: due.id }, 'Marked paid · expense added')}>Mark paid</button>
                    <button className="btn btn-ghost !min-h-[44px]" disabled={act.isPending} onClick={() => run(s.id, 'skip', { chargeId: due.id }, 'Skipped')}>Skip</button>
                  </div>
                )}
                {s.status === 'active' && s.isManual && (
                  <div className="border-t border-line p-2.5">
                    <button className="btn btn-soft w-full !min-h-[44px]" disabled={act.isPending} onClick={() => run(s.id, 'charge', {}, 'Charged · expense added')}>Charge now</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {rawItems.length > 0 && items.length === 0 && (
        <p className="card p-6 text-center text-sm text-muted">No subscriptions match this filter or search.</p>
      )}

      <SubscriptionSheet open={creating} onClose={() => setCreating(false)} />
      <SubscriptionSheet open={!!editing} onClose={() => setEditing(null)} sub={editing} />
    </div>
  );
}
