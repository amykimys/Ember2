-- Fix Self-Friendships
-- This script removes any friendships where user_id equals friend_id

-- Check if you're logged in
SELECT 
  '=== AUTHENTICATION CHECK ===' as info;
SELECT 
  'Current user ID:' as status,
  auth.uid() as user_id;

-- 1. Check for self-friendships before cleanup
SELECT 
  '=== BEFORE CLEANUP ===' as info;
SELECT 
  'Self-friendships found:' as message,
  COUNT(*) as count
FROM friendships 
WHERE user_id = friend_id;

-- Show self-friendships that will be removed
SELECT 
  'Self-friendships to be removed:' as details,
  id,
  user_id,
  friend_id,
  status,
  created_at
FROM friendships 
WHERE user_id = friend_id
ORDER BY created_at DESC;

-- 2. Remove self-friendships
DELETE FROM friendships 
WHERE user_id = friend_id;

-- 3. Check for self-friendships after cleanup
SELECT 
  '=== AFTER CLEANUP ===' as info;
SELECT 
  'Self-friendships remaining:' as message,
  COUNT(*) as count
FROM friendships 
WHERE user_id = friend_id;

-- 4. Verify all friendships for current user
SELECT 
  '=== CURRENT USER FRIENDSHIPS ===' as info;
SELECT 
  'Total friendships for current user:' as message,
  COUNT(*) as count
FROM friendships 
WHERE user_id = auth.uid() OR friend_id = auth.uid();

-- Show all friendships for current user
SELECT 
  'All friendships for current user:' as details,
  id,
  user_id,
  friend_id,
  status,
  created_at,
  CASE 
    WHEN user_id = auth.uid() THEN 'I AM SENDER'
    WHEN friend_id = auth.uid() THEN 'I AM RECIPIENT'
    ELSE 'UNKNOWN'
  END as relationship_type
FROM friendships 
WHERE user_id = auth.uid() OR friend_id = auth.uid()
ORDER BY created_at DESC; 