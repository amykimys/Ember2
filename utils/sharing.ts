import { supabase } from '../supabase';
import Toast from 'react-native-toast-message';

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
  } catch (error) {
    console.error('❌ shareTaskWithFriend: Error in shareTaskWithFriend:', error);
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
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // First, create the event in the events table
    const { error: eventError } = await supabase
      .from('events')
      .insert({
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
        photos: eventData.photos || [],
        user_id: user.id
      });

    if (eventError) {
      console.error('Error creating event:', eventError);
      return { success: false, error: eventError.message };
    }

    // Then create shared event records
    const sharedEvents = friendIds.map(friendId => ({
      original_event_id: eventData.id,
      shared_by: user.id,
      shared_with: friendId,
      status: 'pending',
      message: message || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error: shareError } = await supabase
      .from('shared_events')
      .insert(sharedEvents);

    if (shareError) {
      console.error('Error sharing event:', shareError);
      return { success: false, error: shareError.message };
    }

    return { success: true, eventId: eventData.id };
  } catch (error) {
    console.error('Error in createAndShareEvent:', error);
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
        events (
          id,
          title,
          description,
          location,
          date,
          start_datetime,
          end_datetime,
          category_name,
          category_color,
          is_all_day,
          photos
        )
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
      .filter(sharedEvent => sharedEvent.events) // Filter out events that don't exist
      .map(sharedEvent => {
        const event = sharedEvent.events as any; // Type assertion for the joined event data
        
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // First, get the shared event details
    const { data: sharedEvent, error: fetchError } = await supabase
      .from('shared_events')
      .select(`
        *,
        events!inner(*)
      `)
      .eq('id', sharedEventId)
      .eq('shared_with', user.id)
      .single();

    if (fetchError || !sharedEvent) {
      console.error('Error fetching shared event:', fetchError);
      return { success: false, error: 'Shared event not found' };
    }

    // Create a new event in the user's events table
    // Note: We do NOT copy photos to keep them with the original event owner
    const { error: insertError } = await supabase
      .from('events')
      .insert({
        id: `accepted_${sharedEvent.original_event_id}_${user.id}`,
        title: sharedEvent.events.title,
        description: sharedEvent.events.description,
        location: sharedEvent.events.location,
        date: sharedEvent.events.date,
        start_datetime: sharedEvent.events.start_datetime,
        end_datetime: sharedEvent.events.end_datetime,
        category_name: sharedEvent.events.category_name,
        category_color: sharedEvent.events.category_color,
        is_all_day: sharedEvent.events.is_all_day,
        photos: [], // Don't copy photos - keep them with original event owner
        user_id: user.id,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error creating accepted event:', insertError);
      return { success: false, error: insertError.message };
    }

    // Update the shared event status to accepted
    const { error: updateError } = await supabase
      .from('shared_events')
      .update({ 
        status: 'accepted',
        updated_at: new Date().toISOString()
      })
      .eq('id', sharedEventId)
      .eq('shared_with', user.id);

    if (updateError) {
      console.error('Error updating shared event status:', updateError);
      return { success: false, error: updateError.message };
    }

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { error } = await supabase
      .from('shared_events')
      .update({ 
        status: 'declined',
        updated_at: new Date().toISOString()
      })
      .eq('id', sharedEventId)
      .eq('shared_with', user.id);

    if (error) {
      console.error('Error declining shared event:', error);
      return { success: false, error: error.message };
    }

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