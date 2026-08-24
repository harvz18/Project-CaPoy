/**
 * MULTIVENT Design Tokens
 * Color palette, typography, spacing, and radius values
 */

export const colors = {
  // Foundation
  background: '#FFFFFF',
  backgroundSecondary: '#F8F8F8',
  surface: '#FAFAFA',
  surfaceElevated: '#FFFFFF',

  // Primary (Burgundy)
  primary: '#8B3A3A', // Burgundy
  primaryDark: '#6B2D2D',
  primaryLight: '#A85555',

  // Accents
  accent: '#D4A574', // Soft gold
  accentLight: '#E8BF94',

  // Semantic
  success: '#4CAF50',
  warning: '#FFC107',
  error: '#F44336',
  info: '#2196F3',

  // Text
  textPrimary: '#212121',
  textSecondary: '#757575',
  textMuted: '#BDBDBD',
  textInverse: '#FFFFFF',

  // Borders & Dividers
  border: '#E0E0E0',
  divider: '#F0F0F0',

  // Neutral greys
  grey50: '#FAFAFA',
  grey100: '#F5F5F5',
  grey200: '#EEEEEE',
  grey300: '#E0E0E0',
  grey400: '#BDBDBD',
  grey500: '#9E9E9E',
  grey600: '#757575',
  grey700: '#616161',
} as const

export const typography = {
  display: {
    fontSize: 32,
    fontWeight: 600,
    lineHeight: 1.2,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 600,
    lineHeight: 1.3,
  },
  section: {
    fontSize: 20,
    fontWeight: 600,
    lineHeight: 1.3,
  },
  subheading: {
    fontSize: 18,
    fontWeight: 500,
    lineHeight: 1.4,
  },
  body: {
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.5,
  },
  secondary: {
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.5,
  },
  caption: {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.4,
  },
  button: {
    fontSize: 16,
    fontWeight: 500,
    lineHeight: 1.5,
  },
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const

export const radius = {
  small: 8,
  medium: 12,
  large: 16,
  xl: 20,
  '2xl': 24,
  pill: 999,
} as const

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
} as const

export const breakpoints = {
  xs: 320,
  sm: 375,
  md: 430,
  lg: 768,
  xl: 1024,
} as const
