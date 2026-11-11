import { describe, expect, it } from 'vitest';

import { BackupFileError, TEMP_LEFT_NOTICE } from '@/platform/backup-file-core';
import { BACKUP_ERROR_NOTICE, formatBackupError } from '@/ui/backup-errors';

describe('backup failure display privacy', () => {
  it.each([
    new Error('Cannot open file:///synthetic-private/backup.json'),
    new BackupFileError('native write failed at file:///synthetic-private/backup.json', true),
    'raw synthetic record payload',
  ])('does not show arbitrary platform errors or thrown payloads', (error) => {
    expect(formatBackupError(error)).toBe(BACKUP_ERROR_NOTICE);
  });

  it('does not stringify an unknown thrown object', () => {
    expect(formatBackupError({ toString: () => { throw new Error('must not inspect payload'); } })).toBe(BACKUP_ERROR_NOTICE);
  });

  it('preserves the cleanup uncertainty notice while hiding the raw path', () => {
    expect(formatBackupError(new BackupFileError('file:///synthetic-private/backup.json', false)))
      .toBe(`${BACKUP_ERROR_NOTICE} ${TEMP_LEFT_NOTICE}`);
  });

  it.each([
    'Dosya çok büyük; bu bir AVCI yedeği değil gibi görünüyor.',
    'Dosya okunamadı.',
    'Bu cihazda paylaşım menüsü kullanılamıyor; yedek kaydedilemedi.',
  ])('preserves controlled actionable file errors: %s', (message) => {
    expect(formatBackupError(new BackupFileError(message, true))).toBe(message);
    // Plain native errors are never trusted just because their text looks familiar.
    expect(formatBackupError(new Error(message))).toBe(BACKUP_ERROR_NOTICE);
  });
});
