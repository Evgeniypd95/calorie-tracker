import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import BiometricsScreen from '../screens/onboarding/BiometricsScreen';
import GoalsScreen from '../screens/onboarding/GoalsScreen';
import BudgetConfirmScreen from '../screens/onboarding/BudgetConfirmScreen';

const Stack = createStackNavigator();

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true
      }}
    >
      <Stack.Screen
        name="Biometrics"
        component={BiometricsScreen}
        options={{ title: 'Your Info' }}
      />
      <Stack.Screen
        name="Goals"
        component={GoalsScreen}
        options={{ title: 'Your Goals' }}
      />
      <Stack.Screen
        name="BudgetConfirm"
        component={BudgetConfirmScreen}
        options={{ title: 'Confirm Budget' }}
      />
    </Stack.Navigator>
  );
}
