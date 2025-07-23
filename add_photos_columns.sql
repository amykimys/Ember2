-- Add photos and private_photos array columns to events table
-- This allows events to store multiple photos with privacy control

-- Add photos array column for public photos
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add private_photos array column for private photos
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS private_photos TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create indexes for better performance when querying photos
CREATE INDEX IF NOT EXISTS events_photos_idx ON public.events USING GIN (photos);
CREATE INDEX IF NOT EXISTS events_private_photos_idx ON public.events USING GIN (private_photos);

-- Add comments to explain the columns
COMMENT ON COLUMN public.events.photos IS 'Array of public photo URLs for this event';
COMMENT ON COLUMN public.events.private_photos IS 'Array of private photo URLs for this event (only visible to the owner)';

-- Verify the columns were added
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name IN ('photos', 'private_photos')
ORDER BY column_name; 