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

function checkForPregnancyNutrients(foodName: string) {
  const lowerFood = foodName.toLowerCase();
  return {
    hasFolate: FOLATE_RICH.some((food) => lowerFood.includes(food)),
    hasIron: IRON_RICH.some((food) => lowerFood.includes(food)),
    hasCalcium: CALCIUM_RICH.some((food) => lowerFood.includes(food)),
    hasDHA: DHA_OMEGA3.some((food) => lowerFood.includes(food)),
  };
}

interface MealData {
  date: any;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  items?: Array<{
    food: string;
    quantity: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
  gradeData?: {
    grade: string;
    score: number;
    isPregnancyGrade?: boolean;
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
    const {isPregnant, trimester} = userProfile;

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

    if (isPregnant) {
      // Pregnancy-specific protein messaging
      if (avgProtein < proteinTarget * 0.75) {
        insights.push({
          icon: "🤰",
          title: "Protein for Baby",
          description: `Average: ${Math.round(avgProtein)}g. Aim for ${proteinTarget}g for healthy fetal development`,
          color: "#EF4444",
        });
      } else if (avgProtein >= proteinTarget) {
        insights.push({
          icon: "🤰",
          title: "Excellent Protein",
          description: `Great job! Average: ${Math.round(avgProtein)}g - perfect for pregnancy`,
          color: "#10B981",
        });
      }
    } else {
      // Regular protein insights
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

    // 4. PREGNANCY-SPECIFIC NUTRIENT TRACKING
    if (isPregnant) {
      let totalFolateCount = 0;
      let totalIronCount = 0;
      let totalCalciumCount = 0;
      let totalDHACount = 0;
      let totalMealsWithItems = 0;

      meals.forEach((meal) => {
        if (meal.items && meal.items.length > 0) {
          totalMealsWithItems++;
          meal.items.forEach((item) => {
            const nutrients = checkForPregnancyNutrients(item.food);
            if (nutrients.hasFolate) totalFolateCount++;
            if (nutrients.hasIron) totalIronCount++;
            if (nutrients.hasCalcium) totalCalciumCount++;
            if (nutrients.hasDHA) totalDHACount++;
          });
        }
      });

      // Folate insight (critical in 1st trimester)
      if (trimester === "FIRST") {
        if (totalFolateCount >= 5) {
          insights.push({
            icon: "🤰",
            title: "Excellent Folate Intake",
            description: `Great job! ${totalFolateCount} folate-rich foods this week - crucial for baby's development`,
            color: "#10B981",
          });
        } else if (totalFolateCount > 0) {
          insights.push({
            icon: "🤰",
            title: "Add More Folate",
            description: `Only ${totalFolateCount} folate-rich foods this week. Aim for daily intake (leafy greens, beans)`,
            color: "#F59E0B",
          });
        } else {
          insights.push({
            icon: "⚠️",
            title: "Missing Folate",
            description: "Folate is critical in 1st trimester. Add spinach, kale, beans, or fortified cereals",
            color: "#EF4444",
          });
        }
      }

      // Iron insight (critical in 2nd/3rd trimester)
      if (trimester === "SECOND" || trimester === "THIRD") {
        if (totalIronCount >= 5) {
          insights.push({
            icon: "🤰",
            title: "Great Iron Sources",
            description: `${totalIronCount} iron-rich foods this week - keeping anemia at bay!`,
            color: "#10B981",
          });
        } else if (totalIronCount > 0) {
          insights.push({
            icon: "🤰",
            title: "Boost Iron Intake",
            description: `Only ${totalIronCount} iron-rich foods this week. Add lean meats, spinach, or lentils`,
            color: "#F59E0B",
          });
        } else {
          insights.push({
            icon: "⚠️",
            title: "Need More Iron",
            description: "Iron prevents anemia during pregnancy. Include lean red meat, spinach, or fortified cereals",
            color: "#EF4444",
          });
        }
      }

      // Calcium insight
      if (totalCalciumCount >= 7) {
        insights.push({
          icon: "🤰",
          title: "Perfect Calcium",
          description: `${totalCalciumCount} calcium-rich foods - baby's bones are developing great!`,
          color: "#10B981",
        });
      } else if (totalCalciumCount < 3) {
        insights.push({
          icon: "🤰",
          title: "More Calcium Needed",
          description: "Aim for 3-4 calcium sources daily (dairy, fortified milk, leafy greens)",
          color: "#F59E0B",
        });
      }

      // DHA insight (critical in 3rd trimester for brain development)
      if (trimester === "THIRD") {
        if (totalDHACount >= 2) {
          insights.push({
            icon: "🤰",
            title: "Great DHA/Omega-3",
            description: `${totalDHACount} DHA sources this week - excellent for baby's brain development!`,
            color: "#10B981",
          });
        } else if (totalDHACount === 1) {
          insights.push({
            icon: "🤰",
            title: "Add More DHA",
            description: "Aim for 2x salmon per week, or add chia seeds/walnuts for baby's brain",
            color: "#F59E0B",
          });
        } else {
          insights.push({
            icon: "⚠️",
            title: "Missing DHA",
            description: "DHA supports baby's brain development. Add salmon, chia seeds, or fortified eggs",
            color: "#EF4444",
          });
        }
      }

      // Overall pregnancy grade trend
      const pregnancyGradedMeals = meals.filter((meal) => meal.gradeData?.isPregnancyGrade);
      if (pregnancyGradedMeals.length >= 3) {
        const avgScore = pregnancyGradedMeals.reduce((sum, meal) => sum + (meal.gradeData?.score || 0), 0) / pregnancyGradedMeals.length;
        if (avgScore >= 85) {
          insights.push({
            icon: "🎉",
            title: "Amazing Pregnancy Nutrition",
            description: `Your meals average ${Math.round(avgScore)}/100 - you're nourishing baby perfectly!`,
            color: "#10B981",
          });
        } else if (avgScore < 70) {
          insights.push({
            icon: "💡",
            title: "Nutrition Opportunity",
            description: `Average score: ${Math.round(avgScore)}/100. Focus on pregnancy-critical nutrients`,
            color: "#F59E0B",
          });
        }
      }
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
