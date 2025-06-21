-- Test Shared Event Acceptance
-- This script tests that when a shared event is accepted, it becomes a regular event on the user's calendar

-- 1. Create a test user (if not exists)
DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Check if test user already exists
  SELECT id INTO test_user_id 
  FROM auth.users 
  WHERE email = 'test-acceptance@example.com';
  
  -- Create user if doesn't exist
  IF test_user_id IS NULL THEN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'test-acceptance@example.com',
      crypt('password123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW()
    ) RETURNING id INTO test_user_id;
    
    -- Create profile for the new user
    INSERT INTO profiles (id, username, full_name, avatar_url, created_at, updated_at)
    VALUES (
      test_user_id,
      'test_acceptance_user',
      'Test Acceptance User',
      NULL,
      NOW(),
      NOW()
    );
  END IF;
END $$;

-- 2. Create a test event by the test user
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
  'Test Event for Acceptance',
  'This is a test event to verify acceptance functionality',
  'Test Location',
  '2024-01-15',
  '2024-01-15T10:00:00Z',
  '2024-01-15T11:00:00Z',
  'Work',
  '#FF6B6B',
  false,
  u.id,
  NOW()
FROM auth.users u
WHERE u.email = 'test-acceptance@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM events e 
    WHERE e.user_id = u.id 
    AND e.title = 'Test Event for Acceptance'
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
WHERE u.email = 'test-acceptance@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM friendships f 
    WHERE f.user_id = u.id 
    AND f.friend_id = 'YOUR_USER_ID'::uuid
  );

-- 4. Share the event with the current user
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
  'Please accept this test event',
  NOW(),
  NOW()
FROM auth.users u
JOIN events e ON e.user_id = u.id
WHERE u.email = 'test-acceptance@example.com'
  AND e.title = 'Test Event for Acceptance'
  AND NOT EXISTS (
    SELECT 1 FROM shared_events se 
    WHERE se.original_event_id = e.id 
    AND se.shared_with = 'YOUR_USER_ID'::uuid
  );

-- 5. Verify the shared event exists
SELECT 
  se.id as shared_event_id,
  se.original_event_id,
  se.status,
  e.title,
  e.description,
  e.date,
  p.username as shared_by_username,
  p.full_name as shared_by_full_name
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
JOIN profiles p ON se.shared_by = p.id
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'test-acceptance@example.com'
  AND e.title = 'Test Event for Acceptance';

-- 6. Simulate accepting the shared event (this is what the app will do)
-- First, get the shared event details and create the accepted event
WITH shared_event_data AS (
  SELECT 
    se.id as shared_event_id,
    se.original_event_id,
    se.shared_with,
    e.title,
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
  JOIN events e ON se.original_event_id = e.id
  JOIN auth.users u ON u.id = e.user_id
  WHERE u.email = 'test-acceptance@example.com'
    AND e.title = 'Test Event for Acceptance'
    AND se.status = 'pending'
)
-- Create a new event in the recipient's calendar
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
  photos,
  user_id,
  created_at
)
SELECT 
  gen_random_uuid(),
  sed.title,
  sed.description,
  sed.location,
  sed.date,
  sed.start_datetime,
  sed.end_datetime,
  sed.category_name,
  sed.category_color,
  sed.is_all_day,
  sed.photos,
  sed.shared_with,
  NOW()
FROM shared_event_data sed
WHERE NOT EXISTS (
  SELECT 1 FROM events e 
  WHERE e.user_id = sed.shared_with 
  AND e.title = sed.title
  AND e.date = sed.date
);

-- 7. Update the shared event status to accepted
UPDATE shared_events 
SET status = 'accepted', updated_at = NOW()
WHERE id IN (
  SELECT se.id
  FROM shared_events se
  JOIN events e ON se.original_event_id = e.id
  JOIN auth.users u ON u.id = e.user_id
  WHERE u.email = 'test-acceptance@example.com'
    AND e.title = 'Test Event for Acceptance'
    AND se.status = 'pending'
);

-- 8. Verify the accepted event was created
SELECT 
  id,
  title,
  description,
  date,
  user_id,
  created_at
FROM events 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND title = 'Test Event for Acceptance'
  AND id NOT IN (
    SELECT original_event_id 
    FROM shared_events 
    WHERE shared_by IN (
      SELECT id FROM auth.users WHERE email = 'test-acceptance@example.com'
    )
  );

-- 9. Verify the shared event status was updated
SELECT 
  se.id,
  se.status,
  se.updated_at
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
JOIN auth.users u ON u.id = e.user_id
WHERE u.email = 'test-acceptance@example.com'
  AND e.title = 'Test Event for Acceptance';

-- 10. Show all events for the current user (including accepted shared events)
SELECT 
  id,
  title,
  description,
  date,
  CASE 
    WHEN id NOT IN (
      SELECT original_event_id 
      FROM shared_events 
      WHERE shared_by IN (
        SELECT id FROM auth.users WHERE email = 'test-acceptance@example.com'
      )
    ) AND title = 'Test Event for Acceptance' THEN 'Accepted Shared Event'
    ELSE 'Regular Event'
  END as event_type
FROM events 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
ORDER BY created_at DESC;

-- Cleanup (uncomment to remove test data)
/*
DELETE FROM shared_events WHERE id IN (
  SELECT se.id
  FROM shared_events se
  JOIN events e ON se.original_event_id = e.id
  JOIN auth.users u ON u.id = e.user_id
  WHERE u.email = 'test-acceptance@example.com'
);
DELETE FROM events WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'test-acceptance@example.com'
);
DELETE FROM events WHERE title = 'Test Event for Acceptance' AND user_id = 'YOUR_USER_ID'::uuid;
DELETE FROM friendships WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'test-acceptance@example.com'
);
DELETE FROM profiles WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'test-acceptance@example.com'
);
DELETE FROM auth.users WHERE email = 'test-acceptance@example.com';
*/ 