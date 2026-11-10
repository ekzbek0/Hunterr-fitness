/**
 * M3 local reminders: keeps the device's scheduled AVCI notifications equal to
 * what the user's settings and the current plan call for. Idempotent: running
 * it after every change (time, program, move, day rollover, restore) never
 * creates duplicates. Permission denial or an unsupported platform never
 * blocks the app; the result says what happened so the UI can tell the truth.
 */
import type { AppSettings, AvciRepository, StoreTx } from '@/data/types';
import { localDateIn } from '@/domain/game/task-day';
import { diffReminders, normalizeReminderTimes, planReminders, REMINDER_HORIZON_DAYS, type DayPlan } from '@/domain/reminders/plan';
import { addDays, buildWeek, weekStartOf } from '@/domain/training/schedule';
import type { ReminderPermission, ReminderScheduler } from '@/platform/reminder-types';
import { systemClock, type Clock } from '@/services/avci-service';

export type ReminderSyncResult =
  | { state: 'unsupported' }
  | { state: 'off' }
  | { state: 'permission-denied'; permission: ReminderPermission }
  | { state: 'scheduled'; count: number; nextAt: string | null }
  | { state: 'error'; message: string };

export interface ReminderStatus {
  supported: boolean;
  permission: ReminderPermission;
  settings: AppSettings['reminders'];
  scheduledCount: number;
}

export class ReminderService {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly repo: AvciRepository,
    private readonly scheduler: ReminderScheduler,
    private readonly clock: Clock = systemClock,
  ) {}

  get supported(): boolean {
    return this.scheduler.supported;
  }

  /** Serialises device operations so overlapping refreshes cannot double-schedule. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }

  async status(): Promise<ReminderStatus> {
    const settings = await this.repo.transaction((tx) => tx.getSettings());
    if (!this.scheduler.supported) {
      return { supported: false, permission: 'unsupported', settings: settings.reminders, scheduledCount: 0 };
    }
    try {
      const [permission, ids] = await Promise.all([this.scheduler.permission(), this.scheduler.listScheduledIds()]);
      return { supported: true, permission, settings: settings.reminders, scheduledCount: ids.length };
    } catch {
      return { supported: true, permission: 'undetermined', settings: settings.reminders, scheduledCount: 0 };
    }
  }

  /**
   * Saves the user's choice. Turning reminders on asks for permission once
   * (only when undetermined). The choice is stored even if permission is
   * denied, so reminders start working once the user allows them in iOS
   * Settings; until then nothing is scheduled and the app works normally.
   */
  async save(input: { enabled: boolean; times: readonly string[] }): Promise<ReminderSyncResult> {
    let times: string[];
    try {
      times = normalizeReminderTimes(input.times);
    } catch {
      return { state: 'error', message: 'Geçersiz saat (SS:DD, en fazla 3).' };
    }
    if (input.enabled && times.length === 0) return { state: 'error', message: 'En az bir saat seç.' };
    await this.repo.transaction(async (tx) => {
      const s = await tx.getSettings();
      await tx.putSettings({ ...s, reminders: { enabled: input.enabled, times } });
    });
    if (input.enabled && this.scheduler.supported) {
      try {
        if ((await this.scheduler.permission()) === 'undetermined') await this.scheduler.requestPermission();
      } catch {
        // Treated as denied by reconcile below.
      }
    }
    return this.reconcile();
  }

  /** Cancels every AVCI reminder (used by delete-all before data is cleared). */
  cancelAll(): Promise<void> {
    return this.serial(() => this.scheduler.cancelAll());
  }

  /** Delete-all: no pending reminder and no delivered banner (with a workout title) stays behind. */
  wipe(): Promise<void> {
    return this.serial(async () => {
      await this.scheduler.cancelAll();
      await this.scheduler.clearDelivered();
    });
  }

  reconcile(): Promise<ReminderSyncResult> {
    return this.serial(() => this.reconcileNow());
  }

  private async reconcileNow(): Promise<ReminderSyncResult> {
    if (!this.scheduler.supported) return { state: 'unsupported' };
    try {
      const now = this.clock.now();
      const timeZone = this.clock.timeZone();
      const { settings, days, resolved } = await this.repo.transaction((tx) => this.readPlan(tx, now, timeZone));
      if (!settings.reminders.enabled || settings.reminders.times.length === 0 || days.length === 0) {
        await this.scheduler.cancelAll();
        return { state: 'off' };
      }
      const permission = await this.scheduler.permission();
      if (permission !== 'granted') {
        // Nothing can fire anyway; leave no stale requests behind.
        await this.scheduler.cancelAll();
        return { state: 'permission-denied', permission };
      }
      const desired = planReminders({ now, timeZone, times: settings.reminders.times, days, resolvedDates: resolved });
      const diff = diffReminders(desired, await this.scheduler.listScheduledIds());
      for (const id of diff.cancel) await this.scheduler.cancel(id);
      for (const r of diff.schedule) await this.scheduler.schedule(r);
      return { state: 'scheduled', count: desired.length, nextAt: desired[0]?.fireAt ?? null };
    } catch (e) {
      return { state: 'error', message: e instanceof Error ? e.message : String(e) };
    }
  }

  private async readPlan(tx: StoreTx, now: Date, timeZone: string) {
    const settings = await tx.getSettings();
    const profile = await tx.getProfile();
    if (!profile) return { settings, days: [] as DayPlan[], resolved: [] as string[] };
    const today = localDateIn(now, timeZone);
    const dates = Array.from({ length: REMINDER_HORIZON_DAYS }, (_, i) => addDays(today, i));
    const plan = await tx.getLatestPlan();
    let days: DayPlan[];
    if (!plan) {
      days = dates.map((date) => ({ date, kind: 'open' as const }));
    } else {
      const weeks = [...new Set(dates.map(weekStartOf))];
      const planned = (
        await Promise.all(
          weeks.map(async (w) => buildWeek(plan.program, w, await tx.listMoves(w), await tx.listSessionsForWeek(w), today)),
        )
      ).flat();
      days = dates.map((date) => {
        const titles = planned.filter((p) => p.date === date && p.state !== 'done').map((p) => p.title);
        const doneHere = planned.some((p) => p.date === date && p.state === 'done');
        if (titles.length > 0) return { date, kind: 'training' as const, titles };
        return doneHere ? { date, kind: 'training' as const, titles: [] } : { date, kind: 'recovery' as const };
      });
    }
    // Today's core already resolved (training done or recovery completed): no reminder for today.
    const latest = await tx.getLatestTaskDay();
    const resolved: string[] = [];
    if (latest && latest.localDate === today) {
      const core = await tx.getSlot(latest.id, 'core');
      if (core?.status === 'completed') resolved.push(today);
    }
    for (const d of days) if (d.kind === 'training' && d.titles.length === 0) resolved.push(d.date);
    return { settings, days, resolved };
  }
}
