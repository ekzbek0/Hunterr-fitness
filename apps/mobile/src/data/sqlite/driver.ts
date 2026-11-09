export type SqlParam = string | number | null;

/** Minimal async SQL surface shared by expo-sqlite (app) and node:sqlite (tests). */
export interface SqlDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParam[]): Promise<{ changes: number }>;
  first<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  /** Exclusive transaction; the callback must only use the driver it receives. */
  transaction<T>(fn: (txDriver: SqlDriver) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
