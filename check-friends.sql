-- Check all users and their profiles
SELECT 
  u.id as user_id,
  u.email,
  p.full_name,
  p.username,
  u.created_at
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- Check all friendships and their status
SELECT 
  f.id as friendship_id,
  f.user_id as requester_id,
  f.friend_id as recipient_id,
  f.status,
  f.created_at,
  u1.email as requester_email,
  u2.email as recipient_email,
  p1.full_name as requester_name,
  p2.full_name as recipient_name
FROM friendships f
JOIN auth.users u1 ON f.user_id = u1.id
JOIN auth.users u2 ON f.friend_id = u2.id
LEFT JOIN profiles p1 ON f.user_id = p1.id
LEFT JOIN profiles p2 ON f.friend_id = p2.id
ORDER BY f.created_at DESC;

-- Count friends for each user (accepted friendships only)
SELECT 
  u.email,
  p.full_name,
  COUNT(CASE WHEN f.status = 'accepted' THEN 1 END) as accepted_friends,
  COUNT(CASE WHEN f.status = 'pending' AND f.user_id = u.id THEN 1 END) as sent_requests,
  COUNT(CASE WHEN f.status = 'pending' AND f.friend_id = u.id THEN 1 END) as received_requests
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN friendships f ON (f.user_id = u.id OR f.friend_id = u.id)
GROUP BY u.id, u.email, p.full_name
ORDER BY u.created_at DESC; 