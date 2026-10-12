import { Suspense, lazy, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Pencil, Plus, RefreshCw, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth, useFmt } from '../context/AuthContext.jsx';
import { useCycle } from '../context/CycleContext.jsx';
import { useCategories, useDashboard, useLoanOverview, useApi, api } from '../lib/queries.js';
import { describeExpression } from '../lib/money.js';
import { daysUntil, inDays, niceDate } from '../lib/dates.js';
import { CategoryDot, ErrorState, Money, Segmented, Skeleton, UserAvatar } from '../components/ui.jsx';
import { useQuickAdd } from '../components/Layout.jsx';
import { useToast } from '../components/Toast.jsx';
import QuickAddBar from '../forms/QuickAddBar.jsx';
import { CloseCycleSheet, CycleSwitcher, IncomeSheet, StartingBalanceSheet } from '../forms/CycleForms.jsx';

const SpendChart = lazy(() => import('../components/SpendChart.jsx'));

function Stat({ label, children, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className="min-h-[44px] rounded-xl bg-surface-2/70 px-3 py-2.5 text-left">
      <p className="text-xs text-muted">{label}</p>
      <p className="serif-num text-lg font-medium">{children}</p>
    </Tag>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-56 w-full !rounded-2xl" />
      <Skeleton className="h-32 w-full !rounded-2xl" />
      <Skeleton className="h-40 w-full !rounded-2xl" />
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const fmt = useFmt();
  const { toast } = useToast();
  const { openAdd } = useQuickAdd();
  const { selectedId } = useCycle();
  const { data, isLoading, error, refetch, isFetching } = useDashboard(selectedId);
  const { data: cats = [] } = useCategories();
  const { data: loans } = useLoanOverview();
  const [window7, setWindow7] = useState('7');
  const [chartMode, setChartMode] = useState('daily');
  const [sheet, setSheet] = useState(null);

  const pay = useApi(({ id, chargeId }) => api.post(`/subscriptions/${id}/charge`, { chargeId }), {
    onSuccess: () => toast('Marked as paid · expense added'),
    onError: (e) => toast(e.message, { tone: 'error' }),
  });

  const compact = user?.settings?.compactNumbers ?? true;
  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-center justify-between px-1 pb-1 pt-5">
        <div className="flex items-center gap-3.5 min-w-0">
          <Link
            to="/settings"
            className="group shrink-0 focus:outline-none"
            aria-label="Profile and settings"
          >
            <UserAvatar
              user={user}
              size="md"
              className="transition-transform duration-200 group-hover:scale-105 active:scale-95"
            />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              {format(new Date(), 'EEEE, d MMMM')}
            </p>
            <h1 className="truncate text-[24px] sm:text-[28px] font-medium leading-tight">
              Hi, {firstName || user?.name || 'there'}
            </h1>
          </div>
        </div>
        <button
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 transition-colors"
          onClick={() => refetch()}
          aria-label="Refresh"
        >
          <RefreshCw size={19} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </header>

      <CycleSwitcher />

      {isLoading && <DashboardSkeleton />}
      {error && !data && <ErrorState error={error} onRetry={refetch} />}

      {data && (() => {
        const { balance, stats, projections: p, upcoming, cycle, isCurrent } = data;
        const catOf = (id) => cats.find((c) => c.id === id);
        const list = window7 === '7' ? upcoming.next7 : upcoming.next30;
        const warn = !!p?.warning;
        const hasExpr = cycle.startingExpression && /[+\-]/.test(cycle.startingExpression);
        const empty = balance.starting === 0 && balance.spent === 0 && balance.income === 0;
        const maxCat = Math.max(1, ...data.byCategory.map((c) => c.amount));
        return (
          <>
            <section aria-label="Balance" className={`card overflow-hidden ${warn ? '!border-danger/40' : ''}`}>
              <div className={`px-5 pb-4 pt-5 ${warn ? 'bg-danger-soft' : 'bg-gradient-to-b from-accent-soft/70 to-surface'}`}>
                <p className="text-sm font-medium text-muted">Remaining balance</p>
                <p className={`serif-num mt-1 text-[44px] font-medium leading-none tracking-tight ${balance.remaining < 0 ? 'text-danger' : ''}`} id="remaining-balance">
                  <Money value={balance.remaining} />
                </p>
                {warn && (
                  <p className="mt-3 flex items-start gap-2 text-sm font-medium text-danger" role="alert">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                    At this pace you’ll run out before the cycle ends{p.projectedAfterRenewals < 0 ? ` (about ${fmt(p.projectedAfterRenewals)} after renewals)` : ''}.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                <Stat label="Starting balance" onClick={() => setSheet('start')}>
                  <span className="inline-flex items-center gap-1.5">
                    <Money value={balance.starting} /> <Pencil size={13} className="text-muted" />
                  </span>
                </Stat>
                <Stat label="Total spent"><Money value={balance.spent} /></Stat>
                <Stat label="Spent today"><Money value={stats.todaySpent} /></Stat>
                <Stat label="Avg per day"><Money value={stats.avgDaily} /></Stat>
              </div>
              <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
                <span className="text-muted">
                  {isCurrent ? <><strong className="num text-ink">{stats.daysLeft}</strong> day{stats.daysLeft === 1 ? '' : 's'} left in cycle</> : 'Cycle ended'}
                </span>
                {balance.income > 0 && <span className="num font-medium text-success">+<Money value={balance.income} /> income</span>}
              </div>
              {hasExpr && (
                <p className="num border-t border-line px-5 py-2.5 text-xs text-muted">
                  Starting: {describeExpression(cycle.startingExpression, { compact })}
                </p>
              )}
            </section>

            {empty && (
              <button onClick={() => setSheet('start')} className="card flex w-full items-center gap-3 p-4 text-left">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent-text"><Wallet size={20} /></span>
                <span className="flex-1">
                  <span className="block font-semibold">Set your starting balance</span>
                  <span className="block text-sm text-muted">Everything else is calculated from it. You can type sums like 122k + 30k.</span>
                </span>
                <ArrowRight size={18} className="text-muted" />
              </button>
            )}

            {isCurrent && <QuickAddBar />}

            {isCurrent && p && (
              <section className="card p-5" aria-label="Projections">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted">Safe to spend per day</p>
                    <p className={`serif-num text-3xl font-medium ${p.safePerDay < 0 ? 'text-danger' : 'text-success'}`}><Money value={p.safePerDay} /></p>
                  </div>
                  <p className="max-w-[9rem] text-right text-xs text-muted">after {fmt(p.upcoming)} of upcoming renewals this cycle</p>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
                  <div>
                    <dt className="text-muted">End balance at your pace</dt>
                    <dd className={`serif-num text-lg ${p.projectedEnd < 0 ? 'text-danger' : ''}`}><Money value={p.projectedEnd} /></dd>
                  </div>
                  <div>
                    <dt className="text-muted">…after all renewals</dt>
                    <dd className={`serif-num text-lg ${p.projectedAfterRenewals < 0 ? 'text-danger' : ''}`}><Money value={p.projectedAfterRenewals} /></dd>
                  </div>
                </dl>
              </section>
            )}

            {upcoming.due.length > 0 && (
              <section className="card divide-y divide-line" aria-label="Renewals due">
                <h2 className="px-4 pb-2 pt-4 text-lg font-medium">Due now</h2>
                {upcoming.due.map((d) => (
                  <div key={d.chargeId} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{d.name}</p>
                        <span className="clay-tag bg-warn-soft text-warn border border-warn/40 text-[11px] font-bold">Due</span>
                      </div>
                      <p className="text-sm text-warn">Was due {niceDate(d.date)}</p>
                    </div>
                    <Money value={d.amount} className="font-semibold" />
                    <button className="btn btn-primary !min-h-[40px]" disabled={pay.isPending} onClick={() => pay.mutate({ id: d.subscriptionId, chargeId: d.chargeId })}>
                      Mark paid
                    </button>
                  </div>
                ))}
              </section>
            )}

            {isCurrent && (
              <section aria-label="Upcoming renewals">
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-lg font-medium">Upcoming renewals</h2>
                  <div className="w-40">
                    <Segmented label="Window" value={window7} onChange={setWindow7} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }]} />
                  </div>
                </div>
                {list.items.length === 0 ? (
                  <p className="card p-4 text-sm text-muted">Nothing renewing in the next {window7} days.</p>
                ) : (
                  <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
                    {list.items.map((i) => (
                      <Link to="/subscriptions" key={`${i.subscriptionId}-${i.date}`} className="card min-w-[8.5rem] shrink-0 p-3">
                        <p className="truncate text-sm font-medium">{i.name}</p>
                        <p className="serif-num mt-1 text-lg"><Money value={i.amount} /></p>
                        <p className="text-xs text-muted">{niceDate(i.date)} · {inDays(daysUntil(i.date))}</p>
                      </Link>
                    ))}
                  </div>
                )}
                <p className="num mt-2 px-1 text-sm text-muted">Total next {window7} days: <strong className="text-ink">{fmt(list.total)}</strong></p>
              </section>
            )}

            <section className="card p-5" aria-label="Spending chart">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-medium">Spending</h2>
                <div className="w-44">
                  <Segmented label="Chart type" value={chartMode} onChange={setChartMode} options={[{ value: 'daily', label: 'Daily' }, { value: 'cat', label: 'Category' }]} />
                </div>
              </div>
              {data.daily.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">No spending in this cycle yet.</p>
              ) : chartMode === 'daily' ? (
                <Suspense fallback={<Skeleton className="h-36 w-full" />}>
                  <SpendChart daily={data.daily} startDate={cycle.startDate} endDate={cycle.endDate} today={data.today} compact={compact} />
                </Suspense>
              ) : (
                <ul className="space-y-3">
                  {data.byCategory.map((c) => {
                    const cat = catOf(c.categoryId);
                    return (
                      <li key={c.categoryId ?? 'none'} className="flex items-center gap-3">
                        <CategoryDot category={cat} size={34} />
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between text-sm">
                            <span className="truncate font-medium">{cat?.name ?? 'Uncategorised'}</span>
                            <Money value={c.amount} className="text-muted" />
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                            <div className="h-full rounded-full" style={{ width: `${(c.amount / maxCat) * 100}%`, background: cat?.color ?? '#8A8782' }} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {loans && (loans.lentOut > 0 || loans.borrowed > 0) && (
              <Link to="/settings/friends" className="card flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Friends &amp; lending</p>
                  <p className="num text-sm text-muted">
                    {loans.lentOut > 0 && <>Lent out {fmt(loans.lentOut)}</>}
                    {loans.overdue > 0 && <span className="font-semibold text-danger"> · {fmt(loans.overdue)} overdue</span>}
                    {loans.borrowed > 0 && <> · Borrowed {fmt(loans.borrowed)}</>}
                  </p>
                </div>
                <ArrowRight size={18} className="text-muted" />
              </Link>
            )}

            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => setSheet('income')}><Plus size={17} /> Add income</button>
              {isCurrent && <button className="btn btn-ghost flex-1" onClick={() => setSheet('close')}>Start next cycle</button>}
              <button className="btn btn-primary hidden flex-1 lg:inline-flex" onClick={openAdd}><Plus size={17} /> Add expense</button>
            </div>

            <StartingBalanceSheet open={sheet === 'start'} onClose={() => setSheet(null)} cycle={cycle} />
            <IncomeSheet open={sheet === 'income'} onClose={() => setSheet(null)} />
            <CloseCycleSheet open={sheet === 'close'} onClose={() => setSheet(null)} cycle={cycle} remaining={fmt(balance.remaining)} />
          </>
        );
      })()}
    </div>
  );
}
