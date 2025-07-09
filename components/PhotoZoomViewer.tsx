import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Modal,
  Dimensions,
  TouchableOpacity,
  Text,
  Image,
  Animated,
  PanResponder,
  StatusBar,
} from 'react-native';
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
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  
  const [isZoomed, setIsZoomed] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentScale, setCurrentScale] = useState(1);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hideControls = useCallback(() => {
    setShowControls(false);
  }, []);

  const showControlsWithTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(hideControls, 3000);
  }, [hideControls]);

  const resetZoom = useCallback(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsZoomed(false);
      setCurrentScale(1);
    });
  }, [scale, translateX, translateY]);

  const handleDoubleTap = useCallback(() => {
    if (isZoomed) {
      resetZoom();
    } else {
      Animated.timing(scale, {
        toValue: 2,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIsZoomed(true);
        setCurrentScale(2);
      });
    }
    showControlsWithTimeout();
  }, [isZoomed, resetZoom, scale, showControlsWithTimeout]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
    },
    onPanResponderGrant: () => {
      showControlsWithTimeout();
    },
    onPanResponderMove: (evt, gestureState) => {
      if (isZoomed) {
        // Allow panning when zoomed
        translateX.setValue(gestureState.dx);
        translateY.setValue(gestureState.dy);
      } else {
        // Swipe down to close when not zoomed
        if (gestureState.dy > 50) {
          const progress = Math.min(gestureState.dy / 200, 1);
          opacity.setValue(1 - progress);
          translateY.setValue(gestureState.dy * 0.3);
        }
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (!isZoomed && gestureState.dy > 100) {
        // Close modal if swiped down enough
        onClose();
      } else if (isZoomed) {
        // Reset pan position when zoomed
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        // Reset opacity and position
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
  });

  const handlePinch = useCallback((evt: any) => {
    const { scale: pinchScale } = evt.nativeEvent;
    const newScale = Math.max(0.5, Math.min(3, pinchScale));
    scale.setValue(newScale);
    setCurrentScale(newScale);
    setIsZoomed(newScale > 1);
    showControlsWithTimeout();
  }, [scale, showControlsWithTimeout]);

  const handleModalPress = useCallback(() => {
    showControlsWithTimeout();
  }, [showControlsWithTimeout]);

  React.useEffect(() => {
    if (visible) {
      showControlsWithTimeout();
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [visible, showControlsWithTimeout]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0, 0, 0, 0.9)" />
      
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        {...panResponder.panHandlers}
        onTouchEnd={handleModalPress}
      >
        {/* Top Controls */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingTop: 60,
            paddingBottom: 16,
            zIndex: 10,
            opacity: showControls ? 1 : 0,
          }}
        >
          <TouchableOpacity
            style={{
              width: 32,
              height: 32,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderRadius: 16,
            }}
            onPress={onClose}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
          
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
          }}>
            {userAvatar && (
              <Image
                source={{ uri: userAvatar }}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  marginRight: 8,
                }}
              />
            )}
            <Text style={{
              color: '#fff',
              fontSize: 12,
              fontWeight: '600',
              fontFamily: 'Onest',
            }}>
              @{username || 'user'}
            </Text>
          </View>
          
          <TouchableOpacity
            style={{
              width: 32,
              height: 32,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderRadius: 16,
            }}
            onPress={resetZoom}
          >
            <Ionicons name="expand" size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* Photo Container */}
        <Animated.View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            paddingHorizontal: 20,
            opacity,
            transform: [
              { scale },
              { translateX },
              { translateY },
            ],
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleDoubleTap}
            style={{
              width: screenWidth - 40,
              height: screenHeight * 0.7,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Image
              source={{ uri: photoUrl }}
              style={{
                width: '100%',
                height: '100%',
              }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Bottom Info */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 24,
            paddingBottom: 40,
            zIndex: 10,
            opacity: showControls ? 1 : 0,
          }}
        >
          {caption && (
            <Text style={{
              color: '#fff',
              fontSize: 16,
              fontFamily: 'Onest',
              marginBottom: 8,
              textAlign: 'center',
              textShadowColor: 'rgba(0, 0, 0, 0.8)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}>
              {caption}
            </Text>
          )}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            {sourceType && (
              <View style={[
                {
                  backgroundColor: sourceType === 'habit' ? '#4CAF50' : '#2196F3',
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 12,
                  marginRight: 8,
                }
              ]}>
                <Text style={{
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: '600',
                  fontFamily: 'Onest',
                }}>
                  {sourceType === 'habit' ? 'Habit' : 'Event'}
                </Text>
              </View>
            )}
            {sourceTitle && (
              <Text style={{
                color: '#fff',
                fontSize: 14,
                fontFamily: 'Onest',
                opacity: 0.8,
                textShadowColor: 'rgba(0, 0, 0, 0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }}>
                {sourceTitle}
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Zoom Indicator */}
        <Animated.View
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: [
              { translateX: -25 },
              { translateY: -25 },
            ],
            width: 50,
            height: 50,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: 25,
            opacity: isZoomed ? 1 : 0,
            zIndex: 5,
          }}
        >
                     <Text style={{
             color: '#fff',
             fontSize: 12,
             fontWeight: '600',
             fontFamily: 'Onest',
           }}>
             {Math.round(currentScale * 100)}%
           </Text>
        </Animated.View>
      </View>
    </Modal>
  );
} 