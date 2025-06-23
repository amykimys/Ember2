-- Test script for auto-accept shared tasks functionality
-- This script tests that shared tasks are automatically accepted and appear in the recipient's task list

-- 1. First, let's create some test users if they don't exist
DO $$
BEGIN
  -- Create test user 1 (task sharer)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'testuser1@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Create test user 2 (task recipient)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    '22222222-2222-2222-2222-222222222222'::uuid,
    'testuser2@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Create profiles for both users
  INSERT INTO profiles (id, full_name, username, avatar_url)
  VALUES 
    ('11111111-1111-1111-1111-111111111111'::uuid, 'Test User 1', 'testuser1', ''),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'Test User 2', 'testuser2', '')
  ON CONFLICT (id) DO NOTHING;

  -- Create a friendship between the users
  INSERT INTO friendships (user_id, friend_id, status)
  VALUES 
    ('11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'accepted'),
    ('22222222-2222-2222-2222-222222222222'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'accepted')
  ON CONFLICT (user_id, friend_id) DO NOTHING;
END $$;

-- 2. Create a test task for user 1
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
  'task-123',
  'Test shared task',
  'This is a test task that will be shared',
  false,
  null,
  NOW(),
  '11111111-1111-1111-1111-111111111111'::uuid,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 3. Share the task with user 2 (this should auto-accept)
SELECT share_task_with_friend(
  'task-123',
  '22222222-2222-2222-2222-222222222222'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid
);

-- 4. Check that the task was automatically created for user 2
SELECT 
  'User 2 tasks after sharing:' as info,
  id,
  text,
  description,
  completed,
  user_id,
  created_at
FROM todos 
WHERE user_id = '22222222-2222-2222-2222-222222222222'::uuid
ORDER BY created_at DESC;

-- 5. Check the shared_tasks table to see the record
SELECT 
  'Shared tasks record:' as info,
  id,
  original_task_id,
  shared_by,
  shared_with,
  status,
  created_at
FROM shared_tasks 
WHERE shared_by = '11111111-1111-1111-1111-111111111111'::uuid
  AND shared_with = '22222222-2222-2222-2222-222222222222'::uuid;

-- 6. Verify that there are no pending shared tasks for user 2
SELECT 
  'Pending shared tasks for user 2:' as info,
  COUNT(*) as pending_count
FROM shared_tasks 
WHERE shared_with = '22222222-2222-2222-2222-222222222222'::uuid
  AND status = 'pending';

-- 7. Test sharing another task
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
  'task-456',
  'Another test task',
  'This is another test task',
  false,
  null,
  NOW(),
  '11111111-1111-1111-1111-111111111111'::uuid,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

SELECT share_task_with_friend(
  'task-456',
  '22222222-2222-2222-2222-222222222222'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid
);

-- 8. Final check - user 2 should now have 2 tasks
SELECT 
  'Final user 2 task count:' as info,
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN completed = false THEN 1 END) as incomplete_tasks
FROM todos 
WHERE user_id = '22222222-2222-2222-2222-222222222222'::uuid; 