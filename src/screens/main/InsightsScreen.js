import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Text as RNText } from 'react-native';
import { Text, Icon, IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { useAuth } from '../../context/AuthContext';
import { generateInsightsBackend } from '../../services/geminiService';
import { mealService } from '../../services/firebase';
import { useLocalization } from '../../localization/i18n';
import { colors, radius, shadows, type } from '../../theme';
import { getEffectiveStreak } from '../../utils/streak';

const { width: screenWidth } = Dimensions.get('window');
const CHART_WIDTH = Math.min(screenWidth, 520) - 72;

const TARGET_LINE = 'rgba(148, 163, 184,';

export default function InsightsScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const { t } = useLocalization();
  const [weeklyChartData, setWeeklyChartData] = useState(null);
  const [macroChartData, setMacroChartData] = useState([]);
  const [insights, setInsights] = useState([]);
  const [hasEnoughData, setHasEnoughData] = useState(true);
  const [daysWithData, setDaysWithData] = useState(0);
  const [loading, setLoading] = useState(true);
  const [weeklyMealsData, setWeeklyMealsData] = useState([]);
  const [calorieAdherenceData, setCalorieAdherenceData] = useState(null);
  const [dailyProteinData, setDailyProteinData] = useState(null);
  const [dailyCarbsData, setDailyCarbsData] = useState(null);
  const [dailyFatData, setDailyFatData] = useState(null);

  useEffect(() => {
    if (user && userProfile) {
      loadAnalytics();
      loadWeeklyData();
    }
  }, [user, userProfile]);

  const loadWeeklyData = async () => {
    if (!user) return;
    try {
      const today = new Date();
      const weekData = [];

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const meals = await mealService.getMealsByDate(user.uid, dateStr);
        weekData.push(meals && meals.length > 0);
      }

      setWeeklyMealsData(weekData);
    } catch (error) {
      console.error('Error loading weekly data:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      const result = await generateInsightsBackend(user.uid, userProfile);

      setHasEnoughData(result.hasEnoughData);
      setDaysWithData(result.daysWithData);

      setCalorieAdherenceData(result.calorieAdherenceData || null);
      setDailyProteinData(result.dailyProteinData || null);
      setDailyCarbsData(result.dailyCarbsData || null);
      setDailyFatData(result.dailyFatData || null);

      if (result.hasEnoughData) {
        setInsights(result.insights || []);
        setWeeklyChartData(result.weeklyChartData);
        setMacroChartData(result.macroChartData || []);
      } else {
        setInsights([]);
        setWeeklyChartData(null);
        setMacroChartData([]);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      setHasEnoughData(false);
      setInsights([]);
      setWeeklyChartData(null);
      setMacroChartData([]);
      setCalorieAdherenceData(null);
      setDailyProteinData(null);
      setDailyCarbsData(null);
      setDailyFatData(null);
    } finally {
      setLoading(false);
    }
  };

  const getWeeklyChartDataForDisplay = () => {
    if (!weeklyChartData || !weeklyChartData.labels || !weeklyChartData.data) return null;

    const hasData = weeklyChartData.data.some(val => val > 0);
    if (!hasData) return null;

    return {
      labels: weeklyChartData.labels,
      datasets: [{
        data: weeklyChartData.data,
        color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`,
        strokeWidth: 3
      }]
    };
  };

  const chartConfig = {
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    backgroundGradientFromOpacity: 0,
    backgroundGradientToOpacity: 0,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: colors.primary
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: colors.border,
      strokeWidth: 1
    },
    useShadowColorFromDataset: false
  };

  const weeklyChartDataDisplay = getWeeklyChartDataForDisplay();
  const streak = getEffectiveStreak(userProfile);

  // Shared renderer for the "actual vs target" line charts
  const renderTargetChart = (title, data, lineRgb, options = {}) => {
    if (!data || !data.labels) return null;
    const values = options.actualKey ? data[options.actualKey] : data.data;
    if (!values) return null;

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.chartSubtitle}>
          {options.subtitle || t('insights.actualVsTargetShort')}
        </Text>
        <LineChart
          data={{
            labels: data.labels,
            datasets: [
              {
                data: values,
                color: (opacity = 1) => `rgba(${lineRgb}, ${opacity})`,
                strokeWidth: 3
              },
              {
                data: Array(data.labels.length).fill(data.target),
                color: (opacity = 1) => `${TARGET_LINE} ${opacity})`,
                strokeWidth: 2,
                strokeDasharray: [8, 6],
                withDots: false
              }
            ],
            legend: [t('insights.actual'), t('insights.target')]
          }}
          width={CHART_WIDTH}
          height={200}
          chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(${lineRgb}, ${opacity})` }}
          bezier
          style={styles.chart}
          withInnerLines={true}
          withOuterLines={false}
          withVerticalLines={false}
          withHorizontalLines={true}
          withDots={true}
          withShadow={false}
          fromZero={true}
          yAxisSuffix={options.suffix || ''}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('insights.analyzing')}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 12 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('insights.title')}</Text>
        <Text style={styles.subtitle}>{t('insights.subtitle')}</Text>
      </View>

      {/* Daily plan */}
      {userProfile?.dailyCalorieTarget && (
        <TouchableOpacity
          onPress={() => navigation.navigate('BodyMetrics')}
          activeOpacity={0.7}
        >
          <View style={styles.planCard}>
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planLabel}>{t('insights.dailyTarget')}</Text>
                <View style={styles.planValueRow}>
                  <RNText style={styles.planCalories}>{userProfile.dailyCalorieTarget}</RNText>
                  <RNText style={styles.planUnit}>{t('insights.caloriesPerDay')}</RNText>
                </View>
              </View>
              <View style={styles.planEditBadge}>
                <Icon source="pencil-outline" size={18} color={colors.primary} />
              </View>
            </View>

            <View style={styles.planMacros}>
              <View style={styles.planMacro}>
                <View style={[styles.planMacroDot, { backgroundColor: colors.protein }]} />
                <Text style={styles.planMacroLabel}>{t('insights.protein')}</Text>
                <Text style={styles.planMacroValue}>{userProfile.proteinTarget}g</Text>
              </View>
              <View style={styles.planMacro}>
                <View style={[styles.planMacroDot, { backgroundColor: colors.carbs }]} />
                <Text style={styles.planMacroLabel}>{t('insights.carbs')}</Text>
                <Text style={styles.planMacroValue}>{userProfile.carbsTarget}g</Text>
              </View>
              <View style={styles.planMacro}>
                <View style={[styles.planMacroDot, { backgroundColor: colors.fat }]} />
                <Text style={styles.planMacroLabel}>{t('insights.fat')}</Text>
                <Text style={styles.planMacroValue}>{userProfile.fatTarget}g</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Streak */}
      {streak > 0 && (
        <View style={styles.streakCard}>
          <View style={styles.streakLeft}>
            <RNText style={styles.streakEmoji}>🔥</RNText>
            <View>
              <Text style={styles.streakNumber}>
                {t('insights.streakDays', { count: streak })}
              </Text>
              <Text style={styles.streakLabel}>{t('insights.currentStreak')}</Text>
            </View>
          </View>
          <View style={styles.streakRight}>
            <Text style={styles.weeklyLabel}>
              {t('insights.thisWeek', { count: weeklyMealsData.filter(Boolean).length })}
            </Text>
            <View style={styles.weeklyDots}>
              {(weeklyMealsData.length === 7 ? weeklyMealsData : [...Array(7)].map(() => false)).map((hasLog, i) => (
                <View key={i} style={[styles.weeklyDot, hasLog && styles.weeklyDotActive]} />
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Weekly recap, prominent on Mondays */}
      {new Date().getDay() === 1 && (
        <TouchableOpacity
          onPress={() => navigation.navigate('WeeklyRecap')}
          activeOpacity={0.7}
        >
          <View style={styles.recapCard}>
            <View style={styles.recapLeft}>
              <RNText style={styles.recapEmoji}>📅</RNText>
              <View>
                <Text style={styles.recapTitle}>{t('recap.bannerTitle')}</Text>
                <Text style={styles.recapSubtitle}>{t('recap.bannerSubtitle')}</Text>
              </View>
            </View>
            <Icon source="chevron-right" size={22} color={colors.faint} />
          </View>
        </TouchableOpacity>
      )}

      {/* Weight tracking link */}
      <TouchableOpacity
        onPress={() => navigation.navigate('WeightTracking')}
        activeOpacity={0.7}
      >
        <View style={styles.weightTrackingCard}>
          <View style={styles.weightTrackingLeft}>
            <View style={styles.weightIconWrap}>
              <Icon source="scale-bathroom" size={22} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.weightTrackingTitle}>{t('insights.weightTracking')}</Text>
              <Text style={styles.weightTrackingSubtitle}>{t('insights.weightTrackingSubtitle')}</Text>
            </View>
          </View>
          <Icon source="chevron-right" size={22} color={colors.faint} />
        </View>
      </TouchableOpacity>

      {/* Pregnancy card */}
      {userProfile?.isPregnant && (
        <View style={styles.pregnancyCard}>
          <View style={styles.pregnancyHeader}>
            <RNText style={styles.pregnancyEmoji}>🤰</RNText>
            <View style={styles.pregnancyInfo}>
              <Text style={styles.pregnancyTitle}>{t('insights.pregnancyNutrition')}</Text>
              <Text style={styles.pregnancyTrimester}>
                {userProfile.trimester === 'FIRST' && t('insights.trimesterFirst')}
                {userProfile.trimester === 'SECOND' && t('insights.trimesterSecond')}
                {userProfile.trimester === 'THIRD' && t('insights.trimesterThird')}
              </Text>
            </View>
          </View>

          <Text style={styles.pregnancyKeyNutrientsLabel}>{t('insights.keyNutrients')}</Text>

          <View style={styles.pregnancyNutrients}>
            {userProfile.trimester === 'FIRST' && (
              <>
                <View style={styles.pregnancyNutrient}>
                  <IconButton icon="leaf" size={20} iconColor="#10B981" style={styles.nutrientIcon} />
                  <View style={styles.nutrientTextWrap}>
                    <Text style={styles.nutrientName}>{t('insights.folate')}</Text>
                    <Text style={styles.nutrientReason}>{t('insights.folateReason')}</Text>
                  </View>
                </View>
                <View style={styles.pregnancyNutrient}>
                  <IconButton icon="water" size={20} iconColor="#3B82F6" style={styles.nutrientIcon} />
                  <View style={styles.nutrientTextWrap}>
                    <Text style={styles.nutrientName}>{t('insights.vitaminB6')}</Text>
                    <Text style={styles.nutrientReason}>{t('insights.vitaminB6Reason')}</Text>
                  </View>
                </View>
              </>
            )}
            {userProfile.trimester === 'SECOND' && (
              <>
                <View style={styles.pregnancyNutrient}>
                  <IconButton icon="silverware-fork-knife" size={20} iconColor="#EF4444" style={styles.nutrientIcon} />
                  <View style={styles.nutrientTextWrap}>
                    <Text style={styles.nutrientName}>{t('insights.iron')}</Text>
                    <Text style={styles.nutrientReason}>{t('insights.ironReason')}</Text>
                  </View>
                </View>
                <View style={styles.pregnancyNutrient}>
                  <IconButton icon="bone" size={20} iconColor={colors.primary} style={styles.nutrientIcon} />
                  <View style={styles.nutrientTextWrap}>
                    <Text style={styles.nutrientName}>{t('insights.calcium')}</Text>
                    <Text style={styles.nutrientReason}>{t('insights.calciumReason')}</Text>
                  </View>
                </View>
              </>
            )}
            {userProfile.trimester === 'THIRD' && (
              <>
                <View style={styles.pregnancyNutrient}>
                  <IconButton icon="fish" size={20} iconColor="#3B82F6" style={styles.nutrientIcon} />
                  <View style={styles.nutrientTextWrap}>
                    <Text style={styles.nutrientName}>{t('insights.dha')}</Text>
                    <Text style={styles.nutrientReason}>{t('insights.dhaReason')}</Text>
                  </View>
                </View>
                <View style={styles.pregnancyNutrient}>
                  <IconButton icon="silverware-fork-knife" size={20} iconColor="#EF4444" style={styles.nutrientIcon} />
                  <View style={styles.nutrientTextWrap}>
                    <Text style={styles.nutrientName}>{t('insights.iron')}</Text>
                    <Text style={styles.nutrientReason}>{t('insights.extraBlood')}</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.pregnancyTip}>
            <IconButton icon="information" size={16} iconColor="#92400E" style={styles.tipIcon} />
            <Text style={styles.pregnancyTipText}>
              {userProfile.trimester === 'FIRST' && t('insights.pregnancyTipFirst')}
              {userProfile.trimester === 'SECOND' && t('insights.pregnancyTipSecond')}
              {userProfile.trimester === 'THIRD' && t('insights.pregnancyTipThird')}
            </Text>
          </View>
        </View>
      )}

      {/* Charts */}
      {calorieAdherenceData && calorieAdherenceData.actual && renderTargetChart(
        t('insights.calorieAdherence'),
        calorieAdherenceData,
        '5, 150, 105',
        { actualKey: 'actual', subtitle: t('insights.actualVsTarget') }
      )}
      {renderTargetChart(t('insights.dailyProtein'), dailyProteinData, '239, 68, 68', { suffix: 'g' })}
      {renderTargetChart(t('insights.dailyCarbs'), dailyCarbsData, '59, 130, 246', { suffix: 'g' })}
      {renderTargetChart(t('insights.dailyFat'), dailyFatData, '245, 158, 11', { suffix: 'g' })}

      {/* Weekly Calorie Chart */}
      {weeklyChartDataDisplay && weeklyChartDataDisplay.datasets[0].data.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>{t('insights.weeklyCalories')}</Text>
          <Text style={styles.chartSubtitle}>{t('insights.last7Days')}</Text>
          <LineChart
            data={weeklyChartDataDisplay}
            width={CHART_WIDTH}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withInnerLines={true}
            withOuterLines={false}
            withVerticalLines={false}
            withHorizontalLines={true}
            withDots={true}
            withShadow={false}
            fromZero={true}
            yAxisSuffix=""
            yAxisInterval={1}
          />
        </View>
      )}

      {/* Macro Distribution */}
      {macroChartData.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>{t('insights.macroDistribution')}</Text>
          <Text style={styles.chartSubtitle}>{t('insights.weeklyBreakdown')}</Text>
          <View style={styles.pieChartContainer}>
            <PieChart
              data={macroChartData}
              width={CHART_WIDTH}
              height={200}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="0"
              center={[10, 0]}
              hasLegend={true}
              absolute
              avoidFalseZero
            />
          </View>
        </View>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <View style={styles.insightsSection}>
          <Text style={styles.sectionTitle}>{t('insights.keyInsights')}</Text>
          {insights.map((insight, index) => (
            <View
              key={index}
              style={[styles.insightCard, { borderLeftColor: insight.color || colors.primary }]}
            >
              <RNText style={styles.insightIcon}>{insight.icon}</RNText>
              <View style={styles.insightText}>
                <Text style={styles.insightTitle}>{insight.title}</Text>
                <Text style={styles.insightDescription}>{insight.description}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Empty State */}
      {!hasEnoughData ? (
        <View style={styles.emptyCard}>
          <RNText style={styles.emptyIcon}>📊</RNText>
          <Text style={styles.emptyTitle}>{t('insights.noDataYet')}</Text>
          <Text style={styles.emptyText}>{t('insights.noDataBody')}</Text>
          {daysWithData > 0 && (
            <Text style={[styles.emptyText, { marginTop: 8 }]}>
              {t('insights.daysLogged', { count: daysWithData, plural: daysWithData !== 1 ? 's' : '' })}
            </Text>
          )}
        </View>
      ) : null}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  loadingText: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center'
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 16
  },
  title: {
    ...type.display,
    fontSize: 28,
    marginBottom: 4
  },
  subtitle: {
    ...type.caption,
    fontSize: 14
  },
  planCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.tintBorder,
    ...shadows.card
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  planLabel: {
    ...type.overline,
    marginBottom: 6
  },
  planValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6
  },
  planCalories: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -1.5
  },
  planUnit: {
    fontSize: 13,
    color: colors.muted
  },
  planEditBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  planMacros: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.subtle
  },
  planMacro: {
    flex: 1,
    alignItems: 'center'
  },
  planMacroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 6
  },
  planMacroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3
  },
  planMacroValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3
  },
  streakCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadows.card
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  streakEmoji: {
    fontSize: 36
  },
  streakNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.flame,
    letterSpacing: -0.5
  },
  streakLabel: {
    ...type.caption,
    marginTop: 2
  },
  streakRight: {
    alignItems: 'flex-end'
  },
  weeklyLabel: {
    ...type.caption,
    fontSize: 12,
    marginBottom: 8
  },
  weeklyDots: {
    flexDirection: 'row',
    gap: 6
  },
  weeklyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border
  },
  weeklyDotActive: {
    backgroundColor: colors.success
  },
  recapCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    backgroundColor: colors.tint,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.tintBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  recapLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  recapEmoji: {
    fontSize: 30
  },
  recapTitle: {
    ...type.heading,
    fontSize: 15,
    marginBottom: 2
  },
  recapSubtitle: {
    ...type.caption,
    fontSize: 12
  },
  weightTrackingCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.card
  },
  weightTrackingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  weightIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  weightTrackingTitle: {
    ...type.heading,
    fontSize: 15,
    marginBottom: 2
  },
  weightTrackingSubtitle: {
    ...type.caption,
    fontSize: 12
  },
  chartCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadows.card
  },
  chartTitle: {
    ...type.heading,
    marginBottom: 2
  },
  chartSubtitle: {
    ...type.caption,
    fontSize: 12,
    marginBottom: 12
  },
  chart: {
    marginVertical: 4,
    borderRadius: 16
  },
  pieChartContainer: {
    alignItems: 'center',
    marginVertical: 4
  },
  insightsSection: {
    paddingHorizontal: 16,
    marginBottom: 14
  },
  sectionTitle: {
    ...type.title,
    fontSize: 20,
    marginBottom: 12
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    ...shadows.card
  },
  insightIcon: {
    fontSize: 28,
    marginRight: 14
  },
  insightText: {
    flex: 1
  },
  insightTitle: {
    ...type.heading,
    fontSize: 15,
    marginBottom: 3
  },
  insightDescription: {
    ...type.body,
    fontSize: 13,
    lineHeight: 19
  },
  emptyCard: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    ...shadows.card
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 14
  },
  emptyTitle: {
    ...type.heading,
    fontSize: 19,
    marginBottom: 6
  },
  emptyText: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center'
  },
  pregnancyCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 18,
    backgroundColor: '#FFFBEB',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#FDE68A'
  },
  pregnancyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  pregnancyEmoji: {
    fontSize: 40,
    marginRight: 14
  },
  pregnancyInfo: {
    flex: 1
  },
  pregnancyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2
  },
  pregnancyTrimester: {
    color: '#B45309',
    fontWeight: '600',
    fontSize: 13
  },
  pregnancyKeyNutrientsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10
  },
  pregnancyNutrients: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12
  },
  pregnancyNutrient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  nutrientIcon: {
    margin: 0,
    marginRight: 4
  },
  nutrientTextWrap: {
    flex: 1
  },
  nutrientName: {
    fontWeight: '700',
    color: '#92400E',
    fontSize: 13,
    marginBottom: 1
  },
  nutrientReason: {
    color: '#B45309',
    fontSize: 11
  },
  pregnancyTip: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  tipIcon: {
    margin: 0,
    marginRight: 6,
    marginTop: -2
  },
  pregnancyTipText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    lineHeight: 17
  }
});
