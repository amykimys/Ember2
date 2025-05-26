import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../supabase';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Update time column width to match Google Calendar
const TIME_COLUMN_WIDTH = 50;
const DAY_COLUMN_WIDTH = (SCREEN_WIDTH - TIME_COLUMN_WIDTH) / 7;
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0 to 23 for hour labels
const GRID_ROWS = Array.from({ length: 24 }, (_, i) => i); // 0 to 23 for grid rows
const CELL_HEIGHT = 45; // Height of each hour cell (reduced from 55)

// Add current time line component
const CurrentTimeLine = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now);
      
      // Calculate position based on current time
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      const cellHeight = 45; // Updated from 55
      const position = (totalMinutes / 60) * cellHeight;
      setPosition(position);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Only show the line if we're viewing today
  const isToday = currentTime.toDateString() === new Date().toDateString();
  if (!isToday) return null;

  return (
    <View style={[styles.currentTimeLine, { top: position }]}>
      <View style={styles.currentTimeDot} />
      <View style={styles.currentTimeLineContent} />
    </View>
  );
};

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
  isAllDay?: boolean;
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
    const [clickedCell, setClickedCell] = useState<{ dayIndex: number; hourIndex: number } | null>(null);
    const clickTimeoutRef = useRef<NodeJS.Timeout>();
    

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
      const start = new Date(dayDate);
      start.setHours(hour, 0, 0, 0);
    
      const end = new Date(dayDate);
      end.setHours(hour + 1, 0, 0, 0);
    
      // Instead of directly creating and setting the event,
      // prepare the event data and use the main modal
      setStartDateTime(start);
      setEndDateTime(end);
      setShowModal(true);
    };
    

    const calculateEventPosition = (event: CalendarEvent, date: Date) => {
      if (!event.startDateTime || !event.endDateTime) return null;

      const cellHeight = 45; // Height of each hour cell

      // Get the start of the current day
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);

      // Use the event's start and end times directly
      const startHours = event.startDateTime.getHours();
      const startMinutes = event.startDateTime.getMinutes();
      const endHours = event.endDateTime.getHours();
      const endMinutes = event.endDateTime.getMinutes();

      // Calculate total minutes from start of day
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;

      // Calculate position and height
      const top = (startTotalMinutes / 60) * cellHeight;
      const height = Math.max(((endTotalMinutes - startTotalMinutes) / 60) * cellHeight, 20); // Minimum height of 20

      return { top, height };
    };

    const calculateNumberOfLines = (height: number) => {
      const lineHeight = 16; // Match the lineHeight in styles
      const padding = 8; // Account for padding (4px top + 4px bottom)
      const availableHeight = height - padding;
      const lines = Math.floor(availableHeight / lineHeight);
      return Math.max(1, Math.min(lines, 5)); // Between 1 and 5 lines
    };

    const handleCellClick = (dayIndex: number, hourIndex: number, date: Date, cellHour: number) => {
        // Set the clicked cell
        setClickedCell({ dayIndex, hourIndex });
        
        // Clear any existing timeout
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
        }

        // Set timeout to clear the clicked cell state after animation
        clickTimeoutRef.current = setTimeout(() => {
            setClickedCell(null);
        }, 200); // 200ms animation duration

        // Original click handler logic
        const clickedDate = new Date(date);
        clickedDate.setHours(cellHour, 0, 0, 0);

        setStartDateTime(new Date(clickedDate));
        const end = new Date(clickedDate);
        end.setHours(end.getHours() + 1);
        setEndDateTime(end);
        setShowModal(true);
    };

    const renderWeek = ({ item: weekStart }: { item: Date }) => {
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return date;
    });

    console.log('WeeklyCalendar - Rendering Week:', {
      weekStart: weekStart.toISOString(),
      weekDates: weekDates.map(d => d.toISOString()),
      eventsKeys: Object.keys(events)
    });

    // Sticky all-day row
    const allDayRow = (
      <View style={{ 
        flexDirection: 'row', 
        backgroundColor: 'white', 
        borderBottomWidth: 1, 
        borderColor: '#eee', 
        minHeight: 36, 
        zIndex: 10, 
      }}>
        {/* Time column spacer for alignment */}
        <View style={{ 
          width: TIME_COLUMN_WIDTH, 
          backgroundColor: 'white',
          borderRightWidth: 1,
          borderColor: '#eee'
        }} />
        {weekDates.map((date, idx) => {
          const dateKey = getLocalDateString(date);
          const allDayEvents = (events[dateKey] || []).filter(e => e.isAllDay);
          console.log('WeeklyCalendar - Day Events:', {
            date: dateKey,
            allDayEvents: allDayEvents.length,
            regularEvents: (events[dateKey] || []).filter(e => !e.isAllDay).length
          });
          return (
            <View
              key={idx}
              style={{
                width: DAY_COLUMN_WIDTH,
                alignItems: 'center',
                justifyContent: 'flex-start',
                minHeight: allDayEvents.length > 0 ? allDayEvents.length * 28 : 45,
                borderRightWidth: 1,
                borderColor: '#eee',
                backgroundColor: 'white',
              }}
            >
              {allDayEvents.map((event, i) => (
                <TouchableOpacity
                  key={event.id + '-' + i}
                  onPress={() => {
                    setSelectedEvent({ event, dateKey, index: i });
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
                    styles.allDayEventBox,
                    {
                      backgroundColor: `${event.categoryColor || '#FF9A8B'}70`,
                      width: DAY_COLUMN_WIDTH,
                    }
                  ]}
                >
                  <Text style={styles.allDayEventText} numberOfLines={1}>{event.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </View>
    );

    return (
      <View style={{ flex: 1 }}>
        {/* Date Headers */}
        <View style={styles.headerContainer}>
          <View style={styles.timeColumnHeader} />
          {weekDates.map((date, idx) => (
            <View key={idx} style={styles.dateHeader}>
              <Text style={[styles.weekdayText, isToday(date) && styles.todayText]}>
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <Text style={[styles.dateText, isToday(date) && styles.todayText]}>
                {date.getDate()}
              </Text>
            </View>
          ))}
        </View>
        {/* Sticky All-Day Row */}
        {allDayRow}
        {/* Time Grid */}
        <ScrollView style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row' }}>
            {/* Time Column */}
            <View style={styles.timeColumn}>
              {/* Absolutely position hour labels at the top of each cell */}
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} pointerEvents="none">
                {HOURS.map((hour, hourIndex) => (
                  <Text
                    key={`time-${hour}`}
                    style={[
                      styles.timeText,
                      {
                        position: 'absolute',
                        top: hourIndex * CELL_HEIGHT - 7, // 12 AM at the very top
                        left: 0,
                        right: 0,
                        zIndex: 10,
                      },
                    ]}
                  >
                    {hour === 0 ? '12 AM' :
                     hour === 12 ? '12 PM' :
                     hour < 12 ? `${hour} AM` : `${hour - 12} PM`}
                  </Text>
                ))}
              </View>
              {/* Render the grid cells for background height only (25 rows) */}
              <View>
                {GRID_ROWS.map((row) => (
                  <View key={`grid-bg-${row}`} style={{ height: CELL_HEIGHT }} />
                ))}
              </View>
            </View>

            {/* Day Columns */}
            {weekDates.map((date, dayIndex) => {
              const dateKey = getLocalDateString(date);
              const dayEvents = (events[dateKey] || []).filter(event => !event.isAllDay);
              const isCurrentDay = isToday(date);

              console.log('WeeklyCalendar - Rendering Day Column:', {
                date: dateKey,
                eventsCount: dayEvents.length,
                events: dayEvents.map(e => ({
                  id: e.id,
                  title: e.title,
                  start: e.startDateTime?.toISOString(),
                  end: e.endDateTime?.toISOString()
                }))
              });

              return (
                <View key={dayIndex} style={styles.dayColumn}>
                  {/* Grid Background Layer */}
                  <View style={styles.gridBackground}>
                    {GRID_ROWS.map((row) => {
                      const cellHour = row;
                      const isClicked = clickedCell?.dayIndex === dayIndex && clickedCell?.hourIndex === row;
                      
                      // Create a unique key for each cell
                      const cellKey = `cell-${dayIndex}-${row}`;
                      
                      return (
                        <View 
                          key={cellKey}
                          style={[
                            styles.cellContainer,
                            isClicked && styles.clickedCell
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.cellTouchable}
                            activeOpacity={0.6}
                            onPress={() => {
                              console.log('Cell pressed:', { dayIndex, row, date: date.toISOString(), cellHour });
                              try {
                                const clickedDate = new Date(date);
                                clickedDate.setHours(cellHour, 0, 0, 0);
                                
                                setStartDateTime(new Date(clickedDate));
                                const end = new Date(clickedDate);
                                end.setHours(end.getHours() + 1);
                                setEndDateTime(end);
                                
                                console.log('Setting modal to true');
                                setShowModal(true);
                                
                                // Visual feedback
                                setClickedCell({ dayIndex, hourIndex: row });
                                if (clickTimeoutRef.current) {
                                  clearTimeout(clickTimeoutRef.current);
                                }
                                clickTimeoutRef.current = setTimeout(() => {
                                  setClickedCell(null);
                                }, 200);
                              } catch (error) {
                                console.error('Error in cell press handler:', error);
                              }
                            }}
                          />
                        </View>
                      );
                    })}
                  </View>

                  {/* Current Time Line */}
                  {isCurrentDay && <CurrentTimeLine />}

                  {/* Events Layer */}
                  <View style={[styles.eventsLayer, { pointerEvents: 'box-none' }]}>
                  {dayEvents.map((event, eventIndex) => {
  const position = calculateEventPosition(event, date);
  if (!position) return null;

  return (
    <TouchableOpacity
      key={`${event.id}-${eventIndex}`}
      style={[
        styles.eventBox,
        {
          top: position.top,
          height: position.height,
          backgroundColor: `${event.categoryColor || '#FF9A8B'}40`,
          position: 'absolute',
          left: 0,
          right: 0,
          marginHorizontal: 0,
        },
      ]}
      onPress={() => {
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
      onLongPress={() => {
        // your long press logic...
      }}
    >
      <View style={styles.eventTextContainer}>
        <Text style={styles.eventText} numberOfLines={2}>
          {event.title}
        </Text>
      </View>
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

  // Helper function to get date string in YYYY-MM-DD format
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  // Add useEffect to clear the clicked cell state after animation
  useEffect(() => {
    return () => {
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
        }
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {!hideHeader && (
        <View style={styles.weekStrip}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.monthLabel}>
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
  headerContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#EEEEEE',
    backgroundColor: 'white',
    paddingTop: 8,
    paddingBottom: 8,
    marginTop: 5
  },
  timeColumnHeader: {
    width: TIME_COLUMN_WIDTH,
  },
  dateHeader: {
    width: DAY_COLUMN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
  },
  weekdayText: {
    fontSize: 12,
    color: '#3a3a3a',
    fontWeight: '400',
    fontFamily: 'Onest',
    marginBottom: 2,
  },
  todayText: {
    color: '#A0C3B2',
    fontWeight: '700',
  },
  timeColumn: {
    width: TIME_COLUMN_WIDTH,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderColor: '#EEEEEE',
    paddingRight: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'Onest',
    textAlign: 'right',
    marginBottom: -7,
    marginTop: 0,
    backgroundColor: 'transparent',
    paddingRight: 8,
  },
  dayColumn: {
    width: DAY_COLUMN_WIDTH,
    position: 'relative',
    backgroundColor: 'white',
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
    bottom: 0,
    zIndex: 2,
  },
  cellContainer: {
    height: CELL_HEIGHT,
    borderBottomWidth: 1,
    borderColor: '#EEEEEE',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  cellTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  clickedCell: {
    backgroundColor: '#A0C3B220',
  },
  eventCell: {
    height: 45,
    position: 'relative',
    zIndex: 2,
  },
  eventBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FF9A8B20',
    borderRadius: 1,
    padding: 2,
    minHeight: 20,
    zIndex: 2,
  },
  eventTextContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  eventText: {
    fontSize: 11,
    color: '#3a3a3a',
    fontFamily: 'Onest',
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
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#EA4335',
    zIndex: 3,
  },
  currentTimeDot: {
    position: 'absolute',
    left: -4,
    top: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EA4335',
  },
  currentTimeLineContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#EA4335',
  },
  allDayEventBox: {
    borderRadius: 1,
    paddingHorizontal: 0,
    paddingVertical: 2,
    minWidth: 40,
    maxWidth: '100%',
    alignSelf: 'center',
    backgroundColor: '#FF9A8B20',
  },
  allDayEventText: {
    color: '#3a3a3a',
    fontSize: 11,
    fontFamily: 'Onest',
    textAlign: 'center',
  },
});

export default WeeklyCalendarView;
