import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Users } from 'lucide-react';
import { api, useFriends, useLoanOverview } from '../lib/queries.js';
import { useHiddenIds, useUndoDelete } from '../lib/undo.js';
import { daysUntil, inDays, niceDate } from '../lib/dates.js';
import { EmptyState, ErrorState, ListSkeleton, Money, PageHeader } from '../components/ui.jsx';
import SwipeRow from '../components/SwipeRow.jsx';
import { FriendSheet } from '../forms/LendingForms.jsx';

export function ReturnBadge({ date, outstanding }) {
  if (!date || !outstanding) return null;
  const d = daysUntil(date);
  if (d < 0) return <span className="badge bg-danger-soft text-danger">Overdue {-d}d</span>;
  if (d <= 7) return <span className="badge bg-warn-soft text-warn">Due {inDays(d)}</span>;
  return null;
}

export default function Friends() {
  const { data, isLoading, error, refetch } = useFriends();
  const { data: overview } = useLoanOverview();
  const hidden = useHiddenIds();
  const undo = useUndoDelete();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const items = (data?.items ?? []).filter((f) => !hidden.has(f.id));

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        back={<Link to="/settings" className="-ml-2 mb-1 inline-flex min-h-[44px] items-center gap-1 px-2 text-sm text-muted"><ChevronLeft size={16} /> Settings</Link>}
        title="Friends & lending"
        right={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={18} /> Friend</button>}
      />

      {overview && (
        <section className="card p-4" aria-label="Lending overview">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-xs text-muted">Lent out</p><p className="serif-num text-xl font-medium"><Money value={overview.lentOut} /></p></div>
            <div><p className="text-xs text-muted">Overdue</p><p className={`serif-num text-xl font-medium ${overview.overdue ? 'text-danger' : ''}`}><Money value={overview.overdue} /></p></div>
            <div><p className="text-xs text-muted">I owe</p><p className="serif-num text-xl font-medium"><Money value={overview.borrowed} /></p></div>
          </div>
          {overview.upcoming?.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-2 text-sm font-semibold">Next expected returns</p>
              <ul className="space-y-2">
                {overview.upcoming.map((l) => (
                  <li key={l.id}>
                    <Link to={`/settings/friends/${l.friendId}`} className="flex min-h-[44px] items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-medium">{l.friendName}{l.direction === 'borrowed' ? ' (I owe)' : ''}</span>
                      <span className="text-muted">{niceDate(l.expectedReturnDate)}</span>
                      <Money value={l.outstanding} className="font-semibold" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {isLoading && <ListSkeleton rows={4} />}
      {error && !data && <ErrorState error={error} onRetry={refetch} />}
      {data && items.length === 0 && (
        <EmptyState icon={Users} title="No friends yet" text="Add a friend to track money you lend or borrow, with expected return dates and WhatsApp reminders." action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={18} /> Add friend</button>} />
      )}

      <ul className="card divide-y divide-line overflow-hidden empty:hidden">
        {items.map((f) => {
          const net = f.lentOut - f.borrowed;
          return (
            <li key={f.id}>
              <SwipeRow onEdit={() => setEditing(f)} onDelete={() => undo(f.id, `Deleted ${f.name} and their loans`, () => api.del(`/friends/${f.id}`))}>
                <Link to={`/settings/friends/${f.id}`} className="flex min-h-[64px] items-center gap-3 px-4 py-3 lg:pr-14">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft font-serif text-lg text-accent-text">{f.name[0]?.toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{f.name}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
                      {f.loanCount === 0 ? 'No loans' : f.lentOut || f.borrowed ? (net >= 0 ? 'Owes you' : 'You owe') : 'All settled'}
                      <ReturnBadge date={f.nextReturn} outstanding={f.lentOut} />
                    </p>
                  </div>
                  {(f.lentOut > 0 || f.borrowed > 0) && <Money value={Math.abs(net)} className={`serif-num text-lg font-medium ${net < 0 ? 'text-danger' : ''}`} />}
                  <ChevronRight size={18} className="text-muted" />
                </Link>
              </SwipeRow>
            </li>
          );
        })}
      </ul>

      <FriendSheet open={creating} onClose={() => setCreating(false)} />
      <FriendSheet open={!!editing} onClose={() => setEditing(null)} friend={editing} />
    </div>
  );
}
