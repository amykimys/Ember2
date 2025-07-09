-- Debug script to test shared_notes functionality

-- 1. Check if shared_notes table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'shared_notes'
) as shared_notes_table_exists;

-- 2. Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'shared_notes'
ORDER BY ordinal_position;

-- 3. Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'shared_notes';

-- 4. Check current user
SELECT auth.uid() as current_user_id;

-- 5. Check if we have any notes to test with
SELECT id, title, user_id 
FROM public.notes 
LIMIT 5;

-- 6. Check if we have any friendships to test with
SELECT f.user_id, f.friend_id, f.status,
       p1.full_name as user_name,
       p2.full_name as friend_name
FROM public.friendships f
JOIN public.profiles p1 ON f.user_id = p1.id
JOIN public.profiles p2 ON f.friend_id = p2.id
WHERE f.status = 'accepted'
LIMIT 5;

-- 7. Test inserting a shared note (replace with actual IDs)
-- This will help us see if there are any permission issues
-- SELECT share_note_with_friends(
--   'note-id-here'::uuid,
--   ARRAY['friend-id-here'::uuid],
--   true
-- ); 