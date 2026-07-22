import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../theme';

// Circular progress with content in the center.
// progress: 0..1 (values above 1 render a full ring)
export function ProgressRing({
  size = 120,
  strokeWidth = 10,
  progress = 0,
  color = colors.primary,
  trackColor = colors.border,
  children,
}) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          strokeLinecap="round"
        />
      </Svg>
      {children}
    </View>
  );
}

// Gradient monogram avatar. Color pair is stable per name.
const AVATAR_GRADIENTS = [
  ['#10B981', '#059669'],
  ['#F97316', '#F43F5E'],
  ['#0EA5E9', '#2563EB'],
  ['#10B981', '#0EA5E9'],
  ['#F59E0B', '#F97316'],
  ['#14B8A6', '#059669'],
];

export function GradientAvatar({ name = '?', size = 40, style }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const pair = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];

  return (
    <LinearGradient
      colors={pair}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: size * 0.42 }}>{initial}</Text>
    </LinearGradient>
  );
}

// Compact labelled stat used in headers and cards.
export function Stat({ value, label, color = colors.ink }) {
  return (
    <View style={statStyles.wrap}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  wrap: { alignItems: 'center', flex: 1 },
  value: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.faint,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});

export { gradients };
