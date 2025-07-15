-- Debug Friends Feed Current State
-- This script will help us understand what's happening with event titles

-- 1. Check what's currently in the social_updates table
SELECT '=== SOCIAL UPDATES TABLE ===' as info;
SELECT 
    id,
    user_id,
    type,
    photo_url,
    caption,
    source_type,
    source_id,
    is_public,
    created_at
FROM social_updates 
WHERE type = 'photo_share'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check what events exist
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

-- 3. Test the current function
SELECT '=== TESTING CURRENT FUNCTION ===' as info;
SELECT 
    update_id,
    user_name,
    user_username,
    photo_url,
    caption,
    source_type,
    source_title,
    created_at
FROM get_friends_photo_shares_with_privacy(
    COALESCE(auth.uid(), gen_random_uuid()),
    10
)
ORDER BY created_at DESC;

-- 4. Check if there are any data type mismatches
SELECT '=== DATA TYPE COMPATIBILITY ===' as info;
SELECT 
    su.id as social_update_id,
    su.source_id as social_update_source_id,
    su.source_type,
    e.id as event_id,
    e.title as event_title,
    CASE 
        WHEN su.source_id::text = e.id THEN 'MATCH'
        ELSE 'NO MATCH'
    END as id_match
FROM social_updates su
LEFT JOIN events e ON su.source_type = 'event' AND su.source_id::text = e.id
WHERE su.type = 'photo_share' AND su.source_type = 'event'
ORDER BY su.created_at DESC
LIMIT 5;

-- 5. Check if the function exists and what it returns
SELECT '=== FUNCTION DEFINITION ===' as info;
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname = 'get_friends_photo_shares_with_privacy';

-- 6. Manual test of the join logic
SELECT '=== MANUAL JOIN TEST ===' as info;
SELECT 
    su.id,
    su.source_type,
    su.source_id,
    su.caption,
    e.title as event_title,
    e.id as event_id
FROM social_updates su
LEFT JOIN events e ON su.source_type = 'event' AND su.source_id::text = e.id
WHERE su.type = 'photo_share' 
    AND su.source_type = 'event'
    AND su.photo_url IS NOT NULL
ORDER BY su.created_at DESC
LIMIT 10; 