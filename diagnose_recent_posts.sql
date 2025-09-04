-- Diagnostic script to check recent vs older posts
-- This will help us understand why recent photos aren't loading

-- === 1. Check all posts with their creation dates ===
SELECT 
  su.id,
  su.user_id,
  su.type,
  su.is_public,
  su.created_at,
  su.photo_url,
  CASE 
    WHEN su.photos IS NULL THEN 'NULL'
    WHEN jsonb_typeof(su.photos) = 'array' THEN 'JSONB Array'
    ELSE 'Other'
  END as photos_type,
  CASE 
    WHEN su.photos IS NULL THEN 0
    WHEN jsonb_typeof(su.photos) = 'array' THEN jsonb_array_length(su.photos)
    ELSE 0
  END as photos_count,
  p.full_name as poster_name
FROM social_updates su
LEFT JOIN profiles p ON su.user_id = p.id
WHERE su.type = 'photo_share'
ORDER BY su.created_at DESC
LIMIT 20;

-- === 2. Check if there are any posts from the last 7 days ===
SELECT 
  COUNT(*) as posts_last_7_days,
  COUNT(CASE WHEN is_public = true THEN 1 END) as public_posts_last_7_days
FROM social_updates su
WHERE su.type = 'photo_share'
  AND su.created_at >= NOW() - INTERVAL '7 days';

-- === 3. Check if there are any posts from the last 30 days ===
SELECT 
  COUNT(*) as posts_last_30_days,
  COUNT(CASE WHEN is_public = true THEN 1 END) as public_posts_last_30_days
FROM social_updates su
WHERE su.type = 'photo_share'
  AND su.created_at >= NOW() - INTERVAL '30 days';

-- === 4. Check the most recent post details ===
SELECT 
  su.id,
  su.user_id,
  su.created_at,
  su.photo_url,
  su.photos,
  su.is_public,
  p.full_name as poster_name,
  p.username as poster_username
FROM social_updates su
LEFT JOIN profiles p ON su.user_id = p.id
WHERE su.type = 'photo_share'
ORDER BY su.created_at DESC
LIMIT 5;

-- === 5. Check if recent posts have different data structure ===
SELECT 
  su.created_at,
  CASE 
    WHEN su.photo_url IS NOT NULL AND su.photo_url != '' THEN 'Has photo_url'
    ELSE 'No photo_url'
  END as photo_url_status,
  CASE 
    WHEN su.photos IS NOT NULL AND jsonb_typeof(su.photos) = 'array' AND jsonb_array_length(su.photos) > 0 THEN 'Has photos array'
    ELSE 'No photos array'
  END as photos_array_status,
  su.is_public,
  p.full_name as poster_name
FROM social_updates su
LEFT JOIN profiles p ON su.user_id = p.id
WHERE su.type = 'photo_share'
  AND su.created_at >= NOW() - INTERVAL '30 days'
ORDER BY su.created_at DESC;
