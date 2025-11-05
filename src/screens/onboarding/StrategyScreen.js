import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import { useOnboarding } from '../../context/OnboardingContext';

const STRATEGIES = [
  {
    id: 'COMFORTABLE',
    emoji: '🌱',
    title: 'Comfortable',
    subtitle: 'Slow and steady',
    description: 'Gentle pace, easier to stick with',
    deficit: 0.90, // 10% deficit/surplus
    color: '#10B981',
    timeframe: '6-8 months',
  },
  {
    id: 'CHALLENGING',
    emoji: '🎯',
    title: 'Challenging',
    subtitle: 'Balanced approach',
    description: 'Moderate pace, sustainable long-term',
    deficit: 0.85, // 15% deficit/surplus
    color: '#6366F1',
    timeframe: '4-6 months',
  },
  {
    id: 'AGGRESSIVE',
    emoji: '🔥',
    title: 'Aggressive',
    subtitle: 'Fast results',
    description: 'Rapid progress, requires discipline',
    deficit: 0.80, // 20% deficit/surplus
    color: '#EF4444',
    timeframe: '2-4 months',
  },
];

export default function StrategyScreen({ navigation }) {
  const { onboardingData, updateOnboardingData } = useOnboarding();
  const [selectedStrategy, setSelectedStrategy] = useState(onboardingData.strategy || 'CHALLENGING');

  const handleSelectStrategy = (strategyId) => {
    setSelectedStrategy(strategyId);
    const strategy = STRATEGIES.find(s => s.id === strategyId);
    updateOnboardingData({
      strategy: strategyId,
      strategyMultiplier: strategy.deficit
    });
  };

  const handleContinue = () => {
    navigation.navigate('WeekendFlexibility');
  };

  const getGoalContext = () => {
    if (onboardingData.goal === 'LOSE_WEIGHT') {
      return {
        verb: 'lose',
        amount: Math.abs(onboardingData.weight - (onboardingData.desiredWeight || onboardingData.weight)),
        unit: onboardingData.weightUnit
      };
    } else if (onboardingData.goal === 'BUILD_MUSCLE') {
      return {
        verb: 'gain',
        amount: Math.abs((onboardingData.desiredWeight || onboardingData.weight) - onboardingData.weight),
        unit: onboardingData.weightUnit
      };
    }
    return null;
  };

  const goalContext = getGoalContext();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Choose your pace</Text>
          {goalContext && (
            <Text style={styles.subtitle}>
              To {goalContext.verb} ~{Math.round(goalContext.amount)} {goalContext.unit}
            </Text>
          )}
        </View>

        {/* Strategy Cards */}
        <View style={styles.strategiesContainer}>
          {STRATEGIES.map((strategy) => (
            <TouchableOpacity
              key={strategy.id}
              onPress={() => handleSelectStrategy(strategy.id)}
              activeOpacity={0.7}
            >
              <Surface
                style={[
                  styles.strategyCard,
                  selectedStrategy === strategy.id && styles.strategyCardSelected,
                  selectedStrategy === strategy.id && { borderColor: strategy.color },
                ]}
                elevation={selectedStrategy === strategy.id ? 4 : 1}
              >
                {selectedStrategy === strategy.id && (
                  <View style={[styles.checkmark, { backgroundColor: strategy.color }]}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
                <Text style={styles.strategyEmoji}>{strategy.emoji}</Text>
                <Text style={styles.strategyTitle}>{strategy.title}</Text>
                <Text style={styles.strategySubtitle}>{strategy.subtitle}</Text>
                <Text style={styles.strategyDescription}>{strategy.description}</Text>
                {goalContext && (
                  <View style={[styles.timeframeBadge, { backgroundColor: `${strategy.color}15` }]}>
                    <Text style={[styles.timeframeText, { color: strategy.color }]}>
                      ~{strategy.timeframe}
                    </Text>
                  </View>
                )}
              </Surface>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            💡 You can always adjust your pace later based on how you feel
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={handleContinue}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  strategiesContainer: {
    gap: 16,
    marginBottom: 24,
  },
  strategyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    position: 'relative',
  },
  strategyCardSelected: {
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
  strategyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  strategyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  strategySubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 8,
  },
  strategyDescription: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
  },
  timeframeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  timeframeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  noteContainer: {
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  noteText: {
    fontSize: 14,
    color: '#4F46E5',
    textAlign: 'center',
    lineHeight: 20,
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
