-- Safe creation of synced_calendars table and policies
-- This script checks for existing objects before creating them

-- Step 1: Create synced_calendars table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.synced_calendars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_calendar_id TEXT NOT NULL,
  calendar_name TEXT NOT NULL,
  calendar_description TEXT,
  is_primary BOOLEAN DEFAULT false,
  background_color TEXT DEFAULT '#4285F4',
  foreground_color TEXT DEFAULT '#ffffff',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, google_calendar_id)
);

-- Step 2: Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS synced_calendars_user_id_idx ON public.synced_calendars(user_id);
CREATE INDEX IF NOT EXISTS synced_calendars_google_calendar_id_idx ON public.synced_calendars(google_calendar_id);

-- Step 3: Enable RLS if not already enabled
ALTER TABLE public.synced_calendars ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own synced calendars" ON public.synced_calendars;
DROP POLICY IF EXISTS "Users can create their own synced calendars" ON public.synced_calendars;
DROP POLICY IF EXISTS "Users can update their own synced calendars" ON public.synced_calendars;
DROP POLICY IF EXISTS "Users can delete their own synced calendars" ON public.synced_calendars;

-- Step 5: Create RLS policies
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

-- Step 6: Grant permissions
GRANT ALL ON synced_calendars TO authenticated;

-- Step 7: Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 8: Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS update_synced_calendars_updated_at ON synced_calendars;
CREATE TRIGGER update_synced_calendars_updated_at 
    BEFORE UPDATE ON synced_calendars 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Test the setup
DO $$
DECLARE
  current_user_id uuid;
  table_exists boolean;
  policy_count integer;
BEGIN
  -- Check if table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'synced_calendars'
  ) INTO table_exists;
  
  IF table_exists THEN
    RAISE NOTICE 'synced_calendars table exists';
  ELSE
    RAISE NOTICE 'synced_calendars table does not exist';
  END IF;
  
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename = 'synced_calendars' 
  AND schemaname = 'public';
  
  RAISE NOTICE 'Number of policies on synced_calendars: %', policy_count;
  
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to test the setup';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing synced_calendars setup...';
  RAISE NOTICE 'Current user: %', current_user_id;

  -- Test inserting a sample record
  BEGIN
    INSERT INTO public.synced_calendars (user_id, google_calendar_id, calendar_name, is_primary)
    VALUES (current_user_id, 'test-calendar-id', 'Test Calendar', false)
    ON CONFLICT (user_id, google_calendar_id) DO NOTHING;
    
    RAISE NOTICE 'Sample synced calendar record created successfully';
    
    -- Clean up test record
    DELETE FROM public.synced_calendars 
    WHERE user_id = current_user_id AND google_calendar_id = 'test-calendar-id';
    
    RAISE NOTICE 'Test record cleaned up successfully';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in synced_calendars test: %', SQLERRM;
  END;

  RAISE NOTICE 'Synced calendars setup test completed!';
END;
$$;

SELECT 'Synced calendars table and policies created/updated successfully!' as status; 