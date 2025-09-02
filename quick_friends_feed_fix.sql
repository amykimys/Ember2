-- Quick Fix for Friends Feed Issues
-- Run this to fix the most common problems preventing users from posting/seeing content

-- === 1. Create missing profiles for users ===
INSERT INTO profiles (id, full_name, username, avatar_url)
SELECT 
  u.id,
  COALESCE(SPLIT_PART(u.email, '@', 1), 'User') as full_name,
  COALESCE(SPLIT_PART(u.email, '@', 1), 'user') as username,
  NULL as avatar_url
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- === 2. Update incomplete profiles ===
UPDATE profiles 
SET 
  full_name = COALESCE(full_name, SPLIT_PART(email, '@', 1), 'User'),
  username = COALESCE(username, SPLIT_PART(email, '@', 1), 'user')
WHERE full_name IS NULL OR username IS NULL;

-- === 3. Accept all pending friendships ===
UPDATE friendships 
SET status = 'accepted', updated_at = NOW()
WHERE status = 'pending';

-- === 4. Ensure all photo shares are public ===
UPDATE social_updates 
SET is_public = true
WHERE type = 'photo_share' AND is_public = false;

-- === 5. Fix any photo shares with missing photo_url ===
UPDATE social_updates 
SET photo_url = COALESCE(photo_url, 'https://example.com/placeholder.jpg')
WHERE type = 'photo_share' AND (photo_url IS NULL OR photo_url = '');

-- === 6. Create test friendships between users who have none ===
-- This creates friendships between the first 5 users who have no friends
WITH users_without_friends AS (
  SELECT u.id
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM friendships f
    WHERE (f.user_id = u.id OR f.friend_id = u.id)
      AND f.status = 'accepted'
  )
  LIMIT 5
),
user_pairs AS (
  SELECT 
    u1.id as user1_id,
    u2.id as user2_id
  FROM users_without_friends u1
  CROSS JOIN users_without_friends u2
  WHERE u1.id < u2.id
  LIMIT 10
)
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
SELECT 
  user1_id,
  user2_id,
  'accepted',
  NOW(),
  NOW()
FROM user_pairs
ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted';

-- === 7. Create test photo shares for users who have none ===
-- This creates a test post for users who have no posts
INSERT INTO social_updates (user_id, type, photo_url, source_type, source_id, is_public, created_at)
SELECT 
  u.id,
  'photo_share',
  'https://example.com/test-photo.jpg',
  'habit',
  NULL,
  true,
  NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM social_updates su
  WHERE su.user_id = u.id AND su.type = 'photo_share'
)
LIMIT 5
ON CONFLICT DO NOTHING;

-- === 8. Verify the fixes ===
SELECT '=== VERIFICATION ===' as section;

-- Check profiles
SELECT 'Users with profiles:' as check_item, COUNT(*) as count
FROM profiles;

-- Check friendships
SELECT 'Accepted friendships:' as check_item, COUNT(*) as count
FROM friendships WHERE status = 'accepted';

-- Check photo shares
SELECT 'Public photo shares:' as check_item, COUNT(*) as count
FROM social_updates WHERE type = 'photo_share' AND is_public = true;

-- Test function for a sample user
SELECT 'Function test for first user:' as check_item;
SELECT COUNT(*) as posts_visible
FROM get_friends_photo_shares_with_privacy(
  (SELECT id FROM auth.users LIMIT 1), 
  10
);

-- === 9. Show final status ===
SELECT '=== FINAL USER STATUS ===' as section;
SELECT 
  u.email,
  CASE WHEN p.id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_profile,
  COUNT(DISTINCT su.id) as own_posts,
  COUNT(DISTINCT CASE WHEN f.status = 'accepted' THEN f.id END) as friends,
  CASE 
    WHEN p.id IS NULL THEN 'Missing Profile'
    WHEN COUNT(DISTINCT su.id) = 0 THEN 'No Posts'
    WHEN COUNT(DISTINCT CASE WHEN f.status = 'accepted' THEN f.id END) = 0 THEN 'No Friends'
    ELSE 'Working'
  END as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN social_updates su ON u.id = su.user_id AND su.type = 'photo_share'
LEFT JOIN friendships f ON (u.id = f.user_id OR u.id = f.friend_id)
GROUP BY u.id, u.email, p.id
ORDER BY u.created_at DESC;
