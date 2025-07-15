import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Keyboard,
  ScrollView,
  Alert,
  Pressable,
  Switch,
  PanResponder,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Animated,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../supabase'; 
import { Swipeable } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import WeeklyCalendarView, { WeeklyCalendarViewRef } from '../../components/WeeklyCalendar'; 
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as FileSystem from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { calendarStyles, CALENDAR_CONSTANTS } from '../../styles/calendar.styles';
import { promptPhotoSharing, PhotoShareData, removePhotoFromFriendsFeed } from '../../utils/photoSharing';
import { fetchSharedEvents as fetchSharedEventsUtil, acceptSharedEvent as acceptSharedEventUtil, declineSharedEvent as declineSharedEventUtil, shareEventWithFriends, createAndShareEvent } from '../../utils/sharing';
import type { SharedEvent } from '../../utils/sharing';
import { Colors } from '../../constants/Colors';
import PhotoCaptionModal from '../../components/PhotoCaptionModal';
import PhotoZoomViewer from '../../components/PhotoZoomViewer';

import { arePushNotificationsEnabled } from '../../utils/notificationUtils';

// Add robust ID generation function that works with TEXT ids
const generateEventId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `event_${timestamp}_${random}`;
};

// New notification system implementation
const initializeNotifications = async (): Promise<boolean> => {
  try {
    console.log('🔔 [Notifications] Initializing notification system...');
    
    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync();
    console.log('🔔 [Notifications] Permission status:', status);
    
    if (status !== 'granted') {
      console.log('🔔 [Notifications] Permission denied');
      return false;
    }
    
    // Set up notification handler for foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    
    console.log('🔔 [Notifications] Notification system initialized successfully');
    return true;
  } catch (error) {
    console.error('🔔 [Notifications] Error initializing notifications:', error);
    return false;
  }
};

const scheduleEventNotification = async (event: CalendarEvent): Promise<void> => {
  try {
    console.log('🔔 [Notifications] Scheduling notification for event:', event.title);
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('🔔 [Notifications] No user logged in, skipping notification');
      return;
    }

    // Check if push notifications are enabled for this user
    const notificationsEnabled = await arePushNotificationsEnabled(user.id);
    if (!notificationsEnabled) {
      console.log('🔔 [Notifications] Push notifications disabled for user, skipping notification');
      return;
    }
    
    if (!event.reminderTime) {
      console.log('🔔 [Notifications] No reminder time set');
      return;
    }
    
    const now = new Date();
    const reminderTime = new Date(event.reminderTime);
    
    // Adjust reminder time to be 10 seconds earlier to account for system delays
    const adjustedReminderTime = new Date(reminderTime.getTime() - 10 * 1000);
    
    console.log('🔔 [Notifications] Current time:', now.toISOString());
    console.log('🔔 [Notifications] Original reminder time:', reminderTime.toISOString());
    console.log('🔔 [Notifications] Adjusted reminder time:', adjustedReminderTime.toISOString());
    
    if (adjustedReminderTime <= now) {
      console.log('🔔 [Notifications] Adjusted reminder time has passed');
      return;
    }
    
    const delayMs = adjustedReminderTime.getTime() - now.getTime();
    const delaySeconds = Math.floor(delayMs / 1000);
    
    console.log('🔔 [Notifications] Scheduling notification in', delaySeconds, 'seconds');
    console.log('🔔 [Notifications] Adjusted reminder time (formatted):', adjustedReminderTime.toLocaleString());
    
    // Cancel any existing notifications for this event
    await cancelEventNotification(event.id);
    
    // Check permissions before scheduling
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('🔔 [Notifications] Permission not granted, requesting...');
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') {
        console.log('🔔 [Notifications] Permission denied');
        return;
      }
    }
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Event Reminder',
        body: `${event.title}${event.startDateTime ? ` - ${event.startDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`,
        sound: 'default',
        data: { eventId: event.id },
      },
      trigger: {
        type: 'date',
        date: adjustedReminderTime,
      } as Notifications.DateTriggerInput,
    });
    
    console.log('🔔 [Notifications] Notification scheduled with ID:', notificationId);
    
    // Verify the notification was scheduled
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const scheduledNotification = scheduledNotifications.find(n => n.identifier === notificationId);
    if (scheduledNotification) {
      console.log('🔔 [Notifications] Notification verified as scheduled:', scheduledNotification);
    } else {
      console.log('🔔 [Notifications] Warning: Notification not found in scheduled list');
    }
    
  } catch (error) {
    console.error('🔔 [Notifications] Error scheduling notification:', error);
  }
};

const cancelEventNotification = async (eventId: string): Promise<void> => {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    for (const notification of scheduledNotifications) {
      if (notification.content.data?.eventId === eventId) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        console.log('🔔 [Notifications] Cancelled notification for event:', eventId);
      }
    }
  } catch (error) {
    console.error('🔔 [Notifications] Error cancelling notification:', error);
  }
};

const testNotification = async (): Promise<void> => {
  try {
    console.log('🔔 [Notifications] ===== STARTING COMPREHENSIVE TEST =====');
    
    // Step 1: Check permissions
    console.log('🔔 [Notifications] Step 1: Checking permissions...');
    const { status: currentStatus } = await Notifications.getPermissionsAsync();
    console.log('🔔 [Notifications] Current permission status:', currentStatus);
    
    if (currentStatus !== 'granted') {
      console.log('🔔 [Notifications] Requesting permissions...');
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      console.log('🔔 [Notifications] New permission status:', newStatus);
      
      if (newStatus !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permission Denied',
          text2: 'Please enable notifications in Settings',
          position: 'bottom',
        });
        return;
      }
    }
    
    // Step 2: Skip setting up notification handler (already done in initializeNotifications)
    console.log('🔔 [Notifications] Step 2: Notification handler already set up');
    
    // Step 3: Cancel only test notifications
    console.log('🔔 [Notifications] Step 3: Cancelling existing test notifications...');
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduledNotifications) {
      if (notification.content.data?.type?.includes('test')) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        console.log('🔔 [Notifications] Cancelled test notification:', notification.identifier);
      }
    }
    
    // Step 4: Test immediate notification
    console.log('🔔 [Notifications] Step 4: Testing immediate notification...');
    const immediateId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'IMMEDIATE TEST',
        body: 'This should appear right now!',
        sound: 'default',
        data: { type: 'immediate_test' },
      },
      trigger: null,
    });
    console.log('🔔 [Notifications] Immediate notification ID:', immediateId);
    
    // Step 5: Test scheduled notification with date trigger
    console.log('🔔 [Notifications] Step 5: Testing scheduled notification with date trigger...');
    const futureTime = new Date(Date.now() + 10 * 1000); // 10 seconds from now
    const scheduledId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SCHEDULED TEST (Date Trigger)',
        body: 'This should appear in 10 seconds using date trigger',
        sound: 'default',
        data: { type: 'scheduled_test' },
      },
      trigger: {
        type: 'date',
        date: futureTime,
      } as Notifications.DateTriggerInput,
    });
    console.log('🔔 [Notifications] Scheduled notification ID:', scheduledId);
    console.log('🔔 [Notifications] Scheduled for:', futureTime.toLocaleString());
    
    // Step 6: Test scheduled notification with timeInterval trigger
    console.log('🔔 [Notifications] Step 6: Testing scheduled notification with timeInterval trigger...');
    const timeIntervalId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SCHEDULED TEST (TimeInterval)',
        body: 'This should appear in 15 seconds using timeInterval trigger',
        sound: 'default',
        data: { type: 'timeinterval_test' },
      },
      trigger: {
        type: 'timeInterval',
        seconds: 15,
        repeats: false,
      } as Notifications.TimeIntervalTriggerInput,
    });
    console.log('🔔 [Notifications] TimeInterval notification ID:', timeIntervalId);
    
    // Step 7: Verify scheduled notifications
    console.log('🔔 [Notifications] Step 7: Verifying scheduled notifications...');
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log('🔔 [Notifications] Total scheduled notifications:', allScheduled.length);
    console.log('🔔 [Notifications] Scheduled notifications:', allScheduled);
    
    // Step 8: Check presented notifications
    console.log('🔔 [Notifications] Step 8: Checking presented notifications...');
    const presented = await Notifications.getPresentedNotificationsAsync();
    console.log('🔔 [Notifications] Presented notifications:', presented.length);
    
    Toast.show({
      type: 'success',
      text1: 'Test Complete',
      text2: `Scheduled: ${allScheduled.length} notifications`,
      position: 'bottom',
    });
    
    console.log('🔔 [Notifications] ===== TEST COMPLETE =====');
    
  } catch (error) {
    console.error('🔔 [Notifications] Test error:', error);
    Toast.show({
      type: 'error',
      text1: 'Test Failed',
      text2: error instanceof Error ? error.message : 'Unknown error',
      position: 'bottom',
    });
  }
};

// Add type definitions for custom times
type CustomTimeData = {
  start: Date;
  end: Date;
  reminder: Date | null;
  repeat: RepeatOption;
  dates: string[];  // Array of dates that use this time
};

type CustomTimes = {
  [key: string]: CustomTimeData;
};

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  date: string;
  startDateTime?: Date;
  endDateTime?: Date;
  categoryName?: string;
  categoryColor?: string;
  reminderTime?: Date | null;
  repeatOption?: 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom';
  repeatEndDate?: Date | null;
  customDates?: string[];
  customTimes?: { [date: string]: { start: Date; end: Date; reminder: Date | null; repeat: RepeatOption } };
  isContinued?: boolean;
  isAllDay?: boolean;
  photos?: string[];
  private_photos?: string[];
  // Add shared event properties
  isShared?: boolean;
  sharedBy?: string;
  sharedByUsername?: string;
  sharedByFullName?: string;
  sharedStatus?: 'pending' | 'accepted' | 'declined';
  sharedWith?: string;
  sharedWithUsername?: string;
  sharedWithFullName?: string;
  sharedWithAvatarUrl?: string | null;
  // Add Google Calendar properties
  googleCalendarId?: string;
  googleEventId?: string;
  isGoogleEvent?: boolean;
  calendarColor?: string;
  sharedByAvatarUrl?: string | null; // Add avatar URL
}

interface WeeklyCalendarViewProps {
  events: { [date: string]: CalendarEvent[] };
  setEvents: React.Dispatch<React.SetStateAction<{ [date: string]: CalendarEvent[] }>>;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}


type RepeatOption = 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom';

// Destructure constants from the imported stylesheet
const {
  SCREEN_WIDTH,
  SIDE_PADDING,
  needsSixRows,
  getCellHeight,
} = CALENDAR_CONSTANTS;

const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const generateMonthKey = (year: number, month: number) => `${year}-${month}`;

// Use imported styles
const styles = calendarStyles;

// Add this array of predefined colors near the top of the file, after the imports
const CATEGORY_COLORS = [
  // Cyan/Turquoise Colors (Primary)
  '#00BCD4', // Bright Cyan
  '#4ECDC4', // Turquoise
  '#45B7D1', // Ocean Blue
  '#00ACC1', // Darker Cyan
  '#26C6DA', // Light Cyan
  '#80DEEA', // Very Light Cyan
  '#B2EBF2', // Pale Cyan
  '#E0F7FA', // Very Pale Cyan
  '#0097A7', // Dark Cyan
  '#006064', // Very Dark Cyan
  
  // Complementary Colors
  '#FF6B6B', // Coral Red
  '#96CEB4', // Mint Green
  '#FFEEAD', // Cream
  '#D4A5A5', // Dusty Rose
  '#2ECC71', // Emerald
  '#F1C40F', // Yellow
  
  // Pastel Colors
  '#FADADD', // Pink
  '#FF9A8B', // Coral
  '#A0C3B2', // Sage
  '#BF9264', // Tan
  '#FFB6C1', // Light Pink
  '#98FB98', // Pale Green
  '#87CEEB', // Sky Blue
  '#DDA0DD', // Plum
  '#F0E68C', // Khaki
  '#E6E6FA', // Lavender
  
  // Muted Colors
  '#95A5A6', // Gray
  '#7F8C8D', // Dark Gray
  '#34495E', // Navy
  '#16A085', // Teal
  '#D35400', // Orange
  '#C0392B', // Red
  '#27AE60', // Green
  '#F39C12', // Amber
];

// 1. Add reminder options and state
const REMINDER_OPTIONS = [
  { label: 'No reminder', value: -1 },
  { label: 'At time of event', value: 0 },
  { label: '5 minutes before', value: 5 },
  { label: '10 minutes before', value: 10 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '2 hours before', value: 120 },
  { label: '3 hours before', value: 180 },
  { label: '6 hours before', value: 360 },
  { label: '1 day before', value: 1440 },
];

const CalendarScreen: React.FC = () => {
  const today = new Date();
  // Calculate the index of the current month in the 60-month array (5 years starting from Jan of previous year to Dec 2028)
  const currentYearForIndex = today.getFullYear();
  const currentMonthForIndex = today.getMonth();
  const startYearForIndex = currentYearForIndex - 1;
  const currentMonthIndexInArray = (currentYearForIndex - startYearForIndex) * 12 + currentMonthForIndex;
  
  const [currentMonthIndex, setCurrentMonthIndex] = useState(currentMonthIndexInArray);
  const flatListRef = useRef<FlatList>(null);
  const weeklyCalendarRef = useRef<WeeklyCalendarViewRef>(null);

  // Add ref for the event title input
  const eventTitleInputRef = useRef<TextInput>(null);

  // Add ref for friends search input in event modal
  const eventFriendsSearchInputRef = useRef<TextInput>(null);

  // Add nextTimeBoxId state
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const result = `${year}-${month}-${day}`;
    console.log('🔍 [Calendar] getLocalDateString called with:', {
      inputDate: date.toISOString(),
      year,
      month,
      day,
      result
    });
    return result;
  };

  // Add resetToggleStates function here, before any other functions that use it
  const resetToggleStates = () => {
    setShowStartPicker(false);
    setShowEndPicker(false);
    setShowReminderPicker(false);
    setShowRepeatPicker(false);
    setShowEndDatePicker(false);
    setShowCategoryPicker(false);
    setShowAddCategoryForm(false);
    setShowCustomTimeModal(false);
    setShowCustomTimeStartPicker(false);
    setShowCustomTimeEndPicker(false);
    setShowCustomTimeReminderPicker(false);
    setShowCustomTimeRepeatPicker(false);
    setShowCustomTimeInline(false);
  };

  // Helper function to get original multi-day event dates
  const getOriginalMultiDayDates = (event: CalendarEvent): { startDate: Date; endDate: Date } | null => {
    // Check if this is a multi-day event instance (ID contains date suffix)
    const eventParts = event.id.split('_');
    const eventIsMultiDayInstance = eventParts.length >= 2 && !!eventParts[eventParts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/);    
    if (eventIsMultiDayInstance) {
      // This is a multi-day event instance, extract the base event ID
      const baseEventId = eventParts.slice(0, -1).join('_');
      
      // Find the original event in the events state
      for (const dateKey in events) {
        const dayEvents = events[dateKey];
        for (const dayEvent of dayEvents) {
          // Check if this is the original event (not an instance)
          if (dayEvent.id === baseEventId && !dayEvent.id.match(/_\d{4}-\d{2}-\d{2}$/)) {
            if (dayEvent.startDateTime && dayEvent.endDateTime) {
              return {
                startDate: new Date(dayEvent.startDateTime),
                endDate: new Date(dayEvent.endDateTime)
              };
            }
          }
        }
      }
      
      // If not found in events, check originalEvents
      if (originalEvents[baseEventId]) {
        const orig = originalEvents[baseEventId];
        if (orig.startDateTime && orig.endDateTime) {
          return { startDate: new Date(orig.startDateTime), endDate: new Date(orig.endDateTime) };
        }
      }
    }
    
    return null;
  };

  // Helper function to properly handle date conversion for all-day events
  const getLocalDateForEdit = (date: Date | undefined, isAllDay: boolean = false): Date | undefined => {
    if (!date) return undefined;
    
    if (isAllDay) {
      // For all-day events, create a local date from the UTC date
      // All-day events are stored as 12pm UTC, so we extract the date components
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      return new Date(year, month, day);
    } else {
      // For non-all-day events, use the date as is
      return new Date(date);
    }
  };

  // Helper function to reset just the all-day toggle for new events
  const resetAllDayToggle = () => {
    setIsAllDay(false);
  };

  const [selectedDate, setSelectedDate] = useState(today);
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<{ [date: string]: CalendarEvent[] }>({});
  const [showModal, setShowModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState<string | null>(null); // Changed from '#FADADD' to null
  const [categories, setCategories] = useState<{ id: string; name: string; color: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string; color: string } | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false); // When you tap folder
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false); // When you tap plus
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [repeatOption, setRepeatOption] = useState<RepeatOption>('None');
  const [repeatEndDate, setRepeatEndDate] = useState<Date | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showInlineEndDatePicker, setShowInlineEndDatePicker] = useState(false);
  const [startDateTime, setStartDateTime] = useState<Date>(new Date());
  const [endDateTime, setEndDateTime] = useState<Date>(new Date(new Date().getTime() + 60 * 60 * 1000)); // 1 hour later
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<{
    event: CalendarEvent;
    dateKey: string;
    index: number;
  } | null>(null);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [userChangedEndTime, setUserChangedEndTime] = useState(false);
  const [showCustomDatesPicker, setShowCustomDatesPicker] = useState(false);
  const [customSelectedDates, setCustomSelectedDates] = useState<string[]>([]);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [customDateTimes, setCustomDateTimes] = useState<CustomTimes>({
    default: {
      start: startDateTime,
      end: endDateTime,
      reminder: reminderTime,
      repeat: 'None',
      dates: [getLocalDateString(startDateTime)] // Initialize with the current date
    }
  });
  const [editedEventTitle, setEditedEventTitle] = useState('');
  const [editedEventDescription, setEditedEventDescription] = useState('');
  const [editedEventLocation, setEditedEventLocation] = useState('');
  const [editedStartDateTime, setEditedStartDateTime] = useState(new Date());
  const [editedEndDateTime, setEditedEndDateTime] = useState(new Date());
  const [editedSelectedCategory, setEditedSelectedCategory] = useState<{ name: string; color: string; id?: string } | null>(null);
  const [editedReminderTime, setEditedReminderTime] = useState<Date | null>(null);
  const [editedRepeatOption, setEditedRepeatOption] = useState<'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom'>('None');
  const [editedRepeatEndDate, setEditedRepeatEndDate] = useState<Date | null>(null);
  const [showEditInlineEndDatePicker, setShowEditInlineEndDatePicker] = useState(false);


  const [calendarMode, setCalendarMode] = useState<'month' | 'week'>('month');
  const [isMonthCompact, setIsMonthCompact] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
const [showCustomTimePicker, setShowCustomTimePicker] = useState(false);
const [editingTimeBoxId, setEditingTimeBoxId] = useState<string | null>(null);
const [editingField, setEditingField] = useState<'start' | 'end'>('start');
const [customTimePickerTimeout, setCustomTimePickerTimeout] = useState<NodeJS.Timeout | null>(null);


  // Add new state variables near the other state declarations
  const [showCustomTimeModal, setShowCustomTimeModal] = useState(false);
  const [showCustomTimeStartPicker, setShowCustomTimeStartPicker] = useState(false);
  const [showCustomTimeEndPicker, setShowCustomTimeEndPicker] = useState(false);
  const [showCustomTimeReminderPicker, setShowCustomTimeReminderPicker] = useState(false);
  const [showCustomTimeRepeatPicker, setShowCustomTimeRepeatPicker] = useState(false);
  const [showCustomTimeInline, setShowCustomTimeInline] = useState(false);
  const [selectedDateForCustomTime, setSelectedDateForCustomTime] = useState<Date | null>(null);
  const [customStartTime, setCustomStartTime] = useState<Date>(new Date());
  const [customEndTime, setCustomEndTime] = useState<Date>(new Date(new Date().getTime() + 60 * 60 * 1000));
const [customModalTitle, setCustomModalTitle] = useState('');
const [customModalDescription, setCustomModalDescription] = useState('');


  const [visibleWeekMonth, setVisibleWeekMonth] = useState<Date>(new Date());
  const [visibleWeekMonthText, setVisibleWeekMonthText] = useState('');

  const [isAllDay, setIsAllDay] = useState(false);
  
  // Add debugging for isAllDay changes
  useEffect(() => {
    console.log('🔍 [Calendar] isAllDay state changed to:', isAllDay);
  }, [isAllDay]);
  // Add state for editedIsAllDay for the edit modal
  const [isEditedAllDay, setIsEditedAllDay] = useState(false);
  
  // Photo-related state variables
  const [eventPhotos, setEventPhotos] = useState<string[]>([]);
  const [editedEventPhotos, setEditedEventPhotos] = useState<string[]>([]);
  const [photoPrivacyMap, setPhotoPrivacyMap] = useState<{ [photoUrl: string]: boolean }>({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [selectedPhotoForViewing, setSelectedPhotoForViewing] = useState<{ event: CalendarEvent; photoUrl: string } | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  // New Instagram-like photo zoom state
  const [showPhotoZoomModal, setShowPhotoZoomModal] = useState(false);
  const [selectedPhotoForZoom, setSelectedPhotoForZoom] = useState<{ photoUrl: string; eventTitle: string } | null>(null);
  
  // Custom photo attachment modal state
  const [showCustomPhotoModal, setShowCustomPhotoModal] = useState(false);
  const [selectedEventForPhoto, setSelectedEventForPhoto] = useState<string | undefined>(undefined);
  const [isPhotoPrivate, setIsPhotoPrivate] = useState(false);
  
  // Photo caption modal state
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [photoForCaption, setPhotoForCaption] = useState<{ url: string; eventId: string; eventTitle: string } | null>(null);
  const [isSharingPhoto, setIsSharingPhoto] = useState(false);
  
  // Add ref for photo viewer FlatList
  const photoViewerFlatListRef = useRef<FlatList>(null);
  
  // Add ref for event modal ScrollView
  const eventModalScrollViewRef = useRef<ScrollView>(null);
  
  // Add ref for edit event modal ScrollView
  const editEventModalScrollViewRef = useRef<ScrollView>(null);
  
  // Add ref for Swipeable components
  const swipeableRefs = useRef<{ [key: string]: any }>({});
  
  const autoCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Friends-related state variables
  const [friends, setFriends] = useState<Array<{
    friendship_id: string;
    friend_id: string;
    friend_name: string;
    friend_avatar: string;
    friend_username: string;
    status: string;
    created_at: string;
    communicationCount?: number; // Track communication frequency
  }>>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [searchFriend, setSearchFriend] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  // Add loading state for calendar data
  const [isLoadingCalendarData, setIsLoadingCalendarData] = useState(false);

  // Edit modal friends state variables
  const [editSelectedFriends, setEditSelectedFriends] = useState<string[]>([]);
  const [editSearchFriend, setEditSearchFriend] = useState('');
  const [editIsSearchFocused, setEditIsSearchFocused] = useState(false);

  // Shared events state variables
  const [pendingSharedEvents, setPendingSharedEvents] = useState<CalendarEvent[]>([]);
  const [sentSharedEvents, setSentSharedEvents] = useState<CalendarEvent[]>([]);
  const [receivedSharedEvents, setReceivedSharedEvents] = useState<CalendarEvent[]>([]);
  const [showSharedEventsModal, setShowSharedEventsModal] = useState(false);
  const [activeSharedEventsTab, setActiveSharedEventsTab] = useState<'sent' | 'received'>('received');

  // Animation state
  const swipeAnimation = useRef(new Animated.Value(0)).current;
  const [currentEditingField, setCurrentEditingField] = useState<'start' | 'end'>('start');
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);

  const [originalEvents, setOriginalEvents] = useState<{ [id: string]: CalendarEvent }>({});
  
  // Shared event details modal state
  const [showSharedEventDetailsView, setShowSharedEventDetailsView] = useState(false);
  const [selectedSharedEvent, setSelectedSharedEvent] = useState<CalendarEvent | null>(null);
  const [sharedEventFriends, setSharedEventFriends] = useState<Array<{
    friendship_id: string;
    friend_id: string;
    friend_name: string;
    friend_avatar: string;
    friend_username: string;
    status: string;
    created_at: string;
  }>>([]);



  // Add PanResponder for photo viewer modal
  const photoViewerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Respond to any vertical movement
        return Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: () => {
        // Optional: Add visual feedback when gesture starts
      },
      onPanResponderMove: (_, gestureState) => {
        // Optional: Add visual feedback during gesture
      },
      onPanResponderRelease: (_, gestureState) => {
        // Close modal on any downward swipe
        if (gestureState.dy > 10) {
          setShowPhotoViewer(false);
        }
      },
    })
  ).current;

  // Add these refs for debouncing
  const startPickerTimeoutRef = useRef<NodeJS.Timeout>();
  const endPickerTimeoutRef = useRef<NodeJS.Timeout>();
  const reminderPickerTimeoutRef = useRef<NodeJS.Timeout>();
  const repeatPickerTimeoutRef = useRef<NodeJS.Timeout>();
  const endDatePickerTimeoutRef = useRef<NodeJS.Timeout>();

  const customTimeReminderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add timeout refs for debouncing picker closes
  const timeoutRefs = {
    start: useRef<NodeJS.Timeout>(),
    end: useRef<NodeJS.Timeout>(),
    reminder: useRef<NodeJS.Timeout>(),
    repeat: useRef<NodeJS.Timeout>(),
    endDate: useRef<NodeJS.Timeout>(),
  };

  // Add debounce function
  const debouncePickerClose = (pickerType: 'start' | 'end' | 'reminder' | 'repeat' | 'endDate') => {
    // Clear any existing timeout
    if (timeoutRefs[pickerType].current) {
      clearTimeout(timeoutRefs[pickerType].current);
    }

    // Set new timeout
    timeoutRefs[pickerType].current = setTimeout(() => {
      switch (pickerType) {
        case 'start':
          setShowStartPicker(false);
          break;
        case 'end':
          setShowEndPicker(false);
          break;
        case 'reminder':
          setShowReminderPicker(false);
          break;
        case 'repeat':
          setShowRepeatPicker(false);
          break;
        case 'endDate':
          setShowEndDatePicker(false);
          break;
      }
    }, 60000); // 2 minute delay
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (customTimeReminderTimeoutRef.current) clearTimeout(customTimeReminderTimeoutRef.current);
      if (startPickerTimeoutRef.current) clearTimeout(startPickerTimeoutRef.current);
      if (endPickerTimeoutRef.current) clearTimeout(endPickerTimeoutRef.current);
      if (reminderPickerTimeoutRef.current) clearTimeout(reminderPickerTimeoutRef.current);
      if (repeatPickerTimeoutRef.current) clearTimeout(repeatPickerTimeoutRef.current);
      if (endDatePickerTimeoutRef.current) clearTimeout(endDatePickerTimeoutRef.current);
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    };
  }, []);
  
  useEffect(() => {
    return () => {
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
      }
    };
  }, []);


  useEffect(() => {
    const fetchUser = async () => {
      try {
      const { data, error } = await supabase.auth.getUser();
      
      if (error) {
          return;
        }
        
        if (data?.user) {
        setUser(data.user);
        
          // Test database connection
          
          // Test events table connection
          const { data: eventsTest, error: eventsError } = await supabase
            .from('events')
            .select('count')
            .limit(1);
          
          if (eventsError) {
          }

          // Request notification permissions
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;
          
          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          
          if (finalStatus !== 'granted') {
            console.log('Notification permissions not granted');
            return;
          }
          
          console.log('Notification permissions granted');
        }
      } catch (error) {
      }
    };
  
    fetchUser();
  }, []);

  // Add auth state change listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        // Add a small delay to ensure user state is set, then fetch events
        setTimeout(() => {
          fetchEvents();
        }, 100);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setEvents({});
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
  

  // Add a function to fetch shared events
  const fetchSharedEvents = async (userId: string) => {
    try {
      console.log('🔍 [Calendar] Fetching shared events for user:', userId);
      
      // Fetch shared events where current user is either the sender or recipient
      const { data: sharedEventsData, error } = await supabase
        .from('shared_events')
        .select(`
          id,
          original_event_id,
          shared_by,
          shared_with,
          status,
          created_at
        `)
        .or(`shared_with.eq.${userId},shared_by.eq.${userId}`)
        .in('status', ['pending', 'accepted']); // Include both pending and accepted events

      if (error) {
        console.error('🔍 [Calendar] Error fetching shared events:', error);
        console.error('🔍 [Calendar] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return [];
      }


      if (!sharedEventsData || sharedEventsData.length === 0) {
        console.log('🔍 [Calendar] No shared events found');
        return [];
      }

      // Extract the original event IDs
      const originalEventIds = sharedEventsData.map((se: any) => se.original_event_id);

      // Fetch the actual events using the original event IDs
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          title,
          description,
          location,
          date,
          start_datetime,
          end_datetime,
          category_name,
          category_color,
          is_all_day,
          photos
        `)
        .in('id', originalEventIds);

      if (eventsError) {
        console.error('🔍 [Calendar] Error fetching events:', eventsError);
        return [];
      }
      // Create a map of event ID to event data
      const eventsMap = new Map();
      if (eventsData) {
        eventsData.forEach((event: any) => {
          eventsMap.set(event.id, event);
        });
      }

      // Get unique user IDs involved in shared events (both senders and recipients)
      const allUserIds = new Set<string>();
      sharedEventsData.forEach((se: any) => {
        allUserIds.add(se.shared_by);
        allUserIds.add(se.shared_with);
      });
      
      // Debug: Check what user IDs we're collecting
      if (__DEV__) {
        console.log('🔍 [Calendar] User IDs to fetch profiles for:', Array.from(allUserIds));
      }
      // Fetch profiles for all users involved
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', Array.from(allUserIds));

      if (profilesError) {
        console.error('🔍 [Calendar] Error fetching profiles:', profilesError);
      } else if (__DEV__) {
        console.log('🔍 [Calendar] Fetched profiles:', profilesData?.map(p => ({
        id: p.id,
        username: p.username,
        full_name: p.full_name,
          avatar_url: p.avatar_url ? 'Yes' : 'No',
          avatar_url_value: p.avatar_url
      })));
      }

      // Create a map of user ID to profile data
      const profilesMap = new Map();
      if (profilesData) {
        profilesData.forEach((profile: any) => {
          profilesMap.set(profile.id, profile);
        });
      }
      
      // Debug: Check if current user's profile exists
      const currentUserProfile = profilesMap.get(userId);
      console.log('🔍 [Calendar] Current user profile:', {
        userId,
        profileFound: !!currentUserProfile,
        profileData: currentUserProfile
      });

      // Transform shared events into CalendarEvent format
      const transformedSharedEvents = sharedEventsData
        .filter((sharedEvent: any) => {
          // Check if the original event exists
          const originalEvent = eventsMap.get(sharedEvent.original_event_id);
          if (!originalEvent) {
            return false;
          }
          return true;
        })
        .map((sharedEvent: any) => {
          const event = eventsMap.get(sharedEvent.original_event_id);
          
          // Determine if current user is the sender or recipient
          // Always show the sender's profile for shared events
          const profileToShowId = sharedEvent.shared_by;
          const profileToShow = profilesMap.get(profileToShowId);
          
          // Debug: Check profile lookup
          if (__DEV__) {
            console.log('🔍 [Calendar] Profile lookup for shared event:', {
            sharedEventId: sharedEvent.id,
              profileToShowId,
              profileFound: !!profileToShow,
              profileAvatar: profileToShow?.avatar_url ? 'Yes' : 'No',
              profileAvatarValue: profileToShow?.avatar_url,
              profilesMapSize: profilesMap.size,
              allProfileIds: Array.from(profilesMap.keys()),
              profileToShowData: profileToShow
            });
          }
          
          // Parse dates with better error handling
          const parseDate = (dateStr: string | null) => {
            if (!dateStr) return null;
            try {
              const date = new Date(dateStr);
              if (isNaN(date.getTime())) {
                return null;
              }
              return date;
            } catch (error) {
              return null;
            }
          };

          // Handle all-day events differently to avoid timezone issues
          let startDateTime, endDateTime;
          
          // First, try to parse the start and end times
          const parsedStart = event.start_datetime ? parseDate(event.start_datetime) : null;
          const parsedEnd = event.end_datetime ? parseDate(event.end_datetime) : null;
          
          // Use the database is_all_day flag directly
          let isAllDay = !!event.is_all_day;
          
          if (isAllDay) {
            // For all-day events, preserve the dates for multi-day detection
            // but don't set specific times to avoid timezone issues
            if (event.start_datetime && event.end_datetime) {
              const parsedStart = parseDate(event.start_datetime);
              const parsedEnd = parseDate(event.end_datetime);
              if (parsedStart && parsedEnd) {
                // Set to start of day for both start and end to preserve date info
                startDateTime = new Date(parsedStart);
                startDateTime.setHours(0, 0, 0, 0);
                endDateTime = new Date(parsedEnd);
                endDateTime.setHours(0, 0, 0, 0);
              } else {
                // Fallback: create dates from the date string
            const [year, month, day] = event.date.split('-').map(Number);
                startDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
                endDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
              }
            } else {
              // Fallback: create dates from the date string
              const [year, month, day] = event.date.split('-').map(Number);
              startDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
              endDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
            }
          } else {
            // For regular events, use the parsed datetime values
            startDateTime = parsedStart || undefined;
            endDateTime = parsedEnd || undefined;
            
            // If we have a start time but no end time, create a default end time (1 hour later)
            if (startDateTime && !endDateTime) {
              endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour later
            }
          }

          const transformedEvent = {
            id: `shared_${sharedEvent.id}`, // Prefix to distinguish from regular events
            title: event.title || 'Untitled Event',
            description: event.description,
            location: event.location,
            date: event.date,
            startDateTime: startDateTime,
            endDateTime: endDateTime,
            categoryName: event.category_name,
            categoryColor: '#00BCD4', // Cyan for shared events
            isAllDay: isAllDay,
            photos: event.photos || [],
            // Shared event properties
            isShared: true,
            sharedBy: sharedEvent.shared_by,
            sharedByUsername: profileToShow?.username || 'Unknown',
            sharedByFullName: profileToShow?.full_name || 'Unknown User',
            sharedStatus: sharedEvent.status,
            sharedByAvatarUrl: profileToShow?.avatar_url || null,
          };

          // Debug: Log the final transformed event avatar info
          console.log('🔍 [Calendar] Final transformed event avatar info:', {
            eventId: transformedEvent.id,
            sharedBy: transformedEvent.sharedBy,
            sharedByAvatarUrl: transformedEvent.sharedByAvatarUrl,
            profileToShowAvatar: profileToShow?.avatar_url,
            profileToShowId: profileToShowId,
            profileToShowData: profileToShow
          });



          return transformedEvent;
        });

      return transformedSharedEvents;
    } catch (error) {
      console.error('🔍 [Calendar] Error in fetchSharedEvents:', error);
      return [];
    }
  };

  // Fetch only ACCEPTED shared events for the calendar (not pending ones)
  const fetchAcceptedSharedEvents = async (userId: string): Promise<CalendarEvent[]> => {
    try {
      console.log('🔍 [Calendar] Fetching ACCEPTED shared events for user:', userId);
      
      // Fetch shared events where current user is either the sender or recipient, but ONLY accepted ones
      const { data: sharedEventsData, error } = await supabase
        .from('shared_events')
        .select(`
          id,
          original_event_id,
          shared_by,
          shared_with,
          status,
          created_at,
          event_data
        `)
        .or(`shared_with.eq.${userId},shared_by.eq.${userId}`)
        .eq('status', 'accepted'); // Only accepted events

      if (error) {
        console.error('🔍 [Calendar] Error fetching accepted shared events:', error);
        return [];
      }

      if (!sharedEventsData || sharedEventsData.length === 0) {
        console.log('🔍 [Calendar] No accepted shared events found');
        return [];
      }

      console.log('🔍 [fetchAcceptedSharedEvents] Raw shared events data:', sharedEventsData);

      // Get unique user IDs involved in shared events (both senders and recipients)
      const allUserIds = new Set<string>();
      sharedEventsData.forEach((se: any) => {
        allUserIds.add(se.shared_by);
        allUserIds.add(se.shared_with);
      });
      
      // Fetch profiles for all users involved
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', Array.from(allUserIds));

      if (profilesError) {
        console.error('🔍 [Calendar] Error fetching profiles:', profilesError);
      }

      // Create a map of user ID to profile data
      const profilesMap = new Map();
      if (profilesData) {
        profilesData.forEach((profile: any) => {
          profilesMap.set(profile.id, profile);
        });
      }

      // Transform accepted shared events into CalendarEvent format
      const transformedAcceptedSharedEvents = sharedEventsData
        .filter((sharedEvent: any) => {
          // Check if the event_data exists
          return !!sharedEvent.event_data;
        })
        .map((sharedEvent: any) => {
          const event = sharedEvent.event_data;
          
          // Always show the sender's profile for shared events
          const profileToShowId = sharedEvent.shared_by;
          const profileToShow = profilesMap.get(profileToShowId);
          
          // Parse dates with better error handling
          const parseDate = (dateStr: string | null) => {
            if (!dateStr) return null;
            try {
              const date = new Date(dateStr);
              if (isNaN(date.getTime())) {
                return null;
              }
              return date;
            } catch (error) {
              return null;
            }
          };

          // Handle all-day events differently to avoid timezone issues
          let startDateTime, endDateTime;
          
          // First, try to parse the start and end times
          const parsedStart = event.start_datetime ? parseDate(event.start_datetime) : null;
          const parsedEnd = event.end_datetime ? parseDate(event.end_datetime) : null;
          
          // Use the database is_all_day flag directly
          let isAllDay = !!event.is_all_day;
          
          if (isAllDay) {
            // For all-day events, preserve the dates for multi-day detection
            // but don't set specific times to avoid timezone issues
            if (event.start_datetime && event.end_datetime) {
              const parsedStart = parseDate(event.start_datetime);
              const parsedEnd = parseDate(event.end_datetime);
              if (parsedStart && parsedEnd) {
                // Set to start of day for both start and end to preserve date info
                startDateTime = new Date(parsedStart);
                startDateTime.setHours(0, 0, 0, 0);
                endDateTime = new Date(parsedEnd);
                endDateTime.setHours(0, 0, 0, 0);
              } else {
                // Fallback: create dates from the date string
            const [year, month, day] = event.date.split('-').map(Number);
                startDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
                endDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
              }
            } else {
              // Fallback: create dates from the date string
              const [year, month, day] = event.date.split('-').map(Number);
              startDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
              endDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
            }
          } else {
            // For regular events, use the parsed datetime values
            startDateTime = parsedStart || undefined;
            endDateTime = parsedEnd || undefined;
            
            // If we have a start time but no end time, create a default end time (1 hour later)
            if (startDateTime && !endDateTime) {
              endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour later
            }
          }

          const transformedEvent = {
            id: `shared_${sharedEvent.id}`, // Prefix to distinguish from regular events
            originalEventId: sharedEvent.original_event_id, // Store the original event ID for deduplication
            title: event.title || 'Untitled Event',
            description: event.description,
            location: event.location,
            date: event.date,
            startDateTime: startDateTime,
            endDateTime: endDateTime,
            categoryName: event.category_name,
            categoryColor: '#00BCD4', // Cyan for shared events
            isAllDay: isAllDay,
            photos: event.photos || [],
            // Shared event properties
            isShared: true,
            sharedBy: sharedEvent.shared_by,
            sharedByUsername: profileToShow?.username || 'Unknown',
            sharedByFullName: profileToShow?.full_name || 'Unknown User',
            sharedStatus: sharedEvent.status,
            sharedByAvatarUrl: profileToShow?.avatar_url || null,
          };

          return transformedEvent;
        });

      console.log('🔍 [fetchAcceptedSharedEvents] Transformed events:', transformedAcceptedSharedEvents);
      return transformedAcceptedSharedEvents;
    } catch (error) {
      console.error('🔍 [Calendar] Error in fetchAcceptedSharedEvents:', error);
      return [];
    }
  };

  // Fetch SENT PENDING shared events for the calendar (events you shared with friends that are pending)
  const fetchSentPendingSharedEvents = async (userId: string): Promise<CalendarEvent[]> => {
    try {
      console.log('🔍 [Calendar] Fetching SENT PENDING shared events for user:', userId);
      
      // Fetch shared events where current user is the sender and status is pending
      const { data: sharedEventsData, error } = await supabase
        .from('shared_events')
        .select(`
          id,
          original_event_id,
          shared_by,
          shared_with,
          status,
          created_at,
          event_data
        `)
        .eq('shared_by', userId)
        .eq('status', 'pending'); // Only pending events sent by the user

      if (error) {
        console.error('🔍 [Calendar] Error fetching sent pending shared events:', error);
        return [];
      }

      if (!sharedEventsData || sharedEventsData.length === 0) {
        console.log('🔍 [Calendar] No sent pending shared events found');
        return [];
      }

      console.log('🔍 [fetchSentPendingSharedEvents] Raw shared events data:', sharedEventsData);

      // Get unique user IDs involved in shared events (recipients only)
      const allUserIds = new Set<string>();
      sharedEventsData.forEach((se: any) => {
        allUserIds.add(se.shared_with);
      });
      
      // Fetch profiles for all users involved
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', Array.from(allUserIds));

      if (profilesError) {
        console.error('🔍 [Calendar] Error fetching profiles:', profilesError);
      }

      // Create a map of user ID to profile data
      const profilesMap = new Map();
      if (profilesData) {
        profilesData.forEach((profile: any) => {
          profilesMap.set(profile.id, profile);
        });
      }

      // Transform sent pending shared events into CalendarEvent format
      const transformedSentPendingSharedEvents = sharedEventsData
        .filter((sharedEvent: any) => {
          // Check if the event_data exists
          return !!sharedEvent.event_data;
        })
        .map((sharedEvent: any) => {
          const event = sharedEvent.event_data;
          
          // Show the recipient's profile for sent events
          const profileToShowId = sharedEvent.shared_with;
          const profileToShow = profilesMap.get(profileToShowId);
          
          // Parse dates with better error handling
          const parseDate = (dateStr: string | null) => {
            if (!dateStr) return null;
            try {
              const date = new Date(dateStr);
              if (isNaN(date.getTime())) {
                return null;
              }
              return date;
            } catch (error) {
              return null;
            }
          };

          // Handle all-day events differently to avoid timezone issues
          let startDateTime, endDateTime;
          
          // First, try to parse the start and end times
          const parsedStart = event.start_datetime ? parseDate(event.start_datetime) : null;
          const parsedEnd = event.end_datetime ? parseDate(event.end_datetime) : null;
          
          // Use the database is_all_day flag directly
          let isAllDay = !!event.is_all_day;
          
          if (isAllDay) {
            // For all-day events, preserve the dates for multi-day detection
            // but don't set specific times to avoid timezone issues
            if (event.start_datetime && event.end_datetime) {
              const parsedStart = parseDate(event.start_datetime);
              const parsedEnd = parseDate(event.end_datetime);
              if (parsedStart && parsedEnd) {
                // Set to start of day for both start and end to preserve date info
                startDateTime = new Date(parsedStart);
                startDateTime.setHours(0, 0, 0, 0);
                endDateTime = new Date(parsedEnd);
                endDateTime.setHours(0, 0, 0, 0);
              } else {
                // Fallback: create dates from the date string
                const [year, month, day] = event.date.split('-').map(Number);
                startDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
                endDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
              }
            } else {
              // Fallback: create dates from the date string
              const [year, month, day] = event.date.split('-').map(Number);
              startDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
              endDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
            }
          } else {
            // For regular events, use the parsed datetime values
            startDateTime = parsedStart || undefined;
            endDateTime = parsedEnd || undefined;
            
            // If we have a start time but no end time, create a default end time (1 hour later)
            if (startDateTime && !endDateTime) {
              endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour later
            }
          }

          const transformedEvent = {
            id: `shared_${sharedEvent.id}`, // Prefix to distinguish from regular events
            originalEventId: sharedEvent.original_event_id, // Store the original event ID for deduplication
            title: event.title || 'Untitled Event',
            description: event.description,
            location: event.location,
            date: event.date,
            startDateTime: startDateTime,
            endDateTime: endDateTime,
            categoryName: event.category_name,
            categoryColor: '#FF9800', // Orange for sent pending events
            isAllDay: isAllDay,
            photos: event.photos || [],
            // Shared event properties
            isShared: true,
            sharedBy: sharedEvent.shared_by,
            sharedWith: sharedEvent.shared_with,
            sharedWithUsername: profileToShow?.username || 'Unknown',
            sharedWithFullName: profileToShow?.full_name || 'Unknown User',
            sharedStatus: sharedEvent.status,
            sharedWithAvatarUrl: profileToShow?.avatar_url || null,
          };

          return transformedEvent;
        });

      console.log('🔍 [fetchSentPendingSharedEvents] Transformed events:', transformedSentPendingSharedEvents);
      return transformedSentPendingSharedEvents;
    } catch (error) {
      console.error('🔍 [Calendar] Error in fetchSentPendingSharedEvents:', error);
      return [];
    }
  };

    const fetchEvents = async () => {
      try {
        setIsLoadingCalendarData(true);
        
        if (!user?.id) {
          setIsLoadingCalendarData(false);
          return;
        }

        // Check session before fetching
        const sessionValid = await checkAndRefreshSession();
        if (!sessionValid) {
          return;
        }
        
        // First, let's check if the events table exists and is accessible
        const { data: tableCheck, error: tableError } = await supabase
          .from('events')
          .select('id')
          .limit(1);

        if (tableError) {
          handleDatabaseError(tableError);
          return;
        }

              // Fetch regular events, ACCEPTED shared events, and SENT PENDING shared events
      const [regularEventsResult, acceptedSharedEvents, sentPendingSharedEvents] = await Promise.all([
          supabase
            .from('events')
            .select('*, photos, private_photos')
            .eq('user_id', user.id)
            .order('date', { ascending: true }),
        fetchAcceptedSharedEvents(user.id), // Only fetch accepted shared events
        fetchSentPendingSharedEvents(user.id) // Fetch sent pending shared events
        ]);

        const { data: eventsData, error } = regularEventsResult;

        if (error) {
          handleDatabaseError(error);
          return;
        }

        // Combine regular events, accepted shared events, and sent pending shared events
        // Regular events and accepted shared events should always show on the calendar
        // Sent pending shared events should also show on the calendar with pending design
        const allEvents = [...(eventsData || []), ...acceptedSharedEvents, ...sentPendingSharedEvents];
        console.log('🔍 [Calendar] Combined events count:', allEvents.length);
        console.log('🔍 [Calendar] Regular events count:', (eventsData || []).length);
        console.log('🔍 [Calendar] Accepted shared events count:', acceptedSharedEvents.length);
        console.log('🔍 [Calendar] Sent pending shared events count:', sentPendingSharedEvents.length);

        if (allEvents.length === 0) {
          setEvents({});
          return;
        }

        // Transform the events data into our local format
        const originals: { [id: string]: CalendarEvent } = {};
        const transformedEvents = allEvents.reduce((acc, event) => {
          
          // Parse UTC dates with better error handling
          const parseDate = (dateStr: string | null) => {
            if (!dateStr) return null;
            try {
              // Handle both ISO strings and other formats
              const date = new Date(dateStr);
              if (isNaN(date.getTime())) {
                return null;
              }
              return date;
            } catch (error) {
              return null;
            }
          };

          // Handle all-day events differently to avoid timezone issues
          let startDateTime, endDateTime;
          
          // Check if this is a Google Calendar event that should be all-day
          const isGoogleAllDay = event.is_google_event && (!event.start_datetime || !event.end_datetime);
          let isAllDay;
          
          if (event.isShared) {
            // Shared events should already have the correct startDateTime, endDateTime, and isAllDay
            // from the fetchSharedEvents transformation
            startDateTime = event.startDateTime;
            endDateTime = event.endDateTime;
            isAllDay = event.isAllDay;
          } else {
            // For regular events, use the standard logic
          // Force isAllDay to true for Google Calendar all-day events or if explicitly marked as all-day
            isAllDay = !!event.is_all_day || isGoogleAllDay;
          
          if (isAllDay) {
            // For all-day events, preserve the dates for multi-day detection
            // but don't set specific times to avoid timezone issues
            if (event.start_datetime && event.end_datetime) {
            const parsedStart = parseDate(event.start_datetime);
            const parsedEnd = parseDate(event.end_datetime);
              if (parsedStart && parsedEnd) {
                // Set to start of day for both start and end to preserve date info
                startDateTime = new Date(parsedStart);
                startDateTime.setHours(0, 0, 0, 0);
                endDateTime = new Date(parsedEnd);
                endDateTime.setHours(0, 0, 0, 0);
              } else {
                // Fallback: create dates from the date string
                const [year, month, day] = event.date.split('-').map(Number);
                startDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
                endDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
              }
            } else {
              // Fallback: create dates from the date string
              const [year, month, day] = event.date.split('-').map(Number);
              startDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
              endDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
            }
          } else {
            // For regular events, parse the datetime strings
            startDateTime = event.start_datetime ? parseDate(event.start_datetime) : undefined;
            endDateTime = event.end_datetime ? parseDate(event.end_datetime) : undefined;
            }
          }
          
          const reminderTime = event.reminder_time ? parseDate(event.reminder_time) : null;
          const repeatEndDate = event.repeat_end_date ? parseDate(event.repeat_end_date) : null;

          // Convert custom times if they exist
          let customTimes;
          if (event.custom_times && typeof event.custom_times === 'object') {
            try {
            customTimes = Object.entries(event.custom_times).reduce((acc, [date, times]: [string, any]) => ({
              ...acc,
              [date]: {
                start: parseDate(times.start),
                end: parseDate(times.end),
                reminder: times.reminder ? parseDate(times.reminder) : null,
                repeat: times.repeat
              }
            }), {});
            } catch (error) {
              customTimes = {};
            }
          }

          const transformedEvent = {
            id: event.id,
            title: event.title || 'Untitled Event',
            description: event.description,
            location: event.location,
            date: event.date,
            startDateTime,
            endDateTime,
            categoryName: event.category_name,
            categoryColor: event.category_color,
            reminderTime,
            repeatOption: event.repeat_option || 'None',
            repeatEndDate,
            customDates: event.custom_dates || [],
            customTimes,
            isAllDay: isAllDay,
            photos: [...(event.photos || []), ...(event.private_photos || [])],
            // Shared event properties (for shared events)
            isShared: event.isShared || false,
            sharedBy: event.sharedBy,
            sharedByUsername: event.sharedByUsername,
            sharedByFullName: event.sharedByFullName,
            sharedStatus: event.sharedStatus,
            // Google Calendar properties
            googleCalendarId: event.google_calendar_id,
            googleEventId: event.google_event_id,
            isGoogleEvent: event.is_google_event || false
          };

          // Check if this is a multi-day event
          const isMultiDayEvent = (event: CalendarEvent): boolean => {
            if (!event.startDateTime || !event.endDateTime) return false;
            const startDate = new Date(event.startDateTime);
            const endDate = new Date(event.endDateTime);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            return startDate.getTime() !== endDate.getTime();
          };

          // Check if this is a multi-day event first (regardless of customDates)
          if (isMultiDayEvent(transformedEvent)) {
            // Handle multi-day events by creating separate instances for each day
            console.log('🔍 [Calendar] Processing multi-day event:', transformedEvent.title);
            originals[transformedEvent.id] = transformedEvent;

            const startDate = new Date(transformedEvent.startDateTime!);
            const endDate = new Date(transformedEvent.endDateTime!);
            
            // Reset times to compare only dates
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            
            // Create separate event instances for each day in the range
            const currentDate = new Date(startDate);
            while (currentDate <= endDate) {
              const dateKey = getLocalDateString(currentDate);
              
              if (!acc[dateKey]) {
                acc[dateKey] = [];
              }
              
              // Create a separate event instance for this specific date
              const eventInstance = {
                ...transformedEvent,
                id: `${transformedEvent.id}_${dateKey}`, // Unique ID for each day
                date: dateKey,
                // Adjust start/end times for this specific day
                startDateTime: new Date(currentDate),
                endDateTime: new Date(currentDate),
              };
              
              // Preserve the time from the original event
              if (transformedEvent.startDateTime && transformedEvent.endDateTime) {
                const originalStart = new Date(transformedEvent.startDateTime);
                const originalEnd = new Date(transformedEvent.endDateTime);
                
                if (transformedEvent.isAllDay) {
                  // For all-day events, set to 12:00 PM and 1:00 PM UTC respectively
                  eventInstance.startDateTime.setUTCHours(12, 0, 0, 0);
                  eventInstance.endDateTime.setUTCHours(13, 0, 0, 0);
                } else {
                  // For regular events, preserve the original time
                eventInstance.startDateTime.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds());
                eventInstance.endDateTime.setHours(originalEnd.getHours(), originalEnd.getMinutes(), originalEnd.getSeconds());
                }
              }
              
              acc[dateKey].push(eventInstance);
              console.log('🔍 [Calendar] Added multi-day event to date:', dateKey, 'Event:', transformedEvent.title);
              
              // Move to next day
              currentDate.setDate(currentDate.getDate() + 1);
            }
          } else if (transformedEvent.customDates && transformedEvent.customDates.length > 0) {
            // For custom events (that are NOT multi-day), add to all custom dates
              transformedEvent.customDates.forEach((date: string) => {
                if (!acc[date]) {
                  acc[date] = [];
                }
                acc[date].push(transformedEvent);
                console.log('🔍 [Calendar] Added custom event to date:', date, 'Event:', transformedEvent.title);
              });
            } else {
            // For regular single-day events, add to the primary date
              if (!acc[transformedEvent.date]) {
                acc[transformedEvent.date] = [];
              }
              acc[transformedEvent.date].push(transformedEvent);
              console.log('🔍 [Calendar] Added event to date:', transformedEvent.date, 'Event:', transformedEvent.title, 'IsShared:', transformedEvent.isShared);
          }

          return acc;
        }, {} as { [date: string]: CalendarEvent[] });

        console.log('🔍 [Calendar] Final transformed events by date:', Object.keys(transformedEvents));
        console.log('🔍 [Calendar] Events for 2025-01-15:', transformedEvents['2025-01-15']?.map((e: CalendarEvent) => ({ title: e.title, isShared: e.isShared, id: e.id })) || 'No events');
        

        
        // Add detailed debugging for shared events
        console.log('🔍 [Calendar] All accepted shared events before transformation:', acceptedSharedEvents.map((e: CalendarEvent) => ({ id: e.id, title: e.title, date: e.date, isShared: e.isShared })));
        console.log('🔍 [Calendar] All events before transformation:', allEvents.map((e: CalendarEvent) => ({ id: e.id, title: e.title, date: e.date, isShared: e.isShared })));
        
        // Check if any events have the date 2025-01-15
        const eventsForJan15 = allEvents.filter(e => e.date === '2025-01-15');
        console.log('🔍 [Calendar] Events with date 2025-01-15 before transformation:', eventsForJan15.map(e => ({ id: e.id, title: e.title, isShared: e.isShared })));

        setEvents(transformedEvents);
        setOriginalEvents(originals);
        
      } catch (error) {
        console.error('🔍 [Calendar] Error in fetchEvents:', error);
      } finally {
        setIsLoadingCalendarData(false);
      }
    };
    
  const onRefresh = useCallback(async () => {
    console.log('🔄 [Calendar] Starting pull-to-refresh...');
    setIsRefreshing(true);
    try {
      // Refresh all data
      await Promise.all([
        fetchEvents(),
        fetchFriends(),
        fetchSharedEvents(user?.id || '')
      ]);
      console.log('🔄 [Calendar] Pull-to-refresh completed successfully');
    } catch (error) {
      console.error('🔄 [Calendar] Error during pull-to-refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
   
    
    fetchEvents();
  }, [user]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'calendar'); // Only fetch calendar categories

        if (error) {
          return;
        }

        if (data) {
          setCategories(data.map(cat => ({
            id: cat.id,
            name: cat.label,
            color: cat.color
          })));
        }
      } catch (error) {
      }
    };
  
    fetchCategories();
  }, [user]);

  // Fetch friends when user changes
  useEffect(() => {
    fetchFriends();
  }, [user]);

  // Function to fetch communication frequency with friends
  const fetchCommunicationFrequency = async (userId: string, friendIds: string[]) => {
    try {
      const counts: { [key: string]: number } = {};
      
      // Count shared events
      const { data: sharedEvents } = await supabase
        .from('shared_events')
        .select('shared_by, shared_with')
        .or(`shared_by.eq.${userId},shared_with.eq.${userId}`)
        .in('shared_by', friendIds)
        .in('shared_with', friendIds);

      // Count shared tasks
      const { data: sharedTasks } = await supabase
        .from('shared_tasks')
        .select('shared_by, shared_with')
        .or(`shared_by.eq.${userId},shared_with.eq.${userId}`)
        .in('shared_by', friendIds)
        .in('shared_with', friendIds);

      // Count photo shares
      const { data: photoShares } = await supabase
        .from('social_updates')
        .select('user_id, shared_with')
        .or(`user_id.eq.${userId},shared_with.eq.${userId}`)
        .in('user_id', friendIds)
        .in('shared_with', friendIds);

      // Calculate total communication count for each friend
      friendIds.forEach(friendId => {
        let count = 0;
        
        // Count events shared with this friend
        if (sharedEvents) {
          count += sharedEvents.filter(se => 
            (se.shared_by === userId && se.shared_with === friendId) ||
            (se.shared_by === friendId && se.shared_with === userId)
          ).length;
        }
        
        // Count tasks shared with this friend
        if (sharedTasks) {
          count += sharedTasks.filter(st => 
            (st.shared_by === userId && st.shared_with === friendId) ||
            (st.shared_by === friendId && st.shared_with === userId)
          ).length;
        }
        
        // Count photo shares with this friend
        if (photoShares) {
          count += photoShares.filter(ps => 
            (ps.user_id === userId && ps.shared_with === friendId) ||
            (ps.user_id === friendId && ps.shared_with === userId)
          ).length;
        }
        
        counts[friendId] = count;
      });

      return counts;
    } catch (error) {
      console.error('Error fetching communication frequency:', error);
      return {};
    }
  };

  // Friends-related functions
  const fetchFriends = async () => {
    try {
      setIsLoadingFriends(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('🔍 [Calendar] Fetching friends for user:', user.id);

      // Get friendships where current user is either user_id or friend_id
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select(`
          id,
          user_id,
          friend_id,
          status,
          created_at
        `)
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (friendshipsError) {
        console.error('Error fetching friendships:', friendshipsError);
        return;
      }

      console.log('🔍 [Calendar] Found friendships:', friendships?.length || 0);

      if (!friendships || friendships.length === 0) {
        setFriends([]);
        return;
      }

      // Get all friend IDs
      const friendIds = friendships.map(friendship => 
        friendship.user_id === user.id ? friendship.friend_id : friendship.user_id
      );

      // Fetch communication frequency
      const communicationCounts = await fetchCommunicationFrequency(user.id, friendIds);

      // Fetch profile data for each friend
      const friendsWithProfiles = await Promise.all(
        friendships.map(async (friendship) => {
          // Determine which user is the friend (not the current user)
          const friendUserId = friendship.user_id === user.id ? friendship.friend_id : friendship.user_id;
          
          console.log('🔍 [Calendar] Fetching profile for friend:', friendUserId);
          
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, username')
            .eq('id', friendUserId)
            .single();
          
          return {
            friendship_id: friendship.id,
            friend_id: friendUserId,
            friend_name: profileData?.full_name || 'Unknown',
            friend_avatar: profileData?.avatar_url || '',
            friend_username: profileData?.username || '',
            status: friendship.status,
            created_at: friendship.created_at,
            communicationCount: communicationCounts[friendUserId] || 0,
          };
        })
      );

      console.log('🔍 [Calendar] Final friends list:', friendsWithProfiles.length);
      setFriends(friendsWithProfiles);
    } catch (error) {
      console.error('Error in fetchFriends:', error);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const handleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleEditFriendSelection = (friendId: string) => {
    setEditSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const removeSelectedFriend = (friendId: string) => {
    setSelectedFriends(prev => prev.filter(id => id !== friendId));
  };

  const removeEditSelectedFriend = (friendId: string) => {
    setEditSelectedFriends(prev => prev.filter(id => id !== friendId));
  };

  const getFilteredFriends = () => {
    if (!searchFriend.trim()) {
      // When no search term, show most frequently communicated friends first
      return friends.sort((a, b) => {
        // Sort by communication count (highest first), then by name
        const aCount = a.communicationCount || 0;
        const bCount = b.communicationCount || 0;
        
        if (aCount !== bCount) {
          return bCount - aCount; // Higher count first
        }
        return a.friend_name.localeCompare(b.friend_name);
      });
    }
    return friends.filter(friend => 
      friend.friend_name?.toLowerCase().includes(searchFriend.toLowerCase()) ||
      friend.friend_username?.toLowerCase().includes(searchFriend.toLowerCase())
    );
  };

  const shareEventWithSelectedFriends = async (eventId: string): Promise<boolean> => {
    if (selectedFriends.length === 0) return false;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const result = await shareEventWithFriends(eventId, selectedFriends);
    if (result.success) {
      Toast.show({
        type: 'success',
        text1: 'Event shared successfully',
        text2: 'Your friends will be notified',
        position: 'bottom',
      });
      return true;
    } else {
      Toast.show({
        type: 'error',
        text1: 'Failed to share event',
        text2: result.error || 'Please try again',
        position: 'bottom',
      });
      return false;
    }
  };

  const shareEventWithEditSelectedFriends = async (eventId: string): Promise<boolean> => {
    if (editSelectedFriends.length === 0) return false;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const result = await shareEventWithFriends(eventId, editSelectedFriends);
    if (result.success) {
      Toast.show({
        type: 'success',
        text1: 'Event shared successfully',
        text2: 'Your friends will be notified',
        position: 'bottom',
      });
      return true;
    } else {
      Toast.show({
        type: 'error',
        text1: 'Failed to share event',
        text2: result.error || 'Please try again',
        position: 'bottom',
      });
      return false;
    }
  };

  const fetchSharedFriendsForEvent = async (eventId: string, isRecipient: boolean = false) => {
    try {
      console.log('🔍 [Edit Modal] Fetching shared friends for event:', eventId, 'isRecipient:', isRecipient);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('🔍 [Edit Modal] No user found');
        return [];
      }

      console.log('🔍 [Edit Modal] User ID:', user.id);

      // First, check if the shared_events table exists
      try {
        const { data: tableCheck, error: tableError } = await supabase
          .from('shared_events')
          .select('count')
          .limit(1);

        if (tableError) {
          console.log('🔍 [Edit Modal] Shared events table not accessible:', tableError);
          return [];
        }
      } catch (tableCheckError) {
        console.log('🔍 [Edit Modal] Error checking shared_events table:', tableCheckError);
        return [];
      }

      // Add timeout to prevent hanging requests
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 5000); // 5 second timeout
      });

      let queryPromise;
      let eventOwnerId: string | null = null;
      
      // Check if the eventId is a shared event ID (UUID format) or original event ID
      const isSharedEventId = eventId.includes('-') && eventId.length > 20; // UUID format
      
      if (isRecipient) {
        // For recipients, we need to find all friends that this event was shared with
        if (isSharedEventId) {
          // If eventId is a shared event ID, find the original event ID first
          const { data: sharedEventData, error: findError } = await supabase
            .from('shared_events')
            .select('shared_by, original_event_id')
            .eq('id', eventId)
            .eq('shared_with', user.id)
            .single();
          
          if (findError || !sharedEventData) {
            console.log('🔍 [Edit Modal] Could not find shared event for recipient');
            return [];
          }
          
          eventOwnerId = sharedEventData.shared_by;
          const originalEventId = sharedEventData.original_event_id;
          
          // Then find all friends that the event was shared with by that user
          queryPromise = supabase
            .from('shared_events')
            .select('shared_with')
            .eq('original_event_id', originalEventId)
            .eq('shared_by', eventOwnerId);
        } else {
          // If eventId is an original event ID
        const { data: sharedEventData, error: findError } = await supabase
          .from('shared_events')
          .select('shared_by')
          .eq('original_event_id', eventId)
          .eq('shared_with', user.id)
          .single();
        
        if (findError || !sharedEventData) {
          console.log('🔍 [Edit Modal] Could not find shared event for recipient');
          return [];
        }
        
        eventOwnerId = sharedEventData.shared_by;
        
        // Then find all friends that the event was shared with by that user
        queryPromise = supabase
          .from('shared_events')
          .select('shared_with')
          .eq('original_event_id', eventId)
          .eq('shared_by', eventOwnerId);
        }
      } else {
        // For owners, find all friends they shared the event with
        eventOwnerId = user.id; // The current user is the owner
        
        if (isSharedEventId) {
          // If eventId is a shared event ID, find the original event ID first
          const { data: sharedEventData, error: findError } = await supabase
            .from('shared_events')
            .select('original_event_id')
            .eq('id', eventId)
            .eq('shared_by', user.id)
            .single();
          
          if (findError || !sharedEventData) {
            console.log('🔍 [Edit Modal] Could not find shared event for owner');
            return [];
          }
          
          const originalEventId = sharedEventData.original_event_id;
          
          // Find all friends they shared the event with
          queryPromise = supabase
            .from('shared_events')
            .select('shared_with')
            .eq('original_event_id', originalEventId)
            .eq('shared_by', user.id);
        } else {
          // If eventId is an original event ID
        queryPromise = supabase
          .from('shared_events')
          .select('shared_with')
          .eq('original_event_id', eventId)
          .eq('shared_by', user.id);
        }
      }

      const { data: sharedEvents, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      console.log('🔍 [Edit Modal] Shared events query result:', { sharedEvents, error });

      if (error) {
        console.error('🔍 [Edit Modal] Error fetching shared friends:', error);
        return [];
      }

      if (!sharedEvents || sharedEvents.length === 0) {
        console.log('🔍 [Edit Modal] No shared events found');
        return [];
      }

      // Extract the friend IDs
      let friendIds = sharedEvents.map((se: { shared_with: string }) => se.shared_with);
      
      // For both recipients AND owners, include the event owner in the list
      // This ensures everyone sees the complete list of involved people
      if (eventOwnerId) {
        friendIds = [...friendIds, eventOwnerId];
        console.log('🔍 [Edit Modal] Added event owner to friend list:', eventOwnerId);
      }
      
      console.log('🔍 [Edit Modal] Found friend IDs:', friendIds);
      return friendIds;
    } catch (error) {
      console.error('🔍 [Edit Modal] Error in fetchSharedFriendsForEvent:', error);
      return [];
    }
  };

  // Update category deletion
  const handleCategoryLongPress = (cat: { id: string; name: string; color: string }) => {
    Alert.alert(
      'Delete Category',
      'Are you sure you want to delete this category?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Check if there are any events using this category
              const { data: eventsData, error: eventsError } = await supabase
                .from('events')
                .select('id')
                .eq('category_id', cat.id);

              if (eventsError) {
                Alert.alert('Error', 'Failed to check if category is in use. Please try again.');
                return;
              }

              if (eventsData && eventsData.length > 0) {
                Alert.alert(
                  'Cannot Delete Category',
                  'This category is currently being used by one or more events. Please remove the category from these events before deleting.',
                  [{ text: 'OK' }]
                );
                return;
              }

              // If no events are using this category, proceed with deletion
              const { error } = await supabase
                .from('categories')
                .delete()
                .eq('id', cat.id)
                .eq('type', 'calendar'); // Only delete calendar categories

              if (error) {
                Alert.alert('Error', 'Failed to delete category. Please try again.');
                return;
              }

              // Update local state
              setCategories(prev => prev.filter(c => c.id !== cat.id));
              
              // If the deleted category was selected, clear the selection
              if (selectedCategory?.id === cat.id) {
                setSelectedCategory(null);
              }
              if (editedSelectedCategory?.id === cat.id) {
                setEditedSelectedCategory(null);
              }

            } catch (error) {
              Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

    
  const getMonthData = (baseDate: Date, offset: number) => {
    const newDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
    const year = newDate.getFullYear();
    const month = newDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];
    
    // Add days from previous month
    const prevMonth = new Date(year, month, 0);
    const daysInPrevMonth = prevMonth.getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, daysInPrevMonth - i));
    }

    // Add days from current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    // Calculate total days needed
    const totalDaysNeeded = daysInMonth + startOffset;
    const needsSixRows = totalDaysNeeded > 35;

    // If we need 6 rows, always fill up to 42 days
    if (needsSixRows) {
      const remainingDays = 42 - days.length;
      // Add days from next month to fill up to 42
      for (let i = 1; i <= remainingDays; i++) {
        days.push(new Date(year, month + 1, i));
      }
    } else {
      // For 5-row months, fill up to 35 days
      const remainingDays = 35 - days.length;
      for (let i = 1; i <= remainingDays; i++) {
        days.push(new Date(year, month + 1, i));
      }
    }

    return { key: generateMonthKey(year, month), year, month, days };
  };

  // Generate 60 months (5 years) starting from January of the previous year to December 2028
  const currentYear = today.getFullYear();
  const startYear = currentYear - 1;
  const endYear = 2028;
  const totalYears = endYear - startYear + 1;
  const months = Array.from({ length: totalYears * 12 }, (_, i) => {
    const year = startYear + Math.floor(i / 12);
    const month = i % 12;
    const baseDate = new Date(year, month, 1);
    return getMonthData(baseDate, 0);
  });

  const isToday = (date: Date | null) =>
    date?.toDateString() === new Date().toDateString();

  const isSelected = (date: Date | null) =>
    date?.toDateString() === selectedDate.toDateString();


  const handleDeleteEvent = async (eventId: string) => {
    try {
      console.log('🗑️ [Delete] Starting delete for event ID:', eventId);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please log in again to delete events.');
        return;
      }

      const parts = eventId.split('_');
      const isMultiDayInstance = parts.length >= 2 && !!parts[parts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/);
      const baseEventId = isMultiDayInstance ? parts.slice(0, -1).join('_') : eventId;
      
      console.log('🗑️ [Delete] Event ID analysis:', {
        originalId: eventId,
        isMultiDayInstance,
        baseEventId
      });

      // Check if this is a shared event
      const isSharedEvent = baseEventId.startsWith('shared_');
      
      if (isSharedEvent) {
        console.log('🗑️ [Delete] Calling handleDeleteSharedEvent');
        await handleDeleteSharedEvent(baseEventId);
      } else {
        console.log('🗑️ [Delete] Calling handleDeleteRegularEvent with baseEventId:', baseEventId, 'and originalEventId:', eventId);
        await handleDeleteRegularEvent(baseEventId, eventId); // Pass both base ID and original ID
      }
    } catch (error) {
      console.error('🗑️ [Delete] Error in handleDeleteEvent:', error);
      Alert.alert('Error', 'Failed to delete event. Please try again.');
    }
  };

  const handleDeleteSharedEvent = async (sharedEventId: string) => {
    try {
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Extract the actual shared event ID (remove 'shared_' prefix)
      const actualSharedEventId = sharedEventId.replace('shared_', '');
      
      // Get shared event data
      const { data: sharedEventData, error: fetchError } = await supabase
        .from('shared_events')
        .select('shared_by, shared_with, original_event_id')
        .eq('id', actualSharedEventId)
        .single();

      if (fetchError || !sharedEventData) {
        throw new Error('Shared event not found');
      }

      const isOwner = sharedEventData.shared_by === user.id;
      const isRecipient = sharedEventData.shared_with === user.id;

      if (isOwner) {
        // Owner: delete the original event and all shared instances
        console.log('🗑️ [Delete Shared] User is owner, deleting original event');
        await handleDeleteRegularEvent(sharedEventData.original_event_id);
      } else if (isRecipient) {
        // Recipient: decline the shared event
        console.log('🗑️ [Delete Shared] User is recipient, declining shared event');
        
        // Update status to declined
        const { error: updateError } = await supabase
          .from('shared_events')
          .update({ 
            status: 'declined',
            updated_at: new Date().toISOString()
          })
          .eq('id', actualSharedEventId)
          .eq('shared_with', user.id);

        if (updateError) {
          throw updateError;
        }

        // Remove from local state
        setEvents(prevEvents => {
          const newEvents = { ...prevEvents };
          Object.keys(newEvents).forEach(dateKey => {
            newEvents[dateKey] = newEvents[dateKey].filter(event => event.id !== sharedEventId);
            if (newEvents[dateKey].length === 0) {
              delete newEvents[dateKey];
            }
          });
          return newEvents;
        });

        Toast.show({
          type: 'success',
          text1: 'Event declined',
          text2: 'The event has been removed from your calendar',
          position: 'bottom',
          visibilityTime: 2000,
        });
      } else {
        throw new Error('User not authorized to delete this event');
      }
    } catch (error) {
      console.error('🗑️ [Delete Shared] Error:', error);
      Alert.alert('Error', 'Failed to delete shared event. Please try again.');
    }
  };

  const handleDeleteRegularEvent = async (baseEventId: string, originalEventId?: string) => {
    try {
      console.log('🗑️ [Delete Regular] Starting with baseEventId:', baseEventId, 'originalEventId:', originalEventId);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // The baseEventId passed here is already the base event ID (extracted in handleDeleteEvent)
      // No need to extract again

      // Find all events that match the base event ID (including multi-day instances)
      const { data: existingEvents, error: checkError } = await supabase
        .from('events')
        .select('id, title, user_id, start_datetime, end_datetime, category_id')
        .or(`id.eq.${baseEventId},id.like.${baseEventId}_%`);

      if (checkError) {
        throw checkError;
      }

      if (!existingEvents || existingEvents.length === 0) {
        console.warn('🗑️ [Delete Regular] No events found in database for base ID:', baseEventId);
        // Still remove from local state even if not in database
        removeEventFromLocalState(originalEventId || baseEventId);
        return;
      }

      // Check if user owns all the events
      const unauthorizedEvents = existingEvents.filter(event => event.user_id !== user.id);
      if (unauthorizedEvents.length > 0) {
        throw new Error('You can only delete your own events');
      }

      console.log('🗑️ [Delete Regular] Found events to delete:', existingEvents.map(e => e.id));

      // Cancel notifications for all events
      for (const event of existingEvents) {
        await cancelEventNotification(event.id);
      }

      // Delete shared events first
      const { error: sharedDeleteError } = await supabase
        .from('shared_events')
        .delete()
        .eq('original_event_id', baseEventId);

      if (sharedDeleteError) {
        console.error('🗑️ [Delete Regular] Error deleting shared events:', sharedDeleteError);
      }

      // Delete all matching events
      const eventIds = existingEvents.map(e => e.id);
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .in('id', eventIds);

      if (deleteError) {
        throw deleteError;
      }
      // Remove from local state
      removeEventFromLocalState(originalEventId || baseEventId);
    } catch (error) {
      console.error('🗑️ [Delete Regular] Error:', error);
      Alert.alert('Error', 'Failed to delete event. Please try again.');
    }
  };

  // Helper function to remove events from local state
  // Helper function to generate repeated events
  const generateRepeatedEvents = (event: CalendarEvent): CalendarEvent[] => {
    if (!event.repeatOption || event.repeatOption === 'None' || event.repeatOption === 'Custom') {
      return [event];
    }

    const events: CalendarEvent[] = [];
    const baseDate = event.startDateTime || new Date(event.date);
    const endDate = event.repeatEndDate || new Date(baseDate.getFullYear() + 1, baseDate.getMonth(), baseDate.getDate());


    // Helper function to create an event for a specific date
    const createEventForDate = (date: Date): CalendarEvent => {
      const newEvent: CalendarEvent = {
        ...event,
        id: event.id, // Keep the same ID for all repeated events
        date: getLocalDateString(date),
        isAllDay: event.isAllDay
      };

      if (event.isAllDay) {
        // For all-day events, set the date without time
        newEvent.startDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        newEvent.endDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      } else if (event.startDateTime && event.endDateTime) {
        // For regular events, maintain the time from the original event
        const startTime = event.startDateTime;
        const endTime = event.endDateTime;
        const duration = endTime.getTime() - startTime.getTime();
        
        newEvent.startDateTime = new Date(date);
        newEvent.startDateTime.setHours(startTime.getHours(), startTime.getMinutes(), startTime.getSeconds());
        
        newEvent.endDateTime = new Date(newEvent.startDateTime.getTime() + duration);
      }

      // Adjust reminder time if it exists
      if (event.reminderTime && newEvent.startDateTime && event.startDateTime) {
        const reminderOffset = event.reminderTime.getTime() - event.startDateTime.getTime();
        newEvent.reminderTime = new Date(newEvent.startDateTime.getTime() + reminderOffset);
      }

      return newEvent;
    };

    // Generate events based on repeat pattern
    let currentDate = new Date(baseDate);
    let eventCount = 0;
    const maxEvents = 100; // Prevent infinite loops

    while (currentDate <= endDate && eventCount < maxEvents) {
      events.push(createEventForDate(new Date(currentDate)));
      eventCount++;

      // Calculate next date based on repeat option
      const nextDate = new Date(currentDate);
      switch (event.repeatOption) {
        case 'Daily':
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case 'Weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'Monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'Yearly':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
        default:
        break;
      }

      currentDate = nextDate;
      }

    return events;
  };

  const removeEventFromLocalState = (eventId: string) => {
    console.log('🗑️ [removeEventFromLocalState] Starting removal for eventId:', eventId);
    
      setEvents(prevEvents => {
        const newEvents = { ...prevEvents };
        let removedCount = 0;
        
      const parts = eventId.split('_');
      const isMultiDayInstance = parts.length >= 2 && !!parts[parts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/);
      const baseEventId = isMultiDayInstance ? parts.slice(0, -1).join('_') : eventId;
      
      console.log('🗑️ [removeEventFromLocalState] Analysis:', {
        originalId: eventId,
        isMultiDayInstance,
        baseEventId,
        totalDates: Object.keys(newEvents).length
      });
        
        Object.keys(newEvents).forEach(dateKey => {
          const beforeCount = newEvents[dateKey].length;
        console.log(`🗑️ [removeEventFromLocalState] Processing date ${dateKey}, events before: ${beforeCount}`);
          
            newEvents[dateKey] = newEvents[dateKey].filter(event => {
          const eventParts = event.id.split('_');
          const eventIsMultiDayInstance = eventParts.length >= 2 && !!eventParts[eventParts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/);          const eventBaseId = eventIsMultiDayInstance ? eventParts.slice(0, -1).join('_') : event.id;
          
          const shouldKeep = eventBaseId !== baseEventId;
          if (!shouldKeep) {
            console.log(`🗑️ [removeEventFromLocalState] Removing event: ${event.id} (base: ${eventBaseId})`);
          }
          return shouldKeep;
        });
          
          const afterCount = newEvents[dateKey].length;
          removedCount += (beforeCount - afterCount);
        console.log(`🗑️ [removeEventFromLocalState] Date ${dateKey}, events after: ${afterCount}, removed: ${beforeCount - afterCount}`);
          
          if (newEvents[dateKey].length === 0) {
            delete newEvents[dateKey];
          console.log(`🗑️ [removeEventFromLocalState] Deleted empty date: ${dateKey}`);
          }
        });

      console.log('🗑️ [removeEventFromLocalState] Total removed:', removedCount);
        return newEvents;
      });
  };

  const resetEventForm = (customSelectedDate?: Date) => {
    setNewEventTitle('');
    setNewEventDescription('');
    setNewEventLocation('');
    
    // Use the provided date or the currently selected date
    const dateToUse = customSelectedDate || selectedDate;
    const selectedDateForEvent = new Date(dateToUse);
    const selectedDateEndTime = new Date(dateToUse);
    selectedDateEndTime.setHours(selectedDateEndTime.getHours() + 1); // 1 hour later
    
    setStartDateTime(selectedDateForEvent);
    setEndDateTime(selectedDateEndTime);
    
    setSelectedCategory(null);
    setReminderTime(null);
    setRepeatOption('None');
    setRepeatEndDate(null);
    setCustomSelectedDates([]);
    setCustomDateTimes({
      default: {
        start: selectedDateForEvent,
        end: selectedDateEndTime,
        reminder: null,
        repeat: 'None',
        dates: [getLocalDateString(selectedDateForEvent)]
      }
    });
    setSelectedDateForCustomTime(null);
    setCustomStartTime(selectedDateForEvent);
    setCustomEndTime(selectedDateEndTime);
    setUserChangedEndTime(false);
    // Removed setIsAllDay(false) to preserve all-day toggle state when modal closes
    setEventPhotos([]);
    setEditedEventPhotos([]);
    setPhotoPrivacyMap({});
    setSelectedFriends([]);
    setSearchFriend('');
    setIsSearchFocused(false);
    setEditSelectedFriends([]);
    setEditSearchFriend('');
    setEditIsSearchFocused(false);
    resetToggleStates();
  };

  const handleSaveEvent = async (customEvent?: CalendarEvent, originalEvent?: CalendarEvent): Promise<void> => {
    try {
      // Add a small delay to ensure state updates are processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // First, check and refresh session if needed
      const sessionValid = await checkAndRefreshSession();
      if (!sessionValid) {
        Alert.alert('Session Error', 'Please log in again to save events.');
        return;
      }

      // Then verify user authentication
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        Alert.alert('Authentication Error', 'Please log in again to save events.');
        return;
      }

      if (!currentUser?.id) {
        Alert.alert('Authentication Error', 'Please log in to save events.');
        return;
      }

      // Format date to UTC ISO string
      const formatDateToUTC = (date: Date): string => {
        // Get UTC components
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
      };

      const eventToSave = customEvent || {
        id: generateEventId(),
        title: newEventTitle,
        description: newEventDescription,
        location: newEventLocation,
        date: getLocalDateString(startDateTime), // This should use the current startDateTime state
        startDateTime: new Date(startDateTime),
        endDateTime: new Date(endDateTime),
        categoryName: selectedCategory?.name,
        categoryColor: selectedCategory?.color,
        reminderTime: reminderTime ? new Date(reminderTime) : null,
        repeatOption: customSelectedDates.length > 0 ? 'Custom' : repeatOption,
        repeatEndDate: repeatEndDate ? new Date(repeatEndDate) : null,
        customDates: customSelectedDates,
        customTimes: Object.entries(customDateTimes).reduce((acc, [key, timeData]) => {
          if (key === 'default') return acc;
          timeData.dates.forEach(date => {
            acc[date] = {
              start: new Date(timeData.start),
              end: new Date(timeData.end),
              reminder: timeData.reminder ? new Date(timeData.reminder) : null,
              repeat: timeData.repeat
            };
          });
          return acc;
        }, {} as { [date: string]: { start: Date; end: Date; reminder: Date | null; repeat: RepeatOption } }),
        isAllDay: isAllDay,
        photos: eventPhotos.filter(photo => !photoPrivacyMap[photo]), // Only regular photos
        private_photos: eventPhotos.filter(photo => photoPrivacyMap[photo]) // Only private photos
      };

      if (eventToSave.isAllDay) {
        // For all-day events, preserve the actual start and end dates but set times to 12pm-1pm UTC
        const startDate = new Date(eventToSave.startDateTime || startDateTime);
        const endDate = new Date(eventToSave.endDateTime || endDateTime);

        // Set times to 12:00 PM and 1:00 PM UTC respectively
        startDate.setUTCHours(12, 0, 0, 0);
        endDate.setUTCHours(13, 0, 0, 0);
        
        eventToSave.startDateTime = startDate;
        eventToSave.endDateTime = endDate;
      } else {
        // For regular events, store the full datetime
        eventToSave.startDateTime = new Date(startDateTime);
        eventToSave.endDateTime = new Date(endDateTime);
      }

      // Store original multi-day events for edit modal reference
      const isMultiDayEvent = (event: CalendarEvent): boolean => {
        if (!event.startDateTime || !event.endDateTime) return false;
        const startDate = new Date(event.startDateTime);
        const endDate = new Date(event.endDateTime);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        return startDate.getTime() !== endDate.getTime();
      };
      
      if (isMultiDayEvent(eventToSave)) {
        setOriginalEvents(prev => ({ ...prev, [eventToSave.id]: eventToSave }));
      }
      // Generate all repeated events for local state
      const allEvents = generateRepeatedEvents(eventToSave);

      // Prepare database data - only save the original event with repeat information
        const dbEvent = {
        id: eventToSave.id,
        title: eventToSave.title,
        description: eventToSave.description,
        date: eventToSave.date,
        start_datetime: formatDateToUTC(eventToSave.startDateTime),
        end_datetime: formatDateToUTC(eventToSave.endDateTime),
        category_name: eventToSave.categoryName || null,
        category_color: eventToSave.categoryColor || null,
        reminder_time: eventToSave.reminderTime ? formatDateToUTC(eventToSave.reminderTime) : null,
        repeat_option: eventToSave.repeatOption,
        repeat_end_date: eventToSave.repeatEndDate ? formatDateToUTC(eventToSave.repeatEndDate) : null,
        custom_dates: eventToSave.customDates,
        custom_times: eventToSave.customTimes ? 
          Object.entries(eventToSave.customTimes).reduce((acc, [date, times]) => ({
              ...acc,
              [date]: {
                start: formatDateToUTC(times.start),
                end: formatDateToUTC(times.end),
                reminder: times.reminder ? formatDateToUTC(times.reminder) : null,
                repeat: times.repeat
              }
            }), {}) : null,
        is_all_day: eventToSave.isAllDay,
        photos: eventToSave.photos || [],
        private_photos: eventToSave.private_photos || [],
          user_id: currentUser.id // Use the verified current user ID
        };

      let dbError;
      // If we have an ID and it's not a new event (editingEvent exists), update the existing event
      if (eventToSave.id && (editingEvent || originalEvent)) {
        const eventToDelete = originalEvent || editingEvent;
        
        // First remove the old event from all its dates in local state
        setEvents(prev => {
          const updated = { ...prev };
          // Remove from all dates where the event exists
          Object.keys(updated).forEach(date => {
            updated[date] = updated[date].filter(e => e.id !== eventToDelete?.id);
            if (updated[date].length === 0) {
              delete updated[date];
            }
          });
          return updated;
        });

        // Try multiple deletion approaches
        let deleteSuccess = false;
        
        // Approach 1: Delete by exact ID
        if (eventToDelete?.id) {
        const { error: deleteError } = await supabase
          .from('events')
          .delete()
            .eq('id', eventToDelete.id);

          if (!deleteError) {
            deleteSuccess = true;
          }
        }

        // Approach 2: If ID deletion failed, try by title and date
        if (!deleteSuccess && eventToDelete?.title && eventToDelete?.date) {
          const { error: fallbackDeleteError } = await supabase
            .from('events')
            .delete()
            .eq('title', eventToDelete.title)
            .eq('date', eventToDelete.date);

          if (!fallbackDeleteError) {
            deleteSuccess = true;
          }
        }
        
        const { error: insertError } = await supabase
          .from('events')
          .insert(dbEvent);

        dbError = insertError;
      } else if (selectedFriends.length === 0) {
        console.log('🔍 [handleSaveEvent] Creating regular event (no friends selected)');
        
        const { error: insertError } = await supabase
          .from('events')
          .insert(dbEvent);

        dbError = insertError;
      } else {
        console.log('🔍 [handleSaveEvent] Skipping database insertion for shared event');
        // For shared events, we'll handle the database insertion in the sharing function
        dbError = null;
      }

      if (dbError) {
        // Check if it's an RLS policy error
        if (dbError.code === '42501') {
          Alert.alert(
            'Authentication Error', 
            'Unable to save event. Please try logging out and logging back in.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // You might want to redirect to login here
                }
              }
            ]
          );
        } else {
        throw dbError;
        }
        return;
      }

      // Update local state with all events (but skip for shared events since they'll be refreshed)
      if (selectedFriends.length === 0) {
        setEvents(prev => {
          const updated = { ...prev };
          console.log('🔄 [Repeat] Updating local state with', allEvents.length, 'events');
          
          // Helper function to check if event is multi-day
          const isMultiDayEvent = (event: CalendarEvent): boolean => {
            if (!event.startDateTime || !event.endDateTime) return false;
            const startDate = new Date(event.startDateTime);
            const endDate = new Date(event.endDateTime);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            return startDate.getTime() !== endDate.getTime();
          };
          
          allEvents.forEach(event => {
            // Check if this is a multi-day event first
            if (isMultiDayEvent(event)) {
              console.log('🔍 [Calendar] Processing multi-day event in local state update:', event.title);
              const startDate = new Date(event.startDateTime!);
              const endDate = new Date(event.endDateTime!);
              
              // Reset times to compare only dates
              startDate.setHours(0, 0, 0, 0);
              endDate.setHours(0, 0, 0, 0);
              
              // Create separate event instances for each day in the range
              const currentDate = new Date(startDate);
              while (currentDate <= endDate) {
                const dateKey = getLocalDateString(currentDate);
                
                if (!updated[dateKey]) {
                  updated[dateKey] = [];
                }
                
                // Remove any existing instances of this event
                updated[dateKey] = updated[dateKey].filter(e => {
                  const eventParts = e.id.split('_');
const eventIsMultiDayInstance = eventParts.length >= 2 && !!eventParts[eventParts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/);                  
const eventBaseId = eventIsMultiDayInstance ? eventParts.slice(0, -1).join('_') : e.id;
                  return eventBaseId !== event.id;
                });
                
                // Create a separate event instance for this specific date
                const eventInstance = {
                  ...event,
                  id: `${event.id}_${dateKey}`, // Unique ID for each day
                  date: dateKey,
                  // Adjust start/end times for this specific day
                  startDateTime: new Date(currentDate),
                  endDateTime: new Date(currentDate),
                };
                
                // Preserve the time from the original event
                if (event.startDateTime && event.endDateTime) {
                  const originalStart = new Date(event.startDateTime);
                  const originalEnd = new Date(event.endDateTime);
                  
                  if (event.isAllDay) {
                    // For all-day events, set to 12:00 PM and 1:00 PM UTC respectively
                    eventInstance.startDateTime.setUTCHours(12, 0, 0, 0);
                    eventInstance.endDateTime.setUTCHours(13, 0, 0, 0);
                  } else {
                    // For regular events, preserve the original time
                    eventInstance.startDateTime.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds());
                    eventInstance.endDateTime.setHours(originalEnd.getHours(), originalEnd.getMinutes(), originalEnd.getSeconds());
                  }
                }
                
                updated[dateKey].push(eventInstance);
                console.log('🔍 [Calendar] Added multi-day event to date:', dateKey, 'Event:', event.title);
                
                // Move to next day
                currentDate.setDate(currentDate.getDate() + 1);
              }
            } else if (event.customDates && event.customDates.length > 0) {
              // For custom events (that are NOT multi-day), add to all custom dates
              event.customDates.forEach(date => {
                if (!updated[date]) {
                  updated[date] = [];
                }
                updated[date] = updated[date].filter(e => e.id !== event.id);
                updated[date].push(event);
              });
            } else {
              // For regular single-day events, add to the primary date
              const dateKey = event.date;
              if (!updated[dateKey]) {
                updated[dateKey] = [];
              }
              updated[dateKey] = updated[dateKey].filter(e => e.id !== event.id);
              updated[dateKey].push(event);
            }
          });
          
          return updated;
        });

        // Schedule notifications for all events with reminders
        for (const event of allEvents) {
          if (event.reminderTime) {
            await scheduleEventNotification(event);
          }
        }
        
        // Update pending shared events after fetching regular events
        updatePendingSharedEvents();
      } else {
        console.log('🔍 [handleSaveEvent] Not creating shared event - condition not met');
      }

      // Handle shared event creation differently
      console.log('🔍 [handleSaveEvent] Debugging shared event creation:');
      console.log('🔍 [handleSaveEvent] selectedFriends.length:', selectedFriends.length);
      console.log('🔍 [handleSaveEvent] allEvents.length:', allEvents.length);
      console.log('🔍 [handleSaveEvent] selectedFriends:', selectedFriends);
      
      if (selectedFriends.length > 0 && allEvents.length > 0) {
        console.log('🔍 [handleSaveEvent] Creating shared event...');
        // For shared events, create them directly as shared events
        const eventToShare = allEvents[0];
        
        // Format the event data for sharing
        const formatDateToUTC = (date: Date): string => {
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(date.getUTCDate()).padStart(2, '0');
          const hours = String(date.getUTCHours()).padStart(2, '0');
          const minutes = String(date.getUTCMinutes()).padStart(2, '0');
          const seconds = String(date.getUTCSeconds()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
        };

        const eventData = {
          id: eventToShare.id,
          title: eventToShare.title,
          description: eventToShare.description,
          location: eventToShare.location,
          date: eventToShare.date,
          startDateTime: eventToShare.isAllDay ? undefined : (eventToShare.startDateTime ? formatDateToUTC(eventToShare.startDateTime) : undefined),
          endDateTime: eventToShare.isAllDay ? undefined : (eventToShare.endDateTime ? formatDateToUTC(eventToShare.endDateTime) : undefined),
          categoryName: eventToShare.categoryName,
          categoryColor: eventToShare.categoryColor,
          isAllDay: eventToShare.isAllDay || false,
          photos: eventToShare.photos || []
        };

        // Create and share the event in one step
        console.log('🔍 [handleSaveEvent] Calling createAndShareEvent with:', { eventData, selectedFriends });
        const result = await createAndShareEvent(eventData, selectedFriends);
        console.log('🔍 [handleSaveEvent] createAndShareEvent result:', result);
        
        // Clear selected friends after sharing
        setSelectedFriends([]);
        
        if (result.success) {
          Toast.show({
            type: 'success',
            text1: 'Event shared successfully',
            text2: 'Your friends will be notified',
            position: 'bottom',
          });
          
          // Refresh events to show the shared event
          await fetchEvents();
          
          // Update pending shared events to show the new shared event
          await updatePendingSharedEvents();
        } else {
          Toast.show({
            type: 'error',
            text1: 'Failed to share event',
            text2: result.error || 'Please try again',
            position: 'bottom',
          });
        }
        
        // Reset form and close modal for shared events
        resetEventForm();
        setShowModal(false);
        setShowCustomDatesPicker(false);
        setEditingEvent(null);
        return; // Exit early for shared events
      }

      // Reset form and close modal
      resetEventForm();
      setShowModal(false);
      setShowCustomDatesPicker(false);
      setEditingEvent(null);

      // If the event has photos and is not private, share them to friends feed
      if (eventToSave.photos && eventToSave.photos.length > 0 && user?.id) {
        try {
          // Share each non-private photo
          for (const photoUrl of eventToSave.photos) {
            // Check if this photo is not in private_photos
            if (!eventToSave.private_photos?.includes(photoUrl)) {
              // Create social update for this photo
              const { error: socialError } = await supabase
                .from('social_updates')
                .insert({
                  user_id: user.id,
                  type: 'photo_share',
                  photo_url: photoUrl,
                  caption: '', // Let the friends feed fetch the actual event title
                  source_type: 'event',
                  source_id: eventToSave.id,
                  is_public: true,
                  content: {
                    title: eventToSave.title,
                    photo_url: photoUrl
                  }
                });

              if (socialError) {
                console.error('Error creating social update for photo:', socialError);
              }
            }
          }
          
          // Show additional success message if photos were shared
          const publicPhotoCount = eventToSave.photos.filter(photo => 
            !eventToSave.private_photos?.includes(photo)
          ).length;
          
          if (publicPhotoCount > 0) {
      Toast.show({
        type: 'success',
              text1: `${publicPhotoCount} photo${publicPhotoCount > 1 ? 's' : ''} shared with friends!`,
        position: 'bottom',
      });
          }
        } catch (error) {
          console.error('Error sharing photos to friends feed:', error);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save event. Please try again.');
    }
  };
  
  // PanResponder for swipe up/down gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Make vertical scrolling much more sensitive than horizontal
        const verticalThreshold = 3; // Very low threshold for vertical
        const horizontalThreshold = 50; // Higher threshold for horizontal
        
        const isVertical = Math.abs(gestureState.dy) > verticalThreshold;
        const isHorizontal = Math.abs(gestureState.dx) > horizontalThreshold;
        
        // Prioritize vertical gestures when in compact mode
        if (isMonthCompact) {
          // Make vertical gestures much more sensitive when event list is up
          // But still allow horizontal gestures if they're very deliberate
          const shouldRespond = isVertical && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2;
          console.log('🔄 [Calendar] PanResponder in compact mode:', { 
            isVertical, 
            isHorizontal, 
            dy: gestureState.dy, 
            dx: gestureState.dx, 
            shouldRespond 
          });
          return shouldRespond;
        }
        
        // Default behavior for expanded mode
        const shouldRespond = Math.abs(gestureState.dy) > 10;
        console.log('🔄 [Calendar] PanResponder in expanded mode:', { 
          dy: gestureState.dy, 
          shouldRespond 
        });
        return shouldRespond;
      },
      onPanResponderGrant: () => {
        console.log('🔄 [Calendar] PanResponder granted');
      },
      onPanResponderMove: (_, gestureState) => {
        console.log('🔄 [Calendar] PanResponder moving:', { dy: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        console.log('🔄 [Calendar] PanResponder released:', { dy: gestureState.dy });
        if (gestureState.dy < -20) {
          console.log('🔄 [Calendar] Swiping up - setting compact mode');
          setIsMonthCompact(true); // Swiped up
        } else if (gestureState.dy > 20) {
          console.log('🔄 [Calendar] Swiping down - setting expanded mode');
          setIsMonthCompact(false); // Swiped down
        }
      },
    })
  ).current;

  const renderMonth = ({ item }: { item: ReturnType<typeof getMonthData> }) => {
    const { year, month, days } = item;
    const needsSixRowsThisMonth = needsSixRows(year, month);

    // Helper function to check if a date belongs to the current month
    const isCurrentMonth = (date: Date) => {
      return date.getMonth() === month && date.getFullYear() === year;
    };

    return (
      <View style={{ width: SCREEN_WIDTH, flex: 1, paddingTop: 4, backgroundColor: 'white' }}>
        <View style={{ paddingHorizontal: SIDE_PADDING }}>
          <View style={styles.weekRow}>
            {weekdays.map((day, idx) => (
              <Text key={idx} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>

          <View
            style={[
              needsSixRowsThisMonth ? styles.gridSixRows : styles.grid,
              isMonthCompact && {
                ...styles.gridCompact,
                height: needsSixRowsThisMonth 
                  ? (getCellHeight(new Date(year, month), true) * 6) // Add buffer for margins and padding
                  : (getCellHeight(new Date(year, month), true) * 5), // Add buffer for margins and padding
              },
            ]}
          >
            {days.map((date, i) => {
              if (!date) return null;
              const dateKey = getLocalDateString(date);
              const dayEvents = (events[dateKey] || []) as CalendarEvent[];
              const hasEvents = dayEvents.length > 0;

              return (
                <View
                  key={i}
                  style={[
                    styles.cell,
                    isMonthCompact 
                      ? styles.cellCompact 
                      : needsSixRowsThisMonth 
                        ? styles.cellExpandedSixRows 
                        : styles.cellExpanded,
                    isSelected(date) && styles.selectedCell,
                    isToday(date) && styles.todayCell,
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => {
                      if (date) {
                        setIsMonthCompact(true);
                        setSelectedDate(date);
                      }
                    }}
                    onLongPress={() => {
                      setSelectedDate(date);
                      resetEventForm(date);
                      resetAllDayToggle(); // Reset all-day toggle for new events
                      setShowModal(true);
                    }}
                    style={styles.cellContent}
                  >
                    <View style={[
                      styles.dateContainer,
                      isToday(date) && styles.todayContainer,
                      isSelected(date) && styles.selectedContainer,
                    ]}>
                      <Text
                        style={[
                          styles.dateNumber,
                          !isCurrentMonth(date) && styles.adjacentMonthDate,
                          isToday(date) && styles.todayText,
                          isSelected(date) && styles.selectedText,
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                    </View>
                    {hasEvents && (
                      isMonthCompact ? (
                        // Compact view: show dots for regular events, titles for shared events
                        <View style={styles.eventDotsContainer}>
                          {dayEvents
                            .sort((a, b) => {
                              // Sort by start time, all-day events first
                              if (a.isAllDay && !b.isAllDay) return -1;
                              if (!a.isAllDay && b.isAllDay) return 1;
                              if (!a.startDateTime || !b.startDateTime) return 0;
                              return a.startDateTime.getTime() - b.startDateTime.getTime();
                            })
                            .slice(0, 3)
                            .map((event, index) => (
                              <TouchableOpacity
                                key={index}
                                onPress={() => {
                                  handleLongPress(event);
                                }}
                                onLongPress={() => handleLongPress(event)}
                              >
                                {event.isGoogleEvent ? (
                                  // Show Google Calendar dot for Google events
                                  <View
                                    style={[
                                      styles.googleEventDot,
                                      { 
                                        backgroundColor: event.calendarColor || '#4285F4'
                                      }
                                    ]}
                                  />
                                ) : event.isShared ? (
                                  // Show dot for shared events with different styles based on status
                                  <View
                                    style={[
                                      styles.eventDot,
                                      { 
                                                    backgroundColor: event.sharedStatus === 'pending' ? '#00ACC120' : '#00ACC1',
                                        borderWidth: event.sharedStatus === 'pending' ? 1 : 0,
            borderColor: event.sharedStatus === 'pending' ? '#00ACC1' : 'transparent'
                                      }
                                    ]}
                                  />
                                ) : (
                                  // Show dot for regular events
                                  <View
                                    style={[
                                      styles.eventDot,
                                      { 
                                        backgroundColor: event.categoryColor || '#00BCD4'
                                      }
                                    ]}
                                  />
                                )}
                              </TouchableOpacity>
                            ))}
                          {dayEvents.length > 3 && (
                            <View style={[styles.eventDot, { backgroundColor: '#00BCD4' }]} />
                          )}
                        </View>
                      ) : (
                        // Expanded view: show event containers with titles
                        <View style={calendarStyles.eventBox}>
                          {dayEvents
                            .sort((a, b) => {
                              // Sort by start time, all-day events first
                              if (a.isAllDay && !b.isAllDay) return -1;
                              if (!a.isAllDay && b.isAllDay) return 1;
                              if (!a.startDateTime || !b.startDateTime) return 0;
                              return a.startDateTime.getTime() - b.startDateTime.getTime();
                            })
                            .map((event, eventIndex) => {
                              
                              return (
                                <TouchableOpacity
                                  key={`${event.id}-${eventIndex}`}
                                  onPress={() => {
                                    handleLongPress(event);
                                  }}
                                  onLongPress={() => handleLongPress(event)}
                                  style={[
                                    calendarStyles.eventBoxText,
                                    {
                                      backgroundColor: event.isGoogleEvent 
                                        ? `${event.calendarColor || '#4285F4'}10` // More transparent calendar color background
                                        : event.isShared 
                                                      ? (event.sharedStatus === 'pending' ? '#00ACC120' : `${event.categoryColor || '#00BCD4'}30`) // Cyan for pending, normal for accepted
            : `${event.categoryColor || '#00BCD4'}30`, // Lighter background color
                                      borderWidth: event.isShared && event.sharedStatus === 'pending' ? 1 : (event.isGoogleEvent ? 1 : 0),
                                      borderColor: event.isShared && event.sharedStatus === 'pending' ? '#00ACC1' : (event.isGoogleEvent ? (event.calendarColor || '#4285F4') : 'transparent')
                                    }
                                  ]}
                                >
                                  <Text
                                    numberOfLines={1}
                                    style={[
                                      calendarStyles.eventText,
                                      { 
                                        color: event.isShared && event.sharedStatus === 'pending' ? '#00ACC1' : '#333',
                                        fontWeight: event.isShared && event.sharedStatus === 'pending' ? '600' : 'normal'
                                      }
                                    ]}
                                  >
                                    {event.title}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                        </View>
                      )
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const handleLongPress = async (event: CalendarEvent) => {
    try {
      console.log('🔍 [Edit Modal] Opening edit modal for event:', event.id);
      
      // Since multi-day events are now unified, use the event directly
      
      // Check if this is a shared event and if the current user is the owner
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('🔍 [Edit Modal] No user found');
        return;
      }
      
      // For shared events, check if the current user is the owner
      const isOwner = event.isShared && event.sharedBy === user.id;
      const isRecipient = event.isShared && event.sharedBy !== user.id;
      const hasValidStart = event.startDateTime instanceof Date && !isNaN(event.startDateTime.getTime());
      const hasValidEnd = event.endDateTime instanceof Date && !isNaN(event.endDateTime.getTime());
      
      if (isRecipient) {
        console.log('🔍 [Edit Modal] User is recipient of shared event, showing view-only modal');
        // For recipients, show a view-only modal with shared friends info
        await displaySharedEventDetails(event);
        return;
      }
      
      // Handle all events, not just custom ones
      setSelectedEvent({ event, dateKey: event.date, index: 0 });
      setEditingEvent(event);
      setEditedEventTitle(event.title);
      setEditedEventDescription(event.description ?? '');
      setEditedEventLocation(event.location ?? '');
      
      // Check if this is a multi-day event instance and get original dates
      const originalDates = getOriginalMultiDayDates(event);
      const startDateToUse = originalDates ? originalDates.startDate : event.startDateTime;
      const endDateToUse = originalDates ? originalDates.endDate : event.endDateTime;
      
      setEditedStartDateTime(getLocalDateForEdit(startDateToUse, event.isAllDay)!);
      setEditedEndDateTime(getLocalDateForEdit(endDateToUse, event.isAllDay)!);
      setEditedSelectedCategory(event.categoryName ? { name: event.categoryName, color: event.categoryColor! } : null);
      setEditedReminderTime(event.reminderTime ? new Date(event.reminderTime) : null);
      setEditedRepeatOption(event.repeatOption || 'None');
      setEditedRepeatEndDate(event.repeatEndDate ? new Date(event.repeatEndDate) : null);
      setCustomSelectedDates(event.customDates || []);
      setIsEditedAllDay(event.isAllDay || false);
      setEditedEventPhotos(event.photos || []);
      
      // Reset edit modal friends state first
      setEditSelectedFriends([]);
      setEditSearchFriend('');
      setEditIsSearchFocused(false);
      
      // Open the modal immediately
      setShowEditEventModal(true);
      
      // Fetch existing shared friends for this event (non-blocking)
      try {
        console.log('🔍 [Edit Modal] Fetching shared friends...');
        
        // For shared events, we need to extract the original event ID
        let eventIdToQuery = event.id;
        if (event.isShared && event.id.startsWith('shared_')) {
          // Extract the original event ID from the shared event ID
          // shared_123456-7890-abcdef -> 123456-7890-abcdef
          const sharedEventId = event.id.replace('shared_', '');
          console.log('🔍 [Edit Modal] Shared event detected, extracting original event ID:', sharedEventId);
          
          // For shared events, we need to find the original event ID from the shared_events table
          // Check both shared_by (for sent events) and shared_with (for received events)
          const { data: sharedEventData, error } = await supabase
            .from('shared_events')
            .select('original_event_id')
            .eq('id', sharedEventId)
            .or(`shared_by.eq.${user.id},shared_with.eq.${user.id}`)
            .single();
          
          if (!error && sharedEventData && sharedEventData.original_event_id) {
            eventIdToQuery = sharedEventData.original_event_id;
            console.log('🔍 [Edit Modal] Found original event ID:', eventIdToQuery);
          } else {
            // For sent pending events, the original_event_id might be null
            // In this case, we can use the shared event ID itself to find friends
            console.log('🔍 [Edit Modal] No original event ID found, using shared event ID for friend lookup');
            eventIdToQuery = sharedEventId; // Use the shared event ID directly
          }
        }
        
        // Determine if the current user is the recipient or owner of this shared event
        const isRecipient = event.isShared && event.sharedBy !== user.id;
        const sharedFriendIds = await fetchSharedFriendsForEvent(eventIdToQuery, isRecipient);
        console.log('🔍 [Edit Modal] Setting shared friends:', sharedFriendIds, 'isRecipient:', isRecipient);
        
        // Set the friends immediately
        setEditSelectedFriends(sharedFriendIds);
        
        // Add a small delay and log to verify the state was updated
        setTimeout(() => {
          console.log('🔍 [Edit Modal] Friends state should now be updated with:', sharedFriendIds);
        }, 100);
      } catch (error) {
        console.error('🔍 [Edit Modal] Error fetching shared friends, continuing without them:', error);
        // Continue without shared friends if there's an error
      }
      
    } catch (error) {
      console.error('🔍 [Edit Modal] Error in handleLongPress:', error);
      // Still try to open the modal even if there's an error
      setShowEditEventModal(true);
    }
  };




  // Add this function to handle time selection
  const handleTimeSelection = (selectedDate: Date | null | undefined, field: 'start' | 'end'): void => {
    if (!selectedDate || !editingTimeBoxId) return;

    const currentTimeBox = customDateTimes[editingTimeBoxId];
    if (!currentTimeBox) return;

    const newDate = new Date(currentTimeBox[field]);
    newDate.setHours(selectedDate.getHours());
    newDate.setMinutes(selectedDate.getMinutes());
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);

    // Create updated time box
    const updatedTimeBox = {
      ...currentTimeBox,
      [field]: newDate
    };

    // If updating start time and it's after end time, adjust end time
    if (field === 'start' && newDate > updatedTimeBox.end) {
      const newEnd = new Date(newDate);
      newEnd.setHours(newDate.getHours() + 1);
      updatedTimeBox.end = newEnd;
    }

    // Update the time box immediately
    setCustomDateTimes(prev => ({
      ...prev,
      [editingTimeBoxId]: updatedTimeBox
    }));
  };

  // Add a function to handle time box editing with proper return type
  const handleEditTimeBox = (timeBoxId: string, field: 'start' | 'end'): void => {
    setEditingTimeBoxId(timeBoxId);
    setCurrentEditingField(field);
    setIsTimePickerVisible(true);
  };

  // Add styles for the time box components

  // Update the time box rendering with proper styles
  {Object.entries(customDateTimes).map(([key, timeData]) => {
    if (key === 'default') return null;

    return (
      <View key={key} style={styles.timeBoxContainer}>
        <View style={styles.timeBoxHeader}>
          <Text style={styles.timeBoxDateText}>
            {timeData.dates.map(date => new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' })).join(', ')}
          </Text>
          <TouchableOpacity
            onPress={() => {
              const updatedTimes = { ...customDateTimes };
              const datesToRemove = timeData.dates;
              delete updatedTimes[key];
              setCustomDateTimes(updatedTimes);
              setCustomSelectedDates(prev => prev.filter(date => !datesToRemove.includes(date)));
            }}
            style={{ padding: 4 }}
          >
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.timeBoxTimeContainer}>
          <TouchableOpacity
            onPress={() => handleEditTimeBox(key, 'start')}
            style={styles.timeBoxTimeButton}
          >
            <Text style={styles.timeBoxTimeLabel}>Start</Text>
            <Text style={styles.timeBoxTimeValue}>
              {timeData.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleEditTimeBox(key, 'end')}
            style={styles.timeBoxTimeButton}
          >
            <Text style={styles.timeBoxTimeLabel}>End</Text>
            <Text style={styles.timeBoxTimeValue}>
              {timeData.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        </View>

        {isTimePickerVisible && editingTimeBoxId === key && (
          <View style={styles.timeBoxPickerContainer}>
            <Text style={styles.timeBoxPickerLabel}>
              {currentEditingField === 'start' ? 'Set Start Time' : 'Set End Time'}
            </Text>
            <DateTimePicker
              value={timeData[currentEditingField]}
              mode="time"
              display="spinner"
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  handleTimeSelection(selectedDate, currentEditingField);
                }
              }}
              style={{ height: 150 }}
              textColor="#333"
            />
            <TouchableOpacity
              onPress={() => handleTimeBoxSave(key)}
              style={styles.timeBoxDoneButton}
            >
              <Text style={styles.timeBoxDoneButtonText}>Save & Select Dates</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  })}

  {/* Add Custom Time Button */}
  {!isTimePickerVisible && (
    <TouchableOpacity
      onPress={() => {
        const timeBoxKey = `time_${Date.now()}`;
        const currentTime = new Date();
        const newTimeBox: CustomTimeData = {
          start: new Date(currentTime),
          end: new Date(currentTime.getTime() + 60 * 60 * 1000),
          reminder: null,
          repeat: 'None',
          dates: []
        };

        setCustomDateTimes(prev => ({
          ...prev,
          [timeBoxKey]: newTimeBox
        }));

        setEditingTimeBoxId(timeBoxKey);
        setCurrentEditingField('start');
        setIsTimePickerVisible(true);
      }}
      style={styles.timeBoxAddButton}
    >
      <Text style={styles.timeBoxAddButtonText}>Add Time</Text>
    </TouchableOpacity>
  )}

  const handleEditEvent = async () => {
    console.log('🔍 [Edit Event] Starting handleEditEvent');
    if (!selectedEvent) {
      console.log('🔍 [Edit Event] No selectedEvent, returning');
      return;
    }
    if (!editedEventTitle.trim()) {
      console.log('🔍 [Edit Event] No title, showing alert');
      Alert.alert('Error', 'Please enter a title for the event');
      return;
    }

    try {
      console.log('🔍 [Edit Event] Entering try block');
      // Add a small delay to ensure state updates are processed
      await new Promise(resolve => setTimeout(resolve, 100));
      const originalEvent = selectedEvent.event;
      console.log('🔍 [Edit Event] Original event:', originalEvent);
      
      // Extract the base event ID if this is a multi-day event instance
      let baseEventId = originalEvent.id;
      const eventParts = originalEvent.id.split('_');
      const eventIsMultiDayInstance = eventParts.length >= 2 && !!eventParts[eventParts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/);
      console.log('🔍 [Edit Event] Event ID analysis:', { 
        originalId: originalEvent.id, 
        eventParts, 
        eventIsMultiDayInstance,
        isShared: originalEvent.isShared 
      });
      if (eventIsMultiDayInstance) {
        baseEventId = eventParts.slice(0, -1).join('_');
        console.log('🔍 [Edit Event] Multi-day instance detected. Original ID:', originalEvent.id, 'Base ID:', baseEventId);
      }
      
      // Step 1: Handle shared events differently
      let existingEvents: any[] = [];
      let originalEventId: string | null = null;
      let isPendingSharedEvent = false;
      let sharedEventId: string | null = null;
      
      if (originalEvent.isShared) {
        console.log('🔍 [Edit Event] Editing shared event:', originalEvent.id);
        
        // For shared events, check if it's in the events table or shared_events table
        if (originalEvent.id.startsWith('shared_')) {
          // This is a shared event ID, extract the actual shared event ID
          sharedEventId = originalEvent.id.replace('shared_', '');
          console.log('🔍 [Edit Event] Extracted shared event ID:', sharedEventId);
          
          // First, try to find it in the shared_events table
          const { data: sharedEventData, error: sharedError } = await supabase
            .from('shared_events')
            .select('*')
            .eq('id', sharedEventId)
            .or(`shared_by.eq.${user?.id},shared_with.eq.${user?.id}`)
            .single();
          
          console.log('🔍 [Edit Event] Shared event query result:', { sharedEventData, sharedError });
          
          if (!sharedError && sharedEventData) {
            console.log('🔍 [Edit Event] Found shared event in shared_events table');
            console.log('🔍 [Edit Event] Shared event data:', sharedEventData);
            
            // If the event has original_event_id, it means it was accepted and moved to events table
            if (sharedEventData.original_event_id) {
              console.log('🔍 [Edit Event] Accepted shared event, finding in events table');
              // Find the actual event in the events table
              const { data: eventData, error: eventError } = await supabase
                .from('events')
                .select('*')
                .eq('id', sharedEventData.original_event_id)
                .single();
              
              if (!eventError && eventData) {
                existingEvents = [eventData];
                originalEventId = eventData.id;
                console.log('🔍 [Edit Event] Found accepted event in events table:', eventData.id);
              } else {
                // The original event was deleted but shared event still exists
                // Treat this as a pending shared event that needs to be updated
                console.log('🔍 [Edit Event] Original event was deleted, treating as pending shared event');
                isPendingSharedEvent = true;
              }
            } else {
              // This is a pending shared event - we'll update it in shared_events table
              console.log('🔍 [Edit Event] Pending shared event detected, will update in shared_events table');
              isPendingSharedEvent = true;
            }
          } else {
            console.log('🔍 [Edit Event] Could not find shared event in shared_events table:', sharedError);
          }
        } else {
          // This is a regular event ID, find it in the events table
          const { data: eventData, error: eventError } = await supabase
            .from('events')
            .select('*')
            .eq('id', baseEventId)
            .eq('user_id', user?.id)
            .single();
          
          if (!eventError && eventData) {
            existingEvents = [eventData];
            originalEventId = eventData.id;
          }
        }
      } else {
        // For regular events, find in events table
        const { data: eventsData, error: findError } = await supabase
        .from('events')
        .select('*')
        .eq('title', originalEvent.title)
          .eq('user_id', user?.id)
          .or(`id.eq.${baseEventId},date.eq.${originalEvent.date}`);

      if (findError) {
        throw new Error('Failed to find event in database');
      }

        if (eventsData && eventsData.length > 0) {
          existingEvents = eventsData;
          originalEventId = eventsData[0].id;
        }
      }

      // If we still don't have the event and it's not a pending shared event, throw error
      console.log('🔍 [Edit Event] Final check - existingEvents.length:', existingEvents.length, 'isPendingSharedEvent:', isPendingSharedEvent);
      if (existingEvents.length === 0 && !isPendingSharedEvent) {
        console.log('🔍 [Edit Event] Throwing error - event not found in database');
        throw new Error('Event not found in database');
      }

      // Step 2: Fetch existing shared friends BEFORE deleting the original event
      let existingSharedFriends: string[] = [];
      if (isPendingSharedEvent && sharedEventId) {
        // For pending shared events, fetch friends from the shared_events table
        console.log('🔍 [Edit Event] Fetching shared friends for pending shared event');
        const { data: sharedEventData, error: sharedError } = await supabase
          .from('shared_events')
          .select('shared_with')
          .eq('id', sharedEventId)
          .eq('shared_by', user?.id);
        
        if (!sharedError && sharedEventData && sharedEventData.length > 0) {
          existingSharedFriends = sharedEventData.map((se: { shared_with: string }) => se.shared_with);
          console.log('🔍 [Edit Event] Found existing shared friends for pending event:', existingSharedFriends);
        }
      } else if (originalEventId) {
        existingSharedFriends = await fetchSharedFriendsForEvent(originalEventId);
      console.log('🔍 [Edit Event] Found existing shared friends:', existingSharedFriends);
      } else if (sharedEventId) {
        // Fallback: if we have a shared event ID but no original event ID, fetch friends from shared_events
        console.log('🔍 [Edit Event] Fallback: fetching friends from shared_events table');
        const { data: sharedEventData, error: sharedError } = await supabase
          .from('shared_events')
          .select('shared_with')
          .eq('id', sharedEventId)
          .eq('shared_by', user?.id);
        
        if (!sharedError && sharedEventData && sharedEventData.length > 0) {
          existingSharedFriends = sharedEventData.map((se: { shared_with: string }) => se.shared_with);
          console.log('🔍 [Edit Event] Found existing shared friends via fallback:', existingSharedFriends);
        }
      }

      // Step 3: Delete all matching events (only if they exist)
      if (existingEvents.length > 0) {
      const eventIds = existingEvents.map(e => e.id);
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .in('id', eventIds);

      if (deleteError) {
        throw new Error('Failed to delete original event');
      }

      // Step 4: Verify deletion by trying to find the events again
      const { data: verifyEvents, error: verifyError } = await supabase
        .from('events')
        .select('id')
        .in('id', eventIds);

      if (!verifyError && verifyEvents && verifyEvents.length > 0) {
        throw new Error('Events were not properly deleted');
        }
      }

      // Step 5: Remove from local state (only for regular events, not pending shared events)
      if (!isPendingSharedEvent) {
      setEvents(prev => {
        const updated = { ...prev };
          let eventFound = false;
        Object.keys(updated).forEach(date => {
            const beforeCount = updated[date].length;
          updated[date] = updated[date].filter(e => e.id !== originalEvent.id);
            if (updated[date].length !== beforeCount) {
              eventFound = true;
            }
          if (updated[date].length === 0) {
            delete updated[date];
          }
        });
          if (!eventFound) {
            console.log('🔍 [Edit Event] Event not found in local state, continuing...');
          }
        return updated;
      });
      } else {
        console.log('🔍 [Edit Event] Skipping local state removal for pending shared event');
      }

      // Step 6: Handle pending shared events differently
      console.log('🔍 [Edit Event] Step 6 - isPendingSharedEvent:', isPendingSharedEvent, 'sharedEventId:', sharedEventId);
      if (isPendingSharedEvent && sharedEventId) {
        console.log('🔍 [Edit Event] Updating pending shared event in shared_events table');
        
        // Create updated event data for the shared_events table
        const updatedEventData = {
          title: editedEventTitle,
          description: editedEventDescription || '',
          location: editedEventLocation || '',
          date: getLocalDateString(editedStartDateTime),
          start_datetime: editedStartDateTime.toISOString(),
          end_datetime: editedEndDateTime.toISOString(),
          category_name: editedSelectedCategory?.name || null,
          category_color: editedSelectedCategory?.color || null,
          reminder_time: editedReminderTime ? editedReminderTime.toISOString() : null,
          repeat_option: editedRepeatOption,
          repeat_end_date: editedRepeatEndDate ? editedRepeatEndDate.toISOString() : null,
          custom_dates: editedRepeatOption === 'Custom' ? customSelectedDates : null,
          custom_times: editedRepeatOption === 'Custom' ? customDateTimes : null,
          is_all_day: isEditedAllDay,
          photos: editedEventPhotos,
        };
        
        // Update the shared event in the shared_events table
        const { error: updateError } = await supabase
          .from('shared_events')
          .update({ event_data: updatedEventData })
          .eq('id', sharedEventId);
        
        if (updateError) {
          throw new Error('Failed to update pending shared event');
        }
        
        console.log('🔍 [Edit Event] Successfully updated pending shared event');
        
        // Handle friend updates for pending shared events
        // For pending shared events, we only update the event_data, not the sharing relationships
        // The sharing relationships should remain as they were when originally created
        console.log('🔍 [Edit Event] Updating event data for pending shared event, preserving sharing relationships');
        
        // Note: We don't modify the sharing relationships here because:
        // 1. The event is already shared with the intended recipients
        // 2. Changing recipients would require complex logic to handle acceptances/declines
        // 3. It's safer to preserve the original sharing intent
        
        // Refresh the main calendar events to include the updated pending shared event
        await fetchEvents();
        
        // Update local state for shared events (for the modal)
        updatePendingSharedEvents();
        
        // Clear edit selected friends after sharing
        setEditSelectedFriends([]);
        setEditSearchFriend('');
        setEditIsSearchFocused(false);
        
        // Close modal and show success message
        setShowEditEventModal(false);
        setEditingEvent(null);
        setSelectedEvent(null);
        
        Toast.show({
          type: 'success',
          text1: 'Shared event updated successfully',
          position: 'bottom',
        });
        
        return; // Exit early for pending shared events
      }
      
      // For regular events, create the new event data
      const newEventData = {
        title: editedEventTitle,
        description: editedEventDescription || '',
        location: editedEventLocation || '',
        date: getLocalDateString(editedStartDateTime),
        start_datetime: editedStartDateTime.toISOString(),
        end_datetime: editedEndDateTime.toISOString(),
        category_name: editedSelectedCategory?.name || null,
        category_color: editedSelectedCategory?.color || null,
        reminder_time: editedReminderTime ? editedReminderTime.toISOString() : null,
        repeat_option: editedRepeatOption,
        repeat_end_date: editedRepeatEndDate ? editedRepeatEndDate.toISOString() : null,
        custom_dates: editedRepeatOption === 'Custom' ? customSelectedDates : null,
        custom_times: editedRepeatOption === 'Custom' ? customDateTimes : null,
        is_all_day: isEditedAllDay,
        photos: editedEventPhotos,
        user_id: user?.id
      };

      // Step 7: Insert the new event
      const { data: insertedEvent, error: insertError } = await supabase
        .from('events')
        .insert([newEventData])
        .select()
        .single();

      if (insertError) {
        throw new Error('Failed to save edited event');
      }

      // Step 8: Update local state with new event
      const newEvent: CalendarEvent = {
        id: insertedEvent.id,
        title: insertedEvent.title,
        description: insertedEvent.description,
        location: insertedEvent.location,
        date: insertedEvent.date,
        startDateTime: insertedEvent.start_datetime ? new Date(insertedEvent.start_datetime) : undefined,
        endDateTime: insertedEvent.end_datetime ? new Date(insertedEvent.end_datetime) : undefined,
        categoryName: insertedEvent.category_name,
        categoryColor: insertedEvent.category_color,
        reminderTime: insertedEvent.reminder_time ? new Date(insertedEvent.reminder_time) : null,
        repeatOption: insertedEvent.repeat_option,
        repeatEndDate: insertedEvent.repeat_end_date ? new Date(insertedEvent.repeat_end_date) : null,
        customDates: insertedEvent.custom_dates,
        customTimes: insertedEvent.custom_times,
        isAllDay: insertedEvent.is_all_day,
        photos: insertedEvent.photos || []
      };

      // Helper function to check if event is multi-day
      const isMultiDayEvent = (event: CalendarEvent): boolean => {
        if (!event.startDateTime || !event.endDateTime) return false;
        const startDate = new Date(event.startDateTime);
        const endDate = new Date(event.endDateTime);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        return startDate.getTime() !== endDate.getTime();
      };

      setEvents(prev => {
        const updated = { ...prev };
        
        // Check if this is a multi-day event first
        if (isMultiDayEvent(newEvent)) {
          console.log('🔍 [Edit Event] Processing multi-day event in local state update:', newEvent.title);
          
          // FIRST: Remove ALL instances of the original event from ALL dates
          console.log('🗑️ [Edit Event] Removing all instances of original event. Base ID:', baseEventId);
          Object.keys(updated).forEach(dateKey => {
            updated[dateKey] = updated[dateKey].filter(e => {
              // Check if this is the original event we're editing
              if (e.id === baseEventId) {
                console.log('🗑️ [Edit Event] Removing original event from date:', dateKey);
                return false; // Remove the original event
              }
              
              // Check if this is an instance of the original event
              const eventParts = e.id.split('_');
              const eventIsMultiDayInstance = eventParts.length >= 2 && !!eventParts[eventParts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/);
              if (eventIsMultiDayInstance) {
                const eventBaseId = eventParts.slice(0, -1).join('_');
                if (eventBaseId === baseEventId) {
                  console.log('🗑️ [Edit Event] Removing instance of original event from date:', dateKey, 'Instance ID:', e.id);
                  return false; // Remove instances of the original event
                }
              }
              
              return true; // Keep other events
            });
          });
          
          // SECOND: Add new instances for the new date range
          const startDate = new Date(newEvent.startDateTime!);
          const endDate = new Date(newEvent.endDateTime!);
          
          // Reset times to compare only dates
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          
          // Create separate event instances for each day in the range
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            const dateKey = getLocalDateString(currentDate);
            
            if (!updated[dateKey]) {
              updated[dateKey] = [];
            }
            
            // Create a separate event instance for this specific date
            const eventInstance = {
              ...newEvent,
              id: `${newEvent.id}_${dateKey}`, // Unique ID for each day
              date: dateKey,
              // Adjust start/end times for this specific day
              startDateTime: new Date(currentDate),
              endDateTime: new Date(currentDate),
            };
            
            // Preserve the time from the original event
            if (newEvent.startDateTime && newEvent.endDateTime) {
              const originalStart = new Date(newEvent.startDateTime);
              const originalEnd = new Date(newEvent.endDateTime);
              
              if (newEvent.isAllDay) {
                // For all-day events, set to 12:00 PM and 1:00 PM UTC respectively
                eventInstance.startDateTime.setUTCHours(12, 0, 0, 0);
                eventInstance.endDateTime.setUTCHours(13, 0, 0, 0);
              } else {
                // For regular events, preserve the original time
                eventInstance.startDateTime.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds());
                eventInstance.endDateTime.setHours(originalEnd.getHours(), originalEnd.getMinutes(), originalEnd.getSeconds());
              }
            }
            
            updated[dateKey].push(eventInstance);
            console.log('✅ [Edit Event] Added new multi-day event instance to date:', dateKey, 'Event:', newEvent.title);
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
        } else if (newEvent.customDates && newEvent.customDates.length > 0) {
          // For custom events (that are NOT multi-day), add to all custom dates
          newEvent.customDates.forEach(date => {
            if (!updated[date]) {
              updated[date] = [];
            }
            updated[date] = updated[date].filter(e => e.id !== newEvent.id);
            updated[date].push(newEvent);
          });
        } else {
          // For regular single-day events, add to the primary date
        const dateKey = newEvent.date;
        if (!updated[dateKey]) {
          updated[dateKey] = [];
        }
          updated[dateKey] = updated[dateKey].filter(e => e.id !== newEvent.id);
        updated[dateKey].push(newEvent);
        }
        
        return updated;
      });

      // Update originalEvents state for the new multi-day event
      if (isMultiDayEvent(newEvent)) {
        setOriginalEvents(prev => ({ ...prev, [newEvent.id]: newEvent }));
      }

      // Step 9: Cancel old notifications and schedule new ones
      await cancelEventNotification(originalEvent.id);
      if (newEvent.reminderTime) {
        await scheduleEventNotification(newEvent);
      }

      // Step 10: Re-share with existing friends and any newly selected friends
      const allFriendsToShare = [...new Set([...existingSharedFriends, ...editSelectedFriends])];
      if (allFriendsToShare.length > 0) {
        console.log('🔍 [Edit Event] Sharing with friends:', allFriendsToShare);
        
        // Temporarily set the selected friends to the ones we want to share with
        const originalSelectedFriends = [...selectedFriends];
        setSelectedFriends(allFriendsToShare);
        
        // Share with all friends (existing + newly selected)
        const shareResult = await shareEventWithSelectedFriends(insertedEvent.id);
        
        // Restore original selected friends
        setSelectedFriends(originalSelectedFriends);
        
        // If sharing was successful, we don't need to refresh since we've already updated local state
        // The shared event will be visible in the UI through the local state update
        if (shareResult) {
          console.log('🔍 [Edit Event] Sharing successful, local state already updated');
        }
        
        // Clear edit selected friends after sharing
        setEditSelectedFriends([]);
        setEditSearchFriend('');
        setEditIsSearchFocused(false);
      }

      // Step 11: Close modal and show success message
      setShowEditEventModal(false);
      setEditingEvent(null);
      setSelectedEvent(null);

      Toast.show({
        type: 'success',
        text1: 'Event updated successfully',
        position: 'bottom',
      });

    } catch (error) {
      console.error('🔍 [Edit Event] Error editing event:', error);
      Alert.alert('Error', 'Failed to edit event. Please try again.');
    }
  };

  // Add new state for the time box calendar picker
  const [selectedTimeBoxForCalendar, setSelectedTimeBoxForCalendar] = useState<string | null>(null);

  // Add function to handle time box save and show calendar
  const handleTimeBoxSave = (timeBoxId: string): void => {
    setIsTimePickerVisible(false);
    setEditingTimeBoxId(null);
  };

  // 2. Update the Reminder row in the options card
  const [reminderOffset, setReminderOffset] = useState<number>(-1);
  const [showReminderOptions, setShowReminderOptions] = useState(false);

  // Add real-time subscription to events
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Only refresh for INSERT operations (new events) or UPDATE operations
          // Skip DELETE operations to avoid bringing back deleted events
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            console.log('🔄 [Real-time] Event change detected:', payload.eventType, 'refreshing events');
            fetchEvents();
          } else if (payload.eventType === 'DELETE') {
            console.log('🔄 [Real-time] Event deletion detected, skipping refresh to preserve local state');
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // Initialize notifications when component mounts
  useEffect(() => {
    const initNotifications = async () => {
      await initializeNotifications();
    };
    
    initNotifications();
  }, []);

  // Add notification listeners (only for logging, no toast messages)
  useEffect(() => {
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 [Notifications] Notification received:', notification);
      // No toast message - let the system show the notification banner
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('🔔 [Notifications] Notification response received:', response);
      
      // Handle shared event notifications
      const notificationData = response.notification.request.content.data;
      if (notificationData?.type === 'event_shared') {
        console.log('🔔 [Notifications] Handling shared event notification:', notificationData);
        // Refresh events to show the new shared event
        fetchEvents();
        // Show shared events modal
        setShowSharedEventsModal(true);
        setActiveSharedEventsTab('received');
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  // Add a function to handle database connection issues
  const handleDatabaseError = (error: any) => {
    // Check if it's an authentication error
    if (error?.message?.includes('JWT') || error?.message?.includes('auth')) {
      Alert.alert(
        'Authentication Error',
        'Please log in again to continue using the calendar.',
        [
          {
            text: 'OK',
            onPress: () => {
              // You might want to redirect to login here
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'Connection Error',
        'Unable to connect to the database. Please check your internet connection and try again.',
        [
          {
            text: 'Retry',
            onPress: () => fetchEvents()
          },
          {
            text: 'OK',
            style: 'cancel'
          }
        ]
      );
    }
  };

  // Add session check and refresh mechanism
  const checkAndRefreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        return false;
      }

      if (!session) {
        return false;
      }

      // Check if session is expired or about to expire
      const now = new Date();
      const expiresAt = new Date(session.expires_at! * 1000);
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();

      // If session expires in less than 5 minutes, refresh it
      if (timeUntilExpiry < 5 * 60 * 1000) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          return false;
        }

        if (refreshData.session) {
          return true;
        } else {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  };

  // Add a simple authentication test function
  const testAuthentication = async () => {
    try {
      // Test 1: Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      // Test 2: Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Test 3: Try a simple database query
      if (user?.id) {
        const { data: testData, error: testError } = await supabase
          .from('events')
          .select('count')
          .eq('user_id', user.id)
          .limit(1);
        
        if (testError) {
          return false;
        } else {
          return true;
        }
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  };

  // Add useEffect to focus the title input when modal opens
  useEffect(() => {
    if (showModal) {
      // Add a small delay to ensure the modal is fully rendered
      const timer = setTimeout(() => {
        eventTitleInputRef.current?.focus();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [showModal]);

  useFocusEffect(
    useCallback(() => {
      // Only refresh events if we don't have any events loaded yet
      // This prevents overwriting local state changes like deletions
      if (Object.keys(events).length === 0) {
        console.log('🔄 [Calendar] No events loaded, refreshing on focus');
        fetchEvents();
      } else {
        console.log('🔄 [Calendar] Events already loaded, skipping refresh on focus');
      }
    }, [events])
  );

  // Remove automatic rescheduling to prevent duplicate notifications
  // Notifications are now only scheduled when events are created or edited

  // Add a function to check notification settings
  const checkNotificationSettings = async () => {
    try {
      console.log('🔔 [Notifications] Checking notification settings...');
      
      // Check permissions
      const { status } = await Notifications.getPermissionsAsync();
      console.log('🔔 [Notifications] Permission status:', status);
      
      // Get scheduled notifications
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      console.log('🔔 [Notifications] Scheduled notifications:', scheduledNotifications.length);
      
      // Log each scheduled notification
      scheduledNotifications.forEach((notification, index) => {
        console.log(`🔔 [Notifications] Notification ${index + 1}:`, {
          id: notification.identifier,
          title: notification.content.title,
          body: notification.content.body,
          trigger: notification.trigger,
          data: notification.content.data
        });
      });
      
      // Get presented notifications
      const presentedNotifications = await Notifications.getPresentedNotificationsAsync();
      console.log('🔔 [Notifications] Presented notifications:', presentedNotifications.length);
      
      // Show summary in toast
      Toast.show({
        type: 'info',
        text1: 'Notification Status',
        text2: `Permissions: ${status}, Scheduled: ${scheduledNotifications.length}, Presented: ${presentedNotifications.length}`,
        position: 'bottom',
      });
      
    } catch (error) {
      console.error('🔔 [Notifications] Error checking settings:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to check notification settings',
        position: 'bottom',
      });
    }
  };

  // Photo-related functions
  const uploadEventPhoto = async (photoUri: string, eventId: string, isPrivate: boolean = false): Promise<{ url: string; isPrivate: boolean }> => {
    try {
      // First, let's check if the file exists and get its info
      const fileInfo = await FileSystem.getInfoAsync(photoUri);
      
      if (!fileInfo.exists) {
        throw new Error('Photo file does not exist');
      }
      
      // Create a unique filename with events category
      const fileExt = photoUri.split('.').pop() || 'jpg';
      const safeEventId = eventId || `temp_${Date.now()}`;
      const fileName = `events/${safeEventId}/event_${Date.now()}.${fileExt}`;
      
      // Read the file as base64
      const base64Data = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      if (base64Data.length === 0) {
        throw new Error('Base64 data is empty');
      }
      
      // Convert base64 to Uint8Array for React Native compatibility
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Upload to Supabase Storage using Uint8Array
      const { data, error: uploadError } = await supabase.storage
        .from('memories')
        .upload(fileName, bytes, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('memories')
        .getPublicUrl(fileName);

      return { url: publicUrl, isPrivate };
    } catch (error) {
      throw error;
    }
  };

  const handleEventPhotoPicker = async (source: 'camera' | 'library', eventId?: string) => {
    try {
      let permissionGranted = false;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        permissionGranted = status === 'granted';
        if (!permissionGranted) {
          Alert.alert('Permission Required', 'Camera permission is required to take a photo.');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        permissionGranted = status === 'granted';
        if (!permissionGranted) {
          Alert.alert('Permission Required', 'Media library permission is required to select an image.');
          return;
        }
      }

      let result;
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setIsUploadingPhoto(true);
        try {
          const photoData = await uploadEventPhoto(result.assets[0].uri, eventId || 'temp', isPhotoPrivate);
          
          // Get event details for sharing
          let eventTitle = 'Event';
          let eventIdForSharing: string;
          
          if (eventId) {
            eventIdForSharing = eventId;
            const event = Object.values(events).flat().find(e => e.id === eventId);
            if (event) {
              eventTitle = event.title;
            }
            await updateEventPhoto(eventId, photoData.url, photoData.isPrivate);
          } else {
            // For new events, we need to save the event first to get a proper ID
            // For now, we'll skip sharing for new events until they're saved
            eventIdForSharing = 'temp_' + Date.now();
            setEventPhotos(prev => [...prev, photoData.url]);
            setPhotoPrivacyMap(prev => ({ ...prev, [photoData.url]: photoData.isPrivate }));
            
            Toast.show({
              type: 'info',
              text1: 'Photo added to event',
              text2: 'Save the event to share the photo with friends',
              position: 'bottom',
            });
            return; // Don't proceed with sharing for unsaved events
          }

          // Show success message for saved events
          if (user?.id && eventId) {
            const privacyText = photoData.isPrivate ? ' (Private)' : '';
            
            // If the photo is not private, show caption modal for sharing
            if (!photoData.isPrivate) {
              // Get event details for sharing
              const event = Object.values(events).flat().find(e => e.id === eventId);
              const eventTitle = event?.title || 'Event';
              
              // Set up photo for caption modal
              setPhotoForCaption({
                url: photoData.url,
                eventId: eventId,
                eventTitle: eventTitle
              });
              setShowCaptionModal(true);
            } else {
            Toast.show({
              type: 'success',
              text1: `Photo added to event${privacyText}`,
                text2: 'This photo is private and only visible to you',
              position: 'bottom',
            });
            }
          } else {
            Toast.show({
              type: 'success',
              text1: 'Photo added successfully',
              position: 'bottom',
            });
          }
          
          // Close the Swipeable component after adding photo
          if (eventId && swipeableRefs.current[eventId]) {
            setTimeout(() => {
              swipeableRefs.current[eventId].close();
            }, 100);
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to upload photo. Please try again.');
        } finally {
          setIsUploadingPhoto(false);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image. Please try again.');
      setIsUploadingPhoto(false);
    }
  };

  const handleCaptionSave = async (caption: string) => {
    if (!photoForCaption || !user?.id) return;
    
    setIsSharingPhoto(true);
    try {
      // Create social update with caption
      const { error: socialError } = await supabase
        .from('social_updates')
        .insert({
          user_id: user.id,
          type: 'photo_share',
          photo_url: photoForCaption.url,
          caption: caption,
          source_type: 'event',
          source_id: photoForCaption.eventId,
          is_public: true,
          content: {
            title: photoForCaption.eventTitle,
            photo_url: photoForCaption.url
          }
        });

      if (socialError) {
        console.error('Error creating social update:', socialError);
        throw socialError;
      }
      
      Toast.show({
        type: 'success',
        text1: 'Photo shared with friends!',
        text2: caption ? `"${caption}"` : '',
        position: 'bottom',
      });
      
      setShowCaptionModal(false);
      setPhotoForCaption(null);
    } catch (error) {
      console.error('Error sharing photo:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to share photo',
        text2: 'Please try again',
        position: 'bottom',
      });
    } finally {
      setIsSharingPhoto(false);
    }
  };

  const handleCaptionCancel = () => {
    setShowCaptionModal(false);
    setPhotoForCaption(null);
    Toast.show({
      type: 'info',
      text1: 'Photo added to event',
      text2: 'You can share it later from the event details',
      position: 'bottom',
    });
  };

  const updateEventPhoto = async (eventId: string, photoUrl: string, isPrivate: boolean = false) => {
    try {
      // Get the current event to see existing photos and private photos
      const { data: currentEvent, error: fetchError } = await supabase
        .from('events')
        .select('photos, private_photos')
        .eq('id', eventId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Append the new photo to existing photos
      const currentPhotos = currentEvent?.photos || [];
      const currentPrivatePhotos = currentEvent?.private_photos || [];
      
      let updatedPhotos = [...currentPhotos];
      let updatedPrivatePhotos = [...currentPrivatePhotos];

      if (isPrivate) {
        // Add to private photos and remove from regular photos if it exists
        updatedPrivatePhotos = [...updatedPrivatePhotos, photoUrl];
        updatedPhotos = updatedPhotos.filter(photo => photo !== photoUrl);
      } else {
        // Add to regular photos and remove from private photos if it exists
        updatedPhotos = [...updatedPhotos, photoUrl];
        updatedPrivatePhotos = updatedPrivatePhotos.filter(photo => photo !== photoUrl);
      }

      const { error } = await supabase
        .from('events')
        .update({ 
          photos: updatedPhotos,
          private_photos: updatedPrivatePhotos
        })
        .eq('id', eventId);

      if (error) {
        throw error;
      }

      // Update local state - combine both arrays for display
      const allPhotos = [...updatedPhotos, ...updatedPrivatePhotos];
      setEvents(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(date => {
          updated[date] = updated[date].map(event => 
            event.id === eventId ? { ...event, photos: allPhotos } : event
          );
        });
        return updated;
      });
      
      // Close the Swipeable component after updating photo
      if (swipeableRefs.current[eventId]) {
        setTimeout(() => {
          swipeableRefs.current[eventId].close();
        }, 100);
      }
      
      // Refresh events to ensure UI is updated
      setTimeout(() => {
        fetchEvents();
      }, 500);
    } catch (error) {
      throw error;
    }
  };

  const showEventPhotoOptions = (eventId?: string) => {
    setSelectedEventForPhoto(eventId);
    setIsPhotoPrivate(false);
    setShowCustomPhotoModal(true);
  };

  const removeEventPhoto = async (eventId: string, photoUrlToRemove: string) => {
    try {
      // Get the current event to see existing photos and private photos
      const { data: currentEvent, error: fetchError } = await supabase
        .from('events')
        .select('photos, private_photos')
        .eq('id', eventId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Remove the specific photo from both arrays
      const currentPhotos = currentEvent?.photos || [];
      const currentPrivatePhotos = currentEvent?.private_photos || [];
      
      const updatedPhotos = currentPhotos.filter((photo: string) => photo !== photoUrlToRemove);
      const updatedPrivatePhotos = currentPrivatePhotos.filter((photo: string) => photo !== photoUrlToRemove);

      const { error } = await supabase
        .from('events')
        .update({ 
          photos: updatedPhotos,
          private_photos: updatedPrivatePhotos
        })
        .eq('id', eventId);

      if (error) {
        throw error;
      }

      // Remove the photo from friends feed (social_updates table)
      if (user?.id) {
        await removePhotoFromFriendsFeed(user.id, 'event', eventId, photoUrlToRemove);
      }

      // Update local state - combine both arrays for display
      const allUpdatedPhotos = [...updatedPhotos, ...updatedPrivatePhotos];
      setEvents(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(date => {
          updated[date] = updated[date].map(event => 
            event.id === eventId ? { ...event, photos: allUpdatedPhotos } : event
          );
        });
        return updated;
      });
      
      Toast.show({
        type: 'success',
        text1: 'Photo removed successfully',
        position: 'bottom',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to remove photo. Please try again.');
    }
  };

  // Custom delete function for photo viewer modal
  const handlePhotoViewerDelete = async (eventId: string, photoUrlToRemove: string) => {
    try {
      // Get the current event to see existing photos and private photos
      const { data: currentEvent, error: fetchError } = await supabase
        .from('events')
        .select('photos, private_photos')
        .eq('id', eventId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Remove the specific photo from both arrays
      const currentPhotos = currentEvent?.photos || [];
      const currentPrivatePhotos = currentEvent?.private_photos || [];
      
      const updatedPhotos = currentPhotos.filter((photo: string) => photo !== photoUrlToRemove);
      const updatedPrivatePhotos = currentPrivatePhotos.filter((photo: string) => photo !== photoUrlToRemove);

      const { error } = await supabase
        .from('events')
        .update({ 
          photos: updatedPhotos,
          private_photos: updatedPrivatePhotos
        })
        .eq('id', eventId);

      if (error) {
        throw error;
      }

      // Remove the photo from friends feed (social_updates table)
      if (user?.id) {
        await removePhotoFromFriendsFeed(user.id, 'event', eventId, photoUrlToRemove);
      }

      // Update local state - combine both arrays for display
      const allUpdatedPhotos = [...updatedPhotos, ...updatedPrivatePhotos];
      setEvents(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(date => {
          updated[date] = updated[date].map(event => 
            event.id === eventId ? { ...event, photos: allUpdatedPhotos } : event
          );
        });
        return updated;
      });

      // Update the selected photo for viewing
      if (selectedPhotoForViewing) {
        const currentIndex = allUpdatedPhotos.indexOf(photoUrlToRemove);

        if (allUpdatedPhotos.length > 0) {
          // If there are remaining photos, select the next one
          let newPhotoUrl: string;
          if (currentIndex >= allUpdatedPhotos.length) {
            // If we deleted the last photo, select the new last photo
            newPhotoUrl = allUpdatedPhotos[allUpdatedPhotos.length - 1];
          } else {
            // Select the photo at the same index (or the last one if index is out of bounds)
            newPhotoUrl = allUpdatedPhotos[Math.min(currentIndex, allUpdatedPhotos.length - 1)];
          }

          // Update the selected photo
          setSelectedPhotoForViewing({
            event: { ...selectedPhotoForViewing.event, photos: allUpdatedPhotos },
            photoUrl: newPhotoUrl
          });
        } else {
          // No photos left, close the modal
          setShowPhotoViewer(false);
        }
      }
      
      // Trigger a global event to refresh memories in other screens
      // This will help keep the memories section in sync
      
      // For React Native, we'll store a timestamp that other screens can check
      const lastPhotoDeletionTime = Date.now();
      (global as any).lastPhotoDeletionTime = lastPhotoDeletionTime;
      
      Toast.show({
        type: 'success',
        text1: 'Photo removed successfully',
        position: 'bottom',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to remove photo. Please try again.');
    }
  };

  // Add useEffect to scroll to correct photo when photo viewer opens
  useEffect(() => {
    if (showPhotoViewer && selectedPhotoForViewing && photoViewerFlatListRef.current) {
      try {
      const photoIndex = selectedPhotoForViewing.event.photos?.indexOf(selectedPhotoForViewing.photoUrl) || 0;
      
      // Add a small delay to ensure the FlatList is fully rendered
      setTimeout(() => {
        try {
          photoViewerFlatListRef.current?.scrollToIndex({
            index: photoIndex,
            animated: false,
          });
        } catch (error) {
          console.log('Error scrolling to photo index:', error);
          // Fallback: try to scroll to the first photo
          try {
            photoViewerFlatListRef.current?.scrollToIndex({
              index: 0,
              animated: false,
            });
          } catch (fallbackError) {
            console.log('Fallback scroll also failed:', fallbackError);
          }
        }
      }, 100);
      } catch (error) {
        console.error('Error in photo viewer scroll effect:', error);
      }
    }
  }, [showPhotoViewer, selectedPhotoForViewing]);

  // Add function to handle shared event interactions
  const handleSharedEventPress = async (event: CalendarEvent) => {
    // Use the same logic as handleLongPress for consistency
    await handleLongPress(event);
  };

  const handleAcceptSharedEvent = async (event: CalendarEvent) => {
    try {
      console.log('🔍 [Accept] Starting accept process for event:', event.id);
      
      // Extract the shared event ID from the event ID
      let sharedEventId = event.id;
      if (event.id.startsWith('shared_')) {
        sharedEventId = event.id.replace('shared_', '');
      }
      
      console.log('🔍 [Accept] Extracted shared event ID:', sharedEventId);
      
      // Use the imported sharing utility function
      const result = await acceptSharedEventUtil(sharedEventId);
      
      console.log('🔍 [Accept] Accept result:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to accept event');
      }

      // Show success message
      Toast.show({
        type: 'success',
        text1: 'Event accepted',
        text2: 'The event has been added to your calendar',
        position: 'bottom',
      });

      // Refresh events to update the display
      await fetchEvents();
    } catch (error) {
      console.error('Error accepting shared event:', error);
      Alert.alert('Error', 'Failed to accept event. Please try again.');
    }
  };

  const handleDeclineSharedEvent = async (event: CalendarEvent) => {
    try {
      console.log('🔍 [Decline] Starting decline process for event:', event.id);
      
      // Extract the shared event ID from the event ID
      let sharedEventId = event.id;
      if (event.id.startsWith('shared_')) {
        sharedEventId = event.id.replace('shared_', '');
      }
      
      console.log('🔍 [Decline] Extracted shared event ID:', sharedEventId);
      
      // Use the imported sharing utility function
      const result = await declineSharedEventUtil(sharedEventId);
      
      console.log('🔍 [Decline] Decline result:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to decline event');
      }

      // Show success message
      Toast.show({
        type: 'success',
        text1: 'Event declined',
        text2: 'The event has been removed from your pending list',
        position: 'bottom',
      });

      // Refresh events to update the display
      await fetchEvents();
    } catch (error) {
      console.error('Error declining shared event:', error);
      Alert.alert('Error', 'Failed to decline event. Please try again.');
    }
  };

  const handleCancelSharedEvent = async (event: CalendarEvent) => {
    try {
      console.log('🔍 [Cancel] Starting cancel process for event:', event.id);
      
      // Show confirmation dialog
      Alert.alert(
        'Cancel Shared Event',
        `Are you sure you want to cancel sharing "${event.title}" with ${event.sharedWithFullName || event.sharedWithUsername || 'Unknown'}?`,
        [
          { text: 'No', style: 'cancel' },
          { 
            text: 'Cancel Event', 
            style: 'destructive',
            onPress: async () => {
              try {
                // Extract the shared event ID from the event ID
                let sharedEventId = event.id;
                if (event.id.startsWith('shared_')) {
                  sharedEventId = event.id.replace('shared_', '');
                }
                
                console.log('🔍 [Cancel] Extracted shared event ID:', sharedEventId);
                
                // Delete the shared event from the database
                const { error } = await supabase
                  .from('shared_events')
                  .delete()
                  .eq('id', sharedEventId);
                
                if (error) {
                  throw new Error(error.message);
                }

                // Show success message
                Toast.show({
                  type: 'success',
                  text1: 'Event cancelled',
                  text2: 'The shared event has been cancelled',
                  position: 'bottom',
                });

                // Refresh shared events to update the display
                await updatePendingSharedEvents();
              } catch (error) {
                console.error('Error cancelling shared event:', error);
                Alert.alert('Error', 'Failed to cancel event. Please try again.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in handleCancelSharedEvent:', error);
      Alert.alert('Error', 'Failed to cancel event. Please try again.');
    }
  };

  const displaySharedEventDetails = async (event: CalendarEvent) => {
    try {
      // Fetch shared friends for this event
      let eventIdToQuery = event.id;
      if (event.id.startsWith('shared_')) {
        const sharedEventId = event.id.replace('shared_', '');
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // For recipients, we need to find the original event ID
          const { data: sharedEventData, error } = await supabase
            .from('shared_events')
            .select('original_event_id')
            .eq('id', sharedEventId)
            .eq('shared_with', user.id)
            .single();
          
          if (!error && sharedEventData) {
            eventIdToQuery = sharedEventData.original_event_id;
          }
        }
      }
      
      // Fetch shared friends (for recipients, we want to see all friends the event was shared with)
      const sharedFriendIds = await fetchSharedFriendsForEvent(eventIdToQuery, true);
      const sharedFriends = friends.filter(f => sharedFriendIds.includes(f.friend_id));
      
      // Create the details message
      let detailsMessage = `Title: ${event.title}\n\n`;
      detailsMessage += `Description: ${event.description || 'No description'}\n\n`;
      detailsMessage += `Location: ${event.location || 'No location'}\n\n`;
      detailsMessage += `Date: ${event.date}\n\n`;
      detailsMessage += `Time: ${event.startDateTime ? event.startDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All day'}\n\n`;
      detailsMessage += `Shared by: ${event.sharedByFullName || event.sharedByUsername || 'Unknown'}\n\n`;
      
      if (sharedFriends.length > 0) {
        detailsMessage += `With: ${sharedFriends.map(f => f.friend_name).join(', ')}`;
      } else {
        detailsMessage += 'Shared with: No friends found';
      }
      
      Alert.alert(
        'Shared Event Details',
        detailsMessage,
        [
          { text: 'Accept', onPress: () => handleAcceptSharedEvent(event) },
          { text: 'Decline', style: 'destructive', onPress: () => handleDeclineSharedEvent(event) },
          { text: 'Close', style: 'cancel' }
        ]
      );
    } catch (error) {
      console.error('Error showing shared event details:', error);
      // Fallback to simple alert
      Alert.alert(
        'Shared Event',
        `This event was shared with you by ${event.sharedByFullName || event.sharedByUsername || 'Unknown'}`,
        [
          { text: 'Accept', onPress: () => handleAcceptSharedEvent(event) },
          { text: 'Decline', style: 'destructive', onPress: () => handleDeclineSharedEvent(event) },
          { text: 'Close', style: 'cancel' }
        ]
      );
    }
  };

  const viewSharedEventDetails = (event: CalendarEvent) => {
    // Show event details in a modal
    Alert.alert(
      'Event Details',
      `Title: ${event.title}\n\nDescription: ${event.description || 'No description'}\n\nLocation: ${event.location || 'No location'}\n\nDate: ${event.date}\n\nTime: ${event.startDateTime ? event.startDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All day'}\n\nShared by: ${event.sharedByFullName || event.sharedByUsername || 'Unknown'}`,
      [
        { text: 'Accept', onPress: () => handleAcceptSharedEvent(event) },
        { text: 'Decline', style: 'destructive', onPress: () => handleDeclineSharedEvent(event) },
        { text: 'Close', style: 'cancel' }
      ]
    );
  };

  // Add function to update shared events for the modal
  // Test function to create a shared event for debugging
  const createTestSharedEvent = async () => {
    try {
      console.log('🔍 [Test] Creating test shared event...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ [Test] User not authenticated');
        return;
      }

      // First, add avatar URL to user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('❌ [Test] Error updating profile:', profileError);
      } else {
        console.log('✅ [Test] Avatar URL added to profile');
      }

      // Create a test event
      const testEventId = `test_event_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          id: testEventId,
          title: 'Test Shared Event',
          description: 'This is a test event for debugging',
          location: 'Test Location',
          date: '2025-01-09',
          start_datetime: '2025-01-09T10:00:00Z',
          end_datetime: '2025-01-09T11:00:00Z',
          category_name: 'Test',
          category_color: '#FF6B6B',
          is_all_day: false,
          user_id: user.id
        })
        .select()
        .single();

      if (eventError) {
        console.error('❌ [Test] Error creating test event:', eventError);
        return;
      }

      console.log('✅ [Test] Created test event:', eventData);

      // Create a shared event (share with yourself for testing)
      const { data: sharedEventData, error: sharedEventError } = await supabase
        .from('shared_events')
        .insert({
          original_event_id: testEventId,
          shared_by: user.id,
          shared_with: user.id,
          status: 'pending'
        })
        .select()
        .single();

      if (sharedEventError) {
        console.error('❌ [Test] Error creating shared event:', sharedEventError);
        return;
      }

      console.log('✅ [Test] Created shared event:', sharedEventData);
      
      // Refresh events to show the new shared event
      await fetchEvents();
      
    } catch (error) {
      console.error('❌ [Test] Error in createTestSharedEvent:', error);
    }
  };

  const fetchPendingSharedEvents = async (userId: string): Promise<CalendarEvent[]> => {
    try {
      console.log('🔍 [Calendar] Fetching PENDING shared events for user:', userId);
      
      // Fetch shared events where current user is the recipient and status is pending
      const { data: sharedEventsData, error } = await supabase
        .from('shared_events')
        .select(`
          id,
          original_event_id,
          shared_by,
          shared_with,
          status,
          created_at,
          event_data
        `)
        .eq('shared_with', userId)
        .eq('status', 'pending'); // Only pending events

      if (error) {
        console.error('🔍 [Calendar] Error fetching pending shared events:', error);
        return [];
      }

      if (!sharedEventsData || sharedEventsData.length === 0) {
        console.log('🔍 [Calendar] No pending shared events found');
        return [];
      }

      console.log('🔍 [fetchPendingSharedEvents] Raw shared events data:', sharedEventsData);

      // Get unique user IDs involved in shared events (senders only)
      const allUserIds = new Set<string>();
      sharedEventsData.forEach((se: any) => {
        allUserIds.add(se.shared_by);
      });
      
      // Fetch profiles for all users involved
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', Array.from(allUserIds));

      if (profilesError) {
        console.error('🔍 [Calendar] Error fetching profiles:', profilesError);
      }

      // Create a map of user ID to profile data
      const profilesMap = new Map();
      if (profilesData) {
        profilesData.forEach((profile: any) => {
          profilesMap.set(profile.id, profile);
        });
      }

      // Transform pending shared events into CalendarEvent format
      const transformedPendingSharedEvents = sharedEventsData
        .filter((sharedEvent: any) => {
          // Check if the event_data exists
          return !!sharedEvent.event_data;
        })
        .map((sharedEvent: any) => {
          const event = sharedEvent.event_data;
          
          // Show the sender's profile for shared events
          const profileToShowId = sharedEvent.shared_by;
          const profileToShow = profilesMap.get(profileToShowId);
          
          // Parse dates with better error handling
          const parseDate = (dateStr: string | null) => {
            if (!dateStr) return null;
            try {
              const date = new Date(dateStr);
              if (isNaN(date.getTime())) {
                return null;
              }
              return date;
            } catch (error) {
              return null;
            }
          };

          // Handle all-day events differently to avoid timezone issues
          let startDateTime, endDateTime;
          
          // First, try to parse the start and end times
          const parsedStart = event.start_datetime ? parseDate(event.start_datetime) : null;
          const parsedEnd = event.end_datetime ? parseDate(event.end_datetime) : null;
          
          // Use the database is_all_day flag directly
          let isAllDay = !!event.is_all_day;
          
          if (isAllDay) {
            // For all-day events, preserve the dates for multi-day detection
            // but don't set specific times to avoid timezone issues
            if (event.start_datetime && event.end_datetime) {
              const parsedStart = parseDate(event.start_datetime);
              const parsedEnd = parseDate(event.end_datetime);
              if (parsedStart && parsedEnd) {
                // Set to start of day for both start and end to preserve date info
                startDateTime = new Date(parsedStart);
                startDateTime.setHours(0, 0, 0, 0);
                endDateTime = new Date(parsedEnd);
                endDateTime.setHours(0, 0, 0, 0);
              } else {
                // Fallback: create dates from the date string
                const [year, month, day] = event.date.split('-').map(Number);
                startDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
                endDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
              }
            } else {
              // Fallback: create dates from the date string
              const [year, month, day] = event.date.split('-').map(Number);
              startDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
              endDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
            }
          } else {
            // For regular events, use the parsed datetime values
            startDateTime = parsedStart || undefined;
            endDateTime = parsedEnd || undefined;
            
            // If we have a start time but no end time, create a default end time (1 hour later)
            if (startDateTime && !endDateTime) {
              endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour later
            }
          }

          const transformedEvent = {
            id: `shared_${sharedEvent.id}`, // Prefix to distinguish from regular events
            originalEventId: sharedEvent.original_event_id, // Store the original event ID for deduplication
            title: event.title || 'Untitled Event',
            description: event.description,
            location: event.location,
            date: event.date,
            startDateTime: startDateTime,
            endDateTime: endDateTime,
            categoryName: event.category_name,
            categoryColor: '#00BCD4', // Cyan for shared events
            isAllDay: isAllDay,
            photos: event.photos || [],
            // Shared event properties
            isShared: true,
            sharedBy: sharedEvent.shared_by,
            sharedByUsername: profileToShow?.username || 'Unknown',
            sharedByFullName: profileToShow?.full_name || 'Unknown User',
            sharedStatus: sharedEvent.status,
            sharedByAvatarUrl: profileToShow?.avatar_url || null,
          };

          return transformedEvent;
        });

      console.log('🔍 [fetchPendingSharedEvents] Transformed events:', transformedPendingSharedEvents);
      return transformedPendingSharedEvents;
    } catch (error) {
      console.error('🔍 [Calendar] Error in fetchPendingSharedEvents:', error);
      return [];
    }
  };

  const fetchSentSharedEvents = async (userId: string): Promise<CalendarEvent[]> => {
    try {
      console.log('🔍 [Calendar] Fetching SENT shared events for user:', userId);
      
      // Fetch shared events where current user is the sender
      const { data: sharedEventsData, error } = await supabase
        .from('shared_events')
        .select(`
          id,
          original_event_id,
          shared_by,
          shared_with,
          status,
          created_at,
          event_data
        `)
        .eq('shared_by', userId);

      if (error) {
        console.error('🔍 [Calendar] Error fetching sent shared events:', error);
        return [];
      }

      if (!sharedEventsData || sharedEventsData.length === 0) {
        console.log('🔍 [Calendar] No sent shared events found');
        return [];
      }

      console.log('🔍 [fetchSentSharedEvents] Raw shared events data:', sharedEventsData);

      // Get unique user IDs involved in shared events (recipients only)
      const allUserIds = new Set<string>();
      sharedEventsData.forEach((se: any) => {
        allUserIds.add(se.shared_with);
      });
      
      // Fetch profiles for all users involved
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', Array.from(allUserIds));

      if (profilesError) {
        console.error('🔍 [Calendar] Error fetching profiles:', profilesError);
      }

      // Create a map of user ID to profile data
      const profilesMap = new Map();
      if (profilesData) {
        profilesData.forEach((profile: any) => {
          profilesMap.set(profile.id, profile);
        });
      }

      // Transform sent shared events into CalendarEvent format
      const transformedSentSharedEvents = sharedEventsData
        .filter((sharedEvent: any) => {
          // Check if the event_data exists
          return !!sharedEvent.event_data;
        })
        .map((sharedEvent: any) => {
          const event = sharedEvent.event_data;
          
          // Show the recipient's profile for sent events
          const profileToShowId = sharedEvent.shared_with;
          const profileToShow = profilesMap.get(profileToShowId);
          
          // Parse dates with better error handling
          const parseDate = (dateStr: string | null) => {
            if (!dateStr) return null;
            try {
              const date = new Date(dateStr);
              if (isNaN(date.getTime())) {
                return null;
              }
              return date;
            } catch (error) {
              return null;
            }
          };

          // Handle all-day events differently to avoid timezone issues
          let startDateTime, endDateTime;
          
          // First, try to parse the start and end times
          const parsedStart = event.start_datetime ? parseDate(event.start_datetime) : null;
          const parsedEnd = event.end_datetime ? parseDate(event.end_datetime) : null;
          
          // Use the database is_all_day flag directly
          let isAllDay = !!event.is_all_day;
          
          if (isAllDay) {
            // For all-day events, preserve the dates for multi-day detection
            // but don't set specific times to avoid timezone issues
            if (event.start_datetime && event.end_datetime) {
              const parsedStart = parseDate(event.start_datetime);
              const parsedEnd = parseDate(event.end_datetime);
              if (parsedStart && parsedEnd) {
                // Set to start of day for both start and end to preserve date info
                startDateTime = new Date(parsedStart);
                startDateTime.setHours(0, 0, 0, 0);
                endDateTime = new Date(parsedEnd);
                endDateTime.setHours(0, 0, 0, 0);
              } else {
                // Fallback: create dates from the date string
                const [year, month, day] = event.date.split('-').map(Number);
                startDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
                endDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
              }
            } else {
              // Fallback: create dates from the date string
              const [year, month, day] = event.date.split('-').map(Number);
              startDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
              endDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
            }
          } else {
            // For regular events, use the parsed datetime values
            startDateTime = parsedStart || undefined;
            endDateTime = parsedEnd || undefined;
            
            // If we have a start time but no end time, create a default end time (1 hour later)
            if (startDateTime && !endDateTime) {
              endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour later
            }
          }

          const transformedEvent = {
            id: `shared_${sharedEvent.id}`, // Prefix to distinguish from regular events
            originalEventId: sharedEvent.original_event_id, // Store the original event ID for deduplication
            title: event.title || 'Untitled Event',
            description: event.description,
            location: event.location,
            date: event.date,
            startDateTime: startDateTime,
            endDateTime: endDateTime,
            categoryName: event.category_name,
            categoryColor: '#FF9800', // Orange for sent events
            isAllDay: isAllDay,
            photos: event.photos || [],
            // Shared event properties
            isShared: true,
            sharedBy: sharedEvent.shared_by,
            sharedWith: sharedEvent.shared_with,
            sharedWithUsername: profileToShow?.username || 'Unknown',
            sharedWithFullName: profileToShow?.full_name || 'Unknown User',
            sharedStatus: sharedEvent.status,
            sharedWithAvatarUrl: profileToShow?.avatar_url || null,
          };

          return transformedEvent;
        });

      console.log('🔍 [fetchSentSharedEvents] Transformed events:', transformedSentSharedEvents);
      return transformedSentSharedEvents;
    } catch (error) {
      console.error('🔍 [Calendar] Error in fetchSentSharedEvents:', error);
      return [];
    }
  };

  const updatePendingSharedEvents = useCallback(async () => {
    if (!user?.id) return;
    
    console.log('🔍 [updatePendingSharedEvents] Starting update for user:', user.id);
    
    // Fetch pending shared events from database
    const pendingEvents = await fetchPendingSharedEvents(user.id);
    console.log('🔍 [updatePendingSharedEvents] Fetched pending events:', pendingEvents.length);
    
    // Fetch sent shared events from database
    const sentEvents = await fetchSentSharedEvents(user.id);
    console.log('🔍 [updatePendingSharedEvents] Fetched sent events:', sentEvents.length);
    
    // Sort sent events: declined first, then pending, then accepted
    const sortedSentEvents = sentEvents.sort((a, b) => {
      const statusPriority = { declined: 0, pending: 1, accepted: 2 };
      const aPriority = statusPriority[a.sharedStatus as keyof typeof statusPriority] ?? 3;
      const bPriority = statusPriority[b.sharedStatus as keyof typeof statusPriority] ?? 3;
      return aPriority - bPriority;
    });
    
    // Get accepted shared events from local state
    const allEvents = Object.values(events).flat();
    const acceptedSharedEvents = allEvents.filter(event => event.isShared && event.sharedStatus === 'accepted');
    
    // Combine pending and accepted shared events for received events
    const receivedEvents = [...pendingEvents, ...acceptedSharedEvents];
    
    // Debug logging for shared events
    console.log('🔍 [Shared Events] All events count:', allEvents.length);
    console.log('🔍 [Shared Events] Pending shared events count:', pendingEvents.length);
    console.log('🔍 [Shared Events] Sent shared events count:', sortedSentEvents.length);
    console.log('🔍 [Shared Events] Accepted shared events count:', acceptedSharedEvents.length);
    console.log('🔍 [Shared Events] Received events count:', receivedEvents.length);
    
    receivedEvents.forEach(event => {
      console.log('🔍 [Shared Events] Received event details:', {
        id: event.id,
        title: event.title,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        isAllDay: event.isAllDay,
        sharedStatus: event.sharedStatus,
        sharedBy: event.sharedBy,
        user: user?.id
      });
    });
    
    sortedSentEvents.forEach(event => {
      console.log('🔍 [Shared Events] Sent event details:', {
        id: event.id,
        title: event.title,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        isAllDay: event.isAllDay,
        sharedStatus: event.sharedStatus,
        sharedBy: event.sharedBy,
        sharedWith: event.sharedWith,
        user: user?.id
      });
    });
    
    console.log('🔍 [Shared Events] Sent events count:', sortedSentEvents.length);
    console.log('🔍 [Shared Events] Received events count:', receivedEvents.length);
    console.log('🔍 [Shared Events] User ID:', user?.id);
    console.log('🔍 [Shared Events] Sent events sharedBy values:', sortedSentEvents.map(e => e.sharedBy));
    console.log('🔍 [Shared Events] Received events sharedBy values:', receivedEvents.map(e => e.sharedBy));
    
    setPendingSharedEvents(receivedEvents);
    setSentSharedEvents(sortedSentEvents);
    setReceivedSharedEvents(receivedEvents);
    
    console.log('🔍 [updatePendingSharedEvents] State updated');
  }, [events, user?.id]);

  // Update pending events when events change
  useEffect(() => {
    updatePendingSharedEvents();
  }, [events, updatePendingSharedEvents]);

  // Update pending events when component mounts
  useEffect(() => {
    if (user?.id) {
      console.log('🔍 [Calendar] Component mounted, updating pending shared events for user:', user.id);
      updatePendingSharedEvents();
    }
  }, [user?.id, updatePendingSharedEvents]);

  // Also update pending events when user changes
  useEffect(() => {
    if (user?.id) {
      // Small delay to ensure user is fully loaded
      const timer = setTimeout(() => {
        updatePendingSharedEvents();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [user?.id, updatePendingSharedEvents]);

  // Initialize swipe animation value
  useEffect(() => {
    swipeAnimation.setValue(activeSharedEventsTab === 'sent' ? -1 : 0);
  }, []);



  // Add state for editedIsAllDay for the edit modal



  return (
    <>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
  {calendarMode === 'month' ? (
    <View style={{ flex: 1, flexDirection: 'column' }}>
      {/* Fixed Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => {
            const today = new Date();
            const currentYearForToday = today.getFullYear();
            const currentMonthForToday = today.getMonth();
            const startYearForToday = currentYearForToday - 1;
            const monthIndex = (currentYearForToday - startYearForToday) * 12 + currentMonthForToday;
            
            if (monthIndex >= 0 && monthIndex < months.length) {
              flatListRef.current?.scrollToIndex({
                index: monthIndex,
                animated: true,
              });
            }
          }}
        >
          <Text style={styles.monthLabel}>
            {new Date(months[currentMonthIndex].year, months[currentMonthIndex].month).toLocaleString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setCalendarMode('week')}>
            <MaterialIcons name="calendar-view-week" size={24} color="#333" />
          </TouchableOpacity>
          {/* Always show shared events button, not just when there are pending events */}
            <TouchableOpacity
            onPress={async () => {
              console.log('🔍 [Calendar] Opening shared events modal');
              console.log('🔍 [Calendar] Pending events count:', pendingSharedEvents.length);
              console.log('🔍 [Calendar] Sent events count:', sentSharedEvents.length);
              console.log('🔍 [Calendar] Received events count:', receivedSharedEvents.length);
              console.log('🔍 [Calendar] User ID:', user?.id);
              
              // Update shared events before opening modal
              await updatePendingSharedEvents();
              
              console.log('🔍 [Calendar] After updatePendingSharedEvents:');
              console.log('🔍 [Calendar] Pending events count:', pendingSharedEvents.length);
              console.log('🔍 [Calendar] Sent events count:', sentSharedEvents.length);
              console.log('🔍 [Calendar] Received events count:', receivedSharedEvents.length);
              
              setShowSharedEventsModal(true);
            }}
              style={{
                padding: 8,
                marginLeft: 12,
                position: 'relative',
              }}
            >
            <Ionicons name="people-outline" size={20} color="#333" />
            {pendingSharedEvents.length > 0 && (
              <View style={{
                position: 'absolute',
                top: 4,
                right: 4,
                backgroundColor: '#FF3B30',
                borderRadius: 8,
                minWidth: 16,
                height: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{
                  color: 'white',
                  fontSize: 10,
                  fontWeight: '600',
                  fontFamily: 'Onest',
                }}>
                  {pendingSharedEvents.length > 9 ? '9+' : pendingSharedEvents.length}
                </Text>
              </View>
          )}
          </TouchableOpacity>
        </View>
      </View>





      {/* Calendar and Event List Container */}
      <View 
        {...panResponder.panHandlers}
        style={{ 
        flex: 1, 
        flexDirection: 'column',
        minHeight: 600, // Ensure stable minimum height
        }}
      >
        {/* Calendar Grid */}
        <View style={{ 
          flex: isMonthCompact ? 0.5 : 1,
          minHeight: isMonthCompact ? 200 : 400, // Ensure stable height
        }}>
          <FlatList
            ref={flatListRef}
            data={months}
            keyExtractor={(item) => item.key}
            horizontal
            pagingEnabled
            directionalLockEnabled={true}
            initialScrollIndex={currentMonthIndex}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 0 }}
            renderItem={renderMonth}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            scrollEnabled={true}
            removeClippedSubviews={false}
            maxToRenderPerBatch={1}
            windowSize={3}
            onScroll={(event) => {
              const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              if (newIndex !== currentMonthIndex) {
                setCurrentMonthIndex(newIndex);
              }
            }}
            refreshControl={
              !isMonthCompact ? (
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={onRefresh}
                />
              ) : undefined
            }
          />
        </View>

        {/* Event List */}
        {isMonthCompact && selectedDate && (
          <View style={{ 
            flex: 0.6, 
            backgroundColor: 'white',
            minHeight: 300, // Ensure stable height
            marginTop: 20, // Add top margin to move it lower
          }}>
            <View style={styles.dateHeader}>
              <Text style={styles.dateHeaderText}>
                {`${selectedDate.getDate()}. ${selectedDate.toLocaleDateString('en-US', { weekday: 'short' })}`}
              </Text>
            </View>
            <ScrollView
              style={{ paddingHorizontal: 16 }}
              contentContainerStyle={{ paddingBottom: 16, paddingTop: 10 }}
              showsVerticalScrollIndicator={false}
            >
              <GestureHandlerRootView>
                {events[getLocalDateString(selectedDate)]?.length ? (
                  events[getLocalDateString(selectedDate)]
                    .sort((a, b) => {
                      // Sort by start time, all-day events first
                      if (a.isAllDay && !b.isAllDay) return -1;
                      if (!a.isAllDay && b.isAllDay) return 1;
                      if (!a.startDateTime || !b.startDateTime) return 0;
                      return a.startDateTime.getTime() - b.startDateTime.getTime();
                    })
                    .map((event, index) => (
                      <Swipeable
                        key={index}
                        ref={(ref) => {
                          if (ref) {
                            swipeableRefs.current[event.id] = ref;
                          }
                        }}
                        renderRightActions={() => (
                          <TouchableOpacity
                            style={{
                              backgroundColor: '#FF6B6B',
                              width: 80,
                              height: '100%',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 8,
                            }}
                            onPress={() => {
                              Alert.alert(
                                'Delete Event',
                                'Are you sure you want to delete this event?',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Delete',
                                    style: 'destructive',
                                    onPress: () => handleDeleteEvent(event.id),
                                  },
                                ]
                              );
                            }}
                          >
                            <Ionicons name="trash" size={20} color="white" />
                          </TouchableOpacity>
                        )}
                        renderLeftActions={() => (
                          <View
                            style={{
                              backgroundColor: '#00BCD4',
                              width: 80,
                              height: '100%',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 8,
                            }}
                          >
                            <Ionicons name="camera" size={20} color="white" />
                          </View>
                        )}
                        onSwipeableLeftOpen={() => showEventPhotoOptions(event.id)}
                        rightThreshold={40}
                        leftThreshold={40}
                      >
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#fff',
                            borderRadius: 12,
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            borderWidth: event.isShared && event.sharedStatus === 'pending' ? 2 : (event.isGoogleEvent ? 1 : 0),
                            borderColor: event.isShared && event.sharedStatus === 'pending' ? '#00ACC1' : (event.isGoogleEvent ? (event.calendarColor || '#4285F4') : 'transparent'),
                            borderStyle: 'solid',
                          }}
                          onPress={() => handleSharedEventPress(event)}
                          onLongPress={() => handleLongPress(event)}
                        >
                          {/* Category Color Bar */}
                          <View
                            style={{
                              width: 5.5,
                              height: 46,
                              borderRadius: 3,
                              backgroundColor: event.isGoogleEvent ? (event.calendarColor || '#4285F4') : (event.isShared && event.sharedStatus === 'pending' ? '#00ACC1' : (event.categoryColor || '#00BCD4')),
                              marginRight: 14,
                            }}
                          />
                          {/* Event Info */}
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3.5 }}>
                              <Text style={{ 
                                fontSize: 17, 
                                fontWeight: 'bold', 
                                color: event.isShared && event.sharedStatus === 'pending' ? '#00ACC1' : '#222', 
                                marginBottom: 0 
                              }}>
                                {event.title}
                              </Text>

                              {event.isShared && !event.isGoogleEvent && (
                                <View style={{ 
                                  marginLeft: 8, 
                                  backgroundColor: '#00ACC1', 
                                  borderRadius: 8, 
                                  paddingHorizontal: 6, 
                                  paddingVertical: 2 
                                }}>
                                  <Text style={{ 
                                    color: 'white', 
                                    fontSize: 10, 
                                    fontWeight: 'bold' 
                                  }}>
                                    SHARED
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={{ fontSize: 15, color: '#666', marginBottom: event.description ? 2 : 0 }}>
                              {(() => {
                                console.log('🔍 [Calendar] Event list display check:', {
                                  title: event.title,
                                  isAllDay: event.isAllDay,
                                  startDateTime: event.startDateTime,
                                  endDateTime: event.endDateTime,
                                  isShared: event.isShared
                                });
                                
                                // Check if this is an all-day event first
                                if (event.isAllDay) {
                                  return 'All Day';
                                }
                                
                                // For non-all-day events, check for valid times
                                if (event.startDateTime && event.endDateTime && 
                                    event.startDateTime instanceof Date && !isNaN(event.startDateTime.getTime()) &&
                                    event.endDateTime instanceof Date && !isNaN(event.endDateTime.getTime())) {
                                  console.log('🔍 [Calendar] Event has valid times, showing times');
                                  const formatTime = (date: Date | undefined) => {
                                    console.log('🔍 [Calendar] Formatting time for event list:', {
                                      date,
                                      dateType: typeof date,
                                      isDate: date instanceof Date,
                                      isValid: date instanceof Date && !isNaN(date.getTime()),
                                      eventTitle: event.title,
                                      isShared: event.isShared
                                    });
                                    
                                    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
                                      console.warn('🔍 [Calendar] Invalid date for formatting in event list:', date);
                                      return 'Invalid time';
                                    }
                                    try {
                                      const formatted = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                      console.log('🔍 [Calendar] Successfully formatted time in event list:', formatted);
                                      return formatted;
                                    } catch (error) {
                                      console.error('🔍 [Calendar] Error formatting time in event list:', error, date);
                                      return 'Invalid time';
                                    }
                                  };
                                  
                                  const startTime = formatTime(event.startDateTime);
                                  const endTime = formatTime(event.endDateTime);
                                  
                                                                    const result = `${startTime} – ${endTime}`;
                                  console.log('🔍 [Calendar] Final time string for event list:', result);
                                  return result;
                                } else {
                                  console.log('🔍 [Calendar] Event has no valid times, showing all-day');
                                  return 'All day';
                                }
                              })()}
                            </Text>
                            {event.description ? (
                              <Text style={{ fontSize: 12, color: '#999' }} numberOfLines={2}>
                                {event.description}
                              </Text>
                            ) : null}
                            {event.isShared && (
                              <Text style={{ fontSize: 11, color: '#00ACC1', marginTop: 2 }}>
                                Shared by {event.sharedByFullName || event.sharedByUsername || 'Unknown'}
                              </Text>
                            )}
                          </View>
                          
                          {/* Photo Section */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {event.photos && event.photos.length > 0 && (
                              <View style={{ 
                                position: 'relative',
                                width: 45 + (event.photos.length > 1 ? 8 : 0), // Account for stacking offset
                                height: 45 + (Math.min(event.photos.length, 3) - 1) * 8, // Account for vertical stacking
                              }}>
                                {event.photos.slice(0, 3).map((photoUrl, photoIndex) => (
                                  <TouchableOpacity
                                    key={photoIndex}
                                    onPress={() => {
                                      try {
                                        // Validate photo data before opening viewer
                                        if (!event || !photoUrl || !event.photos || event.photos.length === 0) {
                                          console.error('Invalid photo data:', { event, photoUrl });
                                          Alert.alert('Error', 'Invalid photo data');
                                          return;
                                        }
                                        
                                        // Use the new Instagram-like zoom viewer
                                        setSelectedPhotoForZoom({ photoUrl, eventTitle: event.title });
                                        setShowPhotoZoomModal(true);
                                      } catch (error) {
                                        console.error('Error opening photo viewer:', error);
                                        Alert.alert('Error', 'Failed to open photo viewer');
                                      }
                                    }}
                                    onLongPress={() => {
                                      Alert.alert(
                                        'Remove Photo',
                                        'Do you want to remove this photo?',
                                        [
                                          { text: 'Cancel', style: 'cancel' },
                                          { 
                                            text: 'Remove', 
                                            style: 'destructive',
                                            onPress: () => handlePhotoViewerDelete(event.id, photoUrl)
                                          }
                                        ]
                                      );
                                    }}
                                    style={{
                                      width: 45,
                                      height: 45,
                                      borderRadius: 10,
                                      overflow: 'hidden',
                                      position: 'absolute',
                                      top: photoIndex * 4, // Minimal stack offset
                                      left: photoIndex * 8, // Increased horizontal offset to move photos more to the right
                                      zIndex: event.photos!.length - photoIndex, // Higher photos on top
                                    }}
                                  >
                                    <Image
                                      source={{ uri: photoUrl }}
                                      style={{ width: '100%', height: '100%' }}
                                      resizeMode="cover"
                                    />
                                  </TouchableOpacity>
                                ))}
                                {/* Show count indicator if more than 3 photos */}
                                {event.photos.length > 3 && (
                                  <View style={{
                                    position: 'absolute',
                                    top: 2 * 4 + 45, // Position below the stacked photos
                                    left: 2 * 8, // Updated to match the new horizontal offset
                                    backgroundColor: 'rgba(0,0,0,0.7)',
                                    borderRadius: 12,
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    zIndex: 10,
                                  }}>
                                    <Text style={{ 
                                      color: 'white', 
                                      fontSize: 10, 
                                      fontWeight: 'bold' 
                                    }}>
                                      +{event.photos.length - 3}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            )}                        
                          </View>
                        </TouchableOpacity>
                      </Swipeable>
                    ))
                ) : (
                  <Text style={{ textAlign: 'center', color: '#666', marginTop: 20 }}>
                    No events
                  </Text>
                )}
              </GestureHandlerRootView>
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  ) : (
    <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
      {/* Fixed Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => {
            const today = new Date();
            setSelectedDate(today);
            setVisibleWeekMonth(today);
            weeklyCalendarRef.current?.scrollToWeek?.(today);
          }}
        >
          <Text style={styles.monthLabel}>
            {(() => {
              const weekStart = new Date(visibleWeekMonth);
              const weekEnd = new Date(visibleWeekMonth);
              weekEnd.setDate(weekEnd.getDate() + 6);

              const startMonth = weekStart.getMonth();
              const endMonth = weekEnd.getMonth();
              const year = weekStart.getFullYear();

              if (startMonth === endMonth) {
                return new Date(visibleWeekMonth).toLocaleString('en-US', {
                  month: 'long',
                  year: 'numeric',
                });
              } else {
                const months = [
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'
                ];
                return `${months[startMonth]}/${months[endMonth]} ${year}`;
              }
            })()}
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setCalendarMode('month')}>
            <MaterialIcons name="calendar-view-month" size={24} color="#333" />
          </TouchableOpacity>
          {/* Always show shared events button, not just when there are pending events */}
          <TouchableOpacity
            onPress={async () => {
              console.log('🔍 [Calendar] Opening shared events modal (week view)');
              console.log('🔍 [Calendar] Pending events count:', pendingSharedEvents.length);
              console.log('🔍 [Calendar] Sent events count:', sentSharedEvents.length);
              console.log('🔍 [Calendar] Received events count:', receivedSharedEvents.length);
              
              // Update shared events before opening modal
              await updatePendingSharedEvents();
              
              setShowSharedEventsModal(true);
            }}
              style={{
                padding: 8,
                marginLeft: 12,
                position: 'relative',
              }}
            >
            <Ionicons name="people-outline" size={20} color="#333" />
            {pendingSharedEvents.length > 0 && (
              <View style={{
                position: 'absolute',
                top: 4,
                right: 4,
                backgroundColor: '#FF3B30',
                borderRadius: 8,
                minWidth: 16,
                height: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{
                  color: 'white',
                  fontSize: 10,
                  fontWeight: '600',
                  fontFamily: 'Onest',
                }}>
                  {pendingSharedEvents.length > 9 ? '9+' : pendingSharedEvents.length}
                </Text>
              </View>
          )}
          </TouchableOpacity>
        </View>
      </View>

      <WeeklyCalendarView
        ref={weeklyCalendarRef}
        events={events}
        setEvents={setEvents}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        setShowModal={setShowModal}
        setStartDateTime={setStartDateTime}
        setEndDateTime={setEndDateTime}
        setSelectedEvent={setSelectedEvent}
        setEditedEventTitle={setEditedEventTitle}
        setEditedEventDescription={setEditedEventDescription}
        setEditedStartDateTime={setEditedStartDateTime}
        setEditedEndDateTime={setEditedEndDateTime}
        setEditedSelectedCategory={setEditedSelectedCategory}
        setEditedReminderTime={setEditedReminderTime}
        setEditedRepeatOption={setEditedRepeatOption}
        setEditedRepeatEndDate={setEditedRepeatEndDate}
        setEditedEventPhotos={setEditedEventPhotos}
        setEditedAllDay={setIsEditedAllDay}
        setShowEditEventModal={setShowEditEventModal}
        resetAllDayToggle={resetAllDayToggle}
        hideHeader={true}
        setVisibleWeekMonth={setVisibleWeekMonth}
        setVisibleWeekMonthText={setVisibleWeekMonthText}
        visibleWeekMonthText={visibleWeekMonthText}
        isRefreshing={isRefreshing}
        onRefresh={onRefresh}
        handleLongPress={handleLongPress}
      />
    </View>
  )}

  {/* Floating Add Button */}
  <TouchableOpacity
    style={styles.addButton}
    onPress={() => {
      resetEventForm();
      resetAllDayToggle(); // Reset all-day toggle for new events
      setShowModal(true);
      // The resetEventForm now uses selectedDate, so we don't need to override it
      const currentDateStr = getLocalDateString(startDateTime);
      setCustomSelectedDates([currentDateStr]);
      setCustomDateTimes({
        default: {
          start: startDateTime,
          end: endDateTime,
          reminder: reminderTime,
          repeat: 'None',
          dates: [currentDateStr],
        },
      });
    }}
    onLongPress={() => {
      resetEventForm();
      resetAllDayToggle(); // Reset all-day toggle for new events
      // Set up for custom event
      setCustomModalTitle('');
      setCustomModalDescription('');
      // The resetEventForm now uses selectedDate, so we don't need to override it
      const currentDateStr = getLocalDateString(startDateTime);
      setCustomSelectedDates([currentDateStr]);
      setCustomDateTimes({
        default: {
          start: startDateTime,
          end: endDateTime,
          reminder: reminderTime,
          repeat: 'None',
          dates: [currentDateStr]
        }
      });
      setEditingEvent(null);
      setIsEditingEvent(false);
      setShowCustomDatesPicker(true);
    }}
  >
    <Ionicons name="add" size={22} color="white" />
  </TouchableOpacity>
</SafeAreaView>


      <Modal
        animationType="slide"
        transparent={false}
        visible={showModal}
        onRequestClose={() => setShowModal(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fafafa' }}>
            <View style={{ flex: 1 }}>
              {/* Minimal Header */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                paddingHorizontal: 16,
                paddingVertical: 12,
                paddingTop: 40,
                backgroundColor: selectedCategory?.color ? selectedCategory.color + '40' : 'white',
              }}>
                <TouchableOpacity 
                  onPress={() => {
                    setShowModal(false);
                    resetEventForm();
                  }}
                  style={styles.modalHeaderButton}
                >
                  <Ionicons name="close" size={16} color="#666" />
                </TouchableOpacity>
                
                <Text style={styles.modalHeaderTitle}>
                  New Event
                </Text>
                
                <TouchableOpacity 
                  onPress={() => handleSaveEvent()}
                  disabled={!newEventTitle.trim()}
                  style={[
                    styles.modalHeaderButton,
                    { backgroundColor: newEventTitle.trim() ? '#00BCD4' : '#ffffff' }
                  ]}
                >
                  <Ionicons 
                    name="checkmark" 
                    size={16} 
                    color={newEventTitle.trim() ? 'white' : '#999'} 
                  />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <ScrollView 
                ref={eventModalScrollViewRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ 
                  padding: 16, 
                  paddingBottom: 380, // Increased bottom padding for better scrolling with keyboard
                  minHeight: '100%' // Ensures content is scrollable even when short
                }}
                keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              bounces={true}
              alwaysBounceVertical={true}
              scrollEventThrottle={16}
              keyboardDismissMode="interactive"
              >
                    <TouchableOpacity 
                      onPress={() => {
                        if (repeatOption === 'Custom') {
                          setRepeatOption('None');
                        } else {
                          setCustomModalTitle('');
                          setCustomModalDescription('');
                          setCustomSelectedDates([getLocalDateString(startDateTime)]);
                          setCustomDateTimes({
                            default: {
                              start: startDateTime,
                              end: endDateTime,
                              reminder: reminderTime,
                              repeat: 'None',
                              dates: [getLocalDateString(startDateTime)]
                            }
                          });
                          setEditingEvent(null);
                          setIsEditingEvent(false);
                          setRepeatOption('Custom');
                          setShowModal(false);
                          setShowCustomDatesPicker(true);
                        }
                      }}
                    >
                    </TouchableOpacity>

                    {repeatOption !== 'Custom' ? (
                      <>
                    {/* Event Title Card */}
                    <View style={styles.modalCard}>
                
                        <TextInput
                        style={styles.modalInput}
                        placeholder="Event Title"
                        placeholderTextColor="#888"
                          value={newEventTitle}
                          onChangeText={setNewEventTitle}
                          ref={eventTitleInputRef}
                        />
    
                        <TextInput
                          style={styles.modalInputDescription}
                          placeholder="Description"
                          placeholderTextColor="#999"
                          value={newEventDescription}
                          onChangeText={setNewEventDescription}
                          multiline
                          numberOfLines={3}
                        />

                        <TextInput
                          style={styles.modalInputLocation}
                          placeholder="Location"
                          placeholderTextColor="#999"
                          value={newEventLocation}
                          onChangeText={setNewEventLocation}
                        />
                    </View>

                    {/* Time & Date Card */}
                    <View style={styles.modalCard}>
                      
                      {/* All Day Toggle */}
                      <View style={styles.modalToggleRow}>
                        <Text style={styles.modalLabel}>
                          All-day event
                        </Text>
                        <View style={{ transform: [{ scale: 0.8 }] }}>
                          <Switch 
                            value={isAllDay} 
                            onValueChange={(value) => {
                              console.log('🔍 [Calendar] All-day switch toggled to:', value);
                              setIsAllDay(value);
                            }}
                            trackColor={{ false: 'white', true: '#00BCD4' }}
                            thumbColor={isAllDay ? 'white' : '#f4f3f4'}
                          />
                        </View>
                      </View>

                      {/* Start & End Time */}
                      <View style={styles.modalGapContainer}>
                        <View>
                          <View style={styles.modalTimeRow}>
                            <Text style={styles.modalLabel}>
                              Starts
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                if (showStartPicker) {
                                  setShowStartPicker(false);
                                } else {
                                  setShowStartPicker(true);
                                  setShowEndPicker(false);
                                }
                                Keyboard.dismiss();
                              }}
                              style={showStartPicker ? styles.modalTimeButtonFocused : styles.modalTimeButton}
                            >
                              <Text style={styles.modalTimeText}>
                                {startDateTime.toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  ...(isAllDay ? {} : {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })
                                }).replace(',', ' ·')}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View>
                          <View style={styles.modalTimeRow}>
                            <Text style={styles.modalLabel}>
                              Ends
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                Keyboard.dismiss();
                                if (showEndPicker) {
                                  setShowEndPicker(false);
                                } else {
                                  setShowEndPicker(true);
                                  setShowStartPicker(false);
                                }
                              }}
                              style={showEndPicker ? styles.modalTimeButtonFocused : styles.modalTimeButton}
                            >
                              <Text style={styles.modalTimeText}>
                                {endDateTime.toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  ...(isAllDay ? {} : {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })
                                }).replace(',', ' ·')}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      {/* Date/Time Picker */}
                      {(showStartPicker || showEndPicker) && (
                        <View style={styles.modalPickerContainer}>
                          <DateTimePicker
                            value={showStartPicker ? startDateTime : endDateTime}
                            mode={isAllDay ? "date" : "datetime"}
                            display="spinner"
                            onChange={(event, selectedDate) => {
                              if (selectedDate) {
                                if (showStartPicker) {
                                  console.log('🔍 [Calendar] Date picker - updating startDateTime:', {
                                    oldStartDateTime: startDateTime.toISOString(),
                                    newStartDateTime: selectedDate.toISOString(),
                                    oldDate: getLocalDateString(startDateTime),
                                    newDate: getLocalDateString(selectedDate)
                                  });
                                  setStartDateTime(selectedDate);
                                  if (endDateTime < selectedDate) {
                                    const newEnd = new Date(selectedDate);
                                    newEnd.setHours(newEnd.getHours() + 1);
                                    setEndDateTime(newEnd);
                                  }
                                  debouncePickerClose('start');
                                } else {
                                  console.log('🔍 [Calendar] Date picker - updating endDateTime:', {
                                    oldEndDateTime: endDateTime.toISOString(),
                                    newEndDateTime: selectedDate.toISOString()
                                  });
                                  setEndDateTime(selectedDate);
                                  debouncePickerClose('end');
                                }
                              }
                            }}
                            style={{ height: isAllDay ? 40 : 60, width: '100%' }}
                            textColor="#333"
                          />
                        </View>
                      )}
                    </View>

                    {/* Category Card */}
                    <View style={styles.modalCard}>
                      <Text style={styles.modalSectionHeader}>
                        Category
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          Keyboard.dismiss();
                        if (categories.length === 0) {
                          // If no categories exist, automatically show new category input
                          setShowAddCategoryForm(true);
                          setNewCategoryName('');
                          setNewCategoryColor(CATEGORY_COLORS[0]);
                          setShowCategoryPicker(false);
                        } else {
                          // If categories exist, toggle the category box
                          if (showCategoryPicker) {
                            setShowCategoryPicker(false);
                            setShowAddCategoryForm(false);
                            setNewCategoryName('');
                            setNewCategoryColor(CATEGORY_COLORS[0]);
                          } else {
                            setShowCategoryPicker(true);
                          }
                          }
                        }}
                        style={showCategoryPicker ? styles.modalCategoryButtonFocused : styles.modalCategoryButton}
                      >
                        {!showCategoryPicker ? (
                          <View style={styles.modalRowBetween}>
                            <View style={styles.modalRow}>
                              {selectedCategory ? (
                                <>
                                  <View style={[
                                    styles.modalCategoryDotLarge,
                                    { backgroundColor: selectedCategory.color }
                                  ]} />
                                  <Text style={styles.modalCategoryText}>
                                    {selectedCategory.name}
                                  </Text>
                                </>
                              ) : (
                                <Text style={styles.modalCategoryPlaceholder}>
                                  Choose category
                                </Text>
                              )}
                            </View>
                            <Ionicons name="chevron-down" size={12} color="#999" />
                          </View>
                        ) : (
                          <View style={styles.modalWrapContainer}>
                            {categories.map((cat, idx) => (
                              <Pressable
                                key={idx}
                                onPress={() => {
                                  setSelectedCategory(cat);
                                  setShowCategoryPicker(false);
                                  setShowAddCategoryForm(false);
                                }}
                                onLongPress={() => handleCategoryLongPress(cat)}
                                style={[
                                  selectedCategory?.name === cat.name ? styles.modalCategoryChipSelected : styles.modalCategoryChip,
                                  { backgroundColor: selectedCategory?.name === cat.name ? cat.color + '20' : '#f8f9fa' }
                                ]}
                              >
                                <View style={[
                                  styles.modalCategoryDot,
                                  { backgroundColor: cat.color }
                                ]} />
                                <Text style={selectedCategory?.name === cat.name ? styles.modalCategoryChipTextSelected : styles.modalCategoryChipText}>
                                  {cat.name}
                                </Text>
                              </Pressable>
                            ))}
                            <TouchableOpacity
                              onPress={() => setShowAddCategoryForm(true)}
                              style={styles.modalAddButton}
                            >
                              <Ionicons name="add" size={10} color="#666" />
                            </TouchableOpacity>
                          </View>
                        )}

                        {showAddCategoryForm && (
                          <View style={styles.modalAddCategoryForm}>
                            <Text style={styles.modalFormSectionTitle}>
                              New Category
                            </Text>
                            <TextInput
                              style={styles.modalAddCategoryInput}
                              placeholder="Category name"
                              value={newCategoryName}
                              onChangeText={setNewCategoryName}
                            />
                            
                            {/* Color Picker */}
                            <Text style={styles.modalFormSubtitle}>
                              Color
                            </Text>
                            <View style={styles.modalColorPicker}>
                              {CATEGORY_COLORS.map((color) => (
                                <TouchableOpacity
                                  key={color}
                                  onPress={() => setNewCategoryColor(color)}
                                style={[
                                  newCategoryColor === color ? styles.modalColorOptionSelected : styles.modalColorOption,
                                  { backgroundColor: color }
                                ]}
                                >
                                  {newCategoryColor === color && (
                                    <Ionicons name="checkmark" size={14} color="white" />
                                  )}
                                </TouchableOpacity>
                              ))}
                            </View>

                            <View style={styles.modalFormActions}>
                              <TouchableOpacity
                                onPress={() => {
                                  setShowAddCategoryForm(false);
                                  setNewCategoryName('');
                                setNewCategoryColor(CATEGORY_COLORS[0]);
                                }}
                                style={styles.modalFormButton}
                              >
                                <Text style={styles.modalFormButtonText}>
                                  Cancel
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={async () => {
                                  if (newCategoryName.trim()) {
                                    const { data, error } = await supabase
                                      .from('categories')
                                      .insert([
                                        {
                                          label: newCategoryName.trim(),
                                          color: newCategoryColor,
                                          user_id: user?.id,
                                          type: 'calendar'
                                        }
                                      ])
                                      .select();

                                    if (error) {
                                      return;
                                    }

                                    if (data) {
                                      const newCategory = {
                                        id: data[0].id,
                                        name: data[0].label,
                                        color: data[0].color,
                                      };
                                      setCategories(prev => [...prev, newCategory]);
                                      setSelectedCategory(newCategory);
                                      setShowAddCategoryForm(false);
                                      setNewCategoryName('');
                                    setNewCategoryColor(CATEGORY_COLORS[0]);
                                    }
                                  }
                                }}
                                style={styles.modalFormButtonPrimary}
                              >
                                <Text style={styles.modalFormButtonTextPrimary}>
                                  Add
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Options Card */}
                    <View style={styles.modalCard}>
                      <View style={styles.modalGapContainer}>
                        {/* Reminder */}
                        <View>
                          <View style={styles.modalTimeRow}>
                            <Text style={styles.modalLabel}>
                              Reminder
                            </Text>
                            <TouchableOpacity
                            onPress={() => {
                              if (showReminderPicker) {
                                setShowReminderPicker(false);
                              } else {
                                setShowReminderPicker(true);
                                setShowReminderOptions(false);
                                setShowRepeatPicker(false);
                                setShowEndDatePicker(false);
                              }
                            }}
                            style={showReminderPicker ? styles.modalTimeButtonFocused : styles.modalTimeButton}
                            >
                              <Text style={styles.modalTimeText}>
                              {reminderTime ? reminderTime.toLocaleString([], { 
                                month: 'short', 
                                day: 'numeric', 
                                hour: 'numeric', 
                                minute: '2-digit', 
                                hour12: true 
                              }) : 'No reminder'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        {showReminderPicker && (
                          <View style={styles.modalPickerContainer}>
                            <DateTimePicker
                              value={reminderTime || new Date()}
                              mode="datetime"
                              display="spinner"
                              onChange={(event, selectedDate) => {
                                if (selectedDate) {
                                  setReminderTime(selectedDate);
                                  debouncePickerClose('reminder');
                                }
                              }}
                              style={{ height: 120, width: '100%' }}
                              textColor="#333"
                            />
                          </View>
                        )}
                          {showReminderOptions && (
                            <View style={styles.modalCategoryPicker}>
                              <ScrollView 
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingVertical: 2 }}
                              >
                                {REMINDER_OPTIONS.map(opt => (
                                  <TouchableOpacity
                                    key={opt.value}
                                    onPress={() => {
                                      setReminderOffset(opt.value);
                                      setShowReminderOptions(false);
                                    }}
                                    style={reminderOffset === opt.value ? styles.modalCategoryOptionSelected : styles.modalCategoryOption}
                                  >
                                    <Text style={reminderOffset === opt.value ? styles.modalCategoryOptionTextSelected : styles.modalCategoryOptionText}>
                                      {opt.label}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          )}
                        </View>

                        {/* Repeat */}
                        <View>
                          <View style={styles.modalTimeRow}>
                            <Text style={styles.modalLabel}>
                              Repeat
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                const newRepeatPickerState = !showRepeatPicker;
                                setShowRepeatPicker(newRepeatPickerState);
                                if (newRepeatPickerState) {
                                  setShowReminderPicker(false);
                                  setShowEndDatePicker(false);
                                }
                              }}
                              style={showRepeatPicker ? styles.modalTimeButtonFocused : styles.modalTimeButton}
                            >
                              <Text style={styles.modalTimeText}>
                                {repeatOption === 'None' ? 'Does not repeat' : repeatOption}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* End Date (if repeating) */}
                      {repeatOption !== 'None' && (repeatOption as string) !== 'Custom' && (
                          <View>
                            <View style={styles.modalTimeRow}>
                              <Text style={styles.modalLabel}>
                                End Date
                              </Text>
                              <TouchableOpacity
                                onPress={() => {
                                  const newEndDatePickerState = !showEndDatePicker;
                                  setShowEndDatePicker(newEndDatePickerState);
                                  if (newEndDatePickerState) {
                                    setShowReminderPicker(false);
                                    setShowRepeatPicker(false);
                                  }
                                }}
                                style={showEndDatePicker ? styles.modalTimeButtonFocused : styles.modalTimeButton}
                              >
                                <Text style={styles.modalTimeText}>
                                  {repeatEndDate ? repeatEndDate.toLocaleDateString([], { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: '2-digit' 
                                  }) : 'No end date'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>

                      {showRepeatPicker && (
                      <View style={{
                        backgroundColor: '#f8f9fa',
                        borderRadius: 8,
                        padding: 8,
                        marginTop: 4,
                        borderWidth: 1,
                        borderColor: '#e0e0e0',
                      }}>
                        <View style={{ marginBottom: 8 }}>
                          {['Does not repeat', 'Daily', 'Weekly', 'Monthly', 'Yearly'].map((option) => (
                            <TouchableOpacity 
                              key={option}
                              onPress={() => {
                                if (option === 'Does not repeat') {
                                  setRepeatOption('None');
                                  setRepeatEndDate(null);
                                  setShowRepeatPicker(false);
                                } else {
                                  setRepeatOption(option as RepeatOption);
                                  // Don't close the picker so the end date section remains visible
                                }
                              }}
                              style={{
                                backgroundColor: (option === 'Does not repeat' ? repeatOption === 'None' : repeatOption === option) ? '#f0f0f0' : 'transparent',
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 6,
                                marginVertical: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Text style={{
                                fontSize: 14,
                                color: '#333',
                                fontFamily: 'Onest',
                                fontWeight: (option === 'Does not repeat' ? repeatOption === 'None' : repeatOption === option) ? '600' : '500',
                              }}>
                                {option}
                              </Text>
                              {(option === 'Does not repeat' ? repeatOption === 'None' : repeatOption === option) && (
                                <Ionicons name="checkmark" size={16} color="#00BCD4" />
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                        {repeatOption !== 'None' && (repeatOption as string) !== 'Custom' && (
                        <View style={{ borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 8 }}>
                            <TouchableOpacity
                              onPress={() => setShowEditInlineEndDatePicker(prev => !prev)}
                              style={{
                                backgroundColor: repeatEndDate ? '#f0f0f0' : 'transparent',
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 6,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Text style={{
                                fontSize: 14,
                                color: '#333',
                                fontFamily: 'Onest',
                                fontWeight: repeatEndDate ? '600' : '500',
                              }}>
                                {repeatEndDate ? `Ends ${repeatEndDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Set end date'}
                              </Text>
                              {repeatEndDate ? (
                                <Ionicons name="checkmark" size={16} color="#00BCD4" />
                              ) : (
                                <Ionicons name="calendar-outline" size={16} color="#666" />
                              )}
                            </TouchableOpacity>
                            {showEditInlineEndDatePicker && (
                              <View style={{
                                backgroundColor: '#ffffff',
                                borderRadius: 8,
                                padding: 8,
                                marginTop: 4,
                                borderWidth: 1,
                                borderColor: '#e0e0e0',
                              }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <TouchableOpacity
                                    onPress={() => {
                                      setRepeatEndDate(null);
                                      setShowEditInlineEndDatePicker(false);
                                    }}
                                    style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                                  >
                                    <Text style={{ fontSize: 12, color: '#FF6B6B', fontFamily: 'Onest', fontWeight: '500' }}>Clear</Text>
                                  </TouchableOpacity>
                                </View>
                          <DateTimePicker
                            value={repeatEndDate || new Date()}
                            mode="date"
                            display="spinner"
                            onChange={(event, selectedDate) => {
                              if (selectedDate) {
                                setRepeatEndDate(selectedDate);
                                      setShowEditInlineEndDatePicker(false);
                                      setShowRepeatPicker(false);
                              }
                            }}
                            style={{ height: 100, width: '100%' }}
                            textColor="#333"
                          />
                        </View>
                      )}
                          </View>
                        )}
                        </View>
                      )}
                    </View>
                      </>
                    ) : (
                      <>
                    {/* Custom Event Form */}
                    <View style={styles.modalCard}>
                      <Text style={styles.modalSectionHeader}>
                        Event Details
                      </Text>
                        <TextInput
                        style={styles.modalInput}
                        placeholder="Event Title"
                        placeholderTextColor="#888"
                          value={newEventTitle}
                          onChangeText={setNewEventTitle}
                        />

                      {/* Category Selection for Custom Events */}
                      <Text style={styles.modalSectionHeader}>
                        Category
                      </Text>
                          <TouchableOpacity
                            onPress={() => {
                              Keyboard.dismiss();
                            if (categories.length === 0) {
                              // If no categories exist, automatically show new category input
                              setShowAddCategoryForm(true);
                              setNewCategoryName('');
                              setNewCategoryColor(CATEGORY_COLORS[0]);
                              setShowCategoryPicker(false);
                            } else {
                              // If categories exist, toggle the category box
                              if (showCategoryPicker) {
                                setShowCategoryPicker(false);
                                setShowAddCategoryForm(false);
                                setNewCategoryName('');
                                setNewCategoryColor(CATEGORY_COLORS[0]);
                              } else {
                                setShowCategoryPicker(true);
                              }
                              }
                            }}
                            style={showCategoryPicker ? styles.modalCategoryButtonFocused : styles.modalCategoryButton}
                          >
                            {!showCategoryPicker ? (
                          <View style={styles.modalRowBetween}>
                              <View style={styles.modalRow}>
                                {selectedCategory ? (
                                  <>
                                    <View style={[
                                      styles.modalCategoryDotLarge,
                                      { backgroundColor: selectedCategory.color }
                                    ]} />
                                    <Text style={styles.modalCategoryText}>
                                      {selectedCategory.name}
                            </Text>
                                  </>
                                ) : (
                                  <Text style={styles.modalCategoryPlaceholder}>
                                  Choose category
                                  </Text>
                                )}
                            </View>
                            <Ionicons name="chevron-down" size={12} color="#999" />
                              </View>
                            ) : (
                              <View style={styles.modalWrapContainer}>
                              {categories.map((cat, idx) => (
                                  <Pressable
                                  key={idx}
                                  onPress={() => {
                                      setSelectedCategory(cat);
                                    setShowCategoryPicker(false);
                                      setShowAddCategoryForm(false);
                                    }}
                                  
                                  >
                                    <View style={[
                                      styles.modalCategoryDot,
                                      { backgroundColor: cat.color }
                                    ]} />
                                    <Text style={styles.modalCategoryText}>
                                      {cat.name}
                                    </Text>
                                  </Pressable>
                              ))}
                              <TouchableOpacity
                                onPress={() => setShowAddCategoryForm(true)}
                                style={styles.modalAddButton}
                              >
                                <Ionicons name="add" size={12} color="#666" />
                                <Text style={styles.modalFormSubtitle}>
                                  New
                                </Text>
                              </TouchableOpacity>
                          </View>
                        )}

                                {showAddCategoryForm && (
                                  <View style={styles.modalAddCategoryForm}>
                                    <Text style={styles.modalFormSectionTitle}>
                                      New Category
                                    </Text>
                                    <TextInput
                                        style={styles.modalAddCategoryInput}
                                        placeholder="Category name"
                                        value={newCategoryName}
                                        onChangeText={setNewCategoryName}
                                      />
                                      
                            {/* Color Picker */}
                                      <Text style={styles.modalFormSubtitle}>
                                        Color
                                      </Text>
                                      <View style={styles.modalColorPicker}>
                                        {CATEGORY_COLORS.map((color) => (
                                          <TouchableOpacity
                                            key={color}
                                            onPress={() => setNewCategoryColor(color)}
                                          style={[
                                            newCategoryColor === color ? styles.modalColorOptionSelected : styles.modalColorOption,
                                            { backgroundColor: color }
                                          ]}
                                          >
                                            {newCategoryColor === color && (
                                              <Ionicons name="checkmark" size={14} color="white" />
                                            )}
                                          </TouchableOpacity>
                                        ))}
                                      </View>

                            <View style={styles.modalFormActions}>
                                        <TouchableOpacity
                                          onPress={() => {
                                            setShowAddCategoryForm(false);
                                            setNewCategoryName('');
                                setNewCategoryColor(CATEGORY_COLORS[0]);
                                          }}
                                          style={styles.modalFormButton}
                                        >
                                          <Text style={styles.modalFormButtonText}>
                                            Cancel
                                          </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          onPress={async () => {
                                            if (newCategoryName.trim()) {
                                              const { data, error } = await supabase
                                                .from('categories')
                                                .insert([
                                                  {
                                                    label: newCategoryName.trim(),
                                                    color: newCategoryColor,
                                                    user_id: user?.id,
                                          type: 'calendar'
                                                  }
                                                ])
                                                .select();

                                              if (error) {
                                                
                                                return;
                                              }

                                              if (data) {
                                                const newCategory = {
                                                  id: data[0].id,
                                                  name: data[0].label,
                                                  color: data[0].color,
                                                };
                                                setCategories(prev => [...prev, newCategory]);
                                                setSelectedCategory(newCategory);
                                                setShowAddCategoryForm(false);
                                                setNewCategoryName('');
                                              setNewCategoryColor(CATEGORY_COLORS[0]);
                                              }
                                            }
                                          }}
                                          style={styles.modalFormButtonPrimary}
                                        >
                                          <Text style={styles.modalFormButtonTextPrimary}>
                                            Add
                                          </Text>
                                        </TouchableOpacity>
                                      </View>
                                </View>
                              )}
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                    
                    {/* Share with Friends Card */}
                    <View style={{
                      backgroundColor: 'white',
                      borderRadius: 12,
                      padding: 16,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                      elevation: 1,
                    }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: '#333',
                        marginBottom: 10,
                        fontFamily: 'Onest'
                      }}>
                        Friends
                      </Text>
                      
                      {/* Selected Friends Section */}
                      {selectedFriends.length > 0 && (
                        <View style={{ marginBottom: 12 }}>
                          <View style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 8,
                          }}>
                            {selectedFriends.map(friendId => {
                              const friend = friends.find(f => f.friend_id === friendId);
                              if (!friend) return null;
                              
                              return (
                                <View key={friendId} style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  backgroundColor: '#00ACC1',
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 16,
                                  gap: 6,
                                }}>
                                  {friend.friend_avatar && friend.friend_avatar.trim() !== '' ? (
                                    <Image 
                                      source={{ uri: friend.friend_avatar }} 
                                      style={{ width: 16, height: 16, borderRadius: 8 }} 
                                    />
                                  ) : (
                                    <View 
                                      style={{ 
                                        width: 16, 
                                        height: 16, 
                                        borderRadius: 8,
                                        backgroundColor: 'rgba(255,255,255,0.2)',
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                      }}
                                    >
                                      <Ionicons name="person" size={8} color="white" />
                                    </View>
                                  )}
                                  <Text style={{ 
                                    fontSize: 12, 
                                    color: 'white', 
                                    fontFamily: 'Onest',
                                    fontWeight: '500'
                                  }}>
                                    {friend.friend_name}
                                  </Text>
                                  <TouchableOpacity
                                    onPress={() => {
                                      setSelectedFriends(prev => prev.filter(id => id !== friendId));
                                    }}
                                    style={{
                                      marginLeft: 2,
                                    }}
                                  >
                                    <Ionicons name="close" size={12} color="white" />
                                  </TouchableOpacity>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      )}
                      
                      <TextInput
                        ref={eventFriendsSearchInputRef}
                        placeholder="Search friends..."
                        value={searchFriend}
                        onChangeText={setSearchFriend}
                        onFocus={() => {
                          setIsSearchFocused(true);
                        // Automatic scroll to friends section
                        setTimeout(() => {
                          eventModalScrollViewRef.current?.scrollTo({ 
                            y: 3000, // Very dramatic scroll up
                            animated: true 
                          });
                        }, 100);
                        }}
                        onBlur={() => setIsSearchFocused(false)}
                        style={{
                          backgroundColor: '#f8f9fa',
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          fontSize: 14,
                          marginBottom: 10,
                          fontFamily: 'Onest',
                          color: '#333',
                          borderWidth: 1,
                          borderColor: '#e9ecef',
                        }}
                        placeholderTextColor="#999"
                      />
                      {/* Always show friends list */}
                      {true && (
                        <FlatList
                          data={getFilteredFriends().filter(friend => !selectedFriends.includes(friend.friend_id))}
                          keyExtractor={item => `${item.friend_id}-${item.friendship_id}`}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={{
                                marginRight: 3,
                                alignItems: 'center',
                                opacity: selectedFriends.includes(item.friend_id) ? 0.5 : 1,
                                paddingVertical: 3,
                                paddingHorizontal: 6,
                                borderRadius: 6,
                                backgroundColor: 'transparent',
                                borderWidth: selectedFriends.includes(item.friend_id) ? 1 : 0,
                                borderColor: '#00BCD4',
                              }}
                              onPress={() => {
                                setSelectedFriends(prev =>
                                  prev.includes(item.friend_id)
                                    ? prev.filter(id => id !== item.friend_id)
                                    : [...prev, item.friend_id]
                                );
                                // Clear search when a friend is selected
                                setSearchFriend('');
                              }}
                            >
                              {item.friend_avatar && item.friend_avatar.trim() !== '' ? (
                                <Image 
                                  source={{ uri: item.friend_avatar }} 
                                  style={{ width: 32, height: 32, borderRadius: 16, marginBottom: 6 }} 
                                />
                              ) : (
                                <View 
                                  style={{ 
                                    width: 32, 
                                    height: 32, 
                                    borderRadius: 16, 
                                    marginBottom: 6,
                                    backgroundColor: '#E9ECEF',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                  }}
                                >
                                  <Ionicons name="person" size={14} color="#6C757D" />
                                </View>
                              )}
                              <Text style={{ fontSize: 10, fontFamily: 'Onest', color: '#495057', fontWeight: '500' }}>{item.friend_name}</Text>
                            </TouchableOpacity>
                          )}
                          ListEmptyComponent={
                            <View style={{ 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              paddingVertical: 16,
                              minWidth: 180
                            }}>
                              <Ionicons name="people-outline" size={20} color="#CED4DA" />
                              <Text style={{ color: '#6C757D', fontSize: 11, marginTop: 4, fontFamily: 'Onest' }}>
                                No friends found
                              </Text>
                            </View>
                          }
                        style={{ minHeight: 70 }}
                        />
                      )}
                    </View>
                    
                    </ScrollView>
                  </View>
          </SafeAreaView>
        </Modal>

        {/* Edit Event Modal */}
        <Modal
          animationType="slide"
          transparent={false}
          visible={showEditEventModal}
          onRequestClose={() => setShowEditEventModal(false)}
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: '#fafafa' }}>
            <View style={{ flex: 1 }}>
              {/* Edit Header */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                paddingHorizontal: 16,
                paddingVertical: 12,
                paddingTop: 40,
                backgroundColor: editedSelectedCategory?.color ? editedSelectedCategory.color + '40' : 'white',
              }}>
                        <TouchableOpacity 
                          onPress={() => {
                    setShowEditEventModal(false);
                    setEditingEvent(null);
                    setSelectedEvent(null);
                  }}
                  style={styles.modalHeaderButton}
                >
                  <Ionicons name="close" size={16} color="#666" />
                </TouchableOpacity>
                
                <Text style={styles.modalHeaderTitle}>
                  Edit Event
                </Text>
                
                <TouchableOpacity 
                  onPress={() => handleEditEvent()}
                  disabled={!editedEventTitle.trim()}
                  style={[
                    styles.modalHeaderButton,
                    { backgroundColor: editedEventTitle.trim() ? '#00BCD4' : '#ffffff' }
                  ]}
                >
                  <Ionicons 
                    name="checkmark" 
                    size={16} 
                    color={editedEventTitle.trim() ? 'white' : '#999'} 
                  />
                </TouchableOpacity>
                    </View>

              {/* Edit Content */}
              <ScrollView 
                ref={editEventModalScrollViewRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ 
                  padding: 16, 
                  paddingBottom: 380, // Increased bottom padding for better scrolling with keyboard
                  minHeight: '100%' // Ensures content is scrollable even when short
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
                bounces={true}
                alwaysBounceVertical={true}
                scrollEventThrottle={16}
                keyboardDismissMode="interactive"
              >
                {/* Event Title Card */}
                <View style={styles.modalCard}>
                    <TextInput
                    style={styles.modalInput}
                    placeholder="Event Title"
                    placeholderTextColor="#888"
                      value={editedEventTitle}
                      onChangeText={setEditedEventTitle}
                    />

                    <TextInput
                    style={styles.modalInputDescription}
                    placeholder="Description"
                    placeholderTextColor="#999"
                      value={editedEventDescription}
                      onChangeText={setEditedEventDescription}
                      multiline
                    numberOfLines={3}
                  />

                  <TextInput
                            style={styles.modalInputLocation}
                            placeholder="Location"
                            placeholderTextColor="#999"
                            value={editedEventLocation}
                            onChangeText={setEditedEventLocation}
                          />
                </View>

                {/* Time & Date Card */}
                <View style={styles.modalCard}>
                  {/* All Day Toggle */}
                              <View style={styles.modalToggleRow}>
                                    <Text style={styles.modalLabel}>
                      All-day event
                                    </Text>
                    <View style={{ transform: [{ scale: 0.8 }] }}>
                      <Switch 
                        value={isEditedAllDay} 
                        onValueChange={setIsEditedAllDay}
                        trackColor={{ false: 'white', true: '#00BCD4' }}
                        thumbColor={isEditedAllDay ? 'white' : '#f4f3f4'}
                      />
                    </View>
                  </View>

                  {/* Start & End Time */}
                  <View style={styles.modalGapContainer}>
                    <View>
                                    <View style={styles.modalTimeRow}>
                                        <Text style={styles.modalLabel}>
                          Starts
                                        </Text>
                                      <TouchableOpacity
                          onPress={() => {
                            if (showStartPicker) {
                              setShowStartPicker(false);
                            } else {
                              setShowStartPicker(true);
                              setShowEndPicker(false);
                                          }
                                        }}
                                        style={showStartPicker ? styles.modalTimeButtonFocused : styles.modalTimeButton}
                                      >
                                        <Text style={styles.modalTimeText}>
                              {editedStartDateTime.toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                ...(isEditedAllDay ? {} : {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })
                              }).replace(',', ' ·')}
                            </Text>
                          </TouchableOpacity>
                      </View>
                        </View>

                    <View>
                      <View style={styles.modalTimeRow}>
                        <Text style={styles.modalLabel}>
                          Ends
                        </Text>
                          <TouchableOpacity
                            onPress={() => {
                            if (showEndPicker) {
                              setShowEndPicker(false);
                            } else {
                              setShowEndPicker(true);
                                setShowStartPicker(false);
                              }
                            }}
                          style={showEndPicker ? styles.modalTimeButtonFocused : styles.modalTimeButton}
                        >
                          <Text style={styles.modalTimeText}>
                              {editedEndDateTime.toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                ...(isEditedAllDay ? {} : {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })
                              }).replace(',', ' ·')}
                            </Text>
                          </TouchableOpacity>
                      </View>
                        </View>
                      </View>

                      {/* Date/Time Picker */}
                      {(showStartPicker || showEndPicker) && (
                    <View style={styles.modalPickerContainer}>
                          <DateTimePicker
                            value={showStartPicker ? editedStartDateTime : editedEndDateTime}
                            mode={isEditedAllDay ? "date" : "datetime"}
                            display="spinner"
                            onChange={(event, selectedDate) => {
                          if (selectedDate) {
                              if (showStartPicker) {
                                console.log('🔍 [Calendar] Edit modal date picker - updating editedStartDateTime:', {
                                  oldEditedStartDateTime: editedStartDateTime.toISOString(),
                                  newEditedStartDateTime: selectedDate.toISOString(),
                                  oldDate: getLocalDateString(editedStartDateTime),
                                  newDate: getLocalDateString(selectedDate)
                                });
                              setEditedStartDateTime(selectedDate);
                              if (editedEndDateTime < selectedDate) {
                                const newEnd = new Date(selectedDate);
                                newEnd.setHours(newEnd.getHours() + 1);
                                setEditedEndDateTime(newEnd);
                              }
                                  debouncePickerClose('start');
                              } else {
                                console.log('🔍 [Calendar] Edit modal date picker - updating editedEndDateTime:', {
                                  oldEditedEndDateTime: editedEndDateTime.toISOString(),
                                  newEditedEndDateTime: selectedDate.toISOString()
                                });
                              setEditedEndDateTime(selectedDate);
                                  debouncePickerClose('end');
                                }
                              }
                            }}
                        style={{ height: isEditedAllDay ? 40 : 60, width: '100%' }}
                            textColor="#333"
                          />
                          </View>
                        )}
                      </View>

                {/* Category Card */}
                <View style={styles.modalCard}>
                  <Text style={styles.modalSectionHeader}>
                    Category
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      if (categories.length === 0) {
                        // If no categories exist, automatically show new category input
                        setShowAddCategoryForm(true);
                        setNewCategoryName('');
                        setNewCategoryColor(CATEGORY_COLORS[0]);
                        setShowCategoryPicker(false);
                      } else {
                        // If categories exist, toggle the category box
                      if (showCategoryPicker) {
                          setShowCategoryPicker(false);
                        setShowAddCategoryForm(false);
                        setNewCategoryName('');
                          setNewCategoryColor(CATEGORY_COLORS[0]);
                        } else {
                          setShowCategoryPicker(true);
                        }
                      }
                    }}
                    style={showCategoryPicker ? styles.modalCategoryButtonFocused : styles.modalCategoryButton}
                  >
                    {!showCategoryPicker ? (
                      <View style={styles.modalRowBetween}>
                        <View style={styles.modalRow}>
                          {editedSelectedCategory ? (
                            <>
                              <View style={[
                                styles.modalCategoryDotLarge,
                                { backgroundColor: editedSelectedCategory.color }
                              ]} />
                              <Text style={styles.modalCategoryText}>
                                {editedSelectedCategory.name}
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.modalCategoryPlaceholder}>
                              Choose category
                            </Text>
                          )}
                        </View>
                        <Ionicons name="chevron-down" size={12} color="#999" />
                      </View>
                    ) : (
                      <View style={styles.modalWrapContainer}>
                        {categories.map((cat, idx) => (
                          <Pressable
                            key={idx}
                            onPress={() => {
                              setEditedSelectedCategory(cat);
                              setShowCategoryPicker(false);
                              setShowAddCategoryForm(false);
                            }}
                            onLongPress={() => handleCategoryLongPress(cat)}
                            style={[
                              editedSelectedCategory?.name === cat.name ? styles.modalCategoryChipSelected : styles.modalCategoryChip,
                              { backgroundColor: editedSelectedCategory?.name === cat.name ? cat.color + '20' : '#f8f9fa' }
                            ]}
                          >
                            <View style={[
                              styles.modalCategoryDot,
                              { backgroundColor: cat.color }
                            ]} />
                            <Text style={editedSelectedCategory?.name === cat.name ? styles.modalCategoryChipTextSelected : styles.modalCategoryChipText}>
                              {cat.name}
                            </Text>
                          </Pressable>
                        ))}
                        <TouchableOpacity
                          onPress={() => setShowAddCategoryForm(true)}
                          style={styles.modalAddButton}
                        >
                          <Ionicons name="add" size={10} color="#666" />
                        </TouchableOpacity>
                      </View>
                    )}

                    {showAddCategoryForm && (
                      <View style={styles.modalAddCategoryForm}>
                        <Text style={styles.modalFormSectionTitle}>
                          New Category
                        </Text>
                        <TextInput
                          style={styles.modalAddCategoryInput}
                          placeholder="Category name"
                          value={newCategoryName}
                          onChangeText={setNewCategoryName}
                        />
                        
                        {/* Color Picker */}
                        <Text style={styles.modalFormSubtitle}>
                          Color
                        </Text>
                        <View style={styles.modalColorPicker}>
                          {CATEGORY_COLORS.map((color) => (
                            <TouchableOpacity
                              key={color}
                              onPress={() => setNewCategoryColor(color)}
                              style={[
                                newCategoryColor === color ? styles.modalColorOptionSelected : styles.modalColorOption,
                                { backgroundColor: color }
                              ]}
                            >
                              {newCategoryColor === color && (
                                <Ionicons name="checkmark" size={14} color="white" />
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>

                        <View style={styles.modalFormActions}>
                          <TouchableOpacity
                            onPress={() => {
                              setShowAddCategoryForm(false);
                              setNewCategoryName('');
                              setNewCategoryColor(CATEGORY_COLORS[0]);
                            }}
                            style={styles.modalFormButton}
                          >
                            <Text style={styles.modalFormButtonText}>
                              Cancel
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={async () => {
                              if (newCategoryName.trim()) {
                                const { data, error } = await supabase
                                  .from('categories')
                                  .insert([
                                    {
                                      label: newCategoryName.trim(),
                                      color: newCategoryColor,
                                      user_id: user?.id,
                                      type: 'calendar'
                                    }
                                  ])
                                  .select();

                                if (error) {
                                  return;
                                }

                                if (data) {
                                  const newCategory = {
                                    id: data[0].id,
                                    name: data[0].label,
                                    color: data[0].color,
                                  };
                                  setCategories(prev => [...prev, newCategory]);
                                  setEditedSelectedCategory(newCategory);
                                  setShowAddCategoryForm(false);
                                  setNewCategoryName('');
                                  setNewCategoryColor(CATEGORY_COLORS[0]);
                                }
                              }
                            }}
                            style={styles.modalFormButtonPrimary}
                          >
                            <Text style={styles.modalFormButtonTextPrimary}>
                              Add
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Options Card */}
                <View style={styles.modalCard}>
                  
                  <View style={styles.modalGapContainer}>
                    {/* Reminder */}
                    <View>
                      <View style={styles.modalTimeRow}>
                        <Text style={styles.modalLabel}>
                          Reminder
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            if (showReminderPicker) {
                              setShowReminderPicker(false);
                                  } else {
                              setShowReminderPicker(true);
                                  setShowReminderOptions(false);
                              setShowRepeatPicker(false);
                              setShowEndDatePicker(false);
                            }
                                }}
                          style={showReminderPicker ? styles.modalTimeButtonFocused : styles.modalTimeButton}
                              >
                          <Text style={styles.modalTimeText}>
                            {editedReminderTime ? editedReminderTime.toLocaleString([], { 
                              month: 'short', 
                              day: 'numeric', 
                              hour: 'numeric', 
                              minute: '2-digit', 
                              hour12: true 
                            }) : 'No reminder'}
                                </Text>
                              </TouchableOpacity>
                      </View>
                      {showReminderPicker && (
                        <View style={styles.modalPickerContainer}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 0 }}>
                            <DateTimePicker
                              value={editedReminderTime || new Date()}
                              mode="datetime"
                              display="spinner"
                              onChange={(event, selectedDate) => {
                                if (selectedDate) {
                                  setEditedReminderTime(selectedDate);
                                  debouncePickerClose('reminder');
                                }
                              }}
                              style={{ height: 120, width: '100%' }}
                              textColor="#333"
                            />
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Repeat */}
                    <View>
                      <View style={styles.modalTimeRow}>
                        <Text style={styles.modalLabel}>
                          Repeat
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            const newRepeatPickerState = !showRepeatPicker;
                            setShowRepeatPicker(newRepeatPickerState);
                            if (newRepeatPickerState) {
                              setShowReminderPicker(false);
                              setShowEndDatePicker(false);
                            }
                          }}
                          style={showRepeatPicker ? styles.modalTimeButtonFocused : styles.modalTimeButton}
                        >
                            <Text style={styles.modalTimeText}>
                            {editedRepeatOption === 'None' ? 'Does not repeat' : editedRepeatOption}
                            </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* End Date (if repeating) */}
                    {editedRepeatOption !== 'None' && (
                      <View>
                        <View style={styles.modalTimeRow}>
                          <Text style={styles.modalLabel}>
                            End Date
                          </Text>
                      <TouchableOpacity
                        onPress={() => {
                              const newEndDatePickerState = !showEndDatePicker;
                              setShowEndDatePicker(newEndDatePickerState);
                              if (newEndDatePickerState) {
                                setShowReminderPicker(false);
                                setShowRepeatPicker(false);
                              }
                            }}
                            style={showEndDatePicker ? styles.modalTimeButtonFocused : styles.modalTimeButton}
                          >
                            <Text style={styles.modalTimeText}>
                              {editedRepeatEndDate ? editedRepeatEndDate.toLocaleDateString([], { 
                                month: 'short', 
                                day: 'numeric', 
                                year: '2-digit' 
                              }) : 'No end date'}
                            </Text>
                      </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Picker Components */}
                  {showRepeatPicker && (
                    <View style={styles.modalCategoryPicker}>
                      {['Does not repeat', 'Daily', 'Weekly', 'Monthly', 'Yearly'].map((option) => (
                      <TouchableOpacity 
                        key={option}
                        onPress={() => {
                          setEditedRepeatOption(option === 'Does not repeat' ? 'None' : option as RepeatOption);
                          debouncePickerClose('repeat');
                        }}
                        style={(option === 'Does not repeat' ? editedRepeatOption === 'None' : editedRepeatOption === option) ? styles.modalCategoryOptionSelected : styles.modalCategoryOption}
                      >
                        <Text style={(option === 'Does not repeat' ? editedRepeatOption === 'None' : editedRepeatOption === option) ? styles.modalCategoryOptionTextSelected : styles.modalCategoryOptionText}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {showEndDatePicker && (
                    <View style={styles.modalPickerContainer}>
                      <DateTimePicker
                        value={repeatEndDate || new Date()}
                        mode="date"
                        display="spinner"
                        onChange={(event, selectedDate) => {
                          if (selectedDate) {
                            setRepeatEndDate(selectedDate);
                            debouncePickerClose('endDate');
                          }
                        }}
                        style={{ height: 100, width: '100%' }}
                        textColor="#333"
                      />
                </View>
                  )}
              </View>

               
                {/* Share with Friends Card */}
                <View style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  padding: 16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}>
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#333',
                    marginBottom: 10,
                    fontFamily: 'Onest'
                  }}>
                    Friends
                  </Text>
                  
                  {/* Selected Friends Section */}
                  {editSelectedFriends.length > 0 && (
                    <View style={{ marginBottom: 12 }}>
                      <View style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}>
                        {editSelectedFriends.map(friendId => {
                          const friend = friends.find(f => f.friend_id === friendId);
                          if (!friend) return null;
                          
                          return (
                            <View key={friendId} style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: '#00BCD4',
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 16,
                              gap: 6,
                            }}>
                              {friend.friend_avatar && friend.friend_avatar.trim() !== '' ? (
                                <Image 
                                  source={{ uri: friend.friend_avatar }} 
                                  style={{ width: 16, height: 16, borderRadius: 8 }} 
                                />
                              ) : (
                                <View 
                                  style={{ 
                                    width: 16, 
                                    height: 16, 
                                    borderRadius: 8,
                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                  }}
                                >
                                  <Ionicons name="person" size={8} color="white" />
                                </View>
                              )}
                              <Text style={{ 
                                fontSize: 12, 
                                color: 'white', 
                                fontFamily: 'Onest',
                                fontWeight: '500'
                              }}>
                                {friend.friend_name}
                              </Text>
                              <TouchableOpacity
                                onPress={() => {
                                  setEditSelectedFriends(prev => prev.filter(id => id !== friendId));
                                }}
                                style={{
                                  marginLeft: 2,
                                }}
                              >
                                <Ionicons name="close" size={12} color="white" />
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                  
                  <TextInput
                    placeholder="Search friends..."
                    value={editSearchFriend}
                    onChangeText={setEditSearchFriend}
                    onFocus={() => {
                      setEditIsSearchFocused(true);
                      // Scroll to friends section when keyboard appears
                      setTimeout(() => {
                        editEventModalScrollViewRef.current?.scrollToEnd({ 
                          animated: true 
                        });
                        // Then scroll back up to position friends section above keyboard
                        setTimeout(() => {
                          editEventModalScrollViewRef.current?.scrollTo({ 
                            y: 8000, // Very dramatic scroll to ensure friends section is visible
                            animated: true 
                          });
                        }, 100);
                      }, 100);
                    }}
                    onBlur={() => setEditIsSearchFocused(false)}
                    style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 14,
                      marginBottom: 10,
                      fontFamily: 'Onest',
                      color: '#333',
                      borderWidth: 1,
                      borderColor: '#e9ecef',
                    }}
                    placeholderTextColor="#999"
                  />
                  {/* Always show friends list */}
                  {true && (
                    <FlatList
                      data={friends.filter(f =>
                        (f.friend_name.toLowerCase().includes(editSearchFriend.toLowerCase()) ||
                        f.friend_username.toLowerCase().includes(editSearchFriend.toLowerCase())) &&
                        !editSelectedFriends.includes(f.friend_id)
                      )}
                      keyExtractor={item => `${item.friend_id}-${item.friendship_id}`}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={{
                            marginRight: 3,
                            alignItems: 'center',
                            opacity: editSelectedFriends.includes(item.friend_id) ? 0.5 : 1,
                            paddingVertical: 3,
                            paddingHorizontal: 6,
                            borderRadius: 6,
                            backgroundColor: 'transparent',
                            borderWidth: editSelectedFriends.includes(item.friend_id) ? 1 : 0,
                            borderColor: '#00BCD4',
                          }}
                          onPress={() => {
                            setEditSelectedFriends(prev =>
                              prev.includes(item.friend_id)
                                ? prev.filter(id => id !== item.friend_id)
                                : [...prev, item.friend_id]
                            );
                            // Clear search when a friend is selected
                            setEditSearchFriend('');
                          }}
                        >
                          {item.friend_avatar && item.friend_avatar.trim() !== '' ? (
                            <Image 
                              source={{ uri: item.friend_avatar }} 
                              style={{ width: 32, height: 32, borderRadius: 16, marginBottom: 6 }} 
                            />
                          ) : (
                            <View 
                              style={{ 
                                width: 32, 
                                height: 32, 
                                borderRadius: 16, 
                                marginBottom: 6,
                                backgroundColor: '#E9ECEF',
                                justifyContent: 'center',
                                alignItems: 'center'
                              }}
                            >
                              <Ionicons name="person" size={14} color="#6C757D" />
                            </View>
                          )}
                          <Text style={{ fontSize: 10, fontFamily: 'Onest', color: '#495057', fontWeight: '500' }}>{item.friend_name}</Text>
                        </TouchableOpacity>
                      )}
                      ListEmptyComponent={
                        <View style={{ 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          paddingVertical: 16,
                          minWidth: 180
                        }}>
                          <Ionicons name="people-outline" size={20} color="#CED4DA" />
                          <Text style={{ color: '#6C757D', fontSize: 11, marginTop: 4, fontFamily: 'Onest' }}>
                            No friends found
                          </Text>
                        </View>
                      }
                      style={{ minHeight: 70 }}
                    />
                  )}
                </View>

                 {/* Delete Button and Save Button Row */}
                 <View style={styles.modalActionRow}>
                 <TouchableOpacity
                  onPress={async () => {
                    if (selectedEvent?.event.id) {
                      try {
                        await handleDeleteEvent(selectedEvent.event.id);
                        setShowEditEventModal(false);
                        setSelectedEvent(null);
                        setEditingEvent(null);
                      } catch (error) {
                        Alert.alert('Error', 'Failed to delete event. Please try again.');
                      }
                    }
                  }}
                  style={styles.modalDeleteButton}
                >
                  <Text style={styles.modalDeleteButtonText}>
                       Delete
                  </Text>
                </TouchableOpacity>
                   <TouchableOpacity
                     onPress={() => handleEditEvent()}
                     disabled={!editedEventTitle.trim()}
                     style={[styles.modalFormButtonPrimary, { opacity: editedEventTitle.trim() ? 1 : 0.5 }]}
                   >
                     <Text style={styles.modalFormButtonTextPrimary}>Save</Text>
                   </TouchableOpacity>
                 </View>

              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>

              {/* Photo Viewer Modal with Zoom/Pan */}
      <Modal
        visible={showPhotoViewer && selectedPhotoForViewing !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          try {
            setShowPhotoViewer(false);
            setSelectedPhotoForViewing(null);
          } catch (error) {
            console.error('Error closing photo viewer:', error);
          }
        }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(255,255,255,0.95)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          {/* Swipe Down Overlay */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 5,
            }}
            {...photoViewerPanResponder.panHandlers}
          />
          
          {/* Top Bar */}
          <View style={{
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
          }}>
            <TouchableOpacity
              style={{
                width: 32,
                height: 32,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={() => {
                try {
                  setShowPhotoViewer(false);
                  setSelectedPhotoForViewing(null);
                } catch (error) {
                  console.error('Error closing photo viewer:', error);
                }
              }}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={{
                width: 32,
                height: 32,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={() => {
                if (selectedPhotoForViewing) {
                  Alert.alert(
                    'Delete Photo',
                    'Are you sure you want to delete this photo?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Delete', 
                        style: 'destructive',
                        onPress: () => {
                          handlePhotoViewerDelete(selectedPhotoForViewing.event.id, selectedPhotoForViewing.photoUrl);
                        }
                      }
                    ]
                  );
                }
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
          
          {/* Photo Counter */}
          {selectedPhotoForViewing?.event.photos && selectedPhotoForViewing.event.photos.length > 1 && (
            <View style={{
              position: 'absolute',
              top: 100,
              left: 0,
              right: 0,
              alignItems: 'center',
              zIndex: 10,
            }}>
              <Text style={{ 
                color: '#666', 
                fontSize: 14, 
                fontWeight: '400',
                fontFamily: 'Onest',
                backgroundColor: 'rgba(0,0,0,0.05)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
              }}>
                {selectedPhotoForViewing.event.photos!.indexOf(selectedPhotoForViewing.photoUrl) + 1} of {selectedPhotoForViewing.event.photos!.length}
              </Text>
            </View>
          )}
          
          {/* Main Photo Display */}
          {selectedPhotoForViewing?.event?.photos && selectedPhotoForViewing.event.photos.length > 0 && (
            <FlatList
              ref={photoViewerFlatListRef}
              data={selectedPhotoForViewing.event.photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, idx) => item + idx}
              getItemLayout={(_, index) => ({ length: Dimensions.get('window').width, offset: Dimensions.get('window').width * index, index })}
              onMomentumScrollEnd={e => {
                try {
                const width = e.nativeEvent.layoutMeasurement.width;
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                  const photoUrl = selectedPhotoForViewing?.event?.photos?.[index];
                  if (photoUrl && photoUrl !== selectedPhotoForViewing?.photoUrl) {
                  setSelectedPhotoForViewing({
                    event: selectedPhotoForViewing.event,
                    photoUrl,
                  });
                  }
                } catch (error) {
                  console.error('Error in onMomentumScrollEnd:', error);
                }
              }}
              renderItem={({ item }) => (
                <View style={{ 
                  width: Dimensions.get('window').width, 
                  height: '100%', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  paddingHorizontal: 32,
                }}>
                  <Image
                    source={{ uri: item }}
                    style={{
                      width: '100%',
                      height: '75%',
                      resizeMode: 'contain',
                    }}
                    onError={(error) => {
                      console.error('Image loading error:', error);
                    }}
                  />
                </View>
              )}
              style={{ width: Dimensions.get('window').width, height: '100%' }}
            />
          )}
          
          {/* Bottom Thumbnails */}
          {selectedPhotoForViewing?.event.photos && selectedPhotoForViewing.event.photos.length > 1 && (
            <View style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              paddingVertical: 24,
              paddingHorizontal: 24,
              zIndex: 10,
            }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  alignItems: 'center',
                  gap: 12,
                }}
                style={{
                  maxWidth: '100%',
                }}
              >
                {selectedPhotoForViewing.event.photos.map((photoUrl, index) => {
                  const isSelected = photoUrl === selectedPhotoForViewing.photoUrl;
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        try {
                        setSelectedPhotoForViewing({
                          event: selectedPhotoForViewing.event,
                          photoUrl: photoUrl
                        });
                        // Scroll to the selected photo
                        photoViewerFlatListRef.current?.scrollToIndex({
                          index: index,
                          animated: true,
                        });
                        } catch (error) {
                          console.error('Error selecting thumbnail:', error);
                        }
                      }}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 6,
                        overflow: 'hidden',
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? '#00BCD4' : '#E5E5E7',
                        backgroundColor: '#F2F2F7',
                      }}
                    >
                      <Image
                        source={{ uri: photoUrl }}
                        style={{
                          width: '100%',
                          height: '100%',
                          resizeMode: 'cover',
                        }}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      {/* Shared Events Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showSharedEventsModal}
        onRequestClose={() => setShowSharedEventsModal(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.light.background }}>
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              paddingHorizontal: 12,
              paddingVertical: 8,
              paddingTop: 40,
              backgroundColor: Colors.light.background,
            }}>
              <TouchableOpacity 
                onPress={() => setShowSharedEventsModal(false)}
                style={{
                  width: 28,
                  height: 28,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="close" size={16} color={Colors.light.icon} />
              </TouchableOpacity>
              
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: Colors.light.text,
                fontFamily: 'Onest'
              }}>
                Shared Events
              </Text>
              
              <TouchableOpacity 
                onPress={() => {
                  updatePendingSharedEvents();
                }}
              style={{
                  width: 28,
                  height: 28,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="refresh" size={16} color={Colors.light.icon} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={{ flex: 1, padding: 16 }}>
              {(() => {
                console.log('🔍 [Shared Events Modal] Rendering modal with state:', {
                  receivedSharedEvents: receivedSharedEvents.length,
                  sentSharedEvents: sentSharedEvents.length,
                  pendingSharedEvents: pendingSharedEvents.length,
                  user: user?.id
                });
                return null;
              })()}

            {/* Tab Navigation */}
            <View style={{
              flexDirection: 'row',
                backgroundColor: Colors.light.surfaceVariant,
                borderRadius: 8,
                padding: 4,
              marginBottom: 20,
            }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 6,
                    backgroundColor: activeSharedEventsTab === 'received' ? Colors.light.background : 'transparent',
                  alignItems: 'center',
                }}
                  onPress={() => setActiveSharedEventsTab('received')}
              >
                <Text style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: activeSharedEventsTab === 'received' ? '#0f172a' : Colors.light.icon,
                    textTransform: 'uppercase',
                    letterSpacing: 0.3,
                  fontFamily: 'Onest',
                }}>
                  Received ({receivedSharedEvents.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 6,
                    backgroundColor: activeSharedEventsTab === 'sent' ? Colors.light.background : 'transparent',
                  alignItems: 'center',
                }}
                  onPress={() => setActiveSharedEventsTab('sent')}
              >
                <Text style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: activeSharedEventsTab === 'sent' ? '#0f172a' : Colors.light.icon,
                    textTransform: 'uppercase',
                    letterSpacing: 0.3,
                  fontFamily: 'Onest',
                }}>
                  Sent ({sentSharedEvents.length})
                </Text>
              </TouchableOpacity>
            </View>

              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {activeSharedEventsTab === 'received' ? (
                  <View>
                    {receivedSharedEvents.length === 0 ? (
                      <View style={{ 
                        backgroundColor: '#ffffff', // Clean white background
                        borderRadius: 12,
                        padding: 20,
                        borderWidth: 1,
                        borderColor: '#e2e8f0', // Subtle gray border
                        alignItems: 'center', 
                        marginTop: 20,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 3,
                        elevation: 1,
                      }}>
                        <Text style={{ 
                          fontSize: 15,
                          color: '#64748b', // Medium gray text
                          fontFamily: 'Onest',
                          textAlign: 'center',
                          fontWeight: '500',
                        }}>
                          No received events
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 12 }}>
                        {receivedSharedEvents.map((event) => (
                          <TouchableOpacity
                            key={event.id}
                            onPress={() => {
                              setShowSharedEventsModal(false);
                              handleLongPress(event);
                            }}
                            style={{
                              backgroundColor: '#ffffff', // Clean white background
                              borderRadius: 12,
                              padding: 16,
                            borderWidth: 1,
                              borderColor: '#e2e8f0', // Subtle gray border
                            shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.05,
                              shadowRadius: 3,
                              elevation: 1,
                            }}
                            activeOpacity={0.7}
                          >
                              <Text style={{
                              fontSize: 16,
                                fontWeight: '600',
                              color: '#1e293b', // Dark gray text
                              marginBottom: 6,
                                fontFamily: 'Onest',
                              }}>
                                {event.title}
                              </Text>
                                <Text style={{
                                  fontSize: 13,
                              color: '#64748b', // Medium gray text
                                  fontFamily: 'Onest',
                              marginBottom: 8,
                                }}>
                              {event.date} • Shared by {event.sharedByFullName || event.sharedByUsername || 'Unknown'}
                                </Text>
                            {event.sharedStatus === 'pending' && (
                              <View style={{
                                flexDirection: 'row',
                                gap: 10,
                                marginTop: 8,
                            }}>
                              <TouchableOpacity
                                  onPress={() => handleAcceptSharedEvent(event)}
                                style={{
                                    backgroundColor: '#00b4d8', // Keep turquoise for primary action
                                    paddingHorizontal: 16,
                                  paddingVertical: 8,
                                  borderRadius: 8,
                                    shadowColor: '#00b4d8',
                                  shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.15,
                                  shadowRadius: 4,
                                  elevation: 2,
                                }}
                              >
                                <Text style={{
                                    color: 'white',
                                  fontSize: 13,
                                  fontWeight: '600',
                                  fontFamily: 'Onest',
                                }}>
                                  Accept
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                  onPress={() => handleDeclineSharedEvent(event)}
                                style={{
                                    backgroundColor: '#f8fafc', // Light gray background
                                    paddingHorizontal: 16,
                                  paddingVertical: 8,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                    borderColor: '#e2e8f0',
                                }}
                              >
                                <Text style={{
                                    color: '#64748b', // Gray text
                                  fontSize: 13,
                                  fontWeight: '600',
                                  fontFamily: 'Onest',
                                }}>
                                  Decline
                                </Text>
                              </TouchableOpacity>
                            </View>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                </View>
                ) : (
                  <View>
                    {sentSharedEvents.length === 0 ? (
                      <View style={{ 
                        backgroundColor: '#ffffff', // Clean white background
                        borderRadius: 12,
                        padding: 20,
                        borderWidth: 1,
                        borderColor: '#e2e8f0', // Subtle gray border
                        alignItems: 'center', 
                        marginTop: 20,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 3,
                        elevation: 1,
                      }}>
                        <Text style={{ 
                          fontSize: 15,
                          color: '#64748b', // Medium gray text
                          fontFamily: 'Onest',
                          textAlign: 'center',
                          fontWeight: '500',
                        }}>
                          No sent events
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 12 }}>
                        {sentSharedEvents.map((event) => (
                          <TouchableOpacity
                            key={event.id}
                            onPress={() => {
                              setShowSharedEventsModal(false);
                              handleLongPress(event);
                            }}
                            style={{
                              backgroundColor: '#ffffff', // Clean white background
                              borderRadius: 12,
                              padding: 16,
                              marginBottom: 12,
                            borderWidth: 1,
                              borderColor: '#e2e8f0', // Subtle gray border
                            shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.05,
                              shadowRadius: 3,
                              elevation: 1,
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 8,
                            }}>
                              <Text style={{
                                fontSize: 16,
                                fontWeight: '600',
                                color: '#1e293b', // Dark gray text
                                fontFamily: 'Onest',
                                flex: 1,
                              }}>
                                {event.title}
                              </Text>
                              <View style={{
                                backgroundColor: event.sharedStatus === 'pending' ? '#fef3c7' : 
                                               event.sharedStatus === 'accepted' ? '#d1fae5' : '#fee2e2',
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: event.sharedStatus === 'pending' ? '#f59e0b' : 
                                           event.sharedStatus === 'accepted' ? '#10b981' : '#ef4444',
                              }}>
                                <Text style={{
                                  fontSize: 11,
                                  color: event.sharedStatus === 'pending' ? '#92400e' : 
                                         event.sharedStatus === 'accepted' ? '#065f46' : '#991b1b',
                                  fontFamily: 'Onest',
                                  fontWeight: '600',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.3,
                                }}>
                                  {event.sharedStatus}
                                </Text>
                              </View>
                            </View>
                            <Text style={{
                              fontSize: 13,
                              color: '#64748b', // Medium gray text
                              fontFamily: 'Onest',
                              marginBottom: 10,
                            }}>
                              {event.date} • Shared with {event.sharedWithFullName || event.sharedWithUsername || 'Unknown'}
                            </Text>
                            {event.sharedStatus === 'pending' && (
                              <TouchableOpacity
                                onPress={() => handleCancelSharedEvent(event)}
                                style={{ 
                                  backgroundColor: '#f8fafc', // Light gray background
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                  borderRadius: 6,
                                  alignSelf: 'flex-start',
                                  borderWidth: 1,
                                  borderColor: '#e2e8f0',
                                }}
                              >
                              <Text style={{
                                  fontSize: 11,
                                  color: '#64748b', // Gray text
                                fontFamily: 'Onest',
                                fontWeight: '600',
                              }}>
                                  Cancel
                              </Text>
                              </TouchableOpacity>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                      </View>
                    )}
                  </ScrollView>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Custom Photo Attachment Modal */}
      <Modal
        visible={showCustomPhotoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCustomPhotoModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: Colors.light.background,
            borderRadius: 20,
            padding: 24,
            margin: 20,
            width: '90%',
            maxWidth: 400,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 10,
          }}>
            {/* Header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}>
              <Text style={{
                fontSize: 20,
                fontWeight: '600',
                color: Colors.light.text,
                fontFamily: 'Onest',
              }}>
                Add Photo to Event
              </Text>
              <TouchableOpacity
                onPress={() => setShowCustomPhotoModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: Colors.light.surfaceVariant,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            {/* Privacy Toggle */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: Colors.light.surfaceVariant,
              borderRadius: 12,
              marginBottom: 24,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons 
                  name={isPhotoPrivate ? "lock-closed" : "lock-open"} 
                  size={20} 
                  color={isPhotoPrivate ? Colors.light.accent : Colors.light.icon} 
                />
                <Text style={{
                  fontSize: 16,
                  fontWeight: '500',
                  color: Colors.light.text,
                  marginLeft: 12,
                  fontFamily: 'Onest',
                }}>
                  Private Photo
                </Text>
              </View>
              <Switch
                value={isPhotoPrivate}
                onValueChange={setIsPhotoPrivate}
                trackColor={{ false: Colors.light.border, true: Colors.light.accent }}
                thumbColor={Colors.light.background}
              />
            </View>

            {/* Privacy Description */}
            <Text style={{
              fontSize: 14,
              color: Colors.light.icon,
              marginBottom: 24,
              fontFamily: 'Onest',
              lineHeight: 20,
            }}>
              {isPhotoPrivate 
                ? "This photo will only be visible to you and won't be shared with friends."
                : "This photo can be shared with friends when you share the event."
              }
            </Text>

            {/* Action Buttons */}
            <View style={{ gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowCustomPhotoModal(false);
                  handleEventPhotoPicker('camera', selectedEventForPhoto);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: Colors.light.accent,
                  paddingVertical: 16,
                  borderRadius: 12,
                  gap: 8,
                }}
              >
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#fff',
                  fontFamily: 'Onest',
                }}>
                  Take Photo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowCustomPhotoModal(false);
                  handleEventPhotoPicker('library', selectedEventForPhoto);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: Colors.light.surface,
                  paddingVertical: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: Colors.light.border,
                  gap: 8,
                }}
              >
                <Ionicons name="images" size={20} color={Colors.light.text} />
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: Colors.light.text,
                  fontFamily: 'Onest',
                }}>
                  Choose from Gallery
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo Caption Modal */}
      <PhotoCaptionModal
        visible={showCaptionModal}
        onClose={handleCaptionCancel}
        onSave={handleCaptionSave}
        photoUrl={photoForCaption?.url}
        eventTitle={photoForCaption?.eventTitle}
        isLoading={isSharingPhoto}
      />

      {/* Instagram-like Photo Zoom Viewer */}
      <PhotoZoomViewer
        visible={showPhotoZoomModal}
        photoUrl={selectedPhotoForZoom?.photoUrl || ''}
        sourceTitle={selectedPhotoForZoom?.eventTitle}
        sourceType="event"
        onClose={() => {
          setShowPhotoZoomModal(false);
          setSelectedPhotoForZoom(null);
        }}
      />

      </>
      
    );
  };
  
  export default CalendarScreen;
