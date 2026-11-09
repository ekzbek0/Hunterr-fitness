import { describe, expect, it } from 'vitest';

import { suggestCore, type CheckinInput } from '@/domain/training/readiness';

const ok: CheckinInput = { sleepHours: 8, energy: 4, fatigue: 2, soreness: 1, jointPain: 'no', illness: 'no' };

describe('daily core suggestion', () => {
  it('follows the plan when nothing blocks it', () => {
    expect(suggestCore(ok)).toEqual({ mode: 'follow-plan', freezeLoadIncrease: false, reasons: [] });
  });
  it('systemic illness pauses structured training', () => {
    expect(suggestCore({ ...ok, illness: 'yes' }).mode).toBe('pause-training');
  });
  it('poor recovery offers rest and freezes load increases', () => {
    for (const c of [{ sleepHours: 5 }, { fatigue: 4 }, { soreness: 3 }, { jointPain: 'yes' as const }]) {
      const s = suggestCore({ ...ok, ...c });
      expect(s.mode).toBe('recovery-offered');
      expect(s.freezeLoadIncrease).toBe(true);
    }
  });
  it('unknown safety answers are not zeros: they block load increases', () => {
    const s = suggestCore({ ...ok, illness: 'unknown' });
    expect(s.freezeLoadIncrease).toBe(true);
    expect(s.reasons).toContain('safety-unknown');
  });
  it('missing sleep is unknown, not short sleep', () => {
    expect(suggestCore({ ...ok, sleepHours: null }).reasons).not.toContain('short-sleep');
  });
  it('rejects out-of-range and NaN input', () => {
    expect(() => suggestCore({ ...ok, energy: 0 })).toThrow();
    expect(() => suggestCore({ ...ok, soreness: Number.NaN })).toThrow();
    expect(() => suggestCore({ ...ok, sleepHours: -1 })).toThrow();
  });
});
