import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Alert, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../../supabase';
import { User } from '@supabase/supabase-js';
import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';

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
  start_datetime: Date;
  end_datetime: Date;
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
  const [thisWeekTodos, setThisWeekTodos] = useState<Todo[]>([]);
  const [thisWeekEvents, setThisWeekEvents] = useState<Event[]>([]);
  const [startOfWeek, setStartOfWeek] = useState<Date>(new Date());
  const [endOfWeek, setEndOfWeek] = useState<Date>(new Date());

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
      fetchUpcomingData(); // Fetch upcoming data when user signs in
    }
  }, [user]);

  // Add a periodic refresh for upcoming data
  useEffect(() => {
    if (!user) return;

    // Initial fetch
    fetchUpcomingData();

    // Set up periodic refresh every minute
    const refreshInterval = setInterval(fetchUpcomingData, 60000);

    return () => clearInterval(refreshInterval);
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

      // Get the start and end of this week (Sunday to Saturday)
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Start from Sunday
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // End on Saturday
      weekEnd.setHours(23, 59, 59, 999);

      setStartOfWeek(weekStart);
      setEndOfWeek(weekEnd);

      console.log('Date ranges for fetching:', {
        today: today.toISOString(),
        tomorrow: tomorrow.toISOString(),
        dayAfterTomorrow: dayAfterTomorrow.toISOString(),
        startOfWeek: weekStart.toISOString(),
        endOfWeek: weekEnd.toISOString(),
        todayDay: today.getDay(), // 0 = Sunday, 1 = Monday, etc.
        startOfWeekDay: weekStart.getDay(),
        endOfWeekDay: weekEnd.getDay()
      });

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
        console.log('Today\'s tasks fetched:', todayTasksData.length);
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
        console.log('Tomorrow\'s tasks fetched:', tomorrowTasksData.length);
        setTomorrowTodos(tomorrowTasksData.map(task => ({
          ...task,
          date: new Date(task.date)
        })));
      }

      // Fetch this week's tasks (excluding today and tomorrow)
      const { data: thisWeekTasksData, error: thisWeekTasksError } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', dayAfterTomorrow.toISOString())
        .lte('date', weekEnd.toISOString())
        .order('date', { ascending: true });

      if (thisWeekTasksError) {
        console.error('Error fetching this week\'s tasks:', thisWeekTasksError);
      } else {
        console.log('This week\'s tasks fetched:', thisWeekTasksData.length);
        setThisWeekTodos(thisWeekTasksData.map(task => ({
          ...task,
          date: new Date(task.date)
        })));
      }

      // Fetch today's events
      const { data: todayEventsData, error: todayEventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_datetime', today.toISOString())
        .lt('start_datetime', tomorrow.toISOString())
        .order('start_datetime', { ascending: true });

      if (todayEventsError) {
        console.error('Error fetching today\'s events:', todayEventsError);
      } else {
        console.log('Today\'s events fetched:', todayEventsData.length);
        setTodayEvents(todayEventsData.map(event => ({
          ...event,
          start_datetime: new Date(event.start_datetime),
          end_datetime: new Date(event.end_datetime)
        })));
      }

      // Fetch tomorrow's events
      const { data: tomorrowEventsData, error: tomorrowEventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_datetime', tomorrow.toISOString())
        .lt('start_datetime', dayAfterTomorrow.toISOString())
        .order('start_datetime', { ascending: true });

      if (tomorrowEventsError) {
        console.error('Error fetching tomorrow\'s events:', tomorrowEventsError);
      } else {
        console.log('Tomorrow\'s events fetched:', tomorrowEventsData.length);
        setTomorrowEvents(tomorrowEventsData.map(event => ({
          ...event,
          start_datetime: new Date(event.start_datetime),
          end_datetime: new Date(event.end_datetime)
        })));
      }

      // Fetch this week's events (including all events from start of week to end of week)
      const { data: thisWeekEventsData, error: thisWeekEventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_datetime', weekStart.toISOString())
        .lte('start_datetime', weekEnd.toISOString())
        .order('start_datetime', { ascending: true });

      if (thisWeekEventsError) {
        console.error('Error fetching this week\'s events:', thisWeekEventsError);
      } else {
        console.log('This week\'s events fetched:', {
          count: thisWeekEventsData.length,
          events: thisWeekEventsData.map(event => ({
            id: event.id,
            title: event.title,
            start_datetime: event.start_datetime,
            end_datetime: event.end_datetime
          }))
        });
        
        // Filter out today's and tomorrow's events from this week's data
        const filteredThisWeekEvents = thisWeekEventsData.filter(event => {
          const eventDate = new Date(event.start_datetime);
          return eventDate >= dayAfterTomorrow && eventDate <= weekEnd;
        });

        console.log('Filtered this week\'s events (excluding today and tomorrow):', {
          count: filteredThisWeekEvents.length,
          events: filteredThisWeekEvents.map(event => ({
            id: event.id,
            title: event.title,
            start_datetime: event.start_datetime,
            end_datetime: event.end_datetime
          }))
        });

        setThisWeekEvents(filteredThisWeekEvents.map(event => ({
          ...event,
          start_datetime: new Date(event.start_datetime),
          end_datetime: new Date(event.end_datetime)
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

  const renderUpcomingSection = (date: Date, todos: Todo[], events: Event[], isToday: boolean, isThisWeek: boolean = false) => {
    const dateStr = isToday ? 'Today' : isThisWeek ? 'This Week' : format(date, 'EEEE');
    const hasContent = todos.length > 0 || events.length > 0;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{dateStr}</Text>
          {isThisWeek && (
            <Text style={styles.weekDate}>
              {format(startOfWeek, 'MMM d')} - {format(endOfWeek, 'MMM d')}
            </Text>
          )}
        </View>

        {!hasContent ? (
          <Text style={styles.emptyText}>No items</Text>
        ) : (
          <View style={styles.contentContainer}>
            {todos.map((todo) => (
              <View key={todo.id} style={styles.itemRow}>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/todo')}
                  style={styles.checkboxContainer}
                >
                  <View style={[styles.checkbox, todo.completed && styles.checkboxChecked]}>
                    {todo.completed && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                </TouchableOpacity>
                <View style={styles.itemContent}>
                  <Text style={[styles.itemText, todo.completed && styles.itemTextCompleted]}>
                    {todo.text}
                  </Text>
                  {todo.description && (
                    <Text style={styles.itemDescription} numberOfLines={1}>
                      {todo.description}
                    </Text>
                  )}
                </View>
              </View>
            ))}

            {events.map((event) => (
              <TouchableOpacity
                key={event.id}
                onPress={() => router.push('/calendar')}
                style={styles.itemRow}
              >
                <View style={styles.eventTimeContainer}>
                  <Text style={styles.eventTime}>
                    {format(event.start_datetime, 'h:mm a')}
                  </Text>
                </View>
                <View style={styles.itemContent}>
                  <Text style={styles.itemText}>{event.title}</Text>
                  {event.description && (
                    <Text style={styles.itemDescription} numberOfLines={1}>
                      {event.description}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
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
          <View style={styles.headerLeft} />
          <View style={styles.profileInfo}>
            <Text style={styles.name}>
              {user?.user_metadata?.full_name || user?.email || 'Your Name'}
            </Text>
            <Text style={styles.status}>
              {user ? 'Signed In' : 'Not Signed In'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {user && (
              <TouchableOpacity
                style={styles.notesButton}
                onPress={() => router.push('/notes')}
              >
                <Ionicons name="document-text-outline" size={24} color="#FF9A8B" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Upcoming Section */}
        {user && (
          <>
            {renderUpcomingSection(new Date(), todayTodos, todayEvents, true)}
            {renderUpcomingSection(new Date(new Date().setDate(new Date().getDate() + 1)), tomorrowTodos, tomorrowEvents, false)}
            {renderUpcomingSection(new Date(), thisWeekTodos, thisWeekEvents, false, true)}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 24,
  },
  headerLeft: {
    width: 44, // Same width as notesButton for balance
  },
  headerRight: {
    width: 44, // Same width as notesButton for balance
  },
  profileInfo: {
    alignItems: 'center',
    flex: 1,
  },
  name: {
    fontSize: 18,
    color: '#000',
    fontWeight: '600',
  },
  status: {
    color: '#666',
    marginTop: 2,
    fontSize: 13,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  weekDate: {
    fontSize: 13,
    color: '#999',
    marginLeft: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    paddingHorizontal: 16,
  },
  contentContainer: {
    backgroundColor: '#fff',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  eventTimeContainer: {
    minWidth: 60,
    marginRight: 12,
  },
  eventTime: {
    fontSize: 13,
    color: '#666',
  },
  itemContent: {
    flex: 1,
  },
  itemText: {
    fontSize: 15,
    color: '#000',
  },
  itemTextCompleted: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  itemDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  signOutButton: {
    padding: 16,
    alignItems: 'center',
  },
  signOutText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },
  signInContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  notesButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF5F3',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 15,
    color: '#000',
    marginLeft: 12,
  },
  preferenceValue: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
});