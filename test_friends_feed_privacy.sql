-- Test Friends Feed Privacy
-- This script verifies that only mutual friends can see each other's posts

-- First, let's see what users and friendships exist
SELECT '=== CURRENT USERS ===' as info;
SELECT 
    id,
    full_name,
    username,
    created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 10;

SELECT '=== CURRENT FRIENDSHIPS ===' as info;
SELECT 
    f.id as friendship_id,
    f.user_id,
    f.friend_id,
    f.status,
    f.created_at,
    p1.full_name as user_name,
    p2.full_name as friend_name
FROM friendships f
JOIN profiles p1 ON f.user_id = p1.id
JOIN profiles p2 ON f.friend_id = p2.id
ORDER BY f.created_at DESC
LIMIT 10;

SELECT '=== CURRENT SOCIAL UPDATES ===' as info;
SELECT 
    su.id,
    su.user_id,
    su.type,
    su.photo_url,
    su.is_public,
    su.source_type,
    su.created_at,
    p.full_name as user_name
FROM social_updates su
JOIN profiles p ON su.user_id = p.id
WHERE su.type = 'photo_share'
ORDER BY su.created_at DESC
LIMIT 10;

-- Test the friends feed function for each user
SELECT '=== TESTING FRIENDS FEED FOR EACH USER ===' as info;

-- Get a few test users
WITH test_users AS (
    SELECT id, full_name, username
    FROM profiles
    ORDER BY created_at DESC
    LIMIT 3
)
SELECT 
    'Testing friends feed for user: ' || tu.full_name || ' (' || tu.username || ')' as test_info,
    ff.update_id,
    ff.user_name,
    ff.user_username,
    ff.source_type,
    ff.source_title,
    ff.created_at
FROM test_users tu
CROSS JOIN LATERAL (
    SELECT * FROM get_friends_photo_shares_with_privacy(tu.id, 5)
) ff
ORDER BY tu.full_name, ff.created_at DESC;

-- Test RLS policies by simulating what each user can see
SELECT '=== TESTING RLS POLICIES ===' as info;

-- Simulate what user 1 can see
WITH user1 AS (
    SELECT id FROM profiles ORDER BY created_at DESC LIMIT 1
)
SELECT 
    'User 1 can see these posts (via RLS):' as test_info,
    su.id,
    su.user_id,
    su.is_public,
    p.full_name as poster_name,
    su.created_at
FROM user1 u1
CROSS JOIN social_updates su
JOIN profiles p ON su.user_id = p.id
WHERE su.type = 'photo_share'
    AND (
        su.user_id = u1.id  -- Own posts
        OR (
            su.is_public = true  -- Friends' public posts
            AND EXISTS (
                SELECT 1 FROM friendships f
                WHERE (
                    (f.user_id = u1.id AND f.friend_id = su.user_id) OR
                    (f.friend_id = u1.id AND f.user_id = su.user_id)
                )
                AND f.status = 'accepted'
            )
        )
    )
ORDER BY su.created_at DESC
LIMIT 5;

-- Check if there are any posts that shouldn't be visible
SELECT '=== CHECKING FOR PRIVACY VIOLATIONS ===' as info;

-- Find posts that are public but from non-friends
WITH all_users AS (
    SELECT id FROM profiles
),
all_friendships AS (
    SELECT user_id, friend_id FROM friendships WHERE status = 'accepted'
    UNION
    SELECT friend_id, user_id FROM friendships WHERE status = 'accepted'
)
SELECT 
    'Potential privacy violation - public post from non-friend:' as issue,
    su.id as post_id,
    su.user_id as poster_id,
    p.full_name as poster_name,
    su.is_public,
    su.created_at
FROM social_updates su
JOIN profiles p ON su.user_id = p.id
CROSS JOIN all_users au
WHERE su.type = 'photo_share'
    AND su.is_public = true
    AND su.user_id != au.id  -- Not own post
    AND NOT EXISTS (
        SELECT 1 FROM all_friendships af
        WHERE (af.user_id = au.id AND af.friend_id = su.user_id)
    )
ORDER BY su.created_at DESC
LIMIT 5;

-- Summary
SELECT '=== PRIVACY TEST SUMMARY ===' as info;
SELECT 
    'Friends feed privacy test completed' as status,
    'Check results above for any privacy violations' as next_steps,
    'Only mutual friends should see each other posts' as expected_behavior; 