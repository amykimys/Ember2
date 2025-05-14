import React, { useState, useRef, useEffect } from 'react';
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
  Switch
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


interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  startDateTime?: Date;
  endDateTime?: Date;
  categoryName?: string;
  categoryColor?: string;
  reminderTime?: Date | null;
  repeatOption?: 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom';
  repeatEndDate?: Date | null;
  customDates?: string[];
  isContinued?: boolean;
  isAllDay?: boolean;
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
const getCellHeight = (date: Date | null) => {
  if (!date) return BASE_CELL_HEIGHT;

  return needsSixRows(date.getFullYear(), date.getMonth())
    ? BASE_CELL_HEIGHT - 25  // Shrink more for 6-row months to add more spacing
    : BASE_CELL_HEIGHT;
};


const NUM_COLUMNS = 7;
const NUM_ROWS = 5;

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const generateMonthKey = (year: number, month: number) => `${year}-${month}`;

const styles = StyleSheet.create({

  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 0,
    marginBottom: 0,
    color: '#333',
    fontFamily: 'Onest',
  },
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: 'white',
    marginTop: -8,
    paddingVertical: 2,
  },
  weekday: {
    width: CELL_WIDTH,
    textAlign: 'center',
    color: '#333',
    paddingBottom: 7,
    fontSize: 12,
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
    rowGap: 35,
  },
  cell: {
    width: CELL_WIDTH,
    paddingTop: 6,
    paddingLeft: 2,
    paddingRight: 2,
    borderColor: '#eee',
    backgroundColor: 'white',
    overflow: 'visible',
    zIndex: 0,
  },
  cellExpanded: {
    height: getCellHeight(new Date()) + 8, // Reduced padding
  },
  cellCompact: {
    height: getCellHeight(new Date()) * 0.65,
    marginBottom: 4, // Add margin between rows for 6-row months
  },
  
  dateNumber: {
    fontSize: 14,
    color: '#333',
    marginLeft: 0.5,
    height: 24,
    lineHeight: 24,
    fontFamily: 'Onest',
  },
  adjacentMonthDate: {
    color: '#ccc',  // Light gray color for adjacent month dates
  },
  todayCell: {
    backgroundColor: 'transparent',
  },
  selectedCell: {
    borderColor: '#BF9264',
    borderWidth: 0,
  },
  selectedText: {
    fontWeight: 'bold',
    color: '#BF9264',
  },
  todayText: {
    fontWeight: '500',
    color: '#fff',
    backgroundColor: '#A0C3B2',
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
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
    marginBottom: 24,
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
    fontSize: 10,
    color: '#333',
    marginTop: 2,
    paddingRight: 2,
    fontFamily: 'Onest',
  },
  inputTitle: {
    fontSize: 16,
    padding: 12,
    marginBottom: 16,
    fontFamily: 'Onest',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  inputDescription: {
    fontSize: 14,
    padding: 12,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
    fontFamily: 'Onest',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  quickActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  inlineSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  inlineSettingText: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#3a3a3a',
    fontFamily: 'Onest',
  },
  inlineSettingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    fontFamily: 'Onest',
  },
  inlineSettingRowDate: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  inlineSettingTextDate: {
    fontSize: 14,
    marginLeft: 8,
    color: '#666',
    fontFamily: 'Onest',
  },
  gridCompact: {
    height: getCellHeight(new Date()) * 2 + 160, // Adjusted for better fit
    overflow: 'hidden',
  }, 
  dateTimePickerContainer: {
    height: 100, // Reduced height to cut off more
    overflow: 'hidden',
    marginTop: 15,
  },
  dateTimePicker: {
    marginTop: -55, // Increased negative margin to cut off more of the top
    transform: [{ scale: 0.8 }], // This will make everything smaller including text
  },
  eventContainer: {
    position: 'absolute',
    left: 2,
    right: 2,
    zIndex: 1000,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  monthButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#A0C3B2',
    alignItems: 'center',
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Onest',
  },
  viewToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  viewToggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fafafa',
    alignItems: 'center',
  },
  viewToggleText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Onest',
  },
  categoryPickerButton: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 15,
  },
  categoryPickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  categoryOption: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 9,
    marginBottom: 4,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 12,
    color: '#3a3a3a',
    fontFamily: 'Onest',
    fontWeight: '500',
  },
  addCategoryButton: {
    backgroundColor: '#fafafa',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 9,
    borderWidth: 0,
    borderColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allDayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  allDayText: {
    fontSize: 13,
    color: '#3a3a3a',
    fontFamily: 'Onest',
    marginRight: 20,
  },
  dateTimeContainer: {
    marginBottom: 20,
  },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateTimeColumn: {
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 13,
    color: '#3a3a3a',
    fontFamily: 'Onest',
    marginBottom: 6,
  },
  dateTimeButton: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dateTimeText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Onest',
  },
  pickerContainer: {
    marginTop: 12,
  },
  reminderRepeatContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reminderRepeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  reminderRepeatColumn: {
    flex: 1,
  },
  reminderRepeatLabel: {
    fontSize: 13,
    color: '#3a3a3a',
    fontFamily: 'Onest',
    marginBottom: 6,
  },
  reminderRepeatButton: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reminderRepeatText: {
    fontSize: 13,
    color: '#3a3a3a',
    fontFamily: 'Onest',
    fontWeight: '500',
  },
  timePicker: {
    height: 180,
    width: '100%',
  },
  repeatPickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  repeatOption: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  repeatOptionText: {
    fontSize: 13,
    color: '#3a3a3a',
    fontFamily: 'Onest',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#FF9A8B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    width: '48%',
    marginRight: 4,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Onest',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#A0C3B2',
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
});

// Add this array of predefined colors near the top of the file, after the imports
const CATEGORY_COLORS = [
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
];

const CalendarScreen: React.FC = () => {
  const today = new Date();
  const currentMonthIndex = 12; // center month in 25-month buffer
  const flatListRef = useRef<FlatList>(null);
  const weeklyCalendarRef = useRef<WeeklyCalendarViewRef>(null);
  const monthFlatListRef = useRef<FlatList>(null);

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
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newEventText, setNewEventText] = useState('');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [showDateSettings, setShowDateSettings] = useState(false);
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#FADADD'); // Default color
  const [categories, setCategories] = useState<{ id: string; name: string; color: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string; color: string } | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false); // When you tap folder
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false); // When you tap plus
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [reminderPickerHeight] = useState(new Animated.Value(0));
  const [repeatOption, setRepeatOption] = useState<RepeatOption>('None');
  const [repeatEndDate, setRepeatEndDate] = useState<Date | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [endTime, setEndTime] = useState<Date>(new Date());
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
  const [userChangedEditedEndTime, setUserChangedEditedEndTime] = useState(false);
  const [showCustomDatesPicker, setShowCustomDatesPicker] = useState(false);
  const [customSelectedDates, setCustomSelectedDates] = useState<string[]>([]);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [customDateTimes, setCustomDateTimes] = useState<{ 
    [date: string]: { 
      start: Date; 
      end: Date; 
      reminder: Date | null;
      repeat: RepeatOption;
    } 
  }>({});
  const getLocalDateString = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  // Title & Description
  const [editedEventTitle, setEditedEventTitle] = useState('');
  const [editedEventDescription, setEditedEventDescription] = useState('');
  // Start & End
  const [editedStartDateTime, setEditedStartDateTime] = useState(new Date());
  const [editedEndDateTime, setEditedEndDateTime] = useState(new Date());
  // Category
  const [editedSelectedCategory, setEditedSelectedCategory] = useState<{ name: string; color: string; id?: string } | null>(null);
  // Reminder
  const [editedReminderTime, setEditedReminderTime] = useState<Date | null>(null);
  // Repeat
  const [editedRepeatOption, setEditedRepeatOption] = useState<'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom'>('None');
  const [editedRepeatEndDate, setEditedRepeatEndDate] = useState<Date | null>(null);


  const [calendarMode, setCalendarMode] = useState<'month' | 'week'>('month');
  const [isMonthCompact, setIsMonthCompact] = useState(false);

  const [selectedDateForCustomTime, setSelectedDateForCustomTime] = useState<string | null>(null);
  const [customStartTime, setCustomStartTime] = useState<Date>(new Date());
  const [customEndTime, setCustomEndTime] = useState<Date>(new Date(new Date().getTime() + 60 * 60 * 1000));
  const [showCustomStartPicker, setShowCustomStartPicker] = useState(false);
  const [showCustomEndPicker, setShowCustomEndPicker] = useState(false);

  const reminderSwipeableRef = useRef<Swipeable>(null);
  const repeatSwipeableRef = useRef<Swipeable>(null);
  const endDateSwipeableRef = useRef<Swipeable>(null);

  // Add new state variables near the other state declarations
  const [showCustomTimeModal, setShowCustomTimeModal] = useState(false);
  const [customTimeDate, setCustomTimeDate] = useState<string | null>(null);
  const [customTimeStart, setCustomTimeStart] = useState<Date>(new Date());
  const [customTimeEnd, setCustomTimeEnd] = useState<Date>(new Date(new Date().getTime() + 60 * 60 * 1000));
  const [customTimeReminder, setCustomTimeReminder] = useState<Date | null>(null);
  const [customTimeRepeat, setCustomTimeRepeat] = useState<RepeatOption>('None');
  const [showCustomTimeStartPicker, setShowCustomTimeStartPicker] = useState(false);
  const [showCustomTimeEndPicker, setShowCustomTimeEndPicker] = useState(false);
  const [showCustomTimeReminderPicker, setShowCustomTimeReminderPicker] = useState(false);
  const [showCustomTimeRepeatPicker, setShowCustomTimeRepeatPicker] = useState(false);
  const [showCustomTimeInline, setShowCustomTimeInline] = useState(false);

  const [visibleWeekMonth, setVisibleWeekMonth] = useState<Date>(new Date());
  const [visibleWeekMonthText, setVisibleWeekMonthText] = useState('');

  const [isAllDay, setIsAllDay] = useState(false);
  // Add state for editedIsAllDay for the edit modal
  const [isEditedAllDay, setIsEditedAllDay] = useState(false);
  const [valueChanged, setValueChanged] = useState(false);
  const autoCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
      }
    };
  }, []);





  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error fetching user:', error);
      } else {
        setUser(data.user);
      }
    };
  
    fetchUser();
  }, []);
  

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*');
  
      if (error) {
        console.error('Error fetching events:', error);
      } else if (data) {
        const eventsMap: { [date: string]: CalendarEvent[] } = {};
  
        data.forEach((event) => {
          const start = new Date(event.start_datetime);
          const end = new Date(event.end_datetime);
        
          // If it's a custom repeat event, only create events on the custom dates
          if (event.repeat_option === 'Custom' && event.custom_dates && event.custom_dates.length > 0) {
            event.custom_dates.forEach((dateStr: string) => {
              if (!eventsMap[dateStr]) eventsMap[dateStr] = [];
              
              eventsMap[dateStr].push({
                id: event.id,
                title: event.title,              
                description: event.description,
                date: dateStr,
                startDateTime: start,
                endDateTime: end,
                categoryName: event.category_name,
                categoryColor: event.category_color,
                reminderTime: event.reminder_time,
                repeatOption: event.repeat_option,
                repeatEndDate: event.repeat_end_date,
                customDates: event.custom_dates,
                isContinued: false,
                isAllDay: event.is_all_day,
              });
            });
          } else {
            // For non-custom events, create events across the date range
            let currentDate = new Date(start);
            let isFirstDay = true;
        
            while (currentDate <= end) {
              const dateKey = getLocalDateString(currentDate);
        
              if (!eventsMap[dateKey]) eventsMap[dateKey] = [];
        
              eventsMap[dateKey].push({
                id: event.id,
                title: event.title,              
                description: event.description,
                date: dateKey,
                startDateTime: start,
                endDateTime: end,
                categoryName: event.category_name,
                categoryColor: event.category_color,
                reminderTime: event.reminder_time,
                repeatOption: event.repeat_option,
                repeatEndDate: event.repeat_end_date,
                customDates: event.custom_dates,
                isContinued: !isFirstDay,
                isAllDay: event.is_all_day,
              });
        
              isFirstDay = false;
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }
        });
        setEvents(eventsMap);
      }
    };
    fetchEvents();
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user?.id);
  
      if (error) {
        console.error('Failed to fetch categories:', error);
        return;
      }
  
      if (data) {
        const fetchedCategories = data.map((cat) => ({
          id: cat.id,
          name: cat.label,
          color: cat.color,
        }));
        setCategories(fetchedCategories);
      }
    };
  
    if (user?.id) {
      fetchCategories();
    }
  }, [user]);
  

  const findMonthIndex = (targetDate: Date) => {
    return months.findIndex((m) => {
      return m.year === targetDate.getFullYear() && m.month === targetDate.getMonth();
    });
  };
  
  
  const saveEventToSupabase = async (newEvent: CalendarEvent) => {
    if (!newEvent.startDateTime || !newEvent.endDateTime) {
      console.error('Start or End date missing');
      return;
    }
  
    const { data, error } = await supabase
  .from('events')
  .insert([
    {
      title: newEvent.title,
      description: newEvent.description,
      date: newEvent.date,
      start_datetime: newEvent.startDateTime?.toISOString(),
      end_datetime: newEvent.endDateTime?.toISOString(),
      category_name: newEvent.categoryName,
      category_color: newEvent.categoryColor,
      reminder_time: newEvent.reminderTime?.toISOString(),
      repeat_option: newEvent.repeatOption,
      repeat_end_date: newEvent.repeatEndDate?.toISOString(),
      custom_dates: newEvent.customDates,
      user_id: user?.id,
      is_all_day: newEvent.isAllDay,
    }
  ])
  .select()
  .returns<CalendarEvent[]>(); // ✅
    if (error) {
      console.error('Error saving event:', error);
    } else {
      console.log('Event saved successfully');
    }
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

  const collapseAllPickers = () => {
    setShowStartPicker(false);
    setShowEndPicker(false);
    setShowReminderPicker(false);
    setShowRepeatPicker(false);
    setShowEndDatePicker(false);
    setShowCategoryPicker(false);
    setShowAddCategoryForm(false);
  };

  
  const handleDeleteEvent = async (dateKey: string, eventIndex: number) => {
    const eventToDelete = events[dateKey][eventIndex];
  
    if (!eventToDelete?.id) {
      console.error('No event id found!');
      return;
    }
  
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventToDelete.id);
  
    if (error) {
      console.error('Failed to delete event from Supabase:', error);
      return;
    }
  
    const updatedEvents = { ...events };
    updatedEvents[dateKey].splice(eventIndex, 1);
  
    if (updatedEvents[dateKey].length === 0) {
      delete updatedEvents[dateKey];
    }
  
    setEvents(updatedEvents);
  };


  const resetEventForm = () => {
    setNewEventTitle('');
    setNewEventDescription('');
    setSelectedCategory(null);
    setStartDateTime(new Date());
    setEndDateTime(new Date(new Date().getTime() + 60 * 60 * 1000)); // +1 hour later
    setReminderTime(null);
    setRepeatOption('None');
    setRepeatEndDate(null);
    setCustomSelectedDates([]);
    setCustomDateTimes({}); // Reset custom times
    setSelectedDateForCustomTime(null); // Reset selected date for custom time
    setCustomStartTime(new Date()); // Reset custom start time
    setCustomEndTime(new Date(new Date().getTime() + 60 * 60 * 1000)); // Reset custom end time
    setUserChangedEndTime(false);
    setIsAllDay(false);
    resetToggleStates(); // Add this line
  };

  const handleSaveEvent = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to create events.');
      return;
    }

    if (!newEventTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for the event.');
      return;
    }

    if (!startDateTime || !endDateTime) {
      Alert.alert('Error', 'Please set start and end times for the event.');
      return;
    }

    setIsSaving(true);

    try {
      const { data, error } = await supabase
        .from('events')
        .insert([
          {
            title: newEventTitle,
            description: newEventDescription,
            date: getLocalDateString(startDateTime),
            start_datetime: startDateTime.toISOString(),
            end_datetime: endDateTime.toISOString(),
            category_name: selectedCategory?.name || 'No Category',
            category_color: selectedCategory?.color || '#FF9A8B',
            reminder_time: reminderTime ? reminderTime.toISOString() : null,
            repeat_option: repeatOption || 'None',
            repeat_end_date: repeatEndDate ? repeatEndDate.toISOString() : null,
            custom_dates: repeatOption === 'Custom' ? customSelectedDates : null,
            user_id: user.id,
            is_all_day: isAllDay,
          },
        ])
        .select();

      if (error) {
        console.error('Error saving event:', error);
        Alert.alert('Error', error.message || 'Failed to save event. Please try again.');
        setIsSaving(false);
        return;
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned from save operation');
      }

      console.log('Event saved successfully:', data);

      // Update local state
      const updatedEvents = { ...events };
      const eventId = data[0].id;

      if (repeatOption === 'Custom' && customSelectedDates.length > 0) {
        // For custom repeat, only create events on selected dates
        customSelectedDates.forEach(dateStr => {
          if (!updatedEvents[dateStr]) updatedEvents[dateStr] = [];

          updatedEvents[dateStr].push({
            id: eventId,
            title: newEventTitle,
            description: newEventDescription,
            date: dateStr,
            startDateTime: startDateTime,
            endDateTime: endDateTime,
            categoryName: selectedCategory?.name,
            categoryColor: selectedCategory?.color,
            reminderTime,
            repeatOption,
            repeatEndDate,
            customDates: customSelectedDates,
            isContinued: false,
            isAllDay: isAllDay,
          });
        });
      } else {
        // For other repeat options, create events across the date range
        let currentDate = new Date(startDateTime);
        while (currentDate <= endDateTime) {
          const dateKey = getLocalDateString(currentDate);

          if (!updatedEvents[dateKey]) updatedEvents[dateKey] = [];

          updatedEvents[dateKey].push({
            id: eventId,
            title: newEventTitle,
            description: newEventDescription,
            date: dateKey,
            startDateTime: startDateTime,
            endDateTime: endDateTime,
            categoryName: selectedCategory?.name,
            categoryColor: selectedCategory?.color,
            reminderTime,
            repeatOption,
            repeatEndDate,
            customDates: customSelectedDates,
            isContinued: currentDate.toDateString() !== startDateTime.toDateString(),
            isAllDay: isAllDay,
          });

          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      setEvents(updatedEvents);
      resetEventForm();
      setShowModal(false);

      Toast.show({
        type: 'success',
        text1: 'Event created successfully',
        position: 'bottom',
      });
    } catch (err) {
      console.error('Error in handleSaveEvent:', err);
      Alert.alert('Error', 'Failed to save event. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  
  const renderMonth = ({ item }: { item: ReturnType<typeof getMonthData> }) => {
    const { year, month, days } = item;
    const monthDate = new Date(year, month);
    const label = monthDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });

    const needsSixRowsThisMonth = item.days.length > 35;

    // Helper function to check if a date belongs to the current month
    const isCurrentMonth = (date: Date) => {
      return date.getMonth() === month && date.getFullYear() === year;
    };

    return (
      <View style={{ width: SCREEN_WIDTH, flex: 1, paddingTop: 0, backgroundColor: 'white' }}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginBottom: 55, 
          paddingHorizontal: 18,
          marginLeft: 50,
          position: 'relative'
        }}>
          <TouchableOpacity
            onPress={() => setCalendarMode('week')}
            style={{ position: 'absolute', left: -25, top:0, paddingVertical: 6, paddingHorizontal: 0}}
          >
            <MaterialIcons 
              name="calendar-view-week"
              size={20} 
              color="#333"
            />
          </TouchableOpacity>

          {/* Month Text - Absolute and centered */}
          <TouchableOpacity
            onPress={() => {
              if (calendarMode === 'month') {
                // In month view, scroll to current month
                const today = new Date();
                const monthIndex = months.findIndex(m => 
                  m.year === today.getFullYear() && m.month === today.getMonth()
                );
                if (monthIndex !== -1) {
                  flatListRef.current?.scrollToIndex({
                    index: monthIndex,
                    animated: true
                  });
                }
              } else {
                // In week view, scroll to current week
                const today = new Date();
                setSelectedDate(today);
                setVisibleWeekMonth(today);
                weeklyCalendarRef.current?.scrollToWeek?.(today);
              }
            }}
            style={{
              position: 'absolute',
              left: '50%',
              transform: [{ translateX: -50 }],
              top: 0,
              padding: 8,
            }}
          >
            <Text style={[styles.monthLabel, { marginBottom: 0 }]}>{label}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              resetEventForm();
              setShowModal(true);
            }}
            style={{  position: 'absolute',
              right: 0,
              paddingVertical: 0,
              paddingHorizontal: 0 }}
          >
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: SIDE_PADDING }}>
          <View style={styles.weekRow}>
            {weekdays.map((day, idx) => (
              <Text key={idx} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>

          <View style={[
            needsSixRowsThisMonth ? styles.gridSixRows : styles.grid,
            isMonthCompact && styles.gridCompact
          ]}>
            {days.map((date, i) => {
              const dateKey = date ? getLocalDateString(date) : '';
              const dayEvents = date ? (events[dateKey] || []) as CalendarEvent[] : [];
              const hasEvents = dayEvents.length > 0;

              return (
              <View
                key={i}
                style={[
                  styles.cell,
                  needsSixRows(item.year, item.month) ? styles.cellCompact : styles.cellExpanded,
                  isSelected(date) && styles.selectedCell,
                  isToday(date) && styles.todayCell,
                ]}
              >
                {date && (
                  <TouchableOpacity
                    onPress={() => {
                      if (date) {
                        setSelectedDate(date);
                          resetEventForm();
                          setStartDateTime(date);
                          setEndDateTime(new Date(date.getTime() + 60 * 60 * 1000)); // Set end time to 1 hour later
                          setShowModal(true);
                        }
                      }}
                      style={{ flex: 1 }}
                    >
                      <View style={{ flex: 1 }}>
                        {/* Date Section - Fixed Height */}
                        <View style={{ 
                          height: 24,
                      alignItems: 'center', 
                      justifyContent: 'center', 
                        }}>
                          <View style={{ 
                            height: 25,
                            width: 25,
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: isSelected(date) ? '#A0C3B2' : (isToday(date) ? '#FAF9F6' : 'transparent'),
                            borderRadius: 12.5,
                            marginVertical: 2
                          }}>
                            <Text style={{ 
                              fontSize: 15,
                              color: isSelected(date) ? '#FFFFFF' : (isToday(date) ? '#A0C3B2' : (isCurrentMonth(date) ? '#3A3A3A' : '#CCCCCC')),
                              fontWeight: isSelected(date) || isToday(date) ? '400' : '400',
                              fontFamily: 'Onest',
                              textAlign: 'center'
                            }}>
                              {date ? date.getDate() : ''}
                            </Text>
                          </View>
                        </View>

                        {/* Events Section - Below Date */}
                        {hasEvents && (
                          <View style={{ 
                            flexDirection: 'column', 
                            justifyContent: 'flex-start', 
                            alignItems: 'center',
                            marginTop: 2,
                            width: '100%',
                            paddingHorizontal: 2,
                            minHeight: 0,
                            flex: 1,
                            gap: 2
                          }}>
                            {dayEvents.slice(0, 3).map((event, eventIndex) => (
                              <TouchableOpacity
                                key={`${event.id}-${eventIndex}`}
                                onLongPress={() => {
                                  setSelectedEvent({ event, dateKey: event.date, index: eventIndex });
                                  setEditedEventTitle(event.title);
                                  setEditedEventDescription(event.description ?? '');
                                  setEditedStartDateTime(new Date(event.startDateTime!));
                                  setEditedEndDateTime(new Date(event.endDateTime!));
                                  setEditedSelectedCategory(event.categoryName ? { name: event.categoryName, color: event.categoryColor! } : null);
                                  setEditedReminderTime(event.reminderTime ? new Date(event.reminderTime) : null);
                                  setEditedRepeatOption(event.repeatOption || 'None');
                                  setEditedRepeatEndDate(event.repeatEndDate ? new Date(event.repeatEndDate) : null);
                                  setCustomSelectedDates(event.customDates || []);
                                  setIsEditedAllDay(event.isAllDay || false);
                                  resetToggleStates(); // Add this line
                                  if (event.repeatOption === 'Custom') {
                                    setIsEditingEvent(true);
                                    setShowCustomDatesPicker(true);
                                  } else {
                                    setShowEditEventModal(true);
                                  }
                                }}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  width: '100%',
                                  backgroundColor: `${event.categoryColor || '#FF9A8B'}20`,
                                  borderRadius: 4,
                                  paddingVertical: 2,
                                  paddingHorizontal: 4,
                                }}
                              >
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    fontSize: 11,
                                    color: '#3A3A3A',
                                    flex: 1,
                                    fontFamily: 'Onest',
                                    textAlign: 'center'
                                  }}
                                >
                                  {event.title}
                    </Text>
                  </TouchableOpacity>
                            ))}
                            {dayEvents.length > 3 && (
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  width: '90%',
                                  backgroundColor: '#F5F5F5',
                                  borderRadius: 4,
                                  paddingVertical: 2,
                                  paddingHorizontal: 4,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    color: '#999',
                                    fontFamily: 'Onest',
                                    textAlign: 'left'
                                  }}
                                >
                                  +{dayEvents.length - 3} more
                                </Text>
                              </View>
                              )}
                            </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
        {calendarMode === 'month' ? (
          <View style={{ flex: 1, flexDirection: 'column' }}>
            <View style={{ flex: isMonthCompact ? 0.9 : 1 }}>
              <FlatList
                ref={flatListRef}
                data={months}
                keyExtractor={(item) => item.key}
                horizontal
                pagingEnabled
                initialScrollIndex={currentMonthIndex}
                contentContainerStyle={{ flexGrow: 1 }}
                renderItem={renderMonth}
                getItemLayout={(_, index) => ({
                  length: SCREEN_WIDTH,
                  offset: SCREEN_WIDTH * index,
                  index,
                })}
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1}}
              />
            </View>

            {isMonthCompact && (
              <View style={{ flex: 0.5, backgroundColor: 'white', marginTop: -38 }}>
                <ScrollView
                  style={{ paddingHorizontal: 16, paddingTop: 0 }}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  showsVerticalScrollIndicator={false}
                >
                  {events[getLocalDateString(selectedDate)]?.length ? (
                    events[getLocalDateString(selectedDate)]?.map((event, index) => (
                      <TouchableOpacity
                        key={index}
                        style={{
                          backgroundColor: event.categoryColor || '#eee',
                          padding: 14,
                          borderRadius: 12,
                          marginBottom: 10,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          elevation: 3,
                        }}
                        onPress={() => {
                          setSelectedEvent({ event, dateKey: event.date, index });
                          setEditedEventTitle(event.title);
                          setEditedEventDescription(event.description ?? '');
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
                      >
                        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 6, color: '#333' }}>
                          {event.title}
                        </Text>
                        {event.description && (
                          <Text style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                            {event.description}
                          </Text>
                        )}
                        <Text style={{ fontSize: 10, color: '#999' }}>
                          {new Date(event.startDateTime!).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {' '}–{' '}
                          {new Date(event.endDateTime!).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={{ textAlign: 'center', color: '#aaa', marginTop: 20 }}>No events for this day</Text>
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        ) : (
          <View style={{ width: SCREEN_WIDTH, flex: 1, paddingTop: 0, backgroundColor: 'white' }}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginBottom: 0, 
          paddingHorizontal: 18,
          marginLeft: 50,
          position: 'relative'
        }}>
          <TouchableOpacity
            onPress={() => setCalendarMode('month')}
            style={{ position: 'absolute', left: -25, top:0, paddingVertical: 6, paddingHorizontal: 0}}
          >
                
                <MaterialIcons 
                  name="calendar-view-month"
                  size={20} 
                  color="#333"
                />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <TouchableOpacity 
                  onPress={() => {
                    const today = new Date();
                    setSelectedDate(today);
                    setVisibleWeekMonth(today);
                    weeklyCalendarRef.current?.scrollToWeek?.(today);
                  }}
                  style={{ paddingVertical: 8 }}
                >
                  <Text style={[styles.monthLabel, { marginBottom: 0, textTransform: 'capitalize', marginLeft: -5 }]}> 
                    {visibleWeekMonthText}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ width: 40 }}>
                <Text style={{ color: 'transparent' }}>Spacer</Text>
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

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              resetEventForm();
              setShowModal(true);
            }}
          >
            <MaterialIcons name="add" size={22} color="#3a3a3a" style={{ marginLeft: -4, marginTop: 6 }} />
          </TouchableOpacity>
      </SafeAreaView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={showModal}
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <ScrollView
                  style={{ flexGrow: 0 }}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, marginTop: -8, marginRight: -8 }}>
                  <Text style={styles.modalTitle}>Add Event</Text>
                    <TouchableOpacity 
                      onPress={() => setShowModal(false)}
                      style={{ padding: 12, marginTop: -8, marginRight: -8 }}
                    >
                      <Ionicons name="close" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity 
                    onPress={() => {
                      if (repeatOption === 'Custom') {
                        setRepeatOption('None');
                      } else {
                        setRepeatOption('Custom');
                      }
                    }}
                  >
                    <Text style={[styles.modalSubtitle, { color: '#888888' }]}>
                      {repeatOption === 'Custom' ? 'Custom Dates' : startDateTime.toDateString()}
                    </Text>
                  </TouchableOpacity>

                  {repeatOption !== 'Custom' ? (
                    <>
                      <TextInput
                        style={styles.inputTitle}
                        placeholder="Title"
                        value={newEventTitle}
                        onChangeText={setNewEventTitle}
                      />
  
                      <TextInput
                        style={styles.inputDescription}
                        placeholder="Description (optional)"
                        value={newEventDescription}
                        onChangeText={setNewEventDescription}
                        multiline
                      />

                        {/* Category Selection */}
                        <View style={{ marginBottom: 12 }}>
                          <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>Category</Text>
                          <TouchableOpacity
                            onPress={() => {
                              setShowCategoryPicker(prev => !prev);
                              if (showCategoryPicker) {
                                setShowAddCategoryForm(false);
                                setNewCategoryName('');
                                setNewCategoryColor('#FADADD');
                              }
                            }}
                            style={{
                              backgroundColor: '#fafafa',
                              borderRadius: 12,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              marginTop: 2,
                              alignItems: 'center',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.05,
                              shadowRadius: 2,
                              elevation: 1,
                              marginBottom: 15,
                            }}
                          >
                            {!showCategoryPicker ? (
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
                                    fontSize: 13, 
                                    color: '#3a3a3a',
                                    fontFamily: 'Onest',
                                    fontWeight: '500'
                                  }}>
                                    {selectedCategory.name}
                                  </Text>
                                </>
                              ) : (
                                <Text style={{ 
                                  fontSize: 13, 
                                  color: '#3a3a3a',
                                  fontFamily: 'Onest',
                                  fontWeight: '500'
                                }}>
                                  Set Category
                                </Text>
                              )}
                            </View>
                            ) : (
                              <View style={{ 
                              flexDirection: 'row', 
                              flexWrap: 'wrap', 
                                justifyContent: 'center',
                                gap: 8,
                                width: '100%',
                            }}>
                              {categories.map((cat, idx) => (
                                  <Pressable
                                  key={idx}
                                  onPress={() => {
                                    setSelectedCategory(cat);
                                    setShowCategoryPicker(false);
                                    setShowAddCategoryForm(false);
                                  }}
                                    style={({ pressed }) => ({
                                      backgroundColor: '#fafafa',
                                      paddingVertical: 5,
                                      paddingHorizontal: 8,
                                      borderRadius: 9,
                                      borderWidth: (pressed || selectedCategory?.name === cat.name) ? 1 : 0,
                                      borderColor: cat.color,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 6,
                                    })}
                                  >
                                    <View style={{ 
                                      width: 6, 
                                      height: 6, 
                                      borderRadius: 3, 
                                      backgroundColor: cat.color,
                                    }} />
                                    <Text style={{ 
                                      color: '#3a3a3a', 
                                      fontSize: 12, 
                                      fontFamily: 'Onest',
                                      fontWeight: selectedCategory?.name === cat.name ? '600' : '500'
                                    }}>
                                      {cat.name}
                                    </Text>
                                  </Pressable>
                              ))}
                              <TouchableOpacity
                                onPress={() => setShowAddCategoryForm(true)}
                                style={{
                                    backgroundColor: '#fafafa',
                                  paddingVertical: 5,
                                    paddingHorizontal: 8,
                                    borderRadius: 9,
                                    borderWidth: 0,
                                    borderColor: '#eee',
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                    gap: 6,
                                }}
                              >
                                  <Ionicons name="add" size={14} color="#666" />
                              </TouchableOpacity>

                                {showAddCategoryForm && (
                                  <View style={{
                                    backgroundColor: '#fafafa',
                                    padding: 2,
                                    borderRadius: 12,
                                    marginTop: 8,
                                    width: '100%',
                                  }}>
                                    <Text style={{
                                      fontSize: 13,
                                      color: '#3a3a3a',
                                      fontFamily: 'Onest',
                                      marginBottom: 8,
                                    }}>
                                      New Category
                                    </Text>
                                    <TextInput
                                      style={{
                                        backgroundColor: 'white',
                                        padding: 10,
                                        borderRadius: 8,
                                        marginBottom: 12,
                                        fontSize: 13,
                                        marginTop: 4,
                                        fontFamily: 'Onest',
                                      }}
                                      placeholder="Category name"
                                      value={newCategoryName}
                                      onChangeText={setNewCategoryName}
                                    />
                                    
                                    {/* Add Color Picker */}
                                    <Text style={{
                                      fontSize: 13,
                                      color: '#3a3a3a',
                                      fontFamily: 'Onest',
                                      marginBottom: 8,
                                    }}>
                                      Color
                                    </Text>
                                    <View style={{
                                      flexDirection: 'row',
                                      flexWrap: 'wrap',
                                      gap: 8,
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
                                            opacity: newCategoryColor === color ? 1 : 0,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 1,
                                            elevation: 2,
                                          }}
                                        />
                                      ))}
                                    </View>

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <TouchableOpacity
                                        onPress={() => {
                                          setShowAddCategoryForm(false);
                                          setNewCategoryName('');
                                          setNewCategoryColor('#FADADD'); // Reset to default color
                                        }}
                                        style={{
                                          paddingVertical: 8,
                                          paddingHorizontal: 6,
                                        }}
                                      >
                                        <Text style={{
                                          color: '#666',
                                          fontSize: 12,
                                          fontFamily: 'Onest',
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
                                              setNewCategoryColor('#FADADD'); // Reset to default color
                                            }
                                          }
                                        }}
                                        style={{
                                          backgroundColor: '#FF9A8B',
                                          paddingVertical: 6,
                                          paddingHorizontal: 12,
                                          borderRadius: 8,
                                        }}
                                      >
                                        <Text style={{
                                          color: 'white',
                                          fontSize: 12,
                                          fontFamily: 'Onest',
                                          fontWeight: '600',
                                        }}>
                                          Add
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                )}
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
  <Text style={{ fontSize: 13, color: '#3a3a3a', fontFamily: 'Onest', marginRight: 20 }}>All-day event</Text>
  <View style={{ transform: [{ scale: 0.75 }] }}>
    <Switch value={isAllDay} onValueChange={setIsAllDay} />
  </View>
</View>
                      
                      {/* 🕓 Starts & Ends in one row */}
                      <View style={{ flex: 1, marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                          <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>Start</Text>
                            <TouchableOpacity
                              onPress={() => {
                                // Toggle start picker
                                setShowStartPicker(prev => !prev);
                                // Close end picker if it's open
                                if (showEndPicker) setShowEndPicker(false);
                                // Auto close after 2 seconds if opening
                                if (!showStartPicker) {
                                  setTimeout(() => {
                                    setShowStartPicker(false);
                                  }, 3000);
                                }
                              }}
                              style={{
                                backgroundColor: '#fafafa',
                                borderRadius: 12,
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                marginTop: 2,
                                alignItems: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.05,
                                shadowRadius: 2,
                                elevation: 1,
                              }}
                            >
                              <Text style={{
                                fontSize: 13,
                                color: '#3a3a3a',
                                fontFamily: 'Onest',
                                fontWeight: '500'
                              }}>
                                {startDateTime.toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  ...(isAllDay ? {} : { hour: 'numeric', minute: '2-digit', hour12: true })
                                }).replace(',', ' ·')}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>End</Text>
                            <TouchableOpacity
                              onPress={() => {
                                // Toggle end picker
                                setShowEndPicker(prev => !prev);
                                // Close start picker if it's open
                                if (showStartPicker) setShowStartPicker(false);
                                // Auto close after 2 seconds if opening
                                if (!showEndPicker) {
                                  setTimeout(() => {
                                    setShowEndPicker(false);
                                  }, 3000);
                                }
                              }}
                              style={{
                                backgroundColor: '#fafafa',
                                borderRadius: 12,
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                marginTop: 2,
                                alignItems: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.05,
                                shadowRadius: 2,
                                elevation: 1,
                              }}
                            >
                              <Text style={{
                                fontSize: 13,
                                color: '#3a3a3a',
                                fontFamily: 'Onest',
                                fontWeight: '500'
                              }}>
                                {endDateTime.toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  ...(isAllDay ? {} : { hour: 'numeric', minute: '2-digit', hour12: true })
                                }).replace(',', ' ·')}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Date/Time Picker */}
                        {(showStartPicker || showEndPicker) && (
                          <Animated.View style={[styles.dateTimePickerContainer, {
                            backgroundColor: '#fafafa',
                            borderRadius: 16,
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            marginTop: 1,
                            marginBottom: 4,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.03,
                            shadowRadius: 3,
                            elevation: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }]}>
                            <DateTimePicker
                              value={showStartPicker ? startDateTime : endDateTime}
                              mode={isAllDay ? "date" : "datetime"}
                              display="spinner"
                              onChange={(event, selectedTime) => {
                                if (selectedTime) {
                                  const newDate = new Date(selectedTime);
                                  if (isAllDay) {
                                    newDate.setHours(showStartPicker ? 0 : 23, showStartPicker ? 0 : 59, showStartPicker ? 0 : 59, 0);
                                  }
                                  if (showStartPicker) {
                                    setStartDateTime(newDate);
                                    if (!userChangedEndTime) {
                                      const autoEnd = new Date(newDate);
                                      autoEnd.setHours(isAllDay ? 23 : newDate.getHours() + 1, isAllDay ? 59 : newDate.getMinutes());
                                      setEndDateTime(autoEnd);
                                    }
                                  } else {
                                    setEndDateTime(newDate);
                                    setUserChangedEndTime(true);
                                  }
                                }
                              }}
                              style={{ height: isAllDay ? 180 : 240, width: '100%' }}
                              textColor="#333"
                            />
                          </Animated.View>
                        )}
                      </View>

                      {/* 🕑 Set Reminder, Repeat, and End Date in one row */}
                      <View style={{ flex: 1, marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                          <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>Reminder</Text>
                            <TouchableOpacity
                              onPress={() => {
                                // Toggle reminder picker
                                setShowReminderPicker(prev => !prev);
                                // Close other pickers if they're open
                                if (showRepeatPicker) setShowRepeatPicker(false);
                                if (showEndDatePicker) setShowEndDatePicker(false);
                              }}
                              style={{
                                backgroundColor: '#fafafa',
                                borderRadius: 12,
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                marginTop: 2,
                                alignItems: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.05,
                                shadowRadius: 2,
                                elevation: 1,
                              }}
                            >
                              <Text style={{ 
                                fontSize: 13, 
                                color: '#3a3a3a',
                                fontFamily: 'Onest',
                                fontWeight: '500'
                              }}>
                                {reminderTime ? reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No Reminder'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <View style={{ flex: 1, marginRight: repeatOption !== 'None' ? 12 : 0 }}>
                            <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>Repeat</Text>
                            <TouchableOpacity
                              onPress={() => {
                                // Toggle repeat picker
                                setShowRepeatPicker(prev => !prev);
                                // Close other pickers if they're open
                                if (showReminderPicker) setShowReminderPicker(false);
                                if (showEndDatePicker) setShowEndDatePicker(false);
                              }}
                              style={{
                                backgroundColor: '#fafafa',
                                borderRadius: 12,
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                marginTop: 2,
                                alignItems: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.05,
                                shadowRadius: 2,
                                elevation: 1,
                              }}
                            >
                              <Text style={{ 
                                fontSize: 13, 
                                color: '#3a3a3a',
                                fontFamily: 'Onest',
                                fontWeight: '500'
                              }}>
                                {repeatOption === 'None' ? 'Do Not Repeat' : repeatOption}
                              </Text>
                            </TouchableOpacity>
                          </View>
                          {repeatOption !== 'None' && (
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>End Date</Text>
                              <TouchableOpacity
                                onPress={() => {
                                  // Toggle end date picker
                                  setShowEndDatePicker(prev => !prev);
                                  // Close other pickers if they're open
                                  if (showReminderPicker) setShowReminderPicker(false);
                                  if (showRepeatPicker) setShowRepeatPicker(false);
                                  // Auto close after 2 seconds if opening
                                  if (!showEndDatePicker) {
                                    setTimeout(() => {
                                      setShowEndDatePicker(false);
                                    }, 3000);
                                  }
                                }}
                                style={{
                                  backgroundColor: '#fafafa',
                                  borderRadius: 12,
                                  paddingVertical: 10,
                                  paddingHorizontal: 12,
                                  marginTop: 2,
                                  alignItems: 'center',
                                  shadowColor: '#000',
                                  shadowOffset: { width: 0, height: 1 },
                                  shadowOpacity: 0.05,
                                  shadowRadius: 2,
                                  elevation: 1,
                                }}
                              >
                                <Text style={{ 
                                  fontSize: 13, 
                                  color: '#3a3a3a',
                                  fontFamily: 'Onest',
                                  fontWeight: '500'
                                }}>
                                  {repeatEndDate ? repeatEndDate.toLocaleDateString([], { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: '2-digit' 
                                  }) : 'Set End Date'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        {showReminderPicker && (
                          <Animated.View style={[styles.dateTimePickerContainer, {
                            backgroundColor: '#fafafa',
                            borderRadius: 16,
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            marginTop: 12,
                            marginBottom: 4,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.03,
                            shadowRadius: 3,
                            elevation: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }]}>
                            <DateTimePicker
                              value={reminderTime || new Date()}
                              mode="time"
                              display="spinner"
                              onChange={(event, selectedTime) => {
                                if (selectedTime) {
                                  setReminderTime(selectedTime);
                                  setShowReminderPicker(false); // Close picker after selection
                                }
                              }}
                              style={{ height: 180, width: '100%' }}
                              textColor="#333"
                            />
                          </Animated.View>
                        )}

                        {showEndDatePicker && (
                          <Animated.View style={[styles.dateTimePickerContainer, {
                            backgroundColor: '#fafafa',
                            borderRadius: 16,
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            marginTop: 12,
                            marginBottom: 4,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.03,
                            shadowRadius: 3,
                            elevation: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }]}>
                            <DateTimePicker
                              value={repeatEndDate || new Date()}
                              mode="date"
                              display="spinner"
                              onChange={(event, selectedDate) => {
                                if (selectedDate) {
                                  setRepeatEndDate(selectedDate);
                                  setShowEndDatePicker(false); // Close picker after selection
                                }
                              }}
                              style={{ height: 180, width: '100%' }}
                              textColor="#333"
                            />
                          </Animated.View>
                        )}

                        {showRepeatPicker && (
                          <Animated.View style={{ 
                            backgroundColor: '#fafafa',
                            borderRadius: 12,
                            padding: 12,
                            marginTop: 12,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 2,
                            elevation: 1,
                          }}>
                            {['Do Not Repeat', 'Daily', 'Weekly', 'Monthly', 'Yearly', 'Custom'].map((option) => (
                              <TouchableOpacity 
                                key={option}
                                onPress={() => {
                                  setRepeatOption(option === 'Do Not Repeat' ? 'None' : option as RepeatOption);
                                  setShowRepeatPicker(false); // Close picker after selection
                                }}
                                style={{
                                  paddingVertical: 10,
                                  paddingHorizontal: 8,
                                  borderRadius: 8,
                                  backgroundColor: (option === 'Do Not Repeat' ? repeatOption === 'None' : repeatOption === option) ? '#f0f0f0' : 'transparent',
                                }}
                              >
                                <Text style={{ 
                                  fontSize: 13, 
                                  color: '#3a3a3a',
                                  fontFamily: 'Onest',
                                  fontWeight: (option === 'Do Not Repeat' ? repeatOption === 'None' : repeatOption === option) ? '600' : '400'
                                }}>
                                  {option}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </Animated.View>
                        )}
                      </View>
                    </>
                  ) : (
                    <>
                      {/* Title */}
                      <TextInput
                        style={styles.inputTitle}
                        placeholder="Title"
                        value={newEventTitle}
                        onChangeText={setNewEventTitle}
                      />

                      <TextInput
                        style={styles.inputDescription}
                        placeholder="Description (optional)"
                        value={newEventDescription}
                        onChangeText={setNewEventDescription}
                        multiline
                      />

                      {/* Category Selection - MATCHES set-date modal */}
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>Category</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setShowCategoryPicker(prev => !prev);
                            if (showCategoryPicker) {
                              setShowAddCategoryForm(false);
                              setNewCategoryName('');
                              setNewCategoryColor('#FADADD');
                            }
                          }}
                          style={{
                            backgroundColor: '#fafafa',
                            borderRadius: 12,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            marginTop: 2,
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 2,
                            elevation: 1,
                            marginBottom: 15,
                          }}
                        >
                          {!showCategoryPicker ? (
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
                                    fontSize: 13, 
                                    color: '#3a3a3a',
                                    fontFamily: 'Onest',
                                    fontWeight: '500'
                                  }}>
                                    {selectedCategory.name}
                          </Text>
                                </>
                              ) : (
                                <Text style={{ 
                                  fontSize: 13, 
                                  color: '#3a3a3a',
                                  fontFamily: 'Onest',
                                  fontWeight: '500'
                                }}>
                                  Set Category
                                </Text>
                              )}
                            </View>
                          ) : (
                            <View style={{ 
                              flexDirection: 'row', 
                              flexWrap: 'wrap', 
                              justifyContent: 'center',
                              gap: 8,
                              width: '100%',
                            }}>
                            {categories.map((cat, idx) => (
                                <Pressable
                                key={idx}
                                onPress={() => {
                                    setSelectedCategory(cat);
                                  setShowCategoryPicker(false);
                                    setShowAddCategoryForm(false);
                                  }}
                                  style={({ pressed }) => ({
                                    backgroundColor: '#fafafa',
                                    paddingVertical: 5,
                                    paddingHorizontal: 8,
                                    borderRadius: 9,
                                    borderWidth: (pressed || selectedCategory?.name === cat.name) ? 1 : 0,
                                    borderColor: cat.color,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                  })}
                                >
                                  <View style={{ 
                                    width: 6, 
                                    height: 6, 
                                    borderRadius: 3, 
                                    backgroundColor: cat.color,
                                  }} />
                                  <Text style={{ 
                                    color: '#3a3a3a', 
                                    fontSize: 12, 
                                    fontFamily: 'Onest',
                                    fontWeight: selectedCategory?.name === cat.name ? '600' : '500'
                                  }}>
                                    {cat.name}
                                  </Text>
                                </Pressable>
                            ))}
                            <TouchableOpacity
                              onPress={() => setShowAddCategoryForm(true)}
                              style={{
                                  backgroundColor: '#fafafa',
                                paddingVertical: 5,
                                  paddingHorizontal: 8,
                                  borderRadius: 9,
                                  borderWidth: 0,
                                  borderColor: '#eee',
                                flexDirection: 'row',
                                alignItems: 'center',
                                  gap: 6,
                              }}
                            >
                                <Ionicons name="add" size={14} color="#666" />
                            </TouchableOpacity>

                              {showAddCategoryForm && (
                                <View style={{
                                  backgroundColor: '#fafafa',
                                  padding: 2,
                                  borderRadius: 12,
                                  marginTop: 8,
                                  width: '100%',
                                }}>
                                  <Text style={{
                                    fontSize: 13,
                                    color: '#3a3a3a',
                                    fontFamily: 'Onest',
                                    marginBottom: 8,
                                  }}>
                                    New Category
                                  </Text>
                                  <TextInput
                                    style={{
                                      backgroundColor: 'white',
                                      padding: 10,
                                      borderRadius: 8,
                                      marginBottom: 12,
                                      fontSize: 13,
                                      marginTop: 4,
                                      fontFamily: 'Onest',
                                    }}
                                    placeholder="Category name"
                                    value={newCategoryName}
                                    onChangeText={setNewCategoryName}
                                  />
                                  
                                  {/* Add Color Picker */}
                                  <Text style={{
                                    fontSize: 13,
                                    color: '#3a3a3a',
                                    fontFamily: 'Onest',
                                    marginBottom: 8,
                                  }}>
                                    Color
                                  </Text>
                                  <View style={{
                                    flexDirection: 'row',
                                    flexWrap: 'wrap',
                                    gap: 8,
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
                                          opacity: newCategoryColor === color ? 1 : 0,
                                          shadowColor: '#000',
                                          shadowOffset: { width: 0, height: 1 },
                                          shadowOpacity: 0.2,
                                          shadowRadius: 1,
                                          elevation: 2,
                                        }}
                                      />
                                    ))}
                                  </View>

                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <TouchableOpacity
                                      onPress={() => {
                                        setShowAddCategoryForm(false);
                                        setNewCategoryName('');
                                        setNewCategoryColor('#FADADD'); // Reset to default color
                                      }}
                                      style={{
                                        paddingVertical: 8,
                                        paddingHorizontal: 6,
                                      }}
                                    >
                                      <Text style={{
                                        color: '#666',
                                        fontSize: 12,
                                        fontFamily: 'Onest',
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
                                            setNewCategoryColor('#FADADD'); // Reset to default color
                                          }
                                        }
                                      }}
                                      style={{
                                        backgroundColor: '#FF9A8B',
                                        paddingVertical: 6,
                                        paddingHorizontal: 12,
                                        borderRadius: 8,
                                      }}
                                    >
                                      <Text style={{
                                        color: 'white',
                                        fontSize: 12,
                                        fontFamily: 'Onest',
                                        fontWeight: '600',
                                      }}>
                                        Add
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              )}
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* 📅 Pick Dates */}
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>Custom Dates</Text>
                        <TouchableOpacity
                          onPress={() => {
                            // First set the custom dates picker to true
                            setShowCustomDatesPicker(true);
                            // Then close the add event modal
                            setShowModal(false);
                          }}
                          style={{
                            backgroundColor: '#fafafa',
                            borderRadius: 12,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            marginTop: 2,
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 2,
                            elevation: 1,
                            marginBottom: 15,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ 
                              fontSize: 13, 
                              color: '#3a3a3a',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                              {customSelectedDates.length > 0 
                                ? customSelectedDates
                                    .map(date => new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' }))
                                    .join(', ')
                                : 'Select Dates'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  <View style={[styles.modalActions, { justifyContent: 'center' }]}>
                    <TouchableOpacity
                     onPress={handleSaveEvent}
                     style={{
                       backgroundColor: '#FF9A8B',
                       paddingVertical: 12,
                       paddingHorizontal: 24,
                       borderRadius: 12,
                       alignItems: 'center',
                       width: '100%',
                     }}
                    >
                      <Text style={{ 
                        color: 'white', 
                        fontSize: 16, 
                        fontFamily: 'Onest',
                        fontWeight: '600' 
                      }}>
                        Save
                      </Text>
                    </TouchableOpacity>
                  </View>
                  </ScrollView>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>


        <Modal
          visible={showCustomDatesPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCustomDatesPicker(false)}
        >
          <View style={{
              flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'flex-end',
          }}>
            <View style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              height: '90%', // Changed from maxHeight to fixed height
              flexDirection: 'column', // Added to ensure proper flex layout
            }}>
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#f0f0f0',
                backgroundColor: '#fff', // Added to ensure header stays visible
                zIndex: 1, // Added to keep header above scroll content
              }}>
                <Text style={{ 
                  fontSize: 20, 
                  fontWeight: '600', 
                  color: '#333',
                  fontFamily: 'Onest'
                }}>
                  Select Custom Dates
                </Text>
                <TouchableOpacity 
                  onPress={() => setShowCustomDatesPicker(false)}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={{ flex: 1 }}
                contentContainerStyle={{ 
                  paddingHorizontal: 20,
                  paddingBottom: Platform.OS === 'ios' ? 40 : 20,
                  flexGrow: 1,
                }}
                showsVerticalScrollIndicator={true}
              >
                <Text style={{ 
                  fontSize: 14, 
                  color: '#666', 
                  marginBottom: 16,
                  marginTop: 16,
                  fontFamily: 'Onest',
                }}>
                  Tap dates to select or deselect them. Long press a date to set custom times.
                </Text>

              <RNCalendar
                onDayPress={(day: DateData) => {
                    console.log('Day pressed:', day.dateString);
                  const dateStr = day.dateString;
                  setCustomSelectedDates((prev) =>
                    prev.includes(dateStr)
                      ? prev.filter((d) => d !== dateStr)
                      : [...prev, dateStr]
                  );
                }}
                onDayLongPress={(day: DateData) => {
                    console.log('Long press detected on:', day.dateString);
                  const dateStr = day.dateString;
                    setCustomTimeDate(dateStr);
                    const existingTimes = customDateTimes[dateStr];
                    setCustomTimeStart(existingTimes?.start || startDateTime);
                    setCustomTimeEnd(existingTimes?.end || endDateTime);
                    setCustomTimeReminder(existingTimes?.reminder || null);
                    setCustomTimeRepeat(existingTimes?.repeat || 'None');
                    setShowCustomTimeInline(true);
                }}
                markedDates={Object.fromEntries(
                  customSelectedDates.map((date) => [
                    date,
                    { 
                      selected: true,
                        selectedColor: '#A0C3B2',
                        selectedTextColor: '#fff',
                        dotColor: '#A0C3B2',
                        marked: customDateTimes[date] !== undefined,
                    },
                  ])
                )}
                style={{
                  width: '100%',
                      marginBottom: 20,
                }}
                theme={{
                  'stylesheet.calendar.header': {
                    header: {
                      flexDirection: 'row',
                          justifyContent: 'space-between',
                      alignItems: 'center',
                          paddingHorizontal: 8,
                          paddingVertical: 12,
                    },
                    monthText: {
                      fontSize: 16,
                      fontWeight: '600',
                          color: '#333',
                          fontFamily: 'Onest',
                        },
                        dayHeader: {
                          color: '#666',
                          fontSize: 12,
                          fontFamily: 'Onest',
                          fontWeight: '500',
                          textAlign: 'center',
                          width: 32,
                    },
                    arrow: {
                          padding: 12,
                    },
                    arrowImage: {
                          tintColor: '#A0C3B2',
                    },
                  },
                      todayTextColor: '#A0C3B2',
                  todayBackgroundColor: 'transparent',
                  'stylesheet.day.basic': {
                    base: {
                      width: 32,
                      height: 32,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    text: {
                      fontSize: 14,
                      color: '#333',
                          fontFamily: 'Onest',
                      textAlign: 'center',
                    },
                    selected: {
                          backgroundColor: '#A0C3B2',
                      borderRadius: 16,
                    },
                    selectedText: {
                      color: '#fff',
                      fontWeight: '600',
                      },
                        today: {
                          borderWidth: 1,
                          bacgroundColor: '#A0C3B2',
                          borderRadius: 16,
                    },
                  },
                  'stylesheet.calendar.main': {
                    dayContainer: {
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      },
                        week: {
                          marginTop: 4,
                          marginBottom: 4,
                          flexDirection: 'row',
                          justifyContent: 'space-around',
                    },
                  },
                }}
                  enableSwipeMonths={true}
                  minDate={new Date().toISOString().split('T')[0]}
                  hideExtraDays={false}
                  disableAllTouchEventsForDisabledDays={true}
                />

                {/* Selected Dates Summary - Always visible */}
                <View style={{ 
                  backgroundColor: '#fafafa',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 20
                }}>
                  <Text style={{ 
                    fontSize: 14, 
                    fontWeight: '600', 
                    color: '#333',
                    marginBottom: 8,
                    fontFamily: 'Onest'
                  }}>
                    Selected Dates ({customSelectedDates.length})
                  </Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={{ flexDirection: 'row' }}
                  >
                    {customSelectedDates.map((date, index) => (
                      <View 
                        key={date}
                        style={{
                          backgroundColor: '#A0C3B2',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 16,
                          marginRight: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ 
                          color: '#fff',
                          fontSize: 13,
                          fontFamily: 'Onest',
                          marginRight: 4
                        }}>
                          {new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </Text>
                    <TouchableOpacity
                          onPress={() => {
                            setCustomSelectedDates(prev => prev.filter(d => d !== date));
                            // Also remove any custom times for this date
                            setCustomDateTimes(prev => {
                              const newTimes = { ...prev };
                              delete newTimes[date];
                              return newTimes;
                            });
                          }}
                        >
                          <Ionicons name="close-circle" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {customSelectedDates.length === 0 && (
                      <Text style={{ 
                        fontSize: 13,
                        color: '#999',
                        fontFamily: 'Onest',
                        fontStyle: 'italic'
                      }}>
                        No dates selected yet
                      </Text>
                    )}
                  </ScrollView>

                  {/* Default Event Time - Always visible */}
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ 
                      fontSize: 14, 
                      fontWeight: '600', 
                      color: '#333',
                      marginBottom: 12,
                      fontFamily: 'Onest'
                    }}>
                      Default Event Time
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: '#666', marginBottom: 6, fontFamily: 'Onest' }}>Start</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setShowStartPicker(true);
                            setShowEndPicker(false);
                          }}
                      style={{
                            backgroundColor: '#fff',
                        borderRadius: 8,
                            padding: 12,
                            alignItems: 'center',
                            borderWidth: 0,
                            borderColor: '#eee'
                          }}
                        >
                          <Text style={{ fontSize: 14, color: '#333', fontFamily: 'Onest' }}>
                        {startDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: '#666', marginBottom: 6, fontFamily: 'Onest' }}>End</Text>
                    <TouchableOpacity
                          onPress={() => {
                            setShowEndPicker(true);
                            setShowStartPicker(false);
                          }}
                      style={{
                            backgroundColor: '#fff',
                        borderRadius: 8,
                            padding: 12,
                            alignItems: 'center',
                            borderWidth: 0,
                            borderColor: '#eee'
                          }}
                        >
                          <Text style={{ fontSize: 14, color: '#333', fontFamily: 'Onest' }}>
                        {endDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                    {/* Time Picker Container */}
                    {(showStartPicker || showEndPicker) && (
                      <Animated.View style={[styles.dateTimePickerContainer, {
                        backgroundColor: '#fafafa',
                        borderRadius: 16,
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        marginTop: 1,
                        marginBottom: 4,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.03,
                        shadowRadius: 3,
                        elevation: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }]}>
                    <DateTimePicker
                          value={showStartPicker ? startDateTime : endDateTime}
                      mode={isAllDay ? "date" : "datetime"}
                      display="spinner"
                      onChange={(event, selectedTime) => {
                        if (selectedTime) {
                              if (showStartPicker) {
                          // If it's an all-day event, set the time to start of day (00:00)
                          const newDate = new Date(selectedTime);
                          if (isAllDay) {
                            newDate.setHours(0, 0, 0, 0);
                          }
                          setStartDateTime(newDate);
                                if (!userChangedEndTime) {
                                  // If it's an all-day event, set end to end of day (23:59)
                                  const endDate = new Date(newDate);
                                  if (isAllDay) {
                                    endDate.setHours(23, 59, 59, 999);
                                  } else {
                                    endDate.setTime(newDate.getTime() + 60 * 60 * 1000);
                                  }
                                  setEndDateTime(endDate);
                                }
                                setTimeout(() => {
                                  setShowStartPicker(false);
                                }, 3000);
                              } else {
                                // If it's an all-day event, set the time to end of day (23:59)
                                const newDate = new Date(selectedTime);
                                if (isAllDay) {
                                  newDate.setHours(23, 59, 59, 999);
                                }
                                setEndDateTime(newDate);
                                setUserChangedEndTime(true);
                                setTimeout(() => {
                                  setShowEndPicker(false);
                                }, 3000);
                              }
                            }
                          }}
                          style={{ height: isAllDay ? 180 : 240, width: '100%' }}
                          textColor="#333"
                    />
                  </Animated.View>
                )}

                    {/* Reminder & Repeat Section */}
                    <View style={{ marginTop: 16 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, color: '#666', marginBottom: 6, fontFamily: 'Onest' }}>Reminder</Text>
                          <TouchableOpacity
                            onPress={() => {
                              // Toggle reminder picker
                              setShowReminderPicker(prev => !prev);
                              // Close other pickers if they're open
                              if (showRepeatPicker) setShowRepeatPicker(false);
                              if (showEndDatePicker) setShowEndDatePicker(false);
                            }}
                            style={{
                              backgroundColor: '#fafafa',
                              borderRadius: 12,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              marginTop: 2,
                              alignItems: 'center',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.05,
                              shadowRadius: 2,
                              elevation: 1,
                            }}
                          >
                            <Text style={{ 
                              fontSize: 13, 
                              color: '#3a3a3a',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                              {reminderTime ? reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No Reminder'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1, marginRight: repeatOption !== 'None' ? 12 : 0 }}>
                          <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>Repeat</Text>
                          <TouchableOpacity
                            onPress={() => {
                              // Toggle repeat picker
                              setShowRepeatPicker(prev => !prev);
                              // Close other pickers if they're open
                              if (showReminderPicker) setShowReminderPicker(false);
                              if (showEndDatePicker) setShowEndDatePicker(false);
                            }}
                            style={{
                              backgroundColor: '#fafafa',
                              borderRadius: 12,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              marginTop: 2,
                              alignItems: 'center',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.05,
                              shadowRadius: 2,
                              elevation: 1,
                            }}
                          >
                            <Text style={{ 
                              fontSize: 13, 
                              color: '#3a3a3a',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                              {repeatOption === 'None' ? 'Do Not Repeat' : repeatOption}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {repeatOption !== 'None' && (
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>End Date</Text>
                            <TouchableOpacity
                              onPress={() => {
                                // Toggle end date picker
                                setShowEndDatePicker(prev => !prev);
                                // Close other pickers if they're open
                                if (showReminderPicker) setShowReminderPicker(false);
                                if (showRepeatPicker) setShowRepeatPicker(false);
                                // Auto close after 2 seconds if opening
                                if (!showEndDatePicker) {
                                  setTimeout(() => {
                                    setShowEndDatePicker(false);
                                  }, 3000);
                                }
                              }}
                              style={{
                                backgroundColor: '#fafafa',
                                borderRadius: 12,
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                marginTop: 2,
                                alignItems: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.05,
                                shadowRadius: 2,
                                elevation: 1,
                              }}
                            >
                              <Text style={{ 
                                fontSize: 13, 
                                color: '#3a3a3a',
                                fontFamily: 'Onest',
                                fontWeight: '500'
                              }}>
                                {repeatEndDate ? repeatEndDate.toLocaleDateString([], { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: '2-digit' 
                                }) : 'Set End Date'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      {showReminderPicker && (
                        <Animated.View style={[styles.dateTimePickerContainer, {
                          backgroundColor: '#fafafa',
                          borderRadius: 16,
                          paddingVertical: 8,
                          paddingHorizontal: 16,
                          marginTop: 12,
                          marginBottom: 4,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.03,
                          shadowRadius: 3,
                          elevation: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }]}>
                          <DateTimePicker
                            value={reminderTime || new Date()}
                            mode="time"
                            display="spinner"
                            onChange={(event, selectedTime) => {
                              if (selectedTime) {
                                setReminderTime(selectedTime);
                                setShowReminderPicker(false); // Close picker after selection
                              }
                            }}
                            style={{ height: 180, width: '100%' }}
                            textColor="#333"
                          />
                        </Animated.View>
                      )}

                      {showEndDatePicker && (
                        <Animated.View style={[styles.dateTimePickerContainer, {
                          backgroundColor: '#fafafa',
                          borderRadius: 16,
                          paddingVertical: 8,
                          paddingHorizontal: 16,
                          marginTop: 12,
                          marginBottom: 4,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.03,
                          shadowRadius: 3,
                          elevation: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }]}>
                          <DateTimePicker
                            value={repeatEndDate || new Date()}
                            mode="date"
                            display="spinner"
                            onChange={(event, selectedDate) => {
                              if (selectedDate) {
                                setRepeatEndDate(selectedDate);
                                setShowEndDatePicker(false); // Close picker after selection
                              }
                            }}
                            style={{ height: 180, width: '100%' }}
                            textColor="#333"
                          />
                        </Animated.View>
                      )}

                      {showRepeatPicker && (
                        <Animated.View style={{ 
                          backgroundColor: '#fafafa',
                          borderRadius: 12,
                          padding: 12,
                          marginTop: 12,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.05,
                          shadowRadius: 2,
                          elevation: 1,
                        }}>
                          {['Do Not Repeat', 'Daily', 'Weekly', 'Monthly', 'Yearly', 'Custom'].map((option) => (
                            <TouchableOpacity 
                              key={option}
                              onPress={() => {
                                setRepeatOption(option === 'Do Not Repeat' ? 'None' : option as RepeatOption);
                                setShowRepeatPicker(false); // Close picker after selection
                              }}
                              style={{
                                paddingVertical: 10,
                                paddingHorizontal: 8,
                                borderRadius: 8,
                                backgroundColor: (option === 'Do Not Repeat' ? repeatOption === 'None' : repeatOption === option) ? '#f0f0f0' : 'transparent',
                              }}
                            >
                              <Text style={{ 
                                fontSize: 13, 
                                color: '#3a3a3a',
                                fontFamily: 'Onest',
                                fontWeight: (option === 'Do Not Repeat' ? repeatOption === 'None' : repeatOption === option) ? '600' : '400'
                              }}>
                                {option}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </Animated.View>
                      )}
                    </View>
                  </View>
                </View>

                    <TouchableOpacity 
                      onPress={() => {
                    setShowCustomDatesPicker(false);
                    if (isEditingEvent) {
                      if (selectedEvent) {
                        const updateEvent = async () => {
                          try {
                            const { error } = await supabase
                              .from('events')
                              .update({
                                title: editedEventTitle,
                                description: editedEventDescription,
                                start_datetime: editedStartDateTime.toISOString(),
                                end_datetime: editedEndDateTime.toISOString(),
                                category_name: editedSelectedCategory?.name || 'No Category',
                                category_color: editedSelectedCategory?.color || '#FF9A8B',
                                reminder_time: editedReminderTime ? editedReminderTime.toISOString() : null,
                                repeat_option: editedRepeatOption,
                                repeat_end_date: editedRepeatEndDate ? editedRepeatEndDate.toISOString() : null,
                                custom_dates: customSelectedDates,
                                is_all_day: isEditedAllDay,
                              })
                              .eq('id', selectedEvent.event.id);

                            if (error) {
                              console.error('Error updating event:', error);
                              Alert.alert('Error', 'Failed to update event.');
                              return;
                            }

                            // Update local state
                            const updatedEvents = { ...events };
                            
                            // Remove the old event from all dates
                            Object.keys(updatedEvents).forEach(dateKey => {
                              updatedEvents[dateKey] = updatedEvents[dateKey].filter(
                                event => event.id !== selectedEvent.event.id
                              );
                              if (updatedEvents[dateKey].length === 0) {
                                delete updatedEvents[dateKey];
                              }
                            });

                            // Add the updated event to the custom dates
                            customSelectedDates.forEach(dateStr => {
                              if (!updatedEvents[dateStr]) updatedEvents[dateStr] = [];
                              updatedEvents[dateStr].push({
                                id: selectedEvent.event.id,
                                title: editedEventTitle,
                                description: editedEventDescription,
                                date: dateStr,
                                startDateTime: editedStartDateTime,
                                endDateTime: editedEndDateTime,
                                categoryName: editedSelectedCategory?.name,
                                categoryColor: editedSelectedCategory?.color,
                                reminderTime: editedReminderTime,
                                repeatOption: editedRepeatOption,
                                repeatEndDate: editedRepeatEndDate,
                                customDates: customSelectedDates,
                                isContinued: false,
                                isAllDay: isEditedAllDay,
                              });
                            });

                            setEvents(updatedEvents);
                            setIsEditingEvent(false);
                            
                            Toast.show({
                              type: 'success',
                              text1: 'Event updated successfully',
                              position: 'bottom',
                            });
                          } catch (err) {
                            console.error('Error updating event:', err);
                            Alert.alert('Error', 'Failed to update event. Please try again.');
                          }
                        };
                        updateEvent();
                      }
                    } else {
                      setShowModal(true);
                    }
                      }}
                      style={{
                    backgroundColor: '#A0C3B2',
                    padding: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                    marginTop: 8,
                  }}
                >
                  <Text style={{ 
                    color: '#fff', 
                    fontSize: 16,
                    fontWeight: '600',
                    fontFamily: 'Onest'
                  }}>
                    Done
                    </Text>
                    </TouchableOpacity>
              </ScrollView>
                  </View>
          </View>
        </Modal>
        <Modal
          visible={showCustomTimeModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCustomTimeModal(false)}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}>
            <View style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              maxHeight: '80%',
              position: 'relative', // Add this
              marginTop: 'auto', // Add this
            }}>
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#f0f0f0',
                paddingBottom: 12,
              }}>
                <Text style={{ 
                  fontSize: 20, 
                  fontWeight: '600', 
                  color: '#333',
                  fontFamily: 'Onest'
                }}>
                  Set Custom Time
                </Text>
                      <TouchableOpacity
                  onPress={() => setShowCustomTimeModal(false)}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {customTimeDate && (
                <Text style={{ 
                  fontSize: 14, 
                  color: '#666', 
                  marginBottom: 20,
                  fontFamily: 'Onest',
                  backgroundColor: '#fafafa',
                  padding: 12,
                        borderRadius: 8,
                }}>
                  {new Date(customTimeDate).toLocaleDateString([], { 
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              )}

              <ScrollView style={{ flex: 1 }}>
                {/* Start & End Time */}
                <View style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: '#666', marginBottom: 6, fontFamily: 'Onest' }}>Start</Text>
                      <TouchableOpacity
                        onPress={() => setShowCustomTimeStartPicker(true)}
                        style={{
                          backgroundColor: '#fff',
                          borderRadius: 8,
                          padding: 12,
                          alignItems: 'center',
                          borderWidth: 0,
                        }}
                      >
                        <Text style={{ fontSize: 14, color: '#333', fontFamily: 'Onest' }}>
                          {customTimeStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: '#666', marginBottom: 6, fontFamily: 'Onest' }}>End</Text>
                      <TouchableOpacity
                        onPress={() => setShowCustomTimeEndPicker(true)}
                        style={{
                          backgroundColor: '#fff',
                          borderRadius: 8,
                          padding: 12,
                          alignItems: 'center',
                          borderWidth: 0,
                        }}
                      >
                        <Text style={{ fontSize: 14, color: '#333', fontFamily: 'Onest' }}>
                          {customTimeEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Time Pickers */}
                  {(showCustomTimeStartPicker || showCustomTimeEndPicker) && (
                    <View style={{
                      backgroundColor: '#fff',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 12,
                    }}>
                      <DateTimePicker
                        value={showCustomTimeStartPicker ? customTimeStart : customTimeEnd}
                        mode="time"
                        display="spinner"
                        onChange={(event, selectedTime) => {
                          if (selectedTime) {
                            if (showCustomTimeStartPicker) {
                              setCustomTimeStart(selectedTime);
                              setTimeout(() => setShowCustomTimeStartPicker(false), 2000);
                            } else {
                              setCustomTimeEnd(selectedTime);
                              setTimeout(() => setShowCustomTimeEndPicker(false), 2000);
                            }
                          }
                        }}
                        style={{ height: 180, width: '100%' }}
                        textColor="#333"
                      />
                    </View>
                  )}
                </View>

                {/* Reminder & Repeat */}
                <View style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: '#666', marginBottom: 6, fontFamily: 'Onest' }}>Reminder</Text>
                      <TouchableOpacity
                        onPress={() => setShowCustomTimeReminderPicker(true)}
                        style={{
                          backgroundColor: '#fff',
                          borderRadius: 8,
                          padding: 12,
                          alignItems: 'center',
                          borderWidth: 0,
                        }}
                      >
                        <Text style={{ 
                          fontSize: 14,
                          color: '#333',
                          fontFamily: 'Onest',
                          fontWeight: '500'
                        }}>
                          {customTimeReminder ? customTimeReminder.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No Reminder'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: '#666', marginBottom: 6, fontFamily: 'Onest' }}>Repeat</Text>
                      <TouchableOpacity
                        onPress={() => setShowCustomTimeRepeatPicker(true)}
                        style={{
                          backgroundColor: '#fff',
                          borderRadius: 8,
                          padding: 12,
                          alignItems: 'center',
                          borderWidth: 0,
                        }}
                      >
                        <Text style={{ 
                          fontSize: 14,
                          color: '#333',
                          fontFamily: 'Onest',
                          fontWeight: '500'
                        }}>
                          {customTimeRepeat === 'None' ? 'Do Not Repeat' : customTimeRepeat}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Reminder Picker */}
                  {showCustomTimeReminderPicker && (
                    <View style={{
                      backgroundColor: '#fff',
                      borderRadius: 8,
                      padding: 12,
                      marginTop: 12,
                      marginBottom: 12,
                    }}>
                      <DateTimePicker
                        value={customTimeReminder || new Date()}
                        mode="time"
                        display="spinner"
                        onChange={(event, selectedTime) => {
                          if (selectedTime) {
                            setCustomTimeReminder(selectedTime);
                            setTimeout(() => setShowCustomTimeReminderPicker(false), 2000);
                        }
                      }}
                        style={{ height: 180, width: '100%' }}
                        textColor="#333"
                    />
              </View>
                  )}

                  {/* Repeat Picker */}
                  {showCustomTimeRepeatPicker && (
                    <View style={{ 
                      backgroundColor: '#fff',
                      borderRadius: 8,
                      padding: 12,
                      marginTop: 12,
                    }}>
                      {['Do Not Repeat', 'Daily', 'Weekly', 'Monthly', 'Yearly'].map((option) => (
                        <TouchableOpacity
                          key={option}
                          onPress={() => {
                            setCustomTimeRepeat(option === 'Do Not Repeat' ? 'None' : option as RepeatOption);
                            setShowCustomTimeRepeatPicker(false);
                          }}
                          style={{
                            paddingVertical: 10,
                            paddingHorizontal: 8,
                            borderRadius: 8,
                            backgroundColor: (option === 'Do Not Repeat' ? customTimeRepeat === 'None' : customTimeRepeat === option) ? '#f0f0f0' : 'transparent',
                          }}
                        >
                          <Text style={{ 
                            fontSize: 13, 
                            color: '#3a3a3a',
                            fontFamily: 'Onest',
                            fontWeight: (option === 'Do Not Repeat' ? customTimeRepeat === 'None' : customTimeRepeat === option) ? '600' : '400'
                          }}>
                            {option}
                    </Text>
                        </TouchableOpacity>
                      ))}
                </View>
              )}
                </View>

                    <TouchableOpacity 
                      onPress={() => {
                    if (customTimeDate) {
                        setCustomDateTimes(prev => ({
                          ...prev,
                        [customTimeDate]: {
                          start: customTimeStart,
                          end: customTimeEnd,
                          reminder: customTimeReminder,
                          repeat: customTimeRepeat
                        }
                      }));
                    }
                    setShowCustomTimeModal(false);
                      }}
                      style={{
                    backgroundColor: '#A0C3B2',
                    padding: 16,
                    borderRadius: 12,
                      alignItems: 'center',
                    marginTop: 8,
                  }}
                >
                  <Text style={{ 
                    color: '#fff', 
                    fontSize: 16,
                    fontWeight: '600',
                    fontFamily: 'Onest'
                  }}>
                    Save Custom Time
                      </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Toast
          config={{
            success: (props) => <CustomToast {...props} />,
          }}
        />

        {/* Edit Event Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showEditEventModal}
          onRequestClose={() => setShowEditEventModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <ScrollView
                    style={{ flexGrow: 0 }}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, marginTop: -8, marginRight: -8 }}>
                      <Text style={styles.modalTitle}>Edit Event</Text>
                      <TouchableOpacity 
                        onPress={() => setShowEditEventModal(false)}
                        style={{ padding: 12, marginTop: -8, marginRight: -8 }}
                      >
                        <Ionicons name="close" size={20} color="#666" />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.inputTitle}
                      placeholder="Title"
                      value={editedEventTitle}
                      onChangeText={setEditedEventTitle}
                    />
                    <TextInput
                      style={styles.inputDescription}
                      placeholder="Description (optional)"
                      value={editedEventDescription}
                      onChangeText={setEditedEventDescription}
                      multiline
                    />
                    {/* Category Selection */}
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>Category</Text>
                      <TouchableOpacity 
                        onPress={() => {
                          setShowCategoryPicker(prev => !prev);
                          if (showCategoryPicker) {
                            setShowAddCategoryForm(false);
                            setNewCategoryName('');
                            setNewCategoryColor('#FADADD');
                          }
                        }}
                        style={styles.categoryPickerButton}
                      >
                        {!showCategoryPicker ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {editedSelectedCategory ? (
                              <>
                                <View style={[styles.categoryDot, { backgroundColor: editedSelectedCategory.color }]} />
                                <Text style={styles.categoryText}>{editedSelectedCategory.name}</Text>
                              </>
                            ) : (
                              <Text style={styles.categoryText}>Set Category</Text>
                            )}
                          </View>
                        ) : (
                          <View style={styles.categoryPickerContainer}>
                            {categories.map((cat, idx) => (
                              <Pressable
                                key={idx}
                                onPress={() => {
                                  setEditedSelectedCategory(cat);
                                  setShowCategoryPicker(false);
                                  setShowAddCategoryForm(false);
                                }}
                                style={({ pressed }) => [
                                  styles.categoryOption,
                                  { borderWidth: (pressed || editedSelectedCategory?.name === cat.name) ? 1 : 0,
                                    borderColor: cat.color }
                                ]}
                              >
                                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                                <Text style={[
                                  styles.categoryText,
                                  { fontWeight: editedSelectedCategory?.name === cat.name ? '600' : '500' }
                                ]}>
                                  {cat.name}
                                </Text>
                              </Pressable>
                            ))}
                            <TouchableOpacity
                              onPress={() => setShowAddCategoryForm(true)}
                              style={styles.addCategoryButton}
                            >
                              <Ionicons name="add" size={14} color="#666" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                    {/* All-day event toggle */}
                    <View style={styles.allDayContainer}>
                      <Text style={styles.allDayText}>All-day event</Text>
                      <View style={{ transform: [{ scale: 0.75 }] }}>
                        <Switch value={isEditedAllDay} onValueChange={setIsEditedAllDay} />
                      </View>
                    </View>
                    {/* Start & End Time */}
                    <View style={styles.dateTimeContainer}>
                      <View style={styles.dateTimeRow}>
                        <View style={styles.dateTimeColumn}>
                          <Text style={styles.dateTimeLabel}>Start</Text>
                          <TouchableOpacity 
                            onPress={() => {
                              setShowStartPicker(prev => !prev);
                              if (showEndPicker) setShowEndPicker(false);
                              // Auto close after 3 seconds if opening
                              if (!showStartPicker) {
                                setTimeout(() => {
                                  setShowStartPicker(false);
                                }, 3000);
                              }
                            }}
                            style={{
                              backgroundColor: '#fafafa',
                              borderRadius: 12,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              marginTop: 2,
                              alignItems: 'center',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.05,
                              shadowRadius: 2,
                              elevation: 1,
                            }}
                          >
                            <Text style={{
                              fontSize: 13,
                              color: '#3a3a3a',
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
                        <View style={styles.dateTimeColumn}>
                          <Text style={styles.dateTimeLabel}>End</Text>
                          <TouchableOpacity
                            onPress={() => {
                              setShowEndPicker(prev => !prev);
                              if (showStartPicker) setShowStartPicker(false);
                              // Auto close after 3 seconds if opening
                              if (!showEndPicker) {
                                setTimeout(() => {
                                  setShowEndPicker(false);
                                }, 3000);
                              }
                            }}
                            style={{
                              backgroundColor: '#fafafa',
                              borderRadius: 12,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              marginTop: 2,
                              alignItems: 'center',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.05,
                              shadowRadius: 2,
                              elevation: 1,
                            }}
                          >
                            <Text style={{
                              fontSize: 13,
                              color: '#3a3a3a',
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
                      {(showStartPicker || showEndPicker) && (
                        <Animated.View style={[styles.dateTimePickerContainer, {
                          backgroundColor: '#fafafa',
                          borderRadius: 16,
                          paddingVertical: 8,
                          paddingHorizontal: 16,
                          marginTop: 12,
                          marginBottom: 4,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.03,
                          shadowRadius: 3,
                          elevation: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }]}>
                          <DateTimePicker
                            value={showStartPicker ? editedStartDateTime : editedEndDateTime}
                            mode={isEditedAllDay ? 'date' : 'datetime'}
                            display="spinner"
                            onChange={(event, selectedDate) => {
                              if (selectedDate) {
                                const newDate = new Date(selectedDate);
                                if (showStartPicker) {
                                  if (isEditedAllDay) newDate.setHours(0, 0, 0, 0);
                                  setEditedStartDateTime(newDate);
                                  if (!userChangedEditedEndTime) {
                                    const endDate = new Date(newDate);
                                    if (isEditedAllDay) {
                                      endDate.setHours(23, 59, 59, 999);
                                    } else {
                                      endDate.setTime(newDate.getTime() + 60 * 60 * 1000);
                                    }
                                    setEditedEndDateTime(endDate);
                                  }
                                } else {
                                  if (isEditedAllDay) newDate.setHours(23, 59, 59, 999);
                                  setEditedEndDateTime(newDate);
                                  setUserChangedEditedEndTime(true);
                                }
                              }
                            }}
                            style={{ height: isEditedAllDay ? 180 : 240, width: '100%' }}
                            textColor="#333"
                          />
                        </Animated.View>
                      )}
                    </View>
                    {/* Reminder & Repeat */}
                    <View style={{ flex: 1, marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                          <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>Reminder</Text>
                            <TouchableOpacity
                              onPress={() => {
                                // Toggle reminder picker
                                setShowReminderPicker(prev => !prev);
                                // Close other pickers if they're open
                                if (showRepeatPicker) setShowRepeatPicker(false);
                                if (showEndDatePicker) setShowEndDatePicker(false);
                                // Auto close after 2 seconds if opening
                                if (!showReminderPicker) {
                                  setTimeout(() => {
                                    setShowReminderPicker(false);
                                  }, 2000);
                                }
                              }}
                              style={{
                                backgroundColor: '#fafafa',
                                borderRadius: 12,
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                marginTop: 2,
                                alignItems: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.05,
                                shadowRadius: 2,
                                elevation: 1,
                              }}
                            >
                              <Text style={{ 
                                fontSize: 13, 
                                color: '#3a3a3a',
                                fontFamily: 'Onest',
                                fontWeight: '500'
                              }}>
                              {editedReminderTime ? editedReminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No Reminder'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1, marginRight: repeatOption !== 'None' ? 12 : 0 }}>
                        <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>Repeat</Text>                          
                            <TouchableOpacity
                            onPress={() => {
                              // Toggle repeat picker
                              setShowRepeatPicker(prev => !prev);
                              // Close other pickers if they're open
                              if (showReminderPicker) setShowReminderPicker(false);
                              if (showEndDatePicker) setShowEndDatePicker(false);
                              // Auto close after 2 seconds if opening
                              if (!showRepeatPicker) {
                                setTimeout(() => {
                                  setShowRepeatPicker(false);
                                }, 2000);
                              }
                            }}
                            style={{
                              backgroundColor: '#fafafa',
                              borderRadius: 12,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              marginTop: 2,
                              alignItems: 'center',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.05,
                              shadowRadius: 2,
                              elevation: 1,
                            }}
                          >
                            <Text style={{ 
                              fontSize: 13, 
                              color: '#3a3a3a',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                              {editedRepeatOption === 'None' ? 'Do Not Repeat' : editedRepeatOption}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {editedRepeatOption !== 'None' && (
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>End Date</Text>
                              <TouchableOpacity
                                onPress={() => {
                                  // Toggle end date picker
                                  setShowEndDatePicker(prev => !prev);
                                  // Close other pickers if they're open
                                  if (showReminderPicker) setShowReminderPicker(false);
                                  if (showRepeatPicker) setShowRepeatPicker(false);
                                  // Auto close after 2 seconds if opening
                                  if (!showEndDatePicker) {
                                    setTimeout(() => {
                                      setShowEndDatePicker(false);
                                    }, 3000);
                                  }
                                }}
                                style={{
                                  backgroundColor: '#fafafa',
                                  borderRadius: 12,
                                  paddingVertical: 10,
                                  paddingHorizontal: 12,
                                  marginTop: 2,
                                  alignItems: 'center',
                                  shadowColor: '#000',
                                  shadowOffset: { width: 0, height: 1 },
                                  shadowOpacity: 0.05,
                                  shadowRadius: 2,
                                  elevation: 1,
                                }}
                              >
                                <Text style={{ 
                                  fontSize: 13, 
                                  color: '#3a3a3a',
                                  fontFamily: 'Onest',
                                  fontWeight: '500'
                                }}>
                                  {editedRepeatEndDate ? editedRepeatEndDate.toLocaleDateString([], { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: '2-digit' 
                                  }) : 'Set End Date'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
          
                        {showReminderPicker && (
                          <Animated.View style={[styles.dateTimePickerContainer, {
                            backgroundColor: '#fafafa',
                            borderRadius: 16,
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            marginTop: 12,
                            marginBottom: 4,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.03,
                            shadowRadius: 3,
                            elevation: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }]}>
                          <DateTimePicker
                            value={editedReminderTime || new Date()}
                            mode="time"
                            display="spinner"
                            onChange={(event, selectedTime) => {
                              if (selectedTime) {
                                setEditedReminderTime(selectedTime);
                                setShowReminderPicker(false); // Close picker after selection
                              }
                            }}
                            style={{ height: 180, width: '100%' }}
                            textColor="#333"
                          />
                        </Animated.View>
                      )}

                      {showEndDatePicker && (
                          <Animated.View style={[styles.dateTimePickerContainer, {
                            backgroundColor: '#fafafa',
                            borderRadius: 16,
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            marginTop: 12,
                            marginBottom: 4,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.03,
                            shadowRadius: 3,
                            elevation: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }]}>
                            <DateTimePicker
                              value={repeatEndDate || new Date()}
                              mode="date"
                              display="spinner"
                              onChange={(event, selectedDate) => {
                                if (selectedDate) {
                                  setEditedRepeatEndDate(selectedDate);
                                  setShowEndDatePicker(false); // Close picker after selection
                                }
                              }}
                              style={{ height: 180, width: '100%' }}
                              textColor="#333"
                            />
                          </Animated.View>
                        )}


                        {showRepeatPicker && (
                          <Animated.View style={{ 
                            backgroundColor: '#fafafa',
                            borderRadius: 12,
                            padding: 12,
                            marginTop: 12,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 2,
                            elevation: 1,
                          }}>
                          {['Do Not Repeat', 'Daily', 'Weekly', 'Monthly', 'Yearly', 'Custom'].map((option) => (
                            <TouchableOpacity 
                              key={option}
                              onPress={() => {
                                setEditedRepeatOption(option === 'Do Not Repeat' ? 'None' : option as RepeatOption);
                                setShowRepeatPicker(false); // Close picker after selection
                              }}
                              style={{
                                paddingVertical: 10,
                                paddingHorizontal: 8,
                                borderRadius: 8,
                                backgroundColor: (option === 'Do Not Repeat' ? editedRepeatOption === 'None' : editedRepeatOption === option) ? '#f0f0f0' : 'transparent',
                              }}
                            >
                               <Text style={{ 
                                  fontSize: 13, 
                                  color: '#3a3a3a',
                                  fontFamily: 'Onest',
                                  fontWeight: (option === 'Do Not Repeat' ? editedRepeatOption === 'None' : editedRepeatOption === option) ? '600' : '400'
                                }}>
                                  {option}
                                </Text>
                            </TouchableOpacity>
                          ))}
                        </Animated.View>
                      )}
                    </View>
                  
                    {/* Action Buttons */}
                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        onPress={() => {
                          if (selectedEvent) {
                            handleDeleteEvent(selectedEvent.dateKey, selectedEvent.index);
                            setShowEditEventModal(false);
                          }
                        }}
                        style={styles.deleteButton}
                      >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={async () => {
                          if (selectedEvent) {
                            try {
                              const { error } = await supabase
                                .from('events')
                                .update({
                                  title: editedEventTitle,
                                  description: editedEventDescription,
                                  start_datetime: editedStartDateTime.toISOString(),
                                  end_datetime: editedEndDateTime.toISOString(),
                                  category_name: editedSelectedCategory?.name || 'No Category',
                                  category_color: editedSelectedCategory?.color || '#FF9A8B',
                                  reminder_time: editedReminderTime ? editedReminderTime.toISOString() : null,
                                  repeat_option: editedRepeatOption,
                                  repeat_end_date: editedRepeatEndDate ? editedRepeatEndDate.toISOString() : null,
                                  custom_dates: customSelectedDates,
                                  is_all_day: isEditedAllDay,
                                })
                                .eq('id', selectedEvent.event.id);

                              if (error) {
                                console.error('Error updating event:', error);
                                Alert.alert('Error', 'Failed to update event.');
                                return;
                              }

                              // Update local state
                              const updatedEvents = { ...events };
                              
                              // Remove the old event from all dates
                              Object.keys(updatedEvents).forEach(dateKey => {
                                updatedEvents[dateKey] = updatedEvents[dateKey].filter(
                                  event => event.id !== selectedEvent.event.id
                                );
                                if (updatedEvents[dateKey].length === 0) {
                                  delete updatedEvents[dateKey];
                                }
                              });

                              // Add the updated event to the dates
                              const start = new Date(editedStartDateTime);
                              const end = new Date(editedEndDateTime);
                              let currentDate = new Date(start);

                              while (currentDate <= end) {
                                const dateKey = getLocalDateString(currentDate);
                                if (!updatedEvents[dateKey]) updatedEvents[dateKey] = [];

                                updatedEvents[dateKey].push({
                                  id: selectedEvent.event.id,
                                  title: editedEventTitle,
                                  description: editedEventDescription,
                                  date: dateKey,
                                  startDateTime: editedStartDateTime,
                                  endDateTime: editedEndDateTime,
                                  categoryName: editedSelectedCategory?.name,
                                  categoryColor: editedSelectedCategory?.color,
                                  reminderTime: editedReminderTime,
                                  repeatOption: editedRepeatOption,
                                  repeatEndDate: editedRepeatEndDate,
                                  customDates: customSelectedDates,
                                  isContinued: currentDate.toDateString() !== start.toDateString(),
                                  isAllDay: isEditedAllDay,
                                });

                                currentDate.setDate(currentDate.getDate() + 1);
                              }

                              setEvents(updatedEvents);
                              setShowEditEventModal(false);
                              
                              Toast.show({
                                type: 'success',
                                text1: 'Event updated successfully',
                                position: 'bottom',
                              });
                            } catch (err) {
                              console.error('Error updating event:', err);
                              Alert.alert('Error', 'Failed to update event. Please try again.');
                            }
                          }
                        }}
                        style={styles.saveButton}
                      >
                        <Text style={styles.saveButtonText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>
      </>
    );
  };
  
  export default CalendarScreen;
