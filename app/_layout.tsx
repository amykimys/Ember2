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
import { Colors } from '@/constants/Colors';
import * as Linking from 'expo-linking';
import { supabase, checkSessionStatus } from '../supabase';
import { Session } from '@supabase/supabase-js';
import 'react-native-reanimated';
import * as Font from 'expo-font';
import { View } from 'react-native';
import LoadingScreen from '@/components/LoadingScreen';
import { checkAndMoveTasksIfNeeded } from '../utils/taskUtils';
import { DataProvider, useData } from '../contexts/DataContext';
import { AppState } from 'react-native';

SplashScreen.preventAutoHideAsync();

// Data preloading interface
interface PreloadProgress {
  current: number;
  total: number;
  currentTask: string;
}

function AppContent() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState<PreloadProgress>({
    current: 0,
    total: 12,
    currentTask: 'Initializing...'
  });
  
  const { setData } = useData();
  
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Onest': require('../assets/fonts/Onest-Regular.ttf'),
    'Onest-Bold': require('../assets/fonts/Onest-Bold.ttf'),
    'Onest-Medium': require('../assets/fonts/Onest-Medium.ttf'),
  });

  // Comprehensive data preloading function
  const preloadAppData = async (userId: string) => {
    const tasks = [
      { name: 'User Profile', fn: () => preloadUserProfile(userId) },
      { name: 'User Preferences', fn: () => preloadUserPreferences(userId) },
      { name: 'Categories', fn: () => preloadCategories(userId) },
      { name: 'Auto-move Tasks', fn: async () => {
        await checkAndMoveTasksIfNeeded(userId);
        // Longer delay to ensure database changes are committed
        await new Promise(resolve => setTimeout(resolve, 500));
      }},
      { name: 'Tasks & Habits', fn: () => preloadTasksAndHabits(userId) },
      { name: 'Calendar Events', fn: () => preloadCalendarEvents(userId) },
      { name: 'Shared Events', fn: () => preloadSharedEvents(userId) },
      { name: 'Notes', fn: () => preloadNotes(userId) },
      { name: 'Shared Notes', fn: () => preloadSharedNotes(userId) },
      { name: 'Shared Note IDs', fn: () => preloadSharedNoteIds(userId) },
      { name: 'Friends & Requests', fn: () => preloadFriendsAndRequests(userId) },
      { name: 'Social Updates', fn: () => preloadSocialUpdates(userId) },
      { name: 'Final Data Refresh', fn: async () => {
        // Final refresh to ensure we have the latest data after all processing
        await new Promise(resolve => setTimeout(resolve, 200));
        return await preloadTasksAndHabits(userId);
      }},
      { name: 'Finalizing...', fn: () => new Promise(resolve => setTimeout(resolve, 300)) }
    ];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      setPreloadProgress({
        current: i,
        total: tasks.length,
        currentTask: task.name
      });

      try {
        const result = await task.fn();
        console.log(`✅ Preloaded: ${task.name}`);
        
        // Store the result in context based on task type
        if (task.name === 'User Profile') {
          setData(prev => ({ ...prev, userProfile: result }));
        } else if (task.name === 'User Preferences') {
          setData(prev => ({ ...prev, userPreferences: result }));
        } else if (task.name === 'Tasks & Habits') {
          setData(prev => ({ 
            ...prev, 
            todos: result.tasks || [], 
            habits: result.habits || [] 
          }));
        } else if (task.name === 'Final Data Refresh') {
          // Use the final refresh data to ensure we have the latest
          setData(prev => ({ 
            ...prev, 
            todos: result.tasks || [], 
            habits: result.habits || [] 
          }));
        } else if (task.name === 'Calendar Events') {
          setData(prev => ({ ...prev, events: result || [] }));
        } else if (task.name === 'Shared Events') {
          setData(prev => ({ ...prev, sharedEvents: result || [] }));
        } else if (task.name === 'Notes') {
          setData(prev => ({ ...prev, notes: result || [] }));
        } else if (task.name === 'Shared Notes') {
          setData(prev => ({ ...prev, sharedNotes: result || [] }));
        } else if (task.name === 'Shared Note IDs') {
          setData(prev => ({ 
            ...prev, 
            sharedNoteIds: result.sharedNoteIds || [], 
            sharedNoteDetails: result.sharedNoteDetails || {} 
          }));
        } else if (task.name === 'Friends & Requests') {
          setData(prev => ({ 
            ...prev, 
            friends: result.friends || [], 
            friendRequests: result.requests || [] 
          }));
        } else if (task.name === 'Social Updates') {
          setData(prev => ({ ...prev, socialUpdates: result || [] }));
        } else if (task.name === 'Categories') {
          setData(prev => ({ ...prev, categories: result || [] }));
        } else if (task.name === 'Auto-move Tasks') {
          console.log('✅ Auto-move tasks completed');
          // Don't store result in context, just log completion
        }
      } catch (error) {
        console.error(`❌ Failed to preload ${task.name}:`, error);
      }
    }

    // Mark data as preloaded
    setData(prev => ({ 
      ...prev, 
      isPreloaded: true, 
      lastUpdated: new Date() 
    }));

    setPreloadProgress({
      current: tasks.length,
      total: tasks.length,
      currentTask: 'Complete!'
    });
  };

  // Simple loading for unauthenticated users
  const handleSimpleLoading = () => {
    setPreloadProgress({
      current: 1,
      total: 1,
      currentTask: 'Loading...'
    });
    
    setTimeout(() => {
      setPreloadProgress({
        current: 1,
        total: 1,
        currentTask: 'Complete!'
      });
    }, 1000);
  };

  // Preload user profile
  const preloadUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  };

  // Preload user preferences
  const preloadUserPreferences = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return data;
  };

  // Preload tasks and habits
  const preloadTasksAndHabits = async (userId: string) => {
    console.log('🔄 Preloading tasks and habits for user:', userId);
    
    const [tasksResult, habitsResult] = await Promise.all([
      supabase
        .from('todos')
        .select(`
          *,
          category:category_id (
            id,
            label,
            color
          )
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }), // Use updated_at for more recent changes
      supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }) // Use updated_at for more recent changes
    ]);

    if (tasksResult.error) throw tasksResult.error;
    if (habitsResult.error) throw habitsResult.error;
    
    // Handle shared tasks the same way as the todo screen
    let filteredTasks = tasksResult.data || [];
    
    if (tasksResult.data && tasksResult.data.length > 0) {
      // Get all shared task relationships for this user
      const { data: sharedTasks, error: sharedError } = await supabase
        .from('shared_tasks')
        .select('original_task_id, shared_by, shared_with, copied_task_id')
        .or(`shared_by.eq.${userId},shared_with.eq.${userId}`);

      if (sharedError) {
        console.error('Error fetching shared tasks during preload:', sharedError);
      } else if (sharedTasks && sharedTasks.length > 0) {
        // Create a map to track which tasks should be shown
        const tasksToShow = new Set<string>();
        const tasksToHide = new Set<string>();

        // Process shared tasks to determine which tasks to show/hide
        sharedTasks.forEach(sharedTask => {
          const originalTaskId = sharedTask.original_task_id;
          const copiedTaskId = sharedTask.copied_task_id;
          
          if (sharedTask.shared_by === userId) {
            // You're the sender - show the original task
            tasksToShow.add(originalTaskId);
            if (copiedTaskId) {
              tasksToHide.add(copiedTaskId);
            }
          } else if (sharedTask.shared_with === userId) {
            // You're the recipient - show the copied task, hide the original
            if (copiedTaskId) {
              tasksToShow.add(copiedTaskId);
            }
            tasksToHide.add(originalTaskId);
          }
        });

        // Filter tasks to only show the appropriate ones
        filteredTasks = tasksResult.data.filter((task: any) => {
          if (tasksToHide.has(task.id)) {
            return false; // Hide this task
          }
          if (tasksToShow.has(task.id)) {
            return true; // Show this task
          }
          // For tasks not involved in sharing, show them normally
          return true;
        });
      }
    }
    
    // Populate shared friends for tasks (same as fetchSharedFriendsForTasks)
    if (filteredTasks.length > 0) {
      try {
        const taskIds = filteredTasks.map((task: any) => task.id);
        console.log('🔄 Preloading shared friends for', taskIds.length, 'tasks');
        
        // Get all shared task relationships for this user
        const { data: sharedTasks, error } = await supabase
          .from('shared_tasks')
          .select(`
            original_task_id,
            shared_by,
            shared_with,
            status,
            copied_task_id
          `)
          .or(`shared_by.eq.${userId},shared_with.eq.${userId}`);

        if (error) {
          console.error('❌ Error fetching shared tasks during preload:', error);
        } else if (sharedTasks && sharedTasks.length > 0) {
          console.log('🔄 All shared tasks for user:', sharedTasks.length);
          
          // For tasks you received, we need to find the actual copied task IDs
          const { data: copiedTasks, error: copiedTasksError } = await supabase
            .from('todos')
            .select('id, text')
            .eq('user_id', userId)
            .in('id', taskIds)
            .like('id', 'shared-%');

          if (copiedTasksError) {
            console.error('❌ Error fetching copied tasks during preload:', copiedTasksError);
          }

          console.log('🔄 Copied tasks found:', copiedTasks?.length || 0);

          // Filter to only include tasks that are in the current user's task list
          const relevantSharedTasks = sharedTasks.filter(sharedTask => {
            // If you're the sender, check if the original task is in your current task list
            if (sharedTask.shared_by === userId) {
              return taskIds.includes(sharedTask.original_task_id);
            }
            // If you're the recipient, we'll include all shared tasks where you're the recipient
            if (sharedTask.shared_with === userId) {
              return true;
            }
            return false;
          });

          console.log('🔄 Relevant shared tasks after filtering:', relevantSharedTasks.length);

          if (relevantSharedTasks.length > 0) {
            // Get all unique friend IDs involved in these tasks
            const friendIds = new Set<string>();
            relevantSharedTasks.forEach(sharedTask => {
              if (sharedTask.shared_by !== userId) {
                friendIds.add(sharedTask.shared_by);
              }
              if (sharedTask.shared_with !== userId) {
                friendIds.add(sharedTask.shared_with);
              }
            });

            console.log('🔄 Friend IDs found:', Array.from(friendIds));

            // Fetch friend profiles
            const { data: friendProfiles, error: profilesError } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url, username')
              .in('id', Array.from(friendIds));

            if (profilesError) {
              console.error('❌ Error fetching friend profiles during preload:', profilesError);
            } else if (friendProfiles) {
              console.log('🔄 Friend profiles found:', friendProfiles.length);

              // Create a map of friend profiles
              const friendProfilesMap = new Map();
              friendProfiles.forEach(profile => {
                friendProfilesMap.set(profile.id, {
                  friend_id: profile.id,
                  friend_name: profile.full_name || 'Unknown',
                  friend_avatar: profile.avatar_url || '',
                  friend_username: profile.username || '',
                });
              });

              // Group all participants by task (both senders and recipients)
              const taskParticipantsMap: Record<string, Array<{
                friend_id: string;
                friend_name: string;
                friend_avatar: string;
                friend_username: string;
                role: 'sender' | 'recipient';
              }>> = {};

              relevantSharedTasks.forEach(sharedTask => {
                const taskId = sharedTask.original_task_id;
                if (!taskParticipantsMap[taskId]) {
                  taskParticipantsMap[taskId] = [];
                }

                // If you're the recipient, show the sender
                if (sharedTask.shared_with === userId && sharedTask.shared_by !== userId) {
                  const senderProfile = friendProfilesMap.get(sharedTask.shared_by);
                  if (senderProfile && !taskParticipantsMap[taskId].some(p => p.friend_id === senderProfile.friend_id)) {
                    taskParticipantsMap[taskId].push({
                      ...senderProfile,
                      role: 'sender'
                    });
                  }
                }

                // If you're the sender, show the recipients
                if (sharedTask.shared_by === userId && sharedTask.shared_with !== userId) {
                  const recipientProfile = friendProfilesMap.get(sharedTask.shared_with);
                  if (recipientProfile && !taskParticipantsMap[taskId].some(p => p.friend_id === recipientProfile.friend_id)) {
                    taskParticipantsMap[taskId].push({
                      ...recipientProfile,
                      role: 'recipient'
                    });
                  }
                }
              });

              // Convert to the format expected by the UI
              const taskFriendsMap: Record<string, Array<{
                friend_id: string;
                friend_name: string;
                friend_avatar: string;
                friend_username: string;
              }>> = {};

              // For tasks you sent: use original_task_id as key
              // For tasks you received: use copied_task_id for accurate mapping
              relevantSharedTasks.forEach(sharedTask => {
                const originalTaskId = sharedTask.original_task_id;
                
                if (sharedTask.shared_by === userId) {
                  // You're the sender - use original task ID as key
                  if (taskParticipantsMap[originalTaskId]) {
                    taskFriendsMap[originalTaskId] = taskParticipantsMap[originalTaskId].map(participant => ({
                      friend_id: participant.friend_id,
                      friend_name: participant.friend_name,
                      friend_avatar: participant.friend_avatar,
                      friend_username: participant.friend_username,
                    }));
                  }
                } else if (sharedTask.shared_with === userId) {
                  // You're the recipient - show the sender using copied_task_id
                  const senderProfile = friendProfilesMap.get(sharedTask.shared_by);
                  if (senderProfile && sharedTask.copied_task_id) {
                    // Use the copied_task_id to map to the specific task
                    if (taskIds.includes(sharedTask.copied_task_id)) {
                      taskFriendsMap[sharedTask.copied_task_id] = [{
                        friend_id: senderProfile.friend_id,
                        friend_name: senderProfile.friend_name,
                        friend_avatar: senderProfile.friend_avatar,
                        friend_username: senderProfile.friend_username,
                      }];
                      console.log('✅ Preloaded shared friends for copied task:', sharedTask.copied_task_id, 'from sender:', senderProfile.friend_name);
                    }
                  } else if (senderProfile && !sharedTask.copied_task_id) {
                    // Fallback for tasks shared before the copied_task_id field was added
                    console.log('🔄 No copied_task_id found for shared task, using fallback mapping');
                    copiedTasks?.forEach(copiedTask => {
                      if (taskIds.includes(copiedTask.id) && !taskFriendsMap[copiedTask.id]) {
                        taskFriendsMap[copiedTask.id] = [{
                          friend_id: senderProfile.friend_id,
                          friend_name: senderProfile.friend_name,
                          friend_avatar: senderProfile.friend_avatar,
                          friend_username: senderProfile.friend_username,
                        }];
                      }
                    });
                  }
                }
              });

              console.log('🔄 Final task friends map:', taskFriendsMap);

              // Apply shared friends to tasks
              filteredTasks.forEach((task: any) => {
                const taskFriends = taskFriendsMap[task.id];
                if (taskFriends && taskFriends.length > 0) {
                  task.sharedFriends = taskFriends;
                  console.log('✅ Preloaded shared friends for task:', task.id, 'Friends:', taskFriends.length);
                }
              });
            }
          }
        }
      } catch (error) {
        console.error('❌ Error populating shared friends during preload:', error);
      }
    }
    
    // Apply the same field mapping as the todo screen
    const mappedTasks = filteredTasks.map((task: any) => ({
      ...task,
      date: task.date ? new Date(task.date) : new Date(),
      repeatEndDate: task.repeat_end_date ? new Date(task.repeat_end_date) : null,
      reminderTime: task.reminder_time ? new Date(task.reminder_time) : null,
      customRepeatDates: task.custom_repeat_dates ? task.custom_repeat_dates.map((date: string) => new Date(date)) : [],
      deletedInstances: task.deleted_instances || [],
      categoryId: task.category_id,
      category: task.category || null, // Include category object from join
      photo: task.photo,
      autoMove: task.auto_move || false,
      sharedFriends: task.sharedFriends || [] // Preserve shared friends data
    }));
    
    // Count tasks with shared friends
    const tasksWithSharedFriends = mappedTasks.filter(task => task.sharedFriends && task.sharedFriends.length > 0);
    console.log('✅ Preloaded tasks (after shared filtering):', mappedTasks.length);
    console.log('✅ Tasks with shared friends:', tasksWithSharedFriends.length);
    console.log('✅ Preloaded habits:', habitsResult.data?.length || 0);
    console.log('🔄 Preload timestamp:', new Date().toISOString());
    
    return { tasks: mappedTasks, habits: habitsResult.data };
  };

  // Preload calendar events
  const preloadCalendarEvents = async (userId: string) => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true });
    
    if (error) throw error;
    return data;
  };

  // Preload notes
  const preloadNotes = async (userId: string) => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data;
  };

  // Preload friends and friend requests
  const preloadFriendsAndRequests = async (userId: string) => {
    const [friendsResult, requestsResult] = await Promise.all([
      supabase
        .from('friendships')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'accepted'),
      supabase
        .from('friendships')
        .select('*')
        .eq('friend_id', userId)
        .eq('status', 'pending')
    ]);

    if (friendsResult.error) throw friendsResult.error;
    if (requestsResult.error) throw requestsResult.error;
    
    // Get user profiles for friends and requests
    const friendIds = friendsResult.data?.map(f => f.friend_id) || [];
    const requesterIds = requestsResult.data?.map(r => r.requester_id) || [];
    const allUserIds = [...friendIds, ...requesterIds];
    
    let userProfiles: { [key: string]: { id: string; full_name: string; username: string; avatar_url: string } } = {};
    if (allUserIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', allUserIds);
      
      if (!profilesError && profilesData) {
        userProfiles = profilesData.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as { [key: string]: { id: string; full_name: string; username: string; avatar_url: string } });
      }
    }
    
    // Combine friendships with profile data
    const friendsWithProfiles = friendsResult.data?.map(friendship => ({
      ...friendship,
      profiles: userProfiles[friendship.friend_id] || null
    })) || [];
    
    const requestsWithProfiles = requestsResult.data?.map(friendship => ({
      ...friendship,
      profiles: userProfiles[friendship.requester_id] || null
    })) || [];
    
    return { friends: friendsWithProfiles, requests: requestsWithProfiles };
  };

  // Preload social updates (friends feed)
  const preloadSocialUpdates = async (userId: string) => {
    const { data, error } = await supabase
      .from('social_updates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50); // Limit to recent updates
    
    if (error) throw error;
    
    // Get user profiles for social updates
    const userIds = data?.map(update => update.user_id) || [];
    let userProfiles: { [key: string]: { id: string; full_name: string; username: string; avatar_url: string } } = {};
    
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);
      
      if (!profilesError && profilesData) {
        userProfiles = profilesData.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as { [key: string]: { id: string; full_name: string; username: string; avatar_url: string } });
      }
    }
    
    // Combine social updates with profile data
    const updatesWithProfiles = data?.map(update => ({
      ...update,
      profiles: userProfiles[update.user_id] || null
    })) || [];
    
    return updatesWithProfiles;
  };

  // Preload categories
  const preloadCategories = async (userId: string) => {
    console.log('🔄 Preloading categories for user:', userId);
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .in('type', ['todo', 'task']) // Fetch both 'todo' and 'task' types (same as todo screen)
      .order('created_at', { ascending: false }); // Use descending order to match todo screen
    
    if (error) throw error;
    
    console.log('✅ Preloaded categories:', data?.length || 0);
    return data;
  };

  // Preload shared events
  const preloadSharedEvents = async (userId: string) => {
    try {
      // First, try to get shared events where user is the sharer
      const { data: sharedByUser, error: error1 } = await supabase
        .from('shared_events')
        .select('*')
        .eq('shared_by', userId);
      
      // Then, try to get shared events where user is the recipient
      const { data: sharedWithUser, error: error2 } = await supabase
        .from('shared_events')
        .select('*')
        .contains('shared_with', [userId]);
      
      if (error1 || error2) {
        console.log('⚠️ Shared events table might not exist or have different structure');
        return [];
      }
      
      // Combine both results
      const allSharedEvents = [
        ...(sharedByUser || []),
        ...(sharedWithUser || [])
      ];
      
      if (allSharedEvents.length === 0) {
        return [];
      }
      
      // Get event details and user profiles
      const eventIds = allSharedEvents.map(se => se.event_id).filter(Boolean);
      const userIds = allSharedEvents.map(se => se.shared_by).filter(Boolean);
      
      let events: { [key: string]: any } = {};
      let userProfiles: { [key: string]: { id: string; full_name: string; username: string; avatar_url: string } } = {};
      
      if (eventIds.length > 0) {
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .in('id', eventIds);
        
        if (!eventsError && eventsData) {
          events = eventsData.reduce((acc, event) => {
            acc[event.id] = event;
            return acc;
          }, {} as { [key: string]: any });
        }
      }
      
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);
        
        if (!profilesError && profilesData) {
          userProfiles = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {} as { [key: string]: { id: string; full_name: string; username: string; avatar_url: string } });
        }
      }
      
      // Combine shared events with event and profile data
      const sharedEventsWithDetails = allSharedEvents.map(sharedEvent => ({
        ...sharedEvent,
        events: events[sharedEvent.event_id] || null,
        profiles: userProfiles[sharedEvent.shared_by] || null
      }));
      
      return sharedEventsWithDetails;
    } catch (error) {
      console.error('❌ Error preloading shared events:', error);
      return [];
    }
  };

  // Preload shared notes
  const preloadSharedNotes = async (userId: string) => {
    try {
      // First, try to get shared notes where user is the sharer
      const { data: sharedByUser, error: error1 } = await supabase
        .from('shared_notes')
        .select('*')
        .eq('shared_by', userId);
      
      // Then, try to get shared notes where user is the recipient
      const { data: sharedWithUser, error: error2 } = await supabase
        .from('shared_notes')
        .select('*')
        .contains('shared_with', [userId]);
      
      if (error1 || error2) {
        console.log('⚠️ Shared notes table might not exist or have different structure');
        return [];
      }
      
      // Combine both results
      const allSharedNotes = [
        ...(sharedByUser || []),
        ...(sharedWithUser || [])
      ];
      
      if (allSharedNotes.length === 0) {
        return [];
      }
      
      // Get note details and user profiles
      const noteIds = allSharedNotes.map(sn => sn.original_note_id).filter(Boolean);
      const userIds = allSharedNotes.map(sn => sn.shared_by).filter(Boolean);
      
      let notes: { [key: string]: any } = {};
      let userProfiles: { [key: string]: { id: string; full_name: string; username: string; avatar_url: string } } = {};
      
      if (noteIds.length > 0) {
        const { data: notesData, error: notesError } = await supabase
          .from('notes')
          .select('*')
          .in('id', noteIds);
        
        if (!notesError && notesData) {
          notes = notesData.reduce((acc, note) => {
            acc[note.id] = note;
            return acc;
          }, {} as { [key: string]: any });
        }
      }
      
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);
        
        if (!profilesError && profilesData) {
          userProfiles = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {} as { [key: string]: { id: string; full_name: string; username: string; avatar_url: string } });
        }
      }
      
      // Combine shared notes with note and profile data
      const sharedNotesWithDetails = allSharedNotes.map(sharedNote => ({
        ...sharedNote,
        notes: notes[sharedNote.original_note_id] || null,
        profiles: userProfiles[sharedNote.shared_by] || null
      }));
      
      return sharedNotesWithDetails;
    } catch (error) {
      console.error('❌ Error preloading shared notes:', error);
      return [];
    }
  };

  // Preload shared note IDs and details
  const preloadSharedNoteIds = async (userId: string) => {
    try {
      console.log('🔄 Preloading shared note IDs for user:', userId);
      
      // Get shared notes where user is the sharer
      const { data, error } = await supabase
        .from('shared_notes')
        .select(`
          original_note_id,
          shared_with
        `)
        .eq('shared_by', userId);

      if (error) {
        console.log('⚠️ Shared notes table might not exist');
        return { sharedNoteIds: [], sharedNoteDetails: {} };
      }

      if (!data || data.length === 0) {
        return { sharedNoteIds: [], sharedNoteDetails: {} };
      }

      const sharedIds = new Set<string>();
      const sharedDetails: { [noteId: string]: string[] } = {};

      // Get unique friend IDs to fetch their names
      const friendIds = Array.from(new Set(data.map(item => item.shared_with)));
      
      if (friendIds.length > 0) {
        // Fetch friend names
        const { data: friendData, error: friendError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', friendIds);

        if (!friendError && friendData) {
          // Create a map of friend ID to name
          const friendNameMap = new Map(
            friendData.map(friend => [friend.id, friend.full_name])
          );

          // Process shared notes data
          data.forEach(item => {
            const noteId = item.original_note_id;
            const friendName = friendNameMap.get(item.shared_with) || 'Unknown';
            
            sharedIds.add(noteId);
            
            if (sharedDetails[noteId]) {
              sharedDetails[noteId].push(friendName);
            } else {
              sharedDetails[noteId] = [friendName];
            }
          });
        }
      }

      console.log('✅ Preloaded shared note IDs:', sharedIds.size);
      return { 
        sharedNoteIds: Array.from(sharedIds), 
        sharedNoteDetails: sharedDetails 
      };
    } catch (error) {
      console.error('❌ Error preloading shared note IDs:', error);
      return { sharedNoteIds: [], sharedNoteDetails: {} };
    }
  };

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
          handleSimpleLoading();
        } else if (session) {
          console.log('✅ Session restored successfully:', {
            email: session.user?.email,
            userId: session.user?.id,
            expiresAt: session.expires_at,
            isExpired: session.expires_at ? new Date(session.expires_at * 1000) < new Date() : false
          });
          setSession(session);
          
          // Preload all app data when user is authenticated
          if (session.user) {
            console.log('🔄 Preloading app data for authenticated user...');
            await preloadAppData(session.user.id);
          }
          
          // Additional session validation
          const sessionStatus = await checkSessionStatus();
          console.log('🔍 Session validation result:', sessionStatus);
        } else {
          console.log('ℹ️ No existing session found - user not authenticated');
          setSession(null);
          handleSimpleLoading();
        }
      } catch (error) {
        console.error('❌ Error initializing session:', error);
        setSession(null);
        handleSimpleLoading();
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
      
      // Handle different auth events
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('🎉 User signed in successfully - preloading app data...');
        await preloadAppData(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out - clearing data and using simple loading');
        setData(prev => ({ 
          ...prev, 
          isPreloaded: false, 
          lastUpdated: null 
        }));
        handleSimpleLoading();
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed successfully');
      } else if (event === 'USER_UPDATED') {
        console.log('👤 User profile updated');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Add periodic check for auto-move tasks (every hour)
  useEffect(() => {
    if (!session?.user) return;

    const checkInterval = setInterval(async () => {
      console.log('⏰ Periodic auto-move check...');
      await checkAndMoveTasksIfNeeded(session.user.id);
    }, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(checkInterval);
  }, [session?.user]);

  // Add robust AppState handler for session and data refresh
  useEffect(() => {
    if (!session?.user) return;

    let lastActiveTimestamp = Date.now();

    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === 'active') {
        const now = Date.now();
        const timeAway = now - lastActiveTimestamp;
        lastActiveTimestamp = now;
        // If away for more than 10 minutes, treat as a long absence
        if (timeAway > 10 * 60 * 1000) {
          console.log('⏰ App was backgrounded for a long time, checking session and refreshing data...');
          try {
            // Check session validity
            const { data: { session: freshSession }, error } = await supabase.auth.getSession();
            if (error || !freshSession) {
              console.warn('⚠️ Session expired or error occurred. Logging out user.');
              setSession(null);
              setData(prev => ({ ...prev, isPreloaded: false, lastUpdated: null }));
              handleSimpleLoading();
              return;
            }
            setSession(freshSession);
            await preloadAppData(freshSession.user.id);
            console.log('✅ Data and session refreshed after long background.');
          } catch (err) {
            console.error('❌ Error during session/data refresh after long background:', err);
          }
        } else {
          // Short absence, just refresh data
          try {
            await preloadAppData(session.user.id);
            console.log('✅ Data refreshed after short background.');
          } catch (err) {
            console.error('❌ Error refreshing data after short background:', err);
          }
        }
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        lastActiveTimestamp = Date.now();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [session?.user]);

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
    return <LoadingScreen onLoadingComplete={handleLoadingComplete} progress={preloadProgress} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: Colors[colorScheme ?? 'light'].background,
              },
              headerTitleStyle: {
                fontFamily: 'Onest-Medium',
                color: Colors[colorScheme ?? 'light'].text,
              },
              headerTintColor: Colors[colorScheme ?? 'light'].text,
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}