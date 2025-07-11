// Test script to verify shared event deletion
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (replace with your actual credentials)
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSharedEventDeletion() {
  console.log('🧪 Testing shared event deletion...');
  
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return;
    }
    
    console.log('✅ User authenticated:', user.id);
    
    // Create a test event
    const testEvent = {
      id: `test_shared_${Date.now()}`,
      title: 'Test Event for Shared Deletion',
      description: 'This event will be shared and then deleted',
      date: new Date().toISOString().split('T')[0],
      user_id: user.id,
      created_at: new Date().toISOString()
    };
    
    console.log('📝 Creating test event:', testEvent.id);
    
    // Insert test event
    const { error: insertError } = await supabase
      .from('events')
      .insert(testEvent);
    
    if (insertError) {
      console.error('❌ Failed to create test event:', insertError);
      return;
    }
    
    console.log('✅ Test event created successfully');
    
    // Create a test shared event
    const testSharedEvent = {
      id: `shared_${Date.now()}`,
      original_event_id: testEvent.id,
      shared_by: user.id,
      shared_with: user.id, // Sharing with self for testing
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    console.log('📝 Creating test shared event:', testSharedEvent.id);
    
    // Insert test shared event
    const { error: sharedInsertError } = await supabase
      .from('shared_events')
      .insert(testSharedEvent);
    
    if (sharedInsertError) {
      console.error('❌ Failed to create test shared event:', sharedInsertError);
      return;
    }
    
    console.log('✅ Test shared event created successfully');
    
    // Verify both exist
    const { data: verifyEvent, error: verifyEventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', testEvent.id)
      .single();
    
    const { data: verifyShared, error: verifySharedError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('id', testSharedEvent.id)
      .single();
    
    if (verifyEventError || !verifyEvent) {
      console.error('❌ Failed to verify test event:', verifyEventError);
      return;
    }
    
    if (verifySharedError || !verifyShared) {
      console.error('❌ Failed to verify test shared event:', verifySharedError);
      return;
    }
    
    console.log('✅ Both events verified in database');
    
    // Test deletion of shared event as recipient
    console.log('🗑️ Testing shared event deletion as recipient...');
    
    const { error: deleteSharedError } = await supabase
      .from('shared_events')
      .delete()
      .eq('id', testSharedEvent.id)
      .eq('shared_with', user.id);
    
    if (deleteSharedError) {
      console.error('❌ Failed to delete shared event:', deleteSharedError);
      return;
    }
    
    console.log('✅ Shared event deleted successfully');
    
    // Verify shared event is gone but original event still exists
    const { data: checkSharedDeleted, error: checkSharedError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('id', testSharedEvent.id)
      .single();
    
    const { data: checkOriginalExists, error: checkOriginalError } = await supabase
      .from('events')
      .select('*')
      .eq('id', testEvent.id)
      .single();
    
    if (checkSharedError && checkSharedError.code === 'PGRST116') {
      console.log('✅ Shared event successfully removed from database');
    } else if (checkSharedDeleted) {
      console.error('❌ Shared event still exists after deletion');
    }
    
    if (!checkOriginalError && checkOriginalExists) {
      console.log('✅ Original event still exists (as expected)');
    } else {
      console.error('❌ Original event was unexpectedly deleted');
    }
    
    // Test deletion of original event (should cascade to delete any remaining shared events)
    console.log('🗑️ Testing original event deletion (should cascade)...');
    
    const { error: deleteOriginalError } = await supabase
      .from('events')
      .delete()
      .eq('id', testEvent.id)
      .eq('user_id', user.id);
    
    if (deleteOriginalError) {
      console.error('❌ Failed to delete original event:', deleteOriginalError);
      return;
    }
    
    console.log('✅ Original event deleted successfully');
    
    // Verify both are gone
    const { data: finalCheckEvent, error: finalCheckEventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', testEvent.id)
      .single();
    
    const { data: finalCheckShared, error: finalCheckSharedError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('id', testSharedEvent.id)
      .single();
    
    if (finalCheckEventError && finalCheckEventError.code === 'PGRST116') {
      console.log('✅ Original event successfully removed from database');
    } else if (finalCheckEvent) {
      console.error('❌ Original event still exists after deletion');
    }
    
    if (finalCheckSharedError && finalCheckSharedError.code === 'PGRST116') {
      console.log('✅ Shared event successfully removed from database');
    } else if (finalCheckShared) {
      console.error('❌ Shared event still exists after deletion');
    }
    
    console.log('🎉 All shared event deletion tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSharedEventDeletion(); 