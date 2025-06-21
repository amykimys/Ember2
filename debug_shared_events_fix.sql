-- =====================================================
-- DEBUG AND FIX SHARED EVENTS ISSUE
-- =====================================================

-- 1. Check what events exist in the events table
SELECT 
    id,
    title,
    date,
    user_id,
    created_at
FROM events 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Check the specific events that should be linked to shared_events
SELECT 
    'c2bd5cae-7b24-4651-a7b7-b8c31045e789' as expected_id,
    CASE WHEN EXISTS (SELECT 1 FROM events WHERE id = 'c2bd5cae-7b24-4651-a7b7-b8c31045e789') 
         THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
    'event_1750447256.484652_589051' as expected_id,
    CASE WHEN EXISTS (SELECT 1 FROM events WHERE id = 'event_1750447256.484652_589051') 
         THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
    'test_event_1750448190.899450' as expected_id,
    CASE WHEN EXISTS (SELECT 1 FROM events WHERE id = 'test_event_1750448190.899450') 
         THEN 'EXISTS' ELSE 'MISSING' END as status;

-- 3. Create a proper test event for January 15, 2025
INSERT INTO events (
    id,
    user_id,
    title,
    description,
    date,
    start_datetime,
    end_datetime,
    category_name,
    category_color,
    is_all_day,
    created_at
) VALUES (
    'jan15_test_event_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    'bc7c0bbd-f252-448d-885b-27f69c180ee6',  -- The user who shared the events
    'January 15 Test Event',
    'This event should appear on January 15, 2025',
    '2025-01-15',
    '2025-01-15T10:00:00Z',
    '2025-01-15T11:00:00Z',
    'Test',
    '#FF6B6B',
    false,
    NOW()
);

-- 4. Share this new event with you
INSERT INTO shared_events (
    original_event_id,
    shared_by,
    shared_with,
    status,
    created_at,
    updated_at
) VALUES (
    'jan15_test_event_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    'bc7c0bbd-f252-448d-885b-27f69c180ee6',  -- The user who shared
    'cf77e7d5-5743-46d5-add9-de9a1db64fd4',  -- Your user ID
    'pending',
    NOW(),
    NOW()
);

-- 5. Verify the new shared event
SELECT 
    se.id as shared_event_id,
    se.original_event_id,
    se.shared_by,
    se.shared_with,
    se.status,
    e.id as event_id,
    e.title,
    e.date,
    e.start_datetime
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
WHERE se.shared_with = 'cf77e7d5-5743-46d5-add9-de9a1db64fd4'
  AND e.date = '2025-01-15'
ORDER BY se.created_at DESC;

-- 6. Clean up old broken shared events (optional - uncomment if you want to remove them)
-- DELETE FROM shared_events 
-- WHERE original_event_id IN (
--     'c2bd5cae-7b24-4651-a7b7-b8c31045e789',
--     'event_1750447256.484652_589051',
--     'test_event_1750448190.899450'
-- ); 