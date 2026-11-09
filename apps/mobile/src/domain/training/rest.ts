/**
 * Rest timer. Only the start timestamp and the chosen duration are stored;
 * the remaining time is always derived from the clock, so backgrounding,
 * a killed app or a reload cannot freeze or reset the countdown.
 * Durations are user choices, not a prescription.
 */
export const REST_PRESETS_S = [60, 90, 120, 180] as const;
export const REST_LIMITS = { minS: 15, maxS: 600 } as const;

export function validateRestDuration(seconds: number): number {
  if (!Number.isInteger(seconds) || seconds < REST_LIMITS.minS || seconds > REST_LIMITS.maxS) {
    throw new RangeError('rest duration');
  }
  return seconds;
}

export interface RestTimer {
  startedAt: string;
  durationS: number;
}

/**
 * Whole seconds left (0 = done). If the device clock is now before the start
 * (clock moved back), the timer is not extended beyond its duration.
 */
export function restRemainingSeconds(timer: RestTimer | null, nowMs: number): number {
  if (!timer) return 0;
  const start = Date.parse(timer.startedAt);
  if (!Number.isFinite(start) || !Number.isFinite(nowMs)) return 0;
  const end = start + timer.durationS * 1000;
  if (nowMs < start) return timer.durationS;
  return Math.max(0, Math.ceil((end - nowMs) / 1000));
}

export function formatRest(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
