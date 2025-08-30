-- Debug profiles table and RLS policies
-- Run this in your Supabase SQL Editor

-- 1. Check if profiles table exists and has data
SELECT '=== PROFILES TABLE STRUCTURE ===' as info;
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- 2. Check how many profiles exist
SELECT '=== PROFILES COUNT ===' as info;
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- 3. Check sample profile data (this might fail due to RLS)
SELECT '=== SAMPLE PROFILES (might fail due to RLS) ===' as info;
SELECT 
  id,
  full_name,
  username,
  avatar_url,
  created_at
FROM public.profiles 
LIMIT 5;

-- 4. Check RLS policies on profiles table
SELECT '=== RLS POLICIES ON PROFILES ===' as info;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'profiles';

-- 5. Check if RLS is enabled
SELECT '=== RLS STATUS ===' as info;
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'profiles';

-- 6. Check current user context
SELECT '=== CURRENT USER CONTEXT ===' as info;
SELECT 
  current_user,
  session_user,
  auth.uid() as auth_uid;
