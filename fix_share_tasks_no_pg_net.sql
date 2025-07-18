-- Fix Share Tasks Functionality - No pg_net Dependencies
-- This script removes all pg_net usage that's causing the error

-- 1. First, let's ensure the shared_tasks table has all necessary columns
DO $$
BEGIN
  -- Add copied_task_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shared_tasks' 
    AND column_name = 'copied_task_id'
  ) THEN
    ALTER TABLE shared_tasks ADD COLUMN copied_task_id TEXT;
    RAISE NOTICE 'Added copied_task_id column to shared_tasks table';
  END IF;

  -- Add status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shared_tasks' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE shared_tasks ADD COLUMN status TEXT DEFAULT 'accepted';
    RAISE NOTICE 'Added status column to shared_tasks table';
  END IF;
END $$;

-- 2. Drop any existing functions that might use pg_net
DROP FUNCTION IF EXISTS share_task_with_friend(TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS send_share_notification(TEXT, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS notify_task_shared(TEXT, UUID, UUID);

-- 3. Create a clean share_task_with_friend function (NO pg_net)
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
  friendship_exists BOOLEAN;
BEGIN
  -- Check if the original task exists
  SELECT EXISTS(SELECT 1 FROM todos WHERE id = p_task_id) INTO task_exists;
  
  IF NOT task_exists THEN
    RAISE EXCEPTION 'Task with ID % does not exist', p_task_id;
  END IF;

  -- Check if friendship exists (optional - you can remove this if you want to allow sharing without friendship)
  SELECT EXISTS(
    SELECT 1 FROM friendships 
    WHERE (user_id = p_user_id AND friend_id = p_friend_id)
       OR (user_id = p_friend_id AND friend_id = p_user_id)
  ) INTO friendship_exists;

  IF NOT friendship_exists THEN
    RAISE NOTICE 'No friendship found between users % and %. Creating automatic friendship.', p_user_id, p_friend_id;
    
    -- Create friendship automatically
    INSERT INTO friendships (user_id, friend_id, status, created_at)
    VALUES 
      (p_user_id, p_friend_id, 'accepted', NOW()),
      (p_friend_id, p_user_id, 'accepted', NOW())
    ON CONFLICT (user_id, friend_id) DO NOTHING;
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
    
    -- Insert the shared task record
    INSERT INTO shared_tasks (original_task_id, shared_by, shared_with, status, copied_task_id, created_at)
    VALUES (p_task_id, p_user_id, p_friend_id, 'accepted', new_task_id, NOW());
    
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
      auto_move,
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
      false, -- Don't auto-move shared tasks
      p_friend_id, -- The recipient user
      NOW(),
      NOW()
    FROM todos t
    WHERE t.id = p_task_id;
    
    -- Log success (NO pg_net, just database logging)
    RAISE NOTICE 'Task % shared successfully with user %. New task ID: %', p_task_id, p_friend_id, new_task_id;
  ELSE
    RAISE NOTICE 'Task % is already shared with user %', p_task_id, p_friend_id;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION share_task_with_friend TO authenticated;

-- 4. Create a function to remove friend from shared task
CREATE OR REPLACE FUNCTION remove_friend_from_shared_task(
  p_task_id TEXT,
  p_user_id UUID,
  p_friend_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  copied_task_id TEXT;
BEGIN
  -- Get the copied task ID
  SELECT st.copied_task_id
  INTO copied_task_id
  FROM shared_tasks st
  WHERE st.original_task_id = p_task_id 
    AND st.shared_by = p_user_id 
    AND st.shared_with = p_friend_id;
  
  IF FOUND THEN
    -- Delete the shared task record
    DELETE FROM shared_tasks 
    WHERE original_task_id = p_task_id 
      AND shared_by = p_user_id 
      AND shared_with = p_friend_id;
    
    -- Delete the copied task if it exists
    IF copied_task_id IS NOT NULL THEN
      DELETE FROM todos WHERE id = copied_task_id;
    END IF;
    
    RAISE NOTICE 'Removed friend % from shared task %', p_friend_id, p_task_id;
  ELSE
    RAISE NOTICE 'No shared task found to remove';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION remove_friend_from_shared_task TO authenticated;

-- 5. Create a function to get shared friends for a task
CREATE OR REPLACE FUNCTION get_shared_friends_for_task(
  p_task_id TEXT,
  p_user_id UUID
)
RETURNS TABLE(
  friend_id UUID,
  friend_name TEXT,
  friend_avatar TEXT,
  friend_username TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id::UUID as friend_id,
    p.full_name as friend_name,
    p.avatar_url as friend_avatar,
    p.username as friend_username
  FROM shared_tasks st
  JOIN profiles p ON p.id = st.shared_with
  WHERE st.original_task_id = p_task_id 
    AND st.shared_by = p_user_id
    AND st.status = 'accepted';
END;
$$;

GRANT EXECUTE ON FUNCTION get_shared_friends_for_task TO authenticated;

-- 6. Drop any problematic triggers that might use pg_net
DROP TRIGGER IF EXISTS notify_task_shared_trigger ON shared_tasks;
DROP TRIGGER IF EXISTS notify_event_shared_trigger ON shared_events;
DROP TRIGGER IF EXISTS notify_note_shared_trigger ON shared_notes;

-- 7. Test the functions
DO $$
DECLARE
  current_user_id uuid;
  test_friend_id uuid := gen_random_uuid();
  test_task_id TEXT := 'test-share-task-' || extract(epoch from now())::text;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to test the functions';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing share tasks functions (NO pg_net)...';
  RAISE NOTICE 'Current user: %', current_user_id;
  RAISE NOTICE 'Test friend: %', test_friend_id;
  RAISE NOTICE 'Test task: %', test_task_id;

  -- Create a test task
  INSERT INTO todos (id, text, user_id, date, created_at)
  VALUES (test_task_id, 'Test task for sharing', current_user_id, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Test sharing (this should work without pg_net errors)
  PERFORM share_task_with_friend(test_task_id, current_user_id, test_friend_id);
  
  -- Test getting shared friends
  PERFORM * FROM get_shared_friends_for_task(test_task_id, current_user_id);
  
  RAISE NOTICE 'All function tests completed successfully (NO pg_net)!';
END $$; 