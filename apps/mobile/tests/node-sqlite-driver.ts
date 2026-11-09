/// <reference types="node" />
// Test-only driver: real SQLite (node:sqlite) behind the app's SqlDriver interface.
import { DatabaseSync } from 'node:sqlite';

import type { SqlDriver, SqlParam } from '@/data/sqlite/driver';

export function nodeSqliteDriver(path: string): SqlDriver {
  const db = new DatabaseSync(path);
  let queue: Promise<unknown> = Promise.resolve();
  const base = (inTx: boolean): SqlDriver => ({
    exec: async (sql) => void db.exec(sql),
    run: async (sql, params: SqlParam[] = []) => ({ changes: Number(db.prepare(sql).run(...params).changes) }),
    first: async <T>(sql: string, params: SqlParam[] = []) => (db.prepare(sql).get(...params) as T) ?? null,
    all: async <T>(sql: string, params: SqlParam[] = []) => db.prepare(sql).all(...params) as T[],
    transaction<T>(fn: (d: SqlDriver) => Promise<T>): Promise<T> {
      if (inTx) return fn(this);
      const next = queue.then(async () => {
        db.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn(base(true));
          db.exec('COMMIT');
          return result;
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      });
      queue = next.catch(() => undefined);
      return next;
    },
    close: async () => db.close(),
  });
  return base(false);
}
