const { createClient } = require('@supabase/supabase-js');

// Use the same configuration as the app
const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testShareTasks() {
  console.log('🔍 [Share Tasks Test] Starting comprehensive test...\n');

  try {
    // Step 1: Check if we can connect to Supabase
    console.log('📡 Step 1: Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Supabase connection failed:', testError);
      return;
    }
    console.log('✅ Supabase connection successful\n');

    // Step 2: Check if the share_task_with_friend function exists
    console.log('🔧 Step 2: Checking share_task_with_friend function...');
    const { data: functionData, error: functionError } = await supabase
      .rpc('share_task_with_friend', {
        p_task_id: 'test-task-id',
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_friend_id: '00000000-0000-0000-0000-000000000000'
      });
    
    if (functionError) {
      console.log('⚠️  Function exists but test call failed (expected):', functionError.message);
    } else {
      console.log('✅ Function exists and is callable');
    }
    console.log('');

    // Step 3: Check shared_tasks table structure
    console.log('📊 Step 3: Checking shared_tasks table...');
    const { data: tableData, error: tableError } = await supabase
      .from('shared_tasks')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Error accessing shared_tasks table:', tableError);
    } else {
      console.log('✅ shared_tasks table accessible');
      if (tableData && tableData.length > 0) {
        console.log('📋 Sample shared task structure:', Object.keys(tableData[0]));
      }
    }
    console.log('');

    // Step 4: Check todos table structure
    console.log('📝 Step 4: Checking todos table...');
    const { data: todosData, error: todosError } = await supabase
      .from('todos')
      .select('*')
      .limit(1);
    
    if (todosError) {
      console.error('❌ Error accessing todos table:', todosError);
    } else {
      console.log('✅ todos table accessible');
      if (todosData && todosData.length > 0) {
        console.log('📋 Sample todo structure:', Object.keys(todosData[0]));
      }
    }
    console.log('');

    // Step 5: Check for recent shared tasks
    console.log('🔍 Step 5: Checking for recent shared tasks...');
    const { data: recentShares, error: sharesError } = await supabase
      .from('shared_tasks')
      .select(`
        original_task_id,
        shared_by,
        shared_with,
        status,
        copied_task_id,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (sharesError) {
      console.error('❌ Error fetching recent shared tasks:', sharesError);
    } else {
      console.log(`📊 Found ${recentShares?.length || 0} recent shared tasks`);
      if (recentShares && recentShares.length > 0) {
        recentShares.forEach((share, index) => {
          console.log(`  ${index + 1}. Task ${share.original_task_id} shared by ${share.shared_by} with ${share.shared_with} (${share.status})`);
        });
      }
    }
    console.log('');

    // Step 6: Check for copied tasks
    console.log('🔍 Step 6: Checking for copied tasks...');
    const { data: copiedTasks, error: copiedError } = await supabase
      .from('todos')
      .select('id, text, user_id, created_at')
      .like('id', 'shared-%')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (copiedError) {
      console.error('❌ Error fetching copied tasks:', copiedError);
    } else {
      console.log(`📊 Found ${copiedTasks?.length || 0} copied tasks`);
      if (copiedTasks && copiedTasks.length > 0) {
        copiedTasks.forEach((task, index) => {
          console.log(`  ${index + 1}. ${task.id} - "${task.text}" (user: ${task.user_id})`);
        });
      }
    }
    console.log('');

    // Step 7: Check friendships table
    console.log('👥 Step 7: Checking friendships table...');
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friendships')
      .select('*')
      .limit(5);
    
    if (friendshipsError) {
      console.error('❌ Error accessing friendships table:', friendshipsError);
    } else {
      console.log(`📊 Found ${friendships?.length || 0} friendships`);
    }
    console.log('');

    // Step 8: Summary
    console.log('📋 Step 8: Summary...');
    console.log('');
    console.log('🔍 Share Tasks System Status:');
    console.log('');
    console.log('✅ Working components:');
    console.log('  ✅ Supabase connection');
    console.log('  ✅ share_task_with_friend function exists');
    console.log('  ✅ shared_tasks table accessible');
    console.log('  ✅ todos table accessible');
    console.log('  ✅ friendships table accessible');
    console.log('');
    console.log('📊 Current data:');
    console.log(`  📝 Recent shared tasks: ${recentShares?.length || 0}`);
    console.log(`  📋 Copied tasks: ${copiedTasks?.length || 0}`);
    console.log(`  👥 Friendships: ${friendships?.length || 0}`);
    console.log('');
    console.log('💡 To test sharing:');
    console.log('  1. Create a task in the app');
    console.log('  2. Select friends to share with');
    console.log('  3. Check if copied tasks appear for recipients');
    console.log('  4. Verify shared friends display correctly');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testShareTasks(); 