import type { MultiplierHalves } from '@/domain/game/economy';
import type { CoreResolution, SlotKind } from '@/domain/game/quests';
import type { LoadConvention } from '@/domain/training/catalog';
import type { Program } from '@/domain/training/program';
import type { TriState } from '@/domain/training/readiness';
import type { LoadUnit, SetKind } from '@/domain/training/workout';

import { DEFAULT_SETTINGS } from '../types';
import type {
  AvciRepository,
  DailyCheckin,
  LedgerEntry,
  PlanVersion,
  Profile,
  QuestSlot,
  ScheduleMove,
  ScopeKind,
  EquipmentIncrement,
  ProgressionProposal,
  AppSettings,
  BackupData,
  Measurement,
  SetLog,
  WeeklyCycle,
  WeeklyReview,
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
  proposalId: optStr(r.proposal_id),
});
const toCycle = (r: Row): WeeklyCycle => ({
  id: str(r.id),
  sequence: num(r.sequence),
  weekStart: str(r.week_start),
  weekEnd: str(r.week_end),
  timezone: str(r.timezone),
  openedAt: str(r.opened_at),
  closedAt: optStr(r.closed_at),
  multiplierHalves: num(r.multiplier_halves) as MultiplierHalves,
});
const toReview = (r: Row): WeeklyReview => ({
  weeklyCycleId: str(r.weekly_cycle_id),
  completedAt: str(r.completed_at),
  summary: JSON.parse(str(r.summary)) as WeeklyReview['summary'],
  proposalIds: JSON.parse(str(r.proposal_ids)) as string[],
});
const toProposal = (r: Row): ProgressionProposal => ({
  id: str(r.id),
  weeklyCycleId: str(r.weekly_cycle_id),
  exerciseId: str(r.exercise_id),
  planVersionId: str(r.plan_version_id),
  evidenceKey: str(r.evidence_key),
  evidenceSessionIds: JSON.parse(str(r.evidence_session_ids)) as string[],
  before: JSON.parse(str(r.before_json)) as ProgressionProposal['before'],
  after: JSON.parse(str(r.after_json)) as ProgressionProposal['after'],
  increment: JSON.parse(str(r.increment_json)) as ProgressionProposal['increment'],
  percentHundredths: num(r.percent_hundredths),
  status: str(r.status) as ProgressionProposal['status'],
  createdAt: str(r.created_at),
  decidedAt: optStr(r.decided_at),
  resultPlanVersionId: optStr(r.result_plan_version_id),
});
const toIncrement = (r: Row): EquipmentIncrement => ({
  key: str(r.key) as EquipmentIncrement['key'],
  unit: str(r.unit) as LoadUnit,
  value: num(r.value),
  confirmedAt: str(r.confirmed_at),
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
  restStartedAt: optStr(r.rest_started_at),
  restDurationS: r.rest_duration_s === null || r.rest_duration_s === undefined ? null : num(r.rest_duration_s),
  restLastSeenAt: optStr(r.rest_last_seen_at),
  restUncertain: num(r.rest_uncertain ?? 0) === 1,
});
const toMeasurement = (r: Row): Measurement => ({
  id: str(r.id),
  type: str(r.type) as Measurement['type'],
  value: num(r.value),
  unit: str(r.unit) as Measurement['unit'],
  measuredOn: str(r.measured_on),
  recordedAt: str(r.recorded_at),
  deletedAt: optStr(r.deleted_at),
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
        `INSERT INTO plan_version (id, parent_id, sequence, source, reason, created_at, accepted_at, program, proposal_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.parentId, p.sequence, p.source, p.reason, p.createdAt, p.acceptedAt, JSON.stringify(p.program), p.proposalId],
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
           started_at, finished_at, status, version, rest_started_at, rest_duration_s, rest_last_seen_at, rest_uncertain)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.taskDayId, s.scheduleSlotId, s.planVersionId, s.programDayId, s.title, JSON.stringify(s.exercises),
          s.startedAt, s.finishedAt, s.status, s.version, s.restStartedAt, s.restDurationS, s.restLastSeenAt,
          s.restUncertain ? 1 : 0],
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
    async setRestTimer(sessionId, rest) {
      await d.run(
        'UPDATE workout_session SET rest_started_at = ?, rest_duration_s = ?, rest_last_seen_at = ?, rest_uncertain = ? WHERE id = ?',
        [rest?.startedAt ?? null, rest?.durationS ?? null, rest?.lastSeenAt ?? null, rest?.uncertain ? 1 : 0, sessionId],
      );
    },
    async listFinishedSessions(limit) {
      const rows = await d.all<Row>(
        "SELECT * FROM workout_session WHERE status = 'finished' ORDER BY started_at DESC, rowid DESC LIMIT ?",
        [limit],
      );
      return rows.map(toSession);
    },
    async listSetsForSessions(ids) {
      if (ids.length === 0) return [];
      const out: SetLog[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const rows = await d.all<Row>(
          `SELECT * FROM set_log WHERE session_id IN (${chunk.map(() => '?').join(',')}) ORDER BY session_id, position`,
          chunk,
        );
        out.push(...rows.map(toSet));
      }
      return out;
    },
    async listMeasurements() {
      const rows = await d.all<Row>('SELECT * FROM measurement ORDER BY measured_on DESC, recorded_at DESC');
      return rows.map(toMeasurement);
    },
    async insertMeasurement(m) {
      await d.run(
        'INSERT INTO measurement (id, type, value, unit, measured_on, recorded_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [m.id, m.type, m.value, m.unit, m.measuredOn, m.recordedAt, m.deletedAt],
      );
    },
    async deleteMeasurement(id) {
      // Hard delete: a deleted measurement must not stay on the device or reach a backup.
      await d.run('DELETE FROM measurement WHERE id = ?', [id]);
    },
    async getSettings() {
      const r = await d.first<Row>("SELECT value FROM app_setting WHERE key = 'settings'");
      return r ? ({ ...DEFAULT_SETTINGS, ...(JSON.parse(str(r.value)) as AppSettings) }) : structuredClone(DEFAULT_SETTINGS);
    },
    async putSettings(v) {
      await d.run(
        "INSERT INTO app_setting (key, value) VALUES ('settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [JSON.stringify(v)],
      );
    },
    async dumpAll(): Promise<BackupData> {
      const all = async <T>(sql: string, map: (r: Row) => T) => (await d.all<Row>(sql)).map(map);
      const profile = await d.first<Row>('SELECT * FROM profile LIMIT 1');
      const tp = await d.first<Row>('SELECT * FROM training_profile LIMIT 1');
      const settingsRow = await d.first<Row>("SELECT value FROM app_setting WHERE key = 'settings'");
      return {
        profile: profile ? toProfile(profile) : null,
        taskDays: await all('SELECT * FROM task_day ORDER BY sequence', toDay),
        slots: await all('SELECT * FROM quest_slot ORDER BY rowid', toSlot),
        checkins: await all('SELECT * FROM daily_checkin ORDER BY rowid', toCheckin),
        ledger: await all('SELECT * FROM xp_ledger ORDER BY rowid', toLedger),
        trainingProfile: tp ? toTrainingProfile(tp) : null,
        plans: await all('SELECT * FROM plan_version ORDER BY sequence', toPlan),
        moves: await all('SELECT * FROM schedule_move ORDER BY rowid', toMove),
        sessions: await all('SELECT * FROM workout_session ORDER BY rowid', toSession),
        sets: await all('SELECT * FROM set_log ORDER BY rowid', toSet),
        weeklyCycles: await all('SELECT * FROM weekly_cycle ORDER BY sequence', toCycle),
        weeklyReviews: await all('SELECT * FROM weekly_review ORDER BY rowid', toReview),
        proposals: await all('SELECT * FROM progression_proposal ORDER BY rowid', toProposal),
        increments: await all('SELECT * FROM equipment_increment ORDER BY rowid', toIncrement),
        measurements: await all('SELECT * FROM measurement ORDER BY rowid', toMeasurement),
        settings: settingsRow
          ? { ...DEFAULT_SETTINGS, ...(JSON.parse(str(settingsRow.value)) as AppSettings) }
          : structuredClone(DEFAULT_SETTINGS),
      };
    },
    async replaceAll(data) {
      // Children first (foreign keys), all inside the caller's transaction.
      for (const t of ['set_log', 'progression_proposal', 'weekly_review', 'workout_session', 'schedule_move', 'quest_slot',
        'daily_checkin', 'xp_ledger', 'plan_version', 'training_profile', 'weekly_cycle', 'equipment_increment',
        'measurement', 'app_setting', 'task_day', 'profile']) {
        await d.run(`DELETE FROM ${t}`);
      }
      const self = sqlTx(d);
      if (data.profile) await self.putProfile(data.profile);
      for (const x of data.taskDays) await self.insertTaskDay(x);
      for (const x of data.slots) await self.insertSlot(x);
      for (const x of data.checkins) await self.putCheckin(x);
      if (data.trainingProfile) await self.putTrainingProfile(data.trainingProfile);
      // Parents before children (plan_version.parent_id references plan_version).
      for (const x of [...data.plans].sort((a, b) => a.sequence - b.sequence)) await self.insertPlan(x);
      for (const x of data.moves) await self.putMove(x);
      for (const x of data.sessions) await self.insertSession(x);
      for (const x of data.sets) await self.insertSet(x);
      for (const x of [...data.weeklyCycles].sort((a, b) => a.sequence - b.sequence)) await self.insertWeeklyCycle(x);
      for (const x of data.weeklyReviews) await self.insertWeeklyReview(x);
      for (const x of data.proposals) await self.insertProposal(x);
      for (const x of data.increments) await self.putIncrement(x);
      for (const x of data.measurements) await self.insertMeasurement(x);
      for (const x of data.ledger) {
        if ((await self.insertLedger(x)) === 'conflict') throw new Error('UNIQUE constraint failed: xp_ledger');
      }
      await self.putSettings(data.settings);
    },
    async getLatestWeeklyCycle() {
      const r = await d.first<Row>('SELECT * FROM weekly_cycle ORDER BY sequence DESC LIMIT 1');
      return r ? toCycle(r) : null;
    },
    async getWeeklyCycle(id) {
      const r = await d.first<Row>('SELECT * FROM weekly_cycle WHERE id = ?', [id]);
      return r ? toCycle(r) : null;
    },
    async insertWeeklyCycle(c) {
      await d.run(
        `INSERT INTO weekly_cycle (id, sequence, week_start, week_end, timezone, opened_at, closed_at, multiplier_halves)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.sequence, c.weekStart, c.weekEnd, c.timezone, c.openedAt, c.closedAt, c.multiplierHalves],
      );
    },
    async closeWeeklyCycle(id, closedAt) {
      // Boundaries, timezone and multiplier are immutable; only closing is allowed, once.
      await d.run('UPDATE weekly_cycle SET closed_at = ? WHERE id = ? AND closed_at IS NULL', [closedAt, id]);
    },
    async getWeeklyReview(id) {
      const r = await d.first<Row>('SELECT * FROM weekly_review WHERE weekly_cycle_id = ?', [id]);
      return r ? toReview(r) : null;
    },
    async insertWeeklyReview(w) {
      const res = await d.run(
        `INSERT INTO weekly_review (weekly_cycle_id, completed_at, summary, proposal_ids) VALUES (?, ?, ?, ?)
         ON CONFLICT(weekly_cycle_id) DO NOTHING`,
        [w.weeklyCycleId, w.completedAt, JSON.stringify(w.summary), JSON.stringify(w.proposalIds)],
      );
      return res.changes === 1 ? 'inserted' : 'conflict';
    },
    async getProposal(id) {
      const r = await d.first<Row>('SELECT * FROM progression_proposal WHERE id = ?', [id]);
      return r ? toProposal(r) : null;
    },
    async listProposals(limit) {
      const rows = await d.all<Row>('SELECT * FROM progression_proposal ORDER BY created_at DESC, rowid DESC LIMIT ?', [limit]);
      return rows.map(toProposal);
    },
    async insertProposal(p) {
      const res = await d.run(
        `INSERT INTO progression_proposal (id, weekly_cycle_id, exercise_id, plan_version_id, evidence_key, evidence_session_ids,
           before_json, after_json, increment_json, percent_hundredths, status, created_at, decided_at, result_plan_version_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(weekly_cycle_id, exercise_id, evidence_key) DO NOTHING`,
        [p.id, p.weeklyCycleId, p.exerciseId, p.planVersionId, p.evidenceKey, JSON.stringify(p.evidenceSessionIds),
          JSON.stringify(p.before), JSON.stringify(p.after), JSON.stringify(p.increment), p.percentHundredths, p.status,
          p.createdAt, p.decidedAt, p.resultPlanVersionId],
      );
      return res.changes === 1 ? 'inserted' : 'conflict';
    },
    async updateProposal(p) {
      // Only the decision fields change; the proposal content is the audit record.
      await d.run('UPDATE progression_proposal SET status = ?, decided_at = ?, result_plan_version_id = ? WHERE id = ?', [
        p.status,
        p.decidedAt,
        p.resultPlanVersionId,
        p.id,
      ]);
    },
    async listIncrements() {
      const rows = await d.all<Row>('SELECT * FROM equipment_increment ORDER BY key, unit');
      return rows.map(toIncrement);
    },
    async putIncrement(i) {
      await d.run(
        `INSERT INTO equipment_increment (key, unit, value, confirmed_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(key, unit) DO UPDATE SET value = excluded.value, confirmed_at = excluded.confirmed_at`,
        [i.key, i.unit, i.value, i.confirmedAt],
      );
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
  await driver.exec('PRAGMA secure_delete = ON;');
  await migrate(driver);
  return {
    kind,
    transaction: (fn) => driver.transaction((d) => fn(sqlTx(d))),
    close: () => driver.close(),
    purgeDeleted: async () => {
      // Free pages are zeroed (secure_delete), the WAL is folded in and truncated, the file is rebuilt.
      await driver.exec('PRAGMA secure_delete = ON;');
      await driver.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      await driver.exec('VACUUM;');
      await driver.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      return true;
    },
  };
}
