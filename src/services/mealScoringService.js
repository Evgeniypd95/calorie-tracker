/**
 * Meal Scoring Service
 *
 * Grades meals (A+ to F) based on user's goals and nutritional content
 * Provides actionable feedback on why a meal is good/bad for their specific goals
 */
import { t } from '../localization/i18n';

// List of common vegetables for detection
const VEGETABLES = [
  'broccoli', 'spinach', 'kale', 'lettuce', 'carrots', 'carrot', 'tomato', 'cucumber',
  'bell pepper', 'pepper', 'zucchini', 'asparagus', 'cauliflower', 'brussels sprouts',
  'cabbage', 'celery', 'eggplant', 'green beans', 'mushrooms', 'mushroom', 'onion',
  'peas', 'radish', 'squash', 'sweet potato', 'potato', 'arugula', 'bok choy',
  'collard greens', 'artichoke', 'beets', 'chard', 'fennel', 'leeks',
  'parsnip', 'turnip', 'watercress', 'salad', 'greens', 'vegetables', 'veggie',
  // Asian vegetables
  'scallion', 'spring onion', 'green onion', 'bean sprouts', 'sprouts',
  'bamboo shoots', 'water chestnuts', 'snow peas', 'chinese cabbage',
  'napa cabbage', 'daikon', 'lotus root', 'seaweed', 'nori', 'kombu'
];

const FRUITS = [
  'apple', 'banana', 'orange', 'strawberry', 'blueberry', 'raspberry',
  'grape', 'mango', 'pineapple', 'watermelon', 'cantaloupe', 'honeydew',
  'peach', 'pear', 'plum', 'cherry', 'kiwi', 'papaya', 'avocado',
  'blackberry', 'cranberry', 'pomegranate', 'grapefruit', 'lemon', 'lime',
  'fruit'
];

/**
 * Detects if a food item is a vegetable or fruit
 */
function isVegetableOrFruit(foodName) {
  const lowerFood = foodName.toLowerCase();
  const isVeggie = VEGETABLES.some(veg => lowerFood.includes(veg));
  const isFruit = FRUITS.some(fruit => lowerFood.includes(fruit));
  return { isVeggie, isFruit };
}

/**
 * Convert score (0-100) to letter grade
 */
function scoreToGrade(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D+';
  if (score >= 45) return 'D';
  if (score >= 40) return 'D-';
  return 'F';
}

/**
 * Get color for grade
 */
function gradeToColor(grade) {
  if (grade.startsWith('A')) return '#10B981'; // Green
  if (grade.startsWith('B')) return '#3B82F6'; // Blue
  if (grade.startsWith('C')) return '#F59E0B'; // Yellow
  if (grade.startsWith('D')) return '#F97316'; // Orange
  return '#EF4444'; // Red
}

/**
 * Main scoring function
 *
 * @param {Object} meal - Parsed meal data with items and totals
 * @param {Object} userProfile - User profile with goal and targets
 * @returns {Object} - { grade, score, feedback: [], color, summary }
 */
export function scoreMeal(meal, userProfile) {
  if (!meal || !meal.totals || !userProfile) {
    return {
      grade: 'N/A',
      score: 0,
      feedback: [t('mealScoring.unavailable')],
      color: '#94A3B8',
      summary: t('mealScoring.noData')
    };
  }

  const { totals, items } = meal;
  const { goal, dailyCalorieTarget } = userProfile;

  let score = 100; // Start at perfect
  const feedback = [];
  const positives = [];

  const mealCals = totals.calories || 0;
  const protein = totals.protein || 0;
  const carbs = totals.carbs || 0;
  const fat = totals.fat || 0;

  // Calculate macro percentages
  const proteinCals = protein * 4;
  const carbsCals = carbs * 4;
  const fatCals = fat * 9;
  const totalMacroCals = proteinCals + carbsCals + fatCals;

  const proteinPercent = totalMacroCals > 0 ? (proteinCals / totalMacroCals) * 100 : 0;
  const carbsPercent = totalMacroCals > 0 ? (carbsCals / totalMacroCals) * 100 : 0;
  const fatPercent = totalMacroCals > 0 ? (fatCals / totalMacroCals) * 100 : 0;

  // 1. CALORIE APPROPRIATENESS (25 points)
  const idealMealCals = dailyCalorieTarget ? dailyCalorieTarget / 3 : 600;
  const calorieRatio = mealCals / idealMealCals;

  if (calorieRatio > 1.5) {
    score -= 25;
    feedback.push(t('mealScoring.highCalories', { percent: Math.round(calorieRatio * 100) }));
  } else if (calorieRatio < 0.5 && goal !== 'LOSE_WEIGHT') {
    score -= 15;
    feedback.push(t('mealScoring.lowCalories'));
  } else if (calorieRatio >= 0.8 && calorieRatio <= 1.2) {
    positives.push(t('mealScoring.perfectCalories'));
  }

  // 2. PROTEIN SCORE (30 points) - CRITICAL
  if (goal === 'BUILD_MUSCLE') {
    if (proteinPercent < 20) {
      score -= 30;
      feedback.push(t('mealScoring.lowProteinBuild', { percent: Math.round(proteinPercent) }));
    } else if (proteinPercent >= 30) {
      positives.push(t('mealScoring.excellentProteinBuild', { percent: Math.round(proteinPercent) }));
    } else if (proteinPercent >= 25) {
      positives.push(t('mealScoring.goodProtein'));
    } else {
      score -= 10;
      feedback.push(t('mealScoring.moreProteinBuild'));
    }
  } else if (goal === 'LOSE_WEIGHT') {
    if (proteinPercent < 15) {
      score -= 25;
      feedback.push(t('mealScoring.moreProteinLose'));
    } else if (proteinPercent >= 25) {
      positives.push(t('mealScoring.greatProteinLose', { percent: Math.round(proteinPercent) }));
    } else {
      positives.push(t('mealScoring.goodProtein'));
    }
  } else {
    // MAINTAIN or EXPLORING
    if (proteinPercent < 12) {
      score -= 15;
      feedback.push(t('mealScoring.moreProtein'));
    } else if (proteinPercent >= 20) {
      positives.push(t('mealScoring.excellentProtein'));
    }
  }

  // 3. FAT CONTENT (20 points)
  if (fatPercent > 45) {
    score -= 20;
    feedback.push(t('mealScoring.highFat', { percent: Math.round(fatPercent) }));
  } else if (fatPercent < 15 && goal !== 'LOSE_WEIGHT') {
    score -= 10;
    feedback.push(t('mealScoring.lowFat'));
  } else if (fatPercent >= 25 && fatPercent <= 35) {
    positives.push(t('mealScoring.balancedFat'));
  }

  // 4. CARBS (15 points)
  if (goal === 'LOSE_WEIGHT' && carbsPercent > 50) {
    score -= 15;
    feedback.push(t('mealScoring.highCarbsLose'));
  } else if (goal === 'BUILD_MUSCLE' && carbsPercent < 30) {
    score -= 10;
    feedback.push(t('mealScoring.addCarbs'));
  }

  // 5. VEGETABLES & FRUITS (15 points) - Made less strict
  let veggieCount = 0;
  let fruitCount = 0;

  items.forEach(item => {
    const { isVeggie, isFruit } = isVegetableOrFruit(item.food);
    if (isVeggie) veggieCount++;
    if (isFruit) fruitCount++;
  });

  // Only penalize if BOTH veggies and fruits are missing
  if (veggieCount === 0 && fruitCount === 0) {
    score -= 12;
    feedback.push(t('mealScoring.addVeggies'));
  } else if (veggieCount >= 2) {
    positives.push(t('mealScoring.veggieVariety'));
  } else if (veggieCount >= 1) {
    positives.push(t('mealScoring.includesVeggies'));
  } else if (fruitCount > 0) {
    positives.push(t('mealScoring.includesFruit'));
  }

  // 6. PORTION SIZE CHECK
  if (items.length === 1 && mealCals > 800) {
    score -= 10;
    feedback.push(t('mealScoring.addVariety'));
  } else if (items.length >= 3) {
    positives.push(t('mealScoring.goodVariety'));
  }

  // Create summary based on grade
  const finalGrade = scoreToGrade(Math.max(0, score));
  let summary = '';

  if (finalGrade.startsWith('A')) {
    summary = goal === 'BUILD_MUSCLE'
      ? t('mealScoring.summaryAbuild')
      : goal === 'LOSE_WEIGHT'
      ? t('mealScoring.summaryAlose')
      : t('mealScoring.summaryA');
  } else if (finalGrade.startsWith('B')) {
    summary = t('mealScoring.summaryB');
  } else if (finalGrade.startsWith('C')) {
    summary = t('mealScoring.summaryC');
  } else if (finalGrade.startsWith('D')) {
    summary = t('mealScoring.summaryD');
  } else {
    summary = t('mealScoring.summaryF');
  }

  return {
    grade: finalGrade,
    score: Math.max(0, score),
    feedback,
    positives,
    color: gradeToColor(finalGrade),
    summary,
    macroBreakdown: {
      protein: Math.round(proteinPercent),
      carbs: Math.round(carbsPercent),
      fat: Math.round(fatPercent)
    }
  };
}

/**
 * Get emoji for grade
 */
export function getGradeEmoji(grade) {
  if (grade.startsWith('A')) return '🎉';
  if (grade.startsWith('B')) return '👍';
  if (grade.startsWith('C')) return '😐';
  if (grade.startsWith('D')) return '😕';
  return '😞';
}
