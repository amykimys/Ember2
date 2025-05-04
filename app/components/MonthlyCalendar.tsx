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
          todayTextColor: '#6F4E37',
          dayTextColor: '#1a1a1a',
          textDisabledColor: '#DCD7C9',
          dotColor: '#007AFF',
          selectedDotColor: '#ffffff',
          arrowColor: '#6F4E37',
          monthTextColor: '#1a1a1a',
          indicatorColor: '#007AFF',
          textDayFontSize: 14,
          textMonthFontSize: 17,
          textDayHeaderFontSize: 12,
          'stylesheet.calendar.header': {
            monthText: {
              fontSize: 17,
              fontWeight: '500', // 👈 this makes the month bold
              color: '#1a1a1a',
              marginBottom: 15,
            },
            arrow: {
              color: '#6F4E37',
              marginHorizontal: 60, // Adjust this to get arrows closer/further
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
    },
  today: {
    backgroundColor: '#F5EFE7',
    borderRadius: 18,
  },
  selected: {
    backgroundColor: '#6F4E37',
    borderRadius: 18,
  },
  selectedText: {
    color: '#ffffff',
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