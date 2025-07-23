-- Fix Friends Feed Privacy - Ensure Only Mutual Friends Can See Posts
-- This script fixes the RLS policies and database function to properly filter posts

-- First, let's check the current state
SELECT '=== CURRENT STATE ANALYSIS ===' as info;

-- Check current RLS policies
SELECT 'Current RLS policies on social_updates:' as info;
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'social_updates'
ORDER BY policyname;

-- Check current friendships
SELECT 'Current friendships for testing:' as info;
SELECT 
    f.user_id,
    f.friend_id,
    f.status,
    p1.full_name as user_name,
    p2.full_name as friend_name
FROM friendships f
JOIN profiles p1 ON f.user_id = p1.id
JOIN profiles p2 ON f.friend_id = p2.id
WHERE f.status = 'accepted'
ORDER BY f.created_at DESC
LIMIT 10;

-- Check current social updates
SELECT 'Current social updates:' as info;
SELECT 
    su.id,
    su.user_id,
    su.type,
    su.photo_url,
    su.is_public,
    su.created_at,
    p.full_name as user_name
FROM social_updates su
JOIN profiles p ON su.user_id = p.id
WHERE su.type = 'photo_share'
ORDER BY su.created_at DESC
LIMIT 10;

-- === FIX 1: Update RLS Policies ===
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their friends' public updates" ON public.social_updates;
DROP POLICY IF EXISTS "Users can view their own updates" ON public.social_updates;

-- Create comprehensive select policy that only allows:
-- 1. Users to see their own posts (regardless of privacy)
-- 2. Users to see friends' posts (only if public)
CREATE POLICY "Users can view their own and friends' updates"
  ON public.social_updates FOR SELECT
  USING (
    -- Users can always see their own posts
    auth.uid() = user_id
    OR (
      -- Users can see friends' posts only if they are public
      is_public = true
      AND EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE (
          (f.user_id = auth.uid() AND f.friend_id = social_updates.user_id) OR
          (f.friend_id = auth.uid() AND f.user_id = social_updates.user_id)
        )
        AND f.status = 'accepted'
      )
    )
  );

-- Ensure other policies are in place
DROP POLICY IF EXISTS "Users can create their own updates" ON public.social_updates;
CREATE POLICY "Users can create their own updates"
  ON public.social_updates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own updates" ON public.social_updates;
CREATE POLICY "Users can update their own updates"
  ON public.social_updates FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own updates" ON public.social_updates;
CREATE POLICY "Users can delete their own updates"
  ON public.social_updates FOR DELETE
  USING (auth.uid() = user_id);

-- === FIX 2: Update Database Function ===
-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_friends_photo_shares_with_privacy(current_user_id uuid, limit_count integer);

-- Create the corrected function with proper friendship filtering
CREATE OR REPLACE FUNCTION public.get_friends_photo_shares_with_privacy(current_user_id uuid, limit_count integer DEFAULT 20)
RETURNS TABLE (
  update_id uuid,
  user_id uuid,
  user_name text,
  user_avatar text,
  user_username text,
  photo_url text,
  caption text,
  source_type text,
  source_title text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    su.id as update_id,
    su.user_id,
    COALESCE(p.full_name, 'Unknown User') as user_name,
    p.avatar_url as user_avatar,
    COALESCE(p.username, 'unknown') as user_username,
    su.photo_url,
    COALESCE(su.caption, '') as caption,
    COALESCE(su.source_type, 'unknown') as source_type,
    CASE 
      WHEN su.source_type = 'habit' AND su.source_id IS NOT NULL THEN 
        COALESCE((SELECT text FROM habits WHERE id::text = su.source_id::text LIMIT 1), 'Habit')
      WHEN su.source_type = 'event' AND su.source_id IS NOT NULL THEN 
        COALESCE((SELECT title FROM events WHERE id = su.source_id::text LIMIT 1), 'Event')
      ELSE 
        COALESCE(su.caption, 'Photo Share')
    END as source_title,
    su.created_at
  FROM public.social_updates su
  LEFT JOIN public.profiles p ON su.user_id = p.id
  WHERE su.type = 'photo_share'
    AND su.photo_url IS NOT NULL
    AND su.photo_url != ''
    AND (
      -- Include own photos (even private ones)
      su.user_id = current_user_id
      OR
      -- Include friends' photos (but exclude private ones)
      (
        su.is_public = true
        AND EXISTS (
          SELECT 1 FROM public.friendships f
          WHERE (
            (f.user_id = current_user_id AND f.friend_id = su.user_id) OR
            (f.friend_id = current_user_id AND f.user_id = su.user_id)
          )
          AND f.status = 'accepted'
        )
        AND (
          su.source_type != 'event' 
          OR NOT EXISTS (
            SELECT 1 FROM events ev
            WHERE ev.id = su.source_id::text 
            AND ev.private_photos @> ARRAY[su.photo_url]
          )
        )
      )
    )
  ORDER BY su.created_at DESC
  LIMIT limit_count;
END;
$$;

-- === FIX 3: Verify the Fix ===
-- Test the updated function
SELECT '=== TESTING UPDATED FRIENDS FEED FUNCTION ===' as info;
SELECT 
    update_id,
    user_name,
    user_username,
    source_type,
    source_title,
    created_at
FROM get_friends_photo_shares_with_privacy(
    COALESCE(auth.uid(), gen_random_uuid()),
    10
)
ORDER BY created_at DESC;

-- Test RLS policies
SELECT '=== TESTING RLS POLICIES ===' as info;
SELECT 
    su.id,
    su.user_id,
    su.type,
    su.is_public,
    p.full_name as user_name
FROM social_updates su
JOIN profiles p ON su.user_id = p.id
WHERE su.type = 'photo_share'
ORDER BY su.created_at DESC
LIMIT 5;

-- Show final policy state
SELECT '=== FINAL RLS POLICIES ===' as info;
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'social_updates'
ORDER BY policyname;

-- Summary
SELECT '=== FIX SUMMARY ===' as info;
SELECT 
    'Friends feed privacy fixed' as status,
    'Only mutual friends can now see each other posts' as description,
    'RLS policies and database function updated' as changes; 