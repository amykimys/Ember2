-- Add calendar color fields to synced_calendars table
ALTER TABLE public.synced_calendars 
ADD COLUMN IF NOT EXISTS background_color TEXT,
ADD COLUMN IF NOT EXISTS foreground_color TEXT;

-- Add calendar color field to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS calendar_color TEXT;

-- Create index for calendar color queries
CREATE INDEX IF NOT EXISTS events_calendar_color_idx ON public.events(calendar_color); 