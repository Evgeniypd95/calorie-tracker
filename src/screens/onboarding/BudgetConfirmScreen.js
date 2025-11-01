import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text, Card, ActivityIndicator } from 'react-native-paper';
import { userService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

export default function BudgetConfirmScreen({ route, navigation }) {
  const { user, refreshUserProfile } = useAuth();
  const { userData, dailyBudget } = route.params;
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    console.log('🚀 BudgetConfirmScreen: Starting profile creation');
    console.log('📋 User ID:', user?.uid);
    console.log('📊 User Data:', userData);
    console.log('🎯 Daily Budget:', dailyBudget);

    setLoading(true);
    try {
      console.log('💾 Creating user profile in Firestore...');
      await userService.createUserProfile(user.uid, {
        ...userData,
        dailyBudget
      });
      console.log('✅ Profile created successfully!');

      // Refresh the user profile in auth context to trigger navigation
      console.log('🔄 Refreshing user profile...');
      await refreshUserProfile();
      console.log('✅ Profile refreshed! Should navigate to main app now.');

      setLoading(false);
    } catch (error) {
      console.error('❌ Error creating profile:', error);
      console.error('Error details:', error.message, error.code);
      alert('Failed to save your profile. Please try again.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Setting up your profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Your Daily Budget
      </Text>

      <Text variant="bodyLarge" style={styles.description}>
        Based on your goals, here's your recommended daily nutrition budget:
      </Text>

      <Card style={styles.budgetCard}>
        <Card.Content>
          <View style={styles.budgetRow}>
            <Text variant="displayMedium" style={styles.calorieNumber}>
              {dailyBudget.calories}
            </Text>
            <Text variant="titleMedium" style={styles.calorieLabel}>
              calories/day
            </Text>
          </View>

          <View style={styles.macroContainer}>
            <View style={styles.macroItem}>
              <Text variant="headlineSmall" style={[styles.macroValue, { color: '#4CAF50' }]}>
                {dailyBudget.protein}g
              </Text>
              <Text variant="bodyMedium" style={styles.macroLabel}>Protein</Text>
            </View>

            <View style={styles.macroItem}>
              <Text variant="headlineSmall" style={[styles.macroValue, { color: '#2196F3' }]}>
                {dailyBudget.carbs}g
              </Text>
              <Text variant="bodyMedium" style={styles.macroLabel}>Carbs</Text>
            </View>

            <View style={styles.macroItem}>
              <Text variant="headlineSmall" style={[styles.macroValue, { color: '#FF9800' }]}>
                {dailyBudget.fat}g
              </Text>
              <Text variant="bodyMedium" style={styles.macroLabel}>Fat</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.infoCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.infoTitle}>
            How it works:
          </Text>
          <Text variant="bodyMedium" style={styles.infoText}>
            • Log your meals using simple text descriptions
          </Text>
          <Text variant="bodyMedium" style={styles.infoText}>
            • AI will automatically calculate nutrition
          </Text>
          <Text variant="bodyMedium" style={styles.infoText}>
            • Track your progress daily
          </Text>
          <Text variant="bodyMedium" style={styles.infoText}>
            • Build streaks and stay motivated
          </Text>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        onPress={handleConfirm}
        style={styles.button}
        contentStyle={styles.buttonContent}
      >
        Let's Get Started!
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  loadingText: {
    marginTop: 16,
    color: '#666'
  },
  title: {
    marginBottom: 16,
    fontWeight: 'bold'
  },
  description: {
    marginBottom: 24,
    color: '#666'
  },
  budgetCard: {
    marginBottom: 16,
    backgroundColor: '#f5f5f5'
  },
  budgetRow: {
    alignItems: 'center',
    marginBottom: 24
  },
  calorieNumber: {
    fontWeight: 'bold',
    color: '#2196F3'
  },
  calorieLabel: {
    color: '#666'
  },
  macroContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  macroItem: {
    alignItems: 'center'
  },
  macroValue: {
    fontWeight: 'bold'
  },
  macroLabel: {
    color: '#666',
    marginTop: 4
  },
  infoCard: {
    marginBottom: 24
  },
  infoTitle: {
    marginBottom: 12,
    fontWeight: 'bold'
  },
  infoText: {
    marginBottom: 8,
    color: '#666'
  },
  button: {
    marginBottom: 40
  },
  buttonContent: {
    paddingVertical: 8
  }
});
