import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text as RNText, Platform } from 'react-native';
import { Text, Switch } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/firebase';
import {
  requestPermissions,
  hasPermission,
  scheduleMealReminders,
  cancelMealReminders,
  scheduleStreakRiskReminder,
  cancelStreakRiskReminder
} from '../../services/notificationService';
import { useLocalization } from '../../localization/i18n';
import { colors, radius, shadows, type } from '../../theme';

const DEFAULT_TIMES = { breakfast: '08:00', lunch: '12:00', dinner: '18:00' };
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

function TimeRow({ label, value, onChange }) {
  const hour = value.split(':')[0];
  return (
    <View style={styles.timeRow}>
      <Text style={styles.timeRowLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourScroll}>
        {HOUR_OPTIONS.map((h) => {
          const selected = h === hour;
          return (
            <TouchableOpacity
              key={h}
              style={[styles.hourPill, selected && styles.hourPillSelected]}
              onPress={() => onChange(`${h}:00`)}
              activeOpacity={0.7}
            >
              <RNText style={[styles.hourPillLabel, selected && styles.hourPillLabelSelected]}>{h}:00</RNText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { t } = useLocalization();

  const [mealRemindersEnabled, setMealRemindersEnabled] = useState(false);
  const [streakRiskEnabled, setStreakRiskEnabled] = useState(false);
  const [times, setTimes] = useState(DEFAULT_TIMES);
  const [permissionGranted, setPermissionGranted] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setMealRemindersEnabled(!!userProfile.notificationsEnabled);
      setStreakRiskEnabled(!!userProfile.streakRiskReminderEnabled);
      setTimes({ ...DEFAULT_TIMES, ...(userProfile.notificationTimes || {}) });
    }
    checkPermission();
  }, [userProfile]);

  const checkPermission = async () => {
    if (Platform.OS === 'web') return;
    const granted = await hasPermission();
    setPermissionGranted(granted);
  };

  const handleToggleMealReminders = async (value) => {
    if (value) {
      const granted = await requestPermissions();
      setPermissionGranted(granted);
      if (!granted) return;
    }
    setMealRemindersEnabled(value);
  };

  const handleToggleStreakRisk = async (value) => {
    if (value) {
      const granted = await requestPermissions();
      setPermissionGranted(granted);
      if (!granted) return;
    }
    setStreakRiskEnabled(value);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await userService.updateUserProfile(user.uid, {
        notificationsEnabled: mealRemindersEnabled,
        notificationTimes: times,
        streakRiskReminderEnabled: streakRiskEnabled
      });

      if (mealRemindersEnabled) {
        await scheduleMealReminders(times);
      } else {
        await cancelMealReminders();
      }

      if (streakRiskEnabled) {
        await scheduleStreakRiskReminder(userProfile?.lastLogDate);
      } else {
        await cancelStreakRiskReminder();
      }

      await refreshUserProfile();
    } catch (error) {
      console.error('Error saving notification settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {!permissionGranted && (
        <View style={styles.permissionCard}>
          <Text style={styles.permissionText}>{t('notifications.permissionDenied')}</Text>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextContainer}>
            <Text style={styles.sectionTitle}>{t('notifications.mealRemindersTitle')}</Text>
            <Text style={styles.helpText}>{t('notifications.mealRemindersSubtitle')}</Text>
          </View>
          <Switch value={mealRemindersEnabled} onValueChange={handleToggleMealReminders} color={colors.primary} />
        </View>

        {mealRemindersEnabled && (
          <View style={styles.timesSection}>
            <TimeRow
              label={t('notifications.breakfast')}
              value={times.breakfast}
              onChange={(v) => setTimes((prev) => ({ ...prev, breakfast: v }))}
            />
            <TimeRow
              label={t('notifications.lunch')}
              value={times.lunch}
              onChange={(v) => setTimes((prev) => ({ ...prev, lunch: v }))}
            />
            <TimeRow
              label={t('notifications.dinner')}
              value={times.dinner}
              onChange={(v) => setTimes((prev) => ({ ...prev, dinner: v }))}
            />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextContainer}>
            <Text style={styles.sectionTitle}>{t('notifications.streakRiskTitleSetting')}</Text>
            <Text style={styles.helpText}>{t('notifications.streakRiskSubtitle')}</Text>
          </View>
          <Switch value={streakRiskEnabled} onValueChange={handleToggleStreakRisk} color={colors.primary} />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        <RNText style={styles.saveButtonLabel}>
          {saving ? t('common.loading') : t('common.save')}
        </RNText>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: 20
  },
  permissionCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
    marginBottom: 16
  },
  permissionText: {
    color: '#92400E',
    fontSize: 13,
    lineHeight: 18
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 14,
    ...shadows.card
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 16
  },
  sectionTitle: {
    ...type.heading,
    marginBottom: 4
  },
  helpText: {
    ...type.caption,
    lineHeight: 18
  },
  timesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.subtle,
    gap: 14
  },
  timeRow: {},
  timeRowLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  hourScroll: {},
  hourPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.subtle,
    marginRight: 6,
    borderWidth: 1.5,
    borderColor: 'transparent'
  },
  hourPillSelected: {
    backgroundColor: colors.tint,
    borderColor: colors.primary
  },
  hourPillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted
  },
  hourPillLabelSelected: {
    color: colors.primaryDark,
    fontWeight: '700'
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    ...shadows.glow
  },
  saveButtonLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2
  }
});
