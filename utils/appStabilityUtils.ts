import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';

// 1. Session Management Issues
export const validateAndRefreshSession = async (): Promise<boolean> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Session validation failed:', error);
      return false;
    }
    
    if (!session) {
      console.log('ℹ️ No session found');
      return false;
    }
    
    // Check if session is expired or about to expire
    const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
    const now = new Date();
    const timeUntilExpiry = expiresAt ? expiresAt.getTime() - now.getTime() : 0;
    
    // If session expires in less than 5 minutes, refresh it
    if (timeUntilExpiry < 5 * 60 * 1000) {
      console.log('🔄 Session expiring soon, refreshing...');
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshedSession) {
        console.error('❌ Failed to refresh session:', refreshError);
        return false;
      }
      
      console.log('✅ Session refreshed successfully');
      return true;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error validating session:', error);
    return false;
  }
};

// 2. Network Connection Issues
export const checkAndReconnect = async (): Promise<boolean> => {
  try {
    // Test Supabase connection
    const { error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Network connection test failed:', error);
      return false;
    }
    
    console.log('✅ Network connection is working');
    return true;
  } catch (error) {
    console.error('❌ Network connection error:', error);
    return false;
  }
};

// 3. Memory Management Issues
export const clearStaleData = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const staleKeys = keys.filter(key => 
      key.includes('temp_') || 
      key.includes('cache_') || 
      key.includes('debug_')
    );
    
    if (staleKeys.length > 0) {
      await AsyncStorage.multiRemove(staleKeys);
      console.log('🧹 Cleared stale data:', staleKeys.length, 'items');
    }
  } catch (error) {
    console.error('Error clearing stale data:', error);
  }
};

// 4. Data Context Reset
export const resetDataContext = (setData: any): void => {
  console.log('🔄 Resetting data context...');
  
  setData({
    userProfile: null,
    userPreferences: null,
    todos: [],
    habits: [],
    events: [],
    sharedEvents: [],
    notes: [],
    sharedNotes: [],
    sharedNoteIds: [],
    sharedNoteDetails: {},
    friends: [],
    friendRequests: [],
    categories: [],
    socialUpdates: [],
    isPreloaded: false,
    lastUpdated: null,
  });
  
  console.log('✅ Data context reset complete');
};

// 5. App Health Check
export const performAppHealthCheck = async (): Promise<{
  sessionValid: boolean;
  networkValid: boolean;
  overallHealthy: boolean;
}> => {
  try {
    console.log('🏥 Running app health check...');
    
    const sessionValid = await validateAndRefreshSession();
    const networkValid = await checkAndReconnect();
    
    const overallHealthy = sessionValid && networkValid;
    
    console.log('Health check results:', {
      sessionValid,
      networkValid,
      overallHealthy
    });
    
    return { sessionValid, networkValid, overallHealthy };
  } catch (error) {
    console.error('❌ Health check error:', error);
    return { sessionValid: false, networkValid: false, overallHealthy: false };
  }
};

// 6. Debug Utilities
export const debugAppState = async (): Promise<void> => {
  try {
    console.log('🔍 Debug: App State Analysis');
    
    // Check AsyncStorage
    const keys = await AsyncStorage.getAllKeys();
    console.log('📦 AsyncStorage keys:', keys.length);
    
    // Check session
    const { data: { session } } = await supabase.auth.getSession();
    console.log('🔐 Session status:', {
      hasSession: !!session,
      expiresAt: session?.expires_at,
      isExpired: session?.expires_at ? new Date(session.expires_at * 1000) < new Date() : false
    });
    
    // Check network
    const networkValid = await checkAndReconnect();
    console.log('🌐 Network status:', networkValid);
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
};

// 7. Force App Recovery
export const forceAppRecovery = async (setData: any): Promise<void> => {
  try {
    console.log('🔄 Force app recovery initiated...');
    
    // Clear all stored data
    await AsyncStorage.clear();
    console.log('🧹 Cleared all stored data');
    
    // Reset data context
    resetDataContext(setData);
    
    // Validate session
    const sessionValid = await validateAndRefreshSession();
    if (!sessionValid) {
      console.log('⚠️ Session invalid after recovery, user may need to re-authenticate');
    }
    
    console.log('✅ App recovery completed');
  } catch (error) {
    console.error('❌ App recovery failed:', error);
  }
}; 