import type { MultiplierHalves } from '@/domain/game/economy';
import type { CoreResolution, SlotKind } from '@/domain/game/quests';
import type { TriState } from '@/domain/training/readiness';

import type {
  AvciRepository,
  DailyCheckin,
  LedgerEntry,
  Profile,
  QuestSlot,
  ScopeKind,
  StoreTx,
  TaskDay,
} from '../types';
import type { SqlDriver } from './driver';
import { migrate } from './migrations';

type Row = Record<string, unknown>;
const str = (v: unknown) => v as string;
const num = (v: unknown) => Number(v);
const optStr = (v: unknown) => (v === null || v === undefined ? null : String(v));

const toProfile = (r: Row): Profile => ({
  id: str(r.id),
  timezone: str(r.timezone),
  multiplierHalves: num(r.multiplier_halves) as MultiplierHalves,
  habitKeys: JSON.parse(str(r.habit_keys)) as [string, string],
  createdAt: str(r.created_at),
  confirmedAt: str(r.confirmed_at),
});
const toDay = (r: Row): TaskDay => ({
  id: str(r.id),
  sequence: num(r.sequence),
  localDate: str(r.local_date),
  timezone: str(r.timezone),
  openedAt: str(r.opened_at),
  closedAt: optStr(r.closed_at),
  multiplierHalves: num(r.multiplier_halves) as MultiplierHalves,
  lastSeenAt: str(r.last_seen_at),
});
const toSlot = (r: Row): QuestSlot => ({
  taskDayId: str(r.task_day_id),
  slotKey: str(r.slot_key),
  kind: str(r.kind) as SlotKind,
  title: str(r.title),
  baseXp: num(r.base_xp),
  status: str(r.status) as QuestSlot['status'],
  resolution: optStr(r.resolution) as CoreResolution | null,
  completedAt: optStr(r.completed_at),
  version: num(r.version),
});
const toCheckin = (r: Row): DailyCheckin => ({
  taskDayId: str(r.task_day_id),
  sleepHours: r.sleep_hours === null ? null : num(r.sleep_hours),
  energy: num(r.energy),
  fatigue: num(r.fatigue),
  soreness: num(r.soreness),
  jointPain: str(r.joint_pain) as TriState,
  illness: str(r.illness) as TriState,
  recordedAt: str(r.recorded_at),
});
const toLedger = (r: Row): LedgerEntry => ({
  id: str(r.id),
  profileId: str(r.profile_id),
  scopeKind: str(r.scope_kind) as ScopeKind,
  scopeId: str(r.scope_id),
  slotKey: str(r.slot_key),
  baseXp: num(r.base_xp),
  multiplierHalves: num(r.multiplier_halves) as MultiplierHalves,
  awardedXp: num(r.awarded_xp),
  completedAt: str(r.completed_at),
});

function sqlTx(d: SqlDriver): StoreTx {
  return {
    async getProfile() {
      const r = await d.first<Row>('SELECT * FROM profile LIMIT 1');
      return r ? toProfile(r) : null;
    },
    async putProfile(p) {
      await d.run(
        `INSERT INTO profile (id, timezone, multiplier_halves, habit_keys, created_at, confirmed_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET timezone = excluded.timezone,
           multiplier_halves = excluded.multiplier_halves, habit_keys = excluded.habit_keys,
           confirmed_at = excluded.confirmed_at`,
        [p.id, p.timezone, p.multiplierHalves, JSON.stringify(p.habitKeys), p.createdAt, p.confirmedAt],
      );
    },
    async getLatestTaskDay() {
      const r = await d.first<Row>('SELECT * FROM task_day ORDER BY sequence DESC LIMIT 1');
      return r ? toDay(r) : null;
    },
    async getTaskDay(id) {
      const r = await d.first<Row>('SELECT * FROM task_day WHERE id = ?', [id]);
      return r ? toDay(r) : null;
    },
    async insertTaskDay(t) {
      await d.run(
        `INSERT INTO task_day (id, sequence, local_date, timezone, opened_at, closed_at, multiplier_halves, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, t.sequence, t.localDate, t.timezone, t.openedAt, t.closedAt, t.multiplierHalves, t.lastSeenAt],
      );
    },
    async updateTaskDay(t) {
      // Captured identity fields (date, timezone, multiplier) are immutable.
      await d.run('UPDATE task_day SET closed_at = ?, last_seen_at = ? WHERE id = ?', [
        t.closedAt,
        t.lastSeenAt,
        t.id,
      ]);
    },
    async listTaskDays(limit) {
      const rows = await d.all<Row>('SELECT * FROM task_day ORDER BY sequence DESC LIMIT ?', [limit]);
      return rows.map(toDay);
    },
    async listSlots(taskDayId) {
      const rows = await d.all<Row>('SELECT * FROM quest_slot WHERE task_day_id = ? ORDER BY rowid', [taskDayId]);
      return rows.map(toSlot);
    },
    async getSlot(taskDayId, slotKey) {
      const r = await d.first<Row>('SELECT * FROM quest_slot WHERE task_day_id = ? AND slot_key = ?', [
        taskDayId,
        slotKey,
      ]);
      return r ? toSlot(r) : null;
    },
    async insertSlot(s) {
      await d.run(
        `INSERT INTO quest_slot (task_day_id, slot_key, kind, title, base_xp, status, resolution, completed_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.taskDayId, s.slotKey, s.kind, s.title, s.baseXp, s.status, s.resolution, s.completedAt, s.version],
      );
    },
    async updateSlot(s) {
      await d.run(
        `UPDATE quest_slot SET status = ?, resolution = ?, completed_at = ?, version = ?
         WHERE task_day_id = ? AND slot_key = ?`,
        [s.status, s.resolution, s.completedAt, s.version, s.taskDayId, s.slotKey],
      );
    },
    async getCheckin(taskDayId) {
      const r = await d.first<Row>('SELECT * FROM daily_checkin WHERE task_day_id = ?', [taskDayId]);
      return r ? toCheckin(r) : null;
    },
    async putCheckin(c) {
      await d.run(
        `INSERT INTO daily_checkin (task_day_id, sleep_hours, energy, fatigue, soreness, joint_pain, illness, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(task_day_id) DO UPDATE SET sleep_hours = excluded.sleep_hours, energy = excluded.energy,
           fatigue = excluded.fatigue, soreness = excluded.soreness, joint_pain = excluded.joint_pain,
           illness = excluded.illness, recorded_at = excluded.recorded_at`,
        [c.taskDayId, c.sleepHours, c.energy, c.fatigue, c.soreness, c.jointPain, c.illness, c.recordedAt],
      );
    },
    async insertLedger(e) {
      const res = await d.run(
        `INSERT INTO xp_ledger (id, profile_id, scope_kind, scope_id, slot_key, base_xp, multiplier_halves, awarded_xp, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(profile_id, scope_kind, scope_id, slot_key) DO NOTHING`,
        [e.id, e.profileId, e.scopeKind, e.scopeId, e.slotKey, e.baseXp, e.multiplierHalves, e.awardedXp, e.completedAt],
      );
      return res.changes === 1 ? 'inserted' : 'conflict';
    },
    async findLedger(profileId, scopeKind, scopeId, slotKey) {
      const r = await d.first<Row>(
        'SELECT * FROM xp_ledger WHERE profile_id = ? AND scope_kind = ? AND scope_id = ? AND slot_key = ?',
        [profileId, scopeKind, scopeId, slotKey],
      );
      return r ? toLedger(r) : null;
    },
    async listLedger(limit) {
      const rows = await d.all<Row>('SELECT * FROM xp_ledger ORDER BY completed_at DESC, rowid DESC LIMIT ?', [limit]);
      return rows.map(toLedger);
    },
    async totalXp(profileId) {
      const r = await d.first<{ total: number | null }>(
        'SELECT SUM(awarded_xp) AS total FROM xp_ledger WHERE profile_id = ?',
        [profileId],
      );
      return Number(r?.total ?? 0);
    },
  };
}

export async function createSqliteRepository(driver: SqlDriver, kind: string): Promise<AvciRepository> {
  await driver.exec('PRAGMA foreign_keys = ON;');
  await migrate(driver);
  return {
    kind,
    transaction: (fn) => driver.transaction((d) => fn(sqlTx(d))),
    close: () => driver.close(),
  };
}
