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
            selectedColor: '#007AFF'
          }
        }}
        theme={{
          backgroundColor: 'white',
          calendarBackground: 'white',
          textSectionTitleColor: '#666',
          selectedDayBackgroundColor: '#007AFF',
          selectedDayTextColor: '#ffffff',
          todayTextColor: '#007AFF',
          dayTextColor: '#1a1a1a',
          textDisabledColor: '#d9e1e8',
          dotColor: '#007AFF',
          selectedDotColor: '#ffffff',
          arrowColor: '#007AFF',
          monthTextColor: '#1a1a1a',
          indicatorColor: '#007AFF',
          textDayFontSize: 18,
          textMonthFontSize: 20,
          textDayHeaderFontSize: 16,
          'stylesheet.calendar.header': {
            header: {
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingLeft: 10,
              paddingRight: 10,
              marginTop: 6,
              alignItems: 'center',
              height: 50
            }
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