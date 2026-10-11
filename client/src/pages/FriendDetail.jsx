import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, MessageCircle, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { api, useApi, useFriend } from '../lib/queries.js';
import { useHiddenIds, useUndoDelete } from '../lib/undo.js';
import { niceDate } from '../lib/dates.js';
import { formatMoney } from '../lib/money.js';
import { useFmt } from '../context/AuthContext.jsx';
import { EmptyState, ErrorState, ListSkeleton, Money, PageHeader } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { FriendSheet, LoanSheet, RepaymentSheet } from '../forms/LendingForms.jsx';
import { ReturnBadge } from './Friends.jsx';

const STATUS = {
  pending: 'bg-surface-2 text-muted',
  partial: 'bg-accent-soft text-accent-text',
  returned: 'bg-success-soft text-success',
  overdue: 'bg-danger-soft text-danger',
};

function whatsappLink(friend, loan) {
  const parts = [`Hi ${friend.name}, a friendly reminder about the ${formatMoney(loan.amount, { compact: false })} I lent you on ${niceDate(loan.dateLent)}.`];
  if (loan.repaid > 0) parts.push(`You've returned ${formatMoney(loan.repaid, { compact: false })}, so ${formatMoney(loan.outstanding, { compact: false })} is still outstanding.`);
  else parts.push(`${formatMoney(loan.outstanding, { compact: false })} is outstanding.`);
  if (loan.expectedReturnDate) parts.push(`We'd agreed on ${niceDate(loan.expectedReturnDate)}.`);
  parts.push('Could you send it when you can? Thanks!');
  const phone = (friend.phone ?? '').replace(/\D/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(parts.join(' '))}`;
}

export default function FriendDetail() {
  const { id } = useParams();
  const fmt = useFmt();
  const { toast } = useToast();
  const hidden = useHiddenIds();
  const undo = useUndoDelete();
  const { data, isLoading, error, refetch } = useFriend(id);
  const [sheet, setSheet] = useState(null); // 'friend' | 'loan' | {loan} | {repay}
  const delRep = useApi(({ loanId, rid }) => api.del(`/loans/${loanId}/repayments/${rid}`), { onError: (e) => toast(e.message, { tone: 'error' }) });

  const friend = data?.item;
  const loans = (data?.loans ?? []).filter((l) => !hidden.has(l.id));

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        back={<Link to="/settings/friends" className="-ml-2 mb-1 inline-flex min-h-[44px] items-center gap-1 px-2 text-sm text-muted"><ChevronLeft size={16} /> Friends</Link>}
        title={friend?.name ?? 'Friend'}
        subtitle={friend?.phone || friend?.note}
        right={friend && <button className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-surface-2" onClick={() => setSheet('friend')} aria-label="Edit friend"><Pencil size={18} /></button>}
      />
      {isLoading && <ListSkeleton rows={2} />}
      {error && !data && <ErrorState error={error} onRetry={refetch} />}

      {friend && (
        <>
          <section className="card grid grid-cols-2 divide-x divide-line p-1 text-center">
            <div className="p-3"><p className="text-xs text-muted">Owes you</p><p className="serif-num text-2xl font-medium"><Money value={friend.lentOut} /></p></div>
            <div className="p-3"><p className="text-xs text-muted">You owe</p><p className="serif-num text-2xl font-medium"><Money value={friend.borrowed} /></p></div>
          </section>
          <button className="btn btn-primary w-full" onClick={() => setSheet('loan')}><Plus size={18} /> New loan</button>

          {loans.length === 0 && <EmptyState icon={Wallet} title="No loans yet" text="Record money you lent or borrowed to track returns." />}

          <ul className="space-y-3">
            {loans.map((l) => (
              <li key={l.id} className="card overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="serif-num text-2xl font-medium"><Money value={l.amount} /></span>
                        <span className={`badge capitalize ${STATUS[l.status]}`}>{l.status}</span>
                        <span className="badge bg-surface-2 text-muted">{l.direction === 'lent' ? 'I lent' : 'I borrowed'}</span>
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {niceDate(l.dateLent)}{l.expectedReturnDate ? ` → expected ${niceDate(l.expectedReturnDate)}` : ''}
                      </p>
                      {l.note && <p className="mt-1 text-sm">{l.note}</p>}
                    </div>
                    <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2" onClick={() => setSheet({ loan: l })} aria-label="Edit loan"><Pencil size={17} /></button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="num text-sm text-muted">Outstanding <strong className="text-ink">{fmt(l.outstanding)}</strong>{l.repaid > 0 && ` · repaid ${fmt(l.repaid)}`}</span>
                    {l.direction === 'lent' && <ReturnBadge date={l.expectedReturnDate} outstanding={l.outstanding} />}
                  </div>
                  {l.repayments.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                      {l.repayments.map((r) => (
                        <li key={r.id ?? r._id} className="flex items-center gap-2">
                          <span className="flex-1 text-muted">{niceDate(r.date)}{r.note ? ` · ${r.note}` : ''}</span>
                          <Money value={r.amount} className="font-medium" />
                          <button className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger" aria-label="Remove repayment" onClick={() => undo(r.id ?? r._id, 'Removed repayment', () => delRep.mutateAsync({ loanId: l.id, rid: r.id ?? r._id }))}>
                            <Trash2 size={15} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {l.outstanding > 0 && (
                  <div className="flex gap-2 border-t border-line p-2.5">
                    <button className="btn btn-soft flex-1" onClick={() => setSheet({ repay: l })}>Record repayment</button>
                    {l.direction === 'lent' && (
                      <a className="btn btn-ghost" href={whatsappLink(friend, l)} target="_blank" rel="noopener noreferrer" aria-label={`Remind ${friend.name} on WhatsApp`}>
                        <MessageCircle size={18} /> Remind
                      </a>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <FriendSheet open={sheet === 'friend'} onClose={() => setSheet(null)} friend={friend} />
          <LoanSheet open={sheet === 'loan'} onClose={() => setSheet(null)} friendId={friend.id} />
          <LoanSheet open={!!sheet?.loan} onClose={() => setSheet(null)} friendId={friend.id} loan={sheet?.loan} />
          <RepaymentSheet open={!!sheet?.repay} onClose={() => setSheet(null)} loan={sheet?.repay} />
        </>
      )}
    </div>
  );
}
