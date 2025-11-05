import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Surface, ActivityIndicator } from 'react-native-paper';
import { parseMealDescription } from '../../services/geminiService';

const DEMO_MEAL = "Grilled chicken breast with brown rice and broccoli";

export default function InteractiveDemoScreen({ navigation }) {
  const [showDemo, setShowDemo] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [userInput, setUserInput] = useState('');
  const [userParsedData, setUserParsedData] = useState(null);

  const handleSeeMagic = async () => {
    setShowDemo(true);
    setParsing(true);

    try {
      const result = await parseMealDescription(DEMO_MEAL);
      setParsedData(result);
    } catch (error) {
      console.error('Demo parse error:', error);
    } finally {
      setParsing(false);
    }
  };

  const handleTryYours = () => {
    navigation.navigate('InputPreference');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Try it now! 🌟</Text>
          <Text style={styles.subtitle}>See how easy meal logging can be</Text>
        </View>

        {/* Demo Section */}
        {!showDemo && (
          <View style={styles.demoSection}>
            <Surface style={styles.inputCard} elevation={2}>
              <Text style={styles.inputLabel}>Sample meal:</Text>
              <Text style={styles.inputText}>{DEMO_MEAL}</Text>
            </Surface>

            <Button
              mode="contained"
              onPress={handleSeeMagic}
              style={styles.magicButton}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              icon="sparkles"
            >
              See the magic ✨
            </Button>
          </View>
        )}

        {/* Parsing Animation */}
        {parsing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Analyzing nutrition...</Text>
          </View>
        )}

        {/* Results */}
        {parsedData && !parsing && (
          <View style={styles.resultsSection}>
            <Surface style={styles.resultCard} elevation={3}>
              <Text style={styles.resultTitle}>Nutrition Breakdown</Text>

              {parsedData.items.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={styles.itemText}>
                    • {item.quantity} {item.food}
                  </Text>
                  <Text style={styles.itemCal}>{item.calories} cal</Text>
                </View>
              ))}

              <View style={styles.divider} />

              <View style={styles.totalsContainer}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total Calories:</Text>
                  <Text style={styles.totalValue}>
                    {parsedData.totals.calories} cal
                  </Text>
                </View>
                <View style={styles.macrosRow}>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>
                      {parsedData.totals.protein}g
                    </Text>
                    <Text style={styles.macroLabel}>Protein</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>
                      {parsedData.totals.carbs}g
                    </Text>
                    <Text style={styles.macroLabel}>Carbs</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>
                      {parsedData.totals.fat}g
                    </Text>
                    <Text style={styles.macroLabel}>Fat</Text>
                  </View>
                </View>
              </View>
            </Surface>

            <View style={styles.encouragement}>
              <Text style={styles.encouragementText}>
                🎉 Cool! That was instant.{'\n'}Now you try with YOUR meal →
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={handleTryYours}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          disabled={!parsedData}
        >
          {parsedData ? "Let's go!" : 'Continue'}
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
  demoSection: {
    gap: 20,
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  inputText: {
    fontSize: 18,
    color: '#1E293B',
    lineHeight: 26,
  },
  magicButton: {
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  resultsSection: {
    gap: 20,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemText: {
    fontSize: 16,
    color: '#475569',
    flex: 1,
  },
  itemCal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  totalsContainer: {
    gap: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#6366F1',
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  macroLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  encouragement: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
  },
  encouragementText: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
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
});
