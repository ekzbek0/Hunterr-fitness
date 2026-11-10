/**
 * Application service: the only place that combines persistence with domain
 * rules. Every mutation runs in one repository transaction, so completion,
 * slot state and the XP ledger commit together or not at all.
 */
import { newId } from '@/data/ids';
import type {
  AppSettings,
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
  EquipmentIncrement,
  ProgressionProposal,
  WeeklyCycle,
  WeeklyReview,
  WeeklySummary,
  WorkoutSession,
} from '@/data/types';
import {
  awardedXp,
  XP,
  DEFAULT_MULTIPLIER_HALVES,
  isMultiplierHalves,
  levelProgress,
  type LevelProgress,
  type MultiplierHalves,
} from '@/domain/game/economy';
import { buildDaySlots, DEFAULT_HABIT_KEYS, SLOT_KEYS, validateHabitKeys, type CoreResolution } from '@/domain/game/quests';
import { decideTaskDay, isValidTimeZone } from '@/domain/game/task-day';
import { cycleWeekEnd, decideWeeklyCycle, WEEKLY_REVIEW_SLOT } from '@/domain/game/weekly-cycle';
import { exerciseById, INCREMENT_KEYS, type IncrementKey } from '@/domain/training/catalog';
import {
  evaluateProgression,
  isReadinessHold,
  validateIncrement,
  type ProgressionDecision,
  type SessionEvidence,
} from '@/domain/training/progression';
import { isClockRollback, validateRestDuration } from '@/domain/training/rest';
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
  findScheduleConflicts,
  validateMove,
  weekStartOf,
  type MoveError,
  type PlannedSession,
  type ScheduleConflict,
} from '@/domain/training/schedule';
import { summarizeSets, validateSet, type SessionSummary, type SetInput } from '@/domain/training/workout';

export interface Clock {
  now(): Date;
  timeZone(): string;
}

const XP_WEEKLY = XP.weeklyReview;

function targetsCarriedOver(current: Program | null, next: Program): boolean {
  const existing = (current?.days ?? []).flatMap((d) => d.exercises).filter((e) => e.targetLoad);
  return next.days.every((d) =>
    d.exercises.every(
      (e) =>
        !e.targetLoad ||
        existing.some(
          (x) => x.exerciseId === e.exerciseId && x.targetLoad!.value === e.targetLoad!.value && x.targetLoad!.unit === e.targetLoad!.unit,
        ),
    ),
  );
}
/** Stored proposal key = `${evidence}@${planVersionId}` plus an optional `#n` re-proposal suffix. */
const baseKey = (k: string) => k.split('#')[0];
/** Evidence part only (no plan version): used to keep declined evidence from returning. */
const evidenceOf = (k: string) => k.split('@')[0];

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
  /** M3 local preferences (speech, reminders). */
  settings: AppSettings;
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
  | 'illness'
  /** The weekly cycle being reviewed is no longer the current one. */
  | 'week-changed';

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
  /** A plan edit would put two sessions on one day of the effective week (moves included). */
  | 'schedule-conflict'
  | 'unknown-proposal'
  | 'proposal-decided'
  /** The proposal's data or plan version changed; it was re-validated and withdrawn. */
  | 'proposal-stale'
  | 'technique-unconfirmed'
  /** Today's check-in is missing or blocks load increases; the proposal stays pending. */
  | 'readiness-blocked'
  | MoveError;

export type TrainingResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'rejected'; reason: TrainingRejectReason; detail?: string; conflicts?: ScheduleConflict[] };

export interface ProgramPreview {
  changes: ProgramChange[];
  /** Conflicts with this week's moved sessions; non-empty means the change cannot be accepted. */
  conflicts: ScheduleConflict[];
}

export interface WeeklyReviewSnapshot {
  cycle: WeeklyCycle;
  review: WeeklyReview | null;
  summary: WeeklySummary;
  /** XP the review grants (40 base x this cycle's captured multiplier). */
  rewardXp: number;
  rewardsFrozen: boolean;
  checkinToday: boolean;
  /** Today's readiness (missing/blocking check-in) prevents accepting any increase. */
  readinessBlocked: boolean;
  /** Non-actionable outcomes with reasons (hold / rebaseline), one per exercise. */
  decisions: ProgressionDecision[];
  /** Proposals of this cycle (pending, accepted, declined, stale), newest first. */
  proposals: ProgressionProposal[];
  increments: EquipmentIncrement[];
}

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
  weekly: { cycle: WeeklyCycle; reviewDone: boolean; pendingProposals: number } | null;
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

  /** M3: read-aloud on/off (a local preference; never affects training or XP). */
  async setSpeechEnabled(enabled: boolean): Promise<AppSettings> {
    return this.repo.transaction(async (tx) => {
      const next = { ...(await tx.getSettings()), speechEnabled: enabled };
      await tx.putSettings(next);
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
        settings: await tx.getSettings(),
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
      const storedActive = await tx.getActiveSession();
      // Every open of the workout checkpoints the rest timer against the clock policy.
      const activeSession = storedActive ? await this.checkpointRestInTx(tx, storedActive) : null;
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
        weekly: ensured
          ? {
              cycle: ensured.cycle,
              reviewDone: (await tx.getWeeklyReview(ensured.cycle.id)) !== null,
              pendingProposals: (await tx.listProposals(200)).filter(
                (p) => p.status === 'pending' && p.weeklyCycleId === ensured.cycle.id,
              ).length,
            }
          : null,
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
    TrainingResult<{
      program: Program;
      changes: ProgramChange[];
      baseVersionId: string | null;
      skippedPatterns: string[];
      conflicts: ScheduleConflict[];
    }>
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
          conflicts: await this.conflictsFor(tx, program),
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
      // Load targets are written only by an accepted progression proposal. A manual
      // edit or regeneration may keep an existing target of the same exercise or
      // clear it, never create or move one (e.g. onto a swapped exercise).
      if (!targetsCarriedOver(current?.program ?? null, program)) {
        return { status: 'rejected', reason: 'invalid', detail: 'target-load' };
      }
      const changes = current ? diffPrograms(current.program, program) : [];
      if (current && changes.length === 0) return { status: 'ok', value: { plan: current, changes } };
      // Validate the effective week (program + existing moves) in the same transaction.
      // A conflict is refused as a whole: nothing is written, no session is moved or dropped.
      const conflicts = await this.conflictsFor(tx, program);
      if (conflicts.length > 0) return { status: 'rejected', reason: 'schedule-conflict', conflicts };
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
        proposalId: null,
      };
      await tx.insertPlan(plan);
      return { status: 'ok', value: { plan, changes } };
    });
  }

  /**
   * Read-only preview of an edited program: the structural diff (including
   * exercise order) and conflicts with this week's moved sessions.
   */
  async previewProgram(program: Program): Promise<TrainingResult<ProgramPreview>> {
    return this.repo.transaction(async (tx) => {
      const tp = await tx.getTrainingProfile();
      if (!tp) return { status: 'rejected', reason: 'no-training-profile' };
      let valid: Program;
      try {
        valid = validateProgram(program, tp);
      } catch (e) {
        return { status: 'rejected', reason: 'invalid', detail: e instanceof ProgramError ? e.code : undefined };
      }
      const current = await tx.getLatestPlan();
      return {
        status: 'ok',
        value: { changes: current ? diffPrograms(current.program, valid) : [], conflicts: await this.conflictsFor(tx, valid) },
      };
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
        restStartedAt: null,
        restDurationS: null,
        restLastSeenAt: null,
        restUncertain: false,
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
      // Band resistance is not kilograms: no load is stored for band exercises.
      if (exerciseById(set.exerciseId)?.loadConvention === 'band' && set.load !== 0) {
        return { status: 'rejected', reason: 'invalid', detail: 'band-load' };
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
      if (exerciseById(set.exerciseId)?.loadConvention === 'band' && set.load !== 0) {
        return { status: 'rejected', reason: 'invalid', detail: 'band-load' };
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
      await tx.setRestTimer(finished.id, null);
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
      await tx.setRestTimer(next.id, null);
      return { status: 'ok', value: next };
    });
  }

  // ---- M2: rest timer ----

  /** Stores only the start timestamp and duration; remaining time is derived from the clock. */
  async startRest(sessionId: string, durationS: number): Promise<TrainingResult<WorkoutSession>> {
    try {
      validateRestDuration(durationS);
    } catch {
      return { status: 'rejected', reason: 'invalid' };
    }
    return this.repo.transaction(async (tx) => {
      const session = await tx.getSession(sessionId);
      if (!session) return { status: 'rejected', reason: 'unknown-session' };
      if (session.status !== 'in-progress') return { status: 'rejected', reason: 'not-in-progress' };
      const startedAt = this.clock.now().toISOString();
      await tx.setRestTimer(sessionId, { startedAt, durationS, lastSeenAt: startedAt, uncertain: false });
      return {
        status: 'ok',
        value: { ...session, restStartedAt: startedAt, restDurationS: durationS, restLastSeenAt: startedAt, restUncertain: false },
      };
    });
  }

  async clearRest(sessionId: string): Promise<TrainingResult<null>> {
    return this.repo.transaction(async (tx) => {
      if (!(await tx.getSession(sessionId))) return { status: 'rejected', reason: 'unknown-session' };
      await tx.setRestTimer(sessionId, null);
      return { status: 'ok', value: null };
    });
  }

  /**
   * Records the clock reading for a running rest timer (high-water mark), or marks it
   * uncertain when the clock moved backwards (here or as seen by the UI). Never extends it.
   */
  async checkpointRest(sessionId: string, observedRollback = false): Promise<TrainingResult<WorkoutSession>> {
    return this.repo.transaction(async (tx) => {
      const session = await tx.getSession(sessionId);
      if (!session) return { status: 'rejected', reason: 'unknown-session' };
      return { status: 'ok', value: await this.checkpointRestInTx(tx, session, observedRollback) };
    });
  }

  private async checkpointRestInTx(tx: StoreTx, session: WorkoutSession, observedRollback = false): Promise<WorkoutSession> {
    if (session.status !== 'in-progress' || !session.restStartedAt || session.restDurationS === null || session.restUncertain) {
      return session;
    }
    const timer = {
      startedAt: session.restStartedAt,
      durationS: session.restDurationS,
      lastSeenAt: session.restLastSeenAt,
      uncertain: false,
    };
    const now = this.clock.now();
    if (observedRollback || isClockRollback(timer, now.getTime())) {
      await tx.setRestTimer(session.id, { ...timer, uncertain: true });
      return { ...session, restUncertain: true };
    }
    const nowIso = now.toISOString();
    if (!timer.lastSeenAt || nowIso > timer.lastSeenAt) {
      await tx.setRestTimer(session.id, { ...timer, lastSeenAt: nowIso });
      return { ...session, restLastSeenAt: nowIso };
    }
    return session;
  }

  // ---- M2: weekly review, progression proposals, equipment increments ----

  /**
   * Opens this week's review: summary plus deterministic progression
   * evaluation. Actionable increases are stored as pending proposals (once per
   * evidence); pending proposals whose basis changed are re-validated and
   * marked stale. Nothing here changes the plan.
   */
  async loadWeeklyReview(): Promise<TrainingResult<WeeklyReviewSnapshot>> {
    return this.repo.transaction(async (tx) => {
      const profile = await tx.getProfile();
      if (!profile) return { status: 'rejected', reason: 'no-profile' };
      const { day, clockAnomaly, cycle } = await this.ensureToday(tx, profile);
      const plan = await tx.getLatestPlan();
      const decisions = plan ? await this.evaluateAll(tx, plan, day) : [];
      const now = this.clock.now().toISOString();
      const increases = new Map<string, string>();
      for (const d of decisions) if (d.kind === 'increase') increases.set(d.exerciseId, `${d.evidenceKey}@${plan!.id}`);
      const existing = await tx.listProposals(500);
      for (const p of existing) {
        if (p.status !== 'pending') continue;
        const d = decisions.find((x) => x.exerciseId === p.exerciseId);
        // Only today's readiness blocks: the evidence is unchanged, keep it pending (acceptance
        // re-validates anyway). A new week, other evidence or another plan version withdraws it.
        const readinessOnly = d !== undefined && isReadinessHold(d);
        if (p.weeklyCycleId !== cycle.id || (!readinessOnly && increases.get(p.exerciseId) !== baseKey(p.evidenceKey))) {
          await tx.updateProposal({ ...p, status: 'stale', decidedAt: now });
          p.status = 'stale';
        }
      }
      for (const d of decisions) {
        if (d.kind !== 'increase') continue;
        const key = `${d.evidenceKey}@${plan!.id}`;
        // A declined or accepted decision on this evidence is final in every week and plan
        // version: the same sessions are never proposed again. A pending one is not duplicated.
        if (existing.some((p) => p.exerciseId === d.exerciseId && evidenceOf(p.evidenceKey) === d.evidenceKey &&
          (p.status === 'declined' || p.status === 'accepted'))) continue;
        const same = existing.filter((p) => p.weeklyCycleId === cycle.id && p.exerciseId === d.exerciseId && baseKey(p.evidenceKey) === key);
        if (same.some((p) => p.status === 'pending')) continue;
        await tx.insertProposal({
          id: newId(),
          weeklyCycleId: cycle.id,
          exerciseId: d.exerciseId,
          planVersionId: plan!.id,
          evidenceKey: same.length === 0 ? key : `${key}#${same.length}`,
          evidenceSessionIds: [...d.evidenceSessionIds],
          before: d.before,
          after: d.after,
          increment: d.increment,
          percentHundredths: d.percentHundredths,
          status: 'pending',
          createdAt: now,
          decidedAt: null,
          resultPlanVersionId: null,
        });
      }
      return {
        status: 'ok',
        value: {
          cycle,
          review: await tx.getWeeklyReview(cycle.id),
          summary: await this.weeklySummary(tx, plan, day, cycle),
          rewardXp: awardedXp(XP_WEEKLY, cycle.multiplierHalves),
          rewardsFrozen: clockAnomaly,
          checkinToday: (await tx.getCheckin(day.id)) !== null,
          readinessBlocked: decisions.some(isReadinessHold),
          decisions: decisions.filter((d) => d.kind !== 'increase'),
          proposals: (await tx.listProposals(500)).filter((p) => p.weeklyCycleId === cycle.id),
          increments: await tx.listIncrements(),
        },
      };
    });
  }

  /**
   * Completes the current cycle's review and grants 40 base XP x the cycle's
   * captured multiplier in the same transaction, once per persisted cycle.
   */
  async completeWeeklyReview(weeklyCycleId: string): Promise<CompletionResult> {
    return this.repo.transaction(async (tx) => {
      const profile = await tx.getProfile();
      if (!profile) return { status: 'rejected', reason: 'no-profile' };
      const { day, clockAnomaly, cycle } = await this.ensureToday(tx, profile);
      const existing = () => tx.findLedger(profile.id, 'week', weeklyCycleId, WEEKLY_REVIEW_SLOT);
      if (await tx.getWeeklyReview(weeklyCycleId)) return { status: 'already-completed', entry: await existing() };
      if (cycle.id !== weeklyCycleId) return { status: 'rejected', reason: 'week-changed' };
      if (clockAnomaly) return { status: 'rejected', reason: 'clock-frozen' };
      const completedAt = this.clock.now().toISOString();
      const plan = await tx.getLatestPlan();
      const proposalIds = (await tx.listProposals(500)).filter((p) => p.weeklyCycleId === cycle.id).map((p) => p.id);
      const summary = await this.weeklySummary(tx, plan, day, cycle);
      if ((await tx.insertWeeklyReview({ weeklyCycleId, completedAt, summary, proposalIds })) === 'conflict') {
        return { status: 'already-completed', entry: await existing() };
      }
      const entry: LedgerEntry = {
        id: newId(),
        profileId: profile.id,
        scopeKind: 'week',
        scopeId: cycle.id,
        slotKey: WEEKLY_REVIEW_SLOT,
        baseXp: XP_WEEKLY,
        multiplierHalves: cycle.multiplierHalves,
        awardedXp: awardedXp(XP_WEEKLY, cycle.multiplierHalves),
        completedAt,
      };
      if ((await tx.insertLedger(entry)) === 'conflict') return { status: 'already-completed', entry: await existing() };
      return { status: 'awarded', entry };
    });
  }

  /**
   * Accepts a pending proposal after re-validating it against the CURRENT plan
   * version and data. A changed basis marks it stale instead of applying it.
   * The user must confirm the technique/range of motion was comparable.
   */
  async acceptProposal(
    proposalId: string,
    input: { techniqueConfirmed: boolean },
  ): Promise<TrainingResult<{ plan: PlanVersion; changes: ProgramChange[]; proposal: ProgressionProposal }>> {
    return this.repo.transaction(async (tx) => {
      const profile = await tx.getProfile();
      if (!profile) return { status: 'rejected', reason: 'no-profile' };
      const proposal = await tx.getProposal(proposalId);
      if (!proposal) return { status: 'rejected', reason: 'unknown-proposal' };
      if (proposal.status !== 'pending') return { status: 'rejected', reason: 'proposal-decided' };
      if (input.techniqueConfirmed !== true) return { status: 'rejected', reason: 'technique-unconfirmed' };
      const { day, cycle } = await this.ensureToday(tx, profile);
      const tp = await tx.getTrainingProfile();
      const plan = await tx.getLatestPlan();
      const now = this.clock.now().toISOString();
      const stale = async () => {
        await tx.updateProposal({ ...proposal, status: 'stale', decidedAt: now });
        return { status: 'rejected' as const, reason: 'proposal-stale' as const };
      };
      if (!tp || !plan || plan.id !== proposal.planVersionId || proposal.weeklyCycleId !== cycle.id) return stale();
      const fresh = (await this.evaluateAll(tx, plan, day, proposal.exerciseId))[0];
      // Today's readiness blocks acceptance but does not invalidate the evidence.
      if (fresh && isReadinessHold(fresh)) return { status: 'rejected', reason: 'readiness-blocked' };
      if (!fresh || fresh.kind !== 'increase' || `${fresh.evidenceKey}@${plan.id}` !== baseKey(proposal.evidenceKey)) return stale();
      const b = proposal.before;
      const program: Program = structuredClone(plan.program);
      for (const d of program.days) {
        for (const e of d.exercises) {
          if (e.exerciseId === proposal.exerciseId && e.sets === b.sets && e.repMin === b.repMin && e.repMax === b.repMax) {
            e.targetLoad = { value: proposal.after.load, unit: proposal.after.unit };
          }
        }
      }
      let valid: Program;
      try {
        valid = validateProgram(program, tp);
      } catch {
        return stale();
      }
      const changes = diffPrograms(plan.program, valid);
      if (changes.length === 0) return stale();
      const next: PlanVersion = {
        id: newId(),
        parentId: plan.id,
        sequence: plan.sequence + 1,
        source: 'user-edit',
        reason: JSON.stringify(changes),
        createdAt: now,
        acceptedAt: now,
        program: valid,
        proposalId: proposal.id,
      };
      await tx.insertPlan(next);
      const accepted: ProgressionProposal = { ...proposal, status: 'accepted', decidedAt: now, resultPlanVersionId: next.id };
      await tx.updateProposal(accepted);
      return { status: 'ok', value: { plan: next, changes, proposal: accepted } };
    });
  }

  /** Records a decline; the plan is unchanged and the same evidence is not proposed again. */
  async declineProposal(proposalId: string): Promise<TrainingResult<ProgressionProposal>> {
    return this.repo.transaction(async (tx) => {
      const proposal = await tx.getProposal(proposalId);
      if (!proposal) return { status: 'rejected', reason: 'unknown-proposal' };
      if (proposal.status !== 'pending') return { status: 'rejected', reason: 'proposal-decided' };
      const declined: ProgressionProposal = { ...proposal, status: 'declined', decidedAt: this.clock.now().toISOString() };
      await tx.updateProposal(declined);
      return { status: 'ok', value: declined };
    });
  }

  /** The user confirms the smallest load step available to them for one kind of equipment. */
  async confirmIncrement(key: IncrementKey, unit: 'kg' | 'lb', value: number): Promise<TrainingResult<EquipmentIncrement>> {
    let v: number;
    try {
      if (!(INCREMENT_KEYS as readonly string[]).includes(key) || (unit !== 'kg' && unit !== 'lb')) throw new RangeError('key');
      v = validateIncrement(value);
    } catch {
      return { status: 'rejected', reason: 'invalid' };
    }
    return this.repo.transaction(async (tx) => {
      const inc: EquipmentIncrement = { key, unit, value: v, confirmedAt: this.clock.now().toISOString() };
      await tx.putIncrement(inc);
      return { status: 'ok', value: inc };
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

  private async ensureToday(
    tx: StoreTx,
    profile: Profile,
  ): Promise<{ day: TaskDay; clockAnomaly: boolean; cycle: WeeklyCycle }> {
    const r = await this.ensureDay(tx, profile);
    return { ...r, cycle: await this.ensureCycle(tx, r.day) };
  }

  /** Opens this week's cycle once (multiplier captured from the task day); never reopens a closed one. */
  private async ensureCycle(tx: StoreTx, day: TaskDay): Promise<WeeklyCycle> {
    const latest = await tx.getLatestWeeklyCycle();
    const decision = decideWeeklyCycle(latest, day.localDate);
    if (latest && decision.action !== 'open') return latest;
    if (decision.action !== 'open') throw new Error('no weekly cycle');
    const now = this.clock.now().toISOString();
    if (latest && decision.closeLatest) await tx.closeWeeklyCycle(latest.id, now);
    const cycle: WeeklyCycle = {
      id: newId(),
      sequence: (latest?.sequence ?? 0) + 1,
      weekStart: decision.weekStart,
      weekEnd: cycleWeekEnd(decision.weekStart),
      timezone: day.timezone,
      openedAt: now,
      closedAt: null,
      multiplierHalves: day.multiplierHalves as MultiplierHalves,
    };
    await tx.insertWeeklyCycle(cycle);
    return cycle;
  }

  private async ensureDay(tx: StoreTx, profile: Profile): Promise<{ day: TaskDay; clockAnomaly: boolean }> {
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

  /** Conflicts of `program` with this week's moves, for the current task day. */
  private async conflictsFor(tx: StoreTx, program: Program): Promise<ScheduleConflict[]> {
    const profile = await tx.getProfile();
    if (!profile) return [];
    const { day } = await this.ensureDay(tx, profile);
    const weekStart = weekStartOf(day.localDate);
    const moves = await tx.listMoves(weekStart);
    const sessions = await tx.listSessionsForWeek(weekStart);
    const next = buildWeek(program, weekStart, moves, sessions, day.localDate);
    const plan = await tx.getLatestPlan();
    const current = plan ? buildWeek(plan.program, weekStart, moves, sessions, day.localDate) : [];
    return findScheduleConflicts(next, day.localDate, current);
  }

  /** Deterministic progression decision per exercise of the current plan (or one exercise). */
  private async evaluateAll(tx: StoreTx, plan: PlanVersion, today: TaskDay, onlyExerciseId?: string): Promise<ProgressionDecision[]> {
    const checkin = await tx.getCheckin(today.id);
    const increments = (await tx.listIncrements()).map((i) => ({ key: i.key, unit: i.unit, value: i.value }));
    const finished = (await tx.listRecentSessions(300)).filter((x) => x.status === 'finished');
    const info = new Map<string, { date: string; sets: SetLog[]; safety: SessionEvidence['safety'] }>();
    for (const x of finished) {
      const d = await tx.getTaskDay(x.taskDayId);
      const c = await tx.getCheckin(x.taskDayId);
      info.set(x.id, {
        date: d?.localDate ?? x.startedAt.slice(0, 10),
        sets: await tx.listSets(x.id),
        safety: c ? { jointPain: c.jointPain, illness: c.illness } : null,
      });
    }
    const ordered = [...finished].sort(
      (a, b) => info.get(b.id)!.date.localeCompare(info.get(a.id)!.date) || b.startedAt.localeCompare(a.startedAt),
    );
    const seen = new Set<string>();
    const out: ProgressionDecision[] = [];
    for (const day of plan.program.days) {
      for (const current of day.exercises) {
        if (seen.has(current.exerciseId)) continue;
        seen.add(current.exerciseId);
        if (onlyExerciseId && current.exerciseId !== onlyExerciseId) continue;
        const history: SessionEvidence[] = ordered
          .map((x) => {
            const i = info.get(x.id)!;
            const p = x.exercises.find((e) => e.exerciseId === current.exerciseId);
            return {
              sessionId: x.id,
              date: i.date,
              prescription: p ? { sets: p.sets, repMin: p.repMin, repMax: p.repMax } : null,
              sets: i.sets
                .filter((st) => st.exerciseId === current.exerciseId)
                .map((st) => ({ kind: st.kind, reps: st.reps, load: st.load, unit: st.unit, loadConvention: st.loadConvention, rir: st.rir })),
              safety: i.safety,
            };
          })
          .filter((h) => h.sets.some((st) => st.kind === 'work'));
        out.push(
          evaluateProgression({
            exerciseId: current.exerciseId,
            current,
            history,
            today: today.localDate,
            todayCheckin: checkin,
            increments,
          }),
        );
      }
    }
    return out;
  }

  private async weeklySummary(tx: StoreTx, plan: PlanVersion | null, day: TaskDay, cycle: WeeklyCycle): Promise<WeeklySummary> {
    const week = plan ? (await this.weekView(tx, plan, day)).week : [];
    let workSets = 0;
    for (const x of await tx.listSessionsForWeek(cycle.weekStart)) {
      if (x.status === 'finished') workSets += summarizeSets(await tx.listSets(x.id)).workSets;
    }
    let checkins = 0;
    let recoveryDays = 0;
    for (const d of await tx.listTaskDays(14)) {
      if (d.localDate < cycle.weekStart || d.localDate > cycle.weekEnd) continue;
      if (await tx.getCheckin(d.id)) checkins += 1;
      const core = await tx.getSlot(d.id, SLOT_KEYS.core);
      if (core?.status === 'completed' && core.resolution !== 'training') recoveryDays += 1;
    }
    return {
      planned: week.length,
      done: week.filter((w) => w.state === 'done').length,
      missed: week.filter((w) => w.state === 'missed').length,
      workSets,
      checkins,
      recoveryDays,
    };
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
