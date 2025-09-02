-- Comprehensive Friends Feed Fix
-- This script addresses all potential issues with friends feed sharing and visibility

-- === 1. Fix Database Schema Issues ===

-- Ensure photo_share type is allowed
ALTER TABLE public.social_updates 
DROP CONSTRAINT IF EXISTS social_updates_type_check;

ALTER TABLE public.social_updates 
ADD CONSTRAINT social_updates_type_check 
CHECK (type IN ('goal_completion', 'journal_entry', 'streak_milestone', 'photo_share'));

-- Ensure all photo sharing columns exist
ALTER TABLE public.social_updates 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE public.social_updates 
ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('habit', 'event'));

ALTER TABLE public.social_updates 
ADD COLUMN IF NOT EXISTS source_id UUID;

ALTER TABLE public.social_updates 
ADD COLUMN IF NOT EXISTS caption TEXT;

ALTER TABLE public.social_updates 
ADD COLUMN IF NOT EXISTS photos JSONB;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS social_updates_photo_url_idx ON public.social_updates(photo_url);
CREATE INDEX IF NOT EXISTS social_updates_source_type_idx ON public.social_updates(source_type);
CREATE INDEX IF NOT EXISTS social_updates_source_id_idx ON public.social_updates(source_id);
CREATE INDEX IF NOT EXISTS social_updates_type_photo_idx ON public.social_updates(type, photo_url);

-- === 2. Fix RLS Policies ===

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their friends' public updates" ON public.social_updates;
DROP POLICY IF EXISTS "Users can view their own updates" ON public.social_updates;
DROP POLICY IF EXISTS "Users can view their own and friends' updates" ON public.social_updates;

-- Create comprehensive select policy
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

-- === 3. Fix Database Function ===

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
  photos jsonb,
  photo_count integer,
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
    su.photos,
    CASE 
      WHEN su.photos IS NOT NULL THEN jsonb_array_length(su.photos)
      WHEN su.photo_url IS NOT NULL THEN 1
      ELSE 0
    END as photo_count,
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
    AND (su.photo_url IS NOT NULL OR su.photos IS NOT NULL)
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

-- === 4. Ensure Profiles Table Has Required Columns ===

-- Add missing columns to profiles if they don't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create indexes for profiles
CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);
CREATE INDEX IF NOT EXISTS profiles_full_name_idx ON public.profiles(full_name);

-- === 5. Fix Friendships Table ===

-- Ensure friendships table has proper constraints
ALTER TABLE public.friendships 
ADD CONSTRAINT IF NOT EXISTS friendships_status_check 
CHECK (status IN ('pending', 'accepted'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS friendships_user_friend_status_idx ON public.friendships(user_id, friend_id, status);
CREATE INDEX IF NOT EXISTS friendships_friend_user_status_idx ON public.friendships(friend_id, user_id, status);

-- === 6. Create Helper Function to Debug Issues ===

CREATE OR REPLACE FUNCTION public.debug_friends_feed_issues(user_id_param uuid)
RETURNS TABLE (
  issue_type text,
  issue_description text,
  count bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user exists
  RETURN QUERY
  SELECT 'User Check'::text, 'User exists'::text, 
         CASE WHEN EXISTS(SELECT 1 FROM auth.users WHERE id = user_id_param) THEN 1::bigint ELSE 0::bigint END;
  
  -- Check if user has profile
  RETURN QUERY
  SELECT 'Profile Check'::text, 'User has profile'::text,
         CASE WHEN EXISTS(SELECT 1 FROM profiles WHERE id = user_id_param) THEN 1::bigint ELSE 0::bigint END;
  
  -- Check friendships
  RETURN QUERY
  SELECT 'Friendships'::text, 'Accepted friendships'::text,
         COUNT(*)::bigint
  FROM friendships 
  WHERE (user_id = user_id_param OR friend_id = user_id_param)
    AND status = 'accepted';
  
  -- Check photo shares
  RETURN QUERY
  SELECT 'Photo Shares'::text, 'Own photo shares'::text,
         COUNT(*)::bigint
  FROM social_updates 
  WHERE user_id = user_id_param AND type = 'photo_share';
  
  -- Check public photo shares
  RETURN QUERY
  SELECT 'Public Shares'::text, 'Public photo shares'::text,
         COUNT(*)::bigint
  FROM social_updates 
  WHERE user_id = user_id_param AND type = 'photo_share' AND is_public = true;
  
  -- Check friends' photo shares
  RETURN QUERY
  SELECT 'Friends Shares'::text, 'Friends photo shares visible'::text,
         COUNT(*)::bigint
  FROM social_updates su
  WHERE su.type = 'photo_share' 
    AND su.is_public = true
    AND su.user_id != user_id_param
    AND EXISTS (
      SELECT 1 FROM friendships f
      WHERE (
        (f.user_id = user_id_param AND f.friend_id = su.user_id) OR
        (f.friend_id = user_id_param AND f.user_id = su.user_id)
      )
      AND f.status = 'accepted'
    );
END;
$$;

-- === 7. Grant Permissions ===

-- Ensure the function can be called by authenticated users
GRANT EXECUTE ON FUNCTION public.get_friends_photo_shares_with_privacy(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_friends_feed_issues(uuid) TO authenticated;

-- === 8. Create Test Data Function ===

CREATE OR REPLACE FUNCTION public.create_test_friends_feed_data()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  user1_id uuid;
  user2_id uuid;
BEGIN
  -- Get two users for testing
  SELECT id INTO user1_id FROM auth.users LIMIT 1;
  SELECT id INTO user2_id FROM auth.users OFFSET 1 LIMIT 1;
  
  IF user1_id IS NULL OR user2_id IS NULL THEN
    RAISE NOTICE 'Need at least 2 users for testing';
    RETURN;
  END IF;
  
  -- Create friendship
  INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
  VALUES (user1_id, user2_id, 'accepted', NOW(), NOW())
  ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted';
  
  -- Create test photo share
  INSERT INTO social_updates (user_id, type, photo_url, source_type, source_id, is_public, created_at)
  VALUES (user1_id, 'photo_share', 'https://example.com/test-photo.jpg', 'habit', NULL, true, NOW())
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Test data created for users % and %', user1_id, user2_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_test_friends_feed_data() TO authenticated;
