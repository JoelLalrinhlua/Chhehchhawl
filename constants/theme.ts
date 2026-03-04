/**
 * theme.ts — Chhehchhawl Design System tokens.
 *
 * Dark-first theme with hot-pink accents (#F5004F dark / #FF1B6D light).
 * Exports colour palettes, spacing scale, border radii, font families
 * (SpaceGrotesk), font sizes, and shadow presets.
 */

export const Colors = {
  dark: {
    background: '#121212',
    surface: '#1A1A1A',
    card: '#1E1E1E',
    cardElevated: '#252525',
    accent: '#F5004F', // More red-pink, user requested "more red than pinkish"
    accentLight: 'rgba(245, 0, 79, 0.15)',
    text: '#FFFFFF',
    textSecondary: '#AAAAAA',
    textMuted: '#666666',
    border: '#2A2A2A',
    borderFocused: '#FF1B6D',
    inputBackground: '#1E1E1E',
    tabBar: '#0D0D0D',
    tabBarBorder: '#1E1E1E',
    statusGreen: '#4CAF50',
    statusOrange: '#FF9800',
    statusRed: '#F44336',
    overlay: 'rgba(0, 0, 0, 0.6)',
    icon: '#888888',
    iconActive: '#FF1B6D',
    gradient: ['#FF1B6D', '#E91E63'] as const,
    headerGradient: ['#FF1B6D', '#C2185B'] as const,
  },
  light: {
    background: '#F5F5F5',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    cardElevated: '#FAFAFA',
    accent: '#FF1B6D',
    accentLight: 'rgba(255, 27, 109, 0.1)',
    text: '#1A1A1A',
    textSecondary: '#555555',
    textMuted: '#999999',
    border: '#E0E0E0',
    borderFocused: '#FF1B6D',
    inputBackground: '#F0F0F0',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E0E0E0',
    statusGreen: '#4CAF50',
    statusOrange: '#FF9800',
    statusRed: '#F44336',
    overlay: 'rgba(0, 0, 0, 0.4)',
    icon: '#888888',
    iconActive: '#FF1B6D',
    gradient: ['#FF1B6D', '#E91E63'] as const,
    headerGradient: ['#FF1B6D', '#C2185B'] as const,
  },
};

export type ThemeColors = typeof Colors.dark;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const FontFamily = {
  light: 'SpaceGrotesk-Light',
  regular: 'SpaceGrotesk-Regular',
  medium: 'SpaceGrotesk-Medium',
  semiBold: 'SpaceGrotesk-SemiBold',
  bold: 'SpaceGrotesk-Bold',
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
  hg: 48,
} as const;

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
} as const;
