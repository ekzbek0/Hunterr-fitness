/**
 * Pure M1-fix and M2 rules: exercise-order diff, effective-week conflicts,
 * double-progression decision, rest timer and weekly cycle identity.
 * Thresholds tested here are product hypotheses (docs/TRAINING_RULES.md).
 */
import { describe, expect, it } from 'vitest';

import { cycleWeekEnd, cycleWeekStart, decideWeeklyCycle } from '@/domain/game/weekly-cycle';
import { exerciseById, incrementKeyFor } from '@/domain/training/catalog';
import { diffPrograms, generateProgram, ProgramError, validateProgram, type PrescribedExercise } from '@/domain/training/program';
import { DRAFT_TRAINING_PROFILE, validateTrainingProfile } from '@/domain/training/profile';
import {
  evaluateProgression,
  validateIncrement,
  type ConfirmedIncrement,
  type EvidenceSet,
  type ProgressionInput,
  type SessionEvidence,
} from '@/domain/training/progression';
import type { CheckinInput } from '@/domain/training/readiness';
import { formatRest, isClockRollback, restView, validateRestDuration, type RestTimer } from '@/domain/training/rest';
import { buildWeek, findScheduleConflicts } from '@/domain/training/schedule';

const facts = validateTrainingProfile(DRAFT_TRAINING_PROFILE);
const program = () => generateProgram(facts).program;

describe('M1 fix: exercise order is a program change', () => {
  it('a pure reorder is detected, with before/after order', () => {
    const before = program();
    const after = structuredClone(before);
    const day = after.days[0];
    day.exercises = [day.exercises[1], day.exercises[0], ...day.exercises.slice(2)];
    const changes = diffPrograms(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: 'exercise-order',
      dayId: day.id,
      from: before.days[0].exercises.map((e) => e.exerciseId),
      to: day.exercises.map((e) => e.exerciseId),
    });
  });

  it('validation keeps the user order (it is persisted as given)', () => {
    const p = program();
    p.days[0].exercises.reverse();
    const v = validateProgram(p, facts);
    expect(v.days.find((d) => d.id === p.days[0].id)!.exercises.map((e) => e.exerciseId)).toEqual(
      p.days[0].exercises.map((e) => e.exerciseId),
    );
  });

  it('adding or removing alone is not reported as a reorder; identical programs have no diff', () => {
    const before = program();
    const removed = structuredClone(before);
    removed.days[0].exercises.splice(1, 1);
    expect(diffPrograms(before, removed).map((c) => c.kind)).toEqual(['exercise-removed']);
    expect(diffPrograms(before, structuredClone(before))).toEqual([]);
    // Old stored JSON without targetLoad equals a normalised program with targetLoad: null.
    expect(diffPrograms(before, validateProgram(before, facts))).toEqual([]);
  });

  it('target loads are validated; bands never get a kg target', () => {
    const p = program();
    p.days[0].exercises[0].targetLoad = { value: Number.NaN, unit: 'kg' };
    expect(() => validateProgram(p, facts)).toThrow(ProgramError);
    const bands = validateTrainingProfile({ ...DRAFT_TRAINING_PROFILE, equipment: ['bands'] });
    const bp = generateProgram(bands).program;
    const band = bp.days.flatMap((d) => d.exercises).find((e) => exerciseById(e.exerciseId)!.loadConvention === 'band')!;
    band.targetLoad = { value: 5, unit: 'kg' };
    expect(() => validateProgram(bp, bands)).toThrow(ProgramError);
  });
});

describe('M1 fix: effective week conflicts', () => {
  // 2026-11-09 Monday. PPLPP: Mon push-1, Tue pull-1, Wed legs-1, Fri push-2, Sat pull-2.
  const ws = '2026-11-09';
  it('Tue moved to Thu + another day put on Thu = conflict naming both sessions', () => {
    const p = program();
    const moves = [{ slotId: `${ws}:pull-1`, weekStart: ws, toDate: '2026-11-12', movedAt: 'x' }];
    expect(findScheduleConflicts(buildWeek(p, ws, moves, [], '2026-11-10'), '2026-11-10')).toEqual([]);
    const edited = structuredClone(p);
    edited.days.find((d) => d.id === 'push-2')!.weekday = 3; // Friday -> Thursday
    const conflicts = findScheduleConflicts(buildWeek(edited, ws, moves, [], '2026-11-10'), '2026-11-10');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].date).toBe('2026-11-12');
    expect(conflicts[0].sessions.map((s) => [s.programDayId, s.moved]).sort()).toEqual([
      ['pull-1', true],
      ['push-2', false],
    ]);
  });

  it('past dates are history and are not checked', () => {
    const p = program();
    const moves = [{ slotId: `${ws}:legs-1`, weekStart: ws, toDate: '2026-11-09', movedAt: 'x' }];
    expect(findScheduleConflicts(buildWeek(p, ws, moves, [], '2026-11-11'), '2026-11-11')).toEqual([]);
  });
});

// ---- progression ----
const good: CheckinInput = { sleepHours: 8, energy: 4, fatigue: 2, soreness: 1, jointPain: 'no', illness: 'no' };
const BENCH: PrescribedExercise = { exerciseId: 'bb-bench-press', sets: 3, repMin: 8, repMax: 12, targetRir: 2 };
const kg25: ConfirmedIncrement = { key: 'barbell', unit: 'kg', value: 2.5 };
const ws = (n: number, o: Partial<EvidenceSet> = {}): EvidenceSet[] =>
  Array.from({ length: n }, () => ({ kind: 'work', reps: 12, load: 60, unit: 'kg', loadConvention: 'total', rir: 2, ...o }));
const sess = (id: string, date: string, sets = ws(3), o: Partial<SessionEvidence> = {}): SessionEvidence => ({
  sessionId: id,
  date,
  prescription: { sets: 3, repMin: 8, repMax: 12 },
  sets,
  safety: { jointPain: 'no', illness: 'no' },
  ...o,
});
const input = (o: Partial<ProgressionInput> = {}): ProgressionInput => ({
  exerciseId: 'bb-bench-press',
  current: BENCH,
  history: [sess('b', '2026-11-13'), sess('a', '2026-11-09')],
  today: '2026-11-14',
  todayCheckin: good,
  increments: [kg25],
  ...o,
});

describe('double progression proposal', () => {
  it('two recent complete sessions at the top of the range with RIR >= 2 -> smallest increment', () => {
    const d = evaluateProgression(input());
    expect(d).toMatchObject({ kind: 'increase', before: { load: 60, unit: 'kg', convention: 'total' }, after: { load: 62.5 } });
    if (d.kind === 'increase') {
      expect(d.percentHundredths).toBe(416); // 4.16%, within the 5% product cap
      expect(d.evidenceSessionIds).toEqual(['b', 'a']);
    }
    // Deterministic: same input, same evidence key.
    const again = evaluateProgression(input());
    expect(again.kind === 'increase' && d.kind === 'increase' && again.evidenceKey === d.evidenceKey).toBe(true);
  });

  it('evidence key changes when a set changes (stale proposal detection)', () => {
    const a = evaluateProgression(input());
    const b = evaluateProgression(input({ history: [sess('b', '2026-11-13', ws(3, { rir: 3 })), sess('a', '2026-11-09')] }));
    expect(a.kind === 'increase' && b.kind === 'increase' && a.evidenceKey !== b.evidenceKey).toBe(true);
  });

  it.each([
    ['missing RIR', [sess('b', '2026-11-13', [...ws(2), ...ws(1, { rir: null })]), sess('a', '2026-11-09')], 'missing-rir'],
    ['RIR below 2', [sess('b', '2026-11-13', ws(3, { rir: 1 })), sess('a', '2026-11-09')], 'low-rir'],
    ['incomplete sets', [sess('b', '2026-11-13', ws(2)), sess('a', '2026-11-09')], 'incomplete-sets'],
    ['reps below top', [sess('b', '2026-11-13', ws(3, { reps: 11 })), sess('a', '2026-11-09')], 'reps-below-top'],
    ['unit changed (no kg/lb conversion)', [sess('b', '2026-11-13', ws(3, { unit: 'lb' })), sess('a', '2026-11-09')], 'unit-changed'],
    ['load differs between sessions', [sess('b', '2026-11-13', ws(3, { load: 57.5 })), sess('a', '2026-11-09')], 'load-varies'],
    ['load convention changed', [sess('b', '2026-11-13', ws(3, { loadConvention: 'per-dumbbell' })), sess('a', '2026-11-09')], 'convention-changed'],
    ['session pain', [sess('b', '2026-11-13', ws(3), { safety: { jointPain: 'yes', illness: 'no' } }), sess('a', '2026-11-09')], 'session-pain-or-illness'],
    ['session check-in missing', [sess('b', '2026-11-13', ws(3), { safety: null }), sess('a', '2026-11-09')], 'session-checkin-missing'],
    ['prescription changed since', [sess('b', '2026-11-13', ws(3), { prescription: { sets: 3, repMin: 6, repMax: 10 } }), sess('a', '2026-11-09')], 'prescription-changed'],
    ['only one session', [sess('b', '2026-11-13')], 'insufficient-sessions'],
  ])('%s -> hold, no increase', (_n, history, reason) => {
    const d = evaluateProgression(input({ history }));
    expect(d.kind).toBe('hold');
    expect(d.kind === 'hold' && d.reasons).toContain(reason);
  });

  it('warm-up sets never count as work sets', () => {
    const withWarmups = [...ws(1, { kind: 'warmup', reps: 5, load: 20, rir: null }), ...ws(2)];
    const d = evaluateProgression(input({ history: [sess('b', '2026-11-13', withWarmups), sess('a', '2026-11-09')] }));
    expect(d.kind === 'hold' && d.reasons).toEqual(['incomplete-sets']);
  });

  it.each([
    ['no check-in today', { todayCheckin: null }, 'checkin-missing'],
    ['illness today', { todayCheckin: { ...good, illness: 'yes' as const } }, 'pain-or-illness-today'],
    ['pain unknown today', { todayCheckin: { ...good, jointPain: 'unknown' as const } }, 'safety-unknown-today'],
    ['short sleep', { todayCheckin: { ...good, sleepHours: 5 } }, 'recovery-freeze'],
    ['high fatigue', { todayCheckin: { ...good, fatigue: 4 } }, 'recovery-freeze'],
  ])('readiness blocker: %s', (_n, patch, reason) => {
    expect(evaluateProgression(input(patch))).toMatchObject({ kind: 'hold', reasons: [reason] });
  });

  it('14-day recency and gap gate -> rebaseline, never an increase', () => {
    expect(evaluateProgression(input({ today: '2026-11-28' }))).toMatchObject({ kind: 'rebaseline', reasons: ['stale-data'] });
    expect(evaluateProgression(input({ today: '2026-11-27' })).kind).toBe('increase'); // exactly 14 days old
    expect(
      evaluateProgression(input({ history: [sess('b', '2026-11-25'), sess('a', '2026-11-09')], today: '2026-11-26' })),
    ).toMatchObject({ kind: 'rebaseline', reasons: ['training-gap'] });
  });

  it('smallest increment above the 5% cap preserves the load (no rounding up)', () => {
    const light = [sess('b', '2026-11-13', ws(3, { load: 40 })), sess('a', '2026-11-09', ws(3, { load: 40 }))];
    expect(evaluateProgression(input({ history: light }))).toMatchObject({ kind: 'hold', reasons: ['increment-over-cap'] });
    // Exactly 5% is allowed: 2.5 / 50.
    const fifty = [sess('b', '2026-11-13', ws(3, { load: 50 })), sess('a', '2026-11-09', ws(3, { load: 50 }))];
    expect(evaluateProgression(input({ history: fifty }))).toMatchObject({ kind: 'increase', after: { load: 52.5 } });
  });

  it('only the user-confirmed increment for the same equipment AND unit is used', () => {
    expect(evaluateProgression(input({ increments: [] }))).toMatchObject({ kind: 'hold', reasons: ['increment-unconfirmed'] });
    expect(evaluateProgression(input({ increments: [{ key: 'barbell', unit: 'lb', value: 5 }] }))).toMatchObject({
      kind: 'hold',
      reasons: ['increment-unconfirmed'],
    });
    expect(evaluateProgression(input({ increments: [{ key: 'dumbbell', unit: 'kg', value: 1 }] }))).toMatchObject({
      kind: 'hold',
      reasons: ['increment-unconfirmed'],
    });
    // lb data with a confirmed lb increment works in lb, without conversion.
    const lb = [sess('b', '2026-11-13', ws(3, { unit: 'lb', load: 135 })), sess('a', '2026-11-09', ws(3, { unit: 'lb', load: 135 }))];
    expect(evaluateProgression(input({ history: lb, increments: [{ key: 'barbell', unit: 'lb', value: 5 }] }))).toMatchObject({
      kind: 'increase',
      after: { load: 140, unit: 'lb' },
    });
  });

  it('per-dumbbell load stays per dumbbell; the dumbbell step applies per dumbbell', () => {
    const db: PrescribedExercise = { exerciseId: 'db-bench-press', sets: 3, repMin: 8, repMax: 12, targetRir: 2 };
    const h = (load: number) => [
      sess('b', '2026-11-13', ws(3, { load, loadConvention: 'per-dumbbell' })),
      sess('a', '2026-11-09', ws(3, { load, loadConvention: 'per-dumbbell' })),
    ];
    const inc: ConfirmedIncrement[] = [{ key: 'dumbbell', unit: 'kg', value: 1 }];
    expect(evaluateProgression(input({ exerciseId: 'db-bench-press', current: db, history: h(22), increments: inc }))).toMatchObject({
      kind: 'increase',
      before: { load: 22, convention: 'per-dumbbell' },
      after: { load: 23, convention: 'per-dumbbell' },
    });
    // 1 kg on a 16 kg dumbbell is 6.25% > 5%: hold.
    expect(evaluateProgression(input({ exerciseId: 'db-bench-press', current: db, history: h(16), increments: inc }))).toMatchObject({
      kind: 'hold',
      reasons: ['increment-over-cap'],
    });
    // Recorded as total while the exercise is per-dumbbell: not comparable.
    const mixed = [sess('b', '2026-11-13', ws(3, { load: 44, loadConvention: 'total' })), sess('a', '2026-11-09', ws(3, { load: 44, loadConvention: 'total' }))];
    expect(evaluateProgression(input({ exerciseId: 'db-bench-press', current: db, history: mixed, increments: inc })).kind).toBe('hold');
  });

  it('band resistance is never treated as kilograms; zero-load bodyweight is not divided by zero', () => {
    const band: PrescribedExercise = { exerciseId: 'band-row', sets: 3, repMin: 10, repMax: 15, targetRir: 2 };
    expect(evaluateProgression(input({ exerciseId: 'band-row', current: band }))).toMatchObject({ kind: 'hold', reasons: ['band-resistance'] });
    expect(incrementKeyFor(exerciseById('band-row')!)).toBeNull();
    const pu: PrescribedExercise = { exerciseId: 'pull-up', sets: 3, repMin: 8, repMax: 12, targetRir: 2 };
    const zero = [sess('b', '2026-11-13', ws(3, { load: 0, loadConvention: 'bodyweight' })), sess('a', '2026-11-09', ws(3, { load: 0, loadConvention: 'bodyweight' }))];
    expect(evaluateProgression(input({ exerciseId: 'pull-up', current: pu, history: zero, increments: [{ key: 'added-weight', unit: 'kg', value: 1 }] }))).toMatchObject({
      kind: 'hold',
      reasons: ['bodyweight-zero-load'],
    });
  });

  it('increment bounds', () => {
    expect(validateIncrement(1.25)).toBe(1.25);
    for (const bad of [0, -1, Number.NaN, Infinity, 51]) expect(() => validateIncrement(bad)).toThrow(RangeError);
  });
});

describe('rest timer is derived from timestamps', () => {
  const t: RestTimer = { startedAt: '2026-11-09T07:00:00.000Z', durationS: 90, lastSeenAt: null, uncertain: false };
  const at = (iso: string) => Date.parse(iso);
  it('counts down from the stored start, across background/restart', () => {
    expect(restView(t, at('2026-11-09T07:00:00.000Z'))).toEqual({ state: 'running', remainingS: 90 });
    expect(restView(t, at('2026-11-09T07:00:30.200Z'))).toEqual({ state: 'running', remainingS: 60 });
    expect(restView(t, at('2026-11-09T07:05:00.000Z'))).toEqual({ state: 'done' });
    expect(restView(null, at('2026-11-09T07:00:00.000Z'))).toEqual({ state: 'off' });
  });
  it('REGRESSION: 90 s timer, 60 s passed (30 left), clock set back 30 s -> never 60 s again; uncertain', () => {
    const seen: RestTimer = { ...t, lastSeenAt: '2026-11-09T07:01:00.000Z' }; // checkpoint at +60 s
    expect(restView(seen, at('2026-11-09T07:01:00.000Z'))).toEqual({ state: 'running', remainingS: 30 });
    expect(restView(seen, at('2026-11-09T07:00:30.000Z'))).toEqual({ state: 'uncertain' });
    // Same rollback seen only by the running screen (no stored checkpoint yet).
    expect(restView(t, at('2026-11-09T07:00:30.000Z'), at('2026-11-09T07:01:00.000Z'))).toEqual({ state: 'uncertain' });
    expect(isClockRollback(seen, at('2026-11-09T07:00:30.000Z'))).toBe(true);
    // Once uncertain, it stays uncertain even when the clock is moved forward again.
    expect(restView({ ...seen, uncertain: true }, at('2026-11-09T07:01:10.000Z'))).toEqual({ state: 'uncertain' });
  });
  it('clock before the start is uncertain; small jitter is tolerated without extending', () => {
    expect(restView(t, at('2026-11-09T06:00:00.000Z'))).toEqual({ state: 'uncertain' });
    const seen: RestTimer = { ...t, lastSeenAt: '2026-11-09T07:01:00.000Z' };
    expect(restView(seen, at('2026-11-09T07:00:59.000Z'))).toEqual({ state: 'running', remainingS: 30 });
  });
  it('REGRESSION: a rest that was already seen finished stays finished after a later clock rollback', () => {
    const finished: RestTimer = { ...t, lastSeenAt: '2026-11-09T07:02:00.000Z' }; // seen at +120 s of a 90 s rest
    expect(restView(finished, at('2026-11-09T07:01:00.000Z'))).toEqual({ state: 'done' });
    expect(restView(t, at('2026-11-09T07:01:00.000Z'), at('2026-11-09T07:02:00.000Z'))).toEqual({ state: 'done' });
    expect(isClockRollback(finished, at('2026-11-09T07:01:00.000Z'))).toBe(false);
  });
  it('validates durations and formats', () => {
    expect(validateRestDuration(90)).toBe(90);
    for (const bad of [0, 14, 601, 1.5, Number.NaN]) expect(() => validateRestDuration(bad)).toThrow(RangeError);
    expect(formatRest(75)).toBe('1:15');
  });
});

describe('weekly cycle identity', () => {
  it('Monday-based boundaries', () => {
    expect(cycleWeekStart('2026-11-15')).toBe('2026-11-09');
    expect(cycleWeekStart('2026-11-09')).toBe('2026-11-09');
    expect(cycleWeekEnd('2026-11-09')).toBe('2026-11-15');
  });
  it('resume same week, open next week once, never reopen an earlier week', () => {
    expect(decideWeeklyCycle(null, '2026-11-10')).toEqual({ action: 'open', weekStart: '2026-11-09', closeLatest: false });
    const latest = { weekStart: '2026-11-09', closedAt: null };
    expect(decideWeeklyCycle(latest, '2026-11-15')).toEqual({ action: 'resume' });
    expect(decideWeeklyCycle(latest, '2026-11-16')).toEqual({ action: 'open', weekStart: '2026-11-16', closeLatest: true });
    expect(decideWeeklyCycle({ weekStart: '2026-11-16', closedAt: null }, '2026-11-15')).toEqual({ action: 'keep-latest' });
  });
});
