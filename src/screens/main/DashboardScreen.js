import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, FAB, Card, Chip } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { mealService, userService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import ProgressRing from '../../components/ProgressRing';
import MacroBar from '../../components/MacroBar';
import MealCard from '../../components/MealCard';
import { calculateProgress } from '../../services/nutritionCalculator';

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [meals, setMeals] = useState([]);
  const [dailyTotals, setDailyTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const profile = await userService.getUserProfile(user.uid);
      setUserProfile(profile);

      const todaysMeals = await mealService.getTodaysMeals(user.uid);
      setMeals(todaysMeals);

      // Calculate totals
      const totals = todaysMeals.reduce(
        (acc, meal) => ({
          calories: acc.calories + meal.totals.calories,
          protein: acc.protein + meal.totals.protein,
          carbs: acc.carbs + meal.totals.carbs,
          fat: acc.fat + meal.totals.fat
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
      setDailyTotals(totals);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (!userProfile) {
    return <View style={styles.container}><Text>Loading...</Text></View>;
  }

  const calorieProgress = calculateProgress(
    dailyTotals.calories,
    userProfile.dailyBudget.calories
  );
  const proteinProgress = calculateProgress(
    dailyTotals.protein,
    userProfile.dailyBudget.protein
  );
  const carbProgress = calculateProgress(
    dailyTotals.carbs,
    userProfile.dailyBudget.carbs
  );
  const fatProgress = calculateProgress(
    dailyTotals.fat,
    userProfile.dailyBudget.fat
  );

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header with Streak */}
        <View style={styles.header}>
          <Text variant="headlineMedium">Today's Progress</Text>
          <Chip icon="fire" mode="outlined">
            {userProfile.streakCount} day streak
          </Chip>
        </View>

        {/* Calorie Ring */}
        <View style={styles.ringContainer}>
          <ProgressRing
            consumed={dailyTotals.calories}
            target={userProfile.dailyBudget.calories}
            size={200}
            strokeWidth={20}
          />
        </View>

        {/* Macros */}
        <Card style={styles.macrosCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.macrosTitle}>
              Macronutrients
            </Text>
            <MacroBar
              label="Protein"
              consumed={proteinProgress.consumed}
              target={proteinProgress.target}
              unit="g"
              color="#4CAF50"
            />
            <MacroBar
              label="Carbs"
              consumed={carbProgress.consumed}
              target={carbProgress.target}
              unit="g"
              color="#2196F3"
            />
            <MacroBar
              label="Fat"
              consumed={fatProgress.consumed}
              target={fatProgress.target}
              unit="g"
              color="#FF9800"
            />
          </Card.Content>
        </Card>

        {/* Meals */}
        <Text variant="titleLarge" style={styles.mealsTitle}>
          Today's Meals
        </Text>
        {meals.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>
                No meals logged yet. Tap + to log your first meal!
              </Text>
            </Card.Content>
          </Card>
        ) : (
          meals.map((meal) => (
            <MealCard key={meal.id} meal={meal} />
          ))
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('LogMeal')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff'
  },
  ringContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff'
  },
  macrosCard: {
    margin: 16,
    marginTop: 0
  },
  macrosTitle: {
    marginBottom: 16
  },
  mealsTitle: {
    marginLeft: 16,
    marginTop: 8,
    marginBottom: 12
  },
  emptyCard: {
    margin: 16,
    marginTop: 0
  },
  emptyText: {
    textAlign: 'center',
    color: '#666'
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0
  }
});
