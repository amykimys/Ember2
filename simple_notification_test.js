const { createClient } = require('@supabase/supabase-js');

// Use the same configuration as the app
const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function simpleNotificationTest() {
  console.log('🔔 [Simple Notification Test] Starting...\n');

  try {
    // Step 1: Check if we can connect to Supabase
    console.log('📡 Step 1: Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.log('❌ Supabase connection failed:', testError.message);
      return;
    }
    console.log('✅ Supabase connection successful');

    // Step 2: Check if users exist
    console.log('\n👥 Step 2: Checking users...');
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, full_name, expo_push_token')
      .limit(5);
    
    if (usersError) {
      console.log('❌ Error fetching users:', usersError.message);
      return;
    }
    
    console.log(`✅ Found ${users.length} users`);
    const usersWithTokens = users.filter(u => u.expo_push_token);
    console.log(`📱 Users with push tokens: ${usersWithTokens.length}/${users.length}`);
    
    if (usersWithTokens.length > 0) {
      console.log('✅ Some users have push tokens - notifications can work');
    } else {
      console.log('⚠️  No users have push tokens - notifications won\'t work');
    }

    // Step 3: Check recent shared items
    console.log('\n📊 Step 3: Checking recent shared items...');
    
    // Check shared events
    const { data: sharedEvents, error: eventsError } = await supabase
      .from('shared_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (eventsError) {
      console.log('❌ Error fetching shared events:', eventsError.message);
    } else {
      console.log(`📅 Recent shared events: ${sharedEvents.length}`);
    }
    
    // Check shared tasks
    const { data: sharedTasks, error: tasksError } = await supabase
      .from('shared_tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (tasksError) {
      console.log('❌ Error fetching shared tasks:', tasksError.message);
    } else {
      console.log(`📝 Recent shared tasks: ${sharedTasks.length}`);
    }
    
    // Check shared notes
    const { data: sharedNotes, error: notesError } = await supabase
      .from('shared_notes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (notesError) {
      console.log('❌ Error fetching shared notes:', notesError.message);
    } else {
      console.log(`📄 Recent shared notes: ${sharedNotes.length}`);
    }

    // Step 4: Test Edge Function
    console.log('\n🌐 Step 4: Testing Edge Function...');
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-share-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          table: 'test',
          record: { test: true }
        })
      });
      
      if (response.ok) {
        console.log('✅ Edge Function is accessible');
      } else {
        console.log('⚠️  Edge Function returned status:', response.status);
      }
    } catch (error) {
      console.log('❌ Edge Function test failed:', error.message);
    }

    // Step 5: Check notification preferences
    console.log('\n⚙️  Step 5: Checking notification preferences...');
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences')
      .select('user_id, push_notifications, notifications_enabled')
      .limit(5);
    
    if (prefError) {
      console.log('⚠️  No user preferences found or error:', prefError.message);
    } else {
      const enabledCount = preferences.filter(p => p.push_notifications).length;
      console.log(`✅ Found ${preferences.length} user preferences`);
      console.log(`🔔 Users with push notifications enabled: ${enabledCount}/${preferences.length}`);
    }

    // Step 6: Summary
    console.log('\n📋 Step 6: Summary...');
    console.log('\n🔍 Notification System Status:');
    
    const issues = [];
    const working = [];
    
    if (usersWithTokens.length === 0) {
      issues.push('❌ No users have push tokens');
    } else {
      working.push(`✅ ${usersWithTokens.length} users have push tokens`);
    }
    
    if (preferences && preferences.length > 0) {
      const enabledCount = preferences.filter(p => p.push_notifications).length;
      if (enabledCount === 0) {
        issues.push('❌ No users have push notifications enabled');
      } else {
        working.push(`✅ ${enabledCount} users have push notifications enabled`);
      }
    } else {
      issues.push('⚠️  No user preferences found');
    }
    
    if (sharedEvents.length === 0 && sharedTasks.length === 0 && sharedNotes.length === 0) {
      issues.push('⚠️  No recent shared items found (may be normal)');
    } else {
      working.push('✅ Shared items exist');
    }
    
    console.log('\n✅ Working components:');
    working.forEach(item => console.log(`  ${item}`));
    
    if (issues.length > 0) {
      console.log('\n❌ Issues found:');
      issues.forEach(item => console.log(`  ${item}`));
      
      console.log('\n💡 Recommendations:');
      if (usersWithTokens.length === 0) {
        console.log('  1. Make sure users have granted notification permissions in the app');
        console.log('  2. Check if the app is properly requesting push tokens');
        console.log('  3. Verify Expo configuration in app.json');
      }
      
      if (preferences && preferences.length > 0) {
        const enabledCount = preferences.filter(p => p.push_notifications).length;
        if (enabledCount === 0) {
          console.log('  4. Users need to enable push notifications in app settings');
        }
      }
    } else {
      console.log('\n🎉 All notification components appear to be working!');
    }
    
    console.log('\n📱 To test notifications:');
    console.log('  1. Share an event/task/note with another user in the app');
    console.log('  2. Check if the recipient receives a push notification');
    console.log('  3. Check the Edge Function logs in Supabase dashboard');
    console.log('  4. Monitor the device notification center');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
simpleNotificationTest(); 