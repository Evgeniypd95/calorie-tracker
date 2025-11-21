/**
 * Smart Suggestions Cloud Function
 *
 * Generates personalized meal suggestions based on user's meal history
 * Requires at least 10 days of meal data
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {initializeApp, getApps} from "firebase-admin/app";

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

interface MealData {
  date: any;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  gradeData?: {
    grade: string;
    score: number;
  };
}

export const generateSuggestions = onCall(async (request: any) => {
  console.log("💡 generateSuggestions called");

  const {userId, userProfile} = request.data;

  if (!userId || !userProfile) {
    throw new HttpsError(
      "invalid-argument",
      "userId and userProfile are required"
    );
  }

  try {
    // Fetch all meals for the user
    console.log(`🔍 Fetching meals for user: ${userId}`);
    const mealsSnapshot = await db
      .collection("meals")
      .where("userId", "==", userId)
      .orderBy("date", "desc")
      .limit(100)
      .get();

    const allMeals: MealData[] = [];
    mealsSnapshot.forEach((doc) => {
      allMeals.push(doc.data() as MealData);
    });

    console.log(`📊 Found ${allMeals.length} meals`);

    // Check if we have at least 10 days of data
    const uniqueDays = new Set(
      allMeals.map((meal) => {
        const date = meal.date?.toDate ? meal.date.toDate() : new Date(meal.date);
        return date.toISOString().split("T")[0];
      })
    );

    const daysWithData = uniqueDays.size;
    console.log(`📅 Days with data: ${daysWithData}`);

    if (daysWithData < 10) {
      console.log(`⏸️ Not enough data: ${daysWithData} days (need 10+)`);
      return {
        success: true,
        suggestions: [],
        reason: "insufficient_data",
        daysWithData,
      };
    }

    // Calculate averages
    const totalMeals = allMeals.length;
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalScore = 0;
    let gradeCount = 0;

    allMeals.forEach((meal) => {
      totalCalories += meal.totals.calories || 0;
      totalProtein += meal.totals.protein || 0;
      totalCarbs += meal.totals.carbs || 0;
      totalFat += meal.totals.fat || 0;

      if (meal.gradeData?.score) {
        totalScore += meal.gradeData.score;
        gradeCount++;
      }
    });

    const avgCalories = Math.round(totalCalories / totalMeals);
    const avgProtein = Math.round(totalProtein / totalMeals);
    const avgCarbs = Math.round(totalCarbs / totalMeals);
    const avgFat = Math.round(totalFat / totalMeals);
    const avgScore = gradeCount > 0 ? Math.round(totalScore / gradeCount) : 0;

    console.log(`📈 Averages - Cals: ${avgCalories}, P: ${avgProtein}g, C: ${avgCarbs}g, F: ${avgFat}g, Score: ${avgScore}`);

    // Generate suggestions based on data
    const suggestions: any[] = [];
    const {goal, dailyCalorieTarget, isPregnant, trimester} = userProfile;

    // Calculate macro percentages
    const proteinCals = avgProtein * 4;
    const carbsCals = avgCarbs * 4;
    const fatCals = avgFat * 9;
    const totalMacroCals = proteinCals + carbsCals + fatCals;

    const proteinPercent = totalMacroCals > 0 ? (proteinCals / totalMacroCals) * 100 : 0;
    const carbsPercent = totalMacroCals > 0 ? (carbsCals / totalMacroCals) * 100 : 0;
    const fatPercent = totalMacroCals > 0 ? (fatCals / totalMacroCals) * 100 : 0;

    // PREGNANCY-SPECIFIC SUGGESTIONS
    if (isPregnant) {
      // Folate suggestion (critical in 1st trimester)
      if (trimester === "FIRST") {
        suggestions.push({
          type: "pregnancy_folate",
          icon: "🤰",
          title: "Boost Folate for Baby's Development",
          description: "Folate is crucial in the 1st trimester for preventing neural tube defects.",
          actionable: "Add spinach, kale, lentils, beans, or fortified cereals to your meals",
          priority: "high",
        });
      }

      // Iron suggestion (critical in 2nd/3rd trimester)
      if (trimester === "SECOND" || trimester === "THIRD") {
        suggestions.push({
          type: "pregnancy_iron",
          icon: "🤰",
          title: "Maintain Iron Levels",
          description: "Iron needs increase significantly during pregnancy to prevent anemia.",
          actionable: "Include lean red meat, spinach, lentils, or iron-fortified foods daily",
          priority: "high",
        });
      }

      // Calcium suggestion
      suggestions.push({
        type: "pregnancy_calcium",
        icon: "🤰",
        title: "Strong Bones for Baby",
        description: "Your baby needs calcium for bone development.",
        actionable: "Aim for 3-4 servings of dairy, fortified plant milk, or calcium-rich foods daily",
        priority: "medium",
      });

      // DHA/Omega-3 suggestion (critical in 3rd trimester for brain development)
      if (trimester === "THIRD") {
        suggestions.push({
          type: "pregnancy_dha",
          icon: "🤰",
          title: "DHA for Baby's Brain",
          description: "Omega-3 fatty acids support your baby's brain and eye development.",
          actionable: "Eat salmon 2x/week, or add chia seeds, walnuts, or DHA-fortified eggs",
          priority: "high",
        });
      }

      // Small frequent meals (helps with nausea in 1st trimester, digestion later)
      if (trimester === "FIRST") {
        suggestions.push({
          type: "pregnancy_meals",
          icon: "🤰",
          title: "Small, Frequent Meals",
          description: "Eating smaller meals more often can help reduce nausea and maintain energy.",
          actionable: "Try 5-6 smaller meals throughout the day instead of 3 large ones",
          priority: "medium",
        });
      }

      // Hydration
      suggestions.push({
        type: "pregnancy_hydration",
        icon: "💧",
        title: "Stay Well Hydrated",
        description: "Pregnancy increases your fluid needs for amniotic fluid and increased blood volume.",
        actionable: "Aim for 8-10 glasses of water daily, more if exercising",
        priority: "medium",
      });

      // Foods to avoid reminder
      suggestions.push({
        type: "pregnancy_avoid",
        icon: "⚠️",
        title: "Foods to Avoid During Pregnancy",
        description: "Some foods pose risks during pregnancy.",
        actionable: "Avoid raw fish, deli meats, unpasteurized cheese, high-mercury fish, and alcohol",
        priority: "high",
      });
    }

    // SUGGESTION 1: Protein intake (regular)
    if (!isPregnant && goal === "BUILD_MUSCLE") {
      if (proteinPercent < 25) {
        suggestions.push({
          type: "protein",
          icon: "💪",
          title: "Boost Your Protein",
          description: `Your meals average ${Math.round(proteinPercent)}% protein. For muscle building, aim for 25-30%.`,
          actionable: "Add eggs, chicken, Greek yogurt, or protein powder to meals",
          priority: "high",
        });
      } else if (proteinPercent >= 30) {
        suggestions.push({
          type: "protein",
          icon: "🎯",
          title: "Perfect Protein!",
          description: `You're crushing it with ${Math.round(proteinPercent)}% protein - ideal for muscle building!`,
          actionable: "Keep up your current high-protein choices",
          priority: "positive",
        });
      }
    } else if (!isPregnant && goal === "LOSE_WEIGHT") {
      if (proteinPercent < 20) {
        suggestions.push({
          type: "protein",
          icon: "🎯",
          title: "Increase Protein for Satiety",
          description: `Your meals average ${Math.round(proteinPercent)}% protein. Higher protein helps with fullness.`,
          actionable: "Add lean protein like chicken, fish, or tofu to stay satisfied longer",
          priority: "high",
        });
      }
    }

    // SUGGESTION 2: Calorie consistency
    const dailyCalorieEstimate = avgCalories * 3; // Assuming 3 meals per day
    const targetDiff = Math.abs(dailyCalorieEstimate - dailyCalorieTarget);
    const diffPercent = (targetDiff / dailyCalorieTarget) * 100;

    if (diffPercent > 20) {
      if (dailyCalorieEstimate > dailyCalorieTarget) {
        suggestions.push({
          type: "calories",
          icon: "⚠️",
          title: "Calorie Intake Above Target",
          description: `Your meals are tracking ${Math.round(diffPercent)}% above your ${dailyCalorieTarget} cal target.`,
          actionable: "Try smaller portions or swap high-cal items for lighter options",
          priority: "medium",
        });
      } else {
        suggestions.push({
          type: "calories",
          icon: "💡",
          title: "Eating Below Target",
          description: `You're eating ${Math.round(diffPercent)}% below your ${dailyCalorieTarget} cal target.`,
          actionable: goal === "LOSE_WEIGHT" ? "This is okay for weight loss, but ensure you have energy" : "Add healthy snacks or slightly larger portions",
          priority: "medium",
        });
      }
    }

    // SUGGESTION 3: Carbs for muscle building
    if (!isPregnant && goal === "BUILD_MUSCLE" && carbsPercent < 35) {
      suggestions.push({
        type: "carbs",
        icon: "🍚",
        title: "Need More Carbs for Energy",
        description: `Your meals average ${Math.round(carbsPercent)}% carbs. More carbs = better workouts and recovery.`,
        actionable: "Add rice, oats, sweet potatoes, or pasta to fuel your training",
        priority: "medium",
      });
    }

    // SUGGESTION 4: High fat warning
    if (fatPercent > 40) {
      suggestions.push({
        type: "fat",
        icon: "⚠️",
        title: "High Fat Intake",
        description: `Your meals average ${Math.round(fatPercent)}% fat - this might make you feel sluggish.`,
        actionable: "Reduce fried foods, heavy sauces, and oils. Choose lean proteins",
        priority: "high",
      });
    }

    // SUGGESTION 5: Overall grade trend
    if (gradeCount > 0 && avgScore < 70) {
      suggestions.push({
        type: "overall",
        icon: "📊",
        title: "Room for Improvement",
        description: `Your average meal score is ${avgScore}/100. Let's get that higher!`,
        actionable: "Focus on balanced meals with protein, veggies, and proper portions",
        priority: "medium",
      });
    } else if (gradeCount > 0 && avgScore >= 85) {
      suggestions.push({
        type: "overall",
        icon: "🎉",
        title: "Excellent Eating Habits!",
        description: `Your average meal score is ${avgScore}/100 - you're doing amazing!`,
        actionable: "Keep maintaining these great nutrition choices",
        priority: "positive",
      });
    }

    // Sort suggestions: high priority first, then positive feedback
    suggestions.sort((a, b) => {
      const priorityOrder: any = {high: 0, medium: 1, positive: 2};
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Limit to top 3 suggestions
    const topSuggestions = suggestions.slice(0, 3);

    console.log(`✅ Generated ${topSuggestions.length} suggestions`);

    return {
      success: true,
      suggestions: topSuggestions,
      stats: {
        daysWithData,
        totalMeals,
        avgCalories,
        avgProtein,
        avgCarbs,
        avgFat,
        avgScore,
        macroBreakdown: {
          protein: Math.round(proteinPercent),
          carbs: Math.round(carbsPercent),
          fat: Math.round(fatPercent),
        },
      },
    };
  } catch (error: any) {
    console.error("❌ Error generating suggestions:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    // If it's a Firestore index error, return gracefully
    if (error.code === 9 || error.message?.includes("index")) {
      console.log("📋 Firestore index needed. Returning empty suggestions.");
      return {
        success: true,
        suggestions: [],
        reason: "index_needed",
        daysWithData: 0,
      };
    }

    throw new HttpsError("internal", "Failed to generate suggestions", error);
  }
});
