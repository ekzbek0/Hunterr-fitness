/**
 * Optional dated body measurements: validation and per type+unit trends.
 * No conversion between kg/lb or cm/in, no scores, no BMI, no judgement.
 * Ranges only reject typing mistakes; they say nothing about health.
 */
import type { Measurement, MeasurementType, MeasurementUnit } from '@/data/types';
import { parseDecimal } from '@/domain/training/workout';

export const MEASUREMENT_TYPES: readonly MeasurementType[] = ['body-weight', 'waist', 'chest', 'hip', 'arm', 'thigh'];

export const UNITS_FOR_TYPE: Record<MeasurementType, readonly MeasurementUnit[]> = {
  'body-weight': ['kg', 'lb'],
  waist: ['cm', 'in'],
  chest: ['cm', 'in'],
  hip: ['cm', 'in'],
  arm: ['cm', 'in'],
  thigh: ['cm', 'in'],
};

/** Plausible input ranges (inclusive) per unit; guards against typos only. */
export const MEASUREMENT_RANGES: Record<MeasurementUnit, { min: number; max: number }> = {
  kg: { min: 20, max: 400 },
  lb: { min: 44, max: 880 },
  cm: { min: 10, max: 300 },
  in: { min: 4, max: 120 },
};

export const EARLIEST_MEASUREMENT_DATE = '2000-01-01';

export type MeasurementError =
  | 'type'
  | 'unit'
  | 'value-missing'
  | 'value-format'
  | 'value-range'
  | 'date-format'
  | 'date-future'
  | 'date-too-old';

export interface MeasurementFormInput {
  type: MeasurementType | string;
  unit: MeasurementUnit | string;
  /** As typed by the user; a Turkish decimal comma is accepted. */
  valueText: string;
  /** YYYY-MM-DD local date. */
  measuredOn: string;
}

export interface ValidMeasurement {
  type: MeasurementType;
  unit: MeasurementUnit;
  value: number;
  measuredOn: string;
}

export type MeasurementValidation =
  | { ok: true; value: ValidMeasurement }
  | { ok: false; errors: Partial<Record<'type' | 'unit' | 'value' | 'date', MeasurementError>> };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10) === s;
}

export const isMeasurementType = (t: string): t is MeasurementType => (MEASUREMENT_TYPES as readonly string[]).includes(t);

/** `today` is the user's local date (YYYY-MM-DD). */
export function validateMeasurement(input: MeasurementFormInput, today: string): MeasurementValidation {
  const errors: Extract<MeasurementValidation, { ok: false }>['errors'] = {};
  const type = isMeasurementType(input.type) ? input.type : null;
  if (!type) errors.type = 'type';
  const unit = type && (UNITS_FOR_TYPE[type] as readonly string[]).includes(input.unit) ? (input.unit as MeasurementUnit) : null;
  if (type && !unit) errors.unit = 'unit';

  const parsed = parseDecimal(input.valueText ?? '');
  let value: number | null = null;
  if (parsed === null) errors.value = 'value-missing';
  else if (!Number.isFinite(parsed)) errors.value = 'value-format';
  else if (unit && (parsed < MEASUREMENT_RANGES[unit].min || parsed > MEASUREMENT_RANGES[unit].max)) errors.value = 'value-range';
  else value = Math.round(parsed * 100) / 100;

  const date = (input.measuredOn ?? '').trim();
  if (!isCalendarDate(date)) errors.date = 'date-format';
  else if (date > today) errors.date = 'date-future';
  else if (date < EARLIEST_MEASUREMENT_DATE) errors.date = 'date-too-old';

  if (!type || !unit || value === null || errors.date) return { ok: false, errors };
  return { ok: true, value: { type, unit, value, measuredOn: date } };
}

export interface MeasurementGroup {
  /** `${type}|${unit}` */
  key: string;
  type: MeasurementType;
  unit: MeasurementUnit;
  /** Newest first (measuredOn, then recordedAt). */
  entries: Measurement[];
  /** One value per date, oldest first: the latest entry recorded for that date. */
  trend: { date: string; value: number }[];
}

/** Groups live (non-deleted) measurements by type+unit. Never merges units. */
export function groupMeasurements(all: readonly Measurement[]): MeasurementGroup[] {
  const live = all.filter((m) => m.deletedAt === null);
  const groups = new Map<string, MeasurementGroup>();
  for (const m of live) {
    const key = `${m.type}|${m.unit}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, type: m.type, unit: m.unit, entries: [], trend: [] };
      groups.set(key, g);
    }
    g.entries.push(m);
  }
  const typeOrder = (t: MeasurementType) => MEASUREMENT_TYPES.indexOf(t);
  const out = [...groups.values()];
  for (const g of out) {
    g.entries.sort((a, b) => b.measuredOn.localeCompare(a.measuredOn) || b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id));
    const perDate = new Map<string, number>();
    // entries are newest first: the first seen per date is the latest recorded one.
    for (const e of g.entries) if (!perDate.has(e.measuredOn)) perDate.set(e.measuredOn, e.value);
    g.trend = [...perDate.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
  }
  return out.sort((a, b) => typeOrder(a.type) - typeOrder(b.type) || a.unit.localeCompare(b.unit));
}
