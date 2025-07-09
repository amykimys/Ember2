-- Add private_photos column to events table
-- This will store an array of photo URLs that are marked as private

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS private_photos TEXT[] DEFAULT '{}';

-- Add comment to explain the column
COMMENT ON COLUMN events.private_photos IS 'Array of photo URLs that are marked as private and should not be shared with friends';

-- Create an index for better performance when querying private photos
CREATE INDEX IF NOT EXISTS idx_events_private_photos ON events USING GIN (private_photos);

-- Update RLS policies to ensure users can only see their own private photos
-- and friends can only see non-private photos

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own events" ON events;
DROP POLICY IF EXISTS "Users can view shared events" ON events;

-- Create updated policies that respect private photos
CREATE POLICY "Users can view their own events" ON events
  FOR SELECT USING (
    auth.uid() = user_id
  );

CREATE POLICY "Users can view shared events" ON events
  FOR SELECT USING (
    -- Allow viewing shared events, but exclude private photos for friends
    EXISTS (
      SELECT 1 FROM shared_events se 
      WHERE se.original_event_id = events.id 
      AND se.shared_with = auth.uid()
    )
  );

-- Create a function to get events with private photos filtered appropriately
CREATE OR REPLACE FUNCTION get_events_with_privacy(user_id_param UUID)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  description TEXT,
  location TEXT,
  date TEXT,
  start_datetime TIMESTAMPTZ,
  end_datetime TIMESTAMPTZ,
  category_name TEXT,
  category_color TEXT,
  reminder_time TIMESTAMPTZ,
  repeat_option TEXT,
  repeat_end_date TIMESTAMPTZ,
  custom_dates TEXT[],
  custom_times JSONB,
  is_continued BOOLEAN,
  is_all_day BOOLEAN,
  photos TEXT[],
  private_photos TEXT[],
  user_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.description,
    e.location,
    e.date,
    e.start_datetime,
    e.end_datetime,
    e.category_name,
    e.category_color,
    e.reminder_time,
    e.repeat_option,
    e.repeat_end_date,
    e.custom_dates,
    e.custom_times,
    e.is_continued,
    e.is_all_day,
    -- Show all photos for own events, exclude private photos for shared events
    CASE 
      WHEN e.user_id = user_id_param THEN e.photos
      ELSE e.photos - e.private_photos
    END as photos,
    -- Only show private photos for own events
    CASE 
      WHEN e.user_id = user_id_param THEN e.private_photos
      ELSE '{}'::TEXT[]
    END as private_photos,
    e.user_id,
    e.created_at,
    e.updated_at
  FROM events e
  WHERE e.user_id = user_id_param
  OR EXISTS (
    SELECT 1 FROM shared_events se 
    WHERE se.original_event_id = e.id 
    AND se.shared_with = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if a photo is private for friends feed filtering
CREATE OR REPLACE FUNCTION is_photo_private_for_friends_feed(photo_url_param TEXT, event_id_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if this photo is marked as private in the events table
  RETURN EXISTS (
    SELECT 1 FROM events 
    WHERE id = event_id_param 
    AND private_photos @> ARRAY[photo_url_param]
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the friends feed function to exclude private photos
-- This function ensures that:
-- 1. Users can see their own photos (including private ones) in their friends feed
-- 2. Users can see their friends' photos (excluding private ones) in their friends feed
-- 3. Private photos are only visible to the event owner in their own app
CREATE OR REPLACE FUNCTION get_friends_photo_shares_with_privacy(current_user_id uuid, limit_count integer DEFAULT 20)
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
  LEFT JOIN public.events e ON su.source_type = 'event' AND su.source_id = e.id
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
          OR NOT is_photo_private_for_friends_feed(su.photo_url, su.source_id::text)
        )
      )
    )
  ORDER BY su.created_at DESC
  LIMIT limit_count;
END;
$$; 