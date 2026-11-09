/**
 * Weekly double-progression proposal (docs/TRAINING_RULES.md). Pure and
 * deterministic: same inputs, same decision. It never changes a plan; the
 * service turns an `increase` into a proposal the user must accept.
 *
 * Every threshold here is a configurable PRODUCT HYPOTHESIS (14-day recency
 * and gap gate, RIR >= 2, +5% cap, two sessions at the top of the range).
 * None of it is a validated medical algorithm, and the UI must say so.
 * Never imports XP/rank.
 */
import { exerciseById, incrementKeyFor, type IncrementKey, type LoadConvention } from './catalog';
import type { PrescribedExercise } from './program';
import { suggestCore, type CheckinInput, type TriState } from './readiness';
import type { LoadUnit, SetKind } from './workout';

export const PROGRESSION_RULES = {
  /** Latest comparable session must be at most this many days old. */
  recencyDays: 14,
  /** Gap between the two compared sessions must not exceed this. */
  maxGapDays: 14,
  minRir: 2,
  /** Increment may be at most this percentage of the current load. */
  capPercent: 5,
} as const;

export interface EvidenceSet {
  kind: SetKind;
  reps: number;
  load: number;
  unit: LoadUnit;
  loadConvention: LoadConvention;
  rir: number | null;
}

/** One finished session's record for one exercise. */
export interface SessionEvidence {
  sessionId: string;
  /** Local date of the task day the session was started on. */
  date: string;
  /** Prescription snapshot the session was started with (null if the exercise was not prescribed). */
  prescription: { sets: number; repMin: number; repMax: number } | null;
  /** Sets of this exercise in entry order (warm-ups included; they are ignored). */
  sets: EvidenceSet[];
  /** Pain/illness answers of that day's check-in; null = no check-in recorded. */
  safety: { jointPain: TriState; illness: TriState } | null;
}

export interface ConfirmedIncrement {
  key: IncrementKey;
  unit: LoadUnit;
  /** Smallest step the user confirmed for this equipment, in `unit`. */
  value: number;
}

export interface LoadPrescription {
  load: number;
  unit: LoadUnit;
  convention: LoadConvention;
  sets: number;
  repMin: number;
  repMax: number;
}

export type HoldReason =
  | 'unknown-exercise'
  | 'band-resistance'
  | 'checkin-missing'
  | 'pain-or-illness-today'
  | 'safety-unknown-today'
  | 'recovery-freeze'
  | 'insufficient-sessions'
  | 'prescription-changed'
  | 'incomplete-sets'
  | 'reps-below-top'
  | 'missing-rir'
  | 'low-rir'
  | 'unit-changed'
  | 'convention-changed'
  | 'load-varies'
  | 'session-checkin-missing'
  | 'session-pain-or-illness'
  | 'session-safety-unknown'
  | 'bodyweight-zero-load'
  | 'increment-unconfirmed'
  | 'increment-over-cap'
  | 'already-at-target';

/** Holds caused by today's readiness only; they say nothing about the evidence. */
export const READINESS_HOLDS: readonly HoldReason[] = [
  'checkin-missing',
  'pain-or-illness-today',
  'safety-unknown-today',
  'recovery-freeze',
];

export const isReadinessHold = (d: ProgressionDecision) =>
  d.kind === 'hold' && d.reasons.length > 0 && d.reasons.every((r) => READINESS_HOLDS.includes(r));

export type RebaselineReason = 'stale-data' | 'training-gap';

export type ProgressionDecision =
  | {
      kind: 'increase';
      exerciseId: string;
      before: LoadPrescription;
      after: LoadPrescription;
      increment: ConfirmedIncrement;
      /** increment / load in hundredths of a percent (e.g. 417 = 4.17%). */
      percentHundredths: number;
      evidenceSessionIds: [string, string];
      /** Fingerprint of the evidence; a changed set or session makes a stored proposal stale. */
      evidenceKey: string;
    }
  | { kind: 'hold'; exerciseId: string; reasons: HoldReason[]; before: LoadPrescription | null }
  | { kind: 'rebaseline'; exerciseId: string; reasons: RebaselineReason[]; lastDate: string; before: LoadPrescription | null };

export interface ProgressionInput {
  exerciseId: string;
  /** Current accepted prescription of this exercise. */
  current: PrescribedExercise;
  /** Finished sessions containing the exercise, newest first. */
  history: readonly SessionEvidence[];
  today: string;
  todayCheckin: CheckinInput | null;
  increments: readonly ConfirmedIncrement[];
}

const cents = (v: number) => Math.round(v * 100);

function dayNumber(localDate: string): number {
  const [y, m, d] = localDate.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** FNV-1a 32-bit; stable across platforms. Not a security hash. */
function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const workSets = (s: SessionEvidence) => s.sets.filter((x) => x.kind === 'work');

function describeLoad(s: SessionEvidence, current: PrescribedExercise): LoadPrescription | null {
  const w = workSets(s);
  if (w.length === 0) return null;
  return {
    load: w[0].load,
    unit: w[0].unit,
    convention: w[0].loadConvention,
    sets: current.sets,
    repMin: current.repMin,
    repMax: current.repMax,
  };
}

export function evaluateProgression(input: ProgressionInput): ProgressionDecision {
  const { exerciseId, current, today } = input;
  const ex = exerciseById(exerciseId);
  const history = input.history.filter((s) => workSets(s).length > 0);
  const latestBefore = history[0] ? describeLoad(history[0], current) : null;
  const hold = (reasons: HoldReason[]): ProgressionDecision => ({ kind: 'hold', exerciseId, reasons, before: latestBefore });

  if (!ex) return hold(['unknown-exercise']);
  if (ex.loadConvention === 'band') return hold(['band-resistance']);

  // 1-4: today's readiness. Missing answers never count as "fine".
  if (!input.todayCheckin) return hold(['checkin-missing']);
  const c = input.todayCheckin;
  if (c.illness === 'yes' || c.jointPain === 'yes') return hold(['pain-or-illness-today']);
  if (c.illness === 'unknown' || c.jointPain === 'unknown') return hold(['safety-unknown-today']);
  if (suggestCore(c).freezeLoadIncrease) return hold(['recovery-freeze']);

  if (history.length < 2) return hold(['insufficient-sessions']);
  const [a, b] = history; // latest two sessions with work sets for this exercise

  // Recency / training-gap gate: preserve the plan, offer a conservative rebaseline.
  const rebase: RebaselineReason[] = [];
  if (dayNumber(today) - dayNumber(a.date) > PROGRESSION_RULES.recencyDays) rebase.push('stale-data');
  if (dayNumber(a.date) - dayNumber(b.date) > PROGRESSION_RULES.maxGapDays) rebase.push('training-gap');
  if (rebase.length > 0) return { kind: 'rebaseline', exerciseId, reasons: rebase, lastDate: a.date, before: latestBefore };

  const reasons = new Set<HoldReason>();
  const pair = [a, b];
  for (const s of pair) {
    const p = s.prescription;
    if (!p || p.sets !== current.sets || p.repMin !== current.repMin || p.repMax !== current.repMax) {
      reasons.add('prescription-changed');
    }
    const w = workSets(s);
    if (w.length < current.sets) reasons.add('incomplete-sets');
    for (const x of w) {
      if (x.reps < current.repMax) reasons.add('reps-below-top');
      if (x.rir === null) reasons.add('missing-rir');
      else if (x.rir < PROGRESSION_RULES.minRir) reasons.add('low-rir');
      if (x.loadConvention !== ex.loadConvention) reasons.add('convention-changed');
    }
    if (!s.safety) reasons.add('session-checkin-missing');
    else if (s.safety.illness === 'yes' || s.safety.jointPain === 'yes') reasons.add('session-pain-or-illness');
    else if (s.safety.illness === 'unknown' || s.safety.jointPain === 'unknown') reasons.add('session-safety-unknown');
  }
  const all = pair.flatMap(workSets);
  if (new Set(all.map((x) => x.unit)).size > 1) reasons.add('unit-changed');
  if (new Set(all.map((x) => cents(x.load))).size > 1) reasons.add('load-varies');
  if (reasons.size > 0) return hold([...reasons]);

  const load = all[0].load;
  const unit = all[0].unit;
  // No load progression for zero-load bodyweight work (no division by zero).
  if (cents(load) === 0) return hold(['bodyweight-zero-load']);

  const key = incrementKeyFor(ex);
  const inc = key ? input.increments.find((i) => i.key === key && i.unit === unit && i.value > 0) : undefined;
  if (!key || !inc) return hold(['increment-unconfirmed']);
  // Integer comparison: increment <= 5% of load  <=>  inc*100 <= load*5.
  if (cents(inc.value) * 100 > cents(load) * PROGRESSION_RULES.capPercent) return hold(['increment-over-cap']);

  const before: LoadPrescription = {
    load,
    unit,
    convention: ex.loadConvention,
    sets: current.sets,
    repMin: current.repMin,
    repMax: current.repMax,
  };
  const after: LoadPrescription = { ...before, load: (cents(load) + cents(inc.value)) / 100 };
  const t = current.targetLoad;
  if (t && t.unit === unit && cents(t.value) >= cents(after.load)) return hold(['already-at-target']);

  const evidence = JSON.stringify([
    exerciseId,
    ex.loadConvention,
    [a, b].map((s) => [s.sessionId, s.date, workSets(s).map((x) => [x.reps, cents(x.load), x.unit, x.rir])]),
    [current.sets, current.repMin, current.repMax],
    [inc.key, inc.unit, cents(inc.value)],
  ]);
  return {
    kind: 'increase',
    exerciseId,
    before,
    after,
    increment: { key: inc.key, unit: inc.unit, value: inc.value },
    percentHundredths: Math.floor((cents(inc.value) * 10000) / cents(load)),
    evidenceSessionIds: [a.sessionId, b.sessionId],
    evidenceKey: `${exerciseId}:${fingerprint(evidence)}`,
  };
}

/** Bounds for a user-confirmed equipment increment (in its own unit). */
export function validateIncrement(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 50) throw new RangeError('increment');
  return Math.round(value * 100) / 100;
}
