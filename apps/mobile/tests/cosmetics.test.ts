import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { avatarFor, BADGE_DEFS, badgesFor, nextBadge, safeLevel } from '@/domain/game/cosmetics';
import { MAX_LEVEL, rankForLevel } from '@/domain/game/economy';

const unlockedIds = (level: number) => badgesFor(level).filter((b) => b.unlocked).map((b) => b.id);

describe('cosmetic unlocks', () => {
  it.each([
    [1, 0, 'E'],
    [2, 1, 'E'],
    [4, 1, 'E'],
    [5, 2, 'D'],
    [9, 2, 'D'],
    [10, 3, 'C'],
    [19, 3, 'C'],
    [20, 4, 'B'],
    [34, 4, 'B'],
    [35, 5, 'A'],
    [49, 5, 'A'],
    [50, 6, 'S'],
    [74, 6, 'S'],
    [75, 7, 'S'],
    [99, 7, 'S'],
    [100, 8, 'S'],
  ] as const)('level %i unlocks %i badges, rank %s', (level, count, rank) => {
    expect(unlockedIds(level)).toHaveLength(count);
    const avatar = avatarFor(level);
    expect(avatar.tier).toBe(count);
    expect(avatar.rank).toBe(rank);
    expect(avatar.rank).toBe(rankForLevel(level));
  });

  it('badge thresholds align with rank floors', () => {
    expect(BADGE_DEFS.map((b) => b.unlockLevel)).toEqual([2, 5, 10, 20, 35, 50, 75, 100]);
    for (const floor of [5, 10, 20, 35, 50]) {
      expect(rankForLevel(floor)).not.toBe(rankForLevel(floor - 1));
      expect(BADGE_DEFS.some((b) => b.unlockLevel === floor)).toBe(true);
    }
  });

  it('unlocked set and avatar features only grow with level', () => {
    let prevIds: string[] = [];
    let prev = avatarFor(1);
    for (let lv = 1; lv <= MAX_LEVEL; lv += 1) {
      const ids = unlockedIds(lv);
      for (const id of prevIds) expect(ids).toContain(id);
      const a = avatarFor(lv);
      expect(a.tier).toBeGreaterThanOrEqual(prev.tier);
      expect(a.rings).toBeGreaterThanOrEqual(prev.rings);
      expect(a.crestPieces).toBeGreaterThanOrEqual(prev.crestPieces);
      if (prev.crown) expect(a.crown).toBe(true);
      prevIds = ids;
      prev = a;
    }
    expect(avatarFor(1).rings).toBe(1);
    expect(avatarFor(MAX_LEVEL).rings).toBe(4);
    expect(avatarFor(49).crown).toBe(false);
    expect(avatarFor(50).crown).toBe(true);
  });

  it('is deterministic and every tier has a Turkish title', () => {
    expect(avatarFor(37)).toEqual(avatarFor(37));
    const titles = new Set(Array.from({ length: MAX_LEVEL }, (_, i) => avatarFor(i + 1).title));
    expect(titles.size).toBe(BADGE_DEFS.length + 1);
    for (const t of titles) expect(t.length).toBeGreaterThan(0);
  });

  it('next badge is the lowest locked one, null at max', () => {
    expect(nextBadge(1)?.unlockLevel).toBe(2);
    expect(nextBadge(2)?.unlockLevel).toBe(5);
    expect(nextBadge(99)?.unlockLevel).toBe(100);
    expect(nextBadge(100)).toBeNull();
  });

  it('handles invalid input safely', () => {
    for (const bad of [Number.NaN, -5, 0, Number.NEGATIVE_INFINITY, undefined, null, '10']) {
      expect(safeLevel(bad)).toBe(1);
      expect(unlockedIds(bad as number)).toEqual([]);
      expect(avatarFor(bad).level).toBe(1);
    }
    expect(safeLevel(Number.POSITIVE_INFINITY)).toBe(1);
    expect(safeLevel(1000)).toBe(MAX_LEVEL);
    expect(avatarFor(1e9).tier).toBe(BADGE_DEFS.length);
    expect(safeLevel(4.99)).toBe(4);
    expect(unlockedIds(4.99)).toHaveLength(1);
    expect(avatarFor(9.9).rank).toBe('D');
  });

  it('cosmetics source stays independent of training and services', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/domain/game/cosmetics.ts', import.meta.url)),
      'utf8',
    );
    const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports).toEqual(['./economy']);
    expect(src).not.toMatch(/training|services|react/i);
    expect(src).not.toMatch(/\b(load|sets?|reps?|prescription)\b/i);
  });
});
