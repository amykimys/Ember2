import React, { useCallback, useMemo, useRef } from 'react';
import 'react-native-reanimated'; // 👈 must be FIRST import
import { Menu } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
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

export default function TodoScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
  const modalAnimation = useRef(new Animated.Value(0)).current;
  const reminderButtonRef = useRef<View>(null);
  const [reminderButtonLayout, setReminderButtonLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({ x: 0, y: 0, width: 0, height: 0 });
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
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
  const repeatButtonRef = useRef<View>(null);
  const [repeatButtonLayout, setRepeatButtonLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({ x: 0, y: 0, width: 0, height: 0 });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateButtonLayout, setDateButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const dateButtonRef = useRef<View>(null);
  const [lastPickerActivity, setLastPickerActivity] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [user, setUser] = useState<User | null>(null);

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

      // Create the new task
      const newTodoItem: Todo = {
        id: uuidv4(),
        text: newTodo.trim(),
        description: newDescription.trim(),
        completed: false,
        categoryId: selectedCategoryId || null,
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
          category_id: selectedCategoryId || null,
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
      const updatedTodo = {
        ...editingTodo,
        text: newTodo,
        description: newDescription,
        categoryId: selectedCategoryId,
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
          id: Date.now().toString(),
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
              user_id: user.id
            });
          
          if (error) {
            console.error('Error saving category:', error);
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
        }
      }
  
      setEditingTodo(null);
      resetForm();
      hideModal();
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
  const fetchData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Fetch categories and tasks in parallel
      const [categoriesResponse, tasksResponse] = await Promise.all([
        supabase
          .from('categories')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'task'),
        supabase
          .from('todos')
          .select('*')
          .eq('user_id', user.id)
      ]);

      if (categoriesResponse.error) {
        console.error('[Todo] Error fetching categories:', categoriesResponse.error);
        return;
      }

      if (tasksResponse.error) {
        console.error('[Todo] Error fetching tasks:', tasksResponse.error);
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
    let refreshInterval: NodeJS.Timeout;

    const setupSubscriptions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Initial data fetch
      await fetchData();

      // Set up real-time subscriptions
      categoriesSubscription = supabase
        .channel('categories-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'categories',
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            console.log('[Todo] Categories changed, refreshing...');
            await fetchData();
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
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            console.log('[Todo] Todos changed, refreshing...');
            await fetchData();
          }
        )
        .subscribe();

      // Set up periodic refresh every minute
      refreshInterval = setInterval(fetchData, 60000);
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
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [user]); // Only re-run when user changes

  // Add pull-to-refresh functionality
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

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
    requestAnimationFrame(() => {
      Animated.timing(modalAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };
  
  const hideModal = () => {
    Animated.timing(modalAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsNewTaskModalVisible(false);
    });
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
    setCustomRepeatFrequency('1');
    setCustomRepeatUnit('days');
    setSelectedWeekDays([]);
    showModal();
  };

  useEffect(() => {
  }, [isNewCategoryModalVisible]);

  useEffect(() => {
  }, [showRepeatEndDatePicker]);
  
  // Add this useEffect to handle the auto-close timer
  useEffect(() => {
    if (!showReminderPicker) return;

    const timer = setTimeout(() => {
      const now = Date.now();
      if (now - lastPickerActivity >= 2000) {
        setShowReminderPicker(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [showReminderPicker, lastPickerActivity]);
  
  
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
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-20, 20]}
      >
        <View style={styles.container}>
          {/* Rest of your existing JSX */}
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.menuButton}>              
            </TouchableOpacity>
          </View>
          
          {/* Add Calendar Strip Header */}
        <View style={{ paddingHorizontal: 12, marginHorizontal: -18, marginBottom: -10 }}>
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'center', 
            paddingHorizontal: 0,
            position: 'relative'
          }}>
          
            <TouchableOpacity onPress={goToToday}>
              <Text style={{ 
                color: '#3A3A3A', 
                fontSize: 19, 
                fontWeight: 'bold', 
                marginBottom: 0, 
                textAlign: 'center', 
                fontFamily: 'Onest' 
              }}>
                {moment(currentDate).format('MMMM YYYY')}
              </Text>
            </TouchableOpacity>
            <View style={{ width: 20, position: 'absolute', right: 24 }} />
          </View>
                <CalendarStrip
                  scrollable
                  startingDate={moment().subtract(3, 'days')}
                  showMonth
                  leftSelector={<View />}
                  rightSelector={<View />}
                  style={{ height: 100, paddingTop: 0, paddingBottom: 3, paddingHorizontal: 12 }}
                  calendarColor={'#fff'}
                  calendarHeaderStyle={{
                    display: 'none'
                  }}
                  dateNumberStyle={{ color: '#888888', fontSize: 17, fontFamily: 'Onest', marginTop: 0 }}
                  dateNameStyle={{ color: '#888888', fontFamily: 'Onest', marginBottom: 0 }}
                  highlightDateNumberStyle={{
                    color: moment().isSame(moment(currentDate), 'day') ? '#A0C3B2' : '#3A3A3A',
                    fontSize: 34,
                    fontFamily: 'Onest',
                  }}
                  highlightDateNameStyle={{
                    color: moment().isSame(moment(currentDate), 'day') ? '#A0C3B2' : '#3A3A3A',
                    fontSize: 13,
                    fontFamily: 'Onest',
                  }}
                  selectedDate={moment(currentDate)}
                  onDateSelected={(date) => setCurrentDate(date.toDate())}
                  customDatesStyles={[
                    {
                      date: moment().format('YYYY-MM-DD'),
                      dateNameStyle: {
                        color: '#A0C3B2',
                        fontWeight: '400',
                      },
                      dateNumberStyle: {
                        color: '#A0C3B2',
                        fontWeight: 'bold',
                      },
                    }
                  ]}
                />
              
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
            {isLoading ? (
              <View style={[styles.emptyState, { marginTop: 125 }]}>
                <ActivityIndicator size="large" color="#FF9A8B" />
              </View>
            ) : filteredTodos.length === 0 ? (
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
                  fontWeight: '700'
                }]}>no tasks!</Text>
                <Text style={[styles.emptyStateSubtitle, { 
                  textAlign: 'center',
                  width: '100%'
                }]}>Take a breather :)</Text>
              </View>
            ) : (
              <>
                {categories.map(category => renderCategory(category))}
                {renderUncategorizedTodos()}
                {renderCompletedTodos()}
              </>
            )}
          </ScrollView>

          {/* ADD TASK BUTTON */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddButtonPress}
          >
            <Ionicons name="add" size={22} color="white" />
          </TouchableOpacity>
        </View>
      </PanGestureHandler>

      {/* New Task Modal */}
      <Modal
        animationType="none"
        transparent={true}
        visible={isNewTaskModalVisible}
        onRequestClose={handleCloseNewTaskModal}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableWithoutFeedback
            onPress={(e) => {
              // Only dismiss keyboard and hide modal if we're not interacting with the repeat picker
              if (e.target === e.currentTarget && !showRepeatPicker) {
                Keyboard.dismiss();
                hideModal();
              }
            }}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <Animated.View 
                style={{
                  backgroundColor: 'white',
                  position: 'relative',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  padding: 10,
                  height: showCategoryBox ? '45%' : '35%',
                  width: '100%',
                  transform: [{
                    translateY: modalAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [600, 0]
                    })
                  }],
                }}
              >
                {/* Add the repeat options floating panel */}
                {showRepeatPicker && (
                  <>
                    <TouchableOpacity
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'transparent',
                        zIndex: 999,
                      }}
                      activeOpacity={1}
                      onPress={() => {
                        // Don't dismiss keyboard when closing repeat picker
                        setShowRepeatPicker(false);
                      }}
                    />
                    <View
                      style={{
                        position: 'absolute',
                        bottom: repeatButtonLayout.height + 18,
                        left: repeatButtonLayout.x,
                        backgroundColor: 'white',
                        borderRadius: 12,
                        shadowColor: '#000',
                        shadowOffset: {
                          width: 0,
                          height: 2,
                        },
                        shadowOpacity: 0.1,
                        shadowRadius: 6,
                        elevation: 4,
                        zIndex: 1000,
                        maxHeight: selectedRepeat && selectedRepeat !== 'none' && selectedRepeat !== 'custom' ? 240 : 190,
                        width: 175,
                      }}
                    >
                      <ScrollView 
                        style={{ padding: 6 }}
                        keyboardShouldPersistTaps="always"
                      >
                        {REPEAT_OPTIONS.map((option) => (
                          <TouchableOpacity
                            key={option.value}
                            onPress={() => {
                              if (option.value === 'custom') {
                                setSelectedRepeat(option.value);
                                setShowRepeatPicker(false);
                                // Keep keyboard up
                                if (newTodoInputRef.current) {
                                  newTodoInputRef.current.focus();
                                }
                              } else if (option.value === 'none') {
                                setSelectedRepeat('none');
                                setRepeatEndDate(null);
                                setShowRepeatPicker(false);
                                // Keep keyboard up
                                if (newTodoInputRef.current) {
                                  newTodoInputRef.current.focus();
                                }
                              } else {
                                setSelectedRepeat(option.value);
                                // Keep keyboard up
                                if (newTodoInputRef.current) {
                                  newTodoInputRef.current.focus();
                                }
                              }
                            }}
                            style={{
                              paddingVertical: 8,
                              paddingHorizontal: 10,
                              borderRadius: 8,
                              backgroundColor: selectedRepeat === option.value ? '#f0f0f0' : 'transparent',
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={{ 
                                fontSize: 14,
                                color: '#3A3A3A',
                                fontFamily: 'Onest',
                                fontWeight: selectedRepeat === option.value ? '600' : '400'
                              }}>
                                {option.label}
                              </Text>
                              {selectedRepeat === option.value && (
                                <Ionicons name="checkmark" size={16} color="#FF9A8B" />
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}

                        {selectedRepeat && selectedRepeat !== 'none' && selectedRepeat !== 'custom' && (
                          <>
                            <View style={{ 
                              height: 1, 
                              backgroundColor: '#f0f0f0', 
                              marginVertical: 6,
                              marginHorizontal: 4 
                            }} />
                            <TouchableOpacity
                              onPress={() => {
                                setShowRepeatEndDatePicker(true);
                              }}
                              style={{
                                paddingVertical: 8,
                                paddingHorizontal: 10,
                                borderRadius: 8,
                                backgroundColor: repeatEndDate ? '#f0f0f0' : 'transparent',
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={{ 
                                  fontSize: 14,
                                  color: '#3A3A3A',
                                  fontFamily: 'Onest',
                                  fontWeight: repeatEndDate ? '600' : '400'
                                }}>
                                  {repeatEndDate ? 
                                    `Ends ${moment(repeatEndDate).format('MMM D, YYYY')}` : 
                                    'Set end date'}
                                </Text>
                                {repeatEndDate ? (
                                  <Ionicons name="checkmark" size={16} color="#FF9A8B" />
                                ) : (
                                  <Ionicons name="calendar-outline" size={16} color="#666" />
                                )}
                              </View>
                            </TouchableOpacity>
                          </>
                        )}
                      </ScrollView>
                    </View>
                  </>
                )}
                {/* Add DateTimePicker for end date */}
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

               

  {/* Date Picker */}
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
      <DateTimePicker
        value={taskDate instanceof Date ? taskDate : new Date()}
        mode="date"
        display="spinner"
        onChange={(event, selectedDate) => {
          if (selectedDate) {
            setTaskDate(selectedDate);
            setShowDatePicker(false);
          }
        }}
        minimumDate={new Date()}
        style={{
          position: 'absolute',
          bottom: dateButtonLayout.height - 10,
          left: dateButtonLayout.x - 50,
          backgroundColor: 'white',
          borderRadius: 16,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 8,
          },
          shadowOpacity: 0.2,
          shadowRadius: 16,
          elevation: 12,
          zIndex: 1000,
          width: 150,
          height: 130,
          transform: [{ scale: 0.7 }],
        }}
        textColor="#333"
      />
    </View>
  )}

  {/* Reminder Picker */}
  {showReminderPicker && (
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
        onPress={() => {
          setLastPickerActivity(Date.now());
          setShowReminderPicker(false);
        }}
      />
      <DateTimePicker
        value={reminderTime instanceof Date ? reminderTime : new Date()}
        mode="datetime"
        display="spinner"
        onChange={(event, selectedTime) => {
          setLastPickerActivity(Date.now()); // Update activity timestamp
          if (selectedTime) {
            if (selectedTime > new Date()) {
              setReminderTime(selectedTime);
              // Don't close the picker immediately, let the timer handle it
            }
          }
        }}
        minimumDate={new Date()}
        style={{
          position: 'absolute',
          bottom: reminderButtonLayout.height - 10,
          left: reminderButtonLayout.x - 50,
          backgroundColor: 'white',
          borderRadius: 16,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 8,
          },
          shadowOpacity: 0.2,
          shadowRadius: 16,
          elevation: 12,
          zIndex: 1000,
          width: 160,
          height: 140,
          transform: [{ scale: 0.7 }],
        }}
        textColor="#333"
      />
    </View>
  )}

                <View style={{ flexGrow: 1 }}>
                  <ScrollView
                    style={{ flex: 1 }}
                    keyboardShouldPersistTaps="always"
                    contentContainerStyle={{ paddingBottom: 160 }}
                  >
                    {/* Title Input */}
                    <TextInput
                      ref={newTodoInputRef}
                      style={{
                        fontSize: 18,
                        color: '#1a1a1a',
                        padding: 10,
                        backgroundColor: 'white',
                        borderRadius: 12,
                        marginBottom: -10,
                        fontFamily: 'Onest',
                      }}
                      value={newTodo}
                      onChangeText={setNewTodo}
                      placeholder={editingTodo ? "Edit task..." : "What needs to be done?"}
                      placeholderTextColor="#999"
                      returnKeyType="next"
                      onSubmitEditing={() => newDescriptionInputRef.current?.focus()}
                    />

                    <TextInput
                      ref={newDescriptionInputRef}
                      style={{
                        fontSize: 15,
                        color: '#1a1a1a',
                        padding: 10,
                        backgroundColor: 'white',
                        borderRadius: 12,
                        minHeight: 75,
                        marginTop: 6,
                        textAlignVertical: 'top',
                        marginBottom: 20,
                        fontFamily: 'Onest',
                      }}
                      value={newDescription}
                      onChangeText={setNewDescription}
                      placeholder="Add description (optional)"
                      placeholderTextColor="#999"
                      multiline
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />
                  </ScrollView>

                  {showCategoryBox && (
                    <View
                      style={{
                        marginLeft: 8,
                        marginBottom: 28,
                        position: 'relative',
                        zIndex: 2,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false}
                          keyboardShouldPersistTaps="always"
                          contentContainerStyle={{ paddingRight: 4 }}
                          style={{ flexGrow: 0, flexShrink: 1, flexBasis: 'auto' }}
                        >
                          {categories
                            .filter(cat => cat.label.toLowerCase() !== 'todo')
                            .map((cat) => (
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
                                        onPress: async () => {
                                          try {
                                            const { data: { user } } = await supabase.auth.getUser();
                                            if (!user) {
                                              Alert.alert('Error', 'You must be logged in to delete categories.');
                                              return;
                                            }

                                            // First, delete all tasks in this category
                                            const { error: tasksError } = await supabase
                                              .from('todos')
                                              .delete()
                                              .eq('category_id', cat.id)
                                              .eq('user_id', user.id);

                                            if (tasksError) {
                                              console.error('Error deleting tasks:', tasksError);
                                              Alert.alert('Error', 'Failed to delete tasks in this category. Please try again.');
                                              return;
                                            }

                                            // Then delete the category
                                            const { error: categoryError } = await supabase
                                              .from('categories')
                                              .delete()
                                              .eq('id', cat.id)
                                              .eq('user_id', user.id);

                                            if (categoryError) {
                                              console.error('Error deleting category:', categoryError);
                                              Alert.alert('Error', 'Failed to delete category. Please try again.');
                                              return;
                                            }

                                            // Update local state
                                            setCategories(prev => prev.filter(category => category.id !== cat.id));
                                            
                                            // If the deleted category was selected, clear the selection
                                            if (selectedCategoryId === cat.id) {
                                              setSelectedCategoryId('');
                                            }

                                            // Provide haptic feedback
                                            if (Platform.OS !== 'web') {
                                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            }
                                          } catch (error) {
                                            console.error('Error in category deletion:', error);
                                            Alert.alert('Error', 'An unexpected error occurred. Please try again.');
                                          }
                                        },
                                      },
                                    ]
                                  );
                                }}
                                delayLongPress={500}
                                style={({ pressed }) => ({
                                  backgroundColor: '#fafafa',
                                  paddingVertical: 5,
                                  paddingHorizontal: 8,
                                  borderRadius: 9,
                                  borderWidth: (pressed || selectedCategoryId === cat.id) ? 1 : 0,
                                  borderColor: cat.color,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 6,
                                  marginRight: 8,
                                })}
                              >
                                <View style={{ 
                                  width: 6, 
                                  height: 6, 
                                  borderRadius: 3, 
                                  backgroundColor: cat.color,
                                }} />
                                <Text style={{ 
                                  color: '#3a3a3a', 
                                  fontSize: 12, 
                                  fontFamily: 'Onest',
                                  fontWeight: selectedCategoryId === cat.id ? '600' : '500'
                                }}>
                                  {cat.label}
                                </Text>
                              </Pressable>
                            ))}

                          {showNewCategoryInput ? (
                            <View style={{ 
                              flexDirection: 'row', 
                              alignItems: 'center',
                              backgroundColor: '#fafafa',
                              paddingVertical: 5,
                              paddingHorizontal: 8,
                              borderRadius: 9,
                              borderWidth: 1,
                              borderColor: newCategoryColor,
                              marginRight: 8,
                            }}>
                              <View style={{ 
                                width: 6, 
                                height: 6, 
                                borderRadius: 3, 
                                backgroundColor: newCategoryColor,
                                marginRight: 6,
                              }} />
                              <TextInput
                                ref={categoryInputRef}
                                style={{
                                  fontSize: 12,
                                  color: '#3a3a3a',
                                  fontFamily: 'Onest',
                                  padding: 0,
                                  margin: 0,
                                  width: 70,
                                  maxWidth: 70,
                                }}
                                value={newCategoryName}
                                onChangeText={setNewCategoryName}
                                placeholder="New category"
                                placeholderTextColor="#999"
                                autoFocus
                              />
                              <View style={{ 
                                flexDirection: 'row', 
                                alignItems: 'center',
                                marginLeft: 4,
                                gap: 8,
                              }}>
                                <TouchableOpacity
                                  onPress={() => setShowNewCategoryInput(false)}
                                >
                                  <Ionicons name="close" size={14} color="#666" />
                                </TouchableOpacity>
                                {newCategoryName.trim() && (
                                  <TouchableOpacity
                                    onPress={async () => {
                                      if (!newCategoryName.trim()) return;
                                      
                                      try {
                                        console.log('[Category] Starting category creation...');
                                        const { data: { user } } = await supabase.auth.getUser();
                                        if (!user) {
                                          console.log('[Category] No user found');
                                          Alert.alert('Error', 'You must be logged in to create categories.');
                                          return;
                                        }
                                    
                                        const newCategory = {
                                          id: uuidv4(),
                                          label: newCategoryName.trim(),
                                          color: newCategoryColor,
                                        };
                                    
                                        console.log('[Category] Saving category:', newCategory);
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
                                    
                                            if (categoryError) {
                                              console.error('[Category] Error saving category:', categoryError);
                                              Alert.alert('Error', 'Failed to save category. Please try again.');
                                              return;
                                            }

                                            if (!savedCategory) {
                                              console.error('[Category] No category returned after save');
                                              Alert.alert('Error', 'Failed to save category. Please try again.');
                                              return;
                                            }
                                    
                                            console.log('[Category] Category saved successfully:', savedCategory);
                                            
                                            // Update local state
                                            setCategories(prev => {
                                              const updatedCategories = [...prev, savedCategory];
                                              console.log('[Category] Updated categories:', updatedCategories);
                                              return updatedCategories;
                                            });
                                            
                                            // Select the new category
                                            setSelectedCategoryId(savedCategory.id);
                                            console.log('[Category] Selected new category:', savedCategory.id);
                                            
                                            // Reset form
                                            setNewCategoryName('');
                                            setShowNewCategoryInput(false);
                                        
                                            // Provide haptic feedback
                                            if (Platform.OS !== 'web') {
                                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                            }
                                          } catch (error) {
                                            console.error('[Category] Error in category creation:', error);
                                            Alert.alert('Error', 'An unexpected error occurred. Please try again.');
                                          }
                                        }}
                                        style={{
                                          opacity: newCategoryName.trim() ? 1 : 0.5,
                                          padding: 4, // Add padding to make the touch target larger
                                        }}
                                        activeOpacity={0.7} // Add visual feedback when pressed
                                      >
                                        <Ionicons 
                                          name="checkmark" 
                                          size={16} 
                                          color={newCategoryName.trim() ? "#FF9A8B" : "#999"} 
                                        />
                                      </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          ) : (
                            <TouchableOpacity
                              onPress={() => {
                                setShowNewCategoryInput(true);
                                setNewCategoryName('');
                                setNewCategoryColor('#BF9264');
                              }}
                              style={{
                                backgroundColor: '#fafafa',
                                paddingVertical: 5,
                                paddingHorizontal: 8,
                                borderRadius: 9,
                                borderWidth: 0,
                                borderColor: '#eee',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Ionicons name="add" size={14} color="#666" />
                            </TouchableOpacity>
                          )}
                        </ScrollView>
                      </View>

                      {showNewCategoryInput && (
                        <View style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center',
                          marginLeft: 8,
                          marginBottom: 12,
                        }}>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingRight: 20 }}
                          >
                            {['#BF9264', '#6F826A', '#BBD8A3', '#F0F1C5', '#FFCFCF'].map((color) => (
                              <TouchableOpacity
                                key={color}
                                onPress={() => setNewCategoryColor(color)}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 12,
                                  backgroundColor: color,
                                  marginRight: 8,
                                  marginLeft: 2,
                                  opacity: newCategoryColor === color ? 1 : (newCategoryColor === '#E3F2FD' ? 1 : 0.6)
                                }}
                              />
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}
                  </View>

                {/* Quick Action Row - Fixed at bottom */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    zIndex: 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {/* Category Button */}
                    <TouchableOpacity
                      onPress={() => {
                        setShowCategoryBox(prev => !prev);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: selectedCategoryId ? '#E5F6FF' : 'transparent',
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 8,
                        marginLeft: 3,
                        marginRight: selectedCategoryId ? 10 : 2,
                      }}
                    >
                      <Ionicons
                        name="folder-outline"
                        size={18}
                        color={
                          selectedCategoryId
                            ? categories.find(cat => cat.id === selectedCategoryId)?.color || '#666'
                            : '#666'
                        }
                      />
                      {selectedCategoryId && (
                        <Text style={{ 
                          marginLeft: 5,
                          fontSize: 11,
                          color: categories.find(cat => cat.id === selectedCategoryId)?.color || '#666',
                          fontFamily: 'Onest',
                          fontWeight: '500'
                        }}>
                          {categories.find(cat => cat.id === selectedCategoryId)?.label}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {/* Calendar Button */}
                    <TouchableOpacity
                      ref={dateButtonRef}
                      onPress={() => {
                        dateButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                          setDateButtonLayout({ x: pageX, y: pageY, width, height });
                          setShowDatePicker(true);
                        });
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: taskDate ? '#E5F6FF' : 'transparent',
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 8,
                        marginRight: taskDate ? 10 : 0,
                      }}
                    >
                      <Ionicons 
                        name="calendar-outline" 
                        size={17} 
                        color={taskDate ? '#007AFF' : '#666'} 
                      />
                      {taskDate && (
                        <TouchableOpacity
                          onPress={() => {
                            dateButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                              setDateButtonLayout({ x: pageX, y: pageY, width, height });
                              setShowDatePicker(true);
                            });
                          }}
                          onLongPress={() => {
                            setTaskDate(null);
                            if (Platform.OS !== 'web') {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }
                          }}
                          delayLongPress={500}
                          style={{ marginLeft: 5 }}
                        >
                          <Text style={{ 
                            fontSize: 12,
                            color: '#007AFF',
                            fontFamily: 'Onest',
                            fontWeight: '500'
                          }}>
                            {(() => {
                              const today = moment().startOf('day');
                              const tomorrow = moment().add(1, 'day').startOf('day');
                              const taskMoment = moment(taskDate).startOf('day');
                              
                              if (taskMoment.isSame(today)) {
                                return 'Today';
                              } else if (taskMoment.isSame(tomorrow)) {
                                return 'Tomorrow';
                              } else {
                                return moment(taskDate).format('MMM D');
                              }
                            })()}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>

                    {/* Reminder Button */}
                    <TouchableOpacity
                      ref={reminderButtonRef}
                      onPress={() => {
                        reminderButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                          setReminderButtonLayout({ x: pageX, y: pageY, width, height });
                          setShowReminderPicker(true);
                        });
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: reminderTime ? '#FFE5E5' : 'transparent',
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 8,
                        marginRight: reminderTime ? 10 : 0,
                      }}
                    >
                      <Ionicons 
                        name="notifications-outline" 
                        size={17} 
                        color={reminderTime ? '#FF4D4D' : '#666'} 
                      />
                      {reminderTime && (
                        <Text style={{ 
                          marginLeft: 3,
                          fontSize: 12,
                          color: '#FF4D4D',
                          fontFamily: 'Onest',
                          fontWeight: '500'
                        }}>
                          {moment(reminderTime).format('h:mm A')}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {/* Repeat Button */}
                    <TouchableOpacity 
                      ref={repeatButtonRef}
                      onPress={() => {
                        repeatButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                          setRepeatButtonLayout({ x: pageX, y: pageY, width, height });
                          setShowRepeatPicker(true);
                        });
                      }}
                      style={{ 
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: selectedRepeat !== 'none' ? '#FFF9E6' : 'transparent',
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 8,
                        marginRight: selectedRepeat !== 'none' ? 10 : 0,
                      }}
                    >
                      <Ionicons 
                        name="repeat" 
                        size={17} 
                        color={selectedRepeat !== 'none' ? '#FF9500' : '#666'} 
                      />
                      {selectedRepeat !== 'none' && (
                        <Text style={{ 
                          marginLeft: 3,
                          fontSize: 12,
                          color: '#FF9500',
                          fontFamily: 'Onest',
                          fontWeight: '500'
                        }}>
                          {REPEAT_OPTIONS.find(opt => opt.value === selectedRepeat)?.label}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Sticky Send Button */}
                  <View style={{ 
                    position: 'absolute', 
                    right: 10, 
                    top: 0, 
                    bottom: 0, 
                    justifyContent: 'center',
                    backgroundColor: 'white',
                    paddingLeft: 10,
                  }}>
                    <TouchableOpacity
                      onPress={editingTodo ? handleEditSave : handleSave}
                      disabled={!newTodo.trim()}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 15,
                        backgroundColor: newTodo.trim() ? '#FF6B6B' : '#ECE7E1',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="arrow-up" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
        
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
                  {['#BF9264', '#6F826A', '#BBD8A3', '#F0F1C5', '#FFCFCF'].map((color) => {
                    const isSelected = newCategoryColor === color;
                    return (
                      <TouchableOpacity
                        key={color}
                        onPress={() => setNewCategoryColor(color)}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 15,
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

      {/* Reminder Time Picker */}
      {showReminderPicker && (
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
            onPress={() => {
              setLastPickerActivity(Date.now());
              setShowReminderPicker(false);
            }}
          />
          <DateTimePicker
            value={reminderTime instanceof Date ? reminderTime : new Date()}
            mode="datetime"
            display="spinner"
            onChange={(event, selectedTime) => {
              setLastPickerActivity(Date.now()); // Update activity timestamp
              if (selectedTime) {
                if (selectedTime > new Date()) {
                  setReminderTime(selectedTime);
                  // Don't close the picker immediately, let the timer handle it
                }
              }
            }}
            minimumDate={new Date()}
            style={{
              position: 'absolute',
              bottom: reminderButtonLayout.height - 10,
              left: reminderButtonLayout.x - 15,
              backgroundColor: 'white',
              borderRadius: 16,
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 8,
              },
              shadowOpacity: 0.2,
              shadowRadius: 16,
              elevation: 12,
              zIndex: 1000,
              width: 160,
              height: 140,
              transform: [{ scale: 0.7 }],
            }}
            textColor="#333"
          />
        </View>
      )}

    </GestureHandlerRootView>
  );
}