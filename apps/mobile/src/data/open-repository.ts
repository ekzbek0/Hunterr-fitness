// Native (iOS/Android) persistence. Metro picks open-repository.web.ts on web,
// so expo-sqlite is never imported by the web bundle.
import { openDatabaseAsync } from 'expo-sqlite';

import { expoSqliteDriver } from './sqlite/expo-driver';
import { createSqliteRepository } from './sqlite/sqlite-repository';
import type { AvciRepository } from './types';

export async function openRepository(): Promise<AvciRepository> {
  const db = await openDatabaseAsync('avci.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  return createSqliteRepository(expoSqliteDriver(db), 'SQLite (cihazda)');
}
