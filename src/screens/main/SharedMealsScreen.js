import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Card, FAB, IconButton, Surface } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { socialService } from '../../services/firebase';

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

export default function SharedMealsScreen({ navigation }) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sharedMeals, setSharedMeals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadSharedMeals = async (date = selectedDate) => {
    try {
      const meals = await socialService.getFollowingMeals(user.uid, date);
      setSharedMeals(meals);
    } catch (error) {
      console.error('Error loading shared meals:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSharedMeals();
    }, [selectedDate])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSharedMeals();
    setRefreshing(false);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleCopyMeal = (meal) => {
    const confirmMessage = `Copy "${meal.description.substring(0, 50)}${meal.description.length > 50 ? '...' : ''}" from ${meal.userName}?`;

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        copyMeal(meal);
      }
    } else {
      Alert.alert(
        'Copy Meal',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Copy',
            onPress: () => copyMeal(meal)
          }
        ]
      );
    }
  };

  const copyMeal = async (meal) => {
    try {
      await socialService.copyMealToUser(user.uid, meal);
      showAlert('Success', 'Meal copied to your log!');
    } catch (error) {
      console.error('Error copying meal:', error);
      showAlert('Error', 'Failed to copy meal');
    }
  };

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

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
        {/* Shared Meals Section */}
        <View style={styles.mealsSection}>
          {sharedMeals.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Card.Content>
                <Text style={styles.emptyText}>
                  No meals from your connections on this day. Add connections in your profile to see their meals!
                </Text>
              </Card.Content>
            </Card>
          ) : (
            sharedMeals.map((meal) => (
              <Card key={meal.id} style={styles.mealCard} elevation={1}>
                <Card.Content>
                  <View style={styles.mealHeader}>
                    <View style={styles.mealHeaderLeft}>
                      <Text variant="bodySmall" style={styles.userNameText}>
                        {meal.userName}
                      </Text>
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
                      icon="content-copy"
                      size={20}
                      iconColor="#2196F3"
                      onPress={() => handleCopyMeal(meal)}
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

        {/* Bottom padding */}
        <View style={{ height: 80 }} />
      </ScrollView>
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
  // Meals Section Styles
  mealsSection: {
    paddingHorizontal: 16,
    paddingTop: 16
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
  userNameText: {
    color: '#2196F3',
    fontWeight: 'bold',
    marginBottom: 4
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
  }
});
