/**
 * Continuity view: the last N local days as neutral, non-punitive cells.
 * Planned recovery is a successful day exactly like a workout (same daily-core
 * reward). Days without a completed core are shown neutrally: no streaks, no
 * debt, nothing carried forward.
 */
import type { CoreResolution } from '@/domain/game/quests';
import { addDays, weekdayOf } from '@/domain/training/schedule';

export const CONTINUITY_WINDOW_DAYS = 28;

export interface ContinuityDayInput {
  localDate: string;
  /** Resolution of a completed daily core, null when the core is still open. */
  coreResolution: CoreResolution | null;
}

export type ContinuityKind =
  | 'training'
  | 'recovery'
  | 'illness-recovery'
  /** A task day exists but its core was not completed. Neutral, no debt. */
  | 'not-completed'
  /** The app was not opened that day. Neutral. */
  | 'no-record'
  /** Today, core still open. */
  | 'today-open'
  | 'future';

export interface ContinuityCell {
  date: string;
  kind: ContinuityKind;
  isToday: boolean;
  /** Inside the counted window (today - N + 1 … today). Future cells only pad the current week. */
  inWindow: boolean;
}

export interface ContinuitySummary {
  windowDays: number;
  training: number;
  recovery: number;
  illnessRecovery: number;
  /** Days with a completed daily core or a finished workout: all count equally. */
  activeDays: number;
}

export interface ContinuityView {
  today: string;
  /** Monday-aligned grid; `leadingBlanks` empty cells precede the first cell. */
  leadingBlanks: number;
  cells: ContinuityCell[];
  summary: ContinuitySummary;
}

/**
 * @param today local date (YYYY-MM-DD)
 * @param days task days with their core resolution
 * @param trainedDates local dates with a finished workout (training is factual even if the core was resolved otherwise)
 */
export function buildContinuity(
  today: string,
  days: readonly ContinuityDayInput[],
  trainedDates: Iterable<string>,
  windowDays = CONTINUITY_WINDOW_DAYS,
): ContinuityView {
  if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 366) throw new RangeError('windowDays');
  const trained = new Set(trainedDates);
  const byDate = new Map<string, ContinuityDayInput>();
  for (const d of days) {
    const prev = byDate.get(d.localDate);
    // Two task days on one date (timezone travel): a completed core wins.
    if (!prev || (prev.coreResolution === null && d.coreResolution !== null)) byDate.set(d.localDate, d);
  }
  const start = addDays(today, -(windowDays - 1));
  const end = addDays(today, 6 - weekdayOf(today)); // pad to Sunday of this week
  const cells: ContinuityCell[] = [];
  const summary: ContinuitySummary = { windowDays, training: 0, recovery: 0, illnessRecovery: 0, activeDays: 0 };
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const isToday = date === today;
    const inWindow = date <= today;
    const kind = classify(date, today, byDate.get(date), trained.has(date));
    cells.push({ date, kind, isToday, inWindow });
    if (!inWindow) continue;
    if (kind === 'training') summary.training += 1;
    else if (kind === 'recovery') summary.recovery += 1;
    else if (kind === 'illness-recovery') summary.illnessRecovery += 1;
  }
  summary.activeDays = summary.training + summary.recovery + summary.illnessRecovery;
  return { today, leadingBlanks: weekdayOf(start), cells, summary };
}

function classify(date: string, today: string, day: ContinuityDayInput | undefined, trained: boolean): ContinuityKind {
  if (trained) return 'training';
  if (day?.coreResolution) return day.coreResolution;
  if (date > today) return 'future';
  if (date === today) return 'today-open';
  return day ? 'not-completed' : 'no-record';
}

/** Kinds that count as a successful day. Planned recovery is equal to training. */
export const isPositiveKind = (k: ContinuityKind) => k === 'training' || k === 'recovery' || k === 'illness-recovery';
