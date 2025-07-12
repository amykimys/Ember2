const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSentPendingDisplay() {
  console.log('🧪 Testing sent pending events display on calendar...\n');

  try {
    // 1. Check if there are any sent pending shared events
    const { data: sentPendingEvents, error: sentError } = await supabase
      .from('shared_events')
      .select(`
        id,
        original_event_id,
        shared_by,
        shared_with,
        status,
        created_at,
        event_data
      `)
      .eq('status', 'pending');

    if (sentError) {
      console.error('❌ Error fetching sent pending events:', sentError);
      return;
    }

    console.log(`📊 Found ${sentPendingEvents?.length || 0} pending shared events total`);

    if (!sentPendingEvents || sentPendingEvents.length === 0) {
      console.log('ℹ️  No pending shared events found. Create a shared event first to test this functionality.');
      return;
    }

    // 2. Check which ones are sent by the current user (you would need to replace with actual user ID)
    const currentUserId = 'your-user-id'; // Replace with actual user ID
    const sentByCurrentUser = sentPendingEvents.filter(event => event.shared_by === currentUserId);
    
    console.log(`📤 Events sent by current user: ${sentByCurrentUser.length}`);
    
    sentByCurrentUser.forEach((event, index) => {
      console.log(`\n📤 Sent Event ${index + 1}:`);
      console.log(`   - ID: ${event.id}`);
      console.log(`   - Status: ${event.status}`);
      console.log(`   - Shared with: ${event.shared_with}`);
      console.log(`   - Event data exists: ${!!event.event_data}`);
      
      if (event.event_data) {
        console.log(`   - Event title: ${event.event_data.title}`);
        console.log(`   - Event date: ${event.event_data.date}`);
      }
    });

    // 3. Check which ones are received by the current user
    const receivedByCurrentUser = sentPendingEvents.filter(event => event.shared_with === currentUserId);
    
    console.log(`\n📥 Events received by current user: ${receivedByCurrentUser.length}`);
    
    receivedByCurrentUser.forEach((event, index) => {
      console.log(`\n📥 Received Event ${index + 1}:`);
      console.log(`   - ID: ${event.id}`);
      console.log(`   - Status: ${event.status}`);
      console.log(`   - Shared by: ${event.shared_by}`);
      console.log(`   - Event data exists: ${!!event.event_data}`);
      
      if (event.event_data) {
        console.log(`   - Event title: ${event.event_data.title}`);
        console.log(`   - Event date: ${event.event_data.date}`);
      }
    });

    // 4. Summary
    console.log('\n📋 SUMMARY:');
    console.log(`   - Total pending events: ${sentPendingEvents.length}`);
    console.log(`   - Sent by current user: ${sentByCurrentUser.length} (should show on calendar with pending design)`);
    console.log(`   - Received by current user: ${receivedByCurrentUser.length} (should NOT show on calendar)`);
    
    if (sentByCurrentUser.length > 0) {
      console.log('\n✅ Expected behavior:');
      console.log('   - Sent pending events should appear on your calendar with:');
      console.log('     * Orange color (#FF9800)');
      console.log('     * Blue border and text for pending status');
      console.log('     * "Pending" indicator');
    }

    if (receivedByCurrentUser.length > 0) {
      console.log('\n✅ Expected behavior:');
      console.log('   - Received pending events should NOT appear on your calendar');
      console.log('   - They should only show in the shared events modal');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSentPendingDisplay(); 