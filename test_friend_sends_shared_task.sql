-- Test: Friend sends you a shared task
-- Run this script to simulate a friend sharing a task with you

-- Step 1: Create a friend and share a task with you
DO $$
BEGIN
  -- Create a friend (let's call them Alex)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'alex@example.com',
    crypt('alexpassword', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Create Alex's profile
  INSERT INTO profiles (id, full_name, username, avatar_url)
  VALUES ('11111111-1111-1111-1111-111111111111'::uuid, 'Alex Chen', 'alex', '')
  ON CONFLICT (id) DO NOTHING;

  -- Create friendship between Alex and you (assuming you're logged in as user_id)
  -- Note: Replace 'your-actual-user-id' with your real user ID from the app
  INSERT INTO friendships (user_id, friend_id, status)
  VALUES 
    ('your-actual-user-id'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'accepted'),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'your-actual-user-id'::uuid, 'accepted')
  ON CONFLICT (user_id, friend_id) DO NOTHING;
END $$;

-- Step 2: Alex creates a task
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
  'alex-task-001',
  'Help me move this weekend',
  'I need help moving to my new apartment. Can you help me carry boxes and furniture? I''ll provide pizza and drinks!',
  false,
  null,
  NOW() + INTERVAL '3 days',
  '11111111-1111-1111-1111-111111111111'::uuid,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Step 3: Alex shares the task with you
SELECT share_task_with_friend(
  'alex-task-001',
  'your-actual-user-id'::uuid,  -- Replace with your actual user ID
  '11111111-1111-1111-1111-111111111111'::uuid
);

-- Step 4: Check if the task appeared in your list
SELECT 
  '=== TASK SHARED WITH YOU ===' as info;
SELECT 
  'Your task list now includes:' as task_list,
  id,
  text,
  description,
  completed,
  date,
  created_at
FROM todos 
WHERE user_id = 'your-actual-user-id'::uuid  -- Replace with your actual user ID
ORDER BY created_at DESC;

-- Step 5: Show the sharing record
SELECT 
  '=== SHARING DETAILS ===' as info;
SELECT 
  'Shared by:' as shared_by,
  p.full_name,
  'Task:' as task_title,
  t.text,
  'Shared at:' as shared_at,
  st.created_at
FROM shared_tasks st
JOIN profiles p ON st.shared_by = p.id
JOIN todos t ON st.original_task_id = t.id
WHERE st.shared_with = 'your-actual-user-id'::uuid  -- Replace with your actual user ID
ORDER BY st.created_at DESC;

-- Step 6: Let Alex share another task
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
  'alex-task-002',
  'Movie night planning',
  'Let''s plan our movie night! I was thinking we could watch the new Marvel movie. Need to coordinate time and snacks.',
  false,
  null,
  NOW() + INTERVAL '5 days',
  '11111111-1111-1111-1111-111111111111'::uuid,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

SELECT share_task_with_friend(
  'alex-task-002',
  'your-actual-user-id'::uuid,  -- Replace with your actual user ID
  '11111111-1111-1111-1111-111111111111'::uuid
);

-- Step 7: Show your updated task list
SELECT 
  '=== YOUR UPDATED TASK LIST ===' as info;
SELECT 
  'All your tasks (including shared ones):' as task_list,
  id,
  text,
  description,
  completed,
  date,
  created_at
FROM todos 
WHERE user_id = 'your-actual-user-id'::uuid  -- Replace with your actual user ID
ORDER BY created_at DESC;

-- Step 8: Summary
SELECT 
  '=== SUMMARY ===' as info;
SELECT 
  'Total tasks in your list:' as metric,
  COUNT(*) as count
FROM todos 
WHERE user_id = 'your-actual-user-id'::uuid;  -- Replace with your actual user ID

SELECT 
  'Tasks shared with you:' as metric,
  COUNT(*) as count
FROM shared_tasks 
WHERE shared_with = 'your-actual-user-id'::uuid;  -- Replace with your actual user ID 