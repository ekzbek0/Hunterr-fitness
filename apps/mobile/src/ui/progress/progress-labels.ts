/** Turkish copy for the Gelişim tab. Pure (no React Native imports), so tests can check it. */
import type { MeasurementType, MeasurementUnit } from '@/data/types';
import type { ContinuityKind, ContinuitySummary } from '@/domain/progress/continuity';
import type { MeasurementError } from '@/domain/progress/measurements';
import { MEASUREMENT_RANGES } from '@/domain/progress/measurements';
import type { ExerciseSeries } from '@/domain/progress/series';
import { fmtLoad, LOAD_CONVENTION_LABELS } from '@/ui/labels';

export const MEASUREMENT_TYPE_LABELS: Record<MeasurementType, string> = {
  'body-weight': 'Vücut ağırlığı',
  waist: 'Bel çevresi',
  chest: 'Göğüs çevresi',
  hip: 'Kalça çevresi',
  arm: 'Kol çevresi',
  thigh: 'Uyluk çevresi',
};

export const MEASUREMENT_UNIT_LABELS: Record<MeasurementUnit, string> = { kg: 'kg', lb: 'lb', cm: 'cm', in: 'inç' };

export function measurementErrorText(e: MeasurementError, unit: MeasurementUnit | null): string {
  switch (e) {
    case 'type':
      return 'Bir ölçüm türü seç.';
    case 'unit':
      return 'Bu ölçüm türü için geçerli bir birim seç.';
    case 'value-missing':
      return 'Ölçüm değerini gir.';
    case 'value-format':
      return 'Değer bir sayı olmalı (ör. 72,5).';
    case 'value-range': {
      if (!unit) return 'Değer beklenen aralığın dışında.';
      const r = MEASUREMENT_RANGES[unit];
      return `Değer ${fmtLoad(r.min)}–${fmtLoad(r.max)} ${MEASUREMENT_UNIT_LABELS[unit]} aralığında olmalı. Yazım hatası olabilir mi?`;
    }
    case 'date-format':
      return 'Tarihi YYYY-AA-GG biçiminde gir (ör. 2026-11-09).';
    case 'date-future':
      return 'Gelecekteki bir tarih girilemez.';
    case 'date-too-old':
      return '2000 yılından önceki bir tarih girilemez.';
    default:
      return 'Geçersiz değer.';
  }
}

export const CONTINUITY_LABELS: Record<ContinuityKind, string> = {
  training: 'Antrenman',
  recovery: 'Planlı toparlanma',
  'illness-recovery': 'Hastalık/ağrı toparlanması',
  'not-completed': 'Ana görev tamamlanmadı (borç yok)',
  'no-record': 'Kayıt yok',
  'today-open': 'Bugün, henüz açık',
  future: 'Gelecek gün',
};

/** Shape marker so cells are distinguishable without colour. */
export const CONTINUITY_MARKERS: Record<ContinuityKind, string> = {
  training: '▲',
  recovery: '◆',
  'illness-recovery': '✚',
  'not-completed': '·',
  'no-record': '',
  'today-open': '○',
  future: '',
};

export function continuitySummaryText(s: ContinuitySummary): string {
  const parts = [`${s.training} antrenman`, `${s.recovery} planlı toparlanma`];
  if (s.illnessRecovery > 0) parts.push(`${s.illnessRecovery} hastalık/ağrı toparlanması`);
  return `Son ${s.windowDays} gün: ${parts.join(', ')}.`;
}

/** "kg · dambıl başına" — the series identity shown on every chart. */
export function seriesUnitLabel(s: Pick<ExerciseSeries, 'unit' | 'loadConvention'>): string {
  if (s.loadConvention === 'band') return LOAD_CONVENTION_LABELS.band;
  return `${s.unit} · ${LOAD_CONVENTION_LABELS[s.loadConvention]}`;
}

export function shortDate(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function longDate(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Signed difference without judgement words, e.g. "+1,2 kg" / "−0,5 cm" / "değişim yok". */
export function signedDiff(diff: number, unit: string): string {
  const r = Math.round(diff * 100) / 100;
  if (r === 0) return 'değişim yok';
  return `${r > 0 ? '+' : '−'}${fmtLoad(Math.abs(r))} ${unit}`;
}
