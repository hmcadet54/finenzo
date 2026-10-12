import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Plus, Receipt, Repeat, Settings as SettingsIcon, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { CycleProvider } from '../context/CycleContext.jsx';
import ExpenseSheet from '../forms/ExpenseSheet.jsx';
import PullToRefresh from './PullToRefresh.jsx';
import Logo from './Logo.jsx';
import { UserAvatar } from './ui.jsx';

const QuickAddContext = createContext({ openAdd: () => {} });
export const useQuickAdd = () => useContext(QuickAddContext);

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/subscriptions', label: 'Subscriptions', icon: Repeat },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

const tabClass = ({ isActive }) =>
  `flex min-h-[58px] pt-1.5 pb-2 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${
    isActive ? 'text-accent-text' : 'text-muted'
  }`;

export default function Layout() {
  const { user } = useAuth();
  const online = useOnline();
  const [addOpen, setAddOpen] = useState(false);
  const openAdd = useCallback(() => setAddOpen(true), []);
  const ctx = useMemo(() => ({ openAdd }), [openAdd]);

  return (
    <CycleProvider>
      <QuickAddContext.Provider value={ctx}>
        {!online && (
          <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-warn-soft px-4 py-2 text-sm font-medium text-warn" role="status" style={{ paddingTop: 'calc(8px + env(safe-area-inset-top))' }}>
            <WifiOff size={16} /> You’re offline — showing saved data (read-only)
          </div>
        )}

        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
          <Logo className="px-2" />
          <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Main">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition ${
                    isActive ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-surface-2 hover:text-ink'
                  }`
                }
              >
                <Icon size={20} /> {label}
              </NavLink>
            ))}
            <button className="btn btn-primary mt-4" onClick={openAdd}>
              <Plus size={18} /> Add expense
            </button>
          </nav>
          <div className="flex items-center gap-3 rounded-xl border border-line p-2.5">
            <UserAvatar user={user} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
          </div>
        </aside>

        <div className="lg:pl-64">
          <main className="pb-nav mx-auto w-full max-w-[640px] px-4 lg:max-w-3xl lg:px-8 lg:pb-16" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <PullToRefresh>
              <Outlet />
            </PullToRefresh>
          </main>
        </div>

        {/* Mobile floating control dock */}
        <nav
          aria-label="Main"
          className="fixed inset-x-3 bottom-2.5 z-40 max-w-[420px] mx-auto rounded-2xl border border-line/80 bg-surface/90 backdrop-blur-xl shadow-lg lg:hidden"
          style={{
            marginBottom: 'max(4px, env(safe-area-inset-bottom))',
          }}
        >
          <div className="flex items-center justify-around px-2 py-1.5">
            {NAV.slice(0, 2).map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-150 select-none ${
                    isActive
                      ? 'bg-accent-soft text-accent-text font-bold'
                      : 'text-muted hover:text-ink hover:bg-surface-2'
                  }`
                }
              >
                <Icon size={20} strokeWidth={2.2} />
                <span className="text-[11px] mt-0.5 tracking-tight leading-none">{label}</span>
              </NavLink>
            ))}

            {/* Center Floating Action Button */}
            <div className="flex items-center justify-center px-1">
              <button
                onClick={openAdd}
                aria-label="Add expense"
                id="fab-add"
                className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-on-accent transition active:scale-95"
                title="Add expense"
              >
                <Plus size={24} strokeWidth={2.6} />
              </button>
            </div>

            {NAV.slice(2).map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-150 select-none ${
                    isActive
                      ? 'bg-accent-soft text-accent-text font-bold'
                      : 'text-muted hover:text-ink hover:bg-surface-2'
                  }`
                }
              >
                <Icon size={20} strokeWidth={2.2} />
                <span className="text-[11px] mt-0.5 tracking-tight leading-none">
                  {label === 'Subscriptions' ? 'Subs' : label}
                </span>
              </NavLink>
            ))}
          </div>
        </nav>

        <ExpenseSheet open={addOpen} onClose={() => setAddOpen(false)} />
      </QuickAddContext.Provider>
    </CycleProvider>
  );
}
