# Shared Event Notifications Implementation

## Current Issue
The accept/deny functionality is currently shown as small icons within the shared event boxes, which can be hard to see and use.

## Proposed Solution
Replace the icon-based accept/deny with a notification banner system.

## Changes Needed

### 1. Remove Accept/Deny Icons from Event Boxes

**In `app/(tabs)/calendar.tsx`, around lines 1875-1895:**

Remove this section from the compact view:
```tsx
{event.sharedStatus === 'pending' && (
  <View style={{ flexDirection: 'row', marginTop: 3, gap: 3 }}>
    <TouchableOpacity
      onPress={() => acceptSharedEventUtil(event)}
      style={{
        backgroundColor: '#34C759',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 2
      }}
    >
      <Ionicons name="checkmark" size={6} color="white" />
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => declineSharedEventUtil(event)}
      style={{
        backgroundColor: '#FF3B30',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 2
      }}
    >
      <Ionicons name="close" size={6} color="white" />
    </TouchableOpacity>
  </View>
)}
```

**Around lines 1975-1995:**

Remove this section from the expanded view:
```tsx
{event.isShared && event.sharedStatus === 'pending' && (
  <View style={{ flexDirection: 'row', marginTop: 4, gap: 6 }}>
    <TouchableOpacity
      onPress={() => acceptSharedEventUtil(event)}
      style={{
        backgroundColor: '#34C759',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4
      }}
    >
      <Ionicons name="checkmark" size={12} color="white" />
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => declineSharedEventUtil(event)}
      style={{
        backgroundColor: '#FF3B30',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4
      }}
    >
      <Ionicons name="close" size={12} color="white" />
    </TouchableOpacity>
  </View>
)}
```

### 2. Add Notification Banner

**After the header row (around line 3050):**

Add this notification banner:
```tsx
{/* Shared Event Notifications */}
{(() => {
  const pendingEvents = Object.values(events)
    .flat()
    .filter(event => event.isShared && event.sharedStatus === 'pending');
  
  if (pendingEvents.length > 0) {
    return (
      <View style={{
        backgroundColor: '#FF9500',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>
            {pendingEvents.length} shared event{pendingEvents.length > 1 ? 's' : ''} pending
          </Text>
          <Text style={{ color: 'white', fontSize: 12, marginTop: 2 }}>
            Tap to review and accept/decline
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            // Show a modal with all pending events
            Alert.alert(
              'Pending Shared Events',
              pendingEvents.map(event => 
                `${event.title} (${event.sharedByFullName || event.sharedByUsername})`
              ).join('\n'),
              [
                { text: 'Review All', onPress: () => {
                  // Navigate to first pending event or show a list
                  if (pendingEvents.length > 0) {
                    const firstEvent = pendingEvents[0];
                    const eventDate = new Date(firstEvent.date);
                    setSelectedDate(eventDate);
                    setIsMonthCompact(false);
                  }
                }},
                { text: 'Dismiss', style: 'cancel' }
              ]
            );
          }}
          style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 6
          }}
        >
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>
            Review
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
  return null;
})()}
```

## Benefits

1. **More Prominent**: The notification banner is much more visible than small icons
2. **Better UX**: Users can see all pending events at once
3. **Cleaner Design**: Event boxes are cleaner without the small icons
4. **Centralized**: All shared event actions are in one place

## Alternative Approach

If you prefer to keep the accept/deny functionality within the event boxes, you could:

1. Make the icons larger and more prominent
2. Add text labels next to the icons
3. Use a different visual style (like a badge or pill)

## Implementation Steps

1. Remove the accept/deny icon sections from both compact and expanded views
2. Add the notification banner after the header
3. Test with the shared event from the test script
4. Verify the notification appears when there are pending shared events
5. Test the "Review" button functionality 