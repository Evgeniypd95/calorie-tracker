import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Platform, Animated, useColorScheme } from 'react-native';
import { Text, FAB, Card, Surface, IconButton, Portal, Modal, TextInput as PaperTextInput, Button, Menu, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { mealService, userService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSelectedDate } from '../../context/DateContext';
import { shouldShowCheckIn, getCheckInQuestions, calculateTargetAdjustment, getNextCheckInDate } from '../../services/checkInService';
import CheckInModal from '../../components/CheckInModal';
import { generateSuggestionsBackend } from '../../services/geminiService';
import MealGradeCard from '../../components/MealGradeCard';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import Svg, { Circle } from 'react-native-svg';

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

// Circular progress component
const CircularProgress = ({ current, target, color, size = 80, strokeWidth = 4 }) => {
  const percentage = Math.min((current / target) * 100, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (percentage / 100) * circumference;

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      {/* Background circle */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#E2E8F0"
        strokeWidth={strokeWidth}
        fill="transparent"
      />
      {/* Progress circle */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
      />
    </Svg>
  );
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
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const [meals, setMeals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const calendarRef = useRef(null);
  const confettiRef = useRef(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInInfo, setCheckInInfo] = useState(null);
  const [editingMeal, setEditingMeal] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState(new Date());
  const [editMode, setEditMode] = useState('description'); // 'description' or 'date'
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState([]);
  const [showGoalConfetti, setShowGoalConfetti] = useState(false);

  const loadMeals = async (date = selectedDate) => {
    try {
      const dayMeals = await mealService.getMealsByDate(user.uid, date);

      // Sort meals: first by meal type order, then by date (most recent first within each type)
      const mealTypeOrder = { 'Breakfast': 1, 'Lunch': 2, 'Dinner': 3, 'Snack': 4 };
      const sortedMeals = dayMeals.sort((a, b) => {
        // First sort by meal type
        const typeOrderA = mealTypeOrder[a.mealType] || 999;
        const typeOrderB = mealTypeOrder[b.mealType] || 999;

        if (typeOrderA !== typeOrderB) {
          return typeOrderA - typeOrderB;
        }

        // Within same type, sort by date (most recent first)
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB - dateA; // Most recent first
      });

      setMeals(sortedMeals);

      // Generate smart suggestions
      if (dayMeals.length > 0) {
        generateSmartSuggestions(dayMeals);
      }

      // Check if goal hit and trigger confetti
      if (userProfile?.dailyCalorieTarget && dayMeals.length > 0) {
        const totals = dayMeals.reduce((acc, meal) => ({
          calories: acc.calories + (meal.totals?.calories || 0)
        }), { calories: 0 });

        // Hit goal within 50 calories
        if (Math.abs(totals.calories - userProfile.dailyCalorieTarget) <= 50 && !showGoalConfetti) {
          setShowGoalConfetti(true);
          if (confettiRef.current) {
            confettiRef.current.start();
          }
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      }
    } catch (error) {
      console.error('Error loading meals:', error);
    }
  };

  // Generate smart meal suggestions based on patterns
  const generateSmartSuggestions = async (currentMeals) => {
    try {
      // Only generate suggestions if user has completed onboarding
      if (!userProfile || !userProfile.onboardingCompleted) {
        console.log('[SmartSuggestions] User has not completed onboarding');
        setSmartSuggestions([]);
        return;
      }

      console.log('[SmartSuggestions] Calling backend to generate suggestions');
      const result = await generateSuggestionsBackend(user.uid, userProfile);

      if (result.reason === 'insufficient_data') {
        console.log(`[SmartSuggestions] Not enough data: ${result.daysWithData} days (need 10+)`);
        setSmartSuggestions([]);
        return;
      }

      if (result.reason === 'index_needed') {
        console.log('[SmartSuggestions] Firestore index needed - skipping suggestions');
        setSmartSuggestions([]);
        return;
      }

      console.log('[SmartSuggestions] Received suggestions from backend:', result.suggestions);
      setSmartSuggestions(result.suggestions || []);
    } catch (error) {
      console.error('[SmartSuggestions] Error generating suggestions:', error);
      // Silently fail - suggestions are optional
      setSmartSuggestions([]);
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
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedDate(date);
    setShowGoalConfetti(false); // Reset confetti for new date
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
    const mealDate = meal.date?.toDate ? meal.date.toDate() : new Date(meal.date);
    setEditDate(mealDate);
    setEditMode('description');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    try {
      if (editMode === 'description') {
        // Re-parse the edited description
        navigation.navigate('LogMeal', {
          editingMeal: { ...editingMeal, description: editDescription },
          reparse: true
        });
        setEditModalVisible(false);
      } else if (editMode === 'date') {
        // Update only the date
        await mealService.updateMeal(editingMeal.id, { date: editDate });
        setEditModalVisible(false);
        await loadMeals();

        if (Platform.OS === 'web') {
          window.alert('Meal date updated successfully!');
        } else {
          Alert.alert('Success', 'Meal date updated successfully!');
        }
      }
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

  // Calculate weekly logs from actual data
  const [weeklyMealsData, setWeeklyMealsData] = useState([]);

  useEffect(() => {
    const loadWeeklyData = async () => {
      if (!user) return;

      // Get last 7 days
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date);
      }

      // Get meals for each day
      const allMeals = await mealService.getUserMeals(user.uid, 7);

      const daysWithMeals = last7Days.map(date => {
        const dayMeals = allMeals.filter(meal => {
          const mealDate = meal.date?.toDate?.() || new Date(meal.date);
          return (
            mealDate.getDate() === date.getDate() &&
            mealDate.getMonth() === date.getMonth() &&
            mealDate.getFullYear() === date.getFullYear()
          );
        });
        return dayMeals.length > 0;
      });

      setWeeklyMealsData(daysWithMeals);
    };

    loadWeeklyData();
  }, [user, meals]); // Recalculate when meals change

  const weeklyLogs = weeklyMealsData.filter(Boolean).length;
  const currentStreak = userProfile?.streakCount || 0;

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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Confetti for hitting goals */}
      {showGoalConfetti && (
        <ConfettiCannon
          count={200}
          origin={{x: -10, y: 0}}
          autoStart={false}
          ref={confettiRef}
          fadeOut={true}
        />
      )}

      {/* Calendar Ribbon */}
      <Surface style={[styles.calendarRibbon, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outline }]} elevation={2}>
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
        {/* Quick Action Shortcuts */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('LogMeal', { action: 'type', selectedDate: selectedDate.toISOString() })}
          >
            <IconButton icon="keyboard" size={24} iconColor="#6366F1" style={styles.quickActionIcon} />
            <Text style={styles.quickActionText}>Type</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('LogMeal', { action: 'scan', selectedDate: selectedDate.toISOString() })}
          >
            <IconButton icon="barcode-scan" size={24} iconColor="#6366F1" style={styles.quickActionIcon} />
            <Text style={styles.quickActionText}>Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('LogMeal', { action: 'photo', selectedDate: selectedDate.toISOString() })}
          >
            <IconButton icon="camera" size={24} iconColor="#6366F1" style={styles.quickActionIcon} />
            <Text style={styles.quickActionText}>Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('LogMeal', { action: 'voice', selectedDate: selectedDate.toISOString() })}
          >
            <IconButton icon="microphone" size={24} iconColor="#6366F1" style={styles.quickActionIcon} />
            <Text style={styles.quickActionText}>Say It</Text>
          </TouchableOpacity>
        </View>

        {/* Smart Suggestions */}
        {smartSuggestions.length > 0 && smartSuggestions.map((suggestion, index) => (
          <Card key={index} style={styles.suggestionCard} elevation={1}>
            <Card.Content>
              <View style={styles.suggestionHeader}>
                <Text variant="titleSmall" style={styles.suggestionTitle}>
                  {suggestion.icon} {suggestion.title}
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.suggestionText}>
                {suggestion.description}
              </Text>
              {suggestion.actionable && (
                <Text variant="bodySmall" style={styles.suggestionActionable}>
                  💡 {suggestion.actionable}
                </Text>
              )}
            </Card.Content>
          </Card>
        ))}

        {/* Hero Progress Card */}
        <Card style={styles.heroCard} elevation={3}>
          <Card.Content>
            {/* Compact Calorie Display */}
            <View style={styles.compactCalorieRow}>
              <Text style={styles.compactCalorieText}>
                <Text style={styles.compactCalorieValue}>{totals.calories}</Text>
                <Text style={styles.compactCalorieTarget}> / {calorieTarget} cal</Text>
              </Text>
              <Text style={styles.compactCalorieRemaining}>
                {calorieTarget - totals.calories > 0
                  ? `${calorieTarget - totals.calories} left`
                  : `${totals.calories - calorieTarget} over`
                }
              </Text>
            </View>

            {/* Macro Progress Circles */}
            <View style={styles.macroProgressSection}>
              <View style={styles.macroCircle}>
                <View style={styles.macroCircleOuter}>
                  <CircularProgress
                    current={totals.protein}
                    target={proteinTarget}
                    color="#EF4444"
                    size={80}
                    strokeWidth={6}
                  />
                  <View style={styles.macroCircleInner}>
                    <Text style={[styles.macroCircleValue, { color: '#EF4444' }]}>{Math.round(totals.protein)}</Text>
                    <Text style={styles.macroCircleTarget}>/{proteinTarget}g</Text>
                  </View>
                </View>
                <Text style={styles.macroCircleLabel}>Protein</Text>
              </View>

              <View style={styles.macroCircle}>
                <View style={styles.macroCircleOuter}>
                  <CircularProgress
                    current={totals.carbs}
                    target={carbsTarget}
                    color="#10B981"
                    size={80}
                    strokeWidth={6}
                  />
                  <View style={styles.macroCircleInner}>
                    <Text style={[styles.macroCircleValue, { color: '#10B981' }]}>{Math.round(totals.carbs)}</Text>
                    <Text style={styles.macroCircleTarget}>/{carbsTarget}g</Text>
                  </View>
                </View>
                <Text style={styles.macroCircleLabel}>Carbs</Text>
              </View>

              <View style={styles.macroCircle}>
                <View style={styles.macroCircleOuter}>
                  <CircularProgress
                    current={totals.fat}
                    target={fatTarget}
                    color="#F59E0B"
                    size={80}
                    strokeWidth={6}
                  />
                  <View style={styles.macroCircleInner}>
                    <Text style={[styles.macroCircleValue, { color: '#F59E0B' }]}>{Math.round(totals.fat)}</Text>
                    <Text style={styles.macroCircleTarget}>/{fatTarget}g</Text>
                  </View>
                </View>
                <Text style={styles.macroCircleLabel}>Fat</Text>
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
            <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content style={styles.emptyContent}>
                <Text style={styles.emptyIcon}>🍽️</Text>
                <Text variant="titleLarge" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                  No meals today
                </Text>
                <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                  Time to fuel up! Start tracking your nutrition.
                </Text>
                <Button
                  mode="contained"
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                    navigation.navigate('LogMeal', { selectedDate: selectedDate.toISOString() });
                  }}
                  style={styles.emptyButton}
                  icon="plus"
                >
                  Log your first meal
                </Button>
              </Card.Content>
            </Card>
          ) : (
            meals.map((meal) => {
              // Use gradeData stored in the meal document from backend
              const gradeData = meal.gradeData || null;

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

                        {/* Calories and Macros - Show first */}
                        <View style={styles.nutrientsContainer}>
                          <View style={styles.nutrientItem}>
                            <Text variant="labelSmall" style={styles.nutrientLabel}>
                              CALORIES
                            </Text>
                            <Text variant="titleLarge" style={styles.caloriesValue}>
                              {meal.totals.calories}
                            </Text>
                          </View>
                          <View style={styles.nutrientItem}>
                            <Text variant="labelSmall" style={styles.nutrientLabel}>
                              PROTEIN
                            </Text>
                            <Text variant="titleMedium" style={styles.macroValue}>{Math.round(meal.totals.protein)}g</Text>
                          </View>
                          <View style={styles.nutrientItem}>
                            <Text variant="labelSmall" style={styles.nutrientLabel}>
                              CARBS
                            </Text>
                            <Text variant="titleMedium" style={styles.macroValue}>{Math.round(meal.totals.carbs)}g</Text>
                          </View>
                          <View style={styles.nutrientItem}>
                            <Text variant="labelSmall" style={styles.nutrientLabel}>
                              FAT
                            </Text>
                            <Text variant="titleMedium" style={styles.macroValue}>{Math.round(meal.totals.fat)}g</Text>
                          </View>
                        </View>

                        {/* Show grade card AFTER calories/macros */}
                        {gradeData && (
                          <View style={styles.gradeCardContainer}>
                            <MealGradeCard gradeData={gradeData} compact />
                          </View>
                        )}
                      </Card.Content>
                    </Card>
                  </TouchableOpacity>
                </Swipeable>
              );
            })
          )}
        </View>

        {/* Bottom padding */}
        <View style={{ height: 20 }} />
      </ScrollView>

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

          {/* Mode Toggle */}
          <View style={styles.editModeToggle}>
            <Button
              mode={editMode === 'description' ? 'contained' : 'outlined'}
              onPress={() => setEditMode('description')}
              style={styles.editModeButton}
              compact
            >
              Description
            </Button>
            <Button
              mode={editMode === 'date' ? 'contained' : 'outlined'}
              onPress={() => setEditMode('date')}
              style={styles.editModeButton}
              compact
            >
              Date
            </Button>
          </View>

          {/* Content based on mode */}
          {editMode === 'description' ? (
            <PaperTextInput
              label="Description"
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
              numberOfLines={4}
              mode="outlined"
              style={styles.editInput}
            />
          ) : (
            <View style={styles.datePickerContainer}>
              <Text variant="bodyMedium" style={styles.datePickerLabel}>
                Select new date for this meal:
              </Text>
              <View style={styles.datePickerButtons}>
                {[-2, -1, 0, 1, 2].map((offset) => {
                  const date = new Date(editDate);
                  date.setDate(date.getDate() + offset);
                  const isSelected = isSameDay(date, editDate);
                  const { day: dayName, date: dayNum } = formatDate(date);
                  const isToday = isSameDay(date, new Date());

                  return (
                    <TouchableOpacity
                      key={offset}
                      style={[
                        styles.datePickerButton,
                        isSelected && styles.datePickerButtonSelected
                      ]}
                      onPress={() => setEditDate(date)}
                    >
                      <Text style={[
                        styles.datePickerDayName,
                        isSelected && styles.datePickerDayNameSelected
                      ]}>
                        {dayName}
                      </Text>
                      <Text style={[
                        styles.datePickerDayNum,
                        isSelected && styles.datePickerDayNumSelected,
                        isToday && !isSelected && styles.datePickerToday
                      ]}>
                        {dayNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.editModalActions}>
            <Button mode="outlined" onPress={() => setEditModalVisible(false)}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleSaveEdit}>
              {editMode === 'description' ? 'Re-parse & Save' : 'Update Date'}
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
  // Quick Actions Styles
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 8,
    gap: 12
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
      },
    }),
  },
  quickActionIcon: {
    margin: 0,
    padding: 0
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4
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
  suggestionActionable: {
    color: '#0369A1',
    marginTop: 8,
    lineHeight: 18,
    fontStyle: 'italic'
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
  // Compact Calorie Display Styles
  compactCalorieRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  compactCalorieText: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  compactCalorieValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: -1
  },
  compactCalorieTarget: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8'
  },
  compactCalorieRemaining: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  macroProgressSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8
  },
  macroCircle: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  macroCircleOuter: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative'
  },
  macroCircleInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center'
  },
  macroCircleValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  macroCircleTarget: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: -2
  },
  macroCircleLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
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
    borderRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
      },
    }),
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16
  },
  emptyTitle: {
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24
  },
  emptyButton: {
    paddingHorizontal: 24
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
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  nutrientItem: {
    alignItems: 'center',
    flex: 1
  },
  nutrientLabel: {
    color: '#64748B',
    marginBottom: 4,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  caloriesValue: {
    color: '#6366F1',
    fontWeight: '800',
    fontSize: 28
  },
  macroValue: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 20
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
  editModeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20
  },
  editModeButton: {
    flex: 1
  },
  datePickerContainer: {
    marginBottom: 20
  },
  datePickerLabel: {
    color: '#64748B',
    marginBottom: 12,
    fontSize: 14
  },
  datePickerButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between'
  },
  datePickerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  datePickerButtonSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1'
  },
  datePickerDayName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  datePickerDayNameSelected: {
    color: '#FFFFFF'
  },
  datePickerDayNum: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B'
  },
  datePickerDayNumSelected: {
    color: '#FFFFFF'
  },
  datePickerToday: {
    color: '#6366F1'
  }
});
