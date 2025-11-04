import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { ActivityIndicator, View, StyleSheet, Platform } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2196F3',
  },
};

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  // Not authenticated - show auth screens
  if (!user) {
    return <AuthNavigator />;
  }

  // Authenticated - show main app
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
    backgroundColor: '#fff'
  }
});
