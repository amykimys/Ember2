import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Image,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Plus, Check, Menu, X, Camera, CreditCard as Edit2, Repeat, Trash2 } from 'lucide-react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import Modal from 'react-native-modal';
import * as ImagePicker from 'expo-image-picker';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Animated } from 'react-native';      // <-- import Animated
import * as Haptics from 'expo-haptics';
import styles from '../../styles/habit.styles';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Calendar } from 'lucide-react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../supabase';


interface Habit {
  id: string;
  text: string;
  streak: number;
  description?: string;
  completedToday: boolean;
  completedDays: string[];
  weekDays: WeekDay[];
  repeatType: 'specific' | 'frequency';
  color: string;
  repeat?: RepeatOption;
  requirePhoto: boolean;
  photoProofs: { [date: string]: string };
  customRepeatFrequency?: number; 
  customRepeatUnit?: 'days' | 'weeks' | 'months'; 
  customRepeatWeekDays?: WeekDay[];
  frequency?: number;
  frequencyMode?: 'timesPerWeek' | 'weekDays';
  targetPerWeek?: number;
  reminderTime?: string | null;
  user_id?: string;
}

  
  type WeekDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
  type RepeatUnit = 'days' | 'weeks' | 'months';
  type RepeatOption = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';


  const REPEAT_OPTIONS = [
    { value: 'none' as const, label: "Don't repeat" },
    { value: 'daily' as const, label: 'Daily' },
    { value: 'weekly' as const, label: 'Weekly' },
    { value: 'monthly' as const, label: 'Monthly' },
    { value: 'custom' as const, label: 'Custom' },
  ];  

  const HABIT_COLORS = [
    { name: 'Sky', value: '#E3F2FD', text: '#1a1a1a' },
    { name: 'Lavender', value: '#F3E5F5', text: '#1a1a1a' },
    { name: 'Mint', value: '#E8F5E9', text: '#1a1a1a' },
    { name: 'Peach', value: '#FFF3E0', text: '#1a1a1a' },
    { name: 'Rose', value: '#FCE4EC', text: '#1a1a1a' },
    { name: 'Indigo', value: '#E8EAF6', text: '#1a1a1a' },
    { name: 'Cyan', value: '#E0F7FA', text: '#1a1a1a' },
    { name: 'Amber', value: '#FFF8E1', text: '#1a1a1a' },
    { name: 'Deep Purple', value: '#673AB7', text: '#ffffff' },
    { name: 'Teal', value: '#009688', text: '#ffffff' },
    { name: 'Orange', value: '#FF5722', text: '#ffffff' },
    { name: 'Blue Grey', value: '#607D8B', text: '#ffffff' },
  ];

  const weekdayLabels: { label: string; key: WeekDay }[] = [
    { label: 'M', key: 'mon' },
    { label: 'T', key: 'tue' },
    { label: 'W', key: 'wed' },
    { label: 'T', key: 'thu' },
    { label: 'F', key: 'fri' },
    { label: 'S', key: 'sat' },
    { label: 'S', key: 'sun' },
  ];
  
export default function HabitScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabit, setNewHabit] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(HABIT_COLORS[0]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<Date[]>([]);
  const [selectedWeekDays, setSelectedWeekDays] = useState<WeekDay[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [repeatType, setRepeatType] = useState<'specific' | 'frequency'>('specific');
  const [frequency, setFrequency] = useState(5);
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [selectedTheme, setSelectedTheme] = useState<keyof typeof THEMES>('pastel');
  const [newCategoryColor, setNewCategoryColor] = useState('#E3F2FD');
  const [habitDate, setHabitDate] = useState<Date | null>(null);
  const [showHabitDatePicker, setShowHabitDatePicker] = useState(false);
  const repeatBottomSheetRef = useRef<BottomSheet>(null);
  const [selectedRepeat, setSelectedRepeat] = useState<RepeatOption>('none');
  const [customRepeatFrequency, setCustomRepeatFrequency] = useState<number>(0);
  const [customRepeatUnit, setCustomRepeatUnit] = useState<RepeatUnit>('days');
  const [frequencyMode, setFrequencyMode] = useState<'timesPerWeek' | 'weekDays'>('weekDays');
  const [tempFrequencyMode, setTempFrequencyMode] = useState(frequencyMode);
  const [tempSelectedWeekDays, setTempSelectedWeekDays] = useState<WeekDay[]>(selectedWeekDays);
  const [tempFrequency, setTempFrequency] = useState(frequency);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const photoOptionsSheetRef = useRef<BottomSheet>(null);
  const [expandedStreakId, setExpandedStreakId] = useState<string | null>(null);
  const [isNewHabitModalVisible, setIsNewHabitModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isPhotoOptionsModalVisible, setIsPhotoOptionsModalVisible] = useState(false);
  const [isPhotoPreviewModalVisible, setIsPhotoPreviewModalVisible] = useState(false);
  const [isModalTransitioning, setIsModalTransitioning] = useState(false);





  
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
    requestCameraPermissions();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Fetch user's habits when signed in
        const { data: habitsData, error: habitsError } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', session.user.id);
        
        if (habitsError) {
          console.error('Error fetching habits:', habitsError);
        } else if (habitsData) {
          setHabits(habitsData.map(habit => ({
            ...habit,
            completedDays: habit.completed_days || [],
            photoProofs: habit.photo_proofs || {},
            reminderTime: habit.reminder_time,
            user_id: habit.user_id
          })));
        }
      } else if (event === 'SIGNED_OUT') {
        // Clear all local state when user signs out
        setHabits([]);
        resetForm();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function requestCameraPermissions() {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera permissions to make this work!');
      }
    }
  }

  async function scheduleReminderNotification(taskTitle: string, reminderTime: Date) {
    try {
      const secondsUntilReminder = Math.floor((reminderTime.getTime() - Date.now()) / 1000);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Reminder',
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
      console.error('Error scheduling notification:', error);
    }
  }

  function getTextColor(bgColor: string): string {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.6 ? '#ffffff' : '#1a1a1a';
  }

  function getWeeklyProgressStreak(habit: Habit) {
    const today = new Date();
  
    // Sunday = 0 → Sunday = 7, so Mon = 1
    const day = today.getDay() === 0 ? 7 : today.getDay();
  
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (day));
    startOfWeek.setHours(0, 0, 0, 0);
  
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
  
    const checkmarksThisWeek = habit.completedDays.filter(dateStr => {
      const date = new Date(dateStr);
      return date >= startOfWeek && date <= endOfToday;
    });
  
    const count = checkmarksThisWeek.length;
    const target = habit.targetPerWeek || 1;
  
    return `🔥 ${count}/${target}`;
  }
  

  const photoPreviewSheetRef = useRef<BottomSheet>(null);

  const resetForm = () => {
  setNewHabit('');
  setNewDescription('');
  setSelectedColor(HABIT_COLORS[0]);
  setNewCategoryColor(HABIT_COLORS[0].value);
  setSelectedWeekDays(['mon', 'tue', 'wed', 'thu', 'fri']);
  setRepeatType('specific');
  setFrequency(5);
  setRequirePhoto(false);
  setReminderEnabled(false);
  setReminderTime(null);
  setEditingHabit(null);
  setShowEditModal(false);
};


const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0];
};


  const getWeekDayKey = (date: Date): WeekDay => {
    return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()] as WeekDay;
  };
  

  const shouldShowHabit = (habit: Habit, date: Date) => {
    const dayName = date
      .toLocaleDateString('en-US', { weekday: 'short' })
      .toLowerCase()
      .slice(0, 3) as WeekDay;
  
    if (habit.repeatType === 'specific') {
      return habit.weekDays.includes(dayName);
    }
  
    if (habit.frequencyMode === 'weekDays') {
      return habit.weekDays.includes(dayName);
    }
  
    return true; // frequencyMode === 'timesPerWeek'
  };
  
  const calculateStreak = (habit: Habit, completedDays: string[]) => {
    if (habit.repeatType !== 'frequency' || habit.frequencyMode !== 'timesPerWeek') {
      const completedSet = new Set(completedDays);
      const today = new Date();
      let streak = 0;
      let currentDate = new Date(today);
  
      while (true) {
        const dateStr = formatDate(currentDate);
        if (completedSet.has(dateStr)) {
          streak++;
        } else {
          break;
        }
        currentDate.setDate(currentDate.getDate() - 1);
      }
  
      return streak;
    }
  
    const groupedWeeks = groupCompletedDaysByWeek(completedDays);
    const target = habit.targetPerWeek || 1;
    let streak = 0;
  
    // Iterate from most recent to oldest
    for (let i = groupedWeeks.length - 1; i >= 0; i--) {
      const week = groupedWeeks[i];
      const count = week.length;
  
      if (count >= target) {
        streak += count;
      } else {
        // 👇 Only break *after* checking the most recent valid week
        if (streak === 0) {
          break;
        } else {
          return streak;
        }
      }
    }
  
    return streak;
  };
  
  

  function groupCompletedDaysByWeek(dates: string[]): string[][] {
    const normalized = [...dates].map(d => formatDate(new Date(d))).sort();
    const weeks: Record<string, string[]> = {};
  
    for (const dateStr of normalized) {
      const date = new Date(dateStr);
  
      const day = date.getDay(); // 0 = Sunday
      const offset = (day + 6) % 7; // Make Monday = 0
      const mondayStart = new Date(date);
      mondayStart.setDate(date.getDate() - offset);
      mondayStart.setHours(0, 0, 0, 0);
  
      const weekKey = formatDate(mondayStart);
  
      if (!weeks[weekKey]) {
        weeks[weekKey] = [];
      }
  
      weeks[weekKey].push(dateStr);
    }
  
    return Object.values(weeks);
  }
  
  
  
  
  const toggleHabitDay = async (habitId: string, date: string) => {
    const normalizedDate = formatDate(new Date(date));
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('No user logged in');
      return;
    }

    setHabits(habits.map(habit => {
      if (habit.id === habitId) {
        const completedDays = habit.completedDays.includes(normalizedDate)
          ? habit.completedDays.filter(d => d !== normalizedDate)
          : [...habit.completedDays, normalizedDate];

        const updatedHabit = {
          ...habit,
          completedDays,
          streak: calculateStreak(habit, completedDays),
        };

        // Update in Supabase
        supabase
          .from('habits')
          .update({
            completed_days: completedDays,
            streak: updatedHabit.streak
          })
          .eq('id', habitId)
          .eq('user_id', user.id);

        return updatedHabit;
      }
      return habit;
    }));
  };
  

  const addHabit = async () => {
    if (
      newHabit.trim() &&
      (repeatType === 'frequency'
        ? frequencyMode === 'timesPerWeek'
          ? frequency > 0
          : selectedWeekDays.length > 0
        : selectedWeekDays.length > 0)
    ) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        return;
      }

      const computedWeekDays =
        repeatType === 'specific'
          ? selectedWeekDays
          : frequencyMode === 'weekDays'
          ? selectedWeekDays
          : [];

      const newHabitItem: Habit = {
        id: Date.now().toString(),
        text: newHabit.trim(),
        description: newDescription.trim(),
        streak: 0,
        completedToday: false,
        completedDays: [],
        color: newCategoryColor,
        repeatType,
        weekDays: computedWeekDays,
        frequency: repeatType === 'frequency' ? frequency : undefined,
        targetPerWeek: frequencyMode === 'timesPerWeek' ? frequency : undefined,
        frequencyMode,
        requirePhoto,
        photoProofs: {},
        user_id: user.id
      };

      // Save to Supabase
      const { error } = await supabase
        .from('habits')
        .insert({
          id: newHabitItem.id,
          text: newHabitItem.text,
          description: newHabitItem.description,
          streak: newHabitItem.streak,
          completed_days: newHabitItem.completedDays,
          color: newHabitItem.color,
          repeat_type: newHabitItem.repeatType,
          week_days: newHabitItem.weekDays,
          frequency: newHabitItem.frequency,
          require_photo: newHabitItem.requirePhoto,
          photo_proofs: newHabitItem.photoProofs,
          user_id: user.id
        });

      if (error) {
        console.error('Error saving habit:', error);
        return;
      }

      // Update local state
      setHabits(prev => [...prev, newHabitItem]);
      resetForm();
    }
  };
  
  const deleteHabit = async (habitId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('No user logged in');
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
      return;
    }

    // Update local state
    setHabits(habits => habits.filter(habit => habit.id !== habitId));
  };
  
const handlePhotoCapture = async (type: 'camera' | 'library') => {
    try {
      let result;
      
      if (type === 'camera') {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
          aspect: [4, 3],
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
          aspect: [4, 3],
        });
      }

      if (!result.canceled && selectedHabitId && selectedDate) {
        const uri = result.assets[0].uri;
        setHabits(habits.map(habit => {
          if (habit.id === selectedHabitId) {
            const updatedCompletedDays = [...habit.completedDays, selectedDate];
            return {
              ...habit,
              photoProofs: { ...habit.photoProofs, [selectedDate]: uri },
              completedDays: updatedCompletedDays,
              streak: calculateStreak(habit, updatedCompletedDays),
            };
          }
          return habit;
        }));
        setShowPhotoModal(false);
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
      alert('Failed to capture photo. Please try again.');
    }
  };

  const handleHabitPress = (habitId: string, date: string) => {
    console.log(`Pressed: ${habitId} on ${date}`);
  
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
  
    if (habit.requirePhoto) {
      setSelectedHabitId(habitId);
      setSelectedDate(date);
      setIsPhotoOptionsModalVisible(true);
    } else {
      toggleHabitDay(habitId, date);
    }
  };
  

  const handleSave = async () => {
    if (!newHabit.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No user logged in');
      return;
    }

    if (editingHabit) {
      // Edit existing habit
      const updatedHabit = {
        ...editingHabit,
        text: newHabit.trim(),
        description: newDescription.trim(),
        color: newCategoryColor,
        repeatType,
        weekDays: repeatType === 'specific' ? selectedWeekDays : [],
        frequency: repeatType === 'frequency' ? frequency : undefined,
        requirePhoto,
        reminderTime: reminderEnabled ? reminderTime?.toISOString() : null,
        user_id: user.id
      };

      // Update in Supabase
      const { error } = await supabase
        .from('habits')
        .update({
          text: updatedHabit.text,
          description: updatedHabit.description,
          color: updatedHabit.color,
          repeat_type: updatedHabit.repeatType,
          week_days: updatedHabit.weekDays,
          frequency: updatedHabit.frequency,
          require_photo: updatedHabit.requirePhoto,
          reminder_time: updatedHabit.reminderTime,
        })
        .eq('id', updatedHabit.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating habit:', error);
        return;
      }

      // Update local state
      setHabits(prev => prev.map(h => h.id === editingHabit.id ? updatedHabit : h));
    } else {
      // Add new habit
      const newHabitItem: Habit = {
        id: Date.now().toString(),
        text: newHabit.trim(),
        description: newDescription.trim(),
        streak: 0,
        completedToday: false,
        completedDays: [],
        color: newCategoryColor,
        repeatType,
        weekDays: repeatType === 'specific' ? selectedWeekDays : [],
        frequency: repeatType === 'frequency' ? frequency : undefined,
        requirePhoto,
        photoProofs: {},
        user_id: user.id
      };

      // Save to Supabase
      const { error } = await supabase
        .from('habits')
        .insert({
          id: newHabitItem.id,
          text: newHabitItem.text,
          description: newHabitItem.description,
          streak: newHabitItem.streak,
          completed_days: newHabitItem.completedDays,
          color: newHabitItem.color,
          repeat_type: newHabitItem.repeatType,
          week_days: newHabitItem.weekDays,
          frequency: newHabitItem.frequency,
          require_photo: newHabitItem.requirePhoto,
          photo_proofs: newHabitItem.photoProofs,
          user_id: user.id
        });

      if (error) {
        console.error('Error saving habit:', error);
        return;
      }

      // Update local state
      setHabits(prev => [...prev, newHabitItem]);

      if (reminderTime) {
        await scheduleReminderNotification(newHabit.trim(), reminderTime);
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetForm();
    bottomSheetRef.current?.close();
  };
  

  const showPhotoProof = (habitId: string, date: string) => {
    const habit = habits.find(h => h.id === habitId);
    const photoUri = habit?.photoProofs[date];
    if (photoUri) {
      setPreviewPhoto(photoUri);
      setIsPhotoPreviewModalVisible(true);
    }
  };
  

  const handleEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    setNewHabit(habit.text);
    setNewDescription(habit.description || '');
    setSelectedColor(HABIT_COLORS.find(c => c.value === habit.color) || HABIT_COLORS[0]);
    setNewCategoryColor(habit.color);
    setRepeatType(habit.repeatType);
    setRequirePhoto(habit.requirePhoto);
    setReminderTime(habit.reminderTime ? new Date(habit.reminderTime) : null);
    setReminderEnabled(!!habit.reminderTime);
    setFrequencyMode(habit.frequencyMode || 'weekDays');
    setSelectedWeekDays(habit.weekDays || []);
    setFrequency(habit.frequency || habit.targetPerWeek || 1);
    setIsNewHabitModalVisible(true);
  };
  

  const saveEditedHabit = () => {
    if (editingHabit && newHabit.trim()) {
      setHabits(habits.map(habit => 
        habit.id === editingHabit.id
          ? {
            ...habit,
            name: newHabit.trim(),
            details: newDescription.trim(),
            color: newCategoryColor,
            repeatType,
            weekDays: repeatType === 'specific' ? selectedWeekDays : [],
            frequency: repeatType === 'frequency' ? frequency : undefined,
            requirePhoto,
            reminderTime: reminderEnabled ? reminderTime?.toISOString() || null : null, // 👈 Add this
        }
          : habit
      ));
      resetForm();
    }
  };

  const renderHabitCheckmarks = (habit: Habit) => (
    <View style={styles.checkmarksContainer}>
      {currentWeek.map((date, index) => {
  const dateStr = formatDate(date);
  const dayKey = getWeekDayKey(date); // returns 'mon', 'tue', etc.
  const isCompleted = habit.completedDays.includes(dateStr) &&
    (!habit.requirePhoto || (habit.requirePhoto && habit.photoProofs[dateStr]));

  const isDueDay = habit.weekDays.includes(dayKey);

  // Repeat Type: specific
  if (habit.repeatType === 'specific') {
    return (
      <View key={index} style={styles.dayIndicatorWrapper}>
        {isDueDay ? (
          <TouchableOpacity
            onPress={() => handleHabitPress(habit.id, dateStr)}
            onLongPress={() => showPhotoProof(habit.id, dateStr)}
          >
            <View style={[
              styles.circleBase,
              isCompleted ? styles.checkmarkAlone : styles.openCircle
            ]}>
              {isCompleted && <Check size={18} color="black" />}
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.grayDot} />
        )}
      </View>
    );
  }

  // Repeat Type: frequency (weekDays)
  if (habit.repeatType === 'frequency' && habit.frequencyMode === 'weekDays') {
    return (
      <View key={index} style={styles.dayIndicatorWrapper}>
        {isDueDay ? (
          <TouchableOpacity
            onPress={() => handleHabitPress(habit.id, dateStr)}
            onLongPress={() => showPhotoProof(habit.id, dateStr)}
          >
            <View style={[
              styles.circleBase,
              isCompleted ? styles.checkmarkAlone : styles.openCircle
            ]}>
              {isCompleted && <Check size={18} color="black" />}
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.grayDot} />
        )}
      </View>
    );
  }

  // Repeat Type: frequency (timesPerWeek)
  return (
    <View key={index} style={styles.dayIndicatorWrapper}>
      <TouchableOpacity
        onPress={() => handleHabitPress(habit.id, dateStr)}
        onLongPress={() => showPhotoProof(habit.id, dateStr)}
      >
        <View style={[
          styles.circleBase,
          isCompleted ? styles.checkmarkAlone : styles.openCircle
        ]}>
          {isCompleted && <Check size={18} color="black" />}
        </View>
      </TouchableOpacity>
    </View>
  );
})}

    </View>
  );
  

  const renderWeekHeader = () => {
    const todayStr = formatDate(new Date());

    return (
      <View style={styles.weekHeaderContainer}>
        <Text style={styles.monthText}>{new Date().toLocaleString('en-US', { month: 'long' })}</Text>
        <View style={styles.weekHeaderDates}>
          {currentWeek.map((date, index) => {
            const dateStr = formatDate(date);
            const isToday = dateStr === todayStr;
            return (
              <View key={index} style={styles.dayColumn}>
                <Text style={[
                  styles.dayAbbreviation,
                  isToday && { fontWeight: 'bold', color: '#1a1a1a' }
                ]}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                </Text>
                <Text style={[
                  styles.dateNumber,
                  isToday && { fontWeight: 'bold', color: '#1a1a1a' }
                ]}>
                  {date.getDate()}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  function getTotalHabitCompletions(habit: Habit) {
    return `🔥 Total: ${habit.completedDays.length}`;
  }
  
  function getWeeklyStreakDisplay(habit: Habit) {
    const today = new Date();
  
    // Convert Sunday (0) to 7 so Mon = 1, ..., Sun = 7
    const day = today.getDay() === 0 ? 7 : today.getDay();
  
    // Start of week = this week's Monday
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (day)); // ✔️ Mon = 1 → subtract 0
    startOfWeek.setHours(0, 0, 0, 0);
  
    // End of today
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
  
    const checkmarksThisWeek = habit.completedDays.filter(dateStr => {
      const date = new Date(dateStr);
      return date >= startOfWeek && date <= endOfToday;
    });
  
    const count = checkmarksThisWeek.length;
    const target = habit.targetPerWeek || 1;
  
    return count < target ? `🔥 ${count}/${target}` : `🔥 ${count}`;
  }
  
  

  // Add debounce function
  const debounce = (func: () => void, wait: number) => {
    let timeout: NodeJS.Timeout;
    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(), wait);
    };
  };

  // Create debounced handlers
  const handleCloseNewHabitModal = useCallback(
    debounce(() => {
      if (isModalTransitioning) return;
      setIsModalTransitioning(true);
      setIsNewHabitModalVisible(false);
      setTimeout(() => {
        setIsModalTransitioning(false);
      }, 300);
    }, 300),
    [isModalTransitioning]
  );

  const handleCloseSettingsModal = useCallback(
    debounce(() => {
      if (isModalTransitioning) return;
      setIsModalTransitioning(true);
      setIsSettingsModalVisible(false);
      setTimeout(() => {
        setIsModalTransitioning(false);
      }, 300);
    }, 300),
    [isModalTransitioning]
  );

  const handleClosePhotoOptionsModal = useCallback(
    debounce(() => {
      if (isModalTransitioning) return;
      setIsModalTransitioning(true);
      setIsPhotoOptionsModalVisible(false);
      setTimeout(() => {
        setIsModalTransitioning(false);
      }, 300);
    }, 300),
    [isModalTransitioning]
  );

  const handleClosePhotoPreviewModal = useCallback(
    debounce(() => {
      if (isModalTransitioning) return;
      setIsModalTransitioning(true);
      setIsPhotoPreviewModalVisible(false);
      setTimeout(() => {
        setIsModalTransitioning(false);
      }, 300);
    }, 300),
    [isModalTransitioning]
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="menu" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.title}>habits</Text>
      </View>

      {renderWeekHeader()}

      <ScrollView style={styles.habitList}>
        {habits.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>no habits yet!</Text>
            <Text style={styles.emptyStateSubtitle}>Start building good habits :)</Text>
          </View>
        ) : (
          habits.map((habit) => (   // <-- REMOVE the extra { here
            <Swipeable
              key={habit.id}
               onSwipeableOpen={() => {
                   if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
                  deleteHabit(habit.id);
                }}
              friction={1.5} // <-- slows it down a little
              overshootFriction={8} // <-- adds a bounce at the end
              renderRightActions={(progress, dragX) => {
                const scale = dragX.interpolate({
                  inputRange: [-100, 0],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                });
            
                return (
                  <View style={styles.rightAction}>
                    <Animated.View style={[styles.trashIconContainer, { transform: [{ scale }] }]}>
                      <Trash2 color="white" size={24} />
                    </Animated.View>
                  </View>
                );
              }}
            >
              <TouchableOpacity
                onLongPress={() => handleEditHabit(habit)}
                delayLongPress={300}
                activeOpacity={0.9}
              >
                <View style={{ position: 'relative' }}>
                <View
  style={[
    styles.habitItem,
    { backgroundColor: habit.color, position: 'relative' }  // 👈 Add position
  ]}
>

  <View style={styles.habitHeader}>
  {habit.frequencyMode === 'timesPerWeek' ? (
  <TouchableOpacity onPress={() => {
    setExpandedStreakId(expandedStreakId === habit.id ? null : habit.id);
  }}>
    <Text style={styles.streakText}>
      {expandedStreakId === habit.id
        ? getTotalHabitCompletions(habit)
        : getWeeklyProgressStreak(habit)}
    </Text>
  </TouchableOpacity>
) : (
  <Text style={styles.streakText}>
    🔥 {habit.streak}
  </Text>
)}


    {renderHabitCheckmarks(habit)}
  </View>

  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
  <Text style={[styles.habitName, { color: getTextColor(habit.color), flexShrink: 1 }]}>
    {habit.text}
  </Text>
  {habit.requirePhoto && (
    <Camera size={16} color={getTextColor(habit.color)} style={{ marginLeft: 8 }} />
  )}
</View>


  {habit.description && (
    <Text style={[
      styles.habitDetails,
      { color: getTextColor(habit.color) }
    ]}>
      {habit.description}
    </Text>
  )}
</View>
</View>

              </TouchableOpacity>
            </Swipeable>
          ))
        )}
      </ScrollView>


        {/* ADD HABIT BUTTON */}
        <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  resetForm();                 // (Optional) Clear old input
                  setIsNewHabitModalVisible(true); // ✅ Open the bottomsheet
                }}
              >
                <Ionicons name="add" size={24} color="white" />
              </TouchableOpacity>


      {/* --- NEW HABIT MODAL --- */}
      <Modal
        isVisible={isNewHabitModalVisible}
        onBackdropPress={handleCloseNewHabitModal}
        onBackButtonPress={handleCloseNewHabitModal}
        style={{ margin: 0, justifyContent: 'flex-end' }}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropTransitionOutTiming={0}
        useNativeDriver
        hideModalContentWhileAnimating
      >
        <View style={[styles.modalOverlay]}>
          <View style={[styles.modalContent, { 
            backgroundColor: 'white',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            height: '80%',
            width: '100%'
          }]}>
            <View style={[styles.modalHeader, {
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#E0E0E0'
            }]}>
              <Text style={[styles.modalTitle, {
                fontSize: 28,
                fontWeight: 'bold',
                color: '#1a1a1a'
              }]}>{editingHabit ? 'Edit Habit' : 'New Habit'}</Text>
              <TouchableOpacity 
                onPress={handleCloseNewHabitModal}
                disabled={isModalTransitioning}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ 
                paddingBottom: 40
              }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Title Input */}
              <TextInput
                style={[styles.input, {
                  fontSize: 20,
                  color: '#1a1a1a',
                  padding: 16,
                  backgroundColor: '#F5F5F5',
                  borderRadius: 12,
                  marginBottom: 20
                }]}
                value={newHabit}
                onChangeText={setNewHabit}
                placeholder="What needs to be done?"
                placeholderTextColor="#666"
              />

              {/* Description Input */}
              <TextInput
                style={[styles.input, styles.descriptionInput, {
                  minHeight: 150,
                  textAlignVertical: 'top',
                  marginBottom: 30,
                  fontSize: 18,
                  padding: 16,
                  backgroundColor: '#F5F5F5',
                  borderRadius: 12
                }]}
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="Add description (optional)"
                placeholderTextColor="#666"
                multiline
                textAlignVertical="top"
              />

              {/* Color Section */}
              <View style={styles.categorySection}>
                <Text style={styles.sectionTitle}>Color</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ marginTop: 12, flexDirection: 'row' }}
                >
                  {Object.keys(THEMES).map((theme) => (
                    <TouchableOpacity
                      key={theme}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        backgroundColor: selectedTheme === theme ? '#007AFF' : '#E0E0E0',
                        borderRadius: 20,
                        marginRight: 10,
                      }}
                      onPress={() => setSelectedTheme(theme as keyof typeof THEMES)}
                    >
                      <Text style={{ color: selectedTheme === theme ? 'white' : '#333', fontWeight: '600' }}>
                        {theme}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                  {THEMES[selectedTheme].map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: color,
                        margin: 5,
                        borderWidth: newCategoryColor === color ? 2 : 0,
                        borderColor: '#007AFF',
                      }}
                      onPress={() => setNewCategoryColor(color)}
                    />
                  ))}
                </View>
              </View>

              {/* Photo Section */}
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Require Photo</Text>
                <Switch
                  value={requirePhoto}
                  onValueChange={setRequirePhoto}
                  trackColor={{ false: '#ccc', true: '#007AFF' }}
                  thumbColor={requirePhoto ? 'white' : '#f4f3f4'}
                />
              </View>

              {/* Reminder Section */}
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Reminder</Text>
                <TouchableOpacity
                  style={styles.newOptionButton}
                  onPress={() => setShowReminderPicker(true)}
                >
                  <Ionicons name="time-outline" size={20} color="#666" />
                  <Text style={styles.newOptionText}>
                    {reminderTime ? reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Frequency Section */}
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Frequency</Text>
                <TouchableOpacity
                  style={styles.newOptionButton}
                  onPress={() => setIsSettingsModalVisible(true)}
                >
                  <Ionicons name="repeat" size={20} color="#666" />
                  <Text style={styles.newOptionText}>
                    {frequencyMode === 'weekDays'
                      ? `Custom Weekdays`
                      : `Target Frequency`}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  {
                    paddingVertical: 16,
                    backgroundColor: newHabit.trim() ? '#007AFF' : '#B0BEC5',
                    borderRadius: 12,
                    alignItems: 'center',
                    marginTop: 30,
                    marginBottom: 20
                  },
                  !newHabit.trim() && styles.saveButtonDisabled
                ]}
                onPress={handleSave}
                disabled={!newHabit.trim()}
              >
                <Text style={[styles.saveButtonText, {
                  color: 'white',
                  fontWeight: '600',
                  fontSize: 18
                }]}>Save</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        isVisible={isSettingsModalVisible}
        onBackdropPress={handleCloseSettingsModal}
        onBackButtonPress={handleCloseSettingsModal}
        style={{ margin: 0, justifyContent: 'flex-end' }}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropTransitionOutTiming={0}
        useNativeDriver
        hideModalContentWhileAnimating
      >
        <View style={[styles.modalOverlay]}>
          <View style={[styles.modalContent, { 
            backgroundColor: 'white',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            height: '45%',
            width: '100%'
          }]}>
            <View style={[styles.modalHeader, {
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#E0E0E0'
            }]}>
              <Text style={[styles.modalTitle, {
                fontSize: 24,
                fontWeight: 'bold',
                color: '#1a1a1a'
              }]}>Set Frequency</Text>
              <TouchableOpacity 
                onPress={handleCloseSettingsModal}
                disabled={isModalTransitioning}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              {/* Frequency Mode Toggle */}
              <View style={{ flexDirection: 'row', marginVertical: 10 }}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    tempFrequencyMode === 'weekDays' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setTempFrequencyMode('weekDays')}
                >
                  <Text style={[
                    styles.toggleButtonText,
                    { color: tempFrequencyMode === 'weekDays' ? 'white' : 'black' }
                  ]}>
                    Weekdays
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    tempFrequencyMode === 'timesPerWeek' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setTempFrequencyMode('timesPerWeek')}
                >
                  <Text style={[
                    styles.toggleButtonText,
                    { color: tempFrequencyMode === 'timesPerWeek' ? 'white' : 'black' }
                  ]}>
                    Times Per Week
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Weekday Picker */}
              {tempFrequencyMode === 'weekDays' && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginVertical: 10 }}>
                  {weekdayLabels.map(({ label, key }) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.dayToggle,
                        tempSelectedWeekDays.includes(key) && styles.dayToggleSelected,
                      ]}
                      onPress={() => {
                        setTempSelectedWeekDays((prev) =>
                          prev.includes(key)
                            ? prev.filter((d) => d !== key)
                            : [...prev, key]
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.dayToggleText,
                          tempSelectedWeekDays.includes(key) && { color: 'white' }
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Times Per Week */}
              {tempFrequencyMode === 'timesPerWeek' && (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ marginBottom: 4 }}>How many times per week?</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={tempFrequency.toString()}
                    onChangeText={(text) => setTempFrequency(parseInt(text) || 0)}
                    placeholder="e.g. 3"
                  />
                </View>
              )}

              {/* Save Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#007AFF',
                  padding: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginTop: 20
                }}
                onPress={() => {
                  setFrequencyMode(tempFrequencyMode);
                  setSelectedWeekDays(tempSelectedWeekDays);
                  setFrequency(tempFrequency);
                  if (editingHabit?.repeatType === 'specific') {
                    setRepeatType('specific');
                  } else {
                    setRepeatType('frequency');
                  }
                  setSelectedRepeat('custom');
                  setIsSettingsModalVisible(false);
                }}
              >
                <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo Options Modal */}
      <Modal
        isVisible={isPhotoOptionsModalVisible}
        onBackdropPress={handleClosePhotoOptionsModal}
        onBackButtonPress={handleClosePhotoOptionsModal}
        style={{ margin: 0, justifyContent: 'flex-end' }}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropTransitionOutTiming={0}
        useNativeDriver
        hideModalContentWhileAnimating
      >
        <View style={[styles.modalOverlay]}>
          <View style={[styles.modalContent, { 
            backgroundColor: 'white',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            height: '35%',
            width: '100%'
          }]}>
            <View style={[styles.modalHeader, {
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#E0E0E0'
            }]}>
              <Text style={[styles.modalTitle, {
                fontSize: 24,
                fontWeight: 'bold',
                color: '#1a1a1a'
              }]}>Upload Photo</Text>
              <TouchableOpacity 
                onPress={handleClosePhotoOptionsModal}
                disabled={isModalTransitioning}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              <TouchableOpacity
                style={{ paddingVertical: 14 }}
                onPress={() => {
                  setIsPhotoOptionsModalVisible(false);
                  handlePhotoCapture('camera');
                }}
              >
                <Text style={{ fontSize: 16 }}>📷 Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ paddingVertical: 14 }}
                onPress={() => {
                  setIsPhotoOptionsModalVisible(false);
                  handlePhotoCapture('library');
                }}
              >
                <Text style={{ fontSize: 16 }}>🖼️ Choose from Library</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ paddingVertical: 14 }}
                onPress={handleClosePhotoOptionsModal}
              >
                <Text style={{ fontSize: 16, color: '#999' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo Preview Modal */}
      <Modal
        isVisible={isPhotoPreviewModalVisible}
        onBackdropPress={handleClosePhotoPreviewModal}
        onBackButtonPress={handleClosePhotoPreviewModal}
        style={{ margin: 0, justifyContent: 'flex-end' }}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropTransitionOutTiming={0}
        useNativeDriver
        hideModalContentWhileAnimating
      >
        <View style={[styles.modalOverlay]}>
          <View style={[styles.modalContent, { 
            backgroundColor: 'white',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            height: '60%',
            width: '100%'
          }]}>
            <View style={[styles.modalHeader, {
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#E0E0E0'
            }]}>
              <Text style={[styles.modalTitle, {
                fontSize: 24,
                fontWeight: 'bold',
                color: '#1a1a1a'
              }]}>Photo Proof</Text>
              <TouchableOpacity 
                onPress={handleClosePhotoPreviewModal}
                disabled={isModalTransitioning}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              {previewPhoto ? (
                <Image
                  source={{ uri: previewPhoto }}
                  style={{
                    width: '100%',
                    height: 300,
                    borderRadius: 12,
                    backgroundColor: '#f0f0f0',
                  }}
                  resizeMode="contain"
                />
              ) : (
                <Text style={{ color: '#999' }}>No photo available.</Text>
              )}

              <TouchableOpacity
                onPress={handleClosePhotoPreviewModal}
                style={{ marginTop: 16, padding: 12, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 16, color: '#007AFF' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DateTimePickerModal
        isVisible={showReminderPicker}
        mode="time"  // 🔥 ONLY time
        onConfirm={(date) => {
          setReminderTime(date);
          setShowReminderPicker(false);
        }}
        onCancel={() => setShowReminderPicker(false)}
      />

    </View> 
    </GestureHandlerRootView>
  );
}




