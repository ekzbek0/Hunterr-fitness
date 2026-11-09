/**
 * Set logging rules. Warm-up sets are recorded but never count as working
 * sets. Missing RIR stays null (insufficient evidence), never zero.
 */
export type SetKind = 'warmup' | 'work';
export type LoadUnit = 'kg' | 'lb';

export interface SetInput {
  exerciseId: string;
  kind: SetKind;
  reps: number;
  /** Per-dumbbell, total or added load, following the exercise's load convention. */
  load: number;
  unit: LoadUnit;
  rir: number | null;
}

export const SET_LIMITS = { repsMax: 100, loadMax: 1000, rirMax: 10 } as const;

export function validateSet(input: SetInput): SetInput {
  if (input.kind !== 'warmup' && input.kind !== 'work') throw new RangeError('kind');
  if (input.unit !== 'kg' && input.unit !== 'lb') throw new RangeError('unit');
  if (!Number.isInteger(input.reps) || input.reps < 0 || input.reps > SET_LIMITS.repsMax) throw new RangeError('reps');
  // A working set needs at least one repetition; 0 reps cannot complete a workout.
  if (input.kind === 'work' && input.reps < 1) throw new RangeError('reps');
  if (typeof input.load !== 'number' || !Number.isFinite(input.load) || input.load < 0 || input.load > SET_LIMITS.loadMax) {
    throw new RangeError('load');
  }
  if (input.rir !== null && (!Number.isInteger(input.rir) || input.rir < 0 || input.rir > SET_LIMITS.rirMax)) {
    throw new RangeError('rir');
  }
  if (typeof input.exerciseId !== 'string' || input.exerciseId.length === 0) throw new RangeError('exercise');
  // Store loads with at most two decimals (e.g. 1.25 kg plates) without float noise.
  return { ...input, load: Math.round(input.load * 100) / 100 };
}

/** Parses a user-typed number, accepting a Turkish decimal comma. Empty -> null. */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return Number.NaN;
  return Number(t);
}

export interface LoggedSetLike {
  exerciseId: string;
  kind: SetKind;
}

export interface SessionSummary {
  workSets: number;
  warmupSets: number;
  byExercise: Record<string, { work: number; warmup: number }>;
}

export function summarizeSets(sets: readonly LoggedSetLike[]): SessionSummary {
  const byExercise: SessionSummary['byExercise'] = {};
  let workSets = 0;
  let warmupSets = 0;
  for (const s of sets) {
    const e = (byExercise[s.exerciseId] ??= { work: 0, warmup: 0 });
    if (s.kind === 'work') {
      e.work += 1;
      workSets += 1;
    } else {
      e.warmup += 1;
      warmupSets += 1;
    }
  }
  return { workSets, warmupSets, byExercise };
}
