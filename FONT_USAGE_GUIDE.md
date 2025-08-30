# Onest Font Usage Guide

This guide shows you how to use the Onest font family throughout your app.

## 1. Font Loading (Already Set Up)

The Onest fonts are automatically loaded in `app/_layout.tsx` and will be available throughout your app.

## 2. Using ThemedText Component (Recommended)

The `ThemedText` component automatically applies the Onest font with various variants and weights:

```tsx
import { ThemedText } from '../components/ThemedText';

// Basic usage
<ThemedText>This uses Onest Regular by default</ThemedText>

// With variants
<ThemedText variant="h1">Large Heading (Onest Bold)</ThemedText>
<ThemedText variant="h3">Medium Heading (Onest SemiBold)</ThemedText>
<ThemedText variant="bodyLarge">Large body text (Onest Regular)</ThemedText>
<ThemedText variant="button">Button text (Onest SemiBold)</ThemedText>
<ThemedText variant="caption">Small caption (Onest Regular)</ThemedText>

// With custom weights
<ThemedText weight="bold">Bold text</ThemedText>
<ThemedText weight="medium">Medium weight text</ThemedText>
<ThemedText weight="light">Light weight text</ThemedText>

// Combining variant and weight
<ThemedText variant="h2" weight="black">Extra bold heading</ThemedText>
```

## 3. Using Global Styles

Import and use the global styles:

```tsx
import { GlobalTextStyles, FontWeights } from '../styles/globalStyles';

// In your StyleSheet
const styles = StyleSheet.create({
  title: {
    ...GlobalTextStyles.h1,
    color: '#000',
  },
  body: {
    ...GlobalTextStyles.bodyMedium,
    color: '#333',
  },
  button: {
    ...GlobalTextStyles.buttonMedium,
    color: '#fff',
  },
});

// Or apply directly
<Text style={[GlobalTextStyles.h3, FontWeights.bold]}>
  Bold heading
</Text>
```

## 4. Using Font Constants Directly

```tsx
import { Fonts } from '../constants/Colors';

const styles = StyleSheet.create({
  text: {
    fontFamily: Fonts.regular, // 'Onest'
    fontSize: 16,
  },
  heading: {
    fontFamily: Fonts.bold, // 'Onest-Bold'
    fontSize: 24,
  },
  lightText: {
    fontFamily: Fonts.light, // 'Onest-Light'
    fontSize: 14,
  },
});
```

## 5. Available Font Weights

- `Fonts.thin` - Onest-Thin
- `Fonts.extraLight` - Onest-ExtraLight  
- `Fonts.light` - Onest-Light
- `Fonts.regular` - Onest (default)
- `Fonts.medium` - Onest-Medium
- `Fonts.semiBold` - Onest-SemiBold
- `Fonts.bold` - Onest-Bold
- `Fonts.extraBold` - Onest-ExtraBold
- `Fonts.black` - Onest-Black

## 6. Available Text Variants

- `h1`, `h2`, `h3`, `h4`, `h5`, `h6` - Heading styles
- `bodyLarge`, `bodyMedium`, `bodySmall` - Body text styles
- `caption` - Small caption text
- `button` - Button text styles
- `label` - Form label styles
- `input` - Input field text styles

## 7. Migration from Hardcoded Fonts

Replace existing hardcoded font declarations:

```tsx
// Before
const styles = StyleSheet.create({
  text: {
    fontFamily: 'Onest',
    fontSize: 16,
  },
});

// After (Option 1: Using ThemedText)
<ThemedText variant="bodyMedium">Your text</ThemedText>

// After (Option 2: Using global styles)
const styles = StyleSheet.create({
  text: GlobalTextStyles.bodyMedium,
});

// After (Option 3: Using Fonts constant)
const styles = StyleSheet.create({
  text: {
    fontFamily: Fonts.regular,
    fontSize: 16,
  },
});
```

## 8. Best Practices

1. **Use ThemedText component** for most text elements
2. **Use global styles** for consistent styling across components
3. **Use Fonts constants** when you need custom font combinations
4. **Avoid hardcoding** font family names
5. **Use semantic variants** (h1, body, button) rather than just font weights

## 9. Example Component

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { GlobalTextStyles } from '../styles/globalStyles';

export function ExampleComponent() {
  return (
    <View style={styles.container}>
      <ThemedText variant="h1">Welcome to Your App</ThemedText>
      <ThemedText variant="bodyLarge" style={styles.description}>
        This text uses the Onest font family automatically
      </ThemedText>
      <ThemedText variant="button" style={styles.buttonText}>
        Get Started
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  description: {
    marginTop: 10,
    marginBottom: 20,
  },
  buttonText: {
    textAlign: 'center',
  },
});
```

Now your entire app will use the Onest font family consistently!








