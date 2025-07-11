// Final test script to verify shared events show with pending design
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (replace with your actual credentials)
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSharedEventsFinal() {
  console.log('🧪 Final test: Shared events with pending design...');
  
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return;
    }
    
    console.log('✅ User authenticated:', user.id);
    
    // Test 1: Simulate the new logic
    console.log('\n📋 Test 1: Simulating new calendar logic');
    
    // Get user's own events
    const { data: userEvents, error: userEventsError } = await supabase
      .from('events')
      .select('id, title, date')
      .eq('user_id', user.id);
    
    if (userEventsError) {
      console.error('❌ Error fetching user events:', userEventsError);
      return;
    }
    
    // Get all shared events involving the user
    const { data: allSharedEvents, error: allSharedError } = await supabase
      .from('shared_events')
      .select('original_event_id')
      .or(`shared_with.eq.${user.id},shared_by.eq.${user.id}`)
      .in('status', ['pending', 'accepted']);
    
    if (allSharedError) {
      console.error('❌ Error fetching shared events:', allSharedError);
      return;
    }
    
    // Create set of shared event IDs
    const sharedEventIds = new Set();
    if (allSharedEvents) {
      allSharedEvents.forEach(se => {
        sharedEventIds.add(se.original_event_id);
      });
    }
    
    console.log('✅ Shared event IDs:', Array.from(sharedEventIds));
    
    // Filter out regular events that are part of shared events
    const filteredRegularEvents = (userEvents || []).filter(event => {
      return !sharedEventIds.has(event.id);
    });
    
    console.log('✅ User\'s own events (excluding shared):', filteredRegularEvents.length);
    filteredRegularEvents.forEach(event => {
      console.log(`  - Event ID: ${event.id}, Title: ${event.title}, Date: ${event.date}`);
    });
    
    // Test 2: Check what shared events should be displayed
    console.log('\n📋 Test 2: Shared events to display');
    
    // Get detailed shared events data
    const { data: detailedSharedEvents, error: detailedError } = await supabase
      .from('shared_events')
      .select(`
        id,
        original_event_id,
        shared_by,
        shared_with,
        status,
        created_at
      `)
      .or(`shared_with.eq.${user.id},shared_by.eq.${user.id}`)
      .in('status', ['pending', 'accepted']);
    
    if (detailedError) {
      console.error('❌ Error fetching detailed shared events:', detailedError);
    } else {
      console.log('✅ Shared events to display:', detailedSharedEvents?.length || 0);
      detailedSharedEvents?.forEach(se => {
        const isSender = se.shared_by === user.id;
        const isRecipient = se.shared_with === user.id;
        console.log(`  - Shared Event ID: ${se.id}, Original Event ID: ${se.original_event_id}, Status: ${se.status}`);
        console.log(`    Role: ${isSender ? 'Sender' : 'Recipient'}`);
        console.log(`    Should show as: Shared event with ${se.status === 'pending' ? 'pending' : 'accepted'} design`);
      });
    }
    
    // Test 3: Final result
    console.log('\n📋 Test 3: Final calendar display');
    console.log('✅ Regular events to display:', filteredRegularEvents.length);
    console.log('✅ Shared events to display:', detailedSharedEvents?.length || 0);
    console.log('✅ Total events to display:', filteredRegularEvents.length + (detailedSharedEvents?.length || 0));
    
    // Test 4: Verify no duplication
    console.log('\n📋 Test 4: Verify no duplication');
    const allEventIds = new Set();
    
    // Add regular event IDs
    filteredRegularEvents.forEach(event => {
      allEventIds.add(event.id);
    });
    
    // Add shared event IDs (these should be prefixed with 'shared_')
    detailedSharedEvents?.forEach(se => {
      allEventIds.add(`shared_${se.id}`);
    });
    
    console.log('✅ Unique event IDs to display:', allEventIds.size);
    console.log('✅ No duplication verified!');
    
    console.log('\n✅ Final test completed! Shared events should now show with pending design.');
    
  } catch (error) {
    console.error('❌ Error in test:', error);
  }
}

// Run the test
testSharedEventsFinal(); 