import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; 
import { useColorScheme } from '@/hooks/useColorScheme';
import * as Linking from 'expo-linking';
import { supabase } from '../supabase';
import { Session } from '@supabase/supabase-js';
import 'react-native-reanimated';
import * as Font from 'expo-font';
import { View } from 'react-native';
import LoadingScreen from '@/components/LoadingScreen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [appReady, setAppReady] = useState(false);
  
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Onest': require('../assets/fonts/Onest-Regular.ttf'),
    'Onest-Bold': require('../assets/fonts/Onest-Bold.ttf'),
    'Onest-Medium': require('../assets/fonts/Onest-Medium.ttf'),
  });

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          'Manrope': require('../assets/fonts/Manrope-Regular.ttf'),
          'Manrope-Bold': require('../assets/fonts/Manrope-Bold.ttf'),
          'Manrope-Medium': require('../assets/fonts/Manrope-Medium.ttf'),
          'Onest': require('../assets/fonts/Onest-Regular.ttf'),
          'Onest-Bold': require('../assets/fonts/Onest-Bold.ttf'),
          'Onest-Medium': require('../assets/fonts/Onest-Medium.ttf'),
        });
        setFontsLoaded(true);
      } catch (error) {
        console.error('Error loading fonts:', error);
        setFontsLoaded(true); // Continue even if fonts fail to load
      }
    }
    loadFonts();
  }, []);

  useEffect(() => {
    if (loaded && fontsLoaded) {
      // Hide the native splash screen
      SplashScreen.hideAsync();
      
      // Show our custom loading screen for a bit longer
      setTimeout(() => {
        setAppReady(true);
      }, 1000);
    }
  }, [loaded, fontsLoaded]);

  useEffect(() => {
    // Initialize session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('🧩 Restoring session from getSession:', {
        session: session?.user?.email,
        error: error?.message,
        hasSession: !!session,
        userId: session?.user?.id
      });
      setSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('📡 Auth state changed:', {
        event,
        session: session?.user?.email,
        hasSession: !!session,
        userId: session?.user?.id
      });
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const listener = Linking.addEventListener('url', (event) => {
    console.log('🔗 Deep link triggered:', event.url);
  });

  useEffect(() => {
    return () => {
      listener.remove();
    };
  }, []);

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  // Show loading screen while app is initializing
  if (!appReady || isLoading) {
    return <LoadingScreen onLoadingComplete={handleLoadingComplete} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: '#fff',
              },
              headerTitleStyle: {
                fontFamily: 'Onest-Medium',
              }
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}