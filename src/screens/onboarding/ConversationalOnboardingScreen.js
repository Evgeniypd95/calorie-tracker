import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Animated, TextInput, Dimensions } from 'react-native';
import { Button, Text, Surface, Chip, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useOnboarding } from '../../context/OnboardingContext';

const { width } = Dimensions.get('window');

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
    // Use female formula for FEMALE and OTHER
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

// Generate example meals based on calorie target
const generateExampleMeals = (calories, protein, carbs, fat) => {
  const breakfastCals = Math.round(calories * 0.25);
  const lunchCals = Math.round(calories * 0.35);
  const dinnerCals = Math.round(calories * 0.30);
  const snackCals = Math.round(calories * 0.10);

  return [
    {
      type: 'Breakfast',
      calories: breakfastCals,
      example: breakfastCals < 400
        ? '2 eggs, whole wheat toast, avocado'
        : '3 eggs, oatmeal with berries, Greek yogurt'
    },
    {
      type: 'Lunch',
      calories: lunchCals,
      example: lunchCals < 500
        ? 'Grilled chicken salad, quinoa'
        : 'Chicken breast, brown rice, vegetables, olive oil'
    },
    {
      type: 'Dinner',
      calories: dinnerCals,
      example: dinnerCals < 500
        ? 'Salmon, sweet potato, broccoli'
        : 'Steak, pasta, mixed vegetables, cheese'
    },
    {
      type: 'Snack',
      calories: snackCals,
      example: 'Protein shake or nuts'
    }
  ];
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
    targetWeight: null,
    height: 170,
    heightUnit: 'cm',
    gender: 'MALE',
    deadline: null
  });
  const [customGoalText, setCustomGoalText] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [exampleMeals, setExampleMeals] = useState([]);
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
    if (goal === 'OTHER') {
      setAiMessage("Tell me about your goal - what do you want to achieve? 💭");
      setConversationStage('CUSTOM_GOAL');
      return;
    }

    setCollectedData(prev => ({ ...prev, goal }));

    const goalMessages = {
      'LOSE_WEIGHT': "Great! Let's create a sustainable plan to lose weight. 🎯",
      'BUILD_MUSCLE': "Perfect! We'll focus on building muscle. 💪",
      'MAINTAIN': "Awesome! Let's maintain your health. ⚖️"
    };

    setAiMessage(goalMessages[goal] + "\n\nNow tell me about yourself:");
    setConversationStage('BIOMETRICS');
  };

  const handleCustomGoalSubmit = () => {
    if (!customGoalText.trim()) return;

    // Simple parsing - look for keywords
    let parsedGoal = 'MAINTAIN';
    const lowerText = customGoalText.toLowerCase();

    if (lowerText.includes('lose') || lowerText.includes('cut') || lowerText.includes('fat') || lowerText.includes('slim')) {
      parsedGoal = 'LOSE_WEIGHT';
    } else if (lowerText.includes('gain') || lowerText.includes('muscle') || lowerText.includes('bulk') || lowerText.includes('build')) {
      parsedGoal = 'BUILD_MUSCLE';
    }

    setCollectedData(prev => ({ ...prev, goal: parsedGoal, customGoal: customGoalText }));
    setAiMessage(`Got it! I'll help you with that. 💪\n\nNow tell me about yourself:`);
    setConversationStage('BIOMETRICS');
  };

  const handleBiometricsComplete = () => {
    const needsTargetWeight = collectedData.goal === 'LOSE_WEIGHT' || collectedData.goal === 'BUILD_MUSCLE';

    if (needsTargetWeight) {
      const defaultTarget = collectedData.goal === 'LOSE_WEIGHT'
        ? Math.round(collectedData.weight * 0.9)
        : Math.round(collectedData.weight * 1.05);

      setCollectedData(prev => ({ ...prev, targetWeight: defaultTarget }));
      setAiMessage(`What's your target weight? 🎯`);
      setConversationStage('TARGET_WEIGHT');
    } else {
      setAiMessage("Perfect! How active are you?");
      setConversationStage('ACTIVITY');
    }
  };

  const handleTargetWeightComplete = () => {
    setAiMessage("Perfect! How active are you?");
    setConversationStage('ACTIVITY');
  };

  const handleActivitySelect = (workouts) => {
    let activityLevel = 'MODERATE';
    if (workouts === 0) activityLevel = 'SEDENTARY';
    else if (workouts <= 2) activityLevel = 'LIGHT';
    else if (workouts <= 4) activityLevel = 'MODERATE';
    else if (workouts <= 6) activityLevel = 'ACTIVE';
    else activityLevel = 'VERY_ACTIVE';

    setCollectedData(prev => ({ ...prev, workoutsPerWeek: workouts, activityLevel }));

    // Only show deadline if there's a target weight
    if (collectedData.targetWeight) {
      setAiMessage("When do you want to reach your goal? ⏰\n\nPick a deadline and see your success probability:");
      setConversationStage('DEADLINE');
    } else {
      proceedToAnalyzing({ ...collectedData, workoutsPerWeek: workouts, activityLevel });
    }
  };

  const calculateDeadlineProbability = (weeks) => {
    const weightDiff = Math.abs(collectedData.weight - collectedData.targetWeight);
    const weeklyChange = weightDiff / weeks;

    // Healthy rate: 0.5-1kg per week for loss, 0.25-0.5kg per week for gain
    const isLoss = collectedData.goal === 'LOSE_WEIGHT';
    const healthyMin = isLoss ? 0.5 : 0.25;
    const healthyMax = isLoss ? 1.0 : 0.5;
    const aggressive = isLoss ? 1.5 : 0.75;

    if (weeklyChange <= healthyMax) {
      return { probability: 95, level: 'High', color: '#10B981', description: 'Sustainable & realistic' };
    } else if (weeklyChange <= aggressive) {
      return { probability: 70, level: 'Moderate', color: '#F59E0B', description: 'Challenging but possible' };
    } else if (weeklyChange <= aggressive * 1.5) {
      return { probability: 40, level: 'Low', color: '#EF4444', description: 'Very aggressive' };
    } else {
      return { probability: 10, level: 'Very Low', color: '#DC2626', description: 'Extremely difficult' };
    }
  };

  const handleDeadlineSelect = (weeks) => {
    setCollectedData(prev => ({ ...prev, deadline: weeks }));
    proceedToAnalyzing({ ...collectedData, deadline: weeks });
  };

  const proceedToAnalyzing = async (finalData) => {
    setAiMessage("Analyzing your profile... 🧠");
    setConversationStage('ANALYZING');
    await generatePersonalizedPlan(finalData);
  };

  const generatePersonalizedPlan = async (data) => {
    setIsProcessing(true);

    try {
      await updateOnboardingData({
        goal: data.goal,
        customGoal: data.customGoal,
        age: data.age,
        weight: data.weight,
        targetWeight: data.targetWeight,
        height: data.height,
        weightUnit: data.weightUnit,
        heightUnit: data.heightUnit,
        gender: data.gender,
        workoutsPerWeek: data.workoutsPerWeek,
        activityLevel: data.activityLevel,
        deadline: data.deadline,
        bodyType: 'MESOMORPH'
      });

      const tdee = calculateTDEEForData(data);

      // Calculate plan based on goal and deadline
      let dailyCalories = tdee;

      if (data.targetWeight && data.deadline) {
        const weightDiff = data.weight - data.targetWeight; // positive = need to lose
        const totalWeeks = data.deadline;
        const weeklyChange = weightDiff / totalWeeks; // kg per week
        const dailyCalorieDeficit = (weeklyChange * 7700) / 7; // 7700 cal per kg of fat

        dailyCalories = Math.round(tdee - dailyCalorieDeficit);

        // Safety bounds
        const minCalories = data.gender === 'MALE' ? 1500 : 1200;
        const maxCalories = tdee * 1.2;
        dailyCalories = Math.max(minCalories, Math.min(maxCalories, dailyCalories));
      } else if (data.goal === 'LOSE_WEIGHT') {
        dailyCalories = Math.round(tdee * 0.85);
      } else if (data.goal === 'BUILD_MUSCLE') {
        dailyCalories = Math.round(tdee * 1.10);
      }

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

      // Generate example meals
      const meals = generateExampleMeals(plan.dailyCalories, plan.protein, plan.carbs, plan.fat);
      setExampleMeals(meals);

      const goalEmoji = data.goal === 'LOSE_WEIGHT' ? '🎯' : data.goal === 'BUILD_MUSCLE' ? '💪' : '⚖️';
      setAiMessage(`${goalEmoji} Here's your personalized plan:\n\nBased on your stats, your maintenance is ${tdee} cal/day (includes basal metabolism + exercise).`);
      setConversationStage('PLAN_REVIEW');
    } catch (error) {
      console.error('Error generating plan:', error);
      setAiMessage("Let me try that again...");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlanContinue = () => {
    setAiMessage("Here's what a typical day could look like: 🍽️");
    setConversationStage('FOOD_PREVIEW');
  };

  const handleFoodPreviewContinue = () => {
    setAiMessage("Any thoughts or adjustments you'd like to make? 💭");
    setConversationStage('FEEDBACK');
  };

  const handleFeedbackSubmit = () => {
    let adjustedPlan = { ...generatedPlan };

    if (feedbackText.trim()) {
      updateOnboardingData({ userFeedback: feedbackText });

      // Parse feedback and adjust plan
      const feedback = feedbackText.toLowerCase();

      // Protein adjustments
      if (feedback.includes('more protein') || feedback.includes('high protein') || feedback.includes('increase protein')) {
        adjustedPlan.protein = Math.round(adjustedPlan.protein * 1.3);
        adjustedPlan.carbs = Math.round(adjustedPlan.carbs * 0.85);
      } else if (feedback.includes('less protein') || feedback.includes('lower protein') || feedback.includes('reduce protein')) {
        adjustedPlan.protein = Math.round(adjustedPlan.protein * 0.7);
        adjustedPlan.carbs = Math.round(adjustedPlan.carbs * 1.15);
      }

      // Carb adjustments
      if (feedback.includes('more carbs') || feedback.includes('high carb') || feedback.includes('increase carbs')) {
        adjustedPlan.carbs = Math.round(adjustedPlan.carbs * 1.3);
        adjustedPlan.fat = Math.round(adjustedPlan.fat * 0.85);
      } else if (feedback.includes('less carbs') || feedback.includes('low carb') || feedback.includes('reduce carbs') || feedback.includes('keto')) {
        adjustedPlan.carbs = Math.round(adjustedPlan.carbs * 0.5);
        adjustedPlan.fat = Math.round(adjustedPlan.fat * 1.4);
      }

      // Fat adjustments
      if (feedback.includes('more fat') || feedback.includes('high fat') || feedback.includes('increase fat')) {
        adjustedPlan.fat = Math.round(adjustedPlan.fat * 1.3);
        adjustedPlan.carbs = Math.round(adjustedPlan.carbs * 0.85);
      } else if (feedback.includes('less fat') || feedback.includes('low fat') || feedback.includes('reduce fat')) {
        adjustedPlan.fat = Math.round(adjustedPlan.fat * 0.7);
        adjustedPlan.carbs = Math.round(adjustedPlan.carbs * 1.15);
      }

      // Calorie adjustments
      if (feedback.includes('more calories') || feedback.includes('increase calories') || feedback.includes('eat more')) {
        adjustedPlan.dailyCalories = Math.round(adjustedPlan.dailyCalories * 1.1);
        adjustedPlan.protein = Math.round((adjustedPlan.dailyCalories * 0.30) / 4);
        adjustedPlan.carbs = Math.round((adjustedPlan.dailyCalories * 0.40) / 4);
        adjustedPlan.fat = Math.round((adjustedPlan.dailyCalories * 0.30) / 9);
      } else if (feedback.includes('less calories') || feedback.includes('reduce calories') || feedback.includes('eat less')) {
        adjustedPlan.dailyCalories = Math.round(adjustedPlan.dailyCalories * 0.9);
        adjustedPlan.protein = Math.round((adjustedPlan.dailyCalories * 0.30) / 4);
        adjustedPlan.carbs = Math.round((adjustedPlan.dailyCalories * 0.40) / 4);
        adjustedPlan.fat = Math.round((adjustedPlan.dailyCalories * 0.30) / 9);
      }

      // Special diets
      if (feedback.includes('vegetarian') || feedback.includes('vegan') || feedback.includes('plant-based')) {
        updateOnboardingData({ dietaryRestrictions: 'vegetarian' });
      }

      setGeneratedPlan(adjustedPlan);

      // Show the updated plan
      setAiMessage("Got it! I've adjusted your plan based on your feedback. Here's the updated version:");
      setConversationStage('PLAN_REVIEW');
      return;
    }

    // If no feedback, proceed to signup
    updateOnboardingData({
      dailyCalorieTarget: adjustedPlan.dailyCalories,
      proteinTarget: adjustedPlan.protein,
      carbsTarget: adjustedPlan.carbs,
      fatTarget: adjustedPlan.fat,
      strategy: adjustedPlan.strategy
    });

    setAiMessage("Perfect! Let's create your account. 🎉");
    setTimeout(() => {
      navigation.navigate('Signup');
    }, 1500);
  };

  const adjustCalories = (amount) => {
    const newCalories = generatedPlan.dailyCalories + amount;
    const adjusted = {
      ...generatedPlan,
      dailyCalories: newCalories,
      protein: Math.round((newCalories * 0.30) / 4),
      carbs: Math.round((newCalories * 0.40) / 4),
      fat: Math.round((newCalories * 0.30) / 9),
    };
    setGeneratedPlan(adjusted);

    // Update example meals
    const meals = generateExampleMeals(adjusted.dailyCalories, adjusted.protein, adjusted.carbs, adjusted.fat);
    setExampleMeals(meals);
  };

  const adjustProtein = (amount) => {
    const adjusted = {
      ...generatedPlan,
      protein: Math.max(0, generatedPlan.protein + amount)
    };
    setGeneratedPlan(adjusted);
  };

  const adjustCarbs = (amount) => {
    const adjusted = {
      ...generatedPlan,
      carbs: Math.max(0, generatedPlan.carbs + amount)
    };
    setGeneratedPlan(adjusted);
  };

  const adjustFat = (amount) => {
    const adjusted = {
      ...generatedPlan,
      fat: Math.max(0, generatedPlan.fat + amount)
    };
    setGeneratedPlan(adjusted);
  };

  // Deadline options in weeks
  const deadlineOptions = collectedData.targetWeight
    ? [4, 8, 12, 16, 24, 36].map(weeks => ({
        weeks,
        label: weeks < 8 ? `${weeks} weeks` : `${Math.round(weeks/4)} months`,
        ...calculateDeadlineProbability(weeks)
      }))
    : [];

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
                onPress={() => handleGoalSelect('OTHER')}
                style={styles.goalChip}
                textStyle={styles.chipText}
              >
                ✨ Other
              </Chip>
            </View>
          </Animated.View>
        )}

        {/* Custom Goal Input */}
        {conversationStage === 'CUSTOM_GOAL' && (
          <Animated.View style={[styles.interactionContainer, { opacity: fadeAnim }]}>
            <Surface style={styles.inputCard}>
              <TextInput
                style={styles.textInput}
                placeholder="E.g., I want to lose belly fat and feel more energetic..."
                multiline
                numberOfLines={4}
                value={customGoalText}
                onChangeText={setCustomGoalText}
                placeholderTextColor="#94A3B8"
              />
              <Button
                mode="contained"
                onPress={handleCustomGoalSubmit}
                style={styles.continueButton}
                disabled={!customGoalText.trim()}
              >
                Continue
              </Button>
            </Surface>
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
                    { value: 'FEMALE', label: 'Female' },
                    { value: 'OTHER', label: 'Other' }
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
                  <Text style={styles.label}>Current Weight</Text>
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

        {/* Target Weight */}
        {conversationStage === 'TARGET_WEIGHT' && (
          <Animated.View style={[styles.interactionContainer, { opacity: fadeAnim }]}>
            <Surface style={styles.inputCard}>
              <View style={styles.section}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Target Weight</Text>
                  <Text style={styles.value}>{collectedData.targetWeight} {collectedData.weightUnit}</Text>
                </View>
                <Slider
                  value={collectedData.targetWeight}
                  onValueChange={(val) => setCollectedData(prev => ({ ...prev, targetWeight: Math.round(val) }))}
                  minimumValue={collectedData.weightUnit === 'kg' ? 40 : 90}
                  maximumValue={collectedData.weightUnit === 'kg' ? 150 : 330}
                  minimumTrackTintColor="#6366F1"
                  maximumTrackTintColor="#CBD5E1"
                  thumbTintColor="#6366F1"
                  step={1}
                />
                <Text style={styles.helperText}>
                  {Math.abs(collectedData.weight - collectedData.targetWeight)} {collectedData.weightUnit} {
                    collectedData.weight > collectedData.targetWeight ? 'to lose' : 'to gain'
                  }
                </Text>
              </View>

              <Button
                mode="contained"
                onPress={handleTargetWeightComplete}
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

        {/* Deadline Selection with Probability Chart */}
        {conversationStage === 'DEADLINE' && (
          <Animated.View style={[styles.interactionContainer, { opacity: fadeAnim }]}>
            <Surface style={styles.inputCard}>
              {deadlineOptions.map((option, index) => (
                <View key={index} style={styles.deadlineOption}>
                  <View style={styles.deadlineHeader}>
                    <Text style={styles.deadlineLabel}>{option.label}</Text>
                    <Text style={[styles.deadlineProbability, { color: option.color }]}>
                      {option.probability}% success
                    </Text>
                  </View>

                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        { width: `${option.probability}%`, backgroundColor: option.color }
                      ]}
                    />
                  </View>

                  <Text style={styles.deadlineDescription}>{option.description}</Text>

                  <Button
                    mode={option.probability >= 70 ? "contained" : "outlined"}
                    onPress={() => handleDeadlineSelect(option.weeks)}
                    style={styles.deadlineButton}
                    compact
                  >
                    Choose {option.label}
                  </Button>
                </View>
              ))}
            </Surface>
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
                <Text style={styles.adjustLabel}>Adjust your plan:</Text>

                {/* Calories */}
                <View style={styles.adjustSection}>
                  <Text style={styles.adjustSectionLabel}>Calories</Text>
                  <View style={styles.adjustButtons}>
                    <Button mode="outlined" onPress={() => adjustCalories(-100)} style={styles.adjustButton} compact>
                      -100
                    </Button>
                    <Button mode="outlined" onPress={() => adjustCalories(100)} style={styles.adjustButton} compact>
                      +100
                    </Button>
                  </View>
                </View>

                {/* Protein */}
                <View style={styles.adjustSection}>
                  <Text style={styles.adjustSectionLabel}>Protein</Text>
                  <View style={styles.adjustButtons}>
                    <Button mode="outlined" onPress={() => adjustProtein(-10)} style={styles.adjustButton} compact>
                      -10g
                    </Button>
                    <Button mode="outlined" onPress={() => adjustProtein(10)} style={styles.adjustButton} compact>
                      +10g
                    </Button>
                  </View>
                </View>

                {/* Carbs */}
                <View style={styles.adjustSection}>
                  <Text style={styles.adjustSectionLabel}>Carbs</Text>
                  <View style={styles.adjustButtons}>
                    <Button mode="outlined" onPress={() => adjustCarbs(-10)} style={styles.adjustButton} compact>
                      -10g
                    </Button>
                    <Button mode="outlined" onPress={() => adjustCarbs(10)} style={styles.adjustButton} compact>
                      +10g
                    </Button>
                  </View>
                </View>

                {/* Fat */}
                <View style={styles.adjustSection}>
                  <Text style={styles.adjustSectionLabel}>Fat</Text>
                  <View style={styles.adjustButtons}>
                    <Button mode="outlined" onPress={() => adjustFat(-5)} style={styles.adjustButton} compact>
                      -5g
                    </Button>
                    <Button mode="outlined" onPress={() => adjustFat(5)} style={styles.adjustButton} compact>
                      +5g
                    </Button>
                  </View>
                </View>
              </View>

              <Button
                mode="contained"
                onPress={handlePlanContinue}
                style={styles.approveButton}
                icon="arrow-right"
              >
                See what I'll eat
              </Button>
            </Surface>
          </Animated.View>
        )}

        {/* Food Preview */}
        {conversationStage === 'FOOD_PREVIEW' && (
          <Animated.View style={[styles.interactionContainer, { opacity: fadeAnim }]}>
            <Surface style={styles.foodPreviewCard}>
              {exampleMeals.map((meal, index) => (
                <View key={index} style={styles.mealPreview}>
                  <View style={styles.mealPreviewHeader}>
                    <Text style={styles.mealPreviewType}>{meal.type}</Text>
                    <Text style={styles.mealPreviewCalories}>{meal.calories} cal</Text>
                  </View>
                  <Text style={styles.mealPreviewExample}>{meal.example}</Text>
                </View>
              ))}

              <View style={styles.foodPreviewNote}>
                <Text style={styles.foodPreviewNoteText}>
                  💡 These are examples - you can log any food that fits your targets!
                </Text>
              </View>

              <Button
                mode="contained"
                onPress={handleFoodPreviewContinue}
                style={styles.continueButton}
                icon="arrow-right"
              >
                Continue
              </Button>
            </Surface>
          </Animated.View>
        )}

        {/* Feedback Input */}
        {conversationStage === 'FEEDBACK' && (
          <Animated.View style={[styles.interactionContainer, { opacity: fadeAnim }]}>
            <Surface style={styles.inputCard}>
              <TextInput
                style={styles.textInput}
                placeholder="Any preferences, restrictions, or thoughts? (Optional)"
                multiline
                numberOfLines={4}
                value={feedbackText}
                onChangeText={setFeedbackText}
                placeholderTextColor="#94A3B8"
              />
              <Button
                mode="contained"
                onPress={handleFeedbackSubmit}
                style={styles.continueButton}
              >
                {feedbackText.trim() ? 'Submit & Continue' : 'Skip'}
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
    paddingTop: 60,  // Add space for Dynamic Island
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
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1E293B',
    marginBottom: 16,
    minHeight: 100,
    textAlignVertical: 'top'
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
  helperText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600'
  },
  segmentedButtons: {
    backgroundColor: 'transparent'
  },
  continueButton: {
    marginTop: 8
  },
  deadlineOption: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  deadlineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  deadlineLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B'
  },
  deadlineProbability: {
    fontSize: 14,
    fontWeight: '700'
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    borderRadius: 4
  },
  deadlineDescription: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12
  },
  deadlineButton: {
    marginTop: 4
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
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
    textAlign: 'center'
  },
  adjustSection: {
    marginBottom: 12
  },
  adjustSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8
  },
  adjustButtons: {
    flexDirection: 'row',
    gap: 8
  },
  adjustButton: {
    flex: 1
  },
  approveButton: {
    paddingVertical: 6
  },
  foodPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 12px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  mealPreview: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  mealPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  mealPreviewType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B'
  },
  mealPreviewCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1'
  },
  mealPreviewExample: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20
  },
  foodPreviewNote: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  },
  foodPreviewNoteText: {
    fontSize: 14,
    color: '#0369A1',
    lineHeight: 20
  }
});
