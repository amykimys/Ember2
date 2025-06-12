import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Alert, ScrollView, StyleSheet, ActivityIndicator, Switch, Image, Modal, TextInput, FlatList, Dimensions } from 'react-native';
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

// Memories interfaces
interface MemoryItem {
  id: string;
  photoUri: string;
  date: string;
  type: 'habit' | 'event';
  title: string;
  description?: string;
  categoryColor?: string;
}

interface MemoryGroup {
  date: string;
  formattedDate: string;
  memories: MemoryItem[];
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

  // Memories state
  const [memories, setMemories] = useState<MemoryGroup[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [showMemoriesModal, setShowMemoriesModal] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);
  const [showMemoryDetailModal, setShowMemoryDetailModal] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // Settings state
  const [showSettingsModal, setShowSettingsModal] = useState(false);

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
          await loadMemories(session.user.id);
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
        await loadMemories(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
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
      // Get all accepted friendships where the current user is involved
      const { data: friendshipsData, error: friendshipsError } = await supabase
        .from('friendships')
        .select('id, user_id, friend_id, status, created_at')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (friendshipsError) {
        console.error('Error loading friendships:', friendshipsError);
            return;
          }

      if (!friendshipsData || friendshipsData.length === 0) {
        setFriends([]);
        return;
      }

      // Get the friend IDs (the other user in each friendship)
      const friendIds = friendshipsData.map(friendship => 
        friendship.user_id === userId ? friendship.friend_id : friendship.user_id
      );

      // Fetch the friend profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username')
        .in('id', friendIds);

      if (profilesError) {
        console.error('Error loading friend profiles:', profilesError);
        return;
      }

      // Create a map of profiles by ID for quick lookup
      const profilesMap = new Map();
      if (profilesData) {
        for (const profile of profilesData) {
          profilesMap.set(profile.id, profile);
        }
      }

      // Combine the data
      const friends: Friend[] = friendshipsData.map(friendship => {
        const friendId = friendship.user_id === userId ? friendship.friend_id : friendship.user_id;
        const profile = profilesMap.get(friendId);
        return {
          friend_id: friendId,
          friend_name: profile?.full_name || 'Unknown User',
          friend_avatar: profile?.avatar_url || '',
          friend_username: profile?.username || '',
          friendship_id: friendship.id,
          status: friendship.status,
          created_at: friendship.created_at
        };
      });

      setFriends(friends);
    } catch (error) {
      console.error('Error in loadFriends:', error);
    }
  };

  const loadFriendRequests = async (userId: string) => {
    try {
      console.log('🔍 Loading friend requests for user:', userId);
      
      // First get the friend requests (where current user is the recipient)
      const { data: requestsData, error: requestsError } = await supabase
        .from('friendships')
        .select('id, user_id, friend_id, status, created_at')
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (requestsError) {
        console.error('Error loading friend requests:', requestsError);
          return;
        }

      console.log('📨 Found friend requests:', requestsData);

      if (!requestsData || requestsData.length === 0) {
        setFriendRequests([]);
        return;
      }

      // Get the requester IDs (user_id is the requester, friend_id is the recipient)
      const requesterIds = requestsData.map(request => request.user_id);
      console.log('👥 Requester IDs:', requesterIds);

      // Fetch the requester profiles using direct query
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username')
        .in('id', requesterIds);

      if (profilesError) {
        console.error('Error loading requester profiles:', profilesError);
        return;
      }

      console.log('👤 Found profiles:', profilesData);

      // Create a map of profiles by ID for quick lookup
      const profilesMap = new Map();
      profilesData?.forEach((profile: any) => {
        profilesMap.set(profile.id, profile);
      });

      // Combine the data
      const requests: FriendRequest[] = requestsData.map(request => {
        const profile = profilesMap.get(request.user_id);
        console.log(`🔗 Request ${request.id}: user_id=${request.user_id}, profile=`, profile);
        return {
          friendship_id: request.id,
          requester_id: request.user_id,
          requester_name: profile?.full_name || 'Unknown User',
          requester_avatar: profile?.avatar_url || '',
          requester_username: profile?.username || '',
          created_at: request.created_at || request.id
        };
      });

      console.log('✅ Final friend requests:', requests);
      setFriendRequests(requests);
    } catch (error) {
      console.error('Error in loadFriendRequests:', error);
    }
  };

  const checkSupabaseStorage = async () => {
    try {
      console.log('🔍 Checking Supabase storage access...');
      
      // Test if we can access the habit-photos bucket
      const { data: storageData, error: storageError } = await supabase.storage
        .from('habit-photos')
        .list('', { limit: 1 });

      if (storageError) {
        console.error('❌ Supabase storage error:', storageError);
        return false;
      }

      console.log('✅ Supabase storage is accessible');
      console.log('📁 Storage contents:', storageData);
      return true;
    } catch (error) {
      console.error('❌ Error checking Supabase storage:', error);
      return false;
    }
  };

  const cleanupOldLocalPhotos = async (userId: string) => {
    try {
      console.log('🧹 Cleaning up old local photos for user:', userId);
      
      // Fetch all habits with photos
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, photos')
        .eq('user_id', userId)
        .not('photos', 'is', null);

      if (habitsError) {
        console.error('Error fetching habits for cleanup:', habitsError);
        return;
      }

      if (!habitsData || habitsData.length === 0) {
        console.log('🧹 No habits with photos found for cleanup');
        return;
      }

      console.log(`🧹 Found ${habitsData.length} habits to check for cleanup`);

      let cleanedCount = 0;
      const updates: any[] = [];

      habitsData.forEach(habit => {
        console.log(`🧹 Checking habit ${habit.id}:`, habit.photos);
        
        if (habit.photos && typeof habit.photos === 'object') {
          const cleanedPhotos: { [date: string]: string } = {};
          let hasChanges = false;

          for (const [date, photoUri] of Object.entries(habit.photos)) {
            if (photoUri && typeof photoUri === 'string') {
              // More comprehensive check for local file names
              const isLocalFileName = (
                !photoUri.includes('/') && 
                !photoUri.includes('\\') && 
                photoUri.includes('.') && 
                !photoUri.startsWith('http') && 
                !photoUri.startsWith('file://') && 
                !photoUri.startsWith('data:') &&
                photoUri.length < 100 // Local file names are typically short
              );
              
              console.log(`🧹 Photo ${date}: ${photoUri} - isLocalFileName: ${isLocalFileName}`);
              
              if (isLocalFileName) {
                console.log(`🧹 Removing local file name from habit ${habit.id}, date ${date}: ${photoUri}`);
                hasChanges = true;
                // Don't add this to cleanedPhotos - effectively removing it
              } else {
                // Keep valid URLs
                cleanedPhotos[date] = photoUri;
                console.log(`🧹 Keeping valid photo for habit ${habit.id}, date ${date}: ${photoUri}`);
              }
            }
          }

          if (hasChanges) {
            console.log(`🧹 Updating habit ${habit.id} with cleaned photos:`, cleanedPhotos);
            
            // If all photos were local file names (cleanedPhotos is empty), remove the photos object entirely
            const updateData = Object.keys(cleanedPhotos).length > 0 
              ? { photos: cleanedPhotos }
              : { photos: null };
            
            console.log(`🧹 Final update data for habit ${habit.id}:`, updateData);
            updates.push({ habitId: habit.id, updateData });
            cleanedCount++;
          } else {
            console.log(`🧹 No changes needed for habit ${habit.id}`);
          }
        }
      });

      if (updates.length > 0) {
        console.log(`🧹 Applying ${updates.length} updates to clean up local photos`);
        for (const update of updates) {
          const { error } = await supabase
            .from('habits')
            .update(update.updateData)
            .eq('id', update.habitId);
          
          if (error) {
            console.error(`🧹 Error updating habit ${update.habitId}:`, error);
          } else {
            console.log(`🧹 Successfully updated habit ${update.habitId}`);
          }
        }
        console.log(`🧹 Successfully cleaned up ${cleanedCount} habits with local photos`);
      } else {
        console.log('🧹 No local photos found to clean up');
      }
    } catch (error) {
      console.error('Error cleaning up old local photos:', error);
    }
  };

  const forceRefreshMemories = async (userId: string) => {
    try {
      console.log('🔄 Force refreshing memories for user:', userId);
      
      // Clear current memories state
      setMemories([]);
      setFailedImages(new Set());
      
      // Check Supabase storage first
      console.log('🔍 Checking Supabase storage before cleanup...');
      const storageAccessible = await checkSupabaseStorage();
      
      // Force cleanup
      await cleanupOldLocalPhotos(userId);
      
      // Wait for database updates
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check database state
      await checkDatabaseState(userId);
      
      // Force fresh load
      await loadMemories(userId);
      
      console.log('🔄 Force refresh completed');
      
      if (!storageAccessible) {
        console.warn('⚠️ Supabase storage may have issues - this could affect photo loading');
      }
    } catch (error) {
      console.error('Error in force refresh:', error);
    }
  };

  const loadMemories = async (userId: string) => {
    try {
      setIsLoadingMemories(true);
      console.log('🖼️ Loading memories for user:', userId);

      // Clear any existing failed images
      setFailedImages(new Set());

      // First, clean up any old local photos
      await cleanupOldLocalPhotos(userId);
      
      // Add a small delay to ensure database updates are processed
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('⏳ Waited 500ms for database updates to process');

      const allMemories: MemoryItem[] = [];

      // Fetch habits with photos - force fresh data
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, text, description, photos, category_id, categories(color)')
        .eq('user_id', userId)
        .not('photos', 'is', null);

      if (habitsError) {
        console.error('Error fetching habits with photos:', habitsError);
        Alert.alert('Error', 'Failed to load memories. Please try again.');
        return;
      } else if (habitsData) {
        console.log('📸 Found habits with photos:', habitsData.length);
        console.log('📸 Habits data after cleanup:', habitsData);
        
        habitsData.forEach(habit => {
          console.log(`🔍 Processing habit ${habit.id}:`, {
            text: habit.text,
            photos: habit.photos,
            photosType: typeof habit.photos,
            isObject: typeof habit.photos === 'object'
          });
          
          if (habit.photos && typeof habit.photos === 'object') {
            console.log(`📷 Photos object for habit ${habit.id}:`, habit.photos);
            console.log(`📷 Photos object keys:`, Object.keys(habit.photos));
            
            for (const [date, photoUri] of Object.entries(habit.photos)) {
              console.log(`📅 Processing date ${date} with photo:`, photoUri);
              
              if (photoUri && typeof photoUri === 'string') {
                // Check if it's a valid URL or local file path
                const isValidUrl = photoUri.startsWith('http://') || photoUri.startsWith('https://');
                const isLocalFile = photoUri.startsWith('file://');
                const isDataUrl = photoUri.startsWith('data:');
                const isLocalFileName = !photoUri.includes('/') && !photoUri.includes('\\') && photoUri.includes('.');
                
                // For local file names, we need to construct the proper file path
                let processedUri = photoUri;
                if (isLocalFileName) {
                  // This is likely a local file name that needs to be handled differently
                  // We'll skip these for now as they're not accessible in this context
                  console.log(`⚠️ Skipping local file name (not accessible): ${photoUri}`);
                  continue;
                }
                
                if (isValidUrl || isLocalFile || isDataUrl) {
                  console.log(`✅ Adding memory for date ${date}:`, processedUri);
                  allMemories.push({
                    id: `${habit.id}_${date}`,
                    photoUri: processedUri,
                    date: date,
                    type: 'habit',
                    title: habit.text,
                    description: habit.description,
                    categoryColor: habit.categories?.[0]?.color
                  });
                } else {
                  console.log(`❌ Skipping invalid photo URI for date ${date}:`, photoUri);
                }
              } else {
                console.log(`❌ Skipping invalid photo for date ${date}:`, photoUri);
              }
            }
          } else {
            console.log(`❌ Habit ${habit.id} has no valid photos object:`, habit.photos);
          }
        });
      } else {
        console.log('📸 No habits with photos found');
      }

      // Note: Events don't currently have photo support, so we're only fetching from habits
      // When events get photo support in the future, we can add the events query here

      console.log('📸 Total memories found:', allMemories.length);
      console.log('📸 All memories:', allMemories);

      // Group memories by date
      const groupedMemories = allMemories.reduce((groups: { [key: string]: MemoryItem[] }, memory) => {
        const date = memory.date;
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(memory);
        return groups;
      }, {});

      console.log('📸 Grouped memories:', groupedMemories);

      // Convert to sorted array format
      const sortedMemories: MemoryGroup[] = Object.entries(groupedMemories)
        .map(([date, memories]) => ({
          date,
          formattedDate: formatMemoryDate(date),
          memories: memories.sort((a, b) => b.date.localeCompare(a.date))
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

      console.log('📸 Final sorted memories:', sortedMemories);
      setMemories(sortedMemories);
      console.log('📸 Memories organized into', sortedMemories.length, 'date groups');
      
      if (sortedMemories.length === 0) {
        console.log('⚠️ No memories found - this might be normal if no photos have been saved yet');
      }
    } catch (error) {
      console.error('Error loading memories:', error);
      Alert.alert('Error', 'Failed to load memories. Please try again.');
    } finally {
      setIsLoadingMemories(false);
    }
  };

  const formatMemoryDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    } catch (error) {
      return dateString;
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
      <TouchableOpacity style={styles.avatarContainer} onPress={handleEditProfile}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={32} color="#fff" />
          </View>
        )}
        <TouchableOpacity style={styles.editAvatarButton} onPress={showImagePickerOptions}>
          <Ionicons name="camera" size={14} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
      
      <Text style={styles.profileName}>
        {profile?.full_name || user?.user_metadata?.full_name || 'Your Name'}
      </Text>
      
      {profile?.bio && (
        <Text style={styles.profileBio}>{profile.bio}</Text>
      )}
      
      <TouchableOpacity style={styles.friendCountContainer} onPress={() => setShowFriendsModal(true)}>
        <Ionicons name="people" size={16} color="#8E8E93" />
        <Text style={styles.friendCountText}>{friends.length} friends</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFeatureCard = (icon: string, title: string, subtitle: string, count?: number, onPress?: () => void) => (
    <TouchableOpacity style={styles.featureCard} onPress={onPress}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon as any} size={24} color="#007AFF" />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureSubtitle}>{subtitle}</Text>
      </View>
      {count !== undefined && (
        <View style={styles.featureCount}>
          <Text style={styles.featureCountText}>{count}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
    </TouchableOpacity>
  );

  const renderSettingsItem = (icon: string, title: string, value?: string, onPress?: () => void, isSwitch?: boolean, switchValue?: boolean, onSwitchChange?: (value: boolean) => void) => (
    <View style={styles.settingsItem}>
      <View style={styles.settingsItemLeft}>
        <View style={styles.settingsIcon}>
          <Ionicons name={icon as any} size={20} color="#8E8E93" />
        </View>
        <Text style={styles.settingsLabel}>{title}</Text>
      </View>
      <View style={styles.settingsItemRight}>
        {isSwitch ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor="#fff"
          />
        ) : (
          <>
            {value && <Text style={styles.settingsValue}>{value}</Text>}
            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
          </>
        )}
      </View>
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
              <TouchableOpacity style={styles.editAvatarButton} onPress={showImagePickerOptions}>
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
            <Text style={styles.characterCount}>{editForm.bio.length}/200</Text>
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

  const renderFriendsListModal = () => (
    <Modal
      visible={showFriendsModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFriendsModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowFriendsModal(false)}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Friends</Text>
          <TouchableOpacity onPress={() => {
            setActiveFriendsTab('search');
            setShowFriendsModal(false);
            setTimeout(() => setShowFriendsModal(true), 100);
          }}>
            <Ionicons name="person-add-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {friends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No friends yet</Text>
              <Text style={styles.emptySubtext}>
                Use the add button to find and connect with friends
              </Text>
            </View>
          ) : (
            friends.map((friend, index) => (
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
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderMemoriesModal = () => (
    <Modal
      visible={showMemoriesModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowMemoriesModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowMemoriesModal(false)}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Memories</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              onPress={async () => {
                if (user?.id) {
                  console.log('🔄 Manual cleanup and reload triggered');
                  await cleanupOldLocalPhotos(user.id);
                  await loadMemories(user.id);
                }
              }}
            >
              <Ionicons name="refresh-circle" size={24} color="#FF9500" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => loadMemories(user?.id || '')}>
              <Ionicons name="refresh" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>

        {isLoadingMemories ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading memories...</Text>
          </View>
        ) : memories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No memories yet</Text>
            <Text style={styles.emptySubtext}>
              Photos from your habits and events will appear here
            </Text>
            <TouchableOpacity 
              style={styles.debugButton} 
              onPress={() => {
                console.log('🔍 Debug: Current memories state:', memories);
                console.log('🔍 Debug: User ID:', user?.id);
                Alert.alert('Debug Info', `User ID: ${user?.id}\nMemories count: ${memories.length}\nCheck console for more details.`);
              }}
            >
              <Text style={styles.debugButtonText}>Debug Info</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.debugButton, { marginTop: 12, backgroundColor: '#FF9500' }]} 
              onPress={async () => {
                if (user?.id) {
                  Alert.alert('Cleanup', 'This will remove any invalid local photo references. Continue?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Cleanup',
                      onPress: async () => {
                        await cleanupOldLocalPhotos(user.id);
                        await loadMemories(user.id);
                        Alert.alert('Success', 'Cleanup completed! Check the memories again.');
                      }
                    }
                  ]);
                }
              }}
            >
              <Text style={styles.debugButtonText}>Cleanup Old Photos</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.debugButton, { marginTop: 12, backgroundColor: '#34C759' }]} 
              onPress={async () => {
                if (user?.id) {
                  await checkDatabaseState(user.id);
                  Alert.alert('Database Check', 'Check console for current database state.');
                }
              }}
            >
              <Text style={styles.debugButtonText}>Check Database</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.debugButton, { marginTop: 12, backgroundColor: '#FF3B30' }]} 
              onPress={async () => {
                if (user?.id) {
                  Alert.alert('⚠️ Force Cleanup', 'This will remove ALL photos from ALL habits. This action cannot be undone. Continue?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove All Photos',
                      style: 'destructive',
                      onPress: async () => {
                        await forceCleanupAllPhotos(user.id);
                        await loadMemories(user.id);
                        Alert.alert('Success', 'All photos have been removed from habits.');
                      }
                    }
                  ]);
                }
              }}
            >
              <Text style={styles.debugButtonText}>Remove All Photos</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.debugButton, { marginTop: 12, backgroundColor: '#5856D6' }]} 
              onPress={async () => {
                if (user?.id) {
                  Alert.alert('Force Refresh', 'This will completely reset and reload memories. Continue?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Force Refresh',
                      onPress: async () => {
                        await forceRefreshMemories(user.id);
                        Alert.alert('Success', 'Memories have been force refreshed!');
                      }
                    }
                  ]);
                }
              }}
            >
              <Text style={styles.debugButtonText}>Force Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.debugButton, { marginTop: 12, backgroundColor: '#AF52DE' }]} 
              onPress={async () => {
                const isAccessible = await checkSupabaseStorage();
                Alert.alert('Storage Check', isAccessible ? 'Supabase storage is accessible' : 'Supabase storage has issues. Check console for details.');
              }}
            >
              <Text style={styles.debugButtonText}>Check Storage</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.debugButton, { marginTop: 12, backgroundColor: '#FF6B35' }]} 
              onPress={async () => {
                if (user?.id) {
                  Alert.alert('💪 Aggressive Cleanup', 'This will remove ALL photos from ALL habits. This is the most thorough cleanup option. Continue?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Aggressive Cleanup',
                      style: 'destructive',
                      onPress: async () => {
                        await aggressiveCleanup(user.id);
                        await loadMemories(user.id);
                        Alert.alert('Success', 'Aggressive cleanup completed! All photos removed.');
                      }
                    }
                  ]);
                }
              }}
            >
              <Text style={styles.debugButtonText}>Aggressive Cleanup</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={memories}
            keyExtractor={(item) => item.date}
            renderItem={({ item: memoryGroup }) => (
              <View style={styles.memoryGroup}>
                <Text style={styles.memoryDateHeader}>{memoryGroup.formattedDate}</Text>
                <View style={styles.memoryGrid}>
                  {memoryGroup.memories.map((memory) => (
                    <TouchableOpacity
                      key={memory.id}
                      style={styles.memoryItem}
                      onPress={() => {
                        setSelectedMemory(memory);
                        setShowMemoryDetailModal(true);
                      }}
                    >
                      <Image
                        source={{ uri: memory.photoUri }}
                        style={styles.memoryImage}
                        resizeMode="cover"
                        onError={(error) => {
                          // Check if this is a local file name error
                          const errorMessage = error.nativeEvent.error || '';
                          const isLocalFileError = errorMessage.includes("couldn't be opened because there is no such file") ||
                                                 errorMessage.includes("Unknown image download error") ||
                                                 memory.photoUri.includes('.jpg') && !memory.photoUri.includes('/');
                          
                          if (isLocalFileError) {
                            console.log(`⚠️ Local file error for memory ${memory.id}, marking as failed: ${memory.photoUri}`);
                          } else {
                            console.error('❌ Image loading error for memory:', memory.id, error.nativeEvent.error);
                          }
                          setFailedImages(prev => new Set(prev).add(memory.id));
                        }}
                        onLoad={() => {
                          console.log('✅ Image loaded successfully for memory:', memory.id);
                          setFailedImages(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(memory.id);
                            return newSet;
                          });
                        }}
                      />
                      {failedImages.has(memory.id) && (
                        <View style={styles.memoryImagePlaceholder}>
                          <Ionicons name="image-outline" size={32} color="#ccc" />
                          <Text style={styles.memoryImagePlaceholderText}>Image unavailable</Text>
                        </View>
                      )}
                      <View style={styles.memoryOverlay}>
                        <View style={[
                          styles.memoryTypeBadge,
                          { backgroundColor: memory.categoryColor || '#007AFF' }
                        ]}>
                          <Text style={styles.memoryTypeText}>
                            {memory.type === 'habit' ? 'Habit' : 'Event'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            contentContainerStyle={styles.memoriesList}
          />
        )}
      </SafeAreaView>
    </Modal>
  );

  const renderMemoryDetailModal = () => (
    <Modal
      visible={showMemoryDetailModal}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setShowMemoryDetailModal(false)}
    >
      <View style={styles.memoryDetailOverlay}>
        <TouchableOpacity
          style={styles.memoryDetailBackground}
          onPress={() => setShowMemoryDetailModal(false)}
        />
        {selectedMemory && (
          <View style={styles.memoryDetailContainer}>
            <Image
              source={{ uri: selectedMemory.photoUri }}
              style={styles.memoryDetailImage}
              resizeMode="contain"
            />
            <View style={styles.memoryDetailInfo}>
              <View style={[
                styles.memoryDetailTypeBadge,
                { backgroundColor: selectedMemory.categoryColor || '#007AFF' }
              ]}>
                <Text style={styles.memoryDetailTypeText}>
                  {selectedMemory.type === 'habit' ? 'Habit' : 'Event'}
                </Text>
              </View>
              <Text style={styles.memoryDetailTitle}>{selectedMemory.title}</Text>
              {selectedMemory.description && (
                <Text style={styles.memoryDetailDescription}>
                  {selectedMemory.description}
                </Text>
              )}
              <Text style={styles.memoryDetailDate}>
                {formatMemoryDate(selectedMemory.date)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.memoryDetailCloseButton}
              onPress={() => setShowMemoryDetailModal(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );

  const renderSettingsModal = () => (
    <Modal
      visible={showSettingsModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowSettingsModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Settings</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            {renderSettingsItem('color-palette-outline', 'Theme', preferences.theme)}
            {renderSettingsItem('notifications-outline', 'Push Notifications', undefined, undefined, true, preferences.push_notifications, (value) => handlePreferenceChange('push_notifications', value))}
            {renderSettingsItem('mail-outline', 'Email Notifications', undefined, undefined, true, preferences.email_notifications, (value) => handlePreferenceChange('email_notifications', value))}
            {renderSettingsItem('calendar-outline', 'Default View', preferences.default_view)}
          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Account</Text>
            {renderSettingsItem('shield-outline', 'Privacy & Security')}
            {renderSettingsItem('cloud-download-outline', 'Export Data')}
            {renderSettingsItem('help-circle-outline', 'Help & Support')}
            {renderSettingsItem('information-circle-outline', 'About', 'v1.0.0')}
          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <TouchableOpacity style={styles.dangerActionItem} onPress={handleSignOut}>
              <View style={styles.dangerActionLeft}>
                <View style={styles.dangerActionIcon}>
                  <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
                </View>
                <Text style={styles.dangerActionLabel}>Sign Out</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.dangerActionItem} onPress={handleDeleteAccount}>
              <View style={styles.dangerActionLeft}>
                <View style={styles.dangerActionIcon}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </View>
                <Text style={styles.dangerActionLabel}>Delete Account</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const checkDatabaseState = async (userId: string) => {
    try {
      console.log('🔍 Checking current database state for user:', userId);
      
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, text, photos')
        .eq('user_id', userId)
        .not('photos', 'is', null);

      if (habitsError) {
        console.error('Error checking database state:', habitsError);
        return;
      }

      console.log('🔍 Current habits with photos in database:', habitsData);
      
      if (habitsData && habitsData.length > 0) {
        habitsData.forEach(habit => {
          console.log(`🔍 Habit ${habit.id} (${habit.text}):`, habit.photos);
        });
      } else {
        console.log('🔍 No habits with photos found in database');
      }
    } catch (error) {
      console.error('Error checking database state:', error);
    }
  };

  const forceCleanupAllPhotos = async (userId: string) => {
    try {
      console.log('💥 Force cleaning up ALL photos for user:', userId);
      
      // Get all habits with photos
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, photos')
        .eq('user_id', userId)
        .not('photos', 'is', null);

      if (habitsError) {
        console.error('Error fetching habits for force cleanup:', habitsError);
        return;
      }

      if (!habitsData || habitsData.length === 0) {
        console.log('💥 No habits with photos found for force cleanup');
        return;
      }

      console.log(`💥 Force cleaning up ${habitsData.length} habits`);

      // Remove ALL photos from ALL habits
      for (const habit of habitsData) {
        console.log(`💥 Removing all photos from habit ${habit.id}`);
        const { error } = await supabase
          .from('habits')
          .update({ photos: null })
          .eq('id', habit.id);
        
        if (error) {
          console.error(`💥 Error removing photos from habit ${habit.id}:`, error);
        } else {
          console.log(`💥 Successfully removed all photos from habit ${habit.id}`);
        }
      }

      console.log('💥 Force cleanup completed - all photos removed');
    } catch (error) {
      console.error('Error in force cleanup:', error);
    }
  };

  const aggressiveCleanup = async (userId: string) => {
    try {
      console.log('💪 Aggressive cleanup for user:', userId);
      
      // Get all habits with photos
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, photos')
        .eq('user_id', userId)
        .not('photos', 'is', null);

      if (habitsError) {
        console.error('Error fetching habits for aggressive cleanup:', habitsError);
        return;
      }

      if (!habitsData || habitsData.length === 0) {
        console.log('💪 No habits with photos found for aggressive cleanup');
        return;
      }

      console.log(`💪 Aggressively cleaning up ${habitsData.length} habits`);

      // Remove ALL photos from ALL habits - nuclear option
      for (const habit of habitsData) {
        console.log(`💪 Removing ALL photos from habit ${habit.id}:`, habit.photos);
        const { error } = await supabase
          .from('habits')
          .update({ photos: null })
          .eq('id', habit.id);
        
        if (error) {
          console.error(`💪 Error removing photos from habit ${habit.id}:`, error);
        } else {
          console.log(`💪 Successfully removed ALL photos from habit ${habit.id}`);
        }
      }

      console.log('💪 Aggressive cleanup completed - all photos removed from all habits');
    } catch (error) {
      console.error('Error in aggressive cleanup:', error);
    }
  };

  const testPhotoUrl = async (photoUrl: string) => {
    try {
      console.log('🔍 Testing photo URL:', photoUrl);
      
      // Try to fetch the image
      const response = await fetch(photoUrl);
      console.log('🔍 Photo URL response status:', response.status);
      console.log('🔍 Photo URL response headers:', response.headers);
      
      if (response.ok) {
        console.log('✅ Photo URL is accessible');
        return true;
      } else {
        console.log('❌ Photo URL is not accessible:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('❌ Error testing photo URL:', error);
      return false;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {user && (
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.addFriendsButton} onPress={() => {
            setActiveFriendsTab('search');
            setShowFriendsModal(true);
          }}>
            <Ionicons name="person-add-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
          <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettingsModal(true)}>
            <Ionicons name="settings-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      )}
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {user && renderProfileHeader()}
        
        {user && (
          <View style={styles.featuresSection}>
            {renderFeatureCard(
              'images',
              'Memories',
              'Your photo moments',
              memories.reduce((total, group) => total + group.memories.length, 0),
              () => setShowMemoriesModal(true)
            )}
          </View>
        )}

        <View style={styles.accountSection}>
          {user ? (
            <View style={styles.signInContainer}>
              <Text style={styles.signInTitle}>Account Settings</Text>
              <Text style={styles.signInSubtitle}>Tap the settings icon to manage your account</Text>
            </View>
          ) : (
            <View style={styles.signInContainer}>
              <Text style={styles.signInTitle}>Sign in to sync your data</Text>
              <GoogleSigninButton
                size={GoogleSigninButton.Size.Wide}
                color={GoogleSigninButton.Color.Light}
                onPress={handleSignIn}
                disabled={isLoading}
              />
              {isLoading && <ActivityIndicator style={styles.loadingIndicator} color="#007AFF" />}
            </View>
          )}
        </View>
      </ScrollView>
      
      {renderEditProfileModal()}
      {renderFriendsListModal()}
      {renderMemoriesModal()}
      {renderMemoryDetailModal()}
      {renderSettingsModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  headerSpacer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Onest',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
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
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
    fontFamily: 'Onest',
  },
  profileEmail: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 8,
    fontFamily: 'Onest',
  },
  profileBio: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Onest',
  },
  editProfileButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  editProfileText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'Onest',
  },
  featuresSection: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
    fontFamily: 'Onest',
  },
  featureSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  featureCount: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  featureCountText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'Onest',
  },
  settingsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    fontFamily: 'Onest',
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsLabel: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'Onest',
  },
  settingsValue: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 8,
    fontFamily: 'Onest',
  },
  accountSection: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  signOutButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  signOutText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
    fontFamily: 'Onest',
  },
  deleteAccountButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  deleteAccountText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
    fontFamily: 'Onest',
  },
  signInContainer: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  signInTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Onest',
  },
  signInSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'Onest',
  },
  loadingIndicator: {
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Onest',
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
    fontFamily: 'Onest',
  },
  modalSaveTextDisabled: {
    color: '#8E8E93',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
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
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: 'Onest',
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    fontFamily: 'Onest',
  },
  formInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
    fontFamily: 'Onest',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  characterCount: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 4,
    fontFamily: 'Onest',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  uploadingText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
    fontFamily: 'Onest',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 16,
    fontFamily: 'Onest',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 16,
    fontFamily: 'Onest',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#C7C7CC',
    textAlign: 'center',
    fontFamily: 'Onest',
  },
  memoryGroup: {
    marginBottom: 20,
  },
  memoryDateHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    fontFamily: 'Onest',
  },
  memoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  memoryItem: {
    width: '50%',
    height: 200,
    position: 'relative',
  },
  memoryImage: {
    width: '100%',
    height: '100%',
  },
  memoryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryTypeBadge: {
    padding: 4,
    borderRadius: 4,
  },
  memoryTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Onest',
  },
  memoryDetailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  memoryDetailBackground: {
    flex: 1,
  },
  memoryDetailContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    backgroundColor: '#fff',
  },
  memoryDetailImage: {
    width: '100%',
    height: '100%',
  },
  memoryDetailInfo: {
    marginTop: 20,
  },
  memoryDetailTypeBadge: {
    padding: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  memoryDetailTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Onest',
  },
  memoryDetailTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    fontFamily: 'Onest',
  },
  memoryDetailDescription: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  memoryDetailDate: {
    fontSize: 12,
    color: '#C7C7CC',
    marginTop: 8,
    fontFamily: 'Onest',
  },
  memoryDetailCloseButton: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  memoriesList: {
    padding: 20,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F5F5F5',
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
    backgroundColor: '#F8F9FA',
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
    fontFamily: 'Onest',
  },
  friendUsername: {
    fontSize: 13,
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  removeFriendButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
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
  addFriendsButton: {
    padding: 12,
    borderRadius: 20,
  },
  friendCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  friendCountText: {
    fontSize: 17,
    color: '#8E8E93',
    marginLeft: 4,
    fontFamily: 'Onest',
  },
  dangerActionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F5F5F5',
  },
  dangerActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dangerActionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dangerActionLabel: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
    fontFamily: 'Onest',
  },
  settingsButton: {
    padding: 12,
    borderRadius: 20,
  },
  debugButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 20,
  },
  debugButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'Onest',
  },
  memoryImagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryImagePlaceholderText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
    fontFamily: 'Onest',
  },
});