-- Temporarily disable RLS to see all data
ALTER TABLE shared_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

-- Check all shared events
SELECT 
    id,
    original_event_id,
    shared_by,
    shared_with,
    status,
    created_at,
    event_data IS NOT NULL as has_event_data,
    CASE 
        WHEN event_data IS NOT NULL THEN 'Has data'
        ELSE 'No data'
    END as event_data_status
FROM shared_events
ORDER BY created_at DESC;

-- Check all events
SELECT 
    id,
    title,
    date,
    user_id,
    created_at
FROM events
ORDER BY created_at DESC
LIMIT 10;

-- Check specific user's shared events
SELECT 
    id,
    original_event_id,
    shared_by,
    shared_with,
    status,
    created_at,
    event_data IS NOT NULL as has_event_data
FROM shared_events
WHERE shared_with = 'cf77e7d5-5743-46d5-add9-de9a1db64fd4'
   OR shared_by = 'cf77e7d5-5743-46d5-add9-de9a1db64fd4'
ORDER BY created_at DESC;

-- Check event_data structure for one event (if any exist)
SELECT 
    id,
    event_data
FROM shared_events
WHERE event_data IS NOT NULL
LIMIT 1;

-- Re-enable RLS after checking
ALTER TABLE shared_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY; 