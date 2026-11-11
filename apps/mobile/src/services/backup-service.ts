/**
 * M3 backup / restore / delete-all (docs/DATA_MODEL.md "Export/import/delete").
 *
 * - Export reads every record in ONE transaction (consistent snapshot) and
 *   writes a versioned, checksummed JSON envelope. No tokens or secrets exist
 *   in local storage, so none can leak into the file.
 * - Import validates the whole file first (format, version, checksum, size,
 *   every record, every relationship). Only a fully valid file reaches the
 *   single transaction that REPLACES all local data; any failure rolls back and
 *   the existing data stays untouched. Replacement semantics make a repeated
 *   import idempotent: XP equals the backup's ledger, never a sum.
 * - A file whose latest day is ahead of this device's clock is refused too
 *   (domain/backup/clock.ts): it would freeze rewards or pin "today".
 * - Delete-all cancels reminders FIRST (policy: if that fails nothing is
 *   deleted and the user can retry), then empties every table in one
 *   transaction. No hidden copy is kept and nothing is restored automatically.
 */
import { LATEST_SCHEMA_VERSION } from '@/data/sqlite/migrations';
import { DEFAULT_SETTINGS, type AvciRepository, type BackupData } from '@/data/types';
import { canonicalJson } from '@/domain/backup/canonical-json';
import { checkBackupClock } from '@/domain/backup/clock';
import { backupFileName, buildBackupEnvelope, parseBackupText, serializeBackup } from '@/domain/backup/format';
import { summarizeBackup, type BackupSummary } from '@/domain/backup/summary';
import { validateBackupData, type BackupIssue } from '@/domain/backup/validate';
import { isValidTimeZone, localDateIn } from '@/domain/game/task-day';
import { systemClock, type Clock } from '@/services/avci-service';

export const RESTORE_REPLACES_NOTICE =
  'Geri yükleme birleştirme yapmaz: bu cihazdaki TÜM mevcut kayıtlar silinir ve yerine yedekteki kayıtlar yazılır.';

export interface ExportResult {
  fileName: string;
  json: string;
  summary: BackupSummary;
  /** Problems a later restore of this file would report (normally empty). The file is still produced. */
  issues: BackupIssue[];
}

export type ImportPreview =
  | {
      ok: true;
      exportedAt: string;
      version: number;
      appSchema: string;
      /** null when the current records cannot be read; never invent zero totals for recovery. */
      current: BackupSummary | null;
      backup: BackupSummary;
      /** Always true: a restore replaces all local data; it is not a merge. */
      replacesAll: true;
      notice: string;
      /** Reminder choice stored in the backup; it becomes active again after a restore. */
      backupReminders: { enabled: boolean; times: string[] };
    }
  | { ok: false; errors: BackupIssue[]; totalErrors: number };

export type ImportResult =
  | { status: 'restored'; summary: BackupSummary }
  | { status: 'rejected'; errors: BackupIssue[]; totalErrors: number }
  /** The write itself failed; the transaction rolled back and the previous data is unchanged. */
  | { status: 'failed'; message: string };

export type DeleteResult =
  /** `storagePurged` false: rows are gone, but the storage layer could not confirm that no residue of them remains in its files. */
  | { status: 'deleted'; storagePurged: boolean }
  | { status: 'failed'; stage: 'reminders' | 'storage'; message: string };

export function emptyBackupData(): BackupData {
  return {
    profile: null,
    taskDays: [],
    slots: [],
    checkins: [],
    ledger: [],
    trainingProfile: null,
    plans: [],
    moves: [],
    sessions: [],
    sets: [],
    weeklyCycles: [],
    weeklyReviews: [],
    proposals: [],
    increments: [],
    measurements: [],
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}

/** Table row order is adapter-specific; every stored field and nested array order is significant.
 * Capture before replaceAll so an adapter cannot mutate the expected payload during writing.
 */
const backupContents = (data: BackupData): string => canonicalJson(Object.fromEntries(
  Object.entries(data).map(([table, value]) => [table, Array.isArray(value) ? value.map(canonicalJson).sort() : value]),
));

export class BackupService {
  constructor(
    private readonly repo: AvciRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async exportBackup(): Promise<ExportResult> {
    const dumped = await this.repo.transaction((tx) => tx.dumpAll());
    // A deleted measurement never leaves the device (rows deleted before hard-delete existed are dropped here).
    const data = { ...dumped, measurements: dumped.measurements.filter((m) => m.deletedAt === null) };
    const now = this.clock.now();
    const tz = this.clock.timeZone();
    const envelope = buildBackupEnvelope(data, now.toISOString(), `avci-veri-semasi-${LATEST_SCHEMA_VERSION}`);
    const check = validateBackupData(data);
    return {
      fileName: backupFileName(localDateIn(now, isValidTimeZone(tz) ? tz : 'UTC')),
      json: serializeBackup(envelope),
      summary: summarizeBackup(data),
      issues: check.ok ? [] : check.errors,
    };
  }

  /** Validates the file and compares it with the current data. Writes nothing. */
  async previewImport(text: string): Promise<ImportPreview> {
    const parsed = parseBackupText(text);
    if (!parsed.ok) return parsed;
    const ahead = checkBackupClock(parsed.envelope.data, this.clock.now());
    if (ahead.length > 0) return { ok: false, errors: ahead, totalErrors: ahead.length };
    // Recovery must not depend on reading the damaged records being replaced.
    // Validate the incoming file first, then attempt an honest impact summary.
    // A failed current read does not change or repair it; restore still needs
    // explicit confirmation and revalidates the backup before atomic replacement.
    let current: BackupSummary | null = null;
    try {
      current = summarizeBackup(await this.repo.transaction((tx) => tx.dumpAll()));
    } catch {
      // Unknown counts are displayed as unknown, rather than as an empty database.
    }
    return {
      ok: true,
      exportedAt: parsed.envelope.exportedAt,
      version: parsed.envelope.version,
      appSchema: parsed.envelope.appSchema,
      current,
      backup: summarizeBackup(parsed.envelope.data),
      replacesAll: true,
      notice: RESTORE_REPLACES_NOTICE,
      backupReminders: parsed.envelope.data.settings.reminders,
    };
  }

  /**
   * Re-validates and replaces ALL local data with the backup in one
   * transaction. The caller confirms first (previewImport) and reconciles
   * reminders afterwards.
   */
  async importBackup(text: string): Promise<ImportResult> {
    const parsed = parseBackupText(text);
    if (!parsed.ok) return { status: 'rejected', errors: parsed.errors, totalErrors: parsed.totalErrors };
    const data = parsed.envelope.data;
    const ahead = checkBackupClock(data, this.clock.now());
    if (ahead.length > 0) return { status: 'rejected', errors: ahead, totalErrors: ahead.length };
    const expected = summarizeBackup(data);
    const expectedContents = backupContents(data);
    try {
      await this.repo.transaction(async (tx) => {
        await tx.replaceAll(data);
        // Read back every field inside the transaction. Equal counts/XP alone
        // cannot detect silently altered loads, prescriptions or settings.
        if (backupContents(await tx.dumpAll()) !== expectedContents) {
          throw new Error('restore verification failed');
        }
      });
    } catch {
      return { status: 'failed', message: 'Geri yükleme tamamlanamadı; mevcut verilerin değiştirilmedi.' };
    }
    return { status: 'restored', summary: expected };
  }

  /**
   * Deletes every local record. Reminders are cancelled first so none fires for
   * deleted data; if cancelling fails, nothing is deleted.
   */
  async deleteAllData(cancelReminders: () => Promise<void>): Promise<DeleteResult> {
    try {
      await cancelReminders();
    } catch {
      return {
        status: 'failed',
        stage: 'reminders',
        message: 'Hatırlatmalar iptal edilemediği için hiçbir veri silinmedi. Lütfen tekrar dene.',
      };
    }
    const empty = emptyBackupData();
    const expectedContents = backupContents(empty);
    try {
      await this.repo.transaction(async (tx) => {
        await tx.replaceAll(empty);
        if (backupContents(await tx.dumpAll()) !== expectedContents) throw new Error('delete verification failed');
      });
    } catch {
      return { status: 'failed', stage: 'storage', message: 'Veriler silinemedi; kayıtların değiştirilmedi. Lütfen tekrar dene.' };
    }
    let storagePurged = false;
    try {
      storagePurged = await this.repo.purgeDeleted();
    } catch {
      storagePurged = false;
    }
    return { status: 'deleted', storagePurged };
  }
}
