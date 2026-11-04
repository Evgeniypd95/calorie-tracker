import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform, Alert, TouchableOpacity, Text as RNText } from 'react-native';
import { Text, TextInput, IconButton, Icon } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { calculateNutritionPlanBackend } from '../../services/geminiService';
import { useLocalization } from '../../localization/i18n';
import { colors, gradients, radius, shadows, type } from '../../theme';

const TIMELINE_OPTIONS = [
  { value: '1', months: 1 },
  { value: '2', months: 2 },
  { value: '3', months: 3 },
  { value: '6', months: 6 },
  { value: '12', months: 12 }
];

const WORKOUT_OPTIONS = ['0', '1', '2', '3', '4', '5', '6', '7'];

// Selectable pill chip
function PillOption({ label, selected, onPress, flex }) {
  return (
    <TouchableOpacity
      style={[styles.pill, flex && { flex: 1 }, selected && styles.pillSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <RNText style={[styles.pillLabel, selected && styles.pillLabelSelected]}>{label}</RNText>
    </TouchableOpacity>
  );
}

// Larger selectable card with an icon
function OptionCard({ icon, label, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.optionCard, selected && styles.optionCardSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Icon source={icon} size={22} color={selected ? colors.primary : colors.faint} />
      <RNText style={[styles.optionCardLabel, selected && styles.optionCardLabelSelected]}>
        {label}
      </RNText>
    </TouchableOpacity>
  );
}

export default function GoalsOnboardingScreen({ navigation }) {
  const { t } = useLocalization();
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('MALE');
  const [height, setHeight] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState('3');
  const [goal, setGoal] = useState('LOSE_WEIGHT');
  const [timelineValue, setTimelineValue] = useState('3');
  const [plan, setPlan] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [overrides, setOverrides] = useState({
    dailyCalories: '',
    protein: '',
    carbs: '',
    fat: ''
  });

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const getTargetDateIso = () => {
    const months = TIMELINE_OPTIONS.find((option) => option.value === timelineValue)?.months || 3;
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date.toISOString();
  };

  const buildUserData = () => {
    const now = new Date();
    const parsedAge = parseInt(age, 10);
    const birthYear = now.getFullYear() - parsedAge;
    const birthMonth = now.getMonth() + 1;
    const parsedWeight = parseFloat(currentWeight);
    const parsedTargetWeight = goal === 'MAINTAIN'
      ? parsedWeight
      : parseFloat(targetWeight || currentWeight);
    const workouts = parseInt(workoutsPerWeek, 10);
    const activityLevel = workouts === 0
      ? 'SEDENTARY'
      : workouts <= 2
      ? 'LIGHT'
      : workouts <= 4
      ? 'MODERATE'
      : workouts <= 6
      ? 'ACTIVE'
      : 'VERY_ACTIVE';

    return {
      birthMonth,
      birthYear,
      gender,
      currentWeight: parsedWeight,
      weight: parsedWeight,
      targetWeight: parsedTargetWeight,
      height: parseFloat(height),
      workoutsPerWeek: workouts,
      activityLevel,
      goal,
      targetDate: getTargetDateIso()
    };
  };

  const validateInputs = () => {
    if (!age || !height || !currentWeight || !workoutsPerWeek) {
      showAlert(t('common.error'), t('onboardingGoals.missingRequired'));
      return false;
    }
    if (goal !== 'MAINTAIN' && !targetWeight) {
      showAlert(t('common.error'), t('onboardingGoals.missingTargetWeight'));
      return false;
    }
    return true;
  };

  const calculatePlan = async () => {
    if (!validateInputs()) return;

    setIsCalculating(true);
    try {
      const userData = buildUserData();
      const result = await calculateNutritionPlanBackend(userData);
      const dailyCalories = result.targetCalories;
      setPlan(result);
      setOverrides({
        dailyCalories: String(dailyCalories),
        protein: String(result.protein),
        carbs: String(result.carbs),
        fat: String(result.fat)
      });
    } catch (error) {
      console.error('Error calculating plan:', error);
      showAlert(t('common.error'), t('onboardingGoals.calculationFailed'));
    } finally {
      setIsCalculating(false);
    }
  };

  const handleContinue = () => {
    if (!plan) {
      showAlert(t('common.error'), t('onboardingGoals.calculateFirst'));
      return;
    }

    const dailyCalories = parseInt(overrides.dailyCalories, 10);
    const protein = parseInt(overrides.protein, 10);
    const carbs = parseInt(overrides.carbs, 10);
    const fat = parseInt(overrides.fat, 10);

    if (!dailyCalories || !protein || !carbs || !fat) {
      showAlert(t('common.error'), t('onboardingGoals.missingPlanFields'));
      return;
    }

    const userData = buildUserData();
    const onboardingData = {
      ...userData,
      age: parseInt(age, 10),
      height: parseFloat(height),
      currentWeight: parseFloat(currentWeight),
      weight: parseFloat(currentWeight),
      targetWeight: userData.targetWeight,
      workoutsPerWeek: parseInt(workoutsPerWeek, 10),
      activityLevel: userData.activityLevel,
      weightUnit: 'kg',
      heightUnit: 'cm',
      calculatedPlan: {
        dailyCalories,
        protein,
        carbs,
        fat
      }
    };

    navigation.navigate('Signup', { onboardingData });
  };

  const inputProps = {
    mode: 'outlined',
    outlineColor: colors.border,
    activeOutlineColor: colors.primary,
    outlineStyle: { borderRadius: radius.md },
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <IconButton
        icon="arrow-left"
        size={24}
        iconColor={colors.ink}
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      />
      <Text style={styles.title}>{t('onboardingGoals.title')}</Text>
      <Text style={styles.subtitle}>{t('onboardingGoals.subtitle')}</Text>

      {/* About you */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('onboardingGoals.basics')}</Text>

        <View style={styles.row}>
          <TextInput
            label={t('onboardingGoals.age')}
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            style={styles.halfInput}
            {...inputProps}
          />
          <TextInput
            label={t('onboardingGoals.height')}
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            style={styles.halfInput}
            {...inputProps}
          />
        </View>

        <View style={styles.optionRow}>
          <OptionCard
            icon="gender-male"
            label={t('onboardingGoals.male')}
            selected={gender === 'MALE'}
            onPress={() => setGender('MALE')}
          />
          <OptionCard
            icon="gender-female"
            label={t('onboardingGoals.female')}
            selected={gender === 'FEMALE'}
            onPress={() => setGender('FEMALE')}
          />
        </View>

        <View style={styles.row}>
          <TextInput
            label={t('onboardingGoals.currentWeight')}
            value={currentWeight}
            onChangeText={setCurrentWeight}
            keyboardType="decimal-pad"
            style={styles.halfInput}
            {...inputProps}
          />
          <TextInput
            label={t('onboardingGoals.targetWeight')}
            value={goal === 'MAINTAIN' ? currentWeight : targetWeight}
            onChangeText={setTargetWeight}
            keyboardType="decimal-pad"
            style={styles.halfInput}
            disabled={goal === 'MAINTAIN'}
            {...inputProps}
          />
        </View>
      </View>

      {/* Goal */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('onboardingGoals.goal')}</Text>
        <View style={styles.optionRow}>
          <OptionCard
            icon="trending-down"
            label={t('onboardingGoals.lose')}
            selected={goal === 'LOSE_WEIGHT'}
            onPress={() => setGoal('LOSE_WEIGHT')}
          />
          <OptionCard
            icon="scale-balance"
            label={t('onboardingGoals.maintain')}
            selected={goal === 'MAINTAIN'}
            onPress={() => {
              setGoal('MAINTAIN');
              setTargetWeight(currentWeight);
            }}
          />
          <OptionCard
            icon="arm-flex-outline"
            label={t('onboardingGoals.gain')}
            selected={goal === 'BUILD_MUSCLE'}
            onPress={() => setGoal('BUILD_MUSCLE')}
          />
        </View>

        <Text style={styles.sectionLabel}>{t('onboardingGoals.workoutsPerWeek')}</Text>
        <View style={styles.pillRow}>
          {WORKOUT_OPTIONS.map((n) => (
            <PillOption
              key={n}
              label={n}
              flex
              selected={workoutsPerWeek === n}
              onPress={() => setWorkoutsPerWeek(n)}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t('onboardingGoals.timeline')}</Text>
        <View style={styles.pillRow}>
          {TIMELINE_OPTIONS.map((option) => (
            <PillOption
              key={option.value}
              label={t('onboardingGoals.timelineOption', { months: option.months })}
              flex
              selected={timelineValue === option.value}
              onPress={() => setTimelineValue(option.value)}
            />
          ))}
        </View>
      </View>

      <TouchableOpacity activeOpacity={0.85} onPress={calculatePlan} disabled={isCalculating}>
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.ctaButton, isCalculating && { opacity: 0.6 }]}
        >
          <RNText style={styles.ctaLabel}>
            {isCalculating ? t('common.loading') : t('onboardingGoals.calculate')}
          </RNText>
        </LinearGradient>
      </TouchableOpacity>

      {/* Plan review */}
      {plan && (
        <View style={[styles.card, styles.planCard]}>
          <Text style={styles.planTitle}>{t('onboardingGoals.reviewTitle')}</Text>
          <Text style={styles.helpText}>{t('onboardingGoals.reviewSubtitle')}</Text>

          <View style={styles.planHero}>
            <RNText style={styles.planCalories}>{overrides.dailyCalories || '—'}</RNText>
            <RNText style={styles.planCaloriesUnit}>{t('onboardingGoals.dailyCalories')}</RNText>
          </View>

          <View style={styles.row}>
            <TextInput
              label={t('onboardingGoals.dailyCalories')}
              value={overrides.dailyCalories}
              onChangeText={(value) => setOverrides(prev => ({ ...prev, dailyCalories: value }))}
              keyboardType="number-pad"
              style={styles.halfInput}
              {...inputProps}
            />
            <TextInput
              label={t('onboardingGoals.protein')}
              value={overrides.protein}
              onChangeText={(value) => setOverrides(prev => ({ ...prev, protein: value }))}
              keyboardType="number-pad"
              style={styles.halfInput}
              {...inputProps}
            />
          </View>

          <View style={styles.row}>
            <TextInput
              label={t('onboardingGoals.carbs')}
              value={overrides.carbs}
              onChangeText={(value) => setOverrides(prev => ({ ...prev, carbs: value }))}
              keyboardType="number-pad"
              style={styles.halfInput}
              {...inputProps}
            />
            <TextInput
              label={t('onboardingGoals.fat')}
              value={overrides.fat}
              onChangeText={(value) => setOverrides(prev => ({ ...prev, fat: value }))}
              keyboardType="number-pad"
              style={styles.halfInput}
              {...inputProps}
            />
          </View>

          {plan.reasoning && (
            <View style={styles.reasoningCard}>
              <Text style={styles.reasoningText}>{plan.reasoning}</Text>
            </View>
          )}

          <TouchableOpacity activeOpacity={0.85} onPress={handleContinue}>
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <RNText style={styles.ctaLabel}>{t('onboardingGoals.continue')}</RNText>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%'
  },
  backButton: {
    alignSelf: 'flex-start',
    marginLeft: -8,
    marginBottom: 4
  },
  title: {
    ...type.display,
    fontSize: 30,
    marginBottom: 6
  },
  subtitle: {
    ...type.body,
    color: colors.muted,
    marginBottom: 20
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 14,
    ...shadows.card
  },
  sectionLabel: {
    ...type.overline,
    marginBottom: 10,
    marginTop: 4
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  halfInput: {
    flex: 1,
    marginBottom: 12,
    backgroundColor: colors.surface
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14
  },
  optionCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.subtle,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 6
  },
  optionCardSelected: {
    backgroundColor: colors.tint,
    borderColor: colors.primary
  },
  optionCardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted
  },
  optionCardLabelSelected: {
    color: colors.primaryDark,
    fontWeight: '700'
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14
  },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.subtle,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center'
  },
  pillSelected: {
    backgroundColor: colors.tint,
    borderColor: colors.primary
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted
  },
  pillLabelSelected: {
    color: colors.primaryDark,
    fontWeight: '700'
  },
  ctaButton: {
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 14,
    ...shadows.glow
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2
  },
  planCard: {
    borderWidth: 1.5,
    borderColor: colors.tintBorder
  },
  planTitle: {
    ...type.title,
    fontSize: 20,
    marginBottom: 4
  },
  helpText: {
    ...type.caption,
    marginBottom: 14
  },
  planHero: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 16,
    backgroundColor: colors.tint,
    borderRadius: radius.lg
  },
  planCalories: {
    fontSize: 44,
    fontWeight: '900',
    color: colors.primaryDark,
    letterSpacing: -2
  },
  planCaloriesUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2
  },
  reasoningCard: {
    backgroundColor: colors.subtle,
    padding: 14,
    borderRadius: radius.md,
    marginBottom: 14
  },
  reasoningText: {
    ...type.body,
    fontSize: 13,
    lineHeight: 19
  }
});
