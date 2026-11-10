/**
 * A backup must not come "from the future" relative to this device's clock.
 *
 * The app keeps a high-water mark of the device time on the latest task day
 * (`lastSeenAt`); a clock behind it freezes rewards. It also keeps the latest
 * day open until its date has passed. A file whose latest day is ahead of the
 * clock would therefore freeze rewards or pin "today" until that moment
 * arrives. Such a file is refused; nothing is adjusted or repaired.
 *
 * Pure: the clock is passed in. Uses the same tolerance as the task-day rule.
 */
import type { BackupData } from '@/data/types';
import { CLOCK_TOLERANCE_MS, isValidTimeZone, localDateIn } from '@/domain/game/task-day';

import type { BackupIssue } from './validate';

export const FUTURE_BACKUP_MESSAGE =
  'Bu yedek, cihazın şu anki saatinden daha ileri bir zamana ait kayıt içeriyor (gelecek tarihli). ' +
  'Cihazın tarih ve saatini kontrol et; saat doğruysa bu dosya geri yüklenemez.';

export function checkBackupClock(data: BackupData, now: Date): BackupIssue[] {
  if (data.taskDays.length === 0) return [];
  const latest = data.taskDays.reduce((m, x) => (x.sequence > m.sequence ? x : m));
  const index = data.taskDays.indexOf(latest);
  const limit = now.getTime() + CLOCK_TOLERANCE_MS;
  const issues: BackupIssue[] = [];
  if (Date.parse(latest.lastSeenAt) > limit) {
    issues.push({ code: 'clock', path: `taskDays[${index}].lastSeenAt`, message: FUTURE_BACKUP_MESSAGE });
  }
  const tz = isValidTimeZone(latest.timezone) ? latest.timezone : 'UTC';
  if (latest.localDate > localDateIn(new Date(limit), tz)) {
    issues.push({ code: 'clock', path: `taskDays[${index}].localDate`, message: FUTURE_BACKUP_MESSAGE });
  }
  return issues;
}
