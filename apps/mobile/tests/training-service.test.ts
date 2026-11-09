/// <reference types="node" />
/**
 * M1 against both real persistence adapters: confirmed training profile ->
 * accepted program -> week -> move -> workout log -> interrupt/restart ->
 * resume -> finish linked to the single daily-core reward.
 * 2026-11-09 is a Monday.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AvciRepository } from '@/data/types';
import { DRAFT_TRAINING_PROFILE, type TrainingProfileInput } from '@/domain/training/profile';
import type { SetInput } from '@/domain/training/workout';
import { AvciService } from '@/services/avci-service';

import { backends, FakeClock, goodCheckin, illCheckin } from './helpers';

const PROFILE: TrainingProfileInput = { ...DRAFT_TRAINING_PROFILE };
const work = (exerciseId: string, reps = 10, load = 40, rir: number | null = 2): SetInput => ({
  exerciseId, kind: 'work', reps, load, unit: 'kg', rir,
});
const warmup = (exerciseId: string): SetInput => ({ exerciseId, kind: 'warmup', reps: 8, load: 20, unit: 'kg', rir: null });

function ok<T>(r: { status: 'ok'; value: T } | { status: 'rejected'; reason: string }): T {
  if (r.status !== 'ok') throw new Error(`expected ok, got ${r.reason}`);
  return r.value;
}

describe.each(backends)('M1 training ($name)', (backend) => {
  let repo: AvciRepository;
  let clock: FakeClock;
  let service: AvciService;

  const restart = async () => {
    await repo.close();
    repo = await backend.open();
    service = new AvciService(repo, clock);
  };

  /** Profile + confirmed facts + accepted generated PPLPP plan. */
  const setup = async () => {
    await service.createProfile({});
    ok(await service.confirmTrainingProfile(PROFILE));
    const proposal = ok(await service.proposeGeneratedProgram());
    ok(await service.acceptProgram({ baseVersionId: proposal.baseVersionId, program: proposal.program, source: 'generated' }));
    const t = await service.loadTraining();
    return { t, todayId: t.today!.id, todaySlot: t.week.find((w) => w.date === '2026-11-09')!.slotId };
  };

  beforeEach(async () => {
    backend.setup();
    clock = new FakeClock(new Date('2026-11-09T07:00:00Z'));
    repo = await backend.open();
    service = new AvciService(repo, clock);
  });
  afterEach(async () => {
    await repo.close();
    backend.teardown();
  });

  it('training profile: invalid facts are rejected, height/weight are optional', async () => {
    await service.createProfile({});
    expect((await service.confirmTrainingProfile({ ...PROFILE, trainingDays: [1] })).status).toBe('rejected');
    expect((await service.confirmTrainingProfile({ ...PROFILE, equipment: ['spaceship'] })).status).toBe('rejected');
    expect((await service.confirmTrainingProfile({ ...PROFILE, weightKg: Number.NaN })).status).toBe('rejected');
    expect((await service.loadTraining()).trainingProfile).toBeNull();
    const tp = ok(await service.confirmTrainingProfile({ ...PROFILE, heightCm: null, weightKg: null }));
    expect(tp.heightCm).toBeNull();
    await restart();
    expect((await service.loadTraining()).trainingProfile).toMatchObject({ goal: 'muscle', trainingDays: [0, 1, 2, 4, 5] });
  });

  it('no program until the user accepts the previewed proposal', async () => {
    await service.createProfile({});
    ok(await service.confirmTrainingProfile(PROFILE));
    const proposal = ok(await service.proposeGeneratedProgram());
    expect((await service.loadTraining()).plan).toBeNull();
    expect(proposal.baseVersionId).toBeNull();
    const { plan } = ok(await service.acceptProgram({ baseVersionId: null, program: proposal.program, source: 'generated' }));
    expect(plan).toMatchObject({ sequence: 1, parentId: null, source: 'generated' });
    expect((await service.loadTraining()).plan!.id).toBe(plan.id);
  });

  it('PPLPP week: five sessions placed on confirmed weekdays, legs once', async () => {
    const { t } = await setup();
    expect(t.week.map((w) => [w.date, w.title])).toEqual([
      ['2026-11-09', 'İtiş A'],
      ['2026-11-10', 'Çekiş A'],
      ['2026-11-11', 'Bacak'],
      ['2026-11-13', 'İtiş B'],
      ['2026-11-14', 'Çekiş B'],
    ]);
    expect(t.exposure).toEqual({ push: 2, pull: 2, legs: 1 });
    expect(t.planCount).toBe(1);
  });

  it('stale base version cannot overwrite a newer plan', async () => {
    const { t } = await setup();
    const edited = structuredClone(t.plan!.program);
    edited.days[0].exercises[0].sets = 4;
    ok(await service.acceptProgram({ baseVersionId: t.plan!.id, program: edited, source: 'user-edit' }));
    const again = structuredClone(t.plan!.program);
    again.days[0].exercises[0].sets = 2;
    expect(await service.acceptProgram({ baseVersionId: t.plan!.id, program: again, source: 'user-edit' })).toEqual({
      status: 'rejected',
      reason: 'plan-changed',
    });
    const plans = (await service.loadTraining()).planCount;
    expect(plans).toBe(2);
  });

  it('invalid edits are rejected and leave the plan unchanged', async () => {
    const { t } = await setup();
    const bad = structuredClone(t.plan!.program);
    bad.days[0].exercises[0].repMin = 12;
    bad.days[0].exercises[0].repMax = 8;
    expect((await service.acceptProgram({ baseVersionId: t.plan!.id, program: bad, source: 'user-edit' })).status).toBe('rejected');
    const dup = structuredClone(t.plan!.program);
    dup.days[1].weekday = dup.days[0].weekday;
    expect((await service.acceptProgram({ baseVersionId: t.plan!.id, program: dup, source: 'user-edit' })).status).toBe('rejected');
    expect((await service.loadTraining()).plan!.id).toBe(t.plan!.id);
  });

  it('log warm-up and work sets, interrupt, restart, resume, finish -> one core reward linked to the workout', async () => {
    const { t, todayId, todaySlot } = await setup();
    await service.recordCheckin(todayId, goodCheckin);
    const session = ok(await service.startWorkout(todaySlot));
    const ex = session.exercises[0].exerciseId;
    expect(t.plan!.program.days[0].exercises[0].exerciseId).toBe(ex);
    ok(await service.logSet(session.id, warmup(ex)));
    ok(await service.logSet(session.id, work(ex, 10, 40, 2)));
    ok(await service.logSet(session.id, { ...work(ex, 9, 40, null), unit: 'kg' }));

    // App killed mid-workout.
    await restart();
    const resumed = await service.loadTraining();
    expect(resumed.active?.session.id).toBe(session.id);
    expect(resumed.active?.sets.map((x) => [x.kind, x.reps, x.rir])).toEqual([
      ['warmup', 8, null],
      ['work', 10, 2],
      ['work', 9, null],
    ]);
    expect(resumed.active?.summary).toMatchObject({ workSets: 2, warmupSets: 1 });
    expect((await service.loadToday()).training.activeSession?.id).toBe(session.id);
    // Starting again resumes instead of creating a second session.
    expect(ok(await service.startWorkout(todaySlot)).id).toBe(session.id);

    const fin = ok(await service.finishWorkout(session.id));
    expect(fin.reward.status === 'awarded' && fin.reward.entry.awardedXp).toBe(60);
    const today = await service.loadToday();
    const core = today.slots.find((x) => x.slotKey === 'core')!;
    expect(core).toMatchObject({ status: 'completed', resolution: 'training', workoutSessionId: session.id });
    expect(today.progress.totalXp).toBe(70);
    expect(today.training.activeSession).toBeNull();

    // Retry / double finish: no second reward.
    expect(ok(await service.finishWorkout(session.id)).reward.status).toBe('already-completed');
    const after = await service.loadTraining();
    expect(after.week[0].state).toBe('done');
    expect(after.lastPerformance).toEqual({});
    expect((await service.loadToday()).progress.totalXp).toBe(70);
  });

  it('warm-up sets alone cannot finish a workout', async () => {
    const { todaySlot } = await setup();
    const s = ok(await service.startWorkout(todaySlot));
    ok(await service.logSet(s.id, warmup(s.exercises[0].exerciseId)));
    expect(await service.finishWorkout(s.id)).toEqual({ status: 'rejected', reason: 'no-work-sets' });
    expect((await service.loadToday()).progress.totalXp).toBe(0);
  });

  it('invalid set input and exercises outside the session are rejected', async () => {
    const { todaySlot } = await setup();
    const s = ok(await service.startWorkout(todaySlot));
    const ex = s.exercises[0].exerciseId;
    for (const bad of [
      work(ex, -1),
      work(ex, 2.5),
      work(ex, 10, Number.NaN),
      work(ex, 10, -5),
      work(ex, 10, 40, 11),
      { ...work(ex), unit: 'stone' as never },
    ]) {
      expect((await service.logSet(s.id, bad)).status).toBe('rejected');
    }
    expect(await service.logSet(s.id, work('calf-raise'))).toMatchObject({ status: 'rejected', reason: 'exercise-not-in-session' });
    expect((await service.loadTraining()).active!.sets).toHaveLength(0);
  });

  it('per-dumbbell load convention is stored with the set', async () => {
    await service.createProfile({});
    ok(await service.confirmTrainingProfile({ ...PROFILE, equipment: ['dumbbell', 'bench'] }));
    const p = ok(await service.proposeGeneratedProgram());
    ok(await service.acceptProgram({ baseVersionId: null, program: p.program, source: 'generated' }));
    const t = await service.loadTraining();
    const s = ok(await service.startWorkout(t.week[0].slotId));
    expect(s.exercises[0].exerciseId).toBe('db-bench-press');
    const set = ok(await service.logSet(s.id, work('db-bench-press', 10, 22.5)));
    expect(set).toMatchObject({ load: 22.5, unit: 'kg', loadConvention: 'per-dumbbell' });
  });

  it('editing a logged set after finishing changes history, never the reward', async () => {
    const { todaySlot } = await setup();
    const s = ok(await service.startWorkout(todaySlot));
    const set = ok(await service.logSet(s.id, work(s.exercises[0].exerciseId)));
    ok(await service.finishWorkout(s.id));
    const edited = ok(await service.updateSet(set.id, { kind: 'work', reps: 12, load: 42.5, unit: 'kg', rir: 1 }));
    expect(edited).toMatchObject({ reps: 12, load: 42.5, rir: 1 });
    expect((await service.loadToday()).progress.totalXp).toBe(60);
    // Deleting is only allowed while the workout is in progress.
    expect((await service.deleteSet(set.id)).status).toBe('rejected');
  });

  it('illness today blocks starting structured training; recovery stays available', async () => {
    const { todayId, todaySlot } = await setup();
    await service.recordCheckin(todayId, illCheckin);
    expect(await service.startWorkout(todaySlot)).toEqual({ status: 'rejected', reason: 'illness' });
    expect((await service.completeCore(todayId, 'illness-recovery')).status).toBe('awarded');
  });

  it('illness reported during a workout: log is kept, training reward refused, recovery possible', async () => {
    const { todayId, todaySlot } = await setup();
    await service.recordCheckin(todayId, goodCheckin);
    const s = ok(await service.startWorkout(todaySlot));
    ok(await service.logSet(s.id, work(s.exercises[0].exerciseId)));
    await service.recordCheckin(todayId, illCheckin);
    const fin = ok(await service.finishWorkout(s.id));
    expect(fin.session.status).toBe('finished');
    expect(fin.reward).toEqual({ status: 'rejected', reason: 'illness' });
    expect((await service.completeCore(todayId, 'illness-recovery')).status).toBe('awarded');
    expect((await service.loadToday()).progress.totalXp).toBe(70);
  });

  it('recovery chosen first, then a workout: the workout is saved but no second reward', async () => {
    const { todayId, todaySlot } = await setup();
    await service.completeCore(todayId, 'recovery');
    const s = ok(await service.startWorkout(todaySlot));
    ok(await service.logSet(s.id, work(s.exercises[0].exerciseId)));
    expect(ok(await service.finishWorkout(s.id)).reward.status).toBe('already-completed');
    const today = await service.loadToday();
    expect(today.slots.find((x) => x.slotKey === 'core')).toMatchObject({ resolution: 'recovery', workoutSessionId: null });
    expect(today.progress.totalXp).toBe(60);
  });

  it('plan or schedule changes after finishing do not create a second reward', async () => {
    const { t, todayId, todaySlot } = await setup();
    const s = ok(await service.startWorkout(todaySlot));
    ok(await service.logSet(s.id, work(s.exercises[0].exerciseId)));
    ok(await service.finishWorkout(s.id));

    // Same day: move "Çekiş A" from Tuesday to today is refused (today is occupied by the done session).
    const pull = t.week.find((w) => w.title === 'Çekiş A')!;
    expect(await service.moveSession(pull.slotId, '2026-11-09')).toMatchObject({ status: 'rejected', reason: 'occupied' });
    // Edit the plan so a NEW day lands on today; doing it grants nothing more.
    const edited = structuredClone(t.plan!.program);
    edited.days[0].weekday = 3; // İtiş A -> Thursday (already done this week, stays done)
    edited.days.push({ id: 'extra', title: 'Ek gün', weekday: 0, exercises: [{ exerciseId: 'dead-bug', sets: 2, repMin: 8, repMax: 12, targetRir: null }] });
    ok(await service.acceptProgram({ baseVersionId: t.plan!.id, program: edited, source: 'user-edit' }));
    const t2 = await service.loadTraining();
    expect(t2.week.find((w) => w.programDayId === 'push-1')).toMatchObject({ state: 'done', date: '2026-11-12' });
    const extraSlot = t2.week.find((w) => w.programDayId === 'extra')!.slotId;
    const s2 = ok(await service.startWorkout(extraSlot));
    ok(await service.logSet(s2.id, work('dead-bug', 10, 0, null)));
    expect(ok(await service.finishWorkout(s2.id)).reward.status).toBe('already-completed');
    expect(await service.startWorkout(t2.week.find((w) => w.programDayId === 'push-1')!.slotId)).toEqual({
      status: 'rejected',
      reason: 'already-done',
    });
    expect((await service.loadToday()).progress.totalXp).toBe(60);
    expect(todayId).toBe((await service.loadToday()).today!.id);
  });

  it('plan edits during a workout do not rewrite the session snapshot', async () => {
    const { t, todaySlot } = await setup();
    const s = ok(await service.startWorkout(todaySlot));
    const edited = structuredClone(t.plan!.program);
    edited.days[0].exercises[0].sets = 5;
    ok(await service.acceptProgram({ baseVersionId: t.plan!.id, program: edited, source: 'user-edit' }));
    expect((await service.loadTraining()).active!.session.exercises[0].sets).toBe(s.exercises[0].sets);
  });

  it('moving a session: validation and persistence', async () => {
    const { t } = await setup();
    const pull = t.week.find((w) => w.title === 'Çekiş A')!;
    expect(await service.moveSession(pull.slotId, '2026-11-16')).toMatchObject({ reason: 'outside-week' });
    expect(await service.moveSession(pull.slotId, '2026-11-11')).toMatchObject({ reason: 'occupied' });
    expect(await service.moveSession(pull.slotId, 'yarın')).toMatchObject({ reason: 'outside-week' });
    const week = ok(await service.moveSession(pull.slotId, '2026-11-12'));
    expect(week.find((w) => w.slotId === pull.slotId)).toMatchObject({ date: '2026-11-12', moved: true });
    await restart();
    clock.set('2026-11-12T07:00:00Z');
    const t2 = await service.loadTraining();
    expect(t2.week.find((w) => w.slotId === pull.slotId)).toMatchObject({ date: '2026-11-12', state: 'planned' });
    // Missed Monday session: no debt, can be moved to a free future day, not into the past.
    const mon = t2.week.find((w) => w.title === 'İtiş A')!;
    expect(mon.state).toBe('missed');
    expect(await service.moveSession(mon.slotId, '2026-11-10')).toMatchObject({ reason: 'in-past' });
    ok(await service.moveSession(mon.slotId, '2026-11-15'));
    // The moved Tuesday session can be started on Thursday.
    expect((await service.startWorkout(pull.slotId)).status).toBe('ok');
  });

  it('a session can only be started on its (moved) date', async () => {
    const { t } = await setup();
    const pull = t.week.find((w) => w.title === 'Çekiş A')!;
    expect(await service.startWorkout(pull.slotId)).toEqual({ status: 'rejected', reason: 'not-today' });
  });

  it('a workout started yesterday and finished today keeps the log but grants no reward', async () => {
    const { todaySlot } = await setup();
    const s = ok(await service.startWorkout(todaySlot));
    ok(await service.logSet(s.id, work(s.exercises[0].exerciseId)));
    clock.set('2026-11-10T07:00:00Z');
    const t = await service.loadTraining();
    expect(t.active?.session.id).toBe(s.id); // still resumable after the day rolled over
    const fin = ok(await service.finishWorkout(s.id));
    expect(fin.reward).toEqual({ status: 'rejected', reason: 'day-changed' });
    const today = await service.loadToday();
    expect(today.slots.find((x) => x.slotKey === 'core')!.status).toBe('open');
    expect(today.progress.totalXp).toBe(0);
  });

  it('abandoning keeps logged sets, grants nothing, and the session can be started again', async () => {
    const { todaySlot } = await setup();
    const s = ok(await service.startWorkout(todaySlot));
    ok(await service.logSet(s.id, work(s.exercises[0].exerciseId)));
    ok(await service.abandonWorkout(s.id));
    const t = await service.loadTraining();
    expect(t.active).toBeNull();
    expect(t.week[0].state).toBe('planned');
    const again = ok(await service.startWorkout(todaySlot));
    expect(again.id).not.toBe(s.id);
    expect((await service.loadToday()).progress.totalXp).toBe(0);
  });

  it('concurrent start taps create exactly one active session', async () => {
    const { todaySlot } = await setup();
    const results = await Promise.all([service.startWorkout(todaySlot), service.startWorkout(todaySlot), service.startWorkout(todaySlot)]);
    const ids = new Set(results.map((r) => ok(r).id));
    expect(ids.size).toBe(1);
  });

  it('concurrent finish taps grant one reward', async () => {
    const { todaySlot } = await setup();
    const s = ok(await service.startWorkout(todaySlot));
    ok(await service.logSet(s.id, work(s.exercises[0].exerciseId)));
    const results = await Promise.all([service.finishWorkout(s.id), service.finishWorkout(s.id)]);
    expect(results.map((r) => ok(r).reward.status).sort()).toEqual(['already-completed', 'awarded']);
    expect((await service.loadToday()).progress.totalXp).toBe(60);
  });

  it('last performance of an exercise is shown from the latest finished session (work sets only)', async () => {
    const { t, todaySlot } = await setup();
    const s = ok(await service.startWorkout(todaySlot));
    const ex = s.exercises[0].exerciseId;
    ok(await service.logSet(s.id, warmup(ex)));
    ok(await service.logSet(s.id, work(ex, 10, 40)));
    ok(await service.finishWorkout(s.id));
    // Thursday is İtiş B: same first exercise.
    clock.set('2026-11-13T07:00:00Z');
    const t2 = await service.loadTraining();
    expect(t2.lastPerformance[ex]?.map((x) => [x.kind, x.reps, x.load])).toEqual([['work', 10, 40]]);
    expect(t.week.length).toBe(5);
  });

  it('new limitation invalidates the plan: starting is blocked until a new plan is accepted', async () => {
    const { todaySlot } = await setup();
    ok(await service.confirmTrainingProfile({ ...PROFILE, limitations: ['overhead'] }));
    const t = await service.loadTraining();
    expect(t.planIssue).toBe('unavailable-exercise');
    expect(await service.startWorkout(todaySlot)).toEqual({ status: 'rejected', reason: 'plan-invalid' });
    const p = ok(await service.proposeGeneratedProgram());
    expect(p.changes.length).toBeGreaterThan(0);
    const ids = p.program.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(ids).not.toContain('db-shoulder-press');
    expect(ids).not.toContain('db-overhead-extension');
    ok(await service.acceptProgram({ baseVersionId: p.baseVersionId, program: p.program, source: 'generated' }));
    expect((await service.loadTraining()).planIssue).toBeNull();
    expect((await service.startWorkout(todaySlot)).status).toBe('ok');
  });

  // ---- Regressions from the QA/training review ----

  it('a 0-rep work set is rejected, so it cannot complete the daily core', async () => {
    const { todaySlot } = await setup();
    const s = ok(await service.startWorkout(todaySlot));
    const ex = s.exercises[0].exerciseId;
    expect((await service.logSet(s.id, work(ex, 0, 0))).status).toBe('rejected');
    expect(await service.finishWorkout(s.id)).toEqual({ status: 'rejected', reason: 'no-work-sets' });
    expect((await service.loadToday()).progress.totalXp).toBe(0);
  });

  it('reward refused by a clock anomaly can be claimed once the clock is corrected', async () => {
    clock.set('2026-11-09T09:00:00Z');
    const { todaySlot } = await setup();
    const s = ok(await service.startWorkout(todaySlot));
    ok(await service.logSet(s.id, work(s.exercises[0].exerciseId)));
    clock.set('2026-11-09T08:00:00Z'); // rolled back > 5 min
    expect(ok(await service.finishWorkout(s.id)).reward).toEqual({ status: 'rejected', reason: 'clock-frozen' });
    clock.set('2026-11-09T09:10:00Z');
    const today = await service.loadToday();
    expect(today.training.planned).toMatchObject({ state: 'done', sessionId: s.id });
    const claim = ok(await service.finishWorkout(s.id)).reward;
    expect(claim.status === 'awarded' && claim.entry.awardedXp).toBe(60);
    expect(ok(await service.finishWorkout(s.id)).reward.status).toBe('already-completed');
    expect((await service.loadToday()).progress.totalXp).toBe(60);
  });

  it('reward refused by illness becomes claimable after the check-in is corrected; no false "already completed"', async () => {
    const { todayId, todaySlot } = await setup();
    await service.recordCheckin(todayId, goodCheckin);
    const s = ok(await service.startWorkout(todaySlot));
    ok(await service.logSet(s.id, work(s.exercises[0].exerciseId)));
    await service.recordCheckin(todayId, illCheckin);
    expect(ok(await service.finishWorkout(s.id)).reward).toEqual({ status: 'rejected', reason: 'illness' });
    expect(ok(await service.finishWorkout(s.id)).reward).toEqual({ status: 'rejected', reason: 'illness' });
    await service.recordCheckin(todayId, goodCheckin);
    expect(ok(await service.finishWorkout(s.id)).reward.status).toBe('awarded');
    expect((await service.loadToday()).progress.totalXp).toBe(70);
  });

  it('regenerating a different split does not inherit a done slot from an unrelated day', async () => {
    const { todaySlot } = await setup();
    const s = ok(await service.startWorkout(todaySlot));
    ok(await service.logSet(s.id, work(s.exercises[0].exerciseId)));
    ok(await service.finishWorkout(s.id));
    ok(await service.confirmTrainingProfile({ ...PROFILE, trainingDays: [1, 3] }));
    const p = ok(await service.proposeGeneratedProgram());
    expect(p.changes.map((c) => c.kind)).toContain('day-removed');
    ok(await service.acceptProgram({ baseVersionId: p.baseVersionId, program: p.program, source: 'generated' }));
    clock.set('2026-11-10T07:00:00Z');
    const t = await service.loadTraining();
    const tue = t.week.find((w) => w.date === '2026-11-10')!;
    expect(tue).toMatchObject({ title: 'Tüm vücut A', state: 'planned' });
    expect((await service.startWorkout(tue.slotId)).status).toBe('ok');
  });

  it('regenerating the same split keeps day ids, so a done session stays done', async () => {
    const { todaySlot } = await setup();
    const s = ok(await service.startWorkout(todaySlot));
    ok(await service.logSet(s.id, work(s.exercises[0].exerciseId)));
    ok(await service.finishWorkout(s.id));
    ok(await service.confirmTrainingProfile({ ...PROFILE, experience: 'beginner' }));
    const p = ok(await service.proposeGeneratedProgram());
    ok(await service.acceptProgram({ baseVersionId: p.baseVersionId, program: p.program, source: 'generated' }));
    expect((await service.loadTraining()).week[0]).toMatchObject({ slotId: todaySlot, state: 'done' });
  });

  it('joint pain today is exposed to the training screen', async () => {
    const { todayId } = await setup();
    await service.recordCheckin(todayId, { ...goodCheckin, jointPain: 'yes' });
    expect((await service.loadTraining()).jointPainToday).toBe(true);
  });
});
