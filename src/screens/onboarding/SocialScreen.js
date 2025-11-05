import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Switch, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useOnboarding } from '../../context/OnboardingContext';

export default function SocialScreen({ navigation }) {
  const { updateOnboardingData } = useOnboarding();
  const [isPublic, setIsPublic] = useState(false);

  const handleToggle = (value) => {
    setIsPublic(value);
    updateOnboardingData({ isPublic: value });
  };

  const handleSkip = () => {
    navigation.navigate('Notifications');
  };

  const handleContinue = () => {
    navigation.navigate('Notifications');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.emoji}>👥</Text>
          <Text style={styles.title}>Stay motivated with friends</Text>
          <Text style={styles.subtitle}>Social accountability boosts results by 2x</Text>
        </View>

        <Surface style={styles.card} elevation={2}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="account-group" size={48} color="#6366F1" />
          </View>

          <Text style={styles.cardTitle}>Public Profile</Text>
          <Text style={styles.cardDescription}>
            Friends can see your meals and cheer you on. You control what you share.
          </Text>

          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Make my profile public</Text>
            <Switch value={isPublic} onValueChange={handleToggle} />
          </View>

          {isPublic && (
            <View style={styles.infoBox}>
              <MaterialCommunityIcons
                name="information"
                size={20}
                color="#6366F1"
              />
              <Text style={styles.infoText}>
                You can change this anytime in settings
              </Text>
            </View>
          )}
        </Surface>

        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsTitle}>Benefits:</Text>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitEmoji}>🎉</Text>
            <Text style={styles.benefitText}>Get support from friends</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitEmoji}>📈</Text>
            <Text style={styles.benefitText}>Stay accountable</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitEmoji}>💡</Text>
            <Text style={styles.benefitText}>Discover healthy meal ideas</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          mode="text"
          onPress={handleSkip}
          style={styles.skipButton}
          labelStyle={styles.skipLabel}
        >
          Maybe later
        </Button>
        <Button
          mode="contained"
          onPress={handleContinue}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          Continue
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
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  cardDescription: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    width: '100%',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#6366F1',
  },
  benefitsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  benefitText: {
    fontSize: 15,
    color: '#475569',
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
