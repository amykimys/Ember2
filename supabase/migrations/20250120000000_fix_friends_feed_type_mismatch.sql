-- Fix Friends Feed Type Mismatch Issue
-- The problem is that source_id in social_updates is UUID but id in events is TEXT

-- Drop the problematic function
DROP FUNCTION IF EXISTS public.get_friends_photo_shares_with_privacy(current_user_id uuid, limit_count integer);

-- Create the fixed function that handles the type mismatch
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
    p.full_name as user_name,
    p.avatar_url as user_avatar,
    p.username as user_username,
    su.photo_url,
    su.caption,
    su.source_type,
    CASE 
      WHEN su.source_type = 'habit' THEN h.text
      WHEN su.source_type = 'event' THEN e.title
      ELSE NULL
    END as source_title,
    su.created_at
  FROM public.social_updates su
  JOIN public.profiles p ON su.user_id = p.id
  LEFT JOIN public.habits h ON su.source_type = 'habit' AND su.source_id = h.id
  LEFT JOIN public.events e ON su.source_type = 'event' AND su.source_id::text = e.id
  WHERE su.type = 'photo_share'
    AND su.is_public = true
    AND su.photo_url IS NOT NULL
    AND (
      -- Include own photos (even private ones)
      su.user_id = current_user_id
      OR
      -- Include friends' photos (but exclude private ones)
      (
        EXISTS (
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