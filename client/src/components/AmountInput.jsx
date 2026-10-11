import { useId, useRef } from 'react';
import { describeExpression, parseAmount } from '../lib/money.js';
import { useAuth } from '../context/AuthContext.jsx';

const CHIPS = ['k', 'm', '+', '.'];

/**
 * Amount field accepting `5k`, `1.5k`, `3k + 500`. Uses a text input (as `k` and `+` are not on a
 * numeric keypad) with a helper chip row that inserts at the caret.
 */
export default function AmountInput({ label = 'Amount', value, onChange, placeholder = 'e.g. 1.5k or 3k + 500', allowNegative = false, autoFocus }) {
  const id = useId();
  const ref = useRef(null);
  const { user } = useAuth();
  const compact = user?.settings?.compactNumbers ?? true;

  const insert = (ch) => {
    const el = ref.current;
    const s = el?.selectionStart ?? value.length;
    const e = el?.selectionEnd ?? value.length;
    const next = value.slice(0, s) + (ch === '+' ? ' + ' : ch) + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = s + (ch === '+' ? 3 : 1);
      el?.setSelectionRange(pos, pos);
    });
  };

  const parsed = value ? parseAmount(value) : null;
  const invalid = value && (parsed == null || (!allowNegative && parsed <= 0));
  const preview = !invalid && value ? describeExpression(value, { compact: false }) : null;

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        className={`field serif-num text-lg ${invalid ? 'border-danger focus:border-danger focus:ring-danger/30' : ''}`}
        inputMode="text"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-2 flex items-center gap-2">
        {CHIPS.map((c) => (
          <button key={c} type="button" className="chip min-w-[44px] justify-center text-base" onClick={() => insert(c)} aria-label={`Insert ${c}`}>
            {c}
          </button>
        ))}
        <p id={`${id}-hint`} className={`num ml-auto truncate text-sm ${invalid ? 'text-danger' : 'text-muted'}`}>
          {invalid ? 'Not a valid amount' : preview && preview !== String(parsed) ? preview : ''}
        </p>
      </div>
      <span className="sr-only">{compact ? '' : ''}</span>
    </div>
  );
}
