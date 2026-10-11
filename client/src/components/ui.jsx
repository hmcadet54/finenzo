import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { useFmt } from '../context/AuthContext.jsx';

export const Skeleton = ({ className = 'h-5 w-full' }) => <div className={`skeleton ${className}`} aria-hidden />;

export function ListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card flex items-center gap-3 p-4">
          <Skeleton className="h-10 w-10 !rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent-text">
        <Icon size={26} />
      </div>
      <h3 className="text-xl font-medium">{title}</h3>
      {text && <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="card m-1 flex flex-col items-center px-6 py-10 text-center" role="alert">
      <AlertTriangle className="mb-3 text-warn" size={28} />
      <p className="font-medium">{error?.code === 'NETWORK' ? "You're offline" : 'Something went wrong'}</p>
      <p className="mt-1 text-sm text-muted">{error?.message}</p>
      {onRetry && (
        <button className="btn btn-ghost mt-4" onClick={onRetry}>
          <RefreshCw size={16} /> Try again
        </button>
      )}
    </div>
  );
}

export function Money({ value, className = '', sign = false }) {
  const fmt = useFmt();
  const text = fmt(value);
  const prefix = sign && value > 0 ? '+' : '';
  return <span className={`num ${className}`}>{prefix + text}</span>;
}

export function PageHeader({ title, subtitle, right, back }) {
  return (
    <header className="flex items-end justify-between gap-3 px-1 pb-4 pt-5">
      <div className="min-w-0">
        {back}
        <h1 className="truncate text-[28px] font-medium leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-[40px] flex-1 rounded-lg px-3 text-sm font-semibold transition ${
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export function CategoryDot({ category, size = 40 }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full text-lg"
      style={{ width: size, height: size, background: `${category?.color ?? '#8A8782'}22` }}
      aria-hidden
    >
      {category?.icon ?? '📦'}
    </span>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function UserAvatar({ user, size = 'md', className = '' }) {
  const sizes = {
    sm: { ring: 'p-[2px]', inner: 'h-8 w-8 p-[1.5px]', text: 'text-sm' },
    md: { ring: 'p-[2.5px]', inner: 'h-11 w-11 p-[2px]', text: 'text-base' },
    lg: { ring: 'p-[3px]', inner: 'h-14 w-14 p-[2.5px]', text: 'text-xl' },
  };
  const s = sizes[size] || sizes.md;
  const initial = user?.name?.[0]?.toUpperCase() || 'U';

  return (
    <div
      className={`rounded-full bg-gradient-to-tr from-accent via-amber-400 to-rose-500 shadow-sm shrink-0 ${s.ring} ${className}`}
    >
      <div className={`rounded-full bg-surface overflow-hidden ${s.inner}`}>
        {user?.picture ? (
          <img
            src={user.picture}
            alt={user?.name ? `${user.name}'s avatar` : 'User avatar'}
            className="h-full w-full rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className={`grid h-full w-full place-items-center rounded-full bg-accent-soft font-semibold text-accent-text ${s.text}`}>
            {initial}
          </span>
        )}
      </div>
    </div>
  );
}
