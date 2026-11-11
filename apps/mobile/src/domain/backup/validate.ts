/**
 * Full validation of backup data BEFORE anything is written (docs/DATA_MODEL.md
 * "Export/import/delete"). Pure and deterministic. Two phases:
 *  1. shape: every table and record has exactly the known fields, with valid
 *     types, enums, ranges, ISO timestamps and calendar dates; XP in the
 *     ledger equals the economy formula.
 *  2. integrity (only when the shape is valid): unique ids and keys per table
 *     and every relationship (slots/check-ins -> task days, ledger -> profile
 *     and its day/week scope, sessions -> day + plan, sets -> sessions, ...).
 * Errors carry a Turkish message; only the first MAX_REPORTED_ISSUES are kept.
 */
import type { BackupData, MeasurementType, MeasurementUnit } from '@/data/types';
import { awardedXp, isMultiplierHalves, XP } from '@/domain/game/economy';
import { SLOT_KEYS, validateHabitKeys } from '@/domain/game/quests';
import { isValidTimeZone } from '@/domain/game/task-day';
import { cycleWeekEnd, cycleWeekStart, WEEKLY_REVIEW_SLOT } from '@/domain/game/weekly-cycle';
import { MEASUREMENT_RANGES, UNITS_FOR_TYPE } from '@/domain/progress/measurements';
import { isValidReminderTime, MAX_REMINDER_TIMES } from '@/domain/reminders/plan';
import { exerciseById, INCREMENT_KEYS } from '@/domain/training/catalog';
import { EQUIPMENT, validateTrainingProfile, type TrainingProfileInput } from '@/domain/training/profile';
import { LIMITS, ProgramError, validateProgram, type Program } from '@/domain/training/program';
import { validateIncrement } from '@/domain/training/progression';
import { validateCheckin, type CheckinInput } from '@/domain/training/readiness';
import { REST_LIMITS } from '@/domain/training/rest';
import { scheduleSlotId, weekStartOf } from '@/domain/training/schedule';
import { validateSet, type SetInput } from '@/domain/training/workout';

export type BackupIssueCode =
  | 'too-large'
  | 'not-json'
  | 'unknown-format'
  | 'future-version'
  | 'bad-version'
  | 'envelope'
  | 'checksum'
  | 'structure'
  | 'value'
  | 'duplicate'
  | 'reference'
  | 'clock';

export interface BackupIssue {
  code: BackupIssueCode;
  /** Technical location, e.g. `sets[3].sessionId` (empty for file-level issues). */
  path: string;
  /** Turkish, user-facing. */
  message: string;
}

export const MAX_REPORTED_ISSUES = 20;

export type DataValidation =
  | { ok: true; data: BackupData }
  | { ok: false; errors: BackupIssue[]; totalErrors: number };

export class IssueList {
  readonly issues: BackupIssue[] = [];
  total = 0;
  add(code: BackupIssueCode, path: string, message: string) {
    this.total += 1;
    if (this.issues.length < MAX_REPORTED_ISSUES) this.issues.push({ code, path, message });
  }
}

// ---------- primitive checks ----------

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,3})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/;

export function isCalendarDate(v: unknown): v is string {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10) === v;
}

export function isIsoTimestamp(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = ISO_RE.exec(v);
  return !!m && isCalendarDate(m[1]) && Number.isFinite(Date.parse(v));
}

const ID_MAX = 200;
function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) < 0x20) return true;
  return false;
}
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= ID_MAX && !hasControlChar(v);
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isNum = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

/** Field-level checker bound to one record. Reports a Turkish message per bad field. */
class Fields {
  constructor(
    private readonly out: IssueList,
    readonly rec: Rec,
    readonly path: string,
  ) {}
  private bad(key: string, what: string) {
    const v = this.rec[key];
    this.out.add('value', `${this.path}.${key}`, v === undefined ? `${this.path}.${key}: alan eksik.` : `${this.path}.${key}: ${what}.`);
    return false;
  }
  id(key: string) {
    return isId(this.rec[key]) || this.bad(key, 'geçerli bir kimlik olmalı');
  }
  optId(key: string) {
    return this.rec[key] === null || this.id(key);
  }
  text(key: string, max: number, allowEmpty = true) {
    const v = this.rec[key];
    return (typeof v === 'string' && v.length <= max && (allowEmpty || v.length > 0)) || this.bad(key, `en fazla ${max} karakterlik metin olmalı`);
  }
  int(key: string, min: number, max: number) {
    return isInt(this.rec[key], min, max) || this.bad(key, `${min} ile ${max} arasında tam sayı olmalı`);
  }
  optInt(key: string, min: number, max: number) {
    return this.rec[key] === null || this.int(key, min, max);
  }
  num(key: string, min: number, max: number) {
    return isNum(this.rec[key], min, max) || this.bad(key, `${min} ile ${max} arasında sayı olmalı`);
  }
  bool(key: string) {
    return typeof this.rec[key] === 'boolean' || this.bad(key, 'doğru/yanlış (true/false) olmalı');
  }
  iso(key: string) {
    return isIsoTimestamp(this.rec[key]) || this.bad(key, 'geçerli bir ISO 8601 zaman damgası olmalı');
  }
  optIso(key: string) {
    return this.rec[key] === null || this.iso(key);
  }
  date(key: string) {
    return isCalendarDate(this.rec[key]) || this.bad(key, 'YYYY-AA-GG biçiminde geçerli bir tarih olmalı');
  }
  oneOf(key: string, list: readonly string[]) {
    return oneOf(list, this.rec[key]) || this.bad(key, `şu değerlerden biri olmalı: ${list.join(', ')}`);
  }
  optOneOf(key: string, list: readonly string[]) {
    return this.rec[key] === null || this.oneOf(key, list);
  }
  timeZone(key: string) {
    const v = this.rec[key];
    return (typeof v === 'string' && v.length <= 100 && isValidTimeZone(v)) || this.bad(key, 'geçerli bir IANA saat dilimi olmalı');
  }
  multiplier(key: string) {
    return isMultiplierHalves(this.rec[key]) || this.bad(key, 'XP çarpanı 1, 2, 3 veya 4 (yarım birim) olmalı');
  }
  stringArray(key: string, maxItems: number) {
    const v = this.rec[key];
    return (Array.isArray(v) && v.length <= maxItems && v.every(isId)) || this.bad(key, 'kimlik listesi olmalı');
  }
  rule(ok: boolean, key: string, message: string) {
    if (!ok) this.out.add('value', `${this.path}.${key}`, `${this.path}.${key}: ${message}.`);
    return ok;
  }
}

/** Object with exactly the allowed keys (required ones are reported by the field checks). */
function record(out: IssueList, v: unknown, path: string, keys: readonly string[], optional: readonly string[] = []): Fields | null {
  if (!isRec(v)) {
    out.add('structure', path, `${path}: kayıt bir nesne olmalı.`);
    return null;
  }
  for (const k of Object.keys(v)) {
    if (!keys.includes(k) && !optional.includes(k)) out.add('structure', `${path}.${k}`, `${path}: bilinmeyen alan "${k}".`);
  }
  return new Fields(out, v, path);
}

// ---------- record shapes ----------

const KEYS = {
  data: ['profile', 'taskDays', 'slots', 'checkins', 'ledger', 'trainingProfile', 'plans', 'moves', 'sessions', 'sets',
    'weeklyCycles', 'weeklyReviews', 'proposals', 'increments', 'measurements', 'settings'],
  profile: ['id', 'timezone', 'multiplierHalves', 'habitKeys', 'createdAt', 'confirmedAt'],
  taskDay: ['id', 'sequence', 'localDate', 'timezone', 'openedAt', 'closedAt', 'multiplierHalves', 'lastSeenAt'],
  slot: ['taskDayId', 'slotKey', 'kind', 'title', 'baseXp', 'status', 'resolution', 'completedAt', 'version', 'workoutSessionId'],
  checkin: ['taskDayId', 'sleepHours', 'energy', 'fatigue', 'soreness', 'jointPain', 'illness', 'recordedAt'],
  ledger: ['id', 'profileId', 'scopeKind', 'scopeId', 'slotKey', 'baseXp', 'multiplierHalves', 'awardedXp', 'completedAt'],
  trainingProfile: ['profileId', 'confirmedAt', 'goal', 'trainingDays', 'sessionMinutes', 'equipment', 'experience',
    'limitations', 'heightCm', 'weightKg'],
  plan: ['id', 'parentId', 'sequence', 'source', 'reason', 'createdAt', 'acceptedAt', 'program', 'proposalId'],
  move: ['slotId', 'weekStart', 'toDate', 'movedAt'],
  session: ['id', 'taskDayId', 'scheduleSlotId', 'planVersionId', 'programDayId', 'title', 'exercises', 'startedAt',
    'finishedAt', 'status', 'version', 'restStartedAt', 'restDurationS', 'restLastSeenAt', 'restUncertain'],
  prescribed: ['exerciseId', 'sets', 'repMin', 'repMax', 'targetRir'],
  set: ['id', 'sessionId', 'exerciseId', 'kind', 'position', 'reps', 'load', 'unit', 'loadConvention', 'rir', 'loggedAt', 'updatedAt'],
  cycle: ['id', 'sequence', 'weekStart', 'weekEnd', 'timezone', 'openedAt', 'closedAt', 'multiplierHalves'],
  review: ['weeklyCycleId', 'completedAt', 'summary', 'proposalIds'],
  summary: ['planned', 'done', 'missed', 'workSets', 'checkins', 'recoveryDays'],
  proposal: ['id', 'weeklyCycleId', 'exerciseId', 'planVersionId', 'evidenceKey', 'evidenceSessionIds', 'before', 'after',
    'increment', 'percentHundredths', 'status', 'createdAt', 'decidedAt', 'resultPlanVersionId'],
  prescription: ['load', 'unit', 'convention', 'sets', 'repMin', 'repMax'],
  increment: ['key', 'unit', 'value'],
  equipmentIncrement: ['key', 'unit', 'value', 'confirmedAt'],
  measurement: ['id', 'type', 'value', 'unit', 'measuredOn', 'recordedAt', 'deletedAt'],
  settings: ['speechEnabled', 'reminders'],
  reminders: ['enabled', 'times'],
} as const;

const SLOT_KINDS = ['checkin', 'core', 'habit'] as const;
const RESOLUTIONS = ['training', 'recovery', 'illness-recovery'] as const;
const UNITS = ['kg', 'lb'] as const;
const CONVENTIONS = ['total', 'per-dumbbell', 'bodyweight', 'band'] as const;
const SESSION_STATUS = ['in-progress', 'finished', 'abandoned'] as const;
const PROPOSAL_STATUS = ['pending', 'accepted', 'declined', 'stale'] as const;
const MEASUREMENT_TYPES = ['body-weight', 'waist', 'chest', 'hip', 'arm', 'thigh'] as const;
const MEASUREMENT_UNITS = ['kg', 'lb', 'cm', 'in'] as const;
const TEXT_MAX = 200;
const REASON_MAX = 100_000;
/** Structure-only program check: every catalog exercise counts as available. */
const ANY_EQUIPMENT = { equipment: [...EQUIPMENT], limitations: [] };

function checkProfile(out: IssueList, v: unknown) {
  if (v === null) return;
  const f = record(out, v, 'profile', KEYS.profile);
  if (!f) return;
  f.id('id');
  f.timeZone('timezone');
  f.multiplier('multiplierHalves');
  let habitsOk = false;
  try {
    const h = f.rec.habitKeys;
    habitsOk = Array.isArray(h) && h.length === 2 && validateHabitKeys(h as string[]).length === 2;
  } catch {
    habitsOk = false;
  }
  f.rule(habitsOk, 'habitKeys', 'katalogdaki iki farklı alışkanlık olmalı');
  f.iso('createdAt');
  f.iso('confirmedAt');
}

function checkTaskDay(out: IssueList, v: unknown, path: string) {
  const f = record(out, v, path, KEYS.taskDay);
  if (!f) return;
  f.id('id');
  f.int('sequence', 1, 10_000_000);
  f.date('localDate');
  f.timeZone('timezone');
  f.iso('openedAt');
  f.optIso('closedAt');
  f.multiplier('multiplierHalves');
  f.iso('lastSeenAt');
}

function checkSlot(out: IssueList, v: unknown, path: string) {
  const f = record(out, v, path, KEYS.slot);
  if (!f) return;
  const r = f.rec;
  f.id('taskDayId');
  f.id('slotKey');
  f.oneOf('kind', SLOT_KINDS);
  f.text('title', TEXT_MAX);
  f.int('baseXp', 0, 10_000);
  f.oneOf('status', ['open', 'completed']);
  f.optOneOf('resolution', RESOLUTIONS);
  f.optIso('completedAt');
  f.int('version', 1, 1_000_000);
  f.optId('workoutSessionId');
  if (r.status === 'open') {
    f.rule(r.completedAt === null && r.resolution === null && r.workoutSessionId === null, 'status', 'açık görevde tamamlanma bilgisi olamaz');
  }
  if (r.status === 'completed') f.rule(r.completedAt !== null, 'completedAt', 'tamamlanan görevin zamanı olmalı');
  if (r.kind !== 'core') {
    f.rule(r.resolution === null && r.workoutSessionId === null, 'resolution', 'yalnızca ana görevin çözüm türü ve antrenmanı olabilir');
  }
}

function checkCheckin(out: IssueList, v: unknown, path: string) {
  const f = record(out, v, path, KEYS.checkin);
  if (!f) return;
  const r = f.rec;
  f.id('taskDayId');
  f.iso('recordedAt');
  try {
    validateCheckin({
      sleepHours: r.sleepHours,
      energy: r.energy,
      fatigue: r.fatigue,
      soreness: r.soreness,
      jointPain: r.jointPain,
      illness: r.illness,
    } as CheckinInput);
    f.rule(r.sleepHours === null || typeof r.sleepHours === 'number', 'sleepHours', 'sayı veya boş olmalı');
  } catch {
    out.add('value', path, `${path}: günlük kontrol değerleri geçersiz (enerji 1–5, yorgunluk 1–5, kas ağrısı 0–3, uyku 0–24 saat).`);
  }
}

function checkLedger(out: IssueList, v: unknown, path: string) {
  const f = record(out, v, path, KEYS.ledger);
  if (!f) return;
  const r = f.rec;
  f.id('id');
  f.id('profileId');
  f.oneOf('scopeKind', ['day', 'week']);
  f.id('scopeId');
  f.id('slotKey');
  const baseOk = f.int('baseXp', 0, 10_000);
  const multOk = f.multiplier('multiplierHalves');
  const awardOk = f.int('awardedXp', 0, 1_000_000);
  f.iso('completedAt');
  if (baseOk && multOk && awardOk) {
    const expected = awardedXp(r.baseXp as number, r.multiplierHalves as 1 | 2 | 3 | 4);
    f.rule(r.awardedXp === expected, 'awardedXp', `kazanılan XP, taban XP ve çarpandan hesaplanan değerle (${expected}) uyuşmuyor`);
  }
}

function checkTrainingProfile(out: IssueList, v: unknown) {
  if (v === null) return;
  const f = record(out, v, 'trainingProfile', KEYS.trainingProfile);
  if (!f) return;
  f.id('profileId');
  f.iso('confirmedAt');
  try {
    validateTrainingProfile(f.rec as unknown as TrainingProfileInput);
  } catch (e) {
    const field = e instanceof Error && 'field' in e ? String((e as { field: unknown }).field) : 'facts';
    out.add('value', `trainingProfile.${field}`, `trainingProfile: antrenman profili geçersiz (${field}).`);
  }
}

function checkProgramShape(out: IssueList, program: unknown, path: string) {
  if (!isRec(program)) {
    out.add('structure', path, `${path}: program bir nesne olmalı.`);
    return;
  }
  for (const k of Object.keys(program)) if (k !== 'days') out.add('structure', `${path}.${k}`, `${path}: bilinmeyen alan "${k}".`);
  const days = program.days;
  if (Array.isArray(days)) {
    days.forEach((d, i) => {
      const df = record(out, d, `${path}.days[${i}]`, ['id', 'title', 'weekday', 'exercises']);
      if (df && Array.isArray(df.rec.exercises)) {
        df.rec.exercises.forEach((e, j) => {
          const ef = record(out, e, `${path}.days[${i}].exercises[${j}]`, KEYS.prescribed, ['targetLoad']);
          if (ef && ef.rec.targetLoad !== undefined && ef.rec.targetLoad !== null) {
            record(out, ef.rec.targetLoad, `${path}.days[${i}].exercises[${j}].targetLoad`, ['value', 'unit']);
          }
        });
      }
    });
  }
  try {
    validateProgram(program as unknown as Program, ANY_EQUIPMENT);
  } catch (e) {
    const code = e instanceof ProgramError ? e.code : 'program';
    out.add('value', path, `${path}: program geçersiz (${code}).`);
  }
}

function checkPlan(out: IssueList, v: unknown, path: string) {
  const f = record(out, v, path, KEYS.plan);
  if (!f) return;
  f.id('id');
  f.optId('parentId');
  f.int('sequence', 1, 10_000_000);
  f.oneOf('source', ['generated', 'user-edit']);
  f.text('reason', REASON_MAX);
  f.iso('createdAt');
  f.iso('acceptedAt');
  f.optId('proposalId');
  checkProgramShape(out, f.rec.program, `${path}.program`);
}

function checkMove(out: IssueList, v: unknown, path: string) {
  const f = record(out, v, path, KEYS.move);
  if (!f) return;
  const r = f.rec;
  const slotOk = f.id('slotId');
  const weekOk = f.date('weekStart');
  const toOk = f.date('toDate');
  f.iso('movedAt');
  if (weekOk) f.rule(cycleWeekStart(r.weekStart as string) === r.weekStart, 'weekStart', 'haftanın pazartesi günü olmalı');
  if (slotOk && weekOk) f.rule((r.slotId as string).startsWith(`${r.weekStart as string}:`), 'slotId', 'haftasıyla uyuşmuyor');
  if (weekOk && toOk) {
    const ws = r.weekStart as string;
    f.rule((r.toDate as string) >= ws && (r.toDate as string) <= cycleWeekEnd(ws), 'toDate', 'aynı haftanın içinde olmalı');
  }
}

function checkPrescribed(out: IssueList, v: unknown, path: string) {
  const f = record(out, v, path, KEYS.prescribed, ['targetLoad']);
  if (!f) return;
  const r = f.rec;
  f.rule(typeof r.exerciseId === 'string' && exerciseById(r.exerciseId) !== undefined, 'exerciseId', 'katalogda olmayan hareket');
  f.int('sets', LIMITS.setsMin, LIMITS.setsMax);
  const minOk = f.int('repMin', LIMITS.repsMin, LIMITS.repsMax);
  const maxOk = f.int('repMax', LIMITS.repsMin, LIMITS.repsMax);
  if (minOk && maxOk) f.rule((r.repMin as number) <= (r.repMax as number), 'repMax', 'en az tekrar sayısından küçük olamaz');
  f.optInt('targetRir', 0, LIMITS.rirMax);
  if (r.targetLoad !== undefined && r.targetLoad !== null) {
    const t = record(out, r.targetLoad, `${path}.targetLoad`, ['value', 'unit']);
    if (t) {
      t.num('value', 0, LIMITS.loadMax);
      t.oneOf('unit', UNITS);
    }
  }
}

function checkSession(out: IssueList, v: unknown, path: string) {
  const f = record(out, v, path, KEYS.session);
  if (!f) return;
  const r = f.rec;
  f.id('id');
  f.id('taskDayId');
  f.optId('scheduleSlotId');
  f.id('planVersionId');
  f.id('programDayId');
  f.text('title', TEXT_MAX);
  if (Array.isArray(r.exercises) && r.exercises.length >= 1 && r.exercises.length <= LIMITS.exercisesPerDayMax) {
    r.exercises.forEach((e, i) => checkPrescribed(out, e, `${path}.exercises[${i}]`));
  } else {
    f.rule(false, 'exercises', `1–${LIMITS.exercisesPerDayMax} hareketlik bir liste olmalı`);
  }
  f.iso('startedAt');
  f.optIso('finishedAt');
  f.oneOf('status', SESSION_STATUS);
  f.int('version', 1, 1_000_000);
  f.optIso('restStartedAt');
  f.optInt('restDurationS', REST_LIMITS.minS, REST_LIMITS.maxS);
  f.optIso('restLastSeenAt');
  f.bool('restUncertain');
  f.rule((r.restStartedAt === null) === (r.restDurationS === null), 'restDurationS', 'dinlenme başlangıcı ve süresi birlikte olmalı');
  if (r.status === 'in-progress') f.rule(r.finishedAt === null, 'finishedAt', 'süren antrenmanın bitiş zamanı olamaz');
  if (r.status === 'finished' || r.status === 'abandoned') f.rule(r.finishedAt !== null, 'finishedAt', 'biten antrenmanın bitiş zamanı olmalı');
}

function checkSet(out: IssueList, v: unknown, path: string) {
  const f = record(out, v, path, KEYS.set);
  if (!f) return;
  const r = f.rec;
  f.id('id');
  f.id('sessionId');
  f.id('exerciseId');
  f.int('position', 0, 100_000);
  f.oneOf('loadConvention', CONVENTIONS);
  f.iso('loggedAt');
  f.iso('updatedAt');
  let valid = false;
  try {
    const s = validateSet({
      exerciseId: r.exerciseId,
      kind: r.kind,
      reps: r.reps,
      load: r.load,
      unit: r.unit,
      rir: r.rir,
    } as SetInput);
    valid = s.load === r.load && (r.rir === null || typeof r.rir === 'number');
  } catch {
    valid = false;
  }
  if (!valid) {
    out.add('value', path, `${path}: set değerleri geçersiz (tekrar 0–100, ağırlık 0–1000 ve en fazla iki ondalık, RIR 0–10 veya boş).`);
  }
  if (r.loadConvention === 'band') f.rule(r.load === 0, 'load', 'bant hareketlerinde ağırlık kaydedilmez (0 olmalı)');
}

function checkCycle(out: IssueList, v: unknown, path: string) {
  const f = record(out, v, path, KEYS.cycle);
  if (!f) return;
  const r = f.rec;
  f.id('id');
  f.int('sequence', 1, 10_000_000);
  const ws = f.date('weekStart');
  const we = f.date('weekEnd');
  f.timeZone('timezone');
  f.iso('openedAt');
  f.optIso('closedAt');
  f.multiplier('multiplierHalves');
  if (ws) f.rule(cycleWeekStart(r.weekStart as string) === r.weekStart, 'weekStart', 'haftanın pazartesi günü olmalı');
  if (ws && we) f.rule(cycleWeekEnd(r.weekStart as string) === r.weekEnd, 'weekEnd', 'hafta başlangıcından 6 gün sonra olmalı');
}

function checkReview(out: IssueList, v: unknown, path: string) {
  const f = record(out, v, path, KEYS.review);
  if (!f) return;
  f.id('weeklyCycleId');
  f.iso('completedAt');
  f.stringArray('proposalIds', 1000);
  const s = record(out, f.rec.summary, `${path}.summary`, KEYS.summary);
  if (s) for (const k of KEYS.summary) s.int(k, 0, 1_000_000);
}

function checkLoadPrescription(out: IssueList, v: unknown, path: string) {
  const f = record(out, v, path, KEYS.prescription);
  if (!f) return;
  f.num('load', 0, LIMITS.loadMax);
  f.oneOf('unit', UNITS);
  f.oneOf('convention', CONVENTIONS);
  f.int('sets', LIMITS.setsMin, LIMITS.setsMax);
  f.int('repMin', LIMITS.repsMin, LIMITS.repsMax);
  f.int('repMax', LIMITS.repsMin, LIMITS.repsMax);
}

function incrementValueOk(v: unknown): boolean {
  try {
    return validateIncrement(v as number) === v;
  } catch {
    return false;
  }
}

function checkProposal(out: IssueList, v: unknown, path: string) {
  const f = record(out, v, path, KEYS.proposal);
  if (!f) return;
  const r = f.rec;
  f.id('id');
  f.id('weeklyCycleId');
  f.id('exerciseId');
  f.id('planVersionId');
  f.text('evidenceKey', 1000, false);
  f.stringArray('evidenceSessionIds', 100);
  checkLoadPrescription(out, r.before, `${path}.before`);
  checkLoadPrescription(out, r.after, `${path}.after`);
  const inc = record(out, r.increment, `${path}.increment`, KEYS.increment);
  if (inc) {
    inc.oneOf('key', INCREMENT_KEYS);
    inc.oneOf('unit', UNITS);
    inc.rule(incrementValueOk(inc.rec.value), 'value', '0’dan büyük, en fazla 50 olmalı');
  }
  f.int('percentHundredths', 0, 1_000_000);
  f.oneOf('status', PROPOSAL_STATUS);
  f.iso('createdAt');
  f.optIso('decidedAt');
  f.optId('resultPlanVersionId');
  if (r.status === 'pending') {
    f.rule(r.decidedAt === null && r.resultPlanVersionId === null, 'status', 'bekleyen önerinin karar bilgisi olamaz');
  } else if (oneOf(PROPOSAL_STATUS, r.status)) {
    f.rule(r.decidedAt !== null, 'decidedAt', 'karar verilen önerinin karar zamanı olmalı');
    f.rule((r.status === 'accepted') === (r.resultPlanVersionId !== null), 'resultPlanVersionId', 'yalnızca kabul edilen önerinin sonuç planı olur');
  }
}

function checkIncrement(out: IssueList, v: unknown, path: string) {
  const f = record(out, v, path, KEYS.equipmentIncrement);
  if (!f) return;
  f.oneOf('key', INCREMENT_KEYS);
  f.oneOf('unit', UNITS);
  f.rule(incrementValueOk(f.rec.value), 'value', '0’dan büyük, en fazla 50 olmalı');
  f.iso('confirmedAt');
}

function checkMeasurement(out: IssueList, v: unknown, path: string) {
  const f = record(out, v, path, KEYS.measurement);
  if (!f) return;
  const r = f.rec;
  f.id('id');
  const typeOk = f.oneOf('type', MEASUREMENT_TYPES);
  const unitOk = f.oneOf('unit', MEASUREMENT_UNITS);
  f.date('measuredOn');
  f.iso('recordedAt');
  f.optIso('deletedAt');
  if (typeOk && unitOk) {
    const unit = r.unit as MeasurementUnit;
    if (f.rule(UNITS_FOR_TYPE[r.type as MeasurementType].includes(unit), 'unit', 'ölçüm türüyle uyumlu olmalı')) {
      const range = MEASUREMENT_RANGES[unit];
      f.num('value', range.min, range.max);
    }
  }
}

function checkSettings(out: IssueList, v: unknown) {
  const f = record(out, v, 'settings', KEYS.settings);
  if (!f) return;
  f.bool('speechEnabled');
  const rem = record(out, f.rec.reminders, 'settings.reminders', KEYS.reminders);
  if (!rem) return;
  rem.bool('enabled');
  const t = rem.rec.times;
  rem.rule(
    Array.isArray(t) &&
      t.length <= MAX_REMINDER_TIMES &&
      t.every((x) => typeof x === 'string' && isValidReminderTime(x)) &&
      new Set(t).size === t.length,
    'times',
    `en fazla ${MAX_REMINDER_TIMES} farklı SS:DD saati olmalı`,
  );
}

function table(out: IssueList, data: Rec, key: string, check: (out: IssueList, v: unknown, path: string) => void) {
  const v = data[key];
  if (!Array.isArray(v)) {
    out.add('structure', key, `${key}: liste olmalı.`);
    return;
  }
  v.forEach((x, i) => check(out, x, `${key}[${i}]`));
}

// ---------- phase 2: uniqueness and relationships ----------

function unique<T>(out: IssueList, rows: readonly T[], name: string, keyOf: (r: T) => string, label: string) {
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const k = keyOf(r);
    if (seen.has(k)) out.add('duplicate', `${name}[${i}]`, `${name}[${i}]: aynı ${label} birden fazla kez var.`);
    seen.add(k);
  });
}

function checkIntegrity(out: IssueList, d: BackupData) {
  unique(out, d.taskDays, 'taskDays', (x) => x.id, 'kimlik');
  unique(out, d.taskDays, 'taskDays', (x) => String(x.sequence), 'sıra numarası');
  unique(out, d.taskDays, 'taskDays', (x) => x.localDate, 'görev günü tarihi');
  unique(out, d.slots, 'slots', (x) => `${x.taskDayId}|${x.slotKey}`, 'görev (gün + görev anahtarı)');
  unique(out, d.checkins, 'checkins', (x) => x.taskDayId, 'günlük kontrol (aynı gün)');
  unique(out, d.ledger, 'ledger', (x) => x.id, 'kimlik');
  unique(out, d.ledger, 'ledger', (x) => `${x.profileId}|${x.scopeKind}|${x.scopeId}|${x.slotKey}`, 'ödül anahtarı (aynı görev için ikinci XP)');
  unique(out, d.plans, 'plans', (x) => x.id, 'kimlik');
  unique(out, d.plans, 'plans', (x) => String(x.sequence), 'sıra numarası');
  unique(out, d.moves, 'moves', (x) => x.slotId, 'program günü taşıması');
  unique(out, d.sessions, 'sessions', (x) => x.id, 'kimlik');
  unique(out, d.sets, 'sets', (x) => x.id, 'kimlik');
  unique(out, d.weeklyCycles, 'weeklyCycles', (x) => x.id, 'kimlik');
  unique(out, d.weeklyCycles, 'weeklyCycles', (x) => String(x.sequence), 'sıra numarası');
  unique(out, d.weeklyCycles, 'weeklyCycles', (x) => x.weekStart, 'hafta');
  unique(out, d.weeklyReviews, 'weeklyReviews', (x) => x.weeklyCycleId, 'haftalık değerlendirme (aynı hafta)');
  unique(out, d.proposals, 'proposals', (x) => x.id, 'kimlik');
  unique(out, d.proposals, 'proposals', (x) => `${x.weeklyCycleId}|${x.exerciseId}|${x.evidenceKey}`, 'öneri (hafta + hareket + kanıt)');
  unique(out, d.increments, 'increments', (x) => `${x.key}|${x.unit}`, 'ekipman artışı');
  unique(out, d.measurements, 'measurements', (x) => x.id, 'kimlik');
  const active = d.sessions.filter((s) => s.status === 'in-progress');
  if (active.length > 1) out.add('duplicate', 'sessions', 'sessions: aynı anda en fazla bir antrenman sürebilir.');
  unique(
    out,
    d.sessions.filter((s) => s.status === 'finished' && s.scheduleSlotId !== null),
    'sessions',
    (x) => x.scheduleSlotId!,
    'tamamlanmış program günü',
  );

  const ref = (path: string, message: string) => out.add('reference', path, `${path}: ${message}.`);

  // The app treats the highest sequence as "the latest day/week". A later
  // sequence with an earlier date would make it re-open a date that already
  // exists, and the app could no longer start.
  const ordered = <T extends { sequence: number }>(rows: readonly T[], path: string, date: (x: T) => string, label: string) => {
    const sorted = rows.map((x, i) => ({ x, i })).sort((a, b) => a.x.sequence - b.x.sequence);
    for (let k = 1; k < sorted.length; k++) {
      if (date(sorted[k].x) <= date(sorted[k - 1].x)) {
        ref(`${path}[${sorted[k].i}].sequence`, `sıra numarası ilerlerken ${label} geriye gidiyor`);
      }
    }
  };
  ordered(d.taskDays, 'taskDays', (x) => x.localDate, 'görev günü tarihi');
  ordered(d.weeklyCycles, 'weeklyCycles', (x) => x.weekStart, 'hafta başlangıcı');
  // A week is opened from a task day, so no week can start after the latest day.
  // If one did, the app would keep that week for good ("keep-latest").
  const lastDate = d.taskDays.reduce((m, x) => (x.localDate > m ? x.localDate : m), '');
  d.weeklyCycles.forEach((c, i) => {
    if (c.weekStart > lastDate) ref(`weeklyCycles[${i}].weekStart`, 'hafta, kayıtlı son görev gününden sonra başlıyor');
  });

  const days = new Map(d.taskDays.map((x) => [x.id, x]));
  const slots = new Map(d.slots.map((x) => [`${x.taskDayId}|${x.slotKey}`, x]));
  const sessions = new Map(d.sessions.map((x) => [x.id, x]));
  const plans = new Map(d.plans.map((x) => [x.id, x]));
  const cycles = new Map(d.weeklyCycles.map((x) => [x.id, x]));
  const reviews = new Set(d.weeklyReviews.map((x) => x.weeklyCycleId));
  const proposals = new Map(d.proposals.map((x) => [x.id, x]));
  const profileId = d.profile?.id ?? null;

  if (d.trainingProfile && d.trainingProfile.profileId !== profileId) {
    ref('trainingProfile.profileId', 'profille eşleşmiyor');
  }
  d.slots.forEach((s, i) => {
    if (!days.has(s.taskDayId)) ref(`slots[${i}].taskDayId`, 'kayıtlı olmayan bir göreve günü bağlı');
    if (s.workoutSessionId !== null && !sessions.has(s.workoutSessionId)) ref(`slots[${i}].workoutSessionId`, 'kayıtlı olmayan bir antrenmana bağlı');
  });
  d.checkins.forEach((c, i) => {
    if (!days.has(c.taskDayId)) ref(`checkins[${i}].taskDayId`, 'kayıtlı olmayan bir görev gününe bağlı');
  });
  d.ledger.forEach((e, i) => {
    const p = `ledger[${i}]`;
    if (e.profileId !== profileId) ref(`${p}.profileId`, 'profille eşleşmiyor');
    if (e.scopeKind === 'day') {
      const day = days.get(e.scopeId);
      const slot = slots.get(`${e.scopeId}|${e.slotKey}`);
      if (!day) ref(`${p}.scopeId`, 'kayıtlı olmayan bir görev gününe ait');
      else if (day.multiplierHalves !== e.multiplierHalves) ref(`${p}.multiplierHalves`, 'görev gününün çarpanıyla uyuşmuyor');
      if (day && !slot) ref(`${p}.slotKey`, 'o günde böyle bir görev yok');
      if (slot && slot.status !== 'completed') ref(`${p}.slotKey`, 'görev tamamlanmamış ama XP verilmiş');
      if (slot && slot.baseXp !== e.baseXp) ref(`${p}.baseXp`, 'görevin taban XP değeriyle uyuşmuyor');
    } else {
      const cycle = cycles.get(e.scopeId);
      if (!cycle) ref(`${p}.scopeId`, 'kayıtlı olmayan bir haftaya ait');
      else if (cycle.multiplierHalves !== e.multiplierHalves) ref(`${p}.multiplierHalves`, 'haftanın çarpanıyla uyuşmuyor');
      if (e.slotKey !== WEEKLY_REVIEW_SLOT) ref(`${p}.slotKey`, 'haftalık ödül yalnızca haftalık değerlendirme için verilir');
      if (e.baseXp !== XP.weeklyReview) ref(`${p}.baseXp`, `haftalık değerlendirmenin taban XP değeri ${XP.weeklyReview} olmalı`);
      if (cycle && !reviews.has(cycle.id)) ref(`${p}.scopeId`, 'haftalık değerlendirme yapılmamış ama XP verilmiş');
    }
  });
  // ---- Both directions: a record that implies another one must come with it. ----
  // Nothing is repaired or guessed here: an inconsistent file is rejected as a whole.
  if (profileId === null) {
    for (const [name, rows] of [['taskDays', d.taskDays], ['plans', d.plans], ['weeklyCycles', d.weeklyCycles], ['sessions', d.sessions]] as const) {
      if (rows.length > 0) ref(name, 'profil yokken kayıt içeriyor');
    }
  }
  const dayLedger = new Set(d.ledger.filter((e) => e.scopeKind === 'day').map((e) => `${e.scopeId}|${e.slotKey}`));
  const weekLedger = new Set(d.ledger.filter((e) => e.scopeKind === 'week').map((e) => e.scopeId));
  const checkinDays = new Set(d.checkins.map((c) => c.taskDayId));
  const REQUIRED_SLOTS: readonly [string, string, number][] = [
    [SLOT_KEYS.checkin, 'checkin', XP.checkin],
    [SLOT_KEYS.core, 'core', XP.dailyCore],
    [SLOT_KEYS.habit1, 'habit', XP.habit],
    [SLOT_KEYS.habit2, 'habit', XP.habit],
  ];
  d.taskDays.forEach((day, i) => {
    for (const [key, kind, baseXp] of REQUIRED_SLOTS) {
      const slot = slots.get(`${day.id}|${key}`);
      if (!slot) {
        ref(`taskDays[${i}]`, `görev gününün zorunlu "${key}" görevi eksik`);
        continue;
      }
      if (slot.kind !== kind) ref(`taskDays[${i}]`, `"${key}" görevinin türü "${kind}" olmalı`);
      if (slot.baseXp !== baseXp) ref(`taskDays[${i}]`, `"${key}" görevinin taban XP değeri ${baseXp} olmalı`);
    }
  });
  d.slots.forEach((s, i) => {
    const p = `slots[${i}]`;
    if (!REQUIRED_SLOTS.some(([key]) => key === s.slotKey)) ref(`${p}.slotKey`, 'tanınmayan görev anahtarı');
    if (s.status === 'completed' && !dayLedger.has(`${s.taskDayId}|${s.slotKey}`)) {
      ref(p, 'görev tamamlanmış ama karşılık gelen XP kaydı yok');
    }
    if (s.slotKey === SLOT_KEYS.checkin && days.has(s.taskDayId) && (s.status === 'completed') !== checkinDays.has(s.taskDayId)) {
      ref(p, 'günlük kontrol görevi ile günlük kontrol kaydı uyuşmuyor');
    }
    if (s.slotKey === SLOT_KEYS.core) {
      if (s.status === 'completed' && s.resolution === null) ref(`${p}.resolution`, 'tamamlanan ana görevin çözüm türü olmalı');
      const linked = s.workoutSessionId === null ? undefined : sessions.get(s.workoutSessionId);
      if (linked) {
        if (linked.taskDayId !== s.taskDayId) ref(`${p}.workoutSessionId`, 'başka bir görev gününün antrenmanına bağlı');
        if (linked.status !== 'finished') ref(`${p}.workoutSessionId`, 'bitmemiş bir antrenmana bağlı');
        if (s.resolution !== 'training') ref(`${p}.resolution`, 'antrenmana bağlı ana görevin çözüm türü antrenman olmalı');
      }
    }
  });
  d.weeklyReviews.forEach((r, i) => {
    if (cycles.has(r.weeklyCycleId) && !weekLedger.has(r.weeklyCycleId)) {
      ref(`weeklyReviews[${i}]`, 'haftalık değerlendirme yapılmış ama karşılık gelen XP kaydı yok');
    }
  });
  const coreSessions = new Map<string, number>();
  d.slots.forEach((s) => {
    if (s.workoutSessionId !== null) coreSessions.set(s.workoutSessionId, (coreSessions.get(s.workoutSessionId) ?? 0) + 1);
  });
  for (const [id, n] of coreSessions) if (n > 1) ref('slots', `aynı antrenman (${id}) birden fazla göreve bağlı`);
  d.sessions.forEach((s, i) => {
    const day = days.get(s.taskDayId);
    if (day && s.scheduleSlotId !== null && s.scheduleSlotId !== scheduleSlotId(weekStartOf(day.localDate), s.programDayId)) {
      ref(`sessions[${i}].scheduleSlotId`, 'antrenmanın görev gününün haftasına veya program gününe ait değil');
    }
  });

  d.plans.forEach((pl, i) => {
    if (pl.parentId !== null) {
      const parent = plans.get(pl.parentId);
      if (!parent) ref(`plans[${i}].parentId`, 'kayıtlı olmayan bir plan sürümüne bağlı');
      else if (parent.sequence >= pl.sequence) ref(`plans[${i}].parentId`, 'üst sürüm bu sürümden önce gelmeli');
    }
    if (pl.proposalId !== null) {
      const proposal = proposals.get(pl.proposalId);
      if (!proposal) ref(`plans[${i}].proposalId`, 'kayıtlı olmayan bir öneriye bağlı');
      else if (proposal.status !== 'accepted' || proposal.resultPlanVersionId !== pl.id) {
        ref(`plans[${i}].proposalId`, 'öneri bu planı oluşturan kabul kararıyla eşleşmiyor');
      }
    }
  });
  d.sessions.forEach((s, i) => {
    if (!days.has(s.taskDayId)) ref(`sessions[${i}].taskDayId`, 'kayıtlı olmayan bir görev gününe bağlı');
    if (!plans.has(s.planVersionId)) ref(`sessions[${i}].planVersionId`, 'kayıtlı olmayan bir plan sürümüne bağlı');
  });
  d.sets.forEach((st, i) => {
    const s = sessions.get(st.sessionId);
    if (!s) ref(`sets[${i}].sessionId`, 'kayıtlı olmayan bir antrenmana bağlı');
    else if (!s.exercises.some((e) => e.exerciseId === st.exerciseId)) ref(`sets[${i}].exerciseId`, 'antrenmanda olmayan bir hareket');
  });
  d.weeklyReviews.forEach((r, i) => {
    if (!cycles.has(r.weeklyCycleId)) ref(`weeklyReviews[${i}].weeklyCycleId`, 'kayıtlı olmayan bir haftaya bağlı');
    r.proposalIds.forEach((id, j) => {
      if (!proposals.has(id)) ref(`weeklyReviews[${i}].proposalIds[${j}]`, 'kayıtlı olmayan bir öneri');
    });
  });
  d.proposals.forEach((p, i) => {
    if (!cycles.has(p.weeklyCycleId)) ref(`proposals[${i}].weeklyCycleId`, 'kayıtlı olmayan bir haftaya bağlı');
    if (!plans.has(p.planVersionId)) ref(`proposals[${i}].planVersionId`, 'kayıtlı olmayan bir plan sürümüne bağlı');
    if (p.resultPlanVersionId !== null) {
      const result = plans.get(p.resultPlanVersionId);
      if (!result) ref(`proposals[${i}].resultPlanVersionId`, 'kayıtlı olmayan bir plan sürümüne bağlı');
      // Accepted history is immutable. Later manual edits can advance the latest
      // plan, but cannot change the original result's reciprocal audit links.
      else if (result.proposalId !== p.id || result.parentId !== p.planVersionId) {
        ref(`proposals[${i}].resultPlanVersionId`, 'sonuç planı öneriye ve önerinin temel planına karşılıklı bağlı olmalı');
      }
    }
    p.evidenceSessionIds.forEach((id, j) => {
      if (!sessions.has(id)) ref(`proposals[${i}].evidenceSessionIds[${j}]`, 'kayıtlı olmayan bir antrenman');
    });
  });
}

/** Validates an untrusted value as BackupData. Never mutates the input. */
export function validateBackupData(input: unknown): DataValidation {
  const out = new IssueList();
  const root = record(out, input, 'data', KEYS.data);
  if (!root) return { ok: false, errors: out.issues, totalErrors: out.total };
  const data = root.rec;
  for (const k of KEYS.data) {
    if (!(k in data)) out.add('structure', k, `${k}: tablo eksik.`);
  }
  checkProfile(out, data.profile);
  table(out, data, 'taskDays', checkTaskDay);
  table(out, data, 'slots', checkSlot);
  table(out, data, 'checkins', checkCheckin);
  table(out, data, 'ledger', checkLedger);
  checkTrainingProfile(out, data.trainingProfile);
  table(out, data, 'plans', checkPlan);
  table(out, data, 'moves', checkMove);
  table(out, data, 'sessions', checkSession);
  table(out, data, 'sets', checkSet);
  table(out, data, 'weeklyCycles', checkCycle);
  table(out, data, 'weeklyReviews', checkReview);
  table(out, data, 'proposals', checkProposal);
  table(out, data, 'increments', checkIncrement);
  table(out, data, 'measurements', checkMeasurement);
  checkSettings(out, data.settings);
  if (out.total > 0) return { ok: false, errors: out.issues, totalErrors: out.total };

  const typed = data as unknown as BackupData;
  checkIntegrity(out, typed);
  if (out.total > 0) return { ok: false, errors: out.issues, totalErrors: out.total };
  return { ok: true, data: typed };
}
