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
import DateTimePickerModal from 'react-native-modal-datetime-picker';


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
      marginBottom: 18
  },
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: 'white',
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
  eventBox: {
    flexDirection: 'column', 
    justifyContent: 'flex-start', 
    alignItems: 'center',
    marginTop: 3,
    width: '100%',
    paddingHorizontal: 1,
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
    paddingHorizontal: 0.5,
    // borderLeftWidth: 2,
    // borderLeftColor: event.categoryColor || '#FF9A8B',
    //opacity: event.isContinued ? 0.7 : 1,
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
    fontSize: 10,
    color: '#333',
    marginTop: 2,
    paddingRight: 2,
    fontFamily: 'Onest',
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
customTimePicker: {
  height: 100,
  overflow: 'hidden',
  width: '100%',
  borderRadius: 16,
  paddingVertical: 8,
  paddingHorizontal: 16,
  marginBottom: 4,
  alignItems: 'center',
  justifyContent: 'center',
},
  addCategoryForm: {
    backgroundColor: '#fafafa',
    padding: 2,
    borderRadius: 12,
    marginTop: 8,
    width: '100%',
  },
  addCategoryInput: {
    fontSize: 13,
    color: '#3a3a3a',
    fontFamily: 'Onest',
    marginBottom: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryDot: {
    width: 6, 
    height: 6, 
    borderRadius: 3, 
  },
  categoryText: {
    fontSize: 12, 
    color: '#3a3a3a',
    fontFamily: 'Onest',
    fontWeight: '500'
  },
  selectedCategoryDot: {
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    marginRight: 8
  },
  selectedCategoryText: {
    fontSize: 13, 
    color: '#3a3a3a',
    fontFamily: 'Onest',
    fontWeight: '500'
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
    flex:1,
    marginBottom: 20,
  },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateTimeColumn: {
    flex: 1,
    marginRight: 12,
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
    fontSize: 13,
    color: '#3a3a3a',
    fontFamily: 'Onest',
    fontWeight: '500'
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
  featureButton: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 2,
    alignItems: 'center',
    marginBottom: 15,
  },
  featureButtonText: {
    fontSize: 12, 
    color: '#3a3a3a',
    fontFamily: 'Onest',
    fontWeight: '500'
  },
  customTimeBox: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#eee',
  },
  selectedTimeBox: {
    backgroundColor: '#fff',
    borderColor: '#FF9A8B',
    borderWidth: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Onest',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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

const CalendarScreen: React.FC = (): JSX.Element => {
  const today = new Date();
  const [currentMonthIndex, setCurrentMonthIndex] = useState(12); // center month in 25-month buffer
  const flatListRef = useRef<FlatList>(null);
  const weeklyCalendarRef = useRef<WeeklyCalendarViewRef>(null);

  // Add nextTimeBoxId state
  const [nextTimeBoxId, setNextTimeBoxId] = useState<number>(1);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const getLocalDateString = (date: Date) => {
    console.log('getLocalDateString input:', {
      date: date.toISOString(),
      localDate: date.toLocaleDateString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const result = `${year}-${month}-${day}`;
    console.log('getLocalDateString output:', result);
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
  const [userChangedEditedEndTime, setUserChangedEditedEndTime] = useState(false);
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
      try {
        if (!user?.id) {
          console.log('No user ID available, skipping event fetch');
          return;
        }

        console.log('Fetching events for user:', user.id);
        const { data: eventsData, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching events:', error);
          return;
        }

        console.log('Fetched events from database:', eventsData?.length || 0);

        // Transform the events data into our local format
        const transformedEvents = eventsData?.reduce((acc, event) => {
          // Parse UTC dates
          const parseDate = (dateStr: string | null) => {
            if (!dateStr) return null;
            // Create date object from UTC string
            return new Date(dateStr);
          };

          const startDateTime = event.start_datetime ? parseDate(event.start_datetime) : undefined;
          const endDateTime = event.end_datetime ? parseDate(event.end_datetime) : undefined;
          const reminderTime = event.reminder_time ? parseDate(event.reminder_time) : null;
          const repeatEndDate = event.repeat_end_date ? parseDate(event.repeat_end_date) : null;

          // Convert custom times if they exist
          let customTimes;
          if (event.custom_times) {
            customTimes = Object.entries(event.custom_times).reduce((acc, [date, times]: [string, any]) => ({
              ...acc,
              [date]: {
                start: parseDate(times.start),
                end: parseDate(times.end),
                reminder: times.reminder ? parseDate(times.reminder) : null,
                repeat: times.repeat
              }
            }), {});
          }

          const transformedEvent = {
            id: event.id,
            title: event.title,
            description: event.description,
            date: event.date,
            startDateTime,
            endDateTime,
            categoryName: event.category_name,
            categoryColor: event.category_color,
            reminderTime,
            repeatOption: event.repeat_option,
            repeatEndDate,
            customDates: event.custom_dates,
            customTimes,
            isAllDay: event.is_all_day
          };

          console.log('Transformed event:', {
            id: transformedEvent.id,
            date: transformedEvent.date,
            start: transformedEvent.startDateTime?.toString(),
            end: transformedEvent.endDateTime?.toString()
          });

          // For custom events, add to all custom dates
          if (transformedEvent.customDates && transformedEvent.customDates.length > 0) {
            transformedEvent.customDates.forEach((date: string) => {
              if (!acc[date]) {
                acc[date] = [];
              }
              acc[date].push(transformedEvent);
            });
          } else {
            // For regular events, add to the primary date
            if (!acc[transformedEvent.date]) {
              acc[transformedEvent.date] = [];
            }
            acc[transformedEvent.date].push(transformedEvent);
          }

          return acc;
        }, {} as { [date: string]: CalendarEvent[] });

        console.log('Transformed events object:', {
          dates: Object.keys(transformedEvents),
          totalEvents: (Object.values(transformedEvents) as CalendarEvent[][]).reduce<number>((sum: number, events: CalendarEvent[]) => sum + events.length, 0)
        });

        setEvents(transformedEvents);
      } catch (error) {
        console.error('Error in fetchEvents:', error);
      }
    };
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
    resetToggleStates();
  };

  const handleSaveEvent = async (customEvent?: CalendarEvent) => {
    try {
      // Format date to UTC ISO string
      const formatDateToUTC = (date: Date) => {
        // Get UTC components
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
      };

      console.log('Event Save - Date Handling:', {
        startDateTime: formatDateToUTC(startDateTime),
        endDateTime: formatDateToUTC(endDateTime),
        selectedDate: formatDateToUTC(selectedDate),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      
      const eventToSave = customEvent || {
        id: Date.now().toString(),
        title: newEventTitle,
        description: newEventDescription,
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
        }, {} as { [date: string]: { start: Date; end: Date; reminder: Date | null; repeat: RepeatOption } })
      };

      console.log('Event Save - Event Object Before Save:', {
        eventDate: eventToSave.date,
        startDateTime: eventToSave.startDateTime?.toISOString(),
        endDateTime: eventToSave.endDateTime?.toISOString(),
        customDates: eventToSave.customDates,
        isAllDay: eventToSave.isAllDay
      });

      // Prepare the database data with UTC dates
      const dbData = {
        title: eventToSave.title,
        description: eventToSave.description,
        date: eventToSave.date,
        start_datetime: formatDateToUTC(eventToSave.startDateTime!),
        end_datetime: formatDateToUTC(eventToSave.endDateTime!),
        category_name: eventToSave.categoryName || null,
        category_color: eventToSave.categoryColor || null,
        reminder_time: eventToSave.reminderTime ? formatDateToUTC(eventToSave.reminderTime) : null,
        repeat_option: eventToSave.customDates && eventToSave.customDates.length > 0 ? 'Custom' : eventToSave.repeatOption,
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
        user_id: user?.id
      };

      console.log('Event Save - Database Data:', {
        date: dbData.date,
        start_datetime: dbData.start_datetime,
        end_datetime: dbData.end_datetime,
        is_all_day: dbData.is_all_day
      });

      let error;
      // If we have an ID and it's not a new event (editingEvent exists), update the existing event
      if (eventToSave.id && editingEvent) {
        console.log('Event Save - Updating Existing Event:', {
          eventId: eventToSave.id,
          oldDate: editingEvent.date,
          newDate: eventToSave.date
        });
        
        // First remove the old event from all its dates
        setEvents(prev => {
          const updated = { ...prev };
          editingEvent.customDates?.forEach((date: string) => {
            if (updated[date]) {
              updated[date] = updated[date].filter(e => e.id !== editingEvent.id);
              if (updated[date].length === 0) {
                delete updated[date];
              }
            }
          });
          return updated;
        });

        // Update the event in the database
        const { error: updateError } = await supabase
          .from('events')
          .update(dbData)
          .eq('id', eventToSave.id);

        error = updateError;
      } else {
        console.log('Event Save - Creating New Event');
        // Insert new event
        const { error: insertError } = await supabase
          .from('events')
          .insert([dbData]);

        error = insertError;
      }

      if (error) {
        console.error('Event Save - Database Error:', error);
        throw error;
      }

      // Update local state
      setEvents(prev => {
        const updated = { ...prev };
        // For custom events, add to all custom dates
        if (eventToSave.customDates && eventToSave.customDates.length > 0) {
          console.log('Event Save - Adding to Custom Dates:', eventToSave.customDates);
          eventToSave.customDates.forEach(date => {
            if (!updated[date]) {
              updated[date] = [];
            }
            // Remove any existing event with the same ID
            updated[date] = updated[date].filter(e => e.id !== eventToSave.id);
            updated[date].push(eventToSave);
          });
        } else {
          // For regular events, add to the primary date
          const dateKey = eventToSave.date;
          console.log('Event Save - Adding to Primary Date:', dateKey);
          if (!updated[dateKey]) {
            updated[dateKey] = [];
          }
          // Remove any existing event with the same ID
          updated[dateKey] = updated[dateKey].filter(e => e.id !== eventToSave.id);
          updated[dateKey].push(eventToSave);
        }
        return updated;
      });

      // Reset form and close modal
      resetEventForm();
      setShowModal(false);
      setShowCustomDatesPicker(false);
      setEditingEvent(null);

      Toast.show({
        type: 'success',
        text1: editingEvent ? 'Event updated successfully' : 'Event created successfully',
        position: 'bottom',
      });
    } catch (error) {
      console.error('Error saving event:', error);
      Alert.alert('Error', 'Failed to save event. Please try again.');
    }
  };
  
  const renderMonth = ({ item }: { item: ReturnType<typeof getMonthData> }) => {
    const { year, month, days } = item;
    const needsSixRowsThisMonth = item.days.length > 35;

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
                          height: 22,
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
                          <View style={styles.eventBox}>
                            {dayEvents.map((event, eventIndex) => (
                              <TouchableOpacity
                                key={`${event.id}-${eventIndex}`}
                                onPress={() => {
                                  setSelectedEvent({ event, dateKey: event.date, index: eventIndex });
                                  setEditingEvent(event);  // Add this line to set the editingEvent
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
                                onLongPress={() => handleLongPress(event)}
                                style={[
                                  styles.eventBoxText,
                                  {
                                    backgroundColor: `${event.categoryColor || '#FF9A8B'}40`,
                                    borderLeftColor: event.categoryColor || '#FF9A8B',
                                  }
                                ]}
                              >
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    fontSize: 11,
                                    color: '#3A3A3A',
                                    flex: 1,
                                    fontFamily: 'Onest',
                                    textAlign: event.isContinued ? 'left' : 'center'
                                  }}
                                >
                                  {event.isContinued ? '' : event.title}
                                </Text>
                              </TouchableOpacity>
                            ))}
                           
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

  const handleLongPress = (event: CalendarEvent) => {
    if (event.customDates && event.customDates.length > 0) {
      // Handle custom event
      setEditingEvent(event);
      setIsEditingEvent(true);
      setCustomModalTitle(event.title);
      setCustomModalDescription(event.description || '');
      setSelectedCategory(categories.find(cat => cat.name === event.categoryName) || null);
      
      // Set up custom times by grouping dates with the same time settings
      const customTimes: CustomTimes = {};
      const timeSettingsMap = new Map<string, string[]>(); // Map to group dates by their time settings

      // First, group dates by their time settings
      event.customDates.forEach(date => {
        const timeData = event.customTimes?.[date];
        const startTime = timeData ? new Date(timeData.start) : new Date(event.startDateTime!);
        const endTime = timeData ? new Date(timeData.end) : new Date(event.endDateTime!);
        const reminderTime = timeData?.reminder ? new Date(timeData.reminder) : (event.reminderTime ? new Date(event.reminderTime) : null);
        const repeat = timeData?.repeat || event.repeatOption || 'None';

        // Create a unique key for this time setting
        const timeKey = `${startTime.toISOString()}_${endTime.toISOString()}_${reminderTime?.toISOString() || 'null'}_${repeat}`;
        
        if (!timeSettingsMap.has(timeKey)) {
          timeSettingsMap.set(timeKey, []);
        }
        timeSettingsMap.get(timeKey)!.push(date);
      });

      // Then create time boxes for each unique time setting
      let timeBoxIndex = 0;
      timeSettingsMap.forEach((dates, timeKey) => {
        const [startStr, endStr, reminderStr, repeat] = timeKey.split('_');
        const timeBoxKey = `time_${timeBoxIndex++}`;
        
        customTimes[timeBoxKey] = {
          start: new Date(startStr),
          end: new Date(endStr),
          reminder: reminderStr === 'null' ? null : new Date(reminderStr),
          repeat: repeat as RepeatOption,
          dates: dates
        };
      });

      setCustomDateTimes(customTimes);
      setCustomSelectedDates(event.customDates);
      setShowCustomDatesPicker(true);
    } else {
      // Handle regular event
      setSelectedEvent({ event, dateKey: event.date, index: 0 });
      setEditingEvent(event);  // Add this line
      setEditedEventTitle(event.title);
      setEditedEventDescription(event.description ?? '');
      setEditedStartDateTime(new Date(event.startDateTime!));
      setEditedEndDateTime(new Date(event.endDateTime!));
      setEditedSelectedCategory(event.categoryName ? { name: event.categoryName, color: event.categoryColor! } : null);
      setEditedReminderTime(event.reminderTime ? new Date(event.reminderTime) : null);
      setEditedRepeatOption(event.repeatOption || 'None');
      setEditedRepeatEndDate(event.repeatEndDate ? new Date(event.repeatEndDate) : null);
      setShowEditEventModal(true);
    }
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
  const handleTimeSelection = (selectedDate: Date | null | undefined, field: 'start' | 'end') => {
    if (!selectedDate || !editingTimeBoxId || !customDateTimes[editingTimeBoxId]) return;

    const currentTimeBox = customDateTimes[editingTimeBoxId];
    const currentDate = currentTimeBox[field] || new Date();
    const newDate = new Date(currentDate);
    
    // Update only the time portion
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

    // Update temporary state for preview
    setTempTimeBox(updatedTimeBox);
  };

  // Add this function to save time changes
  const saveTimeChanges = () => {
    if (!tempTimeBox || !editingTimeBoxId) return;

    setCustomDateTimes(prev => ({
      ...prev,
      [editingTimeBoxId]: tempTimeBox
    }));

    // Reset states
    setTempTimeBox(null);
    setIsTimePickerVisible(false);
    setCurrentEditingField('start');
  };

  // Add this function to cancel time changes
  const cancelTimeChanges = () => {
    setTempTimeBox(null);
    setIsTimePickerVisible(false);
    setCurrentEditingField('start');
  };

  const handleEditEvent = async () => {
    if (!selectedEvent) return;
    if (!editedEventTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for the event');
      return;
    }

    try {
      // Create a new event object with the edited data
      const editedEvent: CalendarEvent = {
        id: selectedEvent.event.id,  // Use the original event's ID
        title: editedEventTitle,
        description: editedEventDescription || '',
        date: getLocalDateString(editedStartDateTime),
        startDateTime: editedStartDateTime,
        endDateTime: editedEndDateTime,
        categoryName: editedSelectedCategory?.name || '',
        categoryColor: editedSelectedCategory?.color || '#FF9A8B',
        reminderTime: editedReminderTime,
        repeatOption: editedRepeatOption,
        repeatEndDate: editedRepeatEndDate,
        isAllDay: isEditedAllDay,
        customDates: editedRepeatOption === 'Custom' ? customSelectedDates : undefined,
        customTimes: editedRepeatOption === 'Custom' ? customDateTimes : undefined,
        isContinued: false
      };

      // Use the main handleSaveEvent function with the edited event
      await handleSaveEvent(editedEvent);

      // Reset edit form state
      setShowEditEventModal(false);
      setSelectedEvent(null);
      setEditingEvent(null);  // Add this line to clear the editingEvent state
      setEditedEventTitle('');
      setEditedEventDescription('');
      setEditedStartDateTime(new Date());
      setEditedEndDateTime(new Date());
      setEditedSelectedCategory(null);
      setEditedReminderTime(null);
      setEditedRepeatOption('None');
      setEditedRepeatEndDate(null);
      setIsEditedAllDay(false);
      setCustomSelectedDates([]);
      setCustomDateTimes({
        default: {
          start: startDateTime,
          end: endDateTime,
          reminder: reminderTime,
          repeat: 'None',
          dates: [getLocalDateString(startDateTime)]
        }
      });
    } catch (error) {
      console.error('Error updating event:', error);
      Alert.alert('Error', 'Failed to update event. Please try again.');
    }
  };

  return (
    <>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
        {calendarMode === 'month' ? (
          <View style={{ flex: 1, flexDirection: 'column' }}>
            {/* Fixed Header */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => setCalendarMode('week')}>
                <MaterialIcons 
                  name="calendar-view-week"
                  size={20} 
                  color="#333"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (calendarMode === 'month') {
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
                    const today = new Date();
                    setSelectedDate(today);
                    setVisibleWeekMonth(today);
                    weeklyCalendarRef.current?.scrollToWeek?.(today);
                  }
                }}
              >
                <Text style={styles.monthLabel}>
                  {new Date(months[currentMonthIndex].year, months[currentMonthIndex].month).toLocaleString('en-US', {
                    month: 'long',
                    year: 'numeric'
                  })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  resetEventForm();
                  setShowModal(true);
                }}>
                <MaterialIcons name="add" size={22} color="#3a3a3a" />
              </TouchableOpacity>
            </View>

            {/* Scrollable Calendar Grid */}
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
                style={{ flex: 1 }}
                onScroll={(event) => {
                  const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  if (newIndex !== currentMonthIndex) {
                    setCurrentMonthIndex(newIndex);
                  }
                }}
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
                          setEditingEvent(event);  // Add this line
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
                        onLongPress={() => handleLongPress(event)}
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
          <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
            {/* Fixed Header */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => setCalendarMode('month')}>
                <MaterialIcons 
                  name="calendar-view-month"
                  size={20} 
                  color="#333"
                />
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => {
                  const today = new Date();
                  setSelectedDate(today);
                  setVisibleWeekMonth(today);
                  weeklyCalendarRef.current?.scrollToWeek?.(today);
                }}>
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
                        year: 'numeric'
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

              <TouchableOpacity
                onPress={() => {
                  resetEventForm();
                  setShowModal(true);
                }}>
                <MaterialIcons name="add" size={22} color="#3a3a3a" />
              </TouchableOpacity>
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
              // Set initial custom dates to current date
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
            }}>
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: -2, marginTop: -6, marginRight: -8 }}>
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
                        // Reset all form fields and set up for new custom event
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
                    <Text style={[styles.modalSubtitle, { color: '#888888', marginBottom: 15 }]}>
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
                                setNewCategoryColor(null); // Changed from '#FADADD' to null
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
                                  onLongPress={() => handleCategoryLongPress(cat)}
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
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 1,
                                            elevation: 2,
                                            overflow: 'hidden',
                                          }}
                                        >
                                          {newCategoryColor && newCategoryColor !== color && (
                                            <View style={{
                                              position: 'absolute',
                                              top: 0,
                                              left: 0,
                                              right: 0,
                                              bottom: 0,
                                              backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                              borderRadius: 12,
                                            }} />
                                          )}
                                        </TouchableOpacity>
                                      ))}
                                    </View>

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <TouchableOpacity
                                        onPress={() => {
                                          setShowAddCategoryForm(false);
                                          setNewCategoryName('');
                                          setNewCategoryColor(null); // Changed from '#FADADD' to null
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
                                                  type: 'calendar'  // Add type field
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
                                // If the picker is already showing, close it
                                if (showStartPicker) {
                                  setShowStartPicker(false);
                                } else {
                                  // If opening the picker, close end picker if it's open
                                  setShowStartPicker(true);
                                  setShowEndPicker(false);
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
                                // If the picker is already showing, close it
                                if (showEndPicker) {
                                  setShowEndPicker(false);
                                } else {
                                  // If opening the picker, close start picker if it's open
                                  setShowEndPicker(true);
                                  setShowStartPicker(false);
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
                          <Animated.View style={styles.dateTimePickerContainer}>
                            <DateTimePicker
                              value={showStartPicker ? startDateTime : endDateTime}
                              mode={isAllDay ? "date" : "datetime"}
                              display="spinner"
                              onChange={(event, selectedDate) => {
                                if (selectedDate) {
                                  if (showStartPicker) {
                                    setStartDateTime(selectedDate);
                                    // Update end time if it's before start time
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
                              style={styles.featureButton}
                            >
                              <Text style={styles.featureButtonText}>
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
                              style={styles.featureButton}
                            >
                              <Text style={styles.featureButtonText}>
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
                                style={styles.featureButton}
                              >
                                <Text style={styles.featureButtonText}>
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
                          <Animated.View style={styles.dateTimePickerContainer}>
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
                              style={{ height: 180, width: '100%' }}
                              textColor="#333"
                            />
                          </Animated.View>
                        )}

                        {showEndDatePicker && (
                          <Animated.View style={styles.dateTimePickerContainer}>
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
                                  if (option === 'Custom') {
                                    setRepeatOption('Custom');
                                    setShowRepeatPicker(false);
                                    setIsEditingEvent(false); // Explicitly set to false for new events
                                    // Store the current time values before closing the modal
                                    const currentStartTime = startDateTime;
                                    const currentEndTime = endDateTime;
                                    const currentDateStr = getLocalDateString(currentStartTime);
                                    
                                    // Initialize customDateTimes with the current date in the default time box
                                    const initialCustomTimes: CustomTimes = {
                                      default: {
                                        start: currentStartTime,
                                        end: currentEndTime,
                                        reminder: reminderTime,
                                        repeat: 'None',
                                        dates: [currentDateStr]
                                      }
                                    };
                                    
                                    // Add the current date to customSelectedDates if not already included
                                    if (!customSelectedDates.includes(currentDateStr)) {
                                      setCustomSelectedDates([currentDateStr]);
                                    }
                                    
                                    // Initialize custom times for the current date
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
                                    setRepeatOption(option === 'Do Not Repeat' ? 'None' : option as RepeatOption);
                                    debouncePickerClose('repeat');
                                  }
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
                              setNewCategoryColor(null); // Changed from '#FADADD' to null
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
                                onLongPress={() => handleCategoryLongPress(cat)}
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
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 1,
                                            elevation: 2,
                                            overflow: 'hidden',
                                          }}
                                        >
                                          {newCategoryColor && newCategoryColor !== color && (
                                            <View style={{
                                              position: 'absolute',
                                              top: 0,
                                              left: 0,
                                              right: 0,
                                              bottom: 0,
                                              backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                              borderRadius: 12,
                                            }} />
                                          )}
                                        </TouchableOpacity>
                                      ))}
                                    </View>

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <TouchableOpacity
                                        onPress={() => {
                                          setShowAddCategoryForm(false);
                                          setNewCategoryName('');
                                          setNewCategoryColor(null); // Changed from '#FADADD' to null
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
                                                  type: 'calendar'  // Add type field
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
                            if (!selectedEvent) {
                              console.error('No event selected for editing');
                              return;
                            }
                            
                            const event = selectedEvent.event;
                            
                            // Initialize custom dates and times from the event being edited
                            if (event.customDates && event.customDates.length > 0) {
                              setCustomSelectedDates(event.customDates);
                              const customTimes: CustomTimes = {};
                              
                              // Add default time box first
                              customTimes.default = {
                                start: new Date(event.startDateTime!),
                                end: new Date(event.endDateTime!),
                                reminder: event.reminderTime ? new Date(event.reminderTime) : null,
                                repeat: event.repeatOption || 'None',
                                dates: [event.date]
                              };
                              
                              // Add custom times for each date
                              event.customDates.forEach(date => {
                                // Get the custom time for this date if it exists
                                const dateCustomTime = event.customTimes?.[date];
                                
                                // Create a new date object for the start time
                                const startTime = dateCustomTime ? new Date(dateCustomTime.start) : new Date(event.startDateTime!);
                                // Create a new date object for the end time
                                const endTime = dateCustomTime ? new Date(dateCustomTime.end) : new Date(event.endDateTime!);
                                // Create a new date object for the reminder time if it exists
                                const reminderTime = dateCustomTime?.reminder ? new Date(dateCustomTime.reminder) : 
                                  (event.reminderTime ? new Date(event.reminderTime) : null);
                                
                                customTimes[date] = {
                                  start: startTime,
                                  end: endTime,
                                  reminder: reminderTime,
                                  repeat: dateCustomTime?.repeat || event.repeatOption || 'None',
                                  dates: [date]
                                };
                              });
                              
                              setCustomDateTimes(customTimes);
                              setStartDateTime(new Date(event.startDateTime!));
                              setEndDateTime(new Date(event.endDateTime!));
                              setReminderTime(event.reminderTime ? new Date(event.reminderTime) : null);
                              setRepeatOption(event.repeatOption || 'None');
                            } else {
                              // Initialize with default values if no custom dates
                              setCustomDateTimes({
                                default: {
                                  start: new Date(event.startDateTime!),
                                  end: new Date(event.endDateTime!),
                                  reminder: event.reminderTime ? new Date(event.reminderTime) : null,
                                  repeat: event.repeatOption || 'None',
                                  dates: [event.date]
                                }
                              });
                              setCustomSelectedDates([]);
                            }
                            setShowCustomDatesPicker(true);
                            setShowEditEventModal(false);
                          }}
                          style={{
                            backgroundColor: '#fafafa',
                            borderRadius: 12,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            marginTop: 2,
                            alignItems: 'center',
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
                     onPress={() => handleSaveEvent()}
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
              height: '90%',
              flexDirection: 'column',
            }}>
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingTop: 25,
                paddingBottom: 15,
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '600', 
                  color: '#3a3a3a',
                  fontFamily: 'Onest'
                }}>
                  {isEditingEvent ? 'Edit Event with Custom Dates' : 'Add Event with Custom Dates'}
                </Text>
                <TouchableOpacity 
                  onPress={() => setShowCustomDatesPicker(false)}
                >
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={{ flex: 1 }}>
                <View style={{ padding: 20 }}>
                  {/* Title and Description Section */}
                  <View style={{ marginBottom: 24 }}>
                    <TextInput
                      style={[styles.inputTitle, { marginBottom: 12 }]}
                      placeholder="Title"
                      value={customModalTitle}
                      onChangeText={setCustomModalTitle}
                    />
                    <TextInput
                      style={[styles.inputDescription, { marginBottom: 12 }]}
                      placeholder="Description (optional)"
                      value={customModalDescription}
                      onChangeText={setCustomModalDescription}
                      multiline
                    />
                  </View>

                     {/* Calendar Section */}
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ 
                      fontSize: 15, 
                      fontWeight: '600', 
                      color: '#3a3a3a',
                      marginBottom: 12,
                      fontFamily: 'Onest'
                    }}>
                      {selectedTimeBox ? 'Select Dates' : 'Select Dates'}
                    </Text>
                    <RNCalendar
                      onDayPress={(day: DateData) => {
                        const dateStr = day.dateString;
                        
                        if (selectedTimeBox) {
                          // Add date to the selected time box
                          const updatedCustomDateTimes = { ...customDateTimes };
                          const timeBox = updatedCustomDateTimes[selectedTimeBox];
                          
                          if (!timeBox.dates.includes(dateStr)) {
                            // Add the date to the time box's dates array
                            updatedCustomDateTimes[selectedTimeBox] = {
                              ...timeBox,
                              dates: [...timeBox.dates, dateStr]
                            };
                            setCustomDateTimes(updatedCustomDateTimes);
                            
                            // Also update customSelectedDates
                            if (!customSelectedDates.includes(dateStr)) {
                              setCustomSelectedDates(prev => [...prev, dateStr]);
                            }
                          } else {
                            // Remove the date from the time box's dates array
                            updatedCustomDateTimes[selectedTimeBox] = {
                              ...timeBox,
                              dates: timeBox.dates.filter(d => d !== dateStr)
                            };
                            setCustomDateTimes(updatedCustomDateTimes);
                            
                            // Also update customSelectedDates if no other time box has this date
                            const isDateUsedByOtherTimeBox = Object.entries(updatedCustomDateTimes).some(
                              ([key, data]) => key !== selectedTimeBox && data.dates.includes(dateStr)
                            );
                            if (!isDateUsedByOtherTimeBox) {
                              setCustomSelectedDates(prev => prev.filter(d => d !== dateStr));
                            }
                          }
                        } else {
                          // If no time box is selected, just toggle the date in customSelectedDates
                          if (!customSelectedDates.includes(dateStr)) {
                            setCustomSelectedDates(prev => [...prev, dateStr]);
                          } else {
                            setCustomSelectedDates(prev => prev.filter(d => d !== dateStr));
                          }
                        }
                      }}
                      markedDates={Object.fromEntries(
                        customSelectedDates.map(date => [
                          date,
                          { 
                            selected: true, 
                            selectedColor: selectedTimeBox ? '#FF9A8B' : '#FF9A8B',
                            // If a time box is selected, highlight dates that belong to it
                            ...(selectedTimeBox && customDateTimes[selectedTimeBox]?.dates.includes(date) && {
                              selectedColor: '#FF9A8B',
                              selectedTextColor: '#fff'
                            })
                          }
                        ])
                      )}
                      style={{
                        borderRadius: 12,
                        marginBottom: 16,
                      }}
                    />
                  </View>


                  {/* Time Boxes Section */}
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ 
                      fontSize: 15, 
                      fontWeight: '600', 
                      color: '#3a3a3a',
                      marginBottom: 12,
                      fontFamily: 'Onest'
                    }}>
                      Time Settings
                    </Text>

                    {/* Custom Time Boxes */}
                    {Object.entries(customDateTimes).map(([key, timeData]) => {
                      if (key === 'default') return null; // Skip default time box
                      const date = timeData.dates[0];
                      return (
                        <TouchableOpacity
                          key={key}
                          onPress={() => {
                            setSelectedTimeBox(selectedTimeBox === key ? null : key);
                          }}
                          style={[
                            { 
                              backgroundColor: '#fafafa',
                              borderRadius: 10,
                              padding: 12,
                              marginBottom: 12,
                              borderWidth: 2,
                              borderColor: 'transparent'
                            },
                            selectedTimeBox === key && {
                              borderColor: '#FF9A8B',
                              backgroundColor: '#f8f8f8'
                            }
                          ]}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, color: '#3a3a3a', fontFamily: 'Onest', marginBottom: 4 }}>
                                {timeData.start.toLocaleTimeString([], { 
                                  hour: 'numeric', 
                                  minute: '2-digit',
                                  hour12: true 
                                })} - {timeData.end.toLocaleTimeString([], { 
                                  hour: 'numeric', 
                                  minute: '2-digit',
                                  hour12: true 
                                })}
                              </Text>
                              {timeData.dates && timeData.dates.length > 0 && (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                  {timeData.dates.map((date) => (
                                    <View 
                                      key={date} 
                                      style={{
                                        backgroundColor: selectedTimeBox === key ? '#FF9A8B' : '#FF9A8B40',
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 4,
                                      }}
                                    >
                                      <Text style={{ 
                                        fontSize: 11, 
                                        color: selectedTimeBox === key ? 'white' : '#3a3a3a',
                                        fontFamily: 'Onest',
                                      }}>
                                        {new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                            <TouchableOpacity
                              onPress={() => {
                                const updatedTimes = { ...customDateTimes };
                                // Get the dates associated with this time box before deleting it
                                const datesToRemove = timeData.dates;
                                delete updatedTimes[key];
                                setCustomDateTimes(updatedTimes);
                                if (selectedTimeBox === key) {
                                  setSelectedTimeBox(null);
                                }
                                // Remove the associated dates from customSelectedDates
                                setCustomSelectedDates(prev => prev.filter(date => !datesToRemove.includes(date)));
                              }}
                              style={{ padding: 4 }}
                            >
                              <Ionicons name="close-circle" size={20} color="#999" />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {/* Add Custom Time Button - always show when time picker is not open */}
                    {!showCustomTimePicker && (
                      <TouchableOpacity
                        onPress={() => {
                          try {
                            // Create a new time box with a unique key
                            const timeBoxKey = `time_${Date.now()}`;
                            
                            // Create the time box with current time values
                            const currentTime = new Date();
                            const newTimeBox: CustomTimeData = {
                              start: new Date(currentTime),
                              end: new Date(currentTime.getTime() + 60 * 60 * 1000), // 1 hour later
                              reminder: null,
                              repeat: 'None' as RepeatOption,
                              dates: []
                            };

                            // First update the state with the new time box
                            setCustomDateTimes(prev => ({
                              ...prev,
                              [timeBoxKey]: newTimeBox
                            }));

                            // Then set up the picker after a small delay to ensure state is updated
                            setTimeout(() => {
                              setSelectedTimeBox(timeBoxKey);
                              setEditingTimeBoxId(timeBoxKey);
                              setEditingField('start');
                              setShowCustomTimePicker(true);
                            }, 0);
                          } catch (error) {
                            console.error('Error creating new time box:', error);
                          }
                        }}
                        style={{
                          backgroundColor: '#fafafa',
                          borderRadius: 12,
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          alignItems: 'center',
                          marginTop: 8,
                          flexDirection: 'row',
                          justifyContent: 'center',
                          gap: 8
                        }}
                      >
                        <Ionicons name="add-circle-outline" size={20} color="#666" />
                        <Text style={{ 
                          fontSize: 13,
                          color: '#666',
                          fontFamily: 'Onest',
                          fontWeight: '500'
                        }}>
                          Add Time
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Custom Time Picker */}
                  {showCustomTimePicker && editingTimeBoxId && (
                  <View style={{
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1,
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                      {/* Start Time */}
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>
                          Start Time
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            setCurrentEditingField('start');
                            setIsTimePickerVisible(true);
                          }}
                          style={{
                            backgroundColor: '#fafafa',
                            borderRadius: 12,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            alignItems: 'center',
                            borderWidth: currentEditingField === 'start' ? 1 : 0,
                            borderColor: '#FF9A8B',
                          }}
                        >
                          <Text style={{
                            fontSize: 13,
                            color: '#3a3a3a',
                            fontFamily: 'Onest',
                            fontWeight: '500'
                          }}>
                            {(tempTimeBox?.start || customDateTimes[editingTimeBoxId]?.start)?.toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            }) || '--:-- --'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* End Time */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>
                          End Time
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            setCurrentEditingField('end');
                            setIsTimePickerVisible(true);
                          }}
                          style={{
                            backgroundColor: '#fafafa',
                            borderRadius: 12,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            alignItems: 'center',
                            borderWidth: currentEditingField === 'end' ? 1 : 0,
                            borderColor: '#FF9A8B',
                          }}
                        >
                          <Text style={{
                            fontSize: 13,
                            color: '#3a3a3a',
                            fontFamily: 'Onest',
                            fontWeight: '500'
                          }}>
                            {(tempTimeBox?.end || customDateTimes[editingTimeBoxId]?.end)?.toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            }) || '--:-- --'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Time Picker */}
                    {isTimePickerVisible && (
                      <View style={{ marginTop: 12 }}>
                        <DateTimePicker
                          value={tempTimeBox?.[currentEditingField] || customDateTimes[editingTimeBoxId]?.[currentEditingField] || new Date()}
                          mode="time"
                          display="spinner"
                          onChange={(event, selectedDate) => handleTimeSelection(selectedDate || null, currentEditingField)}
                          style={{ height: 150, width: '100%' }}
                          textColor="#333"
                        />

                        {/* Save and Cancel Buttons */}
                        <View style={{ 
                          flexDirection: 'row', 
                          justifyContent: 'space-between', 
                          marginTop: 16,
                          gap: 12
                        }}>
                          <TouchableOpacity
                            onPress={cancelTimeChanges}
                            style={{
                              flex: 1,
                              backgroundColor: '#f5f5f5',
                              paddingVertical: 12,
                              borderRadius: 12,
                              alignItems: 'center'
                            }}
                          >
                            <Text style={{ 
                              fontSize: 15, 
                              color: '#666',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                              Cancel
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={saveTimeChanges}
                            style={{
                              flex: 1,
                              backgroundColor: '#FF9A8B',
                              paddingVertical: 12,
                              borderRadius: 12,
                              alignItems: 'center'
                            }}
                          >
                            <Text style={{ 
                              fontSize: 15, 
                              color: '#fff',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                              Save
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                  )}

                  {/* Save and Delete Buttons for Custom Modal */}
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                    {editingEvent && (
                      <TouchableOpacity
                        onPress={async () => {
                          Alert.alert(
                            'Delete Event',
                            'Are you sure you want to delete this event?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: async () => {
                                try {
                                  // Delete from database
                                  const { error } = await supabase
                                    .from('events')
                                    .delete()
                                    .eq('id', editingEvent.id);
                                  if (error) throw error;
                                  // Remove from local state
                                  setEvents(prev => {
                                    const updated = { ...prev };
                                    editingEvent.customDates?.forEach(date => {
                                      if (updated[date]) {
                                        updated[date] = updated[date].filter(e => e.id !== editingEvent.id);
                                        if (updated[date].length === 0) delete updated[date];
                                      }
                                    });
                                    return updated;
                                  });
                                  setCustomModalTitle('');
                                  setCustomModalDescription('');
                                  setCustomSelectedDates([]);
                                  setCustomDateTimes({});
                                  setShowCustomDatesPicker(false);
                                  setEditingEvent(null);
                                  Toast.show({
                                    type: 'success',
                                    text1: 'Event deleted successfully',
                                    position: 'bottom',
                                  });
                                } catch (error) {
                                  console.error('Error deleting event:', error);
                                  Alert.alert('Error', 'Failed to delete event. Please try again.');
                                }
                              } }
                            ]
                          );
                        }}
                        style={{
                          backgroundColor: '#ffebee',
                          borderRadius: 12,
                          padding: 16,
                          alignItems: 'center',
                          flex: 1,
                        }}
                      >
                        <Text style={{ color: '#d32f2f', fontSize: 16, fontWeight: '600', fontFamily: 'Onest' }}>Delete</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={handleEditEvent}
                      style={styles.saveButton}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: -2, marginTop: -6, marginRight: -8 }}>
                      <View>
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
                          <Text style={[styles.modalSubtitle, { color: '#888888', marginBottom: 15 }]}>
                            {editedRepeatOption === 'Custom' ? 'Custom Dates' : editedStartDateTime.toDateString()}
                        </Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity 
                        onPress={() => setShowEditEventModal(false)}
                        style={{ padding: 12, marginTop: -8, marginRight: -8 }}
                      >
                        <Ionicons name="close" size={20} color="#666" />
                      </TouchableOpacity>
                    </View>

                    {editedRepeatOption !== 'Custom' ? (
                      <>
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
                                      fontSize: 13, 
                                      color: '#3a3a3a',
                                      fontFamily: 'Onest',
                                      fontWeight: '500'
                                    }}>
                                      {editedSelectedCategory.name}
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
                                    setEditedSelectedCategory(cat);  // Changed from setSelectedCategory to setEditedSelectedCategory
                                    setShowCategoryPicker(false);
                                    setShowAddCategoryForm(false);
                                }}
                                onLongPress={() => handleCategoryLongPress(cat)}
                                    style={({ pressed }) => ({
                                      backgroundColor: '#fafafa',
                                      paddingVertical: 5,
                                      paddingHorizontal: 8,
                                      borderRadius: 9,
                                      borderWidth: (pressed || editedSelectedCategory?.name === cat.name) ? 1 : 0,  // Changed from selectedCategory to editedSelectedCategory
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
                                      marginRight: 4
                                    }} />
                                    <Text style={{ 
                                      fontSize: 12, 
                                      color: '#3a3a3a',
                                      fontFamily: 'Onest',
                                      fontWeight: '500'
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
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 1,
                                            elevation: 2,
                                            overflow: 'hidden',
                                          }}
                                        >
                                          {newCategoryColor && newCategoryColor !== color && (
                                            <View style={{
                                              position: 'absolute',
                                              top: 0,
                                              left: 0,
                                              right: 0,
                                              bottom: 0,
                                              backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                              borderRadius: 12,
                                            }} />
                                          )}
                                        </TouchableOpacity>
                                      ))}
                                    </View>

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <TouchableOpacity
                                        onPress={() => {
                                          setShowAddCategoryForm(false);
                                          setNewCategoryName('');
                                          setNewCategoryColor(null); // Changed from '#FADADD' to null
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
                                                  type: 'calendar'  // Add type field
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
                            const newStartPickerState = !showStartPicker;
                            setShowStartPicker(newStartPickerState);
                            if (newStartPickerState) {
                              setShowEndPicker(false);
                            }
                          }}
                            style={styles.featureButton}>
                            <Text style={styles.dateTimeText}>
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
                              const newEndPickerState = !showEndPicker;
                              setShowEndPicker(newEndPickerState);
                              if (newEndPickerState) {
                                setShowStartPicker(false);
                              }
                            }}
                            
                            style={styles.dateTimeButton}
                          >
                            <Text style={styles.dateTimeText}>
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

                      {/* Date/Time Picker */}
                      {(showStartPicker || showEndPicker) && (
                        <Animated.View style={styles.dateTimePickerContainer}>
                          <DateTimePicker
                            value={showStartPicker ? editedStartDateTime : editedEndDateTime}
                            mode={isEditedAllDay ? "date" : "datetime"}
                            display="spinner"
                            onChange={(event, selectedDate) => {
                              if (!selectedDate) return;

                              const newDate = new Date(selectedDate);

                              if (showStartPicker) {
                                if (isEditedAllDay) newDate.setHours(0, 0, 0, 0);
                                setEditedStartDateTime(newDate);

                                if (!userChangedEditedEndTime) {
                                  const end = new Date(newDate);
                                  if (isEditedAllDay) {
                                    end.setHours(23, 59, 59, 999);
                                  } else {
                                    end.setTime(newDate.getTime() + 60 * 60 * 1000);
                                  }
                                  setEditedEndDateTime(end);
                                }

                                // Only call debouncePickerClose if the value actually changed
                                if (newDate.getTime() !== editedStartDateTime.getTime()) {
                                  debouncePickerClose('start');
                                }
                              } else {
                                if (isEditedAllDay) newDate.setHours(23, 59, 59, 999);
                                setEditedEndDateTime(newDate);
                                setUserChangedEditedEndTime(true);

                                // Only call debouncePickerClose if the value actually changed
                                if (newDate.getTime() !== editedEndDateTime.getTime()) {
                                  debouncePickerClose('end');
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
                      <View style={styles.dateTimeRow}>
                        <View style={styles.dateTimeColumn}>
                          <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>Reminder</Text>
                          <TouchableOpacity
                           onPress={() => {
                            const newReminderPickerState = !showReminderPicker;
                            setShowReminderPicker(newReminderPickerState);
                            if (newReminderPickerState) {
                              setShowRepeatPicker(false);
                              setShowEndDatePicker(false);
                            }
                          }}
                            style={styles.featureButton}
                          >
                            <Text style={styles.featureButtonText}>
                              {editedReminderTime ? editedReminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No Reminder'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.dateTimeColumn}>
                          <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>Repeat</Text>
                          <TouchableOpacity
                             onPress={() => {
                              const newRepeatPickerState = !showRepeatPicker;
                              setShowRepeatPicker(newRepeatPickerState);
                              if (newRepeatPickerState) {
                                setShowReminderPicker(false);
                                setShowEndDatePicker(false);
                              }
                            }}
                            style={styles.featureButton}
                          >
                            <Text style={styles.featureButtonText}>
                              {editedRepeatOption === 'None' ? 'Do Not Repeat' : editedRepeatOption}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {editedRepeatOption !== 'None' && (
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>End Date</Text>
                            <TouchableOpacity
                             onPress={() => {
                              const newEndDatePickerState = !showEndDatePicker;
                              setShowEndDatePicker(newEndDatePickerState);
                              if (newEndDatePickerState) {
                                setShowReminderPicker(false);
                                setShowRepeatPicker(false);
                              }
                            }}
                              style={styles.featureButton}
                            >
                              <Text style={styles.featureButtonText}>
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
                        <Animated.View style={styles.dateTimePickerContainer}>
                          <DateTimePicker
                            value={editedReminderTime || new Date()}
                            mode="time"
                            display="spinner"
                            onChange={(event, selectedTime) => {
                              if (selectedTime) {
                                setEditedReminderTime(selectedTime);
                                debouncePickerClose('reminder');
                              }
                            }}
                            style={{ height: 180, width: '100%' }}
                            textColor="#333"
                          />
                        </Animated.View>
                      )}

                      {showEndDatePicker && (
                        <Animated.View style={styles.dateTimePickerContainer}>
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
                                onLongPress={() => handleCategoryLongPress(cat)}
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
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 1,
                                            elevation: 2,
                                            overflow: 'hidden',
                                          }}
                                        >
                                          {newCategoryColor && newCategoryColor !== color && (
                                            <View style={{
                                              position: 'absolute',
                                              top: 0,
                                              left: 0,
                                              right: 0,
                                              bottom: 0,
                                              backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                              borderRadius: 12,
                                            }} />
                                          )}
                                        </TouchableOpacity>
                                      ))}
                                    </View>

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <TouchableOpacity
                                        onPress={() => {
                                          setShowAddCategoryForm(false);
                                          setNewCategoryName('');
                                          setNewCategoryColor(null); // Changed from '#FADADD' to null
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
                                                  type: 'calendar'  // Add type field
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

                      {/* Custom Dates */}
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, color: '#3a3a3a', marginBottom: 6, fontFamily: 'Onest' }}>Custom Dates</Text>
                        <TouchableOpacity
                          onPress={() => {
                            if (!selectedEvent) {
                              console.error('No event selected for editing');
                              return;
                            }
                            
                            const event = selectedEvent.event;
                            
                            // Initialize custom dates and times from the event being edited
                            if (event.customDates && event.customDates.length > 0) {
                              setCustomSelectedDates(event.customDates);
                              const customTimes: CustomTimes = {};
                            
                              customTimes.default = {
                                start: new Date(event.startDateTime!),
                                end: new Date(event.endDateTime!),
                                reminder: event.reminderTime ? new Date(event.reminderTime) : null,
                                repeat: event.repeatOption || 'None',
                                dates: [event.date]
                              };
                            
                              event.customDates.forEach(date => {
                                const dateCustomTime = event.customTimes?.[date];
                            
                                const startTime = dateCustomTime ? new Date(dateCustomTime.start) : new Date(event.startDateTime!);
                                const endTime = dateCustomTime ? new Date(dateCustomTime.end) : new Date(event.endDateTime!);
                                const reminderTime = dateCustomTime?.reminder ? new Date(dateCustomTime.reminder) : (event.reminderTime ? new Date(event.reminderTime) : null);
                            
                                customTimes[date] = {
                                  start: startTime,
                                  end: endTime,
                                  reminder: reminderTime,
                                  repeat: dateCustomTime?.repeat || event.repeatOption || 'None',
                                  dates: [date]
                                };
                              });
                              
                              setCustomDateTimes(customTimes);
                              // Set default time values from the event
                              setStartDateTime(new Date(event.startDateTime!));
                              setEndDateTime(new Date(event.endDateTime!));
                              setReminderTime(event.reminderTime ? new Date(event.reminderTime) : null);
                              setRepeatOption(event.repeatOption || 'None');
                            } else {
                              // Initialize with default values if no custom dates
                              const event = selectedEvent!.event;  // Use non-null assertion after null check
                              setCustomDateTimes({
                                default: {
                                  start: new Date(event.startDateTime!),
                                  end: new Date(event.endDateTime!),
                                  reminder: event.reminderTime ? new Date(event.reminderTime) : null,
                                  repeat: event.repeatOption || 'None',
                                  dates: [event.date]
                                }
                              });
                              setCustomSelectedDates([]);
                            }
                            setShowCustomDatesPicker(true);
                            setShowEditEventModal(false);
                          }}
                          style={styles.featureButton}
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
                  
                    {/* Action Buttons */}
                  <View style={[styles.modalActions, { justifyContent: 'space-between' }]}>
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
                        onPress={handleEditEvent}
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
