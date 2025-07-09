-- Add copied_task_id column to shared_tasks table
-- This script adds the necessary column to track which copied task corresponds to which original shared task

-- Add copied_task_id column to shared_tasks table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shared_tasks' 
    AND column_name = 'copied_task_id'
  ) THEN
    ALTER TABLE shared_tasks ADD COLUMN copied_task_id TEXT;
    RAISE NOTICE 'Added copied_task_id column to shared_tasks table';
  ELSE
    RAISE NOTICE 'copied_task_id column already exists in shared_tasks table';
  END IF;
END $$;

-- Update the share_task_with_friend function to store the copied_task_id
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

-- Test the updated function
DO $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to test the function';
    RETURN;
  END IF;

  RAISE NOTICE 'Function updated successfully!';
  RAISE NOTICE 'Current user: %', current_user_id;
END $$; 