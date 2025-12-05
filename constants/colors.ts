/**
 * Central color definitions for the app.
 * Use these instead of hardcoded color values.
 */

export const Colors = {
  primary: {
    DEFAULT: '#e54835', // Red-Orange - main brand color
    50: '#fdf4f3',
    100: '#fce8e6',
    200: '#fad2ce',
    300: '#f6b0a9',
    400: '#f18379',
    500: '#e54835',
    600: '#d93421',
    700: '#b52b1b',
    800: '#912316',
    900: '#7a1f14',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  green: {
    500: '#22c55e',
    600: '#16a34a',
  },
  orange: {
    500: '#f97316',
  },
  white: '#ffffff',
} as const;

// Shorthand for commonly used colors
export const PRIMARY = Colors.primary[700]; // #b52b1b - used for ActivityIndicators, icons
export const PRIMARY_LIGHT = Colors.primary[500]; // #e54835 - main brand color
export const PRIMARY_DARK = Colors.primary[800]; // #912316

export default Colors;
