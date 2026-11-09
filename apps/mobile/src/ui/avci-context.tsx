import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { openRepository } from '@/data/open-repository';
import { AvciService, type CompletionResult, type TodaySnapshot } from '@/services/avci-service';

interface AvciContextValue {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  snapshot: TodaySnapshot | null;
  service: AvciService | null;
  refresh(): Promise<void>;
  /** Runs a mutation, then reloads the snapshot from storage (never from React state). */
  act(fn: (s: AvciService) => Promise<CompletionResult | unknown>): Promise<CompletionResult | unknown>;
  retry(): void;
}

const Ctx = createContext<AvciContextValue | null>(null);

export function AvciProvider({ children }: { children: ReactNode }) {
  const [service, setService] = useState<AvciService | null>(null);
  const [snapshot, setSnapshot] = useState<TodaySnapshot | null>(null);
  const [status, setStatus] = useState<AvciContextValue['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const serviceRef = useRef<AvciService | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = await openRepository();
        const svc = new AvciService(repo);
        const snap = await svc.loadToday();
        if (cancelled) return void repo.close();
        serviceRef.current = svc;
        setService(svc);
        setSnapshot(snap);
        setStatus('ready');
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const refresh = useCallback(async () => {
    const svc = serviceRef.current;
    if (!svc) return;
    try {
      setSnapshot(await svc.loadToday());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Day rollover is decided on open and on every return to foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const act = useCallback(
    async (fn: (s: AvciService) => Promise<CompletionResult | unknown>) => {
      const svc = serviceRef.current;
      if (!svc) throw new Error('Veri deposu hazır değil');
      try {
        return await fn(svc);
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  const value = useMemo<AvciContextValue>(
    () => ({ status, error, snapshot, service, refresh, act, retry: () => {
        setStatus('loading');
        setAttempt((n) => n + 1);
      } }),
    [status, error, snapshot, service, refresh, act],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAvci(): AvciContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAvci must be used inside AvciProvider');
  return v;
}
