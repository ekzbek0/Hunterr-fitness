import type { SQLiteDatabase } from 'expo-sqlite';

import type { SqlDriver, SqlParam } from './driver';

type Executor = Pick<SQLiteDatabase, 'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync'>;

function wrap(db: SQLiteDatabase, ex: Executor, inTransaction: boolean): SqlDriver {
  return {
    exec: (sql) => ex.execAsync(sql),
    run: async (sql, params: SqlParam[] = []) => ({ changes: (await ex.runAsync(sql, params)).changes }),
    first: (sql, params: SqlParam[] = []) => ex.getFirstAsync(sql, params),
    all: (sql, params: SqlParam[] = []) => ex.getAllAsync(sql, params),
    async transaction(fn) {
      if (inTransaction) return fn(this);
      let result: Awaited<ReturnType<typeof fn>> | undefined;
      await db.withExclusiveTransactionAsync(async (txn) => {
        result = await fn(wrap(db, txn, true));
      });
      return result as Awaited<ReturnType<typeof fn>>;
    },
    close: () => db.closeAsync(),
  };
}

export function expoSqliteDriver(db: SQLiteDatabase): SqlDriver {
  return wrap(db, db, false);
}
