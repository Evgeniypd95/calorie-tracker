import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function CheckInModal({ visible, checkInData, onComplete, onSkip }) {
  const [selectedOption, setSelectedOption] = useState(null);

  if (!checkInData) return null;

  const { title, subtitle, question, options } = checkInData;

  const handleSubmit = () => {
    if (selectedOption && onComplete) {
      onComplete(selectedOption);
      setSelectedOption(null);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
      setSelectedOption(null);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            {/* Question */}
            <Text style={styles.question}>{question}</Text>

            {/* Options */}
            <View style={styles.optionsContainer}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setSelectedOption(option.value)}
                  activeOpacity={0.7}
                >
                  <Surface
                    style={[
                      styles.optionCard,
                      selectedOption === option.value && styles.optionCardSelected
                    ]}
                    elevation={selectedOption === option.value ? 4 : 1}
                  >
                    {selectedOption === option.value && (
                      <View style={styles.checkmark}>
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={24}
                          color="#6366F1"
                        />
                      </View>
                    )}

                    <Text style={styles.optionEmoji}>{option.emoji}</Text>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </Surface>
                </TouchableOpacity>
              ))}
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
              Skip for now
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!selectedOption}
              style={styles.submitButton}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              Submit
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#F1F5F9',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 0,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
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
  question: {
    fontSize: 18,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 24,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    position: 'relative',
  },
  optionCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  checkmark: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  optionEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    color: '#64748B',
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
  skipButton: {
    marginBottom: 8,
  },
  skipLabel: {
    fontSize: 16,
    color: '#94A3B8',
  },
  submitButton: {
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
