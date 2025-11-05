import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import { useOnboarding } from '../../context/OnboardingContext';

const BODY_TYPES = [
  {
    id: 'ECTOMORPH',
    title: 'Ectomorph',
    emoji: '🏃',
    description: 'Naturally thin, fast metabolism',
    traits: [
      'Hard to gain weight',
      'Lean build',
      'Fast metabolism',
      'Narrow shoulders/hips'
    ],
    color: '#3B82F6'
  },
  {
    id: 'MESOMORPH',
    title: 'Mesomorph',
    emoji: '💪',
    description: 'Athletic, muscular build',
    traits: [
      'Gains muscle easily',
      'Moderate metabolism',
      'Athletic frame',
      'Broad shoulders'
    ],
    color: '#10B981'
  },
  {
    id: 'ENDOMORPH',
    title: 'Endomorph',
    emoji: '🧸',
    description: 'Larger frame, gains weight easily',
    traits: [
      'Gains weight easily',
      'Slower metabolism',
      'Rounder physique',
      'Stores fat easily'
    ],
    color: '#F59E0B'
  }
];

export default function BodyTypeScreen({ navigation }) {
  const { updateOnboardingData } = useOnboarding();
  const [selectedType, setSelectedType] = useState(null);

  const handleSelectType = (typeId) => {
    setSelectedType(typeId);
    updateOnboardingData({ bodyType: typeId });
  };

  const handleContinue = () => {
    if (selectedType) {
      navigation.navigate('InteractiveDemo');
    }
  };

  const handleSkip = () => {
    // Default to mesomorph (average)
    updateOnboardingData({ bodyType: 'MESOMORPH' });
    navigation.navigate('InteractiveDemo');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>What's your body type?</Text>
          <Text style={styles.subtitle}>
            This helps us calculate your metabolism more accurately
          </Text>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Not sure? Choose the one that sounds most like you. You can change this later.
          </Text>
        </View>

        {/* Body Type Cards */}
        <View style={styles.typesContainer}>
          {BODY_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              onPress={() => handleSelectType(type.id)}
              activeOpacity={0.7}
            >
              <Surface
                style={[
                  styles.typeCard,
                  selectedType === type.id && {
                    borderColor: type.color,
                    backgroundColor: `${type.color}10`
                  }
                ]}
                elevation={selectedType === type.id ? 4 : 1}
              >
                {selectedType === type.id && (
                  <View style={[styles.checkmark, { backgroundColor: type.color }]}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}

                {/* Header */}
                <View style={styles.typeHeader}>
                  <Text style={styles.typeEmoji}>{type.emoji}</Text>
                  <View style={styles.typeTitleContainer}>
                    <Text style={styles.typeTitle}>{type.title}</Text>
                    <Text style={styles.typeDescription}>{type.description}</Text>
                  </View>
                </View>

                {/* Traits */}
                <View style={styles.traitsContainer}>
                  {type.traits.map((trait, index) => (
                    <View key={index} style={styles.traitRow}>
                      <Text style={styles.traitBullet}>•</Text>
                      <Text style={styles.traitText}>{trait}</Text>
                    </View>
                  ))}
                </View>
              </Surface>
            </TouchableOpacity>
          ))}
        </View>

        {/* Educational Note */}
        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>Why does this matter?</Text>
          <Text style={styles.noteText}>
            Different body types have different metabolic rates. Ectomorphs typically burn 5-10% more calories, while endomorphs burn 5-10% less than average. This helps us give you a more personalized calorie target.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          mode="text"
          onPress={handleSkip}
          style={styles.skipButton}
          labelStyle={styles.skipLabel}
        >
          Not sure, skip
        </Button>
        <Button
          mode="contained"
          onPress={handleContinue}
          disabled={!selectedType}
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
    paddingBottom: 140,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 22,
  },
  infoBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  typesContainer: {
    gap: 16,
    marginBottom: 24,
  },
  typeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 3,
    borderColor: 'transparent',
    position: 'relative',
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
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeEmoji: {
    fontSize: 40,
    marginRight: 16,
  },
  typeTitleContainer: {
    flex: 1,
  },
  typeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  typeDescription: {
    fontSize: 14,
    color: '#64748B',
  },
  traitsContainer: {
    gap: 8,
  },
  traitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  traitBullet: {
    fontSize: 16,
    color: '#94A3B8',
    marginRight: 8,
    marginTop: 2,
  },
  traitText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  noteBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
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
  skipButton: {
    marginBottom: 8,
  },
  skipLabel: {
    fontSize: 16,
    color: '#94A3B8',
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
