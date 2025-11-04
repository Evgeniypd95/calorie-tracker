import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Platform } from 'react-native';
import { Text, FAB, Card, Surface, IconButton } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { mealService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

// Helper function to get a date range (7 days past, today, 7 days future)
const getDateRange = () => {
  const days = [];
  for (let i = -7; i <= 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    days.push(date);
  }
  return days;
};

// Helper function to format date
const formatDate = (date) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    day: days[date.getDay()],
    date: date.getDate()
  };
};

// Helper function to check if two dates are the same day
const isSameDay = (date1, date2) => {
  return date1.getDate() === date2.getDate() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear();
};

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meals, setMeals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadMeals = async (date = selectedDate) => {
    try {
      const dayMeals = await mealService.getMealsByDate(user.uid, date);
      setMeals(dayMeals);
    } catch (error) {
      console.error('Error loading meals:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMeals();
    }, [selectedDate])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMeals();
    setRefreshing(false);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleDeleteMeal = (mealId, mealDescription) => {
    const confirmDelete = async () => {
      try {
        await mealService.deleteMeal(mealId);
        await loadMeals();
      } catch (error) {
        console.error('Error deleting meal:', error);
        if (Platform.OS === 'web') {
          window.alert('Failed to delete meal');
        } else {
          Alert.alert('Error', 'Failed to delete meal');
        }
      }
    };

    const confirmMessage = mealDescription
      ? `Are you sure you want to delete "${mealDescription.substring(0, 50)}${mealDescription.length > 50 ? '...' : ''}"?`
      : 'Are you sure you want to delete this meal?';

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        'Delete Meal',
        confirmMessage,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: confirmDelete
          }
        ]
      );
    }
  };

  // Calculate totals for the day
  const calculateTotals = () => {
    return meals.reduce((acc, meal) => {
      return {
        calories: acc.calories + (meal.totals?.calories || 0),
        protein: acc.protein + (meal.totals?.protein || 0),
        carbs: acc.carbs + (meal.totals?.carbs || 0),
        fat: acc.fat + (meal.totals?.fat || 0)
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const totals = calculateTotals();
  const days = getDateRange();

  return (
    <View style={styles.container}>
      {/* Calendar Ribbon */}
      <Surface style={styles.calendarRibbon} elevation={2}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.calendarContent}
        >
          {days.map((day, index) => {
            const { day: dayName, date } = formatDate(day);
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateItem,
                  isSelected && styles.dateItemSelected
                ]}
                onPress={() => handleDateSelect(day)}
              >
                <Text
                  variant="labelSmall"
                  style={[
                    styles.dayName,
                    isSelected && styles.dayNameSelected
                  ]}
                >
                  {dayName}
                </Text>
                <Text
                  variant="titleMedium"
                  style={[
                    styles.dateNumber,
                    isSelected && styles.dateNumberSelected,
                    isToday && !isSelected && styles.todayDate
                  ]}
                >
                  {date}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Surface>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Metrics Card */}
        <Card style={styles.metricsCard} elevation={3}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.metricsTitle}>
              Daily Summary
            </Text>

            {/* Calories Section */}
            <View style={styles.caloriesSection}>
              <Text
                style={styles.caloriesNumber}
                adjustsFontSizeToFit
                numberOfLines={1}
                allowFontScaling={false}
              >
                {totals.calories}
              </Text>
              <Text variant="bodyMedium" style={styles.caloriesLabel}>
                calories
              </Text>
            </View>

            {/* Macros Section */}
            <View style={styles.macrosContainer}>
              <View style={styles.macroItem}>
                <View style={[styles.macroIcon, { backgroundColor: '#FF6B6B' }]} />
                <View>
                  <Text variant="bodySmall" style={styles.macroLabel}>Protein</Text>
                  <Text variant="titleMedium" style={styles.macroValue}>
                    {Math.round(totals.protein)}g
                  </Text>
                </View>
              </View>

              <View style={styles.macroItem}>
                <View style={[styles.macroIcon, { backgroundColor: '#4ECDC4' }]} />
                <View>
                  <Text variant="bodySmall" style={styles.macroLabel}>Carbs</Text>
                  <Text variant="titleMedium" style={styles.macroValue}>
                    {Math.round(totals.carbs)}g
                  </Text>
                </View>
              </View>

              <View style={styles.macroItem}>
                <View style={[styles.macroIcon, { backgroundColor: '#FFE66D' }]} />
                <View>
                  <Text variant="bodySmall" style={styles.macroLabel}>Fat</Text>
                  <Text variant="titleMedium" style={styles.macroValue}>
                    {Math.round(totals.fat)}g
                  </Text>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Meals Section */}
        <View style={styles.mealsSection}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Meals
          </Text>

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
              <Card key={meal.id} style={styles.mealCard} elevation={1}>
                <Card.Content>
                  <View style={styles.mealHeader}>
                    <View style={styles.mealHeaderLeft}>
                      <Text variant="titleMedium" style={styles.mealType}>
                        {meal.mealType}
                      </Text>
                      <Text variant="bodySmall" style={styles.timeText}>
                        {meal.date?.toDate?.()?.toLocaleTimeString?.('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </Text>
                    </View>
                    <IconButton
                      icon="delete"
                      size={20}
                      iconColor="#ff4444"
                      onPress={() => handleDeleteMeal(meal.id, meal.description)}
                    />
                  </View>
                  <Text variant="bodyMedium" style={styles.descriptionText}>
                    {meal.description}
                  </Text>
                  <View style={styles.nutrientsContainer}>
                    <View style={styles.nutrientItem}>
                      <Text variant="labelSmall" style={styles.nutrientLabel}>
                        Calories
                      </Text>
                      <Text variant="titleSmall" style={styles.caloriesValue}>
                        {meal.totals.calories}
                      </Text>
                    </View>
                    <View style={styles.nutrientItem}>
                      <Text variant="labelSmall" style={styles.nutrientLabel}>
                        Protein
                      </Text>
                      <Text variant="titleSmall">{Math.round(meal.totals.protein)}g</Text>
                    </View>
                    <View style={styles.nutrientItem}>
                      <Text variant="labelSmall" style={styles.nutrientLabel}>
                        Carbs
                      </Text>
                      <Text variant="titleSmall">{Math.round(meal.totals.carbs)}g</Text>
                    </View>
                    <View style={styles.nutrientItem}>
                      <Text variant="labelSmall" style={styles.nutrientLabel}>
                        Fat
                      </Text>
                      <Text variant="titleSmall">{Math.round(meal.totals.fat)}g</Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))
          )}
        </View>

        {/* Bottom padding for FAB */}
        <View style={{ height: 80 }} />
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('LogMeal', { selectedDate: selectedDate.toISOString() })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  // Calendar Ribbon Styles
  calendarRibbon: {
    backgroundColor: '#fff',
    paddingVertical: 12
  },
  calendarContent: {
    paddingHorizontal: 8
  },
  dateItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 12,
    minWidth: 60
  },
  dateItemSelected: {
    backgroundColor: '#2196F3'
  },
  dayName: {
    color: '#666',
    marginBottom: 4,
    fontWeight: '500'
  },
  dayNameSelected: {
    color: '#fff'
  },
  dateNumber: {
    color: '#333',
    fontWeight: 'bold'
  },
  dateNumberSelected: {
    color: '#fff'
  },
  todayDate: {
    color: '#2196F3'
  },
  // Metrics Card Styles
  metricsCard: {
    margin: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 16
  },
  metricsTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
    color: '#333'
  },
  caloriesSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  caloriesNumber: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#2196F3',
    width: '100%',
    textAlign: 'center',
    minHeight: 70
  },
  caloriesLabel: {
    color: '#666',
    marginTop: 4
  },
  macrosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  macroIcon: {
    width: 8,
    height: 40,
    borderRadius: 4
  },
  macroLabel: {
    color: '#999',
    marginBottom: 2
  },
  macroValue: {
    fontWeight: 'bold',
    color: '#333'
  },
  // Meals Section Styles
  mealsSection: {
    paddingHorizontal: 16
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
    color: '#333'
  },
  emptyCard: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 15
  },
  mealCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  mealHeaderLeft: {
    flex: 1
  },
  mealType: {
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2
  },
  timeText: {
    color: '#999',
    fontSize: 13
  },
  descriptionText: {
    color: '#666',
    marginBottom: 12,
    lineHeight: 20
  },
  nutrientsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0'
  },
  nutrientItem: {
    alignItems: 'center'
  },
  nutrientLabel: {
    color: '#999',
    marginBottom: 4,
    fontSize: 11
  },
  caloriesValue: {
    color: '#2196F3',
    fontWeight: 'bold'
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 12px rgba(33, 150, 243, 0.3)',
      },
    }),
  }
});
