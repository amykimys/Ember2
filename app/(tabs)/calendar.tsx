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
  Alert
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
    fontFamily: 'Manrope',
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
    fontFamily: 'Manrope',
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
    fontFamily: 'Manrope',
  },
  adjacentMonthDate: {
    color: '#ccc',  // Light gray color for adjacent month dates
  },
  todayCell: {
    backgroundColor: '#A0C3B2',
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
    fontWeight: 'bold',
    color: '#BF9264',
  },
  invisibleText: {
    color: 'transparent',
  },
  addButton: {
    position: 'absolute',
    right: 10,
    bottom: 50,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#A0C3B2',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  addIcon: {
    fontSize: 30,
    color: 'white',
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
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: 'Manrope',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontFamily: 'Manrope',
  },
  input: {
    borderWidth: 0.5,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    fontFamily: 'Manrope',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancel: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Manrope',
  },
  save: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    fontFamily: 'Manrope',
  },
  eventText: {
    fontSize: 10,
    color: '#333',
    marginTop: 2,
    paddingRight: 2,
    fontFamily: 'Manrope',
  },
  inputTitle: {
    fontSize: 16,
    padding: 12,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    fontFamily: 'Manrope',
  },
  inputDescription: {
    fontSize: 14,
    padding: 12,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 10,
    fontFamily: 'Manrope',
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
    marginTop: 10,
    marginBottom: 0,
  },
  inlineSettingText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Manrope',
  },
  inlineSettingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    fontFamily: 'Manrope',
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
    fontFamily: 'Manrope',
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
    setUserChangedEndTime(false);
  };

  const handleSaveEvent = async () => {
    if (!newEventTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for the event.');
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
          category_name: selectedCategory?.name || null,
          category_color: selectedCategory?.color || null,
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
            {days.map((date, i) => (
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
                        setIsMonthCompact(prev => !prev);
                      }
                    }}
                    style={{ 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      height: 24,
                    }}
                  >
                    <Text
                      style={[
                        styles.dateNumber,
                        !date && styles.invisibleText,
                        isSelected(date) && styles.selectedText,
                        isToday(date) && styles.todayText,
                        date.getMonth() !== month && styles.adjacentMonthDate,
                      ]}
                    >
                      {(() => {
                        const totalGridSlots = days.length;
                        const isLastCell = i === days.length - 1;
                        const isSixthRow = totalGridSlots > 35;
                        const currentDate = date?.getDate();
                        const nextDate = days[i + 1]?.getDate();
                        if (isSixthRow && isLastCell && currentDate && nextDate) {
                          return `${currentDate}/${nextDate}`;
                        }
                        return currentDate;
                      })()}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
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
            <Ionicons name="add" size={22} color="white" />
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
                  contentContainerStyle={{ paddingBottom: 40 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.modalTitle}>Add Event</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      if (repeatOption === 'Custom') {
                        setRepeatOption('None');
                      } else {
                        setRepeatOption('Custom');
                      }
                    }}
                  >
                    <Text style={[styles.modalSubtitle, { color: '#6F4E37' }]}>
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

                      {/* 🕓 Starts */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ display: 'none' }}>🕓 Starts</Text>
                        <TouchableOpacity
                          onPress={() => setShowStartPicker(prev => !prev)}
                          style={styles.inlineSettingRow}
                        >
                          <Ionicons name="play-outline" size={22} color="#666" />
                          <Text style={styles.inlineSettingText}>
                            {startDateTime.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </TouchableOpacity>

                        {showStartPicker && (
                          <Animated.View style={styles.dateTimePickerContainer}>
                            <DateTimePicker
                              value={startDateTime}
                              mode="datetime"
                              display="spinner"
                              onChange={(event, selectedDate) => {
                                if (selectedDate) {
                                  setStartDateTime(selectedDate);
                                  if (!userChangedEndTime) {
                                    setEndDateTime(new Date(selectedDate.getTime() + 60 * 60 * 1000));
                                  }
                                }
                                setShowStartPicker(false);
                              }}
                              style={styles.dateTimePicker}
                            />
                          </Animated.View>
                        )}
                      </View>

                      {/* 🛑 Ends */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ display: 'none' }}>🛑 Ends</Text>
                        <TouchableOpacity
                          onPress={() => setShowEndPicker(prev => !prev)}
                          style={styles.inlineSettingRow}
                        >
                          <Ionicons name="caret-back-outline" size={22} color="#666" />
                          <Text style={styles.inlineSettingText}>
                            {endDateTime.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </TouchableOpacity>

                        {showEndPicker && (
                          <Animated.View style={styles.dateTimePickerContainer}>
                            <DateTimePicker
                              value={endDateTime}
                              mode="datetime"
                              display="spinner"
                              onChange={(event, selectedDate) => {
                                if (selectedDate) {
                                  setEndDateTime(selectedDate);
                                  setUserChangedEndTime(true);
                                }
                                setShowEndPicker(false);
                              }}
                              style={styles.dateTimePicker}
                            />
                          </Animated.View>
                        )}
                      </View>

                      {/* 🕑 Set Reminder */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ display: 'none' }}>🕑 Set Reminder</Text>
                        <TouchableOpacity
                          onPress={() => setShowReminderPicker(prev => !prev)}
                          style={styles.inlineSettingRow}
                        >
                          <Ionicons name="alarm-outline" size={22} color="#666" />
                          <Text style={styles.inlineSettingText}>
                            {reminderTime ? reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Set Reminder'}
                          </Text>
                        </TouchableOpacity>

                        {showReminderPicker && (
                          <Animated.View style={styles.dateTimePickerContainer}>
                            <DateTimePicker
                              value={reminderTime || new Date()}
                              mode="time"
                              display="spinner"
                              onChange={(event, selectedTime) => {
                                if (selectedTime) {
                                  setReminderTime(selectedTime);
                                }
                                setShowReminderPicker(false);
                              }}
                              style={styles.dateTimePicker}
                            />
                          </Animated.View>
                        )}
                      </View>

                      {/* 🔁 Set Repeat */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ display: 'none' }}>🔁 Set Repeat</Text>
                        <TouchableOpacity
                          onPress={() => setShowRepeatPicker(prev => !prev)}
                          style={styles.inlineSettingRow}
                        >
                          <Ionicons name="repeat" size={22} color="#666" />
                          <Text style={styles.inlineSettingText}>
                            {repeatOption !== 'None' ? repeatOption : 'Set Repeat'}
                          </Text>
                        </TouchableOpacity>

                        {showRepeatPicker && (
                          <Animated.View style={{ marginTop: 10 }}>
                            {['Daily', 'Weekly', 'Monthly', 'Yearly'].map((option) => (
                              <TouchableOpacity
                                key={option}
                                onPress={() => {
                                  setRepeatOption(option as RepeatOption);
                                  setShowRepeatPicker(false);
                                }}
                                style={{ paddingVertical: 8 }}
                              >
                                <Text style={{ fontSize: 16, color: '#333', paddingLeft: 32 }}>
                                  {option}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </Animated.View>
                        )}
                      </View>

                      {/* 📅 Set End Date */}
                      {repeatOption !== 'None' && (
                        <View style={{ flex: 1, alignItems: 'center' }}>
                          <Text style={{ display: 'none' }}>📅 Set End Date</Text>
                          <TouchableOpacity
                            onPress={() => setShowEndDatePicker(prev => !prev)}
                            style={styles.inlineSettingRow}
                          >
                            <Ionicons name="calendar-outline" size={22} color="#666" />
                            <Text style={styles.inlineSettingText}>
                              {repeatEndDate ? `Until ${repeatEndDate.toLocaleDateString()}` : 'Set End Date'}
                            </Text>
                          </TouchableOpacity>

                          {showEndDatePicker && (
                            <Animated.View>
                              <DateTimePicker
                                value={repeatEndDate || new Date()}
                                mode="date"
                                display="spinner"
                                onChange={(event, selectedDate) => {
                                  if (selectedDate) {
                                    setRepeatEndDate(selectedDate);
                                  }
                                  setShowEndDatePicker(false);
                                }}
                              />
                            </Animated.View>
                          )}
                        </View>
                      )}
                    </>
                  ) : (
                    <TextInput
                      style={styles.inputTitle}
                      placeholder="Title"
                      value={newEventTitle}
                      onChangeText={setNewEventTitle}
                    />
                  )}

                  {/* 🗂 Set Category */}
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ display: 'none' }}>🗂 Set Category</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowCategoryPicker(prev => !prev);
                        if (showCategoryPicker) {
                          setShowAddCategoryForm(false);
                          setNewCategoryName('');
                          setNewCategoryColor('#FADADD');
                        }
                      }}
                      style={styles.inlineSettingRow}
                    >
                      <MaterialIcons name="colorize" size={22} color={selectedCategory ? selectedCategory.color : '#666'} />
                      <Text style={[styles.inlineSettingText, { color: selectedCategory ? selectedCategory.color : '#000' }]}>
                        {selectedCategory ? selectedCategory.name : 'Set Category'}
                      </Text>

                      {selectedCategory && (
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); setSelectedCategory(null); }} style={{ marginLeft: 8 }}>
                          <Text style={{ fontSize: 12, color: '#aaa' }}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>

                    {showCategoryPicker && (
                      <Animated.View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                        {categories.map((cat, idx) => (
                          <TouchableOpacity
                            key={idx}
                            onPress={() => {
                              setSelectedCategory(cat);
                              setShowCategoryPicker(false);
                              setShowAddCategoryForm(false); // Add this line
                            }}
                            style={{
                              backgroundColor: cat.color,
                              paddingVertical: 6,
                              paddingHorizontal: 12,
                              borderRadius: 20,
                              marginRight: 8,
                              marginBottom: 8,
                              marginTop: 1,
                              borderWidth: selectedCategory?.name === cat.name && selectedCategory?.color === cat.color ? 1.4 : 0,
                              borderColor: selectedCategory?.name === cat.name && selectedCategory?.color === cat.color ? '#333' : 'transparent',
                            }}
                          >
                            <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>{cat.name}</Text>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          onPress={() => setShowAddCategoryForm(true)}
                          style={{
                            backgroundColor: '#ccc',
                            paddingVertical: 5,
                            paddingHorizontal: 12,
                            borderRadius: 20,
                            marginBottom: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}
                        >
                          <Ionicons name="add" size={16} color="#333" />
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                  </View>

                  {/* 📅 Pick Dates (only shown in custom dates mode) */}
                  {repeatOption === 'Custom' && (
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ display: 'none' }}>📅 Pick Dates (only shown in custom dates mode)</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setShowModal(false);
                          setTimeout(() => {
                            setShowCustomDatesPicker(true);
                          }, 300);
                        }}
                        style={styles.inlineSettingRow}
                      >
                        <Ionicons name="calendar-outline" size={22} color="#666" />
                        <Text style={styles.inlineSettingText}>
                          Pick Dates {customSelectedDates.length > 0 ? `(${customSelectedDates.length} selected)` : ''}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* ➕ If Plus is pressed, show New Category Form inline */}
                  {showAddCategoryForm && (
                    <View style={{ marginTop: 10 }}>
                      <TextInput
                        style={styles.inputTitle}
                        placeholder="New Category Name"
                        value={newCategoryName}
                        onChangeText={setNewCategoryName}
                      />
                      <View style={{ flexDirection: 'row', marginTop: 10 }}>
                        {['#BF9264', '#6F826A', '#BBD8A3', '#F0F1C5', '#FFCFCF'].map((color) => (
                          <TouchableOpacity
                            key={color}
                            style={{
                              backgroundColor: color,
                              width: 30,
                              height: 30,
                              borderRadius: 15,
                              marginHorizontal: 5,
                              borderWidth: newCategoryColor === color ? 1 : 0,
                              borderColor: '#333',
                            }}
                            onPress={() => setNewCategoryColor(color)}
                          />
                        ))}
                      </View>

                      <TouchableOpacity
                        style={{
                          marginTop: 15,
                          backgroundColor: '#007AFF',
                          padding: 10,
                          borderRadius: 8,
                          alignItems: 'center',
                        }}
                        onPress={() => {
                          if (newCategoryName.trim()) {
                            const newCategory = {
                              id: Date.now().toString(),
                              name: newCategoryName.trim(),
                              color: newCategoryColor,
                            };
                            setCategories((prev) => [...prev, newCategory]);
                            setSelectedCategory(newCategory);
                            setNewCategoryName('');
                          }
                          setShowAddCategoryForm(false);
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save Category</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>

                {/* Modal Bottom Buttons */}
                <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => {
                    resetEventForm();   // 🔥 clear everything
                    collapseAllPickers();
                    setShowModal(false); // 🔥 then close modal
                  }}
                >
                  <Text style={styles.cancel}>Cancel</Text>
                </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveEvent}>
                    <Text style={styles.save}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

     {showEditEventModal && (
      <Modal animationType="slide" transparent={true} visible={showEditEventModal}>
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
                    contentContainerStyle={{ paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                  >

                  <Text style={styles.modalTitle}>Edit Event</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      if (editedRepeatOption === 'Custom') {
                        setEditedRepeatOption('None');
                      } else {
                        setEditedRepeatOption('Custom');
                      }
                    }}
                  >
                    <Text style={[styles.modalSubtitle, { color: '#6F4E37' }]}>
                      {editedRepeatOption === 'Custom' ? 'Custom Dates' : editedStartDateTime.toDateString()}
                    </Text>
                  </TouchableOpacity>

                  {editedRepeatOption !== 'Custom' ? (
                    <>
                      {/* Title */}
                      <TextInput
                        style={styles.inputTitle}
                        placeholder="Title"
                        value={editedEventTitle}
                        onChangeText={setEditedEventTitle}
                      />

                      {/* Description */}
                      <TextInput
                        style={styles.inputDescription}
                        placeholder="Description"
                        value={editedEventDescription}
                        onChangeText={setEditedEventDescription}
                        multiline
                      />

                      {/* 🕓 Starts */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ display: 'none' }}>🕓 Starts</Text>
                        <TouchableOpacity
                          onPress={() => setShowStartPicker(prev => !prev)}
                          style={styles.inlineSettingRow}
                        >
                          <Ionicons name="play-outline" size={22} color="#666" />
                          <Text style={styles.inlineSettingText}>
                            {editedStartDateTime.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </TouchableOpacity>

                        {showStartPicker && (
                          <Animated.View style={styles.dateTimePickerContainer}>
                            <DateTimePicker
                              value={editedStartDateTime}
                              mode="datetime"
                              display="spinner"
                              onChange={(event, selectedDate) => {
                                if (selectedDate) {
                                  setEditedStartDateTime(selectedDate);
                                  if (!userChangedEditedEndTime) {
                                    setEditedEndDateTime(new Date(selectedDate.getTime() + 60 * 60 * 1000));
                                  }
                                }
                                setShowStartPicker(false);
                              }}
                              style={styles.dateTimePicker}
                            />
                          </Animated.View>
                        )}
                      </View>

                      {/* Ends */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ display: 'none' }}>🛑 Ends</Text>
                        <TouchableOpacity
                          onPress={() => setShowEndPicker(prev => !prev)}
                          style={styles.inlineSettingRow}
                        >
                          <Ionicons name="caret-back-outline" size={22} color="#666" />
                          <Text style={styles.inlineSettingText}>
                            {editedEndDateTime.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </TouchableOpacity>

                        {showEndPicker && (
                          <Animated.View style={styles.dateTimePickerContainer}>
                            <DateTimePicker
                              value={editedEndDateTime}
                              mode="datetime"
                              display="spinner"
                              onChange={(event, selectedDate) => {
                                if (selectedDate) {
                                  setEditedEndDateTime(selectedDate);
                                  setUserChangedEditedEndTime(true);
                                }
                                setShowEndPicker(false);
                              }}
                              style={styles.dateTimePicker}
                            />
                          </Animated.View>
                        )}
                      </View>

                      {/* Set Category */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ display: 'none' }}>🗂 Set Category</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setShowCategoryPicker(prev => !prev);
                            if (showCategoryPicker) {
                              setShowAddCategoryForm(false);
                              setNewCategoryName('');
                              setNewCategoryColor('#FADADD');
                            }
                          }}
                          style={styles.inlineSettingRow}
                        >
                          <MaterialIcons name="colorize" size={22} color={editedSelectedCategory ? editedSelectedCategory.color : '#666'} />
                          <Text style={[styles.inlineSettingText, { color: editedSelectedCategory ? editedSelectedCategory.color : '#000' }]}>
                            {editedSelectedCategory ? editedSelectedCategory.name : 'Set Category'}
                          </Text>

                          {editedSelectedCategory && (
                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); setEditedSelectedCategory(null); }} style={{ marginLeft: 8 }}>
                              <Text style={{ fontSize: 12, color: '#aaa' }}>✕</Text>
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>

                        {showCategoryPicker && (
                          <Animated.View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                            {categories.map((cat, idx) => (
                              <TouchableOpacity
                                key={idx}
                                onPress={() => {
                                  setEditedSelectedCategory(cat);
                                  setShowCategoryPicker(false);
                                  setShowAddCategoryForm(false); // Add this line
                                }}
                                style={{
                                  backgroundColor: cat.color,
                                  paddingVertical: 6,
                                  paddingHorizontal: 12,
                                  borderRadius: 20,
                                  marginRight: 8,
                                  marginBottom: 8,
                                  marginTop: 1,
                                  borderWidth: editedSelectedCategory?.name === cat.name && editedSelectedCategory?.color === cat.color ? 1.4 : 0,
                                  borderColor: editedSelectedCategory?.name === cat.name && editedSelectedCategory?.color === cat.color ? '#333' : 'transparent',
                                }}
                              >
                                <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>{cat.name}</Text>
                              </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                              onPress={() => setShowAddCategoryForm(true)}
                              style={{
                                backgroundColor: '#ccc',
                                paddingVertical: 5,
                                paddingHorizontal: 12,
                                borderRadius: 20,
                                marginBottom: 8,
                                flexDirection: 'row',
                                alignItems: 'center',
                              }}
                            >
                              <Ionicons name="add" size={16} color="#333" />
                            </TouchableOpacity>
                          </Animated.View>
                        )}
                      </View>

                      {/* Set Reminder */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ display: 'none' }}>🕑 Set Reminder</Text>
                        <TouchableOpacity
                          onPress={() => setShowReminderPicker(prev => !prev)}
                          style={styles.inlineSettingRow}
                        >
                          <Ionicons name="time-outline" size={22} color="#666" />
                          <Text style={styles.inlineSettingText}>
                            {editedReminderTime ? editedReminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Set Reminder'}
                          </Text>
                        </TouchableOpacity>

                        {showReminderPicker && (
                          <Animated.View style={styles.dateTimePickerContainer}>
                            <DateTimePicker
                              value={editedReminderTime || new Date()}
                              mode="time"
                              display="spinner"
                              onChange={(event, selectedTime) => {
                                if (selectedTime) {
                                  setEditedReminderTime(selectedTime);
                                }
                                setShowReminderPicker(false);
                              }}
                              style={styles.dateTimePicker}
                            />
                          </Animated.View>
                        )}
                      </View>

                      {/* Set Repeat */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ display: 'none' }}>🔁 Set Repeat</Text>
                        <TouchableOpacity
                          onPress={() => setShowRepeatPicker(prev => !prev)}
                          style={styles.inlineSettingRow}
                        >
                          <Ionicons name="repeat" size={22} color="#666" />
                          <Text style={styles.inlineSettingText}>
                            {editedRepeatOption !== 'None' ? editedRepeatOption : 'Set Repeat'}
                          </Text>
                        </TouchableOpacity>

                        {showRepeatPicker && (
                          <Animated.View style={{ marginTop: 10 }}>
                            {['Daily', 'Weekly', 'Monthly', 'Yearly'].map((option) => (
                              <TouchableOpacity
                                key={option}
                                onPress={() => {
                                  setEditedRepeatOption(option as 'Daily' | 'Weekly' | 'Monthly' | 'Yearly');
                                  setShowRepeatPicker(false);
                                }}
                                style={{ paddingVertical: 8 }}
                              >
                                <Text style={{ fontSize: 16, color: '#333', paddingLeft: 32 }}>
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
                        value={editedEventTitle}
                        onChangeText={setEditedEventTitle}
                      />

                      {/* Set Category */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ display: 'none' }}>🗂 Set Category</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setShowCategoryPicker(prev => !prev);
                            if (showCategoryPicker) {
                              setShowAddCategoryForm(false);
                              setNewCategoryName('');
                              setNewCategoryColor('#FADADD');
                            }
                          }}
                          style={styles.inlineSettingRow}
                        >
                          <MaterialIcons name="colorize" size={22} color={editedSelectedCategory ? editedSelectedCategory.color : '#666'} />
                          <Text style={[styles.inlineSettingText, { color: editedSelectedCategory ? editedSelectedCategory.color : '#000' }]}>
                            {editedSelectedCategory ? editedSelectedCategory.name : 'Set Category'}
                          </Text>

                          {editedSelectedCategory && (
                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); setEditedSelectedCategory(null); }} style={{ marginLeft: 8 }}>
                              <Text style={{ fontSize: 12, color: '#aaa' }}>✕</Text>
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>

                        {showCategoryPicker && (
                          <Animated.View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                            {categories.map((cat, idx) => (
                              <TouchableOpacity
                                key={idx}
                                onPress={() => {
                                  setEditedSelectedCategory(cat);
                                  setShowCategoryPicker(false);
                                  setShowAddCategoryForm(false); // Add this line
                                }}
                                style={{
                                  backgroundColor: cat.color,
                                  paddingVertical: 6,
                                  paddingHorizontal: 12,
                                  borderRadius: 20,
                                  marginRight: 8,
                                  marginBottom: 8,
                                  marginTop: 1,
                                  borderWidth: editedSelectedCategory?.name === cat.name && editedSelectedCategory?.color === cat.color ? 1.4 : 0,
                                  borderColor: editedSelectedCategory?.name === cat.name && editedSelectedCategory?.color === cat.color ? '#333' : 'transparent',
                                }}
                              >
                                <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>{cat.name}</Text>
                              </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                              onPress={() => setShowAddCategoryForm(true)}
                              style={{
                                backgroundColor: '#ccc',
                                paddingVertical: 5,
                                paddingHorizontal: 12,
                                borderRadius: 20,
                                marginBottom: 8,
                                flexDirection: 'row',
                                alignItems: 'center',
                              }}
                            >
                              <Ionicons name="add" size={16} color="#333" />
                            </TouchableOpacity>
                          </Animated.View>
                        )}
                      </View>

                      {/* 📅 Pick Dates */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ display: 'none' }}>📅 Pick Dates</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setShowEditEventModal(false);
                            setTimeout(() => {
                              setShowCustomDatesPicker(true);
                            }, 300);
                          }}
                          style={styles.inlineSettingRow}
                        >
                          <Ionicons name="calendar-outline" size={22} color="#666" />
                          <Text style={styles.inlineSettingText}>
                            Pick Dates {customSelectedDates.length > 0 ? `(${customSelectedDates.length} selected)` : ''}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  <View style={styles.modalActions}>
                    <TouchableOpacity onPress={() => setShowEditEventModal(false)}>
                      <Text style={styles.cancel}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                     onPress={async () => {
                      if (selectedEvent) {
                        const updatedEvents = { ...events };
                        const { dateKey, index } = selectedEvent;
                        
                        // Remove the event from all dates it was previously on
                        Object.keys(updatedEvents).forEach(key => {
                          updatedEvents[key] = updatedEvents[key].filter(event => event.id !== selectedEvent.event.id);
                          if (updatedEvents[key].length === 0) {
                            delete updatedEvents[key];
                          }
                        });

                        // If it's a custom repeat event, create events only on the selected custom dates
                        if (editedRepeatOption === 'Custom' && customSelectedDates.length > 0) {
                          customSelectedDates.forEach(dateStr => {
                            if (!updatedEvents[dateStr]) updatedEvents[dateStr] = [];
                            updatedEvents[dateStr].push({
                              id: selectedEvent.event.id,
                              title: editedEventTitle,
                              description: editedEventDescription,
                              date: dateStr,
                              startDateTime: editedStartDateTime,
                              endDateTime: editedEndDateTime,
                              categoryName: editedSelectedCategory?.name ?? '',
                              categoryColor: editedSelectedCategory?.color ?? '',
                              reminderTime: editedReminderTime || undefined,
                              repeatOption: editedRepeatOption,
                              repeatEndDate: editedRepeatEndDate || undefined,
                              customDates: customSelectedDates,
                            });
                          });
                        } else {
                          // For non-custom repeat events, create events across the date range
                          let currentDate = new Date(editedStartDateTime);
                          const end = new Date(editedEndDateTime);
                          let isFirstDay = true;

                          while (currentDate <= end) {
                            const newDateKey = getLocalDateString(currentDate);
                            if (!updatedEvents[newDateKey]) updatedEvents[newDateKey] = [];

                            updatedEvents[newDateKey].push({
                              id: selectedEvent.event.id,
                              title: editedEventTitle,
                              description: editedEventDescription,
                              date: newDateKey,
                              startDateTime: editedStartDateTime,
                              endDateTime: editedEndDateTime,
                              categoryName: editedSelectedCategory?.name ?? '',
                              categoryColor: editedSelectedCategory?.color ?? '',
                              reminderTime: editedReminderTime || undefined,
                              repeatOption: editedRepeatOption,
                              repeatEndDate: editedRepeatEndDate || undefined,
                              isContinued: !isFirstDay,
                            });

                            isFirstDay = false;
                            currentDate.setDate(currentDate.getDate() + 1);
                          }
                        }

                        // Update the event in the database
                        const { error } = await supabase
                          .from('events')
                          .update({
                            title: editedEventTitle,
                            description: editedEventDescription,
                            date: getLocalDateString(editedStartDateTime),
                            start_datetime: editedStartDateTime.toISOString(),
                            end_datetime: editedEndDateTime.toISOString(),
                            category_name: editedSelectedCategory?.name ?? null,
                            category_color: editedSelectedCategory?.color ?? null,
                            reminder_time: editedReminderTime?.toISOString() ?? null,
                            repeat_option: editedRepeatOption,
                            repeat_end_date: editedRepeatEndDate?.toISOString() ?? null,
                            custom_dates: editedRepeatOption === 'Custom' ? customSelectedDates : null,
                          })
                          .eq('id', selectedEvent.event.id);

                        if (error) {
                          console.error('Error updating event:', error);
                          return;
                        }

                        setEvents(updatedEvents);
                      }
                      
                      setUserChangedEndTime(false);
                      setShowEditEventModal(false);
                     }}
                    >
                      <Text style={styles.save}>Save</Text>
                    </TouchableOpacity>
                  </View>
                  </ScrollView>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>
      )}
        <Modal
          visible={showCustomDatesPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCustomDatesPicker(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPressOut={() => setShowCustomDatesPicker(false)}
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.3)',
              justifyContent: 'flex-end',
            }}
          >
            <View style={{
              backgroundColor: '#fff',
              padding: 20,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}>
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
                  }
                }}
                markedDates={Object.fromEntries(
                  customSelectedDates.map((date) => [
                    date,
                    { 
                      selected: true,
                      selectedColor: '#BF9264',
                      selectedTextColor: '#fff'
                    },
                  ])
                )}
                style={{
                  width: '100%',
                }}
                theme={{
                  'stylesheet.calendar.header': {
                    header: {
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                    },
                    monthText: {
                      fontSize: 16,
                      fontWeight: '600',
                      marginRight: 4,
                    },
                    arrow: {
                      paddingVertical: 18,
                      paddingHorizontal: 60,
                    },
                    arrowImage: {
                      tintColor: '#BF9264',
                    },
                  },
                  todayTextColor: '#BF9264',
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
                      textAlign: 'center',
                    },
                    selected: {
                      backgroundColor: '#BF9264',
                      borderRadius: 16,
                    },
                    selectedText: {
                      color: '#fff',
                      fontWeight: '600',
                    },
                  },
                  'stylesheet.calendar.main': {
                    dayContainer: {
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  },
                }}
              />

              {/* Time Picker */}
              <View style={{ marginTop: 20, marginBottom: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#333' }}>Default Event Time</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontSize: 14, color: '#666', marginBottom: 5 }}>Start</Text>
                    <TouchableOpacity
                      onPress={() => setShowStartPicker(true)}
                      style={{
                        borderWidth: 1,
                        borderColor: '#ddd',
                        borderRadius: 8,
                        padding: 10,
                        alignItems: 'center'
                      }}
                    >
                      <Text style={{ fontSize: 16, color: '#333' }}>
                        {startDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: '#666', marginBottom: 5 }}>End</Text>
                    <TouchableOpacity
                      onPress={() => setShowEndPicker(true)}
                      style={{
                        borderWidth: 1,
                        borderColor: '#ddd',
                        borderRadius: 8,
                        padding: 10,
                        alignItems: 'center'
                      }}
                    >
                      <Text style={{ fontSize: 16, color: '#333' }}>
                        {endDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {showStartPicker && (
                  <Animated.View style={styles.dateTimePickerContainer}>
                    <DateTimePicker
                      value={startDateTime}
                      mode="time"
                      display="spinner"
                      onChange={(event, selectedTime) => {
                        if (selectedTime) {
                          setStartDateTime(selectedTime);
                          if (!userChangedEndTime) {
                            setEndDateTime(new Date(selectedTime.getTime() + 60 * 60 * 1000));
                          }
                        }
                        setShowStartPicker(false);
                      }}
                      style={styles.dateTimePicker}
                    />
                  </Animated.View>
                )}

                {showEndPicker && (
                  <Animated.View style={styles.dateTimePickerContainer}>
                    <DateTimePicker
                      value={endDateTime}
                      mode="time"
                      display="spinner"
                      onChange={(event, selectedTime) => {
                        if (selectedTime) {
                          setEndDateTime(selectedTime);
                          setUserChangedEndTime(true);
                        }
                        setShowEndPicker(false);
                      }}
                      style={styles.dateTimePicker}
                    />
                  </Animated.View>
                )}
              </View>

              {/* Custom Time for Selected Date */}
              {selectedDateForCustomTime && (
                <View style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#333' }}>
                      Time for {new Date(selectedDateForCustomTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
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
                        backgroundColor: '#6F4E37',
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 6
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 12 }}>Save</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ fontSize: 14, color: '#666', marginBottom: 5 }}>Start</Text>
                      <TouchableOpacity
                        onPress={() => setShowCustomStartPicker(true)}
                        style={{
                          borderWidth: 1,
                          borderColor: '#ddd',
                          borderRadius: 8,
                          padding: 10,
                          alignItems: 'center'
                        }}
                      >
                        <Text style={{ fontSize: 16, color: '#333' }}>
                          {customStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: '#666', marginBottom: 5 }}>End</Text>
                      <TouchableOpacity
                        onPress={() => setShowCustomEndPicker(true)}
                        style={{
                          borderWidth: 1,
                          borderColor: '#ddd',
                          borderRadius: 8,
                          padding: 10,
                          alignItems: 'center'
                        }}
                      >
                        <Text style={{ fontSize: 16, color: '#333' }}>
                          {customEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {showCustomStartPicker && (
                    <Animated.View style={styles.dateTimePickerContainer}>
                      <DateTimePicker
                        value={customStartTime}
                        mode="time"
                        display="spinner"
                        onChange={(event, selectedTime) => {
                          if (selectedTime) {
                            setCustomStartTime(selectedTime);
                            setCustomEndTime(new Date(selectedTime.getTime() + 60 * 60 * 1000));
                          }
                          setShowCustomStartPicker(false);
                        }}
                        style={styles.dateTimePicker}
                      />
                    </Animated.View>
                  )}

                  {showCustomEndPicker && (
                    <Animated.View style={styles.dateTimePickerContainer}>
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
                        style={styles.dateTimePicker}
                      />
                    </Animated.View>
                  )}
                </View>
              )}

              {/* Custom Times List */}
              {Object.keys(customDateTimes).length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#333' }}>Custom Times</Text>
                  {Object.entries(customDateTimes).map(([date, times]) => (
                    <View key={date} style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      backgroundColor: '#f5f5f5',
                      padding: 10,
                      borderRadius: 8,
                      marginBottom: 8
                    }}>
                      <Text style={{ fontSize: 14, color: '#666' }}>
                        {new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, color: '#333', marginRight: 10 }}>
                          {times.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={{ fontSize: 14, color: '#666' }}>to</Text>
                        <Text style={{ fontSize: 14, color: '#333', marginLeft: 10 }}>
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
                          style={{ marginLeft: 10 }}
                        >
                          <Text style={{ color: '#ff4444' }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                onPress={() => {
                  setShowCustomDatesPicker(false);
                  setTimeout(() => {
                    if (isEditingEvent) {
                      setShowEditEventModal(true);
                    } else {
                      setShowModal(true);
                    }
                  }, 300);
                }}
                style={{
                  backgroundColor: '#6F4E37',
                  padding: 12,
                  paddingHorizontal: 24,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '600' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
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
