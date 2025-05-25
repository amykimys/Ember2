import { GoogleSignin, statusCodes, SignInResponse } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';
import { Platform } from 'react-native';
import { CONFIG } from './config';

// Configure Google Sign-In
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: CONFIG.google.webClientId,
    iosClientId: CONFIG.google.iosClientId,
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  });
};

// Sign in with Google and Supabase
export const signInWithGoogle = async () => {
  try {
    // 1. Check if user is already signed in
    const currentUser = await GoogleSignin.getCurrentUser();
    if (currentUser) {
      await GoogleSignin.signOut();
    }

    // 2. Start Google Sign-In process
    await GoogleSignin.hasPlayServices();
    const signInResult = await GoogleSignin.signIn();
    const { idToken } = await GoogleSignin.getTokens();

    if (!idToken) {
      throw new Error('No ID token received from Google');
    }

    // 3. Sign in with Supabase using the Google ID token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error: any) {
    // Handle specific Google Sign-In errors
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return { data: null, error: new Error('Sign in was cancelled') };
    }
    if (error.code === statusCodes.IN_PROGRESS) {
      return { data: null, error: new Error('Sign in is already in progress') };
    }
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { data: null, error: new Error('Play Services not available') };
    }

    // Return any other errors
    return { data: null, error };
  }
};

// Sign out from both Google and Supabase
export const signOut = async () => {
  try {
    // 1. Sign out from Google
    await GoogleSignin.signOut();
    
    // 2. Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }

    return { error: null };
  } catch (error) {
    return { error };
  }
};

// Get the current session
export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    return { session, error: null };
  } catch (error) {
    return { session: null, error };
  }
};

// Get the current user
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      throw error;
    }
    return { user, error: null };
  } catch (error) {
    return { user: null, error };
  }
}; 