import { describe, expect, it } from 'vitest';

import { decideTaskDay, localDateIn, type TaskDayCursor } from '@/domain/game/task-day';

const IST = 'Europe/Istanbul'; // UTC+3, no DST
const NY = 'America/New_York';

function day(localDate: string, timezone: string, lastSeenAt: string): TaskDayCursor {
  return { localDate, timezone, closedAt: null, lastSeenAt };
}

describe('task day lifecycle', () => {
  it('creates the first day on the device date', () => {
    expect(decideTaskDay(null, new Date('2026-11-09T21:30:00Z'), IST)).toEqual({
      action: 'create',
      localDate: '2026-11-10',
    });
  });

  it('resumes the same day and rolls over after local midnight', () => {
    const d = day('2026-11-09', IST, '2026-11-09T08:00:00Z');
    expect(decideTaskDay(d, new Date('2026-11-09T20:59:00Z'), IST).action).toBe('resume');
    expect(decideTaskDay(d, new Date('2026-11-09T21:00:00Z'), IST)).toEqual({
      action: 'rollover',
      localDate: '2026-11-10',
    });
  });

  it('missed days jump straight to today without back-filling', () => {
    const d = day('2026-11-01', IST, '2026-11-01T08:00:00Z');
    expect(decideTaskDay(d, new Date('2026-11-09T08:00:00Z'), IST)).toEqual({
      action: 'rollover',
      localDate: '2026-11-09',
    });
  });

  it('clock rollback freezes rewards and never reopens or rolls a day', () => {
    const d = day('2026-11-09', IST, '2026-11-09T12:00:00Z');
    expect(decideTaskDay(d, new Date('2026-11-08T12:00:00Z'), IST)).toEqual({ action: 'resume', clockAnomaly: true });
    // Small drift within tolerance is fine.
    expect(decideTaskDay(d, new Date('2026-11-09T11:57:00Z'), IST)).toEqual({ action: 'resume', clockAnomaly: false });
  });

  it('eastward travel cannot end the day before its captured timezone does', () => {
    const d = day('2026-11-09', IST, '2026-11-09T12:00:00Z');
    // 16:00Z = 01:00 next day in Tokyo, but still 19:00 in Istanbul.
    expect(decideTaskDay(d, new Date('2026-11-09T16:00:00Z'), 'Asia/Tokyo').action).toBe('resume');
  });

  it('westward travel cannot create a second day with the same date', () => {
    const d = day('2026-11-09', IST, '2026-11-09T12:00:00Z');
    // 22:00Z: Istanbul is on 10 Nov, New York still on 9 Nov -> keep current day.
    expect(decideTaskDay(d, new Date('2026-11-09T22:00:00Z'), NY).action).toBe('resume');
    // Once New York also passes midnight, roll over to 10 Nov.
    expect(decideTaskDay(d, new Date('2026-11-10T05:01:00Z'), NY)).toEqual({ action: 'rollover', localDate: '2026-11-10' });
  });

  it('computes local dates correctly across a DST transition', () => {
    // US DST starts 2026-03-08 02:00 local (07:00Z). 04:59Z is 23:59 EST on Mar 7.
    expect(localDateIn(new Date('2026-03-08T04:59:00Z'), NY)).toBe('2026-03-07');
    expect(localDateIn(new Date('2026-03-08T05:00:00Z'), NY)).toBe('2026-03-08');
    // After the switch the day ends at 04:00Z (midnight EDT), not 05:00Z.
    const d = day('2026-03-08', NY, '2026-03-08T12:00:00Z');
    expect(decideTaskDay(d, new Date('2026-03-09T03:59:00Z'), NY).action).toBe('resume');
    expect(decideTaskDay(d, new Date('2026-03-09T04:00:00Z'), NY).action).toBe('rollover');
  });

  it('the 25-hour day at the end of DST is still one day: no early rollover, no second day', () => {
    // US DST ends 2026-11-01 02:00 local. Nov 1 runs from 04:00Z to Nov 2 05:00Z (25 hours).
    expect(localDateIn(new Date('2026-11-01T04:00:00Z'), NY)).toBe('2026-11-01');
    const d = day('2026-11-01', NY, '2026-11-01T12:00:00Z');
    // 24 hours after local midnight it is still Nov 1 (the repeated hour).
    expect(decideTaskDay(d, new Date('2026-11-02T04:30:00Z'), NY)).toEqual({ action: 'resume', clockAnomaly: false });
    expect(decideTaskDay(d, new Date('2026-11-02T05:00:00Z'), NY)).toEqual({ action: 'rollover', localDate: '2026-11-02' });
  });

  it('rejects an invalid clock', () => {
    expect(() => decideTaskDay(null, new Date('x'), IST)).toThrow();
  });
});
