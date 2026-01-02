import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme, TouchableOpacity, View, StyleSheet } from 'react-native';
import DashboardScreen from '../screens/main/DashboardScreen';
import ChatLogMealScreen from '../screens/main/ChatLogMealScreen';
import SocialFeedScreen from '../screens/main/SocialFeedScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import InsightsScreen from '../screens/main/InsightsScreen';
import BodyMetricsScreen from '../screens/main/BodyMetricsScreen';
import WeightTrackingScreen from '../screens/main/WeightTrackingScreen';
import { IconButton, Icon, FAB, Text } from 'react-native-paper';
import { authService } from '../services/firebase';
import { useSelectedDate } from '../context/DateContext';
import { useLocalization } from '../localization/i18n';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function DashboardStack() {
  const { t } = useLocalization();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DashboardMain"
        component={DashboardScreen}
        options={{
          title: t('nav.myMeals'),
          headerShown: true,
          headerStyle: { backgroundColor: '#FFFFFF', elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }
        }}
      />
      <Stack.Screen
        name="LogMeal"
        component={ChatLogMealScreen}
        options={({ navigation }) => ({
          title: t('nav.chatWithAi'),
          headerBackTitle: t('nav.back'),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ marginRight: 8 }}
            >
              <Icon source="close" size={24} color="#64748B" />
            </TouchableOpacity>
          )
        })}
      />
    </Stack.Navigator>
  );
}

function SharedMealsStack() {
  const { t } = useLocalization();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SharedMealsMain"
        component={SocialFeedScreen}
        options={{
          title: t('nav.feed'),
          headerShown: true,
          headerStyle: { backgroundColor: '#FFFFFF', elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }
        }}
      />
    </Stack.Navigator>
  );
}

function InsightsStack() {
  const { t } = useLocalization();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="InsightsMain"
        component={InsightsScreen}
        options={{
          title: t('nav.myGoals'),
          headerShown: false
        }}
      />
      <Stack.Screen
        name="BodyMetrics"
        component={BodyMetricsScreen}
        options={{
          title: t('nav.bodyMetrics'),
          headerBackTitle: t('nav.back')
        }}
      />
      <Stack.Screen
        name="WeightTracking"
        component={WeightTrackingScreen}
        options={{
          title: t('nav.weightTracking'),
          headerBackTitle: t('nav.back')
        }}
      />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  const { t } = useLocalization();
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
          title: t('nav.profile'),
          headerRight: () => (
            <IconButton
              icon="logout"
              onPress={handleLogout}
            />
          )
        }}
      />
      <Stack.Screen
        name="BodyMetrics"
        component={BodyMetricsScreen}
        options={{
          title: t('nav.bodyMetrics'),
          headerBackTitle: t('nav.back')
        }}
      />
    </Stack.Navigator>
  );
}

// Custom Tab Button for central "Log Meal" button
function CustomTabBarButton({ children, onPress }) {
  return (
    <TouchableOpacity
      style={styles.customButtonContainer}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.customButton}>
        {children}
      </View>
    </TouchableOpacity>
  );
}

export default function MainNavigator() {
  const insets = useSafeAreaInsets();
  const { selectedDate } = useSelectedDate();
  const { t } = useLocalization();
  // Force light mode - dark mode not fully implemented
  const isDark = false;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: isDark ? '#64748B' : '#94A3B8',
        tabBarStyle: {
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: isDark ? '#334155' : '#E2E8F0',
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
          tabBarLabel: t('nav.myMeals'),
          tabBarIcon: ({ color, size }) => (
            <Icon source="food" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsStack}
        options={{
          tabBarLabel: t('nav.myGoals'),
          tabBarIcon: ({ color, size }) => (
            <Icon source="chart-line" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="LogMealTab"
        component={DashboardStack}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('Dashboard', {
              screen: 'LogMeal',
              params: { selectedDate: selectedDate.toISOString() }
            });
          },
        })}
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => (
            <Icon source="plus" size={32} color="#FFFFFF" />
          ),
          tabBarButton: (props) => (
            <CustomTabBarButton {...props} />
          ),
        }}
      />
      <Tab.Screen
        name="SharedMeals"
        component={SharedMealsStack}
        options={{
          tabBarLabel: t('nav.feed'),
          tabBarIcon: ({ color, size }) => (
            <Icon source="earth" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarLabel: t('nav.profile'),
          tabBarIcon: ({ color, size }) => (
            <Icon source="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  customButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1
  },
  customButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  }
});
