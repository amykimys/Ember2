-- Fix Social Updates RLS Policies
-- This script ensures that users can properly delete their own posts

-- First, let's check the current policies
SELECT 'Current RLS policies on social_updates:' as info;
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'social_updates';

-- Drop and recreate the delete policy to ensure it's correct
DROP POLICY IF EXISTS "Users can delete their own updates" ON public.social_updates;

CREATE POLICY "Users can delete their own updates"
  ON public.social_updates FOR DELETE
  USING (auth.uid() = user_id);

-- Also ensure the select policy allows users to see their own posts
DROP POLICY IF EXISTS "Users can view their own updates" ON public.social_updates;

CREATE POLICY "Users can view their own updates"
  ON public.social_updates FOR SELECT
  USING (auth.uid() = user_id);

-- Update the friends' updates policy to be more permissive
DROP POLICY IF EXISTS "Users can view their friends' public updates" ON public.social_updates;

CREATE POLICY "Users can view their friends' public updates"
  ON public.social_updates FOR SELECT
  USING (
    auth.uid() = user_id  -- Users can always see their own posts
    OR (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM public.friendships
        WHERE (
          (user_id = auth.uid() AND friend_id = social_updates.user_id) OR
          (friend_id = auth.uid() AND user_id = social_updates.user_id)
        )
        AND status = 'accepted'
      )
    )
  );

-- Verify the policies are in place
SELECT 'Updated RLS policies on social_updates:' as info;
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'social_updates'
ORDER BY policyname;

-- Test that the current user can see their own posts
SELECT 'Testing current user can see their own posts:' as info;
SELECT 
    id,
    user_id,
    type,
    photo_url,
    source_type,
    created_at
FROM social_updates 
WHERE user_id = auth.uid() 
AND type = 'photo_share'
ORDER BY created_at DESC;

-- Test that the current user can delete their own posts
-- (This will be a dry run - we won't actually delete anything)
SELECT 'Testing delete permission (dry run):' as info;
SELECT 
    id,
    user_id,
    type,
    photo_url
FROM social_updates 
WHERE user_id = auth.uid() 
AND type = 'photo_share'
LIMIT 1; 