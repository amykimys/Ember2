-- Add Shared Task Manually
-- This script creates a friend and manually adds a shared task to you

DO $$
DECLARE
  current_user_id uuid;
  friend_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  original_task_id text := 'friend-task-' || extract(epoch from now())::text;
  shared_task_id text := 'shared-task-' || extract(epoch from now())::text;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'ERROR: You are not logged in! Please log in first.';
    RETURN;
  END IF;

  RAISE NOTICE '=== CREATING FRIEND AND SHARED TASK ===';
  RAISE NOTICE 'Current user: %', current_user_id;
  RAISE NOTICE 'Friend ID: %', friend_id;
  RAISE NOTICE 'Original task ID: %', original_task_id;
  RAISE NOTICE 'Shared task ID: %', shared_task_id;

  -- Step 1: Create friend user
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES (
      friend_id,
      'friend@example.com',
      crypt('friendpass123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW()
    );
    RAISE NOTICE '✓ Friend user created';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Friend user already exists or error: %', SQLERRM;
  END;

  -- Step 2: Create friend profile
  BEGIN
    INSERT INTO profiles (id, full_name, username, avatar_url)
    VALUES (friend_id, 'John Friend', 'johnfriend', '');
    RAISE NOTICE '✓ Friend profile created';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Friend profile already exists or error: %', SQLERRM;
  END;

  -- Step 3: Create friendship
  BEGIN
    INSERT INTO friendships (user_id, friend_id, status)
    VALUES 
      (current_user_id, friend_id, 'accepted'),
      (friend_id, current_user_id, 'accepted');
    RAISE NOTICE '✓ Friendship created';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Friendship already exists or error: %', SQLERRM;
  END;

  -- Step 4: Create original task for the friend
  BEGIN
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
      original_task_id,
      'Buy groceries for dinner',
      'Need to get ingredients for pasta dinner tonight',
      false,
      null,
      NOW() + INTERVAL '1 day',
      friend_id,
      NOW(),
      NOW()
    );
    RAISE NOTICE '✓ Original task created for friend';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR creating original task: %', SQLERRM;
    RETURN;
  END;

  -- Step 5: Create shared task record
  BEGIN
    INSERT INTO shared_tasks (
      original_task_id,
      shared_by,
      shared_with,
      status,
      created_at,
      updated_at
    ) VALUES (
      original_task_id,
      friend_id,
      current_user_id,
      'accepted',
      NOW(),
      NOW()
    );
    RAISE NOTICE '✓ Shared task record created';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR creating shared task record: %', SQLERRM;
    RETURN;
  END;

  -- Step 6: Create copy of task for you (the recipient)
  BEGIN
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
      shared_task_id,
      'Buy groceries for dinner',
      'Need to get ingredients for pasta dinner tonight',
      false,
      null,
      NOW() + INTERVAL '1 day',
      current_user_id,
      NOW(),
      NOW()
    );
    RAISE NOTICE '✓ Task copy created for you';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR creating task copy: %', SQLERRM;
    RETURN;
  END;

  RAISE NOTICE '=== SHARED TASK CREATED SUCCESSFULLY ===';
  RAISE NOTICE 'Friend "John Friend" has shared a task with you!';
  RAISE NOTICE 'Check your app to see the shared task with friends at the bottom.';

END $$;

-- Verify the results
SELECT 
  '=== VERIFICATION RESULTS ===' as section;

SELECT 
  'Friend profile created:' as details,
  id,
  full_name,
  username
FROM profiles 
WHERE id = '11111111-1111-1111-1111-111111111111'::uuid;

SELECT 
  'Friendship status:' as details,
  user_id,
  friend_id,
  status
FROM friendships 
WHERE (user_id = auth.uid() AND friend_id = '11111111-1111-1111-1111-111111111111'::uuid)
   OR (user_id = '11111111-1111-1111-1111-111111111111'::uuid AND friend_id = auth.uid());

SELECT 
  'Original task (friend''s task):' as details,
  id,
  text,
  description,
  user_id
FROM todos 
WHERE id LIKE 'friend-task-%'
ORDER BY created_at DESC
LIMIT 1;

SELECT 
  'Shared task record:' as details,
  id,
  original_task_id,
  shared_by,
  shared_with,
  status
FROM shared_tasks 
WHERE original_task_id LIKE 'friend-task-%'
ORDER BY created_at DESC
LIMIT 1;

SELECT 
  'Your copied task:' as details,
  id,
  text,
  description,
  user_id
FROM todos 
WHERE id LIKE 'shared-task-%'
ORDER BY created_at DESC
LIMIT 1;

SELECT 
  'Your total tasks now:' as details,
  COUNT(*) as total_tasks
FROM todos 
WHERE user_id = auth.uid();

SELECT 
  'Your shared tasks count:' as details,
  COUNT(*) as shared_tasks_count
FROM shared_tasks 
WHERE shared_with = auth.uid(); 