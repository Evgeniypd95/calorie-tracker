import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import { useOnboarding } from '../../context/OnboardingContext';

const GOALS = [
  {
    id: 'LOSE_WEIGHT',
    emoji: '🎯',
    title: 'Lose Weight',
    description: 'Sustainable deficit, high satiety',
    color: '#EF4444',
  },
  {
    id: 'BUILD_MUSCLE',
    emoji: '💪',
    title: 'Build Muscle',
    description: 'Surplus + high protein focus',
    color: '#8B5CF6',
  },
  {
    id: 'MAINTAIN',
    emoji: '⚖️',
    title: 'Maintain Health',
    description: 'Balanced nutrition, feel great',
    color: '#10B981',
  },
  {
    id: 'EXPLORING',
    emoji: '🤷',
    title: 'Just Exploring',
    description: "I'll set goals later",
    color: '#94A3B8',
  },
];

export default function GoalSelectionScreen({ navigation }) {
  const { updateOnboardingData } = useOnboarding();
  const [selectedGoal, setSelectedGoal] = useState(null);

  const handleSelectGoal = (goalId) => {
    setSelectedGoal(goalId);
    updateOnboardingData({ goal: goalId });
  };

  const handleContinue = () => {
    if (selectedGoal) {
      navigation.navigate('Stats');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.question}>What's your goal?</Text>
          <Text style={styles.subtitle}>We'll personalize your experience</Text>
        </View>

        {/* Goal Cards */}
        <View style={styles.goalsContainer}>
          {GOALS.map((goal) => (
            <TouchableOpacity
              key={goal.id}
              onPress={() => handleSelectGoal(goal.id)}
              activeOpacity={0.7}
            >
              <Surface
                style={[
                  styles.goalCard,
                  selectedGoal === goal.id && styles.goalCardSelected,
                  selectedGoal === goal.id && { borderColor: goal.color },
                ]}
                elevation={selectedGoal === goal.id ? 4 : 1}
              >
                {selectedGoal === goal.id && (
                  <View style={[styles.checkmark, { backgroundColor: goal.color }]}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
                <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                <Text style={styles.goalTitle}>{goal.title}</Text>
                <Text style={styles.goalDescription}>{goal.description}</Text>
              </Surface>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={handleContinue}
          disabled={!selectedGoal}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          Continue
        </Button>
      </View>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 32,
  },
  question: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  goalsContainer: {
    gap: 16,
  },
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    position: 'relative',
  },
  goalCardSelected: {
    borderWidth: 3,
  },
  checkmark: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  goalEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  goalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  goalDescription: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  button: {
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
});
