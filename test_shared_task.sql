-- Test Shared Task Creation
-- This script creates a test shared task to verify the accept/deny functionality

-- 1. First, let's check your current user ID
-- Replace 'YOUR_EMAIL' with your actual email
SELECT 
  id,
  email,
  created_at
FROM auth.users 
WHERE email = 'YOUR_EMAIL'; -- Replace with your actual email

-- 2. Create a test task (replace 'YOUR_USER_ID' with the ID from step 1)
INSERT INTO todos (
  id,
  text,
  description,
  completed,
  category_id,
  date,
  repeat,
  repeat_end_date,
  reminder_time,
  custom_repeat_dates,
  user_id,
  created_at,
  updated_at
) VALUES (
  'test-shared-task-' || gen_random_uuid()::text,
  'Test Shared Task',
  'This is a test task that will be shared with you',
  false,
  null,
  NOW() + INTERVAL '7 days',
  'none',
  null,
  null,
  null,
  'YOUR_USER_ID'::uuid, -- Replace with your actual user ID
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 3. Create a test friendship (if it doesn't exist)
-- Replace 'TEST_FRIEND_ID' with the ID of the friend who will share the task
INSERT INTO friendships (
  id,
  user_id,
  friend_id,
  status,
  created_at
) VALUES (
  gen_random_uuid(),
  'YOUR_USER_ID'::uuid, -- Replace with your actual user ID
  'TEST_FRIEND_ID'::uuid, -- Replace with the friend's user ID
  'accepted',
  NOW()
) ON CONFLICT (user_id, friend_id) DO NOTHING;

-- 4. Share the task with you
-- Replace 'TEST_FRIEND_ID' with the ID of the friend who will share the task
-- Replace 'TASK_ID' with the task ID from step 2
INSERT INTO shared_tasks (
  original_task_id,
  shared_by,
  shared_with,
  status,
  created_at,
  updated_at
) VALUES (
  'TASK_ID', -- Replace with the task ID from step 2
  'TEST_FRIEND_ID'::uuid, -- Replace with the friend's user ID
  'YOUR_USER_ID'::uuid, -- Replace with your actual user ID
  'pending',
  NOW(),
  NOW()
) ON CONFLICT (original_task_id, shared_by, shared_with) DO NOTHING;

-- 5. Verify the shared task was created
SELECT 
  st.id as shared_task_id,
  st.original_task_id,
  st.shared_by,
  st.shared_with,
  st.status,
  t.text as task_text,
  t.description as task_description,
  t.date as task_date,
  p.full_name as shared_by_name,
  p.avatar_url as shared_by_avatar,
  st.created_at as shared_at
FROM shared_tasks st
JOIN todos t ON st.original_task_id = t.id
JOIN profiles p ON st.shared_by = p.id
WHERE st.shared_with = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND st.status = 'pending'
ORDER BY st.created_at DESC;

-- 6. Test the accept function
-- Uncomment the following lines to test accepting a shared task
/*
SELECT accept_shared_task(
  'SHARED_TASK_ID'::uuid, -- Replace with the shared_task_id from step 5
  'YOUR_USER_ID'::uuid -- Replace with your actual user ID
);
*/

-- 7. Test the decline function
-- Uncomment the following lines to test declining a shared task
/*
SELECT decline_shared_task(
  'SHARED_TASK_ID'::uuid, -- Replace with the shared_task_id from step 5
  'YOUR_USER_ID'::uuid -- Replace with your actual user ID
);
*/

-- 8. Clean up (optional - uncomment to remove test data)
/*
DELETE FROM shared_tasks WHERE original_task_id LIKE 'test-shared-task-%';
DELETE FROM todos WHERE id LIKE 'test-shared-task-%';
*/ 