import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Text, Card, Button, TextInput, Surface, SegmentedButtons, Modal, Portal, Switch, Divider } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/firebase';
import { calculateNutritionPlanBackend } from '../../services/geminiService';

export default function BodyMetricsScreen({ navigation }) {
  const { user, refreshUserProfile, userProfile: authProfile } = useAuth();

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
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  useEffect(() => {
    if (authProfile) {
      loadProfileData();
    }
  }, [authProfile]);

  useEffect(() => {
    calculateAllBackend();
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
    // Validate required fields
    if (!birthMonth || !birthYear || !currentWeight || !height || workoutsPerWeek === undefined) {
      setCalculatedData({
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
      return;
    }

    try {
      const userData = {
        birthMonth: parseInt(birthMonth),
        birthYear: parseInt(birthYear),
        gender,
        currentWeight: parseFloat(currentWeight),
        targetWeight: parseFloat(targetWeight) || parseFloat(currentWeight),
        height: parseFloat(height),
        workoutsPerWeek: parseInt(workoutsPerWeek),
        goal: isPregnant ? 'MAINTAIN' : goal,
        targetDate: targetDate.toISOString(),
        isPregnant,
        trimester: isPregnant ? trimester : undefined,
        prePregnancyWeight: isPregnant ? parseFloat(prePregnancyWeight) || undefined : undefined
      };

      console.log('📊 Calling backend to calculate nutrition plan');
      const plan = await calculateNutritionPlanBackend(userData);

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

      console.log('✅ Nutrition plan calculated:', plan);
    } catch (error) {
      console.error('❌ Error calculating nutrition plan:', error);
      // Keep current calculated data on error
    }
  };

  const handleSave = async () => {
    if (!birthMonth || !birthYear || !currentWeight || !height) {
      showAlert('Missing Info', 'Please fill in all required fields');
      return;
    }

    if (isPregnant && gender === 'MALE') {
      showAlert('Invalid Selection', 'Pregnancy option is only available for female users');
      setIsPregnant(false);
      return;
    }

    setSaving(true);
    try {
      await userService.updateUserProfile(user.uid, {
        birthMonth: parseInt(birthMonth),
        birthYear: parseInt(birthYear),
        gender,
        currentWeight: parseFloat(currentWeight),
        targetWeight: parseFloat(targetWeight) || parseFloat(currentWeight),
        height: parseFloat(height),
        workoutsPerWeek: parseInt(workoutsPerWeek),
        goal: isPregnant ? 'MAINTAIN' : goal,
        targetDate: targetDate.toISOString(),

        // Pregnancy-specific fields
        isPregnant,
        trimester: isPregnant ? trimester : null,
        prePregnancyWeight: isPregnant ? parseFloat(prePregnancyWeight) || null : null,

        // Save calculated values
        dailyCalorieTarget: calculatedData.targetCalories,
        weekdayCalories: calculatedData.targetCalories,
        weekendCalories: calculatedData.targetCalories,
        proteinTarget: calculatedData.protein,
        carbsTarget: calculatedData.carbs,
        fatTarget: calculatedData.fat,

        updatedAt: new Date()
      });

      await refreshUserProfile();
      showAlert('Success', 'Body metrics updated successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error saving body metrics:', error);
      showAlert('Error', 'Failed to save body metrics');
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
    setShowDatePicker(false);
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.pageTitle}>
        Body Metrics
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        {isPregnant
          ? 'Maintain a healthy diet during pregnancy'
          : 'Track your progress toward your goals'}
      </Text>

      {/* Basic Info */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            📊 Basic Information
          </Text>

          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Birth Month</Text>
              <TextInput
                value={birthMonth}
                onChangeText={setBirthMonth}
                keyboardType="number-pad"
                mode="outlined"
                placeholder="1-12"
                maxLength={2}
                dense
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Birth Year</Text>
              <TextInput
                value={birthYear}
                onChangeText={setBirthYear}
                keyboardType="number-pad"
                mode="outlined"
                placeholder="1990"
                maxLength={4}
                dense
              />
            </View>
          </View>

          {calculatedData.age > 0 && (
            <Surface style={styles.infoChip}>
              <Text style={styles.infoText}>Age: {calculatedData.age} years old</Text>
            </Surface>
          )}

          <Text style={styles.inputLabel}>Gender</Text>
          <SegmentedButtons
            value={gender}
            onValueChange={setGender}
            buttons={[
              { value: 'MALE', label: 'Male' },
              { value: 'FEMALE', label: 'Female' }
            ]}
            style={styles.segmented}
          />

          <Text style={styles.inputLabel}>Height (cm)</Text>
          <TextInput
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            mode="outlined"
            placeholder="170"
            dense
            style={styles.fullInput}
          />
        </Card.Content>
      </Card>

      {/* Pregnancy Support */}
      {gender === 'FEMALE' && (
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextContainer}>
                <Text variant="titleLarge" style={styles.sectionTitle}>
                  🤰 Pregnancy Support
                </Text>
                <Text variant="bodySmall" style={styles.helpText}>
                  Get nutrition guidance for a healthy pregnancy
                </Text>
              </View>
              <Switch value={isPregnant} onValueChange={setIsPregnant} />
            </View>

            {isPregnant && (
              <>
                <Divider style={styles.divider} />

                <Text style={styles.inputLabel}>Current Trimester</Text>
                <SegmentedButtons
                  value={trimester}
                  onValueChange={setTrimester}
                  buttons={[
                    { value: 'FIRST', label: '1st' },
                    { value: 'SECOND', label: '2nd' },
                    { value: 'THIRD', label: '3rd' }
                  ]}
                  style={styles.segmented}
                />

                <Text style={styles.inputLabel}>Pre-Pregnancy Weight (kg)</Text>
                <TextInput
                  value={prePregnancyWeight}
                  onChangeText={setPrePregnancyWeight}
                  keyboardType="decimal-pad"
                  mode="outlined"
                  placeholder="65"
                  dense
                  style={styles.fullInput}
                />

                <Surface style={[styles.infoChip, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.infoText, { color: '#92400E' }]}>
                    💡 Your calorie target includes the recommended {trimester === 'FIRST' ? '0' : trimester === 'SECOND' ? '340' : '452'} extra calories for {trimester === 'FIRST' ? '1st' : trimester === 'SECOND' ? '2nd' : '3rd'} trimester
                  </Text>
                </Surface>
              </>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Weight Goals */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            ⚖️ Weight & Goals
          </Text>

          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Current Weight (kg)</Text>
              <TextInput
                value={currentWeight}
                onChangeText={setCurrentWeight}
                keyboardType="decimal-pad"
                mode="outlined"
                placeholder="70"
                dense
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Target Weight (kg)</Text>
              <TextInput
                value={targetWeight}
                onChangeText={setTargetWeight}
                keyboardType="decimal-pad"
                mode="outlined"
                placeholder="65"
                dense
                editable={!isPregnant}
              />
            </View>
          </View>

          {!isPregnant && (
            <>
              <Text style={styles.inputLabel}>Fitness Goal</Text>
              <SegmentedButtons
                value={goal}
                onValueChange={setGoal}
                buttons={[
                  { value: 'LOSE_WEIGHT', label: 'Lose' },
                  { value: 'MAINTAIN', label: 'Maintain' },
                  { value: 'BUILD_MUSCLE', label: 'Gain' }
                ]}
                style={styles.segmented}
              />
            </>
          )}
        </Card.Content>
      </Card>

      {/* Activity Level */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            🏃 Activity Level
          </Text>

          <Text style={styles.inputLabel}>Workouts per Week</Text>
          <TextInput
            value={workoutsPerWeek}
            onChangeText={setWorkoutsPerWeek}
            keyboardType="number-pad"
            mode="outlined"
            placeholder="3"
            dense
            style={styles.fullInput}
          />

          {!isPregnant && (
            <>
              <Text style={styles.inputLabel}>Target Date</Text>
              <Button
                mode="outlined"
                onPress={() => setShowDatePicker(true)}
                icon="calendar"
                style={styles.dateButton}
              >
                {targetDate.toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Button>

              <Portal>
                <Modal
                  visible={showDatePicker}
                  onDismiss={() => setShowDatePicker(false)}
                  contentContainerStyle={styles.dateModal}
                >
                  <Text variant="titleLarge" style={styles.modalTitle}>
                    When do you want to reach your goal?
                  </Text>

                  <View style={styles.dateOptions}>
                    <Button
                      mode="outlined"
                      onPress={() => handleDateChange(30)}
                      style={styles.dateOption}
                    >
                      1 Month
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => handleDateChange(60)}
                      style={styles.dateOption}
                    >
                      2 Months
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => handleDateChange(90)}
                      style={styles.dateOption}
                    >
                      3 Months
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => handleDateChange(180)}
                      style={styles.dateOption}
                    >
                      6 Months
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => handleDateChange(365)}
                      style={styles.dateOption}
                    >
                      1 Year
                    </Button>
                  </View>

                  <Button
                    mode="text"
                    onPress={() => setShowDatePicker(false)}
                    style={styles.modalClose}
                  >
                    Close
                  </Button>
                </Modal>
              </Portal>

              {calculatedData.weeksToGoal > 0 && (
                <Surface style={styles.infoChip}>
                  <Text style={styles.infoText}>
                    ~{calculatedData.weeksToGoal} weeks • {calculatedData.weeklyWeightChange.toFixed(1)}kg/week
                  </Text>
                </Surface>
              )}
            </>
          )}
        </Card.Content>
      </Card>

      {/* Calculated Plan */}
      {calculatedData.targetCalories > 0 && (
        <Card style={styles.resultsCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              ✨ Your Personalized Plan
            </Text>

            {isPregnant && (
              <Surface style={[styles.infoChip, { backgroundColor: '#DCFCE7', marginBottom: 16 }]}>
                <Text style={[styles.infoText, { color: '#166534' }]}>
                  🌟 This plan is optimized for a healthy pregnancy in your {trimester === 'FIRST' ? '1st' : trimester === 'SECOND' ? '2nd' : '3rd'} trimester
                </Text>
              </Surface>
            )}

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>BMR</Text>
                <Text style={styles.statValue}>{calculatedData.bmr}</Text>
                <Text style={styles.statUnit}>cal/day</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>TDEE</Text>
                <Text style={styles.statValue}>{calculatedData.tdee}</Text>
                <Text style={styles.statUnit}>cal/day</Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.calorieTarget}>
              <Text style={styles.calorieLabel}>Daily Calorie Target</Text>
              <Text style={styles.calorieValue}>{calculatedData.targetCalories}</Text>
              <Text style={styles.calorieUnit}>calories/day</Text>
            </View>

            <Divider style={styles.divider} />

            <Text variant="titleMedium" style={styles.macroTitle}>
              Macro Breakdown
            </Text>

            <View style={styles.macrosGrid}>
              <View style={styles.macroCard}>
                <View style={[styles.macroBar, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.macroLabel}>Protein</Text>
                <Text style={styles.macroValue}>{calculatedData.protein}g</Text>
                <Text style={styles.macroPercent}>{isPregnant ? '25%' : '30%'}</Text>
              </View>
              <View style={styles.macroCard}>
                <View style={[styles.macroBar, { backgroundColor: '#10B981' }]} />
                <Text style={styles.macroLabel}>Carbs</Text>
                <Text style={styles.macroValue}>{calculatedData.carbs}g</Text>
                <Text style={styles.macroPercent}>{isPregnant ? '50%' : '40%'}</Text>
              </View>
              <View style={styles.macroCard}>
                <View style={[styles.macroBar, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.macroLabel}>Fat</Text>
                <Text style={styles.macroValue}>{calculatedData.fat}g</Text>
                <Text style={styles.macroPercent}>{isPregnant ? '25%' : '30%'}</Text>
              </View>
            </View>

            <Button
              mode="contained"
              onPress={handleSave}
              loading={saving}
              disabled={saving}
              style={styles.saveButton}
              contentStyle={styles.saveButtonContent}
            >
              Save Metrics
            </Button>
          </Card.Content>
        </Card>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    padding: 20
  },
  pageTitle: {
    marginBottom: 8,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -1
  },
  subtitle: {
    marginBottom: 24,
    color: '#64748B'
  },
  card: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  resultsCard: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#6366F1',
    ...Platform.select({
      web: {
        boxShadow: '0px 8px 32px rgba(99, 102, 241, 0.2)',
      },
    }),
  },
  sectionTitle: {
    marginBottom: 20,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.5
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12
  },
  halfInput: {
    flex: 1
  },
  fullInput: {
    marginBottom: 8
  },
  segmented: {
    marginBottom: 8
  },
  infoChip: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 8,
    elevation: 0
  },
  infoText: {
    color: '#0369A1',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center'
  },
  dateButton: {
    marginBottom: 8
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center'
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 8
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B'
  },
  statUnit: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4
  },
  divider: {
    marginVertical: 20
  },
  calorieTarget: {
    alignItems: 'center',
    paddingVertical: 20
  },
  calorieLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 12
  },
  calorieValue: {
    fontSize: 56,
    fontWeight: '900',
    color: '#6366F1',
    letterSpacing: -2
  },
  calorieUnit: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4
  },
  macroTitle: {
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
    textAlign: 'center'
  },
  macrosGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24
  },
  macroCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center'
  },
  macroBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginBottom: 12
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 8
  },
  macroValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4
  },
  macroPercent: {
    fontSize: 12,
    color: '#64748B'
  },
  saveButton: {
    marginTop: 8
  },
  saveButtonContent: {
    paddingVertical: 8
  },
  dateModal: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 24,
    borderRadius: 20
  },
  modalTitle: {
    marginBottom: 20,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center'
  },
  dateOptions: {
    gap: 12,
    marginBottom: 20
  },
  dateOption: {
    borderRadius: 12
  },
  modalClose: {
    marginTop: 8
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
    color: '#64748B',
    marginTop: 4,
    lineHeight: 20
  }
});
