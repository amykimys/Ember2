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