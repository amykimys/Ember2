import { supabase } from '../supabase';
import * as Notifications from 'expo-notifications';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications_enabled: boolean;
  default_view: 'day' | 'week' | 'month';
  email_notifications: boolean;
  push_notifications: boolean;
  default_screen: 'calendar' | 'todo' | 'notes' | 'profile';
  auto_move_uncompleted_tasks: boolean;
}

// Cache for user preferences to avoid repeated database calls
let userPreferencesCache: { [userId: string]: UserPreferences | null } = {};

/**
 * Get user preferences from cache or database
 */
export const getUserPreferences = async (userId: string): Promise<UserPreferences | null> => {
  // Check cache first
  if (userPreferencesCache[userId]) {
    return userPreferencesCache[userId];
  }

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user preferences:', error);
      
      // If no preferences exist, create default preferences
      if (error.code === 'PGRST116') {
        console.log('Creating default user preferences for user:', userId);
        
        const defaultPreferences: UserPreferences = {
          theme: 'system',
          notifications_enabled: true,
          default_view: 'week',
          email_notifications: true,
          push_notifications: true,
          default_screen: 'calendar',
          auto_move_uncompleted_tasks: false,
        };

        const { data: newData, error: insertError } = await supabase
          .from('user_preferences')
          .insert({
            user_id: userId,
            ...defaultPreferences
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating default user preferences:', insertError);
          return null;
        }

        // Cache the result
        userPreferencesCache[userId] = newData;
        return newData;
      }
      
      return null;
    }

    // Cache the result
    userPreferencesCache[userId] = data;
    return data;
  } catch (error) {
    console.error('Error in getUserPreferences:', error);
    return null;
  }
};

/**
 * Check if push notifications are enabled for a user
 */
export const arePushNotificationsEnabled = async (userId: string): Promise<boolean> => {
  const preferences = await getUserPreferences(userId);
  return preferences?.push_notifications ?? true; // Default to true if not set
};

/**
 * Test function to verify sharing notifications are working
 */
export const testSharingNotifications = async (): Promise<void> => {
  try {
    console.log('🔔 [Test] Testing sharing notifications...');
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('🔔 [Test] No user logged in');
      return;
    }

    // Test event shared notification
    await sendEventSharedNotification(
      user.id, // recipient (same as sender for test)
      user.id, // sender
      'Test Event',
      'test-event-id'
    );

    // Test task shared notification
    await sendTaskSharedNotification(
      user.id, // recipient (same as sender for test)
      user.id, // sender
      'Test Task',
      'test-task-id'
    );

    // Test note shared notification
    await sendNoteSharedNotification(
      user.id, // recipient (same as sender for test)
      user.id, // sender
      'Test Note',
      'test-note-id'
    );

    console.log('🔔 [Test] All sharing notification tests completed');
  } catch (error) {
    console.error('🔔 [Test] Error testing sharing notifications:', error);
  }
};

/**
 * Send a notification when an event is shared with a user
 */
export const sendEventSharedNotification = async (
  recipientUserId: string,
  senderUserId: string,
  eventTitle: string,
  eventId: string
): Promise<void> => {
  try {
    console.log('🔔 [Event Shared Notification] Sending notification to user:', recipientUserId);
    
    // Check if push notifications are enabled for the recipient
    const notificationsEnabled = await arePushNotificationsEnabled(recipientUserId);
    if (!notificationsEnabled) {
      console.log('🔔 [Event Shared Notification] Push notifications disabled for user, skipping');
      return;
    }

    // Get sender's profile information
    const { data: senderProfile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', senderUserId)
      .single();

    if (profileError) {
      console.error('🔔 [Event Shared Notification] Error fetching sender profile:', profileError);
      return;
    }

    const senderName = senderProfile?.full_name || senderProfile?.username || 'A friend';

    // Schedule the notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Event Shared with You',
        body: `${senderName} shared "${eventTitle}" with you`,
        sound: 'default',
        data: { 
          type: 'event_shared',
          eventId: eventId,
          senderId: senderUserId,
          senderName: senderName
        },
      },
      trigger: null, // Send immediately
    });

    console.log('🔔 [Event Shared Notification] Notification scheduled with ID:', notificationId);
    
  } catch (error) {
    console.error('🔔 [Event Shared Notification] Error sending notification:', error);
  }
};

/**
 * Send a notification when a task is shared with a user
 */
export const sendTaskSharedNotification = async (
  recipientUserId: string,
  senderUserId: string,
  taskTitle: string,
  taskId: string
): Promise<void> => {
  try {
    console.log('🔔 [Task Shared Notification] Sending notification to user:', recipientUserId);
    
    // Check if push notifications are enabled for the recipient
    const notificationsEnabled = await arePushNotificationsEnabled(recipientUserId);
    if (!notificationsEnabled) {
      console.log('🔔 [Task Shared Notification] Push notifications disabled for user, skipping');
      return;
    }

    // Get sender's profile information
    const { data: senderProfile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', senderUserId)
      .single();

    if (profileError) {
      console.error('🔔 [Task Shared Notification] Error fetching sender profile:', profileError);
      return;
    }

    const senderName = senderProfile?.full_name || senderProfile?.username || 'A friend';

    // Schedule the notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Task Shared with You',
        body: `${senderName} shared "${taskTitle}" with you`,
        sound: 'default',
        data: { 
          type: 'task_shared',
          taskId: taskId,
          senderId: senderUserId,
          senderName: senderName
        },
      },
      trigger: null, // Send immediately
    });

    console.log('🔔 [Task Shared Notification] Notification scheduled with ID:', notificationId);
    
  } catch (error) {
    console.error('🔔 [Task Shared Notification] Error sending notification:', error);
  }
};

/**
 * Send a notification when a note is shared with a user
 */
export const sendNoteSharedNotification = async (
  recipientUserId: string,
  senderUserId: string,
  noteTitle: string,
  noteId: string
): Promise<void> => {
  try {
    console.log('🔔 [Note Shared Notification] Sending notification to user:', recipientUserId);
    
    // Check if push notifications are enabled for the recipient
    const notificationsEnabled = await arePushNotificationsEnabled(recipientUserId);
    if (!notificationsEnabled) {
      console.log('🔔 [Note Shared Notification] Push notifications disabled for user, skipping');
      return;
    }

    // Get sender's profile information
    const { data: senderProfile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', senderUserId)
      .single();

    if (profileError) {
      console.error('🔔 [Note Shared Notification] Error fetching sender profile:', profileError);
      return;
    }

    const senderName = senderProfile?.full_name || senderProfile?.username || 'A friend';

    // Schedule the notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Note Shared with You',
        body: `${senderName} shared "${noteTitle}" with you`,
        sound: 'default',
        data: { 
          type: 'note_shared',
          noteId: noteId,
          senderId: senderUserId,
          senderName: senderName
        },
      },
      trigger: null, // Send immediately
    });

    console.log('🔔 [Note Shared Notification] Notification scheduled with ID:', notificationId);
    
  } catch (error) {
    console.error('🔔 [Note Shared Notification] Error sending notification:', error);
  }
};

/**
 * Clear the user preferences cache
 */
export const clearPreferencesCache = () => {
  userPreferencesCache = {};
}; 