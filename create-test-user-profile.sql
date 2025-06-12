-- First, check if the user exists in auth.users
SELECT 
  id,
  email,
  created_at
FROM auth.users 
WHERE id = '641a929a-6aec-4176-b7f8-bb1a50aa7dd3';

-- Check if a profile already exists for this user
SELECT 
  id,
  full_name,
  username,
  bio,
  created_at
FROM profiles 
WHERE id = '641a929a-6aec-4176-b7f8-bb1a50aa7dd3';

-- Create a profile for the test user (if it doesn't exist)
INSERT INTO profiles (id, full_name, username, bio, avatar_url, timezone, created_at, updated_at)
VALUES (
  '641a929a-6aec-4176-b7f8-bb1a50aa7dd3',
  'Test User2',
  'testuser2',
  'This is a test user for friend request testing',
  '',
  'America/New_York',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  username = EXCLUDED.username,
  bio = EXCLUDED.bio,
  updated_at = NOW();

-- Verify the profile was created/updated
SELECT 
  u.id as user_id,
  u.email,
  p.full_name,
  p.username,
  p.bio,
  p.created_at as profile_created,
  p.updated_at as profile_updated
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.id = '641a929a-6aec-4176-b7f8-bb1a50aa7dd3'; 