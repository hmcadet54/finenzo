import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError, api, patch, post, setUnauthorizedHandler, tokenStore } from '../lib/api.js';
import { applyAccent } from '../lib/theme.js';
import { currencySymbol, formatMoney } from '../lib/money.js';

const AuthContext = createContext(null);
const USER_KEY = 'finenzo.user';

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  // 'loading' → show splash; never flash the login screen while the token is being checked.
  const [state, setState] = useState({ status: tokenStore.get() ? 'loading' : 'anon', user: null });
  const started = useRef(false);

  const setUser = useCallback((user) => {
    if (user?.settings?.accent) applyAccent(user.settings.accent);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState({ status: 'authed', user });
  }, []);

  const clear = useCallback(() => {
    tokenStore.clear();
    localStorage.removeItem(USER_KEY);
    qc.clear();
    if ('caches' in window) caches.delete('finenzo-api');
    setState({ status: 'anon', user: null });
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(clear);
  }, [clear]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!tokenStore.get()) return;
    api('/auth/me')
      .then(({ user }) => setUser(user))
      .catch((err) => {
        if (err instanceof ApiClientError && err.status === 401) return clear();
        // Offline / server down: open with the last known profile (read-only experience).
        const cached = localStorage.getItem(USER_KEY);
        if (cached) setUser(JSON.parse(cached));
        else clear();
      });
  }, [clear, setUser]);

  const loginWithGoogle = useCallback(
    async (idToken) => {
      const { token, user } = await post('/auth/google', { idToken });
      tokenStore.set(token);
      qc.clear();
      setUser(user);
    },
    [qc, setUser],
  );

  const updateSettings = useCallback(
    async ({ name, settings }) => {
      // optimistic: apply immediately, roll back on failure
      const prev = state.user;
      const next = { ...prev, ...(name !== undefined ? { name } : {}), settings: { ...prev.settings, ...settings } };
      setUser(next);
      try {
        const { user } = await patch('/me', { name, settings });
        setUser(user);
        qc.invalidateQueries();
      } catch (e) {
        setUser(prev);
        throw e;
      }
    },
    [qc, setUser, state.user],
  );

  const value = useMemo(
    () => ({ ...state, loginWithGoogle, logout: clear, updateSettings, setUser }),
    [state, loginWithGoogle, clear, updateSettings, setUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Money formatter bound to the user's compact/full setting. */
export function useFmt() {
  const { user } = useAuth();
  const compact = user?.settings?.compactNumbers ?? true;
  const prefix = currencySymbol(user?.settings?.currency);
  return useCallback((n) => formatMoney(n, { compact, prefix }), [compact, prefix]);
}
