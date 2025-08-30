-- Add support for multiple photos in a single social update post
-- This allows users to post multiple photos as one post (like Instagram)

-- Add photos column to store multiple photo URLs as JSONB array
ALTER TABLE public.social_updates 
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';

-- Add photo_count column for easier querying
ALTER TABLE public.social_updates 
ADD COLUMN IF NOT EXISTS photo_count INTEGER DEFAULT 0;

-- Create a function to automatically update photo_count when photos array changes
CREATE OR REPLACE FUNCTION public.update_photo_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update photo_count based on the length of the photos array
  IF NEW.photos IS NOT NULL THEN
    NEW.photo_count = jsonb_array_length(NEW.photos);
  ELSE
    NEW.photo_count = 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update photo_count
DROP TRIGGER IF EXISTS trigger_update_photo_count ON public.social_updates;
CREATE TRIGGER trigger_update_photo_count
  BEFORE INSERT OR UPDATE ON public.social_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_photo_count();

-- Add index for photos column
CREATE INDEX IF NOT EXISTS social_updates_photos_idx ON public.social_updates USING GIN (photos);

-- Add index for photo_count column
CREATE INDEX IF NOT EXISTS social_updates_photo_count_idx ON public.social_updates(photo_count);

-- Drop the existing function first since we're changing the return type
DROP FUNCTION IF EXISTS public.get_friends_photo_shares_with_privacy(uuid, integer);

-- Create the updated function to handle multiple photos
CREATE FUNCTION public.get_friends_photo_shares_with_privacy(current_user_id uuid, limit_count integer DEFAULT 20)
RETURNS TABLE (
  update_id uuid,
  user_id uuid,
  user_name text,
  user_avatar text,
  user_username text,
  photo_url text,
  photos jsonb,
  photo_count integer,
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
    su.photo_url, -- Keep for backward compatibility
    su.photos,    -- New multiple photos array
    su.photo_count, -- New photo count
    su.caption,
    su.source_type,
    CASE 
      WHEN su.source_type = 'habit' THEN h.text
      ELSE NULL
    END as source_title,
    su.created_at
  FROM public.social_updates su
  JOIN public.profiles p ON su.user_id = p.id
  LEFT JOIN public.habits h ON su.source_type = 'habit' AND su.source_id IS NOT NULL AND su.source_id::uuid = h.id
  WHERE su.type = 'photo_share'
    AND su.is_public = true
    AND (
      su.photo_url IS NOT NULL OR 
      (su.photos IS NOT NULL AND jsonb_array_length(su.photos) > 0)
    )
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

-- Update the constraint to allow 'event' as a source_type for daily bits
ALTER TABLE public.social_updates 
DROP CONSTRAINT IF EXISTS social_updates_source_type_check;

ALTER TABLE public.social_updates 
ADD CONSTRAINT social_updates_source_type_check 
CHECK (source_type IN ('habit', 'event'));

-- Make source_id nullable since events don't have a UUID reference
ALTER TABLE public.social_updates 
ALTER COLUMN source_id DROP NOT NULL;

-- Add comment to explain the new structure
COMMENT ON COLUMN public.social_updates.photos IS 'JSONB array of photo URLs for multiple photo posts';
COMMENT ON COLUMN public.social_updates.photo_count IS 'Number of photos in the photos array, automatically maintained by trigger';
COMMENT ON COLUMN public.social_updates.source_type IS 'Type of source: habit (from habits) or event (daily bits)';
