import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, StyleSheet, Platform, Alert } from 'react-native';
import { User } from '@supabase/supabase-js';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import { configureGoogleSignIn, signInWithGoogle, signOut, getCurrentSession } from '../../auth';

const defaultProfileImage = 'https://placekitten.com/200/200';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  category_name?: string;
  category_color?: string;
  date?: string;
}

interface Habit {
  id: string;
  text: string;
  completed_days: string[];
  category_name?: string;
  category_color?: string;
  streak?: number;
}

interface Event {
  id: string;
  title: string;
  start_datetime: Date;
  end_datetime: Date;
  category_name?: string;
  category_color?: string;
}

export default function ProfileScreen() {
  console.log('ProfileScreen component starting...');
  
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [todayHabits, setTodayHabits] = useState<Habit[]>([]);
  const [todayEvents, setTodayEvents] = useState<Event[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Configure Google Sign-In and set up auth state listener
  useEffect(() => {
    console.log('ProfileScreen useEffect running...');
    
    const setupAuth = async () => {
      try {
        console.log('Setting up auth...');
        await configureGoogleSignIn();
        const { session } = await getCurrentSession();
        console.log('Current session:', session ? 'exists' : 'none');
        
        if (session?.user) {
          console.log('User found in session:', session.user.id);
          setUser(session.user);
          await fetchTodayData(session.user.id);
        } else {
          console.log('No user in session');
        }
      } catch (error) {
        console.error('Error in setupAuth:', error);
      }
    };

    setupAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event);
      setUser(session?.user ?? null);
      if (session?.user) {
        console.log('User found in auth change:', session.user.id);
        fetchTodayData(session.user.id);
      } else {
        console.log('No user in auth change');
      }
    });

    return () => {
      console.log('ProfileScreen cleanup...');
      subscription.unsubscribe();
    };
  }, []);

  const fetchTodayData = async (userId: string) => {
    console.log('fetchTodayData called for user:', userId);
    setIsLoadingData(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      console.log('Fetching data for date:', todayStr);

      // Fetch today's uncompleted tasks
      try {
        console.log('Starting tasks fetch...');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        console.log('Today\'s date string:', todayStr);

        // First, let's check what tasks exist for this user without any date filter
        const { data: allTasks, error: allTasksError } = await supabase
          .from('todos')
          .select('*')
          .eq('user_id', userId)
          .eq('completed', false);

        if (allTasksError) {
          console.error('Error fetching all tasks:', allTasksError);
        } else {
          console.log('All uncompleted tasks:', allTasks?.map(task => ({
            id: task.id,
            text: task.text,
            date: task.date,
            completed: task.completed
          })));
        }

        // Now fetch today's tasks with a more lenient date filter
        const { data: tasksData, error: tasksError } = await supabase
          .from('todos')
          .select(`
            id,
            text,
            completed,
            date,
            created_at,
            category_id,
            categories (
              label,
              color
            )
          `)
          .eq('user_id', userId)
          .eq('completed', false)
          .or(`date.eq.${todayStr},date.is.null,date.gte.${todayStr}`)
          .order('created_at', { ascending: false });

        if (tasksError) {
          console.error('Error fetching today\'s tasks:', {
            code: tasksError.code,
            message: tasksError.message,
            details: tasksError.details,
            query: {
              userId,
              todayStr,
              conditions: [
                'user_id = userId',
                'completed = false',
                `date = ${todayStr} OR date is null OR date >= ${todayStr}`
              ]
            }
          });
          throw tasksError;
        }

        console.log('Raw tasks data for today:', tasksData?.map(task => ({
          id: task.id,
          text: task.text,
          date: task.date,
          completed: task.completed,
          created_at: task.created_at
        })));

        if (!tasksData || tasksData.length === 0) {
          console.log('No tasks found for today. Query returned empty result.');
          // Let's check if there are any tasks at all
          const { data: anyTasks } = await supabase
            .from('todos')
            .select('id, text, date, completed')
            .eq('user_id', userId)
            .limit(1);
          console.log('Any tasks exist?', anyTasks);
          setTodayTasks([]);
        } else {
          // Transform tasks data
          const transformedTasks = tasksData.map(task => {
            console.log('Processing task:', {
              id: task.id,
              text: task.text,
              completed: task.completed,
              date: task.date,
              created_at: task.created_at,
              category: task.categories?.[0]
            });
            return {
              id: task.id,
              text: task.text,
              completed: task.completed,
              category_name: task.categories?.[0]?.label || 'Todo',
              category_color: task.categories?.[0]?.color || '#E0E0E0',
              date: task.date
            };
          });

          console.log('Setting todayTasks with:', transformedTasks);
          setTodayTasks(transformedTasks);
        }
      } catch (error) {
        console.error('Error in tasks fetch:', error);
        setTodayTasks([]);
      }

      // Fetch today's habits
      try {
        const { data: habitsData, error: habitsError } = await supabase
          .from('habits')
          .select(`
            id,
            text,
            completed_days,
            streak,
            category_id,
            categories (
              label,
              color
            )
          `)
          .eq('user_id', userId);

        if (habitsError) {
          console.error('Error fetching habits:', habitsError);
          throw habitsError;
        }
        console.log('Fetched habits:', habitsData);

        // Transform habits data
        const transformedHabits = (habitsData || []).map(habit => ({
          id: habit.id,
          text: habit.text,
          completed_days: habit.completed_days || [],
          category_name: habit.categories?.[0]?.label || 'Habit',
          category_color: habit.categories?.[0]?.color || '#E0E0E0',
          streak: habit.streak || 0
        }));
        setTodayHabits(transformedHabits);
      } catch (error) {
        console.error('Error fetching habits:', error);
        setTodayHabits([]);
      }

      // Fetch today's events
      try {
        console.log('Starting events fetch...');
        
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', userId)
          .gte('start_datetime', today.toISOString())
          .lt('start_datetime', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

        if (eventsError) {
          console.error('Error fetching events:', {
            code: eventsError.code,
            message: eventsError.message,
            details: eventsError.details,
            hint: eventsError.hint
          });
          setTodayEvents([]);
        } else {
          console.log('Raw events data:', eventsData);
          
          if (!eventsData || eventsData.length === 0) {
            console.log('No events found for today');
            setTodayEvents([]);
          } else {
            // Transform events data with basic information
            const transformedEvents: Event[] = eventsData.map(event => {
              console.log('Processing event:', event);
              return {
                id: event.id,
                title: event.title || 'Untitled Event',
                start_datetime: new Date(event.start_datetime),
                end_datetime: new Date(event.end_datetime || event.start_datetime),
                category_name: 'Event',
                category_color: '#E0E0E0'
              };
            });
            
            console.log('Transformed events:', transformedEvents);
            setTodayEvents(transformedEvents);
          }
        }
      } catch (error: any) {
        console.error('Unexpected error in events fetch:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        setTodayEvents([]);
      }

    } catch (error) {
      console.error('Error in fetchTodayData:', error);
      Alert.alert(
        'Error',
        'Some data could not be loaded. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSignIn = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await signInWithGoogle();
      
      if (error) {
        if (error.message === 'Sign in was cancelled') return;
        throw error;
      }

      if (data?.user) {
        setUser(data.user);
        fetchTodayData(data.user.id);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      }
    } catch (error: any) {
      console.error('Sign-in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await signOut();
        if (error) throw error;

      setUser(null);
      setTodayTasks([]);
      setTodayHabits([]);
      setTodayEvents([]);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      console.error('Sign-out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderTaskItem = (task: Task) => (
    <TouchableOpacity
      key={task.id}
      style={[styles.taskItem, { borderLeftColor: task.category_color || '#FF9A8B' }]}
    >
      <View style={styles.taskContent}>
        <Text style={styles.taskTitle}>{task.text}</Text>
        {task.category_name && (
          <View style={[styles.categoryTag, { backgroundColor: `${task.category_color}20` }]}>
            <Text style={[styles.categoryText, { color: task.category_color }]}>
              {task.category_name}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderHabitButton = (habit: Habit) => (
      <TouchableOpacity
      key={habit.id}
      style={[styles.habitButton, { backgroundColor: `${habit.category_color || '#FF9A8B'}20` }]}
    >
      <View style={styles.habitContent}>
        <Text style={[styles.habitText, { color: habit.category_color || '#FF9A8B' }]}>
          {habit.text}
        </Text>
        {(habit.streak ?? 0) > 0 && (
          <View style={styles.streakContainer}>
            <Ionicons name="flash" size={12} color={habit.category_color || '#FF9A8B'} />
            <Text style={[styles.streakText, { color: habit.category_color || '#FF9A8B' }]}>
              {habit.streak}
        </Text>
      </View>
            )}
          </View>
      {habit.completed_days.includes(new Date().toISOString().split('T')[0]) && (
        <View style={styles.completedIndicator}>
          <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
      )}
    </TouchableOpacity>
  );

  const renderEventItem = (event: Event) => (
    <TouchableOpacity
      key={event.id}
      style={[styles.eventItem, { borderLeftColor: event.category_color || '#FF9A8B' }]}
    >
      <View style={styles.eventTime}>
        <Text style={styles.eventTimeText}>
          {event.start_datetime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </Text>
        <Text style={styles.eventDuration}>
          {Math.round((event.end_datetime.getTime() - event.start_datetime.getTime()) / (1000 * 60))}m
        </Text>
      </View>
      <View style={styles.eventContent}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        {event.category_name && (
          <View style={[styles.categoryTag, { backgroundColor: `${event.category_color}20` }]}>
            <Text style={[styles.categoryText, { color: event.category_color }]}>
              {event.category_name}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.signInContainer}>
          <Image
            source={{ uri: defaultProfileImage }}
            style={styles.signInImage}
          />
          <Text style={styles.welcomeText}>Welcome!</Text>
          {isLoading ? (
            <ActivityIndicator size="large" color="#FF9A8B" />
          ) : (
            <GoogleSigninButton
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Light}
              onPress={handleSignIn}
              style={styles.signInButton}
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.profileInfo}>
            <Image
              source={{ uri: user?.user_metadata?.avatar_url || defaultProfileImage }}
              style={styles.avatar}
            />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {user?.user_metadata?.full_name || 'User'}
              </Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
          </View>
        <TouchableOpacity
          onPress={handleSignOut}
            style={styles.signOutButton}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FF3B30" />
          ) : (
              <Text style={styles.signOutText}>Sign Out</Text>
          )}
        </TouchableOpacity>
        </View>

        {/* Today's Overview */}
        <View style={styles.content}>
          {isLoadingData ? (
            <ActivityIndicator size="large" color="#FF9A8B" style={styles.loader} />
          ) : (
            <>
              {/* Tasks Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Today's Tasks</Text>
                {(() => {
                  console.log('Rendering tasks section, todayTasks:', todayTasks);
                  return todayTasks && todayTasks.length > 0 ? (
                    todayTasks.map(task => {
                      console.log('Rendering task:', task);
                      return renderTaskItem(task);
                    })
                  ) : (
                    <Text style={styles.emptyText}>No tasks for today</Text>
                  );
                })()}
              </View>

              {/* Habits Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Today's Habits</Text>
                <View style={styles.habitsContainer}>
                  {todayHabits.length > 0 ? (
                    todayHabits.map(renderHabitButton)
                  ) : (
                    <Text style={styles.emptyText}>No habits for today</Text>
                  )}
                    </View>
                </View>

              {/* Events Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Today's Events</Text>
                {todayEvents.length > 0 ? (
                  todayEvents.map(renderEventItem)
                ) : (
                  <Text style={styles.emptyText}>No events for today</Text>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollView: {
    flex: 1,
  },
  signInContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    backgroundColor: '#F5F5F5',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
    fontFamily: 'Onest',
  },
  signInButton: {
    marginTop: 8,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F5F5',
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'Onest',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Onest',
  },
  signOutButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF3B30',
    alignItems: 'center',
  },
  signOutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Onest',
  },
  content: {
    padding: 16,
  },
  loader: {
    marginTop: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
    fontFamily: 'Onest',
  },
  taskItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskTitle: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    fontFamily: 'Onest',
  },
  habitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  habitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
    position: 'relative',
  },
  habitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  habitText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Onest',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Onest',
  },
  eventItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventTime: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Onest',
  },
  eventDuration: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontFamily: 'Onest',
  },
  eventContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventTitle: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    fontFamily: 'Onest',
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Onest',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    fontFamily: 'Onest',
    marginTop: 8,
  },
  completedIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
