-- Fix profiles RLS policy to allow viewing friends' profiles
-- Run this in your Supabase SQL Editor

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create a new policy that allows viewing friends' profiles
CREATE POLICY "Users can view their own and friends' profiles"
  ON public.profiles FOR SELECT
  USING (
    -- Users can always see their own profile
    auth.uid() = id
    OR
    -- Users can see friends' profiles
    EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE (
        (f.user_id = auth.uid() AND f.friend_id = id) OR
        (f.friend_id = auth.uid() AND f.user_id = id)
      )
      AND f.status = 'accepted'
    )
  );

-- Verify the policy was created
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
