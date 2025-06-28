-- Debug Friends Feed Function
-- This script helps debug why photos from events aren't being properly fetched

-- 1. Check what's in the social_updates table
SELECT 'Social Updates Table Contents:' as info;
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
ORDER BY created_at DESC;

-- 2. Check the events table structure
SELECT 'Events Table Structure:' as info;
SELECT 
    id,
    title,
    photos,
    created_at
FROM events 
ORDER BY created_at DESC
LIMIT 5;

-- 3. Test the function with a specific user ID
-- Replace 'YOUR_USER_ID' with an actual user ID from your database
SELECT 'Testing get_friends_photo_shares function:' as info;
SELECT 
    update_id,
    user_name,
    user_username,
    photo_url,
    caption,
    source_type,
    source_title,
    created_at
FROM get_friends_photo_shares(
    'YOUR_USER_ID'::UUID, -- Replace with actual user ID
    10
)
ORDER BY created_at DESC;

-- 4. Check if there are any data type mismatches
SELECT 'Checking data type compatibility:' as info;
SELECT 
    su.id as social_update_id,
    su.source_id as social_update_source_id,
    su.source_type,
    e.id as event_id,
    e.title as event_title,
    CASE 
        WHEN su.source_id = e.id::text THEN 'MATCH'
        ELSE 'NO MATCH'
    END as id_match
FROM social_updates su
LEFT JOIN events e ON su.source_type = 'event' AND su.source_id = e.id::text
WHERE su.type = 'photo_share' AND su.source_type = 'event'
ORDER BY su.created_at DESC;

-- 5. Check friendships to see if the user has any friends
SELECT 'Checking friendships:' as info;
SELECT 
    user_id,
    friend_id,
    status,
    created_at
FROM friendships 
WHERE status = 'accepted'
ORDER BY created_at DESC; 