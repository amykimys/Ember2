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
          (f.friend_id = current_user_id AND f.user_id = su.user_id)
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

-- Test the function
SELECT 'Testing improved friends feed function:' as info;
SELECT 
    update_id,
    user_name,
    user_username,
    user_avatar,
    photo_url,
    caption,
    source_type,
    source_title,
    created_at
FROM get_friends_photo_shares_with_privacy(
    auth.uid(), -- Current user ID
    10
)
ORDER BY created_at DESC;

-- Show current photo shares
SELECT 'Current photo shares in social_updates:' as info;
SELECT 
    su.id,
    su.user_id,
    su.type,
    su.source_type,
    su.caption,
    su.photo_url,
    su.created_at
FROM social_updates su
WHERE su.type = 'photo_share'
ORDER BY su.created_at DESC
LIMIT 10;

-- Show profiles for users who have posted
SELECT 'Profiles for users who have posted:' as info;
SELECT 
    p.id,
    p.full_name,
    p.username,
    p.avatar_url,
    COUNT(su.id) as post_count
FROM profiles p
JOIN social_updates su ON p.id = su.user_id
WHERE su.type = 'photo_share'
GROUP BY p.id, p.full_name, p.username, p.avatar_url
ORDER BY post_count DESC;


