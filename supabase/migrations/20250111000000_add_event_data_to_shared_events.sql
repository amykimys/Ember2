-- =====================================================
-- ADD EVENT_DATA COLUMN TO SHARED_EVENTS TABLE
-- =====================================================
-- This migration adds an event_data column to store event information
-- for pending shared events that haven't been accepted yet

-- Add event_data column to shared_events table
ALTER TABLE shared_events 
ADD COLUMN IF NOT EXISTS event_data JSONB;

-- Add comment to explain the column
COMMENT ON COLUMN shared_events.event_data IS 'JSON object containing event data for pending shared events';

-- Create an index for better performance when querying event_data
CREATE INDEX IF NOT EXISTS idx_shared_events_event_data ON shared_events USING GIN (event_data);

-- Update existing shared events to have event_data if they don't have it
-- This will populate event_data for any existing pending shared events
UPDATE shared_events 
SET event_data = (
  SELECT jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'description', e.description,
    'location', e.location,
    'date', e.date,
    'start_datetime', e.start_datetime,
    'end_datetime', e.end_datetime,
    'category_name', e.category_name,
    'category_color', e.category_color,
    'is_all_day', e.is_all_day,
    'photos', COALESCE(e.photos, ARRAY[]::text[])
  )
  FROM events e
  WHERE e.id = shared_events.original_event_id
)
WHERE event_data IS NULL 
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = shared_events.original_event_id
  );

-- Verify the column was added
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'shared_events' 
  AND column_name = 'event_data'; 