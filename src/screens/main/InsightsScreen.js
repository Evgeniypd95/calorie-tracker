import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Platform, useColorScheme } from 'react-native';
import { Text, Card, Surface, useTheme } from 'react-native-paper';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { useAuth } from '../../context/AuthContext';
import { generateInsightsBackend } from '../../services/geminiService';

const { width: screenWidth } = Dimensions.get('window');

export default function InsightsScreen() {
  const { user, userProfile } = useAuth();
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const [weeklyChartData, setWeeklyChartData] = useState(null);
  const [macroChartData, setMacroChartData] = useState([]);
  const [insights, setInsights] = useState([]);
  const [hasEnoughData, setHasEnoughData] = useState(true);
  const [daysWithData, setDaysWithData] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && userProfile) {
      loadAnalytics();
    }
  }, [user, userProfile]);

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
          Insights
        </Text>
        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Your nutrition trends this week
        </Text>
      </View>

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
