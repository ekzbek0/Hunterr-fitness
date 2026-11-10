/**
 * M3 local reminders, pure planning. The device asks for nothing here: given
 * the user's chosen times, the timezone and what each upcoming local day holds
 * (planned training or planned recovery), it produces the exact set of
 * reminders that SHOULD be scheduled. Reconciliation (reminder-service) then
 * cancels anything else with the AVCI prefix and schedules what is missing, so
 * a time, program, move or day change never leaves duplicates behind.
 *
 * Ids are deterministic: `avci-<date>-<HHMM>-<hash>`; the hash covers the fire
 * instant and the text, so changed content gets a new id and the old one is
 * cancelled. One date+time can never be scheduled twice.
 */
import { REMINDER_ID_PREFIX, type ScheduledReminder } from '@/platform/reminder-types';

export const MAX_REMINDER_TIMES = 3;
export const REMINDER_HORIZON_DAYS = 7;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidReminderTime(t: string): boolean {
  return TIME_RE.test(t);
}

/** Validated, unique, sorted times; throws RangeError on invalid input. */
export function normalizeReminderTimes(times: readonly string[]): string[] {
  const out = [...new Set(times)].sort();
  if (out.length > MAX_REMINDER_TIMES || out.some((t) => !isValidReminderTime(t))) throw new RangeError('reminder times');
  return out;
}

export type DayPlan =
  | { date: string; kind: 'training'; titles: string[] }
  | { date: string; kind: 'recovery' }
  /** No accepted program yet: the daily quests still exist. */
  | { date: string; kind: 'open' };

function offsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour') % 24, n('minute'), n('second'));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * UTC instant of a local wall-clock time in an IANA zone. Returns null when the
 * wall time does not exist that day (DST gap): that reminder is skipped rather
 * than fired at a surprising time.
 */
export function zonedInstant(localDate: string, hhmm: string, timeZone: string): Date | null {
  const [y, mo, d] = localDate.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wall - offsetMs(new Date(wall), timeZone);
  guess = wall - offsetMs(new Date(guess), timeZone);
  return wall - offsetMs(new Date(guess), timeZone) === guess ? new Date(guess) : null;
}

/** FNV-1a 32-bit, hex. Deterministic id suffix, not a security hash. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function reminderText(day: DayPlan): { title: string; body: string } {
  if (day.kind === 'training') {
    return {
      title: 'AVCI · Bugünün görevi',
      body: `Planlı antrenman: ${day.titles.join(', ')}. Önce kısa günlük kontrolü yap.`,
    };
  }
  if (day.kind === 'recovery') {
    return {
      title: 'AVCI · Bugünün görevi',
      body: 'Bugün planlı toparlanma günü; antrenman kadar değerli. Günlük kontrolü yap.',
    };
  }
  return { title: 'AVCI · Bugünün görevi', body: 'Günlük görevlerin hazır: kısa kontrol ve günün ana görevi.' };
}

export interface ReminderPlanInput {
  now: Date;
  timeZone: string;
  times: readonly string[];
  /** One entry per local date from today on (missing dates count as recovery). */
  days: readonly DayPlan[];
  /** Dates whose daily core is already resolved: no reminder needed. */
  resolvedDates?: readonly string[];
  horizonDays?: number;
}

export function planReminders(input: ReminderPlanInput): ScheduledReminder[] {
  const times = normalizeReminderTimes(input.times);
  const horizon = input.horizonDays ?? REMINDER_HORIZON_DAYS;
  const resolved = new Set(input.resolvedDates ?? []);
  const out: ScheduledReminder[] = [];
  for (const day of [...input.days].sort((a, b) => a.date.localeCompare(b.date)).slice(0, horizon)) {
    if (resolved.has(day.date)) continue;
    const text = reminderText(day);
    for (const t of times) {
      const at = zonedInstant(day.date, t, input.timeZone);
      if (!at || at.getTime() <= input.now.getTime()) continue;
      const fireAt = at.toISOString();
      out.push({
        id: `${REMINDER_ID_PREFIX}${day.date}-${t.replace(':', '')}-${fnv1a(`${fireAt}|${text.title}|${text.body}`)}`,
        fireAt,
        ...text,
      });
    }
  }
  return out.sort((a, b) => a.fireAt.localeCompare(b.fireAt) || a.id.localeCompare(b.id));
}

/** What to cancel and what to schedule so the device holds exactly `desired`. */
export function diffReminders(desired: readonly ScheduledReminder[], scheduledIds: readonly string[]) {
  const want = new Set(desired.map((r) => r.id));
  const have = new Set(scheduledIds.filter((id) => id.startsWith(REMINDER_ID_PREFIX)));
  return {
    cancel: [...have].filter((id) => !want.has(id)).sort(),
    schedule: desired.filter((r) => !have.has(r.id)),
  };
}
