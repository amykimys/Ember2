import React, { useRef, useState, useEffect } from 'react';
import { Modal, View, Image, TouchableOpacity, Text, Dimensions, FlatList, Animated, Alert, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EventPhotoViewerModalProps {
  visible: boolean;
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
  onDelete: (photoUrl: string) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

const EventPhotoViewerModal: React.FC<EventPhotoViewerModalProps> = ({
  visible,
  photos,
  initialIndex = 0,
  onClose,
  onDelete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, initialIndex]);

  const handleScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (idx !== currentIndex) setCurrentIndex(idx);
  };

  const handleThumbnailPress = (idx: number) => {
    setCurrentIndex(idx);
    flatListRef.current?.scrollToIndex({ index: idx, animated: true });
  };

  const handleDelete = () => {
    if (photos[currentIndex]) {
      Alert.alert(
        'Delete Photo',
        'Are you sure you want to delete this photo?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => onDelete(photos[currentIndex]),
          },
        ]
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>  
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
        {/* Main Photo */}
        <FlatList
          ref={flatListRef}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, idx) => item + idx}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          initialScrollIndex={initialIndex}
          onMomentumScrollEnd={handleScroll}
          renderItem={({ item }) => (
            <View style={styles.photoContainer}>
              <Image
                source={{ uri: item }}
                style={styles.photo}
                resizeMode="contain"
              />
            </View>
          )}
          style={{ flexGrow: 0 }}
        />
        {/* Bottom Thumbnails */}
        {photos.length > 1 && (
          <View style={styles.thumbnailBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {photos.map((uri, idx) => (
                <TouchableOpacity
                  key={uri + idx}
                  onPress={() => handleThumbnailPress(idx)}
                  style={[
                    styles.thumbnailWrapper,
                    currentIndex === idx && styles.thumbnailSelected,
                  ]}
                >
                  <Image source={{ uri }} style={styles.thumbnail} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.97)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 48,
    zIndex: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    borderRadius: 8,
    backgroundColor: '#111',
  },
  thumbnailBar: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  thumbnailWrapper: {
    marginHorizontal: 6,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbnailSelected: {
    borderColor: '#fff',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#222',
  },
});

export default EventPhotoViewerModal; 