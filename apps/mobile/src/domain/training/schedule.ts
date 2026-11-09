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

export interface ScheduleConflict {
  date: string;
  /**
   * same-day: two sessions would share this date.
   * would-displace: a done, running or moved session of this week would vanish or change date.
   */
  kind: 'same-day' | 'would-displace';
  sessions: { slotId: string; programDayId: string; title: string; plannedDate: string; moved: boolean; state: PlannedState }[];
}

const ref = (s: PlannedSession) => ({
  slotId: s.slotId,
  programDayId: s.programDayId,
  title: s.title,
  plannedDate: s.plannedDate,
  moved: s.moved,
  state: s.state,
});

/**
 * Conflicts of a proposed effective week (program + existing moves) from
 * `today` on. A plan change producing any conflict must be refused and shown;
 * sessions are never moved or dropped silently. When `current` (the week
 * under the accepted plan) is given, a done, in-progress or moved session of
 * today or later must keep its slot and date in `next`. Past dates are history.
 */
export function findScheduleConflicts(
  next: readonly PlannedSession[],
  today: string,
  current: readonly PlannedSession[] = [],
): ScheduleConflict[] {
  const out: ScheduleConflict[] = [];
  for (const s of current) {
    if (s.date < today) continue;
    if (s.state !== 'done' && s.state !== 'in-progress' && !s.moved) continue;
    const kept = next.find((n) => n.slotId === s.slotId);
    if (!kept || kept.date !== s.date) out.push({ date: s.date, kind: 'would-displace', sessions: [ref(s)] });
  }
  const byDate = new Map<string, PlannedSession[]>();
  for (const s of next) {
    if (s.date < today) continue;
    byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  }
  // A done/running session keeps occupying the date it happened on, even if the new plan
  // would drop its day or place it elsewhere.
  for (const s of current) {
    if (s.date < today || (s.state !== 'done' && s.state !== 'in-progress')) continue;
    if (next.some((n) => n.slotId === s.slotId && n.date === s.date)) continue;
    const list = byDate.get(s.date) ?? [];
    if (list.length > 0) byDate.set(s.date, [s, ...list]);
  }
  for (const [date, list] of byDate) {
    if (list.length > 1) out.push({ date, kind: 'same-day', sessions: list.map(ref) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}
