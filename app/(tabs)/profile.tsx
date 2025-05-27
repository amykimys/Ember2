import { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, SafeAreaView, Alert, Platform, ActivityIndicator, ScrollView, Switch, Modal, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, FlatList, StyleSheet } from 'react-native';
import { User } from '@supabase/supabase-js';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import * as Haptics from 'expo-haptics';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../supabase';
import { configureGoogleSignIn, signInWithGoogle, signOut, getCurrentSession } from '../../auth';

const defaultProfileImage = 'https://placekitten.com/200/200';

interface Friend {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  status: 'pending' | 'accepted' | 'sent' | 'none';
}

interface DatabaseUser {
  id: string;
  email: string;
  raw_user_meta_data: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface FriendshipResponse {
  friend_id?: string;
  user_id?: string;
  status: string;
  users?: DatabaseUser;
}

// Update the SocialUpdate interface to include the database response type
interface SocialUpdateResponse {
  id: string;
  user_id: string;
  type: 'goal_completion' | 'journal_entry' | 'streak_milestone';
  content: {
    message: string;
    count?: number;
    streak_days?: number;
    goal_name?: string;
  };
  is_public: boolean;
  created_at: string;
  users: {
    raw_user_meta_data: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}

interface SocialUpdate {
  id: string;
  user_id: string;
  type: 'goal_completion' | 'journal_entry' | 'streak_milestone';
  content: {
    message: string;
    count?: number;
    streak_days?: number;
    goal_name?: string;
  };
  is_public: boolean;
  created_at: string;
  user: {
    full_name: string;
    avatar_url: string | null;
  };
}

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(true);
  
  // Profile edit states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedAvatar, setEditedAvatar] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Friends states
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

  // Add new state for social updates
  const [socialUpdates, setSocialUpdates] = useState<SocialUpdate[]>([]);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(false);
  const [showFeedModal, setShowFeedModal] = useState(false);

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

  const handleEditProfile = () => {
    setEditedName(user?.user_metadata?.full_name || '');
    setEditedAvatar(user?.user_metadata?.avatar_url || null);
    setShowEditModal(true);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setEditedAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    
    setIsUpdating(true);
    try {
      let avatarUrl = editedAvatar;

      // If the avatar was changed and it's a local file, upload it
      if (editedAvatar && editedAvatar !== user.user_metadata?.avatar_url && editedAvatar.startsWith('file://')) {
        try {
          // First, try to create the bucket if it doesn't exist
          const { error: bucketError } = await supabase.storage.createBucket('avatars', {
            public: true,
            fileSizeLimit: 1024 * 1024,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif']
          });

          if (bucketError && bucketError.message !== 'Bucket already exists') {
            console.error('Bucket creation error:', bucketError);
            throw new Error('Unable to set up storage. Please contact support.');
          }

          const response = await fetch(editedAvatar);
          const blob = await response.blob();
          const fileExt = editedAvatar.split('.').pop() || 'jpg';
          const fileName = `${user.id}-${Date.now()}.${fileExt}`;
          const filePath = `avatars/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, blob, {
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            if (uploadError.message.includes('row-level security policy')) {
              throw new Error('Storage permissions not configured. Please contact support.');
            }
            throw uploadError;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

          avatarUrl = publicUrl;
        } catch (storageError: any) {
          console.error('Storage error:', storageError);
          // If there's a storage error, continue with the profile update without the new avatar
          Alert.alert(
            'Profile Picture Update Failed',
            storageError.message.includes('row-level security policy')
              ? 'Unable to update profile picture due to permission settings. Please contact support.'
              : 'Your profile information was updated, but the profile picture could not be changed. Please try again later.'
          );
        }
      }

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: editedName,
          avatar_url: avatarUrl,
        }
      });

      if (updateError) throw updateError;

      // Update local user state
      setUser(prev => prev ? {
        ...prev,
        user_metadata: {
          ...prev.user_metadata,
          full_name: editedName,
          avatar_url: avatarUrl,
        }
      } : null);

      setShowEditModal(false);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert(
        'Error',
        error.message.includes('row-level security policy')
          ? 'Unable to update profile picture due to permission settings. Please contact support.'
          : 'Failed to update profile. Please try again.'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const renderSettingItem = ({ 
    icon, 
    title, 
    value, 
    onPress, 
    showSwitch = false, 
    showChevron = true,
    showValue = false,
    valueText = '',
    iconColor = '#666'
  }: { 
    icon: React.ReactNode; 
    title: string; 
    value?: boolean; 
    onPress?: () => void; 
    showSwitch?: boolean;
    showChevron?: boolean;
    showValue?: boolean;
    valueText?: string;
    iconColor?: string;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 0,
        borderBottomColor: '#f0f0f0',
      }}
    >
      <View style={{ width: 24, alignItems: 'center', marginRight: 12 }}>
        {icon}
      </View>
      <Text style={{ flex: 1, fontSize: 16, color: '#333', fontFamily: 'Onest' }}>
        {title}
      </Text>
      {showValue && (
        <Text style={{ fontSize: 14, color: '#666', marginRight: 8, fontFamily: 'Onest' }}>
          {valueText}
        </Text>
      )}
      {showSwitch ? (
        <Switch
          value={value}
          onValueChange={onPress}
          trackColor={{ false: '#e0e0e0', true: '#FF9A8B' }}
          thumbColor="#fff"
        />
      ) : showChevron ? (
        <MaterialIcons name="chevron-right" size={24} color="#ccc" />
      ) : null}
    </TouchableOpacity>
  );

  // Add fetchFriends function
  const fetchFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setIsLoadingFriends(true);

      // Fetch accepted friends
      const { data: friendsData, error: friendsError } = await supabase
        .from('friendships')
        .select(`
          friend_id,
          status,
          users!friendships_friend_id_fkey (
            id,
            email,
            raw_user_meta_data->full_name,
            raw_user_meta_data->avatar_url
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (friendsError) throw friendsError;

      // Fetch pending friend requests
      const { data: pendingRequests, error: pendingError } = await supabase
        .from('friendships')
        .select(`
          user_id,
          status,
          users!friendships_user_id_fkey (
            id,
            email,
            raw_user_meta_data->full_name,
            raw_user_meta_data->avatar_url
          )
        `)
        .eq('friend_id', user.id)
        .eq('status', 'pending');

      if (pendingError) throw pendingError;

      // Fetch sent friend requests
      const { data: sentRequests, error: sentError } = await supabase
        .from('friendships')
        .select(`
          friend_id,
          status,
          users!friendships_friend_id_fkey (
            id,
            email,
            raw_user_meta_data->full_name,
            raw_user_meta_data->avatar_url
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (sentError) throw sentError;

      // Transform the data
      const transformedFriends = ((friendsData || []) as unknown as FriendshipResponse[]).map(f => ({
        id: f.users!.id,
        email: f.users!.email,
        full_name: f.users!.raw_user_meta_data?.full_name || 'Anonymous',
        avatar_url: f.users!.raw_user_meta_data?.avatar_url || null,
        status: 'accepted' as const
      }));

      const transformedPending = ((pendingRequests || []) as unknown as FriendshipResponse[]).map(f => ({
        id: f.users!.id,
        email: f.users!.email,
        full_name: f.users!.raw_user_meta_data?.full_name || 'Anonymous',
        avatar_url: f.users!.raw_user_meta_data?.avatar_url || null,
        status: 'pending' as const
      }));

      const transformedSent = ((sentRequests || []) as unknown as FriendshipResponse[]).map(f => ({
        id: f.users!.id,
        email: f.users!.email,
        full_name: f.users!.raw_user_meta_data?.full_name || 'Anonymous',
        avatar_url: f.users!.raw_user_meta_data?.avatar_url || null,
        status: 'sent' as const
      }));

      setFriends([...transformedFriends, ...transformedPending, ...transformedSent]);
    } catch (error) {
      console.error('Error fetching friends:', error);
      Alert.alert('Error', 'Failed to load friends. Please try again.');
    } finally {
      setIsLoadingFriends(false);
    }
  };

  // Add searchUsers function
  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsLoadingFriends(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Search users by email or name
      const { data, error } = await supabase
        .from('users')
        .select('id, email, raw_user_meta_data->full_name, raw_user_meta_data->avatar_url')
        .or(`email.ilike.%${query}%,raw_user_meta_data->full_name.ilike.%${query}%`)
        .neq('id', user.id)
        .limit(10);

      if (error) throw error;

      // Filter out users who are already friends or have pending requests
      const existingFriendIds = new Set(friends.map(f => f.id));
      const filteredResults = ((data || []) as unknown as DatabaseUser[])
        .filter(user => !existingFriendIds.has(user.id))
        .map(user => ({
          id: user.id,
          email: user.email,
          full_name: user.raw_user_meta_data?.full_name || 'Anonymous',
          avatar_url: user.raw_user_meta_data?.avatar_url || null,
          status: 'none' as const
        }));

      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users. Please try again.');
    } finally {
      setIsLoadingFriends(false);
    }
  };

  // Add friend request functions
  const sendFriendRequest = async (friendId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('friendships')
        .insert({
          user_id: user.id,
          friend_id: friendId,
          status: 'pending'
        });

      if (error) throw error;

      // Update local state
      const newFriend = searchResults.find(f => f.id === friendId);
      if (newFriend) {
        setFriends(prev => [...prev, { ...newFriend, status: 'sent' }]);
        setSearchResults(prev => prev.filter(f => f.id !== friendId));
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request. Please try again.');
    }
  };

  const handleFriendRequest = async (friendId: string, accept: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (accept) {
        const { error } = await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('user_id', friendId)
          .eq('friend_id', user.id)
          .eq('status', 'pending');

        if (error) throw error;

        // Update local state
        setFriends(prev => prev.map(f => 
          f.id === friendId ? { ...f, status: 'accepted' } : f
        ));
      } else {
        const { error } = await supabase
          .from('friendships')
          .delete()
          .eq('user_id', friendId)
          .eq('friend_id', user.id)
          .eq('status', 'pending');

        if (error) throw error;

        // Update local state
        setFriends(prev => prev.filter(f => f.id !== friendId));
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error handling friend request:', error);
      Alert.alert('Error', 'Failed to handle friend request. Please try again.');
    }
  };

  // Add friend list item renderers
  const renderFriendItem = ({ item }: { item: Friend }) => (
    <View style={styles.friendItem}>
      <Image
        source={{ uri: item.avatar_url || 'https://placekitten.com/200/200' }}
        style={styles.avatar}
      />
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.full_name}</Text>
        <Text style={styles.friendEmail}>{item.email}</Text>
      </View>
      {item.status === 'pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleFriendRequest(item.id, true)}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleFriendRequest(item.id, false)}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      {item.status === 'sent' && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Sent</Text>
        </View>
      )}
    </View>
  );

  const renderSearchResult = ({ item }: { item: Friend }) => (
    <View style={styles.friendItem}>
      <Image
        source={{ uri: item.avatar_url || 'https://placekitten.com/200/200' }}
        style={styles.avatar}
      />
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.full_name}</Text>
        <Text style={styles.friendEmail}>{item.email}</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => sendFriendRequest(item.id)}
      >
        <Ionicons name="person-add" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  // Add function to fetch social updates
  const fetchSocialUpdates = async () => {
    try {
      setIsLoadingUpdates(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('social_updates')
        .select(`
          id,
          user_id,
          type,
          content,
          is_public,
          created_at,
          users!social_updates_user_id_fkey (
            raw_user_meta_data->full_name,
            raw_user_meta_data->avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const transformedUpdates = ((data || []) as unknown as SocialUpdateResponse[]).map(update => ({
        ...update,
        user: {
          full_name: update.users.raw_user_meta_data?.full_name || 'Anonymous',
          avatar_url: update.users.raw_user_meta_data?.avatar_url || null,
        }
      }));

      setSocialUpdates(transformedUpdates);
    } catch (error) {
      console.error('Error fetching social updates:', error);
      Alert.alert('Error', 'Failed to load friend updates. Please try again.');
    } finally {
      setIsLoadingUpdates(false);
    }
  };

  // Add function to render update message
  const renderUpdateMessage = (update: SocialUpdate) => {
    switch (update.type) {
      case 'goal_completion':
        return `${update.user.full_name} completed ${update.content.count} goals today! 🌱`;
      case 'journal_entry':
        return `${update.user.full_name} journaled today 📝`;
      case 'streak_milestone':
        return `${update.user.full_name} hit a ${update.content.streak_days}-day streak! 🔥`;
      default:
        return update.content.message;
    }
  };

  // Add function to render social update item
  const renderSocialUpdate = ({ item }: { item: SocialUpdate }) => (
    <View style={styles.updateItem}>
      <Image
        source={{ uri: item.user.avatar_url || defaultProfileImage }}
        style={styles.updateAvatar}
      />
      <View style={styles.updateContent}>
        <Text style={styles.updateMessage}>
          {renderUpdateMessage(item)}
        </Text>
        <Text style={styles.updateTime}>
          {new Date(item.created_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
          })}
        </Text>
      </View>
    </View>
  );

  // Add friends section to the profile screen
  const renderFriendsSection = () => (
    <View style={{ marginTop: 20 }}>
      <Text style={{ 
        fontSize: 14, 
        fontWeight: '600', 
        color: '#666',
        marginLeft: 16,
        marginBottom: 8,
        fontFamily: 'Onest'
      }}>
        SOCIAL
      </Text>
      <View style={{ backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, overflow: 'hidden' }}>
        {renderSettingItem({
          icon: <Ionicons name="people-outline" size={22} color="#666" />,
          title: 'Friends',
          onPress: () => {
            fetchFriends();
            setShowFriendsModal(true);
          },
          showValue: true,
          valueText: `${friends.filter(f => f.status === 'accepted').length} friends`
        })}
        {renderSettingItem({
          icon: <Ionicons name="newspaper-outline" size={22} color="#666" />,
          title: 'Friend Feed',
          onPress: () => {
            fetchSocialUpdates();
            setShowFeedModal(true);
          },
          showValue: true,
          valueText: `${socialUpdates.length} updates`
        })}
      </View>
    </View>
  );

  // Add friends modal
  const renderFriendsModal = () => (
    <Modal
      visible={showFriendsModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFriendsModal(false)}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#f0f0f0'
          }}>
            <TouchableOpacity
              onPress={() => setShowFriendsModal(false)}
              style={{ padding: 4 }}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={{ 
              fontSize: 18, 
              fontWeight: '600',
              color: '#333',
              fontFamily: 'Onest'
            }}>
              Friends
            </Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or email"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                searchUsers(text);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
              onPress={() => setActiveTab('friends')}
            >
              <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
                Friends
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
              onPress={() => setActiveTab('requests')}
            >
              <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
                Requests
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {isLoadingFriends ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF9A8B" />
            </View>
          ) : searchQuery.length > 0 ? (
            // Search Results
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No users found</Text>
              }
            />
          ) : (
            // Friends/Requests List
            <FlatList
              data={friends.filter(f => 
                activeTab === 'friends' 
                  ? f.status === 'accepted' || f.status === 'sent'
                  : f.status === 'pending'
              )}
              renderItem={renderFriendItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {activeTab === 'friends' 
                    ? 'No friends yet. Search to add some!'
                    : 'No pending friend requests'}
                </Text>
              }
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );

  // Add feed modal
  const renderFeedModal = () => (
    <Modal
      visible={showFeedModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFeedModal(false)}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#f0f0f0'
          }}>
            <TouchableOpacity
              onPress={() => setShowFeedModal(false)}
              style={{ padding: 4 }}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={{ 
              fontSize: 18, 
              fontWeight: '600',
              color: '#333',
              fontFamily: 'Onest'
            }}>
              Friend Feed
            </Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Feed Content */}
          {isLoadingUpdates ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF9A8B" />
            </View>
          ) : (
            <FlatList
              data={socialUpdates}
              renderItem={renderSocialUpdate}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.feedContainer}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No updates yet. Your friends' activities will appear here!
                </Text>
              }
              refreshing={isLoadingUpdates}
              onRefresh={fetchSocialUpdates}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' }}>
          <Image
            source={{ uri: defaultProfileImage }}
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
            Welcome!
          </Text>
          {isLoading ? (
            <ActivityIndicator size="large" color="#FF9A8B" />
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f8f8' }}>
      <ScrollView style={{ flex: 1 }}>
        {/* Profile Header */}
        <View style={{ 
          backgroundColor: '#fff', 
          paddingVertical: 24, 
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: '#f0f0f0'
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image
              source={{ uri: user?.user_metadata?.avatar_url || defaultProfileImage }}
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#F5F5F5',
              }}
            />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={{ 
                fontSize: 24, 
                fontWeight: '600', 
                color: '#1a1a1a',
                marginBottom: 4,
                fontFamily: 'Onest'
              }}>
                {user?.user_metadata?.full_name || 'User'}
              </Text>
              <Text style={{ 
                fontSize: 15, 
                color: '#666',
                fontFamily: 'Onest'
              }}>
                {user?.email}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleEditProfile}
              style={{
                padding: 8,
                borderRadius: 20,
                backgroundColor: '#f5f5f5'
              }}
            >
              <Feather name="edit-2" size={18} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Add Friends Section */}
        {user && renderFriendsSection()}

        {/* Settings Sections */}
        <View style={{ marginTop: 20 }}>
          <Text style={{ 
            fontSize: 14, 
            fontWeight: '600', 
            color: '#666',
            marginLeft: 16,
            marginBottom: 8,
            fontFamily: 'Onest'
          }}>
            PREFERENCES
          </Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, overflow: 'hidden' }}>
            {renderSettingItem({
              icon: <Ionicons name="notifications-outline" size={22} color="#666" />,
              title: 'Notifications',
              value: notificationsEnabled,
              onPress: () => setNotificationsEnabled(!notificationsEnabled),
              showSwitch: true
            })}
            {renderSettingItem({
              icon: <Ionicons name="moon-outline" size={22} color="#666" />,
              title: 'Dark Mode',
              value: darkModeEnabled,
              onPress: () => setDarkModeEnabled(!darkModeEnabled),
              showSwitch: true
            })}
            {renderSettingItem({
              icon: <Ionicons name="sync-outline" size={22} color="#666" />,
              title: 'Sync',
              value: syncEnabled,
              onPress: () => setSyncEnabled(!syncEnabled),
              showSwitch: true
            })}
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={{ 
            fontSize: 14, 
            fontWeight: '600', 
            color: '#666',
            marginLeft: 16,
            marginBottom: 8,
            fontFamily: 'Onest'
          }}>
            ACCOUNT
          </Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, overflow: 'hidden' }}>
            {renderSettingItem({
              icon: <Ionicons name="person-outline" size={22} color="#666" />,
              title: 'Account Settings',
              onPress: () => {/* TODO: Navigate to account settings */}
            })}
            {renderSettingItem({
              icon: <Ionicons name="help-circle-outline" size={22} color="#666" />,
              title: 'Help & Support',
              onPress: () => {/* TODO: Navigate to help */}
            })}
            {renderSettingItem({
              icon: <Ionicons name="information-circle-outline" size={22} color="#666" />,
              title: 'About',
              onPress: () => {/* TODO: Show about modal */}
            })}
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          onPress={handleSignOut}
          style={{
            marginHorizontal: 16,
            marginTop: 20,
            marginBottom: 32,
            backgroundColor: '#fff',
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#FF3B30',
          }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FF3B30" />
          ) : (
            <Text style={{ 
              color: '#FF3B30',
              fontSize: 16,
              fontWeight: '600',
              fontFamily: 'Onest'
            }}>
              Sign Out
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ 
              flex: 1, 
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              justifyContent: 'flex-end'
            }}>
              <View style={{ 
                backgroundColor: '#fff',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 20,
                paddingBottom: Platform.OS === 'ios' ? 40 : 20,
              }}>
                <View style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 20
                }}>
                  <Text style={{ 
                    fontSize: 20, 
                    fontWeight: '600',
                    color: '#1a1a1a',
                    fontFamily: 'Onest'
                  }}>
                    Edit Profile
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowEditModal(false)}
                    style={{ padding: 4 }}
                  >
                    <MaterialIcons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                  <TouchableOpacity onPress={pickImage}>
                    <Image
                      source={{ uri: editedAvatar || defaultProfileImage }}
                      style={{
                        width: 100,
                        height: 100,
                        borderRadius: 50,
                        backgroundColor: '#F5F5F5',
                      }}
                    />
                    <View style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      backgroundColor: '#fff',
                      borderRadius: 15,
                      padding: 6,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 2,
                    }}>
                      <Feather name="camera" size={18} color="#666" />
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={{ marginBottom: 20 }}>
                  <Text style={{ 
                    fontSize: 14,
                    color: '#666',
                    marginBottom: 8,
                    fontFamily: 'Onest'
                  }}>
                    Name
                  </Text>
                  <TextInput
                    value={editedName}
                    onChangeText={setEditedName}
                    style={{
                      borderWidth: 1,
                      borderColor: '#e0e0e0',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 16,
                      color: '#1a1a1a',
                      fontFamily: 'Onest'
                    }}
                    placeholder="Enter your name"
                    placeholderTextColor="#999"
                  />
                </View>

                <TouchableOpacity
                  onPress={handleUpdateProfile}
                  disabled={isUpdating}
                  style={{
                    backgroundColor: '#FF9A8B',
                    paddingVertical: 14,
                    borderRadius: 8,
                    alignItems: 'center',
                    opacity: isUpdating ? 0.7 : 1
                  }}
                >
                  {isUpdating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ 
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: '600',
                      fontFamily: 'Onest'
                    }}>
                      Save Changes
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Friends Modal */}
      {user && renderFriendsModal()}

      {/* Add Feed Modal */}
      {user && renderFeedModal()}
    </SafeAreaView>
  );
}

// Add friend-related styles
const styles = StyleSheet.create({
  // ... existing styles ...

  // Friend-related styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    margin: 16,
    borderRadius: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontFamily: 'Onest',
  },
  clearButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#f0f0f0',
  },
  activeTab: {
    borderBottomColor: '#FF9A8B',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Onest',
  },
  activeTabText: {
    color: '#FF9A8B',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Onest',
  },
  friendEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
    fontFamily: 'Onest',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF9A8B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Onest',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 32,
    fontFamily: 'Onest',
  },
  updateItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  updateAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  updateContent: {
    flex: 1,
    marginLeft: 12,
  },
  updateMessage: {
    fontSize: 15,
    color: '#333',
    fontFamily: 'Onest',
    lineHeight: 20,
  },
  updateTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontFamily: 'Onest',
  },
  feedContainer: {
    padding: 16,
  },
});
