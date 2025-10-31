import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, Chip, ActivityIndicator, Card } from 'react-native-paper';
import { parseMealDescription } from '../../services/geminiService';
import { mealService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export default function LogMealScreen({ navigation }) {
  const { user } = useAuth();
  const [selectedMealType, setSelectedMealType] = useState('Lunch');
  const [mealDescription, setMealDescription] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleParse = async () => {
    if (!mealDescription.trim()) {
      Alert.alert('Error', 'Please describe what you ate');
      return;
    }

    setLoading(true);
    try {
      const result = await parseMealDescription(mealDescription);
      setParsedData(result);
    } catch (error) {
      Alert.alert('Error', 'Failed to parse meal. Please try rephrasing.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!parsedData) return;

    try {
      await mealService.logMeal(user.uid, {
        mealType: selectedMealType,
        description: mealDescription,
        items: parsedData.items,
        totals: parsedData.totals,
        date: new Date()
      });

      Alert.alert('Success', 'Meal logged successfully!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save meal');
      console.error(error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Log a Meal
      </Text>

      {/* Meal Type Selector */}
      <View style={styles.chipContainer}>
        {MEAL_TYPES.map((type) => (
          <Chip
            key={type}
            selected={selectedMealType === type}
            onPress={() => setSelectedMealType(type)}
            style={styles.chip}
          >
            {type}
          </Chip>
        ))}
      </View>

      {/* Meal Description */}
      <TextInput
        label="What did you eat?"
        value={mealDescription}
        onChangeText={setMealDescription}
        mode="outlined"
        multiline
        numberOfLines={4}
        placeholder="e.g., 2 scrambled eggs, whole wheat toast with butter, medium banana"
        style={styles.input}
      />

      <Button
        mode="contained"
        onPress={handleParse}
        loading={loading}
        disabled={loading}
        style={styles.button}
      >
        Parse with AI
      </Button>

      {/* Parsed Results */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>AI is analyzing your meal...</Text>
        </View>
      )}

      {parsedData && (
        <Card style={styles.resultsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.resultsTitle}>
              Nutrition Breakdown
            </Text>

            {parsedData.items.map((item, index) => (
              <View key={index} style={styles.foodItem}>
                <Text variant="bodyLarge" style={styles.foodName}>
                  {item.quantity} {item.food}
                </Text>
                <Text variant="bodySmall" style={styles.foodStats}>
                  {item.calories} cal | P: {item.protein}g | C: {item.carbs}g | F: {item.fat}g
                </Text>
              </View>
            ))}

            <View style={styles.totals}>
              <Text variant="titleMedium">Total</Text>
              <Text variant="bodyLarge" style={styles.totalCalories}>
                {parsedData.totals.calories} calories
              </Text>
              <Text variant="bodyMedium">
                Protein: {parsedData.totals.protein}g | Carbs: {parsedData.totals.carbs}g | Fat: {parsedData.totals.fat}g
              </Text>
            </View>

            <Button mode="contained" onPress={handleSave} style={styles.saveButton}>
              Save Meal
            </Button>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  title: {
    marginBottom: 16,
    fontWeight: 'bold'
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16
  },
  chip: {
    marginRight: 8,
    marginBottom: 8
  },
  input: {
    marginBottom: 16
  },
  button: {
    marginBottom: 24
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32
  },
  loadingText: {
    marginTop: 16,
    color: '#666'
  },
  resultsCard: {
    marginBottom: 24
  },
  resultsTitle: {
    marginBottom: 16
  },
  foodItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  foodName: {
    fontWeight: 'bold',
    marginBottom: 4
  },
  foodStats: {
    color: '#666'
  },
  totals: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8
  },
  totalCalories: {
    fontWeight: 'bold',
    color: '#2196F3',
    marginVertical: 4
  },
  saveButton: {
    marginTop: 16
  }
});
