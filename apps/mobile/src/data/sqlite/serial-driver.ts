/**
 * One connection, one statement at a time.
 *
 * Every statement and every transaction goes through a single in-process queue
 * to the SAME connection. A transaction is `BEGIN IMMEDIATE` ... `COMMIT` (or
 * `ROLLBACK`) on that connection, so:
 *  - connection settings made at open time (foreign_keys, secure_delete) apply
 *    inside transactions too;
 *  - the write lock is taken at BEGIN, never upgraded mid-transaction;
 *  - nothing issued elsewhere in the app can run between BEGIN and COMMIT.
 *
 * The app (expo-sqlite) and the tests (node:sqlite) both use this wrapper, so
 * the tested transaction behaviour is the shipped one. Pure TypeScript; no
 * native import.
 */
import type { SqlDriver, SqlParam } from './driver';

/** The plain statement surface of one open database connection. */
export interface SqlConnection {
  exec(sql: string): Promise<void>;
  run(sql: string, params: SqlParam[]): Promise<{ changes: number }>;
  first<T>(sql: string, params: SqlParam[]): Promise<T | null>;
  all<T>(sql: string, params: SqlParam[]): Promise<T[]>;
  close(): Promise<void>;
}

export function serialDriver(conn: SqlConnection): SqlDriver {
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
    const next = queue.then(job);
    queue = next.catch(() => undefined);
    return next;
  };

  /** Used only inside a running transaction: talks to the connection directly. */
  const inside: SqlDriver = {
    exec: (sql) => conn.exec(sql),
    run: (sql, params = []) => conn.run(sql, params),
    first: (sql, params = []) => conn.first(sql, params),
    all: (sql, params = []) => conn.all(sql, params),
    transaction: (fn) => fn(inside),
    close: () => Promise.reject(new Error('close inside a transaction')),
  };

  return {
    exec: (sql) => enqueue(() => conn.exec(sql)),
    run: (sql, params = []) => enqueue(() => conn.run(sql, params)),
    first: (sql, params = []) => enqueue(() => conn.first(sql, params)),
    all: (sql, params = []) => enqueue(() => conn.all(sql, params)),
    transaction: (fn) =>
      enqueue(async () => {
        await conn.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn(inside);
          await conn.exec('COMMIT');
          return result;
        } catch (e) {
          try {
            await conn.exec('ROLLBACK');
          } catch {
            // The original error is the one worth reporting.
          }
          throw e;
        }
      }),
    close: () => enqueue(() => conn.close()),
  };
}
