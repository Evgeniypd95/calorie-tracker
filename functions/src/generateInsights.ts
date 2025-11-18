/**
 * Insights Generation Cloud Function
 *
 * Generates weekly nutrition insights based on user's meal history
 * Requires at least 5 days of meal data
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
}

interface DailyTotal {
  date: Date;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
}

export const generateInsights = onCall(async (request: any) => {
  console.log("💡 generateInsights called");

  const {userId, userProfile} = request.data;

  if (!userId || !userProfile) {
    throw new HttpsError(
      "invalid-argument",
      "userId and userProfile are required"
    );
  }

  try {
    // Get last 7 days of meals
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const mealsSnapshot = await db
      .collection("meals")
      .where("userId", "==", userId)
      .where("date", ">=", sevenDaysAgo)
      .get();

    const meals: MealData[] = [];
    mealsSnapshot.forEach((doc) => {
      meals.push(doc.data() as MealData);
    });

    console.log(`📊 Found ${meals.length} meals in last 7 days`);

    // Group meals by day
    const last7Days: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      last7Days.push(date);
    }

    const dailyTotals: DailyTotal[] = last7Days.map((date) => {
      const dayMeals = meals.filter((meal) => {
        const mealDate = meal.date?.toDate ? meal.date.toDate() : new Date(meal.date);
        return (
          mealDate.getDate() === date.getDate() &&
          mealDate.getMonth() === date.getMonth() &&
          mealDate.getFullYear() === date.getFullYear()
        );
      });

      const totals = dayMeals.reduce(
        (acc, meal) => ({
          calories: acc.calories + (meal.totals?.calories || 0),
          protein: acc.protein + (meal.totals?.protein || 0),
          carbs: acc.carbs + (meal.totals?.carbs || 0),
          fat: acc.fat + (meal.totals?.fat || 0),
        }),
        {calories: 0, protein: 0, carbs: 0, fat: 0}
      );

      return {
        date,
        ...totals,
        mealCount: dayMeals.length,
      };
    });

    // Check if we have at least 5 days of data
    const daysWithData = dailyTotals.filter((d) => d.calories > 0).length;

    if (daysWithData < 5) {
      console.log(`⏸️ Not enough data: ${daysWithData} days (need 5+)`);
      return {
        success: true,
        hasEnoughData: false,
        daysWithData,
        insights: [],
        weeklyData: null,
      };
    }

    // Generate insights
    const insights = [];
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const daysWithCalories = dailyTotals.filter((d) => d.calories > 0);

    // 1. Best and worst days
    if (daysWithCalories.length > 0) {
      const bestDay = daysWithCalories.reduce((min, day) =>
        day.calories < min.calories ? day : min
      );
      const worstDay = daysWithCalories.reduce((max, day) =>
        day.calories > max.calories ? day : max
      );

      const target = userProfile.dailyCalorieTarget || 2000;

      insights.push({
        icon: "🏆",
        title: "Best Day",
        description: `${dayNames[bestDay.date.getDay()]} - ${Math.round(bestDay.calories)} cal${
          bestDay.calories <= target ? " (under target!)" : ""
        }`,
        color: "#10B981",
      });

      if (worstDay.calories > target) {
        insights.push({
          icon: "⚠️",
          title: "Watch Out",
          description: `You tend to overeat on ${dayNames[worstDay.date.getDay()]}s - ${Math.round(
            worstDay.calories
          )} cal`,
          color: "#F59E0B",
        });
      }
    }

    // 2. Average protein intake
    const avgProtein = daysWithCalories.reduce((sum, day) => sum + day.protein, 0) / daysWithCalories.length || 0;
    const proteinTarget = userProfile.proteinTarget || 150;

    if (avgProtein < proteinTarget * 0.8) {
      insights.push({
        icon: "💪",
        title: "Protein Opportunity",
        description: `Your average protein intake is ${Math.round(avgProtein)}g. Target: ${proteinTarget}g`,
        color: "#EF4444",
      });
    } else if (avgProtein >= proteinTarget) {
      insights.push({
        icon: "💪",
        title: "Protein Champion",
        description: `Crushing your protein goals! Average: ${Math.round(avgProtein)}g`,
        color: "#10B981",
      });
    }

    // 3. Consistency insight
    const daysLogged = daysWithCalories.length;
    if (daysLogged === 7) {
      insights.push({
        icon: "🔥",
        title: "Perfect Week",
        description: "You logged meals every day this week!",
        color: "#EF4444",
      });
    } else if (daysLogged >= 5) {
      insights.push({
        icon: "✅",
        title: "Great Consistency",
        description: `${daysLogged}/7 days logged this week`,
        color: "#10B981",
      });
    } else if (daysLogged < 5) {
      insights.push({
        icon: "📝",
        title: "Log More Often",
        description: "Try to log meals at least 5 days a week for better insights",
        color: "#94A3B8",
      });
    }

    // Prepare weekly chart data
    const weeklyChartData = {
      labels: dailyTotals.map((d) => {
        const day = d.date.toLocaleDateString("en-US", {weekday: "short"});
        return day.substring(0, 3);
      }),
      data: dailyTotals.map((d) => d.calories),
    };

    // Prepare macro chart data
    const macroTotals = dailyTotals.reduce(
      (acc, day) => ({
        protein: acc.protein + day.protein,
        carbs: acc.carbs + day.carbs,
        fat: acc.fat + day.fat,
      }),
      {protein: 0, carbs: 0, fat: 0}
    );

    const proteinCal = macroTotals.protein * 4;
    const carbsCal = macroTotals.carbs * 4;
    const fatCal = macroTotals.fat * 9;
    const totalMacroCal = proteinCal + carbsCal + fatCal;

    const macroChartData = totalMacroCal > 0 ? [
      {
        name: "Protein",
        population: proteinCal,
        color: "#EF4444",
        legendFontColor: "#1E293B",
        legendFontSize: 13,
      },
      {
        name: "Carbs",
        population: carbsCal,
        color: "#10B981",
        legendFontColor: "#1E293B",
        legendFontSize: 13,
      },
      {
        name: "Fat",
        population: fatCal,
        color: "#F59E0B",
        legendFontColor: "#1E293B",
        legendFontSize: 13,
      },
    ] : [];

    console.log(`✅ Generated ${insights.length} insights`);

    return {
      success: true,
      hasEnoughData: true,
      daysWithData,
      insights,
      weeklyChartData,
      macroChartData,
    };
  } catch (error) {
    console.error("Error generating insights:", error);
    throw new HttpsError("internal", "Failed to generate insights", error);
  }
});
