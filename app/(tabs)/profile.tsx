import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { supabase } from '../../supabase';
import { User } from '@supabase/supabase-js';
import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

// Extend the global type to include our notes cache
declare global {
  var notesCache: Note[] | undefined;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isNotesLoading, setIsNotesLoading] = useState(false);

  // Preload notes when user signs in
  useEffect(() => {
    if (user) {
      preloadNotes();
    }
  }, [user]);

  const preloadNotes = async () => {
    if (!user || isNotesLoading) return;
    
    setIsNotesLoading(true);
    try {
      // Prefetch notes data
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (notesError) {
        console.error('Error preloading notes:', notesError);
        return;
      }

      // Store the notes data in memory or a global state management solution
      // This will be used when navigating to the notes screen
      global.notesCache = notesData;
    } catch (error) {
      console.error('Error in preloadNotes:', error);
    } finally {
      setIsNotesLoading(false);
    }
  };

  const handleNotesPress = async () => {
    if (!user) return;

    // If notes aren't loaded yet, load them before navigation
    if (!global.notesCache) {
      await preloadNotes();
    }
    
    router.push('/notes');
  };

  // ✅ Configure Google Sign-In (run once)
  useEffect(() => {
    GoogleSignin.configure({
      scopes: ['email', 'profile', 'openid'],
      webClientId: '407418160129-v3c55fd6db3f8mv747p9q5tsbcmvnrik.apps.googleusercontent.com',
      iosClientId: '407418160129-8u96bsrh8j1madb0r7trr0k6ci327gds.apps.googleusercontent.com',
      offlineAccess: true,
      hostedDomain: '', // optional
    });

    const checkSession = async () => {
      try {
        console.log('[Profile] Starting session check...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[Profile] Session check error:', sessionError);
          return;
        }

        console.log('[Profile] Session check result:', {
          hasSession: !!session,
          userEmail: session?.user?.email,
          userId: session?.user?.id,
          accessToken: session?.access_token ? 'present' : 'missing',
          refreshToken: session?.refresh_token ? 'present' : 'missing'
        });

        if (session?.user) {
          console.log('[Profile] Setting user from session:', session.user.email);
          setUser(session.user);
        } else {
          console.log('[Profile] No user found in session');
        }
      } catch (error) {
        console.error('[Profile] Error in checkSession:', error);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Profile] Auth state changed:', {
        event,
        userEmail: session?.user?.email,
        userId: session?.user?.id,
        hasAccessToken: !!session?.access_token,
        hasRefreshToken: !!session?.refresh_token
      });

      if (session?.user) {
        console.log('[Profile] Setting user from auth state change:', session.user.email);
        setUser(session.user);
      } else {
        console.log('[Profile] No user in auth state change');
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async () => {
    try {
      console.log('[Profile] Starting sign in process...');
      await GoogleSignin.hasPlayServices();
      const signInResponse = await GoogleSignin.signIn();
      console.log('[Profile] Google sign in successful:', signInResponse);
      
      const { idToken } = await GoogleSignin.getTokens();
      console.log('[Profile] Got ID token:', idToken ? 'Yes' : 'No');
  
      if (!idToken) {
        console.error('[Profile] No ID token present');
        throw new Error('No ID token present');
      }
  
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
  
      if (error) {
        console.error('[Profile] Supabase sign-in error:', {
          message: error.message,
          status: error.status,
          name: error.name
        });
        Alert.alert('Error', 'Failed to sign in. Please try again.');
      } else {
        console.log('[Profile] Sign in successful:', {
          email: data.user?.email,
          id: data.user?.id,
          hasSession: !!data.session,
          hasAccessToken: !!data.session?.access_token
        });
        setUser(data.user ?? null);
      }
    } catch (error: any) {
      console.error('[Profile] Sign in error:', {
        code: error.code,
        message: error.message,
        name: error.name
      });
      
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('[Profile] User cancelled sign-in.');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('[Profile] Sign-in already in progress.');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.log('[Profile] Play Services not available.');
      } else {
        Alert.alert('Error', 'An unexpected error occurred during sign in.');
      }
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('Starting sign out process...');
      
      // First, revoke Google access and sign out
      try {
        await GoogleSignin.revokeAccess();
        await GoogleSignin.signOut();
        console.log('Successfully signed out from Google');
      } catch (googleError) {
        console.error('Error signing out from Google:', googleError);
        // Continue with Supabase sign out even if Google sign out fails
      }
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out from Supabase:', error.message);
        throw error;
      }
      
      console.log('Successfully signed out from Supabase');
      setUser(null);
      
      // Force clear any remaining auth state by signing out again
      try {
        await GoogleSignin.signOut();
      } catch (error) {
        console.log('Second sign out attempt completed');
      }
      
    } catch (error) {
      console.error('Error in handleSignOut:', error);
      Alert.alert(
        'Error',
        'There was a problem signing out. Please try again.'
      );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View style={{ flex: 1, paddingTop: 40 }}>
        <View style={{ 
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 16,
          marginBottom: 24,
          position: 'relative'
        }}>
          {user && (
            <TouchableOpacity 
              onPress={handleNotesPress}
              style={{ 
                width: 40, 
                height: 40, 
                justifyContent: 'center', 
                alignItems: 'center',
                position: 'absolute',
                right: 16
              }}
            >
              <Ionicons 
                name="document-text-outline" 
                size={24} 
                color={isNotesLoading ? '#ccc' : '#666'} 
              />
            </TouchableOpacity>
          )}
          <View style={{ alignItems: 'center' }}>
            <Text style={{ 
              fontSize: 20, 
              color: '#000',
            }}>
              {user?.user_metadata?.full_name || user?.email || 'Your Name'}
            </Text>
            <Text style={{ 
              color: '#666', 
              marginTop: 4,
              fontSize: 14
            }}>
              {user ? 'Signed In' : 'Not Signed In'}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {user ? (
            <TouchableOpacity
              style={{
                padding: 16,
                alignItems: 'center',
                marginTop: 24,
              }}
              onPress={handleSignOut}
            >
              <Text style={{ 
                color: '#FF3B30', 
                fontSize: 15
              }}>
                Sign Out
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ 
              marginTop: 40, 
              alignItems: 'center',
            }}>
              <GoogleSigninButton
                size={GoogleSigninButton.Size.Wide}
                color={GoogleSigninButton.Color.Light}
                onPress={handleSignIn}
              />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}