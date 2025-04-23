import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';

type CalendarView = 'daily' | 'weekly' | 'monthly';

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState('');
  const [currentView, setCurrentView] = useState<CalendarView>('monthly');
  const [currentWeek, setCurrentWeek] = useState<Date[]>([]);

  // Function to generate week dates
  const generateWeekDates = (startDate: Date) => {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      week.push(date);
    }
    return week;
  };

  // Initialize current week when component mounts
  React.useEffect(() => {
    const today = new Date();
    const week = generateWeekDates(today);
    setCurrentWeek(week);
  }, []);

  // Function to handle week navigation
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newStartDate = new Date(currentWeek[0]);
    newStartDate.setDate(newStartDate.getDate() + (direction === 'prev' ? -7 : 7));
    setCurrentWeek(generateWeekDates(newStartDate));
  };

  // Function to handle day navigation
  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate || new Date());
    newDate.setDate(newDate.getDate() + (direction === 'prev' ? -1 : 1));
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  // Render daily view
  const renderDailyView = () => {
    const date = new Date(selectedDate || new Date());
    return (
      <View style={styles.dailyContainer}>
        <View style={styles.navigationHeader}>
          <TouchableOpacity onPress={() => navigateDay('prev')}>
            <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.dateText}>
            {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => navigateDay('next')}>
            <Ionicons name="chevron-forward" size={24} color="#1a1a1a" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.dailyContent}>
          {/* Add your daily schedule content here */}
          <Text style={styles.placeholderText}>Daily schedule will be displayed here</Text>
        </ScrollView>
      </View>
    );
  };

  // Render weekly view
  const renderWeeklyView = () => {
    return (
      <View style={styles.weeklyContainer}>
        <View style={styles.navigationHeader}>
          <TouchableOpacity onPress={() => navigateWeek('prev')}>
            <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.dateText}>
            {currentWeek[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - 
            {currentWeek[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => navigateWeek('next')}>
            <Ionicons name="chevron-forward" size={24} color="#1a1a1a" />
          </TouchableOpacity>
        </View>
        <View style={styles.weekGrid}>
          {currentWeek.map((date, index) => (
            <View key={index} style={styles.weekDayColumn}>
              <Text style={styles.weekDayHeader}>
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <Text style={styles.weekDayNumber}>
                {date.getDate()}
              </Text>
              <View style={styles.weekDayContent}>
                {/* Add your weekly schedule content here */}
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Render monthly view
  const renderMonthlyView = () => {
    return (
      <RNCalendar
        current={selectedDate}
        onDayPress={(day: DateData) => {
          setSelectedDate(day.dateString);
        }}
        markedDates={{
          [selectedDate]: {
            selected: true,
            selectedColor: '#007AFF'
          }
        }}
        theme={{
          backgroundColor: 'transparent',
          calendarBackground: 'transparent',
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
          textDayFontSize: 16,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 14
        }}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>calendar</Text>
      </View>

      <View style={styles.viewSelector}>
        <TouchableOpacity
          style={[styles.viewButton, currentView === 'daily' && styles.activeViewButton]}
          onPress={() => setCurrentView('daily')}
        >
          <Text style={[styles.viewButtonText, currentView === 'daily' && styles.activeViewButtonText]}>
            Daily
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewButton, currentView === 'weekly' && styles.activeViewButton]}
          onPress={() => setCurrentView('weekly')}
        >
          <Text style={[styles.viewButtonText, currentView === 'weekly' && styles.activeViewButtonText]}>
            Weekly
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewButton, currentView === 'monthly' && styles.activeViewButton]}
          onPress={() => setCurrentView('monthly')}
        >
          <Text style={[styles.viewButtonText, currentView === 'monthly' && styles.activeViewButtonText]}>
            Monthly
          </Text>
        </TouchableOpacity>
      </View>

      {currentView === 'daily' && renderDailyView()}
      {currentView === 'weekly' && renderWeeklyView()}
      {currentView === 'monthly' && renderMonthlyView()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  viewSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  viewButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  activeViewButton: {
    backgroundColor: '#007AFF',
  },
  viewButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  activeViewButtonText: {
    color: 'white',
  },
  dailyContainer: {
    flex: 1,
  },
  weeklyContainer: {
    flex: 1,
  },
  navigationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  dailyContent: {
    flex: 1,
    padding: 16,
  },
  weekGrid: {
    flex: 1,
    flexDirection: 'row',
  },
  weekDayColumn: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    padding: 8,
  },
  weekDayHeader: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  weekDayContent: {
    flex: 1,
  },
  placeholderText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
}); 