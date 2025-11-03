import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, FAB, Card } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { mealService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [meals, setMeals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadMeals = async () => {
    try {
      const todaysMeals = await mealService.getTodaysMeals(user.uid);
      setMeals(todaysMeals);
    } catch (error) {
      console.error('Error loading meals:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMeals();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMeals();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text variant="headlineMedium">My Meals</Text>
        </View>

        {meals.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>
                No meals logged yet. Tap + to add your first meal!
              </Text>
            </Card.Content>
          </Card>
        ) : (
          meals.map((meal) => (
            <Card key={meal.id} style={styles.mealCard}>
              <Card.Content>
                <View style={styles.mealHeader}>
                  <Text variant="titleMedium">{meal.mealType}</Text>
                  <Text variant="bodySmall" style={styles.timeText}>
                    {meal.date?.toDate?.()?.toLocaleTimeString?.('en-US', {
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={styles.descriptionText}>
                  {meal.description}
                </Text>
                <View style={styles.nutrientsContainer}>
                  <View style={styles.nutrientItem}>
                    <Text variant="labelSmall" style={styles.nutrientLabel}>
                      Calories
                    </Text>
                    <Text variant="titleMedium" style={styles.caloriesValue}>
                      {meal.totals.calories}
                    </Text>
                  </View>
                  <View style={styles.nutrientItem}>
                    <Text variant="labelSmall" style={styles.nutrientLabel}>
                      Protein
                    </Text>
                    <Text variant="bodyLarge">{meal.totals.protein}g</Text>
                  </View>
                  <View style={styles.nutrientItem}>
                    <Text variant="labelSmall" style={styles.nutrientLabel}>
                      Carbs
                    </Text>
                    <Text variant="bodyLarge">{meal.totals.carbs}g</Text>
                  </View>
                  <View style={styles.nutrientItem}>
                    <Text variant="labelSmall" style={styles.nutrientLabel}>
                      Fat
                    </Text>
                    <Text variant="bodyLarge">{meal.totals.fat}g</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
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
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  emptyCard: {
    margin: 16
  },
  emptyText: {
    textAlign: 'center',
    color: '#666'
  },
  mealCard: {
    margin: 16,
    marginBottom: 8
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  timeText: {
    color: '#666'
  },
  descriptionText: {
    color: '#666',
    marginBottom: 16
  },
  nutrientsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee'
  },
  nutrientItem: {
    alignItems: 'center'
  },
  nutrientLabel: {
    color: '#999',
    marginBottom: 4
  },
  caloriesValue: {
    color: '#2196F3',
    fontWeight: 'bold'
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0
  }
});
