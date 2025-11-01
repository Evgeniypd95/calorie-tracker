import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import OnboardingNavigator from './src/navigation/OnboardingNavigator';
import MainNavigator from './src/navigation/MainNavigator';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2196F3',
  },
};

function AppContent() {
  const { user, userProfile, loading } = useAuth();

  console.log('📱 AppContent render:', {
    loading,
    hasUser: !!user,
    hasProfile: !!userProfile,
    hasDailyBudget: !!userProfile?.dailyBudget
  });

  if (loading) {
    console.log('⏳ Loading...');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  // Not authenticated - show auth screens
  if (!user) {
    console.log('🔐 No user - showing auth navigator');
    return <AuthNavigator />;
  }

  // Authenticated but no profile - show onboarding
  if (!userProfile || !userProfile.dailyBudget) {
    console.log('📝 User exists but no profile/budget - showing onboarding');
    return <OnboardingNavigator />;
  }

  // Authenticated with complete profile - show main app
  console.log('✅ User has complete profile - showing main app');
  return <MainNavigator />;
}

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <NavigationContainer>
          <AppContent />
        </NavigationContainer>
      </AuthProvider>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff'
  }
});
