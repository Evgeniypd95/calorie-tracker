import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Platform, useColorScheme, TouchableOpacity } from 'react-native';
import { Text, Card, Surface, useTheme, IconButton, Divider } from 'react-native-paper';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { useAuth } from '../../context/AuthContext';
import { generateInsightsBackend } from '../../services/geminiService';
import { mealService } from '../../services/firebase';

const { width: screenWidth } = Dimensions.get('window');

export default function InsightsScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const [weeklyChartData, setWeeklyChartData] = useState(null);
  const [macroChartData, setMacroChartData] = useState([]);
  const [insights, setInsights] = useState([]);
  const [hasEnoughData, setHasEnoughData] = useState(true);
  const [daysWithData, setDaysWithData] = useState(0);
  const [loading, setLoading] = useState(true);
  const [weeklyMealsData, setWeeklyMealsData] = useState([]);

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

      // Call backend to generate insights
      const result = await generateInsightsBackend(user.uid, userProfile);

      console.log('[Insights] Backend result:', result);

      setHasEnoughData(result.hasEnoughData);
      setDaysWithData(result.daysWithData);

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
    } finally {
      setLoading(false);
    }
  };

  const getWeeklyChartDataForDisplay = () => {
    if (!weeklyChartData || !weeklyChartData.labels || !weeklyChartData.data) return null;

    // Ensure we have at least some valid data
    const hasData = weeklyChartData.data.some(val => val > 0);
    if (!hasData) return null;

    return {
      labels: weeklyChartData.labels,
      datasets: [{
        data: weeklyChartData.data,
        color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
        strokeWidth: 3
      }]
    };
  };

  const chartConfig = {
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    backgroundGradientFromOpacity: 0,
    backgroundGradientToOpacity: 0,
    decimalPlaces: 0,
    color: (opacity = 1) => colorScheme === 'dark'
      ? `rgba(241, 245, 249, ${opacity})`
      : `rgba(99, 102, 241, ${opacity})`,
    labelColor: (opacity = 1) => colorScheme === 'dark'
      ? `rgba(241, 245, 249, ${opacity})`
      : `rgba(30, 41, 59, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: '#6366F1'
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: colorScheme === 'dark' ? '#334155' : '#E2E8F0',
      strokeWidth: 1
    },
    useShadowColorFromDataset: false
  };

  const weeklyChartDataDisplay = getWeeklyChartDataForDisplay();

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text variant="bodyLarge" style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            📊 Analyzing your nutrition data...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onBackground }]}>
          My Goals
        </Text>
        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Track your progress and nutrition
        </Text>
      </View>

      {/* Compact Personalized Plan Card */}
      {userProfile?.dailyCalorieTarget && (
        <TouchableOpacity
          onPress={() => navigation.navigate('BodyMetrics')}
          activeOpacity={0.7}
        >
          <Card style={[styles.compactPlanCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <Card.Content>
              <View style={styles.compactPlanHeader}>
                <View>
                  <Text variant="labelSmall" style={[styles.compactPlanLabel, { color: theme.colors.onSurfaceVariant }]}>
                    YOUR DAILY TARGET
                  </Text>
                  <Text variant="headlineLarge" style={[styles.compactPlanCalories, { color: '#6366F1' }]}>
                    {userProfile.dailyCalorieTarget}
                  </Text>
                  <Text variant="bodySmall" style={[styles.compactPlanUnit, { color: theme.colors.onSurfaceVariant }]}>
                    calories/day
                  </Text>
                </View>
                <IconButton
                  icon="pencil"
                  size={24}
                  iconColor="#6366F1"
                  style={styles.editButton}
                  onPress={() => navigation.navigate('BodyMetrics')}
                />
              </View>

              <Divider style={styles.compactDivider} />

              <View style={styles.compactMacrosRow}>
                <View style={styles.compactMacro}>
                  <View style={[styles.compactMacroBar, { backgroundColor: '#EF4444' }]} />
                  <Text variant="labelSmall" style={[styles.compactMacroLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Protein
                  </Text>
                  <Text variant="titleMedium" style={[styles.compactMacroValue, { color: theme.colors.onSurface }]}>
                    {userProfile.proteinTarget}g
                  </Text>
                </View>
                <View style={styles.compactMacro}>
                  <View style={[styles.compactMacroBar, { backgroundColor: '#10B981' }]} />
                  <Text variant="labelSmall" style={[styles.compactMacroLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Carbs
                  </Text>
                  <Text variant="titleMedium" style={[styles.compactMacroValue, { color: theme.colors.onSurface }]}>
                    {userProfile.carbsTarget}g
                  </Text>
                </View>
                <View style={styles.compactMacro}>
                  <View style={[styles.compactMacroBar, { backgroundColor: '#F59E0B' }]} />
                  <Text variant="labelSmall" style={[styles.compactMacroLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Fat
                  </Text>
                  <Text variant="titleMedium" style={[styles.compactMacroValue, { color: theme.colors.onSurface }]}>
                    {userProfile.fatTarget}g
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        </TouchableOpacity>
      )}

      {/* Weight Tracking Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate('WeightTracking')}
        activeOpacity={0.7}
      >
        <Card style={[styles.weightTrackingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Card.Content>
            <View style={styles.weightTrackingRow}>
              <View style={styles.weightTrackingLeft}>
                <Text style={styles.weightTrackingEmoji}>⚖️</Text>
                <View>
                  <Text variant="titleMedium" style={[styles.weightTrackingTitle, { color: theme.colors.onSurface }]}>
                    Weight Tracking
                  </Text>
                  <Text variant="bodySmall" style={[styles.weightTrackingSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Log weight & see progress
                  </Text>
                </View>
              </View>
              <IconButton
                icon="chevron-right"
                size={24}
                iconColor={theme.colors.onSurfaceVariant}
              />
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>

      {/* Pregnancy Tracking Card */}
      {userProfile?.isPregnant && (
        <Card style={[styles.pregnancyCard, { backgroundColor: '#FEF3C7' }]} elevation={2}>
          <Card.Content>
            <View style={styles.pregnancyHeader}>
              <Text style={styles.pregnancyEmoji}>🤰</Text>
              <View style={styles.pregnancyInfo}>
                <Text variant="titleLarge" style={styles.pregnancyTitle}>
                  Pregnancy Nutrition
                </Text>
                <Text variant="bodyMedium" style={styles.pregnancyTrimester}>
                  {userProfile.trimester === 'FIRST' && '1st Trimester (Weeks 1-13)'}
                  {userProfile.trimester === 'SECOND' && '2nd Trimester (Weeks 14-27)'}
                  {userProfile.trimester === 'THIRD' && '3rd Trimester (Weeks 28-40)'}
                </Text>
              </View>
            </View>

            <Divider style={[styles.pregnancyDivider, { backgroundColor: '#F59E0B' }]} />

            <Text variant="labelSmall" style={styles.pregnancyKeyNutrientsLabel}>
              KEY NUTRIENTS THIS {userProfile.trimester === 'FIRST' ? 'TRIMESTER' : userProfile.trimester === 'SECOND' ? 'TRIMESTER' : 'TRIMESTER'}
            </Text>

            <View style={styles.pregnancyNutrients}>
              {userProfile.trimester === 'FIRST' && (
                <>
                  <View style={styles.pregnancyNutrient}>
                    <IconButton icon="leaf" size={20} iconColor="#10B981" style={styles.nutrientIcon} />
                    <View>
                      <Text variant="labelMedium" style={styles.nutrientName}>Folate</Text>
                      <Text variant="bodySmall" style={styles.nutrientReason}>Prevents birth defects</Text>
                    </View>
                  </View>
                  <View style={styles.pregnancyNutrient}>
                    <IconButton icon="water" size={20} iconColor="#3B82F6" style={styles.nutrientIcon} />
                    <View>
                      <Text variant="labelMedium" style={styles.nutrientName}>Vitamin B6</Text>
                      <Text variant="bodySmall" style={styles.nutrientReason}>Reduces nausea</Text>
                    </View>
                  </View>
                </>
              )}
              {userProfile.trimester === 'SECOND' && (
                <>
                  <View style={styles.pregnancyNutrient}>
                    <IconButton icon="silverware-fork-knife" size={20} iconColor="#EF4444" style={styles.nutrientIcon} />
                    <View>
                      <Text variant="labelMedium" style={styles.nutrientName}>Iron</Text>
                      <Text variant="bodySmall" style={styles.nutrientReason}>Prevents anemia</Text>
                    </View>
                  </View>
                  <View style={styles.pregnancyNutrient}>
                    <IconButton icon="bone" size={20} iconColor="#6366F1" style={styles.nutrientIcon} />
                    <View>
                      <Text variant="labelMedium" style={styles.nutrientName}>Calcium</Text>
                      <Text variant="bodySmall" style={styles.nutrientReason}>Baby's bone growth</Text>
                    </View>
                  </View>
                </>
              )}
              {userProfile.trimester === 'THIRD' && (
                <>
                  <View style={styles.pregnancyNutrient}>
                    <IconButton icon="fish" size={20} iconColor="#3B82F6" style={styles.nutrientIcon} />
                    <View>
                      <Text variant="labelMedium" style={styles.nutrientName}>DHA/Omega-3</Text>
                      <Text variant="bodySmall" style={styles.nutrientReason}>Brain development</Text>
                    </View>
                  </View>
                  <View style={styles.pregnancyNutrient}>
                    <IconButton icon="silverware-fork-knife" size={20} iconColor="#EF4444" style={styles.nutrientIcon} />
                    <View>
                      <Text variant="labelMedium" style={styles.nutrientName}>Iron</Text>
                      <Text variant="bodySmall" style={styles.nutrientReason}>Extra blood volume</Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            <Surface style={styles.pregnancyTip} elevation={0}>
              <IconButton icon="information" size={16} iconColor="#92400E" style={styles.tipIcon} />
              <Text variant="bodySmall" style={styles.pregnancyTipText}>
                {userProfile.trimester === 'FIRST' && 'Focus on small, frequent meals if experiencing nausea. Folate is crucial now!'}
                {userProfile.trimester === 'SECOND' && 'Your baby is growing fast! Iron and calcium are essential for development.'}
                {userProfile.trimester === 'THIRD' && "Baby's brain is developing rapidly. Include DHA-rich foods like salmon and walnuts."}
              </Text>
            </Surface>
          </Card.Content>
        </Card>
      )}

      {/* Streak & Gamification Card */}
      {userProfile?.streakCount > 0 && (
        <Card style={[styles.streakCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Card.Content>
            <View style={styles.streakContainer}>
              <View style={styles.streakLeft}>
                <Text style={styles.streakEmoji}>🔥</Text>
                <View>
                  <Text variant="headlineMedium" style={styles.streakNumber}>
                    {userProfile.streakCount} days
                  </Text>
                  <Text variant="bodySmall" style={[styles.streakLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Current Streak
                  </Text>
                </View>
              </View>
              <View style={styles.streakRight}>
                <Text variant="bodySmall" style={[styles.weeklyLabel, { color: theme.colors.onSurfaceVariant }]}>
                  This week: {weeklyMealsData.filter(Boolean).length}/7 days
                </Text>
                <View style={styles.weeklyDots}>
                  {weeklyMealsData.length === 7 ? weeklyMealsData.map((hasLog, i) => (
                    <View
                      key={i}
                      style={[
                        styles.weeklyDot,
                        hasLog && styles.weeklyDotActive
                      ]}
                    />
                  )) : [...Array(7)].map((_, i) => (
                    <View
                      key={i}
                      style={styles.weeklyDot}
                    />
                  ))}
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Weekly Calorie Chart */}
      {weeklyChartDataDisplay && weeklyChartDataDisplay.datasets && weeklyChartDataDisplay.datasets[0].data.length > 0 && (
        <Card style={[styles.chartCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Card.Content>
            <Text variant="titleLarge" style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
              Weekly Calories
            </Text>
            <Text variant="bodySmall" style={[styles.chartSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Last 7 days
            </Text>
            <LineChart
              data={weeklyChartDataDisplay}
              width={screenWidth - 80}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              withInnerLines={true}
              withOuterLines={true}
              withVerticalLines={false}
              withHorizontalLines={true}
              withDots={true}
              withShadow={false}
              fromZero={true}
              yAxisSuffix=""
              yAxisInterval={1}
            />
          </Card.Content>
        </Card>
      )}

      {/* Macro Distribution */}
      {macroChartData.length > 0 && (
        <Card style={[styles.chartCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Card.Content>
            <Text variant="titleLarge" style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
              Macro Distribution
            </Text>
            <Text variant="bodySmall" style={[styles.chartSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Weekly breakdown
            </Text>
            <View style={styles.pieChartContainer}>
              <PieChart
                data={macroChartData}
                width={screenWidth - 80}
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
          </Card.Content>
        </Card>
      )}

      {/* Insights Cards */}
      {insights.length > 0 && (
        <View style={styles.insightsSection}>
          <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            Key Insights
          </Text>
          {insights.map((insight, index) => (
            <Card
              key={index}
              style={[
                styles.insightCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderLeftWidth: 4,
                  borderLeftColor: insight.color
                }
              ]}
              elevation={1}
            >
              <Card.Content style={styles.insightContent}>
                <View style={styles.insightLeft}>
                  <Text style={styles.insightIcon}>{insight.icon}</Text>
                  <View style={styles.insightText}>
                    <Text variant="titleMedium" style={[styles.insightTitle, { color: theme.colors.onSurface }]}>
                      {insight.title}
                    </Text>
                    <Text variant="bodyMedium" style={[styles.insightDescription, { color: theme.colors.onSurfaceVariant }]}>
                      {insight.description}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      {/* Empty State */}
      {!hasEnoughData ? (
        <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.emptyContent}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text variant="titleLarge" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
              No data yet
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              Log meals for at least 5 days to see your trends and insights!
            </Text>
            {daysWithData > 0 && (
              <Text variant="bodySmall" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant, marginTop: 8 }]}>
                You have {daysWithData} day{daysWithData !== 1 ? 's' : ''} logged. Keep it up!
              </Text>
            )}
          </Card.Content>
        </Card>
      ) : null}

      {/* Bottom padding */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  loadingText: {
    textAlign: 'center',
    lineHeight: 24
  },
  header: {
    padding: 20,
    paddingTop: 32
  },
  title: {
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 8
  },
  subtitle: {
    letterSpacing: 0.2
  },
  chartCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  streakCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  streakContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  streakEmoji: {
    fontSize: 48
  },
  streakNumber: {
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: -1
  },
  streakLabel: {
    marginTop: 4
  },
  streakRight: {
    alignItems: 'flex-end'
  },
  weeklyLabel: {
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
    backgroundColor: '#E2E8F0'
  },
  weeklyDotActive: {
    backgroundColor: '#10B981'
  },
  chartTitle: {
    fontWeight: '700',
    marginBottom: 4
  },
  chartSubtitle: {
    marginBottom: 16,
    opacity: 0.7
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16
  },
  pieChartContainer: {
    alignItems: 'center',
    marginVertical: 8
  },
  insightsSection: {
    paddingHorizontal: 20,
    marginBottom: 20
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.5
  },
  insightCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden'
  },
  insightContent: {
    paddingVertical: 8
  },
  insightLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  insightIcon: {
    fontSize: 32,
    marginRight: 16
  },
  insightText: {
    flex: 1
  },
  insightTitle: {
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3
  },
  insightDescription: {
    lineHeight: 20
  },
  emptyCard: {
    marginHorizontal: 20,
    marginTop: 40,
    borderRadius: 20
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16
  },
  emptyTitle: {
    fontWeight: '700',
    marginBottom: 8
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 22
  },
  compactPlanCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#6366F1',
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 20px rgba(99, 102, 241, 0.15)',
      },
    }),
  },
  compactPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  compactPlanLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8
  },
  compactPlanCalories: {
    fontWeight: '900',
    letterSpacing: -2,
    marginBottom: 4
  },
  compactPlanUnit: {
    fontSize: 13
  },
  editButton: {
    margin: 0,
    marginTop: -8
  },
  compactDivider: {
    marginBottom: 16
  },
  compactMacrosRow: {
    flexDirection: 'row',
    gap: 12
  },
  compactMacro: {
    flex: 1,
    alignItems: 'center'
  },
  compactMacroBar: {
    width: 3,
    height: 32,
    borderRadius: 2,
    marginBottom: 8
  },
  compactMacroLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  compactMacroValue: {
    fontWeight: '700'
  },
  // Pregnancy Card Styles
  pregnancyCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#F59E0B'
  },
  pregnancyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  pregnancyEmoji: {
    fontSize: 48,
    marginRight: 16
  },
  pregnancyInfo: {
    flex: 1
  },
  pregnancyTitle: {
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4
  },
  pregnancyTrimester: {
    color: '#B45309',
    fontWeight: '600'
  },
  pregnancyDivider: {
    marginVertical: 16,
    height: 2
  },
  pregnancyKeyNutrientsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 1,
    marginBottom: 12
  },
  pregnancyNutrients: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16
  },
  pregnancyNutrient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  nutrientIcon: {
    margin: 0,
    marginRight: 8
  },
  nutrientName: {
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2
  },
  nutrientReason: {
    color: '#B45309',
    fontSize: 11
  },
  pregnancyTip: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  tipIcon: {
    margin: 0,
    marginRight: 8,
    marginTop: -2
  },
  pregnancyTipText: {
    flex: 1,
    color: '#92400E',
    lineHeight: 18
  },
  // Weight Tracking Card Styles
  weightTrackingCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  weightTrackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  weightTrackingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  weightTrackingEmoji: {
    fontSize: 32
  },
  weightTrackingTitle: {
    fontWeight: '700',
    marginBottom: 4
  },
  weightTrackingSubtitle: {
    fontSize: 13
  }
});
