import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Platform, useColorScheme } from 'react-native';
import { Text, Card, Surface, useTheme } from 'react-native-paper';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { useAuth } from '../../context/AuthContext';
import { mealService } from '../../services/firebase';

const { width: screenWidth } = Dimensions.get('window');

export default function InsightsScreen() {
  const { user, userProfile } = useAuth();
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const [weeklyData, setWeeklyData] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Get last 7 days of meals
      const meals = await mealService.getUserMeals(user.uid, 7);

      // Group meals by day
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        last7Days.push(date);
      }

      const dailyTotals = last7Days.map(date => {
        const dayMeals = meals.filter(meal => {
          const mealDate = meal.date?.toDate?.() || new Date(meal.date);
          return (
            mealDate.getDate() === date.getDate() &&
            mealDate.getMonth() === date.getMonth() &&
            mealDate.getFullYear() === date.getFullYear()
          );
        });

        const totals = dayMeals.reduce((acc, meal) => ({
          calories: acc.calories + (meal.totals?.calories || 0),
          protein: acc.protein + (meal.totals?.protein || 0),
          carbs: acc.carbs + (meal.totals?.carbs || 0),
          fat: acc.fat + (meal.totals?.fat || 0)
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        return {
          date,
          ...totals,
          mealCount: dayMeals.length
        };
      });

      setWeeklyData(dailyTotals);

      // Generate insights
      generateInsights(dailyTotals);

    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = (dailyTotals) => {
    const newInsights = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Find best and worst days
    const daysWithCalories = dailyTotals.filter(d => d.calories > 0);
    if (daysWithCalories.length > 0) {
      const bestDay = daysWithCalories.reduce((min, day) =>
        day.calories < min.calories ? day : min
      );
      const worstDay = daysWithCalories.reduce((max, day) =>
        day.calories > max.calories ? day : max
      );

      const target = userProfile?.dailyCalorieTarget || 2000;

      newInsights.push({
        icon: '🏆',
        title: 'Best Day',
        description: `${dayNames[bestDay.date.getDay()]} - ${Math.round(bestDay.calories)} cal${
          bestDay.calories <= target ? ' (under target!)' : ''
        }`,
        color: '#10B981'
      });

      if (worstDay.calories > target) {
        newInsights.push({
          icon: '⚠️',
          title: 'Watch Out',
          description: `You tend to overeat on ${dayNames[worstDay.date.getDay()]}s - ${Math.round(worstDay.calories)} cal`,
          color: '#F59E0B'
        });
      }
    }

    // Average protein intake
    const avgProtein = daysWithCalories.reduce((sum, day) => sum + day.protein, 0) / daysWithCalories.length || 0;
    const proteinTarget = userProfile?.proteinTarget || 150;

    if (avgProtein < proteinTarget * 0.8) {
      newInsights.push({
        icon: '💪',
        title: 'Protein Opportunity',
        description: `Your average protein intake is ${Math.round(avgProtein)}g. Target: ${proteinTarget}g`,
        color: '#EF4444'
      });
    } else if (avgProtein >= proteinTarget) {
      newInsights.push({
        icon: '💪',
        title: 'Protein Champion',
        description: `Crushing your protein goals! Average: ${Math.round(avgProtein)}g`,
        color: '#10B981'
      });
    }

    // Consistency insight
    const daysLogged = daysWithCalories.length;
    if (daysLogged === 7) {
      newInsights.push({
        icon: '🔥',
        title: 'Perfect Week',
        description: 'You logged meals every day this week!',
        color: '#EF4444'
      });
    } else if (daysLogged >= 5) {
      newInsights.push({
        icon: '✅',
        title: 'Great Consistency',
        description: `${daysLogged}/7 days logged this week`,
        color: '#10B981'
      });
    } else if (daysLogged < 3) {
      newInsights.push({
        icon: '📝',
        title: 'Log More Often',
        description: 'Try to log meals at least 5 days a week for better insights',
        color: '#94A3B8'
      });
    }

    setInsights(newInsights);
  };

  const getWeeklyChartData = () => {
    if (!weeklyData) return null;

    const labels = weeklyData.map(d => {
      const day = d.date.toLocaleDateString('en-US', { weekday: 'short' });
      return day.substring(0, 3);
    });

    const data = weeklyData.map(d => d.calories);

    return {
      labels,
      datasets: [{
        data: data.length > 0 ? data : [0],
        color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
        strokeWidth: 3
      }]
    };
  };

  const getMacroChartData = () => {
    if (!weeklyData) return [];

    const totals = weeklyData.reduce((acc, day) => ({
      protein: acc.protein + day.protein,
      carbs: acc.carbs + day.carbs,
      fat: acc.fat + day.fat
    }), { protein: 0, carbs: 0, fat: 0 });

    // Convert to calories (protein=4, carbs=4, fat=9)
    const proteinCal = totals.protein * 4;
    const carbsCal = totals.carbs * 4;
    const fatCal = totals.fat * 9;
    const total = proteinCal + carbsCal + fatCal;

    if (total === 0) return [];

    return [
      {
        name: 'Protein',
        population: proteinCal,
        color: '#EF4444',
        legendFontColor: colorScheme === 'dark' ? '#F1F5F9' : '#1E293B',
        legendFontSize: 13
      },
      {
        name: 'Carbs',
        population: carbsCal,
        color: '#10B981',
        legendFontColor: colorScheme === 'dark' ? '#F1F5F9' : '#1E293B',
        legendFontSize: 13
      },
      {
        name: 'Fat',
        population: fatCal,
        color: '#F59E0B',
        legendFontColor: colorScheme === 'dark' ? '#F1F5F9' : '#1E293B',
        legendFontSize: 13
      }
    ];
  };

  const chartConfig = {
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
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
    }
  };

  const weeklyChartData = getWeeklyChartData();
  const macroChartData = getMacroChartData();

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
          Insights
        </Text>
        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Your nutrition trends this week
        </Text>
      </View>

      {/* Weekly Calorie Chart */}
      {weeklyChartData && (
        <Card style={[styles.chartCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Card.Content>
            <Text variant="titleLarge" style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
              Weekly Calories
            </Text>
            <Text variant="bodySmall" style={[styles.chartSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Last 7 days
            </Text>
            <LineChart
              data={weeklyChartData}
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
                absolute={false}
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
      {!weeklyData || weeklyData.every(d => d.calories === 0) ? (
        <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.emptyContent}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text variant="titleLarge" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
              No data yet
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              Log meals for a week to see your trends and insights!
            </Text>
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
  }
});
