-- Test Friends Feed Privacy Issue
-- This script will help us understand why non-friends can see each other's posts

-- === 1. Check if the function exists and is working ===
DO $$
DECLARE
  func_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_friends_photo_shares_with_privacy'
  ) INTO func_exists;
  
  IF func_exists THEN
    RAISE NOTICE '✅ Function get_friends_photo_shares_with_privacy exists';
  ELSE
    RAISE NOTICE '❌ Function get_friends_photo_shares_with_privacy does NOT exist';
  END IF;
END $$;

-- === 2. Check RLS policies on social_updates ===
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'social_updates';

-- === 3. Check if RLS is enabled ===
SELECT 
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'social_updates';

-- === 4. Check some sample data ===
-- Check if there are any posts
SELECT 
  COUNT(*) as total_posts,
  COUNT(CASE WHEN is_public = true THEN 1 END) as public_posts,
  COUNT(CASE WHEN is_public = false THEN 1 END) as private_posts
FROM social_updates 
WHERE type = 'photo_share';

-- === 5. Check friendships ===
SELECT 
  COUNT(*) as total_friendships,
  COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_friendships,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_friendships
FROM friendships;

-- === 6. Check if there are any users ===
SELECT 
  COUNT(*) as total_users
FROM profiles;

-- === 7. Test the function manually (if we have test data) ===
-- This will help us see what the function is actually returning
-- Note: Replace 'test_user_id' with an actual user ID from your database
/*
SELECT * FROM get_friends_photo_shares_with_privacy(
  'test_user_id'::uuid, 
  10
);
*/
