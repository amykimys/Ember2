-- Fix Friends Feed Privacy - Remove SECURITY DEFINER to ensure RLS works
-- The issue might be that SECURITY DEFINER bypasses RLS policies

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_friends_photo_shares_with_privacy(current_user_id uuid, limit_count integer);

-- Create the corrected function WITHOUT SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_friends_photo_shares_with_privacy(current_user_id uuid, limit_count integer DEFAULT 20)
RETURNS TABLE (
  update_id uuid,
  user_id uuid,
  user_name text,
  user_avatar text,
  user_username text,
  photo_url text,
  photos text[],
  photo_count integer,
  caption text,
  source_type text,
  source_title text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
-- REMOVED: SECURITY DEFINER (this was bypassing RLS)
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
    COALESCE(array_length(su.photos, 1), 0) as photo_count,
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
      )
    )
  ORDER BY su.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_friends_photo_shares_with_privacy(uuid, integer) TO authenticated;
