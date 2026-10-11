import { useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/Toast.jsx';

/**
 * Undo-able deletes: the item is hidden immediately, the real DELETE runs after a grace period
 * unless the user taps "Undo" (or the page is closed, in which case it is flushed).
 */
const pending = new Map(); // key -> { timer, run }
let version = 0;
const listeners = new Set();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useHiddenIds() {
  useSyncExternalStore(subscribe, () => version);
  return new Set(pending.keys());
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    pending.forEach(({ timer, run }) => {
      clearTimeout(timer);
      run();
    });
  });
}

export function useUndoDelete() {
  const { toast, dismiss } = useToast();
  const qc = useQueryClient();

  return (key, message, runDelete, { delay = 5000 } = {}) => {
    if (pending.has(key)) return;
    const finish = async () => {
      pending.get(key) && clearTimeout(pending.get(key).timer);
      try {
        await runDelete();
        await qc.invalidateQueries();
      } catch (e) {
        toast(e.message || 'Could not delete', { tone: 'error' });
      } finally {
        pending.delete(key);
        emit();
      }
    };
    const timer = setTimeout(finish, delay);
    pending.set(key, { timer, run: finish });
    emit();
    const id = toast(message, {
      duration: delay,
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(timer);
          pending.delete(key);
          emit();
        },
      },
    });
    return id && dismiss;
  };
}
