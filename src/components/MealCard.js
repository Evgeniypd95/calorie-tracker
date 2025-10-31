import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';

export default function MealCard({ meal }) {
  const formatTime = (date) => {
    if (!date) return '';
    // Handle Firestore timestamp
    const timestamp = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return timestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.mealType}>
          {meal.mealType} · {formatTime(meal.createdAt)}
        </Text>
        <Text variant="bodyMedium" style={styles.description}>
          {meal.description}
        </Text>
        <Text variant="bodySmall" style={styles.totals}>
          {meal.totals.calories} cal | P: {meal.totals.protein}g | C: {meal.totals.carbs}g | F: {meal.totals.fat}g
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12
  },
  mealType: {
    fontWeight: 'bold',
    marginBottom: 4
  },
  description: {
    marginBottom: 8,
    color: '#666'
  },
  totals: {
    color: '#2196F3'
  }
});
