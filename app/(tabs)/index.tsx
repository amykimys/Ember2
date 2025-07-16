import { useRootNavigationState, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { getUserPreferences } from '../../utils/notificationUtils';
import { useData } from '../../contexts/DataContext';
import 'react-native-reanimated';

export default function InitialRouting() {
  const rootNavigationState = useRootNavigationState();
  const [defaultScreen, setDefaultScreen] = useState<'calendar' | 'todo' | 'notes' | 'profile'>('calendar');
  const [isLoading, setIsLoading] = useState(true);
  const { data: appData } = useData();

  useEffect(() => {
    const loadDefaultScreen = async () => {
      try {
        console.log('🚀 Starting default screen routing...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('👤 User authenticated:', session.user.email);
          
          // Use preloaded preferences if available
          if (appData.isPreloaded && appData.userPreferences?.default_screen) {
            console.log('📱 Using preloaded default screen preference:', appData.userPreferences.default_screen);
            if (['calendar', 'todo', 'notes', 'profile'].includes(appData.userPreferences.default_screen)) {
              console.log('✅ Setting default screen to:', appData.userPreferences.default_screen);
              setDefaultScreen(appData.userPreferences.default_screen as 'calendar' | 'todo' | 'notes' | 'profile');
            } else {
              console.log('⚠️ Invalid default screen, using calendar');
              setDefaultScreen('calendar');
            }
          } else {
            // Fallback to fetching preferences if not preloaded
            console.log('📱 Fetching user preferences...');
            const preferences = await getUserPreferences(session.user.id);
            
            if (preferences?.default_screen) {
              console.log('📱 Default screen preference found:', preferences.default_screen);
              if (['calendar', 'todo', 'notes', 'profile'].includes(preferences.default_screen)) {
                console.log('✅ Setting default screen to:', preferences.default_screen);
                setDefaultScreen(preferences.default_screen as 'calendar' | 'todo' | 'notes' | 'profile');
              } else {
                console.log('⚠️ Invalid default screen, using calendar');
                setDefaultScreen('calendar');
              }
            } else {
              console.log('📱 No default screen preference found, using calendar');
              setDefaultScreen('calendar');
            }
          }
        } else {
          console.log('❌ No user session found - redirecting to profile for authentication');
          setDefaultScreen('profile');
        }
      } catch (error) {
        console.error('❌ Error loading default screen preference:', error);
        setDefaultScreen('profile'); // Default to profile for authentication
      } finally {
        setIsLoading(false);
      }
    };

    loadDefaultScreen();
  }, [appData.isPreloaded, appData.userPreferences]);

  if (!rootNavigationState?.key || isLoading) {
    console.log('⏳ Waiting for navigation state or loading...');
    return null;
  }

  console.log('🎯 Redirecting to:', defaultScreen);
  console.log('🎯 Full redirect URL:', `/(tabs)/${defaultScreen}`);
  
  // Add a small delay to make the redirect more visible in logs
  setTimeout(() => {
    console.log('🎯 Executing redirect now...');
  }, 100);
  
  return <Redirect href={`/(tabs)/${defaultScreen}`} />;
}