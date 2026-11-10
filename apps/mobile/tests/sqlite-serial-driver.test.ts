/**
 * The shared SQLite driver wrapper: every statement goes to ONE connection, in
 * order; a transaction is BEGIN IMMEDIATE ... COMMIT/ROLLBACK on that same
 * connection and nothing else can slip in between. Uses a fake connection that
 * records statements; real SQLite behaviour is covered by the repository tests
 * (node:sqlite). Behaviour on a real iPhone (expo-sqlite) is NOT covered here.
 */
import { describe, expect, it } from 'vitest';

import { serialDriver, type SqlConnection } from '@/data/sqlite/serial-driver';

function fakeConnection(failOn?: string) {
  const log: string[] = [];
  const step = async (sql: string) => {
    // Yield, so that unserialized callers WOULD interleave.
    await new Promise((r) => setTimeout(r, 1));
    if (failOn && sql === failOn) throw new Error(`boom: ${sql}`);
    log.push(sql);
  };
  const conn: SqlConnection = {
    exec: (sql) => step(sql),
    run: async (sql) => (await step(sql), { changes: 1 }),
    first: async (sql) => (await step(sql), null),
    all: async (sql) => (await step(sql), []),
    close: () => step('CLOSE'),
  };
  return { conn, log };
}

describe('serial SQLite driver', () => {
  it('runs concurrent transactions one after another on the same connection', async () => {
    const { conn, log } = fakeConnection();
    const d = serialDriver(conn);
    await Promise.all([
      d.transaction(async (tx) => {
        await tx.run('a1');
        await tx.run('a2');
      }),
      d.transaction(async (tx) => {
        await tx.run('b1');
      }),
    ]);
    expect(log).toEqual(['BEGIN IMMEDIATE', 'a1', 'a2', 'COMMIT', 'BEGIN IMMEDIATE', 'b1', 'COMMIT']);
  });

  it('a statement issued outside a running transaction waits for its COMMIT', async () => {
    const { conn, log } = fakeConnection();
    const d = serialDriver(conn);
    const t = d.transaction(async (tx) => {
      await tx.run('a1');
      await tx.first('a2');
    });
    const outside = d.all('outside');
    await Promise.all([t, outside]);
    expect(log).toEqual(['BEGIN IMMEDIATE', 'a1', 'a2', 'COMMIT', 'outside']);
  });

  it('rolls back on failure, reports the original error and keeps working', async () => {
    const { conn, log } = fakeConnection('bad');
    const d = serialDriver(conn);
    await expect(
      d.transaction(async (tx) => {
        await tx.run('a1');
        await tx.run('bad');
      }),
    ).rejects.toThrow('boom: bad');
    expect(await d.transaction(async (tx) => (await tx.run('b1')).changes)).toBe(1);
    expect(log).toEqual(['BEGIN IMMEDIATE', 'a1', 'ROLLBACK', 'BEGIN IMMEDIATE', 'b1', 'COMMIT']);
  });

  it('reports the original error even when ROLLBACK itself fails', async () => {
    const log: string[] = [];
    const conn: SqlConnection = {
      exec: async (sql) => {
        if (sql === 'ROLLBACK') throw new Error('rollback failed');
        log.push(sql);
      },
      run: async (sql) => {
        throw new Error(`boom: ${sql}`);
      },
      first: async () => null,
      all: async () => [],
      close: async () => undefined,
    };
    await expect(serialDriver(conn).transaction((tx) => tx.run('x'))).rejects.toThrow('boom: x');
  });

  it('a failed COMMIT rejects the transaction (never reported as written)', async () => {
    const { conn, log } = fakeConnection('COMMIT');
    const d = serialDriver(conn);
    await expect(d.transaction((tx) => tx.run('a1'))).rejects.toThrow('boom: COMMIT');
    expect(log).toEqual(['BEGIN IMMEDIATE', 'a1', 'ROLLBACK']);
  });

  it('a nested transaction joins the outer one (no second BEGIN)', async () => {
    const { conn, log } = fakeConnection();
    await serialDriver(conn).transaction((tx) => tx.transaction((inner) => inner.run('a1')));
    expect(log).toEqual(['BEGIN IMMEDIATE', 'a1', 'COMMIT']);
  });

  it('close waits for queued work', async () => {
    const { conn, log } = fakeConnection();
    const d = serialDriver(conn);
    const t = d.transaction((tx) => tx.run('a1'));
    await Promise.all([t, d.close()]);
    expect(log).toEqual(['BEGIN IMMEDIATE', 'a1', 'COMMIT', 'CLOSE']);
  });
});
