-- Test script to create a shared event from a test user to the current user
-- Run this in your Supabase SQL editor

-- First, let's create a test user profile (only if it doesn't exist)
INSERT INTO profiles (id, username, full_name, avatar_url, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'testuser',
  'Test User',
  NULL,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE username = 'testuser');

-- Create a test event for the test user (only if it doesn't exist)
INSERT INTO events (
  id,
  user_id,
  title,
  description,
  location,
  date,
  start_datetime,
  end_datetime,
  category_name,
  category_color,
  is_all_day,
  created_at
)
SELECT 
  gen_random_uuid(),
  p.id,
  'Coffee Meeting',
  'Let''s grab coffee and discuss the project',
  'Starbucks Downtown',
  '2025-01-15',
  '2025-01-15T10:00:00Z',
  '2025-01-15T11:00:00Z',
  'Meeting',
  '#FF6B6B',
  false,
  NOW()
FROM profiles p
WHERE p.username = 'testuser'
  AND NOT EXISTS (
    SELECT 1 FROM events e 
    WHERE e.user_id = p.id AND e.title = 'Coffee Meeting' AND e.date = '2025-01-15'
  );

-- First, let's see what users exist
SELECT 'Available users:' as info;
SELECT id, username, full_name FROM profiles LIMIT 10;

-- Now create the shared event (replace 'YOUR_USER_ID' with your actual user ID)
-- You can find your user ID by running: SELECT id FROM profiles WHERE username = 'your-username';

-- Create shared event (only if it doesn't exist)
INSERT INTO shared_events (
  id,
  original_event_id,
  shared_by,
  shared_with,
  status,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  e.id,
  p.id,
  'YOUR_USER_ID', -- Replace this with your actual user ID
  'pending',
  NOW(),
  NOW()
FROM profiles p
JOIN events e ON e.user_id = p.id
WHERE p.username = 'testuser' 
  AND e.title = 'Coffee Meeting' 
  AND e.date = '2025-01-15'
  AND NOT EXISTS (
    SELECT 1 FROM shared_events se 
    WHERE se.original_event_id = e.id 
    AND se.shared_by = p.id
  );

-- Verify the shared event was created
SELECT 'Shared event created:' as info;
SELECT 
  se.id,
  se.original_event_id,
  se.shared_by,
  se.shared_with,
  se.status,
  e.title as event_title,
  e.date as event_date,
  p1.username as shared_by_username,
  p2.username as shared_with_username
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
JOIN profiles p1 ON se.shared_by = p1.id
JOIN profiles p2 ON se.shared_with = p2.id
WHERE p1.username = 'testuser' AND e.title = 'Coffee Meeting';

-- Show all shared events for reference
SELECT 'All shared events:' as info;
SELECT 
  se.id,
  se.status,
  e.title,
  e.date,
  p1.username as from_user,
  p2.username as to_user
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
JOIN profiles p1 ON se.shared_by = p1.id
JOIN profiles p2 ON se.shared_with = p2.id
ORDER BY se.created_at DESC;

-- Cleanup commands (run these if you want to remove the test data)
-- DELETE FROM shared_events WHERE shared_by IN (SELECT id FROM profiles WHERE username = 'testuser');
-- DELETE FROM events WHERE user_id IN (SELECT id FROM profiles WHERE username = 'testuser');
-- DELETE FROM profiles WHERE username = 'testuser'; 