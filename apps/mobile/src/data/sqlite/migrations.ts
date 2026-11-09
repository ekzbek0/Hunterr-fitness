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
