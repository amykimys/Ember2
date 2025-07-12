// Test multi-day event edit modal final fix
const testMultiDayFinalFix = () => {
  console.log('🧪 Testing multi-day event edit modal final fix...');
  
  // Mock events state with multi-day event instances
  const mockEvents = {
    '2025-01-15': [
      {
        id: 'original-event-123_2025-01-15',
        title: 'Multi-Day Event',
        date: '2025-01-15',
        startDateTime: new Date('2025-01-15T12:00:00Z'),
        endDateTime: new Date('2025-01-15T12:00:00Z'),
        isAllDay: true
      }
    ],
    '2025-01-16': [
      {
        id: 'original-event-123_2025-01-16',
        title: 'Multi-Day Event',
        date: '2025-01-16',
        startDateTime: new Date('2025-01-16T12:00:00Z'),
        endDateTime: new Date('2025-01-16T12:00:00Z'),
        isAllDay: true
      }
    ],
    '2025-01-17': [
      {
        id: 'original-event-123_2025-01-17',
        title: 'Multi-Day Event',
        date: '2025-01-17',
        startDateTime: new Date('2025-01-17T12:00:00Z'),
        endDateTime: new Date('2025-01-17T12:00:00Z'),
        isAllDay: true
      }
    ]
  };
  
  // Mock originalEvents state
  const mockOriginalEvents = {
    'original-event-123': {
      id: 'original-event-123',
      title: 'Multi-Day Event',
      date: '2025-01-15',
      startDateTime: new Date('2025-01-15T12:00:00Z'),
      endDateTime: new Date('2025-01-17T12:00:00Z'),
      isAllDay: true
    }
  };
  
  // Mock the getOriginalMultiDayDates function
  const getOriginalMultiDayDates = (event, events, originalEvents) => {
    // Check if this is a multi-day event instance (ID contains date suffix)
    const eventParts = event.id.split('_');
    const eventIsMultiDayInstance = eventParts.length >= 3 && !!eventParts[eventParts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/);
    
    console.log('🔍 Debug:', {
      eventId: event.id,
      eventParts,
      eventIsMultiDayInstance,
      lastPart: eventParts[eventParts.length - 1]
    });
    
    if (eventIsMultiDayInstance) {
      // This is a multi-day event instance, extract the base event ID
      const baseEventId = eventParts.slice(0, -1).join('_');
      console.log('🔍 Base event ID:', baseEventId);
      
      // Find the original event in the events state
      for (const dateKey in events) {
        const dayEvents = events[dateKey];
        for (const dayEvent of dayEvents) {
          // Check if this is the original event (not an instance)
          if (dayEvent.id === baseEventId && !dayEvent.id.match(/_\d{4}-\d{2}-\d{2}$/)) {
            if (dayEvent.startDateTime && dayEvent.endDateTime) {
              return {
                startDate: new Date(dayEvent.startDateTime),
                endDate: new Date(dayEvent.endDateTime)
              };
            }
          }
        }
      }
      
      // If not found in events, check originalEvents
      console.log('🔍 Checking originalEvents for:', baseEventId);
      console.log('🔍 Available keys in originalEvents:', Object.keys(originalEvents));
      if (originalEvents[baseEventId]) {
        const orig = originalEvents[baseEventId];
        if (orig.startDateTime && orig.endDateTime) {
          return { startDate: new Date(orig.startDateTime), endDate: new Date(orig.endDateTime) };
        }
      }
    }
    
    return null;
  };
  
  // Mock the getLocalDateForEdit function
  const getLocalDateForEdit = (date, isAllDay = false) => {
    if (!date) return undefined;
    
    if (isAllDay) {
      // For all-day events, create a local date from the UTC date
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      return new Date(year, month, day);
    } else {
      // For non-all-day events, use the date as is
      return new Date(date);
    }
  };
  
  // Test case 1: Multi-day event instance (should show original dates from originalEvents)
  const multiDayInstance = mockEvents['2025-01-16'][0];
  console.log('📅 Testing multi-day event instance:', multiDayInstance.id);
  
  const originalDates = getOriginalMultiDayDates(multiDayInstance, mockEvents, mockOriginalEvents);
  console.log('🔍 Original dates found:', originalDates);
  
  if (originalDates) {
    const startDateToUse = originalDates.startDate;
    const endDateToUse = originalDates.endDate;
    
    const editedStartDateTime = getLocalDateForEdit(startDateToUse, multiDayInstance.isAllDay);
    const editedEndDateTime = getLocalDateForEdit(endDateToUse, multiDayInstance.isAllDay);
    
    console.log('📅 Instance dates:', {
      start: multiDayInstance.startDateTime.toISOString(),
      end: multiDayInstance.endDateTime.toISOString()
    });
    
    console.log('📅 Original dates from originalEvents:', {
      start: startDateToUse.toISOString(),
      end: endDateToUse.toISOString()
    });
    
    console.log('📅 Edit modal dates:', {
      start: editedStartDateTime?.toISOString(),
      end: editedEndDateTime?.toISOString()
    });
    
    // Verify that edit modal shows original dates, not instance dates
    const expectedStartDate = new Date('2025-01-15T00:00:00.000Z');
    const expectedEndDate = new Date('2025-01-17T00:00:00.000Z');
    
    if (editedStartDateTime?.getTime() === expectedStartDate.getTime() && 
        editedEndDateTime?.getTime() === expectedEndDate.getTime()) {
      console.log('✅ SUCCESS: Edit modal shows original multi-day event dates from originalEvents');
    } else {
      console.log('❌ FAILED: Edit modal shows wrong dates');
      console.log('Expected:', {
        start: expectedStartDate.toISOString(),
        end: expectedEndDate.toISOString()
      });
      console.log('Actual:', {
        start: editedStartDateTime?.toISOString(),
        end: editedEndDateTime?.toISOString()
      });
    }
  } else {
    console.log('❌ FAILED: Could not find original dates for multi-day event instance');
  }
  
  // Test case 2: Regular event (should show instance dates)
  const regularEvent = {
    id: 'regular-event-456',
    title: 'Regular Event',
    date: '2025-01-15',
    startDateTime: new Date('2025-01-15T10:00:00Z'),
    endDateTime: new Date('2025-01-15T11:00:00Z'),
    isAllDay: false
  };
  
  console.log('\n📅 Testing regular event:', regularEvent.id);
  
  const regularOriginalDates = getOriginalMultiDayDates(regularEvent, mockEvents, mockOriginalEvents);
  console.log('🔍 Original dates found:', regularOriginalDates);
  
  const regularStartDateToUse = regularOriginalDates ? regularOriginalDates.startDate : regularEvent.startDateTime;
  const regularEndDateToUse = regularOriginalDates ? regularOriginalDates.endDate : regularEvent.endDateTime;
  
  const regularEditedStartDateTime = getLocalDateForEdit(regularStartDateToUse, regularEvent.isAllDay);
  const regularEditedEndDateTime = getLocalDateForEdit(regularEndDateToUse, regularEvent.isAllDay);
  
  console.log('📅 Regular event edit modal dates:', {
    start: regularEditedStartDateTime?.toISOString(),
    end: regularEditedEndDateTime?.toISOString()
  });
  
  // Verify that regular events show their own dates
  if (regularEditedStartDateTime?.getTime() === regularEvent.startDateTime.getTime() && 
      regularEditedEndDateTime?.getTime() === regularEvent.endDateTime.getTime()) {
    console.log('✅ SUCCESS: Regular event shows its own dates');
  } else {
    console.log('❌ FAILED: Regular event shows wrong dates');
  }
  
  console.log('\n🎉 Test completed!');
};

// Run the test
testMultiDayFinalFix(); 