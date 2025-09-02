-- Targeted Friends Feed User Comparison
-- This script will help identify why some users can post/see content while others can't

-- === Step 1: Get all users and their basic info ===
SELECT '=== ALL USERS ===' as section;
SELECT 
  u.id,
  u.email,
  u.created_at,
  CASE WHEN p.id IS NOT NULL THEN 'Has Profile' ELSE 'Missing Profile' END as profile_status,
  p.full_name,
  p.username,
  p.avatar_url
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- === Step 2: Check which users have photo shares ===
SELECT '=== PHOTO SHARES BY USER ===' as section;
SELECT 
  su.user_id,
  u.email,
  COUNT(*) as photo_share_count,
  MIN(su.created_at) as first_post,
  MAX(su.created_at) as last_post,
  COUNT(CASE WHEN su.is_public = true THEN 1 END) as public_posts,
  COUNT(CASE WHEN su.is_public = false THEN 1 END) as private_posts
FROM social_updates su
JOIN auth.users u ON su.user_id = u.id
WHERE su.type = 'photo_share'
GROUP BY su.user_id, u.email
ORDER BY photo_share_count DESC;

-- === Step 3: Check friendships for each user ===
SELECT '=== FRIENDSHIPS BY USER ===' as section;
SELECT 
  u.id,
  u.email,
  COUNT(CASE WHEN f.status = 'accepted' THEN 1 END) as accepted_friendships,
  COUNT(CASE WHEN f.status = 'pending' THEN 1 END) as pending_friendships,
  COUNT(*) as total_friendships
FROM auth.users u
LEFT JOIN friendships f ON (u.id = f.user_id OR u.id = f.friend_id)
GROUP BY u.id, u.email
ORDER BY accepted_friendships DESC;

-- === Step 4: Test the function for each user ===
SELECT '=== FUNCTION TEST RESULTS ===' as section;

-- Create a temporary function to test all users
DO $$
DECLARE
  user_record RECORD;
  result_count INTEGER;
BEGIN
  FOR user_record IN SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 10 LOOP
    SELECT COUNT(*) INTO result_count 
    FROM get_friends_photo_shares_with_privacy(user_record.id, 10);
    
    RAISE NOTICE 'User % (%) can see % posts', user_record.email, user_record.id, result_count;
  END LOOP;
END $$;

-- === Step 5: Check for specific issues ===
SELECT '=== SPECIFIC ISSUES ===' as section;

-- Users without profiles
SELECT 'Users without profiles:' as issue, COUNT(*) as count
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Users with incomplete profiles
SELECT 'Users with incomplete profiles:' as issue, COUNT(*) as count
FROM profiles p
WHERE p.full_name IS NULL OR p.username IS NULL;

-- Users with no friends
SELECT 'Users with no accepted friendships:' as issue, COUNT(*) as count
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM friendships f
  WHERE (f.user_id = u.id OR f.friend_id = u.id)
    AND f.status = 'accepted'
);

-- Users who can't see any posts (including their own)
SELECT 'Users who can see 0 posts:' as issue, COUNT(*) as count
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM social_updates su
  WHERE su.user_id = u.id AND su.type = 'photo_share'
)
AND NOT EXISTS (
  SELECT 1 FROM social_updates su
  JOIN friendships f ON (
    (f.user_id = u.id AND f.friend_id = su.user_id) OR
    (f.friend_id = u.id AND f.user_id = su.user_id)
  )
  WHERE su.type = 'photo_share' 
    AND su.is_public = true
    AND f.status = 'accepted'
);

-- === Step 6: Detailed user analysis ===
SELECT '=== DETAILED USER ANALYSIS ===' as section;

-- For each user, show their complete status
WITH user_status AS (
  SELECT 
    u.id,
    u.email,
    u.created_at,
    CASE WHEN p.id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_profile,
    p.full_name,
    p.username,
    COUNT(DISTINCT su.id) as own_posts,
    COUNT(DISTINCT f.id) as total_friendships,
    COUNT(DISTINCT CASE WHEN f.status = 'accepted' THEN f.id END) as accepted_friendships,
    COUNT(DISTINCT visible_posts.id) as visible_posts
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  LEFT JOIN social_updates su ON u.id = su.user_id AND su.type = 'photo_share'
  LEFT JOIN friendships f ON (u.id = f.user_id OR u.id = f.friend_id)
  LEFT JOIN social_updates visible_posts ON (
    visible_posts.type = 'photo_share' 
    AND visible_posts.is_public = true
    AND (
      visible_posts.user_id = u.id -- Own posts
      OR EXISTS (
        SELECT 1 FROM friendships f2
        WHERE (
          (f2.user_id = u.id AND f2.friend_id = visible_posts.user_id) OR
          (f2.friend_id = u.id AND f2.user_id = visible_posts.user_id)
        )
        AND f2.status = 'accepted'
      )
    )
  )
  GROUP BY u.id, u.email, u.created_at, p.id, p.full_name, p.username
)
SELECT 
  id,
  email,
  has_profile,
  full_name,
  username,
  own_posts,
  accepted_friendships,
  visible_posts,
  CASE 
    WHEN has_profile = 'No' THEN 'Missing Profile'
    WHEN own_posts = 0 AND accepted_friendships = 0 THEN 'No Posts & No Friends'
    WHEN own_posts > 0 AND visible_posts = own_posts THEN 'Can Post But Can Only See Own'
    WHEN own_posts = 0 AND visible_posts > 0 THEN 'Can See Others But Can\'t Post'
    WHEN own_posts > 0 AND visible_posts > own_posts THEN 'Working Normally'
    ELSE 'Other Issue'
  END as status
FROM user_status
ORDER BY created_at DESC;

-- === Step 7: Quick fix suggestions ===
SELECT '=== QUICK FIX SUGGESTIONS ===' as section;

-- Create profiles for users who don't have them
SELECT 'Run this to create missing profiles:' as fix_suggestion;
SELECT 
  'INSERT INTO profiles (id, full_name, username, avatar_url) VALUES (''' || u.id || ''', ''' || 
  COALESCE(SPLIT_PART(u.email, '@', 1), 'User') || ''', ''' || 
  COALESCE(SPLIT_PART(u.email, '@', 1), 'user') || ''', NULL);' as create_profile_sql
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Accept pending friendships
SELECT 'Run this to accept pending friendships:' as fix_suggestion;
SELECT 
  'UPDATE friendships SET status = ''accepted'' WHERE user_id = ''' || user_id || ''' AND friend_id = ''' || friend_id || ''';' as accept_friendship_sql
FROM friendships 
WHERE status = 'pending';
