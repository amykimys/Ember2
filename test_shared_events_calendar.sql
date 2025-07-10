-- Test Shared Events Calendar Display
-- Run this in your Supabase Dashboard > SQL Editor to test if shared events are being fetched correctly

-- Step 1: Get your user ID (replace with your actual email)
SELECT 
  '=== YOUR USER ID ===' as info;

SELECT 
  id as your_user_id,
  email
FROM auth.users 
WHERE email = 'your-email@example.com'; -- Replace with your actual email

-- Step 2: Test the exact query that the calendar uses
SELECT 
  '=== CALENDAR FETCH QUERY TEST ===' as info;

-- This is the exact query that fetchSharedEvents uses
SELECT 
  se.id as shared_event_id,
  se.original_event_id,
  se.shared_by,
  se.shared_with,
  se.status,
  se.created_at,
  e.title as event_title,
  e.date as event_date,
  e.start_datetime,
  e.end_datetime,
  e.is_all_day,
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
WHERE (se.shared_by = 'YOUR_USER_ID'::uuid OR se.shared_with = 'YOUR_USER_ID'::uuid) -- Replace with your user ID
  AND se.status IN ('pending', 'accepted')
ORDER BY se.created_at DESC;

-- Step 3: Check if events exist for the dates you expect
SELECT 
  '=== EVENTS BY DATE ===' as info;

SELECT 
  e.date,
  e.title,
  e.id as event_id,
  se.id as shared_event_id,
  se.shared_by,
  se.shared_with,
  se.status,
  CASE 
    WHEN se.shared_by = 'YOUR_USER_ID'::uuid THEN 'SENT'
    WHEN se.shared_with = 'YOUR_USER_ID'::uuid THEN 'RECEIVED'
    ELSE 'UNKNOWN'
  END as your_role
FROM events e
LEFT JOIN shared_events se ON e.id = se.original_event_id
WHERE (se.shared_by = 'YOUR_USER_ID'::uuid OR se.shared_with = 'YOUR_USER_ID'::uuid) -- Replace with your user ID
  AND se.status IN ('pending', 'accepted')
ORDER BY e.date, e.title;

-- Step 4: Count events by role
SELECT 
  '=== EVENT COUNTS BY ROLE ===' as info;

SELECT 
  CASE 
    WHEN se.shared_by = 'YOUR_USER_ID'::uuid THEN 'SENT'
    WHEN se.shared_with = 'YOUR_USER_ID'::uuid THEN 'RECEIVED'
    ELSE 'UNKNOWN'
  END as your_role,
  se.status,
  COUNT(*) as event_count
FROM shared_events se
WHERE (se.shared_by = 'YOUR_USER_ID'::uuid OR se.shared_with = 'YOUR_USER_ID'::uuid) -- Replace with your user ID
  AND se.status IN ('pending', 'accepted')
GROUP BY 
  CASE 
    WHEN se.shared_by = 'YOUR_USER_ID'::uuid THEN 'SENT'
    WHEN se.shared_with = 'YOUR_USER_ID'::uuid THEN 'RECEIVED'
    ELSE 'UNKNOWN'
  END,
  se.status
ORDER BY your_role, se.status;

-- Step 5: Check for any events that might be missing from the calendar
SELECT 
  '=== POTENTIAL MISSING EVENTS ===' as info;

-- Check for shared events where the original event doesn't exist
SELECT 
  'Shared events with missing original events:' as issue,
  COUNT(*) as count
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
WHERE (se.shared_by = 'YOUR_USER_ID'::uuid OR se.shared_with = 'YOUR_USER_ID'::uuid) -- Replace with your user ID
  AND se.status IN ('pending', 'accepted')
  AND e.id IS NULL;

-- Check for shared events with missing profiles
SELECT 
  'Shared events with missing sender profiles:' as issue,
  COUNT(*) as count
FROM shared_events se
LEFT JOIN profiles p ON se.shared_by = p.id
WHERE (se.shared_by = 'YOUR_USER_ID'::uuid OR se.shared_with = 'YOUR_USER_ID'::uuid) -- Replace with your user ID
  AND se.status IN ('pending', 'accepted')
  AND p.id IS NULL;

SELECT 
  'Shared events with missing recipient profiles:' as issue,
  COUNT(*) as count
FROM shared_events se
LEFT JOIN profiles p ON se.shared_with = p.id
WHERE (se.shared_by = 'YOUR_USER_ID'::uuid OR se.shared_with = 'YOUR_USER_ID'::uuid) -- Replace with your user ID
  AND se.status IN ('pending', 'accepted')
  AND p.id IS NULL; 