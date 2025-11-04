import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform } from 'react-native';
import { TextInput, Button, Text, Chip, ActivityIndicator, Card, Searchbar, Divider } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { parseMealDescription } from '../../services/geminiService';
import { mealService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export default function LogMealScreen({ navigation, route }) {
  const { user } = useAuth();
  const { selectedDate } = route.params || {};
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [mealDescription, setMealDescription] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recentMeals, setRecentMeals] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Load recent meals on mount
  useEffect(() => {
    loadRecentMeals();
  }, []);

  const loadRecentMeals = async () => {
    try {
      const meals = await mealService.getRecentMeals(user.uid, 5);
      setRecentMeals(meals);
    } catch (error) {
      console.error('Error loading recent meals:', error);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      try {
        const results = await mealService.searchMealsByDescription(user.uid, query);
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching meals:', error);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectMeal = (meal) => {
    setMealDescription(meal.description);
    setParsedData({
      items: meal.items,
      totals: meal.totals
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleParse = async () => {
    if (!mealDescription.trim()) {
      showAlert('Error', 'Please describe what you ate');
      return;
    }

    setLoading(true);
    try {
      const result = await parseMealDescription(mealDescription);
      setParsedData(result);
    } catch (error) {
      showAlert('Error', 'Failed to parse meal. Please try rephrasing.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!parsedData) return;

    if (!selectedMealType) {
      showAlert('Error', 'Please select a meal type');
      return;
    }

    try {
      // Use the selected date from the dashboard, or default to now
      const mealDate = selectedDate ? new Date(selectedDate) : new Date();

      // Preserve the current time but set the date to the selected day
      if (selectedDate) {
        const now = new Date();
        mealDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      }

      await mealService.logMeal(user.uid, {
        mealType: selectedMealType,
        description: mealDescription,
        items: parsedData.items,
        totals: parsedData.totals,
        date: mealDate
      });

      showAlert('Success', 'Meal logged successfully!');
      navigation.goBack();
    } catch (error) {
      showAlert('Error', 'Failed to save meal');
      console.error(error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Log a Meal
      </Text>

      {/* Search Bar */}
      <Searchbar
        placeholder="Search previous meals..."
        onChangeText={handleSearch}
        value={searchQuery}
        style={styles.searchBar}
      />

      {/* Search Results or Recent Meals */}
      {searchQuery.trim() ? (
        searchResults.length > 0 ? (
          <View style={styles.mealsSection}>
            <Text variant="labelLarge" style={styles.sectionLabel}>Search Results</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealsScroll}>
              {searchResults.map((meal) => (
                <TouchableOpacity
                  key={meal.id}
                  onPress={() => handleSelectMeal(meal)}
                  style={styles.mealChip}
                >
                  <Card style={styles.mealCard}>
                    <Card.Content style={styles.mealCardContent}>
                      <Text variant="titleSmall" style={styles.mealTitle} numberOfLines={2}>
                        {meal.description}
                      </Text>
                      <Text variant="bodySmall" style={styles.mealCalories}>
                        {meal.totals?.calories} cal
                      </Text>
                    </Card.Content>
                  </Card>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Divider style={styles.divider} />
          </View>
        ) : (
          <View style={styles.noResults}>
            <Text variant="bodySmall" style={styles.noResultsText}>No meals found</Text>
          </View>
        )
      ) : recentMeals.length > 0 ? (
        <View style={styles.mealsSection}>
          <Text variant="labelLarge" style={styles.sectionLabel}>Recent Meals</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealsScroll}>
            {recentMeals.map((meal) => (
              <TouchableOpacity
                key={meal.id}
                onPress={() => handleSelectMeal(meal)}
                style={styles.mealChip}
              >
                <Card style={styles.mealCard}>
                  <Card.Content style={styles.mealCardContent}>
                    <Text variant="titleSmall" style={styles.mealTitle} numberOfLines={2}>
                      {meal.description}
                    </Text>
                    <Text variant="bodySmall" style={styles.mealCalories}>
                      {meal.totals?.calories} cal
                    </Text>
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Divider style={styles.divider} />
        </View>
      ) : null}

      {/* Meal Type Selector */}
      <Text variant="labelLarge" style={styles.mealTypeLabel}>
        Meal Type *
      </Text>
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
      {!selectedMealType && (
        <Text variant="bodySmall" style={styles.requiredText}>
          Please select a meal type
        </Text>
      )}

      {/* Meal Description */}
      <TextInput
        label="Describe your meal or use AI to parse"
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
  searchBar: {
    marginBottom: 16,
    elevation: 2,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  mealsSection: {
    marginBottom: 16
  },
  sectionLabel: {
    marginBottom: 8,
    color: '#666',
    fontWeight: '600'
  },
  mealTypeLabel: {
    marginBottom: 8,
    color: '#333',
    fontWeight: '600'
  },
  requiredText: {
    color: '#ff4444',
    marginTop: -8,
    marginBottom: 16
  },
  mealsScroll: {
    marginBottom: 8
  },
  mealChip: {
    marginRight: 12
  },
  mealCard: {
    width: 160,
    backgroundColor: '#fff'
  },
  mealCardContent: {
    padding: 12
  },
  mealTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333'
  },
  mealCalories: {
    color: '#2196F3',
    fontWeight: '500'
  },
  divider: {
    marginTop: 8,
    marginBottom: 8
  },
  noResults: {
    padding: 16,
    alignItems: 'center'
  },
  noResultsText: {
    color: '#999'
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
