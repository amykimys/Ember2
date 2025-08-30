-- Debug Friends Feed - Let's see what's happening step by step

-- 1. First, let's see what's in the social_updates table
SELECT '=== SOCIAL_UPDATES TABLE ===' as info;
SELECT 
    id,
    user_id,
    type,
    photo_url,
    caption,
    source_type,
    is_public,
    created_at
FROM social_updates 
WHERE type = 'photo_share'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Let's see what's in the profiles table
SELECT '=== PROFILES TABLE ===' as info;
SELECT 
    id,
    full_name,
    username,
    avatar_url
FROM profiles 
LIMIT 10;

-- 3. Let's see what's in the friendships table
SELECT '=== FRIENDSHIPS TABLE ===' as info;
SELECT 
    user_id,
    friend_id,
    status,
    created_at
FROM friendships 
LIMIT 10;

-- 4. Let's test a simple query without the complex function
SELECT '=== SIMPLE JOIN TEST ===' as info;
SELECT 
    su.id as update_id,
    su.user_id,
    p.full_name as user_name,
    p.avatar_url as user_avatar,
    p.username as user_username,
    su.photo_url,
    su.caption,
    su.source_type,
    su.created_at
FROM social_updates su
LEFT JOIN profiles p ON su.user_id = p.id
WHERE su.type = 'photo_share'
    AND su.photo_url IS NOT NULL
ORDER BY su.created_at DESC
LIMIT 10;

-- 5. Let's check if there are any RLS policies blocking access
SELECT '=== RLS POLICIES ===' as info;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('social_updates', 'profiles', 'friendships'); 