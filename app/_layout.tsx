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
import { supabase, checkSessionStatus } from '../supabase';
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
    // Initialize session with better error handling and retry logic
    const initializeSession = async () => {
      try {
        console.log('🔄 Initializing session...');
        
        // First, try to get the current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting session:', error);
        } else if (session) {
                  console.log('✅ Session restored successfully:', {
          email: session.user?.email,
          userId: session.user?.id,
          expiresAt: session.expires_at,
          isExpired: session.expires_at ? new Date(session.expires_at * 1000) < new Date() : false
        });
        setSession(session);
        
        // Additional session validation
        const sessionStatus = await checkSessionStatus();
        console.log('🔍 Session validation result:', sessionStatus);
        } else {
          console.log('ℹ️ No existing session found');
          setSession(null);
        }
      } catch (error) {
        console.error('❌ Error initializing session:', error);
        setSession(null);
      }
    };

    initializeSession();

    // Listen for auth changes with enhanced logging
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('📡 Auth state changed:', {
        event,
        email: session?.user?.email,
        userId: session?.user?.id,
        hasSession: !!session,
        expiresAt: session?.expires_at
      });
      
      setSession(session);
      
      // Handle specific auth events
      if (event === 'SIGNED_IN') {
        console.log('🎉 User signed in successfully');
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed successfully');
      } else if (event === 'USER_UPDATED') {
        console.log('👤 User profile updated');
      }
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