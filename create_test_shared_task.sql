-- Create Test Shared Task
-- This script creates a test friend and sends a shared task to the current user

DO $$
DECLARE
  current_user_id uuid;
  test_friend_id uuid := '12345678-1234-1234-1234-123456789abc'::uuid;
  test_task_id text := 'test-task-' || extract(epoch from now())::text;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'ERROR: You are not logged in! Please log in first.';
    RETURN;
  END IF;

  RAISE NOTICE 'Current user: %', current_user_id;
  RAISE NOTICE 'Creating test friend and shared task...';

  -- Step 1: Create test friend user
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    test_friend_id,
    'testfriend@example.com',
    crypt('testpass123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Test friend user created';

  -- Step 2: Create test friend profile
  INSERT INTO profiles (id, full_name, username, avatar_url)
  VALUES (test_friend_id, 'Test Friend', 'testfriend', '')
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Test friend profile created';

  -- Step 3: Create friendship between current user and test friend
  INSERT INTO friendships (user_id, friend_id, status)
  VALUES 
    (current_user_id, test_friend_id, 'accepted'),
    (test_friend_id, current_user_id, 'accepted')
  ON CONFLICT (user_id, friend_id) DO NOTHING;

  RAISE NOTICE 'Friendship created';

  -- Step 4: Create a test task for the test friend
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
    test_task_id,
    'Test Shared Task',
    'This is a test task created by Test Friend to share with you',
    false,
    null,
    NOW() + INTERVAL '1 day',
    test_friend_id,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Test task created with ID: %', test_task_id;

  -- Step 5: Share the task with the current user
  BEGIN
    PERFORM share_task_with_friend(
      test_task_id,
      current_user_id,
      test_friend_id
    );
    RAISE NOTICE 'Task shared successfully!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR sharing task: %', SQLERRM;
  END;

  RAISE NOTICE '=== TEST COMPLETE ===';
  RAISE NOTICE 'A test friend named "Test Friend" has been created';
  RAISE NOTICE 'A task "Test Shared Task" has been created and shared with you';
  RAISE NOTICE 'Check your app to see if the shared friends appear at the bottom of the task';

END $$;

-- Verify the results
SELECT 
  '=== VERIFICATION ===' as info;

SELECT 
  'Test friend profile:' as details,
  id,
  full_name,
  username
FROM profiles 
WHERE id = '12345678-1234-1234-1234-123456789abc'::uuid;

SELECT 
  'Friendship status:' as details,
  user_id,
  friend_id,
  status
FROM friendships 
WHERE (user_id = auth.uid() AND friend_id = '12345678-1234-1234-1234-123456789abc'::uuid)
   OR (user_id = '12345678-1234-1234-1234-123456789abc'::uuid AND friend_id = auth.uid());

SELECT 
  'Test task created:' as details,
  id,
  text,
  description,
  user_id
FROM todos 
WHERE user_id = '12345678-1234-1234-1234-123456789abc'::uuid
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
WHERE (shared_by = '12345678-1234-1234-1234-123456789abc'::uuid AND shared_with = auth.uid())
   OR (shared_by = auth.uid() AND shared_with = '12345678-1234-1234-1234-123456789abc'::uuid);

SELECT 
  'Your tasks (should include the shared task):' as details,
  id,
  text,
  description,
  user_id
FROM todos 
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5; 