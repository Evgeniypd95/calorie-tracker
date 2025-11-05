import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useOnboarding } from '../../context/OnboardingContext';

export default function SuccessScreen({ navigation }) {
  const { onboardingData } = useOnboarding();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Confetti animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.elastic(1.2),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGetStarted = () => {
    // Navigate to Signup to create account
    navigation.navigate('Signup');
  };

  const getGoalMessage = () => {
    switch (onboardingData.goal) {
      case 'LOSE_WEIGHT':
        return `lose ${Math.abs(Math.round(onboardingData.weight * 0.1))} ${onboardingData.weightUnit}`;
      case 'BUILD_MUSCLE':
        return `gain ${Math.round(onboardingData.weight * 0.05)} ${onboardingData.weightUnit} of muscle`;
      case 'MAINTAIN':
        return 'maintain your health';
      case 'EXPLORING':
        return 'explore nutrition';
      default:
        return 'reach your goals';
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        {/* Confetti Emoji */}
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
          }}
        >
          <Text style={styles.confetti}>🎉</Text>
        </Animated.View>

        {/* Success Message */}
        <View style={styles.messageContainer}>
          <Text style={styles.title}>You're all set!</Text>
          <Text style={styles.subtitle}>
            Your journey starts now 🚀
          </Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{onboardingData.dailyCalorieTarget || calculateTDEE(onboardingData)}</Text>
            <Text style={styles.statLabel}>Daily Target</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {onboardingData.goal === 'LOSE_WEIGHT' ? '🎯' : onboardingData.goal === 'BUILD_MUSCLE' ? '💪' : '⚖️'}
            </Text>
            <Text style={styles.statLabel}>{getGoalMessage()}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Current Streak</Text>
            <Text style={styles.statHint}>(let's change that!)</Text>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaContainer}>
          <Button
            mode="contained"
            onPress={handleGetStarted}
            style={styles.mainButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            icon="account-plus"
          >
            Create Account
          </Button>
          <Text style={styles.footerText}>
            One last step to start your journey 🚀
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

// Helper to calculate TDEE (duplicate from context for display)
const calculateTDEE = (data) => {
  const { age, weight, height, gender, activityLevel, weightUnit, heightUnit } = data;

  let weightKg = weightUnit === 'lbs' ? weight * 0.453592 : weight;
  let heightCm = heightUnit === 'ft' ? height * 2.54 : height;

  let bmr;
  if (gender === 'MALE') {
    bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
  } else {
    bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
  }

  const multipliers = {
    SEDENTARY: 1.2,
    LIGHT: 1.375,
    MODERATE: 1.55,
    ACTIVE: 1.725,
    VERY_ACTIVE: 1.9
  };

  return Math.round(bmr * multipliers[activityLevel || 'MODERATE']);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6366F1',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 100,
  },
  confetti: {
    fontSize: 100,
    marginBottom: 32,
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  statsContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 40,
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  statHint: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
    marginTop: 4,
  },
  ctaContainer: {
    width: '100%',
    alignItems: 'center',
  },
  mainButton: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  buttonContent: {
    paddingVertical: 12,
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366F1',
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
});
