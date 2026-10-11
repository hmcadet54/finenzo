import { createContext, useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../lib/api.js';

/** Selected cycle (null = current). Shared by Home and Expenses so they stay in sync. */
const CycleContext = createContext(null);

export function CycleProvider({ children }) {
  const [selectedId, setSelectedId] = useState(null);
  const { data } = useQuery({ queryKey: ['cycles'], queryFn: () => get('/cycles') });
  const cycles = useMemo(() => data?.items ?? [], [data]);
  const value = useMemo(
    () => ({ cycles, selectedId, setSelectedId }),
    [cycles, selectedId],
  );
  return <CycleContext.Provider value={value}>{children}</CycleContext.Provider>;
}

export const useCycle = () => useContext(CycleContext);
