/**
 * Versioned backup file: `{ format, version, exportedAt, appSchema, checksum, data }`.
 * The checksum is SHA-256 (hex) of the canonical JSON of `data`. Parsing runs
 * every check (size, JSON, format, version, checksum, full data validation)
 * before the caller may write anything. Pure: the time is passed in.
 */
import type { BackupData } from '@/data/types';

import { canonicalJson } from './canonical-json';
import { sha256Hex } from './sha256';
import { IssueList, isIsoTimestamp, validateBackupData, type BackupIssue } from './validate';

export const BACKUP_FORMAT = 'avci-backup';
export const BACKUP_VERSION = 1;
/** Largest accepted backup text, in UTF-16 characters (about 20 MB of JSON). */
export const MAX_BACKUP_CHARS = 20 * 1024 * 1024;
/** Same limit for a picked file's byte size, checked before reading it. */
export const MAX_BACKUP_BYTES = MAX_BACKUP_CHARS;

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  /** Informational: the app data schema the file was written from. */
  appSchema: string;
  checksum: string;
  data: BackupData;
}

export type ParsedBackup =
  | { ok: true; envelope: BackupEnvelope }
  | { ok: false; errors: BackupIssue[]; totalErrors: number };

export function backupChecksum(data: BackupData): string {
  return sha256Hex(canonicalJson(data));
}

export function buildBackupEnvelope(data: BackupData, exportedAt: string, appSchema: string): BackupEnvelope {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, appSchema, checksum: backupChecksum(data), data };
}

/** Human-readable JSON (2-space indentation); key order of the envelope is fixed. */
export function serializeBackup(envelope: BackupEnvelope): string {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

/** `avci-yedek-YYYY-MM-DD.json` for the given local date. */
export function backupFileName(localDate: string): string {
  return `avci-yedek-${localDate}.json`;
}

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(list: IssueList): ParsedBackup {
  return { ok: false, errors: list.issues, totalErrors: list.total };
}

/** Parses and fully validates backup text. Nothing here has side effects. */
export function parseBackupText(text: unknown): ParsedBackup {
  const list = new IssueList();
  if (typeof text !== 'string') {
    list.add('not-json', '', 'Dosya okunamadı (metin değil).');
    return fail(list);
  }
  if (text.length > MAX_BACKUP_CHARS) {
    list.add('too-large', '', `Dosya çok büyük (en fazla ${MAX_BACKUP_CHARS / (1024 * 1024)} MB). Bu bir AVCI yedeği değil gibi görünüyor.`);
    return fail(list);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    list.add('not-json', '', 'Dosya geçerli bir JSON değil; bozulmuş ya da yarım kalmış olabilir.');
    return fail(list);
  }
  if (!isRec(raw) || raw.format !== BACKUP_FORMAT) {
    list.add('unknown-format', 'format', 'Bu dosya bir AVCI yedeği değil (biçim tanınmıyor).');
    return fail(list);
  }
  const version = raw.version;
  if (!Number.isInteger(version) || (version as number) < 1) {
    list.add('bad-version', 'version', 'Yedeğin sürüm bilgisi geçersiz.');
    return fail(list);
  }
  if ((version as number) > BACKUP_VERSION) {
    list.add(
      'future-version',
      'version',
      `Bu yedek uygulamanın daha yeni bir sürümüyle oluşturulmuş (yedek sürümü ${String(version)}, desteklenen ${BACKUP_VERSION}). Önce uygulamayı güncelle.`,
    );
    return fail(list);
  }
  for (const k of Object.keys(raw)) {
    if (!['format', 'version', 'exportedAt', 'appSchema', 'checksum', 'data'].includes(k)) {
      list.add('envelope', k, `Yedek dosyasında bilinmeyen alan: "${k}".`);
    }
  }
  if (!isIsoTimestamp(raw.exportedAt)) list.add('envelope', 'exportedAt', 'Yedeğin oluşturulma zamanı geçersiz.');
  if (typeof raw.appSchema !== 'string' || raw.appSchema.length > 200) list.add('envelope', 'appSchema', 'Yedeğin şema bilgisi geçersiz.');
  if (typeof raw.checksum !== 'string' || !/^[0-9a-f]{64}$/.test(raw.checksum)) {
    list.add('checksum', 'checksum', 'Yedeğin sağlama toplamı eksik veya geçersiz.');
  }
  if (!isRec(raw.data)) list.add('structure', 'data', 'Yedekte veri bölümü yok.');
  if (list.total > 0) return fail(list);

  let actual: string;
  try {
    actual = sha256Hex(canonicalJson(raw.data));
  } catch {
    list.add('structure', 'data', 'Yedekteki veri okunamadı.');
    return fail(list);
  }
  if (actual !== raw.checksum) {
    list.add('checksum', 'checksum', 'Sağlama toplamı tutmuyor: dosya bozulmuş veya sonradan değiştirilmiş.');
    return fail(list);
  }
  const v = validateBackupData(raw.data);
  if (!v.ok) return { ok: false, errors: v.errors, totalErrors: v.totalErrors };
  return {
    ok: true,
    envelope: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: raw.exportedAt as string,
      appSchema: raw.appSchema as string,
      checksum: actual,
      data: v.data,
    },
  };
}
