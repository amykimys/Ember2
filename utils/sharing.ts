import { supabase } from '../supabase';
import Toast from 'react-native-toast-message';
import { sendEventSharedNotification, sendTaskSharedNotification } from './notificationUtils';

export interface ShareData {
  originalId: string;
  sharedBy: string;
  sharedWith: string;
  type: 'task' | 'habit' | 'event';
}

export interface SharedTask {
  shared_task_id: string;
  original_task_id: string;
  task_text: string;
  task_description: string;
  task_completed: boolean;
  task_date: string;
  shared_by_name: string;
  shared_by_avatar: string;
  shared_by_username: string;
  shared_at: string;
  status: string;
}

export interface SharedHabit {
  shared_habit_id: string;
  original_habit_id: string;
  habit_text: string;
  habit_description: string;
  habit_completed_today: boolean;
  habit_streak: number;
  shared_by_name: string;
  shared_by_avatar: string;
  shared_by_username: string;
  shared_at: string;
  status: string;
}

export interface SharedEvent {
  id: string;
  originalEventId: string;
  sharedBy: string;
  sharedWith: string;
  status: 'pending' | 'accepted' | 'declined';
  message?: string;
  createdAt: string;
  updatedAt: string;
  // Flags to indicate the current user's role
  isCurrentUserSender: boolean;
  isCurrentUserRecipient: boolean;
  event: {
    id: string;
    title: string;
    description?: string;
    location?: string;
    date: string;
    startDateTime?: string;
    endDateTime?: string;
    categoryName?: string;
    categoryColor?: string;
    isAllDay: boolean;
    photos?: string[];
  };
  sharerProfile?: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
}

// Share task with friend
export const shareTaskWithFriend = async (taskId: string, friendId: string, userId: string) => {
  console.log('🔍 shareTaskWithFriend: Starting to share task');
  console.log('🔍 shareTaskWithFriend: Task ID:', taskId);
  console.log('🔍 shareTaskWithFriend: Friend ID:', friendId);
  console.log('🔍 shareTaskWithFriend: User ID:', userId);
  
  try {
    // Get task details for notification
    const { data: taskData, error: taskError } = await supabase
      .from('todos')
      .select('text')
      .eq('id', taskId)
      .single();

    if (taskError) {
      console.error('Error fetching task details:', taskError);
      // Don't throw error here, continue with sharing
    }

    const { error } = await supabase.rpc('share_task_with_friend', {
      p_task_id: taskId,
      p_user_id: userId,
      p_friend_id: friendId
    });

    if (error) {
      console.error('❌ shareTaskWithFriend: Error sharing task:', error);
      throw error;
    }

    console.log('✅ shareTaskWithFriend: Task shared successfully');

    // Send notification to the friend (optional, don't fail if it doesn't work)
    // Don't send notification if sharing with yourself
    if (taskData?.text && friendId !== userId) {
      try {
        await sendTaskSharedNotification(
          friendId,
          userId,
          taskData.text,
          taskId
        );
      } catch (notificationError) {
        console.error('Error sending task shared notification:', notificationError);
        // Don't fail the entire operation if notification fails
      }
    } else if (friendId === userId) {
      console.log('🔍 shareTaskWithFriend: Skipping notification for self-share');
    }

  } catch (error) {
    console.error('❌ shareTaskWithFriend: Error in shareTaskWithFriend:', error);
    throw error;
  }
};

// Add friend to existing shared task (no new task creation for original user)
export const addFriendToSharedTask = async (taskId: string, friendId: string, userId: string) => {
  console.log('🔍 addFriendToSharedTask: Adding friend to existing shared task');
  console.log('🔍 addFriendToSharedTask: Task ID:', taskId);
  console.log('🔍 addFriendToSharedTask: Friend ID:', friendId);
  console.log('🔍 addFriendToSharedTask: User ID:', userId);
  
  try {
    // Check if this task is already shared with this friend
    const { data: existingShare, error: checkError } = await supabase
      .from('shared_tasks')
      .select('id')
      .eq('original_task_id', taskId)
      .eq('shared_by', userId)
      .eq('shared_with', friendId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking existing share:', checkError);
      throw checkError;
    }

    // If already shared, don't do anything
    if (existingShare) {
      console.log('🔍 addFriendToSharedTask: Task already shared with this friend');
      return;
    }

    // Get task details for notification
    const { data: taskData, error: taskError } = await supabase
      .from('todos')
      .select('text')
      .eq('id', taskId)
      .single();

    if (taskError) {
      console.error('Error fetching task details:', taskError);
      // Don't throw error here, continue with sharing
    }

    // Call the same function but this will only create a copy for the new friend
    const { error } = await supabase.rpc('share_task_with_friend', {
      p_task_id: taskId,
      p_user_id: userId,
      p_friend_id: friendId
    });

    if (error) {
      console.error('❌ addFriendToSharedTask: Error adding friend to shared task:', error);
      throw error;
    }

    console.log('✅ addFriendToSharedTask: Friend added to shared task successfully');

    // Send notification to the friend (optional, don't fail if it doesn't work)
    if (taskData?.text && friendId !== userId) {
      try {
        await sendTaskSharedNotification(
          friendId,
          userId,
          taskData.text,
          taskId
        );
      } catch (notificationError) {
        console.error('Error sending task shared notification:', notificationError);
        // Don't fail the entire operation if notification fails
      }
    }

  } catch (error) {
    console.error('❌ addFriendToSharedTask: Error in addFriendToSharedTask:', error);
    throw error;
  }
};

// Share habit with friend
export const shareHabitWithFriend = async (habitId: string, friendId: string, userId: string) => {
  try {
    // For now, just show a message that habit sharing is coming soon
    console.log('Habit sharing coming soon');
  } catch (error) {
    console.error('Error in shareHabitWithFriend:', error);
    throw error;
  }
};

/**
 * Share an event with friends
 */
export const shareEventWithFriends = async (
  eventId: string,
  friendIds: string[],
  message?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Get event details for notifications
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('title')
      .eq('id', eventId)
      .single();

    if (eventError) {
      console.error('Error fetching event details:', eventError);
      return { success: false, error: 'Event not found' };
    }

    // Create shared event records
    const sharedEvents = friendIds.map(friendId => ({
      original_event_id: eventId,
      shared_by: user.id,
      shared_with: friendId,
      status: 'pending',
      message: message || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('shared_events')
      .insert(sharedEvents);

    if (error) {
      console.error('Error sharing event:', error);
      return { success: false, error: error.message };
    }

    // Send notifications to all friends
    for (const friendId of friendIds) {
      try {
        await sendEventSharedNotification(
          friendId,
          user.id,
          eventData.title,
          eventId
        );
      } catch (notificationError) {
        console.error('Error sending notification to friend:', friendId, notificationError);
        // Don't fail the entire operation if notification fails
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error in shareEventWithFriends:', error);
    return { success: false, error: 'Failed to share event' };
  }
};

/**
 * Create and share an event with friends in one step
 * This creates the event and shares it without creating a separate original event
 */
export const createAndShareEvent = async (
  eventData: {
    id: string;
    title: string;
    description?: string;
    location?: string;
    date: string;
    startDateTime?: string;
    endDateTime?: string;
    categoryName?: string;
    categoryColor?: string;
    isAllDay: boolean;
    photos?: string[];
  },
  friendIds: string[],
  message?: string
): Promise<{ success: boolean; error?: string; eventId?: string }> => {
  console.log('🔍 [createAndShareEvent] Starting with:', { eventData, friendIds, message });
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // For shared events, only create records in shared_events table with pending status
    // The event will be moved to events table only when accepted
    console.log('🔍 [createAndShareEvent] Creating shared event records only...');
    const sharedEvents = friendIds.map(friendId => ({
      original_event_id: eventData.id,
      shared_by: user.id,
      shared_with: friendId,
      status: 'pending',
      message: message || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Store event data in the shared_events table for pending events
      event_data: {
        id: eventData.id,
        title: eventData.title,
        description: eventData.description,
        location: eventData.location,
        date: eventData.date,
        start_datetime: eventData.startDateTime,
        end_datetime: eventData.endDateTime,
        category_name: eventData.categoryName,
        category_color: eventData.categoryColor,
        is_all_day: eventData.isAllDay,
        photos: eventData.photos || []
      }
    }));
    
    console.log('🔍 [createAndShareEvent] Shared events to create:', sharedEvents);

    const { error: shareError } = await supabase
      .from('shared_events')
      .insert(sharedEvents);

    if (shareError) {
      console.error('🔍 [createAndShareEvent] Error creating shared events:', shareError);
      return { success: false, error: shareError.message };
    }
    console.log('🔍 [createAndShareEvent] Shared events created successfully');

    // Send notifications to all friends
    for (const friendId of friendIds) {
      try {
        await sendEventSharedNotification(
          friendId,
          user.id,
          eventData.title,
          eventData.id
        );
      } catch (notificationError) {
        console.error('Error sending notification to friend:', friendId, notificationError);
        // Don't fail the entire operation if notification fails
      }
    }

    console.log('🔍 [createAndShareEvent] Successfully completed - returning success');
    return { success: true, eventId: eventData.id };
  } catch (error) {
    console.error('🔍 [createAndShareEvent] Error in createAndShareEvent:', error);
    return { success: false, error: 'Failed to create and share event' };
  }
};

// Get shared tasks for current user
export const getSharedTasks = async (userId: string): Promise<SharedTask[]> => {
  try {
    const { data, error } = await supabase.rpc('get_shared_tasks_for_user', {
      user_id: userId
    });

    if (error) {
      console.error('Error fetching shared tasks:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getSharedTasks:', error);
    return [];
  }
};

// Get shared habits for current user
export const getSharedHabits = async (userId: string): Promise<SharedHabit[]> => {
  try {
    const { data, error } = await supabase.rpc('get_shared_habits_for_user', {
      user_id: userId
    });

    if (error) {
      console.error('Error fetching shared habits:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getSharedHabits:', error);
    return [];
  }
};

/**
 * Fetch shared events for the current user
 */
export const fetchSharedEvents = async (): Promise<{
  success: boolean;
  data?: SharedEvent[];
  error?: string;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Fetch shared events with event details and sharer profiles
    // Include both events shared WITH the user (received) and BY the user (sent)
    const { data: sharedEventsData, error } = await supabase
      .from('shared_events')
      .select(`
        id,
        original_event_id,
        shared_by,
        shared_with,
        status,
        message,
        created_at,
        updated_at,
        event_data
      `)
      .or(`shared_with.eq.${user.id},shared_by.eq.${user.id}`)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching shared events:', error);
      return { success: false, error: error.message };
    }

    if (!sharedEventsData || sharedEventsData.length === 0) {
      return { success: true, data: [] };
    }

    // Get unique user IDs involved in shared events (both sharers and recipients)
    const allUserIds = new Set<string>();
    sharedEventsData.forEach(se => {
      allUserIds.add(se.shared_by);
      allUserIds.add(se.shared_with);
    });
    
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', Array.from(allUserIds));

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    // Create a map of user ID to profile data
    const profilesMap = new Map();
    if (profilesData) {
      profilesData.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });
    }

    // Transform the data
    const transformedEvents: SharedEvent[] = sharedEventsData
      .filter(sharedEvent => sharedEvent.event_data) // Filter out events that don't have event_data
      .map(sharedEvent => {
        const event = sharedEvent.event_data as any; // Type assertion for the event_data
        
        // Determine if current user is the sender or recipient
        const isCurrentUserSender = sharedEvent.shared_by === user.id;
        const isCurrentUserRecipient = sharedEvent.shared_with === user.id;
        
        // For sent events, show the recipient's profile
        // For received events, show the sender's profile
        const profileToShowId = isCurrentUserSender ? sharedEvent.shared_with : sharedEvent.shared_by;
        const profileToShow = profilesMap.get(profileToShowId);

        return {
          id: sharedEvent.id,
          originalEventId: sharedEvent.original_event_id,
          sharedBy: sharedEvent.shared_by,
          sharedWith: sharedEvent.shared_with,
          status: sharedEvent.status as 'pending' | 'accepted' | 'declined',
          message: sharedEvent.message,
          createdAt: sharedEvent.created_at,
          updatedAt: sharedEvent.updated_at,
          // Add flags to indicate the user's role
          isCurrentUserSender,
          isCurrentUserRecipient,
          event: {
            id: event.id,
            title: event.title,
            description: event.description,
            location: event.location,
            date: event.date,
            startDateTime: event.start_datetime,
            endDateTime: event.end_datetime,
            categoryName: event.category_name,
            categoryColor: event.category_color,
            isAllDay: event.is_all_day,
            photos: event.photos || []
          },
          sharerProfile: profileToShow ? {
            id: profileToShow.id,
            username: profileToShow.username,
            fullName: profileToShow.full_name,
            avatarUrl: profileToShow.avatar_url
          } : undefined
        };
      });

    return { success: true, data: transformedEvents };
  } catch (error) {
    console.error('Error in fetchSharedEvents:', error);
    return { success: false, error: 'Failed to fetch shared events' };
  }
};

/**
 * Get shared events count for notifications
 */
export const getSharedEventsCount = async (): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { count, error } = await supabase
      .from('shared_events')
      .select('*', { count: 'exact', head: true })
      .eq('shared_with', user.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error getting shared events count:', error);
      return { success: false, error: error.message };
    }

    return { success: true, count: count || 0 };
  } catch (error) {
    console.error('Error in getSharedEventsCount:', error);
    return { success: false, error: 'Failed to get count' };
  }
};

// Accept a shared task
export const acceptSharedTask = async (sharedTaskId: string, userId: string) => {
  try {
    const { error } = await supabase.rpc('accept_shared_task', {
      shared_task_id: sharedTaskId,
      user_id: userId
    });

    if (error) {
      console.error('Error accepting shared task:', error);
      throw error;
    }

    console.log('Shared task accepted successfully');
  } catch (error) {
    console.error('Error in acceptSharedTask:', error);
    throw error;
  }
};

// Accept a shared habit
export const acceptSharedHabit = async (sharedHabitId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('shared_habits')
      .update({ status: 'accepted' })
      .eq('id', sharedHabitId);

    if (error) {
      console.error('Error accepting shared habit:', error);
      return false;
    }

    Toast.show({
      type: 'success',
      text1: 'Habit accepted',
      text2: 'You can now see this habit in your list',
      position: 'bottom',
    });
    return true;
  } catch (error) {
    console.error('Error in acceptSharedHabit:', error);
    return false;
  }
};

/**
 * Accept a shared event
 */
export const acceptSharedEvent = async (
  sharedEventId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('🔍 [AcceptSharedEvent] Starting accept process for shared event ID:', sharedEventId);
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('❌ [AcceptSharedEvent] User error:', userError);
      return { success: false, error: 'User authentication error' };
    }
    if (!user) {
      console.error('❌ [AcceptSharedEvent] No user found');
      return { success: false, error: 'User not authenticated' };
    }
    
    console.log('✅ [AcceptSharedEvent] User authenticated:', user.id);

    // First, get the shared event details
    console.log('🔍 [AcceptSharedEvent] Fetching shared event details...');
    const { data: sharedEvent, error: fetchError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('id', sharedEventId)
      .eq('shared_with', user.id)
      .single();

    if (fetchError) {
      console.error('❌ [AcceptSharedEvent] Error fetching shared event:', fetchError);
      return { success: false, error: `Failed to fetch shared event: ${fetchError.message}` };
    }
    
    if (!sharedEvent) {
      console.error('❌ [AcceptSharedEvent] Shared event not found');
      return { success: false, error: 'Shared event not found' };
    }
    
    console.log('✅ [AcceptSharedEvent] Shared event found:', sharedEvent);

    // Create a new event in the user's events table using the event_data from shared_events
    console.log('🔍 [AcceptSharedEvent] Creating new event in user\'s events table...');
    
    if (!sharedEvent.event_data) {
      console.error('❌ [AcceptSharedEvent] No event_data found in shared event');
      return { success: false, error: 'No event data found' };
    }
    
    const eventData = sharedEvent.event_data;
    console.log('🔍 [AcceptSharedEvent] Event data to copy:', eventData);
    
    const { error: insertError } = await supabase
      .from('events')
      .insert({
        id: `accepted_${sharedEvent.original_event_id}_${user.id}`,
        title: eventData.title,
        description: eventData.description,
        location: eventData.location,
        date: eventData.date,
        start_datetime: eventData.start_datetime,
        end_datetime: eventData.end_datetime,
        category_name: eventData.category_name,
        category_color: eventData.category_color,
        is_all_day: eventData.is_all_day,
        photos: eventData.photos || [], // Copy photos from the shared event
        user_id: user.id,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('❌ [AcceptSharedEvent] Error creating accepted event:', insertError);
      return { success: false, error: insertError.message };
    }
    
    console.log('✅ [AcceptSharedEvent] New event created successfully');

    // Update the shared event status to accepted
    console.log('🔍 [AcceptSharedEvent] Updating shared event status to accepted...');
    const { error: updateError } = await supabase
      .from('shared_events')
      .update({ 
        status: 'accepted',
        updated_at: new Date().toISOString()
      })
      .eq('id', sharedEventId)
      .eq('shared_with', user.id);

    if (updateError) {
      console.error('❌ [AcceptSharedEvent] Error updating shared event status:', updateError);
      return { success: false, error: updateError.message };
    }
    
    console.log('✅ [AcceptSharedEvent] Shared event status updated to accepted');

    Toast.show({
      type: 'success',
      text1: 'Event accepted successfully',
      text2: 'The event has been added to your calendar',
      position: 'bottom',
    });

    return { success: true };
  } catch (error) {
    console.error('Error in acceptSharedEvent:', error);
    return { success: false, error: 'Failed to accept event' };
  }
};

// Decline a shared task
export const declineSharedTask = async (sharedTaskId: string, userId: string) => {
  try {
    const { error } = await supabase.rpc('decline_shared_task', {
      shared_task_id: sharedTaskId,
      user_id: userId
    });

    if (error) {
      console.error('Error declining shared task:', error);
      throw error;
    }

    console.log('Shared task declined successfully');
  } catch (error) {
    console.error('Error in declineSharedTask:', error);
    throw error;
  }
};

// Decline a shared habit
export const declineSharedHabit = async (sharedHabitId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('shared_habits')
      .update({ status: 'declined' })
      .eq('id', sharedHabitId);

    if (error) {
      console.error('Error declining shared habit:', error);
      return false;
    }

    Toast.show({
      type: 'success',
      text1: 'Habit declined',
      position: 'bottom',
    });
    return true;
  } catch (error) {
    console.error('Error in declineSharedHabit:', error);
    return false;
  }
};

/**
 * Decline a shared event
 */
export const declineSharedEvent = async (
  sharedEventId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('🔍 [DeclineSharedEvent] Starting decline process for shared event ID:', sharedEventId);
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('❌ [DeclineSharedEvent] User error:', userError);
      return { success: false, error: 'User authentication error' };
    }
    if (!user) {
      console.error('❌ [DeclineSharedEvent] No user found');
      return { success: false, error: 'User not authenticated' };
    }
    
    console.log('✅ [DeclineSharedEvent] User authenticated:', user.id);

    console.log('🔍 [DeclineSharedEvent] Updating shared event status to declined...');
    const { error } = await supabase
      .from('shared_events')
      .update({ 
        status: 'declined',
        updated_at: new Date().toISOString()
      })
      .eq('id', sharedEventId)
      .eq('shared_with', user.id);

    if (error) {
      console.error('❌ [DeclineSharedEvent] Error declining shared event:', error);
      return { success: false, error: error.message };
    }
    
    console.log('✅ [DeclineSharedEvent] Shared event declined successfully');

    return { success: true };
  } catch (error) {
    console.error('Error in declineSharedEvent:', error);
    return { success: false, error: 'Failed to decline event' };
  }
};

// Get pending shared items for current user
export const getPendingSharedItems = async (userId: string) => {
  try {
    // Get pending shared tasks
    const { data: pendingTasks, error: tasksError } = await supabase
      .from('shared_tasks')
      .select(`
        id,
        original_task_id,
        created_at,
        status,
        todos!inner(text, description),
        profiles!inner(full_name, avatar_url, username)
      `)
      .eq('shared_with', userId)
      .eq('status', 'pending');

    // Get pending shared habits
    const { data: pendingHabits, error: habitsError } = await supabase
      .from('shared_habits')
      .select(`
        id,
        original_habit_id,
        created_at,
        status,
        habits!inner(text, description),
        profiles!inner(full_name, avatar_url, username)
      `)
      .eq('shared_with', userId)
      .eq('status', 'pending');

    if (tasksError || habitsError) {
      console.error('Error fetching pending shared items:', { tasksError, habitsError });
      return { tasks: [], habits: [] };
    }

    return {
      tasks: pendingTasks || [],
      habits: pendingHabits || []
    };
  } catch (error) {
    console.error('Error in getPendingSharedItems:', error);
    return { tasks: [], habits: [] };
  }
};

// Get pending shared tasks for a user
export const getPendingSharedTasks = async (userId: string) => {
  try {
    const { data, error } = await supabase.rpc('get_pending_shared_tasks', {
      user_id: userId
    });

    if (error) {
      console.error('Error fetching pending shared tasks:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getPendingSharedTasks:', error);
    throw error;
  }
}; 