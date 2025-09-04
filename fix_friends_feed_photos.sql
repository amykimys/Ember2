-- Fix Friends Feed Function - Fix photo loading issue

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_friends_photo_shares_with_privacy(current_user_id uuid, limit_count integer);

-- Create the corrected function WITH SECURITY DEFINER but proper friendship filtering
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
SECURITY DEFINER -- Restore this to bypass RLS
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    su.id as update_id,
    su.user_id,
    COALESCE(p.full_name, 'Unknown User') as user_name,
    p.avatar_url as user_avatar,
    COALESCE(p.username, 'unknown') as user_username,
    -- Use the first photo from photos array, or fallback to photo_url
    CASE 
      WHEN su.photos IS NOT NULL AND jsonb_typeof(su.photos) = 'array' AND jsonb_array_length(su.photos) > 0 THEN 
        (su.photos->0)::text
      ELSE su.photo_url
    END as photo_url,
    -- Convert photos JSONB to text array
    CASE 
      WHEN su.photos IS NULL THEN ARRAY[]::text[]
      WHEN jsonb_typeof(su.photos) = 'array' THEN 
        (SELECT array_agg(value::text) FROM jsonb_array_elements(su.photos))
      ELSE ARRAY[su.photo_url]::text[]
    END as photos,
    -- Count photos properly
    CASE 
      WHEN su.photos IS NULL THEN 
        CASE WHEN su.photo_url IS NOT NULL AND su.photo_url != '' THEN 1 ELSE 0 END
      WHEN jsonb_typeof(su.photos) = 'array' THEN jsonb_array_length(su.photos)
      ELSE 
        CASE WHEN su.photo_url IS NOT NULL AND su.photo_url != '' THEN 1 ELSE 0 END
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
    AND (
      -- Check if there's a photo_url or photos array with content
      (su.photo_url IS NOT NULL AND su.photo_url != '')
      OR 
      (su.photos IS NOT NULL AND jsonb_typeof(su.photos) = 'array' AND jsonb_array_length(su.photos) > 0)
    )
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
