import React, { useState } from 'react';
import { View, StyleSheet, Platform, KeyboardAvoidingView, Text as RNText, TouchableOpacity } from 'react-native';
import { Button, Text, Snackbar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { authService, userService } from '../../services/firebase';
import { useLocalization } from '../../localization/i18n';
import { colors, gradients, radius, shadows } from '../../theme';

export default function LoginScreen({ navigation }) {
  const { t } = useLocalization();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const userCredential = await authService.googleSignIn();
      const userId = userCredential.user.uid;

      const existingProfile = await userService.getUserProfile(userId);

      if (!existingProfile) {
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
      if (error.code === 'ERR_CANCELED' || error.code === 'auth/popup-closed-by-user') {
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
        {/* Brand mark */}
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoBlob}
        >
          <RNText style={styles.logoEmoji}>🥗</RNText>
        </LinearGradient>

        <Text style={styles.title}>{t('auth.loginTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('OnboardingGoals')}
        >
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryButton}
          >
            <RNText style={styles.primaryButtonLabel}>{t('auth.getStarted')}</RNText>
          </LinearGradient>
        </TouchableOpacity>

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
    backgroundColor: colors.background
  },
  content: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%'
  },
  logoBlob: {
    width: 88,
    height: 88,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 28,
    ...shadows.glow
  },
  logoEmoji: {
    fontSize: 44
  },
  title: {
    marginBottom: 10,
    fontWeight: '800',
    fontSize: 32,
    color: colors.ink,
    letterSpacing: -1,
    textAlign: 'center'
  },
  subtitle: {
    marginBottom: 44,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center'
  },
  primaryButton: {
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
    ...shadows.glow
  },
  primaryButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2
  },
  googleButton: {
    borderWidth: 1,
    borderColor: '#DADCE0',
    backgroundColor: colors.surface,
    borderRadius: radius.pill
  },
  buttonContent: {
    paddingVertical: 8
  },
  googleButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3C4043'
  }
});
