-- Send another shared task to you for testing
-- This script creates a new friend and shares a different task with you

DO $$
DECLARE
  current_user_id uuid;
  friend_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
BEGIN
  -- Get the current user's ID (you need to be logged in)
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to your app first, then run this script';
    RETURN;
  END IF;

  RAISE NOTICE 'Current user ID: %', current_user_id;

  -- Create a new friend (different from the previous test)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    friend_id,
    'emma@test.com',
    crypt('emmapass', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Create friend's profile
  INSERT INTO profiles (id, full_name, username, avatar_url)
  VALUES (friend_id, 'Emma Wilson', 'emma', '')
  ON CONFLICT (id) DO NOTHING;

  -- Create friendship
  INSERT INTO friendships (user_id, friend_id, status)
  VALUES 
    (current_user_id, friend_id, 'accepted'),
    (friend_id, current_user_id, 'accepted')
  ON CONFLICT (user_id, friend_id) DO NOTHING;

  RAISE NOTICE 'Friend Emma created and friendship established';

  -- Create and share a new task
  INSERT INTO todos (
    id,
    text,
    description,
    completed,
    category_id,
    date,
    user_id,
    created_at,
    updated_at
  ) VALUES (
    'emma-task-001',
    'Weekend hiking trip',
    'Let''s plan a hiking trip to Mount Tam this weekend! Need to coordinate transportation, food, and hiking gear. Should be a great adventure!',
    false,
    null,
    NOW() + INTERVAL '4 days',
    friend_id,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Share the task
  PERFORM share_task_with_friend(
    'emma-task-001',
    current_user_id,
    friend_id
  );

  RAISE NOTICE 'Hiking task shared successfully!';

  -- Create and share another task
  INSERT INTO todos (
    id,
    text,
    description,
    completed,
    category_id,
    date,
    user_id,
    created_at,
    updated_at
  ) VALUES (
    'emma-task-002',
    'Book club discussion',
    'We need to finish reading "The Midnight Library" by next week for our book club meeting. Let''s schedule a discussion call to share our thoughts!',
    false,
    null,
    NOW() + INTERVAL '6 days',
    friend_id,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  PERFORM share_task_with_friend(
    'emma-task-002',
    current_user_id,
    friend_id
  );

  RAISE NOTICE 'Book club task shared successfully!';

END $$;

-- Show the new tasks you received
SELECT 
  '=== NEW TASKS SHARED WITH YOU ===' as info;
SELECT 
  'Your updated task list:' as task_list,
  id,
  text,
  description,
  completed,
  date,
  created_at
FROM todos 
WHERE user_id = auth.uid()
ORDER BY created_at DESC;

-- Show all sharing records
SELECT 
  '=== ALL SHARING RECORDS ===' as info;
SELECT 
  'Shared by:' as shared_by,
  p.full_name,
  'Task:' as task_title,
  t.text,
  'Status:' as status,
  st.status,
  'Shared at:' as shared_at,
  st.created_at
FROM shared_tasks st
JOIN profiles p ON st.shared_by = p.id
JOIN todos t ON st.original_task_id = t.id
WHERE st.shared_with = auth.uid()
ORDER BY st.created_at DESC;

-- Summary
SELECT 
  '=== SUMMARY ===' as info;
SELECT 
  'Total tasks in your list:' as metric,
  COUNT(*) as count
FROM todos 
WHERE user_id = auth.uid();

SELECT 
  'Total tasks shared with you:' as metric,
  COUNT(*) as count
FROM shared_tasks 
WHERE shared_with = auth.uid(); 