/// <reference types="node" />
/**
 * M1 -> M2 migration: storage written by the M1 schema (SQLite v2 / document v2)
 * opens with M2 code; plans, moves, sessions, sets and the XP ledger are intact,
 * and the weekly review + proposals work on top of them.
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
import { generateProgram } from '@/domain/training/program';
import { DRAFT_TRAINING_PROFILE, validateTrainingProfile } from '@/domain/training/profile';
import { AvciService } from '@/services/avci-service';

import { FakeClock } from './helpers';
import { nodeSqliteDriver } from './node-sqlite-driver';

const PID = '11111111-1111-4111-8111-111111111111';
const DAY = '22222222-2222-4222-8222-222222222222';
const PLAN = '33333333-3333-4333-8333-333333333333';
const SES = '44444444-4444-4444-8444-444444444444';
const facts = validateTrainingProfile(DRAFT_TRAINING_PROFILE);
const program = generateProgram(facts).program; // M1 JSON: no targetLoad keys
const { profileId: _p, confirmedAt: _c, ...factsOnly } = { ...facts, profileId: '', confirmedAt: '' };
const T0 = '2026-11-09T06:00:00.000Z';

describe('SQLite v2 (M1) -> v3 (M2)', () => {
  let dir = '';
  beforeEach(() => void (dir = mkdtempSync(join(tmpdir(), 'avci-mig3-'))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  async function writeV2(path: string) {
    const d = nodeSqliteDriver(path);
    await d.exec('CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
    await d.exec(MIGRATIONS[0].sql);
    await d.exec(MIGRATIONS[1].sql);
    await d.run("INSERT INTO app_meta VALUES ('schema_version', '2')");
    await d.run('INSERT INTO profile VALUES (?, ?, 2, ?, ?, ?)', [PID, 'Europe/Istanbul', '["walk10","mobility"]', T0, T0]);
    await d.run('INSERT INTO task_day VALUES (?, 1, ?, ?, ?, NULL, 2, ?)', [DAY, '2026-11-09', 'Europe/Istanbul', T0, T0]);
    for (const [k, kind, xp, st] of [['checkin', 'checkin', 10, 'completed'], ['core', 'core', 60, 'completed'],
      ['habit-1', 'habit', 15, 'open'], ['habit-2', 'habit', 15, 'open']] as const) {
      await d.run('INSERT INTO quest_slot VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)', [DAY, k, kind, k, xp, st,
        k === 'core' ? 'training' : null, st === 'completed' ? T0 : null, k === 'core' ? SES : null]);
    }
    await d.run('INSERT INTO daily_checkin VALUES (?, 7, 4, 2, 1, ?, ?, ?)', [DAY, 'no', 'no', T0]);
    await d.run('INSERT INTO xp_ledger VALUES (?, ?, ?, ?, ?, 10, 2, 10, ?)', ['l1', PID, 'day', DAY, 'checkin', T0]);
    await d.run('INSERT INTO xp_ledger VALUES (?, ?, ?, ?, ?, 60, 2, 60, ?)', ['l2', PID, 'day', DAY, 'core', T0]);
    await d.run('INSERT INTO training_profile VALUES (?, ?, ?)', [PID, JSON.stringify(factsOnly), T0]);
    await d.run('INSERT INTO plan_version VALUES (?, NULL, 1, ?, ?, ?, ?, ?)', [PLAN, 'generated', '[{"kind":"initial"}]', T0, T0,
      JSON.stringify(program)]);
    await d.run('INSERT INTO schedule_move VALUES (?, ?, ?, ?)', ['2026-11-09:pull-1', '2026-11-09', '2026-11-12', T0]);
    await d.run('INSERT INTO workout_session VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [SES, DAY, '2026-11-09:push-1', PLAN, 'push-1',
      'İtiş A', JSON.stringify(program.days[0].exercises), T0, T0, 'finished', 2]);
    await d.run('INSERT INTO set_log VALUES (?, ?, ?, ?, 1, 12, 60, ?, ?, 2, ?, ?)', ['s1', SES, 'bb-bench-press', 'work', 'kg', 'total', T0, T0]);
    await d.close();
  }

  it('preserves every M1 record and M2 works on top', async () => {
    const path = join(dir, 'avci.db');
    await writeV2(path);
    const driver = nodeSqliteDriver(path);
    const repo = await createSqliteRepository(driver, 'test');
    expect((await driver.first<{ value: string }>("SELECT value FROM app_meta WHERE key='schema_version'"))!.value).toBe(
      String(LATEST_SCHEMA_VERSION),
    );
    const service = new AvciService(repo, new FakeClock(new Date('2026-11-10T07:00:00Z')));
    const t = await service.loadTraining();
    expect(t.plan).toMatchObject({ id: PLAN, proposalId: null, sequence: 1 });
    expect(t.plan!.program).toEqual(program);
    expect(t.week.find((w) => w.programDayId === 'push-1')!.state).toBe('done');
    expect(t.week.find((w) => w.programDayId === 'pull-1')).toMatchObject({ date: '2026-11-12', moved: true });
    const sets = await repo.transaction((tx) => tx.listSets(SES));
    expect(sets.map((s) => [s.id, s.load, s.unit, s.loadConvention, s.rir])).toEqual([['s1', 60, 'kg', 'total', 2]]);
    expect((await repo.transaction((tx) => tx.getSession(SES)))!.restStartedAt).toBeNull();
    expect((await service.loadToday()).progress.totalXp).toBe(70);
    const review = await service.loadWeeklyReview();
    if (review.status !== 'ok') throw new Error(review.reason);
    expect((await service.completeWeeklyReview(review.value.cycle.id)).status).toBe('awarded');
    expect((await service.loadToday()).progress.totalXp).toBe(110);
    await repo.close();
  });

  it('a failing v3 migration rolls back and leaves v2 data readable', async () => {
    const path = join(dir, 'avci.db');
    await writeV2(path);
    const d = nodeSqliteDriver(path);
    await d.exec('CREATE TABLE equipment_increment (x TEXT);'); // collides with v3
    await expect(createSqliteRepository(d, 'test')).rejects.toThrow();
    expect((await d.first<{ value: string }>("SELECT value FROM app_meta WHERE key='schema_version'"))!.value).toBe('2');
    expect(await d.first("SELECT name FROM sqlite_master WHERE name = 'weekly_cycle'")).toBeNull();
    expect((await d.all('PRAGMA table_info(plan_version)')).some((c) => (c as { name: string }).name === 'proposal_id')).toBe(false);
    expect((await d.first<{ n: number }>('SELECT COUNT(*) AS n FROM set_log'))!.n).toBe(1);
    await d.close();
  });
});

describe('IndexedDB document v2 (M1) -> v3 (M2)', () => {
  it('carries plans, moves, sessions and sets over unchanged', async () => {
    const factory = new IDBFactory();
    const storage = indexedDbStorage(factory, 'avci');
    const v2 = {
      schemaVersion: 2,
      profile: { id: PID, timezone: 'Europe/Istanbul', multiplierHalves: 2, habitKeys: ['walk10', 'mobility'], createdAt: T0, confirmedAt: T0 },
      taskDays: [{ id: DAY, sequence: 1, localDate: '2026-11-09', timezone: 'Europe/Istanbul', openedAt: T0, closedAt: null, multiplierHalves: 2, lastSeenAt: T0 }],
      slots: [
        { taskDayId: DAY, slotKey: 'checkin', kind: 'checkin', title: 'c', baseXp: 10, status: 'completed', resolution: null, completedAt: T0, version: 2, workoutSessionId: null },
        { taskDayId: DAY, slotKey: 'core', kind: 'core', title: 'c', baseXp: 60, status: 'completed', resolution: 'training', completedAt: T0, version: 2, workoutSessionId: SES },
      ],
      checkins: [{ taskDayId: DAY, sleepHours: null, energy: 3, fatigue: 2, soreness: 1, jointPain: 'no', illness: 'no', recordedAt: T0 }],
      ledger: [
        { id: 'l1', profileId: PID, scopeKind: 'day', scopeId: DAY, slotKey: 'checkin', baseXp: 10, multiplierHalves: 2, awardedXp: 10, completedAt: T0 },
        { id: 'l2', profileId: PID, scopeKind: 'day', scopeId: DAY, slotKey: 'core', baseXp: 60, multiplierHalves: 2, awardedXp: 60, completedAt: T0 },
      ],
      trainingProfile: { ...facts, profileId: PID, confirmedAt: T0 },
      plans: [{ id: PLAN, parentId: null, sequence: 1, source: 'generated', reason: '[]', createdAt: T0, acceptedAt: T0, program }],
      moves: [{ slotId: '2026-11-09:pull-1', weekStart: '2026-11-09', toDate: '2026-11-12', movedAt: T0 }],
      sessions: [{ id: SES, taskDayId: DAY, scheduleSlotId: '2026-11-09:push-1', planVersionId: PLAN, programDayId: 'push-1', title: 'İtiş A',
        exercises: program.days[0].exercises, startedAt: T0, finishedAt: T0, status: 'finished', version: 2 }],
      sets: [{ id: 's1', sessionId: SES, exerciseId: 'bb-bench-press', kind: 'work', position: 1, reps: 12, load: 60, unit: 'kg',
        loadConvention: 'total', rir: 2, loggedAt: T0, updatedAt: T0 }],
    } as unknown as AvciDocument;
    expect(await storage.commit(0, v2)).toBe(true);
    await storage.close();

    const repo = await createDocumentRepository(indexedDbStorage(factory, 'avci'), 'test');
    const service = new AvciService(repo, new FakeClock(new Date('2026-11-10T07:00:00Z')));
    const t = await service.loadTraining();
    expect(t.plan).toMatchObject({ id: PLAN, proposalId: null });
    expect(t.week.find((w) => w.programDayId === 'pull-1')).toMatchObject({ date: '2026-11-12', moved: true });
    expect(t.week.find((w) => w.programDayId === 'push-1')!.state).toBe('done');
    expect((await service.loadToday()).progress.totalXp).toBe(70);
    await repo.close();
    const stored = await indexedDbStorage(factory, 'avci').load();
    expect(stored!.doc.schemaVersion).toBe(DOCUMENT_SCHEMA_VERSION);
    expect(stored!.doc.sets).toHaveLength(1);
    expect(stored!.doc.sessions[0]).toMatchObject({ restStartedAt: null, restDurationS: null });
    expect(stored!.doc.weeklyCycles).toHaveLength(1);
  });
});
