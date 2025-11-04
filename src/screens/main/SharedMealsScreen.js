import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Card, FAB, IconButton, Surface, Button } from 'react-native-paper';
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
  const calendarRef = useRef(null);

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
    // Use a fresh Date instance to avoid any reference quirks
    setSelectedDate(new Date(date));
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

  // Auto-scroll to selected/today on mount and when selection changes
  useEffect(() => {
    const index = days.findIndex((d) => isSameDay(d, selectedDate));
    const ITEM_WIDTH = 72;
    if (calendarRef.current && index >= 0) {
      setTimeout(() => {
        calendarRef.current.scrollTo({ x: Math.max(0, (index - 2) * ITEM_WIDTH), animated: true });
      }, 0);
    }
  }, [selectedDate]);

  return (
    <View style={styles.container}>
      {/* Calendar Ribbon */}
      <Surface style={styles.calendarRibbon} elevation={2}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.calendarContent}
          ref={calendarRef}
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
                    <Button
                      mode="outlined"
                      icon="plus"
                      onPress={() => handleCopyMeal(meal)}
                      style={styles.addButton}
                      contentStyle={{ paddingHorizontal: 8 }}
                    >
                      Add to My Day
                    </Button>
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
    backgroundColor: '#F1F5F9'
  },
  // Calendar Ribbon Styles
  calendarRibbon: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  calendarContent: {
    paddingHorizontal: 12
  },
  dateItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 16,
    minWidth: 64,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  dateItemSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 12px rgba(99, 102, 241, 0.3)',
      },
    }),
  },
  dayName: {
    color: '#64748B',
    marginBottom: 6,
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 0.5
  },
  dayNameSelected: {
    color: '#FFFFFF'
  },
  dateNumber: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 18
  },
  dateNumberSelected: {
    color: '#FFFFFF'
  },
  todayDate: {
    color: '#6366F1',
    fontWeight: '700'
  },
  // Meals Section Styles
  mealsSection: {
    paddingHorizontal: 20,
    paddingTop: 20
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '700',
    color: '#1E293B',
    fontSize: 22,
    letterSpacing: -0.5
  },
  emptyCard: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
      },
    }),
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 8
  },
  mealCard: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 12px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  mealHeaderLeft: {
    flex: 1
  },
  userNameText: {
    color: '#6366F1',
    fontWeight: '700',
    marginBottom: 4,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  addButton: {
    borderColor: '#6366F1'
  },
  mealType: {
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
    fontSize: 18,
    letterSpacing: -0.3
  },
  timeText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500'
  },
  descriptionText: {
    color: '#475569',
    marginBottom: 16,
    lineHeight: 22,
    fontSize: 15
  },
  nutrientsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  nutrientItem: {
    alignItems: 'center',
    flex: 1
  },
  nutrientLabel: {
    color: '#94A3B8',
    marginBottom: 6,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  caloriesValue: {
    color: '#6366F1',
    fontWeight: '700',
    fontSize: 16
  }
});
