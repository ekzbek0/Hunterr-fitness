/**
 * Native (iOS/Android) backup file handling. Saving writes the JSON to the
 * app cache, opens the system share sheet (Files, AirDrop, ...) and removes
 * the cache copy afterwards. Picking uses the system document picker, which
 * copies the chosen file into the app cache; that copy is removed after it is
 * read or rejected. The lifecycle (including every failure path) lives in
 * backup-file-core.ts. The web build uses backup-file.web.ts instead.
 * NOT verified on a real iPhone yet.
 */
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { MAX_BACKUP_BYTES } from '@/domain/backup/format';

import { pickAndRead, saveThroughShare, sweepTemps, type PickResult, type SaveResult, type TempFile } from './backup-file-core';

export { BackupFileError, TEMP_LEFT_NOTICE, type PickResult, type SaveResult } from './backup-file-core';

/** Only files inside this app's cache directory are ours to delete. */
const norm = (uri: string) => uri.replace(/^file:\/\/\/private\//, 'file:///');
const inCache = (uri: string) => norm(uri).startsWith(norm(Paths.cache.uri));

function temp(file: File, unverifiedCopy = false): TempFile {
  const owned = inCache(file.uri);
  return {
    uri: file.uri,
    owned,
    unverifiedCopy: unverifiedCopy && !owned,
    write: async (text) => file.write(text),
    text: () => file.text(),
    remove: () => {
      if (file.exists) file.delete();
    },
  };
}

export function saveBackupFile(fileName: string, json: string): Promise<SaveResult> {
  return saveThroughShare(
    {
      shareAvailable: () => Sharing.isAvailableAsync(),
      createTemp: (name) => {
        const file = new File(Paths.cache, name);
        if (file.exists) file.delete();
        file.create();
        return temp(file);
      },
      share: (uri) => Sharing.shareAsync(uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'AVCI yedeğini kaydet' }),
    },
    fileName,
    json,
  );
}

export function pickBackupFile(): Promise<PickResult | null> {
  return pickAndRead(
    {
      pick: async () => {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/json', 'public.json', 'text/plain'],
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (result.canceled || !result.assets || result.assets.length === 0) return null;
        const asset = result.assets[0];
        return { name: asset.name, size: typeof asset.size === 'number' ? asset.size : null, file: temp(new File(asset.uri), true) };
      },
    },
    MAX_BACKUP_BYTES,
  );
}

const BACKUP_NAME = /^avci-yedek-.*\.json$/;

/**
 * Deletes leftover backup copies in the app cache: our own export files and
 * the document picker's copies. Run at start and on delete-all. Returns false
 * if something could not be removed (the caller must then not claim it is gone).
 */
export function sweepBackupTemp(): boolean {
  try {
    const found: File[] = [];
    for (const entry of new Directory(Paths.cache).list()) {
      if (entry instanceof File && BACKUP_NAME.test(entry.name)) found.push(entry);
      if (entry instanceof Directory && entry.name === 'DocumentPicker') {
        for (const inner of entry.list()) if (inner instanceof File) found.push(inner);
      }
    }
    return sweepTemps(found.map((f) => temp(f)));
  } catch {
    return false;
  }
}
