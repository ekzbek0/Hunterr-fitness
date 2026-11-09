import { describe, expect, it } from 'vitest';

import { alternativesFor, EXERCISES, exerciseById } from '@/domain/training/catalog';
import { diffPrograms, generateProgram, ProgramError, validateProgram, weeklyExposure } from '@/domain/training/program';
import { DRAFT_TRAINING_PROFILE, validateTrainingProfile, type TrainingProfileInput } from '@/domain/training/profile';
import { addDays, buildWeek, validateMove, weekdayOf, weekStartOf } from '@/domain/training/schedule';
import { parseDecimal, summarizeSets, validateSet } from '@/domain/training/workout';

const base: TrainingProfileInput = { ...DRAFT_TRAINING_PROFILE };

describe('training profile validation', () => {
  it('normalises days, equipment and keeps body measurements optional', () => {
    const f = validateTrainingProfile({ ...base, trainingDays: [5, 0, 2], equipment: ['dumbbell'], heightCm: null, weightKg: null });
    expect(f.trainingDays).toEqual([0, 2, 5]);
    expect(f.equipment).toEqual(['dumbbell', 'bodyweight']);
    expect(f.heightCm).toBeNull();
    expect(f.weightKg).toBeNull();
    expect(validateTrainingProfile({ ...base, heightCm: 180.04, weightKg: 82.36 })).toMatchObject({ heightCm: 180, weightKg: 82.4 });
  });

  it.each([
    ['goal', { goal: 'bulk-at-all-costs' }],
    ['too few days', { trainingDays: [0] }],
    ['too many days', { trainingDays: [0, 1, 2, 3, 4, 5, 6] }],
    ['duplicate day', { trainingDays: [0, 0, 2] }],
    ['day out of range', { trainingDays: [0, 7] }],
    ['fractional day', { trainingDays: [0, 1.5] }],
    ['no equipment', { equipment: [] }],
    ['unknown equipment', { equipment: ['jetpack'] }],
    ['experience', { experience: 'god' }],
    ['limitation', { limitations: ['everything'] }],
    ['minutes', { sessionMinutes: 5 }],
    ['height', { heightCm: 20 }],
    ['weight NaN', { weightKg: Number.NaN }],
    ['weight negative', { weightKg: -70 }],
  ])('rejects %s', (_name, patch) => {
    expect(() => validateTrainingProfile({ ...base, ...(patch as object) } as TrainingProfileInput)).toThrow(RangeError);
  });
});

describe('program generation and validation', () => {
  it('5 days -> PPLPP with honest legs-once exposure; every exercise is available', () => {
    const facts = validateTrainingProfile(base);
    const { program } = generateProgram(facts);
    expect(program.days.map((d) => d.title)).toEqual(['İtiş A', 'Çekiş A', 'Bacak', 'İtiş B', 'Çekiş B']);
    expect(program.days.map((d) => d.weekday)).toEqual([0, 1, 2, 4, 5]);
    expect(weeklyExposure(program)).toEqual({ push: 2, pull: 2, legs: 1 });
    expect(() => validateProgram(program, facts)).not.toThrow();
    expect(program.days.every((d) => d.exercises.every((e) => e.targetRir === 2 && e.sets === 3))).toBe(true);
  });

  it('respects equipment and declared limitations (never generates a restricted movement)', () => {
    const facts = validateTrainingProfile({ ...base, equipment: ['barbell', 'dumbbell', 'bench'], limitations: ['spinal-loading', 'overhead'] });
    const { program } = generateProgram(facts);
    const all = program.days.flatMap((d) => d.exercises.map((e) => exerciseById(e.exerciseId)!));
    expect(all.every((e) => !e.restrictedBy.some((l) => facts.limitations.includes(l)))).toBe(true);
    expect(all.every((e) => e.equipment.every((q) => facts.equipment.includes(q)))).toBe(true);
    expect(all.map((e) => e.id)).not.toContain('bb-back-squat');
  });

  it('bodyweight-only users still get a program; beginners get fewer sets; short sessions fewer exercises', () => {
    const facts = validateTrainingProfile({ ...base, equipment: ['bodyweight'], experience: 'beginner', sessionMinutes: 30, trainingDays: [0, 3] });
    const { program, skippedPatterns } = generateProgram(facts);
    expect(program.days).toHaveLength(2);
    expect(program.days.every((d) => d.exercises.length >= 1 && d.exercises.length <= 4)).toBe(true);
    expect(program.days.every((d) => d.exercises.every((e) => e.sets === 2))).toBe(true);
    expect(skippedPatterns).toContain('vertical-pull');
  });

  it('exhaustive: every equipment × limitation × day-count combination yields a valid program with no empty day', () => {
    const eq = ['barbell', 'dumbbell', 'bench', 'machine', 'cable', 'pullup-bar', 'bands', 'bodyweight'] as const;
    const lim = ['overhead', 'spinal-loading', 'deep-knee-flexion', 'wrist-loading'] as const;
    const days = [[0, 3], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 4, 5], [0, 1, 2, 3, 4, 5]];
    let checked = 0;
    for (let em = 1; em < 1 << eq.length; em++) {
      for (let lm = 0; lm < 1 << lim.length; lm++) {
        for (const d of days) {
          const facts = validateTrainingProfile({
            ...base,
            trainingDays: d,
            equipment: eq.filter((_, i) => em & (1 << i)),
            limitations: lim.filter((_, i) => lm & (1 << i)),
          });
          const { program } = generateProgram(facts);
          expect(() => validateProgram(program, facts)).not.toThrow();
          checked++;
        }
      }
    }
    expect(checked).toBe(255 * 16 * 5);
  });

  it('day ids are stable per template occurrence', () => {
    const ids = generateProgram(validateTrainingProfile(base)).program.days.map((d) => d.id);
    expect(ids).toEqual(['push-1', 'pull-1', 'legs-1', 'push-2', 'pull-2']);
    expect(generateProgram(validateTrainingProfile({ ...base, trainingDays: [1, 3] })).program.days.map((d) => d.id)).toEqual(['full-a-1', 'full-b-1']);
  });

  it('strength goal uses lower rep ranges for compound lifts', () => {
    const facts = validateTrainingProfile({ ...base, goal: 'strength' });
    const first = generateProgram(facts).program.days[0].exercises[0];
    expect([first.repMin, first.repMax]).toEqual([5, 8]);
  });

  it('rejects invalid edits with a specific code', () => {
    const facts = validateTrainingProfile(base);
    const p = generateProgram(facts).program;
    const cases: [string, (q: typeof p) => void][] = [
      ['sets', (q) => void (q.days[0].exercises[0].sets = 0)],
      ['sets', (q) => void (q.days[0].exercises[0].sets = 2.5)],
      ['reps', (q) => void (q.days[0].exercises[0].repMax = 0)],
      ['rir', (q) => void (q.days[0].exercises[0].targetRir = 9)],
      ['duplicate-weekday', (q) => void (q.days[1].weekday = q.days[0].weekday)],
      ['exercise-count', (q) => void (q.days[0].exercises = [])],
      ['unknown-exercise', (q) => void (q.days[0].exercises[0].exerciseId = 'nope')],
      ['duplicate-exercise', (q) => void q.days[0].exercises.push({ ...q.days[0].exercises[0] })],
      ['title', (q) => void (q.days[0].title = '   ')],
      ['day-count', (q) => void (q.days = [])],
    ];
    for (const [code, mutate] of cases) {
      const q = structuredClone(p);
      mutate(q);
      expect(() => validateProgram(q, facts), code).toThrow(expect.objectContaining({ code }) as ProgramError);
    }
    const restricted = validateTrainingProfile({ ...base, limitations: ['overhead'] });
    expect(() => validateProgram(p, restricted)).toThrow(expect.objectContaining({ code: 'unavailable-exercise' }) as ProgramError);
  });

  it('diff describes weekday, prescription, added and removed changes', () => {
    const facts = validateTrainingProfile(base);
    const a = generateProgram(facts).program;
    const b = structuredClone(a);
    b.days[0].weekday = 3;
    b.days[0].exercises[0].sets = 4;
    b.days[1].exercises.pop();
    b.days.push({ id: 'x', title: 'Ek', weekday: 6, exercises: [{ exerciseId: 'dead-bug', sets: 2, repMin: 8, repMax: 12, targetRir: null }] });
    expect(diffPrograms(a, b).map((c) => c.kind).sort()).toEqual(['day-added', 'exercise-removed', 'prescription', 'weekday']);
    expect(diffPrograms(a, a)).toEqual([]);
  });

  it('alternatives keep the movement pattern and respect equipment/limitations', () => {
    const alts = alternativesFor('bb-bench-press', ['dumbbell', 'bench', 'bodyweight'], ['wrist-loading']);
    expect(alts.map((e) => e.id)).toEqual(['db-bench-press']);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });
});

describe('weekly schedule', () => {
  it('date helpers use Monday-based local weeks', () => {
    expect(weekdayOf('2026-11-09')).toBe(0);
    expect(weekdayOf('2026-11-15')).toBe(6);
    expect(weekStartOf('2026-11-15')).toBe('2026-11-09');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30'); // EU DST weekend
    expect(() => weekStartOf('2026-02-30')).toThrow();
  });

  it('builds states; missed sessions are not carried forward', () => {
    const { program } = generateProgram(validateTrainingProfile(base));
    const week = buildWeek(program, '2026-11-09', [], [{ id: 's1', scheduleSlotId: '2026-11-09:push-1', status: 'finished' }], '2026-11-11');
    expect(week.map((w) => w.state)).toEqual(['done', 'missed', 'planned', 'planned', 'planned']);
    expect(week.filter((w) => w.date >= '2026-11-16')).toHaveLength(0);
  });

  it('move validation', () => {
    const { program } = generateProgram(validateTrainingProfile(base));
    const week = buildWeek(program, '2026-11-09', [], [], '2026-11-10');
    expect(validateMove(week, '2026-11-09:pull-1', '2026-11-12', '2026-11-10')).toBeNull();
    expect(validateMove(week, '2026-11-09:pull-1', '2026-11-11', '2026-11-10')).toBe('occupied');
    expect(validateMove(week, '2026-11-09:push-1', '2026-11-09', '2026-11-10')).toBe('in-past');
    expect(validateMove(week, '2026-11-09:push-1', '2026-11-17', '2026-11-10')).toBe('outside-week');
    expect(validateMove(week, '2026-11-09:zz', '2026-11-12', '2026-11-10')).toBe('unknown-session');
    const done = buildWeek(program, '2026-11-09', [], [{ id: 's', scheduleSlotId: '2026-11-09:pull-1', status: 'finished' }], '2026-11-10');
    expect(validateMove(done, '2026-11-09:pull-1', '2026-11-12', '2026-11-10')).toBe('not-movable');
  });
});

describe('set logging rules', () => {
  const ok = { exerciseId: 'x', kind: 'work' as const, reps: 10, load: 22.5, unit: 'kg' as const, rir: 2 };
  it('accepts valid sets, zero load and missing RIR (null, not 0)', () => {
    expect(validateSet(ok)).toEqual(ok);
    expect(validateSet({ ...ok, load: 0, rir: null }).rir).toBeNull();
    expect(validateSet({ ...ok, load: 0.1 + 0.2 }).load).toBe(0.3);
  });
  it.each([
    { reps: -1 }, { reps: 0 }, { reps: 1.5 }, { reps: 101 }, { load: -1 }, { load: Number.NaN }, { load: Number.POSITIVE_INFINITY },
    { load: 1001 }, { rir: -1 }, { rir: 11 }, { rir: 1.5 }, { unit: 'stone' }, { kind: 'drop' }, { exerciseId: '' },
  ])('rejects %o', (patch) => {
    expect(() => validateSet({ ...ok, ...(patch as object) } as typeof ok)).toThrow(RangeError);
  });
  it('parses Turkish decimal comma; garbage is NaN; empty is null', () => {
    expect(parseDecimal('22,5')).toBe(22.5);
    expect(parseDecimal(' 40 ')).toBe(40);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('4o')).toBeNaN();
    expect(parseDecimal('-5')).toBeNaN();
  });
  it('warm-up sets never count as work sets', () => {
    expect(summarizeSets([{ exerciseId: 'a', kind: 'warmup' }, { exerciseId: 'a', kind: 'work' }, { exerciseId: 'b', kind: 'warmup' }])).toEqual({
      workSets: 1,
      warmupSets: 2,
      byExercise: { a: { work: 1, warmup: 1 }, b: { work: 0, warmup: 1 } },
    });
  });
});
