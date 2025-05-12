import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, TouchableOpacity, Dimensions, Modal, TextInput, Button, Alert } from 'react-native';
import EventModal from '../components/EventModal';
import { Swipeable } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons'; 
import { supabase } from '../supabase'; 


const SCREEN_WIDTH = Dimensions.get('window').width;
const TIME_COLUMN_WIDTH = 48; // Google Calendar style time column width
const DAY_COLUMN_WIDTH = (SCREEN_WIDTH - TIME_COLUMN_WIDTH) / 7;
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23 hours
const CELL_HEIGHT = 48; // Google Calendar style cell height

// Add your CalendarEvent here ✅
interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    date: string; // "2025-05-12"
    startTime: string; // "14:00"
    endTime: string;   // "15:30"
    categoryName?: string;
    categoryColor?: string;
    reminderTime?: string | null;
    repeatOption?: 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom';
    repeatEndDate?: string | null;
    isContinued?: boolean;
  }

export interface WeeklyCalendarViewRef {
  scrollToWeek: (date: Date) => void;
}

interface WeeklyCalendarViewProps {
    events: { [date: string]: CalendarEvent[] };
    setEvents: React.Dispatch<React.SetStateAction<{ [date: string]: CalendarEvent[] }>>;
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    setShowModal: (show: boolean) => void;
    setStartDateTime: (date: Date) => void;
    setEndDateTime: (date: Date) => void;
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
    setVisibleWeekMonth: (date: Date) => void;
    setVisibleWeekMonthText: React.Dispatch<React.SetStateAction<string>>;
    visibleWeekMonthText: string;
}

// Update utility functions for date handling
const toUTC = (date: Date): Date => {
  // Create a new date object to avoid modifying the input
  const localDate = new Date(date);
  // Get the timezone offset in minutes
  const offset = localDate.getTimezoneOffset();
  // Add the offset to convert to UTC
  // Note: getTimezoneOffset() returns minutes, so we multiply by 60000 to get milliseconds
  // We ADD the offset because getTimezoneOffset() returns positive for negative offsets
  const utcTime = localDate.getTime() + (offset * 60000);
  return new Date(utcTime);
};

const fromUTC = (utcDate: Date): Date => {
  // Create a new date object to avoid modifying the input
  const date = new Date(utcDate);
  // Get the timezone offset in minutes
  const offset = date.getTimezoneOffset();
  // Subtract the offset to convert to local time
  // Note: getTimezoneOffset() returns minutes, so we multiply by 60000 to get milliseconds
  // We SUBTRACT the offset because getTimezoneOffset() returns positive for negative offsets
  const localTime = date.getTime() - (offset * 60000);
  return new Date(localTime);
};

const getLocalDateString = (date: Date): string => {
  // Use the original date directly without UTC conversion
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Add current time indicator
const CurrentTimeIndicator = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const top = (currentHour + currentMinute / 60) * CELL_HEIGHT;

  return (
    <View style={[styles.currentTimeIndicator, { top }]}>
      <View style={styles.currentTimeDot} />
      <View style={styles.currentTimeLine} />
    </View>
  );
};

const WeeklyCalendarView = React.forwardRef<WeeklyCalendarViewRef, WeeklyCalendarViewProps>(({
    events,
    setEvents,
    selectedDate,
    setSelectedDate,
    setShowModal,
    setStartDateTime,
    setEndDateTime,
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
    setVisibleWeekMonth,
    setVisibleWeekMonthText,
    visibleWeekMonthText,
}, ref) => {
    const baseDate = new Date(selectedDate);
    const flatListRef = useRef<FlatList>(null);

    // Regenerate weeks array whenever selectedDate changes
    const weeks = useMemo(() => {
        const date = new Date(selectedDate);
        return Array.from({ length: 100 }, (_, i) => {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay() + (i - 50) * 7);
            return weekStart;
        });
    }, [selectedDate]);

    // Initialize month text immediately
    useEffect(() => {
        const weekStart = new Date(baseDate);
        const weekEnd = new Date(baseDate);
        weekEnd.setDate(weekEnd.getDate() + 6);

        let initialMonthText;
        if (weekStart.getMonth() !== weekEnd.getMonth()) {
            const startMonth = weekStart.toLocaleString('en-US', { month: 'long' }).toLowerCase();
            const endMonth = weekEnd.toLocaleString('en-US', { month: 'long' }).toLowerCase();
            const year = weekStart.getFullYear();
            initialMonthText = `${startMonth}/${endMonth} ${year}`;
        } else {
            const month = weekStart.toLocaleString('en-US', { month: 'long' }).toLowerCase();
            const year = weekStart.getFullYear();
            initialMonthText = `${month} ${year}`;
        }
        setVisibleWeekMonthText(initialMonthText);
    }, []); // Only run once on mount

    const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
        if (viewableItems.length > 0) {
            const visibleWeek = viewableItems[0].item;
            const weekStart = new Date(visibleWeek);
            const weekEnd = new Date(visibleWeek);
            weekEnd.setDate(weekEnd.getDate() + 6);

            let newMonthText;
            if (weekStart.getMonth() !== weekEnd.getMonth()) {
                const startMonth = weekStart.toLocaleString('en-US', { month: 'long' }).toLowerCase();
                const endMonth = weekEnd.toLocaleString('en-US', { month: 'long' }).toLowerCase();
                const year = weekStart.getFullYear();
                newMonthText = `${startMonth}/${endMonth} ${year}`;
            } else {
                const month = weekStart.toLocaleString('en-US', { month: 'long' }).toLowerCase();
                const year = weekStart.getFullYear();
                newMonthText = `${month} ${year}`;
            }
            
            // Update both the text and the date immediately
            setVisibleWeekMonthText(newMonthText);
            setVisibleWeekMonth(weekStart);
        }
    }, [setVisibleWeekMonth, setVisibleWeekMonthText]);

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

    const handleSaveNewEvent = (dayDate: Date, hour: number) => {
        const dateStr = getLocalDateString(dayDate);
        const paddedHour = hour.toString().padStart(2, '0');
      
        const newEvent: CalendarEvent = {
          id: Date.now().toString(),
          title: 'New Event',
          description: '',
          date: dateStr,
          startTime: `${paddedHour}:00`,
          endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
          categoryName: '',
          categoryColor: '#BF9264',
          reminderTime: null,
          repeatOption: 'None',
          repeatEndDate: null,
          isContinued: false,
        };
      
        setEvents(prev => {
          const updated = { ...prev };
          if (!updated[dateStr]) updated[dateStr] = [];
          updated[dateStr].push(newEvent);
          return updated;
        });
      };
      

      const calculateEventPosition = (event: CalendarEvent) => {
        const [startHour, startMinute] = event.startTime.split(':').map(Number);
        const [endHour, endMinute] = event.endTime.split(':').map(Number);
      
        const startDecimal = startHour + startMinute / 60;
        const endDecimal = endHour + endMinute / 60;
      
        const top = startDecimal * CELL_HEIGHT;
        const height = Math.max((endDecimal - startDecimal) * CELL_HEIGHT, 20);
      
        return { top, height };
      };
      
      

    const calculateNumberOfLines = (height: number) => {
      const lineHeight = 16; // Match the lineHeight in styles
      const padding = 8; // Account for padding (4px top + 4px bottom)
      const availableHeight = height - padding;
      const lines = Math.floor(availableHeight / lineHeight);
      return Math.max(1, Math.min(lines, 5)); // Between 1 and 5 lines
    };

    const renderTimeIndicator = (hour: number) => {
        const timeText = hour === 0 ? '12 AM' : 
                        hour === 12 ? '12 PM' : 
                        hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
        
        return (
            <View style={styles.timeIndicator}>
                <Text style={styles.timeIndicatorText}>{timeText}</Text>
            </View>
        );
    };

    useEffect(() => {
        console.log('WeeklyCalendar events update:', {
          totalDates: Object.keys(events).length,
          dates: Object.keys(events).sort(),
          eventsByDate: Object.entries(events).map(([date, evts]) => ({
            date,
            count: evts.length,
            events: evts.map(e => ({
              id: e.id,
              title: e.title,
              date: e.date,
              startTime: e.startTime,
              endTime: e.endTime
            }))
          }))
        });
      }, [events]);


    const renderWeek = ({ item: weekStart }: { item: Date }) => {
        const weekDates = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            return date;
        });

        const today = new Date();
        const isCurrentWeek = weekDates.some(date => 
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()
        );

        return (
            <View style={{ flex: 1 }}>
                {/* Date Headers */}
                <View style={styles.weekHeader}>
                    <View style={styles.timeColumnHeader} />
                    {weekDates.map((date, idx) => {
                        const isTodayDate = isToday(date);
                        return (
                            <View 
                                key={idx} 
                                style={[
                                    styles.dateHeader,
                                    isTodayDate && styles.todayHeader
                                ]}
                            >
                                <Text style={[
                                    styles.weekdayText,
                                    isTodayDate && styles.todayText
                                ]}>
                                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                </Text>
                                <Text style={[
                                    styles.dateText,
                                    isTodayDate && styles.todayText
                                ]}>
                                    {date.getDate()}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                {/* Time Grid */}
                <ScrollView 
                    style={{ flex: 1 }}
                    contentContainerStyle={{ height: HOURS.length * CELL_HEIGHT }}
                    showsVerticalScrollIndicator={true}
                    bounces={true} // Prevent bouncing beyond the grid
                >
                    <View style={styles.gridContainer}>
                        {/* Time Column */}
                        <View style={styles.timeColumn}>
                            {HOURS.map((hour) => (
                                <View key={`time-${hour}`} style={styles.timeRow}>
                                    {renderTimeIndicator(hour)}
                                </View>
                            ))}
                        </View>

                        {/* Day Columns */}
                        {weekDates.map((date, dayIndex) => {
                            const dateKey = getLocalDateString(date);
                            const dayEvents = events[dateKey] || [];
                            const isTodayDate = isToday(date);

                            return (
                                <View 
                                    key={dayIndex} 
                                    style={[
                                        styles.dayColumn,
                                        isTodayDate && styles.todayColumn
                                    ]}
                                >
                                    {/* Grid Lines */}
                                    <View style={styles.gridLines}>
                                        {HOURS.map((hour, hourIndex) => (
                                            <View key={`grid-${hourIndex}`} style={styles.gridCell}>
                                                {/* Time indicators are now rendered in the time column */}
                                            </View>
                                        ))}
                                    </View>

                                    {/* Current Time Indicator */}
                                    {isCurrentWeek && isTodayDate && <CurrentTimeIndicator />}

                                    {/* Events Layer */}
                                    <View style={styles.eventsLayer}>
  {HOURS.map((hour, hourIndex) => {
    const paddedHour = hour.toString().padStart(2, '0');
    const cellStartStr = `${paddedHour}:00`;
    const nextHour = (hour + 1).toString().padStart(2, '0');
    const cellEndStr = `${nextHour}:00`;

    const overlappingEvents = dayEvents.filter(event => {
      if (!event.startTime || !event.endTime) {
        console.log('Event missing times:', {
          eventId: event.id,
          title: event.title,
          date: event.date,
        });
        return false;
      }

      const [startHour, startMinute] = event.startTime.split(':').map(Number);
      const [endHour, endMinute] = event.endTime.split(':').map(Number);
      const [cellStartHour, cellStartMinute] = cellStartStr.split(':').map(Number);
      const [cellEndHour, cellEndMinute] = cellEndStr.split(':').map(Number);

      const eventStartDecimal = startHour + startMinute / 60;
      const eventEndDecimal = endHour + endMinute / 60;
      const cellStartDecimal = cellStartHour + cellStartMinute / 60;
      const cellEndDecimal = cellEndHour + cellEndMinute / 60;

      const overlaps = eventStartDecimal < cellEndDecimal && eventEndDecimal > cellStartDecimal;

      if (overlaps) {
        console.log('Event overlaps cell:', {
          eventId: event.id,
          title: event.title,
          eventStart: event.startTime,
          eventEnd: event.endTime,
          cellStart: cellStartStr,
          cellEnd: cellEndStr,
        });
      }

      return overlaps;
    });

                                            return (
                                                <TouchableOpacity
  key={`cell-${hourIndex}`}
  style={styles.eventCell}
  onPress={() => handleSaveNewEvent(date, hour)}
>
  {overlappingEvents.map((event, eventIndex) => {
    const position = calculateEventPosition(event);
    if (!position) return null;

    // Parse start time string like "14:30" into hour
    const [eventHour] = event.startTime.split(':').map(Number);
    const isFirstCell = eventHour === hour;
    if (!isFirstCell) return null;

    return (
      <TouchableOpacity
        key={`${event.id}-${eventIndex}`}
        onLongPress={() => {
          setSelectedEvent({ event, dateKey, index: eventIndex });
          setEditedEventTitle(event.title);
          setEditedEventDescription(event.description ?? '');
          setEditedStartDateTime(new Date(`${event.date}T${event.startTime}`));
          setEditedEndDateTime(new Date(`${event.date}T${event.endTime}`));
          setEditedSelectedCategory(event.categoryName
            ? { name: event.categoryName, color: event.categoryColor! }
            : null
          );
          setEditedReminderTime(event.reminderTime
            ? new Date(`${event.date}T${event.reminderTime}`)
            : null
          );
          setEditedRepeatOption(event.repeatOption || 'None');
          setEditedRepeatEndDate(event.repeatEndDate
            ? new Date(event.repeatEndDate)
            : null
          );
          setShowEditEventModal(true);
        }}
        style={[
          styles.eventBox,
          {
            top: position.top,
            height: position.height,
            backgroundColor: `${event.categoryColor || '#FF9A8B'}60`,
          }
        ]}
      >
        <View style={styles.eventTextContainer}>
          <Text style={styles.eventText} numberOfLines={2}>
            {event.title}
          </Text>
        </View>
      </TouchableOpacity>
    );
  })}
</TouchableOpacity>

                                              
                                            );
                                        })}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
        );
    };

    // Update scrollToWeek to handle any target date
    const scrollToWeek = useCallback((targetDate: Date) => {
        const weekStart = new Date(targetDate);
        weekStart.setDate(targetDate.getDate() - targetDate.getDay());
        
        // Find the closest week in our array
        const weekIndex = weeks.findIndex(date => {
            const diff = Math.abs(date.getTime() - weekStart.getTime());
            return diff < 7 * 24 * 60 * 60 * 1000; // Within 7 days
        });

        if (weekIndex !== -1) {
            flatListRef.current?.scrollToIndex({
                index: weekIndex,
                animated: true
            });
        } else {
            // If we can't find a close week, update selectedDate to trigger weeks array regeneration
            setSelectedDate(weekStart);
        }
    }, [weeks, setSelectedDate]);

    // Add this function to scroll to today's week
    const scrollToToday = useCallback(() => {
        const today = new Date();
        scrollToWeek(today);
    }, [scrollToWeek]);

    // Expose the scrollToWeek function to the parent component
    React.useImperativeHandle(ref, () => ({
        scrollToWeek
    }));

    return (
        <View style={{ flex: 1 }}>
            {!hideHeader && (
                <View style={styles.weekStrip}>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={[styles.monthLabel, { textTransform: 'capitalize' }]}>
                            {visibleWeekMonthText}
                        </Text>
                    </View>
                </View>
            )}
            <FlatList
                ref={flatListRef}
                data={weeks}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={50}
                getItemLayout={(_, index) => ({
                    length: SCREEN_WIDTH,
                    offset: SCREEN_WIDTH * index,
                    index,
                })}
                renderItem={renderWeek}
                keyExtractor={(item) => item.toISOString()}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{
                    itemVisiblePercentThreshold: 80,
                    minimumViewTime: 0,
                }}
                decelerationRate="fast"
                snapToInterval={SCREEN_WIDTH}
                snapToAlignment="center"
            />
        </View>
    );
});

WeeklyCalendarView.displayName = 'WeeklyCalendarView';

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
        borderRightWidth: 1,
        borderColor: '#E0E0E0',
        backgroundColor: 'white',
        position: 'relative',
    },
    timeRow: {
        height: CELL_HEIGHT,
        position: 'relative',
    },
    timeText: {
        fontSize: 11,
        color: '#666',
        fontFamily: 'Onest',
    },
    dayColumn: {
        width: DAY_COLUMN_WIDTH,
        position: 'relative',
        borderRightWidth: 1,
        borderColor: '#E0E0E0',
        height: HOURS.length * CELL_HEIGHT, // Fixed height for 24 hours
    },
    gridBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        borderRightWidth: 1,
        borderColor: '#EEEEEE',
    },
    eventsLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: HOURS.length * CELL_HEIGHT, // Fixed height for 24 hours
        zIndex: 2,
        overflow: 'hidden', // Prevent events from rendering outside
    },
    cell: {
        height: 55,
        borderBottomWidth: 1,
        borderColor: '#EEEEEE',
    },
    eventCell: {
        height: CELL_HEIGHT,
        position: 'relative',
        zIndex: 1,
    },
    eventBox: {
        position: 'absolute',
        left: 1,
        right: 1,
        borderRadius: 4,
        paddingVertical: 2,
        paddingHorizontal: 4,
        minHeight: 20,
        zIndex: 2,
        overflow: 'hidden', // Ensure content doesn't overflow
    },
    eventTextContainer: {
        flex: 1,
        justifyContent: 'flex-start',
    },
    eventText: {
        fontSize: 11,
        color: '#3A3A3A',
        fontFamily: 'Onest',
        fontWeight: '500',
        textAlign: 'center',
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
    monthLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666',
        fontFamily: 'Onest',
    },
    weekHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
        backgroundColor: 'white',
        height: 64,
    },
    timeColumnHeader: {
        width: TIME_COLUMN_WIDTH,
        borderRightWidth: 1,
        borderColor: '#E0E0E0',
    },
    dateHeader: {
        width: DAY_COLUMN_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: 1,
        borderColor: '#E0E0E0',
        paddingVertical: 8,
    },
    todayHeader: {
        backgroundColor: '#F8F9FA',
    },
    weekdayText: {
        fontSize: 11,
        color: '#70757A',
        fontFamily: 'Onest',
        marginBottom: 4,
    },
    todayText: {
        color: '#1A73E8',
        fontWeight: '500',
    },
    gridContainer: {
        flexDirection: 'row',
        backgroundColor: 'white',
        position: 'relative',
        height: HOURS.length * CELL_HEIGHT, // Fixed height for 24 hours
    },
    timeIndicator: {
        position: 'absolute',
        top: -8, // Position at the top edge of the cell
        right: 4,
        backgroundColor: 'white',
        paddingHorizontal: 4,
        zIndex: 2,
    },
    timeIndicatorText: {
        fontSize: 10,
        color: '#70757A',
        fontFamily: 'Onest',
    },
    todayColumn: {
        backgroundColor: '#F8F9FA',
    },
    gridLines: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: HOURS.length * CELL_HEIGHT, // Fixed height for 24 hours
        zIndex: 0,
    },
    gridCell: {
        height: CELL_HEIGHT,
        position: 'relative',
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
    },
    horizontalLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 1,
        backgroundColor: '#E0E0E0',
    },
    currentTimeIndicator: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 2,
        flexDirection: 'row',
        alignItems: 'center',
    },
    currentTimeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EA4335',
        marginLeft: -4,
    },
    currentTimeLine: {
        flex: 1,
        height: 2,
        backgroundColor: '#EA4335',
    },
});

export default WeeklyCalendarView;
