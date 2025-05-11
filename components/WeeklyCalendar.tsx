import React, { useState, useRef } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, TouchableOpacity, Dimensions, Modal, TextInput, Button, Alert } from 'react-native';
import EventModal from '../components/EventModal';
import { Swipeable } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons'; 
import { supabase } from '../supabase'; 




const SCREEN_WIDTH = Dimensions.get('window').width;

// 🛠 ADD THIS LINE:
const TIME_COLUMN_WIDTH = 40;

// 🛠 ADD THIS LINE TOO:
const DAY_COLUMN_WIDTH = (SCREEN_WIDTH - TIME_COLUMN_WIDTH) / 7;
const HOURS = Array.from({ length: 24 }, (_, i) => (i + 6) % 24); // Start from 6am, 24 hours total to include 6am to 5am next day

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
    setEvents: React.Dispatch<React.SetStateAction<{ [date: string]: CalendarEvent[] }>>;
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    setShowModal: (show: boolean) => void;
    setStartDateTime: (date: Date) => void;
    setEndDateTime: (date: Date) => void;
  
    // 🛠 ADD THESE 9 LINES:
    setSelectedEvent: React.Dispatch<React.SetStateAction<{ event: CalendarEvent; dateKey: string; index: number } | null>>;
    setEditedEventTitle: React.Dispatch<React.SetStateAction<string>>;
    setEditedEventDescription: React.Dispatch<React.SetStateAction<string>>;
    setEditedStartDateTime: React.Dispatch<React.SetStateAction<Date>>;
    setEditedEndDateTime: React.Dispatch<React.SetStateAction<Date>>;
    setEditedSelectedCategory: React.Dispatch<React.SetStateAction<{ name: string; color: string; id?: string } | null>>;
    setEditedReminderTime: React.Dispatch<React.SetStateAction<Date | null>>;
    setEditedRepeatOption: React.Dispatch<React.SetStateAction<'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom'>>;
    setEditedRepeatEndDate: React.Dispatch<React.SetStateAction<Date | null>>;
    setShowEditEventModal: (show: boolean) => void;
    hideHeader?: boolean;
  }

  const WeeklyCalendarView: React.FC<WeeklyCalendarViewProps> = ({
    events,
    setEvents,
    selectedDate,
    setSelectedDate,
    setShowModal,
    setStartDateTime,
    setEndDateTime,
  
    // 🛠 ADD THESE (edit-related):
    setSelectedEvent,
    setEditedEventTitle,
    setEditedEventDescription,
    setEditedStartDateTime,
    setEditedEndDateTime,
    setEditedSelectedCategory,
    setEditedReminderTime,
    setEditedRepeatOption,
    setEditedRepeatEndDate,
    setShowEditEventModal,
    hideHeader = false,
  }) => {
  
    const baseDate = new Date(selectedDate);
    const flatListRef = useRef<FlatList>(null);
    const [eventModalVisible, setEventModalVisible] = useState(false);
    const [eventModalData, setEventModalData] = useState<Partial<CalendarEvent>>({});
    const [newEventStart, setNewEventStart] = useState<Date | null>(null);
    const [newEventEnd, setNewEventEnd] = useState<Date | null>(null);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [isStartTime, setIsStartTime] = useState(true);
    const [tempHour, setTempHour] = useState('');

    const isToday = (date: Date) => {
        const today = new Date();
        return (
          date.getFullYear() === today.getFullYear() &&
          date.getMonth() === today.getMonth() &&
          date.getDate() === today.getDate()
        );
      };
      


    const getWeekStartDate = (offsetWeeks = 0) => {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - date.getDay() + offsetWeeks * 7);
      return date;
    };

    const weeks = Array.from({ length: 100 }, (_, i) => getWeekStartDate(i - 50)); // 50 weeks past, 50 weeks future

    const handleSaveNewEvent = (dayDate: Date, hour: number) => {
      const start = new Date(dayDate);
      start.setHours(hour, 0, 0, 0);
    
      const end = new Date(dayDate);
      end.setHours(hour + 1, 0, 0, 0);
    
      const newEvent: CalendarEvent = {
        id: Date.now().toString(),
        title: 'New Event',
        description: '',
        date: start.toISOString().split('T')[0],
        startDateTime: start,
        endDateTime: end,
        categoryName: '',
        categoryColor: '#BF9264',
        reminderTime: null,
        repeatOption: 'None',
        repeatEndDate: null,
        isContinued: false,
      };
    
      setEvents(prev => {
        const updated = { ...prev };
        const dateKey = newEvent.date;
    
        if (!updated[dateKey]) updated[dateKey] = [];
        updated[dateKey].push(newEvent);
    
        return updated;
      });
    };
    

    const calculateEventPosition = (event: CalendarEvent, date: Date) => {
      if (!event.startDateTime || !event.endDateTime) return null;

      const startTime = new Date(event.startDateTime);
      const endTime = new Date(event.endDateTime);
      const cellHeight = 55; // Height of each time slot cell

      // Get the start of the current day at 7am
      const dayStart = new Date(date);
      dayStart.setHours(7, 0, 0, 0);

      // Calculate minutes from 7am
      const startMinutes = (startTime.getTime() - dayStart.getTime()) / (1000 * 60);
      const endMinutes = (endTime.getTime() - dayStart.getTime()) / (1000 * 60);

      // If the event starts before 7am, adjust it to start at 7am
      const adjustedStartMinutes = Math.max(0, startMinutes);
      const adjustedEndMinutes = Math.max(adjustedStartMinutes + 30, endMinutes); // Ensure minimum 30 min duration

      // Calculate position and height
      const top = (adjustedStartMinutes / 60) * cellHeight;
      const height = Math.max(((adjustedEndMinutes - adjustedStartMinutes) / 60) * cellHeight, 20); // Minimum height of 20

      return { top, height };
    };

    const calculateNumberOfLines = (height: number) => {
      const lineHeight = 16; // Match the lineHeight in styles
      const padding = 8; // Account for padding (4px top + 4px bottom)
      const availableHeight = height - padding;
      const lines = Math.floor(availableHeight / lineHeight);
      return Math.max(1, Math.min(lines, 5)); // Between 1 and 5 lines
    };

    const renderWeek = ({ item: weekStart }: { item: Date }) => {
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return date;
    });

    const handleAddEvent = (dayDate: Date, hour: number) => {
      const start = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour, 0, 0);
      const end = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour + 1, 0, 0);

      setStartDateTime(start);
      setEndDateTime(end);
      setShowModal(true);
    };

    return (
      <View style={{ flex: 1 }}>
        {/* Date Headers */}
        <View style={{ 
          flexDirection: 'row', 
          borderBottomWidth: 1, 
          borderColor: '#EEEEEE',
          backgroundColor: 'white',
          paddingTop: 8,
          paddingBottom: 8,
        }}>
          <View style={{ width: TIME_COLUMN_WIDTH }} />
          {weekDates.map((date, idx) => (
            <View 
              key={idx} 
              style={{ 
                width: DAY_COLUMN_WIDTH, 
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ 
                fontSize: 12, 
                color: '#666',
                fontFamily: 'Onest',
                marginBottom: 2,
              }}>
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <Text style={{ 
                fontSize: 13, 
                color: isToday(date) ? '#A0C3B2' : '#333',
                fontWeight: isToday(date) ? '700' : '400',
                fontFamily: 'Onest',
              }}>
                {date.getDate()}
              </Text>
            </View>
          ))}
        </View>

        {/* Time Grid */}
        <ScrollView style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row' }}>
            {/* Time Column */}
            <View style={styles.timeColumn}>
              {HOURS.map((hour, hourIndex) => (
                <View key={`time-${hourIndex}`} style={styles.timeRow}>
                  <Text style={styles.timeText}>
                    {hour === 0 ? '12a' : 
                     hour === 12 ? '12p' : 
                     hour < 12 ? `${hour}a` : `${hour - 12}p`}
                  </Text>
                </View>
              ))}
            </View>

            {/* Day Columns */}
            {weekDates.map((date, dayIndex) => {
              const dateKey = getLocalDateString(date);
              const dayEvents = events[dateKey] || [];

              return (
                <View key={dayIndex} style={styles.dayColumn}>
                  {HOURS.map((hour, hourIndex) => {
                    const cellStartTime = new Date(date);
                    cellStartTime.setHours(hour, 0, 0, 0);
                    const cellEndTime = new Date(date);
                    cellEndTime.setHours(hour + 1, 0, 0, 0);

                    // Find events that overlap with this time slot
                    const overlappingEvents = dayEvents.filter(event => {
                      if (!event.startDateTime || !event.endDateTime) return false;
                      const eventStart = new Date(event.startDateTime);
                      const eventEnd = new Date(event.endDateTime);
                      return eventStart < cellEndTime && eventEnd > cellStartTime;
                    });

                    return (
                      <TouchableOpacity
                        key={`${dayIndex}-${hourIndex}`}
                        style={styles.cell}
                        onPress={() => handleAddEvent(date, hour)}
                      >
                        {overlappingEvents.map((event, eventIndex) => {
                          const position = calculateEventPosition(event, date);
                          if (!position) return null;

                          // Only render the event in the first cell it appears in
                          const eventStart = new Date(event.startDateTime!);
                          const isFirstCell = eventStart.getHours() === hour;

                          if (!isFirstCell) return null;

                          const numberOfLines = calculateNumberOfLines(position.height);

                          return (
                            <TouchableOpacity
                              key={`${event.id}-${dayIndex}-${hourIndex}-${eventIndex}`}
                              onLongPress={() => {
                                setSelectedEvent({ event, dateKey, index: eventIndex });
                                setEditedEventTitle(event.title);
                                setEditedEventDescription(event.description ?? '');
                                setEditedStartDateTime(new Date(event.startDateTime!));
                                setEditedEndDateTime(new Date(event.endDateTime!));
                                setEditedSelectedCategory(event.categoryName ? { name: event.categoryName, color: event.categoryColor! } : null);
                                setEditedReminderTime(event.reminderTime ? new Date(event.reminderTime) : null);
                                setEditedRepeatOption(event.repeatOption || 'None');
                                setEditedRepeatEndDate(event.repeatEndDate ? new Date(event.repeatEndDate) : null);
                                setShowEditEventModal(true);
                              }}
                              style={[
                                styles.eventBox,
                                {
                                  top: position.top,
                                  height: position.height,
                                  backgroundColor: `${event.categoryColor || '#FF9A8B'}20`,
                                }
                              ]}
                            >
                              <Text
                                numberOfLines={numberOfLines}
                                style={styles.eventText}
                              >
                                {event.title}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  // Helper function to get date string in YYYY-MM-DD format
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <View style={{ flex: 1 }}>

      <FlatList
      ref={flatListRef} 
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

    </View>
  );
};

const styles = StyleSheet.create({
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#F0E1D2',
    backgroundColor: 'white',
  },
  dateContainer: {
    width: 25,
    alignItems: 'center',
    paddingVertical: 2,
    marginLeft: 30,
  },
  dayText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
    fontFamily: 'Onest',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Onest',
  },
  timeColumn: {
    width: TIME_COLUMN_WIDTH,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderColor: '#EEEEEE',
  },
  timeRow: {
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#EEEEEE',
  },
  timeText: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'Onest',
  },
  dayColumn: {
    width: DAY_COLUMN_WIDTH,
    borderRightWidth: 1,
    borderColor: '#EEEEEE',
    backgroundColor: 'white',
  },
  cell: {
    height: 55,
    borderBottomWidth: 1,
    borderColor: '#EEEEEE',
    position: 'relative',
  },
  eventBox: {
    position: 'absolute',
    left: 2,
    right: 2,
    backgroundColor: '#FF9A8B20',
    borderRadius: 4,
    padding: 4,
    zIndex: 1,
    minHeight: 20, // Add minimum height
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
    fontFamily: 'Onest',
  },
  input: {
    width: '100%',
    height: 44,
    borderColor: '#F0E1D2',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 15,
    fontFamily: 'Onest',
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 24,
    gap: 12,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
    fontFamily: 'Onest',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '500',
    fontSize: 15,
    fontFamily: 'Onest',
  },
  eventBubble: {
    margin: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#BF9264',
  },
  eventText: {
    fontSize: 11,
    color: '#333',
    fontFamily: 'Onest',
    lineHeight: 16, // Add line height for better text spacing
  },
});

export default WeeklyCalendarView;
