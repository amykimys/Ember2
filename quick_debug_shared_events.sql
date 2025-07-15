-- =====================================================
-- QUICK DEBUG: CHECK SHARED EVENTS STATUS
-- =====================================================

-- 1. Check if event_data column exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'shared_events' 
            AND column_name = 'event_data'
        ) THEN 'EXISTS' 
        ELSE 'MISSING' 
    END as event_data_column_status;

-- 2. Check recent shared events
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
LIMIT 5;

-- 3. Check if there are any shared events for a specific user
-- Replace 'USER_ID_HERE' with your friend's user ID
SELECT 
    COUNT(*) as total_shared_events,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_events,
    COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_events,
    COUNT(CASE WHEN event_data IS NOT NULL THEN 1 END) as events_with_data
FROM shared_events
WHERE shared_with = 'USER_ID_HERE';  -- Replace with friend's user ID

-- 4. Check if the original events exist
SELECT 
    se.id as shared_event_id,
    se.original_event_id,
    se.status,
    CASE WHEN e.id IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as original_event_status,
    e.title as original_event_title
FROM shared_events se
LEFT JOIN events e ON e.id = se.original_event_id
ORDER BY se.created_at DESC
LIMIT 10;

-- 5. Quick fix: Add event_data column if it doesn't exist
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

-- 6. Update existing shared events with event_data
UPDATE shared_events 
SET event_data = (
  SELECT jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'description', e.description,
    'location', e.location,
    'date', e.date,
    'start_datetime', e.start_datetime,
    'end_datetime', e.end_datetime,
    'category_name', e.category_name,
    'category_color', e.category_color,
    'is_all_day', e.is_all_day,
    'photos', COALESCE(e.photos, ARRAY[]::text[])
  )
  FROM events e
  WHERE e.id = shared_events.original_event_id
)
WHERE event_data IS NULL 
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = shared_events.original_event_id
  );

-- 7. Check the results after the fix
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
ORDER BY created_at DESC
LIMIT 5; 