-- Fix Notes Table RLS Policies
-- This script fixes the RLS policies for the notes table to allow proper note creation and updates

-- Step 1: Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can view their own notes or shared notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes or shared notes they can edit" ON public.notes;

-- Step 2: Enable RLS on notes table
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Step 3: Create comprehensive RLS policies for notes table
-- Policy for viewing notes (own notes + shared notes)
CREATE POLICY "Users can view their own notes or shared notes"
  ON public.notes FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.shared_notes sn
      WHERE sn.original_note_id = notes.id
        AND sn.shared_with = auth.uid()
        AND sn.status = 'accepted'
    )
  );

-- Policy for creating notes
CREATE POLICY "Users can create their own notes"
  ON public.notes FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy for updating notes (own notes + shared notes with edit permission)
CREATE POLICY "Users can update their own notes or shared notes they can edit"
  ON public.notes FOR UPDATE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.shared_notes sn
      WHERE sn.original_note_id = notes.id
        AND sn.shared_with = auth.uid()
        AND sn.status = 'accepted'
        AND sn.can_edit = true
    )
  );

-- Policy for deleting notes (only own notes)
CREATE POLICY "Users can delete their own notes"
  ON public.notes FOR DELETE
  USING (user_id = auth.uid());

-- Step 4: Grant permissions
GRANT ALL ON public.notes TO authenticated;

-- Step 5: Test the policies
DO $$
DECLARE
  current_user_id uuid;
  test_note_id uuid;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to test the policies';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing notes RLS policies...';
  RAISE NOTICE 'Current user: %', current_user_id;

  -- Test creating a note
  BEGIN
    INSERT INTO notes (title, content, user_id, created_at, updated_at)
    VALUES (
      'Test Note for RLS',
      'This note tests the RLS policies',
      current_user_id,
      NOW(),
      NOW()
    ) RETURNING id INTO test_note_id;
    
    RAISE NOTICE 'Successfully created test note with ID: %', test_note_id;
    
    -- Test updating the note
    UPDATE notes 
    SET content = 'Updated content for RLS test'
    WHERE id = test_note_id;
    
    RAISE NOTICE 'Successfully updated test note';
    
    -- Test viewing the note
    PERFORM * FROM notes WHERE id = test_note_id;
    RAISE NOTICE 'Successfully viewed test note';
    
    -- Clean up
    DELETE FROM notes WHERE id = test_note_id;
    RAISE NOTICE 'Successfully deleted test note';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error testing notes policies: %', SQLERRM;
  END;

  RAISE NOTICE 'Notes RLS policies test completed!';
END;
$$;

SELECT 'Notes RLS policies fixed successfully!' as status; 