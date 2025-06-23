-- Quick Test: Friend sends you a shared task
-- This script creates a friend and shares tasks with you automatically

-- Step 1: Create a friend and share tasks
DO $$
DECLARE
  current_user_id uuid;
  friend_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
BEGIN
  -- Get the current user's ID (you need to be logged in)
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to your app first, then run this script';
    RETURN;
  END IF;

  RAISE NOTICE 'Current user ID: %', current_user_id;

  -- Create a friend
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    friend_id,
    'friend@test.com',
    crypt('friendpass', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Create friend's profile
  INSERT INTO profiles (id, full_name, username, avatar_url)
  VALUES (friend_id, 'Test Friend', 'testfriend', '')
  ON CONFLICT (id) DO NOTHING;

  -- Create friendship
  INSERT INTO friendships (user_id, friend_id, status)
  VALUES 
    (current_user_id, friend_id, 'accepted'),
    (friend_id, current_user_id, 'accepted')
  ON CONFLICT (user_id, friend_id) DO NOTHING;

  RAISE NOTICE 'Friend created and friendship established';

  -- Create and share a task
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
    'shared-task-001',
    'Help me with project',
    'Can you help me review my presentation for tomorrow? I need feedback on the slides.',
    false,
    null,
    NOW() + INTERVAL '1 day',
    friend_id,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Share the task
  PERFORM share_task_with_friend(
    'shared-task-001',
    current_user_id,
    friend_id
  );

  RAISE NOTICE 'Task shared successfully!';

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
    'shared-task-002',
    'Coffee meetup',
    'Let''s grab coffee this weekend and catch up! I have some exciting news to share.',
    false,
    null,
    NOW() + INTERVAL '3 days',
    friend_id,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  PERFORM share_task_with_friend(
    'shared-task-002',
    current_user_id,
    friend_id
  );

  RAISE NOTICE 'Second task shared successfully!';

END $$;

-- Step 2: Show what tasks you now have
SELECT 
  '=== TASKS SHARED WITH YOU ===' as info;
SELECT 
  'Your task list now includes:' as task_list,
  id,
  text,
  description,
  completed,
  date,
  created_at
FROM todos 
WHERE user_id = auth.uid()
ORDER BY created_at DESC;

-- Step 3: Show sharing records
SELECT 
  '=== SHARING RECORDS ===' as info;
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

-- Step 4: Summary
SELECT 
  '=== SUMMARY ===' as info;
SELECT 
  'Total tasks in your list:' as metric,
  COUNT(*) as count
FROM todos 
WHERE user_id = auth.uid();

SELECT 
  'Tasks shared with you:' as metric,
  COUNT(*) as count
FROM shared_tasks 
WHERE shared_with = auth.uid(); 