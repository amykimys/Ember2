-- Direct storage bucket check - run this in Supabase SQL editor

-- === 1. Check if the memories bucket exists and its settings ===
SELECT 
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE name = 'memories';

-- === 2. Check if there are any files in the memories bucket ===
SELECT 
  name,
  bucket_id,
  owner,
  created_at,
  updated_at,
  last_accessed_at,
  metadata
FROM storage.objects 
WHERE bucket_id = 'memories'
ORDER BY created_at DESC
LIMIT 10;

-- === 3. Check if there are any files in the friends-feed folder ===
SELECT 
  name,
  bucket_id,
  owner,
  created_at,
  updated_at,
  metadata
FROM storage.objects 
WHERE bucket_id = 'memories'
  AND name LIKE 'friends-feed/%'
ORDER BY created_at DESC
LIMIT 10;

-- === 4. Check the most recent social_updates to see what URLs are stored ===
SELECT 
  id,
  user_id,
  photo_url,
  photos,
  created_at,
  is_public
FROM social_updates 
WHERE type = 'photo_share'
ORDER BY created_at DESC
LIMIT 5;

-- === 5. Check if there are any files with the specific user IDs from the errors ===
SELECT 
  name,
  bucket_id,
  owner,
  created_at
FROM storage.objects 
WHERE bucket_id = 'memories'
  AND (
    name LIKE '%6667e4f6-a7e5-40b3-9396-8bfabaac871e%'
    OR name LIKE '%cf77e7d5-5743-46d5-add9-de9a1db64fd4%'
  )
ORDER BY created_at DESC;

-- === 6. Check storage bucket permissions ===
SELECT 
  bucket_id,
  role,
  permissions
FROM storage.policies 
WHERE bucket_id = 'memories';
