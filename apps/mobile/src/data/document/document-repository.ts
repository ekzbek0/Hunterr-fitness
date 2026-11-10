/**
 * Web persistence: the whole local database is one versioned JSON document
 * committed atomically with optimistic concurrency (revision check). A
 * transaction works on a private copy; on success the copy is written in a
 * single storage commit, so partial writes are impossible. Another tab that
 * committed meanwhile forces a retry against fresh data.
 */
import { DEFAULT_SETTINGS } from '../types';
import type {
  AppSettings,
  BackupData,
  Measurement,
  AvciRepository,
  DailyCheckin,
  EquipmentIncrement,
  LedgerEntry,
  ProgressionProposal,
  WeeklyCycle,
  WeeklyReview,
  PlanVersion,
  Profile,
  QuestSlot,
  ScheduleMove,
  SetLog,
  StoreTx,
  TaskDay,
  TrainingProfile,
  WorkoutSession,
} from '../types';

export const DOCUMENT_SCHEMA_VERSION = 4;

export interface AvciDocument {
  schemaVersion: number;
  profile: Profile | null;
  taskDays: TaskDay[];
  slots: QuestSlot[];
  checkins: DailyCheckin[];
  ledger: LedgerEntry[];
  // v2 (M1)
  trainingProfile: TrainingProfile | null;
  plans: PlanVersion[];
  moves: ScheduleMove[];
  sessions: WorkoutSession[];
  sets: SetLog[];
  // v3 (M2)
  weeklyCycles: WeeklyCycle[];
  weeklyReviews: WeeklyReview[];
  proposals: ProgressionProposal[];
  increments: EquipmentIncrement[];
  // v4 (M3)
  measurements: Measurement[];
  settings: AppSettings;
}

export interface StoredDocument {
  rev: number;
  doc: AvciDocument;
}

export interface DocumentStorage {
  load(): Promise<StoredDocument | null>;
  /** Writes `doc` as revision expectedRev+1 only if the stored revision is still expectedRev. */
  commit(expectedRev: number, doc: AvciDocument): Promise<boolean>;
  close(): Promise<void>;
}

export function emptyDocument(): AvciDocument {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    profile: null,
    taskDays: [],
    slots: [],
    checkins: [],
    ledger: [],
    trainingProfile: null,
    plans: [],
    moves: [],
    sessions: [],
    sets: [],
    weeklyCycles: [],
    weeklyReviews: [],
    proposals: [],
    increments: [],
    measurements: [],
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}

/** One version step at a time; every earlier record is carried over unchanged. */
export function migrateDocument(input: AvciDocument): AvciDocument {
  const doc = input as AvciDocument & Record<string, unknown>;
  if (!Number.isInteger(doc.schemaVersion) || doc.schemaVersion < 1) {
    throw new Error('Kayıtlı veri tanınmıyor (şema sürümü yok).');
  }
  if (doc.schemaVersion > DOCUMENT_SCHEMA_VERSION) {
    throw new Error(`Kayıtlı veri bu uygulama sürümünden yeni (şema ${doc.schemaVersion}).`);
  }
  if (doc.schemaVersion === 1) {
    // M0 -> M1: additive. Slots gain a nullable workout link.
    doc.slots = doc.slots.map((s) => ({ ...s, workoutSessionId: s.workoutSessionId ?? null }));
    doc.trainingProfile = null;
    doc.plans = [];
    doc.moves = [];
    doc.sessions = [];
    doc.sets = [];
    doc.schemaVersion = 2;
  }
  if (doc.schemaVersion === 2) {
    // M1 -> M2: additive. Existing plans/sessions gain nullable M2 fields.
    doc.plans = doc.plans.map((p) => ({ ...p, proposalId: p.proposalId ?? null }));
    doc.sessions = doc.sessions.map((x) => ({ ...x, restStartedAt: x.restStartedAt ?? null, restDurationS: x.restDurationS ?? null }));
    doc.weeklyCycles = [];
    doc.weeklyReviews = [];
    doc.proposals = [];
    doc.increments = [];
    doc.schemaVersion = 3;
  }
  if (doc.schemaVersion === 3) {
    // M2 -> M3: additive. Rest timers gain the clock-policy fields.
    doc.sessions = doc.sessions.map((x) => ({ ...x, restLastSeenAt: x.restLastSeenAt ?? null, restUncertain: x.restUncertain ?? false }));
    doc.measurements = [];
    doc.settings = structuredClone(DEFAULT_SETTINGS);
    doc.schemaVersion = 4;
  }
  return doc;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const ledgerKey = (e: Pick<LedgerEntry, 'profileId' | 'scopeKind' | 'scopeId' | 'slotKey'>) =>
  `${e.profileId}|${e.scopeKind}|${e.scopeId}|${e.slotKey}`;

function docTx(doc: AvciDocument): StoreTx {
  const byDayDesc = () => [...doc.taskDays].sort((a, b) => b.sequence - a.sequence);
  return {
    getProfile: async () => (doc.profile ? clone(doc.profile) : null),
    putProfile: async (p) => {
      doc.profile = clone(p);
    },
    getLatestTaskDay: async () => {
      const d = byDayDesc()[0];
      return d ? clone(d) : null;
    },
    getTaskDay: async (id) => {
      const d = doc.taskDays.find((x) => x.id === id);
      return d ? clone(d) : null;
    },
    insertTaskDay: async (t) => {
      if (doc.taskDays.some((x) => x.id === t.id || x.sequence === t.sequence || x.localDate === t.localDate)) {
        throw new Error('UNIQUE constraint failed: task_day');
      }
      doc.taskDays.push(clone(t));
    },
    updateTaskDay: async (t) => {
      const d = doc.taskDays.find((x) => x.id === t.id);
      if (d) {
        d.closedAt = t.closedAt;
        d.lastSeenAt = t.lastSeenAt;
      }
    },
    listTaskDays: async (limit) => clone(byDayDesc().slice(0, limit)),
    listSlots: async (dayId) => clone(doc.slots.filter((s) => s.taskDayId === dayId)),
    getSlot: async (dayId, key) => {
      const s = doc.slots.find((x) => x.taskDayId === dayId && x.slotKey === key);
      return s ? clone(s) : null;
    },
    insertSlot: async (s) => {
      if (doc.slots.some((x) => x.taskDayId === s.taskDayId && x.slotKey === s.slotKey)) {
        throw new Error('UNIQUE constraint failed: quest_slot');
      }
      doc.slots.push(clone(s));
    },
    updateSlot: async (s) => {
      const i = doc.slots.findIndex((x) => x.taskDayId === s.taskDayId && x.slotKey === s.slotKey);
      if (i >= 0) doc.slots[i] = clone(s);
    },
    getCheckin: async (dayId) => {
      const c = doc.checkins.find((x) => x.taskDayId === dayId);
      return c ? clone(c) : null;
    },
    putCheckin: async (c) => {
      doc.checkins = doc.checkins.filter((x) => x.taskDayId !== c.taskDayId).concat(clone(c));
    },
    getTrainingProfile: async () => (doc.trainingProfile ? clone(doc.trainingProfile) : null),
    putTrainingProfile: async (tp) => {
      doc.trainingProfile = clone(tp);
    },
    getLatestPlan: async () => {
      const p = [...doc.plans].sort((a, b) => b.sequence - a.sequence)[0];
      return p ? clone(p) : null;
    },
    getPlan: async (id) => {
      const p = doc.plans.find((x) => x.id === id);
      return p ? clone(p) : null;
    },
    insertPlan: async (p) => {
      if (doc.plans.some((x) => x.id === p.id || x.sequence === p.sequence)) throw new Error('UNIQUE constraint failed: plan_version');
      doc.plans.push(clone(p));
    },
    listPlans: async (limit) => clone([...doc.plans].sort((a, b) => b.sequence - a.sequence).slice(0, limit)),
    listMoves: async (weekStart) => clone(doc.moves.filter((m) => m.weekStart === weekStart)),
    putMove: async (m) => {
      doc.moves = doc.moves.filter((x) => x.slotId !== m.slotId).concat(clone(m));
    },
    getActiveSession: async () => {
      const s = doc.sessions.find((x) => x.status === 'in-progress');
      return s ? clone(s) : null;
    },
    getSession: async (id) => {
      const s = doc.sessions.find((x) => x.id === id);
      return s ? clone(s) : null;
    },
    insertSession: async (s) => {
      if (doc.sessions.some((x) => x.id === s.id)) throw new Error('UNIQUE constraint failed: workout_session.id');
      if (s.status === 'in-progress' && doc.sessions.some((x) => x.status === 'in-progress')) {
        throw new Error('UNIQUE constraint failed: workout_one_active');
      }
      doc.sessions.push(clone(s));
    },
    updateSession: async (s) => {
      const x = doc.sessions.find((y) => y.id === s.id);
      if (!x) return;
      if (
        s.status === 'finished' &&
        s.scheduleSlotId !== null &&
        doc.sessions.some((y) => y.id !== s.id && y.status === 'finished' && y.scheduleSlotId === x.scheduleSlotId)
      ) {
        throw new Error('UNIQUE constraint failed: workout_one_finished_per_slot');
      }
      x.finishedAt = s.finishedAt;
      x.status = s.status;
      x.version = s.version;
    },
    listSessionsForWeek: async (weekStart) =>
      clone(
        doc.sessions
          .filter((s) => s.scheduleSlotId?.startsWith(`${weekStart}:`))
          .sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
      ),
    setRestTimer: async (sessionId, rest) => {
      const x = doc.sessions.find((y) => y.id === sessionId);
      if (x) {
        Object.assign(x, {
          restStartedAt: rest?.startedAt ?? null,
          restDurationS: rest?.durationS ?? null,
          restLastSeenAt: rest?.lastSeenAt ?? null,
          restUncertain: rest?.uncertain ?? false,
        });
      }
    },
    listFinishedSessions: async (limit) =>
      clone(
        doc.sessions
          .map((s, i) => ({ s, i }))
          .filter((x) => x.s.status === 'finished')
          .sort((a, b) => b.s.startedAt.localeCompare(a.s.startedAt) || b.i - a.i)
          .slice(0, limit)
          .map((x) => x.s),
      ),
    listSetsForSessions: async (ids) => {
      const want = new Set(ids);
      return clone(doc.sets.filter((x) => want.has(x.sessionId)).sort((a, b) => a.sessionId.localeCompare(b.sessionId) || a.position - b.position));
    },
    listMeasurements: async () =>
      clone([...doc.measurements].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn) || b.recordedAt.localeCompare(a.recordedAt))),
    insertMeasurement: async (m) => {
      if (doc.measurements.some((x) => x.id === m.id)) throw new Error('UNIQUE constraint failed: measurement.id');
      doc.measurements.push(clone(m));
    },
    deleteMeasurement: async (id) => {
      // Hard delete: a deleted measurement must not stay on the device or reach a backup.
      doc.measurements = doc.measurements.filter((x) => x.id !== id);
    },
    getSettings: async () => clone({ ...DEFAULT_SETTINGS, ...doc.settings }),
    putSettings: async (v) => {
      doc.settings = clone(v);
    },
    dumpAll: async () => {
      const { schemaVersion: _v, ...rest } = clone(doc);
      return rest as BackupData;
    },
    replaceAll: async (data) => {
      const next = clone(data);
      Object.assign(doc, next, { schemaVersion: DOCUMENT_SCHEMA_VERSION });
    },
    getLatestWeeklyCycle: async () => {
      const c = [...doc.weeklyCycles].sort((a, b) => b.sequence - a.sequence)[0];
      return c ? clone(c) : null;
    },
    getWeeklyCycle: async (id) => {
      const c = doc.weeklyCycles.find((x) => x.id === id);
      return c ? clone(c) : null;
    },
    insertWeeklyCycle: async (c) => {
      if (doc.weeklyCycles.some((x) => x.id === c.id || x.sequence === c.sequence || x.weekStart === c.weekStart)) {
        throw new Error('UNIQUE constraint failed: weekly_cycle');
      }
      doc.weeklyCycles.push(clone(c));
    },
    closeWeeklyCycle: async (id, closedAt) => {
      const c = doc.weeklyCycles.find((x) => x.id === id);
      if (c && c.closedAt === null) c.closedAt = closedAt;
    },
    getWeeklyReview: async (id) => {
      const r = doc.weeklyReviews.find((x) => x.weeklyCycleId === id);
      return r ? clone(r) : null;
    },
    insertWeeklyReview: async (r) => {
      if (doc.weeklyReviews.some((x) => x.weeklyCycleId === r.weeklyCycleId)) return 'conflict';
      if (!doc.weeklyCycles.some((c) => c.id === r.weeklyCycleId)) throw new Error('FOREIGN KEY constraint failed: weekly_review');
      doc.weeklyReviews.push(clone(r));
      return 'inserted';
    },
    getProposal: async (id) => {
      const p = doc.proposals.find((x) => x.id === id);
      return p ? clone(p) : null;
    },
    listProposals: async (limit) =>
      clone(
        doc.proposals
          .map((p, i) => ({ p, i }))
          .sort((a, b) => b.p.createdAt.localeCompare(a.p.createdAt) || b.i - a.i)
          .slice(0, limit)
          .map((x) => x.p),
      ),
    insertProposal: async (p) => {
      if (doc.proposals.some((x) => x.weeklyCycleId === p.weeklyCycleId && x.exerciseId === p.exerciseId && x.evidenceKey === p.evidenceKey)) {
        return 'conflict';
      }
      if (doc.proposals.some((x) => x.id === p.id)) throw new Error('UNIQUE constraint failed: progression_proposal.id');
      doc.proposals.push(clone(p));
      return 'inserted';
    },
    updateProposal: async (p) => {
      const x = doc.proposals.find((y) => y.id === p.id);
      if (x) Object.assign(x, { status: p.status, decidedAt: p.decidedAt, resultPlanVersionId: p.resultPlanVersionId });
    },
    listIncrements: async () =>
      clone([...doc.increments].sort((a, b) => a.key.localeCompare(b.key) || a.unit.localeCompare(b.unit))),
    putIncrement: async (i) => {
      doc.increments = doc.increments.filter((x) => !(x.key === i.key && x.unit === i.unit)).concat(clone(i));
    },
    listRecentSessions: async (limit) =>
      clone(
        doc.sessions
          .map((s, i) => ({ s, i }))
          .sort((a, b) => b.s.startedAt.localeCompare(a.s.startedAt) || b.i - a.i)
          .slice(0, limit)
          .map((x) => x.s),
      ),
    listSets: async (sessionId) =>
      clone(doc.sets.filter((x) => x.sessionId === sessionId).sort((a, b) => a.position - b.position)),
    getSet: async (id) => {
      const x = doc.sets.find((y) => y.id === id);
      return x ? clone(x) : null;
    },
    insertSet: async (x) => {
      if (doc.sets.some((y) => y.id === x.id)) throw new Error('UNIQUE constraint failed: set_log.id');
      if (!doc.sessions.some((s) => s.id === x.sessionId)) throw new Error('FOREIGN KEY constraint failed: set_log');
      doc.sets.push(clone(x));
    },
    updateSet: async (x) => {
      const y = doc.sets.find((z) => z.id === x.id);
      if (y) Object.assign(y, { kind: x.kind, reps: x.reps, load: x.load, unit: x.unit, rir: x.rir, updatedAt: x.updatedAt });
    },
    deleteSet: async (id) => {
      doc.sets = doc.sets.filter((y) => y.id !== id);
    },
    listFinishedSetsForExercise: async (exerciseId, limit) => {
      const sessions = new Map(doc.sessions.filter((s) => s.status === 'finished').map((s) => [s.id, s]));
      return clone(
        doc.sets
          .filter((x) => x.exerciseId === exerciseId && sessions.has(x.sessionId))
          .sort(
            (a, b) =>
              sessions.get(b.sessionId)!.startedAt.localeCompare(sessions.get(a.sessionId)!.startedAt) ||
              a.position - b.position,
          )
          .slice(0, limit),
      );
    },
    insertLedger: async (e) => {
      const key = ledgerKey(e);
      if (doc.ledger.some((x) => ledgerKey(x) === key || x.id === e.id)) return 'conflict';
      doc.ledger.push(clone(e));
      return 'inserted';
    },
    findLedger: async (profileId, scopeKind, scopeId, slotKey) => {
      const key = ledgerKey({ profileId, scopeKind, scopeId, slotKey });
      const e = doc.ledger.find((x) => ledgerKey(x) === key);
      return e ? clone(e) : null;
    },
    listLedger: async (limit) =>
      clone(
        doc.ledger
          .map((e, i) => ({ e, i }))
          .sort((a, b) => b.e.completedAt.localeCompare(a.e.completedAt) || b.i - a.i)
          .slice(0, limit)
          .map((x) => x.e),
      ),
    totalXp: async (profileId) =>
      doc.ledger.filter((e) => e.profileId === profileId).reduce((sum, e) => sum + e.awardedXp, 0),
  };
}

export async function createDocumentRepository(storage: DocumentStorage, kind: string): Promise<AvciRepository> {
  // Validate early so an unsupported future document fails before any use.
  const initial = await storage.load();
  if (initial) migrateDocument(initial.doc);

  let queue: Promise<unknown> = Promise.resolve();
  const run = async <T>(fn: (tx: StoreTx) => Promise<T>): Promise<T> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const stored = await storage.load();
      const rev = stored?.rev ?? 0;
      const working = migrateDocument(stored ? clone(stored.doc) : emptyDocument());
      const result = await fn(docTx(working));
      if (await storage.commit(rev, working)) return result;
    }
    throw new Error('Veri başka bir sekmede değişiyor; lütfen tekrar deneyin.');
  };
  return {
    kind,
    transaction<T>(fn: (tx: StoreTx) => Promise<T>): Promise<T> {
      // Serialize within this tab; the revision check covers other tabs.
      const next = queue.then(() => run(fn));
      queue = next.catch(() => undefined);
      return next;
    },
    close: () => storage.close(),
    // The document is overwritten, but how the browser reclaims old IndexedDB pages is outside the app's control.
    purgeDeleted: async () => false,
  };
}
