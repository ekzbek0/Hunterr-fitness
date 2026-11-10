import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { openRepository } from '@/data/open-repository';
import type { AvciRepository } from '@/data/types';
import { sweepBackupTemp } from '@/platform/backup-file';
import { createReminderScheduler } from '@/platform/reminder-scheduler';
import { AvciService, type CompletionResult, type TodaySnapshot } from '@/services/avci-service';
import { ReminderService, type ReminderSyncResult } from '@/services/reminder-service';

interface AvciContextValue {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  snapshot: TodaySnapshot | null;
  /** Increments after every reload so other screens (Antrenman) can re-read storage. */
  dataVersion: number;
  service: AvciService | null;
  /** The open repository, for M3 services (progress, backup) that build on the same storage. */
  repo: AvciRepository | null;
  /** M3 local reminders; reconciled after every reload (open, foreground, any change). */
  reminders: ReminderService | null;
  /** Result of the latest reminder reconciliation, for an honest status line. */
  reminderSync: ReminderSyncResult | null;
  refresh(): Promise<void>;
  /** Runs a mutation, then reloads the snapshot from storage (never from React state). */
  act(fn: (s: AvciService) => Promise<CompletionResult | unknown>): Promise<CompletionResult | unknown>;
  retry(): void;
}

const Ctx = createContext<AvciContextValue | null>(null);

export function AvciProvider({ children }: { children: ReactNode }) {
  const [service, setService] = useState<AvciService | null>(null);
  const [repo, setRepo] = useState<AvciRepository | null>(null);
  const [reminders, setReminders] = useState<ReminderService | null>(null);
  const [reminderSync, setReminderSync] = useState<ReminderSyncResult | null>(null);
  const remindersRef = useRef<ReminderService | null>(null);
  const [snapshot, setSnapshot] = useState<TodaySnapshot | null>(null);
  const [status, setStatus] = useState<AvciContextValue['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);
  const serviceRef = useRef<AvciService | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Leftover backup copies (e.g. the app was killed while the share sheet was open) are removed at start.
        sweepBackupTemp();
        const r = await openRepository();
        const svc = new AvciService(r);
        const snap = await svc.loadToday();
        if (cancelled) return void r.close();
        serviceRef.current = svc;
        const rem = new ReminderService(r, createReminderScheduler());
        remindersRef.current = rem;
        setService(svc);
        setRepo(r);
        setReminders(rem);
        void rem.reconcile().then((res) => !cancelled && setReminderSync(res));
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
      setDataVersion((n) => n + 1);
      setError(null);
      // Time, program, move or day changes all pass through here; reconciling is idempotent.
      const rem = remindersRef.current;
      if (rem) void rem.reconcile().then(setReminderSync);
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
    () => ({ status, error, snapshot, dataVersion, service, repo, reminders, reminderSync, refresh, act, retry: () => {
        setStatus('loading');
        setAttempt((n) => n + 1);
      } }),
    [status, error, snapshot, dataVersion, service, repo, reminders, reminderSync, refresh, act],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAvci(): AvciContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAvci must be used inside AvciProvider');
  return v;
}
