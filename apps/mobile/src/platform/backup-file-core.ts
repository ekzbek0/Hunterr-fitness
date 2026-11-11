/**
 * Temp-file lifecycle for native backup export/import, kept free of native
 * imports so every path is unit-tested (tests/m3-backup-file.test.ts).
 *
 * Rules:
 * - Only copies the app itself created (its cache directory) are removed. The
 *   backup the user saved elsewhere through the share sheet, and a picked
 *   original outside the cache, are never touched.
 * - Cleanup runs on every path: success, oversize file, read error, share
 *   error, write error, dismissed share sheet.
 * - A failed cleanup is reported (`tempCopyRemoved: false`); the app then does
 *   NOT claim that no copy was left behind.
 */
export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled';

export interface SaveResult {
  outcome: SaveOutcome;
  /** false: an app-owned temporary copy could not be deleted and may still be in the cache. */
  tempCopyRemoved: boolean;
}

export interface PickResult {
  name: string;
  text: string;
  tempCopyRemoved: boolean;
}

/** An operation failed; says whether the temporary copy was cleaned up anyway. */
export class BackupFileError extends Error {
  constructor(
    message: string,
    readonly tempCopyRemoved: boolean,
  ) {
    super(message);
    this.name = 'BackupFileError';
  }
}

export const TEMP_LEFT_NOTICE =
  'Geçici kopya uygulama önbelleğinden silinemedi; hâlâ orada olabilir. Sistem önbelleği sonradan temizleyebilir.';

export interface TempFile {
  uri: string;
  /** True only for a file inside the app's own cache directory. */
  owned: boolean;
  /**
   * True when the system made this copy for the app (document picker) even if
   * its path could not be matched to the app cache. Such a file is NOT deleted
   * (it might not be ours) and is reported as possibly left behind.
   */
  unverifiedCopy?: boolean;
  write(text: string): Promise<void>;
  text(): Promise<string>;
  /** Deletes the file if it exists; throws when deletion fails. */
  remove(): void;
}

/** Returns true when no app-owned copy remains (or there was none to remove). */
function cleanup(file: TempFile | null): boolean {
  if (!file) return true;
  if (!file.owned) return !file.unverifiedCopy;
  try {
    file.remove();
    return true;
  } catch {
    return false;
  }
}

const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export async function saveThroughShare(
  io: {
    shareAvailable(): Promise<boolean>;
    /** Returns an app-cache handle without filesystem mutation; write prepares/replaces the file. */
    createTemp(fileName: string): TempFile;
    share(uri: string): Promise<void>;
  },
  fileName: string,
  json: string,
): Promise<SaveResult> {
  if (!(await io.shareAvailable())) {
    throw new BackupFileError('Bu cihazda paylaşım menüsü kullanılamıyor; yedek kaydedilemedi.', true);
  }
  let file: TempFile | null = null;
  try {
    file = io.createTemp(fileName);
    await file.write(json);
    // Resolves when the sheet closes; iOS does not say whether a target was chosen.
    await io.share(file.uri);
  } catch (e) {
    throw new BackupFileError(message(e, 'Yedek paylaşılamadı.'), cleanup(file));
  }
  return { outcome: 'shared', tempCopyRemoved: cleanup(file) };
}

/**
 * Removes leftover app-owned backup copies (e.g. the app was killed while the
 * share sheet was open). Returns false if any could not be removed.
 */
export function sweepTemps(files: readonly TempFile[]): boolean {
  let all = true;
  for (const f of files) if (f.owned && !cleanup(f)) all = false;
  return all;
}

export async function pickAndRead(
  io: {
    /** null when the user cancelled (nothing was copied). */
    pick(): Promise<{ name: string; size: number | null; file: TempFile } | null>;
  },
  maxBytes: number,
): Promise<PickResult | null> {
  const picked = await io.pick();
  if (!picked) return null;
  let text: string;
  try {
    if (picked.size !== null && picked.size > maxBytes) {
      throw new Error('Dosya çok büyük; bu bir AVCI yedeği değil gibi görünüyor.');
    }
    text = await picked.file.text();
    if (text.length > maxBytes) throw new Error('Dosya çok büyük; bu bir AVCI yedeği değil gibi görünüyor.');
  } catch (e) {
    throw new BackupFileError(message(e, 'Dosya okunamadı.'), cleanup(picked.file));
  }
  return { name: picked.name, text, tempCopyRemoved: cleanup(picked.file) };
}
