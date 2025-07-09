-- Fix Friends Feed Event Titles
-- Replace the hardcoded "Event Photo" with actual event titles
-- Run this SQL in your Supabase SQL editor

-- Drop the problematic function that has hardcoded fallbacks
DROP FUNCTION IF EXISTS public.get_friends_photo_shares_with_privacy(current_user_id uuid, limit_count integer);

-- Create the corrected function that fetches actual event titles
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
        COALESCE(h.text, 'Habit')
      WHEN su.source_type = 'event' AND su.source_id IS NOT NULL THEN 
        COALESCE(e.title, 'Event')
      ELSE 
        COALESCE(su.caption, 'Photo Share')
    END as source_title,
    su.created_at
  FROM public.social_updates su
  LEFT JOIN public.profiles p ON su.user_id = p.id
  LEFT JOIN public.habits h ON su.source_type = 'habit' AND su.source_id::text = h.id::text
  LEFT JOIN public.events e ON su.source_type = 'event' AND su.source_id::text = e.id
  WHERE su.type = 'photo_share'
    AND su.is_public = true
    AND su.photo_url IS NOT NULL
    AND su.photo_url != ''
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

-- Test the function to make sure it works
SELECT 'Testing fixed friends feed function:' as info;
SELECT 
    update_id,
    user_name,
    user_username,
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

-- Show debugging info to verify event titles are being fetched
SELECT 'Debug: Social updates with source info:' as info;
SELECT 
    su.id,
    su.source_type,
    su.source_id,
    CASE 
        WHEN su.source_type = 'event' THEN 
            (SELECT title FROM events WHERE id = su.source_id::text LIMIT 1)
        ELSE 
            'Not an event'
    END as found_event_title
FROM social_updates su
WHERE su.type = 'photo_share' 
    AND su.source_type = 'event'
ORDER BY su.created_at DESC
LIMIT 5; 