import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../../contexts/DataContext';
import { useTabBar } from '../../contexts/TabBarContext';
import { supabase } from '../../supabase';
import { User } from '@supabase/supabase-js';
import Toast from 'react-native-toast-message';
import PhotoZoomViewer from '../../components/PhotoZoomViewer';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { PanGestureHandler, GestureHandlerRootView, State } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedGestureHandler,
  withSpring,
  runOnJS
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

interface PhotoShare {
  update_id: string; // This maps to the 'id' column from the database
  user_id: string;
  user_name: string;
  user_avatar: string;
  user_username: string;
  photo_url: string; // Keep for backward compatibility
  photos?: string[]; // New multiple photos array
  photo_count?: number; // Number of photos
  caption: string;
  source_type: 'habit' | 'event';
  source_title: string;
  created_at: string;
  comments?: Comment[]; // Comments for this post
  comment_count?: number; // Number of comments
  media_type?: 'photo' | 'video'; // Type of media
  video_duration?: number; // Duration in seconds for videos
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  user_username: string;
  user_avatar: string;
  content: string;
  created_at: string;
}

export default function FriendsFeedScreen() {
  const { data: appData } = useData();
  const { setIsPhotoZoomed } = useTabBar();
  const [user, setUser] = useState<User | null>(null);
  const [photoShares, setPhotoShares] = useState<PhotoShare[]>([]);
  const [isLoadingPhotoShares, setIsLoadingPhotoShares] = useState(false);
  const [isRefreshingPhotoShares, setIsRefreshingPhotoShares] = useState(false);
  const [unreadPhotoShares, setUnreadPhotoShares] = useState(0);
  const [lastViewedPhotoShareTime, setLastViewedPhotoShareTime] = useState<number>(0);
  
  // Photo zoom state
  const [showPhotoZoomModal, setShowPhotoZoomModal] = useState(false);
  const [selectedPhotoForZoom, setSelectedPhotoForZoom] = useState<PhotoShare | null>(null);

  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  
  // Multi-photo post state
  const [postPhotoIndices, setPostPhotoIndices] = useState<{[key: string]: number}>({});
  const [zoomPhotoIndex, setZoomPhotoIndex] = useState(0);
  
  // Post creation state
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [selectedPhotosData, setSelectedPhotosData] = useState<Array<{uri: string, base64: string}>>([]);
  const [caption, setCaption] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [canPostToday, setCanPostToday] = useState(true);
  
  // Video state
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [videoDurations, setVideoDurations] = useState<{[key: string]: number}>({});
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  
  // Gallery state
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);
  const [galleryAssetIds, setGalleryAssetIds] = useState<string[]>([]); // Store asset IDs for pagination
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [galleryEndCursor, setGalleryEndCursor] = useState<string | null>(null); // Store end cursor for pagination
  const galleryScrollViewRef = useRef<ScrollView>(null);
  
  // Gallery categorization state
  const [galleryCategory, setGalleryCategory] = useState<'recents' | 'favorites' | 'videos' | 'all'>('recents');
  const [favoritePhotos, setFavoritePhotos] = useState<string[]>([]);
  const [videoAssets, setVideoAssets] = useState<string[]>([]);
  
  // Menu dropdown state
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  
  // Selected photos carousel state
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Comment state
  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<PhotoShare | null>(null);
  
  // Comment modal height state
  const [commentModalHeight, setCommentModalHeight] = useState<'compact' | 'expanded'>('compact');
  
  // Swipe gesture state
  const [swipeOffset, setSwipeOffset] = useState<{[key: string]: number}>({});
  const [swipeInProgress, setSwipeInProgress] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadPhotoShares();
      markPhotoSharesAsRead();
      checkCommentsTable(); // Check if comments table exists
    }
  }, [user]);

  // Debug effect for selectedPhotos state
  useEffect(() => {
    console.log('🔍 selectedPhotos state changed:', selectedPhotos);
  }, [selectedPhotos]);

  // Load gallery photos when modal opens
  useEffect(() => {
    if (showPostModal) {
      // Reset gallery state when modal opens
      if (galleryPhotos.length === 0) {
        setGalleryEndCursor(null);
        loadGalleryPhotosByCategory(galleryCategory);
      }
    } else {
      // Clear gallery when modal closes
      setGalleryPhotos([]);
      setGalleryAssetIds([]);
      setGalleryEndCursor(null);
    }
  }, [showPostModal]);

  // Reset current photo index when photos change
  useEffect(() => {
    if (selectedPhotos.length === 0) {
      setCurrentPhotoIndex(0);
    } else if (currentPhotoIndex >= selectedPhotos.length) {
      setCurrentPhotoIndex(selectedPhotos.length - 1);
    }
  }, [selectedPhotos, currentPhotoIndex]);

  // Check daily bit limit every minute to handle day changes
  useEffect(() => {
    if (user?.id) {
      const interval = setInterval(() => {
        checkCanPostToday(user.id);
      }, 60000); // Check every minute

      return () => clearInterval(interval);
    }
  }, [user?.id]);

  // Refresh feed when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log('🔄 App became active, refreshing feed...');
        loadPhotoShares();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [user?.id]);

  // Refresh feed when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 Friends feed screen focused, refreshing...');
      loadPhotoShares();
    }, [user?.id])
  );

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        console.log('✅ User session found:', session.user.email);
        checkCanPostToday(session.user.id);
      } else {
        console.log('❌ No user session found');
      }
    } catch (error) {
      console.error('❌ Error checking session:', error);
    }
  };

  const checkCanPostToday = async (userId: string) => {
    // Allow multiple posts per day - always set to true
    setCanPostToday(true);
  };

  const loadGalleryPhotos = async (loadMore = false) => {
    try {
      setIsLoadingGallery(true);
      
      // Request permissions first
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access to select photos.');
        return;
      }

      if (loadMore) {
        // For loading more photos, we need to use the end cursor for pagination
        if (!galleryEndCursor) {
          console.log('📸 No end cursor available for pagination');
          return;
        }

        console.log('📸 Loading more photos with end cursor:', galleryEndCursor);
        
        // Store the number of photos before adding new ones to calculate scroll position
        const previousPhotoCount = galleryPhotos.length;
        
        const { assets, endCursor } = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.photo,
          first: 200,
          sortBy: MediaLibrary.SortBy.creationTime,
          after: galleryEndCursor, // Use the end cursor for pagination
        });

        if (assets && assets.length > 0) {
          const photoUris = assets.map(asset => asset.uri);
          const assetIds = assets.map(asset => asset.id);
          
          // Append new photos to existing ones, avoiding duplicates
          setGalleryPhotos(prev => {
            const existingUris = new Set(prev);
            const newUris = photoUris.filter(uri => !existingUris.has(uri));
            return [...prev, ...newUris];
          });
          
          // Also append asset IDs
          setGalleryAssetIds(prev => [...prev, ...assetIds]);
          
          // Update end cursor for next pagination
          setGalleryEndCursor(endCursor);
          
          // Scroll to where the new photos start (maintain position where user was)
          setTimeout(() => {
            if (galleryScrollViewRef.current) {
              // Calculate the position where new photos start
              // Each photo is roughly 100px tall, so we scroll to where the new batch starts
              const newPhotosStartPosition = previousPhotoCount * 100; // Approximate position
              galleryScrollViewRef.current.scrollTo({ 
                y: newPhotosStartPosition, 
                animated: true 
              });
            }
          }, 100);
          
          console.log('📸 More gallery photos loaded:', photoUris.length, 'New end cursor:', endCursor);
        } else {
          console.log('📸 No more photos available to load');
        }
      } else {
        // Initial load - get first batch of photos
        const { assets, endCursor } = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.photo,
          first: 500, // Get more photos initially for better coverage
          sortBy: MediaLibrary.SortBy.creationTime,
        });

        if (assets && assets.length > 0) {
          const photoUris = assets.map(asset => asset.uri);
          const assetIds = assets.map(asset => asset.id);
          
          setGalleryPhotos(photoUris);
          setGalleryAssetIds(assetIds);
          setGalleryEndCursor(endCursor); // Store end cursor for pagination
          console.log('📸 Initial gallery photos loaded:', photoUris.length, 'End cursor:', endCursor);
        }
      }
    } catch (error) {
      console.error('❌ Error loading gallery photos:', error);
    } finally {
      setIsLoadingGallery(false);
    }
  };

  const selectPhotoFromGallery = (photoUri: string) => {
    // If photo is already selected, unselect it
    if (selectedPhotos.includes(photoUri)) {
      setSelectedPhotos(prev => prev.filter(uri => uri !== photoUri));
      setSelectedPhotosData(prev => prev.filter(data => data.uri !== photoUri));
      console.log('❌ Photo removed from selection:', photoUri);
      
      // Haptic feedback for deselection
      if (Platform.OS === 'ios') {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      return;
    }
    
    // If photo is not selected, check if we can add more
    if (selectedPhotos.length >= 5) {
      Alert.alert('Limit Reached', 'You can only select up to 5 photos per post.');
      return;
    }
    
    // Add the photo immediately for instant visual feedback
    setSelectedPhotos(prev => [...prev, photoUri]);
    setSelectedPhotosData(prev => [...prev, { uri: photoUri, base64: '' }]);
    console.log('✅ Photo added from gallery (base64 conversion deferred):', photoUri);
    
    // Haptic feedback for selection
    if (Platform.OS === 'ios') {
      const Haptics = require('expo-haptics');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Load photos based on selected category
  const loadGalleryPhotosByCategory = async (category: 'recents' | 'favorites' | 'videos' | 'all', loadMore = false) => {
    try {
      setIsLoadingGallery(true);
      
      if (category === 'favorites') {
        // Load favorite photos from iPhone Photos app
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please grant photo library access to view favorites.');
          return;
        }
        
        try {
          // Get all photos and filter for favorites
          const allAssets = await MediaLibrary.getAssetsAsync({
            mediaType: MediaLibrary.MediaType.photo,
            first: 1000, // Get more to find favorites
            sortBy: MediaLibrary.SortBy.creationTime,
          });
          
          // Get detailed info for each asset to check favorite status
          const favoritePhotos = [];
          for (const asset of allAssets.assets) {
            try {
              const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
                             if (assetInfo.isFavorite) {
                favoritePhotos.push(asset);
              }
            } catch (error) {
              console.log('Skipping asset due to error:', error);
            }
          }
          
          // Get URIs for favorite photos
          const favoriteUris = favoritePhotos.map(asset => asset.uri);
          
          setGalleryPhotos(favoriteUris);
          setFavoritePhotos(favoriteUris);
          console.log('📸 Loaded iPhone favorites:', favoriteUris.length);
        } catch (error) {
          console.error('❌ Error loading favorites:', error);
          // Fallback to empty array
          setGalleryPhotos([]);
          setFavoritePhotos([]);
        }
        return;
      }
      
      if (category === 'videos') {
        // Load videos from MediaLibrary
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          console.log('❌ Media library permission not granted');
          return;
        }
        
        const videos = await MediaLibrary.getAssetsAsync({
          mediaType: 'video',
          first: 50,
          sortBy: ['creationTime'],
        });
        
        const videoUris = await Promise.all(
          videos.assets.map(async (asset) => {
            const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
            return assetInfo.localUri;
          })
        );
        
        setGalleryPhotos(videoUris.filter(uri => uri !== null) as string[]);
        setVideoAssets(videoUris.filter(uri => uri !== null) as string[]);
        return;
      }
      
      // For 'recents' and 'all', use the existing loadGalleryPhotos function
      await loadGalleryPhotos(loadMore);
      
    } catch (error) {
      console.error('❌ Error loading gallery photos by category:', error);
    } finally {
      setIsLoadingGallery(false);
    }
  };

  // Get category display name
  const getCategoryDisplayName = (category: 'recents' | 'favorites' | 'videos' | 'all') => {
    switch (category) {
      case 'recents':
        return 'Recents';
      case 'favorites':
        return 'Favorites';
      case 'videos':
        return 'Videos';
      case 'all':
        return 'All Photos';
      default:
        return 'Recents';
    }
  };

  // Handle video selection
  const selectVideoFromGallery = async (videoUri: string) => {
    try {
      // Check if video is already selected
      if (selectedVideos.includes(videoUri)) {
        setSelectedVideos(prev => prev.filter(uri => uri !== videoUri));
        setVideoDurations(prev => {
          const newDurations = { ...prev };
          delete newDurations[videoUri];
          return newDurations;
        });
        return;
      }

      // Check if we already have a video selected (max 1 video per post)
      if (selectedVideos.length >= 1) {
        Alert.alert('Video Limit', 'You can only select one video per post.');
        return;
      }

      // Get video duration
      const assetInfo = await MediaLibrary.getAssetInfoAsync(videoUri);
      const duration = assetInfo.duration || 0;
      
      // Check if video is longer than 1 minute (60 seconds)
      if (duration > 60) {
        Alert.alert(
          'Video Too Long', 
          'Videos must be 1 minute or shorter. Please select a shorter video.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Add video to selection
      setSelectedVideos([videoUri]);
      setVideoDurations(prev => ({ ...prev, [videoUri]: duration }));
      
      // Haptic feedback
      if (Platform.OS === 'ios') {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      console.log('✅ Video selected:', videoUri, 'Duration:', duration);
    } catch (error) {
      console.error('❌ Error selecting video:', error);
      Alert.alert('Error', 'Failed to select video. Please try again.');
    }
  };

  const navigateToPhoto = (direction: 'next' | 'prev') => {
    if (selectedPhotos.length <= 1) return;
    
    if (direction === 'next') {
      setCurrentPhotoIndex(prev => (prev + 1) % selectedPhotos.length);
    } else {
      setCurrentPhotoIndex(prev => prev === 0 ? selectedPhotos.length - 1 : prev - 1);
    }
  };

  const removeCurrentPhoto = () => {
    if (selectedPhotos.length === 0) return;
    
    const newPhotos = selectedPhotos.filter((_, index) => index !== currentPhotoIndex);
    const newPhotosData = selectedPhotosData.filter((_, index) => index !== currentPhotoIndex);
    
    setSelectedPhotos(newPhotos);
    setSelectedPhotosData(newPhotosData);
    
    // Adjust current index if needed
    if (newPhotos.length === 0) {
      setCurrentPhotoIndex(0);
    } else if (currentPhotoIndex >= newPhotos.length) {
      setCurrentPhotoIndex(newPhotos.length - 1);
    }
  };

  const navigatePostPhoto = (postId: string, direction: 'next' | 'prev') => {
    const currentIndex = postPhotoIndices[postId] || 0;
    const post = photoShares.find(share => share.update_id === postId);
    
    if (!post || !post.photos || post.photos.length <= 1) return;
    
    let newIndex: number;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % post.photos.length;
    } else {
      newIndex = currentIndex === 0 ? post.photos.length - 1 : currentIndex - 1;
    }
    
    setPostPhotoIndices(prev => ({
      ...prev,
      [postId]: newIndex
    }));
  };

  // Handle swipe gestures for photo navigation
  const handleSwipeGesture = (postId: string, translationX: number) => {
    const post = photoShares.find(p => p.update_id === postId);
    const photos = post?.photos && post.photos.length > 0 ? post.photos : [post?.photo_url];
    
    if (!photos || photos.length <= 1) return;
    
    const currentIndex = postPhotoIndices[postId] || 0;
    const threshold = 50; // Minimum swipe distance to trigger navigation
    
    if (translationX > threshold && currentIndex > 0) {
      // Swipe right - go to previous photo
      navigatePostPhoto(postId, 'prev');
    } else if (translationX < -threshold && currentIndex < photos.length - 1) {
      // Swipe left - go to next photo
      navigatePostPhoto(postId, 'next');
    }
  };

  // Add haptic feedback for swipe gestures
  const handleSwipeWithFeedback = (postId: string, translationX: number) => {
    const post = photoShares.find(p => p.update_id === postId);
    const photos = post?.photos && post.photos.length > 0 ? post.photos : [post?.photo_url];
    
    if (!photos || photos.length <= 1) return;
    
    // Prevent multiple swipes for the same post
    if (swipeInProgress[postId]) return;
    
    const currentIndex = postPhotoIndices[postId] || 0;
    const threshold = 80; // Lower threshold for easier navigation
    
    if (translationX > threshold && currentIndex > 0) {
      // Set swipe in progress to prevent multiple triggers
      setSwipeInProgress(prev => ({ ...prev, [postId]: true }));
      
      // Haptic feedback for successful swipe
      if (Platform.OS === 'ios') {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      navigatePostPhoto(postId, 'prev');
      
      // Reset swipe in progress after a delay
      setTimeout(() => {
        setSwipeInProgress(prev => ({ ...prev, [postId]: false }));
      }, 500);
    } else if (translationX < -threshold && currentIndex < photos.length - 1) {
      // Set swipe in progress to prevent multiple triggers
      setSwipeInProgress(prev => ({ ...prev, [postId]: true }));
      
      // Haptic feedback for successful swipe
      if (Platform.OS === 'ios') {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      navigatePostPhoto(postId, 'next');
      
      // Reset swipe in progress after a delay
      setTimeout(() => {
        setSwipeInProgress(prev => ({ ...prev, [postId]: false }));
      }, 500);
    }
  };

  const loadCommentsForAllPosts = async (posts: PhotoShare[]) => {
    try {
      console.log('🔍 Loading comments for all posts:', posts.length);
      
      if (posts.length === 0) return;
      
      // Get all post IDs
      const postIds = posts.map(post => post.update_id);
      
      // Load all comments for all posts in a single query
      const { data: commentsData, error } = await supabase
        .from('comments')
        .select(`
          id,
          post_id,
          user_id,
          content,
          created_at
        `)
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

      console.log('📝 All comments load result:', { commentsData, error });

      if (error) {
        console.error('❌ Error loading all comments:', error);
        return;
      }

      // Get unique user IDs from comments
      const userIds = [...new Set(commentsData.map(comment => comment.user_id))];
      
      // Load profiles for all users who commented
      let profilesData: any[] = [];
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);
        
        if (profilesError) {
          console.error('❌ Error loading profiles:', profilesError);
        } else {
          profilesData = profiles || [];
        }
      }

      // Create a map of user profiles for quick lookup
      const profilesMap = profilesData.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as { [key: string]: any });

      // Group comments by post_id
      const commentsByPost: { [postId: string]: Comment[] } = {};
      commentsData.forEach(comment => {
        const postId = comment.post_id;
        if (!commentsByPost[postId]) {
          commentsByPost[postId] = [];
        }
        
        const userProfile = profilesMap[comment.user_id];
        const commentWithUserInfo: Comment = {
          id: comment.id,
          post_id: comment.post_id,
          user_id: comment.user_id,
          user_name: userProfile?.full_name || 'Unknown',
          user_username: userProfile?.username || 'user',
          user_avatar: userProfile?.avatar_url || '',
          content: comment.content,
          created_at: comment.created_at,
        };
        
        commentsByPost[postId].push(commentWithUserInfo);
      });

      // Update local state with comments for each post
      setPhotoShares(prev => prev.map(post => {
        const postComments = commentsByPost[post.update_id] || [];
        return {
          ...post,
          comments: postComments,
          comment_count: postComments.length,
        };
      }));

    } catch (error) {
      console.error('❌ Error loading comments for all posts:', error);
    }
  };

  const loadPhotoShares = async () => {
    if (!user?.id) return;

    try {
      setIsLoadingPhotoShares(true);
      
      console.log('🔍 Loading photo shares for user:', user.id);

      // TEMPORARY: Use direct query instead of complex function to test
      console.log('🧪 Using direct query for testing...');
      
      // First, get all friends
      const { data: friendsData, error: friendsError } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (friendsError) {
        console.error('❌ Error loading friends:', friendsError);
        return;
      }

      // Extract friend IDs
      const friendIds = friendsData.map(f => 
        f.user_id === user.id ? f.friend_id : f.user_id
      );
      
      // Add current user to the list
      const allUserIds = [...friendIds, user.id];
      
      console.log('👥 Found friends:', friendIds.length);
      console.log('👤 Total users to check:', allUserIds.length);

      // Get social updates from friends and self
      const { data: socialUpdatesData, error: socialUpdatesError } = await supabase
        .from('social_updates')
        .select('id, user_id, photo_url, photos, caption, source_type, source_id, created_at, is_public')
        .in('user_id', allUserIds)
        .eq('type', 'photo_share')
        .or(`is_public.eq.true,user_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (socialUpdatesError) {
        console.error('❌ Error loading social updates:', socialUpdatesError);
        return;
      }

      console.log('📸 Social updates loaded:', socialUpdatesData?.length || 0);

      // Get user profiles for all posts
      const userIds = [...new Set(socialUpdatesData.map(post => post.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username')
        .in('id', userIds);

      if (profilesError) {
        console.error('❌ Error loading profiles:', profilesError);
        return;
      }

      // Create a map of user profiles
      const profilesMap = new Map();
      profilesData.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

      // Transform the data to match PhotoShare interface
      const transformedData = (socialUpdatesData || []).map((item: any) => {
        const profile = profilesMap.get(item.user_id);
        
        console.log('🔄 Processing item:', {
          item_id: item.id,
          user_id: item.user_id,
          user_name: profile?.full_name,
          photos: item.photos,
          photo_count: item.photo_count,
          photosType: typeof item.photos,
          photosIsArray: Array.isArray(item.photos),
          raw_item: item
        });
        
        const transformedItem = {
          update_id: item.id,
          user_id: item.user_id,
          user_name: profile?.full_name || 'Unknown User',
          user_avatar: profile?.avatar_url,
          user_username: profile?.username || 'unknown',
          photo_url: item.photo_url,
          photos: item.photos || null,
          photo_count: Array.isArray(item.photos) ? item.photos.length : (item.photo_url ? 1 : 0),
          caption: item.caption || '',
          source_type: item.source_type || 'habit',
          source_title: item.source_type === 'habit' ? 'Habit' : 'Photo Share',
          created_at: item.created_at
        };
        
        console.log('✅ Transformed item:', transformedItem);
        return transformedItem;
      });

      setPhotoShares(transformedData);

      // Load comments for all posts
      await loadCommentsForAllPosts(transformedData);

      // Calculate unread count
      if (lastViewedPhotoShareTime > 0) {
        const unreadCount = transformedData.filter(
          (share: PhotoShare) => new Date(share.created_at).getTime() > lastViewedPhotoShareTime
        ).length;
        setUnreadPhotoShares(unreadCount);
      }

    } catch (error) {
      console.error('❌ Error in loadPhotoShares:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to load feed',
        text2: 'Please try again',
        position: 'bottom',
      });
    } finally {
      setIsLoadingPhotoShares(false);
    }
  };

  const handlePhotoSharesRefresh = () => {
    setIsRefreshingPhotoShares(true);
    loadPhotoShares().finally(() => {
      setIsRefreshingPhotoShares(false);
    });
  };



  const markPhotoSharesAsRead = () => {
    if (photoShares.length > 0) {
      const latestTime = Math.max(...photoShares.map(share => new Date(share.created_at).getTime()));
      setLastViewedPhotoShareTime(latestTime);
      setUnreadPhotoShares(0);
    }
  };

  // Add a simple debug function for users
  const debugUserStatus = async () => {
    if (!user?.id) {
      Toast.show({
        type: 'error',
        text1: 'No user logged in',
        position: 'bottom',
      });
      return;
    }

    try {
      // Check user's profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', user.id)
        .single();

      // Check user's friendships
      const { data: friendshipData, error: friendshipError } = await supabase
        .from('friendships')
        .select('status')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      // Check user's posts
      const { data: postsData, error: postsError } = await supabase
        .from('social_updates')
        .select('id, is_public')
        .eq('user_id', user.id)
        .eq('type', 'photo_share');

      // Test the function
      const { data: functionData, error: functionError } = await supabase.rpc('get_friends_photo_shares_with_privacy', {
        current_user_id: user.id,
        limit_count: 5
      });

      // Build debug message
      let debugMessage = `User: ${user.email}\n\n`;
      
      if (profileError) {
        debugMessage += `❌ Profile: ${profileError.message}\n`;
      } else if (profileData) {
        debugMessage += `✅ Profile: ${profileData.full_name || 'Missing name'}\n`;
      } else {
        debugMessage += `❌ Profile: Not found\n`;
      }

      if (friendshipError) {
        debugMessage += `❌ Friendships: ${friendshipError.message}\n`;
      } else {
        const acceptedFriends = friendshipData?.filter(f => f.status === 'accepted').length || 0;
        const pendingFriends = friendshipData?.filter(f => f.status === 'pending').length || 0;
        debugMessage += `✅ Friendships: ${acceptedFriends} accepted, ${pendingFriends} pending\n`;
      }

      if (postsError) {
        debugMessage += `❌ Posts: ${postsError.message}\n`;
      } else {
        const publicPosts = postsData?.filter(p => p.is_public).length || 0;
        const privatePosts = postsData?.filter(p => !p.is_public).length || 0;
        debugMessage += `✅ Posts: ${publicPosts} public, ${privatePosts} private\n`;
      }

      if (functionError) {
        debugMessage += `❌ Function: ${functionError.message}\n`;
      } else {
        debugMessage += `✅ Function: Can see ${functionData?.length || 0} posts\n`;
      }

      // Show debug info
      Alert.alert('Debug Info', debugMessage, [
        { text: 'OK' },
        { 
          text: 'Copy to Clipboard', 
          onPress: () => {
            // In a real app, you'd copy to clipboard here
            Toast.show({
              type: 'success',
              text1: 'Debug info copied',
              position: 'bottom',
            });
          }
        }
      ]);

    } catch (error) {
      console.error('Debug error:', error);
      Toast.show({
        type: 'error',
        text1: 'Debug failed',
        text2: 'Please try again',
        position: 'bottom',
      });
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Allow multiple selection
        allowsMultipleSelection: true, // Enable multiple selection
        selectionLimit: 5, // Limit to 5 photos
        quality: 0.8,
        base64: true, // Enable base64 for better compatibility
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('📸 Selected images:', result.assets.length);
        
        // Validate and add each selected image
        const validAssets = [];
        for (const asset of result.assets) {
          // Enhanced validation
          if (!asset.uri) {
            console.warn('⚠️ Skipping asset with no URI');
            continue;
          }
          
          if (asset.fileSize !== undefined && asset.fileSize <= 0) {
            console.warn('⚠️ Skipping invalid asset');
            continue;
          }
          
          if (asset.width < 100 || asset.height < 100) {
            console.warn('⚠️ Skipping too small image');
            continue;
          }
          
          validAssets.push(asset);
        }
        
        if (validAssets.length === 0) {
          Alert.alert('Error', 'No valid images selected. Please try again.');
          return;
        }
        
        // Add valid images to selectedPhotos (respecting 5 photo limit)
        const currentCount = selectedPhotos.length;
        const canAddCount = Math.min(validAssets.length, 5 - currentCount);
        
        if (canAddCount === 0) {
          Alert.alert('Limit Reached', 'You can only select up to 5 photos per post.');
          return;
        }
        
        const newPhotos = validAssets.slice(0, canAddCount).map(asset => asset.uri);
        const newPhotosData = validAssets.slice(0, canAddCount).map(asset => ({
          uri: asset.uri,
          base64: asset.base64 || ''
        }));
        
        setSelectedPhotos(prev => [...prev, ...newPhotos]);
        setSelectedPhotosData(prev => [...prev, ...newPhotosData]);
        
        console.log(`✅ Added ${canAddCount} new photos. Total photos: ${currentCount + canAddCount}`);
        
        if (validAssets.length > canAddCount) {
          Alert.alert('Limit Reached', `Only ${canAddCount} photos were added. You can select up to 5 photos per post.`);
        }
      }
    } catch (error) {
      console.error('❌ Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const createPost = async () => {
    if (!user?.id || (selectedPhotos.length === 0 && selectedVideos.length === 0)) return;

    try {
      setIsPosting(true);

      console.log('📸 Starting multi-photo upload implementation...');
      console.log('📱 Selected photos count:', selectedPhotos.length);

      // Test storage bucket access first
      console.log('🧪 Testing storage bucket access...');
      const { data: bucketTest, error: bucketError } = await supabase.storage
        .from('memories')
        .list('', { limit: 1 });
      
      if (bucketError) {
        console.error('❌ Storage bucket access failed:', bucketError);
        throw new Error(`Storage bucket access failed: ${bucketError.message}`);
      }
      
      console.log('✅ Storage bucket access successful');

      // First pass: Collect all photos with their dimensions and base64 data
      const photosWithData = [];
      
      for (let i = 0; i < selectedPhotos.length; i++) {
        const photoUri = selectedPhotos[i];
        console.log(`📸 Processing photo ${i + 1}/${selectedPhotos.length}:`, photoUri);

        // Step 1: Convert photo to base64 and collect dimensions (deferred until upload time for better performance)
        let base64: string;
        let photoWidth: number;
        let photoHeight: number;
        
        try {
          console.log(`🔄 Converting photo ${i + 1} to base64:`, photoUri);
          
          // Extract the asset ID from the photo library URI
          const assetIdMatch = photoUri.match(/ph:\/\/([^\/]+)/);
          if (!assetIdMatch) {
            console.warn(`⚠️ Skipping photo ${i + 1} - invalid photo library URI format`);
            continue;
          }
          
          const assetId = assetIdMatch[1];
          console.log(`🔄 Getting asset data for photo ${i + 1}:`, assetId);
          
          // Get the asset details from MediaLibrary
          const asset = await MediaLibrary.getAssetInfoAsync(assetId);
          if (!asset) {
            console.warn(`⚠️ Skipping photo ${i + 1} - asset not found`);
            continue;
          }
          
          // Store dimensions
          photoWidth = asset.width;
          photoHeight = asset.height;
          
          // Try to read the local file URI
          try {
            console.log(`🔄 Reading local file for photo ${i + 1}:`, asset.uri);
            base64 = await FileSystem.readAsStringAsync(asset.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch (readError) {
            console.warn(`⚠️ Failed to read local file for photo ${i + 1}, trying fetch:`, readError);
            
            // Alternative: Use fetch to get the image data and convert to base64
            try {
              console.log(`🔄 Fetching image data for photo ${i + 1} from asset URI`);
              const response = await fetch(asset.uri);
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              
              // Get the response as an array buffer
              const arrayBuffer = await response.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);
              
              // Convert to base64 using a React Native compatible method
              let binary = '';
              for (let j = 0; j < uint8Array.length; j++) {
                binary += String.fromCharCode(uint8Array[j]);
              }
              base64 = btoa(binary);
              
              console.log(`✅ Successfully converted photo ${i + 1} to base64 via fetch`);
            } catch (fetchError) {
              console.error(`❌ Fetch method failed for photo ${i + 1}:`, fetchError);
              continue;
            }
          }
          
          if (!base64 || base64.length === 0) {
            console.warn(`⚠️ Skipping photo ${i + 1} - no valid base64 data generated`);
            continue;
          }
          
          console.log(`✅ Photo ${i + 1} converted to base64, length:`, base64.length);
        } catch (error) {
          console.error(`❌ Failed to convert photo ${i + 1} to base64:`, error);
          continue;
        }
        
        // Step 2: Store photo data with dimensions for reordering
        photosWithData.push({
          uri: photoUri,
          base64,
          width: photoWidth,
          height: photoHeight,
          aspectRatio: Math.abs(photoWidth - photoHeight) / Math.max(photoWidth, photoHeight), // 0 = square, higher = more rectangular
          originalIndex: i
        });
        
        console.log(`✅ Photo ${i + 1} data collected:`, {
          width: photoWidth,
          height: photoHeight,
          aspectRatio: Math.abs(photoWidth - photoHeight) / Math.max(photoWidth, photoHeight)
        });
      }
      
      // Step 3: Reorder photos to prioritize square images
      photosWithData.sort((a, b) => {
        // Square images (aspectRatio close to 0) get priority
        if (Math.abs(a.aspectRatio - b.aspectRatio) > 0.1) {
          return a.aspectRatio - b.aspectRatio;
        }
        // If aspect ratios are similar, maintain original order
        return a.originalIndex - b.originalIndex;
      });
      
      console.log('🔄 Photos reordered by aspect ratio (square first):', 
        photosWithData.map(p => ({ 
          aspectRatio: p.aspectRatio.toFixed(3), 
          dimensions: `${p.width}x${p.height}` 
        }))
      );
      
      // Step 4: Upload photos in the new order
      const uploadedPhotos = [];
      
      for (let i = 0; i < photosWithData.length; i++) {
        const photoData = photosWithData[i];
        console.log(`📤 Uploading photo ${i + 1}/${photosWithData.length} (reordered):`, {
          originalIndex: photoData.originalIndex,
          dimensions: `${photoData.width}x${photoData.height}`,
          aspectRatio: photoData.aspectRatio.toFixed(3)
        });
        
        // Convert base64 to binary data
        const binaryString = atob(photoData.base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }
        
        // Create a unique filename
        const timestamp = Date.now();
        const photoFileName = `friends-feed-${user.id}-photo-${timestamp}-${i}.jpg`;
        
        console.log(`📁 Uploading to:`, photoFileName);
        
        // Upload the binary data to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('memories')
          .upload(photoFileName, bytes, {
            contentType: 'image/jpeg',
            upsert: false
          });
        
        if (uploadError) {
          console.error(`❌ Upload failed for photo ${i + 1}:`, uploadError);
          continue;
        }
        
        console.log(`✅ Photo ${i + 1} upload successful:`, uploadData);
        
        // Get the public URL
        const { data: urlData } = supabase.storage
          .from('memories')
          .getPublicUrl(photoFileName);
        
        console.log(`🔗 Photo ${i + 1} public URL generated:`, urlData.publicUrl);
        
        // Wait a moment for the file to be fully processed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify the upload by testing the URL
        try {
          console.log(`🧪 Testing photo ${i + 1}...`);
          const response = await fetch(urlData.publicUrl);
          
          if (!response.ok) {
            console.warn(`⚠️ Photo ${i + 1} URL test failed:`, response.status);
            // Try again after a longer delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            const retryResponse = await fetch(urlData.publicUrl);
            if (!retryResponse.ok) {
              console.error(`❌ Photo ${i + 1} retry test also failed:`, retryResponse.status);
              continue;
            }
          } else {
            const blob = await response.blob();
            console.log(`✅ Photo ${i + 1} test successful, size:`, blob.size, 'bytes, type:', blob.type);
            
            if (blob.size === 0) {
              console.warn(`⚠️ Photo ${i + 1} is empty, skipping`);
              continue;
            }
          }
        } catch (testError) {
          console.warn(`⚠️ Photo ${i + 1} test failed:`, testError);
          continue;
        }
        
        uploadedPhotos.push(urlData.publicUrl);
      }
      
      if (uploadedPhotos.length === 0) {
        throw new Error('No photos were successfully uploaded');
      }
      
      console.log(`✅ Successfully uploaded ${uploadedPhotos.length} photos`);
      
      // Additional verification: Test all uploaded photos one more time
      console.log('🔍 Final verification of uploaded photos...');
      const verifiedPhotos = [];
      for (let i = 0; i < uploadedPhotos.length; i++) {
        try {
          const response = await fetch(uploadedPhotos[i]);
          if (response.ok) {
            verifiedPhotos.push(uploadedPhotos[i]);
            console.log(`✅ Photo ${i + 1} verified:`, uploadedPhotos[i]);
          } else {
            console.warn(`⚠️ Photo ${i + 1} failed final verification:`, response.status);
          }
        } catch (error) {
          console.warn(`⚠️ Photo ${i + 1} failed final verification:`, error);
        }
      }
      
      if (verifiedPhotos.length === 0) {
        throw new Error('No photos passed final verification');
      }
      
      console.log(`✅ Final verification complete: ${verifiedPhotos.length}/${uploadedPhotos.length} photos verified`);
      
      // Step 7: Create a single social update with multiple photos
      console.log('📝 Creating single social update with multiple photos...');
      
      const socialUpdate = {
        user_id: user.id,
        type: 'photo_share',
        photo_url: verifiedPhotos[0], // Keep first photo for backward compatibility
        photos: verifiedPhotos, // Store all verified photos in the new photos array
        caption: caption.trim() || null,
        source_type: 'event', // Use 'event' for standalone photos
        source_id: null, // Events don't have a UUID reference
        is_public: true,
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from('social_updates')
        .insert(socialUpdate)
        .select();
      
      if (insertError) {
        console.error('❌ Database insert failed:', insertError);
        throw new Error(`Database insert failed: ${insertError.message}`);
      }
      
      console.log('✅ Social update created with multiple photos:', insertData);
      
      // Reset the form
                      setSelectedPhotos([]);
                setSelectedPhotosData([]);
                setCaption('');
                setShowPostModal(false);
      
      // Refresh the feed
      console.log('🔄 Refreshing feed...');
      await loadPhotoShares();
      console.log('✅ Feed refresh complete');
      
      // Step 10: Show success message
      Toast.show({
        type: 'success',
        text1: 'Daily bit shared successfully!',
        position: 'bottom',
      });
      
      console.log('🎉 Photo upload process completed successfully!');
      
    } catch (error) {
      console.error('❌ Photo upload failed:', error);
      Alert.alert('Error', `Failed to create daily bit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPosting(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  };

  const handleDeletePhotoShare = async (updateId: string) => {
    if (!user?.id) return;

    try {
      setDeletingPhotoId(updateId);
      
      const { error } = await supabase
        .from('social_updates')
        .delete()
        .eq('id', updateId)
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Error deleting photo share:', error);
        Toast.show({
          type: 'error',
          text1: 'Error deleting post',
          text2: 'Please try again',
          position: 'bottom',
        });
        return;
      }

      // Remove from local state
      setPhotoShares(prev => prev.filter(share => share.update_id !== updateId));
      
      Toast.show({
        type: 'success',
        text1: 'Daily bit deleted',
        position: 'bottom',
      });

    } catch (error) {
      console.error('❌ Error in handleDeletePhotoShare:', error);
      Toast.show({
        type: 'error',
        text1: 'Error deleting daily bit',
        position: 'bottom',
      });
    } finally {
      setDeletingPhotoId(null);
    }
  };

  // Comment functions
  const checkCommentsTable = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('id')
        .limit(1);
      
      console.log('🔍 Comments table check:', { data, error });
      return !error;
    } catch (err) {
      console.error('❌ Error checking comments table:', err);
      return false;
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!user?.id || !commentText.trim()) return;

    console.log('🔍 Adding comment:', { postId, userId: user.id, content: commentText.trim() });

    try {
      setIsCommenting(true);
      
      // Insert comment into database
      const { data: commentData, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: commentText.trim(),
        })
        .select('id, post_id, user_id, content, created_at')
        .single();

      console.log('📝 Comment insert result:', { commentData, error });

      if (error) {
        console.error('❌ Error adding comment:', error);
        Toast.show({
          type: 'error',
          text1: 'Error adding comment',
          text2: 'Please try again',
          position: 'bottom',
        });
        return;
      }

      // Get current user's profile information
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('❌ Error fetching user profile:', profileError);
      }

      // Create comment object with user info
      const newComment: Comment = {
        id: commentData.id,
        post_id: postId,
        user_id: user.id,
        user_name: userProfile?.full_name || user.user_metadata?.full_name || 'Unknown',
        user_username: userProfile?.username || user.user_metadata?.username || 'user',
        user_avatar: userProfile?.avatar_url || user.user_metadata?.avatar_url || '',
        content: commentData.content,
        created_at: commentData.created_at,
      };

      // Update local state
      setPhotoShares(prev => prev.map(post => {
        if (post.update_id === postId) {
          return {
            ...post,
            comments: [...(post.comments || []), newComment],
            comment_count: (post.comment_count || 0) + 1,
          };
        }
        return post;
      }));

      // Update the selected post for comments to show the new comment immediately
      if (selectedPostForComments && selectedPostForComments.update_id === postId) {
        setSelectedPostForComments(prev => {
          if (prev) {
            return {
              ...prev,
              comments: [...(prev.comments || []), newComment],
              comment_count: (prev.comment_count || 0) + 1,
            };
          }
          return prev;
        });
      }

      // Clear comment text
      setCommentText('');
      
      Toast.show({
        type: 'success',
        text1: 'Comment added',
        position: 'bottom',
      });

    } catch (error) {
      console.error('❌ Error in handleAddComment:', error);
      Toast.show({
        type: 'error',
        text1: 'Error adding comment',
        position: 'bottom',
      });
    } finally {
      setIsCommenting(false);
    }
  };

  const handleDeleteComment = async (commentId: string, postId: string) => {
    if (!user?.id) return;

    try {
      console.log('🗑️ Deleting comment:', { commentId, postId, userId: user.id });

      // Delete comment from database
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id); // Ensure user can only delete their own comments

      if (error) {
        console.error('❌ Error deleting comment:', error);
        Toast.show({
          type: 'error',
          text1: 'Error deleting comment',
          text2: 'Please try again',
          position: 'bottom',
        });
        return;
      }

      // Update local state - remove comment from photoShares
      setPhotoShares(prev => prev.map(post => {
        if (post.update_id === postId) {
          const updatedComments = (post.comments || []).filter(comment => comment.id !== commentId);
          return {
            ...post,
            comments: updatedComments,
            comment_count: updatedComments.length,
          };
        }
        return post;
      }));

      // Update the selected post for comments
      if (selectedPostForComments && selectedPostForComments.update_id === postId) {
        setSelectedPostForComments(prev => {
          if (prev) {
            const updatedComments = (prev.comments || []).filter(comment => comment.id !== commentId);
            return {
              ...prev,
              comments: updatedComments,
              comment_count: updatedComments.length,
            };
          }
          return prev;
        });
      }

      Toast.show({
        type: 'success',
        text1: 'Comment deleted',
        position: 'bottom',
      });

    } catch (error) {
      console.error('❌ Error in handleDeleteComment:', error);
      Toast.show({
        type: 'error',
        text1: 'Error deleting comment',
        text2: 'Please try again',
        position: 'bottom',
      });
    }
  };

  const loadCommentsForPost = async (postId: string) => {
    console.log('🔍 Loading comments for post:', postId);
    
    try {
      const { data: commentsData, error } = await supabase
        .from('comments')
        .select(`
          id,
          post_id,
          user_id,
          content,
          created_at
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      console.log('📝 Comments load result:', { commentsData, error });

      if (error) {
        console.error('❌ Error loading comments:', error);
        return;
      }

      // Get unique user IDs from comments
      const userIds = [...new Set(commentsData.map(comment => comment.user_id))];
      
      // Load profiles for all users who commented
      let profilesData: any[] = [];
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);
        
        if (profilesError) {
          console.error('❌ Error loading profiles:', profilesError);
        } else {
          profilesData = profiles || [];
        }
      }

      // Create a map of user profiles for quick lookup
      const profilesMap = profilesData.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as { [key: string]: any });

      // Transform comments data with proper user info
      const comments: Comment[] = commentsData.map(comment => {
        const userProfile = profilesMap[comment.user_id];
        return {
          id: comment.id,
          post_id: comment.post_id,
          user_id: comment.user_id,
          user_name: userProfile?.full_name || 'Unknown',
          user_username: userProfile?.username || 'user',
          user_avatar: userProfile?.avatar_url || '',
          content: comment.content,
          created_at: comment.created_at,
        };
      });

      // Update local state
      setPhotoShares(prev => prev.map(post => {
        if (post.update_id === postId) {
          return {
            ...post,
            comments,
            comment_count: comments.length,
          };
        }
        return post;
      }));

    } catch (error) {
      console.error('❌ Error in loadCommentsForPost:', error);
    }
  };

  const openCommentsModal = (post: PhotoShare) => {
    setSelectedPostForComments(post);
    setShowCommentsModal(true);
    setCommentText(''); // Clear comment text when opening modal
    // Load comments if not already loaded
    if (!post.comments) {
      loadCommentsForPost(post.update_id);
    }
  };

  const renderPhotoShareItem = ({ item }: { item: PhotoShare }) => (
    <View style={styles.photoShareCard}>
      {/* User Header */}
      <View style={styles.userHeader}>
        <View style={styles.userInfo}>
          {item.user_avatar ? (
            <Image
              source={{ uri: item.user_avatar }}
              style={styles.userAvatar}
            />
          ) : (
            <View style={styles.userAvatarPlaceholder}>
              <Ionicons name="person" size={16} color="#8E8E93" />
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={styles.userUsername}>{item.user_username}</Text>
            <Text style={styles.timeAgo}>{formatTimeAgo(item.created_at)}</Text>
          </View>
        </View>
        {item.user_id === user?.id && (
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Delete Daily Bit',
                'Are you sure you want to delete this daily bit?',
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
        <Text style={styles.caption}>{item.caption}</Text>
      )}

      {/* Photo(s) */}
      <View style={styles.photoContainer}>

        {(() => {
          // Debug logging
          console.log('🔍 Rendering photo share item:', {
            update_id: item.update_id,
            photo_url: item.photo_url,
            photos: item.photos,
            photo_count: item.photo_count,
            source_type: item.source_type
          });
          
          const currentPhotoIndex = postPhotoIndices[item.update_id] || 0;
          // Ensure photos is always an array and handle both string and array formats
          const photos = (() => {
            if (item.photos && Array.isArray(item.photos) && item.photos.length > 0) {
              return item.photos;
            } else if (item.photo_url && item.photo_url !== '') {
              return [item.photo_url];
            } else {
              return [];
            }
          })();
          const currentPhoto = photos[currentPhotoIndex];
          
          // Safety check - if no current photo, don't render the image
          if (!currentPhoto) {
            console.log('⚠️ No current photo found for item:', item.update_id);
            return null;
          }
          
          console.log('📸 Processed photos data:', {
            currentPhotoIndex,
            photos,
            currentPhoto,
            photosLength: photos.length,
            itemPhotos: item.photos,
            itemPhotoUrl: item.photo_url,
            itemPhotosType: typeof item.photos,
            itemPhotosIsArray: Array.isArray(item.photos)
          });
          
          return (
            <>
              <PanGestureHandler
                onEnded={(event: any) => {
                  const { translationX } = event.nativeEvent;
                  if (Math.abs(translationX) > 80) {
                    handleSwipeWithFeedback(item.update_id, translationX);
                  }
                }}
              >
                <Animated.View style={styles.photoWrapper}>
                  <TouchableOpacity 
                    onPress={() => {
                      setSelectedPhotoForZoom(item);
                      setZoomPhotoIndex(postPhotoIndices[item.update_id] || 0);
                      setShowPhotoZoomModal(true);
                      setIsPhotoZoomed(true);
                    }}
                    activeOpacity={0.9}
                    style={{ flex: 1 }}
                  >
                    <Image
                      source={{ uri: currentPhoto }}
                      style={styles.naturalPhoto}
                      resizeMode="cover"
                      onError={(error) => {
                        console.error('❌ Image loading error for:', currentPhoto, error.nativeEvent.error);
                      }}
                    />
                  </TouchableOpacity>
                </Animated.View>
              </PanGestureHandler>
              

              
              {/* Photo indicators for multiple photos */}
              {photos.length > 1 && (
                <View style={styles.postPhotoIndicators}>
                  {photos.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.postPhotoIndicator,
                        index === currentPhotoIndex && styles.postPhotoIndicatorActive
                      ]}
                    />
                  ))}
                </View>
              )}

              {/* Comment Section - positioned as overlay on photo */}
              <View style={styles.commentOverlay}>
                <TouchableOpacity
                  style={styles.commentButton}
                  onPress={() => openCommentsModal(item)}
                >
                  <Ionicons name="chatbubble-outline" size={14} color="#fff" />
                  <Text style={styles.commentCountOverlay}>
                    {item.comment_count || 0}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          );
        })()}
      </View>
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
            {/* Header */}
              <View style={styles.header}>
          <Text style={styles.headerTitle}>Feed</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              onPress={() => {
                setSelectedPhotos([]);
                setSelectedPhotosData([]);
                setCaption('');
                setShowPostModal(true);
              }}
              style={[
                styles.postButton,
                !canPostToday && styles.postButtonDisabled
              ]}
              disabled={!canPostToday}
            >
                      <Ionicons 
            name="add" 
            size={24} 
            color={canPostToday ? "#00ACC1" : "#8E8E93"} 
          />
          </TouchableOpacity>

        </View>
      </View>

      {/* Content */}
      {isLoadingPhotoShares && photoShares.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ACC1" />
                          <Text style={styles.loadingText}>Loading feed...</Text>
        </View>
      ) : photoShares.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color="#ccc" />
                          <Text style={styles.emptyText}>No posts yet</Text>
          <Text style={styles.emptySubtext}>
            When your friends share photos from their habits, they'll appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={photoShares}
          keyExtractor={(item, index) => `${item.update_id}-${index}`}
          renderItem={renderPhotoShareItem}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshingPhotoShares}
              onRefresh={handlePhotoSharesRefresh}
              tintColor="#00ACC1"
            />
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Photo Zoom Modal */}
      {showPhotoZoomModal && selectedPhotoForZoom && (
        <PhotoZoomViewer
          photoUrl={
            selectedPhotoForZoom.photos && selectedPhotoForZoom.photos.length > 0
              ? selectedPhotoForZoom.photos[zoomPhotoIndex]
              : selectedPhotoForZoom.photo_url
          }
          sourceType={selectedPhotoForZoom.source_type === 'habit' ? 'habit' : 'daily_bit'}
          onClose={() => {
            setShowPhotoZoomModal(false);
            setSelectedPhotoForZoom(null);
            setZoomPhotoIndex(0);
            setIsPhotoZoomed(false);
          }}
        />
      )}

      {/* Post Creation Modal */}
      <Modal
        visible={showPostModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPostModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            {/* Minimal Header */}
            <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => {
                setShowPostModal(false);
                setSelectedPhotos([]);
                setSelectedPhotosData([]);
                setSelectedVideos([]);
                setVideoDurations({});
                setFavoritePhotos([]);
                setCaption('');
              }}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>New Post</Text>
            
            <TouchableOpacity 
              onPress={createPost}
              disabled={isPosting || (selectedPhotos.length === 0 && selectedVideos.length === 0)}
            >
              <Text style={[
                styles.modalShareText,
                (isPosting || (selectedPhotos.length === 0 && selectedVideos.length === 0)) && styles.modalShareTextDisabled
              ]}>
                {isPosting ? 'Sharing...' : 'Share'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <ScrollView 
            ref={galleryScrollViewRef}
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Selected Photos Carousel */}
            {(selectedPhotos.length > 0 || selectedVideos.length > 0) && (
              <View style={styles.selectedPhotosPreview}>
                
                <View style={styles.photoCarousel}>
                  {selectedVideos.length > 0 ? (
                    <View style={styles.videoPreview}>
                      <Image 
                        source={{ uri: selectedVideos[0] }} 
                        style={styles.selectedPhotoMain} 
                      />
                      <View style={styles.videoOverlay}>
                        <Ionicons name="play-circle" size={48} color="#fff" />
                        <Text style={styles.videoDuration}>
                          {Math.round(videoDurations[selectedVideos[0]] || 0)}s
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Image 
                      source={{ uri: selectedPhotos[currentPhotoIndex] }} 
                      style={styles.selectedPhotoMain} 
                    />
                  )}
                  
                  {/* Navigation Arrows - only for multiple photos */}
                  {selectedPhotos.length > 1 && (
                    <>
                      <TouchableOpacity
                        style={[styles.navArrow, styles.navArrowLeft]}
                        onPress={() => navigateToPhoto('prev')}
                      >
                        <Ionicons name="chevron-back" size={24} color="#fff" />
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.navArrow, styles.navArrowRight]}
                        onPress={() => navigateToPhoto('next')}
                      >
                        <Ionicons name="chevron-forward" size={24} color="#fff" />
                      </TouchableOpacity>
                    </>
                  )}
                  
                  {/* Photo Indicators - only for multiple photos */}
                  {selectedPhotos.length > 1 && (
                    <View style={styles.photoIndicators}>
                      {selectedPhotos.map((_, index) => (
                        <View
                          key={index}
                          style={[
                            styles.photoIndicator,
                            index === currentPhotoIndex && styles.photoIndicatorActive
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Caption Input */}
            <View style={styles.captionSection}>
              <TextInput
                style={styles.captionInput}
                placeholder="What's happening today?"
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={500}
                placeholderTextColor="#C7C7CC"
                textAlignVertical="top"
              />

            </View>

            {/* Gallery Section */}
            <View style={styles.gallerySection}>
              <View style={styles.galleryHeader}>
                <Text style={styles.galleryTitle}>Gallery</Text>
                
                {/* Category Menu Dropdown */}
                <TouchableOpacity
                  style={styles.categoryMenuButton}
                  onPress={() => setShowCategoryMenu(!showCategoryMenu)}
                >
                  <Text style={styles.categoryMenuText}>
                    {getCategoryDisplayName(galleryCategory)}
                  </Text>
                  <Ionicons 
                    name={showCategoryMenu ? "chevron-up" : "chevron-down"} 
                    size={16} 
                    color="#fff" 
                  />
                </TouchableOpacity>
              </View>
              
              {/* Category Menu Dropdown */}
              {showCategoryMenu && (
                <View style={styles.categoryMenuDropdown}>
                  <TouchableOpacity
                    style={[
                      styles.categoryMenuItem,
                      galleryCategory === 'recents' && styles.categoryMenuItemActive
                    ]}
                    onPress={() => {
                      setGalleryCategory('recents');
                      loadGalleryPhotosByCategory('recents');
                      setShowCategoryMenu(false);
                    }}
                  >
                    <Text style={[
                      styles.categoryMenuItemText,
                      galleryCategory === 'recents' && styles.categoryMenuItemTextActive
                    ]}>
                      Recents
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.categoryMenuItem,
                      galleryCategory === 'favorites' && styles.categoryMenuItemActive
                    ]}
                    onPress={() => {
                      setGalleryCategory('favorites');
                      loadGalleryPhotosByCategory('favorites');
                      setShowCategoryMenu(false);
                    }}
                  >
                    <Text style={[
                      styles.categoryMenuItemText,
                      galleryCategory === 'favorites' && styles.categoryMenuItemTextActive
                    ]}>
                      Favorites
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.categoryMenuItem,
                      galleryCategory === 'videos' && styles.categoryMenuItemActive
                    ]}
                    onPress={() => {
                      setGalleryCategory('videos');
                      loadGalleryPhotosByCategory('videos');
                      setShowCategoryMenu(false);
                    }}
                  >
                    <Text style={[
                      styles.categoryMenuItemText,
                      galleryCategory === 'videos' && styles.categoryMenuItemTextActive
                    ]}>
                      Videos
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.categoryMenuItem,
                      galleryCategory === 'all' && styles.categoryMenuItemActive
                    ]}
                    onPress={() => {
                      setGalleryCategory('all');
                      loadGalleryPhotosByCategory('all');
                      setShowCategoryMenu(false);
                    }}
                  >
                    <Text style={[
                      styles.categoryMenuItemText,
                      galleryCategory === 'all' && styles.categoryMenuItemTextActive
                    ]}>
                      All Photos
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {isLoadingGallery ? (
                <View style={styles.galleryLoading}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.galleryLoadingText}>Loading your photos...</Text>
                </View>
              ) : (
                <View style={styles.galleryContainer}>
                  <View style={styles.galleryGrid}>
                    {galleryPhotos.map((photoUri, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.galleryPhotoItem,
                          (galleryCategory === 'videos' ? selectedVideos.includes(photoUri) : selectedPhotos.includes(photoUri)) && styles.galleryPhotoSelected
                        ]}
                        onPress={() => {
                          if (galleryCategory === 'videos') {
                            selectVideoFromGallery(photoUri);
                          } else {
                            selectPhotoFromGallery(photoUri);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: photoUri }} style={styles.galleryPhoto} />
                        {(galleryCategory === 'videos' ? selectedVideos.includes(photoUri) : selectedPhotos.includes(photoUri)) && (
                          <View style={styles.galleryPhotoOverlay}>
                            <View style={styles.galleryPhotoCheckmark}>
                              <Ionicons name="checkmark-circle" size={20} color="#fff" />
                            </View>
                            <View style={styles.galleryPhotoNumber}>
                              <Text style={styles.galleryPhotoNumberText}>
                                {galleryCategory === 'videos' ? 1 : selectedPhotos.indexOf(photoUri) + 1}
                              </Text>
                            </View>
                          </View>
                        )}
                        
                        {/* Video indicator for videos */}
                        {galleryCategory === 'videos' && (
                          <View style={styles.videoIndicator}>
                            <Ionicons name="play" size={12} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  {/* Load More Photos Button */}
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={() => loadGalleryPhotos(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="refresh" size={16} color="#007AFF" />
                    <Text style={styles.loadMoreButtonText}>Load More Photos</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Comments Modal */}
      <Modal
        visible={showCommentsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCommentsModal(false);
          setCommentText(''); // Clear comment text when closing modal
          setCommentModalHeight('compact'); // Reset to compact size
        }}
      >
        <View style={styles.commentsModalOverlay}>
          <TouchableOpacity
            style={styles.commentsModalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setShowCommentsModal(false);
              setCommentText(''); // Clear comment text when closing modal
              setCommentModalHeight('compact'); // Reset to compact size
            }}
          />
          <View style={[
            styles.commentsModalContainer,
            commentModalHeight === 'expanded' && styles.commentsModalContainerExpanded
          ]}>
            {/* Handle bar */}
            <TouchableOpacity
              style={styles.commentsModalHandle}
              onPress={() => {
                setCommentModalHeight(commentModalHeight === 'compact' ? 'expanded' : 'compact');
              }}
              activeOpacity={0.7}
            >
              <View style={[
                styles.commentsModalHandleBar,
                commentModalHeight === 'expanded' && styles.commentsModalHandleBarExpanded
              ]} />
            </TouchableOpacity>
            
            {/* Header */}
            <View style={styles.commentsModalHeader}>
              <Text style={styles.commentsModalTitle}>Comments</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCommentsModal(false);
                  setCommentText(''); // Clear comment text when closing modal
                  setCommentModalHeight('compact'); // Reset to compact size
                }}
                style={styles.commentsModalCloseButton}
              >
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            {/* Content */}
            <KeyboardAvoidingView 
              style={styles.commentsModalContent}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
            >
              {/* Scrollable comments area */}
              <ScrollView 
                style={styles.commentsModalScrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.commentsModalScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {selectedPostForComments && (
                  <>
                    {/* Comments list */}
                    <View style={styles.commentsList}>
                      {selectedPostForComments.comments && selectedPostForComments.comments.length > 0 ? (
                        selectedPostForComments.comments.map((comment) => (
                          <View key={comment.id} style={styles.commentModalItem}>
                            {comment.user_avatar ? (
                              <Image
                                source={{ uri: comment.user_avatar }}
                                style={styles.commentModalAvatar}
                              />
                            ) : (
                              <View style={styles.commentModalAvatarPlaceholder}>
                                <Ionicons name="person" size={16} color="#8E8E93" />
                              </View>
                            )}
                            <TouchableOpacity
                              style={styles.commentModalContent}
                              onLongPress={() => {
                                if (comment.user_id === user?.id) {
                                  // Haptic feedback
                                  if (Platform.OS === 'ios') {
                                    const Haptics = require('expo-haptics');
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                  }
                                  
                                  Alert.alert(
                                    'Delete Comment',
                                    'Are you sure you want to delete this comment?',
                                    [
                                      { text: 'Cancel', style: 'cancel' },
                                      { 
                                        text: 'Delete', 
                                        style: 'destructive', 
                                        onPress: () => handleDeleteComment(comment.id, selectedPostForComments.update_id)
                                      }
                                    ]
                                  );
                                }
                              }}
                              activeOpacity={comment.user_id === user?.id ? 0.7 : 1}
                              disabled={comment.user_id !== user?.id}
                            >
                              <Text style={styles.commentModalUsername}>{comment.user_username}</Text>
                              <Text style={styles.commentModalText}>{comment.content}</Text>
                              <Text style={styles.commentModalTime}>{formatTimeAgo(comment.created_at)}</Text>
                            </TouchableOpacity>
                          </View>
                        ))
                      ) : (
                        <View style={styles.noCommentsContainer}>
                          <Text style={styles.noCommentsText}>No comments yet</Text>
                          <Text style={styles.noCommentsSubtext}>Be the first to comment!</Text>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </ScrollView>

              {/* Fixed comment input at bottom */}
              <View style={styles.commentModalInput}>
                <TextInput
                  style={styles.commentModalTextInput}
                  placeholder="Add a comment..."
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline={false}
                  maxLength={200}
                  returnKeyType="send"
                  onSubmitEditing={() => {
                    if (selectedPostForComments && commentText.trim()) {
                      handleAddComment(selectedPostForComments.update_id);
                    }
                  }}
                />
                <TouchableOpacity
                  style={[
                    styles.commentModalSendButton,
                    (!commentText.trim() || isCommenting) && styles.commentModalSendButtonDisabled
                  ]}
                  onPress={() => {
                    if (selectedPostForComments) {
                      handleAddComment(selectedPostForComments.update_id);
                    }
                  }}
                  disabled={!commentText.trim() || isCommenting}
                >
                  {isCommenting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Onest',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postButton: {
    padding: 8,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#1C1C1E',
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'Onest',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Onest',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  photoShareCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    padding: 12,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  userAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userUsername: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
    fontFamily: 'Onest',
  },
  timeAgo: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  caption: {
    fontSize: 14,
    color: '#1C1C1E',
    marginBottom: 8,
    fontFamily: 'Onest',
    lineHeight: 20,
  },
  photoContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  photo: {
    width: '100%',
    borderRadius: 8,
    alignSelf: 'center',
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
    backgroundColor: '#fff',
    borderBottomWidth: 0,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Onest',
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 100,
    flexGrow: 1,
    backgroundColor: '#fff',
  },
  selectedPhotosPreview: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  selectedPhotosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedPhotosTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Onest',
  },
  photoCarousel: {
    position: 'relative',
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f8f9fa',
  },
  selectedPhotoMain: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    position: 'relative',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  videoDuration: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontFamily: 'Onest',
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navArrowLeft: {
    left: 16,
  },
  navArrowRight: {
    right: 16,
  },
  photoIndicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  photoIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  photoIndicatorActive: {
    backgroundColor: '#fff',
  },
  removePhotoButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 20,
  },

  postPhotoIndicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  postPhotoIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  postPhotoIndicatorActive: {
    backgroundColor: '#fff',
  },
  photoSelector: {
    width: 150,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F2F2F7',
    borderStyle: 'dashed',
    backgroundColor: '#FAFAFA',
  },
  gallerySection: {
    marginTop: 0,
    borderTopWidth: 0,
    paddingTop: 0,
    backgroundColor: '#fff',
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  galleryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Onest',
  },
  categoryMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  categoryMenuText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    fontFamily: 'Onest',
  },
  categoryMenuDropdown: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 4,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  categoryMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 120,
  },
  categoryMenuItemActive: {
    backgroundColor: '#F2F2F7',
  },
  categoryMenuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    fontFamily: 'Onest',
  },
  categoryMenuItemTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  gallerySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  galleryContainer: {
    flex: 1,
  },
  galleryHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cameraButton: {
    padding: 8,
  },
  refreshGalleryButton: {
    padding: 8,
  },
  galleryLoading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  galleryLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
    gap: 1, // Thin white spacing like Instagram
  },
  galleryPhotoItem: {
    width: ((Dimensions.get('window').width) - 4) / 5, // 5 columns accounting for gaps
    height: ((Dimensions.get('window').width) - 4) / 5, // Square aspect ratio
    overflow: 'hidden',
    position: 'relative',
  },
  galleryPhotoSelected: {
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  galleryPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  galleryPhotoCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryPhotoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
    justifyContent: 'space-between',
    padding: 8,
  },
  galleryPhotoNumber: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryPhotoNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Onest',
  },
  videoIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadMoreButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadMoreButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
    fontFamily: 'Onest',
    textAlign: 'center',
  },

  selectedPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uniformPhoto: {
    width: '100%',
    aspectRatio: 1, // Always 1:1 square for consistent post dimensions
    borderRadius: 16,
    overflow: 'hidden',
  },
  naturalPhoto: {
    width: '100%',
    aspectRatio: 7/6, // Wider aspect ratio for horizontally longer photos
    borderRadius: 16,
    overflow: 'hidden',
  },

  photoWrapper: {
    position: 'relative',
    width: '100%',
  },
  swipeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 5,
  },
  swipeLeftArea: {
    flex: 1,
    height: '100%',
  },
  swipeRightArea: {
    flex: 1,
    height: '100%',
  },

  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  photoPlaceholderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
    fontFamily: 'Onest',
    fontWeight: '500',
  },
  captionSection: {
    marginTop: 24,
    marginBottom: 0, // Removed gap completely for maximum connection
    paddingHorizontal: 20,
  },
  captionInput: {
    borderRadius: 0,
    padding: 0,
    fontSize: 16,
    fontFamily: 'Onest',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 8,
    backgroundColor: 'transparent',
    color: '#000',
    borderWidth: 0,
  },
  captionFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  characterCount: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  postLimitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
  },
  postLimitText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Onest',
    flex: 1,
  },
  debugText: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: 'Onest',
    marginTop: 10,
    textAlign: 'center',
  },
  modalShareText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    fontFamily: 'Onest',
  },
  modalShareTextDisabled: {
    color: '#8E8E93',
  },

  // Comment styles
  commentSection: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  commentCount: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Onest',
  },
  commentOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentCountOverlay: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'Onest',
    fontWeight: '600',
  },
  sendCommentButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00ACC1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendCommentButtonDisabled: {
    backgroundColor: '#ccc',
  },

  // Comments Modal styles
  commentPostPreview: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  commentPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentPostAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  commentPostAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  commentPostUserInfo: {
    flex: 1,
  },
  commentPostUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Onest',
  },
  commentPostTime: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  commentPostCaption: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Onest',
    marginBottom: 8,
  },
  commentPostImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  commentsList: {
    padding: 16,
  },
  commentModalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  commentModalAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentModalAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  commentModalContent: {
    flex: 1,
  },
  commentModalUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Onest',
    marginBottom: 2,
  },
  commentModalText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Onest',
    marginBottom: 4,
  },
  commentModalTime: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  noCommentsContainer: {
    alignItems: 'center',
    paddingVertical: 20, // Reduced from 40 to 20
  },
  noCommentsText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    fontFamily: 'Onest',
    marginBottom: 4,
  },
  noCommentsSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: 'Onest',
  },
  commentModalInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 12, // Reduced top padding to position lower
    paddingBottom: Platform.OS === 'ios' ? 16 : 16, // Reduced bottom padding to remove white space
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F2F2F7',
    minHeight: 80, // Ensure minimum height for the input area
  },
  commentModalTextInput: {
    flex: 1,
    fontSize: 16, // Slightly larger font for better readability
    color: '#000',
    fontFamily: 'Onest',
    paddingVertical: 12, // More vertical padding
    paddingHorizontal: 16, // More horizontal padding
    backgroundColor: '#F2F2F7',
    borderRadius: 20, // More rounded corners
    marginRight: 12, // More space between input and button
    minHeight: 44, // Minimum touch target size
  },
  commentModalSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00ACC1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentModalSendButtonDisabled: {
    backgroundColor: '#ccc',
  },

  // Bottom Sheet Comments Modal styles
  commentsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  commentsModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  commentsModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%', // Reduced from 95% to 60%
    minHeight: '40%', // Reduced from 70% to 40%
    flex: 1,
  },
  commentsModalContainerExpanded: {
    maxHeight: '90%', // Expanded height
    minHeight: '70%', // Expanded minimum height
  },
  commentsModalHandle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  commentsModalHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
  },
  commentsModalHandleBarExpanded: {
    backgroundColor: '#00ACC1', // Different color when expanded
    width: 50, // Slightly wider when expanded
  },
  commentsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8, // Reduced from 12 to 8
  },
  commentsModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Onest',
  },
  commentsModalCloseButton: {
    padding: 4,
  },
  commentsModalContent: {
    flex: 1,
    justifyContent: 'space-between', // This will push the input to the bottom
  },
  commentsModalInner: {
    flex: 1,
  },
  commentsModalScrollView: {
    flex: 1,
  },
  commentsModalScrollContent: {
    flexGrow: 1,
    paddingBottom: 5, // Reduced from 10 to 5
  },
});
