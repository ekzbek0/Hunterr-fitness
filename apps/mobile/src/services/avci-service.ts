/**
 * Application service: the only place that combines persistence with domain
 * rules. Every mutation runs in one repository transaction, so completion,
 * slot state and the XP ledger commit together or not at all.
 */
import { newId } from '@/data/ids';
import type {
  AvciRepository,
  DailyCheckin,
  LedgerEntry,
  PlanVersion,
  Profile,
  QuestSlot,
  SetLog,
  StoreTx,
  TaskDay,
  TrainingProfile,
  WorkoutSession,
} from '@/data/types';
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
import { exerciseById } from '@/domain/training/catalog';
import {
  diffPrograms,
  generateProgram,
  ProgramError,
  validateProgram,
  weeklyExposure,
  type MuscleGroup,
  type Program,
  type ProgramChange,
  type ProgramErrorCode,
} from '@/domain/training/program';
import { validateTrainingProfile, type TrainingProfileInput } from '@/domain/training/profile';
import { suggestCore, validateCheckin, type CheckinInput, type CoreSuggestion } from '@/domain/training/readiness';
import {
  buildWeek,
  validateMove,
  weekStartOf,
  type MoveError,
  type PlannedSession,
} from '@/domain/training/schedule';
import { summarizeSets, validateSet, type SessionSummary, type SetInput } from '@/domain/training/workout';

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
  /** Today's planned workout (if a program exists) and any unfinished workout. */
  training: { hasProgram: boolean; planned: PlannedSession | null; activeSession: WorkoutSession | null };
}

export type RejectReason =
  | 'no-profile'
  | 'day-changed'
  | 'clock-frozen'
  | 'unknown-slot'
  | 'invalid'
  /** Today's check-in reports illness: structured training is paused, recovery is offered. */
  | 'illness';

export type CompletionResult =
  | { status: 'awarded'; entry: LedgerEntry }
  | { status: 'already-completed'; entry: LedgerEntry | null }
  | { status: 'rejected'; reason: RejectReason };

export type TrainingRejectReason =
  | RejectReason
  | 'no-training-profile'
  | 'no-plan'
  | 'plan-changed'
  | 'plan-invalid'
  | 'not-today'
  | 'already-done'
  | 'unknown-session'
  | 'not-in-progress'
  | 'exercise-not-in-session'
  | 'no-work-sets'
  | MoveError;

export type TrainingResult<T> = { status: 'ok'; value: T } | { status: 'rejected'; reason: TrainingRejectReason; detail?: string };

export interface ActiveWorkout {
  session: WorkoutSession;
  sets: SetLog[];
  summary: SessionSummary;
}

export interface TrainingSnapshot {
  profile: Profile | null;
  today: TaskDay | null;
  trainingProfile: TrainingProfile | null;
  plan: PlanVersion | null;
  /** Set when the stored plan no longer fits the confirmed equipment/limitations. */
  planIssue: ProgramErrorCode | null;
  exposure: Record<MuscleGroup, number> | null;
  weekStart: string | null;
  week: PlannedSession[];
  active: ActiveWorkout | null;
  /** Latest finished sets per exercise of the active/planned sessions (reference only). */
  lastPerformance: Record<string, SetLog[]>;
  illnessToday: boolean;
  /** New/increasing joint pain reported today: affected movements should be skipped. */
  jointPainToday: boolean;
  coreCompleted: boolean;
  rewardsFrozen: boolean;
  planCount: number;
}

export interface FinishResult {
  session: WorkoutSession;
  /** Reward outcome for the daily core of the day the session was started. */
  reward: CompletionResult;
}

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
        training: await this.todayTraining(tx, today),
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
      return this.completeCoreInTx(tx, ctx.profile, ctx.day, resolution, null);
    });
  }

  // ---- M1: training profile, program, schedule, workout log ----

  async loadTraining(): Promise<TrainingSnapshot> {
    return this.repo.transaction(async (tx) => {
      const profile = await tx.getProfile();
      const ensured = profile ? await this.ensureToday(tx, profile) : null;
      const today = ensured?.day ?? null;
      const trainingProfile = await tx.getTrainingProfile();
      const plan = await tx.getLatestPlan();
      let planIssue: ProgramErrorCode | null = null;
      if (plan && trainingProfile) {
        try {
          validateProgram(plan.program, trainingProfile);
        } catch (e) {
          planIssue = e instanceof ProgramError ? e.code : 'unknown-exercise';
        }
      }
      const view = today && plan ? await this.weekView(tx, plan, today) : null;
      const activeSession = await tx.getActiveSession();
      const active = activeSession ? await this.activeWorkout(tx, activeSession) : null;
      const exerciseIds = new Set<string>();
      for (const e of active?.session.exercises ?? []) exerciseIds.add(e.exerciseId);
      const planned = view?.week.find((w) => w.date === today?.localDate && w.state === 'planned');
      for (const e of plan?.program.days.find((d) => d.id === planned?.programDayId)?.exercises ?? []) {
        exerciseIds.add(e.exerciseId);
      }
      const lastPerformance: Record<string, SetLog[]> = {};
      for (const id of exerciseIds) {
        const sets = (await tx.listFinishedSetsForExercise(id, 20)).filter((x) => x.kind === 'work');
        const latestSession = sets[0]?.sessionId;
        if (latestSession) lastPerformance[id] = sets.filter((x) => x.sessionId === latestSession);
      }
      const checkin = today ? await tx.getCheckin(today.id) : null;
      const core = today ? await tx.getSlot(today.id, SLOT_KEYS.core) : null;
      return {
        profile,
        today,
        trainingProfile,
        plan,
        planIssue,
        exposure: plan ? weeklyExposure(plan.program) : null,
        weekStart: view?.weekStart ?? null,
        week: view?.week ?? [],
        active,
        lastPerformance,
        illnessToday: checkin?.illness === 'yes',
        jointPainToday: checkin?.jointPain === 'yes',
        coreCompleted: core?.status === 'completed',
        rewardsFrozen: ensured?.clockAnomaly ?? false,
        planCount: (await tx.listPlans(1000)).length,
      };
    });
  }

  /** Stores user-confirmed training facts. Height/weight are optional. */
  async confirmTrainingProfile(input: TrainingProfileInput): Promise<TrainingResult<TrainingProfile>> {
    let facts;
    try {
      facts = validateTrainingProfile(input);
    } catch (e) {
      return { status: 'rejected', reason: 'invalid', detail: e instanceof Error ? e.message : undefined };
    }
    return this.repo.transaction(async (tx) => {
      const profile = await tx.getProfile();
      if (!profile) return { status: 'rejected', reason: 'no-profile' };
      const tp: TrainingProfile = { ...facts, profileId: profile.id, confirmedAt: this.clock.now().toISOString() };
      await tx.putTrainingProfile(tp);
      return { status: 'ok', value: tp };
    });
  }

  /** Deterministic proposal from the confirmed facts, with a diff against the current plan. */
  async proposeGeneratedProgram(): Promise<
    TrainingResult<{ program: Program; changes: ProgramChange[]; baseVersionId: string | null; skippedPatterns: string[] }>
  > {
    return this.repo.transaction(async (tx) => {
      const tp = await tx.getTrainingProfile();
      if (!tp) return { status: 'rejected', reason: 'no-training-profile' };
      const current = await tx.getLatestPlan();
      const { program, skippedPatterns } = generateProgram(tp);
      return {
        status: 'ok',
        value: {
          program,
          changes: current ? diffPrograms(current.program, program) : [],
          baseVersionId: current?.id ?? null,
          skippedPatterns,
        },
      };
    });
  }

  /**
   * Accepts a previewed program as a new immutable plan version. `baseVersionId`
   * must still be the latest plan (no silent last-writer-wins). Plan changes
   * never touch quest slots or the XP ledger.
   */
  async acceptProgram(input: {
    baseVersionId: string | null;
    program: Program;
    source: PlanVersion['source'];
  }): Promise<TrainingResult<{ plan: PlanVersion; changes: ProgramChange[] }>> {
    return this.repo.transaction(async (tx) => {
      const tp = await tx.getTrainingProfile();
      if (!tp) return { status: 'rejected', reason: 'no-training-profile' };
      let program: Program;
      try {
        program = validateProgram(input.program, tp);
      } catch (e) {
        return { status: 'rejected', reason: 'invalid', detail: e instanceof ProgramError ? e.code : undefined };
      }
      const current = await tx.getLatestPlan();
      if ((current?.id ?? null) !== input.baseVersionId) return { status: 'rejected', reason: 'plan-changed' };
      const changes = current ? diffPrograms(current.program, program) : [];
      if (current && changes.length === 0) return { status: 'ok', value: { plan: current, changes } };
      const now = this.clock.now().toISOString();
      const plan: PlanVersion = {
        id: newId(),
        parentId: current?.id ?? null,
        sequence: (current?.sequence ?? 0) + 1,
        source: input.source,
        reason: current ? JSON.stringify(changes) : JSON.stringify([{ kind: 'initial' }]),
        createdAt: now,
        acceptedAt: now,
        program,
      };
      await tx.insertPlan(plan);
      return { status: 'ok', value: { plan, changes } };
    });
  }

  /** Moves one planned session of the current week to today or a later free day. */
  async moveSession(slotId: string, toDate: string): Promise<TrainingResult<PlannedSession[]>> {
    return this.repo.transaction(async (tx) => {
      const profile = await tx.getProfile();
      if (!profile) return { status: 'rejected', reason: 'no-profile' };
      const { day } = await this.ensureToday(tx, profile);
      const plan = await tx.getLatestPlan();
      if (!plan) return { status: 'rejected', reason: 'no-plan' };
      const view = await this.weekView(tx, plan, day);
      const error = validateMove(view.week, slotId, toDate, day.localDate);
      if (error) return { status: 'rejected', reason: error };
      await tx.putMove({ slotId, weekStart: view.weekStart, toDate, movedAt: this.clock.now().toISOString() });
      return { status: 'ok', value: (await this.weekView(tx, plan, day)).week };
    });
  }

  /**
   * Starts today's planned session, or returns the unfinished one so it can be
   * resumed. Illness reported today pauses structured training.
   */
  async startWorkout(slotId: string): Promise<TrainingResult<WorkoutSession>> {
    return this.repo.transaction(async (tx) => {
      const profile = await tx.getProfile();
      if (!profile) return { status: 'rejected', reason: 'no-profile' };
      const active = await tx.getActiveSession();
      if (active) return { status: 'ok', value: active };
      const { day } = await this.ensureToday(tx, profile);
      const tp = await tx.getTrainingProfile();
      if (!tp) return { status: 'rejected', reason: 'no-training-profile' };
      const plan = await tx.getLatestPlan();
      if (!plan) return { status: 'rejected', reason: 'no-plan' };
      try {
        validateProgram(plan.program, tp);
      } catch {
        return { status: 'rejected', reason: 'plan-invalid' };
      }
      if ((await tx.getCheckin(day.id))?.illness === 'yes') return { status: 'rejected', reason: 'illness' };
      const { week } = await this.weekView(tx, plan, day);
      const planned = week.find((w) => w.slotId === slotId);
      if (!planned) return { status: 'rejected', reason: 'unknown-session' };
      if (planned.state === 'done') return { status: 'rejected', reason: 'already-done' };
      if (planned.date !== day.localDate) return { status: 'rejected', reason: 'not-today' };
      const programDay = plan.program.days.find((d) => d.id === planned.programDayId)!;
      const session: WorkoutSession = {
        id: newId(),
        taskDayId: day.id,
        scheduleSlotId: slotId,
        planVersionId: plan.id,
        programDayId: programDay.id,
        title: programDay.title,
        exercises: programDay.exercises.map((e) => ({ ...e })),
        startedAt: this.clock.now().toISOString(),
        finishedAt: null,
        status: 'in-progress',
        version: 1,
      };
      await tx.insertSession(session);
      return { status: 'ok', value: session };
    });
  }

  /** Persists one set immediately, so an interrupted workout resumes with every logged set. */
  async logSet(sessionId: string, input: SetInput): Promise<TrainingResult<SetLog>> {
    let set: SetInput;
    try {
      set = validateSet(input);
    } catch (e) {
      return { status: 'rejected', reason: 'invalid', detail: e instanceof Error ? e.message : undefined };
    }
    return this.repo.transaction(async (tx) => {
      const session = await tx.getSession(sessionId);
      if (!session) return { status: 'rejected', reason: 'unknown-session' };
      if (session.status !== 'in-progress') return { status: 'rejected', reason: 'not-in-progress' };
      if (!session.exercises.some((e) => e.exerciseId === set.exerciseId)) {
        return { status: 'rejected', reason: 'exercise-not-in-session' };
      }
      const existing = await tx.listSets(sessionId);
      const now = this.clock.now().toISOString();
      const row: SetLog = {
        id: newId(),
        sessionId,
        exerciseId: set.exerciseId,
        kind: set.kind,
        position: existing.reduce((m, x) => Math.max(m, x.position), 0) + 1,
        reps: set.reps,
        load: set.load,
        unit: set.unit,
        loadConvention: exerciseById(set.exerciseId)?.loadConvention ?? 'total',
        rir: set.rir,
        loggedAt: now,
        updatedAt: now,
      };
      await tx.insertSet(row);
      return { status: 'ok', value: row };
    });
  }

  /** Edits a logged set (also after finishing). History changes; rewards never do. */
  async updateSet(setId: string, input: Omit<SetInput, 'exerciseId'>): Promise<TrainingResult<SetLog>> {
    return this.repo.transaction(async (tx) => {
      const current = await tx.getSet(setId);
      if (!current) return { status: 'rejected', reason: 'unknown-session' };
      let set: SetInput;
      try {
        set = validateSet({ ...input, exerciseId: current.exerciseId });
      } catch (e) {
        return { status: 'rejected', reason: 'invalid', detail: e instanceof Error ? e.message : undefined };
      }
      const next: SetLog = { ...current, kind: set.kind, reps: set.reps, load: set.load, unit: set.unit, rir: set.rir,
        updatedAt: this.clock.now().toISOString() };
      await tx.updateSet(next);
      return { status: 'ok', value: next };
    });
  }

  async deleteSet(setId: string): Promise<TrainingResult<null>> {
    return this.repo.transaction(async (tx) => {
      const current = await tx.getSet(setId);
      if (!current) return { status: 'rejected', reason: 'unknown-session' };
      const session = await tx.getSession(current.sessionId);
      if (session?.status !== 'in-progress') return { status: 'rejected', reason: 'not-in-progress' };
      await tx.deleteSet(setId);
      return { status: 'ok', value: null };
    });
  }

  /**
   * Finishes the workout and, in the same transaction, completes the daily
   * core of the day it was started on (once). Extra sets add no XP; a closed
   * day, a frozen clock or reported illness keep the log but grant nothing.
   */
  async finishWorkout(sessionId: string): Promise<TrainingResult<FinishResult>> {
    return this.repo.transaction(async (tx) => {
      const profile = await tx.getProfile();
      if (!profile) return { status: 'rejected', reason: 'no-profile' };
      const session = await tx.getSession(sessionId);
      if (!session) return { status: 'rejected', reason: 'unknown-session' };
      if (session.status === 'finished') {
        // Retry: claim the core now if an earlier attempt was refused for a temporary
        // reason (clock anomaly, illness later corrected). Idempotent via completeCoreInTx.
        return { status: 'ok', value: { session, reward: await this.rewardForSession(tx, profile, session) } };
      }
      if (session.status !== 'in-progress') return { status: 'rejected', reason: 'not-in-progress' };
      if (summarizeSets(await tx.listSets(sessionId)).workSets === 0) return { status: 'rejected', reason: 'no-work-sets' };
      const finished: WorkoutSession = {
        ...session,
        status: 'finished',
        finishedAt: this.clock.now().toISOString(),
        version: session.version + 1,
      };
      await tx.updateSession(finished);
      return { status: 'ok', value: { session: finished, reward: await this.rewardForSession(tx, profile, finished) } };
    });
  }

  /** Stops without completing; logged sets stay in history, no reward, no debt. */
  async abandonWorkout(sessionId: string): Promise<TrainingResult<WorkoutSession>> {
    return this.repo.transaction(async (tx) => {
      const session = await tx.getSession(sessionId);
      if (!session) return { status: 'rejected', reason: 'unknown-session' };
      if (session.status !== 'in-progress') return { status: 'rejected', reason: 'not-in-progress' };
      const next: WorkoutSession = { ...session, status: 'abandoned', finishedAt: this.clock.now().toISOString(),
        version: session.version + 1 };
      await tx.updateSession(next);
      return { status: 'ok', value: next };
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
      await tx.insertSlot({ ...t, taskDayId: day.id, status: 'open', resolution: null, completedAt: null, version: 1,
        workoutSessionId: null });
    }
    return { day, clockAnomaly: false };
  }

  private async currentDay(
    tx: StoreTx,
    taskDayId: string,
  ): Promise<{ profile: Profile; day: TaskDay } | { reason: Extract<RejectReason, 'no-profile' | 'day-changed' | 'clock-frozen'> }> {
    const profile = await tx.getProfile();
    if (!profile) return { reason: 'no-profile' };
    const { day, clockAnomaly } = await this.ensureToday(tx, profile);
    if (clockAnomaly) return { reason: 'clock-frozen' };
    if (day.id !== taskDayId) return { reason: 'day-changed' };
    return { profile, day };
  }

  /**
   * Single entry point for the daily core. Order matters: an already completed
   * core returns its existing reward first (never revoked, never doubled), and
   * only a NEW training completion is refused while illness is reported.
   */
  private async completeCoreInTx(
    tx: StoreTx,
    profile: Profile,
    day: TaskDay,
    resolution: CoreResolution,
    workoutSessionId: string | null,
  ): Promise<CompletionResult> {
    const slot = await tx.getSlot(day.id, SLOT_KEYS.core);
    if (!slot) return { status: 'rejected', reason: 'unknown-slot' };
    if (slot.status === 'completed') {
      return { status: 'already-completed', entry: await tx.findLedger(profile.id, 'day', day.id, SLOT_KEYS.core) };
    }
    if (resolution === 'training' && (await tx.getCheckin(day.id))?.illness === 'yes') {
      return { status: 'rejected', reason: 'illness' };
    }
    return this.completeSlot(tx, profile, day, SLOT_KEYS.core, resolution, workoutSessionId);
  }

  private async rewardForSession(tx: StoreTx, profile: Profile, session: WorkoutSession): Promise<CompletionResult> {
    const { day, clockAnomaly } = await this.ensureToday(tx, profile);
    if (day.id !== session.taskDayId) {
      const origin = await tx.getSlot(session.taskDayId, SLOT_KEYS.core);
      if (origin?.status === 'completed') {
        return { status: 'already-completed', entry: await tx.findLedger(profile.id, 'day', session.taskDayId, SLOT_KEYS.core) };
      }
      return { status: 'rejected', reason: 'day-changed' };
    }
    if (clockAnomaly) return { status: 'rejected', reason: 'clock-frozen' };
    return this.completeCoreInTx(tx, profile, day, 'training', session.id);
  }

  private async weekView(tx: StoreTx, plan: PlanVersion, day: TaskDay) {
    const weekStart = weekStartOf(day.localDate);
    const moves = await tx.listMoves(weekStart);
    const sessions = await tx.listSessionsForWeek(weekStart);
    return { weekStart, week: buildWeek(plan.program, weekStart, moves, sessions, day.localDate) };
  }

  private async activeWorkout(tx: StoreTx, session: WorkoutSession): Promise<ActiveWorkout> {
    const sets = await tx.listSets(session.id);
    return { session, sets, summary: summarizeSets(sets) };
  }

  private async todayTraining(tx: StoreTx, today: TaskDay | null): Promise<TodaySnapshot['training']> {
    const plan = await tx.getLatestPlan();
    const activeSession = await tx.getActiveSession();
    if (!plan || !today) return { hasProgram: !!plan, planned: null, activeSession };
    const { week } = await this.weekView(tx, plan, today);
    const planned = week.find((w) => w.date === today.localDate && w.state !== 'missed') ?? null;
    return { hasProgram: true, planned, activeSession };
  }

  private async completeSlot(
    tx: StoreTx,
    profile: Profile,
    day: TaskDay,
    slotKey: string,
    resolution: CoreResolution | null,
    workoutSessionId: string | null = null,
  ): Promise<CompletionResult> {
    const slot = await tx.getSlot(day.id, slotKey);
    if (!slot) return { status: 'rejected', reason: 'unknown-slot' };
    if (slot.status === 'completed') {
      return { status: 'already-completed', entry: await tx.findLedger(profile.id, 'day', day.id, slotKey) };
    }
    const completedAt = this.clock.now().toISOString();
    await tx.updateSlot({ ...slot, status: 'completed', resolution, completedAt, version: slot.version + 1, workoutSessionId });
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
