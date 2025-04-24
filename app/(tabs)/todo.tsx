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
  customRepeatFrequency?: number; 
  customRepeatUnit?: 'days' | 'weeks' | 'months'; 
  customRepeatWeekDays?: WeekDay[];
  repeatEndDate?: Date | null;
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
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [currentDate, setCurrentDate] = useState(new Date());
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







  useEffect(() => {
    console.log('📁 useEffect triggered — isCategoryModalVisible:', isCategoryModalVisible);
  }, [isCategoryModalVisible]);
  
  // Move the useEffect for input focus here
  useEffect(() => {
    if (isNewTaskModalVisible && newTodoInputRef.current) {
      setTimeout(() => {
        newTodoInputRef.current?.focus();
      }, 150);
    }
  }, [isNewTaskModalVisible]);

  const handleContentLayout = (event: any) => {
    const { height } = event.nativeEvent.layout;
    setContentHeight(height);
  };

  const resetForm = () => {
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
    setCustomRepeatFrequency('1');
    setCustomRepeatUnit('days');
    setSelectedWeekDays([]);
  };

  async function scheduleReminderNotification(taskTitle: string, reminderTime: Date) {
    try {
      const secondsUntilReminder = Math.floor((reminderTime.getTime() - Date.now()) / 1000);
      console.log('Scheduling notification in', secondsUntilReminder, 'seconds');
  
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
  
      console.log('✅ Notification scheduled!');
    } catch (error) {
      console.error('❌ Error scheduling notification:', error);
    }
  }

  const toggleWeekDay = (day: WeekDay) => {
    setSelectedWeekDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    );
  };
  
  
  async function requestPermissions() {
    const { status } = await Notifications.requestPermissionsAsync();
    console.log('Notification permission status:', status); 
    if (status !== 'granted') {
      alert('Permission for notifications not granted!');
    }
  }

  const renderCustomRepeatSection = () => (
    <View style={styles.customRepeatContainer}>
      <View style={styles.customRepeatInputContainer}>
        <Text style={styles.everyText}>Every</Text>
        
        <TextInput
          style={styles.customRepeatInput}
          value={customRepeatFrequency}
          onChangeText={(text) => {
            const number = text.replace(/[^0-9]/g, '');
            if (number === '' || parseInt(number, 10) > 0) {
              setCustomRepeatFrequency(number);
            }
          }}
          keyboardType="numeric"
          placeholder="1"
          placeholderTextColor="#A3A3A3"
        />
        
        <Menu
          visible={unitMenuVisible}
          onDismiss={() => setUnitMenuVisible(false)}
          anchor={
            <TouchableOpacity
              style={styles.unitSelector}
              onPress={() => setUnitMenuVisible(true)}
            >
              <Text style={styles.unitSelectorText}>
                {REPEAT_UNITS.find((unit) => unit.value === customRepeatUnit)?.label}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          }
        >
          {REPEAT_UNITS.map((unit) => (
            <Menu.Item
              key={unit.value}
              onPress={() => {
                setCustomRepeatUnit(unit.value);
                setUnitMenuVisible(false);   // close after selecting ✅
              }}
              title={unit.label}
            />
          ))}
        </Menu>
      </View>
  
      {customRepeatUnit === 'weeks' && (
        <View style={styles.weekDaysContainer}>
          <Text style={styles.weekDaysTitle}>Repeat on</Text>
          <View style={styles.weekDayButtons}>
            {WEEK_DAYS.map((day) => (
              <TouchableOpacity
                key={day.value}
                style={[
                  styles.weekDayButton,
                  selectedWeekDays.includes(day.value) && styles.selectedWeekDayButton,
                ]}
                onPress={() => toggleWeekDay(day.value)}
              >
                <Text
                  style={[
                    styles.weekDayButtonText,
                    selectedWeekDays.includes(day.value) && styles.selectedWeekDayButtonText,
                  ]}
                >
                  {day.shortLabel}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
  
  


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

      console.log('Current categories in database:', categoriesData);
    } catch (error) {
      console.error('Error in checkCategories:', error);
    }
  };

  const handleSave = async () => {
    if (!newTodo.trim()) return;
  
    console.log('Starting save process...');
    console.log('New todo:', newTodo);
    console.log('Selected category:', selectedCategoryId);
  
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
      console.log('Initial finalCategoryId:', finalCategoryId);

      if (showNewCategoryInput && newCategoryName.trim()) {
        console.log('Creating new category...');
        const newCategory = {
          id: uuidv4(),
          label: newCategoryName.trim(),
          color: newCategoryColor,
        };
        
        console.log('Attempting to save category:', newCategory);
        
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
        console.log('Final categoryId after save:', finalCategoryId);
      }

      // If no category is selected, set it to null
      if (!finalCategoryId) {
        console.log('🪫 No category selected — checking for default "todo" category...');
      
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
          console.log('✅ Found existing "todo" category:', existingTodoCategory);
          finalCategoryId = existingTodoCategory.id;
        } else {
          console.log('🆕 Creating new default "todo" category...');
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
        console.log('Verifying category exists:', finalCategoryId);
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

        console.log('Category verified successfully:', categoryData);
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
        customRepeatFrequency: selectedRepeat === 'custom' ? Number(customRepeatFrequency) : undefined,
        customRepeatUnit: selectedRepeat === 'custom' ? customRepeatUnit : undefined,
        customRepeatWeekDays: selectedRepeat === 'custom' && customRepeatUnit === 'weeks' ? selectedWeekDays : undefined,
        repeatEndDate: selectedRepeat !== 'none' ? repeatEndDate : undefined,
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
          custom_repeat_frequency: newTodoItem.customRepeatFrequency,
          custom_repeat_unit: newTodoItem.customRepeatUnit,
          custom_repeat_week_days: newTodoItem.customRepeatWeekDays,
          repeat_end_date: newTodoItem.repeatEndDate?.toISOString(),
          user_id: user.id
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
        console.log('Scheduling reminder...');
        await scheduleReminderNotification(newTodo.trim(), reminderTime);
      }

      // Reset form and close modal
      resetForm();
      setIsNewTaskModalVisible(false);
      
      // Provide haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log('Save process completed successfully');
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
        customRepeatFrequency: Number(customRepeatFrequency),
        customRepeatUnit,
        customRepeatWeekDays: selectedWeekDays,
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
            custom_repeat_frequency: updatedTodo.customRepeatFrequency,
            custom_repeat_unit: updatedTodo.customRepeatUnit,
            custom_repeat_week_days: updatedTodo.customRepeatWeekDays,
            repeat_end_date: updatedTodo.repeatEndDate?.toISOString(),
          })
          .eq('id', updatedTodo.id)
          .eq('user_id', user.id);
        
        if (error) {
          console.error('Error updating task:', error);
        }
      }
  
      setEditingTodo(null);
      resetForm();
      setIsEditModalVisible(false);
    }
  };
  
  const toggleTodo = async (id: string) => {
    try {
      console.log('Starting task completion toggle...');
      console.log('Task ID to toggle:', id);
      
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

  const formatDateHeader = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
  
    const fullDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  
    let relativeDay = '';
    if (isSameDay(date, today)) {
      relativeDay = 'Today';
    } else if (isSameDay(date, tomorrow)) {
      relativeDay = 'Tomorrow';
    } else if (isSameDay(date, yesterday)) {
      relativeDay = 'Yesterday';
    }
  
    return (
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.dateText}>
          {fullDate}
        </Text>
        {relativeDay !== '' && (
          <Text style={styles.relativeDayText}>
            {relativeDay}
          </Text>
        )}
      </View>
    );
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
  
    if (isSameDay(taskDate, date)) return true; // normal case (non-repeat)
  
    if (todo.repeat === 'daily') {
      return date >= taskDate; // repeat daily after taskDate
    }
  
    if (todo.repeat === 'weekly') {
      return date >= taskDate && taskDate.getDay() === date.getDay();
    }
  
    if (todo.repeat === 'monthly') {
      return date >= taskDate && taskDate.getDate() === date.getDate();
    }
  
    if (todo.repeat === 'custom') {
      if (!todo.customRepeatFrequency || !todo.customRepeatUnit) return false;
  
      const diffInDays = Math.floor((date.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24));
  
      if (todo.customRepeatUnit === 'days') {
        return diffInDays % todo.customRepeatFrequency === 0 && diffInDays >= 0;
      }
  
      if (todo.customRepeatUnit === 'weeks') {
        const weeksDiff = Math.floor(diffInDays / 7);
        const dayOfWeek = date.getDay();
        return weeksDiff % todo.customRepeatFrequency === 0 &&
               todo.customRepeatWeekDays?.includes(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayOfWeek] as WeekDay);
      }
  
      if (todo.customRepeatUnit === 'months') {
        const monthsDiff = (date.getFullYear() - taskDate.getFullYear()) * 12 + (date.getMonth() - taskDate.getMonth());
        return monthsDiff % todo.customRepeatFrequency === 0 && taskDate.getDate() === date.getDate();
      }
    }
  
    return false;
  };

  const todayTodos = todos.filter(todo => doesTodoBelongToday(todo, currentDate));


  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const goToNextDay = () => {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    setCurrentDate(nextDate);
  };
  
  const goToPreviousDay = () => {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    setCurrentDate(prevDate);
  };

  const renderTodoItem = (todo: Todo) => {
    const handleDelete = async () => {
      try {
        console.log('Starting task deletion...');
        console.log('Task to delete:', todo);
        
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

        console.log('Successfully deleted task from Supabase:', deletedTask);

        // Update local state
        setTodos(prev => {
          const newTodos = prev.filter(t => t.id !== todo.id);
          console.log('Updated todos after deletion:', newTodos);
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
      setEditingTodo(todo);
      setNewTodo(todo.text);
      setNewDescription(todo.description || '');
      setSelectedCategoryId(todo.categoryId || '');
      setTaskDate(todo.date || null);
      setSelectedRepeat(todo.repeat || 'none');
      setCustomRepeatFrequency(todo.customRepeatFrequency?.toString() || '1');
      setCustomRepeatUnit(todo.customRepeatUnit || 'days');
      setSelectedWeekDays(todo.customRepeatWeekDays || []);
      setRepeatEndDate(todo.repeatEndDate || null);
      setIsNewTaskModalVisible(true);
    };

    const taskTouchable = (
      <TouchableOpacity
        style={[
          styles.todoItem,
          todo.completed && styles.completedTodo,
        ]}
        onPress={() => toggleTodo(todo.id)}
        onLongPress={handleEdit}
        delayLongPress={500}
        activeOpacity={0.9}
      >
        <View style={[styles.checkbox, todo.completed && styles.checked]}>
          {todo.completed && <Ionicons name="checkmark" size={16} color="white" />}
        </View>
        <View style={styles.todoContent}>
          <Text style={[
            styles.todoText,
            todo.completed && styles.completedText
          ]}>
            {todo.text}
          </Text>
          {todo.description && (
            <Text style={[
              styles.todoDescription,
              todo.completed && styles.completedDescription
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
      console.log('Starting category deletion process...');
      console.log('Category ID to delete:', categoryId);
      console.log('Current categories:', categories);
      
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        Alert.alert('Error', 'You must be logged in to delete categories.');
        return;
      }

      // First, delete all tasks in this category
      console.log('Deleting tasks in category...');
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
      console.log('Deleting category...');
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

      // Update local state
      console.log('Updating local state...');
      
      // Update todos first
      setTodos(prev => {
        const newTodos = prev.filter(todo => todo.categoryId !== categoryId);
        console.log('Updated todos:', newTodos);
        return newTodos;
      });

      // Then update categories
      setCategories(prev => {
        const newCategories = prev.filter(category => category.id !== categoryId);
        console.log('Updated categories:', newCategories);
        return newCategories;
      });
      
      // If the deleted category was selected, clear the selection
      if (selectedCategoryId === categoryId) {
        console.log('Clearing selected category');
        setSelectedCategoryId('');
      }

      // Remove from collapsed state
      setCollapsedCategories(prev => {
        const newCollapsed = { ...prev };
        delete newCollapsed[categoryId];
        console.log('Updated collapsed state:', newCollapsed);
        return newCollapsed;
      });

      console.log('Category deletion completed successfully');
      
      // Force a re-render
      setIsNewTaskModalVisible(false);
      setTimeout(() => {
        setIsNewTaskModalVisible(true);
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
    console.log('🧨 Long pressed category');
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


          <Text style={styles.categoryTitle}>{category.label}</Text>
          {isCollapsed ? (
            <Ionicons name="chevron-up" size={20} color="#666" />
          ) : (
            <Ionicons name="chevron-down" size={20} color="#666" />
          )}
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
          <Text style={styles.categoryTitle}>Other</Text>
          {isCollapsed ? (
            <Ionicons name="chevron-up" size={20} color="#666" />
          ) : (
            <Ionicons name="chevron-down" size={20} color="#666" />
          )}
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
          <Text style={styles.categoryTitle}>COMPLETED</Text>
          {isCollapsed ? (
            <Ionicons name="chevron-up" size={20} color="#666" />
          ) : (
            <Ionicons name="chevron-down" size={20} color="#666" />
          )}
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
              // Ensure category_id is properly set
              categoryId: task.category_id || null
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
  

  // Add this function after your existing functions
  const formatCalendarDate = (date: Date) => {
    const day = date.getDate();
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    return { day, dayName };
  };

  // callbacks
  const handleSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index);
    if (index === -1) {
      resetForm();
    }
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
    Keyboard.dismiss();
    hideModal();
  }, []);

  const handleCloseSettingsModal = useCallback(
    debounce(() => {
      if (isModalTransitioning) return;
      setIsModalTransitioning(true);
      setIsSettingsModalVisible(false);
      setTimeout(() => {
        setIsNewTaskModalVisible(true);
        setIsModalTransitioning(false);
      }, 300);
    }, 300),
    [isModalTransitioning]
  );

  // Add debounced date picker handler
  const handleDatePickerPress = useCallback(
    debounce(() => {
      if (isDatePickerTransitioning) return;
      setIsDatePickerTransitioning(true);
      setShowTaskDatePicker(true);
      setTimeout(() => {
        setIsDatePickerTransitioning(false);
      }, 300);
    }, 300),
    [isDatePickerTransitioning]
  );


  // Update date picker confirm handler
  const handleDatePickerConfirm = useCallback((date: Date) => {
    setTaskDate(date);
    setShowTaskDatePicker(false);
    setIsDatePickerTransitioning(false);
    requestAnimationFrame(showModal);
  }, []);
  
  const handleDatePickerCancel = useCallback(() => {
    setShowTaskDatePicker(false);
    setIsDatePickerTransitioning(false);
    requestAnimationFrame(showModal);
  }, []);
  
  

  // Add reminder picker handlers
  const handleReminderPress = useCallback(() => {
    console.log('Opening reminder picker');
    setShowReminderPicker(true);
  }, []);

  const handleReminderConfirm = useCallback(() => {
    const hours = selectedAmPm === 'PM' ? (parseInt(selectedHour) % 12) + 12 : parseInt(selectedHour) % 12;
    const time = new Date();
    time.setHours(hours);
    time.setMinutes(parseInt(selectedMinute));
    setReminderTime(time);
    setShowReminderPicker(false);
  }, [selectedHour, selectedMinute, selectedAmPm]);

  const handleReminderCancel = useCallback(() => {
    setShowReminderPicker(false);
  }, []);

  // Add repeat option handlers
  const handleRepeatPress = useCallback(() => {
    console.log('Opening repeat options');
    setShowRepeatOptions(true);
  }, []);

  const handleRepeatEndDatePress = useCallback(() => {
    console.log('Opening repeat end date picker');
    setShowRepeatEndDatePicker(true);
  }, []);

  const handleRepeatEndDateConfirm = useCallback((date: Date) => {
    console.log('Setting repeat end date:', date);
    setRepeatEndDate(date);
    setShowRepeatEndDatePicker(false);
  }, []);

  const handleRepeatEndDateCancel = useCallback(() => {
    console.log('Cancelling repeat end date picker');
    setShowRepeatEndDatePicker(false);
  }, []);

  // Add this function to handle sign out
  const handleSignOut = async () => {
    try {
      console.log('Starting sign out process...');
      
      // Clear local state first
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

      console.log('Local state cleared');

      // Try to sign out with a timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Sign out timeout')), 5000);
      });

      const signOutPromise = supabase.auth.signOut();

      try {
        await Promise.race([signOutPromise, timeoutPromise]);
        console.log('Successfully signed out from Supabase');
      } catch (error) {
        console.error('Error during sign out:', error);
        // Even if sign out fails, we've already cleared local state
        // So we can consider the user signed out locally
        console.log('Proceeding with local sign out despite network error');
      }
    } catch (error) {
      console.error('Error in handleSignOut:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.'
      );
    }
  };

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

  // Function to handle week navigation
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? currentWeekIndex - 1 : currentWeekIndex + 1;
    const newStartDate = new Date(currentWeek[0]);
    newStartDate.setDate(newStartDate.getDate() + (direction === 'prev' ? -7 : 7));
    const newWeek = generateWeekDates(newStartDate);
    setCurrentWeek(newWeek);
    setCurrentWeekIndex(newIndex);
    setCurrentDate(newWeek[0]); // Update current date to the first day of the new week
  };

  // Function to handle day navigation
  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'prev' ? -1 : 1));
    setCurrentDate(newDate);
  };

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.translationY > 50) {
      setIsMonthView(true);
    }
  };
  const showModal = () => {
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
    console.log('🧪 isNewCategoryModalVisible state changed:', isNewCategoryModalVisible);
  }, [isNewCategoryModalVisible]);
  


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <PanGestureHandler
          onHandlerStateChange={onHandlerStateChange}
          minDist={10}
        >
          <View style={{ flex: 1 }}>
            {/* HEADER */}
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.menuButton}>              
              </TouchableOpacity>
            </View>
            
            {/* Add this after the header and before the task list */}
            <View style={{ paddingHorizontal: -5, marginHorizontal: -5, }}>
              <CalendarStrip
                scrollable
                startingDate={moment().subtract(3, 'days')}
                showMonth
                leftSelector={<View />}
                rightSelector={<View />}
                style={{ height: 100, paddingTop: 10, paddingBottom: 10 }}
                calendarColor={'#fff'}
                calendarHeaderStyle={{
                  color: '#000',
                  fontSize: 18,
                  marginBottom: 24,
                }}
                dateNumberStyle={{ color: '#999', fontSize: 16 }}
                dateNameStyle={{ color: '#999'}}
                highlightDateNumberStyle={{ color: '#000', fontSize: 28 }}
                highlightDateNameStyle={{ color: '#000' }}
                highlightDateContainerStyle={{
                  backgroundColor: '',
                  borderRadius: 16,
                }}
                selectedDate={moment(currentDate)}
                onDateSelected={(date) => setCurrentDate(date.toDate())}
              />
            </View>

            <View style={{ height: 15 }} />

            {/* TASK LIST */}
            <ScrollView style={styles.todoList} showsVerticalScrollIndicator={false}>
              {todayTodos.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>no tasks!</Text>
                  <Text style={styles.emptyStateSubtitle}>Take a breather :)</Text>
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
              <Ionicons name="add" size={24} color="white" />
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
                          fontSize: 20,
                          color: '#1a1a1a',
                          padding: 10,
                          backgroundColor: 'white',
                          borderRadius: 12,
                          marginBottom: -10,
                        }}
                        value={newTodo}
                        onChangeText={setNewTodo}
                        placeholder="What needs to be done?"
                        placeholderTextColor="#999"
                        returnKeyType="next"
                        onSubmitEditing={() => newDescriptionInputRef.current?.focus()}
                      />

                      <TextInput
                        ref={newDescriptionInputRef}
                        style={{
                          fontSize: 17,
                          color: '#1a1a1a',
                          padding: 10,
                          backgroundColor: 'white',
                          borderRadius: 12,
                          minHeight: 75,
                          marginTop: 6,
                          textAlignVertical: 'top',
                          marginBottom: 20,
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
                          marginTop: 16,
                          marginBottom: 60,
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
                          {categories.map((cat) => (
                            <Pressable
                              key={cat.id}
                              onPress={() => setSelectedCategoryId(cat.id)}
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
                                paddingVertical: 8,
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
                                fontWeight: '600',
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
    console.log('➕ Pressed: open category modal from task modal');
    setIsNewTaskModalVisible(false); // Close task modal first
  
    // Open category modal after short delay (300ms works well with animation)
    setTimeout(() => {
      setIsNewCategoryModalVisible(true);
    }, 300);
  }}
    style={{
      marginLeft: 8,
      paddingVertical: 6,
      paddingHorizontal: 6,
      borderRadius: 20,
      backgroundColor: '#DADADA',
      flexDirection: 'row',
      alignItems: 'center',
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
                    {/* Folder Button */}
                    <TouchableOpacity
                      onPress={() => {
                        console.log('📁 Folder icon toggled');
                        setShowCategoryBox(prev => !prev);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: selectedCategoryId
                          ? categories.find(c => c.id === selectedCategoryId)?.color || '#F5F5F5'
                          : '#F5F5F5',
                        marginRight: 8,
                        maxWidth: 160,
                      }}
                    >
                      <Ionicons name="folder-outline" size={20} color="#fff" />

                      {selectedCategoryId && (
                        <Text
                          numberOfLines={1}
                          style={{
                            color: '#fff',
                            marginLeft: 8,
                            fontSize: 14,
                            fontWeight: '500',
                          }}
                        >
                          {categories.find((cat) => cat.id === selectedCategoryId)?.label}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {/* Date Picker Button */}
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#F5F5F5',
                        paddingVertical: 12,
                        paddingHorizontal: 10,
                        borderRadius: 12,
                      }}
                      onPress={handleCalendarPress}
                    >
                      <Ionicons name="calendar-outline" size={20} color="#666" />
                    </TouchableOpacity>

                    {/* Send Button */}
                    <TouchableOpacity
                      onPress={handleSave}
                      disabled={!newTodo.trim()}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: newTodo.trim() ? '#007AFF' : '#B0BEC5',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="arrow-up" size={20} color="#fff" />
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
          <View style={[styles.modalOverlay, { 
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end'
          }]}>
            <View style={[styles.modalContent, { 
              backgroundColor: 'white',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              height: '68%',
              width: '100%'
            }]}>
            
              <ScrollView
                style={{ flex: 1 }}
                keyboardShouldPersistTaps="handled"
  contentContainerStyle={{ paddingBottom: 100 }}
              >
                {/* Calendar View */}
                <View style={{ marginBottom: 20 }}>
                  <RNCalendar
                    current={taskDate?.toISOString()}
                    onDayPress={(day: DateData) => {
                      setTaskDate(new Date(day.timestamp));
                    }}
                    markedDates={{
                      [taskDate?.toISOString().split('T')[0] || '']: {
                        selected: true,
                        selectedColor: '#007AFF'
                      }
                    }}
                    theme={{
                      backgroundColor: 'transparent',
                      calendarBackground: 'transparent',
                      textSectionTitleColor: '#666',
                      selectedDayBackgroundColor: '#007AFF',
                      selectedDayTextColor: '#ffffff',
                      todayTextColor: '#007AFF',
                      dayTextColor: '#1a1a1a',
                      textDisabledColor: '#d9e1e8',
                      dotColor: '#007AFF',
                      selectedDotColor: '#ffffff',
                      arrowColor: '#007AFF',
                      monthTextColor: '#1a1a1a',
                      indicatorColor: '#007AFF',
                      textDayFontSize: 16,
                      textMonthFontSize: 16,
                      textDayHeaderFontSize: 14
                    }}
                  />
                </View>

                {/* Reminder Picker */}
                <View
                  ref={reminderButtonRef}
                  onLayout={(e) => setReminderButtonLayout(e.nativeEvent.layout)}
                >
                  <View style={{
                    backgroundColor: '#F5F5F5',
                    borderRadius: 12,
                    overflow: 'hidden',
                    marginBottom: 16,
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
                      <TouchableOpacity onPress={() => setReminderTime(null)}>
                        <Ionicons name="close" size={18} color="#999" />
                      </TouchableOpacity>
                    </TouchableOpacity>

                    {/* Repeat Button */}
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 16,
                      }}
                      onPress={() => setShowRepeatPicker(true)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="repeat" size={20} color="#666" />
                        <Text style={{ marginLeft: 12, fontSize: 16, color: '#1a1a1a' }}>
                          {REPEAT_OPTIONS.find(opt => opt.value === selectedRepeat)?.label || 'Repeat'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>

                    {/* Set End Date – Only show if repeat is not 'none' */}
                    {selectedRepeat !== 'none' && (
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 16,
                        }}
                        onPress={handleRepeatEndDatePress}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="calendar-outline" size={20} color="#666" />
                          <Text style={{ marginLeft: 12, fontSize: 16, color: '#1a1a1a' }}>
                            {repeatEndDate
                              ? `Ends on ${repeatEndDate.toLocaleDateString()}`
                              : 'Set end date'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#666" />
                      </TouchableOpacity>
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
        paddingBottom: 24,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
      }}
      onPress={() => {}} // Prevent closing when tapping inside
    >

      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        {/* Hour Picker */}
        <Picker
          selectedValue={selectedHour}
          style={{ flex: 1 }}
          onValueChange={(val) => setSelectedHour(val)}
        >
          {Array.from({ length: 12 }, (_, i) => {
            const val = (i + 1).toString().padStart(2, '0');
            return <Picker.Item key={val} label={val} value={val} />;
          })}
        </Picker>

        {/* Minute Picker */}
        <Picker
          selectedValue={selectedMinute}
          style={{ flex: 1 }}
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
          style={{ flex: 1 }}
          onValueChange={(val) => setSelectedAmPm(val)}
        >
          <Picker.Item label="AM" value="AM" />
          <Picker.Item label="PM" value="PM" />
        </Picker>
      </View>
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
        paddingBottom: 24,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
      }}
    >
      {REPEAT_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => {
            setSelectedRepeat(opt.value as RepeatOption);
            setShowRepeatPicker(false);
          }}
          style={{
            paddingVertical: 16,
            paddingHorizontal: 24,
          }}
        >
          <Text style={{ fontSize: 16 }}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </TouchableOpacity>
</Modal>

<View
  style={{
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 20,
    gap: 12
  }}
>
  <TouchableOpacity
    style={{
      flex: 1,
      backgroundColor: '#E0E0E0',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center'
    }}
    onPress={handleCloseNewTaskModal}
  >
    <Text style={{ color: '#333', fontSize: 18, fontWeight: '600' }}>Cancel</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={{
      flex: 1,
      backgroundColor: '#007AFF',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center'
    }}
    onPress={handleCloseSettingsModal}
  >
    <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>Done</Text>
  </TouchableOpacity>
</View>

              </ScrollView>
            </View>
          </View>
        </Modal>

       
        {/* Date Picker Modal */}
        <DateTimePickerModal
          isVisible={showTaskDatePicker}
          mode="date"
          onConfirm={handleDatePickerConfirm}
          onCancel={handleDatePickerCancel}
        />

        {/* Repeat End Date Picker */}
        <DateTimePickerModal
          isVisible={showRepeatEndDatePicker}
          mode="date"
          onConfirm={handleRepeatEndDateConfirm}
          onCancel={handleRepeatEndDateCancel}
        />
      </View>

      {/* New Category Modal */}
      <Modal
    animationType="slide"
    transparent={true}
    visible={isNewCategoryModalVisible}
    onRequestClose={() => {
      console.log('🔒 Modal close requested');
      setIsNewCategoryModalVisible(false);
    }}
  >
     <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0} // adjust if needed
  >
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
      <View style={{ backgroundColor: 'white', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: '600' }}>New Category</Text>
          <TouchableOpacity onPress={() => {
            console.log('🔒 Close button pressed');
            setIsNewCategoryModalVisible(false);
          }}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <TextInput
          ref={categoryInputRef}
          style={{
            fontSize: 16,
            color: '#1a1a1a',
            padding: 12,
            backgroundColor: '#F5F5F5',
            borderRadius: 12,
            marginBottom: 20,
          }}
          value={newCategoryName}
          onChangeText={setNewCategoryName}
          placeholder="Category name"
          placeholderTextColor="#999"
          autoFocus
        />

        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Choose a color</Text>
        
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {['#BF9264', '#6F826A', '#BBD8A3', '#F0F1C5'].map((color) => (
            <TouchableOpacity
              key={color}
              onPress={() => setNewCategoryColor(color)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: color,
                marginRight: 12,
                borderWidth: newCategoryColor === color ? 3 : 1,
                borderColor: newCategoryColor === color ? '#007AFF' : '#ccc',
              }}
            />
          ))}
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
          
              setCategories(prev => [...prev, savedCategory]);
              setSelectedCategoryId(savedCategory.id); // ✅ Select the new category
              setNewCategoryName('');
              setIsNewCategoryModalVisible(false); // ✅ Close category modal
          
              setTimeout(() => {
                setIsNewTaskModalVisible(true); // ✅ Reopen new task modal
              }, 300); // Give time for category modal to close
          
            } catch (error) {
              console.error('Error creating category:', error);
              Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            }
          }}
          
          style={{
            backgroundColor: '#007AFF',
            padding: 16,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: 'auto',
          }}
        >
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Create Category</Text>
        </TouchableOpacity>
      </View>
    </View>
    </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  </Modal>


    </GestureHandlerRootView>
  );
}