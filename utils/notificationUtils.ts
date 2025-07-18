import { supabase } from '../supabase';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

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

        // Try to insert with all fields, but handle missing column error
        try {
          const { data: newData, error: insertError } = await supabase
            .from('user_preferences')
            .insert({
              user_id: userId,
              theme: defaultPreferences.theme,
              notifications_enabled: defaultPreferences.notifications_enabled,
              default_view: defaultPreferences.default_view,
              email_notifications: defaultPreferences.email_notifications,
              push_notifications: defaultPreferences.push_notifications,
              default_screen: defaultPreferences.default_screen,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
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
        } catch (insertError: any) {
          console.error('Error in preference creation:', insertError);
          
          // If the error is about missing column, try without it
          if (insertError.message && insertError.message.includes('auto_move_uncompleted_tasks')) {
            console.log('🔄 Retrying without auto_move_uncompleted_tasks column...');
            try {
              const { data: newData, error: retryError } = await supabase
                .from('user_preferences')
                .insert({
                  user_id: userId,
                  theme: defaultPreferences.theme,
                  notifications_enabled: defaultPreferences.notifications_enabled,
                  default_view: defaultPreferences.default_view,
                  email_notifications: defaultPreferences.email_notifications,
                  push_notifications: defaultPreferences.push_notifications,
                  default_screen: defaultPreferences.default_screen,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .select()
                .single();

              if (retryError) {
                console.error('Error in retry preference creation:', retryError);
                return null;
              }

              // Cache the result
              userPreferencesCache[userId] = newData;
              return newData;
            } catch (retryError: any) {
              console.error('Error in retry preference creation:', retryError);
              return null;
            }
          }
          return null;
        }
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
 * Save Expo push token to user's profile
 */
export const saveExpoPushToken = async (userId: string): Promise<boolean> => {
  try {
    console.log('🔔 [Notifications] Saving Expo push token for user:', userId);
    
    // Get the Expo push token
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'c77ca206-6258-4213-b712-5d687c9861d3', // Your Expo project ID
    });
    
    console.log('🔔 [Notifications] Expo push token:', token.data);
    
    // Save to user's profile
    const { error } = await supabase
      .from('profiles')
      .update({ expo_push_token: token.data })
      .eq('id', userId);
    
    if (error) {
      console.error('🔔 [Notifications] Error saving push token:', error);
      return false;
    }
    
    console.log('🔔 [Notifications] Push token saved successfully');
    return true;
  } catch (error) {
    console.error('🔔 [Notifications] Error getting/saving push token:', error);
    return false;
  }
};

/**
 * Initialize notifications and save push token
 */
export const initializeNotificationsWithToken = async (userId: string): Promise<boolean> => {
  try {
    console.log('🔔 [Notifications] Initializing notifications with token for user:', userId);
    
    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync();
    console.log('🔔 [Notifications] Permission status:', status);
    
    if (status !== 'granted') {
      console.log('🔔 [Notifications] Permission denied');
      return false;
    }
    
    // Set up notification handler
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        console.log('🔔 [Notifications] Notification received:', notification.request.content.title);
        
        // Handle shared item notifications
        const data = notification.request.content.data;
        if (data?.type === 'shared_item') {
          console.log('🔔 [Notifications] Shared item notification:', data);
          return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          };
        }
        
        // Default handling for other notifications
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        };
      },
    });
    
    // Save push token to profile
    const tokenSaved = await saveExpoPushToken(userId);
    if (!tokenSaved) {
      console.log('🔔 [Notifications] Failed to save push token');
      return false;
    }
    
    console.log('🔔 [Notifications] Notifications initialized successfully');
    return true;
  } catch (error) {
    console.error('🔔 [Notifications] Error initializing notifications:', error);
    return false;
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
 * Test function to verify sharing push notifications are working
 */
export const testSharingNotifications = async (): Promise<void> => {
  try {
    console.log('🔔 [Test] Testing sharing push notifications...');
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('🔔 [Test] No user logged in');
      return;
    }

    // Test event shared push notification
    await sendEventSharedNotification(
      user.id, // recipient (same as sender for test)
      user.id, // sender
      'Test Event',
      'test-event-id'
    );

    // Test task shared push notification
    await sendTaskSharedNotification(
      user.id, // recipient (same as sender for test)
      user.id, // sender
      'Test Task',
      'test-task-id'
    );

    // Test note shared push notification
    await sendNoteSharedNotification(
      user.id, // recipient (same as sender for test)
      user.id, // sender
      'Test Note',
      'test-note-id'
    );

    console.log('🔔 [Test] All sharing push notification tests completed');
  } catch (error) {
    console.error('🔔 [Test] Error testing sharing push notifications:', error);
  }
};

/**
 * Send a push notification when an event is shared with a user
 */
export const sendEventSharedNotification = async (
  recipientUserId: string,
  senderUserId: string,
  eventTitle: string,
  eventId: string
): Promise<void> => {
  try {
    console.log('🔔 [Event Shared Notification] Sending push notification to user:', recipientUserId);
    
    // Check if push notifications are enabled for the recipient
    const notificationsEnabled = await arePushNotificationsEnabled(recipientUserId);
    if (!notificationsEnabled) {
      console.log('🔔 [Event Shared Notification] Push notifications disabled for user, skipping');
      return;
    }

    // Get recipient's push token
    const { data: recipientProfile, error: recipientError } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', recipientUserId)
      .single();

    if (recipientError || !recipientProfile?.expo_push_token) {
      console.log('🔔 [Event Shared Notification] No push token found for recipient:', recipientUserId);
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

    // Send push notification via Expo
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: recipientProfile.expo_push_token,
        title: 'Event Shared with You',
        body: `${senderName} shared "${eventTitle}" with you`,
        data: { 
          type: 'event_shared',
          eventId: eventId,
          senderId: senderUserId,
          senderName: senderName
        },
        sound: 'default',
        priority: 'high',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔔 [Event Shared Notification] Push notification failed:', errorText);
      return;
    }

    const result = await response.json();
    console.log('🔔 [Event Shared Notification] Push notification sent successfully:', result);
    
  } catch (error) {
    console.error('🔔 [Event Shared Notification] Error sending notification:', error);
  }
};

/**
 * Send a push notification when a task is shared with a user
 */
export const sendTaskSharedNotification = async (
  recipientUserId: string,
  senderUserId: string,
  taskTitle: string,
  taskId: string
): Promise<void> => {
  try {
    console.log('🔔 [Task Shared Notification] Sending push notification to user:', recipientUserId);
    
    // Check if push notifications are enabled for the recipient
    const notificationsEnabled = await arePushNotificationsEnabled(recipientUserId);
    if (!notificationsEnabled) {
      console.log('🔔 [Task Shared Notification] Push notifications disabled for user, skipping');
      return;
    }

    // Get recipient's push token
    const { data: recipientProfile, error: recipientError } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', recipientUserId)
      .single();

    if (recipientError || !recipientProfile?.expo_push_token) {
      console.log('🔔 [Task Shared Notification] No push token found for recipient:', recipientUserId);
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

    // Send push notification via Expo
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: recipientProfile.expo_push_token,
        title: 'Task Shared with You',
        body: `${senderName} shared "${taskTitle}" with you`,
        data: { 
          type: 'task_shared',
          taskId: taskId,
          senderId: senderUserId,
          senderName: senderName
        },
        sound: 'default',
        priority: 'high',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔔 [Task Shared Notification] Push notification failed:', errorText);
      return;
    }

    const result = await response.json();
    console.log('🔔 [Task Shared Notification] Push notification sent successfully:', result);
    
  } catch (error) {
    console.error('🔔 [Task Shared Notification] Error sending notification:', error);
  }
};

/**
 * Send a push notification when a note is shared with a user
 */
export const sendNoteSharedNotification = async (
  recipientUserId: string,
  senderUserId: string,
  noteTitle: string,
  noteId: string
): Promise<void> => {
  try {
    console.log('🔔 [Note Shared Notification] Sending push notification to user:', recipientUserId);
    
    // Check if push notifications are enabled for the recipient
    const notificationsEnabled = await arePushNotificationsEnabled(recipientUserId);
    if (!notificationsEnabled) {
      console.log('🔔 [Note Shared Notification] Push notifications disabled for user, skipping');
      return;
    }

    // Get recipient's push token
    const { data: recipientProfile, error: recipientError } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', recipientUserId)
      .single();

    if (recipientError || !recipientProfile?.expo_push_token) {
      console.log('🔔 [Note Shared Notification] No push token found for recipient:', recipientUserId);
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

    // Send push notification via Expo
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: recipientProfile.expo_push_token,
        title: 'Note Shared with You',
        body: `${senderName} shared "${noteTitle}" with you`,
        data: { 
          type: 'note_shared',
          noteId: noteId,
          senderId: senderUserId,
          senderName: senderName
        },
        sound: 'default',
        priority: 'high',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔔 [Note Shared Notification] Push notification failed:', errorText);
      return;
    }

    const result = await response.json();
    console.log('🔔 [Note Shared Notification] Push notification sent successfully:', result);
    
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