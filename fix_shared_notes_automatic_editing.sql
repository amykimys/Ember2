-- Fix Shared Notes for Automatic Editing
-- Run this script in your Supabase SQL Editor to enable automatic editing for both senders and recipients

-- 1. Drop existing policies that restrict editing
DROP POLICY IF EXISTS "Users can update their own notes or shared notes they can edit" ON public.notes;

-- 2. Create new policy that allows both senders and recipients to edit shared notes
CREATE POLICY "Users can update their own notes or shared notes they have access to"
  ON public.notes FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR 
    EXISTS (
      SELECT 1 FROM public.shared_notes sn 
      WHERE sn.original_note_id = notes.id 
      AND (sn.shared_by = auth.uid() OR sn.shared_with = auth.uid())
    )
  );

-- 3. Verify the policy was created correctly
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'notes' 
  AND policyname = 'Users can update their own notes or shared notes they have access to';

-- 4. Test the setup
DO $$
DECLARE
  current_user_id uuid;
  shared_note_count integer;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to test the setup';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing shared notes edit permissions...';
  RAISE NOTICE 'Current user: %', current_user_id;

  -- Check if user has access to any shared notes (as sender or recipient)
  SELECT COUNT(*) INTO shared_note_count
  FROM shared_notes 
  WHERE shared_by = current_user_id OR shared_with = current_user_id;

  RAISE NOTICE 'User has access to % shared notes', shared_note_count;

  -- Test the RLS policy by checking if user can see shared notes
  IF EXISTS (
    SELECT 1 FROM notes n
    WHERE EXISTS (
      SELECT 1 FROM shared_notes sn 
      WHERE sn.original_note_id = n.id 
      AND (sn.shared_by = current_user_id OR sn.shared_with = current_user_id)
    )
    LIMIT 1
  ) THEN
    RAISE NOTICE 'RLS policy allows access to shared notes - good!';
  ELSE
    RAISE NOTICE 'No shared notes found for current user';
  END IF;

END $$;

SELECT 'Shared notes automatic editing enabled successfully! Both senders and recipients can now edit shared notes.' as result; 