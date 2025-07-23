import React, { useCallback, useMemo, useRef } from 'react';
import 'react-native-reanimated'; // 👈 must be FIRST import
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Menu } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../supabase';
import { User } from '@supabase/supabase-js';
import { checkAndMoveTasksIfNeeded, forceCheckAndMoveTasks } from '../../utils/taskUtils';
import { Session } from '@supabase/supabase-js';
import { useState, useEffect} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppState } from 'react-native';


import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Modal,
  Keyboard,
  StyleSheet,
  TouchableWithoutFeedback,
  RefreshControl,
  SafeAreaView,
  Image,
  FlatList,
  Pressable,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PanGestureHandler, GestureHandlerRootView, State, Swipeable } from 'react-native-gesture-handler';
import styles from '../../styles/todo.styles';
import habitStyles from '../../styles/habit.styles';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import { Picker } from '@react-native-picker/picker';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import NetInfo from '@react-native-community/netinfo';
import CalendarStrip from 'react-native-calendar-strip';
import moment from 'moment';
import 'moment/locale/en-gb';
import { shareTaskWithFriend, shareHabitWithFriend, addFriendToSharedTask } from '../../utils/sharing';
import { arePushNotificationsEnabled } from '../../utils/notificationUtils';
import { useData } from '../../contexts/DataContext';
import { promptPhotoSharing, PhotoShareData } from '../../utils/photoSharing';
import * as FileSystem from 'expo-file-system';

import Toast from 'react-native-toast-message';
import { Colors } from '../../constants/Colors';



type RepeatOption = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
type WeekDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

const REPEAT_OPTIONS = [
  { value: 'none' as const, label: "Don't repeat" },
  { value: 'daily' as const, label: 'Daily' },
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
  { value: 'custom' as const, label: 'Custom' },
];

type RepeatUnit = 'days' | 'weeks' | 'months';

const REPEAT_UNITS: { value: RepeatUnit; label: string }[] = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
];

const WEEK_DAYS: { value: WeekDay; label: string; shortLabel: string }[] = [
  { value: 'sun', label: 'Sunday', shortLabel: 'S' },
  { value: 'mon', label: 'Monday', shortLabel: 'M' },
  { value: 'tue', label: 'Tuesday', shortLabel: 'T' },
  { value: 'wed', label: 'Wednesday', shortLabel: 'W' },
  { value: 'thu', label: 'Thursday', shortLabel: 'T' },
  { value: 'fri', label: 'Friday', shortLabel: 'F' },
  { value: 'sat', label: 'Saturday', shortLabel: 'S' },
];

const THEMES = {
  modern: ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'],
  blue: ['#006064', '#00ACC1', '#26C6DA', '#4DD0E1', '#80DEEA', '#B2EBF2', '#E0F7FA', '#F0FDFF'],
  green: ['#065f46', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#ecfdf5', '#f0fdf4'],
  purple: ['#581c87', '#7c3aed', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff', '#f3e8ff', '#faf5ff'],
  orange: ['#9a3412', '#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5', '#fff7ed'],
  pink: ['#831843', '#be185d', '#ec4899', '#f472b6', '#f9a8d4', '#fce7f3', '#fdf2f8', '#fef7ff'],
  gray: ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb', '#f3f4f6', '#f9fafb'],
  slate: ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0']
};


interface Category {
  id: string;
  label: string;
  color: string;
}

interface Habit {
  id: string;
  text: string;
  streak: number;
  description?: string;
  completedToday: boolean;
  completedDays: string[];
  color: string;
  requirePhoto: boolean;
  targetPerWeek: number;
  reminderTime?: string | null;
  user_id?: string;
  repeat_type: RepeatOption;
  repeat_end_date: string | null;
  notes: { [date: string]: string };
  photos: { [date: string]: string };
  category_id: string | null;
}

interface Todo {
  id: string;
  text: string;
  description?: string;
  completed: boolean;
  categoryId: string | null;
  date: Date;
  repeat?: RepeatOption;
  customRepeatDates?: Date[];
  repeatEndDate?: Date | null;
  reminderTime?: Date | null;
  photo?: string; // Add photo field
  deletedInstances?: string[]; // Track deleted instances of repeated tasks
  sharedFriends?: Array<{
    friend_id: string;
    friend_name: string;
    friend_avatar: string;
    friend_username: string;
  }>; // Add shared friends field

  category?: {
    id: string;
    label: string;
    color: string;
  } | null;
}

function darkenColor(hex: string, amount = 0.2): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - 255 * amount);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - 255 * amount);
  const b = Math.max(0, (num & 0x0000FF) - 255 * amount);

  return (
    '#' +
    [r, g, b]
      .map((c) => Math.round(c).toString(16).padStart(2, '0'))
      .join('')
  );
}

// Helper function to calculate weekly progress percentage
const getWeeklyProgressPercentage = (habit: Habit) => {
  const today = moment();
  const weekStart = moment().startOf('isoWeek');
  const weekEnd = moment().endOf('isoWeek');
  
  const completedThisWeek = (habit.completedDays || []).filter(date => {
    // Handle both old format (YYYY-MM-DD) and new format (YYYY-MM-DD-HH-MM-SS)
    const dateOnly = date.split('-').slice(0, 3).join('-'); // Extract YYYY-MM-DD part
    const habitDate = moment(dateOnly, 'YYYY-MM-DD');
    return habitDate.isBetween(weekStart, weekEnd, 'day', '[]');
  }).length;
  
  const target = habit.targetPerWeek || 7;
  const percentage = Math.min((completedThisWeek / target) * 100, 100);

  return percentage;
};

// Helper function to calculate current streak
const calculateCurrentStreak = (completedDays: string[]): number => {
  if (!completedDays || completedDays.length === 0) return 0;
  
  // Extract unique dates from completedDays (handle both YYYY-MM-DD and YYYY-MM-DD-HH-MM-SS formats)
  const uniqueDates = [...new Set(completedDays.map(date => {
    // Extract YYYY-MM-DD part from timestamp format
    return date.split('-').slice(0, 3).join('-');
  }))];
  
  // Sort dates in descending order (most recent first)
  const sortedDates = uniqueDates.sort((a, b) => moment(b).valueOf() - moment(a).valueOf());
  
  let streak = 0;
  const today = moment().format('YYYY-MM-DD');
  const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
  
  // Check if today is completed
  if (sortedDates.includes(today)) {
    streak = 1;
    let currentDate = moment(yesterday);
    
    // Count consecutive days backwards from yesterday
    while (sortedDates.includes(currentDate.format('YYYY-MM-DD'))) {
      streak++;
      currentDate = currentDate.subtract(1, 'day');
    }
  } else {
    // Today is not completed, check if yesterday is completed
    if (sortedDates.includes(yesterday)) {
      streak = 1;
      let currentDate = moment().subtract(2, 'day');
      
      // Count consecutive days backwards from day before yesterday
      while (sortedDates.includes(currentDate.format('YYYY-MM-DD'))) {
        streak++;
        currentDate = currentDate.subtract(1, 'day');
      }
    }
  }
  
  return streak;
};

export default function TodoScreen() {

  const [user, setUser] = useState<User | null>(null);

  // Initialize notifications for todo screen
  useEffect(() => {
    const initializeNotifications = async () => {
      try {        
        // Request permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          Toast.show({
            type: 'info',
            text1: 'Notifications Disabled',
            text2: 'Enable notifications in settings to receive task reminders',
            position: 'bottom',
          });
          return;
        }
              
        // Set up notification handler
        Notifications.setNotificationHandler({
          handleNotification: async (notification) => {
          
            // Handle todo reminder notifications
            if (notification.request.content.data?.type === 'todo_reminder') {
              return {
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
              };
            }
            
            // Default handling for other notifications
            return {
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
            };
          },
        });
              
        // Check current scheduled notifications
        const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
        
        // Filter and log only todo reminders
        const todoReminders = scheduledNotifications.filter(n => n.content.data?.type === 'todo_reminder');
        
        todoReminders.forEach((notification, index) => {
        });
        
      } catch (error) {
        console.error('🔔 [Todo Notifications] Error initializing notifications:', error);
      }
    };
    
    initializeNotifications();
  }, []);

  // Add notification listeners for todo screen
  useEffect(() => {
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  // Add focus effect to check notifications when screen is focused
  useEffect(() => {
    const checkNotifications = async () => {
      try {
        const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();        
        // Check if we have any todo reminders that should be active
        const todoReminders = scheduledNotifications.filter(n => 
          n.content.data?.type === 'todo_reminder'
        );
        todoReminders.forEach((notification, index) => {
        });
      } catch (error) {
        console.error('🔔 [Todo Notifications] Error checking notifications on focus:', error);
      }
    };
    checkNotifications();
  }, []);

  const lastRunDateRef = useRef<string | null>(null);

useEffect(() => {
  if (!user?.id) return;

  const handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === 'active') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const nowStr = now.toISOString().split('T')[0];
      if (lastRunDateRef.current !== nowStr) {
        console.log('🔄 [Todo] App became active, running auto-move tasks');
        moveIncompleteTasksForwardOneDay(user.id);
        lastRunDateRef.current = nowStr;
      }
    }
  };

  
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    // Run once on mount
    handleAppStateChange('active');
    return () => subscription.remove();
  }, [user]);

  // Create separate functions for fetching only todos and habits without categories
  const fetchTodosOnly = async (currentUser?: User | null) => {
    const userToUse = currentUser || user;
    if (!userToUse) return;

    const retryRequest = async (
      requestFn: () => Promise<any>,
      maxRetries: number = 3,
      delay: number = 1000
    ): Promise<any | null> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await requestFn();
          return result;
        } catch (error) {
          if (attempt === maxRetries) {
            console.error(`Request failed after ${maxRetries} attempts:`, error);
            return null;
          }
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
      return null;
    };

    try {
      const result = await retryRequest(async () => {
        const { data, error } = await supabase
          .from('todos')
          .select(`
            *,
            category:category_id (
              id,
              label,
              color
            )
          `)
          .eq('user_id', userToUse.id)
          .order('updated_at', { ascending: false });
      
        if (error) throw error;
        return data || [];
      });
    
      if (result) {
        const mappedTasks = result.map((task: any) => ({
          ...task,
          date: task.date ? new Date(task.date) : new Date(),
          repeatEndDate: task.repeat_end_date ? new Date(task.repeat_end_date) : null,
          category: task.category || null, // category object from join
        }));
        setTodos(mappedTasks);
        updateData('todos', mappedTasks);
    
        // Fetch shared info for these tasks
        const taskIds = mappedTasks.map((t: Todo) => t.id);
        fetchSharedFriendsForTasks(taskIds, userToUse);
      }
    } catch (error) {
      console.error('Error fetching todos only:', error);
    }
  };

  const fetchHabitsOnly = async (currentUser?: User | null) => {
    const userToUse = currentUser || user;
    if (!userToUse) return;

    const retryRequest = async (
      requestFn: () => Promise<any>,
      maxRetries: number = 3,
      delay: number = 1000
    ): Promise<any | null> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await requestFn();
          return result;
        } catch (error) {
          if (attempt === maxRetries) {
            console.error(`Request failed after ${maxRetries} attempts:`, error);
            return null;
          }
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
      return null;
    };

    try {
      const result = await retryRequest(async () => {
        const { data, error } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', userToUse.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      });

      if (result) {
        const processedHabits = result.map((habit: any) => {
          const completedDays = habit.completed_days || habit.completedDays || [];
          const calculatedStreak = calculateCurrentStreak(completedDays);
          
          return {
            ...habit,
            completedDays: completedDays,
            notes: habit.notes || {},
            photos: habit.photos || {},
            targetPerWeek: habit.target_per_week || habit.targetPerWeek || 7,
            requirePhoto: habit.require_photo || habit.requirePhoto || false,
            reminderTime: habit.reminder_time || habit.reminderTime || null,
            category_id: habit.category_id,
            streak: calculatedStreak,
            completedToday: completedDays.includes(moment().format('YYYY-MM-DD')),
          };
        });
        
        setHabits(processedHabits);
        updateData('habits', processedHabits);
      }
    } catch (error) {
      console.error('Error fetching habits only:', error);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    // Subscribe to real-time changes for this user's todos
    const channel = supabase
      .channel('todos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log('🔄 [Todo] Todos changed, fetching todos only');
          fetchTodosOnly(user);
        }
      )
      .subscribe();
  
    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

  // Add real-time subscription for habits
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel('habits-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habits',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log('🔄 [Todo] Habits changed, fetching habits only');
          fetchHabitsOnly(user);
        }
      )
      .subscribe();
  
    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);



  // Add function to update task reminder notifications
  const updateTaskReminderNotification = async (taskId: string, taskTitle: string, reminderTime: Date | null) => {
    try {
      
      // Cancel any existing notifications for this task
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const existingNotifications = scheduledNotifications.filter(n => 
        n.content.data?.type === 'todo_reminder' && 
        n.content.data?.taskId === taskId
      );
      
      for (const notification of existingNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
      
      // Schedule new notification if reminder time is set
      if (reminderTime) {
        
        await scheduleReminderNotification(taskTitle, reminderTime, taskId);
      } else {
      }
      
    } catch (error) {
      console.error('🔔 [Todo Notifications] Error updating task reminder notification:', error);
    }
  };

  // Add function to update habit reminder notifications
  const updateHabitReminderNotification = async (habitId: string, habitTitle: string, reminderTime: Date | null) => {
    try {
      
      // Cancel any existing notifications for this habit
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const existingNotifications = scheduledNotifications.filter(n => 
        n.content.data?.type === 'habit_reminder' && 
        n.content.data?.habitId === habitId
      );
      
      for (const notification of existingNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
      
      // Schedule new notification if reminder time is set
      if (reminderTime) {
        
        await scheduleReminderNotification(habitTitle, reminderTime, habitId);
      } else {
      }
      
    } catch (error) {
      console.error('🔔 [Todo Notifications] Error updating habit reminder notification:', error);
    }
  };

  const { data: appData, updateData } = useData();
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Debug function to compare preloaded vs fetched data
  const compareData = (preloadedTodos: any[], fetchedTodos: any[]) => {
    
    const preloadedIds = new Set(preloadedTodos.map(t => t.id));
    const fetchedIds = new Set(fetchedTodos.map(t => t.id));
    
    const onlyInPreloaded = preloadedTodos.filter(t => !fetchedIds.has(t.id));
    const onlyInFetched = fetchedTodos.filter(t => !preloadedIds.has(t.id));
    
    if (onlyInPreloaded.length > 0) {
    }
    if (onlyInFetched.length > 0) {
    }
  };
  const [todos, setTodos] = useState<Todo[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);

  // Add real-time subscription for shared_tasks to update friends info without full refetch
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel('shared-tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_tasks',
          filter: `shared_by=eq.${user.id},shared_with=eq.${user.id}`,
        },
        () => {
          // Only refetch shared friends data, not the entire dataset
          if (todos.length > 0) {
            const taskIds = todos.map(todo => todo.id);
            fetchSharedFriendsForTasks(taskIds, user);
          }
        }
      )
      .subscribe();
  
    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, todos.length]);

  // Add real-time subscription for categories to update without full refetch
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel('categories-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Only refetch categories data, not the entire dataset
          console.log('🔄 [Todo] Categories changed, refetching categories only');
          const fetchCategoriesOnly = async () => {
            try {
              const { data, error } = await supabase
                .from('categories')
                .select('*')
                .eq('user_id', user.id)
                .in('type', ['todo', 'task'])
                .order('created_at', { ascending: false });

              if (error) {
                console.error('❌ [Todo] Error fetching categories in real-time:', error);
                return;
              }

              console.log('🔄 [Todo] Real-time categories update:', data?.length || 0, 'categories');
              setCategories(data || []);
            } catch (error) {
              console.error('❌ [Todo] Error in real-time categories fetch:', error);
            }
          };
          
          fetchCategoriesOnly();
        }
      )
      .subscribe();
  
    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'habits'>('tasks');
  const [newTodo, setNewTodo] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#00ACC1');
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
    completed: true,
    uncategorized: false
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRepeat, setSelectedRepeat] = useState<RepeatOption>('none');
  const [taskDate, setTaskDate] = useState<Date | null>(null);
  const [repeatEndDate, setRepeatEndDate] = useState<Date | null>(null);
  const [showRepeatEndDatePicker, setShowRepeatEndDatePicker] = useState(false);
  const [customRepeatFrequency, setCustomRepeatFrequency] = useState('1');
  const [customRepeatUnit, setCustomRepeatUnit] = useState<'days' | 'weeks' | 'months'>('days');
  const [selectedWeekDays, setSelectedWeekDays] = useState<WeekDay[]>([]);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [swipingTodoId, setSwipingTodoId] = useState<string | null>(null);
  const [isNewTaskModalVisible, setIsNewTaskModalVisible] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<Date[]>([]);
  const newTodoInputRef = useRef<TextInput | null>(null);
  const newDescriptionInputRef = useRef<TextInput | null>(null);
  const reminderButtonRef = useRef<View>(null);
  const [reminderButtonLayout, setReminderButtonLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({ x: 0, y: 0, width: 0, height: 0 });
  const [calendarDates, setCalendarDates] = useState<Date[]>([]);
  const calendarStripRef = useRef<any>(null);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [showCategoryBox, setShowCategoryBox] = useState(false);
  const categoryInputRef = useRef<TextInput>(null);
  const [isNewCategoryModalVisible, setIsNewCategoryModalVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [selectedDay, setSelectedDay] = useState(new Date().getDate().toString().padStart(2, '0'));
  const [customSelectedDates, setCustomSelectedDates] = useState<string[]>([]);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showHeaderDatePicker, setShowHeaderDatePicker] = useState(false);
  const headerDatePickerOpacity = useSharedValue(0);
  const headerDatePickerScale = useSharedValue(0.95);

  const headerDatePickerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: headerDatePickerOpacity.value,
      transform: [{ scale: headerDatePickerScale.value }],
    };
  });

  const showHeaderDatePickerPanel = () => {
    setShowHeaderDatePicker(true);
    headerDatePickerOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
    headerDatePickerScale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
  };

  const hideHeaderDatePickerPanel = () => {
    headerDatePickerOpacity.value = withTiming(0, { duration: 150, easing: Easing.in(Easing.cubic) });
    headerDatePickerScale.value = withTiming(0.95, { duration: 150, easing: Easing.in(Easing.cubic) });
    setTimeout(() => {
      setShowHeaderDatePicker(false);
    }, 150);
  };
  const [showTaskDatePicker, setShowTaskDatePicker] = useState(false);
  const [dateButtonLayout, setDateButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const dateButtonRef = useRef<View>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [showInlineEndDatePicker, setShowInlineEndDatePicker] = useState(false);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);

  const [showReminderOptions, setShowReminderOptions] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Add timeout refs for debouncing picker closes
  const timeoutRefs = {
    start: useRef<NodeJS.Timeout>(),
    end: useRef<NodeJS.Timeout>(),
    reminder: useRef<NodeJS.Timeout>(),
    repeat: useRef<NodeJS.Timeout>(),
    endDate: useRef<NodeJS.Timeout>(),
  };

  // Add debounce function
  const debouncePickerClose = (pickerType: 'start' | 'end' | 'reminder' | 'repeat' | 'endDate') => {
    // Clear any existing timeout
    if (timeoutRefs[pickerType].current) {
      clearTimeout(timeoutRefs[pickerType].current);
    }

    // Set new timeout
    timeoutRefs[pickerType].current = setTimeout(() => {
      switch (pickerType) {
        case 'start':
          // setShowStartPicker(false);
          break;
        case 'end':
          // setShowEndPicker(false);
          break;
        case 'reminder':
          setShowReminderPicker(false);
          break;
        case 'repeat':
          setShowRepeatPicker(false);
          break;
        case 'endDate':
          setShowEndDatePicker(false);
          break;
      }
    }, 60000); // 2 minute delay
  };

  // Habit modal state
  const [isNewHabitModalVisible, setIsNewHabitModalVisible] = useState(false);
  const [newHabit, setNewHabit] = useState('');
  const [quickAddText, setQuickAddText] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const quickAddInputRef = useRef<TextInput>(null);
  const [newHabitDescription, setNewHabitDescription] = useState('');
  const [newHabitColor, setNewHabitColor] = useState('');
  // Add new habit reminder and photo proof state
  const [habitReminderTime, setHabitReminderTime] = useState<Date | null>(null);
  const [showHabitReminderPicker, setShowHabitReminderPicker] = useState(false);
  const [habitRequirePhoto, setHabitRequirePhoto] = useState(false);
  const [habitTargetPerWeek, setHabitTargetPerWeek] = useState(0);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  
  // Add ref for habit title input
  const newHabitInputRef = useRef<TextInput>(null);
  // Add state for photo modal
  const [isPhotoModalVisible, setIsPhotoModalVisible] = useState(false);
  const [selectedHabitForPhoto, setSelectedHabitForPhoto] = useState<Habit | null>(null);

  // Add state for photo viewing modal
  const [selectedPhotoForViewing, setSelectedPhotoForViewing] = useState<{
    habit: Habit;
    photoUrl: string;
    date: string;
    formattedDate: string;
  } | null>(null);
  const [isPhotoViewerVisible, setIsPhotoViewerVisible] = useState(false);

  
  // Add state for unified photo/notes modal
  const [isHabitLogModalVisible, setIsHabitLogModalVisible] = useState(false);
  const [selectedHabitForLog, setSelectedHabitForLog] = useState<Habit | null>(null);
  const [logNoteText, setLogNoteText] = useState('');
  const [logDate, setLogDate] = useState(moment().format('YYYY-MM-DD'));

  // Add state for monthly progress chart modal
  const [isMonthlyProgressModalVisible, setIsMonthlyProgressModalVisible] = useState(false);


  const [selectedMonthForProgress, setSelectedMonthForProgress] = useState(moment().startOf('month'));
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isQuickAddFocused, setIsQuickAddFocused] = useState(false);
  const [showQuickAddBox, setShowQuickAddBox] = useState(false);
  
  // Habit quick add state
  const [quickAddHabitText, setQuickAddHabitText] = useState('');
  const [isQuickAddingHabit, setIsQuickAddingHabit] = useState(false);
  const quickAddHabitInputRef = useRef<TextInput>(null);
  const [isQuickAddHabitFocused, setIsQuickAddHabitFocused] = useState(false);
  const [showQuickAddHabitBox, setShowQuickAddHabitBox] = useState(false);
  const [quickAddWeeklyGoal, setQuickAddWeeklyGoal] = useState(7); // Default to 7 times per week
  const [showWeeklyGoalPanel, setShowWeeklyGoalPanel] = useState(false);

  
  // Add state for detail modal to show notes and photos
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedDateData, setSelectedDateData] = useState<{
    habit: Habit;
    date: string;
    formattedDate: string;
    note?: string;
    photo?: string;
    isCompleted: boolean;
  } | null>(null);

  // Add state for photo navigation
  const [allPhotosForViewing, setAllPhotosForViewing] = useState<Array<{
    habit: Habit;
    photoUrl: string;
    date: string;
    formattedDate: string;
  }>>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Add ref for Swipeable components
  const swipeableRefs = useRef<{ [key: string]: any }>({});
  
  // Add ref for tracking last press time for double-click detection
  const lastPressTime = useRef<{ [key: string]: number }>({});

  // Add state for notes viewer modal
  const [isNotesViewerModalVisible, setIsNotesViewerModalVisible] = useState(false);
  
  // Add state for expanded habits
  const [expandedHabits, setExpandedHabits] = useState<Record<string, boolean>>({});
  const [selectedHabitForViewingNotes, setSelectedHabitForViewingNotes] = useState<Habit | null>(null);

  // Add state for editing notes in viewer modal
  const [editingNoteInViewer, setEditingNoteInViewer] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Add friends state for sharing
  const [friends, setFriends] = useState<Array<{
    friend_id: string;
    friend_name: string;
    friend_avatar: string;
    friend_username: string;
    friendship_id: string;
    status: string;
    created_at: string;
  }>>([]);

  // Add state for selected friends in Add Task modal
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  // Add state for searching friends
  const [searchFriend, setSearchFriend] = useState('');
  
  // Add state for search input focus
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Add state to track shared friends for each task
  const [taskSharedFriends, setTaskSharedFriends] = useState<Record<string, Array<{
    friend_id: string;
    friend_name: string;
    friend_avatar: string;
    friend_username: string;
  }>>>({});

  // Add state to track who shared each task with the current user
  const [taskSharedBy, setTaskSharedBy] = useState<Record<string, {
    friend_id: string;
    friend_name: string;
    friend_avatar: string;
    friend_username: string;
  }>>({});


  // Add this function to handle the end date selection
  const handleEndDateConfirm = () => {
    const selectedDate = new Date(
      parseInt(selectedYear),
      parseInt(selectedMonth) - 1,
      parseInt(selectedDay)
    );
    setRepeatEndDate(selectedDate);
    setShowRepeatEndDatePicker(false);
  };

  // Add notification listeners for shared task notifications
  useEffect(() => {
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      
      // Handle shared task notifications
      const notificationData = response.notification.request.content.data;
      if (notificationData?.type === 'task_shared') {
      
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, [user]);

  useEffect(() => {
  }, [isCategoryModalVisible]);
  
  // Move the useEffect for input focus here
  useEffect(() => {
    if (isNewTaskModalVisible && newTodoInputRef.current) {
      setTimeout(() => {
        newTodoInputRef.current?.focus();
      }, 150);
    }
  }, [isNewTaskModalVisible]);

  // Add useEffect for habit title input focus
  useEffect(() => {
    if (isNewHabitModalVisible && newHabitInputRef.current) {
      setTimeout(() => {
        newHabitInputRef.current?.focus();
      }, 150);
    }
  }, [isNewHabitModalVisible]);

  // Add useEffect to monitor detail modal state
  useEffect(() => {
    
  }, [isDetailModalVisible, selectedDateData]);

  const resetForm = () => {
    setNewTodo('');
    setNewDescription('');
    setSelectedCategoryId('');
    setShowNewCategoryInput(false);
    setNewCategoryName('');
    setNewCategoryColor('#00ACC1');
    setEditingTodo(null);
    setCollapsedCategories({
      completed: true
    });
    // Don't reset currentDate here
    setTaskDate(null);
    setReminderTime(null);
    setSelectedRepeat('none');
    setRepeatEndDate(null);
    setShowInlineEndDatePicker(false);
    setShowRepeatPicker(false);
    setCustomRepeatFrequency('1');
    setCustomRepeatUnit('days');
    setSelectedWeekDays([]);
    setSelectedFriends([]);
    setSearchFriend('');
  };

  async function scheduleReminderNotification(taskTitle: string, reminderTime: Date, taskId?: string) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      // Check notification permissions first
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        return;
      }

      // Check if push notifications are enabled for this user
      const notificationsEnabled = await arePushNotificationsEnabled(user.id);
      
      if (!notificationsEnabled) {
        return;
      }
      const now = new Date();
    
      // Allow scheduling notifications up to 1 minute in the past (for edge cases)
      if (reminderTime.getTime() < now.getTime() - 60000) {
        return;
      }
  
      // Create a unique identifier for this notification
      const notificationId = `todo_reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
              const scheduledNotification = await Notifications.scheduleNotificationAsync({
          identifier: notificationId,
          content: {
            title: "Task Reminder",
            body: taskTitle,
            sound: 'default',
            data: { type: 'todo_reminder', taskTitle, taskId },
          },
          trigger: {
            type: 'date',
            date: reminderTime,
          } as Notifications.DateTriggerInput,
        });
      
      
      // Verify the notification was scheduled
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const ourNotification = scheduledNotifications.find(n => n.identifier === scheduledNotification);
      
      scheduledNotifications.forEach((notification, index) => {
      });

      // Show success message to user
      Toast.show({
        type: 'success',
        text1: 'Reminder Set',
        text2: `You'll be reminded at ${reminderTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}`,
        position: 'bottom',
      });
  
    } catch (error) {
      console.error('🔔 [Todo Notifications] Error scheduling notification:', error);
      
      // Show error message to user
      Toast.show({
        type: 'error',
        text1: 'Reminder Error',
        text2: 'Failed to set reminder. Please try again.',
        position: 'bottom',
      });
    }
  }

  const handleSave = async () => {
    if (!newTodo.trim()) return;
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        Alert.alert('Error', 'You must be logged in to create tasks.');
        return;
      }

      // Validate category ID if one is selected
      let validCategoryId = null;
      if (selectedCategoryId) {
        const categoryExists = categories.some(cat => cat.id === selectedCategoryId);
        if (!categoryExists) {
          console.warn('Selected category does not exist, clearing category selection');
          setSelectedCategoryId('');
        } else {
          validCategoryId = selectedCategoryId;
        }
      }

      // Create the new task
      const newTodoItem: Todo = {
        id: uuidv4(),
        text: newTodo.trim(),
        description: newDescription.trim(),
        completed: false,
        categoryId: validCategoryId,
        date: taskDate || currentDate,
        repeat: selectedRepeat,
        repeatEndDate: selectedRepeat !== 'none' ? repeatEndDate : undefined,
        customRepeatDates: selectedRepeat === 'custom' 
          ? customSelectedDates.map((str) => new Date(str))
          : undefined,
        reminderTime: reminderTime || null,
      };
      
      // OPTIMISTIC UPDATE: Add to local state immediately
      setTodos(prev => [newTodoItem, ...prev]);
      
      // Update DataContext for consistency
      updateData('todos', [newTodoItem, ...todos]);
      
      // Save task to Supabase
      const { error: taskError } = await supabase
        .from('todos')
        .insert({
          id: newTodoItem.id,
          text: newTodoItem.text,
          description: newTodoItem.description,
          completed: newTodoItem.completed,
          category_id: newTodoItem.categoryId,
          date: newTodoItem.date.toISOString(),
          repeat: newTodoItem.repeat,
          repeat_end_date: newTodoItem.repeatEndDate?.toISOString(),
          user_id: user.id,
          reminder_time: newTodoItem.reminderTime?.toISOString(),
          custom_repeat_dates: selectedRepeat === 'custom'
            ? customSelectedDates
            : null,
        });
      
      if (taskError) {
        console.error('Error saving task:', taskError);
        // REVERT OPTIMISTIC UPDATE on error
        setTodos(prev => prev.filter(todo => todo.id !== newTodoItem.id));
        updateData('todos', todos.filter(todo => todo.id !== newTodoItem.id));
        Alert.alert('Error', 'Failed to save task. Please try again.');
        return;
      }
      
      // Update local state with new task
      const updatedTodos = [...todos, newTodoItem];
      setTodos(updatedTodos);
      
      // Update DataContext with new task
      updateData('todos', updatedTodos);
      
      // Schedule reminder if set
      if (reminderTime) {
        await scheduleReminderNotification(newTodo.trim(), reminderTime, newTodoItem.id);
      } else {
      }

      // Share with selected friends BEFORE resetting the form
      if (selectedFriends.length > 0 && newTodoItem.id && user?.id) {
        // Fetch friend profiles to immediately update the UI
        const { data: friendProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, username')
          .in('id', selectedFriends);

        if (profilesError) {
          console.error('❌ handleSave: Error fetching friend profiles:', profilesError);
        }

        // Create friend data for immediate UI update
        const friendData = friendProfiles?.map(profile => ({
          friend_id: profile.id,
          friend_name: profile.full_name || 'Unknown',
          friend_avatar: profile.avatar_url || '',
          friend_username: profile.username || '',
        })) || [];

        // Immediately update the local state to show friend information
        setTaskSharedFriends(prev => ({
          ...prev,
          [newTodoItem.id]: friendData
        }));

        // Share with each friend
        for (const friendId of selectedFriends) {
          try {
            await shareTaskWithFriend(newTodoItem.id, friendId, user.id);
          } catch (error) {
            console.error('❌ handleSave: Error sharing with friend:', friendId, error);
          }
        }
      } else {
      }

      // Reset form and close modal
      resetForm();
      setIsNewTaskModalVisible(false);
      Keyboard.dismiss();
      
      // Provide haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };
  
  const handleEditSave = async () => {
    if (editingTodo && newTodo.trim()) {
      try {
        // Validate category ID if one is selected
        if (selectedCategoryId) {
          const categoryExists = categories.some(cat => cat.id === selectedCategoryId);
          if (!categoryExists) {
            console.warn('Selected category does not exist, clearing category selection');
            setSelectedCategoryId('');
          }
        }

        const updatedTodo = {
          ...editingTodo,
          text: newTodo,
          description: newDescription,
          categoryId: selectedCategoryId && categories.some(cat => cat.id === selectedCategoryId) ? selectedCategoryId : null,
          date: taskDate || new Date(),
          repeat: selectedRepeat,
          repeatEndDate,
          customRepeatDates: selectedRepeat === 'custom' 
            ? customSelectedDates.map((str) => new Date(str))
            : undefined,
          reminderTime: reminderTime || null,
        };
    
        const updatedTodos = todos.map(todo => (todo.id === editingTodo.id ? updatedTodo : todo));
        setTodos(updatedTodos);
        
        // Update DataContext with edited task
        updateData('todos', updatedTodos);
    
        // If a new category was added
        if (showNewCategoryInput && newCategoryName.trim()) {
          const newCategory = {
            id: uuidv4(),
            label: newCategoryName.trim(),
            color: newCategoryColor,
          };
          setCategories(prev => [...prev, newCategory]);

          // Save new category to Supabase if user is logged in
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { error } = await supabase
              .from('categories')
              .insert({
                id: newCategory.id,
                label: newCategory.label,
                color: newCategory.color,
                user_id: user.id,
                type: 'todo'  // Changed from 'task' to 'todo'
              });
            
            if (error) {
              console.error('Error saving category:', error);
              Alert.alert('Error', 'Failed to save category. Please try again.');
              return;
            }
          }
        }

        // Update task in Supabase if user is logged in
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase
            .from('todos')
            .update({
              text: updatedTodo.text,
              description: updatedTodo.description,
              category_id: updatedTodo.categoryId,
              date: updatedTodo.date.toISOString(),
              repeat: updatedTodo.repeat,
              repeat_end_date: updatedTodo.repeatEndDate?.toISOString(),
              reminder_time: updatedTodo.reminderTime?.toISOString(),
              custom_repeat_dates: selectedRepeat === 'custom'
                ? customSelectedDates
                : null,
            })
            .eq('id', updatedTodo.id)
            .eq('user_id', user.id);
          
          if (error) {
            console.error('Error updating task:', error);
            Alert.alert('Error', 'Failed to update task. Please try again.');
            return;
          }
          
          // Handle friend sharing updates
          if (editingTodo.id) {
            // Determine the correct task ID for sharing
            let originalTaskId = editingTodo.id;
            
            // If this is a copied shared task (starts with 'shared-'), we need to find the original
            if (editingTodo.id.startsWith('shared-')) {
              
              // Find the original task ID by looking for shared_tasks where this user is the recipient
              const { data: sharedTaskData, error: findError } = await supabase
                .from('shared_tasks')
                .select('original_task_id')
                .eq('shared_with', user.id)
                .single();
                
              if (!findError && sharedTaskData) {
                originalTaskId = sharedTaskData.original_task_id;
              } else {
                return;
              }
            }
            
            // Only allow sharing updates if the user is the original task owner
            // Check if the user is the owner of the original task
            const { data: taskOwner, error: ownerError } = await supabase
              .from('todos')
              .select('user_id')
              .eq('id', originalTaskId)
              .single();
              
            if (ownerError || !taskOwner || taskOwner.user_id !== user.id) {
              return;
            }            
            // Get current friends this task is shared with and their copied task IDs
            const { data: existingShares, error: sharesError } = await supabase
              .from('shared_tasks')
              .select('shared_with, copied_task_id')
              .eq('original_task_id', originalTaskId)
              .eq('shared_by', user.id);
            
            if (sharesError) {
              console.error('🔍 [Edit Save] Error fetching existing shares:', sharesError);
            }
            
            const existingFriendIds = existingShares?.map(share => share.shared_with) || [];
            const existingShareMap = new Map(
              existingShares?.map(share => [share.shared_with, share.copied_task_id]) || []
            );
          
            // Remove shares for friends no longer selected
            const friendsToRemove = existingFriendIds.filter(friendId => !selectedFriends.includes(friendId));
            if (friendsToRemove.length > 0) {
              
              // Delete the shared task records
              await supabase
                .from('shared_tasks')
                .delete()
                .eq('original_task_id', originalTaskId)
                .eq('shared_by', user.id)
                .in('shared_with', friendsToRemove);
              
              // Delete the copied tasks for those friends
              const copiedTaskIdsToDelete = friendsToRemove
                .map(friendId => existingShareMap.get(friendId))
                .filter(id => id); // Remove undefined values
              
              if (copiedTaskIdsToDelete.length > 0) {
                await supabase
                  .from('todos')
                  .delete()
                  .in('id', copiedTaskIdsToDelete);
              }
            }
            
            // Update existing shared tasks for friends who are still selected
            const friendsToUpdate = selectedFriends.filter(friendId => existingFriendIds.includes(friendId));
            for (const friendId of friendsToUpdate) {
              const copiedTaskId = existingShareMap.get(friendId);
              if (copiedTaskId) {
                try {
                  await supabase
                    .from('todos')
                    .update({
                      text: updatedTodo.text,
                      description: updatedTodo.description,
                      category_id: updatedTodo.categoryId,
                      date: updatedTodo.date.toISOString(),
                      repeat: updatedTodo.repeat,
                      repeat_end_date: updatedTodo.repeatEndDate?.toISOString(),
                      reminder_time: updatedTodo.reminderTime?.toISOString(),
                      custom_repeat_dates: selectedRepeat === 'custom'
                        ? customSelectedDates
                        : null,
                    })
                    .eq('id', copiedTaskId);
                } catch (updateError) {
                  console.error('🔍 [Edit Save] Error updating shared task for friend:', friendId, updateError);
                }
              }
            }
            
            // Add shares for new friends only (create new copies)
            const newFriends = selectedFriends.filter(friendId => !existingFriendIds.includes(friendId));
            if (newFriends.length > 0) {
              for (const friendId of newFriends) {
                try {
                  // Use the new function that only adds friends without creating duplicates
                  await addFriendToSharedTask(originalTaskId, friendId, user.id);
                } catch (shareError) {
                  console.error('🔍 [Edit Save] Error adding friend to shared task:', friendId, shareError);
                }
              }
            } else {
            }
          }
        }

        // Update reminder notification
        await updateTaskReminderNotification(updatedTodo.id, updatedTodo.text, reminderTime);
    
        hideModal();
        // Delay resetForm to prevent title change during modal closing animation
        setTimeout(() => {
          setEditingTodo(null);
          resetForm();
        }, 300);
      } catch (error) {
        console.error('Error in handleEditSave:', error);
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      }
    }
  };

  const moveIncompleteTasksForwardOneDay = async (userId: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Find all incomplete tasks with a date before today
  const { data: oldTasks, error } = await supabase
        .from('todos')
        .select('*')
    .eq('user_id', userId)
    .lt('date', todayStr)
    .eq('completed', false);

      if (error) {
    console.error('Error fetching old incomplete tasks:', error);
        return;
      }

  if (!oldTasks || oldTasks.length === 0) return;

  // Update each task to its next day
  const updates = oldTasks.map(task => {
    const oldDate = new Date(task.date);
    oldDate.setDate(oldDate.getDate() + 1);
    const newDateStr = oldDate.toISOString().split('T')[0];
    return supabase
      .from('todos')
      .update({ date: newDateStr })
      .eq('id', task.id)
      .eq('user_id', userId);
  });
  await Promise.all(updates);
};
  
  const toggleTodo = async (id: string) => {
    try {
      
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        Alert.alert('Error', 'You must be logged in to update tasks.');
        return;
      }

      // Find the task to toggle
      const taskToToggle = todos.find(todo => todo.id === id);
      if (!taskToToggle) {
        console.error('Task not found');
        return;
      }

      // Update in Supabase
      const { error } = await supabase
        .from('todos')
        .update({ completed: !taskToToggle.completed })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating task in Supabase:', error);
        Alert.alert('Error', 'Failed to update task. Please try again.');
        return;
      }

      // Update local state
      const updatedTodos = todos.map(todo => 
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      );
      setTodos(updatedTodos);
      
      // Update DataContext with toggled task
      updateData('todos', updatedTodos);
      
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error in toggleTodo:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const toggleHabit = async (habitId: string) => {
    try {
      const habitToToggle = habits.find(h => h.id === habitId);
      if (!habitToToggle) return;

      const today = moment().format('YYYY-MM-DD');
      
      const isCompletedToday = habitToToggle.completedDays.some(date => date.startsWith(today));

      if (isCompletedToday) {
        // If already completed today, undo the completion
        await undoHabitCompletion(habitId, today);
        return;
      }

      if (habitToToggle.requirePhoto) {
        // Show photo prompt
        addHabitPhoto(habitToToggle);
        return;
      }

      // Complete the habit for today
      await completeHabit(habitId, today, isCompletedToday);
    } catch (error) {
      console.error('Error toggling habit:', error);
    }
  };

  const completeHabit = async (habitId: string, today: string, isCompletedToday: boolean) => {
    try {
      const habitToToggle = habits.find(habit => habit.id === habitId);
      if (!habitToToggle) {
        console.error('Habit not found');
        return;
      }

      const currentCompletedDays = habitToToggle.completedDays || [];
      
      // Check if already completed today (handle both old and new formats)
      const isAlreadyCompleted = currentCompletedDays.some(date => date.startsWith(today));
      if (isAlreadyCompleted) {
        return;
      }
      
      // Add the date to the array (simple YYYY-MM-DD format)
      const newCompletedDays = [...currentCompletedDays, today];

      // Update in Supabase
      const { error } = await supabase
        .from('habits')
        .update({
          completed_days: newCompletedDays,
          streak: calculateCurrentStreak(newCompletedDays)
        })
        .eq('id', habitId);

      if (error) {
        console.error('Error updating habit:', error);
        Alert.alert('Error', 'Failed to update habit. Please try again.');
        return;
      }

      // Update local state
      setHabits(prev => {
        const updatedHabits = prev.map(habit =>
          habit.id === habitId
            ? {
                ...habit,
                completedDays: newCompletedDays,
                streak: calculateCurrentStreak(newCompletedDays),
                completedToday: true
              }
            : habit
        );
        return updatedHabits;
      });

      // Force a re-render to ensure all UI elements update
      setCurrentDate(new Date());

      // Show success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error completing habit:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const undoHabitCompletion = async (habitId: string, today: string) => {
    try {
      const habitToToggle = habits.find(habit => habit.id === habitId);
      if (!habitToToggle) {
        console.error('Habit not found');
        return;
      }

      const currentCompletedDays = habitToToggle.completedDays || [];
      
      // Remove all entries for today (handle both old and new formats)
      const newCompletedDays = currentCompletedDays.filter(date => !date.startsWith(today));

      // Update in Supabase
      const { error } = await supabase
        .from('habits')
        .update({
          completed_days: newCompletedDays,
          streak: calculateCurrentStreak(newCompletedDays)
        })
        .eq('id', habitId);

      if (error) {
        console.error('Error undoing habit completion:', error);
        Alert.alert('Error', 'Failed to undo habit completion. Please try again.');
        return;
      }

      // Update local state
      setHabits(prev => {
        const updatedHabits = prev.map(habit =>
          habit.id === habitId
            ? {
                ...habit,
                completedDays: newCompletedDays,
                streak: calculateCurrentStreak(newCompletedDays),
                completedToday: false
              }
            : habit
        );
        return updatedHabits;
      });

      // Force a re-render to ensure all UI elements update
      setCurrentDate(new Date());

      // Show success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error undoing habit completion:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const uploadHabitPhoto = async (photoUri: string, habitId: string, date: string): Promise<string> => {
    try {
      // First, let's check if the file exists and get its info
      const fileInfo = await FileSystem.getInfoAsync(photoUri);
      
      if (!fileInfo.exists) {
        throw new Error('Photo file does not exist');
      }
      
      // Create a unique filename with habits category
      const fileExt = photoUri.split('.').pop() || 'jpg';
      const fileName = `habits/${habitId}/${date}_${Date.now()}.${fileExt}`;
      
      // Read the file as base64
      const base64Data = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      if (base64Data.length === 0) {
        throw new Error('Base64 data is empty');
      }
      
      // Convert base64 to Uint8Array for React Native compatibility
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Upload to Supabase Storage using Uint8Array
      const { data, error: uploadError } = await supabase.storage
        .from('memories')
        .upload(fileName, bytes, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('📸 Upload error:', uploadError);
        throw uploadError;
      }
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('memories')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('📸 Error uploading habit photo:', error);
      throw error;
    }
  };

  const completeHabitWithPhoto = async (habitId: string, photoUri: string, today: string) => {
    try {
      const habitToToggle = habits.find(habit => habit.id === habitId);
      if (!habitToToggle) return;

      // Upload photo to Supabase Storage first
      const uploadedPhotoUrl = await uploadHabitPhoto(photoUri, habitId, today);

      // Store the uploaded photo URL in the photos object
      const currentPhotos = habitToToggle.photos || {};
      const updatedPhotos = {
        ...currentPhotos,
        [today]: uploadedPhotoUrl  // Store the Supabase URL instead of local path
      };

      const currentCompletedDays = habitToToggle.completedDays || [];
      
      // Check if already completed today (handle both old and new formats)
      const isAlreadyCompleted = currentCompletedDays.some(date => date.startsWith(today));
      if (isAlreadyCompleted) {
        // Still update the photo even if already completed
        const { error } = await supabase
          .from('habits')
          .update({ 
            photos: updatedPhotos
          })
          .eq('id', habitId)
          .eq('user_id', user?.id);

        if (error) {
          console.error('Error updating habit photo in Supabase:', error);
          Alert.alert('Error', 'Failed to update photo. Please try again.');
          return;
        }

        // Update local state
        setHabits(prev => prev.map(habit => 
          habit.id === habitId 
            ? { 
                ...habit, 
                photos: updatedPhotos
              } 
            : habit
        ));

        Alert.alert('Success', 'Photo added to habit!');
        return;
      }
      
      // Add the date to the array (simple YYYY-MM-DD format)
      const newCompletedDays = [...currentCompletedDays, today];

      // Update in Supabase
      const { error } = await supabase
        .from('habits')
        .update({ 
          completed_days: newCompletedDays,
          photos: updatedPhotos,
          streak: calculateCurrentStreak(newCompletedDays)
        })
        .eq('id', habitId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error updating habit with photo in Supabase:', error);
        Alert.alert('Error', 'Failed to update habit. Please try again.');
        return;
      }

      // Update local state
      setHabits(prev => prev.map(habit => 
        habit.id === habitId 
          ? { 
              ...habit, 
              completedDays: newCompletedDays,
              completedToday: true,
              streak: calculateCurrentStreak(newCompletedDays),
              photos: updatedPhotos
            } 
          : habit
      ));

      // Force a re-render to ensure all UI elements update
      setCurrentDate(new Date());

      // Automatically share photo to friends feed (like events do)
      if (user?.id) {
        try {
          // Create social update for this habit photo
          const { error: socialError } = await supabase
            .from('social_updates')
            .insert({
              user_id: user.id,
              type: 'photo_share',
              photo_url: uploadedPhotoUrl,
              caption: '', // Let the friends feed fetch the actual habit title
              source_type: 'habit',
              source_id: habitId,
              is_public: true,
              content: {
                title: habitToToggle.text,
                photo_url: uploadedPhotoUrl
              }
            });

          if (socialError) {
            console.error('Error creating social update for habit photo:', socialError);
          } else {
            Toast.show({
              type: 'success',
              text1: 'Photo shared with friends!',
              position: 'bottom',
            });
          }
        } catch (error) {
          console.error('Error sharing habit photo to friends feed:', error);
        }
      }
      
      Alert.alert('Success', 'Habit completed with photo!');
      
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error in completeHabitWithPhoto:', error);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    }
  };

  const completeHabitWithNote = async (habitId: string, today: string, noteText: string) => {
    try {
      const habitToToggle = habits.find(habit => habit.id === habitId);
      if (!habitToToggle) return;

      const currentCompletedDays = habitToToggle.completedDays || [];
      
      // Check if already completed today (handle both old and new formats)
      const isAlreadyCompleted = currentCompletedDays.some(date => date.startsWith(today));
      if (isAlreadyCompleted) {
        // Still update the note even if already completed
        const currentNotes = habitToToggle.notes || {};
        const updatedNotes = {
          ...currentNotes,
          [today]: noteText
        };

        const { error } = await supabase
          .from('habits')
          .update({ 
            notes: updatedNotes
          })
          .eq('id', habitId)
          .eq('user_id', user?.id);

        if (error) {
          console.error('Error updating habit note in Supabase:', error);
          Alert.alert('Error', 'Failed to save note. Please try again.');
          return;
        }

        // Update local state
        setHabits(prev => prev.map(habit => 
          habit.id === habitId 
            ? { 
                ...habit, 
                notes: updatedNotes
              } 
            : habit
        ));

        Alert.alert('Success', 'Note added to habit!');
        return;
      }
      
      // Add the date to the array (simple YYYY-MM-DD format)
      const newCompletedDays = [...currentCompletedDays, today];

      // Update notes
      const currentNotes = habitToToggle.notes || {};
      const updatedNotes = {
        ...currentNotes,
        [today]: noteText
      };

      // Update in Supabase
      const { error } = await supabase
        .from('habits')
        .update({ 
          completed_days: newCompletedDays,
          notes: updatedNotes,
          streak: calculateCurrentStreak(newCompletedDays)
        })
        .eq('id', habitId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error updating habit with note in Supabase:', error);
        Alert.alert('Error', 'Failed to update habit. Please try again.');
        return;
      }

      // Update local state
      setHabits(prev => prev.map(habit => 
        habit.id === habitId 
          ? { 
              ...habit, 
              completedDays: newCompletedDays,
              completedToday: true,
              streak: calculateCurrentStreak(newCompletedDays),
              notes: updatedNotes
            } 
          : habit
      ));

      // Force a re-render to ensure all UI elements update
      setCurrentDate(new Date());
      
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error in completeHabitWithNote:', error);
      Alert.alert('Error', 'Failed to save note. Please try again.');
    }
  };

  const addNoteToHabit = async (habitId: string, today: string, noteText: string) => {
    try {
      const habitToToggle = habits.find(habit => habit.id === habitId);
      if (!habitToToggle) return;

      // Update notes without completing the habit
      const currentNotes = habitToToggle.notes || {};
      const updatedNotes = {
        ...currentNotes,
        [today]: noteText
      };

      // Update in Supabase
      const { error } = await supabase
        .from('habits')
        .update({ 
          notes: updatedNotes
        })
        .eq('id', habitId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error adding note to habit in Supabase:', error);
        Alert.alert('Error', 'Failed to save note. Please try again.');
        return;
      }

      // Update local state
      setHabits(prev => prev.map(habit => 
        habit.id === habitId 
          ? { 
              ...habit, 
              notes: updatedNotes
            } 
          : habit
      ));
      
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      Alert.alert('Success', 'Note added successfully!');
    } catch (error) {
      console.error('Error in addNoteToHabit:', error);
      Alert.alert('Error', 'Failed to save note. Please try again.');
    }
  };

  const updateExistingNote = async (habitId: string, date: string, noteText: string) => {
    try {
      const habitToToggle = habits.find(habit => habit.id === habitId);
      if (!habitToToggle) return;

      // Update the specific note
      const currentNotes = habitToToggle.notes || {};
      const updatedNotes = {
        ...currentNotes,
        [date]: noteText
      };

      // Update in Supabase
      const { error } = await supabase
        .from('habits')
        .update({ 
          notes: updatedNotes
        })
        .eq('id', habitId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error updating note in Supabase:', error);
        Alert.alert('Error', 'Failed to update note. Please try again.');
        return;
      }

      // Update local state
      setHabits(prev => prev.map(habit => 
        habit.id === habitId 
          ? { 
              ...habit, 
              notes: updatedNotes
            } 
          : habit
      ));
      
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      Alert.alert('Success', 'Note updated successfully!');
    } catch (error) {
      console.error('Error in updateExistingNote:', error);
      Alert.alert('Error', 'Failed to update note. Please try again.');
    }
  };

  const toggleCategoryCollapse = (categoryId: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };
  
  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const doesTodoBelongToday = (todo: Todo, date: Date) => {
    const taskDate = new Date(todo.date);
    const endDate = todo.repeatEndDate ? new Date(todo.repeatEndDate) : null;
  
    // Set both dates to start of day for proper comparison
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    const compareEndDate = endDate ? new Date(endDate) : null;
    if (compareEndDate) {
      compareEndDate.setHours(0, 0, 0, 0);
    }
  
    // Check if the date is after the end date (not including the end date)
    if (compareEndDate && compareDate > compareEndDate) return false;
  
    // Check if this specific instance has been deleted
    const dateString = date.toISOString().split('T')[0];
    if (todo.deletedInstances?.includes(dateString)) {
      return false;
    }
  
    if (isSameDay(taskDate, date)) return true; // normal case
  
    if (todo.repeat === 'daily') {
      return date >= taskDate;
    }
  
    if (todo.repeat === 'weekly') {
      return date >= taskDate && taskDate.getDay() === date.getDay();
    }
  
    if (todo.repeat === 'monthly') {
      return date >= taskDate && taskDate.getDate() === date.getDate();
    }
  
    if (todo.repeat === 'custom') {
      return todo.customRepeatDates?.some((d) => isSameDay(new Date(d), date)) ?? false;
    }
  
    return false;
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setTimeout(() => {
      calendarStripRef.current?.scrollToIndex({ index: 30, animated: true });
    }, 50);
  };

  // Helper function to delete a single instance of a repeated task
  const deleteSingleInstance = async (todo: Todo, currentDate: Date) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dateString = currentDate.toISOString().split('T')[0];
      const updatedDeletedInstances = [...(todo.deletedInstances || []), dateString];

      // Update the task in the database
      const { error } = await supabase
          .from('todos')
        .update({ deleted_instances: updatedDeletedInstances })
        .eq('id', todo.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating task:', error);
        Alert.alert('Error', 'Failed to delete task instance. Please try again.');
        return;
      }

      // Update local state
      setTodos(prev => 
        prev.map(t => 
          t.id === todo.id 
            ? { ...t, deletedInstances: updatedDeletedInstances }
            : t
        )
      );

      Toast.show({
        type: 'success',
        text1: 'Task instance deleted',
        position: 'bottom',
      });
    } catch (error) {
      console.error('Error in deleteSingleInstance:', error);
      Alert.alert('Error', 'Failed to delete task instance.');
    }
  };

  // Helper function to delete all future instances of a repeated task
  const deleteAllFutureInstances = async (todo: Todo) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Set the repeat end date to today
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today

      // Update the task in the database
      const { error } = await supabase
        .from('todos')
        .update({ repeat_end_date: today.toISOString() })
        .eq('id', todo.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating task:', error);
        Alert.alert('Error', 'Failed to delete future instances. Please try again.');
        return;
      }

      // Update local state
      setTodos(prev => 
        prev.map(t => 
          t.id === todo.id 
            ? { ...t, repeatEndDate: today }
            : t
        )
      );

      Toast.show({
        type: 'success',
        text1: 'Future instances deleted',
        position: 'bottom',
      });
    } catch (error) {
      console.error('Error in deleteAllFutureInstances:', error);
      Alert.alert('Error', 'Failed to delete future instances.');
    }
  };

  // Helper function to delete an entire task
  const deleteEntireTask = async (todo: Todo) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete from Supabase
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', todo.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting task:', error);
        Alert.alert('Error', 'Failed to delete task. Please try again.');
        return;
      }

      // Update local state
      const updatedTodos = todos.filter(t => t.id !== todo.id);
      setTodos(updatedTodos);
      
      // Update DataContext with deleted task
      updateData('todos', updatedTodos);

      Toast.show({
        type: 'success',
        text1: 'Task deleted',
        position: 'bottom',
      });
    } catch (error) {
      console.error('Error in deleteEntireTask:', error);
      Alert.alert('Error', 'Failed to delete task.');
    }
  };

  const renderTodoItem = (todo: Todo) => {
    const handleDelete = async () => {
      try {
        // Get the current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('No user logged in');
          Alert.alert('Error', 'You must be logged in to delete tasks.');
          return;
        }

        // Check if this is a repeated task
        if (todo.repeat && todo.repeat !== 'none') {
          // For repeated tasks, delete just this instance by default
          await deleteSingleInstance(todo, currentDate);
        } else {
          // For non-repeated tasks, delete normally
          await deleteEntireTask(todo);
        }

        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch (error) {
        console.error('Error in handleDelete:', error);
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      }
    };
  
    const renderRightActions = (_: any, dragX: any, swipeAnimatedValue: any) => {
      const category = categories.find(c => c.id === todo.categoryId);
      const baseColor = category?.color || '#FF3B30';
      const darkColor = darkenColor(baseColor);
  
      return (
        <View style={[styles.rightAction, { backgroundColor: darkColor }]}>
          <TouchableOpacity onPress={handleDelete} style={styles.trashIconContainer}>
            <Ionicons name="trash" size={20} color="white" />
          </TouchableOpacity>
        </View>
      );
    };

    const renderLeftActions = (_: any, dragX: any, swipeAnimatedValue: any) => {
      const category = categories.find(c => c.id === todo.categoryId);
      const baseColor = category?.color || '#00ACC1';
      const lightColor = baseColor + '20';
  
      return (
        <View style={[styles.leftAction, { backgroundColor: lightColor }]}>
          <TouchableOpacity 
            onPress={() => {
              moveTaskToTomorrow(todo.id);
            }} 
            style={[styles.photoIconContainer, { 
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: 8,
              padding: 12,
            }]}
            activeOpacity={0.5}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-forward" size={24} color={baseColor} />
          </TouchableOpacity>
        </View>
      );
    };
  
    const handleEdit = async () => {
      try {
        // Reset friends state first
        setSelectedFriends([]);
        setSearchFriend('');
        setIsSearchFocused(false);
        
        // Set form data
        setEditingTodo(todo);
        setNewTodo(todo.text);
        setNewDescription(todo.description || '');
        setTaskDate(todo.date);
        setSelectedCategoryId(todo.category?.id || '');
        setReminderTime(todo.reminderTime || null);
        setSelectedRepeat(todo.repeat || 'none');
        setRepeatEndDate(todo.repeatEndDate || null);
        if (todo.repeat === 'custom' && todo.customRepeatDates) {
          setCustomSelectedDates(todo.customRepeatDates.map(date => date.toISOString().split('T')[0]));
        }
        
        // Fetch existing shared friends for this task BEFORE opening the modal
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            showModal();
            return;
          }
          // Get all shared tasks where the current user is involved (either as sender or recipient)
          const { data: allSharedTasks, error: allError } = await supabase
            .from('shared_tasks')
            .select('original_task_id, shared_by, shared_with')
            .or(`shared_by.eq.${user.id},shared_with.eq.${user.id}`);

          if (allError) {
            console.error('🔍 [Edit Task] Error fetching all shared tasks:', allError);
            showModal();
            return;
          }
          // Find the specific shared task that matches this todo
          let relevantSharedTask = null;
          let originalTaskId = todo.id;

          // If this is a copied task (starts with 'shared-'), find the original
          if (todo.id.startsWith('shared-')) {
            
            // Look for a shared task where this user is the recipient
            relevantSharedTask = allSharedTasks?.find(st => 
              st.shared_with === user.id
            );
            
            if (relevantSharedTask) {
              originalTaskId = relevantSharedTask.original_task_id;
            }
          } else {
            // This is an original task, look for shared tasks where this user is the sender
            relevantSharedTask = allSharedTasks?.find(st => 
              st.original_task_id === todo.id && st.shared_by === user.id
            );
          }

          if (relevantSharedTask) {

            // Determine if user is sender or recipient
            const isRecipient = relevantSharedTask.shared_with === user.id;
            const taskOwnerId = relevantSharedTask.shared_by;
            // Fetch all friends involved in this shared task
            const { data: sharedTasks, error } = await supabase
              .from('shared_tasks')
              .select('shared_with')
              .eq('original_task_id', originalTaskId)
              .eq('shared_by', taskOwnerId);

            if (error) {
              console.error('🔍 [Edit Task] Error fetching shared friends:', error);
            } else if (sharedTasks && sharedTasks.length > 0) {

              // Extract the friend IDs and include the task owner
              let sharedFriendIds = sharedTasks.map((st: { shared_with: string }) => st.shared_with);
              
              // Include the task owner in the list for both senders and recipients
              if (!sharedFriendIds.includes(taskOwnerId)) {
                sharedFriendIds = [...sharedFriendIds, taskOwnerId];
              }
                            setSelectedFriends(sharedFriendIds);
            } else {
            }
          } else {
          }
        } catch (error) {
          console.error('🔍 [Edit Task] Error fetching shared friends, continuing without them:', error);
          // Continue without shared friends if there's an error
        }
        
        // Open the modal AFTER fetching friends
        showModal();
      } catch (error) {
        console.error('Error in handleEdit:', error);
        // Still try to open the modal even if there's an error
        showModal();
      }
    };

    const taskTouchable = (
      <TouchableOpacity
        style={[
          styles.todoItem,
          todo.completed && styles.completedTodo,
        ]}
        onLongPress={handleEdit}
        onPress={() => toggleTodo(todo.id)}
        delayLongPress={500}
        activeOpacity={0.9}
      >
        <View
          style={{ marginRight: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 2 }}
        >
          {todo.completed ? (
            <Ionicons name="checkmark" size={17} color={Colors.light.text}/>
          ) : (
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                borderWidth: 1.4,
                marginLeft: 4,
                borderColor: todo.category?.color
  ? darkenColor(todo.category.color)
  : Colors.light.icon,
              }}
            />
          )}
        </View>
    
        <View style={[styles.todoContent, { flex: 1 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[
            styles.todoText,
            todo.completed && styles.completedText,
              { color: Colors.light.text, fontFamily: 'Onest', flex: 1 }
          ]}>
            {todo.text}
          </Text>
          </View>
          {todo.description && (
            <Text style={[
              styles.todoDescription,
              todo.completed && styles.completedDescription,
              { fontFamily: 'Onest' }
            ]}>
              {todo.description}
            </Text>
          )}

        </View>

        {/* Right side container for shared friends */}
        <View style={{
          marginLeft: 12,
          justifyContent: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
          {/* Shared friends section */}
          {taskSharedFriends[todo.id] && taskSharedFriends[todo.id].length > 0 && (
            <View style={{
              alignItems: 'flex-end',
              gap: 4,
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}>
                {taskSharedFriends[todo.id].slice(0, 2).map((friend, index) => (
                  <View key={friend.friend_id} style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    {friend.friend_avatar && friend.friend_avatar.trim() !== '' ? (
                      <Image 
                        source={{ uri: friend.friend_avatar }} 
                        style={{ width: 18, height: 18, borderRadius: 9 }} 
                      />
                    ) : (
                      <View 
                        style={{ 
                          width: 18, 
                          height: 18, 
                          borderRadius: 9,
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      >
                        <Ionicons name="person" size={9} color={Colors.light.icon} />
                      </View>
                    )}
                    <Text style={{ 
                      fontSize: 12, 
                      color: '#00ACC1', 
                      fontFamily: 'Onest',
                      fontWeight: '600'
                    }}>
                      {friend.friend_name}
                    </Text>
                    {index < Math.min(taskSharedFriends[todo.id].length - 1, 1) && (
                      <Text style={{ fontSize: 12, color: '#00ACC1' }}>,</Text>
                    )}
                  </View>
                ))}
                {taskSharedFriends[todo.id].length > 2 && (
                  <Text style={{ 
                    fontSize: 12, 
                    color: '#00ACC1', 
                    fontFamily: 'Onest',
                    fontWeight: '600'
                  }}>
                    +{taskSharedFriends[todo.id].length - 2}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
    

    return (
      <Swipeable
        key={todo.id}
        renderRightActions={renderRightActions}
        renderLeftActions={renderLeftActions}
        onSwipeableWillOpen={() => setSwipingTodoId(todo.id)}
        onSwipeableClose={() => {
          requestAnimationFrame(() => {
            setSwipingTodoId(null);
          });
        }}        
        onSwipeableRightOpen={handleDelete}
        onSwipeableLeftOpen={() => moveTaskToTomorrow(todo.id)}
        friction={1.5}
        overshootRight={false}
        overshootLeft={false}
        rightThreshold={30}
        leftThreshold={30}
        enableTrackpadTwoFingerGesture={false}
      >
        {swipingTodoId === todo.id ? (
          <View style={{ borderRadius: 12, overflow: 'hidden' }}>
            {taskTouchable}
          </View>
        ) : (
          taskTouchable
        )}
      </Swipeable>
    );
  };
  
  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to delete categories.');
        return;
      }

      // First update all todos that use this category
      const { error: updateError } = await supabase
        .from('todos')
        .update({ category_id: null })
        .eq('category_id', categoryId)
        .eq('user_id', user.id);

        if (updateError) {
        console.error('Error updating todos:', updateError);
        Alert.alert('Error', 'Failed to update todos. Please try again.');
        return;
      }

      // Then delete the category
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)
        .in('type', ['todo', 'task']) // Delete both 'todo' and 'task' types
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Error deleting category:', deleteError);
        Alert.alert('Error', 'Failed to delete category. Please try again.');
        return;
      }

      // Update local state
      setCategories(prev => prev.filter(cat => cat.id !== categoryId));
      setTodos(prev => prev.map(todo => {
        if (todo.categoryId === categoryId) {
          return { ...todo, categoryId: null };
        }
        return todo;
      }));

      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId('');
      }
    } catch (error) {
      console.error('Error in handleDeleteCategory:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  // Add these memoized functions near the top of the component, after the state declarations
  const filteredTodos = useMemo(() => {
    return (todos || []).filter(todo => doesTodoBelongToday(todo, currentDate));
  }, [todos, currentDate]);

  const categorizedTodos = useMemo(() => {
    const result: Record<string, Todo[]> = {
      'uncategorized': [],
      'completed': [] // Restore the completed category
    };
    
    // Initialize with empty arrays for each category
    categories.forEach(category => {
      result[category.id] = [];
    });
    
    // Sort tasks into their respective categories
    filteredTodos.forEach(todo => {
      if (todo.completed) {
        result['completed'].push(todo);
      } else if (todo.category?.id && categories.some(cat => cat.id === todo.category?.id)) {
        result[todo.category.id].push(todo);
      } else {
        result['uncategorized'].push(todo);
      }
    });
    
    return result;
  }, [filteredTodos, categories]);

  // Add fetchData function to centralize data fetching
  const fetchData = async (currentUser?: User | null) => {
    const userToUse = currentUser || user;
    if (!userToUse) return;

    const retryRequest = async (
      requestFn: () => Promise<any>,
      maxRetries: number = 3,
      delay: number = 1000
    ): Promise<any | null> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await requestFn();
          return result;
        } catch (error) {
          if (attempt === maxRetries) {
            console.error(`Request failed after ${maxRetries} attempts:`, error);
            return null;
          }
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
      return null;
    };

    try {
      const fetchCategories = async () => {
        console.log('🔄 [Todo] fetchCategories: Starting to fetch categories for user:', userToUse.id);
        const result = await retryRequest(async () => {
          const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('user_id', userToUse.id)
            .in('type', ['todo', 'task']) // Fetch both 'todo' and 'task' types
            .order('created_at', { ascending: false });

          if (error) throw error;
          console.log('🔄 [Todo] fetchCategories: Fetched', data?.length || 0, 'categories');
          return data || [];
        });

        if (result) {
          console.log('🔄 [Todo] fetchCategories: Setting categories in state:', result.length);
          setCategories(result);
        }
      };

      const fetchTasks = async () => {
        const result = await retryRequest(async () => {
          const { data, error } = await supabase
            .from('todos')
            .select(`
              *,
              category:category_id (
                id,
                label,
                color
              )
            `)
            .eq('user_id', userToUse.id)
            .order('updated_at', { ascending: false });
      
          if (error) throw error;
          return data || [];
        });
      
        if (result) {
          const mappedTasks = result.map((task: any) => ({
            ...task,
            date: task.date ? new Date(task.date) : new Date(),
            repeatEndDate: task.repeat_end_date ? new Date(task.repeat_end_date) : null,
            category: task.category || null, // category object from join
          }));
          setTodos(mappedTasks);
          updateData('todos', mappedTasks);
      
          // Fetch shared info for these tasks
          const taskIds = mappedTasks.map((t: Todo) => t.id);
          fetchSharedFriendsForTasks(taskIds, userToUse);
        }
      };
      const fetchHabits = async () => {
        const result = await retryRequest(async () => {
          const { data, error } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', userToUse.id)
            .order('text', { ascending: true }); // Sort by habit text

          if (error) throw error;
          return data || [];
        });

        if (result) {
          const sortedHabits = result.map((habit: any) => {
            const completedDays = habit.completed_days || [];
            const calculatedStreak = calculateCurrentStreak(completedDays);
            
            return {
              ...habit,
              completedDays: completedDays,
              notes: habit.notes || {},
              photos: habit.photos || {},
              targetPerWeek: habit.target_per_week || 7,
              requirePhoto: habit.require_photo || false,
              reminderTime: habit.reminder_time || null,
              category_id: habit.category_id,
              streak: calculatedStreak, // Use calculated streak instead of stored streak
            };
          });
          setHabits(sortedHabits);
        }
      };

      const fetchFriends = async () => {
        const result = await retryRequest(async () => {
          const { data: friendships, error: friendshipsError } = await supabase
            .from('friendships')
            .select(`
              id,
              user_id,
              friend_id,
              status,
              created_at
            `)
            .or(`user_id.eq.${userToUse.id},friend_id.eq.${userToUse.id}`)
            .eq('status', 'accepted');

          if (friendshipsError) {
            console.error('❌ fetchFriends: Error fetching friendships:', friendshipsError);
            throw friendshipsError;
          }

          if (!friendships || friendships.length === 0) {
            return [];
          }

          const friendsWithProfiles = await Promise.all(
            friendships.map(async (friendship) => {
              const friendUserId = friendship.user_id === userToUse.id ? friendship.friend_id : friendship.user_id;
              
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, username')
                .eq('id', friendUserId)
                .maybeSingle(); // Use maybeSingle instead of single to handle missing profiles
              
              if (profileError) {
                console.error('❌ fetchFriends: Error fetching profile for friend:', friendUserId, profileError);
                return null; // Return null for friends with profile errors
              }
              
              // Only include friends that have valid profiles
              if (!profileData) {
                return null;
              }
              
              return {
                friendship_id: friendship.id,
                friend_id: friendUserId,
                friend_name: profileData.full_name || 'Unknown',
                friend_avatar: profileData.avatar_url || '',
                friend_username: profileData.username || '',
                status: friendship.status,
                created_at: friendship.created_at,
              };
            })
          );

          // Filter out null values (friends without profiles)
          const validFriends = friendsWithProfiles.filter(friend => friend !== null);

          return validFriends;
        });

        if (result) {
          setFriends(result);
        } else {
        }
      };

      await Promise.all([
        fetchCategories(),
        fetchTasks(),
        fetchHabits(),
        fetchFriends()
      ]);

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  // Add pull-to-refresh functionality
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    console.log('🔄 [Todo] Pull-to-refresh triggered');
    setRefreshing(true);
    
    try {
      await fetchData(user);
      console.log('🔄 [Todo] Pull-to-refresh completed successfully');
    } catch (error) {
      console.error('❌ [Todo] Pull-to-refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  // Update the render functions to use the memoized data
  const renderCategory = (category: Category) => {
    const categoryTodos = categorizedTodos[category.id] || [];
    if (categoryTodos.length === 0) return null;

    const isCollapsed = collapsedCategories[category.id];

    return (
      <View key={category.id} style={styles.categoryContainer}>
        <Pressable
          style={styles.categoryHeader}
          onPress={() => toggleCategoryCollapse(category.id)}
          onLongPress={() => {
            Alert.alert(
              "Delete Category",
              `Are you sure you want to delete "${category.label}"? This will also delete all tasks in this category.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => handleDeleteCategory(category.id),
                },
              ]
            );
          }}
          delayLongPress={500}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text style={[styles.categoryTitle, { flex: 1, fontFamily: 'Onest' }]}>{category.label}</Text>
            <Ionicons
              name={isCollapsed ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={Colors.light.text}
              style={{ marginRight: 8}}
            />
          </View>
        </Pressable>
        
        {!isCollapsed && (
          <View style={[styles.categoryContent, { backgroundColor: category.color }]}>
            {categoryTodos.map(renderTodoItem)}
          </View>
        )}
      </View>
    );
  };

  const renderUncategorizedTodos = () => {
    const uncategorizedTasks = categorizedTodos['uncategorized'] || [];
    if (uncategorizedTasks.length === 0) return null;

    const isCollapsed = collapsedCategories['uncategorized'];

    return (
      <View style={styles.categoryContainer}>
        <TouchableOpacity 
          style={styles.categoryHeader}
          onPress={() => toggleCategoryCollapse('uncategorized')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text style={[styles.categoryTitle, { flex: 1, fontFamily: 'Onest' }]}>Todo</Text>
            <Ionicons
              name={isCollapsed ? 'chevron-up' : 'chevron-down'}
              size={15}
              color="#3A3A3A"
              style={{ marginRight: 8 }}
            />
          </View>
        </TouchableOpacity>

        {!isCollapsed && (
          <View style={[styles.categoryContent, { backgroundColor: Colors.light.surfaceVariant }]}>
            {uncategorizedTasks.map(renderTodoItem)}
          </View>
        )}
      </View>
    );
  };

  // Restore the renderCompletedTodos function
  const renderCompletedTodos = () => {
    const completedTasks = categorizedTodos['completed'] || [];
    if (completedTasks.length === 0) return null;

    const isCollapsed = collapsedCategories['completed'];

    return (
      <View style={[styles.categoryContainer]}>
        <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => toggleCategoryCollapse('completed')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text style={[styles.categoryTitle, { flex: 1, fontFamily: 'Onest' }]}>Completed</Text>
            <Ionicons
              name={isCollapsed ? 'chevron-up' : 'chevron-down'}
              size={15}
              color="#3A3A3A"
              style={{ marginRight: 8 }}
            />
          </View>
        </TouchableOpacity>

        {!isCollapsed && (
          <View style={[styles.categoryContent, { backgroundColor: Colors.light.surfaceVariant }]}>
            {completedTasks.map(renderTodoItem)}
          </View>
        )}
      </View>
    );
  };

  // Add this after your existing useEffect hooks
  useEffect(() => {
    const dates: Date[] = [];
    const today = new Date();
  
    for (let i = -30; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
  
    setCalendarDates(dates);
    setTimeout(() => {
      calendarStripRef.current?.scrollToIndex({ index: 30, animated: false }); // <- Center on today
    }, 100); // Delay until strip is rendered
  }, []);

  // Simple keyboard height tracking
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    
    const keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardWillShowListener?.remove();
      keyboardWillHideListener?.remove();
    };
  }, []);



  // Create animated style that directly responds to keyboard height
  const animatedStyle = useAnimatedStyle(() => {
    const targetBottom = keyboardHeight > 0 ? keyboardHeight + 20 : 100;
    return {
      bottom: targetBottom,
    };
  }, [keyboardHeight]);

  const handleCloseNewTaskModal = useCallback(() => {
    hideModal();
  }, []);

  // Add this useEffect to initialize the current week
  useEffect(() => {
    const today = new Date();
    const week = [];
    const startOfWeek = new Date(today);
    const day = today.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6
    const offset = (day + 6) % 7; // Makes Monday the start of the week
    startOfWeek.setDate(today.getDate() - offset);
    startOfWeek.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      week.push(date);
    }

    setCurrentWeek(week);
  }, []);


  const onGestureEvent = (event: any) => {
    const { translationX } = event.nativeEvent;
    // Only process swipe if we're not already in a swipe
    if (!isSwiping && Math.abs(translationX) > 75) {
      setIsSwiping(true); // Lock the swipe
      const newDate = new Date(currentDate);
      if (translationX > 0) {
        // Swipe right - go to previous day
        newDate.setDate(currentDate.getDate() - 1);
      } else {
        // Swipe left - go to next day
        newDate.setDate(currentDate.getDate() + 1);
      }
      setCurrentDate(newDate);
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      // Reset the gesture handler state
      event.nativeEvent.translationX = 0;
      // Add a small delay before allowing the next swipe
      setTimeout(() => {
        setIsSwiping(false);
      }, 300); // 300ms delay before allowing next swipe
    }
  };

  const showModal = () => {
    setShowCategoryBox(false);
    setIsNewTaskModalVisible(true);
    // Set the task date to the currently selected date instead of today
    setTaskDate(currentDate);
  };
  
  const hideModal = () => {
    setIsNewTaskModalVisible(false);
  };

  // Update the handleAddButtonPress function
  const handleAddButtonPress = () => {
    // Pre-populate with quick add content if available
    const quickAddContent = quickAddText.trim();
    
    // Don't reset the form completely, just clear the task-specific fields
    setNewTodo(quickAddContent); // Pre-populate with quick add content
    setNewDescription('');
    setSelectedCategoryId('');
    setShowNewCategoryInput(false);
    setNewCategoryName('');
    setNewCategoryColor('#00ACC1');
    setEditingTodo(null);
    setTaskDate(currentDate); // Set to current selected date
    setReminderTime(null);
    setSelectedRepeat('none');
    setRepeatEndDate(null);
    setShowInlineEndDatePicker(false);
    setShowRepeatPicker(false);
    setCustomRepeatFrequency('1');
    setCustomRepeatUnit('days');
    setSelectedWeekDays([]);
    setSelectedFriends([]);
    setSearchFriend('');
    
    // Clear the quick add input since we're moving to the modal
    setQuickAddText('');
    
    showModal();
  };

  const handleQuickAdd = async () => {
    if (!quickAddText.trim() || !user) return;
    
    setIsQuickAdding(true);
    try {
      const newTodoItem: Todo = {
        id: uuidv4(),
        text: quickAddText.trim(),
    description: '',
    completed: false,
    categoryId: null,
        date: currentDate,
    repeat: 'none',
    customRepeatDates: [],
    repeatEndDate: null,
    reminderTime: null,
        photo: undefined,
    deletedInstances: [],
    sharedFriends: [],
      };

      // Save to Supabase
      const { error } = await supabase
        .from('todos')
        .insert({
          id: newTodoItem.id,
          text: newTodoItem.text,
          description: newTodoItem.description,
          completed: newTodoItem.completed,
          category_id: newTodoItem.categoryId,
          date: newTodoItem.date.toISOString(),
          repeat: newTodoItem.repeat,
          custom_repeat_dates: newTodoItem.customRepeatDates?.map(date => date.toISOString()) || [],
          repeat_end_date: newTodoItem.repeatEndDate?.toISOString() || null,
          reminder_time: newTodoItem.reminderTime?.toISOString() || null,
          photo: newTodoItem.photo || undefined,
          deleted_instances: newTodoItem.deletedInstances || [],
          user_id: user.id,
        });

      if (error) {
        console.error('Error saving quick add todo:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to add task. Please try again.',
        });
        return;
      }

      // Add to local state
      setTodos(prev => [newTodoItem, ...prev]);
      setQuickAddText('');
      setTimeout(() => {
        quickAddInputRef.current?.focus();
      }, 100);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Toast.show({
        type: 'success',
        text1: 'Task Added',
        text2: 'Task added successfully!',
      });
      
    } catch (error) {
      console.error('Error in quick add:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to add task. Please try again.',
      });
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleQuickAddHabit = async () => {
    if (!quickAddHabitText.trim() || !user) return;
    
    setIsQuickAddingHabit(true);
    try {
      const newHabitItem: Habit = {
        id: uuidv4(),
        text: quickAddHabitText.trim(),
        streak: 0,
        description: '',
        completedToday: false,
        completedDays: [],
        color: '#00ACC1', // Default color
        requirePhoto: false,
        targetPerWeek: quickAddWeeklyGoal,
        reminderTime: null,
        user_id: user.id,
        repeat_type: 'daily',
        repeat_end_date: null,
        notes: {},
        photos: {},
        category_id: null,
      };

      // Save to Supabase
      const { error } = await supabase
        .from('habits')
        .insert({
          id: newHabitItem.id,
          text: newHabitItem.text,
          description: newHabitItem.description,
          color: newHabitItem.color,
          require_photo: newHabitItem.requirePhoto,
          target_per_week: newHabitItem.targetPerWeek,
          reminder_time: newHabitItem.reminderTime,
          repeat_type: newHabitItem.repeat_type,
          repeat_end_date: newHabitItem.repeat_end_date,
          notes: newHabitItem.notes,
          photos: newHabitItem.photos,
          category_id: newHabitItem.category_id,
          user_id: user.id,
        });

      if (error) {
        console.error('Error saving quick add habit:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to add habit. Please try again.',
        });
        return;
      }

      // Add to local state
      setHabits(prev => [newHabitItem, ...prev]);
      
      // Clear input
      setQuickAddHabitText('');
      
      // Refocus the input for the next habit
      setTimeout(() => {
        quickAddHabitInputRef.current?.focus();
      }, 100);
      
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Toast.show({
        type: 'success',
        text1: 'Habit Added',
        text2: 'Habit added successfully!',
      });
      
    } catch (error) {
      console.error('Error in quick add habit:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to add habit. Please try again.',
      });
    } finally {
      setIsQuickAddingHabit(false);
    }
  };

  useEffect(() => {
  }, [isNewCategoryModalVisible]);

  useEffect(() => {
  }, [showRepeatEndDatePicker]);
  
  // Move the useEffect for input focus here
  useEffect(() => {
    if (isNewTaskModalVisible && newTodoInputRef.current) {
      setTimeout(() => {
        newTodoInputRef.current?.focus();
      }, 150);
    }
  }, [isNewTaskModalVisible]);
  


  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[Todo] Session check error:', sessionError);
          return;
        }

      if (session?.user) {
        setUser(session.user);
        // Don't fetch data here - it should be preloaded
      }
      } catch (error) {
        console.error('[Todo] Error in checkSession:', error);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 [Todo] Auth state changed:', event, session?.user?.id);
      
      if (session?.user) {
        setUser(session.user);
        console.log('🔄 [Todo] User signed in, waiting for preloaded data...');
        // Don't fetch data here - it should be preloaded
      } else {
        setUser(null);
        console.log('🔄 [Todo] User signed out, clearing all data...');
        // Clear data when user signs out
        setTodos([]);
        setHabits([]);
        setCategories([]);
        setFriends([]);
        setTaskSharedFriends({});
        setTaskSharedBy({});
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);



  // Use preloaded data from DataContext
  useEffect(() => {
    console.log('🔄 [Todo] Main useEffect triggered:', {
      user: !!user,
      isPreloaded: appData.isPreloaded,
      categoriesLength: appData.categories?.length || 0,
      todosLength: appData.todos?.length || 0,
      habitsLength: appData.habits?.length || 0
    });
    
    if (user && appData.isPreloaded) {
      console.log('🔄 [Todo] Using preloaded data');
      
      // Update local state with preloaded data
      if (appData.todos) {
        console.log('🔄 [Todo] Setting preloaded todos:', appData.todos.length);
        
        // Process todos to ensure they have the correct format
        const processedTodos = appData.todos.map(todo => ({
          ...todo,
          date: new Date(todo.date),
          reminderTime: todo.reminderTime ? new Date(todo.reminderTime) : null,
          repeatEndDate: todo.repeatEndDate ? new Date(todo.repeatEndDate) : null,
          customRepeatDates: todo.customRepeatDates?.map(date => new Date(date)) || [],
          deletedInstances: todo.deletedInstances || [],
          photo: todo.photo || undefined,
        }));
        
        setTodos(processedTodos);
        
        // Populate taskSharedFriends from preloaded data
        const sharedFriendsMap: Record<string, Array<{
          friend_id: string;
          friend_name: string;
          friend_avatar: string;
          friend_username: string;
        }>> = {};
        
        processedTodos.forEach(todo => {
          if (todo.sharedFriends && todo.sharedFriends.length > 0) {
            sharedFriendsMap[todo.id] = todo.sharedFriends;
          }
        });
        
        setTaskSharedFriends(prev => ({ ...prev, ...sharedFriendsMap }));
      }
      
      if (appData.habits) {
        console.log('🔄 [Todo] Setting preloaded habits:', appData.habits.length);
        
        // Process habits to ensure they have the correct format
        const processedHabits = appData.habits.map((habit: any) => {
          const completedDays = habit.completed_days || habit.completedDays || [];
          const calculatedStreak = calculateCurrentStreak(completedDays);
          
          return {
            ...habit,
            completedDays: completedDays,
            notes: habit.notes || {},
            photos: habit.photos || {},
            targetPerWeek: habit.target_per_week || habit.targetPerWeek || 7,
            requirePhoto: habit.require_photo || habit.requirePhoto || false,
            reminderTime: habit.reminder_time || habit.reminderTime || null,
            category_id: habit.category_id,
            streak: calculatedStreak,
            completedToday: completedDays.includes(moment().format('YYYY-MM-DD')),
          };
        });
        
        setHabits(processedHabits);
      }
      
      if (appData.categories) {
        console.log('🔄 [Todo] Setting categories from preloaded data:', appData.categories.length);
        setCategories(appData.categories);
      } else if (categories.length === 0) {
        // Only fetch categories if we don't have any locally
        console.log('⚠️ [Todo] No preloaded categories found and no local categories, will fetch separately');
        const fetchCategoriesOnly = async () => {
          try {
            const { data, error } = await supabase
              .from('categories')
              .select('*')
              .eq('user_id', user.id)
              .in('type', ['todo', 'task'])
              .order('created_at', { ascending: false });

            if (error) {
              console.error('❌ [Todo] Error fetching categories:', error);
              return;
            }

            console.log('🔄 [Todo] Fetched categories separately:', data?.length || 0);
            setCategories(data || []);
          } catch (error) {
            console.error('❌ [Todo] Error in separate categories fetch:', error);
          }
        };

        fetchCategoriesOnly();
      } else {
        console.log('🔄 [Todo] Using existing local categories:', categories.length);
      }
      
      if (appData.friends) {
        console.log('🔄 [Todo] Setting preloaded friends:', appData.friends.length);
        // Transform DataContext friends to match todo screen format
        const transformedFriends = appData.friends.map(friend => ({
          friend_id: friend.profiles.id,
          friend_name: friend.profiles.full_name || 'Unknown',
          friend_avatar: friend.profiles.avatar_url || '',
          friend_username: friend.profiles.username || '',
          friendship_id: friend.friendship_id,
          status: friend.status,
          created_at: friend.created_at,
        }));
        setFriends(transformedFriends);
      }
      
      setLastRefreshTime(new Date());
      setIsLoading(false);
    } else if (user && !appData.isPreloaded && !isLoading) {
      // Only fetch if data is not preloaded and we're not already loading
      console.log('🔄 [Todo] Fetching data - not preloaded and not loading');
      fetchData(user);
    } else {
      console.log('🔄 [Todo] No fetch triggered:', {
        user: !!user,
        isPreloaded: appData.isPreloaded,
        isLoading
      });
    }
  }, [user, appData.isPreloaded, appData.todos, appData.habits, appData.categories, isLoading]);

  // Fallback effect to ensure categories are always loaded
  useEffect(() => {
    if (user?.id && categories.length === 0 && !isLoading && !appData.categories) {
      console.log('🔄 [Todo] Fallback: No categories found, fetching them now');
      const fetchCategoriesFallback = async () => {
        try {
          const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('user_id', user.id)
            .in('type', ['todo', 'task'])
            .order('created_at', { ascending: false });

          if (error) {
            console.error('❌ [Todo] Fallback categories fetch error:', error);
            return;
          }

          console.log('🔄 [Todo] Fallback fetched categories:', data?.length || 0);
          setCategories(data || []);
        } catch (error) {
          console.error('❌ [Todo] Fallback categories fetch error:', error);
        }
      };

      fetchCategoriesFallback();
    }
  }, [user?.id, categories.length, isLoading, appData.categories]);

  // Sync categories from DataContext whenever they change
  useEffect(() => {
    if (appData.categories && appData.categories.length > 0 && categories.length === 0) {
      console.log('🔄 [Todo] Syncing categories from DataContext:', appData.categories.length);
      setCategories(appData.categories);
    } else if (appData.categories && appData.categories.length > 0 && categories.length > 0) {
      // Only update if the categories are actually different
      const currentCategoryIds = new Set(categories.map(cat => cat.id));
      const newCategoryIds = new Set(appData.categories.map(cat => cat.id));
      
      if (currentCategoryIds.size !== newCategoryIds.size || 
          !Array.from(currentCategoryIds).every(id => newCategoryIds.has(id))) {
        console.log('🔄 [Todo] Categories changed in DataContext, updating local state');
        setCategories(appData.categories);
      }
    }
  }, [appData.categories, categories.length]);

  // Add focus effect to refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        console.log('🔄 [Todo] useFocusEffect: Screen focused for user:', user.id);
        console.log('🔄 [Todo] useFocusEffect: appData.isPreloaded:', appData.isPreloaded);
        console.log('🔄 [Todo] useFocusEffect: appData.categories length:', appData.categories?.length || 0);
        console.log('🔄 [Todo] useFocusEffect: appData.todos length:', appData.todos?.length || 0);
        console.log('🔄 [Todo] useFocusEffect: appData.habits length:', appData.habits?.length || 0);
        console.log('🔄 [Todo] useFocusEffect: local categories length:', categories.length);
        
        // Check if we need to sync categories from DataContext to local state
        if (appData.isPreloaded && appData.categories && appData.categories.length > 0 && categories.length === 0) {
          console.log('🔄 [Todo] useFocusEffect: Syncing categories from DataContext to local state');
          setCategories(appData.categories);
        }
        // Only fetch if data is not preloaded or missing categories
        else if (!appData.isPreloaded || !appData.categories || appData.categories.length === 0) {
          console.log('🔄 [Todo] useFocusEffect: Fetching data because not preloaded or missing categories');
          fetchData(user);
        } else {
          console.log('🔄 [Todo] useFocusEffect: Skipping fetch - data is preloaded and complete');
          // Only refresh todos and habits if they're missing, but preserve categories
          if (!appData.todos || appData.todos.length === 0) {
            console.log('🔄 [Todo] useFocusEffect: Refreshing todos only');
            fetchTodosOnly(user);
          }
          if (!appData.habits || appData.habits.length === 0) {
            console.log('🔄 [Todo] useFocusEffect: Refreshing habits only');
            fetchHabitsOnly(user);
          }
        }
      }
    }, [user, appData.isPreloaded, appData.categories, appData.todos, appData.habits, categories.length])
  );
  
  const handleHabitSave = async () => {
    if (!newHabit.trim()) return;
    
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        Alert.alert('Error', 'You must be logged in to create habits.');
        return;
      }

      if (editingHabit) {
        // Update existing habit
        const { error: habitError } = await supabase
          .from('habits')
          .update({
            text: newHabit.trim(),
            description: newHabitDescription.trim(),
            color: newHabitColor || '#00ACC1', // Use default color if none selected
            require_photo: habitRequirePhoto,
            target_per_week: habitTargetPerWeek || 7, // Use default weekly goal if none selected
            reminder_time: habitReminderTime?.toISOString() || null,
            category_id: null,
          })
          .eq('id', editingHabit.id)
          .eq('user_id', user.id);

        if (habitError) {
          console.error('Error updating habit:', habitError);
          Alert.alert('Error', 'Failed to update habit. Please try again.');
          return;
        }

        // Update local state
        const updatedHabits = habits.map(habit => 
          habit.id === editingHabit.id 
            ? {
                ...habit,
                text: newHabit.trim(),
                description: newHabitDescription.trim(),
                color: newHabitColor || '#00ACC1', // Use default color if none selected
                requirePhoto: habitRequirePhoto,
                targetPerWeek: habitTargetPerWeek || 7, // Use default weekly goal if none selected
                reminderTime: habitReminderTime?.toISOString() || null,
                category_id: null,
              }
            : habit
        );
        setHabits(updatedHabits);
        
        // Update DataContext with edited habit
        updateData('habits', updatedHabits);

        // Update reminder notification (for editing)
        await updateHabitReminderNotification(editingHabit.id, newHabit.trim(), habitReminderTime);
      } else {
        // Create new habit
      const newHabitItem: Habit = {
        id: uuidv4(),
        text: newHabit.trim(),
        description: newHabitDescription.trim(),
        streak: 0,
        completedToday: false,
        completedDays: [],
        color: newHabitColor || '#00ACC1', // Use default color if none selected
        requirePhoto: habitRequirePhoto,
        targetPerWeek: habitTargetPerWeek || 7, // Use default weekly goal if none selected
        reminderTime: habitReminderTime?.toISOString() || null,
        user_id: user.id,
        repeat_type: 'daily',
        repeat_end_date: null,
        notes: {},
        photos: {},
        category_id: null,
      };
      
      // Save habit to Supabase
      const { error: habitError } = await supabase
        .from('habits')
        .insert({
          id: newHabitItem.id,
          text: newHabitItem.text,
          description: newHabitItem.description,
          streak: newHabitItem.streak,
          completed_days: newHabitItem.completedDays,
          color: newHabitItem.color,
          require_photo: newHabitItem.requirePhoto,
          target_per_week: newHabitItem.targetPerWeek,
          reminder_time: newHabitItem.reminderTime,
          user_id: user.id,
          repeat_type: newHabitItem.repeat_type,
          repeat_end_date: newHabitItem.repeat_end_date,
          notes: newHabitItem.notes,
          photos: newHabitItem.photos,
          category_id: null,
        });
      
      if (habitError) {
        console.error('Error saving habit:', habitError);
        Alert.alert('Error', 'Failed to save habit. Please try again.');
        return;
      }
      
      // Update local state with new habit
      setHabits(prev => [...prev, newHabitItem]);
      
      // Update DataContext with new habit
      const updatedHabits = [...habits, newHabitItem];
      updateData('habits', updatedHabits);

      // Schedule reminder if set (for new habit)
      if (habitReminderTime) {
        await scheduleReminderNotification(newHabit.trim(), habitReminderTime, newHabitItem.id);
      }
      }

      // Reset form and close modal
      setNewHabit('');
      setNewHabitDescription('');
      setNewHabitColor('');
      setHabitReminderTime(null);
      setHabitRequirePhoto(false);
      setHabitTargetPerWeek(7);
      setEditingHabit(null);
      setIsNewHabitModalVisible(false);
      
      // Provide haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error in handleHabitSave:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const deleteHabit = async (habitId: string) => {
    try {      
      // Get the current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('🗑️ [Delete Habit] Auth error:', authError);
        Alert.alert('Error', 'Authentication error. Please log in again.');
        return;
      }
      
      if (!user) {
        console.error('🗑️ [Delete Habit] No user logged in');
        Alert.alert('Error', 'You must be logged in to delete habits.');
        return;
      }
      // First, verify the habit exists and belongs to the user
      const { data: habitData, error: fetchError } = await supabase
        .from('habits')
        .select('id, user_id')
        .eq('id', habitId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        console.error('🗑️ [Delete Habit] Error fetching habit:', fetchError);
        Alert.alert('Error', 'Habit not found or you do not have permission to delete it.');
        return;
      }

      if (!habitData) {
        console.error('🗑️ [Delete Habit] Habit not found or does not belong to user');
        Alert.alert('Error', 'Habit not found or you do not have permission to delete it.');
        return;
      }
      // Delete from Supabase
      const { error: deleteError } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('🗑️ [Delete Habit] Error deleting habit:', deleteError);
        Alert.alert('Error', `Failed to delete habit: ${deleteError.message}`);
        return;
      }

      // Update local state
      const updatedHabits = habits.filter(habit => habit.id !== habitId);
      setHabits(updatedHabits);
      
      // Update DataContext with deleted habit
      updateData('habits', updatedHabits);

      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Show success message
      Toast.show({
        type: 'success',
        text1: 'Habit deleted successfully',
        position: 'bottom',
        visibilityTime: 2000,
      });

    } catch (error) {
      console.error('🗑️ [Delete Habit] Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const viewHabitNotes = (habit: Habit) => {
    const notes = habit.notes || {};
    const photos = habit.photos || {};
    const noteEntries = Object.entries(notes);
    const photoEntries = Object.entries(photos);
    
    if (noteEntries.length === 0 && photoEntries.length === 0) {
      Alert.alert('No Logs', 'This habit has no logs yet.');
      return;
    }

    const options = [];
    if (noteEntries.length > 0 || photoEntries.length > 0) {
      options.push('View Logs');
    }
    
    Alert.alert(
      `Log for "${habit.text}"`,
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take Photo',
          onPress: () => addHabitPhoto(habit),
        },
        ...(noteEntries.length > 0 || photoEntries.length > 0 ? [{
          text: 'View Logs',
          onPress: () => viewHabitLogs(habit),
        }] : []),
      ]
    );
  };

  const addPhotoToHabit = async (habitId: string, today: string, photoUri: string) => {
    try {
      const habitToToggle = habits.find(habit => habit.id === habitId);
      if (!habitToToggle) return;

      // Upload photo to Supabase Storage first
      const uploadedPhotoUrl = await uploadHabitPhoto(photoUri, habitId, today);

      // Store the uploaded photo URL in the photos object
      const currentPhotos = habitToToggle.photos || {};
      const updatedPhotos = {
        ...currentPhotos,
        [today]: uploadedPhotoUrl
      };

      // Check if this habit requires photo proof
      const requiresPhotoProof = habitToToggle.requirePhoto;
      
      // Check if already completed today (handle both old and new formats)
      const currentCompletedDays = habitToToggle.completedDays || [];
      const isAlreadyCompleted = currentCompletedDays.some(date => date.startsWith(today));
      
      // If habit requires photo proof and not already completed, mark it as completed
      let updatedCompletedDays = currentCompletedDays;
      let shouldCompleteHabit = false;
      
      if (requiresPhotoProof && !isAlreadyCompleted) {
        updatedCompletedDays = [...currentCompletedDays, today];
        shouldCompleteHabit = true;
      }

      // Prepare update data
      const updateData: any = { 
        photos: updatedPhotos
      };
      
      if (shouldCompleteHabit) {
        updateData.completed_days = updatedCompletedDays;
      }

      // Update in Supabase
      const { error } = await supabase
        .from('habits')
        .update(updateData)
        .eq('id', habitId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error adding photo to habit in Supabase:', error);
        Alert.alert('Error', 'Failed to save photo. Please try again.');
        return;
      }

      // Update local state
      setHabits(prev => prev.map(habit => 
        habit.id === habitId 
          ? { 
              ...habit, 
              photos: updatedPhotos,
              ...(shouldCompleteHabit && {
                completedDays: updatedCompletedDays,
                completedToday: true,
                streak: calculateCurrentStreak(updatedCompletedDays)
              })
            } 
          : habit
      ));
      
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Automatically share photo to friends feed (like events do)
      if (user?.id) {
        try {
          // Get habit details for sharing
          const habitToShare = habits.find(habit => habit.id === habitId);
          if (habitToShare) {
            // Create social update for this habit photo
            const { error: socialError } = await supabase
              .from('social_updates')
              .insert({
                user_id: user.id,
                type: 'photo_share',
                photo_url: uploadedPhotoUrl,
                caption: '', // Let the friends feed fetch the actual habit title
                source_type: 'habit',
                source_id: habitId,
                is_public: true,
                content: {
                  title: habitToShare.text,
                  photo_url: uploadedPhotoUrl
                }
              });

            if (socialError) {
              console.error('Error creating social update for habit photo:', socialError);
            } else {
              Toast.show({
                type: 'success',
                text1: 'Photo shared with friends!',
                position: 'bottom',
              });
            }
          }
        } catch (error) {
          console.error('Error sharing habit photo to friends feed:', error);
        }
      }

      // Show appropriate success message
      if (shouldCompleteHabit) {
        Alert.alert('Success', 'Photo added and habit completed!');
      } else if (isAlreadyCompleted) {
        Alert.alert('Success', 'Photo added to habit!');
      } else {
        Alert.alert('Success', 'Photo added successfully!');
      }
    } catch (error) {
      console.error('Error in addPhotoToHabit:', error);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    }
  };

  const addHabitPhoto = async (habit: Habit) => {
    Alert.alert(
      'Add Photo',
      'Choose how you want to add a photo',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take Photo',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission Required', 'Camera permission is required to take a photo.');
                return;
              }

              const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                const today = moment().format('YYYY-MM-DD');
                await addPhotoToHabit(habit.id, today, result.assets[0].uri);
              }
            } catch (error) {
              console.error('Error taking photo:', error);
              Alert.alert('Error', 'Failed to take photo. Please try again.');
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission Required', 'Media library permission is required to select an image.');
                return;
              }

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                const today = moment().format('YYYY-MM-DD');
                await addPhotoToHabit(habit.id, today, result.assets[0].uri);
              }
            } catch (error) {
              console.error('Error selecting image:', error);
              Alert.alert('Error', 'Failed to select image. Please try again.');
            }
          },
        },
      ]
    );
  };

  const viewHabitLogs = (habit: Habit) => {
    const notes = habit.notes || {};
    const photos = habit.photos || {};
    const noteEntries = Object.entries(notes);
    const photoEntries = Object.entries(photos);
    
    if (noteEntries.length === 0 && photoEntries.length === 0) {
      Alert.alert('No Logs', 'This habit has no logs yet.');
      return;
    }

    // Combine and sort all entries by date
    const allEntries = [
      ...noteEntries.map(([date, note]) => ({ date, type: 'note', content: note })),
      ...photoEntries.map(([date, photo]) => ({ date, type: 'photo', content: photo }))
    ].sort((a, b) => b.date.localeCompare(a.date));

    const logList = allEntries
      .map(({ date, type, content }) => {
        const formattedDate = moment(date).format('MMM D, YYYY');
        if (type === 'note') {
          return `${formattedDate} (Note):\n${content}`;
        } else {
          return `${formattedDate} (Photo):\n[Photo attached]`;
        }
      })
      .join('\n\n');

    Alert.alert(
      `Logs for "${habit.text}"`,
      logList,
      [{ text: 'OK', style: 'default' }]
    );
  };
  
  // Add this function to view habit photos
  const viewHabitPhotos = (habit: Habit) => {
    const photos = habit.photos || {};
    const photoEntries = Object.entries(photos);
    
    if (photoEntries.length === 0) {
      Alert.alert('No Photos', 'This habit has no photos yet.');
      return;
    }

    // Sort photos by date (most recent first)
    const sortedPhotos = photoEntries
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([date, photoUrl]) => ({
        date,
        photoUrl,
        formattedDate: moment(date).format('MMM D, YYYY')
      }));

    // Show photo list
    const photoList = sortedPhotos
      .map(({ date, formattedDate }) => `${formattedDate}`)
      .join('\n');

    Alert.alert(
      `Photos for "${habit.text}"`,
      `Select a photo to view:\n\n${photoList}`,
      [
        { text: 'Cancel', style: 'cancel' },
        ...sortedPhotos.map(({ date, photoUrl, formattedDate }) => ({
          text: formattedDate,
          onPress: () => {
            setSelectedPhotoForViewing({ habit, photoUrl, date, formattedDate });
            setIsPhotoViewerVisible(true);
          },
        })),
      ]
    );
  };

  // Add function to move task to tomorrow
  const moveTaskToTomorrow = async (taskId: string) => {
    try {
      // Find the current task to get its date
      const currentTask = todos.find(todo => todo.id === taskId);
      if (!currentTask) {
        console.error('Task not found');
        return;
      }

      // Calculate tomorrow based on the task's current date
      const taskDate = new Date(currentTask.date);
      const tomorrow = new Date(taskDate);
      tomorrow.setDate(taskDate.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const { error } = await supabase
        .from('todos')
        .update({ date: tomorrow.toISOString() })
        .eq('id', taskId);

      if (error) {
        console.error('Error moving task to tomorrow:', error);
        Toast.show({
          type: 'error',
          text1: 'Failed to move task to tomorrow',
          position: 'bottom',
        });
        return;
      }

      // Update local state
      setTodos(prevTodos => 
        prevTodos.map(todo => 
          todo.id === taskId 
            ? { ...todo, date: tomorrow }
            : todo
        )
      );

      Toast.show({
        type: 'success',
        text1: 'Task moved to tomorrow',
        position: 'bottom',
      });
    } catch (error) {
      console.error('Error moving task to tomorrow:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to move task to tomorrow',
        position: 'bottom',
      });
    }
  };
  
  // Add function to calculate detailed progress statistics
  const calculateHabitProgress = (habit: Habit, mode: 'weekly' | 'monthly') => {
    const completedDays = habit.completedDays || [];
    const today = moment();
    
    if (mode === 'weekly') {
      const weekStart = moment().startOf('isoWeek');
      const weekEnd = moment().endOf('isoWeek');
      
      const completedThisWeek = completedDays.filter(date => {
        const habitDate = moment(date, 'YYYY-MM-DD');
        return habitDate.isBetween(weekStart, weekEnd, 'day', '[]');
      }).length;
      
      const target = habit.targetPerWeek || 7;
      const percentage = Math.min((completedThisWeek / target) * 100, 100);
      
      // Calculate daily breakdown for the week
      const dailyBreakdown = [];
      for (let i = 0; i < 7; i++) {
        const date = moment(weekStart).add(i, 'days');
        const dateStr = date.format('YYYY-MM-DD');
        const isCompleted = completedDays.includes(dateStr);
        const isToday = date.isSame(today, 'day');
        
        dailyBreakdown.push({
          date: date.toDate(),
          dateStr,
          dayName: date.format('ddd'),
          isCompleted,
          isToday,
          hasPhoto: habit.photos?.[dateStr] || null,
          hasNote: habit.notes?.[dateStr] || null,
        });
      }
      
      return {
        mode: 'weekly',
        period: `${weekStart.format('MMM D')} - ${weekEnd.format('MMM D, YYYY')}`,
        completed: completedThisWeek,
        target,
        percentage,
        dailyBreakdown,
        streak: calculateCurrentStreak(completedDays),
        averagePerWeek: Math.round((completedDays.length / Math.max(1, Math.ceil(moment().diff(moment(completedDays[0] || today), 'weeks')))) * 10) / 10,
      };
    } else {
      // Monthly view
      const monthStart = moment().startOf('month');
      const monthEnd = moment().endOf('month');
      
      const completedThisMonth = completedDays.filter(date => {
        const habitDate = moment(date, 'YYYY-MM-DD');
        const isInMonth = habitDate.isBetween(monthStart, monthEnd, 'day', '[]');
        if (isInMonth) {
        }
        return isInMonth;
      }).length;
      
      // Fix: Use daysInMonth() method instead of diff calculation
      const daysInMonth = monthStart.daysInMonth();
      const percentage = Math.min((completedThisMonth / daysInMonth) * 100, 100);
      
      // Calculate weekly breakdown for the month
      const weeklyBreakdown = [];
      const weeksInMonth = Math.ceil(daysInMonth / 7);
      
      for (let week = 0; week < weeksInMonth; week++) {
        const weekStart = moment(monthStart).add(week, 'weeks');
        const weekEnd = moment.min(moment(weekStart).endOf('isoWeek'), monthEnd);
        
        const weekCompleted = completedDays.filter(date => {
          const habitDate = moment(date, 'YYYY-MM-DD');
          return habitDate.isBetween(weekStart, weekEnd, 'day', '[]');
        }).length;
        
        const weekDays = weekEnd.diff(weekStart, 'days') + 1;
        const weekPercentage = Math.min((weekCompleted / weekDays) * 100, 100);
        
        weeklyBreakdown.push({
          weekNumber: week + 1,
          weekStart: weekStart.toDate(),
          weekEnd: weekEnd.toDate(),
          period: `${weekStart.format('MMM D')} - ${weekEnd.format('MMM D')}`,
          completed: weekCompleted,
          totalDays: weekDays,
          percentage: weekPercentage,
        });
      }
      
      return {
        mode: 'monthly',
        period: monthStart.format('MMMM YYYY'),
        completed: completedThisMonth,
        target: daysInMonth,
        percentage,
        weeklyBreakdown,
        streak: calculateCurrentStreak(completedDays),
        averagePerMonth: Math.round((completedDays.length / Math.max(1, Math.ceil(moment().diff(moment(completedDays[0] || today), 'months')))) * 10) / 10,
      };
    }
  };
  
  // Add function to calculate weekly statistics
  const calculateWeeklyStats = (habit: Habit) => {
    const completedDays = habit.completedDays || [];
    const today = moment();
    const weekStart = moment().startOf('isoWeek');
    const weekEnd = moment().endOf('isoWeek');
    
    const completedThisWeek = completedDays.filter(date => {
      const habitDate = moment(date, 'YYYY-MM-DD');
      return habitDate.isBetween(weekStart, weekEnd, 'day', '[]');
    }).length;
    
    const target = habit.targetPerWeek || 7;
    const percentage = Math.min((completedThisWeek / target) * 100, 100);
    
    // Calculate daily breakdown for the week
    const dailyBreakdown = [];
    for (let i = 0; i < 7; i++) {
      const date = moment(weekStart).add(i, 'days');
      const dateStr = date.format('YYYY-MM-DD');
      const isCompleted = completedDays.includes(dateStr);
      const isToday = date.isSame(today, 'day');
      
      dailyBreakdown.push({
        date: date.toDate(),
        dateStr,
        dayName: date.format('ddd'),
        isCompleted,
        isToday,
        hasPhoto: habit.photos?.[dateStr] || null,
        hasNote: habit.notes?.[dateStr] || null,
      });
    }
    
    // Calculate weekly trends (last 4 weeks)
    const weeklyTrends = [];
    for (let week = 0; week < 4; week++) {
      const weekStartDate = moment().subtract(week, 'weeks').startOf('isoWeek');
      const weekEndDate = moment().subtract(week, 'weeks').endOf('isoWeek');
      
      const weekCompleted = completedDays.filter(date => {
        const habitDate = moment(date, 'YYYY-MM-DD');
        return habitDate.isBetween(weekStartDate, weekEndDate, 'day', '[]');
      }).length;
      
      const weekTarget = habit.targetPerWeek || 7;
      const weekPercentage = Math.min((weekCompleted / weekTarget) * 100, 100);
      
      weeklyTrends.push({
        weekNumber: week + 1,
        period: `${weekStartDate.format('MMM D')} - ${weekEndDate.format('MMM D')}`,
        completed: weekCompleted,
        target: weekTarget,
        percentage: weekPercentage,
        isCurrentWeek: week === 0,
      });
    }
    
    return {
      period: `${weekStart.format('MMM D')} - ${weekEnd.format('MMM D, YYYY')}`,
      completed: completedThisWeek,
      target,
      percentage,
      dailyBreakdown,
      weeklyTrends,
      streak: calculateCurrentStreak(completedDays),
      averagePerWeek: Math.round((completedDays.length / Math.max(1, Math.ceil(moment().diff(moment(completedDays[0] || today), 'weeks')))) * 10) / 10,
      bestDay: dailyBreakdown.reduce((best, day) => day.isCompleted ? best : day, dailyBreakdown[0]),
      mostProductiveDay: dailyBreakdown.filter(day => day.isCompleted).length > 0 ? 
        dailyBreakdown.filter(day => day.isCompleted).sort((a, b) => 
          moment(a.date).diff(moment(b.date))
        )[0] : null,
    };
  };
  
  // Add network status state
  const [isOnline, setIsOnline] = useState(true);
  const [lastNetworkError, setLastNetworkError] = useState<string | null>(null);

  // Add network status monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? true);
      if (!state.isConnected) {
        setLastNetworkError('No internet connection');
      } else {
        setLastNetworkError(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Add function to fetch shared friends for tasks
  const fetchSharedFriendsForTasks = async (taskIds: string[], currentUser?: User | null) => {
    const userToUse = currentUser || user;
    if (!userToUse || taskIds.length === 0) {
      return;
    }

    try {
      // Preserve existing shared friends data to prevent UI flicker
      const existingTaskSharedFriends = { ...taskSharedFriends };
      const existingTaskSharedBy = { ...taskSharedBy };

      // First, get all shared tasks where you are involved (either as sender or recipient)
      const { data: sharedTasks, error } = await supabase
        .from('shared_tasks')
        .select(`
          original_task_id,
          shared_by,
          shared_with,
          status,
          copied_task_id
        `)
        .or(`shared_by.eq.${userToUse.id},shared_with.eq.${userToUse.id}`);

      if (error) {
        console.error('❌ Error fetching shared tasks:', error);
        return;
      }

      const { data: copiedTasks, error: copiedTasksError } = await supabase
        .from('todos')
        .select('id, text')
        .eq('user_id', userToUse.id)
        .in('id', taskIds)
        .like('id', 'shared-%');

      if (copiedTasksError) {
        console.error('❌ Error fetching copied tasks:', copiedTasksError);
        return;
      }
      // Filter to only include tasks that are in the current user's task list
      const relevantSharedTasks = sharedTasks?.filter(sharedTask => {
        // If you're the sender, check if the original task is in your current task list
        if (sharedTask.shared_by === userToUse.id) {
          return taskIds.includes(sharedTask.original_task_id);
        }
        // If you're the recipient, we'll include all shared tasks where you're the recipient
        // We'll handle the mapping later
        if (sharedTask.shared_with === userToUse.id) {
          return true;
        }
        return false;
      }) || [];

      if (error) {
        console.error('❌ Error fetching shared tasks:', error);
        return;
      }

      if (!relevantSharedTasks || relevantSharedTasks.length === 0) {
        return;
      }

      // Get all unique friend IDs involved in these tasks
      const friendIds = new Set<string>();
      relevantSharedTasks.forEach(sharedTask => {
        if (sharedTask.shared_by !== userToUse.id) {
          friendIds.add(sharedTask.shared_by);
        }
        if (sharedTask.shared_with !== userToUse.id) {
          friendIds.add(sharedTask.shared_with);
        }
      });

      // Fetch friend profiles
      const { data: friendProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username')
        .in('id', Array.from(friendIds));

      if (profilesError) {
        console.error('❌ Error fetching friend profiles:', profilesError);
        return;
      }
      // Create a map of friend profiles
      const friendProfilesMap = new Map();
      friendProfiles?.forEach(profile => {
        friendProfilesMap.set(profile.id, {
          friend_id: profile.id,
          friend_name: profile.full_name || 'Unknown',
          friend_avatar: profile.avatar_url || '',
          friend_username: profile.username || '',
        });
      });

      // Group all participants by task (both senders and recipients)
      const taskParticipantsMap: Record<string, Array<{
        friend_id: string;
        friend_name: string;
        friend_avatar: string;
        friend_username: string;
        role: 'sender' | 'recipient';
      }>> = {};

      relevantSharedTasks.forEach(sharedTask => {
        const taskId = sharedTask.original_task_id;
        if (!taskParticipantsMap[taskId]) {
          taskParticipantsMap[taskId] = [];
        }

        // If you're the recipient, show the sender
        if (sharedTask.shared_with === userToUse.id && sharedTask.shared_by !== userToUse.id) {
          const senderProfile = friendProfilesMap.get(sharedTask.shared_by);
          if (senderProfile && !taskParticipantsMap[taskId].some(p => p.friend_id === senderProfile.friend_id)) {
            taskParticipantsMap[taskId].push({
              ...senderProfile,
              role: 'sender'
            });
          }
        }

        // If you're the sender, show the recipients
        if (sharedTask.shared_by === userToUse.id && sharedTask.shared_with !== userToUse.id) {
          const recipientProfile = friendProfilesMap.get(sharedTask.shared_with);
          if (recipientProfile && !taskParticipantsMap[taskId].some(p => p.friend_id === recipientProfile.friend_id)) {
            taskParticipantsMap[taskId].push({
              ...recipientProfile,
              role: 'recipient'
            });
          }
        }
      });

      // Convert to the format expected by the UI
      const taskFriendsMap: Record<string, Array<{
        friend_id: string;
        friend_name: string;
        friend_avatar: string;
        friend_username: string;
      }>> = {};

      // For tasks you sent: use original_task_id as key
      // For tasks you received: use copied_task_id for accurate mapping
      relevantSharedTasks.forEach(sharedTask => {
        const originalTaskId = sharedTask.original_task_id;
        
        if (sharedTask.shared_by === userToUse.id) {
          // You're the sender - use original task ID as key
          if (taskParticipantsMap[originalTaskId]) {
            taskFriendsMap[originalTaskId] = taskParticipantsMap[originalTaskId].map(participant => ({
              friend_id: participant.friend_id,
              friend_name: participant.friend_name,
              friend_avatar: participant.friend_avatar,
              friend_username: participant.friend_username,
            }));
          }
        } else if (sharedTask.shared_with === userToUse.id) {
          // You're the recipient - show the sender using copied_task_id
          const senderProfile = friendProfilesMap.get(sharedTask.shared_by);
          if (senderProfile && sharedTask.copied_task_id) {
            // Use the copied_task_id to map to the specific task
            if (taskIds.includes(sharedTask.copied_task_id)) {
              taskFriendsMap[sharedTask.copied_task_id] = [{
                friend_id: senderProfile.friend_id,
                friend_name: senderProfile.friend_name,
                friend_avatar: senderProfile.friend_avatar,
                friend_username: senderProfile.friend_username,
              }];
            }
          } else if (senderProfile && !sharedTask.copied_task_id) {
            // Fallback for tasks shared before the copied_task_id field was added
            copiedTasks?.forEach(copiedTask => {
              if (taskIds.includes(copiedTask.id) && !taskFriendsMap[copiedTask.id]) {
                taskFriendsMap[copiedTask.id] = [{
                  friend_id: senderProfile.friend_id,
                  friend_name: senderProfile.friend_name,
                  friend_avatar: senderProfile.friend_avatar,
                  friend_username: senderProfile.friend_username,
                }];
              }
            });
          }
        }
      });

      // Keep the original shared by logic for backward compatibility
      const taskSharedByMap: Record<string, {
        friend_id: string;
        friend_name: string;
        friend_avatar: string;
        friend_username: string;
      }> = {};

      relevantSharedTasks.forEach(sharedTask => {
        // Track who shared this task with the current user
        if (sharedTask.shared_with === userToUse.id && sharedTask.shared_by !== userToUse.id) {
          const sharedByProfile = friendProfilesMap.get(sharedTask.shared_by);
          if (sharedByProfile && sharedTask.copied_task_id) {
            // Use the copied task ID as the key for better accuracy
            taskSharedByMap[sharedTask.copied_task_id] = sharedByProfile;
          } else if (sharedByProfile && !sharedTask.copied_task_id) {
            // Fallback for tasks shared before the copied_task_id field was added
            copiedTasks?.forEach(copiedTask => {
              if (taskIds.includes(copiedTask.id) && !taskSharedByMap[copiedTask.id]) {
                taskSharedByMap[copiedTask.id] = sharedByProfile;
              }
            });
          }
        }
      });

      // Merge new data with existing data to prevent UI flicker
      const mergedTaskSharedFriends = { ...existingTaskSharedFriends, ...taskFriendsMap };
      const mergedTaskSharedBy = { ...existingTaskSharedBy, ...taskSharedByMap };

      setTaskSharedFriends(mergedTaskSharedFriends);
      setTaskSharedBy(mergedTaskSharedBy);
    } catch (error) {
      console.error('❌ Error fetching shared friends for tasks:', error);
    }
  };

  // Add function to calculate habit progress for a specific month
  const calculateHabitProgressForWeek = (habit: Habit, targetWeek: moment.Moment) => {
    const weekStart = targetWeek.clone().startOf('week');
    const weekEnd = targetWeek.clone().endOf('week');
    const completedDays = habit.completedDays || [];
    const notes = habit.notes || {};
    const photos = habit.photos || {};
    
    let completedCount = 0;
    let totalDays = 0;
    
    for (let i = 0; i < 7; i++) {
      const currentDate = weekStart.clone().add(i, 'days');
      const dateStr = currentDate.format('YYYY-MM-DD');
      const hasNote = notes[dateStr];
      const hasPhoto = photos[dateStr];
      const isCompleted = completedDays.includes(dateStr) || !!hasNote || !!hasPhoto;
      
      if (currentDate.isSameOrBefore(moment(), 'day')) {
        totalDays++;
        if (isCompleted) {
          completedCount++;
        }
      }
    }
    
    const percentage = totalDays > 0 ? (completedCount / totalDays) * 100 : 0;
    
    return {
      completed: completedCount,
      total: totalDays,
      percentage,
      weekStart,
      weekEnd,
    };
  };

  const calculateHabitProgressForMonth = (habit: Habit, targetMonth: moment.Moment) => {
    const completedDays = habit.completedDays || [];
    const today = moment();
    const monthStart = targetMonth.clone().startOf('month');
    const monthEnd = targetMonth.clone().endOf('month');
    const completedThisMonth = completedDays.filter(date => {
      const habitDate = moment(date, 'YYYY-MM-DD');
      return habitDate.isBetween(monthStart, monthEnd, 'day', '[]');
    }).length;
    
    // Fix: Use daysInMonth() method instead of diff calculation
    const daysInMonth = targetMonth.daysInMonth();
    const percentage = Math.min((completedThisMonth / daysInMonth) * 100, 100);

    return {
      completed: completedThisMonth,
      target: daysInMonth,
      percentage,
      period: monthStart.format('MMMM YYYY'),
    };
  };

  // Add ref for friends search input
  const friendsSearchInputRef = useRef<TextInput>(null);
  const modalScrollViewRef = useRef<ScrollView>(null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-20, 20]}
      >
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.header}>
      
            <TouchableOpacity 
              style={styles.menuButton}>              
            </TouchableOpacity>
          </View>

          {/* Network Status Indicator */}
          {!isOnline && (
            <View style={{
              backgroundColor: '#FF6B6B',
              paddingHorizontal: 16,
              paddingVertical: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}>
              <Ionicons name="wifi-outline" size={16} color="white" />
              <Text style={{
                color: 'white',
                fontSize: 14,
                fontWeight: '500',
                fontFamily: 'Onest',
              }}>
                No internet connection
              </Text>
            </View>
          )}

          {lastNetworkError && isOnline && (
            <View style={{
              backgroundColor: '#FFA500',
              paddingHorizontal: 16,
              paddingVertical: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}>
              <Ionicons name="warning-outline" size={16} color="white" />
              <Text style={{
                color: 'white',
                fontSize: 14,
                fontWeight: '500',
                fontFamily: 'Onest',
              }}>
                Connection issues detected
              </Text>
            </View>
          )}

          {/* Date Header */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginHorizontal: 20,
            marginTop: 6, // Aligned with Notes header
            marginBottom: 10,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
          }}>
            <TouchableOpacity
                onPress={goToToday}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text style={{
                fontSize: 28,
                fontWeight: '700',
                color: Colors.light.text,
                fontFamily: 'Onest',
              }}>
                {moment(currentDate).format('MMMM D')}
              </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={showHeaderDatePickerPanel}
                style={{
                  padding: 4,
                }}
              >
              <Ionicons name="chevron-down" size={16} color={Colors.light.icon} style={{ marginLeft: 1 }} />
            </TouchableOpacity>
            </View>

            {/* Tasks and Habits Icons */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 18,
            }}>

              {/* Tasks Button */}
              <TouchableOpacity
                onPress={() => setActiveTab('tasks')}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
    name="balloon"
    size={20}
    color={activeTab === 'tasks' ? '#FF6B6B' : Colors.light.icon}
    style={{ marginTop: 1 }}
  />
              </TouchableOpacity>
              
              {/* Habits Button */}
              <TouchableOpacity
                onPress={() => {
                  if (activeTab === 'habits') {
                    // If already on habits screen, show monthly progress modal
                    setSelectedMonthForProgress(moment().startOf('month'));
                    setIsMonthlyProgressModalVisible(true);
                  } else {
                    // If on tasks screen, switch to habits screen
                    setActiveTab('habits');
                  }
                }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
    name="flame"
    size={20}
    color={activeTab === 'habits' ? '#FF6B6B' : Colors.light.icon} // Red when active, gray when inactive
    style={{ marginTop: 1 }}
  />
              </TouchableOpacity>
  </View>
</View>

          {/* Date Picker Floating Panel */}
          {showHeaderDatePicker && (
            <Animated.View style={[{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1000,
            }, headerDatePickerAnimatedStyle]}>
              {/* Transparent overlay to close the panel */}
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 1000,
                }}
                activeOpacity={1}
                onPress={hideHeaderDatePickerPanel}
              />
              {/* Floating Panel */}
              <Animated.View style={[{
                position: 'absolute',
                top: 110,
                left: 22,
                width: 320,
                backgroundColor: Colors.light.background,
                borderRadius: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
                overflow: 'hidden',
                zIndex: 1001,
              }, headerDatePickerAnimatedStyle]}>
                <View style={{
                  paddingHorizontal: 0,
                  paddingVertical: 0,
                }}>
                  <DateTimePicker
                    value={currentDate}
                    mode="date"
                    display="spinner"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setCurrentDate(selectedDate);
                      }
                    }}
                    style={{
                      height: 70,
                      width: '100%',
                    }}
                    textColor={Colors.light.text}
                    themeVariant="light"
                  />
                </View>
              </Animated.View>
            </Animated.View>
          )}
          {/* TASK LIST */}
          <ScrollView 
            style={styles.todoList} 
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FF9A8B"
                title="Pull to refresh"
                titleColor="#666"
              />
            }
          >
            {activeTab === 'tasks' ? (
              // Tasks Content
              filteredTodos.length === 0 ? (
                <View style={[styles.emptyState, { 
                  flex: 1, 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  marginTop: 165
                }]}>
                  <Text style={[styles.emptyStateTitle, { 
                    textAlign: 'center',
                    width: '100%',
                    fontFamily: 'Onest'
                  }]}>no tasks!</Text>
                  <Text style={[styles.emptyStateSubtitle, { 
                    textAlign: 'center',
                    width: '100%',
                    fontFamily: 'Onest'
                  }]}>Take a breather :)</Text>
                </View>
              ) : (
                <>
                  <View style={{ marginTop: 32 }} />
                  {categories.map(category => renderCategory(category))}
                  {renderUncategorizedTodos()}
                  <View style={{ height: 20 }} />
                  {renderCompletedTodos()}
                </>
              )
            ) : (
              // Habits Content
              (habits || []).length === 0 ? (
                <View style={[styles.emptyState, { 
                  flex: 1, 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  marginTop: 180
                }]}>
                  <Text style={[styles.emptyStateTitle, { 
                    textAlign: 'center',
                    width: '100%',
                    fontWeight: '700',
                    fontFamily: 'Onest'
                  }]}>no habits yet!</Text>
                  <Text style={[styles.emptyStateSubtitle, { 
                    textAlign: 'center',
                    width: '100%',
                    fontFamily: 'Onest'
                  }]}>Start building good habits :)</Text>
                </View>
              ) : (
                <View style={{ paddingHorizontal: 22, marginTop: 20 }}>
                  {habits.map((habit) => (
                    <Swipeable
                      key={habit.id}
                      ref={(ref) => {
                        if (ref) {
                          swipeableRefs.current[habit.id] = ref;
                        }
                      }}
                      renderRightActions={() => (
                        <View style={[styles.rightAction, {
                          backgroundColor: `${darkenColor(habit.color, 0.2)}90`,
                        }]}>
                          <TouchableOpacity
                            onPress={() => {
                              if (Platform.OS !== 'web') {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              }
                              // Close the swipeable immediately
                              if (swipeableRefs.current[habit.id]) {
                                swipeableRefs.current[habit.id].close();
                              }
                              deleteHabit(habit.id);
                            }}
                          >
                            <View style={styles.trashIconContainer}>
                              <Ionicons name="trash" size={24} color="#FFF8E8" />
                            </View>
                          </TouchableOpacity>
                        </View>
                      )}
                      renderLeftActions={() => (
                        <View style={[habitStyles.leftAction, {
                          backgroundColor: `${habit.color}90`,
                        }]}>
                          <TouchableOpacity
                            onPress={() => {
                              if (Platform.OS !== 'web') {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              }
                              // Close the swipeable immediately
                              if (swipeableRefs.current[habit.id]) {
                                swipeableRefs.current[habit.id].close();
                              }
                              setSelectedHabitForLog(habit);
                              setLogDate(moment().format('YYYY-MM-DD'));
                              // Pre-fill with existing note for today if it exists
                              const today = moment().format('YYYY-MM-DD');
                              const existingNote = habit.notes?.[today] || '';
                              setLogNoteText(existingNote);
                              setIsHabitLogModalVisible(true);
                            }}
                          >
                            <View style={habitStyles.noteIconContainer}>
                              <Ionicons name="create-outline" size={24} color="#FFF8E8" />
                            </View>
                          </TouchableOpacity>
                        </View>
                      )}
                      onSwipeableRightOpen={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }
                        // Close the swipeable after a short delay
                        setTimeout(() => {
                          if (swipeableRefs.current[habit.id]) {
                            swipeableRefs.current[habit.id].close();
                          }
                        }, 100);
                        deleteHabit(habit.id);
                      }}
                      onSwipeableLeftOpen={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }
                        // Close the swipeable after a short delay
                        setTimeout(() => {
                          if (swipeableRefs.current[habit.id]) {
                            swipeableRefs.current[habit.id].close();
                          }
                        }, 100);
                        setSelectedHabitForLog(habit);
                        setLogDate(moment().format('YYYY-MM-DD'));
                        // Pre-fill with existing note for today if it exists
                        const today = moment().format('YYYY-MM-DD');
                        const existingNote = habit.notes?.[today] || '';
                        setLogNoteText(existingNote);
                        setIsHabitLogModalVisible(true);
                      }}
                      friction={1.5}
                      overshootRight={false}
                      overshootLeft={false}
                      rightThreshold={30}
                      leftThreshold={30}
                      containerStyle={{
                        marginVertical: 4,
                        borderRadius: 12,
                        overflow: 'hidden',
                        opacity: 1
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: `${habit.color}20`,
                          borderRadius: 12,
                          padding: 14,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.06,
                          shadowRadius: 4,
                          elevation: 2,
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => {
                            // Handle double-click for habit completion
                            const now = Date.now();
                            const lastPress = lastPressTime.current[habit.id] || 0;
                            const timeDiff = now - lastPress;
                            
                            if (timeDiff < 300) { // Double-click detected (300ms threshold)
                              // Complete the habit
                              const today = moment().format('YYYY-MM-DD');
                              const isCompletedToday = habit.completedDays.some(date => date.startsWith(today));
                              
                              if (!isCompletedToday) {
                                if (habit.requirePhoto) {
                                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                  addHabitPhoto(habit);
                                } else {
                                  completeHabit(habit.id, today, false);
                                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }
                              } else {
                                // Undo completion if already completed today
                                undoHabitCompletion(habit.id, today);
                                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }
                              
                              // Reset the press time
                              lastPressTime.current[habit.id] = 0;
                            } else {
                              // Single click - store the press time and wait for potential double-click
                              lastPressTime.current[habit.id] = now;
                              
                              // Use setTimeout to delay the single-click action
                              setTimeout(() => {
                                // Only execute if no double-click occurred (press time wasn't reset)
                                if (lastPressTime.current[habit.id] === now) {
                                  // Toggle the expanded state for this habit
                                  setExpandedHabits(prev => ({
                                    ...prev,
                                    [habit.id]: !prev[habit.id]
                                  }));
                                }
                              }, 300); // Wait 300ms to see if a double-click occurs
                            }
                          }}
                          onLongPress={() => {
                            if (Platform.OS !== 'web') {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }
                            
                            // Set up the edit form with current habit data
                            setNewHabit(habit.text);
                            setNewHabitDescription(habit.description || '');
                            setNewHabitColor(habit.color);
                            setHabitReminderTime(habit.reminderTime ? new Date(habit.reminderTime) : null);
                            setHabitRequirePhoto(habit.requirePhoto);
                            setHabitTargetPerWeek(habit.targetPerWeek);
                            setEditingHabit(habit);
                            setIsNewHabitModalVisible(true);
                          }}
                          delayLongPress={500}
                          activeOpacity={0.9}
                          style={{ position: 'relative', zIndex: 1 }}
                        >
                          {/* Header Row */}
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 8,
                            paddingRight: 40, // Increased padding to prevent overlap
                          }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{
                                fontSize: 16,
                                color: '#1a1a1a',
                                fontWeight: '600',
                                fontFamily: 'Onest',
                                marginBottom: 2,
                              }}>
                                {habit.text}
                              </Text>
                              {habit.description && (
                                <Text style={{
                                  fontSize: 12,
                                  color: '#666',
                                  fontFamily: 'Onest',
                                  lineHeight: 16,
                                }}>
                                  {habit.description}
                                </Text>
                              )}
                            </View>
                          </View>
                          
                          {/* Progress Section */}
                          {expandedHabits[habit.id] ? (
                            // Show smaller date buttons when expanded
                            <View style={{ flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                              <View style={{ flexDirection: 'row', gap: 3, marginBottom: 8, marginTop: 2 }}>
                                {(() => {
                                  const weekStart = moment().startOf('isoWeek');
                                  const completedDays = habit.completedDays || [];
                                  const notes = habit.notes || {};
                                  const photos = habit.photos || {};
                                  const days = [];
                                  for (let i = 0; i < 7; i++) {
                                    const currentDate = weekStart.clone().add(i, 'days');
                                    const dateStr = currentDate.format('YYYY-MM-DD');
                                    const hasNote = notes[dateStr];
                                    const hasPhoto = photos[dateStr];
                                    const isCompleted = completedDays.includes(dateStr) || !!hasNote || !!hasPhoto;
                                    const isToday = currentDate.isSame(moment(), 'day');
                                    let backgroundColor = '#f8fafc';
                                    let borderColor = '#e2e8f0';
                                    let textColor = '#64748b';
                                    if (isCompleted) {
                                      backgroundColor = `${habit.color}20`;
                                      borderColor = habit.color;
                                      textColor = '#1e293b';
                                    } else if (isToday) {
                                      backgroundColor = '#e0f7fa';
                                      borderColor = '#00ACC1';
                                      textColor = '#00695c';
                                    }
                                    days.push(
                                      <TouchableOpacity
                                        key={dateStr}
                                        onPress={() => {
                                          if (isToday && !isCompleted) {
                                            const today = moment().format('YYYY-MM-DD');
                                            if (habit.requirePhoto) {
                                              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                              addHabitPhoto(habit);
                                            } else {
                                              completeHabit(habit.id, today, false);
                                              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            }
                                          } else {
                                            setSelectedDateData({
                                              habit,
                                              date: dateStr,
                                              formattedDate: currentDate.format('MMMM D, YYYY'),
                                              note: hasNote || undefined,
                                              photo: hasPhoto || undefined,
                                              isCompleted
                                            });
                                            setIsDetailModalVisible(true);
                                          }
                                        }}
                                        onLongPress={() => {
                                          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                          setSelectedHabitForLog(habit);
                                          setLogDate(dateStr);
                                          const existingNote = notes[dateStr] || '';
                                          setLogNoteText(existingNote);
                                          setIsHabitLogModalVisible(true);
                                        }}
                                        delayLongPress={500}
                                        style={{
                                          width: 35,
                                          height: 35,
                                          borderRadius: 9,
                                          backgroundColor: hasPhoto ? 'transparent' : backgroundColor,
                                          borderWidth: hasPhoto ? 0 : 1,
                                          borderColor,
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                          position: 'relative',
                                          overflow: 'hidden',
                                        }}
                                      >
                                        {hasPhoto && (
                                          <Image
                                            source={{ uri: hasPhoto }}
                                            style={{
                                              position: 'absolute',
                                              top: 0,
                                              left: 0,
                                              right: 0,
                                              bottom: 0,
                                              width: '100%',
                                              height: '100%',
                                              borderRadius: 10,
                                            }}
                                            resizeMode="cover"
                                          />
                                        )}
                                        {hasNote ? (
                                          <Text style={{
                                            fontSize: 11,
                                            color: hasPhoto ? '#ffffff' : textColor,
                                            fontFamily: 'Onest',
                                            textAlign: 'center',
                                            lineHeight: 13,
                                            maxWidth: '100%',
                                            textShadowColor: hasPhoto ? 'rgba(0, 0, 0, 0.8)' : 'transparent',
                                            textShadowOffset: { width: 0, height: 1 },
                                            textShadowRadius: hasPhoto ? 2 : 0,
                                            fontWeight: hasPhoto ? '700' : '400',
                                          }}
                                          numberOfLines={2}
                                          >
                                            {notes[dateStr]}
                                          </Text>
                                        ) : !hasPhoto ? (
                                          <Text style={{
                                            fontSize: 15,
                                            fontWeight: '600',
                                            color: textColor,
                                            fontFamily: 'Onest',
                                          }}>
                                            {currentDate.format('D')}
                                          </Text>
                                        ) : null}
                                      </TouchableOpacity>
                                    );
                                  }
                                  return days;
                                })()}
                              </View>
                              {/* Progress Bar with Percentage (moved down) */}
                              <View style={{
                                position: 'relative',
                                height: 4,
                                backgroundColor: '#f1f3f4',
                                borderRadius: 2,
                                overflow: 'visible',
                                marginTop: 2,
                                width: '100%',
                              }}>
                                <View style={{
                                  height: '100%',
                                  backgroundColor: habit.color,
                                  borderRadius: 2,
                                  width: `${getWeeklyProgressPercentage(habit)}%`,
                                }} />
                                <Text style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: -18,
                                  fontSize: 11,
                                  color: '#495057',
                                  fontWeight: '600',
                                  fontFamily: 'Onest',
                                }}>
                                  {(() => {
                                    const completedThisWeek = (habit.completedDays || []).filter(date => {
                                      const dateOnly = date.split('-').slice(0, 3).join('-');
                                      const habitDate = moment(dateOnly, 'YYYY-MM-DD');
                                      const weekStart = moment().startOf('isoWeek');
                                      const weekEnd = moment().endOf('isoWeek');
                                      return habitDate.isBetween(weekStart, weekEnd, 'day', '[]');
                                    }).length;
                                    return `${completedThisWeek}/${habit.targetPerWeek || 7}`;
                                  })()}
                                </Text>
                              </View>
                            </View>
                          ) : (
                            // Show weekday labels and progress bar when not expanded
                            <>
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                {(() => {
                                  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
                                  const weekStart = moment().startOf('isoWeek');
                                  const completedDays = habit.completedDays || [];
                                  return weekDays.map((day, index) => {
                                    const dayDate = moment(weekStart).add(index, 'days');
                                    const dateStr = dayDate.format('YYYY-MM-DD');
                                    const isCompleted = completedDays.some(date => date.startsWith(dateStr));
                                    const isToday = dayDate.isSame(moment(), 'day');
                                    return (
                                      <Text
                                        key={index}
                                        style={{
                                          fontSize: 11,
                                          color: isToday ? '#00ACC1' : '#666',
                                          fontWeight: isCompleted ? '700' : '400',
                                          fontFamily: 'Onest',
                                          width: 12,
                                          textAlign: 'center',
                                        }}
                                      >
                                        {day}
                                      </Text>
                                    );
                                  });
                                })()}
                              </View>
                              {/* Progress Bar with Percentage */}
                              <View style={{
                                position: 'relative',
                                height: 4,
                                backgroundColor: '#f1f3f4',
                                borderRadius: 2,
                                overflow: 'visible',
                                marginTop: 4,
                                width: '100%',
                              }}>
                                <View style={{
                                  height: '100%',
                                  backgroundColor: habit.color,
                                  borderRadius: 2,
                                  width: `${getWeeklyProgressPercentage(habit)}%`,
                                }} />
                                <Text style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: -18,
                                  fontSize: 11,
                                  color: '#495057',
                                  fontWeight: '600',
                                  fontFamily: 'Onest',
                                }}>
                                  {(() => {
                                    const completedThisWeek = (habit.completedDays || []).filter(date => {
                                      const dateOnly = date.split('-').slice(0, 3).join('-');
                                      const habitDate = moment(dateOnly, 'YYYY-MM-DD');
                                      const weekStart = moment().startOf('isoWeek');
                                      const weekEnd = moment().endOf('isoWeek');
                                      return habitDate.isBetween(weekStart, weekEnd, 'day', '[]');
                                    }).length;
                                    return `${completedThisWeek}/${habit.targetPerWeek || 7}`;
                                  })()}
                                </Text>
                              </View>
                            </>
                          )}
                          
                          {/* Right Footer Space */}
                          <View style={{
                            position: 'absolute',
                            right: 0,
                            top: 6,
                            alignItems: 'flex-end',
                            gap: 14,
                          }}>
                            {/* Streak Badge */}
                            <View style={{
                              backgroundColor: `${habit.color}5`,
                              borderRadius: 12,
                            }}>
                              <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 3,
                              }}>
                                <Ionicons name="flame" size={12} color="#ff6b35" />
                                <Text style={{
                                  fontSize: 11,
                                  color: '#495057',
                                  fontWeight: '600',
                                  fontFamily: 'Onest',
                                }}>
                                  {habit.streak}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </Swipeable>
                  ))}
                </View>
              )
            )}
          </ScrollView>

          {/* Quick Add Input - Always visible when tasks tab is active */}
          {activeTab === 'tasks' && (
            <Animated.View style={[{
                    position: 'absolute',
                    bottom: 100,
                    left: 20,
                    right: 20,
              backgroundColor: Colors.light.surface,
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
                borderWidth: 1,
              borderColor: Colors.light.border,
              zIndex: 1000,
            }, animatedStyle]}>
              <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
              }}>
                <TextInput
                  ref={quickAddInputRef}
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: Colors.light.text,
                    fontFamily: 'Onest',
                    paddingVertical: 4,
                  }}
                  placeholder="Create a task..."
                  placeholderTextColor={Colors.light.icon}
                  value={quickAddText}
                  onChangeText={setQuickAddText}
                  onSubmitEditing={handleQuickAdd}
                  returnKeyType="done"
                  blurOnSubmit={false}
                  onFocus={() => {
                    setIsQuickAddFocused(true);
                  }}
                  onBlur={() => {
                    setIsQuickAddFocused(false);
                  }}
                />
                
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  
                  {/* More options button */}
                <TouchableOpacity
                    onPress={() => {
                      handleAddButtonPress();
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: Colors.light.border,
                  }}
                    activeOpacity={0.7}
                >
                    <Ionicons name="ellipsis-horizontal" size={16} color={Colors.light.icon} />
                </TouchableOpacity>
                  
                  {/* Submit button */}
                {quickAddText.trim() && (
                  <TouchableOpacity
                    onPress={handleQuickAdd}
                    disabled={isQuickAdding}
                    style={{
                        width: 28,
                        height: 28,
                        backgroundColor: Colors.light.accent,
                        borderRadius: 14,
                      justifyContent: 'center',
                      alignItems: 'center',
                      opacity: isQuickAdding ? 0.6 : 1,
                    }}
                      activeOpacity={0.7}
                  >
                    {isQuickAdding ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Ionicons name="arrow-up" size={14} color="white" />
                    )}
                  </TouchableOpacity>
                )}
                </View>
              </View>
            </Animated.View>
          )}
          
          {/* Quick Add Input for Habits - Always visible when habits tab is active */}
          {activeTab === 'habits' && (
            <Animated.View style={[{
              position: 'absolute',
              bottom: 100,
              left: 20,
              right: 20,
              backgroundColor: Colors.light.surface,
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
              borderWidth: 1,
              borderColor: Colors.light.border,
              zIndex: 1000,
            }, animatedStyle]}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                <TextInput
                  ref={quickAddHabitInputRef}
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: Colors.light.text,
                    fontFamily: 'Onest',
                    paddingVertical: 4,
                  }}
                  placeholder="Create a habit..."
                  placeholderTextColor={Colors.light.icon}
                  value={quickAddHabitText}
                  onChangeText={setQuickAddHabitText}
                  onSubmitEditing={handleQuickAddHabit}
                  returnKeyType="done"
                  blurOnSubmit={false}
                  onFocus={() => {
                    setIsQuickAddHabitFocused(true);
                  }}
                  onBlur={() => {
                    setIsQuickAddHabitFocused(false);
                  }}
                />
                
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {/* Weekly goal selector */}
                  <View style={{ position: 'relative' }}>
                    <TouchableOpacity
                      onPress={() => {
                        setShowWeeklyGoalPanel(!showWeeklyGoalPanel);
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                      }}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                        backgroundColor: '#00ACC1',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#00ACC1',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: 'white',
                        fontFamily: 'Onest',
                      }}>
                        {quickAddWeeklyGoal}
                      </Text>
                      <Ionicons 
                        name={showWeeklyGoalPanel ? "chevron-up" : "chevron-down"} 
                        size={12} 
                        color="white" 
                      />
                    </TouchableOpacity>
                    
                                        {/* Weekly goal panel */}
                    {showWeeklyGoalPanel && (
                      <View style={{
                        position: 'absolute',
                        bottom: '160%',
                        left: -70, // Adjusted to center the wider panel
                        backgroundColor: Colors.light.surface,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: Colors.light.border,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 4,
                        marginBottom: 4,
                        zIndex: 1001,
                        width: 160, // Increased width for bigger panel
                      }}>
                        <View style={{
                          padding: 10,
                          gap: 6,
                        }}>
                          {/* First row: 1 2 3 4 */}
                          <View style={{
                            flexDirection: 'row',
                            gap: 5,
                            justifyContent: 'center',
                          }}>
                            {[1, 2, 3, 4].map((goal) => (
                              <TouchableOpacity
                                key={goal}
                                onPress={() => {
                                  setQuickAddWeeklyGoal(goal);
                                  setShowWeeklyGoalPanel(false);
                                  if (Platform.OS !== 'web') {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }
                                }}
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  backgroundColor: quickAddWeeklyGoal === goal ? '#00ACC1' : 'transparent',
                                  borderRadius: 6,
                                  borderWidth: 1,
                                  borderColor: quickAddWeeklyGoal === goal ? '#00ACC1' : Colors.light.border,
                                  minWidth: 28,
                                  alignItems: 'center',
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={{
                                  fontSize: 11,
                                  fontWeight: '600',
                                  color: quickAddWeeklyGoal === goal ? 'white' : Colors.light.text,
                                  fontFamily: 'Onest',
                                }}>
                                  {goal}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          
                          {/* Second row: 5 6 7 */}
                          <View style={{
                            flexDirection: 'row',
                            gap: 5,
                            justifyContent: 'center',
                          }}>
                            {[5, 6, 7].map((goal) => (
                              <TouchableOpacity
                                key={goal}
                                onPress={() => {
                                  setQuickAddWeeklyGoal(goal);
                                  setShowWeeklyGoalPanel(false);
                                  if (Platform.OS !== 'web') {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }
                                }}
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  backgroundColor: quickAddWeeklyGoal === goal ? '#00ACC1' : 'transparent',
                                  borderRadius: 6,
                                  borderWidth: 1,
                                  borderColor: quickAddWeeklyGoal === goal ? '#00ACC1' : Colors.light.border,
                                  minWidth: 28,
                                  alignItems: 'center',
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={{
                                  fontSize: 11,
                                  fontWeight: '600',
                                  color: quickAddWeeklyGoal === goal ? 'white' : Colors.light.text,
                                  fontFamily: 'Onest',
                                }}>
                                  {goal}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                  
                  {/* More options button */}
                  <TouchableOpacity
                    onPress={() => {
                      // Pre-populate the habit modal with quick add data
                      setNewHabit(quickAddHabitText.trim());
                      setHabitTargetPerWeek(quickAddWeeklyGoal);
                      setIsNewHabitModalVisible(true);
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 6,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: Colors.light.border,
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color={Colors.light.icon} />
                  </TouchableOpacity>
                  
                  {/* Submit button */}
                  {quickAddHabitText.trim() && (
                    <TouchableOpacity
                      onPress={handleQuickAddHabit}
                      disabled={isQuickAddingHabit}
                      style={{
                        width: 28,
                        height: 28,
                        backgroundColor: Colors.light.accent,
                        borderRadius: 14,
                        justifyContent: 'center',
                        alignItems: 'center',
                        opacity: isQuickAddingHabit ? 0.6 : 1,
                      }}
                      activeOpacity={0.7}
                    >
                      {isQuickAddingHabit ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Ionicons name="arrow-up" size={14} color="white" />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Full-screen overlay for weekly goal panel */}
          {showWeeklyGoalPanel && (
            <TouchableWithoutFeedback onPress={() => setShowWeeklyGoalPanel(false)}>
              <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'transparent',
                zIndex: 999,
              }} />
            </TouchableWithoutFeedback>
          )}
          
        </View>
      </PanGestureHandler>

      {/* New Task Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isNewTaskModalVisible}
        onRequestClose={handleCloseNewTaskModal}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.light.surface }}>
          <KeyboardAvoidingView 
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <View style={{ flex: 1 }}>
              {/* Minimal Header */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                paddingHorizontal: 16,
                paddingVertical: 12,
                paddingTop: 40,
                backgroundColor: (() => {
                  if (editingTodo) {
                    if (selectedCategoryId && selectedCategoryId.trim() !== '') {
                      const category = categories.find(cat => cat.id === selectedCategoryId);
                      return category ? category.color + '60' : '#ffffff';
                    }
                    return Colors.light.background;
                  } else {
                    // New task modal
                    if (selectedCategoryId && selectedCategoryId.trim() !== '') {
                      const category = categories.find(cat => cat.id === selectedCategoryId);
                      return category ? category.color + '60' : Colors.light.background;
                    }
                    return Colors.light.background;
                  }
                })(),
              }}>
                <TouchableOpacity 
                  onPress={() => {
                    hideModal();
                    // Delay resetForm to prevent title change during modal closing animation
                    setTimeout(() => {
                      resetForm();
                    }, 300);
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="close" size={16} color={Colors.light.icon} />
                </TouchableOpacity>
                
                <Text style={{ 
                  fontSize: 16, 
                  fontWeight: '600', 
                  color: Colors.light.text,
                  fontFamily: 'Onest'
                }}>
                  {editingTodo ? 'Edit Task' : 'New Task'}
                </Text>
                
                <TouchableOpacity 
                  onPress={editingTodo ? handleEditSave : handleSave}
                  disabled={!newTodo.trim()}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: newTodo.trim() ? Colors.light.accent : Colors.light.background,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons 
                    name="checkmark" 
                    size={16} 
                    color={newTodo.trim() ? 'white' : Colors.light.icon} 
                  />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView 
                  ref={modalScrollViewRef}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ 
                    padding: 16, 
                    paddingBottom: 150, // Increased bottom padding for better scrolling with keyboard
                    minHeight: '100%' // Ensures content is scrollable even when short
                  }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true} // Show scroll indicator
                  bounces={true} // Enable bounce effect
                  alwaysBounceVertical={true} // Always allow vertical bounce
                  scrollEventThrottle={16} // Smooth scrolling
                  keyboardDismissMode="interactive" // Allow keyboard to be dismissed by scrolling
                >
                {/* Task Title Card */}
                <View style={{
                  backgroundColor: Colors.light.background,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 18,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}>
                  <TextInput
                    ref={newTodoInputRef}
                    style={{
                      fontSize: 17,
                      fontFamily: 'Onest',
                      fontWeight: '500',
                      marginBottom: 5,
                    }}
                    placeholder="Task Title"
                    placeholderTextColor={Colors.light.icon}
                    value={newTodo}
                    onChangeText={setNewTodo}
                  />

                  <TextInput
                    ref={newDescriptionInputRef}
                    style={{
                      fontSize: 13,
                      color: Colors.light.icon,
                      fontFamily: 'Onest',
                      fontWeight: '400',
                      marginTop: 5,
                      paddingVertical: 2,
                      paddingHorizontal: 0,
                      textAlignVertical: 'top',
                      minHeight: 60,
                    }}
                    placeholder="Description"
                    placeholderTextColor={Colors.light.icon}
                    value={newDescription}
                    onChangeText={setNewDescription}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Date Card */}
                <View style={{
                  backgroundColor: Colors.light.background,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 18,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}>
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: Colors.light.text,
                    marginBottom: 12,
                    fontFamily: 'Onest'
                  }}>
                    Due Date
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowTaskDatePicker(prev => !prev);
                      Keyboard.dismiss();
                    }}
                    style={{
                      backgroundColor: Colors.light.surface,
                      borderRadius: 8,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: showTaskDatePicker ? Colors.light.accent : Colors.light.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{
                        fontSize: 14,
                        color: Colors.light.text,
                        fontFamily: 'Onest',
                        fontWeight: '500'
                      }}>
                        {taskDate ? 
                          (() => {
                            const today = moment().startOf('day');
                            const tomorrow = moment().add(1, 'day').startOf('day');
                            const taskMoment = moment(taskDate).startOf('day');
                            
                            if (taskMoment.isSame(today)) {
                              return 'Today';
                            } else if (taskMoment.isSame(tomorrow)) {
                              return 'Tomorrow';
                            } else {
                              return moment(taskDate).format('MMM D, YYYY');
                            }
                          })() : 
                          'Select date'
                        }
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {showTaskDatePicker && (
                    <View style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: 8,
                      padding: 12,
                      marginTop: 8,
                      borderWidth: 1,
                      borderColor: '#e0e0e0',
                    }}>
                      <RNCalendar
                        current={taskDate ? moment(taskDate).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD')}
                        onDayPress={(day: DateData) => {
                          // Create a new date using the dateString to avoid timezone issues
                          const selectedDate = new Date(day.dateString + 'T00:00:00');
                          setTaskDate(selectedDate);
                          setShowTaskDatePicker(false);
                          Keyboard.dismiss();
                        }}
                        markedDates={{
                          [taskDate ? moment(taskDate).format('YYYY-MM-DD') : '']: {
                            selected: true,
                            selectedColor: '#00ACC1',
                          },
                          [moment().format('YYYY-MM-DD')]: {
                            today: true,
                            todayTextColor: '#00ACC1',
                          }
                        }}
                        theme={{
                          backgroundColor: 'transparent',
                          calendarBackground: 'transparent',
                          textSectionTitleColor: '#333',
                          selectedDayBackgroundColor: '#00ACC1',
                          selectedDayTextColor: '#ffffff',
                          todayTextColor: '#00ACC1',
                          dayTextColor: '#333',
                          textDisabledColor: '#d9e1e8',
                          dotColor: '#00ACC1',
                          selectedDotColor: '#ffffff',
                          arrowColor: '#00ACC1',
                          monthTextColor: '#333',
                          indicatorColor: '#00ACC1',
                          textDayFontFamily: 'Onest',
                          textMonthFontFamily: 'Onest',
                          textDayHeaderFontFamily: 'Onest',
                          textDayFontWeight: '400',
                          textMonthFontWeight: '600',
                          textDayHeaderFontWeight: '500',
                          textDayFontSize: 14,
                          textMonthFontSize: 16,
                          textDayHeaderFontSize: 12,
                        }}
                        style={{
                          width: '100%',
                        }}
                      />
                    </View>
                  )}
                </View>

                {/* Category Card */}
                <View style={{
                  backgroundColor: Colors.light.background,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 18,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}>
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: Colors.light.text,
                    marginBottom: 12,
                    fontFamily: 'Onest'
                  }}>
                    Category
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      if ((categories || []).length === 0) {
                        // If no categories exist, automatically show new category input
                        setShowNewCategoryInput(true);
                        setNewCategoryName('');
                        setNewCategoryColor('#BF9264');
                        setShowCategoryBox(false);
                      } else {
                        // If categories exist, toggle the category box
                        setShowCategoryBox(prev => !prev);
                      }
                      Keyboard.dismiss();
                    }}
                    style={{
                      backgroundColor: Colors.light.surface,
                      borderRadius: 8,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: showCategoryBox ? Colors.light.accent : Colors.light.border,
                    }}
                  >
                    {!showCategoryBox ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {selectedCategoryId ? (
                            <>
                              <View style={{ 
                                width: 8, 
                                height: 8, 
                                borderRadius: 4, 
                                backgroundColor: categories.find(cat => cat.id === selectedCategoryId)?.color || '#64748b',
                                marginRight: 8
                              }} />
                              <Text style={{ 
                                fontSize: 14, 
                                color: '#333',
                                fontFamily: 'Onest',
                                fontWeight: '500'
                              }}>
                                {categories.find(cat => cat.id === selectedCategoryId)?.label}
                              </Text>
                            </>
                          ) : (
                            <Text style={{ 
                              fontSize: 14, 
                              color: '#64748b',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                              Choose category
                            </Text>
                          )}
                        </View>
                      </View>
                    ) : (
                      <View style={{ 
                        flexDirection: 'row', 
                        flexWrap: 'wrap', 
                        justifyContent: 'flex-start',
                        gap: 6,
                      }}>
                        {categories.map((cat) => (
                          <Pressable
                            key={cat.id}
                            onPress={() => {
                              setSelectedCategoryId(prev => prev === cat.id ? '' : cat.id);
                              setShowCategoryBox(false);
                              Keyboard.dismiss();
                            }}
                            onLongPress={() => {
                              Alert.alert(
                                "Delete Category",
                                `Are you sure you want to delete "${cat.label}"? This will also delete all tasks in this category.`,
                                [
                                  { text: "Cancel", style: "cancel" },
                                  {
                                    text: "Delete",
                                    style: "destructive",
                                    onPress: () => handleDeleteCategory(cat.id),
                                  },
                                ]
                              );
                            }}
                            delayLongPress={500}
                            style={({ pressed }) => ({
                              backgroundColor: selectedCategoryId === cat.id ? cat.color + '20' : Colors.light.surface,
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              borderRadius: 16,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                            })}
                          >
                            <View style={{ 
                              width: 6, 
                              height: 6, 
                              borderRadius: 3, 
                              backgroundColor: cat.color,
                            }} />
                            <Text style={{ 
                              color: '#333', 
                              fontSize: 12, 
                              fontFamily: 'Onest',
                              fontWeight: selectedCategoryId === cat.id ? '600' : '500'
                            }}>
                              {cat.label}
                            </Text>
                          </Pressable>
                        ))}
                        <TouchableOpacity
                          onPress={() => {
                            setShowNewCategoryInput(true);
                            setNewCategoryName('');
                            setNewCategoryColor('#BF9264');
                            Keyboard.dismiss();
                          }}
                          style={{
                            backgroundColor: Colors.light.surface,
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Ionicons name="add" size={14} color="#64748b" />
                        </TouchableOpacity>
                      </View>
                    )}

                    {showNewCategoryInput && (
                      <View style={{
                        backgroundColor: Colors.light.surface,
                        padding: 12,
                        borderRadius: 8,
                        marginTop: 3,
                      }}>
                        <Text style={{
                          fontSize: 14,
                          color: Colors.light.text,
                          fontFamily: 'Onest',
                          fontWeight: '600',
                          marginBottom: 8,
                        }}>
                          New Category
                        </Text>
                        <TextInput
                          ref={categoryInputRef}
                          style={{
                            backgroundColor: Colors.light.background,
                            padding: 8,
                            borderRadius: 6,
                            marginBottom: 8,
                            fontSize: 14,
                            fontFamily: 'Onest',
                            borderWidth: 1,
                            borderColor: Colors.light.borderVariant,
                          }}
                          placeholder="Category name"
                          value={newCategoryName}
                          onChangeText={setNewCategoryName}
                        />
                        
                        {/* Color Picker */}
                        <Text style={{
                          fontSize: 12,
                          color: Colors.light.icon,
                          fontFamily: 'Onest',
                          fontWeight: '500',
                          marginTop: 6,
                        }}>
                          Color
                        </Text>
                        <View style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 6,
                          marginTop: 7,
                        }}>
                          {['#BF9264', '#6F826A', '#BBD8A3', '#F0F1C5', '#FFCFCF', '#FF9A8B', '#A0C3B2', '#E4D6A7', '#D8BFD8', '#B0E0E6', '#FFE5B4', '#FADADD', '#C1E1C1', '#F0D9FF', '#D0F0C0', '#FFFACD'].map((color) => (
                            <TouchableOpacity
                              key={color}
                              onPress={() => setNewCategoryColor(color)}
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                backgroundColor: color,
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              {newCategoryColor === color && (
                                <Ionicons name="checkmark" size={12} color="white" />
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
                          <TouchableOpacity
                            onPress={() => {
                              setShowNewCategoryInput(false);
                              setNewCategoryName('');
                              setNewCategoryColor('#E3F2FD');
                            }}
                            style={{
                             marginRight: 10,
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Ionicons name="close" size={18} color="#64748b" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={async () => {
                              if (!newCategoryName.trim()) return;
                              
                              try {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) {
                                  Alert.alert('Error', 'You must be logged in to create categories.');
                                  return;
                                }
                            
                                const newCategory = {
                                  id: uuidv4(),
                                  label: newCategoryName.trim(),
                                  color: newCategoryColor,
                                };
                            
                                const { data: savedCategory, error: categoryError } = await supabase
                                  .from('categories')
                                  .insert({
                                    id: newCategory.id,
                                    label: newCategory.label,
                                    color: newCategory.color,
                                    user_id: user.id,
                                    type: 'task'  // Add type field
                                  })
                                  .select()
                                  .single();
                            
                                if (categoryError || !savedCategory) {
                                  console.error('Error saving category:', categoryError);
                                  Alert.alert('Error', 'Failed to save category. Please try again.');
                                  return;
                                }
                            
                                // Update state in the correct order
                                setCategories(prev => [...prev, savedCategory]);
                                setSelectedCategoryId(savedCategory.id);
                                setNewCategoryName('');
                                setShowNewCategoryInput(false);
                            
                              } catch (error) {
                                console.error('Error creating category:', error);
                                Alert.alert('Error', 'An unexpected error occurred. Please try again.');
                              }
                            }}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              backgroundColor: '#00ACC1',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Ionicons name="checkmark" size={18} color="white" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Options Card */}
                <View style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 18,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}>
                  <View style={{ gap: 8 }}>
                    {/* Reminder */}
                    <View>
                      <View style={styles.modalTimeRow}>
                        <Text style={styles.modalLabel}>
                          Reminder
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            if (showReminderPicker) {
                              setShowReminderPicker(false);
                            } else {
                              setShowReminderPicker(true);
                              setShowReminderOptions(false);
                              setShowRepeatPicker(false);
                              setShowEndDatePicker(false);
                            }
                          }}
                          style={showReminderPicker ? styles.modalTimeButtonFocused : styles.modalTimeButton}
                        >
                          <Text style={styles.modalTimeText}>
                            {reminderTime ? reminderTime.toLocaleString([], { 
                              month: 'short', 
                              day: 'numeric', 
                              hour: 'numeric', 
                              minute: '2-digit', 
                              hour12: true 
                            }) : 'No reminder'}
                            </Text>
                        </TouchableOpacity>
                      </View>
                      {showReminderPicker && (
                        <View style={styles.modalPickerContainer}>
                          <DateTimePicker
                            value={reminderTime || new Date()}
                            mode="datetime"
                            display="spinner"
                            onChange={(event, selectedDate) => {
                              if (selectedDate) {
                                setReminderTime(selectedDate);
                                debouncePickerClose('reminder');
                              }
                            }}
                            style={{ height: 120, width: '100%' }}
                            textColor="#333"
                          />
                        </View>
                      )}
                    </View>

                    {/* Repeat */}
                    <View>
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}>
                        <Text style={{ 
                          fontSize: 14, 
                          color: '#333', 
                          fontFamily: 'Onest',
                          fontWeight: '500'
                        }}>
                          Repeat
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            setShowRepeatPicker(prev => !prev);
                            Keyboard.dismiss();
                          }}
                          style={{
                            backgroundColor: '#f8f9fa',
                            borderRadius: 8,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderWidth: 1,
                            borderColor: showRepeatPicker ? '#00ACC1' : '#e2e8f0',
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{
                              fontSize: 14,
                              color: '#333',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                              {selectedRepeat === 'none' ? 'Does not repeat' : REPEAT_OPTIONS.find(opt => opt.value === selectedRepeat)?.label}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>

                      {showRepeatPicker && (
                        <View style={{
                          backgroundColor: '#f8f9fa',
                          borderRadius: 8,
                          padding: 8,
                          marginTop: 4,
                          borderWidth: 1,
                          borderColor: '#e0e0e0',
                        }}>
                          <View style={{
                            marginBottom: 8,
                          }}>
                            {REPEAT_OPTIONS.map((option) => (
                              <TouchableOpacity
                                key={option.value}
                                onPress={() => {
                                  if (option.value === 'custom') {
                                    setSelectedRepeat(option.value);
                                    setShowRepeatPicker(false);
                                    Keyboard.dismiss();
                                  } else if (option.value === 'none') {
                                    setSelectedRepeat('none');
                                    setRepeatEndDate(null);
                                    setShowRepeatPicker(false);
                                    Keyboard.dismiss();
                                  } else {
                                    setSelectedRepeat(option.value);
                                    // Don't close the picker when selecting a repeat option
                                    // so the end date section remains visible
                                    Keyboard.dismiss();
                                  }
                                }}
                                style={{
                                  backgroundColor: selectedRepeat === option.value ? '#f1f5f9' : 'transparent',
                                  paddingVertical: 8,
                                  paddingHorizontal: 12,
                                  borderRadius: 6,
                                  marginVertical: 1,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <Text style={{
                                  fontSize: 14,
                                  color: '#333',
                                  fontFamily: 'Onest',
                                  fontWeight: selectedRepeat === option.value ? '600' : '500'
                                }}>
                                  {option.label}
                                </Text>
                                {selectedRepeat === option.value && (
                                  <Ionicons name="checkmark" size={16} color="#00ACC1" />
                                )}
                              </TouchableOpacity>
                            ))}
                          </View>

                          {selectedRepeat && selectedRepeat !== 'none' && selectedRepeat !== 'custom' && (
                            <View style={{
                              borderTopWidth: 1,
                              borderTopColor: '#00ACC1',
                              paddingTop: 8,
                            }}>
                              <TouchableOpacity
                                onPress={() => {
                                  setShowInlineEndDatePicker(prev => !prev);
                                  Keyboard.dismiss();
                                }}
                                style={{
                                  backgroundColor: repeatEndDate ? '#f0f0f0' : 'transparent',
                                  paddingVertical: 8,
                                  paddingHorizontal: 12,
                                  borderRadius: 6,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <Text style={{
                                  fontSize: 14,
                                  color: '#333',
                                  fontFamily: 'Onest',
                                  fontWeight: repeatEndDate ? '600' : '500'
                                }}>
                                  {repeatEndDate ? 
                                    `Ends ${moment(repeatEndDate).format('MMM D, YYYY')}` : 
                                    'Set end date'}
                                </Text>
                                {repeatEndDate ? (
                                  <Ionicons name="checkmark" size={16} color="#00ACC1" />
                                ) : (
                                  <Ionicons name="calendar-outline" size={16} color="#666" />
                                )}
                              </TouchableOpacity>

                              {showInlineEndDatePicker && (
                                <View style={{
                                  backgroundColor: '#ffffff',
                                  borderRadius: 8,
                                  padding: 8,
                                  marginTop: 4,
                                  borderWidth: 1,
                                  borderColor: '#e0e0e0',
                                }}>
                                  <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 8,
                                  }}>
                                    <TouchableOpacity
                                      onPress={() => {
                                        setRepeatEndDate(null);
                                        setShowInlineEndDatePicker(false);
                                      }}
                                      style={{
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                      }}
                                    >
                                      <Text style={{
                                        fontSize: 12,
                                        color: '#FF6B6B',
                                        fontFamily: 'Onest',
                                        fontWeight: '500'
                                      }}>
                                        Clear
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                  
                                  <RNCalendar
                                    current={repeatEndDate ? moment(repeatEndDate).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD')}
                                    onDayPress={(day: DateData) => {
                                      const selectedDate = new Date(day.dateString + 'T00:00:00');
                                      setRepeatEndDate(selectedDate);
                                      setShowInlineEndDatePicker(false);
                                      setShowRepeatPicker(false);
                                      Keyboard.dismiss();
                                    }}
                                    markedDates={{
                                      [repeatEndDate ? moment(repeatEndDate).format('YYYY-MM-DD') : '']: {
                                        selected: true,
                                        selectedColor: '#00ACC1',
                                                                              },
                                        [moment().format('YYYY-MM-DD')]: {
                                          today: true,
                                          todayTextColor: '#00ACC1',
                                        }
                                    }}
                                    minDate={moment().format('YYYY-MM-DD')}
                                    theme={{
                                      backgroundColor: 'transparent',
                                      calendarBackground: 'transparent',
                                      textSectionTitleColor: '#333',
                                      selectedDayBackgroundColor: '#00ACC1',
                                      selectedDayTextColor: '#ffffff',
                                      todayTextColor: '#00ACC1',
                                      dayTextColor: '#333',
                                      textDisabledColor: '#d9e1e8',
                                      dotColor: '#00ACC1',
                                      selectedDotColor: '#ffffff',
                                      arrowColor: '#00ACC1',
                                      monthTextColor: '#333',
                                      indicatorColor: '#00ACC1',
                                      textDayFontFamily: 'Onest',
                                      textMonthFontFamily: 'Onest',
                                      textDayHeaderFontFamily: 'Onest',
                                      textDayFontWeight: '400',
                                      textMonthFontWeight: '600',
                                      textDayHeaderFontWeight: '500',
                                      textDayFontSize: 14,
                                      textMonthFontSize: 16,
                                      textDayHeaderFontSize: 12,
                                    }}
                                    style={{
                                      width: '100%',
                                    }}
                                  />
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Add Friends Card */}
                <View style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 20, // Increased bottom margin
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}>
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#333',
                    marginBottom: 10,
                    fontFamily: 'Onest'
                  }}>
                    Friends
                  </Text>
                  
                  {/* Selected Friends Section */}
                  {selectedFriends.length > 0 && (
                    <View style={{ marginBottom: 12 }}>
                      <View style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}>
                        {selectedFriends.map(friendId => {
                          const friend = friends.find(f => f.friend_id === friendId);
                          if (!friend) return null;
                          
                          return (
                            <View key={friendId} style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: '#00ACC1',
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 16,
                              gap: 6,
                            }}>
                              {friend.friend_avatar && friend.friend_avatar.trim() !== '' ? (
                                <Image 
                                  source={{ uri: friend.friend_avatar }} 
                                  style={{ width: 16, height: 16, borderRadius: 8 }} 
                                />
                              ) : (
                                <View 
                                  style={{ 
                                    width: 16, 
                                    height: 16, 
                                    borderRadius: 8,
                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                  }}
                                >
                                  <Ionicons name="person" size={8} color="white" />
                                </View>
                              )}
                              <Text style={{ 
                                fontSize: 12, 
                                color: 'white', 
                                fontFamily: 'Onest',
                                fontWeight: '500'
                              }}>
                                {friend.friend_name}
                              </Text>
                              <TouchableOpacity
                                onPress={() => {
                                  setSelectedFriends(prev => prev.filter(id => id !== friendId));
                                }}
                                style={{
                                  marginLeft: 2,
                                }}
                              >
                                <Ionicons name="close" size={12} color="white" />
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                  
                  <TextInput
                    ref={friendsSearchInputRef}
                    placeholder="Search friends..."
                    value={searchFriend}
                    onChangeText={setSearchFriend}
                    onFocus={() => {
                      setIsSearchFocused(true);
                      // Automatic scroll to friends section
                      setTimeout(() => {
                        modalScrollViewRef.current?.scrollTo({ 
                          y: 1200, // Large value for dramatic scroll
                          animated: true 
                        });
                      }, 100);
                    }}
                    onBlur={() => setIsSearchFocused(false)}
                    style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 14,
                      marginBottom: 10,
                      fontFamily: 'Onest',
                      color: '#333',
                      borderWidth: 1,
                      borderColor: isSearchFocused ? '#00ACC1' : '#e2e8f0',
                    }}
                    placeholderTextColor="#999"
                  />
                  {/* Always show friends list */}
                  {true && (
                    <FlatList
                      data={friends.filter(f =>
                        (f.friend_name.toLowerCase().includes(searchFriend.toLowerCase()) ||
                        f.friend_username.toLowerCase().includes(searchFriend.toLowerCase())) &&
                        !selectedFriends.includes(f.friend_id)
                      )}
                      keyExtractor={item => `${item.friend_id}-${item.friendship_id}`}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      ListEmptyComponent={() => {
                        return (
                          <View style={{ 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            paddingVertical: 16,
                            minWidth: 180
                          }}>
                            <Ionicons name="people-outline" size={20} color="#CED4DA" />
                            <Text style={{ color: '#6C757D', fontSize: 11, marginTop: 4, fontFamily: 'Onest' }}>
                              {(friends || []).length === 0 ? 'No friends yet' : 'No friends match search'}
                            </Text>
                          </View>
                        );
                      }}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={{
                            marginRight: 3,
                            alignItems: 'center',
                            opacity: selectedFriends.includes(item.friend_id) ? 0.5 : 1,
                            paddingVertical: 3,
                            paddingHorizontal: 6,
                            borderRadius: 6,
                            backgroundColor: 'transparent',
                            borderWidth: selectedFriends.includes(item.friend_id) ? 1 : 0,
                            borderColor: '#00ACC1',
                          }}
                          onPress={() => {
                            setSelectedFriends(prev =>
                              prev.includes(item.friend_id)
                                ? prev.filter(id => id !== item.friend_id)
                                : [...prev, item.friend_id]
                            );
                            // Clear search when a friend is selected
                            setSearchFriend('');
                          }}
                        >
                          {item.friend_avatar && item.friend_avatar.trim() !== '' ? (
                            <Image 
                              source={{ uri: item.friend_avatar }} 
                              style={{ width: 32, height: 32, borderRadius: 16, marginBottom: 6 }} 
                            />
                          ) : (
                            <View 
                              style={{ 
                                width: 32, 
                                height: 32, 
                                borderRadius: 16, 
                                marginBottom: 6,
                                backgroundColor: '#E9ECEF',
                                justifyContent: 'center',
                                alignItems: 'center'
                              }}
                            >
                              <Ionicons name="person" size={14} color="#6C757D" />
                            </View>
                          )}
                          <Text style={{ fontSize: 10, fontFamily: 'Onest', color: '#495057', fontWeight: '500' }}>{item.friend_name}</Text>
                        </TouchableOpacity>
                      )}
                      style={{ minHeight: 90 }} // Increased height for better accessibility
                    />
                  )}
                </View>
              </ScrollView>
              </TouchableWithoutFeedback>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* New Category Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isNewCategoryModalVisible}
        onRequestClose={() => {
          setIsNewCategoryModalVisible(false);
        }}
      >
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ flex: 1 }} />
            <View style={{ 
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'white',
              padding: 20,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: -2,
              },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: '600', fontFamily: 'Onest' }}>New Category</Text>
                <TouchableOpacity onPress={() => {
                  setIsNewCategoryModalVisible(false);
                  setTimeout(() => {
                    setIsNewTaskModalVisible(true);
                  }, 300);
                }}>
                  <Ionicons name="close" size={20} color="#666" style={{ marginTop: -8, marginRight: -5 }} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="always">
                <TextInput
                  ref={categoryInputRef}
                  style={{
                    fontSize: 16,
                    color: '#1a1a1a',
                    padding: 12,
                    backgroundColor: '#F5F5F5',
                    borderRadius: 12,
                    marginBottom: 20,
                    fontFamily: 'Onest',
                  }}
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholder="Category name"
                  placeholderTextColor="#999"
                />

                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, marginTop: 8, fontFamily: 'Onest', marginLeft: 2 }}>Choose a color</Text>
                
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  keyboardShouldPersistTaps="always"
                >
                  {['#BF9264', '#6F826A', '#BBD8A3', '#F0F1C5', '#FFCFCF', '#FF9A8B', '#A0C3B2', '#E4D6A7', '#D8BFD8', '#B0E0E6', '#FFE5B4', '#FADADD', '#C1E1C1', '#F0D9FF', '#D0F0C0', '#FFFACD'].map((color) => {
                    const isSelected = newCategoryColor === color;
                    return (
                      <TouchableOpacity
                        key={color}
                        onPress={() => setNewCategoryColor(color)}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: color,
                          marginRight: 8,
                          marginLeft: 2,
                          opacity: newCategoryColor === color ? 1 : (newCategoryColor === '#E3F2FD' ? 1 : 0.6)
                        }}
                      />
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  onPress={async () => {
                    if (!newCategoryName.trim()) return;
                  
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) {
                        Alert.alert('Error', 'You must be logged in to create categories.');
                        return;
                      }
                  
                      const newCategory = {
                        id: uuidv4(),
                        label: newCategoryName.trim(),
                        color: newCategoryColor,
                      };
                  
                      const { data: savedCategory, error: categoryError } = await supabase
                        .from('categories')
                        .insert({
                          id: newCategory.id,
                          label: newCategory.label,
                          color: newCategory.color,
                          user_id: user.id,
                          type: 'task'  // Add type field
                        })
                        .select()
                        .single();
                  
                      if (categoryError || !savedCategory) {
                        console.error('Error saving category:', categoryError);
                        Alert.alert('Error', 'Failed to save category. Please try again.');
                        return;
                      }
                  
                      // Update state in the correct order
                      setCategories(prev => [...prev, savedCategory]);
                      setSelectedCategoryId(savedCategory.id);
                      setNewCategoryName('');
                      setShowNewCategoryInput(false);
                      
                      // Close category modal and show task modal
                      setIsNewCategoryModalVisible(false);
                      requestAnimationFrame(() => {
                        setIsNewTaskModalVisible(true);
                      });
                  
                    } catch (error) {
                      console.error('Error creating category:', error);
                      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
                    }
                  }}
                  style={{
                    backgroundColor: '#FF9A8B',
                    padding: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    marginTop: 'auto',
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', fontFamily: 'Onest' }}>Done</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* New Habit Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isNewHabitModalVisible}
        onRequestClose={() => {
          setIsNewHabitModalVisible(false);
        }}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.light.surface }}>
          <View style={{ flex: 1 }}>
            {/* Minimal Header */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              paddingHorizontal: 16,
              paddingVertical: 12,
              paddingTop: 40,
              backgroundColor: Colors.light.background,
            }}>
              <TouchableOpacity 
                onPress={() => {
                  setIsNewHabitModalVisible(false);
                  setEditingHabit(null);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="close" size={16} color={Colors.light.icon} />
              </TouchableOpacity>
              
              <Text style={{ 
                fontSize: 16, 
                fontWeight: '600', 
                color: Colors.light.text,
                fontFamily: 'Onest'
              }}>
                {editingHabit ? 'Edit Habit' : 'New Habit'}
              </Text>
              
              <TouchableOpacity 
                onPress={handleHabitSave}
                disabled={!newHabit.trim()}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: newHabit.trim() ? Colors.light.accent : Colors.light.background,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons 
                  name="checkmark" 
                  size={16} 
                  color={newHabit.trim() ? 'white' : Colors.light.icon} 
                />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <ScrollView 
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 100, minHeight: '100%' }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
              {/* Habit Title Card */}
              <View style={{
                backgroundColor: Colors.light.background,
                borderRadius: 12,
                padding: 16,
                marginBottom: 18,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 1,
              }}>
                <TextInput
                  ref={newHabitInputRef}
                  style={{
                    fontSize: 17,
                    fontFamily: 'Onest',
                    fontWeight: '500',
                    marginBottom: 5,
                  }}
                  placeholder="Habit Title"
                  placeholderTextColor={Colors.light.icon}
                  value={newHabit}
                  onChangeText={setNewHabit}
                />

                <TextInput
                  style={{
                    fontSize: 13,
                    color: Colors.light.icon,
                    fontFamily: 'Onest',
                    fontWeight: '400',
                    marginTop: 5,
                    paddingVertical: 2,
                    paddingHorizontal: 0,
                    textAlignVertical: 'top',
                    minHeight: 60,
                  }}
                  placeholder="Description"
                  placeholderTextColor={Colors.light.icon}
                  value={newHabitDescription}
                  onChangeText={setNewHabitDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Weekly Goal Card */}
              <View style={{
                backgroundColor: Colors.light.background,
                borderRadius: 12,
                padding: 16,
                marginBottom: 18,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 1,
              }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: Colors.light.text,
                  marginBottom: 10,
                  fontFamily: 'Onest'
                }}>
                  Weekly Goal
                </Text>
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  {[1, 2, 3, 4, 5, 6, 7].map((goal) => (
                    <TouchableOpacity
                      key={goal}
                      onPress={() => {
                        setHabitTargetPerWeek(goal);
                        Keyboard.dismiss();
                      }}
                      style={{
                        backgroundColor: habitTargetPerWeek === goal ? Colors.light.accent : Colors.light.surface,
                        width: 30,
                        height: 30,
                        borderRadius: 15, // Half of width/height for perfect circle
                        borderWidth: habitTargetPerWeek === goal ? 0 : 0.5,
                        borderColor: Colors.light.borderVariant,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{
                        color: habitTargetPerWeek === goal ? 'white' : Colors.light.text,
                        fontSize: 14,
                        fontFamily: 'Onest',
                        fontWeight: habitTargetPerWeek === goal ? '600' : '500',
                      }}>
                        {goal}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Color Picker Card */}
              <View style={{
                backgroundColor: 'white',
                borderRadius: 12,
                padding: 16,
                marginBottom: 18,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 1,
              }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#333',
                  marginBottom: 12,
                  fontFamily: 'Onest'
                }}>
                  Color
                </Text>
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  {['#FF9A8B', '#FF6B6B', '#A0C3B2', '#BF9264', '#6F826A', '#BBD8A3', '#D8BFD8', '#B0E0E6', '#FFE5B4', '#FADADD', '#C1E1C1', '#F0D9FF', '#D0F0C0', '#FFFACD', '#E4D6A7', '#FFCFCF'].map((color) => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => {
                        setNewHabitColor(color);
                        Keyboard.dismiss();
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: color,
                        borderWidth: newHabitColor === color ? 1.5 : 0,
                        borderColor: newHabitColor === color ? Colors.light.accent : Colors.light.borderVariant,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      {newHabitColor === color && (
                        <Ionicons name="checkmark" size={16} color="white" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Options Card */}
              <View style={{
                backgroundColor: 'white',
                borderRadius: 12,
                padding: 16,
                marginBottom: 18,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 1,
              }}>
                 {/* Photo Proof */}
                 <View style={{ marginBottom: 15 }}>
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                    }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ 
                          fontSize: 14, 
                          color: '#333', 
                          fontFamily: 'Onest',
                          fontWeight: '500',
                          marginBottom: 2,
                        }} numberOfLines={1}>
                          Require Photo Proof
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setHabitRequirePhoto(prev => !prev);
                          Keyboard.dismiss();
                        }}
                        style={{
                          width: 44,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: habitRequirePhoto ? '#00ACC1' : '#f0f0f0',
                          justifyContent: 'center',
                          alignItems: 'center',
                          paddingHorizontal: 2,
                          flexShrink: 0,
                        }}
                      >
                        <View style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: 'white',
                          transform: [{ translateX: habitRequirePhoto ? 10 : -10 }],
                        }} />
                </TouchableOpacity>
                    </View>
                  </View>
                <View style={{ gap: 20 }}>
                  {/* Reminder */}
                  <View>
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      marginBottom: 0,
              }}>
                <Text style={{
                  fontSize: 14,
                  color: '#333',
                        fontFamily: 'Onest',
                        fontWeight: '500'
                }}>
                        Reminder
                </Text>
                <TouchableOpacity
                  onPress={() => {
                          setShowHabitReminderPicker(prev => !prev);
                          Keyboard.dismiss();
                  }}
                  style={{
                    backgroundColor: '#f8f9fa',
                    borderRadius: 8,
                          paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                          borderColor: showHabitReminderPicker ? '#00ACC1' : '#f0f0f0',
                  }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ 
                              fontSize: 14, 
                              color: '#333',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                            {habitReminderTime ? moment(habitReminderTime).format('h:mm A') : 'No reminder'}
                            </Text>
                    </View>
                      </TouchableOpacity>
                    </View>

                    {showHabitReminderPicker && (
                      <View style={{
                        backgroundColor: '#f8f9fa',
                        borderRadius: 8,
                        padding: 8,
                        marginTop: 4,
                        borderWidth: 1,
                        borderColor: '#e0e0e0',
                      }}>
                        <DateTimePicker
                          value={habitReminderTime instanceof Date ? habitReminderTime : new Date()}
                          mode="time"
                          display="spinner"
                          onChange={(event, selectedTime) => {
                            if (selectedTime) {
                              // Create a new date with today's date and the selected time
                              const today = new Date();
                              const timeOnly = new Date(selectedTime);
                              const combinedDateTime = new Date(
                                today.getFullYear(),
                                today.getMonth(),
                                today.getDate(),
                                timeOnly.getHours(),
                                timeOnly.getMinutes()
                              );
                              setHabitReminderTime(combinedDateTime);
                            }
                          }}
                          style={{
                            height: 80,
                            width: '100%',
                          }}
                          textColor="#333"
                        />
                        
                    <View style={{ 
                      flexDirection: 'row', 
                          justifyContent: 'flex-end',
                          marginTop: 8,
                        }}>
                        <TouchableOpacity
                            onPress={() => {
                              setHabitReminderTime(null);
                              setShowHabitReminderPicker(false);
                              Keyboard.dismiss();
                          }}
                          style={{
                              backgroundColor: 'transparent',
                            paddingHorizontal: 12,
                              paddingVertical: 6,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{
                              fontSize: 12,
                              color: '#FF6B6B',
                            fontFamily: 'Onest',
                              fontWeight: '500'
                          }}>
                              Clear
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  </View>
                </View>
              </View>
            </ScrollView>
            </TouchableWithoutFeedback>
          </View>
        </SafeAreaView>
      </Modal>

      {/* DateTimePicker for end date */}
      <DateTimePickerModal
        isVisible={showRepeatEndDatePicker}
        mode="date"
        onConfirm={(date) => {
          setRepeatEndDate(date);
          setShowRepeatEndDatePicker(false);
        }}
        onCancel={() => setShowRepeatEndDatePicker(false)}
        minimumDate={new Date()}
      />

      {/* Notes Modal - REMOVED */}

      {/* Photo Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isPhotoModalVisible}
        onRequestClose={() => {
          setIsPhotoModalVisible(false);
          setSelectedHabitForPhoto(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <View style={{ flex: 1 }} />
          <View style={{ 
            backgroundColor: '#fafafa',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
            paddingBottom: 20,
          }}>
            {/* Header */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              paddingHorizontal: 20,
            }}>
              <TouchableOpacity 
                onPress={() => {
                  setIsPhotoModalVisible(false);
                  setSelectedHabitForPhoto(null);
                }}
                style={{
                  padding: 4,
                }}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
              
              <Text style={{ 
                fontSize: 16, 
                fontWeight: '600', 
                color: '#333',
                fontFamily: 'Onest'
              }}>
                Add Photo
              </Text>
              
              <View style={{ width: 28 }} />
            </View>

            {/* Content */}
            <View style={{ padding: 20 }}>
              <View style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const { status } = await ImagePicker.requestCameraPermissionsAsync();
                      if (status !== 'granted') {
                        Alert.alert('Permission Required', 'Camera permission is required to take a photo.');
                        return;
                      }

                      const result = await ImagePicker.launchCameraAsync({
                        allowsEditing: true,
                        aspect: [4, 3],
                        quality: 0.8,
                      });

                      if (!result.canceled && result.assets[0] && selectedHabitForPhoto) {
                        const today = moment().format('YYYY-MM-DD');
                        await addPhotoToHabit(selectedHabitForPhoto.id, today, result.assets[0].uri);
                        setIsPhotoModalVisible(false);
                        setSelectedHabitForPhoto(null);
                      }
                    } catch (error) {
                      console.error('Error taking photo:', error);
                      Alert.alert('Error', 'Failed to take photo. Please try again.');
                    }
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    backgroundColor: 'white',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#e0e0e0',
                  }}
                >
                  <Ionicons name="camera" size={24} color="#00ACC1" style={{ marginRight: 12 }} />
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: '#333',
                    fontFamily: 'Onest',
                  }}>
                    Take Photo
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (status !== 'granted') {
                        Alert.alert('Permission Required', 'Media library permission is required to select an image.');
                        return;
                      }

                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        allowsEditing: true,
                        aspect: [4, 3],
                        quality: 0.8,
                      });

                      if (!result.canceled && result.assets[0] && selectedHabitForPhoto) {
                        const today = moment().format('YYYY-MM-DD');
                        await addPhotoToHabit(selectedHabitForPhoto.id, today, result.assets[0].uri);
                        setIsPhotoModalVisible(false);
                        setSelectedHabitForPhoto(null);
                      }
                    } catch (error) {
                      console.error('Error selecting image:', error);
                      Alert.alert('Error', 'Failed to select image. Please try again.');
                    }
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    backgroundColor: 'white',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#e0e0e0',
                  }}
                >
                  <Ionicons name="images" size={24} color="#4CAF50" style={{ marginRight: 12 }} />
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: '#333',
                    fontFamily: 'Onest',
                  }}>
                    Choose from Gallery
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo Viewer Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isPhotoViewerVisible}
        onRequestClose={() => {
          setIsPhotoViewerVisible(false);
          setSelectedPhotoForViewing(null);
          setAllPhotosForViewing([]);
          setCurrentPhotoIndex(0);
        }}
      >
          <View style={{ 
          flex: 1, 
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          justifyContent: 'center',
              alignItems: 'center', 
            }}>
          {selectedPhotoForViewing && (
            <>
              {/* Close Button */}
              <TouchableOpacity 
                onPress={() => {
                  setIsPhotoViewerVisible(false);
                  setSelectedPhotoForViewing(null);
                  setAllPhotosForViewing([]);
                  setCurrentPhotoIndex(0);
                }}
                style={{
                  position: 'absolute',
                  top: 50,
                  right: 20,
                  zIndex: 10,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              
              {/* Navigation Buttons */}
              {allPhotosForViewing.length > 1 && (
                <>
                  {/* Previous Button */}
                  {currentPhotoIndex > 0 && (
              <TouchableOpacity 
                onPress={() => {
                        const newIndex = currentPhotoIndex - 1;
                        setCurrentPhotoIndex(newIndex);
                        setSelectedPhotoForViewing(allPhotosForViewing[newIndex]);
                }}
                style={{
                        position: 'absolute',
                        left: 20,
                        top: '50%',
                        transform: [{ translateY: -20 }],
                        zIndex: 10,
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="chevron-back" size={24} color="white" />
              </TouchableOpacity>
                  )}

                  {/* Next Button */}
                  {currentPhotoIndex < allPhotosForViewing.length - 1 && (
                      <TouchableOpacity
                      onPress={() => {
                        const newIndex = currentPhotoIndex + 1;
                        setCurrentPhotoIndex(newIndex);
                        setSelectedPhotoForViewing(allPhotosForViewing[newIndex]);
                      }}
                        style={{
                        position: 'absolute',
                        right: 20,
                        top: '50%',
                        transform: [{ translateY: -20 }],
                        zIndex: 10,
                        width: 40,
                        height: 40,
                          borderRadius: 20,
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="chevron-forward" size={24} color="white" />
                      </TouchableOpacity>
                  )}
                </>
              )}

              {/* Photo */}
              <Image
                source={{ uri: selectedPhotoForViewing.photoUrl }}
                style={{
                  width: '90%',
                  height: '70%',
                            borderRadius: 12,
                  resizeMode: 'contain',
                }}
              />

              {/* Photo Counter */}
              {allPhotosForViewing.length > 1 && (
                <View style={{
                  position: 'absolute',
                  top: 50,
                  left: 20,
                  zIndex: 10,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}>
                              <Text style={{ 
                    color: 'white',
                                fontSize: 14, 
                                fontWeight: '600',
                    fontFamily: 'Onest',
                  }}>
                    {currentPhotoIndex + 1} of {allPhotosForViewing.length}
                              </Text>
                            </View>
              )}

              {/* Photo Info */}
                                  <View style={{
                position: 'absolute',
                bottom: 50,
                left: 20,
                right: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: 12,
                padding: 16,
                          }}>
                              <Text style={{ 
                  color: 'white',
                  fontSize: 18,
                                fontWeight: '600', 
                  fontFamily: 'Onest',
                  marginBottom: 4,
                              }}>
                  {selectedPhotoForViewing.habit.text}
                              </Text>
                              <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.8)',
                                fontSize: 14, 
                              fontFamily: 'Onest',
                            }}>
                  {selectedPhotoForViewing.formattedDate}
                            </Text>
                            </View>
            </>
          )}
        </View>
      </Modal>

      {/* Write Note Modal - REMOVED */}

      {/* Notes Viewer Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isNotesViewerModalVisible}
        onRequestClose={() => {
          setIsNotesViewerModalVisible(false);
          setSelectedHabitForViewingNotes(null);
          setEditingNoteInViewer(null);
          setEditingNoteText('');
        }}
      >
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 50}
        >
          <TouchableWithoutFeedback onPress={() => {
            setIsNotesViewerModalVisible(false);
            setSelectedHabitForViewingNotes(null);
            setEditingNoteInViewer(null);
            setEditingNoteText('');
          }}>
          <View style={{ 
          flex: 1, 
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
              justifyContent: 'flex-start',
              alignItems: 'center',
              paddingTop: 100,
        }}>
              <TouchableWithoutFeedback onPress={() => {}}>
            <View style={{ 
                    backgroundColor: 'white', 
            borderRadius: 12,
                  width: 320,
                  maxHeight: '60%',
                    shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
                    shadowRadius: 8,
            elevation: 8,
            overflow: 'hidden',
          }}>
            
            {/* Modal Header */}
                  <View style={{ 
              flexDirection: 'row', 
                    alignItems: 'center',
              justifyContent: 'space-between', 
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#f0f0f0',
            }}>
                          <Text style={{ 
                fontSize: 14,
                            fontWeight: '600', 
                            color: '#333', 
                            fontFamily: 'Onest',
                            flex: 1,
                          }}>
                {selectedHabitForViewingNotes?.text}
                          </Text>
              
              <TouchableOpacity 
                onPress={() => {
                  setIsNotesViewerModalVisible(false);
                  setSelectedHabitForViewingNotes(null);
                  setEditingNoteInViewer(null);
                  setEditingNoteText('');
                }}
                style={{
                  padding: 4,
                }}
              >
                <Ionicons name="close" size={16} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Note Editor */}
            <TextInput
              style={{
                            flex: 1,
                            fontSize: 14, 
                color: '#000',
                lineHeight: 20,
                padding: 16,
                textAlignVertical: 'top',
                fontFamily: 'Onest',
                minHeight: 120,
                      maxHeight: 200,
              }}
              placeholder="Start writing..."
              placeholderTextColor="#999"
              value={editingNoteText}
              onChangeText={setEditingNoteText}
              multiline
              textAlignVertical="top"
            />
            
            {/* Save Button */}
                        <View style={{ 
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: '#f0f0f0',
              alignItems: 'flex-end',
            }}>
              <TouchableOpacity
                onPress={async () => {
                  if (editingNoteText.trim() && selectedHabitForViewingNotes) {
                    // Get the most recent note date or use today's date
                    const notes = selectedHabitForViewingNotes.notes || {};
                    const noteDates = Object.keys(notes);
                    const noteDate = noteDates.length > 0 ? noteDates[0] : moment().format('YYYY-MM-DD');
                    
                    await updateExistingNote(selectedHabitForViewingNotes.id, noteDate, editingNoteText.trim());
                    setIsNotesViewerModalVisible(false);
                    setSelectedHabitForViewingNotes(null);
                    setEditingNoteInViewer(null);
                    setEditingNoteText('');
                  }
                }}
                style={{
                                      backgroundColor: editingNoteText.trim() ? '#00ACC1' : '#f0f0f0',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                }}
              >
              <Text style={{ 
                  fontSize: 14,
                fontWeight: '600', 
                  color: editingNoteText.trim() ? 'white' : '#999',
                  fontFamily: 'Onest',
              }}>
                  Save
              </Text>
              </TouchableOpacity>
            </View>
          </View>
              </TouchableWithoutFeedback>
        </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Professional Habit Note Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isHabitLogModalVisible}
        onRequestClose={() => {
          setIsHabitLogModalVisible(false);
          setSelectedHabitForLog(null);
          setLogNoteText('');
          setLogDate(moment().format('YYYY-MM-DD'));
        }}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
          <KeyboardAvoidingView 
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <View style={{ flex: 1 }}>
              {/* Minimalistic Header */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                paddingHorizontal: 24,
                paddingVertical: 20,
                paddingTop: 24,
                backgroundColor: '#ffffff',
              }}>
                <TouchableOpacity 
                  onPress={() => {
                    setIsHabitLogModalVisible(false);
                    setSelectedHabitForLog(null);
                    setLogNoteText('');
                    setLogDate(moment().format('YYYY-MM-DD'));
                  }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <Ionicons name="close" size={16} color="#64748b" />
                </TouchableOpacity>
                
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ 
                    fontSize: 16, 
                    fontWeight: '600', 
                    color: '#1e293b',
                    fontFamily: 'Onest',
                    textAlign: 'center',
                  }}>
                    {selectedHabitForLog?.text}
                  </Text>
                  <Text style={{ 
                    fontSize: 13, 
                    color: '#64748b',
                    fontFamily: 'Onest',
                    marginTop: 4,
                  }}>
                    {moment(logDate).format('MMMM D, YYYY')}
                  </Text>
                </View>
                
                <TouchableOpacity
                  onPress={() => {
                    if (selectedHabitForLog && logNoteText.trim()) {
                      if (selectedHabitForLog.notes && selectedHabitForLog.notes[logDate]) {
                        updateExistingNote(selectedHabitForLog.id, logDate, logNoteText.trim());
                      } else {
                        addNoteToHabit(selectedHabitForLog.id, logDate, logNoteText.trim());
                      }
                      setIsHabitLogModalVisible(false);
                      setSelectedHabitForLog(null);
                      setLogNoteText('');
                      setLogDate(moment().format('YYYY-MM-DD'));
                    }
                  }}
                  disabled={!logNoteText.trim()}
                  style={{
                    backgroundColor: logNoteText.trim() ? '#00ACC1' : '#f1f5f9',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    minWidth: 50,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ 
                    color: logNoteText.trim() ? '#ffffff' : '#94a3b8', 
                    fontSize: 14, 
                    fontWeight: '600', 
                    fontFamily: 'Onest' 
                  }}>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Content */}
              <ScrollView 
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Photo Display Section */}
                {selectedHabitForLog?.photos?.[logDate] && (
                  <View style={{ 
                    marginBottom: 20,
                    backgroundColor: '#f8fafc',
                    borderRadius: 12,
                    padding: 16,
                  }}>

                    <TouchableOpacity
                      onPress={() => {
                        if (selectedHabitForLog?.photos?.[logDate]) {
                          setAllPhotosForViewing([{
                            habit: selectedHabitForLog,
                            photoUrl: selectedHabitForLog.photos[logDate],
                            date: logDate,
                            formattedDate: moment(logDate).format('MMMM D, YYYY'),
                          }]);
                          setCurrentPhotoIndex(0);
                          setIsHabitLogModalVisible(false);
                          setIsPhotoViewerVisible(true);
                        }
                      }}
                    >
                      <Image
                        source={{ uri: selectedHabitForLog.photos[logDate] }}
                        style={{
                          width: '100%',
                          height: 200,
                          borderRadius: 12,
                          backgroundColor: '#f8f9fa',
                        }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Note Input Section */}
                <View style={{ 
                  marginBottom: 20,
                  backgroundColor: '#f8fafc',
                  borderRadius: 12,
                  padding: 16,
                }}>
                  <TextInput
                    style={{
                      fontSize: 15,
                      color: '#1e293b',
                      padding: 0,
                      borderRadius: 8,
                      fontFamily: 'Onest',
                      minHeight: 120,
                      textAlignVertical: 'top',
                    }}
                    value={logNoteText}
                    onChangeText={setLogNoteText}
                    placeholder="Share your thoughts, progress, or insights for this day..."
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={6}
                  />
                </View>

                {/* Photo Actions Section */}
                <View style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: 12,
                  padding: 16,
                }}>
                  
                  <View style={{
                    flexDirection: 'row',
                    gap: 16,
                  }}>
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          const { status } = await ImagePicker.requestCameraPermissionsAsync();
                          if (status !== 'granted') {
                            Alert.alert('Permission Required', 'Camera permission is required to take a photo.');
                            return;
                          }

                          const result = await ImagePicker.launchCameraAsync({
                            allowsEditing: true,
                            aspect: [4, 3],
                            quality: 0.8,
                          });

                          if (!result.canceled && result.assets[0] && selectedHabitForLog) {
                            await addPhotoToHabit(selectedHabitForLog.id, logDate, result.assets[0].uri);
                            Alert.alert('Success', 'Photo added successfully!');
                          }
                        } catch (error) {
                          console.error('Error taking photo:', error);
                          Alert.alert('Error', 'Failed to take photo. Please try again.');
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 10,
                        alignItems: 'center',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <Ionicons name="camera" size={20} color="#00ACC1" />
                      <Text style={{
                        fontSize: 13,
                        color: '#475569',
                        fontFamily: 'Onest',
                        marginTop: 6,
                        fontWeight: '500',
                      }}>
                        Camera
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                          if (status !== 'granted') {
                            Alert.alert('Permission Required', 'Media library permission is required to select an image.');
                            return;
                          }

                          const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            allowsEditing: true,
                            aspect: [4, 3],
                            quality: 0.8,
                          });

                          if (!result.canceled && result.assets[0] && selectedHabitForLog) {
                            await addPhotoToHabit(selectedHabitForLog.id, logDate, result.assets[0].uri);
                            Alert.alert('Success', 'Photo added successfully!');
                          }
                        } catch (error) {
                          console.error('Error selecting image:', error);
                          Alert.alert('Error', 'Failed to select image. Please try again.');
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 10,
                        alignItems: 'center',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <Ionicons name="images" size={20} color="#00ACC1" />
                      <Text style={{
                        fontSize: 13,
                        color: '#475569',
                        fontFamily: 'Onest',
                        marginTop: 6,
                        fontWeight: '500',
                      }}>
                        Gallery
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Monthly Progress Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isMonthlyProgressModalVisible}
        onRequestClose={() => setIsMonthlyProgressModalVisible(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
          {/* Clean Header */}
          <View style={{
            flexDirection: 'column',
            paddingHorizontal: 24,
            paddingVertical: 20,
            paddingTop: 24,
            backgroundColor: '#ffffff',
          }}>
            {/* Top Row with Close Button and Month Navigation */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 25,
              marginTop: 10,
            }}>
              <TouchableOpacity
                onPress={() => setIsMonthlyProgressModalVisible(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="close" size={16} color="#64748b" />
              </TouchableOpacity>
              
              {/* Month Navigation */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
              }}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedMonthForProgress(prev => prev.clone().subtract(1, 'month'));
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <Ionicons name="chevron-back" size={18} color="#64748b" />
                </TouchableOpacity>
                
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#1e293b',
                  fontFamily: 'Onest',
                  minWidth: 120,
                  textAlign: 'center',
                }}>
                  {selectedMonthForProgress.format('MMMM YYYY')}
                </Text>
                
                <TouchableOpacity
                  onPress={() => {
                    const nextMonth = selectedMonthForProgress.clone().add(1, 'month');
                    if (nextMonth.isSameOrBefore(moment(), 'month')) {
                      setSelectedMonthForProgress(nextMonth);
                    }
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: '#f8fafc',
                    opacity: selectedMonthForProgress.clone().add(1, 'month').isAfter(moment(), 'month') ? 0.5 : 1,
                  }}
                >
                  <Ionicons name="chevron-forward" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>
              
              <View style={{ width: 32 }} />
            </View>
          </View>

          {/* Organized Content */}
          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 0 }}
            showsVerticalScrollIndicator={false}
          >
            {habits.length === 0 ? (
              <View style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                paddingVertical: 60,
              }}>
                <Ionicons name="calendar-outline" size={48} color="#cbd5e1" />
                <Text style={{
                  fontSize: 16,
                  color: '#64748b',
                  fontFamily: 'Onest',
                  marginTop: 180,
                  textAlign: 'center',
                }}>
                  No habits to track yet
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: '#94a3b8',
                  fontFamily: 'Onest',
                  marginTop: 8,
                  textAlign: 'center',
                }}>
                  Create some habits to see your monthly progress
                </Text>
              </View>
            ) : (
              // Monthly view - separate containers for each habit
              habits.map((habit) => {
                const progress = calculateHabitProgressForMonth(habit, selectedMonthForProgress);
                const completedDays = habit.completedDays || [];
                const notes = habit.notes || {};
                const photos = habit.photos || {};
                
                return (
                  <View key={habit.id} style={{ 
                    backgroundColor: '#ffffff',
                    borderRadius: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    elevation: 3,
                    overflow: 'hidden',
                    marginBottom: 20,
                  }}>
                    {/* Habit Header */}
                    <View style={{
                      paddingHorizontal: 40,
                      paddingBottom: 5,
                    }}>
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 5,
                      }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{
                            fontSize: 15,
                            fontWeight: '600',
                            color: '#1e293b',
                            fontFamily: 'Onest',
                          }}>
                            {habit.text}
                          </Text>
                          {habit.description && (
                            <Text style={{
                              fontSize: 14,
                              color: '#64748b',
                              fontFamily: 'Onest',
                              lineHeight: 18,
                            }}>
                              {habit.description}
                            </Text>
                          )}
                        </View>
                        
                        <View style={{
                        }}>
                          <Text style={{
                            fontSize: 15,
                            fontWeight: '700',
                            color: habit.color,
                            fontFamily: 'Onest',
                          }}>
                            {progress.percentage.toFixed(0)}%
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Calendar Section */}
                    <View style={{ padding: 0, paddingTop: 0 }}>
                    <View style={{
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
  backgroundColor: 'transparent',
  maxWidth: 330,
}}>
                      {(() => {
  // Minimalistic, 3-row grid for the month
  const monthStart = selectedMonthForProgress.clone().startOf('month');
  const daysInMonth = selectedMonthForProgress.daysInMonth();
  const daysPerRow = Math.ceil(daysInMonth / 3);
  const rows: JSX.Element[][] = [[], [], []];
  for (let i = 0; i < daysInMonth; i++) {
    const currentDate = monthStart.clone().add(i, 'days');
    const dateStr = currentDate.format('YYYY-MM-DD');
    const hasNote = habit.notes?.[dateStr];
    const hasPhoto = habit.photos?.[dateStr];
    const isCompleted = completedDays.includes(dateStr) || !!hasNote || !!hasPhoto;
    const isToday = currentDate.isSame(moment(), 'day');
    let backgroundColor = 'transparent';
    let borderColor = '#e5e7eb';
    let textColor = '#64748b';
    if (isCompleted) {
      backgroundColor = 'rgba(0,172,193,0.10)';
      borderColor = '#00ACC1';
      textColor = '#00ACC1';
    } else if (isToday) {
      backgroundColor = '#e0f7fa';
      borderColor = '#00ACC1';
      textColor = '#00695c';
    }
    const rowIdx = Math.floor(i / daysPerRow);
    rows[rowIdx].push(
      <TouchableOpacity
        key={dateStr}
        onPress={() => {
          setSelectedDateData({
            habit,
            date: dateStr,
            formattedDate: currentDate.format('MMMM D, YYYY'),
            note: hasNote || undefined,
            photo: hasPhoto || undefined,
            isCompleted
          });
          setIsMonthlyProgressModalVisible(false);
          setIsDetailModalVisible(true);
        }}
        style={{
          width: 28,
          height: 28,
          borderRadius: 5,
          backgroundColor: hasPhoto ? 'transparent' : backgroundColor,
          borderWidth: hasPhoto ? 0 : (isCompleted ? 0 : 1),
          borderColor,
          justifyContent: 'center',
          alignItems: 'center',
          margin: 1,
          overflow: 'hidden',
        }}
      >
        {hasPhoto && (
          <Image
            source={{ uri: hasPhoto }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              borderRadius: 5,
            }}
            resizeMode="cover"
          />
        )}
        {!hasPhoto && (
          <Text style={{
            fontSize: 13,
            fontWeight: '500',
            color: textColor,
            fontFamily: 'Onest',
          }}>
            {currentDate.format('D')}
          </Text>
        )}
      </TouchableOpacity>
    );
  }
  return rows.map((row, idx) => (
    <View key={idx} style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 2, marginLeft: 170, }}>
      {row}
    </View>
  ));
})()}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      
      {/* Detail Modal for Heatmap Dates */}
      <Modal
        visible={isDetailModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDetailModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 0,
            margin: 20,
            width: '90%',
            maxHeight: '85%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 10,
            overflow: 'hidden',
          }}>
            {selectedDateData && (
              <>
                {/* Header */}
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 24,
                  paddingTop: 24,
                  paddingBottom: 20,
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: '#1e293b',
                      fontFamily: 'Onest',
                      marginBottom: 6,
                    }}>
                      {selectedDateData.habit.text}
                    </Text>
                    <Text style={{
                      fontSize: 15,
                      color: '#64748b',
                      fontFamily: 'Onest',
                      fontWeight: '500',
                    }}>
                      {selectedDateData.formattedDate}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    onPress={() => {
                      setIsDetailModalVisible(false);
                      setIsMonthlyProgressModalVisible(true);
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginTop: -8,
                    }}
                  >
                    <Ionicons name="close" size={18} color="#64748b" />
                  </TouchableOpacity>
                </View>
                
                {/* Content Container */}
                <View style={{ paddingHorizontal: 24, paddingVertical: 20 }}>

                
                  {/* Photo */}
                  {selectedDateData.photo && (
                    <View style={{ marginBottom: 16 }}>
                      <TouchableOpacity
                        onPress={() => {
                          // Show photo in full screen
                          if (selectedDateData.photo) {
                            setAllPhotosForViewing([{
                              habit: selectedDateData.habit,
                              photoUrl: selectedDateData.photo,
                              date: selectedDateData.date,
                              formattedDate: selectedDateData.formattedDate,
                            }]);
                            setCurrentPhotoIndex(0);
                            setIsDetailModalVisible(false);
                            setIsPhotoViewerVisible(true);
                          }
                        }}
                        style={{
                          borderRadius: 16,
                          overflow: 'hidden',
                          backgroundColor: '#f8fafc',
                        }}
                      >
                        <Image
                          source={{ uri: selectedDateData.photo }}
                          style={{
                            width: '100%',
                            height: 220,
                            borderRadius: 16,
                          }}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                
                  {/* Note */}
                  {selectedDateData.note && (
                    <View style={{ marginBottom: 30 }}>
                      <View style={{
                        borderRadius: 16,
                        paddingLeft: 5,
                      }}>
                        <Text style={{
                          fontSize: 15,
                          color: '#334155',
                          fontFamily: 'Onest',
                          lineHeight: 20,
                        }}>
                          {selectedDateData.note}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* If no data, show a message */}
                  {!selectedDateData.isCompleted && !selectedDateData.note && !selectedDateData.photo && (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                      <Text style={{
                        fontSize: 16,
                        color: '#94a3b8',
                        fontFamily: 'Onest',
                        textAlign: 'center',
                        fontWeight: '500',
                      }}>
                        No activity, note, or photo for this date.
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

