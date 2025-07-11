// Test script for multi-day event deletion logic
console.log('🧪 Testing multi-day event deletion logic...');

// Test cases for different event ID scenarios
const testCases = [
  {
    name: 'Single event',
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
    name: 'Shared event',
    eventId: 'shared_event_456789',
    expected: 'Should handle shared event deletion'
  }
];

// Simulate the new deletion logic
function testMultiDayDeletion(eventId) {
  console.log(`\n🔍 Testing: ${eventId}`);
  
  // Check if it's a shared event
  if (eventId.startsWith('shared_')) {
    console.log('✅ Identified as shared event');
    return 'shared';
  }
  
  // Check if it's a multi-day event instance by looking for date pattern
  const parts = eventId.split('_');
  const isMultiDayInstance = parts.length >= 3 && parts[parts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/);
  
  if (isMultiDayInstance) {
    const baseEventId = parts.slice(0, -1).join('_');
    const dateKey = parts[parts.length - 1];
    console.log('✅ Identified as multi-day event instance');
    console.log(`   Base event ID: ${baseEventId}`);
    console.log(`   Date key: ${dateKey}`);
    console.log(`   Action: Will delete entire multi-day series`);
    return 'multi_day_instance';
  }
  
  // Single event
  console.log('✅ Identified as single event');
  console.log(`   Action: Will delete only this event`);
  return 'single';
}

// Run tests
testCases.forEach(testCase => {
  console.log(`\n📋 Test: ${testCase.name}`);
  console.log(`Expected: ${testCase.expected}`);
  const result = testMultiDayDeletion(testCase.eventId);
  console.log(`Result: ${result}`);
});

console.log('\n✅ Multi-day event deletion logic test completed!'); 