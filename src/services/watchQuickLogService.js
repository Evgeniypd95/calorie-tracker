import { addWatchMessageListener, sendQuickLogResult } from 'watch-connectivity';
import { parseMealDescription } from './geminiService';
import { mealService } from './firebase';
import { widgetService } from './widgetService';

// Guesses a meal type from time of day since the watch quick-log flow has
// no picker of its own — matches what the AI chat flow lets a user override,
// but there's no UI on-watch to override it, so this is the best guess.
const guessMealTypeForNow = () => {
  const hour = new Date().getHours();
  if (hour < 11) return 'Breakfast';
  if (hour < 16) return 'Lunch';
  if (hour < 21) return 'Dinner';
  return 'Snack';
};

const refreshSnapshotForToday = async (userId, userProfile) => {
  const todaysMeals = await mealService.getMealsByDate(userId, new Date());
  const totals = todaysMeals.reduce((acc, meal) => ({
    calories: acc.calories + (meal.totals?.calories || 0),
    protein: acc.protein + (meal.totals?.protein || 0),
    carbs: acc.carbs + (meal.totals?.carbs || 0),
    fat: acc.fat + (meal.totals?.fat || 0)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  widgetService.updateTodaySnapshot({
    meals: todaysMeals,
    totals,
    targets: {
      calorieTarget: userProfile?.dailyCalorieTarget,
      proteinTarget: userProfile?.proteinTarget,
      carbsTarget: userProfile?.carbsTarget,
      fatTarget: userProfile?.fatTarget
    }
  });
};

// Subscribes to quick-log text sent from the watch app, runs it through the
// same AI parsing + save pipeline as the chat screen, then pushes the
// updated totals back down so the watch glance/complication stays current.
// Returns an unsubscribe function.
export const startWatchQuickLogListener = ({ user, userProfile, locale }) => {
  if (!user) return () => {};

  const subscription = addWatchMessageListener(async (message) => {
    if (message?.type !== 'quickLog' || !message.text) return;

    const requestId = message.requestId || null;

    try {
      const result = await parseMealDescription(message.text, null, locale);
      const totalCal = result?.totals?.calories || 0;
      const hasNoItems = !result?.items || result.items.length === 0;

      if (totalCal < 20 || hasNoItems) {
        sendQuickLogResult({ type: 'quickLogResult', requestId, success: false, reason: 'unrecognized' });
        return;
      }

      await mealService.logMeal(user.uid, {
        mealType: guessMealTypeForNow(),
        description: message.text,
        items: result.items,
        totals: result.totals,
        date: new Date()
      });

      await refreshSnapshotForToday(user.uid, userProfile);

      sendQuickLogResult({
        type: 'quickLogResult',
        requestId,
        success: true,
        calories: Math.round(totalCal)
      });
    } catch (error) {
      console.error('Error handling watch quick-log message:', error);
      sendQuickLogResult({ type: 'quickLogResult', requestId, success: false, reason: 'error' });
    }
  });

  return () => subscription.remove();
};
