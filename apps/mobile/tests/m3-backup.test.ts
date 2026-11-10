/// <reference types="node" />
/**
 * M3 backup / restore / delete-all on both real adapters. Synthetic data only.
 * 2026-11-09 is a Monday (Istanbul, UTC+3).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AvciRepository, BackupData, StoreTx } from '@/data/types';
import { canonicalJson } from '@/domain/backup/canonical-json';
import { checkBackupClock } from '@/domain/backup/clock';
import { backupChecksum, BACKUP_VERSION } from '@/domain/backup/format';
import { sha256Hex } from '@/domain/backup/sha256';
import { DRAFT_TRAINING_PROFILE } from '@/domain/training/profile';
import { AvciService } from '@/services/avci-service';
import { BackupService, emptyBackupData } from '@/services/backup-service';

import { backends, FakeClock, goodCheckin } from './helpers';

function ok<T>(r: { status: 'ok'; value: T } | { status: 'rejected'; reason: string }): T {
  if (r.status !== 'ok') throw new Error(`expected ok, got ${r.reason}`);
  return r.value;
}
const dump = (repo: AvciRepository) => repo.transaction((tx) => tx.dumpAll());
/** Order-independent comparison: both adapters must hold the same records. */
const norm = (d: BackupData) => {
  const sorted = Object.fromEntries(
    Object.entries(d).map(([k, v]) => [k, Array.isArray(v) ? [...v].map((x) => canonicalJson(x)).sort() : v]),
  );
  return canonicalJson(sorted);
};

/** Realistic M0–M3 data: profile, check-in, workout with sets, XP, weekly review, measurement, settings. */
async function seed(repo: AvciRepository, clock: FakeClock) {
  const service = new AvciService(repo, clock);
  await service.createProfile({});
  ok(await service.confirmTrainingProfile(DRAFT_TRAINING_PROFILE));
  const p = ok(await service.proposeGeneratedProgram());
  ok(await service.acceptProgram({ baseVersionId: null, program: p.program, source: 'generated' }));
  const today = await service.loadToday();
  await service.recordCheckin(today.today!.id, goodCheckin);
  const t = await service.loadTraining();
  const s = ok(await service.startWorkout(t.week.find((w) => w.date === '2026-11-09')!.slotId));
  ok(await service.logSet(s.id, { exerciseId: 'bb-bench-press', kind: 'warmup', reps: 10, load: 20, unit: 'kg', rir: null }));
  for (let i = 0; i < 3; i++) {
    ok(await service.logSet(s.id, { exerciseId: 'bb-bench-press', kind: 'work', reps: 12, load: 60, unit: 'kg', rir: 2 }));
  }
  ok(await service.finishWorkout(s.id));
  ok(await service.confirmIncrement('barbell', 'kg', 2.5));
  const review = ok(await service.loadWeeklyReview());
  expect((await service.completeWeeklyReview(review.cycle.id)).status).toBe('awarded');
  await repo.transaction(async (tx) => {
    await tx.insertMeasurement({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', type: 'waist', value: 80, unit: 'cm', measuredOn: '2026-11-09',
      recordedAt: clock.now().toISOString(), deletedAt: null,
    });
    await tx.putSettings({ speechEnabled: false, reminders: { enabled: true, times: ['07:30'] } });
  });
  return service;
}

function tamper(json: string, edit: (data: BackupData) => void, fixChecksum = true): string {
  const env = JSON.parse(json);
  edit(env.data);
  if (fixChecksum) env.checksum = backupChecksum(env.data);
  return JSON.stringify(env);
}

describe('backup vs device clock (pure)', () => {
  const day = (over: Partial<BackupData['taskDays'][number]>) =>
    ({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', sequence: 1, localDate: '2026-11-09', timezone: 'Europe/Istanbul',
      openedAt: '2026-11-09T05:00:00.000Z', closedAt: null, multiplierHalves: 2, lastSeenAt: '2026-11-09T05:00:00.000Z', ...over,
    }) as BackupData['taskDays'][number];
  const data = (...taskDays: BackupData['taskDays']) => ({ ...emptyBackupData(), taskDays });
  const at = (iso: string) => new Date(iso);

  it('accepts a backup whose latest day is not ahead of the clock (tolerance included)', () => {
    expect(checkBackupClock(data(), at('2020-01-01T00:00:00Z'))).toEqual([]);
    expect(checkBackupClock(data(day({})), at('2026-11-09T05:00:00Z'))).toEqual([]);
    // 4 minutes behind the high-water mark: inside the 5 minute tolerance the task-day rule uses.
    expect(checkBackupClock(data(day({})), at('2026-11-09T04:56:00Z'))).toEqual([]);
  });

  it('refuses when the clock is behind the high-water mark beyond the tolerance', () => {
    const issues = checkBackupClock(data(day({})), at('2026-11-09T04:54:00Z'));
    expect(issues.map((x) => [x.code, x.path])).toEqual([['clock', 'taskDays[0].lastSeenAt']]);
  });

  it('refuses a latest day dated after "now" in that day\'s own timezone, even with an old lastSeenAt', () => {
    const issues = checkBackupClock(data(day({ localDate: '2026-11-11' })), at('2026-11-09T12:00:00Z'));
    expect(issues.map((x) => [x.code, x.path])).toEqual([['clock', 'taskDays[0].localDate']]);
  });

  it('judges the date in the day\'s captured timezone, so a backup made further east is not refused after travel', () => {
    // Opened 2026-11-10 00:30 in Tokyo = 2026-11-09 15:30 UTC; it is still the 9th in Istanbul.
    const tokyo = day({ localDate: '2026-11-10', timezone: 'Asia/Tokyo', openedAt: '2026-11-09T15:30:00.000Z', lastSeenAt: '2026-11-09T15:30:00.000Z' });
    expect(checkBackupClock(data(tokyo), at('2026-11-09T15:31:00Z'))).toEqual([]);
  });

  it('only the latest day (highest sequence) is compared', () => {
    const old = day({ lastSeenAt: '2026-11-09T20:00:00.000Z' });
    const latest = day({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', sequence: 2, localDate: '2026-11-10', openedAt: '2026-11-10T05:00:00.000Z', lastSeenAt: '2026-11-10T05:00:00.000Z' });
    expect(checkBackupClock(data(old, latest), at('2026-11-10T05:00:00Z'))).toEqual([]);
  });
});

describe('backup primitives', () => {
  it('sha256 matches known vectors; canonical JSON ignores key order', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('İtiş günü ✓')).toBe(sha256Hex('İtiş günü ✓'));
    expect(canonicalJson({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(canonicalJson({ a: [{ c: 2, d: 1 }], b: 1 }));
  });
});

describe.each(backends)('backup service ($name)', (backend) => {
  let repo: AvciRepository;
  let clock: FakeClock;
  let backup: BackupService;

  beforeEach(async () => {
    backend.setup();
    clock = new FakeClock(new Date('2026-11-09T07:00:00Z'));
    repo = await backend.open();
    backup = new BackupService(repo, clock);
  });
  afterEach(async () => {
    await repo.close();
    backend.teardown();
  });

  it('when the current records cannot be read, a valid backup can still be previewed and restored', async () => {
    await seed(repo, clock);
    const { json } = await backup.exportBackup();
    const expected = norm(await dump(repo));
    // Simulate unreadable current storage: the read used for the "now" column fails.
    const broken: AvciRepository = {
      ...repo,
      kind: repo.kind,
      transaction: (fn) => repo.transaction((tx) => fn({ ...tx, dumpAll: () => Promise.reject(new Error('malformed row')) } as StoreTx)),
    };
    const svc = new BackupService(broken, clock);
    const preview = await svc.previewImport(json);
    expect(preview.ok).toBe(true);
    if (preview.ok) expect(preview.current).toBeNull();
    // Restore itself goes through the real repository (its read-back must work after replaceAll).
    expect((await backup.importBackup(json)).status).toBe('restored');
    expect(norm(await dump(repo))).toBe(expected);
  });

  it('round-trip: export -> delete all -> import restores every record; survives a restart', async () => {
    await seed(repo, clock);
    const before = await dump(repo);
    const out = await backup.exportBackup();
    expect(out.fileName).toBe('avci-yedek-2026-11-09.json');
    expect(out.issues).toEqual([]);
    expect(JSON.parse(out.json)).toMatchObject({ format: 'avci-backup', version: BACKUP_VERSION });
    expect(out.summary.totalXp).toBe(110); // 10 + 60 + 40
    expect(before.sets).toHaveLength(4);
    expect(before.plans.length).toBeGreaterThan(0);
    expect(before.weeklyReviews).toHaveLength(1);

    expect(await backup.deleteAllData(async () => undefined)).toMatchObject({ status: 'deleted' });
    expect((await dump(repo)).ledger).toEqual([]);

    const preview = await backup.previewImport(out.json);
    if (!preview.ok) throw new Error('preview rejected');
    expect(preview.replacesAll).toBe(true);
    expect(preview.current?.totalXp).toBe(0);
    expect(preview.backup.totalXp).toBe(110);
    expect(preview.backup.counts).toMatchObject({ sessions: 1, sets: 4, measurements: 1, weeklyReviews: 1 });
    expect((await dump(repo)).profile).toBeNull(); // preview writes nothing

    expect((await backup.importBackup(out.json)).status).toBe('restored');
    expect(norm(await dump(repo))).toBe(norm(before));
    await repo.close();
    repo = await backend.open();
    expect(norm(await dump(repo))).toBe(norm(before));
    const service = new AvciService(repo, clock);
    expect((await service.loadToday()).progress.totalXp).toBe(110);
    expect((await service.loadTraining()).week.find((w) => w.date === '2026-11-09')!.state).toBe('done');
  });

  it('re-importing the same backup never doubles XP, and rewards stay claimed', async () => {
    const service = await seed(repo, clock);
    const { json } = await backup.exportBackup();
    for (let i = 0; i < 3; i++) expect((await backup.importBackup(json)).status).toBe('restored');
    const after = await dump(repo);
    expect(after.ledger).toHaveLength(3);
    expect((await service.loadToday()).progress.totalXp).toBe(110);
    // The restored week cannot be rewarded again.
    const review = ok(await service.loadWeeklyReview());
    expect((await service.completeWeeklyReview(review.cycle.id)).status).not.toBe('awarded');
    expect((await service.loadToday()).progress.totalXp).toBe(110);
  });

  it('corrupt or unsupported files are rejected and existing data does not change', async () => {
    await seed(repo, clock);
    const { json } = await backup.exportBackup();
    // Different current data than the file, so an accidental write would be visible.
    await repo.transaction((tx) => tx.putSettings({ speechEnabled: true, reminders: { enabled: false, times: [] } }));
    const before = norm(await dump(repo));
    const env = JSON.parse(json);
    const bad: Record<string, string> = {
      'not json': '{ this is not json',
      'truncated': json.slice(0, json.length / 2),
      'unknown format': JSON.stringify({ ...env, format: 'something-else' }),
      'future version': JSON.stringify({ ...env, version: BACKUP_VERSION + 1 }),
      'checksum mismatch': tamper(json, (d) => void (d.ledger[0].awardedXp = 9999), false),
      'tampered XP with a fixed checksum': tamper(json, (d) => void (d.ledger[0].awardedXp = 9999)),
      'dangling set.sessionId': tamper(json, (d) => void (d.sets[0].sessionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')),
      'duplicate id': tamper(json, (d) => void d.sets.push({ ...d.sets[0] })),
      'duplicate ledger key': tamper(json, (d) => void d.ledger.push({ ...d.ledger[0], id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })),
      'invalid set value': tamper(json, (d) => void (d.sets[0].reps = -3)),
      'missing table': tamper(json, (d) => void delete (d as Partial<BackupData>).sessions),
      'ledger for another profile': tamper(json, (d) => void (d.ledger[0].profileId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')),
      'bad settings time': tamper(json, (d) => void (d.settings.reminders.times = ['25:00'])),
    };
    for (const [name, text] of Object.entries(bad)) {
      const preview = await backup.previewImport(text);
      expect(preview.ok, name).toBe(false);
      if (!preview.ok) expect(preview.errors[0].message.length, name).toBeGreaterThan(0);
      expect((await backup.importBackup(text)).status, name).toBe('rejected');
      expect(norm(await dump(repo)), name).toBe(before);
    }
  });

  // The two files the independent check found accepted. Each is its own test so the
  // failure before the fix is visible per case (verified red against the old validator).
  it('REGRESSION: a task day without its quests is rejected (was: restore succeeded and the day lost its quests)', async () => {
    await seed(repo, clock);
    const { json } = await backup.exportBackup();
    const before = norm(await dump(repo));
    const text = tamper(json, (d) => {
      const day = d.taskDays[0];
      d.taskDays.push({ ...day, id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', sequence: day.sequence + 1, localDate: '2026-11-10' });
    });
    expect((await backup.previewImport(text)).ok).toBe(false);
    expect((await backup.importBackup(text)).status).toBe('rejected');
    expect(norm(await dump(repo))).toBe(before);
  });

  it('REGRESSION: a completed quest without its XP entry is rejected (was: XP dropped and could not be earned again)', async () => {
    const service = await seed(repo, clock);
    const { json } = await backup.exportBackup();
    const before = norm(await dump(repo));
    const text = tamper(json, (d) => void (d.ledger = d.ledger.filter((e) => e.slotKey !== 'core')));
    expect((await backup.previewImport(text)).ok).toBe(false);
    expect((await backup.importBackup(text)).status).toBe('rejected');
    expect(norm(await dump(repo))).toBe(before);
    expect((await service.loadToday()).progress.totalXp).toBe(110);
  });

  it('REGRESSION: an accepted file must leave the app able to open (day/week order follows sequence)', async () => {
    const service = await seed(repo, clock);
    const { json } = await backup.exportBackup();
    const before = norm(await dump(repo));
    const cases: Record<string, (d: BackupData) => void> = {
      'later task day with an earlier date': (d) => {
        const day = d.taskDays[0];
        d.taskDays.push({ ...day, id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', sequence: 99, localDate: '2026-11-01' });
        for (const sl of d.slots.filter((x) => x.taskDayId === day.id)) {
          d.slots.push({ ...sl, taskDayId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', status: 'open', completedAt: null, resolution: null, workoutSessionId: null });
        }
      },
      'later weekly cycle with an earlier week': (d) => {
        const c = d.weeklyCycles[0];
        d.weeklyCycles.push({ ...c, id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', sequence: 99, weekStart: '2026-11-02', weekEnd: '2026-11-08' });
      },
      'weekly cycle that starts after the latest task day (the week would never change again)': (d) => {
        const c = d.weeklyCycles[0];
        d.weeklyCycles.push({ ...c, id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', sequence: 99, weekStart: '2027-03-01', weekEnd: '2027-03-07' });
      },
    };
    for (const [name, edit] of Object.entries(cases)) {
      const text = tamper(json, edit);
      const r = await backup.importBackup(text);
      // Either the file is refused, or the app must still open afterwards. Refusal is the rule.
      expect(r.status, name).toBe('rejected');
      expect(norm(await dump(repo)), name).toBe(before);
      await expect(service.loadToday(), name).resolves.toBeTruthy();
    }
  });

  it('REGRESSION: a backup from the future is refused (it would freeze rewards or pin "today" for good)', async () => {
    const service = await seed(repo, clock);
    const { json } = await backup.exportBackup();
    const before = norm(await dump(repo));
    const refused = async (name: string, text: string) => {
      const preview = await backup.previewImport(text);
      expect(preview.ok, name).toBe(false);
      if (!preview.ok) {
        expect(preview.errors[0].code, name).toBe('clock');
        expect(preview.errors[0].message, name).toMatch(/saat|gelecek/i);
      }
      expect((await backup.importBackup(text)).status, name).toBe('rejected');
      expect(norm(await dump(repo)), name).toBe(before);
    };
    await refused(
      'lastSeenAt far ahead of the device clock',
      tamper(json, (d) => void (d.taskDays[0].lastSeenAt = '2099-01-01T00:00:00.000Z')),
    );
    // The untouched file on a device whose clock is a day behind the backup's latest day.
    const exportedAtClock = clock.now().toISOString();
    clock.set('2026-11-08T06:00:00Z');
    await refused('device clock a day behind the backup', json);
    // With the clock back where it was (or later) the same file restores fine.
    clock.set(exportedAtClock);
    expect((await backup.previewImport(json)).ok).toBe(true);
    clock.set('2026-11-09T09:00:00Z');
    expect((await backup.importBackup(json)).status).toBe('restored');
    expect((await service.loadToday()).rewardsFrozen).toBe(false);
  });

  it('REGRESSION: quests and XP must agree in both directions; inconsistent files are rejected, nothing is repaired', async () => {
    const service = await seed(repo, clock);
    const { json } = await backup.exportBackup();
    await repo.transaction((tx) => tx.putSettings({ speechEnabled: true, reminders: { enabled: false, times: [] } }));
    const before = norm(await dump(repo));
    const OTHER_DAY = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const cases: Record<string, (d: BackupData) => void> = {
      'task day with an empty slots list': (d) => void (d.slots = []),
      'task day missing one required slot': (d) => void (d.slots = d.slots.filter((x) => x.slotKey !== 'habit-2')),
      'unknown extra slot': (d) => void d.slots.push({ ...d.slots.find((x) => x.slotKey === 'habit-1')!, slotKey: 'habit-3' }),
      'slot kind does not match its key': (d) => void (d.slots.find((x) => x.slotKey === 'habit-1')!.kind = 'core'),
      'completed quest without its XP entry': (d) => void (d.ledger = d.ledger.filter((e) => e.slotKey !== 'core')),
      'completed check-in without its XP entry': (d) => void (d.ledger = d.ledger.filter((e) => e.slotKey !== 'checkin')),
      'XP entry for an open quest': (d) => {
        const core = d.slots.find((x) => x.slotKey === 'core')!;
        Object.assign(core, { status: 'open', completedAt: null, resolution: null, workoutSessionId: null });
      },
      'weekly review without the weekly reward': (d) => void (d.ledger = d.ledger.filter((e) => e.scopeKind !== 'week')),
      'weekly reward without a weekly review': (d) => void (d.weeklyReviews = []),
      'check-in record without a completed check-in quest': (d) => {
        const c = d.slots.find((x) => x.slotKey === 'checkin')!;
        Object.assign(c, { status: 'open', completedAt: null });
        d.ledger = d.ledger.filter((e) => e.slotKey !== 'checkin');
      },
      'completed check-in quest without a check-in record': (d) => void (d.checkins = []),
      'core quest linked to a workout of another task day': (d) => {
        const day = d.taskDays[0];
        d.taskDays.push({ ...day, id: OTHER_DAY, sequence: day.sequence + 1, localDate: '2026-11-10' });
        for (const sl of d.slots.filter((x) => x.taskDayId === day.id)) {
          d.slots.push({ ...sl, taskDayId: OTHER_DAY, status: 'open', completedAt: null, resolution: null, workoutSessionId: null });
        }
        d.sessions[0].taskDayId = OTHER_DAY;
      },
      'core quest linked to an unfinished workout': (d) => void Object.assign(d.sessions[0], { status: 'abandoned' }),
      'workout whose schedule slot belongs to another week': (d) => void (d.sessions[0].scheduleSlotId = `2026-11-02:${d.sessions[0].programDayId}`),
      'records without a profile': (d) => {
        d.profile = null;
        d.trainingProfile = null;
        d.ledger = [];
      },
    };
    for (const [name, edit] of Object.entries(cases)) {
      const text = tamper(json, edit); // checksum recomputed: only the consistency rules can catch it
      const preview = await backup.previewImport(text);
      expect(preview.ok, name).toBe(false);
      if (!preview.ok) expect(preview.errors.some((e) => e.code === 'reference' || e.code === 'value'), name).toBe(true);
      expect((await backup.importBackup(text)).status, name).toBe('rejected');
      expect(norm(await dump(repo)), name).toBe(before);
    }
    // The untouched file is still accepted, and XP/quests are intact afterwards.
    expect((await backup.importBackup(json)).status).toBe('restored');
    const today = await service.loadToday();
    expect(today.progress.totalXp).toBe(110);
    expect(today.slots.map((x) => x.slotKey).sort()).toEqual(['checkin', 'core', 'habit-1', 'habit-2']);
  });

  it('a failure while writing rolls the whole restore back', async () => {
    await seed(repo, clock);
    const { json } = await backup.exportBackup();
    await repo.transaction((tx) => tx.putSettings({ speechEnabled: true, reminders: { enabled: false, times: [] } }));
    const before = norm(await dump(repo));
    const failing: AvciRepository = {
      kind: repo.kind,
      close: () => repo.close(),
      purgeDeleted: () => repo.purgeDeleted(),
      transaction: (fn) =>
        repo.transaction((tx) =>
          fn(
            new Proxy(tx, {
              get(target, prop) {
                if (prop !== 'replaceAll') return Reflect.get(target, prop).bind(target);
                return async (data: BackupData) => {
                  await target.replaceAll(data); // everything written...
                  throw new Error('disk full'); // ...then the transaction fails
                };
              },
            }) as StoreTx,
          ),
        ),
    };
    expect((await new BackupService(failing, clock).importBackup(json)).status).toBe('failed');
    expect(norm(await dump(repo))).toBe(before);
    expect((await new BackupService(failing, clock).deleteAllData(async () => undefined)).status).toBe('failed');
    expect(norm(await dump(repo))).toBe(before);
  });

  it('delete all: reminders are cancelled first, every record is cleared, nothing comes back', async () => {
    await seed(repo, clock);
    const order: string[] = [];
    const r = await backup.deleteAllData(async () => {
      order.push(`cancel (profile still there: ${(await dump(repo)).profile !== null})`);
    });
    // SQLite rebuilds its file (secure_delete + WAL truncate + VACUUM); IndexedDB cannot promise that.
    expect(r).toEqual({ status: 'deleted', storagePurged: backend.name === 'SQLite' });
    expect(order).toEqual(['cancel (profile still there: true)']);
    const empty = await dump(repo);
    expect(empty.profile).toBeNull();
    expect(empty.trainingProfile).toBeNull();
    for (const [k, v] of Object.entries(empty)) if (Array.isArray(v)) expect(v, k).toEqual([]);
    expect(empty.settings).toEqual({ speechEnabled: true, reminders: { enabled: false, times: [] } });
    // Reopen: still empty (no automatic restore), and the app starts from onboarding.
    await repo.close();
    repo = await backend.open();
    expect((await dump(repo)).profile).toBeNull();
    const today = await new AvciService(repo, clock).loadToday();
    expect(today.profile).toBeNull();
    expect(today.progress.totalXp).toBe(0);
  });

  it('privacy: a legacy tombstoned measurement is not exported; reminder choice is shown in the preview', async () => {
    await seed(repo, clock);
    await repo.transaction((tx) =>
      tx.insertMeasurement({
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', type: 'body-weight', value: 123.4, unit: 'kg', measuredOn: '2026-11-08',
        recordedAt: clock.now().toISOString(), deletedAt: clock.now().toISOString(),
      }),
    );
    const out = await backup.exportBackup();
    expect(out.json).not.toContain('ffffffff-ffff-4fff-8fff-ffffffffffff');
    expect(out.json).not.toContain('123.4');
    expect(out.summary.counts.deletedMeasurements).toBe(0);
    const preview = await backup.previewImport(out.json);
    if (!preview.ok) throw new Error('preview rejected');
    expect(preview.backupReminders).toEqual({ enabled: true, times: ['07:30'] });
  });

  it('delete all aborts without deleting when reminders cannot be cancelled', async () => {
    await seed(repo, clock);
    const before = norm(await dump(repo));
    const r = await backup.deleteAllData(async () => {
      throw new Error('scheduler down');
    });
    expect(r).toMatchObject({ status: 'failed', stage: 'reminders' });
    expect(norm(await dump(repo))).toBe(before);
  });
});

describe('backup moves between storage kinds', () => {
  it('SQLite export restores into IndexedDB and back with identical records', async () => {
    const clock = new FakeClock(new Date('2026-11-09T07:00:00Z'));
    const [sqlite, idb] = backends;
    sqlite.setup();
    idb.setup();
    const a = await sqlite.open();
    const b = await idb.open();
    try {
      await seed(a, clock);
      const original = norm(await dump(a));
      const fromA = await new BackupService(a, clock).exportBackup();
      expect((await new BackupService(b, clock).importBackup(fromA.json)).status).toBe('restored');
      expect(norm(await dump(b))).toBe(original);
      const fromB = await new BackupService(b, clock).exportBackup();
      expect(JSON.parse(fromB.json).checksum).toBe(JSON.parse(fromA.json).checksum);
      expect((await new BackupService(a, clock).deleteAllData(async () => undefined)).status).toBe('deleted');
      expect((await new BackupService(a, clock).importBackup(fromB.json)).status).toBe('restored');
      expect(norm(await dump(a))).toBe(original);
    } finally {
      await a.close();
      await b.close();
      sqlite.teardown();
      idb.teardown();
    }
  });
});
