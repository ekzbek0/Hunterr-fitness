/// <reference types="node" />
/**
 * End-to-end M0 slice against BOTH real persistence adapters:
 * SQLite (node:sqlite stand-in for expo-sqlite) and IndexedDB (fake-indexeddb).
 * "Restart" = close the repository and open a fresh one on the same storage.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AvciRepository } from '@/data/types';
import { AvciService } from '@/services/avci-service';

import { backends, FakeClock, goodCheckin, illCheckin } from './helpers';

describe.each(backends)('M0 daily quest -> XP -> restart ($name)', (backend) => {
  let repo: AvciRepository;
  let clock: FakeClock;
  let service: AvciService;

  const restart = async () => {
    await repo.close();
    repo = await backend.open();
    service = new AvciService(repo, clock);
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

  it('new user has no profile and no day until they start', async () => {
    const s = await service.loadToday();
    expect(s.profile).toBeNull();
    expect(s.today).toBeNull();
    expect(s.progress.totalXp).toBe(0);
  });

  it('profile -> today -> check-in -> core -> restart keeps identical history and total', async () => {
    await service.createProfile({});
    const day = (await service.loadToday()).today!;
    expect(day.localDate).toBe('2026-11-09');

    expect((await service.recordCheckin(day.id, goodCheckin)).status).toBe('awarded');
    expect((await service.completeCore(day.id, 'training')).status).toBe('awarded');
    expect((await service.completeHabit(day.id, 'habit-1')).status).toBe('awarded');
    const before = await service.loadToday();
    expect(before.progress.totalXp).toBe(85);
    expect(before.todayXp).toBe(85);

    await restart();
    const after = await service.loadToday();
    expect(after.today!.id).toBe(day.id);
    expect(after.progress.totalXp).toBe(85);
    expect(after.checkin).toMatchObject(goodCheckin);
    expect(after.slots.map((s) => [s.slotKey, s.status])).toEqual([
      ['checkin', 'completed'],
      ['core', 'completed'],
      ['habit-1', 'completed'],
      ['habit-2', 'open'],
    ]);
    expect(after.recentLedger.map((e) => e.id).sort()).toEqual(before.recentLedger.map((e) => e.id).sort());
  });

  it('full day reaches level 2 at exactly 100 XP', async () => {
    await service.createProfile({});
    const id = (await service.loadToday()).today!.id;
    await service.recordCheckin(id, goodCheckin);
    await service.completeCore(id, 'recovery');
    await service.completeHabit(id, 'habit-1');
    await service.completeHabit(id, 'habit-2');
    const s = await service.loadToday();
    expect(s.progress).toMatchObject({ totalXp: 100, level: 2, rank: 'E' });
  });

  it('double tap / concurrent retries grant exactly one reward', async () => {
    await service.createProfile({});
    const id = (await service.loadToday()).today!.id;
    const results = await Promise.all([
      service.completeCore(id, 'training'),
      service.completeCore(id, 'training'),
      service.completeCore(id, 'recovery'),
    ]);
    expect(results.filter((r) => r.status === 'awarded')).toHaveLength(1);
    await restart();
    expect((await service.completeCore(id, 'training')).status).toBe('already-completed');
    expect((await service.loadToday()).progress.totalXp).toBe(60);
  });

  it('workout -> recovery swap after completion grants no second reward', async () => {
    await service.createProfile({});
    const id = (await service.loadToday()).today!.id;
    await service.completeCore(id, 'training');
    const swap = await service.completeCore(id, 'recovery');
    expect(swap.status).toBe('already-completed');
    expect((await service.loadToday()).progress.totalXp).toBe(60);
  });

  it('correcting the check-in does not grant check-in XP twice', async () => {
    await service.createProfile({});
    const id = (await service.loadToday()).today!.id;
    await service.recordCheckin(id, goodCheckin);
    expect((await service.recordCheckin(id, { ...goodCheckin, energy: 2 })).status).toBe('already-completed');
    const s = await service.loadToday();
    expect(s.checkin?.energy).toBe(2);
    expect(s.progress.totalXp).toBe(10);
  });

  it('changing habits or multiplier mid-day affects only the next day', async () => {
    await service.createProfile({});
    const today = (await service.loadToday()).today!;
    await service.completeHabit(today.id, 'habit-1');
    await service.updateSettings({ habitKeys: ['water', 'meal-plan'], multiplierHalves: 4 });

    const same = await service.loadToday();
    expect(same.today!.multiplierHalves).toBe(2);
    expect(same.slots.find((s) => s.slotKey === 'habit-1')!.title).toBe('10 dakika yürüyüş');
    expect((await service.completeHabit(today.id, 'habit-1')).status).toBe('already-completed');
    const h2 = await service.completeHabit(today.id, 'habit-2');
    expect(h2.status === 'awarded' && h2.entry.awardedXp).toBe(15);
    expect(same.progress.totalXp).toBe(15);

    clock.set('2026-11-10T07:00:00Z');
    const next = await service.loadToday();
    expect(next.today!.localDate).toBe('2026-11-10');
    expect(next.today!.multiplierHalves).toBe(4);
    expect(next.slots.find((s) => s.slotKey === 'habit-1')!.title).toBe('Su içmeyi gün boyu takip et');
    const core = await service.completeCore(next.today!.id, 'training');
    expect(core.status === 'awarded' && core.entry.awardedXp).toBe(120);
    // Yesterday's ledger rows are untouched.
    expect((await service.loadToday()).progress.totalXp).toBe(30 + 120);
  });

  it('a closed day cannot be completed after rollover', async () => {
    await service.createProfile({});
    const yesterday = (await service.loadToday()).today!;
    clock.set('2026-11-10T07:00:00Z');
    expect(await service.completeCore(yesterday.id, 'training')).toEqual({ status: 'rejected', reason: 'day-changed' });
    const s = await service.loadToday();
    expect(s.recentDays.map((d) => [d.localDate, d.closedAt !== null])).toEqual([
      ['2026-11-10', false],
      ['2026-11-09', true],
    ]);
    expect(s.progress.totalXp).toBe(0);
  });

  it('missed days create no debt and no negative XP', async () => {
    await service.createProfile({});
    const id = (await service.loadToday()).today!.id;
    await service.completeCore(id, 'training');
    clock.set('2026-11-15T07:00:00Z');
    const s = await service.loadToday();
    expect(s.today!.localDate).toBe('2026-11-15');
    expect(s.recentDays).toHaveLength(2);
    expect(s.slots.every((x) => x.status === 'open')).toBe(true);
    expect(s.slots).toHaveLength(4);
    expect(s.progress.totalXp).toBe(60);
  });

  it('clock rollback freezes rewards without reopening or losing data', async () => {
    await service.createProfile({});
    clock.set('2026-11-09T12:00:00Z');
    const id = (await service.loadToday()).today!.id;
    clock.set('2026-11-08T12:00:00Z');
    const frozen = await service.loadToday();
    expect(frozen.rewardsFrozen).toBe(true);
    expect(frozen.today!.id).toBe(id);
    expect(await service.completeCore(id, 'training')).toEqual({ status: 'rejected', reason: 'clock-frozen' });
    clock.set('2026-11-09T12:10:00Z');
    expect((await service.loadToday()).rewardsFrozen).toBe(false);
    expect((await service.completeCore(id, 'training')).status).toBe('awarded');
  });

  it('timezone change mid-day keeps one open day and never duplicates a date', async () => {
    await service.createProfile({});
    const id = (await service.loadToday()).today!.id;
    clock.tz = 'America/New_York';
    clock.set('2026-11-09T22:00:00Z'); // Istanbul already 10 Nov, New York still 9 Nov
    expect((await service.loadToday()).today!.id).toBe(id);
    clock.set('2026-11-10T06:00:00Z');
    const s = await service.loadToday();
    expect(s.today!.localDate).toBe('2026-11-10');
    expect(s.today!.timezone).toBe('America/New_York');
  });

  it('invalid check-in input is rejected without writing anything', async () => {
    await service.createProfile({});
    const id = (await service.loadToday()).today!.id;
    expect(await service.recordCheckin(id, { ...goodCheckin, energy: 9 })).toEqual({ status: 'rejected', reason: 'invalid' });
    const s = await service.loadToday();
    expect(s.checkin).toBeNull();
    expect(s.progress.totalXp).toBe(0);
  });

  it('a failed transaction leaves no partial writes', async () => {
    await service.createProfile({});
    const id = (await service.loadToday()).today!.id;
    await expect(
      repo.transaction(async (tx) => {
        const slot = (await tx.getSlot(id, 'core'))!;
        await tx.updateSlot({ ...slot, status: 'completed', completedAt: clock.now().toISOString() });
        throw new Error('crash before ledger insert');
      }),
    ).rejects.toThrow('crash');
    await restart();
    const s = await service.loadToday();
    expect(s.slots.find((x) => x.slotKey === 'core')!.status).toBe('open');
    expect((await service.completeCore(id, 'training')).status).toBe('awarded');
  });

  it('creating the profile twice is idempotent', async () => {
    const [a, b] = await Promise.all([service.createProfile({}), service.createProfile({})]);
    expect(a.id).toBe(b.id);
    expect((await service.loadToday()).recentDays).toHaveLength(1);
  });
  // ---- Regression: illness must block NEW training completion in the service layer ----

  it('illness today: training completion is refused with a reason and grants nothing', async () => {
    await service.createProfile({});
    const id = (await service.loadToday()).today!.id;
    await service.recordCheckin(id, illCheckin);
    expect(await service.completeCore(id, 'training')).toEqual({ status: 'rejected', reason: 'illness' });
    await restart();
    const s = await service.loadToday();
    expect(s.slots.find((x) => x.slotKey === 'core')!.status).toBe('open');
    expect(s.progress.totalXp).toBe(10);
  });

  it('illness today: recovery earns the same 60 XP exactly once, retries do not double it', async () => {
    await service.createProfile({});
    const id = (await service.loadToday()).today!.id;
    await service.recordCheckin(id, illCheckin);
    const first = await service.completeCore(id, 'illness-recovery');
    expect(first.status === 'awarded' && first.entry.awardedXp).toBe(60);
    expect((await service.completeCore(id, 'illness-recovery')).status).toBe('already-completed');
    // A completed core reports its existing reward, even for a training retry.
    expect((await service.completeCore(id, 'training')).status).toBe('already-completed');
    await restart();
    expect((await service.completeCore(id, 'recovery')).status).toBe('already-completed');
    const s = await service.loadToday();
    expect(s.slots.find((x) => x.slotKey === 'core')!.resolution).toBe('illness-recovery');
    expect(s.progress.totalXp).toBe(70);
  });

  it('illness today: planned recovery is also allowed and equal', async () => {
    await service.createProfile({});
    const id = (await service.loadToday()).today!.id;
    await service.recordCheckin(id, illCheckin);
    const r = await service.completeCore(id, 'recovery');
    expect(r.status === 'awarded' && r.entry.awardedXp).toBe(60);
  });

  it('illness reported AFTER training was completed does not revoke the earned reward', async () => {
    await service.createProfile({});
    const id = (await service.loadToday()).today!.id;
    await service.recordCheckin(id, goodCheckin);
    expect((await service.completeCore(id, 'training')).status).toBe('awarded');
    expect((await service.recordCheckin(id, illCheckin)).status).toBe('already-completed');
    expect((await service.completeCore(id, 'training')).status).toBe('already-completed');
    expect((await service.completeCore(id, 'illness-recovery')).status).toBe('already-completed');
    const s = await service.loadToday();
    expect(s.slots.find((x) => x.slotKey === 'core')!.resolution).toBe('training');
    expect(s.progress.totalXp).toBe(70);
  });

  it('illness today: concurrent training/recovery taps yield one recovery reward', async () => {
    await service.createProfile({});
    const id = (await service.loadToday()).today!.id;
    await service.recordCheckin(id, illCheckin);
    const results = await Promise.all([
      service.completeCore(id, 'training'),
      service.completeCore(id, 'illness-recovery'),
      service.completeCore(id, 'training'),
      service.completeCore(id, 'illness-recovery'),
    ]);
    expect(results.filter((r) => r.status === 'awarded')).toHaveLength(1);
    expect((await service.loadToday()).progress.totalXp).toBe(70);
  });

  it("unknown illness answer does not block training (only 'yes' pauses it)", async () => {
    await service.createProfile({});
    const id = (await service.loadToday()).today!.id;
    await service.recordCheckin(id, { ...goodCheckin, illness: 'unknown' });
    expect((await service.completeCore(id, 'training')).status).toBe('awarded');
  });
});
