-- Fix Friends Feed Display - Properly show usernames and profile photos
-- This fixes the issue where usernames and avatars weren't showing up

-- Drop existing functions
DROP FUNCTION IF EXISTS public.get_friends_photo_shares_with_privacy(current_user_id uuid, limit_count integer);
DROP FUNCTION IF EXISTS public.get_friends_photo_shares(current_user_id uuid, limit_count integer);

-- Create improved function that properly fetches user profile data
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
      WHEN su.source_type = 'event' THEN 'Event Photo'
      WHEN su.source_type = 'habit' THEN 'Habit Photo'
      ELSE 'Photo Share'
    END as source_title,
    su.created_at
  FROM public.social_updates su
  LEFT JOIN public.profiles p ON su.user_id = p.id
  WHERE su.type = 'photo_share'
    AND su.photo_url IS NOT NULL
    AND su.photo_url != ''
    AND su.is_public = true
    AND (
      -- Include posts from friends
      EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE (
          (f.user_id = current_user_id AND f.friend_id = su.user_id) OR
          (friend_id = current_user_id AND user_id = su.user_id)
        )
        AND f.status = 'accepted'
      )
      -- Also include current user's own posts
      OR su.user_id = current_user_id
    )
  ORDER BY su.created_at DESC
  LIMIT limit_count;
END;
$$;


