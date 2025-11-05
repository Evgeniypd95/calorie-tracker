import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, Snackbar } from 'react-native-paper';
import { authService, userService } from '../../services/firebase';
import { useOnboarding } from '../../context/OnboardingContext';

// Helper to calculate next check-in date
const getNextCheckInDate = (daysFromNow) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
};

export default function SignupScreen({ navigation }) {
  const { onboardingData, calculateTargetCalories } = useOnboarding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      setSnackbarVisible(true);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setSnackbarVisible(true);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setSnackbarVisible(true);
      return;
    }

    setLoading(true);
    try {
      // Create auth account
      const userCredential = await authService.signup(email, password);
      const userId = userCredential.user.uid;

      // Calculate daily calorie target if not set
      const dailyCalorieTarget = onboardingData.dailyCalorieTarget || calculateTargetCalories();

      // Save all onboarding data to user profile
      const profileData = {
        email,
        onboardingCompleted: true,
        goal: onboardingData.goal,
        age: onboardingData.age,
        weight: onboardingData.weight,
        height: onboardingData.height,
        desiredWeight: onboardingData.desiredWeight,
        weightUnit: onboardingData.weightUnit,
        heightUnit: onboardingData.heightUnit,
        gender: onboardingData.gender,
        bodyType: onboardingData.bodyType,
        activityLevel: onboardingData.activityLevel,
        workoutsPerWeek: onboardingData.workoutsPerWeek,
        strategy: onboardingData.strategy,
        strategyMultiplier: onboardingData.strategyMultiplier,
        enableWeekendFlexibility: onboardingData.enableWeekendFlexibility,
        weekendOption: onboardingData.weekendOption,
        weekendBonusCalories: onboardingData.weekendBonusCalories,
        weekdayCalories: onboardingData.weekdayCalories,
        weekendCalories: onboardingData.weekendCalories,
        dailyCalorieTarget,
        proteinTarget: onboardingData.proteinTarget,
        carbsTarget: onboardingData.carbsTarget,
        fatTarget: onboardingData.fatTarget,
        preferredInputMethod: onboardingData.preferredInputMethod,
        isPublic: onboardingData.isPublic,
        notificationsEnabled: onboardingData.notificationsEnabled,
        notificationTimes: onboardingData.notificationTimes,
        onboardingCompletedAt: new Date(),
        createdAt: new Date(),
        // Initialize check-in tracking
        nextCheckInDate: getNextCheckInDate(1), // First check-in after 1 day
        checkInHistory: []
      };

      await userService.updateUserProfile(userId, profileData);

      // Navigation to main app will be handled automatically by App.js
    } catch (error) {
      console.error('Signup error:', error);
      setError(error.message);
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text variant="displaySmall" style={styles.title}>
            Create Account
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            Start your fitness journey today
          </Text>

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />

          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleSignup}
            loading={loading}
            disabled={loading}
            style={styles.button}
          >
            Sign Up
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate('Login')}
            style={styles.linkButton}
          >
            Already have an account? Log In
          </Button>
        </View>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {error}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9'
  },
  scrollContent: {
    flexGrow: 1
  },
  content: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%'
  },
  title: {
    marginBottom: 12,
    fontWeight: '800',
    fontSize: 36,
    color: '#1E293B',
    letterSpacing: -1
  },
  subtitle: {
    marginBottom: 40,
    color: '#64748B',
    fontSize: 16,
    lineHeight: 24
  },
  input: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF'
  },
  button: {
    marginTop: 12,
    paddingVertical: 8
  },
  linkButton: {
    marginTop: 24
  }
});
