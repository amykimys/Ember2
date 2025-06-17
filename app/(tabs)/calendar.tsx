import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Platform, 
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
  Pressable,
  Switch,
  PanResponder,
  Image,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Animated } from 'react-native';
import { supabase } from '../../supabase'; 
import { Swipeable } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import CustomToast from '../../components/CustomToast';
import WeeklyCalendarView, { WeeklyCalendarViewRef } from '../../components/WeeklyCalendar'; 
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as FileSystem from 'expo-file-system';


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
  photo?: string;
}

interface WeeklyCalendarViewProps {
  events: { [date: string]: CalendarEvent[] };
  setEvents: React.Dispatch<React.SetStateAction<{ [date: string]: CalendarEvent[] }>>;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}


type RepeatOption = 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom';


const SCREEN_WIDTH = Dimensions.get('window').width;
const TOTAL_HORIZONTAL_PADDING = 16; // 8 left + 8 right
const SIDE_PADDING = TOTAL_HORIZONTAL_PADDING / 2; // 8px left or right individually
const SCREEN_HEIGHT = Dimensions.get('window').height;
const BASE_CELL_HEIGHT = Math.max((SCREEN_HEIGHT - 180) / 6, 100);
const CELL_WIDTH = (SCREEN_WIDTH - TOTAL_HORIZONTAL_PADDING) / 7;

// Function to determine if a month needs 6 rows
const needsSixRows = (year: number, month: number) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  return daysInMonth + firstDayOfMonth > 35;
};


// Get cell height based on whether the month needs 6 rows
const getCellHeight = (date: Date | null, isCompact: boolean = false) => {
  if (!date) return BASE_CELL_HEIGHT;

  if (isCompact) {
    return BASE_CELL_HEIGHT * 0.45;
  }

  return needsSixRows(date.getFullYear(), date.getMonth())
    ? BASE_CELL_HEIGHT * 0.7  // 30% shorter for 6-row months in expanded view
    : BASE_CELL_HEIGHT;
};

const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const generateMonthKey = (year: number, month: number) => `${year}-${month}`;

const styles = StyleSheet.create({

  monthLabel: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: '#333',
    fontFamily: 'Onest',
  },
  headerRow: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      paddingHorizontal: 23,
      marginVertical: 1,
      backgroundColor: 'white',
      zIndex: 1,
      marginTop: 15,
      marginBottom: 22
  },
  weekRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
  },
  weekday: {
    width: CELL_WIDTH,
    textAlign: 'center',
    color: '#333',
    paddingBottom: 4,
    fontSize: 14,
    fontFamily: 'Onest',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'white',
    paddingHorizontal: 0,
    position: 'relative',
    overflow: 'visible',
    rowGap: 12,
  },
  gridSixRows: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'white',
    paddingHorizontal: 0,
    position: 'relative',
    overflow: 'visible',
    rowGap: 0,  // Even smaller gap for 6-row months
  },
  eventBox: {
    flexDirection: 'column', 
    justifyContent: 'flex-start', 
    alignItems: 'center',
    marginTop: 3,
    width: '100%',
    paddingHorizontal: 0,
    minHeight: 0,
    flex: 1,
    gap: 2
  },
  eventBoxText: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  cell: {
    width: CELL_WIDTH,
    paddingTop: 2,
    paddingLeft: 2,
    paddingRight: 2,
    borderColor: '#eee',
    backgroundColor: 'white',
    overflow: 'visible',
    zIndex: 0,
  },
  cellContent: {
    flex: 1,
    alignItems: 'center',
  },
  cellExpanded: {
    height: BASE_CELL_HEIGHT + 3.7,
  },
  cellExpandedSixRows: {
    height: BASE_CELL_HEIGHT * 0.9 + 4,  // 10% shorter for 6-row months
  },
  cellCompact: {
    height: BASE_CELL_HEIGHT * 0.435,
    marginBottom: 1,
    paddingTop: 1,
  },
  selectedCell: {
    borderColor: '#BF9264',
  },
  todayCell: {
    backgroundColor: 'transparent',
  },
  dateContainer: {
    alignItems: 'center',
    marginBottom: 0,
    height: 25,
    width: 25,
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12.5,
  },
  dateNumber: {
    fontSize: 15,
    color: '#3A3A3A',
    fontFamily: 'Onest',
    textAlign: 'center',
  },
  eventDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
    height: 8,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  todayContainer: {
    backgroundColor: '#FAF9F6',
  },
  selectedContainer: {
    backgroundColor: '#A0C3B2',
  },
  todayText: {
    color: '#A0C3B2',
    fontWeight: '500',
  },
  selectedText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  adjacentMonthDate: {
    color: '#CCCCCC',
  },
  invisibleText: {
    color: 'transparent',
  },
  addButton: {
    position: 'absolute',
    right: 16,
    top: 58,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {
    fontSize: 24,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    paddingBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: 'Onest',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#A0C3B2',
    marginBottom: 8,
    fontFamily: 'Onest',
  },
  input: {
    borderWidth: 0.5,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    fontFamily: 'Onest',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 0,
    paddingTop: 0,
  },
  cancel: {
    fontSize: 15,
    color: '#666',
    fontFamily: 'Onest',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  save: {
    fontSize: 15,
    color: '#A0C3B2',
    fontWeight: '600',
    fontFamily: 'Onest',
  },
  eventText: {
    fontSize: 12,
    color: '#3A3A3A',
    flex: 1,
    fontFamily: 'Onest',
    textAlign: 'center',
  },
  inputTitle: {
    fontSize: 15,
    padding: 12,
    marginBottom: 10,
    fontFamily: 'Onest',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  inputDescription: {
    fontSize: 13,
    padding: 12,
    height: 85,
    textAlignVertical: 'top',
    marginBottom: 16,
    fontFamily: 'Onest',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  inlineSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },

  gridCompact: {
    paddingTop: 5,  // Add padding to the top of the grid in compact mode
    height: getCellHeight(new Date()) * 5, // Make it much more compact
    overflow: 'hidden',
  }, 
  dateTimePickerContainer: {
    height: 100, // Reduced height to cut off more
    overflow: 'hidden',
    marginTop: 16,
    backgroundColor: '#fafafa',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
    alignItems: 'center',
    justifyContent: 'center',
},
  dateTimePicker: {
    marginTop: -55, // Increased negative margin to cut off more of the top
    transform: [{ scale: 0.8 }], // This will make everything smaller including text
  },
  deleteButton: {
    backgroundColor: '#FAF9F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    width: '48%',
    marginRight: 12,
  },
  deleteButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontFamily: 'Onest',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    width: '48%',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Onest',
    fontWeight: '600',
  },
  dateHeader: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  dateHeaderText: {
    fontSize: 24,
    fontWeight: '500',
    color: '#333',
    paddingLeft: 12,
  },
});

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

const CalendarScreen: React.FC = (): JSX.Element => {
  const today = new Date();
  const [currentMonthIndex, setCurrentMonthIndex] = useState(12); // center month in 25-month buffer
  const flatListRef = useRef<FlatList>(null);
  const weeklyCalendarRef = useRef<WeeklyCalendarViewRef>(null);

  // Add ref for the event title input
  const eventTitleInputRef = useRef<TextInput>(null);

  // Add nextTimeBoxId state
  const [nextTimeBoxId, setNextTimeBoxId] = useState<number>(1);
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
  const [selectedTimeBox, setSelectedTimeBox] = useState<string | null>(null);
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
  const [eventPhoto, setEventPhoto] = useState<string | null>(null);
  const [editedEventPhoto, setEditedEventPhoto] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [selectedPhotoForViewing, setSelectedPhotoForViewing] = useState<{ event: CalendarEvent; photoUrl: string } | null>(null);
  
  const autoCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add these refs for debouncing
  const startPickerTimeoutRef = useRef<NodeJS.Timeout>();
  const endPickerTimeoutRef = useRef<NodeJS.Timeout>();
  const reminderPickerTimeoutRef = useRef<NodeJS.Timeout>();
  const repeatPickerTimeoutRef = useRef<NodeJS.Timeout>();
  const endDatePickerTimeoutRef = useRef<NodeJS.Timeout>();

  const customTimeStartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const customTimeEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  useEffect(() => {
    return () => {
      if (customTimeReminderTimeoutRef.current) {
        clearTimeout(customTimeReminderTimeoutRef.current);
      }
    };
  }, []);
  
  useEffect(() => {
    return () => {
      if (customTimeStartTimeoutRef.current) clearTimeout(customTimeStartTimeoutRef.current);
      if (customTimeEndTimeoutRef.current) clearTimeout(customTimeEndTimeoutRef.current);
    };
  }, []);
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (startPickerTimeoutRef.current) clearTimeout(startPickerTimeoutRef.current);
      if (endPickerTimeoutRef.current) clearTimeout(endPickerTimeoutRef.current);
      if (reminderPickerTimeoutRef.current) clearTimeout(reminderPickerTimeoutRef.current);
      if (repeatPickerTimeoutRef.current) clearTimeout(repeatPickerTimeoutRef.current);
      if (endDatePickerTimeoutRef.current) clearTimeout(endDatePickerTimeoutRef.current);
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
      console.log('🔍 Starting fetchUser...');
      try {
      const { data, error } = await supabase.auth.getUser();
      console.log('👤 Auth data:', data);
      console.log('❌ Auth error if any:', error);
      
      if (error) {
        console.error('❌ Error fetching user:', error);
          return;
        }
        
        if (data?.user) {
        console.log('✅ User fetched successfully:', data.user);
        setUser(data.user);
        
          // Test database connection
          console.log('🔍 Testing database connection...');
          
          // Test events table connection
          const { data: eventsTest, error: eventsError } = await supabase
            .from('events')
            .select('count')
            .limit(1);
          
          console.log('📊 Events table test result:', eventsTest);
          console.log('❌ Events table test error:', eventsError);
          
          if (eventsError) {
            console.error('❌ Events table connection failed:', eventsError);
          } else {
            console.log('✅ Events table connection successful');
          }
        } else {
          console.log('❌ No user found in auth data');
        }
      } catch (error) {
        console.error('💥 Error in fetchUser:', error);
      }
    };
  
    fetchUser();
  }, []);

  // Add auth state change listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', event, session?.user?.id);
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ User signed in, setting user and fetching events');
        setUser(session.user);
        // Add a small delay to ensure user state is set, then fetch events
        setTimeout(() => {
          console.log('🔄 Triggering event fetch after sign in');
          refreshEvents();
        }, 100);
      } else if (event === 'SIGNED_OUT') {
        console.log('🚪 User signed out, clearing user and events');
        setUser(null);
        setEvents({});
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('🔄 Token refreshed, updating user');
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
  

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        console.log('🔍 Starting fetchEvents...');
        console.log('👤 Current user:', user);
        
        if (!user?.id) {
          console.log('❌ No user ID, skipping fetch');
          return;
        }

        // Check session before fetching
        const sessionValid = await checkAndRefreshSession();
        if (!sessionValid) {
          console.log('❌ Session invalid, skipping fetch');
          return;
        }

        console.log('🔍 Fetching events for user:', user.id);
        
        // First, let's check if the events table exists and is accessible
        const { data: tableCheck, error: tableError } = await supabase
          .from('events')
          .select('id')
          .limit(1);

        if (tableError) {
          console.error('❌ Events table access error:', tableError);
          handleDatabaseError(tableError);
          return;
        }

        console.log('✅ Events table is accessible');

        // Now fetch all events for the user
        const { data: eventsData, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: true });

        console.log('📊 Raw events data:', eventsData);
        console.log('❌ Error if any:', error);

        if (error) {
          console.error('❌ Error fetching events:', error);
          handleDatabaseError(error);
          return;
        }

        if (!eventsData || eventsData.length === 0) {
          console.log('📭 No events found in database');
          setEvents({});
          return;
        }

        console.log(`✅ Found ${eventsData.length} events in database`);

        // Transform the events data into our local format
        const transformedEvents = eventsData.reduce((acc, event) => {
          console.log('🔄 Processing event:', event);
          
          // Parse UTC dates with better error handling
          const parseDate = (dateStr: string | null) => {
            if (!dateStr) return null;
            try {
              // Handle both ISO strings and other formats
              const date = new Date(dateStr);
              if (isNaN(date.getTime())) {
                console.warn('⚠️ Invalid date string:', dateStr);
                return null;
              }
              return date;
            } catch (error) {
              console.error('❌ Error parsing date:', dateStr, error);
              return null;
            }
          };

          const startDateTime = event.start_datetime ? parseDate(event.start_datetime) : undefined;
          const endDateTime = event.end_datetime ? parseDate(event.end_datetime) : undefined;
          const reminderTime = event.reminder_time ? parseDate(event.reminder_time) : null;
          const repeatEndDate = event.repeat_end_date ? parseDate(event.repeat_end_date) : null;

          console.log('📅 Parsed dates:', {
            startDateTime,
            endDateTime,
            reminderTime,
            repeatEndDate
          });

          // Convert custom times if they exist
          let customTimes;
          if (event.custom_times && typeof event.custom_times === 'object') {
            console.log('🕐 Processing custom times:', event.custom_times);
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
              console.error('❌ Error processing custom times:', error);
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
            photo: event.photo || null
          };

          console.log('✅ Transformed event:', transformedEvent);

          // For custom events, add to all custom dates
          if (transformedEvent.customDates && transformedEvent.customDates.length > 0) {
            console.log('📅 Adding custom event to dates:', transformedEvent.customDates);
            transformedEvent.customDates.forEach((date: string) => {
              if (!acc[date]) {
                acc[date] = [];
              }
              acc[date].push(transformedEvent);
            });
          } else {
            // For regular events, add to the primary date
            console.log('📅 Adding regular event to date:', transformedEvent.date);
            if (!acc[transformedEvent.date]) {
              acc[transformedEvent.date] = [];
            }
            acc[transformedEvent.date].push(transformedEvent);
          }

          return acc;
        }, {} as { [date: string]: CalendarEvent[] });

        console.log('🎯 Final transformed events:', transformedEvents);
        setEvents(transformedEvents);
        
      } catch (error) {
        console.error('💥 Error in fetchEvents:', error);
      }
    };
    
    fetchEvents();
  }, [user]);

  // Add a function to refresh events
  const refreshEvents = async () => {
    console.log('🔄 Refreshing events...');
    if (user?.id) {
      const { data: eventsData, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) {
        console.error('❌ Error refreshing events:', error);
        return;
      }

      if (!eventsData || eventsData.length === 0) {
        setEvents({});
        return;
      }

      const transformedEvents = eventsData.reduce((acc, event) => {
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
          id: event.id,
          title: event.title || 'Untitled Event',
          description: event.description,
          location: event.location,
          date: event.date,
          startDateTime: event.start_datetime ? parseDate(event.start_datetime) : undefined,
          endDateTime: event.end_datetime ? parseDate(event.end_datetime) : undefined,
          categoryName: event.category_name,
          categoryColor: event.category_color,
          reminderTime: event.reminder_time ? parseDate(event.reminder_time) : null,
          repeatOption: event.repeat_option || 'None',
          repeatEndDate: event.repeat_end_date ? parseDate(event.repeat_end_date) : null,
          customDates: event.custom_dates || [],
          customTimes: event.custom_times || {},
          isAllDay: event.is_all_day || false
        };

        if (transformedEvent.customDates && transformedEvent.customDates.length > 0) {
          transformedEvent.customDates.forEach((date: string) => {
            if (!acc[date]) {
              acc[date] = [];
            }
            acc[date].push(transformedEvent);
          });
        } else {
          if (!acc[transformedEvent.date]) {
            acc[transformedEvent.date] = [];
          }
          acc[transformedEvent.date].push(transformedEvent);
        }

        return acc;
      }, {} as { [date: string]: CalendarEvent[] });

      setEvents(transformedEvents);
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
          console.error('Error fetching categories:', error);
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
        console.error('Error in fetchCategories:', error);
      }
    };
  
    fetchCategories();
  }, [user]);

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
                console.error('Error checking events:', eventsError);
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
                console.error('Error deleting category:', error);
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
              console.error('Error in category deletion:', error);
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

  const months = Array.from({ length: 25 }, (_, i) => getMonthData(today, i - 12));

  const isToday = (date: Date | null) =>
    date?.toDateString() === new Date().toDateString();

  const isSelected = (date: Date | null) =>
    date?.toDateString() === selectedDate.toDateString();

  
  const handleDeleteEvent = async (eventId: string) => {
    try {
      console.log('🗑️ Deleting event with ID:', eventId);
      
      // Delete from database
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) {
        console.error('❌ Error deleting event from database:', error);
        throw error;
      }

      console.log('✅ Event deleted from database successfully');

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
      console.error('Error deleting event:', error);
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
    setEventPhoto(null);
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
      console.log('🔐 Verifying user authentication...');
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('❌ Authentication error:', authError);
        Alert.alert('Authentication Error', 'Please log in again to save events.');
        return;
      }

      if (!currentUser?.id) {
        console.error('❌ No authenticated user found');
        Alert.alert('Authentication Error', 'Please log in to save events.');
        return;
      }

      console.log('✅ User authenticated:', currentUser.id);

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
        id: Date.now().toString(),
        title: newEventTitle,
        description: newEventDescription,
        location: newEventLocation,
        date: getLocalDateString(startDateTime),
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
        isAllDay: isAllDay
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
        user_id: currentUser.id // Use the verified current user ID
      }));

      console.log('📊 Prepared events for database:', dbEvents);

      let dbError;
      // If we have an ID and it's not a new event (editingEvent exists), update the existing event
      if (eventToSave.id && (editingEvent || originalEvent)) {
        const eventToDelete = originalEvent || editingEvent;
        console.log('Editing event with ID:', eventToDelete?.id);
        console.log('Event to delete details:', {
          id: eventToDelete?.id,
          title: eventToDelete?.title,
          date: eventToDelete?.date,
          startDateTime: eventToDelete?.startDateTime
        });
        
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

          console.log('Delete by ID result:', { error: deleteError });
          
          if (!deleteError) {
            deleteSuccess = true;
            console.log('Successfully deleted event by ID');
          } else {
            console.error('Error deleting existing event by ID:', deleteError);
          }
        }

        // Approach 2: If ID deletion failed, try by title and date
        if (!deleteSuccess && eventToDelete?.title && eventToDelete?.date) {
          const { error: fallbackDeleteError } = await supabase
            .from('events')
            .delete()
            .eq('title', eventToDelete.title)
            .eq('date', eventToDelete.date);

          console.log('Delete by title/date result:', { error: fallbackDeleteError });
          
          if (!fallbackDeleteError) {
            deleteSuccess = true;
            console.log('Successfully deleted event by title/date');
          } else {
            console.error('Error deleting existing event by fallback:', fallbackDeleteError);
          }
        }

        // Approach 3: If still not successful, try to find and delete by multiple criteria
        if (!deleteSuccess) {
          console.log('Trying to find event to delete...');
          const { data: eventsToDelete, error: findError } = await supabase
            .from('events')
            .select('*')
            .eq('title', eventToDelete?.title || '')
            .eq('user_id', currentUser.id);

          console.log('Found events to delete:', eventsToDelete);
          
          if (!findError && eventsToDelete && eventsToDelete.length > 0) {
            const eventIds = eventsToDelete.map(e => e.id);
            const { error: bulkDeleteError } = await supabase
              .from('events')
              .delete()
              .in('id', eventIds);

            if (!bulkDeleteError) {
              deleteSuccess = true;
              console.log('Successfully deleted events by bulk delete');
            } else {
              console.error('Error in bulk delete:', bulkDeleteError);
            }
          }
        }

        if (!deleteSuccess) {
          console.error('Failed to delete original event after multiple attempts');
        }

        // Insert the updated event
        console.log('Inserting updated event...');
        const { error: insertError } = await supabase
          .from('events')
          .insert(dbEvents);

        dbError = insertError;
      } else {
        // Insert all new events
        console.log('Inserting new events...');
        const { error: insertError } = await supabase
          .from('events')
          .insert(dbEvents);

        dbError = insertError;
      }

      if (dbError) {
        console.error('Event Save - Database Error:', dbError);
        
        // Check if it's an RLS policy error
        if (dbError.code === '42501') {
          console.error('❌ RLS Policy Error - User may not be properly authenticated');
          Alert.alert(
            'Authentication Error', 
            'Unable to save event. Please try logging out and logging back in.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // You might want to redirect to login here
                  console.log('Redirecting to login...');
                }
              }
            ]
          );
        } else {
        throw dbError;
        }
        return;
      }

      console.log('✅ Events saved successfully to database');

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
      console.error('Error saving event:', error);
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
                        // Compact view: show dots
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
                                  setShowEditEventModal(true);
                                }}
                                onLongPress={() => handleLongPress(event)}
                              >
                                <View
                                  style={[
                                    styles.eventDot,
                                    { backgroundColor: event.categoryColor || '#A0C3B2' }
                                  ]}
                                />
                              </TouchableOpacity>
                            ))}
                          {dayEvents.length > 3 && (
                            <View style={[styles.eventDot, { backgroundColor: '#A0C3B2' }]} />
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
                                    backgroundColor: `${event.categoryColor || '#FF9A8B'}30`, // Lighter background color
                                  }
                                ]}
                              >
                                <Text
                                  numberOfLines={1}
                                  style={styles.eventText}
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

  const handleLongPress = (event: CalendarEvent) => {
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
      setShowEditEventModal(true);
  };

  // Add this effect to reset the time picker state when opening the custom modal
  useEffect(() => {
    if (showCustomDatesPicker) {
      setShowCustomTimePicker(false);
      setEditingTimeBoxId(null);
      setEditingField('start');
    }
  }, [showCustomDatesPicker]);

  // Add these state variables near the top of the component
  const [tempTimeBox, setTempTimeBox] = useState<CustomTimeData | null>(null);
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
  const timeBoxStyles = StyleSheet.create({
    container: {
      marginBottom: 16,
      backgroundColor: '#fafafa',
      borderRadius: 12,
      padding: 12
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8
    },
    dateText: {
      fontSize: 13,
      color: '#666',
      fontFamily: 'Onest'
    },
    timeContainer: {
      flexDirection: 'row',
      gap: 12
    },
    timeButton: {
      flex: 1,
      backgroundColor: '#fff',
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#eee'
    },
    timeLabel: {
      fontSize: 12,
      color: '#666',
      marginBottom: 4,
      fontFamily: 'Onest'
    },
    timeValue: {
      fontSize: 14,
      color: '#333',
      fontFamily: 'Onest'
    },
    pickerContainer: {
      marginTop: 12,
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 12
    },
    pickerLabel: {
      fontSize: 13,
      color: '#666',
      marginBottom: 8,
      fontFamily: 'Onest'
    },
    doneButton: {
      backgroundColor: '#f5f5f5',
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 12
    },
    doneButtonText: {
      fontSize: 15,
      color: '#666',
      fontFamily: 'Onest',
      fontWeight: '500'
    },
    addTimeButton: {
      backgroundColor: '#f5f5f5',
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 8
    },
    addTimeButtonText: {
      fontSize: 15,
      color: '#666',
      fontFamily: 'Onest',
      fontWeight: '500'
    }
  });

  // Update the time box rendering with proper styles
  {Object.entries(customDateTimes).map(([key, timeData]) => {
    if (key === 'default') return null;

    return (
      <View key={key} style={timeBoxStyles.container}>
        <View style={timeBoxStyles.header}>
          <Text style={timeBoxStyles.dateText}>
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

        <View style={timeBoxStyles.timeContainer}>
          <TouchableOpacity
            onPress={() => handleEditTimeBox(key, 'start')}
            style={timeBoxStyles.timeButton}
          >
            <Text style={timeBoxStyles.timeLabel}>Start</Text>
            <Text style={timeBoxStyles.timeValue}>
              {timeData.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleEditTimeBox(key, 'end')}
            style={timeBoxStyles.timeButton}
          >
            <Text style={timeBoxStyles.timeLabel}>End</Text>
            <Text style={timeBoxStyles.timeValue}>
              {timeData.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        </View>

        {isTimePickerVisible && editingTimeBoxId === key && (
          <View style={timeBoxStyles.pickerContainer}>
            <Text style={timeBoxStyles.pickerLabel}>
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
              style={timeBoxStyles.doneButton}
            >
              <Text style={timeBoxStyles.doneButtonText}>Save & Select Dates</Text>
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
      style={timeBoxStyles.addTimeButton}
    >
      <Text style={timeBoxStyles.addTimeButtonText}>Add Time</Text>
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
      console.log('Starting edit process for event:', {
        id: originalEvent.id,
        title: originalEvent.title,
        date: originalEvent.date
      });
      
      // Step 1: Find the event in database by title and date (more reliable than ID)
      const { data: existingEvents, error: findError } = await supabase
        .from('events')
        .select('*')
        .eq('title', originalEvent.title)
        .eq('date', originalEvent.date)
        .eq('user_id', user?.id);

      if (findError) {
        console.error('Error finding event to delete:', findError);
        throw new Error('Failed to find event in database');
      }

      if (!existingEvents || existingEvents.length === 0) {
        console.error('No events found with title and date:', originalEvent.title, originalEvent.date);
        throw new Error('Event not found in database');
      }

      console.log('Found events to delete:', existingEvents);

      // Step 2: Delete all matching events
      const eventIds = existingEvents.map(e => e.id);
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .in('id', eventIds);

      if (deleteError) {
        console.error('Failed to delete events:', deleteError);
        throw new Error('Failed to delete original event');
      }

      console.log('Successfully deleted original events from database');

      // Step 3: Verify deletion by trying to find the events again
      const { data: verifyEvents, error: verifyError } = await supabase
        .from('events')
        .select('id')
        .in('id', eventIds);

      if (!verifyError && verifyEvents && verifyEvents.length > 0) {
        console.error('Events still exist after deletion!');
        throw new Error('Events were not properly deleted');
      }

      console.log('Verified events were deleted successfully');

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

      console.log('Removed event from local state');

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
        user_id: user?.id
      };

      console.log('New event data:', newEventData);

      // Step 6: Insert the new event
      const { data: insertedEvent, error: insertError } = await supabase
        .from('events')
        .insert([newEventData])
        .select()
        .single();

      if (insertError) {
        console.error('Failed to insert new event:', insertError);
        throw new Error('Failed to save edited event');
      }

      console.log('Successfully inserted new event:', insertedEvent);

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
        isAllDay: insertedEvent.is_all_day
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

      console.log('Updated local state with new event');

      // Step 8: Close modal and show success message
      setShowEditEventModal(false);
      setEditingEvent(null);
      setSelectedEvent(null);

      Toast.show({
        type: 'success',
        text1: 'Event updated successfully',
        position: 'bottom',
      });

    } catch (error) {
      console.error('Error editing event:', error);
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

    console.log('🔌 Setting up real-time subscription for events...');

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
          console.log('🔄 Real-time event change:', payload);
          
          // Refresh events when there are changes
          refreshEvents();
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Cleaning up real-time subscription...');
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // Add a function to handle database connection issues
  const handleDatabaseError = (error: any) => {
    console.error('❌ Database error:', error);
    
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
              console.log('Redirecting to login...');
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
      console.log('🔐 Checking Supabase session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ Session check error:', error);
        return false;
      }

      if (!session) {
        console.log('❌ No active session found');
        return false;
      }

      // Check if session is expired or about to expire
      const now = new Date();
      const expiresAt = new Date(session.expires_at! * 1000);
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      
      console.log('📅 Session expires at:', expiresAt);
      console.log('⏰ Time until expiry:', timeUntilExpiry / 1000 / 60, 'minutes');

      // If session expires in less than 5 minutes, refresh it
      if (timeUntilExpiry < 5 * 60 * 1000) {
        console.log('🔄 Refreshing session...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('❌ Session refresh error:', refreshError);
          return false;
        }

        if (refreshData.session) {
          console.log('✅ Session refreshed successfully');
          return true;
        } else {
          console.log('❌ No session returned from refresh');
          return false;
        }
      }

      console.log('✅ Session is valid');
      return true;
    } catch (error) {
      console.error('💥 Error checking session:', error);
      return false;
    }
  };

  // Add a simple authentication test function
  const testAuthentication = async () => {
    try {
      console.log('🧪 Testing authentication...');
      
      // Test 1: Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('👤 Current user:', user);
      console.log('❌ User error:', userError);
      
      // Test 2: Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔐 Current session:', session);
      console.log('❌ Session error:', sessionError);
      
      // Test 3: Try a simple database query
      if (user?.id) {
        const { data: testData, error: testError } = await supabase
          .from('events')
          .select('count')
          .eq('user_id', user.id)
          .limit(1);
        
        console.log('📊 Test query result:', testData);
        console.log('❌ Test query error:', testError);
        
        if (testError) {
          console.error('❌ Database access failed:', testError);
          return false;
        } else {
          console.log('✅ Database access successful');
          return true;
        }
      } else {
        console.log('❌ No user ID available for testing');
        return false;
      }
    } catch (error) {
      console.error('💥 Authentication test error:', error);
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
      console.log('📸 Uploading event photo for event:', eventId);
      console.log('📸 Photo URI:', photoUri);
      
      // Use expo-file-system to read the file
      const fileInfo = await FileSystem.getInfoAsync(photoUri);
      console.log('📸 File info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }
      
      if (fileInfo.size === 0) {
        throw new Error('File is empty');
      }
      
      console.log('📸 File size:', fileInfo.size);
      
      // Read the file as base64
      const base64Data = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log('📸 Base64 data length:', base64Data.length);
      
      // Convert base64 to Uint8Array
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      console.log('📸 Bytes length:', bytes.length);
      
      // Create a unique filename
      const fileExt = photoUri.split('.').pop() || 'jpg';
      const fileName = `events/${eventId}/event_${Date.now()}.${fileExt}`;
      
      console.log('📸 Uploading to filename:', fileName);
      
      // Upload to Supabase Storage using Uint8Array
      const { data, error: uploadError } = await supabase.storage
        .from('habit-photos')
        .upload(fileName, bytes, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (uploadError) {
        console.error('📸 Upload error:', uploadError);
        throw uploadError;
      }
      
      console.log('📸 Upload successful, data:', data);
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('habit-photos')
        .getPublicUrl(fileName);

      console.log('📸 Photo uploaded successfully:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('📸 Error uploading event photo:', error);
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

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      };

      let result;
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets[0]) {
        setIsUploadingPhoto(true);
        try {
          const photoUrl = await uploadEventPhoto(result.assets[0].uri, eventId || 'temp');
          
          if (eventId) {
            // Update existing event with photo
            await updateEventPhoto(eventId, photoUrl);
          } else {
            // Set photo for new event
            setEventPhoto(photoUrl);
          }
          
          Toast.show({
            type: 'success',
            text1: 'Photo added successfully',
            position: 'bottom',
          });
        } catch (error) {
          console.error('Error uploading photo:', error);
          Alert.alert('Error', 'Failed to upload photo. Please try again.');
        } finally {
          setIsUploadingPhoto(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
      setIsUploadingPhoto(false);
    }
  };

  const updateEventPhoto = async (eventId: string, photoUrl: string) => {
    try {
      console.log('📸 Updating event photo in database:', { eventId, photoUrl });
      
      const { error } = await supabase
        .from('events')
        .update({ photo: photoUrl })
        .eq('id', eventId);

      if (error) {
        console.error('❌ Error updating event photo:', error);
        throw error;
      }

      console.log('✅ Event photo updated in database successfully');

      // Update local state
      setEvents(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(date => {
          updated[date] = updated[date].map(event => 
            event.id === eventId ? { ...event, photo: photoUrl } : event
          );
        });
        return updated;
      });

      console.log('✅ Local state updated with photo');
      
      // Refresh events to ensure UI is updated
      setTimeout(() => {
        console.log('🔄 Refreshing events after photo update...');
        refreshEvents();
      }, 500);
    } catch (error) {
      console.error('❌ Error updating event photo:', error);
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

  return (
    <>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
  {calendarMode === 'month' ? (
    <View style={{ flex: 1, flexDirection: 'column' }}>
      {/* Fixed Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setCalendarMode('week')}>
          <MaterialIcons name="calendar-view-week" size={24} color="#333" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            const today = new Date();
            const monthIndex = months.findIndex(
              (m) => m.year === today.getFullYear() && m.month === today.getMonth()
            );
            if (monthIndex !== -1) {
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

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
                        rightThreshold={40}
                      >
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#fff',
                            borderRadius: 12,
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                          }}
                          onPress={() => {
                            const selectedEventData = { event, dateKey: event.date, index };
                            setSelectedEvent(selectedEventData);
                            setEditingEvent(event);
                            setEditedEventTitle(event.title);
                            setEditedEventDescription(event.description ?? '');
                            setEditedEventLocation(event.location ?? '');
                            setEditedStartDateTime(new Date(event.startDateTime!));
                            setEditedEndDateTime(new Date(event.endDateTime!));
                            setEditedSelectedCategory(
                              event.categoryName ? { name: event.categoryName, color: event.categoryColor! } : null
                            );
                            setEditedReminderTime(event.reminderTime ? new Date(event.reminderTime) : null);
                            setEditedRepeatOption(event.repeatOption || 'None');
                            setEditedRepeatEndDate(event.repeatEndDate ? new Date(event.repeatEndDate) : null);
                            setCustomSelectedDates(event.customDates || []);
                            setIsEditedAllDay(event.isAllDay || false);
                            setShowEditEventModal(true);
                          }}
                          onLongPress={() => handleLongPress(event)}
                        >
                          {/* Category Color Bar */}
                          <View
                            style={{
                              width: 5.5,
                              height: 46,
                              borderRadius: 3,
                              backgroundColor: event.categoryColor || '#A0C3B2',
                              marginRight: 14,
                            }}
                          />
                          {/* Event Info */}
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#222', marginBottom: 3.5 }}>
                              {event.title}
                            </Text>
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
                          </View>
                          
                          {/* Photo Section */}
                          <View style={{ alignItems: 'flex-end', gap: 8 }}>
                            {event.photo ? (
                              <TouchableOpacity
                                onPress={() => {
                                  setSelectedPhotoForViewing({ event, photoUrl: event.photo! });
                                  setShowPhotoViewer(true);
                                }}
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 8,
                                  overflow: 'hidden',
                                }}
                              >
                                <Image
                                  source={{ uri: event.photo }}
                                  style={{ width: '100%', height: '100%' }}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            ) : null}
                            
                            <TouchableOpacity
                              onPress={() => showEventPhotoOptions(event.id)}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: '#f0f0f0',
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              {isUploadingPhoto ? (
                                <ActivityIndicator size="small" color="#007AFF" />
                              ) : (
                                <Ionicons name="camera" size={16} color="#666" />
                              )}
                            </TouchableOpacity>
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
        <TouchableOpacity onPress={() => setCalendarMode('month')}>
          <MaterialIcons name="calendar-view-month" size={24} color="#333" />
        </TouchableOpacity>

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

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="close" size={16} color="#666" />
              </TouchableOpacity>
              
              <Text style={{ 
                fontSize: 16, 
                fontWeight: '600', 
                color: '#333',
                fontFamily: 'Onest'
              }}>
                New Event
              </Text>
              
                    <TouchableOpacity 
                onPress={() => handleSaveEvent()}
                disabled={!newEventTitle.trim()}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: newEventTitle.trim() ? '#007AFF' : '#ffffff',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
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
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
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
                  <View style={{
                    backgroundColor: 'white',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 18,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 1,
                  }}>
              
                      <TextInput
                      style={{
                        fontSize: 17,
                        fontFamily: 'Onest',
                        fontWeight: '500',
                        marginBottom: 5,
                      }}
                      placeholder="Event Title"
                      placeholderTextColor="#888"
                        value={newEventTitle}
                        onChangeText={setNewEventTitle}
                        ref={eventTitleInputRef}
                      />
  
                      <TextInput
                        style={{
                          fontSize: 13,
                          color: '#666',
                          fontFamily: 'Onest',
                          fontWeight: '400',
                          marginTop: 5,
                          paddingVertical: 2,
                          paddingHorizontal: 0,
                          textAlignVertical: 'top',
                        }}
                        placeholder="Description"
                        placeholderTextColor="#999"
                        value={newEventDescription}
                        onChangeText={setNewEventDescription}
                        multiline
                        numberOfLines={3}
                      />

                      <TextInput
                        style={{
                          fontSize: 13,
                          color: '#666',
                          fontFamily: 'Onest',
                          fontWeight: '400',
                          marginTop: 8,
                          paddingVertical: 2,
                          paddingHorizontal: 0,
                        }}
                        placeholder="Location"
                        placeholderTextColor="#999"
                        value={newEventLocation}
                        onChangeText={setNewEventLocation}
                      />
                  </View>

                  {/* Time & Date Card */}
                  <View style={{
                    backgroundColor: 'white',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 18,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 1,
                  }}>
                    
                    {/* All Day Toggle */}
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      marginTop: -5,
                      marginBottom: 12,
                      paddingVertical: 0,
                    }}>
                      <Text style={{ 
                        fontSize: 14, 
                        color: '#333', 
                        fontFamily: 'Onest', 
                        fontWeight: '500'
                      }}>
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
                    <View style={{ gap: 8 }}>
                      <View>
                        <View style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          marginBottom: 0,
                        }}>
                          <Text style={{ 
                            fontSize: 14, 
                            color: '#333', 
                            fontFamily: 'Onest',
                            fontWeight: '500'
                          }}>
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
                            style={{
                              backgroundColor: '#f8f9fa',
                              borderRadius: 8,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderWidth: 1,
                              borderColor: showStartPicker ? '#007AFF' : '#f0f0f0',
                            }}
                          >
                            <Text style={{
                              fontSize: 14,
                              color: '#333',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
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
                        <View style={{ 
                          flexDirection: 'row', 
                              alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 0,
                        }}>
                          <Text style={{ 
                            fontSize: 14, 
                            color: '#333', 
                            fontFamily: 'Onest',
                            fontWeight: '500'
                          }}>
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
                            style={{
                              backgroundColor: '#f8f9fa',
                              borderRadius: 8,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderWidth: 1,
                              borderColor: showEndPicker ? '#007AFF' : '#f0f0f0',
                            }}
                          >
                            <Text style={{
                              fontSize: 14,
                              color: '#333',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
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
                      <View style={{
                        backgroundColor: '#f8f9fa',
                        borderRadius: 8,
                        paddingHorizontal: 6,
                        marginTop: 10,
                      }}>
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
                  <View style={{
                    backgroundColor: 'white',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 18,
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
                      marginBottom: 12,
                      fontFamily: 'Onest'
                    }}>
                      Category
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        Keyboard.dismiss();
                        setShowCategoryPicker(prev => !prev);
                        if (showCategoryPicker) {
                          setShowAddCategoryForm(false);
                          setNewCategoryName('');
                          setNewCategoryColor(null);
                        }
                      }}
                      style={{
                        backgroundColor: '#f8f9fa',
                        borderRadius: 8,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderWidth: 1,
                        borderColor: showCategoryPicker ? '#007AFF' : '#f0f0f0',
                            }}
                          >
                            {!showCategoryPicker ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {selectedCategory ? (
                                <>
                                  <View style={{ 
                                      width: 8, 
                                      height: 8, 
                                      borderRadius: 4, 
                                    backgroundColor: selectedCategory.color,
                                    marginRight: 8
                                  }} />
                                  <Text style={{ 
                                  fontSize: 14, 
                                  color: '#333',
                                    fontFamily: 'Onest',
                                    fontWeight: '500'
                                  }}>
                                    {selectedCategory.name}
                                  </Text>
                                </>
                              ) : (
                                <Text style={{ 
                                fontSize: 14, 
                                color: '#999',
                                  fontFamily: 'Onest',
                                  fontWeight: '500'
                                }}>
                                Choose category
                                </Text>
                              )}
                          </View>
                          <Ionicons name="chevron-down" size={12} color="#999" />
                            </View>
                            ) : (
                              <View style={{ 
                              flexDirection: 'row', 
                              flexWrap: 'wrap', 
                          justifyContent: 'flex-start',
                          gap: 6,
                            }}>
                              {categories.map((cat, idx) => (
                                  <Pressable
                                  key={idx}
                                  onPress={() => {
                                    setSelectedCategory(cat);
                                    setShowCategoryPicker(false);
                                    setShowAddCategoryForm(false);
                                  }}
                                  onLongPress={() => handleCategoryLongPress(cat)}
                                  style={({ pressed }) => ({
                                backgroundColor: selectedCategory?.name === cat.name ? cat.color + '20' : '#f8f9fa',
                                paddingVertical: 6,
                                paddingHorizontal: 10,
                                borderRadius: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                gap: 4,
                                  })}
                                >
                                  <View style={{ 
                                      width: 6, 
                                      height: 6, 
                                      borderRadius: 3, 
                                      backgroundColor: cat.color,
                                    }} />
                                  <Text style={{ 
                                color: '#333', 
                                    fontSize: 12, 
                                    fontFamily: 'Onest',
                                    fontWeight: selectedCategory?.name === cat.name ? '600' : '500',
                                  }}>
                                    {cat.name}
                                  </Text>
                                </Pressable>
                              ))}
                              <TouchableOpacity
                                onPress={() => setShowAddCategoryForm(true)}
                                style={{
                              backgroundColor: '#f8f9fa',
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              borderRadius: 16,
                        
                                  flexDirection: 'row',
                                  alignItems: 'center',
                              gap: 4,
                                }}
                              >
                            <Ionicons name="add" size={12} color="#666" />
                              </TouchableOpacity>
                        </View>
                      )}

                                {showAddCategoryForm && (
                                  <View style={{
                          backgroundColor: '#f8f9fa',
                          padding: 12,
                          borderRadius: 8,
                                    marginTop: 8,
                    
                                  }}>
                                    <Text style={{
                            fontSize: 14,
                            color: '#333',
                                      fontFamily: 'Onest',
                            fontWeight: '600',
                                      marginBottom: 8,
                                    }}>
                                      New Category
                                    </Text>
                                    <TextInput
                                      style={{
                                        backgroundColor: 'white',
                              padding: 8,
                              borderRadius: 6,
                              marginBottom: 8,
                              fontSize: 14,
                                        fontFamily: 'Onest',
                              borderWidth: 1,
                              borderColor: '#e0e0e0',
                                      }}
                                      placeholder="Category name"
                                      value={newCategoryName}
                                      onChangeText={setNewCategoryName}
                                    />
                                    
                          {/* Color Picker */}
                                    <Text style={{
                            fontSize: 12,
                            color: '#666',
                                      fontFamily: 'Onest',
                            fontWeight: '500',
                            marginBottom: 6,
                                    }}>
                                      Color
                                    </Text>
                                    <View style={{
                                      flexDirection: 'row',
                                      flexWrap: 'wrap',
                            gap: 6,
                                      marginBottom: 12,
                                    }}>
                                      {CATEGORY_COLORS.map((color) => (
                                        <TouchableOpacity
                                          key={color}
                                          onPress={() => setNewCategoryColor(color)}
                                          style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: 12,
                                            backgroundColor: color,
                                  borderWidth: newCategoryColor === color ? 2 : 0,
                                  borderColor: '#333',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                }}
                              >
                                {newCategoryColor === color && (
                                  <Ionicons name="checkmark" size={12} color="white" />
                                          )}
                                        </TouchableOpacity>
                                      ))}
                                    </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
                                      <TouchableOpacity
                                        onPress={() => {
                                          setShowAddCategoryForm(false);
                                          setNewCategoryName('');
                                setNewCategoryColor(null);
                                        }}
                                        style={{
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 6,
                                        }}
                                      >
                                        <Text style={{
                                          color: '#666',
                                fontSize: 14,
                                          fontFamily: 'Onest',
                                fontWeight: '500',
                                        }}>
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
                                              console.error('Error creating category:', error);
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
                                              setNewCategoryColor(null);
                                            }
                                          }
                                        }}
                                        style={{
                                backgroundColor: '#007AFF',
                                          paddingVertical: 6,
                                          paddingHorizontal: 12,
                                borderRadius: 6,
                                        }}
                                      >
                                        <Text style={{
                                          color: 'white',
                                fontSize: 14,
                                          fontFamily: 'Onest',
                                          fontWeight: '600',
                                        }}>
                                          Add
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>

                  {/* Options Card */}
                  <View style={{
                    backgroundColor: 'white',
                                borderRadius: 12,
                    padding: 16,
                    marginBottom: 18,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.05,
                    shadowRadius: 4,
                                elevation: 1,
                  }}>
                             
                    
                    <View style={{ gap: 8 }}>
                      {/* Reminder */}
                      <View>
                        <View style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          marginBottom: 4,
                        }}>
                          <Text style={{ 
                            fontSize: 14, 
                            color: '#333', 
                                fontFamily: 'Onest',
                                fontWeight: '500'
                              }}>
                            Reminder
                              </Text>
                            <TouchableOpacity
                              onPress={() => setShowReminderOptions(prev => !prev)}
                              style={{
                                backgroundColor: '#f8f9fa',
                                borderRadius: 8,
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderWidth: 1,
                                borderColor: showReminderOptions ? '#007AFF' : '#f0f0f0',
                              }}
                            >
                              <Text style={{
                                fontSize: 14,
                                color: '#333',
                                fontFamily: 'Onest',
                                fontWeight: '500'
                              }}>
                                {reminderOffset === -1 ? 'No reminder' : REMINDER_OPTIONS.find(opt => opt.value === reminderOffset)?.label || 'No reminder'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                          {showReminderOptions && (
                            <View style={{
                              backgroundColor: '#f8f9fa',
                              borderRadius: 8,
                              paddingHorizontal: 8,
                              marginTop: 8,
                              borderWidth: 1,
                              borderColor: '#e0e0e0',
                              maxHeight: 170,
                            }}>
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
                              style={{
                                paddingVertical: 10,
                                      paddingHorizontal: 6,
                                      borderRadius: 4,
                                      backgroundColor: reminderOffset === opt.value ? '#007AFF20' : 'transparent',
                                      marginBottom: 1,
                              }}
                            >
                              <Text style={{
                                      fontSize: 14,
                                      color: '#333',
                                fontFamily: 'Onest',
                                      fontWeight: reminderOffset === opt.value ? '600' : '500',
                                    }}>{opt.label}</Text>
                            </TouchableOpacity>
                                ))}
                              </ScrollView>
                          </View>
                        )}
                      </View>

                      {/* Repeat */}
                      <View>
                        <View style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          marginBottom: 4,
                        }}>
                          <Text style={{ 
                            fontSize: 14, 
                            color: '#333', 
                            fontFamily: 'Onest',
                            fontWeight: '500'
                          }}>
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
                            style={{
                              backgroundColor: '#f8f9fa',
                              borderRadius: 8,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderWidth: 1,
                              borderColor: showRepeatPicker ? '#007AFF' : '#f0f0f0',
                            }}
                          >
                            <Text style={{
                              fontSize: 14,
                              color: '#333',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                              {repeatOption === 'None' ? 'Does not repeat' : repeatOption}
                              </Text>
                            </TouchableOpacity>
                          </View>
                      </View>

                      {/* End Date (if repeating) */}
                          {repeatOption !== 'None' && (
                        <View>
                          <View style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            marginBottom: 4,
                          }}>
                            <Text style={{ 
                              fontSize: 14, 
                              color: '#333', 
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
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
                              style={{
                                backgroundColor: '#f8f9fa',
                                borderRadius: 8,
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderWidth: 1,
                                borderColor: showEndDatePicker ? '#007AFF' : '#f0f0f0',
                              }}
                            >
                              <Text style={{
                                fontSize: 14,
                                color: '#333',
                                fontFamily: 'Onest',
                                fontWeight: '500'
                              }}>
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

                    {/* Picker Components */}
                        {showReminderPicker && (
                      <View style={{
                        backgroundColor: '#f8f9fa',
                        borderRadius: 8,
                        padding: 12,
                        marginTop: 8,
                        borderWidth: 1,
                        borderColor: '#e0e0e0',
                      }}>
                            <DateTimePicker
                              value={reminderTime || new Date()}
                              mode="time"
                              display="spinner"
                              onChange={(event, selectedTime) => {
                                if (selectedTime) {
                                  setReminderTime(selectedTime);
                                  debouncePickerClose('reminder');
                                }
                              }}
                          style={{ height: 100, width: '100%' }}
                              textColor="#333"
                            />
                      </View>
                        )}

                        {showEndDatePicker && (
                      <View style={{
                        backgroundColor: '#f8f9fa',
                        borderRadius: 8,
                        paddingHorizontal: 6,
                        marginTop: 8,
                      }}>
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

                        {showRepeatPicker && (
                      <View style={{ 
                        backgroundColor: '#f8f9fa',
                        borderRadius: 8,
                        padding: 6,
                        marginTop: 8,
                        borderWidth: 1,
                        borderColor: '#e0e0e0',
                      }}>
                        {['Does not repeat', 'Daily', 'Weekly', 'Monthly', 'Yearly', 'Custom'].map((option) => (
                              <TouchableOpacity 
                                key={option}
                                onPress={() => {
                                  if (option === 'Custom') {
                                    setRepeatOption('Custom');
                                    setShowRepeatPicker(false);
                                setIsEditingEvent(false);
                                    const currentStartTime = startDateTime;
                                    const currentEndTime = endDateTime;
                                    const currentDateStr = getLocalDateString(currentStartTime);
                                    
                                    const initialCustomTimes: CustomTimes = {
                                      default: {
                                        start: currentStartTime,
                                        end: currentEndTime,
                                        reminder: reminderTime,
                                        repeat: 'None',
                                        dates: [currentDateStr]
                                      }
                                    };
                                    
                                    if (!customSelectedDates.includes(currentDateStr)) {
                                      setCustomSelectedDates([currentDateStr]);
                                    }
                                    
                                    initialCustomTimes[currentDateStr] = {
                                      start: currentStartTime,
                                      end: currentEndTime,
                                      reminder: reminderTime,
                                      repeat: 'None',
                                      dates: [currentDateStr]
                                    };
                                    
                                    setCustomDateTimes(initialCustomTimes);
                                    setShowModal(false);
                                    setShowCustomDatesPicker(true);
                                  } else {
                                setRepeatOption(option === 'Does not repeat' ? 'None' : option as RepeatOption);
                                    debouncePickerClose('repeat');
                                  }
                                }}
                                style={{
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: 6,
                              backgroundColor: (option === 'Does not repeat' ? repeatOption === 'None' : repeatOption === option) ? '#007AFF20' : 'transparent',
                              marginBottom: 2,
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
                              </TouchableOpacity>
                            ))}
                      </View>
                        )}
                      </View>
                    </>
                  ) : (
                    <>
                  {/* Custom Event Form */}
                  <View style={{
                    backgroundColor: 'white',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
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
                      marginBottom: 8,
                      fontFamily: 'Onest'
                    }}>
                      Event Details
                    </Text>
                      <TextInput
                      style={{
                        fontSize: 17,
                        color: '#333',
                        fontFamily: 'Onest',
                        fontWeight: '500',
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: '#f0f0f0',
                        marginBottom: 12,
                      }}
                      placeholder="Event Title"
                      placeholderTextColor="#3a3a3a"
                        value={newEventTitle}
                        onChangeText={setNewEventTitle}
                      />

                    {/* Category Selection for Custom Events */}
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#333',
                      marginBottom: 8,
                      fontFamily: 'Onest'
                    }}>
                      Category
                    </Text>
                        <TouchableOpacity
                          onPress={() => {
                            Keyboard.dismiss();
                            setShowCategoryPicker(prev => !prev);
                            if (showCategoryPicker) {
                              setShowAddCategoryForm(false);
                              setNewCategoryName('');
                          setNewCategoryColor(null);
                            }
                          }}
                          style={{
                        borderRadius: 8,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                        borderWidth: 1,
                        borderColor: showCategoryPicker ? '#007AFF' : '#f0f0f0',
                          }}
                        >
                          {!showCategoryPicker ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {selectedCategory ? (
                                <>
                                  <View style={{ 
                                    width: 8, 
                                    height: 8, 
                                    borderRadius: 4, 
                                    backgroundColor: selectedCategory.color,
                                    marginRight: 8
                                  }} />
                                  <Text style={{ 
                                  fontSize: 14, 
                                  color: '#333',
                                    fontFamily: 'Onest',
                                    fontWeight: '500'
                                  }}>
                                    {selectedCategory.name}
                          </Text>
                                </>
                              ) : (
                                <Text style={{ 
                                fontSize: 14, 
                                color: '#999',
                                  fontFamily: 'Onest',
                                  fontWeight: '500'
                                }}>
                                Choose category
                                </Text>
                              )}
                          </View>
                          <Ionicons name="chevron-down" size={12} color="#999" />
                            </View>
                          ) : (
                            <View style={{ 
                              flexDirection: 'row', 
                              flexWrap: 'wrap', 
                          justifyContent: 'flex-start',
                          gap: 6,
                            }}>
                            {categories.map((cat, idx) => (
                                <Pressable
                                key={idx}
                                onPress={() => {
                                    setSelectedCategory(cat);
                                  setShowCategoryPicker(false);
                                    setShowAddCategoryForm(false);
                                  }}
                                
                                >
                                  <View style={{ 
                                    width: 6, 
                                    height: 6, 
                                    borderRadius: 3, 
                                    backgroundColor: cat.color,
                                  }} />
                                  <Text style={{ 
                                color: '#333', 
                                    fontSize: 12, 
                                    fontFamily: 'Onest',
                                    fontWeight: selectedCategory?.name === cat.name ? '600' : '500',
                                  }}>
                                    {cat.name}
                                  </Text>
                                </Pressable>
                            ))}
                            <TouchableOpacity
                              onPress={() => setShowAddCategoryForm(true)}
                              style={{
                              backgroundColor: '#f8f9fa',
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              borderRadius: 16,
                              borderWidth: 1,
                              borderColor: '#e0e0e0',
                                flexDirection: 'row',
                                alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Ionicons name="add" size={12} color="#666" />
                            <Text style={{ 
                              color: '#666', 
                              fontSize: 12, 
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                              New
                            </Text>
                            </TouchableOpacity>
                        </View>
                      )}

                              {showAddCategoryForm && (
                                <View style={{
                          backgroundColor: '#f8f9fa',
                          padding: 12,
                          borderRadius: 8,
                                  marginTop: 8,
                          borderWidth: 1,
                          borderColor: '#e0e0e0',
                                }}>
                                  <Text style={{
                            fontSize: 14,
                            color: '#333',
                                    fontFamily: 'Onest',
                            fontWeight: '600',
                                    marginBottom: 8,
                                  }}>
                                    New Category
                                  </Text>
                                  <TextInput
                                      style={{
                                        backgroundColor: 'white',
                              padding: 8,
                              borderRadius: 6,
                              marginBottom: 8,
                              fontSize: 14,
                                        fontFamily: 'Onest',
                              borderWidth: 1,
                              borderColor: '#e0e0e0',
                                      }}
                                      placeholder="Category name"
                                      value={newCategoryName}
                                      onChangeText={setNewCategoryName}
                                    />
                                    
                          {/* Color Picker */}
                                    <Text style={{
                            fontSize: 12,
                            color: '#666',
                                      fontFamily: 'Onest',
                            fontWeight: '500',
                            marginBottom: 6,
                                    }}>
                                      Color
                                    </Text>
                                    <View style={{
                                      flexDirection: 'row',
                                      flexWrap: 'wrap',
                            gap: 6,
                                      marginBottom: 12,
                                    }}>
                                      {CATEGORY_COLORS.map((color) => (
                                        <TouchableOpacity
                                          key={color}
                                          onPress={() => setNewCategoryColor(color)}
                                          style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: 12,
                                            backgroundColor: color,
                                  borderWidth: newCategoryColor === color ? 2 : 0,
                                  borderColor: '#333',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                }}
                              >
                                {newCategoryColor === color && (
                                  <Ionicons name="checkmark" size={12} color="white" />
                                          )}
                                        </TouchableOpacity>
                                      ))}
                                    </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
                                      <TouchableOpacity
                                        onPress={() => {
                                          setShowAddCategoryForm(false);
                                          setNewCategoryName('');
                                setNewCategoryColor(null);
                                        }}
                                        style={{
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 6,
                                        }}
                                      >
                                        <Text style={{
                                          color: '#666',
                                fontSize: 14,
                                          fontFamily: 'Onest',
                                fontWeight: '500',
                                        }}>
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
                                              console.error('Error creating category:', error);
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
                                              setNewCategoryColor(null);
                                            }
                                          }
                                        }}
                                        style={{
                                backgroundColor: '#007AFF',
                                          paddingVertical: 6,
                                          paddingHorizontal: 12,
                                borderRadius: 6,
                                        }}
                                      >
                                        <Text style={{
                                          color: 'white',
                                fontSize: 14,
                                          fontFamily: 'Onest',
                                          fontWeight: '600',
                                        }}>
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
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="close" size={16} color="#666" />
                        </TouchableOpacity>
                
                <Text style={{ 
                  fontSize: 16, 
                  fontWeight: '600', 
                  color: '#333',
                  fontFamily: 'Onest'
                }}>
                  Edit Event
                </Text>
                
                      <TouchableOpacity 
                  onPress={() => handleEditEvent()}
                  disabled={!editedEventTitle.trim()}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: editedEventTitle.trim() ? '#007AFF' : '#ffffff',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
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
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Event Title Card */}
                <View style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 18,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}>
                    <TextInput
                    style={{
                      fontSize: 17,
                      color: '#333',
                      fontFamily: 'Onest',
                      fontWeight: '500',
                      marginBottom: 5,
                    }}
                    placeholder="Event Title"
                    placeholderTextColor="#888"
                      value={editedEventTitle}
                      onChangeText={setEditedEventTitle}
                    />

                    <TextInput
                    style={{
                      fontSize: 13,
                      color: '#666',
                      fontFamily: 'Onest',
                      fontWeight: '400',
                      marginTop: 5,
                      paddingVertical: 2,
                      paddingHorizontal: 0,
                      textAlignVertical: 'top',
                    }}
                    placeholder="Description"
                    placeholderTextColor="#999"
                      value={editedEventDescription}
                      onChangeText={setEditedEventDescription}
                      multiline
                    numberOfLines={3}
                  />

                  <TextInput
                            style={{
                      fontSize: 13,
                      color: '#666',
                      fontFamily: 'Onest',
                      fontWeight: '400',
                      marginTop: 8,
                      paddingVertical: 2,
                      paddingHorizontal: 0,
                    }}
                    placeholder="Location"
                    placeholderTextColor="#999"
                    value={editedEventLocation}
                    onChangeText={setEditedEventLocation}
                  />
                </View>

                {/* Time & Date Card */}
                <View style={{
                  backgroundColor: 'white',
                              borderRadius: 12,
                  padding: 16,
                  marginBottom: 18,
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.05,
                  shadowRadius: 4,
                              elevation: 1,
                }}>
                  {/* All Day Toggle */}
                              <View style={{ 
                                      flexDirection: 'row',
                                      alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: -5,
                    marginBottom: 12,
                    paddingVertical: 0,
                  }}>
                                    <Text style={{ 
                      fontSize: 14, 
                      color: '#333', 
                                      fontFamily: 'Onest',
                                      fontWeight: '500'
                                    }}>
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
                  <View style={{ gap: 8 }}>
                    <View>
                                    <View style={{
                                      flexDirection: 'row',
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: 0,
                      }}>
                                        <Text style={{
                          fontSize: 14, 
                          color: '#333', 
                                          fontFamily: 'Onest',
                          fontWeight: '500'
                                        }}>
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
                                        style={{
                            backgroundColor: '#f8f9fa',
                                          borderRadius: 8,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderWidth: 1,
                            borderColor: showStartPicker ? '#007AFF' : '#f0f0f0',
                                        }}
                                      >
                                        <Text style={{
                            fontSize: 14,
                            color: '#333',
                                          fontFamily: 'Onest',
                            fontWeight: '500'
                          }}>
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
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 0,
                      }}>
                        <Text style={{ 
                          fontSize: 14, 
                          color: '#333', 
                          fontFamily: 'Onest',
                          fontWeight: '500'
                        }}>
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
                          style={{
                            backgroundColor: '#f8f9fa',
                            borderRadius: 8,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderWidth: 1,
                            borderColor: showEndPicker ? '#007AFF' : '#f0f0f0',
                          }}
                        >
                          <Text style={{
                            fontSize: 14,
                            color: '#333',
                            fontFamily: 'Onest',
                            fontWeight: '500'
                          }}>
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
                    <View style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: 8,
                      paddingHorizontal: 6,
                      marginTop: 10,
                    }}>
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
                <View style={{
                  backgroundColor: 'white',
                          borderRadius: 12,
                  padding: 16,
                  marginBottom: 18,
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
                    marginBottom: 12,
                    fontFamily: 'Onest'
                  }}>
                    Category
                                </Text>
                        <TouchableOpacity
                          onPress={() => {
                            Keyboard.dismiss();
                            setShowCategoryPicker(prev => !prev);
                            if (showCategoryPicker) {
                              setShowAddCategoryForm(false);
                              setNewCategoryName('');
                        setNewCategoryColor(null);
                            }
                          }}
                          style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: 8,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: showCategoryPicker ? '#007AFF' : '#f0f0f0',
                          }}
                        >
                          {!showCategoryPicker ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {editedSelectedCategory ? (
                                <>
                                  <View style={{ 
                                    width: 8, 
                                    height: 8, 
                                    borderRadius: 4, 
                                backgroundColor: editedSelectedCategory.color,
                                    marginRight: 8
                                  }} />
                                  <Text style={{ 
                                fontSize: 14, 
                                color: '#333',
                                    fontFamily: 'Onest',
                                    fontWeight: '500'
                                  }}>
                                {editedSelectedCategory.name}
                          </Text>
                                </>
                              ) : (
                                <Text style={{ 
                              fontSize: 14, 
                              color: '#999',
                                  fontFamily: 'Onest',
                                  fontWeight: '500'
                                }}>
                              Choose category
                                </Text>
                              )}
                        </View>
                        <Ionicons name="chevron-down" size={12} color="#999" />
                            </View>
                          ) : (
                            <View style={{ 
                              flexDirection: 'row', 
                              flexWrap: 'wrap', 
                        justifyContent: 'flex-start',
                        gap: 6,
                            }}>
                            {categories.map((cat, idx) => (
                                <Pressable
                                key={idx}
                                onPress={() => {
                              setEditedSelectedCategory(cat);
                                  setShowCategoryPicker(false);
                                    setShowAddCategoryForm(false);
                                  }}
                                onLongPress={() => handleCategoryLongPress(cat)}
                                  style={({ pressed }) => ({
                              backgroundColor: editedSelectedCategory?.name === cat.name ? cat.color + '20' : '#f8f9fa',
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              borderRadius: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                              gap: 4,
                                  })}
                                >
                                  <View style={{ 
                                    width: 6, 
                                    height: 6, 
                                    borderRadius: 3, 
                                    backgroundColor: cat.color,
                                  }} />
                                  <Text style={{ 
                              color: '#333', 
                                    fontSize: 12, 
                                    fontFamily: 'Onest',
                              fontWeight: editedSelectedCategory?.name === cat.name ? '600' : '500',
                                  }}>
                                    {cat.name}
                                  </Text>
                                </Pressable>
                            ))}
                            <TouchableOpacity
                              onPress={() => setShowAddCategoryForm(true)}
                              style={{
                            backgroundColor: '#f8f9fa',
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                            gap: 4,
                              }}
                            >
                          <Ionicons name="add" size={12} color="#666" />
                            </TouchableOpacity>
                      </View>
                    )}

                              {showAddCategoryForm && (
                                <View style={{
                        backgroundColor: '#f8f9fa',
                        padding: 12,
                        borderRadius: 8,
                                  marginTop: 8,
                                }}>
                                  <Text style={{
                          fontSize: 14,
                          color: '#333',
                                    fontFamily: 'Onest',
                          fontWeight: '600',
                                    marginBottom: 8,
                                  }}>
                                    New Category
                                  </Text>
                                  <TextInput
                                    style={{
                                      backgroundColor: 'white',
                            padding: 8,
                            borderRadius: 6,
                            marginBottom: 8,
                            fontSize: 14,
                                      fontFamily: 'Onest',
                            borderWidth: 1,
                            borderColor: '#e0e0e0',
                                    }}
                                    placeholder="Category name"
                                    value={newCategoryName}
                                    onChangeText={setNewCategoryName}
                                  />
                                  
                        {/* Color Picker */}
                                  <Text style={{
                          fontSize: 12,
                          color: '#666',
                                      fontFamily: 'Onest',
                          fontWeight: '500',
                          marginBottom: 6,
                                    }}>
                                    Color
                                  </Text>
                                    <View style={{
                                      flexDirection: 'row',
                                      flexWrap: 'wrap',
                            gap: 6,
                                      marginBottom: 12,
                                    }}>
                                      {CATEGORY_COLORS.map((color) => (
                                        <TouchableOpacity
                                          key={color}
                                          onPress={() => setNewCategoryColor(color)}
                                          style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: 12,
                                            backgroundColor: color,
                                borderWidth: newCategoryColor === color ? 2 : 0,
                                borderColor: '#333',
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              {newCategoryColor === color && (
                                <Ionicons name="checkmark" size={12} color="white" />
                                          )}
                                        </TouchableOpacity>
                                      ))}
                                    </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
                                      <TouchableOpacity
                                        onPress={() => {
                                          setShowAddCategoryForm(false);
                                          setNewCategoryName('');
                              setNewCategoryColor(null);
                                        }}
                                        style={{
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 6,
                                        }}
                                      >
                                        <Text style={{
                                          color: '#666',
                                fontSize: 14,
                                          fontFamily: 'Onest',
                                fontWeight: '500',
                                        }}>
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
                                              console.error('Error creating category:', error);
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
                                              setNewCategoryColor(null);
                                            }
                                          }
                                        }}
                                        style={{
                              backgroundColor: '#007AFF',
                                          paddingVertical: 6,
                                          paddingHorizontal: 12,
                              borderRadius: 6,
                                        }}
                                      >
                                        <Text style={{
                                          color: 'white',
                                fontSize: 14,
                                          fontFamily: 'Onest',
                                          fontWeight: '600',
                                        }}>
                                          Add
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                              </View>
                            )}
                        </TouchableOpacity>
                      </View>

                {/* Options Card */}
                <View style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 18,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}>
                  
                  <View style={{ gap: 8 }}>
                    {/* Reminder */}
                    <View>
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}>
                        <Text style={{ 
                          fontSize: 14, 
                          color: '#333', 
                          fontFamily: 'Onest',
                          fontWeight: '500'
                        }}>
                          Reminder
                        </Text>
                        <TouchableOpacity
                          onPress={() => setShowReminderOptions(prev => !prev)}
                          style={{
                            backgroundColor: '#f8f9fa',
                            borderRadius: 8,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderWidth: 1,
                            borderColor: showReminderOptions ? '#007AFF' : '#f0f0f0',
                          }}
                        >
                          <Text style={{
                            fontSize: 14,
                            color: '#333',
                            fontFamily: 'Onest',
                            fontWeight: '500'
                          }}>
                            {editedReminderTime ? editedReminderTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : 'No reminder'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {showReminderOptions && (
                        <View style={{
                          backgroundColor: '#f8f9fa',
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          marginTop: 8,
                          borderWidth: 1,
                          borderColor: '#e0e0e0',
                          maxHeight: 170,
                        }}>
                          <ScrollView 
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingVertical: 2 }}
                          >
                            {REMINDER_OPTIONS.map(opt => (
                              <TouchableOpacity
                                key={opt.value}
                          onPress={() => {
                                  if (opt.value === -1) {
                                    setEditedReminderTime(null);
                                  } else {
                                    const reminderDate = new Date(editedStartDateTime);
                                    reminderDate.setMinutes(reminderDate.getMinutes() - opt.value);
                                    setEditedReminderTime(reminderDate);
                                  }
                                  setShowReminderOptions(false);
                                }}
                                style={{
                                  paddingVertical: 10,
                                  paddingHorizontal: 6,
                                  borderRadius: 4,
                                  backgroundColor: (editedReminderTime && opt.value !== -1) ? '#007AFF20' : 'transparent',
                                  marginBottom: 1,
                                }}
                              >
                                <Text style={{
                                  fontSize: 14,
                                  color: '#333',
                                  fontFamily: 'Onest',
                                  fontWeight: (editedReminderTime && opt.value !== -1) ? '600' : '500',
                                }}>{opt.label}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    {/* Repeat */}
                    <View>
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}>
                        <Text style={{ 
                          fontSize: 14, 
                          color: '#333', 
                          fontFamily: 'Onest',
                          fontWeight: '500'
                        }}>
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
                          style={{
                            backgroundColor: '#f8f9fa',
                            borderRadius: 8,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderWidth: 1,
                            borderColor: showRepeatPicker ? '#007AFF' : '#f0f0f0',
                          }}
                        >
                            <Text style={{ 
                            fontSize: 14,
                            color: '#333',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                            {editedRepeatOption === 'None' ? 'Does not repeat' : editedRepeatOption}
                            </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* End Date (if repeating) */}
                    {editedRepeatOption !== 'None' && (
                      <View>
                        <View style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          marginBottom: 4,
                        }}>
                          <Text style={{ 
                            fontSize: 14, 
                            color: '#333', 
                            fontFamily: 'Onest',
                            fontWeight: '500'
                          }}>
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
                            style={{
                              backgroundColor: '#f8f9fa',
                              borderRadius: 8,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderWidth: 1,
                              borderColor: showEndDatePicker ? '#007AFF' : '#f0f0f0',
                            }}
                          >
                            <Text style={{
                              fontSize: 14,
                              color: '#333',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
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
                    <View style={{ 
                      backgroundColor: '#f8f9fa',
                      borderRadius: 8,
                      padding: 6,
                      marginTop: 8,
                      borderWidth: 1,
                      borderColor: '#e0e0e0',
                    }}>
                      {['Does not repeat', 'Daily', 'Weekly', 'Monthly', 'Yearly'].map((option) => (
                      <TouchableOpacity
                          key={option}
                          onPress={() => {
                            setEditedRepeatOption(option === 'Does not repeat' ? 'None' : option as RepeatOption);
                            debouncePickerClose('repeat');
                          }}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 6,
                            backgroundColor: (option === 'Does not repeat' ? editedRepeatOption === 'None' : editedRepeatOption === option) ? '#007AFF20' : 'transparent',
                            marginBottom: 2,
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
                      </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {showEndDatePicker && (
                    <View style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: 8,
                      paddingHorizontal: 6,
                      marginTop: 8,
                    }}>
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
                        console.error('Error deleting event:', error);
                        Alert.alert('Error', 'Failed to delete event. Please try again.');
                      }
                    }
                  }}
                  style={{
                    backgroundColor: '#FF6B6B',
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    marginTop: 20,
                  }}
                >
                  <Text style={{
                    color: 'white',
                    fontSize: 16,
                    fontFamily: 'Onest',
                    fontWeight: '600',
                  }}>
                    Delete Event
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>
      </>
    );
  };
  
  export default CalendarScreen;
