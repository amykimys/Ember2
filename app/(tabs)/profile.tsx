import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { supabase } from '../../supabase';
import { User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

const profileImage = 'https://placekitten.com/200/200';

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);

  const signInWithGoogle = async () => {
    console.log('Starting Google sign in...');
    await supabase.auth.signOut();
    await WebBrowser.maybeCompleteAuthSession();

    const redirectUri = makeRedirectUri({ native: 'ember://login-callback' });
    console.log('Using redirect URI:', redirectUri);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
        queryParams: {
          prompt: 'select_account',
          access_type: 'offline',
        },
        scopes: 'email profile',
      },
    });

    if (error) {
      console.error('OAuth error:', error.message);
      return;
    }

    if (data?.url) {
      console.log('Opening auth session with URL:', data.url);
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      console.log('Auth session result:', result.type);
      
      if (result.type === 'success') {
        console.log('Auth successful, result URL:', result.url);
        
        // Extract the access token from the URL
        const url = new URL(result.url);
        const accessToken = url.hash.split('&')[0].split('=')[1];
        const refreshToken = url.hash.split('refresh_token=')[1].split('&')[0];
        
        if (accessToken && refreshToken) {
          console.log('Setting session with tokens...');
          const { data: { session }, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          console.log('Session error:', sessionError);
          console.log('Session:', session);
          
          if (session?.user) {
            setUser(session.user);
          }
        }
      }
    }
  };

  const signOut = async () => {
    console.log('Signing out...');
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Sign out error:', error.message);
    else {
      console.log('Sign out successful');
      setUser(null);
    }
  };

  useEffect(() => {
    const init = async () => {
      console.log('Initializing auth state...');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Initial session:', session);
      
      if (session?.user) {
        setUser(session.user);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth state changed:', _event);
      console.log('New session:', session);
      
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => {
      console.log('Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  console.log('Current user state:', user);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: 40, paddingHorizontal: 24 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Image
              source={{ uri: user?.user_metadata?.avatar_url || profileImage }}
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                borderWidth: 2,
                borderColor: '#ccc',
              }}
            />
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 12 }}>
              {user?.user_metadata?.full_name || user?.email || 'Your Name'}
            </Text>
          </View>

          <View style={{ backgroundColor: '#f3f3f3', padding: 16, borderRadius: 12, marginBottom: 24 }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>🔥 Streak Stats</Text>
            <Text>Current Streak: 6</Text>
            <Text>Longest Streak: 12</Text>
            <Text>Total Completions: 78</Text>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>📅 Weekly Progress</Text>
            <View style={{ height: 100, backgroundColor: '#eaeaea', borderRadius: 8 }} />
          </View>

          <View style={{ marginTop: 32 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>👥 Friends</Text>
            <Text style={{ color: '#999' }}>You haven't added any friends yet.</Text>
          </View>

          <View style={{ marginTop: 32, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={user ? signOut : signInWithGoogle}
              style={{
                backgroundColor: user ? '#FF3B30' : '#4285F4',
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>
                {user ? '🚪 Log Out' : 'Sign in with Google'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}