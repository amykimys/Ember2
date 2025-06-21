-- Fix RLS policies for shared_events table
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can share events with their friends" ON shared_events;
DROP POLICY IF EXISTS "Users can view events shared with them" ON shared_events;
DROP POLICY IF EXISTS "Users can view events they shared" ON shared_events;
DROP POLICY IF EXISTS "Users can update events they shared" ON shared_events;
DROP POLICY IF EXISTS "Users can delete events they shared" ON shared_events;

-- Create improved RLS policies
-- Policy for inserting shared events
CREATE POLICY "Users can share events with their friends" ON shared_events
  FOR INSERT WITH CHECK (
    shared_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM friendships 
      WHERE (
        (user_id = shared_by AND friend_id = shared_with) OR
        (user_id = shared_with AND friend_id = shared_by)
      ) AND status = 'accepted'
    )
  );

-- Policy for viewing events shared with the user
CREATE POLICY "Users can view events shared with them" ON shared_events
  FOR SELECT USING (
    shared_with = auth.uid()
  );

-- Policy for viewing events the user shared
CREATE POLICY "Users can view events they shared" ON shared_events
  FOR SELECT USING (
    shared_by = auth.uid()
  );

-- Policy for updating events the user shared
CREATE POLICY "Users can update events they shared" ON shared_events
  FOR UPDATE USING (
    shared_by = auth.uid()
  );

-- Policy for deleting events the user shared
CREATE POLICY "Users can delete events they shared" ON shared_events
  FOR DELETE USING (
    shared_by = auth.uid()
  );

-- Add a debug function to check if users are friends
CREATE OR REPLACE FUNCTION check_friendship(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM friendships 
    WHERE (
      (user_id = user1_id AND friend_id = user2_id) OR
      (user_id = user2_id AND friend_id = user1_id)
    ) AND status = 'accepted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 