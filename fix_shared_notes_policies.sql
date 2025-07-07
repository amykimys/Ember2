-- Fix Shared Notes Policies
-- This script drops and recreates the policies to avoid conflicts

-- Drop and recreate shared_notes policies
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

-- Drop and recreate note_collaborators policies
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

-- Drop and recreate note_versions policies
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

SELECT 'Fixed shared notes policies!' as status; 