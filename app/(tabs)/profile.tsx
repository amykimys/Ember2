import { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, SafeAreaView, Alert, Platform, ActivityIndicator } from 'react-native';
import { User } from '@supabase/supabase-js';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../supabase';
import { configureGoogleSignIn, signInWithGoogle, signOut, getCurrentSession } from '../../auth';

const defaultProfileImage = 'https://placekitten.com/200/200';

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Configure Google Sign-In and set up auth state listener
  useEffect(() => {
    // Initialize Google Sign-In
    configureGoogleSignIn();

    // Check if user is already signed in
    getCurrentSession().then(({ session }) => {
      if (session?.user) {
        setUser(session.user);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await signInWithGoogle();
      
      if (error) {
        if (error.message === 'Sign in was cancelled') {
          console.log('User cancelled sign-in');
          return;
        }
        throw error;
      }

      if (data?.user) {
        setUser(data.user);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error: any) {
      console.error('Sign-in error:', error);
      Alert.alert(
        'Sign In Error',
        error.message || 'An error occurred during sign in. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (isLoading) return;

    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const { error } = await signOut();
              if (error) throw error;
              
              setUser(null);
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error: any) {
              console.error('Sign-out error:', error);
              Alert.alert(
                'Sign Out Error',
                'There was a problem signing out. Please try again.'
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' }}>
        {/* Profile Image */}
        <Image
          source={{ uri: user?.user_metadata?.avatar_url || defaultProfileImage }}
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            marginBottom: 16,
            backgroundColor: '#F5F5F5',
          }}
        />

        {/* User Info */}
        <Text style={{ 
          fontSize: 24, 
          fontWeight: '600', 
          color: '#1a1a1a',
          marginBottom: 4,
          fontFamily: 'Onest'
        }}>
          {user?.user_metadata?.full_name || 'Welcome!'}
        </Text>
        
        <Text style={{ 
          fontSize: 16, 
          color: '#666',
          marginBottom: 32,
          fontFamily: 'Onest'
        }}>
          {user?.email || 'Sign in to sync your data'}
        </Text>

        {/* Sign In/Out Button */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#FF9A8B" />
        ) : user ? (
          <TouchableOpacity
            onPress={handleSignOut}
            style={{
              backgroundColor: '#FF3B30',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
              minWidth: 200,
              alignItems: 'center',
            }}
          >
            <Text style={{ 
              color: '#fff',
              fontSize: 16,
              fontWeight: '600',
              fontFamily: 'Onest'
            }}>
              Sign Out
            </Text>
          </TouchableOpacity>
        ) : (
          <GoogleSigninButton
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Light}
            onPress={handleSignIn}
            style={{ marginTop: 8 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
