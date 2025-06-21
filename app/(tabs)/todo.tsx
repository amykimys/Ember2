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
  Image,
  FlatList,
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
import * as FileSystem from 'expo-file-system';
import { promptPhotoSharing, PhotoShareData } from '../../utils/photoSharing';
import { shareTaskWithFriend, shareHabitWithFriend } from '../../utils/sharing';
import Toast from 'react-native-toast-message';



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
  photo?: string; // Add photo field
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
  const [taskPhoto, setTaskPhoto] = useState<string | null>(null);

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
  
  // Add ref for habit title input
  const newHabitInputRef = useRef<TextInput>(null);

  // Add state for notes modal
  // const [isNotesModalVisible, setIsNotesModalVisible] = useState(false);
  // const [selectedHabitForNotes, setSelectedHabitForNotes] = useState<Habit | null>(null);
  // const [noteText, setNoteText] = useState('');

  // Add state for editing existing notes
  // const [editingNoteDate, setEditingNoteDate] = useState<string | null>(null);
  // const [isEditingNote, setIsEditingNote] = useState(false);

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
  const [selectedTaskForPhotoViewing, setSelectedTaskForPhotoViewing] = useState<Todo | null>(null);
  const [isTaskPhotoViewerVisible, setIsTaskPhotoViewerVisible] = useState(false);
  
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

  // Add state for notes viewer modal
  const [isNotesViewerModalVisible, setIsNotesViewerModalVisible] = useState(false);
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

  // Add useEffect for habit title input focus
  useEffect(() => {
    if (isNewHabitModalVisible && newHabitInputRef.current) {
      setTimeout(() => {
        newHabitInputRef.current?.focus();
      }, 150);
    }
  }, [isNewHabitModalVisible]);

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
    setSelectedFriends([]);
    setSearchFriend('');
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

      // Share with selected friends BEFORE resetting the form
      if (selectedFriends.length > 0 && newTodoItem.id && user?.id) {
        for (const friendId of selectedFriends) {
          await shareTaskWithFriend(newTodoItem.id, friendId, user.id);
        }
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
            // First, remove all existing shares for this task
            await supabase
              .from('shared_tasks')
              .delete()
              .eq('original_task_id', editingTodo.id)
              .eq('shared_by', user.id);
            
            // Then add new shares for selected friends
            if (selectedFriends.length > 0) {
              for (const friendId of selectedFriends) {
                await shareTaskWithFriend(editingTodo.id, friendId, user.id);
              }
            }
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
      const habitToToggle = habits.find(h => h.id === habitId);
      if (!habitToToggle) return;

      const today = moment().format('YYYY-MM-DD');
      const isCompletedToday = habitToToggle.completedDays.includes(today);

      if (isCompletedToday) {
        // If already completed today, do nothing
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
      const newCompletedDays = [...currentCompletedDays, today];

      // Update in Supabase
      const { error } = await supabase
        .from('habits')
        .update({
          completedDays: newCompletedDays,
          streak: calculateCurrentStreak(newCompletedDays),
          updated_at: new Date().toISOString()
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

      // Show success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error completing habit:', error);
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

      // Prompt for photo sharing
      if (user?.id) {
        promptPhotoSharing(
          {
            photoUrl: uploadedPhotoUrl,
            sourceType: 'habit',
            sourceId: habitId,
            sourceTitle: habitToToggle.text,
            userId: user.id
          },
          () => {
            // Success callback - photo already added above
          },
          () => {
            // Cancel callback - photo already added above
            Alert.alert('Success', 'Habit completed with photo!');
          }
        );
      } else {
        Alert.alert('Success', 'Habit completed with photo!');
      }
      
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

    const renderLeftActions = (_: any, dragX: any, swipeAnimatedValue: any) => {
      const category = categories.find(c => c.id === todo.categoryId);
      const baseColor = category?.color || '#007AFF';
      const lightColor = baseColor + '20';
  
      return (
        <View style={[styles.leftAction, { backgroundColor: lightColor }]}>
          <TouchableOpacity 
            onPress={() => {
              handlePhotoAttachment(todo.id);
            }} 
            style={[styles.photoIconContainer, { 
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: 8,
              padding: 12,
            }]}
            activeOpacity={0.5}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="camera" size={24} color={baseColor} />
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
        setSelectedCategoryId(todo.categoryId || '');
        setReminderTime(todo.reminderTime || null);
        setSelectedRepeat(todo.repeat || 'none');
        setRepeatEndDate(todo.repeatEndDate || null);
        if (todo.repeat === 'custom' && todo.customRepeatDates) {
          setCustomSelectedDates(todo.customRepeatDates.map(date => date.toISOString().split('T')[0]));
        }
        
        // Open the modal immediately
        showModal();
        
        // Fetch existing shared friends for this task (non-blocking)
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: sharedTasks, error } = await supabase
            .from('shared_tasks')
            .select('shared_with')
            .eq('original_task_id', todo.id)
            .eq('shared_by', user.id);

          if (error) {
            console.error('Error fetching shared friends:', error);
            return;
          }

          if (!sharedTasks || sharedTasks.length === 0) {
            return;
          }

          // Extract the friend IDs
          const sharedFriendIds = sharedTasks.map((st: { shared_with: string }) => st.shared_with);
          setSelectedFriends(sharedFriendIds);
        } catch (error) {
          console.error('Error fetching shared friends, continuing without them:', error);
          // Continue without shared friends if there's an error
        }
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
          {todo.photo && (
            <View style={{
              marginTop: 8,
              borderRadius: 8,
              overflow: 'hidden',
              width: 60,
              height: 60,
            }}>
              <TouchableOpacity
                onPress={() => viewTaskPhoto(todo)}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: todo.photo }}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
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
        onSwipeableLeftOpen={() => handlePhotoAttachment(todo.id)}
        friction={1.5}
        overshootRight={false}
        overshootLeft={false}
        rightThreshold={30}
        leftThreshold={30}
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
        const result = await retryRequest(async () => {
          const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('user_id', userToUse.id)
            .in('type', ['todo', 'task']) // Fetch both 'todo' and 'task' types
            .order('created_at', { ascending: false });

          if (error) throw error;
          return data || [];
        });

        if (result) {
          setCategories(result);
        }
      };

      const fetchTasks = async () => {
        const result = await retryRequest(async () => {
          const { data, error } = await supabase
            .from('todos')
            .select('*')
            .eq('user_id', userToUse.id)
            .order('created_at', { ascending: false });

          if (error) throw error;
          return data || [];
        });

        if (result) {
          const mappedTasks = result.map((task: any) => ({
            ...task,
            date: task.date ? new Date(task.date) : new Date(),
            repeatEndDate: task.repeat_end_date ? new Date(task.repeat_end_date) : null,
            reminderTime: task.reminder_time ? new Date(task.reminder_time) : null,
            customRepeatDates: task.custom_repeat_dates ? task.custom_repeat_dates.map((date: string) => new Date(date)) : [],
            categoryId: task.category_id,
            photo: task.photo
          }));
          setTodos(mappedTasks);
        }
      };

      const fetchHabits = async () => {
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
          const sortedHabits = result.map((habit: any) => ({
            ...habit,
            completedDays: habit.completed_days || [],
            notes: habit.notes || {},
            photos: habit.photos || {},
            category_id: habit.category_id
          }));
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

          if (friendshipsError) throw friendshipsError;

          if (!friendships || friendships.length === 0) {
            return [];
          }

          const friendsWithProfiles = await Promise.all(
            friendships.map(async (friendship) => {
              const friendUserId = friendship.user_id === userToUse.id ? friendship.friend_id : friendship.user_id;
              
              const { data: profileData } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, username')
                .eq('id', friendUserId)
                .single();
              
              return {
                friendship_id: friendship.id,
                friend_id: friendUserId,
                friend_name: profileData?.full_name || 'Unknown',
                friend_avatar: profileData?.avatar_url || '',
                friend_username: profileData?.username || '',
                status: friendship.status,
                created_at: friendship.created_at,
              };
            })
          );

          return friendsWithProfiles;
        });

        if (result) {
          setFriends(result);
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
    setSelectedFriends([]);
    setSearchFriend('');
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

  // Add useEffect to fetch data when user changes
  useEffect(() => {
    if (user) {
      console.log('User authenticated, fetching data...');
      fetchData(user);
    }
  }, [user]);
  
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

      // Update in Supabase
      const { error } = await supabase
        .from('habits')
        .update({ 
          photos: updatedPhotos
        })
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
              photos: updatedPhotos
            } 
          : habit
      ));
      
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      Alert.alert('Success', 'Photo added successfully!');
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

  const uploadTaskPhoto = async (photoUri: string, taskId: string): Promise<string> => {
    try {
      // First, let's check if the file exists and get its info
      const fileInfo = await FileSystem.getInfoAsync(photoUri);
      
      if (!fileInfo.exists) {
        throw new Error('Photo file does not exist');
      }
      
      // Create a unique filename with tasks category
      const fileExt = photoUri.split('.').pop() || 'jpg';
      const fileName = `tasks/${taskId}/task_${Date.now()}.${fileExt}`;
      
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
        throw uploadError;
      }
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('memories')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      throw error;
    }
  };

  const attachPhotoToTask = async (taskId: string, photoUri: string) => {
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to attach photos.');
        return;
      }

      // Upload photo to Supabase Storage first
      const uploadedPhotoUrl = await uploadTaskPhoto(photoUri, taskId);

      // Update task in Supabase with photo URL
      const { error } = await supabase
        .from('todos')
        .update({ photo: uploadedPhotoUrl })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating task with photo in Supabase:', error);
        Alert.alert('Error', 'Failed to attach photo. Please try again.');
        return;
      }

      console.log('🔍 Task updated in database successfully');
      // Update local state
      setTodos(prev => prev.map(todo => 
        todo.id === taskId 
          ? { ...todo, photo: uploadedPhotoUrl }
          : todo
      ));

      // Prompt for photo sharing
      if (user?.id) {
        const task = todos.find(t => t.id === taskId);
        promptPhotoSharing(
          {
            photoUrl: uploadedPhotoUrl,
            sourceType: 'event',
            sourceId: taskId,
            sourceTitle: task?.text || 'Task',
            userId: user.id
          },
          () => {
            // Success callback - photo already added above
          },
          () => {
            // Cancel callback - photo already added above
            Alert.alert('Success', 'Photo attached successfully!');
          }
        );
      } else {
        Alert.alert('Success', 'Photo attached successfully!');
      }
    } catch (error) {
      console.error('Error in attachPhotoToTask:', error);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    }
  };

  const handlePhotoAttachment = (taskId: string) => {
    Alert.alert(
      'Attach Photo',
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
                await attachPhotoToTask(taskId, result.assets[0].uri);
              }
            } catch (error) {
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
                await attachPhotoToTask(taskId, result.assets[0].uri);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to select image. Please try again.');
            }
          },
        },
      ]
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

  // Add function to view task photos
  const viewTaskPhoto = (task: Todo) => {
    if (!task.photo) {
      Alert.alert('No Photo', 'This task has no photo attached.');
      return;
    }
    
    setSelectedTaskForPhotoViewing(task);
    setIsTaskPhotoViewerVisible(true);
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
        return habitDate.isBetween(monthStart, monthEnd, 'day', '[]');
      }).length;
      
      const daysInMonth = monthEnd.diff(monthStart, 'days') + 1;
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
                fontSize: 25,
                fontWeight: '700',
                color: '#333',
                fontFamily: 'Onest',
              }}>
                {moment(currentDate).format('MMMM D')}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#666" style={{ marginLeft: 1 }} />
            </TouchableOpacity>
          </View>

          {/* Date Picker Modal */}
          {showDatePicker && (
            <Modal
              animationType="fade"
              transparent={true}
              visible={showDatePicker}
              onRequestClose={() => setShowDatePicker(false)}
            >
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
            }}>
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
                activeOpacity={1}
                onPress={() => setShowDatePicker(false)}
              />
              <View style={{
                position: 'absolute',
                top: 110,
                  left: 22,
                backgroundColor: 'white',
                  borderRadius: 16,
                  width: 320,
                shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 8,
                  overflow: 'hidden',
                }}>
                  {/* Date Picker */}
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
                  textColor="#333"
                      themeVariant="light"
                />
              </View>
            </View>
              </View>
            </Modal>
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
                  <View style={{ height: 20 }} />
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
                            onPress={async () => {
                              if (!user?.id) {
                                Alert.alert('Error', 'You must be logged in to share habits.');
                                return;
                              }
                              
                              // For now, show a simple message about sharing
                              Alert.alert(
                                'Share Habit',
                                `Sharing "${habit.text}" with friends is coming soon!`,
                                [{ text: 'OK', style: 'default' }]
                              );
                            }}
                            style={[styles.trashIconContainer, { 
                              backgroundColor: 'rgba(255, 255, 255, 0.2)',
                              marginRight: 8,
                            }]}
                            activeOpacity={0.5}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="share-outline" size={20} color="white" />
                          </TouchableOpacity>
                          
                          <TouchableOpacity
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
                        </View>
                      )}
                      renderLeftActions={() => (
                        <View
                          style={{
                            backgroundColor: '#007AFF',
                            width: 80, // Single icon width
                            height: '100%',
                          alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 8,
                          }}
                        >
                          {/* Camera Icon */}
                          <TouchableOpacity
                            onPress={() => {
                              if (swipeableRefs.current[habit.id]) {
                                swipeableRefs.current[habit.id].close();
                              }
                              const photos = habit.photos || {};
                              const photoEntries = Object.entries(photos);
                              
                              if (photoEntries.length > 0) {
                                // Sort photos by date (most recent first) and show the first one
                                const sortedPhotos = photoEntries
                                  .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
                                  .map(([date, photoUrl]) => ({
                                    date,
                                    photoUrl,
                                    formattedDate: moment(date).format('MMM D, YYYY')
                                  }));
                                
                                // Set up all photos for navigation
                                setAllPhotosForViewing(sortedPhotos.map(photo => ({
                                  habit,
                                  photoUrl: photo.photoUrl,
                                  date: photo.date,
                                  formattedDate: photo.formattedDate
                                })));
                                setCurrentPhotoIndex(0);
                                
                                // Show the most recent photo directly
                                setSelectedPhotoForViewing({ 
                                  habit, 
                                  photoUrl: sortedPhotos[0].photoUrl, 
                                  date: sortedPhotos[0].date, 
                                  formattedDate: sortedPhotos[0].formattedDate 
                                });
                                setIsPhotoViewerVisible(true);
                              } else {
                                // Open photo modal to add photos
                              setSelectedHabitForPhoto(habit);
                              setIsPhotoModalVisible(true);
                              }
                            }}
                            style={{
                              width: 48,
                              height: 48,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 24,
                              backgroundColor: 'rgba(255,255,255,0.2)',
                            }}
                          >
                            <Ionicons name="camera" size={22} color="white" />
                          </TouchableOpacity>
                        </View>
                      )}
                      onSwipeableRightOpen={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }
                        deleteHabit(habit.id);
                      }}
                      onSwipeableLeftOpen={() => {
                        // This will be handled by individual button presses
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
                              backgroundColor: '#f8f9fa',
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 12
                              }}>
                              <Ionicons name="flame" size={12} color="#666" style={{ marginRight: 4 }} />
                                <Text style={{
                                fontSize: 12,
                                color: '#666',
                                fontWeight: '500',
                                fontFamily: 'Onest'
                                }}>
                                {habit.streak}
                                </Text>
                              </View>
                            </View>
                          
                            {habit.description && (
                              <Text style={{
                              fontSize: 14,
                              color: '#666',
                                fontFamily: 'Onest',
                              lineHeight: 18,
                              marginBottom: 12
                              }}>
                                {habit.description}
                              </Text>
                            )}
                          
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}>
                            <View style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: '#f8f9fa',
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 12
                            }}>
                              <Ionicons name="calendar" size={12} color="#666" style={{ marginRight: 4 }} />
                              <Text style={{
                                fontSize: 12,
                                color: '#666',
                                fontWeight: '500',
                                fontFamily: 'Onest'
                              }}>
                                {habit.targetPerWeek}/week
                              </Text>
                          </View>
                            
                            {/* Icons Container - Bottom Right */}
                            <View style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                            }}>
                              {/* Notes Icon */}
                              <TouchableOpacity
                                onPress={() => {
                                  // Open notes viewer modal
                                  setSelectedHabitForViewingNotes(habit);
                                  // Load existing note content if available
                                  const notes = habit.notes || {};
                                  const noteDates = Object.keys(notes);
                                  if (noteDates.length > 0) {
                                    // Get the most recent note
                                    const mostRecentDate = noteDates.sort((a, b) => b.localeCompare(a))[0];
                                    setEditingNoteText(notes[mostRecentDate]);
                                } else {
                                    // Clear text if no existing notes
                                    setEditingNoteText('');
                                  }
                                  setIsNotesViewerModalVisible(true);
                                }}
                                style={{
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: '#f8f9fa',
                                  paddingHorizontal: 8,
                                  paddingVertical: 6,
                                  borderRadius: 12,
                                }}
                              >
                                <Feather 
                                  name="edit-3" 
                                  size={14} 
                                  color="#007AFF" 
                                />
                              </TouchableOpacity>
                              
                              {/* Photo Icon */}
                              {habit.requirePhoto && (
                                        <TouchableOpacity
                                          onPress={() => {
                                    // Check if habit has photos
                                    const photos = habit.photos || {};
                                    const photoEntries = Object.entries(photos);
                                    
                                    if (photoEntries.length > 0) {
                                      // Sort photos by date (most recent first) and show the first one
                                      const sortedPhotos = photoEntries
                                        .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
                                        .map(([date, photoUrl]) => ({
                                          date,
                                          photoUrl,
                                          formattedDate: moment(date).format('MMM D, YYYY')
                                        }));
                                      
                                      // Set up all photos for navigation
                                      setAllPhotosForViewing(sortedPhotos.map(photo => ({
                                        habit,
                                        photoUrl: photo.photoUrl,
                                        date: photo.date,
                                        formattedDate: photo.formattedDate
                                      })));
                                      setCurrentPhotoIndex(0);
                                      
                                      // Show the most recent photo directly
                                            setSelectedPhotoForViewing({ 
                                              habit, 
                                        photoUrl: sortedPhotos[0].photoUrl, 
                                        date: sortedPhotos[0].date, 
                                        formattedDate: sortedPhotos[0].formattedDate 
                                            });
                                            setIsPhotoViewerVisible(true);
                                    } else {
                                      // Show message that no photos exist yet
                                      Alert.alert(
                                        'No Photos Yet',
                                        'This habit requires photos but none have been added yet. Swipe left on the habit to add photos.',
                                        [{ text: 'OK', style: 'default' }]
                                      );
                                    }
                                          }}
                                          style={{
                                            alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#f8f9fa',
                                    paddingHorizontal: 8,
                                    paddingVertical: 6,
                                    borderRadius: 12,
                                  }}
                                >
                                  <Ionicons 
                                    name={Object.keys(habit.photos || {}).length > 0 ? "images" : "camera"} 
                                    size={14} 
                                    color={Object.keys(habit.photos || {}).length > 0 ? "#007AFF" : "#666"} 
                                  />
                                        </TouchableOpacity>
                                      )}
                                    </View>
                          </View>
                          
                          {habit.reminderTime && (
                            <View style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                              marginTop: 8
                            }}>
                              <Ionicons name="time" size={12} color="#999" />
                                <Text style={{
                                fontSize: 12,
                                color: '#999',
                                fontFamily: 'Onest',
                                marginLeft: 4
                              }}>
                                {moment(habit.reminderTime).format('h:mm A')}
                                </Text>
                            </View>
                          )}
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
              contentContainerStyle={{ 
                padding: 16, 
                paddingBottom: 100, // Increased bottom padding for better scrolling
                minHeight: '100%' // Ensures content is scrollable even when short
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true} // Show scroll indicator
              bounces={true} // Enable bounce effect
              alwaysBounceVertical={true} // Always allow vertical bounce
              scrollEventThrottle={16} // Smooth scrolling
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
                    Keyboard.dismiss();
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
                        Keyboard.dismiss();
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
                    if (categories.length === 0) {
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
                          Keyboard.dismiss();
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
                          Keyboard.dismiss();
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
                              Keyboard.dismiss();
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
                              Keyboard.dismiss();
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
                              Keyboard.dismiss();
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
                                  Keyboard.dismiss();
                                } else if (option.value === 'none') {
                                  setSelectedRepeat('none');
                                  setRepeatEndDate(null);
                                  setShowRepeatPicker(false);
                                  Keyboard.dismiss();
                                } else {
                                  setSelectedRepeat(option.value);
                                  setShowRepeatPicker(false);
                                  Keyboard.dismiss();
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
                                Keyboard.dismiss();
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
                                    Keyboard.dismiss();
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

              {/* Add Friends Card */}
              <View style={{
                backgroundColor: 'white',
                borderRadius: 12,
                padding: 16,
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
                            backgroundColor: '#007AFF',
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
                  placeholder="Search friends..."
                  value={searchFriend}
                  onChangeText={setSearchFriend}
                  onFocus={() => setIsSearchFocused(true)}
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
                    borderColor: '#e9ecef',
                  }}
                  placeholderTextColor="#999"
                />
                {(searchFriend.trim() !== '' || isSearchFocused) && (
                  <FlatList
                    data={friends.filter(f =>
                      f.friend_name.toLowerCase().includes(searchFriend.toLowerCase()) ||
                      f.friend_username.toLowerCase().includes(searchFriend.toLowerCase())
                    )}
                    keyExtractor={item => item.friend_id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={{
                          marginRight: 10,
                          alignItems: 'center',
                          opacity: selectedFriends.includes(item.friend_id) ? 0.5 : 1,
                          paddingVertical: 2,
                        }}
                        onPress={() => {
                          setSelectedFriends(prev =>
                            prev.includes(item.friend_id)
                              ? prev.filter(id => id !== item.friend_id)
                              : [...prev, item.friend_id]
                          );
                        }}
                      >
                        {item.friend_avatar && item.friend_avatar.trim() !== '' ? (
                          <Image 
                            source={{ uri: item.friend_avatar }} 
                            style={{ width: 36, height: 36, borderRadius: 18, marginBottom: 4 }} 
                          />
                        ) : (
                          <View 
                            style={{ 
                              width: 36, 
                              height: 36, 
                              borderRadius: 18, 
                              marginBottom: 4,
                              backgroundColor: '#E9ECEF',
                              justifyContent: 'center',
                              alignItems: 'center'
                            }}
                          >
                            <Ionicons name="person" size={16} color="#6C757D" />
                          </View>
                        )}
                        <Text style={{ fontSize: 11, fontFamily: 'Onest', color: '#495057', fontWeight: '500' }}>{item.friend_name}</Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={{ 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        paddingVertical: 16,
                        minWidth: 180
                      }}>
                        <Ionicons name="people-outline" size={20} color="#CED4DA" />
                        <Text style={{ color: '#6C757D', fontSize: 11, marginTop: 4, fontFamily: 'Onest' }}>
                          No friends found
                        </Text>
                      </View>
                    }
                    style={{ minHeight: 70 }}
                  />
                )}
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
              contentContainerStyle={{ padding: 16, paddingBottom: 100, minHeight: '100%' }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
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
                  ref={newHabitInputRef}
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
                      onPress={() => {
                        setHabitTargetPerWeek(goal);
                        Keyboard.dismiss();
                      }}
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
                      onPress={() => {
                        setNewHabitColor(color);
                        Keyboard.dismiss();
                      }}
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
                          Keyboard.dismiss();
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
                              Keyboard.dismiss();
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
                              Keyboard.dismiss();
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
                              Keyboard.dismiss();
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
                        onPress={() => {
                          setHabitRequirePhoto(prev => !prev);
                          Keyboard.dismiss();
                        }}
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
              paddingVertical: 16,
              paddingTop: 20,
              borderBottomWidth: 1,
              borderBottomColor: '#f0f0f0',
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
                  <Ionicons name="camera" size={24} color="#007AFF" style={{ marginRight: 12 }} />
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
                backdropFilter: 'blur(10px)',
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
          <View style={{ 
          flex: 1, 
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
        }}>
            <View style={{ 
            position: 'absolute',
            top: '25%',
            right: 20,
                    backgroundColor: 'white', 
            borderRadius: 12,
            width: 280,
            maxHeight: 400,
                    shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
                    shadowRadius: 8,
            elevation: 8,
            overflow: 'hidden',
          }}>
            {/* Arrow pointing to the icon */}
            <View style={{
              position: 'absolute',
              top: -8,
              right: 20,
              width: 0,
              height: 0,
              backgroundColor: 'transparent',
              borderStyle: 'solid',
              borderLeftWidth: 8,
              borderRightWidth: 8,
              borderBottomWidth: 8,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: 'white',
              zIndex: 1,
            }} />
            
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
                maxHeight: 280,
              }}
              placeholder="Start writing..."
              placeholderTextColor="#999"
              value={editingNoteText}
              onChangeText={setEditingNoteText}
              multiline
              textAlignVertical="top"
              autoFocus
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
                  backgroundColor: editingNoteText.trim() ? '#007AFF' : '#f0f0f0',
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
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}