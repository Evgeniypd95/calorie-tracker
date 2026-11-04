import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '../localization/i18n';

const MEAL_REMINDER_IDS_KEY = 'notif_meal_reminder_ids';
const MEAL_REMINDER_TIMES_KEY = 'notif_meal_reminder_times';
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
    await Promise.all(Object.values(ids).map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  }
  await AsyncStorage.removeItem(MEAL_REMINDER_IDS_KEY);
  await AsyncStorage.removeItem(MEAL_REMINDER_TIMES_KEY);
}

const getStoredMealReminderIds = async () => {
  const stored = await AsyncStorage.getItem(MEAL_REMINDER_IDS_KEY);
  return stored ? JSON.parse(stored) : {};
};

// Meal reminders fire once for the next occurrence of each meal time, rather than
// on a recurring daily trigger, so that a meal already logged today can be skipped
// (pushing that reminder to tomorrow) instead of firing regardless of logging state.
export async function scheduleMealReminders(times, loggedMealTypesToday = []) {
  if (Platform.OS === 'web') return;

  await cancelMealReminders();

  const loggedToday = new Set(loggedMealTypesToday.map((m) => String(m).toLowerCase()));
  const now = new Date();

  const entries = await Promise.all(
    MEAL_KEYS.filter((key) => times?.[key]).map(async (key) => {
      const { hour, minute } = parseTime(times[key]);
      const fireAt = new Date(now);
      fireAt.setHours(hour, minute, 0, 0);

      if (fireAt <= now || loggedToday.has(key)) {
        fireAt.setDate(fireAt.getDate() + 1);
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: t(`notifications.mealReminderTitle.${key}`),
          body: t(`notifications.mealReminderBody.${key}`)
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt }
      });

      return [key, id];
    })
  );

  await AsyncStorage.setItem(MEAL_REMINDER_IDS_KEY, JSON.stringify(Object.fromEntries(entries)));
  await AsyncStorage.setItem(MEAL_REMINDER_TIMES_KEY, JSON.stringify(times));
}

// Cancels today's pending reminder for a single meal type (e.g. right after it's
// logged) and reschedules it for tomorrow, leaving the other meal reminders intact.
export async function rescheduleMealReminderAfterLogging(mealType) {
  if (Platform.OS === 'web') return;

  const key = String(mealType || '').toLowerCase();
  if (!MEAL_KEYS.includes(key)) return;

  const storedTimes = await AsyncStorage.getItem(MEAL_REMINDER_TIMES_KEY);
  if (!storedTimes) return;
  const times = JSON.parse(storedTimes);
  if (!times?.[key]) return;

  const ids = await getStoredMealReminderIds();
  if (ids[key]) {
    await Notifications.cancelScheduledNotificationAsync(ids[key]);
  }

  const { hour, minute } = parseTime(times[key]);
  const fireAt = new Date();
  fireAt.setHours(hour, minute, 0, 0);
  fireAt.setDate(fireAt.getDate() + 1);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: t(`notifications.mealReminderTitle.${key}`),
      body: t(`notifications.mealReminderBody.${key}`)
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt }
  });

  ids[key] = id;
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
