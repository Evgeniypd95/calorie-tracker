import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Snackbar, Divider } from 'react-native-paper';
import { authService } from '../../services/firebase';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
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
      await authService.googleSignIn();
      // Navigation handled by auth state listener
    } catch (error) {
      console.error('Google Sign-In error:', error);
      if (error.code === 'ERR_CANCELED') {
        // User cancelled the sign-in
        setError('Sign-in cancelled');
      } else {
        setError(error.message || 'Failed to sign in with Google');
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
          Welcome Back
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Sign in to continue tracking your nutrition
        </Text>

        {/* Native: Show Google Sign-In */}
        {Platform.OS !== 'web' && (
          <>
            <Button
              mode="outlined"
              onPress={handleGoogleSignIn}
              loading={googleLoading}
              disabled={googleLoading || loading}
              style={[styles.button, styles.googleButton]}
              icon="google"
            >
              Continue with Google
            </Button>

            <View style={styles.dividerContainer}>
              <Divider style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <Divider style={styles.divider} />
            </View>
          </>
        )}

        {/* Web: Show Email/Password (always visible on web) */}
        {/* Native: Show Email/Password after divider */}
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

        <Button
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          disabled={loading || googleLoading}
          style={styles.button}
        >
          {Platform.OS === 'web' ? 'Log In' : 'Continue with Email'}
        </Button>

        <Button
          mode="text"
          onPress={() => navigation.navigate('Signup')}
          style={styles.linkButton}
        >
          Don't have an account? Sign Up
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
    borderColor: '#DB4437',
    borderWidth: 2
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0'
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600'
  },
  linkButton: {
    marginTop: 24
  }
});
