import React, { useState } from 'react';
import { View, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { Button, Text, Snackbar, TextInput } from 'react-native-paper';
import { authService, userService } from '../../services/firebase';
import { useLocalization } from '../../localization/i18n';

export default function LoginScreen({ navigation }) {
  const { t } = useLocalization();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t('auth.fillAllFields'));
      setSnackbarVisible(true);
      return;
    }

    setLoading(true);
    try {
      await authService.login(email, password);
      // Navigation handled by auth state listener
    } catch (error) {
      console.error('Login error:', error);
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
        // Create basic profile for new users
        const profileData = {
          email: userCredential.user.email,
          name: userCredential.user.displayName || '',
          createdAt: new Date()
        };
        await userService.createUserProfile(userId, profileData);
      }
      // Navigation handled by auth state listener
    } catch (error) {
      console.error('Google Sign-In error:', error);
      if (error.code === 'ERR_CANCELED') {
        // User cancelled the sign-in
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
      <View style={styles.content}>
        <Text variant="displaySmall" style={styles.title}>
          {t('auth.loginTitle')}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {t('auth.loginSubtitle')}
        </Text>

        {/* Mobile: Show only Google Sign-In and Get Started */}
        {Platform.OS !== 'web' && (
          <>
            <Button
              mode="contained"
              onPress={() => navigation.navigate('OnboardingGoals')}
              style={styles.primaryButton}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              {t('auth.getStarted')}
            </Button>

            <Button
              mode="outlined"
              onPress={handleGoogleSignIn}
              loading={googleLoading}
              disabled={googleLoading}
              style={styles.googleButton}
              icon="google"
              contentStyle={styles.buttonContent}
              labelStyle={styles.googleButtonLabel}
              textColor="#3C4043"
            >
              {t('auth.continueGoogle')}
            </Button>
          </>
        )}

        {/* Web: Show Email/Password Login */}
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

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              {t('auth.logIn')}
            </Button>

            <Button
              mode="text"
              onPress={() => navigation.navigate('OnboardingGoals')}
              style={styles.linkButton}
            >
              {t('auth.noAccount')}
            </Button>
          </>
        )}
      </View>

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
    letterSpacing: -1,
    textAlign: 'center'
  },
  subtitle: {
    marginBottom: 48,
    color: '#64748B',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center'
  },
  input: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF'
  },
  button: {
    marginTop: 12,
    paddingVertical: 8
  },
  primaryButton: {
    marginBottom: 16
  },
  googleButton: {
    borderWidth: 1,
    borderColor: '#DADCE0',
    backgroundColor: '#FFFFFF',
    borderRadius: 8
  },
  buttonContent: {
    paddingVertical: 12
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600'
  },
  googleButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3C4043'
  },
  linkButton: {
    marginTop: 24
  }
});
