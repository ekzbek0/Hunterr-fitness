/// <reference types="node" />
/**
 * M3 local reminders. A fake scheduler stands in for expo-notifications; the
 * real native module is NOT exercised here (that needs an iPhone). 2026-11-09
 * is a Monday; Istanbul is UTC+3 all year. PPLPP: Mon push-1, Tue pull-1,
 * Wed legs-1, Fri push-2, Sat pull-2.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AvciRepository } from '@/data/types';
import { diffReminders, normalizeReminderTimes, planReminders, zonedInstant } from '@/domain/reminders/plan';
import { DRAFT_TRAINING_PROFILE } from '@/domain/training/profile';
import type { ReminderPermission, ReminderScheduler, ScheduledReminder } from '@/platform/reminder-types';
import { AvciService } from '@/services/avci-service';
import { ReminderService } from '@/services/reminder-service';

import { backends, FakeClock, goodCheckin } from './helpers';

class FakeScheduler implements ReminderScheduler {
  supported = true;
  perm: ReminderPermission = 'undetermined';
  /** What the user answers when asked. */
  answer: ReminderPermission = 'granted';
  requests = 0;
  scheduled = new Map<string, ScheduledReminder>();
  log: string[] = [];
  foreign = ['other-app-thing'];
  async permission() {
    return this.perm;
  }
  async requestPermission() {
    this.requests++;
    this.perm = this.answer;
    return this.perm;
  }
  async listScheduledIds() {
    return [...this.scheduled.keys()];
  }
  async schedule(r: ScheduledReminder) {
    if (this.scheduled.has(r.id)) throw new Error(`duplicate ${r.id}`);
    this.log.push(`+${r.id}`);
    this.scheduled.set(r.id, r);
  }
  async cancel(id: string) {
    this.log.push(`-${id}`);
    this.scheduled.delete(id);
  }
  async cancelAll() {
    this.log.push('cancelAll');
    this.scheduled.clear();
  }
  async clearDelivered() {
    this.log.push('clearDelivered');
  }
  list() {
    return [...this.scheduled.values()].sort((a, b) => a.fireAt.localeCompare(b.fireAt));
  }
}

function ok<T>(r: { status: 'ok'; value: T } | { status: 'rejected'; reason: string }): T {
  if (r.status !== 'ok') throw new Error(`expected ok, got ${r.reason}`);
  return r.value;
}

describe('reminder planning (pure)', () => {
  const now = new Date('2026-11-09T05:00:00Z'); // 08:00 Istanbul
  it('times are validated, unique and sorted', () => {
    expect(normalizeReminderTimes(['18:30', '07:05', '18:30'])).toEqual(['07:05', '18:30']);
    for (const bad of [['24:00'], ['7:00'], ['07:60'], ['01:00', '02:00', '03:00', '04:00']]) {
      expect(() => normalizeReminderTimes(bad)).toThrow(RangeError);
    }
  });
  it('converts local wall time with the timezone; DST gap is skipped', () => {
    expect(zonedInstant('2026-11-09', '07:30', 'Europe/Istanbul')!.toISOString()).toBe('2026-11-09T04:30:00.000Z');
    expect(zonedInstant('2026-07-01', '07:30', 'Europe/Berlin')!.toISOString()).toBe('2026-07-01T05:30:00.000Z');
    expect(zonedInstant('2026-12-01', '07:30', 'Europe/Berlin')!.toISOString()).toBe('2026-12-01T06:30:00.000Z');
    expect(zonedInstant('2026-03-29', '02:30', 'Europe/Berlin')).toBeNull(); // does not exist
  });
  it('is deterministic, skips past times and resolved days, and diff never duplicates', () => {
    const days = [
      { date: '2026-11-09', kind: 'training' as const, titles: ['İtiş A'] },
      { date: '2026-11-10', kind: 'recovery' as const },
    ];
    const a = planReminders({ now, timeZone: 'Europe/Istanbul', times: ['07:30', '18:00'], days });
    const b = planReminders({ now, timeZone: 'Europe/Istanbul', times: ['18:00', '07:30'], days });
    expect(a).toEqual(b);
    expect(a.map((r) => r.id.slice(0, 20))).toEqual(['avci-2026-11-09-1800', 'avci-2026-11-10-0730', 'avci-2026-11-10-1800']);
    expect(a[0].body).toContain('İtiş A');
    expect(a[1].body).toContain('toparlanma');
    expect(planReminders({ now, timeZone: 'Europe/Istanbul', times: ['18:00'], days, resolvedDates: ['2026-11-09'] })).toHaveLength(1);
    const d = diffReminders(a, [a[0].id, 'avci-stale', 'not-ours']);
    expect(d.cancel).toEqual(['avci-stale']);
    expect(d.schedule.map((r) => r.id)).toEqual([a[1].id, a[2].id]);
    expect(diffReminders(a, a.map((r) => r.id))).toEqual({ cancel: [], schedule: [] });
  });
});

describe.each(backends)('reminder service ($name)', (backend) => {
  let repo: AvciRepository;
  let clock: FakeClock;
  let service: AvciService;
  let sched: FakeScheduler;
  let reminders: ReminderService;

  const setup = async () => {
    await service.createProfile({});
    ok(await service.confirmTrainingProfile(DRAFT_TRAINING_PROFILE));
    const p = ok(await service.proposeGeneratedProgram());
    ok(await service.acceptProgram({ baseVersionId: null, program: p.program, source: 'generated' }));
  };

  beforeEach(async () => {
    backend.setup();
    clock = new FakeClock(new Date('2026-11-09T05:00:00Z')); // Mon 08:00 local
    repo = await backend.open();
    service = new AvciService(repo, clock);
    sched = new FakeScheduler();
    reminders = new ReminderService(repo, sched, clock);
  });
  afterEach(async () => {
    await repo.close();
    backend.teardown();
  });

  it('schedules one reminder per day and time from the plan; repeated reconcile adds no duplicates', async () => {
    await setup();
    const r = await reminders.save({ enabled: true, times: ['18:00'] });
    expect(r).toMatchObject({ state: 'scheduled', count: 7 });
    expect(sched.requests).toBe(1);
    const first = sched.list();
    expect(first.map((x) => x.id.slice(5, 15))).toEqual([
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
    ]);
    expect(first[0].body).toContain('İtiş');
    expect(first[3].body).toContain('toparlanma'); // Thursday rest
    sched.log = [];
    for (let i = 0; i < 3; i++) await reminders.reconcile();
    await Promise.all([reminders.reconcile(), reminders.reconcile()]);
    expect(sched.log).toEqual([]);
    expect(sched.list()).toEqual(first);
    expect(sched.foreign).toEqual(['other-app-thing']);
  });

  it('time change replaces old reminders, never duplicates', async () => {
    await setup();
    await reminders.save({ enabled: true, times: ['18:00'] });
    await reminders.save({ enabled: true, times: ['07:30', '20:00'] });
    const ids = sched.list().map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some((id) => id.includes('-1800-'))).toBe(false);
    // Today 07:30 already passed (08:00 local): 1 today + 2 × 6 days.
    expect(ids).toHaveLength(13);
  });

  it('program move and day rollover update content; finished day drops its reminder', async () => {
    await setup();
    await reminders.save({ enabled: true, times: ['18:00'] });
    const t = await service.loadTraining();
    const tue = t.week.find((w) => w.date === '2026-11-10')!;
    ok(await service.moveSession(tue.slotId, '2026-11-12'));
    expect((await reminders.reconcile()).state).toBe('scheduled');
    let byDate = (d: string) => sched.list().filter((x) => x.id.startsWith(`avci-${d}`));
    expect(byDate('2026-11-10')[0].body).toContain('toparlanma');
    expect(byDate('2026-11-12')).toHaveLength(1);
    expect(byDate('2026-11-12')[0].body).toContain(tue.title);

    // Today's workout done -> no reminder for today.
    const today = await service.loadToday();
    await service.recordCheckin(today.today!.id, goodCheckin);
    const s = ok(await service.startWorkout(t.week.find((w) => w.date === '2026-11-09')!.slotId));
    ok(await service.logSet(s.id, { exerciseId: 'bb-bench-press', kind: 'work', reps: 10, load: 40, unit: 'kg', rir: 2 }));
    ok(await service.finishWorkout(s.id));
    await reminders.reconcile();
    byDate = (d: string) => sched.list().filter((x) => x.id.startsWith(`avci-${d}`));
    expect(byDate('2026-11-09')).toHaveLength(0);

    clock.set('2026-11-10T05:00:00Z'); // next day
    await service.loadToday();
    await reminders.reconcile();
    const ids = sched.list().map((x) => x.id);
    expect(ids[0].startsWith('avci-2026-11-10')).toBe(true);
    expect(ids.at(-1)!.startsWith('avci-2026-11-16')).toBe(true);
    expect(new Set(ids).size).toBe(7);
  });

  it('permission denied: choice is saved, nothing scheduled, the app keeps working', async () => {
    await setup();
    sched.answer = 'denied';
    const r = await reminders.save({ enabled: true, times: ['18:00'] });
    expect(r).toEqual({ state: 'permission-denied', permission: 'denied' });
    expect(sched.list()).toEqual([]);
    expect((await reminders.status()).settings).toEqual({ enabled: true, times: ['18:00'] });
    // Not asked again on every reconcile; the rest of the app is unaffected.
    await reminders.reconcile();
    expect(sched.requests).toBe(1);
    const today = await service.loadToday();
    expect((await service.recordCheckin(today.today!.id, goodCheckin)).status).toBe('awarded');
    // Granted later in iOS Settings -> next reconcile schedules.
    sched.perm = 'granted';
    expect(await reminders.reconcile()).toMatchObject({ state: 'scheduled', count: 7 });
  });

  it('turning off cancels all AVCI reminders; unsupported platform schedules nothing', async () => {
    await setup();
    await reminders.save({ enabled: true, times: ['18:00'] });
    expect(await reminders.save({ enabled: false, times: ['18:00'] })).toEqual({ state: 'off' });
    expect(sched.list()).toEqual([]);
    await reminders.save({ enabled: true, times: ['18:00'] });
    sched.log = [];
    await reminders.wipe(); // delete-all: pending and delivered ones go
    expect(sched.log).toEqual(['cancelAll', 'clearDelivered']);
    expect(sched.list()).toEqual([]);
    const web = new FakeScheduler();
    web.supported = false;
    const webReminders = new ReminderService(repo, web, clock);
    expect(await webReminders.save({ enabled: true, times: ['18:00'] })).toEqual({ state: 'unsupported' });
    expect(web.requests).toBe(0);
    expect(web.list()).toEqual([]);
  });

  it('without a profile nothing is scheduled; a scheduler failure is reported, not thrown', async () => {
    expect(await reminders.save({ enabled: true, times: ['18:00'] })).toEqual({ state: 'off' });
    await setup();
    sched.perm = 'granted';
    sched.schedule = async () => {
      throw new Error('native failure');
    };
    expect(await reminders.reconcile()).toEqual({ state: 'error', message: 'native failure' });
    expect((await service.loadToday()).profile).not.toBeNull();
  });
});
