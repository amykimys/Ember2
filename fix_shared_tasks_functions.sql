-- Fix Shared Tasks Functions
-- This script creates the missing functions for shared tasks

-- 0. Drop existing functions first
DROP FUNCTION IF EXISTS share_task_with_friend(TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS accept_shared_task(UUID, UUID);
DROP FUNCTION IF EXISTS decline_shared_task(UUID, UUID);
DROP FUNCTION IF EXISTS get_pending_shared_tasks(UUID);

-- 1. Create function to share a task with a friend (auto-accept)
CREATE OR REPLACE FUNCTION share_task_with_friend(
  task_id TEXT,
  user_id UUID,
  friend_id UUID
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
  SELECT EXISTS(SELECT 1 FROM todos WHERE id = task_id) INTO task_exists;
  
  IF NOT task_exists THEN
    RAISE EXCEPTION 'Task with ID % does not exist', task_id;
  END IF;

  -- Check if this task is already shared with this friend
  SELECT st.original_task_id
  INTO original_task_id
  FROM shared_tasks st
  WHERE st.original_task_id = task_id AND st.shared_by = user_id AND st.shared_with = friend_id;
  
  -- If not already shared, create the shared task record and immediately accept it
  IF NOT FOUND THEN
    -- Generate a new task ID using timestamp to ensure uniqueness
    new_task_id := 'shared-' || extract(epoch from now())::text || '-' || floor(random() * 1000000)::text;
    
    -- Insert the shared task record with 'accepted' status
    INSERT INTO shared_tasks (original_task_id, shared_by, shared_with, status)
    VALUES (task_id, user_id, friend_id, 'accepted');
    
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
      friend_id, -- The recipient user
      NOW(),
      NOW()
    FROM todos t
    WHERE t.id = task_id;
    
    -- Log success
    RAISE NOTICE 'Task % shared successfully with user %. New task ID: %', task_id, friend_id, new_task_id;
  ELSE
    RAISE NOTICE 'Task % is already shared with user %', task_id, friend_id;
  END IF;
END;
$$;

-- 2. Create function to accept a shared task
CREATE OR REPLACE FUNCTION accept_shared_task(
  shared_task_id UUID,
  user_id UUID
) RETURNS VOID AS $$
DECLARE
  original_task_id TEXT;
  shared_by_user UUID;
BEGIN
  -- Get the original task details
  SELECT st.original_task_id, st.shared_by
  INTO original_task_id, shared_by_user
  FROM shared_tasks st
  WHERE st.id = shared_task_id AND st.shared_with = user_id AND st.status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shared task not found or already processed';
  END IF;
  
  -- Update the shared task status
  UPDATE shared_tasks 
  SET status = 'accepted', updated_at = NOW()
  WHERE id = shared_task_id;
  
  -- Create a copy of the task for the accepting user
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
    gen_random_uuid()::text,
    t.text,
    t.description,
    false, -- Start as not completed
    t.category_id,
    t.date,
    t.repeat,
    t.repeat_end_date,
    t.reminder_time,
    t.custom_repeat_dates,
    user_id, -- The accepting user
    NOW(),
    NOW()
  FROM todos t
  WHERE t.id = original_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create function to decline a shared task
CREATE OR REPLACE FUNCTION decline_shared_task(
  shared_task_id UUID,
  user_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE shared_tasks 
  SET status = 'declined', updated_at = NOW()
  WHERE id = shared_task_id AND shared_with = user_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shared task not found or already processed';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create function to get pending shared tasks for a user
CREATE OR REPLACE FUNCTION get_pending_shared_tasks(target_user_id UUID)
RETURNS TABLE (
  shared_task_id UUID,
  original_task_id TEXT,
  task_text TEXT,
  task_description TEXT,
  task_date TIMESTAMP WITH TIME ZONE,
  shared_by_name TEXT,
  shared_by_avatar TEXT,
  shared_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    st.id,
    st.original_task_id,
    t.text,
    t.description,
    t.date,
    p.full_name,
    p.avatar_url,
    st.created_at
  FROM shared_tasks st
  JOIN todos t ON st.original_task_id = t.id
  JOIN profiles p ON st.shared_by = p.id
  WHERE st.shared_with = target_user_id 
    AND st.status = 'pending'
  ORDER BY st.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION share_task_with_friend TO authenticated;
GRANT EXECUTE ON FUNCTION accept_shared_task TO authenticated;
GRANT EXECUTE ON FUNCTION decline_shared_task TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_shared_tasks TO authenticated;

-- 6. Test the function (uncomment to test)
/*
SELECT * FROM get_pending_shared_tasks('YOUR_USER_ID'::uuid);
*/

-- Test the function
DO $$
DECLARE
  current_user_id uuid;
  test_task_id text := 'test-share-' || extract(epoch from now())::text;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'ERROR: You are not logged in!';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing updated share_task_with_friend function...';
  RAISE NOTICE 'Current user: %', current_user_id;
  RAISE NOTICE 'Test task ID: %', test_task_id;

  -- Create a test task
  INSERT INTO todos (id, text, user_id, date, created_at)
  VALUES (test_task_id, 'Test Share Task', current_user_id, NOW(), NOW());

  -- Try to share the task with yourself
  PERFORM share_task_with_friend(test_task_id, current_user_id, current_user_id);
  
  RAISE NOTICE 'Function test completed!';
END $$;

-- Show the results
SELECT 
  '=== FUNCTION TEST RESULTS ===' as section;

SELECT 
  'Test task created:' as details,
  id,
  text,
  user_id
FROM todos 
WHERE text = 'Test Share Task'
ORDER BY created_at DESC
LIMIT 1;

SELECT 
  'Shared task record created:' as details,
  id,
  original_task_id,
  shared_by,
  shared_with,
  status
FROM shared_tasks 
WHERE original_task_id LIKE 'test-share-%'
ORDER BY created_at DESC
LIMIT 1;

SELECT 
  'Copied task created:' as details,
  id,
  text,
  user_id
FROM todos 
WHERE id LIKE 'shared-%'
ORDER BY created_at DESC
LIMIT 1; 