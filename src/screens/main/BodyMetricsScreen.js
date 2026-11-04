import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, TouchableOpacity, Text as RNText } from 'react-native';
import { Text, TextInput, Switch, Icon } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/firebase';
import { calculateNutritionPlanBackend } from '../../services/geminiService';
import { useLocalization } from '../../localization/i18n';
import { colors, gradients, radius, shadows, type } from '../../theme';

const DATE_PRESETS = [
  { days: 30, key: 'oneMonth' },
  { days: 60, key: 'twoMonths' },
  { days: 90, key: 'threeMonths' },
  { days: 180, key: 'sixMonths' },
  { days: 365, key: 'oneYear' }
];

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
      <Icon source={icon} size={20} color={selected ? colors.primary : colors.faint} />
      <RNText style={[styles.optionCardLabel, selected && styles.optionCardLabelSelected]}>
        {label}
      </RNText>
    </TouchableOpacity>
  );
}

export default function BodyMetricsScreen({ navigation }) {
  const { user, refreshUserProfile, userProfile: authProfile } = useAuth();
  const { t, localeCode } = useLocalization();

  // Body metrics
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('MALE');
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [height, setHeight] = useState('');
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState('3');
  const [goal, setGoal] = useState('MAINTAIN');

  // Pregnancy support
  const [isPregnant, setIsPregnant] = useState(false);
  const [trimester, setTrimester] = useState('FIRST');
  const [prePregnancyWeight, setPrePregnancyWeight] = useState('');

  // Target date
  const [targetDate, setTargetDate] = useState(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

  // Calculated values
  const [calculatedData, setCalculatedData] = useState({
    age: 0,
    bmr: 0,
    tdee: 0,
    targetCalories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    weeksToGoal: 0,
    weeklyWeightChange: 0
  });

  const [saving, setSaving] = useState(false);
  // Recalculation fires on every keystroke; overlapping in-flight requests can
  // resolve out of order, so track a request id and only apply the latest.
  const calcRequestIdRef = useRef(0);
  const trimesterLabel = trimester === 'FIRST'
    ? t('bodyMetrics.trimesterFirstShort')
    : trimester === 'SECOND'
    ? t('bodyMetrics.trimesterSecondShort')
    : t('bodyMetrics.trimesterThirdShort');

  useEffect(() => {
    if (authProfile) {
      loadProfileData();
    }
  }, [authProfile]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateAllBackend();
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [birthMonth, birthYear, gender, currentWeight, targetWeight, height, workoutsPerWeek, goal, targetDate, isPregnant, trimester, prePregnancyWeight]);

  const loadProfileData = () => {
    if (authProfile.birthMonth) setBirthMonth(String(authProfile.birthMonth));
    if (authProfile.birthYear) setBirthYear(String(authProfile.birthYear));
    if (authProfile.gender) setGender(authProfile.gender);
    if (authProfile.currentWeight) setCurrentWeight(String(authProfile.currentWeight));
    if (authProfile.targetWeight) setTargetWeight(String(authProfile.targetWeight));
    if (authProfile.height) setHeight(String(authProfile.height));
    if (authProfile.workoutsPerWeek) setWorkoutsPerWeek(String(authProfile.workoutsPerWeek));
    if (authProfile.goal) setGoal(authProfile.goal);
    if (authProfile.targetDate) {
      setTargetDate(new Date(authProfile.targetDate));
    }
    if (authProfile.isPregnant) setIsPregnant(authProfile.isPregnant);
    if (authProfile.trimester) setTrimester(authProfile.trimester);
    if (authProfile.prePregnancyWeight) setPrePregnancyWeight(String(authProfile.prePregnancyWeight));
  };

  const calculateAllBackend = async () => {
    const parsedBirthMonth = parseInt(birthMonth, 10);
    const parsedBirthYear = parseInt(birthYear, 10);
    const parsedCurrentWeight = parseFloat(currentWeight);
    const parsedHeight = parseFloat(height);
    const parsedWorkouts = parseInt(workoutsPerWeek, 10);

    // Guard on the PARSED values, not just non-empty strings — a field can
    // hold non-numeric text (or be mid-edit) and still be "truthy".
    if (
      Number.isNaN(parsedBirthMonth) ||
      Number.isNaN(parsedBirthYear) ||
      Number.isNaN(parsedCurrentWeight) ||
      Number.isNaN(parsedHeight) ||
      Number.isNaN(parsedWorkouts)
    ) {
      setCalculatedData({
        age: 0, bmr: 0, tdee: 0, targetCalories: 0,
        protein: 0, carbs: 0, fat: 0, weeksToGoal: 0, weeklyWeightChange: 0
      });
      return;
    }

    const requestId = ++calcRequestIdRef.current;

    try {
      const userData = {
        birthMonth: parsedBirthMonth,
        birthYear: parsedBirthYear,
        gender,
        currentWeight: parsedCurrentWeight,
        targetWeight: parseFloat(targetWeight) || parsedCurrentWeight,
        height: parsedHeight,
        workoutsPerWeek: parsedWorkouts,
        goal: isPregnant ? 'MAINTAIN' : goal,
        targetDate: targetDate.toISOString(),
        isPregnant,
        trimester: isPregnant ? trimester : undefined,
        prePregnancyWeight: isPregnant ? parseFloat(prePregnancyWeight) || undefined : undefined
      };

      const plan = await calculateNutritionPlanBackend(userData);

      // A newer request has since started — this response is stale, discard it.
      if (requestId !== calcRequestIdRef.current) return;

      setCalculatedData({
        age: plan.age,
        bmr: plan.bmr,
        tdee: plan.tdee,
        targetCalories: plan.targetCalories,
        protein: plan.protein,
        carbs: plan.carbs,
        fat: plan.fat,
        weeksToGoal: plan.weeksToGoal,
        weeklyWeightChange: plan.weeklyWeightChange
      });
    } catch (error) {
      if (requestId !== calcRequestIdRef.current) return;
      console.error('Error calculating nutrition plan:', error);
      // Keep current calculated data on error
    }
  };

  const handleSave = async () => {
    const parsedBirthMonth = parseInt(birthMonth, 10);
    const parsedBirthYear = parseInt(birthYear, 10);
    const parsedCurrentWeight = parseFloat(currentWeight);
    const parsedHeight = parseFloat(height);
    const parsedWorkouts = parseInt(workoutsPerWeek, 10);

    if (
      Number.isNaN(parsedBirthMonth) ||
      Number.isNaN(parsedBirthYear) ||
      Number.isNaN(parsedCurrentWeight) ||
      Number.isNaN(parsedHeight) ||
      Number.isNaN(parsedWorkouts)
    ) {
      showAlert(t('bodyMetrics.missingInfo'), t('bodyMetrics.fillRequired'));
      return;
    }

    if (isPregnant && gender === 'MALE') {
      showAlert(t('bodyMetrics.invalidSelection'), t('bodyMetrics.pregnancyFemaleOnly'));
      setIsPregnant(false);
      return;
    }

    setSaving(true);
    try {
      await userService.updateUserProfile(user.uid, {
        birthMonth: parsedBirthMonth,
        birthYear: parsedBirthYear,
        gender,
        currentWeight: parsedCurrentWeight,
        targetWeight: parseFloat(targetWeight) || parsedCurrentWeight,
        height: parsedHeight,
        workoutsPerWeek: parsedWorkouts,
        goal: isPregnant ? 'MAINTAIN' : goal,
        targetDate: targetDate.toISOString(),

        isPregnant,
        trimester: isPregnant ? trimester : null,
        prePregnancyWeight: isPregnant ? parseFloat(prePregnancyWeight) || null : null,

        dailyCalorieTarget: calculatedData.targetCalories,
        weekdayCalories: calculatedData.targetCalories,
        weekendCalories: calculatedData.targetCalories,
        proteinTarget: calculatedData.protein,
        carbsTarget: calculatedData.carbs,
        fatTarget: calculatedData.fat,

        updatedAt: new Date()
      });

      await refreshUserProfile();
      showAlert(t('common.success'), t('bodyMetrics.saveSuccess'));
      navigation.goBack();
    } catch (error) {
      console.error('Error saving body metrics:', error);
      showAlert(t('common.error'), t('bodyMetrics.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleDateChange = (days) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);
    setTargetDate(newDate);
  };

  const inputProps = {
    mode: 'outlined',
    outlineColor: colors.border,
    activeOutlineColor: colors.primary,
    outlineStyle: { borderRadius: radius.md },
    dense: true
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>{t('bodyMetrics.title')}</Text>
      <Text style={styles.subtitle}>
        {isPregnant ? t('bodyMetrics.subtitlePregnant') : t('bodyMetrics.subtitleDefault')}
      </Text>

      {/* Basic Info */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('bodyMetrics.basicInfo')}</Text>

        <View style={styles.rowInputs}>
          <TextInput
            label={t('bodyMetrics.birthMonth')}
            value={birthMonth}
            onChangeText={setBirthMonth}
            keyboardType="number-pad"
            placeholder="1-12"
            maxLength={2}
            style={styles.halfInput}
            {...inputProps}
          />
          <TextInput
            label={t('bodyMetrics.birthYear')}
            value={birthYear}
            onChangeText={setBirthYear}
            keyboardType="number-pad"
            placeholder="1990"
            maxLength={4}
            style={styles.halfInput}
            {...inputProps}
          />
        </View>

        {calculatedData.age > 0 && (
          <View style={styles.infoChip}>
            <Text style={styles.infoText}>{t('bodyMetrics.ageYears', { age: calculatedData.age })}</Text>
          </View>
        )}

        <Text style={styles.inputLabel}>{t('bodyMetrics.gender')}</Text>
        <View style={styles.optionRow}>
          <OptionCard
            icon="gender-male"
            label={t('bodyMetrics.male')}
            selected={gender === 'MALE'}
            onPress={() => setGender('MALE')}
          />
          <OptionCard
            icon="gender-female"
            label={t('bodyMetrics.female')}
            selected={gender === 'FEMALE'}
            onPress={() => setGender('FEMALE')}
          />
        </View>

        <TextInput
          label={t('bodyMetrics.heightCm')}
          value={height}
          onChangeText={setHeight}
          keyboardType="decimal-pad"
          placeholder="170"
          style={styles.fullInput}
          {...inputProps}
        />
      </View>

      {/* Pregnancy Support */}
      {gender === 'FEMALE' && (
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextContainer}>
              <Text style={styles.sectionLabel}>{t('bodyMetrics.pregnancySupport')}</Text>
              <Text style={styles.helpText}>{t('bodyMetrics.pregnancyHelp')}</Text>
            </View>
            <Switch value={isPregnant} onValueChange={setIsPregnant} color={colors.primary} />
          </View>

          {isPregnant && (
            <>
              <View style={styles.divider} />

              <Text style={styles.inputLabel}>{t('bodyMetrics.currentTrimester')}</Text>
              <View style={styles.pillRow}>
                <PillOption
                  label={t('bodyMetrics.trimesterFirstShort')}
                  flex
                  selected={trimester === 'FIRST'}
                  onPress={() => setTrimester('FIRST')}
                />
                <PillOption
                  label={t('bodyMetrics.trimesterSecondShort')}
                  flex
                  selected={trimester === 'SECOND'}
                  onPress={() => setTrimester('SECOND')}
                />
                <PillOption
                  label={t('bodyMetrics.trimesterThirdShort')}
                  flex
                  selected={trimester === 'THIRD'}
                  onPress={() => setTrimester('THIRD')}
                />
              </View>

              <TextInput
                label={t('bodyMetrics.prePregWeight')}
                value={prePregnancyWeight}
                onChangeText={setPrePregnancyWeight}
                keyboardType="decimal-pad"
                placeholder="65"
                style={styles.fullInput}
                {...inputProps}
              />

              <View style={[styles.infoChip, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.infoText, { color: '#92400E' }]}>
                  {t('bodyMetrics.pregnancyCalorieNote', {
                    calories: trimester === 'FIRST' ? '0' : trimester === 'SECOND' ? '340' : '452',
                    trimester: trimesterLabel
                  })}
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Weight Goals */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('bodyMetrics.weightGoals')}</Text>

        <View style={styles.rowInputs}>
          <TextInput
            label={t('bodyMetrics.currentWeight')}
            value={currentWeight}
            onChangeText={setCurrentWeight}
            keyboardType="decimal-pad"
            placeholder="70"
            style={isPregnant ? styles.fullInput : styles.halfInput}
            {...inputProps}
          />
          {!isPregnant && (
            <TextInput
              label={t('bodyMetrics.targetWeight')}
              value={targetWeight}
              onChangeText={setTargetWeight}
              keyboardType="decimal-pad"
              placeholder="65"
              style={styles.halfInput}
              {...inputProps}
            />
          )}
        </View>

        {!isPregnant && (
          <>
            <Text style={styles.inputLabel}>{t('bodyMetrics.fitnessGoal')}</Text>
            <View style={styles.optionRow}>
              <OptionCard
                icon="trending-down"
                label={t('bodyMetrics.lose')}
                selected={goal === 'LOSE_WEIGHT'}
                onPress={() => setGoal('LOSE_WEIGHT')}
              />
              <OptionCard
                icon="scale-balance"
                label={t('bodyMetrics.maintain')}
                selected={goal === 'MAINTAIN'}
                onPress={() => setGoal('MAINTAIN')}
              />
              <OptionCard
                icon="arm-flex-outline"
                label={t('bodyMetrics.gain')}
                selected={goal === 'BUILD_MUSCLE'}
                onPress={() => setGoal('BUILD_MUSCLE')}
              />
            </View>
          </>
        )}
      </View>

      {/* Activity Level */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('bodyMetrics.activityLevel')}</Text>

        <TextInput
          label={t('bodyMetrics.workoutsPerWeek')}
          value={workoutsPerWeek}
          onChangeText={setWorkoutsPerWeek}
          keyboardType="number-pad"
          placeholder="3"
          style={styles.fullInput}
          {...inputProps}
        />

        {!isPregnant && (
          <>
            <Text style={styles.inputLabel}>{t('bodyMetrics.targetDate')}</Text>
            <Text style={styles.targetDateHint}>{t('bodyMetrics.targetDateHint')}</Text>
            <Text style={styles.targetDateValue}>
              {targetDate.toLocaleDateString(localeCode, {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
            <View style={styles.pillRow}>
              {DATE_PRESETS.map(({ days, key }) => {
                const presetDate = new Date();
                presetDate.setDate(presetDate.getDate() + days);
                const selected = Math.abs(targetDate - presetDate) < 24 * 60 * 60 * 1000;
                return (
                  <PillOption
                    key={days}
                    label={t(`bodyMetrics.${key}`)}
                    flex
                    selected={selected}
                    onPress={() => handleDateChange(days)}
                  />
                );
              })}
            </View>

            <View style={styles.infoChip}>
              <Text style={styles.infoText}>
                {calculatedData.weeksToGoal > 0
                  ? t('bodyMetrics.weeksToGoal', {
                      weeks: calculatedData.weeksToGoal,
                      rate: calculatedData.weeklyWeightChange.toFixed(1)
                    })
                  : t('bodyMetrics.noWeeksToGoal')}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Calculated Plan */}
      {calculatedData.targetCalories > 0 && (
        <View style={[styles.card, styles.resultsCard]}>
          <Text style={styles.sectionLabel}>{t('bodyMetrics.planTitle')}</Text>

          {isPregnant && (
            <View style={[styles.infoChip, { backgroundColor: '#DCFCE7', marginBottom: 16 }]}>
              <Text style={[styles.infoText, { color: '#166534' }]}>
                {t('bodyMetrics.planPregnant', { trimester: trimesterLabel })}
              </Text>
            </View>
          )}

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>BMR</Text>
              <RNText style={styles.statValue}>{calculatedData.bmr}</RNText>
              <Text style={styles.statUnit}>{t('bodyMetrics.calPerDay')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>TDEE</Text>
              <RNText style={styles.statValue}>{calculatedData.tdee}</RNText>
              <Text style={styles.statUnit}>{t('bodyMetrics.calPerDay')}</Text>
            </View>
          </View>

          <View style={styles.planHero}>
            <Text style={styles.calorieLabel}>{t('bodyMetrics.dailyCalorieTarget')}</Text>
            <RNText style={styles.calorieValue}>{calculatedData.targetCalories}</RNText>
            <Text style={styles.calorieUnit}>{t('bodyMetrics.caloriesPerDay')}</Text>
          </View>

          <Text style={styles.macroTitle}>{t('bodyMetrics.macroBreakdown')}</Text>

          <View style={styles.macrosGrid}>
            <View style={styles.macroCard}>
              <View style={[styles.macroBar, { backgroundColor: colors.protein }]} />
              <Text style={styles.macroLabel}>{t('insights.protein')}</Text>
              <Text style={styles.macroValue}>{calculatedData.protein}g</Text>
              <Text style={styles.macroPercent}>{isPregnant ? '25%' : '30%'}</Text>
            </View>
            <View style={styles.macroCard}>
              <View style={[styles.macroBar, { backgroundColor: colors.carbs }]} />
              <Text style={styles.macroLabel}>{t('insights.carbs')}</Text>
              <Text style={styles.macroValue}>{calculatedData.carbs}g</Text>
              <Text style={styles.macroPercent}>{isPregnant ? '50%' : '40%'}</Text>
            </View>
            <View style={styles.macroCard}>
              <View style={[styles.macroBar, { backgroundColor: colors.fat }]} />
              <Text style={styles.macroLabel}>{t('insights.fat')}</Text>
              <Text style={styles.macroValue}>{calculatedData.fat}g</Text>
              <Text style={styles.macroPercent}>{isPregnant ? '25%' : '30%'}</Text>
            </View>
          </View>

          <TouchableOpacity activeOpacity={0.85} onPress={handleSave} disabled={saving}>
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.ctaButton, saving && { opacity: 0.6 }]}
            >
              <RNText style={styles.ctaLabel}>
                {saving ? t('common.loading') : t('bodyMetrics.saveMetrics')}
              </RNText>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  pageTitle: {
    ...type.display,
    fontSize: 28,
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
  resultsCard: {
    borderWidth: 1.5,
    borderColor: colors.tintBorder
  },
  sectionLabel: {
    ...type.overline,
    marginBottom: 12
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.faint,
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12
  },
  halfInput: {
    flex: 1,
    marginBottom: 12,
    backgroundColor: colors.surface
  },
  fullInput: {
    marginBottom: 4,
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
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.subtle,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 5
  },
  optionCardSelected: {
    backgroundColor: colors.tint,
    borderColor: colors.primary
  },
  optionCardLabel: {
    fontSize: 12,
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
    marginBottom: 4
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
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  },
  pillLabelSelected: {
    color: colors.primaryDark,
    fontWeight: '700'
  },
  infoChip: {
    backgroundColor: colors.tint,
    padding: 12,
    borderRadius: radius.md,
    marginTop: 12,
    marginBottom: 4
  },
  infoText: {
    color: colors.primaryDeep,
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center'
  },
  targetDateHint: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
    marginBottom: 10
  },
  targetDateValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 10
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.subtle,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center'
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5
  },
  statUnit: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },
  divider: {
    height: 1,
    backgroundColor: colors.subtle,
    marginVertical: 16
  },
  planHero: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 18,
    backgroundColor: colors.tint,
    borderRadius: radius.lg
  },
  calorieLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6
  },
  calorieValue: {
    fontSize: 44,
    fontWeight: '900',
    color: colors.primaryDark,
    letterSpacing: -2
  },
  calorieUnit: {
    fontSize: 13,
    color: colors.primary,
    marginTop: 2
  },
  macroTitle: {
    ...type.heading,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center'
  },
  macrosGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20
  },
  macroCard: {
    flex: 1,
    backgroundColor: colors.subtle,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center'
  },
  macroBar: {
    width: 20,
    height: 4,
    borderRadius: 2,
    marginBottom: 10
  },
  macroLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 2
  },
  macroPercent: {
    fontSize: 11,
    color: colors.muted
  },
  ctaButton: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    ...shadows.glow
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 16
  },
  helpText: {
    ...type.caption,
    marginTop: 4,
    lineHeight: 18
  }
});
