/**
 * Task-day lifecycle (docs/DATA_MODEL.md "Day and timezone"). Pure: the clock
 * and device timezone are passed in. Policy is recorded in docs/DECISIONS.md.
 */

/** Clock rollback tolerated before rewards are frozen. */
export const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date (YYYY-MM-DD) of `instant` in an IANA timezone. DST-safe. */
export function localDateIn(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export interface TaskDayCursor {
  localDate: string;
  timezone: string;
  closedAt: string | null;
  /** Highest device time ever observed for this day (ISO). */
  lastSeenAt: string;
}

export type TaskDayDecision =
  | { action: 'create'; localDate: string }
  | { action: 'resume'; clockAnomaly: boolean }
  | { action: 'rollover'; localDate: string };

/**
 * - First open: create a day for the device's local date.
 * - Clock moved back beyond tolerance: resume, but freeze rewards (anomaly).
 * - The open day ends only once BOTH its captured timezone and the current
 *   device timezone have passed its date. Travel therefore cannot reopen a
 *   closed day, create two simultaneous days or skip a date backwards; a
 *   westward trip can lengthen the current day by at most the offset change.
 * - Missed days are not back-filled: no debt, no negative XP.
 */
export function decideTaskDay(
  latest: TaskDayCursor | null,
  now: Date,
  deviceTimezone: string,
): TaskDayDecision {
  if (Number.isNaN(now.getTime())) throw new RangeError('invalid clock');
  const deviceDate = localDateIn(now, deviceTimezone);
  if (!latest) return { action: 'create', localDate: deviceDate };

  const lastSeen = Date.parse(latest.lastSeenAt);
  if (now.getTime() < lastSeen - CLOCK_TOLERANCE_MS) {
    return { action: 'resume', clockAnomaly: true };
  }
  const capturedDate = localDateIn(now, latest.timezone);
  const passed = capturedDate > latest.localDate && deviceDate > latest.localDate;
  if (!passed) return { action: 'resume', clockAnomaly: false };
  return { action: 'rollover', localDate: deviceDate };
}
