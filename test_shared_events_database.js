// Test script to check shared events in the database
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (you'll need to add your credentials)
const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSharedEventsDatabase() {
  console.log('🔍 [Test] Testing shared events database...');
  
  try {
    // Query all shared events without authentication
    const { data: allSharedEvents, error: allError } = await supabase
      .from('shared_events')
      .select('*');
    
    if (allError) {
      console.error('❌ [Test] Error querying all shared events:', allError);
      return;
    }
    
    console.log('✅ [Test] All shared events in database:', allSharedEvents);
    console.log(`📊 [Test] Total shared events: ${allSharedEvents?.length || 0}`);
    
    if (allSharedEvents && allSharedEvents.length > 0) {
      console.log('\n📋 [Test] Shared events details:');
      allSharedEvents.forEach((event, index) => {
        console.log(`\n--- Event ${index + 1} ---`);
        console.log('ID:', event.id);
        console.log('Status:', event.status);
        console.log('Shared by:', event.shared_by);
        console.log('Shared with:', event.shared_with);
        console.log('Event data:', event.event_data);
        console.log('Created at:', event.created_at);
      });
    }
    
    // Query pending shared events specifically
    const { data: pendingEvents, error: pendingError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('status', 'pending');
    
    if (pendingError) {
      console.error('❌ [Test] Error querying pending events:', pendingError);
      return;
    }
    
    console.log('\n✅ [Test] Pending shared events:', pendingEvents);
    console.log(`📊 [Test] Total pending events: ${pendingEvents?.length || 0}`);
    
  } catch (error) {
    console.error('❌ [Test] Unexpected error:', error);
  }
}

testSharedEventsDatabase(); 