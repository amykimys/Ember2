import React, { useState } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, TouchableOpacity, Dimensions, Modal, TextInput, Button } from 'react-native';
import EventModal from '../components/EventModal';

const SCREEN_WIDTH = Dimensions.get('window').width;

// 🛠 ADD THIS LINE:
const TIME_COLUMN_WIDTH = 50;

// 🛠 ADD THIS LINE TOO:
const DAY_COLUMN_WIDTH = (SCREEN_WIDTH - TIME_COLUMN_WIDTH) / 7;
const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

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
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}

const WeeklyCalendarView: React.FC<WeeklyCalendarViewProps> = ({ events, selectedDate, setSelectedDate }) => {
  const baseDate = new Date(selectedDate);
  const [eventModalVisible, setEventModalVisible] = useState(false);
    const [eventModalData, setEventModalData] = useState<Partial<CalendarEvent>>({});


  const getWeekStartDate = (offsetWeeks = 0) => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - date.getDay() + offsetWeeks * 7);
    return date;
  };

  const weeks = Array.from({ length: 100 }, (_, i) => getWeekStartDate(i - 50)); // 50 weeks past, 50 weeks future

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
          {weekDates.map((date, idx) => {
            const isToday = date.toDateString() === new Date().toDateString();
            const isSelected = date.toDateString() === selectedDate.toDateString();
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => setSelectedDate(date)}
                style={[
                  styles.dateContainer,
                  isToday && styles.todayHighlight,
                  isSelected && styles.selectedHighlight,
                ]}
              >
                <Text style={styles.dayText}>{date.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                <Text style={styles.dateText}>{date.getDate()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
  
        {/* Timetable */}
        <View style={{ flexDirection: 'row', flex: 1 }}>
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
                      onPress={() => handleAddEvent(dayDate, hourIdx)}
                      activeOpacity={0.6}
                    >
                      {/* empty cell */}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
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
      },
      dateText: {
        fontSize: 13, // 🔥 smaller number size
        fontWeight: '700', // make date numbers pop
        color: '#333',
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
  },
  
  
});

export default WeeklyCalendarView;
