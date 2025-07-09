-- Test the complete friend request flow
-- This script tests all aspects of the friend request system

-- Step 1: Check current user
SELECT '=== CURRENT USER ===' as info;
SELECT auth.uid() as current_user_id;

-- Step 2: Check if we have other users to test with
SELECT '=== AVAILABLE USERS ===' as info;
SELECT 
  u.id as user_id,
  u.email,
  p.full_name,
  p.username
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.id != auth.uid()
ORDER BY u.created_at DESC
LIMIT 5;

-- Step 3: Check current friendships
SELECT '=== CURRENT FRIENDSHIPS ===' as info;
SELECT 
  f.id as friendship_id,
  f.user_id as requester_id,
  f.friend_id as recipient_id,
  f.status,
  f.created_at,
  p1.full_name as requester_name,
  p2.full_name as recipient_name
FROM friendships f
LEFT JOIN profiles p1 ON f.user_id = p1.id
LEFT JOIN profiles p2 ON f.friend_id = p2.id
WHERE f.user_id = auth.uid() OR f.friend_id = auth.uid()
ORDER BY f.created_at DESC;

-- Step 4: Test search_users function
SELECT '=== TESTING SEARCH FUNCTION ===' as info;
SELECT 
  user_id,
  full_name,
  username,
  is_friend,
  friendship_status
FROM search_users('test', auth.uid())
LIMIT 5;

-- Step 5: Test creating a friend request (replace USER_ID_HERE with an actual user ID)
-- Uncomment and modify the following lines to test sending a friend request:
/*
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (auth.uid(), 'USER_ID_HERE'::uuid, 'pending', NOW(), NOW())
ON CONFLICT (user_id, friend_id) DO NOTHING;
*/

-- Step 6: Check pending friend requests (where current user is recipient)
SELECT '=== PENDING FRIEND REQUESTS (RECEIVED) ===' as info;
SELECT 
  f.id as friendship_id,
  f.user_id as requester_id,
  f.friend_id as recipient_id,
  f.status,
  f.created_at,
  p.full_name as requester_name,
  p.username as requester_username
FROM friendships f
JOIN profiles p ON f.user_id = p.id
WHERE f.friend_id = auth.uid() AND f.status = 'pending'
ORDER BY f.created_at DESC;

-- Step 7: Check sent friend requests (where current user is requester)
SELECT '=== PENDING FRIEND REQUESTS (SENT) ===' as info;
SELECT 
  f.id as friendship_id,
  f.user_id as requester_id,
  f.friend_id as recipient_id,
  f.status,
  f.created_at,
  p.full_name as recipient_name,
  p.username as recipient_username
FROM friendships f
JOIN profiles p ON f.friend_id = p.id
WHERE f.user_id = auth.uid() AND f.status = 'pending'
ORDER BY f.created_at DESC;

-- Step 8: Test accepting a friend request (replace FRIENDSHIP_ID_HERE with actual ID)
-- Uncomment and modify the following lines to test accepting a request:
/*
UPDATE friendships 
SET status = 'accepted', updated_at = NOW()
WHERE id = 'FRIENDSHIP_ID_HERE'::uuid AND friend_id = auth.uid();
*/

-- Step 9: Test declining a friend request (replace FRIENDSHIP_ID_HERE with actual ID)
-- Uncomment and modify the following lines to test declining a request:
/*
DELETE FROM friendships 
WHERE id = 'FRIENDSHIP_ID_HERE'::uuid AND friend_id = auth.uid();
*/

-- Step 10: Check RLS policies
SELECT '=== RLS POLICIES ===' as info;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('profiles', 'friendships')
ORDER BY tablename, policyname;

SELECT '=== FRIEND REQUEST FLOW TEST COMPLETED ===' as status; 