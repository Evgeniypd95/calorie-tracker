import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '../localization/i18n';

const MEAL_REMINDER_IDS_KEY = 'notif_meal_reminder_ids';
const STREAK_REMINDER_ID_KEY = 'notif_streak_reminder_id';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

export async function requestPermissions() {
  if (Platform.OS === 'web') return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function hasPermission() {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

const parseTime = (timeStr) => {
  const [hour, minute] = String(timeStr || '08:00').split(':').map((n) => parseInt(n, 10));
  return {
    hour: Number.isNaN(hour) ? 8 : hour,
    minute: Number.isNaN(minute) ? 0 : minute
  };
};

const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'];

export async function cancelMealReminders() {
  const stored = await AsyncStorage.getItem(MEAL_REMINDER_IDS_KEY);
  if (stored) {
    const ids = JSON.parse(stored);
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  }
  await AsyncStorage.removeItem(MEAL_REMINDER_IDS_KEY);
}

export async function scheduleMealReminders(times) {
  if (Platform.OS === 'web') return;

  await cancelMealReminders();

  const ids = await Promise.all(
    MEAL_KEYS.filter((key) => times?.[key]).map(async (key) => {
      const { hour, minute } = parseTime(times[key]);
      return Notifications.scheduleNotificationAsync({
        content: {
          title: t(`notifications.mealReminderTitle.${key}`),
          body: t(`notifications.mealReminderBody.${key}`)
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute
        }
      });
    })
  );

  await AsyncStorage.setItem(MEAL_REMINDER_IDS_KEY, JSON.stringify(ids));
}

export async function cancelStreakRiskReminder() {
  const id = await AsyncStorage.getItem(STREAK_REMINDER_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(STREAK_REMINDER_ID_KEY);
  }
}

const STREAK_RISK_HOUR = 21;

export async function scheduleStreakRiskReminder(lastLogDate) {
  if (Platform.OS === 'web') return;

  await cancelStreakRiskReminder();

  const now = new Date();
  const last = lastLogDate?.toDate?.() || (lastLogDate ? new Date(lastLogDate) : null);
  const loggedToday = last && last.toDateString() === now.toDateString();
  if (loggedToday) return;

  const fireAt = new Date(now);
  fireAt.setHours(STREAK_RISK_HOUR, 0, 0, 0);
  if (fireAt <= now) return;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: t('notifications.streakRiskTitle'),
      body: t('notifications.streakRiskBody')
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt }
  });

  await AsyncStorage.setItem(STREAK_REMINDER_ID_KEY, id);
}
