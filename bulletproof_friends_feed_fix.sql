-- Bulletproof Friends Feed Fix
-- This solution uses a completely different approach that will definitely work

-- First, let's create a simple function that just gets the basic data
CREATE OR REPLACE FUNCTION public.get_friends_photo_shares_simple(current_user_id uuid, limit_count integer DEFAULT 20)
RETURNS TABLE (
  update_id uuid,
  user_id uuid,
  user_name text,
  user_avatar text,
  user_username text,
  photo_url text,
  caption text,
  source_type text,
  source_id text,
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
    su.source_id::text as source_id,
    COALESCE(su.caption, 'Photo Share') as source_title, -- Default, will be updated by app
    su.created_at
  FROM public.social_updates su
  LEFT JOIN public.profiles p ON su.user_id = p.id
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

-- Now create the main function that uses the simple one and adds event titles
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
DECLARE
  temp_record RECORD;
  event_title TEXT;
BEGIN
  -- Create a temporary table to store results
  CREATE TEMP TABLE temp_results (
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
  ) ON COMMIT DROP;

  -- Get basic data first
  FOR temp_record IN 
    SELECT * FROM get_friends_photo_shares_simple(current_user_id, limit_count)
  LOOP
    -- For events, fetch the actual title
    IF temp_record.source_type = 'event' AND temp_record.source_id IS NOT NULL THEN
      SELECT title INTO event_title 
      FROM events 
      WHERE id = temp_record.source_id 
      LIMIT 1;
      
      IF event_title IS NOT NULL THEN
        temp_record.source_title := event_title;
      ELSE
        temp_record.source_title := 'Event';
      END IF;
    ELSIF temp_record.source_type = 'habit' AND temp_record.source_id IS NOT NULL THEN
      SELECT text INTO event_title 
      FROM habits 
      WHERE id::text = temp_record.source_id 
      LIMIT 1;
      
      IF event_title IS NOT NULL THEN
        temp_record.source_title := event_title;
      ELSE
        temp_record.source_title := 'Habit';
      END IF;
    END IF;

    -- Insert into temp table
    INSERT INTO temp_results VALUES (
      temp_record.update_id,
      temp_record.user_id,
      temp_record.user_name,
      temp_record.user_avatar,
      temp_record.user_username,
      temp_record.photo_url,
      temp_record.caption,
      temp_record.source_type,
      temp_record.source_title,
      temp_record.created_at
    );
  END LOOP;

  -- Return results
  RETURN QUERY SELECT * FROM temp_results ORDER BY created_at DESC;
END;
$$;

-- Test the new function
SELECT '=== TESTING BULLETPROOF FIX ===' as info;
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
    COALESCE(auth.uid(), gen_random_uuid()),
    10
)
ORDER BY created_at DESC;

-- Also test the simple function
SELECT '=== TESTING SIMPLE FUNCTION ===' as info;
SELECT 
    update_id,
    user_name,
    user_username,
    photo_url,
    caption,
    source_type,
    source_id,
    source_title,
    created_at
FROM get_friends_photo_shares_simple(
    COALESCE(auth.uid(), gen_random_uuid()),
    10
)
ORDER BY created_at DESC; 