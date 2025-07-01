import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  KeyboardAvoidingView
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
import { calendarStyles, CALENDAR_CONSTANTS } from '../../styles/calendar.styles';
import { promptPhotoSharing, PhotoShareData, sharePhotoWithFriends } from '../../utils/photoSharing';
import { fetchSharedEvents as fetchSharedEventsUtil, acceptSharedEvent as acceptSharedEventUtil, declineSharedEvent as declineSharedEventUtil, shareEventWithFriends } from '../../utils/sharing';
import type { SharedEvent } from '../../utils/sharing';
import { GoogleCalendarSync } from '../../components/GoogleCalendarSync';

// Add robust ID generation function that works with TEXT ids
const generateEventId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `event_${timestamp}_${random}`;
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
  // Add shared event properties
  isShared?: boolean;
  sharedBy?: string;
  sharedByUsername?: string;
  sharedByFullName?: string;
  sharedStatus?: 'pending' | 'accepted' | 'declined';
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
} = CALENDAR_CONSTANTS;

const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const generateMonthKey = (year: number, month: number) => `${year}-${month}`;

// Use imported styles
const styles = calendarStyles;

// Add this array of predefined colors near the top of the file, after the imports
const CATEGORY_COLORS = [
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
  
  // Vibrant Colors
  '#FF6B6B', // Coral Red
  '#4ECDC4', // Turquoise
  '#45B7D1', // Ocean Blue
  '#96CEB4', // Mint Green
  '#FFEEAD', // Cream
  '#D4A5A5', // Dusty Rose
  '#9B59B6', // Purple
  '#3498DB', // Blue
  '#2ECC71', // Emerald
  '#F1C40F', // Yellow
  
  // Muted Colors
  '#95A5A6', // Gray
  '#7F8C8D', // Dark Gray
  '#34495E', // Navy
  '#8E44AD', // Deep Purple
  '#16A085', // Teal
  '#D35400', // Orange
  '#C0392B', // Red
  '#27AE60', // Green
  '#2980B9', // Dark Blue
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
  // Add state for editedIsAllDay for the edit modal
  const [isEditedAllDay, setIsEditedAllDay] = useState(false);
  
  // Photo-related state variables
  const [eventPhotos, setEventPhotos] = useState<string[]>([]);
  const [editedEventPhotos, setEditedEventPhotos] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [selectedPhotoForViewing, setSelectedPhotoForViewing] = useState<{ event: CalendarEvent; photoUrl: string } | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
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
  }>>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [searchFriend, setSearchFriend] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  // Edit modal friends state variables
  const [editSelectedFriends, setEditSelectedFriends] = useState<string[]>([]);
  const [editSearchFriend, setEditSearchFriend] = useState('');
  const [editIsSearchFocused, setEditIsSearchFocused] = useState(false);

  // Shared events notification modal state
  const [showSharedEventsModal, setShowSharedEventsModal] = useState(false);
  const [pendingSharedEvents, setPendingSharedEvents] = useState<CalendarEvent[]>([]);

  // Google Calendar sync modal state
  const [showGoogleSyncModal, setShowGoogleSyncModal] = useState(false);

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
    }, 1500); // 2 second delay
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
          refreshEvents();
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
      
      // First, fetch shared events where current user is the recipient
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
        .eq('shared_with', userId)
        .eq('status', 'pending');

      if (error) {
        console.error('🔍 [Calendar] Error fetching shared events:', error);
        return [];
      }

      console.log('🔍 [Calendar] Found shared events:', sharedEventsData?.length || 0);
      console.log('🔍 [Calendar] Raw shared events data:', JSON.stringify(sharedEventsData, null, 2));

      if (!sharedEventsData || sharedEventsData.length === 0) {
        console.log('🔍 [Calendar] No shared events found for user:', userId);
        return [];
      }

      // Extract the original event IDs
      const originalEventIds = sharedEventsData.map((se: any) => se.original_event_id);
      console.log('🔍 [Calendar] Original event IDs:', originalEventIds);

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

      console.log('🔍 [Calendar] Fetched events data:', eventsData);

      // Create a map of event ID to event data
      const eventsMap = new Map();
      if (eventsData) {
        eventsData.forEach((event: any) => {
          eventsMap.set(event.id, event);
        });
      }

      // Get unique sharer IDs to fetch their profiles
      const sharerIds = [...new Set(sharedEventsData.map((se: any) => se.shared_by))];
      console.log('🔍 [Calendar] Sharer IDs:', sharerIds);
      
      // Fetch profiles for all sharers
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', sharerIds);

      if (profilesError) {
        console.error('🔍 [Calendar] Error fetching profiles:', profilesError);
      }

      console.log('🔍 [Calendar] Profiles data:', profilesData);

      // Create a map of user ID to profile data
      const profilesMap = new Map();
      if (profilesData) {
        profilesData.forEach((profile: any) => {
          profilesMap.set(profile.id, profile);
        });
      }

      // Transform shared events into CalendarEvent format
      const transformedSharedEvents = sharedEventsData
        .filter((sharedEvent: any) => {
          // Check if the original event exists
          const originalEvent = eventsMap.get(sharedEvent.original_event_id);
          if (!originalEvent) {
            console.warn('🔍 [Calendar] Shared event has no associated event:', sharedEvent.id, 'Original event ID:', sharedEvent.original_event_id);
            return false;
          }
          console.log('🔍 [Calendar] Processing shared event:', {
            id: sharedEvent.id,
            eventTitle: originalEvent.title,
            eventDate: originalEvent.date,
            status: sharedEvent.status
          });
          return true;
        })
        .map((sharedEvent: any) => {
          const event = eventsMap.get(sharedEvent.original_event_id);
          const sharerProfile = profilesMap.get(sharedEvent.shared_by);
          
          // Parse dates
          const parseDate = (dateStr: string | null) => {
            if (!dateStr) return null;
            try {
              const date = new Date(dateStr);
              return isNaN(date.getTime()) ? null : date;
            } catch (error) {
              return null;
            }
          };

          const transformedEvent = {
            id: `shared_${sharedEvent.id}`, // Prefix to distinguish from regular events
            title: event.title || 'Untitled Event',
            description: event.description,
            location: event.location,
            date: event.date,
            startDateTime: event.start_datetime ? parseDate(event.start_datetime) : undefined,
            endDateTime: event.end_datetime ? parseDate(event.end_datetime) : undefined,
            categoryName: event.category_name,
            categoryColor: '#007AFF', // iOS blue for shared events
            isAllDay: event.is_all_day || false,
            photos: event.photos || [],
            // Shared event properties
            isShared: true,
            sharedBy: sharedEvent.shared_by,
            sharedByUsername: sharerProfile?.username || 'Unknown',
            sharedByFullName: sharerProfile?.full_name || 'Unknown User',
            sharedStatus: sharedEvent.status
          };

          console.log('🔍 [Calendar] Transformed shared event:', {
            id: transformedEvent.id,
            title: transformedEvent.title,
            date: transformedEvent.date,
            isShared: transformedEvent.isShared,
            sharedBy: transformedEvent.sharedBy
          });

          return transformedEvent;
        });

      console.log('🔍 [Calendar] Successfully transformed shared events:', transformedSharedEvents.length);
      console.log('🔍 [Calendar] Final transformed events:', transformedSharedEvents.map(e => ({ id: e.id, title: e.title, date: e.date })));
      return transformedSharedEvents;
    } catch (error) {
      console.error('🔍 [Calendar] Error in fetchSharedEvents:', error);
      return [];
    }
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        
        if (!user?.id) {
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

        // Fetch both regular events and shared events in parallel
        const [regularEventsResult, sharedEvents] = await Promise.all([
          supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: true }),
          fetchSharedEvents(user.id)
        ]);

        const { data: eventsData, error } = regularEventsResult;

        if (error) {
          handleDatabaseError(error);
          return;
        }

        // Combine regular events and shared events
        const allEvents = [...(eventsData || []), ...sharedEvents];
        console.log('🔍 [Calendar] Combined events count:', allEvents.length);
        console.log('🔍 [Calendar] Regular events count:', eventsData?.length || 0);
        console.log('🔍 [Calendar] Shared events count:', sharedEvents.length);

        if (allEvents.length === 0) {
          setEvents({});
          return;
        }

        // Transform the events data into our local format
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

          const startDateTime = event.start_datetime ? parseDate(event.start_datetime) : undefined;
          const endDateTime = event.end_datetime ? parseDate(event.end_datetime) : undefined;
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
            isAllDay: event.is_all_day || false,
            photos: event.photos || [],
            // Shared event properties (for shared events)
            isShared: event.isShared || false,
            sharedBy: event.sharedBy,
            sharedByUsername: event.sharedByUsername,
            sharedByFullName: event.sharedByFullName,
            sharedStatus: event.sharedStatus
          };

          console.log('🔍 [Calendar] Processing event:', {
            id: transformedEvent.id,
            title: transformedEvent.title,
            date: transformedEvent.date,
            isShared: transformedEvent.isShared,
            customDates: transformedEvent.customDates
          });

          // For custom events, add to all custom dates
          if (transformedEvent.customDates && transformedEvent.customDates.length > 0) {
            transformedEvent.customDates.forEach((date: string) => {
              if (!acc[date]) {
                acc[date] = [];
              }
              acc[date].push(transformedEvent);
              console.log('🔍 [Calendar] Added custom event to date:', date, 'Event:', transformedEvent.title);
            });
          } else {
            // For regular events, add to the primary date
            if (!acc[transformedEvent.date]) {
              acc[transformedEvent.date] = [];
            }
            acc[transformedEvent.date].push(transformedEvent);
            console.log('🔍 [Calendar] Added event to date:', transformedEvent.date, 'Event:', transformedEvent.title, 'IsShared:', transformedEvent.isShared);
          }

          return acc;
        }, {} as { [date: string]: CalendarEvent[] });

        console.log('🔍 [Calendar] Final transformed events by date:', Object.keys(transformedEvents));
        console.log('🔍 [Calendar] Events for 2025-01-15:', transformedEvents['2025-01-15']?.map((e: CalendarEvent) => ({ title: e.title, isShared: e.isShared })) || 'No events');
        
        // Add detailed debugging for shared events
        console.log('🔍 [Calendar] All shared events before transformation:', sharedEvents.map(e => ({ id: e.id, title: e.title, date: e.date, isShared: e.isShared })));
        console.log('🔍 [Calendar] All events before transformation:', allEvents.map(e => ({ id: e.id, title: e.title, date: e.date, isShared: e.isShared })));
        
        // Check if any events have the date 2025-01-15
        const eventsForJan15 = allEvents.filter(e => e.date === '2025-01-15');
        console.log('🔍 [Calendar] Events with date 2025-01-15 before transformation:', eventsForJan15.map(e => ({ id: e.id, title: e.title, isShared: e.isShared })));

        setEvents(transformedEvents);
        
      } catch (error) {
        console.error('🔍 [Calendar] Error in fetchEvents:', error);
      }
    };
    
    fetchEvents();
  }, [user]);

  // Add a function to refresh events
  const refreshEvents = async () => {
    try {
      console.log('🔄 [Calendar] Refreshing events...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ [Calendar] No user found, skipping refresh');
        return;
      }

      console.log('👤 [Calendar] Refreshing events for user:', user.id);

      const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (eventsError) {
        console.error('❌ [Calendar] Error fetching events:', eventsError);
        return;
      }

      console.log('📅 [Calendar] Fetched events from database:', eventsData?.length || 0);
      
      if (eventsData) {
        const parsedEvents: { [date: string]: CalendarEvent[] } = {};
        
        eventsData.forEach(event => {
          console.log('📋 [Calendar] Processing event:', event.title, 'on', event.date);
          
        const parseDate = (dateStr: string | null) => {
          if (!dateStr) return null;
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
        };

          const calendarEvent: CalendarEvent = {
          id: event.id,
            title: event.title,
            description: event.description || '',
            location: event.location || '',
          date: event.date,
            startDateTime: parseDate(event.start_datetime) || undefined,
            endDateTime: parseDate(event.end_datetime) || undefined,
            categoryName: event.category_name || '',
            categoryColor: event.category_color || '#667eea',
            reminderTime: parseDate(event.reminder_time),
          repeatOption: event.repeat_option || 'None',
            repeatEndDate: parseDate(event.repeat_end_date),
          customDates: event.custom_dates || [],
          customTimes: event.custom_times || {},
            isContinued: event.is_continued || false,
          isAllDay: event.is_all_day || false,
          photos: event.photos || [],
            isShared: event.is_shared || false,
            sharedBy: event.shared_by || '',
            sharedByUsername: event.shared_by_username || '',
            sharedByFullName: event.shared_by_full_name || '',
            sharedStatus: event.shared_status || 'pending',
        };

          if (!parsedEvents[event.date]) {
            parsedEvents[event.date] = [];
            }
          parsedEvents[event.date].push(calendarEvent);
          });

        console.log('🗓️ [Calendar] Parsed events by date:', Object.keys(parsedEvents));
        setEvents(parsedEvents);
        }
    } catch (error) {
      console.error('❌ [Calendar] Error in refreshEvents:', error);
    }
  };

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
      return friends;
    }
    return friends.filter(friend => 
      friend.friend_name?.toLowerCase().includes(searchFriend.toLowerCase()) ||
      friend.friend_username?.toLowerCase().includes(searchFriend.toLowerCase())
    );
  };

  const shareEventWithSelectedFriends = async (eventId: string) => {
    if (selectedFriends.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await shareEventWithFriends(eventId, selectedFriends);
    if (result.success) {
      Toast.show({
        type: 'success',
        text1: 'Event shared successfully',
        text2: 'Your friends will be notified',
        position: 'bottom',
      });
    } else {
      Toast.show({
        type: 'error',
        text1: 'Failed to share event',
        text2: result.error || 'Please try again',
        position: 'bottom',
      });
    }
  };

  const shareEventWithEditSelectedFriends = async (eventId: string) => {
    if (editSelectedFriends.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await shareEventWithFriends(eventId, editSelectedFriends);
    if (result.success) {
      Toast.show({
        type: 'success',
        text1: 'Event shared successfully',
        text2: 'Your friends will be notified',
        position: 'bottom',
      });
    } else {
      Toast.show({
        type: 'error',
        text1: 'Failed to share event',
        text2: result.error || 'Please try again',
        position: 'bottom',
      });
    }
  };

  const fetchSharedFriendsForEvent = async (eventId: string) => {
    try {
      console.log('🔍 [Edit Modal] Fetching shared friends for event:', eventId);
      
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

      // Fetch shared events where this event is the original event
      const queryPromise = supabase
        .from('shared_events')
        .select('shared_with')
        .eq('original_event_id', eventId)
        .eq('shared_by', user.id);

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
      const friendIds = sharedEvents.map((se: { shared_with: string }) => se.shared_with);
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
      // Delete from database
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) {
        throw error;
      }

      // Update local state
      setEvents(prevEvents => {
        const newEvents = { ...prevEvents };
        
        // Remove the event from all dates where it exists
        Object.keys(newEvents).forEach(dateKey => {
          newEvents[dateKey] = newEvents[dateKey].filter(event => event.id !== eventId);
          if (newEvents[dateKey].length === 0) {
            delete newEvents[dateKey];
          }
        });

        return newEvents;
      });

      // Show success message
      Toast.show({
        type: 'success',
        text1: 'Event deleted successfully',
        position: 'bottom',
        visibilityTime: 2000,
      });

      // Refresh events to ensure consistency
      setTimeout(() => {
        refreshEvents();
      }, 500);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete event. Please try again.');
    }
  };


  const resetEventForm = () => {
    setNewEventTitle('');
    setNewEventDescription('');
    setNewEventLocation('');
    setStartDateTime(new Date());
    setEndDateTime(new Date(new Date().getTime() + 60 * 60 * 1000));
    setSelectedCategory(null);
    setReminderTime(null);
    setRepeatOption('None');
    setRepeatEndDate(null);
    setCustomSelectedDates([]);
    setCustomDateTimes({
      default: {
        start: new Date(),
        end: new Date(new Date().getTime() + 60 * 60 * 1000),
        reminder: null,
        repeat: 'None',
        dates: [getLocalDateString(startDateTime)]
      }
    });
    setSelectedDateForCustomTime(null);
    setCustomStartTime(new Date());
    setCustomEndTime(new Date(new Date().getTime() + 60 * 60 * 1000));
    setUserChangedEndTime(false);
    setIsAllDay(false);
    setEventPhotos([]);
    setEditedEventPhotos([]);
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
        date: getLocalDateString(startDateTime),
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
        photos: eventPhotos
      };

      // For all-day events, we only store the date without time components
      if (eventToSave.isAllDay) {
        const startDate = new Date(eventToSave.date);
        startDate.setHours(0, 0, 0, 0);
        eventToSave.startDateTime = startDate;
        eventToSave.endDateTime = startDate; // Use the same date for both start and end
      } else {
        // For regular events, store the full datetime
        eventToSave.startDateTime = new Date(startDateTime);
        eventToSave.endDateTime = new Date(endDateTime);
      }

      // Generate repeated events if needed
      const generateRepeatedEvents = (event: CalendarEvent): CalendarEvent[] => {
        if (!event.repeatOption || event.repeatOption === 'None' || event.repeatOption === 'Custom') {
          return [event];
        }

        const events: CalendarEvent[] = [event];
        const startDate = new Date(event.date); // Use date instead of startDateTime for all-day events
        const endDate = event.repeatEndDate || new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
        let currentDate = new Date(startDate);

        // Helper function to check if a date matches the repeat pattern
        const isDateInPattern = (date: Date, baseDate: Date, option: RepeatOption): boolean => {
          switch (option) {
            case 'Daily':
              return true; // Every day matches
            case 'Weekly':
              return date.getDay() === baseDate.getDay(); // Same day of week
            case 'Monthly':
              return date.getDate() === baseDate.getDate(); // Same day of month
            case 'Yearly':
              return date.getMonth() === baseDate.getMonth() && date.getDate() === baseDate.getDate(); // Same month and day
            default:
              return false;
          }
        };

        // Helper function to create an event for a specific date
        const createEventForDate = (date: Date): CalendarEvent => {
          const newEvent: CalendarEvent = {
            ...event,
            id: `${event.id}_${date.toISOString()}`,
            date: getLocalDateString(date),
            isAllDay: event.isAllDay // Preserve the all-day status
          };

          if (event.isAllDay) {
            // For all-day events, just use the date without time
            newEvent.startDateTime = new Date(date);
            newEvent.endDateTime = new Date(date);
          } else if (event.startDateTime && event.endDateTime) {
            // For regular events, maintain the time from the original event
            newEvent.startDateTime = new Date(date);
            newEvent.endDateTime = new Date(date);
            newEvent.startDateTime.setHours(event.startDateTime.getHours(), event.startDateTime.getMinutes());
            newEvent.endDateTime.setHours(
              event.startDateTime.getHours() + (event.endDateTime.getHours() - event.startDateTime.getHours()),
              event.startDateTime.getMinutes() + (event.endDateTime.getMinutes() - event.startDateTime.getMinutes())
            );
          }

          // Adjust reminder time if it exists
          if (event.reminderTime && newEvent.startDateTime && event.startDateTime) {
            const reminderOffset = event.reminderTime.getTime() - event.startDateTime.getTime();
            newEvent.reminderTime = new Date(newEvent.startDateTime.getTime() + reminderOffset);
          }

          return newEvent;
        };

        // Helper function to check if a date is already included in events
        const isDateAlreadyIncluded = (date: Date): boolean => {
          return events.some(e => {
            const eventDate = e.startDateTime ? new Date(e.startDateTime) : null;
            return eventDate?.getTime() === date.getTime();
          });
        };

        // Generate events up to but not including the end date
        while (currentDate < endDate) {
          // Increment date based on repeat option
          switch (event.repeatOption) {
            case 'Daily':
              currentDate.setDate(currentDate.getDate() + 1);
              break;
            case 'Weekly':
              currentDate.setDate(currentDate.getDate() + 7);
              break;
            case 'Monthly':
              currentDate.setMonth(currentDate.getMonth() + 1);
              break;
            case 'Yearly':
              currentDate.setFullYear(currentDate.getFullYear() + 1);
              break;
            default:
              return events;
          }

          // If we've gone past the end date, check if we should include the end date
          if (currentDate > endDate) {
            // Only add the end date if it matches the pattern and isn't already included
            if (isDateInPattern(endDate, startDate, event.repeatOption) && !isDateAlreadyIncluded(endDate)) {
              events.push(createEventForDate(new Date(endDate)));
            }
            break;
          }

          // Only add the event if it's not already included
          if (!isDateAlreadyIncluded(currentDate)) {
            events.push(createEventForDate(new Date(currentDate)));
          }
        }
        return events;
      };

      // Generate all repeated events
      const allEvents = generateRepeatedEvents(eventToSave);

      // Prepare database data for all events
      const dbEvents = allEvents.map(event => ({
        id: event.id, // Include the generated ID
        title: event.title,
        description: event.description,
        date: event.date,
        start_datetime: event.startDateTime ? formatDateToUTC(event.startDateTime) : null,
        end_datetime: event.endDateTime ? formatDateToUTC(event.endDateTime) : null,
        category_name: event.categoryName || null,
        category_color: event.categoryColor || null,
        reminder_time: event.reminderTime ? formatDateToUTC(event.reminderTime) : null,
        repeat_option: event.repeatOption,
        repeat_end_date: event.repeatEndDate ? formatDateToUTC(event.repeatEndDate) : null,
        custom_dates: event.customDates,
        custom_times: event.customTimes ? 
          Object.entries(event.customTimes).reduce((acc, [date, times]) => ({
            ...acc,
            [date]: {
              start: formatDateToUTC(times.start),
              end: formatDateToUTC(times.end),
              reminder: times.reminder ? formatDateToUTC(times.reminder) : null,
              repeat: times.repeat
            }
          }), {}) : null,
        is_all_day: event.isAllDay,
        photos: event.photos || [],
        user_id: currentUser.id // Use the verified current user ID
      }));

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

        // Approach 3: If still not successful, try to find and delete by multiple criteria
        if (!deleteSuccess) {
          const { data: eventsToDelete, error: findError } = await supabase
            .from('events')
            .select('*')
            .eq('title', eventToDelete?.title || '')
            .eq('user_id', currentUser.id);

          if (!findError && eventsToDelete && eventsToDelete.length > 0) {
            const eventIds = eventsToDelete.map(e => e.id);
            const { error: bulkDeleteError } = await supabase
              .from('events')
              .delete()
              .in('id', eventIds);

            if (!bulkDeleteError) {
              deleteSuccess = true;
            }
          }
        }

        // Insert the updated event
        const { error: insertError } = await supabase
          .from('events')
          .insert(dbEvents);

        dbError = insertError;
      } else {
        // Insert all new events
        const { error: insertError } = await supabase
          .from('events')
          .insert(dbEvents);

        dbError = insertError;
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

      // Update local state with all events
      setEvents(prev => {
        const updated = { ...prev };
        allEvents.forEach(event => {
          if (event.customDates && event.customDates.length > 0) {
            event.customDates.forEach(date => {
              if (!updated[date]) {
                updated[date] = [];
              }
              updated[date] = updated[date].filter(e => e.id !== event.id);
              updated[date].push(event);
            });
          } else {
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

      // Share event with selected friends if any
      if (selectedFriends.length > 0 && allEvents.length > 0) {
        // Use the first event's ID for sharing (they all have the same base ID)
        const eventIdToShare = allEvents[0].id;
        await shareEventWithSelectedFriends(eventIdToShare);
        
        // Clear selected friends after sharing
        setSelectedFriends([]);
      }

      // Reset form and close modal
      resetEventForm();
      setShowModal(false);
      setShowCustomDatesPicker(false);
      setEditingEvent(null);

      // Show success message
      Toast.show({
        type: 'success',
        text1: editingEvent ? 'Event updated successfully' : 'Event created successfully',
        position: 'bottom',
      });

      // Refresh events from database to ensure consistency
      setTimeout(() => {
        refreshEvents();
      }, 500);
    } catch (error) {
      Alert.alert('Error', 'Failed to save event. Please try again.');
    }
  };
  
  // PanResponder for swipe up/down gesture
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Make vertical scrolling much more sensitive than horizontal
        const verticalThreshold = 10; // Very low threshold for vertical
        const horizontalThreshold = 50; // Higher threshold for horizontal
        
        const isVertical = Math.abs(gestureState.dy) > verticalThreshold;
        const isHorizontal = Math.abs(gestureState.dx) > horizontalThreshold;
        
        // Prioritize vertical gestures when in compact mode
        if (isMonthCompact) {
          return isVertical && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        }
        
        // Default behavior for expanded mode
        return Math.abs(gestureState.dy) > 20;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -30) {
          setIsMonthCompact(true); // Swiped up
        } else if (gestureState.dy > 30) {
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
            {...panResponder.panHandlers}
            style={[
              needsSixRowsThisMonth ? styles.gridSixRows : styles.grid,
              isMonthCompact && styles.gridCompact,
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
                      resetEventForm();
                      setStartDateTime(date);
                      setEndDateTime(new Date(date.getTime() + 60 * 60 * 1000));
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
                                  const selectedEventData = { event, dateKey: event.date, index };
                                  setSelectedEvent(selectedEventData);
                                  setEditingEvent(event);
                                  setEditedEventTitle(event.title);
                                  setEditedEventDescription(event.description ?? '');
                                  setEditedEventLocation(event.location ?? '');
                                  setEditedStartDateTime(new Date(event.startDateTime!));
                                  setEditedEndDateTime(new Date(event.endDateTime!));
                                  setEditedSelectedCategory(event.categoryName ? { name: event.categoryName, color: event.categoryColor! } : null);
                                  setEditedReminderTime(event.reminderTime ? new Date(event.reminderTime) : null);
                                  setEditedRepeatOption(event.repeatOption || 'None');
                                  setEditedRepeatEndDate(event.repeatEndDate ? new Date(event.repeatEndDate) : null);
                                  setCustomSelectedDates(event.customDates || []);
                                  setIsEditedAllDay(event.isAllDay || false);
                                  setEditedEventPhotos(event.photos || []);
                                  setShowEditEventModal(true);
                                }}
                                onLongPress={() => handleLongPress(event)}
                              >
                                {event.isShared ? (
                                  // Show title for shared events
                                  <View
                                    style={[
                                      styles.eventBoxText,
                                      {
                                        backgroundColor: '#007AFF20',
                                        borderWidth: 1,
                                        borderColor: '#007AFF',
                                        marginBottom: 2,
                                        paddingHorizontal: 6,
                                        paddingVertical: 3,
                                        borderRadius: 4,
                                        minHeight: 20
                                      }
                                    ]}
                                  >
                                    <Text
                                      numberOfLines={1}
                                      style={[
                                        styles.eventText,
                                        { 
                                          color: '#007AFF',
                                          fontWeight: '600',
                                          fontSize: 11
                                        }
                                      ]}
                                    >
                                      {event.title}
                                    </Text>
                                  </View>
                                ) : (
                                  // Show dot for regular events
                                  <View
                                    style={[
                                      styles.eventDot,
                                      { 
                                        backgroundColor: event.categoryColor || '#6366F1'
                                      }
                                    ]}
                                  />
                                )}
                              </TouchableOpacity>
                            ))}
                          {dayEvents.length > 3 && (
                            <View style={[styles.eventDot, { backgroundColor: '#6366F1' }]} />
                          )}
                        </View>
                      ) : (
                        // Expanded view: show event containers with titles
                        <View style={styles.eventBox}>
                          {dayEvents
                            .sort((a, b) => {
                              // Sort by start time, all-day events first
                              if (a.isAllDay && !b.isAllDay) return -1;
                              if (!a.isAllDay && b.isAllDay) return 1;
                              if (!a.startDateTime || !b.startDateTime) return 0;
                              return a.startDateTime.getTime() - b.startDateTime.getTime();
                            })
                            .map((event, eventIndex) => (
                              <TouchableOpacity
                                key={`${event.id}-${eventIndex}`}
                                onPress={() => {
                                  const selectedEventData = { event, dateKey: event.date, index: eventIndex };
                                  setSelectedEvent(selectedEventData);
                                  setEditingEvent(event);
                                  setEditedEventTitle(event.title);
                                  setEditedEventDescription(event.description ?? '');
                                  setEditedEventLocation(event.location ?? '');
                                  setEditedStartDateTime(new Date(event.startDateTime!));
                                  setEditedEndDateTime(new Date(event.endDateTime!));
                                  setEditedSelectedCategory(event.categoryName ? { name: event.categoryName, color: event.categoryColor! } : null);
                                  setEditedReminderTime(event.reminderTime ? new Date(event.reminderTime) : null);
                                  setEditedRepeatOption(event.repeatOption || 'None');
                                  setEditedRepeatEndDate(event.repeatEndDate ? new Date(event.repeatEndDate) : null);
                                  setCustomSelectedDates(event.customDates || []);
                                  setShowEditEventModal(true);
                                }}
                                onLongPress={() => handleLongPress(event)}
                                style={[
                                  styles.eventBoxText,
                                  {
                                    backgroundColor: event.isShared 
                                      ? '#007AFF20' // Light iOS blue background for shared events
                                      : `${event.categoryColor || '#6366F1'}30`, // Lighter background color
                                    borderWidth: event.isShared ? 1 : 0,
                                    borderColor: event.isShared ? '#007AFF' : 'transparent'
                                  }
                                ]}
                              >
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    styles.eventText,
                                    { 
                                      color: event.isShared ? '#007AFF' : '#333',
                                      fontWeight: event.isShared ? '600' : 'normal'
                                    }
                                  ]}
                                >
                                  {event.title}
                                </Text>
                
                              </TouchableOpacity>
                            ))}
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
      
      // Handle all events, not just custom ones
      setSelectedEvent({ event, dateKey: event.date, index: 0 });
      setEditingEvent(event);
      setEditedEventTitle(event.title);
      setEditedEventDescription(event.description ?? '');
      setEditedEventLocation(event.location ?? '');
      setEditedStartDateTime(new Date(event.startDateTime!));
      setEditedEndDateTime(new Date(event.endDateTime!));
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
        const sharedFriendIds = await fetchSharedFriendsForEvent(event.id);
        console.log('🔍 [Edit Modal] Setting shared friends:', sharedFriendIds);
        setEditSelectedFriends(sharedFriendIds);
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


  // Add these state variables near the top of the component
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [currentEditingField, setCurrentEditingField] = useState<'start' | 'end'>('start');

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
    if (!selectedEvent) return;
    if (!editedEventTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for the event');
      return;
    }

    try {
      const originalEvent = selectedEvent.event;
      
      // Step 1: Find the event in database by title and date (more reliable than ID)
      const { data: existingEvents, error: findError } = await supabase
        .from('events')
        .select('*')
        .eq('title', originalEvent.title)
        .eq('date', originalEvent.date)
        .eq('user_id', user?.id);

      if (findError) {
        throw new Error('Failed to find event in database');
      }

      if (!existingEvents || existingEvents.length === 0) {
        throw new Error('Event not found in database');
      }

      // Step 2: Delete all matching events
      const eventIds = existingEvents.map(e => e.id);
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .in('id', eventIds);

      if (deleteError) {
        throw new Error('Failed to delete original event');
      }

      // Step 3: Verify deletion by trying to find the events again
      const { data: verifyEvents, error: verifyError } = await supabase
        .from('events')
        .select('id')
        .in('id', eventIds);

      if (!verifyError && verifyEvents && verifyEvents.length > 0) {
        throw new Error('Events were not properly deleted');
      }

      // Step 4: Remove from local state
      setEvents(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(date => {
          updated[date] = updated[date].filter(e => e.id !== originalEvent.id);
          if (updated[date].length === 0) {
            delete updated[date];
          }
        });
        return updated;
      });

      // Step 5: Create the new event data
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

      // Step 6: Insert the new event
      const { data: insertedEvent, error: insertError } = await supabase
        .from('events')
        .insert([newEventData])
        .select()
        .single();

      if (insertError) {
        throw new Error('Failed to save edited event');
      }

      // Step 7: Update local state with new event
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

      setEvents(prev => {
        const updated = { ...prev };
        const dateKey = newEvent.date;
        if (!updated[dateKey]) {
          updated[dateKey] = [];
        }
        updated[dateKey].push(newEvent);
        return updated;
      });

      // Step 8: Share event with selected friends if any
      if (editSelectedFriends.length > 0) {
        await shareEventWithEditSelectedFriends(insertedEvent.id);
        
        // Clear selected friends after sharing
        setEditSelectedFriends([]);
        setEditSearchFriend('');
        setEditIsSearchFocused(false);
      }

      // Step 9: Close modal and show success message
      setShowEditEventModal(false);
      setEditingEvent(null);
      setSelectedEvent(null);

      Toast.show({
        type: 'success',
        text1: 'Event updated successfully',
        position: 'bottom',
      });

    } catch (error) {
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
          // Refresh events when there are changes
          refreshEvents();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

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
            onPress: () => refreshEvents()
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
      refreshEvents();
    }, [])
  );

  // Photo-related functions
  const uploadEventPhoto = async (photoUri: string, eventId: string): Promise<string> => {
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

      return publicUrl;
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
          const photoUrl = await uploadEventPhoto(result.assets[0].uri, eventId || 'temp');
          
          // Get event details for sharing
          let eventTitle = 'Event';
          let eventIdForSharing: string;
          
          if (eventId) {
            eventIdForSharing = eventId;
            const event = Object.values(events).flat().find(e => e.id === eventId);
            if (event) {
              eventTitle = event.title;
            }
            await updateEventPhoto(eventId, photoUrl);
          } else {
            // For new events, we need to save the event first to get a proper ID
            // For now, we'll skip sharing for new events until they're saved
            eventIdForSharing = 'temp_' + Date.now();
            setEventPhotos(prev => [...prev, photoUrl]);
            
            Toast.show({
              type: 'info',
              text1: 'Photo added to event',
              text2: 'Save the event to share the photo with friends',
              position: 'bottom',
            });
            return; // Don't proceed with sharing for unsaved events
          }

          // Prompt for sharing only for saved events
          if (user?.id && eventId) {
            // Set up the photo share data and show caption modal
            setPendingPhotoShare({
                photoUrl,
                sourceType: 'event',
                sourceId: eventIdForSharing,
                sourceTitle: eventTitle,
                userId: user.id
            });
            setPhotoCaption('');
            setShowCaptionModal(true);
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

  const updateEventPhoto = async (eventId: string, photoUrl: string) => {
    try {
      // Get the current event to see existing photos
      const { data: currentEvent, error: fetchError } = await supabase
        .from('events')
        .select('photos')
        .eq('id', eventId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Append the new photo to existing photos
      const currentPhotos = currentEvent?.photos || [];
      const updatedPhotos = [...currentPhotos, photoUrl];

      const { error } = await supabase
        .from('events')
        .update({ photos: updatedPhotos })
        .eq('id', eventId);

      if (error) {
        throw error;
      }

      // Update local state
      setEvents(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(date => {
          updated[date] = updated[date].map(event => 
            event.id === eventId ? { ...event, photos: updatedPhotos } : event
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
        refreshEvents();
      }, 500);
    } catch (error) {
      throw error;
    }
  };

  const showEventPhotoOptions = (eventId?: string) => {
    Alert.alert(
      'Add Photo to Event',
      'Choose how you want to add a photo',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: () => handleEventPhotoPicker('camera', eventId) },
        { text: 'Choose from Gallery', onPress: () => handleEventPhotoPicker('library', eventId) },
      ]
    );
  };

  const removeEventPhoto = async (eventId: string, photoUrlToRemove: string) => {
    try {
      // Get the current event to see existing photos
      const { data: currentEvent, error: fetchError } = await supabase
        .from('events')
        .select('photos')
        .eq('id', eventId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Remove the specific photo from the array
      const currentPhotos = currentEvent?.photos || [];
      const updatedPhotos = currentPhotos.filter((photo: string) => photo !== photoUrlToRemove);

      const { error } = await supabase
        .from('events')
        .update({ photos: updatedPhotos })
        .eq('id', eventId);

      if (error) {
        throw error;
      }

      // Update local state
      setEvents(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(date => {
          updated[date] = updated[date].map(event => 
            event.id === eventId ? { ...event, photos: updatedPhotos } : event
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
      // Get the current event to see existing photos
      const { data: currentEvent, error: fetchError } = await supabase
        .from('events')
        .select('photos')
        .eq('id', eventId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Remove the specific photo from the array
      const currentPhotos = currentEvent?.photos || [];
      const updatedPhotos = currentPhotos.filter((photo: string) => photo !== photoUrlToRemove);

      const { error } = await supabase
        .from('events')
        .update({ photos: updatedPhotos })
        .eq('id', eventId);

      if (error) {
        throw error;
      }

      // Update local state
      setEvents(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(date => {
          updated[date] = updated[date].map(event => 
            event.id === eventId ? { ...event, photos: updatedPhotos } : event
          );
        });
        return updated;
      });

      // Update the selected photo for viewing
      if (selectedPhotoForViewing) {
        const currentIndex = currentPhotos.indexOf(photoUrlToRemove);

        if (updatedPhotos.length > 0) {
          // If there are remaining photos, select the next one
          let newPhotoUrl: string;
          if (currentIndex >= updatedPhotos.length) {
            // If we deleted the last photo, select the new last photo
            newPhotoUrl = updatedPhotos[updatedPhotos.length - 1];
          } else {
            // Select the photo at the same index (or the last one if index is out of bounds)
            newPhotoUrl = updatedPhotos[Math.min(currentIndex, updatedPhotos.length - 1)];
          }

          // Update the selected photo
          setSelectedPhotoForViewing({
            event: { ...selectedPhotoForViewing.event, photos: updatedPhotos },
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
    }
  }, [showPhotoViewer, selectedPhotoForViewing]);

  // Add function to handle shared event interactions
  const handleSharedEventPress = (event: CalendarEvent) => {
    if (event.isShared) {
      Alert.alert(
        'Shared Event',
        `This event was shared with you by ${event.sharedByFullName || event.sharedByUsername || 'Unknown'}`,
        [
          { text: 'Accept', onPress: () => handleAcceptSharedEvent(event) },
          { text: 'Decline', style: 'destructive', onPress: () => handleDeclineSharedEvent(event) },
          { text: 'View Details', onPress: () => viewSharedEventDetails(event) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } else {
      // Handle regular event press
      const selectedEventData = { event, dateKey: event.date, index: 0 };
      setSelectedEvent(selectedEventData);
      setEditingEvent(event);
      setEditedEventTitle(event.title);
      setEditedEventDescription(event.description ?? '');
      setEditedEventLocation(event.location ?? '');
      setEditedStartDateTime(new Date(event.startDateTime!));
      setEditedEndDateTime(new Date(event.endDateTime!));
      setEditedSelectedCategory(event.categoryName ? { name: event.categoryName, color: event.categoryColor! } : null);
      setEditedReminderTime(event.reminderTime ? new Date(event.reminderTime) : null);
      setEditedRepeatOption(event.repeatOption || 'None');
      setEditedRepeatEndDate(event.repeatEndDate ? new Date(event.repeatEndDate) : null);
      setCustomSelectedDates(event.customDates || []);
      setIsEditedAllDay(event.isAllDay || false);
      setEditedEventPhotos(event.photos || []);
      setShowEditEventModal(true);
    }
  };

  const handleAcceptSharedEvent = async (event: CalendarEvent) => {
    try {
      // Extract the shared event ID from the event ID
      const sharedEventId = event.id.replace('shared_', '');
      
      // Use the imported sharing utility function
      const result = await acceptSharedEventUtil(sharedEventId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to accept event');
      }

      // Refresh events to update the display
      refreshEvents();
    } catch (error) {
      console.error('Error accepting shared event:', error);
      Alert.alert('Error', 'Failed to accept event. Please try again.');
    }
  };

  const handleDeclineSharedEvent = async (event: CalendarEvent) => {
    try {
      // Extract the shared event ID from the event ID
      const sharedEventId = event.id.replace('shared_', '');
      
      // Use the imported sharing utility function
      const result = await declineSharedEventUtil(sharedEventId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to decline event');
      }

      // Refresh events to update the display
      refreshEvents();
    } catch (error) {
      console.error('Error declining shared event:', error);
      Alert.alert('Error', 'Failed to decline event. Please try again.');
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

  // Add function to update pending shared events
  const updatePendingSharedEvents = useCallback(() => {
    const pending = Object.values(events)
      .flat()
      .filter(event => event.isShared && event.sharedStatus === 'pending');
    setPendingSharedEvents(pending);
  }, [events]);

  // Update pending events when events change
  useEffect(() => {
    updatePendingSharedEvents();
  }, [events, updatePendingSharedEvents]);

  // Add state for photo sharing caption modal
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [photoCaption, setPhotoCaption] = useState('');
  const [pendingPhotoShare, setPendingPhotoShare] = useState<PhotoShareData | null>(null);

  // Add state for editedIsAllDay for the edit modal

  // Add functions for caption modal
  const handleShareWithCaption = async () => {
    if (!pendingPhotoShare) return;

    try {
      const updatedPhotoData = {
        ...pendingPhotoShare,
        caption: photoCaption.trim() || undefined
      };

      const success = await sharePhotoWithFriends(updatedPhotoData);
      
      if (success) {
        Toast.show({
          type: 'success',
          text1: 'Photo shared with friends!',
          position: 'bottom',
        });
        
        // Trigger a global event to refresh friends feed in profile
        const lastPhotoShareTime = Date.now();
        (global as any).lastPhotoShareTime = lastPhotoShareTime;
      }
    } catch (error) {
      console.error('Error sharing photo with caption:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to share photo',
        position: 'bottom',
      });
    } finally {
      setShowCaptionModal(false);
      setPendingPhotoShare(null);
      setPhotoCaption('');
    }
  };

  const handleCancelCaption = () => {
    setShowCaptionModal(false);
    setPendingPhotoShare(null);
    setPhotoCaption('');
    
    Toast.show({
      type: 'success',
      text1: 'Photo added successfully',
      position: 'bottom',
    });
  };

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

        <View style={styles.modalRowGap}>
          <TouchableOpacity onPress={() => setCalendarMode('week')}>
            <MaterialIcons name="calendar-view-week" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setShowGoogleSyncModal(true)}
            style={{
              backgroundColor: '#4285F4',
              padding: 8,
              borderRadius: 8,
              marginHorizontal: 4
            }}
          >
            <Ionicons name="logo-google" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              resetEventForm();
              setShowModal(true);
            }}
            onLongPress={() => {
              resetEventForm();
              // Set up for custom event
              setCustomModalTitle('');
              setCustomModalDescription('');
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
            <MaterialIcons name="add" size={24} color="#3a3a3a" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Shared Event Notifications */}
      {pendingSharedEvents.length > 0 && (
        <View style={{
          backgroundColor: '#007AFF',
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Ionicons name="people-outline" size={16} color="white" />
            <Text style={{
              color: 'white',
              fontSize: 14,
              fontWeight: '500',
              fontFamily: 'Onest',
            }}>
              {pendingSharedEvents.length} shared event{pendingSharedEvents.length > 1 ? 's' : ''} pending
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowSharedEventsModal(true)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
            }}
          >
            <Text style={{
              color: 'white',
              fontSize: 12,
              fontWeight: '600',
              fontFamily: 'Onest',
            }}>
              Review
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Calendar and Event List Container */}
      <View style={{ flex: 1, flexDirection: 'column' }}>
        {/* Calendar Grid */}
        <View style={{ flex: isMonthCompact ? 0.5 : 1 }}>
          <FlatList
            ref={flatListRef}
            data={months}
            keyExtractor={(item) => item.key}
            horizontal
            pagingEnabled
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
            onScroll={(event) => {
              const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              if (newIndex !== currentMonthIndex) {
                setCurrentMonthIndex(newIndex);
              }
            }}
          />
        </View>

        {/* Event List */}
        {isMonthCompact && selectedDate && (
          <View style={{ flex: 0.6, backgroundColor: 'white' }}>
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
                              backgroundColor: '#007AFF',
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
                            borderWidth: event.isShared ? 2 : 0,
                            borderColor: event.isShared ? '#007AFF' : 'transparent',
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
                              backgroundColor: event.isShared ? '#007AFF' : (event.categoryColor || '#6366F1'),
                              marginRight: 14,
                            }}
                          />
                          {/* Event Info */}
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3.5 }}>
                              <Text style={{ 
                                fontSize: 17, 
                                fontWeight: 'bold', 
                                color: event.isShared ? '#007AFF' : '#222', 
                                marginBottom: 0 
                              }}>
                                {event.title}
                              </Text>
                              {event.isShared && (
                                <View style={{ 
                                  marginLeft: 8, 
                                  backgroundColor: '#007AFF', 
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
                              {event.isAllDay
                                ? 'All day'
                                : `${new Date(event.startDateTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(event.endDateTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                            </Text>
                            {event.description ? (
                              <Text style={{ fontSize: 12, color: '#999' }} numberOfLines={2}>
                                {event.description}
                              </Text>
                            ) : null}
                            {event.isShared && (
                              <Text style={{ fontSize: 11, color: '#007AFF', marginTop: 2 }}>
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
                                      setSelectedPhotoForViewing({ event, photoUrl });
                                      setShowPhotoViewer(true);
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

        <View style={styles.modalRowGap}>
          <TouchableOpacity onPress={() => setCalendarMode('month')}>
            <MaterialIcons name="calendar-view-month" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              resetEventForm();
              setShowModal(true);
            }}
            onLongPress={() => {
              resetEventForm();
              // Set up for custom event
              setCustomModalTitle('');
              setCustomModalDescription('');
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
            <MaterialIcons name="add" size={24} color="#3a3a3a" />
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
        setShowEditEventModal={setShowEditEventModal}
        hideHeader={true}
        setVisibleWeekMonth={setVisibleWeekMonth}
        setVisibleWeekMonthText={setVisibleWeekMonthText}
        visibleWeekMonthText={visibleWeekMonthText}
      />
    </View>
  )}

  {/* Floating Add Button */}
  <TouchableOpacity
    style={styles.addButton}
    onPress={() => {
      resetEventForm();
      setShowModal(true);
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
      // Set up for custom event
      setCustomModalTitle('');
      setCustomModalDescription('');
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
  />
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
                    { backgroundColor: newEventTitle.trim() ? '#667eea' : '#ffffff' }
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
                paddingBottom: 250, // Reduced bottom padding for less dramatic scroll
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
                            onValueChange={setIsAllDay}
                            trackColor={{ false: 'white', true: '#007AFF' }}
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
                                  setStartDateTime(selectedDate);
                                  if (endDateTime < selectedDate) {
                                    const newEnd = new Date(selectedDate);
                                    newEnd.setHours(newEnd.getHours() + 1);
                                    setEndDateTime(newEnd);
                                  }
                                  debouncePickerClose('start');
                                } else {
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
                              <Ionicons name="add" size={12} color="#666" />
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
                                    <Ionicons name="checkmark" size={12} color="white" />
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
                                  setEditedRepeatOption('None');
                                  setEditedRepeatEndDate(null);
                                  setShowRepeatPicker(false);
                                } else {
                                  setEditedRepeatOption(option as RepeatOption);
                                  // Don't close the picker so the end date section remains visible
                                }
                              }}
                              style={{
                                backgroundColor: (option === 'Does not repeat' ? editedRepeatOption === 'None' : editedRepeatOption === option) ? '#f0f0f0' : 'transparent',
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
                                fontWeight: (option === 'Does not repeat' ? editedRepeatOption === 'None' : editedRepeatOption === option) ? '600' : '500',
                              }}>
                                {option}
                              </Text>
                              {(option === 'Does not repeat' ? editedRepeatOption === 'None' : editedRepeatOption === option) && (
                                <Ionicons name="checkmark" size={16} color="#007AFF" />
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                        {editedRepeatOption !== 'None' && (editedRepeatOption as string) !== 'Custom' && (
                        <View style={{ borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 8 }}>
                            <TouchableOpacity
                              onPress={() => setShowEditInlineEndDatePicker(prev => !prev)}
                              style={{
                                backgroundColor: editedRepeatEndDate ? '#f0f0f0' : 'transparent',
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
                                fontWeight: editedRepeatEndDate ? '600' : '500',
                              }}>
                                {editedRepeatEndDate ? `Ends ${editedRepeatEndDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Set end date'}
                              </Text>
                              {editedRepeatEndDate ? (
                                <Ionicons name="checkmark" size={16} color="#007AFF" />
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
                                      setEditedRepeatEndDate(null);
                                      setShowEditInlineEndDatePicker(false);
                                    }}
                                    style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                                  >
                                    <Text style={{ fontSize: 12, color: '#FF6B6B', fontFamily: 'Onest', fontWeight: '500' }}>Clear</Text>
                                  </TouchableOpacity>
                                </View>
                                <DateTimePicker
                                  value={editedRepeatEndDate || new Date()}
                                  mode="date"
                                  display="spinner"
                                  onChange={(event, selectedDate) => {
                                    if (selectedDate) {
                                      setEditedRepeatEndDate(selectedDate);
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
                                              <Ionicons name="checkmark" size={12} color="white" />
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
                                  backgroundColor: '#007AFF',
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
                        // Scroll to friends section when keyboard appears
                        setTimeout(() => {
                          eventModalScrollViewRef.current?.scrollToEnd({ 
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
                      {(searchFriend.trim() !== '' || isSearchFocused) && (
                        <FlatList
                          data={friends.filter(f =>
                            f.friend_name.toLowerCase().includes(searchFriend.toLowerCase()) ||
                            f.friend_username.toLowerCase().includes(searchFriend.toLowerCase())
                          )}
                        keyExtractor={item => `${item.friend_id}-${item.friendship_id}`}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={{
                                marginRight: 10,
                                alignItems: 'center',
                                opacity: selectedFriends.includes(item.friend_id) ? 0.5 : 1,
                                paddingVertical: 2,
                              }}
                              onPress={() => {
                                setSelectedFriends(prev =>
                                  prev.includes(item.friend_id)
                                    ? prev.filter(id => id !== item.friend_id)
                                    : [...prev, item.friend_id]
                                );
                              }}
                            >
                              {item.friend_avatar && item.friend_avatar.trim() !== '' ? (
                                <Image 
                                  source={{ uri: item.friend_avatar }} 
                                  style={{ width: 36, height: 36, borderRadius: 18, marginBottom: 4 }} 
                                />
                              ) : (
                                <View 
                                  style={{ 
                                    width: 36, 
                                    height: 36, 
                                    borderRadius: 18, 
                                    marginBottom: 4,
                                    backgroundColor: '#E9ECEF',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                  }}
                                >
                                  <Ionicons name="person" size={16} color="#6C757D" />
                                </View>
                              )}
                              <Text style={{ fontSize: 11, fontFamily: 'Onest', color: '#495057', fontWeight: '500' }}>{item.friend_name}</Text>
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
                    { backgroundColor: editedEventTitle.trim() ? '#667eea' : '#ffffff' }
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
                        trackColor={{ false: 'white', true: '#007AFF' }}
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
                              setEditedStartDateTime(selectedDate);
                              if (editedEndDateTime < selectedDate) {
                                const newEnd = new Date(selectedDate);
                                newEnd.setHours(newEnd.getHours() + 1);
                                setEditedEndDateTime(newEnd);
                              }
                                  debouncePickerClose('start');
                              } else {
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
                          <Ionicons name="add" size={12} color="#666" />
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
                                <Ionicons name="checkmark" size={12} color="white" />
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
                        value={editedRepeatEndDate || new Date()}
                        mode="date"
                        display="spinner"
                        onChange={(event, selectedDate) => {
                          if (selectedDate) {
                            setEditedRepeatEndDate(selectedDate);
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
                              backgroundColor: '#007AFF',
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
                  {(editSearchFriend.trim() !== '' || editIsSearchFocused) && (
                    <FlatList
                      data={friends.filter(f =>
                        f.friend_name.toLowerCase().includes(editSearchFriend.toLowerCase()) ||
                        f.friend_username.toLowerCase().includes(editSearchFriend.toLowerCase())
                      )}
                      keyExtractor={item => `${item.friend_id}-${item.friendship_id}`}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={{
                            marginRight: 10,
                            alignItems: 'center',
                            opacity: editSelectedFriends.includes(item.friend_id) ? 0.5 : 1,
                            paddingVertical: 2,
                          }}
                          onPress={() => {
                            setEditSelectedFriends(prev =>
                              prev.includes(item.friend_id)
                                ? prev.filter(id => id !== item.friend_id)
                                : [...prev, item.friend_id]
                            );
                          }}
                        >
                          {item.friend_avatar && item.friend_avatar.trim() !== '' ? (
                            <Image 
                              source={{ uri: item.friend_avatar }} 
                              style={{ width: 36, height: 36, borderRadius: 18, marginBottom: 4 }} 
                            />
                          ) : (
                            <View 
                              style={{ 
                                width: 36, 
                                height: 36, 
                                borderRadius: 18, 
                                marginBottom: 4,
                                backgroundColor: '#E9ECEF',
                                justifyContent: 'center',
                                alignItems: 'center'
                              }}
                            >
                              <Ionicons name="person" size={16} color="#6C757D" />
                            </View>
                          )}
                          <Text style={{ fontSize: 11, fontFamily: 'Onest', color: '#495057', fontWeight: '500' }}>{item.friend_name}</Text>
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

                 {/* Delete Button */}
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
                    Delete Event
                  </Text>
                </TouchableOpacity>

              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>

              {/* Photo Viewer Modal with Zoom/Pan */}
      <Modal
        visible={showPhotoViewer}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPhotoViewer(false)}
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
              onPress={() => setShowPhotoViewer(false)}
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
                const width = e.nativeEvent.layoutMeasurement.width;
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                const photoUrl = selectedPhotoForViewing.event.photos?.[index];
                if (photoUrl && photoUrl !== selectedPhotoForViewing.photoUrl) {
                  setSelectedPhotoForViewing({
                    event: selectedPhotoForViewing.event,
                    photoUrl,
                  });
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
                        setSelectedPhotoForViewing({
                          event: selectedPhotoForViewing.event,
                          photoUrl: photoUrl
                        });
                        // Scroll to the selected photo
                        photoViewerFlatListRef.current?.scrollToIndex({
                          index: index,
                          animated: true,
                        });
                      }}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 6,
                        overflow: 'hidden',
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? '#007AFF' : '#E5E5E7',
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
        transparent={true}
        visible={showSharedEventsModal}
        onRequestClose={() => setShowSharedEventsModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <View style={{ flex: 1 }} />
          <View style={{ 
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'white',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
            maxHeight: '80%',
          }}>
            {/* Header */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#f0f0f0',
            }}>
              <Text style={{ 
                fontSize: 18, 
                fontWeight: '600', 
                color: '#333',
                fontFamily: 'Onest'
              }}>
                Shared Events
              </Text>
              <TouchableOpacity 
                onPress={() => setShowSharedEventsModal(false)}
                style={{
                  padding: 4,
                }}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={{ flex: 1, padding: 20 }}>
              {pendingSharedEvents.length === 0 ? (
                <View style={{ 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  paddingVertical: 40,
                }}>
                  <Ionicons name="checkmark-circle-outline" size={48} color="#4CAF50" />
                  <Text style={{ 
                    fontSize: 16, 
                    color: '#666', 
                    marginTop: 12,
                    fontFamily: 'Onest',
                    textAlign: 'center',
                  }}>
                    No pending shared events
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  {pendingSharedEvents.map((event) => (
                    <View key={event.id} style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: 12,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: '#e9ecef',
                    }}>
                      {/* Event Info */}
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: '#333',
                          marginBottom: 4,
                          fontFamily: 'Onest',
                        }}>
                          {event.title}
                        </Text>
                        {event.description && (
                          <Text style={{
                            fontSize: 14,
                            color: '#666',
                            marginBottom: 8,
                            fontFamily: 'Onest',
                          }}>
                            {event.description}
                          </Text>
                        )}
                        <Text style={{
                          fontSize: 12,
                          color: '#999',
                          fontFamily: 'Onest',
                        }}>
                          {event.date} • {event.isAllDay ? 'All day' : 
                            `${event.startDateTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${event.endDateTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          }
                        </Text>
                      </View>

                      {/* Shared By Info */}
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 16,
                        gap: 8,
                      }}>
                        <View 
                          style={{ 
                            width: 24, 
                            height: 24, 
                            borderRadius: 12,
                            backgroundColor: '#E9ECEF',
                            justifyContent: 'center',
                            alignItems: 'center'
                          }}
                        >
                          <Ionicons name="person" size={12} color="#6C757D" />
                        </View>
                        <Text style={{
                          fontSize: 12,
                          color: '#666',
                          fontFamily: 'Onest',
                        }}>
                          Shared by {event.sharedByFullName || event.sharedByUsername || 'Unknown'}
                        </Text>
                      </View>

                      {/* Action Buttons */}
                      <View style={{
                        flexDirection: 'row',
                        gap: 12,
                      }}>
                        <TouchableOpacity
                          onPress={async () => {
                            await handleAcceptSharedEvent(event);
                            updatePendingSharedEvents();
                            if (pendingSharedEvents.length === 1) {
                              setShowSharedEventsModal(false);
                            }
                          }}
                          style={{
                            flex: 1,
                            backgroundColor: '#4CAF50',
                            paddingVertical: 10,
                            paddingHorizontal: 16,
                            borderRadius: 8,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{
                            color: 'white',
                            fontSize: 14,
                            fontWeight: '600',
                            fontFamily: 'Onest',
                          }}>
                            Accept
                          </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          onPress={async () => {
                            await handleDeclineSharedEvent(event);
                            updatePendingSharedEvents();
                            if (pendingSharedEvents.length === 1) {
                              setShowSharedEventsModal(false);
                            }
                          }}
                          style={{
                            flex: 1,
                            backgroundColor: '#FF6B6B',
                            paddingVertical: 10,
                            paddingHorizontal: 16,
                            borderRadius: 8,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{
                            color: 'white',
                            fontSize: 14,
                            fontWeight: '600',
                            fontFamily: 'Onest',
                          }}>
                            Decline
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Photo Caption Modal */}
      <Modal
        visible={showCaptionModal}
        animationType="slide"
        transparent
        onRequestClose={handleCancelCaption}
      >
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <View style={{
              maxHeight: '80%',
              backgroundColor: '#fff',
              borderRadius: 20,
              marginHorizontal: 20,
              overflow: 'hidden',
            }}>
              <SafeAreaView style={{ flex: 1 }}>
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: '#f0f0f0',
                }}>
                  <TouchableOpacity onPress={handleCancelCaption}>
                    <Text style={{ fontSize: 16, color: '#8E8E93', fontFamily: 'Onest' }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: '#000', fontFamily: 'Onest' }}>
                    Add Caption
                  </Text>
                  <TouchableOpacity onPress={handleShareWithCaption}>
                    <Text style={{ fontSize: 16, color: '#007AFF', fontWeight: '600', fontFamily: 'Onest' }}>
                      Share
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                  {/* Selected Photo */}
                  {pendingPhotoShare && (
                    <View style={{ marginBottom: 16 }}>
                      <Image
                        source={{ uri: pendingPhotoShare.photoUrl }}
                        style={{
                          width: '100%',
                          aspectRatio: 1, // Square aspect ratio to maintain consistency
                          borderRadius: 12,
                          marginBottom: 12,
                          backgroundColor: '#ffffff', // White background
                        }}
                        resizeMode="contain"
                      />
                    </View>
                  )}
                  
                  <Text style={{ fontSize: 16, color: '#000', marginBottom: 12, fontFamily: 'Onest' }}>
                    Add a caption to your photo (optional):
                  </Text>
                  
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: '#E5E5E7',
                      borderRadius: 12,
                      padding: 16,
                      fontSize: 16,
                      color: '#000',
                      fontFamily: 'Onest',
                      minHeight: 100,
                      textAlignVertical: 'top',
                    }}
                    placeholder="What's happening in this photo?"
                    placeholderTextColor="#8E8E93"
                    value={photoCaption}
                    onChangeText={setPhotoCaption}
                    multiline
                    maxLength={200}
                    autoFocus
                  />
                  
                  <Text style={{ 
                    fontSize: 12, 
                    color: '#8E8E93', 
                    textAlign: 'right', 
                    marginTop: 8,
                    fontFamily: 'Onest'
                  }}>
                    {photoCaption.length}/200
                  </Text>
                </ScrollView>
              </SafeAreaView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Google Calendar Sync Modal */}
      <Modal
        visible={showGoogleSyncModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowGoogleSyncModal(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fafafa' }}>
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: 'white',
              borderBottomWidth: 1,
              borderBottomColor: '#e0e0e0',
            }}>
              <TouchableOpacity 
                onPress={() => setShowGoogleSyncModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
              
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#333',
                fontFamily: 'Onest'
              }}>
                Google Calendar Sync
              </Text>
              
              <View style={{ width: 32 }} />
            </View>

            {/* Content - Make it scrollable */}
            <View style={{ flex: 1 }}>
              <GoogleCalendarSync
                userId={user?.id}
                onEventsSynced={(syncedEvents) => {
                  // Handle synced events here
                  console.log('Synced events:', syncedEvents);
                  
                  // Show success message
                  Alert.alert(
                    'Sync Complete',
                    `Successfully synced ${syncedEvents.length} events from Google Calendar!`,
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          // Close the modal
                          setShowGoogleSyncModal(false);
                          // Refresh the events to show the new synced events
                          refreshEvents();
                        }
                      }
                    ]
                  );
                }}
                onCalendarUnsynced={() => {
                  // Refresh events when a calendar is unsynced
                  refreshEvents();
                }}
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
      </>
      
    );
  };
  
  export default CalendarScreen;
