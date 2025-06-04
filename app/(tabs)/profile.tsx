import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Alert, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../../supabase';
import { User } from '@supabase/supabase-js';
import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications_enabled: boolean;
  default_view: 'day' | 'week' | 'month';
}

interface Todo {
  id: string;
  text: string;
  description?: string;
  completed: boolean;
  date: Date;
  category_id: string | null;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  start_time: Date;
  end_time: Date;
  category_id: string | null;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'system',
    notifications_enabled: true,
    default_view: 'day'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [todayTodos, setTodayTodos] = useState<Todo[]>([]);
  const [tomorrowTodos, setTomorrowTodos] = useState<Todo[]>([]);
  const [todayEvents, setTodayEvents] = useState<Event[]>([]);
  const [tomorrowEvents, setTomorrowEvents] = useState<Event[]>([]);

  // ✅ Configure Google Sign-In (run once)
  useEffect(() => {
    GoogleSignin.configure({
      scopes: ['email', 'profile', 'openid'],
      webClientId: '407418160129-v3c55fd6db3f8mv747p9q5tsbcmvnrik.apps.googleusercontent.com',
      iosClientId: '407418160129-8u96bsrh8j1madb0r7trr0k6ci327gds.apps.googleusercontent.com',
      offlineAccess: true,
      hostedDomain: '', // optional
    });

    const checkSession = async () => {
      try {
        console.log('[Profile] Starting session check...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[Profile] Session check error:', sessionError);
          return;
        }

        console.log('[Profile] Session check result:', {
          hasSession: !!session,
          userEmail: session?.user?.email,
          userId: session?.user?.id,
          accessToken: session?.access_token ? 'present' : 'missing',
          refreshToken: session?.refresh_token ? 'present' : 'missing'
        });

      if (session?.user) {
          console.log('[Profile] Setting user from session:', session.user.email);
        setUser(session.user);
        } else {
          console.log('[Profile] No user found in session');
        }
      } catch (error) {
        console.error('[Profile] Error in checkSession:', error);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Profile] Auth state changed:', {
        event,
        userEmail: session?.user?.email,
        userId: session?.user?.id,
        hasAccessToken: !!session?.access_token,
        hasRefreshToken: !!session?.refresh_token
      });

      if (session?.user) {
        console.log('[Profile] Setting user from auth state change:', session.user.email);
        setUser(session.user);
      } else {
        console.log('[Profile] No user in auth state change');
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async () => {
    try {
      console.log('[Profile] Starting sign in process...');
      await GoogleSignin.hasPlayServices();
      const signInResponse = await GoogleSignin.signIn();
      console.log('[Profile] Google sign in successful:', signInResponse);
      
      const { idToken } = await GoogleSignin.getTokens();
      console.log('[Profile] Got ID token:', idToken ? 'Yes' : 'No');
  
      if (!idToken) {
        console.error('[Profile] No ID token present');
        throw new Error('No ID token present');
      }
  
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
  
      if (error) {
        console.error('[Profile] Supabase sign-in error:', {
          message: error.message,
          status: error.status,
          name: error.name
        });
        Alert.alert('Error', 'Failed to sign in. Please try again.');
      } else {
        console.log('[Profile] Sign in successful:', {
          email: data.user?.email,
          id: data.user?.id,
          hasSession: !!data.session,
          hasAccessToken: !!data.session?.access_token
        });
        setUser(data.user ?? null);
      }
    } catch (error: any) {
      console.error('[Profile] Sign in error:', {
        code: error.code,
        message: error.message,
        name: error.name
      });
      
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('[Profile] User cancelled sign-in.');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('[Profile] Sign-in already in progress.');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.log('[Profile] Play Services not available.');
      } else {
        Alert.alert('Error', 'An unexpected error occurred during sign in.');
      }
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('Starting sign out process...');
      
      // First, revoke Google access and sign out
      try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
        console.log('Successfully signed out from Google');
      } catch (googleError) {
        console.error('Error signing out from Google:', googleError);
        // Continue with Supabase sign out even if Google sign out fails
      }
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out from Supabase:', error.message);
        throw error;
      }
      
      console.log('Successfully signed out from Supabase');
        setUser(null);
      
      // Force clear any remaining auth state by signing out again
      try {
        await GoogleSignin.signOut();
      } catch (error) {
        console.log('Second sign out attempt completed');
      }
      
    } catch (error) {
      console.error('Error in handleSignOut:', error);
      Alert.alert(
        'Error',
        'There was a problem signing out. Please try again.'
      );
    }
  };

  const loadUserPreferences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No preferences found, create default preferences
          const defaultPreferences: UserPreferences = {
            theme: 'system',
            notifications_enabled: true,
            default_view: 'day'
          };

          const { error: insertError } = await supabase
            .from('user_preferences')
            .insert({
              user_id: user.id,
              ...defaultPreferences,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (insertError) {
            console.error('Error creating default preferences:', insertError);
            return;
          }

          setPreferences(defaultPreferences);
          return;
        }

        console.error('Error loading preferences:', error);
        return;
      }

      if (data) {
        // Ensure all required fields are present and match the type
        const preferences: UserPreferences = {
          theme: (data.theme as 'light' | 'dark' | 'system') || 'system',
          notifications_enabled: data.notifications_enabled ?? true,
          default_view: (data.default_view as 'day' | 'week' | 'month') || 'day'
        };
        setPreferences(preferences);
      }
    } catch (error) {
      console.error('Error in loadUserPreferences:', error);
      // Set default preferences if there's an error
      const defaultPreferences: UserPreferences = {
        theme: 'system',
        notifications_enabled: true,
        default_view: 'day'
      };
      setPreferences(defaultPreferences);
    }
  };

  useEffect(() => {
    if (user) {
      loadUserPreferences();
    }
  }, [user]);

  const handlePreferenceChange = async (key: keyof UserPreferences, value: any) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          [key]: value,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      setPreferences(prev => ({ ...prev, [key]: value }));
    } catch (error) {
      console.error('Error updating preference:', error);
      Alert.alert('Error', 'Failed to update preference');
    }
  };

  const fetchUpcomingData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      // Fetch today's tasks
      const { data: todayTasksData, error: todayTasksError } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', today.toISOString())
        .lt('date', tomorrow.toISOString())
        .order('date', { ascending: true });

      if (todayTasksError) {
        console.error('Error fetching today\'s tasks:', todayTasksError);
      } else {
        setTodayTodos(todayTasksData.map(task => ({
          ...task,
          date: new Date(task.date)
        })));
      }

      // Fetch tomorrow's tasks
      const { data: tomorrowTasksData, error: tomorrowTasksError } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', tomorrow.toISOString())
        .lt('date', dayAfterTomorrow.toISOString())
        .order('date', { ascending: true });

      if (tomorrowTasksError) {
        console.error('Error fetching tomorrow\'s tasks:', tomorrowTasksError);
      } else {
        setTomorrowTodos(tomorrowTasksData.map(task => ({
          ...task,
          date: new Date(task.date)
        })));
      }

      // Fetch today's events
      const { data: todayEventsData, error: todayEventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', today.toISOString())
        .lt('start_time', tomorrow.toISOString())
        .order('start_time', { ascending: true });

      if (todayEventsError) {
        console.error('Error fetching today\'s events:', todayEventsError);
      } else {
        setTodayEvents(todayEventsData.map(event => ({
          ...event,
          start_time: new Date(event.start_time),
          end_time: new Date(event.end_time)
        })));
      }

      // Fetch tomorrow's events
      const { data: tomorrowEventsData, error: tomorrowEventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', tomorrow.toISOString())
        .lt('start_time', dayAfterTomorrow.toISOString())
        .order('start_time', { ascending: true });

      if (tomorrowEventsError) {
        console.error('Error fetching tomorrow\'s events:', tomorrowEventsError);
      } else {
        setTomorrowEvents(tomorrowEventsData.map(event => ({
          ...event,
          start_time: new Date(event.start_time),
          end_time: new Date(event.end_time)
        })));
      }
    } catch (error) {
      console.error('Error fetching upcoming data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderPreferenceItem = (
    icon: string,
    label: string,
    value: any,
    onPress: () => void,
    color: string = '#666'
  ) => (
    <TouchableOpacity
      style={styles.preferenceItem}
      onPress={onPress}
    >
      <View style={styles.preferenceItemLeft}>
        <Ionicons name={icon as any} size={22} color={color} />
        <Text style={styles.preferenceLabel}>{label}</Text>
      </View>
      <View style={styles.preferenceItemRight}>
        <Text style={styles.preferenceValue}>{value}</Text>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </View>
    </TouchableOpacity>
  );

  const renderUpcomingSection = (date: Date, todos: Todo[], events: Event[], isToday: boolean) => {
    const dateStr = isToday ? 'Today' : 'Tomorrow';
    const hasContent = todos.length > 0 || events.length > 0;

    return (
      <View style={styles.upcomingSection}>
        <Text style={styles.sectionTitle}>{dateStr}</Text>
        {isLoading ? (
          <ActivityIndicator style={styles.loader} color="#666" />
        ) : !hasContent ? (
          <Text style={styles.emptyText}>No tasks or events scheduled</Text>
        ) : (
          <View>
            {todos.length > 0 && (
              <View style={styles.tasksContainer}>
                <Text style={styles.subsectionTitle}>Tasks</Text>
                {todos.map(todo => (
                  <TouchableOpacity
                    key={todo.id}
                    style={styles.itemContainer}
                    onPress={() => router.push('/(tabs)/todo')}
                  >
                    <View style={[styles.checkbox, todo.completed && styles.checkboxCompleted]}>
                      {todo.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                    <Text style={[styles.itemText, todo.completed && styles.completedText]}>
                      {todo.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
                  )}
            {events.length > 0 && (
              <View style={styles.eventsContainer}>
                <Text style={styles.subsectionTitle}>Events</Text>
                {events.map(event => (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.itemContainer}
                    onPress={() => router.push('/calendar')}
                  >
                    <View style={styles.eventTimeContainer}>
                      <Text style={styles.eventTime}>
                        {formatTime(event.start_time)}
                    </Text>
                </View>
                    <Text style={styles.itemText}>{event.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
        </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>
              {user?.user_metadata?.full_name || user?.email || 'Your Name'}
            </Text>
            <Text style={styles.status}>
              {user ? 'Signed In' : 'Not Signed In'}
            </Text>
          </View>
        </View>

        {/* Upcoming Section */}
        {user && (
          <>
            {renderUpcomingSection(new Date(), todayTodos, todayEvents, true)}
            {renderUpcomingSection(new Date(new Date().setDate(new Date().getDate() + 1)), tomorrowTodos, tomorrowEvents, false)}
          </>
        )}

        {/* Preferences Section */}
        {user && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            {renderPreferenceItem(
              'color-palette-outline',
              'Theme',
              preferences?.theme ? preferences.theme.charAt(0).toUpperCase() + preferences.theme.slice(1) : 'System',
              () => Alert.alert(
                'Theme',
                'Select theme',
                [
                  { text: 'Light', onPress: () => handlePreferenceChange('theme', 'light') },
                  { text: 'Dark', onPress: () => handlePreferenceChange('theme', 'dark') },
                  { text: 'System', onPress: () => handlePreferenceChange('theme', 'system') },
                ]
              )
            )}
            {renderPreferenceItem(
              'notifications-outline',
              'Notifications',
              preferences?.notifications_enabled ? 'On' : 'Off',
              () => handlePreferenceChange('notifications_enabled', !preferences?.notifications_enabled)
            )}
            {renderPreferenceItem(
              'calendar-outline',
              'Default View',
              preferences?.default_view ? preferences.default_view.charAt(0).toUpperCase() + preferences.default_view.slice(1) : 'Day',
              () => Alert.alert(
                'Default View',
                'Select default view',
                [
                  { text: 'Day', onPress: () => handlePreferenceChange('default_view', 'day') },
                  { text: 'Week', onPress: () => handlePreferenceChange('default_view', 'week') },
                  { text: 'Month', onPress: () => handlePreferenceChange('default_view', 'month') },
                ]
              )
            )}
          </View>
        )}

        {/* Sign In/Out Section */}
        <View style={styles.section}>
          {user ? (
              <TouchableOpacity
              style={styles.signOutButton}
                onPress={handleSignOut}
              >
              <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
          ) : (
            <View style={styles.signInContainer}>
              <GoogleSigninButton
                size={GoogleSigninButton.Size.Wide}
                color={GoogleSigninButton.Color.Light}
                onPress={handleSignIn}
              />
            </View>
          )}
        </View>
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 24,
  },
  profileInfo: {
    alignItems: 'center',
  },
  name: {
    fontSize: 20,
    color: '#000',
    fontWeight: '600',
  },
  status: {
    color: '#666',
    marginTop: 4,
    fontSize: 14,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  upcomingSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  loader: {
    marginVertical: 20,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginVertical: 20,
  },
  tasksContainer: {
    marginBottom: 16,
  },
  eventsContainer: {
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#666',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  itemText: {
    fontSize: 15,
    color: '#000',
    flex: 1,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#666',
  },
  eventTimeContainer: {
    width: 60,
    marginRight: 12,
  },
  eventTime: {
    fontSize: 14,
    color: '#666',
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  preferenceItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preferenceItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preferenceLabel: {
    fontSize: 16,
    color: '#000',
    marginLeft: 12,
  },
  preferenceValue: {
    fontSize: 16,
    color: '#666',
    marginRight: 8,
  },
  signOutButton: {
    padding: 16,
    alignItems: 'center',
  },
  signOutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  signInContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
});