-- Direct check of friendships table
-- This will show us exactly what's in the database

-- 1. Check all friendships
SELECT 
  'All friendships:' as section,
  COUNT(*) as count
FROM friendships;

-- 2. Show all friendships with details
SELECT 
  id as friendship_id,
  user_id,
  friend_id,
  status,
  created_at,
  CASE 
    WHEN user_id = friend_id THEN 'SELF-FRIENDSHIP'
    ELSE 'NORMAL'
  END as friendship_type
FROM friendships 
ORDER BY created_at DESC;

-- 3. Check for self-friendships specifically
SELECT 
  'Self-friendships:' as section,
  COUNT(*) as count
FROM friendships 
WHERE user_id = friend_id;

-- 4. Show self-friendships details
SELECT 
  id as friendship_id,
  user_id,
  friend_id,
  status,
  created_at,
  'SELF-FRIENDSHIP' as issue
FROM friendships 
WHERE user_id = friend_id
ORDER BY created_at DESC;

-- 5. Check for any user with multiple friendships
SELECT 
  user_id,
  COUNT(*) as friendship_count
FROM friendships 
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY friendship_count DESC;

-- 6. Check for any friend_id with multiple friendships
SELECT 
  friend_id,
  COUNT(*) as friendship_count
FROM friendships 
GROUP BY friend_id
HAVING COUNT(*) > 1
ORDER BY friendship_count DESC; 