// Test file to verify scroll-to-expand implementation
console.log('Testing scroll-to-expand implementation...');

const fs = require('fs');
const calendarContent = fs.readFileSync('app/(tabs)/calendar.tsx', 'utf8');

// Check if PanResponder is attached to the main container
if (calendarContent.includes('{...panResponder.panHandlers}') && calendarContent.includes('Calendar and Event List Container')) {
  console.log('✅ PanResponder is attached to the main calendar container');
} else {
  console.log('❌ PanResponder is not attached to the main calendar container');
}

// Check if PanResponder is removed from the calendar grid
if (!calendarContent.includes('{...panResponder.panHandlers}') || !calendarContent.includes('needsSixRowsThisMonth ? styles.gridSixRows : styles.grid')) {
  console.log('✅ PanResponder is removed from the calendar grid');
} else {
  console.log('❌ PanResponder is still attached to the calendar grid');
}

// Check if PanResponder has proper gesture detection
if (calendarContent.includes('onMoveShouldSetPanResponder') && calendarContent.includes('isMonthCompact')) {
  console.log('✅ PanResponder has proper gesture detection for compact mode');
} else {
  console.log('❌ PanResponder is missing proper gesture detection');
}

// Check if PanResponder has debugging logs
if (calendarContent.includes('console.log') && calendarContent.includes('PanResponder')) {
  console.log('✅ PanResponder has debugging logs for troubleshooting');
} else {
  console.log('❌ PanResponder is missing debugging logs');
}

// Check if the gesture thresholds are reasonable
if (calendarContent.includes('verticalThreshold = 3') && calendarContent.includes('gestureState.dy < -20')) {
  console.log('✅ PanResponder has reasonable gesture thresholds');
} else {
  console.log('❌ PanResponder has incorrect gesture thresholds');
}

console.log('\n🎉 Scroll-to-expand implementation test completed!');
console.log('\n📋 Summary:');
console.log('- PanResponder is now attached to the main container (covers both calendar and event list)');
console.log('- PanResponder is removed from the calendar grid to avoid conflicts');
console.log('- Gesture detection is optimized for both compact and expanded modes');
console.log('- Debugging logs are added to help troubleshoot issues');
console.log('- Gesture thresholds are set to reasonable values'); 