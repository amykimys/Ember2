-- Fix pg_net Issue - Remove problematic triggers and use simpler approach
-- This script removes the pg_net-dependent triggers that are causing the error

-- Drop the problematic triggers first (with CASCADE to handle dependencies)
DROP TRIGGER IF EXISTS shared_event_notification_trigger ON shared_events CASCADE;
DROP TRIGGER IF EXISTS shared_task_notification_trigger ON shared_tasks CASCADE;
DROP TRIGGER IF EXISTS trigger_shared_event_notification ON shared_events CASCADE;
DROP TRIGGER IF EXISTS trigger_shared_task_notification ON shared_tasks CASCADE;

-- Drop the functions that use pg_net
DROP FUNCTION IF EXISTS handle_shared_event_notification() CASCADE;
DROP FUNCTION IF EXISTS handle_shared_task_notification() CASCADE;

-- Create a simpler function that doesn't use pg_net
-- This will just log the share action without sending notifications
CREATE OR REPLACE FUNCTION log_shared_item()
RETURNS TRIGGER AS $$
BEGIN
  -- Just log the share action for debugging
  IF TG_TABLE_NAME = 'shared_events' THEN
    RAISE NOTICE 'Event shared: shared_by=%, shared_with=%, event_id=%', 
      NEW.shared_by, NEW.shared_with, NEW.original_event_id;
  ELSIF TG_TABLE_NAME = 'shared_tasks' THEN
    RAISE NOTICE 'Task shared: shared_by=%, shared_with=%, task_id=%', 
      NEW.shared_by, NEW.shared_with, NEW.original_task_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing logging triggers first
DROP TRIGGER IF EXISTS shared_event_logging_trigger ON shared_events;
DROP TRIGGER IF EXISTS shared_task_logging_trigger ON shared_tasks;

-- Create simple logging triggers (no pg_net dependency)
CREATE TRIGGER shared_event_logging_trigger
  AFTER INSERT ON shared_events
  FOR EACH ROW
  EXECUTE FUNCTION log_shared_item();

CREATE TRIGGER shared_task_logging_trigger
  AFTER INSERT ON shared_tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_shared_item();

-- Update the share_task_with_friend function to work without pg_net
CREATE OR REPLACE FUNCTION share_task_with_friend(
  p_task_id TEXT,
  p_user_id UUID,
  p_friend_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  original_task_id TEXT;
  new_task_id TEXT;
  task_exists BOOLEAN;
BEGIN
  -- Check if the original task exists
  SELECT EXISTS(SELECT 1 FROM todos WHERE id = p_task_id) INTO task_exists;
  
  IF NOT task_exists THEN
    RAISE EXCEPTION 'Task with ID % does not exist', p_task_id;
  END IF;

  -- Check if this task is already shared with this friend
  SELECT st.original_task_id
  INTO original_task_id
  FROM shared_tasks st
  WHERE st.original_task_id = p_task_id 
    AND st.shared_by = p_user_id 
    AND st.shared_with = p_friend_id;
  
  -- If not already shared, create the shared task record
  IF NOT FOUND THEN
    -- Generate a new task ID using timestamp to ensure uniqueness
    new_task_id := 'shared-' || extract(epoch from now())::text || '-' || floor(random() * 1000000)::text;
    
    -- Insert the shared task record with 'accepted' status and store the copied task ID
    INSERT INTO shared_tasks (original_task_id, shared_by, shared_with, status, copied_task_id)
    VALUES (p_task_id, p_user_id, p_friend_id, 'accepted', new_task_id);
    
    -- Create a copy of the task for the recipient user
    INSERT INTO todos (
      id,
      text,
      description,
      completed,
      category_id,
      date,
      repeat,
      repeat_end_date,
      reminder_time,
      custom_repeat_dates,
      user_id,
      created_at,
      updated_at
    )
    SELECT 
      new_task_id,
      t.text,
      t.description,
      false, -- Start as not completed
      t.category_id,
      t.date,
      t.repeat,
      t.repeat_end_date,
      t.reminder_time,
      t.custom_repeat_dates,
      p_friend_id, -- The recipient user
      NOW(),
      NOW()
    FROM todos t
    WHERE t.id = p_task_id;
    
    -- Log success
    RAISE NOTICE 'Task % shared successfully with user %. New task ID: %', p_task_id, p_friend_id, new_task_id;
  ELSE
    RAISE NOTICE 'Task % is already shared with user %', p_task_id, p_friend_id;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION share_task_with_friend TO authenticated;
GRANT EXECUTE ON FUNCTION log_shared_item TO authenticated;

-- Test the fixed function
DO $$
DECLARE
  current_user_id uuid;
  test_task_id text := 'test-fix-' || extract(epoch from now())::text;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to test the fixed function';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing fixed share_task_with_friend function...';
  RAISE NOTICE 'Current user: %', current_user_id;
  RAISE NOTICE 'Test task ID: %', test_task_id;

  -- Create a test task
  INSERT INTO todos (id, text, user_id, date, created_at)
  VALUES (test_task_id, 'Test Fixed Task', current_user_id, NOW(), NOW());

  -- Try to share the task with yourself
  PERFORM share_task_with_friend(test_task_id, current_user_id, current_user_id);
  
  RAISE NOTICE 'Fixed function test completed successfully!';
END $$;

-- Show the results
SELECT 
  '=== FIXED FUNCTION TEST RESULTS ===' as section;

SELECT 
  'Test task created:' as details,
  id,
  text,
  user_id
FROM todos 
WHERE text = 'Test Fixed Task'
ORDER BY created_at DESC
LIMIT 1;

SELECT 
  'Shared task record created:' as details,
  id,
  original_task_id,
  shared_by,
  shared_with,
  status,
  copied_task_id
FROM shared_tasks 
WHERE original_task_id LIKE 'test-fix-%'
ORDER BY created_at DESC
LIMIT 5; 