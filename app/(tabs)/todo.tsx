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
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PanGestureHandler, GestureHandlerRootView, State, Swipeable } from 'react-native-gesture-handler';
import styles from '../../styles/todo.styles';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
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
    completed: true, // ✅ start collapsed
  });  const [currentDate, setCurrentDate] = useState(new Date());
  const [hasTriggeredSwipeHaptic, setHasTriggeredSwipeHaptic] = useState(false);
  const [selectedRepeat, setSelectedRepeat] = useState<RepeatOption>('none');
  const [showRepeatOptions, setShowRepeatOptions] = useState(false);
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);
  const [taskDate, setTaskDate] = useState<Date | null>(null);
  const [showTaskDatePicker, setShowTaskDatePicker] = useState(false);
  const [repeatEndDate, setRepeatEndDate] = useState<Date | null>(null);
  const [showRepeatEndDatePicker, setShowRepeatEndDatePicker] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<keyof typeof THEMES>('pastel');
  const [customRepeatFrequency, setCustomRepeatFrequency] = useState('1');
  const [customRepeatUnit, setCustomRepeatUnit] = useState<'days' | 'weeks' | 'months'>('days');
  const [selectedWeekDays, setSelectedWeekDays] = useState<WeekDay[]>([]);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [swipingTodoId, setSwipingTodoId] = useState<string | null>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [isNewTaskModalVisible, setIsNewTaskModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isModalTransitioning, setIsModalTransitioning] = useState(false);
  const [isDatePickerTransitioning, setIsDatePickerTransitioning] = useState(false);
  const [selectedHour, setSelectedHour] = useState('12');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedAmPm, setSelectedAmPm] = useState('AM');
  const [currentWeek, setCurrentWeek] = useState<Date[]>([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
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
  const [isMonthView, setIsMonthView] = useState(false);
  const calendarStripRef = useRef<any>(null);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showCategoryBox, setShowCategoryBox] = useState(false);
  const categoryInputRef = useRef<TextInput>(null);
  const [isNewCategoryModalVisible, setIsNewCategoryModalVisible] = useState(false);
  const [isTestModalVisible, setIsTestModalVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [selectedDay, setSelectedDay] = useState(new Date().getDate().toString().padStart(2, '0'));
  const [showCustomDatesPicker, setShowCustomDatesPicker] = useState(false);
  const [customSelectedDates, setCustomSelectedDates] = useState<string[]>([]);
  const [selectedDateStrings, setSelectedDateStrings] = useState<string[]>([]);
  const [isSwiping, setIsSwiping] = useState(false);



  const years = Array.from({ length: 100 }, (_, i) => (new Date().getFullYear() + i).toString());
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));

  const today = moment();
  const todayStr = today.format('YYYY-MM-DD');
  const isTodaySelected = moment(currentDate).format('YYYY-MM-DD') === todayStr;


  const customDatesStyles = [
    {
      date: todayStr,
      dateNameStyle: {
        color: isTodaySelected ? '#FFB6B9' : '#FFB6B9',
        fontWeight: 'bold',
      },
      dateNumberStyle: {
        color: isTodaySelected ? '#FFB6B9' : '#FFB6B9',
        fontWeight: 'bold',
      },
    },
  ];

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
    setCurrentDate(new Date());
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
  
    console.log('Starting save process...');
    console.log('New todo:', newTodo);
  
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        Alert.alert('Error', 'You must be logged in to create tasks.');
        return;
      }

      // Check current categories
      await checkCategories();

      // First, handle new category creation if needed
      let finalCategoryId: string | null = selectedCategoryId;

      if (showNewCategoryInput && newCategoryName.trim()) {
        const newCategory = {
          id: uuidv4(),
          label: newCategoryName.trim(),
          color: newCategoryColor,
        };
                
        // Save new category to Supabase
        const { data: savedCategory, error: categoryError } = await supabase
          .from('categories')
          .insert({
            id: newCategory.id,
            label: newCategory.label,
            color: newCategory.color,
            user_id: user.id
          })
          .select()
          .single();
        
        if (categoryError) {
          console.error('Error saving category:', categoryError);
          Alert.alert('Error', 'Failed to save category. Please try again.');
          return;
        }

        if (!savedCategory) {
          console.error('No category data returned after save');
          Alert.alert('Error', 'Failed to save category. Please try again.');
          return;
        }
        
        console.log('Category saved successfully:', savedCategory);
        
        // Update local state with new category
        setCategories(prev => {
          const updatedCategories = [...prev, savedCategory];
          console.log('Updated categories:', updatedCategories);
          return updatedCategories;
        });
        
        finalCategoryId = savedCategory.id;
      }

      // If no category is selected, set it to null
      if (!finalCategoryId) {
      
        const { data: existingTodoCategory, error: fetchError } = await supabase
          .from('categories')
          .select('*')
          .eq('user_id', user.id)
          .eq('label', 'todo')
          .single();
      
        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
          console.error('Error fetching default todo category:', fetchError);
          Alert.alert('Error', 'Failed to fetch default category.');
          return;
        }
      
        if (existingTodoCategory) {
          finalCategoryId = existingTodoCategory.id;
        } else {
          const defaultCategory = {
            id: uuidv4(),
            label: 'todo',
            color: '#E0E0E0', // pick any neutral color
          };
      
          const { data: newDefaultCategory, error: createError } = await supabase
            .from('categories')
            .insert({
              id: defaultCategory.id,
              label: defaultCategory.label,
              color: defaultCategory.color,
              user_id: user.id
            })
            .select()
            .single();
      
          if (createError || !newDefaultCategory) {
            console.error('Error creating default "todo" category:', createError);
            Alert.alert('Error', 'Failed to create default category.');
            return;
          }
      
          console.log('✅ Created new default "todo" category:', newDefaultCategory);
          setCategories(prev => [...prev, newDefaultCategory]);
          finalCategoryId = newDefaultCategory.id;
        }
      }
      
      console.log('Final categoryId before task creation:', finalCategoryId);

      const existsLocally = categories.some(c => c.id === finalCategoryId);
      if (!existsLocally) {
        console.error('Selected category not found in local state:', finalCategoryId);
        Alert.alert('Error', 'Selected category is no longer available.');
        return;
      }


      // Verify category exists if one is selected
      if (finalCategoryId) {
        const { data: categoryData, error: categoryCheckError } = await supabase
          .from('categories')
          .select('id')
          .eq('id', finalCategoryId);

        if (categoryCheckError) {
          console.error('Category verification failed:', categoryCheckError);
          Alert.alert('Error', 'Error verifying category. Please try again.');
          return;
        }

        if (!categoryData || categoryData.length === 0) {
          console.error('Category not found:', finalCategoryId);
          Alert.alert('Error', 'Selected category does not exist. Please try again.');
          return;
        }
      }
  
      // Then create the new task
      console.log('Creating new task...');
      const newTodoItem: Todo = {
        id: uuidv4(),
        text: newTodo.trim(),
        description: newDescription.trim(),
        completed: false,
        categoryId: finalCategoryId,
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
          category_id: finalCategoryId,
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
      console.log('New task created:', newTodoItem);
      
      // Schedule reminder if set
      if (reminderTime) {
        await scheduleReminderNotification(newTodo.trim(), reminderTime);
      }

      // Reset form and close modal
      resetForm();
      setIsNewTaskModalVisible(false);
      Keyboard.dismiss(); // Only dismiss keyboard when task is actually saved
      
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
  
    if (endDate && date > endDate) return false;
  
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
  
  const todayTodos = todos.filter(todo => doesTodoBelongToday(todo, currentDate));


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
        console.log('Deleting task from Supabase...');
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
      console.log('Editing task:', todo);
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
      
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        Alert.alert('Error', 'You must be logged in to delete categories.');
        return;
      }

      // First, delete all tasks in this category
      const { error: tasksError } = await supabase
        .from('todos')
        .delete()
        .eq('category_id', categoryId)
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
        .eq('id', categoryId)
        .eq('user_id', user.id);

      if (categoryError) {
        console.error('Error deleting category:', categoryError);
        Alert.alert('Error', 'Failed to delete category. Please try again.');
        return;
      }
      
      // Update todos first
      setTodos(prev => {
        const newTodos = prev.filter(todo => todo.categoryId !== categoryId);
        console.log('Updated todos:', newTodos);
        return newTodos;
      });

      // Then update categories
      setCategories(prev => {
        const newCategories = prev.filter(category => category.id !== categoryId);
        return newCategories;
      });
      
      // If the deleted category was selected, clear the selection
      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId('');
      }

      // Remove from collapsed state
      setCollapsedCategories(prev => {
        const newCollapsed = { ...prev };
        delete newCollapsed[categoryId];
        return newCollapsed;
      });

      console.log('Category deletion completed successfully');
      
      // Force a re-render
      setIsNewTaskModalVisible(false);
      setTimeout(() => {
        showModal();
      }, 100);
      
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.error('Error in handleDeleteCategory:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const renderCategory = (category: Category, todayTodos: Todo[]) => {
    const categoryTodos = todayTodos.filter((todo) => todo.categoryId === category.id && !todo.completed);
  
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
          <Text style={[styles.categoryTitle, { flex: 1, fontFamily: 'Onest' }]}>{category?.label || 'TODO'}</Text>
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

  const renderUncategorizedTodos = (todayTodos: Todo[]) => {
    const uncategorizedTodos = todayTodos.filter((todo) => !todo.categoryId && !todo.completed);
  
    
    if (uncategorizedTodos.length === 0) return null;

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
          <View style={[styles.categoryContent, { backgroundColor: '#F5F5F5' }]}>
            {uncategorizedTodos.map(renderTodoItem)}
          </View>
        )}
      </View>
    );
  };
  

  const renderCompletedTodos = (todayTodos: Todo[]) => {
    const completedTodos = todayTodos.filter((todo) => todo.completed);
  
    
    if (completedTodos.length === 0) return null;

    const isCollapsed = collapsedCategories['completed'];

    return (
      <View style={styles.completedSection}>
       <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => toggleCategoryCollapse('completed')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text style={[styles.categoryTitle, { flex: 1 }]}>COMPLETED</Text>
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
            {completedTodos.map(renderTodoItem)}
          </View>
        )}
      </View>
    );
  };

  // Add this new useEffect to handle auth state changes and fetch/save tasks
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          // First fetch categories
          console.log('Fetching categories...');
          const { data: categoriesData, error: categoriesError } = await supabase
            .from('categories')
            .select('*')
            .eq('user_id', session.user.id);

          if (categoriesError) {
            console.error('Error fetching categories:', categoriesError);
            Alert.alert('Error', 'Failed to load categories. Please try again.');
            return;
          }

          if (categoriesData) {
            console.log('Categories fetched:', categoriesData);
            setCategories(categoriesData);

            if (selectedCategoryId && !categoriesData.find(cat => cat.id === selectedCategoryId)) {
              console.log('🧼 Resetting invalid selectedCategoryId');
              setSelectedCategoryId('');
            }

          } else {
            console.log('No categories found for user');
            setCategories([]);
          }

          // Then fetch tasks
          console.log('Fetching tasks...');
          const { data: tasksData, error: tasksError } = await supabase
            .from('todos')
            .select('*')
            .eq('user_id', session.user.id);
          
          if (tasksError) {
            console.error('Error fetching tasks:', tasksError);
            Alert.alert('Error', 'Failed to load tasks. Please try again.');
            return;
          }

          if (tasksData) {
            console.log('Tasks fetched:', tasksData);
            // Map tasks and ensure they have the correct category
            const mappedTasks = tasksData.map(task => ({
              ...task,
              date: new Date(task.date),
              repeatEndDate: task.repeat_end_date ? new Date(task.repeat_end_date) : null,
              reminderTime: task.reminder_time ? new Date(task.reminder_time) : null, // ✅ You should ADD THIS LINE if not present
              // Ensure category_id is properly set
              categoryId: task.category_id || null,
              customRepeatDates: task.custom_repeat_dates
                ? task.custom_repeat_dates.map((dateStr: string) => new Date(dateStr))
                : undefined,
            }));
            setTodos(mappedTasks);
          }
        } catch (error) {
          console.error('Error in auth state change handler:', error);
          Alert.alert('Error', 'An unexpected error occurred. Please try again.');
        }
      } else if (event === 'SIGNED_OUT') {
        // Clear all local state when user signs out
        setTodos([]);
        setCategories([]);
        setNewTodo('');
        setNewDescription('');
        setSelectedCategoryId('');
        setShowNewCategoryInput(false);
        setNewCategoryName('');
        setNewCategoryColor('#E3F2FD');
        setEditingTodo(null);
        setCollapsedCategories({});
        setCurrentDate(new Date());
        setTaskDate(null);
        setReminderTime(null);
        setSelectedRepeat('none');
        setRepeatEndDate(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

  // Add debounce function
  const debounce = (func: () => void, wait: number) => {
    let timeout: NodeJS.Timeout;
    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(), wait);
    };
  };

  // Create debounced handlers
  const handleCalendarPress = useCallback(
    debounce(() => {
      if (isModalTransitioning) return;
      setIsModalTransitioning(true);
      setIsNewTaskModalVisible(false);
      setTimeout(() => {
        setIsSettingsModalVisible(true);
        setIsModalTransitioning(false);
      }, 300);
    }, 300),
    [isModalTransitioning]
  );

  const handleCloseNewTaskModal = useCallback(() => {
    hideModal();
  }, []);

  const handleCloseSettingsModal = useCallback(
    debounce(() => {
      if (isModalTransitioning) return;
      setIsModalTransitioning(true);
      setIsSettingsModalVisible(false);
      setTimeout(() => {
        showModal();
        setIsModalTransitioning(false);
        // Focus the input after modal transition
        setTimeout(() => {
          newTodoInputRef.current?.focus();
        }, 100);
      }, 300);
    }, 300),
    [isModalTransitioning]
  );

  
  const handleCancelFromSettings = () => {
    setIsSettingsModalVisible(false);
    // Remove resetForm() to preserve the form data
    setTimeout(() => {
      setIsNewTaskModalVisible(true);
    }, 300);
  };
  
  
  // Add reminder picker handlers
  const handleReminderPress = useCallback(() => {
    setShowReminderPicker(true);
  }, []);

  const handleReminderConfirm = useCallback(() => {
    const hours = selectedAmPm === 'PM' ? (parseInt(selectedHour) % 12) + 12 : parseInt(selectedHour) % 12;
    const time = new Date(
      parseInt(selectedYear),
      parseInt(selectedMonth) - 1,
      parseInt(selectedDay),
      hours,
      parseInt(selectedMinute)
    );
    setReminderTime(time);
    setShowReminderPicker(false);
  }, [selectedHour, selectedMinute, selectedAmPm, selectedYear, selectedMonth, selectedDay]);

  const handleReminderCancel = useCallback(() => {
    setShowReminderPicker(false);
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

  // Function to generate week dates
  const generateWeekDates = (startDate: Date) => {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      week.push(date);
    }
    return week;
  };

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
    setShowCategoryBox(false); // 👈 Reset folder toggle state
    setIsNewTaskModalVisible(true);
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

  // Update the add button press handler
  const handleAddButtonPress = () => {
    resetForm();
    showModal();
  };

  useEffect(() => {
  }, [isNewCategoryModalVisible]);

  useEffect(() => {
  }, [showRepeatEndDatePicker]);
  
  
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
          <ScrollView style={styles.todoList} showsVerticalScrollIndicator={false}>
            {todayTodos.length === 0 ? (
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
                {categories.map(category => renderCategory(category, todayTodos))}
                {renderUncategorizedTodos(todayTodos)}
                {renderCompletedTodos(todayTodos)}
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
              if (e.target === e.currentTarget) {
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
                        {categories.filter(cat => cat.label.toLowerCase() !== 'todo').map((cat) => (
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
                            style={{
                              paddingVertical: 6,
                              paddingHorizontal: 12,
                              borderRadius: 20,
                              backgroundColor: cat.id === selectedCategoryId ? cat.color : '#F0F0F0',
                              marginRight: 8,
                              flexDirection: 'row',
                              alignItems: 'center',
                            }}
                          >
                           <Text
                            style={{
                              color: cat.id === selectedCategoryId ? '#fff' : '#333',
                              fontWeight: '500',
                              fontSize: 12.5, // 👈 smaller size than default
                              textTransform: 'uppercase',
                            }}
                          >
                            {cat.label}
                          </Text>
                          </Pressable>
                        ))}
                      </ScrollView>

                      {/* ➕ Plus Button */}
                      <TouchableOpacity
                        onPress={() => {
                          setIsNewTaskModalVisible(false);
                          setTimeout(() => {
                            setIsNewCategoryModalVisible(true);
                          }, 300);
                        }}
                        style={{
                          paddingVertical: 4,
                          paddingHorizontal: 4,
                          borderRadius: 16,
                          backgroundColor: '#F0F0F0',
                          flexDirection: 'row',
                          alignItems: 'center',
                          marginLeft: -5
                        }}
                      >
                        <Ionicons name="add" size={16} color="#333" />
                      </TouchableOpacity>

                      </View>
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
                        paddingHorizontal: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'white',
                        zIndex: 1,
                      }}
                    >
                     {/* Left Section: Folder + Calendar */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Folder Button */}
            <TouchableOpacity
          onPress={() => {
            setShowCategoryBox(prev => !prev);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginRight: 16,
            marginLeft: 8, // 👈 shifts the entire folder icon + label to the right
          }}
        >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 4,
            paddingVertical: 6,
          }}
        >
          <Ionicons
            name="folder-outline"
            size={20}
            color={
              selectedCategoryId
                ? categories.find(cat => cat.id === selectedCategoryId)?.color || '#666'
                : '#666'
            }
          />

        {selectedCategoryId && (
          <>
            <Text
              numberOfLines={1}
              style={{
                marginLeft: 8,
                fontSize: 14,
                fontWeight: '600',
                color: categories.find((cat) => cat.id === selectedCategoryId)?.color || '#666',
                maxWidth: 100,
              }}
            >
              {categories.find((cat) => cat.id === selectedCategoryId)?.label.toUpperCase()}
            </Text>

            {showCategoryBox && (
              <TouchableOpacity
                onPress={() => {
                  setSelectedCategoryId('');
                }}
                style={{ marginLeft: 6 }}
              >
                <Ionicons
                  name="close"
                  size={14}
                  color={categories.find((cat) => cat.id === selectedCategoryId)?.color || '#666'}
                />
              </TouchableOpacity>
            )}
          </>
        )}

        </View>

        </TouchableOpacity>



          {/* Calendar Button */}
          <TouchableOpacity 
            onPress={handleCalendarPress}
            style={{ marginLeft: selectedCategoryId ? -8 : 0 }}
          >
            <Ionicons name="calendar-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Right Section: Send Button */}
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
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      
    </Modal>

    {/* Settings Modal */}
    <Modal
      animationType="slide"
      transparent={true}
      visible={isSettingsModalVisible}
      onRequestClose={handleCloseSettingsModal}
    >
      <View style={[styles.modalOverlay, { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }]}>
        <View style={[styles.modalContent, { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, height: selectedRepeat !== 'none' && selectedRepeat !== 'custom' ? '74%' : '67%', width: '100%' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <TouchableOpacity
              onPress={handleCancelFromSettings}
              style={{
                position: 'absolute',
                top: 10,
                right: -10,
                zIndex: 10, // ensures it stays above other elements
                backgroundColor: '#transparent',
                borderRadius: 16,
                padding: 6,
              }}
            >
              <Ionicons name="close" size={18} color="#666" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: 0, paddingTop: 20 }}>
            {/* Calendar View */}
            <View style={{ 
              flex: 1,
              width: '100%',
              backgroundColor: 'white',
              paddingTop: 1,
              marginBottom: selectedRepeat !== 'none' && selectedRepeat !== 'custom' ? 40 : 0,
            }}>
              <MonthlyCalendar
                selectedDate={taskDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]}
                onDayPress={(day: DateData) => {
                  setTaskDate(new Date(day.timestamp));
                }}
              />
            </View>

            {/* Reminder Picker */}
            <View
              ref={reminderButtonRef}
              onLayout={(e) => setReminderButtonLayout(e.nativeEvent.layout)}
              style={{
                marginTop: selectedRepeat !== 'none' && selectedRepeat !== 'custom' ? -20 : 0,
              }}
            >
              <View style={{
                backgroundColor: '#F5F5F5',
                borderRadius: 12,
                overflow: 'hidden',
                marginBottom: 110,
              }}>
                {/* Set Reminder Button */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 16,
                  }}
                  onPress={handleReminderPress}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="time-outline" size={20} color="#666" />
                    <Text style={{ marginLeft: 12, fontSize: 16, color: '#1a1a1a' }}>
                      {reminderTime
                        ? reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Set reminder'}
                    </Text>
                  </View>

                  {reminderTime ? (
                  <TouchableOpacity onPress={() => setReminderTime(null)}>
                    <Ionicons name="close" size={16} color="#999" />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color="#666" />
                )}

                </TouchableOpacity>

                {/* Repeat Button */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 16,
                  }}
                  onPress={() => {
                    if (selectedRepeat) {
                      setShowRepeatPicker(true);
                    }
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="repeat" size={20} color="#666" />
                    <Text style={{ marginLeft: 12, fontSize: 16, color: '#1a1a1a' }}>
                      {selectedRepeat && selectedRepeat !== 'none'
                        ? REPEAT_OPTIONS.find(opt => opt.value === selectedRepeat)?.label
                        : 'Set repeat'}
                    </Text>
                  </View>

                  {selectedRepeat && selectedRepeat !== 'none' ? (
                    <TouchableOpacity onPress={() => setSelectedRepeat('none')}>
                      <Ionicons name="close" size={16} color="#999" />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color="#666" />
                  )}
                </TouchableOpacity>

                {/* Set End Date – Only show if repeat is not 'none' */}
                {selectedRepeat !== 'none' && selectedRepeat !== 'custom' && (
                    <>
                      {(() => {
                        return null;
                      })()}
                     <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 16,
                      }}
                      onPress={() => {
                        setShowRepeatEndDatePicker(true);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="calendar-outline" size={20} color="#666" />
                        <Text style={{ marginLeft: 12, fontSize: 16, color: '#1a1a1a' }}>
                          {repeatEndDate
                            ? `Ends on ${repeatEndDate.toLocaleDateString()}`
                            : 'Set end date'}
                        </Text>
                      </View>

                      {repeatEndDate ? (
                        <TouchableOpacity onPress={() => setRepeatEndDate(null)}>
                          <Ionicons name="close" size={16} color="#999" />
                        </TouchableOpacity>
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color="#666" />
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Simple Time Picker */}
            <Modal
            visible={showReminderPicker}
            transparent
            animationType="fade"
            onRequestClose={handleReminderCancel}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {
                handleReminderConfirm(); // Save time
                setShowReminderPicker(false); // Dismiss
              }}
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                justifyContent: 'flex-end',
              }}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={{
                  backgroundColor: '#fff',
                  paddingTop: 16,
                  paddingBottom: 28,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  shadowColor: '#3A3A3A',
                  shadowOffset: { width: 0, height: -2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 10,
                  elevation: 10,
                }}
                onPress={() => {}} // Prevent closing when tapping inside
              >
                <Text style={{ 
                  fontSize: 20, 
                  fontWeight: '700', 
                  color: '#1a1a1a', 
                  marginBottom: 10,
                  marginLeft: 22,
                  fontFamily: 'Onest'
                }}>
                  Reminder Time
                </Text>
         
                <View style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-around',
                  paddingHorizontal: 20,
                  marginBottom: 8
                }}>
                  {/* Hour Picker */}
                  <Picker
                    selectedValue={selectedHour}
                    style={{ 
                      flex: 1,
                      height: 120,
                    }}
                    itemStyle={{
                      height: 120,
                      fontSize: 24,
                      fontFamily: 'Onest',
                      color: '#1a1a1a'
                    }}
                    onValueChange={(val) => setSelectedHour(val)}
                  >
                    {Array.from({ length: 12 }, (_, i) => {
                      const val = (i + 1).toString().padStart(2, '0');
                      return <Picker.Item key={val} label={val} value={val} />;
                    })}
                  </Picker>

                  <Text style={{
                    fontSize: 35,
                    color: '#1a1a1a',
                    fontFamily: 'Onest',
                    marginHorizontal: 10,
                    marginTop: 34
                  }}>:</Text>

                  {/* Minute Picker */}
                  <Picker
                    selectedValue={selectedMinute}
                    style={{ 
                      flex: 1,
                      height: 120,
                    }}
                    itemStyle={{
                      height: 120,
                      fontSize: 24,
                      fontFamily: 'Onest',
                      color: '#1a1a1a'
                    }}
                    onValueChange={(val) => setSelectedMinute(val)}
                  >
                    {Array.from({ length: 60 }, (_, i) => {
                      const val = i.toString().padStart(2, '0');
                      return <Picker.Item key={val} label={val} value={val} />;
                    })}
                  </Picker>

                  {/* AM/PM Picker */}
                  <Picker
                    selectedValue={selectedAmPm}
                    style={{ 
                      flex: 1,
                      height: 120,
                    }}
                    itemStyle={{
                      height: 120,
                      fontSize: 24,
                      fontFamily: 'Onest',
                      color: '#1a1a1a'
                    }}
                    onValueChange={(val) => setSelectedAmPm(val)}
                  >
                    <Picker.Item label="AM" value="AM" />
                    <Picker.Item label="PM" value="PM" />
                  </Picker>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    handleReminderConfirm();
                    setShowReminderPicker(false);
                  }}
                  style={{
                    backgroundColor: '#FF9A8B',
                    marginHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    marginTop: 4,
                  }}
                >
                  <Text style={{ 
                    color: 'white', 
                    fontSize: 16, 
                    fontWeight: '600',
                    fontFamily: 'Onest',
                  }}>
                    Set Time
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>


            {/* Simple Repeat Options */}
            <Modal
              visible={showRepeatPicker}
              animationType="slide"
              transparent
              onRequestClose={() => setShowRepeatPicker(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => setShowRepeatPicker(false)}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  justifyContent: 'flex-end',
                }}
              >
                <View
                  style={{
                    backgroundColor: '#fff',
                    paddingTop: 16,
                    paddingBottom: 28,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    shadowColor: '#3A3A3A',
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 10,
                    elevation: 10,
                  }}
                >
                  <Text style={{ 
                    fontSize: 20, 
                    fontWeight: '700', 
                    color: '#1a1a1a', 
                    marginBottom: 10,
                    marginLeft: 22,
                    fontFamily: 'Onest'
                  }}>
                    Repeat
                  </Text>

                  {REPEAT_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => {
                        setSelectedRepeat(opt.value as RepeatOption);
                        setShowRepeatPicker(false);

                        if (opt.value === 'custom') {
                          setTimeout(() => {
                            setShowCustomDatesPicker(true);
                          }, 300);
                        }
                      }}
                      style={{
                        paddingVertical: 16,
                        paddingHorizontal: 24,
                      }}
                    >
                      <Text style={{ 
                        fontSize: 16, 
                        color: '#1a1a1a',
                        fontFamily: 'Onest'
                      }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>

            <Modal
    visible={showCustomDatesPicker}
    transparent
    animationType="fade"
    onRequestClose={() => setShowCustomDatesPicker(false)}
  >
    <TouchableOpacity
      activeOpacity={1}
      onPressOut={() => setShowCustomDatesPicker(false)}
      style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'flex-end',
      }}
    >
      <View style={{
        backgroundColor: '#fff',
        padding: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }}>
        <RNCalendar
          onDayPress={(day: DateData) => {
            const dateStr = day.dateString;
            setCustomSelectedDates((prev) =>
              prev.includes(dateStr)
                ? prev.filter((d) => d !== dateStr)
                : [...prev, dateStr]
            );
          }}
          markedDates={Object.fromEntries(
            customSelectedDates.map((date) => [
              date,
              { selected: true, selectedColor: '#FF9A8B' },
            ])
          )}
          style={{
            width: '100%',
          }}
          theme={{
            backgroundColor: 'white',
            calendarBackground: 'white',
            textSectionTitleColor: '#666',
            todayTextColor: '#FF9A8B',
            dayTextColor: '#1a1a1a',
            textDisabledColor: '#DCD7C9',
            dotColor: '#007AFF',
            selectedDotColor: '#ffffff',
            arrowColor: '#FF9A8B',
            monthTextColor: '#1a1a1a',
            indicatorColor: '#007AFF',
            textDayFontSize: 14,
            textMonthFontSize: 17,
            textDayHeaderFontSize: 12,
            textDayFontFamily: 'Onest',
            textMonthFontFamily: 'Onest',
            textDayHeaderFontFamily: 'Onest',
            'stylesheet.calendar.header': {
              monthText: {
                fontSize: 17,
                fontWeight: '500',
                color: '#1a1a1a',
                marginBottom: 15,
                fontFamily: 'Onest',
              },
              arrow: {
                color: '#FF9A8B',
                marginHorizontal: 60,
                marginBottom: 15,
              },
            },
            'stylesheet.day.basic': {
              base: {
                width: 33,
                height: 33,
                alignItems: 'center',
                justifyContent: 'center',
              },
              text: {
                fontSize: 14,
                color: '#1a1a1a',
                backgroundColor: 'transparent',
                textAlign: 'center',
                marginTop: 5,
                fontFamily: 'Onest',
              },
              today: {
                backgroundColor: '#FAF9F6',
                borderRadius: 18,
              },
              selected: {
                backgroundColor: '#FF9A8B',
                borderRadius: 18,
              },
              selectedText: {
                color: '#ffffff',
                fontFamily: 'Onest',
              },
            }
          }}
        />

        <TouchableOpacity
          onPress={() => setShowCustomDatesPicker(false)}
          style={{
            backgroundColor: '#FFB6B9',
            padding: 16,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: 15,
            marginBottom: 14, 
          }}
        >
          <Text style={{ color: 'white', fontWeight: '600', fontFamily: 'Onest' }}>Done</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </Modal>


            <Modal
              visible={showRepeatEndDatePicker}
              transparent
              animationType="fade"
              onRequestClose={() => setShowRepeatEndDatePicker(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => {
                  handleEndDateConfirm();
                  setShowRepeatEndDatePicker(false);
                }}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  justifyContent: 'flex-end',
                }}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  style={{
                    backgroundColor: '#fff',
                    paddingTop: 16,
                    paddingBottom: 28,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    shadowColor: '#3A3A3A',
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 10,
                    elevation: 10,
                  }}
                  onPress={() => {}} // Prevent closing when tapping inside
                >
                  <Text style={{ 
                    fontSize: 20, 
                    fontWeight: '700', 
                    color: '#1a1a1a', 
                    marginBottom: 10,
                    marginLeft: 22,
                    fontFamily: 'Onest'
                  }}>
                    Pick End Date
                  </Text>

                  <View style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-around',
                    paddingHorizontal: 20,
                    marginBottom: 8
                  }}>
                    <Picker selectedValue={selectedYear} 
                      style={{ 
                        flex: 1,
                        height: 120,
                      }}
                      itemStyle={{
                        height: 120,
                        fontSize: 24,
                        fontFamily: 'Onest',
                        color: '#1a1a1a'
                      }}
                      onValueChange={setSelectedYear}>
                      {years.map((y) => (
                        <Picker.Item 
                          key={y} 
                          label={y.slice(-2)} 
                          value={y} 
                        />
                      ))}
                    </Picker>

                    <Text style={{
                      fontSize: 35,
                      color: '#1a1a1a',
                      fontFamily: 'Onest',
                      marginHorizontal: 10,
                      marginTop: 34
                    }}>/</Text>

                    <Picker selectedValue={selectedMonth} 
                      style={{ 
                        flex: 1,
                        height: 120,
                      }}
                      itemStyle={{
                        height: 120,
                        fontSize: 24,
                        fontFamily: 'Onest',
                        color: '#1a1a1a'
                      }}
                      onValueChange={setSelectedMonth}>
                      {months.map((m) => <Picker.Item key={m} label={m} value={m} />)}
                    </Picker>

                    <Text style={{
                      fontSize: 35,
                      color: '#1a1a1a',
                      fontFamily: 'Onest',
                      marginHorizontal: 10,
                      marginTop: 34
                    }}>/</Text>

                    <Picker selectedValue={selectedDay} 
                      style={{ 
                        flex: 1,
                        height: 120,
                      }}
                      itemStyle={{
                        height: 120,
                        fontSize: 24,
                        fontFamily: 'Onest',
                        color: '#1a1a1a'
                      }}
                      onValueChange={setSelectedDay}>
                      {days.map((d) => <Picker.Item key={d} label={d} value={d} />)}
                    </Picker>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      handleEndDateConfirm();
                      setShowRepeatEndDatePicker(false);
                    }}
                    style={{
                      backgroundColor: '#FF9A8B',
                      marginHorizontal: 20,
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: 'center',
                      marginTop: 4,
                    }}
                  >
                    <Text style={{ 
                      color: 'white', 
                      fontSize: 16, 
                      fontWeight: '600',
                      fontFamily: 'Onest',
                    }}>
                      Set Date
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
          </ScrollView>
          
          <View style={styles.stickyFooter}>
            <TouchableOpacity style={[styles.doneButton, { backgroundColor: '#FF9A8B' }]} onPress={handleCloseSettingsModal}>
              <Text style={[styles.doneText, { color: 'white' }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
                        opacity: isSelected ? 1 : (newCategoryColor === '#E3F2FD' ? 1 : 0.6)
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
                        user_id: user.id
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
  </GestureHandlerRootView>
);
}