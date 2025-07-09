import { supabase } from '../supabase';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';

export interface PhotoShareData {
  photoUrl: string;
  sourceType: 'habit' | 'event';
  sourceId: string;
  sourceTitle: string;
  userId: string;
  caption?: string;
}

export const sharePhotoWithFriends = async (photoData: PhotoShareData) => {
  try {
    // Check if this photo is private for events
    if (photoData.sourceType === 'event') {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('private_photos')
        .eq('id', photoData.sourceId)
        .single();

      if (eventError) {
        console.error('Error checking event privacy:', eventError);
        throw eventError;
      }

      // If the photo is marked as private, don't share it to friends feed
      if (eventData?.private_photos?.includes(photoData.photoUrl)) {
        Toast.show({
          type: 'info',
          text1: 'Private photo not shared',
          text2: 'This photo is private and will not appear in friends feed',
          position: 'bottom',
        });
        return true; // Return success but don't create social update
      }
    }

    // Create social update
    const { error: socialError } = await supabase
      .from('social_updates')
      .insert({
        user_id: photoData.userId,
        type: 'photo_share',
        photo_url: photoData.photoUrl,
        caption: photoData.caption || null,
        source_type: photoData.sourceType,
        source_id: photoData.sourceId,
        is_public: true,
        content: {
          title: photoData.sourceTitle,
          photo_url: photoData.photoUrl
        }
      });

    if (socialError) {
      console.error('Error creating social update:', socialError);
      throw socialError;
    }

    Toast.show({
      type: 'success',
      text1: 'Photo shared with friends!',
      position: 'bottom',
    });

    return true;
  } catch (error) {
    console.error('Error sharing photo:', error);
    Toast.show({
      type: 'error',
      text1: 'Failed to share photo',
      position: 'bottom',
    });
    return false;
  }
};

export const removePhotoFromFriendsFeed = async (
  userId: string,
  sourceType: 'habit' | 'event',
  sourceId: string,
  photoUrl: string
) => {
  try {
    const { error } = await supabase
      .from('social_updates')
      .delete()
      .eq('user_id', userId)
      .eq('type', 'photo_share')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('photo_url', photoUrl);

    if (error) {
      console.error('Error removing photo from friends feed:', error);
      return false;
    }

    console.log('✅ Photo removed from friends feed');
    return true;
  } catch (error) {
    console.error('Error removing photo from friends feed:', error);
    return false;
  }
};

export const promptPhotoSharing = (
  photoData: PhotoShareData,
  onSuccess?: () => void,
  onCancel?: () => void
) => {
  // For now, we'll use a simple alert and ask for caption in a follow-up
  // In a real app, you'd want to create a custom modal with TextInput
  Alert.alert(
    'Share with Friends?',
    'Would you like to share this photo with your friends?',
    [
      {
        text: 'No, thanks',
        style: 'cancel',
        onPress: onCancel
      },
      {
        text: 'Share with Caption',
        onPress: () => {
          // For now, we'll share without a caption
          // In a real implementation, you'd show a modal with TextInput
          sharePhotoWithFriends(photoData).then(success => {
          if (success && onSuccess) {
            onSuccess();
          }
          });
        }
      }
    ]
  );
}; 