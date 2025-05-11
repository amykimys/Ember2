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
  Pressable
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
import WeeklyCalendarView from '../../components/WeeklyCalendar'; 
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
    marginBottom: 28,
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
});

const CalendarScreen: React.FC = () => {
  const today = new Date();
  const currentMonthIndex = 12; // center month in 25-month buffer
  const flatListRef = useRef<FlatList>(null);

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
  const [customDateTimes, setCustomDateTimes] = useState<{ [date: string]: { start: Date, end: Date } }>({});
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
                startDateTime: event.start_datetime,
                endDateTime: event.end_datetime,
                categoryName: event.category_name,
                categoryColor: event.category_color,
                reminderTime: event.reminder_time,
                repeatOption: event.repeat_option,
                repeatEndDate: event.repeat_end_date,
                customDates: event.custom_dates,
                isContinued: false,
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
                startDateTime: event.start_datetime,
                endDateTime: event.end_datetime,
                categoryName: event.category_name,
                categoryColor: event.category_color,
                reminderTime: event.reminder_time,
                repeatOption: event.repeat_option,
                repeatEndDate: event.repeat_end_date,
                customDates: event.custom_dates,
                isContinued: !isFirstDay,
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
  };

  const handleSaveEvent = async () => {
    if (!newEventTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for the event.');
      return;
    }

    if (!startDateTime || !endDateTime) {
      Alert.alert('Error', 'Please set start and end times for the event.');
      return;
    }
  
    setIsSaving(true);
  
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
          category_color: selectedCategory?.color || '#FF9A8B', // Default pink coral color
          reminder_time: reminderTime ? reminderTime.toISOString() : null,
          repeat_option: repeatOption || 'None',
          repeat_end_date: repeatEndDate ? repeatEndDate.toISOString() : null,
          custom_dates: repeatOption === 'Custom' ? customSelectedDates : null,
          user_id: user?.id || null,
        },
      ])
      .select();
  
    if (error) {
      console.error('Error saving event:', error);
      Alert.alert('Error', 'Failed to save event.');
      setIsSaving(false);
      return;
    }
  
    console.log('Event saved!', data);
  
    // ✅ Build event blocks across multiple days
    const updatedEvents = { ...events };
  
    const eventId = data?.[0]?.id || Date.now().toString();
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
  
    if (repeatOption === 'Custom' && customSelectedDates.length > 0) {
      // For custom repeat, only create events on selected dates
      customSelectedDates.forEach(dateStr => {
        const dateKey = dateStr;
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
          isContinued: false,
        });
      });
    } else {
      // For other repeat options, create events across the date range
      let currentDate = new Date(start);
      while (currentDate <= end) {
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
          isContinued: currentDate.toDateString() !== start.toDateString(),
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  
    setEvents(updatedEvents);
  
    resetEventForm();
    setShowModal(false);
    setIsSaving(false);
  };
  
  
  const renderMonth = ({ item }: { item: ReturnType<typeof getMonthData> }) => {
    const { year, month, days } = item;
    const label = new Date(year, month).toLocaleDateString('en-US', {
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
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28, paddingHorizontal: 8 }}>
          <TouchableOpacity
            onPress={() => setCalendarMode((prev: 'month' | 'week') => prev === 'month' ? 'week' : 'month')}
            style={{ paddingVertical: 6, paddingHorizontal: 10 }}
          >
            <MaterialIcons 
              name={(calendarMode as 'month' | 'week') === 'month' ? 'calendar-view-week' : 'calendar-view-month'}
              size={20} 
              color="#333"
            />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => {
                const todayIndex = findMonthIndex(today);
                if (todayIndex !== -1) {
                  flatListRef.current?.scrollToIndex({ index: todayIndex, animated: true });
                }
              }}
            >
              <Text style={[styles.monthLabel, { marginBottom: 0 }]}>{label}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ width: 40 }}>
            <Text style={{ color: 'transparent' }}>Spacer</Text>
          </View>
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
                              color: isSelected(date) ? '#FFFFFF' : (isToday(date) ? '#A0C3B2' : '#3A3A3A'),
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
                              <View
                                key={`${event.id}-${eventIndex}`}
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
                                    textAlign: 'left'
                                  }}
                                >
                                  {event.title}
                                </Text>
                              </View>
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
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: -3, paddingHorizontal: 12 }}>
              <TouchableOpacity
                onPress={() => setCalendarMode((prev: 'month' | 'week') => prev === 'month' ? 'week' : 'month')}
                style={{ paddingVertical: 6, paddingHorizontal: 6 }}
              >
                <MaterialIcons 
                  name={(calendarMode as 'month' | 'week') === 'month' ? 'calendar-view-week' : 'calendar-view-month'}
                  size={20} 
                  color="#333"
                />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[styles.monthLabel, { marginBottom: 0 }]}>
                  {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
              <View style={{ width: 40 }}>
                <Text style={{ color: 'transparent' }}>Spacer</Text>
              </View>
            </View>
            <WeeklyCalendarView
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              events={events}
              setEvents={setEvents}
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
            <MaterialIcons name="add" size={22} color="#3a3a3a" />
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
                                        marginBottom: 9,
                                        fontSize: 13,
                                        marginTop: 4,
                                        fontFamily: 'Onest',
                                      }}
                                      placeholder="Category name"
                                      value={newCategoryName}
                                      onChangeText={setNewCategoryName}
                                    />
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <TouchableOpacity
                                        onPress={() => {
                                          setShowAddCategoryForm(false);
                                          setNewCategoryName('');
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

                      {/* 🕓 Starts & Ends in one row */}
                      <View style={{ flex: 1, marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                          <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>Start</Text>
                            <TouchableOpacity
                              onPress={() => {
                                setShowStartPicker(true);
                                setShowEndPicker(false);
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
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true 
                                }).replace(',', ' ·')}
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>End</Text>
                            <TouchableOpacity
                              onPress={() => {
                                setShowEndPicker(true);
                                setShowStartPicker(false);
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
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true 
                                }).replace(',', ' ·')}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Date/Time Picker Container */}
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
                              mode="datetime"
                              display="spinner"
                              onChange={(event, selectedDate) => {
                                if (selectedDate) {
                                  if (showStartPicker) {
                                    setStartDateTime(selectedDate);
                                    if (!userChangedEndTime) {
                                      setEndDateTime(new Date(selectedDate.getTime() + 60 * 60 * 1000));
                                    }
                                    setTimeout(() => {
                                      setShowStartPicker(false);
                                    }, 2000);
                                  } else {
                                    setEndDateTime(selectedDate);
                                    setUserChangedEndTime(true);
                                    setTimeout(() => {
                                      setShowEndPicker(false);
                                    }, 2000);
                                  }
                                }
                              }}
                              style={{
                                height: 180,
                                width: '100%',
                              }}
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
                            <Swipeable
                              ref={reminderSwipeableRef}
                              onSwipeableOpen={() => {
                                setReminderTime(null);
                                setShowReminderPicker(false);
                                // Close the swipeable after resetting
                                setTimeout(() => {
                                  reminderSwipeableRef.current?.close();
                                }, 100);
                              }}
                              renderLeftActions={() => null}
                              renderRightActions={() => (
                                <View style={{ 
                                  width: 80,
                                  backgroundColor: 'transparent',
                                  justifyContent: 'center',
                                  alignItems: 'flex-end',
                                  paddingRight: 20,
                                  borderTopLeftRadius: 12,
                                  borderBottomLeftRadius: 12,
                             
                                }}>
                                </View>
                              )}
                              friction={1}
                              rightThreshold={20}
                              overshootLeft={false}
                              overshootRight={false}
                              enableTrackpadTwoFingerGesture
                            >
                              <View style={{ backgroundColor: '#fafafa', borderRadius: 12 }}>
                                <TouchableOpacity
                                  onPress={() => setShowReminderPicker(prev => !prev)}
                                  style={{
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
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ 
                                      fontSize: (reminderTime || repeatOption !== 'None') ? 11 : 13, 
                                      color: '#3a3a3a',
                                      fontFamily: 'Onest',
                                      fontWeight: '500'
                                    }}>
                                      {reminderTime ? reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No Reminder'}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              </View>
                            </Swipeable>
                          </View>
                          <View style={{ flex: 1, marginRight: repeatOption !== 'None' ? 12 : 0 }}>
                            <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>Repeat</Text>
                            <Swipeable
                              ref={repeatSwipeableRef}
                              onSwipeableOpen={() => {
                                setRepeatOption('None');
                                setRepeatEndDate(null);
                                setShowRepeatPicker(false);
                                // Close the swipeable after resetting
                                setTimeout(() => {
                                  repeatSwipeableRef.current?.close();
                                }, 100);
                              }}
                              renderLeftActions={() => null}
                              renderRightActions={() => (
                                <View style={{ 
                                  width: 80,
                                  backgroundColor: 'transparent',
                                  justifyContent: 'center',
                                  alignItems: 'flex-end',
                                  paddingRight: 20,
                                  borderTopLeftRadius: 12,
                                  borderBottomLeftRadius: 12,
                             
                                }}>
                                </View>
                              )}
                              friction={1}
                              rightThreshold={20}
                              overshootLeft={false}
                              overshootRight={false}
                              enableTrackpadTwoFingerGesture
                            >
                              <View style={{ backgroundColor: '#fafafa', borderRadius: 12 }}>
                                <TouchableOpacity
                                  onPress={() => setShowRepeatPicker(prev => !prev)}
                                  style={{
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
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ 
                                      fontSize: repeatOption !== 'None' ? 11 : 13, 
                                      color: '#3a3a3a',
                                      fontFamily: 'Onest',
                                      fontWeight: '500'
                                    }}>
                                      {repeatOption === 'None' ? 'Do Not Repeat' : repeatOption}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              </View>
                            </Swipeable>
                          </View>
                          {repeatOption !== 'None' && (
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>End Date</Text>
                              <Swipeable
                                ref={endDateSwipeableRef}
                                onSwipeableOpen={() => {
                                  setRepeatEndDate(null);
                                  setShowEndDatePicker(false);
                                  // Close the swipeable after resetting
                                  setTimeout(() => {
                                    endDateSwipeableRef.current?.close();
                                  }, 100);
                                }}
                                renderLeftActions={() => null}
                                renderRightActions={() => (
                                  <View style={{ 
                                    width: 80,
                                  backgroundColor: 'transparent',
                                  justifyContent: 'center',
                                  alignItems: 'flex-end',
                                  paddingRight: 20,
                                  borderTopLeftRadius: 12,
                                  borderBottomLeftRadius: 12,
                             
                                  }}>
                                  </View>
                                )}
                                friction={1}
                                rightThreshold={20}
                                overshootLeft={false}
                                overshootRight={false}
                                enableTrackpadTwoFingerGesture
                              >
                                <View style={{ backgroundColor: '#fafafa', borderRadius: 12 }}>
                                  <TouchableOpacity
                                    onPress={() => setShowEndDatePicker(prev => !prev)}
                                    style={{
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
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                      <Text style={{ 
                                        fontSize: repeatEndDate ? 11 : 11, 
                                        color: '#3a3a3a',
                                        fontFamily: 'Onest',
                                        fontWeight: '500'
                                      }}>
                                        {repeatEndDate ? repeatEndDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Set End Date'}
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                </View>
                              </Swipeable>
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
                                  setTimeout(() => {
                                    setShowReminderPicker(false);
                                  }, 2000);
                                }
                              }}
                              style={{
                                height: 180,
                                width: '100%',
                              }}
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
                                  setTimeout(() => {
                                    setShowEndDatePicker(false);
                                  }, 2000);
                                }
                              }}
                              style={{
                                height: 180,
                                width: '100%',
                              }}
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
                            {['Do Not Repeat', 'Daily', 'Weekly', 'Monthly', 'Yearly'].map((option) => (
                              <TouchableOpacity
                                key={option}
                                onPress={() => {
                                  setRepeatOption(option === 'Do Not Repeat' ? 'None' : option as RepeatOption);
                                  setShowRepeatPicker(false);
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
                                      marginBottom: 9,
                                      fontSize: 13,
                                      marginTop: 4,
                                      fontFamily: 'Onest',
                                    }}
                                    placeholder="Category name"
                                    value={newCategoryName}
                                    onChangeText={setNewCategoryName}
                                  />
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <TouchableOpacity
                                      onPress={() => {
                                        setShowAddCategoryForm(false);
                                        setNewCategoryName('');
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
                              {customSelectedDates.length > 0 ? `${customSelectedDates.length} dates selected` : 'Select Dates'}
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
                  flexGrow: 1, // Added to ensure content fills available space
                }}
                showsVerticalScrollIndicator={true} // Changed to true for better UX
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
                    const dateStr = day.dateString;
                    setCustomSelectedDates((prev) =>
                      prev.includes(dateStr)
                        ? prev.filter((d) => d !== dateStr)
                        : [...prev, dateStr]
                    );
                  }}
                  onDayLongPress={(day: DateData) => {
                    const dateStr = day.dateString;
                    if (customSelectedDates.includes(dateStr)) {
                      setSelectedDateForCustomTime(dateStr);
                      setCustomStartTime(startDateTime);
                      setCustomEndTime(endDateTime);
                      setShowCustomStartPicker(true);
                    }
                  }}
                  markedDates={Object.fromEntries(
                    customSelectedDates.map((date) => [
                      date,
                      { 
                        selected: true,
                        selectedColor: '#A0C3B2',
                        selectedTextColor: '#fff'
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
                        borderColor: '#A0C3B2',
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
                />

                {/* Selected Dates Summary */}
                {customSelectedDates.length > 0 && (
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
                    </ScrollView>
                  </View>
                )}

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
                    marginBottom: 12,
                    fontFamily: 'Onest'
                  }}>
                    Default Event Time
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: '#666', marginBottom: 6, fontFamily: 'Onest' }}>Start</Text>
                      <TouchableOpacity
                        onPress={() => setShowStartPicker(true)}
                        style={{
                          backgroundColor: '#fff',
                          borderRadius: 8,
                          padding: 12,
                          alignItems: 'center',
                          borderWidth: 1,
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
                        onPress={() => setShowEndPicker(true)}
                        style={{
                          backgroundColor: '#fff',
                          borderRadius: 8,
                          padding: 12,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: '#eee'
                        }}
                      >
                        <Text style={{ fontSize: 14, color: '#333', fontFamily: 'Onest' }}>
                          {endDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {selectedDateForCustomTime && (
                  <View style={{ 
                    backgroundColor: '#fafafa',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 20
                  }}>
                    <View style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: 12
                    }}>
                      <Text style={{ 
                        fontSize: 14, 
                        fontWeight: '600', 
                        color: '#333',
                        fontFamily: 'Onest'
                      }}>
                        Custom Time for {new Date(selectedDateForCustomTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </Text>
                      <TouchableOpacity 
                        onPress={() => {
                          setCustomDateTimes(prev => ({
                            ...prev,
                            [selectedDateForCustomTime]: { start: customStartTime, end: customEndTime }
                          }));
                          setSelectedDateForCustomTime(null);
                        }}
                        style={{
                          backgroundColor: '#A0C3B2',
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 8
                        }}
                      >
                        <Text style={{ 
                          color: 'white', 
                          fontSize: 13,
                          fontFamily: 'Onest',
                          fontWeight: '500'
                        }}>
                          Save Time
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: '#666', marginBottom: 6, fontFamily: 'Onest' }}>Start</Text>
                        <TouchableOpacity
                          onPress={() => setShowCustomStartPicker(true)}
                          style={{
                            backgroundColor: '#fff',
                            borderRadius: 8,
                            padding: 12,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: '#eee'
                          }}
                        >
                          <Text style={{ fontSize: 14, color: '#333', fontFamily: 'Onest' }}>
                            {customStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: '#666', marginBottom: 6, fontFamily: 'Onest' }}>End</Text>
                        <TouchableOpacity
                          onPress={() => setShowCustomEndPicker(true)}
                          style={{
                            backgroundColor: '#fff',
                            borderRadius: 8,
                            padding: 12,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: '#eee'
                          }}
                        >
                          <Text style={{ fontSize: 14, color: '#333', fontFamily: 'Onest' }}>
                            {customEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {showCustomStartPicker && (
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
                          value={customStartTime}
                          mode="time"
                          display="spinner"
                          onChange={(event, selectedTime) => {
                            if (selectedTime) {
                              setCustomStartTime(selectedTime);
                              // Update end time to be 1 hour after start time
                              setCustomEndTime(new Date(selectedTime.getTime() + 60 * 60 * 1000));
                            }
                            setShowCustomStartPicker(false);
                          }}
                          style={{
                            height: 180,
                            width: '100%',
                          }}
                          textColor="#333"
                        />
                      </Animated.View>
                    )}

                    {showCustomEndPicker && (
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
                          value={customEndTime}
                          mode="time"
                          display="spinner"
                          onChange={(event, selectedTime) => {
                            if (selectedTime) {
                              setCustomEndTime(selectedTime);
                            }
                            setShowCustomEndPicker(false);
                          }}
                          style={{
                            height: 180,
                            width: '100%',
                          }}
                          textColor="#333"
                        />
                      </Animated.View>
                    )}
                  </View>
                )}

                {Object.keys(customDateTimes).length > 0 && (
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
                      marginBottom: 12,
                      fontFamily: 'Onest'
                    }}>
                      Custom Times
                    </Text>
                    {Object.entries(customDateTimes).map(([date, times]) => (
                      <View key={date} style={{ 
                        backgroundColor: '#fff',
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 8,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: '#eee'
                      }}>
                        <Text style={{ 
                          fontSize: 13, 
                          color: '#333',
                          fontFamily: 'Onest',
                          fontWeight: '500'
                        }}>
                          {new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 13, color: '#666', fontFamily: 'Onest' }}>
                            {times.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Text style={{ fontSize: 13, color: '#666', fontFamily: 'Onest' }}>to</Text>
                          <Text style={{ fontSize: 13, color: '#666', fontFamily: 'Onest' }}>
                            {times.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <TouchableOpacity 
                            onPress={() => {
                              setCustomDateTimes(prev => {
                                const newTimes = { ...prev };
                                delete newTimes[date];
                                return newTimes;
                              });
                            }}
                            style={{ padding: 4 }}
                          >
                            <Ionicons name="close-circle" size={16} color="#999" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => {
                    setShowCustomDatesPicker(false);
                    if (isEditingEvent) {
                      setShowEditEventModal(true);
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
        <Toast
          config={{
            success: (props) => <CustomToast {...props} />,
          }}
        />
    </>
  );
};

export default CalendarScreen;
