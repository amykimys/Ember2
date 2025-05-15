import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';

interface MonthlyCalendarProps {
  selectedDate: string;
  onDayPress: (day: DateData) => void;
}

const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({ selectedDate, onDayPress }) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);

  const onGestureEvent = (event: any) => {
    const { translationX } = event.nativeEvent;
    if (Math.abs(translationX) > 50) { // Threshold for swipe
      const newDate = moment(currentMonth);
      if (translationX > 0) {
        // Swipe right - go to previous month
        newDate.subtract(1, 'month');
      } else {
        // Swipe left - go to next month
        newDate.add(1, 'month');
      }
      setCurrentMonth(newDate.format('YYYY-MM-DD'));
    }
  };

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      // Reset the gesture handler state
      event.nativeEvent.translationX = 0;
    }
  };

  const handlePrevMonth = () => {
    const newDate = moment(currentMonth).subtract(1, 'month');
    setCurrentMonth(newDate.format('YYYY-MM-DD'));
  };

  const handleNextMonth = () => {
    const newDate = moment(currentMonth).add(1, 'month');
    setCurrentMonth(newDate.format('YYYY-MM-DD'));
  };

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={[-20, 20]}
    >
      <View style={styles.container}>
        <RNCalendar
          current={currentMonth}
          onDayPress={onDayPress}
          markedDates={{
            [selectedDate]: {
              selected: true,
            }
          }}
          renderHeader={(date: DateData) => {
            const month = moment(date.dateString).format('MMMM YYYY');
            return (
              <View style={styles.headerContainer}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.headerButton}>
                  <Ionicons name="chevron-back" size={20} color="#FF9A8B" />
                </TouchableOpacity>
                <Text style={styles.headerText}>{month}</Text>
                <TouchableOpacity onPress={handleNextMonth} style={styles.headerButton}>
                  <Ionicons name="chevron-forward" size={20} color="#FF9A8B" />
                </TouchableOpacity>
              </View>
            );
          }}
          theme={{
            backgroundColor: 'white',
            calendarBackground: 'white',
            textSectionTitleColor: '#666',
            todayTextColor: '#FF9A8B',
            dayTextColor: '#1a1a1a',
            textDisabledColor: '#DCD7C9',
            dotColor: '#007AFF',
            selectedDotColor: '#ffffff',
            arrowColor: 'transparent', // Hide default arrows
            monthTextColor: '#1a1a1a',
            indicatorColor: '#007AFF',
            textDayFontSize: 14,
            textMonthFontSize: 17,
            textDayHeaderFontSize: 12,
            textDayFontFamily: 'Onest',
            textMonthFontFamily: 'Onest',
            textDayHeaderFontFamily: 'Onest',
            'stylesheet.calendar.header': {
              header: {
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                paddingLeft: 10,
                paddingRight: 10,
                height: 44,
              },
            },
            'stylesheet.day.basic': {
              base: {
                width: 33,
                height: 33,
                alignItems: 'center',
                justifyContent: 'center',
              },
              text: {
                fontSize: 14,
                color: '#1a1a1a',
                backgroundColor: 'transparent',
                textAlign: 'center',
                marginTop: 5,
                fontFamily: 'Onest',
              },
              today: {
                backgroundColor: '#FAF9F6',
                borderRadius: 18,
              },
              selected: {
                backgroundColor: '#FF9A8B',
                borderRadius: 18,
              },
              selectedText: {
                color: '#ffffff',
                fontFamily: 'Onest',
              },
            }
          }}
          style={styles.calendar}
        />
      </View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'white'
  },
  calendar: {
    flex: 1,
    width: '100%',
    height: '100%'
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#1a1a1a',
    fontFamily: 'Onest',
    textAlign: 'center',
  },
  headerButton: {
    marginHorizontal: 35,
  }
});

export default MonthlyCalendar; 