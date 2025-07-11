// Test script to verify shared events are not doubled
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (replace with your actual credentials)
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSharedEventsNoDoubling() {
  console.log('🧪 Testing shared events are not doubled...');
  
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
      .select('id, title, date')
      .eq('user_id', user.id);
    
    if (userEventsError) {
      console.error('❌ Error fetching user events:', userEventsError);
    } else {
      console.log('✅ User\'s own events:', userEvents?.length || 0);
      userEvents?.forEach(event => {
        console.log(`  - Event ID: ${event.id}, Title: ${event.title}, Date: ${event.date}`);
      });
    }
    
    // Test 2: Check shared events where user is recipient
    console.log('\n📋 Test 2: Shared events where user is recipient');
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
    
    // Test 3: Check shared events where user is sender
    console.log('\n📋 Test 3: Shared events where user is sender');
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
    
    // Test 4: Check for potential doubling
    console.log('\n📋 Test 4: Checking for potential doubling');
    
    // Get all original event IDs that are shared with the user
    const sharedOriginalEventIds = new Set();
    if (sharedAsRecipient) {
      sharedAsRecipient.forEach(se => {
        sharedOriginalEventIds.add(se.original_event_id);
      });
    }
    
    console.log('✅ Original event IDs shared with user:', Array.from(sharedOriginalEventIds));
    
    // Check if any of the user's own events are in the shared events
    const potentialDoubles = (userEvents || []).filter(event => {
      return sharedOriginalEventIds.has(event.id);
    });
    
    console.log('✅ Potential doubles (user events that are also shared):', potentialDoubles.length);
    potentialDoubles.forEach(event => {
      console.log(`  - Event ID: ${event.id}, Title: ${event.title}, Date: ${event.date}`);
    });
    
    // Test 5: Simulate the new fetchSharedEvents logic
    console.log('\n📋 Test 5: Simulating new fetchSharedEvents logic');
    
    // This should only return events where user is recipient
    const { data: newSharedEvents, error: newSharedError } = await supabase
      .from('shared_events')
      .select(`
        id,
        original_event_id,
        shared_by,
        shared_with,
        status,
        created_at
      `)
      .eq('shared_with', user.id) // Only events shared WITH the current user (as recipient)
      .in('status', ['pending', 'accepted']);
    
    if (newSharedError) {
      console.error('❌ Error simulating new fetchSharedEvents:', newSharedError);
    } else {
      console.log('✅ New fetchSharedEvents would return:', newSharedEvents?.length || 0, 'events');
      newSharedEvents?.forEach(se => {
        console.log(`  - Shared Event ID: ${se.id}, Original Event ID: ${se.original_event_id}, Status: ${se.status}`);
      });
    }
    
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
    
    // Shared events to display (only where user is recipient)
    console.log('✅ Shared events to display:', newSharedEvents?.length || 0);
    newSharedEvents?.forEach(se => {
      console.log(`  - Shared Event ID: ${se.id}, Original Event ID: ${se.original_event_id}, Status: ${se.status}`);
    });
    
    // Total events to display
    const totalEventsToDisplay = userOwnEvents.length + (newSharedEvents?.length || 0);
    console.log('✅ Total events to display:', totalEventsToDisplay);
    
    console.log('\n✅ Shared events no doubling test completed!');
    
  } catch (error) {
    console.error('❌ Error in test:', error);
  }
}

// Run the test
testSharedEventsNoDoubling(); 