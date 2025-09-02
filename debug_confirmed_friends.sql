-- Friends Feed Debug for Confirmed Friendships
-- Use this when users can see they are friends but posts aren't showing

-- === Step 1: Check specific friendship details ===
-- Replace these UUIDs with the actual user IDs of the two friends
\set user1_email 'user1@example.com'
\set user2_email 'user2@example.com'

SELECT '=== FRIENDSHIP DETAILS ===' as section;
SELECT 
  f.user_id,
  f.friend_id,
  f.status,
  f.created_at,
  f.updated_at,
  u1.email as user1_email,
  u2.email as user2_email
FROM friendships f
JOIN auth.users u1 ON f.user_id = u1.id
JOIN auth.users u2 ON f.friend_id = u2.id
WHERE (u1.email = :'user1_email' OR u2.email = :'user1_email')
  AND (u1.email = :'user2_email' OR u2.email = :'user2_email');

-- === Step 2: Check if both users have profiles ===
SELECT '=== PROFILE STATUS ===' as section;
SELECT 
  u.id,
  u.email,
  CASE WHEN p.id IS NOT NULL THEN 'Has Profile' ELSE 'Missing Profile' END as profile_status,
  p.full_name,
  p.username,
  p.avatar_url
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email IN (:'user1_email', :'user2_email');

-- === Step 3: Check if both users have posts ===
SELECT '=== POST STATUS ===' as section;
SELECT 
  u.email,
  COUNT(su.id) as total_posts,
  COUNT(CASE WHEN su.is_public = true THEN 1 END) as public_posts,
  COUNT(CASE WHEN su.is_public = false THEN 1 END) as private_posts,
  MIN(su.created_at) as first_post,
  MAX(su.created_at) as last_post
FROM auth.users u
LEFT JOIN social_updates su ON u.id = su.user_id AND su.type = 'photo_share'
WHERE u.email IN (:'user1_email', :'user2_email')
GROUP BY u.id, u.email;

-- === Step 4: Test what each user can see ===
SELECT '=== VISIBILITY TEST ===' as section;

-- Get user IDs
DO $$
DECLARE
  user1_id uuid;
  user2_id uuid;
  user1_posts integer;
  user2_posts integer;
BEGIN
  -- Get user IDs
  SELECT id INTO user1_id FROM auth.users WHERE email = :'user1_email';
  SELECT id INTO user2_id FROM auth.users WHERE email = :'user2_email';
  
  IF user1_id IS NULL OR user2_id IS NULL THEN
    RAISE NOTICE 'One or both users not found';
    RETURN;
  END IF;
  
  -- Test what user1 can see
  SELECT COUNT(*) INTO user1_posts 
  FROM get_friends_photo_shares_with_privacy(user1_id, 20);
  
  -- Test what user2 can see
  SELECT COUNT(*) INTO user2_posts 
  FROM get_friends_photo_shares_with_privacy(user2_id, 20);
  
  RAISE NOTICE 'User % (%) can see % posts', :'user1_email', user1_id, user1_posts;
  RAISE NOTICE 'User % (%) can see % posts', :'user2_email', user2_id, user2_posts;
  
  -- Show specific posts each user can see
  RAISE NOTICE 'Posts visible to user 1:';
  FOR r IN SELECT update_id, user_id, user_name, created_at FROM get_friends_photo_shares_with_privacy(user1_id, 10) LOOP
    RAISE NOTICE '  Post % by % at %', r.update_id, r.user_name, r.created_at;
  END LOOP;
  
  RAISE NOTICE 'Posts visible to user 2:';
  FOR r IN SELECT update_id, user_id, user_name, created_at FROM get_friends_photo_shares_with_privacy(user2_id, 10) LOOP
    RAISE NOTICE '  Post % by % at %', r.update_id, r.user_name, r.created_at;
  END LOOP;
END $$;

-- === Step 5: Check for specific issues ===
SELECT '=== SPECIFIC ISSUES ===' as section;

-- Check for posts with missing photo_url
SELECT 'Posts with missing photo_url:' as issue, COUNT(*) as count
FROM social_updates su
JOIN auth.users u ON su.user_id = u.id
WHERE su.type = 'photo_share' 
  AND (su.photo_url IS NULL OR su.photo_url = '')
  AND u.email IN (:'user1_email', :'user2_email');

-- Check for private posts
SELECT 'Private posts:' as issue, COUNT(*) as count
FROM social_updates su
JOIN auth.users u ON su.user_id = u.id
WHERE su.type = 'photo_share' 
  AND su.is_public = false
  AND u.email IN (:'user1_email', :'user2_email');

-- Check for posts with invalid source_type
SELECT 'Posts with invalid source_type:' as issue, COUNT(*) as count
FROM social_updates su
JOIN auth.users u ON su.user_id = u.id
WHERE su.type = 'photo_share' 
  AND su.source_type NOT IN ('habit', 'event')
  AND u.email IN (:'user1_email', :'user2_email');

-- === Step 6: Test RLS policies ===
SELECT '=== RLS POLICY TEST ===' as section;

-- Check if RLS is enabled
SELECT 'RLS enabled on social_updates:' as check_item,
       CASE WHEN relrowsecurity THEN 'Yes' ELSE 'No' END as result
FROM pg_class 
WHERE relname = 'social_updates';

-- Check RLS policies
SELECT 'RLS policies:' as check_item;
SELECT 
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'social_updates'
ORDER BY policyname;

-- === Step 7: Quick fixes for common issues ===
SELECT '=== QUICK FIXES ===' as section;

-- Fix posts with missing photo_url
UPDATE social_updates 
SET photo_url = 'https://example.com/placeholder.jpg'
WHERE type = 'photo_share' 
  AND (photo_url IS NULL OR photo_url = '')
  AND user_id IN (
    SELECT id FROM auth.users 
    WHERE email IN (:'user1_email', :'user2_email')
  );

-- Make all posts public
UPDATE social_updates 
SET is_public = true
WHERE type = 'photo_share' 
  AND is_public = false
  AND user_id IN (
    SELECT id FROM auth.users 
    WHERE email IN (:'user1_email', :'user2_email')
  );

-- Fix source_type if needed
UPDATE social_updates 
SET source_type = 'habit'
WHERE type = 'photo_share' 
  AND source_type NOT IN ('habit', 'event')
  AND user_id IN (
    SELECT id FROM auth.users 
    WHERE email IN (:'user1_email', :'user2_email')
  );

-- === Step 8: Verify fixes ===
SELECT '=== VERIFICATION ===' as section;

-- Test again after fixes
DO $$
DECLARE
  user1_id uuid;
  user2_id uuid;
  user1_posts integer;
  user2_posts integer;
BEGIN
  SELECT id INTO user1_id FROM auth.users WHERE email = :'user1_email';
  SELECT id INTO user2_id FROM auth.users WHERE email = :'user2_email';
  
  SELECT COUNT(*) INTO user1_posts 
  FROM get_friends_photo_shares_with_privacy(user1_id, 20);
  
  SELECT COUNT(*) INTO user2_posts 
  FROM get_friends_photo_shares_with_privacy(user2_id, 20);
  
  RAISE NOTICE 'AFTER FIXES:';
  RAISE NOTICE 'User % can see % posts', :'user1_email', user1_posts;
  RAISE NOTICE 'User % can see % posts', :'user2_email', user2_posts;
END $$;
