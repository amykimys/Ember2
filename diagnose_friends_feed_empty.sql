-- Diagnostic script to check friends feed issues
-- This will help us understand why no posts are showing up

-- === 1. Check if there are any posts in social_updates ===
SELECT 
  COUNT(*) as total_posts,
  COUNT(CASE WHEN type = 'photo_share' THEN 1 END) as photo_shares,
  COUNT(CASE WHEN is_public = true THEN 1 END) as public_posts,
  COUNT(CASE WHEN is_public = false THEN 1 END) as private_posts
FROM social_updates;

-- === 2. Check if there are any friendships ===
SELECT 
  COUNT(*) as total_friendships,
  COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_friendships,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_friendships
FROM friendships;

-- === 3. Check if the function exists ===
SELECT 
  proname,
  prosrc IS NOT NULL as has_source,
  prosrc LIKE '%SECURITY DEFINER%' as has_security_definer
FROM pg_proc 
WHERE proname = 'get_friends_photo_shares_with_privacy';

-- === 4. Check RLS policies on social_updates ===
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'social_updates';

-- === 5. Check if RLS is enabled ===
SELECT 
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'social_updates';

-- === 6. Test the function with a specific user (replace with actual user ID) ===
-- First, let's see what users exist
SELECT id, full_name, username FROM profiles LIMIT 5;

-- === 7. Check if there are any posts from friends ===
-- This will help us see if the issue is with the function or the data
SELECT 
  su.id,
  su.user_id,
  su.type,
  su.is_public,
  su.created_at,
  p.full_name as poster_name
FROM social_updates su
LEFT JOIN profiles p ON su.user_id = p.id
WHERE su.type = 'photo_share'
ORDER BY su.created_at DESC
LIMIT 10;
