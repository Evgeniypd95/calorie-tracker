import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DashboardScreen from '../screens/main/DashboardScreen';
import ChatLogMealScreen from '../screens/main/ChatLogMealScreen';
import SocialFeedScreen from '../screens/main/SocialFeedScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import { IconButton, Icon } from 'react-native-paper';
import { authService } from '../services/firebase';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function DashboardStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DashboardMain"
        component={DashboardScreen}
        options={{
          title: 'My Meals',
          headerShown: true,
          headerStyle: { backgroundColor: '#FFFFFF', elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }
        }}
      />
      <Stack.Screen
        name="LogMeal"
        component={ChatLogMealScreen}
        options={{
          title: 'Chat with AI',
          headerBackTitle: 'Back'
        }}
      />
    </Stack.Navigator>
  );
}

function SharedMealsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SharedMealsMain"
        component={SocialFeedScreen}
        options={{
          title: 'Feed',
          headerShown: true,
          headerStyle: { backgroundColor: '#FFFFFF', elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }
        }}
      />
    </Stack.Navigator>
  );
}

function ProfileStack() {
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
        name="ProfileMain"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          headerRight: () => (
            <IconButton
              icon="logout"
              onPress={handleLogout}
            />
          )
        }}
      />
    </Stack.Navigator>
  );
}

export default function MainNavigator() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          paddingTop: 8,
          paddingBottom: Math.max(8, insets.bottom),
          height: 64 + Math.max(0, insets.bottom - 8)
        }
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStack}
        options={{
          tabBarLabel: 'My Meals',
          tabBarIcon: ({ color, size }) => (
            <Icon source="food" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SharedMeals"
        component={SharedMealsStack}
        options={{
          tabBarLabel: 'Feed',
          tabBarIcon: ({ color, size }) => (
            <Icon source="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Icon source="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
