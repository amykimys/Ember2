-- Quick Friends Feed Test Script
-- Run this to test if the friends feed is working for specific users

-- Replace these UUIDs with actual user IDs from your database
-- You can get user IDs by running: SELECT id, email FROM auth.users LIMIT 5;

-- Test user 1 (replace with actual user ID)
\set user1_id '00000000-0000-0000-0000-000000000001'

-- Test user 2 (replace with actual user ID)  
\set user2_id '00000000-0000-0000-0000-000000000002'

-- === Test 1: Check if users exist ===
SELECT 'Test 1: User existence check' as test_name;
SELECT 
  id,
  email,
  created_at
FROM auth.users 
WHERE id IN (:'user1_id', :'user2_id');

-- === Test 2: Check if users have profiles ===
SELECT 'Test 2: Profile check' as test_name;
SELECT 
  id,
  full_name,
  username,
  avatar_url
FROM profiles 
WHERE id IN (:'user1_id', :'user2_id');

-- === Test 3: Check friendships ===
SELECT 'Test 3: Friendship check' as test_name;
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
WHERE (f.user_id IN (:'user1_id', :'user2_id') OR f.friend_id IN (:'user1_id', :'user2_id'));

-- === Test 4: Check photo shares ===
SELECT 'Test 4: Photo shares check' as test_name;
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
  AND user_id IN (:'user1_id', :'user2_id')
ORDER BY created_at DESC;

-- === Test 5: Test the function for user 1 ===
SELECT 'Test 5: Function test for user 1' as test_name;
SELECT * FROM get_friends_photo_shares_with_privacy(:'user1_id'::uuid, 10);

-- === Test 6: Test the function for user 2 ===
SELECT 'Test 6: Function test for user 2' as test_name;
SELECT * FROM get_friends_photo_shares_with_privacy(:'user2_id'::uuid, 10);

-- === Test 7: Debug issues for user 1 ===
SELECT 'Test 7: Debug issues for user 1' as test_name;
SELECT * FROM debug_friends_feed_issues(:'user1_id'::uuid);

-- === Test 8: Debug issues for user 2 ===
SELECT 'Test 8: Debug issues for user 2' as test_name;
SELECT * FROM debug_friends_feed_issues(:'user2_id'::uuid);

-- === Test 9: Check RLS policies ===
SELECT 'Test 9: RLS policies check' as test_name;
SELECT 
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'social_updates'
ORDER BY policyname;

-- === Test 10: Check table constraints ===
SELECT 'Test 10: Table constraints check' as test_name;
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.social_updates'::regclass 
  AND contype = 'c';
