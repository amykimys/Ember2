declare module 'react-native-big-calendar' {
  import { ViewStyle, TextStyle } from 'react-native';

  export interface Event {
    id: string;
    title: string;
    start: Date;
    end: Date;
    color?: string;
    description?: string;
  }

  export type CalendarEvent = Event;

  export interface CalendarProps {
    events: Event[];
    height: number;
    mode?: '3days' | 'week' | 'day' | 'agenda' | 'month';
    locale?: string;
    hideNowIndicator?: boolean;
    format24h?: boolean;
    swipeEnabled?: boolean;
    showTime?: boolean;
    showAllDayEventCell?: boolean;
    scrollToNow?: boolean;
    scrollOffsetMinutes?: number;
    onPressEvent?: (event: Event) => void;
    onPressCell?: (date: Date) => void;
    onSwipe?: (direction: 'left' | 'right') => void;
    style?: ViewStyle;
    headerContainerStyle?: ViewStyle;
    headerTextStyle?: TextStyle;
    eventCellStyle?: ViewStyle;
    eventTextStyle?: TextStyle;
    todayCellStyle?: ViewStyle;
    selectedCellStyle?: ViewStyle;
  }

  const Calendar: React.FC<CalendarProps>;
  export default Calendar;
} 