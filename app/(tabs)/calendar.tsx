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
  ScrollView
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
  isContinued?: boolean; // 👈 add this
}


type RepeatOption = 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const CELL_WIDTH = SCREEN_WIDTH / 7;
const CELL_HEIGHT = (SCREEN_HEIGHT - 140) / 6;

const NUM_COLUMNS = 7;
const NUM_ROWS = 6;

const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const generateMonthKey = (year: number, month: number) => `${year}-${month}`;

const styles = StyleSheet.create({
  monthLabel: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 0,
    marginBottom: 30,
    color: '#333',
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
    fontWeight: '600',
    color: '#777',
    paddingBottom: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'white',
  },
  cell: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT + 12,
    paddingTop: 6,
    paddingLeft: 4,
    paddingRight: 4,
    borderColor: '#eee',
    backgroundColor: 'white',
  },
  dateNumber: {
    fontSize: 16,
    color: '#333',
  },
  selectedCell: {
    backgroundColor: '#007AFF20',
  },
  todayCell: {
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  selectedText: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  todayText: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  invisibleText: {
    color: 'transparent',
  },
  dotContainer: {
    marginTop: 4,
    paddingLeft: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#007AFF',
  },
  addButton: {
    position: 'absolute',
    right: 22,
    bottom: 82,
    backgroundColor: '#BF9264',
    borderRadius: 28,
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
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
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  input: {
    borderWidth: 0.5,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancel: {
    fontSize: 16,
    color: '#666',
  },
  save: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  eventText: {
    fontSize: 10,
    color: '#333',
    marginTop: 2,
    paddingRight: 2,
  },
  inputTitle: {
    fontSize: 16,
    padding: 12,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
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
  },
  inlineSettingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
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
  const [categories, setCategories] = useState<{ name: string; color: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<{ name: string; color: string } | null>(null);
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



  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);


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
        
          let currentDate = new Date(start);
          let isFirstDay = true; // 👈 new flag
        
          while (currentDate <= end) {
            const dateKey = getLocalDateString(currentDate);
        
            if (!eventsMap[dateKey]) eventsMap[dateKey] = [];
        
            eventsMap[dateKey].push({
              id: event.id,
              title: isFirstDay ? event.title : 'Continued...',
              description: event.description,
              date: dateKey,
              startDateTime: event.start_datetime,
              endDateTime: event.end_datetime,
              categoryName: event.category_name,
              categoryColor: event.category_color,
              reminderTime: event.reminder_time,
              repeatOption: event.repeat_option,
              repeatEndDate: event.repeat_end_date,
              isContinued: !isFirstDay, // 👈 Add a flag
            });
        
            isFirstDay = false; // after first day, all are continued
            currentDate.setDate(currentDate.getDate() + 1);
          }
        });
        
  
        setEvents(eventsMap);
      }
    };
  
    fetchEvents();
  }, []);

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
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    while (days.length < NUM_COLUMNS * NUM_ROWS) days.push(null);
    return { key: generateMonthKey(year, month), year, month, days };
  };

  const months = Array.from({ length: 25 }, (_, i) => getMonthData(today, i - 12));

  const isToday = (date: Date | null) =>
    date?.toDateString() === new Date().toDateString();

  const isSelected = (date: Date | null) =>
    date?.toDateString() === selectedDate.toDateString();

  const expandReminderPicker = () => {
    Animated.timing(reminderPickerHeight, {
      toValue: 120, // or 120 if you want smaller
      duration: 300,
      useNativeDriver: false,
    }).start();
  };
  
  const collapseReminderPicker = () => {
    Animated.timing(reminderPickerHeight, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
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
  
  

  const renderCell = (date: Date | null, index: number) => {
    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.cell,
          isSelected(date) && styles.selectedCell,
          isToday(date) && styles.todayCell
        ]}
        onPress={() => {
          if (date) {
            setSelectedDate(date);
            setStartDateTime(new Date(date));
            setNewEventTitle('');
            setNewEventDescription('');
            setEndDateTime(new Date(date.getTime() + 60 * 60 * 1000));
            setUserChangedEndTime(false);
            setShowModal(true);
          }
        }}
        activeOpacity={date ? 0.7 : 1}
        disabled={!date}
      >
        <Text
          style={[
            styles.dateNumber,
            !date && styles.invisibleText,
            isSelected(date) && styles.selectedText,
            isToday(date) && styles.todayText
          ]}
        >
          {date?.getDate()}
        </Text>
  
        {date &&
          events[getLocalDateString(date)]?.map((event, idx) => {
            const dateKey = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
            const eventStart = new Date(event.startDateTime!);
            const eventEnd = new Date(event.endDateTime!);
  
            // Check if event spans multiple days
            const isMultiDay = eventStart.toDateString() !== eventEnd.toDateString();
            const isStartDate = dateKey === eventStart.toISOString().split('T')[0];
            const isInsideSpan = 
              date!.getTime() >= new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate()).getTime() &&
              date!.getTime() <= new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate()).getTime();
          
  
            if (!isStartDate && !isInsideSpan) return null; // Not part of this event on this day
  
            return (
              <Swipeable
                key={idx}
                overshootRight={false}
                onSwipeableOpen={() => handleDeleteEvent(dateKey, idx)}
                renderRightActions={() => (
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: 'red',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderRadius: 6,
                      overflow: 'hidden',
                      marginTop: idx === 0 ? 10 : 4,
                    }}
                  >
                    <Ionicons name="trash-outline" size={10} color="white" />
                  </View>
                )}
              >
                <TouchableOpacity
                  style={{
                    backgroundColor: event.categoryColor || '#eee',
                    borderRadius: 6,
                    paddingVertical: 2,
                    paddingHorizontal: isMultiDay ? 2 : 6, // narrow padding if stretched
                    marginTop: idx === 0 ? 10 : 4,
                    overflow: 'hidden',
                    width: isMultiDay ? '98%' : undefined, // stretch if spanning
                    alignSelf: isMultiDay ? 'center' : undefined,
                  }}
                  onLongPress={() => {
                    const eventToEdit = events[dateKey][idx];
                    setSelectedEvent({ event: eventToEdit, dateKey, index: idx });
                    setEditedEventTitle(eventToEdit.title);
                    setEditedEventDescription(eventToEdit.description ?? '');
                    setEditedStartDateTime(eventToEdit.startDateTime ? new Date(eventToEdit.startDateTime) : new Date());
                    setEditedEndDateTime(eventToEdit.endDateTime ? new Date(eventToEdit.endDateTime) : new Date());
                    setEditedSelectedCategory(
                      eventToEdit.categoryName && eventToEdit.categoryColor
                        ? { name: eventToEdit.categoryName, color: eventToEdit.categoryColor }
                        : null
                    );
                    setEditedReminderTime(eventToEdit.reminderTime ? new Date(eventToEdit.reminderTime) : null);
                    setEditedRepeatOption(eventToEdit.repeatOption || 'None');
                    setEditedRepeatEndDate(eventToEdit.repeatEndDate ? new Date(eventToEdit.repeatEndDate) : null);
                    setShowEditEventModal(true);
                    setUserChangedEditedEndTime(false);
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 10,
                      color: isMultiDay && !isStartDate ? '#ddd' : '#fff',
                      fontWeight: isMultiDay && !isStartDate ? '400' : '600',
                      fontStyle: isMultiDay && !isStartDate ? 'italic' : 'normal',
                      textAlign: 'center',
                    }}
                  >
                    {isMultiDay && !isStartDate ? 'Continued...' : event.title}
                  </Text>
                </TouchableOpacity>
              </Swipeable>
            );
          })}
      </TouchableOpacity>
    );
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
    setUserChangedEndTime(false); // 🔥 reset end time manually changed status
  };

  const handleSaveEvent = async () => {
    if (!newEventTitle.trim()) {
      alert('Please enter a title for the event.');
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
          user_id: user?.id || null,
        },
      ])
      .select();
  
    if (error) {
      console.error('Error saving event:', error);
      alert('Failed to save event.');
      setIsSaving(false);
      return;
    }
  
    console.log('Event saved!', data);
  
    // ✅ Build event blocks across multiple days
    const updatedEvents = { ...events };
  
    const eventId = data?.[0]?.id || Date.now().toString();
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
  
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
        isContinued: currentDate.toDateString() !== start.toDateString(), // 🔥
      });
  
      currentDate.setDate(currentDate.getDate() + 1); // move to next day
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
  
    return (
      <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, paddingTop: 1, backgroundColor: 'white' }}>
        <Text style={styles.monthLabel}>{label}</Text>
        <View style={styles.weekRow}>
          {weekdays.map((day, idx) => (
            <Text key={idx} style={styles.weekday}>
              {day}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {days.map((date, i) => renderCell(date, i))}
        </View>
      </View>
    );
    
  };
  
  return (
    <>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
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
          style={{ flex: 1, backgroundColor: 'white' }}
        />
  
        <TouchableOpacity
          onPress={() => setShowModal(true)}
          style={styles.addButton}
        >
          <Text style={styles.addIcon}>＋</Text>
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
                  <Text style={styles.modalSubtitle}>
                    {startDateTime.toDateString()}
                  </Text>
  
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
                  <View style={{ marginBottom: 10, marginTop: 5, marginLeft: 5 }}>
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
                      <Animated.View>
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
                        
                        />
                      </Animated.View>
                    )}
                  </View>

                  {/* 🛑 Ends */}
                  <View style={{ marginBottom: 10, marginLeft: 5 }}>
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
                      <Animated.View>
                        <DateTimePicker
                          value={endDateTime}
                          mode="datetime"
                          display="spinner"
                          onChange={(event, selectedDate) => {
                            if (selectedDate) {
                              setEndDateTime(selectedDate);
                              setUserChangedEndTime(true); // they touched it manually now
                            }
                            setShowEndPicker(false);
                          }}
                          
                        />
                      </Animated.View>
                    )}
                  </View>

                  {/* 🗂 Set Category */}
                  <View style={{ marginBottom: 10, marginLeft: 5 }}>
                    <TouchableOpacity
                      onPress={() => setShowCategoryPicker(prev => !prev)}
                      style={styles.inlineSettingRow}
                    >
                      <Ionicons name="color-palette-outline" size={22} color={selectedCategory ? selectedCategory.color : '#666'} />
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
                            onPress={() => setSelectedCategory(cat)}
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
                        onPress={async () => {
                          if (newCategoryName.trim()) {
                            const { data, error } = await supabase
                              .from('categories')
                              .insert([{ label: newCategoryName.trim(), color: newCategoryColor, user_id: user?.id }])
                              .select();
                        
                            if (error) {
                              console.error('Failed to save new category:', error);
                              return;
                            }
                        
                            if (data && data.length > 0) {
                              const insertedCategory = {
                                id: data[0].id,
                                name: data[0].label,
                                color: data[0].color,
                              };
                              setCategories((prev) => [...prev, insertedCategory]);
                              setSelectedCategory(insertedCategory);
                              setNewCategoryName('');
                              setShowAddCategoryForm(false);
                            }
                          }
                        }}
                        
                      >
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save Category</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* 🕑 Set Reminder */}
                  <View style={{ marginBottom: 10, marginLeft: 5 }}>
                    <TouchableOpacity
                      onPress={() => setShowReminderPicker(prev => !prev)}
                      style={styles.inlineSettingRow}
                    >
                      <Ionicons name="time-outline" size={22} color="#666" />
                      <Text style={styles.inlineSettingText}>
                        {reminderTime ? reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Set Reminder'}
                      </Text>
                    </TouchableOpacity>

                    {showReminderPicker && (
                      <Animated.View>
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
                        />
                      </Animated.View>
                    )}
                  </View>

                  {/* 🔁 Set Repeat */}
                  <View style={{ marginBottom: 5, marginLeft: 5 }}>
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
                        {['Daily', 'Weekly', 'Monthly', 'Yearly', 'Custom'].map((option) => (
                          <TouchableOpacity
                            key={option}
                            onPress={() => {
                              setRepeatOption(option as RepeatOption);  // 👈 Cast it like this
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
                    <View style={{ marginBottom: 5, marginTop: 4, marginLeft: 5 }}>
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

                </ScrollView>

                {/* Modal Bottom Buttons */}
                <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => {
                    resetEventForm();   // 🔥 clear everything
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
                  <Text style={styles.modalSubtitle}>
                    {editedStartDateTime.toDateString()}
                  </Text>

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
                  <View style={{ marginBottom: 10, marginTop: 5, marginLeft: 5 }}>
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
                      <Animated.View>
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
                          
                        />
                      </Animated.View>
                    )}
                  </View>

                    {/* Ends */}
                  <View style={{ marginBottom: 10, marginLeft: 5 }}>
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
                      <Animated.View>
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
                        />
                      </Animated.View>
                    )}
                  </View>

                    {/* Set Category */}
                  <View style={{ marginBottom: 10, marginLeft: 5 }}>
                    <TouchableOpacity
                      onPress={() => setShowCategoryPicker(prev => !prev)}
                      style={styles.inlineSettingRow}
                    >
                      <Ionicons name="color-palette-outline" size={22} color={editedSelectedCategory ? editedSelectedCategory.color : '#666'} />
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
                            onPress={() => setEditedSelectedCategory(cat)}
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
                            setEditedSelectedCategory(newCategory);
                            setNewCategoryName('');
                          }
                          setShowAddCategoryForm(false);
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save Category</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                    {/* Set Reminder */}
                  <View style={{ marginBottom: 10, marginLeft: 5 }}>
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
                      <Animated.View>
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
                        />
                      </Animated.View>
                    )}
                  </View>
                    {/* Set Repeat */}
                  <View style={{ marginBottom: 5, marginLeft: 5 }}>
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
                        {['Daily', 'Weekly', 'Monthly', 'Yearly', 'Custom'].map((option) => (
                          <TouchableOpacity
                            key={option}
                            onPress={() => {
                              setEditedRepeatOption(option as 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom');
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


                  <View style={styles.modalActions}>
                    <TouchableOpacity onPress={() => setShowEditEventModal(false)}>
                      <Text style={styles.cancel}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                     onPress={() => {
                      if (selectedEvent) {
                        const updatedEvents = { ...events };
                        const { dateKey, index } = selectedEvent;
                        
                        // Remove the event from the old date if date changed
                        if (dateKey !== getLocalDateString(editedStartDateTime)) {
                          updatedEvents[dateKey].splice(index, 1);
                          if (updatedEvents[dateKey].length === 0) {
                            delete updatedEvents[dateKey];
                          }
                          const newDateKey = getLocalDateString(editedStartDateTime);
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
                          });
                        } else {
                          // If date didn't change, just update in place
                          updatedEvents[dateKey][index] = {
                            ...updatedEvents[dateKey][index],
                            title: editedEventTitle,
                            description: editedEventDescription,
                            startDateTime: editedStartDateTime,
                            endDateTime: editedEndDateTime,
                            categoryName: editedSelectedCategory?.name ?? '',
                            categoryColor: editedSelectedCategory?.color ?? '',
                            reminderTime: editedReminderTime || undefined,
                            repeatOption: editedRepeatOption,
                            repeatEndDate: editedRepeatEndDate || undefined,
                            date: getLocalDateString(editedStartDateTime),
                          };
                        }
                        setEvents(updatedEvents);
                      }
                      
                      setUserChangedEndTime(false); // 🔥 reset manual end-time setting
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
        <Toast
          config={{
            success: (props) => <CustomToast {...props} />,
          }}
        />
    </>
  );
};

export default CalendarScreen;
