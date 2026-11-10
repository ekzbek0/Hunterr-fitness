// Native (iOS) local notifications via expo-notifications. Metro picks
// reminder-scheduler.web.ts on web, so this module is never in the web bundle.
// Nothing here talks to a server: no push token is requested.
import * as Notifications from 'expo-notifications';

import { REMINDER_ID_PREFIX, type ReminderPermission, type ReminderScheduler } from './reminder-types';

let handlerSet = false;

function toPermission(p: Notifications.NotificationPermissionsStatus): ReminderPermission {
  if (p.granted) return 'granted';
  // iOS provisional (3) / ephemeral (4) authorization can still deliver quietly.
  const ios = p.ios?.status as number | undefined;
  if (ios === 3 || ios === 4) return 'granted';
  return p.status === 'undetermined' ? 'undetermined' : 'denied';
}

export function createReminderScheduler(): ReminderScheduler {
  if (!handlerSet) {
    handlerSet = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }
  const ids = async () =>
    (await Notifications.getAllScheduledNotificationsAsync())
      .map((r) => r.identifier)
      .filter((id) => id.startsWith(REMINDER_ID_PREFIX));
  return {
    supported: true,
    permission: async () => toPermission(await Notifications.getPermissionsAsync()),
    requestPermission: async () =>
      toPermission(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } })),
    listScheduledIds: ids,
    schedule: async (r) => {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.fireAt) },
      });
    },
    cancel: (id) => Notifications.cancelScheduledNotificationAsync(id),
    cancelAll: async () => {
      for (const id of await ids()) await Notifications.cancelScheduledNotificationAsync(id);
    },
    // Every notification of this app is an AVCI reminder (no push), so all delivered ones are ours.
    clearDelivered: () => Notifications.dismissAllNotificationsAsync(),
  };
}
