-- Debug Friends Feed Issues - Comprehensive Diagnostic
-- This script will help identify why some users can't share posts and why friends can't see each other's posts

-- === 1. Check if photo_share type is allowed in social_updates table ===
SELECT 'Checking social_updates table constraints...' as info;

SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.social_updates'::regclass 
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%type%';

-- === 2. Check if photo_share columns exist ===
SELECT 'Checking photo_share columns...' as info;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'social_updates' 
  AND table_schema = 'public'
  AND column_name IN ('photo_url', 'source_type', 'source_id', 'caption', 'photos')
ORDER BY column_name;

-- === 3. Check RLS policies on social_updates ===
SELECT 'Checking RLS policies on social_updates...' as info;

SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'social_updates'
ORDER BY policyname;

-- === 4. Check if the get_friends_photo_shares_with_privacy function exists ===
SELECT 'Checking database function...' as info;

SELECT 
  proname as function_name,
  proargtypes,
  prosrc
FROM pg_proc 
WHERE proname = 'get_friends_photo_shares_with_privacy';

-- === 5. Test the function with a sample user ===
SELECT 'Testing function with sample data...' as info;

-- First, let's see if we have any users
SELECT 'Available users:' as info;
SELECT id, email, created_at FROM auth.users LIMIT 5;

-- Check if we have any friendships
SELECT 'Friendships status:' as info;
SELECT 
  f.user_id,
  f.friend_id,
  f.status,
  f.created_at,
  u1.email as user_email,
  u2.email as friend_email
FROM friendships f
JOIN auth.users u1 ON f.user_id = u1.id
JOIN auth.users u2 ON f.friend_id = u2.id
LIMIT 10;

-- Check if we have any social_updates
SELECT 'Social updates count by type:' as info;
SELECT 
  type,
  COUNT(*) as count,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM social_updates 
GROUP BY type
ORDER BY count DESC;

-- Check photo_share posts specifically
SELECT 'Photo share posts details:' as info;
SELECT 
  id,
  user_id,
  type,
  photo_url,
  source_type,
  source_id,
  is_public,
  created_at
FROM social_updates 
WHERE type = 'photo_share'
ORDER BY created_at DESC
LIMIT 10;

-- === 6. Test the function with a real user (if available) ===
DO $$
DECLARE
  test_user_id uuid;
  result_count integer;
BEGIN
  -- Get the first user as a test
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    SELECT 'Testing function with user: ' || test_user_id as info;
    
    -- Test the function
    SELECT COUNT(*) INTO result_count 
    FROM get_friends_photo_shares_with_privacy(test_user_id, 10);
    
    RAISE NOTICE 'Function returned % rows for user %', result_count, test_user_id;
    
    -- Show the actual results
    RAISE NOTICE 'Function results:';
    FOR r IN SELECT * FROM get_friends_photo_shares_with_privacy(test_user_id, 5) LOOP
      RAISE NOTICE 'Post: % by user %', r.update_id, r.user_id;
    END LOOP;
  ELSE
    RAISE NOTICE 'No users found in the database';
  END IF;
END $$;

-- === 7. Check for common issues ===
SELECT 'Checking for common issues...' as info;

-- Issue 1: Users without profiles
SELECT 'Users without profiles:' as issue, COUNT(*) as count
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Issue 2: Photo shares without valid photo_url
SELECT 'Photo shares without photo_url:' as issue, COUNT(*) as count
FROM social_updates 
WHERE type = 'photo_share' 
  AND (photo_url IS NULL OR photo_url = '');

-- Issue 3: Private photo shares
SELECT 'Private photo shares:' as issue, COUNT(*) as count
FROM social_updates 
WHERE type = 'photo_share' 
  AND is_public = false;

-- Issue 4: Pending friendships
SELECT 'Pending friendships:' as issue, COUNT(*) as count
FROM friendships 
WHERE status = 'pending';

-- Issue 5: Users with no friends
SELECT 'Users with no accepted friendships:' as issue, COUNT(*) as count
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM friendships f
  WHERE (f.user_id = u.id OR f.friend_id = u.id)
    AND f.status = 'accepted'
);

-- === 8. Sample data for testing ===
SELECT 'Sample data for manual testing...' as info;

-- Sample user
SELECT 'Sample user:' as info, id, email FROM auth.users LIMIT 1;

-- Sample friendship
SELECT 'Sample friendship:' as info, user_id, friend_id, status 
FROM friendships 
WHERE status = 'accepted' 
LIMIT 1;

-- Sample photo share
SELECT 'Sample photo share:' as info, id, user_id, photo_url, is_public 
FROM social_updates 
WHERE type = 'photo_share' 
LIMIT 1;
