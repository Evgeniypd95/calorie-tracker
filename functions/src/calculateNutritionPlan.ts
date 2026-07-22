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

// ~7700 kcal of deficit/surplus per kg of body weight (standard estimate)
const KCAL_PER_KG = 7700;
// Safe weekly rate of change caps — outside these we clamp to the fixed
// 15%/10% deficit/surplus instead of following an unsafe deadline.
const MAX_SAFE_WEEKLY_LOSS_KG = 1.0;
const MAX_SAFE_WEEKLY_GAIN_KG = 0.5;
const MIN_TARGET_CALORIES_MULTIPLIER = 0.6; // never go below 60% of TDEE
const MAX_TARGET_CALORIES_MULTIPLIER = 1.25; // never exceed 125% of TDEE

/**
 * Calculate target calories based on goal.
 *
 * When a target date and a target weight different from the current weight
 * are supplied, the daily deficit/surplus is derived from how many days are
 * left to reach that weight — but the implied weekly rate is clamped to a
 * safe max (never a hard fallback to a differently-calibrated flat percent,
 * which would create a discontinuity where an aggressive-but-clamped date
 * produces a SMALLER deficit than a more relaxed one). If no date/target
 * weight is given, uses a fixed 15% deficit / 10% surplus instead.
 */
function calculateTargetCalories(
  tdee: number,
  goal: string,
  currentWeight: number,
  targetWeight: number,
  isPregnant: boolean,
  trimester?: 'FIRST' | 'SECOND' | 'THIRD',
  targetDate?: Date
): { calories: number; isDateDriven: boolean; achievableWeeklyRate?: number } {
  // For pregnancy, maintain healthy weight with trimester-specific calories
  if (isPregnant && trimester) {
    return { calories: calculatePregnancyCalories(tdee, trimester), isDateDriven: false };
  }

  const weightDiff = targetWeight - currentWeight;
  const hasDeadline = !!targetDate && weightDiff !== 0;

  if (hasDeadline) {
    const today = new Date();
    const daysUntilTarget = (targetDate!.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);

    if (daysUntilTarget > 0) {
      const weeksUntilTarget = daysUntilTarget / 7;
      const requestedWeeklyRate = Math.abs(weightDiff) / weeksUntilTarget;
      const maxSafeRate = weightDiff < 0 ? MAX_SAFE_WEEKLY_LOSS_KG : MAX_SAFE_WEEKLY_GAIN_KG;

      // Clamp the RATE (not the resulting calories) so the deficit/surplus
      // scales continuously with how aggressive the deadline is, saturating
      // at the safe max instead of jumping to an unrelated flat percentage.
      const safeWeeklyRate = Math.min(requestedWeeklyRate, maxSafeRate);
      const dailyCalorieAdjustment = (safeWeeklyRate * KCAL_PER_KG) / 7;
      const signedAdjustment = weightDiff < 0 ? -dailyCalorieAdjustment : dailyCalorieAdjustment;
      const clampedMin = tdee * MIN_TARGET_CALORIES_MULTIPLIER;
      const clampedMax = tdee * MAX_TARGET_CALORIES_MULTIPLIER;
      const target = Math.min(clampedMax, Math.max(clampedMin, tdee + signedAdjustment));
      return { calories: Math.round(target), isDateDriven: true, achievableWeeklyRate: safeWeeklyRate };
    }
  }

  if (goal === 'LOSE_WEIGHT' || weightDiff < 0) {
    return { calories: Math.round(tdee * 0.85), isDateDriven: false }; // 15% deficit for safe weight loss
  } else if (goal === 'BUILD_MUSCLE' || weightDiff > 0) {
    return { calories: Math.round(tdee * 1.10), isDateDriven: false }; // 10% surplus for muscle gain
  }
  return { calories: Math.round(tdee), isDateDriven: false }; // Maintain current weight
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
 * Calculate weekly weight change and weeks to goal.
 *
 * If `achievableWeeklyRate` is supplied (the safety-clamped rate the
 * calorie target actually supports), weeksToGoal reflects how long reaching
 * the target weight will REALLY take at that rate — which may be longer
 * than the user's requested deadline if that deadline was unsafe. Without
 * it, falls back to the naive requested-date math.
 */
function calculateWeeklyChange(
  currentWeight: number,
  targetWeight: number,
  targetDate: Date,
  achievableWeeklyRate?: number
): { weeksToGoal: number; weeklyWeightChange: number } {
  const weightDiff = Math.abs(targetWeight - currentWeight);
  const today = new Date();
  const weeksUntilTarget = Math.max(1, (targetDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));

  if (achievableWeeklyRate && achievableWeeklyRate > 0) {
    const actualWeeksNeeded = weightDiff / achievableWeeklyRate;
    return { weeksToGoal: Math.round(actualWeeksNeeded), weeklyWeightChange: achievableWeeklyRate };
  }

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
  trimester?: 'FIRST' | 'SECOND' | 'THIRD',
  weeklyWeightChange?: number,
  isDateDriven?: boolean
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
  const rateText = weeklyWeightChange && weeklyWeightChange > 0
    ? `${weeklyWeightChange.toFixed(1)}kg per week`
    : '0.3-0.5kg per week';

  if (goal === 'LOSE_WEIGHT' || deficit > 0) {
    const percentDeficit = Math.round((deficit / tdee) * 100);
    const paceNote = isDateDriven
      ? `to reach your target weight by your goal date at ${rateText}`
      : `for safe weight loss of approximately ${rateText}`;
    return `This creates a ${percentDeficit}% calorie deficit (~${Math.round(deficit)} cal/day) ${paceNote}.`;
  } else if (goal === 'BUILD_MUSCLE' || surplus > 0) {
    const percentSurplus = Math.round((surplus / tdee) * 100);
    const paceNote = isDateDriven
      ? `to reach your target weight by your goal date at ${rateText}`
      : 'to support muscle growth while minimizing fat gain';
    return `This provides a ${percentSurplus}% calorie surplus (~${Math.round(surplus)} cal/day) ${paceNote}.`;
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
    const parsedTargetDate = data.targetDate ? new Date(data.targetDate) : undefined;
    const { calories: targetCalories, isDateDriven, achievableWeeklyRate } = calculateTargetCalories(
      tdee,
      data.goal,
      data.currentWeight,
      targetWeight,
      data.isPregnant || false,
      data.trimester,
      parsedTargetDate
    );

    // Step 5: Calculate macros
    const macros = calculateMacros(targetCalories, data.isPregnant || false);

    // Step 6: Calculate weekly change and weeks to goal
    let weeksToGoal = 0;
    let weeklyWeightChange = 0;

    if (!data.isPregnant && parsedTargetDate && targetWeight !== data.currentWeight) {
      const weeklyData = calculateWeeklyChange(data.currentWeight, targetWeight, parsedTargetDate, achievableWeeklyRate);
      weeksToGoal = weeklyData.weeksToGoal;
      weeklyWeightChange = weeklyData.weeklyWeightChange;
    }

    // Step 7: Generate reasoning
    const reasoning = generateReasoning(
      data.goal,
      tdee,
      targetCalories,
      data.isPregnant || false,
      data.trimester,
      weeklyWeightChange,
      isDateDriven
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
