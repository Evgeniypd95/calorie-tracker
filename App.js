import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { ActivityIndicator, View, StyleSheet, Platform } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { OnboardingProvider } from './src/context/OnboardingContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import OnboardingNavigator from './src/navigation/OnboardingNavigator';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#6366F1', // Modern indigo
    secondary: '#8B5CF6', // Purple accent
    tertiary: '#EC4899', // Pink accent
    surface: '#FFFFFF',
    surfaceVariant: '#F8FAFC',
    background: '#F1F5F9',
    error: '#EF4444',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onSurface: '#1E293B',
    onSurfaceVariant: '#64748B',
    outline: '#E2E8F0',
    outlineVariant: '#F1F5F9',
  },
};

function AppContent() {
  const { user, userProfile, loading } = useAuth();

  if (loading || (user && !userProfile)) {
    // Show loading while auth is initializing OR user exists but profile not loaded yet
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // Not authenticated - show auth screens
  if (!user) {
    return <AuthNavigator />;
  }

  // Authenticated but onboarding not completed
  if (user && userProfile && !userProfile.onboardingCompleted) {
    return (
      <OnboardingProvider>
        <OnboardingNavigator />
      </OnboardingProvider>
    );
  }

  // Authenticated and onboarded - show main app
  return <MainNavigator />;
}

export default function App() {
  return (
    <View style={styles.appContainer}>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <NavigationContainer>
            <AppContent />
          </NavigationContainer>
        </AuthProvider>
      </PaperProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    ...Platform.select({
      web: {
        maxWidth: 600,
        marginHorizontal: 'auto',
        width: '100%',
      },
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9'
  }
});
