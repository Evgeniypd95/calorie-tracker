import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Platform } from 'react-native';
import { Text, FAB, Card, Surface, IconButton } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { mealService, userService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { shouldShowCheckIn, getCheckInQuestions, calculateTargetAdjustment, getNextCheckInDate } from '../../services/checkInService';
import CheckInModal from '../../components/CheckInModal';

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
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meals, setMeals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const calendarRef = useRef(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInInfo, setCheckInInfo] = useState(null);

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

      // Check if user needs check-in
      if (userProfile) {
        const checkIn = shouldShowCheckIn(userProfile);
        if (checkIn) {
          const questions = getCheckInQuestions(checkIn.type);
          setCheckInInfo({ ...checkIn, ...questions });
          setShowCheckInModal(true);
        }
      }
    }, [selectedDate, userProfile])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMeals();
    setRefreshing(false);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleCheckInComplete = async (feedback) => {
    try {
      const { newTarget, adjustment, reason } = calculateTargetAdjustment(
        userProfile.dailyCalorieTarget,
        feedback,
        checkInInfo.type,
        userProfile.goal
      );

      const nextCheckIn = getNextCheckInDate(checkInInfo.type);

      await userService.updateUserProfile(user.uid, {
        dailyCalorieTarget: newTarget,
        nextCheckInDate: nextCheckIn,
        checkInHistory: [
          ...(userProfile.checkInHistory || []),
          {
            type: checkInInfo.type,
            feedback,
            oldTarget: userProfile.dailyCalorieTarget,
            newTarget,
            adjustment,
            date: new Date()
          }
        ]
      });

      await refreshUserProfile();
      setShowCheckInModal(false);

      // Show success message with adjustment
      if (adjustment !== 0) {
        if (Platform.OS === 'web') {
          window.alert(`Target Updated!\n\n${reason}\n\nNew daily target: ${newTarget} calories`);
        } else {
          Alert.alert('Target Updated!', `${reason}\n\nNew daily target: ${newTarget} calories`);
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert('Great! We\'ll keep your current target.');
        } else {
          Alert.alert('Perfect!', 'We\'ll keep your current target.');
        }
      }
    } catch (error) {
      console.error('Error updating check-in:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to update target');
      } else {
        Alert.alert('Error', 'Failed to update target');
      }
    }
  };

  const handleCheckInSkip = async () => {
    try {
      // Postpone by 1 day
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await userService.updateUserProfile(user.uid, {
        nextCheckInDate: tomorrow
      });

      await refreshUserProfile();
      setShowCheckInModal(false);
    } catch (error) {
      console.error('Error skipping check-in:', error);
      setShowCheckInModal(false);
    }
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

  // Auto-scroll calendar ribbon to today on first render
  useEffect(() => {
    const indexOfToday = days.findIndex((d) => isSameDay(d, new Date()));
    // Approximate width of an item including margins
    const ITEM_WIDTH = 72; // minWidth(60) + padding/margins
    if (calendarRef.current && indexOfToday >= 0) {
      // Delay slightly to ensure layout is measured
      setTimeout(() => {
        calendarRef.current.scrollTo({ x: Math.max(0, (indexOfToday - 2) * ITEM_WIDTH), animated: true });
      }, 0);
    }
  }, []);

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
                      <View style={[styles.macroIcon, { backgroundColor: '#EF4444' }]} />
                      <View>
                        <Text variant="bodySmall" style={styles.macroLabel}>Protein</Text>
                        <Text variant="titleMedium" style={styles.macroValue}>
                          {Math.round(totals.protein)}g
                        </Text>
                      </View>
                    </View>

                    <View style={styles.macroItem}>
                      <View style={[styles.macroIcon, { backgroundColor: '#10B981' }]} />
                      <View>
                        <Text variant="bodySmall" style={styles.macroLabel}>Carbs</Text>
                        <Text variant="titleMedium" style={styles.macroValue}>
                          {Math.round(totals.carbs)}g
                        </Text>
                      </View>
                    </View>

                    <View style={styles.macroItem}>
                      <View style={[styles.macroIcon, { backgroundColor: '#F59E0B' }]} />
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
                      iconColor="#EF4444"
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
        color="#FFFFFF"
        onPress={() => navigation.navigate('LogMeal', { selectedDate: selectedDate.toISOString() })}
      />

      {/* Check-in Modal */}
      <CheckInModal
        visible={showCheckInModal}
        checkInData={checkInInfo}
        onComplete={handleCheckInComplete}
        onSkip={handleCheckInSkip}
      />
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
  // Metrics Card Styles
  metricsCard: {
    margin: 20,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  metricsTitle: {
    marginBottom: 20,
    fontWeight: '700',
    color: '#1E293B',
    fontSize: 20,
    letterSpacing: -0.5
  },
  caloriesSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  caloriesNumber: {
    fontSize: 72,
    fontWeight: '800',
    color: '#6366F1',
    width: '100%',
    textAlign: 'center',
    minHeight: 80,
    letterSpacing: -2
  },
  caloriesLabel: {
    color: '#64748B',
    marginTop: 8,
    fontSize: 15,
    fontWeight: '500'
  },
  macrosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
    paddingBottom: 8
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  macroIcon: {
    width: 4,
    height: 48,
    borderRadius: 2
  },
  macroLabel: {
    color: '#94A3B8',
    marginBottom: 4,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  macroValue: {
    fontWeight: '700',
    color: '#1E293B',
    fontSize: 18
  },
  // Meals Section Styles
  mealsSection: {
    paddingHorizontal: 20
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
  },
  fab: {
    position: 'absolute',
    margin: 20,
    right: 0,
    bottom: 0,
    backgroundColor: '#6366F1',
    ...Platform.select({
      web: {
        boxShadow: '0px 8px 24px rgba(99, 102, 241, 0.4)',
      },
    }),
  }
});
