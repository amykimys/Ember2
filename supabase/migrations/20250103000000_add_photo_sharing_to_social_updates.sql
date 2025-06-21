-- Add photo sharing functionality to social_updates table
-- Add new type for photo sharing
ALTER TABLE public.social_updates 
DROP CONSTRAINT IF EXISTS social_updates_type_check;

ALTER TABLE public.social_updates 
ADD CONSTRAINT social_updates_type_check 
CHECK (type IN ('goal_completion', 'journal_entry', 'streak_milestone', 'photo_share'));

-- Add photo_url column for photo sharing
ALTER TABLE public.social_updates 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add source_type and source_id columns to track what the photo is from (habit/event)
ALTER TABLE public.social_updates 
ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('habit', 'event'));

ALTER TABLE public.social_updates 
ADD COLUMN IF NOT EXISTS source_id UUID;

-- Add caption column for photo descriptions
ALTER TABLE public.social_updates 
ADD COLUMN IF NOT EXISTS caption TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS social_updates_photo_url_idx ON public.social_updates(photo_url);
CREATE INDEX IF NOT EXISTS social_updates_source_type_idx ON public.social_updates(source_type);
CREATE INDEX IF NOT EXISTS social_updates_source_id_idx ON public.social_updates(source_id);

-- Update the policy to allow viewing friends' photo shares
DROP POLICY IF EXISTS "Users can view their friends' public updates" ON public.social_updates;
CREATE POLICY "Users can view their friends' public updates"
  ON public.social_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE (
        (user_id = auth.uid() AND friend_id = social_updates.user_id) OR
        (friend_id = auth.uid() AND user_id = social_updates.user_id)
      )
      AND status = 'accepted'
    )
    AND is_public = true
  );

-- Create function to get friends' photo shares
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
    AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE (
        (f.user_id = current_user_id AND f.friend_id = su.user_id) OR
        (f.friend_id = current_user_id AND f.user_id = su.user_id)
      )
      AND f.status = 'accepted'
    )
  ORDER BY su.created_at DESC
  LIMIT limit_count;
END;
$$; 