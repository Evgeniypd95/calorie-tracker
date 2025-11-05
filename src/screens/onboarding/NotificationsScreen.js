import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useOnboarding } from '../../context/OnboardingContext';

export default function NotificationsScreen({ navigation }) {
  const { updateOnboardingData } = useOnboarding();
  const [enabled, setEnabled] = useState(false);

  const handleToggle = (value) => {
    setEnabled(value);
    updateOnboardingData({ notificationsEnabled: value });
  };

  const handleSkip = () => {
    navigation.navigate('Success');
  };

  const handleContinue = () => {
    navigation.navigate('Success');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.emoji}>🔔</Text>
          <Text style={styles.title}>Gentle reminders to stay on track</Text>
          <Text style={styles.subtitle}>Smart notifications that adapt to your routine</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.notificationItem}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="coffee" size={24} color="#6366F1" />
            </View>
            <View style={styles.notificationText}>
              <Text style={styles.notificationTitle}>Meal logging</Text>
              <Text style={styles.notificationDescription}>
                Breakfast 8am, Lunch 12pm, Dinner 6pm
              </Text>
            </View>
          </View>

          <View style={styles.notificationItem}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="chart-line" size={24} color="#6366F1" />
            </View>
            <View style={styles.notificationText}>
              <Text style={styles.notificationTitle}>Daily summary</Text>
              <Text style={styles.notificationDescription}>
                8pm - Your day's nutrition recap
              </Text>
            </View>
          </View>

          <View style={styles.notificationItem}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="trophy" size={24} color="#6366F1" />
            </View>
            <View style={styles.notificationText}>
              <Text style={styles.notificationTitle}>Weekly progress</Text>
              <Text style={styles.notificationDescription}>
                Sunday - Celebrate your streak
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.toggleCard}>
          <Text style={styles.toggleLabel}>Enable notifications</Text>
          <Switch value={enabled} onValueChange={handleToggle} />
        </View>

        {enabled && (
          <View style={styles.infoBox}>
            <MaterialCommunityIcons
              name="information"
              size={20}
              color="#10B981"
            />
            <Text style={styles.infoText}>
              You can customize times in settings later
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          mode="text"
          onPress={handleSkip}
          style={styles.skipButton}
          labelStyle={styles.skipLabel}
        >
          Skip
        </Button>
        <Button
          mode="contained"
          onPress={handleContinue}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          {enabled ? 'Enable & Continue' : 'Continue'}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 140,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    gap: 20,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: 14,
    color: '#64748B',
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#059669',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  skipButton: {
    marginBottom: 8,
  },
  skipLabel: {
    fontSize: 16,
    color: '#94A3B8',
  },
  button: {
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
});
