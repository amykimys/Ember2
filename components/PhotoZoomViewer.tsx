import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, Image, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PhotoZoomViewerProps {
  photoUrl: string;
  onClose: () => void;
  onOpen?: () => void;
  sourceType?: 'habit' | 'friends_feed' | 'daily_bit';
}

export default function PhotoZoomViewer({
  photoUrl,
  sourceType,
  onClose,
  onOpen,
}: PhotoZoomViewerProps) {
  const [aspectRatio, setAspectRatio] = useState<number>(16/9); // Default aspect ratio

  useEffect(() => {
    // Call onOpen when component mounts
    if (onOpen) {
      onOpen();
    }
    
    // Only fetch image size if needed, with a timeout to prevent hanging
    if (photoUrl) {
      const timeoutId = setTimeout(() => {
        Image.getSize(
          photoUrl,
          (width, height) => {
            if (width && height) {
              setAspectRatio(width / height);
            }
          },
          () => {
            // Keep default aspect ratio if error
            console.log('Failed to get image size, using default');
          }
        );
      }, 100); // Small delay to prioritize UI rendering
      
      return () => clearTimeout(timeoutId);
    }
  }, [photoUrl, onOpen]);

  // Cleanup effect to ensure proper state reset
  useEffect(() => {
    return () => {
      // This will run when component unmounts
      console.log('PhotoZoomViewer unmounting, ensuring proper cleanup');
    };
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <StatusBar barStyle="light-content" backgroundColor="rgba(0, 0, 0, 0.9)" />
      <View style={styles.memoryDetailOverlay}>
        {/* Full screen background image */}
        <View style={styles.memoryDetailImageContainer}>
          <Image
            source={{ uri: photoUrl }}
            style={[
              styles.memoryDetailImage,
              { aspectRatio },
            ]}
            resizeMode="contain"
          />
        </View>
        {/* Top bar with close button */}
        <View style={styles.memoryDetailTopBar}>
          <TouchableOpacity
            style={styles.memoryDetailCloseButton}
            onPress={() => {
              onClose();
            }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
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