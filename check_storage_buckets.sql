-- Check what storage buckets currently exist
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets
ORDER BY created_at;

-- Check if avatars bucket exists specifically
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'avatars';

-- Check what's in the memories bucket (which is working)
SELECT 
  name,
  metadata,
  created_at,
  updated_at
FROM storage.objects 
WHERE bucket_id = 'memories'
ORDER BY created_at DESC
LIMIT 10; 