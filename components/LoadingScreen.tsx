import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';

interface LoadingScreenProps {
  onLoadingComplete?: () => void;
}

export default function LoadingScreen({ onLoadingComplete }: LoadingScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Simple fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start(() => {
      // Call completion callback after animation
      setTimeout(() => {
        onLoadingComplete?.();
      }, 500);
    });
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        {/* App Name */}
        <Text style={styles.appName}>Jaani</Text>
        
        {/* Simple Loading Indicator */}
        <View style={styles.loadingIndicator}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center', // Center content vertically in the middle of the screen
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  appName: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0f172a',
    fontFamily: 'Onest-Bold',
    marginBottom: 40,
    textAlign: 'center',
    width: '100%',
    letterSpacing: -1,
  },
  loadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3b82f6',
    marginHorizontal: 3,
  },
}); 