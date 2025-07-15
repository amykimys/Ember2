-- =====================================================
-- DEBUG: WHY FRIEND DIDN'T RECEIVE SHARED EVENT
-- =====================================================

-- 1. Check if the event_data column exists (this was the main issue)
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'shared_events' 
  AND column_name = 'event_data';

-- 2. Check recent shared events to see what's happening
SELECT 
    id,
    original_event_id,
    shared_by,
    shared_with,
    status,
    event_data IS NOT NULL as has_event_data,
    created_at,
    message
FROM shared_events
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check if there are any shared events for your friend specifically
-- Replace 'YOUR_FRIEND_USER_ID' with your friend's actual user ID
SELECT 
    id,
    original_event_id,
    shared_by,
    shared_with,
    status,
    event_data IS NOT NULL as has_event_data,
    event_data->>'title' as event_title,
    created_at
FROM shared_events
WHERE shared_with = 'YOUR_FRIEND_USER_ID'  -- Replace with friend's user ID
ORDER BY created_at DESC;

-- 4. Check if the original events exist for the shared events
SELECT 
    se.id as shared_event_id,
    se.original_event_id,
    se.status,
    se.event_data IS NOT NULL as has_event_data,
    e.id as event_exists,
    e.title as event_title,
    e.date as event_date
FROM shared_events se
LEFT JOIN events e ON e.id = se.original_event_id
ORDER BY se.created_at DESC
LIMIT 10;

-- 5. Check if there are any RLS policy issues
-- Temporarily disable RLS to see all data
ALTER TABLE shared_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

-- Check all shared events without RLS
SELECT 
    id,
    original_event_id,
    shared_by,
    shared_with,
    status,
    event_data IS NOT NULL as has_event_data,
    created_at
FROM shared_events
ORDER BY created_at DESC
LIMIT 10;

-- Re-enable RLS
ALTER TABLE shared_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 6. Check if the friendship exists between you and your friend
-- Replace 'YOUR_USER_ID' and 'YOUR_FRIEND_USER_ID' with actual IDs
SELECT 
    id,
    user_id,
    friend_id,
    status,
    created_at
FROM friendships
WHERE (user_id = 'YOUR_USER_ID' AND friend_id = 'YOUR_FRIEND_USER_ID')
   OR (user_id = 'YOUR_FRIEND_USER_ID' AND friend_id = 'YOUR_USER_ID');

-- 7. Check if your friend has push notifications enabled
-- Replace 'YOUR_FRIEND_USER_ID' with friend's user ID
SELECT 
    id,
    username,
    full_name,
    expo_push_token IS NOT NULL as has_push_token,
    expo_push_token
FROM profiles
WHERE id = 'YOUR_FRIEND_USER_ID';

-- 8. Test creating a shared event manually to see if it works
-- First, create a test event
INSERT INTO events (
    id,
    user_id,
    title,
    description,
    location,
    date,
    start_datetime,
    end_datetime,
    category_name,
    category_color,
    is_all_day,
    created_at
) VALUES (
    'debug_test_event_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    'YOUR_USER_ID',  -- Replace with your user ID
    'Debug Test Event',
    'This is a test event to debug sharing',
    'Test Location',
    '2025-01-20',
    '2025-01-20T10:00:00Z',
    '2025-01-20T11:00:00Z',
    'Test',
    '#00BCD4',
    false,
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Then create a shared event
INSERT INTO shared_events (
    original_event_id,
    shared_by,
    shared_with,
    status,
    message,
    event_data,
    created_at,
    updated_at
) VALUES (
    'debug_test_event_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    'YOUR_USER_ID',  -- Replace with your user ID
    'YOUR_FRIEND_USER_ID',  -- Replace with friend's user ID
    'pending',
    'Debug test - please check if you receive this',
    jsonb_build_object(
        'id', 'debug_test_event_' || EXTRACT(EPOCH FROM NOW())::TEXT,
        'title', 'Debug Test Event',
        'description', 'This is a test event to debug sharing',
        'location', 'Test Location',
        'date', '2025-01-20',
        'start_datetime', '2025-01-20T10:00:00Z',
        'end_datetime', '2025-01-20T11:00:00Z',
        'category_name', 'Test',
        'category_color', '#00BCD4',
        'is_all_day', false,
        'photos', ARRAY[]::text[]
    ),
    NOW(),
    NOW()
) ON CONFLICT (original_event_id, shared_by, shared_with) DO NOTHING;

-- 9. Verify the test shared event was created
SELECT 
    id,
    original_event_id,
    shared_by,
    shared_with,
    status,
    event_data IS NOT NULL as has_event_data,
    event_data->>'title' as event_title,
    created_at
FROM shared_events
WHERE original_event_id LIKE 'debug_test_event_%'
ORDER BY created_at DESC;

-- 10. Check what your friend should see
SELECT 
    'shared_' || id as event_id,
    event_data->>'title' as title,
    event_data->>'description' as description,
    event_data->>'date' as date,
    status as shared_status,
    created_at
FROM shared_events
WHERE shared_with = 'YOUR_FRIEND_USER_ID'  -- Replace with friend's user ID
  AND status = 'pending'
  AND event_data IS NOT NULL
ORDER BY created_at DESC;

-- Clean up test data (uncomment to remove)
/*
DELETE FROM shared_events WHERE original_event_id LIKE 'debug_test_event_%';
DELETE FROM events WHERE id LIKE 'debug_test_event_%';
*/ 