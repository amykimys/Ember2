-- Check all existing users and their profiles
SELECT 
  u.id as user_id,
  u.email,
  u.raw_user_meta_data,
  p.full_name,
  p.username,
  p.created_at as profile_created
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- Check existing friendships
SELECT 
  f.id as friendship_id,
  f.user_id as requester_id,
  f.friend_id as recipient_id,
  f.status,
  f.created_at,
  u1.email as requester_email,
  u2.email as recipient_email
FROM friendships f
JOIN auth.users u1 ON f.user_id = u1.id
JOIN auth.users u2 ON f.friend_id = u2.id
ORDER BY f.created_at DESC; 