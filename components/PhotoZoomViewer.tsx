import React, { useRef, useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, Text, Image, StyleSheet, Dimensions, StatusBar, PanResponder, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PhotoZoomViewerProps {
  visible: boolean;
  photoUrl: string;
  caption?: string;
  sourceType?: 'habit' | 'event';
  sourceTitle?: string;
  userAvatar?: string;
  username?: string;
  onClose: () => void;
}

export default function PhotoZoomViewer({
  visible,
  photoUrl,
  caption,
  sourceType,
  sourceTitle,
  userAvatar,
  username,
  onClose,
}: PhotoZoomViewerProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [aspectRatio, setAspectRatio] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (photoUrl) {
      // Fetch image dimensions and set aspect ratio
      Image.getSize(
        photoUrl,
        (width, height) => {
          if (width && height) {
            setAspectRatio(width / height);
          }
        },
        () => {
          setAspectRatio(undefined); // fallback if error
        }
      );
    }
  }, [photoUrl]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
    },
    onPanResponderMove: (evt, gestureState) => {
      if (gestureState.dy > 0) {
        translateY.setValue(gestureState.dy);
        opacity.setValue(1 - Math.min(gestureState.dy / 200, 0.7));
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (gestureState.dy > 100) {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: screenHeight,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onClose();
          translateY.setValue(0);
          opacity.setValue(1);
        });
      } else {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
  });

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <StatusBar barStyle="light-content" backgroundColor="rgba(0, 0, 0, 0.9)" />
      <Animated.View
        style={[
          styles.memoryDetailOverlay,
          {
            transform: [{ translateY }],
            opacity,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Full screen background image */}
        <View style={styles.memoryDetailImageContainer}>
              <Image
            source={{ uri: photoUrl }}
            style={[
              styles.memoryDetailImage,
              aspectRatio ? { aspectRatio } : {},
            ]}
            resizeMode="contain"
          />
          </View>
        {/* Top bar with close button */}
        <View style={styles.memoryDetailTopBar}>
          <TouchableOpacity
            style={styles.memoryDetailCloseButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        {/* Bottom info panel */}
        <View style={styles.memoryDetailBottomPanel}>
          <View style={styles.memoryDetailInfo}>
            {sourceType && (
              <View style={[
                styles.memoryDetailTypeBadge,
                { backgroundColor: sourceType === 'habit' ? '#4CAF50' : '#00ACC1' },
              ]}>
                <Text style={styles.memoryDetailTypeText}>
                  {sourceType === 'habit' ? 'Habit' : 'Event'}
                </Text>
              </View>
            )}
            {sourceTitle && (
              <Text style={styles.memoryDetailTitle}>{sourceTitle}</Text>
            )}
            {caption && (
              <Text style={styles.memoryDetailDescription}>{caption}</Text>
            )}
          </View>
          </View>
        </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  memoryDetailTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  memoryDetailDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  memoryDetailImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80, // leave space for top bar
    marginBottom: 120, // leave space for bottom panel
  },
  memoryDetailImage: {
    width: '100%',
    height: undefined, // Let aspect ratio control height
    maxHeight: screenHeight - 200, // leave space for top/bottom bars
    borderRadius: 12,
    alignSelf: 'center',
  },
}); 