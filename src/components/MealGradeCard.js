import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getGradeEmoji } from '../services/mealScoringService';

export default function MealGradeCard({ gradeData }) {
  if (!gradeData) return null;

  const { grade, summary, feedback, positives, color, macroBreakdown } = gradeData;

  return (
    <Surface style={[styles.container, { borderLeftColor: color }]} elevation={2}>
      {/* Header with Grade */}
      <View style={styles.header}>
        <View style={[styles.gradeBadge, { backgroundColor: `${color}20` }]}>
          <Text style={[styles.gradeText, { color }]}>{grade}</Text>
          <Text style={styles.gradeEmoji}>{getGradeEmoji(grade)}</Text>
        </View>
      </View>

      {/* Summary */}
      <Text style={styles.summary}>{summary}</Text>

      {/* Macro Breakdown */}
      {macroBreakdown && (
        <View style={styles.macrosContainer}>
          <View style={styles.macroBar}>
            <View style={[styles.macroSegment, {
              backgroundColor: '#8B5CF6',
              width: `${macroBreakdown.protein}%`
            }]} />
            <View style={[styles.macroSegment, {
              backgroundColor: '#F59E0B',
              width: `${macroBreakdown.carbs}%`
            }]} />
            <View style={[styles.macroSegment, {
              backgroundColor: '#EC4899',
              width: `${macroBreakdown.fat}%`
            }]} />
          </View>
          <View style={styles.macroLabels}>
            <Text style={[styles.macroLabel, { color: '#8B5CF6' }]}>
              {macroBreakdown.protein}% Protein
            </Text>
            <Text style={[styles.macroLabel, { color: '#F59E0B' }]}>
              {macroBreakdown.carbs}% Carbs
            </Text>
            <Text style={[styles.macroLabel, { color: '#EC4899' }]}>
              {macroBreakdown.fat}% Fat
            </Text>
          </View>
        </View>
      )}

      {/* Positives */}
      {positives && positives.length > 0 && (
        <View style={styles.feedbackSection}>
          <Text style={styles.sectionTitle}>What's good:</Text>
          {positives.map((positive, index) => (
            <View key={index} style={styles.feedbackItem}>
              <Text style={styles.positiveText}>{positive}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Feedback */}
      {feedback && feedback.length > 0 && (
        <View style={styles.feedbackSection}>
          <Text style={styles.sectionTitle}>How to improve:</Text>
          {feedback.map((item, index) => (
            <View key={index} style={styles.feedbackItem}>
              <Text style={styles.feedbackText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* CTA hint */}
      {feedback && feedback.length > 0 && (
        <View style={styles.ctaHint}>
          <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color="#6366F1" />
          <Text style={styles.ctaText}>
            Try these tips in your next meal for a better grade!
          </Text>
        </View>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginVertical: 16,
    borderLeftWidth: 4,
  },
  header: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  gradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  gradeText: {
    fontSize: 32,
    fontWeight: '800',
  },
  gradeEmoji: {
    fontSize: 28,
  },
  summary: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 20,
    lineHeight: 26,
  },
  macrosContainer: {
    marginBottom: 20,
  },
  macroBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#F1F5F9',
  },
  macroSegment: {
    height: '100%',
  },
  macroLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  feedbackSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  feedbackItem: {
    marginBottom: 8,
  },
  positiveText: {
    fontSize: 15,
    color: '#10B981',
    lineHeight: 22,
  },
  feedbackText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  ctaHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  ctaText: {
    flex: 1,
    fontSize: 13,
    color: '#6366F1',
    fontStyle: 'italic',
  },
});
