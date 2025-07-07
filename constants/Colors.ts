/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

// Modern color palette
const primaryColor = '#0f172a'; // Modern slate-900
const primaryDark = '#020617'; // Modern slate-950
const primaryLight = '#334155'; // Modern slate-700
const accentColor = '#3b82f6'; // Modern blue-500
const accentLight = '#60a5fa'; // Modern blue-400
const successColor = '#10b981'; // Modern emerald-500
const warningColor = '#f59e0b'; // Modern amber-500
const errorColor = '#ef4444'; // Modern red-500

const tintColorLight = primaryColor;
const tintColorDark = accentColor;

export const Colors = {
  light: {
    text: '#0f172a',
    background: '#ffffff',
    tint: tintColorLight,
    icon: '#64748b',
    tabIconDefault: '#64748b',
    tabIconSelected: tintColorLight,
    primary: primaryColor,
    primaryDark: primaryDark,
    primaryLight: primaryLight,
    accent: accentColor,
    accentLight: accentLight,
    success: successColor,
    warning: warningColor,
    error: errorColor,
    surface: '#f8fafc',
    surfaceVariant: '#f1f5f9',
    border: '#e2e8f0',
    borderVariant: '#cbd5e1',
  },
  dark: {
    text: '#f8fafc',
    background: '#0f172a',
    tint: tintColorDark,
    icon: '#94a3b8',
    tabIconDefault: '#94a3b8',
    tabIconSelected: tintColorDark,
    primary: accentColor,
    primaryDark: primaryColor,
    primaryLight: accentLight,
    accent: accentLight,
    accentLight: primaryLight,
    success: successColor,
    warning: warningColor,
    error: errorColor,
    surface: '#1e293b',
    surfaceVariant: '#334155',
    border: '#475569',
    borderVariant: '#64748b',
  },
};
