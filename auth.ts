import { GoogleSignin, statusCodes, User } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';

export const signInWithGoogle = async () => {
  try {
    // Check if user is already signed in
    const currentUser = await GoogleSignin.getCurrentUser();
    if (currentUser) {
      await GoogleSignin.signOut();
    }

    // Start the sign-in process
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const { accessToken } = await GoogleSignin.getTokens();

    if (!accessToken) {
      throw new Error('No access token present');
    }

    // Sign in with Supabase using the Google token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: accessToken,
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      console.log('User cancelled the login flow');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      console.log('Sign in is in progress');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      console.log('Play services not available');
    } else {
      console.error('Error signing in with Google:', error);
    }
    throw error;
  }
};

export const signOut = async () => {
  try {
    // Sign out from Google
    await GoogleSignin.signOut();
    
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}; 