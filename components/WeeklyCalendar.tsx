import React, { useState, useRef } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, TouchableOpacity, Dimensions, Modal, TextInput, Button, Alert } from 'react-native';
import EventModal from '../components/EventModal';
import { Swipeable } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons'; 
import { supabase } from '../supabase'; 




const SCREEN_WIDTH = Dimensions.get('window').width;

// 🛠 ADD THIS LINE:
const TIME_COLUMN_WIDTH = 50;

// 🛠 ADD THIS LINE TOO:
const DAY_COLUMN_WIDTH = (SCREEN_WIDTH - TIME_COLUMN_WIDTH) / 7;
const hours = Array.from({ length: 24 }, (_, i) => `${(i + 7) % 24}:00`);

// Add your CalendarEvent here ✅
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
  isContinued?: boolean;
}

interface WeeklyCalendarViewProps {
    events: { [date: string]: CalendarEvent[] };
    setEvents: React.Dispatch<React.SetStateAction<{ [date: string]: CalendarEvent[] }>>;
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    setShowModal: (show: boolean) => void;
    setStartDateTime: (date: Date) => void;
    setEndDateTime: (date: Date) => void;
  
    // 🛠 ADD THESE 9 LINES:
    setSelectedEvent: React.Dispatch<React.SetStateAction<{ event: CalendarEvent; dateKey: string; index: number } | null>>;
    setEditedEventTitle: React.Dispatch<React.SetStateAction<string>>;
    setEditedEventDescription: React.Dispatch<React.SetStateAction<string>>;
    setEditedStartDateTime: React.Dispatch<React.SetStateAction<Date>>;
    setEditedEndDateTime: React.Dispatch<React.SetStateAction<Date>>;
    setEditedSelectedCategory: React.Dispatch<React.SetStateAction<{ name: string; color: string; id?: string } | null>>;
    setEditedReminderTime: React.Dispatch<React.SetStateAction<Date | null>>;
    setEditedRepeatOption: React.Dispatch<React.SetStateAction<'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom'>>;
    setEditedRepeatEndDate: React.Dispatch<React.SetStateAction<Date | null>>;
    setShowEditEventModal: (show: boolean) => void;
    hideHeader?: boolean;
  }

  const WeeklyCalendarView: React.FC<WeeklyCalendarViewProps> = ({
    events,
    setEvents,
    selectedDate,
    setSelectedDate,
    setShowModal,
    setStartDateTime,
    setEndDateTime,
  
    // 🛠 ADD THESE (edit-related):
    setSelectedEvent,
    setEditedEventTitle,
    setEditedEventDescription,
    setEditedStartDateTime,
    setEditedEndDateTime,
    setEditedSelectedCategory,
    setEditedReminderTime,
    setEditedRepeatOption,
    setEditedRepeatEndDate,
    setShowEditEventModal,
    hideHeader = false,
  }) => {
  
    const baseDate = new Date(selectedDate);
    const flatListRef = useRef<FlatList>(null);
    const [eventModalVisible, setEventModalVisible] = useState(false);
    const [eventModalData, setEventModalData] = useState<Partial<CalendarEvent>>({});
    // Helper function to get date string in YYYY-MM-DD format
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const [newEventStart, setNewEventStart] = useState<Date | null>(null);
const [newEventEnd, setNewEventEnd] = useState<Date | null>(null);
const [newEventTitle, setNewEventTitle] = useState('');
const [showTimePicker, setShowTimePicker] = useState(false);
const [isStartTime, setIsStartTime] = useState(true);
const [tempHour, setTempHour] = useState('');

const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };
  


  const getWeekStartDate = (offsetWeeks = 0) => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - date.getDay() + offsetWeeks * 7);
    return date;
  };

  const weeks = Array.from({ length: 100 }, (_, i) => getWeekStartDate(i - 50)); // 50 weeks past, 50 weeks future

  const handleSaveNewEvent = (dayDate: Date, hour: number) => {
    const start = new Date(dayDate);
    start.setHours(hour, 0, 0, 0);
  
    const end = new Date(dayDate);
    end.setHours(hour + 1, 0, 0, 0);
  
    const newEvent: CalendarEvent = {
      id: Date.now().toString(),
      title: 'New Event',
      description: '',
      date: start.toISOString().split('T')[0],
      startDateTime: start,
      endDateTime: end,
      categoryName: '',
      categoryColor: '#BF9264',
      reminderTime: null,
      repeatOption: 'None',
      repeatEndDate: null,
      isContinued: false,
    };
  
    setEvents(prev => {
      const updated = { ...prev };
      const dateKey = newEvent.date;
  
      if (!updated[dateKey]) updated[dateKey] = [];
      updated[dateKey].push(newEvent);
  
      return updated;
    });
  };
  

  const renderWeek = ({ item: weekStart }: { item: Date }) => {
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });

  const handleAddEvent = (dayDate: Date, hour: number) => {
    const start = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour, 0, 0);
    const end = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour + 1, 0, 0);

    setEventModalData({
      startDateTime: start,
      endDateTime: end,
      date: start.toISOString().split('T')[0],
      title: '',
      categoryName: 'Default',
      categoryColor: '#BF9264',
    });

    setEventModalVisible(true);
  };

  return (
    <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
       <Text style={{ display: 'none' }}>✨ Add Centered Month Title</Text>
       {!hideHeader && (
         <TouchableOpacity
           onPress={() => {
             const today = new Date();
             setSelectedDate(today);
             flatListRef.current?.scrollToIndex({ index: 50, animated: true });
           }}
           activeOpacity={0.7}
           style={{ alignItems: 'center', marginTop: 0, marginBottom: 0 }}
         >
           <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333' }}>
             {weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
           </Text>
         </TouchableOpacity>
       )}

      <Text style={{ display: 'none' }}>Week Strip</Text>
      <View style={styles.weekStrip}>
        {weekDates.map((date, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={() => setSelectedDate(date)}
            style={styles.dateContainer}
          >
            <Text style={[styles.dayText, isToday(date) && { color: '#BF9264', fontWeight: '700' }]}>
            {date.toLocaleDateString('en-US', { weekday: 'short' })}
            </Text>

            <Text style={[styles.dateText, isToday(date) && { color: '#BF9264', fontWeight: '700' }]}>
                {date.getDate()}
            </Text>
            

          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ display: 'none' }}>Timetable</Text>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row' }}>
          <Text style={{ display: 'none' }}>LEFT: Time indicators</Text>
          <View style={styles.timeColumn}>
            {hours.map((hour, idx) => (
              <View key={idx} style={styles.timeRow}>
                <Text style={styles.timeText}>{hour}</Text>
              </View>
            ))}
          </View>

          <Text style={{ display: 'none' }}>RIGHT: Day columns</Text>
          <ScrollView horizontal style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row' }}>
              {weekDates.map((dayDate, dayIdx) => (
                <View key={dayIdx} style={[styles.dayColumn, { position: 'relative' }]}>
                  
                  <Text style={{ display: 'none' }}>🔥 1. Render event bubbles first</Text>
                  {events[getLocalDateString(dayDate)]?.map((event) => {
                    const eventStart = new Date(event.startDateTime!);
                    const eventEnd = new Date(event.endDateTime!);

                    const eventStartMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
                    const eventEndMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
                    
                    const minutesSince7AM = eventStartMinutes - 7 * 60;
                    const top = Math.max(0, (minutesSince7AM / 60) * 55);
                    const height = Math.max(0, ((eventEndMinutes - eventStartMinutes) / 60) * 55);
                    
                    if (height <= 0) return null;

                    return (
                      <View
                        key={event.id}
                        style={{
                          position: 'absolute',
                          top,
                          left: 0,
                          right: 0,
                          height,
                          zIndex: 1000,
                        }}
                      >
                        <Swipeable
                        friction={2}
                        leftThreshold={80}
                        rightThreshold={40}
                        overshootRight={false}
                        renderRightActions={() => (
                            <TouchableOpacity
                            style={{
                                backgroundColor: 'red',
                                justifyContent: 'center',
                                alignItems: 'center',
                                width: 70,
                                height: '100%',
                                borderRadius: 6,
                            }}
                            onPress={async () => {
                                const { error } = await supabase
                                  .from('events')
                                  .delete()
                                  .eq('id', event.id);
                              
                                if (error) {
                                  console.error('Failed to delete event from Supabase:', error);
                                  Alert.alert('Error', 'Failed to delete event.');
                                  return;
                                }
                              
                                setEvents(prev => {
                                  const updated = { ...prev };
                                  const dateKey = getLocalDateString(dayDate);
                                  updated[dateKey] = updated[dateKey].filter(e => e.id !== event.id);
                                  return updated;
                                });
                              }}
                              
                            >
                            <Feather name="trash-2" size={24} color="white" />
                            </TouchableOpacity>
                        )}
                        >
                        <Text style={{ display: 'none' }}>✅ Wrap bubble content with TouchableOpacity</Text>
                        <TouchableOpacity
                        activeOpacity={0.8}
                        onLongPress={() => {
                            const start = new Date(event.startDateTime!);
                            const end = new Date(event.endDateTime!);
                            const dateKey = getLocalDateString(dayDate);

                            setSelectedEvent({ event, dateKey, index: events[dateKey].findIndex(e => e.id === event.id) });
                            setEditedEventTitle(event.title);
                            setEditedEventDescription(event.description ?? '');
                            setEditedStartDateTime(start);
                            setEditedEndDateTime(end);
                            setEditedSelectedCategory(
                            event.categoryName && event.categoryColor
                                ? { name: event.categoryName, color: event.categoryColor }
                                : null
                            );
                            setEditedReminderTime(event.reminderTime ? new Date(event.reminderTime) : null);
                            setEditedRepeatOption(event.repeatOption || 'None');
                            setEditedRepeatEndDate(event.repeatEndDate ? new Date(event.repeatEndDate) : null);
                            setShowEditEventModal(true);
                        }}
                        style={{
                            height: '100%',
                            backgroundColor: event.categoryColor || '#808080',
                            borderRadius: 8,
                            padding: 4,
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                        >
                        <Text style={{ fontSize: 10, color: 'white', fontWeight: 'bold' }} numberOfLines={2}>
                            {event.title}
                        </Text>
                        </TouchableOpacity>

                        </Swipeable>

                      </View>
                    );
                  })}

                  <Text style={{ display: 'none' }}>🔥 2. Then render the hour grid cells</Text>
                  <View style={{ position: 'relative', zIndex: 0 }}>
                    {hours.map((_, hourIdx) => (
                      <TouchableOpacity
                        key={hourIdx}
                        style={styles.cell}
                        onPress={() => {
                          const start = new Date(dayDate);
                          start.setHours((hourIdx + 7) % 24, 0, 0, 0);
                          const end = new Date(dayDate);
                          end.setHours((hourIdx + 7 + 1) % 24, 0, 0, 0);
                          setStartDateTime(start);
                          setEndDateTime(end);
                          setShowModal(true);
                        }}
                        activeOpacity={0.6}
                      />
                    ))}
                  </View>

                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};

  return (
    <View style={{ flex: 1 }}>

      <FlatList
      ref={flatListRef} 
        data={weeks}
        horizontal
        pagingEnabled
        renderItem={renderWeek}
        keyExtractor={(_, index) => index.toString()}
        initialScrollIndex={50}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        showsHorizontalScrollIndicator={false}
      />

<Modal
  visible={eventModalVisible}
  transparent
  animationType="slide"
  onRequestClose={() => setEventModalVisible(false)}
>
  <View style={styles.modalBackground}>
    <View style={styles.modalContainer}>
      <Text style={styles.modalTitle}>
        {eventModalData?.id ? 'Edit Event' : 'Add Event'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Enter Title"
        value={newEventTitle}
        onChangeText={setNewEventTitle}
      />

      {/* 🔥 Start Time Picker */}
      <TouchableOpacity
        style={styles.input}
        onPress={() => {
          setIsStartTime(true);
          setTempHour(newEventStart ? newEventStart.getHours().toString() : '');
          setShowTimePicker(true);
        }}
      >
        <Text style={{ display: 'none' }}>🔥 Start Time Picker</Text>
        <Text style={{ color: '#333' }}>
          {newEventStart
            ? `Start Time: ${newEventStart.getHours()}:00`
            : 'Pick Start Time'}
        </Text>
      </TouchableOpacity>

      {/* 🔥 End Time Picker */}
      <TouchableOpacity
        style={styles.input}
        onPress={() => {
          setIsStartTime(false);
          setTempHour(newEventEnd ? newEventEnd.getHours().toString() : '');
          setShowTimePicker(true);
        }}
      >
        <Text style={{ display: 'none' }}>🔥 End Time Picker</Text>
        <Text style={{ color: '#333' }}>
          {newEventEnd
            ? `End Time: ${newEventEnd.getHours()}:00`
            : 'Pick End Time'}
        </Text>
      </TouchableOpacity>

      {/* Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <Text style={{ display: 'none' }}>Time Picker Modal</Text>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {isStartTime ? 'Set Start Time' : 'Set End Time'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter hour (0-23)"
              value={tempHour}
              onChangeText={setTempHour}
              keyboardType="number-pad"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const hour = parseInt(tempHour);
                  if (hour >= 0 && hour <= 23) {
                    const newTime = new Date();
                    newTime.setHours(hour, 0, 0, 0);
                    if (isStartTime) {
                      setNewEventStart(newTime);
                    } else {
                      setNewEventEnd(newTime);
                    }
                  }
                  setShowTimePicker(false);
                }}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.modalActions}>
        <TouchableOpacity onPress={() => setEventModalVisible(false)}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (!newEventTitle.trim() || !newEventStart || !newEventEnd) {
              Alert.alert('Error', 'Please enter title and time');
              return;
            }

            if (eventModalData?.id) {
              // 🔥 EDIT existing event
              setEvents(prev => {
                const updated = { ...prev };
                const dateKey = getLocalDateString(newEventStart);

                updated[dateKey] = updated[dateKey].map(event =>
                  event.id === eventModalData.id
                    ? {
                        ...event,
                        title: newEventTitle.trim(),
                        startDateTime: newEventStart,
                        endDateTime: newEventEnd,
                      }
                    : event
                );

                return updated;
              });
            } else {
              // 🔥 ADD new event
              const newEvent: CalendarEvent = {
                id: Date.now().toString(),
                title: newEventTitle.trim(),
                description: '',
                date: getLocalDateString(newEventStart),
                startDateTime: newEventStart,
                endDateTime: newEventEnd,
                categoryName: '',
                categoryColor: '#BF9264',
                reminderTime: null,
                repeatOption: 'None',
                repeatEndDate: null,
                isContinued: false,
              };

              setEvents(prev => {
                const updated = { ...prev };
                const dateKey = newEvent.date;

                if (!updated[dateKey]) updated[dateKey] = [];
                updated[dateKey].push(newEvent);

                return updated;
              });
            }

            // Close modal after save
            setEventModalVisible(false);
            setNewEventTitle('');
            setNewEventStart(null);
            setNewEventEnd(null);
            setEventModalData({});
          }}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

    </View>
  );
};

const styles = StyleSheet.create({
    weekStrip: {
        flexDirection: 'row',
        justifyContent: 'flex-end', // 🔥 push all dates to the right
        paddingTop: 18,
        paddingBottom: 5,
        paddingHorizontal: 14, // 🔥 slight right/left padding
        borderBottomWidth: 1,
        borderColor: '#eee',
        backgroundColor: 'transparent',
        gap: 12, // 🔥 small gaps between dates (optional, needs React Native 0.71+)
      },
      dateContainer: {
        width: 38, // 🔥 smaller width per day to fit all 7 days
        alignItems: 'center',
        paddingVertical: 2,
        marginHorizontal: 2, // 🔥 add tiny margins if you can't use gap
      },
      dayText: {
        fontSize: 10, // 🔥 smaller text
        fontWeight: '600', // still bold
        color: '#333',
        marginBottom: 2, // tighter spacing
        marginRight: -10,
      },
      dateText: {
        fontSize: 13, // 🔥 smaller number size
        fontWeight: '700', // make date numbers pop
        color: '#333',
        marginRight: -12
      },
      todayHighlight: {
        backgroundColor: '#F0E1D2',
        borderRadius: 14,
        paddingHorizontal: 2,
        paddingVertical: 2,
      },
      selectedHighlight: {
        backgroundColor: '#BF9264',
        borderRadius: 14,
        paddingHorizontal: 6, // 🔥 a little more
        paddingVertical: 3,
      },
      
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 55,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  hourText: {
    width: 50,
    textAlign: 'center',
    fontSize: 10,
    color: '#666',
  },
  hourDivider: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  eventBubble: {
    margin: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  eventText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  input: {
    width: '100%',
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  
  modalLabel: {
    fontSize: 14,
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#BF9264',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cancelButton: {
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#666',
  },
  timeColumn: {
    width: TIME_COLUMN_WIDTH, 
    backgroundColor: '#fafafa',
    borderRightWidth: 1,
    borderColor: '#eee',
  },
  timeRow: {
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  timeText: {
    fontSize: 10,
    color: '#666',
  },
  
  dayColumn: {
    width: DAY_COLUMN_WIDTH, // <-- dynamic width per day
    borderRightWidth: 1,
    borderColor: '#eee',
  },
  cell: {
    height: 55,
    borderBottomWidth: 1,
    borderColor: '#eee',
    position: 'relative', // 🔥 must be relative so events can be absolutely positioned inside
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  
  
  
});

export default WeeklyCalendarView;
