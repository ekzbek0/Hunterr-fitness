/** Daily quest slot definitions. Slot keys are stable reward identities. */
import { XP } from './economy';

export type SlotKind = 'checkin' | 'core' | 'habit';
export type CoreResolution = 'training' | 'recovery' | 'illness-recovery';

export const SLOT_KEYS = {
  checkin: 'checkin',
  core: 'core',
  habit1: 'habit-1',
  habit2: 'habit-2',
} as const;

export interface HabitDefinition {
  key: string;
  title: string;
}

/** Initial habit catalog. Self-reported; no objective verification is implied. */
export const HABIT_CATALOG: readonly HabitDefinition[] = [
  { key: 'walk10', title: '10 dakika yürüyüş' },
  { key: 'mobility', title: '5 dakika hareketlilik çalışması' },
  { key: 'meal-plan', title: 'Günün öğünlerini planla' },
  { key: 'water', title: 'Su içmeyi gün boyu takip et' },
  { key: 'screen-off', title: 'Uykudan önce 30 dakika ekransız' },
];

export const DEFAULT_HABIT_KEYS: readonly [string, string] = ['walk10', 'mobility'];

export function habitTitle(key: string): string {
  return HABIT_CATALOG.find((h) => h.key === key)?.title ?? key;
}

export function validateHabitKeys(keys: readonly string[]): [string, string] {
  if (keys.length !== 2 || keys[0] === keys[1]) {
    throw new RangeError('exactly two different habits are required');
  }
  for (const key of keys) {
    if (!HABIT_CATALOG.some((h) => h.key === key)) throw new RangeError(`unknown habit ${key}`);
  }
  return [keys[0], keys[1]];
}

export interface SlotTemplate {
  slotKey: string;
  kind: SlotKind;
  title: string;
  baseXp: number;
}

/** Slots for a new task day. Habit choices are snapshotted: edits apply next day. */
export function buildDaySlots(habitKeys: readonly string[]): SlotTemplate[] {
  const [h1, h2] = validateHabitKeys(habitKeys);
  return [
    { slotKey: SLOT_KEYS.checkin, kind: 'checkin', title: 'Günlük kontrol', baseXp: XP.checkin },
    { slotKey: SLOT_KEYS.core, kind: 'core', title: 'Ana görev: antrenman veya toparlanma', baseXp: XP.dailyCore },
    { slotKey: SLOT_KEYS.habit1, kind: 'habit', title: habitTitle(h1), baseXp: XP.habit },
    { slotKey: SLOT_KEYS.habit2, kind: 'habit', title: habitTitle(h2), baseXp: XP.habit },
  ];
}
