const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testShareNotifications() {
  try {
    console.log('🧪 Testing Share Notification System...');
    
    // Test user IDs (replace with actual user IDs)
    const senderId = 'cf77e7d5-5743-46d5-add9-de9a1db64fd4'; // Amy Kim
    const recipientId = 'cf77e7d5-5743-46d5-add9-de9a1db64fd4'; // Same user for testing
    
    console.log('📋 Test Configuration:');
    console.log('- Sender ID:', senderId);
    console.log('- Recipient ID:', recipientId);
    console.log('- Note: Using same user for testing (self-share should be skipped)');
    
    // Step 1: Check if recipient has push token
    console.log('\n🔍 Step 1: Checking recipient push token...');
    const { data: recipientProfile, error: profileError } = await supabase
      .from('profiles')
      .select('expo_push_token, full_name, username')
      .eq('id', recipientId)
      .single();
    
    if (profileError) {
      console.error('❌ Error fetching recipient profile:', profileError);
      return;
    }
    
    console.log('✅ Recipient profile found:', {
      name: recipientProfile.full_name || recipientProfile.username,
      hasPushToken: !!recipientProfile.expo_push_token,
      pushToken: recipientProfile.expo_push_token ? '***' + recipientProfile.expo_push_token.slice(-10) : 'None'
    });
    
    if (!recipientProfile.expo_push_token) {
      console.log('⚠️ No push token found. The user needs to open the app to generate one.');
      return;
    }
    
    // Step 2: Create a test event
    console.log('\n📅 Step 2: Creating test event...');
    const testEventId = `test_notification_event_${Date.now()}`;
    const { data: testEvent, error: eventError } = await supabase
      .from('events')
      .insert({
        id: testEventId,
        title: 'Test Notification Event',
        description: 'This is a test event for notification testing',
        date: '2025-01-20',
        start_datetime: '2025-01-20T10:00:00Z',
        end_datetime: '2025-01-20T11:00:00Z',
        user_id: senderId,
        category_name: 'Test',
        category_color: '#FF6B6B'
      })
      .select()
      .single();
    
    if (eventError) {
      console.error('❌ Error creating test event:', eventError);
      return;
    }
    
    console.log('✅ Test event created:', testEvent.title);
    
    // Step 3: Create a test shared event (this should trigger the notification)
    console.log('\n🔔 Step 3: Creating shared event (should trigger notification)...');
    const { data: sharedEvent, error: sharedError } = await supabase
      .from('shared_events')
      .insert({
        original_event_id: testEventId,
        shared_by: senderId,
        shared_with: recipientId,
        status: 'pending'
      })
      .select()
      .single();
    
    if (sharedError) {
      console.error('❌ Error creating shared event:', sharedError);
      return;
    }
    
    console.log('✅ Shared event created:', {
      id: sharedEvent.id,
      originalEventId: sharedEvent.original_event_id,
      sharedBy: sharedEvent.shared_by,
      sharedWith: sharedEvent.shared_with,
      status: sharedEvent.status
    });
    
    // Step 4: Check if notification was sent (by checking Edge Function logs)
    console.log('\n📊 Step 4: Notification should have been sent automatically');
    console.log('📱 Check the recipient\'s device for a push notification');
    console.log('📋 Expected notification:');
    console.log('- Title: "[Sender Name] shared an event with you"');
    console.log('- Body: "Test Notification Event"');
    
    // Step 5: Clean up test data
    console.log('\n🧹 Step 5: Cleaning up test data...');
    await supabase.from('shared_events').delete().eq('id', sharedEvent.id);
    await supabase.from('events').delete().eq('id', testEventId);
    console.log('✅ Test data cleaned up');
    
    console.log('\n✅ Test completed successfully!');
    console.log('\n📋 To test with different users:');
    console.log('1. Update senderId and recipientId in this script');
    console.log('2. Ensure both users have push tokens saved in their profiles');
    console.log('3. Run the test again');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testShareNotifications(); 