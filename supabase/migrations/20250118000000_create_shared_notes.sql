-- Create shared_notes table and related functions
-- This migration sets up the complete shared notes system

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

-- 2. Add indexes for better performance
CREATE INDEX IF NOT EXISTS shared_notes_original_note_id_idx ON public.shared_notes(original_note_id);
CREATE INDEX IF NOT EXISTS shared_notes_shared_by_idx ON public.shared_notes(shared_by);
CREATE INDEX IF NOT EXISTS shared_notes_shared_with_idx ON public.shared_notes(shared_with);
CREATE INDEX IF NOT EXISTS shared_notes_status_idx ON public.shared_notes(status);

-- 3. Enable Row Level Security
ALTER TABLE public.shared_notes ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for shared_notes
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

-- 5. Grant permissions
GRANT ALL ON shared_notes TO authenticated;

-- 6. Create function to share a note with friends
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
    WHERE id = share_note_with_friends.note_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only share notes that you own';
  END IF;

  -- Create shared note records for each friend
  FOREACH friend_id IN ARRAY friend_ids
  LOOP
    INSERT INTO public.shared_notes (original_note_id, shared_by, shared_with, can_edit)
    VALUES (share_note_with_friends.note_id, auth.uid(), friend_id, share_note_with_friends.can_edit)
    ON CONFLICT (original_note_id, shared_by, shared_with) 
    DO UPDATE SET 
      can_edit = EXCLUDED.can_edit,
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create function to get shared notes for a user
CREATE OR REPLACE FUNCTION get_shared_notes_for_user(user_id UUID)
RETURNS TABLE (
  id UUID,
  original_note_id UUID,
  shared_by UUID,
  shared_with UUID,
  status TEXT,
  can_edit BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sn.id,
    sn.original_note_id,
    sn.shared_by,
    sn.shared_with,
    sn.status,
    sn.can_edit,
    sn.created_at,
    sn.updated_at
  FROM public.shared_notes sn
  WHERE sn.shared_with = get_shared_notes_for_user.user_id
    AND sn.status IN ('pending', 'accepted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create function to accept a shared note
CREATE OR REPLACE FUNCTION accept_shared_note(shared_note_id UUID) RETURNS VOID AS $$
BEGIN
  UPDATE public.shared_notes 
  SET status = 'accepted', updated_at = NOW()
  WHERE id = accept_shared_note.shared_note_id 
    AND shared_with = auth.uid() 
    AND status = 'pending';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shared note not found or already processed';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create function to decline a shared note
CREATE OR REPLACE FUNCTION decline_shared_note(shared_note_id UUID) RETURNS VOID AS $$
BEGIN
  UPDATE public.shared_notes 
  SET status = 'declined', updated_at = NOW()
  WHERE id = decline_shared_note.shared_note_id 
    AND shared_with = auth.uid() 
    AND status = 'pending';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shared note not found or already processed';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION share_note_with_friends TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_notes_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION accept_shared_note TO authenticated;
GRANT EXECUTE ON FUNCTION decline_shared_note TO authenticated; 