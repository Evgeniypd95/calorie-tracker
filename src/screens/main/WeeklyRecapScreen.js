import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text as RNText } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { mealService, weightService } from '../../services/firebase';
import { useLocalization } from '../../localization/i18n';
import { colors, gradients, radius, shadows, type } from '../../theme';
import { getEffectiveStreak } from '../../utils/streak';

const ON_TARGET_TOLERANCE = 50;

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getLastCompletedWeekRange = () => {
  const today = startOfDay(new Date());
  const dayOfWeek = today.getDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const thisWeekMonday = new Date(today);
  thisWeekMonday.setDate(today.getDate() - daysSinceMonday);
  const lastWeekMonday = new Date(thisWeekMonday);
  lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);
  const lastWeekSunday = new Date(thisWeekMonday);
  lastWeekSunday.setDate(thisWeekMonday.getDate() - 1);
  lastWeekSunday.setHours(23, 59, 59, 999);
  return { start: lastWeekMonday, end: lastWeekSunday };
};

function StatTile({ value, label }) {
  return (
    <View style={styles.statTile}>
      <RNText style={styles.statTileValue}>{value}</RNText>
      <Text style={styles.statTileLabel}>{label}</Text>
    </View>
  );
}

export default function WeeklyRecapScreen() {
  const { user, userProfile } = useAuth();
  const { t } = useLocalization();
  const [loading, setLoading] = useState(true);
  const [recap, setRecap] = useState(null);

  useEffect(() => {
    loadRecap();
  }, []);

  const loadRecap = async () => {
    try {
      setLoading(true);
      const { start, end } = getLastCompletedWeekRange();
      const meals = await mealService.getUserMeals(user.uid, 14);
      const weekMeals = meals.filter((meal) => {
        const mealDate = meal.date?.toDate?.() || new Date(meal.date);
        return mealDate >= start && mealDate <= end;
      });

      const target = userProfile?.dailyCalorieTarget || 0;
      const dayTotals = {};
      weekMeals.forEach((meal) => {
        const mealDate = meal.date?.toDate?.() || new Date(meal.date);
        const key = mealDate.toDateString();
        dayTotals[key] = (dayTotals[key] || 0) + (meal.totals?.calories || 0);
      });

      const daysLogged = Object.keys(dayTotals).length;
      const dailyValues = Object.values(dayTotals);
      const avgCalories = dailyValues.length > 0
        ? Math.round(dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length)
        : 0;
      const daysOnTarget = target > 0
        ? dailyValues.filter((cals) => Math.abs(cals - target) <= ON_TARGET_TOLERANCE).length
        : 0;

      const foodCounts = {};
      weekMeals.forEach((meal) => {
        (meal.items || []).forEach((item) => {
          const key = (item.food || '').trim().toLowerCase();
          if (!key) return;
          foodCounts[key] = (foodCounts[key] || 0) + 1;
        });
      });
      const topFoods = Object.entries(foodCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([food]) => food);

      let weightDelta = null;
      try {
        const weights = await weightService.getWeightHistory(user.uid, 14);
        const weekWeights = weights.filter((w) => {
          const wDate = w.date?.toDate?.() || new Date(w.date);
          return wDate >= start && wDate <= end;
        });
        if (weekWeights.length >= 2) {
          weightDelta = weekWeights[weekWeights.length - 1].weight - weekWeights[0].weight;
        }
      } catch (e) {
        weightDelta = null;
      }

      setRecap({
        start,
        end,
        daysLogged,
        avgCalories,
        target,
        daysOnTarget,
        topFoods,
        weightDelta,
        streak: getEffectiveStreak(userProfile)
      });
    } catch (error) {
      console.error('Error loading weekly recap:', error);
      setRecap(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!recap || recap.daysLogged === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.emptyContent}>
        <RNText style={styles.emptyIcon}>📅</RNText>
        <Text style={styles.emptyTitle}>{t('recap.emptyTitle')}</Text>
        <Text style={styles.emptyBody}>{t('recap.emptyBody')}</Text>
      </ScrollView>
    );
  }

  const dateRangeLabel = `${recap.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${recap.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroLabel}>{t('recap.title')}</Text>
        <RNText style={styles.heroDateRange}>{dateRangeLabel}</RNText>
        <RNText style={styles.heroBigStat}>{t('recap.daysLogged', { count: recap.daysLogged })}</RNText>
      </LinearGradient>

      <View style={styles.statsGrid}>
        <StatTile value={recap.avgCalories} label={t('recap.avgCalories')} />
        <StatTile value={recap.daysOnTarget} label={t('recap.daysOnTarget')} />
        <StatTile value={`🔥 ${recap.streak}`} label={t('recap.currentStreak')} />
      </View>

      {recap.topFoods.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('recap.topFoods')}</Text>
          {recap.topFoods.map((food, i) => (
            <View key={food} style={styles.foodRow}>
              <View style={styles.foodRank}>
                <RNText style={styles.foodRankText}>{i + 1}</RNText>
              </View>
              <Text style={styles.foodName}>{food}</Text>
            </View>
          ))}
        </View>
      )}

      {recap.weightDelta !== null && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('recap.weightTrend')}</Text>
          <Text style={styles.weightDeltaText}>
            {recap.weightDelta > 0
              ? t('recap.weightUp', { amount: Math.abs(recap.weightDelta).toFixed(1) })
              : recap.weightDelta < 0
              ? t('recap.weightDown', { amount: Math.abs(recap.weightDelta).toFixed(1) })
              : t('recap.weightSame')}
          </Text>
        </View>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  loadingText: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 60
  },
  emptyContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 14
  },
  emptyTitle: {
    ...type.heading,
    fontSize: 19,
    marginBottom: 6,
    textAlign: 'center'
  },
  emptyBody: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center'
  },
  heroCard: {
    borderRadius: radius.xl,
    padding: 24,
    marginBottom: 16,
    ...shadows.glow
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6
  },
  heroDateRange: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    opacity: 0.9
  },
  heroBigStat: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadows.card
  },
  statTileValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
    marginBottom: 4
  },
  statTileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 14,
    ...shadows.card
  },
  sectionTitle: {
    ...type.heading,
    marginBottom: 12
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8
  },
  foodRank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  foodRankText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDark
  },
  foodName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    textTransform: 'capitalize'
  },
  weightDeltaText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink
  }
});
