/**
 * Rest timer. The start timestamp, the chosen duration and the latest clock
 * reading seen while the timer ran ("high-water mark") are stored; remaining
 * time is derived from the clock, so backgrounding, a killed app or a reload
 * cannot freeze or reset the countdown.
 *
 * Clock policy: the wall clock is the only time source that survives a
 * restart, and it can be changed by the user. If the clock is ever observed
 * BEFORE the start or before the high-water mark (beyond a small tolerance),
 * the elapsed time is unknown. The timer then becomes `uncertain` for good:
 * it never shows a longer remaining time, never pretends to know the exact
 * elapsed time, and the user restarts or dismisses it. The uncertain state is
 * persisted so a reopened app shows the same thing.
 * Durations are user choices, not a prescription.
 */
export const REST_PRESETS_S = [60, 90, 120, 180] as const;
export const REST_LIMITS = { minS: 15, maxS: 600 } as const;
/** Clock jitter tolerated before a backwards step counts as a clock change. */
export const CLOCK_TOLERANCE_MS = 2000;

export function validateRestDuration(seconds: number): number {
  if (!Number.isInteger(seconds) || seconds < REST_LIMITS.minS || seconds > REST_LIMITS.maxS) {
    throw new RangeError('rest duration');
  }
  return seconds;
}

export interface RestTimer {
  startedAt: string;
  durationS: number;
  /** Latest clock reading persisted while this timer ran (null = only the start). */
  lastSeenAt: string | null;
  /** Set once a backwards clock change was detected; never cleared except by restarting. */
  uncertain: boolean;
}

export type RestView =
  | { state: 'off' }
  | { state: 'running'; remainingS: number }
  | { state: 'done' }
  /** The clock moved backwards while resting: elapsed time is unknown. */
  | { state: 'uncertain' };

/**
 * View of a timer at `nowMs`. `observedMaxMs` is the latest clock reading the
 * caller saw itself (e.g. the UI's own ticks), combined with the stored mark.
 */
export function restView(timer: RestTimer | null, nowMs: number, observedMaxMs: number | null = null): RestView {
  if (!timer) return { state: 'off' };
  if (timer.uncertain) return { state: 'uncertain' };
  const start = Date.parse(timer.startedAt);
  if (!Number.isFinite(start) || !Number.isFinite(nowMs)) return { state: 'uncertain' };
  const seen = timer.lastSeenAt ? Date.parse(timer.lastSeenAt) : start;
  const high = Math.max(start, Number.isFinite(seen) ? seen : start, observedMaxMs ?? start);
  if (nowMs < high - CLOCK_TOLERANCE_MS) return { state: 'uncertain' };
  // Within tolerance a slightly earlier reading is treated as the high-water mark (never longer).
  const effective = Math.max(nowMs, high);
  const remaining = Math.ceil((start + timer.durationS * 1000 - effective) / 1000);
  return remaining <= 0 ? { state: 'done' } : { state: 'running', remainingS: Math.min(remaining, timer.durationS) };
}

/** Whether a reading at `nowMs` is a backwards clock change relative to the timer's marks. */
export function isClockRollback(timer: RestTimer, nowMs: number): boolean {
  return !timer.uncertain && restView(timer, nowMs).state === 'uncertain';
}

export function formatRest(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
