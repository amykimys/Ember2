import 'react-native-url-polyfill/auto'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';

console.log('🔧 Initializing Supabase client with:', {
  url: supabaseUrl,
  hasAnonKey: !!supabaseAnonKey
});

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: {
        getItem: (key) => AsyncStorage.getItem(key),
        setItem: (key, value) => AsyncStorage.setItem(key, value),
        removeItem: (key) => AsyncStorage.removeItem(key),
      },
    },
  }
);