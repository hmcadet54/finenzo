import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, patch, post } from './api.js';

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: () => get('/categories'), select: (d) => d.items, staleTime: 5 * 60_000 });

export const useDashboard = (cycleId) =>
  useQuery({ queryKey: ['dashboard', cycleId], queryFn: () => get('/dashboard', { cycleId }) });

export const useExpenses = (params) =>
  useQuery({ queryKey: ['expenses', params], queryFn: () => get('/expenses', params), select: (d) => d.items });

export const useIncome = (cycleId) =>
  useQuery({ queryKey: ['income', cycleId], queryFn: () => get('/income', { cycleId }), select: (d) => d.items });

export const useSubscriptions = () => useQuery({ queryKey: ['subscriptions'], queryFn: () => get('/subscriptions') });
export const useFriends = () => useQuery({ queryKey: ['friends'], queryFn: () => get('/friends') });
export const useFriend = (id) => useQuery({ queryKey: ['friend', id], queryFn: () => get(`/friends/${id}`) });
export const useLoanOverview = () => useQuery({ queryKey: ['loan-overview'], queryFn: () => get('/loans/overview') });

/** Mutation that refreshes all server state afterwards (data set is small, this keeps things consistent). */
export function useApi(fn, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    ...options,
    onSettled: (...args) => {
      qc.invalidateQueries();
      options.onSettled?.(...args);
    },
  });
}

export const api = { get, post, patch, del };

/** Optimistic expense creation: show the row instantly in unfiltered list caches. */
export function useAddExpense(options = {}) {
  const qc = useQueryClient();
  return useApi((body) => post('/expenses', body), {
    ...options,
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ['expenses'] });
      const temp = {
        id: `tmp-${Date.now()}`,
        amount: body.amountValue ?? 0,
        label: body.label,
        date: body.date,
        categoryId: body.categoryId ?? null,
        note: body.note ?? '',
        source: 'manual',
      };
      qc.setQueriesData({ queryKey: ['expenses'] }, (old) => {
        if (!old?.items) return old;
        return { ...old, items: [temp, ...old.items] };
      });
    },
  });
}
