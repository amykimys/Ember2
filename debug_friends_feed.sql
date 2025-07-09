-- Debug Friends Feed - Check why event titles aren't showing
-- Run this in your Supabase SQL Editor to see what's happening

-- Step 1: Check the social_updates table structure
SELECT 'Social updates table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'social_updates' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Check the events table structure
SELECT 'Events table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'events' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 3: Check what's in social_updates
SELECT 'Recent photo shares in social_updates:' as info;
SELECT 
    su.id,
    su.user_id,
    su.type,
    su.photo_url,
    su.caption,
    su.source_type,
    su.source_id,
    su.is_public,
    su.created_at
FROM social_updates su
WHERE su.type = 'photo_share'
ORDER BY su.created_at DESC
LIMIT 5;

-- Step 4: Check what's in events table
SELECT 'Recent events:' as info;
SELECT 
    e.id,
    e.title,
    e.user_id,
    e.created_at
FROM events e
ORDER BY e.created_at DESC
LIMIT 5;

-- Step 5: Test the join manually
SELECT 'Testing manual join:' as info;
SELECT 
    su.id as social_update_id,
    su.source_type,
    su.source_id,
    e.id as event_id,
    e.title as event_title,
    CASE 
        WHEN su.source_type = 'event' AND su.source_id IS NOT NULL THEN 
            COALESCE(e.title, 'Event Not Found')
        ELSE 
            'Not an event'
    END as result_title
FROM social_updates su
LEFT JOIN events e ON su.source_type = 'event' AND su.source_id::text = e.id
WHERE su.type = 'photo_share'
ORDER BY su.created_at DESC
LIMIT 10;

-- Step 6: Check if there are any events with the same IDs as source_ids
SELECT 'Checking for matching event IDs:' as info;
SELECT 
    su.source_id,
    e.id,
    e.title,
    CASE 
        WHEN su.source_id::text = e.id::text THEN 'MATCH'
        ELSE 'NO MATCH'
    END as match_status
FROM social_updates su
LEFT JOIN events e ON su.source_id::text = e.id::text
WHERE su.type = 'photo_share' 
    AND su.source_type = 'event'
ORDER BY su.created_at DESC
LIMIT 10; 