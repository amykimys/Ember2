import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
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
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signIn(); // sign-in and store session
      const { idToken } = await GoogleSignin.getTokens(); // ✅ this always works
  
      if (!idToken) throw new Error('No ID token present');
  
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
  
      if (error) {
        console.error('Supabase sign-in error:', error.message);
      } else {
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

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: 40, paddingHorizontal: 24 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 12 }}>
              {user?.user_metadata?.full_name || user?.email || 'Your Name'}
            </Text>
          </View>

          {user ? (
      
                  <Text style={{ color: 'white', fontWeight: '600' }}>🚪 Log Out</Text>
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
