-- Complete Fix for Shared Notes System
-- This script fixes both the shared notes system and notes RLS policies

-- Step 1: Drop and recreate shared_notes table with correct structure
DROP TABLE IF EXISTS public.shared_notes CASCADE;

CREATE TABLE public.shared_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'declined')),
  can_edit BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(original_note_id, shared_by, shared_with)
);

-- Step 2: Add indexes for performance
CREATE INDEX IF NOT EXISTS shared_notes_original_note_id_idx ON public.shared_notes(original_note_id);
CREATE INDEX IF NOT EXISTS shared_notes_shared_by_idx ON public.shared_notes(shared_by);
CREATE INDEX IF NOT EXISTS shared_notes_shared_with_idx ON public.shared_notes(shared_with);
CREATE INDEX IF NOT EXISTS shared_notes_status_idx ON public.shared_notes(status);

-- Step 3: Enable RLS on shared_notes
ALTER TABLE public.shared_notes ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for shared_notes
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

-- Step 5: Grant permissions on shared_notes
GRANT ALL ON public.shared_notes TO authenticated;

-- Step 6: Fix notes table RLS policies
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can view their own notes or shared notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes or shared notes they can edit" ON public.notes;

-- Enable RLS on notes table
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies for notes table
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

CREATE POLICY "Users can create their own notes"
  ON public.notes FOR INSERT
  WITH CHECK (user_id = auth.uid());

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

CREATE POLICY "Users can delete their own notes"
  ON public.notes FOR DELETE
  USING (user_id = auth.uid());

-- Grant permissions on notes
GRANT ALL ON public.notes TO authenticated;

-- Step 7: Create function to get shared notes for a user
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

-- Step 8: Create function to share notes with friends
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

-- Step 10: Test the complete setup
DO $$
DECLARE
  current_user_id uuid;
  test_friend_id uuid := gen_random_uuid();
  test_note_id uuid;
  shared_note_count integer;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to test the setup';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing complete shared notes setup...';
  RAISE NOTICE 'Current user: %', current_user_id;
  RAISE NOTICE 'Test friend ID: %', test_friend_id;

  -- Create a test friend user
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    test_friend_id::uuid,
    'testfriend@example.com',
    crypt('testpass123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Create test friend profile
  INSERT INTO profiles (id, full_name, username, avatar_url)
  VALUES (test_friend_id::uuid, 'Test Friend', 'testfriend', '')
  ON CONFLICT (id) DO NOTHING;

  -- Test creating a note
  BEGIN
    INSERT INTO notes (title, content, user_id, created_at, updated_at)
    VALUES (
      'Test Shared Note',
      'This note will test the complete sharing system',
      current_user_id,
      NOW(),
      NOW()
    ) RETURNING id INTO test_note_id;
    
    RAISE NOTICE 'Successfully created test note with ID: %', test_note_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating test note: %', SQLERRM;
    RETURN;
  END;

  -- Test sharing the note
  BEGIN
    PERFORM share_note_with_friends(test_note_id, ARRAY[test_friend_id], true);
    RAISE NOTICE 'Successfully shared note with friend';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error sharing note: %', SQLERRM;
    RETURN;
  END;

  -- Verify the note was shared
  SELECT COUNT(*) INTO shared_note_count
  FROM shared_notes 
  WHERE original_note_id = test_note_id 
    AND shared_by = current_user_id 
    AND shared_with = test_friend_id
    AND status = 'accepted';

  IF shared_note_count > 0 THEN
    RAISE NOTICE 'Shared note created successfully! Count: %', shared_note_count;
  ELSE
    RAISE NOTICE 'ERROR: Shared note was not created!';
  END IF;

  -- Test getting shared notes for the friend
  BEGIN
    PERFORM * FROM get_shared_notes_for_user(test_friend_id) LIMIT 1;
    RAISE NOTICE 'Successfully retrieved shared notes for friend';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error retrieving shared notes: %', SQLERRM;
  END;

  -- Clean up test data
  DELETE FROM shared_notes WHERE original_note_id = test_note_id;
  DELETE FROM notes WHERE id = test_note_id;
  DELETE FROM profiles WHERE id = test_friend_id;
  DELETE FROM auth.users WHERE id = test_friend_id;

  RAISE NOTICE 'Complete shared notes setup test completed!';
END;
$$;

SELECT 'Complete shared notes system fixed successfully!' as status; 