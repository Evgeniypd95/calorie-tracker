import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, Snackbar } from 'react-native-paper';
import { authService, userService } from '../../services/firebase';
import { useOnboarding } from '../../context/OnboardingContext';
import { useAuth } from '../../context/AuthContext';

// Helper to calculate next check-in date
const getNextCheckInDate = (daysFromNow) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
};

export default function SignupScreen({ navigation }) {
  const { onboardingData, calculateTargetCalories } = useOnboarding();
  const { refreshUserProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  // Redirect to onboarding if not completed
  React.useEffect(() => {
    if (!onboardingData?.dailyCalorieTarget) {
      navigation.replace('ConversationalOnboarding');
    }
  }, []);

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

    // Check if onboarding is completed
    if (!onboardingData?.dailyCalorieTarget) {
      setError('Please complete onboarding first');
      setSnackbarVisible(true);
      navigation.replace('ConversationalOnboarding');
      return;
    }

    setLoading(true);
    try {
      // Create auth account
      const userCredential = await authService.signup(email, password);
      const userId = userCredential.user.uid;

      // Use onboarding data for calorie target
      const dailyCalorieTarget = onboardingData.dailyCalorieTarget;

      // Save ONLY data captured in conversational onboarding
      const profileData = {
        email,
        name: onboardingData.name || null, // Name is optional
        age: onboardingData.age,
        weight: onboardingData.weight,
        height: onboardingData.height,
        weightUnit: onboardingData.weightUnit || 'kg',
        heightUnit: onboardingData.heightUnit || 'cm',
        gender: onboardingData.gender,
        goal: onboardingData.goal,
        activityLevel: onboardingData.activityLevel,
        workoutsPerWeek: onboardingData.workoutsPerWeek,
        dailyCalorieTarget,
        proteinTarget: onboardingData.proteinTarget,
        carbsTarget: onboardingData.carbsTarget,
        fatTarget: onboardingData.fatTarget,
        createdAt: new Date()
      };

      await userService.createUserProfile(userId, profileData);

      // Wait a moment for AuthContext to update, then refresh the profile
      setTimeout(async () => {
        await refreshUserProfile();
      }, 500);

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
