import { BackupFileError, TEMP_LEFT_NOTICE } from '@/platform/backup-file-core';

export const BACKUP_ERROR_NOTICE = 'İşlem sırasında hata oluştu. Kayıtların son durumunu kontrol edip tekrar dene.';

const FILE_ERROR_MESSAGES = new Set([
  'Dosya çok büyük; bu bir AVCI yedeği değil gibi görünüyor.',
  'Dosya okunamadı.',
  'Bu cihazda paylaşım menüsü kullanılamıyor; yedek kaydedilemedi.',
]);

/** Display boundary: platform errors can contain private file paths or record data. */
export function formatBackupError(error: unknown): string {
  const left = error instanceof BackupFileError && !error.tempCopyRemoved ? ` ${TEMP_LEFT_NOTICE}` : '';
  const message = error instanceof BackupFileError && FILE_ERROR_MESSAGES.has(error.message)
    ? error.message
    : BACKUP_ERROR_NOTICE;
  return `${message}${left}`;
}
