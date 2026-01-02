import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform, Alert } from 'react-native';
import { Text, TextInput, Button, Card, SegmentedButtons, Surface } from 'react-native-paper';
import { calculateNutritionPlanBackend } from '../../services/geminiService';
import { useLocalization } from '../../localization/i18n';

const TIMELINE_OPTIONS = [
  { value: '1', months: 1 },
  { value: '2', months: 2 },
  { value: '3', months: 3 },
  { value: '6', months: 6 },
  { value: '12', months: 12 }
];

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="displaySmall" style={styles.title}>
        {t('onboardingGoals.title')}
      </Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        {t('onboardingGoals.subtitle')}
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            {t('onboardingGoals.basics')}
          </Text>

          <View style={styles.row}>
            <TextInput
              label={t('onboardingGoals.age')}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              mode="outlined"
              style={styles.halfInput}
            />
            <TextInput
              label={t('onboardingGoals.height')}
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
              mode="outlined"
              style={styles.halfInput}
            />
          </View>

          <Text style={styles.inputLabel}>{t('onboardingGoals.gender')}</Text>
          <SegmentedButtons
            value={gender}
            onValueChange={setGender}
            buttons={[
              { value: 'MALE', label: t('onboardingGoals.male') },
              { value: 'FEMALE', label: t('onboardingGoals.female') }
            ]}
            style={styles.segmented}
          />

          <View style={styles.row}>
            <TextInput
              label={t('onboardingGoals.currentWeight')}
              value={currentWeight}
              onChangeText={setCurrentWeight}
              keyboardType="decimal-pad"
              mode="outlined"
              style={styles.halfInput}
            />
            <TextInput
              label={t('onboardingGoals.targetWeight')}
              value={goal === 'MAINTAIN' ? currentWeight : targetWeight}
              onChangeText={setTargetWeight}
              keyboardType="decimal-pad"
              mode="outlined"
              style={styles.halfInput}
              disabled={goal === 'MAINTAIN'}
            />
          </View>

          <TextInput
            label={t('onboardingGoals.workoutsPerWeek')}
            value={workoutsPerWeek}
            onChangeText={setWorkoutsPerWeek}
            keyboardType="number-pad"
            mode="outlined"
            style={styles.fullInput}
          />

          <Text style={styles.inputLabel}>{t('onboardingGoals.goal')}</Text>
          <SegmentedButtons
            value={goal}
            onValueChange={(nextGoal) => {
              setGoal(nextGoal);
              if (nextGoal === 'MAINTAIN') {
                setTargetWeight(currentWeight);
              }
            }}
            buttons={[
              { value: 'LOSE_WEIGHT', label: t('onboardingGoals.lose') },
              { value: 'MAINTAIN', label: t('onboardingGoals.maintain') },
              { value: 'BUILD_MUSCLE', label: t('onboardingGoals.gain') }
            ]}
            style={styles.segmented}
          />

          <Text style={styles.inputLabel}>{t('onboardingGoals.timeline')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineRow}>
            <SegmentedButtons
              value={timelineValue}
              onValueChange={setTimelineValue}
              buttons={TIMELINE_OPTIONS.map((option) => ({
                value: option.value,
                label: t('onboardingGoals.timelineOption', { months: option.months })
              }))}
              style={styles.timelineSegmented}
            />
          </ScrollView>

          <Button
            mode="contained"
            onPress={calculatePlan}
            loading={isCalculating}
            disabled={isCalculating}
            style={styles.primaryButton}
          >
            {t('onboardingGoals.calculate')}
          </Button>
        </Card.Content>
      </Card>

      {plan && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              {t('onboardingGoals.reviewTitle')}
            </Text>
            <Text style={styles.helpText}>
              {t('onboardingGoals.reviewSubtitle')}
            </Text>

            <View style={styles.row}>
              <TextInput
                label={t('onboardingGoals.dailyCalories')}
                value={overrides.dailyCalories}
                onChangeText={(value) => setOverrides(prev => ({ ...prev, dailyCalories: value }))}
                keyboardType="number-pad"
                mode="outlined"
                style={styles.halfInput}
              />
              <TextInput
                label={t('onboardingGoals.protein')}
                value={overrides.protein}
                onChangeText={(value) => setOverrides(prev => ({ ...prev, protein: value }))}
                keyboardType="number-pad"
                mode="outlined"
                style={styles.halfInput}
              />
            </View>

            <View style={styles.row}>
              <TextInput
                label={t('onboardingGoals.carbs')}
                value={overrides.carbs}
                onChangeText={(value) => setOverrides(prev => ({ ...prev, carbs: value }))}
                keyboardType="number-pad"
                mode="outlined"
                style={styles.halfInput}
              />
              <TextInput
                label={t('onboardingGoals.fat')}
                value={overrides.fat}
                onChangeText={(value) => setOverrides(prev => ({ ...prev, fat: value }))}
                keyboardType="number-pad"
                mode="outlined"
                style={styles.halfInput}
              />
            </View>

            {plan.reasoning && (
              <Surface style={styles.reasoningCard}>
                <Text style={styles.reasoningText}>{plan.reasoning}</Text>
              </Surface>
            )}

            <Button
              mode="contained"
              onPress={handleContinue}
              style={styles.primaryButton}
            >
              {t('onboardingGoals.continue')}
            </Button>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9'
  },
  content: {
    padding: 24,
    paddingBottom: 40
  },
  title: {
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8
  },
  subtitle: {
    color: '#64748B',
    marginBottom: 24
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 8
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  halfInput: {
    flex: 1,
    marginBottom: 12,
    backgroundColor: '#FFFFFF'
  },
  fullInput: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF'
  },
  segmented: {
    marginBottom: 12
  },
  timelineRow: {
    paddingBottom: 4,
    paddingRight: 12
  },
  timelineSegmented: {
    marginBottom: 12,
    minWidth: 520
  },
  primaryButton: {
    marginTop: 8,
    paddingVertical: 4
  },
  helpText: {
    color: '#64748B',
    marginBottom: 12
  },
  reasoningCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 8
  },
  reasoningText: {
    color: '#475569',
    lineHeight: 20
  }
});
