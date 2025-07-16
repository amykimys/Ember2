import { supabase } from '../supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Move uncompleted tasks from yesterday to today
 * This function should be called after midnight
 */
export const moveUncompletedTasksToNextDay = async (userId: string): Promise<void> => {
  try {
    console.log('🔄 Processing auto-move tasks...');

    // Get today's date (the current date)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Find uncompleted tasks from previous days that have auto_move enabled
    // We'll look for tasks with dates before today
    const { data: uncompletedTasks, error: fetchError } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .lt('date', todayStr) // Tasks from dates before today
      .eq('completed', false)
      .eq('auto_move', true);

    if (fetchError) {
      console.error('❌ Error fetching uncompleted tasks:', fetchError);
      return;
    }

    if (!uncompletedTasks || uncompletedTasks.length === 0) {
      console.log('✅ No uncompleted tasks with auto-move found from previous days');
      return;
    }

    console.log(`📝 Found ${uncompletedTasks.length} uncompleted tasks with auto-move enabled to move to today`);

    // Update each task to today's date
    for (const task of uncompletedTasks) {
      const { error: updateError } = await supabase
        .from('todos')
        .update({
          date: todayStr,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)
        .eq('user_id', userId);

      if (updateError) {
        console.error(`❌ Error updating task ${task.id}:`, updateError);
      } else {
        console.log(`✅ Moved task "${task.text}" from ${task.date} to today`);
      }
    }

    console.log(`🎉 Successfully moved ${uncompletedTasks.length} auto-move tasks to today`);
  } catch (error) {
    console.error('💥 Error in moveUncompletedTasksToNextDay:', error);
  }
};

/**
 * Check if it's time to move tasks (called after midnight)
 * This should be called when the app starts or when the user opens the todo screen
 */
export const checkAndMoveTasksIfNeeded = async (userId: string): Promise<void> => {
  try {
    console.log('🕐 Checking if tasks need to be moved...');
    
    // Get the last time we checked for this user
    const lastCheckKey = `last_task_move_check_${userId}`;
    let lastCheckTime: string | null = null;
    
    try {
      lastCheckTime = await AsyncStorage.getItem(lastCheckKey);
    } catch (storageError) {
      console.warn('⚠️ Could not read from AsyncStorage, continuing without cache:', storageError);
    }
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Check if it's exactly midnight (12:00 AM) - hour 0, minute 0-5 (give a small window)
    const isMidnight = currentHour === 0 && currentMinute <= 5;
    const isFirstCheckOfDay = lastCheckTime !== todayStr;
    
    console.log('🕐 Current time:', `${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
    console.log('🌙 Is midnight (12:00-12:05 AM):', isMidnight);
    console.log('📅 Is first check of day:', isFirstCheckOfDay);
    console.log('📅 Last check time:', lastCheckTime);
    console.log('📅 Today:', todayStr);
    
    // Only move tasks if it's exactly midnight AND we haven't checked today yet
    if (!isMidnight) {
      console.log('⏭️ Not midnight, skipping auto-move...');
      return;
    }
    
    if (lastCheckTime === todayStr) {
      console.log('⏭️ Already checked today, skipping...');
      return;
    }

    // Move tasks only if it's exactly midnight and we haven't checked today yet
    console.log(`📅 At midnight and first check of day - moving tasks to today (${todayStr})...`);
    await moveUncompletedTasksToNextDay(userId);
    
    // Mark that we've checked today
    try {
      await AsyncStorage.setItem(lastCheckKey, todayStr);
      console.log('✅ Marked today as checked for auto-move');
    } catch (storageError) {
      console.warn('⚠️ Could not save to AsyncStorage:', storageError);
    }
  } catch (error) {
    console.error('💥 Error in checkAndMoveTasksIfNeeded:', error);
  }
};

/**
 * Manual function to move tasks (for testing or manual trigger)
 */
export const manuallyMoveUncompletedTasks = async (userId: string): Promise<void> => {
  try {
    console.log('🔧 Manually moving uncompleted tasks...');
    
    // Debug: Show all user tasks first
    await debugUserTasks(userId);
    
    // First, let's check what tasks the user has
    const { data: allTasks, error: fetchAllError } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(10);

    if (fetchAllError) {
      console.error('❌ Error fetching all tasks:', fetchAllError);
      return;
    }

    console.log('📋 Current user tasks (last 10):', allTasks);
    
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    console.log(`📅 Yesterday's date: ${yesterdayStr}`);
    
    // Check specifically for yesterday's uncompleted tasks
    const { data: yesterdayTasks, error: yesterdayError } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .eq('date', yesterdayStr)
      .eq('completed', false);

    if (yesterdayError) {
      console.error('❌ Error fetching yesterday\'s tasks:', yesterdayError);
      return;
    }

    console.log(`📝 Uncompleted tasks from yesterday (${yesterdayStr}):`, yesterdayTasks);
    
    if (!yesterdayTasks || yesterdayTasks.length === 0) {
      console.log('✅ No uncompleted tasks found from yesterday - nothing to move!');
      return;
    }

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    console.log(`📅 Moving ${yesterdayTasks.length} tasks from ${yesterdayStr} to ${todayStr}`);

    // Update each task to today's date (bypassing preference check)
    let movedCount = 0;
    for (const task of yesterdayTasks) {
      const { error: updateError } = await supabase
        .from('todos')
        .update({
          date: todayStr,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)
        .eq('user_id', userId);

      if (updateError) {
        console.error(`❌ Error updating task ${task.id}:`, updateError);
      } else {
        console.log(`✅ Moved task "${task.text}" to today`);
        movedCount++;
      }
    }

    console.log(`🎉 Successfully moved ${movedCount} out of ${yesterdayTasks.length} tasks to today`);
    
    // Debug: Show tasks after the move
    console.log('🔍 Tasks after move:');
    await debugUserTasks(userId);
  } catch (error) {
    console.error('💥 Error in manuallyMoveUncompletedTasks:', error);
  }
};

/**
 * Force check and move tasks regardless of time or previous checks
 * This is useful for testing or manual triggers
 */
export const forceCheckAndMoveTasks = async (userId: string): Promise<void> => {
  try {
    console.log('🔧 Force checking and moving tasks...');
    
    // Clear the last check time to force a check
    const lastCheckKey = `last_task_move_check_${userId}`;
    try {
      await AsyncStorage.removeItem(lastCheckKey);
      console.log('🗑️ Cleared last check time to force check');
    } catch (storageError) {
      console.warn('⚠️ Could not clear AsyncStorage:', storageError);
    }
    
    // Now run the normal check
    await checkAndMoveTasksIfNeeded(userId);
  } catch (error) {
    console.error('💥 Error in forceCheckAndMoveTasks:', error);
  }
};

/**
 * Debug function to check auto-move status and what would happen
 */
export const debugAutoMoveStatus = async (userId: string): Promise<void> => {
  try {
    console.log('🔍 Debugging auto-move status for user:', userId);
    
    // Check last check time
    const lastCheckKey = `last_task_move_check_${userId}`;
    let lastCheckTime: string | null = null;
    try {
      lastCheckTime = await AsyncStorage.getItem(lastCheckKey);
    } catch (storageError) {
      console.warn('⚠️ Could not read from AsyncStorage:', storageError);
    }
    console.log('⏰ Last check time:', lastCheckTime);
    
    // Check current time
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    console.log('🕐 Current time:', now.toISOString());
    console.log('📅 Today:', todayStr);
    console.log('⏰ Current hour:', currentHour);
    
    // Check if it's exactly midnight
    const isMidnight = currentHour === 0;
    const isFirstCheckOfDay = lastCheckTime !== todayStr;
    console.log('🌙 Is midnight (12:00 AM):', isMidnight);
    console.log('📅 Is first check of day:', isFirstCheckOfDay);
    console.log('✅ Would trigger auto-move:', isMidnight && isFirstCheckOfDay);
    
    // Check yesterday's tasks
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const { data: yesterdayTasks, error: yesterdayError } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .eq('date', yesterdayStr)
      .eq('completed', false);

    if (yesterdayError) {
      console.error('❌ Error fetching yesterday\'s tasks:', yesterdayError);
      return;
    }

    console.log(`📝 Uncompleted tasks from yesterday (${yesterdayStr}):`, yesterdayTasks?.length || 0);
    if (yesterdayTasks && yesterdayTasks.length > 0) {
      yesterdayTasks.forEach(task => {
        console.log(`  - "${task.text}" (auto_move: ${task.auto_move})`);
      });
    }
    
    // Check today's tasks
    const { data: todayTasks, error: todayError } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .eq('date', todayStr);

    if (todayError) {
      console.error('❌ Error fetching today\'s tasks:', todayError);
      return;
    }

    console.log(`📝 Tasks for today (${todayStr}):`, todayTasks?.length || 0);
    if (todayTasks && todayTasks.length > 0) {
      todayTasks.forEach(task => {
        console.log(`  - "${task.text}" (completed: ${task.completed}, auto_move: ${task.auto_move})`);
      });
    }
  } catch (error) {
    console.error('💥 Error in debugAutoMoveStatus:', error);
  }
};

/**
 * Debug function to check what tasks exist for a user
 */
export const debugUserTasks = async (userId: string): Promise<void> => {
  try {
    console.log('🔍 Debugging tasks for user:', userId);
    
    // Get all tasks for the user
    const { data: allTasks, error: fetchError } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (fetchError) {
      console.error('❌ Error fetching tasks:', fetchError);
      return;
    }

    console.log(`📋 Total tasks for user: ${allTasks?.length || 0}`);
    
    if (allTasks && allTasks.length > 0) {
      // Group tasks by date
      const tasksByDate: { [date: string]: any[] } = {};
      allTasks.forEach(task => {
        const date = task.date;
        if (!tasksByDate[date]) {
          tasksByDate[date] = [];
        }
        tasksByDate[date].push(task);
      });

      // Show tasks by date
      Object.keys(tasksByDate).sort().reverse().forEach(date => {
        const tasks = tasksByDate[date];
        const completed = tasks.filter(t => t.completed).length;
        const uncompleted = tasks.filter(t => !t.completed).length;
        console.log(`📅 ${date}: ${tasks.length} tasks (${completed} completed, ${uncompleted} uncompleted)`);
        
        tasks.forEach(task => {
          console.log(`  - "${task.text}" (${task.completed ? 'completed' : 'uncompleted'})`);
        });
      });
    } else {
      console.log('📋 No tasks found for user');
    }
  } catch (error) {
    console.error('💥 Error in debugUserTasks:', error);
  }
};

/**
 * Move a specific task to tomorrow if it has auto_move enabled and is not completed
 */
export const moveAutoMoveTaskToTomorrow = async (taskId: string, userId: string): Promise<void> => {
  try {
    console.log(`🔄 Checking if task ${taskId} should be auto-moved...`);
    
    // Get the task to check if it has auto_move enabled
    const { data: task, error: fetchError } = await supabase
      .from('todos')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching task:', fetchError);
      return;
    }

    if (!task) {
      console.log('❌ Task not found');
      return;
    }

    // Check if task has auto_move enabled and is not completed
    if (!task.auto_move || task.completed) {
      console.log(`⏭️ Task ${taskId} auto-move disabled or already completed, skipping...`);
      return;
    }

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log(`📅 Moving task "${task.text}" to tomorrow (${tomorrowStr})`);

    // Update the task to tomorrow's date
    const { error: updateError } = await supabase
      .from('todos')
      .update({
        date: tomorrowStr,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .eq('user_id', userId);

    if (updateError) {
      console.error(`❌ Error updating task ${taskId}:`, updateError);
    } else {
      console.log(`✅ Successfully moved task "${task.text}" to tomorrow`);
    }
  } catch (error) {
    console.error('💥 Error in moveAutoMoveTaskToTomorrow:', error);
  }
};

 