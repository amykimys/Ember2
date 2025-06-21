-- Create shared_events table
CREATE TABLE IF NOT EXISTS shared_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shared_events_original_event_id ON shared_events(original_event_id);
CREATE INDEX IF NOT EXISTS idx_shared_events_shared_by ON shared_events(shared_by);
CREATE INDEX IF NOT EXISTS idx_shared_events_shared_with ON shared_events(shared_with);
CREATE INDEX IF NOT EXISTS idx_shared_events_status ON shared_events(status);

-- Enable RLS
ALTER TABLE shared_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can share events with their friends" ON shared_events
  FOR INSERT WITH CHECK (
    shared_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM friendships 
      WHERE user_id = shared_by AND friend_id = shared_with AND status = 'accepted'
    )
  );

CREATE POLICY "Users can view events shared with them" ON shared_events
  FOR SELECT USING (
    shared_with = auth.uid()
  );

CREATE POLICY "Users can view events they shared" ON shared_events
  FOR SELECT USING (
    shared_by = auth.uid()
  );

CREATE POLICY "Users can update events they shared" ON shared_events
  FOR UPDATE USING (
    shared_by = auth.uid()
  );

CREATE POLICY "Users can delete events they shared" ON shared_events
  FOR DELETE USING (
    shared_by = auth.uid()
  );

-- Create function to get shared events for a user
CREATE OR REPLACE FUNCTION get_shared_events_for_user(user_id UUID)
RETURNS TABLE (
  shared_event_id UUID,
  original_event_id UUID,
  event_title TEXT,
  event_description TEXT,
  event_date TEXT,
  event_start_datetime TIMESTAMP WITH TIME ZONE,
  event_end_datetime TIMESTAMP WITH TIME ZONE,
  event_category_name TEXT,
  event_category_color TEXT,
  shared_by_name TEXT,
  shared_by_avatar TEXT,
  shared_by_username TEXT,
  shared_at TIMESTAMP WITH TIME ZONE,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    se.id as shared_event_id,
    se.original_event_id,
    e.title as event_title,
    e.description as event_description,
    e.date as event_date,
    e.start_datetime as event_start_datetime,
    e.end_datetime as event_end_datetime,
    e.category_name as event_category_name,
    e.category_color as event_category_color,
    p.full_name as shared_by_name,
    p.avatar_url as shared_by_avatar,
    p.username as shared_by_username,
    se.created_at as shared_at,
    se.status
  FROM shared_events se
  JOIN events e ON se.original_event_id = e.id
  JOIN profiles p ON se.shared_by = p.id
  WHERE se.shared_with = user_id
  ORDER BY se.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 