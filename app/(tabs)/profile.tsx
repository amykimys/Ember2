import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Alert, ScrollView, StyleSheet, ActivityIndicator, Switch, Image, Modal, TextInput } from 'react-native';
import { supabase } from '../../supabase';
import { User } from '@supabase/supabase-js';
import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications_enabled: boolean;
  default_view: 'day' | 'week' | 'month';
  email_notifications: boolean;
  push_notifications: boolean;
}

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  timezone: string;
  username: string;
  created_at: string;
}

interface Friend {
  friend_id: string;
  friend_name: string;
  friend_avatar: string;
  friend_username: string;
  friendship_id: string;
  status: string;
  created_at: string;
}

interface FriendRequest {
  requester_id: string;
  requester_name: string;
  requester_avatar: string;
  requester_username: string;
  friendship_id: string;
  created_at: string;
}

interface SearchResult {
  user_id: string;
  full_name: string;
  avatar_url: string;
  username: string;
  is_friend: boolean;
  friendship_status: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'system',
    notifications_enabled: true,
    default_view: 'day',
    email_notifications: true,
    push_notifications: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  // Edit profile form state
  const [editForm, setEditForm] = useState({
    full_name: '',
    bio: '',
    avatar_url: '',
    username: ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Friends state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeFriendsTab, setActiveFriendsTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [showFriendsModal, setShowFriendsModal] = useState(false);

  // Configure Google Sign-In
  useEffect(() => {
    GoogleSignin.configure({
      scopes: ['email', 'profile', 'openid'],
      webClientId: '407418160129-v3c55fd6db3f8mv747p9q5tsbcmvnrik.apps.googleusercontent.com',
      iosClientId: '407418160129-8u96bsrh8j1madb0r7trr0k6ci327gds.apps.googleusercontent.com',
      offlineAccess: true,
      hostedDomain: '',
    });

    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[Profile] Session check error:', sessionError);
          return;
        }

        if (session?.user) {
          setUser(session.user);
          await loadUserProfile(session.user.id);
          await loadUserPreferences(session.user.id);
          await loadFriends(session.user.id);
          await loadFriendRequests(session.user.id);
        }
      } catch (error) {
        console.error('[Profile] Error in checkSession:', error);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await loadUserProfile(session.user.id);
        await loadUserPreferences(session.user.id);
        await loadFriends(session.user.id);
        await loadFriendRequests(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setFriends([]);
        setFriendRequests([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error);
        return;
      }

      if (data) {
        setProfile(data);
        // Initialize edit form with current profile data
        setEditForm({
          full_name: data.full_name || '',
          bio: data.bio || '',
          avatar_url: data.avatar_url || '',
          username: data.username || ''
        });
      } else {
        // Create default profile
        const defaultProfile: UserProfile = {
          id: userId,
          full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
          avatar_url: user?.user_metadata?.avatar_url || '',
          bio: '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          username: '',
          created_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('profiles')
          .insert(defaultProfile);

        if (!insertError) {
          setProfile(defaultProfile);
          setEditForm({
            full_name: defaultProfile.full_name,
            bio: defaultProfile.bio,
            avatar_url: defaultProfile.avatar_url,
            username: defaultProfile.username
          });
        }
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
    }
  };

  const loadUserPreferences = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading preferences:', error);
        return;
      }

      if (data) {
        setPreferences({
          theme: data.theme || 'system',
          notifications_enabled: data.notifications_enabled ?? true,
          default_view: data.default_view || 'day',
          email_notifications: data.email_notifications ?? true,
          push_notifications: data.push_notifications ?? true
        });
      } else {
        // Create default preferences
        const defaultPreferences: UserPreferences = {
          theme: 'system',
          notifications_enabled: true,
          default_view: 'day',
          email_notifications: true,
          push_notifications: true
        };

        const { error: insertError } = await supabase
          .from('user_preferences')
          .insert({
            user_id: userId,
            ...defaultPreferences,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (!insertError) {
          setPreferences(defaultPreferences);
        }
      }
    } catch (error) {
      console.error('Error in loadUserPreferences:', error);
    }
  };

  // Friends functions
  const loadFriends = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_user_friends', {
        user_uuid: userId
      });

      if (error) {
        console.error('Error loading friends:', error);
        return;
      }

      setFriends(data || []);
    } catch (error) {
      console.error('Error in loadFriends:', error);
    }
  };

  const loadFriendRequests = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_pending_friend_requests', {
        user_uuid: userId
      });

      if (error) {
        console.error('Error loading friend requests:', error);
        return;
      }

      setFriendRequests(data || []);
    } catch (error) {
      console.error('Error in loadFriendRequests:', error);
    }
  };

  const searchUsers = async (term: string) => {
    if (!user || !term.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const { data, error } = await supabase.rpc('search_users', {
        search_term: term.trim(),
        current_user_id: user.id
      });

      if (error) {
        console.error('Error searching users:', error);
        return;
      }

      setSearchResults(data || []);
    } catch (error) {
      console.error('Error in searchUsers:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (friendId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .insert({
          user_id: user.id,
          friend_id: friendId,
          status: 'pending'
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          Alert.alert('Error', 'Friend request already sent or friendship already exists.');
        } else {
          throw error;
        }
        return;
      }

      Alert.alert('Success', 'Friend request sent!');
      // Refresh search results to update the UI
      await searchUsers(searchTerm);
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request. Please try again.');
    }
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

      if (error) throw error;

      Alert.alert('Success', 'Friend request accepted!');
      // Refresh both friends and requests
      if (user) {
        await loadFriends(user.id);
        await loadFriendRequests(user.id);
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request. Please try again.');
    }
  };

  const declineFriendRequest = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;

      Alert.alert('Success', 'Friend request declined.');
      // Refresh requests
      if (user) {
        await loadFriendRequests(user.id);
      }
    } catch (error) {
      console.error('Error declining friend request:', error);
      Alert.alert('Error', 'Failed to decline friend request. Please try again.');
    }
  };

  const removeFriend = async (friendshipId: string) => {
    Alert.alert(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('friendships')
                .delete()
                .eq('id', friendshipId);

              if (error) throw error;

              Alert.alert('Success', 'Friend removed.');
              // Refresh friends
              if (user) {
                await loadFriends(user.id);
              }
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleSearch = (text: string) => {
    setSearchTerm(text);
    if (text.trim()) {
      searchUsers(text);
    } else {
      setSearchResults([]);
    }
  };

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      await GoogleSignin.hasPlayServices();
      const signInResponse = await GoogleSignin.signIn();
      
      const { idToken } = await GoogleSignin.getTokens();
  
      if (!idToken) {
        throw new Error('No ID token present');
      }
  
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
  
      if (error) {
        Alert.alert('Error', 'Failed to sign in. Please try again.');
      } else {
        setUser(data.user ?? null);
      }
    } catch (error: any) {
      console.error('[Profile] Sign in error:', error);
      
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Error', 'An unexpected error occurred during sign in.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await GoogleSignin.revokeAccess();
              await GoogleSignin.signOut();
              
              const { error } = await supabase.auth.signOut();
              if (error) {
                throw error;
              }
              
              setUser(null);
              setProfile(null);
            } catch (error) {
              console.error('Error in handleSignOut:', error);
              Alert.alert('Error', 'There was a problem signing out. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handlePreferenceChange = async (key: keyof UserPreferences, value: any) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          [key]: value,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      setPreferences(prev => ({ ...prev, [key]: value }));
    } catch (error) {
      console.error('Error updating preference:', error);
      Alert.alert('Error', 'Failed to update preference');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete user data from all tables
              const { error } = await supabase.rpc('delete_user_data', {
                user_id: user?.id
              });

              if (error) throw error;

              // Sign out
              await supabase.auth.signOut();
              setUser(null);
              setProfile(null);
              
              Alert.alert('Success', 'Your account has been deleted.');
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleEditProfile = () => {
    // Initialize edit form with current profile data
    setEditForm({
      full_name: profile?.full_name || '',
      bio: profile?.bio || '',
      avatar_url: profile?.avatar_url || '',
      username: profile?.username || ''
    });
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) return;

    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name.trim(),
          bio: editForm.bio.trim(),
          avatar_url: editForm.avatar_url.trim(),
          username: editForm.username.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update local state
      setProfile(prev => prev ? {
        ...prev,
        full_name: editForm.full_name.trim(),
        bio: editForm.bio.trim(),
        avatar_url: editForm.avatar_url.trim(),
        username: editForm.username.trim()
      } : null);

      setIsEditingProfile(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset form to original values
    setEditForm({
      full_name: profile?.full_name || '',
      bio: profile?.bio || '',
      avatar_url: profile?.avatar_url || '',
      username: profile?.username || ''
    });
    setIsEditingProfile(false);
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return false;
    }
    return true;
  };

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Media library permission is required to select photos.');
      return false;
    }
    return true;
  };

  const handleImagePicker = async (source: 'camera' | 'library') => {
    try {
      let permissionGranted = false;
      
      if (source === 'camera') {
        permissionGranted = await requestCameraPermission();
      } else {
        permissionGranted = await requestMediaLibraryPermission();
      }

      if (!permissionGranted) return;

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };

      let result;
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const uploadImage = async (uri: string) => {
    if (!user) return;

    setIsUploadingImage(true);
    try {
      // Convert image to base64
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Create a unique filename
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      console.log('Uploading file:', fileName);

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', data);

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('Public URL:', publicUrl);

      // Update the profile with the new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // Update local state
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      setEditForm(prev => ({ ...prev, avatar_url: publicUrl }));

      Alert.alert('Success', 'Profile photo updated successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const showImagePickerOptions = () => {
    Alert.alert(
      'Change Profile Photo',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: () => handleImagePicker('camera') },
        { text: 'Choose from Library', onPress: () => handleImagePicker('library') },
      ]
    );
  };

  const renderProfileHeader = () => (
    <View style={styles.profileHeader}>
      <View style={styles.avatarContainer}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={40} color="#fff" />
          </View>
        )}
        <TouchableOpacity 
          style={styles.editAvatarButton}
          onPress={showImagePickerOptions}
        >
          <Ionicons name="camera" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.profileInfo}>
        <Text style={styles.profileName}>
          {profile?.full_name || user?.user_metadata?.full_name || 'Your Name'}
        </Text>
        <Text style={styles.profileEmail}>
          {user?.email || 'email@example.com'}
        </Text>
        {profile?.bio && (
          <Text style={styles.profileBio}>{profile.bio}</Text>
        )}
      </View>

      <TouchableOpacity 
        style={styles.editProfileButton}
        onPress={handleEditProfile}
      >
        <Ionicons name="pencil" size={16} color="#007AFF" />
        <Text style={styles.editProfileText}>Edit</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEditProfileModal = () => (
    <Modal
      visible={isEditingProfile}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancelEdit}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleCancelEdit} style={styles.modalCancelButton}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Profile</Text>
          <TouchableOpacity 
            onPress={handleSaveProfile} 
            style={[styles.modalSaveButton, isSavingProfile && styles.modalSaveButtonDisabled]}
            disabled={isSavingProfile}
          >
            <Text style={[styles.modalSaveText, isSavingProfile && styles.modalSaveTextDisabled]}>
              {isSavingProfile ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.editAvatarSection}>
            <View style={styles.editAvatarContainer}>
              {editForm.avatar_url ? (
                <Image source={{ uri: editForm.avatar_url }} style={styles.editAvatar} />
              ) : (
                <View style={styles.editAvatarPlaceholder}>
                  <Ionicons name="person" size={40} color="#fff" />
                </View>
              )}
              <TouchableOpacity 
                style={styles.editAvatarButton}
                onPress={showImagePickerOptions}
              >
                <Ionicons name="camera" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.editAvatarLabel}>Profile Picture</Text>
            {isUploadingImage && (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.uploadingText}>Uploading...</Text>
              </View>
            )}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Full Name</Text>
            <TextInput
              style={styles.formInput}
              value={editForm.full_name}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, full_name: text }))}
              placeholder="Enter your full name"
              placeholderTextColor="#999"
              maxLength={50}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Username</Text>
            <TextInput
              style={styles.formInput}
              value={editForm.username}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, username: text }))}
              placeholder="Enter your username"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Bio</Text>
            <TextInput
              style={[styles.formInput, styles.bioInput]}
              value={editForm.bio}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, bio: text }))}
              placeholder="Tell us about yourself"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              maxLength={200}
            />
            <Text style={styles.characterCount}>
              {editForm.bio.length}/200
            </Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Avatar URL (Optional)</Text>
            <TextInput
              style={styles.formInput}
              value={editForm.avatar_url}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, avatar_url: text }))}
              placeholder="Enter image URL"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  // Friends rendering functions
  const renderFriendItem = (friend: Friend, index: number) => (
    <View key={`friend-${friend.friendship_id}-${index}`} style={styles.friendItem}>
      <View style={styles.friendInfo}>
        {friend.friend_avatar ? (
          <Image source={{ uri: friend.friend_avatar }} style={styles.friendAvatar} />
        ) : (
          <View style={styles.friendAvatarPlaceholder}>
            <Ionicons name="person" size={16} color="#fff" />
          </View>
        )}
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{friend.friend_name}</Text>
          <Text style={styles.friendUsername}>@{friend.friend_username || 'no-username'}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeFriendButton}
        onPress={() => removeFriend(friend.friendship_id)}
      >
        <Ionicons name="close" size={16} color="#999" />
      </TouchableOpacity>
    </View>
  );

  const renderFriendRequestItem = (request: FriendRequest, index: number) => (
    <View key={`request-${request.friendship_id}-${index}`} style={styles.friendItem}>
      <View style={styles.friendInfo}>
        {request.requester_avatar ? (
          <Image source={{ uri: request.requester_avatar }} style={styles.friendAvatar} />
        ) : (
          <View style={styles.friendAvatarPlaceholder}>
            <Ionicons name="person" size={16} color="#fff" />
          </View>
        )}
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{request.requester_name}</Text>
          <Text style={styles.friendUsername}>@{request.requester_username || 'no-username'}</Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => acceptFriendRequest(request.friendship_id)}
        >
          <Ionicons name="checkmark" size={14} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton]}
          onPress={() => declineFriendRequest(request.friendship_id)}
        >
          <Ionicons name="close" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchResultItem = (result: SearchResult, index: number) => (
    <View key={`search-${result.user_id}-${index}`} style={styles.friendItem}>
      <View style={styles.friendInfo}>
        {result.avatar_url ? (
          <Image source={{ uri: result.avatar_url }} style={styles.friendAvatar} />
        ) : (
          <View style={styles.friendAvatarPlaceholder}>
            <Ionicons name="person" size={16} color="#fff" />
          </View>
        )}
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{result.full_name}</Text>
          <Text style={styles.friendUsername}>@{result.username || 'no-username'}</Text>
        </View>
      </View>
      {result.is_friend ? (
        <View style={styles.friendStatus}>
          <Ionicons name="checkmark-circle" size={16} color="#34C759" />
          <Text style={styles.friendStatusText}>Friends</Text>
        </View>
      ) : result.friendship_status === 'pending' ? (
        <View style={styles.friendStatus}>
          <Ionicons name="time" size={16} color="#FF9500" />
          <Text style={styles.friendStatusText}>Pending</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addFriendButton}
          onPress={() => sendFriendRequest(result.user_id)}
        >
          <Ionicons name="add" size={16} color="#007AFF" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFriendsModal = () => (
    <Modal
      visible={showFriendsModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFriendsModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowFriendsModal(false)} style={styles.modalCancelButton}>
            <Text style={styles.modalCancelText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Friends</Text>
          <View style={styles.modalHeaderSpacer} />
        </View>

        <View style={styles.friendsTabBar}>
          <TouchableOpacity
            style={[styles.friendsTab, activeFriendsTab === 'friends' && styles.activeFriendsTab]}
            onPress={() => setActiveFriendsTab('friends')}
          >
            <Text style={[styles.friendsTabText, activeFriendsTab === 'friends' && styles.activeFriendsTabText]}>
              Friends
            </Text>
            {friends.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{friends.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.friendsTab, activeFriendsTab === 'requests' && styles.activeFriendsTab]}
            onPress={() => setActiveFriendsTab('requests')}
          >
            <Text style={[styles.friendsTabText, activeFriendsTab === 'requests' && styles.activeFriendsTabText]}>
              Requests
            </Text>
            {friendRequests.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{friendRequests.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.friendsTab, activeFriendsTab === 'search' && styles.activeFriendsTab]}
            onPress={() => setActiveFriendsTab('search')}
          >
            <Text style={[styles.friendsTabText, activeFriendsTab === 'search' && styles.activeFriendsTabText]}>
              Find Friends
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.friendsContent}>
          {activeFriendsTab === 'friends' && (
            <ScrollView style={styles.friendsList} showsVerticalScrollIndicator={false}>
              {friends.length === 0 ? (
                <View style={styles.emptyFriendsState}>
                  <Ionicons name="people-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyFriendsTitle}>No Friends Yet</Text>
                  <Text style={styles.emptyFriendsText}>
                    Start by searching for friends or accepting friend requests!
                  </Text>
                </View>
              ) : (
                friends.map((friend, index) => renderFriendItem(friend, index))
              )}
            </ScrollView>
          )}

          {activeFriendsTab === 'requests' && (
            <ScrollView style={styles.friendsList} showsVerticalScrollIndicator={false}>
              {friendRequests.length === 0 ? (
                <View style={styles.emptyFriendsState}>
                  <Ionicons name="mail-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyFriendsTitle}>No Friend Requests</Text>
                  <Text style={styles.emptyFriendsText}>
                    When someone sends you a friend request, it will appear here.
                  </Text>
                </View>
              ) : (
                friendRequests.map((request, index) => renderFriendRequestItem(request, index))
              )}
            </ScrollView>
          )}

          {activeFriendsTab === 'search' && (
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                value={searchTerm}
                onChangeText={handleSearch}
                placeholder="Search by name or username..."
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {isSearching && (
                <ActivityIndicator style={styles.searchLoading} color="#007AFF" />
              )}
              <ScrollView style={styles.searchResults} showsVerticalScrollIndicator={false}>
                {searchResults.map((result, index) => renderSearchResultItem(result, index))}
              </ScrollView>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderFriendsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Friends</Text>
        <TouchableOpacity 
          style={styles.friendsButton}
          onPress={() => setShowFriendsModal(true)}
        >
          <Ionicons name="people" size={20} color="#007AFF" />
          <Text style={styles.friendsButtonText}>
            {friends.length} Friends • {friendRequests.length} Requests
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSettingsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Settings</Text>
      
      <TouchableOpacity style={styles.settingItem}>
        <View style={styles.settingItemLeft}>
          <Ionicons name="color-palette-outline" size={22} color="#666" />
          <Text style={styles.settingLabel}>Theme</Text>
        </View>
        <View style={styles.settingItemRight}>
          <Text style={styles.settingValue}>
            {preferences.theme.charAt(0).toUpperCase() + preferences.theme.slice(1)}
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </View>
      </TouchableOpacity>

      <View style={styles.settingItem}>
        <View style={styles.settingItemLeft}>
          <Ionicons name="notifications-outline" size={22} color="#666" />
          <Text style={styles.settingLabel}>Push Notifications</Text>
        </View>
        <Switch
          value={preferences.push_notifications}
          onValueChange={(value) => handlePreferenceChange('push_notifications', value)}
          trackColor={{ false: '#e0e0e0', true: '#007AFF' }}
          thumbColor="#fff"
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingItemLeft}>
          <Ionicons name="mail-outline" size={22} color="#666" />
          <Text style={styles.settingLabel}>Email Notifications</Text>
        </View>
        <Switch
          value={preferences.email_notifications}
          onValueChange={(value) => handlePreferenceChange('email_notifications', value)}
          trackColor={{ false: '#e0e0e0', true: '#007AFF' }}
          thumbColor="#fff"
        />
      </View>

      <TouchableOpacity style={styles.settingItem}>
        <View style={styles.settingItemLeft}>
          <Ionicons name="calendar-outline" size={22} color="#666" />
          <Text style={styles.settingLabel}>Default View</Text>
        </View>
        <View style={styles.settingItemRight}>
          <Text style={styles.settingValue}>
            {preferences.default_view.charAt(0).toUpperCase() + preferences.default_view.slice(1)}
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderAccountSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Account</Text>
      
      <TouchableOpacity style={styles.settingItem}>
        <View style={styles.settingItemLeft}>
          <Ionicons name="shield-outline" size={22} color="#666" />
          <Text style={styles.settingLabel}>Privacy & Security</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingItem}>
        <View style={styles.settingItemLeft}>
          <Ionicons name="cloud-download-outline" size={22} color="#666" />
          <Text style={styles.settingLabel}>Export Data</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingItem}>
        <View style={styles.settingItemLeft}>
          <Ionicons name="help-circle-outline" size={22} color="#666" />
          <Text style={styles.settingLabel}>Help & Support</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingItem}>
        <View style={styles.settingItemLeft}>
          <Ionicons name="information-circle-outline" size={22} color="#666" />
          <Text style={styles.settingLabel}>About</Text>
        </View>
        <View style={styles.settingItemRight}>
          <Text style={styles.settingValue}>v1.0.0</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderSignOutSection = () => (
    <View style={styles.section}>
      {user ? (
        <>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={styles.deleteAccountText}>Delete Account</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.signInContainer}>
          <Text style={styles.signInTitle}>Sign in to sync your data</Text>
          <GoogleSigninButton
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Light}
            onPress={handleSignIn}
            disabled={isLoading}
          />
          {isLoading && (
            <ActivityIndicator style={styles.loadingIndicator} color="#007AFF" />
          )}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {user && renderProfileHeader()}
        {user && renderFriendsSection()}
        {user && renderSettingsSection()}
        {user && renderAccountSection()}
        {renderSignOutSection()}
      </ScrollView>
      
      {renderEditProfileModal()}
      {renderFriendsModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  profileBio: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  editProfileText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  friendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendsButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f5f5f5',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  friendAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  friendUsername: {
    fontSize: 13,
    color: '#999',
  },
  removeFriendButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#f8f8f8',
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  addFriendButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#f0f8ff',
  },
  friendStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f8f8f8',
  },
  friendStatusText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  friendsTabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  friendsTab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeFriendsTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  friendsTabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  activeFriendsTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  friendsContent: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  friendsList: {
    flex: 1,
  },
  emptyFriendsState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyFriendsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyFriendsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  searchContainer: {
    flex: 1,
    padding: 20,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 20,
  },
  searchLoading: {
    position: 'absolute',
    right: 32,
    top: 32,
  },
  searchResults: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  modalCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  modalHeaderSpacer: {
    flex: 1,
  },
  modalSaveButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalSaveButtonDisabled: {
    opacity: 0.5,
  },
  modalSaveText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalSaveTextDisabled: {
    color: '#999',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  editAvatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  editAvatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  editAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  uploadingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    color: '#000',
    marginLeft: 12,
  },
  settingValue: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  signOutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  deleteAccountText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  signInContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  signInTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  loadingIndicator: {
    marginTop: 16,
  },
  tabBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
});