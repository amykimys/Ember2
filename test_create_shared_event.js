const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';
const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestSharedEvent() {
  console.log('🔍 [Test] Creating test shared event...');
  
  try {
    // First, let's see what users exist in the profiles table
    console.log('\n📋 Step 1: Check available users');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name')
      .limit(5);
    
    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      return;
    }
    
    console.log('✅ Available profiles:', profiles);
    
    if (!profiles || profiles.length === 0) {
      console.log('❌ No profiles found. Cannot create shared event.');
      return;
    }
    
    // Use the first profile as the sender and second as recipient (if available)
    const senderId = profiles[0].id;
    const recipientId = profiles.length > 1 ? profiles[1].id : profiles[0].id;
    
    console.log('🔍 Using sender ID:', senderId);
    console.log('🔍 Using recipient ID:', recipientId);
    
    // Create a test shared event
    const testEventData = {
      id: `test-event-${Date.now()}`,
      title: 'Test Shared Event',
      description: 'This is a test shared event',
      location: 'Test Location',
      date: '2025-07-15',
      start_datetime: '2025-07-15T10:00:00.000Z',
      end_datetime: '2025-07-15T11:00:00.000Z',
      category_name: 'Test Category',
      category_color: '#FF6B6B',
      is_all_day: false,
      photos: []
    };
    
    console.log('\n📋 Step 2: Creating shared event');
    const { data: sharedEvent, error: createError } = await supabase
      .from('shared_events')
      .insert({
        original_event_id: testEventData.id,
        shared_by: senderId,
        shared_with: recipientId,
        status: 'pending',
        message: 'Test shared event message',
        event_data: testEventData
      })
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Error creating shared event:', createError);
      return;
    }
    
    console.log('✅ Created shared event:', sharedEvent);
    
    // Verify it was created
    console.log('\n📋 Step 3: Verifying shared event was created');
    const { data: verifyData, error: verifyError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('id', sharedEvent.id);
    
    if (verifyError) {
      console.error('❌ Error verifying shared event:', verifyError);
      return;
    }
    
    console.log('✅ Verification result:', verifyData);
    
    // Test the fetchPendingSharedEvents query
    console.log('\n📋 Step 4: Testing fetchPendingSharedEvents query');
    const { data: pendingData, error: pendingError } = await supabase
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
      .eq('shared_with', recipientId)
      .eq('status', 'pending');
    
    if (pendingError) {
      console.error('❌ Error in pending query:', pendingError);
      return;
    }
    
    console.log('✅ Pending query result:', pendingData);
    console.log(`📊 Pending events count: ${pendingData?.length || 0}`);
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createTestSharedEvent(); 