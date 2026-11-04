import { Platform } from 'react-native';
import { ExtensionStorage } from '@bacons/apple-targets';
import { updateWatchContext } from 'watch-connectivity';

const APP_GROUP = 'group.com.evgenypavlovd.texttocalai';
const SNAPSHOT_KEY = 'todayMealsSnapshot';

const storage = Platform.OS === 'ios' ? new ExtensionStorage(APP_GROUP) : null;

// Widget can only show a handful of rows before it gets cramped
const MAX_WIDGET_MEALS = 4;

// Watch quick-log presets: most recent distinct meal descriptions, for
// one-tap re-logging without dictating the same thing twice in a row.
const MAX_WATCH_PRESETS = 6;

const buildRecentPresets = (meals) => {
  const seen = new Set();
  const presets = [];

  for (const meal of meals) {
    const description = (meal.description || '').trim();
    if (!description || seen.has(description)) continue;
    seen.add(description);
    presets.push({
      description,
      mealType: meal.mealType || 'Snack',
      calories: Math.round(meal.totals?.calories || 0)
    });
    if (presets.length >= MAX_WATCH_PRESETS) break;
  }

  return presets;
};

export const widgetService = {
  // Pushes today's meals + calorie/macro totals into the shared App Group
  // storage that the "Today's Meals" widget reads from, then asks iOS to
  // redraw the widget immediately instead of waiting for its next timeline tick.
  // Also mirrors the same totals (plus quick-log presets) to a paired Apple
  // Watch over WatchConnectivity, since the watch app/complications can't
  // read the iOS App Group directly.
  updateTodaySnapshot: ({ meals, totals, targets }) => {
    const snapshot = {
      updatedAt: new Date().toISOString(),
      calories: Math.round(totals?.calories || 0),
      calorieTarget: Math.round(targets?.calorieTarget || 0),
      protein: Math.round(totals?.protein || 0),
      proteinTarget: Math.round(targets?.proteinTarget || 0),
      carbs: Math.round(totals?.carbs || 0),
      carbsTarget: Math.round(targets?.carbsTarget || 0),
      fat: Math.round(totals?.fat || 0),
      fatTarget: Math.round(targets?.fatTarget || 0)
    };

    if (storage) {
      try {
        const widgetMeals = meals
          .slice(0, MAX_WIDGET_MEALS)
          .map((meal) => ({
            id: meal.id,
            mealType: meal.mealType || 'Snack',
            description: meal.description || '',
            calories: Math.round(meal.totals?.calories || 0)
          }));

        storage.set(SNAPSHOT_KEY, { ...snapshot, meals: widgetMeals });
        ExtensionStorage.reloadWidget();
      } catch (error) {
        console.error('Error updating widget snapshot:', error);
      }
    }

    if (Platform.OS === 'ios') {
      try {
        updateWatchContext({
          ...snapshot,
          presets: buildRecentPresets(meals)
        });
      } catch (error) {
        console.error('Error updating watch context:', error);
      }
    }
  }
};
