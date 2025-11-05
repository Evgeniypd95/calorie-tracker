import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import GoalSelectionScreen from '../screens/onboarding/GoalSelectionScreen';
import StatsScreen from '../screens/onboarding/StatsScreen';
import BodyTypeScreen from '../screens/onboarding/BodyTypeScreen';
import InteractiveDemoScreen from '../screens/onboarding/InteractiveDemoScreen';
import InputPreferenceScreen from '../screens/onboarding/InputPreferenceScreen';
import SocialScreen from '../screens/onboarding/SocialScreen';
import NotificationsScreen from '../screens/onboarding/NotificationsScreen';
import SuccessScreen from '../screens/onboarding/SuccessScreen';

const Stack = createStackNavigator();

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#F1F5F9' },
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="GoalSelection" component={GoalSelectionScreen} />
      <Stack.Screen name="Stats" component={StatsScreen} />
      <Stack.Screen name="BodyType" component={BodyTypeScreen} />
      <Stack.Screen name="InteractiveDemo" component={InteractiveDemoScreen} />
      <Stack.Screen name="InputPreference" component={InputPreferenceScreen} />
      <Stack.Screen name="Social" component={SocialScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Success" component={SuccessScreen} />
    </Stack.Navigator>
  );
}
