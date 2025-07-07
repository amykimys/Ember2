-- Create Shared Notes System
-- This script sets up collaborative note sharing with real-time editing

-- 1. Create shared_notes table
CREATE TABLE IF NOT EXISTS public.shared_notes (
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

-- 2. Create note_collaborators table for real-time collaboration
CREATE TABLE IF NOT EXISTS public.note_collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_editing BOOLEAN DEFAULT false,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cursor_position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(note_id, user_id)
);

-- 3. Create note_versions table for conflict resolution
CREATE TABLE IF NOT EXISTS public.note_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(note_id, version_number)
);

-- 4. Add indexes for better performance
CREATE INDEX IF NOT EXISTS shared_notes_original_note_id_idx ON public.shared_notes(original_note_id);
CREATE INDEX IF NOT EXISTS shared_notes_shared_by_idx ON public.shared_notes(shared_by);
CREATE INDEX IF NOT EXISTS shared_notes_shared_with_idx ON public.shared_notes(shared_with);
CREATE INDEX IF NOT EXISTS shared_notes_status_idx ON public.shared_notes(status);

CREATE INDEX IF NOT EXISTS note_collaborators_note_id_idx ON public.note_collaborators(note_id);
CREATE INDEX IF NOT EXISTS note_collaborators_user_id_idx ON public.note_collaborators(user_id);
CREATE INDEX IF NOT EXISTS note_collaborators_last_activity_idx ON public.note_collaborators(last_activity);

CREATE INDEX IF NOT EXISTS note_versions_note_id_idx ON public.note_versions(note_id);
CREATE INDEX IF NOT EXISTS note_versions_version_number_idx ON public.note_versions(note_id, version_number);

-- 5. Enable Row Level Security
ALTER TABLE public.shared_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for shared_notes
DROP POLICY IF EXISTS "Users can view shared notes they're involved in" ON public.shared_notes;
CREATE POLICY "Users can view shared notes they're involved in"
  ON public.shared_notes FOR SELECT
  USING (auth.uid() = shared_by OR auth.uid() = shared_with);

DROP POLICY IF EXISTS "Users can create shared notes" ON public.shared_notes;
CREATE POLICY "Users can create shared notes"
  ON public.shared_notes FOR INSERT
  WITH CHECK (auth.uid() = shared_by);

DROP POLICY IF EXISTS "Recipients can update shared notes" ON public.shared_notes;
CREATE POLICY "Recipients can update shared notes"
  ON public.shared_notes FOR UPDATE
  USING (auth.uid() = shared_with);

DROP POLICY IF EXISTS "Users can delete their own shares" ON public.shared_notes;
CREATE POLICY "Users can delete their own shares"
  ON public.shared_notes FOR DELETE
  USING (auth.uid() = shared_by);

-- 7. Create RLS policies for note_collaborators
DROP POLICY IF EXISTS "Users can view collaborators for notes they have access to" ON public.note_collaborators;
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

DROP POLICY IF EXISTS "Users can manage their own collaboration status" ON public.note_collaborators;
CREATE POLICY "Users can manage their own collaboration status"
  ON public.note_collaborators FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own collaboration status" ON public.note_collaborators;
CREATE POLICY "Users can update their own collaboration status"
  ON public.note_collaborators FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove their own collaboration status" ON public.note_collaborators;
CREATE POLICY "Users can remove their own collaboration status"
  ON public.note_collaborators FOR DELETE
  USING (auth.uid() = user_id);

-- 8. Create RLS policies for note_versions
DROP POLICY IF EXISTS "Users can view versions for notes they have access to" ON public.note_versions;
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

DROP POLICY IF EXISTS "Users can create versions for notes they can edit" ON public.note_versions;
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

-- 9. Create function to share a note with friends
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

  -- Create shared note records for each friend
  FOREACH friend_id IN ARRAY friend_ids
  LOOP
    INSERT INTO public.shared_notes (original_note_id, shared_by, shared_with, can_edit)
    VALUES (note_id, auth.uid(), friend_id, can_edit)
    ON CONFLICT (original_note_id, shared_by, shared_with) 
    DO UPDATE SET 
      can_edit = EXCLUDED.can_edit,
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create function to accept a shared note
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

-- 11. Create function to decline a shared note
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

-- 12. Create function to get shared notes for a user
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

-- 13. Create function to get pending shared notes
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

-- 14. Create function to update collaboration status
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

-- 15. Create function to remove collaboration status
CREATE OR REPLACE FUNCTION remove_note_collaboration(note_id UUID) RETURNS VOID AS $$
BEGIN
  DELETE FROM public.note_collaborators 
  WHERE note_id = remove_note_collaboration.note_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 16. Create function to get active collaborators for a note
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

-- 17. Create function to create note version
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

-- 18. Grant necessary permissions
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

-- 19. Update notes table RLS to allow shared access
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
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

-- 20. Create cleanup function for inactive collaborators
CREATE OR REPLACE FUNCTION cleanup_inactive_collaborators() RETURNS VOID AS $$
BEGIN
  DELETE FROM public.note_collaborators 
  WHERE last_activity < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 21. Create a scheduled job to cleanup inactive collaborators (if using pg_cron)
-- SELECT cron.schedule('cleanup-collaborators', '*/5 * * * *', 'SELECT cleanup_inactive_collaborators();');

-- Test the setup
SELECT 'Shared notes system created successfully!' as status; 