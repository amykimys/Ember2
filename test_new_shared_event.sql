-- Test New Shared Event
-- This script creates a fresh test event and shares it with you

-- 1. Create a test user (if not exists)
DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Check if test user already exists
  SELECT id INTO test_user_id 
  FROM auth.users 
  WHERE email = 'test-share-new@example.com';
  
  -- Create user if doesn't exist
  IF test_user_id IS NULL THEN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'test-share-new@example.com',
      crypt('password123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW()
    ) RETURNING id INTO test_user_id;
    
    -- Create profile for the new user
    INSERT INTO profiles (id, username, full_name, avatar_url, created_at, updated_at)
    VALUES (
      test_user_id,
      'test_share_user',
      'Test Share User',
      NULL,
      NOW(),
      NOW()
    );
  END IF;
END $$;

-- 2. Create a new test event by the test user (for today's date)
INSERT INTO events (
  id,
  title,
  description,
  location,
  date,
  start_datetime,
  end_datetime,
  category_name,
  category_color,
  is_all_day,
  user_id,
  created_at
)
SELECT 
  gen_random_uuid(),
  'New Test Shared Event',
  'This is a fresh test event to verify sharing works',
  'Test Location',
  '2025-01-15',
  '2025-01-15T14:00:00Z',
  '2025-01-15T15:00:00Z',
  'Meeting',
  '#FF9500',
  false,
  u.id,
  NOW()
FROM auth.users u
WHERE u.email = 'test-share-new@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM events e 
    WHERE e.user_id = u.id 
    AND e.title = 'New Test Shared Event'
  );

-- 3. Create a friendship between test user and current user
-- Replace 'YOUR_USER_ID' with your actual user ID (UUID format)
INSERT INTO friendships (
  user_id,
  friend_id,
  status,
  created_at,
  updated_at
)
SELECT 
  u.id,
  'YOUR_USER_ID'::uuid, -- Replace with your actual user ID
  'accepted',
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'test-share-new@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM friendships f 
    WHERE f.user_id = u.id 
    AND f.friend_id = 'YOUR_USER_ID'::uuid
  );

-- 4. Share the new event with the current user
INSERT INTO shared_events (
  id,
  original_event_id,
  shared_by,
  shared_with,
  status,
  message,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  e.id,
  u.id,
  'YOUR_USER_ID'::uuid, -- Replace with your actual user ID
  'pending',
  'Please accept this new test event',
  NOW(),
  NOW()
FROM auth.users u
JOIN events e ON e.user_id = u.id
WHERE u.email = 'test-share-new@example.com'
  AND e.title = 'New Test Shared Event'
  AND NOT EXISTS (
    SELECT 1 FROM shared_events se 
    WHERE se.original_event_id = e.id 
    AND se.shared_with = 'YOUR_USER_ID'::uuid
  );

-- 5. Verify the new shared event was created
SELECT 
  se.id as shared_event_id,
  se.original_event_id,
  se.status,
  e.title,
  e.description,
  e.date,
  e.start_datetime,
  e.end_datetime,
  p.username as shared_by_username,
  p.full_name as shared_by_full_name
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
JOIN profiles p ON se.shared_by = p.id
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'test-share-new@example.com'
  AND e.title = 'New Test Shared Event';

-- 6. Check if you can see the shared event (this simulates what the app does)
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
    AND e.title = 'New Test Shared Event'
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

-- 7. Show all your pending shared events
SELECT 
  COUNT(*) as total_pending_shared_events
FROM shared_events se
WHERE se.shared_with = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND se.status = 'pending';

-- Cleanup (uncomment to remove test data)
/*
DELETE FROM shared_events WHERE id IN (
  SELECT se.id
  FROM shared_events se
  JOIN events e ON se.original_event_id = e.id
  JOIN auth.users u ON u.id = e.user_id
  WHERE u.email = 'test-share-new@example.com'
);
DELETE FROM events WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'test-share-new@example.com'
);
DELETE FROM friendships WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'test-share-new@example.com'
);
DELETE FROM profiles WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'test-share-new@example.com'
);
DELETE FROM auth.users WHERE email = 'test-share-new@example.com';
*/ 