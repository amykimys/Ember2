import React, { createContext, useContext, useState, ReactNode } from 'react';

// Data interfaces
interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  timezone: string;
  username: string;
  created_at: string;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications_enabled: boolean;
  default_view: 'day' | 'week' | 'month';
  email_notifications: boolean;
  push_notifications: boolean;
  default_screen: 'calendar' | 'todo' | 'notes' | 'profile';
  auto_move_uncompleted_tasks: boolean;
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
  repeat_type: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
  repeat_end_date: string | null;
  notes: { [date: string]: string };
  photos: { [date: string]: string };
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  date: string;
  startDateTime?: Date;
  endDateTime?: Date;
  categoryName?: string;
  categoryColor?: string;
  reminderTime?: Date | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface SharedEvent {
  id: string;
  event_id: string;
  shared_by: string;
  shared_with: string[];
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  events: CalendarEvent;
  profiles: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string;
  };
}

interface Note {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface SharedNote {
  id: string;
  original_note_id: string;
  shared_by: string;
  shared_with: string[];
  can_edit: boolean;
  created_at: string;
  notes: Note;
  profiles: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string;
  };
}

interface SocialUpdate {
  id: string;
  user_id: string;
  content: string;
  photo_url?: string;
  caption?: string;
  source_type: 'habit' | 'event';
  source_title: string;
  created_at: string;
  profiles: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string;
  };
}

interface Friend {
  friendship_id: string;
  status: string;
  created_at: string;
  profiles: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string;
  };
}

interface FriendRequest {
  friendship_id: string;
  status: string;
  created_at: string;
  profiles: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string;
  };
}

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
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
  customRepeatDates?: Date[];
  repeatEndDate?: Date | null;
  reminderTime?: Date | null;
  photo?: string;
  deletedInstances?: string[];
  autoMove?: boolean;
  sharedFriends?: Array<{
    friend_id: string;
    friend_name: string;
    friend_avatar: string;
    friend_username: string;
  }>;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface AppData {
  userProfile: UserProfile | null;
  userPreferences: UserPreferences | null;
  todos: Todo[];
  habits: Habit[];
  events: CalendarEvent[];
  sharedEvents: SharedEvent[];
  notes: Note[];
  sharedNotes: SharedNote[];
  friends: Friend[];
  friendRequests: FriendRequest[];
  categories: Category[];
  socialUpdates: SocialUpdate[];
  isPreloaded: boolean;
  lastUpdated: Date | null;
}

interface DataContextType {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  updateData: (key: keyof AppData, value: any) => void;
  refreshData: () => void;
  clearData: () => void;
}

const defaultData: AppData = {
  userProfile: null,
  userPreferences: null,
  todos: [],
  habits: [],
  events: [],
  sharedEvents: [],
  notes: [],
  sharedNotes: [],
  friends: [],
  friendRequests: [],
  categories: [],
  socialUpdates: [],
  isPreloaded: false,
  lastUpdated: null,
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [data, setData] = useState<AppData>(defaultData);

  const updateData = (key: keyof AppData, value: any) => {
    setData(prev => ({
      ...prev,
      [key]: value,
      lastUpdated: new Date(),
    }));
  };

  const refreshData = () => {
    setData(prev => ({
      ...prev,
      lastUpdated: new Date(),
    }));
  };

  const clearData = () => {
    setData(defaultData);
  };

  const value: DataContextType = {
    data,
    setData,
    updateData,
    refreshData,
    clearData,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}; 