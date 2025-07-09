-- Simple test to check and create shared_notes table

-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'shared_notes'
) as table_exists;

-- If table doesn't exist, create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'shared_notes'
  ) THEN
    -- Create shared_notes table
    CREATE TABLE public.shared_notes (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      original_note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
      shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
      can_edit BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(original_note_id, shared_by, shared_with)
    );

    -- Add indexes
    CREATE INDEX IF NOT EXISTS shared_notes_original_note_id_idx ON public.shared_notes(original_note_id);
    CREATE INDEX IF NOT EXISTS shared_notes_shared_by_idx ON public.shared_notes(shared_by);
    CREATE INDEX IF NOT EXISTS shared_notes_shared_with_idx ON public.shared_notes(shared_with);
    CREATE INDEX IF NOT EXISTS shared_notes_status_idx ON public.shared_notes(status);

    -- Enable RLS
    ALTER TABLE public.shared_notes ENABLE ROW LEVEL SECURITY;

    -- Create RLS policies
    CREATE POLICY "Users can view shared notes they're involved in"
      ON public.shared_notes FOR SELECT
      USING (auth.uid() = shared_by OR auth.uid() = shared_with);

    CREATE POLICY "Users can create shared notes"
      ON public.shared_notes FOR INSERT
      WITH CHECK (auth.uid() = shared_by);

    CREATE POLICY "Recipients can update shared notes"
      ON public.shared_notes FOR UPDATE
      USING (auth.uid() = shared_with);

    CREATE POLICY "Users can delete their own shares"
      ON public.shared_notes FOR DELETE
      USING (auth.uid() = shared_by);

    -- Grant permissions
    GRANT ALL ON shared_notes TO authenticated;

    RAISE NOTICE 'shared_notes table created successfully';
  ELSE
    RAISE NOTICE 'shared_notes table already exists';
  END IF;
END $$;

-- Verify table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'shared_notes'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename = 'shared_notes'; 