/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

// Purple/Blue theme colors
const primaryColor = '#667eea'; // Main purple/blue
const primaryDark = '#5a67d8'; // Darker purple
const primaryLight = '#8b9df2'; // Lighter purple
const accentColor = '#764ba2'; // Secondary purple
const accentLight = '#9f7aea'; // Light accent

const tintColorLight = primaryColor;
const tintColorDark = primaryLight;

export const Colors = {
  light: {
    text: '#1a1a1a',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    primary: primaryColor,
    primaryDark: primaryDark,
    primaryLight: primaryLight,
    accent: accentColor,
    accentLight: accentLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    primary: primaryLight,
    primaryDark: primaryColor,
    primaryLight: accentLight,
    accent: accentLight,
    accentLight: primaryLight,
  },
};
