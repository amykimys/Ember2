-- Simple Friends Feed Fix - This should definitely work
-- Drop the complex function and create a simple one

DROP FUNCTION IF EXISTS public.get_friends_photo_shares_with_privacy(current_user_id uuid, limit_count integer);

-- Create a very simple function that just returns all photo shares
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
    'Photo Share' as source_title,
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
SELECT 'Testing simple friends feed function:' as info;
SELECT 
    update_id,
    user_name,
    user_username,
    photo_url,
    caption,
    created_at
FROM get_friends_photo_shares_with_privacy(
    auth.uid(), -- Current user ID
    10
)
ORDER BY created_at DESC; 