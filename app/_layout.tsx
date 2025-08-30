import React from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { DataProvider } from '../contexts/DataContext';
import { TabBarProvider } from '../contexts/TabBarContext';

export default function RootLayout() {
  // Load all Onest fonts
  const [fontsLoaded] = useFonts({
    'Onest': require('../assets/fonts/Onest-Regular.ttf'),
    'Onest-Thin': require('../assets/fonts/Onest-Thin.ttf'),
    'Onest-ExtraLight': require('../assets/fonts/Onest-ExtraLight.ttf'),
    'Onest-Light': require('../assets/fonts/Onest-Light.ttf'),
    'Onest-Medium': require('../assets/fonts/Onest-Medium.ttf'),
    'Onest-SemiBold': require('../assets/fonts/Onest-SemiBold.ttf'),
    'Onest-Bold': require('../assets/fonts/Onest-Bold.ttf'),
    'Onest-ExtraBold': require('../assets/fonts/Onest-ExtraBold.ttf'),
    'Onest-Black': require('../assets/fonts/Onest-Black.ttf'),
  });

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  return (
    <DataProvider>
      <TabBarProvider>
        <Stack>
          <Stack.Screen name="test" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </TabBarProvider>
    </DataProvider>
  );
}