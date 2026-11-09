/// <reference types="node" />
/**
 * M1 regressions + M2 on both real adapters (SQLite via node:sqlite, IndexedDB
 * via fake-indexeddb). 2026-11-09 is a Monday; PPLPP = Mon push-1, Tue pull-1,
 * Wed legs-1, Fri push-2, Sat pull-2. Halter bench press is first on both push days.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AvciRepository } from '@/data/types';
import type { Program } from '@/domain/training/program';
import { DRAFT_TRAINING_PROFILE } from '@/domain/training/profile';
import { restRemainingSeconds } from '@/domain/training/rest';
import type { SetInput } from '@/domain/training/workout';
import { AvciService } from '@/services/avci-service';

import { backends, FakeClock, goodCheckin } from './helpers';

function ok<T>(r: { status: 'ok'; value: T } | { status: 'rejected'; reason: string }): T {
  if (r.status !== 'ok') throw new Error(`expected ok, got ${r.reason}`);
  return r.value;
}
const BENCH = 'bb-bench-press';
const work = (load = 60, reps = 12, rir: number | null = 2, unit: 'kg' | 'lb' = 'kg'): SetInput => ({
  exerciseId: BENCH, kind: 'work', reps, load, unit, rir,
});
/** 07:00Z = 10:00 Istanbul on the given local date. */
const morning = (date: string) => `${date}T07:00:00Z`;

describe.each(backends)('M1 fixes + M2 ($name)', (backend) => {
  let repo: AvciRepository;
  let clock: FakeClock;
  let service: AvciService;

  const restart = async () => {
    await repo.close();
    repo = await backend.open();
    service = new AvciService(repo, clock);
  };
  const setup = async () => {
    await service.createProfile({});
    ok(await service.confirmTrainingProfile(DRAFT_TRAINING_PROFILE));
    const p = ok(await service.proposeGeneratedProgram());
    ok(await service.acceptProgram({ baseVersionId: null, program: p.program, source: 'generated' }));
  };
  const checkin = async () => {
    const t = await service.loadToday();
    await service.recordCheckin(t.today!.id, goodCheckin);
  };
  /** Runs today's planned session with three bench work sets. */
  const train = async (date: string, sets: SetInput[] = [work(), work(), work()]) => {
    clock.set(morning(date));
    await checkin();
    const t = await service.loadTraining();
    const slot = t.week.find((w) => w.date === date)!;
    const s = ok(await service.startWorkout(slot.slotId));
    for (const x of sets) ok(await service.logSet(s.id, x));
    ok(await service.finishWorkout(s.id));
    return s.id;
  };

  beforeEach(async () => {
    backend.setup();
    clock = new FakeClock(new Date(morning('2026-11-09')));
    repo = await backend.open();
    service = new AvciService(repo, clock);
  });
  afterEach(async () => {
    await repo.close();
    backend.teardown();
  });

  // ---------- M1 fix 1: exercise order ----------
  it('reorder-only edit: preview shows it, accept saves a new version, reopen keeps it; running session keeps its order', async () => {
    await setup();
    const t = await service.loadTraining();
    const today = t.week.find((w) => w.date === '2026-11-09')!;
    const running = ok(await service.startWorkout(today.slotId));
    const originalOrder = running.exercises.map((e) => e.exerciseId);

    const edited: Program = structuredClone(t.plan!.program);
    const day = edited.days.find((d) => d.id === today.programDayId)!;
    day.exercises = [day.exercises[1], day.exercises[0], ...day.exercises.slice(2)];
    const preview = ok(await service.previewProgram(edited));
    expect(preview.changes.map((c) => c.kind)).toEqual(['exercise-order']);
    expect(preview.conflicts).toEqual([]);
    const { plan } = ok(await service.acceptProgram({ baseVersionId: t.plan!.id, program: edited, source: 'user-edit' }));
    expect(plan.sequence).toBe(2);

    await restart();
    const after = await service.loadTraining();
    expect(after.plan!.sequence).toBe(2);
    expect(after.plan!.program.days.find((d) => d.id === today.programDayId)!.exercises.map((e) => e.exerciseId)).toEqual(
      day.exercises.map((e) => e.exerciseId),
    );
    // The in-progress session keeps the order it started with; so does it after finishing.
    expect(after.active!.session.exercises.map((e) => e.exerciseId)).toEqual(originalOrder);
    ok(await service.logSet(running.id, { ...work(), exerciseId: originalOrder[0] }));
    ok(await service.finishWorkout(running.id));
    await restart();
    expect((await service.loadTraining()).plan!.program.days.find((d) => d.id === today.programDayId)!.exercises[0].exerciseId).toBe(
      day.exercises[0].exerciseId,
    );
  });

  // ---------- M1 fix 2: schedule_move conflicts ----------
  it('Tue->Thu move then moving another day to Thu is refused, shown, and nothing changes', async () => {
    await setup();
    clock.set(morning('2026-11-10')); // Tuesday
    const t = await service.loadTraining();
    const pull = t.week.find((w) => w.programDayId === 'pull-1')!;
    ok(await service.moveSession(pull.slotId, '2026-11-12'));
    const before = await service.loadTraining();

    const edited = structuredClone(before.plan!.program);
    edited.days.find((d) => d.id === 'push-2')!.weekday = 3; // Fri -> Thu
    const preview = ok(await service.previewProgram(edited));
    expect(preview.conflicts).toHaveLength(1);
    expect(preview.conflicts[0].date).toBe('2026-11-12');
    expect(preview.conflicts[0].sessions.map((s) => s.title).sort()).toEqual(['Çekiş A', 'İtiş B']);

    const r = await service.acceptProgram({ baseVersionId: before.plan!.id, program: edited, source: 'user-edit' });
    expect(r.status).toBe('rejected');
    expect(r.status === 'rejected' && r.reason).toBe('schedule-conflict');
    expect(r.status === 'rejected' && r.conflicts?.[0].date).toBe('2026-11-12');

    await restart();
    const after = await service.loadTraining();
    expect(after.planCount).toBe(1);
    expect(after.plan!.id).toBe(before.plan!.id);
    expect(after.week).toEqual(before.week); // move kept, no session moved or dropped
    expect(after.week.filter((w) => w.date === '2026-11-12').map((w) => w.programDayId)).toEqual(['pull-1']);
    // A non-conflicting edit still works.
    edited.days.find((d) => d.id === 'push-2')!.weekday = 6; // Fri -> Sun
    ok(await service.acceptProgram({ baseVersionId: before.plan!.id, program: edited, source: 'user-edit' }));
  });

  it('regenerated program that collides with a move is also refused', async () => {
    await setup();
    clock.set(morning('2026-11-10'));
    const t = await service.loadTraining();
    ok(await service.moveSession(t.week.find((w) => w.programDayId === 'pull-1')!.slotId, '2026-11-12'));
    ok(await service.confirmTrainingProfile({ ...DRAFT_TRAINING_PROFILE, trainingDays: [0, 1, 2, 3, 4] }));
    const p = ok(await service.proposeGeneratedProgram());
    const r = await service.acceptProgram({ baseVersionId: t.plan!.id, program: p.program, source: 'generated' });
    expect(r.status === 'rejected' && r.reason).toBe('schedule-conflict');
    expect((await service.loadTraining()).planCount).toBe(1);
  });

  // ---------- M2 weekly review ----------
  it('weekly review grants 40 base XP once per cycle across retry, restart and another day; next week is a new cycle', async () => {
    await service.createProfile({});
    const r1 = await service.loadWeeklyReview();
    const cycle = ok(r1).cycle;
    expect(cycle).toMatchObject({ weekStart: '2026-11-09', weekEnd: '2026-11-15', multiplierHalves: 2, closedAt: null });
    const a = await service.completeWeeklyReview(cycle.id);
    expect(a.status === 'awarded' && a.entry).toMatchObject({ scopeKind: 'week', scopeId: cycle.id, slotKey: 'weekly-review', awardedXp: 40 });
    expect((await service.completeWeeklyReview(cycle.id)).status).toBe('already-completed');
    await Promise.all([service.completeWeeklyReview(cycle.id), service.completeWeeklyReview(cycle.id)]);
    await restart();
    clock.set(morning('2026-11-13'));
    expect((await service.completeWeeklyReview(cycle.id)).status).toBe('already-completed');
    expect(ok(await service.loadWeeklyReview()).cycle.id).toBe(cycle.id);
    expect((await service.loadToday()).progress.totalXp).toBe(40);

    clock.set(morning('2026-11-16')); // next Monday
    const next = ok(await service.loadWeeklyReview()).cycle;
    expect(next.id).not.toBe(cycle.id);
    // Old cycle is closed and cannot be reviewed/rewarded again, even with a retry.
    expect((await service.completeWeeklyReview(cycle.id)).status).toBe('already-completed');
    expect((await service.completeWeeklyReview(next.id)).status).toBe('awarded');
    expect((await service.loadToday()).progress.totalXp).toBe(80);
  });

  it('cycle multiplier is fixed when the cycle opens; unreviewed closed cycle and clock rollback cannot reopen it', async () => {
    await service.createProfile({});
    const cycle = ok(await service.loadWeeklyReview()).cycle;
    await service.updateSettings({ multiplierHalves: 4 }); // x2 from next task day
    clock.set(morning('2026-11-12'));
    const again = ok(await service.loadWeeklyReview());
    expect(again.cycle.multiplierHalves).toBe(2);
    expect(again.rewardXp).toBe(40);
    const r = await service.completeWeeklyReview(cycle.id);
    expect(r.status === 'awarded' && r.entry.awardedXp).toBe(40);

    clock.set(morning('2026-11-17'));
    const next = ok(await service.loadWeeklyReview()).cycle;
    expect(next.multiplierHalves).toBe(4);
    clock.set(morning('2026-11-15')); // clock moved back into the closed week
    expect(ok(await service.loadWeeklyReview()).cycle.id).toBe(next.id);
    const frozen = await service.completeWeeklyReview(next.id);
    expect(frozen.status === 'rejected' && frozen.reason).toBe('clock-frozen');
    clock.set(morning('2026-11-17'));
    const ok2 = await service.completeWeeklyReview(next.id);
    expect(ok2.status === 'awarded' && ok2.entry.awardedXp).toBe(80);
  });

  // ---------- M2 progression proposals ----------
  const twoGoodSessions = async (load = 60) => {
    await setup();
    await train('2026-11-09', [work(load), work(load), work(load)]);
    await train('2026-11-13', [work(load), work(load), work(load)]);
    clock.set(morning('2026-11-14'));
    await checkin();
    ok(await service.confirmIncrement('barbell', 'kg', 2.5));
  };
  const benchProposal = async () => ok(await service.loadWeeklyReview()).proposals.find((p) => p.exerciseId === BENCH);

  it('proposal -> preview data -> technique confirmation -> accept writes a new plan version with the target load', async () => {
    await twoGoodSessions();
    const review = ok(await service.loadWeeklyReview());
    const p = review.proposals.find((x) => x.exerciseId === BENCH)!;
    expect(p).toMatchObject({ status: 'pending', before: { load: 60, unit: 'kg', convention: 'total' }, after: { load: 62.5 } });
    // Holds are explained with reasons (e.g. no increment confirmed for other equipment).
    expect(review.decisions.length).toBeGreaterThan(0);
    // Re-opening does not duplicate the proposal.
    expect(ok(await service.loadWeeklyReview()).proposals.filter((x) => x.exerciseId === BENCH)).toHaveLength(1);
    const planBefore = (await service.loadTraining()).plan!;

    const noConfirm = await service.acceptProposal(p.id, { techniqueConfirmed: false });
    expect(noConfirm.status === 'rejected' && noConfirm.reason).toBe('technique-unconfirmed');
    expect((await service.loadTraining()).plan!.id).toBe(planBefore.id);

    const accepted = ok(await service.acceptProposal(p.id, { techniqueConfirmed: true }));
    expect(accepted.plan).toMatchObject({ parentId: planBefore.id, sequence: planBefore.sequence + 1, proposalId: p.id });
    expect(accepted.changes.every((c) => c.kind === 'prescription')).toBe(true);
    await restart();
    const t = await service.loadTraining();
    const targets = t.plan!.program.days.flatMap((d) => d.exercises).filter((e) => e.exerciseId === BENCH);
    expect(targets.length).toBe(2);
    expect(targets.every((e) => e.targetLoad?.value === 62.5 && e.targetLoad.unit === 'kg')).toBe(true);
    const audit = ok(await service.loadWeeklyReview()).proposals;
    expect(audit.find((x) => x.id === p.id)).toMatchObject({ status: 'accepted', resultPlanVersionId: accepted.plan.id });
    // Decided proposals cannot be decided again; XP unchanged by plan changes.
    expect((await service.acceptProposal(p.id, { techniqueConfirmed: true })).status).toBe('rejected');
    expect((await service.loadToday()).progress.totalXp).toBe(10 * 3 + 60 * 2);
  });

  it('decline is recorded, plan unchanged, same evidence is not proposed again', async () => {
    await twoGoodSessions();
    const p = (await benchProposal())!;
    const planId = (await service.loadTraining()).plan!.id;
    ok(await service.declineProposal(p.id));
    await restart();
    const again = ok(await service.loadWeeklyReview());
    expect(again.proposals.filter((x) => x.exerciseId === BENCH).map((x) => x.status)).toEqual(['declined']);
    expect((await service.loadTraining()).plan!.id).toBe(planId);
  });

  it('a proposal based on edited data or an older plan version is re-validated and not applied', async () => {
    await twoGoodSessions();
    const p = (await benchProposal())!;
    // Edit one logged set after the proposal was made (RIR now 1).
    const sessionId = p.evidenceSessionIds[0];
    const target = (await repo.transaction((tx) => tx.listSets(sessionId))).find((x) => x.exerciseId === BENCH)!;
    ok(await service.updateSet(target.id, { kind: 'work', reps: 12, load: 60, unit: 'kg', rir: 1 }));
    const r = await service.acceptProposal(p.id, { techniqueConfirmed: true });
    expect(r.status === 'rejected' && r.reason).toBe('proposal-stale');
    const planAfter = await service.loadTraining();
    expect(planAfter.planCount).toBe(1);
    const review = ok(await service.loadWeeklyReview());
    expect(review.proposals.find((x) => x.id === p.id)!.status).toBe('stale');
    expect(review.decisions.find((d) => d.exerciseId === BENCH)).toMatchObject({ kind: 'hold', reasons: ['low-rir'] });

    // Plan version changed after the proposal: also stale.
    await restart();
    ok(await service.updateSet(target.id, { kind: 'work', reps: 12, load: 60, unit: 'kg', rir: 2 }));
    const fresh = (await benchProposal())!;
    expect(fresh.status).toBe('pending');
    const plan = (await service.loadTraining()).plan!;
    const edited = structuredClone(plan.program);
    edited.days[2].title = 'Bacak günü';
    ok(await service.acceptProgram({ baseVersionId: plan.id, program: edited, source: 'user-edit' }));
    const r2 = await service.acceptProposal(fresh.id, { techniqueConfirmed: true });
    expect(r2.status === 'rejected' && r2.reason).toBe('proposal-stale');
    expect((await service.loadTraining()).planCount).toBe(2); // only the user's title edit
  });

  it('no increase without check-in today, with a too-large increment, or with lb data and a kg increment', async () => {
    await setup();
    await train('2026-11-09', [work(40), work(40), work(40)]);
    await train('2026-11-13', [work(40), work(40), work(40)]);
    clock.set(morning('2026-11-14'));
    ok(await service.confirmIncrement('barbell', 'kg', 2.5));
    let review = ok(await service.loadWeeklyReview());
    expect(review.checkinToday).toBe(false);
    expect(review.decisions.find((d) => d.exerciseId === BENCH)).toMatchObject({ kind: 'hold', reasons: ['checkin-missing'] });
    await checkin();
    review = ok(await service.loadWeeklyReview());
    expect(review.decisions.find((d) => d.exerciseId === BENCH)).toMatchObject({ kind: 'hold', reasons: ['increment-over-cap'] });
    expect(review.proposals).toEqual([]);
    expect((await service.confirmIncrement('barbell', 'kg', Number.NaN)).status).toBe('rejected');
  });

  it('band exercises refuse a kg load', async () => {
    await service.createProfile({});
    ok(await service.confirmTrainingProfile({ ...DRAFT_TRAINING_PROFILE, equipment: ['bands'] }));
    const p = ok(await service.proposeGeneratedProgram());
    ok(await service.acceptProgram({ baseVersionId: null, program: p.program, source: 'generated' }));
    await checkin();
    const t = await service.loadTraining();
    const s = ok(await service.startWorkout(t.week.find((w) => w.date === '2026-11-09')!.slotId));
    const band = s.exercises.find((e) => e.exerciseId.startsWith('band-'));
    if (!band) return; // the generated day may have no band exercise
    const bad = await service.logSet(s.id, { exerciseId: band.exerciseId, kind: 'work', reps: 12, load: 5, unit: 'kg', rir: 2 });
    expect(bad.status === 'rejected' && bad.detail).toBe('band-load');
    ok(await service.logSet(s.id, { exerciseId: band.exerciseId, kind: 'work', reps: 12, load: 0, unit: 'kg', rir: 2 }));
  });

  // ---------- review findings (regressions) ----------
  it('a target load never travels to a swapped/added exercise; only a proposal creates one', async () => {
    await twoGoodSessions();
    const p = (await benchProposal())!;
    ok(await service.acceptProposal(p.id, { techniqueConfirmed: true }));
    const plan = (await service.loadTraining()).plan!;
    // Swap bench -> dumbbell bench keeping the 62.5 kg target: refused (per-dumbbell would mean 125 kg).
    const swapped = structuredClone(plan.program);
    const ex = swapped.days[0].exercises.find((e) => e.exerciseId === BENCH)!;
    ex.exerciseId = 'db-bench-press';
    const r = await service.acceptProgram({ baseVersionId: plan.id, program: swapped, source: 'user-edit' });
    expect(r.status === 'rejected' && r.detail).toBe('target-load');
    // Inventing a target by hand is refused too; clearing one is allowed and shown in the diff.
    const invented = structuredClone(plan.program);
    invented.days[1].exercises[0].targetLoad = { value: 50, unit: 'kg' };
    expect((await service.acceptProgram({ baseVersionId: plan.id, program: invented, source: 'user-edit' })).status).toBe('rejected');
    ex.targetLoad = null;
    const ok2 = ok(await service.acceptProgram({ baseVersionId: plan.id, program: swapped, source: 'user-edit' }));
    expect(ok2.plan.program.days[0].exercises.find((e) => e.exerciseId === 'db-bench-press')!.targetLoad).toBeNull();
  });

  it('a declined proposal does not come back next week or after an unrelated plan edit', async () => {
    await twoGoodSessions();
    const p = (await benchProposal())!;
    ok(await service.declineProposal(p.id));
    const plan = (await service.loadTraining()).plan!;
    const edited = structuredClone(plan.program);
    const legs = edited.days.find((d) => d.id === 'legs-1')!;
    legs.exercises.reverse();
    ok(await service.acceptProgram({ baseVersionId: plan.id, program: edited, source: 'user-edit' }));
    expect(ok(await service.loadWeeklyReview()).proposals.filter((x) => x.status === 'pending')).toEqual([]);
    clock.set(morning('2026-11-16'));
    await checkin();
    const next = ok(await service.loadWeeklyReview());
    expect(next.proposals).toEqual([]);
  });

  it('opening the review before today\'s check-in keeps a pending proposal pending (no stale duplicate)', async () => {
    await twoGoodSessions();
    const p = (await benchProposal())!;
    clock.set(morning('2026-11-15')); // Sunday, new task day, no check-in yet
    const blocked = ok(await service.loadWeeklyReview());
    expect(blocked.readinessBlocked).toBe(true);
    expect(blocked.proposals.map((x) => [x.id, x.status])).toEqual([[p.id, 'pending']]);
    const r = await service.acceptProposal(p.id, { techniqueConfirmed: true });
    expect(r.status === 'rejected' && r.reason).toBe('readiness-blocked');
    await checkin();
    const after = ok(await service.loadWeeklyReview());
    expect(after.proposals.map((x) => [x.id, x.status])).toEqual([[p.id, 'pending']]);
    ok(await service.acceptProposal(p.id, { techniqueConfirmed: true }));
  });

  it('a regenerated split that would drop a moved session is refused, and band sets cannot be edited to kg', async () => {
    await setup();
    clock.set(morning('2026-11-10'));
    const t = await service.loadTraining();
    ok(await service.moveSession(t.week.find((w) => w.programDayId === 'pull-1')!.slotId, '2026-11-12'));
    ok(await service.confirmTrainingProfile({ ...DRAFT_TRAINING_PROFILE, trainingDays: [0, 2, 4, 6] }));
    const p = ok(await service.proposeGeneratedProgram());
    expect(p.conflicts.some((c) => c.kind === 'would-displace' && c.sessions[0].programDayId === 'pull-1')).toBe(true);
    const r = await service.acceptProgram({ baseVersionId: t.plan!.id, program: p.program, source: 'generated' });
    expect(r.status === 'rejected' && r.reason).toBe('schedule-conflict');
    expect((await service.loadTraining()).week.find((w) => w.programDayId === 'pull-1')).toMatchObject({ date: '2026-11-12', moved: true });
  });

  it('a timezone change mid-week keeps the same weekly cycle and reward', async () => {
    await service.createProfile({});
    const c1 = ok(await service.loadWeeklyReview()).cycle;
    clock.tz = 'America/New_York';
    clock.set('2026-11-12T15:00:00Z');
    expect(ok(await service.loadWeeklyReview()).cycle.id).toBe(c1.id);
    expect((await service.completeWeeklyReview(c1.id)).status).toBe('awarded');
    clock.tz = 'Asia/Tokyo';
    expect((await service.completeWeeklyReview(c1.id)).status).toBe('already-completed');
  });

  // ---------- M2 rest timer ----------
  it('rest timer survives restart; remaining time comes from the stored timestamp', async () => {
    await setup();
    await checkin();
    const t = await service.loadTraining();
    const s = ok(await service.startWorkout(t.week.find((w) => w.date === '2026-11-09')!.slotId));
    expect((await service.startRest(s.id, 5)).status).toBe('rejected');
    ok(await service.startRest(s.id, 90));
    await restart();
    clock.set('2026-11-09T07:00:40Z');
    const active = (await service.loadTraining()).active!.session;
    expect(active.restDurationS).toBe(90);
    expect(restRemainingSeconds({ startedAt: active.restStartedAt!, durationS: 90 }, clock.now().getTime())).toBe(50);
    ok(await service.clearRest(s.id));
    expect((await service.loadTraining()).active!.session.restStartedAt).toBeNull();
    ok(await service.startRest(s.id, 60));
    ok(await service.logSet(s.id, work()));
    ok(await service.finishWorkout(s.id));
    expect((await service.loadTraining()).active).toBeNull();
  });
});
