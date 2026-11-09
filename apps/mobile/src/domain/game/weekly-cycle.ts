/**
 * Weekly cycle identity (docs/DATA_MODEL.md "Exactly-once reward"). A cycle is
 * the Monday-based local week of the current task day. It is opened once, with
 * its multiplier captured at that moment, and closed once when a task day of a
 * later week opens. A closed cycle is never reopened, even if the clock or the
 * timezone moves back. Pure: dates in, decision out.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function utc(localDate: string): Date {
  if (!DATE_RE.test(localDate)) throw new RangeError('date must be YYYY-MM-DD');
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Monday of the week containing `localDate`. */
export function cycleWeekStart(localDate: string): string {
  const dt = utc(localDate);
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

export function cycleWeekEnd(weekStart: string): string {
  const dt = utc(weekStart);
  dt.setUTCDate(dt.getUTCDate() + 6);
  return dt.toISOString().slice(0, 10);
}

export interface CycleLike {
  weekStart: string;
  closedAt: string | null;
}

export type CycleDecision =
  /** The latest cycle is this week's: keep using it. */
  | { action: 'resume' }
  /** Close the latest (if still open) and open the cycle for `weekStart`. */
  | { action: 'open'; weekStart: string; closeLatest: boolean }
  /** The task day belongs to an earlier week than the latest cycle: never reopen; keep the latest. */
  | { action: 'keep-latest' };

export function decideWeeklyCycle(latest: CycleLike | null, taskDayLocalDate: string): CycleDecision {
  const weekStart = cycleWeekStart(taskDayLocalDate);
  if (!latest) return { action: 'open', weekStart, closeLatest: false };
  if (weekStart === latest.weekStart) return { action: 'resume' };
  if (weekStart < latest.weekStart) return { action: 'keep-latest' };
  return { action: 'open', weekStart, closeLatest: latest.closedAt === null };
}

export const WEEKLY_REVIEW_SLOT = 'weekly-review';
