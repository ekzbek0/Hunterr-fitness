/**
 * Web preview backup file handling: a browser download and a file input.
 * No native modules are imported here (Metro picks this file on web).
 */
import { MAX_BACKUP_BYTES } from '@/domain/backup/format';

export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled';

export async function saveBackupFile(fileName: string, json: string): Promise<SaveOutcome> {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export function pickBackupFile(): Promise<{ name: string; text: string } | null> {
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
        return done(() => reject(new Error('Dosya çok büyük; bu bir AVCI yedeği değil gibi görünüyor.')));
      }
      file.text().then(
        (text) => done(() => resolve({ name: file.name, text })),
        () => done(() => reject(new Error('Dosya okunamadı.'))),
      );
    });
    document.body.appendChild(input);
    input.click();
  });
}
