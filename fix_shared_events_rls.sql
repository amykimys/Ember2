-- Fix Shared Events RLS Policies
-- This script fixes the RLS policies for shared_events to ensure proper sharing functionality

-- Step 1: Check current RLS status
SELECT 
  '=== CURRENT SHARED_EVENTS RLS STATUS ===' as info;

SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'shared_events';

-- Check existing policies
SELECT 
  '=== EXISTING SHARED_EVENTS POLICIES ===' as info;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'shared_events';

-- Step 2: Drop all existing policies
DROP POLICY IF EXISTS "Users can share events with their friends" ON shared_events;
DROP POLICY IF EXISTS "Users can view events shared with them" ON shared_events;
DROP POLICY IF EXISTS "Users can view events they shared" ON shared_events;
DROP POLICY IF EXISTS "Users can update events they shared" ON shared_events;
DROP POLICY IF EXISTS "Users can delete events they shared" ON shared_events;
DROP POLICY IF EXISTS "Users can view shared events they're involved in" ON shared_events;
DROP POLICY IF EXISTS "Users can create shared events" ON shared_events;
DROP POLICY IF EXISTS "Recipients can update shared events" ON shared_events;
DROP POLICY IF EXISTS "Users can delete their own shared events" ON shared_events;

-- Step 3: Create improved RLS policies
-- Policy for inserting shared events (fixes the friendship check)
CREATE POLICY "Users can share events with their friends" ON shared_events
  FOR INSERT WITH CHECK (
    shared_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM friendships 
      WHERE (
        (user_id = shared_by AND friend_id = shared_with) OR
        (user_id = shared_with AND friend_id = shared_by)
      ) AND status = 'accepted'
    )
  );

-- Policy for viewing events shared with the user
CREATE POLICY "Users can view events shared with them" ON shared_events
  FOR SELECT USING (
    shared_with = auth.uid()
  );

-- Policy for viewing events the user shared
CREATE POLICY "Users can view events they shared" ON shared_events
  FOR SELECT USING (
    shared_by = auth.uid()
  );

-- Policy for updating events the user shared
CREATE POLICY "Users can update events they shared" ON shared_events
  FOR UPDATE USING (
    shared_by = auth.uid()
  );

-- Policy for deleting events the user shared
CREATE POLICY "Users can delete events they shared" ON shared_events
  FOR DELETE USING (
    shared_by = auth.uid()
  );

-- Step 4: Ensure RLS is enabled
ALTER TABLE shared_events ENABLE ROW LEVEL SECURITY;

-- Step 5: Grant necessary permissions
GRANT ALL ON shared_events TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 6: Test the setup
DO $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  test_friend_id uuid := gen_random_uuid();
  test_event_id text := 'test-event-' || gen_random_uuid()::text;
  test_shared_event_id uuid;
BEGIN
  -- Create test users
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES 
    (test_user_id, 'test-share@example.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW()),
    (test_friend_id, 'test-friend@example.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW());
  
  -- Create profiles
  INSERT INTO profiles (id, username, full_name, created_at, updated_at)
  VALUES 
    (test_user_id, 'test_share_user', 'Test Share User', NOW(), NOW()),
    (test_friend_id, 'test_friend_user', 'Test Friend User', NOW(), NOW());
  
  -- Create friendship
  INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
  VALUES 
    (test_user_id, test_friend_id, 'accepted', NOW(), NOW()),
    (test_friend_id, test_user_id, 'accepted', NOW(), NOW());
  
  -- Create test event
  INSERT INTO events (id, title, description, date, user_id, created_at)
  VALUES (test_event_id, 'Test Event', 'Test Description', '2025-01-15', test_user_id, NOW());
  
  -- Test sharing (this should work now)
  INSERT INTO shared_events (original_event_id, shared_by, shared_with, status, created_at, updated_at)
  VALUES (test_event_id, test_user_id, test_friend_id, 'pending', NOW(), NOW())
  RETURNING id INTO test_shared_event_id;
  
  RAISE NOTICE 'Successfully created shared event with ID: %', test_shared_event_id;
  
  -- Clean up test data
  DELETE FROM shared_events WHERE id = test_shared_event_id;
  DELETE FROM events WHERE id = test_event_id;
  DELETE FROM friendships WHERE user_id IN (test_user_id, test_friend_id);
  DELETE FROM profiles WHERE id IN (test_user_id, test_friend_id);
  DELETE FROM auth.users WHERE id IN (test_user_id, test_friend_id);
  
END $$;

-- Step 7: Verify the policies were created correctly
SELECT 
  '=== VERIFICATION: NEW SHARED_EVENTS POLICIES ===' as info;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'shared_events'
ORDER BY policyname;

-- Step 8: Check if there are any existing shared events that might be affected
SELECT 
  '=== EXISTING SHARED EVENTS COUNT ===' as info;

SELECT 
  COUNT(*) as total_shared_events,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_events,
  COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_events,
  COUNT(CASE WHEN status = 'declined' THEN 1 END) as declined_events
FROM shared_events;

-- Step 9: Show sample of existing shared events (if any)
SELECT 
  '=== SAMPLE EXISTING SHARED EVENTS ===' as info;

SELECT 
  se.id,
  se.original_event_id,
  se.shared_by,
  se.shared_with,
  se.status,
  se.created_at,
  e.title as event_title,
  e.date as event_date
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
ORDER BY se.created_at DESC
LIMIT 5; 