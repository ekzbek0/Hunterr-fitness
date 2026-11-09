/**
 * AVCI cosmetic unlocks (docs/PRODUCT.md "Game economy"). Pure and deterministic.
 * Everything here is appearance only: it is derived from level and never feeds
 * back into any other system.
 */
import { MAX_LEVEL, rankForLevel, type Rank } from './economy';

/** Clamp any input to a supported integer level in 1..MAX_LEVEL. */
export function safeLevel(level: unknown): number {
  if (typeof level !== 'number' || !Number.isFinite(level)) return 1;
  const whole = Math.floor(level);
  if (whole < 1) return 1;
  if (whole > MAX_LEVEL) return MAX_LEVEL;
  return whole;
}

/** Fixed original palette keys; the UI maps them to theme colours. */
export type PaletteKey = 'slate' | 'steel' | 'azure' | 'violet' | 'starlight';

export interface BadgeDef {
  id: string;
  name: string;
  unlockLevel: number;
}

/** Badge thresholds align with rank floors (E1, D5, C10, B20, A35, S50) plus milestones. */
export const BADGE_DEFS: readonly BadgeDef[] = [
  { id: 'first-trail', name: 'İlk İz', unlockLevel: 2 },
  { id: 'trail-mark', name: 'İz Mührü', unlockLevel: 5 },
  { id: 'steady-crest', name: 'Kararlılık Arması', unlockLevel: 10 },
  { id: 'night-watch', name: 'Gece Nöbeti Nişanı', unlockLevel: 20 },
  { id: 'storm-sigil', name: 'Fırtına Damgası', unlockLevel: 35 },
  { id: 'legend-crown', name: 'Efsane Tacı', unlockLevel: 50 },
  { id: 'star-path', name: 'Yıldız Yolu', unlockLevel: 75 },
  { id: 'summit-sigil', name: 'Zirve Mührü', unlockLevel: 100 },
] as const;

export interface Badge extends BadgeDef {
  unlocked: boolean;
}

export function badgesFor(level: unknown): Badge[] {
  const lv = safeLevel(level);
  return BADGE_DEFS.map((b) => ({ ...b, unlocked: lv >= b.unlockLevel }));
}

/** The next locked badge, or null when every badge is unlocked. */
export function nextBadge(level: unknown): BadgeDef | null {
  const lv = safeLevel(level);
  return BADGE_DEFS.find((b) => lv < b.unlockLevel) ?? null;
}

export interface AvatarAppearance {
  level: number;
  rank: Rank;
  /** 0..BADGE_DEFS.length: number of badge milestones reached. */
  tier: number;
  /** Concentric rings around the core, 1..4. */
  rings: number;
  /** Small crest marks around the outer ring, 0..8. */
  crestPieces: number;
  /** Top crown shard shown from the S-rank milestone. */
  crown: boolean;
  palette: { core: PaletteKey; ring: PaletteKey; accent: PaletteKey };
  /** Turkish emblem title for this tier. */
  title: string;
}

const TIER_TITLES = [
  'Sönük Mühür',
  'Uyanan Mühür',
  'İz Mührü',
  'Kararlı Arma',
  'Nöbetçi Arması',
  'Fırtına Arması',
  'Efsane Arması',
  'Yıldız Arması',
  'Zirve Arması',
] as const;

const TIER_PALETTES: readonly AvatarAppearance['palette'][] = [
  { core: 'slate', ring: 'steel', accent: 'steel' },
  { core: 'slate', ring: 'azure', accent: 'steel' },
  { core: 'slate', ring: 'azure', accent: 'azure' },
  { core: 'steel', ring: 'azure', accent: 'violet' },
  { core: 'steel', ring: 'violet', accent: 'azure' },
  { core: 'azure', ring: 'violet', accent: 'violet' },
  { core: 'violet', ring: 'azure', accent: 'starlight' },
  { core: 'violet', ring: 'violet', accent: 'starlight' },
  { core: 'azure', ring: 'starlight', accent: 'starlight' },
];

export function avatarFor(level: unknown): AvatarAppearance {
  const lv = safeLevel(level);
  const tier = BADGE_DEFS.filter((b) => lv >= b.unlockLevel).length;
  return {
    level: lv,
    rank: rankForLevel(lv),
    tier,
    rings: Math.min(4, 1 + Math.floor(tier / 2)),
    crestPieces: tier,
    crown: tier >= 6,
    palette: TIER_PALETTES[tier],
    title: TIER_TITLES[tier],
  };
}
