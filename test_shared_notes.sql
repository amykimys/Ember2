-- Test Shared Notes System
-- This script tests the shared notes functionality

-- 1. Check if tables exist
SELECT 'Checking if shared notes tables exist...' as info;

SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'shared_notes'
) as shared_notes_table_exists;

SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'note_collaborators'
) as note_collaborators_table_exists;

SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'note_versions'
) as note_versions_table_exists;

-- 2. Check if functions exist
SELECT 'Checking if shared notes functions exist...' as info;

SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'share_note_with_friends',
  'accept_shared_note',
  'decline_shared_note',
  'get_shared_notes_for_user',
  'get_pending_shared_notes',
  'update_note_collaboration',
  'remove_note_collaboration',
  'get_note_collaborators',
  'create_note_version'
);

-- 3. Check RLS policies
SELECT 'Checking RLS policies...' as info;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('shared_notes', 'note_collaborators', 'note_versions')
ORDER BY tablename, policyname;

-- 4. Check notes table RLS policies
SELECT 'Checking notes table RLS policies...' as info;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'notes'
ORDER BY policyname;

-- 5. Test data (if you have test users)
-- Uncomment and modify these queries if you have test users

/*
-- Create a test note
INSERT INTO notes (title, content, user_id) 
VALUES ('Test Shared Note', 'This is a test note for sharing', 'your-user-id-here')
RETURNING id;

-- Share the note with a friend
SELECT share_note_with_friends('note-id-here', ARRAY['friend-user-id-here'], true);

-- Check pending shared notes
SELECT * FROM get_pending_shared_notes('friend-user-id-here');

-- Accept the shared note
SELECT accept_shared_note('shared-note-id-here');

-- Check shared notes
SELECT * FROM get_shared_notes_for_user('friend-user-id-here');
*/

-- 6. Check permissions
SELECT 'Checking permissions...' as info;

SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name IN ('shared_notes', 'note_collaborators', 'note_versions')
AND grantee = 'authenticated';

SELECT grantee, routine_name, privilege_type
FROM information_schema.routine_privileges 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'share_note_with_friends',
  'accept_shared_note',
  'decline_shared_note',
  'get_shared_notes_for_user',
  'get_pending_shared_notes',
  'update_note_collaboration',
  'remove_note_collaboration',
  'get_note_collaborators',
  'create_note_version'
)
AND grantee = 'authenticated';

SELECT 'Shared notes system test completed!' as status; 