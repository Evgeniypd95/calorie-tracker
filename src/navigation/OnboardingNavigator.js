import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import GoalSelectionScreen from '../screens/onboarding/GoalSelectionScreen';
import StatsScreen from '../screens/onboarding/StatsScreen';
import BodyTypeScreen from '../screens/onboarding/BodyTypeScreen';
import StrategyScreen from '../screens/onboarding/StrategyScreen';
import WeekendFlexibilityScreen from '../screens/onboarding/WeekendFlexibilityScreen';
import PlanReviewScreen from '../screens/onboarding/PlanReviewScreen';
import InteractiveDemoScreen from '../screens/onboarding/InteractiveDemoScreen';
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
      initialRouteName="GoalSelection"
    >
      <Stack.Screen name="GoalSelection" component={GoalSelectionScreen} />
      <Stack.Screen name="Stats" component={StatsScreen} />
      <Stack.Screen name="BodyType" component={BodyTypeScreen} />
      <Stack.Screen name="Strategy" component={StrategyScreen} />
      <Stack.Screen name="WeekendFlexibility" component={WeekendFlexibilityScreen} />
      <Stack.Screen name="PlanReview" component={PlanReviewScreen} />
      <Stack.Screen name="InteractiveDemo" component={InteractiveDemoScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Success" component={SuccessScreen} />
    </Stack.Navigator>
  );
}
