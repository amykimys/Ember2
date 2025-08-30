-- TEMPORARY: Disable RLS on profiles table for testing
-- WARNING: This makes profiles publicly readable - only use for testing!
-- Run this in your Supabase SQL Editor

-- 1. Temporarily disable RLS on profiles table
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Verify RLS is disabled
SELECT '=== RLS STATUS AFTER DISABLE ===' as info;
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'profiles';

-- 3. Test if we can now read profiles
SELECT '=== TESTING PROFILES ACCESS ===' as info;
SELECT 
  id,
  full_name,
  username,
  avatar_url,
  created_at
FROM public.profiles 
LIMIT 5;

-- 4. Check total count
SELECT '=== TOTAL PROFILES ===' as info;
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- IMPORTANT: After testing, re-enable RLS with proper policies:
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Then run the fix_profiles_rls_for_friends.sql script
