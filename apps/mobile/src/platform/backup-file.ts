/**
 * Native (iOS/Android) backup file handling. Saving writes the JSON to the
 * app cache, opens the system share sheet (Files, AirDrop, ...) and removes
 * the cache copy afterwards so no hidden copy stays behind. Picking uses the
 * system document picker and reads the picked copy as text.
 * The web build uses backup-file.web.ts instead (Metro platform extension).
 * NOT verified on a real iPhone yet.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { MAX_BACKUP_BYTES } from '@/domain/backup/format';

export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled';

function removeQuietly(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {
    // Cache files are cleared by the OS eventually; nothing else to do.
  }
}

export async function saveBackupFile(fileName: string, json: string): Promise<SaveOutcome> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Bu cihazda paylaşım menüsü kullanılamıyor; yedek kaydedilemedi.');
  }
  const file = new File(Paths.cache, fileName);
  try {
    removeQuietly(file);
    file.create();
    await file.write(json);
    // Resolves when the share sheet is dismissed; iOS does not report whether a target was chosen.
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'AVCI yedeğini kaydet' });
    return 'shared';
  } finally {
    removeQuietly(file);
  }
}

export async function pickBackupFile(): Promise<{ name: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'public.json', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  const asset = result.assets[0];
  if (typeof asset.size === 'number' && asset.size > MAX_BACKUP_BYTES) {
    throw new Error('Dosya çok büyük; bu bir AVCI yedeği değil gibi görünüyor.');
  }
  const file = new File(asset.uri);
  try {
    return { name: asset.name, text: await file.text() };
  } finally {
    removeQuietly(file);
  }
}
