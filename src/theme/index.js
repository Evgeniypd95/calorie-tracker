import { Platform } from 'react-native';

// Central design tokens for the app.
// Brand: fresh emerald green over cool slate neutrals.
export const colors = {
  // Brand
  primary: '#059669',
  primaryDark: '#047857',
  primaryDeep: '#065F46',
  secondary: '#10B981',
  tint: '#ECFDF5',
  tintBorder: '#A7F3D0',

  // Neutrals
  background: '#F4F4F8',
  surface: '#FFFFFF',
  subtle: '#F8FAFC',
  border: '#E8E9F1',
  borderStrong: '#CBD5E1',

  // Text
  ink: '#0F172A',
  body: '#475569',
  muted: '#64748B',
  faint: '#94A3B8',

  // Semantics
  success: '#10B981',
  successTint: '#ECFDF5',
  warning: '#F59E0B',
  danger: '#EF4444',
  dangerTint: '#FEF2F2',
  flame: '#F97316',

  // Macros
  calories: '#059669',
  protein: '#EF4444',
  carbs: '#3B82F6',
  fat: '#F59E0B',
};

export const gradients = {
  brand: ['#10B981', '#059669'],
  brandDeep: ['#059669', '#047857'],
  sunrise: ['#F97316', '#F43F5E'],
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

// Cross-platform soft shadows. Spread as `...shadows.card` in styles.
export const shadows = {
  card: Platform.select({
    web: { boxShadow: '0px 2px 12px rgba(15, 23, 42, 0.06)' },
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
  }),
  raised: Platform.select({
    web: { boxShadow: '0px 8px 24px rgba(15, 23, 42, 0.10)' },
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 6,
    },
  }),
  glow: Platform.select({
    web: { boxShadow: '0px 6px 20px rgba(5, 150, 105, 0.35)' },
    default: {
      shadowColor: '#059669',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8,
    },
  }),
};

// Typography presets (system font, tight tracking on display sizes)
export const type = {
  display: { fontSize: 34, fontWeight: '800', letterSpacing: -1, color: colors.ink },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, color: colors.ink },
  heading: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, color: colors.ink },
  body: { fontSize: 15, lineHeight: 22, color: colors.body },
  caption: { fontSize: 13, color: colors.muted },
  overline: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.faint,
  },
};

export default { colors, gradients, radius, spacing, shadows, type };
