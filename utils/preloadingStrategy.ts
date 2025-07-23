import { supabase } from '../supabase';
import { checkAndMoveTasksIfNeeded } from './taskUtils';

// Define data priority levels
export enum DataPriority {
  CRITICAL = 'critical',    // Must load before app shows
  IMPORTANT = 'important',  // Load immediately after app shows
  NORMAL = 'normal',        // Load in background
  LOW = 'low'              // Load on demand
}

// Data loading configuration
export const DATA_LOADING_CONFIG = {
  [DataPriority.CRITICAL]: {
    timeout: 10000, // 10 seconds
    retries: 3,
    required: true
  },
  [DataPriority.IMPORTANT]: {
    timeout: 15000, // 15 seconds
    retries: 2,
    required: false
  },
  [DataPriority.NORMAL]: {
    timeout: 30000, // 30 seconds
    retries: 1,
    required: false
  },
  [DataPriority.LOW]: {
    timeout: 60000, // 60 seconds
    retries: 0,
    required: false
  }
};

// Define what data belongs to each priority
export const DATA_PRIORITIES = {
  // CRITICAL - Must load before app shows
  [DataPriority.CRITICAL]: [
    'userProfile',
    'userPreferences',
    'categories',
    'basicTodos', // Just today's todos
    'basicHabits' // Just active habits
  ],
  
  // IMPORTANT - Load immediately after app shows
  [DataPriority.IMPORTANT]: [
    'allTodos',
    'allHabits',
    'calendarEvents',
    'notes',
    'friends',
    'friendRequests'
  ],
  
  // NORMAL - Load in background
  [DataPriority.NORMAL]: [
    'sharedEvents',
    'sharedNotes',
    'socialUpdates',
    'autoMoveTasks'
  ],
  
  // LOW - Load on demand
  [DataPriority.LOW]: [
    'detailedAnalytics',
    'historicalData',
    'nonEssentialFeatures'
  ]
};

// Enhanced preloading with priority system
export class AppDataPreloader {
  private loadedData: Record<string, any> = {};
  private loadingPromises: Record<string, Promise<any>> = {};
  private isInitialLoadComplete = false;

  // Phase 1: Load critical data (before app shows)
  async loadCriticalData(userId: string): Promise<{
    success: boolean;
    data: Record<string, any>;
    errors: string[];
  }> {
    console.log('🚀 Loading critical data...');
    const startTime = Date.now();
    const errors: string[] = [];
    const criticalData: Record<string, any> = {};

    const criticalTasks = [
      { name: 'userProfile', fn: () => this.preloadUserProfile(userId) },
      { name: 'userPreferences', fn: () => this.preloadUserPreferences(userId) },
      { name: 'categories', fn: () => this.preloadCategories(userId) },
      { name: 'basicTodos', fn: () => this.preloadBasicTodos(userId) },
      { name: 'basicHabits', fn: () => this.preloadBasicHabits(userId) }
    ];

    // Load critical data in parallel with timeout
    const promises = criticalTasks.map(async (task) => {
      try {
        const result = await Promise.race([
          task.fn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout: ${task.name}`)), 
            DATA_LOADING_CONFIG[DataPriority.CRITICAL].timeout)
          )
        ]);
        
        criticalData[task.name] = result;
        console.log(`✅ Critical: ${task.name} loaded`);
        return { success: true, task: task.name, data: result };
      } catch (error) {
        const errorMsg = `Failed to load ${task.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ Critical: ${errorMsg}`);
        errors.push(errorMsg);
        return { success: false, task: task.name, error };
      }
    });

    const results = await Promise.allSettled(promises);
    const successfulTasks = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    
    const loadTime = Date.now() - startTime;
    console.log(`📊 Critical data loaded: ${successfulTasks}/${criticalTasks.length} in ${loadTime}ms`);

    // Consider critical load successful if at least 80% of tasks succeed
    const success = successfulTasks >= criticalTasks.length * 0.8;
    
    if (success) {
      this.loadedData = { ...this.loadedData, ...criticalData };
    }

    return { success, data: criticalData, errors };
  }

  // Phase 2: Load important data (immediately after app shows)
  async loadImportantData(userId: string): Promise<void> {
    console.log('⚡ Loading important data...');
    
    const importantTasks = [
      { name: 'allTodos', fn: () => this.preloadAllTodos(userId) },
      { name: 'allHabits', fn: () => this.preloadAllHabits(userId) },
      { name: 'calendarEvents', fn: () => this.preloadCalendarEvents(userId) },
      { name: 'notes', fn: () => this.preloadNotes(userId) },
      { name: 'friends', fn: () => this.preloadFriendsAndRequests(userId) }
    ];

    // Load important data in parallel
    const promises = importantTasks.map(async (task) => {
      try {
        const result = await Promise.race([
          task.fn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout: ${task.name}`)), 
            DATA_LOADING_CONFIG[DataPriority.IMPORTANT].timeout)
          )
        ]);
        
        this.loadedData[task.name] = result;
        console.log(`✅ Important: ${task.name} loaded`);
        return { success: true, task: task.name };
      } catch (error) {
        console.error(`❌ Important: Failed to load ${task.name}:`, error);
        return { success: false, task: task.name, error };
      }
    });

    await Promise.allSettled(promises);
  }

  // Phase 3: Load normal data (in background)
  async loadNormalData(userId: string): Promise<void> {
    console.log('🔄 Loading normal data in background...');
    
    const normalTasks = [
      { name: 'sharedEvents', fn: () => this.preloadSharedEvents(userId) },
      { name: 'sharedNotes', fn: () => this.preloadSharedNotes(userId) },
      { name: 'socialUpdates', fn: () => this.preloadSocialUpdates(userId) },
      { name: 'autoMoveTasks', fn: () => this.runAutoMoveTasks(userId) }
    ];

    // Load normal data in background (don't wait for completion)
    normalTasks.forEach(async (task) => {
      try {
        const result = await task.fn();
        this.loadedData[task.name] = result;
        console.log(`✅ Normal: ${task.name} loaded`);
      } catch (error) {
        console.error(`❌ Normal: Failed to load ${task.name}:`, error);
      }
    });
  }

  // Get loaded data
  getLoadedData(): Record<string, any> {
    return { ...this.loadedData };
  }

  // Check if specific data is loaded
  isDataLoaded(dataType: string): boolean {
    return this.loadedData.hasOwnProperty(dataType);
  }

  // Mark initial load as complete
  markInitialLoadComplete(): void {
    this.isInitialLoadComplete = true;
  }

  // Check if initial load is complete
  getInitialLoadComplete(): boolean {
    return this.isInitialLoadComplete;
  }

  // Individual data loading functions
  private async preloadUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  }

  private async preloadUserPreferences(userId: string) {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    return data;
  }

  private async preloadCategories(userId: string) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data || [];
  }

  private async preloadBasicTodos(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .gte('date', today)
      .lte('date', today)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  private async preloadBasicHabits(userId: string) {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10); // Just active habits
    
    if (error) throw error;
    return data || [];
  }

  private async preloadAllTodos(userId: string) {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  private async preloadAllHabits(userId: string) {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  private async preloadCalendarEvents(userId: string) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  private async preloadNotes(userId: string) {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  private async preloadFriendsAndRequests(userId: string) {
    // Load friends
    const { data: friends, error: friendsError } = await supabase
      .from('friendships')
      .select(`
        id,
        profiles!friendships_friend_id_fkey (
          id, full_name, username, avatar_url
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'accepted');
    
    if (friendsError) throw friendsError;

    // Load friend requests
    const { data: requests, error: requestsError } = await supabase
      .from('friendships')
      .select(`
        id,
        profiles!friendships_user_id_fkey (
          id, full_name, username, avatar_url
        )
      `)
      .eq('friend_id', userId)
      .eq('status', 'pending');
    
    if (requestsError) throw requestsError;

    return {
      friends: friends || [],
      friendRequests: requests || []
    };
  }

  private async preloadSharedEvents(userId: string) {
    const { data, error } = await supabase
      .from('shared_events')
      .select(`
        *,
        events (*),
        profiles (*)
      `)
      .or(`shared_by.eq.${userId},shared_with.cs.{${userId}}`);
    
    if (error) throw error;
    return data || [];
  }

  private async preloadSharedNotes(userId: string) {
    const { data, error } = await supabase
      .from('shared_notes')
      .select(`
        *,
        notes (*),
        profiles (*)
      `)
      .or(`shared_by.eq.${userId},shared_with.cs.{${userId}}`);
    
    if (error) throw error;
    return data || [];
  }

  private async preloadSocialUpdates(userId: string) {
    const { data, error } = await supabase
      .from('social_updates')
      .select(`
        *,
        profiles (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    return data || [];
  }

  private async runAutoMoveTasks(userId: string) {
    try {
      await checkAndMoveTasksIfNeeded(userId);
      return { success: true };
    } catch (error) {
      console.error('Auto-move tasks failed:', error);
      return { success: false, error };
    }
  }
}

// Singleton instance
export const appDataPreloader = new AppDataPreloader(); 