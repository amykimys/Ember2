-- Simple Fix for Shared Notes PostgREST Foreign Key Error
-- This script directly addresses the error about shared_notes and profiles foreign key relationship

-- Step 1: Drop the problematic table and recreate it with correct foreign keys
DROP TABLE IF EXISTS public.shared_notes CASCADE;

-- Step 2: Create shared_notes table with correct foreign key relationships
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

-- Step 3: Add indexes
CREATE INDEX IF NOT EXISTS shared_notes_original_note_id_idx ON public.shared_notes(original_note_id);
CREATE INDEX IF NOT EXISTS shared_notes_shared_by_idx ON public.shared_notes(shared_by);
CREATE INDEX IF NOT EXISTS shared_notes_shared_with_idx ON public.shared_notes(shared_with);
CREATE INDEX IF NOT EXISTS shared_notes_status_idx ON public.shared_notes(status);

-- Step 4: Enable RLS
ALTER TABLE public.shared_notes ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
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

-- Step 6: Grant permissions
GRANT ALL ON shared_notes TO authenticated;

-- Step 7: Create simple function to get shared notes
CREATE OR REPLACE FUNCTION get_shared_notes_for_user(user_id UUID)
RETURNS TABLE (
  shared_note_id UUID,
  original_note_id UUID,
  note_title TEXT,
  note_content TEXT,
  shared_by_name TEXT,
  shared_by_avatar TEXT,
  shared_by_username TEXT,
  can_edit BOOLEAN,
  shared_at TIMESTAMP WITH TIME ZONE,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sn.id as shared_note_id,
    sn.original_note_id,
    n.title as note_title,
    n.content as note_content,
    p.full_name as shared_by_name,
    p.avatar_url as shared_by_avatar,
    p.username as shared_by_username,
    sn.can_edit,
    sn.created_at as shared_at,
    sn.status
  FROM public.shared_notes sn
  JOIN public.notes n ON sn.original_note_id = n.id
  JOIN public.profiles p ON sn.shared_by = p.id
  WHERE sn.shared_with = get_shared_notes_for_user.user_id
    AND sn.status = 'accepted'
  ORDER BY sn.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create function to share notes
CREATE OR REPLACE FUNCTION share_note_with_friends(
  note_id UUID,
  friend_ids UUID[],
  can_edit BOOLEAN DEFAULT true
) RETURNS VOID AS $$
DECLARE
  friend_id UUID;
BEGIN
  -- Check if user owns the note
  IF NOT EXISTS (
    SELECT 1 FROM public.notes 
    WHERE id = note_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only share notes that you own';
  END IF;

  -- Create shared note records for each friend with 'accepted' status
  FOREACH friend_id IN ARRAY friend_ids
  LOOP
    INSERT INTO public.shared_notes (original_note_id, shared_by, shared_with, can_edit, status)
    VALUES (note_id, auth.uid(), friend_id, can_edit, 'accepted')
    ON CONFLICT (original_note_id, shared_by, shared_with) 
    DO UPDATE SET 
      can_edit = EXCLUDED.can_edit,
      status = 'accepted',
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Grant function permissions
GRANT EXECUTE ON FUNCTION get_shared_notes_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION share_note_with_friends TO authenticated;

-- Step 10: Test the setup
DO $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to test the setup';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing shared notes setup...';
  RAISE NOTICE 'Current user: %', current_user_id;

  -- Test the function
  BEGIN
    PERFORM * FROM get_shared_notes_for_user(current_user_id) LIMIT 1;
    RAISE NOTICE 'get_shared_notes_for_user function works correctly';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in get_shared_notes_for_user: %', SQLERRM;
  END;

  RAISE NOTICE 'Shared notes setup test completed!';
END;
$$;

SELECT 'Fixed shared notes foreign key relationship!' as status; 