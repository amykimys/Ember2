-- First, let's see all users to identify the test user
SELECT 
  u.id as user_id,
  u.email,
  p.full_name,
  p.username,
  p.created_at as profile_created
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- Update the test user's profile (replace TEST_USER_ID with actual ID)
-- UPDATE profiles 
-- SET 
--   full_name = 'Test User',
--   username = 'testuser',
--   bio = 'This is a test user for friend request testing',
--   updated_at = NOW()
-- WHERE id = 'TEST_USER_ID';

-- Alternative: Update by email (replace with actual test user email)
-- UPDATE profiles 
-- SET 
--   full_name = 'Test User',
--   username = 'testuser',
--   bio = 'This is a test user for friend request testing',
--   updated_at = NOW()
-- WHERE id = (
--   SELECT id FROM auth.users WHERE email = 'testuser@example.com'
-- );

-- Check the updated profile
-- SELECT 
--   u.id as user_id,
--   u.email,
--   p.full_name,
--   p.username,
--   p.bio,
--   p.updated_at
-- FROM auth.users u
-- LEFT JOIN profiles p ON u.id = p.id
-- WHERE u.email = 'testuser@example.com'; 