import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/** Bottom sheet on mobile, centred dialog on desktop. */
export default function Sheet({ open, onClose, title, children, footer }) {
  const panel = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => panel.current?.querySelector('input,textarea,select')?.focus({ preventScroll: true }), 120);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <div className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92dvh] w-full animate-sheet-up flex-col rounded-t-3xl bg-bg shadow-pop lg:max-h-[86vh] lg:max-w-md lg:rounded-3xl"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line lg:hidden" aria-hidden />
        <header className="flex shrink-0 items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-xl font-medium">{title}</h2>
          <button className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-surface-2" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && (
          <footer className="shrink-0 border-t border-line bg-bg px-5 pt-3" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
            {footer}
          </footer>
        )}
        {!footer && <div style={{ height: 'env(safe-area-inset-bottom)' }} />}
      </div>
    </div>
  );
}
