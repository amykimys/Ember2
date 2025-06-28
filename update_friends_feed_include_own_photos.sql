-- Update Friends Feed to Include Own Photos
-- This script updates the get_friends_photo_shares function to include the user's own photo shares

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_friends_photo_shares(current_user_id uuid, limit_count integer);

-- Create the updated function that includes own photos
CREATE OR REPLACE FUNCTION public.get_friends_photo_shares(current_user_id uuid, limit_count integer DEFAULT 20)
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
      -- Include own photos
      su.user_id = current_user_id
      OR
      -- Include friends' photos
      EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE (
          (f.user_id = current_user_id AND f.friend_id = su.user_id) OR
          (f.friend_id = current_user_id AND f.user_id = su.user_id)
        )
        AND f.status = 'accepted'
      )
    )
  ORDER BY su.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Test the updated function
-- Replace 'YOUR_USER_ID' with your actual user ID to test
SELECT 'Testing updated friends feed function:' as info;
SELECT 
    update_id,
    user_name,
    user_username,
    photo_url,
    caption,
    source_type,
    source_title,
    created_at
FROM get_friends_photo_shares(
    'YOUR_USER_ID'::UUID, -- Replace with your actual user ID
    10
)
ORDER BY created_at DESC;

-- Show all photo shares in the database for verification
SELECT 'All photo shares in database:' as info;
SELECT 
    su.id,
    su.user_id,
    p.full_name as user_name,
    p.username as user_username,
    su.type,
    su.photo_url,
    su.caption,
    su.source_type,
    su.source_id,
    su.is_public,
    su.created_at
FROM social_updates su
JOIN profiles p ON su.user_id = p.id
WHERE su.type = 'photo_share'
ORDER BY su.created_at DESC; 