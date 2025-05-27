import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import moment from 'moment';

interface MonthlyCalendarProps {
  selectedDate: string;
  onDayPress: (day: DateData) => void;
}

const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({ selectedDate, onDayPress }) => {
  // Calculate min and max dates (1 year in the past and 2 years in the future)
  // Use startOf('day') to ensure we include the full day
  const minDate = moment().subtract(1, 'year').startOf('day').format('YYYY-MM-DD');
  const maxDate = moment().add(2, 'years').endOf('day').format('YYYY-MM-DD');

  // Handle day press with proper date validation
  const handleDayPress = (day: DateData) => {
    const pressedDate = moment(day.dateString);
    const minMoment = moment(minDate);
    const maxMoment = moment(maxDate);

    // Allow selection if the date is within or equal to the min/max dates
    if (pressedDate.isSameOrAfter(minMoment, 'day') && pressedDate.isSameOrBefore(maxMoment, 'day')) {
      onDayPress(day);
    }
  };

  return (
    <View style={styles.container}>
      <RNCalendar
        current={selectedDate}
        onDayPress={handleDayPress}
        minDate={minDate}
        maxDate={maxDate}
        markedDates={{
          [selectedDate]: {
            selected: true,
          }
        }}
        enableSwipeMonths={true}
        hideExtraDays={false}
        disableAllTouchEventsForDisabledDays={false} // Changed to false to allow interaction with end dates
        theme={{
          backgroundColor: 'white',
          calendarBackground: 'white',
          textSectionTitleColor: '#666',
          todayTextColor: '#FF9A8B',
          dayTextColor: '#1a1a1a',
          textDisabledColor: '#DCD7C9',
          dotColor: '#007AFF',
          selectedDotColor: '#ffffff',
          arrowColor: '#FF9A8B',
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
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              height: 44,
            },
            monthText: {
              fontSize: 17,
              fontWeight: '500',
              color: '#1a1a1a',
              fontFamily: 'Onest',
            },
            arrow: {
              padding: 10,
            },
            dayHeader: {
              color: '#666',
              textAlign: 'center',
              fontSize: 12,
              fontFamily: 'Onest',
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
  }
});

export default MonthlyCalendar; 