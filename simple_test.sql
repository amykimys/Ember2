-- Simple Test for Shared Task Insert
DO $$
DECLARE
  current_user_id uuid;
  test_task_id text := 'simple-test-' || extract(epoch from now())::text;
BEGIN
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'ERROR: Not logged in!';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing shared task insert...';
  RAISE NOTICE 'User: %', current_user_id;

  -- Try to insert a shared task record
  BEGIN
    INSERT INTO shared_tasks (
      original_task_id,
      shared_by,
      shared_with,
      status,
      created_at,
      updated_at
    ) VALUES (
      test_task_id,
      current_user_id,
      current_user_id,
      'accepted',
      NOW(),
      NOW()
    );
    RAISE NOTICE 'SUCCESS: Shared task inserted!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: %', SQLERRM;
  END;

END $$;

-- Check if it worked
SELECT 
  'Test shared task:' as info,
  id,
  original_task_id,
  shared_by,
  shared_with,
  status
FROM shared_tasks 
WHERE original_task_id LIKE 'simple-test-%'
ORDER BY created_at DESC
LIMIT 1; 