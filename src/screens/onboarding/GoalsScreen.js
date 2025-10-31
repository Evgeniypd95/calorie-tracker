import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { calculateDailyBudget } from '../../services/nutritionCalculator';

export default function GoalsScreen({ route, navigation }) {
  const { biometrics } = route.params;
  const [targetWeight, setTargetWeight] = useState('');
  const [weeksToGoal, setWeeksToGoal] = useState('');

  const handleCalculate = () => {
    if (!targetWeight || !weeksToGoal) {
      alert('Please fill in all fields');
      return;
    }

    const userData = {
      ...biometrics,
      weight: parseFloat(biometrics.weight),
      height: parseFloat(biometrics.height),
      age: parseInt(biometrics.age),
      targetWeight: parseFloat(targetWeight),
      weeksToGoal: parseInt(weeksToGoal)
    };

    const dailyBudget = calculateDailyBudget(userData);

    navigation.navigate('BudgetConfirm', {
      userData,
      dailyBudget
    });
  };

  const weightDiff = biometrics.weight - targetWeight;
  const poundsPerWeek = weeksToGoal ? (weightDiff / weeksToGoal).toFixed(1) : 0;

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        What's your goal?
      </Text>

      <TextInput
        label="Target Weight (lbs)"
        value={targetWeight}
        onChangeText={setTargetWeight}
        keyboardType="numeric"
        mode="outlined"
        style={styles.input}
      />

      <TextInput
        label="Weeks to Reach Goal"
        value={weeksToGoal}
        onChangeText={setWeeksToGoal}
        keyboardType="numeric"
        mode="outlined"
        style={styles.input}
      />

      {targetWeight && weeksToGoal && (
        <View style={styles.summary}>
          <Text variant="titleMedium">Summary:</Text>
          <Text>Weight to lose: {weightDiff.toFixed(1)} lbs</Text>
          <Text>Target rate: {poundsPerWeek} lbs/week</Text>
          {poundsPerWeek > 2 && (
            <Text style={styles.warning}>
              Losing more than 2 lbs/week may not be sustainable
            </Text>
          )}
        </View>
      )}

      <Button mode="contained" onPress={handleCalculate} style={styles.button}>
        Calculate My Budget
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff'
  },
  title: {
    marginBottom: 24,
    fontWeight: 'bold'
  },
  input: {
    marginBottom: 16
  },
  summary: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16
  },
  warning: {
    color: '#ff9800',
    marginTop: 8
  },
  button: {
    marginTop: 24,
    marginBottom: 40
  }
});
