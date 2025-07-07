-- Update Shared Task Function to Auto-Create Friendships
-- This script updates the share_task_with_friend function to automatically create friendships when tasks are shared

-- Drop the existing function
DROP FUNCTION IF EXISTS share_task_with_friend(TEXT, UUID, UUID);

-- Create the updated function with automatic friendship creation
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
  friendship_exists BOOLEAN;
BEGIN
  -- Check if the original task exists
  SELECT EXISTS(SELECT 1 FROM todos WHERE id = task_id) INTO task_exists;
  
  IF NOT task_exists THEN
    RAISE EXCEPTION 'Task with ID % does not exist', task_id;
  END IF;

  -- Check if friendship already exists between the users
  SELECT EXISTS(
    SELECT 1 FROM friendships f
    WHERE (f.user_id = share_task_with_friend.user_id AND f.friend_id = share_task_with_friend.friend_id)
       OR (f.user_id = share_task_with_friend.friend_id AND f.friend_id = share_task_with_friend.user_id)
  ) INTO friendship_exists;

  -- If no friendship exists, create it automatically
  IF NOT friendship_exists THEN
    INSERT INTO friendships (user_id, friend_id, status, created_at)
    VALUES 
      (share_task_with_friend.user_id, share_task_with_friend.friend_id, 'accepted', NOW()),
      (share_task_with_friend.friend_id, share_task_with_friend.user_id, 'accepted', NOW())
    ON CONFLICT (user_id, friend_id) DO NOTHING;
    
    RAISE NOTICE 'Friendship created automatically between users % and %', share_task_with_friend.user_id, share_task_with_friend.friend_id;
  END IF;

  -- Check if this task is already shared with this friend
  SELECT st.original_task_id
  INTO original_task_id
  FROM shared_tasks st
  WHERE st.original_task_id = task_id AND st.shared_by = share_task_with_friend.user_id AND st.shared_with = share_task_with_friend.friend_id;
  
  -- If not already shared, create the shared task record and immediately accept it
  IF NOT FOUND THEN
    -- Generate a new task ID using timestamp to ensure uniqueness
    new_task_id := 'shared-' || extract(epoch from now())::text || '-' || floor(random() * 1000000)::text;
    
    -- Insert the shared task record with 'accepted' status
    INSERT INTO shared_tasks (original_task_id, shared_by, shared_with, status)
    VALUES (task_id, share_task_with_friend.user_id, share_task_with_friend.friend_id, 'accepted');
    
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
      share_task_with_friend.friend_id, -- The recipient user
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION share_task_with_friend TO authenticated;

-- Test the updated function
DO $$
DECLARE
  current_user_id uuid;
  test_friend_id uuid := gen_random_uuid();
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to test the updated function';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing updated share_task_with_friend function...';
  RAISE NOTICE 'Current user: %', current_user_id;
  RAISE NOTICE 'Test friend ID: %', test_friend_id;

  -- Create a test friend user
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    test_friend_id::uuid,
    'testfriend@example.com',
    crypt('testpass123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Create test friend profile
  INSERT INTO profiles (id, full_name, username, avatar_url)
  VALUES (test_friend_id::uuid, 'Test Friend', 'testfriend', '')
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
    'Test Shared Task with Auto-Friendship',
    'This task will test the automatic friendship creation',
    false,
    null,
    NOW() + INTERVAL '1 day',
    current_user_id,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Test sharing the task (this should create a friendship automatically)
  PERFORM share_task_with_friend(
    'test-task-' || extract(epoch from now())::text,
    current_user_id,
    test_friend_id
  );

  RAISE NOTICE 'Test completed! Check if friendship was created automatically.';

END $$;

-- Show the results
SELECT 
  '=== TEST RESULTS ===' as info;

SELECT 
  'Friendships created:' as details,
  user_id,
  friend_id,
  status,
  created_at
FROM friendships 
WHERE user_id = auth.uid() OR friend_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;

SELECT 
  'Shared tasks:' as details,
  original_task_id,
  shared_by,
  shared_with,
  status
FROM shared_tasks 
WHERE shared_by = auth.uid() OR shared_with = auth.uid()
ORDER BY created_at DESC
LIMIT 10; 