-- Debug Event Title Lookup Issue
-- This script will help us understand why event titles are null

-- 1. Check what's in social_updates with event source_type
SELECT '=== SOCIAL UPDATES WITH EVENT SOURCE ===' as info;
SELECT 
    id,
    user_id,
    type,
    photo_url,
    caption,
    source_type,
    source_id,
    created_at
FROM social_updates 
WHERE type = 'photo_share' 
    AND source_type = 'event'
    AND source_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check what events exist and their IDs
SELECT '=== EVENTS TABLE ===' as info;
SELECT 
    id,
    title,
    user_id,
    photos,
    created_at
FROM events 
ORDER BY created_at DESC
LIMIT 10;

-- 3. Test the join between social_updates and events
SELECT '=== TESTING JOIN BETWEEN SOCIAL_UPDATES AND EVENTS ===' as info;
SELECT 
    su.id as social_update_id,
    su.source_id,
    su.source_type,
    su.caption,
    e.id as event_id,
    e.title as event_title,
    CASE 
        WHEN e.id IS NULL THEN 'NO MATCH'
        WHEN e.title IS NULL THEN 'EVENT EXISTS BUT NO TITLE'
        ELSE 'MATCH FOUND'
    END as status
FROM social_updates su
LEFT JOIN events e ON su.source_id::text = e.id::text
WHERE su.type = 'photo_share' 
    AND su.source_type = 'event'
    AND su.source_id IS NOT NULL
ORDER BY su.created_at DESC
LIMIT 10;

-- 4. Check data types
SELECT '=== DATA TYPE CHECK ===' as info;
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'social_updates' 
    AND column_name IN ('source_id', 'source_type');

SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'events' 
    AND column_name IN ('id', 'title'); 