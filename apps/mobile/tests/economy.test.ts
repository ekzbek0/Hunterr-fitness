import { describe, expect, it } from 'vitest';

import { awardedXp, levelForXp, levelProgress, MAX_LEVEL, rankForLevel, xpForLevel } from '@/domain/game/economy';
import { buildDaySlots } from '@/domain/game/quests';

describe('XP economy', () => {
  it('base daily maximum is 100 XP at x1', () => {
    expect(buildDaySlots(['walk10', 'mobility']).reduce((s, t) => s + awardedXp(t.baseXp, 2), 0)).toBe(100);
  });

  it('planned recovery and workout share the same daily-core slot reward', () => {
    const core = buildDaySlots(['walk10', 'mobility']).filter((s) => s.kind === 'core');
    expect(core).toHaveLength(1);
    expect(core[0].baseXp).toBe(60);
  });

  it('rounds each slot half-up with integer arithmetic', () => {
    expect(awardedXp(15, 1)).toBe(8); // 7.5
    expect(awardedXp(15, 3)).toBe(23); // 22.5
    expect(awardedXp(10, 3)).toBe(15);
    expect(awardedXp(60, 4)).toBe(120);
    expect(awardedXp(0, 4)).toBe(0);
  });

  it('rejects unsupported multipliers and invalid base XP', () => {
    expect(() => awardedXp(10, 5 as never)).toThrow();
    expect(() => awardedXp(-1, 2)).toThrow();
    expect(() => awardedXp(Number.NaN, 2)).toThrow();
    expect(() => awardedXp(1.5, 2)).toThrow();
  });

  it('level thresholds follow 50*(L-1)*L', () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([0, 100, 300, 600]);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(300)).toBe(3);
  });

  it('is bounded and safe for absurd totals', () => {
    expect(levelForXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEVEL);
    expect(levelForXp(-50)).toBe(1);
    expect(levelForXp(Number.NaN)).toBe(1);
    expect(levelProgress(Number.MAX_SAFE_INTEGER).fraction).toBe(1);
    expect(() => xpForLevel(MAX_LEVEL + 1)).toThrow();
  });

  it('maps ranks E1 D5 C10 B20 A35 S50', () => {
    expect([1, 4, 5, 9, 10, 19, 20, 34, 35, 49, 50, 100].map(rankForLevel)).toEqual(
      ['E', 'E', 'D', 'D', 'C', 'C', 'B', 'B', 'A', 'A', 'S', 'S'],
    );
  });
});
