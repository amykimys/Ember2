-- Check if there are any habits with photos
SELECT 
  id,
  text,
  user_id,
  photos,
  CASE 
    WHEN photos IS NULL THEN 'No photos'
    WHEN photos = '{}' THEN 'Empty photos object'
    WHEN jsonb_typeof(photos) = 'object' THEN 'Has photos object'
    ELSE 'Other photos type'
  END as photos_status
FROM habits 
WHERE photos IS NOT NULL 
  AND photos != '{}'
LIMIT 10;

-- Count total habits with photos
SELECT 
  COUNT(*) as total_habits_with_photos,
  COUNT(CASE WHEN photos IS NOT NULL AND photos != '{}' THEN 1 END) as habits_with_actual_photos
FROM habits;

-- Check the structure of photos column for a specific habit
SELECT 
  id,
  text,
  photos,
  jsonb_typeof(photos) as photos_type,
  jsonb_object_keys(photos) as photo_keys
FROM habits 
WHERE photos IS NOT NULL 
  AND photos != '{}'
LIMIT 5; 