-- Check for Self-Friendships
-- This script will help identify if there are any friendships where user_id equals friend_id

-- Check if you're logged in
SELECT 
  '=== AUTHENTICATION CHECK ===' as info;
SELECT 
  'Current user ID:' as status,
  auth.uid() as user_id;

-- Check for self-friendships
SELECT 
  '=== SELF-FRIENDSHIPS CHECK ===' as info;
SELECT 
  'Self-friendships found:' as message,
  COUNT(*) as count
FROM friendships 
WHERE user_id = friend_id;

-- Show all self-friendships
SELECT 
  'All self-friendships:' as details,
  id,
  user_id,
  friend_id,
  status,
  created_at
FROM friendships 
WHERE user_id = friend_id
ORDER BY created_at DESC;

-- Check for friendships involving current user
SELECT 
  '=== FRIENDSHIPS INVOLVING CURRENT USER ===' as info;
SELECT 
  'Total friendships for current user:' as message,
  COUNT(*) as count
FROM friendships 
WHERE user_id = auth.uid() OR friend_id = auth.uid();

-- Show all friendships involving current user
SELECT 
  'All friendships for current user:' as details,
  id,
  user_id,
  friend_id,
  status,
  created_at,
  CASE 
    WHEN user_id = friend_id THEN 'SELF-FRIENDSHIP'
    WHEN user_id = auth.uid() THEN 'I AM SENDER'
    WHEN friend_id = auth.uid() THEN 'I AM RECIPIENT'
    ELSE 'UNKNOWN'
  END as relationship_type
FROM friendships 
WHERE user_id = auth.uid() OR friend_id = auth.uid()
ORDER BY created_at DESC;

-- Check for any friendships where current user appears as both sender and recipient
SELECT 
  '=== DUPLICATE FRIENDSHIPS CHECK ===' as info;
SELECT 
  'Friendships where I appear as both sender and recipient:' as message,
  COUNT(*) as count
FROM friendships f1
JOIN friendships f2 ON f1.user_id = f2.friend_id AND f1.friend_id = f2.user_id
WHERE f1.user_id = auth.uid() OR f1.friend_id = auth.uid();

-- Show duplicate friendships
SELECT 
  'Duplicate friendships:' as details,
  f1.id as friendship1_id,
  f1.user_id as f1_user_id,
  f1.friend_id as f1_friend_id,
  f1.status as f1_status,
  f2.id as friendship2_id,
  f2.user_id as f2_user_id,
  f2.friend_id as f2_friend_id,
  f2.status as f2_status
FROM friendships f1
JOIN friendships f2 ON f1.user_id = f2.friend_id AND f1.friend_id = f2.user_id
WHERE (f1.user_id = auth.uid() OR f1.friend_id = auth.uid())
  AND f1.id < f2.id; -- Avoid showing same pair twice 