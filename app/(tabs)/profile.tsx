import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, StyleSheet, Platform, Alert, Animated, TextInput, Modal } from 'react-native';
import { User } from '@supabase/supabase-js';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../supabase';
import { configureGoogleSignIn, signInWithGoogle, signOut, getCurrentSession } from '../../auth';
import { useRouter } from 'expo-router';

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

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function ProfileScreen() {
  console.log('ProfileScreen component starting...');
  
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [todayHabits, setTodayHabits] = useState<Habit[]>([]);
  const [todayEvents, setTodayEvents] = useState<Event[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    tasks: true,
    habits: true,
    events: true,
    notes: true
  });
  const [animations] = useState({
    tasks: new Animated.Value(1),
    habits: new Animated.Value(1),
    events: new Animated.Value(1),
    notes: new Animated.Value(1)
  });
  const router = useRouter();

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
              category_name: task.categories?.[0]?.label || null,
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

      // Fetch notes
      await fetchNotes(userId);

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

  const fetchNotes = async (userId: string) => {
    try {
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (notesError) {
        console.error('Error fetching notes:', notesError);
      return;
    }

      setNotes(notesData || []);
    } catch (error) {
      console.error('Error in fetchNotes:', error);
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
      setNotes([]);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      console.error('Sign-out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (section: 'tasks' | 'habits' | 'events' | 'notes') => {
    const newExpanded = !expandedSections[section];
    setExpandedSections(prev => ({ ...prev, [section]: newExpanded }));
    
    Animated.timing(animations[section], {
      toValue: newExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: false
    }).start();
  };

  // Helper function to split note text into title and content
  const splitNoteText = (text: string) => {
    const lines = text.split('\n');
    const title = lines[0] || '';
    const content = lines.slice(1).join('\n');
    return { title, content };
  };

  // Helper function to combine title and content
  const combineNoteText = (title: string, content: string) => {
    return title + (content ? '\n' + content : '');
  };

  const renderSectionContent = (section: 'tasks' | 'habits' | 'events' | 'notes') => {
    const content = {
      tasks: (
        <>
          {isLoadingData ? (
            <ActivityIndicator size="small" color="#666" style={styles.sectionLoader} />
          ) : todayTasks.length > 0 ? (
            <View style={styles.sectionContent}>
              {todayTasks.map((task, index) => (
                <View key={task.id}>
                  <View style={styles.taskItem}>
                    <View style={styles.taskContent}>
                      <View style={[styles.taskDot, { backgroundColor: task.category_color }]} />
                      <Text style={styles.taskText} numberOfLines={1}>{task.text}</Text>
      </View>
                    {task.category_name && task.category_name !== 'Todo' && (
                      <Text style={[styles.categoryText, { color: task.category_color }]}>
                        {task.category_name}
                      </Text>
                    )}
        </View>
                  {index < todayTasks.length - 1 && <View style={styles.itemDivider} />}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No tasks for today</Text>
          )}
        </>
      ),
      habits: (
        <>
          {isLoadingData ? (
            <ActivityIndicator size="small" color="#666" style={styles.sectionLoader} />
          ) : todayHabits.length > 0 ? (
            <View style={styles.sectionContent}>
              {todayHabits.map((habit, index) => (
                <View key={habit.id}>
                  <View style={styles.habitItem}>
                    <View style={styles.habitContent}>
                      <View style={[styles.habitDot, { backgroundColor: habit.category_color }]} />
                      <Text style={styles.habitText} numberOfLines={1}>{habit.text}</Text>
        </View>
                    {(habit?.streak ?? 0) > 0 && (
                      <Text style={styles.streakText}>
                        {habit?.streak ?? 0} 🔥
                      </Text>
      )}
    </View>
                  {index < todayHabits.length - 1 && <View style={styles.itemDivider} />}
      </View>
              ))}
    </View>
          ) : (
            <Text style={styles.emptyText}>No habits for today</Text>
          )}
        </>
      ),
      events: (
        <>
          {isLoadingData ? (
            <ActivityIndicator size="small" color="#666" style={styles.sectionLoader} />
          ) : todayEvents.length > 0 ? (
            <View style={styles.sectionContent}>
              {todayEvents.map((event, index) => (
                <View key={event.id}>
                  <View style={styles.eventItem}>
                    <Text style={styles.eventTime}>
                      {event.start_datetime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </Text>
                    <View style={styles.eventContent}>
                      <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                      <Text style={styles.eventDuration}>
                        {Math.round((event.end_datetime.getTime() - event.start_datetime.getTime()) / (1000 * 60))}m
        </Text>
      </View>
    </View>
                  {index < todayEvents.length - 1 && <View style={styles.itemDivider} />}
      </View>
              ))}
    </View>
          ) : (
            <Text style={styles.emptyText}>No events for today</Text>
          )}
        </>
      ),
      notes: (
        <>
          {isLoadingData ? (
            <ActivityIndicator size="small" color="#666" style={styles.sectionLoader} />
          ) : (
            <View style={styles.sectionContent}>
              {notes.length > 0 ? (
                <>
                  {notes.map((note, index) => (
                    <View key={note.id}>
            <TouchableOpacity
                        style={styles.noteItem}
                onPress={() => {
                          // Implement note editing logic here
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.noteContent}>
                          <Text style={styles.noteTitle} numberOfLines={1}>
                            {note.title}
              </Text>
                          {note.content ? (
                            <Text style={styles.noteText} numberOfLines={2}>
                              {note.content}
              </Text>
                          ) : null}
          </View>
                        <TouchableOpacity
                          onPress={() => {
                            Alert.alert(
                              'Delete Note',
                              'Are you sure you want to delete this note?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { 
                                  text: 'Delete', 
                                  style: 'destructive',
                                  onPress: () => {
                                    // Implement note deletion logic here
                                  }
                                }
                              ]
                            );
                          }}
                          style={styles.noteDeleteButton}
                        >
                          <Ionicons name="trash-outline" size={16} color="#666" />
            </TouchableOpacity>
                      </TouchableOpacity>
                      {index < notes.length - 1 && <View style={styles.itemDivider} />}
          </View>
                  ))}
                </>
              ) : (
                <Text style={styles.emptyText}>No notes yet</Text>
          )}
        </View>
          )}
        </>
      )
    };

    return content[section];
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.signInContainer}>
          <LinearGradient
            colors={['#F8F9FA', '#FFFFFF']}
            style={styles.signInGradient}
          >
          <Image
            source={{ uri: defaultProfileImage }}
              style={styles.signInImage}
            />
            <Text style={styles.welcomeText}>Welcome</Text>
            <Text style={styles.signInSubtext}>Sign in to continue</Text>
          {isLoading ? (
              <ActivityIndicator size="small" color="#666" style={styles.signInLoader} />
          ) : (
            <GoogleSigninButton
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Light}
              onPress={handleSignIn}
                style={styles.signInButton}
            />
          )}
          </LinearGradient>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.headerContainer}>
          <LinearGradient
            colors={['#F8F9FA', '#FFFFFF']}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
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
              <View style={styles.headerActions}>
            <TouchableOpacity
                  onPress={() => router.push('/notes')}
                  style={styles.headerButton}
                >
                  <Ionicons name="document-text-outline" size={24} color="#666" />
            </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSignOut}
                  style={styles.headerButton}
        >
          {isLoading ? (
                    <ActivityIndicator size="small" color="#666" />
                  ) : (
                    <Ionicons name="log-out-outline" size={24} color="#666" />
          )}
        </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Today's Overview */}
        <View style={styles.overviewContainer}>
          {/* Tasks Section */}
          <View style={styles.sectionCard}>
            <TouchableOpacity 
              style={styles.sectionHeader} 
              onPress={() => toggleSection('tasks')}
              activeOpacity={0.7}
            >
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="checkbox-outline" size={16} color="#666" />
                <Text style={styles.sectionTitle}>Tasks</Text>
              </View>
              <View style={styles.sectionHeaderRight}>
                <Text style={styles.sectionCount}>{todayTasks.length}</Text>
                <Animated.View style={{
                  transform: [{
                    rotate: animations.tasks.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-90deg', '0deg']
                    })
                  }]
                }}>
                  <Ionicons name="chevron-down" size={16} color="#666" />
                </Animated.View>
          </View>
            </TouchableOpacity>
            <Animated.View style={{
              maxHeight: animations.tasks.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1000]
              }),
              opacity: animations.tasks,
              overflow: 'hidden'
            }}>
              {renderSectionContent('tasks')}
            </Animated.View>
        </View>

          {/* Habits Section */}
          <View style={styles.sectionCard}>
                  <TouchableOpacity
              style={styles.sectionHeader} 
              onPress={() => toggleSection('habits')}
              activeOpacity={0.7}
                  >
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="repeat-outline" size={16} color="#666" />
                <Text style={styles.sectionTitle}>Habits</Text>
                </View>
              <View style={styles.sectionHeaderRight}>
                <Text style={styles.sectionCount}>{todayHabits.length}</Text>
                <Animated.View style={{
                  transform: [{
                    rotate: animations.habits.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-90deg', '0deg']
                    })
                  }]
                }}>
                  <Ionicons name="chevron-down" size={16} color="#666" />
                </Animated.View>
                    </View>
                  </TouchableOpacity>
            <Animated.View style={{
              maxHeight: animations.habits.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1000]
              }),
              opacity: animations.habits,
              overflow: 'hidden'
            }}>
              {renderSectionContent('habits')}
            </Animated.View>
                </View>

          {/* Events Section */}
          <View style={styles.sectionCard}>
                <TouchableOpacity
              style={styles.sectionHeader} 
              onPress={() => toggleSection('events')}
              activeOpacity={0.7}
                  >
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="calendar-outline" size={16} color="#666" />
                <Text style={styles.sectionTitle}>Events</Text>
                </View>
              <View style={styles.sectionHeaderRight}>
                <Text style={styles.sectionCount}>{todayEvents.length}</Text>
                <Animated.View style={{
                  transform: [{
                    rotate: animations.events.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-90deg', '0deg']
                    })
                  }]
                }}>
                  <Ionicons name="chevron-down" size={16} color="#666" />
                </Animated.View>
                    </View>
                </TouchableOpacity>
            <Animated.View style={{
              maxHeight: animations.events.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1000]
              }),
              opacity: animations.events,
              overflow: 'hidden'
            }}>
              {renderSectionContent('events')}
            </Animated.View>
              </View>
            </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  headerContainer: {
    marginBottom: 32,
  },
  headerGradient: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8F9FA',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: '500',
    color: '#1A1A1A',
    fontFamily: 'Onest',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
    fontFamily: 'Onest',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  overviewContainer: {
    paddingHorizontal: 12,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
    fontFamily: 'Onest',
  },
  sectionCount: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Onest',
  },
  sectionContent: {
    gap: 0,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  taskContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  taskText: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    fontFamily: 'Onest',
  },
  categoryText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Onest',
  },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  habitContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  habitDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  habitText: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    fontFamily: 'Onest',
  },
  streakText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Onest',
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  eventTime: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Onest',
    width: 60,
  },
  eventContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventTitle: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    fontFamily: 'Onest',
  },
  eventDuration: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Onest',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 13,
    fontFamily: 'Onest',
    marginVertical: 12,
  },
  signInContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  signInGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  signInImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
    backgroundColor: '#F8F9FA',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 4,
    fontFamily: 'Onest',
  },
  signInSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    fontFamily: 'Onest',
  },
  signInButton: {
    marginTop: 8,
  },
  signInLoader: {
    marginTop: 8,
  },
  sectionLoader: {
    marginVertical: 20,
  },
  noteItem: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  noteContent: {
    flex: 1,
    marginRight: 32,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 4,
    fontFamily: 'Onest',
  },
  noteText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Onest',
  },
  noteDeleteButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
});

