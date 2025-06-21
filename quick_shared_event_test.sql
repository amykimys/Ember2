-- Quick Shared Event Test
-- Replace 'YOUR_USER_ID' with your actual user ID

-- 1. Check if you have any shared events at all
SELECT 
  COUNT(*) as total_shared_events,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_events,
  COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_events
FROM shared_events 
WHERE shared_with = 'YOUR_USER_ID'::uuid; -- Replace with your actual user ID

-- 2. Check if the original events exist for your shared events
SELECT 
  se.id as shared_event_id,
  se.original_event_id,
  se.status,
  CASE WHEN e.id IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as original_event_status,
  e.title as original_event_title,
  e.date as original_event_date
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
WHERE se.shared_with = 'YOUR_USER_ID'::uuid; -- Replace with your actual user ID

-- 3. Check if you can see the original events (RLS test)
SELECT 
  id,
  title,
  date,
  user_id
FROM events 
WHERE id IN (
  SELECT original_event_id 
  FROM shared_events 
  WHERE shared_with = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
);

-- 4. Create a simple test shared event if none exist
-- This creates a shared event for today's date
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
  e.user_id,
  'YOUR_USER_ID'::uuid, -- Replace with your actual user ID
  'pending',
  'Test shared event',
  NOW(),
  NOW()
FROM events e
WHERE e.user_id != 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND e.date = '2025-01-15'
LIMIT 1
ON CONFLICT DO NOTHING;

-- 5. Check the result after creating test event
SELECT 
  se.id as shared_event_id,
  se.original_event_id,
  se.status,
  e.title,
  e.date,
  p.username as shared_by_username
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
LEFT JOIN profiles p ON se.shared_by = p.id
WHERE se.shared_with = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND se.status = 'pending'; 