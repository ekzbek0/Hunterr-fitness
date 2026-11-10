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
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { MAX_BACKUP_BYTES } from '@/domain/backup/format';

import { pickAndRead, saveThroughShare, type PickResult, type SaveResult, type TempFile } from './backup-file-core';

export { BackupFileError, TEMP_LEFT_NOTICE, type PickResult, type SaveResult } from './backup-file-core';

/** Only files inside this app's cache directory are ours to delete. */
function temp(file: File): TempFile {
  return {
    uri: file.uri,
    owned: file.uri.startsWith(Paths.cache.uri),
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
        return { name: asset.name, size: typeof asset.size === 'number' ? asset.size : null, file: temp(new File(asset.uri)) };
      },
    },
    MAX_BACKUP_BYTES,
  );
}
