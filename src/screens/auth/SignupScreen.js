import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, Snackbar } from 'react-native-paper';
import { authService, userService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLocalization } from '../../localization/i18n';

export default function SignupScreen({ navigation, route }) {
  const { refreshUserProfile } = useAuth();
  const { t } = useLocalization();
  const onboardingData = route.params?.onboardingData || {};
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const getNextCheckInDate = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
  };

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      setError(t('auth.fillAllFields'));
      setSnackbarVisible(true);
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsNoMatch'));
      setSnackbarVisible(true);
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      setSnackbarVisible(true);
      return;
    }

    setLoading(true);
    try {
      // Create auth account
      const userCredential = await authService.signup(email, password);
      const userId = userCredential.user.uid;

      // Create profile with onboarding data
      const profileData = {
        email,
        createdAt: new Date(),
        // Save onboarding data if available
        ...(onboardingData.name && { name: onboardingData.name }),
        ...(onboardingData.age && { age: onboardingData.age }),
        ...(onboardingData.birthMonth && { birthMonth: onboardingData.birthMonth }),
        ...(onboardingData.birthYear && { birthYear: onboardingData.birthYear }),
        ...(onboardingData.weight && { weight: onboardingData.weight }),
        ...(onboardingData.currentWeight && { currentWeight: onboardingData.currentWeight }),
        ...(onboardingData.targetWeight && { targetWeight: onboardingData.targetWeight }),
        ...(onboardingData.weightUnit && { weightUnit: onboardingData.weightUnit }),
        ...(onboardingData.height && { height: onboardingData.height }),
        ...(onboardingData.heightUnit && { heightUnit: onboardingData.heightUnit }),
        ...(onboardingData.gender && { gender: onboardingData.gender }),
        ...(onboardingData.goal && { goal: onboardingData.goal }),
        ...(onboardingData.activityLevel && { activityLevel: onboardingData.activityLevel }),
        ...(onboardingData.workoutsPerWeek && { workoutsPerWeek: onboardingData.workoutsPerWeek }),
        ...(onboardingData.targetDate && { targetDate: onboardingData.targetDate }),
        // Save calculated plan if available
        ...(onboardingData.calculatedPlan && {
          dailyCalorieTarget: onboardingData.calculatedPlan.dailyCalories,
          proteinTarget: onboardingData.calculatedPlan.protein,
          carbsTarget: onboardingData.calculatedPlan.carbs,
          fatTarget: onboardingData.calculatedPlan.fat
        }),
        ...(onboardingData.calculatedPlan && {
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          nextCheckInDate: getNextCheckInDate(1),
          checkInHistory: []
        })
      };

      await userService.createUserProfile(userId, profileData);

      // Refresh profile
      setTimeout(async () => {
        await refreshUserProfile();
      }, 500);

    } catch (error) {
      console.error('Signup error:', error);
      setError(error.message);
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const userCredential = await authService.googleSignIn();
      const userId = userCredential.user.uid;

      // Check if user profile exists
      const existingProfile = await userService.getUserProfile(userId);

      if (!existingProfile) {
        // Create profile with onboarding data for new users
        const profileData = {
          email: userCredential.user.email,
          createdAt: new Date(),
          ...(onboardingData.name && { name: onboardingData.name }),
          ...(onboardingData.age && { age: onboardingData.age }),
          ...(onboardingData.birthMonth && { birthMonth: onboardingData.birthMonth }),
          ...(onboardingData.birthYear && { birthYear: onboardingData.birthYear }),
          ...(onboardingData.weight && { weight: onboardingData.weight }),
          ...(onboardingData.currentWeight && { currentWeight: onboardingData.currentWeight }),
          ...(onboardingData.targetWeight && { targetWeight: onboardingData.targetWeight }),
          ...(onboardingData.weightUnit && { weightUnit: onboardingData.weightUnit }),
          ...(onboardingData.height && { height: onboardingData.height }),
          ...(onboardingData.heightUnit && { heightUnit: onboardingData.heightUnit }),
          ...(onboardingData.gender && { gender: onboardingData.gender }),
          ...(onboardingData.goal && { goal: onboardingData.goal }),
          ...(onboardingData.activityLevel && { activityLevel: onboardingData.activityLevel }),
          ...(onboardingData.workoutsPerWeek && { workoutsPerWeek: onboardingData.workoutsPerWeek }),
          ...(onboardingData.targetDate && { targetDate: onboardingData.targetDate }),
          ...(onboardingData.calculatedPlan && {
            dailyCalorieTarget: onboardingData.calculatedPlan.dailyCalories,
            proteinTarget: onboardingData.calculatedPlan.protein,
            carbsTarget: onboardingData.calculatedPlan.carbs,
            fatTarget: onboardingData.calculatedPlan.fat
          }),
          ...(onboardingData.calculatedPlan && {
            onboardingCompleted: true,
            onboardingCompletedAt: new Date(),
            nextCheckInDate: getNextCheckInDate(1),
            checkInHistory: []
          })
        };

        await userService.createUserProfile(userId, profileData);
      }

      // Refresh profile
      setTimeout(async () => {
        await refreshUserProfile();
      }, 500);
    } catch (error) {
      console.error('Google Sign-In error:', error);
      if (error.code === 'ERR_CANCELED') {
        setError(t('auth.signInCancelled'));
      } else {
        setError(error.message || t('auth.signInGoogleFailed'));
      }
      setSnackbarVisible(true);
    } finally {
      setGoogleLoading(false);
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
            {t('auth.signupTitle')}
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            {t('auth.signupSubtitle')}
          </Text>

          {/* iOS/Android: Show only Google Sign-In */}
          {Platform.OS !== 'web' && (
            <Button
              mode="outlined"
              onPress={handleGoogleSignIn}
              loading={googleLoading}
              disabled={googleLoading}
              style={[styles.button, styles.googleButton]}
              icon="google"
              labelStyle={styles.googleButtonLabel}
              contentStyle={styles.googleButtonContent}
              textColor="#3C4043"
            >
              {t('auth.continueGoogle')}
            </Button>
          )}

          {/* Web: Show Email/Password (only visible on web) */}
          {Platform.OS === 'web' && (
            <>
              <TextInput
                label={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />

              <TextInput
                label={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                secureTextEntry
                style={styles.input}
              />

              <TextInput
                label={t('auth.confirmPassword')}
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
                {t('auth.signUp')}
              </Button>
            </>
          )}

          <Button
            mode="text"
            onPress={() => navigation.navigate('Login')}
            style={styles.linkButton}
          >
            {t('auth.alreadyAccount')}
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
  googleButton: {
    borderWidth: 1,
    borderColor: '#DADCE0',
    backgroundColor: '#FFFFFF',
    borderRadius: 8
  },
  googleButtonLabel: {
    color: '#3C4043',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  googleButtonContent: {
    paddingVertical: 12,
    paddingHorizontal: 24
  },
  linkButton: {
    marginTop: 24
  }
});
