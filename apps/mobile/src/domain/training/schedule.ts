/**
 * Week view: program days placed on the dates of one Monday-based local week,
 * with user moves applied. Identity of a planned session is
 * `${weekStart}:${programDayId}`, stable across plan edits and moves.
 * Missed sessions create no debt: they are shown, never carried forward.
 */
import type { Program } from './program';
import type { Weekday } from './profile';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toUtc(localDate: string): Date {
  if (!DATE_RE.test(localDate)) throw new RangeError('date must be YYYY-MM-DD');
  const [y, m, d] = localDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.toISOString().slice(0, 10) !== localDate) throw new RangeError('invalid calendar date');
  return dt;
}

export function addDays(localDate: string, n: number): string {
  const dt = toUtc(localDate);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(localDate: string): Weekday {
  return ((toUtc(localDate).getUTCDay() + 6) % 7) as Weekday;
}

export function weekStartOf(localDate: string): string {
  return addDays(localDate, -weekdayOf(localDate));
}

export const scheduleSlotId = (weekStart: string, programDayId: string) => `${weekStart}:${programDayId}`;

export interface ScheduleMove {
  slotId: string;
  weekStart: string;
  toDate: string;
  movedAt: string;
}

export interface SessionRef {
  id: string;
  scheduleSlotId: string | null;
  status: 'in-progress' | 'finished' | 'abandoned';
}

export type PlannedState = 'planned' | 'in-progress' | 'done' | 'missed';

export interface PlannedSession {
  slotId: string;
  programDayId: string;
  title: string;
  plannedDate: string;
  date: string;
  moved: boolean;
  state: PlannedState;
  sessionId: string | null;
}

export function buildWeek(
  program: Program,
  weekStart: string,
  moves: readonly ScheduleMove[],
  sessions: readonly SessionRef[],
  today: string,
): PlannedSession[] {
  if (weekdayOf(weekStart) !== 0) throw new RangeError('weekStart must be a Monday');
  return program.days
    .map((d) => {
      const slotId = scheduleSlotId(weekStart, d.id);
      const plannedDate = addDays(weekStart, d.weekday);
      const move = moves.find((m) => m.slotId === slotId);
      const date = move ? move.toDate : plannedDate;
      const linked = sessions.filter((s) => s.scheduleSlotId === slotId);
      const finished = linked.find((s) => s.status === 'finished');
      const active = linked.find((s) => s.status === 'in-progress');
      const state: PlannedState = finished ? 'done' : active ? 'in-progress' : date < today ? 'missed' : 'planned';
      return {
        slotId,
        programDayId: d.id,
        title: d.title,
        plannedDate,
        date,
        moved: date !== plannedDate,
        state,
        sessionId: (finished ?? active)?.id ?? null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.plannedDate.localeCompare(b.plannedDate));
}

export type MoveError = 'unknown-session' | 'not-movable' | 'outside-week' | 'in-past' | 'occupied';

/** A planned/missed session can move to today or a later date of the same week with no other session. */
export function validateMove(week: readonly PlannedSession[], slotId: string, toDate: string, today: string): MoveError | null {
  const s = week.find((x) => x.slotId === slotId);
  if (!s) return 'unknown-session';
  if (s.state === 'done' || s.state === 'in-progress') return 'not-movable';
  const weekStart = weekStartOf(s.plannedDate);
  let target: string;
  try {
    target = toUtc(toDate).toISOString().slice(0, 10);
  } catch {
    return 'outside-week';
  }
  if (target < weekStart || target > addDays(weekStart, 6)) return 'outside-week';
  if (target < today) return 'in-past';
  if (week.some((x) => x.slotId !== slotId && x.date === target)) return 'occupied';
  return null;
}
