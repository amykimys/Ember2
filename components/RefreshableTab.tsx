import React, { useRef, useCallback } from 'react';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { triggerTabRefresh } from '../utils/tabRefreshUtils';

interface RefreshableTabProps extends BottomTabBarButtonProps {
  tabName: string;
}

export function RefreshableTab({ tabName, ...props }: RefreshableTabProps) {
  const handlePress = useCallback((ev: any) => {
    // Check if this is the currently active tab
    const isCurrentlyActive = props.accessibilityState?.selected;
    
    if (isCurrentlyActive) {
      // This is a single tap on the currently active tab - trigger refresh
      console.log(`🔄 Single tap detected on ${tabName} tab - triggering refresh`);
      
      // Trigger haptic feedback
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      // Trigger refresh for this specific tab
      triggerTabRefresh(tabName);
      
      // Prevent the default navigation behavior since we're already on this tab
      return;
    }
    
    // Normal tab press behavior for inactive tabs
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Call the original onPress handler for navigation
    props.onPress?.(ev);
  }, [tabName, props]);

  return (
    <PlatformPressable
      {...props}
      onPress={handlePress}
      onPressIn={(ev) => {
        // Keep the original onPressIn for haptic feedback on press down
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
} 