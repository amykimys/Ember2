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
  KeyboardAvoidingView,
  Alert,
  StyleSheet
} from 'react-native';
import { Plus, Check, Menu, X, Camera, CreditCard as Edit2, Repeat, Trash2 } from 'lucide-react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import Modal from 'react-native-modal';
import * as ImagePicker from 'expo-image-picker';
import { Swipeable, GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { Animated } from 'react-native';      // <-- import Animated
import * as Haptics from 'expo-haptics';
import styles from '../../styles/habit.styles';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Calendar } from 'lucide-react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../supabase';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Picker as ReactNativePicker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import CalendarStrip from 'react-native-calendar-strip';
import moment from 'moment';
import 'moment/locale/en-gb';


interface Habit {
  id: string;
  text: string;
  streak: number;
  description?: string;
  completedToday: boolean;
  completedDays: string[];
  color: string;
  requirePhoto: boolean;
  photoProofs: { [date: string]: string };
  targetPerWeek: number;
  reminderTime?: string | null;
  user_id?: string;
}

  
  type WeekDay = 'sun' | 'on' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';


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

 
export default function HabitScreen() {
  const navigation = useNavigation();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabit, setNewHabit] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(HABIT_COLORS[0]);
  const [currentWeek, setCurrentWeek] = useState<Date[]>([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [frequency, setFrequency] = useState(1);
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
  const [selectedTheme, setSelectedTheme] = useState<keyof typeof THEMES>('pastel');
  const [newCategoryColor, setNewCategoryColor] = useState('#E3F2FD');
  const [habitDate, setHabitDate] = useState<Date | null>(null);
  const [showHabitDatePicker, setShowHabitDatePicker] = useState(false);
  const repeatBottomSheetRef = useRef<BottomSheet>(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const photoOptionsSheetRef = useRef<BottomSheet>(null);
  const [expandedStreakId, setExpandedStreakId] = useState<string | null>(null);
  const [isNewHabitModalVisible, setIsNewHabitModalVisible] = useState(false);
  const [isPhotoOptionsModalVisible, setIsPhotoOptionsModalVisible] = useState(false);
  const [isPhotoPreviewModalVisible, setIsPhotoPreviewModalVisible] = useState(false);
  const [isModalTransitioning, setIsModalTransitioning] = useState(false);
  const [selectedHour, setSelectedHour] = useState('12');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedAmPm, setSelectedAmPm] = useState('AM');
  const [currentDate, setCurrentDate] = useState(new Date());
  const calendarStripRef = useRef<any>(null);

  const today = moment();
  const todayStr = today.format('YYYY-MM-DD');
  const isTodaySelected = moment(currentDate).format('YYYY-MM-DD') === todayStr;

  const customDatesStyles = [
    {
      date: todayStr,
      dateNameStyle: {
        color: isTodaySelected ? '#BF9264' : '#BF9264',
        fontWeight: 'bold',
      },
      dateNumberStyle: {
        color: isTodaySelected ? '#BF9264' : '#BF9264',
        fontWeight: 'bold',
      },
    },
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
      console.log('Auth state changed:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          // Fetch user's habits when signed in
          console.log('Fetching habits...');
          const { data: habitsData, error: habitsError } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', session.user.id);
          
          if (habitsError) {
            console.error('Error fetching habits:', habitsError);
            Alert.alert('Error', 'Failed to load habits. Please try again.');
            return;
          }

          if (habitsData) {
            console.log('Habits fetched:', habitsData);
            // Map habits and ensure all fields are properly set
            const mappedHabits = habitsData.map(habit => ({
              ...habit,
              completedDays: habit.completed_days || [],
              photoProofs: habit.photo_proofs || {},
              reminderTime: habit.reminder_time,
              user_id: habit.user_id,
              // Ensure all required fields are present
              streak: habit.streak || 0,
              completedToday: false,
              targetPerWeek: habit.target_per_week || 1,
              requirePhoto: habit.require_photo || false
            }));
            setHabits(mappedHabits);
          }
        } catch (error) {
          console.error('Error in auth state change handler:', error);
          Alert.alert('Error', 'An unexpected error occurred. Please try again.');
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
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start from Sunday
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(today);
    weekEnd.setHours(23, 59, 59, 999);

    const checkmarksThisWeek = habit.completedDays.filter(dateStr => {
      const date = new Date(dateStr);
      return date >= weekStart && date <= weekEnd;
    });

    const count = checkmarksThisWeek.length;
    return `🔥 ${count}`;
  }
  

  const photoPreviewSheetRef = useRef<BottomSheet>(null);

  const resetForm = () => {
  setNewHabit('');
  setNewDescription('');
  setSelectedColor(HABIT_COLORS[0]);
  setNewCategoryColor(HABIT_COLORS[0].value);
  setFrequency(1);
  setRequirePhoto(false);
  setReminderEnabled(false);
  setReminderTime(null);
  setEditingHabit(null);
  setShowEditModal(false);
};


const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

  
  
  const calculateStreak = (habit: Habit, completedDays: string[]): number => {
  const completedSet = new Set(completedDays.map(date => formatDate(new Date(date))));
  const today = new Date();
  let totalCompletions = 0;

  // Start from current week's Sunday
  let currentWeekStart = new Date(today);
  const day = currentWeekStart.getDay(); // 0 = Sun, 6 = Sat
  currentWeekStart.setDate(currentWeekStart.getDate() - day);
  currentWeekStart.setHours(0, 0, 0, 0);

  while (true) {
    // Clone week start and generate dates for this week
    const thisWeekStart = new Date(currentWeekStart);
    const weekDates: string[] = [];

    for (let i = 0; i < 7; i++) {
      const day = new Date(thisWeekStart);
      day.setDate(thisWeekStart.getDate() + i);
      weekDates.push(formatDate(day));
    }

    const completionsThisWeek = weekDates.filter(date => completedSet.has(date)).length;

    if (completionsThisWeek >= habit.targetPerWeek) {
      totalCompletions += completionsThisWeek;
      // Go back 7 days for the next week check (clone before mutation!)
      const prevWeekStart = new Date(currentWeekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      currentWeekStart = prevWeekStart;
    } else {
      break;
    }
  }

  return totalCompletions;
};


  
 
 
  
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
    if (!newHabit.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No user logged in');
      return;
    }

    const newHabitItem: Habit = {
      id: uuidv4(),
      text: newHabit.trim(),
      description: newDescription.trim(),
      streak: 0,
      completedToday: false,
      completedDays: [],
      color: newCategoryColor,
      targetPerWeek: frequency,
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
        target_per_week: newHabitItem.targetPerWeek,
        require_photo: newHabitItem.requirePhoto,
        photo_proofs: newHabitItem.photoProofs,
        user_id: user.id
      });

    if (error) {
      console.error('Error saving habit:', error);
      Alert.alert('Error', 'Failed to save habit. Please try again.');
      return;
    }

    // Update local state
    setHabits(prev => [...prev, newHabitItem]);
    resetForm();
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

  const handleHabitPress = async (habitId: string, date: string) => {
    const normalizedDate = formatDate(new Date(date));
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('No user logged in');
      return;
    }

    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const newCompletedDays = habit.completedDays.includes(normalizedDate)
      ? habit.completedDays.filter(d => d !== normalizedDate)
      : [...habit.completedDays, normalizedDate];

    const newStreak = calculateStreak(habit, newCompletedDays);

    // Update in Supabase first
    const { error } = await supabase
      .from('habits')
      .update({
        completed_days: newCompletedDays,
        streak: newStreak
      })
      .eq('id', habitId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating habit:', error);
      return;
    }

    // Then update local state
    setHabits(habits.map(h => {
      if (h.id === habitId) {
        return {
          ...h,
          completedDays: newCompletedDays,
          streak: newStreak
        };
      }
      return h;
    }));
  };
  

  const handleEditHabit = (habit: Habit) => {
    console.log('Editing habit:', habit);
    setEditingHabit(habit);
    setNewHabit(habit.text);
    setNewDescription(habit.description || '');
    setSelectedColor(HABIT_COLORS.find(c => c.value === habit.color) || HABIT_COLORS[0]);
    setNewCategoryColor(habit.color);
    setRequirePhoto(habit.requirePhoto);
    setReminderTime(habit.reminderTime ? new Date(habit.reminderTime) : null);
    setReminderEnabled(!!habit.reminderTime);
    setFrequency(habit.targetPerWeek);
    setIsNewHabitModalVisible(true);
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
        description: newDescription.trim() || undefined,
        color: newCategoryColor,
        targetPerWeek: frequency,
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
          target_per_week: updatedHabit.targetPerWeek,
          require_photo: updatedHabit.requirePhoto,
          reminder_time: updatedHabit.reminderTime
        })
        .eq('id', updatedHabit.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating habit:', error);
        Alert.alert('Error', 'Failed to update habit. Please try again.');
        return;
      }

      // Update local state
      setHabits(prev => prev.map(h => h.id === editingHabit.id ? updatedHabit : h));
    } else {
      // Add new habit
      const newHabitItem: Habit = {
        id: uuidv4(),
        text: newHabit.trim(),
        description: newDescription.trim() || undefined,
        streak: 0,
        completedToday: false,
        completedDays: [],
        color: newCategoryColor,
        targetPerWeek: frequency,
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
          target_per_week: newHabitItem.targetPerWeek,
          require_photo: newHabitItem.requirePhoto,
          photo_proofs: newHabitItem.photoProofs,
          user_id: user.id
        });

      if (error) {
        console.error('Error saving habit:', error);
        Alert.alert('Error', 'Failed to save habit. Please try again.');
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
    setIsNewHabitModalVisible(false);
  };
  

  const showPhotoProof = (habitId: string, date: string) => {
    const habit = habits.find(h => h.id === habitId);
    const photoUri = habit?.photoProofs[date];
    if (photoUri) {
      setPreviewPhoto(photoUri);
      setIsPhotoPreviewModalVisible(true);
    }
  };
  

  const renderHabitCheckmarks = (habit: Habit) => (
    <View style={styles.checkmarksContainer}>
      {currentWeek.map((date, index) => {
        const dateStr = formatDate(date);
        const isCompleted = habit.completedDays.includes(dateStr) &&
          (!habit.requirePhoto || (habit.requirePhoto && habit.photoProofs[dateStr]));

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
                {isCompleted && (
                  <Ionicons name="checkmark" size={18} color="black" />
                )}
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
    return `🔥 ${calculateStreak(habit, habit.completedDays)}`;
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
    setCurrentWeek(generateWeekDates(newStartDate));
    setCurrentWeekIndex(newIndex);
  };

  // Pan gesture handler
  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX } = event.nativeEvent;
      if (Math.abs(translationX) > 50) {
        if (translationX > 0) {
          navigateWeek('prev');
        } else {
          navigateWeek('next');
        }
      }
    }
  };

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler
        onHandlerStateChange={onHandlerStateChange}
        minDist={10}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => navigateWeek('prev')}
            >
          
            </TouchableOpacity>
          </View>

          {/* Add Calendar Strip Header */}
          <View style={{ paddingHorizontal: 0, marginHorizontal: 0, marginBottom: 5 }}>
            <TouchableOpacity onPress={() => {
              const now = moment();
              setCurrentDate(now.toDate());
              calendarStripRef.current?.setSelectedDate(now);
            }} onLongPress={() => {
              const now = moment();
              setCurrentDate(now.toDate());
                calendarStripRef.current?.setSelectedDate(now);            
                }} delayLongPress={300}>
              <TouchableOpacity onPress={() => {
                const now = moment();
                setCurrentDate(now.toDate());
                  calendarStripRef.current?.setSelectedDate(now);             
                   }}>
                <Text style={{ color: '#000', fontSize: 18, fontWeight: 'bold', marginBottom: -2, textAlign: 'center' }}>
                  {moment(currentDate).format('MMMM YYYY')}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
            <CalendarStrip
              ref={calendarStripRef}
              scrollable
              startingDate={moment().subtract(3, 'days')}
              showMonth
              leftSelector={<View />}
              rightSelector={<View />}
              style={{ height: 100, paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 }}
              calendarColor={'#fff'}
              calendarHeaderStyle={{
                display: 'none'
              }}
              dateNumberStyle={{ color: '#999', fontSize: 15 }}
              dateNameStyle={{ color: '#999' }}
              highlightDateNumberStyle={{
                color: isTodaySelected ? '#BF9264' : '#000',
                fontSize: 30,
              }}
              highlightDateNameStyle={{
                color: isTodaySelected ? '#BF9264' : '#000',
                fontSize: 12.5,
              }}
              selectedDate={moment(currentDate)}
              onDateSelected={(date) => setCurrentDate(date.toDate())}
              customDatesStyles={customDatesStyles}
            />
          </View>

          <ScrollView style={styles.habitList}>
            {habits.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>no habits yet!</Text>
                <Text style={styles.emptyStateSubtitle}>Start building good habits :)</Text>
              </View>
            ) : (
              habits.map((habit) => (
                <Swipeable
                  key={habit.id}
                  onSwipeableOpen={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                    deleteHabit(habit.id);
                  }}
                  friction={1.5}
                  overshootFriction={8}
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
                    onLongPress={() => {
                      console.log('Long press detected on habit:', habit);
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }
                      handleEditHabit(habit);
                    }}
                    delayLongPress={500}
                    activeOpacity={0.9}
                  >
                    <View style={{ position: 'relative' }}>
                      <View
                        style={[
                          styles.habitItem,
                          { backgroundColor: habit.color, position: 'relative' }
                        ]}
                      >
                        <View style={styles.habitHeader}>
                          <TouchableOpacity onPress={() => {
                            setExpandedStreakId(expandedStreakId === habit.id ? null : habit.id);
                          }}>
                            <Text style={styles.streakText}>
                              {expandedStreakId === habit.id
                                ? getTotalHabitCompletions(habit)
                                : getWeeklyProgressStreak(habit)}
                            </Text>
                          </TouchableOpacity>
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
                      onPress={handleReminderPress}
                    >
                      <Ionicons name="time-outline" size={20} color="#666" />
                      <Text style={styles.newOptionText}>
                        {reminderTime ? reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Frequency Section */}
                  <View style={[styles.optionRow, { marginBottom: 20 }]}>
                    <Text style={styles.optionLabel}>Times Per Week</Text>
                    <View style={[styles.frequencyContainer, { 
                      width: 120,
                      height: 40,
                      backgroundColor: '#F5F5F5',
                      borderRadius: 8,
                      overflow: 'hidden'
                    }]}>
                      <ReactNativePicker
                        selectedValue={frequency}
                        onValueChange={(value: number) => setFrequency(value)}
                        style={{ 
                          height: 40,
                          width: '100%',
                          marginTop: -8
                        }}
                        itemStyle={{ 
                          fontSize: 16,
                          height: 40
                        }}
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                          <ReactNativePicker.Item 
                            key={num} 
                            label={`${num}`} 
                            value={num}
                            color="#1a1a1a"
                          />
                        ))}
                      </ReactNativePicker>
                    </View>
                  </View>

                  {/* Simple Time Picker */}
                  <Modal
                    isVisible={showReminderPicker}
                    onBackdropPress={handleReminderCancel}
                    onBackButtonPress={handleReminderCancel}
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
                          }]}>Set Reminder Time</Text>
                          <TouchableOpacity 
                            onPress={handleReminderCancel}
                            disabled={isModalTransitioning}
                          >
                            <Ionicons name="close" size={24} color="#666" />
                          </TouchableOpacity>
                        </View>

                        <View style={{ flex: 1, justifyContent: 'center' }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 30 }}>
                            <TextInput
                              style={{
                                width: 70,
                                height: 50,
                                borderWidth: 1,
                                borderColor: '#ddd',
                                borderRadius: 8,
                                textAlign: 'center',
                                fontSize: 24,
                                marginRight: 8,
                                backgroundColor: '#F5F5F5'
                              }}
                              value={selectedHour}
                              onChangeText={(text) => {
                                const num = parseInt(text);
                                if (!isNaN(num) && num >= 1 && num <= 12) {
                                  setSelectedHour(text);
                                }
                              }}
                              keyboardType="number-pad"
                              maxLength={2}
                            />
                            <Text style={{ fontSize: 32, color: '#1a1a1a', marginHorizontal: 8 }}>:</Text>
                            <TextInput
                              style={{
                                width: 70,
                                height: 50,
                                borderWidth: 1,
                                borderColor: '#ddd',
                                borderRadius: 8,
                                textAlign: 'center',
                                fontSize: 24,
                                marginRight: 8,
                                backgroundColor: '#F5F5F5'
                              }}
                              value={selectedMinute}
                              onChangeText={(text) => {
                                const num = parseInt(text);
                                if (!isNaN(num) && num >= 0 && num <= 59) {
                                  setSelectedMinute(text.padStart(2, '0'));
                                }
                              }}
                              keyboardType="number-pad"
                              maxLength={2}
                            />
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 30 }}>
                            <TouchableOpacity
                              style={{
                                paddingHorizontal: 20,
                                paddingVertical: 12,
                                backgroundColor: selectedAmPm === 'AM' ? '#007AFF' : '#F5F5F5',
                                borderRadius: 8,
                                marginRight: 16
                              }}
                              onPress={() => setSelectedAmPm('AM')}
                            >
                              <Text style={{ 
                                color: selectedAmPm === 'AM' ? 'white' : '#666',
                                fontSize: 18,
                                fontWeight: '600'
                              }}>AM</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{
                                paddingHorizontal: 20,
                                paddingVertical: 12,
                                backgroundColor: selectedAmPm === 'PM' ? '#007AFF' : '#F5F5F5',
                                borderRadius: 8
                              }}
                              onPress={() => setSelectedAmPm('PM')}
                            >
                              <Text style={{ 
                                color: selectedAmPm === 'PM' ? 'white' : '#666',
                                fontSize: 18,
                                fontWeight: '600'
                              }}>PM</Text>
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity
                            style={{
                              backgroundColor: '#007AFF',
                              padding: 16,
                              borderRadius: 12,
                              alignItems: 'center'
                            }}
                            onPress={handleReminderConfirm}
                          >
                            <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>Set Time</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </Modal>

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

        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
}




