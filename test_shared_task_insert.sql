-- Test Shared Task Insert
-- This script tests if shared task insertion is working after permission fixes

DO $$
DECLARE
  current_user_id uuid;
  test_original_task_id text := 'test-orig-' || extract(epoch from now())::text;
  test_shared_task_id text := 'test-shared-' || extract(epoch from now())::text;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'ERROR: You are not logged in!';
    RETURN;
  END IF;

  RAISE NOTICE '=== TESTING SHARED TASK INSERT ===';
  RAISE NOTICE 'Current user: %', current_user_id;
  RAISE NOTICE 'Test original task ID: %', test_original_task_id;
  RAISE NOTICE 'Test shared task ID: %', test_shared_task_id;

  -- Step 1: Create a test task
  BEGIN
    INSERT INTO todos (id, text, user_id, date, created_at)
    VALUES (test_original_task_id, 'Test Original Task', current_user_id, NOW(), NOW());
    RAISE NOTICE '✓ Original task created successfully';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ ERROR creating original task: %', SQLERRM;
    RETURN;
  END;

  -- Step 2: Insert shared task record
  BEGIN
    INSERT INTO shared_tasks (
      original_task_id,
      shared_by,
      shared_with,
      status,
      created_at,
      updated_at
    ) VALUES (
      test_original_task_id,
      current_user_id,
      current_user_id,
      'accepted',
      NOW(),
      NOW()
    );
    RAISE NOTICE '✓ Shared task record inserted successfully';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ ERROR inserting shared task record: %', SQLERRM;
    RAISE NOTICE '✗ Error code: %', SQLSTATE;
    RETURN;
  END;

  -- Step 3: Create copy of task for recipient
  BEGIN
    INSERT INTO todos (id, text, user_id, date, created_at)
    VALUES (test_shared_task_id, 'Test Original Task', current_user_id, NOW(), NOW());
    RAISE NOTICE '✓ Task copy created successfully';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ ERROR creating task copy: %', SQLERRM;
    RETURN;
  END;

  RAISE NOTICE '=== ALL TESTS PASSED ===';
  RAISE NOTICE 'Shared task insertion is working correctly!';

END $$;

-- Verify the results
SELECT 
  '=== VERIFICATION RESULTS ===' as section;

SELECT 
  'Original task created:' as details,
  id,
  text,
  user_id,
  created_at
FROM todos 
WHERE id LIKE 'test-orig-%'
ORDER BY created_at DESC
LIMIT 1;

SELECT 
  'Shared task record created:' as details,
  id,
  original_task_id,
  shared_by,
  shared_with,
  status,
  created_at
FROM shared_tasks 
WHERE original_task_id LIKE 'test-orig-%'
ORDER BY created_at DESC
LIMIT 1;

SELECT 
  'Task copy created:' as details,
  id,
  text,
  user_id,
  created_at
FROM todos 
WHERE id LIKE 'test-shared-%'
ORDER BY created_at DESC
LIMIT 1;

-- Now test the manual shared task script
DO $$
DECLARE
  current_user_id uuid;
  friend_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  original_task_id text := 'friend-task-' || extract(epoch from now())::text;
  shared_task_id text := 'shared-task-' || extract(epoch from now())::text;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'ERROR: You are not logged in!';
    RETURN;
  END IF;

  RAISE NOTICE '=== TESTING MANUAL SHARED TASK SCRIPT ===';
  RAISE NOTICE 'Current user: %', current_user_id;
  RAISE NOTICE 'Friend ID: %', friend_id;

  -- Create friend user
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES (
      friend_id,
      'friend2@example.com',
      crypt('friendpass123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW()
    );
    RAISE NOTICE '✓ Friend user created';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Friend user already exists or error: %', SQLERRM;
  END;

  -- Create friend profile
  BEGIN
    INSERT INTO profiles (id, full_name, username, avatar_url)
    VALUES (friend_id, 'Jane Friend', 'janefriend', '');
    RAISE NOTICE '✓ Friend profile created';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Friend profile already exists or error: %', SQLERRM;
  END;

  -- Create friendship
  BEGIN
    INSERT INTO friendships (user_id, friend_id, status)
    VALUES 
      (current_user_id, friend_id, 'accepted'),
      (friend_id, current_user_id, 'accepted');
    RAISE NOTICE '✓ Friendship created';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Friendship already exists or error: %', SQLERRM;
  END;

  -- Create original task for the friend
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
      'Plan weekend trip',
      'Need to plan activities for the weekend getaway',
      false,
      null,
      NOW() + INTERVAL '2 days',
      friend_id,
      NOW(),
      NOW()
    );
    RAISE NOTICE '✓ Original task created for friend';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR creating original task: %', SQLERRM;
    RETURN;
  END;

  -- Create shared task record
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

  -- Create copy of task for you (the recipient)
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
      'Plan weekend trip',
      'Need to plan activities for the weekend getaway',
      false,
      null,
      NOW() + INTERVAL '2 days',
      current_user_id,
      NOW(),
      NOW()
    );
    RAISE NOTICE '✓ Task copy created for you';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR creating task copy: %', SQLERRM;
    RETURN;
  END;

  RAISE NOTICE '=== MANUAL SHARED TASK CREATED SUCCESSFULLY ===';
  RAISE NOTICE 'Friend "Jane Friend" has shared a task with you!';

END $$;

-- Show final results
SELECT 
  '=== FINAL RESULTS ===' as section;

SELECT 
  'Friend profile created:' as details,
  id,
  full_name,
  username
FROM profiles 
WHERE id = '22222222-2222-2222-2222-222222222222'::uuid;

SELECT 
  'Friendship status:' as details,
  user_id,
  friend_id,
  status
FROM friendships 
WHERE (user_id = auth.uid() AND friend_id = '22222222-2222-2222-2222-222222222222'::uuid)
   OR (user_id = '22222222-2222-2222-2222-222222222222'::uuid AND friend_id = auth.uid());

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
  'Your total shared tasks:' as details,
  COUNT(*) as shared_tasks_count
FROM shared_tasks 
WHERE shared_with = auth.uid(); 