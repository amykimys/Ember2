import { useRootNavigationState, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import 'react-native-reanimated';

export default function InitialRouting() {
  const rootNavigationState = useRootNavigationState();
  const [defaultScreen, setDefaultScreen] = useState<'calendar' | 'todo' | 'notes' | 'profile'>('calendar');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDefaultScreen = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Get user's default screen preference
          const { data: preferences } = await supabase
            .from('user_preferences')
            .select('default_screen')
            .eq('user_id', session.user.id)
            .single();
          
          if (preferences?.default_screen) {
            console.log('📱 Default screen preference found:', preferences.default_screen);
            // Handle case where user had 'friends' as default screen (now removed)
            if (preferences.default_screen === 'friends') {
              console.log('🔄 Converting friends to calendar');
              setDefaultScreen('calendar');
            } else if (['calendar', 'todo', 'notes', 'profile'].includes(preferences.default_screen)) {
              console.log('✅ Setting default screen to:', preferences.default_screen);
              setDefaultScreen(preferences.default_screen as 'calendar' | 'todo' | 'notes' | 'profile');
            } else {
              console.log('⚠️ Invalid default screen, using calendar');
              setDefaultScreen('calendar');
            }
          } else {
            console.log('📱 No default screen preference found, using calendar');
          }
        }
      } catch (error) {
        console.error('Error loading default screen preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDefaultScreen();
  }, []);

  if (!rootNavigationState?.key || isLoading) return null;

  return <Redirect href={`/(tabs)/${defaultScreen}`} />;
}