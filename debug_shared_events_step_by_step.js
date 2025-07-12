const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSharedEventsStepByStep() {
  console.log('🔍 [Debug] Starting comprehensive shared events debug...');
  
  try {
    // Step 1: Check if we can access the shared_events table at all
    console.log('\n📋 Step 1: Check table access');
    const { data: tableCheck, error: tableError } = await supabase
      .from('shared_events')
      .select('count')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Cannot access shared_events table:', tableError);
      return;
    }
    console.log('✅ Can access shared_events table');
    
    // Step 2: Check all shared events (without RLS filtering)
    console.log('\n📋 Step 2: Check all shared events (raw)');
    const { data: allEvents, error: allError } = await supabase
      .from('shared_events')
      .select('*');
    
    if (allError) {
      console.error('❌ Error fetching all events:', allError);
      return;
    }
    
    console.log(`📊 Total shared events in table: ${allEvents?.length || 0}`);
    
    if (allEvents && allEvents.length > 0) {
      console.log('\n📋 All shared events details:');
      allEvents.forEach((event, index) => {
        console.log(`\n--- Event ${index + 1} ---`);
        console.log('ID:', event.id);
        console.log('Status:', event.status);
        console.log('Shared by:', event.shared_by);
        console.log('Shared with:', event.shared_with);
        console.log('Has event_data:', !!event.event_data);
        console.log('Event data keys:', event.event_data ? Object.keys(event.event_data) : 'None');
        if (event.event_data) {
          console.log('Event title:', event.event_data.title);
          console.log('Event date:', event.event_data.date);
        }
        console.log('Created at:', event.created_at);
      });
    }
    
    // Step 3: Check for pending events specifically
    console.log('\n📋 Step 3: Check pending events');
    const { data: pendingEvents, error: pendingError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('status', 'pending');
    
    if (pendingError) {
      console.error('❌ Error fetching pending events:', pendingError);
      return;
    }
    
    console.log(`📊 Pending events: ${pendingEvents?.length || 0}`);
    
    // Step 4: Check for your specific user ID
    const yourUserId = 'cf77e7d5-5743-46d5-add9-de9a1db64fd4';
    console.log(`\n📋 Step 4: Check events for your user ID: ${yourUserId}`);
    
    // Check events where you are the recipient
    const { data: receivedEvents, error: receivedError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('shared_with', yourUserId);
    
    if (receivedError) {
      console.error('❌ Error fetching received events:', receivedError);
      return;
    }
    
    console.log(`📊 Events where you are recipient: ${receivedEvents?.length || 0}`);
    
    // Check events where you are the sender
    const { data: sentEvents, error: sentError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('shared_by', yourUserId);
    
    if (sentError) {
      console.error('❌ Error fetching sent events:', sentError);
      return;
    }
    
    console.log(`📊 Events where you are sender: ${sentEvents?.length || 0}`);
    
    // Step 5: Check pending events for your user ID
    console.log(`\n📋 Step 5: Check pending events for your user ID`);
    const { data: yourPendingEvents, error: yourPendingError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('shared_with', yourUserId)
      .eq('status', 'pending');
    
    if (yourPendingError) {
      console.error('❌ Error fetching your pending events:', yourPendingError);
      return;
    }
    
    console.log(`📊 Your pending events: ${yourPendingEvents?.length || 0}`);
    
    if (yourPendingEvents && yourPendingEvents.length > 0) {
      console.log('\n📋 Your pending events details:');
      yourPendingEvents.forEach((event, index) => {
        console.log(`\n--- Your Pending Event ${index + 1} ---`);
        console.log('ID:', event.id);
        console.log('Status:', event.status);
        console.log('Shared by:', event.shared_by);
        console.log('Shared with:', event.shared_with);
        console.log('Has event_data:', !!event.event_data);
        if (event.event_data) {
          console.log('Event title:', event.event_data.title);
          console.log('Event date:', event.event_data.date);
          console.log('Event data keys:', Object.keys(event.event_data));
        }
      });
    }
    
    // Step 6: Simulate the exact query from fetchPendingSharedEvents
    console.log(`\n📋 Step 6: Simulate fetchPendingSharedEvents query`);
    const { data: simulatedData, error: simulatedError } = await supabase
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
      .eq('shared_with', yourUserId)
      .eq('status', 'pending');
    
    if (simulatedError) {
      console.error('❌ Error in simulated query:', simulatedError);
      return;
    }
    
    console.log(`📊 Simulated query result: ${simulatedData?.length || 0}`);
    console.log('✅ Simulated data:', simulatedData);
    
    // Step 7: Check if event_data has required fields
    if (simulatedData && simulatedData.length > 0) {
      console.log('\n📋 Step 7: Check event_data structure');
      simulatedData.forEach((event, index) => {
        console.log(`\n--- Event ${index + 1} event_data check ---`);
        if (event.event_data) {
          const requiredFields = ['title', 'date', 'id'];
          const missingFields = requiredFields.filter(field => !event.event_data[field]);
          console.log('Has all required fields:', missingFields.length === 0);
          if (missingFields.length > 0) {
            console.log('Missing fields:', missingFields);
          }
          console.log('Event data keys:', Object.keys(event.event_data));
        } else {
          console.log('❌ No event_data found');
        }
      });
    }
    
    // Step 8: Check profiles
    console.log('\n📋 Step 8: Check profiles');
    if (allEvents && allEvents.length > 0) {
      const userIds = [...new Set(allEvents.map(se => se.shared_by))];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds);
      
      if (profilesError) {
        console.error('❌ Error fetching profiles:', profilesError);
      } else {
        console.log('✅ Profiles found:', profilesData?.length || 0);
        console.log('Profile IDs:', profilesData?.map(p => p.id) || []);
      }
    }
    
    console.log('\n✅ Debug completed!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

debugSharedEventsStepByStep(); 