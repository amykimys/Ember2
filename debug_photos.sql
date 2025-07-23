-- Debug script to check for photo duplication issues

-- Check the events table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name IN ('photos', 'private_photos', 'photo')
ORDER BY column_name;

-- Check if there are any events with photos
SELECT 
    id,
    title,
    photos,
    private_photos,
    photo,
    created_at
FROM events 
WHERE photos IS NOT NULL 
   OR private_photos IS NOT NULL 
   OR photo IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Check social_updates table for photo shares
SELECT 
    id,
    user_id,
    type,
    photo_url,
    source_type,
    source_id,
    created_at
FROM social_updates 
WHERE type = 'photo_share'
ORDER BY created_at DESC
LIMIT 10;

-- Check for duplicate photo URLs in events
SELECT 
    photo_url,
    COUNT(*) as count,
    array_agg(id) as event_ids
FROM (
    SELECT id, unnest(photos) as photo_url FROM events WHERE photos IS NOT NULL
    UNION ALL
    SELECT id, unnest(private_photos) as photo_url FROM events WHERE private_photos IS NOT NULL
) photo_events
GROUP BY photo_url
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Check for duplicate social updates for the same photo
SELECT 
    photo_url,
    source_id,
    COUNT(*) as count,
    array_agg(id) as update_ids
FROM social_updates 
WHERE type = 'photo_share'
GROUP BY photo_url, source_id
HAVING COUNT(*) > 1
ORDER BY count DESC; 