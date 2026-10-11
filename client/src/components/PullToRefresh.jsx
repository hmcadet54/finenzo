import { useEffect, useRef, useState } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Loader2, ArrowDown } from 'lucide-react';

/** Pull-to-refresh for touch devices (the browser's native one is disabled via overscroll-behavior). */
export default function PullToRefresh({ children }) {
  const qc = useQueryClient();
  const fetching = useIsFetching() > 0;
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pullRef = useRef(0);

  useEffect(() => {
    if (refreshing && !fetching) {
      const t = setTimeout(() => setRefreshing(false), 300);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [refreshing, fetching]);

  useEffect(() => {
    const onStart = (e) => {
      startY.current = window.scrollY <= 0 && !document.body.style.overflow ? e.touches[0].clientY : null;
    };
    const onMove = (e) => {
      if (startY.current == null) return;
      const d = e.touches[0].clientY - startY.current;
      if (d > 0 && window.scrollY <= 0) {
        pullRef.current = Math.min(d * 0.5, 90);
        setPull(pullRef.current);
      } else if (pullRef.current) {
        pullRef.current = 0;
        setPull(0);
      }
    };
    const onEnd = () => {
      if (pullRef.current >= 64) {
        setRefreshing(true);
        qc.invalidateQueries();
      }
      startY.current = null;
      pullRef.current = 0;
      setPull(0);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [qc]);

  const shown = refreshing ? 48 : pull;
  return (
    <div>
      <div className="flex items-center justify-center overflow-hidden text-accent-text transition-[height] duration-150" style={{ height: shown }} aria-hidden={!shown}>
        {refreshing ? <Loader2 className="animate-spin" size={22} /> : <ArrowDown size={22} style={{ transform: `rotate(${pull >= 64 ? 180 : 0}deg)`, transition: 'transform .15s' }} />}
      </div>
      {children}
    </div>
  );
}
