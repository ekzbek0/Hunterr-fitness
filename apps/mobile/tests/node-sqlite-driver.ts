/// <reference types="node" />
// Test-only connection: real SQLite (node:sqlite) behind the app's shared serial
// driver, so the transaction handling under test is the one the app ships.
import { DatabaseSync } from 'node:sqlite';

import type { SqlDriver, SqlParam } from '@/data/sqlite/driver';
import { serialDriver } from '@/data/sqlite/serial-driver';

export function nodeSqliteDriver(path: string): SqlDriver {
  const db = new DatabaseSync(path);
  return serialDriver({
    exec: async (sql) => void db.exec(sql),
    run: async (sql, params: SqlParam[]) => ({ changes: Number(db.prepare(sql).run(...params).changes) }),
    first: async <T>(sql: string, params: SqlParam[]) => (db.prepare(sql).get(...params) as T) ?? null,
    all: async <T>(sql: string, params: SqlParam[]) => db.prepare(sql).all(...params) as T[],
    close: async () => db.close(),
  });
}
