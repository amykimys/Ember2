-- =====================================================
-- TEST AND FIX SHARED EVENTS ISSUE
-- =====================================================

-- 1. First, add the missing event_data column to shared_events table
ALTER TABLE shared_events 
ADD COLUMN IF NOT EXISTS event_data JSONB;

-- Add comment to explain the column
COMMENT ON COLUMN shared_events.event_data IS 'JSON object containing event data for pending shared events';

-- Create an index for better performance when querying event_data
CREATE INDEX IF NOT EXISTS idx_shared_events_event_data ON shared_events USING GIN (event_data);

-- 2. Update existing shared events to have event_data if they don't have it
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

-- 3. Verify the column was added
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'shared_events' 
  AND column_name = 'event_data';

-- 4. Check current shared events
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

-- 5. Test creating a new shared event with event_data
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
    'test_fix_event_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    'bc7c0bbd-f252-448d-885b-27f69c180ee6',  -- Test user ID
    'Test Fix Event',
    'This event tests the fixed sharing functionality',
    'Test Location',
    '2025-01-20',
    '2025-01-20T14:00:00Z',
    '2025-01-20T15:00:00Z',
    'Test',
    '#00BCD4',
    false,
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 6. Create a shared event with event_data
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
    'test_fix_event_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    'bc7c0bbd-f252-448d-885b-27f69c180ee6',  -- Test user ID
    'cf77e7d5-5743-46d5-add9-de9a1db64fd4',  -- Your user ID
    'pending',
    'Testing the fixed sharing functionality',
    jsonb_build_object(
        'id', 'test_fix_event_' || EXTRACT(EPOCH FROM NOW())::TEXT,
        'title', 'Test Fix Event',
        'description', 'This event tests the fixed sharing functionality',
        'location', 'Test Location',
        'date', '2025-01-20',
        'start_datetime', '2025-01-20T14:00:00Z',
        'end_datetime', '2025-01-20T15:00:00Z',
        'category_name', 'Test',
        'category_color', '#00BCD4',
        'is_all_day', false,
        'photos', '[]'::jsonb
    ),
    NOW(),
    NOW()
) ON CONFLICT (original_event_id, shared_by, shared_with) DO NOTHING;

-- 7. Verify the new shared event was created with event_data
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
WHERE original_event_id LIKE 'test_fix_event_%'
ORDER BY created_at DESC
LIMIT 5;

-- 8. Test querying pending shared events (simulates what the app does)
SELECT 
    'shared_' || id as event_id,
    event_data->>'title' as title,
    event_data->>'description' as description,
    event_data->>'date' as date,
    event_data->>'start_datetime' as start_datetime,
    event_data->>'end_datetime' as end_datetime,
    event_data->>'category_name' as category_name,
    event_data->>'category_color' as category_color,
    event_data->>'is_all_day' as is_all_day,
    status as shared_status
FROM shared_events
WHERE shared_with = 'cf77e7d5-5743-46d5-add9-de9a1db64fd4'  -- Your user ID
  AND status = 'pending'
  AND event_data IS NOT NULL
ORDER BY created_at DESC;

-- 9. Clean up test data (uncomment to remove)
/*
DELETE FROM shared_events WHERE original_event_id LIKE 'test_fix_event_%';
DELETE FROM events WHERE id LIKE 'test_fix_event_%';
*/ 