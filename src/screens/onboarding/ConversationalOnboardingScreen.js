import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { Button, Text, Surface, Chip, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useOnboarding } from '../../context/OnboardingContext';

// Helper function to calculate TDEE
const calculateTDEEForData = (data) => {
  const { age, weight, height, gender, activityLevel, weightUnit, heightUnit } = data;

  // Convert to metric if needed
  let weightKg = weightUnit === 'lbs' ? weight * 0.453592 : weight;
  let heightCm = heightUnit === 'ft' ? height * 30.48 : height;

  // Mifflin-St Jeor Equation
  let bmr;
  if (gender === 'MALE') {
    bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
  } else {
    bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
  }

  // Activity multipliers
  const activityMultipliers = {
    SEDENTARY: 1.2,
    LIGHT: 1.375,
    MODERATE: 1.55,
    ACTIVE: 1.725,
    VERY_ACTIVE: 1.9
  };

  return Math.round(bmr * activityMultipliers[activityLevel || 'MODERATE']);
};

export default function ConversationalOnboardingScreen({ navigation }) {
  const { updateOnboardingData } = useOnboarding();
  const scrollViewRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [conversationStage, setConversationStage] = useState('GOAL');
  const [collectedData, setCollectedData] = useState({
    age: 30,
    weight: 70,
    weightUnit: 'kg',
    height: 170,
    heightUnit: 'cm',
    gender: 'MALE'
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [aiMessage, setAiMessage] = useState("Hey! 👋 I'm your AI nutrition coach. Let's create your personalized plan.\n\nWhat's your main goal?");

  // Fade in when stage changes
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [conversationStage, aiMessage]);

  const handleGoalSelect = (goal) => {
    setCollectedData(prev => ({ ...prev, goal }));

    const goalMessages = {
      'LOSE_WEIGHT': "Great! Let's create a sustainable plan to lose weight. 🎯",
      'BUILD_MUSCLE': "Perfect! We'll focus on building muscle. 💪",
      'MAINTAIN': "Awesome! Let's maintain your health. ⚖️",
      'EXPLORING': "Cool! Let's explore what works for you. 🧭"
    };

    setAiMessage(goalMessages[goal] + "\n\nNow tell me about yourself:");
    setConversationStage('BIOMETRICS');
  };

  const handleBiometricsComplete = () => {
    setAiMessage("Perfect! One last thing - how active are you?");
    setConversationStage('ACTIVITY');
  };

  const handleActivitySelect = async (workouts) => {
    let activityLevel = 'MODERATE';
    if (workouts === 0) activityLevel = 'SEDENTARY';
    else if (workouts <= 2) activityLevel = 'LIGHT';
    else if (workouts <= 4) activityLevel = 'MODERATE';
    else if (workouts <= 6) activityLevel = 'ACTIVE';
    else activityLevel = 'VERY_ACTIVE';

    const finalData = {
      ...collectedData,
      workoutsPerWeek: workouts,
      activityLevel
    };

    setCollectedData(finalData);
    setAiMessage("Analyzing your profile... 🧠");
    setConversationStage('ANALYZING');

    await generatePersonalizedPlan(finalData);
  };

  const generatePersonalizedPlan = async (data) => {
    setIsProcessing(true);

    try {
      await updateOnboardingData({
        goal: data.goal,
        age: data.age,
        weight: data.weight,
        height: data.height,
        weightUnit: data.weightUnit,
        heightUnit: data.heightUnit,
        gender: data.gender,
        workoutsPerWeek: data.workoutsPerWeek,
        activityLevel: data.activityLevel,
        bodyType: 'MESOMORPH'
      });

      const tdee = calculateTDEEForData(data);

      // Calculate plan based on goal
      let dailyCalories = tdee;
      if (data.goal === 'LOSE_WEIGHT') dailyCalories = Math.round(tdee * 0.85);
      else if (data.goal === 'BUILD_MUSCLE') dailyCalories = Math.round(tdee * 1.10);

      const plan = {
        tdee,
        strategy: 'CHALLENGING',
        dailyCalories,
        protein: Math.round((dailyCalories * 0.30) / 4),
        carbs: Math.round((dailyCalories * 0.40) / 4),
        fat: Math.round((dailyCalories * 0.30) / 9),
        weekendFlexibility: false
      };

      setGeneratedPlan(plan);

      const goalEmoji = data.goal === 'LOSE_WEIGHT' ? '🎯' : data.goal === 'BUILD_MUSCLE' ? '💪' : '⚖️';
      setAiMessage(`${goalEmoji} Here's your personalized plan:\n\nBased on your stats, your maintenance is ${tdee} cal/day.`);
      setConversationStage('PLAN_REVIEW');
    } catch (error) {
      console.error('Error generating plan:', error);
      setAiMessage("Let me try that again...");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlanApprove = () => {
    updateOnboardingData({
      dailyCalorieTarget: generatedPlan.dailyCalories,
      proteinTarget: generatedPlan.protein,
      carbsTarget: generatedPlan.carbs,
      fatTarget: generatedPlan.fat,
      strategy: generatedPlan.strategy
    });

    setAiMessage("Perfect! Let's create your account. 🎉");
    setTimeout(() => {
      navigation.navigate('Signup');
    }, 1500);
  };

  const adjustCalories = (amount) => {
    const adjusted = {
      ...generatedPlan,
      dailyCalories: generatedPlan.dailyCalories + amount,
      protein: Math.round(((generatedPlan.dailyCalories + amount) * 0.30) / 4),
      carbs: Math.round(((generatedPlan.dailyCalories + amount) * 0.40) / 4),
      fat: Math.round(((generatedPlan.dailyCalories + amount) * 0.30) / 9),
    };
    setGeneratedPlan(adjusted);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* AI Message */}
        <Animated.View style={[styles.aiMessageContainer, { opacity: fadeAnim }]}>
          <Surface style={styles.aiMessageBubble}>
            <Text style={styles.aiMessageText}>{aiMessage}</Text>
          </Surface>
        </Animated.View>

        {/* Goal Selection */}
        {conversationStage === 'GOAL' && (
          <Animated.View style={[styles.interactionContainer, { opacity: fadeAnim }]}>
            <View style={styles.quickReplies}>
              <Chip
                mode="outlined"
                onPress={() => handleGoalSelect('LOSE_WEIGHT')}
                style={styles.goalChip}
                textStyle={styles.chipText}
              >
                🎯 Lose weight
              </Chip>
              <Chip
                mode="outlined"
                onPress={() => handleGoalSelect('BUILD_MUSCLE')}
                style={styles.goalChip}
                textStyle={styles.chipText}
              >
                💪 Build muscle
              </Chip>
              <Chip
                mode="outlined"
                onPress={() => handleGoalSelect('MAINTAIN')}
                style={styles.goalChip}
                textStyle={styles.chipText}
              >
                ⚖️ Stay healthy
              </Chip>
              <Chip
                mode="outlined"
                onPress={() => handleGoalSelect('EXPLORING')}
                style={styles.goalChip}
                textStyle={styles.chipText}
              >
                🧭 Just exploring
              </Chip>
            </View>
          </Animated.View>
        )}

        {/* Biometrics Selection */}
        {conversationStage === 'BIOMETRICS' && (
          <Animated.View style={[styles.interactionContainer, { opacity: fadeAnim }]}>
            <Surface style={styles.inputCard}>
              {/* Gender */}
              <View style={styles.section}>
                <Text style={styles.label}>Gender</Text>
                <SegmentedButtons
                  value={collectedData.gender}
                  onValueChange={(value) => setCollectedData(prev => ({ ...prev, gender: value }))}
                  buttons={[
                    { value: 'MALE', label: 'Male' },
                    { value: 'FEMALE', label: 'Female' }
                  ]}
                  style={styles.segmentedButtons}
                />
              </View>

              {/* Age */}
              <View style={styles.section}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Age</Text>
                  <Text style={styles.value}>{collectedData.age} years</Text>
                </View>
                <Slider
                  value={collectedData.age}
                  onValueChange={(val) => setCollectedData(prev => ({ ...prev, age: Math.round(val) }))}
                  minimumValue={18}
                  maximumValue={80}
                  minimumTrackTintColor="#6366F1"
                  maximumTrackTintColor="#CBD5E1"
                  thumbTintColor="#6366F1"
                  step={1}
                />
              </View>

              {/* Weight */}
              <View style={styles.section}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Weight</Text>
                  <Text style={styles.value}>{collectedData.weight} {collectedData.weightUnit}</Text>
                </View>
                <Slider
                  value={collectedData.weight}
                  onValueChange={(val) => setCollectedData(prev => ({ ...prev, weight: Math.round(val) }))}
                  minimumValue={collectedData.weightUnit === 'kg' ? 40 : 90}
                  maximumValue={collectedData.weightUnit === 'kg' ? 150 : 330}
                  minimumTrackTintColor="#6366F1"
                  maximumTrackTintColor="#CBD5E1"
                  thumbTintColor="#6366F1"
                  step={1}
                />
              </View>

              {/* Height */}
              <View style={styles.section}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Height</Text>
                  <Text style={styles.value}>{collectedData.height} {collectedData.heightUnit}</Text>
                </View>
                <Slider
                  value={collectedData.height}
                  onValueChange={(val) => setCollectedData(prev => ({ ...prev, height: Math.round(val) }))}
                  minimumValue={collectedData.heightUnit === 'cm' ? 140 : 4.5}
                  maximumValue={collectedData.heightUnit === 'cm' ? 220 : 7.5}
                  minimumTrackTintColor="#6366F1"
                  maximumTrackTintColor="#CBD5E1"
                  thumbTintColor="#6366F1"
                  step={collectedData.heightUnit === 'cm' ? 1 : 0.1}
                />
              </View>

              <Button
                mode="contained"
                onPress={handleBiometricsComplete}
                style={styles.continueButton}
              >
                Continue
              </Button>
            </Surface>
          </Animated.View>
        )}

        {/* Activity Selection */}
        {conversationStage === 'ACTIVITY' && (
          <Animated.View style={[styles.interactionContainer, { opacity: fadeAnim }]}>
            <View style={styles.quickReplies}>
              <Chip mode="outlined" onPress={() => handleActivitySelect(0)} style={styles.activityChip}>
                😴 None
              </Chip>
              <Chip mode="outlined" onPress={() => handleActivitySelect(2)} style={styles.activityChip}>
                🚶 1-2 times/week
              </Chip>
              <Chip mode="outlined" onPress={() => handleActivitySelect(4)} style={styles.activityChip}>
                🏃 3-4 times/week
              </Chip>
              <Chip mode="outlined" onPress={() => handleActivitySelect(6)} style={styles.activityChip}>
                🏋️ 5-6 times/week
              </Chip>
              <Chip mode="outlined" onPress={() => handleActivitySelect(7)} style={styles.activityChip}>
                ⚡ Every day
              </Chip>
            </View>
          </Animated.View>
        )}

        {/* Loading */}
        {conversationStage === 'ANALYZING' && isProcessing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        )}

        {/* Plan Review */}
        {conversationStage === 'PLAN_REVIEW' && generatedPlan && (
          <Animated.View style={[styles.interactionContainer, { opacity: fadeAnim }]}>
            <Surface style={styles.planCard}>
              <View style={styles.planStats}>
                <View style={styles.planStat}>
                  <Text style={styles.planStatValue}>{generatedPlan.dailyCalories}</Text>
                  <Text style={styles.planStatLabel}>Daily Calories</Text>
                </View>
                <View style={styles.planDivider} />
                <View style={styles.macrosContainer}>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{generatedPlan.protein}g</Text>
                    <Text style={styles.macroLabel}>Protein</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{generatedPlan.carbs}g</Text>
                    <Text style={styles.macroLabel}>Carbs</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{generatedPlan.fat}g</Text>
                    <Text style={styles.macroLabel}>Fat</Text>
                  </View>
                </View>
              </View>

              <View style={styles.adjustments}>
                <Text style={styles.adjustLabel}>Need adjustments?</Text>
                <View style={styles.adjustButtons}>
                  <Button mode="outlined" onPress={() => adjustCalories(-100)} style={styles.adjustButton}>
                    -100 cal
                  </Button>
                  <Button mode="outlined" onPress={() => adjustCalories(100)} style={styles.adjustButton}>
                    +100 cal
                  </Button>
                </View>
              </View>

              <Button
                mode="contained"
                onPress={handlePlanApprove}
                style={styles.approveButton}
                icon="check-circle"
              >
                Looks perfect!
              </Button>
            </Surface>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9'
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40
  },
  aiMessageContainer: {
    marginBottom: 24
  },
  aiMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderBottomLeftRadius: 4,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
      },
    }),
  },
  aiMessageText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1E293B'
  },
  interactionContainer: {
    marginBottom: 20
  },
  quickReplies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  goalChip: {
    marginBottom: 10,
    minWidth: '45%'
  },
  activityChip: {
    marginBottom: 10,
    width: '100%'
  },
  chipText: {
    fontSize: 15
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 12px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  section: {
    marginBottom: 24
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1'
  },
  segmentedButtons: {
    backgroundColor: 'transparent'
  },
  continueButton: {
    marginTop: 8
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center'
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 12px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  planStats: {
    marginBottom: 24
  },
  planStat: {
    alignItems: 'center',
    marginBottom: 20
  },
  planStatValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#6366F1',
    marginBottom: 4
  },
  planStatLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600'
  },
  planDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 20
  },
  macrosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  macroItem: {
    alignItems: 'center'
  },
  macroValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4
  },
  macroLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600'
  },
  adjustments: {
    marginBottom: 20
  },
  adjustLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
    textAlign: 'center'
  },
  adjustButtons: {
    flexDirection: 'row',
    gap: 12
  },
  adjustButton: {
    flex: 1
  },
  approveButton: {
    paddingVertical: 6
  }
});
