-- Example: Friend sharing a task with you
-- This simulates a real scenario where your friend "Sarah" shares a task with you

-- Step 1: Create realistic user profiles
DO $$
BEGIN
  -- Create your profile (you)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    'your-user-id-123'::uuid,
    'you@example.com',
    crypt('yourpassword', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Create your friend Sarah's profile
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    'sarah-user-id-456'::uuid,
    'sarah@example.com',
    crypt('sarahpassword', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Create profiles for both users
  INSERT INTO profiles (id, full_name, username, avatar_url)
  VALUES 
    ('your-user-id-123'::uuid, 'You', 'you', ''),
    ('sarah-user-id-456'::uuid, 'Sarah Johnson', 'sarah', '')
  ON CONFLICT (id) DO NOTHING;

  -- Create a friendship between you and Sarah
  INSERT INTO friendships (user_id, friend_id, status)
  VALUES 
    ('your-user-id-123'::uuid, 'sarah-user-id-456'::uuid, 'accepted'),
    ('sarah-user-id-456'::uuid, 'your-user-id-123'::uuid, 'accepted')
  ON CONFLICT (user_id, friend_id) DO NOTHING;
END $$;

-- Step 2: Sarah creates a task in her app
-- (This is what Sarah would do in her app)
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
  'sarah-task-001',
  'Plan weekend trip',
  'Let''s plan our weekend camping trip to Big Sur. Need to coordinate dates, food, and equipment.',
  false,
  null,
  NOW() + INTERVAL '7 days', -- Due in a week
  'sarah-user-id-456'::uuid,
  NOW(),
  NOW()
);

-- Step 3: Sarah shares the task with you
-- (This is what happens when Sarah taps "Share" in her app)
SELECT share_task_with_friend(
  'sarah-task-001',
  'your-user-id-123'::uuid,
  'sarah-user-id-456'::uuid
);

-- Step 4: Check what you see in your task list
-- (This is what you would see when you open your app)
SELECT 
  '=== YOUR TASK LIST AFTER SARAH SHARED ===' as info;
SELECT 
  'Your tasks:' as task_list,
  id,
  text,
  description,
  completed,
  date,
  created_at
FROM todos 
WHERE user_id = 'your-user-id-123'::uuid
ORDER BY created_at DESC;

-- Step 5: Show the sharing record
SELECT 
  '=== SHARING RECORD ===' as info;
SELECT 
  st.id,
  st.original_task_id,
  p.full_name as shared_by_name,
  st.status,
  st.created_at as shared_at
FROM shared_tasks st
JOIN profiles p ON st.shared_by = p.id
WHERE st.shared_with = 'your-user-id-123'::uuid;

-- Step 6: Let's create another example - Sarah shares a grocery list
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
  'sarah-task-002',
  'Grocery shopping',
  'Milk, bread, eggs, cheese, pasta, tomatoes, chicken breast, rice',
  false,
  null,
  NOW() + INTERVAL '2 days', -- Due in 2 days
  'sarah-user-id-456'::uuid,
  NOW(),
  NOW()
);

SELECT share_task_with_friend(
  'sarah-task-002',
  'your-user-id-123'::uuid,
  'sarah-user-id-456'::uuid
);

-- Step 7: Show your updated task list
SELECT 
  '=== YOUR UPDATED TASK LIST ===' as info;
SELECT 
  'Your tasks (including shared ones):' as task_list,
  id,
  text,
  description,
  completed,
  date,
  created_at
FROM todos 
WHERE user_id = 'your-user-id-123'::uuid
ORDER BY created_at DESC;

-- Step 8: Show all sharing activity
SELECT 
  '=== ALL SHARING ACTIVITY ===' as info;
SELECT 
  st.id,
  st.original_task_id,
  p.full_name as shared_by_name,
  t.text as task_title,
  st.status,
  st.created_at as shared_at
FROM shared_tasks st
JOIN profiles p ON st.shared_by = p.id
JOIN todos t ON st.original_task_id = t.id
WHERE st.shared_with = 'your-user-id-123'::uuid
ORDER BY st.created_at DESC;

-- Step 9: Verify no pending tasks (since they're auto-accepted)
SELECT 
  '=== PENDING TASKS CHECK ===' as info;
SELECT 
  'Pending shared tasks:' as status,
  COUNT(*) as count
FROM shared_tasks 
WHERE shared_with = 'your-user-id-123'::uuid
  AND status = 'pending';

SELECT 
  'Accepted shared tasks:' as status,
  COUNT(*) as count
FROM shared_tasks 
WHERE shared_with = 'your-user-id-123'::uuid
  AND status = 'accepted'; 