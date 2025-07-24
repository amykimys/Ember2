import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Alert, ScrollView, StyleSheet, ActivityIndicator, Switch, Image, Modal, TextInput, FlatList, Dimensions, RefreshControl, Animated, PanResponder } from 'react-native';
import { supabase } from '../../supabase';
import { User } from '@supabase/supabase-js';
import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useFocusEffect } from '@react-navigation/native';
import { clearPreferencesCache, testSharingNotifications, initializeNotificationsWithToken } from '../../utils/notificationUtils';
import { manuallyMoveUncompletedTasks, debugUserTasks } from '../../utils/taskUtils';
import { GoogleCalendarSyncNew } from '../../components/GoogleCalendarSyncNew';
import { Colors } from '../../constants/Colors';
import Toast from 'react-native-toast-message';
import PhotoZoomViewer from '../../components/PhotoZoomViewer';
import { useData } from '../../contexts/DataContext';

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications_enabled: boolean;
  default_view: 'day' | 'week' | 'month';
  email_notifications: boolean;
  push_notifications: boolean;
  default_screen: 'calendar' | 'todo' | 'notes' | 'profile';
  auto_move_uncompleted_tasks: boolean;
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
  isPrivate?: boolean;
}

interface MemoryGroup {
  date: string;
  formattedDate: string;
  memories: MemoryItem[];
}

// Friends feed interfaces
interface PhotoShare {
  update_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  user_username: string;
  photo_url: string;
  caption: string;
  source_type: 'habit' | 'event';
  source_title: string;
  created_at: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { data: appData, updateData } = useData();
  const [user, setUser] = useState<User | null>(null);
  const dotAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0)
  ]).current;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'system',
    notifications_enabled: true,
    default_view: 'day',
    email_notifications: true,
    push_notifications: true,
    default_screen: 'calendar',
    auto_move_uncompleted_tasks: false
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
  const [sentFriendRequests, setSentFriendRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeFriendsTab, setActiveFriendsTab] = useState<'friends' | 'requests' | 'search'>('search');
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showSimpleFriendsModal, setShowSimpleFriendsModal] = useState(false);

  // Memories state
  const [memories, setMemories] = useState<MemoryGroup[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [showMemoriesModal, setShowMemoriesModal] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);
  const [showMemoryDetailModal, setShowMemoryDetailModal] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // Multi-select state for memories
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMemories, setSelectedMemories] = useState<Set<string>>(new Set());
  const [isDeletingMemories, setIsDeletingMemories] = useState(false);

  // Friends feed state
  const [photoShares, setPhotoShares] = useState<PhotoShare[]>([]);
  const [isLoadingPhotoShares, setIsLoadingPhotoShares] = useState(false);
  const [showFriendsFeedModal, setShowFriendsFeedModal] = useState(false);
  const [photoSharesPage, setPhotoSharesPage] = useState(0);
  const [hasMorePhotoShares, setHasMorePhotoShares] = useState(true);
  const [isRefreshingPhotoShares, setIsRefreshingPhotoShares] = useState(false);
  const [unreadPhotoShares, setUnreadPhotoShares] = useState(0);
  const [lastViewedPhotoShareTime, setLastViewedPhotoShareTime] = useState<number>(0);
  
  // Friends modal refresh state
  const [isRefreshingFriends, setIsRefreshingFriends] = useState(false);
  
  // Photo zoom state
  const [showPhotoZoomModal, setShowPhotoZoomModal] = useState(false);
  const [selectedPhotoForZoom, setSelectedPhotoForZoom] = useState<PhotoShare | null>(null);
  const [photoDimensions, setPhotoDimensions] = useState<{[key: string]: {width: number, height: number}}>({});
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  // Settings state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDefaultScreenModal, setShowDefaultScreenModal] = useState(false);
  
  // Google Calendar sync state
  const [showGoogleSyncModal, setShowGoogleSyncModal] = useState(false);

  // Use preloaded data from DataContext when available
  useEffect(() => {
    if (user && appData.isPreloaded) {
      // Update profile from preloaded data
      if (appData.userProfile && !profile) {
        setProfile(appData.userProfile);
        setEditForm({
          full_name: appData.userProfile.full_name || '',
          bio: appData.userProfile.bio || '',
          avatar_url: appData.userProfile.avatar_url || '',
          username: appData.userProfile.username || ''
        });
      }
      
      // Update preferences from preloaded data
      if (appData.userPreferences) {
        setPreferences({
          theme: appData.userPreferences.theme || 'system',
          notifications_enabled: appData.userPreferences.notifications_enabled ?? true,
          default_view: appData.userPreferences.default_view || 'day',
          email_notifications: appData.userPreferences.email_notifications ?? true,
          push_notifications: appData.userPreferences.push_notifications ?? true,
          default_screen: appData.userPreferences.default_screen || 'calendar',
          auto_move_uncompleted_tasks: appData.userPreferences.auto_move_uncompleted_tasks ?? false
        });
      }
    }
  }, [user, appData.isPreloaded, appData.userProfile, appData.userPreferences, profile]);

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
        
        // Use preloaded data if available, otherwise fetch it
        if (appData.isPreloaded) {
          if (appData.userProfile) {
            setProfile(appData.userProfile);
            setEditForm({
              full_name: appData.userProfile.full_name || '',
              bio: appData.userProfile.bio || '',
              avatar_url: appData.userProfile.avatar_url || '',
              username: appData.userProfile.username || ''
            });
          }
          
          if (appData.userPreferences) {
            setPreferences({
              theme: appData.userPreferences.theme || 'system',
              notifications_enabled: appData.userPreferences.notifications_enabled ?? true,
              default_view: appData.userPreferences.default_view || 'day',
              email_notifications: appData.userPreferences.email_notifications ?? true,
              push_notifications: appData.userPreferences.push_notifications ?? true,
              default_screen: appData.userPreferences.default_screen || 'calendar',
              auto_move_uncompleted_tasks: appData.userPreferences.auto_move_uncompleted_tasks ?? false
            });
          }
        } else {
          // Fallback to fetching data if not preloaded
          await loadUserProfile(session.user.id);
          await loadUserPreferences(session.user.id);
        }
          await loadFriends(session.user.id);
          
          // Initialize notifications and save push token
          await initializeNotificationsWithToken(session.user.id);
          await loadFriendRequests(session.user.id);
          await loadMemories(session.user.id);
          await loadPhotoShares(true);
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
        await loadPhotoShares(true);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Add focus effect to reload data when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        console.log('🔄 Profile screen focused, refreshing all data...');
        // Refresh all profile data when screen comes into focus
        loadUserProfile(user.id);
        loadUserPreferences(user.id);
        loadFriends(user.id);
        loadFriendRequests(user.id);
        loadMemories(user.id);
        loadPhotoShares(true);
      }
    }, [user?.id])
  );

  // Animate loading dots when signing in
  useEffect(() => {
    if (isLoading) {
      const animateDots = () => {
        const animations = dotAnimations.map((dot, index) =>
          Animated.sequence([
            Animated.delay(index * 200),
            Animated.loop(
              Animated.sequence([
                Animated.timing(dot, {
                  toValue: 1,
                  duration: 600,
                  useNativeDriver: true,
                }),
                Animated.timing(dot, {
                  toValue: 0,
                  duration: 600,
                  useNativeDriver: true,
                }),
              ])
            )
          ])
        );
        Animated.parallel(animations).start();
      };
      animateDots();
    } else {
      // Reset animations when not loading
      dotAnimations.forEach(dot => dot.setValue(0));
    }
  }, [isLoading]);

  // Add useEffect to listen for photo deletion events and refresh memories
  useEffect(() => {
    let lastCheckTime = 0;
    let lastPhotoShareCheckTime = 0;
    
    const checkForPhotoDeletions = () => {
      // Check if there's a global timestamp indicating a photo was deleted
      const globalAny = global as any;
      if (globalAny.lastPhotoDeletionTime && globalAny.lastPhotoDeletionTime > lastCheckTime) {
        lastCheckTime = globalAny.lastPhotoDeletionTime;
        console.log('🔄 Photo deletion detected, refreshing memories...');
        if (user?.id) {
          loadMemories(user.id);
        }
      }
      
      // Check if there's a global timestamp indicating a photo was shared
      if (globalAny.lastPhotoShareTime && globalAny.lastPhotoShareTime > lastPhotoShareCheckTime) {
        lastPhotoShareCheckTime = globalAny.lastPhotoShareTime;
        console.log('🔄 Photo share detected, refreshing friends feed...');
        if (user?.id) {
          loadPhotoShares(true);
        }
      }
    };

    // Check every 2 seconds for photo deletions and shares
    const interval = setInterval(checkForPhotoDeletions, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [user?.id]);

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
      console.log('🔄 Loading user preferences for user:', userId);
      
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
        console.log('✅ Found existing preferences:', data);
        setPreferences({
          theme: data.theme || 'system',
          notifications_enabled: data.notifications_enabled ?? true,
          default_view: data.default_view || 'day',
          email_notifications: data.email_notifications ?? true,
          push_notifications: data.push_notifications ?? true,
          default_screen: data.default_screen || 'calendar',
          auto_move_uncompleted_tasks: data.auto_move_uncompleted_tasks ?? false
        });
      } else {
        console.log('📝 No preferences found, creating defaults...');
        // Create default preferences
        const defaultPreferences: UserPreferences = {
          theme: 'system',
          notifications_enabled: true,
          default_view: 'day',
          email_notifications: true,
          push_notifications: true,
          default_screen: 'calendar',
          auto_move_uncompleted_tasks: false
        };

        // Simple insert without complex error handling
        const { error: insertError } = await supabase
          .from('user_preferences')
          .insert({
            user_id: userId,
            theme: defaultPreferences.theme,
            notifications_enabled: defaultPreferences.notifications_enabled,
            default_view: defaultPreferences.default_view,
            email_notifications: defaultPreferences.email_notifications,
            push_notifications: defaultPreferences.push_notifications,
            default_screen: defaultPreferences.default_screen,
            auto_move_uncompleted_tasks: defaultPreferences.auto_move_uncompleted_tasks,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('❌ Error creating default preferences:', insertError);
          // Set default preferences locally even if database insert fails
          setPreferences(defaultPreferences);
        } else {
          console.log('✅ Default preferences created successfully');
          setPreferences(defaultPreferences);
        }
      }
    } catch (error) {
      console.error('❌ Error in loadUserPreferences:', error);
      // Set default preferences locally as fallback
      setPreferences({
        theme: 'system',
        notifications_enabled: true,
        default_view: 'day',
        email_notifications: true,
        push_notifications: true,
        default_screen: 'calendar',
        auto_move_uncompleted_tasks: false
      });
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
      } else {
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
      }

      // Now load sent friend requests (where current user is the requester)
      const { data: sentRequestsData, error: sentRequestsError } = await supabase
        .from('friendships')
        .select('id, user_id, friend_id, status, created_at')
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (sentRequestsError) {
        console.error('Error loading sent friend requests:', sentRequestsError);
        return;
      }

      console.log('📤 Found sent friend requests:', sentRequestsData);

      if (!sentRequestsData || sentRequestsData.length === 0) {
        setSentFriendRequests([]);
      } else {
        // Get the recipient IDs (friend_id is the recipient, user_id is the requester)
        const recipientIds = sentRequestsData.map(request => request.friend_id);
        console.log('👥 Recipient IDs:', recipientIds);

        // Fetch the recipient profiles
        const { data: recipientProfilesData, error: recipientProfilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, username')
          .in('id', recipientIds);

        if (recipientProfilesError) {
          console.error('Error loading recipient profiles:', recipientProfilesError);
          return;
        }

        console.log('👤 Found recipient profiles:', recipientProfilesData);

        // Create a map of profiles by ID for quick lookup
        const recipientProfilesMap = new Map();
        recipientProfilesData?.forEach((profile: any) => {
          recipientProfilesMap.set(profile.id, profile);
        });

        // Combine the data
        const sentRequests: FriendRequest[] = sentRequestsData.map(request => {
          const profile = recipientProfilesMap.get(request.friend_id);
          console.log(`🔗 Sent Request ${request.id}: friend_id=${request.friend_id}, profile=`, profile);
          return {
            friendship_id: request.id,
            requester_id: request.friend_id,
            requester_name: profile?.full_name || 'Unknown User',
            requester_avatar: profile?.avatar_url || '',
            requester_username: profile?.username || '',
            created_at: request.created_at || request.id
          };
        });

        console.log('✅ Final sent friend requests:', sentRequests);
        setSentFriendRequests(sentRequests);
      }
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
                // Check for UUID-like patterns (common in iOS file names)
                /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}\.[a-zA-Z]+$/.test(photoUri) ||
                // Check for simple file names without paths
                (!photoUri.includes('/') && 
                 !photoUri.includes('\\') && 
                 photoUri.includes('.') && 
                 !photoUri.startsWith('http') && 
                 !photoUri.startsWith('file://') && 
                 !photoUri.startsWith('data:') &&
                 photoUri.length < 100) ||
                // Check for base64 data URLs that might be corrupted
                (photoUri.startsWith('data:') && photoUri.length < 100)
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

      const allMemories: MemoryItem[] = [];

      // Fetch habits with photos
      console.log('🔍 Fetching habits with photos...');
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
        
        habitsData.forEach(habit => {
          console.log(`🔍 Processing habit ${habit.id}:`, {
            text: habit.text,
            photos: habit.photos,
            categoryColor: habit.categories?.[0]?.color
          });
          
          if (habit.photos && typeof habit.photos === 'object') {
            console.log(`📷 Photos object for habit ${habit.id}:`, habit.photos);
            
            for (const [date, photoUri] of Object.entries(habit.photos)) {
              console.log(`📅 Processing date ${date} with photo:`, photoUri);
              
              if (photoUri && typeof photoUri === 'string' && photoUri.trim() !== '') {
                // Only skip obviously invalid photos
                const isObviouslyInvalid = (
                  // Empty or very short strings
                  photoUri.length < 10 ||
                  // Just file extensions
                  /^\.(jpg|jpeg|png|gif|webp)$/i.test(photoUri) ||
                  // Just UUIDs without file extensions
                  /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/i.test(photoUri)
                );
                
                if (!isObviouslyInvalid) {
                  console.log(`✅ Adding habit memory for date ${date}:`, photoUri);
                  allMemories.push({
                    id: `${habit.id}_${date}`,
                    photoUri: photoUri,
                    date: date,
                    type: 'habit',
                    title: habit.text,
                    description: habit.description,
                    categoryColor: habit.categories?.[0]?.color
                  });
                } else {
                  console.log(`⚠️ Skipping obviously invalid habit photo for date ${date}:`, photoUri);
                }
              } else {
                console.log(`❌ Skipping invalid habit photo for date ${date}:`, photoUri);
              }
            }
          } else {
            console.log(`❌ Habit ${habit.id} has no valid photos object:`, habit.photos);
          }
        });
      } else {
        console.log('📸 No habits with photos found');
      }

      // Fetch events with photos (including private photos)
      console.log('🔍 Fetching events with photos...');
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, title, description, date, photos, private_photos, category_name, category_color')
        .eq('user_id', userId);

      if (eventsError) {
        console.error('Error fetching events with photos:', eventsError);
        // Don't return here, continue with habits data
      } else if (eventsData) {
        console.log('📸 Found events:', eventsData.length);
        
        // Filter events that have either regular photos or private photos
        const eventsWithPhotos = eventsData.filter(event => {
          const hasRegularPhotos = event.photos && Array.isArray(event.photos) && event.photos.length > 0;
          const hasPrivatePhotos = event.private_photos && Array.isArray(event.private_photos) && event.private_photos.length > 0;
          return hasRegularPhotos || hasPrivatePhotos;
        });
        
        console.log('📸 Events with photos:', eventsWithPhotos.length);
        
        eventsWithPhotos.forEach(event => {
          console.log(`🔍 Processing event ${event.id}:`, {
            title: event.title,
            photos: event.photos,
            private_photos: event.private_photos
          });
          // Include regular photos in memories
          const allPhotos = event.photos || [];
          if (allPhotos.length > 0) {
            console.log(`📷 All photos array for event ${event.id}:`, allPhotos);
            allPhotos.forEach((photoUri: string, photoIndex: number) => {
              console.log(`📅 Processing photo ${photoIndex} for event ${event.id}:`, photoUri);
              if (photoUri && typeof photoUri === 'string' && photoUri.trim() !== '') {
                const isObviouslyInvalid = (
                  photoUri.length < 10 ||
                  /^\.(jpg|jpeg|png|gif|webp)$/i.test(photoUri) ||
                  /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/i.test(photoUri)
                );
                if (!isObviouslyInvalid) {
                  console.log(`✅ Adding event memory for date ${event.date}:`, photoUri);
                  allMemories.push({
                    id: `${event.id}_${photoIndex}`,
                    photoUri: photoUri,
                    date: event.date,
                    type: 'event',
                    title: event.title,
                    description: event.description,
                    categoryColor: event.category_color,
                    isPrivate: false
                  });
                } else {
                  console.log(`⚠️ Skipping obviously invalid event photo for event ${event.id}:`, photoUri);
                }
              } else {
                console.log(`❌ Skipping invalid event photo for event ${event.id}:`, photoUri);
              }
            });
          }
          // Include private photos in memories, marked as private
          const privatePhotos = event.private_photos || [];
          if (privatePhotos.length > 0) {
            privatePhotos.forEach((photoUri: string, photoIndex: number) => {
              if (photoUri && typeof photoUri === 'string' && photoUri.trim() !== '') {
                const isObviouslyInvalid = (
                  photoUri.length < 10 ||
                  /^\.(jpg|jpeg|png|gif|webp)$/i.test(photoUri) ||
                  /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/i.test(photoUri)
                );
                if (!isObviouslyInvalid) {
                  console.log(`✅ Adding PRIVATE event memory for date ${event.date}:`, photoUri);
                  allMemories.push({
                    id: `${event.id}_private_${photoIndex}`,
                    photoUri: photoUri,
                    date: event.date,
                    type: 'event',
                    title: event.title,
                    description: event.description,
                    categoryColor: event.category_color,
                    isPrivate: true
                  });
                } else {
                  console.log(`⚠️ Skipping obviously invalid PRIVATE event photo for event ${event.id}:`, photoUri);
                }
              } else {
                console.log(`❌ Skipping invalid PRIVATE event photo for event ${event.id}:`, photoUri);
              }
            });
          }
        });
      } else {
        console.log('📸 No events with photos found');
      }

      console.log('📸 Total memories found:', allMemories.length);
      console.log('📸 All memories:', allMemories);

      // Group memories by date
      const groupedMemories: { [key: string]: MemoryItem[] } = {};
      
      allMemories.forEach(memory => {
        if (!groupedMemories[memory.date]) {
          groupedMemories[memory.date] = [];
        }
        groupedMemories[memory.date].push(memory);
      });

      // Convert to MemoryGroup array and sort by date (newest first)
      const memoryGroups: MemoryGroup[] = Object.keys(groupedMemories)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
        .map(date => ({
          date: date,
          formattedDate: formatMemoryDate(date),
          memories: groupedMemories[date]
        }));

      console.log('📸 Final grouped memories:', memoryGroups);
      setMemories(memoryGroups);
      console.log('📸 Memories organized into groups by date');
      
      if (memoryGroups.length === 0 || memoryGroups.every(group => group.memories.length === 0)) {
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
      // Parse the date string properly to avoid timezone issues
      // If the dateString is in YYYY-MM-DD format, create the date in local timezone
      let date: Date;
      
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        // For YYYY-MM-DD format, create date in local timezone
        const [year, month, day] = dateString.split('-').map(Number);
        date = new Date(year, month - 1, day); // month is 0-indexed
      } else {
        // For other formats, use the original parsing
        date = new Date(dateString);
      }
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Compare dates using toDateString() to avoid timezone issues
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
      console.error('Error formatting memory date:', error, 'for dateString:', dateString);
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

  const cancelFriendRequest = async (friendshipId: string) => {
    Alert.alert(
      'Cancel Friend Request',
      'Are you sure you want to cancel this friend request?',
      [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('friendships')
                .delete()
                .eq('id', friendshipId);

              if (error) throw error;

              Alert.alert('Success', 'Friend request cancelled.');
              // Refresh requests
              if (user) {
                await loadFriendRequests(user.id);
              }
            } catch (error) {
              console.error('Error cancelling friend request:', error);
              Alert.alert('Error', 'Failed to cancel friend request. Please try again.');
            }
          }
        }
      ]
    );
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

  const handleFriendsRefresh = async () => {
    if (!user?.id) return;
    
    setIsRefreshingFriends(true);
    try {
      await Promise.all([
        loadFriends(user.id),
        loadFriendRequests(user.id)
      ]);
    } catch (error) {
      console.error('Error refreshing friends:', error);
    } finally {
      setIsRefreshingFriends(false);
    }
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
              // Try to sign out from Google (this might fail if user wasn't signed in with Google)
              try {
                await GoogleSignin.revokeAccess();
                await GoogleSignin.signOut();
              } catch (googleError) {
                console.log('Google sign out failed (user might not be signed in with Google):', googleError);
                // Continue with Supabase sign out even if Google sign out fails
              }
              
              // Sign out from Supabase
              const { error } = await supabase.auth.signOut();
              if (error) {
                throw error;
              }
              
              // Clear all local state
              setUser(null);
              setProfile(null);
              setPreferences({
                theme: 'system',
                notifications_enabled: true,
                default_view: 'day',
                email_notifications: true,
                push_notifications: true,
                default_screen: 'calendar',
                auto_move_uncompleted_tasks: false
              });
              setFriends([]);
              setFriendRequests([]);
              setMemories([]);
              setPhotoShares([]);
              
              // Close all modals
              setShowSettingsModal(false);
              setShowDefaultScreenModal(false);
              setShowFriendsModal(false);
              setShowSimpleFriendsModal(false);
              setShowMemoriesModal(false);
              setShowFriendsFeedModal(false);
              setIsEditingProfile(false);
              
              console.log('✅ Successfully signed out');
            } catch (error) {
              console.error('Error in handleSignOut:', error);
              Alert.alert('Error', 'There was a problem signing out. Please try again.');
            }
          }
        }
      ]
    );
  };

  const getDefaultScreenLabel = (screen: 'calendar' | 'todo' | 'notes' | 'profile') => {
    switch (screen) {
      case 'calendar': return 'Calendar';
      case 'todo': return 'Todo';
      case 'notes': return 'Notes';
      case 'profile': return 'Profile';
      default: return 'Calendar';
    }
  };



  const handlePreferenceChange = async (key: keyof UserPreferences, value: any) => {
    if (!user) {
      console.error('❌ No user found, cannot update preference');
      return;
    }

    // Store the previous value in case we need to revert
    const previousValue = preferences[key];
    
    console.log(`🔄 Updating preference: ${key} = ${value} for user: ${user.id}`);
    console.log(`🔍 Previous value was: ${previousValue}`);
    console.log(`🔍 New value will be: ${value}`);
    
    // Optimistically update the UI immediately
    setPreferences(prev => ({ ...prev, [key]: value }));

    try {
      // Log the data being sent
      const preferenceUpdateData = {
        user_id: user.id,
        [key]: value,
        updated_at: new Date().toISOString()
      };
      console.log('📤 Sending update data:', preferenceUpdateData);
      
      // First try to update existing record, if it fails, insert new one
      let { data, error } = await supabase
        .from('user_preferences')
        .update(preferenceUpdateData)
        .eq('user_id', user.id)
        .select();

      // If update fails (no existing record), try insert
      if (error && error.code === 'PGRST116') {
        console.log('📝 No existing preferences found, creating new record...');
        const { data: insertData, error: insertError } = await supabase
          .from('user_preferences')
          .insert(preferenceUpdateData)
          .select();
        
        if (insertError) {
          console.error('❌ Error inserting preference:', insertError);
          data = null;
          error = insertError;
        } else {
          console.log('✅ Successfully inserted new preferences');
          data = insertData;
          error = null;
        }
      }

      if (error) {
        console.error('❌ Error updating preference:', error);
        console.error('❌ Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        // Revert to the previous value if the update failed
        setPreferences(prev => ({ ...prev, [key]: previousValue }));
        Alert.alert('Error', `Failed to update preference: ${error.message}`);
        return;
      }
      
      console.log(`✅ Successfully updated preference: ${key} = ${value}`);
      console.log('✅ Response data:', data);
      
      // Update DataContext with the new preferences
      if (data && data[0]) {
        updateData('userPreferences', data[0]);
      }
      
      // Clear the preferences cache so other screens get the updated setting
      clearPreferencesCache();
      
      // If this is the default_screen preference, show a confirmation
      if (key === 'default_screen') {
        Toast.show({
          type: 'success',
          text1: 'Default Screen Updated',
          text2: `App will now start with ${getDefaultScreenLabel((value || 'calendar') as 'calendar' | 'todo' | 'notes' | 'profile')}`,
          position: 'bottom',
        });
      }
    } catch (error) {
      console.error('❌ Exception updating preference:', error);
      // Revert to the previous value if the update failed
      setPreferences(prev => ({ ...prev, [key]: previousValue }));
      Alert.alert('Error', `Failed to update preference: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const updatedProfile = profile ? {
        ...profile,
        full_name: editForm.full_name.trim(),
        bio: editForm.bio.trim(),
        avatar_url: editForm.avatar_url.trim(),
        username: editForm.username.trim()
      } : null;
      
      setProfile(updatedProfile);
      
      // Update DataContext with the new profile
      if (updatedProfile) {
        updateData('userProfile', updatedProfile);
      }

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

  // Add this function before handlePickAndUploadAvatar
  const ensureAvatarsBucket = async () => {
    try {
      console.log('🔍 Checking if avatars bucket exists...');
      
      // Try to list files in avatars bucket
      const { data, error } = await supabase.storage
        .from('avatars')
        .list('', { limit: 1 });
      
      if (error) {
        console.log('❌ Avatars bucket not accessible:', error.message);
        return false;
      }
      
      console.log('✅ Avatars bucket is accessible');
      return true;
    } catch (error) {
      console.log('❌ Error checking avatars bucket:', error);
      return false;
    }
  };

  const handlePickAndUploadAvatar = async () => {
    if (!user) return;
    
    // Ask for permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Media library permission is required.');
      return;
    }
    
    // Pick image with better quality settings
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5, // Reduced quality to ensure smaller file size
    });
    
    if (result.canceled || !result.assets[0]) return;
    
    setIsUploadingImage(true);
    
    try {
      console.log('🖼️ Starting profile image upload...');
      
      const uri = result.assets[0].uri;
      const fileSize = result.assets[0].fileSize;
      
      console.log('🖼️ Selected image URI:', uri);
      console.log('🖼️ File size:', fileSize, 'bytes');
        
      // Check file size (limit to 2MB for profile photos)
      if (fileSize && fileSize > 2 * 1024 * 1024) {
        throw new Error('Image file is too large. Please select an image smaller than 2MB.');
        }
        
      // Get file extension
      let fileExt = 'jpg';
      if (uri.includes('.')) {
        const uriExt = uri.split('.').pop()?.toLowerCase();
        if (uriExt && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(uriExt)) {
          fileExt = uriExt;
        }
        }
        
      console.log('🖼️ Using file extension:', fileExt);
      
      // Create unique filename with avatars folder path
      const fileName = `avatars/avatar-${user.id}-${Date.now()}.${fileExt}`;
      console.log('🖼️ Using filename:', fileName);
      
      // Upload to memories bucket in the avatars folder
      console.log('🖼️ Uploading to memories/avatars folder...');
        
        const { data, error } = await supabase.storage
        .from('memories')
        .upload(fileName, {
          uri: uri,
          type: `image/${fileExt}`,
          name: fileName,
        } as any, { 
            upsert: true,
          cacheControl: '3600',
          contentType: `image/${fileExt}` // Explicitly set content type
          });
        
        if (error) {
        console.error('❌ Upload to memories/avatars failed:', error);
        throw new Error('Failed to upload image. Please try again.');
          }
          
      console.log('✅ Upload to memories/avatars successful:', data);
          
      // Get public URL from memories bucket
          const { data: { publicUrl } } = supabase.storage
        .from('memories')
            .getPublicUrl(data.path);
          
      await updateProfileWithAvatar(publicUrl);
          
    } catch (error: any) {
      console.error('❌ Error in profile image upload:', error);
      
      let errorMessage = 'Failed to upload image. Please try again.';
      
      if (error.message) {
        if (error.message.includes('too large')) {
          errorMessage = error.message;
        } else if (error.message.includes('permission')) {
          errorMessage = 'Permission denied. Please check your account.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection.';
        }
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const updateProfileWithAvatar = async (avatarUrl: string) => {
    if (!user) return;
    
    try {
      console.log('🔄 Updating profile with avatar URL:', avatarUrl);
      
      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (updateError) {
        console.error('❌ Profile update error:', updateError);
        throw updateError;
      }
      
      console.log('✅ Profile updated successfully');
      
      // Update local state
      const updatedProfile = profile ? { ...profile, avatar_url: avatarUrl } : null;
      setProfile(updatedProfile);
      setEditForm(prev => ({ ...prev, avatar_url: avatarUrl }));
      
      // Update DataContext with the new profile
      if (updatedProfile) {
        updateData('userProfile', updatedProfile);
      }
      
      console.log('✅ Local state and DataContext updated successfully');
      
      Alert.alert('Success', 'Profile photo updated successfully!');
      
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      throw error;
    }
  };

  const renderProfileHeader = () => (
    <View style={styles.profileHeader}>
      <TouchableOpacity style={styles.avatarContainer} onPress={handlePickAndUploadAvatar}>
        {profile?.avatar_url ? (
          <Image 
            source={{ 
              uri: profile.avatar_url,
              // Add cache busting to force reload
              cache: 'reload',
              headers: {
                'Cache-Control': 'no-cache'
              }
            }} 
            style={styles.avatar}
            onError={(error) => {
              console.error('❌ Profile image loading error:', error.nativeEvent.error);
              console.error('❌ Profile image URL:', profile.avatar_url);
              // Try to clear the problematic URL and show placeholder
              if (user) {
                console.log('🧹 Clearing problematic profile image URL');
                supabase.from('profiles').update({ avatar_url: '' }).eq('id', user.id);
                setProfile(prev => prev ? { ...prev, avatar_url: '' } : null);
                setEditForm(prev => ({ ...prev, avatar_url: '' }));
              }
            }}
            onLoad={() => {
              console.log('✅ Profile image loaded successfully:', profile.avatar_url);
            }}
            onLoadStart={() => {
              console.log('🔄 Profile image loading started:', profile.avatar_url);
            }}
            onLoadEnd={() => {
              console.log('🏁 Profile image loading ended');
            }}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={40} color="#fff" />
          </View>
        )}
        {isUploadingImage && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 50 }}>
            <ActivityIndicator size="small" color={Colors.light.primary} />
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={handleEditProfile} style={styles.profileNameContainer}>
      <Text style={styles.profileName}>{profile?.full_name || user?.user_metadata?.full_name || 'Your Name'}</Text>
        <Text style={styles.profileUsername}>@{profile?.username || user?.user_metadata?.username || 'username'}</Text>
      </TouchableOpacity>
      {profile?.bio && <Text style={styles.profileBio}>{profile.bio}</Text>}
      <TouchableOpacity style={styles.friendCountContainer} onPress={() => setShowSimpleFriendsModal(true)}>
        <Ionicons name="people" size={16} color={Colors.light.icon} />
        <Text style={styles.friendCountText}>{friends.length} friends</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFeatureCard = (icon: string, title: string, subtitle: string, count?: number, onPress?: () => void) => (
    <TouchableOpacity style={styles.featureCard} onPress={onPress}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon as any} size={20} color={Colors.light.accent} />
      </View>
      <View style={styles.featureContent}>
        <Text style={[styles.featureTitle, !subtitle && styles.featureTitleCentered]}>{title}</Text>
        {subtitle && <Text style={styles.featureSubtitle}>{subtitle}</Text>}
      </View>
      {count !== undefined && (
        <View style={styles.featureCount}>
          <Text style={styles.featureCountText}>{count}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={Colors.light.icon} />
    </TouchableOpacity>
  );

  const renderSettingsItem = (icon: string, title: string, value?: string, onPress?: () => void, isSwitch?: boolean, switchValue?: boolean, onSwitchChange?: (value: boolean) => void) => (
    <View style={styles.settingsItem}>
      <TouchableOpacity 
        style={styles.settingsItemLeft} 
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={styles.settingsIcon}>
          <Ionicons name={icon as any} size={20} color={Colors.light.icon} />
        </View>
        <Text style={styles.settingsLabel}>{title}</Text>
      </TouchableOpacity>
      <View style={styles.settingsItemRight}>
        {isSwitch ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: Colors.light.border, true: Colors.light.accent }}
            thumbColor="#fff"
            ios_backgroundColor={Colors.light.border}
            style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
          />
        ) : (
          <TouchableOpacity onPress={onPress} disabled={!onPress} style={styles.settingsItemRightContent}>
            {value && <Text style={styles.settingsValue}>{value}</Text>}
            <Ionicons name="chevron-forward" size={16} color={Colors.light.icon} />
          </TouchableOpacity>
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
                <Image 
                  source={{ 
                    uri: editForm.avatar_url,
                    // Add cache busting and better error handling
                    cache: 'reload',
                    headers: {
                      'Cache-Control': 'no-cache'
                    }
                  }} 
                  style={styles.editAvatar}
                  onError={(error) => {
                    console.error('❌ Edit profile image loading error:', error.nativeEvent.error);
                    console.error('❌ Edit profile image URL:', editForm.avatar_url);
                    
                    // Log the specific error details for debugging
                    console.error('❌ Edit image error details:', {
                      errorCode: error.nativeEvent.error?.code,
                      errorMessage: error.nativeEvent.error?.message,
                      url: editForm.avatar_url,
                      urlLength: editForm.avatar_url?.length,
                      urlStartsWith: editForm.avatar_url?.substring(0, 20)
                    });
                    
                    // Don't immediately clear the URL - just log the error
                    console.log('⚠️ Edit profile image failed to load. This might be a temporary issue.');
                  }}
                  onLoad={() => {
                    console.log('✅ Edit profile image loaded successfully:', editForm.avatar_url);
                  }}
                  onLoadStart={() => {
                    console.log('🔄 Edit profile image loading started:', editForm.avatar_url);
                  }}
                  onLoadEnd={() => {
                    console.log('🏁 Edit profile image loading ended');
                  }}
                />
              ) : (
                <View style={styles.editAvatarPlaceholder}>
                  <Ionicons name="person" size={40} color="#fff" />
                </View>
              )}
              <TouchableOpacity style={styles.editAvatarButton} onPress={handlePickAndUploadAvatar}>
                <Ionicons name="camera" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
            <Text style={styles.editAvatarLabel}>Profile Picture</Text>
            {isUploadingImage && (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="small" color="#6B9BD1" />
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
          <View style={{ width: 24 }} />
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeFriendsTab === 'search' && styles.activeTab]}
            onPress={() => setActiveFriendsTab('search')}
          >
            <Text style={[styles.tabText, activeFriendsTab === 'search' && styles.activeTabText]}>
              Find Friends
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeFriendsTab === 'requests' && styles.activeTab]}
            onPress={() => setActiveFriendsTab('requests')}
          >
            <Text style={[styles.tabText, activeFriendsTab === 'requests' && styles.activeTabText]}>
              Requests ({friendRequests.length + sentFriendRequests.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeFriendsTab === 'friends' && styles.activeTab]}
            onPress={() => setActiveFriendsTab('friends')}
          >
            <Text style={[styles.tabText, activeFriendsTab === 'friends' && styles.activeTabText]}>
              Friends ({friends.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <ScrollView 
          style={styles.modalContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshingFriends}
              onRefresh={handleFriendsRefresh}
              tintColor="#00ACC1"
            />
          }
        >
          {activeFriendsTab === 'friends' && (
            <>
              {friends.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>No friends yet</Text>
                  <Text style={styles.emptySubtext}>
                    Use the Find Friends tab to connect with others
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
        style={{
          backgroundColor: 'transparent', // Remove any background
          padding: 0, // Remove any padding
        }}
        onPress={() => removeFriend(friend.friendship_id)}
      >
        <Ionicons name="close" size={16} color="#999" />
      </TouchableOpacity>
                </View>
                ))
              )}
            </>
          )}

          {activeFriendsTab === 'requests' && (
            <>
              {/* Received Requests Section */}
              <View style={styles.requestsSection}>
                <Text style={styles.requestsSectionTitle}>Received Requests</Text>
                <Text style={styles.requestsCount}>{friendRequests.length}</Text>
              </View>
              
              {friendRequests.length === 0 ? (
                <View style={styles.emptyRequestsContainer}>
                  <Ionicons name="mail-outline" size={32} color="#8E8E93" />
                  <Text style={styles.emptyRequestsText}>No pending requests</Text>
                </View>
              ) : (
                friendRequests.map((request, index) => (
                  <View key={`request-${request.friendship_id}-${index}`} style={styles.requestItem}>
                    <View style={styles.requestUserInfo}>
                      {request.requester_avatar ? (
                        <Image source={{ uri: request.requester_avatar }} style={styles.requestAvatar} />
                      ) : (
                        <View style={styles.requestAvatarPlaceholder}>
                          <Ionicons name="person" size={14} color="#8E8E93" />
                        </View>
                      )}
                      <View style={styles.requestUserDetails}>
                        <Text style={styles.requestUserName}>{request.requester_name}</Text>
                        <Text style={styles.requestUserUsername}>@{request.requester_username || 'no-username'}</Text>
                      </View>
                    </View>
                    <View style={styles.requestButtons}>
                      <TouchableOpacity
                        style={styles.acceptRequestButton}
                        onPress={() => acceptFriendRequest(request.friendship_id)}
                      >
                        <Text style={styles.acceptRequestText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.declineRequestButton}
                        onPress={() => declineFriendRequest(request.friendship_id)}
                      >
                        <Text style={styles.declineRequestText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}

              {/* Sent Requests Section */}
              <View style={styles.requestsSection}>
                <Text style={styles.requestsSectionTitle}>Sent Requests</Text>
                <Text style={styles.requestsCount}>{sentFriendRequests.length}</Text>
              </View>
              
              {sentFriendRequests.length === 0 ? (
                <View style={styles.emptyRequestsContainer}>
                  <Ionicons name="paper-plane-outline" size={32} color="#8E8E93" />
                  <Text style={styles.emptyRequestsText}>No sent requests</Text>
                </View>
              ) : (
                sentFriendRequests.map((request, index) => (
                  <View key={`sent-request-${request.friendship_id}-${index}`} style={styles.requestItem}>
                    <View style={styles.requestUserInfo}>
                      {request.requester_avatar ? (
                        <Image source={{ uri: request.requester_avatar }} style={styles.requestAvatar} />
                      ) : (
                        <View style={styles.requestAvatarPlaceholder}>
                          <Ionicons name="person" size={14} color="#8E8E93" />
                        </View>
                      )}
                      <View style={styles.requestUserDetails}>
                        <Text style={styles.requestUserName}>{request.requester_name}</Text>
                        <Text style={styles.requestUserUsername}>@{request.requester_username || 'no-username'}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.removeFriendButton}
                      onPress={() => cancelFriendRequest(request.friendship_id)}
                    >
                      <Ionicons name="close" size={16} color="#8E8E93" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}

          {activeFriendsTab === 'search' && (
            <>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name or username..."
                  value={searchTerm}
                  onChangeText={handleSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {isSearching && <ActivityIndicator size="small" color="#00ACC1" style={styles.searchLoading} />}
              </View>

              {searchResults.length === 0 && searchTerm.trim() ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>No users found</Text>
                  <Text style={styles.emptySubtext}>
                    Try searching with a different name or username
                  </Text>
                </View>
              ) : searchResults.length > 0 ? (
                searchResults.map((result, index) => (
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
        <TouchableOpacity
                                              style={[
                          styles.actionButton,
                          result.is_friend 
                            ? { backgroundColor: '#34C759' }
                            : { backgroundColor: '#00ACC1' }
                        ]}
                      onPress={() => {
                        if (result.is_friend) {
                          Alert.alert('Already Friends', 'You are already friends with this user.');
                        } else {
                          sendFriendRequest(result.user_id);
                        }
                      }}
                      disabled={result.is_friend}
        >
                      <Ionicons 
                        name={result.is_friend ? "checkmark" : "person-add"} 
                        size={16} 
                        color="#fff" 
                      />
        </TouchableOpacity>
      </View>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
    );

  const renderSimpleFriendsModal = () => (
    <Modal
      visible={showSimpleFriendsModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowSimpleFriendsModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowSimpleFriendsModal(false)}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>My Friends</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView 
          style={styles.modalContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshingFriends}
              onRefresh={handleFriendsRefresh}
              tintColor="#00ACC1"
            />
          }
        >
          {friends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No friends yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the add friends icon to find and connect with others
            </Text>
            </View>
          ) : (
            friends.map((friend, index) => (
              <View key={`simple-friend-${friend.friendship_id}-${index}`} style={styles.friendItem}>
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
                  style={{
                    backgroundColor: 'transparent', // Remove any background
                    padding: 0, // Remove any padding
                  }}
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
      transparent={true}
      onRequestClose={() => {
        // Reset selection state when modal closes
        setIsMultiSelectMode(false);
        setSelectedMemories(new Set());
      }}
      onShow={() => {
        // Refresh memories when modal opens to ensure we have the latest data
        if (user?.id) {
          console.log('🔄 Refreshing memories on modal open...');
          loadMemories(user.id);
        }
      }}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => {
            setShowMemoriesModal(false); // Actually close the modal
            setIsMultiSelectMode(false);
            setSelectedMemories(new Set());
          }}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {isMultiSelectMode ? `Memories (${selectedMemories.size} selected)` : 'Memories'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {isMultiSelectMode ? (
              <>
                {isDeletingMemories && (
                  <ActivityIndicator size="small" color="#FF3B30" />
                )}
                <TouchableOpacity
                  onPress={deleteSelectedMemories}
                  disabled={selectedMemories.size === 0 || isDeletingMemories}
                >
                  <Ionicons 
                    name="trash-outline" 
                    size={24} 
                    color={selectedMemories.size === 0 || isDeletingMemories ? "#ccc" : "#FF3B30"} 
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleMultiSelectMode}
                  disabled={isDeletingMemories}
                >
                  <Text style={[styles.cancelText, { color: isDeletingMemories ? "#ccc" : "#00ACC1" }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={toggleMultiSelectMode}
                >
                  <Text style={styles.selectText}>Select</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {isLoadingMemories ? (
          <View style={styles.minimalLoadingContainer}>
            <ActivityIndicator size="small" color="#00ACC1" />
          </View>
        ) : memories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No memories yet</Text>
            <Text style={styles.emptySubtext}>
              Photos from your habits and events will appear here
            </Text>
            <TouchableOpacity 
              style={[styles.debugButton, { marginTop: 12, backgroundColor: '#34C759' }]} 
              onPress={async () => {
                if (user?.id) {
                  await testPhotoLoading(user.id);
                }
              }}
            >
              <Text style={styles.debugButtonText}>Test Photo Loading</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.debugButton, { marginTop: 12, backgroundColor: '#5856D6' }]} 
              onPress={async () => {
                await checkAvailableBuckets();
              }}
            >
              <Text style={styles.debugButtonText}>Check Buckets</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.debugButton, { marginTop: 12, backgroundColor: '#FF9500' }]} 
              onPress={async () => {
                if (user?.id) {
                  Alert.alert('Clean Broken Photos', 'This will remove photos that point to non-existent buckets (event-photos, habit-photos). You will need to re-upload these photos. Continue?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clean Broken Photos',
                      onPress: async () => {
                        await migratePhotosToMemoriesBucket(user.id);
                        await loadMemories(user.id);
                      }
                    }
                  ]);
                }
              }}
            >
              <Text style={styles.debugButtonText}>Clean Broken Photos</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.debugButton, { marginTop: 12, backgroundColor: '#5856D6' }]} 
              onPress={async () => {
                if (user?.id) {
                  await checkHabitPhotos(user.id);
                }
              }}
            >
              <Text style={styles.debugButtonText}>Check Habit Photos</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.debugButton, { marginTop: 12, backgroundColor: '#FF6B6B' }]} 
              onPress={async () => {
                if (user?.id) {
                  await comprehensiveHabitPhotoCheck(user.id);
                }
              }}
            >
              <Text style={styles.debugButtonText}>Comprehensive Check</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.debugButton, { marginTop: 12, backgroundColor: '#00ACC1' }]} 
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
              style={[styles.debugButton, { marginTop: 12, backgroundColor: '#FF3B30' }]} 
              onPress={async () => {
                if (user?.id) {
                  Alert.alert('Clear All Memories', 'This will permanently remove ALL photos from your habits and events. This action cannot be undone. Are you sure?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear All Memories',
                      style: 'destructive',
                      onPress: async () => {
                        await clearAllMemories(user.id);
                        Alert.alert('Success', 'All memories have been cleared!');
                      }
                    }
                  ]);
                }
              }}
            >
              <Text style={styles.debugButtonText}>Clear All Memories</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={memories.flatMap(group => group.memories)}
            keyExtractor={(item) => item.id}
            numColumns={4}
            refreshControl={
              <RefreshControl
                refreshing={isLoadingMemories}
                onRefresh={() => {
                  if (user?.id) {
                    console.log('🔄 Pull-to-refresh triggered for memories...');
                    loadMemories(user.id);
                  }
                }}
                colors={['#00ACC1']}
                tintColor="#00ACC1"
              />
            }
            renderItem={({ item: memory }) => (
              <TouchableOpacity
                style={styles.memoryItem}
                onPress={() => {
                  if (isMultiSelectMode) {
                    toggleMemorySelection(memory.id);
                  } else {
                    setSelectedPhotoForZoom({
                      update_id: memory.id || '',
                      user_id: user?.id || '',
                      user_name: profile?.full_name || '',
                      user_avatar: profile?.avatar_url || '',
                      user_username: profile?.username || '',
                      photo_url: memory.photoUri,
                      caption: memory.description || '',
                      source_type: memory.type,
                      source_title: memory.title || '',
                      created_at: memory.date || '',
                    });
                    setShowPhotoZoomModal(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: memory.photoUri }}
                  style={styles.memoryImage}
                  resizeMode="cover"
                  onError={(error) => {
                    // Silently handle image loading failures
                    setFailedImages(prev => new Set(prev).add(memory.id));
                  }}
                  onLoad={() => {
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
                
                {/* Selection indicator */}
                {isMultiSelectMode && (
                  <View style={[
                    styles.memorySelectionIndicator,
                    selectedMemories.has(memory.id) && styles.memorySelectionIndicatorSelected
                  ]}>
                    <View style={[
                      styles.memoryCheckbox,
                      selectedMemories.has(memory.id) && styles.memoryCheckboxSelected
                    ]}>
                      {selectedMemories.has(memory.id) && (
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      )}
                    </View>
                  </View>
                )}
                
                <View style={styles.memoryOverlay}>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.memoriesList}
          />
        )}

        {/* Memory detail overlay rendered inside memories modal */}
        {showMemoryDetailModal && selectedMemory && (
          <View style={styles.memoryDetailOverlay}>
            {/* Full screen background image */}
            <Image
              source={{ uri: selectedMemory.photoUri }}
              style={styles.memoryDetailBackgroundImage}
              resizeMode="cover"
            />
            
            {/* Dark overlay for better text readability */}
            <View style={styles.memoryDetailDarkOverlay} />
            
            {/* Top bar with close button */}
            <View style={styles.memoryDetailTopBar}>
              <TouchableOpacity
                style={styles.memoryDetailCloseButton}
                onPress={() => setShowMemoryDetailModal(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* Bottom info panel */}
            <View style={styles.memoryDetailBottomPanel}>
              <View style={styles.memoryDetailInfo}>
                <View style={[
                  styles.memoryDetailTypeBadge,
                  { backgroundColor: selectedMemory.categoryColor || '#00ACC1' }
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
            </View>
          </View>
        )}
        {/* Photo view overlay inside the modal */}
        {showPhotoZoomModal && selectedPhotoForZoom && (
          <PhotoZoomViewer
            visible={true}
            photoUrl={selectedPhotoForZoom.photo_url}
            caption={selectedPhotoForZoom.caption}
            sourceType={selectedPhotoForZoom.source_type}
            sourceTitle={selectedPhotoForZoom.source_title}
            userAvatar={selectedPhotoForZoom.user_avatar}
            username={selectedPhotoForZoom.user_username}
            onClose={() => {
              setShowPhotoZoomModal(false);
              setSelectedPhotoForZoom(null);
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );

  const renderFriendsFeedModal = () => (
    <Modal
      visible={showFriendsFeedModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFriendsFeedModal(false)}
      onShow={() => {
        if (user?.id) {
          // Only load if we don't have data yet
          if (photoShares.length === 0) {
            loadPhotoShares(true);
          }
          markPhotoSharesAsRead();
        }
      }}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowFriendsFeedModal(false)}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Friends Feed</Text>
          <TouchableOpacity onPress={() => {
            loadPhotoShares(true);
            Toast.show({
              type: 'info',
              text1: 'Refreshing feed...',
              position: 'bottom',
            });
          }}>
            <Ionicons name="refresh" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {isLoadingPhotoShares ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00ACC1" />
            <Text style={styles.loadingText}>Loading friends feed...</Text>
          </View>
        ) : photoShares.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No friends feed yet</Text>
            <Text style={styles.emptySubtext}>
              When your friends share photos from their habits and events, they'll appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={photoShares}
            keyExtractor={(item, index) => `${item.update_id}-${index}`}
            renderItem={({ item }) => (
              <View style={styles.photoShareCard}>
                {/* User Header */}
                <View style={styles.userHeader}>
                  <View style={styles.userInfo}>
                    <Image
                      source={{ 
                        uri: item.user_avatar || 'https://via.placeholder.com/40x40?text=U'
                      }}
                      style={styles.userAvatar}
                    />
                    <View style={styles.userDetails}>
                      <Text style={[styles.userUsername, { fontWeight: 'bold', color: '#000', marginBottom: 2 }]}>{item.user_username}</Text>
                      <Text style={[styles.timeAgo, { marginTop: 0 }]}>{formatTimeAgo(item.created_at)}</Text>
                    </View>
                  </View>
                  {item.user_id === user?.id && (
                    <TouchableOpacity
                      onPress={() => {
                        console.log('🗑️ Delete button pressed for post:', {
                          update_id: item.update_id,
                          user_id: item.user_id,
                          current_user: user?.id
                        });
                        Alert.alert(
                          'Delete Post',
                          'Are you sure you want to delete this post?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => handleDeletePhotoShare(item.update_id) }
                          ]
                        );
                      }}
                      style={{ marginLeft: 12 }}
                    >
                      <Ionicons 
                        name="trash-outline" 
                        size={16} 
                        color={deletingPhotoId === item.update_id ? "#FF3B30" : "#8E8E93"} 
                      />
                    </TouchableOpacity>
                  )}
                </View>
                {/* Caption above photo, smaller font */}
                {item.caption && (
                  <Text style={[styles.caption, { fontSize: 13, marginBottom: 8, marginTop: 0 }]}>{item.caption}</Text>
                )}
                {/* Photo */}
                <TouchableOpacity 
                  style={{
                    borderRadius: 6,
                    overflow: 'hidden',
                  }}
                  onPress={() => {
                    setSelectedPhotoForZoom(item);
                    setShowPhotoZoomModal(true);
                  }}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri: item.photo_url }}
                    style={{
                      width: '100%',
                      height: photoDimensions[item.update_id]
                        ? (photoDimensions[item.update_id].width < photoDimensions[item.update_id].height ? 400 : 250)
                        : 300, // default height while loading
                      borderRadius: 12,
                      alignSelf: 'center',
                    }}
                    resizeMode="cover"
                    onLoad={e => {
                      const { width, height } = e.nativeEvent.source;
                      setPhotoDimensions(prev => ({
                        ...prev,
                        [item.update_id]: { width, height }
                      }));
                    }}
                  />
                </TouchableOpacity>
                {/* Caption and Source */}
                <View style={styles.contentContainer}>
                  <View style={styles.sourceContainer}>
                    <View style={[
                      styles.sourceBadge,
                      { backgroundColor: item.source_type === 'habit' ? '#4CAF50' : '#00BCD4' }
                    ]}>
                      <Ionicons 
                        name={item.source_type === 'habit' ? 'repeat' : 'calendar'} 
                        size={12} 
                        color="white" 
                      />
                      <Text style={styles.sourceText}>
                        {item.source_type === 'habit' ? 'Habit' : 'Event'}
                      </Text>
                    </View>
                    <Text style={styles.sourceTitle}>{item.source_title}</Text>
                  </View>
                </View>
              </View>
            )}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshingPhotoShares}
                onRefresh={handlePhotoSharesRefresh}
                colors={['#00ACC1']}
                tintColor="#00ACC1"
              />
            }
            onEndReached={handlePhotoSharesLoadMore}
            onEndReachedThreshold={0.1}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
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
          <TouchableOpacity 
            onPress={() => setShowSettingsModal(false)}
            style={styles.modalCloseButton}
          >
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
            {renderSettingsItem('home-outline', 'Default Screen', getDefaultScreenLabel((preferences.default_screen || 'calendar') as 'calendar' | 'todo' | 'notes' | 'profile'), () => {
              setShowSettingsModal(false);
              setShowDefaultScreenModal(true);
            })}
            {renderSettingsItem('logo-google', 'Google Calendar Sync', undefined, () => {
              setShowSettingsModal(false);
              setShowGoogleSyncModal(true);
            })}

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
            
            {renderSettingsItem('notifications-outline', 'Test Sharing Notifications', undefined, async () => {
              try {
                await testSharingNotifications();
                Toast.show({
                  type: 'success',
                  text1: 'Test Complete',
                  text2: 'Sharing notifications sent! Check your notifications.',
                  position: 'bottom',
                });
              } catch (error) {
                Toast.show({
                  type: 'error',
                  text1: 'Test Failed',
                  text2: 'Failed to send test notifications',
                  position: 'bottom',
                });
              }
            })}

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

  const renderDefaultScreenModal = () => (
    <Modal
      visible={showDefaultScreenModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowDefaultScreenModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowDefaultScreenModal(false)}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Choose Default Screen</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Select the screen that appears when you open the app</Text>
            
            {[
              { key: 'calendar', label: 'Calendar', icon: 'calendar-number-outline' },
              { key: 'todo', label: 'Todo', icon: 'list' },
              { key: 'notes', label: 'Notes', icon: 'document-text-outline' },
              { key: 'profile', label: 'Profile', icon: 'person-outline' }
            ].map((screen) => (
              <TouchableOpacity
                key={screen.key}
                style={[
                  styles.screenOption,
                  preferences.default_screen === screen.key && styles.selectedScreenOption
                ]}
                onPress={() => {
                  handlePreferenceChange('default_screen', screen.key);
                  setShowDefaultScreenModal(false);
                  // Reopen the settings modal after a brief delay
                  setTimeout(() => {
                    setShowSettingsModal(true);
                  }, 300);
                }}
              >
                <View style={styles.screenOptionLeft}>
                  <Ionicons 
                    name={screen.icon as any} 
                    size={20} 
                    color={preferences.default_screen === screen.key ? '#00ACC1' : '#666'} 
                  />
                  <Text style={[
                    styles.screenOptionLabel,
                    preferences.default_screen === screen.key && styles.selectedScreenOptionLabel
                  ]}>
                    {screen.label}
                  </Text>
                </View>
                {preferences.default_screen === screen.key && (
                  <Ionicons name="checkmark" size={20} color="#00ACC1" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderGoogleSyncModal = () => (
    <Modal
      visible={showGoogleSyncModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowGoogleSyncModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowGoogleSyncModal(false)}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Google Calendar Sync</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.modalContent}>
          <GoogleCalendarSyncNew
            userId={user?.id}
            onEventsSynced={() => {
              // Handle events synced
            }}
            onCalendarUnsynced={() => {
              // Handle calendar unsynced
            }}
            onCalendarColorUpdated={() => {
              // Handle calendar color updated
            }}
          />
        </View>
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

  // Add a new function to specifically clean up problematic photo references
  const cleanupProblematicPhotos = async (userId: string) => {
    try {
      console.log('🔧 Cleaning up problematic photos for user:', userId);
      
      // Get all habits with photos
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, photos')
        .eq('user_id', userId)
        .not('photos', 'is', null);

      if (habitsError) {
        console.error('Error fetching habits for problematic photo cleanup:', habitsError);
        return;
      }

      if (!habitsData || habitsData.length === 0) {
        console.log('🔧 No habits with photos found for cleanup');
        return;
      }

      console.log(`🔧 Found ${habitsData.length} habits to check for problematic photos`);

      let cleanedCount = 0;
      const updates: any[] = [];

      habitsData.forEach(habit => {
        console.log(`🔧 Checking habit ${habit.id}:`, habit.photos);
        
        if (habit.photos && typeof habit.photos === 'object') {
          const cleanedPhotos: { [date: string]: string } = {};
          let hasChanges = false;

          for (const [date, photoUri] of Object.entries(habit.photos)) {
            if (photoUri && typeof photoUri === 'string') {
              // Check for problematic photo references
              const isProblematic = (
                // UUID-like patterns (common in iOS file names)
                /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}\.[a-zA-Z]+$/.test(photoUri) ||
                // Simple file names without paths
                (!photoUri.includes('/') && 
                 !photoUri.includes('\\') && 
                 photoUri.includes('.') && 
                 !photoUri.startsWith('http') && 
                 !photoUri.startsWith('file://') && 
                 !photoUri.startsWith('data:') &&
                 photoUri.length < 100) ||
                // Corrupted data URLs
                (photoUri.startsWith('data:') && photoUri.length < 100) ||
                // Supabase URLs that might be broken or timeout-prone
                (photoUri.startsWith('https://') && photoUri.includes('supabase.co') && photoUri.includes('habit-photos')) ||
                // Any URL that looks like it might be problematic (very long URLs, etc.)
                (photoUri.startsWith('http') && photoUri.length > 500) ||
                // URLs with suspicious patterns
                (photoUri.includes('localhost') || photoUri.includes('127.0.0.1'))
              );
              
              console.log(`🔧 Photo ${date}: ${photoUri} - isProblematic: ${isProblematic}`);
              
              if (isProblematic) {
                console.log(`🔧 Removing problematic photo from habit ${habit.id}, date ${date}: ${photoUri}`);
                hasChanges = true;
                // Don't add this to cleanedPhotos - effectively removing it
              } else {
                // Keep only valid, non-problematic URLs
                cleanedPhotos[date] = photoUri;
                console.log(`🔧 Keeping valid photo for habit ${habit.id}, date ${date}: ${photoUri}`);
              }
            }
          }

          if (hasChanges) {
            console.log(`🔧 Updating habit ${habit.id} with cleaned photos:`, cleanedPhotos);
            
            // If all photos were problematic (cleanedPhotos is empty), remove the photos object entirely
            const updateData = Object.keys(cleanedPhotos).length > 0 
              ? { photos: cleanedPhotos }
              : { photos: null };
            
            console.log(`🔧 Final update data for habit ${habit.id}:`, updateData);
            updates.push({ habitId: habit.id, updateData });
            cleanedCount++;
          } else {
            console.log(`🔧 No changes needed for habit ${habit.id}`);
          }
        }
      });

      if (updates.length > 0) {
        console.log(`🔧 Applying ${updates.length} updates to clean up problematic photos`);
        for (const update of updates) {
          const { error } = await supabase
            .from('habits')
            .update(update.updateData)
            .eq('id', update.habitId);

          if (error) {
            console.error(`🔧 Error updating habit ${update.habitId}:`, error);
          } else {
            console.log(`🔧 Successfully updated habit ${update.habitId}`);
          }
        }
        console.log(`🔧 Successfully cleaned up ${cleanedCount} habits with problematic photos`);
      } else {
        console.log('🔧 No problematic photos found to clean up');
      }
    } catch (error) {
      console.error('Error cleaning up problematic photos:', error);
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

  // Add a new function to specifically clean up timeout-prone URLs
  const cleanupTimeoutPronePhotos = async (userId: string) => {
    try {
      console.log('⏰ Cleaning up timeout-prone photos for user:', userId);
      
      // Get all habits with photos
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, photos')
        .eq('user_id', userId)
        .not('photos', 'is', null);

      if (habitsError) {
        console.error('Error fetching habits for timeout cleanup:', habitsError);
        return;
      }

      if (!habitsData || habitsData.length === 0) {
        console.log('⏰ No habits with photos found for timeout cleanup');
        return;
      }

      console.log(`⏰ Found ${habitsData.length} habits to check for timeout-prone photos`);

      let cleanedCount = 0;
      const updates: any[] = [];

      habitsData.forEach(habit => {
        console.log(`⏰ Checking habit ${habit.id}:`, habit.photos);
        
        if (habit.photos && typeof habit.photos === 'object') {
          const cleanedPhotos: { [date: string]: string } = {};
          let hasChanges = false;

          for (const [date, photoUri] of Object.entries(habit.photos)) {
            if (photoUri && typeof photoUri === 'string') {
              // Check for timeout-prone photo references
              const isTimeoutProne = (
                // Supabase URLs that are likely to timeout
                (photoUri.startsWith('https://') && photoUri.includes('supabase.co') && photoUri.includes('habit-photos')) ||
                // Very long URLs that might timeout
                (photoUri.startsWith('http') && photoUri.length > 500) ||
                // URLs with complex query parameters
                (photoUri.includes('?') && photoUri.includes('&') && photoUri.length > 300) ||
                // URLs pointing to external services that might be slow
                (photoUri.includes('cloudinary.com') || photoUri.includes('imgur.com') || photoUri.includes('amazonaws.com'))
              );
              
              console.log(`⏰ Photo ${date}: ${photoUri} - isTimeoutProne: ${isTimeoutProne}`);
              
              if (isTimeoutProne) {
                console.log(`⏰ Removing timeout-prone photo from habit ${habit.id}, date ${date}: ${photoUri}`);
                hasChanges = true;
                // Don't add this to cleanedPhotos - effectively removing it
              } else {
                // Keep only fast-loading URLs
                cleanedPhotos[date] = photoUri;
                console.log(`⏰ Keeping fast photo for habit ${habit.id}, date ${date}: ${photoUri}`);
              }
            }
          }

          if (hasChanges) {
            console.log(`⏰ Updating habit ${habit.id} with cleaned photos:`, cleanedPhotos);
            
            // If all photos were timeout-prone (cleanedPhotos is empty), remove the photos object entirely
            const updateData = Object.keys(cleanedPhotos).length > 0 
              ? { photos: cleanedPhotos }
              : { photos: null };
            
            console.log(`⏰ Final update data for habit ${habit.id}:`, updateData);
            updates.push({ habitId: habit.id, updateData });
            cleanedCount++;
          } else {
            console.log(`⏰ No changes needed for habit ${habit.id}`);
          }
        }
      });

      if (updates.length > 0) {
        console.log(`⏰ Applying ${updates.length} updates to clean up timeout-prone photos`);
        for (const update of updates) {
          const { error } = await supabase
            .from('habits')
            .update(update.updateData)
            .eq('id', update.habitId);

          if (error) {
            console.error(`⏰ Error updating habit ${update.habitId}:`, error);
          } else {
            console.log(`⏰ Successfully updated habit ${update.habitId}`);
          }
        }
        console.log(`⏰ Successfully cleaned up ${cleanedCount} habits with timeout-prone photos`);
      } else {
        console.log('⏰ No timeout-prone photos found to clean up');
      }
    } catch (error) {
      console.error('Error cleaning up timeout-prone photos:', error);
    }
  };

  // Add a new function to immediately remove ALL photo references
  const removeAllPhotoReferences = async (userId: string) => {
    try {
      console.log('💥 Removing ALL photo references for user:', userId);
      
      // Get all habits with photos
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, photos')
        .eq('user_id', userId)
        .not('photos', 'is', null);

      if (habitsError) {
        console.error('Error fetching habits for photo removal:', habitsError);
        return;
      }

      if (!habitsData || habitsData.length === 0) {
        console.log('💥 No habits with photos found for removal');
        return;
      }

      console.log(`💥 Found ${habitsData.length} habits to remove ALL photos from`);

      let removedCount = 0;

      // Remove ALL photos from ALL habits
      for (const habit of habitsData) {
        console.log(`💥 Removing ALL photos from habit ${habit.id}:`, habit.photos);
        const { error } = await supabase
          .from('habits')
          .update({ photos: null })
          .eq('id', habit.id);
        
        if (error) {
          console.error(`💥 Error removing photos from habit ${habit.id}:`, error);
        } else {
          console.log(`💥 Successfully removed ALL photos from habit ${habit.id}`);
          removedCount++;
        }
      }

      console.log(`💥 Successfully removed ALL photos from ${removedCount} habits`);
    } catch (error) {
      console.error('Error removing all photo references:', error);
    }
  };

  // Add a function to immediately fix the specific UUID file name issue
  const fixUUIDFileNames = async (userId: string) => {
    try {
      console.log('🔧 Fixing UUID file names for user:', userId);
      
      // Get all habits with photos
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, photos')
        .eq('user_id', userId)
        .not('photos', 'is', null);

      if (habitsError) {
        console.error('Error fetching habits for UUID fix:', habitsError);
        return;
      }

      if (!habitsData || habitsData.length === 0) {
        console.log('🔧 No habits with photos found for UUID fix');
        return;
      }

      console.log(`🔧 Found ${habitsData.length} habits to check for UUID file names`);

      let fixedCount = 0;
      const updates: any[] = [];

      habitsData.forEach(habit => {
        console.log(`🔧 Checking habit ${habit.id}:`, habit.photos);
        
        if (habit.photos && typeof habit.photos === 'object') {
          const cleanedPhotos: { [date: string]: string } = {};
          let hasChanges = false;

          for (const [date, photoUri] of Object.entries(habit.photos)) {
            if (photoUri && typeof photoUri === 'string') {
              // Check specifically for UUID-like patterns
              const isUUIDFileName = /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}\.[a-zA-Z]+$/.test(photoUri);
              
              console.log(`🔧 Photo ${date}: ${photoUri} - isUUIDFileName: ${isUUIDFileName}`);
              
              if (isUUIDFileName) {
                console.log(`🔧 Removing UUID file name from habit ${habit.id}, date ${date}: ${photoUri}`);
                hasChanges = true;
                // Don't add this to cleanedPhotos - effectively removing it
              } else {
                // Keep non-UUID photos
                cleanedPhotos[date] = photoUri;
                console.log(`🔧 Keeping non-UUID photo for habit ${habit.id}, date ${date}: ${photoUri}`);
              }
            }
          }

          if (hasChanges) {
            console.log(`🔧 Updating habit ${habit.id} with cleaned photos:`, cleanedPhotos);
            
            // If all photos were UUID file names (cleanedPhotos is empty), remove the photos object entirely
            const updateData = Object.keys(cleanedPhotos).length > 0 
              ? { photos: cleanedPhotos }
              : { photos: null };
            
            console.log(`🔧 Final update data for habit ${habit.id}:`, updateData);
            updates.push({ habitId: habit.id, updateData });
            fixedCount++;
          } else {
            console.log(`🔧 No UUID file names found in habit ${habit.id}`);
          }
        }
      });

      if (updates.length > 0) {
        console.log(`🔧 Applying ${updates.length} updates to fix UUID file names`);
        for (const update of updates) {
          const { error } = await supabase
            .from('habits')
            .update(update.updateData)
            .eq('id', update.habitId);

          if (error) {
            console.error(`🔧 Error updating habit ${update.habitId}:`, error);
          } else {
            console.log(`🔧 Successfully updated habit ${update.habitId}`);
          }
        }
        console.log(`🔧 Successfully fixed UUID file names in ${fixedCount} habits`);
      } else {
        console.log('🔧 No UUID file names found to fix');
      }
    } catch (error) {
      console.error('Error fixing UUID file names:', error);
    }
  };

  const testPhotoLoading = async (userId: string) => {
    try {
      console.log('🧪 Testing photo loading for user:', userId);
      
      // Check habits with photos
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, text, photos')
        .eq('user_id', userId)
        .not('photos', 'is', null);

      if (habitsError) {
        console.error('Error testing habits:', habitsError);
        return;
      }

      console.log('🧪 Habits with photos found:', habitsData?.length || 0);
      
      if (habitsData && habitsData.length > 0) {
        habitsData.forEach(habit => {
          console.log(`🧪 Habit ${habit.id} (${habit.text}):`, habit.photos);
          if (habit.photos && typeof habit.photos === 'object') {
            const photoCount = Object.keys(habit.photos).length;
            console.log(`🧪   - ${photoCount} photos stored`);
            Object.entries(habit.photos).forEach(([date, photoUri]) => {
              console.log(`🧪   - Date ${date}: ${photoUri}`);
            });
          }
        });
      }

      // Check events with photos
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, title, photos')
        .eq('user_id', userId)
        .not('photos', 'is', null);

      if (eventsError) {
        console.error('Error testing events:', eventsError);
        return;
      }

      console.log('🧪 Events with photos found:', eventsData?.length || 0);
      
      if (eventsData && eventsData.length > 0) {
        eventsData.forEach(event => {
          console.log(`🧪 Event ${event.id} (${event.title}):`, event.photos);
          if (event.photos && Array.isArray(event.photos)) {
            console.log(`🧪   - ${event.photos.length} photos stored`);
            event.photos.forEach((photoUri, index) => {
              console.log(`🧪   - Photo ${index}: ${photoUri}`);
            });
          }
        });
      }

      Alert.alert('Test Complete', 'Check console for detailed photo information.');
    } catch (error) {
      console.error('Error testing photo loading:', error);
      Alert.alert('Test Error', 'Check console for error details.');
    }
  };

  const migratePhotosToMemoriesBucket = async (userId: string) => {
    try {
      console.log('🔄 Starting photo migration for user:', userId);
      
      // Get all habits with photos
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, text, photos')
        .eq('user_id', userId)
        .not('photos', 'is', null);

      if (habitsError) {
        console.error('Error fetching habits for migration:', habitsError);
        return;
      }

      if (!habitsData || habitsData.length === 0) {
        console.log('🔄 No habits with photos found for migration');
        return;
      }

      console.log(`🔄 Found ${habitsData.length} habits to migrate`);

      let cleanedCount = 0;
      const updates: any[] = [];

      for (const habit of habitsData) {
        console.log(`🔄 Processing habit ${habit.id} (${habit.text}):`, habit.photos);
        
        if (habit.photos && typeof habit.photos === 'object') {
          const cleanedPhotos: { [date: string]: string } = {};
          let hasChanges = false;

          for (const [date, photoUri] of Object.entries(habit.photos)) {
            if (photoUri && typeof photoUri === 'string') {
              // Check if this is a broken event-photos URL
              if (photoUri.includes('event-photos')) {
                console.log(`🔄 Found broken event-photos URL for date ${date}: ${photoUri}`);
                console.log(`🔄 Removing broken URL - user will need to re-upload this photo`);
                // Don't add this to cleanedPhotos - effectively removing it
                hasChanges = true;
              } else if (photoUri.includes('habit-photos')) {
                console.log(`🔄 Found old habit-photos URL for date ${date}: ${photoUri}`);
                console.log(`🔄 Removing old habit-photos URL - user will need to re-upload this photo`);
                // Don't add this to cleanedPhotos - effectively removing it
                hasChanges = true;
              } else {
                // Keep valid URLs that don't point to broken buckets
                cleanedPhotos[date] = photoUri;
                console.log(`🔄 Keeping valid photo URL for date ${date}: ${photoUri}`);
              }
            }
          }

          if (hasChanges) {
            console.log(`🔄 Updating habit ${habit.id} with cleaned photos:`, cleanedPhotos);
            
            // If all photos were broken (cleanedPhotos is empty), remove the photos object entirely
            const updateData = Object.keys(cleanedPhotos).length > 0 
              ? { photos: cleanedPhotos }
              : { photos: null };
            
            updates.push({ habitId: habit.id, updateData });
            cleanedCount++;
          }
        }
      }

      // Apply all updates
      if (updates.length > 0) {
        console.log(`🔄 Applying ${updates.length} updates to clean broken photo URLs`);
        for (const update of updates) {
          const { error } = await supabase
            .from('habits')
            .update(update.updateData)
            .eq('id', update.habitId);

          if (error) {
            console.error(`🔄 Error updating habit ${update.habitId}:`, error);
          } else {
            console.log(`🔄 Successfully updated habit ${update.habitId}`);
          }
        }
        console.log(`🔄 Successfully cleaned ${cleanedCount} habits with broken photo URLs`);
      } else {
        console.log('🔄 No broken photo URLs found to clean');
      }
      
      Alert.alert(
        'Migration Complete', 
        `Successfully cleaned ${cleanedCount} habits with broken photo URLs.\n\nNote: Photos that were stored in the old bucket have been removed. You'll need to re-upload them using the habit completion feature.`
      );
    } catch (error) {
      console.error('Error migrating photos:', error);
      Alert.alert('Migration Error', 'Failed to migrate photos. Check console for details.');
    }
  };

  const checkAvailableBuckets = async () => {
    try {
      console.log('🔍 Checking available storage buckets...');
      
      // Try to list buckets by attempting to access common bucket names
      const bucketNames = ['memories', 'avatars', 'habit-photos', 'event-photos', 'photos'];
      const availableBuckets: string[] = [];
      
      for (const bucketName of bucketNames) {
        try {
          const { data, error } = await supabase.storage
            .from(bucketName)
            .list('', { limit: 1 });
          
          if (!error) {
            availableBuckets.push(bucketName);
            console.log(`✅ Bucket "${bucketName}" exists`);
          } else {
            console.log(`❌ Bucket "${bucketName}" does not exist or is not accessible:`, error.message);
          }
        } catch (error) {
          console.log(`❌ Error checking bucket "${bucketName}":`, error);
        }
      }
      
      console.log('🔍 Available buckets:', availableBuckets);
      Alert.alert(
        'Available Buckets', 
        `Found ${availableBuckets.length} accessible buckets:\n\n${availableBuckets.join('\n')}\n\nCheck console for detailed information.`
      );
    } catch (error) {
      console.error('Error checking buckets:', error);
      Alert.alert('Error', 'Failed to check buckets. Check console for details.');
    }
  };

  const clearAllMemories = async (userId: string) => {
    try {
      console.log('🗑️ Clearing all memories for user:', userId);
      
      // Clear memories from habits - get ALL habits for this user
      const { data: allHabitsData, error: allHabitsError } = await supabase
        .from('habits')
        .select('id, photos')
        .eq('user_id', userId);

      if (allHabitsError) {
        console.error('Error fetching all habits for clearing:', allHabitsError);
        return;
      }

      if (allHabitsData && allHabitsData.length > 0) {
        console.log(`🗑️ Checking ${allHabitsData.length} habits for photos`);
        
        for (const habit of allHabitsData) {
          // Clear photos regardless of whether they exist or not
          const { error } = await supabase
            .from('habits')
            .update({ photos: null })
            .eq('id', habit.id);
          
          if (error) {
            console.error(`🗑️ Error clearing photos from habit ${habit.id}:`, error);
          } else {
            console.log(`🗑️ Successfully cleared photos from habit ${habit.id}`);
          }
        }
      }

      // Clear memories from events - get ALL events for this user
      const { data: allEventsData, error: allEventsError } = await supabase
        .from('events')
        .select('id, photos')
        .eq('user_id', userId);

      if (allEventsError) {
        console.error('Error fetching all events for clearing:', allEventsError);
        return;
      }

      if (allEventsData && allEventsData.length > 0) {
        console.log(`🗑️ Checking ${allEventsData.length} events for photos`);
        
        for (const event of allEventsData) {
          // Clear photos regardless of whether they exist or not
          const { error } = await supabase
            .from('events')
            .update({ photos: [] })
            .eq('id', event.id);
          
          if (error) {
            console.error(`🗑️ Error clearing photos from event ${event.id}:`, error);
          } else {
            console.log(`🗑️ Successfully cleared photos from event ${event.id}`);
          }
        }
      }

      // Clear local state immediately
      setMemories([]);
      setFailedImages(new Set());
      
      // Force reload memories to ensure UI is updated
      await loadMemories(userId);
      
      console.log('🗑️ All memories cleared successfully');
    } catch (error) {
      console.error('Error clearing all memories:', error);
      Alert.alert('Error', 'Failed to clear all memories. Please try again.');
    }
  };

  const checkHabitPhotos = async (userId: string) => {
    try {
      console.log('🔍 Checking habit photos for user:', userId);
      
      // Get all habits with photos
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, text, photos')
        .eq('user_id', userId)
        .not('photos', 'is', null);

      if (habitsError) {
        console.error('Error checking habit photos:', habitsError);
        return;
      }

      console.log('🔍 Habits with photos found:', habitsData);
      
      if (habitsData && habitsData.length > 0) {
        habitsData.forEach(habit => {
          console.log(`🔍 Habit ${habit.id} (${habit.text}):`, habit.photos);
        });
        Alert.alert('Habit Photos Found', `Found ${habitsData.length} habits with photos. Check console for details.`);
      } else {
        console.log('🔍 No habits with photos found');
        Alert.alert('No Habit Photos', 'No habits with photos found. You may need to complete some habits with photos first.');
      }
    } catch (error) {
      console.error('Error checking habit photos:', error);
      Alert.alert('Error', 'Failed to check habit photos. Please try again.');
    }
  };

  const comprehensiveHabitPhotoCheck = async (userId: string) => {
    try {
      console.log('🔍 Comprehensive habit photo check for user:', userId);
      
      // 1. Check all habits (with and without photos)
      const { data: allHabitsData, error: allHabitsError } = await supabase
        .from('habits')
        .select('id, text, photos, require_photo')
        .eq('user_id', userId);

      if (allHabitsError) {
        console.error('Error fetching all habits:', allHabitsError);
        Alert.alert('Error', 'Failed to fetch habits. Please try again.');
        return;
      }

      console.log('🔍 All habits found:', allHabitsData?.length || 0);
      
      if (allHabitsData && allHabitsData.length > 0) {
        allHabitsData.forEach(habit => {
          console.log(`🔍 Habit ${habit.id} (${habit.text}):`, {
            requirePhoto: habit.require_photo,
            hasPhotos: !!habit.photos,
            photoCount: habit.photos ? Object.keys(habit.photos).length : 0,
            photos: habit.photos
          });
        });
      }

      // 2. Check habits with photos specifically
      const { data: habitsWithPhotosData, error: habitsWithPhotosError } = await supabase
        .from('habits')
        .select('id, text, photos')
        .eq('user_id', userId)
        .not('photos', 'is', null);

      if (habitsWithPhotosError) {
        console.error('Error fetching habits with photos:', habitsWithPhotosError);
      } else {
        console.log('🔍 Habits with photos found:', habitsWithPhotosData?.length || 0);
        
        if (habitsWithPhotosData && habitsWithPhotosData.length > 0) {
          habitsWithPhotosData.forEach(habit => {
            console.log(`🔍 Habit with photos ${habit.id} (${habit.text}):`, habit.photos);
            if (habit.photos && typeof habit.photos === 'object') {
              Object.entries(habit.photos).forEach(([date, photoUrl]) => {
                console.log(`  📅 Date ${date}: ${photoUrl}`);
              });
            }
          });
        }
      }

      // 3. Check memories bucket access
      try {
        const { data: memoriesBucketData, error: memoriesBucketError } = await supabase.storage
            .from('memories')
          .list('', { limit: 10 });

        if (memoriesBucketError) {
          console.error('❌ Memories bucket access error:', memoriesBucketError);
        } else {
          console.log('✅ Memories bucket accessible, files found:', memoriesBucketData?.length || 0);
          if (memoriesBucketData && memoriesBucketData.length > 0) {
            memoriesBucketData.forEach(file => {
              console.log(`  📁 File: ${file.name}`);
            });
          }
        }
      } catch (storageError) {
        console.error('❌ Error accessing memories bucket:', storageError);
      }

      // 4. Check habit-photos bucket access
      try {
        const { data: habitPhotosBucketData, error: habitPhotosBucketError } = await supabase.storage
          .from('habit-photos')
          .list('', { limit: 10 });

        if (habitPhotosBucketError) {
          console.error('❌ Habit-photos bucket access error:', habitPhotosBucketError);
        } else {
          console.log('✅ Habit-photos bucket accessible, files found:', habitPhotosBucketData?.length || 0);
          if (habitPhotosBucketData && habitPhotosBucketData.length > 0) {
            habitPhotosBucketData.forEach(file => {
              console.log(`  📁 File: ${file.name}`);
            });
          }
        }
      } catch (storageError) {
        console.error('❌ Error accessing habit-photos bucket:', storageError);
      }

      // 5. Summary
      const totalHabits = allHabitsData?.length || 0;
      const habitsWithPhotos = habitsWithPhotosData?.length || 0;
      const habitsRequiringPhotos = allHabitsData?.filter(h => h.require_photo).length || 0;

      const summary = `Total habits: ${totalHabits}\nHabits with photos: ${habitsWithPhotos}\nHabits requiring photos: ${habitsRequiringPhotos}`;
      
      console.log('📊 Summary:', summary);
      Alert.alert('Comprehensive Check Complete', summary + '\n\nCheck console for detailed information.');
      
    } catch (error) {
      console.error('Error in comprehensive habit photo check:', error);
      Alert.alert('Error', 'Failed to perform comprehensive check. Please try again.');
    }
  };

  const loadPhotoShares = async (refresh = false) => {
    if (!user?.id) return;

    try {
      if (refresh) {
        setIsRefreshingPhotoShares(true);
        setPhotoSharesPage(0);
        setHasMorePhotoShares(true);
      } else {
        setIsLoadingPhotoShares(true);
      }

      const limit = 10;
      const offset = refresh ? 0 : photoSharesPage * limit;
      
      // For pagination, we need to fetch more data than the limit since the DB function doesn't support offset
      const fetchLimit = refresh ? limit : (photoSharesPage + 1) * limit;

      console.log('🔄 Loading photo shares for user:', user.id, 'limit:', limit, 'offset:', offset);

      // Try the main function first (without offset since it's not supported)
      let { data, error } = await supabase.rpc('get_friends_photo_shares_with_privacy', {
        current_user_id: user.id,
        limit_count: fetchLimit
      });
          
      if (error) {
        console.error('❌ Error with main friends feed function:', error);
        
        // Fallback: try to get basic photo shares directly
        console.log('🔄 Trying fallback approach...');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('social_updates')
          .select(`
            id,
            user_id,
            photo_url,
            caption,
            source_type,
            source_id,
            created_at
          `)
          .eq('type', 'photo_share')
          .not('photo_url', 'is', null)
          .order('created_at', { ascending: false })
          .range(0, fetchLimit - 1);

        if (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
          Alert.alert('Error', 'Failed to load friends feed. Please try again.');
          return;
        }

        // Get user profiles separately to avoid join issues
        const userIds = [...new Set(fallbackData?.map((item: any) => item.user_id) || [])];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, username')
          .in('id', userIds);

        const profilesMap = new Map(profilesData?.map((p: any) => [p.id, p]) || []);

        // Transform fallback data to match expected format
        data = fallbackData?.map((item: any) => {
          const profile = profilesMap.get(item.user_id);
          return {
            update_id: item.id,
            user_id: item.user_id,
            user_name: profile?.full_name || 'Unknown User',
            user_avatar: profile?.avatar_url,
            user_username: profile?.username || 'unknown',
            photo_url: item.photo_url,
            caption: item.caption || '',
            source_type: item.source_type || 'unknown',
            source_title: item.caption || 'Photo Share', // Will be updated below
            created_at: item.created_at,
            source_id: item.source_id // Add source_id for title lookup
          };
        }) || [];
      }

      // The database function already provides titles, so we don't need to fetch them separately
      // Just log what we got for debugging
      if (data && data.length > 0) {
        console.log('✅ Photo shares loaded with titles from database function');
        data.forEach((item: any, index: number) => {
          console.log(`${index + 1}. ${item.source_type}: "${item.source_title}"`);
        });
      }

      console.log('✅ Photo shares loaded:', data?.length || 0);

      // Log the first few posts to see their structure
      if (data && data.length > 0) {
        console.log('📋 Sample posts:', data.slice(0, 3).map((post: any) => ({
          update_id: post.update_id,
          user_id: post.user_id,
          user_username: post.user_username,
          source_type: post.source_type,
          source_title: post.source_title,
          photo_url: post.photo_url?.substring(0, 50) + '...'
        })));
      }

      // Handle pagination on client side since DB function doesn't support offset
      let currentPageData = data || [];
      
      if (refresh) {
        // For refresh, take the first page
        currentPageData = data?.slice(0, limit) || [];
        setPhotoShares(currentPageData);
        // Count unread photo shares (created after last viewed time)
        const unreadCount = currentPageData.filter((share: PhotoShare) => 
          new Date(share.created_at).getTime() > lastViewedPhotoShareTime
        ).length;
        setUnreadPhotoShares(unreadCount);
      } else {
        // For load more, take the new items (skip what we already have)
        const existingCount = photoShares.length;
        const newItems = data?.slice(existingCount, existingCount + limit) || [];
        setPhotoShares(prev => [...prev, ...newItems]);
        currentPageData = newItems;
      }

      // Set hasMorePhotoShares based on whether we got a full page of results
      // If we got fewer items than the limit, we've reached the end
      const hasMore = (data || []).length > (refresh ? limit : photoShares.length + limit);
      console.log(`📊 Pagination: got ${(data || []).length} total items, current page: ${currentPageData.length}, hasMore: ${hasMore}`);
      setHasMorePhotoShares(hasMore);
      setPhotoSharesPage(prev => refresh ? 1 : prev + 1);
    } catch (error) {
      console.error('❌ Error in loadPhotoShares:', error);
      Alert.alert('Error', 'Failed to load friends feed. Please try again.');
    } finally {
      setIsLoadingPhotoShares(false);
      setIsRefreshingPhotoShares(false);
    }
  };

  const handlePhotoSharesRefresh = () => {
    loadPhotoShares(true);
  };

  const handlePhotoSharesLoadMore = () => {
    if (hasMorePhotoShares && !isLoadingPhotoShares) {
      loadPhotoShares();
    }
  };

  const markPhotoSharesAsRead = () => {
    setLastViewedPhotoShareTime(Date.now());
    setUnreadPhotoShares(0);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
            } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    }
  };

  // Multi-select functions for memories
  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    setSelectedMemories(new Set());
  };

  const toggleMemorySelection = (memoryId: string) => {
    setSelectedMemories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memoryId)) {
        newSet.delete(memoryId);
      } else {
        newSet.add(memoryId);
      }
      return newSet;
    });
  };

  const selectAllMemories = () => {
    const allMemoryIds = memories.flatMap(group => group.memories.map(memory => memory.id));
    setSelectedMemories(new Set(allMemoryIds));
  };

  const deselectAllMemories = () => {
    setSelectedMemories(new Set());
  };

  const deleteSelectedMemories = async () => {
    if (selectedMemories.size === 0) return;

    Alert.alert(
      'Delete Selected Memories',
      `Are you sure you want to delete ${selectedMemories.size} selected memory${selectedMemories.size > 1 ? 'ies' : ''}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeletingMemories(true);
              
              // Group memories by type (habit vs event) for efficient deletion
              const habitMemories: { [habitId: string]: string[] } = {};
              const eventMemories: { [eventId: string]: number[] } = {};
              
              // Process each selected memory
              for (const memoryId of selectedMemories) {
                const memory = memories.flatMap(group => group.memories).find(m => m.id === memoryId);
                if (!memory) continue;
                
                if (memory.type === 'habit') {
                  const habitId = memoryId.split('_')[0];
                  const date = memory.date;
                  if (!habitMemories[habitId]) {
                    habitMemories[habitId] = [];
                  }
                  habitMemories[habitId].push(date);
                } else if (memory.type === 'event') {
                  const eventId = memoryId.split('_')[0];
                  const photoIndex = parseInt(memoryId.split('_')[1]);
                  if (!eventMemories[eventId]) {
                    eventMemories[eventId] = [];
                  }
                  eventMemories[eventId].push(photoIndex);
                }
              }
              
              // Delete habit photos
              for (const [habitId, dates] of Object.entries(habitMemories)) {
                console.log(`🗑️ Deleting habit photos for habit ${habitId}, dates:`, dates);
                
                const { data: habit, error: fetchError } = await supabase
                  .from('habits')
                  .select('photos')
                  .eq('id', habitId)
                  .single();
                
                if (fetchError) {
                  console.error(`❌ Error fetching habit ${habitId}:`, fetchError);
                  continue;
                }
                
                if (habit?.photos) {
                  console.log(`📸 Original habit photos:`, habit.photos);
                  const updatedPhotos = { ...habit.photos };
                  dates.forEach(date => {
                    console.log(`🗑️ Removing photo for date ${date}`);
                    delete updatedPhotos[date];
                  });
                  
                  console.log(`📸 Updated habit photos:`, updatedPhotos);
                  
                  const { error: updateError } = await supabase
                    .from('habits')
                    .update({ 
                      photos: Object.keys(updatedPhotos).length > 0 ? updatedPhotos : null
                    })
                    .eq('id', habitId);
                  
                  if (updateError) {
                    console.error(`❌ Error updating habit ${habitId}:`, updateError);
                  } else {
                    console.log(`✅ Successfully updated habit ${habitId}`);
                  }
                } else {
                  console.log(`⚠️ Habit ${habitId} has no photos to delete`);
                }
              }
              
              // Delete event photos
              for (const [eventId, photoIndices] of Object.entries(eventMemories)) {
                console.log(`🗑️ Deleting event photos for event ${eventId}, indices:`, photoIndices);
                
                const { data: event, error: fetchError } = await supabase
                  .from('events')
                  .select('photos, private_photos')
                  .eq('id', eventId)
                  .single();
                
                if (fetchError) {
                  console.error(`❌ Error fetching event ${eventId}:`, fetchError);
                  continue;
                }
                
                if (event?.photos && Array.isArray(event.photos)) {
                  console.log(`📸 Original event photos:`, event.photos);
                  const updatedPhotos = [...event.photos];
                  const updatedPrivatePhotos = [...(event.private_photos || [])];
                  
                  // Remove photos in reverse order to maintain correct indices
                  photoIndices.sort((a, b) => b - a).forEach(index => {
                    if (index >= 0 && index < updatedPhotos.length) {
                      const photoUrlToRemove = updatedPhotos[index];
                      console.log(`🗑️ Removing photo at index ${index}:`, photoUrlToRemove);
                      updatedPhotos.splice(index, 1);
                      
                      // Also remove from private_photos if it exists there
                      const privateIndex = updatedPrivatePhotos.indexOf(photoUrlToRemove);
                      if (privateIndex !== -1) {
                        updatedPrivatePhotos.splice(privateIndex, 1);
                      }
                      
                      // Remove the photo from friends feed (social_updates table)
                      if (user?.id) {
                        supabase
                          .from('social_updates')
                          .delete()
                          .eq('user_id', user.id)
                          .eq('type', 'photo_share')
                          .eq('source_type', 'event')
                          .eq('source_id', eventId)
                          .eq('photo_url', photoUrlToRemove)
                          .then(({ error: socialError }) => {
                            if (socialError) {
                              console.error('Error removing photo from friends feed:', socialError);
                            } else {
                              console.log('✅ Photo removed from friends feed');
                            }
                          });
                      }
                    }
                  });
                  
                  console.log(`📸 Updated event photos:`, updatedPhotos);
                  console.log(`📸 Updated private photos:`, updatedPrivatePhotos);
                  
                  const { error: updateError } = await supabase
                    .from('events')
                    .update({ 
                      photos: updatedPhotos,
                      private_photos: updatedPrivatePhotos
                    })
                    .eq('id', eventId);
                  
                  if (updateError) {
                    console.error(`❌ Error updating event ${eventId}:`, updateError);
                  } else {
                    console.log(`✅ Successfully updated event ${eventId}`);
                  }
                } else {
                  console.log(`⚠️ Event ${eventId} has no photos to delete`);
                }
              }
              
              // Refresh memories and exit multi-select mode
              if (user?.id) {
                console.log('🔄 Waiting for database updates to process...');
                // Wait a moment for database updates to process
                await new Promise(resolve => setTimeout(resolve, 500));
                console.log('🔄 Refreshing memories after deletion...');
                await loadMemories(user.id);
                console.log('✅ Memories refreshed successfully');
              }
              setIsMultiSelectMode(false);
              setSelectedMemories(new Set());
              
              Alert.alert('Success', `Successfully deleted ${selectedMemories.size} memory${selectedMemories.size > 1 ? 'ies' : ''}!`);
            } catch (error) {
              console.error('Error deleting selected memories:', error);
              Alert.alert('Error', 'Failed to delete some memories. Please try again.');
            } finally {
              setIsDeletingMemories(false);
            }
          }
        }
      ]
    );
  };

  const testStorageAccess = async () => {
    try {
      console.log('🔍 Testing storage access...');
      
      // Test avatars bucket
      const { data: avatarsData, error: avatarsError } = await supabase.storage
        .from('avatars')
        .list('', { limit: 1 });
      
      if (avatarsError) {
        console.log('❌ Avatars bucket error:', avatarsError.message);
      } else {
        console.log('✅ Avatars bucket accessible');
      }
      
      // Test memories bucket
      const { data: memoriesData, error: memoriesError } = await supabase.storage
        .from('memories')
        .list('', { limit: 1 });
      
      if (memoriesError) {
        console.log('❌ Memories bucket error:', memoriesError.message);
      } else {
        console.log('✅ Memories bucket accessible');
      }
      
      // Show options for cleanup
      Alert.alert(
        'Storage Test', 
        'Check console for results. Would you like to clean up the large avatar file?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Cleanup Avatar', onPress: cleanupLargeAvatar }
        ]
      );
      
    } catch (error) {
      console.error('❌ Storage test error:', error);
      Alert.alert('Error', 'Storage test failed');
    }
  };

  const cleanupLargeAvatar = async () => {
    if (!user) return;
    
    try {
      console.log('🧹 Cleaning up large avatar file...');
      
      // Delete the problematic file from memories bucket
      const { error: deleteError } = await supabase.storage
        .from('memories')
        .remove(['avatar-cf77e7d5-5743-46d5-add9-de9a1db64fd4-1751088440678.jpg']);
      
      if (deleteError) {
        console.log('❌ Failed to delete large avatar:', deleteError.message);
      } else {
        console.log('✅ Large avatar file deleted successfully');
      }
      
      // Clear the avatar URL from profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: '',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (updateError) {
        console.log('❌ Failed to clear avatar URL:', updateError.message);
      } else {
        console.log('✅ Avatar URL cleared from profile');
        
        // Update local state
        setProfile(prev => prev ? { ...prev, avatar_url: '' } : null);
        setEditForm(prev => ({ ...prev, avatar_url: '' }));
      }
      
      Alert.alert('Cleanup Complete', 'Large avatar file has been removed');
      
    } catch (error) {
      console.error('❌ Error cleaning up avatar:', error);
      Alert.alert('Error', 'Failed to cleanup avatar file');
    }
  };

  // Add this handler near other handlers
  const handleDeletePhotoShare = async (updateId: string) => {
    try {
      // Set the deleting state to show red color
      setDeletingPhotoId(updateId);
      
      console.log('🗑️ Attempting to delete post with ID:', updateId);
      console.log('🗑️ Current user ID:', user?.id);
      
      if (!user?.id) {
        console.error('❌ No user ID available');
        Alert.alert('Error', 'User not authenticated');
        return;
      }
      
      // First, let's check if the post exists and we can see it
      const { data: checkData, error: checkError } = await supabase
        .from('social_updates')
        .select('id, user_id, type, photo_url, created_at, source_type, source_id')
        .eq('id', updateId);
      
      console.log('🔍 Post check result:', { checkData, checkError });
      
      if (checkError) {
        console.error('❌ Error checking post:', checkError);
        Alert.alert('Error', `Cannot find post: ${checkError.message}`);
        return;
      }
      
      if (!checkData || checkData.length === 0) {
        console.log('⚠️ Post not found in database');
        Alert.alert('Error', 'Post not found in database');
        return;
      }
      
      const postToDelete = checkData[0];
      console.log('✅ Found post to delete:', postToDelete);
      
      // Check if the user owns this post
      if (postToDelete.user_id !== user.id) {
        console.error('❌ User does not own this post');
        Alert.alert('Error', 'You can only delete your own posts');
        return;
      }
      
      // Let's also check what posts the user can see
      const { data: allPosts, error: listError } = await supabase
        .from('social_updates')
        .select('id, user_id, type, photo_url')
        .eq('type', 'photo_share')
        .eq('user_id', user?.id)
        .limit(5);
      
      console.log('📋 User\'s posts:', { allPosts, listError });
      
      // Also check if the specific update_id exists in the user's posts
      const foundInUserPosts = allPosts?.find(post => post.id === updateId);
      console.log('🔍 Is update_id in user\'s posts?', foundInUserPosts);
      
      // Now try to delete it
      const { data, error } = await supabase
        .from('social_updates')
        .delete()
        .eq('id', updateId)
        .eq('user_id', user.id) // Add user_id check for extra security
        .select(); // Add select() to see what was deleted
      
      console.log('🗑️ Delete result:', { data, error });
      
      if (error) {
        console.error('❌ Delete error:', error);
        
        // Provide more specific error messages
        if (error.code === '42501') {
          Alert.alert('Error', 'Permission denied. You can only delete your own posts.');
        } else if (error.code === '23503') {
          Alert.alert('Error', 'Cannot delete post due to database constraints.');
        } else {
          Alert.alert('Error', `Failed to delete post: ${error.message}`);
        }
        return;
      }
      
      if (data && data.length > 0) {
        console.log('✅ Successfully deleted post:', data[0]);
        setPhotoShares(prev => prev.filter(item => item.update_id !== updateId));
        Toast.show({
          type: 'success',
          text1: 'Post deleted',
          position: 'bottom',
        });
        
        // Reset the deleting state after a short delay
        setTimeout(() => {
          setDeletingPhotoId(null);
        }, 1000);
      } else {
        console.log('⚠️ No rows were deleted');
        Alert.alert('Error', 'Post not found or already deleted');
        setDeletingPhotoId(null);
      }
    } catch (err) {
      console.error('❌ Exception in delete:', err);
      Alert.alert('Error', 'Failed to delete post.');
      setDeletingPhotoId(null);
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
            <Ionicons name="person-add-outline" size={20} color="#000" />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
          <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettingsModal(true)}>
            <Ionicons name="settings-outline" size={20} color="#000" />
      </TouchableOpacity>
    </View>
      )}
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {user && renderProfileHeader()}

        {user && (
          <View style={styles.featuresSection}>
            <View style={{ height: 40 }} />
            <View style={styles.featuresGrid}>

            {renderFeatureCard(
                'images-outline',
                'Memories',
                '',
                Number(memories.flatMap(group => group.memories).length) || undefined,
                () => setShowMemoriesModal(true)
              )}
              {renderFeatureCard(
                'people-outline',
                'Friends Feed',
                '',
                typeof unreadPhotoShares === 'number' && unreadPhotoShares > 0 ? unreadPhotoShares : undefined,
                () => setShowFriendsFeedModal(true)
              )}
            </View>
          </View>
        )}

        <View style={styles.accountSection}>
          {user ? null : (
            <View style={styles.signInContainer}>
              {/* App Logo and Name */}
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../assets/images/logo.png')} 
                  style={styles.appLogoImage}
                  resizeMode="contain"
                />
              </View>
              
              {/* Simple Loading Indicator when signing in */}
              {isLoading ? (
                <View style={styles.signInLoadingIndicator}>
                  <Animated.View style={[styles.signInDot, { opacity: dotAnimations[0] }]} />
                  <Animated.View style={[styles.signInDot, { opacity: dotAnimations[1] }]} />
                  <Animated.View style={[styles.signInDot, { opacity: dotAnimations[2] }]} />
                </View>
              ) : (
                /* Sign In Button */
                <TouchableOpacity
                  style={styles.minimalSignInButton}
                  onPress={handleSignIn}
                  disabled={isLoading}
                >
                  <Text style={styles.minimalSignInButtonText}>Get Started</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        </ScrollView>
      
      {/* Render modals at root level */}
      {renderEditProfileModal()}
      {renderFriendsListModal()}
      {renderSimpleFriendsModal()}
      {renderMemoriesModal()}
      {renderFriendsFeedModal()}
      {renderSettingsModal()}
      {renderDefaultScreenModal()}
      {renderGoogleSyncModal()}
      
      {/* Memory detail modal for viewing individual photos */}
      {showMemoryDetailModal && selectedMemory && (
        <Modal
          visible={showMemoryDetailModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowMemoryDetailModal(false)}
        >
          <View style={styles.memoryDetailOverlay}>
            {/* Full screen background image */}
            <Image
              source={{ uri: selectedMemory.photoUri }}
              style={styles.memoryDetailBackgroundImage}
              resizeMode="cover"
            />
            
            {/* Dark overlay for better text readability */}
            <View style={styles.memoryDetailDarkOverlay} />
            
            {/* Top bar with close button */}
            <View style={styles.memoryDetailTopBar}>
              <TouchableOpacity
                style={styles.memoryDetailCloseButton}
                onPress={() => setShowMemoryDetailModal(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* Bottom info panel */}
            <View style={styles.memoryDetailBottomPanel}>
              <View style={styles.memoryDetailInfo}>
                <View style={[
                  styles.memoryDetailTypeBadge,
                  { backgroundColor: selectedMemory.categoryColor || '#00ACC1' }
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
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.light.background,
  },
  headerSpacer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    fontFamily: 'Onest',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: Colors.light.background,
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.light.accent,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 4,
    fontFamily: 'Onest',
  },
  profileUsername: {
    fontSize: 14,
    color: Colors.light.icon,
    fontFamily: 'Onest',
    marginBottom: 2,
  },
  profileBio: {
    fontSize: 13,
    color: Colors.light.icon,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Onest',
    lineHeight: 18,
    maxWidth: 280,
  },
  featuresSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 0,
  },
  featureIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  featureContent: {
    flex: 1,
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.light.text,
    marginBottom: 2,
    fontFamily: 'Onest',
  },
  featureTitleCentered: {
    marginBottom: 0,
  },
  featureSubtitle: {
    fontSize: 14,
    color: Colors.light.icon,
    fontFamily: 'Onest',
  },
  featureCount: {
    backgroundColor: Colors.light.accent,
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
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 10,
    fontFamily: 'Onest',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.light.icon,
    marginBottom: 12,
    fontFamily: 'Onest',
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
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
  settingsItemRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsLabel: {
    fontSize: 15,
    color: Colors.light.text,
    fontFamily: 'Onest',
  },
  settingsValue: {
    fontSize: 13,
    color: Colors.light.icon,
    marginRight: 8,
    fontFamily: 'Onest',
  },
  accountSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
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
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    width: '100%',
    minHeight: 400,
    paddingTop: '60%',
  },
  signInTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Onest',
  },
  signInSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
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
    paddingTop: 24,
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 8,
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
    color: '#6B9BD1',
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
    backgroundColor: '#6B9BD1',
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
    borderBottomColor: '#00ACC1',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  activeTabText: {
    color: '#00ACC1',
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  minimalLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#00ACC1',
    marginLeft: 8,
    fontWeight: '500',
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
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    fontFamily: 'Onest',
  },
  memoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
  },
  memoryItem: {
    width: '24.5%',
    aspectRatio: 1,
    position: 'relative',
    marginBottom: 2,
    marginHorizontal: 1,
  },
  memoryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  memoryDetailBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  memoryDetailDarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  memoryDetailTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 10,
  },
  memoryDetailCloseButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryDetailBottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  memoryDetailInfo: {
    marginBottom: 10,
  },
  memoryDetailTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  memoryDetailTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Onest',
  },
  memoryDetailTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'Onest',
  },
  memoryDetailDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
    fontFamily: 'Onest',
  },
  memoryDetailDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Onest',
  },
  memoriesList: {
    padding: 4,
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

  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // New minimalistic request styles
  requestsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12, // Reduced from 16
    backgroundColor: 'transparent', // Changed from #F8F9FA to transparent
    borderBottomWidth: 0.5, // Reduced from 1
    borderBottomColor: '#E5E5E7',
  },
  requestsSectionTitle: {
    fontSize: 14, // Reduced from 16
    fontWeight: '500', // Reduced from 600
    color: '#8E8E93', // Changed from #1C1C1E to lighter color
    fontFamily: 'Onest',
  },
  requestsCount: {
    fontSize: 12, // Reduced from 14
    fontWeight: '500',
    color: '#8E8E93',
    backgroundColor: 'transparent', // Removed background
    paddingHorizontal: 0, // Removed padding
    paddingVertical: 0, // Removed padding
    borderRadius: 0, // Removed border radius
    fontFamily: 'Onest',
  },
  emptyRequestsContainer: {
    alignItems: 'center',
    paddingVertical: 24, // Reduced from 32
    paddingHorizontal: 20,
  },
  emptyRequestsText: {
    fontSize: 14, // Reduced from 16
    color: '#8E8E93',
    marginTop: 8,
    fontFamily: 'Onest',
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12, // Reduced from 16
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  requestUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestAvatar: {
    width: 32, // Reduced from 40
    height: 32, // Reduced from 40
    borderRadius: 16, // Reduced from 20
    marginRight: 12,
  },
  requestAvatarPlaceholder: {
    width: 32, // Reduced from 40
    height: 32, // Reduced from 40
    borderRadius: 16, // Reduced from 20
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  requestUserDetails: {
    flex: 1,
  },
  requestUserName: {
    fontSize: 15, // Reduced from 16
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 2,
    fontFamily: 'Onest',
  },
  requestUserUsername: {
    fontSize: 13, // Reduced from 14
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  requestButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // Reduced from 8
  },
  acceptRequestButton: {
    backgroundColor: '#00ACC1',
    paddingHorizontal: 12, // Reduced from 16
    paddingVertical: 6, // Reduced from 8
    borderRadius: 12, // Reduced from 16
  },
  acceptRequestText: {
    fontSize: 13, // Reduced from 14
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Onest',
  },
  declineRequestButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12, // Reduced from 16
    paddingVertical: 6, // Reduced from 8
    borderRadius: 12, // Reduced from 16
  },
  declineRequestText: {
    fontSize: 13, // Reduced from 14
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Onest',
  },
  cancelRequestButton: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12, // Reduced from 16
    paddingVertical: 6, // Reduced from 8
    borderRadius: 12, // Reduced from 16
  },
  cancelRequestText: {
    fontSize: 13, // Reduced from 14
    fontWeight: '600',
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  cancelRequestIconButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
  },
  addFriendsButton: {
    padding: 12,
    borderRadius: 20,
  },
  friendCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2, // Reduced from 4 to 2
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
    backgroundColor: '#6B9BD1',
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
    backgroundColor: '#F8F9FA',
    borderRadius: 4,
  },
  memoryImagePlaceholderText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
    fontFamily: 'Onest',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontFamily: 'Onest',
    marginRight: 8,
  },
  searchLoading: {
    marginLeft: 8,
  },
 
  photoShareCard: {
    padding: 16,
    // backgroundColor: '#fff', // Remove background color
    borderRadius: 12,
    marginBottom: 16,
  },
  photo: {
    width: '100%',
    height: 240, // Default height for horizontal photos
    // borderRadius: 16, // Moved to TouchableOpacity wrapper
    // overflow: 'hidden', // Moved to TouchableOpacity wrapper
    // backgroundColor: 'transparent', // Ensure no background
  },
  photoSquare: {
    width: '100%',
    aspectRatio: 1, // 1:1 square format for vertical photos
    // borderRadius: 16, // Moved to TouchableOpacity wrapper
    // overflow: 'hidden', // Moved to TouchableOpacity wrapper
    // backgroundColor: 'transparent', // Ensure no background
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userUsername: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  timeAgo: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  contentContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'Onest',
    marginLeft: 4,
  },
  sourceTitle: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
    fontFamily: 'Onest',
  },
  caption: {
    fontSize: 19,
    color: '#000',
    fontFamily: 'Onest',
    marginTop: 6,
    marginBottom: 8,
  },
  listContainer: {
    padding: 20,
  },
  memorySelectionIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  memorySelectionIndicatorSelected: {
    // No additional styling needed for selected state
  },
  memoryCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryCheckboxSelected: {
    backgroundColor: '#00ACC1',
    borderColor: '#00ACC1',
  },
  selectText: {
    fontSize: 16,
    color: '#00ACC1',
    fontWeight: '600',
    fontFamily: 'Onest',
  },
  cancelText: {
    fontSize: 16,
    color: '#00ACC1',
    fontWeight: '600',
    fontFamily: 'Onest',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 0, // Reduced from 5 to 2
  },
  appLogoImage: {
    width: 140,
    height: 140,
    marginBottom: 0, // Reduced from 16 to 8
  },
  profileNameContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  editIcon: {
    marginLeft: 8,
  },
  // Photos section styles
  photosSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  featuresGrid: {
    gap: 3,
  },
  photosGrid: {
    gap: 16,
  },
  // Default screen selection styles
  screenOption: {
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
  selectedScreenOption: {
    backgroundColor: '#f0f4ff',
    borderWidth: 1,
    borderColor: '#6B9BD1',
  },
  screenOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  screenOptionLabel: {
    fontSize: 16,
    color: '#000',
    marginLeft: 12,
    fontFamily: 'Onest',
  },
  selectedScreenOptionLabel: {
    color: '#6B9BD1',
    fontWeight: '600',
  },
  // Sign-in styles matching loading screen design
  signInLoadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6B9BD1',
    marginHorizontal: 3,
  },
  minimalSignInButton: {
    backgroundColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  minimalSignInButtonText: {
    fontSize: 18,
    color: '#000',
    fontWeight: '500',
    fontFamily: 'Onest',
    letterSpacing: 0.5,
  },
});