import type { MultiplierHalves } from '@/domain/game/economy';
import type { CoreResolution, SlotKind } from '@/domain/game/quests';
import type { LoadConvention } from '@/domain/training/catalog';
import type { PrescribedExercise, Program } from '@/domain/training/program';
import type { TrainingProfileFacts } from '@/domain/training/profile';
import type { TriState } from '@/domain/training/readiness';
import type { ScheduleMove } from '@/domain/training/schedule';
import type { LoadUnit, SetKind } from '@/domain/training/workout';

export type { ScheduleMove };

export interface Profile {
  id: string;
  timezone: string;
  /** Setting for future task days; each day snapshots its own value. */
  multiplierHalves: MultiplierHalves;
  habitKeys: [string, string];
  createdAt: string;
  confirmedAt: string;
}

export interface TaskDay {
  id: string;
  sequence: number;
  localDate: string;
  timezone: string;
  openedAt: string;
  closedAt: string | null;
  multiplierHalves: MultiplierHalves;
  lastSeenAt: string;
}

export interface QuestSlot {
  taskDayId: string;
  slotKey: string;
  kind: SlotKind;
  title: string;
  baseXp: number;
  status: 'open' | 'completed';
  resolution: CoreResolution | null;
  completedAt: string | null;
  version: number;
  /** Daily core only: the workout that completed it (null for recovery/self-report). */
  workoutSessionId: string | null;
}

export interface DailyCheckin {
  taskDayId: string;
  sleepHours: number | null;
  energy: number;
  fatigue: number;
  soreness: number;
  jointPain: TriState;
  illness: TriState;
  recordedAt: string;
}

export type ScopeKind = 'day' | 'week';

export interface LedgerEntry {
  id: string;
  profileId: string;
  scopeKind: ScopeKind;
  scopeId: string;
  slotKey: string;
  baseXp: number;
  multiplierHalves: MultiplierHalves;
  awardedXp: number;
  completedAt: string;
}

export interface TrainingProfile extends TrainingProfileFacts {
  profileId: string;
  /** Facts are only stored after the user confirms them. */
  confirmedAt: string;
}

/** Immutable once written; edits create a child version (audit trail). */
export interface PlanVersion {
  id: string;
  parentId: string | null;
  sequence: number;
  source: 'generated' | 'user-edit';
  /** Machine-readable change summary (JSON of ProgramChange[] or a generation note). */
  reason: string;
  createdAt: string;
  acceptedAt: string;
  program: Program;
}

export type WorkoutStatus = 'in-progress' | 'finished' | 'abandoned';

export interface WorkoutSession {
  id: string;
  /** Task day on which the session was started; its daily core is the only reward it can complete. */
  taskDayId: string;
  scheduleSlotId: string | null;
  planVersionId: string;
  programDayId: string;
  title: string;
  /** Prescription snapshot at start; later plan edits do not rewrite it. */
  exercises: PrescribedExercise[];
  startedAt: string;
  finishedAt: string | null;
  status: WorkoutStatus;
  version: number;
}

export interface SetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  kind: SetKind;
  /** Order of entry within the session. */
  position: number;
  reps: number;
  load: number;
  unit: LoadUnit;
  loadConvention: LoadConvention;
  rir: number | null;
  loggedAt: string;
  updatedAt: string;
}

/** Primitive operations available inside one atomic transaction. */
export interface StoreTx {
  getProfile(): Promise<Profile | null>;
  putProfile(profile: Profile): Promise<void>;

  getLatestTaskDay(): Promise<TaskDay | null>;
  getTaskDay(id: string): Promise<TaskDay | null>;
  insertTaskDay(day: TaskDay): Promise<void>;
  updateTaskDay(day: TaskDay): Promise<void>;
  listTaskDays(limit: number): Promise<TaskDay[]>;

  listSlots(taskDayId: string): Promise<QuestSlot[]>;
  getSlot(taskDayId: string, slotKey: string): Promise<QuestSlot | null>;
  insertSlot(slot: QuestSlot): Promise<void>;
  updateSlot(slot: QuestSlot): Promise<void>;

  getCheckin(taskDayId: string): Promise<DailyCheckin | null>;
  putCheckin(checkin: DailyCheckin): Promise<void>;

  getTrainingProfile(): Promise<TrainingProfile | null>;
  putTrainingProfile(tp: TrainingProfile): Promise<void>;

  getLatestPlan(): Promise<PlanVersion | null>;
  getPlan(id: string): Promise<PlanVersion | null>;
  insertPlan(plan: PlanVersion): Promise<void>;
  listPlans(limit: number): Promise<PlanVersion[]>;

  listMoves(weekStart: string): Promise<ScheduleMove[]>;
  putMove(move: ScheduleMove): Promise<void>;

  getActiveSession(): Promise<WorkoutSession | null>;
  getSession(id: string): Promise<WorkoutSession | null>;
  insertSession(s: WorkoutSession): Promise<void>;
  updateSession(s: WorkoutSession): Promise<void>;
  /** Sessions whose schedule slot belongs to the given week. */
  listSessionsForWeek(weekStart: string): Promise<WorkoutSession[]>;
  listRecentSessions(limit: number): Promise<WorkoutSession[]>;

  listSets(sessionId: string): Promise<SetLog[]>;
  getSet(id: string): Promise<SetLog | null>;
  insertSet(set: SetLog): Promise<void>;
  updateSet(set: SetLog): Promise<void>;
  deleteSet(id: string): Promise<void>;
  /** Most recent sets of an exercise from finished sessions, newest first. */
  listFinishedSetsForExercise(exerciseId: string, limit: number): Promise<SetLog[]>;

  /** Inserts unless the logical reward key exists. Never overwrites. */
  insertLedger(entry: LedgerEntry): Promise<'inserted' | 'conflict'>;
  findLedger(profileId: string, scopeKind: ScopeKind, scopeId: string, slotKey: string): Promise<LedgerEntry | null>;
  listLedger(limit: number): Promise<LedgerEntry[]>;
  totalXp(profileId: string): Promise<number>;
}

export interface AvciRepository {
  /** Human-readable storage kind, shown in settings for transparency. */
  readonly kind: string;
  /** Runs `fn` atomically: either every write commits or none does. */
  transaction<T>(fn: (tx: StoreTx) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
