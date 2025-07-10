import { useRootNavigationState, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { getUserPreferences } from '../../utils/notificationUtils';
import 'react-native-reanimated';

export default function InitialRouting() {
  const rootNavigationState = useRootNavigationState();
  const [defaultScreen, setDefaultScreen] = useState<'calendar' | 'todo' | 'notes' | 'profile'>('calendar');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDefaultScreen = async () => {
      try {
        console.log('🚀 Starting default screen routing...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('👤 User authenticated:', session.user.email);
          // Get user's default screen preference using cached preferences
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
        } else {
          console.log('❌ No user session found, using calendar as default');
          setDefaultScreen('calendar');
        }
      } catch (error) {
        console.error('❌ Error loading default screen preference:', error);
        setDefaultScreen('calendar');
      } finally {
        setIsLoading(false);
      }
    };

    loadDefaultScreen();
  }, []);

  if (!rootNavigationState?.key || isLoading) {
    console.log('⏳ Waiting for navigation state or loading...');
    return null;
  }

  console.log('🎯 Redirecting to:', defaultScreen);
  return <Redirect href={`/(tabs)/${defaultScreen}`} />;
}