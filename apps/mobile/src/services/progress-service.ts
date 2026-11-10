/**
 * M3 Gelişim service: read-only progress views built from real records, plus
 * optional measurements. Every call runs in one repository transaction.
 * loadProgress never writes (it does not open or roll over task days).
 */
import { newId } from '@/data/ids';
import type { AvciRepository, Measurement, SetLog, StoreTx, WorkoutSession } from '@/data/types';
import { SLOT_KEYS } from '@/domain/game/quests';
import { isValidTimeZone, localDateIn } from '@/domain/game/task-day';
import { buildContinuity, CONTINUITY_WINDOW_DAYS, type ContinuityView } from '@/domain/progress/continuity';
import {
  groupMeasurements,
  validateMeasurement,
  type MeasurementFormInput,
  type MeasurementGroup,
  type MeasurementValidation,
} from '@/domain/progress/measurements';
import { buildExerciseSeries, type ExerciseSeries } from '@/domain/progress/series';
import { addDays } from '@/domain/training/schedule';
import { summarizeSets } from '@/domain/training/workout';
import { systemClock, type Clock } from '@/services/avci-service';

/** Finished sessions considered for charts and history. */
export const PROGRESS_SESSION_LIMIT = 500;

export interface HistoryExercise {
  exerciseId: string;
  workSets: number;
  warmupSets: number;
  /** In logged order (position). */
  sets: SetLog[];
}

export interface HistoryEntry {
  sessionId: string;
  /** Local date of the task day the workout belongs to. */
  date: string;
  title: string;
  startedAt: string;
  finishedAt: string | null;
  workSets: number;
  warmupSets: number;
  exercises: HistoryExercise[];
}

export interface ProgressSnapshot {
  hasProfile: boolean;
  today: string;
  /** Finished workouts only, newest first. Abandoned sessions are excluded from history and charts. */
  history: HistoryEntry[];
  series: ExerciseSeries[];
  continuity: ContinuityView;
  /** Live measurements, newest first (tombstoned entries are excluded). */
  measurements: Measurement[];
  measurementGroups: MeasurementGroup[];
}

export type AddMeasurementResult =
  | { status: 'ok'; value: Measurement }
  | { status: 'invalid'; errors: Extract<MeasurementValidation, { ok: false }>['errors'] };

export type DeleteMeasurementResult = { status: 'deleted' } | { status: 'not-found' } | { status: 'already-deleted' };

export class ProgressService {
  constructor(
    private readonly repo: AvciRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  /** The user's current local date, using the device timezone like task days do. */
  today(): string {
    const tz = this.clock.timeZone();
    return localDateIn(this.clock.now(), isValidTimeZone(tz) ? tz : 'UTC');
  }

  async loadProgress(): Promise<ProgressSnapshot> {
    const today = this.today();
    return this.repo.transaction(async (tx) => {
      const profile = await tx.getProfile();
      const sessions = await tx.listFinishedSessions(PROGRESS_SESSION_LIMIT);
      const dates = await this.sessionDates(tx, sessions);
      const sets = await tx.listSetsForSessions(sessions.map((s) => s.id));
      const setsBySession = new Map<string, SetLog[]>();
      for (const st of sets) {
        const list = setsBySession.get(st.sessionId) ?? [];
        list.push(st);
        setsBySession.set(st.sessionId, list);
      }
      for (const list of setsBySession.values()) list.sort((a, b) => a.position - b.position);

      const history: HistoryEntry[] = sessions
        .map((s) => toHistory(s, dates.get(s.id)!, setsBySession.get(s.id) ?? []))
        .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt));

      const series = buildExerciseSeries(
        history.map((h) => ({ sessionId: h.sessionId, date: h.date, sets: setsBySession.get(h.sessionId) ?? [] })),
      );

      const continuity = await this.continuity(tx, today, history);
      const all = await tx.listMeasurements();
      const measurementGroups = groupMeasurements(all);
      const measurements = measurementGroups
        .flatMap((g) => g.entries)
        .sort((a, b) => b.measuredOn.localeCompare(a.measuredOn) || b.recordedAt.localeCompare(a.recordedAt));
      return { hasProfile: profile !== null, today, history, series, continuity, measurements, measurementGroups };
    });
  }

  async addMeasurement(input: MeasurementFormInput): Promise<AddMeasurementResult> {
    const checked = validateMeasurement(input, this.today());
    if (!checked.ok) return { status: 'invalid', errors: checked.errors };
    return this.repo.transaction(async (tx) => {
      const m: Measurement = {
        id: newId(),
        ...checked.value,
        recordedAt: this.clock.now().toISOString(),
        deletedAt: null,
      };
      await tx.insertMeasurement(m);
      return { status: 'ok', value: m };
    });
  }

  /** Tombstones the measurement; it stays hidden after restart. */
  async deleteMeasurement(id: string): Promise<DeleteMeasurementResult> {
    return this.repo.transaction(async (tx) => {
      const existing = (await tx.listMeasurements()).find((m) => m.id === id);
      if (!existing) return { status: 'not-found' };
      if (existing.deletedAt !== null) return { status: 'already-deleted' };
      await tx.deleteMeasurement(id);
      return { status: 'deleted' };
    });
  }

  private async sessionDates(tx: StoreTx, sessions: WorkoutSession[]): Promise<Map<string, string>> {
    const dayDates = new Map<string, string>();
    for (const d of await tx.listTaskDays(PROGRESS_SESSION_LIMIT)) dayDates.set(d.id, d.localDate);
    const out = new Map<string, string>();
    for (const s of sessions) {
      let date = dayDates.get(s.taskDayId);
      if (date === undefined) {
        date = (await tx.getTaskDay(s.taskDayId))?.localDate ?? s.startedAt.slice(0, 10);
        dayDates.set(s.taskDayId, date);
      }
      out.set(s.id, date);
    }
    return out;
  }

  private async continuity(tx: StoreTx, today: string, history: HistoryEntry[]): Promise<ContinuityView> {
    const from = addDays(today, -(CONTINUITY_WINDOW_DAYS - 1));
    // Task days are listed newest first; a window of days needs at most a few more rows than days.
    const days = (await tx.listTaskDays(CONTINUITY_WINDOW_DAYS + 14)).filter((d) => d.localDate >= from);
    const inputs = [];
    for (const d of days) {
      const core = await tx.getSlot(d.id, SLOT_KEYS.core);
      inputs.push({ localDate: d.localDate, coreResolution: core?.status === 'completed' ? core.resolution : null });
    }
    const trained = history.filter((h) => h.date >= from).map((h) => h.date);
    return buildContinuity(today, inputs, trained);
  }
}

function toHistory(session: WorkoutSession, date: string, sets: SetLog[]): HistoryEntry {
  const summary = summarizeSets(sets);
  const order = [...session.exercises.map((e) => e.exerciseId)];
  for (const st of sets) if (!order.includes(st.exerciseId)) order.push(st.exerciseId);
  const exercises: HistoryExercise[] = order
    .map((exerciseId) => ({
      exerciseId,
      workSets: summary.byExercise[exerciseId]?.work ?? 0,
      warmupSets: summary.byExercise[exerciseId]?.warmup ?? 0,
      sets: sets.filter((st) => st.exerciseId === exerciseId),
    }))
    .filter((e) => e.sets.length > 0);
  return {
    sessionId: session.id,
    date,
    title: session.title,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    workSets: summary.workSets,
    warmupSets: summary.warmupSets,
    exercises,
  };
}
