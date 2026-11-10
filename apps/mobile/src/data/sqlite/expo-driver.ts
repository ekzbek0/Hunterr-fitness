import type { SQLiteDatabase } from 'expo-sqlite';

import type { SqlDriver, SqlParam } from './driver';
import { serialDriver } from './serial-driver';

/**
 * expo-sqlite behind the shared serial driver: one connection, statements in
 * order, transactions as BEGIN IMMEDIATE ... COMMIT on that same connection.
 *
 * `withExclusiveTransactionAsync` is deliberately not used: it opens a second
 * connection per transaction, which does not carry this connection's
 * `foreign_keys` / `secure_delete` settings and starts with a plain BEGIN.
 * NOT yet run on a real iPhone; the same wrapper is tested against node:sqlite.
 */
export function expoSqliteDriver(db: SQLiteDatabase): SqlDriver {
  return serialDriver({
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlParam[]) => ({ changes: (await db.runAsync(sql, params)).changes }),
    first: <T>(sql: string, params: SqlParam[]) => db.getFirstAsync<T>(sql, params),
    all: <T>(sql: string, params: SqlParam[]) => db.getAllAsync<T>(sql, params),
    close: () => db.closeAsync(),
  });
}
