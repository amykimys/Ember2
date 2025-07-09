-- Debug Data Types - Check what we're actually working with
-- Run this first to understand the data types

-- Check social_updates table structure
SELECT 'Social updates table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'social_updates' 
AND table_schema = 'public'
AND column_name IN ('source_id', 'source_type', 'id', 'user_id')
ORDER BY column_name;

-- Check events table structure
SELECT 'Events table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'events' 
AND table_schema = 'public'
AND column_name IN ('id', 'title', 'user_id')
ORDER BY column_name;

-- Check what's actually in social_updates
SELECT 'Sample social updates data:' as info;
SELECT 
    id,
    source_type,
    source_id,
    pg_typeof(source_id) as source_id_type
FROM social_updates 
WHERE type = 'photo_share'
LIMIT 5;

-- Check what's actually in events
SELECT 'Sample events data:' as info;
SELECT 
    id,
    title,
    pg_typeof(id) as id_type
FROM events 
LIMIT 5;

-- Test a simple query without the function
SELECT 'Testing simple query:' as info;
SELECT 
    su.id,
    su.source_type,
    su.source_id,
    e.id as event_id,
    e.title as event_title
FROM social_updates su
LEFT JOIN events e ON e.id = su.source_id
WHERE su.type = 'photo_share' 
    AND su.source_type = 'event'
LIMIT 5; 