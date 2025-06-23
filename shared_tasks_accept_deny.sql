-- Add accept/deny functionality for shared tasks
-- This migration creates the necessary tables and functions for shared task management

-- 1. Drop existing shared_tasks table if it exists (we'll rebuild it)
DROP TABLE IF EXISTS shared_tasks CASCADE;

-- 2. Create new shared_tasks table with accept/deny functionality
CREATE TABLE shared_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_task_id TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(original_task_id, shared_by, shared_with)
);

-- 3. Create updated_at trigger for shared_tasks
CREATE OR REPLACE FUNCTION update_shared_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_shared_tasks_updated_at
    BEFORE UPDATE ON shared_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_shared_tasks_updated_at();

-- 4. Enable RLS on shared_tasks
ALTER TABLE shared_tasks ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for shared_tasks
-- Policy for users to see tasks shared with them
CREATE POLICY "Users can view tasks shared with them" ON shared_tasks
  FOR SELECT USING (shared_with = auth.uid());

-- Policy for users to see tasks they've shared
CREATE POLICY "Users can view tasks they've shared" ON shared_tasks
  FOR SELECT USING (shared_by = auth.uid());

-- Policy for users to insert shared tasks
CREATE POLICY "Users can share tasks" ON shared_tasks
  FOR INSERT WITH CHECK (shared_by = auth.uid());

-- Policy for users to update shared tasks (for accept/deny)
CREATE POLICY "Users can update tasks shared with them" ON shared_tasks
  FOR UPDATE USING (shared_with = auth.uid());

-- Policy for users to delete their own shares
CREATE POLICY "Users can delete their own shares" ON shared_tasks
  FOR DELETE USING (shared_by = auth.uid());

-- 6. Create function to share a task with a friend
CREATE OR REPLACE FUNCTION share_task_with_friend(
  task_id TEXT,
  friend_id UUID,
  user_id UUID
) RETURNS VOID AS $$
BEGIN
  INSERT INTO shared_tasks (original_task_id, shared_by, shared_with)
  VALUES (task_id, user_id, friend_id)
  ON CONFLICT (original_task_id, shared_by, shared_with) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create function to accept a shared task
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

-- 8. Create function to decline a shared task
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

-- 9. Create function to get pending shared tasks for a user
CREATE OR REPLACE FUNCTION get_pending_shared_tasks(user_id UUID)
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
  WHERE st.shared_with = user_id 
    AND st.status = 'pending'
  ORDER BY st.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON shared_tasks TO authenticated;
GRANT EXECUTE ON FUNCTION share_task_with_friend TO authenticated;
GRANT EXECUTE ON FUNCTION accept_shared_task TO authenticated;
GRANT EXECUTE ON FUNCTION decline_shared_task TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_shared_tasks TO authenticated;

-- 11. Create test data (optional - uncomment to test)
/*
-- Create a test shared task
INSERT INTO shared_tasks (original_task_id, shared_by, shared_with, status)
VALUES (
  'test-task-id', -- Replace with actual task ID
  'test-user-id', -- Replace with actual user ID
  'test-friend-id', -- Replace with actual friend ID
  'pending'
);
*/ 