const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testNotificationSystem() {
  console.log('🔔 [Notification Test] Starting comprehensive notification system test...\n');

  try {
    // Step 1: Check if we have test users
    console.log('📋 Step 1: Checking test users...');
    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !currentUser) {
      console.log('❌ No authenticated user found. Please sign in first.');
      return;
    }
    
    console.log('✅ Current user:', currentUser.email);
    
    // Step 2: Check user's push token
    console.log('\n📱 Step 2: Checking push token...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('expo_push_token, full_name, username')
      .eq('id', currentUser.id)
      .single();
    
    if (profileError) {
      console.log('❌ Error fetching profile:', profileError.message);
      return;
    }
    
    if (!profile.expo_push_token) {
      console.log('⚠️  No push token found. Notifications may not work.');
      console.log('💡 Make sure the app has requested notification permissions.');
    } else {
      console.log('✅ Push token found:', profile.expo_push_token.substring(0, 20) + '...');
    }
    
    // Step 3: Check notification preferences
    console.log('\n⚙️  Step 3: Checking notification preferences...');
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences')
      .select('push_notifications, notifications_enabled')
      .eq('user_id', currentUser.id)
      .single();
    
    if (prefError) {
      console.log('⚠️  No user preferences found. Using defaults.');
    } else {
      console.log('✅ Push notifications enabled:', preferences.push_notifications);
      console.log('✅ Notifications enabled:', preferences.notifications_enabled);
    }
    
    // Step 4: Check if database triggers exist
    console.log('\n🔧 Step 4: Checking database triggers...');
    const { data: triggers, error: triggerError } = await supabase
      .rpc('get_notification_triggers');
    
    if (triggerError) {
      console.log('⚠️  Could not check triggers directly. Checking tables...');
      
      // Check if shared_events and shared_tasks tables exist
      const { data: tables, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', ['shared_events', 'shared_tasks', 'shared_notes']);
      
      if (tableError) {
        console.log('❌ Error checking tables:', tableError.message);
      } else {
        console.log('✅ Found tables:', tables.map(t => t.table_name));
      }
    } else {
      console.log('✅ Database triggers:', triggers);
    }
    
    // Step 5: Test Edge Function availability
    console.log('\n🌐 Step 5: Testing Edge Function...');
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-share-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
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
    
    // Step 6: Check recent shared items
    console.log('\n📊 Step 6: Checking recent shared items...');
    
    // Check shared events
    const { data: sharedEvents, error: eventsError } = await supabase
      .from('shared_events')
      .select('*')
      .or(`shared_by.eq.${currentUser.id},shared_with.eq.${currentUser.id}`)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (eventsError) {
      console.log('❌ Error fetching shared events:', eventsError.message);
    } else {
      console.log('📅 Recent shared events:', sharedEvents.length);
      sharedEvents.forEach(event => {
        console.log(`  - ${event.original_event_id} (${event.status})`);
      });
    }
    
    // Check shared tasks
    const { data: sharedTasks, error: tasksError } = await supabase
      .from('shared_tasks')
      .select('*')
      .or(`shared_by.eq.${currentUser.id},shared_with.eq.${currentUser.id}`)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (tasksError) {
      console.log('❌ Error fetching shared tasks:', tasksError.message);
    } else {
      console.log('📝 Recent shared tasks:', sharedTasks.length);
      sharedTasks.forEach(task => {
        console.log(`  - ${task.original_task_id} (${task.status})`);
      });
    }
    
    // Check shared notes
    const { data: sharedNotes, error: notesError } = await supabase
      .from('shared_notes')
      .select('*')
      .or(`shared_by.eq.${currentUser.id},shared_with.eq.${currentUser.id}`)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (notesError) {
      console.log('❌ Error fetching shared notes:', notesError.message);
    } else {
      console.log('📄 Recent shared notes:', sharedNotes.length);
      sharedNotes.forEach(note => {
        console.log(`  - ${note.original_note_id}`);
      });
    }
    
    // Step 7: Manual notification test
    console.log('\n🧪 Step 7: Manual notification test...');
    if (profile.expo_push_token) {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: profile.expo_push_token,
            title: 'Notification Test',
            body: 'This is a test notification from the notification system test',
            data: { 
              type: 'test_notification',
              timestamp: new Date().toISOString()
            },
            sound: 'default',
            priority: 'high',
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Manual notification sent successfully');
          console.log('📋 Response:', result);
        } else {
          console.log('❌ Manual notification failed:', response.status);
        }
      } catch (error) {
        console.log('❌ Manual notification error:', error.message);
      }
    } else {
      console.log('⚠️  Skipping manual test - no push token');
    }
    
    // Step 8: Summary and recommendations
    console.log('\n📋 Step 8: Summary and Recommendations...');
    console.log('\n🔍 Notification System Status:');
    
    const issues = [];
    const working = [];
    
    if (!profile.expo_push_token) {
      issues.push('❌ No push token found');
    } else {
      working.push('✅ Push token available');
    }
    
    if (preferences && !preferences.push_notifications) {
      issues.push('❌ Push notifications disabled in preferences');
    } else {
      working.push('✅ Push notifications enabled');
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
      if (!profile.expo_push_token) {
        console.log('  1. Make sure the app has notification permissions');
        console.log('  2. Check if the device supports push notifications');
        console.log('  3. Verify the app is properly configured for Expo notifications');
      }
      
      if (preferences && !preferences.push_notifications) {
        console.log('  4. Enable push notifications in user preferences');
      }
    } else {
      console.log('\n🎉 All notification components appear to be working!');
    }
    
    console.log('\n📱 To test notifications:');
    console.log('  1. Share an event/task/note with another user');
    console.log('  2. Check if the recipient receives a push notification');
    console.log('  3. Check the Edge Function logs in Supabase dashboard');
    console.log('  4. Monitor the device notification center');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testNotificationSystem(); 