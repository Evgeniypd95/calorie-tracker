import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { ActivityIndicator, View, StyleSheet, Platform, useColorScheme } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import SetCaloriesScreen from './src/screens/onboarding/SetCaloriesScreen';

const lightTheme = {
  ...MD3LightTheme,
  fonts: MD3LightTheme.fonts,
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
    onBackground: '#1E293B',
    outline: '#E2E8F0',
    outlineVariant: '#F1F5F9',
  },
};

const darkTheme = {
  ...MD3DarkTheme,
  fonts: MD3DarkTheme.fonts,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#818CF8', // Lighter indigo for dark mode
    secondary: '#A78BFA', // Lighter purple
    tertiary: '#F472B6', // Lighter pink
    surface: '#1E293B',
    surfaceVariant: '#334155',
    background: '#0F172A',
    error: '#F87171',
    onPrimary: '#0F172A',
    onSecondary: '#0F172A',
    onSurface: '#F1F5F9',
    onSurfaceVariant: '#94A3B8',
    onBackground: '#F1F5F9',
    outline: '#475569',
    outlineVariant: '#334155',
  },
};

function AppContent() {
  const { user, userProfile, loading } = useAuth();

  console.log('AppContent - user:', !!user, 'userProfile:', !!userProfile, 'loading:', loading);
  if (userProfile) {
    console.log('Profile has dailyCalorieTarget:', !!userProfile.dailyCalorieTarget);
  }

  if (loading) {
    // Show loading while auth is initializing
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // Not authenticated - show login/signup
  if (!user) {
    return <AuthNavigator />;
  }

  // User exists but profile not loaded yet
  if (user && !userProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // User authenticated but hasn't set calorie target
  if (user && userProfile && !userProfile.dailyCalorieTarget) {
    return <SetCaloriesScreen />;
  }

  // Authenticated and has calorie target - show main app
  return <MainNavigator />;
}

export default function App() {
  // Force light mode - dark mode not fully implemented
  const theme = lightTheme;

  return (
    <View style={[styles.appContainer, { backgroundColor: theme.colors.background }]}>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <NavigationContainer theme={{
            dark: false,
            colors: {
              primary: lightTheme.colors.primary,
              background: lightTheme.colors.background,
              card: lightTheme.colors.surface,
              text: lightTheme.colors.onBackground,
              border: lightTheme.colors.outline,
              notification: lightTheme.colors.primary,
            },
            fonts: {
              regular: {
                fontFamily: 'System',
                fontWeight: '400',
              },
              medium: {
                fontFamily: 'System',
                fontWeight: '500',
              },
              bold: {
                fontFamily: 'System',
                fontWeight: '600',
              },
              heavy: {
                fontFamily: 'System',
                fontWeight: '700',
              },
            },
          }}>
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
