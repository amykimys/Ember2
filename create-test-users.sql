-- Create test user profiles
-- Replace the user IDs with the actual IDs from your auth.users table

-- Check existing users and their profiles
SELECT 
  u.id as user_id,
  u.email,
  u.raw_user_meta_data,
  p.full_name,
  p.username
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- Check existing friendships
SELECT 
  f.id,
  f.user_id,
  f.friend_id,
  f.status,
  f.created_at,
  u1.email as requester_email,
  u2.email as recipient_email
FROM friendships f
JOIN auth.users u1 ON f.user_id = u1.id
JOIN auth.users u2 ON f.friend_id = u2.id
ORDER BY f.created_at DESC;

-- Only insert profiles if they don't exist (replace with actual user IDs)
-- INSERT INTO profiles (id, full_name, username, bio, avatar_url, timezone, created_at, updated_at)
-- SELECT 
--   'USER_ID_HERE',
--   'Test User Name',
--   'testusername',
--   'This is a test user for friend requests',
--   '',
--   'America/New_York',
--   NOW(),
--   NOW()
-- WHERE NOT EXISTS (
--   SELECT 1 FROM profiles WHERE id = 'USER_ID_HERE'
-- );

-- Only insert user preferences if they don't exist
-- INSERT INTO user_preferences (user_id, theme, notifications_enabled, default_view, email_notifications, push_notifications, created_at, updated_at)
-- SELECT 
--   'USER_ID_HERE',
--   'system',
--   true,
--   'day',
--   true,
--   true,
--   NOW(),
--   NOW()
-- WHERE NOT EXISTS (
--   SELECT 1 FROM user_preferences WHERE user_id = 'USER_ID_HERE'
-- );

-- Test friend request (only if it doesn't exist)
-- INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
-- SELECT 
--   'USER_ID_1',
--   'USER_ID_2',
--   'pending',
--   NOW(),
--   NOW()
-- WHERE NOT EXISTS (
--   SELECT 1 FROM friendships 
--   WHERE (user_id = 'USER_ID_1' AND friend_id = 'USER_ID_2') 
--   OR (user_id = 'USER_ID_2' AND friend_id = 'USER_ID_1')
-- ); 