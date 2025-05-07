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
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Plus, Check, Menu, X, Camera, CreditCard as Edit2, Repeat, Trash2 } from 'lucide-react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Swipeable, GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import importedStyles from '../../styles/habit.styles';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Calendar } from 'lucide-react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../supabase';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import CalendarStrip from 'react-native-calendar-strip';
import moment from 'moment';
import 'moment/locale/en-gb';

type RepeatOption = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
type WeekDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

type Category = {
  id: string;
  label: string;
  color: string;
};


const REPEAT_OPTIONS = [
  { value: 'none' as const, label: "Don't repeat" },
  { value: 'daily' as const, label: 'Daily' },
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
  { value: 'custom' as const, label: 'Custom' },
];

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
  repeat_type: RepeatOption;
  repeat_end_date: string | null;
  notes: { [date: string]: string };
  photos: { [date: string]: string };
  category_id: string | null;
}

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

const styles = StyleSheet.create({
  ...importedStyles,
  habitContent: {
    padding: 12,
  },
  habitTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  habitFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  habitStreak: {
    fontSize: 14,
    fontWeight: '600',
  },
  habitTarget: {
    fontSize: 14,
    fontWeight: '500',
  },
  rightAction: {
    height: '100%',
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    marginVertical: 0,
    overflow: 'hidden'
  },
  trashIconContainer: {
    padding: 8,
  },
});

export default function HabitScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabit, setNewHabit] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(HABIT_COLORS[0]);
  const [currentWeek, setCurrentWeek] = useState<Date[]>([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [frequencyInput, setFrequencyInput] = useState('');
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
  const newHabitInputRef = useRef<TextInput | null>(null);
  const newDescriptionInputRef = useRef<TextInput | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const modalAnimation = useRef(new Animated.Value(0)).current;
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [selectedRepeat, setSelectedRepeat] = useState<RepeatOption>('none');
  const [repeatEndDate, setRepeatEndDate] = useState<Date | null>(null);
  const [showRepeatEndDatePicker, setShowRepeatEndDatePicker] = useState(false);
  const [customRepeatFrequency, setCustomRepeatFrequency] = useState('1');
  const [customRepeatUnit, setCustomRepeatUnit] = useState<'days' | 'weeks' | 'months'>('days');
  const [selectedWeekDays, setSelectedWeekDays] = useState<WeekDay[]>([]);
  const [showCustomDatesPicker, setShowCustomDatesPicker] = useState(false);
  const [customSelectedDates, setCustomSelectedDates] = useState<string[]>([]);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [showFrequencyInline, setShowFrequencyInline] = useState(false);
  const [showCategoryBox, setShowCategoryBox] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [isNewCategoryModalVisible, setIsNewCategoryModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const categoryInputRef = useRef<TextInput>(null);
  const [progressAnimations] = useState(() => 
    new Map(habits.map(habit => [habit.id, new Animated.Value(0)]))
  );
  const [selectedNoteDate, setSelectedNoteDate] = useState<{ habitId: string; date: string } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isNoteEditMode, setIsNoteEditMode] = useState(false);
  // Add new state for expanded categories
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({});

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
    pastel: ['#FADADD', '#FFE5B4', '#FFFACD', '#D0F0C0', '#B0E0E6', '#D8BFD8', '#F0D9FF', '#C1E1C1'],
    forest: ['#4B6B43', '#7A9D54', '#A7C957', '#DDE26A', '#B49F73', '#856D5D', '#5C4033', '#E4D6A7'],
    dreamscape: ['#E0F7FA', '#E1F5FE', '#D1C4E9', '#F3E5F5', '#F0F4C3', '#D7CCC8', '#C5CAE9', '#E8EAF6'],
    coastal: ['#A7D7C5', '#CFE8E0', '#BFDCE5', '#8AC6D1', '#DCE2C8', '#F1F6F9', '#A2C4C9', '#F7F5E6'],
    autumnglow: ['#FFB347', '#D2691E', '#FFD700', '#B22222', '#CD853F', '#FFA07A', '#8B4513', '#F4A460'],
    cosmicjelly: ['#F15BB5', '#FEE440', '#00BBF9', '#00F5D4', '#FF99C8', '#FCF6BD', '#D0F4DE', '#E4C1F9'],
    bloom: ['#FF69B4', '#FFD700', '#7FFF00', '#FF8C00', '#00CED1', '#BA55D3', '#FFA07A', '#40E0D0'],
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
    setCurrentDate(today);
    // Set initial calendar strip position
    setTimeout(() => {
      if (calendarStripRef.current) {
        calendarStripRef.current.setSelectedDate(moment(today));
      }
    }, 100);
    requestCameraPermissions();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          // Fetch user's categories first
          console.log('Fetching categories for user:', session.user.id);
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
          }

          // Then fetch user's habits
          console.log('Fetching habits for user:', session.user.id);
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
            const mappedHabits = habitsData.map(habit => ({
              ...habit,
              completedDays: habit.completed_days || [],
              photoProofs: habit.photo_proofs || {},
              reminderTime: habit.reminder_time,
              user_id: habit.user_id,
              streak: habit.streak || 0,
              completedToday: false,
              targetPerWeek: habit.target_per_week || 1,
              requirePhoto: habit.require_photo || false,
              repeat_type: habit.repeat_type || 'none',
              repeat_end_date: habit.repeat_end_date || null,
              notes: habit.notes || {},
              photos: habit.photos || {},
              category_id: habit.category_id,
            }));
            console.log('Mapped habits:', mappedHabits);
            setHabits(mappedHabits);
          }
        } catch (error) {
          console.error('Error in auth state change handler:', error);
          Alert.alert('Error', 'An unexpected error occurred. Please try again.');
        }
      } else if (event === 'SIGNED_OUT') {
        // Clear all local state when user signs out
        setHabits([]);
        setCategories([]);
        resetForm();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('Fetching initial data for user:', user.id);
          
          // Fetch categories first
          const { data: categoriesData, error: categoriesError } = await supabase
            .from('categories')
            .select('*')
            .eq('user_id', user.id);

          if (categoriesError) {
            console.error('Error fetching initial categories:', categoriesError);
            return;
          }

          if (categoriesData) {
            console.log('Initial categories fetched:', categoriesData);
            setCategories(categoriesData);
          }

          // Then fetch habits
          const { data: habitsData, error: habitsError } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', user.id);
          
          if (habitsError) {
            console.error('Error fetching initial habits:', habitsError);
            return;
          }

          if (habitsData) {
            console.log('Initial habits fetched:', habitsData);
            const mappedHabits = habitsData.map(habit => ({
              ...habit,
              completedDays: habit.completed_days || [],
              photoProofs: habit.photo_proofs || {},
              reminderTime: habit.reminder_time,
              user_id: habit.user_id,
              streak: habit.streak || 0,
              completedToday: false,
              targetPerWeek: habit.target_per_week || 1,
              requirePhoto: habit.require_photo || false,
              repeat_type: habit.repeat_type || 'none',
              repeat_end_date: habit.repeat_end_date || null,
              notes: habit.notes || {},
              photos: habit.photos || {},
              category_id: habit.category_id,
            }));
            console.log('Initial mapped habits:', mappedHabits);
            setHabits(mappedHabits);
          }
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    habits.forEach(habit => {
      const animation = progressAnimations.get(habit.id);
      if (animation) {
        Animated.timing(animation, {
          toValue: getWeeklyProgressPercentage(habit),
          duration: 300,
          useNativeDriver: false
        }).start();
      }
    });
  }, [habits]);

  async function requestCameraPermissions() {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera permissions to make this work!');
      }
    }
  }

  function getWeeklyProgressPercentage(habit: Habit) {
    const completed = getWeeklyCompletionCount(habit);
    const target = habit.targetPerWeek || 1;
    const percentage = Math.min((completed / target) * 100, 100);
    return percentage;
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
  setFrequencyInput('');
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
      targetPerWeek: parseInt(frequencyInput),
      requirePhoto,
      photoProofs: {},
      repeat_type: selectedRepeat,
      repeat_end_date: repeatEndDate?.toISOString() || null,
      user_id: user.id,
      notes: {},
      photos: {},
      category_id: selectedCategoryId || null
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
        repeat_type: newHabitItem.repeat_type,
        repeat_end_date: newHabitItem.repeat_end_date,
        user_id: user.id,
        category_id: newHabitItem.category_id,
        notes: newHabitItem.notes,
        photos: newHabitItem.photos
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
        // Close modal first for camera
        setIsPhotoOptionsModalVisible(false);
        await new Promise(resolve => setTimeout(resolve, 300)); // Wait for modal to close
        
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: true,
          aspect: [4, 3],
        });
      } else {
        // For library, don't close modal until after picker is done
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: true,
          aspect: [4, 3],
        });
        
        // Close modal after picker is done
        setIsPhotoOptionsModalVisible(false);
      }

      if (!result.canceled && selectedHabitId && selectedDate) {
        const uri = result.assets[0].uri;
        const habit = habits.find(h => h.id === selectedHabitId);
        if (!habit) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('No user logged in');
          return;
        }

        const updatedPhotos = {
          ...habit.photos,
          [selectedDate]: uri
        };

        const updatedCompletedDays = [...habit.completedDays, selectedDate];
        const newStreak = calculateStreak(habit, updatedCompletedDays);

        // Update in Supabase
        const { error } = await supabase
          .from('habits')
          .update({
            photos: updatedPhotos,
            completed_days: updatedCompletedDays,
            streak: newStreak
          })
          .eq('id', selectedHabitId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error saving photo:', error);
          return;
        }

        // Update local state
        setHabits(habits.map(h => {
          if (h.id === selectedHabitId) {
            return {
              ...h,
              photos: updatedPhotos,
              completedDays: updatedCompletedDays,
              streak: newStreak
            };
          }
          return h;
        }));
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

    // If habit requires photo and no photo exists for this date
    if (habit.requirePhoto && !habit.photos[normalizedDate]) {
      setSelectedHabitId(habitId);
      setSelectedDate(normalizedDate);
      setIsPhotoOptionsModalVisible(true);
      return;
    }

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
    setFrequencyInput(habit.targetPerWeek.toString());
    setSelectedRepeat(habit.repeat_type);
    setRepeatEndDate(habit.repeat_end_date ? new Date(habit.repeat_end_date) : null);
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
        targetPerWeek: parseInt(frequencyInput) || 1,
        requirePhoto,
        reminderTime: reminderEnabled ? reminderTime?.toISOString() : null,
        repeat_type: selectedRepeat,
        repeat_end_date: repeatEndDate?.toISOString() || null,
        user_id: user.id,
        category_id: selectedCategoryId || null
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
          reminder_time: updatedHabit.reminderTime,
          repeat_type: updatedHabit.repeat_type,
          repeat_end_date: updatedHabit.repeat_end_date,
          category_id: updatedHabit.category_id,
          notes: updatedHabit.notes,
          photos: updatedHabit.photos
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
        targetPerWeek: parseInt(frequencyInput) || 1,
        requirePhoto,
        photoProofs: {},
        repeat_type: selectedRepeat,
        repeat_end_date: repeatEndDate?.toISOString() || null,
        user_id: user.id,
        notes: {},
        photos: {},
        category_id: selectedCategoryId || null
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
          repeat_type: newHabitItem.repeat_type,
          repeat_end_date: newHabitItem.repeat_end_date,
          user_id: user.id,
          category_id: newHabitItem.category_id,
          notes: newHabitItem.notes,
          photos: newHabitItem.photos
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

  function getWeeklyCompletionCount(habit: Habit) {
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = today.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6
    startOfWeek.setDate(today.getDate() - day); // Start from Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End on Saturday
    endOfWeek.setHours(23, 59, 59, 999);

    const count = habit.completedDays.filter(dateStr => {
      const date = new Date(dateStr);
      return date >= startOfWeek && date <= endOfWeek;
    }).length;

    return count;
  }


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
  const handleReminderPress = () => {
    if (isModalTransitioning) return; // prevent double click
    setIsModalTransitioning(true);
  
    // 1. Close the New Habit Modal first
    setIsNewHabitModalVisible(false);
  
    // 2. After delay, open Reminder Picker
    setTimeout(() => {
      setShowReminderPicker(true);
      setIsModalTransitioning(false);
    }, 300); // wait until the closing animation finishes
  };
  

  const handleReminderConfirm = useCallback(() => {
    const hours = selectedAmPm === 'PM' ? (parseInt(selectedHour) % 12) + 12 : parseInt(selectedHour) % 12;
    const time = new Date();
    time.setHours(hours);
    time.setMinutes(parseInt(selectedMinute));
    setReminderTime(time);
  
    setShowReminderPicker(false);
  
    setTimeout(() => {
      showModal(); // ✅ reopen the New Habit Modal smoothly
    }, 300);
  }, [selectedHour, selectedMinute, selectedAmPm]);
  

  const handleReminderCancel = useCallback(() => {
    setShowReminderPicker(false);
  }, []);

  const showModal = () => {
    setIsNewHabitModalVisible(true);
    requestAnimationFrame(() => {
      Animated.timing(modalAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Focus the title input after animation completes
        setTimeout(() => {
          newHabitInputRef.current?.focus();
        }, 100);
      });
    });
  };

  const hideModal = () => {
    Animated.timing(modalAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsNewHabitModalVisible(false);
    });
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    if (calendarStripRef.current) {
      calendarStripRef.current.setSelectedDate(moment(today));
    }
  };

  const goToNextDay = () => {
    // ... existing code ...
  };

  const handleNotePress = (habitId: string, date: string) => {
    console.log('Note pressed for habit:', habitId, 'date:', date);
    setSelectedNoteDate({ habitId, date });
    setIsNoteEditMode(true);
    const habit = habits.find(h => h.id === habitId);
    if (habit?.notes?.[date]) {
      console.log('Existing note found:', habit.notes[date]);
      setNoteText(habit.notes[date]);
    } else {
      console.log('No existing note');
      setNoteText('');
    }
  };

  const handleNoteLongPress = (habitId: string, date: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelectedNoteDate({ habitId, date });
    setIsNoteEditMode(false);
    const habit = habits.find(h => h.id === habitId);
    if (habit?.notes?.[date]) {
      setNoteText(habit.notes[date]);
    } else {
      setNoteText('');
    }
  };

  const saveNote = async () => {
    if (!selectedNoteDate) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const habit = habits.find(h => h.id === selectedNoteDate.habitId);
    if (!habit) return;

    const updatedNotes = {
      ...habit.notes,
      [selectedNoteDate.date]: noteText
    };

    // Update in Supabase
    const { error } = await supabase
      .from('habits')
      .update({
        notes: updatedNotes
      })
      .eq('id', selectedNoteDate.habitId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error saving note:', error);
      return;
    }

    // Update local state
    setHabits(habits.map(h => {
      if (h.id === selectedNoteDate.habitId) {
        return {
          ...h,
          notes: updatedNotes
        };
      }
      return h;
    }));

    setSelectedNoteDate(null);
    setNoteText('');
  };

  // Add toggle function
  const toggleCategory = (color: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [color]: !prev[color]
    }));
  };

  // Add this function before the return statement
  const handleDeleteCategory = async (categoryId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'You must be logged in to delete categories.');
      return;
    }

    // First update all habits that use this category
    const { error: updateError } = await supabase
      .from('habits')
      .update({ category_id: null })
      .eq('category_id', categoryId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating habits:', updateError);
      Alert.alert('Error', 'Failed to update habits. Please try again.');
      return;
    }

    // Then delete the category
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting category:', deleteError);
      Alert.alert('Error', 'Failed to delete category. Please try again.');
      return;
    }

    // Update local state
    setCategories(prev => prev.filter(cat => cat.id !== categoryId));
    if (selectedCategoryId === categoryId) {
      setSelectedCategoryId('');
    }
  };

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
          <View style={{ paddingHorizontal: -10, marginHorizontal: -18, marginBottom: 2 }}>
            <TouchableOpacity onPress={goToToday}>
              <Text style={{ color: '#000', fontSize: 17, fontWeight: 'bold', marginBottom: 0, textAlign: 'center' }}>
                {moment(currentDate).format('MMMM YYYY')}
              </Text>
            </TouchableOpacity>
            <CalendarStrip
              ref={calendarStripRef}
              scrollable
              startingDate={moment().subtract(30, 'days')}
              showMonth={false}
              leftSelector={<View />}
              rightSelector={<View />}
              style={{ height: 100, paddingTop: 0, paddingBottom: 3, paddingHorizontal: 12 }}
              calendarColor={'#fff'}
              calendarHeaderStyle={{
                display: 'none'
              }}
              dateNumberStyle={{ color: '#999', fontSize: 17 }}
              dateNameStyle={{ color: '#999' }}
              highlightDateNumberStyle={{
                color: isTodaySelected ? '#6F4E37' : '#000',
                fontSize: 34,
              }}
              highlightDateNameStyle={{
                color: isTodaySelected ? '#6F4E37' : '#000',
                fontSize: 13,
              }}
              selectedDate={moment(currentDate)}
              onDateSelected={(date) => setCurrentDate(date.toDate())}
              customDatesStyles={customDatesStyles}
              scrollToOnSetSelectedDate={true}
              useNativeDriver={true}
            />
          </View>

          <ScrollView style={styles.habitList}>
            {habits.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>no habits yet!</Text>
                <Text style={styles.emptyStateSubtitle}>Start building good habits :)</Text>
              </View>
            ) : (
              Object.entries(
                habits.reduce((acc, habit) => {
                  const color = habit.color;
                  if (!acc[color]) {
                    acc[color] = [];
                  }
                  acc[color].push(habit);
                  return acc;
                }, {} as { [key: string]: Habit[] })
              ).map(([color, colorHabits]) => (
                <View key={color}>
                  <TouchableOpacity
                    onPress={() => toggleCategory(color)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 12,
                      paddingHorizontal: 4,
                      marginTop: 16,
                    }}
                  >
                    <Text style={{
                      fontSize: 13,
                      color: '#666',
                      fontWeight: '600',
                      textTransform: 'uppercase'
                    }}>
                      {categories.find(cat => cat.color === color)?.label || 'Uncategorized'}
                    </Text>
                    <Ionicons
                      name={expandedCategories[color] ? "chevron-up" : "chevron-down"}
                      size={16}
                      color="#666"
                    />
                  </TouchableOpacity>
                  {expandedCategories[color] && (
                    colorHabits.map((habit) => (
                      <TouchableOpacity
                        key={habit.id}
                        onLongPress={() => {
                          if (Platform.OS !== 'web') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }
                          handleEditHabit(habit);
                        }}
                        onPress={() => {
                          const today = new Date();
                          const dateStr = formatDate(today);
                          
                          if (habit.requirePhoto && !habit.photos[dateStr]) {
                            setSelectedHabitId(habit.id);
                            setSelectedDate(dateStr);
                            setIsPhotoOptionsModalVisible(true);
                            return;
                          }
                          
                          handleHabitPress(habit.id, dateStr);
                        }}
                        delayLongPress={500}
                        activeOpacity={0.9}
                        style={{
                          backgroundColor: '#F1EFEC',
                          borderRadius: 16,
                          marginVertical: 4,
                          padding: 12,
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <Animated.View
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            bottom: 0,
                            right: 0,
                            backgroundColor: habit.color,
                            opacity: 0.3,
                            width: `${(getWeeklyCompletionCount(habit) / habit.targetPerWeek) * 100}%`
                          }}
                        />
                        <Text style={{
                          fontSize: 15,
                          color: '#1a1a1a',
                          fontWeight: '500',
                          marginBottom: 8
                        }}>
                          {habit.text}
                        </Text>
                        
                        <View style={{
                          flexDirection: 'row',
                          gap: 6,
                          alignItems: 'center'
                        }}>
                          {[
                            { day: 'M', key: 'mon' },
                            { day: 'T', key: 'tue' },
                            { day: 'W', key: 'wed' },
                            { day: 'T', key: 'thu' },
                            { day: 'F', key: 'fri' },
                            { day: 'S', key: 'sat' },
                            { day: 'S', key: 'sun' }
                          ].map(({ day, key }, index) => {
                            const today = new Date();
                            const currentDay = today.getDay();
                            const date = new Date(today);
                            const daysToAdd = (index + 1) - currentDay;
                            date.setDate(today.getDate() + daysToAdd);
                            
                            const dateStr = date.toISOString().split('T')[0];
                            const isCompleted = habit.completedDays.includes(dateStr);
                            const isToday = dateStr === formatDate(today);
                            
                            return (
                              <TouchableOpacity
                                key={key}
                                onPress={() => handleNotePress(habit.id, dateStr)}
                                onLongPress={() => handleNoteLongPress(habit.id, dateStr)}
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: 8,
                                  backgroundColor: isCompleted ? '#6F4E37' : (isToday ? '#F1EFEC' : '#F1EFEC'),
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  borderColor: isToday ? '#6F4E37' : '#6F4E37',
                                }}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                              >
                                <Text style={{
                                  fontSize: 10,
                                  color: isCompleted ? '#FFF8E8' : (isToday ? '#6F4E37' : '#6F4E37'),
                                  fontWeight: '600'
                                }}>
                                  {day}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                          <Text style={{
                            fontSize: 11,
                            color: '#6F4E37',
                            marginLeft: 4,
                            fontWeight: '400'
                          }}>
                            {getWeeklyCompletionCount(habit)}/{habit.targetPerWeek}
                          </Text>
                        </View>
                        {habit.requirePhoto && (
                          <View style={{
                            position: 'absolute',
                            bottom: 8,
                            right: 8,
                            backgroundColor: '#6F4E37',
                            borderRadius: 12,
                            padding: 4
                          }}>
                            <Camera size={14} color="#FFF8E8" />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              ))
            )}
          </ScrollView>

          {/* ADD HABIT BUTTON */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              resetForm();
              showModal();
            }}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>

          {/* New Habit Modal */}
          <Modal
          animationType="none"
          transparent={true}
          visible={isNewHabitModalVisible}
          onRequestClose={handleCloseNewHabitModal}
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
                    handleCloseNewHabitModal();
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
                      height: '35%',
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
                          ref={newHabitInputRef}
                          style={{
                            fontSize: 20,
                            color: '#1a1a1a',
                            padding: 10,
                            backgroundColor: 'white',
                            borderRadius: 12,
                            marginBottom: -10,
                          }}
                          value={newHabit}
                          onChangeText={setNewHabit}
                          placeholder={editingHabit ? "Edit habit..." : "What habit do you want to build?"}
                          placeholderTextColor="#999"
                          returnKeyType="next"
                          onSubmitEditing={() => newDescriptionInputRef.current?.focus()}
                        />

                        {/* Target Frequency Input */}
                        <TextInput
                          value={frequencyInput}
                          onChangeText={setFrequencyInput}
                          keyboardType="numeric"
                          placeholder="Target frequency: pick 1~7"
                          placeholderTextColor="#999"
                          style={{
                            fontSize: 16,
                            color: '#1a1a1a',
                            padding: 10,
                            backgroundColor: 'white',
                            borderRadius: 12,
                            marginTop: 10,
                            minHeight: 10,
                            textAlignVertical: 'top',
                          }}
                        />

                        {/* Description Input */}
                        <TextInput
                          ref={newDescriptionInputRef}
                          style={{
                            fontSize: 16,
                            color: '#1a1a1a',
                            padding: 10,
                            backgroundColor: 'white',
                            borderRadius: 12,
                            marginTop: 0,
                            textAlignVertical: 'top',
                          }}
                          value={newDescription}
                          onChangeText={setNewDescription}
                          placeholder="Add description (optional)"
                          placeholderTextColor="#999"
                          multiline
                        />
                      </ScrollView>
                    </View>

                    {/* Fixed Bottom Section */}
                    <View style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      borderTopColor: '#E0E0E0',
                      paddingTop: 0,
                    }}>
                      {/* Category List */}
                      {showCategoryBox && (
                        <View style={{
                          paddingHorizontal: 10,
                          paddingVertical: 0,
                          borderBottomColor: '#E0E0E0',
                        }}>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 10 }}
                          >
                            {categories.map((cat) => (
                              <TouchableOpacity
                                key={cat.id}
                                onPress={() => setSelectedCategoryId(prev => prev === cat.id ? '' : cat.id)}
                                onLongPress={() => {
                                  if (Platform.OS !== 'web') {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                  }
                                  Alert.alert(
                                    'Delete Category',
                                    `Are you sure you want to delete "${cat.label}"?`,
                                    [
                                      {
                                        text: 'Cancel',
                                        style: 'cancel'
                                      },
                                      {
                                        text: 'Delete',
                                        style: 'destructive',
                                        onPress: () => handleDeleteCategory(cat.id)
                                      }
                                    ]
                                  );
                                }}
                                delayLongPress={500}
                                style={{
                                  paddingVertical: 6,
                                  paddingHorizontal: 10,
                                  borderRadius: 20,
                                  backgroundColor: cat.id === selectedCategoryId ? cat.color : '#F0F0F0',
                                  marginRight: 6,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                }}
                              >
                                <Text
                                  style={{
                                    color: cat.id === selectedCategoryId ? '#fff' : '#333',
                                    fontWeight: '500',
                                    fontSize: 10,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {cat.label}
                                </Text>
                              </TouchableOpacity>
                            ))}

                            {/* ➕ Button */}
                            <TouchableOpacity
                              onPress={() => {
                                setShowCategoryBox(false);
                                setIsNewHabitModalVisible(false);
                                setTimeout(() => {
                                  setIsNewCategoryModalVisible(true);
                                }, 300);
                              }}
                              style={{
                                paddingVertical: 6,
                                paddingHorizontal: 8,
                                borderRadius: 20,
                                backgroundColor: '#F0F0F0',
                                flexDirection: 'row',
                                alignItems: 'center',
                              }}
                            >
                              <Ionicons name="add" size={16} color="#333" />
                            </TouchableOpacity>
                          </ScrollView>
                        </View>
                      )}

                      {/* Quick Action Row */}
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                      }}>
                        {/* Left Section: Color + Reminder + Photo + Repeat */}
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {/* Color Button and Selected Category */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
                            <TouchableOpacity
                              onPress={() => setShowCategoryBox((prev) => !prev)}
                              style={{
                                marginRight: 8,
                              }}
                            >
                              <Ionicons name="color-fill-outline" size={22} color="#666" />
                            </TouchableOpacity>
                            
                            {/* Selected Category Display */}
                            {selectedCategoryId && (
                              <TouchableOpacity
                                onPress={() => setSelectedCategoryId('')}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  backgroundColor: categories.find(cat => cat.id === selectedCategoryId)?.color || '#F0F0F0',
                                  paddingVertical: 4,
                                  paddingHorizontal: 8,
                                  borderRadius: 12,
                                }}
                              >
                                <Text style={{
                                  color: '#333',
                                  fontSize: 12,
                                  fontWeight: '500',
                                  textTransform: 'uppercase',
                                }}>
                                  {categories.find(cat => cat.id === selectedCategoryId)?.label}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>

                          {/* Photo Button */}
                          <TouchableOpacity
                            onPress={() => setRequirePhoto(!requirePhoto)}
                            style={{ marginRight: 16 }}
                          >
                            <Ionicons 
                              name="camera-outline" 
                              size={20} 
                              color={requirePhoto ? '#007AFF' : '#666'} 
                            />
                          </TouchableOpacity>

                          {/* Reminder Button */}
                          <TouchableOpacity 
                            onPress={handleReminderPress}
                            style={{ marginRight: 16 }}
                          >
                            <Ionicons 
                              name="alarm-outline" 
                              size={20} 
                              color={reminderTime ? '#007AFF' : '#666'} 
                            />
                          </TouchableOpacity>
                        </View>

                        {/* Right Section: Send Button */}
                        <TouchableOpacity
                          onPress={handleSave}
                          disabled={!newHabit.trim()}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 15,
                            backgroundColor: newHabit.trim() ? '#007AFF' : '#B0BEC5',
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

          {/* Photo Options Modal */}
          <Modal
            visible={isPhotoOptionsModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={handleClosePhotoOptionsModal}
          >
            <TouchableWithoutFeedback onPress={handleClosePhotoOptionsModal}>
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
                      onPress={() => handlePhotoCapture('camera')}
                    >
                      <Text style={{ fontSize: 16 }}>📷 Take Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ paddingVertical: 14 }}
                      onPress={() => handlePhotoCapture('library')}
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
            </TouchableWithoutFeedback>
          </Modal>

          {/* Photo Preview Modal */}
          <Modal
            visible={isPhotoPreviewModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={handleClosePhotoPreviewModal}
          >
            <TouchableWithoutFeedback onPress={handleClosePhotoPreviewModal}>
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
            </TouchableWithoutFeedback>
          </Modal>

          {/* Reminder Picker Modal */}
          <Modal
            visible={showReminderPicker}
            transparent={true}
            animationType="slide"
            onRequestClose={handleReminderCancel}
          >
            <TouchableWithoutFeedback onPress={handleReminderCancel}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: 'white', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
                  
                  {/* Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <Text style={{ fontSize: 20, fontWeight: '600' }}>Set Reminder Time</Text>
                    <TouchableOpacity onPress={handleReminderCancel}>
                      <Ionicons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>

                  {/* Time Pickers */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                    {/* Hour Picker */}
                    <Picker
                      selectedValue={selectedHour}
                      style={{ flex: 1 }}
                      onValueChange={(value) => setSelectedHour(value)}
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
                      onValueChange={(value) => setSelectedMinute(value)}
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
                      onValueChange={(value) => setSelectedAmPm(value)}
                    >
                      <Picker.Item label="AM" value="AM" />
                      <Picker.Item label="PM" value="PM" />
                    </Picker>
                  </View>

                  {/* Confirm Button */}
                  <TouchableOpacity
                    onPress={() => {
                      const hourNum = parseInt(selectedHour);
                      const minuteNum = parseInt(selectedMinute);
                      const date = new Date();
                      let finalHour = hourNum % 12;
                      if (selectedAmPm === 'PM') finalHour += 12;
                      date.setHours(finalHour);
                      date.setMinutes(minuteNum);
                      date.setSeconds(0);
                      setReminderTime(date);
                      setShowReminderPicker(false);
                    }}
                    style={{
                      backgroundColor: '#007AFF',
                      padding: 16,
                      borderRadius: 12,
                      alignItems: 'center',
                      marginTop: 20,
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Set Reminder</Text>
                  </TouchableOpacity>

                </View>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

      
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
                  setTimeout(() => {
                    setIsNewHabitModalVisible(true); // ✅ Reopen task modal with preserved state
                  }, 300);
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
            {['#BF9264', '#6F826A', '#BBD8A3', '#F0F1C5', '#FFCFCF'].map((color) => {
              const isSelected = newCategoryColor === color;
              return (
                <TouchableOpacity
                  key={color}
                  onPress={() => setNewCategoryColor(color)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: color,
                    marginRight: 12,
                    borderColor: isSelected ? '#000' : 'transparent',
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
          
              setCategories(prev => [...prev, savedCategory]);
              setSelectedCategoryId(savedCategory.id); // ✅ Select the new category
              setNewCategoryName('');
              setIsNewCategoryModalVisible(false); // ✅ Close category modal
          
              setTimeout(() => {
                showModal(); // ✅ Reopen new task modal
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
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
    </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  </Modal>

          {/* Note Modal */}
          <Modal
            visible={!!selectedNoteDate}
            transparent={true}
            animationType="slide"
            onRequestClose={() => {
              setSelectedNoteDate(null);
              setIsNoteEditMode(false);
              setNoteText(''); // Reset note text when closing
            }}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <View style={{ 
                backgroundColor: 'white', 
                padding: 20, 
                borderTopLeftRadius: 20, 
                borderTopRightRadius: 20,
                maxHeight: '80%',
                minHeight: '40%'
              }}>
                <ScrollView style={{ flex: 1 }}>
                  {/* Header */}
                  <View style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: 8 
                  }}>
                    <Text style={{ fontSize: 20, fontWeight: '600' }}>
                      {isNoteEditMode ? 'Add Note' : 'Note'}
                    </Text>
                    <TouchableOpacity onPress={() => {
                      setSelectedNoteDate(null);
                      setIsNoteEditMode(false);
                      setNoteText(''); // Reset note text when closing
                    }}>
                      <Ionicons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>

                  {/* Date */}
                  {selectedNoteDate && (
                    <Text style={{ 
                      fontSize: 14, 
                      color: '#666',
                      marginBottom: 10
                    }}>
                      {new Date(selectedNoteDate.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </Text>
                  )}

                  {/* Photo */}
                  {selectedNoteDate && habits.find(h => h.id === selectedNoteDate.habitId)?.photos[selectedNoteDate.date] && (
                    <View style={{ marginBottom: 12 }}>
                      <Image
                        source={{ uri: habits.find(h => h.id === selectedNoteDate.habitId)?.photos[selectedNoteDate.date] }}
                        style={{
                          width: '100%',
                          height: 200,
                          borderRadius: 12,
                          backgroundColor: 'transparent'
                        }}
                        resizeMode="contain"
                      />
                    </View>
                  )}

                  {/* Note Input/Display */}
                  <View style={{
                    backgroundColor: isNoteEditMode ? '#F5F5F5' : 'transparent',
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 16,
                    minHeight: 120,
                  }}>
                    {isNoteEditMode ? (
                      <TextInput
                        style={{
                          fontSize: 16,
                          color: '#1a1a1a',
                          minHeight: 120,
                          textAlignVertical: 'top'
                        }}
                        value={noteText}
                        onChangeText={setNoteText}
                        placeholder="Add a note for this day..."
                        placeholderTextColor="#999"
                        multiline
                      />
                    ) : (
                      <Text style={{
                        fontSize: 16,
                        color: '#1a1a1a',
                        minHeight: 120,
                      }}>
                        {noteText || 'No note for this day'}
                      </Text>
                    )}
                  </View>

                  {/* Save Button - Only show in edit mode */}
                  {isNoteEditMode && (
                    <TouchableOpacity
                      onPress={saveNote}
                      style={{
                        backgroundColor: '#007AFF',
                        padding: 14,
                        borderRadius: 12,
                        alignItems: 'center',
                        marginBottom: 20
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Save Note</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>

        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
}





