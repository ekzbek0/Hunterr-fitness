import type { MultiplierHalves } from '@/domain/game/economy';
import type { CoreResolution, SlotKind } from '@/domain/game/quests';
import type { TriState } from '@/domain/training/readiness';

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
