import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Keyboard,
  Dimensions,
  Pressable,
  Animated
} from 'react-native';
import { Plus, Check, Menu, X, Camera, CreditCard as Edit2, Repeat, Trash2 } from 'lucide-react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Swipeable, GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import importedStyles from '../../styles/habit.styles';
import DateTimePicker from '@react-native-community/datetimepicker';
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
import * as FileSystem from 'expo-file-system';
import { decode } from 'base-64';
import { LineChart } from 'react-native-chart-kit';
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  useAnimatedGestureHandler,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { 
  PinchGestureHandler, 
  PanGestureHandler as PanGesture,
  PinchGestureHandlerGestureEvent,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import { TouchableOpacity as TouchableOpacityType } from 'react-native';

type RepeatOption = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
type WeekDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

// Add back the Habit interface
interface Habit {
  id: string;
  text: string;
  streak: number;
  description?: string;
  completedToday: boolean;
  completedDays: string[];
  color: string;  // This is now always a string
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

const REPEAT_OPTIONS = [
  { value: 'none' as const, label: "Don't repeat" },
  { value: 'daily' as const, label: 'Daily' },
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
  { value: 'custom' as const, label: 'Custom' },
];

const HABIT_COLORS = [
  { name: 'Sky', value: '#E3F2FD', text: '#3A3A3A' },
  { name: 'Lavender', value: '#F3E5F5', text: '#3A3A3A' },
  { name: 'Mint', value: '#E8F5E9', text: '#3A3A3A' },
  { name: 'Peach', value: '#FFF3E0', text: '#3A3A3A' },
  { name: 'Rose', value: '#FCE4EC', text: '#3A3A3A' },
  { name: 'Indigo', value: '#E8EAF6', text: '#3A3A3A' },
  { name: 'Cyan', value: '#E0F7FA', text: '#3A3A3A' },
  { name: 'Amber', value: '#FFF8E1', text: '#3A3A3A' },
  { name: 'Deep Purple', value: '#673AB7', text: '#ffffff' },
  { name: 'Teal', value: '#009688', text: '#ffffff' },
  { name: 'Orange', value: '#FF5722', text: '#ffffff' },
  { name: 'Blue Grey', value: '#607D8B', text: '#ffffff' },
];

// Add color mapping for darker shades
const DARKER_COLORS: { [key: string]: string } = {
  '#E3F2FD': '#B0D8F7', // Sky
  '#F3E5F5': '#D8B8E8', // Lavender
  '#E8F5E9': '#B8E8C0', // Mint
  '#FFF3E0': '#FFE0B2', // Peach
  '#FCE4EC': '#F8BBD0', // Rose
  '#E8EAF6': '#C5CAE9', // Indigo
  '#E0F7FA': '#B2EBF2', // Cyan
  '#FFF8E1': '#FFECB3', // Amber
  '#673AB7': '#512DA8', // Deep Purple
  '#009688': '#00796B', // Teal
  '#FF5722': '#E64A19', // Orange
  '#607D8B': '#455A64', // Blue Grey
};

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
    fontFamily: 'Onest',
  },
  habitTarget: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Onest',
  },
  rightAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    height: '100%',
    width: '100%'
  },
  trashIconContainer: {
    padding: 8,
  },
  monthText: {
    fontSize: 14,
    color: '#3A3A3A',
    fontWeight: '700',
    fontFamily: 'Onest',
    marginBottom: -7,
    marginLeft: 2
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3A3A3A',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Onest',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Onest',
  },
});

// Update the Category interface to use string for color
interface Category {
  id: string;
  label: string;
  color: string;  // Change to string since we always provide a default
  user_id: string;
  type: 'habit';
}

// Define CategoryBoxProps type above CategoryBox
type CategoryBoxProps = {
  onSelectCategory: (categoryId: string | null) => void;
  onDeleteCategory: (categoryId: string) => void;
  selectedCategoryId: string | null;
  onClose: () => void;
};

// Remove the handleDeleteCategory function from CategoryBox component
const CategoryBox = ({ onSelectCategory, onDeleteCategory, selectedCategoryId, onClose }: CategoryBoxProps) => {
  // ... rest of the component code ...
  // Remove the handleDeleteCategory function from here
};

// Add these new components before the main component
const ZoomableImage = ({ uri }: { uri: string }) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const savedOffsetX = useSharedValue(0);
  const savedOffsetY = useSharedValue(0);

  type PinchContext = {
    startScale: number;
  };

  type PanContext = {
    startX: number;
    startY: number;
  };

  const pinchHandler = useAnimatedGestureHandler<PinchGestureHandlerGestureEvent, PinchContext>({
    onStart: (_, ctx) => {
      ctx.startScale = scale.value;
    },
    onActive: (event, ctx) => {
      scale.value = interpolate(
        event.scale,
        [0.5, 2],
        [0.5, 2],
        Extrapolate.CLAMP
      ) * ctx.startScale;
    },
    onEnd: () => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
      } else if (scale.value > 2) {
        scale.value = withSpring(2);
      }
      savedScale.value = scale.value;
    },
  });

  const panHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, PanContext>({
    onStart: (_, ctx) => {
      ctx.startX = offsetX.value;
      ctx.startY = offsetY.value;
    },
    onActive: (event, ctx) => {
      if (scale.value > 1) {
        offsetX.value = ctx.startX + event.translationX;
        offsetY.value = ctx.startY + event.translationY;
      }
    },
    onEnd: () => {
      if (scale.value <= 1) {
        offsetX.value = withSpring(0);
        offsetY.value = withSpring(0);
      }
      savedOffsetX.value = offsetX.value;
      savedOffsetY.value = offsetY.value;
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: offsetX.value },
        { translateY: offsetY.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <PinchGestureHandler
      onGestureEvent={pinchHandler}
      onHandlerStateChange={pinchHandler}
    >
      <Animated.View style={{ flex: 1 }}>
        <PanGesture
          onGestureEvent={panHandler}
          onHandlerStateChange={panHandler}
        >
          <Animated.View style={{ flex: 1 }}>
            <Animated.Image
              source={{ uri }}
              style={[
                {
                  width: '100%',
                  height: 300,
                  borderRadius: 12,
                  backgroundColor: '#f0f0f0',
                },
                animatedStyle,
              ]}
              resizeMode="contain"
            />
          </Animated.View>
        </PanGesture>
      </Animated.View>
    </PinchGestureHandler>
  );
};

export default function HabitScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabit, setNewHabit] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(HABIT_COLORS[0]);
  const [currentWeek, setCurrentWeek] = useState<Date[]>([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [frequencyInput, setFrequencyInput] = useState('');
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [newCategoryColor, setNewCategoryColor] = useState<string>('#E3F2FD');  // Keep as string since it's an initial value
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
  const modalAnimation = useRef(new Animated.Value(0)).current;
  const [selectedRepeat, setSelectedRepeat] = useState<RepeatOption>('none');
  const [repeatEndDate, setRepeatEndDate] = useState<Date | null>(null);
  const [showCategoryBox, setShowCategoryBox] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isNewCategoryModalVisible, setIsNewCategoryModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const categoryInputRef = useRef<TextInput>(null);
  const [progressAnimations, setProgressAnimations] = useState(() => new Map());
  const [selectedNoteDate, setSelectedNoteDate] = useState<{ habitId: string; date: string } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isNoteEditMode, setIsNoteEditMode] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isProgressModalVisible, setIsProgressModalVisible] = useState(false);
  const [selectedProgressMonth, setSelectedProgressMonth] = useState(moment());
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const noteInputRef = useRef<TextInput>(null);
  // Add this state near the other state declarations
  const [isSwiping, setIsSwiping] = useState(false);
  // Add new state for progress modal item selection
  const [selectedProgressItem, setSelectedProgressItem] = useState<{ habitId: string; date: string } | null>(null);
  // Add new state to track if we should reopen the progress modal
  const [shouldReopenProgressModal, setShouldReopenProgressModal] = useState(false);
  // Add this state near the other state declarations
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  // Add new state for time picker visibility
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [reminderButtonLayout, setReminderButtonLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const reminderButtonRef = useRef<View>(null);
  const [endDateButtonLayout, setEndDateButtonLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const endDateButtonRef = useRef<View>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Update the useEffect for progress animations
  useEffect(() => {
    // Initialize animations for all habits
    const newAnimations = new Map();
    habits.forEach(habit => {
      newAnimations.set(habit.id, new Animated.Value(getWeeklyProgressPercentage(habit)));
    });
    setProgressAnimations(newAnimations);
  }, [habits.length]); // Only reinitialize when number of habits changes

  // Add a new useEffect to update animations when habits change
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
  }, [habits]); // Update whenever habits change

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
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        try {
          // Fetch user's categories first, only habit categories
          const { data: categoriesData, error: categoriesError } = await supabase
            .from('categories')
            .select('*')
            .eq('user_id', session?.user?.id)
            .eq('type', 'habit');  // Only fetch habit categories

          if (categoriesError) {
            console.error('Error fetching categories:', categoriesError);
            Alert.alert('Error', 'Failed to load categories. Please try again.');
            return;
          }

          if (categoriesData) {
            setCategories(categoriesData);

            // Fetch saved expanded state
            const { data: preferencesData, error: preferencesError } = await supabase
              .from('user_preferences')
              .select('expanded_categories')
              .eq('user_id', session?.user?.id);

            if (preferencesError) {
              console.error('Error fetching preferences:', preferencesError);
              // Initialize all categories as expanded if no saved state
              const initialExpandedState = categoriesData.reduce((acc, cat) => {
                acc[cat.color] = true;
                return acc;
              }, {} as { [key: string]: boolean });
              setExpandedCategories(initialExpandedState);
            } else if (preferencesData && preferencesData.length > 0 && preferencesData[0]?.expanded_categories) {
              // Use saved expanded state
              setExpandedCategories(preferencesData[0].expanded_categories);
            } else {
              // Initialize all categories as expanded if no saved state
              const initialExpandedState = categoriesData.reduce((acc, cat) => {
                acc[cat.color] = true;
                return acc;
              }, {} as { [key: string]: boolean });
              setExpandedCategories(initialExpandedState);
            }
          }

          // Then fetch user's habits
          const { data: habitsData, error: habitsError } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', session?.user?.id);
          
          if (habitsError) {
            console.error('Error fetching habits:', habitsError);
            Alert.alert('Error', 'Failed to load habits. Please try again.');
            return;
          }

          if (habitsData) {
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

    // Set up session refresh listener
    const refreshSubscription = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
      }
    });

    // Initial data fetch
    const fetchInitialData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Fetch categories first, only habit categories
          const { data: categoriesData, error: categoriesError } = await supabase
            .from('categories')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('type', 'habit');  // Only fetch habit categories

          if (categoriesError) {
            console.error('Error fetching initial categories:', categoriesError);
            return;
          }

          if (categoriesData) {
            setCategories(categoriesData);

            // Fetch saved expanded state
            const { data: preferencesData, error: preferencesError } = await supabase
              .from('user_preferences')
              .select('expanded_categories')
              .eq('user_id', session.user.id);

            if (preferencesError) {
              console.error('Error fetching preferences:', preferencesError);
              // Initialize all categories as expanded if no saved state
              const initialExpandedState = categoriesData.reduce((acc, cat) => {
                acc[cat.color] = true;
                return acc;
              }, {} as { [key: string]: boolean });
              setExpandedCategories(initialExpandedState);
            } else if (preferencesData && preferencesData.length > 0 && preferencesData[0]?.expanded_categories) {
              // Use saved expanded state
              setExpandedCategories(preferencesData[0].expanded_categories);
            } else {
              // Initialize all categories as expanded if no saved state
              const initialExpandedState = categoriesData.reduce((acc, cat) => {
                acc[cat.color] = true;
                return acc;
              }, {} as { [key: string]: boolean });
              setExpandedCategories(initialExpandedState);
            }
          }

          // Then fetch habits
          const { data: habitsData, error: habitsError } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', session.user.id);
          
          if (habitsError) {
            console.error('Error fetching initial habits:', habitsError);
            return;
          }

          if (habitsData) {
            const mappedHabits = habitsData.map(habit => {
              // Ensure photos object exists and has valid URLs
              const photos = habit.photos || {};
              const validatedPhotos = Object.entries(photos).reduce((acc, [date, url]) => {
                if (url && typeof url === 'string') {
                  acc[date] = url;
                }
                return acc;
              }, {} as { [key: string]: string });

              return {
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
                photos: validatedPhotos,
                category_id: habit.category_id,
              };
            });
            setHabits(mappedHabits);
          }
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };

    fetchInitialData();

    return () => {
      subscription.unsubscribe();
      refreshSubscription.data.subscription.unsubscribe();
    };
  }, []);

  // Add a periodic data refresh
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        try {
          // Fetch latest categories, only habit categories
          const { data: categoriesData, error: categoriesError } = await supabase
            .from('categories')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('type', 'habit');  // Only fetch habit categories

          if (!categoriesError && categoriesData) {
            setCategories(categoriesData);
          }
        } catch (error) {
          console.error('Error in periodic refresh:', error);
        }
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, []);

  async function requestCameraPermissions() {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera permissions to make this work!');
      }
    }
  }

  // Update the getWeeklyProgressPercentage function to be more precise
  function getWeeklyProgressPercentage(habit: Habit) {
    const completed = getWeeklyCompletionCount(habit);
    const target = habit.targetPerWeek || 1;
    const percentage = Math.min((completed / target) * 100, 100);
    return percentage;
  }

  // Update the getWeeklyCompletionCount function to be more precise
  function getWeeklyCompletionCount(habit: Habit) {
    const today = moment();
    const startOfWeek = moment(today).startOf('isoWeek'); // Use isoWeek to start from Monday
    const endOfWeek = moment(today).endOf('isoWeek'); // Use isoWeek to end on Sunday

    // Convert dates to YYYY-MM-DD format for comparison
    const startDateStr = startOfWeek.format('YYYY-MM-DD');
    const endDateStr = endOfWeek.format('YYYY-MM-DD');

    // Count completed days within the current week
    const count = habit.completedDays.filter(dateStr => {
      return dateStr >= startDateStr && dateStr <= endDateStr;
    }).length;

    return count;
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
    const today = moment();
    let streak = 0;

    // Start from current week's Monday
    let currentWeekStart = moment(today).startOf('isoWeek'); // Use isoWeek to start from Monday

    // Check current week first
    let currentWeekCompletions = 0;
    for (let i = 0; i < 7; i++) {
      const date = moment(currentWeekStart).add(i, 'days');
      const dateStr = date.format('YYYY-MM-DD');
      if (completedSet.has(dateStr)) {
        currentWeekCompletions++;
      }
    }
    
    // If we've met the target in the current week, start counting the streak
    if (currentWeekCompletions >= habit.targetPerWeek) {
      streak = 1;
    } else {
      // If we haven't met the target in the current week, return 0
      return 0;
    }

    // Now check previous weeks
    let previousWeekStart = moment(currentWeekStart).subtract(7, 'days');
    while (true) {
      let weekCompletions = 0;
      for (let i = 0; i < 7; i++) {
        const date = moment(previousWeekStart).add(i, 'days');
        const dateStr = date.format('YYYY-MM-DD');
        if (completedSet.has(dateStr)) {
          weekCompletions++;
        }
      }

      // If we met the target for this week, increment streak
      if (weekCompletions >= habit.targetPerWeek) {
        streak++;
        previousWeekStart.subtract(7, 'days');
      } else {
        // If we didn't meet the target, break the streak
        break;
      }
    }

    return streak;
  };

  const toggleHabitDay = async (habitId: string, date: string) => {
    const normalizedDate = formatDate(new Date(date));
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('No user logged in');
      return;
    }

    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const completedDays = habit.completedDays.includes(normalizedDate)
      ? habit.completedDays.filter(d => d !== normalizedDate)
      : [...habit.completedDays, normalizedDate];

    // Calculate new streak with updated completed days
    const newStreak = calculateStreak(habit, completedDays);

    // Update in Supabase first and wait for the response
    const { error } = await supabase
      .from('habits')
      .update({
        completed_days: completedDays,
        streak: newStreak
      })
      .eq('id', habitId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating habit:', error);
      Alert.alert('Error', 'Failed to update habit. Please try again.');
      return;
    }

    // Only update local state after successful Supabase update
    setHabits(habits.map(h => {
      if (h.id === habitId) {
        return {
          ...h,
          completedDays,
          streak: newStreak,
        };
      }
      return h;
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
        photos: newHabitItem.photos,
        repeat_type: newHabitItem.repeat_type,
        repeat_end_date: newHabitItem.repeat_end_date,
        user_id: user.id,
        category_id: newHabitItem.category_id,
        notes: newHabitItem.notes
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
        setIsPhotoOptionsModalVisible(false);
        await new Promise(resolve => setTimeout(resolve, 300));
        
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
        setIsPhotoOptionsModalVisible(false);
      }

      if (!result.canceled && selectedHabitId) {
        const uri = result.assets[0].uri;
        
        const habit = habits.find(h => h.id === selectedHabitId);
        if (!habit) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('No user logged in');
          return;
        }

        const today = moment().format('YYYY-MM-DD');

        // Create a unique filename with timestamp
        const timestamp = new Date().getTime();
        const filename = `${user.id}/${habit.id}/${today}_${timestamp}.jpg`;

        // Get the file info
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (!fileInfo.exists) {
          Alert.alert('Error', 'Failed to access the selected image. Please try again.');
          return;
        }

        // Read the file as base64
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Convert base64 to Uint8Array
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Upload image to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('habit-photos')
          .upload(filename, bytes, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          Alert.alert('Error', 'Failed to upload photo. Please try again.');
          return;
        }

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('habit-photos')
          .getPublicUrl(filename);

        // Update the habit's photos
        const updatedPhotos = {
          ...habit.photos,
          [today]: publicUrl
        };

        // Update in Supabase
        const { error: updateError } = await supabase
          .from('habits')
          .update({
            photos: updatedPhotos,
            completed_days: [...habit.completedDays, today],
            streak: calculateStreak(habit, [...habit.completedDays, today])
          })
          .eq('id', selectedHabitId)
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Error saving photo:', updateError);
          return;
        }

        // Update local state
        setHabits(habits.map(h => {
          if (h.id === selectedHabitId) {
            return {
              ...h,
              photos: updatedPhotos,
              completedDays: [...h.completedDays, today],
              streak: calculateStreak(h, [...h.completedDays, today])
            };
          }
          return h;
        }));

        // Force re-render of note modal if it's open
        if (selectedNoteDate && selectedNoteDate.habitId === selectedHabitId) {
          setSelectedNoteDate(null);
          setTimeout(() => {
            setSelectedNoteDate({ habitId: selectedHabitId, date: today });
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handleHabitPress = async (habitId: string, date: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        return;
      }

      const today = moment().format('YYYY-MM-DD');
      
      const habit = habits.find(h => h.id === habitId);
      if (!habit) return;

      const isCompleted = habit.completedDays.includes(today);

      // Only show photo modal if the habit requires a photo AND it's not already completed
      if (habit.requirePhoto && !isCompleted && !habit.photos[today]) {
        setSelectedHabitId(habitId);
        setSelectedDate(today);
        setIsPhotoOptionsModalVisible(true);
        return;
      }

      // If the habit is already completed, just toggle it off
      const newCompletedDays = isCompleted
        ? habit.completedDays.filter(d => d !== today)
        : [...habit.completedDays, today];

      // Calculate new streak with updated completed days
      const newStreak = calculateStreak(habit, newCompletedDays);

      // Update in Supabase first and wait for the response
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
        Alert.alert('Error', 'Failed to update habit. Please try again.');
        return;
      }

      // Only update local state after successful Supabase update
      setHabits(prev => prev.map(h => {
        if (h.id === habitId) {
          const updatedHabit = {
            ...h,
            completedDays: newCompletedDays,
            streak: newStreak
          };
          return updatedHabit;
        }
        return h;
      }));

      // Force update of progress animation
      const animation = progressAnimations.get(habitId);
      if (animation) {
        Animated.timing(animation, {
          toValue: getWeeklyProgressPercentage({
            ...habit,
            completedDays: newCompletedDays
          }),
          duration: 300,
          useNativeDriver: false
        }).start();
      }

      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error toggling habit completion:', error);
      Alert.alert('Error', 'Failed to update habit. Please try again.');
    }
  };
  

  const handleEditHabit = (habit: Habit) => {
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
    setSelectedCategoryId(habit.category_id || '');
    showNewHabitModal();
  };
  

  const handleSave = async () => {
    if (!newHabit.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        Alert.alert('Error', 'You must be logged in to save habits.');
        return;
      }

      const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);

      if (editingHabit) {
        // Edit existing habit
        const updatedHabit = {
          ...editingHabit,
          text: newHabit.trim(),
          description: newDescription.trim() || undefined,
          color: selectedCategory?.color || newCategoryColor,  // This is now always a string
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
          color: selectedCategory?.color || newCategoryColor || '#E3F2FD',  // Provide default if null
          targetPerWeek: parseInt(frequencyInput) || 1,
          requirePhoto,
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
            photos: newHabitItem.photos,
            repeat_type: newHabitItem.repeat_type,
            repeat_end_date: newHabitItem.repeat_end_date,
            user_id: user.id,
            category_id: newHabitItem.category_id,
            notes: newHabitItem.notes
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
    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };
  

  const showPhotoProof = (habitId: string, date: string) => {
    const habit = habits.find(h => h.id === habitId);
    const photoUri = habit?.photos[date];
    if (photoUri) {
      setPreviewPhoto(photoUri);
      setIsPhotoPreviewModalVisible(true);
    }
  };

  
  // Add debounce function
  const debounce = (func: () => void, wait: number) => {
    let timeout: NodeJS.Timeout;
    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(), wait);
    };
  };

  // Define modal management functions first
  const showNewHabitModal = useCallback(() => {
    setShowCategoryBox(false);
    setIsNewHabitModalVisible(true);
    requestAnimationFrame(() => {
      Animated.timing(modalAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          newHabitInputRef.current?.focus();
        }, 100);
      });
    });
  }, [modalAnimation, newHabitInputRef]);

  const hideNewHabitModal = useCallback(() => {
    Animated.timing(modalAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsNewHabitModalVisible(false);
    });
  }, [modalAnimation]);

  // Combine reminder handling and modal management
  const handleReminderConfirm = useCallback(() => {
    const hours = selectedAmPm === 'PM' ? (parseInt(selectedHour) % 12) + 12 : parseInt(selectedHour) % 12;
    const time = new Date();
    time.setHours(hours);
    time.setMinutes(parseInt(selectedMinute));
    setReminderTime(time);
    setShowReminderPicker(false);
    
    // Show modal after a short delay
    setTimeout(() => {
      setShowCategoryBox(false);
      setIsNewHabitModalVisible(true);
      requestAnimationFrame(() => {
        Animated.timing(modalAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setTimeout(() => {
            newHabitInputRef.current?.focus();
          }, 100);
        });
      });
    }, 300);
  }, [selectedHour, selectedMinute, selectedAmPm, modalAnimation, newHabitInputRef]);

  // Update handleAddButtonPress to use the new function name
  const handleAddButtonPress = useCallback(() => {
    // Reset form state
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
    setSelectedCategoryId(null);
    setSelectedRepeat('none');
    setRepeatEndDate(null);

    // Show modal using new function name
    showNewHabitModal();
  }, [showNewHabitModal]);

  // Update handleCloseNewHabitModal to use the new function name
  const handleCloseNewHabitModal = useCallback(() => {
    if (isModalTransitioning) return;
    
    setIsModalTransitioning(true);
    hideNewHabitModal();
    setTimeout(() => {
      setIsModalTransitioning(false);
    }, 300);
  }, [isModalTransitioning, hideNewHabitModal]);

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
  

  const handleReminderCancel = useCallback(() => {
    setShowReminderPicker(false);
  }, []);

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    if (calendarStripRef.current) {
      calendarStripRef.current.setSelectedDate(moment(today));
    }
  };


  const handleNotePress = (habitId: string, date: string) => {
    // Convert the input date to the user's local timezone
    const localDate = moment(date).startOf('day');
    const today = moment().startOf('day');
    
    // Only show note modal for today's date
    if (localDate.isSame(today)) {
      setSelectedNoteDate({ habitId, date: localDate.format('YYYY-MM-DD') });
      setIsNoteEditMode(true);
      const habit = habits.find(h => h.id === habitId);
      if (habit?.notes?.[localDate.format('YYYY-MM-DD')]) {
        setNoteText(habit.notes[localDate.format('YYYY-MM-DD')]);
      } else {
        setNoteText('');
      }
    } else {
      // Don't show modal for other dates
      setSelectedNoteDate(null);
      setIsNoteEditMode(false);
      setNoteText('');
    }
  };

  const handleNoteLongPress = (habitId: string, date: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // Convert the input date to the user's local timezone
    const localDate = moment(date).startOf('day');
    setSelectedNoteDate({ habitId, date: localDate.format('YYYY-MM-DD') });
    setIsNoteEditMode(false);
    const habit = habits.find(h => h.id === habitId);
    if (habit?.notes?.[localDate.format('YYYY-MM-DD')]) {
      setNoteText(habit.notes[localDate.format('YYYY-MM-DD')]);
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

    // Ensure we're using the local timezone date
    const localDate = moment(selectedNoteDate.date).startOf('day').format('YYYY-MM-DD');

    const updatedNotes = {
      ...habit.notes,
      [localDate]: noteText
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

  // Add toggle function with persistence
  const toggleCategory = async (color: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newExpandedState = {
      ...expandedCategories,
      [color]: !expandedCategories[color]
    };
    setExpandedCategories(newExpandedState);

    try {
      // First try to insert
      const { error: insertError } = await supabase
        .from('user_preferences')
        .insert({
          user_id: user.id,
          expanded_categories: newExpandedState
        });

      // If insert fails (likely because row exists), try update
      if (insertError) {
        const { error: updateError } = await supabase
          .from('user_preferences')
          .update({
            expanded_categories: newExpandedState
          })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Error updating expanded state:', updateError);
        }
      }
    } catch (error) {
      console.error('Error saving expanded state:', error);
    }
  };

  // Add this function before the return statement
  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to delete categories.');
        return;
      }

      // First, get all habits that use this category
      const { data: habitsToUpdate, error: fetchError } = await supabase
        .from('habits')
        .select('id')
        .eq('category_id', categoryId)
        .eq('user_id', user.id);

      if (fetchError) {
        console.error('Error fetching habits to update:', fetchError);
        Alert.alert('Error', 'Failed to fetch habits. Please try again.');
        return;
      }

      // Update all habits that use this category
      if (habitsToUpdate && habitsToUpdate.length > 0) {
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
      }

      // Then delete the category, ensuring it's a habit category
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)
        .eq('type', 'habit')  // Ensure we only delete habit categories
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Error deleting category:', deleteError);
        Alert.alert('Error', 'Failed to delete category. Please try again.');
        return;
      }

      // Update local state for categories
      setCategories(prev => prev.filter(cat => cat.id !== categoryId));
      
      // Update local state for habits
      setHabits(prev => prev.map(habit => {
        if (habit.category_id === categoryId) {
          return { ...habit, category_id: null };
        }
        return habit;
      }));

      // Clear selected category if it was the deleted one
      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId(null);
      }

      // Update expanded categories state
      const category = categories.find(cat => cat.id === categoryId);
      if (category) {
        setExpandedCategories(prev => {
          const newState = { ...prev };
          delete newState[category.color];
          return newState;
        });
      }

      // Show success message
      Alert.alert('Success', 'Category deleted successfully');

    } catch (error) {
      console.error('Error in category deletion:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Add bucket verification
  useEffect(() => {
    const verifyBucketSetup = async () => {
      try {
        // First check authentication
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Error getting session:', sessionError);
          return;
        }

        if (!session) {
          console.error('No active session found');
          return;
        }

        // Try to list contents of the bucket directly
        const { data: files, error: listError } = await supabase
          .storage
          .from('habit-photos')
          .list();

        if (listError) {
          console.error('Error listing bucket contents:', listError);
          console.error('Error details:', {
            message: listError.message,
            name: listError.name
          });
        } else {
        }

      } catch (error) {
        console.error('Error verifying bucket setup:', error);
      }
    };

    verifyBucketSetup();
  }, []);

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


  // Add function to handle progress modal
  const handleProgressPress = () => {
    setIsProgressModalVisible(true);
    setSelectedProgressMonth(moment()); // Reset to current month
    // Add a longer delay to ensure the modal is fully rendered
    setTimeout(centerTodayColumn, 500);
  };

  // Add function to get dates for the current month
  const getMonthDates = () => {
    const daysInMonth = selectedProgressMonth.daysInMonth();
    return Array.from({ length: daysInMonth }, (_, i) => 
      selectedProgressMonth.startOf('month').add(i, 'days').format('YYYY-MM-DD')
    );
  };

  // Add function to navigate months in progress view
  const navigateProgressMonth = (direction: 'prev' | 'next') => {
    setSelectedProgressMonth(prev => direction === 'prev' 
      ? moment(prev).subtract(1, 'month')
      : moment(prev).add(1, 'month')
    );
  };

  // Add function to center today's column
  const centerTodayColumn = () => {
    const today = moment();
    const daysInMonth = today.daysInMonth();
    const todayDate = today.date();
    const cellWidth = 36; // Width of each cell
    const screenWidth = Dimensions.get('window').width;
    
    // Calculate the position of today's column
    const todayPosition = (todayDate - 1) * cellWidth;
    
    // Calculate the offset needed to center today's column
    // Add a larger offset to move everything more to the right
    const offset = todayPosition - (screenWidth / 2) + (cellWidth / 2) -30;
    
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: Math.max(0, offset),
        animated: false
      });
    }
  };

  // Add scroll handler
  const handleScroll = (event: any) => {
    setScrollPosition(event.nativeEvent.contentOffset.x);
  };

  // Add function to handle progress item press
  const handleProgressItemPress = (habitId: string, date: string) => {
    const habit = habits.find(h => h.id === habitId);
    if (habit?.notes?.[date] || habit?.photos?.[date]) {
      setSelectedNoteDate({ habitId, date });
      setIsNoteEditMode(false);
      setNoteText(habit.notes?.[date] || '');
      setShouldReopenProgressModal(true); // Set flag to reopen progress modal
      setIsProgressModalVisible(false);
    }
  };

  // Update the note modal close handler
  const handleNoteModalClose = () => {
    setSelectedNoteDate(null);
    setIsNoteEditMode(false);
    setNoteText('');
    // If we should reopen the progress modal, do so after a short delay
    if (shouldReopenProgressModal) {
      setTimeout(() => {
        setIsProgressModalVisible(true);
        setShouldReopenProgressModal(false);
        // Add a longer delay to ensure the modal is fully rendered before centering
        setTimeout(centerTodayColumn, 500);
      }, 300); // Wait for note modal animation to complete
    }
  };

  const fetchCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'habit'); // Only fetch habit categories

      if (error) {
        console.error('Error fetching categories:', error);
        return;
      }

      if (data) {
        setCategories(data);
      }
    } catch (error) {
      console.error('Error in fetchCategories:', error);
    }
  };

  // Update category creation
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to create categories.');
        return;
      }

      const { data, error } = await supabase
        .from('categories')
        .insert([
          {
            label: newCategoryName.trim(),
            color: newCategoryColor || '#E3F2FD',  // Provide default if null
            user_id: user.id,
            type: 'habit'  // Explicitly set type to 'habit'
          }
        ])
        .select();

      if (error) {
        console.error('Error creating category:', error);
        Alert.alert('Error', 'Failed to create category. Please try again.');
        return;
      }

      if (data) {
        setCategories(prev => [...prev, data[0]]);
        setSelectedCategoryId(data[0].id);
        setNewCategoryName('');
        setNewCategoryColor('#E3F2FD');  // Reset to default color
        setIsNewCategoryModalVisible(false);
      }
    } catch (error) {
      console.error('Error in handleCreateCategory:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  // Fix implicit any types
  const getHabitStatusForDate = (habit: Habit, dateStr: string): 'completed' | 'missed' | 'pending' => {
    // Example logic: return 'completed' if dateStr is in completedDays, otherwise 'pending'
    if (habit.completedDays.includes(dateStr)) return 'completed';
    return 'pending';
  };

  const getHabitStatusForWeek = (habit: Habit, weekStart: Date): ('completed' | 'missed' | 'pending')[] => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return getHabitStatusForDate(habit, d.toISOString().split('T')[0]);
    });
  };

  const getHabitStatusForMonth = (habit: Habit, monthStart: Date): ('completed' | 'missed' | 'pending')[] => {
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(monthStart);
      d.setDate(d.getDate() + i);
      return getHabitStatusForDate(habit, d.toISOString().split('T')[0]);
    });
  };

  // Add darkenColor function
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-20, 20]}
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
          <View style={{ paddingHorizontal: 0, marginHorizontal: -18, marginBottom: -10 }}>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'center', 
              paddingHorizontal: 24,
              position: 'relative'
            }}>
              <TouchableOpacity 
                onPress={handleProgressPress}
                style={{ 
                  position: 'absolute',
                  left: 42
                }}
              >
                <MaterialIcons name="stacked-line-chart" size={20} color="#3A3A3A" />
              </TouchableOpacity>
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
              ref={calendarStripRef}
              scrollable
              startingDate={moment().subtract(30, 'days')}
              showMonth={false}
              leftSelector={<View />}
              rightSelector={<View />}
              style={{ height: 100, paddingTop: 0, paddingBottom: 3, paddingHorizontal: 24 }}
              calendarColor={'#fff'}
              calendarHeaderStyle={{
                display: 'none'
              }}
              dateNumberStyle={{ color: '#888888', fontSize: 17, fontFamily: 'Onest' }}
              dateNameStyle={{ color: '#888888', fontFamily: 'Onest' }}
              highlightDateNumberStyle={{
                color: moment().isSame(moment(currentDate), 'day') ? '#A0C3B2' : '#3A3A3A',
                fontSize: 34,
                fontFamily: 'Onest'
              }}
              highlightDateNameStyle={{
                color: moment().isSame(moment(currentDate), 'day') ? '#A0C3B2' : '#3A3A3A',
                fontSize: 13,
                fontFamily: 'Onest'
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
              scrollToOnSetSelectedDate={true}
              useNativeDriver={true}
            />
          </View>

          <ScrollView style={styles.habitList}>
            {habits.length === 0 ? (
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
                }]}>no habits yet!</Text>
                <Text style={[styles.emptyStateSubtitle, { 
                  textAlign: 'center',
                  width: '100%'
                }]}>Start building good habits :)</Text>
              </View>
            ) : (
              Object.entries(
                habits.reduce((acc, habit) => {
                  const categoryId = habit.category_id || 'uncategorized';
                  if (!acc[categoryId]) {
                    acc[categoryId] = [];
                  }
                  acc[categoryId].push(habit);
                  return acc;
                }, {} as { [key: string]: Habit[] })
              ).map(([categoryId, categoryHabits]) => {
                const category = categories.find(cat => cat.id === categoryId);
                const color = category?.color || '#E3F2FD';
                return (
                  <View key={categoryId} style={{ marginBottom: 10 }}>
                    <TouchableOpacity
                      onPress={() => toggleCategory(color)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 4,
                        paddingHorizontal: 6,
                        marginTop: 4,
                      }}
                    >
                      <Text style={{
                        fontSize: 13,
                        color: '#3A3A3A',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        fontFamily: 'Onest'
                      }}>
                        {category?.label || 'Uncategorized'}
                      </Text>
\                      <Ionicons
                        name={expandedCategories[color] ? "chevron-down" : "chevron-up"}
                        size={16}
                        color="#666"
                      />
                    </TouchableOpacity>
                    {expandedCategories[color] && (
                      categoryHabits.map((habit) => (
                  
                        <Swipeable
                          key={habit.id}
                          renderRightActions={() => (
                            <TouchableOpacity
                              style={[styles.rightAction, {
                                backgroundColor: `${darkenColor(habit.color, 0.2)}90`, // Added 80 for 50% opacity
                              }]}
                              onPress={() => {
                                if (Platform.OS !== 'web') {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                }
                                Alert.alert(
                                  'Delete Habit',
                                  `Are you sure you want to delete "${habit.text}"?`,
                                  [
                                    {
                                      text: 'Cancel',
                                      style: 'cancel'
                                    },
                                    {
                                      text: 'Delete',
                                      style: 'destructive',
                                      onPress: () => deleteHabit(habit.id)
                                    }
                                  ]
                                );
                              }}
                            >
                              <View style={styles.trashIconContainer}>
                                <Trash2 size={24} color="#FFF8E8" />
                              </View>
                            </TouchableOpacity>
                          )}
                          containerStyle={{
                            marginVertical: 4,
                            borderRadius: 16,
                            overflow: 'hidden'
                          }}
                        >
                          <View style={{
                            backgroundColor: '#F9F8F7',
                            borderRadius: 16,
                            overflow: 'hidden',
                            width: '100%'
                          }}>
                            <View style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              bottom: 0,
                              width: getWeeklyCompletionCount(habit) >= habit.targetPerWeek ? '100%' : `${getWeeklyProgressPercentage(habit)}%`,
                              backgroundColor: habit.color,
                              opacity: 0.2,
                            }} />
                            <TouchableOpacity
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
                                padding: 14,
                                paddingBottom: 12,
                                position: 'relative',
                                zIndex: 1
                              }}
                            >
                              <View style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 4
                              }}>
                                <Text style={{
                                  fontSize: 15,
                                  color: '#3A3A3A',
                                  fontWeight: '500',
                                  fontFamily: 'Onest'
                                }}>
                                  {habit.text}
                                </Text>
                                <View style={{
                                  flexDirection: 'row',
                                  alignItems: 'center'
                                }}>
                                  <Ionicons name="flash-outline" size={12} color="#3A3A3A" style={{ marginRight: 2 }} />
                                  <Text style={{
                                    fontSize: 11,
                                    color: '#3A3A3A',
                                    fontWeight: '600',
                                    fontFamily: 'Onest'
                                  }}>
                                    {calculateStreak(habit, habit.completedDays)}
                                  </Text>
                                </View>
                              </View>
                              <View style={{
                                flexDirection: 'row',
                                gap: 8,
                                alignItems: 'center',
                                paddingTop: 3
                              }}>
                                {[
                                  { day: 'M', key: 'mon', weekday: 1 },
                                  { day: 'T', key: 'tue', weekday: 2 },
                                  { day: 'W', key: 'wed', weekday: 3 },
                                  { day: 'T', key: 'thu', weekday: 4 },
                                  { day: 'F', key: 'fri', weekday: 5 },
                                  { day: 'S', key: 'sat', weekday: 6 },
                                  { day: 'S', key: 'sun', weekday: 0 }
                                ].map(({ day, key, weekday }, index) => {
                                  // Get the start of the current week (Monday) in local timezone
                                  const today = moment().startOf('day');
                                  // Set Monday as the start of the week
                                  const startOfWeek = moment().startOf('isoWeek'); // This sets Monday as start of week
                                  
                                  // Calculate the date for this weekday
                                  const date = moment(startOfWeek).add(weekday === 0 ? 6 : weekday - 1, 'days');
                                  
                                  const dateStr = date.format('YYYY-MM-DD');
                                  const isCompleted = habit.completedDays.includes(dateStr);
                                  const isToday = date.isSame(today, 'day');
                                  
                                  return (
                                    <TouchableOpacity
                                      key={key}
                                      onPress={() => handleNotePress(habit.id, dateStr)}
                                      onLongPress={() => handleNoteLongPress(habit.id, dateStr)}
                                      style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: 9,
                                        backgroundColor: isCompleted ? '#F2C6B4' : 'transparent',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        borderColor: 'transparent',
                                        borderWidth: 0,
                                        marginLeft: -2,
                                      }}
                                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                      <Text style={{
                                        fontSize: 12,
                                        color: isCompleted ? '#FFF8E8' : '#3A3A3A',
                                        fontWeight: isToday ? '700' : '500',
                                        fontFamily: 'Onest'
                                      }}>
                                        {day}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                                <Text style={{
                                  fontSize: 11,
                                  color: '#888888',
                                  marginLeft: 4,
                                  fontWeight: '400',
                                  fontFamily: 'Onest'
                                }}>
                                  {getWeeklyCompletionCount(habit)}/{habit.targetPerWeek}
                                </Text>
                                {habit.requirePhoto && (
                                  <View style={{
                                    marginLeft: 'auto',
                                    paddingTop: 3
                                  }}>
                                    <Camera size={13} color="#3A3A3A" />
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          </View>
                        </Swipeable>
                      ))
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* ADD HABIT BUTTON */}
          <TouchableOpacity
            style={[styles.addButton, { opacity: isModalTransitioning ? 0.5 : 1 }]}
            onPress={handleAddButtonPress}
            disabled={isModalTransitioning}
          >
            <Ionicons name="add" size={22} color="white" />
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
              keyboardVerticalOffset={0}
            >
              <TouchableWithoutFeedback
                onPress={(e) => {
                  if (e.target === e.currentTarget) {
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
                      height: '45%',
                      width: '100%',
                      transform: [{
                        translateY: modalAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1000, 0]
                        })
                      }]
                    }}
                  >
                  <View style={{ flexGrow: 1 }}>
                      <ScrollView
                        style={{ flex: 1 }}
                        keyboardShouldPersistTaps="always"
                        keyboardDismissMode="none"
                        contentContainerStyle={{ paddingBottom: 160 }}
                      >
                        {/* Title Input */}
                        <TextInput
                          ref={newHabitInputRef}
                          style={{
                            fontSize: 20,
                            color: '#3A3A3A',
                            padding: 10,
                            backgroundColor: 'white',
                            borderRadius: 12,
                            marginBottom: -10,
                            fontFamily: 'Onest'
                          }}
                          value={newHabit}
                          onChangeText={setNewHabit}
                          placeholder={editingHabit ? "Edit habit..." : "What habit do you want to build?"}
                          placeholderTextColor="#999"
                          returnKeyType="next"
                          onSubmitEditing={() => newDescriptionInputRef.current?.focus()}
                          autoFocus={true}
                        />

                        {/* Target Frequency Input */}
                        <TextInput
                          value={frequencyInput}
                          onChangeText={setFrequencyInput}
                          keyboardType="numeric"
                          placeholder="Goal per week: pick 1-7"
                          placeholderTextColor="#999"
                          style={{
                            fontSize: 16,
                            color: '#3A3A3A',
                            padding: 10,
                            backgroundColor: 'white',
                            borderRadius: 12,
                            marginTop: 10,
                            minHeight: 10,
                            textAlignVertical: 'top',
                            fontFamily: 'Onest'
                          }}
                        />

                        {/* Description Input */}
                        <TextInput
                          ref={newDescriptionInputRef}
                          style={{
                            fontSize: 16,
                            color: '#3A3A3A',
                            padding: 10,
                            backgroundColor: 'white',
                            borderRadius: 12,
                            marginTop: 0,
                            textAlignVertical: 'top',
                            fontFamily: 'Onest'
                          }}
                          value={newDescription}
                          onChangeText={setNewDescription}
                          placeholder="Description (optional)"
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
                                .filter(cat => cat.label.toLowerCase() !== 'habit')
                                .map((cat) => (
                                  <Pressable
                                    key={cat.id}
                                    onPress={() => {
                                      setSelectedCategoryId(prev => prev === cat.id ? '' : cat.id);
                                      setShowCategoryBox(false);
                                      setTimeout(() => {
                                        newHabitInputRef.current?.focus();
                                      }, 0);
                                    }}
                                    onLongPress={() => {
                                      if (Platform.OS !== 'web') {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                      }
                                      Alert.alert(
                                        'Delete Category',
                                        `Are you sure you want to delete "${cat.label}"?`,
                                        [
                                          { text: 'Cancel', style: 'cancel' },
                                          {
                                            text: 'Delete',
                                            style: 'destructive',
                                            onPress: () => handleDeleteCategory(cat.id),
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
                                        onPress={handleCreateCategory}
                                        style={{
                                          opacity: newCategoryName.trim() ? 1 : 0.5,
                                          padding: 4,
                                        }}
                                        activeOpacity={0.7}
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
                                      borderWidth: newCategoryColor === color ? 2 : 0,
                                      borderColor: '#666',
                                    }}
                                  />
                                ))}
                              </ScrollView>
                            </View>
                          )}
                        </View>
                      )}

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

                          {/* Reminder Button */}
                          <TouchableOpacity
                            ref={reminderButtonRef}
                            onPress={() => {
                              reminderButtonRef.current?.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
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
                              name="alarm-outline" 
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

                          {/* Photo Button */}
                          <TouchableOpacity
                            onPress={() => setRequirePhoto(!requirePhoto)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: requirePhoto ? '#FFF9E6' : 'transparent',
                              paddingHorizontal: 8,
                              paddingVertical: 5,
                              borderRadius: 8,
                              marginRight: requirePhoto ? 10 : 0,
                            }}
                          >
                            <Ionicons 
                              name="camera-outline" 
                              size={17} 
                              color={requirePhoto ? '#FF9500' : '#666'} 
                            />
                            {requirePhoto && (
                              <Text style={{ 
                                marginLeft: 3,
                                fontSize: 12,
                                color: '#FF9500',
                                fontFamily: 'Onest',
                                fontWeight: '500'
                              }}>
                                Photo
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
                            onPress={handleSave}
                            disabled={!newHabit.trim()}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 15,
                              backgroundColor: newHabit.trim() ? '#FF6B6B' : '#ECE7E1',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Ionicons name="arrow-up" size={18} color="#fff" />
                          </TouchableOpacity>
                        </View>
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
                  height: '23%',
                  width: '100%'
                }]}>
                  <View style={[styles.modalHeader, {
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 0,
                    paddingBottom: 10,
                  }]}>
                    <Text style={[styles.modalTitle, {
                      fontSize: 24,
                      fontWeight: 'bold',
                      color: '#1a1a1a'
                    }]}>Photo Proof</Text>
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
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="camera-outline" size={16} color="#000" style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 15 }}>Take Photo</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ paddingVertical: 14 }}
                      onPress={() => handlePhotoCapture('library')}
                    >
\                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="images-outline" size={16} color="#000" style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 15 }}>Choose from Library</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ paddingVertical: 14 }}
                      onPress={handleClosePhotoOptionsModal}
                    >
\                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, color: '#999' }}>Cancel</Text>
                      </View>
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
                      <View style={{ flex: 1, overflow: 'hidden' }}>
                        <ZoomableImage uri={previewPhoto} />
                      </View>
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

          {/* Note Modal */}
          <Modal
            visible={!!selectedNoteDate}
            transparent={true}
            animationType="slide"
            onRequestClose={handleNoteModalClose}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
              keyboardVerticalOffset={0}
              enabled={true}
            >
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                {isNoteEditMode ? (
                  <View style={{ 
                    backgroundColor: 'white', 
                    padding: 20, 
                    borderTopLeftRadius: 20, 
                    borderTopRightRadius: 20,
                    maxHeight: '90%',
                    minHeight: '60%',
                    marginBottom: 0,
                  }}>
                    <ScrollView 
                      style={{ flex: 1 }}
                      contentContainerStyle={{ paddingBottom: 100 }}
                      keyboardShouldPersistTaps="always"
                      keyboardDismissMode="none"
                    >
                      {/* Header */}
                      <View style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        marginBottom: 8 
                      }}>
                        <Text style={{ fontSize: 20, fontWeight: '600', fontFamily: 'Onest' }}>
                          Add Note
                        </Text>
                        <TouchableOpacity onPress={handleNoteModalClose}>
                          <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                      </View>

                      {/* Date */}
                      {selectedNoteDate && (
                        <Text style={{ 
                          fontSize: 14, 
                          color: '#666',
                          marginBottom: 20,
                          fontFamily: 'Onest'
                        }}>
                          {moment(selectedNoteDate.date).format('dddd, MMMM D, YYYY')}
                        </Text>
                      )}

                      {/* Note Input */}
                      {/* Photo section if photo exists */}
                      {selectedNoteDate && habits.find(h => h.id === selectedNoteDate.habitId)?.photos?.[selectedNoteDate.date] && (
                        <View style={{ marginBottom: 16, position: 'relative' }}>
                          <Image
                            source={{ uri: habits.find(h => h.id === selectedNoteDate.habitId)?.photos?.[selectedNoteDate.date] }}
                            style={{
                              width: '100%',
                              aspectRatio: 4/3,
                              borderRadius: 12,
                            }}
                            resizeMode="contain"
                          />
                          <TouchableOpacity
                            onPress={async () => {
                              if (!selectedNoteDate) return;
                              
                              const { data: { user } } = await supabase.auth.getUser();
                              if (!user) return;

                              const habit = habits.find(h => h.id === selectedNoteDate.habitId);
                              if (!habit) return;

                              // Create a new photos object without the current date's photo
                              const updatedPhotos = { ...habit.photos };
                              delete updatedPhotos[selectedNoteDate.date];

                              // Update in Supabase
                              const { error } = await supabase
                                .from('habits')
                                .update({
                                  photos: updatedPhotos
                                })
                                .eq('id', selectedNoteDate.habitId)
                                .eq('user_id', user.id);

                              if (error) {
                                console.error('Error deleting photo:', error);
                                return;
                              }

                              // Update local state
                              setHabits(habits.map(h => {
                                if (h.id === selectedNoteDate.habitId) {
                                  return {
                                    ...h,
                                    photos: updatedPhotos
                                  };
                                }
                                return h;
                              }));

                              // Provide haptic feedback
                              if (Platform.OS !== 'web') {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              }
                            }}
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              backgroundColor: 'rgba(0, 0, 0, 0.5)',
                              borderRadius: 20,
                              padding: 8,
                            }}
                          >
                            <Ionicons name="trash-outline" size={20} color="white" />
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Text Input with gray background */}
                      <View style={{
                        backgroundColor: '#F5F5F5',
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 8,
                        minHeight: 120,
                      }}>
                        <TextInput
                          ref={noteInputRef}
                          style={{
                            fontSize: 16,
                            color: '#3A3A3A',
                            minHeight: 145,
                            textAlignVertical: 'top',
                            fontFamily: 'Onest'
                          }}
                          value={noteText}
                          onChangeText={setNoteText}
                          placeholder="Add a note for this day..."
                          placeholderTextColor="#999"
                          multiline
                          autoFocus={true}
                          keyboardType="default"
                          returnKeyType="default"
                          blurOnSubmit={false}
                          onBlur={() => {
                            // Prevent keyboard from dismissing
                            if (isNoteEditMode) {
                              setTimeout(() => {
                                noteInputRef.current?.focus();
                              }, 0);
                            }
                          }}
                        />
                      </View>
                    </ScrollView>

                    {/* Save Button */}
                    <TouchableOpacity
                      onPress={() => {
                        saveNote();
                        Keyboard.dismiss();
                      }}
                      style={{
                        backgroundColor: '#FF9A8B',
                        padding: 14,
                        borderRadius: 12,
                        alignItems: 'center',
                        marginTop: 'auto',
                        marginBottom: 0,
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', fontFamily: 'Onest' }}>Save Note</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // View note mode
                  <View style={{ 
                    backgroundColor: 'white', 
                    padding: 20, 
                    borderTopLeftRadius: 20, 
                    borderTopRightRadius: 20,
                    maxHeight: '90%',
                    minHeight: selectedNoteDate && habits.find(h => h.id === selectedNoteDate.habitId)?.photos?.[selectedNoteDate.date] ? '60%' : '35%',
                    marginBottom: 0,
                  }}>
                    {/* Header */}
                    <View style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      marginBottom: 8 
                    }}>
                      <Text style={{ fontSize: 20, fontWeight: '600', fontFamily: 'Onest' }}>
                        Note
                      </Text>
                      <TouchableOpacity onPress={handleNoteModalClose}>
                        <Ionicons name="close" size={24} color="#666" />
                      </TouchableOpacity>
                    </View>

                    {/* Date */}
                    {selectedNoteDate && (
                      <Text style={{ 
                        fontSize: 14, 
                        color: '#666',
                        marginBottom: 20,
                        fontFamily: 'Onest'
                      }}>
                        {moment(selectedNoteDate.date).format('dddd, MMMM D, YYYY')}
                      </Text>
                    )}

                    {/* Note Content */}
                    <ScrollView style={{ flex: 1 }}>
                      {selectedNoteDate && (
                        <>
                          {/* Photo if exists */}
                          {habits.find(h => h.id === selectedNoteDate.habitId)?.photos?.[selectedNoteDate.date] && (
                            <View style={{ marginBottom: 20 }}>
                              <Image
                                source={{ uri: habits.find(h => h.id === selectedNoteDate.habitId)?.photos?.[selectedNoteDate.date] }}
                                style={{
                                  width: '100%',
                                  aspectRatio: 4/3,
                                  borderRadius: 12,
                                }}
                                resizeMode="contain"
                              />
                            </View>
                          )}

                          {/* Note text */}
                          <View style={{
                            padding: 16,
                            marginBottom: 8,
                          }}>
                            <Text style={{
                              fontSize: 16,
                              color: '#3A3A3A',
                              lineHeight: 24,
                              fontFamily: 'Onest'
                            }}>
                              {habits.find(h => h.id === selectedNoteDate.habitId)?.notes?.[selectedNoteDate.date] || 'No note for this day.'}
                            </Text>
                          </View>
                        </>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* Progress Chart Modal */}
          <Modal
            visible={isProgressModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setIsProgressModalVisible(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <View style={{ 
                backgroundColor: 'white', 
                padding: 20, 
                borderTopLeftRadius: 20, 
                borderTopRightRadius: 20,
                maxHeight: '80%',
                minHeight: '40%',
              }}>
                <View style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: 30 
                }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#3A3A3A', fontFamily: 'Onest' }}>Monthly Progress</Text>
                  <TouchableOpacity onPress={() => setIsProgressModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  {habits.length > 0 ? (
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ 
                        width: 64,
                        backgroundColor: 'white',
                        zIndex: 2
                      }}>
                        <PanGestureHandler
                          onHandlerStateChange={(event) => {
                            if (event.nativeEvent.state === State.END) {
                              const { translationX } = event.nativeEvent;
                              if (Math.abs(translationX) > 10) {
                                if (translationX > 0) {
                                  navigateProgressMonth('prev');
                                } else {
                                  navigateProgressMonth('next');
                                }
                              }
                            }
                          }}
                        >
                          <Animated.View style={{ marginTop: 0 }}>
                            <Text style={[styles.progressMonthText, { fontFamily: 'Onest' }]}>
                              {selectedProgressMonth.format('MMMM')}
                            </Text>
                          </Animated.View>
                        </PanGestureHandler>
                        <View style={{ height: 12 }} />
                        {/* Habit names */}
                        {habits.map(habit => (
                          <View 
                            key={habit.id} 
                            style={{ 
                              height: 48,
                              justifyContent: 'center',
                              backgroundColor: 'white'
                            }}
                          >
                            <Text style={{ 
                              fontSize: 15, 
                              color: '#3A3A3A',
                              marginTop: -5,
                              fontWeight: '500',
                              fontFamily: 'Onest'
                            }} numberOfLines={1}>
                              {habit.text}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* Scrollable dates section */}
                      <ScrollView 
                        ref={scrollViewRef}
                        horizontal
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        showsHorizontalScrollIndicator={false}
                        style={{ flex: 1 }}
                      >
                        <View>
                          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                            {getMonthDates().map((date, index) => (
                              <View key={date} style={{ width: 36, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ 
                                  fontSize: 14, 
                                  color: '#3A3A3A',
                                  fontWeight: moment(date).isSame(moment(), 'day') ? 'bold' : 'normal',
                                  textAlign: 'center',
                                  width: '100%',
                                  fontFamily: 'Onest'
                                }}>
                                  {moment(date).format('D')}
                                </Text>
                              </View>
                            ))}
                          </View>

                          {/* Grid rows for each habit */}
                          {habits.map(habit => (
                            <View key={habit.id} style={{ 
                              flexDirection: 'row', 
                              height: 48,
                              alignItems: 'center'
                            }}>
                              {getMonthDates().map(date => {
                                const isCompleted = habit.completedDays.includes(date);
                                const isToday = moment(date).isSame(moment(), 'day');
                                const hasNote = habit.notes?.[date];
                                const hasPhoto = habit.photos?.[date];
                                return (
                                  <TouchableOpacity 
                                    key={date} 
                                    style={{ 
                                      width: 36, 
                                      height: 36,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderRadius: 4,
                                      padding: 3
                                    }}
                                    onPress={() => {
                                      if (hasNote || hasPhoto) {
                                        handleProgressItemPress(habit.id, date);
                                      }
                                    }}
                                  >
                                    {hasNote || hasPhoto ? (
                                      <View style={{ 
                                        width: 24, 
                                        height: 24, 
                                        borderRadius: 12,
                                        backgroundColor: '#F5F5F5',
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                      }}>
                                        {hasPhoto ? (
                                          <Ionicons name="camera" size={14} color="#666" />
                                        ) : (
                                          <Ionicons name="document-text" size={14} color="#666" />
                                        )}
                                      </View>
                                    ) : isCompleted ? (
                                      <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name="checkmark-circle" size={17} color="#A0C3B2" />
                                      </View>
                                    ) : (
                                      <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name="close-circle" size={17} color="#ECE7E1" />
                                      </View>
                                    )}
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                      <Text style={{ fontSize: 16, color: '#3A3A3A', textAlign: 'center', fontFamily: 'Onest' }}>
                        No habits to track yet. Add some habits to see your progress!
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Modal>

          {/* Add the DateTimePicker component */}
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
                  setShowReminderPicker(false);
                }}
              />
              <DateTimePicker
                value={reminderTime instanceof Date ? reminderTime : new Date()}
                mode="datetime"
                display="spinner"
                onChange={(event, selectedTime) => {
                  if (selectedTime) {
                    if (selectedTime > new Date()) {
                      setReminderTime(selectedTime);
                    }
                  }
                }}
                minimumDate={new Date()}
                style={{
                  position: 'absolute',
                  bottom: reminderButtonLayout?.height ? reminderButtonLayout.height - 10 : 0,
                  left: reminderButtonLayout?.x ? reminderButtonLayout.x - 50 : 0,
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

          {/* Add the DateTimePicker for end date */}
          {showEndDatePicker && (
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
              pointerEvents: 'box-none', // This allows touches to pass through to the keyboard
            }}>
              <DateTimePicker
                value={repeatEndDate || new Date()}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    if (selectedDate > new Date()) {
                      setRepeatEndDate(selectedDate);
                    }
                  }
                  setShowEndDatePicker(false);
                }}
                minimumDate={new Date()}
                style={{
                  position: 'absolute',
                  top: endDateButtonLayout?.y ? endDateButtonLayout.y + endDateButtonLayout.height + 10 : 0,
                  left: endDateButtonLayout?.x ? endDateButtonLayout.x - 50 : 0,
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

        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
}





