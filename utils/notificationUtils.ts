import { supabase } from '../supabase';

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
 * Clear the preferences cache for a user (call this when preferences are updated)
 */
export const clearPreferencesCache = (userId: string) => {
  delete userPreferencesCache[userId];
};

/**
 * Update preferences cache
 */
export const updatePreferencesCache = (userId: string, preferences: UserPreferences) => {
  userPreferencesCache[userId] = preferences;
}; 