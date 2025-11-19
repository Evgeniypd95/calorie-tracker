import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Platform, Alert } from 'react-native';
import { Text, Card, FAB, Portal, Modal, TextInput, Button, IconButton, Chip, Surface } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { weightService } from '../../services/firebase';
import { Swipeable } from 'react-native-gesture-handler';

export default function WeightTrackingScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const [weights, setWeights] = useState([]);
  const [insights, setInsights] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [periodFilter, setPeriodFilter] = useState(30); // 30, 60, 90 days

  useFocusEffect(
    useCallback(() => {
      loadWeightData();
    }, [periodFilter])
  );

  const loadWeightData = async () => {
    try {
      const history = await weightService.getWeightHistory(user.uid, periodFilter);
      setWeights(history);

      const insightsData = await weightService.getWeightInsights(user.uid, periodFilter);
      setInsights(insightsData);
    } catch (error) {
      console.error('Error loading weight data:', error);
    }
  };

  const handleAddWeight = async () => {
    if (!weightInput || isNaN(parseFloat(weightInput))) {
      showAlert('Invalid Input', 'Please enter a valid weight');
      return;
    }

    setSaving(true);
    try {
      await weightService.logWeight(user.uid, {
        weight: parseFloat(weightInput),
        notes: notesInput,
        date: new Date()
      });

      setWeightInput('');
      setNotesInput('');
      setShowAddModal(false);
      await loadWeightData();
      showAlert('Success', 'Weight logged successfully!');
    } catch (error) {
      console.error('Error logging weight:', error);
      showAlert('Error', 'Failed to log weight');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWeight = (weightId) => {
    const confirmDelete = async () => {
      try {
        await weightService.deleteWeight(weightId);
        await loadWeightData();
      } catch (error) {
        console.error('Error deleting weight:', error);
        showAlert('Error', 'Failed to delete weight entry');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this weight entry?')) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        'Delete Weight Entry',
        'Are you sure you want to delete this weight entry?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: confirmDelete }
        ]
      );
    }
  };

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const renderLeftActions = (weight) => {
    return (
      <View style={styles.swipeActionDelete}>
        <IconButton icon="delete" iconColor="#FFFFFF" size={24} />
        <Text style={styles.swipeActionText}>Delete</Text>
      </View>
    );
  };

  // Prepare chart data
  const getChartData = () => {
    if (weights.length === 0) {
      return null;
    }

    // Limit to max 10 points for readability
    const step = Math.max(1, Math.floor(weights.length / 10));
    const sampledWeights = weights.filter((_, index) => index % step === 0);

    return {
      labels: sampledWeights.map(w => {
        const date = w.date?.toDate?.() || new Date(w.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }),
      datasets: [{
        data: sampledWeights.map(w => w.weight),
        color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
        strokeWidth: 3
      }]
    };
  };

  const chartData = getChartData();
  const screenWidth = Dimensions.get('window').width;

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Period Filter */}
        <View style={styles.filterContainer}>
          <Chip
            selected={periodFilter === 30}
            onPress={() => setPeriodFilter(30)}
            style={styles.filterChip}
            mode={periodFilter === 30 ? 'flat' : 'outlined'}
          >
            30 Days
          </Chip>
          <Chip
            selected={periodFilter === 60}
            onPress={() => setPeriodFilter(60)}
            style={styles.filterChip}
            mode={periodFilter === 60 ? 'flat' : 'outlined'}
          >
            60 Days
          </Chip>
          <Chip
            selected={periodFilter === 90}
            onPress={() => setPeriodFilter(90)}
            style={styles.filterChip}
            mode={periodFilter === 90 ? 'flat' : 'outlined'}
          >
            90 Days
          </Chip>
        </View>

        {/* Insights Card */}
        {insights?.hasData && (
          <Card style={styles.insightsCard}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.cardTitle}>
                📊 Insights ({periodFilter} days)
              </Text>

              <View style={styles.insightsGrid}>
                <View style={styles.insightBox}>
                  <Text style={styles.insightLabel}>Weight Change</Text>
                  <Text style={[
                    styles.insightValue,
                    { color: insights.direction === 'gain' ? '#EF4444' : insights.direction === 'loss' ? '#10B981' : '#64748B' }
                  ]}>
                    {insights.weightChange > 0 ? '+' : ''}{insights.weightChange} kg
                  </Text>
                  <Text style={styles.insightSubtext}>{insights.percentChange}%</Text>
                </View>

                <View style={styles.insightBox}>
                  <Text style={styles.insightLabel}>Avg Calories</Text>
                  <Text style={styles.insightValue}>{insights.avgDailyCalories}</Text>
                  <Text style={styles.insightSubtext}>per day</Text>
                </View>
              </View>

              <Surface style={styles.rangeBox}>
                <Text style={styles.rangeText}>
                  {insights.firstWeight} kg → {insights.lastWeight} kg
                </Text>
                <Text style={styles.rangeSubtext}>
                  {insights.daysWithWeightData} weight logs • {insights.daysWithMealData} days tracked
                </Text>
              </Surface>
            </Card.Content>
          </Card>
        )}

        {/* Chart Card */}
        {chartData && (
          <Card style={styles.chartCard}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.cardTitle}>
                📈 Weight Trend
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <LineChart
                  data={chartData}
                  width={Math.max(screenWidth - 60, chartData.labels.length * 50)}
                  height={220}
                  chartConfig={{
                    backgroundColor: '#FFFFFF',
                    backgroundGradientFrom: '#FFFFFF',
                    backgroundGradientTo: '#FFFFFF',
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                    style: {
                      borderRadius: 16
                    },
                    propsForDots: {
                      r: '6',
                      strokeWidth: '2',
                      stroke: '#6366F1'
                    }
                  }}
                  bezier
                  style={styles.chart}
                />
              </ScrollView>
            </Card.Content>
          </Card>
        )}

        {/* Weight History List */}
        <Card style={styles.historyCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              📝 Weight History
            </Text>

            {weights.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>⚖️</Text>
                <Text variant="titleMedium" style={styles.emptyTitle}>
                  No weight entries yet
                </Text>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  Start tracking your weight to see progress and insights
                </Text>
              </View>
            ) : (
              <View style={styles.weightList}>
                {[...weights].reverse().map((weight) => {
                  const date = weight.date?.toDate?.() || new Date(weight.date);
                  return (
                    <Swipeable
                      key={weight.id}
                      renderLeftActions={() => renderLeftActions(weight)}
                      onSwipeableOpen={() => handleDeleteWeight(weight.id)}
                    >
                      <Surface style={styles.weightItem} elevation={1}>
                        <View style={styles.weightItemLeft}>
                          <Text style={styles.weightValue}>{weight.weight} kg</Text>
                          <Text style={styles.weightDate}>
                            {date.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </Text>
                          {weight.notes && (
                            <Text style={styles.weightNotes}>{weight.notes}</Text>
                          )}
                        </View>
                        <IconButton
                          icon="delete-outline"
                          size={20}
                          iconColor="#94A3B8"
                          onPress={() => handleDeleteWeight(weight.id)}
                        />
                      </Surface>
                    </Swipeable>
                  );
                })}
              </View>
            )}
          </Card.Content>
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Weight FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        label="Log Weight"
      />

      {/* Add Weight Modal */}
      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={() => setShowAddModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Log Your Weight
          </Text>

          <TextInput
            label="Weight (kg)"
            value={weightInput}
            onChangeText={setWeightInput}
            keyboardType="decimal-pad"
            mode="outlined"
            style={styles.input}
            placeholder={userProfile?.currentWeight ? String(userProfile.currentWeight) : '70.0'}
          />

          <TextInput
            label="Notes (optional)"
            value={notesInput}
            onChangeText={setNotesInput}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
            placeholder="e.g., Morning weigh-in, after workout..."
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowAddModal(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleAddWeight}
              loading={saving}
              disabled={saving}
              style={styles.modalButton}
            >
              Save
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9'
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20
  },
  filterChip: {
    minWidth: 90
  },
  insightsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20
  },
  chartCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20
  },
  historyCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20
  },
  cardTitle: {
    marginBottom: 16,
    fontWeight: '700',
    color: '#1E293B'
  },
  insightsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  insightBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center'
  },
  insightLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  insightValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4
  },
  insightSubtext: {
    fontSize: 12,
    color: '#94A3B8'
  },
  rangeBox: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 0
  },
  rangeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 4
  },
  rangeSubtext: {
    fontSize: 12,
    color: '#075985'
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16
  },
  weightList: {
    gap: 12
  },
  weightItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  weightItemLeft: {
    flex: 1
  },
  weightValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4
  },
  weightDate: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4
  },
  weightNotes: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic'
  },
  swipeActionDelete: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginRight: 8
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16
  },
  emptyTitle: {
    fontWeight: '700',
    marginBottom: 8,
    color: '#1E293B'
  },
  emptyText: {
    color: '#64748B',
    textAlign: 'center'
  },
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#6366F1'
  },
  modal: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    margin: 20,
    borderRadius: 24
  },
  modalTitle: {
    fontWeight: '700',
    marginBottom: 20,
    color: '#1E293B',
    textAlign: 'center'
  },
  input: {
    marginBottom: 16
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  },
  modalButton: {
    flex: 1
  }
});
