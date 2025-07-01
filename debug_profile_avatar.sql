-- Debug Profile Avatar in Friends Feed
-- This script helps debug why profile photos aren't showing up in the friends feed

-- First, let's check the current user's profile
SELECT 'Current user profile:' as info;
SELECT 
    id,
    full_name,
    username,
    avatar_url,
    CASE 
        WHEN avatar_url IS NULL THEN 'NULL'
        WHEN avatar_url = '' THEN 'EMPTY'
        WHEN avatar_url LIKE 'http%' THEN 'VALID_URL'
        ELSE 'INVALID_FORMAT'
    END as avatar_status,
    created_at,
    updated_at
FROM profiles 
WHERE id = auth.uid();

-- Check if there are any photo shares for the current user
SELECT 'Current user photo shares:' as info;
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
WHERE su.user_id = auth.uid()
    AND su.type = 'photo_share'
ORDER BY su.created_at DESC;

-- Test the friends feed function with the current user
SELECT 'Testing friends feed function:' as info;
SELECT 
    update_id,
    user_id,
    user_name,
    user_username,
    CASE 
        WHEN user_avatar IS NULL THEN 'NULL'
        WHEN user_avatar = '' THEN 'EMPTY'
        WHEN user_avatar LIKE 'http%' THEN 'VALID_URL'
        ELSE 'INVALID_FORMAT'
    END as avatar_status,
    user_avatar,
    photo_url,
    caption,
    source_type,
    source_title,
    created_at
FROM get_friends_photo_shares(
    auth.uid(), -- Current user ID
    10
)
ORDER BY created_at DESC;

-- Check all profiles to see if any have avatar URLs
SELECT 'All profiles with avatar URLs:' as info;
SELECT 
    id,
    full_name,
    username,
    avatar_url,
    CASE 
        WHEN avatar_url IS NULL THEN 'NULL'
        WHEN avatar_url = '' THEN 'EMPTY'
        WHEN avatar_url LIKE 'http%' THEN 'VALID_URL'
        ELSE 'INVALID_FORMAT'
    END as avatar_status
FROM profiles 
WHERE avatar_url IS NOT NULL 
    AND avatar_url != ''
ORDER BY updated_at DESC;

-- Check all photo shares to see if they have associated profile data
SELECT 'All photo shares with profile data:' as info;
SELECT 
    su.id,
    su.user_id,
    p.full_name,
    p.username,
    p.avatar_url,
    CASE 
        WHEN p.avatar_url IS NULL THEN 'NULL'
        WHEN p.avatar_url = '' THEN 'EMPTY'
        WHEN p.avatar_url LIKE 'http%' THEN 'VALID_URL'
        ELSE 'INVALID_FORMAT'
    END as avatar_status,
    su.photo_url,
    su.caption,
    su.source_type,
    su.created_at
FROM social_updates su
JOIN profiles p ON su.user_id = p.id
WHERE su.type = 'photo_share'
ORDER BY su.created_at DESC; 