import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, Surface, Switch } from 'react-native-paper';
import { useOnboarding } from '../../context/OnboardingContext';

const WEEKEND_OPTIONS = [
  {
    id: 'FRI_SAT_SUN',
    title: 'Fri + Sat + Sun',
    emoji: '🎉',
    description: 'Full weekend flexibility',
    days: ['friday', 'saturday', 'sunday'],
  },
  {
    id: 'SAT_SUN',
    title: 'Sat + Sun',
    emoji: '🌅',
    description: 'Classic weekend',
    days: ['saturday', 'sunday'],
  },
  {
    id: 'FRI_SAT',
    title: 'Fri + Sat',
    emoji: '🍻',
    description: 'Party nights',
    days: ['friday', 'saturday'],
  },
];

export default function WeekendFlexibilityScreen({ navigation }) {
  const { onboardingData, updateOnboardingData } = useOnboarding();
  const [enableFlexibility, setEnableFlexibility] = useState(onboardingData.enableWeekendFlexibility || false);
  const [selectedOption, setSelectedOption] = useState(onboardingData.weekendOption || 'SAT_SUN');
  const [bonusCalories, setBonusCalories] = useState(onboardingData.weekendBonusCalories || 300);

  const handleToggle = (value) => {
    setEnableFlexibility(value);
    updateOnboardingData({
      enableWeekendFlexibility: value,
      weekendOption: value ? selectedOption : null,
      weekendBonusCalories: value ? bonusCalories : 0,
    });
  };

  const handleSelectOption = (optionId) => {
    setSelectedOption(optionId);
    updateOnboardingData({
      weekendOption: optionId,
    });
  };

  const handleContinue = () => {
    navigation.navigate('PlanReview');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>📅</Text>
          <Text style={styles.title}>Weekend flexibility?</Text>
          <Text style={styles.subtitle}>
            Enjoy extra calories on weekends while staying on track
          </Text>
        </View>

        {/* Toggle */}
        <Surface style={styles.toggleCard} elevation={2}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Enable weekend flexibility</Text>
              <Text style={styles.toggleDescription}>
                Add {bonusCalories} extra calories on selected days
              </Text>
            </View>
            <Switch value={enableFlexibility} onValueChange={handleToggle} />
          </View>
        </Surface>

        {enableFlexibility && (
          <>
            {/* Weekend Options */}
            <View style={styles.optionsContainer}>
              <Text style={styles.sectionTitle}>Choose your weekend days</Text>
              {WEEKEND_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => handleSelectOption(option.id)}
                  activeOpacity={0.7}
                >
                  <Surface
                    style={[
                      styles.optionCard,
                      selectedOption === option.id && styles.optionCardSelected,
                    ]}
                    elevation={selectedOption === option.id ? 3 : 1}
                  >
                    <View style={styles.optionContent}>
                      <Text style={styles.optionEmoji}>{option.emoji}</Text>
                      <View style={styles.optionTextContainer}>
                        <Text style={styles.optionTitle}>{option.title}</Text>
                        <Text style={styles.optionDescription}>{option.description}</Text>
                      </View>
                    </View>
                    {selectedOption === option.id && (
                      <View style={styles.selectedIndicator}>
                        <Text style={styles.selectedText}>✓</Text>
                      </View>
                    )}
                  </Surface>
                </TouchableOpacity>
              ))}
            </View>

            {/* Bonus Calories Selector */}
            <View style={styles.bonusSection}>
              <Text style={styles.sectionTitle}>Extra calories per day</Text>
              <View style={styles.bonusOptions}>
                {[200, 300, 400, 500].map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    onPress={() => {
                      setBonusCalories(amount);
                      updateOnboardingData({ weekendBonusCalories: amount });
                    }}
                    style={[
                      styles.bonusButton,
                      bonusCalories === amount && styles.bonusButtonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bonusText,
                        bonusCalories === amount && styles.bonusTextSelected,
                      ]}
                    >
                      +{amount}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 Weekday calories will be slightly reduced to keep your weekly average on target
              </Text>
            </View>
          </>
        )}
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
    alignItems: 'center',
    marginBottom: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  toggleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 14,
    color: '#64748B',
  },
  optionsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#64748B',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  bonusSection: {
    marginBottom: 24,
  },
  bonusOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  bonusButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bonusButtonSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  bonusText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
  },
  bonusTextSelected: {
    color: '#6366F1',
  },
  infoBox: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  infoText: {
    fontSize: 14,
    color: '#92400E',
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
