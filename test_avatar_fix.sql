-- Test script to add avatar URL to a user profile
-- This will help us test if the avatar display works in shared events

-- First, let's check what profiles exist
SELECT 
  id,
  username,
  full_name,
  avatar_url,
  created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 10;

-- Update a test user profile to have an avatar URL
-- Replace 'test-user-id' with an actual user ID from the profiles table
UPDATE profiles 
SET avatar_url = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
WHERE id = 'cf77e7d5-5743-46d5-add9-de9a1db64fd4'; -- Amy Kim's user ID

-- Verify the update
SELECT 
  id,
  username,
  full_name,
  avatar_url,
  created_at
FROM profiles
WHERE id = 'cf77e7d5-5743-46d5-add9-de9a1db64fd4'; 