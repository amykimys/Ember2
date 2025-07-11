// Comprehensive debug script for shared events not showing
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (replace with your actual credentials)
const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSharedEventsNotShowing() {
  console.log('🔍 Comprehensive debug: Shared events not showing...');
  
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return;
    }
    
    console.log('✅ User authenticated:', user.id);
    
    // Test 1: Check if shared_events table exists and is accessible
    console.log('\n📋 Test 1: Check shared_events table accessibility');
    try {
      const { data: tableCheck, error: tableError } = await supabase
        .from('shared_events')
        .select('count')
        .limit(1);
      
      if (tableError) {
        console.error('❌ Shared events table not accessible:', tableError);
        return;
      } else {
        console.log('✅ Shared events table is accessible');
      }
    } catch (error) {
      console.error('❌ Error checking shared_events table:', error);
      return;
    }
    
    // Test 2: Check if there are any shared events at all
    console.log('\n📋 Test 2: Check for any shared events');
    const { data: allSharedEvents, error: allSharedError } = await supabase
      .from('shared_events')
      .select('*');
    
    if (allSharedError) {
      console.error('❌ Error fetching all shared events:', allSharedError);
    } else {
      console.log('✅ Total shared events in database:', allSharedEvents?.length || 0);
      if (allSharedEvents && allSharedEvents.length > 0) {
        console.log('  Sample shared events:');
        allSharedEvents.slice(0, 3).forEach(se => {
          console.log(`    - ID: ${se.id}, Original Event: ${se.original_event_id}, Status: ${se.status}`);
        });
      }
    }
    
    // Test 3: Check shared events involving current user
    console.log('\n📋 Test 3: Check shared events involving current user');
    const { data: userSharedEvents, error: userSharedError } = await supabase
      .from('shared_events')
      .select('*')
      .or(`shared_with.eq.${user.id},shared_by.eq.${user.id}`);
    
    if (userSharedError) {
      console.error('❌ Error fetching user shared events:', userSharedError);
    } else {
      console.log('✅ Shared events involving current user:', userSharedEvents?.length || 0);
      userSharedEvents?.forEach(se => {
        const isSender = se.shared_by === user.id;
        const isRecipient = se.shared_with === user.id;
        console.log(`    - ID: ${se.id}, Original Event: ${se.original_event_id}, Status: ${se.status}`);
        console.log(`      Role: ${isSender ? 'Sender' : 'Recipient'}`);
      });
    }
    
    // Test 4: Check if the original events exist
    console.log('\n📋 Test 4: Check if original events exist');
    if (userSharedEvents && userSharedEvents.length > 0) {
      const originalEventIds = userSharedEvents.map(se => se.original_event_id);
      console.log('✅ Original event IDs to check:', originalEventIds);
      
      const { data: originalEvents, error: originalEventsError } = await supabase
        .from('events')
        .select('id, title, date, user_id')
        .in('id', originalEventIds);
      
      if (originalEventsError) {
        console.error('❌ Error fetching original events:', originalEventsError);
      } else {
        console.log('✅ Original events found:', originalEvents?.length || 0);
        originalEvents?.forEach(event => {
          console.log(`    - ID: ${event.id}, Title: ${event.title}, Date: ${event.date}, Owner: ${event.user_id}`);
        });
      }
    }
    
    // Test 5: Simulate the exact fetchSharedEvents function
    console.log('\n📋 Test 5: Simulate fetchSharedEvents function');
    
    // Step 1: Fetch shared events
    const { data: sharedEventsData, error: step1Error } = await supabase
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
    
    if (step1Error) {
      console.error('❌ Step 1 failed:', step1Error);
      return;
    }
    
    console.log('✅ Step 1 - Shared events data:', sharedEventsData?.length || 0);
    
    if (!sharedEventsData || sharedEventsData.length === 0) {
      console.log('⚠️ No shared events found - this is why they\'re not showing!');
      return;
    }
    
    // Step 2: Extract original event IDs
    const originalEventIds = sharedEventsData.map(se => se.original_event_id);
    console.log('✅ Step 2 - Original event IDs:', originalEventIds);
    
    // Step 3: Fetch original events
    const { data: eventsData, error: step3Error } = await supabase
      .from('events')
      .select(`
        id,
        title,
        description,
        location,
        date,
        start_datetime,
        end_datetime,
        category_name,
        category_color,
        is_all_day,
        photos
      `)
      .in('id', originalEventIds);
    
    if (step3Error) {
      console.error('❌ Step 3 failed:', step3Error);
      return;
    }
    
    console.log('✅ Step 3 - Original events found:', eventsData?.length || 0);
    
    // Step 4: Check if events were found
    if (!eventsData || eventsData.length === 0) {
      console.error('❌ No original events found - this is the problem!');
      console.log('🔍 Original event IDs that were searched:', originalEventIds);
      return;
    }
    
    // Step 5: Check user profiles
    const allUserIds = new Set();
    sharedEventsData.forEach(se => {
      allUserIds.add(se.shared_by);
      allUserIds.add(se.shared_with);
    });
    
    const { data: profilesData, error: step5Error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', Array.from(allUserIds));
    
    if (step5Error) {
      console.error('❌ Step 5 failed:', step5Error);
    } else {
      console.log('✅ Step 5 - Profiles found:', profilesData?.length || 0);
    }
    
    // Step 6: Simulate transformation
    console.log('\n📋 Test 6: Simulate event transformation');
    
    const eventsMap = new Map();
    if (eventsData) {
      eventsData.forEach(event => {
        eventsMap.set(event.id, event);
      });
    }
    
    const profilesMap = new Map();
    if (profilesData) {
      profilesData.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });
    }
    
    const transformedEvents = sharedEventsData
      .filter(sharedEvent => {
        const originalEvent = eventsMap.get(sharedEvent.original_event_id);
        if (!originalEvent) {
          console.log(`❌ Original event not found for shared event ${sharedEvent.id}: ${sharedEvent.original_event_id}`);
          return false;
        }
        return true;
      })
      .map(sharedEvent => {
        const event = eventsMap.get(sharedEvent.original_event_id);
        const profileToShow = profilesMap.get(sharedEvent.shared_by);
        
        return {
          id: `shared_${sharedEvent.id}`,
          title: event.title || 'Untitled Event',
          date: event.date,
          isShared: true,
          sharedBy: sharedEvent.shared_by,
          sharedByUsername: profileToShow?.username || 'Unknown',
          sharedByFullName: profileToShow?.full_name || 'Unknown User',
          sharedStatus: sharedEvent.status,
        };
      });
    
    console.log('✅ Step 6 - Transformed events:', transformedEvents.length);
    transformedEvents.forEach(event => {
      console.log(`    - ID: ${event.id}, Title: ${event.title}, Date: ${event.date}, Status: ${event.sharedStatus}`);
    });
    
    // Test 7: Check if events would be added to calendar
    console.log('\n📋 Test 7: Check calendar date assignment');
    
    const eventsByDate = {};
    transformedEvents.forEach(event => {
      if (!eventsByDate[event.date]) {
        eventsByDate[event.date] = [];
      }
      eventsByDate[event.date].push(event);
    });
    
    console.log('✅ Events by date:');
    Object.keys(eventsByDate).forEach(date => {
      console.log(`    ${date}: ${eventsByDate[date].length} events`);
      eventsByDate[date].forEach(event => {
        console.log(`      - ${event.title} (${event.sharedStatus})`);
      });
    });
    
    console.log('\n✅ Debug completed!');
    
    if (transformedEvents.length === 0) {
      console.log('❌ CONCLUSION: No shared events were transformed - this is why they\'re not showing!');
    } else {
      console.log('✅ CONCLUSION: Shared events should be showing. Check the calendar rendering logic.');
    }
    
  } catch (error) {
    console.error('❌ Error in debug:', error);
  }
}

// Run the debug
debugSharedEventsNotShowing(); 