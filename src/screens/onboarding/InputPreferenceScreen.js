import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useOnboarding } from '../../context/OnboardingContext';

const INPUT_METHODS = [
  {
    id: 'voice',
    icon: 'microphone',
    title: 'Voice',
    description: 'Just speak what you ate',
    color: '#6366F1',
  },
  {
    id: 'photo',
    icon: 'camera',
    title: 'Photo',
    description: 'Snap a pic of your meal',
    color: '#8B5CF6',
  },
  {
    id: 'barcode',
    icon: 'barcode-scan',
    title: 'Barcode',
    description: 'Scan packaged foods',
    color: '#EC4899',
  },
];

export default function InputPreferenceScreen({ navigation }) {
  const { updateOnboardingData } = useOnboarding();
  const [selectedMethod, setSelectedMethod] = useState(null);

  const handleSelectMethod = (methodId) => {
    setSelectedMethod(methodId);
    updateOnboardingData({ preferredInputMethod: methodId });
  };

  const handleContinue = () => {
    navigation.navigate('Social');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Choose your style</Text>
          <Text style={styles.subtitle}>
            Don't worry, you can use all methods anytime
          </Text>
        </View>

        <View style={styles.methodsContainer}>
          {INPUT_METHODS.map((method) => (
            <TouchableOpacity
              key={method.id}
              onPress={() => handleSelectMethod(method.id)}
              activeOpacity={0.7}
            >
              <Surface
                style={[
                  styles.methodCard,
                  selectedMethod === method.id && {
                    borderColor: method.color,
                    backgroundColor: `${method.color}10`,
                  },
                ]}
                elevation={selectedMethod === method.id ? 4 : 2}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: `${method.color}20` },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={method.icon}
                    size={40}
                    color={method.color}
                  />
                </View>
                <Text style={styles.methodTitle}>{method.title}</Text>
                <Text style={styles.methodDescription}>{method.description}</Text>
              </Surface>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

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
  methodsContainer: {
    gap: 16,
  },
  methodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  methodTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  methodDescription: {
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
