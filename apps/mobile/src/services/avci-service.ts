/**
 * Application service: the only place that combines persistence with domain
 * rules. Every mutation runs in one repository transaction, so completion,
 * slot state and the XP ledger commit together or not at all.
 */
import { newId } from '@/data/ids';
import type { AvciRepository, DailyCheckin, LedgerEntry, Profile, QuestSlot, StoreTx, TaskDay } from '@/data/types';
import {
  awardedXp,
  DEFAULT_MULTIPLIER_HALVES,
  isMultiplierHalves,
  levelProgress,
  type LevelProgress,
  type MultiplierHalves,
} from '@/domain/game/economy';
import { buildDaySlots, DEFAULT_HABIT_KEYS, SLOT_KEYS, validateHabitKeys, type CoreResolution } from '@/domain/game/quests';
import { decideTaskDay, isValidTimeZone } from '@/domain/game/task-day';
import { suggestCore, validateCheckin, type CheckinInput, type CoreSuggestion } from '@/domain/training/readiness';

export interface Clock {
  now(): Date;
  timeZone(): string;
}

export const systemClock: Clock = {
  now: () => new Date(),
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

export interface TodaySnapshot {
  profile: Profile | null;
  today: TaskDay | null;
  slots: QuestSlot[];
  checkin: DailyCheckin | null;
  suggestion: CoreSuggestion | null;
  /** True when the device clock moved backwards; new rewards are paused. */
  rewardsFrozen: boolean;
  progress: LevelProgress;
  todayXp: number;
  recentLedger: LedgerEntry[];
  recentDays: TaskDay[];
  storageKind: string;
}

export type CompletionResult =
  | { status: 'awarded'; entry: LedgerEntry }
  | { status: 'already-completed'; entry: LedgerEntry | null }
  | { status: 'rejected'; reason: 'no-profile' | 'day-changed' | 'clock-frozen' | 'unknown-slot' | 'invalid' };

export class AvciService {
  constructor(
    private readonly repo: AvciRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  get storageKind() {
    return this.repo.kind;
  }

  async createProfile(input: { habitKeys?: readonly string[]; multiplierHalves?: number }): Promise<Profile> {
    const habitKeys = validateHabitKeys(input.habitKeys ?? DEFAULT_HABIT_KEYS);
    const multiplierHalves = input.multiplierHalves ?? DEFAULT_MULTIPLIER_HALVES;
    if (!isMultiplierHalves(multiplierHalves)) throw new RangeError('unsupported multiplier');
    const timezone = this.deviceTimeZone();
    return this.repo.transaction(async (tx) => {
      const existing = await tx.getProfile();
      if (existing) return existing; // idempotent on double tap
      const now = this.clock.now().toISOString();
      const profile: Profile = { id: newId(), timezone, multiplierHalves, habitKeys, createdAt: now, confirmedAt: now };
      await tx.putProfile(profile);
      await this.ensureToday(tx, profile);
      return profile;
    });
  }

  /** Settings affect the NEXT task day; today's snapshot is never rewritten. */
  async updateSettings(input: { habitKeys?: readonly string[]; multiplierHalves?: number }): Promise<Profile> {
    return this.repo.transaction(async (tx) => {
      const profile = await tx.getProfile();
      if (!profile) throw new Error('Profil yok');
      const next: Profile = { ...profile, confirmedAt: this.clock.now().toISOString() };
      if (input.habitKeys) next.habitKeys = validateHabitKeys(input.habitKeys);
      if (input.multiplierHalves !== undefined) {
        if (!isMultiplierHalves(input.multiplierHalves)) throw new RangeError('unsupported multiplier');
        next.multiplierHalves = input.multiplierHalves;
      }
      await tx.putProfile(next);
      return next;
    });
  }

  /** Opens/resumes today (closing a finished day once) and returns the view. */
  async loadToday(): Promise<TodaySnapshot> {
    return this.repo.transaction(async (tx) => {
      const profile = await tx.getProfile();
      const ensured = profile ? await this.ensureToday(tx, profile) : null;
      const today = ensured?.day ?? null;
      const slots = today ? await tx.listSlots(today.id) : [];
      const checkin = today ? await tx.getCheckin(today.id) : null;
      const ledger = profile ? await tx.listLedger(50) : [];
      const total = profile ? await tx.totalXp(profile.id) : 0;
      const todayXp = today
        ? ledger.filter((e) => e.scopeKind === 'day' && e.scopeId === today.id).reduce((s, e) => s + e.awardedXp, 0)
        : 0;
      return {
        profile,
        today,
        slots,
        checkin,
        suggestion: checkin ? suggestCore(checkin) : null,
        rewardsFrozen: ensured?.clockAnomaly ?? false,
        progress: levelProgress(total),
        todayXp,
        recentLedger: ledger.slice(0, 20),
        recentDays: profile ? await tx.listTaskDays(14) : [],
        storageKind: this.repo.kind,
      };
    });
  }

  /** Saves (or corrects) today's check-in. The check-in reward is granted once. */
  async recordCheckin(taskDayId: string, input: CheckinInput): Promise<CompletionResult> {
    let checkin: CheckinInput;
    try {
      checkin = validateCheckin(input);
    } catch {
      return { status: 'rejected', reason: 'invalid' };
    }
    return this.repo.transaction(async (tx) => {
      const ctx = await this.currentDay(tx, taskDayId);
      if ('reason' in ctx) return { status: 'rejected', reason: ctx.reason };
      await tx.putCheckin({ ...checkin, taskDayId, recordedAt: this.clock.now().toISOString() });
      return this.completeSlot(tx, ctx.profile, ctx.day, SLOT_KEYS.checkin, null);
    });
  }

  /**
   * Completes the daily core as training or planned recovery: same reward.
   * A completed core keeps its single reward even if the user later swaps mode.
   */
  async completeCore(taskDayId: string, resolution: CoreResolution): Promise<CompletionResult> {
    if (!['training', 'recovery', 'illness-recovery'].includes(resolution)) {
      return { status: 'rejected', reason: 'invalid' };
    }
    return this.repo.transaction(async (tx) => {
      const ctx = await this.currentDay(tx, taskDayId);
      if ('reason' in ctx) return { status: 'rejected', reason: ctx.reason };
      return this.completeSlot(tx, ctx.profile, ctx.day, SLOT_KEYS.core, resolution);
    });
  }

  async completeHabit(taskDayId: string, slotKey: string): Promise<CompletionResult> {
    if (slotKey !== SLOT_KEYS.habit1 && slotKey !== SLOT_KEYS.habit2) {
      return { status: 'rejected', reason: 'unknown-slot' };
    }
    return this.repo.transaction(async (tx) => {
      const ctx = await this.currentDay(tx, taskDayId);
      if ('reason' in ctx) return { status: 'rejected', reason: ctx.reason };
      return this.completeSlot(tx, ctx.profile, ctx.day, slotKey, null);
    });
  }

  // ---- internals (always called inside a transaction) ----

  private deviceTimeZone(): string {
    const tz = this.clock.timeZone();
    return isValidTimeZone(tz) ? tz : 'UTC';
  }

  private async ensureToday(tx: StoreTx, profile: Profile): Promise<{ day: TaskDay; clockAnomaly: boolean }> {
    const now = this.clock.now();
    const nowIso = now.toISOString();
    const deviceTz = this.deviceTimeZone();
    const latest = await tx.getLatestTaskDay();
    const decision = decideTaskDay(latest, now, deviceTz);

    if (decision.action === 'resume') {
      if (!latest) throw new Error('resume without a task day');
      if (!decision.clockAnomaly && nowIso > latest.lastSeenAt) {
        latest.lastSeenAt = nowIso;
        await tx.updateTaskDay(latest);
      }
      return { day: latest, clockAnomaly: decision.clockAnomaly };
    }
    if (latest && decision.action === 'rollover' && latest.closedAt === null) {
      await tx.updateTaskDay({ ...latest, closedAt: nowIso });
    }
    const day: TaskDay = {
      id: newId(),
      sequence: (latest?.sequence ?? 0) + 1,
      localDate: decision.localDate,
      timezone: deviceTz,
      openedAt: nowIso,
      closedAt: null,
      multiplierHalves: profile.multiplierHalves, // snapshot for this day
      lastSeenAt: nowIso,
    };
    await tx.insertTaskDay(day);
    for (const t of buildDaySlots(profile.habitKeys)) {
      await tx.insertSlot({ ...t, taskDayId: day.id, status: 'open', resolution: null, completedAt: null, version: 1 });
    }
    return { day, clockAnomaly: false };
  }

  private async currentDay(
    tx: StoreTx,
    taskDayId: string,
  ): Promise<{ profile: Profile; day: TaskDay } | { reason: 'no-profile' | 'day-changed' | 'clock-frozen' }> {
    const profile = await tx.getProfile();
    if (!profile) return { reason: 'no-profile' };
    const { day, clockAnomaly } = await this.ensureToday(tx, profile);
    if (clockAnomaly) return { reason: 'clock-frozen' };
    if (day.id !== taskDayId) return { reason: 'day-changed' };
    return { profile, day };
  }

  private async completeSlot(
    tx: StoreTx,
    profile: Profile,
    day: TaskDay,
    slotKey: string,
    resolution: CoreResolution | null,
  ): Promise<CompletionResult> {
    const slot = await tx.getSlot(day.id, slotKey);
    if (!slot) return { status: 'rejected', reason: 'unknown-slot' };
    if (slot.status === 'completed') {
      return { status: 'already-completed', entry: await tx.findLedger(profile.id, 'day', day.id, slotKey) };
    }
    const completedAt = this.clock.now().toISOString();
    await tx.updateSlot({ ...slot, status: 'completed', resolution, completedAt, version: slot.version + 1 });
    const entry: LedgerEntry = {
      id: newId(),
      profileId: profile.id,
      scopeKind: 'day',
      scopeId: day.id,
      slotKey,
      baseXp: slot.baseXp,
      multiplierHalves: day.multiplierHalves as MultiplierHalves,
      awardedXp: awardedXp(slot.baseXp, day.multiplierHalves),
      completedAt,
    };
    if ((await tx.insertLedger(entry)) === 'conflict') {
      return { status: 'already-completed', entry: await tx.findLedger(profile.id, 'day', day.id, slotKey) };
    }
    return { status: 'awarded', entry };
  }
}
