/// <reference types="node" />
/**
 * M3 backup / restore / delete-all on both real adapters. Synthetic data only.
 * 2026-11-09 is a Monday (Istanbul, UTC+3).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AvciRepository, BackupData, StoreTx } from '@/data/types';
import { canonicalJson } from '@/domain/backup/canonical-json';
import { backupChecksum, BACKUP_VERSION } from '@/domain/backup/format';
import { sha256Hex } from '@/domain/backup/sha256';
import { DRAFT_TRAINING_PROFILE } from '@/domain/training/profile';
import { AvciService } from '@/services/avci-service';
import { BackupService } from '@/services/backup-service';

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

    expect(await backup.deleteAllData(async () => undefined)).toEqual({ status: 'deleted' });
    expect((await dump(repo)).ledger).toEqual([]);

    const preview = await backup.previewImport(out.json);
    if (!preview.ok) throw new Error('preview rejected');
    expect(preview.replacesAll).toBe(true);
    expect(preview.current.totalXp).toBe(0);
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
    expect(r).toEqual({ status: 'deleted' });
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
