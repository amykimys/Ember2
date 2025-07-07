import { supabase } from '../supabase';
import { getUserPreferences } from './notificationUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Move uncompleted tasks from yesterday to today
 * This function should be called after midnight
 */
export const moveUncompletedTasksToNextDay = async (userId: string): Promise<void> => {
  try {
    console.log('🔄 Checking if user has auto-move enabled...');
    
    // Check if user has auto-move enabled
    const preferences = await getUserPreferences(userId);
    if (!preferences) {
      console.log('⚠️ No user preferences found, skipping auto-move...');
      return;
    }
    
    if (!preferences.auto_move_uncompleted_tasks) {
      console.log('⏭️ Auto-move disabled for user, skipping...');
      return;
    }

    console.log('✅ Auto-move enabled, processing uncompleted tasks...');

    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    console.log(`📅 Moving tasks from ${yesterdayStr} to ${todayStr}`);

    // Find uncompleted tasks from yesterday
    const { data: uncompletedTasks, error: fetchError } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .eq('date', yesterdayStr)
      .eq('completed', false);

    if (fetchError) {
      console.error('❌ Error fetching uncompleted tasks:', fetchError);
      return;
    }

    if (!uncompletedTasks || uncompletedTasks.length === 0) {
      console.log('✅ No uncompleted tasks found from yesterday');
      return;
    }

    console.log(`📝 Found ${uncompletedTasks.length} uncompleted tasks to move`);

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
        console.log(`✅ Moved task "${task.text}" to today`);
      }
    }

    console.log(`🎉 Successfully moved ${uncompletedTasks.length} tasks to today`);
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
    
    // If we already checked today, skip
    if (lastCheckTime === todayStr) {
      console.log('⏭️ Already checked today, skipping...');
      return;
    }

    // Check if it's after midnight (between 12:00 AM and 6:00 AM)
    const currentHour = now.getHours();
    if (currentHour >= 0 && currentHour < 6) {
      console.log('🌙 It\'s after midnight, moving uncompleted tasks...');
      await moveUncompletedTasksToNextDay(userId);
      
      // Mark that we've checked today
      try {
        await AsyncStorage.setItem(lastCheckKey, todayStr);
      } catch (storageError) {
        console.warn('⚠️ Could not save to AsyncStorage:', storageError);
      }
    } else {
      console.log('☀️ Not after midnight, skipping task move...');
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