/**
 * Meal Grading Cloud Function
 *
 * Grades meals (A+ to F) based on user's goals and nutritional content
 * Stores grades in Firestore for persistence
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {initializeApp, getApps} from "firebase-admin/app";

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

// List of common vegetables for detection
const VEGETABLES = [
  "broccoli", "spinach", "kale", "lettuce", "carrots", "carrot", "tomato", "cucumber",
  "bell pepper", "pepper", "zucchini", "asparagus", "cauliflower", "brussels sprouts",
  "cabbage", "celery", "eggplant", "green beans", "mushrooms", "mushroom", "onion",
  "peas", "radish", "squash", "sweet potato", "potato", "arugula", "bok choy",
  "collard greens", "artichoke", "beets", "chard", "fennel", "leeks",
  "parsnip", "turnip", "watercress", "salad", "greens", "vegetables", "veggie",
  // Asian vegetables
  "scallion", "spring onion", "green onion", "bean sprouts", "sprouts",
  "bamboo shoots", "water chestnuts", "snow peas", "chinese cabbage",
  "napa cabbage", "daikon", "lotus root", "seaweed", "nori", "kombu",
];

const FRUITS = [
  "apple", "banana", "orange", "strawberry", "blueberry", "raspberry",
  "grape", "mango", "pineapple", "watermelon", "cantaloupe", "honeydew",
  "peach", "pear", "plum", "cherry", "kiwi", "papaya", "avocado",
  "blackberry", "cranberry", "pomegranate", "grapefruit", "lemon", "lime",
  "fruit",
];

function isVegetableOrFruit(foodName: string): { isVeggie: boolean; isFruit: boolean } {
  const lowerFood = foodName.toLowerCase();
  const isVeggie = VEGETABLES.some((veg) => lowerFood.includes(veg));
  const isFruit = FRUITS.some((fruit) => lowerFood.includes(fruit));
  return {isVeggie, isFruit};
}

function scoreToGrade(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 65) return "C+";
  if (score >= 60) return "C";
  if (score >= 55) return "C-";
  if (score >= 50) return "D+";
  if (score >= 45) return "D";
  if (score >= 40) return "D-";
  return "F";
}

function gradeToColor(grade: string): string {
  if (grade.startsWith("A")) return "#10B981"; // Green
  if (grade.startsWith("B")) return "#3B82F6"; // Blue
  if (grade.startsWith("C")) return "#F59E0B"; // Yellow
  if (grade.startsWith("D")) return "#F97316"; // Orange
  return "#EF4444"; // Red
}

interface MealItem {
  food: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const gradeMeal = onCall(async (request: any) => {
  console.log("📊 gradeMeal called");

  const {mealId, meal, userProfile} = request.data;

  if (!mealId || !meal || !userProfile) {
    throw new HttpsError(
      "invalid-argument",
      "mealId, meal, and userProfile are required"
    );
  }

  try {
    const {totals, items} = meal;
    const {goal, dailyCalorieTarget} = userProfile;

    let score = 100;
    const feedback: string[] = [];
    const positives: string[] = [];

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

    // 1. CALORIE APPROPRIATENESS
    const idealMealCals = dailyCalorieTarget ? dailyCalorieTarget / 3 : 600;
    const calorieRatio = mealCals / idealMealCals;

    if (calorieRatio > 1.5) {
      score -= 25;
      feedback.push(`⚠️ High calories for one meal (${Math.round(calorieRatio * 100)}% of target)`);
    } else if (calorieRatio < 0.5 && goal !== "LOSE_WEIGHT") {
      score -= 15;
      feedback.push("💡 Quite low in calories - consider adding more food");
    } else if (calorieRatio >= 0.8 && calorieRatio <= 1.2) {
      positives.push("✓ Perfect calorie amount");
    }

    // 2. PROTEIN SCORE
    if (goal === "BUILD_MUSCLE") {
      if (proteinPercent < 20) {
        score -= 30;
        feedback.push(`💪 Low protein (${Math.round(proteinPercent)}%) - aim for 25%+ for muscle building`);
      } else if (proteinPercent >= 30) {
        positives.push(`💪 Excellent protein (${Math.round(proteinPercent)}%)!`);
      } else if (proteinPercent >= 25) {
        positives.push("✓ Good protein content");
      } else {
        score -= 10;
        feedback.push("💪 Could use a bit more protein for muscle building");
      }
    } else if (goal === "LOSE_WEIGHT") {
      if (proteinPercent < 15) {
        score -= 25;
        feedback.push("🎯 Add more protein for satiety and muscle preservation");
      } else if (proteinPercent >= 25) {
        positives.push(`🎯 Great protein (${Math.round(proteinPercent)}%) for weight loss!`);
      } else {
        positives.push("✓ Good protein content");
      }
    } else {
      if (proteinPercent < 12) {
        score -= 15;
        feedback.push("Add more protein for balanced nutrition");
      } else if (proteinPercent >= 20) {
        positives.push("✓ Excellent protein balance");
      }
    }

    // 3. FAT CONTENT
    if (fatPercent > 45) {
      score -= 20;
      feedback.push(`⚠️ Very high fat (${Math.round(fatPercent)}%) - may feel sluggish`);
    } else if (fatPercent < 15 && goal !== "LOSE_WEIGHT") {
      score -= 10;
      feedback.push("💡 Low fat - add healthy fats (avocado, nuts, olive oil)");
    } else if (fatPercent >= 25 && fatPercent <= 35) {
      positives.push("✓ Balanced fat content");
    }

    // 4. CARBS
    if (goal === "LOSE_WEIGHT" && carbsPercent > 50) {
      score -= 15;
      feedback.push("🎯 High carbs - consider reducing for better weight loss");
    } else if (goal === "BUILD_MUSCLE" && carbsPercent < 30) {
      score -= 10;
      feedback.push("💪 Add more carbs for energy and recovery");
    }

    // 5. VEGETABLES & FRUITS
    let veggieCount = 0;
    let fruitCount = 0;

    items.forEach((item: MealItem) => {
      const {isVeggie, isFruit} = isVegetableOrFruit(item.food);
      if (isVeggie) veggieCount++;
      if (isFruit) fruitCount++;
    });

    if (veggieCount === 0 && fruitCount === 0) {
      score -= 12;
      feedback.push("🥦 Add vegetables for fiber and micronutrients");
    } else if (veggieCount >= 2) {
      positives.push("🥦 Great veggie variety!");
    } else if (veggieCount >= 1) {
      positives.push("✓ Includes vegetables");
    } else if (fruitCount > 0) {
      positives.push("🍎 Includes fruit");
    }

    // 6. PORTION SIZE CHECK
    if (items.length === 1 && mealCals > 800) {
      score -= 10;
      feedback.push("💡 Large single item - consider adding variety");
    } else if (items.length >= 3) {
      positives.push("✓ Good meal variety");
    }

    // Create summary
    const finalGrade = scoreToGrade(Math.max(0, score));
    let summary = "";

    if (finalGrade.startsWith("A")) {
      summary = goal === "BUILD_MUSCLE" ?
        "High protein, balanced macros - perfect for muscle building!" :
        goal === "LOSE_WEIGHT" ?
          "High protein, good satiety - excellent for weight loss!" :
          "Well-balanced and nutritious meal!";
    } else if (finalGrade.startsWith("B")) {
      summary = "Good meal! A few tweaks could make it perfect.";
    } else if (finalGrade.startsWith("C")) {
      summary = "Decent meal, but room for improvement.";
    } else if (finalGrade.startsWith("D")) {
      summary = "Consider adjusting portions or ingredients.";
    } else {
      summary = "Let's work on improving this meal together!";
    }

    const gradeData = {
      grade: finalGrade,
      score: Math.max(0, score),
      feedback,
      positives,
      color: gradeToColor(finalGrade),
      summary,
      macroBreakdown: {
        protein: Math.round(proteinPercent),
        carbs: Math.round(carbsPercent),
        fat: Math.round(fatPercent),
      },
      gradedAt: new Date(),
    };

    // Store grade in Firestore
    await db.collection("meals").doc(mealId).update({
      gradeData,
    });

    console.log("✅ Meal graded:", finalGrade);

    return {
      success: true,
      gradeData,
    };
  } catch (error) {
    console.error("Error grading meal:", error);
    throw new HttpsError("internal", "Failed to grade meal", error);
  }
});
