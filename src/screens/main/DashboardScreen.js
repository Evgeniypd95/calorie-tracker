import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Platform, Animated } from 'react-native';
import { Text, FAB, Card, Surface, IconButton, Portal, Modal, TextInput as PaperTextInput, Button, Menu } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { mealService, userService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { shouldShowCheckIn, getCheckInQuestions, calculateTargetAdjustment, getNextCheckInDate } from '../../services/checkInService';
import CheckInModal from '../../components/CheckInModal';
import { scoreMeal } from '../../services/mealScoringService';
import MealGradeCard from '../../components/MealGradeCard';
import { Swipeable } from 'react-native-gesture-handler';

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

// Progress bar component
const ProgressBar = ({ current, target, color, label }) => {
  const percentage = Math.min((current / target) * 100, 100);
  const isOver = current > target;
  const isNear = percentage >= 90 && !isOver;

  let barColor = color;
  if (isOver) barColor = '#EF4444'; // Red
  else if (isNear) barColor = '#F59E0B'; // Yellow
  else barColor = '#10B981'; // Green

  return (
    <View style={styles.progressBarContainer}>
      <View style={styles.progressBarHeader}>
        <Text variant="labelSmall" style={styles.progressLabel}>{label}</Text>
        <Text variant="labelSmall" style={[styles.progressValue, { color: barColor }]}>
          {Math.round(current)} / {Math.round(target)}{label === 'Calories' ? '' : 'g'}
        </Text>
      </View>
      <View style={styles.progressBarTrack}>
        <Animated.View
          style={[
            styles.progressBarFill,
            { width: `${percentage}%`, backgroundColor: barColor }
          ]}
        />
      </View>
      <Text variant="bodySmall" style={styles.progressPercentage}>
        {Math.round(percentage)}%
      </Text>
    </View>
  );
};

export default function DashboardScreen({ navigation }) {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meals, setMeals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const calendarRef = useRef(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInInfo, setCheckInInfo] = useState(null);
  const [editingMeal, setEditingMeal] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState([]);

  const loadMeals = async (date = selectedDate) => {
    try {
      const dayMeals = await mealService.getMealsByDate(user.uid, date);
      setMeals(dayMeals);

      // Generate smart suggestions
      if (dayMeals.length > 0) {
        generateSmartSuggestions(dayMeals);
      }
    } catch (error) {
      console.error('Error loading meals:', error);
    }
  };

  // Generate smart meal suggestions based on patterns
  const generateSmartSuggestions = async (currentMeals) => {
    try {
      const suggestions = [];
      const currentHour = new Date().getHours();

      // Get all user's past meals
      const allMeals = await mealService.getUserMeals(user.uid, 30); // Last 30 days

      // Suggest based on time of day
      if (currentHour >= 6 && currentHour < 11 && !currentMeals.find(m => m.mealType === 'Breakfast')) {
        const breakfasts = allMeals.filter(m => m.mealType === 'Breakfast');
        if (breakfasts.length > 0) {
          const mostCommon = breakfasts[0]; // Simplified - could use frequency analysis
          suggestions.push({
            type: 'time',
            message: `You usually eat ${mostCommon.description.substring(0, 30)}... for breakfast. Log it now?`,
            meal: mostCommon
          });
        }
      }

      // Check protein goal
      const totals = calculateTotals();
      if (userProfile?.proteinTarget && totals.protein < userProfile.proteinTarget * 0.5) {
        const highProteinMeals = allMeals
          .filter(m => m.totals.protein > 30)
          .slice(0, 3);

        if (highProteinMeals.length > 0) {
          suggestions.push({
            type: 'protein',
            message: `You haven't hit your protein goal. Try: ${highProteinMeals[0].description.substring(0, 40)}...`,
            meals: highProteinMeals
          });
        }
      }

      setSmartSuggestions(suggestions);
    } catch (error) {
      console.error('Error generating suggestions:', error);
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
    await refreshUserProfile();
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

  const handleEditMeal = (meal) => {
    setEditingMeal(meal);
    setEditDescription(meal.description);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    try {
      // Re-parse the edited description
      navigation.navigate('LogMeal', {
        editingMeal: { ...editingMeal, description: editDescription },
        reparse: true
      });
      setEditModalVisible(false);
    } catch (error) {
      console.error('Error saving edit:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to save changes');
      } else {
        Alert.alert('Error', 'Failed to save changes');
      }
    }
  };

  const handleDuplicateMeal = async (meal, targetDate) => {
    try {
      await mealService.duplicateMeal(user.uid, meal, targetDate || selectedDate);
      await loadMeals();

      if (Platform.OS === 'web') {
        window.alert('Meal duplicated successfully!');
      } else {
        Alert.alert('Success', 'Meal duplicated successfully!');
      }
    } catch (error) {
      console.error('Error duplicating meal:', error);
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

  // Get targets from user profile
  const calorieTarget = userProfile?.dailyCalorieTarget || 2000;
  const proteinTarget = userProfile?.proteinTarget || 150;
  const carbsTarget = userProfile?.carbsTarget || 200;
  const fatTarget = userProfile?.fatTarget || 65;

  // Streak calculation
  const currentStreak = userProfile?.streakCount || 0;
  const weeklyLogs = 5; // This should come from actual calculation

  // Right swipe actions (duplicate)
  const renderRightActions = (meal) => {
    return (
      <TouchableOpacity
        style={styles.swipeActionDuplicate}
        onPress={() => handleDuplicateMeal(meal)}
      >
        <IconButton icon="content-copy" iconColor="#FFFFFF" size={24} />
        <Text style={styles.swipeActionText}>Duplicate</Text>
      </TouchableOpacity>
    );
  };

  // Left swipe actions (delete)
  const renderLeftActions = (meal) => {
    return (
      <TouchableOpacity
        style={styles.swipeActionDelete}
        onPress={() => handleDeleteMeal(meal.id, meal.description)}
      >
        <IconButton icon="delete" iconColor="#FFFFFF" size={24} />
        <Text style={styles.swipeActionText}>Delete</Text>
      </TouchableOpacity>
    );
  };

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
        {/* Streak & Gamification Card */}
        {currentStreak > 0 && (
          <Card style={styles.streakCard} elevation={2}>
            <Card.Content>
              <View style={styles.streakContainer}>
                <View style={styles.streakLeft}>
                  <Text style={styles.streakEmoji}>🔥</Text>
                  <View>
                    <Text variant="headlineMedium" style={styles.streakNumber}>
                      {currentStreak} days
                    </Text>
                    <Text variant="bodySmall" style={styles.streakLabel}>
                      Current Streak
                    </Text>
                  </View>
                </View>
                <View style={styles.streakRight}>
                  <Text variant="bodySmall" style={styles.weeklyLabel}>
                    This week: {weeklyLogs}/7 days
                  </Text>
                  <View style={styles.weeklyDots}>
                    {[...Array(7)].map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.weeklyDot,
                          i < weeklyLogs && styles.weeklyDotActive
                        ]}
                      />
                    ))}
                  </View>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Smart Suggestions */}
        {smartSuggestions.length > 0 && (
          <Card style={styles.suggestionCard} elevation={1}>
            <Card.Content>
              <View style={styles.suggestionHeader}>
                <Text variant="titleSmall" style={styles.suggestionTitle}>💡 Smart Suggestion</Text>
              </View>
              <Text variant="bodyMedium" style={styles.suggestionText}>
                {smartSuggestions[0].message}
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Hero Progress Card */}
        <Card style={styles.heroCard} elevation={3}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.heroTitle}>
              Today's Progress
            </Text>

            {/* Main Calorie Progress */}
            <View style={styles.heroCaloriesSection}>
              <View style={styles.calorieRing}>
                <Text style={styles.calorieRingNumber}>{totals.calories}</Text>
                <Text style={styles.calorieRingLabel}>/ {calorieTarget}</Text>
              </View>
              <Text variant="bodySmall" style={styles.calorieRingSubtext}>
                {calorieTarget - totals.calories > 0
                  ? `${calorieTarget - totals.calories} cal remaining`
                  : `${totals.calories - calorieTarget} cal over`
                }
              </Text>
            </View>

            {/* Macro Progress Bars */}
            <View style={styles.macroProgressSection}>
              <ProgressBar
                current={totals.protein}
                target={proteinTarget}
                color="#EF4444"
                label="Protein"
              />
              <ProgressBar
                current={totals.carbs}
                target={carbsTarget}
                color="#10B981"
                label="Carbs"
              />
              <ProgressBar
                current={totals.fat}
                target={fatTarget}
                color="#F59E0B"
                label="Fat"
              />
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
            meals.map((meal) => {
              // Calculate meal grade if user has completed onboarding
              const gradeData = userProfile?.onboardingCompleted ? scoreMeal(meal, userProfile) : null;

              return (
                <Swipeable
                  key={meal.id}
                  renderRightActions={() => renderRightActions(meal)}
                  renderLeftActions={() => renderLeftActions(meal)}
                >
                  <TouchableOpacity
                    onLongPress={() => handleEditMeal(meal)}
                    activeOpacity={0.7}
                  >
                    <Card style={styles.mealCard} elevation={1}>
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
                          <View style={styles.mealHeaderRight}>
                            {gradeData && (
                              <View style={[styles.gradeChip, { backgroundColor: gradeData.color }]}>
                                <Text style={styles.gradeText}>{gradeData.grade}</Text>
                              </View>
                            )}
                            <IconButton
                              icon="pencil"
                              size={20}
                              iconColor="#6366F1"
                              onPress={() => handleEditMeal(meal)}
                            />
                          </View>
                        </View>
                        <Text variant="bodyMedium" style={styles.descriptionText}>
                          {meal.description}
                        </Text>

                        {/* Show full grade card if available */}
                        {gradeData && (
                          <View style={styles.gradeCardContainer}>
                            <MealGradeCard gradeData={gradeData} compact />
                          </View>
                        )}

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
                  </TouchableOpacity>
                </Swipeable>
              );
            })
          )}
        </View>

        {/* Bottom padding for FAB */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB with Menu */}
      <FAB
        icon="plus"
        style={styles.fab}
        color="#FFFFFF"
        onPress={() => navigation.navigate('LogMeal', { selectedDate: selectedDate.toISOString() })}
      />

      {/* Edit Meal Modal */}
      <Portal>
        <Modal
          visible={editModalVisible}
          onDismiss={() => setEditModalVisible(false)}
          contentContainerStyle={styles.editModal}
        >
          <Text variant="titleLarge" style={styles.editModalTitle}>
            Edit Meal
          </Text>
          <PaperTextInput
            label="Description"
            value={editDescription}
            onChangeText={setEditDescription}
            multiline
            numberOfLines={4}
            mode="outlined"
            style={styles.editInput}
          />
          <View style={styles.editModalActions}>
            <Button mode="outlined" onPress={() => setEditModalVisible(false)}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleSaveEdit}>
              Re-parse & Save
            </Button>
          </View>
        </Modal>
      </Portal>

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
  // Streak Card Styles
  streakCard: {
    margin: 20,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  streakContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  streakEmoji: {
    fontSize: 48
  },
  streakNumber: {
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: -1
  },
  streakLabel: {
    color: '#64748B',
    marginTop: 4
  },
  streakRight: {
    alignItems: 'flex-end'
  },
  weeklyLabel: {
    color: '#64748B',
    marginBottom: 8
  },
  weeklyDots: {
    flexDirection: 'row',
    gap: 6
  },
  weeklyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0'
  },
  weeklyDotActive: {
    backgroundColor: '#10B981'
  },
  // Suggestion Card
  suggestionCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  suggestionHeader: {
    marginBottom: 8
  },
  suggestionTitle: {
    color: '#0369A1',
    fontWeight: '700'
  },
  suggestionText: {
    color: '#075985',
    lineHeight: 20
  },
  // Hero Card Styles
  heroCard: {
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
  heroTitle: {
    marginBottom: 20,
    fontWeight: '700',
    color: '#1E293B',
    fontSize: 20,
    letterSpacing: -0.5
  },
  heroCaloriesSection: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 24
  },
  calorieRing: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  calorieRingNumber: {
    fontSize: 56,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: -2
  },
  calorieRingLabel: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '600'
  },
  calorieRingSubtext: {
    color: '#64748B',
    fontSize: 13
  },
  macroProgressSection: {
    gap: 16
  },
  // Progress Bar Styles
  progressBarContainer: {
    marginBottom: 8
  },
  progressBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  progressLabel: {
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    fontSize: 11
  },
  progressValue: {
    fontWeight: '700',
    fontSize: 12
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4
  },
  progressPercentage: {
    textAlign: 'right',
    color: '#94A3B8',
    fontSize: 11
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
  mealHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  gradeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  gradeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  gradeCardContainer: {
    marginVertical: 12
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
  // Swipe Actions
  swipeActionDuplicate: {
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    marginBottom: 16,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20
  },
  swipeActionDelete: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    marginBottom: 16,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  // Edit Modal
  editModal: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    margin: 20,
    borderRadius: 24
  },
  editModalTitle: {
    fontWeight: '700',
    marginBottom: 20,
    color: '#1E293B'
  },
  editInput: {
    marginBottom: 20
  },
  editModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12
  },
  // FAB
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
