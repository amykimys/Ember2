import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
  Image,
} from 'react-native';

interface PreloadProgress {
  current: number;
  total: number;
  currentTask: string;
}

interface LoadingScreenProps {
  onLoadingComplete?: () => void;
  progress?: PreloadProgress;
}

export default function LoadingScreen({ onLoadingComplete, progress }: LoadingScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [startTime] = useState(Date.now());
  const [hasCompleted, setHasCompleted] = useState(false);

  // Determine if this is a simple loading (unauthenticated user)
  const isSimpleLoading = progress && progress.total === 1;

  useEffect(() => {
    // Simple fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);



  useEffect(() => {
    // Call completion callback when progress is complete
    if (progress && progress.current >= progress.total) {
      const elapsedTime = Date.now() - startTime;
      const minLoadingTime = isSimpleLoading ? 1500 : 3000; // Shorter time for simple loading
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
      
      setTimeout(() => {
        setHasCompleted(true);
        onLoadingComplete?.();
      }, remainingTime);
    }
  }, [progress, onLoadingComplete, startTime, isSimpleLoading]);

  const progressPercentage = progress && progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

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
        {/* Logo */}
        <Image 
          source={require('../assets/images/logo.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  appName: {
    fontSize: 36,
    fontWeight: '400',
    color: '#0f172a',
    fontFamily: 'Onest',
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