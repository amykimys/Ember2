const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSharedEvents() {
  console.log('🔍 [Debug] Starting shared events debug...');
  
  try {
    // First, let's see what's in the shared_events table
    console.log('\n📋 Step 1: Check all shared events in database');
    const { data: allSharedEvents, error: allError } = await supabase
      .from('shared_events')
      .select('*');
    
    if (allError) {
      console.error('❌ Error querying shared events:', allError);
      return;
    }
    
    console.log('✅ All shared events:', allSharedEvents);
    console.log(`📊 Total shared events: ${allSharedEvents?.length || 0}`);
    
    if (allSharedEvents && allSharedEvents.length > 0) {
      console.log('\n📋 Shared events details:');
      allSharedEvents.forEach((event, index) => {
        console.log(`\n--- Event ${index + 1} ---`);
        console.log('ID:', event.id);
        console.log('Status:', event.status);
        console.log('Shared by:', event.shared_by);
        console.log('Shared with:', event.shared_with);
        console.log('Has event_data:', !!event.event_data);
        console.log('Event data keys:', event.event_data ? Object.keys(event.event_data) : 'None');
        console.log('Created at:', event.created_at);
      });
    }
    
    // Step 2: Check for pending events specifically
    console.log('\n📋 Step 2: Check pending shared events');
    const { data: pendingEvents, error: pendingError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('status', 'pending');
    
    if (pendingError) {
      console.error('❌ Error querying pending events:', pendingError);
      return;
    }
    
    console.log('✅ Pending shared events:', pendingEvents);
    console.log(`📊 Total pending events: ${pendingEvents?.length || 0}`);
    
    // Step 3: Simulate the fetchPendingSharedEvents function
    if (pendingEvents && pendingEvents.length > 0) {
      console.log('\n📋 Step 3: Simulate fetchPendingSharedEvents function');
      
      // Get the first pending event's shared_with user ID
      const testUserId = pendingEvents[0].shared_with;
      console.log('🔍 Testing with user ID:', testUserId);
      
      // Simulate the exact query from fetchPendingSharedEvents
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
        .eq('shared_with', testUserId)
        .eq('status', 'pending');
      
      if (simulatedError) {
        console.error('❌ Error in simulated query:', simulatedError);
        return;
      }
      
      console.log('✅ Simulated query result:', simulatedData);
      console.log(`📊 Simulated query count: ${simulatedData?.length || 0}`);
      
      // Step 4: Check if event_data exists and has required fields
      if (simulatedData && simulatedData.length > 0) {
        console.log('\n📋 Step 4: Check event_data structure');
        simulatedData.forEach((event, index) => {
          console.log(`\n--- Event ${index + 1} ---`);
          console.log('Has event_data:', !!event.event_data);
          if (event.event_data) {
            console.log('Event data keys:', Object.keys(event.event_data));
            console.log('Title:', event.event_data.title);
            console.log('Date:', event.event_data.date);
            console.log('Has required fields:', {
              hasTitle: !!event.event_data.title,
              hasDate: !!event.event_data.date,
              hasId: !!event.event_data.id
            });
          }
        });
      }
      
      // Step 5: Check profiles
      console.log('\n📋 Step 5: Check profiles');
      const userIds = pendingEvents.map(se => se.shared_by);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds);
      
      if (profilesError) {
        console.error('❌ Error fetching profiles:', profilesError);
      } else {
        console.log('✅ Profiles found:', profilesData);
        console.log(`📊 Profiles count: ${profilesData?.length || 0}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

debugSharedEvents(); 