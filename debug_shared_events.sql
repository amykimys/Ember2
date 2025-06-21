-- =====================================================
-- DEBUG SHARED EVENTS - TROUBLESHOOTING SCRIPT
-- =====================================================
-- This script will help debug why shared events aren't appearing on your calendar
-- Run these queries one by one to identify the issue

-- 1. First, let's find your user ID
SELECT 
    id,
    email,
    created_at
FROM auth.users 
WHERE email LIKE '%laughingstock%' OR email LIKE '%@laughingstock%'
UNION
SELECT 
    u.id,
    u.email,
    u.created_at
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE p.username = 'laughingstock' OR p.full_name LIKE '%laughingstock%';

-- 2. Check if the test user exists
SELECT 
    id,
    email,
    created_at
FROM auth.users 
WHERE email = 'testuser@example.com';

-- 3. Check if the test event exists and its details
SELECT 
    e.id,
    e.title,
    e.description,
    e.date,
    e.start_datetime,
    e.end_datetime,
    e.category_name,
    e.user_id,
    u.email as created_by,
    e.created_at
FROM events e
JOIN auth.users u ON e.user_id = u.id
WHERE e.title = 'Test Event from Test User'
ORDER BY e.created_at DESC;

-- 4. Check if friendship exists between test user and you
-- Replace 'YOUR_USER_ID' with your actual user ID from step 1
SELECT 
    f.id,
    f.user_id,
    f.friend_id,
    f.status,
    f.created_at,
    u1.email as user_email,
    u2.email as friend_email
FROM friendships f
JOIN auth.users u1 ON f.user_id = u1.id
JOIN auth.users u2 ON f.friend_id = u2.id
WHERE (u1.email = 'testuser@example.com' AND u2.email LIKE '%laughingstock%')
   OR (u2.email = 'testuser@example.com' AND u1.email LIKE '%laughingstock%')
ORDER BY f.created_at DESC;

-- 5. Check if shared event exists
-- Replace 'YOUR_USER_ID' with your actual user ID from step 1
SELECT 
    se.id,
    se.original_event_id,
    se.shared_by,
    se.shared_with,
    se.status,
    se.created_at,
    se.updated_at,
    -- Get the original event details
    e.title as event_title,
    e.date as event_date,
    e.start_datetime as event_start,
    e.end_datetime as event_end,
    -- Get sharer details
    u1.email as shared_by_email,
    -- Get recipient details  
    u2.email as shared_with_email
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
JOIN auth.users u1 ON se.shared_by = u1.id
JOIN auth.users u2 ON se.shared_with = u2.id
WHERE se.shared_with = 'YOUR_USER_ID'  -- Replace with your user ID
ORDER BY se.created_at DESC;

-- 6. Check all shared events for your user (without user ID filter)
SELECT 
    se.id,
    se.original_event_id,
    se.shared_by,
    se.shared_with,
    se.status,
    se.created_at,
    e.title as event_title,
    e.date as event_date,
    u1.email as shared_by_email,
    u2.email as shared_with_email
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
JOIN auth.users u1 ON se.shared_by = u1.id
JOIN auth.users u2 ON se.shared_with = u2.id
WHERE u2.email LIKE '%laughingstock%'
ORDER BY se.created_at DESC;

-- 7. Check if there are any shared events with pending status
SELECT 
    se.id,
    se.original_event_id,
    se.shared_by,
    se.shared_with,
    se.status,
    se.created_at,
    e.title as event_title,
    e.date as event_date,
    u1.email as shared_by_email,
    u2.email as shared_with_email
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
JOIN auth.users u1 ON se.shared_by = u1.id
JOIN auth.users u2 ON se.shared_with = u2.id
WHERE se.status = 'pending'
  AND u2.email LIKE '%laughingstock%'
ORDER BY se.created_at DESC;

-- 8. Check the exact date format in the events table
SELECT 
    e.id,
    e.title,
    e.date,
    e.start_datetime,
    e.end_datetime,
    -- Check if the date matches January 15, 2025
    CASE 
        WHEN e.date = '2025-01-15' THEN 'MATCHES TARGET DATE'
        ELSE 'DOES NOT MATCH'
    END as date_check
FROM events e
WHERE e.title = 'Test Event from Test User';

-- 9. Check if there are any events on January 15, 2025 for any user
SELECT 
    e.id,
    e.title,
    e.date,
    e.user_id,
    u.email as created_by
FROM events e
JOIN auth.users u ON e.user_id = u.id
WHERE e.date = '2025-01-15'
ORDER BY e.created_at DESC;

-- 10. Test the exact query that the calendar uses to fetch shared events
-- Replace 'YOUR_USER_ID' with your actual user ID from step 1
SELECT 
    se.id,
    se.original_event_id,
    se.shared_by,
    se.shared_with,
    se.status,
    se.created_at,
    events.id as event_id,
    events.title as event_title,
    events.description,
    events.location,
    events.date,
    events.start_datetime,
    events.end_datetime,
    events.category_name,
    events.category_color,
    events.is_all_day,
    events.photos
FROM shared_events se
LEFT JOIN events ON se.original_event_id = events.id
WHERE se.shared_with = 'YOUR_USER_ID'  -- Replace with your user ID
  AND se.status = 'pending';

-- 11. Check if the shared_events table has the correct structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'shared_events'
ORDER BY ordinal_position;

-- 12. Check if there are any RLS policy issues
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

-- =====================================================
-- MANUAL FIXES (if needed)
-- =====================================================

-- If the shared event exists but has wrong status, update it:
-- UPDATE shared_events 
-- SET status = 'pending' 
-- WHERE id = 'SHARED_EVENT_ID_FROM_QUERY_5';

-- If the event date is wrong, update it:
-- UPDATE events 
-- SET date = '2025-01-15' 
-- WHERE id = 'EVENT_ID_FROM_QUERY_3';

-- If you need to recreate the shared event:
-- INSERT INTO shared_events (
--     original_event_id,
--     shared_by,
--     shared_with,
--     status,
--     created_at,
--     updated_at
-- ) VALUES (
--     'EVENT_ID_FROM_QUERY_3',
--     'TEST_USER_ID_FROM_QUERY_2',
--     'YOUR_USER_ID_FROM_QUERY_1',
--     'pending',
--     NOW(),
--     NOW()
-- ); 

-- Debug Shared Events - Check why shared events aren't showing up

-- 1. Check if there are any shared events for your user
-- Replace 'YOUR_USER_ID' with your actual user ID
SELECT 
  se.id as shared_event_id,
  se.original_event_id,
  se.shared_by,
  se.shared_with,
  se.status,
  se.message,
  se.created_at,
  se.updated_at
FROM shared_events se
WHERE se.shared_with = 'YOUR_USER_ID'::uuid; -- Replace with your actual user ID

-- 2. Check if the original events exist
SELECT 
  e.id,
  e.title,
  e.description,
  e.date,
  e.user_id,
  e.created_at
FROM events e
WHERE e.id IN (
  SELECT original_event_id 
  FROM shared_events 
  WHERE shared_with = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
);

-- 3. Check if there are any accepted events (events that were accepted)
SELECT 
  id,
  title,
  description,
  date,
  user_id,
  created_at
FROM events 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND id LIKE 'accepted_%';

-- 4. Check the fetchSharedEvents function logic
-- This simulates what the app does when fetching shared events
WITH shared_events_data AS (
  SELECT 
    se.id as shared_event_id,
    se.original_event_id,
    se.shared_by,
    se.shared_with,
    se.status,
    se.message,
    se.created_at,
    se.updated_at,
    e.id as event_id,
    e.title,
    e.description,
    e.location,
    e.date,
    e.start_datetime,
    e.end_datetime,
    e.category_name,
    e.category_color,
    e.is_all_day,
    e.photos,
    p.username as shared_by_username,
    p.full_name as shared_by_full_name
  FROM shared_events se
  JOIN events e ON se.original_event_id = e.id
  LEFT JOIN profiles p ON se.shared_by = p.id
  WHERE se.shared_with = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
    AND se.status = 'pending'
)
SELECT 
  'shared_' || shared_event_id as id,
  title,
  description,
  location,
  date,
  start_datetime,
  end_datetime,
  category_name,
  category_color,
  is_all_day,
  photos,
  shared_by_username,
  shared_by_full_name,
  status as shared_status,
  'pending' as shared_status_display
FROM shared_events_data;

-- 5. Check if there are any RLS policy issues
-- This shows what events you can actually see
SELECT 
  id,
  title,
  description,
  date,
  user_id
FROM events 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
ORDER BY created_at DESC;

-- 6. Check if the shared events table has the correct structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'shared_events'
ORDER BY ordinal_position;

-- 7. Check if there are any pending shared events that should show up
SELECT 
  COUNT(*) as pending_shared_events_count
FROM shared_events se
WHERE se.shared_with = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND se.status = 'pending';

-- 8. Check if the original event owners are still valid users
SELECT 
  se.id as shared_event_id,
  se.original_event_id,
  e.title,
  e.user_id as original_owner_id,
  p.username as original_owner_username,
  p.full_name as original_owner_full_name
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
LEFT JOIN profiles p ON e.user_id = p.id
WHERE se.shared_with = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND se.status = 'pending'; 