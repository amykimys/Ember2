-- Fix ambiguous column references in shared notes functions
-- Run this script to fix the SQL errors

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

-- 4. Fix update_note_collaboration function
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

-- 5. Fix remove_note_collaboration function
CREATE OR REPLACE FUNCTION remove_note_collaboration(note_id UUID) RETURNS VOID AS $$
BEGIN
  DELETE FROM public.note_collaborators 
  WHERE note_id = remove_note_collaboration.note_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Fix create_note_version function
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

SELECT 'Fixed ambiguous column references in shared notes functions!' as status; 