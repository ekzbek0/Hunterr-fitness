/**
 * Per-exercise performance series for the Gelişim view. Pure and deterministic.
 *
 * A series is identified by exercise + load unit + load convention. Series are
 * never merged: kg and lb are not converted, per-dumbbell and total loads are
 * different numbers. Warm-up sets never enter the work-set values; they are only
 * counted separately. No 1RM estimate is derived.
 */
import type { LoadConvention } from '@/domain/training/catalog';
import type { LoadUnit, SetKind } from '@/domain/training/workout';

export interface SeriesSetInput {
  exerciseId: string;
  kind: SetKind;
  reps: number;
  load: number;
  unit: LoadUnit;
  loadConvention: LoadConvention;
}

export interface SeriesSessionInput {
  sessionId: string;
  /** Local date (YYYY-MM-DD) of the task day the session belongs to. */
  date: string;
  sets: readonly SeriesSetInput[];
}

export interface SeriesPoint {
  date: string;
  /** Sessions merged into this dated point (normally one). */
  sessionIds: string[];
  /** Heaviest work-set load on this date. */
  topLoad: number;
  /** Most reps performed in a work set at `topLoad`. */
  repsAtTop: number;
  /** Most reps in any work set (useful for zero-load bodyweight / band series). */
  bestReps: number;
  workSets: number;
  /** Warm-up sets of this exercise/unit/convention on this date: shown, never charted. */
  warmupSets: number;
  /** Sum of load x reps over work sets; null when load is not a kg/lb weight (band) or always zero. */
  volume: number | null;
}

export type ChartMetric = 'load' | 'reps';

export interface ExerciseSeries {
  /** `${exerciseId}|${unit}|${loadConvention}` */
  key: string;
  exerciseId: string;
  unit: LoadUnit;
  loadConvention: LoadConvention;
  /** Oldest first. Only dates with at least one work set. */
  points: SeriesPoint[];
  /** Warm-up sets of this series across all sessions (including warm-up-only sessions). */
  warmupSetsTotal: number;
  /** What the chart bars show: load, or reps when the load is not a weight (band / zero added load). */
  metric: ChartMetric;
}

export const seriesKey = (s: { exerciseId: string; unit: LoadUnit; loadConvention: LoadConvention }) =>
  `${s.exerciseId}|${s.unit}|${s.loadConvention}`;

const round2 = (n: number) => Math.round(n * 100) / 100;

interface Acc {
  exerciseId: string;
  unit: LoadUnit;
  loadConvention: LoadConvention;
  byDate: Map<string, { sessionIds: Set<string>; work: SeriesSetInput[]; warmups: number }>;
  warmupSetsTotal: number;
}

export function buildExerciseSeries(sessions: readonly SeriesSessionInput[]): ExerciseSeries[] {
  const acc = new Map<string, Acc>();
  for (const session of sessions) {
    for (const set of session.sets) {
      if (!Number.isFinite(set.load) || !Number.isFinite(set.reps)) continue;
      const key = seriesKey(set);
      let a = acc.get(key);
      if (!a) {
        a = { exerciseId: set.exerciseId, unit: set.unit, loadConvention: set.loadConvention, byDate: new Map(), warmupSetsTotal: 0 };
        acc.set(key, a);
      }
      let d = a.byDate.get(session.date);
      if (!d) {
        d = { sessionIds: new Set(), work: [], warmups: 0 };
        a.byDate.set(session.date, d);
      }
      d.sessionIds.add(session.sessionId);
      if (set.kind === 'work') d.work.push(set);
      else {
        d.warmups += 1;
        a.warmupSetsTotal += 1;
      }
    }
  }

  const out: ExerciseSeries[] = [];
  for (const [key, a] of acc) {
    const points: SeriesPoint[] = [];
    for (const [date, d] of a.byDate) {
      if (d.work.length === 0) continue;
      const topLoad = Math.max(...d.work.map((s) => s.load));
      const repsAtTop = Math.max(...d.work.filter((s) => s.load === topLoad).map((s) => s.reps));
      const bestReps = Math.max(...d.work.map((s) => s.reps));
      const rawVolume = d.work.reduce((sum, s) => sum + s.load * s.reps, 0);
      points.push({
        date,
        sessionIds: [...d.sessionIds].sort(),
        topLoad: round2(topLoad),
        repsAtTop,
        bestReps,
        workSets: d.work.length,
        warmupSets: d.warmups,
        volume: a.loadConvention === 'band' || rawVolume === 0 ? null : round2(rawVolume),
      });
    }
    points.sort((x, y) => x.date.localeCompare(y.date));
    const metric: ChartMetric = a.loadConvention === 'band' || points.every((p) => p.topLoad === 0) ? 'reps' : 'load';
    out.push({ key, exerciseId: a.exerciseId, unit: a.unit, loadConvention: a.loadConvention, points, warmupSetsTotal: a.warmupSetsTotal, metric });
  }
  // Most recently trained first; key as a deterministic tie-breaker.
  const last = (s: ExerciseSeries) => s.points[s.points.length - 1]?.date ?? '';
  return out
    .filter((s) => s.points.length > 0 || s.warmupSetsTotal > 0)
    .sort((x, y) => last(y).localeCompare(last(x)) || x.key.localeCompare(y.key));
}

/** The value a chart bar shows for a point. */
export const pointValue = (series: Pick<ExerciseSeries, 'metric'>, p: SeriesPoint) =>
  series.metric === 'load' ? p.topLoad : p.bestReps;
