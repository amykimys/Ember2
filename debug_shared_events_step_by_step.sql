-- =====================================================
-- COMPREHENSIVE SHARED EVENTS DEBUG
-- =====================================================

-- Step 1: Check if event_data column exists
SELECT 
    'Step 1: Checking event_data column' as step,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'shared_events' 
            AND column_name = 'event_data'
        ) THEN '✅ event_data column EXISTS' 
        ELSE '❌ event_data column MISSING' 
    END as result;

-- Step 2: Add event_data column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shared_events' 
        AND column_name = 'event_data'
    ) THEN
        ALTER TABLE shared_events ADD COLUMN event_data JSONB;
        RAISE NOTICE 'Added event_data column to shared_events table';
    ELSE
        RAISE NOTICE 'event_data column already exists';
    END IF;
END $$;

-- Step 3: Check all recent shared events
SELECT 
    'Step 3: Recent shared events' as step,
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

-- Step 4: Check if there are any events in the events table
SELECT 
    'Step 4: Recent events' as step,
    COUNT(*) as total_events,
    MAX(created_at) as latest_event
FROM events;

-- Step 5: Check if there are any pending shared events
SELECT 
    'Step 5: Pending shared events' as step,
    COUNT(*) as pending_count
FROM shared_events 
WHERE status = 'pending';

-- Step 6: Check if there are any shared events for a specific user
-- Replace 'FRIEND_USER_ID_HERE' with your friend's actual user ID
SELECT 
    'Step 6: Shared events for friend' as step,
    id,
    original_event_id,
    shared_by,
    shared_with,
    status,
    event_data IS NOT NULL as has_event_data,
    created_at
FROM shared_events
WHERE shared_with = 'FRIEND_USER_ID_HERE'  -- Replace with actual friend's user ID
ORDER BY created_at DESC;

-- Step 7: Check if the original event exists for shared events
SELECT 
    'Step 7: Shared events with missing original events' as step,
    se.id as shared_event_id,
    se.original_event_id,
    se.shared_by,
    se.shared_with,
    se.status,
    e.id as event_exists
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
WHERE e.id IS NULL
ORDER BY se.created_at DESC;

-- Step 8: Show all users to help identify friend's user ID
SELECT 
    'Step 8: All users (to find friend ID)' as step,
    id,
    username,
    full_name,
    email,
    created_at
FROM auth.users
ORDER BY created_at DESC; 