-- Fix Event Titles in Friends Feed
-- This script ensures event titles are properly displayed

-- First, let's debug what we have
SELECT '=== DEBUGGING EVENT DATA ===' as info;

-- Check events table structure
SELECT 'Events table structure:' as info;
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'events' 
    AND column_name IN ('id', 'title');

-- Check social_updates table structure
SELECT 'Social_updates table structure:' as info;
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'social_updates' 
    AND column_name IN ('source_id', 'source_type');

-- Check what events exist
SELECT 'Sample events:' as info;
SELECT 
    id,
    title,
    created_at
FROM events 
ORDER BY created_at DESC
LIMIT 5;

-- Check what social updates exist for events
SELECT 'Social updates for events:' as info;
SELECT 
    su.id,
    su.source_id,
    su.source_type,
    su.photo_url,
    e.id as event_id,
    e.title as event_title
FROM social_updates su
LEFT JOIN events e ON su.source_id::text = e.id
WHERE su.type = 'photo_share' 
    AND su.source_type = 'event'
ORDER BY su.created_at DESC
LIMIT 10;

-- Now create the fixed function
DROP FUNCTION IF EXISTS public.get_friends_photo_shares_with_privacy(current_user_id uuid, limit_count integer);

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
        -- Get habit text
        COALESCE(
          (SELECT text FROM habits WHERE id = su.source_id::uuid LIMIT 1),
          'Habit'
        )
      WHEN su.source_type = 'event' AND su.source_id IS NOT NULL THEN 
        -- Get event title - try multiple approaches
        COALESCE(
          (SELECT title FROM events WHERE id = su.source_id::text LIMIT 1),
          (SELECT title FROM events WHERE id::text = su.source_id::text LIMIT 1),
          (SELECT title FROM events WHERE id = su.source_id LIMIT 1),
          'Event'
        )
      ELSE 
        COALESCE(su.caption, 'Photo Share')
    END as source_title,
    su.created_at
  FROM public.social_updates su
  LEFT JOIN public.profiles p ON su.user_id = p.id
  WHERE su.type = 'photo_share'
    AND su.photo_url IS NOT NULL
    AND su.photo_url != ''
  ORDER BY su.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Test the function
SELECT '=== TESTING FIXED FUNCTION ===' as info;
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

-- Show the results with more detail
SELECT '=== DETAILED RESULTS ===' as info;
SELECT 
    su.id as update_id,
    p.full_name as user_name,
    p.username as user_username,
    su.photo_url,
    su.caption,
    su.source_type,
    su.source_id,
    CASE 
      WHEN su.source_type = 'habit' THEN 
        (SELECT text FROM habits WHERE id = su.source_id::uuid LIMIT 1)
      WHEN su.source_type = 'event' THEN 
        (SELECT title FROM events WHERE id = su.source_id::text LIMIT 1)
      ELSE 'Unknown'
    END as source_title,
    su.created_at
FROM social_updates su
LEFT JOIN profiles p ON su.user_id = p.id
WHERE su.type = 'photo_share'
    AND su.photo_url IS NOT NULL
ORDER BY su.created_at DESC
LIMIT 10; 