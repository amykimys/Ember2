import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Dimensions } from 'react-native';
import { Calendar as RNCalendar, DateData, Agenda, CalendarProps } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { supabase } from '../../supabase';
import styles from '../../styles/calendar.styles';

type CalendarView = 'month' | 'week' | 'day';

interface Event {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  date: string;
  user_id?: string;
}

interface AgendaItem {
  name: string;
  height: number;
  day: string;
}

const CalendarScreen: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentView, setCurrentView] = useState<CalendarView>('month');
  const [events, setEvents] = useState<Event[]>([]);
  const [agendaItems, setAgendaItems] = useState<{ [key: string]: AgendaItem[] }>({});
  const [showEventModal, setShowEventModal] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
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

  // Convert events to agenda items
  useEffect(() => {
    const items: { [key: string]: AgendaItem[] } = {};
    events.forEach(event => {
      const date = event.date;
      if (!items[date]) {
        items[date] = [];
      }
      items[date].push({
        name: event.title,
        height: 50,
        day: date
      });
    });
    setAgendaItems(items);
  }, [events]);

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
          date: selectedDate,
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

  const getWeekDates = (date: string) => {
    const startDate = new Date(date);
    const day = startDate.getDay();
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(startDate.setDate(diff));
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + i);
      dates.push(currentDate.toISOString().split('T')[0]);
    }
    return dates;
  };

  const getHours = () => {
    const hours = [];
    for (let i = 0; i < 24; i++) {
      hours.push(i);
    }
    return hours;
  };

  const renderWeekView = () => {
    const weekDates = getWeekDates(selectedDate);
    const weekStart = new Date(weekDates[0]);
    const weekEnd = new Date(weekDates[6]);
    const hours = getHours();

    return (
      <View style={styles.weekContainer}>
        <View style={styles.weekHeader}>
          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={() => {
              const newDate = new Date(weekStart);
              newDate.setDate(newDate.getDate() - 7);
              setSelectedDate(newDate.toISOString().split('T')[0]);
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.weekHeaderText}>
            {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
            {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={() => {
              const newDate = new Date(weekEnd);
              newDate.setDate(newDate.getDate() + 1);
              setSelectedDate(newDate.toISOString().split('T')[0]);
            }}
          >
            <Ionicons name="chevron-forward" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.weekGrid}>
          <View style={styles.weekGridHeader}>
            <View style={styles.timeColumn} />
            {weekDates.map(date => (
              <View key={date} style={styles.dayColumn}>
                <Text style={styles.dayHeader}>
                  {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={styles.dateHeader}>
                  {new Date(date).getDate()}
                </Text>
              </View>
            ))}
          </View>
          <ScrollView style={styles.weekGridBody}>
            {hours.map(hour => (
              <View key={hour} style={styles.hourRow}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeText}>
                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                  </Text>
                </View>
                {weekDates.map(date => (
                  <View key={`${date}-${hour}`} style={styles.dayColumn}>
                    {events
                      .filter(event => {
                        const eventDate = new Date(event.date);
                        const eventHour = event.startTime.getHours();
                        return event.date === date && eventHour === hour;
                      })
                      .map(event => (
                        <TouchableOpacity
                          key={event.id}
                          style={styles.weekEventItem}
                          onPress={() => {
                            // Handle event press
                          }}
                        >
                          <Text style={styles.weekEventTime}>
                            {event.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - 
                            {event.endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </Text>
                          <Text style={styles.weekEventTitle}>{event.title}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderDayStrip = (date: string) => {
    const weekDates = getWeekDates(date);
    return (
      <View style={styles.weekStrip}>
        {weekDates.map(weekDate => (
          <TouchableOpacity
            key={weekDate}
            style={[
              styles.weekDayStrip,
              weekDate === selectedDate && styles.selectedWeekDayStrip
            ]}
            onPress={() => setSelectedDate(weekDate)}
          >
            <Text style={[
              styles.weekDayStripText,
              weekDate === selectedDate && styles.selectedWeekDayStripText
            ]}>
              {new Date(weekDate).toLocaleDateString('en-US', { weekday: 'short' })}
            </Text>
            <Text style={[
              styles.weekDayStripDate,
              weekDate === selectedDate && styles.selectedWeekDayStripText
            ]}>
              {new Date(weekDate).getDate()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderViewSelector = () => (
    <View style={styles.viewSelector}>
      <TouchableOpacity
        style={[styles.viewButton, currentView === 'day' && styles.activeViewButton]}
        onPress={() => setCurrentView('day')}
      >
        <Text style={[styles.viewButtonText, currentView === 'day' && styles.activeViewButtonText]}>
          Daily
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.viewButton, currentView === 'week' && styles.activeViewButton]}
        onPress={() => setCurrentView('week')}
      >
        <Text style={[styles.viewButtonText, currentView === 'week' && styles.activeViewButtonText]}>
          Weekly
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.viewButton, currentView === 'month' && styles.activeViewButton]}
        onPress={() => setCurrentView('month')}
      >
        <Text style={[styles.viewButtonText, currentView === 'month' && styles.activeViewButtonText]}>
          Monthly
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderDayView = () => {
    return (
      <View style={styles.weekContainer}>
        <View style={styles.weekHeader}>
          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() - 1);
              setSelectedDate(newDate.toISOString().split('T')[0]);
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.weekHeaderText}>
            {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() + 1);
              setSelectedDate(newDate.toISOString().split('T')[0]);
            }}
          >
            <Ionicons name="chevron-forward" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
        {renderDayStrip(selectedDate)}
        <ScrollView style={styles.weekEventsContainer}>
          <View style={styles.weekDayContainer}>
            {events
              .filter(event => event.date === selectedDate)
              .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
              .map(event => (
                <View key={event.id} style={styles.weekEventItem}>
                  <Text style={styles.weekEventTime}>
                    {event.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - 
                    {event.endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                  <Text style={styles.weekEventTitle}>{event.title}</Text>
                </View>
              ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderMonthView = () => {
    const markedDates = {
      [selectedDate]: {
        selected: true,
        selectedColor: '#007AFF',
      }
    };

    return (
      <View style={styles.weekContainer}>
        <RNCalendar
          current={selectedDate}
          onDayPress={(day: DateData) => {
            setSelectedDate(day.dateString);
          }}
          markedDates={markedDates}
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            textSectionTitleColor: '#b6c1cd',
            selectedDayBackgroundColor: '#007AFF',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#007AFF',
            dayTextColor: '#2d4150',
            textDisabledColor: '#d9e1e8',
            dotColor: '#007AFF',
            selectedDotColor: '#ffffff',
            arrowColor: '#007AFF',
            monthTextColor: '#2d4150',
            indicatorColor: '#007AFF',
            textDayFontWeight: '300',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '300',
            textDayFontSize: 16,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 16
          }}
          hideExtraDays={false}
          showWeekNumbers={true}
          firstDay={1}
        />
        <ScrollView style={styles.weekEventsContainer}>
          <View style={styles.weekDayContainer}>
            <Text style={styles.weekDayHeader}>
              {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            {events
              .filter(event => event.date === selectedDate)
              .map(event => (
                <View key={event.id} style={styles.weekEventItem}>
                  <Text style={styles.weekEventTime}>
                    {event.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - 
                    {event.endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                  <Text style={styles.weekEventTitle}>{event.title}</Text>
                </View>
              ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderCalendar = () => {
    switch (currentView) {
      case 'day':
        return renderDayView();
      case 'week':
        return renderWeekView();
      case 'month':
        return renderMonthView();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>calendar</Text>
      </View>

      {renderViewSelector()}
      {renderCalendar()}

      {/* Add Event Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowEventModal(true)}
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
};

export default CalendarScreen;