import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DashboardScreen from '../screens/main/DashboardScreen';
import ChatLogMealScreen from '../screens/main/ChatLogMealScreen';
import SocialFeedScreen from '../screens/main/SocialFeedScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import InsightsScreen from '../screens/main/InsightsScreen';
import BodyMetricsScreen from '../screens/main/BodyMetricsScreen';
import WeightTrackingScreen from '../screens/main/WeightTrackingScreen';
import { Icon } from 'react-native-paper';
import { useSelectedDate } from '../context/DateContext';
import { useLocalization } from '../localization/i18n';
import { colors, gradients, shadows } from '../theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const headerStyle = {
  backgroundColor: colors.surface,
  elevation: 0,
  shadowOpacity: 0,
  borderBottomWidth: 0
};

const headerTitleStyle = {
  fontWeight: '800',
  fontSize: 18,
  letterSpacing: -0.4,
  color: colors.ink
};

const stackScreenOptions = {
  headerStyle,
  headerTitleStyle,
  headerTintColor: colors.primary,
  headerBackTitleStyle: { fontSize: 15 }
};

function DashboardStack() {
  const { t } = useLocalization();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="DashboardMain"
        component={DashboardScreen}
        options={{ title: t('nav.myMeals') }}
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
              style={{ marginRight: 12 }}
            >
              <Icon source="close" size={24} color={colors.muted} />
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
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="SharedMealsMain"
        component={SocialFeedScreen}
        options={{ title: t('nav.feed') }}
      />
    </Stack.Navigator>
  );
}

function InsightsStack() {
  const { t } = useLocalization();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="InsightsMain"
        component={InsightsScreen}
        options={{ title: t('nav.myGoals'), headerShown: false }}
      />
      <Stack.Screen
        name="BodyMetrics"
        component={BodyMetricsScreen}
        options={{ title: t('nav.bodyMetrics'), headerBackTitle: t('nav.back') }}
      />
      <Stack.Screen
        name="WeightTracking"
        component={WeightTrackingScreen}
        options={{ title: t('nav.weightTracking'), headerBackTitle: t('nav.back') }}
      />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  const { t } = useLocalization();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ title: t('nav.profile') }}
      />
      <Stack.Screen
        name="BodyMetrics"
        component={BodyMetricsScreen}
        options={{ title: t('nav.bodyMetrics'), headerBackTitle: t('nav.back') }}
      />
    </Stack.Navigator>
  );
}

// Raised gradient center "log meal" button
function CustomTabBarButton({ children, onPress }) {
  return (
    <TouchableOpacity
      style={styles.customButtonContainer}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.customButton}
      >
        {children}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function MainNavigator() {
  const insets = useSafeAreaInsets();
  const { selectedDate } = useSelectedDate();
  const { t } = useLocalization();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600'
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          paddingTop: 8,
          paddingBottom: Math.max(8, insets.bottom),
          height: 64 + Math.max(0, insets.bottom - 8),
          ...shadows.raised
        }
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStack}
        options={{
          tabBarLabel: t('nav.myMeals'),
          tabBarIcon: ({ color, size, focused }) => (
            <Icon source={focused ? 'food' : 'food-outline'} size={size} color={color} />
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
          tabBarIcon: () => (
            <Icon source="plus" size={30} color="#FFFFFF" />
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
          tabBarIcon: ({ color, size, focused }) => (
            <Icon source={focused ? 'account-group' : 'account-group-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarLabel: t('nav.profile'),
          tabBarIcon: ({ color, size, focused }) => (
            <Icon source={focused ? 'account-circle' : 'account-circle-outline'} size={size} color={color} />
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
    flex: 1,
    top: -14
  },
  customButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.glow
  }
});
