-- Simple Test for Friends Feed with Confirmed Friendships
-- Run this to test if the system works for two specific friends

-- === Instructions ===
-- 1. Replace the email addresses below with the actual emails of the two friends
-- 2. Run this script in your Supabase SQL Editor
-- 3. Check the results to see what's preventing posts from showing

-- === Configuration ===
\set friend1_email 'friend1@example.com'
\set friend2_email 'friend2@example.com'

-- === Test 1: Verify both users exist and are friends ===
SELECT '=== TEST 1: USER & FRIENDSHIP VERIFICATION ===' as test_name;

WITH user_info AS (
  SELECT 
    u.id,
    u.email,
    CASE WHEN p.id IS NOT NULL THEN 'Has Profile' ELSE 'Missing Profile' END as profile_status,
    p.full_name,
    p.username
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  WHERE u.email IN (:'friend1_email', :'friend2_email')
),
friendship_info AS (
  SELECT 
    f.user_id,
    f.friend_id,
    f.status,
    u1.email as user_email,
    u2.email as friend_email
  FROM friendships f
  JOIN auth.users u1 ON f.user_id = u1.id
  JOIN auth.users u2 ON f.friend_id = u2.id
  WHERE (u1.email = :'friend1_email' OR u2.email = :'friend1_email')
    AND (u1.email = :'friend2_email' OR u2.email = :'friend2_email')
)
SELECT 
  'Users:' as info_type,
  ui.email,
  ui.profile_status,
  ui.full_name,
  ui.username
FROM user_info ui
UNION ALL
SELECT 
  'Friendship:' as info_type,
  fi.user_email || ' -> ' || fi.friend_email as email,
  fi.status as profile_status,
  'Created: ' || fi.user_id::text as full_name,
  'Status: ' || fi.status as username
FROM friendship_info fi;

-- === Test 2: Check if both users have posts ===
SELECT '=== TEST 2: POST VERIFICATION ===' as test_name;

SELECT 
  u.email,
  COUNT(su.id) as total_posts,
  COUNT(CASE WHEN su.is_public = true THEN 1 END) as public_posts,
  COUNT(CASE WHEN su.is_public = false THEN 1 END) as private_posts,
  CASE 
    WHEN COUNT(su.id) = 0 THEN 'No posts found'
    WHEN COUNT(CASE WHEN su.is_public = true THEN 1 END) = 0 THEN 'Only private posts'
    ELSE 'Has public posts'
  END as status
FROM auth.users u
LEFT JOIN social_updates su ON u.id = su.user_id AND su.type = 'photo_share'
WHERE u.email IN (:'friend1_email', :'friend2_email')
GROUP BY u.id, u.email;

-- === Test 3: Test what each user can see ===
SELECT '=== TEST 3: VISIBILITY TEST ===' as test_name;

DO $$
DECLARE
  user1_id uuid;
  user2_id uuid;
  user1_visible_posts integer;
  user2_visible_posts integer;
  user1_own_posts integer;
  user2_own_posts integer;
  user1_friend_posts integer;
  user2_friend_posts integer;
BEGIN
  -- Get user IDs
  SELECT id INTO user1_id FROM auth.users WHERE email = :'friend1_email';
  SELECT id INTO user2_id FROM auth.users WHERE email = :'friend2_email';
  
  IF user1_id IS NULL OR user2_id IS NULL THEN
    RAISE NOTICE '❌ ERROR: One or both users not found';
    RETURN;
  END IF;
  
  -- Count own posts for each user
  SELECT COUNT(*) INTO user1_own_posts 
  FROM social_updates 
  WHERE user_id = user1_id AND type = 'photo_share' AND is_public = true;
  
  SELECT COUNT(*) INTO user2_own_posts 
  FROM social_updates 
  WHERE user_id = user2_id AND type = 'photo_share' AND is_public = true;
  
  -- Count friend posts visible to each user
  SELECT COUNT(*) INTO user1_friend_posts 
  FROM social_updates su
  JOIN friendships f ON (
    (f.user_id = user1_id AND f.friend_id = su.user_id) OR
    (f.friend_id = user1_id AND f.user_id = su.user_id)
  )
  WHERE su.type = 'photo_share' 
    AND su.is_public = true
    AND su.user_id != user1_id
    AND f.status = 'accepted';
  
  SELECT COUNT(*) INTO user2_friend_posts 
  FROM social_updates su
  JOIN friendships f ON (
    (f.user_id = user2_id AND f.friend_id = su.user_id) OR
    (f.friend_id = user2_id AND f.user_id = su.user_id)
  )
  WHERE su.type = 'photo_share' 
    AND su.is_public = true
    AND su.user_id != user2_id
    AND f.status = 'accepted';
  
  -- Test the function
  SELECT COUNT(*) INTO user1_visible_posts 
  FROM get_friends_photo_shares_with_privacy(user1_id, 20);
  
  SELECT COUNT(*) INTO user2_visible_posts 
  FROM get_friends_photo_shares_with_privacy(user2_id, 20);
  
  -- Report results
  RAISE NOTICE '=== RESULTS ===';
  RAISE NOTICE 'User 1 (%):', :'friend1_email';
  RAISE NOTICE '  - Own posts: %', user1_own_posts;
  RAISE NOTICE '  - Friend posts visible: %', user1_friend_posts;
  RAISE NOTICE '  - Function returns: % posts', user1_visible_posts;
  
  RAISE NOTICE 'User 2 (%):', :'friend2_email';
  RAISE NOTICE '  - Own posts: %', user2_own_posts;
  RAISE NOTICE '  - Friend posts visible: %', user2_friend_posts;
  RAISE NOTICE '  - Function returns: % posts', user2_visible_posts;
  
  -- Diagnose issues
  IF user1_own_posts = 0 AND user2_own_posts = 0 THEN
    RAISE NOTICE '❌ ISSUE: Neither user has any posts';
  ELSIF user1_own_posts = 0 THEN
    RAISE NOTICE '❌ ISSUE: User 1 has no posts';
  ELSIF user2_own_posts = 0 THEN
    RAISE NOTICE '❌ ISSUE: User 2 has no posts';
  END IF;
  
  IF user1_friend_posts = 0 AND user2_friend_posts = 0 THEN
    RAISE NOTICE '❌ ISSUE: Neither user can see friend posts';
  ELSIF user1_friend_posts = 0 THEN
    RAISE NOTICE '❌ ISSUE: User 1 cannot see friend posts';
  ELSIF user2_friend_posts = 0 THEN
    RAISE NOTICE '❌ ISSUE: User 2 cannot see friend posts';
  END IF;
  
  IF user1_visible_posts != (user1_own_posts + user1_friend_posts) THEN
    RAISE NOTICE '❌ ISSUE: Function mismatch for User 1';
  END IF;
  
  IF user2_visible_posts != (user2_own_posts + user2_friend_posts) THEN
    RAISE NOTICE '❌ ISSUE: Function mismatch for User 2';
  END IF;
  
  IF user1_visible_posts > 0 AND user2_visible_posts > 0 THEN
    RAISE NOTICE '✅ SUCCESS: Both users can see posts';
  END IF;
END $$;

-- === Test 4: Create test posts if needed ===
SELECT '=== TEST 4: CREATE TEST POSTS ===' as test_name;

-- Create test posts for users who don't have any
INSERT INTO social_updates (user_id, type, photo_url, source_type, source_id, is_public, created_at)
SELECT 
  u.id,
  'photo_share',
  'https://example.com/test-photo.jpg',
  'habit',
  NULL,
  true,
  NOW()
FROM auth.users u
WHERE u.email IN (:'friend1_email', :'friend2_email')
  AND NOT EXISTS (
    SELECT 1 FROM social_updates su
    WHERE su.user_id = u.id AND su.type = 'photo_share'
  )
ON CONFLICT DO NOTHING;

-- Show what was created
SELECT 
  u.email,
  COUNT(su.id) as posts_after_test
FROM auth.users u
LEFT JOIN social_updates su ON u.id = su.user_id AND su.type = 'photo_share'
WHERE u.email IN (:'friend1_email', :'friend2_email')
GROUP BY u.id, u.email;

-- === Test 5: Final verification ===
SELECT '=== TEST 5: FINAL VERIFICATION ===' as test_name;

DO $$
DECLARE
  user1_id uuid;
  user2_id uuid;
  user1_posts integer;
  user2_posts integer;
BEGIN
  SELECT id INTO user1_id FROM auth.users WHERE email = :'friend1_email';
  SELECT id INTO user2_id FROM auth.users WHERE email = :'friend2_email';
  
  SELECT COUNT(*) INTO user1_posts 
  FROM get_friends_photo_shares_with_privacy(user1_id, 20);
  
  SELECT COUNT(*) INTO user2_posts 
  FROM get_friends_photo_shares_with_privacy(user2_id, 20);
  
  RAISE NOTICE 'FINAL RESULTS:';
  RAISE NOTICE 'User % can see % posts', :'friend1_email', user1_posts;
  RAISE NOTICE 'User % can see % posts', :'friend2_email', user2_posts;
  
  IF user1_posts > 0 AND user2_posts > 0 THEN
    RAISE NOTICE '✅ SUCCESS: Friends feed is working!';
  ELSE
    RAISE NOTICE '❌ ISSUE: Friends feed still not working';
  END IF;
END $$; 