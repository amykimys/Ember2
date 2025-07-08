-- Fix profiles RLS to allow viewing friends' profiles for shared events
-- This allows users to see their friends' profile photos in shared events

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create a new policy that allows users to view:
-- 1. Their own profile
-- 2. Their friends' profiles (for shared events, friend requests, etc.)
CREATE POLICY "Users can view their own and friends' profiles" ON public.profiles
FOR SELECT USING (
  auth.uid() = id OR
  id IN (
    SELECT friend_id FROM public.friendships 
    WHERE user_id = auth.uid() AND status = 'accepted'
    UNION
    SELECT user_id FROM public.friendships 
    WHERE friend_id = auth.uid() AND status = 'accepted'
  )
);

-- Also allow viewing profiles of users who have sent friend requests
CREATE POLICY "Users can view profiles of friend request senders" ON public.profiles
FOR SELECT USING (
  id IN (
    SELECT user_id FROM public.friendships 
    WHERE friend_id = auth.uid() AND status = 'pending'
  )
); 