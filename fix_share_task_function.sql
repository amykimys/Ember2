-- Fix Share Task Function - Simplified Version
-- This script creates a simple, working version of the share_task_with_friend function

-- Drop the existing function
DROP FUNCTION IF EXISTS share_task_with_friend(TEXT, UUID, UUID);

-- Create a simple, working function with different parameter names to avoid conflicts
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
    
    -- Insert the shared task record with 'accepted' status
    INSERT INTO shared_tasks (original_task_id, shared_by, shared_with, status)
    VALUES (p_task_id, p_user_id, p_friend_id, 'accepted');
    
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

-- Test the function
DO $$
DECLARE
  current_user_id uuid;
  test_friend_id uuid := gen_random_uuid();
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to test the function';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing share_task_with_friend function...';
  RAISE NOTICE 'Current user: %', current_user_id;
  RAISE NOTICE 'Test friend ID: %', test_friend_id;

  -- Create a test friend user
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    test_friend_id,
    'testfriend@example.com',
    crypt('testpass123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Create test friend profile
  INSERT INTO profiles (id, full_name, username, avatar_url)
  VALUES (test_friend_id, 'Test Friend', 'testfriend', '')
  ON CONFLICT (id) DO NOTHING;

  -- Create a test task
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
    'test-task-' || extract(epoch from now())::text,
    'Test Shared Task',
    'This task will test the sharing functionality',
    false,
    null,
    NOW() + INTERVAL '1 day',
    current_user_id,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Test sharing the task
  PERFORM share_task_with_friend(
    'test-task-' || extract(epoch from now())::text,
    current_user_id,
    test_friend_id
  );

  RAISE NOTICE 'Test completed!';

END $$; 