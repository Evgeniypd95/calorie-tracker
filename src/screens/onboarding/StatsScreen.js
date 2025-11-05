import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, SegmentedButtons, TextInput as PaperInput } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useOnboarding } from '../../context/OnboardingContext';

const ACTIVITY_LEVELS = [
  { value: 'SEDENTARY', emoji: '🛋️', label: 'Sedentary' },
  { value: 'LIGHT', emoji: '🚶', label: 'Light' },
  { value: 'MODERATE', emoji: '🏃', label: 'Moderate' },
  { value: 'ACTIVE', emoji: '🏋️', label: 'Active' },
  { value: 'VERY_ACTIVE', emoji: '⚡', label: 'Very Active' },
];

export default function StatsScreen({ navigation }) {
  const { onboardingData, updateOnboardingData, calculateTargetCalories } = useOnboarding();
  const [gender, setGender] = useState(onboardingData.gender || 'MALE');
  const [age, setAge] = useState(onboardingData.age || 30);
  const [weight, setWeight] = useState(onboardingData.weight || 70);
  const [height, setHeight] = useState(onboardingData.height || 170);
  const [weightUnit, setWeightUnit] = useState(onboardingData.weightUnit || 'kg');
  const [heightUnit, setHeightUnit] = useState(onboardingData.heightUnit || 'cm');
  const [activityLevel, setActivityLevel] = useState(onboardingData.activityLevel || 'MODERATE');
  const [calculatedTarget, setCalculatedTarget] = useState(null);

  // Convert between units
  const convertWeight = (value, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return value;
    if (fromUnit === 'kg' && toUnit === 'lbs') return Math.round(value * 2.20462);
    if (fromUnit === 'lbs' && toUnit === 'kg') return Math.round(value / 2.20462);
    return value;
  };

  const convertHeight = (value, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return value;
    if (fromUnit === 'cm' && toUnit === 'ft') {
      const totalInches = Math.round(value / 2.54);
      return totalInches; // Store as total inches
    }
    if (fromUnit === 'ft' && toUnit === 'cm') {
      return Math.round(value * 2.54);
    }
    return value;
  };

  const formatHeight = (value) => {
    if (heightUnit === 'cm') {
      return `${value} cm`;
    } else {
      const feet = Math.floor(value / 12);
      const inches = value % 12;
      return `${feet}'${inches}"`;
    }
  };

  // Calculate when data changes
  useEffect(() => {
    updateOnboardingData({
      gender,
      age,
      weight,
      height,
      weightUnit,
      heightUnit,
      activityLevel,
    });

    const target = calculateTargetCalories();
    setCalculatedTarget(target);
  }, [gender, age, weight, height, weightUnit, heightUnit, activityLevel]);

  const handleWeightUnitChange = (newUnit) => {
    const convertedWeight = convertWeight(weight, weightUnit, newUnit);
    setWeight(convertedWeight);
    setWeightUnit(newUnit);
  };

  const handleHeightUnitChange = (newUnit) => {
    const convertedHeight = convertHeight(height, heightUnit, newUnit);
    setHeight(convertedHeight);
    setHeightUnit(newUnit);
  };

  const handleContinue = () => {
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
          <Text style={styles.title}>Let's calculate your target 🎯</Text>
          <Text style={styles.subtitle}>Quick stats for personalized goals</Text>
        </View>

        {/* Gender */}
        <View style={styles.section}>
          <Text style={styles.label}>Gender</Text>
          <SegmentedButtons
            value={gender}
            onValueChange={setGender}
            buttons={[
              { value: 'MALE', label: 'Male' },
              { value: 'FEMALE', label: 'Female' },
              { value: 'OTHER', label: 'Other' },
            ]}
            style={styles.segmentedButtons}
          />
        </View>

        {/* Age Slider */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Age</Text>
            <Text style={styles.value}>{age} years</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={15}
            maximumValue={80}
            step={1}
            value={age}
            onValueChange={setAge}
            minimumTrackTintColor="#6366F1"
            maximumTrackTintColor="#E2E8F0"
            thumbTintColor="#6366F1"
          />
        </View>

        {/* Weight Slider */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Weight</Text>
            <View style={styles.unitToggle}>
              <Text style={styles.value}>
                {weight} {weightUnit}
              </Text>
              <TouchableOpacity
                onPress={() => handleWeightUnitChange(weightUnit === 'kg' ? 'lbs' : 'kg')}
                style={styles.unitButton}
              >
                <Text style={styles.unitButtonText}>
                  {weightUnit === 'kg' ? 'lbs' : 'kg'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={weightUnit === 'kg' ? 40 : 88}
            maximumValue={weightUnit === 'kg' ? 150 : 330}
            step={1}
            value={weight}
            onValueChange={setWeight}
            minimumTrackTintColor="#6366F1"
            maximumTrackTintColor="#E2E8F0"
            thumbTintColor="#6366F1"
          />
        </View>

        {/* Height Slider */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Height</Text>
            <View style={styles.unitToggle}>
              <Text style={styles.value}>{formatHeight(height)}</Text>
              <TouchableOpacity
                onPress={() => handleHeightUnitChange(heightUnit === 'cm' ? 'ft' : 'cm')}
                style={styles.unitButton}
              >
                <Text style={styles.unitButtonText}>
                  {heightUnit === 'cm' ? 'ft' : 'cm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={heightUnit === 'cm' ? 140 : 55}
            maximumValue={heightUnit === 'cm' ? 220 : 86}
            step={1}
            value={height}
            onValueChange={setHeight}
            minimumTrackTintColor="#6366F1"
            maximumTrackTintColor="#E2E8F0"
            thumbTintColor="#6366F1"
          />
        </View>

        {/* Activity Level */}
        <View style={styles.section}>
          <Text style={styles.label}>Activity Level</Text>
          <View style={styles.activityContainer}>
            {ACTIVITY_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.value}
                onPress={() => setActivityLevel(level.value)}
                style={[
                  styles.activityButton,
                  activityLevel === level.value && styles.activityButtonSelected,
                ]}
              >
                <Text style={styles.activityEmoji}>{level.emoji}</Text>
                <Text
                  style={[
                    styles.activityLabel,
                    activityLevel === level.value && styles.activityLabelSelected,
                  ]}
                >
                  {level.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Calculated Target */}
        {calculatedTarget && (
          <View style={styles.targetContainer}>
            <Text style={styles.targetLabel}>Your daily target:</Text>
            <Text style={styles.targetValue}>{calculatedTarget} calories</Text>
            <Text style={styles.targetNote}>(You can adjust this anytime)</Text>
          </View>
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
    marginBottom: 32,
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
  },
  section: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366F1',
  },
  unitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitButton: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  segmentedButtons: {
    backgroundColor: '#FFFFFF',
  },
  activityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  activityButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    minWidth: '30%',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activityButtonSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  activityEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  activityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  activityLabelSelected: {
    color: '#6366F1',
  },
  targetContainer: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  targetLabel: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 8,
  },
  targetValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#6366F1',
    marginBottom: 8,
  },
  targetNote: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
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
