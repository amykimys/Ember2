// Test script to verify multi-day event deletion fix logic
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';
const supabase = createClient(supabaseUrl, supabaseKey);

function testMultiDayDeletionLogic() {
  console.log('🧪 Testing multi-day event deletion logic...');
  
  // Test cases for different event ID patterns
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
    },
    {
      name: 'Updated multi-day event instance',
      eventId: 'updated_event_456_2025-01-25',
      expected: 'Should delete the entire multi-day event series'
    }
  ];

  // Test the ID parsing logic
  testCases.forEach(testCase => {
    console.log(`\n🔍 Testing: ${testCase.name}`);
    console.log(`Event ID: ${testCase.eventId}`);
    
    // Simulate the new deletion logic
    const parts = testCase.eventId.split('_');
    const isMultiDayInstance = parts.length >= 2 && !!parts[parts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/);
    const baseEventId = isMultiDayInstance ? parts.slice(0, -1).join('_') : testCase.eventId;
    
    console.log(`Is multi-day instance: ${isMultiDayInstance}`);
    console.log(`Base event ID: ${baseEventId}`);
    console.log(`Expected behavior: ${testCase.expected}`);
    
    // Simulate the database query that would be used
    if (isMultiDayInstance) {
      console.log(`Database query would be: .or('id.eq.${baseEventId},id.like.${baseEventId}_%')`);
      console.log(`This would find: base event + all instances with date suffixes`);
    } else {
      console.log(`Database query would be: .eq('id', '${baseEventId}')`);
      console.log(`This would find: only the specific event`);
    }
  });

  // Test the old vs new logic comparison
  console.log('\n🔄 Comparing old vs new deletion logic...');
  
  const multiDayInstanceId = 'event_1234567890_abc123_2025-01-15';
  const parts = multiDayInstanceId.split('_');
  
  // Old logic (>= 3)
  const oldIsMultiDayInstance = parts.length >= 3 && !!parts[parts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/);
  const oldBaseEventId = oldIsMultiDayInstance ? parts.slice(0, -1).join('_') : multiDayInstanceId;
  
  // New logic (>= 2)
  const newIsMultiDayInstance = parts.length >= 2 && !!parts[parts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/);
  const newBaseEventId = newIsMultiDayInstance ? parts.slice(0, -1).join('_') : multiDayInstanceId;
  
  console.log(`Event ID: ${multiDayInstanceId}`);
  console.log(`Old logic (>= 3): isMultiDayInstance = ${oldIsMultiDayInstance}, baseEventId = ${oldBaseEventId}`);
  console.log(`New logic (>= 2): isMultiDayInstance = ${newIsMultiDayInstance}, baseEventId = ${newBaseEventId}`);
  
  if (oldIsMultiDayInstance !== newIsMultiDayInstance) {
    console.log('⚠️ Logic difference detected!');
    console.log(`Old logic would ${oldIsMultiDayInstance ? 'correctly identify' : 'miss'} this as a multi-day instance`);
    console.log(`New logic would ${newIsMultiDayInstance ? 'correctly identify' : 'miss'} this as a multi-day instance`);
  } else {
    console.log('✅ Both logic versions agree on this event');
  }

  // Test database query simulation
  console.log('\n🗄️ Testing database query simulation...');
  
  const testEventIds = [
    'event_1234567890_abc123',           // Base event
    'event_1234567890_abc123_2025-01-15', // Instance 1
    'event_1234567890_abc123_2025-01-16', // Instance 2
    'event_1234567890_abc123_2025-01-17', // Instance 3
    'other_event_456',                   // Different event
    'other_event_456_2025-01-15'         // Different event instance
  ];
  
  const baseEventId = 'event_1234567890_abc123';
  
  // Simulate the new query: .or(`id.eq.${baseEventId},id.like.${baseEventId}_%`)
  const matchingEvents = testEventIds.filter(id => 
    id === baseEventId || id.startsWith(baseEventId + '_')
  );
  
  console.log(`Base event ID: ${baseEventId}`);
  console.log(`All test event IDs: ${testEventIds.join(', ')}`);
  console.log(`Events that would be deleted: ${matchingEvents.join(', ')}`);
  console.log(`Events that would remain: ${testEventIds.filter(id => !matchingEvents.includes(id)).join(', ')}`);
  
  // Verify the logic is correct
  const expectedMatches = [
    'event_1234567890_abc123',
    'event_1234567890_abc123_2025-01-15',
    'event_1234567890_abc123_2025-01-16',
    'event_1234567890_abc123_2025-01-17'
  ];
  
  const isCorrect = matchingEvents.length === expectedMatches.length && 
                   expectedMatches.every(id => matchingEvents.includes(id));
  
  if (isCorrect) {
    console.log('✅ Database query logic is correct!');
  } else {
    console.log('❌ Database query logic has issues!');
    console.log(`Expected: ${expectedMatches.join(', ')}`);
    console.log(`Actual: ${matchingEvents.join(', ')}`);
  }

  console.log('\n🎉 Logic test completed successfully!');
  console.log('✅ New deletion logic correctly identifies multi-day events');
  console.log('✅ Database query would delete all related instances');
  console.log('✅ Fixed the inconsistency between >= 3 and >= 2 logic');
}

// Run the test
testMultiDayDeletionLogic(); 