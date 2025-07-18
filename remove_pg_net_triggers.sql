-- Remove pg_net Triggers and Functions
-- This script removes all pg_net-dependent triggers that are causing the error

-- 1. Drop the problematic triggers first
DROP TRIGGER IF EXISTS shared_event_notification_trigger ON shared_events;
DROP TRIGGER IF EXISTS shared_task_notification_trigger ON shared_tasks;
DROP TRIGGER IF EXISTS shared_note_notification_trigger ON shared_notes;
DROP TRIGGER IF EXISTS notify_task_shared_trigger ON shared_tasks;
DROP TRIGGER IF EXISTS notify_event_shared_trigger ON shared_events;
DROP TRIGGER IF EXISTS notify_note_shared_trigger ON shared_notes;

-- 2. Drop the problematic functions that use pg_net
DROP FUNCTION IF EXISTS handle_shared_event_notification();
DROP FUNCTION IF EXISTS handle_shared_task_notification();
DROP FUNCTION IF EXISTS handle_shared_note_notification();
DROP FUNCTION IF EXISTS send_share_notification(TEXT, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS notify_task_shared(TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS notify_event_shared(TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS notify_note_shared(TEXT, UUID, UUID);

-- 3. Remove pg_net extension if it exists (optional - you can keep it if other parts of your app use it)
-- DROP EXTENSION IF EXISTS "pg_net";

-- 4. Verify the cleanup
DO $$
DECLARE
  trigger_count INTEGER;
  function_count INTEGER;
BEGIN
  -- Count remaining triggers
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger 
  WHERE tgname LIKE '%notification%' OR tgname LIKE '%shared%';
  
  -- Count remaining functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND (p.proname LIKE '%notification%' OR p.proname LIKE '%shared%');
  
  RAISE NOTICE 'Remaining notification triggers: %', trigger_count;
  RAISE NOTICE 'Remaining notification functions: %', function_count;
  
  IF trigger_count = 0 AND function_count = 0 THEN
    RAISE NOTICE '✅ All pg_net triggers and functions removed successfully!';
  ELSE
    RAISE NOTICE '⚠️  Some triggers or functions may still exist. Check manually.';
  END IF;
END $$;

-- 5. Test that share_task_with_friend still works
DO $$
DECLARE
  current_user_id uuid;
  test_friend_id uuid := gen_random_uuid();
  test_task_id TEXT := 'test-remove-triggers-' || extract(epoch from now())::text;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to test the function';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing share_task_with_friend after trigger removal...';
  RAISE NOTICE 'Current user: %', current_user_id;
  RAISE NOTICE 'Test friend: %', test_friend_id;
  RAISE NOTICE 'Test task: %', test_task_id;

  -- Create a test task
  INSERT INTO todos (id, text, user_id, date, created_at)
  VALUES (test_task_id, 'Test task for trigger removal', current_user_id, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Test sharing (this should work without pg_net errors)
  PERFORM share_task_with_friend(test_task_id, current_user_id, test_friend_id);
  
  RAISE NOTICE '✅ share_task_with_friend works after trigger removal!';
  
  -- Clean up test data
  DELETE FROM todos WHERE id = test_task_id;
  DELETE FROM shared_tasks WHERE original_task_id = test_task_id;
  
END $$; 