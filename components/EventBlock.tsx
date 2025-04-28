import React from 'react';
import { Text, View } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, { useAnimatedGestureHandler, useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';

interface EventBlockProps {
    event: {
        id: string;
        title: string;
        startDateTime: Date;
        endDateTime: Date;
        categoryColor?: string;
      };
  onDragEnd: (eventId: string, newOffsetY: number) => void;
  onResizeEnd: (eventId: string, newHeight: number) => void;
}

type ContextType = {
  startY: number;
  startHeight: number;
};

const EventBlock: React.FC<EventBlockProps> = ({ event, onDragEnd, onResizeEnd }) => {
  const eventDurationHours = (event.endDateTime.getTime() - event.startDateTime.getTime()) / (1000 * 60 * 60);
  const startOffsetY = useSharedValue(0);
  const resizeHeight = useSharedValue(55 * eventDurationHours - 4); // 55px per hour minus 4px margin

  // 🛠 Drag to move handler
  const dragHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, ContextType>({
    onStart: (_, ctx) => {
      ctx.startY = startOffsetY.value;
    },
    onActive: (event, ctx) => {
      startOffsetY.value = ctx.startY + event.translationY;
    },
    onEnd: () => {
      const snapped = Math.round(startOffsetY.value / 55) * 55;
      startOffsetY.value = withSpring(snapped);
      runOnJS(onDragEnd)(event.id, snapped);
    },
  });

  // 🛠 Drag to resize handler
  const resizeHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, ContextType>({
    onStart: (_, ctx) => {
      ctx.startHeight = resizeHeight.value;
    },
    onActive: (event, ctx) => {
      resizeHeight.value = Math.max(30, ctx.startHeight + event.translationY); // minimum 30px height
    },
    onEnd: () => {
      const snappedHeight = Math.max(30, Math.round(resizeHeight.value / 55) * 55);
      resizeHeight.value = withSpring(snappedHeight);
      runOnJS(onResizeEnd)(event.id, snappedHeight);
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: startOffsetY.value }],
  }));

  const animatedResizeStyle = useAnimatedStyle(() => ({
    height: resizeHeight.value,
  }));

  return (
    <PanGestureHandler onGestureEvent={dragHandler}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 2,
            right: 2,
            backgroundColor: event.categoryColor || '#BF9264',
            borderRadius: 6,
            padding: 4,
            justifyContent: 'center',
            overflow: 'hidden',
          },
          animatedStyle,
          animatedResizeStyle,
        ]}
      >
        <Text style={{ fontSize: 10, color: 'white', fontWeight: 'bold' }}>{event.title}</Text>

        {/* Resize Handle */}
        <PanGestureHandler onGestureEvent={resizeHandler}>
          <Animated.View style={{
            height: 10,
            backgroundColor: 'rgba(255,255,255,0.6)',
            borderBottomLeftRadius: 6,
            borderBottomRightRadius: 6,
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 4,
          }}>
            <Text style={{ fontSize: 8, color: '#666' }}>≡</Text>
          </Animated.View>
        </PanGestureHandler>

      </Animated.View>
    </PanGestureHandler>
  );
};

export default EventBlock;
