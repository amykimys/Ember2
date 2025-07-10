-- Comprehensive Debug Script for Shared Events
-- Run this in your Supabase Dashboard > SQL Editor to identify the exact issue

-- Step 1: Get your user ID (replace with your actual email)
SELECT 
  '=== YOUR USER ID ===' as info;

SELECT 
  id as your_user_id,
  email
FROM auth.users 
WHERE email = 'your-email@example.com'; -- Replace with your actual email

-- Step 2: Check if shared_events table exists and has data
SELECT 
  '=== SHARED_EVENTS TABLE STATUS ===' as info;

-- Check if table exists
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'shared_events';

-- Check table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'shared_events'
ORDER BY ordinal_position;

-- Check total count of shared events
SELECT 
  '=== TOTAL SHARED EVENTS COUNT ===' as info;

SELECT 
  COUNT(*) as total_shared_events,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_events,
  COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_events,
  COUNT(CASE WHEN status = 'declined' THEN 1 END) as declined_events
FROM shared_events;

-- Step 3: Check your specific shared events
SELECT 
  '=== YOUR SHARED EVENTS (ALL) ===' as info;

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
  -- Sender profile
  sender.username as sender_username,
  sender.full_name as sender_full_name,
  -- Recipient profile  
  recipient.username as recipient_username,
  recipient.full_name as recipient_full_name
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
LEFT JOIN profiles sender ON se.shared_by = sender.id
LEFT JOIN profiles recipient ON se.shared_with = recipient.id
WHERE se.shared_by = 'YOUR_USER_ID'::uuid OR se.shared_with = 'YOUR_USER_ID'::uuid -- Replace with your user ID
ORDER BY se.created_at DESC;

-- Step 4: Check events you've shared with others
SELECT 
  '=== EVENTS YOU SHARED WITH OTHERS ===' as info;

SELECT 
  se.id as shared_event_id,
  se.original_event_id,
  se.shared_with,
  se.status,
  se.created_at,
  e.title as event_title,
  e.date as event_date,
  recipient.username as recipient_username,
  recipient.full_name as recipient_full_name
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
LEFT JOIN profiles recipient ON se.shared_with = recipient.id
WHERE se.shared_by = 'YOUR_USER_ID'::uuid -- Replace with your user ID
ORDER BY se.created_at DESC;

-- Step 5: Check events shared with you
SELECT 
  '=== EVENTS SHARED WITH YOU ===' as info;

SELECT 
  se.id as shared_event_id,
  se.original_event_id,
  se.shared_by,
  se.status,
  se.created_at,
  e.title as event_title,
  e.date as event_date,
  sender.username as sender_username,
  sender.full_name as sender_full_name
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
LEFT JOIN profiles sender ON se.shared_by = sender.id
WHERE se.shared_with = 'YOUR_USER_ID'::uuid -- Replace with your user ID
ORDER BY se.created_at DESC;

-- Step 6: Check RLS policies
SELECT 
  '=== RLS POLICIES FOR SHARED_EVENTS ===' as info;

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

-- Step 7: Check if RLS is enabled
SELECT 
  '=== RLS STATUS ===' as info;

SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'shared_events';

-- Step 8: Test RLS policies with your user
SELECT 
  '=== RLS POLICY TEST ===' as info;

-- Test if you can see shared events as a recipient
SELECT 
  'Testing recipient access...' as test_type,
  COUNT(*) as accessible_count
FROM shared_events 
WHERE shared_with = 'YOUR_USER_ID'::uuid; -- Replace with your user ID

-- Test if you can see shared events as a sender
SELECT 
  'Testing sender access...' as test_type,
  COUNT(*) as accessible_count
FROM shared_events 
WHERE shared_by = 'YOUR_USER_ID'::uuid; -- Replace with your user ID

-- Step 9: Check if the original events exist
SELECT 
  '=== ORIGINAL EVENTS CHECK ===' as info;

SELECT 
  se.original_event_id,
  se.id as shared_event_id,
  e.id as event_exists,
  e.title as event_title,
  e.user_id as event_owner
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
WHERE se.shared_by = 'YOUR_USER_ID'::uuid OR se.shared_with = 'YOUR_USER_ID'::uuid -- Replace with your user ID
ORDER BY se.created_at DESC;

-- Step 10: Check for any errors in the data
SELECT 
  '=== DATA INTEGRITY CHECK ===' as info;

-- Check for shared events with non-existent original events
SELECT 
  'Shared events with missing original events:' as issue,
  COUNT(*) as count
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
WHERE e.id IS NULL;

-- Check for shared events with non-existent users
SELECT 
  'Shared events with missing sender profiles:' as issue,
  COUNT(*) as count
FROM shared_events se
LEFT JOIN profiles p ON se.shared_by = p.id
WHERE p.id IS NULL;

SELECT 
  'Shared events with missing recipient profiles:' as issue,
  COUNT(*) as count
FROM shared_events se
LEFT JOIN profiles p ON se.shared_with = p.id
WHERE p.id IS NULL;

-- Step 11: Check your friendships (required for sharing)
SELECT 
  '=== YOUR FRIENDSHIPS ===' as info;

SELECT 
  f.friendship_id,
  f.friend_id,
  f.status as friendship_status,
  f.created_at,
  p.username as friend_username,
  p.full_name as friend_full_name
FROM friendships f
LEFT JOIN profiles p ON f.friend_id = p.id
WHERE f.user_id = 'YOUR_USER_ID'::uuid -- Replace with your user ID
ORDER BY f.created_at DESC;

-- Step 12: Check if you have any events at all
SELECT 
  '=== YOUR EVENTS ===' as info;

SELECT 
  id,
  title,
  date,
  created_at
FROM events 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your user ID
ORDER BY created_at DESC
LIMIT 10; 