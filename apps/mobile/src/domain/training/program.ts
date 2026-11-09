/**
 * Weekly program: generation from confirmed facts, deterministic validation
 * and a structured diff used for the before/after preview. Prescriptions hold
 * sets, rep range and an optional target RIR; no load is prescribed in M1 and
 * nothing here knows about XP or rank.
 */
import { EXERCISES, exerciseById, isAvailable, type Pattern } from './catalog';
import type { Equipment, Limitation, TrainingProfileFacts, Weekday } from './profile';

export interface PrescribedExercise {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  /** Target reps-in-reserve; null = not set. A product default, not a medical value. */
  targetRir: number | null;
}

export interface ProgramDay {
  /** Stable identity within the plan lineage; survives edits and weekday changes. */
  id: string;
  title: string;
  weekday: Weekday;
  exercises: PrescribedExercise[];
}

export interface Program {
  days: ProgramDay[];
}

export const LIMITS = {
  setsMin: 1,
  setsMax: 8,
  repsMin: 1,
  repsMax: 30,
  rirMax: 5,
  exercisesPerDayMax: 10,
  titleMax: 40,
} as const;

export type ProgramErrorCode =
  | 'day-count'
  | 'duplicate-weekday'
  | 'duplicate-day-id'
  | 'title'
  | 'exercise-count'
  | 'unknown-exercise'
  | 'unavailable-exercise'
  | 'duplicate-exercise'
  | 'sets'
  | 'reps'
  | 'rir';

export class ProgramError extends RangeError {
  constructor(
    public readonly code: ProgramErrorCode,
    public readonly dayId?: string,
  ) {
    super(`invalid program: ${code}${dayId ? ` (${dayId})` : ''}`);
  }
}

type DayKind = 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full-a' | 'full-b';

const TEMPLATES: Record<DayKind, { title: string; patterns: Pattern[] }> = {
  push: { title: 'İtiş', patterns: ['horizontal-push', 'vertical-push', 'lateral-raise', 'triceps'] },
  pull: { title: 'Çekiş', patterns: ['vertical-pull', 'horizontal-pull', 'biceps', 'core'] },
  legs: { title: 'Bacak', patterns: ['squat', 'hinge', 'single-leg', 'calves', 'core'] },
  upper: { title: 'Üst vücut', patterns: ['horizontal-push', 'horizontal-pull', 'vertical-push', 'vertical-pull', 'triceps', 'biceps'] },
  lower: { title: 'Alt vücut', patterns: ['squat', 'hinge', 'single-leg', 'calves', 'core'] },
  'full-a': { title: 'Tüm vücut A', patterns: ['squat', 'horizontal-push', 'horizontal-pull', 'core'] },
  'full-b': { title: 'Tüm vücut B', patterns: ['hinge', 'vertical-push', 'vertical-pull', 'single-leg'] },
};

/** 5 days = the user's preferred PPLPP split (legs once a week; stated in the UI). */
const SPLITS: Record<number, DayKind[]> = {
  2: ['full-a', 'full-b'],
  3: ['push', 'pull', 'legs'],
  4: ['upper', 'lower', 'upper', 'lower'],
  5: ['push', 'pull', 'legs', 'push', 'pull'],
  6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
};

/** Always-available, unrestricted options used when a day would otherwise be empty. */
const FALLBACK_PATTERNS: readonly Pattern[] = ['core', 'calves', 'hinge', 'squat', 'single-leg'];

const COMPOUND: readonly Pattern[] = ['horizontal-push', 'vertical-push', 'horizontal-pull', 'vertical-pull', 'squat', 'hinge', 'single-leg'];

export interface GeneratedProgram {
  program: Program;
  /** Patterns with no exercise for the confirmed equipment/limitations. */
  skippedPatterns: Pattern[];
}

function pickExercise(pattern: Pattern, equipment: Equipment[], limitations: Limitation[]) {
  return EXERCISES.find((e) => e.pattern === pattern && isAvailable(e, equipment, limitations));
}

export function generateProgram(facts: TrainingProfileFacts): GeneratedProgram {
  const kinds = SPLITS[facts.trainingDays.length];
  if (!kinds) throw new ProgramError('day-count');
  const skipped = new Set<Pattern>();
  const counts: Partial<Record<DayKind, number>> = {};
  const sets = facts.experience === 'beginner' ? 2 : 3;
  const maxExercises = facts.sessionMinutes !== null && facts.sessionMinutes < 45 ? 4 : 6;

  const days: ProgramDay[] = kinds.map((kind, i) => {
    counts[kind] = (counts[kind] ?? 0) + 1;
    const repeat = kinds.filter((k) => k === kind).length > 1;
    const t = TEMPLATES[kind];
    const exercises: PrescribedExercise[] = [];
    const add = (pattern: Pattern) => {
      const ex = pickExercise(pattern, facts.equipment, facts.limitations);
      if (!ex) return false;
      if (exercises.some((p) => p.exerciseId === ex.id)) return true;
      const compound = COMPOUND.includes(pattern);
      const [repMin, repMax] = compound ? (facts.goal === 'strength' ? [5, 8] : [8, 12]) : [10, 15];
      exercises.push({ exerciseId: ex.id, sets, repMin, repMax, targetRir: 2 });
      return true;
    };
    for (const pattern of t.patterns) {
      if (exercises.length >= maxExercises) break;
      if (!add(pattern)) skipped.add(pattern);
    }
    // Never produce an empty day: fall back to unrestricted bodyweight options.
    for (const pattern of FALLBACK_PATTERNS) {
      if (exercises.length > 0) break;
      add(pattern);
    }
    return {
      // Stable per template occurrence: regenerating the same split keeps ids
      // (a done slot stays done); a different split gets different ids.
      id: `${kind}-${counts[kind]}`,
      title: repeat ? `${t.title} ${String.fromCharCode(64 + counts[kind]!)}` : t.title,
      weekday: facts.trainingDays[i],
      exercises,
    };
  });
  return { program: { days }, skippedPatterns: [...skipped] };
}

const isInt = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Throws ProgramError on the first violation; returns a normalised deep copy. */
export function validateProgram(
  program: Program,
  facts: Pick<TrainingProfileFacts, 'equipment' | 'limitations'>,
): Program {
  if (!Array.isArray(program?.days) || program.days.length < 1 || program.days.length > 6) {
    throw new ProgramError('day-count');
  }
  const weekdays = new Set<number>();
  const ids = new Set<string>();
  const days = program.days.map((d) => {
    if (typeof d.id !== 'string' || d.id.length === 0 || ids.has(d.id)) throw new ProgramError('duplicate-day-id', d.id);
    ids.add(d.id);
    if (!isInt(d.weekday, 0, 6)) throw new ProgramError('duplicate-weekday', d.id);
    if (weekdays.has(d.weekday)) throw new ProgramError('duplicate-weekday', d.id);
    weekdays.add(d.weekday);
    const title = typeof d.title === 'string' ? d.title.trim() : '';
    if (title.length === 0 || title.length > LIMITS.titleMax) throw new ProgramError('title', d.id);
    if (!Array.isArray(d.exercises) || d.exercises.length < 1 || d.exercises.length > LIMITS.exercisesPerDayMax) {
      throw new ProgramError('exercise-count', d.id);
    }
    const seen = new Set<string>();
    const exercises = d.exercises.map((p) => {
      const ex = exerciseById(p.exerciseId);
      if (!ex) throw new ProgramError('unknown-exercise', d.id);
      if (!isAvailable(ex, facts.equipment, facts.limitations)) throw new ProgramError('unavailable-exercise', d.id);
      if (seen.has(ex.id)) throw new ProgramError('duplicate-exercise', d.id);
      seen.add(ex.id);
      if (!isInt(p.sets, LIMITS.setsMin, LIMITS.setsMax)) throw new ProgramError('sets', d.id);
      if (!isInt(p.repMin, LIMITS.repsMin, LIMITS.repsMax) || !isInt(p.repMax, p.repMin, LIMITS.repsMax)) {
        throw new ProgramError('reps', d.id);
      }
      if (p.targetRir !== null && !isInt(p.targetRir, 0, LIMITS.rirMax)) throw new ProgramError('rir', d.id);
      return { exerciseId: ex.id, sets: p.sets, repMin: p.repMin, repMax: p.repMax, targetRir: p.targetRir };
    });
    return { id: d.id, title, weekday: d.weekday as Weekday, exercises };
  });
  return { days: days.sort((a, b) => a.weekday - b.weekday) };
}

export type ProgramChange =
  | { kind: 'day-added'; dayId: string; title: string }
  | { kind: 'day-removed'; dayId: string; title: string }
  | { kind: 'weekday'; dayId: string; title: string; from: Weekday; to: Weekday }
  | { kind: 'title'; dayId: string; from: string; to: string }
  | { kind: 'exercise-added'; dayId: string; title: string; exerciseId: string }
  | { kind: 'exercise-removed'; dayId: string; title: string; exerciseId: string }
  | {
      kind: 'prescription';
      dayId: string;
      title: string;
      exerciseId: string;
      from: Omit<PrescribedExercise, 'exerciseId'>;
      to: Omit<PrescribedExercise, 'exerciseId'>;
    };

/** Structured before/after summary for the preview screen and the audit reason. */
export function diffPrograms(before: Program, after: Program): ProgramChange[] {
  const out: ProgramChange[] = [];
  const prev = new Map(before.days.map((d) => [d.id, d]));
  const next = new Map(after.days.map((d) => [d.id, d]));
  for (const d of before.days) if (!next.has(d.id)) out.push({ kind: 'day-removed', dayId: d.id, title: d.title });
  for (const d of after.days) {
    const p = prev.get(d.id);
    if (!p) {
      out.push({ kind: 'day-added', dayId: d.id, title: d.title });
      continue;
    }
    if (p.title !== d.title) out.push({ kind: 'title', dayId: d.id, from: p.title, to: d.title });
    if (p.weekday !== d.weekday) out.push({ kind: 'weekday', dayId: d.id, title: d.title, from: p.weekday, to: d.weekday });
    const pe = new Map(p.exercises.map((e) => [e.exerciseId, e]));
    const ne = new Map(d.exercises.map((e) => [e.exerciseId, e]));
    for (const e of p.exercises) {
      if (!ne.has(e.exerciseId)) out.push({ kind: 'exercise-removed', dayId: d.id, title: d.title, exerciseId: e.exerciseId });
    }
    for (const e of d.exercises) {
      const old = pe.get(e.exerciseId);
      if (!old) {
        out.push({ kind: 'exercise-added', dayId: d.id, title: d.title, exerciseId: e.exerciseId });
      } else if (old.sets !== e.sets || old.repMin !== e.repMin || old.repMax !== e.repMax || old.targetRir !== e.targetRir) {
        const { exerciseId: _a, ...from } = old;
        const { exerciseId: _b, ...to } = e;
        out.push({ kind: 'prescription', dayId: d.id, title: d.title, exerciseId: e.exerciseId, from, to });
      }
    }
  }
  return out;
}

export type MuscleGroup = 'push' | 'pull' | 'legs';
const GROUP: Record<Pattern, MuscleGroup | null> = {
  'horizontal-push': 'push',
  'vertical-push': 'push',
  triceps: 'push',
  'lateral-raise': 'push',
  'horizontal-pull': 'pull',
  'vertical-pull': 'pull',
  biceps: 'pull',
  squat: 'legs',
  hinge: 'legs',
  'single-leg': 'legs',
  calves: 'legs',
  core: null,
};

/** Number of sessions per week that train each group: stated honestly in the UI. */
export function weeklyExposure(program: Program): Record<MuscleGroup, number> {
  const out: Record<MuscleGroup, number> = { push: 0, pull: 0, legs: 0 };
  for (const d of program.days) {
    const groups = new Set(d.exercises.map((e) => GROUP[exerciseById(e.exerciseId)!.pattern]).filter((g) => g !== null));
    for (const g of groups) out[g as MuscleGroup] += 1;
  }
  return out;
}
