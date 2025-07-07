-- Test if share_task_with_friend function exists and works
-- This script will help diagnose the issue with task sharing

-- Check if the function exists
SELECT 
  'Function exists check:' as info,
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name = 'share_task_with_friend';

-- Check the function definition
SELECT 
  'Function definition:' as info,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'share_task_with_friend';

-- Test with a simple call (this will fail if function doesn't exist)
DO $$
BEGIN
  RAISE NOTICE 'Testing share_task_with_friend function...';
  
  -- This will fail if the function doesn't exist, but that's what we want to test
  PERFORM share_task_with_friend(
    'test-task-id',
    '00000000-0000-0000-0000-000000000000'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
  
  RAISE NOTICE 'Function exists and can be called!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR: Function does not exist or has issues: %', SQLERRM;
END $$;

-- Check if shared_tasks table exists
SELECT 
  'Shared tasks table check:' as info,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'shared_tasks';

-- Check shared_tasks table structure
SELECT 
  'Shared tasks columns:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'shared_tasks'
ORDER BY ordinal_position; 