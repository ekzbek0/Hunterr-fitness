/** Impact summary of a data set (current device or backup), shown before a restore. Pure. */
import type { BackupData } from '@/data/types';

export interface BackupCounts {
  taskDays: number;
  checkins: number;
  sessions: number;
  sets: number;
  plans: number;
  weeklyReviews: number;
  proposals: number;
  /** Visible measurements; deletion tombstones are counted separately. */
  measurements: number;
  deletedMeasurements: number;
  ledger: number;
}

export interface BackupSummary {
  hasProfile: boolean;
  hasTrainingProfile: boolean;
  counts: BackupCounts;
  /** Sum of the profile's XP ledger (the same total the app shows). */
  totalXp: number;
  /** Earliest / latest local date among task days and measurements; null when empty. */
  firstDate: string | null;
  lastDate: string | null;
}

export function summarizeBackup(data: BackupData): BackupSummary {
  const profileId = data.profile?.id ?? null;
  const visible = data.measurements.filter((m) => m.deletedAt === null);
  const dates = [...data.taskDays.map((d) => d.localDate), ...visible.map((m) => m.measuredOn)].sort();
  return {
    hasProfile: data.profile !== null,
    hasTrainingProfile: data.trainingProfile !== null,
    counts: {
      taskDays: data.taskDays.length,
      checkins: data.checkins.length,
      sessions: data.sessions.length,
      sets: data.sets.length,
      plans: data.plans.length,
      weeklyReviews: data.weeklyReviews.length,
      proposals: data.proposals.length,
      measurements: visible.length,
      deletedMeasurements: data.measurements.length - visible.length,
      ledger: data.ledger.length,
    },
    totalXp: data.ledger.filter((e) => e.profileId === profileId).reduce((s, e) => s + e.awardedXp, 0),
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
}

/** Turkish labels for the counts, in display order. */
export const COUNT_LABELS: readonly [keyof BackupCounts, string][] = [
  ['taskDays', 'Görev günleri'],
  ['checkins', 'Günlük kontroller'],
  ['sessions', 'Antrenmanlar'],
  ['sets', 'Setler'],
  ['plans', 'Program sürümleri'],
  ['weeklyReviews', 'Haftalık değerlendirmeler'],
  ['proposals', 'Yük önerileri'],
  ['measurements', 'Ölçümler'],
  ['ledger', 'XP kayıtları'],
];
