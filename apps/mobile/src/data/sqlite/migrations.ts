import type { SqlDriver } from './driver';

/** Ordered, append-only. Never edit a released migration; add a new one. */
export const MIGRATIONS: readonly { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE profile (
        id TEXT PRIMARY KEY NOT NULL,
        timezone TEXT NOT NULL,
        multiplier_halves INTEGER NOT NULL CHECK (multiplier_halves IN (1,2,3,4)),
        habit_keys TEXT NOT NULL,
        created_at TEXT NOT NULL,
        confirmed_at TEXT NOT NULL
      );
      CREATE TABLE task_day (
        id TEXT PRIMARY KEY NOT NULL,
        sequence INTEGER NOT NULL UNIQUE,
        local_date TEXT NOT NULL UNIQUE,
        timezone TEXT NOT NULL,
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        multiplier_halves INTEGER NOT NULL CHECK (multiplier_halves IN (1,2,3,4)),
        last_seen_at TEXT NOT NULL
      );
      CREATE TABLE quest_slot (
        task_day_id TEXT NOT NULL REFERENCES task_day(id),
        slot_key TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        base_xp INTEGER NOT NULL CHECK (base_xp >= 0),
        status TEXT NOT NULL,
        resolution TEXT,
        completed_at TEXT,
        version INTEGER NOT NULL,
        PRIMARY KEY (task_day_id, slot_key)
      );
      CREATE TABLE daily_checkin (
        task_day_id TEXT PRIMARY KEY NOT NULL REFERENCES task_day(id),
        sleep_hours REAL,
        energy INTEGER NOT NULL,
        fatigue INTEGER NOT NULL,
        soreness INTEGER NOT NULL,
        joint_pain TEXT NOT NULL,
        illness TEXT NOT NULL,
        recorded_at TEXT NOT NULL
      );
      CREATE TABLE xp_ledger (
        id TEXT PRIMARY KEY NOT NULL,
        profile_id TEXT NOT NULL,
        scope_kind TEXT NOT NULL CHECK (scope_kind IN ('day','week')),
        scope_id TEXT NOT NULL,
        slot_key TEXT NOT NULL,
        base_xp INTEGER NOT NULL CHECK (base_xp >= 0),
        multiplier_halves INTEGER NOT NULL,
        awarded_xp INTEGER NOT NULL CHECK (awarded_xp >= 0),
        completed_at TEXT NOT NULL,
        UNIQUE (profile_id, scope_kind, scope_id, slot_key)
      );
    `,
  },
  {
    // M1: training profile, versioned plans, schedule moves, workout log.
    // Additive only: every M0 row (profile, days, slots, check-ins, ledger) is preserved.
    version: 2,
    sql: `
      ALTER TABLE quest_slot ADD COLUMN workout_session_id TEXT;
      CREATE TABLE training_profile (
        profile_id TEXT PRIMARY KEY NOT NULL REFERENCES profile(id),
        facts TEXT NOT NULL,
        confirmed_at TEXT NOT NULL
      );
      CREATE TABLE plan_version (
        id TEXT PRIMARY KEY NOT NULL,
        parent_id TEXT REFERENCES plan_version(id),
        sequence INTEGER NOT NULL UNIQUE,
        source TEXT NOT NULL CHECK (source IN ('generated','user-edit')),
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        accepted_at TEXT NOT NULL,
        program TEXT NOT NULL
      );
      CREATE TABLE schedule_move (
        slot_id TEXT PRIMARY KEY NOT NULL,
        week_start TEXT NOT NULL,
        to_date TEXT NOT NULL,
        moved_at TEXT NOT NULL
      );
      CREATE INDEX schedule_move_week ON schedule_move(week_start);
      CREATE TABLE workout_session (
        id TEXT PRIMARY KEY NOT NULL,
        task_day_id TEXT NOT NULL REFERENCES task_day(id),
        schedule_slot_id TEXT,
        plan_version_id TEXT NOT NULL REFERENCES plan_version(id),
        program_day_id TEXT NOT NULL,
        title TEXT NOT NULL,
        exercises TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL CHECK (status IN ('in-progress','finished','abandoned')),
        version INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX workout_one_active ON workout_session(status) WHERE status = 'in-progress';
      CREATE UNIQUE INDEX workout_one_finished_per_slot ON workout_session(schedule_slot_id)
        WHERE status = 'finished' AND schedule_slot_id IS NOT NULL;
      CREATE TABLE set_log (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL REFERENCES workout_session(id),
        exercise_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('warmup','work')),
        position INTEGER NOT NULL,
        reps INTEGER NOT NULL CHECK (reps >= 0),
        load REAL NOT NULL CHECK (load >= 0),
        unit TEXT NOT NULL CHECK (unit IN ('kg','lb')),
        load_convention TEXT NOT NULL,
        rir INTEGER,
        logged_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX set_log_session ON set_log(session_id, position);
      CREATE INDEX set_log_exercise ON set_log(exercise_id, logged_at);
    `,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/** Applies pending migrations, each in its own transaction with its version bump. */
export async function migrate(driver: SqlDriver): Promise<number> {
  await driver.exec(
    'CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);',
  );
  const row = await driver.first<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = 'schema_version'",
  );
  let current = row ? Number(row.value) : 0;
  if (current > LATEST_SCHEMA_VERSION) {
    throw new Error(`Veritabanı bu uygulama sürümünden yeni (şema ${current}).`);
  }
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    await driver.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.run(
        "INSERT INTO app_meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [String(m.version)],
      );
    });
    current = m.version;
  }
  return current;
}
