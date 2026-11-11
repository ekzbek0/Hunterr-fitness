/// <reference types="node" />
/** Recovery must not require reading the very records the user is replacing.
 * SQLite is node:sqlite, IndexedDB is fake-indexeddb; neither is iPhone evidence.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import { createDocumentRepository } from '@/data/document/document-repository';
import { indexedDbStorage } from '@/data/document/indexeddb-storage';
import { createSqliteRepository } from '@/data/sqlite/sqlite-repository';
import type { AvciRepository } from '@/data/types';
import { AvciService } from '@/services/avci-service';
import { BackupService } from '@/services/backup-service';

import { FakeClock, goodCheckin } from './helpers';
import { nodeSqliteDriver } from './node-sqlite-driver';

describe.each(['SQLite', 'IndexedDB'] as const)('restore with unreadable current records (%s)', (kind) => {
  it('previews a valid backup with unknown current totals, changes nothing, then restores explicitly', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'avci-recovery-review-'));
    let repo: AvciRepository | null = null;
    try {
      const driver = kind === 'SQLite' ? nodeSqliteDriver(join(dir, 'avci.db')) : null;
      const storage = kind === 'IndexedDB' ? indexedDbStorage(new IDBFactory(), 'avci') : null;
      repo = driver ? await createSqliteRepository(driver, 'test-sqlite') : await createDocumentRepository(storage!, 'test-idb');
      const clock = new FakeClock(new Date('2026-11-09T06:00:00Z'));
      const service = new AvciService(repo, clock);
      const backup = new BackupService(repo, clock);
      await service.createProfile({});
      const today = await service.loadToday();
      await service.recordCheckin(today.today!.id, goodCheckin);
      const good = await backup.exportBackup();
      expect(good.summary.totalXp).toBe(10);
      const original = await repo.transaction((tx) => tx.dumpAll());

      // Damage the stored representation directly; no normal application operation does this.
      if (driver) {
        await driver.run("UPDATE profile SET habit_keys = ?", ['broken-json']);
      } else {
        const stored = (await storage!.load())!;
        // A malformed table makes both loadToday and summarizeBackup fail.
        (stored.doc as unknown as { ledger: null }).ledger = null;
        expect(await storage!.commit(stored.rev, stored.doc)).toBe(true);
      }
      const rawCurrent = async () => driver
        ? driver.first<{ habit_keys: string }>('SELECT habit_keys FROM profile')
        : (await storage!.load())!.doc;
      const damaged = await rawCurrent();
      await expect(service.loadToday()).rejects.toThrow();

      // A bad incoming file must still be refused and never touch the damaged store.
      expect((await backup.previewImport('{bad')).ok).toBe(false);
      expect((await backup.importBackup('{bad')).status).toBe('rejected');
      expect(await rawCurrent()).toEqual(damaged);

      const preview = await backup.previewImport(good.json);
      expect(preview.ok).toBe(true);
      if (!preview.ok) throw new Error('expected a valid recovery preview');
      expect(preview.current).toBeNull(); // Unknown is not a fabricated zero.
      expect(preview.backup.totalXp).toBe(10);
      expect(preview.replacesAll).toBe(true);
      expect(await rawCurrent()).toEqual(damaged); // Preview never repairs/deletes records.

      expect((await backup.importBackup(good.json)).status).toBe('restored');
      expect(await repo.transaction((tx) => tx.dumpAll())).toEqual(original);
      expect((await service.loadToday()).progress.totalXp).toBe(10);
    } finally {
      await repo?.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
