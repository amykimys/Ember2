import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';

interface MonthlyCalendarProps {
  selectedDate: string;
  onDayPress: (day: DateData) => void;
}

const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({ selectedDate, onDayPress }) => {
  return (
    <View style={styles.container}>
      <RNCalendar
        current={selectedDate}
        onDayPress={onDayPress}
        markedDates={{
          [selectedDate]: {
            selected: true,
          }
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
            monthText: {
              fontSize: 17,
              fontWeight: '500',
              color: '#1a1a1a',
              marginBottom: 15,
              fontFamily: 'Onest',
            },
            arrow: {
              color: '#FF9A8B',
              marginHorizontal: 60,
              marginBottom: 15,
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