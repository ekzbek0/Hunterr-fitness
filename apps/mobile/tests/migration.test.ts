/// <reference types="node" />
/**
 * M0 -> M1 migration: storage written by the M0 schema (SQLite v1 / document v1)
 * opens with the M1 code with every profile, day, slot, check-in and ledger
 * row intact, and M1 features work on top of it.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDocumentRepository, DOCUMENT_SCHEMA_VERSION, type AvciDocument } from '@/data/document/document-repository';
import { indexedDbStorage } from '@/data/document/indexeddb-storage';
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from '@/data/sqlite/migrations';
import { createSqliteRepository } from '@/data/sqlite/sqlite-repository';
import { DRAFT_TRAINING_PROFILE } from '@/domain/training/profile';
import { AvciService } from '@/services/avci-service';

import { FakeClock } from './helpers';
import { nodeSqliteDriver } from './node-sqlite-driver';

const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const DAY_ID = '22222222-2222-4222-8222-222222222222';

describe('SQLite v1 (M0) -> v2 (M1)', () => {
  let dir = '';
  beforeEach(() => void (dir = mkdtempSync(join(tmpdir(), 'avci-mig-'))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  async function writeV1(path: string) {
    const d = nodeSqliteDriver(path);
    await d.exec('CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
    await d.exec(MIGRATIONS[0].sql);
    await d.run("INSERT INTO app_meta VALUES ('schema_version', '1')");
    await d.run('INSERT INTO profile VALUES (?, ?, ?, ?, ?, ?)', [PROFILE_ID, 'Europe/Istanbul', 2, '["walk10","mobility"]',
      '2026-11-09T06:00:00.000Z', '2026-11-09T06:00:00.000Z']);
    await d.run('INSERT INTO task_day VALUES (?, 1, ?, ?, ?, NULL, 2, ?)', [DAY_ID, '2026-11-09', 'Europe/Istanbul',
      '2026-11-09T06:00:00.000Z', '2026-11-09T06:30:00.000Z']);
    const slots: [string, string, string, number, string, string | null][] = [
      ['checkin', 'checkin', 'Günlük kontrol', 10, 'completed', null],
      ['core', 'core', 'Ana görev', 60, 'completed', 'training'],
      ['habit-1', 'habit', '10 dakika yürüyüş', 15, 'open', null],
      ['habit-2', 'habit', '5 dakika hareketlilik çalışması', 15, 'open', null],
    ];
    for (const [key, kind, title, xp, status, res] of slots) {
      await d.run('INSERT INTO quest_slot VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [DAY_ID, key, kind, title, xp, status, res,
        status === 'completed' ? '2026-11-09T06:20:00.000Z' : null, status === 'completed' ? 2 : 1]);
    }
    await d.run('INSERT INTO daily_checkin VALUES (?, 7, 4, 2, 1, ?, ?, ?)', [DAY_ID, 'no', 'no', '2026-11-09T06:10:00.000Z']);
    await d.run('INSERT INTO xp_ledger VALUES (?, ?, ?, ?, ?, 10, 2, 10, ?)', ['l1', PROFILE_ID, 'day', DAY_ID, 'checkin', '2026-11-09T06:10:00.000Z']);
    await d.run('INSERT INTO xp_ledger VALUES (?, ?, ?, ?, ?, 60, 2, 60, ?)', ['l2', PROFILE_ID, 'day', DAY_ID, 'core', '2026-11-09T06:20:00.000Z']);
    await d.close();
  }

  it('preserves every M0 record and enables M1 on top', async () => {
    const path = join(dir, 'avci.db');
    await writeV1(path);
    const driver = nodeSqliteDriver(path);
    const repo = await createSqliteRepository(driver, 'test');
    expect((await driver.first<{ value: string }>("SELECT value FROM app_meta WHERE key='schema_version'"))!.value).toBe(
      String(LATEST_SCHEMA_VERSION),
    );
    const clock = new FakeClock(new Date('2026-11-09T08:00:00Z'));
    const service = new AvciService(repo, clock);
    const s = await service.loadToday();
    expect(s.profile).toMatchObject({ id: PROFILE_ID, habitKeys: ['walk10', 'mobility'] });
    expect(s.today!.id).toBe(DAY_ID);
    expect(s.progress.totalXp).toBe(70);
    expect(s.checkin).toMatchObject({ energy: 4, illness: 'no' });
    expect(s.slots.map((x) => [x.slotKey, x.status, x.workoutSessionId])).toEqual([
      ['checkin', 'completed', null],
      ['core', 'completed', null],
      ['habit-1', 'open', null],
      ['habit-2', 'open', null],
    ]);
    expect(s.recentLedger.map((e) => e.id).sort()).toEqual(['l1', 'l2']);
    // M1 works on migrated data; the already-earned core is not rewarded again.
    expect(await service.confirmTrainingProfile(DRAFT_TRAINING_PROFILE)).toMatchObject({ status: 'ok' });
    const p = await service.proposeGeneratedProgram();
    if (p.status !== 'ok') throw new Error(p.reason);
    expect(await service.acceptProgram({ baseVersionId: null, program: p.value.program, source: 'generated' })).toMatchObject({ status: 'ok' });
    const t = await service.loadTraining();
    const start = await service.startWorkout(t.week[0].slotId);
    if (start.status !== 'ok') throw new Error(start.reason);
    await service.logSet(start.value.id, { exerciseId: start.value.exercises[0].exerciseId, kind: 'work', reps: 8, load: 50, unit: 'kg', rir: 2 });
    const fin = await service.finishWorkout(start.value.id);
    expect(fin.status === 'ok' && fin.value.reward.status).toBe('already-completed');
    expect((await service.loadToday()).progress.totalXp).toBe(70);
    await repo.close();

    // Re-opening an already migrated database is a no-op.
    const again = await createSqliteRepository(nodeSqliteDriver(path), 'test');
    expect((await new AvciService(again, clock).loadToday()).progress.totalXp).toBe(70);
    await again.close();
  });

  it('a failing migration rolls back and leaves v1 data readable', async () => {
    const path = join(dir, 'avci.db');
    await writeV1(path);
    const d = nodeSqliteDriver(path);
    // Simulate a half-applied/colliding state: a table v2 wants to create already exists.
    await d.exec('CREATE TABLE set_log (id TEXT);');
    await expect(createSqliteRepository(d, 'test')).rejects.toThrow();
    expect((await d.first<{ value: string }>("SELECT value FROM app_meta WHERE key='schema_version'"))!.value).toBe('1');
    expect((await d.first<{ n: number }>('SELECT COUNT(*) AS n FROM xp_ledger'))!.n).toBe(2);
    expect(await d.first("SELECT name FROM sqlite_master WHERE name = 'workout_session'")).toBeNull();
    await d.close();
  });
});

describe('IndexedDB document v1 (M0) -> v2 (M1)', () => {
  it('preserves every M0 record and enables M1 on top', async () => {
    const factory = new IDBFactory();
    const storage = indexedDbStorage(factory, 'avci');
    const v1 = {
      schemaVersion: 1,
      profile: { id: PROFILE_ID, timezone: 'Europe/Istanbul', multiplierHalves: 2, habitKeys: ['walk10', 'mobility'],
        createdAt: '2026-11-09T06:00:00.000Z', confirmedAt: '2026-11-09T06:00:00.000Z' },
      taskDays: [{ id: DAY_ID, sequence: 1, localDate: '2026-11-09', timezone: 'Europe/Istanbul', openedAt: '2026-11-09T06:00:00.000Z',
        closedAt: null, multiplierHalves: 2, lastSeenAt: '2026-11-09T06:30:00.000Z' }],
      slots: [
        { taskDayId: DAY_ID, slotKey: 'checkin', kind: 'checkin', title: 'Günlük kontrol', baseXp: 10, status: 'completed', resolution: null, completedAt: '2026-11-09T06:10:00.000Z', version: 2 },
        { taskDayId: DAY_ID, slotKey: 'core', kind: 'core', title: 'Ana görev', baseXp: 60, status: 'open', resolution: null, completedAt: null, version: 1 },
        { taskDayId: DAY_ID, slotKey: 'habit-1', kind: 'habit', title: '10 dakika yürüyüş', baseXp: 15, status: 'open', resolution: null, completedAt: null, version: 1 },
        { taskDayId: DAY_ID, slotKey: 'habit-2', kind: 'habit', title: '5 dakika hareketlilik çalışması', baseXp: 15, status: 'open', resolution: null, completedAt: null, version: 1 },
      ],
      checkins: [{ taskDayId: DAY_ID, sleepHours: null, energy: 3, fatigue: 2, soreness: 1, jointPain: 'no', illness: 'no', recordedAt: '2026-11-09T06:10:00.000Z' }],
      ledger: [{ id: 'l1', profileId: PROFILE_ID, scopeKind: 'day', scopeId: DAY_ID, slotKey: 'checkin', baseXp: 10, multiplierHalves: 2, awardedXp: 10, completedAt: '2026-11-09T06:10:00.000Z' }],
    } as unknown as AvciDocument;
    expect(await storage.commit(0, v1)).toBe(true);
    await storage.close();

    const clock = new FakeClock(new Date('2026-11-09T08:00:00Z'));
    const repo = await createDocumentRepository(indexedDbStorage(factory, 'avci'), 'test');
    const service = new AvciService(repo, clock);
    const s = await service.loadToday();
    expect(s.profile!.id).toBe(PROFILE_ID);
    expect(s.today!.id).toBe(DAY_ID);
    expect(s.progress.totalXp).toBe(10);
    expect(s.slots.every((x) => x.workoutSessionId === null)).toBe(true);
    // The open core from M0 can now be completed by a logged workout.
    expect(await service.confirmTrainingProfile(DRAFT_TRAINING_PROFILE)).toMatchObject({ status: 'ok' });
    const p = await service.proposeGeneratedProgram();
    if (p.status !== 'ok') throw new Error(p.reason);
    await service.acceptProgram({ baseVersionId: null, program: p.value.program, source: 'generated' });
    const t = await service.loadTraining();
    const start = await service.startWorkout(t.week[0].slotId);
    if (start.status !== 'ok') throw new Error(start.reason);
    await service.logSet(start.value.id, { exerciseId: start.value.exercises[0].exerciseId, kind: 'work', reps: 8, load: 50, unit: 'kg', rir: 2 });
    const fin = await service.finishWorkout(start.value.id);
    expect(fin.status === 'ok' && fin.value.reward.status === 'awarded' && fin.value.reward.entry.awardedXp).toBe(60);
    await repo.close();

    const stored = await indexedDbStorage(factory, 'avci').load();
    expect(stored!.doc.schemaVersion).toBe(DOCUMENT_SCHEMA_VERSION);
    expect(stored!.doc.ledger.map((e) => e.id)).toContain('l1');
  });

  it('a future document version is refused without modifying storage', async () => {
    const factory = new IDBFactory();
    const storage = indexedDbStorage(factory, 'avci');
    await storage.commit(0, { schemaVersion: 99 } as AvciDocument);
    await expect(createDocumentRepository(storage, 'test')).rejects.toThrow('şema 99');
    expect((await storage.load())!.doc.schemaVersion).toBe(99);
  });
});
