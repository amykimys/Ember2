-- Test Habit Photo Sharing to Friends Feed
-- This script will help verify that habit photos are properly shared

-- 1. Check current social updates
SELECT '=== CURRENT SOCIAL UPDATES ===' as info;
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

-- 2. Check current habits with photos
SELECT '=== HABITS WITH PHOTOS ===' as info;
SELECT 
    id,
    text,
    user_id,
    photos,
    created_at
FROM habits 
WHERE photos IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 3. Test the friends feed function
SELECT '=== TESTING FRIENDS FEED FUNCTION ===' as info;
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
    auth.uid(), -- Current user ID
    10
)
ORDER BY created_at DESC;

-- 4. Check if there are any habit photo shares specifically
SELECT '=== HABIT PHOTO SHARES ===' as info;
SELECT 
    su.id,
    p.full_name as user_name,
    p.username as user_username,
    su.photo_url,
    su.caption,
    su.source_type,
    h.text as habit_title,
    su.created_at
FROM social_updates su
JOIN profiles p ON su.user_id = p.id
LEFT JOIN habits h ON su.source_type = 'habit' AND su.source_id = h.id
WHERE su.type = 'photo_share' 
    AND su.source_type = 'habit'
ORDER BY su.created_at DESC
LIMIT 10;

-- 5. Check if there are any event photo shares for comparison
SELECT '=== EVENT PHOTO SHARES ===' as info;
SELECT 
    su.id,
    p.full_name as user_name,
    p.username as user_username,
    su.photo_url,
    su.caption,
    su.source_type,
    e.title as event_title,
    su.created_at
FROM social_updates su
JOIN profiles p ON su.user_id = p.id
LEFT JOIN events e ON su.source_type = 'event' AND su.source_id::text = e.id
WHERE su.type = 'photo_share' 
    AND su.source_type = 'event'
ORDER BY su.created_at DESC
LIMIT 10; 