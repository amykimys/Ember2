import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useColorScheme } from '../hooks/useColorScheme';
import { Colors, Fonts } from '../constants/Colors';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  variant?: 'default' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'bodyLarge' | 'bodyMedium' | 'bodySmall' | 'caption' | 'button' | 'label' | 'input';
  weight?: 'thin' | 'extraLight' | 'light' | 'regular' | 'medium' | 'semiBold' | 'bold' | 'extraBold' | 'black';
};

export function ThemedText(props: ThemedTextProps) {
  const { style, lightColor, darkColor, variant = 'default', weight = 'regular', ...otherProps } = props;
  const colorScheme = useColorScheme();

  const color = colorScheme === 'light' ? lightColor : darkColor;

  // Get font family based on weight
  const getFontFamily = () => {
    switch (weight) {
      case 'thin': return Fonts.thin;
      case 'extraLight': return Fonts.extraLight;
      case 'light': return Fonts.light;
      case 'regular': return Fonts.regular;
      case 'medium': return Fonts.medium;
      case 'semiBold': return Fonts.semiBold;
      case 'bold': return Fonts.bold;
      case 'extraBold': return Fonts.extraBold;
      case 'black': return Fonts.black;
      default: return Fonts.regular;
    }
  };

  // Get variant styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'h1': return { fontFamily: Fonts.bold, fontSize: 32, lineHeight: 40 };
      case 'h2': return { fontFamily: Fonts.bold, fontSize: 28, lineHeight: 36 };
      case 'h3': return { fontFamily: Fonts.semiBold, fontSize: 24, lineHeight: 32 };
      case 'h4': return { fontFamily: Fonts.semiBold, fontSize: 20, lineHeight: 28 };
      case 'h5': return { fontFamily: Fonts.medium, fontSize: 18, lineHeight: 24 };
      case 'h6': return { fontFamily: Fonts.medium, fontSize: 16, lineHeight: 22 };
      case 'bodyLarge': return { fontFamily: Fonts.regular, fontSize: 18, lineHeight: 26 };
      case 'bodyMedium': return { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 24 };
      case 'bodySmall': return { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20 };
      case 'caption': return { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 16 };
      case 'button': return { fontFamily: Fonts.semiBold, fontSize: 16, lineHeight: 22 };
      case 'label': return { fontFamily: Fonts.medium, fontSize: 14, lineHeight: 20 };
      case 'input': return { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 24 };
      default: return { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 24 };
    }
  };

  return (
    <Text
      style={[
        getVariantStyles(),
        { color: color || Colors[colorScheme].text },
        style,
      ]}
      {...otherProps}
    />
  );
}
