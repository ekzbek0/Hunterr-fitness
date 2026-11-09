import type { MultiplierHalves } from '@/domain/game/economy';
import type { CoreResolution, SlotKind } from '@/domain/game/quests';
import type { LoadConvention } from '@/domain/training/catalog';
import type { Program } from '@/domain/training/program';
import type { TriState } from '@/domain/training/readiness';
import type { LoadUnit, SetKind } from '@/domain/training/workout';

import type {
  AvciRepository,
  DailyCheckin,
  LedgerEntry,
  PlanVersion,
  Profile,
  QuestSlot,
  ScheduleMove,
  ScopeKind,
  SetLog,
  StoreTx,
  TaskDay,
  TrainingProfile,
  WorkoutSession,
  WorkoutStatus,
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
  workoutSessionId: optStr(r.workout_session_id),
});
const toTrainingProfile = (r: Row): TrainingProfile => ({
  ...(JSON.parse(str(r.facts)) as Omit<TrainingProfile, 'profileId' | 'confirmedAt'>),
  profileId: str(r.profile_id),
  confirmedAt: str(r.confirmed_at),
});
const toPlan = (r: Row): PlanVersion => ({
  id: str(r.id),
  parentId: optStr(r.parent_id),
  sequence: num(r.sequence),
  source: str(r.source) as PlanVersion['source'],
  reason: str(r.reason),
  createdAt: str(r.created_at),
  acceptedAt: str(r.accepted_at),
  program: JSON.parse(str(r.program)) as Program,
});
const toMove = (r: Row): ScheduleMove => ({
  slotId: str(r.slot_id),
  weekStart: str(r.week_start),
  toDate: str(r.to_date),
  movedAt: str(r.moved_at),
});
const toSession = (r: Row): WorkoutSession => ({
  id: str(r.id),
  taskDayId: str(r.task_day_id),
  scheduleSlotId: optStr(r.schedule_slot_id),
  planVersionId: str(r.plan_version_id),
  programDayId: str(r.program_day_id),
  title: str(r.title),
  exercises: JSON.parse(str(r.exercises)) as WorkoutSession['exercises'],
  startedAt: str(r.started_at),
  finishedAt: optStr(r.finished_at),
  status: str(r.status) as WorkoutStatus,
  version: num(r.version),
});
const toSet = (r: Row): SetLog => ({
  id: str(r.id),
  sessionId: str(r.session_id),
  exerciseId: str(r.exercise_id),
  kind: str(r.kind) as SetKind,
  position: num(r.position),
  reps: num(r.reps),
  load: num(r.load),
  unit: str(r.unit) as LoadUnit,
  loadConvention: str(r.load_convention) as LoadConvention,
  rir: r.rir === null || r.rir === undefined ? null : num(r.rir),
  loggedAt: str(r.logged_at),
  updatedAt: str(r.updated_at),
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
        `INSERT INTO quest_slot (task_day_id, slot_key, kind, title, base_xp, status, resolution, completed_at, version, workout_session_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.taskDayId, s.slotKey, s.kind, s.title, s.baseXp, s.status, s.resolution, s.completedAt, s.version, s.workoutSessionId],
      );
    },
    async updateSlot(s) {
      await d.run(
        `UPDATE quest_slot SET status = ?, resolution = ?, completed_at = ?, version = ?, workout_session_id = ?
         WHERE task_day_id = ? AND slot_key = ?`,
        [s.status, s.resolution, s.completedAt, s.version, s.workoutSessionId, s.taskDayId, s.slotKey],
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
    async getTrainingProfile() {
      const r = await d.first<Row>('SELECT * FROM training_profile LIMIT 1');
      return r ? toTrainingProfile(r) : null;
    },
    async putTrainingProfile(tp) {
      const { profileId, confirmedAt, ...facts } = tp;
      await d.run(
        `INSERT INTO training_profile (profile_id, facts, confirmed_at) VALUES (?, ?, ?)
         ON CONFLICT(profile_id) DO UPDATE SET facts = excluded.facts, confirmed_at = excluded.confirmed_at`,
        [profileId, JSON.stringify(facts), confirmedAt],
      );
    },
    async getLatestPlan() {
      const r = await d.first<Row>('SELECT * FROM plan_version ORDER BY sequence DESC LIMIT 1');
      return r ? toPlan(r) : null;
    },
    async getPlan(id) {
      const r = await d.first<Row>('SELECT * FROM plan_version WHERE id = ?', [id]);
      return r ? toPlan(r) : null;
    },
    async insertPlan(p) {
      await d.run(
        `INSERT INTO plan_version (id, parent_id, sequence, source, reason, created_at, accepted_at, program)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.parentId, p.sequence, p.source, p.reason, p.createdAt, p.acceptedAt, JSON.stringify(p.program)],
      );
    },
    async listPlans(limit) {
      const rows = await d.all<Row>('SELECT * FROM plan_version ORDER BY sequence DESC LIMIT ?', [limit]);
      return rows.map(toPlan);
    },
    async listMoves(weekStart) {
      const rows = await d.all<Row>('SELECT * FROM schedule_move WHERE week_start = ?', [weekStart]);
      return rows.map(toMove);
    },
    async putMove(m) {
      await d.run(
        `INSERT INTO schedule_move (slot_id, week_start, to_date, moved_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(slot_id) DO UPDATE SET to_date = excluded.to_date, moved_at = excluded.moved_at`,
        [m.slotId, m.weekStart, m.toDate, m.movedAt],
      );
    },
    async getActiveSession() {
      const r = await d.first<Row>("SELECT * FROM workout_session WHERE status = 'in-progress' LIMIT 1");
      return r ? toSession(r) : null;
    },
    async getSession(id) {
      const r = await d.first<Row>('SELECT * FROM workout_session WHERE id = ?', [id]);
      return r ? toSession(r) : null;
    },
    async insertSession(s) {
      await d.run(
        `INSERT INTO workout_session (id, task_day_id, schedule_slot_id, plan_version_id, program_day_id, title, exercises,
           started_at, finished_at, status, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.taskDayId, s.scheduleSlotId, s.planVersionId, s.programDayId, s.title, JSON.stringify(s.exercises),
          s.startedAt, s.finishedAt, s.status, s.version],
      );
    },
    async updateSession(s) {
      // Identity, origin day and prescription snapshot are immutable.
      await d.run('UPDATE workout_session SET finished_at = ?, status = ?, version = ? WHERE id = ?', [
        s.finishedAt,
        s.status,
        s.version,
        s.id,
      ]);
    },
    async listSessionsForWeek(weekStart) {
      const rows = await d.all<Row>(
        "SELECT * FROM workout_session WHERE schedule_slot_id LIKE ? || ':%' ORDER BY started_at",
        [weekStart],
      );
      return rows.map(toSession);
    },
    async listRecentSessions(limit) {
      const rows = await d.all<Row>('SELECT * FROM workout_session ORDER BY started_at DESC, rowid DESC LIMIT ?', [limit]);
      return rows.map(toSession);
    },
    async listSets(sessionId) {
      const rows = await d.all<Row>('SELECT * FROM set_log WHERE session_id = ? ORDER BY position', [sessionId]);
      return rows.map(toSet);
    },
    async getSet(id) {
      const r = await d.first<Row>('SELECT * FROM set_log WHERE id = ?', [id]);
      return r ? toSet(r) : null;
    },
    async insertSet(x) {
      await d.run(
        `INSERT INTO set_log (id, session_id, exercise_id, kind, position, reps, load, unit, load_convention, rir, logged_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [x.id, x.sessionId, x.exerciseId, x.kind, x.position, x.reps, x.load, x.unit, x.loadConvention, x.rir, x.loggedAt, x.updatedAt],
      );
    },
    async updateSet(x) {
      await d.run('UPDATE set_log SET kind = ?, reps = ?, load = ?, unit = ?, rir = ?, updated_at = ? WHERE id = ?', [
        x.kind,
        x.reps,
        x.load,
        x.unit,
        x.rir,
        x.updatedAt,
        x.id,
      ]);
    },
    async deleteSet(id) {
      await d.run('DELETE FROM set_log WHERE id = ?', [id]);
    },
    async listFinishedSetsForExercise(exerciseId, limit) {
      const rows = await d.all<Row>(
        `SELECT s.* FROM set_log s JOIN workout_session w ON w.id = s.session_id
         WHERE s.exercise_id = ? AND w.status = 'finished'
         ORDER BY w.started_at DESC, s.position ASC LIMIT ?`,
        [exerciseId, limit],
      );
      return rows.map(toSet);
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
