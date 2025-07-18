import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, TouchableOpacity, Dimensions, Alert, RefreshControl } from 'react-native';
import { Swipeable, Gesture, GestureDetector } from 'react-native-gesture-handler';
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

// Simple current time line component
const CurrentTimeLine = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date());
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Calculate position based on current time
  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const position = (totalMinutes / 60) * CELL_HEIGHT;

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
  location?: string;
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
  photos?: string[];
  // Add shared event properties
  isShared?: boolean;
  sharedBy?: string;
  sharedByUsername?: string;
  sharedByFullName?: string;
  sharedStatus?: 'pending' | 'accepted' | 'declined';
  // Add Google Calendar properties
  googleCalendarId?: string;
  googleEventId?: string;
  isGoogleEvent?: boolean;
  calendarColor?: string;
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
    setEditedEventPhotos: React.Dispatch<React.SetStateAction<string[]>>;
    setEditedAllDay: React.Dispatch<React.SetStateAction<boolean>>;
    setShowEditEventModal: (show: boolean) => void;
    resetAllDayToggle?: () => void; // Add this prop
    hideHeader?: boolean;
    setVisibleWeekMonth: (date: Date) => void;
    setVisibleWeekMonthText: React.Dispatch<React.SetStateAction<string>>;
    visibleWeekMonthText: string;
    isRefreshing?: boolean;
    onRefresh?: () => void;
    handleLongPress?: (event: CalendarEvent) => void; // Add unified handler prop
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
    setEditedEventPhotos,
    setEditedAllDay,
    setShowEditEventModal,
    resetAllDayToggle,
    hideHeader = false,
    setVisibleWeekMonth,
    setVisibleWeekMonthText,
    visibleWeekMonthText,
    isRefreshing = false,
    onRefresh,
    handleLongPress,
}, ref) => {
    const baseDate = new Date(selectedDate);
    const flatListRef = useRef<FlatList>(null);
    const [currentWeekScrollViewRef, setCurrentWeekScrollViewRef] = useState<ScrollView | null>(null);
    const [clickedCell, setClickedCell] = useState<{ dayIndex: number; hourIndex: number } | null>(null);
    const clickTimeoutRef = useRef<NodeJS.Timeout>();
    const hasScrolledToCurrentTime = useRef(false);
    const [currentWeekIndex, setCurrentWeekIndex] = useState(50); // Track current week index
    
    // Regenerate weeks array whenever selectedDate changes
    const weeks = useMemo(() => {
        const date = new Date(selectedDate);
        return Array.from({ length: 100 }, (_, i) => {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay() + (i - 50) * 7);
            return weekStart;
        });
    }, [selectedDate]);

    // Gesture handlers for swipe navigation - horizontal only
    const panGesture = Gesture.Pan()
        .activeOffsetX([-10, 10]) // Only activate for horizontal movement
        .failOffsetY([-5, 5]) // Fail if vertical movement exceeds 5px
        .onEnd((event) => {
            const { translationX, velocityX } = event;
            const threshold = 50; // Minimum distance for swipe
            const velocityThreshold = 500; // Minimum velocity for swipe

            // Only handle horizontal swipes
            const isHorizontalSwipe = Math.abs(translationX) > threshold || Math.abs(velocityX) > velocityThreshold;

            if (isHorizontalSwipe) {
                // Horizontal swipe - navigate between weeks
                if (translationX > 0) {
                    // Swipe right - go to previous week
                    const newIndex = Math.max(0, currentWeekIndex - 1);
                    setCurrentWeekIndex(newIndex);
                    flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
                } else {
                    // Swipe left - go to next week
                    const newIndex = Math.min(weeks.length - 1, currentWeekIndex + 1);
                    setCurrentWeekIndex(newIndex);
                    flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
                }
            }
            // All other gestures are ignored
        });

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

            // Update current week index
            const weekIndex = weeks.findIndex(week => 
                week.getTime() === weekStart.getTime()
            );
            if (weekIndex !== -1) {
                setCurrentWeekIndex(weekIndex);
            }

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
    }, [setVisibleWeekMonth, setVisibleWeekMonthText, weeks]);

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
      resetAllDayToggle?.(); // Reset all-day toggle for new events
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

    // Function to detect overlapping events and arrange them in columns
    const arrangeEventsInColumns = (events: CalendarEvent[], date: Date) => {
      if (events.length === 0) return [];

      // Sort events by start time
      const sortedEvents = [...events].sort((a, b) => {
        if (!a.startDateTime || !b.startDateTime) return 0;
        return a.startDateTime.getTime() - b.startDateTime.getTime();
      });

      // Group overlapping events
      const eventGroups: CalendarEvent[][] = [];
      const processedEvents = new Set<string>();

      sortedEvents.forEach((event) => {
        if (processedEvents.has(event.id)) return;

        const group: CalendarEvent[] = [event];
        processedEvents.add(event.id);

        // Find all events that overlap with this event
        sortedEvents.forEach((otherEvent) => {
          if (processedEvents.has(otherEvent.id)) return;
          if (!event.startDateTime || !event.endDateTime || !otherEvent.startDateTime || !otherEvent.endDateTime) return;

          // Check if events overlap
          const eventStart = event.startDateTime.getTime();
          const eventEnd = event.endDateTime.getTime();
          const otherStart = otherEvent.startDateTime.getTime();
          const otherEnd = otherEvent.endDateTime.getTime();

          if (eventStart < otherEnd && eventEnd > otherStart) {
            group.push(otherEvent);
            processedEvents.add(otherEvent.id);
          }
        });

        if (group.length > 0) {
          eventGroups.push(group);
        }
      });

      // Calculate column positions for each group
      const eventsWithColumns: Array<{
        event: CalendarEvent;
        column: number;
        totalColumns: number;
        position: { top: number; height: number };
      }> = [];

      eventGroups.forEach((group) => {
        if (group.length === 1) {
          // Single event, no columns needed
          const position = calculateEventPosition(group[0], date);
          if (position) {
            eventsWithColumns.push({
              event: group[0],
              column: 0,
              totalColumns: 1,
              position
            });
          }
        } else {
          // Multiple overlapping events, arrange in columns
          group.forEach((event, index) => {
            const position = calculateEventPosition(event, date);
            if (position) {
              eventsWithColumns.push({
                event,
                column: index,
                totalColumns: group.length,
                position
              });
            }
          });
        }
      });

      return eventsWithColumns;
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
        resetAllDayToggle?.(); // Reset all-day toggle for new events
        setShowModal(true);
    };

    const renderWeek = ({ item: weekStart }: { item: Date }) => {
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return date;
    });



    // Check if this is the current week (today's week)
    const today = new Date();
    const isCurrentWeek = weekDates.some(date => isToday(date));

    // Sticky all-day row
    const allDayRow = (
      <View style={{ 
        flexDirection: 'row', 
        backgroundColor: '#ffffff', 
        borderBottomWidth: 1, 
        borderColor: '#f3f3f3', 
        minHeight: 36, 
        zIndex: 10, 
      }}>
        {/* Time column spacer for alignment */}
        <View style={{ 
          width: TIME_COLUMN_WIDTH, 
          backgroundColor: '#ffffff',
          borderRightWidth: 1,
          borderColor: '#f3f3f3',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Text style={{
            fontSize: 10,
            color: '#5f6368',
            fontWeight: '500',
            fontFamily: 'Onest',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}>
            All Day
          </Text>
        </View>
        {weekDates.map((date, idx) => {
          const dateKey = getLocalDateString(date);
          const allDayEvents = (events[dateKey] || []).filter(e => e.isAllDay);

          return (
            <View
              key={idx}
              style={{
                width: DAY_COLUMN_WIDTH,
                alignItems: 'center',
                justifyContent: 'flex-start',
                minHeight: allDayEvents.length > 0 ? allDayEvents.length * 26 + 12 : 36,
                borderRightWidth: 1,
                borderColor: '#f3f3f3',
                backgroundColor: '#ffffff',
                paddingVertical: 2,
                paddingHorizontal: 0,
              }}
            >
              {allDayEvents.map((event, i) => (
                <TouchableOpacity
                  key={event.id + '-' + i}
                  onPress={() => {
                    handleLongPress?.(event);
                  }}
                  style={[
                    styles.allDayEventBox,
                    {
                      backgroundColor: event.isGoogleEvent 
                        ? `${event.calendarColor || '#4285F4'}10` // More transparent calendar color background
                        : event.isShared 
                          ? (event.sharedStatus === 'pending' ? '#00ACC120' : `${getEventColor(event.categoryColor, event.categoryName)}30`) // Blue for pending, normal for accepted
                          : `${getEventColor(event.categoryColor, event.categoryName)}30`, // Lighter background like monthly calendar
                      borderWidth: event.isShared && event.sharedStatus === 'pending' ? 1 : (event.isGoogleEvent ? 1 : 0),
                      borderColor: event.isShared && event.sharedStatus === 'pending' ? '#00ACC1' : (event.isGoogleEvent ? (event.calendarColor || '#4285F4') : 'transparent'),
                      width: '100%', // Full width to fit snugly
                    }
                  ]}
                >
                  <Text style={[
                    styles.allDayEventText,
                    { 
                      color: event.isShared && event.sharedStatus === 'pending' ? '#00ACC1' : '#3A3A3A',
                      fontWeight: event.isShared && event.sharedStatus === 'pending' ? '600' : '400'
                    }
                  ]} numberOfLines={1}>{event.title}</Text>
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
        <View 
          style={styles.headerContainer}
        >
          <View style={styles.timeColumnHeader} />
          {weekDates.map((date, idx) => (
            <View key={idx} style={styles.dateHeader}>
              <Text style={[styles.weekdayText, isToday(date) && styles.todayText]}>
                {date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
              </Text>
              <Text style={[styles.dateText, isToday(date) && styles.todayDateText]}>
                {date.getDate()}
              </Text>
            </View>
          ))}
        </View>
        {/* Sticky All-Day Row */}
        <View >
          {allDayRow}
        </View>
        {/* Time Grid */}
        <ScrollView 
          ref={(ref) => {
            if (isCurrentWeek) {
              setCurrentWeekScrollViewRef(ref);
            }
          }}
          style={{ flex: 1 }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
              />
            ) : undefined
          }
          onLayout={() => {
            // Auto-scroll to current time when the current week's ScrollView is laid out
            if (isCurrentWeek && !hasScrolledToCurrentTime.current) {
              setTimeout(() => {
                scrollToCurrentTime();
                hasScrolledToCurrentTime.current = true;
              }, 100);
            }
          }}
        >
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

                              try {
                                const clickedDate = new Date(date);
                                clickedDate.setHours(cellHour, 0, 0, 0);
                                
                                setStartDateTime(new Date(clickedDate));
                                const end = new Date(clickedDate);
                                end.setHours(end.getHours() + 1);
                                setEndDateTime(end);
                                

                                setShowModal(true);
                                
                                // Visual feedback
                                setClickedCell({ dayIndex, hourIndex: row });
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
                  {(() => {
                    const eventsWithColumns = arrangeEventsInColumns(dayEvents, date);
                    return eventsWithColumns.map(({ event, column, totalColumns, position }, eventIndex) => {
                      // Calculate width and left position based on column
                      const columnWidth = DAY_COLUMN_WIDTH / totalColumns;
                      const leftPosition = column * columnWidth;
                      
                      return (
                        <TouchableOpacity
                          key={`${event.id}-${eventIndex}`}
                                                                                    style={[
                                styles.eventBox,
                                {
                                  top: position.top,
                                  height: position.height,
                                  backgroundColor: event.isGoogleEvent 
                                    ? `${event.calendarColor || '#4285F4'}10` // More transparent calendar color background
                                    : event.isShared 
                                      ? (event.sharedStatus === 'pending' ? '#00ACC120' : `${event.categoryColor || '#6366F1'}30`) // Blue for pending, normal for accepted
                                      : `${event.categoryColor || '#6366F1'}30`, // Lighter background like monthly calendar
                                  position: 'absolute',
                                  left: leftPosition,
                                  width: columnWidth,
                                  marginHorizontal: 0,
                                  paddingVertical: 2,
                                  paddingHorizontal: 0,
                                  borderWidth: event.isShared && event.sharedStatus === 'pending' ? 1 : (event.isGoogleEvent ? 1 : 0),
                                  borderColor: event.isShared && event.sharedStatus === 'pending' ? '#00ACC1' : (event.isGoogleEvent ? (event.calendarColor || '#4285F4') : 'transparent'),
                                },
                              ]}
                          onPress={() => {
                            handleLongPress?.(event);
                          }}
                          onLongPress={() => {
                            handleLongPress?.(event);
                          }}
                        >
                          <View style={styles.eventTextContainer}>
                            <Text style={[
                              styles.eventText,
                              { 
                                color: event.isShared && event.sharedStatus === 'pending' ? '#00ACC1' : '#3A3A3A',
                                fontWeight: event.isShared && event.sharedStatus === 'pending' ? '600' : '400'
                              }
                            ]} numberOfLines={2}>
                              {event.title}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    });
                  })()}
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

  // Helper function to get Google Calendar-like event colors
  const getEventColor = (categoryColor?: string, categoryName?: string): string => {
    if (categoryColor) {
      return categoryColor;
    }
    
    // Google Calendar default colors
    const colors = [
      '#4285f4', // Blue
      '#ea4335', // Red
      '#fbbc04', // Yellow
      '#34a853', // Green
      '#ff6d01', // Orange
      '#46bdc6', // Teal
      '#7b1fa2', // Purple
      '#d01884', // Pink
    ];
    
    if (categoryName) {
      // Simple hash function to get consistent color for category
      let hash = 0;
      for (let i = 0; i < categoryName.length; i++) {
        hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colors[Math.abs(hash) % colors.length];
    }
    
    return colors[0]; // Default blue
  };

  // Helper function to get appropriate text color for event background
  const getEventTextColor = (categoryColor?: string, categoryName?: string): string => {
    const bgColor = getEventColor(categoryColor, categoryName);
    
    // For light colors, use dark text; for dark colors, use white text
    const lightColors = ['#fbbc04', '#ff6d01', '#46bdc6'];
    if (lightColors.includes(bgColor)) {
      return '#202124'; // Dark text
    }
    
    return '#ffffff'; // White text for most colors
  };

  // Helper function to properly handle date conversion for all-day events
  // Helper function to get original multi-day event dates
  const getOriginalMultiDayDates = (event: CalendarEvent): { startDate: Date; endDate: Date } | null => {
    // Check if this is a multi-day event instance (ID contains date suffix)
    const eventParts = event.id.split('_');
    const eventIsMultiDayInstance = eventParts.length >= 3 && !!eventParts[eventParts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/);
    
    if (eventIsMultiDayInstance) {
      // This is a multi-day event instance, extract the base event ID
      const baseEventId = eventParts.slice(0, -1).join('_');
      
      // Find the original event in the events state
      for (const dateKey in events) {
        const dayEvents = events[dateKey];
        for (const dayEvent of dayEvents) {
          // Check if this is the original event (not an instance)
          if (dayEvent.id === baseEventId && !dayEvent.id.match(/_\d{4}-\d{2}-\d{2}$/)) {
            if (dayEvent.startDateTime && dayEvent.endDateTime) {
              return {
                startDate: new Date(dayEvent.startDateTime),
                endDate: new Date(dayEvent.endDateTime)
              };
            }
          }
        }
      }
    }
    
    // If not a multi-day instance or original not found, return null
    return null;
  };

  const getLocalDateForEdit = (date: Date | undefined, isAllDay: boolean = false): Date | undefined => {
    if (!date) return undefined;
    
    if (isAllDay) {
      // For all-day events, create a local date from the UTC date
      // All-day events are stored as 12pm UTC, so we extract the date components
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      return new Date(year, month, day);
    } else {
      // For non-all-day events, use the date as is
      return new Date(date);
    }
  };

  // Update scrollToWeek to handle any target date
  const scrollToWeek = useCallback((targetDate: Date) => {
    // Calculate the week start for the target date
    const weekStart = new Date(targetDate);
    weekStart.setDate(targetDate.getDate() - targetDate.getDay());
    
    // Find the index of this week in our current array
    const weekIndex = weeks.findIndex(date => {
      const diff = Math.abs(date.getTime() - weekStart.getTime());
      return diff < 7 * 24 * 60 * 60 * 1000; // Within 7 days
    });

    if (weekIndex !== -1) {
      // If we found the week, scroll to it directly
      flatListRef.current?.scrollToIndex({
        index: weekIndex,
        animated: true
      });
    } else {
      // If we can't find the week, update selectedDate and scroll to center
      setSelectedDate(targetDate);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: 50,
          animated: true
        });
      }, 100);
    }
  }, [weeks, setSelectedDate]);

  // Simple function to scroll to current time and center it
  const scrollToCurrentTime = useCallback(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const currentTimePosition = (totalMinutes / 60) * CELL_HEIGHT;
    
    // Position the red line higher in the visible area (about 1/3 from the top)
    const windowHeight = Dimensions.get('window').height;
    // Estimate header height (date headers + all-day row + weekday strip)
    const headerHeight = 40 + 36 + 40; // adjust as needed
    const visibleHeight = windowHeight - headerHeight;
    // Position the red line at about 1/3 from the top of the visible area
    const targetPosition = visibleHeight * 0.3;
    const scrollPosition = Math.max(0, currentTimePosition - targetPosition);
    
    if (currentWeekScrollViewRef) {
      currentWeekScrollViewRef.scrollTo({
      y: scrollPosition,
      animated: true
    });
    }
  }, [currentWeekScrollViewRef]);

  // Reset the scroll flag when selectedDate changes
  useEffect(() => {
    hasScrolledToCurrentTime.current = false;
  }, [selectedDate]);

  // Auto-scroll to current time and center it when viewing today
  useEffect(() => {
    const today = new Date();
    const weekStart = getWeekStartDate();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    // Check if today is in the current week
    const isTodayInWeek = today >= weekStart && today <= weekEnd;
    if (isTodayInWeek) {
      // Center the current time line
      setTimeout(() => {
        scrollToCurrentTime();
      }, 300);
    }
  }, [selectedDate, scrollToCurrentTime]);

  return (
    <View style={{ flex: 1, marginTop: 20 }}>

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
        scrollEnabled={true}
        directionalLockEnabled={true}
      />
    </View>
  );
});

WeeklyCalendarView.displayName = 'WeeklyCalendarView';

const styles = StyleSheet.create({
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: '#dadce0',
    backgroundColor: '#ffffff',
  },
  dateContainer: {
    width: 25,
    alignItems: 'center',
    paddingVertical: 2,
    marginLeft: 30,
  },
  headerContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingTop: 0,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#dadce0',
  },
  timeColumnHeader: {
    width: TIME_COLUMN_WIDTH,
  },
  dateHeader: {
    width: DAY_COLUMN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: {
    fontSize: 10,
    color: '#5f6368',
    fontWeight: '500',
    fontFamily: 'Onest',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  todayText: {
    color: '#00ACC1',
    fontWeight: '600',
  },
  timeColumn: {
    width: TIME_COLUMN_WIDTH,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderColor: '#f1f3f4',
    paddingRight: 12,
  },
  timeText: {
    fontSize: 10,
    color: '#5f6368',
    fontFamily: 'Onest',
    textAlign: 'right',
    marginBottom: 0,
    marginTop: 0,
    backgroundColor: 'transparent',
    paddingRight: 12,
    fontWeight: '400',
  },
  dayColumn: {
    width: DAY_COLUMN_WIDTH,
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  gridBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    borderRightWidth: 1,
    borderColor: '#f1f3f4',
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
    borderColor: '#f8f9fa',
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
    backgroundColor: '#e8f0fe',
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
    backgroundColor: '#4285f4', // This will be overridden by category color
    borderRadius: 4,
    minHeight: 22,
    zIndex: 2,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventTextContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  eventText: {
    fontSize: 11,
    color: '#3A3A3A',
    fontFamily: 'Onest',
    textAlign: 'left',
    fontWeight: '400',
    lineHeight: 14,
  },

  monthLabel: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    fontFamily: 'Onest',
  },
  allDayEventBox: {
    borderRadius: 4,
    paddingHorizontal: 0,
    paddingVertical: 2,
    minWidth: 40,
    maxWidth: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#4285f4',
    marginVertical: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  allDayEventText: {
    color: '#3A3A3A',
    fontSize: 11,
    fontFamily: 'Onest',
    textAlign: 'center',
    fontWeight: '400',
  },
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#ea4335',
    zIndex: 10,
  },
  currentTimeDot: {
    position: 'absolute',
    left: -5,
    top: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ea4335',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  currentTimeLineContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#ea4335',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#202124',
    fontFamily: 'Onest',
  },
  todayDateText: {
    color: '#00ACC1',
    fontWeight: '600',
  },
  // Google Calendar Event styles
  googleEventBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#4285F410', // More transparent Google blue background
    borderRadius: 4,
    minHeight: 22,
    zIndex: 2,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default WeeklyCalendarView;
