/**
 * Temp-file lifecycle of native backup export/import (pure core). The real
 * expo-file-system / share sheet / document picker are NOT exercised here.
 */
import { describe, expect, it } from 'vitest';

import { BackupFileError, pickAndRead, saveThroughShare, type TempFile } from '@/platform/backup-file-core';

class Disk {
  files = new Map<string, string>();
  failRemove = false;
  failWrite = false;
  failRead = false;
  temp(uri: string, owned = true): TempFile {
    return {
      uri,
      owned,
      write: async (t) => {
        if (this.failWrite) throw new Error('disk full');
        this.files.set(uri, t);
      },
      text: async () => {
        if (this.failRead) throw new Error('unreadable');
        return this.files.get(uri) ?? '';
      },
      remove: () => {
        if (this.failRemove) throw new Error('busy');
        this.files.delete(uri);
      },
    };
  }
}
const CACHE = 'file:///cache/';
const USER_COPY = 'file:///Files/On My iPhone/avci-yedek.json';

function saveIo(disk: Disk, opts: { share?: (uri: string) => Promise<void>; available?: boolean } = {}) {
  return {
    shareAvailable: async () => opts.available ?? true,
    createTemp: (name: string) => {
      disk.files.set(CACHE + name, '');
      return disk.temp(CACHE + name);
    },
    // The share sheet copies the file to wherever the user chose.
    share: opts.share ?? (async (uri: string) => void disk.files.set(USER_COPY, disk.files.get(uri)!)),
  };
}
const failure = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as BackupFileError;
  }
  throw new Error('expected a rejection');
};

describe('export: temporary copy', () => {
  it('is removed after sharing; the copy the user saved is untouched', async () => {
    const disk = new Disk();
    expect(await saveThroughShare(saveIo(disk), 'a.json', '{"x":1}')).toEqual({ outcome: 'shared', tempCopyRemoved: true });
    expect([...disk.files.keys()]).toEqual([USER_COPY]);
    expect(disk.files.get(USER_COPY)).toBe('{"x":1}');
  });
  it('is removed when the share sheet is dismissed, fails, or the write fails', async () => {
    const dismissed = new Disk();
    await saveThroughShare(saveIo(dismissed, { share: async () => undefined }), 'a.json', '{}');
    expect(dismissed.files.size).toBe(0);

    const shareFails = new Disk();
    const e1 = await failure(saveThroughShare(saveIo(shareFails, { share: async () => Promise.reject(new Error('share failed')) }), 'a.json', '{}'));
    expect(e1).toBeInstanceOf(BackupFileError);
    expect(e1).toMatchObject({ message: 'share failed', tempCopyRemoved: true });
    expect(shareFails.files.size).toBe(0);

    const writeFails = new Disk();
    writeFails.failWrite = true;
    const e2 = await failure(saveThroughShare(saveIo(writeFails), 'a.json', '{}'));
    expect(e2).toMatchObject({ message: 'disk full', tempCopyRemoved: true });
    expect(writeFails.files.size).toBe(0);
  });
  it('no share sheet: nothing is created', async () => {
    const disk = new Disk();
    const e = await failure(saveThroughShare(saveIo(disk, { available: false }), 'a.json', '{}'));
    expect(e.tempCopyRemoved).toBe(true);
    expect(disk.files.size).toBe(0);
  });
  it('a failed cleanup is reported, on success and on error, never claimed as removed', async () => {
    const disk = new Disk();
    disk.failRemove = true;
    expect(await saveThroughShare(saveIo(disk), 'a.json', '{}')).toEqual({ outcome: 'shared', tempCopyRemoved: false });
    const e = await failure(saveThroughShare(saveIo(disk, { share: async () => Promise.reject(new Error('x')) }), 'b.json', '{}'));
    expect(e.tempCopyRemoved).toBe(false);
  });
});

describe('import: picker cache copy', () => {
  const pickIo = (disk: Disk, size: number | null, uri = CACHE + 'picked.json', owned = true) => ({
    pick: async () => ({ name: 'picked.json', size, file: disk.temp(uri, owned) }),
  });
  it('REGRESSION: an oversize file is rejected AND its cache copy is removed', async () => {
    const disk = new Disk();
    disk.files.set(CACHE + 'picked.json', 'x'.repeat(50));
    const e = await failure(pickAndRead(pickIo(disk, 50), 10));
    expect(e).toBeInstanceOf(BackupFileError);
    expect(e.tempCopyRemoved).toBe(true);
    expect(disk.files.size).toBe(0);
    // Size unknown to the picker: caught after reading, still cleaned up.
    disk.files.set(CACHE + 'picked.json', 'x'.repeat(50));
    expect((await failure(pickAndRead(pickIo(disk, null), 10))).tempCopyRemoved).toBe(true);
    expect(disk.files.size).toBe(0);
  });
  it('read error and success both remove the cache copy; cancel copies nothing', async () => {
    const disk = new Disk();
    disk.files.set(CACHE + 'picked.json', '{}');
    disk.failRead = true;
    expect(await failure(pickAndRead(pickIo(disk, 2), 100))).toMatchObject({ message: 'unreadable', tempCopyRemoved: true });
    expect(disk.files.size).toBe(0);
    disk.failRead = false;
    disk.files.set(CACHE + 'picked.json', '{"ok":true}');
    expect(await pickAndRead(pickIo(disk, 11), 100)).toEqual({ name: 'picked.json', text: '{"ok":true}', tempCopyRemoved: true });
    expect(disk.files.size).toBe(0);
    expect(await pickAndRead({ pick: async () => null }, 100)).toBeNull();
  });
  it('a file outside the app cache is never deleted (success or rejection)', async () => {
    const disk = new Disk();
    disk.files.set(USER_COPY, '{}');
    expect((await pickAndRead(pickIo(disk, 2, USER_COPY, false), 100))!.tempCopyRemoved).toBe(true);
    await failure(pickAndRead(pickIo(disk, 500, USER_COPY, false), 100));
    expect([...disk.files.keys()]).toEqual([USER_COPY]);
  });
  it('a failed cleanup is reported on every path', async () => {
    const disk = new Disk();
    disk.failRemove = true;
    disk.files.set(CACHE + 'picked.json', '{}');
    expect((await pickAndRead(pickIo(disk, 2), 100))!.tempCopyRemoved).toBe(false);
    expect((await failure(pickAndRead(pickIo(disk, 500), 100))).tempCopyRemoved).toBe(false);
  });
});

describe('leftovers and unverifiable copies', () => {
  it('sweep removes app-owned leftovers only and reports a failure', async () => {
    const { sweepTemps } = await import('@/platform/backup-file-core');
    const disk = new Disk();
    disk.files.set(CACHE + 'avci-yedek-2026-11-09.json', '{}');
    disk.files.set(USER_COPY, '{}');
    expect(sweepTemps([disk.temp(CACHE + 'avci-yedek-2026-11-09.json'), disk.temp(USER_COPY, false)])).toBe(true);
    expect([...disk.files.keys()]).toEqual([USER_COPY]);
    disk.files.set(CACHE + 'x.json', '{}');
    disk.failRemove = true;
    expect(sweepTemps([disk.temp(CACHE + 'x.json')])).toBe(false);
  });
  it('a picker copy whose path cannot be matched to the app cache is not deleted and is reported as possibly left', async () => {
    const disk = new Disk();
    const odd = 'file:///somewhere/else/picked.json';
    disk.files.set(odd, '{}');
    const r = await pickAndRead({ pick: async () => ({ name: 'p.json', size: 2, file: { ...disk.temp(odd, false), unverifiedCopy: true } }) }, 100);
    expect(r).toMatchObject({ text: '{}', tempCopyRemoved: false });
    expect(disk.files.has(odd)).toBe(true);
  });
});
