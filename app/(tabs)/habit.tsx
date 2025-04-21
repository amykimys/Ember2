import { useState, useEffect, useRef } from 'react';
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
  reminderTime?: string | null; // ✅ Add this line
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


function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]; // 'YYYY-MM-DD'
}



  const getWeekDayKey = (date: Date): WeekDay => {
    return ['sun','mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()] as WeekDay;
  };
  
  
  const calculateStreak = (habit: Habit, completedDays: string[]) => {
    const today = new Date();
    const completedSet = new Set(completedDays.map(d => formatDate(new Date(d))));
  
    // --- ✅ WEEKDAYS MODE: +1 per completed due day, reset if missed ---
    if (habit.repeatType === 'frequency' && habit.frequencyMode === 'weekDays') {
      const requiredDays = habit.weekDays; // e.g. ['mon', 'tue', 'thu']
      const completedSet = new Set(completedDays.map(d => formatDate(new Date(d))));
      const today = new Date();
    
      let streak = 0;
      let currentDate = new Date(today);
      let hasStarted = false;
    
      while (true) {
        const dateStr = formatDate(currentDate);
        const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][currentDate.getDay()] as WeekDay;
    
        if (requiredDays.includes(dayKey)) {
          if (completedSet.has(dateStr)) {
            streak++;
            hasStarted = true; // ✅ streak officially starts
          } else {
            if (hasStarted) break; // ❌ once started, a miss breaks it
          }
        }
    
        currentDate.setDate(currentDate.getDate() - 1);
    
        // Stop if we've gone before the first ever completed day
        if (completedDays.length > 0) {
          const earliestLogged = new Date(completedDays[0]);
          if (currentDate < earliestLogged) break;
        }
      }
    
      return streak;
    }
    
  
    // --- ✅ TIMES PER WEEK MODE: +count per week if target met ---
    if (habit.repeatType === 'frequency' && habit.frequencyMode === 'timesPerWeek') {
      const groupedWeeks = groupCompletedDaysByWeek(completedDays);
      const target = habit.targetPerWeek || 1;
      let streak = 0;
  
      for (let i = groupedWeeks.length - 1; i >= 0; i--) {
        const week = groupedWeeks[i];
        const count = week.length;
  
        if (count >= target) {
          streak += count;
        } else {
          if (streak === 0) {
            break;
          } else {
            return streak;
          }
        }
      }
  
      return streak;
    }
  
    // --- ✅ DEFAULT DAILY STREAK MODE: simple consecutive days ---
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
  
  
  
  
  const toggleHabitDay = (habitId: string, date: string) => {
    const normalizedDate = formatDate(new Date(date));
  
    setHabits(habits.map(habit => {
      if (habit.id === habitId) {
        const completedDays = habit.completedDays.includes(normalizedDate)
          ? habit.completedDays.filter(d => d !== normalizedDate)
          : [...habit.completedDays, normalizedDate];
  
        return {
          ...habit,
          completedDays,
          streak: calculateStreak(habit, completedDays),
        };
      }
      return habit;
    }));
  };
  

  const addHabit = () => {
    if (
      newHabit.trim() &&
      (repeatType === 'frequency'
        ? frequencyMode === 'timesPerWeek'
          ? frequency > 0
          : selectedWeekDays.length > 0
        : selectedWeekDays.length > 0)
    ) {
      const computedWeekDays =
        repeatType === 'specific'
          ? selectedWeekDays
          : frequencyMode === 'weekDays'
          ? selectedWeekDays
          : [];
  
      setHabits([
        ...habits,
        {
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
        },
      ]);
      resetForm();
    }
  };
  
  const deleteHabit = (habitId: string) => {
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
    console.log(`Pressed: ${habitId} on ${date}`); // 👈 check this
  
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
  
    if (habit.requirePhoto) {
      setSelectedHabitId(habitId);
      setSelectedDate(date);
      photoOptionsSheetRef.current?.expand();

    } else {
      toggleHabitDay(habitId, date);
    }
  };
  

  const handleSave = async () => {
    if (!newHabit.trim()) return;
  
    if (editingHabit) {
      // Edit existing habit
      const updatedHabits = habits.map(habit => {
        if (habit.id === editingHabit.id) {
          return {
            ...habit,
            text: newHabit.trim(),
            description: newDescription.trim(),
            color: newCategoryColor,
            repeatType,
            weekDays:
              repeatType === 'specific'
                ? selectedWeekDays
                : frequencyMode === 'weekDays'
                  ? selectedWeekDays
                  : [],
            frequency:
              repeatType === 'frequency' ? frequency : undefined,
            targetPerWeek:
              repeatType === 'frequency' && frequencyMode === 'timesPerWeek'
                ? frequency
                : undefined,
            frequencyMode:
              repeatType === 'frequency' ? frequencyMode : undefined,
            requirePhoto,
            reminderTime: reminderEnabled ? reminderTime?.toISOString() : null,
          };
        }
        return habit;
      });
  
      setHabits(updatedHabits);
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
        weekDays:
          repeatType === 'specific'
            ? selectedWeekDays
            : frequencyMode === 'weekDays'
            ? selectedWeekDays
            : [],
        frequency: repeatType === 'frequency' ? frequency : undefined,
        targetPerWeek: frequencyMode === 'timesPerWeek' ? frequency : undefined,
        frequencyMode,
        requirePhoto,
        photoProofs: {},
      };
  
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
      photoPreviewSheetRef.current?.expand();
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
    
    // ✅ FIX THESE:
    setFrequencyMode(habit.frequencyMode || 'weekDays');
    setSelectedWeekDays(habit.weekDays || []);
    setFrequency(habit.frequency || habit.targetPerWeek || 1); // <-- pull from either field
  
    bottomSheetRef.current?.expand();
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
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton}>
          <Menu size={24} color="#1a1a1a" />
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
                  bottomSheetRef.current?.expand(); // ✅ Open the bottomsheet
                }}
              >
                <Plus size={24} color="white" />
              </TouchableOpacity>


      {/* --- NEW HABIT MODAL --- */}
      <BottomSheet
            ref={bottomSheetRef}
            index={-1}
            snapPoints={['90%']}
            enablePanDownToClose
            detached={true}
            bottomInset={0}
            style={styles.bottomSheet} // make sure you have the full width and nice border radius in your styles
            onChange={(index) => {
              if (index === -1) {
                  resetForm();
              }
            }}
          >
           <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

                {/* --- HEADER --- */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{editingHabit ? 'Edit Habit' : 'New Habit'}</Text>
                <TouchableOpacity onPress={() => bottomSheetRef.current?.close()}>
                    <X size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* --- TITLE INPUT --- */}
                <TextInput
                  style={styles.input}
                  value={newHabit}
                  onChangeText={setNewHabit}
                  placeholder={editingHabit ? '' : 'What needs to be done?'}
                />

                {/* --- DESCRIPTION INPUT --- */}
                <TextInput
                  style={[styles.input, styles.descriptionInput]}
                  value={newDescription}
                  onChangeText={setNewDescription}
                  placeholder={editingHabit ? '' : 'Add description (optional)'}
                  multiline
                />

                {/* --- COLOR SECTION --- */}
                <View style={styles.categorySection}>
                  <Text style={styles.sectionTitle}>Color</Text>

                        {/* Theme Selector */}
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

                        {/* Swatch Grid */}
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

                {/* --- PHOTO SECTION --- */}
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>Require Photo</Text>
                  <Switch
                    value={requirePhoto}
                    onValueChange={setRequirePhoto}
                    trackColor={{ false: '#ccc', true: '#007AFF' }}
                    thumbColor={requirePhoto ? 'white' : '#f4f3f4'}
                  />
                </View>

                {/* --- REMINDER SECTION --- */}
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>Reminder</Text>
                  <TouchableOpacity
                    style={styles.newOptionButton}
                    onPress={() => setShowReminderPicker(true)}
                  >
                    <Calendar size={20} color="#666" />
                    <Text style={styles.newOptionText}>
                      {reminderTime ? reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* --- FREQUENCY SECTION --- */}
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>Frequency</Text>
                  <TouchableOpacity
                    style={styles.newOptionButton}
                    onPress={() => {
                      repeatBottomSheetRef.current?.expand();
                    }}
                  >
                    <Repeat size={20} color="#666" />
                    <Text style={styles.newOptionText}>
                      {frequencyMode === 'weekDays'
                        ? `Custom Weekdays`
                        : `Target Frequency`}
                    </Text>
                  </TouchableOpacity>
                </View>


                {/* --- SAVE / CANCEL BUTTONS --- */}
                <View style={{ flexDirection: 'row', marginTop: 24 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      backgroundColor: '#E0E0E0',
                      borderRadius: 12,
                      alignItems: 'center',
                      marginRight: 8,
                    }}
                    onPress={() => bottomSheetRef.current?.close()}
                  >
                    <Text style={{ color: '#333', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      backgroundColor: newHabit.trim() ? '#007AFF' : '#B0BEC5',
                      borderRadius: 12,
                      alignItems: 'center',
                      marginLeft: 8,
                    }}
                    onPress={handleSave}
                    disabled={!newHabit.trim()}
                  >
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Save</Text>
                  </TouchableOpacity>
                </View>

              </ScrollView>
            </KeyboardAvoidingView>
          </BottomSheet>

          <BottomSheet
  ref={repeatBottomSheetRef}
  index={-1}
  snapPoints={['45%']}
  enablePanDownToClose
  detached={true}
  bottomInset={0}
  style={styles.bottomSheet}
>
  <View style={{ padding: 20 }}>
    <Text style={styles.sectionTitle}>Set Frequency</Text>

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

    {/* ✅ Add buttons HERE inside BottomSheet */}
    <View style={{ flexDirection: 'row', marginTop: 20 }}>
      <TouchableOpacity
        style={{
          flex: 1,
          paddingVertical: 14,
          backgroundColor: '#E0E0E0',
          borderRadius: 12,
          alignItems: 'center',
          marginRight: 8,
        }}
        onPress={() => {
          setFrequencyMode(tempFrequencyMode);
          setSelectedWeekDays(tempSelectedWeekDays);
          setFrequency(tempFrequency);
        
          // ✅ Preserve current repeat type
          if (editingHabit?.repeatType === 'specific') {
            setRepeatType('specific');
          } else {
            setRepeatType('frequency');
          }
        
          setSelectedRepeat('custom');
          repeatBottomSheetRef.current?.close();
        }}        
        
      >
        <Text style={{ color: '#333', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          flex: 1,
          paddingVertical: 14,
          backgroundColor: '#007AFF',
          borderRadius: 12,
          alignItems: 'center',
          marginLeft: 8,
        }}
        onPress={() => {
          setFrequencyMode(tempFrequencyMode);
          setSelectedWeekDays(tempSelectedWeekDays);
          setFrequency(tempFrequency);

          // ✅ update for editing mode
          if (editingHabit) {
            setHabits(prev =>
              prev.map(h =>
                h.id === editingHabit.id
                  ? {
                      ...h,
                      frequencyMode: tempFrequencyMode,
                      weekDays: tempSelectedWeekDays,
                      frequency: tempFrequency,
                      repeatType: 'frequency',
                      repeat: 'custom',
                    }
                  : h
              )
            );
          } else {
            // 👇 Only needed when adding new habit
            setRepeatType('frequency');
            setSelectedRepeat('custom');
          }

          repeatBottomSheetRef.current?.close();

        }}
      >
        <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Save</Text>
      </TouchableOpacity>
    </View>
  </View>
</BottomSheet>

<BottomSheet
  ref={photoOptionsSheetRef}
  index={-1}
  snapPoints={['35%']}
  enablePanDownToClose
  detached={true}
  bottomInset={0}
  style={styles.bottomSheet}
>
  <View style={{ padding: 20 }}>
    <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 20 }}>Upload Photo</Text>

    <TouchableOpacity
      style={{ paddingVertical: 14 }}
      onPress={() => {
        photoOptionsSheetRef.current?.close();
        handlePhotoCapture('camera');
      }}
    >
      <Text style={{ fontSize: 16 }}>📷 Take Photo</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={{ paddingVertical: 14 }}
      onPress={() => {
        photoOptionsSheetRef.current?.close();
        handlePhotoCapture('library');
      }}
    >
      <Text style={{ fontSize: 16 }}>🖼️ Choose from Library</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={{ paddingVertical: 14 }}
      onPress={() => photoOptionsSheetRef.current?.close()}
    >
      <Text style={{ fontSize: 16, color: '#999' }}>Cancel</Text>
    </TouchableOpacity>
  </View>
</BottomSheet>

<BottomSheet
  ref={photoPreviewSheetRef}
  index={-1}
  snapPoints={['60%']}
  enablePanDownToClose
  detached={true}
  bottomInset={0}
  style={styles.bottomSheet}
>
  <View style={{ padding: 20 }}>
    <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Photo Proof</Text>

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
      onPress={() => photoPreviewSheetRef.current?.close()}
      style={{ marginTop: 16, padding: 12, alignItems: 'center' }}
    >
      <Text style={{ fontSize: 16, color: '#007AFF' }}>Close</Text>
    </TouchableOpacity>
  </View>
</BottomSheet>




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


