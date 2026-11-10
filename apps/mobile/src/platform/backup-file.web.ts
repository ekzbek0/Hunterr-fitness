/**
 * Web preview backup file handling: a browser download and a file input.
 * No native modules are imported here (Metro picks this file on web).
 */
import { MAX_BACKUP_BYTES } from '@/domain/backup/format';

import { BackupFileError, type PickResult, type SaveResult } from './backup-file-core';

export { BackupFileError, TEMP_LEFT_NOTICE, type PickResult, type SaveResult } from './backup-file-core';

// The browser keeps no app-owned file copy: the download goes where the user's browser saves it.
export async function saveBackupFile(fileName: string, json: string): Promise<SaveResult> {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { outcome: 'downloaded', tempCopyRemoved: true };
}

export function pickBackupFile(): Promise<PickResult | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.setAttribute('data-testid', 'backup-file-input');
    const done = (fn: () => void) => {
      input.remove();
      fn();
    };
    input.addEventListener('cancel', () => done(() => resolve(null)));
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return done(() => resolve(null));
      if (file.size > MAX_BACKUP_BYTES) {
        return done(() => reject(new BackupFileError('Dosya çok büyük; bu bir AVCI yedeği değil gibi görünüyor.', true)));
      }
      file.text().then(
        (text) => done(() => resolve({ name: file.name, text, tempCopyRemoved: true })),
        () => done(() => reject(new BackupFileError('Dosya okunamadı.', true))),
      );
    });
    document.body.appendChild(input);
    input.click();
  });
}

/** The browser keeps no app-owned file copies. */
export function sweepBackupTemp(): boolean {
  return true;
}
