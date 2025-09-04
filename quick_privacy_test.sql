-- Quick test to check if friends feed privacy is working
-- This will help us understand if the issue is in the database function or elsewhere

-- Test 1: Check if the function exists and what it returns
SELECT 
  proname,
  prosrc IS NOT NULL as has_source
FROM pg_proc 
WHERE proname = 'get_friends_photo_shares_with_privacy';

-- Test 2: Check RLS policies on social_updates
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'social_updates';

-- Test 3: Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'social_updates';
