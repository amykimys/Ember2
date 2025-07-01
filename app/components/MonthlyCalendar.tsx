import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import moment from 'moment';
import { Ionicons } from '@expo/vector-icons';

interface MonthlyCalendarProps {
  selectedDate: string;
  onDayPress: (day: DateData) => void;
}

const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({ selectedDate, onDayPress }) => {
  // Calculate min and max dates (5 years from January of previous year to December 2028)
  // Use startOf('day') to ensure we include the full day
  const currentYear = moment().year();
  const minDate = moment().year(currentYear - 1).month(0).date(1).startOf('day').format('YYYY-MM-DD');
  const maxDate = moment().year(2028).month(11).date(31).endOf('day').format('YYYY-MM-DD');
  const [currentDate, setCurrentDate] = useState(selectedDate);

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

  const handleArrowPress = (direction: 'left' | 'right') => {
    const currentMoment = moment(currentDate);
    const newMoment = moment(currentMoment);
    
    if (direction === 'left') {
      newMoment.subtract(1, 'month');
    } else {
      newMoment.add(1, 'month');
    }

    // Check if the new month is within bounds
    const minMoment = moment(minDate);
    const maxMoment = moment(maxDate);
    
    if (newMoment.isSameOrAfter(minMoment, 'month') && newMoment.isSameOrBefore(maxMoment, 'month')) {
      const newDate = newMoment.format('YYYY-MM-DD');
      setCurrentDate(newDate);
    }
  };

  const renderArrow = (direction: 'left' | 'right') => {
    const currentMoment = moment(currentDate);
    const minMoment = moment(minDate);
    const maxMoment = moment(maxDate);
    
    const isDisabled = direction === 'left' 
      ? currentMoment.isSameOrBefore(minMoment, 'month')
      : currentMoment.isSameOrAfter(maxMoment, 'month');

    return (
      <TouchableOpacity
        style={[
          styles.arrowButton,
          isDisabled && styles.arrowButtonDisabled
        ]}
        onPress={() => handleArrowPress(direction)}
        disabled={isDisabled}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name={direction === 'left' ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={isDisabled ? '#DCD7C9' : '#3A3A3A'}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <RNCalendar
        current={currentDate}
        onDayPress={handleDayPress}
        minDate={minDate}
        maxDate={maxDate}
        markedDates={{
          [selectedDate]: {
            selected: true,
            selectedColor: '#FF9A8B',
          },
          [moment().format('YYYY-MM-DD')]: {
            today: true,
            todayTextColor: '#FF9A8B',
          }
        }}
        enableSwipeMonths={true}
        hideExtraDays={false}
        disableAllTouchEventsForDisabledDays={false}
        renderArrow={renderArrow}
        theme={{
          backgroundColor: 'transparent',
          calendarBackground: 'transparent',
          textSectionTitleColor: '#666',
          selectedDayBackgroundColor: '#FF9A8B',
          selectedDayTextColor: '#ffffff',
          todayTextColor: '#FF9A8B',
          dayTextColor: '#3A3A3A',
          textDisabledColor: '#DCD7C9',
          dotColor: '#FF9A8B',
          selectedDotColor: '#ffffff',
          arrowColor: '#3A3A3A',
          monthTextColor: '#3A3A3A',
          indicatorColor: '#FF9A8B',
          textDayFontSize: 15,
          textMonthFontSize: 17,
          textDayHeaderFontSize: 13,
          textDayFontFamily: 'Onest',
          textMonthFontFamily: 'Onest',
          textDayHeaderFontFamily: 'Onest',
          'stylesheet.calendar.header': {
            header: {
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginBottom: 0,
            },
            monthText: {
              fontSize: 17,
              fontWeight: '400',
              color: '#3A3A3A',
              fontFamily: 'Onest',
              textTransform: 'capitalize',
              letterSpacing: -0.3,
            },
            dayHeader: {
              color: '#666',
              textAlign: 'center',
              fontSize: 13,
              fontFamily: 'Onest',
              fontWeight: '400',
              marginBottom: 8,
              opacity: 0.8,
            },
          },
          'stylesheet.calendar.main': {
            week: {
              marginTop: 6,
              marginBottom: 6,
              flexDirection: 'row',
              justifyContent: 'space-around',
            },
            container: {
              paddingLeft: 4,
              paddingRight: 4,
            },
          },
          'stylesheet.day.basic': {
            base: {
              width: 34,
              height: 34,
              alignItems: 'center',
              justifyContent: 'center',
            },
            text: {
              fontSize: 15,
              color: '#3A3A3A',
              backgroundColor: 'transparent',
              textAlign: 'center',
              fontFamily: 'Onest',
              fontWeight: '400',
              ...Platform.select({
                ios: {
                  marginTop: 2,
                },
                android: {
                  marginTop: 0,
                },
              }),
            },
            today: {
              backgroundColor: '#FAF9F6',
              borderRadius: 16,
            },
            selected: {
              backgroundColor: '#FF9A8B',
              borderRadius: 16,
              shadowColor: '#FF9A8B',
              shadowOffset: {
                width: 0,
                height: 1,
              },
              shadowOpacity: 0.15,
              shadowRadius: 2,
              elevation: 2,
            },
            selectedText: {
              color: '#ffffff',
              fontFamily: 'Onest',
              fontWeight: '500',
            },
            disabled: {
              opacity: 0.3,
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
    backgroundColor: 'transparent',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  calendar: {
    flex: 1,
    width: '100%',
  },
  arrowButton: {
    padding: 0,
    borderRadius: 12,
    opacity: 0.9,
  },
  arrowButtonDisabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.5,
  },
});

export default MonthlyCalendar; 