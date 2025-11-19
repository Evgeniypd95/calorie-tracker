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

// Pregnancy-specific food lists
const FOLATE_RICH = [
  "spinach", "kale", "broccoli", "brussels sprouts", "asparagus", "lentils",
  "chickpeas", "beans", "orange", "avocado", "fortified cereal", "leafy greens",
  "collard greens", "turnip greens", "lettuce", "beets", "edamame"
];

const IRON_RICH = [
  "red meat", "beef", "lamb", "pork", "chicken", "turkey", "liver",
  "spinach", "lentils", "beans", "tofu", "quinoa", "fortified cereal",
  "pumpkin seeds", "cashews", "chickpeas", "edamame"
];

const CALCIUM_RICH = [
  "milk", "yogurt", "cheese", "cottage cheese", "tofu", "salmon", "sardines",
  "kale", "broccoli", "bok choy", "almonds", "fortified milk", "fortified juice"
];

const DHA_OMEGA3 = [
  "salmon", "sardines", "mackerel", "herring", "trout", "chia seeds",
  "flax seeds", "walnuts", "eggs", "fortified eggs"
];

// Foods to avoid/limit during pregnancy
const PREGNANCY_AVOID = [
  "sushi", "raw fish", "tuna", "swordfish", "shark", "king mackerel",
  "deli meat", "hot dog", "lunch meat", "unpasteurized", "soft cheese",
  "brie", "feta", "blue cheese", "queso fresco", "raw egg", "runny egg",
  "alcohol", "beer", "wine", "liquor", "energy drink", "high caffeine"
];

function isVegetableOrFruit(foodName: string): { isVeggie: boolean; isFruit: boolean } {
  const lowerFood = foodName.toLowerCase();
  const isVeggie = VEGETABLES.some((veg) => lowerFood.includes(veg));
  const isFruit = FRUITS.some((fruit) => lowerFood.includes(fruit));
  return {isVeggie, isFruit};
}

function checkPregnancyNutrients(foodName: string) {
  const lowerFood = foodName.toLowerCase();
  return {
    hasFolate: FOLATE_RICH.some((food) => lowerFood.includes(food)),
    hasIron: IRON_RICH.some((food) => lowerFood.includes(food)),
    hasCalcium: CALCIUM_RICH.some((food) => lowerFood.includes(food)),
    hasDHA: DHA_OMEGA3.some((food) => lowerFood.includes(food)),
    isAvoidFood: PREGNANCY_AVOID.some((food) => lowerFood.includes(food))
  };
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
    // Fetch meal document to get mealType
    const mealDoc = await db.collection("meals").doc(mealId).get();
    const mealType = mealDoc.exists ? mealDoc.data()?.mealType : null;
    const isSnack = mealType === "Snack";

    const {totals, items} = meal;
    const {goal, dailyCalorieTarget, isPregnant, trimester} = userProfile;

    let score = 100;
    const feedback: string[] = [];
    const positives: string[] = [];
    const warnings: string[] = [];

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
    if (isSnack) {
      // Snacks should be 100-300 calories typically
      if (mealCals > 400) {
        score -= 20;
        feedback.push(`⚠️ High calories for a snack (${mealCals} cal) - consider a smaller portion`);
      } else if (mealCals > 300) {
        score -= 10;
        feedback.push("💡 On the higher side for a snack - watch portion size");
      } else if (mealCals >= 100 && mealCals <= 250) {
        positives.push("✓ Perfect snack portion!");
      } else if (mealCals < 100) {
        positives.push("✓ Light snack");
      }
    } else {
      // Main meals
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
    }

    // 2. PROTEIN SCORE
    if (isSnack) {
      // For snacks, protein is a bonus but not required
      if (proteinPercent >= 15) {
        positives.push("✓ Great protein for a snack!");
      }
      // Don't penalize lack of protein in snacks - it's okay!
    } else if (isPregnant) {
      // Pregnancy: Need adequate protein for fetal development (20-25%)
      if (proteinPercent < 15) {
        score -= 25;
        feedback.push("🤰 Add more protein for your baby's development (aim for 20-25%)");
      } else if (proteinPercent >= 20 && proteinPercent <= 30) {
        positives.push(`🤰 Perfect protein (${Math.round(proteinPercent)}%) for pregnancy!`);
      } else if (proteinPercent >= 18) {
        positives.push("✓ Good protein for pregnancy");
      } else {
        score -= 10;
        feedback.push("🤰 A bit more protein would be great for baby");
      }
    } else if (goal === "BUILD_MUSCLE") {
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
    if (isSnack) {
      // For snacks, only warn about extremely high fat
      if (fatPercent > 60) {
        score -= 10;
        feedback.push("💡 Very high fat content - watch portion size");
      } else if (fatPercent >= 20 && fatPercent <= 40) {
        // Healthy fats from nuts, avocado are great in snacks
        positives.push("✓ Contains healthy fats");
      }
    } else {
      if (fatPercent > 45) {
        score -= 20;
        feedback.push(`⚠️ Very high fat (${Math.round(fatPercent)}%) - may feel sluggish`);
      } else if (fatPercent < 15 && goal !== "LOSE_WEIGHT") {
        score -= 10;
        feedback.push("💡 Low fat - add healthy fats (avocado, nuts, olive oil)");
      } else if (fatPercent >= 25 && fatPercent <= 35) {
        positives.push("✓ Balanced fat content");
      }
    }

    // 4. CARBS
    if (isSnack) {
      // For snacks, carbs are fine - fruits, veggies are carb-heavy and healthy
      // No penalties for carb content in snacks
    } else if (isPregnant) {
      // Pregnancy: Higher carbs (45-55%) are good for energy
      if (carbsPercent >= 45 && carbsPercent <= 55) {
        positives.push("🤰 Great carbs for energy during pregnancy!");
      } else if (carbsPercent < 35) {
        score -= 10;
        feedback.push("🤰 Add more healthy carbs for energy (whole grains, fruits)");
      }
      // Don't penalize high carbs during pregnancy - they need the energy!
    } else if (goal === "LOSE_WEIGHT" && carbsPercent > 50) {
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

    if (isSnack) {
      // For snacks, fruits and veggies are great! Give big bonuses
      if (fruitCount > 0) {
        positives.push("🍎 Healthy fruit snack!");
      }
      if (veggieCount > 0) {
        positives.push("🥦 Nutritious veggie snack!");
      }
      // Don't penalize lack of veggies/fruits in snacks - could be nuts, yogurt, etc.
    } else {
      // Main meals should have veggies/fruits
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
    }

    // 5b. PREGNANCY-SPECIFIC NUTRIENT TRACKING
    if (isPregnant) {
      let hasFolateFood = false;
      let hasIronFood = false;
      let hasCalciumFood = false;
      let hasDHAFood = false;
      let hasAvoidFood = false;

      items.forEach((item: MealItem) => {
        const nutrients = checkPregnancyNutrients(item.food);
        if (nutrients.hasFolate) hasFolateFood = true;
        if (nutrients.hasIron) hasIronFood = true;
        if (nutrients.hasCalcium) hasCalciumFood = true;
        if (nutrients.hasDHA) hasDHAFood = true;
        if (nutrients.isAvoidFood) {
          hasAvoidFood = true;
          warnings.push(`⚠️ ${item.food} may not be safe during pregnancy - consult your doctor`);
        }
      });

      // Bonus points for pregnancy-critical nutrients
      if (hasFolateFood) {
        score += 5;
        positives.push("🤰 Great source of folate for baby's development!");
      } else if (trimester === "FIRST") {
        feedback.push("💡 Consider adding folate-rich foods (leafy greens, beans, oranges)");
      }

      if (hasIronFood) {
        score += 3;
        positives.push("🤰 Good iron content for preventing anemia!");
      } else if (trimester === "SECOND" || trimester === "THIRD") {
        feedback.push("💡 Add iron-rich foods (lean meat, spinach, lentils)");
      }

      if (hasCalciumFood) {
        score += 3;
        positives.push("🤰 Excellent calcium for baby's bones!");
      }

      if (hasDHAFood) {
        score += 4;
        positives.push("🤰 Great DHA/Omega-3 for baby's brain development!");
      } else if (trimester === "THIRD") {
        feedback.push("💡 Add DHA sources (salmon, chia seeds, walnuts) for baby's brain");
      }

      // Heavy penalty for avoid foods
      if (hasAvoidFood) {
        score -= 30;
      }
    }

    // 6. PORTION SIZE CHECK
    if (isSnack) {
      // Snacks are usually single items - that's okay!
      // Only warn if snack is actually too large (covered in calorie check)
    } else {
      // Main meals
      if (items.length === 1 && mealCals > 800) {
        score -= 10;
        feedback.push("💡 Large single item - consider adding variety");
      } else if (items.length >= 3) {
        positives.push("✓ Good meal variety");
      }
    }

    // Create summary
    const finalGrade = scoreToGrade(Math.max(0, score));
    let summary = "";

    if (isSnack) {
      // Snack-specific summaries
      if (finalGrade.startsWith("A")) {
        if (fruitCount > 0 || veggieCount > 0) {
          summary = "Perfect healthy snack! 🍎";
        } else {
          summary = "Great snack choice! 👍";
        }
      } else if (finalGrade.startsWith("B")) {
        summary = "Good snack! Well portioned.";
      } else if (finalGrade.startsWith("C")) {
        summary = "Decent snack - watch the portion size.";
      } else {
        summary = "Consider a healthier or smaller snack option.";
      }
    } else if (isPregnant) {
      if (finalGrade.startsWith("A")) {
        summary = trimester === "FIRST" ?
          "Excellent nutrition for early pregnancy! 🤰" :
          trimester === "SECOND" ?
            "Perfect balance for your growing baby! 🤰" :
            "Great nutrients for baby's final development! 🤰";
      } else if (finalGrade.startsWith("B")) {
        summary = "Good meal for pregnancy! Consider adding key nutrients.";
      } else if (finalGrade.startsWith("C")) {
        summary = "Decent meal, but let's boost those pregnancy nutrients!";
      } else {
        summary = "Let's adjust this meal to better support your pregnancy.";
      }
    } else if (finalGrade.startsWith("A")) {
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

    const gradeData: any = {
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
      isPregnancyGrade: isPregnant || false,
      gradedAt: new Date(),
    };

    // Only add optional fields if they have values (Firestore doesn't accept undefined)
    if (warnings.length > 0) {
      gradeData.warnings = warnings;
    }
    if (isPregnant && trimester) {
      gradeData.trimester = trimester;
    }

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
