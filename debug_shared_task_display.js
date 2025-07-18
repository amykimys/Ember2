const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugSharedTaskDisplay() {
  console.log('🔍 Debugging shared task display issue...\n');
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('❌ Not logged in');
      return;
    }
    
    console.log('👤 Current user ID:', user.id);
    
    // 1. Check all shared tasks for this user
    console.log('\n📋 1. Checking shared tasks...');
    const { data: sharedTasks, error: sharedError } = await supabase
      .from('shared_tasks')
      .select('original_task_id, shared_by, shared_with, copied_task_id, status')
      .or(`shared_by.eq.${user.id},shared_with.eq.${user.id}`);

    if (sharedError) {
      console.error('❌ Error fetching shared tasks:', sharedError);
      return;
    }

    console.log('📋 Shared tasks found:', sharedTasks?.length || 0);
    if (sharedTasks && sharedTasks.length > 0) {
      sharedTasks.forEach((st, index) => {
        console.log(`  ${index + 1}. Original: ${st.original_task_id}, Copied: ${st.copied_task_id}, Status: ${st.status}`);
        console.log(`     Shared by: ${st.shared_by}, Shared with: ${st.shared_with}`);
      });
    }

    // 2. Check all tasks for this user
    console.log('\n📝 2. Checking all tasks for user...');
    const { data: allTasks, error: tasksError } = await supabase
      .from('todos')
      .select('id, text, user_id')
      .eq('user_id', user.id);

    if (tasksError) {
      console.error('❌ Error fetching tasks:', tasksError);
      return;
    }

    console.log('📝 Total tasks for user:', allTasks?.length || 0);
    
    // Check for copied tasks (should start with 'shared-')
    const copiedTasks = allTasks?.filter(task => task.id.startsWith('shared-')) || [];
    console.log('📝 Copied tasks (shared-*):', copiedTasks.length);
    copiedTasks.forEach((task, index) => {
      console.log(`  ${index + 1}. ID: ${task.id}, Text: ${task.text}`);
    });

    // 3. Check original tasks that are shared
    console.log('\n🔗 3. Checking original tasks that are shared...');
    if (sharedTasks && sharedTasks.length > 0) {
      const originalTaskIds = sharedTasks.map(st => st.original_task_id);
      const { data: originalTasks, error: originalError } = await supabase
        .from('todos')
        .select('id, text, user_id')
        .in('id', originalTaskIds);

      if (originalError) {
        console.error('❌ Error fetching original tasks:', originalError);
      } else {
        console.log('🔗 Original tasks found:', originalTasks?.length || 0);
        originalTasks?.forEach((task, index) => {
          console.log(`  ${index + 1}. ID: ${task.id}, Text: ${task.text}, User: ${task.user_id}`);
        });
      }
    }

    // 4. Simulate the filtering logic
    console.log('\n🎯 4. Simulating filtering logic...');
    if (sharedTasks && allTasks) {
      const tasksToShow = new Set();
      const tasksToHide = new Set();

      // Process shared tasks to determine which tasks to show/hide
      sharedTasks.forEach(sharedTask => {
        const originalTaskId = sharedTask.original_task_id;
        const copiedTaskId = sharedTask.copied_task_id;
        
        if (sharedTask.shared_by === user.id) {
          // You're the sender - show the original task
          tasksToShow.add(originalTaskId);
          if (copiedTaskId) {
            tasksToHide.add(copiedTaskId);
          }
        } else if (sharedTask.shared_with === user.id) {
          // You're the recipient - show the copied task, hide the original
          if (copiedTaskId) {
            tasksToShow.add(copiedTaskId);
          }
          tasksToHide.add(originalTaskId);
        }
      });

      console.log('🎯 Tasks to show:', Array.from(tasksToShow));
      console.log('🎯 Tasks to hide:', Array.from(tasksToHide));

      // Filter tasks
      const filteredTasks = allTasks.filter(task => {
        if (tasksToHide.has(task.id)) {
          console.log(`❌ Hiding task: ${task.id} (${task.text})`);
          return false;
        }
        if (tasksToShow.has(task.id)) {
          console.log(`✅ Showing task: ${task.id} (${task.text})`);
          return true;
        }
        // For tasks not involved in sharing, show them normally
        console.log(`📝 Showing normal task: ${task.id} (${task.text})`);
        return true;
      });

      console.log('🎯 Final filtered tasks count:', filteredTasks.length);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugSharedTaskDisplay(); 