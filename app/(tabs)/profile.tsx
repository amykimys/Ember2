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

  // Add useEffect to listen for photo deletion events and refresh memories
  useEffect(() => {
    let lastCheckTime = 0;
    
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
    };

    // Check every 2 seconds for photo deletions
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
            photos: habit.photos
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
                  console.log(`✅ Adding memory for date ${date}:`, photoUri);
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
                  console.log(`⚠️ Skipping obviously invalid photo for date ${date}:`, photoUri);
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

      // Fetch events with photos
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, title, description, date, photos, category_name, category_color')
        .eq('user_id', userId)
        .not('photos', 'is', null);

      if (eventsError) {
        console.error('Error fetching events with photos:', eventsError);
        // Don't return here, continue with habits data
      } else if (eventsData) {
        console.log('📸 Found events with photos:', eventsData.length);
        
        eventsData.forEach(event => {
          console.log(`🔍 Processing event ${event.id}:`, {
            title: event.title,
            photos: event.photos
          });
          
          if (event.photos && Array.isArray(event.photos) && event.photos.length > 0) {
            console.log(`📷 Photos array for event ${event.id}:`, event.photos);
            
            event.photos.forEach((photoUri, photoIndex) => {
              console.log(`📅 Processing photo ${photoIndex} for event ${event.id}:`, photoUri);
              
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
                  console.log(`✅ Adding event memory for date ${event.date}:`, photoUri);
                  allMemories.push({
                    id: `${event.id}_${photoIndex}`,
                    photoUri: photoUri,
                    date: event.date,
                    type: 'event',
                    title: event.title,
                    description: event.description,
                    categoryColor: event.category_color
                  });
                } else {
                  console.log(`⚠️ Skipping obviously invalid photo for event ${event.id}:`, photoUri);
                }
              } else {
                console.log(`❌ Skipping invalid photo for event ${event.id}:`, photoUri);
              }
            });
          } else {
            console.log(`❌ Event ${event.id} has no valid photos array:`, event.photos);
          }
        });
      } else {
        console.log('📸 No events with photos found');
      }

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
      
      <TouchableOpacity style={styles.friendCountContainer} onPress={() => setShowSimpleFriendsModal(true)}>
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
              Requests ({friendRequests.length})
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
        <ScrollView style={styles.modalContent}>
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
        style={styles.removeFriendButton}
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
              {friendRequests.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="mail-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>No friend requests</Text>
                  <Text style={styles.emptySubtext}>
                    When someone sends you a friend request, it will appear here
                  </Text>
                </View>
              ) : (
                friendRequests.map((request, index) => (
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
                        <Ionicons name="checkmark" size={16} color="#fff" />
              </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton]}
          onPress={() => declineFriendRequest(request.friendship_id)}
        >
                        <Ionicons name="close" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
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
                {isSearching && <ActivityIndicator size="small" color="#007AFF" style={styles.searchLoading} />}
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
                          : { backgroundColor: '#007AFF' }
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
                  <Ionicons name="search-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>Search for friends</Text>
                  <Text style={styles.emptySubtext}>
                    Enter a name or username to find people to connect with
                  </Text>
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

        <ScrollView style={styles.modalContent}>
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
              style={[styles.debugButton, { marginTop: 12, backgroundColor: '#007AFF' }]} 
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
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{ uri: memory.photoUri }}
                        style={styles.memoryImage}
                        resizeMode="cover"
                        onError={(error) => {
                          // Enhanced error detection for different types of image loading failures
                          const errorMessage = error.nativeEvent.error || '';
                          const isLocalFileError = errorMessage.includes("couldn't be opened because there is no such file") ||
                                                 errorMessage.includes("Unknown image download error") ||
                                                 memory.photoUri.includes('.jpg') && !memory.photoUri.includes('/');
                          
                          const isTimeoutError = errorMessage.includes("timed out") ||
                                                errorMessage.includes("timeout") ||
                                                errorMessage.includes("network error");
                          
                          const isNetworkError = errorMessage.includes("network") ||
                                                errorMessage.includes("connection") ||
                                                errorMessage.includes("failed to load");
                          
                          if (isLocalFileError) {
                            console.log(`⚠️ Local file error for memory ${memory.id}, marking as failed: ${memory.photoUri}`);
                          } else if (isTimeoutError) {
                            console.log(`⏰ Timeout error for memory ${memory.id}, marking as failed: ${memory.photoUri}`);
                          } else if (isNetworkError) {
                            console.log(`🌐 Network error for memory ${memory.id}, marking as failed: ${memory.photoUri}`);
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
                      </View>
                      <Text style={styles.memoryTitle} numberOfLines={2}>
                        {memory.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
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
            </View>
          </View>
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
      
      {/* Render modals at root level */}
      {renderEditProfileModal()}
      {renderFriendsListModal()}
      {renderSimpleFriendsModal()}
      {renderMemoriesModal()}
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
    height: 150,
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
    paddingTop: 20,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  memoryTitle: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'Onest',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
});