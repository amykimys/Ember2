-- Fix social_updates table for photo sharing
-- Run this in your Supabase SQL Editor

-- 1. Update the type constraint to allow photo_share
ALTER TABLE public.social_updates 
DROP CONSTRAINT IF EXISTS social_updates_type_check;

ALTER TABLE public.social_updates 
ADD CONSTRAINT social_updates_type_check 
CHECK (type IN ('goal_completion', 'journal_entry', 'streak_milestone', 'photo_share'));

-- 2. Add missing columns for photo sharing
ALTER TABLE public.social_updates 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE public.social_updates 
ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('habit', 'event'));

ALTER TABLE public.social_updates 
ADD COLUMN IF NOT EXISTS source_id UUID;

ALTER TABLE public.social_updates 
ADD COLUMN IF NOT EXISTS caption TEXT;

-- 3. Add indexes for better performance
CREATE INDEX IF NOT EXISTS social_updates_photo_url_idx ON public.social_updates(photo_url);
CREATE INDEX IF NOT EXISTS social_updates_source_type_idx ON public.social_updates(source_type);
CREATE INDEX IF NOT EXISTS social_updates_source_id_idx ON public.social_updates(source_id);

-- 4. Verify the changes
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'social_updates' 
ORDER BY ordinal_position;
