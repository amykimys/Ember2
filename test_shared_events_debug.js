// Test script to debug shared events not showing on calendar
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (replace with your actual credentials)
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSharedEventsDebug() {
  console.log('🧪 Debugging shared events not showing on calendar...');
  
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return;
    }
    
    console.log('✅ User authenticated:', user.id);
    
    // Test 1: Check user's own events
    console.log('\n📋 Test 1: User\'s own events');
    const { data: userEvents, error: userEventsError } = await supabase
      .from('events')
      .select('id, title, date, user_id')
      .eq('user_id', user.id);
    
    if (userEventsError) {
      console.error('❌ Error fetching user events:', userEventsError);
    } else {
      console.log('✅ User\'s own events:', userEvents?.length || 0);
      userEvents?.forEach(event => {
        console.log(`  - Event ID: ${event.id}, Title: ${event.title}, Date: ${event.date}`);
      });
    }
    
    // Test 2: Check shared events where user is sender
    console.log('\n📋 Test 2: Shared events where user is sender');
    const { data: sharedAsSender, error: sharedAsSenderError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('shared_by', user.id)
      .in('status', ['pending', 'accepted']);
    
    if (sharedAsSenderError) {
      console.error('❌ Error fetching shared events as sender:', sharedAsSenderError);
    } else {
      console.log('✅ Shared events where user is sender:', sharedAsSender?.length || 0);
      sharedAsSender?.forEach(se => {
        console.log(`  - Shared Event ID: ${se.id}, Original Event ID: ${se.original_event_id}, Status: ${se.status}`);
      });
    }
    
    // Test 3: Check shared events where user is recipient
    console.log('\n📋 Test 3: Shared events where user is recipient');
    const { data: sharedAsRecipient, error: sharedAsRecipientError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('shared_with', user.id)
      .in('status', ['pending', 'accepted']);
    
    if (sharedAsRecipientError) {
      console.error('❌ Error fetching shared events as recipient:', sharedAsRecipientError);
    } else {
      console.log('✅ Shared events where user is recipient:', sharedAsRecipient?.length || 0);
      sharedAsRecipient?.forEach(se => {
        console.log(`  - Shared Event ID: ${se.id}, Original Event ID: ${se.original_event_id}, Status: ${se.status}`);
      });
    }
    
    // Test 4: Simulate fetchSharedEvents function
    console.log('\n📋 Test 4: Simulating fetchSharedEvents function');
    
    // This should return events where user is either sender or recipient
    const { data: allSharedEvents, error: allSharedError } = await supabase
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
    
    if (allSharedError) {
      console.error('❌ Error simulating fetchSharedEvents:', allSharedError);
    } else {
      console.log('✅ All shared events (sender or recipient):', allSharedEvents?.length || 0);
      allSharedEvents?.forEach(se => {
        const isSender = se.shared_by === user.id;
        const isRecipient = se.shared_with === user.id;
        console.log(`  - Shared Event ID: ${se.id}, Original Event ID: ${se.original_event_id}, Status: ${se.status}`);
        console.log(`    Role: ${isSender ? 'Sender' : 'Recipient'}`);
      });
    }
    
    // Test 5: Check which events should be excluded from regular display
    console.log('\n📋 Test 5: Events that should be excluded from regular display');
    
    // Get original event IDs that are shared with the user (as recipient only)
    const sharedOriginalEventIds = new Set();
    if (sharedAsRecipient) {
      sharedAsRecipient.forEach(se => {
        sharedOriginalEventIds.add(se.original_event_id);
      });
    }
    
    console.log('✅ Original event IDs shared with user (as recipient):', Array.from(sharedOriginalEventIds));
    
    // Check if any of the user's own events are in the shared events (as recipient)
    const eventsToExclude = (userEvents || []).filter(event => {
      return sharedOriginalEventIds.has(event.id);
    });
    
    console.log('✅ Events to exclude from regular display:', eventsToExclude.length);
    eventsToExclude.forEach(event => {
      console.log(`  - Event ID: ${event.id}, Title: ${event.title}, Date: ${event.date}`);
    });
    
    // Test 6: Final result - what should be displayed
    console.log('\n📋 Test 6: Final result - what should be displayed');
    
    // User's own events (excluding any that are shared with them as recipient)
    const userOwnEvents = (userEvents || []).filter(event => {
      return !sharedOriginalEventIds.has(event.id);
    });
    
    console.log('✅ User\'s own events to display:', userOwnEvents.length);
    userOwnEvents.forEach(event => {
      console.log(`  - Event ID: ${event.id}, Title: ${event.title}, Date: ${event.date}`);
    });
    
    // Shared events to display (both sent and received)
    console.log('✅ Shared events to display:', allSharedEvents?.length || 0);
    allSharedEvents?.forEach(se => {
      const isSender = se.shared_by === user.id;
      const isRecipient = se.shared_with === user.id;
      console.log(`  - Shared Event ID: ${se.id}, Original Event ID: ${se.original_event_id}, Status: ${se.status}`);
      console.log(`    Role: ${isSender ? 'Sender' : 'Recipient'}`);
    });
    
    // Total events to display
    const totalEventsToDisplay = userOwnEvents.length + (allSharedEvents?.length || 0);
    console.log('✅ Total events to display:', totalEventsToDisplay);
    
    console.log('\n✅ Shared events debug test completed!');
    
  } catch (error) {
    console.error('❌ Error in test:', error);
  }
}

// Run the test
testSharedEventsDebug(); 