-- Fix Shared Event Photos
-- This script removes photos from accepted shared events to keep them with original event owners

-- First, let's see what accepted shared events have photos
SELECT 'Accepted shared events with photos:' as info;
SELECT 
    e.id as event_id,
    e.title,
    e.photos,
    e.user_id,
    p.full_name as user_name,
    e.created_at
FROM events e
JOIN profiles p ON e.user_id = p.id
WHERE e.id LIKE 'accepted_%'
  AND e.photos IS NOT NULL 
  AND array_length(e.photos, 1) > 0
ORDER BY e.created_at DESC;

-- Remove photos from accepted shared events
UPDATE events 
SET photos = ARRAY[]::text[]
WHERE id LIKE 'accepted_%'
  AND photos IS NOT NULL 
  AND array_length(photos, 1) > 0;

-- Verify the cleanup
SELECT 'After cleanup - accepted shared events:' as info;
SELECT 
    e.id as event_id,
    e.title,
    e.photos,
    e.user_id,
    p.full_name as user_name,
    e.created_at
FROM events e
JOIN profiles p ON e.user_id = p.id
WHERE e.id LIKE 'accepted_%'
ORDER BY e.created_at DESC;

-- Show summary of changes
SELECT 'Cleanup summary:' as info;
SELECT 
    COUNT(*) as total_accepted_shared_events,
    COUNT(CASE WHEN photos IS NOT NULL AND array_length(photos, 1) > 0 THEN 1 END) as events_with_photos_remaining
FROM events 
WHERE id LIKE 'accepted_%'; 