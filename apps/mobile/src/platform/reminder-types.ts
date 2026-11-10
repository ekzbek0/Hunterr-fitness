/**
 * M3 local reminders: platform-neutral contract. Native uses expo-notifications
 * (reminder-scheduler.ts); the web preview has NO notification support and says
 * so (reminder-scheduler.web.ts). Every AVCI notification id starts with
 * REMINDER_ID_PREFIX so reconciliation never touches anything else.
 */
export const REMINDER_ID_PREFIX = 'avci-';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export interface ScheduledReminder {
  /** Deterministic: `avci-<YYYY-MM-DD>-<HHMM>-<hash>`; one day+time is never scheduled twice. */
  id: string;
  /** Absolute fire instant (ISO, UTC). */
  fireAt: string;
  title: string;
  body: string;
}

export interface ReminderScheduler {
  /** false on web: the UI must not pretend notifications work. */
  readonly supported: boolean;
  permission(): Promise<ReminderPermission>;
  requestPermission(): Promise<ReminderPermission>;
  /** Ids of scheduled AVCI reminders (prefix-filtered). */
  listScheduledIds(): Promise<string[]>;
  schedule(r: ScheduledReminder): Promise<void>;
  cancel(id: string): Promise<void>;
  /** Cancels every AVCI reminder (delete-all, reminders turned off). */
  cancelAll(): Promise<void>;
  /** Removes already delivered AVCI notifications from the notification centre (delete-all). */
  clearDelivered(): Promise<void>;
}
