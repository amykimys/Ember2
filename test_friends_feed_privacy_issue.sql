-- Test Friends Feed Privacy Issue
-- Check if non-friends can see each other's posts

-- === 1. Check current function definition ===
SELECT 
  proname,
  prosrc
FROM pg_proc 
WHERE proname = 'get_friends_photo_shares_with_privacy';

-- === 2. Check current RLS policies on social_updates ===
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'social_updates';

-- === 3. Check if RLS is enabled on social_updates ===
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'social_updates';

-- === 4. Test the function with a specific user ===
-- First, let's see what users exist
SELECT id, full_name, username FROM profiles LIMIT 5;

-- === 5. Check friendships table structure ===
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'friendships';

-- === 6. Check social_updates table structure ===
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'social_updates';

-- === 7. Check if there are any posts in social_updates ===
SELECT 
  id,
  user_id,
  type,
  is_public,
  created_at
FROM social_updates 
ORDER BY created_at DESC 
LIMIT 10;

-- === 8. Check friendships ===
SELECT 
  user_id,
  friend_id,
  status,
  created_at
FROM friendships 
ORDER BY created_at DESC 
LIMIT 10;
