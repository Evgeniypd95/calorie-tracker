import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';

export default function ProgressRing({ consumed, target, size = 200, strokeWidth = 20 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min((consumed / target) * 100, 100);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const remaining = Math.max(target - consumed, 0);
  const color = consumed > target ? '#f44336' : '#4CAF50';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e0e0e0"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.textContainer}>
        <Text variant="displaySmall" style={styles.consumed}>
          {consumed}
        </Text>
        <Text variant="bodyMedium" style={styles.remaining}>
          {remaining} remaining
        </Text>
        <Text variant="labelSmall" style={styles.target}>
          of {target} cal
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center'
  },
  consumed: {
    fontWeight: 'bold'
  },
  remaining: {
    color: '#666'
  },
  target: {
    color: '#999'
  }
});
