import React, { useState } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, TouchableOpacity, Dimensions, Modal, TextInput, Button } from 'react-native';
import EventModal from '../components/EventModal';
import { Swipeable } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons'; 



const SCREEN_WIDTH = Dimensions.get('window').width;

// 🛠 ADD THIS LINE:
const TIME_COLUMN_WIDTH = 50;

// 🛠 ADD THIS LINE TOO:
const DAY_COLUMN_WIDTH = (SCREEN_WIDTH - TIME_COLUMN_WIDTH) / 7;
const hours = Array.from({ length: 24 }, (_, i) => `${(i + 6) % 24}:00`);

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
    setShowModal: (show: boolean) => void; // 🛠
    setStartDateTime: (date: Date) => void; // 🛠
    setEndDateTime: (date: Date) => void; // 🛠
  }
  
  

  const WeeklyCalendarView: React.FC<WeeklyCalendarViewProps> = ({
    events,
    setEvents,
    selectedDate,
    setSelectedDate,
    setShowModal,
    setStartDateTime,
    setEndDateTime,
  }) => {
    const baseDate = new Date(selectedDate);
    const [eventModalVisible, setEventModalVisible] = useState(false);
    const [eventModalData, setEventModalData] = useState<Partial<CalendarEvent>>({});
    // Helper function to get date string in YYYY-MM-DD format
const getLocalDateString = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };
const [newEventStart, setNewEventStart] = useState<Date | null>(null);
const [newEventEnd, setNewEventEnd] = useState<Date | null>(null);
const [newEventTitle, setNewEventTitle] = useState('');

  


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
        {/* Week Strip */}
        <View style={styles.weekStrip}>
          {weekDates.map((date, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => setSelectedDate(date)}
              style={styles.dateContainer}
            >
              <Text style={styles.dayText}>
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <Text style={styles.dateText}>{date.getDate()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      
        {/* Timetable */}
        <ScrollView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row' }}>
            {/* LEFT: Time indicators */}
            <View style={styles.timeColumn}>
            {hours.map((hour, idx) => (
                <View key={idx} style={styles.timeRow}>
                <Text style={styles.timeText}>{hour}</Text>
                </View>
            ))}
            </View>

      
          {/* RIGHT: Day columns */}
          <ScrollView horizontal style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row' }}>
              {weekDates.map((dayDate, dayIdx) => (
                <View key={dayIdx} style={[styles.dayColumn, dayIdx === 6 && { borderRightWidth: 0 }]}>
                  {hours.map((_, hourIdx) => (
                    <TouchableOpacity
                    key={hourIdx}
                    style={styles.cell}
                    onPress={() => {
                      const start = new Date(dayDate);
                      start.setHours(hourIdx, 0, 0, 0);
                  
                      const end = new Date(dayDate);
                      end.setHours(hourIdx + 1, 0, 0, 0);
                  
                      setStartDateTime(start);
                      setEndDateTime(end);
                      setSelectedDate(dayDate);
                      setShowModal(true);
                    }}
                    activeOpacity={0.6}
                  >
                  
                    {/* 🔥 Here is where you paste it */}
                    {events[getLocalDateString(dayDate)]?.map((event, idx) => {
  const eventStart = new Date(event.startDateTime!);
  const eventEnd = new Date(event.endDateTime!);
  const eventStartHour = eventStart.getHours();
  const eventEndHour = eventEnd.getHours();
  const durationInHours = eventEndHour - eventStartHour || 1; // prevent 0 height
  const calendarHour = (hourIdx + 6) % 24; 

  if (calendarHour === eventStartHour) { 
    return (
      <View key={event.id} style={{ position: 'absolute', top: 0, left: 2, right: 2 }}>
        <Swipeable
  friction={2}
  leftThreshold={80}
  rightThreshold={40}
  overshootRight={false}
  enableTrackpadTwoFingerGesture
  renderRightActions={() => (
    <TouchableOpacity
      style={{
        backgroundColor: 'red',
        justifyContent: 'center',
        alignItems: 'center',
        width: 70,
        height: 55 * durationInHours - 4,
        borderRadius: 6,
        marginVertical: 2,
      }}
      onPress={() => {
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
          <View
            style={{
              height: 55 * durationInHours - 4,
              backgroundColor: event.categoryColor || '#BF9264',
              borderRadius: 6,
              padding: 4,
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 10, color: 'white', fontWeight: 'bold' }} numberOfLines={1}>
              {event.title}
            </Text>
          </View>
        </Swipeable>
      </View>
    );
  }

  return null;
})}
                  </TouchableOpacity>
                  
                  ))}
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
      <Text style={styles.modalTitle}>Add Event</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter Title"
        value={newEventTitle}
        onChangeText={setNewEventTitle}
      />

      <View style={styles.modalActions}>
        <TouchableOpacity onPress={() => setEventModalVisible(false)}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => {
          if (!newEventTitle.trim() || !newEventStart || !newEventEnd) {
            alert('Please enter title');
            return;
          }

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

          setEventModalVisible(false); // ✅ close modal after saving
        }}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>


<EventModal
  visible={eventModalVisible}
  onClose={() => setEventModalVisible(false)}
  initialData={eventModalData}
  onSave={(newEvent) => {
    console.log('Saved Event:', newEvent);
    // 🚨 Here you should actually add it to your parent events state later
    setEventModalVisible(false);
  }}
/>

    </View>
  );
};

const styles = StyleSheet.create({
    weekStrip: {
        flexDirection: 'row',
        justifyContent: 'flex-end', // 🔥 push all dates to the right
        paddingVertical: 6,
        paddingHorizontal: 14, // 🔥 slight right/left padding
        borderBottomWidth: 1,
        borderColor: '#eee',
        backgroundColor: 'white',
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
        marginRight: -10
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
