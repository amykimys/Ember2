-- Debug Shared Task Issue
-- This script will help identify exactly why tasks aren't being shared

-- Step 1: Check authentication and current user
SELECT 
  '=== AUTHENTICATION CHECK ===' as section;
SELECT 
  'Current user ID:' as info,
  auth.uid() as user_id;

-- Step 2: Check if the function exists
SELECT 
  '=== FUNCTION CHECK ===' as section;
SELECT 
  'Function exists:' as info,
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name = 'share_task_with_friend'
  AND routine_schema = 'public';

-- Step 3: Check function permissions
SELECT 
  '=== FUNCTION PERMISSIONS ===' as section;
SELECT 
  'Function permissions:' as info,
  routine_name,
  security_type
FROM information_schema.routines 
WHERE routine_name = 'share_task_with_friend'
  AND routine_schema = 'public';

-- Step 4: Check if there are any existing shared tasks
SELECT 
  '=== EXISTING SHARED TASKS ===' as section;
SELECT 
  'Total shared tasks count:' as metric,
  COUNT(*) as count
FROM shared_tasks;

SELECT 
  'All shared tasks:' as details,
  id,
  original_task_id,
  shared_by,
  shared_with,
  status,
  created_at
FROM shared_tasks
ORDER BY created_at DESC
LIMIT 10;

-- Step 5: Check if there are any todos
SELECT 
  '=== EXISTING TODOS ===' as section;
SELECT 
  'Total todos count:' as metric,
  COUNT(*) as count
FROM todos;

SELECT 
  'Recent todos:' as details,
  id,
  text,
  user_id,
  created_at
FROM todos
ORDER BY created_at DESC
LIMIT 5;

-- Step 6: Test the function manually with a simple task
DO $$
DECLARE
  current_user_id uuid;
  test_task_id text := 'debug-test-' || extract(epoch from now())::text;
  test_friend_id uuid := '87654321-4321-4321-4321-cba987654321'::uuid;
  result text;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'ERROR: You are not logged in!';
    RETURN;
  END IF;

  RAISE NOTICE '=== MANUAL FUNCTION TEST ===';
  RAISE NOTICE 'Current user: %', current_user_id;
  RAISE NOTICE 'Test task ID: %', test_task_id;
  RAISE NOTICE 'Test friend ID: %', test_friend_id;

  -- Create a simple test task
  BEGIN
    INSERT INTO todos (id, text, user_id, date, created_at)
    VALUES (test_task_id, 'Debug Test Task', current_user_id, NOW(), NOW());
    RAISE NOTICE '✓ Test task created successfully';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ ERROR creating test task: %', SQLERRM;
    RETURN;
  END;

  -- Try to share the task with yourself (this should work)
  BEGIN
    PERFORM share_task_with_friend(test_task_id, current_user_id, current_user_id);
    RAISE NOTICE '✓ Function call completed without error';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ ERROR calling share_task_with_friend: %', SQLERRM;
    RAISE NOTICE '✗ Error detail: %', SQLSTATE;
  END;

  -- Check if shared task was created
  SELECT COUNT(*) INTO result FROM shared_tasks WHERE original_task_id = test_task_id;
  RAISE NOTICE 'Shared tasks found for test task: %', result;

END $$;

-- Step 7: Check the results of the manual test
SELECT 
  '=== MANUAL TEST RESULTS ===' as section;
SELECT 
  'Test task created:' as details,
  id,
  text,
  user_id
FROM todos 
WHERE text = 'Debug Test Task'
ORDER BY created_at DESC
LIMIT 1;

SELECT 
  'Shared task created:' as details,
  id,
  original_task_id,
  shared_by,
  shared_with,
  status
FROM shared_tasks 
WHERE original_task_id LIKE 'debug-test-%'
ORDER BY created_at DESC
LIMIT 1;

-- Step 8: Check function definition
SELECT 
  '=== FUNCTION DEFINITION ===' as section;
SELECT 
  'Function definition:' as info,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'share_task_with_friend'
  AND routine_schema = 'public'; 