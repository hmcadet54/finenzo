import { useState } from 'react';
import { Plus, Repeat } from 'lucide-react';
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

  const act = useApi(({ id, path, body }) => api.post(`/subscriptions/${id}/${path}`, body ?? {}), {
    onError: (e) => toast(e.message, { tone: 'error' }),
  });
  const run = (id, path, body, msg) => act.mutate({ id, path, body }, { onSuccess: () => toast(msg) });

  const items = (data?.items ?? []).filter((s) => !hidden.has(s.id));
  const totals = data?.totals;

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="Subscriptions"
        right={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={18} /> Add
          </button>
        }
      />

      {isLoading && (
        <>
          <div className="grid grid-cols-3 gap-2.5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 !rounded-2xl" />)}</div>
          <ListSkeleton />
        </>
      )}
      {error && !data && <ErrorState error={error} onRetry={refetch} />}

      {totals && (
        <div className="grid grid-cols-3 gap-2.5">
          <Tile label="Per month" value={totals.monthly} sub="yearly amortised" />
          <Tile label="Per year" value={totals.yearly} />
          <Tile label="Next 30 days" value={totals.next30Days} sub={totals.dueNow ? 'incl. due now' : undefined} />
        </div>
      )}

      {data && items.length === 0 && (
        <EmptyState icon={Repeat} title="No subscriptions yet" text="Add recurring bills and subscriptions. Finenzo reminds you when they’re due and factors them into your safe-to-spend." action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={18} /> Add subscription</button>} />
      )}

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
                    <p className="flex items-center gap-2 truncate font-medium">
                      {s.name}
                      {s.status === 'paused' && <span className="badge bg-warn-soft text-warn">Paused</span>}
                      {s.status === 'cancelled' && <span className="badge bg-surface-2 text-muted">Cancelled</span>}
                      {s.isManual && <span className="badge bg-surface-2 text-muted">Manual</span>}
                    </p>
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

      <SubscriptionSheet open={creating} onClose={() => setCreating(false)} />
      <SubscriptionSheet open={!!editing} onClose={() => setEditing(null)} sub={editing} />
    </div>
  );
}
