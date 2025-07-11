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
  const progressAnim = useRef(new Animated.Value(0)).current;
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
    if (progress) {
      // Animate progress bar
      const progressValue = progress.total > 0 ? progress.current / progress.total : 0;
      Animated.timing(progressAnim, {
        toValue: progressValue,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [progress]);

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
        
        {/* App Name */}
        <Text style={styles.appName}>Jaani</Text>
        
        {/* Progress Section */}
        {progress && (
          <View style={styles.progressSection}>
            <Text style={styles.currentTask}>
              {isSimpleLoading ? 'Welcome to Jaani' : progress.currentTask}
            </Text>
            
            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <Animated.View 
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            
            {/* Progress Text */}
            <Text style={styles.progressText}>
              {hasCompleted 
                ? 'Ready!' 
                : isSimpleLoading 
                  ? 'Loading...'
                  : `${progress.current} of ${progress.total} (${progressPercentage}%)`
              }
            </Text>
            
            {/* Completion Message */}
            {hasCompleted && (
              <Text style={styles.completionMessage}>
                {isSimpleLoading ? 'Welcome to Jaani!' : 'Welcome back!'}
              </Text>
            )}
          </View>
        )}
        
        {/* Loading Indicator (only show if no progress) */}
        {!progress && (
          <View style={styles.loadingIndicator}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        )}
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
    fontWeight: '900',
    color: '#0f172a',
    fontFamily: 'Onest-Bold',
    marginBottom: 40,
    textAlign: 'center',
    width: '100%',
    letterSpacing: -1,
  },
  progressSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  currentTask: {
    fontSize: 16,
    color: '#64748b',
    fontFamily: 'Onest-Medium',
    textAlign: 'center',
    marginBottom: 15,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Onest-Regular',
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
  completionMessage: {
    fontSize: 18,
    color: '#3b82f6',
    fontFamily: 'Onest-Bold',
    marginTop: 10,
    textAlign: 'center',
  },
}); 