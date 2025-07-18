-- Fix Self-Friendship Issue in share_task_with_friend Function
-- This script adds validation to prevent users from sharing tasks with themselves

-- Check if you're logged in
SELECT 
  '=== AUTHENTICATION CHECK ===' as info;
SELECT 
  'Current user ID:' as status,
  auth.uid() as user_id;

-- 1. First, let's check the current function definition
SELECT 
  '=== CURRENT FUNCTION DEFINITION ===' as info;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'share_task_with_friend'
  AND routine_schema = 'public';

-- 2. Create the fixed share_task_with_friend function with self-friendship prevention
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
  -- PREVENT SELF-FRIENDSHIPS: Check if user is trying to share with themselves
  IF p_user_id = p_friend_id THEN
    RAISE EXCEPTION 'Cannot share task with yourself. User ID and friend ID must be different.';
  END IF;

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
    
    -- Create friendship automatically (but only if they're different users)
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

-- 3. Test the fixed function
DO $$
DECLARE
  current_user_id uuid;
  test_friend_id uuid := gen_random_uuid();
  test_task_id TEXT := 'test-share-task-' || extract(epoch from now())::text;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to test the function';
    RETURN;
  END IF;

  RAISE NOTICE '=== TESTING FIXED FUNCTION ===';
  RAISE NOTICE 'Current user: %', current_user_id;
  RAISE NOTICE 'Test friend: %', test_friend_id;
  
  -- Test 1: Try to share with yourself (should fail)
  BEGIN
    PERFORM share_task_with_friend(test_task_id, current_user_id, current_user_id);
    RAISE NOTICE '❌ ERROR: Self-sharing should have failed!';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '✅ SUCCESS: Self-sharing correctly prevented: %', SQLERRM;
  END;
  
  -- Test 2: Try to share with a different user (should work)
  BEGIN
    PERFORM share_task_with_friend(test_task_id, current_user_id, test_friend_id);
    RAISE NOTICE '✅ SUCCESS: Sharing with different user works!';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '❌ ERROR: Sharing with different user failed: %', SQLERRM;
  END;
END;
$$;

-- 4. Show the updated function definition
SELECT 
  '=== UPDATED FUNCTION DEFINITION ===' as info;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'share_task_with_friend'
  AND routine_schema = 'public'; 