// Web preview: no local notifications. The UI says so instead of pretending.
import type { ReminderScheduler } from './reminder-types';

export function createReminderScheduler(): ReminderScheduler {
  return {
    supported: false,
    permission: async () => 'unsupported',
    requestPermission: async () => 'unsupported',
    listScheduledIds: async () => [],
    schedule: async () => {
      throw new Error('Web önizlemesinde bildirim yok');
    },
    cancel: async () => undefined,
    cancelAll: async () => undefined,
    clearDelivered: async () => undefined,
  };
}
