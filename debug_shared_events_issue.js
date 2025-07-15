// Debug Shared Events Issue
// Run this in your browser console or as a Node.js script

import { createClient } from '@supabase/supabase-js';

// Replace with your actual Supabase URL and anon key
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSharedEvents() {
  console.log('🔍 [Debug] Starting shared events diagnostic...');
  
  try {
    // 1. Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ [Debug] User not authenticated:', userError);
      return;
    }
    console.log('✅ [Debug] User authenticated:', user.id);
    
    // 2. Check if shared_events table has event_data column
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'shared_events')
      .eq('column_name', 'event_data');
    
    if (columnsError) {
      console.error('❌ [Debug] Error checking columns:', columnsError);
    } else {
      console.log('📋 [Debug] event_data column exists:', columns.length > 0);
      if (columns.length > 0) {
        console.log('📋 [Debug] event_data column type:', columns[0].data_type);
      }
    }
    
    // 3. Check existing shared events
    const { data: sharedEvents, error: sharedError } = await supabase
      .from('shared_events')
      .select('*')
      .or(`shared_with.eq.${user.id},shared_by.eq.${user.id}`)
      .limit(5);
    
    if (sharedError) {
      console.error('❌ [Debug] Error fetching shared events:', sharedError);
    } else {
      console.log('📋 [Debug] Found shared events:', sharedEvents.length);
      sharedEvents.forEach((se, index) => {
        console.log(`📋 [Debug] Shared event ${index + 1}:`, {
          id: se.id,
          original_event_id: se.original_event_id,
          shared_by: se.shared_by,
          shared_with: se.shared_with,
          status: se.status,
          has_event_data: !!se.event_data,
          created_at: se.created_at
        });
      });
    }
    
    // 4. Test creating a shared event
    console.log('🔍 [Debug] Testing shared event creation...');
    
    const testEventData = {
      id: `test_debug_event_${Date.now()}`,
      title: 'Debug Test Event',
      description: 'This is a test event for debugging',
      location: 'Test Location',
      date: '2025-01-20',
      startDateTime: '2025-01-20T10:00:00Z',
      endDateTime: '2025-01-20T11:00:00Z',
      categoryName: 'Test',
      categoryColor: '#00BCD4',
      isAllDay: false,
      photos: []
    };
    
    // Try to create a shared event
    const { data: newSharedEvent, error: createError } = await supabase
      .from('shared_events')
      .insert({
        original_event_id: testEventData.id,
        shared_by: user.id,
        shared_with: user.id, // Share with self for testing
        status: 'pending',
        message: 'Debug test',
        event_data: {
          id: testEventData.id,
          title: testEventData.title,
          description: testEventData.description,
          location: testEventData.location,
          date: testEventData.date,
          start_datetime: testEventData.startDateTime,
          end_datetime: testEventData.endDateTime,
          category_name: testEventData.categoryName,
          category_color: testEventData.categoryColor,
          is_all_day: testEventData.isAllDay,
          photos: testEventData.photos
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (createError) {
      console.error('❌ [Debug] Error creating shared event:', createError);
      console.error('❌ [Debug] Error details:', {
        code: createError.code,
        message: createError.message,
        details: createError.details,
        hint: createError.hint
      });
    } else {
      console.log('✅ [Debug] Successfully created shared event:', newSharedEvent);
    }
    
    // 5. Test fetching pending shared events
    console.log('🔍 [Debug] Testing fetchPendingSharedEvents...');
    
    const { data: pendingEvents, error: pendingError } = await supabase
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
      .eq('shared_with', user.id)
      .eq('status', 'pending');
    
    if (pendingError) {
      console.error('❌ [Debug] Error fetching pending events:', pendingError);
    } else {
      console.log('✅ [Debug] Found pending events:', pendingEvents.length);
      pendingEvents.forEach((event, index) => {
        console.log(`📋 [Debug] Pending event ${index + 1}:`, {
          id: event.id,
          title: event.event_data?.title || 'No title',
          has_event_data: !!event.event_data,
          shared_by: event.shared_by
        });
      });
    }
    
    // 6. Clean up test data
    if (newSharedEvent) {
      const { error: deleteError } = await supabase
        .from('shared_events')
        .delete()
        .eq('id', newSharedEvent.id);
      
      if (deleteError) {
        console.error('❌ [Debug] Error cleaning up test data:', deleteError);
      } else {
        console.log('✅ [Debug] Test data cleaned up');
      }
    }
    
    console.log('🔍 [Debug] Diagnostic completed');
    
  } catch (error) {
    console.error('❌ [Debug] Unexpected error:', error);
  }
}

// Run the diagnostic
debugSharedEvents(); 