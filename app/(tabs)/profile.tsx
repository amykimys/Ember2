import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, SafeAreaView, Alert, Switch, Platform, Linking } from 'react-native';
import { supabase } from '../../supabase';
import { User } from '@supabase/supabase-js';
import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

const defaultProfileImage = 'https://placekitten.com/200/200';

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  // Configure Google Sign-In
  useEffect(() => {
    GoogleSignin.configure({
      scopes: ['email', 'profile', 'openid'],
      webClientId: '407418160129-v3c55fd6db3f8mv747p9q5tsbcmvnrik.apps.googleusercontent.com',
      iosClientId: '407418160129-8u96bsrh8j1madb0r7trr0k6ci327gds.apps.googleusercontent.com',
      offlineAccess: true,
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
      const userInfo = await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();
  
      if (!idToken) throw new Error('No ID token present');
  
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
  
      if (error) {
        console.error('Supabase sign-in error:', error.message);
        Alert.alert('Error', 'Failed to sign in. Please try again.');
      } else {
        setUser(data.user ?? null);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('User cancelled sign-in.');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('Sign-in already in progress.');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Play Services not available on your device.');
      } else {
        console.error('Google sign-in error:', error);
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      }
    }
  };

  const handleSignOut = async () => {
    try {
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
              try {
                // First sign out from Supabase
                const { error: supabaseError } = await supabase.auth.signOut();
                if (supabaseError) {
                  console.error('Supabase sign out error:', supabaseError);
                  throw new Error('Failed to sign out from Supabase');
                }

                // Then handle Google sign out
                try {
                  const currentUser = await GoogleSignin.getCurrentUser();
                  if (currentUser) {
                    await GoogleSignin.signOut();
                    await GoogleSignin.revokeAccess();
                  }
                } catch (googleError) {
                  console.error('Google sign out error:', googleError);
                  // Don't throw here, as we've already signed out from Supabase
                }

                // Clear local state
                setUser(null);
                
                // Provide haptic feedback
                if (Platform.OS !== 'web') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              } catch (error) {
                console.error('Error during sign out:', error);
                Alert.alert(
                  'Sign Out Error',
                  'There was a problem signing out. Please try again.',
                  [{ text: 'OK' }]
                );
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error in handleSignOut:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const toggleNotifications = async () => {
    if (Platform.OS !== 'web') {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive reminders.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings',
              onPress: () => Linking.openSettings()
            }
          ]
        );
        return;
      }
    }
    
    setNotificationsEnabled(!notificationsEnabled);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const toggleSetting = (setting: 'darkMode' | 'sound' | 'haptics') => {
    switch (setting) {
      case 'darkMode':
        setDarkModeEnabled(!darkModeEnabled);
        break;
      case 'sound':
        setSoundEnabled(!soundEnabled);
        break;
      case 'haptics':
        setHapticsEnabled(!hapticsEnabled);
        break;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    value: boolean,
    onToggle: () => void,
    iconType: 'ionicons' | 'material' | 'feather' = 'ionicons'
  ) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: '#F0F0F0',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {iconType === 'ionicons' && (
          <Ionicons name={icon as any} size={22} color="#666" style={{ marginRight: 12 }} />
        )}
        {iconType === 'material' && (
          <MaterialIcons name={icon as any} size={22} color="#666" style={{ marginRight: 12 }} />
        )}
        {iconType === 'feather' && (
          <Feather name={icon as any} size={22} color="#666" style={{ marginRight: 12 }} />
        )}
        <Text style={{ fontSize: 16, color: '#1a1a1a', fontFamily: 'Onest' }}>{title}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#E0E0E0', true: '#FF9A8B' }}
        thumbColor={value ? '#fff' : '#fff'}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 30 }}>
          <View style={{ alignItems: 'center' }}>
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
              marginBottom: 20,
              fontFamily: 'Onest'
            }}>
              {user?.email || 'Sign in to sync your data'}
            </Text>
            
            {!user && (
              <GoogleSigninButton
                size={GoogleSigninButton.Size.Wide}
                color={GoogleSigninButton.Color.Light}
                onPress={handleSignIn}
                style={{ marginTop: 8 }}
              />
            )}
          </View>
        </View>

        {/* Settings Sections */}
        <View style={{ paddingHorizontal: 24 }}>
          {/* Account Section */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{ 
              fontSize: 18, 
              fontWeight: '600', 
              color: '#1a1a1a',
              marginBottom: 16,
              fontFamily: 'Onest'
            }}>
              Account
            </Text>
            <View style={{
              backgroundColor: '#F5F5F5',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              {user ? (
                <TouchableOpacity
                  onPress={handleSignOut}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                  }}
                >
                  <Ionicons name="log-out-outline" size={22} color="#FF3B30" style={{ marginRight: 12 }} />
                  <Text style={{ 
                    fontSize: 16, 
                    color: '#FF3B30',
                    fontFamily: 'Onest'
                  }}>
                    Sign Out
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleSignIn}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                  }}
                >
                  <Ionicons name="log-in-outline" size={22} color="#FF9A8B" style={{ marginRight: 12 }} />
                  <Text style={{ 
                    fontSize: 16, 
                    color: '#FF9A8B',
                    fontFamily: 'Onest'
                  }}>
                    Sign In with Google
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Notifications Section */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{ 
              fontSize: 18, 
              fontWeight: '600', 
              color: '#1a1a1a',
              marginBottom: 16,
              fontFamily: 'Onest'
            }}>
              Notifications
            </Text>
            <View style={{
              backgroundColor: '#F5F5F5',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              {renderSettingItem(
                'notifications-outline',
                'Push Notifications',
                notificationsEnabled,
                toggleNotifications
              )}
              {renderSettingItem(
                'volume-high-outline',
                'Sound',
                soundEnabled,
                () => toggleSetting('sound')
              )}
            </View>
          </View>

          {/* Preferences Section */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{ 
              fontSize: 18, 
              fontWeight: '600', 
              color: '#1a1a1a',
              marginBottom: 16,
              fontFamily: 'Onest'
            }}>
              Preferences
            </Text>
            <View style={{
              backgroundColor: '#F5F5F5',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              {renderSettingItem(
                'moon-outline',
                'Dark Mode',
                darkModeEnabled,
                () => toggleSetting('darkMode')
              )}
              {renderSettingItem(
                'vibrate-outline',
                'Haptic Feedback',
                hapticsEnabled,
                () => toggleSetting('haptics')
              )}
            </View>
          </View>

          {/* About Section */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{ 
              fontSize: 18, 
              fontWeight: '600', 
              color: '#1a1a1a',
              marginBottom: 16,
              fontFamily: 'Onest'
            }}>
              About
            </Text>
            <View style={{
              backgroundColor: '#F5F5F5',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://jaani.app/privacy')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: '#E0E0E0',
                }}
              >
                <Ionicons name="shield-outline" size={22} color="#666" style={{ marginRight: 12 }} />
                <Text style={{ 
                  fontSize: 16, 
                  color: '#1a1a1a',
                  fontFamily: 'Onest'
                }}>
                  Privacy Policy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://jaani.app/terms')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: '#E0E0E0',
                }}
              >
                <Ionicons name="document-text-outline" size={22} color="#666" style={{ marginRight: 12 }} />
                <Text style={{ 
                  fontSize: 16, 
                  color: '#1a1a1a',
                  fontFamily: 'Onest'
                }}>
                  Terms of Service
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Linking.openURL('mailto:support@jaani.app')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                }}
              >
                <Ionicons name="mail-outline" size={22} color="#666" style={{ marginRight: 12 }} />
                <Text style={{ 
                  fontSize: 16, 
                  color: '#1a1a1a',
                  fontFamily: 'Onest'
                }}>
                  Contact Support
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Version Info */}
          <Text style={{ 
            textAlign: 'center', 
            color: '#999',
            fontSize: 14,
            fontFamily: 'Onest'
          }}>
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
