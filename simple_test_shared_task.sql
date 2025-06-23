-- Simple Test Shared Task
-- This script will test the share_task_with_friend function step by step

-- Step 1: Check if you're logged in
SELECT 
  '=== STEP 1: AUTHENTICATION ===' as step;
SELECT 
  'Current user ID:' as info,
  auth.uid() as user_id;

-- Step 2: Check if the function exists
SELECT 
  '=== STEP 2: FUNCTION CHECK ===' as step;
SELECT 
  'Function exists:' as info,
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines 
WHERE routine_name = 'share_task_with_friend'
  AND routine_schema = 'public';

-- Step 3: Create a simple test task
DO $$
DECLARE
  current_user_id uuid;
  test_task_id text := 'simple-test-' || extract(epoch from now())::text;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'ERROR: You are not logged in!';
    RETURN;
  END IF;

  RAISE NOTICE '=== STEP 3: CREATING TEST TASK ===';
  RAISE NOTICE 'Current user: %', current_user_id;
  RAISE NOTICE 'Test task ID: %', test_task_id;

  -- Create a test task
  BEGIN
    INSERT INTO todos (id, text, user_id, date, created_at)
    VALUES (test_task_id, 'Simple Test Task', current_user_id, NOW(), NOW());
    RAISE NOTICE '✓ Test task created successfully';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ ERROR creating test task: %', SQLERRM;
    RETURN;
  END;

  -- Step 4: Try to share the task with yourself
  RAISE NOTICE '=== STEP 4: SHARING TASK ===';
  BEGIN
    PERFORM share_task_with_friend(test_task_id, current_user_id, current_user_id);
    RAISE NOTICE '✓ Function call completed without error';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ ERROR calling share_task_with_friend: %', SQLERRM;
    RAISE NOTICE '✗ Error detail: %', SQLSTATE;
  END;

  -- Step 5: Check results
  RAISE NOTICE '=== STEP 5: CHECKING RESULTS ===';
  
  -- Check if shared task record was created
  IF EXISTS (SELECT 1 FROM shared_tasks WHERE original_task_id = test_task_id) THEN
    RAISE NOTICE '✓ Shared task record created';
  ELSE
    RAISE NOTICE '✗ Shared task record NOT created';
  END IF;

  -- Check if copied task was created
  IF EXISTS (SELECT 1 FROM todos WHERE id LIKE 'shared-%' AND text = 'Simple Test Task') THEN
    RAISE NOTICE '✓ Copied task created';
  ELSE
    RAISE NOTICE '✗ Copied task NOT created';
  END IF;

END $$;

-- Step 6: Show detailed results
SELECT 
  '=== STEP 6: DETAILED RESULTS ===' as step;

SELECT 
  'Test task created:' as details,
  id,
  text,
  user_id,
  created_at
FROM todos 
WHERE text = 'Simple Test Task'
ORDER BY created_at DESC
LIMIT 1;

SELECT 
  'Shared task records:' as details,
  id,
  original_task_id,
  shared_by,
  shared_with,
  status,
  created_at
FROM shared_tasks 
WHERE original_task_id LIKE 'simple-test-%'
ORDER BY created_at DESC;

SELECT 
  'Copied tasks:' as details,
  id,
  text,
  user_id,
  created_at
FROM todos 
WHERE id LIKE 'shared-%' AND text = 'Simple Test Task'
ORDER BY created_at DESC;

-- Step 7: Check table structure
SELECT 
  '=== STEP 7: TABLE STRUCTURE ===' as step;

SELECT 
  'Todos table columns:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'todos' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 
  'Shared_tasks table columns:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'shared_tasks' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 8: Check RLS policies
SELECT 
  '=== STEP 8: RLS POLICIES ===' as step;

SELECT 
  'Todos RLS policies:' as info,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'todos';

SELECT 
  'Shared_tasks RLS policies:' as info,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'shared_tasks'; 