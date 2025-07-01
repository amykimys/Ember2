import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Image, RefreshControl, ActivityIndicator, Dimensions } from 'react-native';
import { supabase } from '../../supabase';
import { User } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';

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

export default function FriendsFeedScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [photoShares, setPhotoShares] = useState<PhotoShare[]>([]);
  const [isLoadingPhotoShares, setIsLoadingPhotoShares] = useState(false);
  const [isRefreshingPhotoShares, setIsRefreshingPhotoShares] = useState(false);
  const [unreadPhotoShares, setUnreadPhotoShares] = useState(0);
  const [lastViewedPhotoShareTime, setLastViewedPhotoShareTime] = useState<number>(0);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[Friends Feed] Session check error:', sessionError);
          return;
        }

        if (session?.user) {
          setUser(session.user);
          await loadPhotoShares(true);
        }
      } catch (error) {
        console.error('[Friends Feed] Error in checkSession:', error);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await loadPhotoShares(true);
      } else {
        setUser(null);
        setPhotoShares([]); // Clear photos when user signs out
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Add effect to listen for photo share events
  useEffect(() => {
    let lastPhotoShareCheckTime = 0;
    
    const checkForPhotoShares = () => {
      const globalAny = global as any;
      if (globalAny.lastPhotoShareTime && globalAny.lastPhotoShareTime > lastPhotoShareCheckTime) {
        lastPhotoShareCheckTime = globalAny.lastPhotoShareTime;
        console.log('🔄 Photo share detected, refreshing friends feed...');
        if (user?.id) {
          loadPhotoShares(true);
        }
      }
    };

    // Check every 2 seconds for new photo shares
    const interval = setInterval(checkForPhotoShares, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [user?.id]);

  const loadPhotoShares = async (refresh = false) => {
    if (!user) return;

    try {
      if (refresh) {
        setIsRefreshingPhotoShares(true);
      } else {
        setIsLoadingPhotoShares(true);
      }

      const limit = 50; // Load more photos at once since no server-side pagination

      console.log('🔄 Loading photo shares for user:', user.id);

      const { data, error } = await supabase
        .rpc('get_friends_photo_shares', {
          current_user_id: user.id,
          limit_count: limit
        });

      if (error) {
        console.error('[Friends Feed] Error loading photo shares:', error);
        return;
      }

      if (data) {
        console.log('✅ Photo shares loaded:', data.length, 'items');
        
        // Debug: Log each photo share to check avatar URLs
        data.forEach((share: PhotoShare, index: number) => {
          console.log(`📸 Photo share ${index + 1}:`, {
            user_id: share.user_id,
            user_name: share.user_name,
            user_username: share.user_username,
            user_avatar: share.user_avatar,
            avatar_status: share.user_avatar ? 
              (share.user_avatar.startsWith('http') ? 'VALID_URL' : 'INVALID_FORMAT') : 
              'NULL_OR_EMPTY',
            photo_url: share.photo_url,
            caption: share.caption,
            source_type: share.source_type,
            source_title: share.source_title
          });
        });
        
        setPhotoShares(data);
        
        // Mark as read when viewing
        markPhotoSharesAsRead();
      }
    } catch (error) {
      console.error('[Friends Feed] Error in loadPhotoShares:', error);
    } finally {
      setIsLoadingPhotoShares(false);
      setIsRefreshingPhotoShares(false);
    }
  };

  const handlePhotoSharesRefresh = () => {
    loadPhotoShares(true);
  };

  const markPhotoSharesAsRead = () => {
    setUnreadPhotoShares(0);
    setLastViewedPhotoShareTime(Date.now());
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  const renderPhotoShare = (share: PhotoShare) => (
    <View key={share.update_id} style={{
      backgroundColor: '#fff',
      borderRadius: 16,
      marginBottom: 16,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    }}>
      {/* User Info */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#E9ECEF',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        }}>
          {share.user_avatar ? (
            <Image
              source={{ uri: share.user_avatar }}
              style={{ width: 40, height: 40, borderRadius: 20 }}
              onError={(error) => {
                console.error('❌ Profile avatar loading error:', {
                  user_id: share.user_id,
                  user_username: share.user_username,
                  avatar_url: share.user_avatar,
                  error: error.nativeEvent.error
                });
              }}
              onLoad={() => {
                console.log('✅ Profile avatar loaded successfully:', {
                  user_id: share.user_id,
                  user_username: share.user_username,
                  avatar_url: share.user_avatar
                });
              }}
            />
          ) : (
            <Ionicons name="person" size={20} color="#6C757D" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: '#000',
            fontFamily: 'Onest',
          }}>
            {share.user_username}
          </Text>
          <Text style={{
            fontSize: 12,
            color: '#666',
            fontFamily: 'Onest',
          }}>
            {formatTimeAgo(share.created_at)}
          </Text>
        </View>
      </View>

      {/* Photo */}
      <Image
        source={{ uri: share.photo_url }}
        style={{
          width: '100%',
          height: 200,
          borderRadius: 12,
          marginBottom: 12,
          backgroundColor: '#ffffff', // White background for transparent images
        }}
        resizeMode="contain"
      />

      {/* Caption */}
      {share.caption && (
        <Text style={{
          fontSize: 14,
          color: '#000',
          marginBottom: 8,
          fontFamily: 'Onest',
          lineHeight: 20,
        }}>
          {share.caption}
        </Text>
      )}

      {/* Event Info */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        padding: 8,
        borderRadius: 8,
      }}>
        <Ionicons 
          name={share.source_type === 'event' ? 'calendar' : 'repeat'} 
          size={16} 
          color="#667eea" 
        />
        <Text style={{
          fontSize: 12,
          color: '#666',
          marginLeft: 6,
          fontFamily: 'Onest',
        }}>
          {share.source_title}
        </Text>
      </View>
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="person-outline" size={64} color="#999" />
          <Text style={{ fontSize: 18, color: '#666', marginTop: 16, fontFamily: 'Onest' }}>
            Sign in to view friends feed
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 16,
      }}>
        <Text style={{
          fontSize: 24,
          fontWeight: '700',
          color: '#000',
          fontFamily: 'Onest',
        }}>
            Feed
        </Text>
      </View>

      {/* Photo Shares */}
      <ScrollView
        style={{ flex: 1, padding: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingPhotoShares}
            onRefresh={handlePhotoSharesRefresh}
            colors={['#667eea']}
            tintColor="#667eea"
          />
        }
      >
        {photoShares.length === 0 && !isLoadingPhotoShares ? (
          <View style={{ 
            flex: 1, 
            justifyContent: 'center', 
            alignItems: 'center', 
            paddingVertical: 60 
          }}>
            <Ionicons name="images-outline" size={64} color="#999" />
            <Text style={{ 
              fontSize: 18, 
              color: '#666', 
              marginTop: 16, 
              textAlign: 'center',
              fontFamily: 'Onest'
            }}>
              No photos shared yet
            </Text>
            <Text style={{ 
              fontSize: 14, 
              color: '#999', 
              marginTop: 8, 
              textAlign: 'center',
              fontFamily: 'Onest'
            }}>
              When your friends share photos, they'll appear here
            </Text>
          </View>
        ) : (
          photoShares.map(renderPhotoShare)
        )}

        {isLoadingPhotoShares && photoShares.length > 0 && (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#667eea" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
} 