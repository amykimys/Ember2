-- Remove status column from shared_notes table and simplify the system
-- Run this in your Supabase SQL Editor
-- This script handles dependencies properly

-- 1. First, update the RLS policies on the notes table that depend on status
-- Drop the existing policies that reference status
DROP POLICY IF EXISTS "Users can view their own notes or shared notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes or shared notes they can edit" ON public.notes;

-- 2. Create new policies without status dependency
CREATE POLICY "Users can view their own notes or shared notes"
  ON public.notes FOR SELECT
  USING (
    auth.uid() = user_id 
    OR 
    EXISTS (
      SELECT 1 FROM public.shared_notes sn 
      WHERE sn.original_note_id = notes.id 
      AND sn.shared_with = auth.uid()
    )
  );

CREATE POLICY "Users can update their own notes or shared notes they can edit"
  ON public.notes FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR 
    EXISTS (
      SELECT 1 FROM public.shared_notes sn 
      WHERE sn.original_note_id = notes.id 
      AND sn.shared_with = auth.uid()
      AND sn.can_edit = true
    )
  );

-- 3. Now drop the status column from shared_notes table
ALTER TABLE public.shared_notes DROP COLUMN IF EXISTS status;

-- 4. Drop and recreate the get_shared_notes_for_user function to remove status filtering
DROP FUNCTION IF EXISTS get_shared_notes_for_user(UUID);
CREATE OR REPLACE FUNCTION get_shared_notes_for_user(user_id UUID)
RETURNS TABLE (
  id UUID,
  original_note_id UUID,
  shared_by UUID,
  shared_with UUID,
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
    sn.can_edit,
    sn.created_at,
    sn.updated_at
  FROM public.shared_notes sn
  WHERE sn.shared_with = get_shared_notes_for_user.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Drop the accept/decline functions since they're no longer needed
DROP FUNCTION IF EXISTS accept_shared_note(UUID);
DROP FUNCTION IF EXISTS decline_shared_note(UUID);
DROP FUNCTION IF EXISTS get_pending_shared_notes(UUID);

-- 6. Update the share_note_with_friends function to remove status
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

-- 7. Grant execute permissions on the updated functions
GRANT EXECUTE ON FUNCTION get_shared_notes_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION share_note_with_friends TO authenticated;

-- 8. Verify the changes
SELECT 'Status column removed successfully' as result; 