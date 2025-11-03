import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import DashboardScreen from '../screens/main/DashboardScreen';
import LogMealScreen from '../screens/main/LogMealScreen';
import { IconButton } from 'react-native-paper';
import { authService } from '../services/firebase';

const Stack = createStackNavigator();

export default function MainNavigator() {
  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'My Meals',
          headerRight: () => (
            <IconButton
              icon="logout"
              onPress={handleLogout}
            />
          )
        }}
      />
      <Stack.Screen
        name="LogMeal"
        component={LogMealScreen}
        options={{ title: 'Add Meal' }}
      />
    </Stack.Navigator>
  );
}
