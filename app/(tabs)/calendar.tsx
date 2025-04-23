import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { supabase } from '../../supabase';

type CalendarView = 'daily' | 'weekly' | 'monthly';

interface Event {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  date: string;
  user_id?: string;
}

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState('');
  const [currentView, setCurrentView] = useState<CalendarView>('monthly');
  const [currentWeek, setCurrentWeek] = useState<Date[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    title: '',
    description: '',
    startTime: new Date(),
    endTime: new Date(),
    date: selectedDate
  });

  // Load events when component mounts
  useEffect(() => {
    loadEvents();
  }, []);

  // Load events from Supabase
  const loadEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        return;
      }

      const { data: eventsData, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading events:', error);
        return;
      }

      if (eventsData) {
        // Convert string dates back to Date objects
        const formattedEvents = eventsData.map(event => ({
          ...event,
          startTime: new Date(event.start_time),
          endTime: new Date(event.end_time)
        }));
        setEvents(formattedEvents);
      }
    } catch (error) {
      console.error('Error in loadEvents:', error);
    }
  };

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

  // Function to get events for a specific date
  const getEventsForDate = (date: string) => {
    return events.filter(event => event.date === date);
  };

  // Function to get events for a specific week
  const getEventsForWeek = (weekDates: Date[]) => {
    return weekDates.map(date => ({
      date: date.toISOString().split('T')[0],
      events: getEventsForDate(date.toISOString().split('T')[0])
    }));
  };

  // Function to format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleAddEvent = () => {
    setShowEventModal(true);
  };

  const handleSaveEvent = async () => {
    if (newEvent.title && newEvent.startTime && newEvent.endTime) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('No user logged in');
          return;
        }

        const event: Event = {
          id: Date.now().toString(),
          title: newEvent.title,
          description: newEvent.description,
          startTime: newEvent.startTime,
          endTime: newEvent.endTime,
          date: selectedDate || new Date().toISOString().split('T')[0],
          user_id: user.id
        };

        // Save to Supabase
        const { error } = await supabase
          .from('events')
          .insert({
            id: event.id,
            title: event.title,
            description: event.description,
            start_time: event.startTime.toISOString(),
            end_time: event.endTime.toISOString(),
            date: event.date,
            user_id: user.id
          });

        if (error) {
          console.error('Error saving event:', error);
          return;
        }

        // Update local state
        setEvents(prevEvents => [...prevEvents, event]);
        setShowEventModal(false);
        setNewEvent({
          title: '',
          description: '',
          startTime: new Date(),
          endTime: new Date(),
          date: selectedDate
        });
      } catch (error) {
        console.error('Error in handleSaveEvent:', error);
      }
    }
  };

  // Render daily view
  const renderDailyView = () => {
    const date = new Date(selectedDate || new Date());
    const dateString = date.toISOString().split('T')[0];
    const dayEvents = getEventsForDate(dateString);
    console.log('Daily events:', dayEvents); // Debug log

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
          {dayEvents.length > 0 ? (
            dayEvents.map(event => (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventTime}>
                  <Text style={styles.eventTimeText}>
                    {formatTime(event.startTime)} - {formatTime(event.endTime)}
                  </Text>
                </View>
                <View style={styles.eventDetails}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {event.description && (
                    <Text style={styles.eventDescription}>{event.description}</Text>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.placeholderText}>No events for this day</Text>
          )}
        </ScrollView>
      </View>
    );
  };

  // Render weekly view
  const renderWeeklyView = () => {
    const weekEvents = getEventsForWeek(currentWeek);
    console.log('Week events:', weekEvents); // Debug log

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
          {currentWeek.map((date, index) => {
            const dayEvents = weekEvents[index].events;
            return (
              <View key={index} style={styles.weekDayColumn}>
                <Text style={styles.weekDayHeader}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={styles.weekDayNumber}>
                  {date.getDate()}
                </Text>
                <ScrollView style={styles.weekDayContent}>
                  {dayEvents.length > 0 ? (
                    dayEvents.map(event => (
                      <View key={event.id} style={styles.weekEventCard}>
                        <Text style={styles.weekEventTime}>
                          {formatTime(event.startTime)}
                        </Text>
                        <Text style={styles.weekEventTitle} numberOfLines={1}>
                          {event.title}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.placeholderText}>No events</Text>
                  )}
                </ScrollView>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // Render monthly view
  const renderMonthlyView = () => {
    const markedDates = events.reduce((acc, event) => {
      if (!acc[event.date]) {
        acc[event.date] = { dots: [] };
      }
      acc[event.date].dots.push({ color: '#007AFF' });
      return acc;
    }, {} as any);

    if (selectedDate) {
      markedDates[selectedDate] = {
        ...markedDates[selectedDate],
        selected: true,
        selectedColor: '#007AFF'
      };
    }

    console.log('Marked dates:', markedDates); // Debug log

    return (
      <View style={styles.monthlyContainer}>
        <RNCalendar
          current={selectedDate}
          onDayPress={(day: DateData) => {
            setSelectedDate(day.dateString);
          }}
          markedDates={markedDates}
          markingType="multi-dot"
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
            textDayFontSize: 18,
            textMonthFontSize: 20,
            textDayHeaderFontSize: 16,
            'stylesheet.calendar.header': {
              dayTextAtIndex0: {
                color: '#666',
                fontWeight: '600'
              },
              dayTextAtIndex1: {
                color: '#666',
                fontWeight: '600'
              },
              dayTextAtIndex2: {
                color: '#666',
                fontWeight: '600'
              },
              dayTextAtIndex3: {
                color: '#666',
                fontWeight: '600'
              },
              dayTextAtIndex4: {
                color: '#666',
                fontWeight: '600'
              },
              dayTextAtIndex5: {
                color: '#666',
                fontWeight: '600'
              },
              dayTextAtIndex6: {
                color: '#666',
                fontWeight: '600'
              }
            },
            'stylesheet.calendar.main': {
              week: {
                marginTop: 16,
                marginBottom: 16,
                flexDirection: 'row',
                justifyContent: 'space-around'
              }
            }
          }}
          style={{
            height: 500,
            marginTop: 16
          }}
        />
      </View>
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

      {/* Add Event Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddEvent}
      >
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>

      {/* Event Creation Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showEventModal}
        onRequestClose={() => setShowEventModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Event</Text>
              <TouchableOpacity onPress={() => setShowEventModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <TextInput
                style={styles.input}
                placeholder="Event Title"
                value={newEvent.title}
                onChangeText={(text) => setNewEvent({ ...newEvent, title: text })}
              />

              <TextInput
                style={[styles.input, styles.descriptionInput]}
                placeholder="Description (optional)"
                value={newEvent.description}
                onChangeText={(text) => setNewEvent({ ...newEvent, description: text })}
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color="#666" />
                <Text style={styles.timeButtonText}>
                  Start Time: {newEvent.startTime?.toLocaleTimeString()}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color="#666" />
                <Text style={styles.timeButtonText}>
                  End Time: {newEvent.endTime?.toLocaleTimeString()}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveEvent}
              >
                <Text style={styles.saveButtonText}>Save Event</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Time Pickers */}
      <DateTimePickerModal
        isVisible={showStartTimePicker}
        mode="time"
        onConfirm={(date) => {
          setNewEvent({ ...newEvent, startTime: date });
          setShowStartTimePicker(false);
        }}
        onCancel={() => setShowStartTimePicker(false)}
      />

      <DateTimePickerModal
        isVisible={showEndTimePicker}
        mode="time"
        onConfirm={(date) => {
          setNewEvent({ ...newEvent, endTime: date });
          setShowEndTimePicker(false);
        }}
        onCancel={() => setShowEndTimePicker(false)}
      />
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
    fontSize: 16,
  },
  monthlyContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalBody: {
    flex: 1,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  timeButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#1a1a1a',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  eventCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  eventTime: {
    marginBottom: 8,
  },
  eventTimeText: {
    color: '#666',
    fontSize: 14,
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
  },
  weekEventCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  weekEventTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  weekEventTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
}); 