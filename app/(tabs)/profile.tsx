import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { supabase } from '../../supabase';
import { User } from '@supabase/supabase-js';
import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';

const profileImage = 'https://placekitten.com/200/200';

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);

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
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async () => {
    try {
      console.log('Starting sign in process...');
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      console.log('Google sign in successful:', userInfo);
      
      const { idToken } = await GoogleSignin.getTokens();
      console.log('Got ID token:', idToken ? 'Yes' : 'No');
  
      if (!idToken) throw new Error('No ID token present');
  
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
  
      if (error) {
        console.error('Supabase sign-in error:', error.message);
      } else {
        console.log('Sign in successful:', data.user);
        setUser(data.user ?? null);
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('User cancelled sign-in.');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('Sign-in already in progress.');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.log('Play Services not available.');
      } else {
        console.error('Google sign-in error:', error);
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
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: 40, paddingHorizontal: 24 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 12 }}>
              {user?.user_metadata?.full_name || user?.email || 'Your Name'}
            </Text>
            <Text style={{ color: 'gray', marginTop: 4 }}>
              {user ? 'Signed In' : 'Not Signed In'}
            </Text>
          </View>

          {user ? (
            <TouchableOpacity
              style={{
                backgroundColor: '#FF3B30',
                padding: 16,
                borderRadius: 8,
                alignItems: 'center',
                marginTop: 20,
              }}
              onPress={handleSignOut}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>🚪 Sign Out</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <GoogleSigninButton
                size={GoogleSigninButton.Size.Wide}
                color={GoogleSigninButton.Color.Dark}
                onPress={handleSignIn}
              />
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
