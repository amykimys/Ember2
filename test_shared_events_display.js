// Test script to verify shared events display
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (replace with your actual credentials)
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSharedEventsDisplay() {
  console.log('🧪 Testing shared events display...');
  
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return;
    }
    
    console.log('✅ User authenticated:', user.id);
    
    // Test 1: Check shared events where user is the owner
    console.log('\n📋 Test 1: Events shared BY the user (owner)');
    const { data: sharedByUser, error: sharedByError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('shared_by', user.id)
      .in('status', ['pending', 'accepted']);
    
    if (sharedByError) {
      console.error('❌ Error fetching events shared by user:', sharedByError);
    } else {
      console.log('✅ Events shared by user:', sharedByUser?.length || 0);
      sharedByUser?.forEach(se => {
        console.log(`  - Event ID: ${se.original_event_id}, Shared with: ${se.shared_with}, Status: ${se.status}`);
      });
    }
    
    // Test 2: Check shared events where user is the recipient
    console.log('\n📋 Test 2: Events shared WITH the user (recipient)');
    const { data: sharedWithUser, error: sharedWithError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('shared_with', user.id)
      .in('status', ['pending', 'accepted']);
    
    if (sharedWithError) {
      console.error('❌ Error fetching events shared with user:', sharedWithError);
    } else {
      console.log('✅ Events shared with user:', sharedWithUser?.length || 0);
      sharedWithUser?.forEach(se => {
        console.log(`  - Event ID: ${se.original_event_id}, Shared by: ${se.shared_by}, Status: ${se.status}`);
      });
    }
    
    // Test 3: Check user's own events
    console.log('\n📋 Test 3: User\'s own events');
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
    
    // Test 4: Check which events should be excluded from regular display
    console.log('\n📋 Test 4: Events that should be excluded from regular display');
    const sharedEventIdsAsRecipient = new Set();
    if (sharedWithUser) {
      sharedWithUser.forEach(se => {
        sharedEventIdsAsRecipient.add(se.original_event_id);
      });
    }
    
    console.log('✅ Event IDs to exclude (user is recipient):', Array.from(sharedEventIdsAsRecipient));
    
    // Test 5: Check filtered events (what should be shown as regular events)
    console.log('\n📋 Test 5: Filtered regular events (excluding shared events where user is recipient)');
    const filteredEvents = (userEvents || []).filter(event => {
      return !sharedEventIdsAsRecipient.has(event.id);
    });
    
    console.log('✅ Filtered regular events:', filteredEvents.length);
    filteredEvents.forEach(event => {
      console.log(`  - Event ID: ${event.id}, Title: ${event.title}, Date: ${event.date}`);
    });
    
    // Test 6: Check shared events that should be displayed
    console.log('\n📋 Test 6: Shared events that should be displayed');
    const allSharedEvents = [...(sharedByUser || []), ...(sharedWithUser || [])];
    console.log('✅ Total shared events to display:', allSharedEvents.length);
    
    // Get original event details for shared events
    const originalEventIds = allSharedEvents.map(se => se.original_event_id);
    if (originalEventIds.length > 0) {
      const { data: originalEvents, error: originalEventsError } = await supabase
        .from('events')
        .select('id, title, date')
        .in('id', originalEventIds);
      
      if (originalEventsError) {
        console.error('❌ Error fetching original events:', originalEventsError);
      } else {
        console.log('✅ Original events for shared events:', originalEvents?.length || 0);
        originalEvents?.forEach(event => {
          const sharedEvent = allSharedEvents.find(se => se.original_event_id === event.id);
          const isOwner = sharedEvent?.shared_by === user.id;
          const isRecipient = sharedEvent?.shared_with === user.id;
          console.log(`  - Event ID: ${event.id}, Title: ${event.title}, Date: ${event.date}`);
          console.log(`    Role: ${isOwner ? 'Owner' : 'Recipient'}, Status: ${sharedEvent?.status}`);
        });
      }
    }
    
    console.log('\n✅ Shared events display test completed!');
    
  } catch (error) {
    console.error('❌ Error in test:', error);
  }
}

// Run the test
testSharedEventsDisplay(); 