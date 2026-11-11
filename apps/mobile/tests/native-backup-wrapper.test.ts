/** Native wrapper wiring with injected Expo IO, not a real-device test. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const disk = vi.hoisted(() => ({
  files: new Map<string, string>(),
  failDelete: false,
  failCreate: false,
  share: vi.fn(async (_uri: string) => undefined),
}));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }));
vi.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: disk.share }));
vi.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  Directory: class {},
  File: class {
    uri: string;
    constructor(_base: unknown, name: string) { this.uri = `file:///cache/${name}`; }
    get exists() { return disk.files.has(this.uri); }
    delete() {
      if (disk.failDelete) throw new Error('delete failed');
      disk.files.delete(this.uri);
    }
    create() {
      disk.files.set(this.uri, ''); // Model a failure after an on-disk side effect.
      if (disk.failCreate) throw new Error('create failed');
    }
    write(text: string) { disk.files.set(this.uri, text); }
    async text() { return disk.files.get(this.uri) ?? ''; }
  },
}));

import { BackupFileError, saveBackupFile } from '@/platform/backup-file';

const NAME = 'avci-yedek-2026-11-09.json';
const URI = `file:///cache/${NAME}`;

describe('native export setup cleanup wiring (mocked Expo)', () => {
  beforeEach(() => {
    disk.files.clear();
    disk.failDelete = false;
    disk.failCreate = false;
    disk.share.mockClear();
  });

  it('reports a retained old temporary copy when replacement deletion fails', async () => {
    disk.files.set(URI, 'old synthetic backup');
    disk.failDelete = true;
    await expect(saveBackupFile(NAME, '{}')).rejects.toMatchObject({
      name: 'BackupFileError', tempCopyRemoved: false,
    });
    expect(disk.files.get(URI)).toBe('old synthetic backup');
    expect(disk.share).not.toHaveBeenCalled();
  });

  it('cleans a partially created file when creation throws before writing', async () => {
    disk.failCreate = true;
    const error = await saveBackupFile(NAME, '{}').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BackupFileError);
    expect(error).toMatchObject({ tempCopyRemoved: true });
    expect(disk.files.has(URI)).toBe(false);
    expect(disk.share).not.toHaveBeenCalled();
  });

  it('replaces a stale temporary copy, shares new contents, and removes only the cache copy', async () => {
    disk.files.set(URI, 'old synthetic backup');
    const external = 'file:///Files/saved.json';
    disk.files.set(external, 'user copy');
    disk.share.mockImplementationOnce(async (uri: string) => {
      expect(disk.files.get(uri)).toBe('{"new":true}');
    });
    expect(await saveBackupFile(NAME, '{"new":true}')).toEqual({ outcome: 'shared', tempCopyRemoved: true });
    expect(disk.files.has(URI)).toBe(false);
    expect(disk.files.get(external)).toBe('user copy');
  });
});
