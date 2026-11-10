/// <reference types="node" />
/**
 * M3 Gelişim: pure series/continuity/measurement rules and ProgressService on
 * both real adapters. Synthetic values only. 2026-11-09 is a Monday;
 * generated PPLPP: Mon push-1, Tue pull-1, Wed legs-1, Fri push-2, Sat pull-2.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AvciRepository } from '@/data/types';
import { buildContinuity, isPositiveKind } from '@/domain/progress/continuity';
import { groupMeasurements, validateMeasurement } from '@/domain/progress/measurements';
import { buildExerciseSeries, seriesKey, type SeriesSessionInput } from '@/domain/progress/series';
import { DRAFT_TRAINING_PROFILE } from '@/domain/training/profile';
import type { SetInput } from '@/domain/training/workout';
import { AvciService } from '@/services/avci-service';
import { ProgressService } from '@/services/progress-service';
import { continuitySummaryText, measurementErrorText, seriesUnitLabel } from '@/ui/progress/progress-labels';

import { backends, FakeClock, goodCheckin } from './helpers';

const set = (
  exerciseId: string,
  kind: 'work' | 'warmup',
  load: number,
  reps: number,
  unit: 'kg' | 'lb' = 'kg',
  loadConvention: 'total' | 'per-dumbbell' | 'bodyweight' | 'band' = 'total',
) => ({ exerciseId, kind, load, reps, unit, loadConvention });

describe('series builder (pure)', () => {
  const sessions: SeriesSessionInput[] = [
    {
      sessionId: 's2',
      date: '2026-11-13',
      sets: [
        set('bench', 'warmup', 95, 10, 'lb'),
        set('bench', 'work', 135, 10, 'lb'),
        set('bench', 'work', 135, 9, 'lb'),
        set('press', 'work', 44, 10, 'lb', 'per-dumbbell'),
      ],
    },
    {
      sessionId: 's1',
      date: '2026-11-09',
      sets: [
        set('bench', 'warmup', 100, 10), // heavier warm-up must not become the top load
        set('bench', 'work', 60, 12),
        set('bench', 'work', 62.5, 8),
        set('bench', 'work', 62.5, 10),
        set('press', 'work', 20, 10, 'kg', 'per-dumbbell'),
        set('press', 'work', 40, 6, 'kg', 'total'),
      ],
    },
    { sessionId: 's0', date: '2026-11-02', sets: [set('bench', 'work', 57.5, 12)] },
  ];
  const series = buildExerciseSeries(sessions);
  const byKey = new Map(series.map((s) => [s.key, s]));

  it('never merges kg with lb or total with per-dumbbell', () => {
    expect([...byKey.keys()].sort()).toEqual(
      ['bench|kg|total', 'bench|lb|total', 'press|kg|per-dumbbell', 'press|kg|total', 'press|lb|per-dumbbell'].sort(),
    );
    for (const s of series) {
      expect(s.key).toBe(seriesKey(s));
    }
    expect(byKey.get('press|kg|per-dumbbell')!.points.map((p) => p.topLoad)).toEqual([20]);
    expect(byKey.get('press|kg|total')!.points.map((p) => p.topLoad)).toEqual([40]);
    expect(byKey.get('press|lb|per-dumbbell')!.points.map((p) => p.topLoad)).toEqual([44]);
    expect(seriesUnitLabel(byKey.get('press|kg|per-dumbbell')!)).toBe('kg · dambıl başına');
    expect(seriesUnitLabel(byKey.get('bench|lb|total')!)).toBe('lb · toplam yük');
  });

  it('excludes warm-ups from work values but counts them separately; dates ascend', () => {
    const kg = byKey.get('bench|kg|total')!;
    expect(kg.points.map((p) => p.date)).toEqual(['2026-11-02', '2026-11-09']);
    const nov9 = kg.points[1];
    expect(nov9).toMatchObject({ topLoad: 62.5, repsAtTop: 10, bestReps: 12, workSets: 3, warmupSets: 1 });
    expect(nov9.volume).toBe(60 * 12 + 62.5 * 8 + 62.5 * 10);
    expect(kg.warmupSetsTotal).toBe(1);
    const lb = byKey.get('bench|lb|total')!;
    expect(lb.points).toHaveLength(1);
    expect(lb.points[0]).toMatchObject({ topLoad: 135, repsAtTop: 10, workSets: 2, warmupSets: 1 });
    expect(lb.metric).toBe('load');
  });

  it('a warm-up-only series has no points; same-date sessions merge into one dated point', () => {
    const only = buildExerciseSeries([{ sessionId: 'a', date: '2026-11-09', sets: [set('x', 'warmup', 20, 10)] }]);
    expect(only).toHaveLength(1);
    expect(only[0].points).toEqual([]);
    expect(only[0].warmupSetsTotal).toBe(1);
    const merged = buildExerciseSeries([
      { sessionId: 'b', date: '2026-11-09', sets: [set('x', 'work', 20, 10)] },
      { sessionId: 'a', date: '2026-11-09', sets: [set('x', 'work', 22, 8)] },
    ]);
    expect(merged[0].points).toHaveLength(1);
    expect(merged[0].points[0]).toMatchObject({ topLoad: 22, repsAtTop: 8, workSets: 2, sessionIds: ['a', 'b'] });
  });

  it('zero-load bodyweight and band series chart reps, band has no volume', () => {
    const s = buildExerciseSeries([
      {
        sessionId: 'a',
        date: '2026-11-09',
        sets: [set('pu', 'work', 0, 8, 'kg', 'bodyweight'), set('band', 'work', 0, 15, 'kg', 'band')],
      },
    ]);
    for (const x of s) {
      expect(x.metric).toBe('reps');
      expect(x.points[0].volume).toBeNull();
    }
    expect(buildExerciseSeries([])).toEqual([]);
  });
});

describe('continuity (pure)', () => {
  // Today = Saturday 2026-11-14.
  const today = '2026-11-14';
  const view = buildContinuity(
    today,
    [
      { localDate: '2026-11-09', coreResolution: 'training' },
      { localDate: '2026-11-10', coreResolution: 'recovery' },
      { localDate: '2026-11-11', coreResolution: null },
      { localDate: '2026-11-12', coreResolution: 'illness-recovery' },
      { localDate: '2026-11-13', coreResolution: 'recovery' },
      { localDate: '2026-11-14', coreResolution: null },
      { localDate: '2026-10-01', coreResolution: 'training' }, // outside the window
    ],
    ['2026-11-13', '2026-11-05'],
  );
  const kind = (d: string) => view.cells.find((c) => c.date === d)?.kind;

  it('classifies training, recovery, illness recovery, open, no record, today and future', () => {
    expect(kind('2026-11-09')).toBe('training');
    expect(kind('2026-11-10')).toBe('recovery');
    expect(kind('2026-11-11')).toBe('not-completed');
    expect(kind('2026-11-12')).toBe('illness-recovery');
    expect(kind('2026-11-13')).toBe('training'); // a finished workout is training even if the core was resolved otherwise
    expect(kind('2026-11-05')).toBe('training'); // finished workout without a completed core
    expect(kind('2026-11-08')).toBe('no-record');
    expect(kind('2026-11-14')).toBe('today-open');
    expect(view.cells.find((c) => c.date === today)!.isToday).toBe(true);
    expect(kind('2026-11-15')).toBe('future');
  });

  it('covers exactly 28 days, pads the week, and counts recovery as positively as training', () => {
    const inWindow = view.cells.filter((c) => c.inWindow);
    expect(inWindow).toHaveLength(28);
    expect(inWindow[0].date).toBe('2026-10-18');
    expect(view.cells[view.cells.length - 1].date).toBe('2026-11-15'); // Sunday
    expect(view.leadingBlanks).toBe(6); // 2026-10-18 is a Sunday
    expect((view.leadingBlanks + view.cells.length) % 7).toBe(0);
    expect(kind('2026-10-01')).toBeUndefined();
    expect(view.summary).toEqual({ windowDays: 28, training: 3, recovery: 1, illnessRecovery: 1, activeDays: 5 });
    expect(isPositiveKind('recovery')).toBe(isPositiveKind('training'));
    expect(isPositiveKind('not-completed')).toBe(false);
    expect(continuitySummaryText(view.summary)).toBe(
      'Son 28 gün: 3 antrenman, 1 planlı toparlanma, 1 hastalık/ağrı toparlanması.',
    );
    expect(continuitySummaryText(view.summary)).not.toMatch(/borç|kaçır|seri/i);
  });

  it('a completed task day wins over an open one on the same date', () => {
    const v = buildContinuity('2026-11-14', [
      { localDate: '2026-11-13', coreResolution: null },
      { localDate: '2026-11-13', coreResolution: 'recovery' },
    ], []);
    expect(v.cells.find((c) => c.date === '2026-11-13')!.kind).toBe('recovery');
  });
});

describe('measurement validation (pure)', () => {
  const today = '2026-11-09';
  const v = (type: string, unit: string, valueText: string, measuredOn = today) =>
    validateMeasurement({ type, unit, valueText, measuredOn }, today);

  it('accepts a Turkish decimal comma and rounds to two decimals', () => {
    expect(v('body-weight', 'kg', '72,5')).toEqual({ ok: true, value: { type: 'body-weight', unit: 'kg', value: 72.5, measuredOn: today } });
    expect(v('waist', 'cm', '81.256')).toMatchObject({ ok: true, value: { value: 81.26 } });
  });

  it('restricts units per type', () => {
    expect(v('body-weight', 'cm', '70')).toEqual({ ok: false, errors: { unit: 'unit' } });
    expect(v('waist', 'kg', '80')).toEqual({ ok: false, errors: { unit: 'unit' } });
    expect(v('arm', 'in', '14')).toMatchObject({ ok: true });
    expect(v('bmi', 'kg', '20')).toMatchObject({ ok: false, errors: { type: 'type' } });
  });

  it('enforces plausible ranges per unit', () => {
    expect(v('body-weight', 'kg', '19,9')).toMatchObject({ ok: false, errors: { value: 'value-range' } });
    expect(v('body-weight', 'kg', '20')).toMatchObject({ ok: true });
    expect(v('body-weight', 'kg', '400')).toMatchObject({ ok: true });
    expect(v('body-weight', 'kg', '401')).toMatchObject({ ok: false, errors: { value: 'value-range' } });
    expect(v('body-weight', 'lb', '43')).toMatchObject({ ok: false, errors: { value: 'value-range' } });
    expect(v('body-weight', 'lb', '880')).toMatchObject({ ok: true });
    expect(v('thigh', 'cm', '9')).toMatchObject({ ok: false, errors: { value: 'value-range' } });
    expect(v('thigh', 'cm', '300')).toMatchObject({ ok: true });
    expect(v('hip', 'in', '121')).toMatchObject({ ok: false, errors: { value: 'value-range' } });
    expect(v('hip', 'in', '4')).toMatchObject({ ok: true });
    expect(v('chest', 'cm', '')).toMatchObject({ ok: false, errors: { value: 'value-missing' } });
    expect(v('chest', 'cm', '9O')).toMatchObject({ ok: false, errors: { value: 'value-format' } });
    expect(v('chest', 'cm', '-90')).toMatchObject({ ok: false, errors: { value: 'value-format' } });
  });

  it('rejects future, malformed and pre-2000 dates', () => {
    expect(v('waist', 'cm', '80', '2026-11-10')).toMatchObject({ ok: false, errors: { date: 'date-future' } });
    expect(v('waist', 'cm', '80', '2026-02-30')).toMatchObject({ ok: false, errors: { date: 'date-format' } });
    expect(v('waist', 'cm', '80', '09.11.2026')).toMatchObject({ ok: false, errors: { date: 'date-format' } });
    expect(v('waist', 'cm', '80', '1999-12-31')).toMatchObject({ ok: false, errors: { date: 'date-too-old' } });
    expect(v('waist', 'cm', '80', '2000-01-01')).toMatchObject({ ok: true });
  });

  it('has Turkish messages for every error', () => {
    expect(measurementErrorText('value-range', 'kg')).toBe('Değer 20–400 kg aralığında olmalı. Yazım hatası olabilir mi?');
    expect(measurementErrorText('date-future', null)).toBe('Gelecekteki bir tarih girilemez.');
  });

  it('groups by type+unit without merging, newest first, one trend value per date', () => {
    const m = (id: string, type: 'body-weight' | 'waist', unit: 'kg' | 'lb' | 'cm', value: number, measuredOn: string, recordedAt: string, deletedAt: string | null = null) =>
      ({ id, type, unit, value, measuredOn, recordedAt, deletedAt });
    const groups = groupMeasurements([
      m('a', 'body-weight', 'kg', 80, '2026-11-01', '2026-11-01T08:00:00Z'),
      m('b', 'body-weight', 'lb', 176, '2026-11-02', '2026-11-02T08:00:00Z'),
      m('c', 'body-weight', 'kg', 79.5, '2026-11-08', '2026-11-08T08:00:00Z'),
      m('d', 'body-weight', 'kg', 79.8, '2026-11-08', '2026-11-08T09:00:00Z'),
      m('e', 'body-weight', 'kg', 70, '2026-11-09', '2026-11-09T08:00:00Z', '2026-11-09T09:00:00Z'),
      m('f', 'waist', 'cm', 82, '2026-11-08', '2026-11-08T08:00:00Z'),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['body-weight|kg', 'body-weight|lb', 'waist|cm']);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['d', 'c', 'a']);
    expect(groups[0].trend).toEqual([
      { date: '2026-11-01', value: 80 },
      { date: '2026-11-08', value: 79.8 },
    ]);
  });
});

function ok<T>(r: { status: 'ok'; value: T } | { status: 'rejected'; reason: string }): T {
  if (r.status !== 'ok') throw new Error(`expected ok, got ${r.reason}`);
  return r.value;
}
const morning = (date: string) => `${date}T07:00:00Z`;

describe.each(backends)('ProgressService ($name)', (backend) => {
  let repo: AvciRepository;
  let clock: FakeClock;
  let service: AvciService;
  let progress: ProgressService;

  const restart = async () => {
    await repo.close();
    repo = await backend.open();
    service = new AvciService(repo, clock);
    progress = new ProgressService(repo, clock);
  };
  const train = async (date: string, sets: SetInput[]) => {
    clock.set(morning(date));
    const t0 = await service.loadToday();
    await service.recordCheckin(t0.today!.id, goodCheckin);
    const t = await service.loadTraining();
    const slot = t.week.find((w) => w.date === date)!;
    const s = ok(await service.startWorkout(slot.slotId));
    for (const x of sets) ok(await service.logSet(s.id, x));
    return s.id;
  };

  beforeEach(async () => {
    backend.setup();
    clock = new FakeClock(new Date(morning('2026-11-09')));
    repo = await backend.open();
    service = new AvciService(repo, clock);
    progress = new ProgressService(repo, clock);
  });
  afterEach(async () => {
    await repo.close();
    backend.teardown();
  });

  it('empty database: no history, no series, neutral continuity', async () => {
    const p = await progress.loadProgress();
    expect(p).toMatchObject({ hasProfile: false, today: '2026-11-09', history: [], series: [], measurements: [] });
    expect(p.continuity.summary.activeDays).toBe(0);
    expect(p.continuity.cells.find((c) => c.date === '2026-11-09')!.kind).toBe('today-open');
  });

  it('builds history, separate series and continuity from real logged workouts', async () => {
    await service.createProfile({});
    ok(await service.confirmTrainingProfile(DRAFT_TRAINING_PROFILE));
    const prop = ok(await service.proposeGeneratedProgram());
    ok(await service.acceptProgram({ baseVersionId: null, program: prop.program, source: 'generated' }));

    // Monday: kg, total bench + per-dumbbell shoulder press, with a warm-up.
    const mon = await train('2026-11-09', [
      { exerciseId: 'bb-bench-press', kind: 'warmup', reps: 10, load: 40, unit: 'kg', rir: null },
      { exerciseId: 'bb-bench-press', kind: 'work', reps: 12, load: 60, unit: 'kg', rir: 2 },
      { exerciseId: 'bb-bench-press', kind: 'work', reps: 10, load: 62.5, unit: 'kg', rir: 2 },
      { exerciseId: 'db-shoulder-press', kind: 'work', reps: 10, load: 20, unit: 'kg', rir: null },
    ]);
    ok(await service.finishWorkout(mon));

    // Tuesday: planned recovery instead of the pull session.
    clock.set(morning('2026-11-10'));
    const tue = await service.loadToday();
    await service.recordCheckin(tue.today!.id, goodCheckin);
    expect((await service.completeCore(tue.today!.id, 'recovery')).status).toBe('awarded');

    // Wednesday: opened, nothing completed. Thursday: not opened.
    clock.set(morning('2026-11-11'));
    await service.loadToday();

    // Friday: same bench in lb.
    const fri = await train('2026-11-13', [
      { exerciseId: 'bb-bench-press', kind: 'warmup', reps: 8, load: 95, unit: 'lb', rir: null },
      { exerciseId: 'bb-bench-press', kind: 'work', reps: 10, load: 135, unit: 'lb', rir: 2 },
    ]);
    ok(await service.finishWorkout(fri));

    // Saturday: an abandoned workout stays out of history and charts.
    const sat = await train('2026-11-14', [{ exerciseId: 'bb-row', kind: 'work', reps: 10, load: 50, unit: 'kg', rir: 2 }]);
    ok(await service.abandonWorkout(sat));

    await restart();
    const p = await progress.loadProgress();
    expect(p.hasProfile).toBe(true);
    expect(p.today).toBe('2026-11-14');

    expect(p.history.map((h) => [h.date, h.workSets, h.warmupSets])).toEqual([
      ['2026-11-13', 1, 1],
      ['2026-11-09', 3, 1],
    ]);
    expect(p.history[1].exercises.map((e) => [e.exerciseId, e.workSets, e.warmupSets])).toEqual([
      ['bb-bench-press', 2, 1],
      ['db-shoulder-press', 1, 0],
    ]);
    expect(p.history[1].exercises[0].sets.map((s) => s.kind)).toEqual(['warmup', 'work', 'work']);
    expect(p.history.some((h) => h.sessionId === sat)).toBe(false);

    const keys = p.series.map((s) => s.key).sort();
    expect(keys).toEqual(['bb-bench-press|kg|total', 'bb-bench-press|lb|total', 'db-shoulder-press|kg|per-dumbbell']);
    const kg = p.series.find((s) => s.key === 'bb-bench-press|kg|total')!;
    expect(kg.points).toEqual([
      expect.objectContaining({ date: '2026-11-09', topLoad: 62.5, repsAtTop: 10, workSets: 2, warmupSets: 1 }),
    ]);
    const lb = p.series.find((s) => s.key === 'bb-bench-press|lb|total')!;
    expect(lb.points).toEqual([expect.objectContaining({ date: '2026-11-13', topLoad: 135, workSets: 1, warmupSets: 1 })]);
    expect(p.series.some((s) => s.exerciseId === 'bb-row')).toBe(false);

    const kind = (d: string) => p.continuity.cells.find((c) => c.date === d)!.kind;
    expect(kind('2026-11-09')).toBe('training');
    expect(kind('2026-11-10')).toBe('recovery');
    expect(kind('2026-11-11')).toBe('not-completed');
    expect(kind('2026-11-12')).toBe('no-record');
    expect(kind('2026-11-13')).toBe('training');
    expect(kind('2026-11-14')).toBe('today-open');
    expect(kind('2026-11-15')).toBe('future');
    expect(p.continuity.summary).toMatchObject({ training: 2, recovery: 1, illnessRecovery: 0, activeDays: 3 });
  });

  it('measurements: add/delete persist across restart; deleted ones disappear; invalid input writes nothing', async () => {
    const a = await progress.addMeasurement({ type: 'body-weight', unit: 'kg', valueText: '72,5', measuredOn: '2026-11-08' });
    const b = await progress.addMeasurement({ type: 'body-weight', unit: 'lb', valueText: '160', measuredOn: '2026-11-09' });
    const c = await progress.addMeasurement({ type: 'waist', unit: 'cm', valueText: '81', measuredOn: '2026-11-09' });
    expect([a.status, b.status, c.status]).toEqual(['ok', 'ok', 'ok']);
    expect(await progress.addMeasurement({ type: 'waist', unit: 'cm', valueText: '81', measuredOn: '2026-11-10' })).toEqual({
      status: 'invalid',
      errors: { date: 'date-future' },
    });
    expect(await progress.addMeasurement({ type: 'waist', unit: 'kg', valueText: '81', measuredOn: '2026-11-09' })).toMatchObject({
      status: 'invalid',
    });

    await restart();
    let p = await progress.loadProgress();
    expect(p.measurements.map((m) => [m.type, m.unit, m.value, m.measuredOn])).toEqual([
      ['body-weight', 'lb', 160, '2026-11-09'],
      ['waist', 'cm', 81, '2026-11-09'],
      ['body-weight', 'kg', 72.5, '2026-11-08'],
    ]);
    expect(p.measurementGroups.map((g) => g.key)).toEqual(['body-weight|kg', 'body-weight|lb', 'waist|cm']);

    if (a.status !== 'ok') throw new Error('unreachable');
    expect(await progress.deleteMeasurement(a.value.id)).toEqual({ status: 'deleted' });
    expect(await progress.deleteMeasurement(a.value.id)).toEqual({ status: 'already-deleted' });
    expect(await progress.deleteMeasurement('missing')).toEqual({ status: 'not-found' });

    await restart();
    p = await progress.loadProgress();
    expect(p.measurements.some((m) => m.id === a.value.id)).toBe(false);
    expect(p.measurementGroups.map((g) => g.key)).toEqual(['body-weight|lb', 'waist|cm']);
    // The tombstone is kept in storage (not resurrected, not hard-deleted).
    const raw = await repo.transaction((tx) => tx.listMeasurements());
    expect(raw.find((m) => m.id === a.value.id)!.deletedAt).not.toBeNull();
  });
});
