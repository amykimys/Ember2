// Simple test script for event deletion
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (replace with your actual credentials)
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testEventDeletion() {
  console.log('🧪 Testing event deletion...');
  
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
      id: `test_${Date.now()}`,
      title: 'Test Event for Deletion',
      description: 'This event will be deleted',
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
    
    // Delete the test event
    console.log('🗑️ Deleting test event...');
    
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('id', testEvent.id)
      .eq('user_id', user.id);
    
    if (deleteError) {
      console.error('❌ Failed to delete test event:', deleteError);
      return;
    }
    
    console.log('✅ Test event deleted successfully');
    
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
testEventDeletion(); 