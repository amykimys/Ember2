import React from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

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

        <ScrollView style={{ flex: 1 }}>
        {hours.map((hour, idx) => (
            <View key={idx} style={styles.hourRow}>
            <Text style={styles.hourText}>{hour}</Text>
            <View style={styles.hourDivider} />
            </View>
        ))}
        </ScrollView>

      </View>
    );
  };

  return (
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
});

export default WeeklyCalendarView;
