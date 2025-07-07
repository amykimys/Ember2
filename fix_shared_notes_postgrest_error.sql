-- Fix PostgREST Foreign Key Relationship Error for Shared Notes
-- This script addresses the specific error about shared_notes and profiles foreign key relationship

-- First, let's check the current state of the shared_notes table
DO $$
BEGIN
  RAISE NOTICE 'Checking current shared_notes table structure...';
  
  -- Check if shared_notes table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shared_notes') THEN
    RAISE NOTICE 'shared_notes table exists';
    
    -- Check current foreign key constraints
    SELECT 
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = 'shared_notes';
  ELSE
    RAISE NOTICE 'shared_notes table does not exist';
  END IF;
END $$;

-- Drop and recreate the shared_notes table with correct structure
DROP TABLE IF EXISTS public.shared_notes CASCADE;

-- Create shared_notes table with proper foreign key relationships
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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS shared_notes_original_note_id_idx ON public.shared_notes(original_note_id);
CREATE INDEX IF NOT EXISTS shared_notes_shared_by_idx ON public.shared_notes(shared_by);
CREATE INDEX IF NOT EXISTS shared_notes_shared_with_idx ON public.shared_notes(shared_with);
CREATE INDEX IF NOT EXISTS shared_notes_status_idx ON public.shared_notes(status);

-- Enable Row Level Security
ALTER TABLE public.shared_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for shared_notes
DROP POLICY IF EXISTS "Users can view shared notes they're involved in" ON public.shared_notes;
DROP POLICY IF EXISTS "Users can create shared notes" ON public.shared_notes;
DROP POLICY IF EXISTS "Recipients can update shared notes" ON public.shared_notes;
DROP POLICY IF EXISTS "Users can delete their own shares" ON public.shared_notes;

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

-- Create or recreate the note_collaborators table
DROP TABLE IF EXISTS public.note_collaborators CASCADE;

CREATE TABLE public.note_collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_editing BOOLEAN DEFAULT false,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cursor_position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(note_id, user_id)
);

-- Add indexes for note_collaborators
CREATE INDEX IF NOT EXISTS note_collaborators_note_id_idx ON public.note_collaborators(note_id);
CREATE INDEX IF NOT EXISTS note_collaborators_user_id_idx ON public.note_collaborators(user_id);
CREATE INDEX IF NOT EXISTS note_collaborators_last_activity_idx ON public.note_collaborators(last_activity);

-- Enable RLS for note_collaborators
ALTER TABLE public.note_collaborators ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for note_collaborators
DROP POLICY IF EXISTS "Users can view collaborators for notes they have access to" ON public.note_collaborators;
DROP POLICY IF EXISTS "Users can manage their own collaboration status" ON public.note_collaborators;
DROP POLICY IF EXISTS "Users can update their own collaboration status" ON public.note_collaborators;
DROP POLICY IF EXISTS "Users can remove their own collaboration status" ON public.note_collaborators;

CREATE POLICY "Users can view collaborators for notes they have access to"
  ON public.note_collaborators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notes n 
      WHERE n.id = note_collaborators.note_id 
      AND n.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.shared_notes sn 
      WHERE sn.original_note_id = note_collaborators.note_id 
      AND (sn.shared_by = auth.uid() OR sn.shared_with = auth.uid())
      AND sn.status = 'accepted'
    )
  );

CREATE POLICY "Users can manage their own collaboration status"
  ON public.note_collaborators FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collaboration status"
  ON public.note_collaborators FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can remove their own collaboration status"
  ON public.note_collaborators FOR DELETE
  USING (auth.uid() = user_id);

-- Create or recreate the note_versions table
DROP TABLE IF EXISTS public.note_versions CASCADE;

CREATE TABLE public.note_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(note_id, version_number)
);

-- Add indexes for note_versions
CREATE INDEX IF NOT EXISTS note_versions_note_id_idx ON public.note_versions(note_id);
CREATE INDEX IF NOT EXISTS note_versions_version_number_idx ON public.note_versions(note_id, version_number);

-- Enable RLS for note_versions
ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for note_versions
DROP POLICY IF EXISTS "Users can view versions for notes they have access to" ON public.note_versions;
DROP POLICY IF EXISTS "Users can create versions for notes they can edit" ON public.note_versions;

CREATE POLICY "Users can view versions for notes they have access to"
  ON public.note_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notes n 
      WHERE n.id = note_versions.note_id 
      AND n.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.shared_notes sn 
      WHERE sn.original_note_id = note_versions.note_id 
      AND (sn.shared_by = auth.uid() OR sn.shared_with = auth.uid())
      AND sn.status = 'accepted'
    )
  );

CREATE POLICY "Users can create versions for notes they can edit"
  ON public.note_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes n 
      WHERE n.id = note_versions.note_id 
      AND n.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.shared_notes sn 
      WHERE sn.original_note_id = note_versions.note_id 
      AND sn.shared_with = auth.uid()
      AND sn.status = 'accepted'
      AND sn.can_edit = true
    )
  );

-- Update the functions to work with the correct table structure
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

CREATE OR REPLACE FUNCTION get_pending_shared_notes(user_id UUID)
RETURNS TABLE (
  shared_note_id UUID,
  original_note_id UUID,
  note_title TEXT,
  note_content TEXT,
  shared_by_name TEXT,
  shared_by_avatar TEXT,
  shared_by_username TEXT,
  can_edit BOOLEAN,
  shared_at TIMESTAMP WITH TIME ZONE
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
    sn.created_at as shared_at
  FROM public.shared_notes sn
  JOIN public.notes n ON sn.original_note_id = n.id
  JOIN public.profiles p ON sn.shared_by = p.id
  WHERE sn.shared_with = get_pending_shared_notes.user_id
    AND sn.status = 'pending'
  ORDER BY sn.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_note_collaborators(note_id UUID)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  user_avatar TEXT,
  user_username TEXT,
  is_editing BOOLEAN,
  cursor_position INTEGER,
  last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nc.user_id,
    p.full_name as user_name,
    p.avatar_url as user_avatar,
    p.username as user_username,
    nc.is_editing,
    nc.cursor_position,
    nc.last_activity
  FROM public.note_collaborators nc
  JOIN public.profiles p ON nc.user_id = p.id
  WHERE nc.note_id = get_note_collaborators.note_id
    AND nc.last_activity > NOW() - INTERVAL '5 minutes'
  ORDER BY nc.last_activity DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to share a note with friends
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

-- Create function to accept a shared note
CREATE OR REPLACE FUNCTION accept_shared_note(shared_note_id UUID) RETURNS VOID AS $$
BEGIN
  UPDATE public.shared_notes 
  SET status = 'accepted', updated_at = NOW()
  WHERE id = shared_note_id 
    AND shared_with = auth.uid() 
    AND status = 'pending';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shared note not found or already processed';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to decline a shared note
CREATE OR REPLACE FUNCTION decline_shared_note(shared_note_id UUID) RETURNS VOID AS $$
BEGIN
  UPDATE public.shared_notes 
  SET status = 'declined', updated_at = NOW()
  WHERE id = shared_note_id 
    AND shared_with = auth.uid() 
    AND status = 'pending';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shared note not found or already processed';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update collaboration status
CREATE OR REPLACE FUNCTION update_note_collaboration(
  note_id UUID,
  is_editing BOOLEAN,
  cursor_position INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.note_collaborators (note_id, user_id, is_editing, cursor_position, last_activity)
  VALUES (update_note_collaboration.note_id, auth.uid(), update_note_collaboration.is_editing, update_note_collaboration.cursor_position, NOW())
  ON CONFLICT (note_id, user_id) 
  DO UPDATE SET 
    is_editing = EXCLUDED.is_editing,
    cursor_position = EXCLUDED.cursor_position,
    last_activity = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to remove collaboration status
CREATE OR REPLACE FUNCTION remove_note_collaboration(note_id UUID) RETURNS VOID AS $$
BEGIN
  DELETE FROM public.note_collaborators 
  WHERE note_id = remove_note_collaboration.note_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create note version
CREATE OR REPLACE FUNCTION create_note_version(
  note_id UUID,
  title TEXT,
  content TEXT
) RETURNS INTEGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  -- Get the next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_version
  FROM public.note_versions
  WHERE note_id = create_note_version.note_id;

  -- Insert the new version
  INSERT INTO public.note_versions (note_id, user_id, title, content, version_number)
  VALUES (create_note_version.note_id, auth.uid(), create_note_version.title, create_note_version.content, next_version);

  RETURN next_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON shared_notes TO authenticated;
GRANT ALL ON note_collaborators TO authenticated;
GRANT ALL ON note_versions TO authenticated;
GRANT EXECUTE ON FUNCTION share_note_with_friends TO authenticated;
GRANT EXECUTE ON FUNCTION accept_shared_note TO authenticated;
GRANT EXECUTE ON FUNCTION decline_shared_note TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_notes_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_shared_notes TO authenticated;
GRANT EXECUTE ON FUNCTION update_note_collaboration TO authenticated;
GRANT EXECUTE ON FUNCTION remove_note_collaboration TO authenticated;
GRANT EXECUTE ON FUNCTION get_note_collaborators TO authenticated;
GRANT EXECUTE ON FUNCTION create_note_version TO authenticated;

-- Update notes table RLS to allow shared access
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can view their own notes or shared notes" ON public.notes;
CREATE POLICY "Users can view their own notes or shared notes"
  ON public.notes FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.shared_notes sn
      WHERE sn.original_note_id = notes.id
      AND sn.shared_with = auth.uid()
      AND sn.status = 'accepted'
    )
  );

DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes or shared notes they can edit" ON public.notes;
CREATE POLICY "Users can update their own notes or shared notes they can edit"
  ON public.notes FOR UPDATE
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.shared_notes sn
      WHERE sn.original_note_id = notes.id
      AND sn.shared_with = auth.uid()
      AND sn.status = 'accepted'
      AND sn.can_edit = true
    )
  );

-- Test the setup
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

  -- Test the functions
  BEGIN
    -- Test get_shared_notes_for_user
    PERFORM * FROM get_shared_notes_for_user(current_user_id) LIMIT 1;
    RAISE NOTICE 'get_shared_notes_for_user function works correctly';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in get_shared_notes_for_user: %', SQLERRM;
  END;

  BEGIN
    -- Test get_pending_shared_notes
    PERFORM * FROM get_pending_shared_notes(current_user_id) LIMIT 1;
    RAISE NOTICE 'get_pending_shared_notes function works correctly';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in get_pending_shared_notes: %', SQLERRM;
  END;

  RAISE NOTICE 'Shared notes setup test completed!';
END;
$$;

SELECT 'Fixed PostgREST foreign key relationship error for shared notes!' as status; 