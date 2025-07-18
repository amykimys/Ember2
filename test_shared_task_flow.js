const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSharedTaskFlow() {
  console.log('🧪 Testing shared task flow...\n');
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('❌ Not logged in');
      return;
    }
    
    console.log('👤 Current user ID:', user.id);
    
    // 1. Check if user has any tasks
    console.log('\n📝 1. Checking user tasks...');
    const { data: userTasks, error: tasksError } = await supabase
      .from('todos')
      .select('id, text, user_id')
      .eq('user_id', user.id)
      .limit(5);

    if (tasksError) {
      console.error('❌ Error fetching user tasks:', tasksError);
      return;
    }

    console.log('📝 User tasks found:', userTasks?.length || 0);
    if (userTasks && userTasks.length > 0) {
      userTasks.forEach((task, index) => {
        console.log(`  ${index + 1}. ID: ${task.id}, Text: ${task.text}`);
      });
    } else {
      console.log('❌ No tasks found for user');
      return;
    }

    // 2. Check if user has any friends
    console.log('\n👥 2. Checking user friends...');
    const { data: friendships, error: friendsError } = await supabase
      .from('friendships')
      .select('id, user_id, friend_id, status')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (friendsError) {
      console.error('❌ Error fetching friendships:', friendsError);
      return;
    }

    console.log('👥 Friendships found:', friendships?.length || 0);
    if (friendships && friendships.length > 0) {
      friendships.forEach((friendship, index) => {
        const friendId = friendship.user_id === user.id ? friendship.friend_id : friendship.user_id;
        console.log(`  ${index + 1}. Friend ID: ${friendId}`);
      });
    } else {
      console.log('❌ No friends found for user');
      return;
    }

    // 3. Test sharing a task with a friend
    console.log('\n🔄 3. Testing task sharing...');
    const taskToShare = userTasks[0];
    const friendToShareWith = friendships[0];
    const friendId = friendToShareWith.user_id === user.id ? friendToShareWith.friend_id : friendToShareWith.user_id;

    console.log(`🔄 Sharing task "${taskToShare.text}" with friend ${friendId}`);

    const { error: shareError } = await supabase.rpc('share_task_with_friend', {
      p_task_id: taskToShare.id,
      p_user_id: user.id,
      p_friend_id: friendId
    });

    if (shareError) {
      console.error('❌ Error sharing task:', shareError);
      return;
    }

    console.log('✅ Task shared successfully!');

    // 4. Check if the shared task was created
    console.log('\n🔍 4. Checking shared task creation...');
    const { data: sharedTask, error: sharedError } = await supabase
      .from('shared_tasks')
      .select('*')
      .eq('original_task_id', taskToShare.id)
      .eq('shared_by', user.id)
      .eq('shared_with', friendId)
      .single();

    if (sharedError) {
      console.error('❌ Error fetching shared task:', sharedError);
      return;
    }

    console.log('🔍 Shared task created:', {
      id: sharedTask.id,
      originalTaskId: sharedTask.original_task_id,
      copiedTaskId: sharedTask.copied_task_id,
      status: sharedTask.status
    });

    // 5. Check if the copied task was created for the friend
    if (sharedTask.copied_task_id) {
      console.log('\n📋 5. Checking copied task for friend...');
      const { data: copiedTask, error: copiedError } = await supabase
        .from('todos')
        .select('id, text, user_id')
        .eq('id', sharedTask.copied_task_id)
        .single();

      if (copiedError) {
        console.error('❌ Error fetching copied task:', copiedError);
        return;
      }

      console.log('📋 Copied task created:', {
        id: copiedTask.id,
        text: copiedTask.text,
        userId: copiedTask.user_id
      });

      // 6. Verify the friend can see the task
      console.log('\n👀 6. Verifying friend can see the task...');
      const { data: friendTasks, error: friendTasksError } = await supabase
        .from('todos')
        .select('id, text, user_id')
        .eq('user_id', friendId);

      if (friendTasksError) {
        console.error('❌ Error fetching friend tasks:', friendTasksError);
        return;
      }

      const friendHasCopiedTask = friendTasks.some(task => task.id === sharedTask.copied_task_id);
      console.log('👀 Friend has copied task:', friendHasCopiedTask);
      
      if (friendHasCopiedTask) {
        console.log('✅ SUCCESS: Friend can see the shared task!');
      } else {
        console.log('❌ FAILURE: Friend cannot see the shared task');
      }

    } else {
      console.log('❌ No copied task ID found in shared task');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testSharedTaskFlow(); 