import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Inbox, RefreshCw, Repeat } from 'lucide-react';
import { useFmt } from '../context/AuthContext.jsx';

export { default as DatePicker } from './DatePicker.jsx';

export function ThemedSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option…',
  className = '',
  disabled = false,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        className="field flex items-center justify-between gap-2 text-left cursor-pointer select-none focus:outline-none"
      >
        <span className="truncate flex items-center gap-2 flex-1">
          {selectedOption ? (
            <>
              {selectedOption.icon}
              <span className="font-medium text-ink truncate">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className="badge bg-surface-2 text-muted text-[11px] ml-1 shrink-0">
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted/70">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="card absolute left-0 right-0 top-full z-50 mt-1.5 max-h-60 overflow-y-auto p-1.5 shadow-xl border border-line bg-surface animate-fade-in"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value ?? '__empty__'}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange?.(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition select-none ${
                  isSelected
                    ? 'bg-accent-soft text-accent-text font-semibold'
                    : 'text-ink hover:bg-surface-2 active:bg-surface-2'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {opt.icon}
                  <div className="truncate min-w-0">
                    <p className="truncate font-medium">{opt.label}</p>
                    {opt.subLabel && <p className="truncate text-xs text-muted">{opt.subLabel}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {opt.badge && (
                    <span className="badge bg-surface-2 text-muted text-[10px]">
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && <Check size={16} className="text-accent-text shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SubscriptionTag({ subscription, name, isManual, isPaid, className = '' }) {
  const subName = name || subscription?.name || 'Subscription';
  const color = subscription?.color || '#D97757';
  return (
    <span
      className={`clay-tag inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
      style={{
        backgroundColor: `${color}18`,
        color: color,
        border: `1px solid ${color}35`,
      }}
      title={`Attached to subscription: ${subName}`}
    >
      <Repeat size={11} strokeWidth={2.5} className="shrink-0" />
      <span className="truncate max-w-[130px]">{subName}</span>
      {isPaid && (
        <span
          className="ml-0.5 rounded px-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: `${color}25` }}
        >
          Paid
        </span>
      )}
    </span>
  );
}

export function Checkbox({ checked, onChange, disabled = false, className = '', label, children, id }) {
  return (
    <label className={`inline-flex items-center gap-3 cursor-pointer select-none ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}>
      <span
        role="checkbox"
        tabIndex={disabled ? -1 : 0}
        aria-checked={checked}
        id={id}
        onKeyDown={(e) => {
          if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
            e.preventDefault();
            onChange?.(!checked);
          }
        }}
        onClick={(e) => {
          e.preventDefault();
          if (!disabled) onChange?.(!checked);
        }}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-all ${
          checked
            ? 'border-accent bg-accent text-on-accent shadow-sm'
            : 'border-line bg-surface hover:border-muted'
        }`}
      >
        {checked && <Check size={13} strokeWidth={3} className="text-white mix-blend-difference" />}
      </span>
      {(label || children) && <span className="text-sm font-medium text-ink">{label || children}</span>}
    </label>
  );
}

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
