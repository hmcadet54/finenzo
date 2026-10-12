import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

export function toDateStr(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateStr(s) {
  if (!s || typeof s !== 'string') return null;
  const parts = s.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date;
}

function formatDisplayDate(dateStr) {
  const d = parseDateStr(dateStr);
  if (!d) return '';
  const now = new Date();
  const todayStr = toDateStr(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = toDateStr(yesterday);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = toDateStr(tomorrow);

  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
  const monthName = d.toLocaleDateString('en-US', { month: 'short' });
  const dayNum = d.getDate();
  const year = d.getFullYear();
  const isCurrentYear = year === now.getFullYear();

  const formatted = isCurrentYear
    ? `${dayName}, ${dayNum} ${monthName}`
    : `${dayName}, ${dayNum} ${monthName} ${year}`;

  if (dateStr === todayStr) return `Today · ${formatted}`;
  if (dateStr === yesterdayStr) return `Yesterday · ${formatted}`;
  if (dateStr === tomorrowStr) return `Tomorrow · ${formatted}`;
  return formatted;
}

export default function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'Select date',
  className = '',
  disabled = false,
  required = false,
  clearable = false,
  compact = false,
  id,
  name,
  'aria-label': ariaLabel,
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);

  const selectedDate = useMemo(() => parseDateStr(value), [value]);
  const initialView = selectedDate || new Date();
  const [viewYear, setViewYear] = useState(initialView.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialView.getMonth());

  useEffect(() => {
    if (open) {
      const target = parseDateStr(value) || new Date();
      setViewYear(target.getFullYear());
      setViewMonth(target.getMonth());
      if (containerRef.current && typeof window !== 'undefined') {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.left + 320 > window.innerWidth && rect.right - 320 >= 0) {
          setAlignRight(true);
        } else {
          setAlignRight(false);
        }
      }
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (e.target && !document.contains(e.target)) return;
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const daysGrid = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // Monday as 0, Sunday as 6
    const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

    const days = [];
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      days.push({ day: d, month: m, year: y, isCurrentMonth: false, dateStr: `${y}-${pad(m + 1)}-${pad(d)}` });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, month: viewMonth, year: viewYear, isCurrentMonth: true, dateStr: `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}` });
    }

    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      days.push({ day: d, month: m, year: y, isCurrentMonth: false, dateStr: `${y}-${pad(m + 1)}-${pad(d)}` });
    }

    return days;
  }, [viewYear, viewMonth]);

  const todayIso = toDateStr(new Date());

  const isDateDisabled = (dateStr) => {
    if (min && dateStr < min) return true;
    if (max && dateStr > max) return true;
    return false;
  };

  const handleSelect = (dateStr) => {
    if (isDateDisabled(dateStr)) return;
    onChange(dateStr);
    setOpen(false);
  };

  const handleQuickSelect = (dateStr) => {
    onChange(dateStr);
    const d = parseDateStr(dateStr);
    if (d) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${open ? 'z-40' : ''} ${className}`}>
      {/* Trigger Button */}
      <div className="relative flex w-full items-center">
        <button
          type="button"
          disabled={disabled}
          id={inputId}
          aria-label={ariaLabel || placeholder}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-disabled={disabled}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) setOpen((o) => !o);
          }}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              e.stopPropagation();
              setOpen((o) => !o);
            }
          }}
          className={`field flex w-full cursor-pointer items-center justify-between text-left select-none transition-all ${
            compact ? '!h-10 text-sm px-3' : '!h-12'
          } ${clearable && value && !required && !disabled ? (compact ? 'pr-8' : 'pr-9') : ''} ${
            open ? 'border-accent ring-2 ring-accent/30' : ''
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <span className="flex items-center gap-2.5 truncate">
            <CalendarIcon size={compact ? 16 : 18} className="text-accent-text shrink-0" />
            <span className={`truncate ${value ? 'text-ink font-medium' : 'text-muted/70'}`}>
              {value ? (compact ? value : formatDisplayDate(value)) : placeholder}
            </span>
          </span>
        </button>
        {clearable && value && !required && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange('');
            }}
            className="absolute right-2.5 grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink shrink-0"
            title="Clear date"
            aria-label="Clear date"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Hidden native input for form compatibility */}
      <input type="hidden" name={name} value={value || ''} required={required} />

      {/* Themed Calendar Popover */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose date"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className={`card absolute ${alignRight ? 'right-0 left-auto' : 'left-0 right-auto'} z-50 mt-1.5 w-[310px] sm:w-[320px] p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 border border-line bg-surface`}
          style={{ maxWidth: 'min(92vw, 340px)' }}
        >
          {/* Quick shortcuts */}
          <div className="flex gap-1.5 pb-2.5 mb-2.5 border-b border-line overflow-x-auto no-scrollbar">
            <button
              type="button"
              disabled={isDateDisabled(todayIso)}
              onClick={() => handleQuickSelect(todayIso)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                value === todayIso ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink hover:bg-line'
              } disabled:opacity-40`}
            >
              Today
            </button>
            <button
              type="button"
              disabled={isDateDisabled(toDateStr(new Date(Date.now() - 86400000)))}
              onClick={() => handleQuickSelect(toDateStr(new Date(Date.now() - 86400000)))}
              className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-line transition disabled:opacity-40"
            >
              Yesterday
            </button>
            <button
              type="button"
              disabled={isDateDisabled(toDateStr(new Date(Date.now() + 86400000)))}
              onClick={() => handleQuickSelect(toDateStr(new Date(Date.now() + 86400000)))}
              className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-line transition disabled:opacity-40"
            >
              Tomorrow
            </button>
          </div>

          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between px-1 mb-2">
            <h3 className="font-serif font-medium text-base text-ink">
              {MONTHS[viewMonth]} <span className="num font-sans text-sm text-muted">{viewYear}</span>
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-2 text-ink transition active:scale-95"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-2 text-ink transition active:scale-95"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-[11px] font-semibold tracking-wider text-muted py-0.5 uppercase">
                {w}
              </span>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {daysGrid.map((item) => {
              const isSelected = value === item.dateStr;
              const isToday = item.dateStr === todayIso;
              const disabled = isDateDisabled(item.dateStr);

              return (
                <button
                  key={item.dateStr}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSelect(item.dateStr)}
                  className={`num relative grid h-9 w-full place-items-center rounded-xl text-[13px] font-medium transition-all ${
                    isSelected
                      ? 'bg-accent text-on-accent font-semibold shadow-sm'
                      : !item.isCurrentMonth
                      ? 'text-muted/40 hover:bg-surface-2 hover:text-ink'
                      : 'text-ink hover:bg-accent-soft hover:text-accent-text'
                  } ${isToday && !isSelected ? 'ring-1.5 ring-accent/60 font-semibold text-accent-text' : ''} ${
                    disabled ? 'opacity-25 pointer-events-none' : ''
                  }`}
                  aria-label={item.dateStr}
                >
                  {item.day}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
