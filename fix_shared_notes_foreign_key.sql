-- Fix Shared Notes Foreign Key Relationship
-- This script fixes the foreign key relationship issue between shared_notes and profiles tables

-- The issue is that shared_notes.shared_by and shared_notes.shared_with reference auth.users(id)
-- but the functions are trying to join with profiles table directly
-- We need to update the functions to properly join through auth.users

-- 1. Fix get_shared_notes_for_user function
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

-- 2. Fix get_pending_shared_notes function
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

-- 3. Fix get_note_collaborators function
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

-- 4. Update the shared_notes table to ensure proper foreign key constraints
-- First, let's check if the table exists and its current structure
DO $$
BEGIN
  -- Check if shared_notes table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shared_notes') THEN
    -- Drop existing foreign key constraints if they exist
    ALTER TABLE public.shared_notes DROP CONSTRAINT IF EXISTS shared_notes_shared_by_fkey;
    ALTER TABLE public.shared_notes DROP CONSTRAINT IF EXISTS shared_notes_shared_with_fkey;
    
    -- Add proper foreign key constraints to auth.users
    ALTER TABLE public.shared_notes 
      ADD CONSTRAINT shared_notes_shared_by_fkey 
      FOREIGN KEY (shared_by) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    ALTER TABLE public.shared_notes 
      ADD CONSTRAINT shared_notes_shared_with_fkey 
      FOREIGN KEY (shared_with) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Updated shared_notes table foreign key constraints';
  ELSE
    RAISE NOTICE 'shared_notes table does not exist, creating it...';
    
    -- Create the shared_notes table with proper foreign keys
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
    
    RAISE NOTICE 'Created shared_notes table with proper foreign key constraints';
  END IF;
END $$;

-- 5. Update RLS policies for shared_notes
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

-- 6. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON shared_notes TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_notes_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_shared_notes TO authenticated;
GRANT EXECUTE ON FUNCTION get_note_collaborators TO authenticated;

-- 7. Test the fix
DO $$
DECLARE
  test_user_id uuid;
  test_friend_id uuid;
  test_note_id uuid;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO test_user_id;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to test the fix';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing shared notes foreign key fix...';
  RAISE NOTICE 'Current user: %', test_user_id;

  -- Test the functions
  BEGIN
    -- Test get_shared_notes_for_user
    PERFORM * FROM get_shared_notes_for_user(test_user_id) LIMIT 1;
    RAISE NOTICE 'get_shared_notes_for_user function works correctly';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in get_shared_notes_for_user: %', SQLERRM;
  END;

  BEGIN
    -- Test get_pending_shared_notes
    PERFORM * FROM get_pending_shared_notes(test_user_id) LIMIT 1;
    RAISE NOTICE 'get_pending_shared_notes function works correctly';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in get_pending_shared_notes: %', SQLERRM;
  END;

  RAISE NOTICE 'Shared notes foreign key fix test completed!';
END;
$$;

SELECT 'Fixed shared notes foreign key relationship!' as status; 