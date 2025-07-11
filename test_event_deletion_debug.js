// Test script to debug event deletion issues
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (replace with your actual credentials)
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testEventDeletionDebug() {
  console.log('🧪 Testing event deletion debug...');
  
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return;
    }
    
    console.log('✅ User authenticated:', user.id);
    
    // Test the deletion logic with different event ID patterns
    const testCases = [
      {
        name: 'Regular single event',
        eventId: 'event_1234567890_abc123',
        expected: 'Should delete only this specific event'
      },
      {
        name: 'Multi-day event instance',
        eventId: 'event_1234567890_abc123_2025-01-15',
        expected: 'Should delete the entire multi-day event series'
      },
      {
        name: 'Another multi-day event instance',
        eventId: 'event_123_2025-01-20',
        expected: 'Should delete the entire multi-day event series'
      }
    ];

    // Test the ID parsing logic
    testCases.forEach(testCase => {
      console.log(`\n🔍 Testing: ${testCase.name}`);
      console.log(`Event ID: ${testCase.eventId}`);
      
      // Simulate the deletion logic
      const parts = testCase.eventId.split('_');
      const isMultiDayInstance = parts.length >= 3 && parts[parts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/);
      const baseEventId = isMultiDayInstance ? parts.slice(0, -1).join('_') : testCase.eventId;
      
      console.log(`Is multi-day instance: ${isMultiDayInstance}`);
      console.log(`Base event ID: ${baseEventId}`);
      console.log(`Expected behavior: ${testCase.expected}`);
    });

    // Test actual database deletion
    console.log('\n🗑️ Testing actual database deletion...');
    
    // Create a test event
    const testEvent = {
      id: `test_debug_${Date.now()}`,
      title: 'Test Event for Deletion Debug',
      description: 'This event will be deleted for debugging',
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
    
    // Verify event exists
    const { data: verifyEvent, error: verifyError } = await supabase
      .from('events')
      .select('*')
      .eq('id', testEvent.id)
      .single();
    
    if (verifyError || !verifyEvent) {
      console.error('❌ Failed to verify test event:', verifyError);
      return;
    }
    
    console.log('✅ Test event verified in database');
    
    // Test the deletion with detailed logging
    console.log('🗑️ Testing deletion with detailed logging...');
    
    // Simulate the exact deletion logic from the app
    const eventId = testEvent.id;
    const userId = user.id;
    
    console.log(`🗑️ [Delete Regular] Deleting event: ${eventId}`);
    
    // Check if this is a multi-day event instance
    const parts = eventId.split('_');
    const isMultiDayInstance = parts.length >= 3 && parts[parts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/);
    const baseEventId = isMultiDayInstance ? parts.slice(0, -1).join('_') : eventId;
    
    console.log(`🗑️ [Delete Regular] Is multi-day instance: ${isMultiDayInstance}`);
    console.log(`🗑️ [Delete Regular] Base event ID: ${baseEventId}`);
    
    // Delete shared events first
    console.log('🗑️ [Delete Base] Deleting shared events first...');
    const { error: sharedError } = await supabase
      .from('shared_events')
      .delete()
      .eq('original_event_id', baseEventId);

    if (sharedError) {
      console.warn('🗑️ [Delete Base] Error deleting shared events:', sharedError);
    } else {
      console.log('✅ Shared events deleted (or none existed)');
    }

    // Delete the main event
    console.log('🗑️ [Delete Base] Deleting main event...');
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('id', baseEventId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('❌ [Delete Base] Database deletion failed:', deleteError);
      return;
    }

    console.log('✅ [Delete Base] Base event deleted successfully');
    
    // Verify event is gone
    const { data: checkDeleted, error: checkError } = await supabase
      .from('events')
      .select('*')
      .eq('id', testEvent.id)
      .single();
    
    if (checkError && checkError.code === 'PGRST116') {
      console.log('✅ Event successfully removed from database');
    } else if (checkDeleted) {
      console.error('❌ Event still exists in database after deletion');
    } else {
      console.log('✅ Event successfully removed from database');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testEventDeletionDebug(); 