// Mifflin-St Jeor Equation
export const calculateBMR = (weight, height, age, sex) => {
  // weight in lbs, height in inches
  const weightKg = weight * 0.453592;
  const heightCm = height * 2.54;

  if (sex === 'male') {
    return (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
  } else {
    return (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
  }
};

export const activityMultipliers = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9
};

export const calculateTDEE = (bmr, activityLevel) => {
  return bmr * activityMultipliers[activityLevel];
};

export const calculateDailyBudget = (userData) => {
  const { weight, height, age, sex, activityLevel, targetWeight, weeksToGoal } = userData;

  const bmr = calculateBMR(weight, height, age, sex);
  const tdee = calculateTDEE(bmr, activityLevel);

  // Calculate deficit needed
  const weightToLose = weight - targetWeight;
  const totalDays = weeksToGoal * 7;
  const poundsPerWeek = weightToLose / weeksToGoal;

  // 3500 calories = 1 pound
  const dailyDeficit = (poundsPerWeek * 3500) / 7;

  // Don't go below 1200 for women, 1500 for men
  const minCalories = sex === 'male' ? 1500 : 1200;
  const dailyCalories = Math.max(tdee - dailyDeficit, minCalories);

  // Calculate macros
  const proteinGrams = weight * 1.0; // 1g per lb bodyweight
  const proteinCalories = proteinGrams * 4;

  const fatCalories = dailyCalories * 0.25; // 25% from fat
  const fatGrams = fatCalories / 9;

  const carbCalories = dailyCalories - proteinCalories - fatCalories;
  const carbGrams = carbCalories / 4;

  return {
    calories: Math.round(dailyCalories),
    protein: Math.round(proteinGrams),
    carbs: Math.round(carbGrams),
    fat: Math.round(fatGrams)
  };
};

export const calculateProgress = (consumed, target) => {
  const percentage = (consumed / target) * 100;
  return {
    consumed,
    target,
    remaining: target - consumed,
    percentage: Math.min(percentage, 100),
    isOver: consumed > target
  };
};
