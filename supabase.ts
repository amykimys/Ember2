import 'react-native-url-polyfill/auto'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';

// ✅ Initialize Google Sign-In with calendar scopes
GoogleSignin.configure({
  iosClientId: '407418160129-8u96bsrh8j1madb0r7trr0k6ci327gds.apps.googleusercontent.com',
  webClientId: '407418160129-8u96bsrh8j1madb0r7trr0k6ci327gds.apps.googleusercontent.com',
  offlineAccess: true,
  forceCodeForRefreshToken: true,
  scopes: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ]
});

// ✅ Initialize Supabase client with improved configuration
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      storageKey: 'jaani-auth-token', // Custom storage key for better isolation
      debug: __DEV__, // Enable debug logging in development
    },
    global: {
      headers: {
        'X-Client-Info': 'jaani-app',
      },
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Add global error handling for network issues
const originalFetch = global.fetch;
global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    // Add timeout to requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await originalFetch(input, {
      ...init,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    console.error('[Supabase] Network request failed:', error);
    
    // Check if it's a timeout error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - please check your connection and try again');
    }
    
    // Check if it's a network error
    if (error instanceof TypeError && error.message.includes('Network request failed')) {
      throw new Error('Network connection failed - please check your internet connection');
    }
    
    throw error;
  }
};

// Add session refresh error handling
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('[Supabase] Token refreshed successfully');
  } else if (event === 'SIGNED_OUT') {
    console.log('[Supabase] User signed out');
  }
});

// Export a helper function for checking connection status
export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('[Supabase] Connection test failed:', error);
      return false;
    }
    
    console.log('[Supabase] Connection test successful');
    return true;
  } catch (error) {
    console.error('[Supabase] Connection test error:', error);
    return false;
  }
};

// Export a helper function for checking session status
export const checkSessionStatus = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('[Supabase] Session check failed:', error);
      return { hasSession: false, error: error.message };
    }
    
    if (!session) {
      console.log('[Supabase] No active session found');
      return { hasSession: false, error: null };
    }
    
    const isExpired = session.expires_at ? new Date(session.expires_at * 1000) < new Date() : false;
    
    console.log('[Supabase] Session status:', {
      hasSession: true,
      email: session.user?.email,
      userId: session.user?.id,
      expiresAt: session.expires_at,
      isExpired,
      timeUntilExpiry: session.expires_at ? 
        Math.floor((session.expires_at * 1000 - Date.now()) / 1000 / 60) : null // minutes
    });
    
    return { 
      hasSession: true, 
      isExpired,
      email: session.user?.email,
      userId: session.user?.id,
      expiresAt: session.expires_at
    };
  } catch (error) {
    console.error('[Supabase] Session check error:', error);
    return { hasSession: false, error: 'Session check failed' };
  }
};