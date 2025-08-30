import { StyleSheet } from 'react-native';
import { Fonts } from '../constants/Colors';

// Global text styles with Onest font
export const GlobalTextStyles = StyleSheet.create({
  // Default text styles
  default: {
    fontFamily: Fonts.default,
    fontSize: 16,
  },
  
  // Heading styles
  h1: {
    fontFamily: Fonts.bold,
    fontSize: 32,
    lineHeight: 40,
  },
  h2: {
    fontFamily: Fonts.bold,
    fontSize: 28,
    lineHeight: 36,
  },
  h3: {
    fontFamily: Fonts.semiBold,
    fontSize: 24,
    lineHeight: 32,
  },
  h4: {
    fontFamily: Fonts.semiBold,
    fontSize: 20,
    lineHeight: 28,
  },
  h5: {
    fontFamily: Fonts.medium,
    fontSize: 18,
    lineHeight: 24,
  },
  h6: {
    fontFamily: Fonts.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  
  // Body text styles
  bodyLarge: {
    fontFamily: Fonts.regular,
    fontSize: 18,
    lineHeight: 26,
  },
  bodyMedium: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  bodySmall: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  
  // Caption styles
  caption: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  
  // Button text styles
  buttonLarge: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  buttonMedium: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  buttonSmall: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    lineHeight: 18,
  },
  
  // Label styles
  label: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  
  // Input text styles
  input: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  
  // Tab bar text styles
  tabBar: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 16,
  },
});

// Font weight utilities
export const FontWeights = {
  thin: { fontFamily: Fonts.thin },
  extraLight: { fontFamily: Fonts.extraLight },
  light: { fontFamily: Fonts.light },
  regular: { fontFamily: Fonts.regular },
  medium: { fontFamily: Fonts.medium },
  semiBold: { fontFamily: Fonts.semiBold },
  bold: { fontFamily: Fonts.bold },
  extraBold: { fontFamily: Fonts.extraBold },
  black: { fontFamily: Fonts.black },
};

// Common text combinations
export const TextCombinations = {
  title: [GlobalTextStyles.h3, FontWeights.bold],
  subtitle: [GlobalTextStyles.h5, FontWeights.medium],
  body: [GlobalTextStyles.bodyMedium, FontWeights.regular],
  caption: [GlobalTextStyles.caption, FontWeights.regular],
  button: [GlobalTextStyles.buttonMedium, FontWeights.semiBold],
  input: [GlobalTextStyles.input, FontWeights.regular],
};








