/**
 * Centralized design tokens for the MapsPlayground UI — colors, gradients,
 * radii, font sizes, spacing, and map interaction defaults. Imported by
 * all UI components and map logic for consistent styling.
 * Exports: colors, gradients, radii, fontSizes, spacing, mapDefaults
 */
export const colors = {
  accent: '#5238e1',
  accentDark: '#3d29b0',
  accentLight: '#7c6af0',
  accentAlpha: 'rgba(82,56,225,0.3)',
  accentHoverAlpha: 'rgba(82,56,225,0.08)',
  accentLightAlpha: 'rgba(82,56,225,0.12)',

  bgPrimary: '#f5f0e8',
  bgSecondary: '#f0ebe2',
  bgTertiary: '#ede8dc',
  bgInput: '#f0ebe2',

  border: '#d5cfc4',
  borderLight: '#c9c0b0',

  textPrimary: '#2d2d2d',
  textSecondary: '#777',
  textMuted: '#888',
  textFaint: '#999',

  success: '#27ae60',
  successLight: '#2ecc71',
  successBg: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)',
  successBorder: '#a5d6a7',
  successText: '#2e7d32',

  warning: '#e67e22',
  warningDark: '#d35400',

  danger: '#e53e3e',
  dangerBg: '#fce4ec',
  dangerBorder: '#ef9a9a',

  infoBg: '#e8eaf6',
  infoBorder: '#90caf9',

  purple: '#9b59b6',
  purpleDark: '#8e44ad',

  blue: '#3498db',
  red: '#ff4757',
  cyan: '#00b4d8',
} as const

export const gradients = {
  primary: 'linear-gradient(135deg, #5238e1, #3d29b0)',
  primaryHover: 'linear-gradient(135deg, #5238e1, #7c6af0)',
  navBg: 'linear-gradient(135deg, #f5f0e8, #f0ebe2)',
  sidebarBg: 'linear-gradient(180deg, #f5f0e8 0%, #ede8dc 100%)',
  purple: 'linear-gradient(135deg, #9b59b6, #8e44ad)',
  green: 'linear-gradient(135deg, #27ae60, #2ecc71)',
  orange: 'linear-gradient(135deg, #e67e22, #d35400)',
  accentBar: 'linear-gradient(90deg, #5238e1, #3d29b0)',
  success: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)',
  danger: 'linear-gradient(135deg, #f3e5f5, #ffcdd2)',
  bg: 'linear-gradient(180deg, #f5f0e8 0%, #ede8dc 50%, #e5dfd4 100%)',
} as const

export const radii = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
} as const

export const fontSizes = {
  xs: 10,
  sm: 11,
  base: 12,
  md: 13,
  lg: 14,
  xl: 15,
  xxl: 16,
  title: 18,
} as const

export const spacing = {
  navHeight: 52,
  sidebarWidth: 380,
  mobileBreakpoint: 767,
} as const

export const mapDefaults = {
  initialZoom: 14,
  maxZoom: 19,
  flyZoom: 14,
  flyDuration: 0.6,
  fitBoundsPadding: [50, 50] as [number, number],
  fitBoundsMaxZoom: 15,
  gpsTimeout: 10000,
  gpsMaxAge: 300000,
  searchDebounceMs: 400,
  latLngPrecision: 6,
  maxDisplayResults: 50,
  geocodeDefaultLimit: 5,
  geocodeMaxLimit: 10,
  osrmTimeout: 15000,
  orsTimeout: 15000,
  overpassTimeout: 60000,
  apiTruncateMax: 500,
} as const
