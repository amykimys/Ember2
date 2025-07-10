-- Debug Sent Shared Events
-- Run this in your Supabase Dashboard > SQL Editor to identify why sent shared events aren't showing up

-- Step 1: Get your user ID (replace with your actual email)
SELECT 
  '=== YOUR USER ID ===' as info;

SELECT 
  id as your_user_id,
  email
FROM auth.users 
WHERE email = 'your-email@example.com'; -- Replace with your actual email

-- Step 2: Check all shared events where you are the sender
SELECT 
  '=== SHARED EVENTS YOU SENT ===' as info;

SELECT 
  se.id as shared_event_id,
  se.original_event_id,
  se.shared_by,
  se.shared_with,
  se.status,
  se.created_at,
  se.updated_at,
  e.title as event_title,
  e.date as event_date,
  e.user_id as event_owner_id,
  p.username as recipient_username,
  p.full_name as recipient_full_name
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
LEFT JOIN profiles p ON se.shared_with = p.id
WHERE se.shared_by = 'YOUR_USER_ID'::uuid -- Replace with your user ID from step 1
ORDER BY se.created_at DESC;

-- Step 3: Check all shared events where you are the recipient
SELECT 
  '=== SHARED EVENTS YOU RECEIVED ===' as info;

SELECT 
  se.id as shared_event_id,
  se.original_event_id,
  se.shared_by,
  se.shared_with,
  se.status,
  se.created_at,
  se.updated_at,
  e.title as event_title,
  e.date as event_date,
  e.user_id as event_owner_id,
  p.username as sender_username,
  p.full_name as sender_full_name
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
LEFT JOIN profiles p ON se.shared_by = p.id
WHERE se.shared_with = 'YOUR_USER_ID'::uuid -- Replace with your user ID from step 1
ORDER BY se.created_at DESC;

-- Step 4: Check if the original events you sent still exist
SELECT 
  '=== ORIGINAL EVENTS YOU OWN ===' as info;

SELECT 
  e.id,
  e.title,
  e.date,
  e.user_id,
  e.created_at,
  CASE WHEN se.id IS NOT NULL THEN 'SHARED' ELSE 'NOT SHARED' END as sharing_status,
  COUNT(se.id) as times_shared
FROM events e
LEFT JOIN shared_events se ON e.id = se.original_event_id
WHERE e.user_id = 'YOUR_USER_ID'::uuid -- Replace with your user ID
GROUP BY e.id, e.title, e.date, e.user_id, e.created_at, se.id
ORDER BY e.created_at DESC;

-- Step 5: Check if there are any events that should be shared but aren't in shared_events
SELECT 
  '=== EVENTS THAT MIGHT BE MISSING FROM SHARED_EVENTS ===' as info;

SELECT 
  e.id,
  e.title,
  e.date,
  e.created_at,
  'This event exists but has no shared_events record' as issue
FROM events e
WHERE e.user_id = 'YOUR_USER_ID'::uuid -- Replace with your user ID
  AND NOT EXISTS (
    SELECT 1 FROM shared_events se 
    WHERE se.original_event_id = e.id
  )
ORDER BY e.created_at DESC;

-- Step 6: Check the exact query that the calendar uses for sent events
SELECT 
  '=== CALENDAR SENT EVENTS QUERY TEST ===' as info;

-- This simulates what the calendar does to find sent events
SELECT 
  se.id as shared_event_id,
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
  e.photos,
  p.username as recipient_username,
  p.full_name as recipient_full_name
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
LEFT JOIN profiles p ON se.shared_with = p.id
WHERE se.shared_by = 'YOUR_USER_ID'::uuid -- Replace with your user ID
  AND se.status IN ('pending', 'accepted')
ORDER BY se.created_at DESC;

-- Step 7: Check if there are any RLS policy issues for sent events
SELECT 
  '=== RLS POLICY CHECK FOR SENT EVENTS ===' as info;

-- Test if you can see your own sent events
SELECT 
  COUNT(*) as sent_events_you_can_see
FROM shared_events 
WHERE shared_by = 'YOUR_USER_ID'::uuid -- Replace with your user ID
  AND status IN ('pending', 'accepted');

-- Step 8: Check if the events table has the correct RLS policies
SELECT 
  '=== EVENTS TABLE RLS POLICIES ===' as info;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'events'
ORDER BY policyname;

-- Step 9: Check if the shared_events table has the correct RLS policies
SELECT 
  '=== SHARED_EVENTS TABLE RLS POLICIES ===' as info;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'shared_events'
ORDER BY policyname;

-- Step 10: Create a test sent shared event if none exist
DO $$
DECLARE
  your_user_id uuid := 'YOUR_USER_ID'::uuid; -- Replace with your user ID
  test_friend_id uuid;
  test_event_id text;
  test_shared_event_id uuid;
BEGIN
  -- Check if you have any sent shared events
  IF NOT EXISTS (SELECT 1 FROM shared_events WHERE shared_by = your_user_id) THEN
    RAISE NOTICE 'No sent shared events found. Creating a test sent shared event...';
    
    -- Find a friend to share with
    SELECT friend_id INTO test_friend_id
    FROM friendships 
    WHERE user_id = your_user_id AND status = 'accepted'
    LIMIT 1;
    
    IF test_friend_id IS NULL THEN
      RAISE NOTICE 'No friends found. Cannot create test sent shared event.';
      RETURN;
    END IF;
    
    -- Create a test event that you own
    test_event_id := 'test-sent-event-' || gen_random_uuid()::text;
    
    INSERT INTO events (id, title, description, date, user_id, created_at)
    VALUES (test_event_id, 'Test Sent Event', 'This is a test event you are sending', '2025-01-15', your_user_id, NOW());
    
    -- Share the event with a friend
    INSERT INTO shared_events (original_event_id, shared_by, shared_with, status, created_at, updated_at)
    VALUES (test_event_id, your_user_id, test_friend_id, 'pending', NOW(), NOW())
    RETURNING id INTO test_shared_event_id;
    
    RAISE NOTICE 'Created test sent shared event with ID: %', test_shared_event_id;
    RAISE NOTICE 'Test event ID: %', test_event_id;
    RAISE NOTICE 'Shared by: % (you)', your_user_id;
    RAISE NOTICE 'Shared with: %', test_friend_id;
  ELSE
    RAISE NOTICE 'Sent shared events already exist. No test event created.';
  END IF;
END $$;

-- Step 11: Final verification after potential test creation
SELECT 
  '=== FINAL VERIFICATION ===' as info;

SELECT 
  'Sent Events' as type,
  COUNT(*) as count
FROM shared_events 
WHERE shared_by = 'YOUR_USER_ID'::uuid -- Replace with your user ID
UNION ALL
SELECT 
  'Received Events' as type,
  COUNT(*) as count
FROM shared_events 
WHERE shared_with = 'YOUR_USER_ID'::uuid; -- Replace with your user ID

-- Step 12: Show the most recent sent shared events
SELECT 
  '=== MOST RECENT SENT SHARED EVENTS ===' as info;

SELECT 
  se.id as shared_event_id,
  se.original_event_id,
  se.status,
  se.created_at,
  e.title as event_title,
  e.date as event_date,
  p.username as recipient_username,
  p.full_name as recipient_full_name
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
LEFT JOIN profiles p ON se.shared_with = p.id
WHERE se.shared_by = 'YOUR_USER_ID'::uuid -- Replace with your user ID
ORDER BY se.created_at DESC
LIMIT 10; 