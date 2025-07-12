const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSharedEventsAuthenticated() {
  console.log('🔍 [Auth Check] Checking shared events with authentication...');
  
  try {
    // First, try to get the current session
    console.log('\n📋 Step 1: Check current session');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      return;
    }
    
    if (!session) {
      console.log('⚠️ No active session found. You need to authenticate first.');
      console.log('Please run this script after you have logged into the app.');
      return;
    }
    
    console.log('✅ Authenticated as user:', session.user.id);
    console.log('✅ User email:', session.user.email);
    
    // Now check shared events with authentication
    console.log('\n📋 Step 2: Check shared events with auth');
    const { data: sharedEvents, error: sharedError } = await supabase
      .from('shared_events')
      .select('*')
      .or(`shared_with.eq.${session.user.id},shared_by.eq.${session.user.id}`);
    
    if (sharedError) {
      console.error('❌ Error fetching shared events:', sharedError);
      return;
    }
    
    console.log(`📊 Shared events found: ${sharedEvents?.length || 0}`);
    
    if (sharedEvents && sharedEvents.length > 0) {
      console.log('\n📋 Shared events details:');
      sharedEvents.forEach((event, index) => {
        console.log(`\n--- Event ${index + 1} ---`);
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
        console.log('Created at:', event.created_at);
        console.log('Is sender:', event.shared_by === session.user.id);
        console.log('Is recipient:', event.shared_with === session.user.id);
      });
    }
    
    // Check pending events specifically
    console.log('\n📋 Step 3: Check pending events');
    const { data: pendingEvents, error: pendingError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('shared_with', session.user.id)
      .eq('status', 'pending');
    
    if (pendingError) {
      console.error('❌ Error fetching pending events:', pendingError);
      return;
    }
    
    console.log(`📊 Pending events for you: ${pendingEvents?.length || 0}`);
    
    if (pendingEvents && pendingEvents.length > 0) {
      console.log('\n📋 Your pending events:');
      pendingEvents.forEach((event, index) => {
        console.log(`\n--- Pending Event ${index + 1} ---`);
        console.log('ID:', event.id);
        console.log('Shared by:', event.shared_by);
        console.log('Has event_data:', !!event.event_data);
        if (event.event_data) {
          console.log('Event title:', event.event_data.title);
          console.log('Event date:', event.event_data.date);
        }
      });
    }
    
    // Check sent events
    console.log('\n📋 Step 4: Check sent events');
    const { data: sentEvents, error: sentError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('shared_by', session.user.id);
    
    if (sentError) {
      console.error('❌ Error fetching sent events:', sentError);
      return;
    }
    
    console.log(`📊 Events you sent: ${sentEvents?.length || 0}`);
    
    console.log('\n✅ Authenticated check completed!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkSharedEventsAuthenticated(); 