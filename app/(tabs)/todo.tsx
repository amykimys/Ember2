import React, { useCallback, useMemo, useRef } from 'react';
import 'react-native-reanimated'; // 👈 must be FIRST import
import { Menu } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../supabase';
import { User } from '@supabase/supabase-js';
import { Session } from '@supabase/supabase-js';
import { useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  ActionSheetIOS,
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
  GestureResponderEvent,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PanGestureHandler, GestureHandlerRootView, State, Swipeable } from 'react-native-gesture-handler';
import styles from '../../styles/todo.styles';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import { Picker } from '@react-native-picker/picker';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import NetInfo from '@react-native-community/netinfo';
import { Animated } from 'react-native';
import CalendarStrip from 'react-native-calendar-strip';
import moment from 'moment';
import 'moment/locale/en-gb';
import { Pressable } from 'react-native';
import MonthlyCalendar from '../components/MonthlyCalendar';
import { useRouter } from 'expo-router';
import Calendar from 'react-native-calendars';



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
  pastel: ['#FADADD', '#FFE5B4', '#FFFACD', '#D0F0C0', '#B0E0E6', '#D8BFD8', '#F0D9FF', '#C1E1C1']
,
  forest: ['#4B6B43', '#7A9D54', '#A7C957', '#DDE26A', '#B49F73', '#856D5D', '#5C4033', '#E4D6A7'],

  dreamscape: ['#E0F7FA', '#E1F5FE', '#D1C4E9', '#F3E5F5', '#F0F4C3', '#D7CCC8', '#C5CAE9', '#E8EAF6'],
  
  coastal: ['#A7D7C5', '#CFE8E0', '#BFDCE5', '#8AC6D1', '#DCE2C8', '#F1F6F9', '#A2C4C9', '#F7F5E6']
,

  autumnglow: ['#FFB347', '#D2691E', '#FFD700', '#B22222', '#CD853F', '#FFA07A', '#8B4513', '#F4A460']
,

  cosmicjelly: ['#F15BB5', '#FEE440', '#00BBF9', '#00F5D4', '#FF99C8', '#FCF6BD', '#D0F4DE', '#E4C1F9'], 
bloom: ['#FF69B4', '#FFD700', '#7FFF00', '#FF8C00', '#00CED1', '#BA55D3', '#FFA07A', '#40E0D0']
,

vintagepicnic: ['#F67280', '#C06C84', '#F8B195', '#355C7D', '#6C5B7B', '#FDCB82', '#99B898', '#FF847C']
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
    const habitDate = moment(date, 'YYYY-MM-DD');
    return habitDate.isBetween(weekStart, weekEnd, 'day', '[]');
  }).length;
  
  const target = habit.targetPerWeek || 7;
  const percentage = Math.min((completedThisWeek / target) * 100, 100);

  return percentage;
};

// Helper function to calculate current streak
const calculateCurrentStreak = (completedDays: string[]): number => {
  if (!completedDays || completedDays.length === 0) return 0;
  
  // Sort completed days in descending order (most recent first)
  const sortedDays = [...completedDays].sort((a, b) => moment(b).valueOf() - moment(a).valueOf());
  
  let streak = 0;
  const today = moment().format('YYYY-MM-DD');
  const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
  
  // Check if today is completed
  if (sortedDays.includes(today)) {
    streak = 1;
    let currentDate = moment(yesterday);
    
    // Count consecutive days backwards from yesterday
    while (sortedDays.includes(currentDate.format('YYYY-MM-DD'))) {
      streak++;
      currentDate = currentDate.subtract(1, 'day');
    }
  } else {
    // Today is not completed, check if yesterday is completed
    if (sortedDays.includes(yesterday)) {
      streak = 1;
      let currentDate = moment().subtract(2, 'day');
      
      // Count consecutive days backwards from day before yesterday
      while (sortedDays.includes(currentDate.format('YYYY-MM-DD'))) {
        streak++;
        currentDate = currentDate.subtract(1, 'day');
      }
    }
  }
  
  return streak;
};

export default function TodoScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'habits'>('tasks');
  const [newTodo, setNewTodo] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#E3F2FD');
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateButtonLayout, setDateButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const dateButtonRef = useRef<View>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const [showInlineEndDatePicker, setShowInlineEndDatePicker] = useState(false);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);

  // Habit modal state
  const [isNewHabitModalVisible, setIsNewHabitModalVisible] = useState(false);
  const [newHabit, setNewHabit] = useState('');
  const [newHabitDescription, setNewHabitDescription] = useState('');
  const [newHabitColor, setNewHabitColor] = useState('#A0C3B2');
  // Add new habit reminder and photo proof state
  const [habitReminderTime, setHabitReminderTime] = useState<Date | null>(null);
  const [showHabitReminderPicker, setShowHabitReminderPicker] = useState(false);
  const [habitRequirePhoto, setHabitRequirePhoto] = useState(false);
  const [habitTargetPerWeek, setHabitTargetPerWeek] = useState(7);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

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

  const resetForm = () => {
    setNewTodo('');
    setNewDescription('');
    setSelectedCategoryId('');
    setShowNewCategoryInput(false);
    setNewCategoryName('');
    setNewCategoryColor('#E3F2FD');
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
  };

  async function scheduleReminderNotification(taskTitle: string, reminderTime: Date) {
    try {
      const secondsUntilReminder = Math.floor((reminderTime.getTime() - Date.now()) / 1000);
  
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Reminder",
          body: taskTitle,
          sound: true,
        },
        trigger: {
          type: 'timeInterval',
          seconds: secondsUntilReminder,
          repeats: false,
        } as Notifications.TimeIntervalTriggerInput,
      });
  
    } catch (error) {
    }
  }

  const checkCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: categoriesData, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error checking categories:', error);
        return;
      }

    } catch (error) {
      console.error('Error in checkCategories:', error);
    }
  };

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
      
      // Save task to Supabase
      const { error: taskError } = await supabase
        .from('todos')
        .insert({
          id: newTodoItem.id,
          text: newTodoItem.text,
          description: newTodoItem.description,
          completed: newTodoItem.completed,
          category_id: validCategoryId,
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
        Alert.alert('Error', 'Failed to save task. Please try again.');
        return;
      }
      
      // Update local state with new task
      setTodos(prev => [...prev, newTodoItem]);
      
      // Schedule reminder if set
      if (reminderTime) {
        await scheduleReminderNotification(newTodo.trim(), reminderTime);
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
    
        setTodos(prev =>
          prev.map(todo => (todo.id === editingTodo.id ? updatedTodo : todo))
        );
    
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
                type: 'task'
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
        }
    
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
      setTodos(prev => prev.map(todo => 
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      ));
      
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
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        Alert.alert('Error', 'You must be logged in to update habits.');
        return;
      }

      // Find the habit to toggle
      const habitToToggle = habits.find(habit => habit.id === habitId);
      if (!habitToToggle) {
        console.error('Habit not found');
        return;
      }

      const today = moment().format('YYYY-MM-DD');
      const currentCompletedDays = habitToToggle.completedDays || [];
      const isCompletedToday = currentCompletedDays.includes(today);
      
      // If trying to complete a habit that requires photo, check if photo exists
      if (!isCompletedToday && habitToToggle.requirePhoto) {
        const currentPhotos = habitToToggle.photos || {};
        if (!currentPhotos[today]) {
          Alert.alert(
            'Photo Required',
            'This habit requires a photo to be completed.',
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
                      // Image was taken, now complete the habit
                      await completeHabitWithPhoto(habitId, result.assets[0].uri, today);
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
                      // Image was selected, now complete the habit
                      await completeHabitWithPhoto(habitId, result.assets[0].uri, today);
                    }
                  } catch (error) {
                    console.error('Error selecting image:', error);
                    Alert.alert('Error', 'Failed to select image. Please try again.');
                  }
                },
              },
            ]
          );
          return;
        }
      }

      // If completing a habit (not uncompleting), ask for notes
      if (!isCompletedToday) {
        Alert.prompt(
          'Add a note (optional)',
          'How did it go today?',
          [
            { text: 'Skip', style: 'cancel' },
            {
              text: 'Complete',
              onPress: (noteText) => {
                if (noteText && noteText.trim()) {
                  completeHabitWithNote(habitId, today, noteText.trim());
                } else {
                  completeHabit(habitId, today, isCompletedToday);
                }
              },
            },
          ],
          'plain-text'
        );
      } else {
        // Regular habit completion (no photo required or photo already exists)
        await completeHabit(habitId, today, isCompletedToday);
      }
    } catch (error) {
      console.error('Error in toggleHabit:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const completeHabit = async (habitId: string, today: string, isCompletedToday: boolean) => {
    try {
      const habitToToggle = habits.find(habit => habit.id === habitId);
      if (!habitToToggle) return;

      const currentCompletedDays = habitToToggle.completedDays || [];
      let newCompletedDays;
      
      if (isCompletedToday) {
        // Remove today from completed days
        newCompletedDays = currentCompletedDays.filter(date => date !== today);
      } else {
        // Add today to completed days
        newCompletedDays = [...currentCompletedDays, today];
      }

      // Update in Supabase
      const { error } = await supabase
        .from('habits')
        .update({ completed_days: newCompletedDays })
        .eq('id', habitId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error updating habit in Supabase:', error);
        Alert.alert('Error', 'Failed to update habit. Please try again.');
        return;
      }

      // Update local state
      setHabits(prev => prev.map(habit => 
        habit.id === habitId 
          ? { 
              ...habit, 
              completedDays: newCompletedDays,
              completedToday: !isCompletedToday,
              streak: calculateCurrentStreak(newCompletedDays)
            } 
          : habit
      ));
      
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error in completeHabit:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const uploadHabitPhoto = async (photoUri: string, habitId: string, date: string): Promise<string> => {
    try {
      // Convert image to blob
      const response = await fetch(photoUri);
      const blob = await response.blob();
      
      // Create a unique filename
      const fileExt = photoUri.split('.').pop() || 'jpg';
      const fileName = `${habitId}/${date}_${Date.now()}.${fileExt}`;
      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('habit-photos')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('📸 Upload error:', uploadError);
        throw uploadError;
      }
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('habit-photos')
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
      const newCompletedDays = [...currentCompletedDays, today];

      // Update in Supabase
      const { error } = await supabase
        .from('habits')
        .update({ 
          completed_days: newCompletedDays,
          photos: updatedPhotos
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
      
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      Alert.alert('Success', 'Habit completed with photo!');
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
          notes: updatedNotes
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
      
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error in completeHabitWithNote:', error);
      Alert.alert('Error', 'Failed to save note. Please try again.');
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

        // Delete from Supabase
        const { data: deletedTask, error } = await supabase
          .from('todos')
          .delete()
          .eq('id', todo.id)
          .eq('user_id', user.id)
          .select();

        if (error) {
          console.error('Error deleting task:', error);
          Alert.alert('Error', 'Failed to delete task. Please try again.');
          return;
        }

        // Update local state
        setTodos(prev => {
          const newTodos = prev.filter(t => t.id !== todo.id);
          return newTodos;
        });

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
  
    const handleEdit = () => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      resetForm(); 
      setEditingTodo(todo);
      setNewTodo(todo.text);
      setNewDescription(todo.description || '');
      setSelectedCategoryId(todo.categoryId || '');
      setTaskDate(todo.date || null);
      setSelectedRepeat(todo.repeat || 'none');
      setRepeatEndDate(todo.repeatEndDate || null);
      setReminderTime(todo.reminderTime || null);
      if (todo.repeat === 'custom' && todo.customRepeatDates) {
        setCustomSelectedDates(todo.customRepeatDates.map(date => date.toISOString().split('T')[0]));
      }
      showModal();
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
            <Ionicons name="checkmark" size={17} color="#3A3A3A"/>
          ) : (
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                borderWidth: 1.4,
                marginLeft: 4,
                borderColor: categories.find(c => c.id === todo.categoryId)
                  ? darkenColor(categories.find(c => c.id === todo.categoryId)!.color)
                  : '#999',
              }}
            />
          )}
        </View>
    
        <View style={styles.todoContent}>
          <Text style={[
            styles.todoText,
            todo.completed && styles.completedText,
            { color: '#3A3A3A', fontFamily: 'Onest' }
          ]}>
            {todo.text}
          </Text>
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
      </TouchableOpacity>
    );
    

    return (
      <Swipeable
        key={todo.id}
        renderRightActions={renderRightActions}
        onSwipeableWillOpen={() => setSwipingTodoId(todo.id)}
        onSwipeableClose={() => {
          requestAnimationFrame(() => {
            setSwipingTodoId(null);
          });
        }}        
        onSwipeableOpen={handleDelete}
        friction={1.5}
        overshootRight={false}
        rightThreshold={30}
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
        .eq('type', 'task') // Only delete task categories
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
    return todos.filter(todo => doesTodoBelongToday(todo, currentDate));
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
      } else if (todo.categoryId && categories.some(cat => cat.id === todo.categoryId)) {
        result[todo.categoryId].push(todo);
      } else {
        result['uncategorized'].push(todo);
      }
    });
    
    return result;
  }, [filteredTodos, categories]);

  // Add fetchData function to centralize data fetching
  const fetchData = async (currentUser?: User | null) => {
    const userToUse = currentUser || user;
    if (!userToUse) {
      return;
    }
    
    setIsLoading(true);
    try {
      // Fetch categories, tasks, and habits in parallel
      const [categoriesResponse, tasksResponse, habitsResponse] = await Promise.all([
        supabase
          .from('categories')
          .select('*')
          .eq('user_id', userToUse.id)
          .eq('type', 'task'),
        supabase
          .from('todos')
          .select('*')
          .eq('user_id', userToUse.id),
        supabase
          .from('habits')
          .select('*')
          .eq('user_id', userToUse.id),
      ]);

      if (categoriesResponse.error) {
        console.error('[Todo] Error fetching categories:', categoriesResponse.error);
        return;
      }

      if (tasksResponse.error) {
        console.error('[Todo] Error fetching tasks:', tasksResponse.error);
        return;
      }

      if (habitsResponse.error) {
        console.error('[Todo] Error fetching habits:', habitsResponse.error);
        return;
      }

      // Update categories
      if (categoriesResponse.data) {
        setCategories(categoriesResponse.data);
      }

      // Update tasks with proper date parsing
      if (tasksResponse.data) {
        const mappedTasks = tasksResponse.data.map(task => ({
          ...task,
          date: new Date(task.date),
          repeatEndDate: task.repeat_end_date ? new Date(task.repeat_end_date) : null,
          reminderTime: task.reminder_time ? new Date(task.reminder_time) : null,
          categoryId: task.category_id || null,
          customRepeatDates: task.custom_repeat_dates
            ? task.custom_repeat_dates.map((dateStr: string) => new Date(dateStr))
            : undefined,
        }));
        setTodos(mappedTasks);
      }

      // Update habits with proper date parsing
      if (habitsResponse.data) {
        const mappedHabits = habitsResponse.data.map(habit => ({
          ...habit,
          completedToday: (habit.completed_days || []).includes(moment().format('YYYY-MM-DD')) || false,
          category_id: habit.category_id || null,
          reminderTime: habit.reminder_time || null,
          requirePhoto: habit.require_photo || false,
          completedDays: habit.completed_days || [],
          notes: habit.notes || {},
          photos: habit.photos || {},
          targetPerWeek: habit.target_per_week || 7,
          streak: calculateCurrentStreak(habit.completed_days || []),
        }));
        setHabits(mappedHabits);
      }

      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('[Todo] Error in fetchData:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Replace the existing useEffect for data fetching with this updated version
  useEffect(() => {
    let categoriesSubscription: any;
    let todosSubscription: any;
    let habitsSubscription: any;
    let refreshInterval: NodeJS.Timeout;

    const setupSubscriptions = async () => {
      // Get the current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      // Set the user state if not already set
      setUser(currentUser);

      // Initial data fetch
      await fetchData(currentUser);

      // Set up real-time subscriptions
      categoriesSubscription = supabase
        .channel('categories-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'categories',
            filter: `user_id=eq.${currentUser.id}`,
          },
          async () => {
            await fetchData(currentUser);
          }
        )
        .subscribe();

      todosSubscription = supabase
        .channel('todos-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'todos',
            filter: `user_id=eq.${currentUser.id}`,
          },
          async () => {
            await fetchData(currentUser);
          }
        )
        .subscribe();

      habitsSubscription = supabase
        .channel('habits-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'habits',
            filter: `user_id=eq.${currentUser.id}`,
          },
          async () => {
            await fetchData(currentUser);
          }
        )
        .subscribe();

      // Set up periodic refresh every minute
      refreshInterval = setInterval(() => fetchData(currentUser), 60000);
    };

    setupSubscriptions();

    // Cleanup function
    return () => {
      if (categoriesSubscription) {
        categoriesSubscription.unsubscribe();
      }
      if (todosSubscription) {
        todosSubscription.unsubscribe();
      }
      if (habitsSubscription) {
        habitsSubscription.unsubscribe();
      }
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [user]); // Only re-run when user changes

  // Add pull-to-refresh functionality
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(user);
    setRefreshing(false);
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
              color="#3A3A3A"
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
            <Text style={[styles.categoryTitle, { flex: 1, fontFamily: 'Onest' }]}>Tasks</Text>
            <Ionicons
              name={isCollapsed ? 'chevron-up' : 'chevron-down'}
              size={15}
              color="#3A3A3A"
              style={{ marginRight: 8 }}
            />
          </View>
        </TouchableOpacity>

        {!isCollapsed && (
          <View style={[styles.categoryContent, { backgroundColor: '#F5F5F5' }]}>
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
      <View style={[styles.categoryContainer, { marginTop: 16 }]}>
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
          <View style={[styles.categoryContent, { backgroundColor: '#F5F5F5' }]}>
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
    // Don't reset the form completely, just clear the task-specific fields
    setNewTodo('');
    setNewDescription('');
    setSelectedCategoryId('');
    setShowNewCategoryInput(false);
    setNewCategoryName('');
    setNewCategoryColor('#E3F2FD');
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
    showModal();
  };

  useEffect(() => {
  }, [isNewCategoryModalVisible]);

  useEffect(() => {
  }, [showRepeatEndDatePicker]);
  
  // Debug useEffect for inline end date picker - REMOVED
  // useEffect(() => {
  //   console.log('showInlineEndDatePicker changed to:', showInlineEndDatePicker);
  // }, [showInlineEndDatePicker]);
  
  // Move the useEffect for input focus here
  useEffect(() => {
    if (isNewTaskModalVisible && newTodoInputRef.current) {
      setTimeout(() => {
        newTodoInputRef.current?.focus();
      }, 150);
    }
  }, [isNewTaskModalVisible]);
  
  // Add useEffect for user state management
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
        setTodos([]);
        setCategories([]);
        resetForm();
      }
    });

    // Initial user check
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
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
            color: newHabitColor,
            require_photo: habitRequirePhoto,
            target_per_week: habitTargetPerWeek,
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
        setHabits(prev => prev.map(habit => 
          habit.id === editingHabit.id 
            ? {
                ...habit,
                text: newHabit.trim(),
                description: newHabitDescription.trim(),
                color: newHabitColor,
                requirePhoto: habitRequirePhoto,
                targetPerWeek: habitTargetPerWeek,
                reminderTime: habitReminderTime?.toISOString() || null,
                category_id: null,
              }
            : habit
        ));
      } else {
        // Create new habit
      const newHabitItem: Habit = {
        id: uuidv4(),
        text: newHabit.trim(),
        description: newHabitDescription.trim(),
        streak: 0,
        completedToday: false,
        completedDays: [],
        color: newHabitColor,
          requirePhoto: habitRequirePhoto,
          targetPerWeek: habitTargetPerWeek,
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
      }
      
      // Schedule reminder if set
      if (habitReminderTime) {
        await scheduleReminderNotification(newHabit.trim(), habitReminderTime);
      }

      // Reset form and close modal
      setNewHabit('');
      setNewHabitDescription('');
      setNewHabitColor('#A0C3B2');
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        Alert.alert('Error', 'You must be logged in to delete habits.');
        return;
      }

      // Delete from Supabase
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting habit:', error);
        Alert.alert('Error', 'Failed to delete habit. Please try again.');
        return;
      }

      // Update local state
      setHabits(prev => prev.filter(habit => habit.id !== habitId));

      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error in deleteHabit:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const viewHabitNotes = (habit: Habit) => {
    const notes = habit.notes || {};
    const noteEntries = Object.entries(notes);
    
    if (noteEntries.length === 0) {
      Alert.alert('No Notes', 'This habit has no notes yet.');
      return;
    }

    const noteList = noteEntries
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([date, note]) => {
        const formattedDate = moment(date).format('MMM D, YYYY');
        return `${formattedDate}:\n${note}`;
      })
      .join('\n\n');

    Alert.alert(
      `Notes for "${habit.text}"`,
      noteList,
      [{ text: 'OK', style: 'default' }]
    );
  };
  
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

          {/* Date Header */}
          <View style={{
            marginHorizontal: 22,
            marginTop: 12,
            marginBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <TouchableOpacity
              onPress={() => setShowDatePicker(prev => !prev)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text style={{
                fontSize: 24,
                fontWeight: '700',
                color: '#333',
                fontFamily: 'Onest',
              }}>
                {moment(currentDate).format('MMMM D')}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Date Picker Modal */}
          {showDatePicker && (
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}>
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                }}
                activeOpacity={1}
                onPress={() => setShowDatePicker(false)}
              />
              <View style={{
                position: 'absolute',
                top: 100,
                left: 20,
                right: 20,
                backgroundColor: 'white',
                borderRadius: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
                elevation: 4,
                zIndex: 1000,
                paddingHorizontal: 25,
              }}>
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(false)}
                    style={{
                      padding: 4,
                    }}
                  >
                  </TouchableOpacity>
                </View>
                
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
                    height: 80,
                    width: '100%',
                  }}
                  textColor="#333"
                />
              </View>
            </View>
          )}

          {/* Tab Navigation */}
          <View style={{
            flexDirection: 'row',
            marginHorizontal: 16,
            marginBottom: 24,
            borderBottomWidth: 1,
            borderBottomColor: '#f0f0f0',
          }}>
            <TouchableOpacity
              onPress={() => setActiveTab('tasks')}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: 'center',
                borderBottomWidth: 2,
                borderBottomColor: activeTab === 'tasks' ? '#FF9A8B' : 'transparent',
              }}
            >
              <Text style={{
                fontSize: 16,
                fontWeight: activeTab === 'tasks' ? '600' : '400',
                color: activeTab === 'tasks' ? '#FF9A8B' : '#999',
                fontFamily: 'Onest',
              }}>
                Tasks
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setActiveTab('habits')}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: 'center',
                borderBottomWidth: 2,
                borderBottomColor: activeTab === 'habits' ? '#FF9A8B' : 'transparent',
              }}
            >
              <Text style={{
                fontSize: 16,
                fontWeight: activeTab === 'habits' ? '600' : '400',
                color: activeTab === 'habits' ? '#FF9A8B' : '#999',
                fontFamily: 'Onest',
              }}>
                Habits
              </Text>
            </TouchableOpacity>
          </View>
          
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
                  marginTop: 125
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
                  {categories.map(category => renderCategory(category))}
                  {renderUncategorizedTodos()}
                  {renderCompletedTodos()}
                </>
              )
            ) : (
              // Habits Content
              habits.length === 0 ? (
                <View style={[styles.emptyState, { 
                  flex: 1, 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  marginTop: 125
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
                <View style={{ paddingHorizontal: 16 }}>
                  {habits.map((habit: Habit) => (
                    <Swipeable
                      key={habit.id}
                      renderRightActions={() => (
                        <TouchableOpacity
                          style={[styles.rightAction, {
                            backgroundColor: `${darkenColor(habit.color, 0.2)}90`,
                          }]}
                          onPress={() => {
                            if (Platform.OS !== 'web') {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }
                            deleteHabit(habit.id);
                          }}
                        >
                          <View style={styles.trashIconContainer}>
                            <Ionicons name="trash" size={24} color="#FFF8E8" />
                          </View>
                        </TouchableOpacity>
                      )}
                      onSwipeableOpen={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }
                        deleteHabit(habit.id);
                      }}
                      containerStyle={{
                        marginVertical: 4,
                        borderRadius: 12,
                        overflow: 'hidden'
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: '#F8F9FA',
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
                        {/* Progress Bar Background */}
                        {(() => {
                          const progress = getWeeklyProgressPercentage(habit);
                    return (
                          <View
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                bottom: 0,
                                right: 0,
                                flexDirection: 'row',
                                zIndex: 0,
                              }}
                            >
                              <View
                                style={{
                                  flex: progress / 100,
                                  backgroundColor: habit.color,
                                  opacity: 0.4,
                                  borderTopLeftRadius: 12,
                                  borderBottomLeftRadius: 12,
                                  borderTopRightRadius: progress === 100 ? 12 : 0,
                                  borderBottomRightRadius: progress === 100 ? 12 : 0,
                                }}
                              />
                              {progress < 100 && (
                                <View
                                  style={{
                                    flex: (100 - progress) / 100,
                                    backgroundColor: 'transparent',
                                  }}
                                />
                              )}
                            </View>
                          );
                        })()}
                        
                        <TouchableOpacity
                          onPress={() => toggleHabit(habit.id)}
                          onLongPress={() => {
                            if (Platform.OS !== 'web') {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }
                            
                            // Show options menu
                            const options = ['Edit Habit'];
                            if (Object.keys(habit.notes || {}).length > 0) {
                              options.push('View Notes');
                            }
                            options.push('Delete Habit');
                            
                            Alert.alert(
                              'Habit Options',
                              'What would you like to do?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Edit Habit',
                                  onPress: () => {
                                    // Set up the edit form with current habit data
                                    setNewHabit(habit.text);
                                    setNewHabitDescription(habit.description || '');
                                    setNewHabitColor(habit.color);
                                    setHabitReminderTime(habit.reminderTime ? new Date(habit.reminderTime) : null);
                                    setHabitRequirePhoto(habit.requirePhoto);
                                    setHabitTargetPerWeek(habit.targetPerWeek);
                                    setEditingHabit(habit);
                                    setIsNewHabitModalVisible(true);
                                  },
                                },
                                ...(Object.keys(habit.notes || {}).length > 0 ? [{
                                  text: 'View Notes',
                                  onPress: () => viewHabitNotes(habit),
                                }] : []),
                                {
                                  text: 'Delete Habit',
                                  style: 'destructive',
                                  onPress: () => {
                                    Alert.alert(
                                      'Delete Habit',
                                      'Are you sure you want to delete this habit? This action cannot be undone.',
                                      [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                          text: 'Delete',
                                          style: 'destructive',
                                          onPress: () => deleteHabit(habit.id),
                                        },
                                      ]
                                    );
                                  },
                                },
                              ]
                            );
                          }}
                          delayLongPress={500}
                          activeOpacity={0.9}
                          style={{ position: 'relative', zIndex: 1 }}
                          >
                            <View style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 8
                            }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{
                                fontSize: 16,
                                color: '#3A3A3A',
                                fontWeight: '500',
                                fontFamily: 'Onest',
                                marginBottom: 4
                              }}>
                                {habit.text}
                              </Text>
                            </View>
                            
                              <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                              backgroundColor: '#E8F5E9',
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 12
                              }}>
                              <Ionicons name="flame" size={12} color="#4CAF50" style={{ marginRight: 4 }} />
                                <Text style={{
                                fontSize: 12,
                                color: '#4CAF50',
                                fontWeight: '600',
                                fontFamily: 'Onest'
                                }}>
                                {habit.streak}
                                </Text>
                              </View>
                            </View>
                          
                            {habit.description && (
                              <Text style={{
                              fontSize: 13,
                              color: '#7F8C8D',
                                fontFamily: 'Onest',
                              lineHeight: 16,
                              marginBottom: 8
                              }}>
                                {habit.description}
                              </Text>
                            )}
                          
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: 0,
                          }}>
                            <View style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6
                            }}>
                              <Text style={{
                                fontSize: 12,
                                color: '#95A5A6',
                                fontFamily: 'Onest'
                              }}>
                                Weekly goal:
                              </Text>
                              <Text style={{
                                fontSize: 12,
                                color: '#3A3A3A',
                                fontFamily: 'Onest',
                                fontWeight: '600'
                              }}>
                                {(habit.completedDays || []).filter(date => {
                                  const weekStart = moment().startOf('isoWeek');
                                  const weekEnd = moment().endOf('isoWeek');
                                  const habitDate = moment(date);
                                  return habitDate.isBetween(weekStart, weekEnd, 'day', '[]');
                                }).length}/{habit.targetPerWeek || 7}
                              </Text>
                          </View>
                            
                            <View style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8
                            }}>
                              {habit.requirePhoto && (() => {
                                const today = moment().format('YYYY-MM-DD');
                                const hasPhotoToday = habit.photos?.[today];
                                const isCompletedToday = habit.completedDays?.includes(today);
                                
                                if (hasPhotoToday) {
                                  return (
                                    <View style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      backgroundColor: '#E8F5E9',
                                      paddingHorizontal: 6,
                                      paddingVertical: 3,
                                      borderRadius: 12
                                    }}>
                                      <Ionicons name="checkmark-circle" size={10} color="#4CAF50" style={{ marginRight: 3 }} />
                                      <Text style={{
                                        fontSize: 10,
                                        color: '#4CAF50',
                                        fontWeight: '500',
                                        fontFamily: 'Onest'
                                      }}>
                                        Photo ✓
                                      </Text>
                      </View>
                    );
                                } else if (isCompletedToday) {
                                  return (
                                    <View style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      backgroundColor: '#FFF3E0',
                                      paddingHorizontal: 6,
                                      paddingVertical: 3,
                                      borderRadius: 12
                                    }}>
                                      <Ionicons name="warning" size={10} color="#FF9800" style={{ marginRight: 3 }} />
                                      <Text style={{
                                        fontSize: 10,
                                        color: '#FF9800',
                                        fontWeight: '500',
                                        fontFamily: 'Onest'
                                      }}>
                                        Missing
                                      </Text>
                                    </View>
                                  );
                                } else {
                                  return (
                                    <View style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      backgroundColor: '#FFF3E0',
                                      paddingHorizontal: 6,
                                      paddingVertical: 3,
                                      borderRadius: 12
                                    }}>
                                      <Ionicons name="camera" size={10} color="#FF9800" style={{ marginRight: 3 }} />
                                      <Text style={{
                                        fontSize: 10,
                                        color: '#FF9800',
                                        fontWeight: '500',
                                        fontFamily: 'Onest'
                                      }}>
                                        Required
                                      </Text>
                                    </View>
                                  );
                                }
                              })()}
                              
                              {habit.reminderTime && (
                                <View style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4
                                }}>
                                  <Ionicons name="time" size={12} color="#95A5A6" />
                                  <Text style={{
                                    fontSize: 12,
                                    color: '#95A5A6',
                                    fontFamily: 'Onest'
                                  }}>
                                    {moment(habit.reminderTime).format('h:mm A')}
                                  </Text>
                                </View>
                              )}

                              {/* Show note indicator if habit has notes */}
                              {Object.keys(habit.notes || {}).length > 0 && (
                                <View style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4
                                }}>
                                  <Ionicons name="document-text" size={12} color="#95A5A6" />
                                  <Text style={{
                                    fontSize: 12,
                                    color: '#95A5A6',
                                    fontFamily: 'Onest'
                                  }}>
                                    {Object.keys(habit.notes || {}).length} note{Object.keys(habit.notes || {}).length !== 1 ? 's' : ''}
                                  </Text>
                                </View>
                              )}
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

          {/* ADD TASK BUTTON */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              if (activeTab === 'tasks') {
                handleAddButtonPress();
              } else {
                setIsNewHabitModalVisible(true);
              }
            }}
          >
            <Ionicons name="add" size={22} color="white" />
          </TouchableOpacity>
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
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fafafa' }}>
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
                  return '#ffffff';
                } else {
                  // New task modal
                  if (selectedCategoryId && selectedCategoryId.trim() !== '') {
                    const category = categories.find(cat => cat.id === selectedCategoryId);
                    return category ? category.color + '60' : '#ffffff';
                  }
                  return '#ffffff';
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
                <Ionicons name="close" size={16} color="#666" />
              </TouchableOpacity>
              
              <Text style={{ 
                fontSize: 16, 
                fontWeight: '600', 
                color: '#333',
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
                  backgroundColor: newTodo.trim() ? '#FF6B6B' : '#ffffff',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons 
                  name="checkmark" 
                  size={16} 
                  color={newTodo.trim() ? 'white' : '#999'} 
                />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Task Title Card */}
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
                <TextInput
                  ref={newTodoInputRef}
                  style={{
                    fontSize: 17,
                    fontFamily: 'Onest',
                    fontWeight: '500',
                    marginBottom: 5,
                  }}
                  placeholder="Task Title"
                  placeholderTextColor="#888"
                  value={newTodo}
                  onChangeText={setNewTodo}
                />

                <TextInput
                  ref={newDescriptionInputRef}
                  style={{
                    fontSize: 13,
                    color: '#666',
                    fontFamily: 'Onest',
                    fontWeight: '400',
                    marginTop: 5,
                    paddingVertical: 2,
                    paddingHorizontal: 0,
                    textAlignVertical: 'top',
                    minHeight: 60,
                  }}
                  placeholder="Description (optional)"
                  placeholderTextColor="#999"
                  value={newDescription}
                  onChangeText={setNewDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Date Card */}
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
                  Due Date
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowDatePicker(prev => !prev);
                  }}
                  style={{
                    backgroundColor: '#f8f9fa',
                    borderRadius: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: showDatePicker ? '#007AFF' : '#f0f0f0',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{
                      fontSize: 14,
                      color: '#333',
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
                    <Ionicons name="chevron-down" size={12} color="#999" />
                  </View>
                </TouchableOpacity>

                {showDatePicker && (
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
                        setShowDatePicker(false);
                      }}
                      markedDates={{
                        [taskDate ? moment(taskDate).format('YYYY-MM-DD') : '']: {
                          selected: true,
                          selectedColor: '#007AFF',
                        },
                        [moment().format('YYYY-MM-DD')]: {
                          today: true,
                          todayTextColor: '#007AFF',
                        }
                      }}
                      theme={{
                        backgroundColor: 'transparent',
                        calendarBackground: 'transparent',
                        textSectionTitleColor: '#333',
                        selectedDayBackgroundColor: '#007AFF',
                        selectedDayTextColor: '#ffffff',
                        todayTextColor: '#007AFF',
                        dayTextColor: '#333',
                        textDisabledColor: '#d9e1e8',
                        dotColor: '#007AFF',
                        selectedDotColor: '#ffffff',
                        arrowColor: '#007AFF',
                        monthTextColor: '#333',
                        indicatorColor: '#007AFF',
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
                  Category
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowCategoryBox(prev => !prev);
                  }}
                  style={{
                    backgroundColor: '#f8f9fa',
                    borderRadius: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: showCategoryBox ? '#007AFF' : '#f0f0f0',
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
                              backgroundColor: categories.find(cat => cat.id === selectedCategoryId)?.color || '#666',
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
                            color: '#999',
                            fontFamily: 'Onest',
                            fontWeight: '500'
                          }}>
                            Choose category
                          </Text>
                        )}
                      </View>
                      <Ionicons name="chevron-down" size={12} color="#999" />
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
                            backgroundColor: selectedCategoryId === cat.id ? cat.color + '20' : '#f8f9fa',
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
                        }}
                        style={{
                          backgroundColor: '#f8f9fa',
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 16,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Ionicons name="add" size={12} color="#666" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {showNewCategoryInput && (
                    <View style={{
                      backgroundColor: '#f8f9fa',
                      padding: 12,
                      borderRadius: 8,
                      marginTop: 8,
                    }}>
                      <Text style={{
                        fontSize: 14,
                        color: '#333',
                        fontFamily: 'Onest',
                        fontWeight: '600',
                        marginBottom: 8,
                      }}>
                        New Category
                      </Text>
                      <TextInput
                        ref={categoryInputRef}
                        style={{
                          backgroundColor: 'white',
                          padding: 8,
                          borderRadius: 6,
                          marginBottom: 8,
                          fontSize: 14,
                          fontFamily: 'Onest',
                          borderWidth: 1,
                          borderColor: '#e0e0e0',
                        }}
                        placeholder="Category name"
                        value={newCategoryName}
                        onChangeText={setNewCategoryName}
                      />
                      
                      {/* Color Picker */}
                      <Text style={{
                        fontSize: 12,
                        color: '#666',
                        fontFamily: 'Onest',
                        fontWeight: '500',
                        marginBottom: 6,
                      }}>
                        Color
                      </Text>
                      <View style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginBottom: 12,
                      }}>
                        {['#BF9264', '#6F826A', '#BBD8A3', '#F0F1C5', '#FFCFCF', '#FF9A8B', '#A0C3B2', '#E4D6A7', '#D8BFD8', '#B0E0E6', '#FFE5B4', '#FADADD', '#C1E1C1', '#F0D9FF', '#D0F0C0', '#FFFACD'].map((color) => (
                          <TouchableOpacity
                            key={color}
                            onPress={() => setNewCategoryColor(color)}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              backgroundColor: color,
                              borderWidth: newCategoryColor === color ? 1 : 0,
                              borderColor: '#333',
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
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Ionicons name="close" size={16} color="#666" />
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
                                  type: 'task'
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
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: '#FF6B6B',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Ionicons name="checkmark" size={16} color="white" />
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
                        Reminder
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setShowReminderPicker(prev => !prev);
                        }}
                        style={{
                          backgroundColor: '#f8f9fa',
                          borderRadius: 8,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderWidth: 1,
                          borderColor: showReminderPicker ? '#007AFF' : '#f0f0f0',
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{
                            fontSize: 14,
                            color: '#333',
                            fontFamily: 'Onest',
                            fontWeight: '500'
                          }}>
                            {reminderTime ? moment(reminderTime).format('MMM D, h:mm A') : 'No reminder'}
                          </Text>
                          <Ionicons name="chevron-down" size={12} color="#999" />
                        </View>
                      </TouchableOpacity>
                    </View>

                    {showReminderPicker && (
                      <View style={{
                        backgroundColor: '#f8f9fa',
                        borderRadius: 8,
                        padding: 12,
                        marginTop: 8,
                        borderWidth: 1,
                        borderColor: '#e0e0e0',
                      }}>
                        <DateTimePicker
                          value={reminderTime instanceof Date ? reminderTime : new Date()}
                          mode="datetime"
                          display="spinner"
                          onChange={(event, selectedTime) => {
                            if (selectedTime && selectedTime > new Date()) {
                              setReminderTime(selectedTime);
                              // Don't close the picker - let user manually close it
                            }
                          }}
                          minimumDate={new Date()}
                          style={{
                            height: 120,
                            width: '100%',
                          }}
                          textColor="#333"
                        />
                        
                        <View style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          marginTop: 12,
                        }}>
                          <TouchableOpacity
                            onPress={() => {
                              const now = new Date();
                              const in15Min = new Date(now.getTime() + 15 * 60000);
                              setReminderTime(in15Min);
                              // Don't close the picker
                            }}
                            style={{
                              backgroundColor: '#007AFF',
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{
                              fontSize: 12,
                              color: 'white',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                              15 min
                            </Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            onPress={() => {
                              const now = new Date();
                              const in1Hour = new Date(now.getTime() + 60 * 60000);
                              setReminderTime(in1Hour);
                              // Don't close the picker
                            }}
                            style={{
                              backgroundColor: '#007AFF',
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{
                              fontSize: 12,
                              color: 'white',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                              1 hour
                            </Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            onPress={() => {
                              const now = new Date();
                              const tomorrow = new Date(now.getTime() + 24 * 60 * 60000);
                              setReminderTime(tomorrow);
                              // Don't close the picker
                            }}
                            style={{
                              backgroundColor: '#007AFF',
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{
                              fontSize: 12,
                              color: 'white',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                              Tomorrow
                            </Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            onPress={() => {
                              setReminderTime(null);
                              setShowReminderPicker(false);
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
                        }}
                        style={{
                          backgroundColor: '#f8f9fa',
                          borderRadius: 8,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderWidth: 1,
                          borderColor: showRepeatPicker ? '#007AFF' : '#f0f0f0',
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
                          <Ionicons name="chevron-down" size={12} color="#999" />
                        </View>
                      </TouchableOpacity>
                    </View>

                    {showRepeatPicker && (
                      <View style={{
                        backgroundColor: '#f8f9fa',
                        borderRadius: 8,
                        padding: 12,
                        marginTop: 8,
                        borderWidth: 1,
                        borderColor: '#e0e0e0',
                      }}>
                        <View style={{
                          marginBottom: 12,
                        }}>
                          {REPEAT_OPTIONS.map((option) => (
                            <TouchableOpacity
                              key={option.value}
                              onPress={() => {
                                if (option.value === 'custom') {
                                  setSelectedRepeat(option.value);
                                  setShowRepeatPicker(false);
                                } else if (option.value === 'none') {
                                  setSelectedRepeat('none');
                                  setRepeatEndDate(null);
                                  setShowRepeatPicker(false);
                                } else {
                                  setSelectedRepeat(option.value);
                                  setShowRepeatPicker(false);
                                }
                              }}
                              style={{
                                backgroundColor: selectedRepeat === option.value ? '#f0f0f0' : 'transparent',
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                                borderRadius: 8,
                                marginVertical: 2,
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
                                <Ionicons name="checkmark" size={16} color="#007AFF" />
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>

                        {selectedRepeat && selectedRepeat !== 'none' && selectedRepeat !== 'custom' && (
                          <View style={{
                            borderTopWidth: 1,
                            borderTopColor: '#e0e0e0',
                            paddingTop: 12,
                          }}>
                            <TouchableOpacity
                              onPress={() => {
                                setShowInlineEndDatePicker(prev => !prev);
                              }}
                              style={{
                                backgroundColor: repeatEndDate ? '#f0f0f0' : 'transparent',
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                                borderRadius: 8,
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
                                <Ionicons name="checkmark" size={16} color="#007AFF" />
                              ) : (
                                <Ionicons name="calendar-outline" size={16} color="#666" />
                              )}
                            </TouchableOpacity>

                            {showInlineEndDatePicker && (
                              <View style={{
                                backgroundColor: '#ffffff',
                                borderRadius: 8,
                                padding: 12,
                                marginTop: 8,
                                borderWidth: 1,
                                borderColor: '#e0e0e0',
                              }}>
                                <View style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: 12,
                                }}>
                                  <Text style={{
                                    fontSize: 14,
                                    fontWeight: '600',
                                    color: '#333',
                                    fontFamily: 'Onest'
                                  }}>
                                    Select End Date
                                  </Text>
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
                                  }}
                                  markedDates={{
                                    [repeatEndDate ? moment(repeatEndDate).format('YYYY-MM-DD') : '']: {
                                      selected: true,
                                      selectedColor: '#007AFF',
                                    },
                                    [moment().format('YYYY-MM-DD')]: {
                                      today: true,
                                      todayTextColor: '#007AFF',
                                    }
                                  }}
                                  minDate={moment().format('YYYY-MM-DD')}
                                  theme={{
                                    backgroundColor: 'transparent',
                                    calendarBackground: 'transparent',
                                    textSectionTitleColor: '#333',
                                    selectedDayBackgroundColor: '#007AFF',
                                    selectedDayTextColor: '#ffffff',
                                    todayTextColor: '#007AFF',
                                    dayTextColor: '#333',
                                    textDisabledColor: '#d9e1e8',
                                    dotColor: '#007AFF',
                                    selectedDotColor: '#ffffff',
                                    arrowColor: '#007AFF',
                                    monthTextColor: '#333',
                                    indicatorColor: '#007AFF',
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
            </ScrollView>
          </View>
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
                  autoFocus
                />

                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, fontFamily: 'Onest', marginLeft: 2 }}>Choose a color</Text>
                
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
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fafafa' }}>
          <View style={{ flex: 1 }}>
            {/* Minimal Header */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              paddingHorizontal: 16,
              paddingVertical: 12,
              paddingTop: 40,
              backgroundColor: '#ffffff',
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
                <Ionicons name="close" size={16} color="#666" />
              </TouchableOpacity>
              
              <Text style={{ 
                fontSize: 16, 
                fontWeight: '600', 
                color: '#333',
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
                  backgroundColor: newHabit.trim() ? '#A0C3B2' : '#ffffff',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons 
                  name="checkmark" 
                  size={16} 
                  color={newHabit.trim() ? 'white' : '#999'} 
                />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Habit Title Card */}
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
                <TextInput
                  style={{
                    fontSize: 17,
                    fontFamily: 'Onest',
                    fontWeight: '500',
                    marginBottom: 5,
                  }}
                  placeholder="Habit Title"
                  placeholderTextColor="#888"
                  value={newHabit}
                  onChangeText={setNewHabit}
                />

                <TextInput
                  style={{
                    fontSize: 13,
                    color: '#666',
                    fontFamily: 'Onest',
                    fontWeight: '400',
                    marginTop: 5,
                    paddingVertical: 2,
                    paddingHorizontal: 0,
                    textAlignVertical: 'top',
                    minHeight: 60,
                  }}
                  placeholder="Description"
                  placeholderTextColor="#999"
                  value={newHabitDescription}
                  onChangeText={setNewHabitDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Weekly Goal Card */}
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
                  marginBottom: 8,
                  fontFamily: 'Onest'
                }}>
                  Weekly Goal
                </Text>
                <Text style={{ 
                  fontSize: 12, 
                  color: '#666', 
                  fontFamily: 'Onest',
                  marginBottom: 12,
                }}>
                  How many times per week do you want to complete this habit?
                </Text>
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  {[1, 2, 3, 4, 5, 6, 7].map((goal) => (
                    <TouchableOpacity
                      key={goal}
                      onPress={() => setHabitTargetPerWeek(goal)}
                      style={{
                        backgroundColor: habitTargetPerWeek === goal ? '#A0C3B2' : '#f8f9fa',
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: habitTargetPerWeek === goal ? '#A0C3B2' : '#e0e0e0',
                      }}
                    >
                      <Text style={{
                        color: habitTargetPerWeek === goal ? 'white' : '#333',
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
                <Text style={{ 
                  fontSize: 12, 
                  color: '#666', 
                  fontFamily: 'Onest',
                  marginBottom: 12,
                }}>
                  Choose a color for your habit
                </Text>
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  {['#FF9A8B', '#FF6B6B', '#A0C3B2', '#BF9264', '#6F826A', '#BBD8A3', '#D8BFD8', '#B0E0E6', '#FFE5B4', '#FADADD', '#C1E1C1', '#F0D9FF', '#D0F0C0', '#FFFACD', '#E4D6A7', '#FFCFCF'].map((color) => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setNewHabitColor(color)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: color,
                        borderWidth: newHabitColor === color ? 3 : 1,
                        borderColor: newHabitColor === color ? '#333' : '#e0e0e0',
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

              {/* Category Card - Removed */}

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
                <View style={{ gap: 12 }}>
                  {/* Reminder */}
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
                        Reminder
                </Text>
                <TouchableOpacity
                  onPress={() => {
                          setShowHabitReminderPicker(prev => !prev);
                  }}
                  style={{
                    backgroundColor: '#f8f9fa',
                    borderRadius: 8,
                          paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                          borderColor: showHabitReminderPicker ? '#007AFF' : '#f0f0f0',
                  }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ 
                              fontSize: 14, 
                              color: '#333',
                              fontFamily: 'Onest',
                              fontWeight: '500'
                            }}>
                            {habitReminderTime ? moment(habitReminderTime).format('MMM D, h:mm A') : 'No reminder'}
                            </Text>
                      <Ionicons name="chevron-down" size={12} color="#999" />
                    </View>
                      </TouchableOpacity>
                    </View>

                    {showHabitReminderPicker && (
                      <View style={{
                        backgroundColor: '#f8f9fa',
                        borderRadius: 8,
                        padding: 12,
                        marginTop: 8,
                        borderWidth: 1,
                        borderColor: '#e0e0e0',
                      }}>
                        <DateTimePicker
                          value={habitReminderTime instanceof Date ? habitReminderTime : new Date()}
                          mode="datetime"
                          display="spinner"
                          onChange={(event, selectedTime) => {
                            if (selectedTime && selectedTime > new Date()) {
                              setHabitReminderTime(selectedTime);
                            }
                          }}
                          minimumDate={new Date()}
                          style={{
                            height: 120,
                            width: '100%',
                          }}
                          textColor="#333"
                        />
                        
                    <View style={{ 
                      flexDirection: 'row', 
                          justifyContent: 'space-between',
                          marginTop: 12,
                    }}>
                          <TouchableOpacity
                          onPress={() => {
                              const now = new Date();
                              const in15Min = new Date(now.getTime() + 15 * 60000);
                              setHabitReminderTime(in15Min);
                          }}
                            style={{
                              backgroundColor: '#007AFF',
                              paddingHorizontal: 12,
                            paddingVertical: 6,
                              borderRadius: 6,
                            }}
                        >
                          <Text style={{ 
                            fontSize: 12, 
                              color: 'white',
                            fontFamily: 'Onest',
                              fontWeight: '500'
                          }}>
                              15 min
                          </Text>
                          </TouchableOpacity>
                          
                      <TouchableOpacity
                        onPress={() => {
                              const now = new Date();
                              const in1Hour = new Date(now.getTime() + 60 * 60000);
                              setHabitReminderTime(in1Hour);
                        }}
                        style={{
                              backgroundColor: '#007AFF',
                              paddingHorizontal: 12,
                          paddingVertical: 6,
                              borderRadius: 6,
                        }}
                      >
                      <Text style={{
                        fontSize: 12,
                              color: 'white',
                        fontFamily: 'Onest',
                              fontWeight: '500'
                      }}>
                              1 hour
                      </Text>
                          </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                              const now = new Date();
                              const tomorrow = new Date(now.getTime() + 24 * 60 * 60000);
                              setHabitReminderTime(tomorrow);
                          }}
                          style={{
                              backgroundColor: '#007AFF',
                            paddingHorizontal: 12,
                              paddingVertical: 6,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{
                              fontSize: 12,
                              color: 'white',
                            fontFamily: 'Onest',
                              fontWeight: '500'
                          }}>
                              Tomorrow
                          </Text>
                        </TouchableOpacity>
                          
                        <TouchableOpacity
                            onPress={() => {
                              setHabitReminderTime(null);
                              setShowHabitReminderPicker(false);
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

                  {/* Photo Proof */}
                  <View>
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                    }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ 
                          fontSize: 14, 
                          color: '#333', 
                          fontFamily: 'Onest',
                          fontWeight: '500',
                          marginBottom: 2,
                        }}>
                          Require Photo Proof
                        </Text>
                        <Text style={{ 
                          fontSize: 12, 
                          color: '#666', 
                          fontFamily: 'Onest',
                        }}>
                          Take a photo when completing this habit
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setHabitRequirePhoto(prev => !prev)}
                        style={{
                          width: 44,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: habitRequirePhoto ? '#A0C3B2' : '#f0f0f0',
                          justifyContent: 'center',
                          alignItems: 'center',
                          paddingHorizontal: 2,
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
                </View>
              </View>
            </ScrollView>
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

    </GestureHandlerRootView>
  );
}