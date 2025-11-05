import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, Surface, TextInput } from 'react-native-paper';
import { useOnboarding } from '../../context/OnboardingContext';

export default function PlanReviewScreen({ navigation }) {
  const { onboardingData, updateOnboardingData, calculateTDEE } = useOnboarding();
  const [isEditing, setIsEditing] = useState(false);
  const [weekdayCalories, setWeekdayCalories] = useState(0);
  const [weekendCalories, setWeekendCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);

  useEffect(() => {
    calculatePlan();
  }, [onboardingData]);

  const calculatePlan = () => {
    const tdee = calculateTDEE();
    const strategyMultiplier = onboardingData.strategyMultiplier || 0.85;

    // Calculate base target based on goal
    let baseTarget;
    if (onboardingData.goal === 'LOSE_WEIGHT') {
      baseTarget = Math.round(tdee * strategyMultiplier);
    } else if (onboardingData.goal === 'BUILD_MUSCLE') {
      baseTarget = Math.round(tdee * (2 - strategyMultiplier)); // Inverse for surplus
    } else {
      baseTarget = tdee;
    }

    // Apply weekend flexibility if enabled
    let weekdayTarget = baseTarget;
    let weekendTarget = baseTarget;

    if (onboardingData.enableWeekendFlexibility) {
      const bonusCalories = onboardingData.weekendBonusCalories || 300;
      const weekendDays = onboardingData.weekendOption === 'FRI_SAT_SUN' ? 3 : 2;
      const weekdayDays = 7 - weekendDays;

      // Keep weekly average the same by reducing weekday calories
      const weeklyTotal = baseTarget * 7;
      weekendTarget = baseTarget + bonusCalories;
      weekdayTarget = Math.round((weeklyTotal - (weekendTarget * weekendDays)) / weekdayDays);
    }

    setWeekdayCalories(weekdayTarget);
    setWeekendCalories(weekendTarget);

    // Calculate macros (40% protein, 30% carbs, 30% fat for lose weight/maintain)
    // (30% protein, 40% carbs, 30% fat for build muscle)
    let proteinRatio, carbsRatio, fatRatio;
    if (onboardingData.goal === 'BUILD_MUSCLE') {
      proteinRatio = 0.30;
      carbsRatio = 0.40;
      fatRatio = 0.30;
    } else {
      proteinRatio = 0.40;
      carbsRatio = 0.30;
      fatRatio = 0.30;
    }

    setProtein(Math.round((weekdayTarget * proteinRatio) / 4)); // 4 cal per gram
    setCarbs(Math.round((weekdayTarget * carbsRatio) / 4));
    setFat(Math.round((weekdayTarget * fatRatio) / 9)); // 9 cal per gram

    // Update onboarding data
    updateOnboardingData({
      weekdayCalories: weekdayTarget,
      weekendCalories: weekendTarget,
      dailyCalorieTarget: weekdayTarget,
      proteinTarget: Math.round((weekdayTarget * proteinRatio) / 4),
      carbsTarget: Math.round((weekdayTarget * carbsRatio) / 4),
      fatTarget: Math.round((weekdayTarget * fatRatio) / 9),
    });
  };

  const handleSaveEdit = () => {
    updateOnboardingData({
      weekdayCalories,
      weekendCalories,
      dailyCalorieTarget: weekdayCalories,
      proteinTarget: protein,
      carbsTarget: carbs,
      fatTarget: fat,
    });
    setIsEditing(false);
  };

  const handleContinue = () => {
    navigation.navigate('InteractiveDemo');
  };

  const getWeekendLabel = () => {
    if (!onboardingData.enableWeekendFlexibility) return null;
    switch (onboardingData.weekendOption) {
      case 'FRI_SAT_SUN':
        return 'Fri, Sat, Sun';
      case 'SAT_SUN':
        return 'Sat, Sun';
      case 'FRI_SAT':
        return 'Fri, Sat';
      default:
        return 'Weekend';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>📊</Text>
          <Text style={styles.title}>Your personalized plan</Text>
          <Text style={styles.subtitle}>Review and adjust if needed</Text>
        </View>

        {/* Daily Calories */}
        <Surface style={styles.card} elevation={3}>
          <Text style={styles.cardTitle}>Daily Calorie Target</Text>

          {isEditing ? (
            <>
              <View style={styles.editRow}>
                <Text style={styles.editLabel}>Weekdays:</Text>
                <TextInput
                  value={String(weekdayCalories)}
                  onChangeText={(val) => setWeekdayCalories(parseInt(val) || 0)}
                  keyboardType="number-pad"
                  style={styles.editInput}
                  mode="outlined"
                />
              </View>
              {onboardingData.enableWeekendFlexibility && (
                <View style={styles.editRow}>
                  <Text style={styles.editLabel}>{getWeekendLabel()}:</Text>
                  <TextInput
                    value={String(weekendCalories)}
                    onChangeText={(val) => setWeekendCalories(parseInt(val) || 0)}
                    keyboardType="number-pad"
                    style={styles.editInput}
                    mode="outlined"
                  />
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.calorieRow}>
                <Text style={styles.dayLabel}>Mon-Thu</Text>
                <Text style={styles.calorieValue}>{weekdayCalories} cal</Text>
              </View>
              {onboardingData.enableWeekendFlexibility && (
                <View style={styles.calorieRow}>
                  <Text style={styles.dayLabel}>{getWeekendLabel()}</Text>
                  <Text style={[styles.calorieValue, styles.weekendValue]}>
                    {weekendCalories} cal
                  </Text>
                </View>
              )}
            </>
          )}
        </Surface>

        {/* Macros */}
        <Surface style={styles.card} elevation={3}>
          <Text style={styles.cardTitle}>Daily Macro Targets</Text>

          {isEditing ? (
            <>
              <View style={styles.editRow}>
                <Text style={styles.editLabel}>Protein (g):</Text>
                <TextInput
                  value={String(protein)}
                  onChangeText={(val) => setProtein(parseInt(val) || 0)}
                  keyboardType="number-pad"
                  style={styles.editInput}
                  mode="outlined"
                />
              </View>
              <View style={styles.editRow}>
                <Text style={styles.editLabel}>Carbs (g):</Text>
                <TextInput
                  value={String(carbs)}
                  onChangeText={(val) => setCarbs(parseInt(val) || 0)}
                  keyboardType="number-pad"
                  style={styles.editInput}
                  mode="outlined"
                />
              </View>
              <View style={styles.editRow}>
                <Text style={styles.editLabel}>Fat (g):</Text>
                <TextInput
                  value={String(fat)}
                  onChangeText={(val) => setFat(parseInt(val) || 0)}
                  keyboardType="number-pad"
                  style={styles.editInput}
                  mode="outlined"
                />
              </View>
            </>
          ) : (
            <View style={styles.macrosContainer}>
              <View style={styles.macroItem}>
                <View style={[styles.macroIcon, { backgroundColor: '#EF4444' }]} />
                <View>
                  <Text style={styles.macroLabel}>Protein</Text>
                  <Text style={styles.macroValue}>{protein}g</Text>
                </View>
              </View>
              <View style={styles.macroItem}>
                <View style={[styles.macroIcon, { backgroundColor: '#10B981' }]} />
                <View>
                  <Text style={styles.macroLabel}>Carbs</Text>
                  <Text style={styles.macroValue}>{carbs}g</Text>
                </View>
              </View>
              <View style={styles.macroItem}>
                <View style={[styles.macroIcon, { backgroundColor: '#F59E0B' }]} />
                <View>
                  <Text style={styles.macroLabel}>Fat</Text>
                  <Text style={styles.macroValue}>{fat}g</Text>
                </View>
              </View>
            </View>
          )}
        </Surface>

        {/* Edit/Save Button */}
        <TouchableOpacity
          onPress={isEditing ? handleSaveEdit : () => setIsEditing(true)}
          style={styles.editButton}
        >
          <Text style={styles.editButtonText}>
            {isEditing ? '✓ Save Changes' : '✏️ Edit Targets'}
          </Text>
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 These are starting points. We'll adapt based on your feedback at 1 day, 7 days, and 1 month check-ins.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={handleContinue}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          Looks Good! Continue
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
  },
  calorieRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  calorieValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#6366F1',
  },
  weekendValue: {
    color: '#10B981',
  },
  macrosContainer: {
    gap: 16,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  macroIcon: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  editInput: {
    flex: 1,
    height: 40,
  },
  editButton: {
    backgroundColor: '#EEF2FF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#C7D2FE',
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4F46E5',
  },
  infoBox: {
    backgroundColor: '#DBEAFE',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  button: {
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
});
