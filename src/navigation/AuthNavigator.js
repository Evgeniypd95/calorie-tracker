import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import ConversationalOnboardingScreen from '../screens/onboarding/ConversationalOnboardingScreen';

const Stack = createStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#F1F5F9' },
        animationEnabled: true,
      }}
      initialRouteName="Welcome"
    >
      {/* Auth Screens */}
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />

      {/* Conversational Onboarding (AI-powered) */}
      <Stack.Screen name="ConversationalOnboarding" component={ConversationalOnboardingScreen} />

      {/* Signup at the end (after onboarding) */}
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}
