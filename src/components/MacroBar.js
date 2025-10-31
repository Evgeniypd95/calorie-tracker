import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ProgressBar } from 'react-native-paper';

export default function MacroBar({ label, consumed, target, unit, color }) {
  const percentage = Math.min((consumed / target), 1);
  const remaining = Math.max(target - consumed, 0);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text variant="bodyMedium">{label}</Text>
        <Text variant="bodySmall" style={styles.stats}>
          {consumed}/{target}{unit} ({remaining}{unit} left)
        </Text>
      </View>
      <ProgressBar
        progress={percentage}
        color={color}
        style={styles.progressBar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  stats: {
    color: '#666'
  },
  progressBar: {
    height: 8,
    borderRadius: 4
  }
});
