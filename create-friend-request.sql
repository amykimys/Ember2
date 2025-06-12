-- Create a friend request from test user to main user
-- Replace TEST_USER_ID and MAIN_USER_ID with actual user IDs from your database

-- First, let's see what users we have
SELECT 
  u.id as user_id,
  u.email,
  p.full_name,
  p.username
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- Create friend request (replace with actual user IDs)
-- INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
-- VALUES 
--   ('TEST_USER_ID', 'MAIN_USER_ID', 'pending', NOW(), NOW());

-- Check if the friend request was created
-- SELECT 
--   f.id as friendship_id,
--   f.user_id as requester_id,
--   f.friend_id as recipient_id,
--   f.status,
--   f.created_at,
--   u1.email as requester_email,
--   u2.email as recipient_email
-- FROM friendships f
-- JOIN auth.users u1 ON f.user_id = u1.id
-- JOIN auth.users u2 ON f.friend_id = u2.id
-- WHERE f.user_id = 'TEST_USER_ID' AND f.friend_id = 'MAIN_USER_ID'; 