-- Debug Shared Events Calendar Issue
-- Run this in your Supabase Dashboard > SQL Editor to identify the problem

-- Step 1: Get your user ID (replace with your actual email)
SELECT 
  '=== YOUR USER ID ===' as info;

SELECT 
  id as your_user_id,
  email
FROM auth.users 
WHERE email = 'your-email@example.com'; -- Replace with your actual email

-- Step 2: Check if you have any shared events at all
SELECT 
  '=== SHARED EVENTS COUNT ===' as info;

SELECT 
  COUNT(*) as total_shared_events,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_events,
  COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_events,
  COUNT(CASE WHEN status = 'declined' THEN 1 END) as declined_events
FROM shared_events 
WHERE shared_with = 'YOUR_USER_ID'::uuid; -- Replace with your user ID from step 1

-- Step 3: Check if the original events exist for your shared events
SELECT 
  '=== SHARED EVENTS WITH ORIGINAL EVENTS ===' as info;

SELECT 
  se.id as shared_event_id,
  se.original_event_id,
  se.status,
  se.created_at,
  CASE WHEN e.id IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as original_event_status,
  e.title as original_event_title,
  e.date as original_event_date,
  e.user_id as event_owner_id
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
WHERE se.shared_with = 'YOUR_USER_ID'::uuid -- Replace with your user ID
ORDER BY se.created_at DESC;

-- Step 4: Check if you can see the original events (RLS test)
SELECT 
  '=== ORIGINAL EVENTS ACCESSIBLE ===' as info;

SELECT 
  id,
  title,
  date,
  user_id,
  created_at
FROM events 
WHERE id IN (
  SELECT original_event_id 
  FROM shared_events 
  WHERE shared_with = 'YOUR_USER_ID'::uuid -- Replace with your user ID
)
ORDER BY created_at DESC;

-- Step 5: Check friendships (required for sharing)
SELECT 
  '=== FRIENDSHIPS ===' as info;

SELECT 
  f.user_id,
  f.friend_id,
  f.status,
  f.created_at,
  p1.username as user_username,
  p2.username as friend_username
FROM friendships f
LEFT JOIN profiles p1 ON f.user_id = p1.id
LEFT JOIN profiles p2 ON f.friend_id = p2.id
WHERE f.user_id = 'YOUR_USER_ID'::uuid -- Replace with your user ID
   OR f.friend_id = 'YOUR_USER_ID'::uuid -- Replace with your user ID
ORDER BY f.created_at DESC;

-- Step 6: Test the exact query that the calendar uses
SELECT 
  '=== CALENDAR QUERY TEST ===' as info;

-- This is the exact query from fetchSharedEvents function
SELECT 
  se.id,
  se.original_event_id,
  se.shared_by,
  se.shared_with,
  se.status,
  se.created_at,
  e.id as event_id,
  e.title as event_title,
  e.description,
  e.location,
  e.date,
  e.start_datetime,
  e.end_datetime,
  e.category_name,
  e.category_color,
  e.is_all_day,
  e.photos
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
WHERE se.shared_with = 'YOUR_USER_ID'::uuid -- Replace with your user ID
  AND se.status IN ('pending', 'accepted')
ORDER BY se.created_at DESC;

-- Step 7: Check RLS policies
SELECT 
  '=== RLS POLICIES ===' as info;

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
WHERE tablename IN ('shared_events', 'events')
ORDER BY tablename, policyname;

-- Step 8: Create a test shared event if none exist
DO $$
DECLARE
  your_user_id uuid := 'YOUR_USER_ID'::uuid; -- Replace with your user ID
  test_friend_id uuid;
  test_event_id text;
  test_shared_event_id uuid;
BEGIN
  -- Check if you have any shared events
  IF NOT EXISTS (SELECT 1 FROM shared_events WHERE shared_with = your_user_id) THEN
    RAISE NOTICE 'No shared events found. Creating a test shared event...';
    
    -- Find a friend to share with
    SELECT friend_id INTO test_friend_id
    FROM friendships 
    WHERE user_id = your_user_id AND status = 'accepted'
    LIMIT 1;
    
    IF test_friend_id IS NULL THEN
      RAISE NOTICE 'No friends found. Cannot create test shared event.';
      RETURN;
    END IF;
    
    -- Create a test event
    test_event_id := 'test-calendar-event-' || gen_random_uuid()::text;
    
    INSERT INTO events (id, title, description, date, user_id, created_at)
    VALUES (test_event_id, 'Test Calendar Event', 'This is a test event for calendar debugging', '2025-01-15', test_friend_id, NOW());
    
    -- Share the event with you
    INSERT INTO shared_events (original_event_id, shared_by, shared_with, status, created_at, updated_at)
    VALUES (test_event_id, test_friend_id, your_user_id, 'pending', NOW(), NOW())
    RETURNING id INTO test_shared_event_id;
    
    RAISE NOTICE 'Created test shared event with ID: %', test_shared_event_id;
    RAISE NOTICE 'Test event ID: %', test_event_id;
    RAISE NOTICE 'Shared by: %', test_friend_id;
    RAISE NOTICE 'Shared with: %', your_user_id;
  ELSE
    RAISE NOTICE 'Shared events already exist. No test event created.';
  END IF;
END $$;

-- Step 9: Final verification after potential test creation
SELECT 
  '=== FINAL VERIFICATION ===' as info;

SELECT 
  COUNT(*) as total_shared_events,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_events,
  COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_events
FROM shared_events 
WHERE shared_with = 'YOUR_USER_ID'::uuid; -- Replace with your user ID

-- Step 10: Show the most recent shared events
SELECT 
  '=== MOST RECENT SHARED EVENTS ===' as info;

SELECT 
  se.id as shared_event_id,
  se.original_event_id,
  se.status,
  se.created_at,
  e.title as event_title,
  e.date as event_date,
  p.username as shared_by_username,
  p.full_name as shared_by_full_name
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
LEFT JOIN profiles p ON se.shared_by = p.id
WHERE se.shared_with = 'YOUR_USER_ID'::uuid -- Replace with your user ID
ORDER BY se.created_at DESC
LIMIT 10; 