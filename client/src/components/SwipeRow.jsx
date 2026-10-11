import { useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

const THRESHOLD = 84;

/**
 * Swipe left to delete, right to edit (touch). Vertical scrolling stays native.
 * On desktop use the optional hover actions / tap-to-edit.
 */
export default function SwipeRow({ children, onEdit, onDelete, onTap }) {
  const start = useRef(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const moved = useRef(false);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, locked: null };
    moved.current = false;
  };
  const onTouchMove = (e) => {
    const s = start.current;
    if (!s) return;
    const t = e.touches[0];
    const mx = t.clientX - s.x;
    const my = t.clientY - s.y;
    if (s.locked === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) s.locked = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
    if (s.locked !== 'x') return;
    moved.current = true;
    setDragging(true);
    setDx(Math.max(-140, Math.min(140, mx)));
  };
  const onTouchEnd = () => {
    if (dx <= -THRESHOLD && onDelete) onDelete();
    else if (dx >= THRESHOLD && onEdit) onEdit();
    setDx(0);
    setDragging(false);
    start.current = null;
  };

  return (
    <div className="group relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-between px-5" aria-hidden>
        <span className={`flex items-center gap-2 text-sm font-semibold text-accent-text ${dx > 0 ? 'opacity-100' : 'opacity-0'}`}>
          <Pencil size={18} /> Edit
        </span>
        <span className={`flex items-center gap-2 text-sm font-semibold text-danger ${dx < 0 ? 'opacity-100' : 'opacity-0'}`}>
          Delete <Trash2 size={18} />
        </span>
      </div>
      <div
        className={`relative bg-surface ${dragging ? '' : 'transition-transform duration-200'}`}
        style={{ transform: `translateX(${dx}px)`, touchAction: 'pan-y', backgroundColor: dx > 0 ? 'rgb(var(--accent-soft))' : dx < 0 ? 'rgb(var(--danger-soft))' : undefined }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClick={() => !moved.current && onTap?.()}
      >
        {children}
        {onDelete && (
          <button
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger group-hover:lg:grid"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Delete"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
