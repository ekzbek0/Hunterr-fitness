/**
 * AVCI game economy (docs/PRODUCT.md "Game economy"). Pure, integer-safe.
 * XP is a game reward only; nothing here may influence training load.
 */

export const XP = {
  checkin: 10,
  dailyCore: 60,
  habit: 15,
  weeklyReview: 40,
} as const;

/** Multipliers are stored as integer halves: 1 = x0.5, 2 = x1, 3 = x1.5, 4 = x2. */
export const MULTIPLIER_HALVES = [1, 2, 3, 4] as const;
export type MultiplierHalves = (typeof MULTIPLIER_HALVES)[number];
export const DEFAULT_MULTIPLIER_HALVES: MultiplierHalves = 2;

export function isMultiplierHalves(value: unknown): value is MultiplierHalves {
  return typeof value === 'number' && (MULTIPLIER_HALVES as readonly number[]).includes(value);
}

export function multiplierLabel(halves: MultiplierHalves): string {
  return `x${(halves / 2).toLocaleString('tr-TR')}`;
}

/**
 * Awarded XP for one slot: base * multiplier with half-up integer rounding.
 * base * halves / 2, rounded half up == floor((base * halves + 1) / 2).
 */
export function awardedXp(baseXp: number, halves: MultiplierHalves): number {
  if (!Number.isSafeInteger(baseXp) || baseXp < 0) {
    throw new RangeError('baseXp must be a non-negative safe integer');
  }
  if (!isMultiplierHalves(halves)) throw new RangeError('unsupported multiplier');
  return Math.floor((baseXp * halves + 1) / 2);
}

export const MAX_LEVEL = 100;

/** Total XP required to reach `level` (L>=1): 50*(L-1)*L. */
export function xpForLevel(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new RangeError(`level must be an integer in 1..${MAX_LEVEL}`);
  }
  return 50 * (level - 1) * level;
}

export function levelForXp(totalXp: number): number {
  if (!Number.isFinite(totalXp) || totalXp <= 0) return 1;
  let level = 1;
  while (level < MAX_LEVEL && totalXp >= xpForLevel(level + 1)) level += 1;
  return level;
}

export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
const RANK_FLOORS: readonly [Rank, number][] = [
  ['S', 50],
  ['A', 35],
  ['B', 20],
  ['C', 10],
  ['D', 5],
  ['E', 1],
];

export function rankForLevel(level: number): Rank {
  for (const [rank, floor] of RANK_FLOORS) if (level >= floor) return rank;
  return 'E';
}

export interface LevelProgress {
  totalXp: number;
  level: number;
  rank: Rank;
  levelStartXp: number;
  nextLevelXp: number | null;
  /** 0..1 progress within the current level; 1 at max level. */
  fraction: number;
}

export function levelProgress(totalXp: number): LevelProgress {
  const safeTotal = Number.isFinite(totalXp) && totalXp > 0 ? Math.floor(totalXp) : 0;
  const level = levelForXp(safeTotal);
  const levelStartXp = xpForLevel(level);
  const nextLevelXp = level < MAX_LEVEL ? xpForLevel(level + 1) : null;
  const fraction =
    nextLevelXp === null ? 1 : (safeTotal - levelStartXp) / (nextLevelXp - levelStartXp);
  return { totalXp: safeTotal, level, rank: rankForLevel(level), levelStartXp, nextLevelXp, fraction };
}
