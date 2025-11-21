import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Get the default Firebase app instance
const app = getApp();

// Initialize Functions with the us-central1 region
const functions = getFunctions(app, 'us-central1');

// Uncomment to use local emulator during development
// connectFunctionsEmulator(functions, 'localhost', 5001);

export const parseMealDescription = async (mealDescription, existingParsedData = null) => {
  // Check auth status
  const auth = getAuth();
  const currentUser = auth.currentUser;

  console.log('🔐 Auth Status Check:');
  console.log('  - Is user logged in?', !!currentUser);
  console.log('  - User ID:', currentUser?.uid);
  console.log('  - User email:', currentUser?.email);

  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      console.log('  - Auth token exists:', !!token);
      console.log('  - Token length:', token?.length);
    } catch (error) {
      console.error('  - Error getting token:', error);
    }
  } else {
    console.error('❌ NO USER LOGGED IN!');
  }

  console.log('🤖 Calling parseMeal function with:', mealDescription);
  if (existingParsedData) {
    console.log('📝 Refinement mode - existing data:', existingParsedData);
  }

  try {
    const parseMeal = httpsCallable(functions, 'parseMeal');
    const result = await parseMeal({
      mealDescription,
      existingData: existingParsedData
    });

    console.log('✅ parseMeal response:', result.data);

    if (result.data.success) {
      return result.data.data;
    } else {
      throw new Error('Failed to parse meal');
    }
  } catch (error) {
    console.error('❌ Error calling parseMeal function:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error details:', error.details);
    throw error;
  }
};

export const convertImageToDescription = async (imageData) => {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  console.log('🔐 imageToDescription Auth Check:');
  console.log('  - Is user logged in?', !!currentUser);

  if (!currentUser) {
    throw new Error('User must be logged in');
  }

  console.log('📸 Calling imageToDescription function');

  try {
    const imageToDescription = httpsCallable(functions, 'imageToDescription');
    const result = await imageToDescription({ imageData });

    console.log('✅ imageToDescription response:', result.data);

    if (result.data.success) {
      return result.data.description;
    } else {
      throw new Error('Failed to analyze image');
    }
  } catch (error) {
    console.error('❌ Error calling imageToDescription function:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error details:', error.details);
    throw error;
  }
};

export const analyzeDietContext = async (dietContext, goal, biometrics) => {
  console.log('🧠 Analyzing diet context with AI');

  try {
    const analyzeDiet = httpsCallable(functions, 'analyzeDietContext');
    const result = await analyzeDiet({
      dietContext,
      goal,
      biometrics
    });

    console.log('✅ analyzeDietContext response:', result.data);

    if (result.data.success) {
      return result.data.analysis;
    } else {
      // Fallback to basic calculation
      return {
        recommendedStrategy: 'CHALLENGING',
        dailyCalories: Math.round(biometrics.tdee * 0.85),
        protein: Math.round((biometrics.tdee * 0.85 * 0.30) / 4),
        carbs: Math.round((biometrics.tdee * 0.85 * 0.40) / 4),
        fat: Math.round((biometrics.tdee * 0.85 * 0.30) / 9),
        reasoning: 'Balanced approach based on your activity level and goals',
        weekendFlexibility: false
      };
    }
  } catch (error) {
    console.error('❌ Error calling analyzeDietContext function:', error);
    // Return fallback
    return {
      recommendedStrategy: 'CHALLENGING',
      dailyCalories: Math.round(biometrics.tdee * 0.85),
      protein: Math.round((biometrics.tdee * 0.85 * 0.30) / 4),
      carbs: Math.round((biometrics.tdee * 0.85 * 0.40) / 4),
      fat: Math.round((biometrics.tdee * 0.85 * 0.30) / 9),
      reasoning: 'Balanced approach based on your activity level and goals',
      weekendFlexibility: false
    };
  }
};

export const chatOnboarding = async (conversationHistory, userMessage) => {
  console.log('💬 Onboarding chat with AI');

  try {
    const chatOnboardingFn = httpsCallable(functions, 'chatOnboarding');
    const result = await chatOnboardingFn({
      conversationHistory,
      userMessage
    });

    console.log('✅ chatOnboarding response:', result.data);

    if (result.data.success) {
      return {
        response: result.data.response,
        extractedData: result.data.extractedData,
        isComplete: result.data.isComplete,
        calculatedPlan: result.data.calculatedPlan
      };
    } else {
      throw new Error('Chat failed');
    }
  } catch (error) {
    console.error('❌ Error calling chatOnboarding function:', error);

    // Fallback: Simple local chat logic for testing when function not deployed
    console.log('⚠️ Using local fallback - deploy chatOnboarding function for full AI experience');

    const userMessageLower = userMessage.toLowerCase();

    // Simple pattern matching for demo/testing
    let response = '';
    let extractedData = {};
    let isComplete = false;
    let calculatedPlan = null;

    // Check if user provided all info at once
    const hasName = /name is|i'm|i am|call me/i.test(userMessageLower);
    const hasAge = /(\d+)\s*(years?|y\.?o\.?|age)/i.test(userMessage);
    const hasWeight = /(\d+)\s*(kg|lbs?|pounds?)/i.test(userMessage);
    const hasHeight = /(\d+)\s*(cm|feet?|ft|inches?|in)/i.test(userMessage);
    const hasGender = /(male|female|man|woman)/i.test(userMessageLower);
    const hasGoal = /(lose|gain|build|maintain|cut|bulk)/i.test(userMessageLower);
    const hasActivity = /(workout|exercise|gym|active|sedentary)/i.test(userMessageLower);

    // Extract basic data
    if (hasName) {
      // Try to extract name from patterns like "I'm John", "My name is John", "Call me John"
      const nameMatch = userMessage.match(/(?:name is|i'm|i am|call me)\s+([a-zA-Z]+)/i);
      if (nameMatch) {
        extractedData.name = nameMatch[1];
      }
    }

    if (hasAge) {
      const ageMatch = userMessage.match(/(\d+)\s*(years?|y\.?o\.?|age)/i);
      extractedData.age = parseInt(ageMatch[1]);
    }

    if (hasWeight) {
      const weightMatch = userMessage.match(/(\d+)\s*(kg|lbs?|pounds?)/i);
      extractedData.weight = parseInt(weightMatch[1]);
      extractedData.weightUnit = weightMatch[2].toLowerCase().includes('lb') ? 'lbs' : 'kg';
    }

    if (hasHeight) {
      const heightMatch = userMessage.match(/(\d+)\s*(cm|feet?|ft)/i);
      extractedData.height = parseInt(heightMatch[1]);
      extractedData.heightUnit = heightMatch[2].toLowerCase().includes('cm') ? 'cm' : 'ft';
    }

    if (hasGender) {
      if (/\b(male|man)\b/i.test(userMessage)) {
        extractedData.gender = 'MALE';
      } else if (/\b(female|woman)\b/i.test(userMessage)) {
        extractedData.gender = 'FEMALE';
      }
    }

    if (hasGoal) {
      if (/lose|cut/i.test(userMessage)) {
        extractedData.goal = 'LOSE_WEIGHT';
      } else if (/gain|build|bulk|muscle/i.test(userMessage)) {
        extractedData.goal = 'BUILD_MUSCLE';
      } else if (/maintain/i.test(userMessage)) {
        extractedData.goal = 'MAINTAIN';
      }
    }

    if (hasActivity) {
      const workoutMatch = userMessage.match(/(\d+)\s*(times?|days?|x)/i);
      if (workoutMatch) {
        const workouts = parseInt(workoutMatch[1]);
        extractedData.workoutsPerWeek = workouts;

        if (workouts === 0) extractedData.activityLevel = 'SEDENTARY';
        else if (workouts <= 2) extractedData.activityLevel = 'LIGHT';
        else if (workouts <= 4) extractedData.activityLevel = 'MODERATE';
        else if (workouts <= 6) extractedData.activityLevel = 'ACTIVE';
        else extractedData.activityLevel = 'VERY_ACTIVE';
      }
    }

    // Get previous data from conversation
    const allData = { ...extractedData };
    conversationHistory.forEach(msg => {
      if (msg.extractedData) {
        Object.assign(allData, msg.extractedData);
      }
    });
    Object.assign(allData, extractedData); // Current message overrides

    // Check if we have enough to calculate
    const canCalculate = allData.age && allData.weight && allData.height &&
                        allData.gender && allData.goal && allData.activityLevel;

    if (canCalculate) {
      // Calculate plan
      const weightKg = allData.weightUnit === 'lbs' ? allData.weight * 0.453592 : allData.weight;
      const heightCm = allData.heightUnit === 'ft' ? allData.height * 30.48 : allData.height;

      const bmr = allData.gender === 'MALE'
        ? (10 * weightKg) + (6.25 * heightCm) - (5 * allData.age) + 5
        : (10 * weightKg) + (6.25 * heightCm) - (5 * allData.age) - 161;

      const activityMultipliers = {
        SEDENTARY: 1.2,
        LIGHT: 1.375,
        MODERATE: 1.55,
        ACTIVE: 1.725,
        VERY_ACTIVE: 1.9
      };

      const tdee = Math.round(bmr * activityMultipliers[allData.activityLevel]);

      let targetCalories = tdee;
      if (allData.goal === 'LOSE_WEIGHT') {
        targetCalories = Math.round(tdee * 0.85);
      } else if (allData.goal === 'BUILD_MUSCLE') {
        targetCalories = Math.round(tdee * 1.10);
      }

      calculatedPlan = {
        dailyCalories: targetCalories,
        protein: Math.round((targetCalories * 0.30) / 4),
        carbs: Math.round((targetCalories * 0.40) / 4),
        fat: Math.round((targetCalories * 0.30) / 9),
        reasoning: `Based on your stats, this plan will help you ${allData.goal === 'LOSE_WEIGHT' ? 'lose weight' : allData.goal === 'BUILD_MUSCLE' ? 'build muscle' : 'maintain'} sustainably.`
      };

      isComplete = true;
      response = `Perfect! 🎯 Based on everything you've shared, I've calculated your personalized nutrition plan.\n\nYou'll be eating around ${targetCalories} calories per day. This ${allData.goal === 'LOSE_WEIGHT' ? 'creates a healthy deficit for weight loss' : allData.goal === 'BUILD_MUSCLE' ? 'provides a surplus to support muscle growth' : 'maintains your current weight'} while keeping your energy levels up!\n\nWhat do you think? Feel free to give me feedback or click "Finish & Create Account" when you're ready!`;
    } else {
      // Need more info
      if (!allData.age || !allData.weight || !allData.height || !allData.gender) {
        const greeting = allData.name ? `Thanks ${allData.name}!` : "Thanks for sharing!";
        response = `${greeting} To create your plan, I need to know your age, weight, height, and gender.`;
      } else if (!allData.goal) {
        response = "Got it! What's your main fitness goal? Are you looking to lose weight, build muscle, or maintain?";
      } else if (!allData.activityLevel) {
        response = "Awesome! One more thing - how many times per week do you typically work out or exercise?";
      } else {
        response = "Thanks! Can you share more details so I can create the perfect plan for you?";
      }
    }

    return {
      response,
      extractedData: allData,
      isComplete,
      calculatedPlan
    };
  }
};

/**
 * Grade a meal using backend Cloud Function
 * @param {string} mealId - The ID of the meal document in Firestore
 * @param {object} meal - The meal data (items and totals)
 * @param {object} userProfile - User's profile with goal and targets
 * @returns {Promise<object>} - Grade data with score, feedback, etc.
 */
export const gradeMealBackend = async (mealId, meal, userProfile) => {
  console.log('📊 Grading meal via backend');

  try {
    const gradeMealFn = httpsCallable(functions, 'gradeMeal');
    const result = await gradeMealFn({
      mealId,
      meal,
      userProfile
    });

    console.log('✅ gradeMeal response:', result.data);

    if (result.data.success) {
      return result.data.gradeData;
    } else {
      throw new Error('Meal grading failed');
    }
  } catch (error) {
    console.error('❌ Error calling gradeMeal function:', error);
    throw error;
  }
};

/**
 * Generate smart suggestions using backend Cloud Function
 * @param {string} userId - The user's ID
 * @param {object} userProfile - User's profile with goal and targets
 * @returns {Promise<object>} - Suggestions array and stats
 */
export const generateSuggestionsBackend = async (userId, userProfile) => {
  console.log('💡 Generating suggestions via backend');

  try {
    const generateSuggestionsFn = httpsCallable(functions, 'generateSuggestions');
    const result = await generateSuggestionsFn({
      userId,
      userProfile
    });

    console.log('✅ generateSuggestions response:', result.data);

    if (result.data.success) {
      return {
        suggestions: result.data.suggestions,
        stats: result.data.stats,
        reason: result.data.reason,
        daysWithData: result.data.daysWithData
      };
    } else {
      throw new Error('Suggestions generation failed');
    }
  } catch (error) {
    console.error('❌ Error calling generateSuggestions function:', error);
    throw error;
  }
};

/**
 * Generate insights using backend Cloud Function
 * @param {string} userId - The user's ID
 * @param {object} userProfile - User's profile with targets
 * @returns {Promise<object>} - Insights, chart data, and metadata
 */
export const generateInsightsBackend = async (userId, userProfile) => {
  console.log('📊 Generating insights via backend');

  try {
    const generateInsightsFn = httpsCallable(functions, 'generateInsights');
    const result = await generateInsightsFn({
      userId,
      userProfile
    });

    console.log('✅ generateInsights response:', result.data);

    if (result.data.success) {
      return {
        hasEnoughData: result.data.hasEnoughData,
        daysWithData: result.data.daysWithData,
        insights: result.data.insights,
        weeklyChartData: result.data.weeklyChartData,
        macroChartData: result.data.macroChartData,
        calorieAdherenceData: result.data.calorieAdherenceData,
        dailyProteinData: result.data.dailyProteinData,
        dailyCarbsData: result.data.dailyCarbsData,
        dailyFatData: result.data.dailyFatData
      };
    } else {
      throw new Error('Insights generation failed');
    }
  } catch (error) {
    console.error('❌ Error calling generateInsights function:', error);
    throw error;
  }
};

/**
 * Calculate personalized nutrition plan using backend Cloud Function
 * @param {object} userData - User's body metrics and goals
 * @returns {Promise<object>} - Calculated nutrition plan
 */
export const calculateNutritionPlanBackend = async (userData) => {
  console.log('🧮 Calculating nutrition plan via backend');

  try {
    const calculatePlanFn = httpsCallable(functions, 'calculateNutritionPlan');
    const result = await calculatePlanFn(userData);

    console.log('✅ calculateNutritionPlan response:', result.data);

    if (result.data.success) {
      return result.data.plan;
    } else {
      throw new Error('Nutrition plan calculation failed');
    }
  } catch (error) {
    console.error('❌ Error calling calculateNutritionPlan function:', error);
    throw error;
  }
};
