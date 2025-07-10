-- Check for shared events in the database
-- This script will help us understand what shared events exist

-- 1. Check if there are any shared events at all
SELECT 
  'Total shared events:' as info,
  COUNT(*) as count
FROM shared_events;

-- 2. Check shared events by status
SELECT 
  'Shared events by status:' as info,
  status,
  COUNT(*) as count
FROM shared_events
GROUP BY status
ORDER BY status;

-- 3. Check shared events for the current user (Amy Kim)
SELECT 
  'Shared events for Amy Kim:' as info,
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
WHERE se.shared_with = 'cf77e7d5-5743-46d5-add9-de9a1db64fd4'  -- Amy Kim's user ID
ORDER BY se.created_at DESC;

-- 4. Check shared events sent by Amy Kim
SELECT 
  'Shared events sent by Amy Kim:' as info,
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
WHERE se.shared_by = 'cf77e7d5-5743-46d5-add9-de9a1db64fd4'  -- Amy Kim's user ID
ORDER BY se.created_at DESC;

-- 5. Check all profiles to see if any have avatar URLs
SELECT 
  'Profiles with avatar URLs:' as info,
  id,
  full_name,
  username,
  avatar_url,
  CASE 
    WHEN avatar_url IS NULL THEN 'NULL'
    WHEN avatar_url = '' THEN 'EMPTY'
    WHEN avatar_url LIKE 'http%' THEN 'VALID_URL'
    ELSE 'INVALID_FORMAT'
  END as avatar_status
FROM profiles 
WHERE avatar_url IS NOT NULL 
  AND avatar_url != ''
ORDER BY updated_at DESC;

-- 6. Check Amy Kim's profile specifically
SELECT 
  'Amy Kim profile:' as info,
  id,
  full_name,
  username,
  avatar_url,
  CASE 
    WHEN avatar_url IS NULL THEN 'NULL'
    WHEN avatar_url = '' THEN 'EMPTY'
    WHEN avatar_url LIKE 'http%' THEN 'VALID_URL'
    ELSE 'INVALID_FORMAT'
  END as avatar_status
FROM profiles 
WHERE id = 'cf77e7d5-5743-46d5-add9-de9a1db64fd4'; 