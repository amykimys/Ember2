-- Test script for unsync calendar functionality
-- This script helps verify that the unsync feature works correctly

-- 1. First, let's check if the synced_calendars table exists and has the right structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'synced_calendars'
ORDER BY ordinal_position;

-- 2. Check if there are any synced calendars for testing
SELECT 
  sc.id,
  sc.user_id,
  sc.google_calendar_id,
  sc.calendar_name,
  sc.calendar_description,
  sc.is_primary,
  sc.last_sync_at,
  sc.created_at,
  sc.updated_at
FROM synced_calendars sc
ORDER BY sc.created_at DESC;

-- 3. Check if there are any Google Calendar events in the events table
SELECT 
  e.id,
  e.user_id,
  e.title,
  e.google_calendar_id,
  e.google_event_id,
  e.is_google_event,
  e.created_at
FROM events e
WHERE e.is_google_event = true
ORDER BY e.created_at DESC
LIMIT 10;

-- 4. Count events by Google Calendar
SELECT 
  e.google_calendar_id,
  COUNT(*) as event_count
FROM events e
WHERE e.is_google_event = true
GROUP BY e.google_calendar_id
ORDER BY event_count DESC;

-- 5. Test the unsync functionality (replace 'your_user_id' and 'your_calendar_id' with actual values)
-- This would be run programmatically, but here's what it does:

-- Remove synced calendar record:
-- DELETE FROM synced_calendars 
-- WHERE user_id = 'your_user_id' AND google_calendar_id = 'your_calendar_id';

-- Remove events from that calendar (optional):
-- DELETE FROM events 
-- WHERE user_id = 'your_user_id' AND google_calendar_id = 'your_calendar_id';

-- 6. Verify RLS policies are working
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
WHERE tablename = 'synced_calendars'; 