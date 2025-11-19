import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";

interface NutritionPlanRequest {
  birthMonth: number;
  birthYear: number;
  gender: 'MALE' | 'FEMALE';
  currentWeight: number;
  targetWeight?: number;
  height: number;
  workoutsPerWeek: number;
  goal: 'LOSE_WEIGHT' | 'MAINTAIN' | 'BUILD_MUSCLE';
  targetDate?: string;
  isPregnant?: boolean;
  trimester?: 'FIRST' | 'SECOND' | 'THIRD';
  prePregnancyWeight?: number;
}

interface NutritionPlan {
  age: number;
  bmr: number;
  tdee: number;
  targetCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  weeksToGoal: number;
  weeklyWeightChange: number;
  formula: string;
  reasoning: string;
}

/**
 * Calculate age from birth month and year
 */
function calculateAge(month: number, year: number): number {
  const birthDate = new Date(year, month - 1, 1);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0) age--;
  return age;
}

/**
 * Calculate BMR using Mifflin-St Jeor Equation
 * Most accurate formula for resting metabolic rate
 */
function calculateBMR(weightKg: number, heightCm: number, age: number, isMale: boolean): number {
  if (isMale) {
    return (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
  } else {
    return (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
  }
}

/**
 * Calculate TDEE (Total Daily Energy Expenditure)
 * BMR adjusted for activity level
 */
function calculateTDEE(bmr: number, workoutsPerWeek: number): number {
  const multipliers: { [key: number]: number } = {
    0: 1.2,    // Sedentary
    1: 1.375,  // Light (1-2/week)
    2: 1.375,
    3: 1.55,   // Moderate (3-4/week)
    4: 1.55,
    5: 1.725,  // Active (5-6/week)
    6: 1.725,
    7: 1.9     // Very Active (7+/week)
  };

  const workouts = Math.min(workoutsPerWeek, 7);
  const multiplier = multipliers[workouts] || 1.55;
  return bmr * multiplier;
}

/**
 * Calculate pregnancy-specific calorie needs
 */
function calculatePregnancyCalories(baseTDEE: number, trimester: 'FIRST' | 'SECOND' | 'THIRD'): number {
  const additions: { [key: string]: number } = {
    FIRST: 0,      // No additional calories needed in first trimester
    SECOND: 340,   // +340 cal/day in second trimester
    THIRD: 452     // +452 cal/day in third trimester
  };
  return Math.round(baseTDEE + (additions[trimester] || 0));
}

/**
 * Calculate target calories based on goal
 */
function calculateTargetCalories(
  tdee: number,
  goal: string,
  currentWeight: number,
  targetWeight: number,
  isPregnant: boolean,
  trimester?: 'FIRST' | 'SECOND' | 'THIRD'
): number {
  // For pregnancy, maintain healthy weight with trimester-specific calories
  if (isPregnant && trimester) {
    return calculatePregnancyCalories(tdee, trimester);
  }

  const weightDiff = targetWeight - currentWeight;

  if (goal === 'LOSE_WEIGHT' || weightDiff < 0) {
    return Math.round(tdee * 0.85); // 15% deficit for safe weight loss
  } else if (goal === 'BUILD_MUSCLE' || weightDiff > 0) {
    return Math.round(tdee * 1.10); // 10% surplus for muscle gain
  }
  return Math.round(tdee); // Maintain current weight
}

/**
 * Calculate macronutrient distribution
 */
function calculateMacros(calories: number, isPregnant: boolean): { protein: number; carbs: number; fat: number } {
  if (isPregnant) {
    // Pregnancy macros: Higher carbs for energy, adequate protein for fetal development
    // 25% protein, 50% carbs, 25% fat
    return {
      protein: Math.round((calories * 0.25) / 4),
      carbs: Math.round((calories * 0.50) / 4),
      fat: Math.round((calories * 0.25) / 9)
    };
  }

  // Standard macros: 30% protein, 40% carbs, 30% fat
  return {
    protein: Math.round((calories * 0.30) / 4),
    carbs: Math.round((calories * 0.40) / 4),
    fat: Math.round((calories * 0.30) / 9)
  };
}

/**
 * Calculate weekly weight change and weeks to goal
 */
function calculateWeeklyChange(
  currentWeight: number,
  targetWeight: number,
  targetDate: Date
): { weeksToGoal: number; weeklyWeightChange: number } {
  const weightDiff = Math.abs(targetWeight - currentWeight);
  const today = new Date();
  const weeksUntilTarget = Math.max(1, (targetDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const weeklyChange = weightDiff / weeksUntilTarget;
  const weeks = Math.round(weeksUntilTarget);

  return { weeksToGoal: weeks, weeklyWeightChange: weeklyChange };
}

/**
 * Generate reasoning based on the plan
 */
function generateReasoning(
  goal: string,
  tdee: number,
  targetCalories: number,
  isPregnant: boolean,
  trimester?: 'FIRST' | 'SECOND' | 'THIRD'
): string {
  if (isPregnant && trimester) {
    const additions = { FIRST: 0, SECOND: 340, THIRD: 452 };
    const extra = additions[trimester];
    return `Your plan is optimized for a healthy pregnancy in your ${
      trimester === 'FIRST' ? '1st' : trimester === 'SECOND' ? '2nd' : '3rd'
    } trimester, with ${extra} extra calories for fetal development.`;
  }

  const deficit = tdee - targetCalories;
  const surplus = targetCalories - tdee;

  if (goal === 'LOSE_WEIGHT' || deficit > 0) {
    const percentDeficit = Math.round((deficit / tdee) * 100);
    return `This creates a sustainable ${percentDeficit}% calorie deficit (~${Math.round(deficit)} cal/day) for safe weight loss of approximately 0.3-0.5kg per week.`;
  } else if (goal === 'BUILD_MUSCLE' || surplus > 0) {
    const percentSurplus = Math.round((surplus / tdee) * 100);
    return `This provides a ${percentSurplus}% calorie surplus (~${Math.round(surplus)} cal/day) to support muscle growth while minimizing fat gain.`;
  }

  return 'This maintains your current weight while supporting your activity level and overall health.';
}

/**
 * Cloud Function to calculate personalized nutrition plan
 */
export const calculateNutritionPlan = onCall(async (request) => {
  try {
    const data = request.data as NutritionPlanRequest;

    // Validate required fields
    if (!data.birthMonth || !data.birthYear || !data.currentWeight || !data.height || data.workoutsPerWeek === undefined) {
      throw new HttpsError('invalid-argument', 'Missing required fields: birthMonth, birthYear, currentWeight, height, workoutsPerWeek');
    }

    // Validate gender
    if (data.gender !== 'MALE' && data.gender !== 'FEMALE') {
      throw new HttpsError('invalid-argument', 'Gender must be MALE or FEMALE');
    }

    // Validate pregnancy settings
    if (data.isPregnant && data.gender === 'MALE') {
      throw new HttpsError('invalid-argument', 'Pregnancy option is only available for female users');
    }

    logger.info('Calculating nutrition plan', {
      gender: data.gender,
      weight: data.currentWeight,
      height: data.height,
      pregnant: data.isPregnant
    });

    // Step 1: Calculate age
    const age = calculateAge(data.birthMonth, data.birthYear);

    // Step 2: Calculate BMR
    const isMale = data.gender === 'MALE';
    const bmr = calculateBMR(data.currentWeight, data.height, age, isMale);

    // Step 3: Calculate TDEE
    const tdee = calculateTDEE(bmr, data.workoutsPerWeek);

    // Step 4: Calculate target calories
    const targetWeight = data.targetWeight || data.currentWeight;
    const targetCalories = calculateTargetCalories(
      tdee,
      data.goal,
      data.currentWeight,
      targetWeight,
      data.isPregnant || false,
      data.trimester
    );

    // Step 5: Calculate macros
    const macros = calculateMacros(targetCalories, data.isPregnant || false);

    // Step 6: Calculate weekly change and weeks to goal
    let weeksToGoal = 0;
    let weeklyWeightChange = 0;

    if (!data.isPregnant && data.targetDate && targetWeight !== data.currentWeight) {
      const targetDate = new Date(data.targetDate);
      const weeklyData = calculateWeeklyChange(data.currentWeight, targetWeight, targetDate);
      weeksToGoal = weeklyData.weeksToGoal;
      weeklyWeightChange = weeklyData.weeklyWeightChange;
    }

    // Step 7: Generate reasoning
    const reasoning = generateReasoning(
      data.goal,
      tdee,
      targetCalories,
      data.isPregnant || false,
      data.trimester
    );

    const plan: NutritionPlan = {
      age,
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      targetCalories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      weeksToGoal,
      weeklyWeightChange,
      formula: 'Mifflin-St Jeor',
      reasoning
    };

    logger.info('Nutrition plan calculated successfully', {
      age,
      bmr: plan.bmr,
      tdee: plan.tdee,
      targetCalories
    });

    return {
      success: true,
      plan
    };

  } catch (error) {
    logger.error('Error calculating nutrition plan:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Failed to calculate nutrition plan');
  }
});
