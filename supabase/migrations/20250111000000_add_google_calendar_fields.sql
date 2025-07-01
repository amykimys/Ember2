-- Add Google Calendar metadata fields to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS is_google_event BOOLEAN DEFAULT FALSE;

-- Create index for Google Calendar queries
CREATE INDEX IF NOT EXISTS events_google_calendar_id_idx ON public.events(google_calendar_id);
CREATE INDEX IF NOT EXISTS events_is_google_event_idx ON public.events(is_google_event);

-- Create synced_calendars table to track which calendars are synced for each user
CREATE TABLE IF NOT EXISTS public.synced_calendars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  google_calendar_id TEXT NOT NULL,
  calendar_name TEXT NOT NULL,
  calendar_description TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure unique combination of user and calendar
  UNIQUE(user_id, google_calendar_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS synced_calendars_user_id_idx ON public.synced_calendars(user_id);
CREATE INDEX IF NOT EXISTS synced_calendars_google_calendar_id_idx ON public.synced_calendars(google_calendar_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.synced_calendars ENABLE ROW LEVEL SECURITY;

-- Create policies for synced_calendars
CREATE POLICY "Users can view their own synced calendars"
  ON public.synced_calendars FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own synced calendars"
  ON public.synced_calendars FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own synced calendars"
  ON public.synced_calendars FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own synced calendars"
  ON public.synced_calendars FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to handle updated_at for synced_calendars
CREATE OR REPLACE FUNCTION public.handle_synced_calendars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS handle_synced_calendars_updated_at ON public.synced_calendars;
CREATE TRIGGER handle_synced_calendars_updated_at
  BEFORE UPDATE ON public.synced_calendars
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_synced_calendars_updated_at(); 