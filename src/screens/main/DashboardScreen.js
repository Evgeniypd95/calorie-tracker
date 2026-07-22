import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Platform, Image } from 'react-native';
import { Text, IconButton, Icon, Portal, Modal, TextInput as PaperTextInput, Button } from 'react-native-paper';
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
import { useLocalization, getDayNameShort, getMealTypeLabel } from '../../localization/i18n';
import { colors, radius, shadows, type } from '../../theme';
import { ProgressRing } from '../../components/ui';
import { getEffectiveStreak } from '../../utils/streak';

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

const formatDate = (date, t) => ({
  day: getDayNameShort(date.getDay(), t),
  date: date.getDate()
});

const isSameDay = (date1, date2) =>
  date1.getDate() === date2.getDate() &&
  date1.getMonth() === date2.getMonth() &&
  date1.getFullYear() === date2.getFullYear();

const MEAL_TYPE_ICONS = {
  Breakfast: 'weather-sunset-up',
  Lunch: 'white-balance-sunny',
  Dinner: 'weather-night',
  Snack: 'food-apple-outline'
};

// Thin labelled macro bar used in the hero card
function MacroBar({ label, current, target, color }) {
  const pct = Math.min((current / target) * 100, 100);
  return (
    <View style={styles.macroBarWrap}>
      <View style={styles.macroBarHeader}>
        <Text style={styles.macroBarLabel}>{label}</Text>
        <Text style={styles.macroBarValue}>
          <Text style={{ color, fontWeight: '800' }}>{Math.round(current)}</Text>
          <Text style={styles.macroBarTarget}> / {target}g</Text>
        </Text>
      </View>
      <View style={styles.macroBarTrack}>
        <View style={[styles.macroBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const { t, localeCode } = useLocalization();
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
  const [smartSuggestions, setSmartSuggestions] = useState([]);
  const [showGoalConfetti, setShowGoalConfetti] = useState(false);

  const loadMeals = async (date = selectedDate) => {
    try {
      const dayMeals = await mealService.getMealsByDate(user.uid, date);

      // Sort meals: first by meal type order, then by date (most recent first within each type)
      const mealTypeOrder = { 'Dinner': 1, 'Lunch': 2, 'Breakfast': 3, 'Snack': 4 };
      const sortedMeals = dayMeals.sort((a, b) => {
        const typeOrderA = mealTypeOrder[a.mealType] || 999;
        const typeOrderB = mealTypeOrder[b.mealType] || 999;
        if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB;

        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB - dateA;
      });

      setMeals(sortedMeals);

      if (dayMeals.length > 0) {
        generateSmartSuggestions(dayMeals);
      }

      // Check if goal hit and trigger confetti
      if (userProfile?.dailyCalorieTarget && dayMeals.length > 0) {
        const totals = dayMeals.reduce((acc, meal) => ({
          calories: acc.calories + (meal.totals?.calories || 0)
        }), { calories: 0 });

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

  const generateSmartSuggestions = async (currentMeals) => {
    try {
      if (!userProfile || !userProfile.onboardingCompleted) {
        setSmartSuggestions([]);
        return;
      }

      const result = await generateSuggestionsBackend(user.uid, userProfile);

      if (result.reason === 'insufficient_data' || result.reason === 'index_needed') {
        setSmartSuggestions([]);
        return;
      }

      setSmartSuggestions(result.suggestions || []);
    } catch (error) {
      console.error('[SmartSuggestions] Error generating suggestions:', error);
      setSmartSuggestions([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMeals();

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
    setShowGoalConfetti(false);
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

      if (adjustment !== 0) {
        if (Platform.OS === 'web') {
          window.alert(t('dashboard.targetUpdatedTitle') + '\n\n' + t('dashboard.targetUpdatedBody', { reason, target: newTarget }));
        } else {
          Alert.alert(t('dashboard.targetUpdatedTitle'), t('dashboard.targetUpdatedBody', { reason, target: newTarget }));
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert(t('dashboard.keepTargetWeb'));
        } else {
          Alert.alert(t('dashboard.targetUpdatedTitle'), t('dashboard.keepTarget'));
        }
      }
    } catch (error) {
      console.error('Error updating check-in:', error);
      if (Platform.OS === 'web') {
        window.alert(t('dashboard.updateTargetFailed'));
      } else {
        Alert.alert(t('common.error'), t('dashboard.updateTargetFailed'));
      }
    }
  };

  const handleCheckInSkip = async () => {
    try {
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
          window.alert(t('dashboard.deleteMealFailed'));
        } else {
          Alert.alert(t('common.error'), t('dashboard.deleteMealFailed'));
        }
      }
    };

    const trimmedName = mealDescription
      ? `${mealDescription.substring(0, 50)}${mealDescription.length > 50 ? '...' : ''}`
      : '';
    const confirmMessage = mealDescription
      ? t('dashboard.deleteMealConfirmWithName', { name: trimmedName })
      : t('dashboard.deleteMealConfirm');

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        t('dashboard.deleteMealTitle'),
        confirmMessage,
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.delete'), style: 'destructive', onPress: confirmDelete }
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
        navigation.navigate('LogMeal', {
          editingMeal: { ...editingMeal, description: editDescription },
          reparse: true
        });
        setEditModalVisible(false);
      } else if (editMode === 'date') {
        await mealService.updateMeal(editingMeal.id, { date: editDate });
        setEditModalVisible(false);
        await loadMeals();

        if (Platform.OS === 'web') {
          window.alert(t('dashboard.mealDateUpdated'));
        } else {
          Alert.alert(t('common.success'), t('dashboard.mealDateUpdated'));
        }
      }
    } catch (error) {
      console.error('Error saving edit:', error);
      if (Platform.OS === 'web') {
        window.alert(t('dashboard.saveChangesFailed'));
      } else {
        Alert.alert(t('common.error'), t('dashboard.saveChangesFailed'));
      }
    }
  };

  const handleDuplicateMeal = async (meal, targetDate) => {
    try {
      await mealService.duplicateMeal(user.uid, meal, targetDate || selectedDate);
      await loadMeals();

      if (Platform.OS === 'web') {
        window.alert(t('dashboard.mealDuplicated'));
      } else {
        Alert.alert(t('common.success'), t('dashboard.mealDuplicated'));
      }
    } catch (error) {
      console.error('Error duplicating meal:', error);
    }
  };

  const calculateTotals = () => {
    return meals.reduce((acc, meal) => ({
      calories: acc.calories + (meal.totals?.calories || 0),
      protein: acc.protein + (meal.totals?.protein || 0),
      carbs: acc.carbs + (meal.totals?.carbs || 0),
      fat: acc.fat + (meal.totals?.fat || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const totals = calculateTotals();
  const days = getDateRange();

  const calorieTarget = userProfile?.dailyCalorieTarget || 2000;
  const proteinTarget = userProfile?.proteinTarget || 150;
  const carbsTarget = userProfile?.carbsTarget || 200;
  const fatTarget = userProfile?.fatTarget || 65;

  const remaining = calorieTarget - totals.calories;
  const calorieProgress = totals.calories / calorieTarget;
  const streak = getEffectiveStreak(userProfile);

  const quickActions = [
    { icon: 'keyboard-outline', label: t('dashboard.type'), action: 'type' },
    { icon: 'barcode-scan', label: t('dashboard.scan'), action: 'scan' },
    { icon: 'camera-outline', label: t('dashboard.photo'), action: 'photo' },
    { icon: 'microphone-outline', label: t('dashboard.sayIt'), action: 'voice' }
  ];

  const renderRightActions = (meal) => (
    <TouchableOpacity
      style={styles.swipeActionDuplicate}
      onPress={() => handleDuplicateMeal(meal)}
    >
      <Icon source="content-copy" size={22} color="#FFFFFF" />
      <Text style={styles.swipeActionText}>{t('dashboard.duplicate')}</Text>
    </TouchableOpacity>
  );

  const renderLeftActions = (meal) => (
    <TouchableOpacity
      style={styles.swipeActionDelete}
      onPress={() => handleDeleteMeal(meal.id, meal.description)}
    >
      <Icon source="delete-outline" size={22} color="#FFFFFF" />
      <Text style={styles.swipeActionText}>{t('dashboard.delete')}</Text>
    </TouchableOpacity>
  );

  // Auto-scroll calendar ribbon to today on first render
  useEffect(() => {
    const indexOfToday = days.findIndex((d) => isSameDay(d, new Date()));
    const ITEM_WIDTH = 56;
    if (calendarRef.current && indexOfToday >= 0) {
      setTimeout(() => {
        calendarRef.current.scrollTo({ x: Math.max(0, (indexOfToday - 3) * ITEM_WIDTH), animated: true });
      }, 0);
    }
  }, []);

  return (
    <View style={styles.container}>
      {showGoalConfetti && (
        <ConfettiCannon
          count={200}
          origin={{ x: -10, y: 0 }}
          autoStart={false}
          ref={confettiRef}
          fadeOut={true}
        />
      )}

      {/* Calendar Strip */}
      <View style={styles.calendarRibbon}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.calendarContent}
          ref={calendarRef}
        >
          {days.map((day, index) => {
            const { day: dayName, date } = formatDate(day, t);
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            return (
              <TouchableOpacity
                key={index}
                style={[styles.dateItem, isSelected && styles.dateItemSelected]}
                onPress={() => handleDateSelect(day)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                  {dayName}
                </Text>
                <Text style={[
                  styles.dateNumber,
                  isSelected && styles.dateNumberSelected,
                  isToday && !isSelected && styles.todayDate
                ]}>
                  {date}
                </Text>
                <View style={[styles.todayDot, isToday && !isSelected && styles.todayDotVisible]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Progress Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <ProgressRing
              size={148}
              strokeWidth={12}
              progress={calorieProgress}
              color={remaining >= 0 ? colors.primary : colors.danger}
              trackColor={colors.tint}
            >
              <View style={styles.ringCenter}>
                <Text style={[styles.ringValue, remaining < 0 && { color: colors.danger }]}>
                  {Math.round(Math.abs(remaining))}
                </Text>
                <Text style={styles.ringLabel}>
                  {remaining >= 0
                    ? t('dashboard.left', { count: '' }).replace(/\s+/g, ' ').trim()
                    : t('dashboard.over', { count: '' }).replace(/\s+/g, ' ').trim()}
                </Text>
              </View>
            </ProgressRing>

            <View style={styles.macroColumn}>
              <MacroBar label={t('dashboard.protein')} current={totals.protein} target={proteinTarget} color={colors.protein} />
              <MacroBar label={t('dashboard.carbs')} current={totals.carbs} target={carbsTarget} color={colors.carbs} />
              <MacroBar label={t('dashboard.fat')} current={totals.fat} target={fatTarget} color={colors.fat} />
            </View>
          </View>

          <View style={styles.heroFooter}>
            <Text style={styles.heroFooterText}>
              <Text style={styles.heroFooterValue}>{totals.calories}</Text>
              <Text style={styles.heroFooterTarget}> / {calorieTarget} {t('dashboard.calShort')}</Text>
            </Text>
            {streak > 0 && (
              <View style={styles.streakChip}>
                <Text style={styles.streakChipText}>🔥 {streak}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          {quickActions.map(({ icon, label, action }) => (
            <TouchableOpacity
              key={action}
              style={styles.quickActionButton}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('LogMeal', { action, selectedDate: selectedDate.toISOString() })}
            >
              <View style={styles.quickActionIconWrap}>
                <Icon source={icon} size={22} color={colors.primary} />
              </View>
              <Text style={styles.quickActionText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Smart Suggestions */}
        {smartSuggestions.length > 0 && smartSuggestions.map((suggestion, index) => (
          <View key={index} style={styles.suggestionCard}>
            <Text style={styles.suggestionTitle}>
              {suggestion.icon} {suggestion.title}
            </Text>
            <Text style={styles.suggestionText}>{suggestion.description}</Text>
            {suggestion.actionable && (
              <Text style={styles.suggestionActionable}>💡 {suggestion.actionable}</Text>
            )}
          </View>
        ))}

        {/* Meals Section */}
        <View style={styles.mealsSection}>
          <Text style={styles.sectionTitle}>{t('dashboard.meals')}</Text>

          {meals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🍽️</Text>
              <Text style={styles.emptyTitle}>{t('dashboard.noMealsToday')}</Text>
              <Text style={styles.emptyText}>{t('dashboard.emptyPrompt')}</Text>
              <Button
                mode="contained"
                buttonColor={colors.primary}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                  navigation.navigate('LogMeal', { selectedDate: selectedDate.toISOString() });
                }}
                style={styles.emptyButton}
                icon="plus"
              >
                {t('dashboard.logFirstMeal')}
              </Button>
            </View>
          ) : (
            meals.map((meal) => {
              const gradeData = meal.gradeData || null;
              const mealTime = meal.date?.toDate?.()?.toLocaleTimeString?.(localeCode, {
                hour: 'numeric',
                minute: '2-digit'
              });

              return (
                <Swipeable
                  key={meal.id}
                  renderRightActions={() => renderRightActions(meal)}
                  renderLeftActions={() => renderLeftActions(meal)}
                >
                  <TouchableOpacity
                    onLongPress={() => handleEditMeal(meal)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.mealCard}>
                      <View style={styles.mealHeader}>
                        <View style={styles.mealTypeIconWrap}>
                          <Icon
                            source={MEAL_TYPE_ICONS[meal.mealType] || 'silverware-fork-knife'}
                            size={18}
                            color={colors.primary}
                          />
                        </View>
                        <View style={styles.mealHeaderText}>
                          <Text style={styles.mealType}>{getMealTypeLabel(meal.mealType, t)}</Text>
                          {mealTime ? <Text style={styles.timeText}>{mealTime}</Text> : null}
                        </View>
                        {gradeData && (
                          <View style={[styles.gradeChip, { backgroundColor: gradeData.color }]}>
                            <Text style={styles.gradeText}>{gradeData.grade}</Text>
                          </View>
                        )}
                        <IconButton
                          icon="pencil-outline"
                          size={18}
                          iconColor={colors.faint}
                          style={styles.editIcon}
                          onPress={() => handleEditMeal(meal)}
                        />
                      </View>

                      <View style={styles.mealBody}>
                        <Text style={styles.descriptionText} numberOfLines={3}>
                          {meal.description}
                        </Text>
                        {meal.imageUrl && (
                          <Image source={{ uri: meal.imageUrl }} style={styles.mealThumb} />
                        )}
                      </View>

                      <View style={styles.nutrientsContainer}>
                        <View style={styles.calorieBadge}>
                          <Text style={styles.caloriesValue}>{meal.totals.calories}</Text>
                          <Text style={styles.caloriesUnit}>{t('dashboard.calShort')}</Text>
                        </View>
                        <View style={styles.macroPills}>
                          <View style={[styles.macroPill, { backgroundColor: '#FEF2F2' }]}>
                            <Text style={[styles.macroPillText, { color: colors.protein }]}>
                              {t('dashboard.proteinLabel').charAt(0)} {Math.round(meal.totals.protein)}g
                            </Text>
                          </View>
                          <View style={[styles.macroPill, { backgroundColor: '#ECFDF5' }]}>
                            <Text style={[styles.macroPillText, { color: '#059669' }]}>
                              {t('dashboard.carbsLabel').charAt(0)} {Math.round(meal.totals.carbs)}g
                            </Text>
                          </View>
                          <View style={[styles.macroPill, { backgroundColor: '#FFFBEB' }]}>
                            <Text style={[styles.macroPillText, { color: '#D97706' }]}>
                              {t('dashboard.fatLabel').charAt(0)} {Math.round(meal.totals.fat)}g
                            </Text>
                          </View>
                        </View>
                      </View>

                      {gradeData && (
                        <View style={styles.gradeCardContainer}>
                          <MealGradeCard gradeData={gradeData} compact />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              );
            })
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Edit Meal Modal */}
      <Portal>
        <Modal
          visible={editModalVisible}
          onDismiss={() => setEditModalVisible(false)}
          contentContainerStyle={styles.editModal}
        >
          <Text style={styles.editModalTitle}>{t('dashboard.editMeal')}</Text>

          <View style={styles.editModeToggle}>
            <Button
              mode={editMode === 'description' ? 'contained' : 'outlined'}
              buttonColor={editMode === 'description' ? colors.primary : undefined}
              onPress={() => setEditMode('description')}
              style={styles.editModeButton}
              compact
            >
              {t('dashboard.description')}
            </Button>
            <Button
              mode={editMode === 'date' ? 'contained' : 'outlined'}
              buttonColor={editMode === 'date' ? colors.primary : undefined}
              onPress={() => setEditMode('date')}
              style={styles.editModeButton}
              compact
            >
              {t('dashboard.date')}
            </Button>
          </View>

          {editMode === 'description' ? (
            <PaperTextInput
              label={t('dashboard.description')}
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
              numberOfLines={4}
              mode="outlined"
              style={styles.editInput}
            />
          ) : (
            <View style={styles.datePickerContainer}>
              <Text style={styles.datePickerLabel}>{t('dashboard.selectNewDate')}</Text>
              <View style={styles.datePickerButtons}>
                {[-2, -1, 0, 1, 2].map((offset) => {
                  const date = new Date(editDate);
                  date.setDate(date.getDate() + offset);
                  const isSelected = isSameDay(date, editDate);
                  const { day: dayName, date: dayNum } = formatDate(date, t);
                  const isToday = isSameDay(date, new Date());

                  return (
                    <TouchableOpacity
                      key={offset}
                      style={[styles.datePickerButton, isSelected && styles.datePickerButtonSelected]}
                      onPress={() => setEditDate(date)}
                    >
                      <Text style={[styles.datePickerDayName, isSelected && styles.datePickerDayNameSelected]}>
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
              {t('common.cancel')}
            </Button>
            <Button mode="contained" buttonColor={colors.primary} onPress={handleSaveEdit}>
              {editMode === 'description' ? t('dashboard.reparseSave') : t('dashboard.updateDate')}
            </Button>
          </View>
        </Modal>
      </Portal>

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
    backgroundColor: colors.background
  },
  // Calendar strip
  calendarRibbon: {
    backgroundColor: colors.surface,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  calendarContent: {
    paddingHorizontal: 12
  },
  dateItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 2,
    borderRadius: radius.md,
    width: 52,
    backgroundColor: 'transparent'
  },
  dateItemSelected: {
    backgroundColor: colors.primary,
    ...shadows.glow
  },
  dayName: {
    color: colors.faint,
    marginBottom: 4,
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  dayNameSelected: {
    color: 'rgba(255,255,255,0.85)'
  },
  dateNumber: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 17
  },
  dateNumberSelected: {
    color: '#FFFFFF'
  },
  todayDate: {
    color: colors.primary
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
    backgroundColor: 'transparent'
  },
  todayDotVisible: {
    backgroundColor: colors.primary
  },
  // Hero card
  heroCard: {
    margin: 16,
    marginBottom: 8,
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    ...shadows.card
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20
  },
  ringCenter: {
    alignItems: 'center'
  },
  ringValue: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.5,
    color: colors.ink
  },
  ringLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.faint,
    marginTop: -2
  },
  macroColumn: {
    flex: 1,
    gap: 14
  },
  macroBarWrap: {},
  macroBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 5
  },
  macroBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  },
  macroBarValue: {
    fontSize: 13
  },
  macroBarTarget: {
    color: colors.faint,
    fontWeight: '600',
    fontSize: 12
  },
  macroBarTrack: {
    height: 6,
    backgroundColor: colors.subtle,
    borderRadius: 3,
    overflow: 'hidden'
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 3
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.subtle
  },
  heroFooterText: {},
  heroFooterValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5
  },
  heroFooterTarget: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.faint
  },
  streakChip: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill
  },
  streakChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.flame
  },
  // Quick actions
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 12,
    ...shadows.card
  },
  quickActionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted
  },
  // Suggestions
  suggestionCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    backgroundColor: colors.tint,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.tintBorder
  },
  suggestionTitle: {
    color: colors.primaryDeep,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 6
  },
  suggestionText: {
    color: colors.primaryDark,
    fontSize: 14,
    lineHeight: 20
  },
  suggestionActionable: {
    color: colors.primaryDeep,
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic'
  },
  // Meals
  mealsSection: {
    paddingHorizontal: 16,
    marginTop: 12
  },
  sectionTitle: {
    ...type.title,
    marginBottom: 12
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    ...shadows.card
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 14
  },
  emptyTitle: {
    ...type.heading,
    fontSize: 19,
    marginBottom: 6,
    textAlign: 'center'
  },
  emptyText: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 20
  },
  emptyButton: {
    paddingHorizontal: 16,
    borderRadius: radius.pill
  },
  mealCard: {
    marginBottom: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadows.card
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  mealTypeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  mealHeaderText: {
    flex: 1
  },
  mealType: {
    fontWeight: '700',
    color: colors.ink,
    fontSize: 15,
    letterSpacing: -0.2
  },
  timeText: {
    color: colors.faint,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1
  },
  gradeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    minWidth: 34,
    alignItems: 'center'
  },
  gradeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  editIcon: {
    margin: 0,
    marginLeft: 2
  },
  mealBody: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12
  },
  descriptionText: {
    flex: 1,
    color: colors.body,
    lineHeight: 21,
    fontSize: 14
  },
  mealThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.subtle
  },
  nutrientsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.subtle
  },
  calorieBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4
  },
  caloriesValue: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: -0.5
  },
  caloriesUnit: {
    color: colors.faint,
    fontWeight: '600',
    fontSize: 12
  },
  macroPills: {
    flexDirection: 'row',
    gap: 6
  },
  macroPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  macroPillText: {
    fontSize: 12,
    fontWeight: '700'
  },
  gradeCardContainer: {
    marginTop: 12
  },
  // Swipe actions
  swipeActionDuplicate: {
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    marginBottom: 12,
    borderRadius: radius.lg,
    marginLeft: 8,
    gap: 4
  },
  swipeActionDelete: {
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    marginBottom: 12,
    borderRadius: radius.lg,
    marginRight: 8,
    gap: 4
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  // Edit modal
  editModal: {
    backgroundColor: colors.surface,
    padding: 24,
    margin: 20,
    borderRadius: radius.xl
  },
  editModalTitle: {
    ...type.title,
    fontSize: 20,
    marginBottom: 20
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
    color: colors.muted,
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
    backgroundColor: colors.subtle,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  datePickerButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  datePickerDayName: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  datePickerDayNameSelected: {
    color: '#FFFFFF'
  },
  datePickerDayNum: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink
  },
  datePickerDayNumSelected: {
    color: '#FFFFFF'
  },
  datePickerToday: {
    color: colors.primary
  }
});
